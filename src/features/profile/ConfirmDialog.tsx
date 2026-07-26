/**
 * Centered confirmation interstitial (UX-DR3 / EXPERIENCE.md: "block / pause /
 * delete / age / safety → modal interstitials"). Used for the Pause confirm
 * (Story 6.3) and the danger Delete confirm (Story 6.3, FR-26). Destructive
 * confirms pass `danger` so the primary action renders on `colors.danger`
 * (white-on-danger ≈ 3.76:1, the documented accepted contrast for destructive
 * labels — never color alone, the word "Delete permanently" carries the meaning).
 */
import { Modal, View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, space } from '@/theme';
import { Text, Button } from '@/components';

export type ConfirmDialogProps = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  danger,
  busy,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { marginBottom: insets.bottom }]}>
          <Text variant="h3" color={danger ? colors.danger : undefined}>
            {title}
          </Text>
          <Text variant="bodyMuted">{message}</Text>
          <View style={styles.actions}>
            <Button
              title={cancelLabel}
              variant="ghost"
              size="sm"
              onPress={onCancel}
              disabled={busy}
              style={styles.btn}
            />
            <Button
              title={confirmLabel}
              size="sm"
              busy={busy}
              onPress={onConfirm}
              style={[styles.btn, danger ? styles.danger : null]}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'center',
    padding: space[5],
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: space[5],
    gap: space[3],
  },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: space[2], marginTop: space[2] },
  btn: { flex: 1 },
  danger: { backgroundColor: colors.danger },
});
