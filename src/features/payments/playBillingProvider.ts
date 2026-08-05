/**
 * Google Play Billing checkout provider.
 *
 * Play's Payments policy requires Play Billing for in-app digital goods, which
 * Zenter Plus is. This provider exists so that switch is a config change rather
 * than a rewrite — see `./types.ts`. Built against `react-native-iap@16`
 * (Nitro-modules native) via `_iapCommon.ts`'s shared plumbing — see that
 * file's header for why the older, simpler-API major line isn't used.
 *
 * ─── NOT YET ACTIVE — two things are still required ──────────────────────────
 *  1. A managed in-app product in Play Console whose id equals
 *     {@link PLAY_PRODUCT_ID}, active, and priced to match the Plus price.
 *  2. A `verify-play-purchase` Supabase Edge Function that validates the
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
import { loadIapSdk, isCancellation, bridgePurchaseRequest } from './_iapCommon';
import type { CheckoutOutcome, CheckoutRequest, PaymentProvider, RestoreOutcome } from './types';

/**
 * Play Console product id for Zenter Plus. MUST match the managed product in
 * Play Console exactly — a mismatch surfaces as an empty product lookup.
 */
export const PLAY_PRODUCT_ID = 'zenter_plus';

const SDK_MISSING =
  'Google Play Billing is not available in this build. Please update the app from the Play Store.';

export const playBillingProvider: PaymentProvider = {
  id: 'play_billing',
  label: 'Google Play Billing',

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
        message: 'Coupons are not supported on Google Play checkout yet. Remove the coupon to continue.',
      };
    }

    let connected = false;
    try {
      connected = await iap.initConnection();
      if (!connected) return { status: 'unavailable', message: SDK_MISSING };

      // Play refuses a purchase for an unknown/inactive product; check first so
      // the failure is explainable instead of an opaque billing error.
      const products = await iap.fetchProducts({ skus: [PLAY_PRODUCT_ID], type: 'in-app' });
      if (!products?.some((p) => p.id === PLAY_PRODUCT_ID)) {
        return {
          status: 'unavailable',
          message: 'Zenter Plus is not available on this account right now.',
        };
      }

      const { purchase, error, timedOut } = await bridgePurchaseRequest(iap, PLAY_PRODUCT_ID, {
        request: { google: { skus: [PLAY_PRODUCT_ID] } },
        type: 'in-app',
      });

      if (timedOut) return { status: 'cancelled' };
      if (error) {
        if (isCancellation(error)) return { status: 'cancelled' };
        return { status: 'failed', message: error.message || 'Payment failed. Please try again.' };
      }
      const token = purchase?.purchaseToken;
      if (!purchase || !token) {
        return { status: 'failed', message: 'Purchase did not complete. Please try again.' };
      }

      // Server verifies the token with Google and grants Plus. Only after that
      // succeeds do we finish the transaction — acknowledging first would risk
      // Play considering it settled while the entitlement never landed.
      const { error: verifyErr } = await verifyPlayPurchase(purchase.productId, token, userId);
      if (verifyErr) {
        return { status: 'failed', message: 'Verification failed. Contact support@zenter.in' };
      }

      // Plus is a one-time unlock, so it is acknowledged, not consumed.
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
   * Re-grant Plus from Play purchase history — same rationale as
   * `appleIapProvider.ts`'s `restore`: a non-consumable is never re-charged,
   * so a reinstall/new device needs this instead of a fresh purchase.
   */
  async restore(userId: string): Promise<RestoreOutcome> {
    const iap = loadIapSdk();
    if (!iap) return { status: 'unavailable', message: SDK_MISSING };

    let connected = false;
    try {
      connected = await iap.initConnection();
      if (!connected) return { status: 'unavailable', message: SDK_MISSING };

      const purchases = await iap.getAvailablePurchases();
      const purchase = purchases.find((p) => p.productId === PLAY_PRODUCT_ID);
      const token = purchase?.purchaseToken;
      if (!purchase || !token) {
        return { status: 'not_found' };
      }

      const { error } = await verifyPlayPurchase(purchase.productId, token, userId);
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
};
