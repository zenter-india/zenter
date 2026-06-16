// HallMate — Onboarding wizard: collect profile data and persist to Supabase.
// Loaded only from onboarding.html.

import { requireAuth } from './auth.js';
import { upsertUser, saveDeviceFingerprint } from './supabase.js';

function getDeviceFingerprint() {
  try {
    const parts = [
      navigator.userAgent,
      `${screen.width}x${screen.height}`,
      screen.colorDepth,
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      navigator.language,
    ].join('|');
    let h = 0;
    for (let i = 0; i < parts.length; i++) { h = Math.imul(31, h) + parts.charCodeAt(i) | 0; }
    return Math.abs(h).toString(36);
  } catch { return null; }
}
import { setButtonBusy } from './ui.js';
import { ROUTES, STORAGE_KEYS } from './config.js';
import { populateStateSelect, wireDistrictCascade, populateCmsCentreSelect, getCmsCentreState } from './location-data.js';

let firebaseUser = null;
const collected = {};

async function init() {
  firebaseUser = await requireAuth();
  if (!firebaseUser) return;

  // Home state → district cascade (Step 2)
  const stateEl    = document.getElementById('hm-state');
  const districtEl = document.getElementById('hm-district');
  if (stateEl && districtEl) {
    populateStateSelect(stateEl);
    wireDistrictCascade(stateEl, districtEl);
  }

  // Exam centre state → district cascade (Step 3 — NEET exams)
  const examStateEl    = document.getElementById('hm-exam-state');
  const examDistrictEl = document.getElementById('hm-exam-district');
  if (examStateEl && examDistrictEl) {
    populateStateSelect(examStateEl);
    wireDistrictCascade(examStateEl, examDistrictEl);
  }

  // UPSC CMS centre dropdown (Step 3 — CMS exam)
  const cmsCentreEl = document.getElementById('hm-cms-centre');
  if (cmsCentreEl) populateCmsCentreSelect(cmsCentreEl);

  // Toggle Step 3 fields based on exam type selection
  const examTypeEl = document.getElementById('hm-exam-type');
  if (examTypeEl) {
    examTypeEl.addEventListener('change', () => toggleExamFields(examTypeEl.value));
  }

  // Step navigation via data-go-step buttons
  document.querySelectorAll('[data-go-step]').forEach((btn) => {
    btn.addEventListener('click', () => goToStep(Number(btn.dataset.goStep)));
  });

  document.getElementById('hm-form-step1').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!validate([
      { id: 'hm-name',   errId: 'hm-err-name',   msg: 'Enter your full name.' },
      { id: 'hm-gender', errId: 'hm-err-gender',  msg: 'Select your gender.' },
    ])) return;
    collected.full_name = val('hm-name');
    collected.gender    = val('hm-gender');
    goToStep(2);
  });

  document.getElementById('hm-form-step2').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!validate([
      { id: 'hm-state',    errId: 'hm-err-state',    msg: 'Select your state.' },
      { id: 'hm-district', errId: 'hm-err-district',  msg: 'Enter your district.' },
    ])) return;
    collected.state    = val('hm-state');
    collected.district = val('hm-district');
    goToStep(3);
  });

  document.getElementById('hm-form-step3').addEventListener('submit', (e) => {
    e.preventDefault();
    const examType = val('hm-exam-type');

    if (examType === 'UPSC CMS') {
      if (!validate([
        { id: 'hm-exam-type',  errId: 'hm-err-exam-type',  msg: 'Please select your exam type.' },
        { id: 'hm-cms-centre', errId: 'hm-err-cms-centre', msg: 'Please select your exam centre.' },
      ])) return;
      const centre = val('hm-cms-centre');
      collected.exam_type            = examType;
      collected.exam_centre_district = centre;
      collected.exam_centre_state    = getCmsCentreState(centre) || centre;
      collected.exam_center          = null;
    } else {
      if (!validate([
        { id: 'hm-exam-type',     errId: 'hm-err-exam-type',     msg: 'Please select your exam type.' },
        { id: 'hm-exam-state',    errId: 'hm-err-exam-state',    msg: 'Select your exam centre state.' },
        { id: 'hm-exam-district', errId: 'hm-err-exam-district', msg: 'Select your exam centre district.' },
      ])) return;
      collected.exam_type            = examType;
      collected.exam_centre_state    = val('hm-exam-state');
      collected.exam_centre_district = val('hm-exam-district');
      collected.exam_center          = val('hm-exam-center') || null;
    }
    goToStep(4);
  });

  document.getElementById('hm-form-step4').addEventListener('submit', async (e) => {
    e.preventDefault();
    collected.travel_mode = val('hm-travel-mode') || null;
    collected.stay_plan   = val('hm-stay-plan')   || null;
    openAgeModal();
  });

  wireAgeModal();
}

// ─── Exam-type field toggling ────────────────────────────────────────────────

function toggleExamFields(examType) {
  const isCms = examType === 'UPSC CMS';
  const neetEls = ['hm-exam-state-wrap', 'hm-exam-district-wrap', 'hm-exam-center-wrap'];
  const cmsEl   = document.getElementById('hm-cms-centre-wrap');

  neetEls.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.hidden = isCms;
  });
  if (cmsEl) cmsEl.hidden = !isCms;
}

// ─── Age confirmation modal ──────────────────────────────────────────────────

function openAgeModal() {
  const overlay = document.getElementById('hm-age-modal');
  if (!overlay) { saveProfile(); return; }
  overlay.classList.add('is-open');
}

function closeAgeModal() {
  document.getElementById('hm-age-modal')?.classList.remove('is-open');
}

function wireAgeModal() {
  const overlay  = document.getElementById('hm-age-modal');
  const checkbox = document.getElementById('hm-age-confirm-checkbox');
  const confirm  = document.getElementById('hm-age-confirm');
  const cancel   = document.getElementById('hm-age-cancel');
  if (!overlay || !checkbox || !confirm || !cancel) return;

  checkbox.addEventListener('change', () => {
    confirm.disabled = !checkbox.checked;
  });

  cancel.addEventListener('click', closeAgeModal);

  confirm.addEventListener('click', async () => {
    closeAgeModal();
    await saveProfile();
  });
}

// ─── Save ─────────────────────────────────────────────────────────────────────

async function saveProfile() {
  const btn = document.getElementById('hm-finish-btn');
  const errEl = document.getElementById('hm-save-error');
  errEl.hidden = true;
  setButtonBusy(btn, true, 'Saving…');

  const { error } = await upsertUser({
    phone:                 firebaseUser.phoneNumber,
    full_name:             collected.full_name,
    gender:                collected.gender,
    state:                 collected.state,
    district:              collected.district,
    exam_type:             collected.exam_type,
    exam_centre_state:     collected.exam_centre_state,
    exam_centre_district:  collected.exam_centre_district,
    exam_center:           collected.exam_center,
    travel_mode:           collected.travel_mode,
    stay_plan:             collected.stay_plan,
    profile_completed:     true,
  });

  if (error) {
    errEl.textContent = error.message || 'Failed to save profile. Please try again.';
    errEl.hidden = false;
    setButtonBusy(btn, false);
    return;
  }

  // Save device fingerprint for multi-account detection (fire-and-forget)
  try {
    const { data: me } = await (await import('./supabase.js')).getUserByPhone(firebaseUser.phoneNumber);
    const fp = getDeviceFingerprint();
    if (me?.id && fp) saveDeviceFingerprint(me.id, fp);
  } catch {/* non-critical */}

  // Mark onboarding complete so guards + navbar update immediately on redirect.
  try { sessionStorage.setItem(STORAGE_KEYS.profileCompleted, 'true'); } catch {}

  window.location.replace(ROUTES.dashboard);
}

// ─── Step navigation ─────────────────────────────────────────────────────────

function goToStep(n) {
  document.querySelectorAll('[data-step-panel]').forEach((panel) => {
    panel.hidden = Number(panel.dataset.stepPanel) !== n;
  });
  document.querySelectorAll('[data-step]').forEach((dot) => {
    const s = Number(dot.dataset.step);
    dot.classList.toggle('is-active', s === n);
    dot.classList.toggle('is-done',   s < n);
  });
  document.getElementById('hm-step-current').textContent = n;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ─── Validation ───────────────────────────────────────────────────────────────

// fields: [{ id, errId, msg }]
// Returns true when all fields are non-empty.
function validate(fields) {
  let ok = true;
  fields.forEach(({ id, errId, msg }) => {
    const el  = document.getElementById(id);
    const err = document.getElementById(errId);
    const empty = !el || !el.value.trim();
    if (err) { err.textContent = empty ? msg : ''; err.hidden = !empty; }
    if (empty) { el?.classList.add('hm-input--invalid'); ok = false; }
    else el?.classList.remove('hm-input--invalid');
  });
  return ok;
}

function val(id) {
  return (document.getElementById(id)?.value || '').trim();
}

document.addEventListener('DOMContentLoaded', init);
