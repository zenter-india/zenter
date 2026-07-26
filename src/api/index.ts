/**
 * Backend data-access layer (AD-1). All Supabase reads/writes, RPC wrappers,
 * and realtime subscriptions live under this folder. Feature code imports from
 * here — never constructs its own client.
 *
 * Story 1.4 ports the live `js/supabase.js` surface (queries + RPCs + realtime)
 * into typed modules here. For now this exports only the client.
 */
export { supabase } from './client';
