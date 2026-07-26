/**
 * Razorpay checkout provider.
 *
 * Behaviour is a straight lift of the flow that previously lived inline in
 * `app/plus.tsx` — create order → open the native sheet → verify server-side —
 * moved behind {@link PaymentProvider} so the screen is gateway-agnostic. No
 * pricing, coupon, or verification semantics were changed.
 *
 * `react-native-razorpay` is resolved with a lazy `require` (as the original
 * code did) so a binary built without the SDK degrades to `unavailable`
 * instead of failing to bundle.
 */
import { createRazorpayOrder, verifyRazorpayPayment } from '@/api/payment';
import type { CheckoutOutcome, CheckoutRequest, PaymentProvider } from './types';

/** Razorpay's native module, or null when the SDK isn't linked into the build. */
function loadSdk(): { open: (opts: Record<string, unknown>) => Promise<RazorpaySuccess> } | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const rp = require('react-native-razorpay');
    return rp?.default ?? rp ?? null;
  } catch {
    return null;
  }
}

/** Shape Razorpay resolves with on a completed payment. */
type RazorpaySuccess = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

const SDK_MISSING =
  'Razorpay is not available in this build. Reinstall the app or contact support@zenter.in.';

/**
 * Razorpay reports a user-dismissed sheet as a thrown error rather than a
 * distinct status, so cancellation is detected by message. Kept deliberately
 * broad — a mis-detected cancel shows no toast, which is far better than
 * showing a scary failure for a deliberate dismissal.
 */
function isCancellation(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes('cancel') || m.includes('dismiss');
}

export const razorpayProvider: PaymentProvider = {
  id: 'razorpay',
  label: 'Razorpay',

  isAvailable() {
    return loadSdk() !== null;
  },

  async checkout({ userId, phone, couponCode, themeColor }: CheckoutRequest): Promise<CheckoutOutcome> {
    const sdk = loadSdk();
    if (!sdk) return { status: 'unavailable', message: SDK_MISSING };

    // 1. Real (non-dry-run) order. The server re-validates the coupon and is
    //    the sole authority on the amount charged — never trust a client price.
    const { data: order, error: orderError } = await createRazorpayOrder(userId, couponCode, false);
    if (orderError || !order?.order_id) {
      return {
        status: 'failed',
        message: orderError?.message ?? 'Could not create order. Please try again.',
      };
    }

    // 2. Native sheet.
    let payment: RazorpaySuccess;
    try {
      payment = await sdk.open({
        key: order.key_id,
        amount: order.amount,
        currency: order.currency ?? 'INR',
        name: 'Zenter',
        description: 'Zenter Plus — Unlimited Co-ordinations',
        order_id: order.order_id,
        prefill: { contact: phone ?? undefined },
        theme: { color: themeColor },
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Payment was dismissed or failed. Please try again.';
      return isCancellation(message) ? { status: 'cancelled' } : { status: 'failed', message };
    }

    // 3. Server-side signature verification — this is what grants Plus.
    const { error: verifyError } = await verifyRazorpayPayment(
      payment.razorpay_order_id,
      payment.razorpay_payment_id,
      payment.razorpay_signature,
      userId,
    );
    if (verifyError) {
      return {
        status: 'failed',
        message: 'Verification failed. Contact support@zenter.in',
      };
    }

    return { status: 'success', reference: payment.razorpay_order_id };
  },
};
