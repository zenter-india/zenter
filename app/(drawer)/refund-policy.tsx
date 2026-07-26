import { ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '@/components';
import { colors, space } from '@/theme';

export default function RefundPolicyScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text variant="h2" style={styles.title}>Refund Policy</Text>
      
      <View style={styles.section}>
        <Text variant="h3">Zenter Plus Subscriptions</Text>
        <Text style={styles.paragraph}>
          Zenter Plus is a digital service that is activated immediately upon purchase. Because the service (unlimited chats and contact reveals) is delivered instantly, we generally do not offer refunds once a purchase is made.
        </Text>
      </View>

      <View style={styles.section}>
        <Text variant="h3">Exceptions</Text>
        <Text style={styles.paragraph}>
          Refunds may be granted on a case-by-case basis if there is a technical error resulting in a duplicate charge, or if the service was completely unavailable due to extended downtime on our end. Please contact support@zenter.in within 7 days for review.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space[4], paddingBottom: space[8] },
  title: { marginBottom: space[4], color: colors.primary },
  section: { marginTop: space[4] },
  paragraph: { marginTop: space[2], color: colors.textMuted, lineHeight: 22 },
});
