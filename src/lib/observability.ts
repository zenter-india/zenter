import Constants from 'expo-constants';
import * as Sentry from '@sentry/react-native';
import { getAuth } from '@react-native-firebase/auth';
import { supabase } from '@/api/client';
import { queryClient } from '@/data/queryClient';
import { qk } from '@/data/keys';

/**
 * One observability pipeline (AD-13). Sentry for crashes; a single `track()` for
 * product analytics that preserves the documented web event names. NO PII in
 * payloads (never send phone numbers).
 */
const dsn = (Constants.expoConfig?.extra as { sentryDsn?: string } | undefined)?.sentryDsn;

/**
 * The signed-in user's DB id, read synchronously from the already-cached
 * profile query (qk.profile) rather than fetched — track() is a plain
 * function called from many non-component contexts, so it can't use hooks.
 * `null` before the profile has loaded once, which is fine: analytics_events
 * .user_id is nullable and early boot events aren't attributable anyway.
 */
function currentUserId(): string | null {
  const phone = getAuth().currentUser?.phoneNumber;
  if (!phone) return null;
  return queryClient.getQueryData<{ id: string }>(qk.profile(phone))?.id ?? null;
}

let initialized = false;
export function initObservability() {
  if (initialized || !dsn) return;
  Sentry.init({ dsn, enableAutoSessionTracking: true, tracesSampleRate: 0.2 });
  initialized = true;
}

const PII_KEYS = new Set(['phone', 'phoneNumber', 'anonKey', 'code']);
function scrub(props?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!props) return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(props)) if (!PII_KEYS.has(k)) out[k] = v;
  return out;
}

/** Product analytics. Event names mirror the web set (chat_opened, message_sent,
 * contact_exchange_requested, upgrade_cta_click, …). Fire-and-forget insert into
 * the `analytics_events` table (id, event_name, user_id, properties, created_at)
 * — never awaited by callers, never blocks the UI action it's attached to. */
export function track(event: string, props?: Record<string, unknown>) {
  const clean = scrub(props);
  if (initialized) Sentry.addBreadcrumb({ category: 'analytics', message: event, data: clean, level: 'info' });
  if (__DEV__) console.log('[track]', event, clean ?? '');
  supabase
    .from('analytics_events')
    .insert({ event_name: event, user_id: currentUserId(), properties: clean ?? null })
    .then(({ error }) => {
      if (error && __DEV__) console.warn('[track] analytics_events insert failed', error.message);
    });
}

export const captureError = (e: unknown) => { if (initialized) Sentry.captureException(e); else if (__DEV__) console.warn(e); };
