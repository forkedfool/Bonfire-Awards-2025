import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import { config } from '../config.js';

// Кэш для JWKS
const client = jwksClient({
  jwksUri: `${config.bonfire.authority}/.well-known/jwks.json`,
  cache: true,
  cacheMaxAge: 86400000, // 24 часа
});

function getKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) {
      return callback(err);
    }
    const signingKey = key.getPublicKey();
    callback(null, signingKey);
  });
}

export async function verifyBonfireToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);

    // Проверяем токен через JWKS
    // Issuer может быть в разных форматах, проверяем оба варианта
    jwt.verify(token, getKey, {
      audience: config.bonfire.clientId,
      issuer: [
        `${config.bonfire.authority}/`,
        config.bonfire.authority,
        'https://bonfire.moe',
      ],
      algorithms: ['RS256'],
    }, (err, decoded) => {
      if (err) {
        console.error('Token verification error:', err);
        return res.status(401).json({ error: 'Invalid token' });
      }

      // Добавляем информацию о пользователе в запрос
      req.user = {
        id: decoded.sub,
        email: decoded.email,
        username: decoded.preferred_username || decoded.name,
      };

      next();
    });
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ error: 'Authentication failed' });
  }
}

