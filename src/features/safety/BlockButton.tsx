/**
 * Reusable "Block" trigger (Story 8.1). Two shapes for the surfaces that expose a
 * block entry:
 *   - default → a ghost pill (slash icon + "Block") for the mate profile.
 *   - `compact` → an icon-only affordance for tight slots (chat header,
 *     connections row) so the primary actions get room.
 *
 * Triggers the {@link BlockSheet}; the mutation lives in {@link useBlockActions}.
 */
import { StyleSheet, View } from 'react-native';
import { colors, radius, space, fonts } from '@/theme';
import { Text, PressableScale, Icon } from '@/components';

export type BlockButtonProps = {
  onPress: () => void;
  disabled?: boolean;
  /** Icon-only variant for tight header/row slots. */
  compact?: boolean;
};

export function BlockButton({ onPress, disabled, compact }: BlockButtonProps) {
  if (compact) {
    return (
      <PressableScale
        onPress={onPress}
        disabled={disabled}
        haptic="light"
        scaleTo={0.85}
        accessibilityRole="button"
        accessibilityLabel="Block aspirant"
        hitSlop={8}
        style={[styles.icon, disabled && styles.disabled]}
      >
        <Icon name="slash" size={19} color={colors.danger} />
      </PressableScale>
    );
  }
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      haptic="light"
      scaleTo={0.97}
      accessibilityRole="button"
      accessibilityLabel="Block aspirant"
      style={[styles.pill, disabled && styles.disabled]}
    >
      <View style={styles.row}>
        <Icon name="slash" size={16} color={colors.danger} />
        <Text style={styles.pillLabel}>Block</Text>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  // Same outlined shell as a ghost Button (44 min hit area, radius.md, hairline
  // border) so the icon-only form reads as a control beside the filled actions
  // in a Connections row instead of a loose glyph.
  icon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.4 },
  pill: {
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  pillLabel: { fontFamily: fonts.bodySemibold, fontSize: 14, color: colors.text },
});
