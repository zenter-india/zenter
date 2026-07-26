import * as Haptics from 'expo-haptics';

/**
 * Haptic vocabulary for the whole app — the single biggest lever for a "premium"
 * touch feel. Every meaningful interaction gets a calibrated physical response.
 * All calls are fire-and-forget and swallow errors (haptics may be unavailable /
 * disabled at the OS level).
 *
 * Vocabulary:
 *  - selection : the subtle tick for taps on rows, cards, tabs, chips.
 *  - light     : standard button/control taps.
 *  - medium    : consequential actions (connect, send, accept, open sheet).
 *  - heavy     : rare, weighty confirmations.
 *  - success   : an action landed (connected, message sent, saved).
 *  - warning   : a gated/blocked action or a destructive confirm.
 *  - error     : a failure (network error, validation fail).
 */
export type HapticKind = 'selection' | 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';

const run = (fn: () => Promise<unknown>) => {
  try {
    fn().catch(() => {});
  } catch {
    /* no-op */
  }
};

export const haptics: Record<HapticKind, () => void> = {
  selection: () => run(() => Haptics.selectionAsync()),
  light: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  medium: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  heavy: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)),
  success: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  warning: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  error: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
};
