/**
 * Contact-exchange banner (Epic 7 / Stories 7.2 + 7.3, FR-21/FR-22, AD-8).
 * Rendered as a full-width strip below the chat header. Reflects the whole
 * handshake lifecycle for the conversation and is the ONLY surface in chat where
 * a phone number is revealed — and only once the exchange is `accepted`.
 *
 * States (ported from `js/chat.js` loadExchangeStatus + handleExchangeRequest):
 *   - none / declined → "Request Contact" (declined can retry).
 *   - pending, I am the responder → "{name} wants to exchange…" + Accept / Decline.
 *   - pending, I am the requester → "Waiting for them to accept…".
 *   - accepted → "📞 Contact exchanged!" + the full number (mono) + native Call.
 *
 * Verification gate (Story 7.2): tapping Request while unverified opens a prompt
 * to Roll-No verification (Profile) and sends NOTHING. The counterpart may accept
 * regardless of their own verification (matches web).
 */
import { useState, type ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import { colors, radius, space, fonts } from '@/theme';
import { Text, Button, useToast } from '@/components';
import { useMyUserId } from '@/features/connections/useMyUserId';
import { useExchange, useRequestExchange, useRespondExchange } from '@/data/useExchange';
import { formatPhone } from '@/domain/masking';
import { ConfirmDialog } from '@/features/profile/ConfirmDialog';
import { track } from '@/lib/observability';

export function ExchangeBanner({ convId, otherName }: { convId: string; otherName?: string }) {
  const myUserId = useMyUserId();
  const ex = useExchange(convId);
  const requestEx = useRequestExchange(convId);
  const respondEx = useRespondExchange(convId);
  const { show } = useToast();
  const [verifyOpen, setVerifyOpen] = useState(false);

  const data = ex.data;
  if (!data) return null; // handshake state not resolved yet — show nothing

  const name = otherName ?? 'This aspirant';

  const onRequest = () => {
    // Gate the REQUEST side on verification (Story 7.2) — do not send if unverified.
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

  let content: ReactNode = null;

  if (data.status === 'accepted') {
    content = (
      <View style={styles.rowBetween}>
        <View style={styles.grow}>
          <Text variant="small" color={colors.textMuted}>📞 Contact exchanged!</Text>
          <Text style={styles.phone} accessibilityLabel={`Phone number ${formatPhone(data.otherPhone)}`}>
            {formatPhone(data.otherPhone)}
          </Text>
        </View>
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
    content = (
      <View style={styles.stack}>
        <Text variant="small" color={colors.text}>
          {`${name} wants to exchange contact details.`}
        </Text>
        <View style={styles.actions}>
          <Button
            title="Accept"
            size="sm"
            busy={respondEx.isPending}
            onPress={() => onRespond(true)}
          />
          <Button
            title="Decline"
            variant="ghost"
            size="sm"
            disabled={respondEx.isPending}
            onPress={() => onRespond(false)}
          />
        </View>
      </View>
    );
  } else if (data.status === 'pending') {
    // I sent it — waiting on them.
    content = (
      <Text variant="small" color={colors.textMuted}>
        ⏳ Waiting for them to accept your contact request.
      </Text>
    );
  } else {
    // none | declined → offer (or retry) a request.
    content = (
      <View style={styles.rowBetween}>
        <Text variant="small" color={colors.textMuted} style={styles.grow}>
          Exchange phone numbers when you&apos;re both ready.
        </Text>
        <Button
          title="Request Contact"
          icon="phone"
          variant="soft"
          size="sm"
          busy={requestEx.isPending}
          onPress={onRequest}
          accessibilityLabel="Request contact exchange"
        />
      </View>
    );
  }

  return (
    <View style={styles.banner}>
      {content}

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
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginHorizontal: space[4],
    marginTop: space[3],
    paddingHorizontal: space[4],
    paddingVertical: space[3],
  },
  rowBetween: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  stack: { gap: space[2] },
  actions: { flexDirection: 'row', gap: space[2] },
  grow: { flex: 1 },
  phone: { fontFamily: fonts.mono, fontSize: 16, color: colors.text, marginTop: 2 },
});
