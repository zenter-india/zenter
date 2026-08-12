/**
 * Profile (self) screen — Epic 6. Reached from the Find Aspirants header menu
 * (ProfileMenuButton) and pushed onto the root stack over the tabs.
 *
 * Composes:
 *  - Story 6.1: identity card (initials avatar, name, own phone) + view/edit
 *    sections (ProfileEditor) reading the FULL self record (qk.profile), which is
 *    never overwritten by a partial fetch (AD-2). Edit is triggered by the pen
 *    icon in the header's top-right corner, not a bottom button — `editing`
 *    lives in ProfileScreen (above the async boundary, so the header can show
 *    the pen the instant data loads) and is passed down as a controlled prop.
 *  - Story 6.2: Roll-Number verification (VerificationSection).
 *  - Story 6.3: pause / reactivate (amber banner + confirm) and delete account
 *    (danger-outlined button + confirm), both inline here — legal links/FAQ/
 *    sign-out now live in the header hamburger menu (ProfileMenuButton)
 *    instead of a separate Settings screen, so there's nothing left to route
 *    to there.
 */
import { useState } from 'react';
import { View, ScrollView, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors, space, radius, fonts, badgeVariants } from '@/theme';
import { Text, Avatar, Badge, Button, Card, Icon, EmptyState, AsyncBoundary, useToast } from '@/components';
import { useSession } from '@/stores/session';
import { useProfile } from '@/data/useProfile';
import { usePauseProfile, useDeleteAccount } from '@/data/useAccount';
import { formatPhone } from '@/domain/masking';
import { FEED_ROUTE, SIGN_IN_ROUTE } from '@/features/auth/routing';
import type { User } from '@/types/user';
import { track } from '@/lib/observability';
import { logout } from '@/lib/auth';
import { ScreenHeader } from '@/features/profile/ScreenHeader';
import { VerificationSection } from '@/features/profile/VerificationSection';
import { ProfileEditor } from '@/features/profile/ProfileEditor';
import { ConfirmDialog } from '@/features/profile/ConfirmDialog';

export default function ProfileScreen() {
  const { phone } = useSession();
  const q = useProfile(phone);
  const [editing, setEditing] = useState(false);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace(FEED_ROUTE));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        title="My profile"
        onBack={goBack}
        rightSlot={
          q.data && !editing ? (
            <Pressable
              onPress={() => setEditing(true)}
              accessibilityRole="button"
              accessibilityLabel="Edit profile"
              hitSlop={8}
              style={({ pressed }) => [styles.editBtn, pressed && styles.pressed]}
            >
              <Icon name="edit-2" size={20} color={colors.text} />
            </Pressable>
          ) : null
        }
      />

      <AsyncBoundary<User | null>
        isLoading={q.isLoading}
        isError={q.isError}
        error={q.error}
        data={q.data}
        isEmpty={(d) => d == null}
        onRetry={q.refetch}
        errorCopy="We couldn't load your profile. Tap to retry."
        empty={
          <EmptyState
            emoji="🙈"
            emojiLabel="hidden"
            title="Profile not found"
            body="We couldn't find your profile. Try signing in again."
          />
        }
      >
        {(me) => (me ? <ProfileBody me={me} phone={phone} editing={editing} setEditing={setEditing} /> : null)}
      </AsyncBoundary>
    </SafeAreaView>
  );
}

function ProfileBody({
  me,
  phone,
  editing,
  setEditing,
}: {
  me: User;
  phone: string | null;
  editing: boolean;
  setEditing: (v: boolean) => void;
}) {
  const pause = usePauseProfile(phone);
  const del = useDeleteAccount();
  const { show } = useToast();
  const [pauseConfirm, setPauseConfirm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const paused = !!me.is_profile_paused;

  async function applyPause(next: boolean) {
    try {
      await pause.mutateAsync(next);
      show(
        next
          ? "Profile paused — you're hidden from Find Aspirants."
          : "Profile reactivated — you're visible again!",
        next ? 'info' : 'success',
      );
    } catch (e) {
      show((e as Error)?.message || 'Could not update profile. Please try again.', 'danger');
    }
  }

  async function confirmDelete() {
    try {
      await del.mutateAsync(me.id);
      await logout();
      if (router.canDismiss()) router.dismissAll();
      router.replace(SIGN_IN_ROUTE);
    } catch (e) {
      setDeleteConfirm(false);
      show((e as Error)?.message || 'Delete failed. Please try again.', 'danger');
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      {/* Identity — avatar/name/phone/Plus, then Roll No verification and the
         paused notice grouped into the same card, matching the web's single
         left-column identity card. */}
      <Card style={styles.identityCard}>
        <View style={styles.identity}>
          <Avatar name={me.full_name} size={64} />
          <View style={styles.identityText}>
            <Text variant="h3" numberOfLines={1}>
              {me.full_name?.trim() || 'Your name'}
            </Text>
            <Text variant="small" accessibilityLabel="Your phone number">
              {formatPhone(phone)}
            </Text>
          </View>
          {me.plus_member ? <Badge label="⭐ Zenter Plus" variant="plus" /> : null}
        </View>

        {/* With the drawer gone this is the ONLY proactive route to checkout —
           every other Plus CTA appears reactively, once the member has already
           hit the free-tier gate. Keep it a full button, not a text link. */}
        {!me.plus_member ? (
          <Button
            title="⭐ Get Zenter Plus"
            variant="soft"
            style={styles.plusCta}
            onPress={() => {
              track('upgrade_cta_click', { source: 'profile' });
              router.push('/plus');
            }}
          />
        ) : null}

        {/* Verification (Story 6.2) */}
        <VerificationSection me={me} phone={phone} embedded />

        {/* Paused banner (FR-25) */}
        {paused ? (
          <View style={styles.pausedBanner}>
            <Text style={styles.pausedText} accessibilityLabel="paused">
              ⏸ Your profile is paused and hidden from Find Aspirants.
            </Text>
          </View>
        ) : null}
      </Card>

      {/* View / edit sections (Story 6.1) — editing is triggered by the pen
         icon in the header, not a button in here. */}
      <ProfileEditor
        me={me}
        phone={phone}
        editing={editing}
        onCancel={() => setEditing(false)}
        onSaved={() => setEditing(false)}
      />

      {/* Privacy & account (Story 6.3 pause + delete) */}
      <Card style={styles.account}>
        <Text variant="h3">Privacy & account</Text>
        <Text variant="bodyMuted">
          Your phone number is never shown to other aspirants until you both accept a contact
          exchange.
        </Text>
        <View style={styles.accountActions}>
          {/* Blocked users (Story 8.2) — manage/unblock. */}
          <Button
            title="Blocked users"
            icon="slash"
            variant="ghost"
            size="sm"
            onPress={() => router.push('/blocked')}
            accessibilityLabel="Manage blocked users"
            style={styles.accountActionBtn}
          />
          <Button
            title={paused ? 'Reactivate profile' : 'Pause my profile'}
            variant="ghost"
            size="sm"
            onPress={() => (paused ? applyPause(false) : setPauseConfirm(true))}
            busy={pause.isPending}
            style={styles.accountActionBtn}
          />
        </View>
        <Button
          title="Delete account"
          variant="ghost"
          size="sm"
          onPress={() => setDeleteConfirm(true)}
          style={styles.deleteBtn}
          accessibilityLabel="Delete account"
        />
        <Text variant="caption">
          Deleting removes your profile and connections permanently.
        </Text>
      </Card>

      <ConfirmDialog
        visible={pauseConfirm}
        title="Pause your profile?"
        message="Your profile will be hidden from Find Aspirants until you reactivate it."
        confirmLabel="Pause profile"
        busy={pause.isPending}
        onConfirm={async () => {
          await applyPause(true);
          setPauseConfirm(false);
        }}
        onCancel={() => setPauseConfirm(false)}
      />

      <ConfirmDialog
        visible={deleteConfirm}
        title="Delete Your Zenter Account"
        message={
          'If you wish to delete your Zenter account and associated Personal Data, you may submit a ' +
          'deletion request using the Delete Account option available in your Zenter profile.\n\n' +
          'Once you submit the request, Zenter may verify your account and will process the deletion ' +
          'in accordance with its Privacy Policy and Applicable Law.\n\n' +
          'Certain information may be retained where required or permitted by law, including information ' +
          'necessary for legal compliance, fraud prevention, security, dispute resolution, payment records, ' +
          'or other lawful purposes.\n\n' +
          'For assistance, please contact:\n' +
          'Email: support@zenter.in\n' +
          'Phone: +91 70104 41518\n\n' +
          'Zenter\n' +
          'Owned and operated by AMSEL GOLD'
        }
        confirmLabel="Delete permanently"
        danger
        busy={del.isPending}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirm(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: space[4], gap: space[3], paddingBottom: space[7] },
  identityCard: { gap: 0 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  identityText: { flex: 1, gap: 2 },
  editBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: radius.full },
  pressed: { opacity: 0.6 },
  plusCta: { marginTop: space[3] },
  pausedBanner: {
    marginTop: space[3],
    backgroundColor: badgeVariants.warning.bg,
    borderColor: colors.warning,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
  },
  pausedText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: badgeVariants.warning.fg },
  account: { gap: space[3] },
  accountActions: { flexDirection: 'row', gap: space[2] },
  accountActionBtn: { flex: 1 },
  deleteBtn: { borderColor: colors.danger },
});
