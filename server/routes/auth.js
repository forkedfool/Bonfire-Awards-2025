import express from 'express';
import { config } from '../config.js';

const router = express.Router();

// Обмен authorization code на токены (если Bonfire требует client_secret)
// ВАЖНО: Этот endpoint должен использоваться только если Bonfire требует client_secret
// для обмена токенов, и обмен не может происходить на фронтенде
router.post('/exchange-token', async (req, res) => {
  try {
    const { code, code_verifier, redirect_uri } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'code is required' });
    }

    // Если Bonfire требует client_secret для обмена токенов
    // Используем его здесь (на бекенде, безопасно)
    const tokenResponse = await fetch(`${config.bonfire.authority}/openid/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        client_id: config.bonfire.clientId,
        redirect_uri: redirect_uri || `${req.protocol}://${req.get('host')}/auth/callback`,
        ...(code_verifier && { code_verifier }), // PKCE
        ...(config.bonfire.clientSecret && { client_secret: config.bonfire.clientSecret }), // Если требуется
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange error:', errorText);
      return res.status(tokenResponse.status).json({ 
        error: 'Failed to exchange code for tokens',
        details: errorText 
      });
    }

    const tokens = await tokenResponse.json();
    res.json(tokens);
  } catch (error) {
    console.error('Error exchanging token:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;

