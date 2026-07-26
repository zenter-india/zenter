/**
 * Chat thread header (Story 5.2). Back button, counterpart avatar + name, and a
 * right-hand action area. Epics 7 (Contact Exchange / Call) and 8 (Block) slot
 * their actions in via {@link ChatHeaderProps.rightSlot} — the header already
 * reserves the space so those epics don't have to touch this layout.
 */
import type { ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import { colors, space } from '@/theme';
import { Text, Avatar, PressableScale, Icon } from '@/components';

export type ChatHeaderProps = {
  name: string;
  subtitle?: string;
  onBack: () => void;
  /** Epic 7/8 action slot (Contact Exchange / Call · Block). */
  rightSlot?: ReactNode;
};

export function ChatHeader({ name, subtitle, onBack, rightSlot }: ChatHeaderProps) {
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

      <Avatar name={name} size={38} />
      <View style={styles.titleWrap}>
        <Text variant="h3" numberOfLines={1}>{name}</Text>
        {subtitle ? <Text variant="caption" numberOfLines={1}>{subtitle}</Text> : null}
      </View>

      {/* Epic 7 (Contact Exchange / Call) + Epic 8 (Block) render here. */}
      <View style={styles.actions}>{rightSlot}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingHorizontal: space[3],
    paddingTop: space[2],
    paddingBottom: space[3],
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  back: { width: 34, height: 44, alignItems: 'center', justifyContent: 'center' },
  titleWrap: { flex: 1 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
});
