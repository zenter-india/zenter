/**
 * Free-chat limit logic (Epic 7 / Story 7.1, FR-20). Pure, UI-free port of
 * `js/chat.js` `recomputeUnlockedConvIds` / `isConvLocked`.
 *
 * Non-Plus members keep only the OLDEST `freeLimit` conversations (by
 * `created_at`) unlocked; any conversation beyond that opens Locked. Two
 * conditions bypass gating entirely:
 *   1. Plus membership (per-user `users.plus_member`) — matches web `myIsPlus`.
 *   2. The platform-wide Plus toggle being off (`plus_enabled = false`).
 * When either holds, every conversation is unlocked and the free-chat banner is
 * hidden — keeping the banner and the locks coherent, since the banner is the
 * only upgrade context a lock points at. (Condition 2 makes the RN port coherent
 * where the web `chat.js` was simply never handed the `plus_enabled` flag.)
 */
import type { Conversation } from '@/api/chat';

export interface FreeChatGate {
  /** Free-tier active-chat cap (`useConfig().freeActiveChats`; default 2). */
  freeLimit: number;
  /** The current member is a Plus member (`users.plus_member`). */
  isPlus: boolean;
  /** Platform-wide Plus gating toggle (`useConfig().plusEnabled`). */
  plusEnabled: boolean;
}

/** Only the fields the lock computation needs from a conversation. */
type ConvLite = Pick<Conversation, 'id' | 'created_at'>;

/** Whether free-chat gating applies at all for this member. */
export function isGatingActive(gate: FreeChatGate): boolean {
  return gate.plusEnabled && !gate.isPlus;
}

/**
 * The set of conversation ids the member may open. Gating inactive → every
 * conversation unlocked; otherwise the oldest `freeLimit` conversations by
 * `created_at` (ascending) stay unlocked and the rest are locked.
 */
export function computeUnlockedConvIds(
  conversations: ConvLite[],
  gate: FreeChatGate,
): Set<string> {
  const unlocked = new Set<string>();
  if (!isGatingActive(gate)) {
    for (const c of conversations) unlocked.add(c.id);
    return unlocked;
  }
  const oldestFirst = [...conversations].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  for (const c of oldestFirst.slice(0, Math.max(0, gate.freeLimit))) unlocked.add(c.id);
  return unlocked;
}

/** A conversation is locked when it is not in the unlocked set. */
export function isConvLocked(conversationId: string, unlocked: Set<string>): boolean {
  return !unlocked.has(conversationId);
}
