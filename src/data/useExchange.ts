/**
 * Contact-exchange hooks (Epic 5 / AD-8). Wraps `src/api/exchange` for the chat
 * screen: one query for the current handshake state and two mutations to drive it.
 *
 * "Who am I" resolves through `useProfile(useSession().phone)` — the session store
 * only carries the E.164 phone, so the FULL profile record maps it to the DB `id`
 * the exchange RPCs need, and also exposes `is_verified_aspirant`. The reveal is
 * symmetric: once accepted, both parties see the other's phone (surfaced by
 * `getContactExchangeStatus` as `otherPhone`, never before acceptance).
 *
 * The verification gate itself lives in the UI layer (Epic 7); `useExchange`
 * exposes `isVerified` so that layer can gate the "Request contact" action.
 *
 * Hooks throw on `error` (via `unwrap`) so react-query / AsyncBoundary surface
 * failures. Exchange is NOT optimistic in the web app, so mutations simply
 * invalidate on success (unlike connections / chat-send).
 */
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { qk } from '@/data/keys';
import { useSession } from '@/stores/session';
import { useProfile } from '@/data/useProfile';
import { unwrap } from '@/api/result';
import { track } from '@/lib/observability';
import {
  getContactExchangeStatus,
  requestContactExchange,
  respondContactExchange,
  type ContactExchange,
} from '@/api/exchange';

/** Invalidate everything a request/response touches: the handshake state, the
 *  chat transcript (the RPCs insert a system message), and the conversation list
 *  (its `updated_at` is bumped, changing sort order / unread signal). */
function invalidateAfterExchange(qc: QueryClient, convId: string, meId: string | undefined) {
  qc.invalidateQueries({ queryKey: qk.exchange(convId) });
  qc.invalidateQueries({ queryKey: qk.messages(convId) });
  if (meId) qc.invalidateQueries({ queryKey: qk.conversations(meId) });
}

/**
 * Current contact-exchange state for a conversation, plus whether the current
 * user is a verified aspirant. Disabled until both the conversation id and the
 * signed-in user's DB id are known (the id is needed to resolve `otherPhone`).
 * Spread onto AsyncBoundary as `{ isLoading, isError, error, data }`.
 */
export function useExchange(convId: string | null | undefined) {
  const { phone } = useSession();
  const me = useProfile(phone).data;
  const meId: string | undefined = me?.id;
  const isVerified = Boolean(me?.is_verified_aspirant);

  const query = useQuery<ContactExchange>({
    queryKey: qk.exchange(convId ?? ''),
    enabled: Boolean(convId) && Boolean(meId),
    queryFn: async () => {
      const data = unwrap(await getContactExchangeStatus(convId as string, meId as string));
      // getContactExchangeStatus always returns a normalised object on success.
      if (!data) throw new Error('Could not load contact status.');
      return data;
    },
  });

  return { ...query, isVerified };
}

/**
 * Request a contact exchange in `convId` (current user = requester). The UI must
 * gate this behind `useExchange(convId).isVerified` first (Epic 7).
 */
export function useRequestExchange(convId: string) {
  const qc = useQueryClient();
  const { phone } = useSession();
  const meId: string | undefined = useProfile(phone).data?.id;

  return useMutation({
    mutationFn: async () => {
      if (!meId) throw new Error('You need to be signed in to do that.');
      return unwrap(await requestContactExchange(convId, meId));
    },
    onSuccess: () => {
      track('contact_exchange_requested', { conversation_id: convId });
      invalidateAfterExchange(qc, convId, meId);
    },
  });
}

/**
 * Respond to a pending contact exchange in `convId` (current user = responder).
 * On accept, refetching `qk.exchange(convId)` yields the other party's phone.
 */
export function useRespondExchange(convId: string) {
  const qc = useQueryClient();
  const { phone } = useSession();
  const meId: string | undefined = useProfile(phone).data?.id;

  return useMutation({
    mutationFn: async ({ exchangeId, accept }: { exchangeId: string; accept: boolean }) => {
      if (!meId) throw new Error('You need to be signed in to do that.');
      return unwrap(await respondContactExchange(exchangeId, meId, accept));
    },
    onSuccess: (_data, { accept }) => {
      track(accept ? 'contact_exchange_accepted' : 'contact_exchange_declined', { conversation_id: convId });
      invalidateAfterExchange(qc, convId, meId);
    },
  });
}
