/**
 * First-run privacy reassurance strip on the feed (D1). The product's core trust
 * question — "is my number safe if I reach out to a stranger?" — was only
 * answered on the mate detail sheet, *after* the user had already decided to
 * engage. This surfaces the promise up front, once, dismissible per user.
 *
 * Purely presentational + a one-time AsyncStorage flag; no network.
 */
import { useEffect, useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { colors, space, radius, fonts } from '@/theme';
import { Text, Icon } from '@/components';
import { storage } from '@/lib/storage';

const KEY = 'privacyNoticeDismissed';

export function PrivacyReassurance({ userId }: { userId?: string | null }) {
  // `null` = still loading the flag (render nothing to avoid a flash), then
  // true/false once known.
  const [visible, setVisible] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    storage.getString(KEY, userId ?? undefined).then((v) => {
      if (alive) setVisible(v !== '1');
    });
    return () => {
      alive = false;
    };
  }, [userId]);

  if (!visible) return null;

  const dismiss = () => {
    setVisible(false);
    void storage.setString(KEY, '1', userId ?? undefined);
  };

  return (
    <View style={styles.strip}>
      <Icon name="lock" size={16} color={colors.secondary} />
      <Text variant="small" color={colors.textMuted} style={styles.text}>
        Your number stays private until you <Text style={styles.em}>both</Text> accept.
      </Text>
      <Pressable
        onPress={dismiss}
        accessibilityRole="button"
        accessibilityLabel="Dismiss privacy notice"
        hitSlop={10}
        style={({ pressed }) => [styles.close, pressed && styles.pressed]}
      >
        <Icon name="x" size={16} color={colors.textSubtle} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    marginHorizontal: space[4],
    marginTop: space[3],
    paddingVertical: space[2],
    paddingHorizontal: space[3],
    backgroundColor: colors.secondary50,
    borderWidth: 1,
    borderColor: colors.secondary100,
    borderRadius: radius.md,
  },
  text: { flex: 1 },
  em: { fontFamily: fonts.bodySemibold, color: colors.text },
  close: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6 },
});
