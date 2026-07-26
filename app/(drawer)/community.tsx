import { ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '@/components';
import { colors, space } from '@/theme';

export default function CommunityScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text variant="h2" style={styles.title}>Community Guidelines</Text>
      <Text style={styles.paragraph}>
        Zenter is a community of aspirants. We expect everyone to treat each other with respect.
      </Text>
      
      <View style={styles.section}>
        <Text variant="h3">1. Be Respectful</Text>
        <Text style={styles.paragraph}>
          No harassment, bullying, or hate speech. Treat fellow aspirants kindly.
        </Text>
      </View>

      <View style={styles.section}>
        <Text variant="h3">2. No Spam</Text>
        <Text style={styles.paragraph}>
          Do not use Zenter to promote unrelated products, services, or spam other users.
        </Text>
      </View>

      <View style={styles.section}>
        <Text variant="h3">3. Safety First</Text>
        <Text style={styles.paragraph}>
          Be careful when sharing personal information. Use the in-app chat before sharing phone numbers.
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
