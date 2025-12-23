import { createClient } from '@supabase/supabase-js';
import { config } from '../config.js';

if (!config.supabase.url || !config.supabase.key) {
  throw new Error('Supabase URL and Service Role Key must be set in environment variables');
}

export const supabase = createClient(config.supabase.url, config.supabase.key);

// Таблицы
export const TABLES = {
  CATEGORIES: 'categories',
  NOMINEES: 'nominees',
  CATEGORY_NOMINEES: 'category_nominees',
  VOTES: 'votes',
  SETTINGS: 'settings',
  USERS: 'users',
  SESSIONS: 'sessions',
};

