/**
 * Zenter Plus subscription screen — ported from web `plus.html`. Presents the
 * Plus feature comparison, coupon code entry, and triggers checkout (or a free
 * claim when a coupon discounts to ₹0).
 *
 * The flow matches the web exactly:
 *   1. Probe the server with `createRazorpayOrder(userId, null, true)` to get
 *      the current price (admin-controlled via `platform_config.plus_price_paise`).
 *      Despite the name this is the pricing/coupon endpoint, not a gateway call.
 *   2. If the user enters a coupon, re-probe with `dryRun=true` to validate.
 *   3. On "Get Zenter Plus" tap:
 *      - If `finalPaise === 0` → call `claimFreePlus()` and skip the gateway.
 *      - Otherwise → hand off to the configured payment provider, which owns
 *        order creation, the native sheet, and server-side verification.
 *
 * This screen names no gateway. Which one runs comes from
 * `platform_config.payment_provider` (see src/features/payments), so switching
 * to Google Play Billing — required by Play for digital goods — needs no change
 * here and no rebuild.
 */
import { useCallback, useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, TextInput, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors, space, radius, fonts } from '@/theme';
import { Text, Button, Card, Badge, useToast } from '@/components';
import { useSession } from '@/stores/session';
import { useProfile } from '@/data/useProfile';
import { useConfig } from '@/data/useConfig';
import { useQueryClient } from '@tanstack/react-query';
import { qk } from '@/data/keys';
import { track } from '@/lib/observability';
import { FEED_ROUTE } from '@/features/auth/routing';
import { createRazorpayOrder, claimFreePlus } from '@/api/payment';
import { getPaymentProvider } from '@/features/payments';
import { ScreenHeader } from '@/features/profile/ScreenHeader';

// ─── Feature comparison data ──────────────────────────────────────────────────

const FEATURES = [
  {
    icon: '✨',
    title: 'Featured Profile',
    description:
      'Your profile card gets a gold border and warm glow — visually distinct from every free user in the feed.',
  },
  {
    icon: '🔝',
    title: 'Priority Visibility',
    description:
      "Your profile appears above all free users in your district's find aspirants feed.",
  },
  {
    icon: '💬',
    title: 'Unlock entire exam centre',
    description:
      'Free users get 2 accesses. Plus breaks the barrier and lets you co-ordinate with the entire exam centre.',
  },
] as const;

const COMPARISON = [
  { feature: 'Browse district aspirants', free: true, plus: true },
  { feature: 'Send & receive requests', free: true, plus: true },
  { feature: 'Featured profile (gold card)', free: false, plus: true },
  { feature: '⭐ Plus Badge on card', free: false, plus: true },
  { feature: 'Priority position in feed', free: false, plus: true },
  { feature: 'Active co-ordinations', free: '2 only', plus: 'Unlimited' },
  { feature: 'Exchange contact', free: '2 only', plus: 'Unlimited' },
] as const;

// ─── Component ────────────────────────────────────────────────────────────────

export default function PlusScreen() {
  const { phone } = useSession();
  const { data: me } = useProfile(phone);
  const { data: config } = useConfig();
  const { show } = useToast();
  const queryClient = useQueryClient();

  // Price state
  const [basePrice, setBasePrice] = useState<number | null>(null);
  const [finalPaise, setFinalPaise] = useState<number | null>(null);
  const [priceLoading, setPriceLoading] = useState(true);

  // Coupon state
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [couponStatus, setCouponStatus] = useState<{ text: string; success: boolean } | null>(null);
  const [couponBusy, setCouponBusy] = useState(false);

  // Purchase state
  const [buying, setBuying] = useState(false);
  const [purchased, setPurchased] = useState(false);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace(FEED_ROUTE));

  const isPlus = !!me?.plus_member;
  const plusEnabled = config?.plusEnabled !== false;

  // ── Price probe on mount ──────────────────────────────────────────────────
  useEffect(() => {
    if (!me?.id) return;
    (async () => {
      const { data: probe } = await createRazorpayOrder(me.id, null, true);
      if (probe) {
        setBasePrice(probe.original_paise / 100);
        setFinalPaise(probe.original_paise);
      }
      setPriceLoading(false);
    })();
  }, [me?.id]);

  // ── Track page view ───────────────────────────────────────────────────────
  useEffect(() => {
    if (me?.id) track('plus_page_view', { source: 'plus_page' });
  }, [me?.id]);

  // ── Coupon handlers ───────────────────────────────────────────────────────
  const applyCoupon = useCallback(async () => {
    const code = couponCode.trim().toUpperCase();
    if (!code || !me?.id) return;
    setCouponBusy(true);
    setCouponStatus(null);

    const { data: probe, error } = await createRazorpayOrder(me.id, code, true);
    if (error || !probe) {
      setCouponStatus({ text: '✗ Could not verify coupon. Try again.', success: false });
      setCouponBusy(false);
      return;
    }

    if (probe.coupon_applied) {
      setAppliedCoupon(code);
      setFinalPaise(probe.final_paise);
      const msg =
        probe.final_paise === 0
          ? `✓ 100% off! ${probe.coupon_label || ''} — Zenter Plus is free for you!`
          : `✓ Coupon applied! ${probe.coupon_label || ''}`;
      setCouponStatus({ text: msg, success: true });
      track('coupon_applied', { coupon: code, price: probe.final_paise / 100 });
    } else {
      setCouponStatus({ text: '✗ Invalid coupon code.', success: false });
    }
    setCouponBusy(false);
  }, [couponCode, me]);

  const removeCoupon = useCallback(() => {
    const prevCode = appliedCoupon;
    setAppliedCoupon(null);
    setCouponCode('');
    setCouponStatus(null);
    if (basePrice != null) setFinalPaise(basePrice * 100);
    if (prevCode) track('coupon_removed', { coupon: prevCode });
  }, [appliedCoupon, basePrice]);

  // ── Purchase handler ──────────────────────────────────────────────────────
  const handleBuy = useCallback(async () => {
    if (!me?.id || buying) return;
    setBuying(true);
    track('upgrade_cta_click', { source: 'plus_page', coupon: appliedCoupon });

    // ── Zero-price path: skip payment gateway entirely ──
    if (finalPaise === 0) {
      if (!appliedCoupon) {
        show('⚠️ Apply a coupon code first.', 'danger');
        setBuying(false);
        return;
      }
      const { error } = await claimFreePlus(me.id, appliedCoupon);
      if (error) {
        show(`⚠️ ${error.message}`, 'danger');
        setBuying(false);
        return;
      }
      setPurchased(true);
      track('payment_success', { order_id: 'free', coupon: appliedCoupon });
      show('🎉 Welcome to Zenter Plus!', 'success');
      // Invalidate profile so Plus badge shows everywhere
      queryClient.invalidateQueries({ queryKey: qk.profile(phone ?? '') });
      queryClient.invalidateQueries({ queryKey: qk.status(phone ?? '') });
      setTimeout(() => router.replace(FEED_ROUTE), 2000);
      return;
    }

    // ── Paid path: whichever gateway platform_config selects ──
    // The provider owns order creation, the native sheet, and server-side
    // verification, so this screen stays gateway-agnostic — moving to Google
    // Play Billing is a config change, not an edit here.
    const provider = getPaymentProvider(config?.paymentProvider);
    const outcome = await provider.checkout({
      userId: me.id,
      phone,
      couponCode: appliedCoupon,
      amountPaise: finalPaise ?? 0,
      themeColor: colors.primary,
    });

    switch (outcome.status) {
      case 'success':
        setPurchased(true);
        track('payment_success', { order_id: outcome.reference, provider: provider.id });
        show('🎉 Payment successful! Welcome to Zenter Plus!', 'success');
        queryClient.invalidateQueries({ queryKey: qk.profile(phone ?? '') });
        queryClient.invalidateQueries({ queryKey: qk.status(phone ?? '') });
        setTimeout(() => router.replace(FEED_ROUTE), 2000);
        return;

      case 'cancelled':
        // A dismissed sheet is a normal choice — no error toast.
        track('payment_dismissed', { provider: provider.id });
        setBuying(false);
        return;

      case 'unavailable':
        show(`⚠️ ${outcome.message}`, 'danger');
        track('payment_unavailable', { provider: provider.id });
        setBuying(false);
        return;

      case 'failed':
        show(`⚠️ ${outcome.message}`, 'danger');
        track('payment_verification_failed', {
          error: outcome.message,
          provider: provider.id,
        });
        setBuying(false);
        return;
    }
  }, [me, phone, buying, finalPaise, appliedCoupon, queryClient, show, config?.paymentProvider]);

  // ── Derived display values ────────────────────────────────────────────────
  const displayPrice = finalPaise != null ? finalPaise / 100 : basePrice ?? 49;
  const showStrikethrough = appliedCoupon && basePrice != null && finalPaise != null && finalPaise !== basePrice * 100;
  const ctaLabel = isPlus
    ? '⭐ You are already Zenter Plus!'
    : purchased
      ? '⭐ Welcome to Zenter Plus!'
      : finalPaise === 0
        ? 'Claim Zenter Plus — FREE'
        : `Get Zenter Plus — ₹${displayPrice}`;

  // ── Plus not enabled gate ─────────────────────────────────────────────────
  if (!plusEnabled) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title="Zenter Plus" onBack={goBack} />
        <View style={styles.disabledWrap}>
          <Text variant="h2">Zenter Plus is not available right now.</Text>
          <Button title="← Back to Home" variant="ghost" onPress={goBack} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Zenter Plus" onBack={goBack} />

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Hero */}
        <View style={styles.hero}>
          <Badge label="⭐ Zenter Plus" variant="plus" />
          <Text variant="h1" style={styles.heroTitle}>
            Unlock your entire exam centre.
          </Text>
          <Text variant="bodyMuted" style={styles.heroSub}>
            Plus gives you priority visibility, featured card and co-ordinate with every centre
            aspirant.
          </Text>
          {!priceLoading && (
            <Text style={styles.heroPrice}>
              ₹{basePrice ?? 49} <Text style={styles.heroPriceSuffix}>/ exam season</Text>
            </Text>
          )}
          <Text variant="small" style={styles.heroSeason}>
            One-time for NEET UG 2026
          </Text>
        </View>

        {/* Features */}
        <Card style={styles.featuresCard}>
          {FEATURES.map((f, i) => (
            <View key={i} style={[styles.featureRow, i < FEATURES.length - 1 && styles.featureBorder]}>
              <Text style={styles.featureIcon}>{f.icon}</Text>
              <View style={styles.featureText}>
                <Text style={styles.featureTitle}>{f.title}</Text>
                <Text variant="small" style={styles.featureDesc}>
                  {f.description}
                </Text>
              </View>
            </View>
          ))}
        </Card>

        {/* Comparison table */}
        <Text variant="h2" style={styles.compareHeading}>
          Free vs Plus
        </Text>
        <Card style={styles.compareCard}>
          {/* Header */}
          <View style={styles.compareRow}>
            <Text style={[styles.compareCell, styles.compareFeatureCol, styles.compareHeader]}>
              Feature
            </Text>
            <Text style={[styles.compareCell, styles.compareValueCol, styles.compareHeader]}>
              Free
            </Text>
            <Text
              style={[
                styles.compareCell,
                styles.compareValueCol,
                styles.compareHeader,
                { color: colors.primary },
              ]}
            >
              Plus ⭐
            </Text>
          </View>
          {/* Rows */}
          {COMPARISON.map((row, i) => (
            <View key={i} style={[styles.compareRow, styles.compareBorder]}>
              <Text style={[styles.compareCell, styles.compareFeatureCol]}>{row.feature}</Text>
              <Text style={[styles.compareCell, styles.compareValueCol]}>
                {row.free === true ? (
                  <Text style={styles.check}>✓</Text>
                ) : row.free === false ? (
                  <Text style={styles.cross}>✗</Text>
                ) : (
                  <Text style={styles.limitText}>{row.free}</Text>
                )}
              </Text>
              <Text style={[styles.compareCell, styles.compareValueCol]}>
                {row.plus === true ? (
                  <Text style={styles.check}>✓</Text>
                ) : (
                  <Text style={styles.plusValue}>{row.plus}</Text>
                )}
              </Text>
            </View>
          ))}
        </Card>

        {/* Coupon */}
        {!isPlus && !purchased && (
          <View style={styles.couponSection}>
            <View style={styles.couponRow}>
              <TextInput
                style={styles.couponInput}
                placeholder="Have a coupon code?"
                placeholderTextColor={colors.textSubtle}
                value={couponCode}
                onChangeText={setCouponCode}
                autoCapitalize="characters"
                maxLength={20}
                editable={!appliedCoupon}
                returnKeyType="done"
                onSubmitEditing={applyCoupon}
              />
              <Button
                title={appliedCoupon ? '✓' : 'Apply'}
                variant="ghost"
                size="sm"
                disabled={couponBusy || !!appliedCoupon}
                onPress={applyCoupon}
              />
            </View>
            {appliedCoupon && (
              <Pressable onPress={removeCoupon}>
                <Text style={styles.removeCoupon}>✕ Remove coupon</Text>
              </Pressable>
            )}
            {couponStatus && (
              <Text
                style={[
                  styles.couponStatusText,
                  { color: couponStatus.success ? colors.success600 : colors.danger },
                ]}
              >
                {couponStatus.text}
              </Text>
            )}
          </View>
        )}

        {/* Price + CTA */}
        <View style={styles.ctaSection}>
          {!priceLoading && !isPlus && !purchased && (
            <View style={styles.priceRow}>
              {showStrikethrough && (
                <Text style={styles.priceStrike}>₹{basePrice}</Text>
              )}
              <Text style={styles.priceFinal}>
                {finalPaise === 0 ? 'FREE' : `₹${displayPrice}`}
              </Text>
              <Text style={styles.priceSuffix}>/ exam season</Text>
            </View>
          )}
          <Button
            title={ctaLabel}
            block
            disabled={isPlus || purchased || buying}
            busy={buying}
            onPress={handleBuy}
            style={purchased || isPlus ? styles.successBtn : undefined}
          />
          <Button title="← Back to Home" variant="ghost" onPress={goBack} style={styles.backLink} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: space[4], paddingBottom: space[7], gap: space[4] },
  disabledWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: space[5], gap: space[4] },

  // Hero
  hero: { alignItems: 'center', paddingVertical: space[5], gap: space[2] },
  heroTitle: { textAlign: 'center', marginTop: space[2] },
  heroSub: { textAlign: 'center', maxWidth: 340, marginBottom: space[2] },
  heroPrice: { fontSize: 36, fontFamily: fonts.displayExtra, color: colors.text, lineHeight: 42 },
  heroPriceSuffix: { fontSize: 16, fontFamily: fonts.bodyMedium, color: colors.textMuted },
  heroSeason: { color: colors.textMuted },

  // Features
  featuresCard: { gap: 0, padding: space[4] },
  featureRow: { flexDirection: 'row', gap: space[3], paddingVertical: space[2] },
  featureBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  featureIcon: { fontSize: 18, marginTop: 2 },
  featureText: { flex: 1, gap: 2 },
  featureTitle: { fontFamily: fonts.bodySemibold, fontSize: 15, color: colors.text },
  featureDesc: { color: colors.textMuted },

  // Comparison
  compareHeading: { textAlign: 'center' },
  compareCard: { padding: 0, overflow: 'hidden' },
  compareRow: { flexDirection: 'row', alignItems: 'center' },
  compareBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  compareCell: { paddingHorizontal: space[3], paddingVertical: space[2] },
  compareFeatureCol: { flex: 1, fontFamily: fonts.body, fontSize: 13, color: colors.text },
  compareValueCol: { width: 72, textAlign: 'center', fontFamily: fonts.body, fontSize: 13 },
  compareHeader: {
    fontFamily: fonts.bodySemibold,
    fontSize: 11,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  check: { color: colors.success600, fontSize: 16 },
  cross: { color: colors.textSubtle, fontSize: 16 },
  limitText: { color: colors.textMuted, fontSize: 12 },
  plusValue: { color: colors.primary, fontFamily: fonts.bodyBold, fontSize: 12 },

  // Coupon
  couponSection: { gap: space[1] },
  couponRow: { flexDirection: 'row', gap: space[2], alignItems: 'center' },
  couponInput: {
    flex: 1,
    paddingHorizontal: space[3],
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.text,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  removeCoupon: {
    fontFamily: fonts.bodySemibold,
    fontSize: 12,
    color: colors.danger,
    textDecorationLine: 'underline',
    paddingTop: 2,
  },
  couponStatusText: { fontFamily: fonts.body, fontSize: 12, marginTop: 2 },

  // CTA
  ctaSection: { alignItems: 'center', gap: space[3], maxWidth: 400, alignSelf: 'center', width: '100%' },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: space[2] },
  priceStrike: {
    fontSize: 15,
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
  priceFinal: { fontSize: 22, fontFamily: fonts.displayBold, color: colors.text },
  priceSuffix: { fontSize: 13, color: colors.textMuted },
  successBtn: { backgroundColor: colors.success600 },
  backLink: { marginTop: space[1] },
});
