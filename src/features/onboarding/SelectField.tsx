import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, fonts } from '@/theme';
import { Text } from '@/components';
import type { SelectOption } from './options';

export type SelectFieldProps = {
  label?: string;
  placeholder?: string;
  value: string | null;
  options: SelectOption[];
  onChange: (value: string) => void;
  error?: string | null;
  disabled?: boolean;
  disabledHint?: string;
  accessibilityLabel?: string;
};

/**
 * Dependent-picker field for the onboarding cascades (Story 2.3). No native
 * Picker dependency — a themed field opens a modal option list. Mirrors the web
 * cascading <select> UX (state → district, exam → centre) using only foundation
 * tokens + Text.
 */
export function SelectField({
  label,
  placeholder = 'Select…',
  value,
  options,
  onChange,
  error,
  disabled,
  disabledHint,
  accessibilityLabel,
}: SelectFieldProps) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const selected = options.find((o) => o.value === value) ?? null;

  return (
    <View style={styles.wrap}>
      {label ? (
        <Text variant="small" style={styles.label}>
          {label}
        </Text>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={{ disabled: !!disabled, expanded: open }}
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.field,
          !!error && styles.errored,
          disabled && styles.disabled,
          pressed && !disabled && styles.pressed,
        ]}
      >
        <Text style={selected ? styles.valueText : styles.placeholderText} numberOfLines={1}>
          {disabled && disabledHint ? disabledHint : selected ? selected.label : placeholder}
        </Text>
        <Text style={styles.chevron} accessibilityElementsHidden importantForAccessibility="no">
          ▾
        </Text>
      </Pressable>

      {error ? (
        <Text variant="small" color={colors.danger} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)} accessibilityLabel="Close" />
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.grabber} />
          {label ? (
            <Text variant="h3" style={styles.sheetTitle}>
              {label}
            </Text>
          ) : null}
          <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
            {options.map((o) => {
              const isSel = o.value === value;
              return (
                <Pressable
                  key={o.value}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSel }}
                  onPress={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
                >
                  <Text style={isSel ? styles.optionTextSel : styles.optionText}>{o.label}</Text>
                  {isSel ? (
                    <Text style={styles.check} accessibilityLabel="selected">
                      ✓
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { color: colors.textMuted },
  field: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
  },
  errored: { borderColor: colors.danger },
  disabled: { backgroundColor: colors.surface2, opacity: 0.7 },
  pressed: { borderColor: colors.primary },
  valueText: { flex: 1, fontFamily: fonts.body, fontSize: 16, color: colors.text },
  placeholderText: { flex: 1, fontFamily: fonts.body, fontSize: 16, color: colors.textSubtle },
  chevron: { fontFamily: fonts.body, fontSize: 14, color: colors.textMuted, marginLeft: 8 },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.35)' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: 8,
    paddingHorizontal: 16,
    maxHeight: '70%',
  },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, marginBottom: 8 },
  sheetTitle: { marginBottom: 8 },
  list: { flexGrow: 0 },
  option: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  optionPressed: { backgroundColor: colors.surface2 },
  optionText: { fontFamily: fonts.body, fontSize: 16, color: colors.text },
  optionTextSel: { fontFamily: fonts.bodySemibold, fontSize: 16, color: colors.primary },
  check: { fontFamily: fonts.bodySemibold, fontSize: 16, color: colors.primary },
});
