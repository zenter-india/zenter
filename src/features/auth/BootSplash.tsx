import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { colors } from '@/theme';
import { Text } from '@/components';

/**
 * In-app boot splash shown while the gated boot resolves the session + profile
 * (Story 2.2) — brand-first so a returning member sees no auth flash (FR-4).
 * The native splash hands off to this once fonts are ready.
 */
export function BootSplash() {
  return (
    <View style={styles.wrap}>
      <Text variant="h1" color={colors.white} style={styles.wordmark} accessibilityLabel="Zenter">
        Zenter
      </Text>
      <ActivityIndicator color={colors.white} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', gap: 20 },
  wordmark: { color: colors.white },
});
