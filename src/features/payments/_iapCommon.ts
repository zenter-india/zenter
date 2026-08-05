/**
 * Shared plumbing for `appleIapProvider.ts` / `playBillingProvider.ts`, both
 * driving `react-native-iap@16` (Nitro-modules based — see `types.ts`'s
 * module header for why the older, simpler-API major line isn't used: its
 * podspec depends on `RCT-Folly`, which no longer resolves under this
 * project's React Native 0.86 prebuilt-core structure — confirmed via a
 * local `pod install` failure, not a guess).
 *
 * v16's `requestPurchase()` does NOT resolve with the purchase — the result
 * arrives through a separate `purchaseUpdatedListener`/`purchaseErrorListener`
 * event pair (per the library's own docs: "the result is delivered through
 * purchaseUpdatedListener — NOT the return value"). `bridgePurchaseRequest`
 * turns that event-based flow back into a single awaitable promise so the
 * two providers' `checkout()`/`restore()` can stay simple async functions.
 */

export type IapPurchase = {
  id: string;
  productId: string;
  purchaseToken?: string | null;
  transactionDate: number;
};

export type IapPurchaseError = {
  code?: string;
  message: string;
};

/** Minimal slice of the `react-native-iap` (16.x) surface both providers drive. */
export type IapModule = {
  initConnection: () => Promise<boolean>;
  endConnection: () => Promise<boolean>;
  fetchProducts: (opts: {
    skus: string[];
    type?: 'in-app';
  }) => Promise<{ id: string; displayPrice?: string | null }[] | null>;
  requestPurchase: (opts: {
    request: { apple?: { sku: string } } | { google?: { skus: string[] } };
    type: 'in-app';
  }) => Promise<unknown>;
  finishTransaction: (opts: { purchase: IapPurchase; isConsumable: boolean }) => Promise<unknown>;
  getAvailablePurchases: () => Promise<IapPurchase[]>;
  purchaseUpdatedListener: (listener: (purchase: IapPurchase) => void) => { remove: () => void };
  purchaseErrorListener: (listener: (error: IapPurchaseError) => void) => { remove: () => void };
};

/** The IAP native module, or null when it isn't linked into this binary (e.g. web). */
export function loadIapSdk(): IapModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('react-native-iap');
    return (mod ?? null) as IapModule | null;
  } catch {
    return null;
  }
}

/** A user-dismissed sheet surfaces as a distinct error code/message, not a thrown exception. */
export function isCancellation(err: { code?: string; message?: string } | null | undefined): boolean {
  const code = err?.code ?? '';
  const message = err?.message ?? '';
  return code === 'E_USER_CANCELLED' || /cancel/i.test(code) || /cancel/i.test(message);
}

const PURCHASE_TIMEOUT_MS = 60_000;

/**
 * Calls `requestPurchase`, resolving with whichever fires first: a matching
 * `purchaseUpdatedListener` event, a `purchaseErrorListener` event, or a
 * timeout (the store sheet was left open with no user action — treated as a
 * silent cancel, not an error toast).
 */
export function bridgePurchaseRequest(
  iap: IapModule,
  productId: string,
  request: Parameters<IapModule['requestPurchase']>[0],
): Promise<{ purchase: IapPurchase | null; error: IapPurchaseError | null; timedOut: boolean }> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: { purchase: IapPurchase | null; error: IapPurchaseError | null; timedOut: boolean }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      updatedSub.remove();
      errorSub.remove();
      resolve(result);
    };

    const updatedSub = iap.purchaseUpdatedListener((purchase) => {
      if (purchase.productId === productId) finish({ purchase, error: null, timedOut: false });
    });
    const errorSub = iap.purchaseErrorListener((error) => {
      finish({ purchase: null, error, timedOut: false });
    });
    const timer = setTimeout(() => finish({ purchase: null, error: null, timedOut: true }), PURCHASE_TIMEOUT_MS);

    iap.requestPurchase(request).catch((err: unknown) => {
      const e = err as { code?: string; message?: string };
      finish({ purchase: null, error: { code: e?.code, message: e?.message ?? 'Purchase failed.' }, timedOut: false });
    });
  });
}
