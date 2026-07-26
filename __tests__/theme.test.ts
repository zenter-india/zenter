import { colors, radius, fontSize, avatarInitials } from '@/theme';

// Design-system smoke tests — confirm exact brand tokens + helpers.
describe('theme tokens', () => {
  it('exposes the exact Zenter brand colors', () => {
    expect(colors.primary).toBe('#FF6B35');
    expect(colors.secondary).toBe('#4F46E5');
    expect(colors.accent).toBe('#10B981');
  });

  it('uses the documented radii + mobile type scale', () => {
    expect(radius.lg).toBe(16);
    expect(fontSize['4xl']).toBe(32);
  });

  it('derives avatar initials (max 2, fallback Z)', () => {
    expect(avatarInitials('Sneha Patil')).toBe('SP');
    expect(avatarInitials('Arjun')).toBe('AR');
    expect(avatarInitials('')).toBe('Z');
    expect(avatarInitials(null)).toBe('Z');
  });
});
