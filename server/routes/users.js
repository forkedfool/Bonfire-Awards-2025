import express from 'express';
import { verifyBonfireToken } from '../middleware/auth.js';
import { supabase, TABLES } from '../db/supabase.js';

const router = express.Router();

// Сохранить или обновить информацию о пользователе (требует авторизации)
router.post('/save', verifyBonfireToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { username, email, preferred_username, name, email_verified } = req.body;

    // Проверяем, существует ли пользователь
    const { data: existingUser, error: checkError } = await supabase
      .from(TABLES.USERS)
      .select('*')
      .eq('bonfire_id', userId)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      throw checkError;
    }

    const now = new Date().toISOString();

    if (existingUser) {
      // Обновляем существующего пользователя
      const { data, error } = await supabase
        .from(TABLES.USERS)
        .update({
          username: username || existingUser.username,
          email: email || existingUser.email,
          preferred_username: preferred_username || existingUser.preferred_username,
          name: name || existingUser.name,
          email_verified: email_verified !== undefined ? email_verified : existingUser.email_verified,
          last_login_at: now,
          login_count: (existingUser.login_count || 0) + 1,
          updated_at: now,
        })
        .eq('bonfire_id', userId)
        .select()
        .single();

      if (error) throw error;

      res.json({
        success: true,
        user: data,
        isNew: false,
      });
    } else {
      // Создаем нового пользователя
      const { data, error } = await supabase
        .from(TABLES.USERS)
        .insert({
          bonfire_id: userId,
          username: username,
          email: email,
          preferred_username: preferred_username,
          name: name,
          email_verified: email_verified || false,
          first_login_at: now,
          last_login_at: now,
          login_count: 1,
        })
        .select()
        .single();

      if (error) throw error;

      res.json({
        success: true,
        user: data,
        isNew: true,
      });
    }
  } catch (error) {
    console.error('Error saving user:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Записать сессию/просмотр (публичный endpoint, но может быть с авторизацией)
router.post('/track-session', async (req, res) => {
  try {
    const { page, action, metadata } = req.body;
    
    // Извлекаем userId из metadata, если он там есть (передается с фронтенда)
    let userId = null;
    if (metadata && metadata.user_id) {
      userId = metadata.user_id;
    }

    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'] || null;

    const { data, error } = await supabase
      .from(TABLES.SESSIONS)
      .insert({
        user_id: userId,
        page: page || 'unknown',
        action: action || 'view',
        metadata: metadata || {},
        ip_address: ipAddress,
        user_agent: userAgent,
      })
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      session: data,
    });
  } catch (error) {
    console.error('Error tracking session:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;

