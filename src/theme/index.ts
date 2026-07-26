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
