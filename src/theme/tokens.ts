import { Platform, TextStyle } from 'react-native';

/**
 * The single source of visual truth (AD-7). Exact values from DESIGN.md.
 * Feature code MUST read from here — no literal hex/px/font names in features.
 */

export const colors = {
  primary: '#FF6B35',
  primary600: '#EF5A23',
  primary100: '#FFE9DD',
  secondary: '#4F46E5',
  secondary600: '#4338CA',
  secondary100: '#ECEBFF',
  secondary50: '#F3F0FF', // Stitch upgrade-banner tint (light indigo wash)
  accent: '#10B981',
  accent100: '#D1FAE5',
  info: '#6366F1',
  bg: '#F8FAFC', // Match web exact (was #F8F9FF)
  surface: '#FFFFFF',
  surface2: '#F1F5F9',
  border: '#E2E8F0',
  borderStrong: '#CBD5E1',
  text: '#0F172A',
  textMuted: '#475569',
  // slate-500 (≈4.8:1 on white) — meets WCAG AA for the caption/label/placeholder
  // roles this drives. Was #94A3B8 (slate-400, ≈2.7:1, failed AA).
  textSubtle: '#64748B',
  danger: '#EF4444',
  warning: '#F59E0B',
  white: '#FFFFFF',
  // Logistics chip (Stitch): blue-tinted pill for travel/stay tags.
  chipBg: '#EFF6FF', // blue-50
  chipBorder: '#DBEAFE', // blue-100
  chipText: '#334155', // slate-700
  // Warm card treatment (Stitch aspirant-card border).
  cardWarmBorder: '#FFF4E5',
  // Route-timeline dots (MateCard): home = slate-800, centre = danger (below).
  routeHome: '#1E293B',
  // Zenter Plus card treatment (web .hm-mate--plus): amber-50 wash + amber-200 border.
  plusTint: '#FFFBEB',
  plusBorder: '#FDE68A',
  // "Early Access Offer" promo banner on the Plus page (web plus.html):
  // deep navy gradient with an amber keyline and code text.
  promoNavy: '#1E3A5F',
  promoNavyDeep: '#0F2540',
  promoAmber: '#FACC15',
  // Sent chat-bubble timestamp (on the primary bubble) — warm tint of white.
  sentBubbleTime: '#FFE0CC',
  // Warm section wash (feed banners).
  warmTint: '#FFF8F5',
  // Strong success green (green-600) — Plus purchase confirmation.
  success600: '#16A34A',
} as const;

/** 4px base scale — index maps to DESIGN.md space-N (space-1 = 4). */
export const space = [0, 4, 8, 12, 16, 24, 32, 48, 64, 96] as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

export const fonts = {
  // Stitch Core: Plus Jakarta Sans for display/headings, Inter for body/UI text.
  display: 'PlusJakartaSans_600SemiBold',
  displayBold: 'PlusJakartaSans_700Bold',
  displayExtra: 'PlusJakartaSans_800ExtraBold',
  displayMedium: 'PlusJakartaSans_500Medium',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemibold: 'Inter_600SemiBold',
  bodyBold: 'Inter_700Bold',
  mono: Platform.select({ ios: 'Courier New', android: 'monospace', default: 'monospace' }) as string,
} as const;

/** Mobile type scale (canonical). */
export const fontSize = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 22,
  '2xl': 24,
  '3xl': 30,
  '4xl': 32,
} as const;

/** Soft cool shadows — iOS shadow props + Android elevation. */
type Elevation = { shadowColor: string; shadowOpacity: number; shadowRadius: number; shadowOffset: { width: number; height: number }; elevation: number };
const shadow = (opacity: number, radiusPx: number, y: number, elevation: number): Elevation => ({
  shadowColor: '#0F172A',
  shadowOpacity: opacity,
  shadowRadius: radiusPx,
  shadowOffset: { width: 0, height: y },
  elevation,
});
export const shadows = {
  xs: shadow(0.04, 2, 1, 1),
  sm: shadow(0.06, 6, 2, 2),
  md: shadow(0.08, 24, 8, 6),
  lg: shadow(0.1, 40, 16, 12),
  // Stitch Level-1 card: soft, diffused, warm-tinted ambient shadow.
  card: { shadowColor: '#FF6B35', shadowOpacity: 0.08, shadowRadius: 20, shadowOffset: { width: 0, height: 6 }, elevation: 3 } as Elevation,
} as const;

export const motion = {
  fast: 140,
  base: 220,
  // react-native Easing bezier args
  easing: [0.2, 0.7, 0.2, 1] as const,
} as const;

/** Badge variant color pairs (bg / fg [/ border]) — Stitch Core badge language. */
// Foregrounds darkened to clear WCAG AA (≥4.5:1) on their tints at 12px:
// plus/male/verified were ≈3.4–3.9:1 (orange-600/blue-600/green-600) → -700 shades.
export const badgeVariants = {
  success: { bg: '#D1FAE5', fg: '#047857' },
  plus: { bg: '#FEFCE8', fg: '#C2410C', border: '#FEF08A' }, // yellow-50 / orange-700 / yellow-200
  info: { bg: '#EEF2FF', fg: '#4F46E5' },
  warning: { bg: '#FEF3C7', fg: '#92400E' },
  danger: { bg: '#FEE2E2', fg: '#991B1B' },
  female: { bg: '#F3E8FF', fg: '#7C3AED' },
  male: { bg: '#DBEAFE', fg: '#1D4ED8' }, // blue-100 / blue-700
  verified: { bg: '#F0FDF4', fg: '#15803D', border: '#DCFCE7' }, // green-50 / green-700 / green-100
  // Roll-No verified on the mate card — web .hm-badge--verified-full (solid green-700).
  verifiedSolid: { bg: '#15803D', fg: '#FFFFFF', border: '#15803D' },
  neutral: { bg: '#F1F5F9', fg: '#475569' },
} as const;

export type BadgeVariant = keyof typeof badgeVariants;

/** Preset text roles (family + size + line-height). */
export const textVariants = {
  h1: { fontFamily: fonts.display, fontSize: fontSize['4xl'], lineHeight: 38, letterSpacing: -0.6, color: colors.text },
  h2: { fontFamily: fonts.display, fontSize: fontSize['2xl'], lineHeight: 30, letterSpacing: -0.4, color: colors.text },
  h3: { fontFamily: fonts.displayMedium, fontSize: fontSize.lg, lineHeight: 24, color: colors.text },
  body: { fontFamily: fonts.body, fontSize: fontSize.base, lineHeight: 25, color: colors.text },
  bodyMuted: { fontFamily: fonts.body, fontSize: fontSize.base, lineHeight: 25, color: colors.textMuted },
  small: { fontFamily: fonts.body, fontSize: fontSize.sm, lineHeight: 20, color: colors.textMuted },
  caption: { fontFamily: fonts.body, fontSize: fontSize.xs, lineHeight: 16, color: colors.textSubtle },
  button: { fontFamily: fonts.bodySemibold, fontSize: fontSize.sm, color: colors.white },
  eyebrow: { fontFamily: fonts.bodySemibold, fontSize: fontSize.xs, letterSpacing: 1.44, color: colors.primary, textTransform: 'uppercase' as const },
  link: { fontFamily: fonts.bodySemibold, fontSize: fontSize.base, color: colors.secondary },
} satisfies Record<string, TextStyle>;

export type TextVariant = keyof typeof textVariants;
