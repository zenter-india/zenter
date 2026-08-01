// HallMate — Profile page: hydration + inline section editing.
// Each card section (About / Centre / Travel) is independently editable.
//
// Edit flow per section:
//   1. Click "Edit" → dd elements become inputs, button swaps to Save + Cancel
//   2. Click "Save" → validate → upsertUser (Supabase) → re-render read view
//   3. Click "Cancel" → restore read view from in-memory profileData (no fetch)

import { requireOnboarded, logout }                    from './auth.js';
import { getProfileByPhone, upsertUser,
         setPausedStatus, deleteUserData }              from './supabase.js';
import { formatPhonePretty, checkSuspended }           from './utils.js';
import { STORAGE_KEYS, ROUTES }                        from './config.js';
import { setButtonBusy, toast }                        from './ui.js';
import { STATES, wireDistrictCascade, UPSC_CMS_CENTRES, getCmsCentreState } from './location-data.js';

// ─── Module state ─────────────────────────────────────────────────────────────
let profilePhone = '';   // Firebase E.164 phone number
let profileData  = {};   // Latest Supabase row; updated optimistically on save

// ─── Option lists ─────────────────────────────────────────────────────────────
const GENDER_OPTS = ['Male', 'Female', 'Other'];

// STATES imported from location-data.js — single source of truth for all 36 entries.

// Exam type is permanent per account — set once during onboarding and not
// editable from the profile page. Kept in the DB for filtering only.

const TRAVEL_OPTS = ['By train', 'By flight', 'By bus', 'Self-drive', 'Shared Cab', 'Other'];
const TRAVEL_DISPLAY = {
  'By train': '🚂 Train', 'By flight': '✈️ Flight', 'By bus': '🚌 Bus',
  'Self-drive': '🚗 Self Drive', 'Shared Cab': '🚕 Shared Cab', 'Other': 'Yet to Decide',
};

const STAY_OPTS = [
  'Need accommodation', 'Have accommodation', 'Looking for room share', 'Other',
];
const STAY_DISPLAY = {
  'Need accommodation': '🏨 Need accommodation',
  'Have accommodation': '🏠 Have accommodation',
  'Looking for room share': '🛏️ Room share',
  'Other': 'Yet to Decide',
};

// ─── Section configs ──────────────────────────────────────────────────────────
// key         → matches Object.entries() key used to wire buttons
// sectionId   → <article> id
// editBtnId   → Edit button id
// fields[]    → defines each row: Supabase column key, dd element id, input type
const SECTIONS = {
  about: {
    sectionId: 'hm-section-about',
    editBtnId: 'hm-edit-about',
    fields: [
      {
        // Permanent identity — locked once set (enforced in DB by a trigger too).
        key: 'full_name', ddId: 'hm-kv-name', type: 'text',
        placeholder: 'Your full name', prompt: 'Add your name', required: true,
        locked: true,
      },
      {
        // Permanent identity — locked once set.
        key: 'gender', ddId: 'hm-kv-gender', type: 'select',
        options: GENDER_OPTS, prompt: 'Add your gender',
        locked: true,
      },
      {
        key: 'college', ddId: 'hm-kv-college', type: 'text',
        placeholder: 'Your medical college', prompt: 'Add your college',
      },
    ],
  },

  centre: {
    sectionId: 'hm-section-centre',
    editBtnId: 'hm-edit-centre',
    fields: [
      {
        key: 'exam_centre_state', ddId: 'hm-kv-exam-state', type: 'select',
        options: STATES, prompt: 'Add exam centre state',
        fallback: 'state',
        hideForCms: true,
      },
      {
        key: 'exam_centre_district', ddId: 'hm-kv-exam-district', type: 'select',
        options: [], prompt: 'Add exam centre district',
        fallback: 'district',
        hideForCms: true,
      },
      {
        key: 'exam_centre_district', ddId: 'hm-kv-cms-centre', type: 'select',
        options: UPSC_CMS_CENTRES.map(c => c.centre),
        prompt: 'Add exam centre',
        cmsOnly: true,
      },
      {
        key: 'exam_center', ddId: 'hm-kv-exam-center', type: 'text',
        placeholder: 'e.g. Tirupati Medical College', prompt: 'Add your exam centre',
        hideForCms: true,
      },
    ],
  },

  travel: {
    sectionId: 'hm-section-travel',
    editBtnId: 'hm-edit-travel',
    fields: [
      {
        key: 'travel_mode', ddId: 'hm-kv-travel', type: 'select',
        options: TRAVEL_OPTS, prompt: 'Add travel preference',
      },
      {
        key: 'stay_plan', ddId: 'hm-kv-stay', type: 'select',
        options: STAY_OPTS, prompt: 'Add your stay plan',
      },
    ],
  },
};

// ─── Bootstrap ────────────────────────────────────────────────────────────────
async function init() {
  const firebaseUser = await requireOnboarded();
  if (!firebaseUser) return;

  profilePhone = firebaseUser.phoneNumber || '';
  if (!profilePhone) {
    setText('hm-profile-name', 'Cannot read phone — please sign in again.');
    return;
  }

  // Show phone immediately (from Firebase, no Supabase latency)
  setText('hm-profile-phone', formatPhonePretty(profilePhone));

  // Instant hydration from cache — eliminates field pop-in on repeat visits.
  const cached = readProfileCache(profilePhone);
  if (cached) { profileData = cached; hydrateAll(); }
  else        { setAllLoading(); }

  // Refresh from the server in the background, then re-hydrate.
  const { data, error } = await getProfileByPhone(profilePhone);
  if (error) {
    if (!cached) {
      console.error('[profile] load error', error);
      setText('hm-profile-name', error.message || 'Could not load profile.');
      return;
    }
    console.warn('[profile] refresh failed — showing cached data', error);
  } else {
    profileData = data || {};
    writeProfileCache(profilePhone, profileData);
    if (checkSuspended(data)) return;
    hydrateAll();
  }

  wireEditButtons();
  wireAccountActions();

  // Allow the navbar dropdown's "Pause profile" / "Delete account" deep-links
  // (/profile.html#pause, /profile.html#delete) to open the existing modals.
  const hash = (location.hash || '').slice(1).toLowerCase();
  if (hash === 'pause')  document.getElementById('hm-pause-profile')?.click();
  if (hash === 'delete') document.getElementById('hm-delete-account')?.click();
  if (hash === 'pause' || hash === 'delete') {
    history.replaceState(null, '', location.pathname);
  }
}

// ─── Read-mode hydration ──────────────────────────────────────────────────────

function setAllLoading() {
  Object.values(SECTIONS).forEach(sec => {
    sec.fields.forEach(f => setDd(f.ddId, null, ''));
  });
}

function hydrateAll() {
  const name = trimOrNull(profileData.full_name);

  // Identity card (left column)
  setText('hm-profile-name', name || 'Your name');
  setAvatar(name);

  // Cache initials for the navbar avatar across all pages
  cacheInitials(name);

  // Gap 5: show Plus badge or upgrade link
  const plusStatus  = document.getElementById('hm-plus-status');
  const plusUpgrade = document.getElementById('hm-plus-upgrade-link');
  if (profileData.plus_member) {
    if (plusStatus)  plusStatus.hidden  = false;
    if (plusUpgrade) plusUpgrade.hidden = true;
  } else {
    if (plusStatus)  plusStatus.hidden  = true;
    if (plusUpgrade) plusUpgrade.hidden = false;
  }

  // Roll No verification section
  const verSection   = document.getElementById('hm-verification-section');
  const verifiedEl   = document.getElementById('hm-verified-state');
  const pendingEl    = document.getElementById('hm-pending-state');
  const rejectedEl   = document.getElementById('hm-rejected-state');
  const verFormEl    = document.getElementById('hm-verify-form');
  const ntaInput     = document.getElementById('hm-nta-number');

  if (verSection) {
    verSection.hidden = false;
    verifiedEl.hidden  = !profileData.is_verified_aspirant;
    pendingEl.hidden   = !profileData.verification_requested || profileData.is_verified_aspirant;
    rejectedEl.hidden  = !profileData.verification_rejected;
    // Show form if not verified and not pending
    verFormEl.hidden   = profileData.is_verified_aspirant || profileData.verification_requested;
    // Pre-fill if previously submitted
    if (ntaInput && profileData.nta_application_number) ntaInput.value = profileData.nta_application_number;
  }

  // Show verified badge callout only for non-verified users
  const callout = document.getElementById('hm-verify-callout');
  if (callout) callout.hidden = !!profileData.is_verified_aspirant;

  // All section fields
  Object.values(SECTIONS).forEach(sec => hydrateSection(sec));
}

function hydrateSection(sec) {
  const isCms = profileData.exam_type === 'UPSC CMS';
  sec.fields.forEach(f => {
    const ddEl = document.getElementById(f.ddId);
    // Show/hide fields based on exam type
    if (f.hideForCms && ddEl) {
      const row = ddEl.closest('.hm-kv__row');
      if (row) row.hidden = isCms;
    }
    if (f.cmsOnly && ddEl) {
      const row = ddEl.closest('.hm-kv__row');
      if (row) row.hidden = !isCms;
    }
    if ((f.hideForCms && isCms) || (f.cmsOnly && !isCms)) return;
    const value = trimOrNull(profileData[f.key])
               ?? (f.fallback ? trimOrNull(profileData[f.fallback]) : null);
    setDd(f.ddId, value, f.prompt);
  });
}

// Sets a <dd> to a value or an italic prompt when value is absent.
function setDd(ddId, value, prompt) {
  const dd = document.getElementById(ddId);
  if (!dd) return;
  dd.classList.remove('hm-kv__locked'); // cleared on every (re)hydrate / exit-edit
  if (value) {
    dd.textContent = value;
    dd.classList.remove('hm-kv__empty');
  } else {
    dd.textContent = prompt;
    dd.classList.add('hm-kv__empty');
  }
}

// ─── Edit mode ────────────────────────────────────────────────────────────────

function wireEditButtons() {
  // Single "Edit profile" button opens all sections at once
  document.getElementById('hm-edit-all')
    ?.addEventListener('click', enterEditAll);
  document.getElementById('hm-cancel-all')
    ?.addEventListener('click', exitEditAll);
  document.getElementById('hm-save-all')
    ?.addEventListener('click', () => saveAll(document.getElementById('hm-save-all')));
}

// ── Global edit: enter all sections at once ───────────────────────────────────

function enterEditAll() {
  document.getElementById('hm-edit-all').hidden = true;
  document.getElementById('hm-edit-all-actions').hidden = false;
  Object.keys(SECTIONS).forEach(key => enterEditMode(key));
}

async function saveAll(saveBtn) {
  // Clear previous error
  document.getElementById('hm-save-all-error')?.remove();

  // Collect + validate all field values across every section
  const updates = {};
  let valid = true;
  for (const sec of Object.values(SECTIONS)) {
    for (const f of sec.fields) {
      const dd  = document.getElementById(f.ddId);
      const inp = dd?.querySelector('[data-field-key]');
      if (!inp) {
        // Config/DOM mismatch — a SECTIONS field has no matching <dd> in
        // the markup. Surface it loudly rather than silently dropping the
        // value from the save payload.
        console.error(`[profile] Missing editable input for field "${f.key}" (expected <dd id="${f.ddId}">)`);
        valid = false;
        continue;
      }
      const v = inp.value.trim() || null;
      if (f.required && !v) {
        inp.classList.add('hm-input--invalid');
        valid = false;
      } else {
        inp.classList.remove('hm-input--invalid');
        updates[f.key] = v;
      }
    }
  }
  if (!valid) return;

  // UPSC CMS: auto-derive exam_centre_state from the selected centre
  if (profileData.exam_type === 'UPSC CMS' && updates.exam_centre_district) {
    updates.exam_centre_state = getCmsCentreState(updates.exam_centre_district) || updates.exam_centre_district;
  }

  setButtonBusy(saveBtn, true, 'Saving…');
  const { error } = await upsertUser({ phone: profilePhone, profile_completed: true, ...updates });
  setButtonBusy(saveBtn, false);

  if (error) {
    const errEl = document.createElement('p');
    errEl.id = 'hm-save-all-error';
    errEl.style.cssText = 'color:var(--hm-danger);font-size:var(--hm-text-xs);margin-top:8px;margin-bottom:0;';
    errEl.textContent = error.message || 'Save failed. Please try again.';
    saveBtn.before(errEl);
    return;
  }

  // Optimistic merge
  Object.assign(profileData, updates);
  writeProfileCache(profilePhone, profileData); // keep cache in sync for next visit
  if ('full_name' in updates) {
    const name = trimOrNull(profileData.full_name);
    setText('hm-profile-name', name || 'Your name');
    setAvatar(name);
    cacheInitials(name);
  }

  exitEditAll();
}

function exitEditAll() {
  Object.keys(SECTIONS).forEach(key => exitEditMode(key));
  document.getElementById('hm-save-all-error')?.remove();
  document.getElementById('hm-edit-all').hidden = false;
  document.getElementById('hm-edit-all-actions').hidden = true;
}

// ── Per-section input rendering (no button swap — controlled globally) ─────────

function enterEditMode(sectionKey) {
  const sec     = SECTIONS[sectionKey];
  const article = document.getElementById(sec.sectionId);
  if (!article) return;
  const isCms = profileData.exam_type === 'UPSC CMS';

  // Replace each <dd> text with the appropriate input
  sec.fields.forEach(f => {
    if ((f.hideForCms && isCms) || (f.cmsOnly && !isCms)) return;
    const dd = document.getElementById(f.ddId);
    if (!dd) return;
    if (f.locked && trimOrNull(profileData[f.key])) {
      dd.classList.add('hm-kv__locked');
      return;
    }
    const currentVal = trimOrNull(profileData[f.key])
                    ?? (f.fallback ? trimOrNull(profileData[f.fallback]) : null)
                    ?? '';
    dd.textContent = '';
    dd.classList.remove('hm-kv__empty');
    const input = buildInput(f, currentVal);
    input.setAttribute('data-field-key', f.key);
    dd.appendChild(input);
  });

  // Wire state → district cascade for NEET centre section (skip for CMS)
  if (sectionKey === 'centre' && !isCms) {
    const stateEl = document.getElementById('hm-kv-exam-state')?.querySelector('select');
    const distEl  = document.getElementById('hm-kv-exam-district')?.querySelector('select');
    if (stateEl && distEl) {
      wireDistrictCascade(stateEl, distEl);
      const savedDist = trimOrNull(profileData.exam_centre_district)
                     ?? trimOrNull(profileData.district)
                     ?? '';
      if (savedDist) distEl.value = savedDist;
    }
  }

  article.classList.add('is-editing');
}

function buildInput(field, currentVal) {
  if (field.type === 'text') {
    const el = document.createElement('input');
    el.type        = 'text';
    el.className   = 'hm-input';
    el.value       = currentVal;
    el.placeholder = field.placeholder || '';
    if (field.required) el.required = true;
    return el;
  }

  if (field.type === 'select') {
    const el = document.createElement('select');
    el.className = 'hm-select';
    // Blank default option
    const blank = document.createElement('option');
    blank.value = ''; blank.textContent = 'Select…';
    blank.selected = !currentVal;
    el.appendChild(blank);
    // Use pretty display labels for travel/stay options
    const displayMap = field.key === 'travel_mode' ? TRAVEL_DISPLAY
                     : field.key === 'stay_plan'   ? STAY_DISPLAY
                     : null;
    (field.options || []).forEach(opt => {
      const o = document.createElement('option');
      o.value = opt;
      o.textContent = displayMap?.[opt] ?? opt;
      o.selected = (opt === currentVal);
      el.appendChild(o);
    });
    return el;
  }

  if (field.type === 'textarea') {
    const el = document.createElement('textarea');
    el.className   = 'hm-textarea hm-profile-bio';
    el.value       = currentVal;
    el.placeholder = field.placeholder || '';
    el.rows        = 3;
    return el;
  }
}


// ─── Exit edit mode ───────────────────────────────────────────────────────────

function exitEditMode(sectionKey) {
  const sec     = SECTIONS[sectionKey];
  const article = document.getElementById(sec.sectionId);
  if (!article) return;
  article.classList.remove('is-editing');
  hydrateSection(sec);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Lightweight per-tab profile cache (sessionStorage). Keyed by phone so a
// different signed-in user never reads a stale row. Used for instant hydration.
const PROFILE_CACHE_KEY = 'hm.profile.row';

function readProfileCache(phone) {
  try {
    const obj = JSON.parse(sessionStorage.getItem(PROFILE_CACHE_KEY) || 'null');
    return obj && obj.__phone === phone ? obj.data : null;
  } catch { return null; }
}

function writeProfileCache(phone, data) {
  try {
    sessionStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify({ __phone: phone, data }));
  } catch { /* private mode / quota — non-fatal */ }
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function setAvatar(name) {
  const el = document.getElementById('hm-profile-avatar');
  if (el) el.textContent = avatarInitials(name);
}

function cacheInitials(name) {
  try {
    const initials = avatarInitials(name);
    sessionStorage.setItem(STORAGE_KEYS.profile, JSON.stringify({ initials }));
    const navAvatar = document.getElementById('hm-navbar-avatar');
    if (navAvatar && initials !== 'Z') navAvatar.textContent = initials;
  } catch { /* ignore — storage may be unavailable in private mode */ }
}

function trimOrNull(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

function avatarInitials(name) {
  const s = (name || '').trim();
  if (!s) return 'Z';
  return s.split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

// ─── Account actions: pause + delete ─────────────────────────────────────────

function openModal(id)  { document.getElementById(id)?.classList.add('is-open'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('is-open'); }

/** Sync the Pause button label + paused notice with current profileData state. */
function renderPauseState() {
  const btn    = document.getElementById('hm-pause-profile');
  const notice = document.getElementById('hm-paused-notice');
  const paused = !!profileData.is_profile_paused;
  if (btn)    btn.textContent = paused ? 'Reactivate profile' : 'Pause my profile';
  if (notice) notice.hidden   = !paused;
}

function wireAccountActions() {
  renderPauseState();

  // ── Roll No Verification Request ─────────────────────────────────────────
  document.getElementById('hm-request-verify')?.addEventListener('click', async () => {
    const ntaVal = document.getElementById('hm-nta-number')?.value?.trim();
    if (!ntaVal || ntaVal.length < 4) {
      toast('Please enter a valid Roll Number.', { variant: 'danger' }); return;
    }
    const btn = document.getElementById('hm-request-verify');
    btn.disabled = true; btn.textContent = 'Submitting…';
    const { requestAdmitCardVerification } = await import('./supabase.js');
    const { error } = await requestAdmitCardVerification(profilePhone, ntaVal);
    btn.disabled = false; btn.textContent = 'Get Verified';
    if (error) { toast(error.message || 'Could not submit. Please try again.', { variant: 'danger' }); return; }
    profileData.nta_application_number = ntaVal;
    profileData.verification_requested = true;
    profileData.verification_rejected  = false;
    hydrateAll(); // re-render to show pending state
    toast(
      'Request submitted. We\'ll review your details and mark your profile <span class="hm-badge hm-badge--verified-full" style="font-size:11px;padding:1px 6px;">✓ Verified</span> shortly.',
      { variant: 'success', html: true }
    );
  });

  // ── Pause / Reactivate ────────────────────────────────────────────────────
  document.getElementById('hm-pause-profile')?.addEventListener('click', () => {
    if (profileData.is_profile_paused) {
      // Reactivate: no confirmation needed — just a beneficial toggle
      doPauseToggle(false);
    } else {
      openModal('hm-modal-pause');
    }
  });

  document.getElementById('hm-modal-pause-cancel')
    ?.addEventListener('click', () => closeModal('hm-modal-pause'));

  document.getElementById('hm-modal-pause')
    ?.addEventListener('click', e => {
      if (e.target.id === 'hm-modal-pause') closeModal('hm-modal-pause');
    });

  document.getElementById('hm-modal-pause-confirm')
    ?.addEventListener('click', async () => {
      const btn = document.getElementById('hm-modal-pause-confirm');
      setButtonBusy(btn, true, 'Pausing…');
      await doPauseToggle(true);
      setButtonBusy(btn, false);
      closeModal('hm-modal-pause');
    });

  // ── Delete account ────────────────────────────────────────────────────────
  document.getElementById('hm-delete-account')
    ?.addEventListener('click', () => openModal('hm-modal-delete'));

  document.getElementById('hm-modal-delete-cancel')
    ?.addEventListener('click', () => closeModal('hm-modal-delete'));

  document.getElementById('hm-modal-delete')
    ?.addEventListener('click', e => {
      if (e.target.id === 'hm-modal-delete') closeModal('hm-modal-delete');
    });

  document.getElementById('hm-modal-delete-confirm')
    ?.addEventListener('click', async () => {
      const btn = document.getElementById('hm-modal-delete-confirm');
      setButtonBusy(btn, true, 'Deleting…');
      await doDeleteAccount(btn);
    });
}

async function doPauseToggle(pausing) {
  const { error } = await setPausedStatus(profilePhone, pausing);
  if (error) {
    toast(error.message || 'Could not update profile. Please try again.', { variant: 'danger' });
    return;
  }
  profileData.is_profile_paused = pausing;
  renderPauseState();
  toast(
    pausing ? 'Profile paused — you\'re hidden from Find Mates.'
            : 'Profile reactivated — you\'re visible again!',
    { variant: pausing ? 'info' : 'success' }
  );
}

async function doDeleteAccount(confirmBtn) {
  if (!profileData.id) {
    toast('Cannot delete — profile not loaded. Please refresh.', { variant: 'danger' });
    setButtonBusy(confirmBtn, false);
    return;
  }

  const { error } = await deleteUserData(profileData.id);
  if (error) {
    toast(error.message || 'Delete failed. Please try again.', { variant: 'danger' });
    setButtonBusy(confirmBtn, false);
    return;
  }

  // Sign out Firebase session then go to landing
  await logout(ROUTES.landing);
}

document.addEventListener('DOMContentLoaded', init);
