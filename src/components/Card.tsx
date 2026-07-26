import { View, ViewProps, StyleSheet } from 'react-native';
import { colors, radius, shadows } from '@/theme';

export type CardProps = ViewProps & { interactive?: boolean };

/** Base surface card (16px radius, soft xs shadow). */
export function Card({ style, ...rest }: CardProps) {
  return <View {...rest} style={[styles.card, style]} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    ...shadows.xs,
  },
});
