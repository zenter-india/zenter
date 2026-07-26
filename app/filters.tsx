import { useMemo } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors, space } from '@/theme';
import { Text, Button } from '@/components';
import { useFeed } from '@/data/useFeed';
import { applyFeedFilters, groupByDistrict, type FeedItem } from '@/domain/matching';
import { isAdminRole, centreLabel } from '@/domain/gating';
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
 * `app/_layout.tsx`). Controls: gender, district/centre (CMS centres when the
 * member's exam is UPSC CMS), travel mode, and stay plan — feeding the pure
 * `applyFeedFilters` predicate via the shared filter store. Changes apply live,
 * and the primary button shows the live result count (AC: "results update with a
 * live count").
 *
 * The district/centre options are derived from the loaded feed (`groupByDistrict`)
 * so only centres that actually have aspirants appear, with the member's own
 * centre first and a count on each — mirroring the web district picker.
 */
const anyOption = (label: string): SelectOption => ({ value: '', label });

/** Shared empty feed — see the note at its use site in `Filters`. */
const EMPTY_FEED: FeedItem[] = [];

export default function Filters() {
  const { data, me } = useFeed();
  const filters = useFeedFilters();

  // Stable identity while the feed is loading. A literal `data ?? []` mints a
  // fresh array every render, which changes the deps of both useMemos below and
  // makes them recompute every time — the opposite of what they're for.
  const feed = data ?? EMPTY_FEED;
  const activeCount = activeFilterCount(filters);

  const centreNoun = centreLabel(me?.exam_type); // 'exam centre' | 'district'
  const centreTitle = centreNoun.charAt(0).toUpperCase() + centreNoun.slice(1);

  const districtOptions = useMemo<SelectOption[]>(() => {
    const myDistrict = isAdminRole(me?.role) ? null : me?.exam_centre_district ?? null;
    const groups = groupByDistrict(feed, myDistrict);
    return [
      anyOption(`Any ${centreNoun}`),
      ...groups.map((g) => ({ value: g.name, label: `${g.name} (${g.count})` })),
    ];
  }, [feed, me?.role, me?.exam_centre_district, centreNoun]);

  const genderOptions = useMemo<SelectOption[]>(() => [anyOption('Any gender'), ...GENDER_OPTIONS], []);
  const travelOptions = useMemo<SelectOption[]>(() => [anyOption('Any travel mode'), ...TRAVEL_OPTIONS], []);
  const stayOptions = useMemo<SelectOption[]>(() => [anyOption('Any stay plan'), ...STAY_OPTIONS], []);

  const resultCount = useMemo(
    () => applyFeedFilters(feed, toFeedPredicate(filters)).length,
    [feed, filters],
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
          label={centreTitle}
          placeholder={`Any ${centreNoun}`}
          value={filters.district ?? ''}
          options={districtOptions}
          onChange={(v) => feedFilters.set({ district: v })}
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
