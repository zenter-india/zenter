import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, router } from 'expo-router';
import { colors, space } from '@/theme';
import { Text, Input, Button } from '@/components';
import { useSession } from '@/stores/session';
import { useUpdateProfile } from '@/data/useProfile';
import { saveDeviceFingerprint, type UpsertUserPayload } from '@/api/users';
import { statesSorted, districtsFor, cmsCentres, getCmsCentreState } from '@/domain/location';
import { SelectField } from '@/features/onboarding/SelectField';
import { AgeGateModal } from '@/features/onboarding/AgeGateModal';
import { WizardProgress } from '@/features/onboarding/WizardProgress';
import { getDeviceFingerprint } from '@/features/onboarding/fingerprint';
import {
  GENDER_OPTIONS,
  EXAM_OPTIONS,
  TRAVEL_OPTIONS,
  STAY_OPTIONS,
  VALIDATION,
  type SelectOption,
} from '@/features/onboarding/options';
import { resolvePostOnboardingRoute } from '@/features/auth/routing';
import { BootSplash } from '@/features/auth/BootSplash';

const TOTAL_STEPS = 4;

/** Accumulated wizard values (nothing persists until the final save). */
type Collected = {
  full_name: string;
  gender: string | null;
  state: string | null;
  district: string | null;
  exam_type: string | null;
  cms_centre: string | null;
  exam_state: string | null;
  exam_district: string | null;
  exam_center: string;
  travel_mode: string | null;
  stay_plan: string | null;
};

const EMPTY: Collected = {
  full_name: '',
  gender: null,
  state: null,
  district: null,
  exam_type: null,
  cms_centre: null,
  exam_state: null,
  exam_district: null,
  exam_center: '',
  travel_mode: null,
  stay_plan: null,
};

const STATE_OPTIONS: SelectOption[] = statesSorted().map((s) => ({ value: s, label: s }));
const CMS_OPTIONS: SelectOption[] = cmsCentres().map((c) => ({ value: c, label: c }));
const toOptions = (values: string[]): SelectOption[] => values.map((v) => ({ value: v, label: v }));

/**
 * Onboarding wizard (Story 2.3, FR-5–FR-8). Four steps + an 18+ gate, ported
 * from web `js/onboarding.js`:
 *   1. name + gender   2. home state/district (display-only, not used for matching)
 *   3. exam type + exam centre (UPSC CMS branch = one of 48 centres; else
 *      exam-centre state/district + optional centre name)
 *   4. optional travel/stay
 * The whole profile persists in a SINGLE upsert keyed by phone with
 * profile_completed:true; a save failure keeps the user on step 4 with an inline
 * error and no partial data. Device fingerprint is captured best-effort on save.
 */
export default function OnboardingScreen() {
  const { phone, ready } = useSession();
  const update = useUpdateProfile(phone);

  const [step, setStep] = useState(1);
  const [c, setC] = useState<Collected>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [ageOpen, setAgeOpen] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const isCms = c.exam_type === 'UPSC CMS';
  const districtOptions = useMemo(() => toOptions(districtsFor(c.state)), [c.state]);
  const examDistrictOptions = useMemo(() => toOptions(districtsFor(c.exam_state)), [c.exam_state]);

  const patch = (p: Partial<Collected>) => setC((prev) => ({ ...prev, ...p }));
  const setErr = (map: Record<string, string | null>) => setErrors((prev) => ({ ...prev, ...map }));
  const clearErr = (key: string) => errors[key] && setErr({ [key]: null });

  function validateStep(): boolean {
    if (step === 1) {
      const next = {
        full_name: c.full_name.trim() ? null : VALIDATION.name,
        gender: c.gender ? null : VALIDATION.gender,
      };
      setErr(next);
      return !next.full_name && !next.gender;
    }
    if (step === 2) {
      const next = {
        state: c.state ? null : VALIDATION.state,
        district: c.district ? null : VALIDATION.district,
      };
      setErr(next);
      return !next.state && !next.district;
    }
    if (step === 3) {
      if (!c.exam_type) {
        setErr({ exam_type: VALIDATION.examType });
        return false;
      }
      if (isCms) {
        const next = { exam_type: null, cms_centre: c.cms_centre ? null : VALIDATION.cmsCentre };
        setErr(next);
        return !next.cms_centre;
      }
      const next = {
        exam_type: null,
        exam_state: c.exam_state ? null : VALIDATION.examState,
        exam_district: c.exam_district ? null : VALIDATION.examDistrict,
      };
      setErr(next);
      return !next.exam_state && !next.exam_district;
    }
    return true;
  }

  function onNext() {
    if (!validateStep()) return;
    if (step < TOTAL_STEPS) setStep((s) => s + 1);
    else setAgeOpen(true); // step 4 → age gate
  }

  function onBack() {
    if (step > 1) setStep((s) => s - 1);
  }

  async function onConfirmSave() {
    if (!phone) {
      setSaveError('Cannot read your phone number — please sign in again.');
      setAgeOpen(false);
      return;
    }
    setSaveError(null);

    const centreFields = isCms
      ? {
          exam_centre_district: c.cms_centre,
          exam_centre_state: getCmsCentreState(c.cms_centre) || c.cms_centre,
          exam_center: null,
        }
      : {
          exam_centre_state: c.exam_state,
          exam_centre_district: c.exam_district,
          exam_center: c.exam_center.trim() || null,
        };

    const payload: UpsertUserPayload = {
      phone,
      full_name: c.full_name.trim(),
      gender: c.gender as UpsertUserPayload['gender'],
      state: c.state,
      district: c.district,
      exam_type: c.exam_type as UpsertUserPayload['exam_type'],
      ...centreFields,
      travel_mode: c.travel_mode,
      stay_plan: c.stay_plan,
      profile_completed: true,
    };

    try {
      const res = await update.mutateAsync(payload);
      // Device fingerprint — best-effort, never blocks (FR-8).
      const fp = getDeviceFingerprint();
      if (res?.id && fp) void saveDeviceFingerprint(res.id, fp);
      setAgeOpen(false);
      const target = await resolvePostOnboardingRoute();
      router.replace(target);
    } catch (err) {
      setAgeOpen(false);
      setSaveError((err as Error)?.message || VALIDATION.saveFallback);
    }
  }

  // Guards (after all hooks): wait for session, bounce if somehow unauthenticated.
  if (!ready) return <BootSplash />;
  if (!phone) return <Redirect href="/(auth)/sign-in" />;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.progress}>
          <WizardProgress step={step} total={TOTAL_STEPS} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {step === 1 && (
            <View style={styles.stepBody}>
              <Text variant="h2">Tell us about yourself</Text>
              <Input
                label="Full name"
                placeholder="Name as on your hall ticket"
                value={c.full_name}
                onChangeText={(t) => {
                  patch({ full_name: t });
                  clearErr('full_name');
                }}
                error={errors.full_name}
                autoCapitalize="words"
                returnKeyType="next"
              />
              <SelectField
                label="Gender"
                value={c.gender}
                options={GENDER_OPTIONS}
                onChange={(v) => {
                  patch({ gender: v });
                  clearErr('gender');
                }}
                error={errors.gender}
              />
            </View>
          )}

          {step === 2 && (
            <View style={styles.stepBody}>
              <Text variant="h2">Where are you from?</Text>
              <Text variant="bodyMuted">Your home location — shown on your profile, not used for matching.</Text>
              <SelectField
                label="Home state"
                value={c.state}
                options={STATE_OPTIONS}
                onChange={(v) => {
                  patch({ state: v, district: null }); // reset dependent district
                  clearErr('state');
                }}
                error={errors.state}
              />
              <SelectField
                label="Home district"
                value={c.district}
                options={districtOptions}
                onChange={(v) => {
                  patch({ district: v });
                  clearErr('district');
                }}
                error={errors.district}
                disabled={!c.state}
                disabledHint="Select a state first…"
              />
            </View>
          )}

          {step === 3 && (
            <View style={styles.stepBody}>
              <Text variant="h2">Your exam centre</Text>
              <SelectField
                label="Exam type"
                value={c.exam_type}
                options={EXAM_OPTIONS}
                onChange={(v) => {
                  // Switching branches clears the other branch's centre fields.
                  patch({
                    exam_type: v,
                    cms_centre: null,
                    exam_state: null,
                    exam_district: null,
                    exam_center: '',
                  });
                  clearErr('exam_type');
                }}
                error={errors.exam_type}
              />

              {isCms ? (
                <SelectField
                  label="Exam centre"
                  value={c.cms_centre}
                  options={CMS_OPTIONS}
                  onChange={(v) => {
                    patch({ cms_centre: v });
                    clearErr('cms_centre');
                  }}
                  error={errors.cms_centre}
                />
              ) : (
                <>
                  <SelectField
                    label="Exam centre state"
                    value={c.exam_state}
                    options={STATE_OPTIONS}
                    onChange={(v) => {
                      patch({ exam_state: v, exam_district: null });
                      clearErr('exam_state');
                    }}
                    error={errors.exam_state}
                  />
                  <SelectField
                    label="Exam centre district"
                    value={c.exam_district}
                    options={examDistrictOptions}
                    onChange={(v) => {
                      patch({ exam_district: v });
                      clearErr('exam_district');
                    }}
                    error={errors.exam_district}
                    disabled={!c.exam_state}
                    disabledHint="Select a state first…"
                  />
                  <Input
                    label="Exam centre name (optional)"
                    placeholder="e.g. the venue on your admit card"
                    value={c.exam_center}
                    onChangeText={(t) => patch({ exam_center: t })}
                  />
                </>
              )}
            </View>
          )}

          {step === 4 && (
            <View style={styles.stepBody}>
              <Text variant="h2">Travel &amp; stay</Text>
              <Text variant="bodyMuted">Optional — helps mates coordinate. You can add these later.</Text>
              <SelectField
                label="Travel mode"
                placeholder="Select travel mode"
                value={c.travel_mode}
                options={TRAVEL_OPTIONS}
                onChange={(v) => patch({ travel_mode: v })}
              />
              <SelectField
                label="Stay plan"
                placeholder="Select stay plan"
                value={c.stay_plan}
                options={STAY_OPTIONS}
                onChange={(v) => patch({ stay_plan: v })}
              />
              {saveError ? (
                <Text variant="small" color={colors.danger} accessibilityLiveRegion="assertive">
                  {saveError}
                </Text>
              ) : null}
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          {step > 1 ? (
            <Button title="Back" variant="ghost" size="lg" onPress={onBack} style={styles.footerBtn} disabled={update.isPending} />
          ) : null}
          <Button
            title={step < TOTAL_STEPS ? 'Next' : 'Finish'}
            size="lg"
            onPress={onNext}
            style={styles.footerBtn}
            disabled={update.isPending}
          />
        </View>
      </KeyboardAvoidingView>

      <AgeGateModal
        visible={ageOpen}
        busy={update.isPending}
        onCancel={() => setAgeOpen(false)}
        onConfirm={onConfirmSave}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  progress: { paddingHorizontal: space[5], paddingTop: space[2], paddingBottom: space[3] },
  scroll: { flexGrow: 1, paddingHorizontal: space[5], paddingBottom: space[5] },
  stepBody: { gap: space[4] },
  footer: {
    flexDirection: 'row',
    gap: space[3],
    paddingHorizontal: space[5],
    paddingTop: space[3],
    paddingBottom: space[2],
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  footerBtn: { flex: 1 },
});
