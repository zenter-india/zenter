/**
 * Header entry point to the self-profile + account menu (EXPERIENCE.md IA:
 * "Profile (self) — Header menu"). A hamburger button, mounted in the Find
 * Aspirants header, opening a dropdown. Deliberately excludes items already
 * reachable via the bottom tab bar (Requests, Find, Co-ordinations, Chats) —
 * this menu's job is the account/support/legal surface, not navigation
 * already one tap away: Zenter Plus, Profile, Privacy Policy, Terms &
 * Conditions, Community Guidelines, Refund & Cancellation Policy, FAQ,
 * Contact support, Feedback, Log out.
 */
import { useRef, useState } from 'react';
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
  // Deferred action, run only once this Modal's dismiss animation has fully
  // settled. Two overlapping native presentation transitions on the same
  // window (this Modal's UIKit dismiss + a formSheet-presented screen like
  // /feedback being pushed) can leave the pushed screen rendering blank on
  // iOS — Modal's own `onDismiss` callback fires a touch before UIKit has
  // actually finished tearing down the presentation, so it isn't a reliable
  // enough signal on its own. A fixed timeout, used uniformly on both
  // platforms instead of racing onDismiss, gives a guaranteed serialization
  // gap regardless of that timing slop.
  const pendingAction = useRef<(() => void) | null>(null);

  const runPending = () => {
    const action = pendingAction.current;
    pendingAction.current = null;
    action?.();
  };

  const deferThenClose = (action: () => void) => {
    pendingAction.current = action;
    setOpen(false);
    setTimeout(runPending, 400);
  };

  const close = () => setOpen(false);
  const go = (href: Parameters<typeof router.push>[0]) => {
    deferThenClose(() => router.push(href));
  };

  function handleLogout() {
    deferThenClose(async () => {
      await logout();
      if (router.canDismiss()) router.dismissAll();
      router.replace(SIGN_IN_ROUTE);
    });
  }

  const items: MenuItem[] = [
    { label: 'Zenter Plus', icon: 'star', onPress: () => go('/plus') },
    { label: 'Profile', icon: 'user', onPress: () => go('/profile') },
    { label: 'Privacy Policy', icon: 'shield', onPress: () => go('/privacy') },
    { label: 'Terms & Conditions', icon: 'file-text', onPress: () => go('/terms') },
    { label: 'Community Guidelines', icon: 'users', onPress: () => go('/community') },
    { label: 'Refund & Cancellation Policy', icon: 'rotate-ccw', onPress: () => go('/refund') },
    { label: 'FAQ', icon: 'help-circle', onPress: () => go('/faq') },
    { label: 'Contact support', icon: 'phone', onPress: () => go('/contact') },
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

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={close}
      >
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
