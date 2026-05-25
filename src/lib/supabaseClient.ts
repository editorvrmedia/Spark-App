import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/database';

const rawUrl = import.meta.env.VITE_SUPABASE_URL;
const rawAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const isValidUrl = (url: string | undefined): boolean => {
  if (!url) return false;
  if (url === 'your_supabase_project_url') return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

const isValidAnonKey = (key: string | undefined): boolean => {
  if (!key) return false;
  if (key === 'your_supabase_anon_key') return false;
  return true;
};

const isSupabaseConfigured = isValidUrl(rawUrl) && isValidAnonKey(rawAnonKey);

const supabaseUrl = isSupabaseConfigured ? rawUrl! : 'https://placeholder-url.supabase.co';
const supabaseAnonKey = isSupabaseConfigured ? rawAnonKey! : 'placeholder-anon-key';

if (!isSupabaseConfigured) {
  console.warn(
    'Supabase is not configured or configured with placeholder values. ' +
    'The app will run in offline sandbox / simulator mode.'
  );
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

