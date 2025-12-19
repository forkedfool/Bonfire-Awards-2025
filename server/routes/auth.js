import express from 'express';
import { config } from '../config.js';
import { verifyBonfireToken } from '../middleware/auth.js';

const router = express.Router();

// Получить информацию о текущем пользователе
// Требует валидный Bearer token в заголовке Authorization
router.get('/me', verifyBonfireToken, (req, res) => {
  try {
    // Информация о пользователе уже добавлена в req.user middleware'ом verifyBonfireToken
    res.json({
      success: true,
      user: {
        id: req.user.id,
        email: req.user.email,
        username: req.user.username,
      },
    });
  } catch (error) {
    console.error('Error getting user info:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to get user information' 
    });
  }
});

// Обмен authorization code на токены (если Bonfire требует client_secret)
// ВАЖНО: Этот endpoint должен использоваться только если Bonfire требует client_secret
// для обмена токенов, и обмен не может происходить на фронтенде
// Также используется oidc-client для обхода проблем с прямым обменом токенов
// Поддерживает как JSON, так и application/x-www-form-urlencoded (для oidc-client)
router.post('/exchange-token', async (req, res) => {
  try {
    // Поддерживаем оба формата: JSON и form-urlencoded
    // express.urlencoded уже обработал form-urlencoded в index.js
    const code = req.body.code;
    const code_verifier = req.body.code_verifier;
    const redirect_uri = req.body.redirect_uri;
    
    console.log('Token exchange request:', {
      contentType: req.get('content-type'),
      hasCode: !!code,
      hasCodeVerifier: !!code_verifier,
      hasRedirectUri: !!redirect_uri,
    });

    if (!code) {
      return res.status(400).json({ 
        success: false,
        error: 'code is required' 
      });
    }

    if (!config.bonfire.clientId) {
      console.error('BONFIRE_CLIENT_ID not configured');
      return res.status(500).json({ 
        success: false,
        error: 'Server configuration error' 
      });
    }

    // Формируем параметры для обмена токенов
    const tokenParams = new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      client_id: config.bonfire.clientId,
      redirect_uri: redirect_uri || `${req.protocol}://${req.get('host')}/auth/callback`,
    });

    // Добавляем PKCE code_verifier если предоставлен
    if (code_verifier) {
      tokenParams.append('code_verifier', code_verifier);
    }

    // Добавляем client_secret если требуется (только на бэкенде!)
    if (config.bonfire.clientSecret) {
      tokenParams.append('client_secret', config.bonfire.clientSecret);
    }

    console.log('Exchanging token with Bonfire:', {
      authority: config.bonfire.authority,
      hasCode: !!code,
      hasCodeVerifier: !!code_verifier,
      hasClientSecret: !!config.bonfire.clientSecret,
      redirect_uri: redirect_uri || `${req.protocol}://${req.get('host')}/auth/callback`,
    });

    // Если Bonfire требует client_secret для обмена токенов
    // Используем его здесь (на бекенде, безопасно)
    const tokenUrl = `${config.bonfire.authority}/openid/token`;
    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: tokenParams.toString(),
    });

    const responseText = await tokenResponse.text();
    console.log('Token exchange response status:', tokenResponse.status);
    console.log('Token exchange response:', responseText.substring(0, 200));

    if (!tokenResponse.ok) {
      console.error('Token exchange error:', {
        status: tokenResponse.status,
        statusText: tokenResponse.statusText,
        body: responseText,
      });
      
      let errorDetails;
      try {
        errorDetails = JSON.parse(responseText);
      } catch (e) {
        errorDetails = { error: responseText };
      }
      
      return res.status(tokenResponse.status).json({ 
        success: false,
        error: 'Failed to exchange code for tokens',
        details: errorDetails,
        bonfireError: true,
      });
    }

    let tokens;
    try {
      tokens = JSON.parse(responseText);
    } catch (e) {
      console.error('Failed to parse token response as JSON:', e);
      return res.status(500).json({ 
        success: false,
        error: 'Invalid token response format' 
      });
    }

    // Возвращаем токены в формате, ожидаемом oidc-client
    res.json({
      access_token: tokens.access_token,
      id_token: tokens.id_token,
      refresh_token: tokens.refresh_token,
      token_type: tokens.token_type || 'Bearer',
      expires_in: tokens.expires_in,
      scope: tokens.scope,
      // Также возвращаем success для совместимости с нашим API
      success: true,
    });
  } catch (error) {
    console.error('Error exchanging token:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});

// Получить userinfo через бэкенд (для обхода CORS)
router.post('/userinfo', async (req, res) => {
  try {
    const { access_token } = req.body;

    if (!access_token) {
      return res.status(400).json({ 
        success: false,
        error: 'access_token is required' 
      });
    }

    // Получаем userinfo от Bonfire
    const userInfoResponse = await fetch('https://api.bonfire.moe/openid/userinfo', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Accept': 'application/json',
      },
    });

    if (!userInfoResponse.ok) {
      const errorText = await userInfoResponse.text();
      console.error('UserInfo error:', errorText);
      return res.status(userInfoResponse.status).json({ 
        success: false,
        error: 'Failed to get userinfo',
        details: errorText 
      });
    }

    const userInfo = await userInfoResponse.json();
    res.json({
      success: true,
      userinfo: userInfo,
    });
  } catch (error) {
    console.error('Error getting userinfo:', error);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Internal server error' 
    });
  }
});

export default router;

