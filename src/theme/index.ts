/**
 * Design system entry (AD-7). Import tokens from here everywhere.
 * Full token set lives in ./tokens; this re-exports plus a couple of helpers.
 */
import { colors } from './tokens';

export * from './tokens';

/** Initials for the avatar (max 2 letters, fallback 'Z'). */
export function avatarInitials(name?: string | null): string {
  if (!name) return 'Z';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'Z';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

/** Status-bar tint (brand orange). */
export const statusBarColor = colors.primary;

/** Same 7-color rotation the website uses for district/name avatars
 *  (js/dashboard.js AVATAR_COLORS) — kept in sync so the mobile app's
 *  district grid matches the web's visual identity. */
const AVATAR_COLORS = ['#FF6B35', '#4F46E5', '#10B981', '#F59E0B', '#8B5CF6', '#06B6D4', '#EF4444'];

/** Deterministic per-name color, matching the website's avatarColor() hash
 *  exactly (djb2-like: hash = hash*31 + charCode) so the same name/district
 *  always gets the same color on both platforms. */
export function avatarColor(name?: string | null): string {
  let hash = 0;
  for (const c of name ?? '') hash = (Math.imul(hash, 31) + c.charCodeAt(0)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]!;
}
