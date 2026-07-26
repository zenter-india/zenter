/**
 * Payment-provider seam (Zenter Plus).
 *
 * Why this exists: Google Play requires Play Billing for in-app digital goods,
 * while the live web app and the current mobile flow both use Razorpay. Rather
 * than commit to either, checkout is expressed as a provider interface so the
 * active gateway is a *configuration* choice, not a code rewrite.
 *
 * Swapping providers:
 *   - Remotely, with no rebuild: set the `payment_provider` key in the
 *     `platform_config` table to `'razorpay'` or `'play_billing'`.
 *   - In code: change `DEFAULT_PAYMENT_PROVIDER` in `./index.ts`.
 *
 * A provider owns the WHOLE checkout leg — order creation, native sheet, and
 * server-side verification — so `app/plus.tsx` never names a gateway.
 */

/** Gateways the app knows how to drive. */
export type PaymentProviderId = 'razorpay' | 'play_billing';

/** Everything a provider needs to take one payment. */
export type CheckoutRequest = {
  /** `users.id` of the buyer — the entitlement is granted against this. */
  userId: string;
  /** E.164 phone, used to prefill the gateway sheet. May be null. */
  phone: string | null;
  /**
   * Server-validated coupon code, or null.
   *
   * NOTE: only Razorpay honours this. Play Billing prices come from the Play
   * Console product and cannot be discounted at runtime — see the coupon note
   * in `playBillingProvider.ts` before enabling coupons on that path.
   */
  couponCode: string | null;
  /** Final, coupon-adjusted price in paise (server-computed). */
  amountPaise: number;
  /** Brand colour for gateways that theme their sheet. */
  themeColor: string;
};

/**
 * The result of a checkout attempt. Deliberately a closed union rather than
 * throw/catch so every caller has to handle the cancelled and unavailable
 * cases — a dismissed payment sheet is a normal outcome, not an error.
 */
export type CheckoutOutcome =
  /** Paid AND verified server-side. `reference` is the gateway's txn id. */
  | { status: 'success'; reference: string }
  /** User dismissed the sheet. Not an error — do not show a failure toast. */
  | { status: 'cancelled' }
  /** Provider can't run here (SDK missing, unsupported platform, no product). */
  | { status: 'unavailable'; message: string }
  /** Payment or verification genuinely failed. */
  | { status: 'failed'; message: string };

/** One payment gateway, driving a full checkout. Implementations never throw. */
export interface PaymentProvider {
  readonly id: PaymentProviderId;
  /** Human label for diagnostics/analytics — not shown as UI copy. */
  readonly label: string;
  /**
   * Whether this provider can run in the current binary. False when the native
   * SDK isn't linked, so the UI can fall back or explain instead of crashing.
   */
  isAvailable(): boolean;
  /** Take one payment end-to-end, including server-side verification. */
  checkout(req: CheckoutRequest): Promise<CheckoutOutcome>;
}
