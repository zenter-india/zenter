import { Dimensions, Platform } from 'react-native';
import Constants from 'expo-constants';

/**
 * Best-effort native device fingerprint for multi-account detection (FR-8),
 * mirroring the web `getDeviceFingerprint()` in `js/onboarding.js`: join a few
 * stable device signals and fold them with the same 31-multiplier `Math.imul`
 * hash into a base-36 string. Web inputs (userAgent, screen, etc.) are re-sourced
 * from RN equivalents. This is a heuristic only; capture failure returns null and
 * MUST NOT block the save.
 */
export function getDeviceFingerprint(): string | null {
  try {
    const screen = Dimensions.get('screen');
    const parts = [
      Platform.OS,
      String(Platform.Version ?? ''),
      `${Math.round(screen.width)}x${Math.round(screen.height)}`,
      String(screen.scale ?? ''),
      String(screen.fontScale ?? ''),
      (Constants as { deviceName?: string }).deviceName ?? '',
      timezone(),
    ].join('|');

    let h = 0;
    for (let i = 0; i < parts.length; i++) {
      h = (Math.imul(31, h) + parts.charCodeAt(i)) | 0;
    }
    return Math.abs(h).toString(36);
  } catch {
    return null;
  }
}

function timezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? '';
  } catch {
    return '';
  }
}
