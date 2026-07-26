import { maskPhone, formatPhone } from '@/domain/masking';

// Regression coverage for the phone-leak fix: maskPhone() now takes ONLY the
// last 3 digits (phone_last3, a server-side projection) — never a full
// number — so a caller can never accidentally pass a real phone through it.
describe('maskPhone', () => {
  it('renders the masked form from just the last 3 digits', () => {
    expect(maskPhone('210')).toBe('+91 XXXXXXX210');
  });

  it('returns the placeholder for a missing value', () => {
    expect(maskPhone(null)).toBe('—');
    expect(maskPhone(undefined)).toBe('—');
    expect(maskPhone('')).toBe('—');
  });
});

describe('formatPhone', () => {
  it('formats a fully revealed E.164 number for display', () => {
    expect(formatPhone('+919876543210')).toBe('+91 98765 43210');
  });

  it('returns the placeholder for a missing value', () => {
    expect(formatPhone(null)).toBe('—');
  });
});
