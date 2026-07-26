import { View, StyleSheet } from 'react-native';
import { badgeVariants, BadgeVariant, radius, fonts } from '@/theme';
import { Text } from './Text';

export type BadgeProps = { label: string; variant?: BadgeVariant };

export function Badge({ label, variant = 'neutral' }: BadgeProps) {
  const v = badgeVariants[variant];
  return (
    <View style={[styles.badge, { backgroundColor: v.bg }, 'border' in v && v.border ? { borderWidth: 1, borderColor: v.border } : null]}>
      {/* Cap scaling so the pill grows gracefully (minHeight) instead of clipping. */}
      <Text style={[styles.text, { color: v.fg }]} maxFontSizeMultiplier={1.3}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { minHeight: 24, paddingVertical: 2, borderRadius: radius.full, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' },
  text: { fontFamily: fonts.bodySemibold, fontSize: 12 },
});
