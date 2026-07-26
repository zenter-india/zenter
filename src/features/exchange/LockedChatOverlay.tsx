/**
 * Locked-chat paywall (Epic 7 / Story 7.1, FR-20). Rendered in place of the real
 * thread when a non-Plus member opens a conversation beyond their free-chat
 * limit. Shows a STATIC placeholder transcript (never the member's real
 * messages — the thread never even loads them, see `app/chat/[id].tsx`), a
 * gradient fade, and an upgrade CTA that points at the deferred "coming soon"
 * state. Ported from `js/chat.js` `openChat` locked branch.
 *
 * Analytics: `chat_locked_view` on open, `upgrade_cta_click` on the CTA (via
 * `useUpgradePrompt`) — the documented web event names.
 */
import { useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius, space, shadows, fonts } from '@/theme';
import { Text, Button, ChatBubble } from '@/components';
import { track } from '@/lib/observability';
import { useUpgradePrompt } from './useUpgradePrompt';

/** Decorative sample transcript (identical copy to the web locked placeholder). */
const PLACEHOLDER: { body: string; kind: 'sent' | 'received' }[] = [
  { body: 'Hey, are you also going to the Sion centre?', kind: 'received' },
  { body: 'Yes! Travelling by train, you?', kind: 'sent' },
  { body: 'Same! Shall we coordinate?', kind: 'received' },
  { body: "Sure, let's chat about stay too…", kind: 'sent' },
];

export function LockedChatOverlay({
  conversationId,
  freeLimit,
}: {
  conversationId: string;
  freeLimit: number;
}) {
  const onUpgrade = useUpgradePrompt('chat_locked');

  // Fire once per opened locked conversation.
  const trackedRef = useRef<string | null>(null);
  useEffect(() => {
    if (trackedRef.current === conversationId) return;
    trackedRef.current = conversationId;
    track('chat_locked_view', { conversation_id: conversationId });
  }, [conversationId]);

  return (
    <View style={styles.root}>
      {/* Decorative placeholder transcript — hidden from the screen reader. */}
      <ScrollView
        style={styles.transcript}
        contentContainerStyle={styles.transcriptContent}
        scrollEnabled={false}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {PLACEHOLDER.map((m, i) => (
          <ChatBubble key={i} body={m.body} kind={m.kind} />
        ))}
      </ScrollView>

      <LinearGradient
        colors={['transparent', colors.bg]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.lock} accessibilityLabel="Locked">
            🔒
          </Text>
          <Text variant="h3" style={styles.title}>
            Unlock this chat with Zenter Plus
          </Text>
          <Text variant="bodyMuted" style={styles.sub}>
            {`Free accounts can chat with up to ${freeLimit} centre ${
              freeLimit === 1 ? 'mate' : 'mates'
            }. Upgrade to Zenter Plus for unlimited chats and contact reveals.`}
          </Text>
          <Button
            title="Upgrade to Zenter Plus →"
            variant="primary"
            block
            onPress={onUpgrade}
            accessibilityLabel="Upgrade to Zenter Plus"
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  transcript: { flex: 1 },
  transcriptContent: { padding: space[4], gap: space[3] },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space[5],
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space[5],
    gap: space[3],
    alignItems: 'center',
    ...shadows.md,
  },
  lock: { fontSize: 40 },
  title: { textAlign: 'center' },
  sub: { textAlign: 'center', fontFamily: fonts.body },
});
