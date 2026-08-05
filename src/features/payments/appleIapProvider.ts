/**
 * Apple In-App Purchase checkout provider.
 *
 * App Store Review Guideline 3.1.1 requires StoreKit for in-app digital-goods
 * unlocks, which Zenter Plus is. This provider exists so that's a config
 * choice rather than a rewrite — see `./types.ts`. Mirrors
 * `playBillingProvider.ts`'s structure closely; `react-native-iap` drives
 * both platforms through the same JS surface (pinned to `12.16.4` — the
 * newer major line is a StoreKit-2/event-based rewrite with a materially
 * different API, deliberately not used here to keep both providers on one
 * simple, promise-based pattern).
 *
 * ─── NOT YET ACTIVE — two things are still required ──────────────────────────
 *  1. A Non-Consumable In-App Purchase product in App Store Connect whose id
 *     equals {@link APPLE_PRODUCT_ID}, "Ready to Submit," priced to match
 *     Zenter Plus. (Non-Consumable, not a subscription — Plus never expires,
 *     see `verify-razorpay-payment`'s grant: `premium_expiry_date: null`.)
 *  2. A `verify-apple-purchase` Supabase Edge Function that validates the
 *     receipt against Apple's `verifyReceipt` endpoint (with the app's
 *     shared secret) and flips `users.plus_member` — the exact counterpart
 *     of `verify-razorpay-payment`. Client-side verification alone is
 *     trivially spoofable and must not be relied on to grant entitlements.
 *
 * ─── Coupon limitation (deliberate, not an oversight) ────────────────────────
 * Same reasoning as `playBillingProvider.ts`: the App Store product's fixed
 * price has no runtime-discount equivalent, so a coupon is refused here
 * rather than silently charging full price.
 */
import { verifyApplePurchase } from '@/api/payment';
import type { CheckoutOutcome, CheckoutRequest, PaymentProvider, RestoreOutcome } from './types';

/**
 * App Store Connect product id for Zenter Plus. MUST match the Non-Consumable
 * product in App Store Connect exactly — a mismatch surfaces as an empty
 * product lookup.
 */
export const APPLE_PRODUCT_ID = 'zenter_plus';

/** Minimal slice of the `react-native-iap` (12.x) surface this provider drives. */
type IapModule = {
  initConnection: () => Promise<boolean>;
  endConnection: () => Promise<boolean>;
  getProducts: (opts: { skus: string[] }) => Promise<{ productId: string }[]>;
  requestPurchase: (opts: { sku: string }) => Promise<ApplePurchase | ApplePurchase[] | void>;
  finishTransaction: (opts: { purchase: ApplePurchase; isConsumable: boolean }) => Promise<unknown>;
  getAvailablePurchases: () => Promise<ApplePurchase[]>;
};

type ApplePurchase = {
  productId: string;
  transactionId?: string;
  transactionReceipt: string;
};

const SDK_MISSING =
  'The App Store is not available in this build. Please update the app from the App Store.';

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

/** StoreKit surfaces a user-dismissed sheet as a thrown error, not a distinct result. */
function isCancellation(err: unknown): boolean {
  const code = (err as { code?: string })?.code ?? '';
  const message = (err as { message?: string })?.message ?? '';
  return code === 'E_USER_CANCELLED' || /cancel/i.test(code) || /cancel/i.test(message);
}

export const appleIapProvider: PaymentProvider = {
  id: 'apple_iap',
  label: 'Apple In-App Purchase',

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
        message: 'Coupons are not supported on the App Store yet. Remove the coupon to continue.',
      };
    }

    let connected = false;
    try {
      connected = await iap.initConnection();
      if (!connected) {
        return { status: 'unavailable', message: SDK_MISSING };
      }

      // The App Store refuses a purchase for an unknown/not-ready product;
      // check first so the failure is explainable instead of an opaque error.
      const products = await iap.getProducts({ skus: [APPLE_PRODUCT_ID] });
      if (!products.some((p) => p.productId === APPLE_PRODUCT_ID)) {
        return {
          status: 'unavailable',
          message: 'Zenter Plus is not available on this account right now.',
        };
      }

      const result = await iap.requestPurchase({ sku: APPLE_PRODUCT_ID });
      const purchase = Array.isArray(result) ? result[0] : result;
      const receipt = purchase?.transactionReceipt;
      if (!purchase || !receipt) {
        return { status: 'failed', message: 'Purchase did not complete. Please try again.' };
      }

      // Server verifies the receipt with Apple and grants Plus. Only after
      // that succeeds do we finish the transaction — acknowledging first
      // would risk the App Store considering it settled while the
      // entitlement never landed.
      const { error } = await verifyApplePurchase(purchase.productId, receipt, userId);
      if (error) {
        return { status: 'failed', message: 'Verification failed. Contact support@zenter.in' };
      }

      // Plus is a one-time unlock, so it is finished, not consumed.
      await iap.finishTransaction({ purchase, isConsumable: false });

      return { status: 'success', reference: purchase.transactionId ?? receipt.slice(0, 32) };
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

  /**
   * Re-grant Plus from App Store purchase history — required for App Review
   * (Guideline 3.1.1) and for real users after a reinstall/new device, since a
   * non-consumable is never re-charged. Runs the exact same server-side
   * verify-and-grant path as a fresh purchase; the only difference is the
   * receipt comes from `getAvailablePurchases()` instead of `requestPurchase()`.
   */
  async restore(userId: string): Promise<RestoreOutcome> {
    const iap = loadSdk();
    if (!iap) return { status: 'unavailable', message: SDK_MISSING };

    let connected = false;
    try {
      connected = await iap.initConnection();
      if (!connected) return { status: 'unavailable', message: SDK_MISSING };

      const purchases = await iap.getAvailablePurchases();
      const purchase = purchases.find((p) => p.productId === APPLE_PRODUCT_ID);
      if (!purchase?.transactionReceipt) {
        return { status: 'not_found' };
      }

      const { error } = await verifyApplePurchase(purchase.productId, purchase.transactionReceipt, userId);
      if (error) {
        return { status: 'failed', message: 'Verification failed. Contact support@zenter.in' };
      }

      await iap.finishTransaction({ purchase, isConsumable: false }).catch(() => undefined);
      return { status: 'success', reference: purchase.transactionId ?? purchase.transactionReceipt.slice(0, 32) };
    } catch (err: unknown) {
      return {
        status: 'failed',
        message: err instanceof Error ? err.message : 'Restore failed. Please try again.',
      };
    } finally {
      if (connected) {
        await iap.endConnection().catch(() => undefined);
      }
    }
  },
};
