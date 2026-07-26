import { View, StyleSheet } from 'react-native';
import { colors, radius } from '@/theme';
import { Text } from './Text';
import { Button } from './Button';

export type EmptyStateProps = {
  emoji: string;
  emojiLabel: string; // accessible label for the emoji
  title: string;
  body?: string;
  ctaTitle?: string;
  onCta?: () => void;
};

export function EmptyState({ emoji, emojiLabel, title, body, ctaTitle, onCta }: EmptyStateProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.tile}>
        <Text accessibilityLabel={emojiLabel} style={styles.emoji}>{emoji}</Text>
      </View>
      <Text variant="h3" style={styles.title}>{title}</Text>
      {body ? <Text variant="bodyMuted" style={styles.body}>{body}</Text> : null}
      {ctaTitle && onCta ? <Button title={ctaTitle} onPress={onCta} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12, borderWidth: 1, borderColor: colors.borderStrong, borderStyle: 'dashed', borderRadius: radius.lg, margin: 16 },
  tile: { width: 64, height: 64, borderRadius: radius.lg, backgroundColor: colors.primary100, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 28 },
  title: { textAlign: 'center' },
  body: { textAlign: 'center' },
});
