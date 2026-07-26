/**
 * Block-flow controller (Story 8.1, FR-27). One hook that a surface (chat / mate
 * profile / connections) mounts once to get:
 *   - `openBlock(userId, name?)` — open the reason sheet for a target.
 *   - `blockSheet` — the single {@link BlockSheet} element to drop into the tree.
 *
 * On confirm it runs `useBlock` (from `@/data/useBlocked`), which inserts the
 * `blocked_users` row AND clears any connection rows between the two — bidirectional
 * feed removal is enforced by the feed/connection query invalidation the hook does
 * (both directions are excluded via getBlockedUserIds / getBlockedByIds in
 * `useFeed`), so the pair disappear from each other everywhere (AD-6/AD-8). Toast
 * copy is ported verbatim from the web `doBlock`. `onBlocked` lets a surface react
 * (e.g. the chat header pops back out of the now-blocked thread).
 */
import { useCallback, useState } from 'react';
import { useToast } from '@/components';
import { useBlock } from '@/data/useBlocked';
import { useMyUserId } from '@/features/connections/useMyUserId';
import { BlockSheet } from './BlockSheet';

type Target = { userId: string; name?: string };

export function useBlockActions(opts?: { onBlocked?: (userId: string) => void }) {
  const myUserId = useMyUserId();
  const block = useBlock();
  const { show } = useToast();
  const [target, setTarget] = useState<Target | null>(null);

  const openBlock = useCallback((userId: string, name?: string) => {
    if (!userId) return;
    setTarget({ userId, name });
  }, []);

  const close = useCallback(() => setTarget(null), []);

  const submit = useCallback(
    (reason: string) => {
      if (!myUserId || !target) return;
      const blockedId = target.userId;
      block.mutate(
        { myId: myUserId, userId: blockedId, reason },
        {
          onSuccess: () => {
            setTarget(null);
            show("User blocked — they won't appear in Find Mates.", 'info');
            opts?.onBlocked?.(blockedId);
          },
          onError: (e) => show((e as Error)?.message || 'Could not block user.', 'danger'),
        },
      );
    },
    [myUserId, target, block, show, opts],
  );

  const blockSheet = (
    <BlockSheet
      visible={!!target}
      name={target?.name}
      busy={block.isPending}
      onCancel={close}
      onSubmit={submit}
    />
  );

  return { openBlock, blockSheet, canBlock: !!myUserId, isBlocking: block.isPending };
}
