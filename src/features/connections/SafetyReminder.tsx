/**
 * Safety Reminder interstitial (FR-29, Story 4.2). Shown after a member ACCEPTS a
 * connection request: a required one-tap "I Agree" acknowledgement, ported
 * verbatim from the web `#hm-safety-dialog` (`js/dashboard.js` → `showSafetyConsent`).
 * Web shows it on every accept, so this does too.
 *
 * Because an accept can fire from several surfaces (Requests tab, a feed card, or
 * the mate sheet), the modal is driven by a tiny external store (same pattern as
 * `stores/navBadges`) and rendered ONCE by {@link SafetyReminderHost} mounted at
 * the app root — so whichever surface triggered the accept, exactly one modal
 * appears above everything. Acknowledging it lands the member in Chats (AC 4.2).
 */
import { useSyncExternalStore } from 'react';
import { Modal, View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, space } from '@/theme';
import { Text, Button } from '@/components';
import { goToChats } from './nav';

// ─── Store ───────────────────────────────────────────────────────────────────

let opened = false;
const listeners = new Set<() => void>();
const emit = () => { for (const l of listeners) l(); };

export const safetyReminder = {
  /** Show the reminder (no-op if already open). */
  show() { if (!opened) { opened = true; emit(); } },
  /** Dismiss the reminder. */
  hide() { if (opened) { opened = false; emit(); } },
  isOpen: () => opened,
  subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; },
};

function useSafetyOpen(): boolean {
  return useSyncExternalStore(safetyReminder.subscribe, safetyReminder.isOpen, safetyReminder.isOpen);
}

// ─── Presentational modal ──────────────────────────────────────────────────────

export type SafetyReminderProps = { visible: boolean; onAgree: () => void };

export function SafetyReminder({ visible, onAgree }: SafetyReminderProps) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onAgree}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { marginBottom: insets.bottom }]}>
          <Text style={styles.icon} accessibilityElementsHidden importantForAccessibility="no">
            🛡️
          </Text>
          <Text variant="h2" style={styles.centered}>
            Safety Reminder
          </Text>
          <Text variant="bodyMuted" style={styles.centered}>
            In view of individual safety concerns, before travelling or staying together with a
            random person, kindly verify the other mate with their Hall ticket and ID proof.
            {'\n\n'}All the very best for your exam 💐 ! You have got this !
          </Text>
          <Button title="I Agree" block onPress={onAgree} />
        </View>
      </View>
    </Modal>
  );
}

// ─── Root host (mounted once in app/_layout.tsx) ───────────────────────────────

export function SafetyReminderHost() {
  const visible = useSafetyOpen();
  return (
    <SafetyReminder
      visible={visible}
      onAgree={() => {
        safetyReminder.hide();
        goToChats();
      }}
    />
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
  icon: { fontSize: 32, textAlign: 'center' },
  centered: { textAlign: 'center' },
});
