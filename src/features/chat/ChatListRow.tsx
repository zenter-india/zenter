/**
 * One conversation row in the Chats list (Story 5.1). Shows the counterpart's
 * initials avatar + name, a last-message preview (from the reactive message cache,
 * falling back to their exam-centre location when no message is cached yet), the
 * relative time of the last update, and an unread dot when the row is unread.
 *
 * Unread is decided by the SAME selector the Chats badge uses
 * (`isConversationUnread` over the device-local last-read map, AD-5/AD-11), so the
 * dot and the badge can never disagree.
 */
import { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { colors, radius, space, fonts } from '@/theme';
import { Text, Avatar, PressableScale } from '@/components';
import type { FeedUser } from '@/types/user';
import { centrePlace } from '@/features/feed/enrich';
import { formatRelativeTime } from './time';
import { useCachedLastMessage, messagePreview } from './useCachedLastMessage';

export type ChatListRowProps = {
  conversationId: string;
  updatedAt: string;
  unread: boolean;
  /** Free-chat lock (Epic 7): shows a lock + "Locked" preview and suppresses the
   *  unread dot; tapping still opens the thread, which renders the paywall. */
  locked?: boolean;
  user?: FeedUser;
  onPress: () => void;
};

function ChatListRowImpl({ conversationId, updatedAt, unread, locked, user, onPress }: ChatListRowProps) {
  const name = user?.full_name || 'Aspirant';
  const preview = messagePreview(useCachedLastMessage(conversationId));
  const subtitle = locked
    ? 'Locked — upgrade to Zenter Plus'
    : preview ?? (user ? centrePlace(user) : undefined);
  const time = formatRelativeTime(updatedAt);
  const showUnread = unread && !locked;

  return (
    <PressableScale
      onPress={onPress}
      haptic="selection"
      scaleTo={0.985}
      accessibilityRole="button"
      accessibilityLabel={`Chat with ${name}${locked ? ', locked' : ''}${showUnread ? ', unread' : ''}`}
      style={styles.row}
    >
      <Avatar name={name} size={48} />
      <View style={styles.body}>
        <View style={styles.line}>
          <Text variant="h3" numberOfLines={1} style={styles.name}>{name}</Text>
          {locked ? (
            <Text style={styles.lock} accessibilityElementsHidden importantForAccessibility="no">🔒</Text>
          ) : null}
          <Text variant="caption" style={styles.time}>{time}</Text>
        </View>
        <View style={styles.line}>
          <Text
            variant="small"
            color={showUnread ? colors.text : colors.textMuted}
            numberOfLines={1}
            style={[styles.preview, showUnread && styles.previewUnread]}
          >
            {subtitle ?? 'Say hello 👋'}
          </Text>
          {showUnread ? <View style={styles.dot} accessibilityElementsHidden importantForAccessibility="no" /> : null}
        </View>
      </View>
    </PressableScale>
  );
}

export const ChatListRow = memo(ChatListRowImpl);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: space[4],
    paddingVertical: space[3],
  },
  pressed: { backgroundColor: colors.surface2 },
  body: { flex: 1, gap: 2 },
  line: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  name: { flex: 1 },
  lock: { fontSize: 13 },
  time: { color: colors.textSubtle },
  preview: { flex: 1 },
  previewUnread: { fontFamily: fonts.bodySemibold },
  dot: { width: 9, height: 9, borderRadius: radius.full, backgroundColor: colors.primary },
});
