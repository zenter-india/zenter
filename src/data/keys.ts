/**
 * Canonical TanStack Query keys (AD-2). The ONE place keys are defined so
 * invalidation is consistent across features. Notes:
 *  - `profile(phone)` = the FULL self record (never overwritten by a partial fetch).
 *  - `user(id)` = another user's public projection.
 *  - `status(phone)` = account status + exam eligibility (root guard, AD-10).
 */
export const qk = {
  config: ['config'] as const,
  status: (phone: string) => ['status', phone] as const,
  profile: (phone: string) => ['profile', phone] as const,
  user: (id: string) => ['user', id] as const,
  feed: (userId: string) => ['feed', userId] as const,
  requests: (userId: string) => ['requests', userId] as const,
  connections: (userId: string) => ['connections', userId] as const,
  conversations: (userId: string) => ['conversations', userId] as const,
  messages: (conversationId: string) => ['messages', conversationId] as const,
  exchange: (conversationId: string) => ['exchange', conversationId] as const,
  activeChats: (userId: string) => ['activeChats', userId] as const,
  blocked: (userId: string) => ['blocked', userId] as const,
};
