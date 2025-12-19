-- Миграция: создание таблицы settings для управления статусом голосования

-- Настройки приложения
CREATE TABLE IF NOT EXISTS settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Индекс для быстрого поиска по ключу
CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key);

-- Инициализация настройки голосования (по умолчанию включено)
INSERT INTO settings (key, value) 
VALUES ('voting_enabled', 'true')
ON CONFLICT (key) DO NOTHING;

-- RLS для settings (публичное чтение, админское изменение через бекенд)
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Settings are viewable by everyone" ON settings
  FOR SELECT USING (true);

-- Комментарий к таблице
COMMENT ON TABLE settings IS 'Настройки приложения Bonfire Awards';
COMMENT ON COLUMN settings.key IS 'Уникальный ключ настройки';
COMMENT ON COLUMN settings.value IS 'Значение настройки (строка)';

