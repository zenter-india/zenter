import { Feather } from '@expo/vector-icons';
import { colors } from '@/theme';

/**
 * App icon set (Stitch Core) — clean Feather line icons, replacing emoji for all
 * UI chrome (nav, back, send, settings, block, filter…). Emoji is kept ONLY for
 * the travel/stay logistics tags, which are deliberately illustrative.
 *
 * Font-based (no react-native-svg, no native rebuild). Common names used:
 *  inbox · search · users · message-circle · message-square · chevron-left ·
 *  send · settings · slash · phone · check · star · lock · sliders · arrow-right ·
 *  x · user · edit-2 · trash-2 · shield · log-out.
 */
export type IconName = React.ComponentProps<typeof Feather>['name'];

export type IconProps = {
  name: IconName;
  size?: number;
  color?: string;
};

export function Icon({ name, size = 22, color = colors.text }: IconProps) {
  return <Feather name={name} size={size} color={color} />;
}
