/**
 * Contact-exchange control for a Connections row (Epic 7 / Stories 7.2 + 7.3,
 * FR-21/FR-22, AD-8). The compact sibling of `ExchangeBanner`: same handshake,
 * rendered as inline buttons beside "Open Chat".
 *
 * States:
 *   - none / declined → "Request Contact" (verification-gated, Story 7.2).
 *   - pending, I am the responder → Accept / Decline.
 *   - pending, I am the requester → disabled "Requested" chip.
 *   - accepted → the revealed number (mono) + native Call (Story 7.3).
 *
 * Needs the conversation id for the connection (exchange keys on conversation).
 * The Connections screen resolves it from the conversations list and passes it
 * in; a null `convId` (no conversation yet) renders nothing.
 */
import { useState, type ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import { colors, space, fonts } from '@/theme';
import { Text, Button, useToast } from '@/components';
import { useMyUserId } from '@/features/connections/useMyUserId';
import { useExchange, useRequestExchange, useRespondExchange } from '@/data/useExchange';
import { formatPhone } from '@/domain/masking';
import { ConfirmDialog } from '@/features/profile/ConfirmDialog';
import { track } from '@/lib/observability';

export function ExchangeCallButton({
  convId,
  otherName,
}: {
  convId: string | null | undefined;
  otherName?: string;
}) {
  const myUserId = useMyUserId();
  const ex = useExchange(convId);
  const requestEx = useRequestExchange(convId ?? '');
  const respondEx = useRespondExchange(convId ?? '');
  const { show } = useToast();
  const [verifyOpen, setVerifyOpen] = useState(false);

  const data = ex.data;
  if (!convId || !data) return null; // no conversation, or state not resolved yet

  const name = otherName ?? 'aspirant';

  const onRequest = () => {
    if (!ex.isVerified) {
      track('rollno_verify_prompt_shown', { source: 'request' });
      setVerifyOpen(true);
      return;
    }
    requestEx.mutate(undefined, { onError: (e) => show(e.message, 'danger') });
  };

  const onRespond = (accept: boolean) => {
    if (!data.exchangeId) return;
    respondEx.mutate(
      { exchangeId: data.exchangeId, accept },
      { onError: (e) => show(e.message, 'danger') },
    );
  };

  const onCall = () => {
    if (!data.otherPhone) return;
    Linking.openURL(`tel:${data.otherPhone}`).catch(() => show('Could not start the call.', 'danger'));
  };

  const iAmResponder = !!myUserId && data.responderId === myUserId;

  let control: ReactNode = null;

  if (data.status === 'accepted') {
    control = (
      <View style={styles.accepted}>
        <Text
          variant="small"
          style={styles.phone}
          numberOfLines={1}
          accessibilityLabel={`Phone number ${formatPhone(data.otherPhone)}`}
        >
          {formatPhone(data.otherPhone)}
        </Text>
        <Button
          title="Call"
          icon="phone"
          variant="secondary"
          size="sm"
          onPress={onCall}
          accessibilityLabel={`Call ${name}`}
        />
      </View>
    );
  } else if (data.status === 'pending' && iAmResponder) {
    control = (
      <View style={styles.pair}>
        <Button title="Accept" size="sm" busy={respondEx.isPending} onPress={() => onRespond(true)} />
        <Button
          title="Decline"
          variant="ghost"
          size="sm"
          disabled={respondEx.isPending}
          onPress={() => onRespond(false)}
        />
      </View>
    );
  } else if (data.status === 'pending') {
    control = <Button title="⏳ Requested" variant="ghost" size="sm" disabled onPress={() => {}} />;
  } else {
    // none | declined
    control = (
      <Button
        title="Request Contact"
        icon="phone"
        variant="soft"
        size="sm"
        busy={requestEx.isPending}
        onPress={onRequest}
        style={styles.grow}
        accessibilityLabel="Request contact exchange"
      />
    );
  }

  return (
    <>
      {control}
      <ConfirmDialog
        visible={verifyOpen}
        title="Verify your Roll No first"
        message="To reveal contact details, please verify your Roll Number on your profile. This builds trust between aspirants and keeps the community safe."
        confirmLabel="Verify Roll No"
        cancelLabel="Maybe later"
        onConfirm={() => {
          setVerifyOpen(false);
          router.push('/profile');
        }}
        onCancel={() => setVerifyOpen(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  accepted: { flexDirection: 'row', alignItems: 'center', gap: space[2], flex: 1 },
  pair: { flexDirection: 'row', alignItems: 'center', gap: space[2], flex: 1 },
  phone: { fontFamily: fonts.mono, color: colors.text, flex: 1 },
  grow: { flex: 1 },
});
