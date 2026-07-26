/**
 * Self-profile hooks (AD-2). `useProfile` owns qk.profile(phone) = the FULL self
 * record — it is fetched only via `getProfileByPhone` so a partial projection can
 * never overwrite it. `useUpdateProfile` writes through `upsertUser` and
 * invalidates both the profile and the status guard (qk.status).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { qk } from '@/data/keys';
import { getProfileByPhone, upsertUser, type UpsertUserPayload } from '@/api/users';
import { unwrap } from '@/api/result';

/** The FULL self record; `null` when no profile exists yet for the phone. */
export function useProfile(phone: string | null | undefined) {
  return useQuery({
    queryKey: qk.profile(phone ?? ''),
    queryFn: async () => unwrap(await getProfileByPhone(phone as string)),
    enabled: !!phone,
  });
}

/** Upsert the self profile, then refresh the profile + status caches. */
export function useUpdateProfile(phone: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: UpsertUserPayload) => unwrap(await upsertUser(payload)),
    onSuccess: () => {
      if (!phone) return;
      qc.invalidateQueries({ queryKey: qk.profile(phone) });
      qc.invalidateQueries({ queryKey: qk.status(phone) });
    },
  });
}
