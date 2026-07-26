/**
 * Contact-exchange data access (Epic 5 / AD-8). Direct ports of the three live
 * functions in `js/supabase.js` that drive the in-chat contact handshake against
 * the `contact_exchange_requests` table. All resolve to {@link ApiResult} and
 * never throw — the hooks in `src/data/useExchange.ts` throw one layer up.
 *
 * The phone number is the ONLY personal detail gated behind this handshake, and
 * the reveal is symmetric: once `accepted`, BOTH the requester and the responder
 * see the *other* party's phone (AD-8). In the live web app the masking was a UI
 * concern (the phone was already client-side via `getUsersByIds`); here it is
 * enforced at the data layer — the phone is fetched ONLY when the exchange is
 * accepted, never for a pending/declined/absent one (hard invariant).
 */
import { supabase } from '@/api/client';
import { query, type ApiResult } from '@/api/result';

/**
 * Normalised lifecycle of a conversation's contact exchange. `'none'` means no
 * request has ever been made in this conversation; the other three mirror
 * `contact_exchange_requests.status` (pending | accepted | declined).
 */
export type ExchangeStatus = 'none' | 'pending' | 'accepted' | 'declined';

export interface ContactExchange {
  /** Latest request row id — required to respond. `null` when status is `'none'`. */
  exchangeId: string | null;
  status: ExchangeStatus;
  requesterId: string | null;
  responderId: string | null;
  /**
   * The *other* participant's phone, relative to `currentUserId`. Populated ONLY
   * when `status === 'accepted'` (symmetric reveal, AD-8); `null` otherwise.
   */
  otherPhone: string | null;
}

/** JSONB returned by the `respond_contact_exchange` RPC. */
export type ExchangeResponse =
  | {
      status: 'accepted';
      requester_phone: string;
      requester_name: string;
      responder_phone: string;
      responder_name: string;
    }
  | { status: 'declined' };

/** Row shape selected from `contact_exchange_requests` (snake_case from Postgres). */
interface ExchangeRow {
  id: string;
  requester_id: string;
  responder_id: string;
  status: 'pending' | 'accepted' | 'declined';
  responded_at: string | null;
  created_at: string;
}

/**
 * Request to exchange contact details inside a chat.
 * RPC `request_contact_exchange(p_conversation_id, p_requester_id) -> uuid` (request id).
 * The RPC also inserts a system message and bumps `conversations.updated_at`, and
 * raises `'A contact exchange request is already pending'` /
 * `'Contact has already been exchanged'` (surfaced verbatim as `error.message`).
 */
export function requestContactExchange(
  conversationId: string,
  requesterId: string,
): Promise<ApiResult<string>> {
  return query<string>(
    supabase.rpc('request_contact_exchange', {
      p_conversation_id: conversationId,
      p_requester_id: requesterId,
    }),
  );
}

/**
 * Respond to a contact exchange request (accept/decline).
 * RPC `respond_contact_exchange(p_request_id, p_responder_id, p_accept) -> jsonb`.
 * Accept → `{ status:'accepted', requester_phone, requester_name, responder_phone, responder_name }`;
 * decline → `{ status:'declined' }`. Both insert a system message. Raises
 * `'Request not found or already responded'` / `'Not authorized to respond to this request'`.
 */
export function respondContactExchange(
  exchangeId: string,
  userId: string,
  accept: boolean,
): Promise<ApiResult<ExchangeResponse>> {
  return query<ExchangeResponse>(
    supabase.rpc('respond_contact_exchange', {
      p_request_id: exchangeId,
      p_responder_id: userId,
      p_accept: accept,
    }),
  );
}

/**
 * Current contact-exchange state for a conversation, normalised for the UI.
 * Reads the latest `contact_exchange_requests` row (newest first, `.limit(1)`),
 * mirroring `getContactExchangeStatus` in `js/supabase.js`. When — and only when —
 * that row is `accepted`, additionally resolves the *other* participant's phone
 * relative to `currentUserId`. This is the sole path by which a phone number
 * crosses into the client; a pending/declined/absent exchange never yields one.
 */
export async function getContactExchangeStatus(
  conversationId: string,
  currentUserId: string,
): Promise<ApiResult<ContactExchange>> {
  const { data: row, error } = await query<ExchangeRow>(
    supabase
      .from('contact_exchange_requests')
      .select('id, requester_id, responder_id, status, responded_at, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  );
  if (error) return { data: null, error };

  if (!row) {
    return {
      data: { exchangeId: null, status: 'none', requesterId: null, responderId: null, otherPhone: null },
      error: null,
    };
  }

  const base: ContactExchange = {
    exchangeId: row.id,
    status: row.status,
    requesterId: row.requester_id,
    responderId: row.responder_id,
    otherPhone: null,
  };

  // Reveal the OTHER participant's phone only once the exchange is accepted.
  if (row.status !== 'accepted') return { data: base, error: null };

  const otherId = currentUserId === row.requester_id ? row.responder_id : row.requester_id;
  const { data: otherRow, error: otherErr } = await query<{ phone: string }>(
    supabase.from('users').select('phone').eq('id', otherId).maybeSingle(),
  );
  if (otherErr) return { data: null, error: otherErr };

  return { data: { ...base, otherPhone: otherRow?.phone ?? null }, error: null };
}
