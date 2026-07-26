/**
 * Contact masking — the SINGLE boundary that decides how a phone number is shown
 * (AD-8, FR-11/FR-22, NFR-6). A contact stays masked everywhere until an accepted
 * Contact Exchange; only then does UI use {@link formatPhone} on the phone that
 * the exchange RPC returned. No feature may format a phone by hand — always route
 * through this module so the invariant holds in exactly one place.
 *
 * Ported from web: `maskPhone` (js/connections.js / js/dashboard.js) and
 * `formatPhone` (js/chat.js). Avatar initials come from the design foundation.
 */

/**
 * Masked form: `+91 XXXXXXX` + the last 3 digits (e.g. `+91 XXXXXXX210`). Shown
 * for any not-yet-exchanged contact. Takes ONLY the last 3 digits (never the
 * full number) — the full phone of an other user must never reach the client
 * before an accepted Contact Exchange (AD-8/NFR-6); the server projects
 * `phone_last3` instead of `phone` for exactly this reason. Returns `'—'` for
 * an empty value.
 */
export function maskPhone(last3?: string | null): string {
  if (!last3) return '—';
  return `+91 XXXXXXX${last3}`;
}

/**
 * Pretty form of a FULLY REVEALED number: `+91 XXXXX XXXXX`. Use ONLY after an
 * accepted exchange. Returns `'—'` for an empty value.
 */
export function formatPhone(phone?: string | null): string {
  if (!phone) return '—';
  return String(phone).replace(/(\+91)(\d{5})(\d{5})/, '$1 $2 $3');
}

/** Re-exported from the design foundation so identity display has one surface. */
export { avatarInitials } from '@/theme';
