import { useQuery } from '@tanstack/react-query';
import { qk } from '@/data/keys';
import { queryClient } from '@/data/queryClient';
import { useSession } from '@/stores/session';
import { getUserByPhone, getAllUsers, getSeededUsers } from '@/api/users';
import { getMyConnections } from '@/api/connections';
import { getBlockedUserIds, getBlockedByIds } from '@/api/blocked';
import { isAdminRole } from '@/domain/gating';
import { buildFeed, type FeedItem } from '@/domain/matching';
import { CONFIG_DEFAULTS, type AppConfig } from '@/data/useConfig';

/**
 * Feed composition hook (AD-2, AD-9). Two layered queries on the canonical keys:
 *   - `me` = the signed-in user's status record (`getUserByPhone`, qk.status) —
 *     carries `role` + exam-centre fields the matching needs. Shares the key
 *     with the root guard, so this dedupes against it.
 *   - the feed (qk.feed(myUserId)) fans out `getAllUsers` + `getSeededUsers` +
 *     `getMyConnections` + both block-sets in parallel, then runs the pure
 *     `buildFeed`.
 *
 * `examTypeForFeed` mirrors the web exactly: admins/superadmins pass `null`
 * (which `getAllUsers` treats as the NEET-UG + legacy-null scope, as in
 * production); everyone else passes their own exam type.
 *
 * Seeded-visibility comes from the parsed `AppConfig` cached under qk.config
 * (loaded app-wide by the root guard / `useConfig`, refreshed on foreground per
 * AD-10) — read here, not refetched, so the feed fan-out stays to the four
 * documented queries. It falls back to `CONFIG_DEFAULTS` (all visible) when
 * config has not yet loaded.
 *
 * Errors: the primary users fetch throws (surfaced by AsyncBoundary); the
 * secondary fetches (seeded, connections, block-sets) degrade to empty like the
 * web, so a transient failure never blanks the feed.
 */
export function useFeed() {
  const { phone } = useSession();

  const meQuery = useQuery({
    queryKey: qk.status(phone ?? ''),
    enabled: !!phone,
    queryFn: async () => {
      const { data, error } = await getUserByPhone(phone!);
      if (error) throw new Error(error.message);
      return data; // UserLookup | null
    },
  });

  const me = meQuery.data ?? null;
  const myUserId = me?.id ?? null;

  const feedQuery = useQuery({
    queryKey: qk.feed(myUserId ?? ''),
    enabled: !!myUserId,
    queryFn: async (): Promise<FeedItem[]> => {
      // Admins pass null → getAllUsers' NEET-UG + legacy-null scope (as in web).
      const examTypeForFeed = isAdminRole(me?.role) ? null : me?.exam_type ?? 'NEET UG';

      const [usersRes, seededRes, connsRes, blockedRes, blockedByRes] = await Promise.all([
        getAllUsers(examTypeForFeed),
        getSeededUsers(examTypeForFeed),
        getMyConnections(myUserId!),
        getBlockedUserIds(myUserId!),
        getBlockedByIds(myUserId!),
      ]);

      // Users is the critical fetch — surface its failure. The rest degrade.
      if (usersRes.error) throw new Error(usersRes.error.message);

      const cfg = queryClient.getQueryData<AppConfig>(qk.config) ?? CONFIG_DEFAULTS;

      return buildFeed({
        me,
        allUsers: usersRes.data ?? [],
        seededUsers: seededRes.data ?? [],
        myConnections: connsRes.data ?? [],
        blockedIds: (blockedRes.data ?? []).map((b) => b.blocked_user_id),
        blockedByIds: (blockedByRes.data ?? []).map((b) => b.blocker_user_id),
        config: { seededUsersVisible: cfg.seededVisible, seededCentreVisible: cfg.seededCentreVisible },
      });
    },
  });

  const refetch = async () => {
    await meQuery.refetch();
    await feedQuery.refetch();
  };

  return {
    /** Ordered, filtered, rel-tagged feed — undefined until loaded. */
    data: feedQuery.data,
    /** The signed-in user's status record (id, role, exam-centre fields). */
    me,
    myUserId,
    isLoading: meQuery.isLoading || feedQuery.isLoading,
    isError: meQuery.isError || feedQuery.isError,
    error: meQuery.error ?? feedQuery.error,
    isRefetching: feedQuery.isRefetching,
    refetch,
  };
}
