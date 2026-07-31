import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, space, fonts } from '@/theme';
import { Text, Input, Button } from '@/components';
import { startPhoneAuth, normalizePhoneIN, mapAuthError, isRateLimitError } from '@/features/auth/phoneAuth';
import { useAuthCooldown } from '@/features/auth/useAuthCooldown';
import { useSession } from '@/stores/session';

/**
 * Phone entry (Story 2.1, FR-1). A 10-digit Indian mobile behind a `+91` prefix
 * is normalized to E.164 (normalizePhoneIN) and an OTP is sent via
 * startPhoneAuth (Supabase Auth, Twilio Verify backend) — no reCAPTCHA. The
 * phone is handed to the OTP screen as a route param (serializable — unlike
 * the old Firebase ConfirmationResult, Supabase's verifyOtp only needs the
 * phone string). Invalid input blocks with the documented copy before any
 * network call.
 */
export default function SignInScreen() {
  const [raw, setRaw] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { isCoolingDown, cooldownText, triggerCooldown } = useAuthCooldown();
  const { user, phone: sessionPhone } = useSession();

  // If the auth-state check resolves AFTER the boot screen's own
  // AUTH_READY_TIMEOUT_MS already redirected here as logged-out (slow cold
  // start / poor network), route forward through the same post-auth
  // resolution `index.tsx` uses instead of stranding the user on this form.
  if (user && sessionPhone) return <Redirect href="/" />;

  async function onSubmit() {
    if (isCoolingDown) return;
    const phone = normalizePhoneIN(raw);
    if (!phone) {
      setError('Enter a valid 10-digit Indian mobile number.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await startPhoneAuth(phone);
      router.push({ pathname: '/(auth)/otp', params: { phone } });
    } catch (err) {
      const authError = err as { code?: string; message?: string };
      if (isRateLimitError(authError)) {
        triggerCooldown(5);
      }
      setError(mapAuthError(authError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <LinearGradient colors={[colors.primary, colors.primary600] as const} style={styles.hero}>
            <Text variant="h1" color={colors.white}>
              Zenter
            </Text>
            <Text variant="bodyMuted" color={colors.white} style={styles.heroSub}>
              Find your exam-centre aspirants.
            </Text>
          </LinearGradient>

          <View style={styles.form}>
            <Text variant="h2">Sign in</Text>
            <Text variant="bodyMuted" style={styles.lead}>
              Enter your mobile number and we&apos;ll text you a verification code.
            </Text>

            <Input
              label="Mobile number"
              prefix="+91"
              placeholder="10-digit number"
              keyboardType="number-pad"
              textContentType="telephoneNumber"
              autoComplete="tel"
              maxLength={10}
              value={raw}
              onChangeText={(t) => {
                setRaw(t.replace(/\D/g, ''));
                if (error) setError(null);
              }}
              error={error}
              accessibilityLabel="Indian mobile number, plus nine one"
              returnKeyType="go"
              onSubmitEditing={onSubmit}
              editable={!busy && !isCoolingDown}
            />

            <Button 
              title={isCoolingDown ? cooldownText : "Continue"} 
              size="lg" 
              block 
              busy={busy} 
              disabled={isCoolingDown}
              onPress={onSubmit} 
              style={styles.cta} 
            />

            {/* The two policies are the website's documents, shipped in-app
                (app/terms.tsx, app/community.tsx) — both are root stack screens,
                so they push fine from the logged-out auth stack. */}
            <Text variant="caption" style={styles.legal}>
              By continuing you agree to Zenter&apos;s{' '}
              <Text
                variant="caption"
                style={styles.legalLink}
                accessibilityRole="link"
                onPress={() => router.push('/terms')}
              >
                Terms and Conditions
              </Text>{' '}
              and{' '}
              <Text
                variant="caption"
                style={styles.legalLink}
                accessibilityRole="link"
                onPress={() => router.push('/community')}
              >
                Community Guidelines
              </Text>
              .
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  scroll: { flexGrow: 1 },
  hero: { paddingHorizontal: space[5], paddingVertical: space[7], gap: space[1], alignItems: 'flex-start' },
  heroSub: { opacity: 0.95 },
  form: { padding: space[5], gap: space[3] },
  lead: { marginBottom: space[1] },
  cta: { marginTop: space[2] },
  legal: { marginTop: space[2] },
  legalLink: { fontFamily: fonts.bodySemibold, color: colors.secondary, textDecorationLine: 'underline' },
});
