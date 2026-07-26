import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';

/**
 * The single Supabase client for the whole app (AD-1: one data-access layer).
 *
 * Authorization model (AD-4): Firebase Phone OTP is the sole identity system.
 * Supabase runs on the anon/publishable key with `persistSession: false` and
 * `autoRefreshToken: false` — the app never uses Supabase Auth sessions. The
 * client-trusted, phone-scoped access model is an accepted, documented v1 risk;
 * do not add Supabase Auth here.
 *
 * Do NOT call createClient anywhere else. All backend I/O goes through src/api/*.
 *
 * Falls back to placeholder values when config is missing (env.supabaseUrl/
 * supabaseAnonKey are empty strings, not throwing) so this module-scope call
 * can't crash the bundle before React mounts — createClient() itself throws
 * on an empty URL/key. app/_layout.tsx shows a dedicated error screen and
 * never mounts anything that would actually use this client in that case.
 */
export const supabase = createClient(
  env.supabaseUrl || 'https://misconfigured.invalid',
  env.supabaseAnonKey || 'misconfigured',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  },
);
