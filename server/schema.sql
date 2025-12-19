-- Схема базы данных для Bonfire Awards 2025

-- Категории
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Номинанты
CREATE TABLE IF NOT EXISTS nominees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Связь категорий и номинантов (многие ко многим)
CREATE TABLE IF NOT EXISTS category_nominees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  nominee_id UUID NOT NULL REFERENCES nominees(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(category_id, nominee_id)
);

-- Голоса
CREATE TABLE IF NOT EXISTS votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL, -- ID пользователя из Bonfire
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  nominee_id UUID NOT NULL REFERENCES nominees(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, category_id) -- Один голос на категорию от пользователя
);

-- Индексы для производительности
CREATE INDEX IF NOT EXISTS idx_category_nominees_category ON category_nominees(category_id);
CREATE INDEX IF NOT EXISTS idx_category_nominees_nominee ON category_nominees(nominee_id);
CREATE INDEX IF NOT EXISTS idx_votes_user ON votes(user_id);
CREATE INDEX IF NOT EXISTS idx_votes_category ON votes(category_id);
CREATE INDEX IF NOT EXISTS idx_votes_nominee ON votes(nominee_id);
CREATE INDEX IF NOT EXISTS idx_votes_user_category ON votes(user_id, category_id);

-- RLS (Row Level Security) политики
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE nominees ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_nominees ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;

-- Политики для публичного доступа (чтение категорий и номинантов)
CREATE POLICY "Categories are viewable by everyone" ON categories
  FOR SELECT USING (true);

CREATE POLICY "Nominees are viewable by everyone" ON nominees
  FOR SELECT USING (true);

CREATE POLICY "Category nominees are viewable by everyone" ON category_nominees
  FOR SELECT USING (true);

-- Политики для голосов (пользователи могут видеть только свои голоса)
CREATE POLICY "Users can view their own votes" ON votes
  FOR SELECT USING (auth.uid()::text = user_id);

-- Политики для создания голосов (только аутентифицированные пользователи)
CREATE POLICY "Authenticated users can create votes" ON votes
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

-- Политики для обновления голосов (только свои)
CREATE POLICY "Users can update their own votes" ON votes
  FOR UPDATE USING (auth.uid()::text = user_id);

-- Настройки приложения
CREATE TABLE IF NOT EXISTS settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Инициализация настройки голосования (по умолчанию включено)
INSERT INTO settings (key, value) 
VALUES ('voting_enabled', 'true')
ON CONFLICT (key) DO NOTHING;

-- RLS для settings (публичное чтение, админское изменение через бекенд)
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Settings are viewable by everyone" ON settings
  FOR SELECT USING (true);

-- Примечание: Админские операции (создание/редактирование/удаление категорий и номинантов)
-- выполняются через бекенд с использованием Service Role Key, который обходит RLS

