/**
 * Chat / realtime / typing backend surface (AD-1). Typed port of the LIVE chat
 * functions in `js/supabase.js` + `js/chat.js` — nothing dead is carried over
 * (no `subscribeToAllMessages`, no `canStartChat`, no `getUnreadCount` which the
 * web only ever returned 0 from). All Supabase I/O returns `{ data, error }`.
 *
 * Two concerns live here, clearly separated:
 *   1. Supabase reads/writes/RPC + realtime channels (the backend layer).
 *   2. Device-local chat read-state (AD-11) — there are NO server-side read
 *      receipts (mirrors `js/chat.js` `markAsRead`, which is a localStorage
 *      write). It is a tiny reactive store so a mark-read in one screen updates
 *      the unread badge in another without a refetch.
 */
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './client';
import { storage, STORAGE_KEYS } from '@/lib/storage';

// ─── Result contract (AD-1) ────────────────────────────────────────────────

export type ApiError = { code: string; message: string };
export type ApiResult<T> = { data: T | null; error: ApiError | null };

function toApiError(err: unknown, fallback = 'Something went wrong. Please try again.'): ApiError {
  const e = (err ?? {}) as { code?: string; message?: string; error_description?: string; hint?: string };
  return { code: e.code ?? 'unknown', message: e.message ?? e.error_description ?? e.hint ?? fallback };
}

/** Awaits a PostgREST/RPC builder and normalizes to `{ data, error }` — never throws. */
async function run<T>(builder: PromiseLike<{ data: T | null; error: unknown }>): Promise<ApiResult<T>> {
  try {
    const { data, error } = await builder;
    return { data: (data ?? null) as T | null, error: error ? toApiError(error) : null };
  } catch (err) {
    return { data: null, error: toApiError(err) };
  }
}

// ─── Domain types ──────────────────────────────────────────────────────────

export type MessageType = 'text' | 'system';

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  message_type: MessageType;
  created_at: string;
};

export type Conversation = {
  id: string;
  connection_id: string;
  user_a: string;
  user_b: string;
  is_active: boolean;
  updated_at: string;
  created_at: string;
};

export type TypingRow = {
  conversation_id: string;
  user_id: string;
  is_typing: boolean;
  updated_at: string;
};

/** The DB `messages.body` CHECK is 1..2000 chars — enforce the cap client-side. */
export const MESSAGE_MAX_LENGTH = 2000;

// ─── Conversations ─────────────────────────────────────────────────────────

/** All active conversations for a user, newest-updated first. Ports `getMyConversations`. */
export async function getMyConversations(userId: string): Promise<ApiResult<Conversation[]>> {
  return run<Conversation[]>(
    supabase
      .from('conversations')
      .select('id, connection_id, user_a, user_b, is_active, updated_at, created_at')
      .or(`user_a.eq.${userId},user_b.eq.${userId}`)
      .eq('is_active', true)
      .order('updated_at', { ascending: false }),
  );
}

// ─── Messages ──────────────────────────────────────────────────────────────

/**
 * The most recent `limit` messages for a conversation, returned oldest-first
 * (ready to render top-to-bottom). Queries newest-first + `limit` so a long
 * thread shows its live tail instead of stalling on the oldest 100 messages,
 * then reverses in memory. `before` pages further into the past from a given
 * timestamp — still newest-first under the hood, then reversed.
 */
export async function getMessages(
  conversationId: string,
  limit = 100,
  before: string | null = null,
): Promise<ApiResult<Message[]>> {
  let q = supabase
    .from('messages')
    .select('id, conversation_id, sender_id, body, message_type, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (before) q = q.lt('created_at', before);
  const result = await run<Message[]>(q);
  return result.data ? { ...result, data: [...result.data].reverse() } : result;
}

/**
 * Send a text message via the `send_message` SECURITY DEFINER RPC. Returns the
 * new message id. `p_sender_id` is caller-supplied (Firebase-auth model, AD-4).
 * The RPC validates the conversation is active and the sender is a participant,
 * then bumps `conversations.updated_at`. Body is capped to the DB CHECK limit.
 */
export async function sendMessage(
  conversationId: string,
  senderId: string,
  body: string,
): Promise<ApiResult<string>> {
  return run<string>(
    supabase.rpc('send_message', {
      p_conversation_id: conversationId,
      p_sender_id: senderId,
      p_body: body.slice(0, MESSAGE_MAX_LENGTH),
      p_message_type: 'text',
    }),
  );
}

// ─── Realtime ──────────────────────────────────────────────────────────────

/**
 * Subscribe to INSERTs on `messages` for one conversation — channel
 * `messages:{conversationId}` (ports `subscribeToMessages`). `onStatus` surfaces
 * channel-state changes so the data layer can backfill on reconnect (FR-17a).
 * Caller owns the channel: call `.unsubscribe()` on teardown.
 */
export function subscribeToMessages(
  conversationId: string,
  onMessage: (msg: Message) => void,
  onStatus?: (status: string) => void,
): RealtimeChannel {
  return supabase
    .channel(`messages:${conversationId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
      (payload) => onMessage(payload.new as Message),
    )
    .subscribe((status) => onStatus?.(String(status)));
}

/**
 * Upsert this user's typing flag into `typing_status` — channel-agnostic write
 * (ports `broadcastTyping`). Fire-and-forget from the UI's perspective; failures
 * are swallowed by the caller.
 */
export async function broadcastTyping(
  conversationId: string,
  userId: string,
  isTyping: boolean,
): Promise<ApiResult<null>> {
  return run<null>(
    supabase.from('typing_status').upsert(
      { conversation_id: conversationId, user_id: userId, is_typing: isTyping, updated_at: new Date().toISOString() },
      { onConflict: 'conversation_id,user_id' },
    ),
  );
}

/**
 * Subscribe to `typing_status` changes for a conversation — channel
 * `typing:{conversationId}` (ports `subscribeToTyping`, fixed to use the real
 * client). Emits every changed row; the caller ignores its own rows. Caller
 * owns the channel: call `.unsubscribe()` on teardown.
 */
export function subscribeToTyping(
  conversationId: string,
  onTyping: (row: TypingRow) => void,
): RealtimeChannel {
  return supabase
    .channel(`typing:${conversationId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'typing_status', filter: `conversation_id=eq.${conversationId}` },
      (payload) => {
        const row = payload.new as Partial<TypingRow> | undefined;
        if (row && row.user_id) onTyping(row as TypingRow);
      },
    )
    .subscribe();
}

// ─── Device-local read state (AD-11) — no server read receipts ──────────────
//
// A per-user map { conversationId -> ISO timestamp of last read }, persisted via
// the storage module and mirrored in a tiny reactive store so marking a chat
// read updates the Chats badge live (mirrors `js/chat.js` lastRead/localStorage).

export type LastReadMap = Record<string, string>;

const EMPTY_MAP: LastReadMap = Object.freeze({}) as LastReadMap;
const readStore: Record<string, LastReadMap> = {};
const readListeners = new Set<() => void>();
const hydrating: Record<string, Promise<void>> = {};

function emitRead(): void {
  for (const l of readListeners) l();
}

async function persistRead(userId: string): Promise<void> {
  await storage.setJSON(STORAGE_KEYS.chatLastRead, readStore[userId] ?? {}, userId);
}

/** Subscribe to read-state changes (for `useSyncExternalStore`). */
export function subscribeLastRead(listener: () => void): () => void {
  readListeners.add(listener);
  return () => {
    readListeners.delete(listener);
  };
}

/** Stable snapshot of a user's read map (same reference until it changes). */
export function lastReadSnapshot(userId: string | null | undefined): LastReadMap {
  if (!userId) return EMPTY_MAP;
  return readStore[userId] ?? EMPTY_MAP;
}

/** Load persisted read-state into memory once per user (idempotent, de-duped). */
export function hydrateLastRead(userId: string): Promise<void> {
  if (readStore[userId]) return Promise.resolve();
  const inflight = hydrating[userId];
  if (inflight) return inflight;
  const p = (async () => {
    const map = (await storage.getJSON<LastReadMap>(STORAGE_KEYS.chatLastRead, userId)) ?? {};
    if (!readStore[userId]) {
      readStore[userId] = map;
      emitRead();
    }
  })();
  hydrating[userId] = p;
  return p;
}

/** Mark a conversation read as of `at` (default now) and persist. */
export async function markConversationRead(
  userId: string,
  conversationId: string,
  at: string = new Date().toISOString(),
): Promise<void> {
  await hydrateLastRead(userId);
  const prev = readStore[userId] ?? {};
  readStore[userId] = { ...prev, [conversationId]: at };
  emitRead();
  await persistRead(userId);
}

/**
 * Seed a last-read entry for any conversation that has none, set to its current
 * `updated_at`. Mirrors `js/chat.js` first-load seeding so existing chats don't
 * all flash as unread the first time a device sees them.
 */
export async function seedLastReadMap(userId: string, conversations: Conversation[]): Promise<void> {
  await hydrateLastRead(userId);
  const prev = readStore[userId] ?? {};
  let next = prev;
  let changed = false;
  for (const c of conversations) {
    if (!next[c.id]) {
      if (!changed) {
        next = { ...prev };
        changed = true;
      }
      next[c.id] = c.updated_at;
    }
  }
  if (changed) {
    readStore[userId] = next;
    emitRead();
    await persistRead(userId);
  }
}

/**
 * Pure unread selector for one conversation. A conversation with no last-read
 * entry is treated as READ (it is seeded to `updated_at` on load), so only a
 * genuinely newer `updated_at` counts as unread.
 */
export function isConversationUnread(conv: Conversation, map: LastReadMap): boolean {
  const lastRead = map[conv.id];
  if (!lastRead) return false;
  return new Date(conv.updated_at).getTime() > new Date(lastRead).getTime();
}
