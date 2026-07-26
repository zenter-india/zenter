import type { ReactNode } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { colors, space } from '@/theme';
import { Text } from './Text';
import { Icon } from './Icon';

/**
 * The single shared header for the bottom-tab screens (Find / Requests /
 * Connections / Chats). Previously each tab hand-rolled an identical
 * header + its own copy of the header/titleRow/menuBtn styles, which invited
 * drift. This is the one source of truth for that chrome.
 *
 * Slots keep it flexible enough for the feed's two-mode header without any tab
 * re-declaring layout:
 *   - `left`      full override of the left area (feed's back button). Takes
 *                 precedence over `onMenu`.
 *   - `onMenu`    when set (and no `left`), renders the standard drawer-menu
 *                 button.
 *   - `titleBadge` inline node right of the title (feed's exam badge, the
 *                 connections "+N New" pill).
 *   - `right`     trailing slot (the profile avatar, or feed's Filters button).
 *   - `children`  extra rows under the title row (feed's count lines).
 */
export type TabHeaderProps = {
  title: string;
  onMenu?: () => void;
  left?: ReactNode;
  right?: ReactNode;
  titleBadge?: ReactNode;
  children?: ReactNode;
};

export function TabHeader({ title, onMenu, left, right, titleBadge, children }: TabHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.titleRow}>
        <View style={styles.leftGroup}>
          {left ??
            (onMenu ? (
              <Pressable
                onPress={onMenu}
                accessibilityRole="button"
                accessibilityLabel="Open menu"
                hitSlop={8}
                style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
              >
                <Icon name="menu" size={24} color={colors.text} />
              </Pressable>
            ) : null)}
          <View style={styles.titleWrap}>
            <Text variant="h2" numberOfLines={1}>{title}</Text>
            {titleBadge}
          </View>
        </View>
        {right}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: space[4],
    paddingTop: space[2],
    paddingBottom: space[3],
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    // Space between the title row and any `children` rows (feed's count lines).
    gap: space[2],
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[3] },
  leftGroup: { flexDirection: 'row', alignItems: 'center', gap: space[2], flexShrink: 1 },
  titleWrap: { flexDirection: 'row', alignItems: 'center', gap: space[2], flexShrink: 1 },
  // Shared 44px-tall touch target for the menu / back button.
  iconBtn: { width: 32, height: 44, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.7 },
});
