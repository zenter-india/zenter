import { ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '@/components';
import { colors, space } from '@/theme';

export default function TermsScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text variant="h2" style={styles.title}>Terms & Conditions</Text>
      
      <View style={styles.section}>
        <Text style={styles.paragraph}>
          Last updated: July 2026
        </Text>
        <Text style={styles.paragraph}>
          By using Zenter, you agree to these terms. If you do not agree, please do not use the service.
        </Text>
      </View>

      <View style={styles.section}>
        <Text variant="h3">User Conduct</Text>
        <Text style={styles.paragraph}>
          You agree to use Zenter only for its intended purpose: finding and connecting with other aspirants assigned to your exam centre. You must not use the platform for commercial solicitation, spam, or harassment.
        </Text>
      </View>

      <View style={styles.section}>
        <Text variant="h3">Account Security</Text>
        <Text style={styles.paragraph}>
          You are responsible for maintaining the confidentiality of your OTPs and account access. Zenter is not liable for unauthorized access to your account.
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
