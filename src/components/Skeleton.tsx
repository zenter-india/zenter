import { useEffect, useState } from 'react';
import { Animated, AccessibilityInfo, StyleSheet, ViewStyle } from 'react-native';
import { colors, radius } from '@/theme';

export type SkeletonProps = { width?: number | `${number}%`; height?: number; style?: ViewStyle };

/** Shimmer placeholder. Respects Reduce Motion (static fill). */
export function Skeleton({ width = '100%', height = 16, style }: SkeletonProps) {
  const [opacity] = useState(() => new Animated.Value(0.5));

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (reduce || cancelled) return;
      Animated.loop(
        Animated.sequence([
          Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.5, duration: 700, useNativeDriver: true }),
        ]),
      ).start();
    });
    return () => { cancelled = true; };
  }, [opacity]);

  return <Animated.View style={[styles.base, { width, height, opacity }, style]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />;
}

const styles = StyleSheet.create({
  base: { backgroundColor: colors.surface2, borderRadius: radius.sm },
});
