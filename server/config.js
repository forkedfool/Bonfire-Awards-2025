import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: process.env.PORT || 3000,
  bonfire: {
    authority: process.env.BONFIRE_AUTHORITY || 'https://api.bonfire.moe',
    clientId: process.env.BONFIRE_CLIENT_ID,
    // ВАЖНО: client_secret должен быть ТОЛЬКО на бекенде!
    // Используется только если Bonfire требует его для обмена токенов
    // НИКОГДА не добавляйте его на фронтенд!
    clientSecret: process.env.BONFIRE_CLIENT_SECRET,
  },
  supabase: {
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_SERVICE_ROLE_KEY, // Используем service role key для бекенда
  },
  admin: {
    // Список ID админов (Bonfire user IDs, разделенные запятыми)
    // Пример: ADMIN_USER_IDS=user-id-1,user-id-2,user-id-3
    // ID могут быть как строками, так и числами - нормализуем к строкам для сравнения
    userIds: process.env.ADMIN_USER_IDS 
      ? process.env.ADMIN_USER_IDS.split(',').map(id => String(id.trim()))
      : [],
  },
};

