import { useMemo } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useNavigation } from 'expo-router';
import { colors, space } from '@/theme';
import { EmptyState, AsyncBoundary, TabHeader } from '@/components';
import { useSession } from '@/stores/session';
import { useProfile } from '@/data/useProfile';
import { useMyUserId } from '@/features/connections/useMyUserId';
import { useCounterparts } from '@/features/connections/useCounterparts';
import { useConversations } from '@/data/useConversations';
import { useConfig, CONFIG_DEFAULTS } from '@/data/useConfig';
import { useLastRead } from '@/data/useUnread';
import { isConversationUnread, type Conversation } from '@/api/chat';
import { ChatListRow } from '@/features/chat/ChatListRow';
import { computeUnlockedConvIds, isConvLocked } from '@/features/exchange/freeChat';
import { FreeChatBanner } from '@/features/exchange/FreeChatBanner';
import { ProfileMenuButton } from '@/features/profile/ProfileMenuButton';

type Row = { conv: Conversation; otherId: string };

/**
 * Chats tab (Story 5.1) — active conversations with counterpart name, a preview,
 * and an unread dot. Unread comes from the single selector (`isConversationUnread`
 * over the device-local last-read store, AD-5/AD-11); the live tab badge is fed by
 * the headless `ChatsBadge` in the tab layout from the SAME source, so they agree.
 *
 * Counterparts (real, incl. seeded fallback) resolve by id via `useCounterparts`;
 * tapping a row pushes the thread screen `chat/[id]`.
 */
export default function ChatsScreen() {
  const myUserId = useMyUserId();
  const navigation = useNavigation();
  const conns = useConversations(myUserId);
  const lastRead = useLastRead(myUserId);

  // Free-chat gate (Story 7.1) — the same unlocked set the thread uses, so the
  // per-row lock and the opened thread agree.
  const { phone } = useSession();
  const meProfile = useProfile(phone).data;
  const config = useConfig();
  const unlocked = useMemo(
    () =>
      computeUnlockedConvIds(conns.data ?? [], {
        freeLimit: config.data?.freeActiveChats ?? CONFIG_DEFAULTS.freeActiveChats,
        isPlus: !!meProfile?.plus_member,
        // Fail open until config is known (no false lock badges before Plus status
        // and config load); same rule the thread enforces.
        plusEnabled: !!config.data && config.data.plusEnabled,
      }),
    [conns.data, config.data, meProfile],
  );

  const rows = useMemo<Row[]>(() => {
    const list = conns.data ?? [];
    return list.map((conv) => ({
      conv,
      otherId: conv.user_a === myUserId ? conv.user_b : conv.user_a,
    }));
  }, [conns.data, myUserId]);

  const otherIds = useMemo(() => rows.map((r) => r.otherId), [rows]);
  const { data: byId } = useCounterparts(otherIds);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <TabHeader
        title="Chats"
        onMenu={() => (navigation as any).getParent()?.openDrawer()}
        right={<ProfileMenuButton />}
      />

      <View style={styles.listWrap}>
        <AsyncBoundary<Row[]>
          isLoading={conns.isLoading || !myUserId}
          isError={conns.isError}
          error={conns.error}
          data={conns.data === undefined ? undefined : rows}
          isEmpty={(r) => r.length === 0}
          onRetry={conns.refetch}
          errorCopy="We couldn't load your chats. Tap to retry."
          empty={
            <EmptyState
              emoji="💬"
              emojiLabel="chat"
              title="No chats yet"
              body="Accept a connection to start chatting!"
            />
          }
        >
          {(r) => (
            <FlatList
              data={r}
              keyExtractor={(item) => item.conv.id}
              ListHeaderComponent={<FreeChatBanner userId={myUserId} />}
              renderItem={({ item }) => (
                <ChatListRow
                  conversationId={item.conv.id}
                  updatedAt={item.conv.updated_at}
                  unread={isConversationUnread(item.conv, lastRead)}
                  locked={isConvLocked(item.conv.id, unlocked)}
                  user={byId?.[item.otherId]}
                  onPress={() => router.push({ pathname: '/chat/[id]', params: { id: item.conv.id } })}
                />
              )}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={conns.isRefetching}
                  onRefresh={conns.refetch}
                  tintColor={colors.primary}
                  colors={[colors.primary]}
                />
              }
            />
          )}
        </AsyncBoundary>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  listWrap: { flex: 1 },
  listContent: { padding: space[4], gap: space[3], paddingBottom: space[7] },
});
