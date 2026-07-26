/**
 * Message composer (Story 5.2). Controlled input owned by the thread screen so the
 * screen can restore the text on send failure (FR-17). Enforces the 2000-char cap
 * (the DB `messages.body` CHECK) via `maxLength`, and offers both a Send button
 * (the reliable path) and `onSubmitEditing`. The send affordance is disabled while
 * empty or while a send is in flight, so rapid taps can't double-send.
 */
import { TextInput, View, StyleSheet } from 'react-native';
import { colors, radius, space, fonts } from '@/theme';
import { PressableScale, Icon } from '@/components';
import { MESSAGE_MAX_LENGTH } from '@/api/chat';

export type ComposerProps = {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  busy?: boolean;
  disabled?: boolean;
};

export function Composer({ value, onChangeText, onSend, busy, disabled }: ComposerProps) {
  const canSend = value.trim().length > 0 && !busy && !disabled;
  return (
    <View style={styles.bar}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder="Type a message…"
        placeholderTextColor={colors.textSubtle}
        multiline
        maxLength={MESSAGE_MAX_LENGTH}
        editable={!disabled}
        returnKeyType="send"
        blurOnSubmit={false}
        onSubmitEditing={() => {
          if (canSend) onSend();
        }}
        accessibilityLabel="Message"
        style={styles.input}
      />
      <PressableScale
        onPress={onSend}
        disabled={!canSend}
        haptic="medium"
        scaleTo={0.88}
        accessibilityRole="button"
        accessibilityLabel="Send message"
        accessibilityState={{ disabled: !canSend }}
        style={[styles.send, { opacity: canSend ? 1 : 0.4 }]}
      >
        <Icon name="send" size={19} color={colors.white} />
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space[2],
    paddingHorizontal: space[3],
    paddingTop: space[2],
    paddingBottom: space[2],
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    paddingHorizontal: space[4],
    paddingTop: 11,
    paddingBottom: 11,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.text,
  },
  send: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
});
