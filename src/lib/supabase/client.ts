import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn(
      'Supabase URL or Anon Key is missing in environment variables. Client client instantiation might fail or operate improperly.'
    );
  }

  return createBrowserClient(
    supabaseUrl || '',
    supabaseAnonKey || ''
  );
}
