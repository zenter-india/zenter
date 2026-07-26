/**
 * ConnectButton — the single, state-aware connection CTA (Epic 4). Reused by the
 * feed card footer, the mate profile sheet, and the Requests tab. It renders the
 * relationship-appropriate action from the projected {@link RelEntry} (`rel`) and
 * wires each action to the optimistic mutations in `@/data/useConnections`:
 *
 *   NONE        → Request           (useSendRequest, "Request sent!")
 *   PENDING_OUT → Sent + Withdraw    (useWithdraw via a confirm modal, "Request cancelled.")
 *   PENDING_IN  → Accept / Decline   (useAccept → conversation + Safety Reminder + Chats; useDecline)
 *   CONNECTED   → Open Chat          (Chats tab; Epic 5 refines to a specific thread)
 *   REJECTED    → "Declined"
 *
 * `rel` is passed in (baked onto each FeedItem, derived in the sheet, or
 * synthesised by the Requests tab), so the component stays presentational for its
 * state and reactive: because every mutation invalidates qk.connections +
 * qk.requests + qk.feed, the surfaces re-derive `rel` and this CTA updates
 * everywhere at once (AD-6, FR-15). "My" user id is resolved internally
 * (`useMyUserId`) so the prop interface is unchanged from the Epic-3 placeholder.
 */
import { useState } from 'react';
import { View, StyleSheet, Modal } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Text, useToast } from '@/components';
import { colors, space, radius } from '@/theme';
import { REL, type RelEntry } from '@/domain/relationships';
import {
  useSendRequest,
  useWithdraw,
  useAccept,
  useDecline,
} from '@/data/useConnections';
import { useConversations } from '@/data/useConversations';
import { useMyUserId } from './useMyUserId';
import { safetyReminder } from './SafetyReminder';
import { goToChats } from './nav';

export type ConnectButtonProps = {
  /** The other aspirant's user id. */
  userId: string;
  /** Projected relationship of the current user toward `userId`. */
  rel: RelEntry;
  /** Stretch the CTA full-width (mate sheet) vs. compact (card footer). */
  block?: boolean;
  /** CONNECTED state: open the chat. Defaults to switching to the Chats tab. */
  onOpenChat?: (userId: string) => void;
};

const errText = (e: unknown, fallback: string) => (e as Error)?.message || fallback;

export function ConnectButton({ userId, rel, block = false, onOpenChat }: ConnectButtonProps) {
  const toast = useToast();
  const myUserId = useMyUserId();

  const send = useSendRequest(myUserId ?? '');
  const withdraw = useWithdraw(myUserId ?? '');
  const accept = useAccept(myUserId ?? '');
  const decline = useDecline(myUserId ?? '');

  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const size = block ? 'md' : 'sm';
  const noMe = !myUserId;

  // — Actions (idempotent: blocked for self / wrong state, disabled while pending) —

  const onSend = () => {
    if (!myUserId || userId === myUserId || rel.status !== REL.NONE) return;
    send.mutate(userId, {
      onSuccess: () => toast.show('Request sent!', 'success'),
      onError: (e) => toast.show(errText(e, 'Could not send request.'), 'danger'),
    });
  };

  const onConfirmWithdraw = () => {
    setWithdrawOpen(false);
    if (!rel.connectionId) return;
    withdraw.mutate(
      { connectionId: rel.connectionId },
      {
        onSuccess: () => toast.show('Request cancelled.', 'info'),
        onError: (e) => toast.show(errText(e, 'Could not withdraw.'), 'danger'),
      },
    );
  };

  const onAccept = () => {
    if (!myUserId || !rel.connectionId) return;
    accept.mutate(
      { connectionId: rel.connectionId, otherUserId: userId },
      {
        onSuccess: () => {
          toast.show('Connected! You can now chat.', 'success');
          // Required acknowledgement → lands the member in Chats (FR-29, AC 4.2).
          safetyReminder.show();
        },
        onError: (e) => toast.show(errText(e, 'Could not accept.'), 'danger'),
      },
    );
  };

  const onConfirmDecline = () => {
    setDeclineOpen(false);
    if (!myUserId || !rel.connectionId) return;
    decline.mutate(
      { connectionId: rel.connectionId },
      { onError: (e) => toast.show(errText(e, 'Could not decline.'), 'danger') },
    );
  };

  const cta = (() => {
    switch (rel.status) {
      case REL.NONE:
        return (
          <Button
            title={block ? 'Request to Connect' : 'Request'}
            size={size}
            block={block}
            busy={send.isPending}
            disabled={noMe}
            onPress={onSend}
          />
        );

      case REL.PENDING_OUT:
        return block ? (
          <View style={styles.blockCol}>
            <Button title="Request Sent" variant="ghost" size={size} block disabled />
            <Button
              title="Withdraw request"
              variant="ghost"
              size="sm"
              block
              busy={withdraw.isPending}
              disabled={noMe}
              onPress={() => setWithdrawOpen(true)}
            />
          </View>
        ) : (
          <Button
            title="Sent"
            variant="ghost"
            size="sm"
            busy={withdraw.isPending}
            disabled={noMe}
            accessibilityLabel="Withdraw co-ordination request"
            onPress={() => setWithdrawOpen(true)}
          />
        );

      case REL.PENDING_IN: {
        const busy = accept.isPending || decline.isPending;
        return (
          <View style={block ? styles.blockCol : styles.row}>
            <Button
              title="Accept"
              size={size}
              block={block}
              busy={accept.isPending}
              disabled={noMe || busy}
              onPress={onAccept}
            />
            <Button
              title="Decline"
              variant="ghost"
              size={size}
              block={block}
              disabled={noMe || busy}
              onPress={() => setDeclineOpen(true)}
            />
          </View>
        );
      }

      case REL.CONNECTED:
        return (
          <OpenChatButton
            otherUserId={userId}
            myUserId={myUserId}
            variant={block ? 'primary' : 'soft'}
            size={size}
            block={block}
            onOpenChat={onOpenChat}
          />
        );

      case REL.REJECTED:
        return (
          <Text variant="small" color={colors.textSubtle}>
            {block ? 'This request was declined.' : 'Declined'}
          </Text>
        );

      default:
        return null;
    }
  })();

  return (
    <>
      {cta}
      {/* Withdraw MY outgoing request (FR-13). */}
      <ConfirmModal
        visible={withdrawOpen}
        title="Withdraw request?"
        body="This cancels your co-ordination request. You can send another one later."
        cancelLabel="Keep"
        confirmLabel="Withdraw"
        busy={withdraw.isPending}
        onCancel={() => setWithdrawOpen(false)}
        onConfirm={onConfirmWithdraw}
      />
      {/* Decline an INCOMING request — guarded because it's effectively permanent:
          a declined sender can't request again (REL.REJECTED is terminal). */}
      <ConfirmModal
        visible={declineOpen}
        title="Decline request?"
        body="They won't be able to send you another request. This can't be undone."
        cancelLabel="Keep"
        confirmLabel="Decline"
        busy={decline.isPending}
        onCancel={() => setDeclineOpen(false)}
        onConfirm={onConfirmDecline}
      />
    </>
  );
}

// ─── Open Chat — resolves the connection's conversation and opens THAT thread ───
//
// Only mounted in the CONNECTED state, so browsing the feed doesn't subscribe
// every card to the conversation list. Finds the conversation by the user pair
// and pushes /chat/[id]; if it isn't in the cache yet (e.g. just accepted, list
// not refetched) it falls back to the Chats tab rather than dead-ending.

function OpenChatButton({
  otherUserId,
  myUserId,
  variant,
  size,
  block,
  onOpenChat,
}: {
  otherUserId: string;
  myUserId: string | null | undefined;
  variant: 'primary' | 'soft';
  size: 'md' | 'sm';
  block: boolean;
  onOpenChat?: (userId: string) => void;
}) {
  const { data: conversations } = useConversations(myUserId);
  const conv = conversations?.find(
    (c) => c.user_a === otherUserId || c.user_b === otherUserId,
  );

  const open = () => {
    if (onOpenChat) return onOpenChat(otherUserId);
    if (conv) router.push({ pathname: '/chat/[id]', params: { id: conv.id } });
    else goToChats();
  };

  return (
    <Button
      title="Open Chat"
      icon="message-circle"
      accessibilityLabel="Open chat"
      variant={variant}
      size={size}
      block={block}
      onPress={open}
    />
  );
}

// ─── Confirm dialog — shared by withdraw (FR-13) and decline ────────────────────

function ConfirmModal({
  visible,
  title,
  body,
  cancelLabel,
  confirmLabel,
  busy,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  title: string;
  body: string;
  cancelLabel: string;
  confirmLabel: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={[styles.modalCard, { marginBottom: insets.bottom }]}>
          <Text variant="h3">{title}</Text>
          <Text variant="bodyMuted">{body}</Text>
          <View style={styles.modalActions}>
            <Button title={cancelLabel} variant="ghost" size="md" onPress={onCancel} style={styles.flex} />
            <Button title={confirmLabel} size="md" busy={busy} onPress={onConfirm} style={styles.flex} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  blockCol: { gap: space[2] },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'center',
    padding: space[5],
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: space[5],
    gap: space[3],
  },
  modalActions: { flexDirection: 'row', gap: space[3], marginTop: space[1] },
  flex: { flex: 1 },
});
