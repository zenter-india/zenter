import { useMemo, useState, useCallback } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, router } from 'expo-router';
import { colors, space, radius, fonts, badgeVariants, shadows, avatarColor, avatarInitials } from '@/theme';
import { Text, Badge, EmptyState, AsyncBoundary, Icon, TabHeader } from '@/components';
import { useFeed } from '@/data/useFeed';
import { applyFeedFilters, groupByDistrict, type FeedItem, type DistrictGroup } from '@/domain/matching';
import { isLiveExam, examLabel, effectiveCentreState, centreLabel } from '@/domain/gating';
import {
  feedFilters,
  useFeedFilters,
  hasActiveFilters,
  activeFilterCount,
  toFeedPredicate,
} from '@/features/feed/filtersStore';
import { MateFeedCard } from '@/features/feed/MateFeedCard';
import { FreeChatBanner } from '@/features/exchange/FreeChatBanner';
import { PrivacyReassurance } from '@/features/feed/PrivacyReassurance';
import { ProfileMenuButton } from '@/features/profile/ProfileMenuButton';

/**
 * Find Aspirants (home tab) — Epic 3, updated for district-first browsing
 * (July 2026 web refresh). Two-view state:
 *
 * 1. **District grid** (`activeDistrict === null`): shows a grid of district
 *    cards with aspirant counts, the user's own district pinned first and
 *    visually distinguished. Mirrors the web `showDistrictView()`.
 *
 * 2. **Aspirant list** (`activeDistrict !== null`): the existing feed list,
 *    filtered to the selected district. The header shows a "← Districts"
 *    back button and the filter button. Mirrors web `showStudentsView(name)`.
 *
 * The domain logic (`groupByDistrict`, `applyFeedFilters`) was already ported
 * in `@/domain/matching`. This wires it into the UI.
 */
export default function FindScreen() {
  const { data, me, isLoading, isError, error, isRefetching, refetch } = useFeed();
  const filters = useFeedFilters();

  // District-first state: null = district grid, string = district aspirant list
  const [activeDistrict, setActiveDistrict] = useState<string | null>(null);

  const myDistrict = me?.exam_centre_district ?? null;
  const centreNoun = centreLabel(me?.exam_type);

  // All feed items with current non-district filters applied. `district` is
  // deliberately dropped here: this screen scopes by district via
  // `activeDistrict` (the grid selection) below, and applying both at once
  // means a filter-sheet district that differs from the drilled-in district
  // silently empties the list with no way to tell why.
  const allFiltered = useMemo(
    () => applyFeedFilters(data ?? [], { ...toFeedPredicate(filters), district: null }),
    [data, filters],
  );

  // District groups derived from the UNFILTERED feed. The grid has no filter
  // affordance (the Filters button only exists in the drilled-in list), so
  // deriving it from `allFiltered` let a filter set earlier silently delete
  // whole districts from the grid — a gender filter dropped Salem entirely,
  // with nothing on screen to explain why or to clear it.
  const districts = useMemo(
    () => groupByDistrict(data ?? [], myDistrict),
    [data, myDistrict],
  );

  // Aspirants in the selected district (with all filters including district)
  const districtFiltered = useMemo(() => {
    if (!activeDistrict) return allFiltered;
    return allFiltered.filter((u) => u.exam_centre_district === activeDistrict);
  }, [allFiltered, activeDistrict]);

  const anyActive = hasActiveFilters(filters);
  const activeCount = activeFilterCount(filters);

  const goBackToDistricts = useCallback(() => setActiveDistrict(null), []);

  // Story 3.1 — exam gate. Non-live exam types cannot reach the feed.
  if (me && !isLiveExam(me.exam_type ?? 'NEET UG')) {
    return <Redirect href="/maintenance" />;
  }

  const stateSuffix = (() => {
    const s = effectiveCentreState(me);
    return s ? ` in ${s}` : '';
  })();

  const countLabel = `${districtFiltered.length} ${districtFiltered.length === 1 ? 'Aspirant' : 'Aspirants'} found`;
  const showCount = !isLoading && !isError && data !== undefined && activeDistrict !== null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <TabHeader
        title={activeDistrict ? activeDistrict : 'Find Aspirants'}
        left={
          activeDistrict ? (
            <Pressable
              onPress={goBackToDistricts}
              accessibilityRole="button"
              accessibilityLabel="Back to districts"
              hitSlop={8}
              style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
            >
              <Icon name="chevron-left" size={26} color={colors.text} />
            </Pressable>
          ) : undefined
        }
        titleBadge={
          !activeDistrict && me?.exam_type ? <Badge label={examLabel(me.exam_type)} variant="info" /> : undefined
        }
        right={
          activeDistrict ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={activeCount ? `Filters, ${activeCount} active` : 'Filters'}
              // The sheet's live count must be scoped to the district being
              // browsed, otherwise it reports a state-wide total the list
              // behind it never shows.
              onPress={() => router.push({ pathname: '/filters', params: { district: activeDistrict } })}
              style={({ pressed }) => [styles.filterBtn, pressed && styles.pressed]}
            >
              <Icon name="sliders" size={15} color={colors.textMuted} />
              <Text variant="small" color={colors.text} style={styles.filterText}>
                Filters
              </Text>
              {activeCount ? (
                <View style={styles.dot}>
                  <Text style={styles.dotText}>{activeCount}</Text>
                </View>
              ) : null}
            </Pressable>
          ) : (
            <ProfileMenuButton />
          )
        }
      >
        {showCount ? (
          <Text variant="small" style={styles.count} accessibilityLiveRegion="polite">
            {countLabel}
          </Text>
        ) : null}

        {!activeDistrict && !isLoading && !isError && data !== undefined ? (
          <Text variant="small" style={styles.count}>
            {`${districts.length} ${centreNoun}${districts.length === 1 ? '' : 's'}${stateSuffix}`}
          </Text>
        ) : null}
      </TabHeader>

      <View style={styles.listWrap}>
        <PrivacyReassurance userId={me?.id} />
        <FreeChatBanner userId={me?.id} />
        <AsyncBoundary<FeedItem[]>
          isLoading={isLoading}
          isError={isError}
          error={error}
          data={data}
          isEmpty={() => (activeDistrict ? districtFiltered.length === 0 : districts.length === 0)}
          onRetry={refetch}
          errorCopy="Could not load aspirants"
          empty={
            activeDistrict ? (
              anyActive ? (
                <EmptyState
                  emoji="🔍"
                  emojiLabel="search"
                  title="No centre mates found"
                  body="No aspirants match your filters. Try widening them."
                  ctaTitle="Clear filters"
                  onCta={() => feedFilters.reset()}
                />
              ) : (
                <EmptyState
                  emoji="🏛️"
                  emojiLabel="landmark"
                  title="No mates yet"
                  body={`Be the first aspirant in ${activeDistrict} on Zenter.`}
                />
              )
            ) : (
              <EmptyState
                emoji="🏛️"
                emojiLabel="landmark"
                title="No mates yet"
                body={`Be the first aspirant${stateSuffix} on Zenter.`}
              />
            )
          }
        >
          {() =>
            activeDistrict ? (
              /* ── Aspirant list ── */
              <FlatList
                key="aspirant-list"
                data={districtFiltered}
                keyExtractor={(u) => u.id}
                renderItem={({ item }) => <MateFeedCard item={item} />}
                style={styles.list}
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
            ) : (
              /* ── District card grid ── */
              <FlatList
                key="district-grid"
                data={districts}
                keyExtractor={(d) => d.name}
                numColumns={2}
                columnWrapperStyle={styles.gridRow}
                renderItem={({ item }) => (
                  <DistrictCard
                    group={item}
                    isMine={item.name === myDistrict}
                    centreNoun={centreNoun}
                    onPress={() => setActiveDistrict(item.name)}
                  />
                )}
                style={styles.list}
                contentContainerStyle={styles.gridContent}
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
            )
          }
        </AsyncBoundary>
      </View>
    </SafeAreaView>
  );
}

// ─── District card ────────────────────────────────────────────────────────────

function DistrictCard({
  group,
  isMine,
  centreNoun,
  onPress,
}: {
  group: DistrictGroup;
  isMine: boolean;
  centreNoun: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${group.name}, ${group.count} aspirants`}
      style={({ pressed }) => [
        styles.districtCard,
        isMine && styles.districtCardMine,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.districtCardTop}>
        <View style={[styles.districtAvatar, { backgroundColor: avatarColor(group.name) }]}>
          <Text style={styles.districtAvatarText}>{avatarInitials(group.name)}</Text>
        </View>
        <Icon name="chevron-right" size={16} color={colors.textSubtle} />
      </View>
      <Text style={styles.districtName} numberOfLines={2}>
        {group.name}
      </Text>
      <Text style={styles.districtCount}>
        {group.count} {group.count === 1 ? 'aspirant' : 'aspirants'}
      </Text>
      {isMine && (
        <View style={styles.mineBadge}>
          <Text style={styles.mineBadgeText}>✓ Your {centreNoun}</Text>
        </View>
      )}
    </Pressable>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  backBtn: { width: 32, height: 44, alignItems: 'center', justifyContent: 'center' },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
    minHeight: 44,
    paddingHorizontal: space[3],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pressed: { opacity: 0.7 },
  filterText: { fontFamily: fonts.bodySemibold },
  dot: {
    minWidth: 18,
    height: 18,
    borderRadius: radius.full,
    paddingHorizontal: 5,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotText: { color: colors.white, fontFamily: fonts.bodyBold, fontSize: 11 },
  count: { color: colors.textMuted },
  listWrap: { flex: 1 },
  list: { flex: 1 },
  listContent: { padding: space[4], gap: space[3], paddingBottom: space[7] },

  // District grid
  gridContent: { padding: space[4], paddingBottom: space[7] },
  gridRow: { gap: space[3], marginBottom: space[3] },
  districtCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space[4],
    gap: space[1],
    minHeight: 100,
    ...shadows.sm,
  },
  districtCardMine: {
    borderColor: colors.primary,
    borderWidth: 2,
    backgroundColor: colors.warmTint,
  },
  districtCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space[1],
  },
  districtAvatar: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  districtAvatarText: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.white,
  },
  districtName: {
    fontFamily: fonts.displayBold,
    fontSize: 16,
    color: colors.text,
  },
  districtCount: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textMuted,
  },
  mineBadge: {
    marginTop: space[1],
    backgroundColor: badgeVariants.plus.bg,
    borderColor: badgeVariants.plus.border,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: space[2],
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  mineBadgeText: {
    fontFamily: fonts.bodySemibold,
    fontSize: 10,
    color: badgeVariants.plus.fg,
  },
});
