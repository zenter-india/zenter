/**
 * Header entry point to the self-profile (EXPERIENCE.md IA: "Profile (self) —
 * Header menu"). An initials avatar button, mounted in the Find Aspirants header,
 * that pushes the Profile screen. Reads the FULL self record (qk.profile) — the
 * same warm, deduped query the rest of the app uses — for the initials.
 */
import { Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Avatar } from '@/components';
import { useSession } from '@/stores/session';
import { useProfile } from '@/data/useProfile';

export function ProfileMenuButton() {
  const { phone } = useSession();
  const { data } = useProfile(phone);
  return (
    <Pressable
      onPress={() => router.push('/profile')}
      accessibilityRole="button"
      accessibilityLabel="Your profile and settings"
      hitSlop={8}
      style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
    >
      <Avatar name={data?.full_name} size={36} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { borderRadius: 999 },
  pressed: { opacity: 0.7 },
});
