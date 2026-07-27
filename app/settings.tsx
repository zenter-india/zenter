/**
 * Settings / About screen — Epic 6 (Story 6.3). Reached from the Profile header
 * gear. Hosts logout, the legal links relocated from the web footer, a support
 * contact, and the destructive Delete Account flow (Flow 7: "Settings/About →
 * Delete Account").
 *
 * Delete removes the profile + connections (deleteUserData), then signs the
 * member out and resets to the auth stack — a clean, deliberate exit (FR-26,
 * NFR-6). Logout signs out of Firebase and clears local caches (FR-35).
 */
import { useState } from 'react';
import { ScrollView, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors, space, fonts } from '@/theme';
import { Text, Card, Button, useToast } from '@/components';
import { useSession } from '@/stores/session';
import { useProfile } from '@/data/useProfile';
import { useDeleteAccount } from '@/data/useAccount';
import { logout } from '@/lib/auth';
import { SIGN_IN_ROUTE, FEED_ROUTE } from '@/features/auth/routing';
import { ScreenHeader } from '@/features/profile/ScreenHeader';
import { ConfirmDialog } from '@/features/profile/ConfirmDialog';

export default function SettingsScreen() {
  const { phone } = useSession();
  const me = useProfile(phone).data;
  const del = useDeleteAccount();
  const { show } = useToast();
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace(FEED_ROUTE));

  async function signOut() {
    await logout();
    if (router.canDismiss()) {
      router.dismissAll();
    }
    router.replace(SIGN_IN_ROUTE);
  }

  async function confirmDelete() {
    if (!me?.id) {
      show('Cannot delete — your profile is still loading. Please try again.', 'danger');
      return;
    }
    try {
      await del.mutateAsync(me.id);
      await logout();
      if (router.canDismiss()) {
        router.dismissAll();
      }
      router.replace(SIGN_IN_ROUTE);
    } catch (e) {
      setDeleteConfirm(false);
      show((e as Error)?.message || 'Delete failed. Please try again.', 'danger');
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Settings" onBack={goBack} />

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* About & legal */}
        <Card style={styles.card}>
          <Text variant="h3">About</Text>
          <LinkRow label="Privacy Policy" onPress={() => router.push('/privacy')} isInternal />
          <LinkRow label="Terms & Conditions" onPress={() => router.push('/terms')} isInternal />
          <LinkRow label="Community Guidelines" onPress={() => router.push('/community')} isInternal />
          <LinkRow label="Refund & Cancellation Policy" onPress={() => router.push('/refund')} isInternal />
        </Card>

        {/* Support & Help */}
        <Card style={styles.card}>
          <Text variant="h3">Help & Support</Text>
          <LinkRow label="FAQ" onPress={() => router.push('/faq')} isInternal />
          <LinkRow label="Send Feedback" onPress={() => router.push('/feedback')} isInternal />
          <LinkRow label="Contact Support" onPress={() => router.push('/contact')} isInternal />
        </Card>

        {/* Account */}
        <Card style={styles.card}>
          <Text variant="h3">Account</Text>
          <Button title="Sign out" variant="ghost" onPress={signOut} />
          <Button
            title="Delete account"
            variant="ghost"
            onPress={() => setDeleteConfirm(true)}
            style={styles.deleteBtn}
            accessibilityLabel="Delete account"
          />
          <Text variant="caption">
            Deleting removes your profile and connections permanently.
          </Text>
        </Card>
      </ScrollView>

      <ConfirmDialog
        visible={deleteConfirm}
        title="Delete your account?"
        message="This permanently deletes your Zenter profile and connections. This action cannot be undone."
        confirmLabel="Delete permanently"
        danger
        busy={del.isPending}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirm(false)}
      />
    </SafeAreaView>
  );
}

function LinkRow({ label, onPress, isInternal = false }: { label: string; onPress: () => void; isInternal?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      style={({ pressed }) => [styles.linkRow, pressed && styles.rowPressed]}
    >
      <Text variant="link">{label}</Text>
      <Text style={styles.ext} accessibilityElementsHidden importantForAccessibility="no">
        {isInternal ? '→' : '↗'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: space[4], gap: space[3], paddingBottom: space[7] },
  card: { gap: space[3] },
  linkRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowPressed: { opacity: 0.6 },
  ext: { fontFamily: fonts.body, fontSize: 15, color: colors.secondary },
  deleteBtn: { borderColor: colors.danger },
});
