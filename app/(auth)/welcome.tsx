import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, space, fonts, radius } from '@/theme';
import { Text, Button, Icon, IconName } from '@/components';
import { useSession } from '@/stores/session';

const TRUST_POINTS: { icon: IconName; label: string }[] = [
  { icon: 'shield', label: 'Phone-verified, real students only' },
  { icon: 'lock', label: 'Numbers reveal on mutual consent' },
  { icon: 'calendar', label: 'Built for Exam 2026 and beyond' },
];

/**
 * Welcome / pitch screen — the mobile counterpart of the web login page's
 * marketing aside ("Find someone going to your exam centre." + trust bullets,
 * see login.html on `main`). Sits ahead of sign-in in the auth stack so the
 * pitch has its own screen instead of competing with the phone-entry form.
 */
export default function WelcomeScreen() {
  const { user, phone } = useSession();
  if (user && phone) return <Redirect href="/" />;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <LinearGradient colors={[colors.primary, colors.primary600] as const} style={styles.hero}>
        <Text variant="h1" color={colors.white} accessibilityLabel="Zenter">
          Zenter
        </Text>
        <Text variant="bodyMuted" color={colors.white} style={styles.heroSub}>
          Find your exam-centre aspirants.
        </Text>
      </LinearGradient>

      <View style={styles.body}>
        <Text variant="h2">Find someone going to your exam centre.</Text>
        <Text variant="bodyMuted" style={styles.pitch}>
          No more wasting your last week prep time, searching through random WhatsApp and
          Telegram groups with unverified users. Here at Zenter, we help you find the right
          people going to the same centre as you!
        </Text>

        <View style={styles.points}>
          {TRUST_POINTS.map((p) => (
            <View key={p.label} style={styles.point}>
              <View style={styles.pointIcon}>
                <Icon name={p.icon} size={18} color={colors.primary} />
              </View>
              <Text variant="body" style={styles.pointLabel}>
                {p.label}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.footer}>
        <Button title="Get started" size="lg" block onPress={() => router.push('/(auth)/sign-in')} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  hero: { paddingHorizontal: space[5], paddingVertical: space[7], gap: space[1], alignItems: 'flex-start' },
  heroSub: { opacity: 0.95 },
  body: { flex: 1, padding: space[5], gap: space[3] },
  pitch: { lineHeight: 22 },
  points: { gap: space[3], marginTop: space[2] },
  point: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  pointIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.primary100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pointLabel: { flex: 1, fontFamily: fonts.bodyMedium },
  footer: { padding: space[5], paddingTop: 0 },
});
