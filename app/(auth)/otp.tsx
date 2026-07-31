import { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { colors, space, fonts } from '@/theme';
import { Text, OtpInput, Button, useToast } from '@/components';
import { confirmOtp, startPhoneAuth, mapAuthError, isRateLimitError } from '@/features/auth/phoneAuth';
import { resolvePostAuthRoute } from '@/features/auth/routing';
import { useAuthCooldown } from '@/features/auth/useAuthCooldown';

const RESEND_SECONDS = 30;

/**
 * OTP verification (Story 2.1, FR-2). Six-cell code with autofill + auto-submit
 * on the 6th digit; 30s resend lock; Supabase Auth errors mapped to documented
 * copy. On success, post-auth routing (Story 2.2) decides feed vs onboarding
 * vs a stored deep link, replacing the stack so auth never stays in history
 * (FR-3).
 */
export default function OtpScreen() {
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const toast = useToast();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
  const submitting = useRef(false);
  const resending = useRef(false);
  const [verified, setVerified] = useState(false);
  const { isCoolingDown, cooldownText, triggerCooldown } = useAuthCooldown();

  // Resend countdown.
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft]);

  const verify = useCallback(
    async (fullCode: string) => {
      if (submitting.current) return;
      if (!/^\d{6}$/.test(fullCode)) {
        setError('Enter the complete 6-digit code.');
        return;
      }
      if (!phone) {
        setError('Something went wrong. Please try again.');
        return;
      }
      submitting.current = true;
      setError(null);
      setBusy(true);
      try {
        const session = await confirmOtp(phone, fullCode);
        const verifiedPhone = session?.user?.phone ? `+${session.user.phone.replace(/^\+/, '')}` : phone;
        const target = await resolvePostAuthRoute(verifiedPhone);
        // Set before navigating away: avoids the guard below (no confirmation
        // object anymore, just this flag) racing router.replace on the same
        // still-mounted screen.
        setVerified(true);
        router.replace(target);
      } catch (err) {
        const authError = err as { code?: string; message?: string };
        if (isRateLimitError(authError)) {
          triggerCooldown(5);
        }
        setError(mapAuthError(authError));
        setCode('');
        setResetKey((k) => k + 1); // remount cells + refocus
        submitting.current = false;
        setBusy(false);
      }
    },
    // triggerCooldown is useCallback-stable in useAuthCooldown, so listing it
    // satisfies the dependency rule without re-creating `verify` each render.
    [phone, triggerCooldown],
  );

  async function onResend() {
    // `busy` is set synchronously via the ref: the state update alone lands too
    // late to stop a second tap in the same tick, and each extra tap costs the
    // member a real SMS.
    if (secondsLeft > 0 || busy || resending.current || !phone) return;
    resending.current = true;
    setBusy(true);
    setError(null);
    setCode('');
    setResetKey((k) => k + 1);
    try {
      await startPhoneAuth(phone);
      setSecondsLeft(RESEND_SECONDS);
      toast.show('Code sent again.', 'info');
    } catch (err) {
      const authError = err as { code?: string; message?: string };
      if (isRateLimitError(authError)) {
        triggerCooldown(5);
      }
      setError(mapAuthError(authError));
    } finally {
      resending.current = false;
      setBusy(false);
    }
  }

  function onChangeNumber() {
    router.back();
  }

  // Guard: no pending phone (e.g. deep-linked straight here / hot reload).
  // Skipped once verify() has succeeded — see the `verified` state above.
  if (!phone && !verified) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text variant="h2">Verify your number</Text>
            <Text variant="bodyMuted" style={styles.lead}>
              Enter the 6-digit code sent to <Text style={styles.phone}>{phone}</Text>.
            </Text>
          </View>

          <OtpInput
            key={resetKey}
            value={code}
            onChange={(c) => {
              setCode(c);
              if (error) setError(null);
            }}
            onComplete={verify}
            autoFocus
          />

          {error ? (
            <Text variant="small" color={colors.danger} accessibilityLiveRegion="assertive" style={styles.error}>
              {error}
            </Text>
          ) : null}

          <Button title="Verify" size="lg" block busy={busy} onPress={() => verify(code)} style={styles.cta} />

          <View style={styles.resendRow}>
            {isCoolingDown ? (
              <Text variant="small" color={colors.danger} style={styles.resendMuted}>
                {cooldownText}
              </Text>
            ) : secondsLeft > 0 ? (
              <Text variant="small" style={styles.resendMuted}>
                Resend code in {secondsLeft}s
              </Text>
            ) : (
              <Pressable accessibilityRole="button" onPress={onResend} disabled={busy} hitSlop={8}>
                <Text variant="link">Resend code</Text>
              </Pressable>
            )}
          </View>

          <View style={styles.changeRow}>
            <Pressable accessibilityRole="button" onPress={onChangeNumber} disabled={busy} hitSlop={8}>
              <Text variant="link">Change number</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, padding: space[5], gap: space[4] },
  header: { gap: space[1] },
  lead: {},
  phone: { fontFamily: fonts.bodySemibold, color: colors.text },
  error: { textAlign: 'center' },
  cta: { marginTop: space[1] },
  resendRow: { alignItems: 'center' },
  resendMuted: { color: colors.textSubtle },
  changeRow: { alignItems: 'center' },
});
