import { useMemo } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, space } from '@/theme';
import { MateCard, EmptyState, AsyncBoundary, TabHeader, type MateCardData } from '@/components';
import { useNavigation } from 'expo-router';
import { useMyUserId } from '@/features/connections/useMyUserId';
import { useVisibleRequests } from '@/features/connections/useVisibleRequests';
import { useCounterparts } from '@/features/connections/useCounterparts';
import { ConnectButton } from '@/features/connections/ConnectButton';
import { toMateCardData } from '@/features/feed/enrich';
import { REL, type RelEntry } from '@/domain/relationships';
import type { IncomingRequest } from '@/data/useRequests';
import type { FeedUser } from '@/types/user';
import { ProfileMenuButton } from '@/features/profile/ProfileMenuButton';

/**
 * Requests tab (Story 4.2) — incoming pending connection requests, excluding
 * senders I've blocked (`useVisibleRequests`). Each sender profile is resolved by
 * id (`useCounterparts`) and rendered as a MateCard whose footer reuses the shared
 * {@link ConnectButton} in its PENDING_IN form (Accept / Decline). Accept runs the
 * full flow (conversation + safety reminder + Chats) and optimistically removes
 * the row; decline marks it rejected — both reactive off qk.requests / qk.connections.
 *
 * The live tab badge is fed by `ConnectionsBadge` (mounted in the tab layout) from
 * the same computation, so it stays in sync without this screen being focused.
 */
export default function RequestsScreen() {
  const myUserId = useMyUserId();
  const navigation = useNavigation();
  const { visible, isLoading, isError, error, refetch, isRefetching } = useVisibleRequests(myUserId);

  const senderIds = useMemo(() => visible.map((r) => r.userId), [visible]);
  const { data: byId } = useCounterparts(senderIds);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <TabHeader
        title="Requests"
        onMenu={() => (navigation as any).getParent()?.openDrawer()}
        right={<ProfileMenuButton />}
      />

      <View style={styles.listWrap}>
        <AsyncBoundary<IncomingRequest[]>
          isLoading={isLoading || !myUserId}
          isError={isError}
          error={error}
          data={visible}
          isEmpty={(rows) => rows.length === 0}
          onRetry={refetch}
          errorCopy="We couldn't load your requests. Tap to retry."
          empty={
            <EmptyState
              emoji="📥"
              emojiLabel="inbox"
              title="No pending requests"
              body="Connection requests from other aspirants will appear here."
            />
          }
        >
          {(rows) => (
            <FlatList
              data={rows}
              keyExtractor={(r) => r.connectionId}
              renderItem={({ item }) => <RequestCard req={item} sender={byId?.[item.userId]} />}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={isRefetching}
                  onRefresh={refetch}
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

function RequestCard({ req, sender }: { req: IncomingRequest; sender?: FeedUser }) {
  const rel: RelEntry = { status: REL.PENDING_IN, role: 'receiver', connectionId: req.connectionId };
  const data: MateCardData = sender ? toMateCardData(sender) : { name: 'Aspirant' };
  return <MateCard data={data} footer={<ConnectButton userId={req.userId} rel={rel} />} />;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  listWrap: { flex: 1 },
  listContent: { padding: space[4], gap: space[3], paddingBottom: space[7] },
});
