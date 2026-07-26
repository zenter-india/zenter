import { ReactNode } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { colors } from '@/theme';
import { Text } from './Text';
import { Button } from './Button';
import { Skeleton } from './Skeleton';

/**
 * Uniform loading / error / empty contract for every data screen (AD-12, FR-36).
 * Feed a query's flags + data. Never renders a blank screen or a silent failure.
 */
export type AsyncBoundaryProps<T> = {
  isLoading: boolean;
  isError: boolean;
  error?: unknown;
  data: T | undefined;
  isEmpty?: (data: T) => boolean;
  onRetry?: () => void;
  loading?: ReactNode; // custom skeleton
  empty?: ReactNode; // custom empty state
  errorCopy?: string;
  children: (data: T) => ReactNode;
};

export function AsyncBoundary<T>({ isLoading, isError, error, data, isEmpty, onRetry, loading, empty, errorCopy, children }: AsyncBoundaryProps<T>) {
  // Error is checked FIRST, before the loading/undefined branch below. A failed
  // first fetch leaves `data === undefined`, so testing that ahead of `isError`
  // swallowed every such failure as a permanent skeleton and made this retry UI
  // unreachable — the screen looked like it was loading forever.
  if (isError) {
    return (
      <View style={styles.center}>
        <Text variant="h3" style={styles.mb}>{errorCopy ?? "We couldn't load this."}</Text>
        {__DEV__ && error ? <Text variant="caption" style={styles.mb}>{String((error as Error)?.message ?? error)}</Text> : null}
        {onRetry ? <Button title="Tap to retry" variant="soft" onPress={onRetry} /> : null}
      </View>
    );
  }
  if (isLoading || data === undefined) {
    return <>{loading ?? <DefaultSkeleton />}</>;
  }
  if (isEmpty?.(data)) {
    return (
      <Animated.View style={styles.emptyFill} entering={FadeIn.duration(240)}>
        {empty ?? <View style={styles.center}><Text variant="bodyMuted">Nothing here yet.</Text></View>}
      </Animated.View>
    );
  }
  return (
    <Animated.View style={styles.fill} entering={FadeIn.duration(240)}>
      {children(data)}
    </Animated.View>
  );
}

/** Shaped like a MateCard (avatar + name + route + footer CTA) so content load
 *  doesn't jump the layout. */
function DefaultSkeleton() {
  return (
    <ScrollView contentContainerStyle={styles.skelWrap}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={styles.skelCard}>
          <View style={styles.skelHeader}>
            <Skeleton width={56} height={56} style={styles.skelAvatar} />
            <View style={styles.skelHeadText}>
              <Skeleton width={150} height={18} />
              <Skeleton width={90} height={12} />
            </View>
          </View>
          <Skeleton width="70%" height={14} />
          <Skeleton width="55%" height={14} />
          <Skeleton width="100%" height={44} style={styles.skelFooter} />
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  // Empty states center in the available space (not stranded at the top).
  emptyFill: { flex: 1, justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  mb: { marginBottom: 8, textAlign: 'center' },
  skelWrap: { padding: 16, gap: 14 },
  skelCard: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 10 },
  skelHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  skelAvatar: { borderRadius: 28 },
  skelHeadText: { gap: 6 },
  skelFooter: { borderRadius: 12, marginTop: 6 },
});
