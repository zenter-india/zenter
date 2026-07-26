import { View, StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { colors, radius, fonts, shadows } from '@/theme';
import { Text } from './Text';

export type ChatBubbleProps = {
  body: string;
  kind: 'sent' | 'received' | 'system';
  time?: string;
  senderName?: string; // for system messages
};

export function ChatBubble({ body, kind, time, senderName }: ChatBubbleProps) {
  if (kind === 'system') {
    return (
      <Animated.View entering={FadeIn.duration(220)} style={styles.system}>
        <Text variant="caption" color={colors.text} style={styles.systemText}>
          {senderName ? `${senderName} ` : ''}{body}
        </Text>
      </Animated.View>
    );
  }
  const sent = kind === 'sent';
  return (
    <Animated.View entering={FadeInDown.springify().damping(22).mass(0.6)} style={[styles.row, sent ? styles.rowSent : styles.rowRecv]}>
      <View style={[styles.bubble, sent ? styles.sent : styles.recv]}>
        <Text style={[styles.body, { color: sent ? colors.white : colors.text }]}>{body}</Text>
        {time ? <Text style={[styles.time, { color: sent ? colors.sentBubbleTime : colors.textSubtle }]}>{time}</Text> : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', marginVertical: 3, paddingHorizontal: 12 },
  rowSent: { justifyContent: 'flex-end' },
  rowRecv: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '82%', paddingHorizontal: 15, paddingVertical: 11, ...shadows.xs },
  sent: { backgroundColor: colors.primary, borderRadius: radius.lg, borderTopRightRadius: 5 },
  recv: { backgroundColor: colors.surface2, borderRadius: radius.lg, borderTopLeftRadius: 5 },
  body: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
  time: { fontFamily: fonts.body, fontSize: 10, opacity: 0.7, marginTop: 3, textAlign: 'right' },
  system: { alignSelf: 'center', backgroundColor: colors.primary100, borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 6, marginVertical: 6, maxWidth: '90%' },
  systemText: { textAlign: 'center' },
});
