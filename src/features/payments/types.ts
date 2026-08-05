/**
 * Payment-provider seam (Zenter Plus).
 *
 * Why this exists: Apple requires StoreKit and Google requires Play Billing
 * for in-app digital-content unlocks (which Zenter Plus is), while the web
 * app has no such restriction and stays on Razorpay. Rather than hand-roll a
 * platform branch at every call site, checkout is expressed as a provider
 * interface so the active gateway is resolved once, by platform.
 *
 * Resolution (`getPaymentProvider` in `./index.ts`): defaults to
 * `apple_iap` on iOS, `play_billing` on Android, `razorpay` on web — with
 * `platform_config.payment_provider` (remote, no rebuild) able to override
 * that default per-deployment, e.g. as an emergency kill-switch back to
 * Razorpay if IAP/Billing verification breaks post-launch.
 *
 * A provider owns the WHOLE checkout leg — order/product lookup, native
 * sheet, and server-side verification — so `app/plus.tsx` never names a
 * gateway.
 */

/** Gateways the app knows how to drive. */
export type PaymentProviderId = 'razorpay' | 'play_billing' | 'apple_iap';

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

/**
 * The result of a restore attempt. A separate union from {@link CheckoutOutcome}
 * because "nothing to restore" is a normal, expected outcome here (unlike a
 * fresh checkout, where an unmatched purchase would be a genuine error) — not
 * something callers should route through the same 'failed' branch as a real
 * verification failure.
 */
export type RestoreOutcome =
  /** A prior purchase was found and re-verified. `reference` is the gateway's txn id. */
  | { status: 'success'; reference: string }
  /** The store has no prior Zenter Plus purchase for this account. Not an error. */
  | { status: 'not_found' }
  /** Provider can't run here (SDK missing, unsupported platform). */
  | { status: 'unavailable'; message: string }
  /** A prior purchase was found but re-verification genuinely failed. */
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
  /**
   * Re-grant Plus from a prior store purchase without charging again — required
   * by Apple (Guideline 3.1.1) for non-consumables, e.g. after a reinstall or
   * a new device. Omitted on providers with no store-side purchase history to
   * restore from (Razorpay isn't a store — there's nothing to query).
   */
  restore?(userId: string): Promise<RestoreOutcome>;
}
