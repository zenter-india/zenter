import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';

/**
 * The single Supabase client for the whole app (AD-1: one data-access layer).
 *
 * Authorization model: Supabase Auth (phone OTP via Twilio Verify) is the
 * identity system — `persistSession`/`autoRefreshToken` are on, backed by
 * AsyncStorage, so a session survives app restarts and refreshes itself
 * before the JWT expires. RLS policies key off `auth.uid()` via
 * `current_app_uid()`/`is_admin()` (see `supabase/migrations/20260708_0*`).
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
      storage: AsyncStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false, // no web redirect/OAuth flow on RN
    },
  },
);
