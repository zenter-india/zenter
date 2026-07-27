/**
 * Renderer for the long-form policy pages ported from the website
 * (community.html, terms.html, privacy.html, refund-policy.html).
 *
 * Those pages are plain prose — headings, paragraphs, bullet lists and rules —
 * so rather than transcribing four ~300-line screens as JSX, each document is
 * data (see ./documents) and this module renders it. Text supports a tiny
 * inline markup so the source reads close to the HTML it came from:
 *
 *   **bold**            → semibold run
 *   [label](target)     → tappable link; `/route` pushes in-app, anything else
 *                         (mailto:, https:) opens externally.
 */
import { Fragment } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import { colors, space, fonts, radius } from '@/theme';
import { Text, Card, useToast } from '@/components';
import { ScreenHeader } from '@/features/profile/ScreenHeader';

export type LegalBlock =
  | { t: 'p'; text: string }
  | { t: 'h2'; text: string }
  | { t: 'h3'; text: string }
  | { t: 'ul'; items: string[] }
  | { t: 'hr' };

export type LegalDocument = {
  /** Shown in the nav bar — keep short. */
  navTitle: string;
  /** Page heading. */
  title: string;
  effective?: string;
  updated?: string;
  blocks: LegalBlock[];
};

/** `**bold**` and `[label](target)`, in one pass. Built per call — a shared
 *  /g regex carries `lastIndex` between renders and would skip matches. */
const token = () => /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)]+)\)/g;

/** Inline `**bold**` / `[label](target)` runs. Exported so the FAQ can reuse it. */
export function RichText({ text, style }: { text: string; style?: object }) {
  const { show } = useToast();

  function open(target: string) {
    if (target.startsWith('/')) {
      router.push(target as never);
      return;
    }
    Linking.openURL(target).catch(() => show('Could not open the link.', 'danger'));
  }

  const runs: React.ReactNode[] = [];
  const re = token();
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) runs.push(<Fragment key={`t${last}`}>{text.slice(last, m.index)}</Fragment>);
    if (m[1] != null) {
      runs.push(
        <Text key={`b${m.index}`} style={styles.bold}>
          {m[1]}
        </Text>,
      );
    } else {
      const label = m[2]!;
      const target = m[3]!;
      runs.push(
        <Text key={`l${m.index}`} style={styles.link} onPress={() => open(target)} accessibilityRole="link">
          {label}
        </Text>,
      );
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) runs.push(<Fragment key={`t${last}`}>{text.slice(last)}</Fragment>);

  return <Text style={[styles.body, style]}>{runs}</Text>;
}

export function LegalDoc({ doc }: { doc: LegalDocument }) {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title={doc.navTitle} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View>
          <Text variant="h2" style={styles.title}>
            {doc.title}
          </Text>
          {doc.effective ? <Text variant="caption">Effective Date: {doc.effective}</Text> : null}
          {doc.updated ? <Text variant="caption">Last Updated: {doc.updated}</Text> : null}
        </View>

        <Card style={styles.card}>
          {doc.blocks.map((b, i) => {
            switch (b.t) {
              case 'h2':
                return (
                  <Text key={i} style={styles.h2}>
                    {b.text}
                  </Text>
                );
              case 'h3':
                return (
                  <Text key={i} style={styles.h3}>
                    {b.text}
                  </Text>
                );
              case 'hr':
                return <View key={i} style={styles.hr} />;
              case 'ul':
                return (
                  <View key={i} style={styles.ul}>
                    {b.items.map((it, j) => (
                      <View key={j} style={styles.li}>
                        <Text style={styles.bullet}>•</Text>
                        <RichText text={it} style={styles.liText} />
                      </View>
                    ))}
                  </View>
                );
              default:
                return <RichText key={i} text={b.text} />;
            }
          })}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: space[4], gap: space[3], paddingBottom: space[7] },
  title: { marginBottom: space[2] },
  card: { gap: space[3] },
  body: { fontFamily: fonts.body, fontSize: 14, lineHeight: 24, color: colors.textMuted },
  bold: { fontFamily: fonts.bodySemibold, color: colors.text },
  link: { fontFamily: fonts.bodySemibold, color: colors.primary },
  h2: { fontFamily: fonts.displayBold, fontSize: 17, lineHeight: 24, color: colors.text, marginTop: space[2] },
  h3: { fontFamily: fonts.bodySemibold, fontSize: 15, lineHeight: 22, color: colors.text, marginTop: space[1] },
  hr: { height: 1, backgroundColor: colors.border, marginVertical: space[2], borderRadius: radius.sm },
  ul: { gap: 6 },
  li: { flexDirection: 'row', gap: space[2], paddingRight: space[2] },
  bullet: { fontFamily: fonts.body, fontSize: 14, lineHeight: 24, color: colors.primary },
  liText: { flex: 1 },
});
