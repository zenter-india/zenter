import { useEffect } from 'react';
import { StyleSheet, Image } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import { colors } from '@/theme';

/**
 * In-app boot splash shown while the gated boot resolves the session + profile
 * (Story 2.2) — brand-first so a returning member sees no auth flash (FR-4).
 * The native splash (same logo, same brand-orange background — see
 * app.config.js's expo-splash-screen config) hands off to this once fonts are
 * ready, and this continues the same frame rather than cutting to a distinct
 * "Zenter" wordmark screen: the logo itself zooms in, communicating "loading"
 * without a separate spinner.
 */
export function BootSplash() {
  const scale = useSharedValue(0.75);
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 280, easing: Easing.out(Easing.quad) });
    scale.value = withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) });
  }, [opacity, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={styles.wrap}>
      <Animated.View style={animatedStyle}>
        <Image
          source={require('../../../assets/logo-transparent.png')}
          style={styles.logo}
          resizeMode="contain"
          accessibilityLabel="Zenter"
        />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  logo: { width: 140, height: 140 },
});
