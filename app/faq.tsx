/**
 * FAQ — the full 20-question set ported from the website's faq.html, including
 * the bulleted answers. Accordion behaviour matches web: opening one question
 * closes any other.
 */
import { useState } from 'react';
import { ScrollView, StyleSheet, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors, space, fonts, radius } from '@/theme';
import { Text } from '@/components';
import { ScreenHeader } from '@/features/profile/ScreenHeader';
import { RichText } from '@/features/legal/LegalDoc';

type Faq = {
  q: string;
  /** Lead paragraph. */
  a: string;
  /** Optional bullet list between the lead and the closing line. */
  items?: string[];
  /** Optional closing paragraph after the bullets. */
  after?: string;
};

const FAQS: Faq[] = [
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
    a: 'Users must verify their Indian mobile number using a One-Time Password (OTP) during registration. OTP verification confirms that the user has access to the submitted mobile number at the time of registration. However, OTP verification is **not identity verification**.',
  },
  {
    q: 'Does OTP verification guarantee that a user is genuine?',
    a: 'No. OTP verification does not guarantee:',
    items: [
      'Identity authenticity',
      'Character',
      'Trustworthiness',
      'Examination registration',
      'Examination attendance',
    ],
    after: 'Users must independently verify the identity and credentials of other users.',
  },
  {
    q: 'Is my phone number visible to everyone?',
    a: "No. Your phone number is not publicly displayed on the platform. Your number will only be shared according to the platform's approved connection process and privacy settings.",
  },
  {
    q: 'Who can view my phone number?',
    a: "Only users who have completed the platform's mutual connection process and permitted by your consent may gain access to your contact details.",
  },
  {
    q: 'What should I verify before traveling with another user?',
    a: 'Before making any travel or accommodation arrangement, you should verify:',
    items: [
      'Government-issued Photo ID',
      'Examination Hall Ticket / Admit Card',
      'Examination Registration Details',
      'Basic personal information',
    ],
    after: 'Never rely solely on profile information.',
  },
  {
    q: 'Does the platform verify hall tickets or examination registrations?',
    a: 'No. The platform does not verify:',
    items: ['Hall tickets', 'Admit cards', 'Examination registrations', 'Candidate eligibility'],
    after: 'Users must perform their own verification.',
  },
  {
    q: 'What if someone provides false information?',
    a: 'You should immediately report the account through our support channels. While we may investigate and take appropriate action, users remain responsible for conducting their own due diligence before entering into any arrangement.',
  },
  {
    q: 'What if I become a victim of fraud?',
    a: 'If you suspect fraud:',
    items: [
      'Stop communication immediately.',
      'Preserve all relevant evidence.',
      'Report the user to us.',
      'Contact local law enforcement authorities if necessary.',
    ],
    after:
      'The platform acts only as an intermediary and cannot recover losses arising from private arrangements between users.',
  },
  {
    q: 'Is Zenter responsible for disputes between users?',
    a: 'No. Any travel, accommodation, payment, or expense-sharing arrangement is a private agreement between users. Zenter is not responsible for disputes, losses, damages, or misconduct arising from such arrangements.',
  },
  {
    q: 'Does the platform charge users?',
    a: 'Registration and usage of the platform is free. However, a premium subscription is also available as Zenter Plus to unlock entire exam centre. Check [Zenter Plus](/plus) page to know more.',
  },
  {
    q: 'Can I delete my account?',
    a: 'Yes. You may request account deletion through your account settings or by contacting support. Certain records may be retained where required by law or for security and fraud-prevention purposes.',
  },
  {
    q: 'How is my personal information protected?',
    a: 'We use reasonable technical and organizational security measures to protect user information. However, no online platform can guarantee absolute security. Please refer to our [Privacy Policy](/privacy) for details.',
  },
  {
    q: 'Can I use the platform for commercial purposes?',
    a: 'No. The platform is intended solely for examination-related travel and accommodation coordination. Commercial solicitation, advertising, marketing, recruitment, and promotional activities are prohibited.',
  },
  {
    q: 'Can I report suspicious users?',
    a: 'Yes. We encourage users to report:',
    items: [
      'Fake profiles',
      'Fraud',
      'Harassment',
      'Spam',
      'Misleading information',
      'Suspicious behavior',
    ],
    after: 'Reports help us maintain platform integrity.',
  },
  {
    q: 'Does Zenter conduct background checks?',
    a: 'No. Zenter does not conduct:',
    items: [
      'Police verification',
      'Criminal background checks',
      'Identity verification beyond OTP authentication',
      'Character verification',
    ],
    after: 'Users should independently verify identities before meeting.',
  },
  {
    q: 'Is the platform responsible if something happens during travel?',
    a: "No. Zenter does not supervise or control any travel arrangements made between users. All travel and accommodation decisions are made voluntarily, at the user's own risk.",
  },
  {
    q: 'What examinations are supported?',
    a: 'The platform may be used for any legitimate examination, including:',
    items: [
      'All Medical Exams',
      'Government Recruitment Exams',
      'Banking Exams',
      'Railway Exams',
      'SSC Exams',
      'UPSC Exams',
      'State PSC Exams',
      'University Entrance Exams',
      'Other recognized examinations',
    ],
    after: 'Subject to platform policies and applicable law.',
  },
  {
    q: 'Why should I trust another user?',
    a: 'You should never rely solely on trust. Always:',
    items: [
      '✅ Verify Government ID',
      '✅ Verify Hall Ticket / Admit Card',
      '✅ Confirm examination details',
      '✅ Inform family or friends of your plans',
      '✅ Meet in safe public locations before travel',
    ],
    after:
      'The platform facilitates Co-ordinations, but users are responsible for their own safety and verification.',
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
          <Text variant="h2" style={{ marginBottom: space[2] }}>Frequently Asked Questions</Text>
          <Text variant="bodyMuted">Everything you need to know about Zenter.</Text>
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
                    <RichText text={faq.a} />
                    {faq.items ? (
                      <View style={styles.ul}>
                        {faq.items.map((it, j) => (
                          <View key={j} style={styles.li}>
                            <Text style={styles.bullet}>•</Text>
                            <RichText text={it} style={styles.liText} />
                          </View>
                        ))}
                      </View>
                    ) : null}
                    {faq.after ? <RichText text={faq.after} /> : null}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>

        <Pressable onPress={() => router.push('/contact')} accessibilityRole="link" style={styles.stillStuck}>
          <Text variant="caption">
            Still have questions? <Text style={styles.contactLink}>Contact us →</Text>
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: space[4], gap: space[4], paddingBottom: space[7] },
  headerArea: { marginBottom: space[1] },
  list: { gap: space[3] },
  item: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  itemOpen: { backgroundColor: colors.surface2 },
  question: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: space[4],
    gap: space[3],
  },
  num: { fontFamily: fonts.displayBold, fontSize: 16, color: colors.primary, minWidth: 24 },
  qText: { flex: 1, fontFamily: fonts.bodySemibold, fontSize: 16, color: colors.text, lineHeight: 22 },
  chevron: { fontSize: 18, color: colors.textMuted, marginTop: 2 },
  chevronOpen: { transform: [{ rotate: '180deg' }] },
  answer: {
    paddingHorizontal: space[4],
    paddingBottom: space[4],
    paddingLeft: space[4] + 24 + space[3],
    gap: space[2],
  },
  ul: { gap: 6 },
  li: { flexDirection: 'row', gap: space[2] },
  bullet: { fontFamily: fonts.body, fontSize: 14, lineHeight: 24, color: colors.primary },
  liText: { flex: 1 },
  stillStuck: { alignItems: 'center', paddingVertical: space[2] },
  contactLink: { fontFamily: fonts.bodySemibold, color: colors.primary },
});
