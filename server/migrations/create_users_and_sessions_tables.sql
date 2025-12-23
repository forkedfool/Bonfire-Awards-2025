-- Таблица для хранения информации о пользователях
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bonfire_id TEXT NOT NULL UNIQUE, -- ID пользователя из Bonfire (sub)
  username TEXT,
  email TEXT,
  preferred_username TEXT,
  name TEXT,
  email_verified BOOLEAN DEFAULT false,
  first_login_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_login_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  login_count INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица для отслеживания сессий/просмотров
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT, -- bonfire_id пользователя (может быть NULL для неавторизованных)
  page VARCHAR(100) NOT NULL, -- 'landing', 'voting', 'admin-dashboard', etc.
  action VARCHAR(100), -- 'view', 'vote', 'login', etc.
  metadata JSONB, -- Дополнительные данные (категория, номинант и т.д.)
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Индексы для производительности
CREATE INDEX IF NOT EXISTS idx_users_bonfire_id ON users(bonfire_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_page ON sessions(page);
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at);
CREATE INDEX IF NOT EXISTS idx_sessions_action ON sessions(action);

-- RLS политики
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- Пользователи видят только свои данные
CREATE POLICY "Users can view their own data" ON users
  FOR SELECT USING (auth.uid()::text = bonfire_id);

-- Все могут создавать записи о сессиях (для отслеживания просмотров)
CREATE POLICY "Anyone can create sessions" ON sessions
  FOR INSERT WITH CHECK (true);

-- Админы видят все сессии (через бекенд)
-- Пользователи видят только свои сессии
CREATE POLICY "Users can view their own sessions" ON sessions
  FOR SELECT USING (auth.uid()::text = user_id OR user_id IS NULL);

