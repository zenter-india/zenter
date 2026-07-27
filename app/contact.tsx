import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import { colors, space, fonts } from '@/theme';
import { Text, Card, Button, useToast } from '@/components';
import { ScreenHeader } from '@/features/profile/ScreenHeader';

/** The web contact page's "Common issues" list, verbatim. */
const COMMON_ISSUES = [
  {
    lead: 'OTP not arriving?',
    body: 'Wait 30 seconds, then tap Resend. Check if your number has DND active.',
  },
  {
    lead: 'Entered the wrong number?',
    body: 'Tap "Change number" on the verification screen to go back.',
  },
  {
    lead: 'Profile not saving?',
    body: 'Check your internet connection and try again. All your data stays safe.',
  },
  {
    lead: 'Privacy concern?',
    body: 'Phone numbers are only revealed after both users accept a connection.',
  },
];

export default function ContactScreen() {
  const { show } = useToast();

  function openUrl(url: string) {
    Linking.openURL(url).catch(() => show('Could not open the link.', 'danger'));
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Contact Support" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerArea}>
          <Text variant="h1" style={{ marginBottom: space[2] }}>Need help?</Text>
          <Text variant="bodyMuted" style={{ textAlign: 'center' }}>
            Don&apos;t hesitate to reach out. We&apos;re here to help you get set up. Reach us by phone or email - real humans, not bots.
          </Text>
        </View>

        <Card style={styles.card}>
          <Text style={{ fontSize: 32, marginBottom: space[2] }}>📞</Text>
          <Text variant="h3">Call support</Text>
          <Text variant="bodyMuted" style={{ marginBottom: space[3] }}>
            Available Mon – Sat, 9 am – 6 pm IST. Fastest way to resolve OTP or login issues.
          </Text>
          <Button
            title="📞 +91 6363613007"
            onPress={() => openUrl('tel:+916363613007')}
            accessibilityLabel="Call support"
          />
        </Card>

        <Card style={styles.card}>
          <Text style={{ fontSize: 32, marginBottom: space[2] }}>✉️</Text>
          <Text variant="h3">Email support</Text>
          <Text variant="bodyMuted" style={{ marginBottom: space[3] }}>
            We reply within 24 hours. Great for onboarding, privacy, or connection questions.
          </Text>
          <Button
            title="✉️ support@zenter.in"
            variant="ghost"
            onPress={() => openUrl('mailto:support@zenter.in')}
            accessibilityLabel="Email support"
          />
        </Card>

        <Card style={[styles.card, { backgroundColor: colors.surface2, borderColor: 'transparent', marginTop: space[4] }]}>
          <Text variant="h3" style={{ marginBottom: space[2] }}>Common issues</Text>
          {COMMON_ISSUES.map((it, i) => (
            <View key={i} style={styles.issue}>
              <Text style={styles.bullet}>•</Text>
              <Text variant="bodyMuted" style={styles.issueText}>
                <Text style={styles.issueLead}>{it.lead}</Text> {it.body}
              </Text>
            </View>
          ))}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: space[4], gap: space[3], paddingBottom: space[7] },
  headerArea: { alignItems: 'center', marginBottom: space[4], paddingHorizontal: space[4] },
  card: { gap: space[2] },
  issue: { flexDirection: 'row', gap: space[2] },
  bullet: { fontFamily: fonts.body, fontSize: 15, lineHeight: 25, color: colors.primary },
  issueText: { flex: 1 },
  issueLead: { fontFamily: fonts.bodySemibold, color: colors.text },
});
