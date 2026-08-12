import { useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, FlatList, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { colors, space } from '@/theme';
import { Badge, ChatBubble, EmptyState, AsyncBoundary, useToast } from '@/components';
import { useSession } from '@/stores/session';
import { useProfile } from '@/data/useProfile';
import { useUser } from '@/data/useUser';
import { useMyUserId } from '@/features/connections/useMyUserId';
import { useConversations } from '@/data/useConversations';
import { useConfig, CONFIG_DEFAULTS } from '@/data/useConfig';
import { useMessages, type ChatMessage } from '@/data/useMessages';
import { useTyping } from '@/data/useTyping';
import { ChatHeader } from '@/features/chat/ChatHeader';
import { Composer } from '@/features/chat/Composer';
import { TypingIndicator } from '@/features/chat/TypingIndicator';
import { formatClockTime } from '@/features/chat/time';
import { computeUnlockedConvIds, isConvLocked } from '@/features/exchange/freeChat';
import { ExchangeBanner } from '@/features/exchange/ExchangeBanner';
import { LockedChatOverlay } from '@/features/exchange/LockedChatOverlay';
import { useBlockActions } from '@/features/safety/useBlockActions';
import { BlockButton } from '@/features/safety/BlockButton';
import { track } from '@/lib/observability';

/**
 * Chat thread (Stories 5.2 + 5.3). Pushed screen with a custom header.
 *
 * - Loads the last 100 messages (`useMessages`), renders them in an inverted
 *   FlatList of ChatBubble (sent / received / centered system), and marks the
 *   conversation read on open (handled inside `useMessages`).
 * - Composer sends optimistically (2000-char cap) and, on send failure, restores
 *   the text back into the input (FR-17).
 * - Realtime receive + reconnect/foreground backfill are owned by `useMessages`;
 *   the typing indicator + broadcast by `useTyping` (FR-18/FR-17a). Both tear their
 *   channels down on unmount (NFR-3).
 * - The header reserves a right-hand slot for Contact Exchange (Epic 7) and Block
 *   (Epic 8); this screen wires neither.
 */
export default function ChatThread() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const conversationId = typeof id === 'string' ? id : undefined;

  const myUserId = useMyUserId();
  const { phone } = useSession();
  const meProfileQuery = useProfile(phone);
  const meProfile = meProfileQuery.data;
  const myName = meProfile?.full_name ?? 'You';

  // Resolve the counterpart from the cached conversation list (warm from the tab).
  const conns = useConversations(myUserId);
  const conv = useMemo(
    () => (conns.data ?? []).find((c) => c.id === conversationId),
    [conns.data, conversationId],
  );
  const otherId = conv ? (conv.user_a === myUserId ? conv.user_b : conv.user_a) : null;
  const otherName = useUser(otherId).data?.full_name ?? 'Aspirant';

  // Free-chat gate (Story 7.1). Compute the unlocked set from the SAME conversation
  // list + config + Plus status; a locked conversation never loads its real
  // messages (effectiveConvId is withheld) so the paywall can't leak content.
  // `gateReady` waits for the inputs to SETTLE (success or error) so a locked
  // chat's messages never load first; on any error we fall open (plusEnabled is
  // false without config), so a config hiccup never traps the member in a hang or
  // a false paywall.
  const config = useConfig();
  // Ready once every gate input has settled (success OR error). Falls open on
  // error, and does not wait on `conns` when there is no user id to load it with.
  const gateReady =
    (config.isSuccess || config.isError) &&
    (meProfileQuery.isSuccess || meProfileQuery.isError) &&
    (!myUserId || conns.isSuccess || conns.isError);
  // Only decide a lock once we actually hold the conversation list — otherwise a
  // stale/empty list would paywall a real chat.
  const haveConvList = conns.isSuccess;
  const freeLimit = config.data?.freeActiveChats ?? CONFIG_DEFAULTS.freeActiveChats;
  const unlocked = useMemo(
    () =>
      computeUnlockedConvIds(conns.data ?? [], {
        freeLimit,
        isPlus: !!meProfile?.plus_member,
        plusEnabled: !!config.data && config.data.plusEnabled,
      }),
    [conns.data, freeLimit, meProfile, config.data],
  );
  const locked =
    gateReady && haveConvList && !!conversationId ? isConvLocked(conversationId, unlocked) : false;
  const effectiveConvId = gateReady && !locked ? conversationId : undefined;

  const messages = useMessages(effectiveConvId, myUserId);
  const typing = useTyping(effectiveConvId, myUserId);
  const { show } = useToast();
  const insets = useSafeAreaInsets();

  // Block flow (Story 8.1): blocking the counterpart clears the connection and
  // pops back out of the now-blocked thread.
  const { openBlock, blockSheet } = useBlockActions({ onBlocked: () => router.back() });

  // History is oldest-first; the inverted list wants newest-first.
  const ordered = useMemo(() => [...(messages.data ?? [])].reverse(), [messages.data]);

  // Analytics: unlocked chats open (chat_opened); locked chats fire chat_locked_view
  // from LockedChatOverlay instead (matches the web early-return for locked chats).
  const openedRef = useRef(false);
  useEffect(() => {
    if (gateReady && !locked && conversationId && !openedRef.current) {
      openedRef.current = true;
      track('chat_opened', { conversation_id: conversationId });
    }
  }, [gateReady, locked, conversationId]);

  // Composer text is owned here so it can be restored if a send fails (FR-17).
  const [text, setText] = useState('');
  const pendingRef = useRef<string | null>(null);

  const onChangeText = (t: string) => {
    setText(t);
    typing.onInputChange(t);
  };

  const handleSend = () => {
    const body = text.trim();
    if (!body || messages.isSending) return;
    pendingRef.current = body;
    setText('');
    typing.stopTyping();
    messages.send(body);
    track('message_sent', { conversation_id: conversationId });
  };

  // Restore the failed text into the composer (only if the user hasn't retyped).
  useEffect(() => {
    if (messages.sendError && pendingRef.current) {
      const failed = pendingRef.current;
      pendingRef.current = null;
      setText((cur) => (cur.length ? cur : failed));
      messages.clearSendError();
      show('Message not sent. Check your connection and try again.', 'danger');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.sendError]);

  const nameForSystem = (senderId: string) => (senderId === myUserId ? myName : otherName);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ChatHeader
          name={otherName}
          onBack={() => router.back()}
          rightSlot={
            <>
              {locked ? <Badge label="🔒 Locked" variant="plus" /> : null}
              {/* Story 8.1: block the counterpart from the chat header slot. */}
              <BlockButton
                compact
                disabled={!otherId}
                onPress={() => {
                  if (otherId) openBlock(otherId, otherName);
                }}
              />
            </>
          }
        />

        {blockSheet}

        {locked ? (
          <LockedChatOverlay conversationId={conversationId as string} freeLimit={freeLimit} />
        ) : (
          <View style={styles.flex}>
            {conversationId ? <ExchangeBanner convId={conversationId} otherName={otherName} /> : null}

            <View style={styles.flex}>
              <AsyncBoundary<ChatMessage[]>
                isLoading={messages.isLoading || !gateReady}
                isError={messages.isError}
                error={messages.error}
                data={messages.data}
                isEmpty={(m) => m.length === 0}
                onRetry={messages.refetch}
                errorCopy="We couldn't load this conversation. Tap to retry."
                empty={
                  <View style={styles.emptyWrap}>
                    <EmptyState
                      emoji="👋"
                      emojiLabel="waving hand"
                      title="No messages yet"
                      body="Say hello to start the conversation!"
                    />
                  </View>
                }
              >
                {() => (
                  <FlatList
                    data={ordered}
                    inverted
                    keyExtractor={(m) => m._clientToken ?? m.id}
                    renderItem={({ item }) => (
                      <ChatBubble
                        body={item.body}
                        kind={
                          item.message_type === 'system'
                            ? 'system'
                            : item.sender_id === myUserId
                              ? 'sent'
                              : 'received'
                        }
                        time={item.message_type === 'system' ? undefined : formatClockTime(item.created_at)}
                        senderName={item.message_type === 'system' ? nameForSystem(item.sender_id) : undefined}
                      />
                    )}
                    style={styles.list}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    keyboardDismissMode="interactive"
                  />
                )}
              </AsyncBoundary>

              {typing.otherTyping ? <TypingIndicator name={otherName} /> : null}

              <View style={{ paddingBottom: insets.bottom, backgroundColor: colors.surface }}>
                <Composer
                  value={text}
                  onChangeText={onChangeText}
                  onSend={handleSend}
                  busy={messages.isSending}
                />
              </View>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  list: { flex: 1 },
  listContent: { paddingVertical: space[3] },
  emptyWrap: { flex: 1, justifyContent: 'center' },
});
