/**
 * Suspended lockout screen (Story 8.3, FR-30). Full-screen, non-dismissable: no
 * back affordance, Android hardware-back consumed, and the {@link SuspensionGate}
 * re-asserts this route if anything navigates away. Reached only via
 * `router.replace` from the gate / gated boot, so nothing authed sits behind it.
 *
 * Copy is ported verbatim (sic) from the web `checkSuspended` suspension overlay
 * (`js/utils.js`). The action buttons HARD-CODE the brand orange `colors.primary`
 * (`#FF6B35`) with no blue fallback — the web `var(--hm-primary, #2563eb)` fallback
 * bug must not reappear here (UX-DR7).
 */
import { useCallback } from 'react';
import { View, StyleSheet, Pressable, BackHandler } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import * as Linking from 'expo-linking';
import { colors, space, radius, fonts } from '@/theme';
import { Text } from '@/components';
import { logout } from '@/lib/auth';
import { SIGN_IN_ROUTE } from '@/features/auth/routing';

const SUPPORT_MAILTO = 'mailto:support@zenter.in';
// Brand orange, hard-coded — NEVER a blue fallback (UX-DR7).
const BRAND = colors.primary;

export default function SuspendedScreen() {
  // Consume Android hardware-back so the lockout cannot be dismissed (FR-30).
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
      return () => sub.remove();
    }, []),
  );

  const contactSupport = () => {
    Linking.openURL(SUPPORT_MAILTO).catch(() => {});
  };

  const signOut = async () => {
    await logout();
    if (router.canDismiss()) {
      router.dismissAll();
    }
    router.replace(SIGN_IN_ROUTE);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.center}>
        <Text style={styles.icon} accessibilityLabel="suspended">
          🚫
        </Text>
        <Text variant="h2" style={styles.centered}>
          Account Suspended
        </Text>
        <Text variant="bodyMuted" style={styles.centered}>
          Dear Aspirant, Our system has detected an suspicious activity that your actions violate the
          Community Guidelines.
        </Text>

        <Pressable
          onPress={contactSupport}
          accessibilityRole="button"
          accessibilityLabel="Contact support"
          style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
        >
          <Text style={styles.primaryBtnText}>Contact Support</Text>
        </Pressable>

        <Pressable
          onPress={signOut}
          accessibilityRole="button"
          accessibilityLabel="Sign out"
          hitSlop={8}
          style={({ pressed }) => [styles.signout, pressed && styles.pressed]}
        >
          <Text style={styles.signoutText}>Sign out</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space[5], gap: space[3] },
  icon: { fontSize: 48 },
  centered: { textAlign: 'center' },
  primaryBtn: {
    alignSelf: 'stretch',
    height: 52,
    backgroundColor: BRAND,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space[3],
  },
  primaryBtnText: { color: colors.white, fontFamily: fonts.bodySemibold, fontSize: 16 },
  signout: { marginTop: space[1], paddingVertical: space[2], paddingHorizontal: space[3] },
  signoutText: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  pressed: { opacity: 0.7 },
});
