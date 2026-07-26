import { ScrollView, StyleSheet, View, Linking } from 'react-native';
import { Text, Button } from '@/components';
import { colors, space } from '@/theme';

export default function ContactScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text variant="h2" style={styles.title}>Contact Us</Text>
      
      <View style={styles.section}>
        <Text style={styles.paragraph}>
          Need help? Have questions about Zenter Plus or experiencing issues with the app? Our support team is here to help.
        </Text>
      </View>

      <View style={styles.section}>
        <Text variant="h3">Email Support</Text>
        <Text style={styles.paragraph}>
          Send us an email and we&apos;ll get back to you within 24 hours.
        </Text>
        <Button 
          title="support@zenter.in" 
          onPress={() => Linking.openURL('mailto:support@zenter.in')} 
          style={{ marginTop: space[3] }}
        />
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
