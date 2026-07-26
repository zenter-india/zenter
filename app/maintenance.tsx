import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors, space, radius } from '@/theme';
import { Text, Button } from '@/components';
import { logout } from '@/lib/auth';

/**
 * Maintenance gate (Story 3.1, FR-9). Shown when the signed-in member's
 * `exam_type` is not one of the live ecosystems. Ported from the web
 * `window.location.replace('/maintenance.html')` redirect — a full-screen,
 * unbypassable state (registered at the root with gestures disabled; reached
 * only via `<Redirect>` from the boot guard + the feed, so there is no tab bar
 * or content behind it and no back path into the app).
 *
 * The only exit is Sign out (returning to the auth stack), so a member whose
 * exam isn't live yet is never trapped.
 */
export default function MaintenanceScreen() {
  const [busy, setBusy] = useState(false);

  const onSignOut = async () => {
    setBusy(true);
    try {
      await logout();
    } finally {
      if (router.canDismiss()) {
        router.dismissAll();
      }
      router.replace('/(auth)/sign-in');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.body}>
        <View style={styles.tile}>
          <Text accessibilityLabel="under construction" style={styles.emoji}>
            🚧
          </Text>
        </View>

        <Text variant="h1" style={styles.title}>
          Coming soon
        </Text>

        <Text variant="bodyMuted" style={styles.copy}>
          Zenter support for your exam is being prepared and will open closer to the
          exam date. We&apos;ll have your centre-mates ready the moment it goes live.
        </Text>

        <View style={styles.actions}>
          <Button
            title="Sign out"
            variant="secondary"
            block
            busy={busy}
            onPress={onSignOut}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space[5], gap: space[4] },
  tile: {
    width: 88,
    height: 88,
    borderRadius: radius.xl,
    backgroundColor: colors.primary100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space[2],
  },
  emoji: { fontSize: 40 },
  title: { textAlign: 'center' },
  copy: { textAlign: 'center', maxWidth: 340 },
  actions: { alignSelf: 'stretch', marginTop: space[4], maxWidth: 360, width: '100%' },
});
