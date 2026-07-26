import { useState } from 'react';
import { ScrollView, StyleSheet, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors, space, fonts, radius } from '@/theme';
import { Text } from '@/components';
import { ScreenHeader } from '@/features/profile/ScreenHeader';

const FAQS = [
  {
    q: 'What is Zenter?',
    a: 'Zenter is a platform that helps examination aspirants connect with other candidates attending the same examination so they can voluntarily coordinate and share travel and accommodation expenses.',
  },
  {
    q: 'Does Zenter arrange travel or accommodation?',
    a: 'No. We do not arrange, book, manage, supervise, or guarantee any travel, transportation, accommodation, or expense-sharing arrangements. We only provide a platform that helps users connect with one another.',
  },
  {
    q: 'How does OTP verification work?',
    a: 'Users must verify their Indian mobile number using a One-Time Password (OTP) during registration. OTP verification confirms that the user has access to the submitted mobile number at the time of registration. However, OTP verification is not identity verification.',
  },
  {
    q: 'How do I protect my privacy?',
    a: 'Your phone number is hidden by default. Only share it when you are comfortable, after accepting a connection request. We strongly advise users to exercise caution, use common sense, and verify the identity and reliability of any user before making travel plans.',
  },
  {
    q: 'Is there a fee to use Zenter?',
    a: 'Zenter offers a free tier as well as Zenter Plus, which unlocks unlimited requests and advanced filters for a small fee.',
  },
  {
    q: 'How do I report a user?',
    a: 'If someone violates our community guidelines, you can report them by opening their profile and tapping the "Block & Report" button at the bottom of the screen. Our team reviews all reports within 24 hours.',
  },
];

export default function FaqScreen() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggle = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="FAQ" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerArea}>
          <Text variant="h1" style={{ marginBottom: space[2] }}>Frequently Asked Questions</Text>
          <Text variant="bodyMuted" style={{ textAlign: 'center' }}>
            Everything you need to know about Zenter.
          </Text>
        </View>

        <View style={styles.list}>
          {FAQS.map((faq, i) => {
            const isOpen = openIndex === i;
            return (
              <View key={i} style={[styles.item, isOpen && styles.itemOpen]}>
                <Pressable
                  style={styles.question}
                  onPress={() => toggle(i)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: isOpen }}
                >
                  <Text style={styles.num}>{i + 1}.</Text>
                  <Text style={styles.qText}>{faq.q}</Text>
                  <Text style={[styles.chevron, isOpen && styles.chevronOpen]}>▾</Text>
                </Pressable>
                {isOpen ? (
                  <View style={styles.answer}>
                    <Text variant="bodyMuted">{faq.a}</Text>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: space[4], gap: space[4], paddingBottom: space[7] },
  headerArea: { alignItems: 'center', marginBottom: space[2], paddingHorizontal: space[2] },
  list: { gap: space[3] },
  item: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  itemOpen: {
    backgroundColor: colors.surface2,
  },
  question: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: space[4],
    gap: space[3],
  },
  num: {
    fontFamily: fonts.displayBold,
    fontSize: 16,
    color: colors.primary,
    minWidth: 24,
  },
  qText: {
    flex: 1,
    fontFamily: fonts.bodySemibold,
    fontSize: 16,
    color: colors.text,
    lineHeight: 22,
  },
  chevron: {
    fontSize: 18,
    color: colors.textMuted,
    marginTop: 2,
  },
  chevronOpen: {
    transform: [{ rotate: '180deg' }],
  },
  answer: {
    paddingHorizontal: space[4],
    paddingBottom: space[4],
    paddingLeft: space[4] + 24 + space[3],
  },
});
