/**
 * Profile (self) screen — Epic 6. Reached from the Find Aspirants header avatar
 * (ProfileMenuButton) and pushed onto the root stack over the tabs.
 *
 * Composes:
 *  - Story 6.1: identity card (initials avatar, name, own phone) + view/edit
 *    sections (ProfileEditor) reading the FULL self record (qk.profile), which is
 *    never overwritten by a partial fetch (AD-2).
 *  - Story 6.2: Roll-Number verification (VerificationSection).
 *  - Story 6.3: pause / reactivate (amber banner + confirm). Delete lives in
 *    Settings (Flow 7: "Settings/About → Delete Account"), reached via the header
 *    gear.
 */
import { useState } from 'react';
import { View, ScrollView, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors, space, radius, fonts, badgeVariants } from '@/theme';
import { Text, Avatar, Badge, Button, Card, EmptyState, AsyncBoundary, useToast } from '@/components';
import { useSession } from '@/stores/session';
import { useProfile } from '@/data/useProfile';
import { usePauseProfile } from '@/data/useAccount';
import { formatPhone } from '@/domain/masking';
import { FEED_ROUTE } from '@/features/auth/routing';
import type { User } from '@/types/user';
import { track } from '@/lib/observability';
import { ScreenHeader } from '@/features/profile/ScreenHeader';
import { VerificationSection } from '@/features/profile/VerificationSection';
import { ProfileEditor } from '@/features/profile/ProfileEditor';
import { ConfirmDialog } from '@/features/profile/ConfirmDialog';

export default function ProfileScreen() {
  const { phone } = useSession();
  const q = useProfile(phone);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace(FEED_ROUTE));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        title="My profile"
        onBack={goBack}
        rightSlot={
          <Pressable
            onPress={() => router.push('/settings')}
            accessibilityRole="button"
            accessibilityLabel="Settings"
            hitSlop={8}
            style={({ pressed }) => [styles.gear, pressed && styles.pressed]}
          >
            <Text style={styles.gearGlyph} accessibilityElementsHidden importantForAccessibility="no">
              ⚙
            </Text>
          </Pressable>
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
        {(me) => (me ? <ProfileBody me={me} phone={phone} /> : null)}
      </AsyncBoundary>
    </SafeAreaView>
  );
}

function ProfileBody({ me, phone }: { me: User; phone: string | null }) {
  const pause = usePauseProfile(phone);
  const { show } = useToast();
  const [pauseConfirm, setPauseConfirm] = useState(false);
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

  return (
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      {/* Identity */}
      <Card style={styles.identity}>
        <Avatar name={me.full_name} size={64} />
        <View style={styles.identityText}>
          <Text variant="h3" numberOfLines={1}>
            {me.full_name?.trim() || 'Your name'}
          </Text>
          <Text variant="small" accessibilityLabel="Your phone number">
            {formatPhone(phone)}
          </Text>
        </View>
        {me.plus_member ? (
          <Badge label="⭐ Zenter Plus" variant="plus" />
        ) : (
          /* Ports the web's profile.html "Get Zenter Plus →" link. Together with
             the drawer entry this is the only proactive route to checkout — the
             other CTAs only appear once the member has already hit the gate. */
          <Pressable
            onPress={() => {
              track('upgrade_cta_click', { source: 'profile' });
              router.push('/plus');
            }}
            accessibilityRole="button"
            accessibilityLabel="Get Zenter Plus"
            hitSlop={8}
          >
            <Text variant="small" color={colors.primary} style={styles.plusLink}>
              Get Zenter Plus →
            </Text>
          </Pressable>
        )}
      </Card>

      {/* Paused banner (FR-25) */}
      {paused ? (
        <View style={styles.pausedBanner}>
          <Text style={styles.pausedText} accessibilityLabel="paused">
            ⏸ Your profile is paused and hidden from Find Aspirants.
          </Text>
        </View>
      ) : null}

      {/* Verification (Story 6.2) */}
      <VerificationSection me={me} phone={phone} />

      {/* View / edit sections (Story 6.1) */}
      <ProfileEditor me={me} phone={phone} />

      {/* Privacy & account (Story 6.3 pause; delete lives in Settings) */}
      <Card style={styles.account}>
        <Text variant="h3">Privacy & account</Text>
        <Text variant="bodyMuted">
          Your phone number is never shown to other aspirants until you both accept a contact
          exchange.
        </Text>
        <Button
          title={paused ? 'Reactivate profile' : 'Pause my profile'}
          variant={paused ? 'primary' : 'soft'}
          onPress={() => (paused ? applyPause(false) : setPauseConfirm(true))}
          busy={pause.isPending}
        />
        {/* Blocked users (Story 8.2) — manage/unblock. */}
        <Button
          title="Blocked users"
          icon="slash"
          variant="ghost"
          onPress={() => router.push('/blocked')}
          accessibilityLabel="Manage blocked users"
        />
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  gear: { width: 32, height: 44, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6 },
  gearGlyph: { fontSize: 20, color: colors.textMuted },
  scroll: { padding: space[4], gap: space[3], paddingBottom: space[7] },
  identity: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  identityText: { flex: 1, gap: 2 },
  plusLink: { fontFamily: fonts.bodySemibold },
  pausedBanner: {
    backgroundColor: badgeVariants.warning.bg,
    borderColor: colors.warning,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
  },
  pausedText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: badgeVariants.warning.fg },
  account: { gap: space[3] },
});
