/**
 * Roll-Number verification section (Story 6.2, FR-24). Shows one of four states —
 * verified / pending / rejected / unsubmitted — with the documented badges and,
 * for the resubmit/first-submit cases, a Roll-Number form gated by a minimum
 * length. Requesting flips `verification_requested` on; admins approve out-of-app,
 * so the member only ever moves the profile into "pending".
 */
import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { colors, space, badgeVariants, fonts, radius } from '@/theme';
import { Text, Card, Input, Button, useToast } from '@/components';
import type { User } from '@/types/user';
import { useRequestVerification } from '@/data/useAccount';
import {
  verificationState,
  canSubmitVerification,
  MIN_ROLL_LEN,
  VERIFICATION_COPY as C,
} from './verification';

/** A small status pill; the label text (not just the emoji) carries the meaning. */
function StatusPill({ label, variant }: { label: string; variant: 'verified' | 'warning' | 'danger' }) {
  const v = badgeVariants[variant];
  return (
    <View style={[styles.pill, { backgroundColor: v.bg }]}>
      <Text style={[styles.pillText, { color: v.fg }]}>{label}</Text>
    </View>
  );
}

export function VerificationSection({ me, phone }: { me: User; phone: string | null }) {
  const state = verificationState(me);
  const showForm = canSubmitVerification(state);
  const [roll, setRoll] = useState(me.nta_application_number ?? '');
  const [err, setErr] = useState<string | null>(null);
  const verify = useRequestVerification(phone);
  const { show } = useToast();

  async function submit() {
    const value = roll.trim();
    if (value.length < MIN_ROLL_LEN) {
      setErr(C.invalidRoll);
      return;
    }
    setErr(null);
    try {
      await verify.mutateAsync(value);
      show(C.submitSuccess, 'success');
    } catch (e) {
      show((e as Error)?.message || C.submitFallback, 'danger');
    }
  }

  return (
    <Card style={styles.card}>
      <Text variant="caption" style={styles.eyebrow}>
        {C.sectionTitle}
      </Text>

      {state === 'verified' ? (
        <StatusPill label={C.verifiedBadge} variant="verified" />
      ) : state === 'pending' ? (
        <View style={styles.stateWrap}>
          <StatusPill label={C.pendingBadge} variant="warning" />
          <Text variant="caption">{C.pendingHint}</Text>
        </View>
      ) : (
        <View style={styles.stateWrap}>
          {state === 'rejected' ? (
            <>
              <StatusPill label={C.rejectedBadge} variant="danger" />
              <Text variant="caption">{C.rejectedHint}</Text>
            </>
          ) : (
            <Text variant="small">{C.encourage}</Text>
          )}
        </View>
      )}

      {showForm ? (
        <View style={styles.form}>
          <Input
            label={C.inputLabel}
            placeholder={C.inputPlaceholder}
            value={roll}
            onChangeText={(t) => {
              setRoll(t);
              if (err) setErr(null);
            }}
            error={err}
            autoCapitalize="characters"
            maxLength={20}
            returnKeyType="done"
            onSubmitEditing={submit}
          />
          <Button title={C.submitCta} size="sm" busy={verify.isPending} onPress={submit} />
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: space[3] },
  eyebrow: {
    color: colors.textMuted,
    fontFamily: fonts.bodySemibold,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  stateWrap: { gap: space[1] },
  pill: {
    borderRadius: radius.full,
    paddingHorizontal: 12,
    height: 26,
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillText: { fontFamily: fonts.bodySemibold, fontSize: 13 },
  form: { gap: space[2] },
});
