/**
 * Account-status hook (AD-2, AD-10). `useAccountStatus(phone)` derives the guard's
 * status summary from the FULL self record (qk.profile, via `getProfileByPhone`) —
 * the SAME authoritative, single-queryFn cache the root guard (`SuspensionGate`)
 * and `useMyUserId` already read. It deliberately does NOT own its own `qk.status`
 * key: `useFeed` writes `qk.status` with the raw `UserLookup` shape, so a second
 * writer with a `StatusSummary` shape there would corrupt whichever mounted last
 * (a security gate must never read a mis-shaped cache). Using `qk.profile` + a
 * per-observer `select` keeps this hook conflict-free and consistent everywhere.
 */
import { useQuery } from '@tanstack/react-query';
import { qk } from '@/data/keys';
import { getProfileByPhone } from '@/api/users';
import { unwrap } from '@/api/result';
import type { AccountStatus, ExamType } from '@/types/user';

/**
 * Guard-facing status summary. `accountStatus` + `suspensionWarning` drive the
 * suspension lockout / one-time restore warning (Epic 8); `id` is needed to ack
 * the warning (`dismiss_suspension_warning` takes the user id); `examType` +
 * `profileCompleted` drive exam-eligibility / onboarding routing.
 */
export type StatusSummary = {
  id: string | null;
  accountStatus: AccountStatus | null;
  suspensionWarning: boolean;
  appealSubmittedAt: string | null;
  examType: ExamType | null;
  profileCompleted: boolean;
};

export function useAccountStatus(phone: string | null | undefined) {
  return useQuery({
    queryKey: qk.profile(phone ?? ''),
    queryFn: async () => unwrap(await getProfileByPhone(phone as string)),
    enabled: !!phone,
    select: (row): StatusSummary => ({
      id: row?.id ?? null,
      accountStatus: row?.account_status ?? null,
      suspensionWarning: row?.suspension_warning === true,
      appealSubmittedAt: row?.appeal_submitted_at ?? null,
      examType: row?.exam_type ?? null,
      profileCompleted: row?.profile_completed === true,
    }),
  });
}
