import { ReactNode } from 'react';
import { Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { haptics, HapticKind } from '@/lib/haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Snappy-but-soft press spring — the app-wide "feel" for every tappable surface. */
const PRESS_SPRING = { mass: 0.5, damping: 15, stiffness: 210 } as const;

export type PressableScaleProps = Omit<PressableProps, 'style' | 'children'> & {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** How far to scale down on press. Buttons ~0.96, big cards ~0.97. */
  scaleTo?: number;
  /** Opacity while pressed. */
  dimTo?: number;
  /** Haptic fired on a completed press (not on press-in). `null` to disable. */
  haptic?: HapticKind | null;
};

/**
 * The premium replacement for a raw `Pressable`. Native-thread (Reanimated) spring
 * scale + subtle dim on press, plus a calibrated haptic on release. Use this for
 * every tappable surface — buttons, cards, list rows, icon actions.
 */
export function PressableScale({
  children,
  style,
  scaleTo = 0.96,
  dimTo = 0.92,
  haptic = 'light',
  disabled,
  onPress,
  onPressIn,
  onPressOut,
  ...rest
}: PressableScaleProps) {
  const pressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(pressed.value ? scaleTo : 1, PRESS_SPRING) }],
    opacity: withTiming(pressed.value ? dimTo : 1, { duration: 110 }),
  }));

  return (
    <AnimatedPressable
      disabled={disabled}
      onPressIn={(e) => {
        pressed.value = 1;
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        pressed.value = 0;
        onPressOut?.(e);
      }}
      onPress={(e) => {
        if (disabled) return;
        if (haptic) haptics[haptic]();
        onPress?.(e);
      }}
      style={[animatedStyle, style]}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
}
