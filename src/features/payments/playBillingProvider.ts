/**
 * Google Play Billing checkout provider.
 *
 * Play's Payments policy requires Play Billing for in-app digital goods, which
 * Zenter Plus is. This provider exists so that switch is a config change rather
 * than a rewrite — see `./types.ts`.
 *
 * ─── NOT YET ACTIVE — three things are still required ────────────────────────
 *  1. `npx expo install react-native-iap`, then rebuild (it is a native module,
 *     so a JS-only OTA update cannot introduce it). Until then `isAvailable()`
 *     returns false and checkout reports `unavailable` rather than crashing.
 *  2. A managed in-app product in Play Console whose id equals
 *     {@link PLAY_PRODUCT_ID}, active, and priced to match the Plus price.
 *  3. A `verify-play-purchase` Supabase Edge Function that validates the
 *     purchase token against the Google Play Developer API and flips
 *     `users.plus_member` — the exact counterpart of `verify-razorpay-payment`.
 *     Client-side verification alone is trivially spoofable and must not be
 *     relied on to grant entitlements.
 *
 * ─── Coupon limitation (deliberate, not an oversight) ────────────────────────
 * Razorpay takes a server-computed amount, so Zenter's coupon engine can
 * discount any percentage at runtime. Play Billing charges the *product's*
 * Play Console price and has no runtime-amount equivalent. Discounts there must
 * be modelled as either separate SKUs per price point or Play promo codes.
 * Until that is decided, a coupon is refused on this path rather than silently
 * charging the buyer full price.
 */
import { verifyPlayPurchase } from '@/api/payment';
import type { CheckoutOutcome, CheckoutRequest, PaymentProvider } from './types';

/**
 * Play Console product id for Zenter Plus. MUST match the managed product in
 * Play Console exactly — a mismatch surfaces as an empty product lookup.
 */
export const PLAY_PRODUCT_ID = 'zenter_plus';

/** Minimal slice of the `react-native-iap` surface this provider drives. */
type IapModule = {
  initConnection: () => Promise<boolean>;
  endConnection: () => Promise<void>;
  getProducts: (opts: { skus: string[] }) => Promise<{ productId: string }[]>;
  requestPurchase: (opts: { skus: string[] }) => Promise<PlayPurchase | PlayPurchase[]>;
  finishTransaction: (opts: { purchase: PlayPurchase; isConsumable: boolean }) => Promise<unknown>;
};

type PlayPurchase = {
  productId: string;
  purchaseToken?: string;
  transactionId?: string;
};

const SDK_MISSING =
  'Google Play Billing is not available in this build. Please update the app from the Play Store.';

/** The IAP native module, or null when it isn't linked into this binary. */
function loadSdk(): IapModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const iap = require('react-native-iap');
    return (iap?.default ?? iap ?? null) as IapModule | null;
  } catch {
    return null;
  }
}

/** Play surfaces user-dismissed flows as an error code, not a distinct result. */
function isCancellation(err: unknown): boolean {
  const code = (err as { code?: string })?.code ?? '';
  const message = (err as { message?: string })?.message ?? '';
  return (
    code === 'E_USER_CANCELLED' ||
    /cancel/i.test(code) ||
    /cancel/i.test(message)
  );
}

export const playBillingProvider: PaymentProvider = {
  id: 'play_billing',
  label: 'Google Play Billing',

  isAvailable() {
    return loadSdk() !== null;
  },

  async checkout({ userId, couponCode }: CheckoutRequest): Promise<CheckoutOutcome> {
    const iap = loadSdk();
    if (!iap) return { status: 'unavailable', message: SDK_MISSING };

    // See the coupon note in the module header: refuse rather than overcharge.
    if (couponCode) {
      return {
        status: 'unavailable',
        message:
          'Coupons are not supported on Google Play checkout yet. Remove the coupon to continue.',
      };
    }

    let connected = false;
    try {
      connected = await iap.initConnection();
      if (!connected) {
        return { status: 'unavailable', message: SDK_MISSING };
      }

      // Play refuses a purchase for an unknown/inactive product; check first so
      // the failure is explainable instead of an opaque billing error.
      const products = await iap.getProducts({ skus: [PLAY_PRODUCT_ID] });
      if (!products.some((p) => p.productId === PLAY_PRODUCT_ID)) {
        return {
          status: 'unavailable',
          message: 'Zenter Plus is not available on this account right now.',
        };
      }

      const result = await iap.requestPurchase({ skus: [PLAY_PRODUCT_ID] });
      const purchase = Array.isArray(result) ? result[0] : result;
      const token = purchase?.purchaseToken;
      if (!purchase || !token) {
        return { status: 'failed', message: 'Purchase did not complete. Please try again.' };
      }

      // Server verifies the token with Google and grants Plus. Only after that
      // succeeds do we finish the transaction — acknowledging first would risk
      // Play considering it settled while the entitlement never landed.
      const { error } = await verifyPlayPurchase(purchase.productId, token, userId);
      if (error) {
        return { status: 'failed', message: 'Verification failed. Contact support@zenter.in' };
      }

      // Plus is a one-time unlock, so it is acknowledged, not consumed.
      await iap.finishTransaction({ purchase, isConsumable: false });

      return { status: 'success', reference: purchase.transactionId ?? token };
    } catch (err: unknown) {
      if (isCancellation(err)) return { status: 'cancelled' };
      return {
        status: 'failed',
        message: err instanceof Error ? err.message : 'Payment failed. Please try again.',
      };
    } finally {
      if (connected) {
        // Never let teardown mask the real outcome above.
        await iap.endConnection().catch(() => undefined);
      }
    }
  },
};
