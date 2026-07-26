/**
 * Payment-provider resolution.
 *
 * The active gateway is data, not code. Precedence:
 *   1. `platform_config.payment_provider` — remote, takes effect with no
 *      rebuild and no store review (see `parseConfig` in `src/data/useConfig.ts`)
 *   2. {@link DEFAULT_PAYMENT_PROVIDER} — the compiled-in fallback
 *
 * To move Zenter Plus onto Google Play Billing, set that config row to
 * `"play_billing"`. Read `playBillingProvider.ts` first: that path has
 * prerequisites (native module, Play Console product, verification Edge
 * Function) and reports `unavailable` until they are met.
 */
import { razorpayProvider } from './razorpayProvider';
import { playBillingProvider } from './playBillingProvider';
import type { PaymentProvider, PaymentProviderId } from './types';

export * from './types';
export { razorpayProvider } from './razorpayProvider';
export { playBillingProvider, PLAY_PRODUCT_ID } from './playBillingProvider';

/**
 * Gateway used when `platform_config` says nothing. Razorpay preserves the
 * behaviour shipped today; flipping this constant is the code-level equivalent
 * of the remote switch.
 */
export const DEFAULT_PAYMENT_PROVIDER: PaymentProviderId = 'razorpay';

const PROVIDERS: Record<PaymentProviderId, PaymentProvider> = {
  razorpay: razorpayProvider,
  play_billing: playBillingProvider,
};

/** Narrow an untrusted config value to a known provider id. */
export function toPaymentProviderId(value: unknown): PaymentProviderId | null {
  return value === 'razorpay' || value === 'play_billing' ? value : null;
}

/** Resolve the provider for an id, falling back to the compiled-in default. */
export function getPaymentProvider(id?: PaymentProviderId | null): PaymentProvider {
  return PROVIDERS[id ?? DEFAULT_PAYMENT_PROVIDER] ?? PROVIDERS[DEFAULT_PAYMENT_PROVIDER];
}
