import { useMemo } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { colors, space } from '@/theme';
import { Text, Button } from '@/components';
import { useFeed } from '@/data/useFeed';
import { applyFeedFilters, type FeedItem } from '@/domain/matching';
import { SelectField } from '@/features/onboarding/SelectField';
import {
  GENDER_OPTIONS,
  TRAVEL_OPTIONS,
  STAY_OPTIONS,
  type SelectOption,
} from '@/features/onboarding/options';
import {
  feedFilters,
  useFeedFilters,
  toFeedPredicate,
  activeFilterCount,
} from '@/features/feed/filtersStore';

/**
 * Filter sheet (Story 3.3). Presented as a bottom sheet (FR-34; registered in
 * `app/_layout.tsx`). Controls: gender, travel mode, and stay plan — feeding the
 * pure `applyFeedFilters` predicate via the shared filter store. Changes apply
 * live, and the primary button shows the live result count (AC: "results update
 * with a live count").
 *
 * There is deliberately NO district/centre control: the sheet is only reachable
 * from inside a district (the feed's grid → list drill-down), so the district is
 * already decided. The screen passes it in as a route param purely so the live
 * count matches the list behind the sheet.
 */
const anyOption = (label: string): SelectOption => ({ value: '', label });

/** Shared empty feed — see the note at its use site in `Filters`. */
const EMPTY_FEED: FeedItem[] = [];

export default function Filters() {
  const { data } = useFeed();
  const filters = useFeedFilters();
  // The district being browsed, handed over by the feed screen.
  const { district } = useLocalSearchParams<{ district?: string }>();

  // Stable identity while the feed is loading. A literal `data ?? []` mints a
  // fresh array every render, which changes the deps of both useMemos below and
  // makes them recompute every time — the opposite of what they're for.
  const feed = data ?? EMPTY_FEED;
  const activeCount = activeFilterCount(filters);

  const genderOptions = useMemo<SelectOption[]>(() => [anyOption('Any gender'), ...GENDER_OPTIONS], []);
  const travelOptions = useMemo<SelectOption[]>(() => [anyOption('Any travel mode'), ...TRAVEL_OPTIONS], []);
  const stayOptions = useMemo<SelectOption[]>(() => [anyOption('Any stay plan'), ...STAY_OPTIONS], []);

  const resultCount = useMemo(
    () => applyFeedFilters(feed, { ...toFeedPredicate(filters), district: district ?? null }).length,
    [feed, filters, district],
  );

  const showLabel = `Show ${resultCount} ${resultCount === 1 ? 'aspirant' : 'aspirants'}`;

  return (
    <SafeAreaView style={styles.sheet} edges={['bottom']}>
      <View style={styles.grabber} />

      <View style={styles.titleRow}>
        <Text variant="h2">Filters</Text>
        <Button
          title="Clear all"
          variant="ghost"
          size="sm"
          disabled={activeCount === 0}
          onPress={() => feedFilters.reset()}
        />
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} keyboardShouldPersistTaps="handled">
        <SelectField
          label="Gender"
          placeholder="Any gender"
          value={filters.gender ?? ''}
          options={genderOptions}
          onChange={(v) => feedFilters.set({ gender: v })}
        />
        <SelectField
          label="Travel mode"
          placeholder="Any travel mode"
          value={filters.travelMode ?? ''}
          options={travelOptions}
          onChange={(v) => feedFilters.set({ travelMode: v })}
        />
        <SelectField
          label="Stay plan"
          placeholder="Any stay plan"
          value={filters.stayPlan ?? ''}
          options={stayOptions}
          onChange={(v) => feedFilters.set({ stayPlan: v })}
        />
      </ScrollView>

      <View style={styles.footer}>
        <Button title={showLabel} block onPress={() => router.back()} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: colors.surface, paddingTop: space[2] },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, marginBottom: space[2] },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space[4],
    paddingBottom: space[2],
  },
  body: { flex: 1 },
  bodyContent: { padding: space[4], gap: space[4] },
  footer: {
    padding: space[4],
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
});
