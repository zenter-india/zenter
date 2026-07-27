import { View, StyleSheet } from 'react-native';
import { colors, radius, fonts, avatarInitials, avatarColor } from '@/theme';
import { Text } from './Text';

export type AvatarProps = { name?: string | null; size?: number };

/** Initials avatar (no image pipeline exists in the product). Background is a
 *  deterministic per-name color matching the website's avatar system. */
export function Avatar({ name, size = 44 }: AvatarProps) {
  const initials = avatarInitials(name);
  return (
    <View
      style={[styles.a, { width: size, height: size, borderRadius: radius.full, backgroundColor: avatarColor(name) }]}
      accessibilityLabel={name ? `${name} avatar` : 'avatar'}
    >
      <Text style={{ fontFamily: fonts.bodyBold, color: colors.white, fontSize: size * 0.36 }}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  a: { alignItems: 'center', justifyContent: 'center' },
});
