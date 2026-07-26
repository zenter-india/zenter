import { ActivityIndicator, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { colors, radius, fonts } from '@/theme';
import { Text } from './Text';
import { Icon, IconName } from './Icon';
import { PressableScale, PressableScaleProps } from './PressableScale';
import type { HapticKind } from '@/lib/haptics';

type Variant = 'primary' | 'secondary' | 'ghost' | 'soft';
type Size = 'lg' | 'md' | 'sm' | 'xs';

export type ButtonProps = Omit<PressableScaleProps, 'children' | 'style'> & {
  title: string;
  variant?: Variant;
  size?: Size;
  block?: boolean;
  busy?: boolean;
  leading?: string; // emoji/glyph — carry an accessibilityLabel on the button
  icon?: IconName; // Feather line icon before the title (preferred over emoji)
  /** Extra container style, merged last (e.g. layout flex, a danger bg override). */
  style?: StyleProp<ViewStyle>;
};

const HEIGHT: Record<Size, number> = { lg: 52, md: 44, sm: 44, xs: 44 }; // sm/xs bump to 44 min hit area
const FONT: Record<Size, number> = { lg: 16, md: 14, sm: 14, xs: 13 };

const BG: Record<Variant, string> = {
  primary: colors.primary,
  secondary: colors.secondary,
  ghost: 'transparent',
  soft: colors.primary100,
};
const FG: Record<Variant, string> = {
  primary: colors.white,
  secondary: colors.white,
  ghost: colors.text,
  soft: colors.primary,
};
// The main CTAs get a weightier tap; ghost/soft get a lighter one.
const HAPTIC: Record<Variant, HapticKind> = { primary: 'medium', secondary: 'medium', ghost: 'light', soft: 'light' };

export function Button({ title, variant = 'primary', size = 'md', block, busy, leading, icon, disabled, haptic, style, accessibilityLabel, ...rest }: ButtonProps) {
  const isDisabled = disabled || busy;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: !!isDisabled, busy: !!busy }}
      disabled={isDisabled}
      haptic={isDisabled ? null : haptic ?? HAPTIC[variant]}
      scaleTo={0.97}
      style={[
        styles.base,
        // minHeight (not height) so a large system font size grows the button
        // instead of clipping the label.
        { minHeight: HEIGHT[size], backgroundColor: BG[variant], opacity: isDisabled ? 0.55 : 1 },
        variant === 'ghost' && styles.ghost,
        variant === 'primary' && styles.primaryShadow,
        block && styles.block,
        style,
      ]}
      {...rest}
    >
      {busy ? (
        <ActivityIndicator color={FG[variant]} />
      ) : (
        <View style={styles.row}>
          {icon ? <Icon name={icon} size={FONT[size] + 2} color={FG[variant]} /> : leading ? <Text style={{ color: FG[variant], fontSize: FONT[size] }}>{leading}</Text> : null}
          <Text numberOfLines={1} maxFontSizeMultiplier={1.3} style={{ fontFamily: fonts.bodySemibold, fontSize: FONT[size], color: FG[variant] }}>{title}</Text>
        </View>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 6 },
  ghost: { borderWidth: 1, borderColor: colors.border },
  // A soft branded lift so the primary CTA reads as elevated, not a flat rectangle.
  primaryShadow: { shadowColor: colors.primary, shadowOpacity: 0.28, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  block: { alignSelf: 'stretch' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
