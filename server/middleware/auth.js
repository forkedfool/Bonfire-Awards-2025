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
        error: 'No authorization header' 
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
    
    // ДЕТАЛЬНОЕ ЛОГИРОВАНИЕ ДЛЯ ОТЛАДКИ
    const tokenParts = token.split('.');
    const isJWT = tokenParts.length === 3;
    
    console.log('[TOKEN DEBUG] Received token:', {
      length: token.length,
      firstChars: token.substring(0, 50),
      lastChars: token.substring(Math.max(0, token.length - 20)),
      partsCount: tokenParts.length,
      isJWT: isJWT,
      tokenType: isJWT ? 'JWT' : 'opaque',
    });
    
    // Проверяем минимальную длину токена
    if (token.length < 10) {
      console.error('[AUTH ERROR] Token too short:', {
        tokenLength: token.length,
        tokenPreview: token,
      });
      return res.status(401).json({ 
        success: false,
        error: 'Invalid token format' 
      });
    }

    // Определяем тип токена и обрабатываем соответственно
    if (isJWT) {
      // JWT токен - проверяем через JWKS
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
          email: decoded.email || (decoded.email_verified ? decoded.email : null),
          username: decoded.preferred_username || decoded.name || decoded.sub,
        };

        console.log('[AUTH] JWT token verified, user:', req.user.id);
        next();
      } catch (verifyError) {
        console.error('JWT Token verification error:', verifyError);
        
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
    } else {
      // Opaque token - проверяем через userinfo endpoint
      try {
        console.log('[AUTH] Verifying opaque token via userinfo endpoint');
        
        const userInfoUrl = `${config.bonfire.authority}/openid/userinfo`;
        const userInfoResponse = await fetch(userInfoUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
          },
        });

        if (!userInfoResponse.ok) {
          const errorText = await userInfoResponse.text();
          console.error('[AUTH ERROR] UserInfo request failed:', {
            status: userInfoResponse.status,
            statusText: userInfoResponse.statusText,
            error: errorText,
          });
          
          if (userInfoResponse.status === 401) {
            return res.status(401).json({ 
              success: false,
              error: 'Invalid token' 
            });
          }
          
          return res.status(401).json({ 
            success: false,
            error: 'Token verification failed',
            details: process.env.NODE_ENV === 'development' ? errorText : undefined
          });
        }

        const userInfo = await userInfoResponse.json();
        
        if (!userInfo.sub) {
          console.error('[AUTH ERROR] No sub in userinfo response:', userInfo);
          return res.status(401).json({ 
            success: false,
            error: 'Invalid userinfo response' 
          });
        }

        // Добавляем информацию о пользователе в запрос (та же структура, что и для JWT)
        req.user = {
          id: userInfo.sub,
          email: userInfo.email || null,
          username: userInfo.preferred_username || userInfo.name || userInfo.sub,
        };

        console.log('[AUTH] Opaque token verified via userinfo, user:', req.user.id);
        next();
      } catch (userInfoError) {
        console.error('[AUTH ERROR] UserInfo request exception:', userInfoError);
        return res.status(401).json({ 
          success: false,
          error: 'Token verification failed',
          details: process.env.NODE_ENV === 'development' ? userInfoError.message : undefined
        });
      }
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ 
      success: false,
      error: 'Authentication failed' 
    });
  }
}

