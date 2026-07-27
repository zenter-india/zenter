import { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, space } from '@/theme';
import { Button, MateCard, EmptyState, AsyncBoundary, Badge, TabHeader, type MateCardData } from '@/components';
import { useMyUserId } from '@/features/connections/useMyUserId';
import { useConnections } from '@/data/useConnections';
import { useConversations } from '@/data/useConversations';
import { useBlockedList } from '@/data/useBlocked';
import { useCounterparts } from '@/features/connections/useCounterparts';
import { goToChats } from '@/features/connections/nav';
import { toMateCardData } from '@/features/feed/enrich';
import { ExchangeCallButton } from '@/features/exchange/ExchangeCallButton';
import { useBlockActions } from '@/features/safety/useBlockActions';
import { BlockButton } from '@/features/safety/BlockButton';
import { storage, STORAGE_KEYS } from '@/lib/storage';
import { ProfileMenuButton } from '@/features/profile/ProfileMenuButton';
import type { ConnectionRow } from '@/domain/relationships';
import type { FeedUser } from '@/types/user';

type AcceptedConn = { connectionId: string; otherUserId: string };

/**
 * Connections tab (Story 4.3) — accepted connections, excluding anyone I've
 * blocked, with counterparts (real + seeded) resolved by id via `useCounterparts`.
 * Each row exposes "Open Chat"; Epic 7 slots the Contact-Exchange / Call action
 * in beside it (see the marked footer slot).
 *
 * "+N New" counts connections accepted since the member last opened this tab,
 * tracked device-locally (`STORAGE_KEYS.connectionsSeen`, per-user) — ported from
 * the web `hm.connections.seen.<id>` behaviour.
 */
export default function ConnectionsScreen() {
  const myUserId = useMyUserId();
  const conns = useConnections(myUserId);
  const blocked = useBlockedList(myUserId ?? undefined);

  const blockedIds = useMemo(
    () => new Set((blocked.data ?? []).map((b) => b.blocked_user_id)),
    [blocked.data],
  );

  const accepted = useMemo<AcceptedConn[]>(() => {
    const rows = (conns.data ?? []) as ConnectionRow[];
    return rows
      .filter((r) => r.status === 'accepted')
      .map((r) => ({
        connectionId: r.id,
        otherUserId: r.sender_id === myUserId ? r.receiver_id : r.sender_id,
      }))
      .filter((a) => !blockedIds.has(a.otherUserId));
  }, [conns.data, myUserId, blockedIds]);

  const counterpartIds = useMemo(() => accepted.map((a) => a.otherUserId), [accepted]);
  const { data: byId } = useCounterparts(counterpartIds);

  // Block flow (Story 8.1): one sheet for the whole list; blocking removes the
  // connection + the row reactively (useBlock invalidates qk.connections).
  const { openBlock, blockSheet } = useBlockActions();

  // Resolve each accepted connection's conversation id (exchange keys on the
  // conversation, Epic 7). Same warm cache the Chats tab uses.
  const convs = useConversations(myUserId);
  const convByConnId = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of convs.data ?? []) m.set(c.connection_id, c.id);
    return m;
  }, [convs.data]);

  // "+N New" since last seen (device-local, per-user). Marks all currently-accepted
  // ids as seen once shown, so the badge only appears the first time.
  const [newCount, setNewCount] = useState(0);
  useEffect(() => {
    if (!myUserId || conns.data === undefined) return;
    let alive = true;
    (async () => {
      const seen = (await storage.getJSON<string[]>(STORAGE_KEYS.connectionsSeen, myUserId)) ?? [];
      const seenSet = new Set(seen);
      const fresh = accepted.filter((a) => !seenSet.has(a.connectionId)).length;
      if (!alive) return;
      setNewCount(fresh);
      if (fresh > 0) {
        await storage.setJSON(
          STORAGE_KEYS.connectionsSeen,
          accepted.map((a) => a.connectionId),
          myUserId,
        );
      }
    })();
    return () => {
      alive = false;
    };
  }, [myUserId, conns.data, accepted]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <TabHeader
        title="Connections"
        titleBadge={newCount > 0 ? <Badge label={`+${newCount} New`} variant="success" /> : undefined}
        right={<ProfileMenuButton />}
      />

      <View style={styles.listWrap}>
        <AsyncBoundary<AcceptedConn[]>
          isLoading={conns.isLoading || !myUserId}
          isError={conns.isError}
          error={conns.error}
          data={accepted}
          isEmpty={(rows) => rows.length === 0}
          onRetry={conns.refetch}
          errorCopy="We couldn't load your connections. Tap to retry."
          empty={
            <EmptyState
              emoji="🤝"
              emojiLabel="handshake"
              title="No connections yet"
              body="Aspirants you connect with will appear here."
            />
          }
        >
          {(rows) => (
            <FlatList
              data={rows}
              keyExtractor={(a) => a.connectionId}
              renderItem={({ item }) => (
                <ConnectionListItem
                  conn={item}
                  user={byId?.[item.otherUserId]}
                  convId={convByConnId.get(item.connectionId) ?? null}
                  onBlock={() =>
                    openBlock(item.otherUserId, byId?.[item.otherUserId]?.full_name ?? undefined)
                  }
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

      {/* Story 8.1: single block sheet for the list. */}
      {blockSheet}
    </SafeAreaView>
  );
}

// Named ConnectionListItem, not ConnectionRow: the latter is the domain type
// imported above, and shadowing it made the two easy to confuse at a glance.
function ConnectionListItem({
  conn,
  user,
  convId,
  onBlock,
}: {
  conn: AcceptedConn;
  user?: FeedUser;
  convId: string | null;
  onBlock: () => void;
}) {
  const data: MateCardData = user ? toMateCardData(user) : { name: 'Aspirant' };
  return (
    <MateCard
      data={data}
      footer={
        <View style={styles.rowActions}>
          <Button
            title="Open Chat"
            icon="message-circle"
            accessibilityLabel="Open chat"
            variant="soft"
            size="sm"
            style={styles.actionBtn}
            onPress={goToChats}
          />
          {/* Epic 7: Contact-Exchange / Call renders beside Open Chat. */}
          <ExchangeCallButton convId={convId} otherName={user?.full_name ?? undefined} />
          {/* Story 8.1: block this connection — compact icon so the two primary
              actions get room (was cramping the row). */}
          <BlockButton compact onPress={onBlock} />
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  listWrap: { flex: 1 },
  listContent: { padding: space[4], gap: space[3], paddingBottom: space[7] },
  rowActions: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  actionBtn: { flex: 1 },
});
