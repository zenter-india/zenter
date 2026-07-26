import { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { colors, space, fonts, radius } from '@/theme';
import { Text, Button, useToast } from '@/components';
import { useSession } from '@/stores/session';
import { useProfile } from '@/data/useProfile';
import { submitFeedback } from '@/api/feedback';
import { TextInput } from 'react-native-gesture-handler';

export default function FeedbackScreen() {
  const { phone } = useSession();
  const { data: me } = useProfile(phone);
  const { show } = useToast();
  const [msg, setMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    const text = msg.trim();
    if (!text) {
      show('Please enter your feedback.', 'danger');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await submitFeedback({
        user_id: me?.id || null,
        user_name: me?.full_name || null,
        exam_type: me?.exam_type || null,
        feedback_message: text,
      });

      if (error) throw new Error(error.message);

      show('Thank you for your feedback! 😊', 'success');
      router.back();
    } catch {
      show('Something went wrong. Please try again.', 'danger');
      setIsSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text variant="h2">Send Feedback</Text>
          <Text variant="bodyMuted" style={{ marginTop: space[2] }}>
            Tell us what you love, what&apos;s broken, or what we should build next!
          </Text>
        </View>

        <TextInput
          style={styles.input}
          placeholder="I would love it if..."
          placeholderTextColor={colors.textMuted}
          multiline
          numberOfLines={6}
          textAlignVertical="top"
          value={msg}
          onChangeText={setMsg}
          autoFocus
        />

        <View style={styles.actions}>
          <Button
            title="Cancel"
            variant="ghost"
            onPress={() => router.back()}
            style={{ flex: 1 }}
          />
          <Button
            title="Submit"
            onPress={handleSubmit}
            busy={isSubmitting}
            style={{ flex: 1 }}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scroll: {
    padding: space[4],
  },
  header: {
    marginBottom: space[4],
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: space[3],
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.text,
    minHeight: 120,
    marginBottom: space[4],
  },
  actions: {
    flexDirection: 'row',
    gap: space[3],
  },
});
