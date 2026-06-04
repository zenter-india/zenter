// HallMate — Dashboard: users feed + filtering + connection system + phone reveal.

import { requireOnboarded } from './auth.js';
import { getAllUsers, getUserByPhone, getMyConnections,
         sendConnectionRequest, respondToRequest, deleteRequest,
         getBlockedUserIds, getBlockedByIds, getSeededUsers,
         getPlatformConfig, blockUser,
         deleteConnectionsBetween } from './supabase.js';
import { debounce } from './utils.js';
import { toast, setButtonBusy } from './ui.js';
import * as Relationships from './relationships.js';
import { populateStateSelect, wireDistrictCascade, DISTRICTS_BY_STATE } from './location-data.js';

const { REL } = Relationships;

let allUsers        = [];
let rawUserMap      = new Map(); // all fetched users keyed by id — used by renderRequests()
let displayedUsers  = [];
let lastFocusedCard = null;
let modalUser       = null;
let myUserId              = null;
let myExamType            = null;   // permanent — set during onboarding
let myExamCentreState     = null;   // state-level matching boundary
let firebaseUser    = null;   // stored for lazy connections load
let connectionsLoaded = false;
let blockedUserIds  = new Set(); // users the current user has blocked
let blockedByIds    = new Set(); // users who have blocked the current user
let dataLoaded      = false;     // true once loadData() has hydrated — gates empty states

const FILTERS = [
  // State/district filters removed — state-level matching is enforced on load.
  // Remaining filters let users narrow within their state.
  { id: 'hm-filter-gender',   key: 'gender',               type: 'select' },
  { id: 'hm-filter-district', key: 'exam_centre_district', type: 'select' },
  { id: 'hm-filter-center',   key: 'exam_center',          type: 'text'   },
  { id: 'hm-filter-travel',   key: 'travel_mode',          type: 'select' },
  { id: 'hm-filter-stay',     key: 'stay_plan',            type: 'select' },
];

const AVATAR_COLORS = ['#FF6B35','#4F46E5','#10B981','#F59E0B','#8B5CF6','#06B6D4','#EF4444'];

// ─── Init ─────────────────────────────────────────────────────────────────────

async function init() {
  // Show the deep-linked tab IMMEDIATELY (sync, before the async auth await)
  // so a #connections / #requests link never flashes the default Find Mates
  // panel while Firebase resolves.
  applyInitialTabFromHash();

  firebaseUser = await requireOnboarded();
  if (!firebaseUser) return;

  wireTabs();

  const { data: me } = await getUserByPhone(firebaseUser.phoneNumber);
  myUserId             = me?.id        || null;
  myExamType           = me?.exam_type || 'NEET UG';
  // Match only on exam_centre_state — where the exam is held.
  // Home location (state/district) is irrelevant for matching.
  // Admins/superadmins bypass the filter so they can see all users.
  const myRole = me?.role || 'user';
  myExamCentreState = (myRole === 'admin' || myRole === 'superadmin')
    ? null
    : (me?.exam_centre_state || null);

  // Populate the district filter dropdown with districts from the user's exam state.
  // Admin has no state boundary so show all districts (sorted A-Z).
  const districtEl = document.getElementById('hm-filter-district');
  if (districtEl) {
    const stateForDistricts = me?.exam_centre_state || null;
    const districts = stateForDistricts
      ? (DISTRICTS_BY_STATE[stateForDistricts] || [])
      : Object.values(DISTRICTS_BY_STATE).flat().sort();
    districts.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d; opt.textContent = d;
      districtEl.appendChild(opt);
    });
  }

  // Cache role so the navbar admin link can show/hide without an extra fetch.
  // Also update the DOM directly — renderNavAuthState() in app.js fires before
  // this fetch completes on a fresh login, so the link stays hidden without this.
  try { sessionStorage.setItem('hm.user.role', me?.role || 'user'); } catch {}
  const isAdmin = myRole === 'admin' || myRole === 'superadmin';
  const adminNavItem = document.getElementById('hm-admin-nav-item');
  if (adminNavItem) adminNavItem.hidden = !isAdmin;

  // Non-NEET UG exam types → maintenance page (product focus is NEET UG).
  if (myExamType !== 'NEET UG') {
    window.location.replace('/maintenance.html');
    return;
  }

  // Reflect the user's permanent exam type in the header label.
  const examLabel = document.getElementById('hm-exam-label');
  const examYearDisplay = { 'NEET UG': 'NEET UG 2026', 'NEET PG': 'NEET PG 2026' };
  if (examLabel) examLabel.textContent = examYearDisplay[myExamType] || myExamType;

  // Load both block directions so neither side sees the other while blocked.
  if (myUserId) {
    const [blockedRes, blockedByRes] = await Promise.all([
      getBlockedUserIds(myUserId),  // users I blocked
      getBlockedByIds(myUserId),    // users who blocked me
    ]);
    blockedUserIds = new Set((blockedRes.data  || []).map(b => b.blocked_user_id));
    blockedByIds   = new Set((blockedByRes.data || []).map(b => b.blocker_user_id));
  }

  wireFilters();
  wireModal();
  wireConnectionActions();
  wireBlockModal();

  // Subscribe once — drives all incremental UI updates across cards, modal, requests tab.
  Relationships.subscribe((changedUserId) => {
    refreshCardCta(changedUserId);
    renderModalActions();
    renderRequests();
    updateNavBadge();
  });

  await loadData();
}

async function loadData() {
  renderSkeletons();

  // If the user just came from unblocking someone, re-fetch the blocked-IDs set
  // before loading so the unblocked user definitely passes the filter.
  try {
    if (sessionStorage.getItem('hm.unblocked') && myUserId) {
      sessionStorage.removeItem('hm.unblocked');
      const [blockedRes, blockedByRes] = await Promise.all([
        getBlockedUserIds(myUserId),
        getBlockedByIds(myUserId),
      ]);
      blockedUserIds = new Set((blockedRes.data  || []).map(b => b.blocked_user_id));
      blockedByIds   = new Set((blockedByRes.data || []).map(b => b.blocker_user_id));
    }
  } catch {}

  const [usersRes, seededRes, connsRes, cfgRes] = await Promise.all([
    getAllUsers(myExamType),
    getSeededUsers(myExamType),   // separate table — merged into feed below
    myUserId ? getMyConnections(myUserId) : Promise.resolve({ data: [], error: null }),
    getPlatformConfig(),
  ]);

  if (usersRes.error) { renderError(usersRes.error.message); return; }

  // Check if exam centre should be shown on seeded user cards
  const showSeededExamCentre = (cfgRes.data || [])
    .find(r => r.key === 'seeded_exam_centre_visible')?.value !== false;

  // Strip exam_center from seeded users if admin toggled it off
  const seededUsers = (seededRes.data || []).map(u =>
    showSeededExamCentre ? u : { ...u, exam_center: null }
  );

  // Merge real + seeded users into one combined list for the feed
  const combined = [...(usersRes.data || []), ...seededUsers];

  Relationships.hydrate(connsRes.data || [], myUserId);

  // Raw map of ALL returned users (unfiltered) — used by renderRequests() so
  // incoming request senders are never silently dropped due to state/block filters.
  rawUserMap = new Map(combined.map(u => [u.id, u]));

  allUsers = combined.filter((u) => {
    if (u.id === myUserId) return false;
    if (blockedUserIds.has(u.id)) return false; // users I blocked
    if (blockedByIds.has(u.id))   return false; // users who blocked me
    // Exam-centre-state matching: only show users going to the same exam state.
    // Home location is irrelevant — two users from different cities still match
    // as long as their exam centre is in the same state.
    if (myExamCentreState) {
      if (u.exam_centre_state !== myExamCentreState) return false;
    }
    return true;
  });

  dataLoaded = true; // gate empty states until real data is present
  renderRequests();
  updateNavBadge();
  applyFilters();
}

// ─── Tab switching ────────────────────────────────────────────────────────────

const VALID_TABS = ['requests', 'find-mates', 'connections'];

const TAB_PANELS = () => ({
  'requests':    document.getElementById('hm-panel-requests'),
  'find-mates':  document.getElementById('hm-panel-find-mates'),
  'connections': document.getElementById('hm-panel-connections'),
});

// Synchronously reflect the URL-hash tab before async auth resolves, so a
// deep-link (e.g. #connections) shows the correct panel on first paint instead
// of flashing the default Find Mates panel during the auth await. Does NOT
// lazy-load connections (firebaseUser isn't ready yet) — wireTabs() handles that.
function applyInitialTabFromHash() {
  const h   = location.hash.slice(1);
  const tab = VALID_TABS.includes(h) ? h : 'find-mates';
  if (tab === 'find-mates') return; // HTML default already correct — nothing to do

  document.querySelectorAll('.hm-tab[data-tab]').forEach(btn => {
    const active = btn.dataset.tab === tab;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-selected', String(active));
  });
  Object.entries(TAB_PANELS()).forEach(([key, el]) => { if (el) el.hidden = key !== tab; });
}

function wireTabs() {
  // Resolve starting tab from URL hash; default to 'find-mates'
  const initialHash = location.hash.slice(1);
  const startTab = VALID_TABS.includes(initialHash) ? initialHash : 'find-mates';
  if (startTab !== 'find-mates') activateTab(startTab); // HTML already shows find-mates

  document.querySelectorAll('.hm-tab[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      const t = btn.dataset.tab;
      activateTab(t);
      // 'find-mates' is the canonical default — no hash needed
      history.replaceState(null, '', t === 'find-mates' ? location.pathname : `#${t}`);
    });
  });

  // Respond to hash changes (e.g. nav-bar Connections link while on dashboard)
  window.addEventListener('hashchange', () => {
    const h = location.hash.slice(1);
    activateTab(VALID_TABS.includes(h) ? h : 'find-mates');
  });
}

async function activateTab(name) {
  const tab = VALID_TABS.includes(name) ? name : 'find-mates';

  document.querySelectorAll('.hm-tab[data-tab]').forEach(btn => {
    const active = btn.dataset.tab === tab;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-selected', String(active));
  });

  const panels = {
    'requests':    document.getElementById('hm-panel-requests'),
    'find-mates':  document.getElementById('hm-panel-find-mates'),
    'connections': document.getElementById('hm-panel-connections'),
  };
  Object.entries(panels).forEach(([key, el]) => { if (el) el.hidden = key !== tab; });

  // Render Requests tab content (derived from in-memory data — no extra fetch)
  if (tab === 'requests') renderRequests();

  // Lazy-load Connections on first activation
  if (tab === 'connections' && !connectionsLoaded && firebaseUser) {
    connectionsLoaded = true;
    const root = document.getElementById('hm-connections-root');
    if (root) {
      const { runConnections } = await import('./connections.js');
      await runConnections(root, firebaseUser);
    }
  }
}

// ─── Filtering ────────────────────────────────────────────────────────────────

function getActiveFilters() {
  const out = {};
  FILTERS.forEach(({ id, key }) => {
    const v = (document.getElementById(id)?.value || '').trim().toLowerCase();
    if (v) out[key] = v;
  });
  return out;
}

function applyFilters() {
  const active = getActiveFilters();
  const keys   = Object.keys(active);
  const result = keys.length === 0
    ? allUsers
    : allUsers.filter((u) => keys.every((k) => {
        const fdef   = FILTERS.find(f => f.key === k);
        // Use fallback field for backward compat (old users without exam_centre_* cols)
        const raw    = u[k] ?? (fdef?.fallback ? u[fdef.fallback] : '');
        const field  = (raw || '').toLowerCase();
        const filter = active[k];
        // Selects use exact match (normalised values); text fields use substring search
        return fdef?.type === 'select' ? field === filter : field.includes(filter);
      }));

  updateCount(result.length);

  if (result.length === 0 && allUsers.length === 0) renderEmpty(false);
  else if (result.length === 0)                     renderEmpty(true);
  else                                              renderUsers(result);
}

const debouncedApply = debounce(applyFilters, 240);

// ─── Event wiring ─────────────────────────────────────────────────────────────

function wireFilters() {
  FILTERS.forEach(({ id, type }) => {
    document.getElementById(id)
      ?.addEventListener(type === 'text' ? 'input' : 'change', debouncedApply);
  });

  // State/district dropdowns removed — district matching is enforced at load time.

  document.getElementById('hm-filter-clear')?.addEventListener('click', clearFilters);

  document.getElementById('hm-refresh')?.addEventListener('click', async () => {
    FILTERS.forEach(({ id }) => { const el = document.getElementById(id); if (el) el.value = ''; });
    await loadData();
  });
}

function clearFilters() {
  FILTERS.forEach(({ id }) => { const el = document.getElementById(id); if (el) el.value = ''; });
  // Trigger cascade so district options reset to "All districts" when state is cleared
  applyFilters();
}

function wireModal() {
  const overlay = document.getElementById('hm-profile-modal');
  document.getElementById('hm-modal-close')?.addEventListener('click', closeModal);
  overlay?.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

  document.getElementById('hm-mates-grid')?.addEventListener('click', (e) => {
    if (e.target.closest('[data-conn-action]')) return; // handled by connection wiring
    const card = e.target.closest('[data-idx]');
    if (!card) return;
    lastFocusedCard = card;
    openModal(displayedUsers[Number(card.dataset.idx)]);
  });

  document.getElementById('hm-mates-grid')?.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const card = e.target.closest('[data-idx]');
    if (!card) return;
    e.preventDefault();
    lastFocusedCard = card;
    openModal(displayedUsers[Number(card.dataset.idx)]);
  });
}

function wireConnectionActions() {
  // Single document-level delegate catches all conn-action buttons anywhere on the page.
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-conn-action]');
    if (!btn || btn.disabled) return;
    e.stopPropagation();

    const action = btn.dataset.connAction;
    const userId = btn.dataset.userId;
    const connId = btn.dataset.connId || null;

    if (action === 'reveal') { doReveal(); return; }
    if (action === 'block')  { openBlockModal(userId); return; }

    setButtonBusy(btn, true);
    try {
      if (action === 'connect')  await doConnect(userId);
      if (action === 'accept')   await doAccept(userId, connId);
      if (action === 'decline')  await doDecline(userId, connId);
      if (action === 'withdraw') await doWithdraw(userId, connId);
    } finally {
      try { setButtonBusy(btn, false); } catch { /* btn may be detached after re-render */ }
    }
  });
}

// ─── Connection actions ───────────────────────────────────────────────────────

// Single helper: notify any mounted Connections page that the user's
// connection state changed and the 3-section layout should refresh.
function notifyConnectionsChanged() {
  window.dispatchEvent(new CustomEvent('hm:connections-changed'));
}

async function doConnect(userId) {
  if (!myUserId || !userId) return;
  if (myUserId === userId) return; // prevent self-connection
  const existing = Relationships.get(userId);
  if (existing.status !== REL.NONE) return;

  // Optimistic update — connectionId filled in after server confirms.
  Relationships.set(userId, { status: REL.PENDING_OUT, role: 'sender', connectionId: null });

  const { data, error } = await sendConnectionRequest(myUserId, userId);
  if (error) {
    toast(error.message || 'Could not send request.', { variant: 'danger' });
    Relationships.set(userId, { status: REL.NONE });
    return;
  }
  Relationships.set(userId, { status: REL.PENDING_OUT, role: 'sender', connectionId: data?.id });
  connectionsLoaded = false;
  notifyConnectionsChanged();
  toast('Request sent!', { variant: 'success' });
}

async function doAccept(userId, connId) {
  const { error } = await respondToRequest(connId, 'accepted');
  if (error) { toast(error.message || 'Could not accept.', { variant: 'danger' }); return; }
  Relationships.set(userId, { status: REL.CONNECTED, role: 'receiver', connectionId: connId });
  connectionsLoaded = false; // Connections tab re-fetches to include new contact
  notifyConnectionsChanged();
  toast('Connected! You can now reveal their contact.', { variant: 'success' });
  showSafetyConsent();

  // Auto-navigate to the Connections tab so the user immediately sees the
  // new contact. Works whether the accept came from a Requests card or
  // from the profile modal (modal is closed first if open).
  closeModal();
  activateTab('connections');
}

async function doDecline(userId, connId) {
  const { error } = await respondToRequest(connId, 'rejected');
  if (error) { toast(error.message || 'Could not decline.', { variant: 'danger' }); return; }
  Relationships.set(userId, { status: REL.REJECTED, role: 'receiver', connectionId: connId });
  connectionsLoaded = false;
  notifyConnectionsChanged();
}

async function doWithdraw(userId, connId) {
  const { error } = await deleteRequest(connId);
  if (error) { toast(error.message || 'Could not withdraw.', { variant: 'danger' }); return; }
  Relationships.set(userId, { status: REL.NONE });
  connectionsLoaded = false;
  notifyConnectionsChanged();
  toast('Request cancelled.', { variant: 'info' });
}

// ─── Safety consent dialog ────────────────────────────────────────────────────
// Shown after phone reveal AND after accepting a connection request.
function showSafetyConsent() {
  const overlay = document.getElementById('hm-safety-dialog');
  if (!overlay) return;
  overlay.classList.add('is-open');
  document.getElementById('hm-safety-agree')?.addEventListener('click', () => {
    overlay.classList.remove('is-open');
  }, { once: true });
}

function doReveal() {
  if (!modalUser?.phone) return;
  const phone  = modalUser.phone;
  const waNum  = phone.replace(/\D/g, '');

  const phoneEl   = document.getElementById('hm-modal-phone');
  const revealEl  = document.getElementById('hm-modal-contact-reveal');
  const actionsEl = document.getElementById('hm-modal-actions');

  if (phoneEl)  phoneEl.hidden = true;
  if (revealEl) revealEl.innerHTML = `
    <div class="hm-contact-revealed">
      <span class="hm-contact-revealed__number">${esc(phone)}</span>
      <div class="hm-contact-revealed__links">
        <a href="tel:${esc(phone)}" class="hm-btn hm-btn--primary hm-btn--sm">📞 Call</a>
        <a href="https://wa.me/${esc(waNum)}" target="_blank" rel="noopener noreferrer" class="hm-btn hm-btn--soft hm-btn--sm">💬 WhatsApp</a>
      </div>
    </div>`;
  if (actionsEl) actionsEl.innerHTML = '';
}

// ─── Count ────────────────────────────────────────────────────────────────────

function updateCount(n) {
  const el = document.getElementById('hm-results-count');
  if (!el) return;
  if (allUsers.length === 0) { el.textContent = ''; return; }
  const stateSuffix = myExamCentreState ? ` in ${myExamCentreState}` : '';
  el.textContent = `${n} centre ${n === 1 ? 'mate' : 'mates'} found${stateSuffix}`;
}

function updateNavBadge() {
  // Exclude blocked users from the pending-request count.
  const n = Relationships.getIncomingPending()
    .filter(({ userId }) => !blockedUserIds.has(userId))
    .length;
  const navBadge = document.getElementById('hm-requests-badge');
  if (navBadge) { navBadge.textContent = n; navBadge.hidden = n === 0; }
  const tabBadge = document.getElementById('hm-requests-tab-badge');
  if (tabBadge) { tabBadge.textContent = n; tabBadge.hidden = n === 0; }
}

// ─── Requests tab ─────────────────────────────────────────────────────────────

function renderRequests() {
  const grid = document.getElementById('hm-requests-grid');
  if (!grid) return;

  const pending = Relationships.getIncomingPending();
  // Use rawUserMap (all server-returned users) not allUsers (filtered feed).
  // This ensures request senders are always shown even if they were filtered
  // out of find-mates by exam state, blocked-by, or any other rule.
  const items = pending
    .map(({ userId, connectionId }) => {
      const u = rawUserMap.get(userId);
      return u ? { user: u, connectionId } : null;
    })
    .filter(Boolean);

  if (items.length === 0) {
    // Before data has hydrated, show a spinner — NEVER the empty state. Avoids a
    // "No pending requests" flash that then re-renders with cards once data loads.
    grid.innerHTML = dataLoaded
      ? `<div class="hm-empty" style="grid-column:1/-1;">
           <div class="hm-empty__icon" aria-hidden="true">🤝</div>
           <h3>No pending requests</h3>
           <p class="hm-text-muted">When HallMates send you connection requests, they'll appear here.</p>
         </div>`
      : `<div style="grid-column:1/-1;text-align:center;padding:var(--hm-space-7) 0;">
           <div class="hm-loader__spinner" style="margin:0 auto;"></div>
         </div>`;
    return;
  }

  grid.innerHTML = items.map(({ user, connectionId }) => requestCard(user, connectionId)).join('');
}

function requestCard(user, connectionId) {
  // gender colour from genderCls — no symbol needed
  const genderCls  = { Female: 'hm-badge--female', Male: 'hm-badge--male' }[user.gender] || '';

  const homeDistrict = user.district || '';
  const homeState    = user.state    || '';
  const homeLocHtml  = homeDistrict && homeState
    ? `<strong>${esc(homeDistrict)}</strong><span class="hm-loc-state">, ${esc(homeState)}</span>`
    : `<strong>${esc(homeDistrict || homeState || '—')}</strong>`;

  const centre   = user.exam_center || '';
  const examDist = user.exam_centre_district || user.district || '';
  const examSt   = user.exam_centre_state    || user.state    || '';
  const examLoc  = [examDist, examSt].filter(Boolean).join(', ');

  const travelIcon  = user.travel_mode && TRAVEL_ICON[user.travel_mode];
  const travelLabel = user.travel_mode && TRAVEL_LABEL[user.travel_mode];
  const stayIcon    = user.stay_plan   && STAY_ICON[user.stay_plan];
  const stayLabel   = user.stay_plan   && STAY_LABEL[user.stay_plan];
  const hasBadges   = !!(travelLabel || stayLabel);

  const uid = esc(user.id);
  const cid = esc(connectionId);

  return `
    <article class="hm-card hm-mate" aria-label="Connection request from ${esc(user.full_name)}">

      <div class="hm-mate__head">
        <div class="hm-avatar hm-avatar--card"
             style="background:${avatarColor(user.full_name)};color:#fff;"
             aria-hidden="true">${avatarInitials(user.full_name)}</div>
        <div class="hm-mate__head-info">
          <p class="hm-mate__name">${esc(user.full_name)}</p>
          <div class="hm-mate__badges">
            ${user.gender ? `<span class="hm-badge ${genderCls}">${esc(user.gender)}</span>` : ''}
            <span class="hm-badge hm-badge--verified">✓ Verified</span>
          </div>
        </div>
      </div>

      <div class="hm-mate__body">
        <div class="hm-mate__route-wrap">
          <div class="hm-mate__route-track">
            <div class="hm-mate__icon-bubble">🏠</div>
            <div class="hm-mate__route-connector">
              <div class="hm-mate__route-dot hm-mate__route-dot--top"></div>
              <div class="hm-mate__route-dashes"></div>
              <div class="hm-mate__route-dot hm-mate__route-dot--bottom"></div>
            </div>
            <div class="hm-mate__icon-bubble">📋</div>
          </div>
          <div class="hm-mate__route-info">
            <p class="hm-mate__home-loc">${homeLocHtml}</p>
            <div class="hm-mate__exam-info">
              ${centre  ? `<p class="hm-mate__centre-name">${esc(centre)}</p>`    : ''}
              ${examLoc ? `<p class="hm-mate__centre-loc">📍 ${esc(examLoc)}</p>` : ''}
            </div>
          </div>
        </div>
        ${hasBadges ? `<div class="hm-mate__v-divider"></div>` : ''}
        ${hasBadges ? `
          <div class="hm-mate__badge-cards">
            ${travelLabel ? `<div class="hm-mate__badge-card"><span class="hm-mate__badge-icon">${esc(travelIcon)}</span><span class="hm-mate__badge-label">${esc(travelLabel)}</span></div>` : ''}
            ${stayLabel   ? `<div class="hm-mate__badge-card"><span class="hm-mate__badge-icon">${esc(stayIcon)}</span><span class="hm-mate__badge-label">${esc(stayLabel)}</span></div>` : ''}
          </div>` : ''}
      </div>

      <div class="hm-mate__footer">
        <span class="hm-mate__joined">Joined ${formatDate(user.created_at)}</span>
        <div class="d-flex gap-2 flex-shrink-0">
          <button class="hm-btn hm-btn--ghost hm-btn--sm"
            data-conn-action="decline" data-user-id="${uid}" data-conn-id="${cid}">Reject</button>
          <button class="hm-btn hm-btn--primary hm-btn--sm"
            data-conn-action="accept"  data-user-id="${uid}" data-conn-id="${cid}">Accept</button>
        </div>
      </div>

    </article>`;
}

// ─── Modal ────────────────────────────────────────────────────────────────────

function openModal(user) {
  if (!user) return;
  populateModal(user);
  document.getElementById('hm-profile-modal').classList.add('is-open');
  document.body.style.overflow = 'hidden';
  setTimeout(() => document.getElementById('hm-modal-close')?.focus(), 60);
}

function closeModal() {
  modalUser = null;
  document.getElementById('hm-profile-modal').classList.remove('is-open');
  document.body.style.overflow = '';
  lastFocusedCard?.focus();
}

function populateModal(user) {
  modalUser = user;

  const avatarEl = document.getElementById('hm-modal-avatar');
  avatarEl.textContent        = avatarInitials(user.full_name);
  avatarEl.style.background   = avatarColor(user.full_name);
  avatarEl.style.color        = '#fff';

  document.getElementById('hm-modal-name').textContent     = user.full_name  || '—';
  document.getElementById('hm-modal-state').textContent    = user.exam_centre_state    || user.state    || '—';
  document.getElementById('hm-modal-district').textContent = user.exam_centre_district || user.district || '—';
  document.getElementById('hm-modal-center').textContent   = user.exam_center || '—';
  document.getElementById('hm-modal-joined').textContent   = formatDate(user.created_at);

  const badge = document.getElementById('hm-modal-gender-badge');
  const cls   = { Female: 'hm-badge--info', Male: 'hm-badge--success' }[user.gender] || '';
  badge.textContent = user.gender || '';
  badge.className   = `hm-badge ${cls}`.trim();
  badge.hidden      = !user.gender;

  // Reset phone + reveal section
  const phoneEl  = document.getElementById('hm-modal-phone');
  const revealEl = document.getElementById('hm-modal-contact-reveal');
  if (phoneEl)  { phoneEl.textContent = maskPhone(user.phone); phoneEl.hidden = false; }
  if (revealEl) revealEl.innerHTML = '';

  renderModalActions();
}

function renderModalActions() {
  if (!modalUser) return;
  const rel       = Relationships.get(modalUser.id);
  const actionsEl = document.getElementById('hm-modal-actions');
  const privacyEl = document.getElementById('hm-modal-privacy');
  if (!actionsEl) return;

  const uid = esc(modalUser.id);
  const cid = esc(rel.connectionId || '');

  switch (rel.status) {
    case REL.NONE:
      actionsEl.innerHTML = `
        <button class="hm-btn hm-btn--primary hm-btn--block"
          data-conn-action="connect" data-user-id="${uid}">Request to Connect</button>`;
      if (privacyEl) privacyEl.hidden = false;
      break;

    case REL.PENDING_OUT:
      actionsEl.innerHTML = `
        <button class="hm-btn hm-btn--ghost hm-btn--block" disabled>Request Sent</button>
        <button class="hm-btn hm-btn--ghost hm-btn--sm" style="margin-top:8px;"
          data-conn-action="withdraw" data-user-id="${uid}" data-conn-id="${cid}">Withdraw request</button>`;
      if (privacyEl) privacyEl.hidden = false;
      break;

    case REL.PENDING_IN:
      actionsEl.innerHTML = `
        <button class="hm-btn hm-btn--primary hm-btn--block"
          data-conn-action="accept" data-user-id="${uid}" data-conn-id="${cid}">Accept Request</button>
        <button class="hm-btn hm-btn--ghost hm-btn--block" style="margin-top:8px;"
          data-conn-action="decline" data-user-id="${uid}" data-conn-id="${cid}">Decline</button>`;
      if (privacyEl) privacyEl.hidden = false;
      break;

    case REL.CONNECTED:
      actionsEl.innerHTML = `
        <button class="hm-btn hm-btn--soft hm-btn--block"
          data-conn-action="reveal">📞 Reveal Contact</button>`;
      if (privacyEl) privacyEl.hidden = true;
      break;

    case REL.REJECTED:
      actionsEl.innerHTML = `
        <p class="text-center hm-text-subtle" style="font-size:var(--hm-text-sm);margin:0;">
          This request was declined.
        </p>`;
      if (privacyEl) privacyEl.hidden = true;
      break;

    default:
      actionsEl.innerHTML = '';
  }
}

// ─── Render ───────────────────────────────────────────────────────────────────

function renderSkeletons() { setGrid(Array.from({ length: 6 }, skeletonCard).join('')); }

function renderUsers(users) {
  displayedUsers = users;
  setGrid(users.map((u, i) => mateCard(u, i)).join(''));
}

function renderEmpty(isFiltered) {
  displayedUsers = [];
  setGrid(`
    <div class="hm-empty" style="grid-column:1/-1;">
      <div class="hm-empty__icon" aria-hidden="true">${isFiltered ? '🔍' : '🏛️'}</div>
      <h3>${isFiltered ? 'No centre mates found' : 'No mates yet'}</h3>
      <p class="hm-text-muted">
        ${isFiltered
          ? 'No aspirants in your exam centre state match the filters.'
          : 'Be the first aspirant from your exam centre state on Zenter.'}
      </p>
      ${isFiltered ? `<button class="hm-btn hm-btn--ghost hm-btn--sm" onclick="document.getElementById('hm-filter-clear').click()">Clear filters</button>` : ''}
    </div>`);
}

function renderError(msg) {
  displayedUsers = [];
  setGrid(`
    <div class="hm-empty" style="grid-column:1/-1;">
      <div class="hm-empty__icon" aria-hidden="true">⚠️</div>
      <h3>Could not load mates</h3>
      <p class="hm-text-muted">${esc(msg) || 'Please refresh and try again.'}</p>
      <button class="hm-btn hm-btn--ghost hm-btn--sm" onclick="document.getElementById('hm-refresh').click()">Retry</button>
    </div>`);
}

function setGrid(html) {
  const g = document.getElementById('hm-mates-grid');
  if (g) g.innerHTML = html;
}

// Targeted card CTA refresh — replaces only the footer of the changed card.
function refreshCardCta(userId) {
  const idx = displayedUsers.findIndex((u) => u.id === userId);
  if (idx === -1) return;
  const card   = document.querySelector(`[data-idx="${idx}"]`);
  const footer = card?.querySelector('.hm-mate__footer');
  if (footer) footer.innerHTML = cardFooterHtml(displayedUsers[idx]);
}

// ─── Card templates ───────────────────────────────────────────────────────────

function mateCard(user, idx) {
  // Gender: icon symbol + colour class
  // gender colour from genderCls — no symbol needed
  const genderCls  = { Female: 'hm-badge--female', Male: 'hm-badge--male' }[user.gender] || '';

  // Home location: district in bold, state in muted gray
  const homeDistrict = user.district || '';
  const homeState    = user.state    || '';
  const homeLocHtml  = homeDistrict && homeState
    ? `<strong>${esc(homeDistrict)}</strong><span class="hm-loc-state">, ${esc(homeState)}</span>`
    : `<strong>${esc(homeDistrict || homeState || '—')}</strong>`;

  // Exam centre (with fallback for old users without exam_centre_* cols)
  const centre   = user.exam_center || '';
  const examDist = user.exam_centre_district || user.district || '';
  const examSt   = user.exam_centre_state    || user.state    || '';
  const examLoc  = [examDist, examSt].filter(Boolean).join(', ');

  // Right badge cards: separate icon from label
  const travelIcon  = user.travel_mode && TRAVEL_ICON[user.travel_mode];
  const travelLabel = user.travel_mode && TRAVEL_LABEL[user.travel_mode];
  const stayIcon    = user.stay_plan   && STAY_ICON[user.stay_plan];
  const stayLabel   = user.stay_plan   && STAY_LABEL[user.stay_plan];
  const hasBadges   = !!(travelLabel || stayLabel);

  return `
    <article class="hm-card hm-mate hm-card--interactive"
      data-idx="${idx}" tabindex="0" role="button"
      aria-label="View ${esc(user.full_name)}'s profile">

      <!-- Identity row: avatar · name · gender + verified badges -->
      <div class="hm-mate__head">
        <div class="hm-avatar hm-avatar--card"
             style="background:${avatarColor(user.full_name)};color:#fff;"
             aria-hidden="true">${avatarInitials(user.full_name)}</div>
        <div class="hm-mate__head-info">
          <p class="hm-mate__name">${esc(user.full_name)}</p>
          <div class="hm-mate__badges">
            ${user.gender
              ? `<span class="hm-badge ${genderCls}">${esc(user.gender)}</span>`
              : ''}
            <span class="hm-badge hm-badge--verified">✓ Verified</span>
          </div>
        </div>
      </div>

      <!-- Body: route timeline (left) + divider + badge cards (right) -->
      <div class="hm-mate__body">

        <!-- Route wrap: icon track + location text column -->
        <div class="hm-mate__route-wrap">

          <!-- Icon track: home → dashed connector with dots → exam -->
          <div class="hm-mate__route-track">
            <div class="hm-mate__icon-bubble">🏠</div>
            <div class="hm-mate__route-connector">
              <div class="hm-mate__route-dot hm-mate__route-dot--top"></div>
              <div class="hm-mate__route-dashes"></div>
              <div class="hm-mate__route-dot hm-mate__route-dot--bottom"></div>
            </div>
            <div class="hm-mate__icon-bubble">📋</div>
          </div>

          <!-- Text: home loc (top, beside home icon) ↔ exam info (bottom) -->
          <div class="hm-mate__route-info">
            <p class="hm-mate__home-loc">${homeLocHtml}</p>
            <div class="hm-mate__exam-info">
              ${centre  ? `<p class="hm-mate__centre-name">${esc(centre)}</p>`    : ''}
              ${examLoc ? `<p class="hm-mate__centre-loc">📍 ${esc(examLoc)}</p>` : ''}
            </div>
          </div>

        </div>

        <!-- Vertical dashed divider (only rendered when badges exist) -->
        ${hasBadges ? `<div class="hm-mate__v-divider"></div>` : ''}

        <!-- Badge cards: travel mode + stay plan -->
        ${hasBadges ? `
          <div class="hm-mate__badge-cards">
            ${travelLabel ? `
              <div class="hm-mate__badge-card">
                <span class="hm-mate__badge-icon">${esc(travelIcon)}</span>
                <span class="hm-mate__badge-label">${esc(travelLabel)}</span>
              </div>` : ''}
            ${stayLabel ? `
              <div class="hm-mate__badge-card">
                <span class="hm-mate__badge-icon">${esc(stayIcon)}</span>
                <span class="hm-mate__badge-label">${esc(stayLabel)}</span>
              </div>` : ''}
          </div>` : ''}

      </div>

      <!-- Footer: join date · connection CTA -->
      <div class="hm-mate__footer">${cardFooterHtml(user)}</div>
    </article>`;
}

function cardFooterHtml(user) {
  const rel    = Relationships.get(user.id);
  const joined = `<span class="hm-mate__joined">Joined ${formatDate(user.created_at)}</span>`;

  const uid = esc(user.id);
  const cid = esc(rel.connectionId || '');

  let cta = '';
  switch (rel.status) {
    case REL.NONE:
      cta = `<button class="hm-btn hm-btn--primary hm-btn--sm"
               data-conn-action="connect" data-user-id="${uid}">Connect</button>`;
      break;
    case REL.PENDING_OUT:
      cta = `<span class="hm-badge hm-badge--info" style="font-size:11px;">Sent</span>`;
      break;
    case REL.PENDING_IN:
      cta = `
        <button class="hm-btn hm-btn--primary hm-btn--sm"
          data-conn-action="accept" data-user-id="${uid}" data-conn-id="${cid}">Accept</button>
        <button class="hm-btn hm-btn--ghost hm-btn--sm"
          data-conn-action="decline" data-user-id="${uid}" data-conn-id="${cid}">Decline</button>`;
      break;
    case REL.CONNECTED:
      cta = `<span class="hm-badge hm-badge--success" style="font-size:11px;">✓ Connected</span>`;
      break;
    case REL.REJECTED:
      cta = `<span class="hm-badge" style="font-size:11px;">Declined</span>`;
      break;
  }

  return `${joined}<div class="hm-mate__cta d-flex gap-1 align-items-center">${cta}</div>`;
}

function skeletonCard() {
  return `
    <article class="hm-card hm-mate" aria-hidden="true">
      <div class="hm-mate__head">
        <div class="hm-skeleton" style="width:40px;height:40px;border-radius:50%;flex-shrink:0;"></div>
        <div style="flex:1;min-width:0;">
          <div class="hm-skeleton" style="height:14px;width:55%;margin-bottom:8px;"></div>
          <div class="hm-skeleton" style="height:12px;width:38%;"></div>
        </div>
      </div>
      <div class="d-flex gap-2 mt-2">
        <div class="hm-skeleton" style="height:22px;width:64px;border-radius:999px;"></div>
        <div class="hm-skeleton" style="height:22px;width:80px;border-radius:999px;"></div>
      </div>
      <div class="hm-skeleton mt-2" style="height:12px;width:75%;"></div>
      <div class="hm-mate__footer" style="margin-top:auto;">
        <div class="hm-skeleton" style="height:12px;width:40%;"></div>
        <div class="hm-skeleton" style="height:30px;width:80px;border-radius:8px;"></div>
      </div>
    </article>`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function avatarInitials(name) {
  return (name || '?').split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

function avatarColor(name) {
  let hash = 0;
  for (const c of (name || '')) hash = (hash * 31 + c.charCodeAt(0)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function maskPhone(phone) {
  if (!phone) return '—';
  const s = String(phone);
  return `${s.startsWith('+91') ? '+91 ' : ''}XXXXXXX${s.slice(-3)}`;
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ─── Block ────────────────────────────────────────────────────────────────────

const MIN_BLOCK_REASON_LEN = 5;

function openBlockModal(userId) {
  const modal = document.getElementById('hm-block-modal');
  if (!modal) return;
  modal.dataset.targetUserId = userId;
  // Reset textarea + disable submit each time the modal opens
  const ta  = document.getElementById('hm-block-reason');
  const btn = document.getElementById('hm-block-confirm');
  if (ta)  ta.value = '';
  if (btn) btn.disabled = true;
  modal.classList.add('is-open');
  setTimeout(() => ta?.focus(), 60);
}

function wireBlockModal() {
  const modal = document.getElementById('hm-block-modal');
  if (!modal) return;
  const ta  = document.getElementById('hm-block-reason');
  const btn = document.getElementById('hm-block-confirm');

  document.getElementById('hm-block-cancel')
    ?.addEventListener('click', () => modal.classList.remove('is-open'));

  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.remove('is-open');
  });

  // Live validation: at least 5 non-whitespace characters
  ta?.addEventListener('input', () => {
    const valid = ta.value.trim().length >= MIN_BLOCK_REASON_LEN;
    if (btn) btn.disabled = !valid;
  });

  btn?.addEventListener('click', async () => {
    const userId = modal.dataset.targetUserId;
    const reason = ta?.value.trim() || '';
    if (!userId || reason.length < MIN_BLOCK_REASON_LEN) return;
    setButtonBusy(btn, true, 'Blocking…');
    await doBlock(userId, reason);
    setButtonBusy(btn, false);
    modal.classList.remove('is-open');
  });
}

async function doBlock(userId, reason) {
  if (!myUserId) return;
  const { error } = await blockUser(myUserId, userId, reason);
  if (error) { toast(error.message || 'Could not block user.', { variant: 'danger' }); return; }

  // Remove any existing connection rows (in either direction) so the blocked
  // user disappears from Connections immediately and can't re-establish via
  // a stale row. Errors here are non-fatal — the block itself succeeded.
  await deleteConnectionsBetween(myUserId, userId).catch(() => {});

  blockedUserIds.add(userId);
  allUsers = allUsers.filter((u) => u.id !== userId);

  applyFilters();
  renderRequests();
  updateNavBadge();
  closeModal(); // close the profile modal if it was open

  // Notify the Connections panel (if mounted) to drop this user's card.
  window.dispatchEvent(new CustomEvent('hm:user-blocked', { detail: { userId } }));

  toast('User blocked — they won\'t appear in Find Mates.', { variant: 'info' });
}

// ─── Enrichment helpers ───────────────────────────────────────────────────────

// Maps stored values → emoji icon + short label (split for badge-card layout).
const TRAVEL_ICON = {
  'By train':   '🚂',
  'By flight':  '✈️',
  'By bus':     '🚌',
  'Self-drive': '🚗',
  'Shared Cab': '🚕',
  'Other':      '🚐',
};
const TRAVEL_LABEL = {
  'By train':   'Train',
  'By flight':  'Flight',
  'By bus':     'Bus',
  'Self-drive': 'Self Drive',
  'Shared Cab': 'Shared Cab',
  'Other':      'Other',
};
const STAY_ICON = {
  'Need accommodation':     '🏨',
  'Have accommodation':     '🏠',
  'Looking for room share': '🛏️',
  'Other':                  '🏡',
};
const STAY_LABEL = {
  'Need accommodation':     'Needs stay',
  'Have accommodation':     'Has stay',
  'Looking for room share': 'Room share',
  'Other':                  'Yet to Decide',
};

document.addEventListener('DOMContentLoaded', init);

// bfcache fix: when the user navigates back from another page (e.g. unblocking
// from blocked-users.html), the browser may restore this page from the
// back/forward cache with frozen JS state. Detect this and re-fetch blocked IDs
// + user data so newly-unblocked users appear immediately in the feed.
window.addEventListener('pageshow', async (e) => {
  if (!e.persisted) return; // normal load — init() already ran
  if (!myUserId) return;
  // Re-fetch both block directions with latest state
  const { getBlockedUserIds: fetchBlocked, getBlockedByIds: fetchBlockedBy } = await import('./supabase.js');
  const [blockedRes, blockedByRes] = await Promise.all([
    fetchBlocked(myUserId),
    fetchBlockedBy(myUserId),
  ]);
  blockedUserIds = new Set((blockedRes.data  || []).map(b => b.blocked_user_id));
  blockedByIds   = new Set((blockedByRes.data || []).map(b => b.blocker_user_id));
  await loadData();
});
