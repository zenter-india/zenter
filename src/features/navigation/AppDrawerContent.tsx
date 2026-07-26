// Imported from expo-router/drawer, not @react-navigation/drawer: expo-router
// wraps the navigator and re-exports its own (incompatible) prop types, so
// mixing the two sources fails to typecheck at the `drawerContent` boundary.
import {
  DrawerContentScrollView,
  DrawerItem,
  DrawerItemList,
  type DrawerContentComponentProps,
} from 'expo-router/drawer';
import { router } from 'expo-router';
import { colors, fonts } from '@/theme';
import { useSession } from '@/stores/session';
import { useProfile } from '@/data/useProfile';
import { useConfig } from '@/data/useConfig';
import { track } from '@/lib/observability';

/**
 * Drawer content = the standard route list plus a "Get Zenter Plus" entry.
 *
 * Why this is hand-rolled rather than another `Drawer.Screen`: `/plus` lives at
 * `app/plus.tsx`, outside the `(drawer)` group, so it is pushed as a normal
 * route and cannot be expressed as a drawer screen without also inheriting the
 * drawer chrome (it already renders its own `ScreenHeader`).
 *
 * Ports the web's `hm-plus-nav-item` (components/navbar.html), including its
 * visibility rule — hidden once the member is on Plus (js/app.js:193,
 * js/dashboard.js:127). Without this the RN app had NO proactive route to
 * checkout at all: the only paths to `/plus` were the free-chat banner at zero
 * remaining and the locked-chat overlay, so a member who simply wanted to buy
 * had nowhere to tap.
 */
export function AppDrawerContent(props: DrawerContentComponentProps) {
  const { phone } = useSession();
  const me = useProfile(phone).data;
  const cfg = useConfig().data;

  // Hidden for existing Plus members (matches web), and while Plus is globally
  // switched off — never advertise a product the platform has disabled.
  const showPlus = !!cfg?.plusEnabled && !me?.plus_member;

  return (
    <DrawerContentScrollView {...props}>
      <DrawerItemList {...props} />
      {showPlus ? (
        <DrawerItem
          label="⭐ Get Zenter Plus"
          labelStyle={styles.plusLabel}
          onPress={() => {
            track('upgrade_cta_click', { source: 'drawer' });
            props.navigation.closeDrawer();
            router.push('/plus');
          }}
        />
      ) : null}
    </DrawerContentScrollView>
  );
}

const styles = {
  plusLabel: {
    fontFamily: fonts.bodySemibold,
    color: colors.primary,
  },
} as const;
