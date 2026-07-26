/**
 * Typing indicator for one open conversation (FR-18, AD-5). Owns BOTH directions,
 * mirroring `js/chat.js`:
 *   - Send: `onInputChange` broadcasts my typing state, auto-clearing after 3s of
 *     idle; `stopTyping` clears immediately (call on send / blur).
 *   - Receive: subscribes to `typing:{id}`, ignores my own rows, and shows the
 *     counterpart's state — with a defensive 3s auto-clear in case the "stopped"
 *     event is missed. No presence, no last-seen.
 * The channel is torn down on unmount and typing is cleared (NFR-3).
 */
import { useEffect, useRef, useState } from 'react';
import { broadcastTyping, subscribeToTyping } from '@/api/chat';

const IDLE_MS = 3000;

export function useTyping(conversationId: string | null | undefined, userId: string | null | undefined) {
  const [otherTyping, setOtherTyping] = useState(false);

  const isTypingRef = useRef(false);
  const sendIdleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recvIdleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearSendTimer = () => {
    if (sendIdleTimer.current) {
      clearTimeout(sendIdleTimer.current);
      sendIdleTimer.current = null;
    }
  };
  const clearRecvTimer = () => {
    if (recvIdleTimer.current) {
      clearTimeout(recvIdleTimer.current);
      recvIdleTimer.current = null;
    }
  };

  const stopTyping = () => {
    clearSendTimer();
    if (isTypingRef.current) {
      isTypingRef.current = false;
      if (conversationId && userId) void broadcastTyping(conversationId, userId, false);
    }
  };

  const onInputChange = (text: string) => {
    if (!conversationId || !userId) return;
    const hasText = text.trim().length > 0;
    if (hasText && !isTypingRef.current) {
      isTypingRef.current = true;
      void broadcastTyping(conversationId, userId, true);
    } else if (!hasText && isTypingRef.current) {
      isTypingRef.current = false;
      void broadcastTyping(conversationId, userId, false);
    }
    clearSendTimer();
    if (hasText) {
      sendIdleTimer.current = setTimeout(() => {
        isTypingRef.current = false;
        void broadcastTyping(conversationId, userId, false);
      }, IDLE_MS);
    }
  };

  const [prevConvId, setPrevConvId] = useState(conversationId);
  if (conversationId !== prevConvId) {
    setPrevConvId(conversationId);
    setOtherTyping(false);
  }

  // Receive side.
  useEffect(() => {
    if (!conversationId) return;
    const channel = subscribeToTyping(conversationId, (row) => {
      if (row.user_id === userId) return; // ignore my own rows
      clearRecvTimer();
      setOtherTyping(row.is_typing);
      if (row.is_typing) {
        recvIdleTimer.current = setTimeout(() => setOtherTyping(false), IDLE_MS);
      }
    });
    return () => {
      channel.unsubscribe();
      clearRecvTimer();
      stopTyping();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, userId]);

  return { otherTyping, onInputChange, stopTyping };
}
