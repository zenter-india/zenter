import { Text as RNText, TextProps as RNTextProps, StyleSheet } from 'react-native';
import { textVariants, TextVariant } from '@/theme';

export type AppTextProps = RNTextProps & {
  variant?: TextVariant;
  color?: string;
};

/** Themed Text. Always use this instead of raw <Text> so type roles + fonts stay consistent. */
export function Text({ variant = 'body', color, style, ...rest }: AppTextProps) {
  return <RNText {...rest} style={[styles[variant], color ? { color } : null, style]} />;
}

const styles = StyleSheet.create(textVariants as Record<TextVariant, object>);
