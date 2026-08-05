/**
 * useConfig — cached, parsed platform config (AD-2).
 *
 * Wraps getPlatformConfig() (raw platform_config rows) and derives the typed
 * accessors the app reads. Parsing rules are ported verbatim from how
 * js/dashboard.js loadData() reads the same keys:
 *   - freeActiveChats: `free_active_chats ?? free_reveal_limit ?? 2` (nullish
 *     coalesce, so an explicit 0 is preserved).
 *   - plusEnabled / seededVisible / seededCentreVisible: `value !== false`, i.e.
 *     default ON — only an explicit `false` disables them.
 *
 * Throws on error so AsyncBoundary / useQuery surface it (AD-12). Config is
 * near-static, so it is cached longer than the app default.
 */
import { useQuery } from '@tanstack/react-query';
import { qk } from './keys';
import { getPlatformConfig, type ConfigRow } from '@/api/config';
import { toPaymentProviderId, type PaymentProviderId } from '@/features/payments';

/** Parsed platform config consumed across the app. */
export interface AppConfig {
  /** Free-tier active-chat cap (Plus is unlimited). */
  freeActiveChats: number;
  /** Whether Plus gating is active at all. */
  plusEnabled: boolean;
  /** Whether seeded/demo profiles appear in the feed. */
  seededVisible: boolean;
  /** Whether the exam centre is shown on seeded profile cards. */
  seededCentreVisible: boolean;
  /**
   * Remote override for the Zenter Plus checkout gateway (`payment_provider`
   * key), or `null` when unset/unrecognized — `null` means "no override,"
   * letting `getPaymentProvider` (src/features/payments/index.ts) fall back
   * to this platform's required gateway (Apple IAP on iOS, Play Billing on
   * Android, Razorpay on web) rather than forcing one gateway everywhere.
   * Intended as an emergency kill-switch, not the normal path.
   */
  paymentProvider: PaymentProviderId | null;
}

/** Fallbacks used when a key is missing (matches the web defaults). */
export const CONFIG_DEFAULTS: AppConfig = {
  freeActiveChats: 2,
  plusEnabled: true,
  seededVisible: true,
  seededCentreVisible: true,
  paymentProvider: null,
};

/** Derive the typed config object from raw platform_config rows. */
export function parseConfig(rows: ConfigRow[] | null | undefined): AppConfig {
  const map = new Map<string, unknown>();
  for (const row of rows ?? []) {
    if (row && typeof row.key === 'string') map.set(row.key, row.value);
  }

  // free_active_chats, falling back to legacy free_reveal_limit, then 2.
  // `??` mirrors js/dashboard.js so an explicit 0 is kept, not defaulted.
  const freeRaw = map.get('free_active_chats') ?? map.get('free_reveal_limit') ?? CONFIG_DEFAULTS.freeActiveChats;
  const freeNum = Number(freeRaw);
  const freeActiveChats = Number.isFinite(freeNum) ? freeNum : CONFIG_DEFAULTS.freeActiveChats;

  // Boolean toggles default ON — only an explicit `false` turns them off.
  return {
    freeActiveChats,
    plusEnabled: map.get('plus_enabled') !== false,
    seededVisible: map.get('seeded_users_visible') !== false,
    seededCentreVisible: map.get('seeded_exam_centre_visible') !== false,
    // Unknown/absent stays null (no override) rather than forcing a gateway,
    // so a typo in platform_config can never override every platform's
    // correct default onto one gateway — see AppConfig.paymentProvider.
    paymentProvider: toPaymentProviderId(map.get('payment_provider')),
  };
}

/** React Query hook: the parsed platform config, cached under qk.config. */
export function useConfig() {
  return useQuery({
    queryKey: qk.config,
    staleTime: 5 * 60_000, // config is near-static; refetch rarely
    queryFn: async (): Promise<AppConfig> => {
      const { data, error } = await getPlatformConfig();
      if (error) throw new Error(error.message);
      return parseConfig(data);
    },
  });
}
