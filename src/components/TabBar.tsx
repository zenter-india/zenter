import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radius } from '@/theme';
import { useNavBadges } from '@/stores/navBadges';
import { haptics } from '@/lib/haptics';
import { PressableScale } from './PressableScale';
import { Icon, IconName } from './Icon';

/**
 * Custom bottom dock (FR-32), Stitch Core style: clean Feather line icons, the
 * active item tinted primary, a light top divider + soft lift. A custom bar (not
 * React Navigation's default) so the Android ripple can't clip, the height honours
 * the safe-area inset, and taps get a spring press + selection haptic.
 */
const META: Record<string, { label: string; icon: IconName; badge?: 'requests' | 'chats' }> = {
  requests: { label: 'Requests', icon: 'inbox', badge: 'requests' },
  feed: { label: 'Find', icon: 'search' },
  connections: { label: 'Connections', icon: 'users' },
  chats: { label: 'Chats', icon: 'message-circle', badge: 'chats' },
};

const BAR_HEIGHT = 58;

/** Minimal shape of the tab-bar props we use (avoids version-skew between
 *  expo-router's bundled bottom-tabs types and a top-level install). */
type TabBarProps = {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: {
    emit: (event: { type: 'tabPress'; target: string; canPreventDefault: true }) => { defaultPrevented: boolean };
    navigate: (name: string) => void;
  };
};

export function TabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const badges = useNavBadges();
  const bottomPad = Math.max(insets.bottom, 10);

  return (
    <View style={[styles.bar, { height: BAR_HEIGHT + bottomPad, paddingBottom: bottomPad }]}>
      {state.routes.map((route, index) => {
        const meta = META[route.name];
        if (!meta) return null;
        const focused = state.index === index;
        const badge = meta.badge ? badges[meta.badge] : undefined;
        const tint = focused ? colors.primary : colors.textSubtle;

        const onPress = () => {
          haptics.selection();
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
        };

        return (
          <PressableScale
            key={route.key}
            haptic={null}
            onPress={onPress}
            scaleTo={0.88}
            dimTo={1}
            style={styles.tab}
            accessibilityRole="button"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={`${meta.label}${badge ? `, ${badge} new` : ''}`}
          >
            <View style={styles.iconWrap}>
              <Icon name={meta.icon} size={23} color={tint} />
              {badge ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText} maxFontSizeMultiplier={1}>{badge > 9 ? '9+' : String(badge)}</Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.label, { color: tint, fontFamily: focused ? fonts.bodySemibold : fonts.bodyMedium }]} numberOfLines={1} maxFontSizeMultiplier={1.2}>
              {meta.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
    // soft upward lift (Stitch bottom-nav shadow)
    shadowColor: '#0F172A',
    shadowOpacity: 0.03,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, paddingTop: 2 },
  iconWrap: { alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 10.5 },
  badge: {
    position: 'absolute',
    top: -5,
    right: -9,
    minWidth: 17,
    height: 17,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.surface,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: colors.white, fontFamily: fonts.bodyBold, fontSize: 9.5, lineHeight: 12 },
});
