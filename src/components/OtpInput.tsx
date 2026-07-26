import { useRef, useState } from 'react';
import { NativeSyntheticEvent, StyleSheet, TextInput, TextInputKeyPressEventData, View } from 'react-native';
import { colors, radius, fonts } from '@/theme';

export type OtpInputProps = {
  length?: number;
  value: string;
  onChange: (code: string) => void;
  onComplete?: (code: string) => void;
  autoFocus?: boolean;
};

/** Six boxed OTP cells (the auth signature). Paste-distributes; auto-submits on full code. */
export function OtpInput({ length = 6, value, onChange, onComplete, autoFocus }: OtpInputProps) {
  const refs = useRef<(TextInput | null)[]>([]);
  const [focusIdx, setFocusIdx] = useState(0);
  const chars = value.padEnd(length, ' ').slice(0, length).split('');

  function setAt(i: number, text: string) {
    const digits = text.replace(/\D/g, '');
    if (digits.length > 1) {
      // paste-distribute
      const next = (value.slice(0, i) + digits).replace(/\D/g, '').slice(0, length);
      onChange(next);
      const focus = Math.min(next.length, length - 1);
      refs.current[focus]?.focus();
      if (next.length === length) onComplete?.(next);
      return;
    }
    const arr = value.padEnd(length, ' ').split('');
    arr[i] = digits || ' ';
    const next = arr.join('').replace(/\s+$/, '');
    onChange(next);
    if (digits && i < length - 1) refs.current[i + 1]?.focus();
    if (next.replace(/\s/g, '').length === length) onComplete?.(next);
  }

  function onKey(i: number, e: NativeSyntheticEvent<TextInputKeyPressEventData>) {
    if (e.nativeEvent.key === 'Backspace' && !chars[i]?.trim() && i > 0) refs.current[i - 1]?.focus();
  }

  return (
    <View style={styles.row} accessibilityLabel={`Verification code, ${length} digits`}>
      {chars.map((c, i) => (
        <TextInput
          key={i}
          ref={(r) => { refs.current[i] = r; }}
          value={c.trim()}
          onChangeText={(t) => setAt(i, t)}
          onKeyPress={(e) => onKey(i, e)}
          onFocus={() => setFocusIdx(i)}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="sms-otp"
          maxLength={i === 0 ? length : 1}
          autoFocus={autoFocus && i === 0}
          accessibilityLabel={`Digit ${i + 1} of ${length}`}
          style={[styles.cell, focusIdx === i && styles.cellFocused]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  cell: { width: 48, height: 56, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, textAlign: 'center', fontFamily: fonts.bodySemibold, fontSize: 22, color: colors.text },
  cellFocused: { borderColor: colors.primary },
});
