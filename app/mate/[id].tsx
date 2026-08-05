import { useMemo } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { colors, space, radius } from '@/theme';
import { Text, MateCard, EmptyState, AsyncBoundary } from '@/components';
import { useFeed } from '@/data/useFeed';
import { maskPhone } from '@/domain/masking';
import type { FeedItem } from '@/domain/matching';
import { toMateCardData } from '@/features/feed/enrich';
import { ConnectButton } from '@/features/connections/ConnectButton';
import { useBlockActions } from '@/features/safety/useBlockActions';
import { BlockButton } from '@/features/safety/BlockButton';

/**
 * Mate profile preview (Story 3.3) — presented as a bottom sheet (FR-34). A
 * read-only preview of one aspirant: the MateCard-style route timeline + badges,
 * the exam centre, and the MASKED phone with its reveal note (the single masking
 * module is the only place a number is formatted — AD-8/NFR-6). The connect CTA
 * slot is the shared {@link ConnectButton} (Epic 4 wires its behaviour).
 *
 * The row is read from the cached feed (`useFeed`, qk.feed) by id, so it resolves
 * both real and seeded aspirants (seeded users have no per-id table read) and
 * carries the same relationship tag the feed already computed.
 */
export default function MateProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading, isError, refetch } = useFeed();

  const user = useMemo<FeedItem | null>(
    () => (id ? (data ?? []).find((u) => u.id === id) ?? null : null),
    [data, id],
  );

  // Block flow (Story 8.1): blocking removes the aspirant from the feed and closes
  // the preview sheet.
  const { openBlock, blockSheet } = useBlockActions({ onBlocked: () => router.back() });

  return (
    <SafeAreaView style={styles.sheet} edges={['bottom']}>
      <View style={styles.grabber} />
      <AsyncBoundary<FeedItem[]>
        isLoading={isLoading}
        isError={isError}
        data={data}
        isEmpty={() => !user}
        onRetry={refetch}
        errorCopy="Could not load this profile"
        empty={
          <EmptyState
            emoji="👤"
            emojiLabel="profile"
            title="Profile unavailable"
            body="This aspirant is no longer in your feed."
          />
        }
      >
        {() => (
          <ProfileBody
            user={user!}
            onBlock={user?.__seeded ? () => {} : () => openBlock(user!.id, user!.full_name ?? undefined)}
          />
        )}
      </AsyncBoundary>
      {blockSheet}
    </SafeAreaView>
  );
}

function ProfileBody({ user, onBlock }: { user: FeedItem; onBlock: () => void }) {
  return (
    <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false} bounces={false}>
      {/* Route timeline + badges + travel/stay — read-only (no onPress/footer). */}
      <MateCard data={toMateCardData(user)} />

      {/* Masked contact — the hard invariant: number stays hidden until an
          accepted Contact Exchange (Epic 7). */}
      <View style={styles.contactCard}>
        <Text variant="caption">Contact</Text>
        <Text
          variant="h3"
          color={colors.text}
          accessibilityLabel="Phone number hidden until you connect"
        >
          {maskPhone(user.phone_last3)}
        </Text>
        <View style={styles.noteRow}>
          <Text accessibilityLabel="locked" style={styles.lock}>
            🔒
          </Text>
          <Text variant="small">Full number visible only after mutual connection.</Text>
        </View>
      </View>

      <View style={styles.cta}>
        <ConnectButton userId={user.id} rel={user.rel} block />
      </View>

      {/* Story 8.1: block-with-reason (also the report mechanism). Only for real
          users — seeded/demo profiles don't exist in the `users` table so their
          UUIDs would fail the blocked_users FK constraint. */}
      {!user.__seeded ? (
        <View style={styles.blockRow}>
          <BlockButton onPress={onBlock} />
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: colors.bg, paddingTop: space[2] },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, marginBottom: space[2] },
  body: { padding: space[4], gap: space[4] },
  detail: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: space[4],
    gap: space[1],
  },
  contactCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: space[4],
    gap: space[2],
  },
  noteRow: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  lock: { fontSize: 14 },
  cta: { marginTop: space[1] },
  blockRow: { alignItems: 'center', marginTop: space[1] },
});
