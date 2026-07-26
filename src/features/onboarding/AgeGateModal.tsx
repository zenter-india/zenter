import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, fonts } from '@/theme';
import { Text, Button } from '@/components';

export type AgeGateModalProps = {
  visible: boolean;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

/**
 * 18+ confirmation interstitial gating the final onboarding save (Story 2.3,
 * FR-7). Ports the web `#hm-age-modal`: a checkbox enables the confirm button;
 * confirming triggers the single profile upsert. Non-dismissable by accident —
 * cancel returns to the wizard's final step with no data persisted.
 */
export function AgeGateModal({ visible, busy, onCancel, onConfirm }: AgeGateModalProps) {
  const [checked, setChecked] = useState(false);
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { marginBottom: insets.bottom }]}>
          <Text variant="h2" style={styles.title}>
            Confirm your age
          </Text>
          <Text variant="bodyMuted" style={styles.body}>
            Zenter is for adult exam aspirants. Please confirm you are 18 years or older to create
            your profile.
          </Text>

          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked }}
            accessibilityLabel="I confirm I am 18 years or older"
            onPress={() => setChecked((c) => !c)}
            style={styles.checkRow}
          >
            <View style={[styles.box, checked && styles.boxChecked]}>
              {checked ? (
                <Text style={styles.boxTick} accessibilityElementsHidden importantForAccessibility="no">
                  ✓
                </Text>
              ) : null}
            </View>
            <Text style={styles.checkLabel}>I confirm I am 18 years or older.</Text>
          </Pressable>

          <View style={styles.actions}>
            <Button title="Cancel" variant="ghost" size="md" onPress={onCancel} disabled={busy} style={styles.action} />
            <Button
              title="Confirm & Save"
              size="md"
              onPress={onConfirm}
              disabled={!checked}
              busy={busy}
              style={styles.action}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: 24, gap: 14 },
  title: {},
  body: {},
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  box: {
    width: 24,
    height: 24,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  boxTick: { color: colors.white, fontFamily: fonts.bodyBold, fontSize: 14 },
  checkLabel: { flex: 1, fontFamily: fonts.body, fontSize: 15, color: colors.text },
  actions: { flexDirection: 'row', gap: 12, marginTop: 4 },
  action: { flex: 1 },
});
