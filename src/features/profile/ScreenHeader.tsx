/**
 * Reusable pushed-screen header for the Profile and Settings screens (Epic 6).
 * A back affordance + title, with an optional right-hand slot (the Profile
 * screen puts a Settings gear there). Mirrors the ChatHeader back glyph so
 * pushed screens feel consistent.
 */
import type { ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import { colors, space } from '@/theme';
import { Text, PressableScale, Icon } from '@/components';

export type ScreenHeaderProps = {
  title: string;
  onBack: () => void;
  rightSlot?: ReactNode;
};

export function ScreenHeader({ title, onBack, rightSlot }: ScreenHeaderProps) {
  return (
    <View style={styles.header}>
      <PressableScale
        onPress={onBack}
        haptic="selection"
        scaleTo={0.85}
        accessibilityRole="button"
        accessibilityLabel="Back"
        hitSlop={8}
        style={styles.back}
      >
        <Icon name="chevron-left" size={26} color={colors.text} />
      </PressableScale>

      <Text variant="h3" style={styles.title} numberOfLines={1}>
        {title}
      </Text>

      <View style={styles.right}>{rightSlot}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingHorizontal: space[3],
    paddingTop: space[2],
    paddingBottom: space[3],
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  back: { width: 34, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1 },
  right: { minWidth: 32, alignItems: 'flex-end', justifyContent: 'center' },
});
