import { Platform } from 'react-native';
import { getPaymentProvider, toPaymentProviderId } from '@/features/payments';
import { parseConfig } from '@/data/useConfig';

/**
 * Guards the payment-provider seam. The point of this indirection is that the
 * active gateway can be swapped from `platform_config` without a rebuild, so
 * the invariant worth protecting is: a bad or missing config value must never
 * leave Plus unbuyable — it falls back to this platform's required gateway
 * instead (Apple IAP on iOS, Play Billing on Android, Razorpay elsewhere).
 */
function expectedDefaultId(): string {
  if (Platform.OS === 'ios') return 'apple_iap';
  if (Platform.OS === 'android') return 'play_billing';
  return 'razorpay';
}

describe('toPaymentProviderId', () => {
  it('accepts the known provider ids', () => {
    expect(toPaymentProviderId('razorpay')).toBe('razorpay');
    expect(toPaymentProviderId('play_billing')).toBe('play_billing');
    expect(toPaymentProviderId('apple_iap')).toBe('apple_iap');
  });

  it('rejects anything else, including near-misses and wrong types', () => {
    for (const bad of ['Razorpay', 'playbilling', 'stripe', '', null, undefined, 42, {}]) {
      expect(toPaymentProviderId(bad)).toBeNull();
    }
  });
});

describe('getPaymentProvider', () => {
  it('returns the requested provider regardless of platform', () => {
    expect(getPaymentProvider('razorpay').id).toBe('razorpay');
    expect(getPaymentProvider('play_billing').id).toBe('play_billing');
    expect(getPaymentProvider('apple_iap').id).toBe('apple_iap');
  });

  it('falls back to this platform\'s required gateway when unset', () => {
    expect(getPaymentProvider(null).id).toBe(expectedDefaultId());
    expect(getPaymentProvider(undefined).id).toBe(expectedDefaultId());
  });
});

describe('parseConfig — payment_provider', () => {
  it('reads a valid remote override', () => {
    expect(parseConfig([{ key: 'payment_provider', value: 'play_billing' }]).paymentProvider).toBe(
      'play_billing',
    );
  });

  it('is null (no override) when the key is absent', () => {
    expect(parseConfig([]).paymentProvider).toBeNull();
  });

  it('is null on a typo rather than forcing a gateway', () => {
    expect(parseConfig([{ key: 'payment_provider', value: 'razorpayy' }]).paymentProvider).toBeNull();
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
