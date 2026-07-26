import { LIVE_EXAMS, type ExamType } from '@/domain/gating';

/**
 * Static option lists + validation copy for the onboarding wizard (Story 2.3).
 * Values are byte-for-byte the web `onboarding.html` <option> values (they are
 * persisted verbatim to `users`); labels mirror the web display strings. Exam
 * options are driven off the canonical {@link LIVE_EXAMS} tuple so the wizard can
 * only ever produce a live exam type (non-live → Maintenance never occurs here).
 */

export type SelectOption = { value: string; label: string };

export const GENDER_OPTIONS: SelectOption[] = [
  { value: 'Male', label: 'Male' },
  { value: 'Female', label: 'Female' },
  { value: 'Other', label: 'Other' },
];

/** Onboarding-specific exam labels (mirror web onboarding.html, not the
 *  year-stamped feed header labels). Keyed by the canonical exam value. */
const EXAM_LABELS: Record<ExamType, string> = {
  'NEET UG': 'NEET UG 2026',
  'NEET PG': 'NEET PG 2026',
  'UPSC CMS': 'UPSC CMS 2026',
  INICET: 'INICET',
  'NEET MDS': 'NEET MDS',
  'NEET SS': 'NEET SS',
  FMGE: 'FMGE 2026 Jun',
};

export const EXAM_OPTIONS: SelectOption[] = LIVE_EXAMS.map((value) => ({
  value,
  label: EXAM_LABELS[value],
}));

export const TRAVEL_OPTIONS: SelectOption[] = [
  { value: 'By train', label: '🚂 Train' },
  { value: 'By flight', label: '✈️ Flight' },
  { value: 'By bus', label: '🚌 Bus' },
  { value: 'Self-drive', label: '🚗 Self Drive' },
  { value: 'Shared Cab', label: '🚕 Shared Cab' },
  { value: 'Other', label: 'Yet to Decide' },
];

export const STAY_OPTIONS: SelectOption[] = [
  { value: 'Need accommodation', label: '🏨 Need accommodation' },
  { value: 'Have accommodation', label: '🏠 Have accommodation' },
  { value: 'Looking for room share', label: '🛏️ Room share' },
  { value: 'Other', label: 'Yet to Decide' },
];

/** Validation messages — quoted verbatim from web `js/onboarding.js`. */
export const VALIDATION = {
  name: 'Enter your full name.',
  gender: 'Select your gender.',
  state: 'Select your state.',
  district: 'Enter your district.',
  examType: 'Please select your exam type.',
  cmsCentre: 'Please select your exam centre.',
  examState: 'Select your exam centre state.',
  examDistrict: 'Select your exam centre district.',
  saveFallback: 'Failed to save profile. Please try again.',
} as const;
