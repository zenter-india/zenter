import { View, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius, shadows, fonts, space } from '@/theme';
import { Text } from './Text';
import { Avatar } from './Avatar';
import { Badge } from './Badge';
import { PressableScale } from './PressableScale';

export type MateCardData = {
  name: string;
  homePlace?: string; // "Pune, Maharashtra" — district bold, state muted
  centreName?: string; // free-text venue, e.g. "VANA VANI MATRICULATION HR SEC SCHOOL"
  centrePlace?: string; // "Nagpur, Maharashtra"
  travelIcon?: string; // "🚂"
  travelLabel?: string; // "Train"
  stayIcon?: string; // "🏨"
  stayLabel?: string; // "Needs stay"
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

/**
 * Core feed/connection unit — a 1:1 port of the website's `mateCard`
 * (js/dashboard.js + css/dashboard.css `.hm-mate`) so both platforms read
 * identically: identity row with a rule under it, a two-stop route timeline
 * with emoji bubbles beside a dashed divider and the travel/stay badge cards,
 * then a joined-date ↔ CTA footer. Plus is a corner badge plus a warm amber
 * card wash — never a gold background.
 */
export function MateCard({ data, onPress, footer }: MateCardProps) {
  const hasBadges = !!(data.travelLabel || data.stayLabel);
  const hasFooter = !!(data.joined || footer);

  const inner = (
    <>
      {data.plus ? (
        <LinearGradient
          colors={[colors.plusTint, colors.surface]}
          locations={[0, 0.6]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.plusWash}
          pointerEvents="none"
        />
      ) : null}

      {/* Identity row: avatar · name · gender + verified badges */}
      <View style={styles.head}>
        <Avatar name={data.name} size={44} />
        <View style={styles.headInfo}>
          <Text numberOfLines={1} style={[styles.name, data.plus ? styles.namePlusPad : null]}>
            {data.name}
          </Text>
          <View style={styles.badges}>
            {data.gender ? (
              <Badge
                label={data.gender}
                variant={data.gender === 'Female' ? 'female' : data.gender === 'Male' ? 'male' : 'neutral'}
              />
            ) : null}
            {data.verified ? <Badge label="✓ Verified" variant="verifiedSolid" /> : null}
          </View>
        </View>
      </View>

      {/* Body: route timeline (left) + dashed divider + badge cards (right) */}
      <View style={styles.body}>
        <View style={styles.routeWrap}>
          {/* Icon track: home → dashed connector with dots → exam centre */}
          <View style={styles.track}>
            <View style={styles.bubble}><Text style={styles.bubbleIcon}>🏠</Text></View>
            <View style={styles.connector}>
              <View style={[styles.dot, { backgroundColor: colors.routeHome }]} />
              <View style={styles.dashes} />
              <View style={[styles.dot, { backgroundColor: colors.danger }]} />
            </View>
            <View style={styles.bubble}><Text style={styles.bubbleIcon}>📋</Text></View>
          </View>

          {/* Text column: home loc (top, beside the home bubble) ↔ exam info (bottom) */}
          <View style={styles.routeInfo}>
            <LocText place={data.homePlace ?? '—'} />
            <View style={styles.examInfo}>
              {data.centreName ? (
                <Text numberOfLines={2} style={styles.centreName}>{data.centreName}</Text>
              ) : null}
              {data.centrePlace ? (
                <Text numberOfLines={1} style={styles.centreLoc}>📍 {data.centrePlace}</Text>
              ) : null}
            </View>
          </View>
        </View>

        {hasBadges ? <View style={styles.vDivider} /> : null}
        {hasBadges ? (
          <View style={styles.badgeCards}>
            {data.travelLabel ? <BadgeCard icon={data.travelIcon} label={data.travelLabel} /> : null}
            {data.stayLabel ? <BadgeCard icon={data.stayIcon} label={data.stayLabel} /> : null}
          </View>
        ) : null}
      </View>

      {/* Footer: join date · connection CTA */}
      {hasFooter ? (
        <View style={styles.footer}>
          <Text numberOfLines={1} style={styles.joined}>{data.joined ?? ''}</Text>
          {footer ? <View style={styles.footerCta}>{footer}</View> : null}
        </View>
      ) : null}

      {/* Corner Plus badge — overlays the head row, like the web's absolute pill. */}
      {data.plus ? (
        <View style={styles.plusBadge} pointerEvents="none">
          <Badge label="⭐ Plus" variant="plus" />
        </View>
      ) : null}
    </>
  );

  const cardStyle = [styles.card, data.plus ? styles.cardPlus : null];

  return (
    <Animated.View entering={FadeInDown.springify().damping(20).mass(0.7)}>
      {onPress ? (
        <PressableScale onPress={onPress} haptic="selection" scaleTo={0.98} dimTo={0.97} accessibilityRole="button" style={cardStyle}>
          {inner}
        </PressableScale>
      ) : (
        <View style={cardStyle}>{inner}</View>
      )}
    </Animated.View>
  );
}

/**
 * "District, State" with the district bold and the state muted — the web card's
 * `<strong>district</strong><span class="hm-loc-state">, state</span>`. The
 * string always arrives pre-joined, so split on the first ", " and fall back to
 * an all-bold single segment when there is no state half.
 */
function LocText({ place }: { place: string }) {
  const i = place.indexOf(', ');
  if (i === -1) return <Text style={styles.homeLoc}>{place}</Text>;
  return (
    <Text style={styles.homeLoc}>
      {place.slice(0, i)}
      <Text style={styles.locState}>{place.slice(i)}</Text>
    </Text>
  );
}

/** One travel/stay tile in the card's right column (web `.hm-mate__badge-card`). */
function BadgeCard({ icon, label }: { icon?: string; label: string }) {
  return (
    <View style={styles.badgeCard}>
      {icon ? <Text style={styles.badgeIcon}>{icon}</Text> : null}
      <Text numberOfLines={1} style={styles.badgeLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    gap: space[3],
    ...shadows.card,
  },
  cardPlus: { borderWidth: 1.5, borderColor: colors.plusBorder },
  plusWash: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: radius.lg },

  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headInfo: { flex: 1 },
  name: { fontFamily: fonts.bodyBold, fontSize: 16, lineHeight: 21, color: colors.text, marginBottom: 4 },
  namePlusPad: { paddingRight: 62 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  plusBadge: { position: 'absolute', top: 12, right: 12, zIndex: 2 },

  body: { flexDirection: 'row', gap: 10, alignItems: 'stretch', minHeight: 88 },
  routeWrap: { flexDirection: 'row', gap: 10, flex: 1, alignItems: 'stretch' },
  track: { alignItems: 'center' },
  bubble: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.xs,
  },
  bubbleIcon: { fontSize: 17, lineHeight: 22 },
  connector: { flex: 1, alignItems: 'center', paddingVertical: 3, minHeight: 18 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dashes: { flex: 1, width: 2, borderLeftWidth: 2, borderStyle: 'dashed', borderColor: colors.borderStrong, marginVertical: 3 },

  routeInfo: { flex: 1, justifyContent: 'space-between' },
  homeLoc: { fontFamily: fonts.bodyBold, fontSize: 13, lineHeight: 18, color: colors.text, marginTop: 2 },
  locState: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },
  examInfo: { marginBottom: 2 },
  centreName: { fontFamily: fonts.bodyBold, fontSize: 13, lineHeight: 17, color: colors.text, marginBottom: 1 },
  centreLoc: { fontFamily: fonts.body, fontSize: 11, lineHeight: 15, color: colors.textMuted },

  vDivider: { width: 1, borderLeftWidth: 1, borderStyle: 'dashed', borderColor: colors.border, alignSelf: 'stretch' },
  badgeCards: { gap: 6, justifyContent: 'center' },
  badgeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: 6,
    paddingHorizontal: 10,
    minWidth: 82,
  },
  badgeIcon: { fontSize: 15, lineHeight: 19 },
  badgeLabel: { fontFamily: fonts.bodyMedium, fontSize: 11, lineHeight: 15, color: colors.text, flexShrink: 1 },

  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    paddingTop: space[3],
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  joined: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16, color: colors.textSubtle, flexShrink: 1 },
  footerCta: { flexShrink: 0 },
});
