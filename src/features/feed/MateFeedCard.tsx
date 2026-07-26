/**
 * One feed row: the foundation {@link MateCard} (showpiece route timeline + gold
 * Plus variant) mapped from a {@link FeedItem}, tappable to open the profile
 * preview sheet, with the relationship CTA in its footer.
 *
 * The footer CTA is the shared {@link ConnectButton} (Epic 4 wires its behaviour);
 * `rel` is read off the FeedItem the matching layer already tagged, so the card
 * reflects Request / Sent / Connected / Accept without a second lookup.
 */
import { memo, useCallback } from 'react';
import { router } from 'expo-router';
import { MateCard } from '@/components';
import type { FeedItem } from '@/domain/matching';
import { ConnectButton } from '@/features/connections/ConnectButton';
import { toMateCardData } from './enrich';

export type MateFeedCardProps = { item: FeedItem };

function MateFeedCardBase({ item }: MateFeedCardProps) {
  const onPress = useCallback(() => {
    router.push({ pathname: '/mate/[id]', params: { id: item.id } });
  }, [item.id]);

  return (
    <MateCard
      data={toMateCardData(item)}
      onPress={onPress}
      footer={<ConnectButton userId={item.id} rel={item.rel} />}
    />
  );
}

export const MateFeedCard = memo(MateFeedCardBase);
