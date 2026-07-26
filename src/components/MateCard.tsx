import { View, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { colors, radius, shadows, fonts, space } from '@/theme';
import { Text } from './Text';
import { Avatar } from './Avatar';
import { Badge } from './Badge';
import { PressableScale } from './PressableScale';

export type MateCardData = {
  name: string;
  homePlace?: string; // "Pune, Maharashtra"
  centrePlace?: string; // "Nagpur, Maharashtra"
  travelLabel?: string; // "🚆 By train"
  stayLabel?: string; // "🏨 Need accommodation"
  gender?: 'Male' | 'Female' | 'Other' | null;
  verified?: boolean;
  plus?: boolean;
  joined?: string;
};

export type MateCardProps = {
  data: MateCardData;
  onPress?: () => void;
  footer?: React.ReactNode; // the connection CTA button
};

/** Core feed/connection unit (Stitch aspirant-card): clean white card with a warm
 *  ambient glow, a two-stop route timeline, blue logistics chips, and status
 *  badges. Plus is a badge only — no gold card background. */
export function MateCard({ data, onPress, footer }: MateCardProps) {
  const inner = (
    <>
      <View style={styles.header}>
        <Avatar name={data.name} size={56} />
        <View style={styles.headText}>
          <View style={styles.nameRow}>
            <Text variant="h3" numberOfLines={1} style={styles.name}>{data.name}</Text>
            {data.plus ? <Badge label="★ Plus" variant="plus" /> : null}
            {data.verified ? <Badge label="✓ Verified" variant="verified" /> : null}
          </View>
          {data.joined ? <Text variant="caption" style={styles.joined}>{data.joined}</Text> : null}
        </View>
        {data.gender ? <Badge label={data.gender} variant={data.gender === 'Female' ? 'female' : data.gender === 'Male' ? 'male' : 'neutral'} /> : null}
      </View>

      {(data.homePlace || data.centrePlace) ? (
        <View style={styles.route}>
          <View style={styles.stop}>
            <View style={[styles.dot, { backgroundColor: colors.routeHome }]} />
            <View style={styles.stopText}>
              <Text style={styles.stopLabel}>Home</Text>
              <Text variant="small" color={colors.text} style={styles.stopPlace}>{data.homePlace ?? '—'}</Text>
            </View>
          </View>
          <View style={styles.connector} />
          <View style={styles.stop}>
            <View style={[styles.dot, { backgroundColor: colors.danger }]} />
            <View style={styles.stopText}>
              <Text style={styles.stopLabel}>Exam centre</Text>
              <Text variant="small" color={colors.text} numberOfLines={2} style={styles.stopPlace}>{data.centrePlace ?? '—'}</Text>
            </View>
          </View>
        </View>
      ) : null}

      {(data.travelLabel || data.stayLabel) ? (
        <View style={styles.chips}>
          {data.travelLabel ? <View style={styles.chip}><Text style={styles.chipText}>{data.travelLabel}</Text></View> : null}
          {data.stayLabel ? <View style={styles.chip}><Text style={styles.chipText}>{data.stayLabel}</Text></View> : null}
        </View>
      ) : null}

      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </>
  );

  return (
    <Animated.View entering={FadeInDown.springify().damping(20).mass(0.7)}>
      {onPress ? (
        <PressableScale onPress={onPress} haptic="selection" scaleTo={0.98} dimTo={0.97} accessibilityRole="button" style={styles.card}>
          {inner}
        </PressableScale>
      ) : (
        <View style={styles.card}>{inner}</View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardWarmBorder,
    padding: 20,
    ...shadows.card,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headText: { flex: 1, gap: 3 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  name: { flexShrink: 1 },
  joined: { color: colors.textSubtle },
  route: { marginTop: 18, paddingLeft: 2, gap: space[4] },
  stop: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  dot: { width: 14, height: 14, borderRadius: 7, marginTop: 2 },
  stopText: { flex: 1, gap: 1 },
  stopLabel: { fontFamily: fonts.bodySemibold, fontSize: 10, letterSpacing: 0.6, color: colors.textSubtle, textTransform: 'uppercase' },
  stopPlace: { fontFamily: fonts.bodyMedium },
  connector: { width: 2, height: 18, borderLeftWidth: 2, borderColor: colors.borderStrong, borderStyle: 'dashed', marginLeft: 6, marginVertical: -8 },
  chips: { flexDirection: 'row', gap: 8, marginTop: 18, flexWrap: 'wrap' },
  chip: { backgroundColor: colors.chipBg, borderWidth: 1, borderColor: colors.chipBorder, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 7 },
  chipText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.chipText },
  footer: { marginTop: 18 },
});
