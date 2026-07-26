import { StyleSheet, View } from 'react-native';
import { colors, radius, fonts } from '@/theme';
import { Text } from '@/components';

export type WizardProgressProps = {
  step: number; // 1-based current step
  total: number;
};

/**
 * Step progress header for the onboarding wizard (Story 2.3) — ports the web
 * `.hm-steps__dot` row + "N / total" counter. Done/active/upcoming dots are
 * distinguished by fill AND width (never colour alone) for the a11y floor.
 */
export function WizardProgress({ step, total }: WizardProgressProps) {
  return (
    <View style={styles.wrap} accessibilityRole="progressbar" accessibilityLabel={`Step ${step} of ${total}`}>
      <View style={styles.dots}>
        {Array.from({ length: total }, (_, i) => {
          const n = i + 1;
          const state = n < step ? 'done' : n === step ? 'active' : 'upcoming';
          return <View key={n} style={[styles.dot, state === 'active' && styles.dotActive, state === 'done' && styles.dotDone]} />;
        })}
      </View>
      <Text variant="small" style={styles.counter}>
        {step} / {total}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  dot: { height: 6, width: 16, borderRadius: radius.full, backgroundColor: colors.border },
  dotActive: { width: 28, backgroundColor: colors.primary },
  dotDone: { backgroundColor: colors.primary100 },
  counter: { fontFamily: fonts.bodySemibold, color: colors.textMuted },
});
