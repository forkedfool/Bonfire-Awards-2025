import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import { config } from '../config.js';
import { promisify } from 'util';

// Кэш для JWKS
const client = jwksClient({
  jwksUri: `${config.bonfire.authority}/.well-known/jwks.json`,
  cache: true,
  cacheMaxAge: 86400000, // 24 часа
  rateLimit: true,
  jwksRequestsPerMinute: 5,
});

// Получение ключа для верификации токена
function getKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) {
      return callback(err);
    }
    const signingKey = key.getPublicKey();
    callback(null, signingKey);
  });
}

// Преобразуем callback-based jwt.verify в промис
const verifyToken = promisify(jwt.verify);

export async function verifyBonfireToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ 
        success: false,
        error: 'No authorization header provided' 
      });
    }
    
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false,
        error: 'Invalid authorization format. Expected: Bearer <token>' 
      });
    }

    const token = authHeader.substring(7).trim();

    if (!token || token.length === 0) {
      return res.status(401).json({ 
        success: false,
        error: 'Token is empty' 
      });
    }
    
    // Проверяем базовый формат токена (JWT должен иметь 3 части, разделенные точками)
    const tokenParts = token.split('.');
    if (tokenParts.length !== 3) {
      console.error('Invalid token format: expected JWT with 3 parts, got', tokenParts.length);
      return res.status(401).json({ 
        success: false,
        error: 'Invalid token format' 
      });
    }

    // Проверяем токен через JWKS
    // Issuer может быть в разных форматах, проверяем оба варианта
    try {
      const decoded = await verifyToken(token, getKey, {
        audience: config.bonfire.clientId,
        issuer: [
          `${config.bonfire.authority}/`,
          config.bonfire.authority,
          'https://bonfire.moe',
        ],
        algorithms: ['RS256'],
      });

      // Добавляем информацию о пользователе в запрос
      req.user = {
        id: decoded.sub,
        email: decoded.email || decoded.email_verified ? decoded.email : null,
        username: decoded.preferred_username || decoded.name || decoded.sub,
      };

      next();
    } catch (verifyError) {
      console.error('Token verification error:', verifyError);
      
      // Более детальная обработка ошибок
      let errorMessage = 'Invalid token';
      if (verifyError.name === 'TokenExpiredError') {
        errorMessage = 'Token expired';
      } else if (verifyError.name === 'JsonWebTokenError') {
        errorMessage = 'Invalid token format';
      } else if (verifyError.name === 'NotBeforeError') {
        errorMessage = 'Token not active yet';
      }
      
      return res.status(401).json({ 
        success: false,
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? verifyError.message : undefined
      });
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ 
      success: false,
      error: 'Authentication failed' 
    });
  }
}

