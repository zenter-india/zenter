import type { ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import { colors, space } from '@/theme';
import { Text } from './Text';

/**
 * The single shared header for the bottom-tab screens (Find / Requests /
 * Connections / Chats). Previously each tab hand-rolled an identical
 * header + its own copy of the header/titleRow/menuBtn styles, which invited
 * drift. This is the one source of truth for that chrome.
 *
 * Slots keep it flexible enough for the feed's two-mode header without any tab
 * re-declaring layout:
 *   - `left`      optional leading node (feed's back button when a district is
 *                 open). Tabs otherwise start flush with the title.
 *   - `titleBadge` inline node right of the title (feed's exam badge, the
 *                 connections "+N New" pill).
 *   - `right`     trailing slot (the profile avatar, or feed's Filters button).
 *   - `children`  extra rows under the title row (feed's count lines).
 */
export type TabHeaderProps = {
  title: string;
  left?: ReactNode;
  right?: ReactNode;
  titleBadge?: ReactNode;
  children?: ReactNode;
};

export function TabHeader({ title, left, right, titleBadge, children }: TabHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.titleRow}>
        <View style={styles.leftGroup}>
          {left}
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
});
