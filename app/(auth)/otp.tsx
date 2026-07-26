import { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, router } from 'expo-router';
import { colors, space, fonts } from '@/theme';
import { Text, OtpInput, Button, useToast } from '@/components';
import { confirmOtp, startPhoneAuth, mapAuthError } from '@/features/auth/firebasePhone';
import { otpSession, useOtpSession } from '@/features/auth/otpSession';
import { resolvePostAuthRoute } from '@/features/auth/routing';
import { useAuthCooldown } from '@/features/auth/useAuthCooldown';

const RESEND_SECONDS = 30;

/**
 * OTP verification (Story 2.1, FR-2). Six-cell code with autofill + auto-submit
 * on the 6th digit; 30s resend lock; Firebase errors mapped to documented copy.
 * On success, post-auth routing (Story 2.2) decides feed vs onboarding vs a
 * stored deep link, replacing the stack so auth never stays in history (FR-3).
 */
export default function OtpScreen() {
  const { phone, confirmation } = useOtpSession();
  const toast = useToast();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
  const submitting = useRef(false);
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
      if (!confirmation) {
        setError('Something went wrong. Please try again.');
        return;
      }
      submitting.current = true;
      setError(null);
      setBusy(true);
      try {
        const cred = await confirmOtp(confirmation, fullCode);
        const verifiedPhone = cred?.user?.phoneNumber ?? phone ?? '';
        const target = await resolvePostAuthRoute(verifiedPhone);
        // Set before clearing: otpSession.clear() synchronously re-renders this
        // still-mounted screen via useOtpSession(), and without this flag the
        // now-null confirmation/phone would trip the guard below into a
        // <Redirect to sign-in> that can win the race against router.replace.
        // Both updates land in the same batched re-render (React 19).
        setVerified(true);
        router.replace(target); // navigate first, then drop the handoff (avoids guard race)
        otpSession.clear();
      } catch (err) {
        const code = (err as { code?: string })?.code;
        if (code === 'auth/too-many-requests') {
          triggerCooldown(5);
        }
        setError(mapAuthError(code));
        setCode('');
        setResetKey((k) => k + 1); // remount cells + refocus
        submitting.current = false;
        setBusy(false);
      }
    },
    // triggerCooldown is useCallback-stable in useAuthCooldown, so listing it
    // satisfies the dependency rule without re-creating `verify` each render.
    [confirmation, phone, triggerCooldown],
  );

  async function onResend() {
    if (secondsLeft > 0 || busy || !phone) return;
    setError(null);
    setCode('');
    setResetKey((k) => k + 1);
    try {
      const next = await startPhoneAuth(phone);
      otpSession.setConfirmation(next);
      setSecondsLeft(RESEND_SECONDS);
      toast.show('Code sent again.', 'info');
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code === 'auth/too-many-requests') {
        triggerCooldown(5);
      }
      setError(mapAuthError(code));
    }
  }

  function onChangeNumber() {
    otpSession.clear();
    router.back();
  }

  // Guard: no pending confirmation (e.g. deep-linked straight here / hot reload).
  // Skipped once verify() has succeeded — see the `verified` state above.
  if ((!confirmation || !phone) && !verified) {
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
