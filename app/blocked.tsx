/**
 * Blocked Users screen (Story 8.2, FR-28). Pushed over the tabs, reached from the
 * Profile "Privacy & account" card. Lists everyone the member has blocked with the
 * date and reason; unblocking removes the row and lets them reappear in the feed.
 *
 * Ports the web `/blocked-users.html` (`js/blocked-users.js`): rows resolve names
 * via `useCounterparts` (real + seeded fallback, "Unknown user" otherwise) and
 * unblock runs `useUnblock`, which clears the block row + any stale connection rows
 * and invalidates qk.feed / qk.connections / qk.blocked — so the list drops the row
 * and the Find Aspirants feed refetches the unblocked user back in on next focus.
 */
import { useMemo } from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors, space, radius } from '@/theme';
import { Text, Avatar, Button, EmptyState, AsyncBoundary, useToast } from '@/components';
import { useMyUserId } from '@/features/connections/useMyUserId';
import { useBlockedList, useUnblock } from '@/data/useBlocked';
import { useCounterparts } from '@/features/connections/useCounterparts';
import { ScreenHeader } from '@/features/profile/ScreenHeader';
import { FEED_ROUTE } from '@/features/auth/routing';
import type { BlockedListRow } from '@/api/blocked';
import type { FeedUser } from '@/types/user';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "12 Jul 2026" — Intl-free (Hermes) date, mirroring the web en-IN short date. */
function formatBlockedDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** Shared empty list — see the note at its use site in `BlockedScreen`. */
const EMPTY_ROWS: BlockedListRow[] = [];

export default function BlockedScreen() {
  const myUserId = useMyUserId();
  const q = useBlockedList(myUserId ?? undefined);

  // Stable identity while loading — a literal `?? []` would be a new array each
  // render and defeat the useMemo below.
  const rows = q.data ?? EMPTY_ROWS;
  const ids = useMemo(() => rows.map((r) => r.blocked_user_id), [rows]);
  const { data: byId } = useCounterparts(ids);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace(FEED_ROUTE));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Blocked users" onBack={goBack} />

      <View style={styles.listWrap}>
        <AsyncBoundary<BlockedListRow[]>
          isLoading={q.isLoading || !myUserId}
          isError={q.isError}
          error={q.error}
          data={q.data}
          isEmpty={(d) => d.length === 0}
          onRetry={q.refetch}
          errorCopy="We couldn't load your blocked users. Tap to retry."
          empty={
            <EmptyState
              emoji="🙌"
              emojiLabel="hands raised"
              title="No blocked users"
              body="You haven't blocked anyone yet."
            />
          }
        >
          {(list) => (
            <FlatList
              data={list}
              keyExtractor={(r) => r.id}
              renderItem={({ item }) => (
                <BlockedRow
                  row={item}
                  user={byId?.[item.blocked_user_id]}
                  myUserId={myUserId as string}
                />
              )}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />
          )}
        </AsyncBoundary>
      </View>
    </SafeAreaView>
  );
}

function BlockedRow({
  row,
  user,
  myUserId,
}: {
  row: BlockedListRow;
  user?: FeedUser;
  myUserId: string;
}) {
  const unblock = useUnblock();
  const { show } = useToast();
  const name = user?.full_name?.trim() || 'Unknown user';
  const reason = (row.reason || '').trim();

  const onUnblock = () => {
    unblock.mutate(
      { myId: myUserId, blockedId: row.blocked_user_id },
      {
        onSuccess: () => show('User unblocked — they can appear in Find Aspirants again.', 'success'),
        onError: (e) => show((e as Error)?.message || 'Could not unblock. Please try again.', 'danger'),
      },
    );
  };

  return (
    <View style={styles.row}>
      <Avatar name={name} size={44} />
      <View style={styles.rowText}>
        <Text variant="h3" numberOfLines={1}>
          {name}
        </Text>
        <Text variant="caption">{`Blocked ${formatBlockedDate(row.created_at)}`}</Text>
        {reason ? (
          <Text variant="small" color={colors.textSubtle} style={styles.reason} numberOfLines={2}>
            {`"${reason}"`}
          </Text>
        ) : null}
      </View>
      <Button
        title="Unblock"
        variant="ghost"
        size="sm"
        busy={unblock.isPending}
        onPress={onUnblock}
        accessibilityLabel={`Unblock ${name}`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  listWrap: { flex: 1 },
  listContent: { padding: space[4], gap: space[3], paddingBottom: space[7] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: space[4],
  },
  rowText: { flex: 1, gap: 2 },
  reason: { fontStyle: 'italic' },
});
