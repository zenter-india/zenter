/**
 * One-time Suspension Warning modal (Story 8.3, FR-31). Shown once over the app
 * after an admin restores a previously-suspended account with a warning
 * (`suspension_warning = true`). Copy ported verbatim from the web `checkSuspended`
 * "Appeal Reviewed" overlay (`js/utils.js`).
 *
 * Non-dismissable except via "I Understand" — acknowledging clears the flag
 * server-side (see {@link SuspensionGate}) so it never reappears. Android back is a
 * no-op here so the flag can only be cleared by an explicit tap.
 */
import { Modal, View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, space } from '@/theme';
import { Text, Button } from '@/components';

export type SuspensionWarningProps = {
  visible: boolean;
  busy?: boolean;
  onAcknowledge: () => void;
};

export function SuspensionWarning({ visible, busy, onAcknowledge }: SuspensionWarningProps) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => {}}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { marginBottom: insets.bottom }]}>
          <Text style={styles.icon} accessibilityLabel="warning">
            ⚠️
          </Text>
          <Text variant="h2" style={styles.centered}>
            Appeal Reviewed
          </Text>
          <Text variant="bodyMuted" style={styles.centered}>
            Dear Aspirant, Your matching function has been restored. Please regulate according to the
            guidelines and wish you a happy Zentering!
          </Text>
          <Button title="I Understand" block busy={busy} onPress={onAcknowledge} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.6)',
    justifyContent: 'center',
    padding: space[5],
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: space[5],
    gap: space[3],
  },
  icon: { fontSize: 40, textAlign: 'center' },
  centered: { textAlign: 'center' },
});
