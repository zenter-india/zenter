import { ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '@/components';
import { colors, space } from '@/theme';

export default function PrivacyScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text variant="h2" style={styles.title}>Privacy Policy</Text>
      
      <View style={styles.section}>
        <Text style={styles.paragraph}>
          Last updated: July 2026
        </Text>
        <Text style={styles.paragraph}>
          At Zenter, we take your privacy seriously. We only collect the information necessary to help you find and connect with other aspirants assigned to your exam centre.
        </Text>
      </View>

      <View style={styles.section}>
        <Text variant="h3">Information We Collect</Text>
        <Text style={styles.paragraph}>
          - Phone Number (Used for OTP login)
          - Exam Details (Exam Type, State, District, Centre)
          - Basic Profile Info (Name, Gender)
        </Text>
      </View>

      <View style={styles.section}>
        <Text variant="h3">How We Share Information</Text>
        <Text style={styles.paragraph}>
          Your phone number is strictly hidden by default. It is only revealed when you and a mutual connection explicitly choose to exchange contact information. Your exam centre and basic profile are visible to other aspirants in your district to facilitate connections.
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
