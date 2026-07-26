/**
 * Free-chat allowance banner (Epic 7 / Story 7.1, FR-20). Shown atop the Chats
 * list. Tells a non-Plus member how many free chats remain, or the zero-state
 * once they are all used (with an upgrade CTA pointing at the deferred
 * "coming soon" state).
 *
 * Hidden entirely when gating does not apply: while config/count are loading, for
 * Plus members (`plus_member`), and when the platform Plus toggle is off
 * (`plusEnabled === false`) — the same conditions under which every chat is
 * unlocked (see `freeChat.ts`). The count comes from `get_active_chat_count`
 * (via `useActiveChatCount`), which equals the number of active conversations, so
 * "remaining" and the per-row locks always agree.
 */
import { View, StyleSheet, Pressable } from 'react-native';
import { colors, radius, space, fonts } from '@/theme';
import { Text, Icon } from '@/components';
import { useSession } from '@/stores/session';
import { useProfile } from '@/data/useProfile';
import { useConfig } from '@/data/useConfig';
import { useActiveChatCount } from '@/data/useActiveChatCount';
import { useUpgradePrompt } from './useUpgradePrompt';

export function FreeChatBanner({ userId }: { userId: string | null | undefined }) {
  const { phone } = useSession();
  const me = useProfile(phone).data;
  const config = useConfig();
  const count = useActiveChatCount(userId);
  const onUpgrade = useUpgradePrompt('free_chat_banner');

  const cfg = config.data;
  // Not enough loaded to say anything truthful yet.
  if (!cfg || count.data === undefined) return null;
  // Gating off → no banner (mirrors freeChat.isGatingActive).
  if (me?.plus_member || !cfg.plusEnabled) return null;

  const remaining = Math.max(0, cfg.freeActiveChats - count.data);

  return (
    <View style={styles.card}>
      <View style={styles.iconWrap} accessibilityElementsHidden importantForAccessibility="no">
        <Icon name="message-circle" size={18} color={colors.secondary} />
      </View>
      <View style={styles.body}>
        {remaining > 0 ? (
          <Text variant="small" color={colors.textMuted}>
            {`You have ${remaining} free ${remaining === 1 ? 'chat' : 'chats'} remaining.`}
          </Text>
        ) : (
          <>
            <Text variant="small" color={colors.text} style={styles.zeroTitle}>
              Aspirants! Break the barriers 🚧
            </Text>
            <Pressable
              onPress={onUpgrade}
              accessibilityRole="button"
              accessibilityLabel="Upgrade to Zenter Plus"
              hitSlop={6}
            >
              <Text variant="small" color={colors.secondary} style={styles.link}>
                Upgrade to Zenter Plus →
              </Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    backgroundColor: colors.secondary50,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.secondary100,
    paddingHorizontal: space[4],
    paddingVertical: space[3],
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: 2 },
  zeroTitle: { fontFamily: fonts.bodySemibold },
  link: { fontFamily: fonts.bodySemibold },
});
