/**
 * Self-profile view/edit sections (Story 6.1, FR-23). Ported from the web
 * `js/profile.js` section model:
 *   - Permanent (locked): full name, gender, exam type — shown, never editable.
 *   - Editable: college, exam-centre fields, travel/stay.
 * One "Edit profile" toggle flips the whole card set into inputs with Save /
 * Cancel (web `enterEditAll` / `saveAll` / `exitEditAll`). Saving validates the
 * required exam-centre fields and persists via `useUpdateProfile` keyed by phone;
 * for a UPSC CMS centre change the exam-centre state is re-derived from the centre
 * (getCmsCentreState), exactly like web. A failure keeps the member in edit mode
 * with an inline error and no partial write.
 */
import { useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { colors, space, fonts, radius } from '@/theme';
import { Text, Card, Input, Button, useToast } from '@/components';
import { SelectField } from '@/features/onboarding/SelectField';
import { TRAVEL_OPTIONS, STAY_OPTIONS, VALIDATION, type SelectOption } from '@/features/onboarding/options';
import { statesSorted, districtsFor, cmsCentres, getCmsCentreState } from '@/domain/location';
import { examLabel } from '@/domain/gating';
import { useUpdateProfile } from '@/data/useProfile';
import type { User } from '@/types/user';
import type { UpsertUserPayload } from '@/api/users';

const STATE_OPTIONS: SelectOption[] = statesSorted().map((s) => ({ value: s, label: s }));
const CMS_OPTIONS: SelectOption[] = cmsCentres().map((c) => ({ value: c, label: c }));

const displayOf = (opts: SelectOption[], v?: string | null): string | null =>
  v ? opts.find((o) => o.value === v)?.label ?? v : null;

type Form = {
  college: string;
  exam_centre_state: string | null;
  exam_centre_district: string | null; // NEET: district · UPSC CMS: centre name
  exam_center: string; // free-text venue (NEET only)
  travel_mode: string | null;
  stay_plan: string | null;
};

function initialForm(me: User): Form {
  return {
    college: me.college ?? '',
    exam_centre_state: me.exam_centre_state ?? me.state ?? null,
    exam_centre_district: me.exam_centre_district ?? me.district ?? null,
    exam_center: me.exam_center ?? '',
    travel_mode: me.travel_mode ?? null,
    stay_plan: me.stay_plan ?? null,
  };
}

export function ProfileEditor({ me, phone }: { me: User; phone: string | null }) {
  const isCms = me.exam_type === 'UPSC CMS';
  const update = useUpdateProfile(phone);
  const { show } = useToast();

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Form>(() => initialForm(me));
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [saveError, setSaveError] = useState<string | null>(null);

  const districtOptions = useMemo<SelectOption[]>(
    () => districtsFor(form.exam_centre_state).map((d) => ({ value: d, label: d })),
    [form.exam_centre_state],
  );

  const patch = (p: Partial<Form>) => setForm((prev) => ({ ...prev, ...p }));

  function startEdit() {
    setForm(initialForm(me));
    setErrors({});
    setSaveError(null);
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setErrors({});
    setSaveError(null);
  }

  function validate(): Record<string, string | null> {
    if (isCms) {
      return { exam_centre_district: form.exam_centre_district ? null : VALIDATION.cmsCentre };
    }
    return {
      exam_centre_state: form.exam_centre_state ? null : VALIDATION.examState,
      exam_centre_district: form.exam_centre_district ? null : VALIDATION.examDistrict,
    };
  }

  async function save() {
    if (!phone) {
      setSaveError('Cannot read your phone number — please sign in again.');
      return;
    }
    const next = validate();
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;
    setSaveError(null);

    const centre = isCms
      ? {
          exam_centre_district: form.exam_centre_district,
          exam_centre_state: getCmsCentreState(form.exam_centre_district) || form.exam_centre_district,
          exam_center: null,
        }
      : {
          exam_centre_state: form.exam_centre_state,
          exam_centre_district: form.exam_centre_district,
          exam_center: form.exam_center.trim() || null,
        };

    const payload: UpsertUserPayload = {
      phone,
      profile_completed: true,
      college: form.college.trim() || null,
      travel_mode: form.travel_mode,
      stay_plan: form.stay_plan,
      ...centre,
    };

    try {
      await update.mutateAsync(payload);
      show('Profile updated.', 'success');
      setEditing(false);
    } catch (e) {
      setSaveError((e as Error)?.message || 'Save failed. Please try again.');
    }
  }

  return (
    <View style={styles.wrap}>
      {/* ── About you ─────────────────────────────────────────────────────── */}
      <Card style={styles.card}>
        <Text variant="h3">About you</Text>
        <KV label="Name" value={me.full_name} locked />
        <KV label="Gender" value={me.gender} locked />
        {editing ? (
          <Input
            label="College"
            placeholder="Your medical college"
            value={form.college}
            onChangeText={(t) => patch({ college: t })}
            autoCapitalize="words"
          />
        ) : (
          <KV label="College" value={me.college} />
        )}
      </Card>

      {/* ── Exam centre ───────────────────────────────────────────────────── */}
      <Card style={styles.card}>
        <Text variant="h3">Exam centre</Text>
        <KV label="Exam type" value={examLabel(me.exam_type)} locked />

        {isCms ? (
          editing ? (
            <SelectField
              label="Exam centre"
              value={form.exam_centre_district}
              options={CMS_OPTIONS}
              onChange={(v) => patch({ exam_centre_district: v })}
              error={errors.exam_centre_district}
            />
          ) : (
            <>
              <KV label="Exam centre" value={me.exam_centre_district} />
              <KV label="State" value={me.exam_centre_state} />
            </>
          )
        ) : editing ? (
          <>
            <SelectField
              label="Exam centre state"
              value={form.exam_centre_state}
              options={STATE_OPTIONS}
              onChange={(v) => patch({ exam_centre_state: v, exam_centre_district: null })}
              error={errors.exam_centre_state}
            />
            <SelectField
              label="Exam centre district"
              value={form.exam_centre_district}
              options={districtOptions}
              onChange={(v) => patch({ exam_centre_district: v })}
              error={errors.exam_centre_district}
              disabled={!form.exam_centre_state}
              disabledHint="Select a state first…"
            />
            <Input
              label="Exam centre name (optional)"
              placeholder="e.g. the venue on your admit card"
              value={form.exam_center}
              onChangeText={(t) => patch({ exam_center: t })}
            />
          </>
        ) : (
          <>
            <KV label="State" value={me.exam_centre_state ?? me.state} />
            <KV label="District" value={me.exam_centre_district ?? me.district} />
            <KV label="Centre name" value={me.exam_center} />
          </>
        )}
      </Card>

      {/* ── Travel & stay ─────────────────────────────────────────────────── */}
      <Card style={styles.card}>
        <Text variant="h3">Travel &amp; stay</Text>
        {editing ? (
          <>
            <SelectField
              label="Travel mode"
              placeholder="Select travel mode"
              value={form.travel_mode}
              options={TRAVEL_OPTIONS}
              onChange={(v) => patch({ travel_mode: v })}
            />
            <SelectField
              label="Stay plan"
              placeholder="Select stay plan"
              value={form.stay_plan}
              options={STAY_OPTIONS}
              onChange={(v) => patch({ stay_plan: v })}
            />
          </>
        ) : (
          <>
            <KV label="Travel mode" value={displayOf(TRAVEL_OPTIONS, me.travel_mode)} />
            <KV label="Stay plan" value={displayOf(STAY_OPTIONS, me.stay_plan)} />
          </>
        )}
      </Card>

      {saveError ? (
        <Text variant="small" color={colors.danger} accessibilityLiveRegion="assertive">
          {saveError}
        </Text>
      ) : null}

      {editing ? (
        <View style={styles.actions}>
          <Button
            title="Cancel"
            variant="ghost"
            size="lg"
            onPress={cancelEdit}
            disabled={update.isPending}
            style={styles.actionBtn}
          />
          <Button
            title="Save changes"
            size="lg"
            busy={update.isPending}
            onPress={save}
            style={styles.actionBtn}
          />
        </View>
      ) : (
        <Button title="Edit profile" size="lg" onPress={startEdit} />
      )}
    </View>
  );
}

function KV({ label, value, locked }: { label: string; value?: string | null; locked?: boolean }) {
  const filled = !!value && value.trim().length > 0;
  return (
    <View style={styles.kv}>
      <View style={styles.kvLabelRow}>
        <Text variant="small" style={styles.kvLabel}>
          {label}
        </Text>
        {locked ? (
          <Text variant="caption" style={styles.lock} accessibilityLabel="permanent, cannot be changed">
            🔒 Permanent
          </Text>
        ) : null}
      </View>
      {filled ? (
        <Text variant="body">{value}</Text>
      ) : (
        <Text variant="bodyMuted">Not set</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space[3] },
  card: { gap: space[3] },
  kv: { gap: 2 },
  kvLabelRow: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  kvLabel: { color: colors.textMuted },
  lock: {
    color: colors.textMuted,
    fontFamily: fonts.bodyMedium,
    backgroundColor: colors.surface2,
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  actions: { flexDirection: 'row', gap: space[3] },
  actionBtn: { flex: 1 },
});
