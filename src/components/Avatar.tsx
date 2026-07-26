import { View, StyleSheet } from 'react-native';
import { colors, radius, fonts, avatarInitials } from '@/theme';
import { Text } from './Text';

export type AvatarProps = { name?: string | null; size?: number };

/** Initials avatar (no image pipeline exists in the product). */
export function Avatar({ name, size = 44 }: AvatarProps) {
  const initials = avatarInitials(name);
  return (
    <View style={[styles.a, { width: size, height: size, borderRadius: radius.full }]} accessibilityLabel={name ? `${name} avatar` : 'avatar'}>
      <Text style={{ fontFamily: fonts.bodyBold, color: colors.primary, fontSize: size * 0.36 }}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  a: { backgroundColor: colors.primary100, alignItems: 'center', justifyContent: 'center' },
});
