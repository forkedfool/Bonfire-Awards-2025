import { config } from '../config.js';
import { verifyBonfireToken } from './auth.js';

// Проверка, является ли пользователь админом по его ID
export function verifyAdmin(req, res, next) {
  // Сначала проверяем токен (добавляет req.user)
  verifyBonfireToken(req, res, () => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ 
          success: false,
          error: 'User ID not found' 
        });
      }

      if (!config.admin.userIds || config.admin.userIds.length === 0) {
        console.error('ADMIN_USER_IDS не установлен! Установите переменную окружения.');
        return res.status(500).json({ 
          success: false,
          error: 'Admin configuration not set' 
        });
      }

      // Нормализуем User ID к строке для сравнения (ID может быть числом или строкой)
      const normalizedUserId = String(userId);
      
      // Проверяем, есть ли ID в списке админов (сравниваем как строки)
      const isAdmin = config.admin.userIds.some(adminId => String(adminId) === normalizedUserId);
      
      if (!isAdmin) {
        // Логируем попытку доступа не-админа
        console.log(`[ADMIN ACCESS DENIED] User ID: ${userId} (normalized: ${normalizedUserId}), Email: ${req.user.email || 'unknown'}`);
        console.log(`[ADMIN ACCESS DENIED] Admin IDs: ${config.admin.userIds.join(', ')}`);
        return res.status(403).json({ 
          success: false,
          error: 'Access denied. Admin privileges required.' 
        });
      }

      // Логируем успешный доступ админа
      console.log(`[ADMIN ACCESS] User ID: ${userId}, Email: ${req.user.email || 'unknown'}`);
      next();
    } catch (error) {
      console.error('Admin verification error:', error);
      res.status(500).json({ 
        success: false,
        error: 'Admin verification failed' 
      });
    }
  });
}

