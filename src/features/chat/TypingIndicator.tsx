/**
 * Typing indicator (FR-18, Story 5.3). Shown while the counterpart is actively
 * typing (driven by `useTyping().otherTyping`, which already auto-clears after 3s
 * of silence and on their send/empty). No presence, no last-seen.
 *
 * Three dots pulse in sequence; the animation is suppressed under Reduce Motion
 * (NFR-5), leaving a static, still-legible indicator. The looping animations are
 * torn down on unmount.
 */
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';
import { colors, radius, space, fonts } from '@/theme';
import { Text } from '@/components';

export function TypingIndicator({ name }: { name?: string | null }) {
  const label = name ? `${name} is typing` : 'Typing';
  const [dots] = useState(() => [new Animated.Value(0.3), new Animated.Value(0.3), new Animated.Value(0.3)]);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (alive) setReduceMotion(v);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => setReduceMotion(v));
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    const loops = dots.map((d, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 160),
          Animated.timing(d, { toValue: 1, duration: 320, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(d, { toValue: 0.3, duration: 320, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => {
      loops.forEach((l) => l.stop());
      dots.forEach((d) => d.setValue(0.3));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduceMotion]);

  return (
    <View style={styles.row} accessibilityRole="text" accessibilityLabel={`${label}…`}>
      <View style={styles.bubble}>
        <Text variant="caption" color={colors.textMuted} style={styles.label} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          typing
        </Text>
        <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {dots.map((d, i) => (
            <Animated.View key={i} style={[styles.dot, { opacity: reduceMotion ? 0.6 : d }]} />
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: space[3], paddingVertical: space[1], alignItems: 'flex-start' },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    borderBottomLeftRadius: 4,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
  },
  label: { fontFamily: fonts.bodyMedium },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  dot: { width: 5, height: 5, borderRadius: radius.full, backgroundColor: colors.textSubtle },
});
