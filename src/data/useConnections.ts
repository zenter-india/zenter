/**
 * Connections data layer + relationship projection (AD-2, AD-6).
 *
 * `useConnections(userId)` owns the single `qk.connections(userId)` query. The
 * relationship state (`relMap` / `relFor`) is DERIVED from that query via the
 * pure `domain/relationships` projection — never an independent client copy.
 * Feed cards, the Connections tab, and badges all read from this one source.
 *
 * The four mutations are optimistic (mirroring the web's optimistic connect):
 * they patch the connections cache immediately, roll back on error, and on
 * settle invalidate `qk.connections` + `qk.requests` + `qk.feed` so every
 * derived view reconciles with the server. There is NO cap on outgoing requests.
 */
import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { qk } from '@/data/keys';
import {
  getMyConnections,
  sendConnectionRequest,
  respondToRequest,
  deleteRequest,
  createConversation,
} from '@/api/connections';
import {
  hydrate,
  relFor as projectRelFor,
  type ConnectionRow,
  type RelEntry,
} from '@/domain/relationships';
import type { IncomingRequest } from '@/data/useRequests';
import { captureError } from '@/lib/observability';
import { EDGE_BASE } from '@/api/pushTokens';
import { env } from '@/lib/env';

/** Fire-and-forget push notify — never awaited, never blocks the UI action. */
function notifyPush(payload: Record<string, string>): void {
  fetch(`${EDGE_BASE}/send-push-notification`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: env.supabaseAnonKey },
    body: JSON.stringify(payload),
  }).catch((e) => {
    if (__DEV__) console.warn('[push] notify failed', e);
  });
}

// ─── Query + relationship projection ─────────────────────────────────────────

/**
 * All of my connection rows, plus the derived relationship map. `userId` is MY
 * user id (the app-wide handle is `phone`, but connections key on the resolved
 * user id). Throws inside the queryFn so AsyncBoundary surfaces load errors.
 */
export function useConnections(userId: string | null | undefined) {
  const query = useQuery({
    queryKey: qk.connections(userId ?? ''),
    enabled: !!userId,
    queryFn: async (): Promise<ConnectionRow[]> => {
      const { data, error } = await getMyConnections(userId as string);
      if (error) throw new Error(error.message);
      return (data ?? []) as ConnectionRow[];
    },
  });

  const relMap = useMemo(
    () => hydrate(query.data ?? [], userId ?? ''),
    [query.data, userId],
  );

  const relFor = useCallback(
    (otherUserId: string): RelEntry => projectRelFor(relMap, otherUserId),
    [relMap],
  );

  return { ...query, relMap, relFor };
}

// ─── Mutations (optimistic) ──────────────────────────────────────────────────

/** A short-lived client id for the optimistic pending row before the server id arrives. */
function tempConnectionId(): string {
  return `optimistic-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Shared cache-key bundle + invalidator for one user's relationship views. */
function useRelationshipKeys(userId: string) {
  const qc = useQueryClient();
  const connKey = qk.connections(userId);
  const reqKey = qk.requests(userId);

  const invalidate = useCallback(
    (extraConversations = false) => {
      qc.invalidateQueries({ queryKey: qk.connections(userId) });
      qc.invalidateQueries({ queryKey: qk.requests(userId) });
      qc.invalidateQueries({ queryKey: qk.feed(userId) });
      if (extraConversations) qc.invalidateQueries({ queryKey: qk.conversations(userId) });
    },
    [qc, userId],
  );

  return { qc, connKey, reqKey, invalidate };
}

/**
 * Send a connection request to `receiverId`. Optimistically inserts a pending
 * outgoing row (→ REL.PENDING_OUT on the target card). Rolls back on error.
 * No cap on outgoing requests.
 */
export function useSendRequest(userId: string) {
  const { qc, connKey, invalidate } = useRelationshipKeys(userId);

  return useMutation({
    mutationFn: async (receiverId: string) => {
      const { data, error } = await sendConnectionRequest(userId, receiverId);
      if (error) throw new Error(error.message);
      return data;
    },
    onMutate: async (receiverId: string) => {
      await qc.cancelQueries({ queryKey: connKey });
      const prevConns = qc.getQueryData<ConnectionRow[]>(connKey);
      const now = new Date().toISOString();
      const optimisticRow: ConnectionRow = {
        id: tempConnectionId(),
        sender_id: userId,
        receiver_id: receiverId,
        status: 'pending',
        created_at: now,
        updated_at: now,
      };
      qc.setQueryData<ConnectionRow[]>(connKey, (old) => [optimisticRow, ...(old ?? [])]);
      return { prevConns };
    },
    onError: (_err, _receiverId, ctx) => {
      if (ctx?.prevConns) qc.setQueryData(connKey, ctx.prevConns);
    },
    onSuccess: (data) => {
      if (data?.id) notifyPush({ type: 'connection_request', connection_id: data.id });
    },
    onSettled: () => invalidate(),
  });
}

/**
 * Withdraw a pending OUTGOING request. Optimistically drops the row (→ REL.NONE).
 */
export function useWithdraw(userId: string) {
  const { qc, connKey, invalidate } = useRelationshipKeys(userId);

  return useMutation({
    mutationFn: async (vars: { connectionId: string }) => {
      const { error } = await deleteRequest(vars.connectionId);
      if (error) throw new Error(error.message);
    },
    onMutate: async (vars: { connectionId: string }) => {
      await qc.cancelQueries({ queryKey: connKey });
      const prevConns = qc.getQueryData<ConnectionRow[]>(connKey);
      qc.setQueryData<ConnectionRow[]>(connKey, (old) =>
        (old ?? []).filter((r) => r.id !== vars.connectionId),
      );
      return { prevConns };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prevConns) qc.setQueryData(connKey, ctx.prevConns);
    },
    onSettled: () => invalidate(),
  });
}

/**
 * Accept an INCOMING request (→ REL.CONNECTED) and create the (idempotent)
 * conversation. Optimistically flips the row to accepted and removes it from the
 * incoming-requests list. Conversation creation is best-effort: if it fails the
 * accept still stands (the RPC is idempotent and re-runs when the chat opens).
 */
export function useAccept(userId: string) {
  const { qc, connKey, reqKey, invalidate } = useRelationshipKeys(userId);

  return useMutation({
    mutationFn: async (vars: { connectionId: string; otherUserId: string }) => {
      const { data, error } = await respondToRequest(vars.connectionId, 'accepted');
      if (error) throw new Error(error.message);
      const conv = await createConversation(vars.connectionId, userId, vars.otherUserId);
      if (conv.error) captureError(new Error(`createConversation failed: ${conv.error.message}`));
      return { connection: data, conversationId: conv.data };
    },
    onMutate: async (vars: { connectionId: string; otherUserId: string }) => {
      await Promise.all([
        qc.cancelQueries({ queryKey: connKey }),
        qc.cancelQueries({ queryKey: reqKey }),
      ]);
      const prevConns = qc.getQueryData<ConnectionRow[]>(connKey);
      const prevReqs = qc.getQueryData<IncomingRequest[]>(reqKey);
      const now = new Date().toISOString();
      qc.setQueryData<ConnectionRow[]>(connKey, (old) =>
        (old ?? []).map((r) =>
          r.id === vars.connectionId ? { ...r, status: 'accepted', updated_at: now } : r,
        ),
      );
      qc.setQueryData<IncomingRequest[]>(reqKey, (old) =>
        (old ?? []).filter((r) => r.connectionId !== vars.connectionId),
      );
      return { prevConns, prevReqs };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prevConns) qc.setQueryData(connKey, ctx.prevConns);
      if (ctx?.prevReqs) qc.setQueryData(reqKey, ctx.prevReqs);
    },
    onSuccess: (_result, vars) => {
      notifyPush({ type: 'connection_accepted', connection_id: vars.connectionId });
    },
    // Accept creates a conversation → also refresh the chat list.
    onSettled: () => invalidate(true),
  });
}

/**
 * Decline an INCOMING request (→ REL.REJECTED). Optimistically flips the row to
 * rejected and removes it from the incoming-requests list.
 */
export function useDecline(userId: string) {
  const { qc, connKey, reqKey, invalidate } = useRelationshipKeys(userId);

  return useMutation({
    mutationFn: async (vars: { connectionId: string }) => {
      const { error } = await respondToRequest(vars.connectionId, 'rejected');
      if (error) throw new Error(error.message);
    },
    onMutate: async (vars: { connectionId: string }) => {
      await Promise.all([
        qc.cancelQueries({ queryKey: connKey }),
        qc.cancelQueries({ queryKey: reqKey }),
      ]);
      const prevConns = qc.getQueryData<ConnectionRow[]>(connKey);
      const prevReqs = qc.getQueryData<IncomingRequest[]>(reqKey);
      const now = new Date().toISOString();
      qc.setQueryData<ConnectionRow[]>(connKey, (old) =>
        (old ?? []).map((r) =>
          r.id === vars.connectionId ? { ...r, status: 'rejected', updated_at: now } : r,
        ),
      );
      qc.setQueryData<IncomingRequest[]>(reqKey, (old) =>
        (old ?? []).filter((r) => r.connectionId !== vars.connectionId),
      );
      return { prevConns, prevReqs };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prevConns) qc.setQueryData(connKey, ctx.prevConns);
      if (ctx?.prevReqs) qc.setQueryData(reqKey, ctx.prevReqs);
    },
    onSettled: () => invalidate(),
  });
}
