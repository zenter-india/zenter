/**
 * Realtime messaging hook for one open conversation (AD-5, FR-17, FR-17a).
 *
 * - Loads the last 100 messages under `qk.messages(conversationId)`.
 * - Subscribes to the `messages:{id}` channel; every insert patches BOTH the
 *   message list AND the `qk.conversations(userId)` list (bump + re-sort).
 * - Optimistic send carries a client token; the realtime echo reconciles against
 *   it (by token via the RPC-returned id, or by content) so nothing duplicates.
 * - Resilience: on channel re-subscribe (reconnect) and on app foreground while
 *   the thread is open, the message query refetches so nothing is silently missed.
 * - Marks the conversation read on open and on every message received while open.
 * - Tears the channel down on unmount (no leaks, NFR-3).
 */
import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { qk } from '@/data/keys';
import {
  getMessages,
  sendMessage,
  subscribeToMessages,
  markConversationRead,
  MESSAGE_MAX_LENGTH,
  type Message,
  type Conversation,
} from '@/api/chat';
import { EDGE_BASE } from '@/api/pushTokens';
import { env } from '@/lib/env';

/** A message plus optimistic-send metadata used only for rendering. */
export type ChatMessage = Message & {
  _status?: 'sending' | 'sent' | 'failed';
  _clientToken?: string;
};

type SendVars = { body: string; clientToken: string };

function makeClientToken(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function sortByTime(list: ChatMessage[]): ChatMessage[] {
  return [...list].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
}

/** Merge an incoming realtime message, reconciling with a pending optimistic one. */
function mergeIncoming(list: ChatMessage[], msg: Message, myUserId: string | null | undefined): ChatMessage[] {
  if (list.some((m) => m.id === msg.id)) return list; // already have the real row
  if (myUserId && msg.sender_id === myUserId) {
    const idx = list.findIndex((m) => m._status === 'sending' && m.body === msg.body);
    if (idx !== -1) {
      const next = list.slice();
      // Keep the optimistic row's _clientToken so the FlatList key (which uses
      // it) stays stable across the temp -> real id swap instead of replaying
      // the bubble's entrance animation.
      next[idx] = { ...msg, _status: 'sent', _clientToken: list[idx]._clientToken };
      return sortByTime(next);
    }
  }
  return sortByTime([...list, { ...msg, _status: 'sent' }]);
}

/** Bump a conversation's `updated_at` in the cached list and re-sort newest-first. */
function bumpConversation(qc: QueryClient, userId: string, conversationId: string, updatedAt: string): void {
  qc.setQueryData<Conversation[]>(qk.conversations(userId), (old) => {
    if (!old) return old;
    let touched = false;
    const next = old.map((c) => {
      if (c.id === conversationId && new Date(updatedAt).getTime() > new Date(c.updated_at).getTime()) {
        touched = true;
        return { ...c, updated_at: updatedAt };
      }
      return c;
    });
    if (!touched) return old;
    return next.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  });
}

export function useMessages(conversationId: string | null | undefined, userId: string | null | undefined) {
  const qc = useQueryClient();
  const key = qk.messages(conversationId ?? 'none');

  const query = useQuery({
    queryKey: key,
    enabled: !!conversationId,
    queryFn: async (): Promise<ChatMessage[]> => {
      const { data, error } = await getMessages(conversationId!, 100);
      if (error) throw new Error(error.message);
      return (data ?? []) as ChatMessage[];
    },
  });

  // Mark read once history has loaded (opening the thread reads it, FR-17).
  const loaded = query.isSuccess;
  useEffect(() => {
    if (conversationId && userId && loaded) {
      void markConversationRead(userId, conversationId);
    }
  }, [conversationId, userId, loaded]);

  // Realtime subscription: patch messages + conversation list; backfill on reconnect.
  useEffect(() => {
    if (!conversationId) return;
    let subscribedOnce = false;
    const channel = subscribeToMessages(
      conversationId,
      (msg) => {
        qc.setQueryData<ChatMessage[]>(key, (old = []) => mergeIncoming(old, msg, userId));
        if (userId) {
          bumpConversation(qc, userId, conversationId, msg.created_at);
          // The thread is open, so any arriving message is read.
          void markConversationRead(userId, conversationId);
        }
      },
      (status) => {
        if (status !== 'SUBSCRIBED') return;
        if (!subscribedOnce) {
          subscribedOnce = true;
          return; // initial subscribe — the query already loaded history
        }
        // Reconnect backfill (FR-17a): a degraded socket must never look up-to-date.
        void qc.invalidateQueries({ queryKey: key });
        if (userId) void qc.invalidateQueries({ queryKey: qk.conversations(userId) });
      },
    );
    return () => {
      channel.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, userId]);

  // Foreground backfill (FR-17a): refetch history when returning to the app.
  useEffect(() => {
    if (!conversationId) return;
    const appState = { current: AppState.currentState };
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && next === 'active') {
        void qc.invalidateQueries({ queryKey: key });
      }
      appState.current = next;
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  // Optimistic send with client-token reconciliation (AD-5).
  const mutation = useMutation({
    mutationFn: async ({ body }: SendVars): Promise<string> => {
      const { data, error } = await sendMessage(conversationId!, userId!, body);
      if (error) throw new Error(error.message);
      return data ?? '';
    },
    onMutate: ({ body, clientToken }: SendVars) => {
      const optimistic: ChatMessage = {
        id: `temp:${clientToken}`,
        conversation_id: conversationId!,
        sender_id: userId!,
        body,
        message_type: 'text',
        created_at: new Date().toISOString(),
        _status: 'sending',
        _clientToken: clientToken,
      };
      qc.setQueryData<ChatMessage[]>(key, (old = []) => sortByTime([...old, optimistic]));
      if (userId) {
        bumpConversation(qc, userId, conversationId!, optimistic.created_at);
        void markConversationRead(userId, conversationId!);
      }
    },
    onSuccess: (realId, { clientToken }) => {
      qc.setQueryData<ChatMessage[]>(key, (old = []) => {
        const idx = old.findIndex((m) => m._clientToken === clientToken);
        const target = idx === -1 ? undefined : old[idx];
        if (!target) return old; // echo already reconciled it
        // Echo landed first with the real id → drop the now-duplicate optimistic row.
        if (realId && old.some((m) => m.id === realId)) {
          return old.filter((m) => m._clientToken !== clientToken);
        }
        const next = old.slice();
        next[idx] = { ...target, id: realId || target.id, _status: 'sent' };
        return next;
      });
      if (realId && conversationId) {
        fetch(`${EDGE_BASE}/send-push-notification`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: env.supabaseAnonKey },
          body: JSON.stringify({ type: 'chat_message', conversation_id: conversationId, message_id: realId }),
        }).catch((e) => {
          if (__DEV__) console.warn('[push] chat_message notify failed', e);
        });
      }
    },
    onError: (_err, { clientToken }) => {
      // Drop the optimistic bubble; the screen restores the composer from sendError.
      qc.setQueryData<ChatMessage[]>(key, (old = []) => old.filter((m) => m._clientToken !== clientToken));
    },
  });

  const send = (body: string) => {
    const trimmed = body.trim();
    if (!trimmed || !conversationId || !userId) return;
    mutation.mutate({ body: trimmed.slice(0, MESSAGE_MAX_LENGTH), clientToken: makeClientToken() });
  };

  return {
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    send,
    isSending: mutation.isPending,
    sendError: mutation.error,
    clearSendError: mutation.reset,
  };
}
