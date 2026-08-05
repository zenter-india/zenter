/**
 * Razorpay payment data-access layer (AD-1). Direct ports of the three payment
 * functions in `js/supabase.js`: order creation, payment verification, and
 * free-Plus claiming. All three hit the Supabase Edge Functions (or a direct
 * table update for the free claim) using the same anon key that the rest of
 * the app uses.
 *
 * These functions follow the project convention: they NEVER throw. They return
 * a result envelope; the throwing happens one layer up in the TanStack hooks.
 * The one exception is the Edge Function calls which return raw responses —
 * these are modelled as `{ data, error }` locally to stay consistent.
 *
 * Retry with exponential backoff on `createRazorpayOrder` is ported verbatim
 * from web `js/supabase.js` to handle Edge Function cold-start failures.
 */
import { supabase } from './client';
import { env } from '@/lib/env';

const EDGE_BASE = `${env.supabaseUrl}/functions/v1`;

// ─── Types ────────────────────────────────────────────────────────────────────

/** Response from the `create-razorpay-order` Edge Function (dry_run or real). */
export type OrderResponse = {
  /** Present only on a real (non-dry_run) call. */
  order_id?: string;
  /** Razorpay publishable key id (returned by the server). */
  key_id?: string;
  /** Amount in paise. */
  amount?: number;
  currency?: string;
  /** Original price before coupon, in paise. */
  original_paise: number;
  /** Final price after coupon, in paise. */
  final_paise: number;
  /** Whether a coupon was actually applied. */
  coupon_applied?: boolean;
  /** Human-readable coupon label (e.g. "ZENTERNEW — ₹40 off"). */
  coupon_label?: string;
};

/** Response from the `verify-razorpay-payment` Edge Function. */
export type VerifyResponse = {
  success: boolean;
  message?: string;
};

/** Standard error shape used across the api layer. */
export type PaymentError = { code: string; message: string };
export type PaymentResult<T> = { data: T | null; error: PaymentError | null };

// ─── createRazorpayOrder ──────────────────────────────────────────────────────

/**
 * Create a Razorpay order server-side. Pass `couponCode` to apply a discount
 * server-side. `dryRun = true` validates the coupon and returns pricing without
 * creating a real order.
 *
 * Retries up to 2 times on failure (Edge Function cold start can cause
 * intermittent errors). Ported verbatim from web `js/supabase.js`.
 */
export async function createRazorpayOrder(
  userId: string,
  couponCode: string | null = null,
  dryRun = false,
): Promise<PaymentResult<OrderResponse>> {
  const MAX_RETRIES = 2;
  let lastError: PaymentError | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, 1000 * attempt)); // backoff
      }

      const resp = await fetch(`${EDGE_BASE}/create-razorpay-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: env.supabaseAnonKey,
        },
        body: JSON.stringify({
          user_id: userId,
          coupon_code: couponCode || null,
          dry_run: dryRun,
        }),
      });

      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || 'Could not create order');
      }
      return { data: data as OrderResponse, error: null };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Order creation failed';
      lastError = { code: 'order_failed', message: msg };
      if (__DEV__) console.warn(`[razorpay] attempt ${attempt + 1} failed:`, msg);
    }
  }

  return { data: null, error: lastError };
}

// ─── verifyRazorpayPayment ────────────────────────────────────────────────────

/**
 * Verify a Razorpay payment server-side and grant Plus membership.
 * Ported from web `js/supabase.js verifyRazorpayPayment`.
 */
export async function verifyRazorpayPayment(
  orderId: string,
  paymentId: string,
  signature: string,
  userId: string,
): Promise<PaymentResult<VerifyResponse>> {
  try {
    const resp = await fetch(`${EDGE_BASE}/verify-razorpay-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: env.supabaseAnonKey,
      },
      body: JSON.stringify({
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: signature,
        user_id: userId,
      }),
    });

    const data = await resp.json();
    if (!resp.ok) {
      return {
        data: null,
        error: {
          code: 'verification_failed',
          message: data.error || 'Payment verification failed',
        },
      };
    }
    return { data: data as VerifyResponse, error: null };
  } catch (err) {
    return {
      data: null,
      error: {
        code: 'verification_failed',
        message: err instanceof Error ? err.message : 'Payment verification failed',
      },
    };
  }
}

// ─── verifyPlayPurchase ───────────────────────────────────────────────────────

/**
 * Verify a Google Play purchase server-side and grant Plus membership — the
 * Play Billing counterpart of {@link verifyRazorpayPayment}.
 *
 * REQUIRES a `verify-play-purchase` Edge Function that validates `purchaseToken`
 * against the Google Play Developer API before flipping `users.plus_member`.
 * That function does not exist yet; until it is deployed this call returns a
 * transport error and `playBillingProvider` reports the checkout as failed
 * rather than granting anything. A purchase token is attacker-supplied input —
 * it must never be trusted without server-side validation.
 */
export async function verifyPlayPurchase(
  productId: string,
  purchaseToken: string,
  userId: string,
): Promise<PaymentResult<VerifyResponse>> {
  try {
    const resp = await fetch(`${EDGE_BASE}/verify-play-purchase`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: env.supabaseAnonKey,
      },
      body: JSON.stringify({
        product_id: productId,
        purchase_token: purchaseToken,
        user_id: userId,
      }),
    });

    const data = await resp.json();
    if (!resp.ok) {
      return {
        data: null,
        error: {
          code: 'verification_failed',
          message: data.error || 'Payment verification failed',
        },
      };
    }
    return { data: data as VerifyResponse, error: null };
  } catch (err) {
    return {
      data: null,
      error: {
        code: 'verification_failed',
        message: err instanceof Error ? err.message : 'Payment verification failed',
      },
    };
  }
}

// ─── verifyApplePurchase ──────────────────────────────────────────────────────

/**
 * Verify an Apple In-App Purchase server-side and grant Plus membership —
 * the App Store counterpart of {@link verifyRazorpayPayment}. `transactionId`
 * (`Purchase.id` from `react-native-iap`) is attacker-supplied input that
 * must be validated against Apple's App Store Server API server-side, never
 * trusted as-is. See `supabase/functions/verify-apple-purchase`.
 */
export async function verifyApplePurchase(
  productId: string,
  transactionId: string,
  userId: string,
): Promise<PaymentResult<VerifyResponse>> {
  try {
    const resp = await fetch(`${EDGE_BASE}/verify-apple-purchase`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: env.supabaseAnonKey,
      },
      body: JSON.stringify({
        product_id: productId,
        transaction_id: transactionId,
        user_id: userId,
      }),
    });

    const data = await resp.json();
    if (!resp.ok) {
      return {
        data: null,
        error: {
          code: 'verification_failed',
          message: data.error || 'Payment verification failed',
        },
      };
    }
    return { data: data as VerifyResponse, error: null };
  } catch (err) {
    return {
      data: null,
      error: {
        code: 'verification_failed',
        message: err instanceof Error ? err.message : 'Payment verification failed',
      },
    };
  }
}

// ─── claimFreePlus ────────────────────────────────────────────────────────────

/**
 * Grant Plus membership when the final price is ₹0 (coupon covers full cost,
 * no payment gateway needed). Calls the `claim_free_plus` RPC, which
 * re-validates the coupon server-side (active, not expired, under its use
 * cap, and actually worth 100% off) before granting Plus — the caller's
 * `finalPaise === 0` is only ever a UI-side gate, never trusted for the
 * actual grant. See `supabase/migrations/20260721_secure_claim_free_plus.sql`.
 */
export async function claimFreePlus(
  userId: string,
  couponCode: string,
): Promise<PaymentResult<boolean>> {
  try {
    const { data, error } = await supabase.rpc('claim_free_plus', {
      p_user_id: userId,
      p_coupon_code: couponCode,
    });

    if (error) {
      return {
        data: null,
        error: {
          code: error.code || 'claim_failed',
          message: error.message || 'Failed to activate Plus',
        },
      };
    }
    return { data: data as boolean, error: null };
  } catch (err) {
    return {
      data: null,
      error: {
        code: 'claim_failed',
        message: err instanceof Error ? err.message : 'Failed to activate Plus',
      },
    };
  }
}
