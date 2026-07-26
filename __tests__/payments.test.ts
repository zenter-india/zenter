import {
  DEFAULT_PAYMENT_PROVIDER,
  getPaymentProvider,
  toPaymentProviderId,
} from '@/features/payments';
import { parseConfig } from '@/data/useConfig';

/**
 * Guards the payment-provider seam. The point of this indirection is that the
 * active gateway can be swapped from `platform_config` without a rebuild, so
 * the invariant worth protecting is: a bad or missing config value must never
 * leave Plus unbuyable — it falls back instead.
 */
describe('toPaymentProviderId', () => {
  it('accepts the known provider ids', () => {
    expect(toPaymentProviderId('razorpay')).toBe('razorpay');
    expect(toPaymentProviderId('play_billing')).toBe('play_billing');
  });

  it('rejects anything else, including near-misses and wrong types', () => {
    for (const bad of ['Razorpay', 'playbilling', 'stripe', '', null, undefined, 42, {}]) {
      expect(toPaymentProviderId(bad)).toBeNull();
    }
  });
});

describe('getPaymentProvider', () => {
  it('returns the requested provider', () => {
    expect(getPaymentProvider('razorpay').id).toBe('razorpay');
    expect(getPaymentProvider('play_billing').id).toBe('play_billing');
  });

  it('falls back to the default when unset', () => {
    expect(getPaymentProvider(null).id).toBe(DEFAULT_PAYMENT_PROVIDER);
    expect(getPaymentProvider(undefined).id).toBe(DEFAULT_PAYMENT_PROVIDER);
  });
});

describe('parseConfig — payment_provider', () => {
  it('reads a valid remote override', () => {
    expect(parseConfig([{ key: 'payment_provider', value: 'play_billing' }]).paymentProvider).toBe(
      'play_billing',
    );
  });

  it('defaults when the key is absent', () => {
    expect(parseConfig([]).paymentProvider).toBe(DEFAULT_PAYMENT_PROVIDER);
  });

  it('defaults on a typo rather than disabling checkout', () => {
    expect(parseConfig([{ key: 'payment_provider', value: 'razorpayy' }]).paymentProvider).toBe(
      DEFAULT_PAYMENT_PROVIDER,
    );
  });

  it('does not disturb the other config keys', () => {
    const cfg = parseConfig([
      { key: 'payment_provider', value: 'play_billing' },
      { key: 'free_active_chats', value: 0 },
      { key: 'plus_enabled', value: false },
    ]);
    // 0 must survive — `??` semantics, not `||` (an explicit 0 is meaningful).
    expect(cfg.freeActiveChats).toBe(0);
    expect(cfg.plusEnabled).toBe(false);
    expect(cfg.paymentProvider).toBe('play_billing');
  });
});
