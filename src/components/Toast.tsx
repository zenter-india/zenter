import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, fonts } from '@/theme';
import { haptics } from '@/lib/haptics';

export type ToastVariant = 'success' | 'danger' | 'warning' | 'info';
type Toast = { message: string; variant: ToastVariant };

const BG: Record<ToastVariant, string> = {
  success: '#065F46',
  danger: '#991B1B',
  warning: '#92400E',
  info: '#4338CA',
};
// Toasts are felt, not just seen — a calibrated notification haptic per variant.
const HAPTIC: Record<ToastVariant, () => void> = {
  success: haptics.success,
  danger: haptics.error,
  warning: haptics.warning,
  info: haptics.light,
};

type ToastApi = { show: (message: string, variant?: ToastVariant) => void };
const ToastContext = createContext<ToastApi>({ show: () => {} });

/** Global toast. `const { show } = useToast()` → show('Request sent!', 'success'). */
export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const insets = useSafeAreaInsets();
  const progress = useSharedValue(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    // eslint-disable-next-line react-hooks/immutability
    progress.value = withTiming(0, { duration: 200 }, (finished) => {
      if (finished) runOnJS(setToast)(null);
    });
  }, [progress]);

  const show = useCallback(
    (message: string, variant: ToastVariant = 'info') => {
      if (timer.current) clearTimeout(timer.current);
      HAPTIC[variant]();
      setToast({ message, variant });
      // eslint-disable-next-line react-hooks/immutability
      progress.value = withSpring(1, { mass: 0.6, damping: 15, stiffness: 190 });
      timer.current = setTimeout(hide, 3200);
    },
    [progress, hide],
  );

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { translateY: (1 - progress.value) * -18 },
      { scale: 0.95 + progress.value * 0.05 },
    ],
  }));

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {toast ? (
        <Animated.View
          pointerEvents="none"
          accessibilityLiveRegion={toast.variant === 'danger' ? 'assertive' : 'polite'}
          style={[styles.toast, { top: insets.top + 8, backgroundColor: BG[toast.variant] }, animatedStyle]}
        >
          <Text style={styles.text}>{toast.message}</Text>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: 16,
    right: 16,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 12,
    zIndex: 1000,
    shadowColor: '#0F172A',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  text: { color: colors.white, fontFamily: fonts.bodyMedium, fontSize: 14 },
});
