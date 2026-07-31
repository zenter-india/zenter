/**
 * Header entry point to the self-profile + account menu (EXPERIENCE.md IA:
 * "Profile (self) — Header menu"). A hamburger button, mounted in the Find
 * Aspirants header, that opens a dropdown listing the same items as the web
 * navbar's profile dropdown (components/navbar.html on `main`): Profile,
 * Requests, Find aspirants, Districts, Co-ordinations, Chats, Contact us,
 * Feedback, Log out.
 */
import { useState } from 'react';
import { Modal, Pressable, View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors, space, radius, fonts, shadows } from '@/theme';
import { Text, Icon, type IconName } from '@/components';
import { logout } from '@/lib/auth';
import { SIGN_IN_ROUTE } from '@/features/auth/routing';

type MenuItem = {
  label: string;
  icon: IconName;
  onPress: () => void;
  danger?: boolean;
};

export function ProfileMenuButton() {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();

  const close = () => setOpen(false);
  const go = (href: Parameters<typeof router.push>[0]) => {
    close();
    router.push(href);
  };

  async function handleLogout() {
    close();
    await logout();
    if (router.canDismiss()) router.dismissAll();
    router.replace(SIGN_IN_ROUTE);
  }

  const items: MenuItem[] = [
    { label: 'Profile', icon: 'user', onPress: () => go('/profile') },
    { label: 'Requests', icon: 'inbox', onPress: () => go('/(tabs)/requests') },
    { label: 'Find aspirants', icon: 'search', onPress: () => go('/(tabs)/feed') },
    { label: 'Districts', icon: 'map-pin', onPress: () => go('/(tabs)/feed') },
    { label: 'Co-ordinations', icon: 'users', onPress: () => go('/(tabs)/connections') },
    { label: 'Chats', icon: 'message-circle', onPress: () => go('/(tabs)/chats') },
    { label: 'Contact us', icon: 'phone', onPress: () => go('/contact') },
    { label: 'Feedback', icon: 'edit-2', onPress: () => go('/feedback') },
    { label: 'Log out', icon: 'log-out', onPress: handleLogout, danger: true },
  ];

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Menu"
        hitSlop={8}
        style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
      >
        <Icon name="menu" size={24} color={colors.text} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        <Pressable style={styles.backdrop} onPress={close}>
          <View style={[styles.menu, { marginTop: insets.top + 52 }]}>
            {items.map((item) => (
              <Pressable
                key={item.label}
                onPress={item.onPress}
                accessibilityRole="menuitem"
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              >
                <Icon name={item.icon} size={18} color={item.danger ? colors.danger : colors.textMuted} />
                <Text variant="body" color={item.danger ? colors.danger : colors.text} style={styles.label}>
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  btn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: radius.full },
  pressed: { opacity: 0.7 },
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.25)', alignItems: 'flex-end' },
  menu: {
    marginRight: space[4],
    minWidth: 210,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: space[2],
    ...shadows.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingVertical: space[3],
    paddingHorizontal: space[4],
  },
  rowPressed: { backgroundColor: colors.surface2 },
  label: { fontFamily: fonts.bodyMedium },
});
