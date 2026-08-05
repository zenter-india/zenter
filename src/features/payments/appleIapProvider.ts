/**
 * Apple In-App Purchase checkout provider.
 *
 * App Store Review Guideline 3.1.1 requires StoreKit for in-app digital-goods
 * unlocks, which Zenter Plus is. This provider exists so that's a config
 * choice rather than a rewrite — see `./types.ts`. Built against
 * `react-native-iap@16` (Nitro/StoreKit-2 native) via `_iapCommon.ts`'s
 * shared plumbing — see that file's header for why the older, simpler-API
 * major line isn't used.
 *
 * The purchase token this library returns for iOS is a signed StoreKit 2 JWS
 * transaction, not a classic base64 receipt — server-side verification uses
 * Apple's App Store Server API (`GET /inApps/v1/transactions/{id}`), not the
 * legacy `verifyReceipt` endpoint, for exactly that reason.
 *
 * ─── NOT YET ACTIVE — two things are still required ──────────────────────────
 *  1. A Non-Consumable In-App Purchase product in App Store Connect whose id
 *     equals {@link APPLE_PRODUCT_ID}, "Ready to Submit," priced to match
 *     Zenter Plus. (Non-Consumable, not a subscription — Plus never expires,
 *     see `verify-razorpay-payment`'s grant: `premium_expiry_date: null`.)
 *  2. A `verify-apple-purchase` Supabase Edge Function that decodes the JWS,
 *     validates it against the App Store Server API, and flips
 *     `users.plus_member` — the exact counterpart of `verify-razorpay-payment`.
 *     Client-side verification alone is trivially spoofable and must not be
 *     relied on to grant entitlements.
 *
 * ─── Coupon limitation (deliberate, not an oversight) ────────────────────────
 * Same reasoning as `playBillingProvider.ts`: the App Store product's fixed
 * price has no runtime-discount equivalent, so a coupon is refused here
 * rather than silently charging full price.
 */
import { verifyApplePurchase } from '@/api/payment';
import { loadIapSdk, isCancellation, bridgePurchaseRequest } from './_iapCommon';
import type { CheckoutOutcome, CheckoutRequest, PaymentProvider, RestoreOutcome } from './types';

/**
 * App Store Connect product id for Zenter Plus. MUST match the Non-Consumable
 * product in App Store Connect exactly — a mismatch surfaces as an empty
 * product lookup.
 */
export const APPLE_PRODUCT_ID = 'zenter_plus';

const SDK_MISSING =
  'The App Store is not available in this build. Please update the app from the App Store.';

export const appleIapProvider: PaymentProvider = {
  id: 'apple_iap',
  label: 'Apple In-App Purchase',

  isAvailable() {
    return loadIapSdk() !== null;
  },

  async checkout({ userId, couponCode }: CheckoutRequest): Promise<CheckoutOutcome> {
    const iap = loadIapSdk();
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
      if (!connected) return { status: 'unavailable', message: SDK_MISSING };

      // The App Store refuses a purchase for an unknown/not-ready product;
      // check first so the failure is explainable instead of an opaque error.
      const products = await iap.fetchProducts({ skus: [APPLE_PRODUCT_ID], type: 'in-app' });
      if (!products?.some((p) => p.id === APPLE_PRODUCT_ID)) {
        return {
          status: 'unavailable',
          message: 'Zenter Plus is not available on this account right now.',
        };
      }

      const { purchase, error, timedOut } = await bridgePurchaseRequest(iap, APPLE_PRODUCT_ID, {
        request: { apple: { sku: APPLE_PRODUCT_ID } },
        type: 'in-app',
      });

      if (timedOut) return { status: 'cancelled' };
      if (error) {
        if (isCancellation(error)) return { status: 'cancelled' };
        return { status: 'failed', message: error.message || 'Payment failed. Please try again.' };
      }
      const jws = purchase?.purchaseToken;
      if (!purchase || !jws) {
        return { status: 'failed', message: 'Purchase did not complete. Please try again.' };
      }

      // Server verifies the JWS transaction with Apple's App Store Server API
      // and grants Plus. Only after that succeeds do we finish the
      // transaction — acknowledging first would risk the App Store
      // considering it settled while the entitlement never landed.
      const { error: verifyErr } = await verifyApplePurchase(purchase.productId, purchase.id, userId);
      if (verifyErr) {
        return { status: 'failed', message: 'Verification failed. Contact support@zenter.in' };
      }

      // Plus is a one-time unlock, so it is finished, not consumed.
      await iap.finishTransaction({ purchase, isConsumable: false }).catch(() => undefined);

      return { status: 'success', reference: purchase.id };
    } catch (err: unknown) {
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
   * verify-and-grant path as a fresh purchase; the only difference is the JWS
   * comes from `getAvailablePurchases()` instead of the purchase-updated event.
   */
  async restore(userId: string): Promise<RestoreOutcome> {
    const iap = loadIapSdk();
    if (!iap) return { status: 'unavailable', message: SDK_MISSING };

    let connected = false;
    try {
      connected = await iap.initConnection();
      if (!connected) return { status: 'unavailable', message: SDK_MISSING };

      const purchases = await iap.getAvailablePurchases();
      const purchase = purchases.find((p) => p.productId === APPLE_PRODUCT_ID);
      const jws = purchase?.purchaseToken;
      if (!purchase || !jws) {
        return { status: 'not_found' };
      }

      const { error } = await verifyApplePurchase(purchase.productId, purchase.id, userId);
      if (error) {
        return { status: 'failed', message: 'Verification failed. Contact support@zenter.in' };
      }

      await iap.finishTransaction({ purchase, isConsumable: false }).catch(() => undefined);
      return { status: 'success', reference: purchase.id };
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

  /**
   * Apple's own localized price for `zenter_plus`, straight from StoreKit's
   * product catalog — the single source of truth for what the Plus screen
   * displays on iOS. Never derived from `platform_config.plus_price_paise`
   * or the Razorpay price probe, which have no relationship to what App
   * Store Connect actually has configured for this product.
   */
  async getProductInfo(): Promise<{ displayPrice: string } | null> {
    const iap = loadIapSdk();
    if (!iap) return null;

    let connected = false;
    try {
      connected = await iap.initConnection();
      if (!connected) return null;

      const products = await iap.fetchProducts({ skus: [APPLE_PRODUCT_ID], type: 'in-app' });
      const product = products?.find((p) => p.id === APPLE_PRODUCT_ID);
      if (!product?.displayPrice) return null;

      return { displayPrice: product.displayPrice };
    } catch {
      return null;
    } finally {
      if (connected) {
        await iap.endConnection().catch(() => undefined);
      }
    }
  },
};
