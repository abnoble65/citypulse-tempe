import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

let supabase: SupabaseClient;

if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
} else {
  console.warn(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY — Supabase features disabled'
  );
  // Stub client: any chained query resolves to { data: null, error }
  // so existing error-handling in consumers degrades gracefully.
  const stubError = { message: 'Supabase not configured', details: '', hint: '', code: '' };
  const stubResult = { data: null, error: stubError, count: null, status: 200, statusText: 'OK' };
  function createStub(): any {
    return new Proxy(() => {}, {
      get: (_target, prop) => {
        if (prop === 'then') {
          return (resolve: any, reject?: any) =>
            Promise.resolve(stubResult).then(resolve, reject);
        }
        return createStub();
      },
      apply: () => createStub(),
    });
  }
  supabase = createStub() as unknown as SupabaseClient;
}

export { supabase };
