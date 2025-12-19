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
    // ВАЖНО: masterPassword должен быть установлен через переменную окружения!
    // НЕ используйте дефолтное значение в production!
    masterPassword: process.env.ADMIN_MASTER_PASSWORD,
  },
};

