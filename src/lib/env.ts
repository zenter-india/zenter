import Constants from 'expo-constants';

/**
 * Typed, validated access to runtime config.
 * Values come from app.config.ts `extra` (sourced from EXPO_PUBLIC_* env / EAS secrets).
 * No secret literals live in source — see .env.example.
 */
type Extra = {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
};

const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

const missing = (['supabaseUrl', 'supabaseAnonKey'] as const).filter((k) => !extra[k]);

/**
 * Set when required config is missing. Checked by app/_layout.tsx to show a
 * dedicated config-error screen instead of the app. Deliberately does NOT
 * throw at module scope: a throw here happens during bundle evaluation,
 * before React ever mounts, so nothing could catch it — the app would just
 * show a blank white screen with no indication of what went wrong.
 */
export const envConfigError: string | null =
  missing.length > 0
    ? `Missing config: ${missing.join(', ')}. Set it in .env (EXPO_PUBLIC_*) or EAS secrets — see .env.example.`
    : null;

/**
 * Falls back to empty strings when config is missing. Safe to import
 * anywhere (e.g. api/client.ts's module-scope createClient call) because
 * app/_layout.tsx never mounts the real app — and therefore never lets
 * anything actually call Supabase — while envConfigError is set.
 */
export const env = {
  supabaseUrl: extra.supabaseUrl ?? '',
  supabaseAnonKey: extra.supabaseAnonKey ?? '',
};
