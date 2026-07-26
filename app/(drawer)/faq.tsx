import { ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '@/components';
import { colors, space } from '@/theme';

export default function FAQScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text variant="h2" style={styles.title}>Frequently Asked Questions</Text>
      
      <View style={styles.section}>
        <Text variant="h3">What is Zenter?</Text>
        <Text style={styles.paragraph}>
          Zenter helps you find and connect with other aspirants assigned to your exam centre.
        </Text>
      </View>

      <View style={styles.section}>
        <Text variant="h3">How many people can I chat with?</Text>
        <Text style={styles.paragraph}>
          You can accept up to 2 free connection requests. To connect with more aspirants, upgrade to Zenter Plus.
        </Text>
      </View>

      <View style={styles.section}>
        <Text variant="h3">Is my phone number shared?</Text>
        <Text style={styles.paragraph}>
          No, your phone number remains private until you explicitly choose to reveal it with a mutual connection.
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
