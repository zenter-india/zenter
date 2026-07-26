/**
 * Block confirmation interstitial (Story 8.1, FR-27). A required-reason modal —
 * block-with-reason IS the report mechanism (there is no separate Report flow,
 * NFR-7). Ported from the web `#hm-block-modal` (`js/dashboard.js` openBlockModal /
 * wireBlockModal): the "Submit & Block" action stays disabled until the trimmed
 * reason reaches {@link MIN_BLOCK_REASON_LEN} characters, and it renders on
 * `colors.danger` (destructive — the word "Block" carries the meaning, never
 * colour alone, UX-DR5).
 *
 * Presentational only: the parent owns the target + the block mutation (see
 * {@link useBlockActions}), so one sheet is mounted per surface (chat / mate
 * profile / connections) rather than per row.
 */
import { useState } from 'react';
import { Modal, View, TextInput, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, space, fonts } from '@/theme';
import { Text, Button } from '@/components';
import { MIN_BLOCK_REASON_LEN } from '@/api/blocked';

export type BlockSheetProps = {
  visible: boolean;
  /** Counterpart name, for a personalised title. */
  name?: string;
  busy?: boolean;
  onCancel: () => void;
  onSubmit: (reason: string) => void;
};

export function BlockSheet({ visible, name, busy, onCancel, onSubmit }: BlockSheetProps) {
  const insets = useSafeAreaInsets();
  const [reason, setReason] = useState('');

  const [prevVisible, setPrevVisible] = useState(visible);
  if (visible !== prevVisible) {
    setPrevVisible(visible);
    if (visible) setReason('');
  }

  const trimmed = reason.trim();
  const valid = trimmed.length >= MIN_BLOCK_REASON_LEN;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { marginBottom: insets.bottom }]}>
          <Text variant="h3">{name ? `Block ${name}?` : 'Why are you blocking this user?'}</Text>
          <Text variant="bodyMuted">
            This helps us improve safety and prevent unwanted interactions.
          </Text>

          <TextInput
            value={reason}
            onChangeText={setReason}
            editable={!busy}
            multiline
            maxLength={500}
            autoFocus
            placeholder="e.g. Spam, fake profile, unwanted behavior, offensive messages…"
            placeholderTextColor={colors.textSubtle}
            style={styles.input}
            accessibilityLabel="Reason for blocking"
          />
          <Text variant="caption">{`Minimum ${MIN_BLOCK_REASON_LEN} characters.`}</Text>

          <View style={styles.actions}>
            <Button
              title="Cancel"
              variant="ghost"
              size="sm"
              onPress={onCancel}
              disabled={busy}
              style={styles.btn}
            />
            <Button
              title="Submit & Block"
              size="sm"
              busy={busy}
              disabled={!valid}
              onPress={() => onSubmit(trimmed)}
              style={[styles.btn, styles.danger]}
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
    gap: space[2],
  },
  input: {
    minHeight: 88,
    marginTop: space[2],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.text,
    textAlignVertical: 'top',
  },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: space[2], marginTop: space[2] },
  btn: { flex: 1 },
  danger: { backgroundColor: colors.danger },
});
