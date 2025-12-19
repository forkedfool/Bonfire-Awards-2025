import { config } from '../config.js';

// Простая проверка мастер-пароля для админки
export function verifyAdminPassword(req, res, next) {
  const password = req.headers['x-admin-password'] || req.body.password;

  if (!password) {
    return res.status(401).json({ error: 'Admin password required' });
  }

  if (!config.admin.masterPassword) {
    console.error('ADMIN_MASTER_PASSWORD не установлен! Установите переменную окружения.');
    return res.status(500).json({ error: 'Admin authentication not configured' });
  }

  if (password !== config.admin.masterPassword) {
    return res.status(403).json({ error: 'Invalid admin password' });
  }

  next();
}

