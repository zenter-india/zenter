/**
 * Payment-provider resolution.
 *
 * The active gateway is platform-derived, not a single global default.
 * Precedence:
 *   1. `platform_config.payment_provider` — remote override, takes effect
 *      with no rebuild and no store review (see `parseConfig` in
 *      `src/data/useConfig.ts`). Intended as an emergency kill-switch (e.g.
 *      back to Razorpay if IAP/Billing verification breaks post-launch), not
 *      the normal path.
 *   2. {@link defaultProviderForPlatform} — `apple_iap` on iOS, `play_billing`
 *      on Android, `razorpay` on web (react-native-web) or any other platform.
 *      Apple and Google both require their own in-app-purchase mechanism for
 *      digital-content unlocks like Zenter Plus; that rule doesn't apply to
 *      the web app, which stays on Razorpay.
 *
 * Read `appleIapProvider.ts` / `playBillingProvider.ts` before assuming either
 * is live in a given build — each reports `unavailable` until its
 * prerequisites (native module, store-side product, verification Edge
 * Function) are met, rather than crashing.
 */
import { Platform } from 'react-native';
import { razorpayProvider } from './razorpayProvider';
import { playBillingProvider } from './playBillingProvider';
import { appleIapProvider } from './appleIapProvider';
import type { PaymentProvider, PaymentProviderId } from './types';

export * from './types';
export { razorpayProvider } from './razorpayProvider';
export { playBillingProvider, PLAY_PRODUCT_ID } from './playBillingProvider';
export { appleIapProvider, APPLE_PRODUCT_ID } from './appleIapProvider';

const PROVIDERS: Record<PaymentProviderId, PaymentProvider> = {
  razorpay: razorpayProvider,
  play_billing: playBillingProvider,
  apple_iap: appleIapProvider,
};

/** The gateway each platform is expected to use, absent a remote override. */
function defaultProviderForPlatform(): PaymentProviderId {
  if (Platform.OS === 'ios') return 'apple_iap';
  if (Platform.OS === 'android') return 'play_billing';
  return 'razorpay';
}

/** Narrow an untrusted config value to a known provider id. */
export function toPaymentProviderId(value: unknown): PaymentProviderId | null {
  return value === 'razorpay' || value === 'play_billing' || value === 'apple_iap' ? value : null;
}

/** Resolve the provider for an id, falling back to this platform's default gateway. */
export function getPaymentProvider(id?: PaymentProviderId | null): PaymentProvider {
  const fallback = defaultProviderForPlatform();
  return PROVIDERS[id ?? fallback] ?? PROVIDERS[fallback];
}
