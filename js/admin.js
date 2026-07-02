// Zenter Admin Platform — Phase 3: Final Operational Completion.
// All 7 sections fully implemented. All mutations via SECURITY DEFINER functions.

import { requireAdmin, logout, onAuthChange } from './auth.js';
import { formatPhonePretty }    from './utils.js';

const ROUTES = ['dashboard','users','roll-no-requests','seeded','seeded-requests','feedback','reports','exams','analytics','plus','settings'];
const loaded      = new Set();
let allUsers      = [];
let allSeeded     = [];
let allFeedbacks  = [];
let allReports    = [];
let adminPhone   = '';
let platformConfig = {};   // { feature_toggles:{}, exam_config:[], global_maintenance:false }

// ─── Bootstrap ───────────────────────────────────────────────────────────────

(async function init() {
  const user = await requireAdmin();
  if (!user) return;
  adminPhone = user.phoneNumber || '';

  // Watch for auth changes — if user signs out OR changes to a non-admin,
  // immediately clear admin UI and redirect (prevents stale data exposure).
  onAuthChange(async (currentUser) => {
    if (!currentUser) {
      // Signed out — clear DOM and redirect
      document.body.innerHTML = '';
      window.location.replace('/login.html');
      return;
    }
    if (currentUser.phoneNumber !== adminPhone) {
      // Different user logged in — verify they're admin
      try {
        const { getRoleByPhone } = await import('./supabase.js');
        const { data: roleRow } = await getRoleByPhone(currentUser.phoneNumber);
        const isAdmin = roleRow?.role === 'admin' || roleRow?.role === 'superadmin';
        if (!isAdmin) {
          document.body.innerHTML = '';
          window.location.replace('/dashboard.html');
        }
      } catch {
        document.body.innerHTML = '';
        window.location.replace('/login.html');
      }
    }
  });

  document.getElementById('adm-shell').hidden = false;
  document.getElementById('adm-gate')?.classList.add('is-hidden');
  setTimeout(() => document.getElementById('adm-gate')?.remove(), 400);

  // Fetch admin name for the topbar — show name instead of phone
  const { getProfileByPhone } = await import('./supabase.js');
  const { data: me } = await getProfileByPhone(adminPhone);
  const adminName = (me?.full_name || '').trim();
  const initials  = adminName
    ? adminName.split(/\s+/).slice(0,2).map(w => w[0]).join('').toUpperCase()
    : (adminPhone.slice(-2) || 'A').toUpperCase();
  document.getElementById('adm-user-phone').textContent  = adminName || 'Admin';
  document.getElementById('adm-user-avatar').textContent = initials;

  document.addEventListener('click', (e) => {
    if (e.target?.dataset?.action === 'logout') logout('/login.html');
  });

  // Load platform config early — other sections may depend on it
  const { getPlatformConfig } = await import('./supabase.js');
  const { data: configRows } = await getPlatformConfig();
  (configRows || []).forEach(r => { platformConfig[r.key] = r.value; });

  wireRouter();
  wireConfirmDialog();
  wireToast();
  activateRoute(getRouteFromHash());

  // Eager-fetch pending Roll No requests so the sidebar badge is correct on first load
  primeRollNoBadge();
})();

async function primeRollNoBadge() {
  try {
    const { from: f } = await import('./supabase.js');
    // Await the builder directly — our query() wrapper strips the `count` field
    const { count } = await f('users')
      .select('id', { count: 'exact', head: true })
      .eq('verification_requested', true)
      .eq('is_verified_aspirant', false)
      .eq('verification_rejected', false);
    const badge = document.getElementById('adm-rollno-nav-badge');
    if (badge && Number.isFinite(count)) {
      badge.textContent = String(count);
      badge.hidden = count === 0;
    }
  } catch {}
}

// ─── Router ───────────────────────────────────────────────────────────────────

function getRouteFromHash() {
  const h = (location.hash || '').slice(1).toLowerCase();
  return ROUTES.includes(h) ? h : 'dashboard';
}
function wireRouter() {
  window.addEventListener('hashchange', () => activateRoute(getRouteFromHash()));
}
function navigateTo(route) {
  if (!ROUTES.includes(route)) return;
  location.hash = route;
  activateRoute(route);
}
function activateRoute(route) {
  document.querySelectorAll('.adm-nav a').forEach(a => a.classList.toggle('is-active', a.dataset.route === route));
  document.querySelectorAll('.adm-panel').forEach(p => p.classList.toggle('is-active', p.dataset.route === route));
  const titleEl = document.getElementById('adm-page-title');
  if (titleEl) titleEl.textContent = capitalize(route);
  if (!loaded.has(route)) { loaded.add(route); LOADERS[route]?.(); }
}

// ─── Section loaders ──────────────────────────────────────────────────────────

const LOADERS = {
  dashboard:           loadDashboard,
  users:               loadUsers,
  'roll-no-requests':  loadRollNoRequests,
  seeded:              loadSeeded,
  'seeded-requests':   loadSeededRequests,
  feedback:            loadFeedback,
  reports:             loadReports,
  exams:               loadExams,
  analytics:           loadAnalytics,
  plus:                loadPlus,
  settings:            loadSettings,
};

async function loadDashboard() {
  const { getAdminStats, getRecentUsers } = await import('./supabase.js');
  const [statsRes, usersRes] = await Promise.all([getAdminStats(), getRecentUsers(8)]);
  if (statsRes.data) {
    setStat('stat-total-users',  statsRes.data.totalUsers);
    setStat('stat-active-users', statsRes.data.activeUsers);
    setStat('stat-feedback',     statsRes.data.feedback);
    setStat('stat-reports',      statsRes.data.reports);
    setStat('stat-plus-users',   statsRes.data.plusUsers);
  }
  document.getElementById('adm-latest-users').innerHTML =
    usersRes.data?.length ? renderUsersTable(usersRes.data.slice(0,8), false) : emptyState('🌱','No users yet.');
}

async function loadUsers() {
  const { getRecentUsers } = await import('./supabase.js');
  const { data, error } = await getRecentUsers(500);
  if (error || !data) { document.getElementById('adm-users-list').innerHTML = emptyState('⚠️','Could not load users.'); return; }
  allUsers = data;
  renderFilteredUsers();
  const rerender = debounce(renderFilteredUsers, 180);
  ['adm-user-search','adm-user-filter-exam','adm-user-filter-gender','adm-user-filter-status']
    .forEach(id => document.getElementById(id)?.addEventListener('input', rerender));
}

function renderFilteredUsers() {
  const search  = (document.getElementById('adm-user-search')?.value || '').toLowerCase();
  const exam    = document.getElementById('adm-user-filter-exam')?.value    || '';
  const gender  = document.getElementById('adm-user-filter-gender')?.value  || '';
  const status  = document.getElementById('adm-user-filter-status')?.value  || '';
  const filtered = allUsers.filter(u => {
    if (search && !`${u.full_name} ${u.phone}`.toLowerCase().includes(search)) return false;
    if (exam   && u.exam_type !== exam)  return false;
    if (gender && u.gender   !== gender) return false;
    if (status === 'suspended' && u.account_status !== 'suspended') return false;
    return true;
  });
  const el = document.getElementById('adm-users-list');
  el.innerHTML = filtered.length ? renderUsersTable(filtered, true) : emptyState('🔍','No users match filters.');
}

// ─── Roll No Requests ─────────────────────────────────────────────────────────

let allRollNoRequests = [];

async function loadRollNoRequests() {
  const el = document.getElementById('adm-rollno-list');
  if (!el) return;
  el.innerHTML = '<div class="adm-empty" style="padding:24px;">Loading…</div>';

  const { query: q, from: f } = await import('./supabase.js');
  const { data, error } = await q(
    f('users')
      .select('id, full_name, phone, exam_type, district, state, nta_application_number, verification_requested, is_verified_aspirant, verification_rejected, created_at')
      .eq('verification_requested', true)
      .eq('is_verified_aspirant', false)
      .eq('verification_rejected', false)
      .order('created_at', { ascending: true })
  );
  if (error) { el.innerHTML = emptyState('⚠️','Could not load requests.'); return; }
  allRollNoRequests = data || [];
  updateRollNoNavBadge();
  renderRollNoRequests();

  const rerender = debounce(renderRollNoRequests, 180);
  document.getElementById('adm-rollno-search')?.addEventListener('input', rerender);
  document.getElementById('adm-rollno-filter-exam')?.addEventListener('change', rerender);
  document.getElementById('adm-rollno-refresh')?.addEventListener('click', () => {
    loaded.delete('roll-no-requests');
    loadRollNoRequests();
  });
}

function renderRollNoRequests() {
  const el = document.getElementById('adm-rollno-list');
  if (!el) return;
  const search = (document.getElementById('adm-rollno-search')?.value || '').toLowerCase();
  const exam = document.getElementById('adm-rollno-filter-exam')?.value || '';
  const rows = allRollNoRequests.filter(u => {
    if (search && !`${u.full_name || ''} ${u.phone || ''} ${u.nta_application_number || ''}`.toLowerCase().includes(search)) return false;
    if (exam && u.exam_type !== exam) return false;
    return true;
  });

  if (!rows.length) {
    el.innerHTML = emptyState('✅','No pending Roll No verification requests.');
    return;
  }

  el.innerHTML = `<table class="adm-table"><thead><tr>
    <th>Name</th><th>Phone</th><th>Exam</th><th>Home</th><th>Roll No</th><th>Submitted</th><th>Actions</th>
  </tr></thead><tbody>${rows.map(u => `
    <tr data-rollno-row="${esc(u.id)}">
      <td><strong>${esc(u.full_name || '—')}</strong></td>
      <td style="font-size:11px;">${esc(formatPhonePretty(u.phone) || u.phone || '—')}</td>
      <td>${esc(u.exam_type || '—')}</td>
      <td style="font-size:11px;">${esc([u.district, u.state].filter(Boolean).join(', ') || '—')}</td>
      <td>
        <code style="font-family:monospace;font-weight:700;font-size:13px;background:var(--adm-surface-2);padding:3px 8px;border-radius:4px;">${esc(u.nta_application_number || '—')}</code>
      </td>
      <td style="font-size:11px;color:var(--adm-text-dim);">${esc(fmtDate(u.created_at))}</td>
      <td>
        <div class="adm-actions" style="gap:4px;flex-wrap:wrap;">
          <button class="adm-btn adm-btn--sm adm-btn--ok"
                  data-action="rollno-approve" data-id="${esc(u.id)}" data-name="${esc(u.full_name || 'User')}">
            ✓ Approve
          </button>
          <button class="adm-btn adm-btn--sm adm-btn--danger"
                  data-action="rollno-reject" data-id="${esc(u.id)}" data-name="${esc(u.full_name || 'User')}">
            ✗ Reject
          </button>
        </div>
      </td>
    </tr>`).join('')}</tbody></table>`;
}

function updateRollNoNavBadge() {
  const badge = document.getElementById('adm-rollno-nav-badge');
  if (!badge) return;
  const n = allRollNoRequests.length;
  badge.textContent = String(n);
  badge.hidden = n === 0;
}

// ─── Seeded users ─────────────────────────────────────────────────────────────

async function loadSeeded() {
  const { getAllSeededUsers } = await import('./supabase.js');
  const { data, error } = await getAllSeededUsers(500);
  if (error || !data) { document.getElementById('adm-seeded-list').innerHTML = emptyState('⚠️','Could not load seeded users.'); return; }
  allSeeded = data;

  // Populate district filter
  const distEl = document.getElementById('adm-seeded-filter-district');
  if (distEl && distEl.options.length === 1) {
    const districts = [...new Set(data.map(u => u.exam_centre_district).filter(Boolean))].sort();
    districts.forEach(d => { const o = document.createElement('option'); o.value = o.textContent = d; distEl.appendChild(o); });
  }

  const { getPlatformConfig, adminUpdateConfig } = await import('./supabase.js');
  const { data: cfgRows } = await getPlatformConfig();

  // Toggle 1: show/hide ALL seeded users in Find Mates feed
  const globalToggle = document.getElementById('adm-seeded-global-toggle');
  const globalLabel  = document.getElementById('adm-seeded-global-label');
  if (globalToggle) {
    const seededVisible = (cfgRows || []).find(r => r.key === 'seeded_users_visible')?.value !== false;
    globalToggle.checked = seededVisible;
    globalLabel.textContent = seededVisible ? 'Seeded users visible in feed' : 'Seeded users hidden from feed';
    globalToggle.addEventListener('change', async () => {
      globalToggle.disabled = true;
      globalLabel.textContent = 'Saving…';
      const { error } = await adminUpdateConfig('seeded_users_visible', globalToggle.checked, adminPhone);
      globalToggle.disabled = false;
      if (error) { toast('Error: ' + error.message, 'error'); globalToggle.checked = !globalToggle.checked; return; }
      globalLabel.textContent = globalToggle.checked ? 'Seeded users visible in feed' : 'Seeded users hidden from feed';
      toast(globalToggle.checked ? 'Seeded users shown in feed ✓' : 'Seeded users hidden from feed ✓', 'success');
    });
  }

  // Toggle 2: show or hide exam centre name on seeded user cards
  const toggle = document.getElementById('adm-seeded-visibility-toggle');
  const label  = document.getElementById('adm-seeded-visibility-label');
  if (toggle) {
    const showExamCentre = (cfgRows || []).find(r => r.key === 'seeded_exam_centre_visible')?.value !== false;
    toggle.checked = showExamCentre;
    label.textContent = showExamCentre ? 'Exam centre visible on cards' : 'Exam centre hidden on cards';
    toggle.addEventListener('change', async () => {
      toggle.disabled = true;
      label.textContent = 'Saving…';
      const { error } = await adminUpdateConfig('seeded_exam_centre_visible', toggle.checked, adminPhone);
      toggle.disabled = false;
      if (error) { toast('Error: ' + error.message, 'error'); toggle.checked = !toggle.checked; return; }
      label.textContent = toggle.checked ? 'Exam centre visible on cards' : 'Exam centre hidden on cards';
      toast(toggle.checked ? 'Exam centre shown on seeded cards ✓' : 'Exam centre hidden on seeded cards ✓', 'success');
    });
  }

  renderFilteredSeeded();
  const rerender = debounce(renderFilteredSeeded, 180);
  ['adm-seeded-search','adm-seeded-filter-district']
    .forEach(id => document.getElementById(id)?.addEventListener('input', rerender));
}

function renderFilteredSeeded() {
  const search   = (document.getElementById('adm-seeded-search')?.value || '').toLowerCase();
  const district = document.getElementById('adm-seeded-filter-district')?.value || '';
  const filtered = allSeeded.filter(u => {
    if (search   && !`${u.full_name} ${u.exam_centre_district}`.toLowerCase().includes(search)) return false;
    if (district && u.exam_centre_district !== district) return false;
    return true;
  });
  const el = document.getElementById('adm-seeded-list');
  el.innerHTML = filtered.length ? renderSeededTable(filtered) : emptyState('🔍','No seeded users match filters.');
}

// ─── Seeded user pending requests ────────────────────────────────────────────

async function loadSeededRequests() {
  const el = document.getElementById('adm-seeded-requests');
  if (!el) return;

  const { query: q, from: f, sendMessage, adminAcceptSeededRequest, createConversation, sendSeededConnectionRequest } = await import('./supabase.js');

  // Get ALL seeded users and real users for dropdowns + table
  const { data: allSeededIds } = await q(f('seeded_users').select('id, full_name'));
  const seededIdSet = new Set((allSeededIds || []).map(s => s.id));

  // Populate dropdowns
  const seededSelect = document.getElementById('adm-seeded-sender');
  const realSelect = document.getElementById('adm-real-receiver');
  if (seededSelect && seededSelect.options.length === 0) {
    (allSeededIds || []).sort((a, b) => a.full_name.localeCompare(b.full_name)).forEach(u => {
      const o = document.createElement('option');
      o.value = u.id; o.textContent = u.full_name;
      seededSelect.appendChild(o);
    });
  }
  if (realSelect && realSelect.options.length === 0) {
    const { data: realUsers } = await q(
      f('users').select('id, full_name, phone').eq('profile_completed', true).order('full_name')
    );
    (realUsers || []).forEach(u => {
      const o = document.createElement('option');
      o.value = u.id; o.textContent = `${u.full_name} (${u.phone || ''})`;
      realSelect.appendChild(o);
    });
  }

  // Wire send request button
  const sendBtn = document.getElementById('adm-send-seeded-request');
  const sendStatus = document.getElementById('adm-seeded-send-status');
  if (sendBtn && !sendBtn.dataset.wired) {
    sendBtn.dataset.wired = 'true';
    sendBtn.addEventListener('click', async () => {
      const seededId = seededSelect?.value;
      const realId = realSelect?.value;
      if (!seededId || !realId) { sendStatus.textContent = 'Select both users.'; return; }

      sendBtn.disabled = true;
      sendStatus.style.color = 'var(--adm-text-muted)';
      sendStatus.textContent = 'Sending…';

      const { error } = await sendSeededConnectionRequest(seededId, realId);
      if (error) {
        sendStatus.style.color = '#dc2626';
        sendStatus.textContent = error.message?.includes('duplicate') || error.message?.includes('unique')
          ? '✗ Request already exists between these users.'
          : '✗ ' + error.message;
        sendBtn.disabled = false;
        return;
      }

      sendStatus.style.color = '#16a34a';
      sendStatus.textContent = '✓ Request sent! It will appear in the real user\'s Requests tab.';
      sendBtn.disabled = false;
      // Refresh table
      loaded.delete('seeded-requests');
      loadSeededRequests();
    });
  }

  // Get connections where seeded user is EITHER sender or receiver
  const seededIdArr = [...seededIdSet];
  const { data: connsAsReceiver } = await q(
    f('connections').select('id, sender_id, receiver_id, status, created_at')
      .in('receiver_id', seededIdArr).order('created_at', { ascending: false })
  );
  const { data: connsAsSender } = await q(
    f('connections').select('id, sender_id, receiver_id, status, created_at')
      .in('sender_id', seededIdArr).order('created_at', { ascending: false })
  );

  // Merge and dedupe
  const connMap = new Map();
  [...(connsAsReceiver || []), ...(connsAsSender || [])].forEach(c => connMap.set(c.id, c));
  const allConns = [...connMap.values()].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  if (!allConns.length) {
    el.innerHTML = emptyState('✅', 'No seeded user requests yet.');
    return;
  }

  const pending  = allConns.filter(c => c.status === 'pending');
  const accepted = allConns.filter(c => c.status === 'accepted');

  // Collect all user IDs (both real and seeded)
  const allUserIds = [...new Set(allConns.flatMap(r => [r.sender_id, r.receiver_id]))];
  const allRealIds = allUserIds.filter(id => !seededIdSet.has(id));
  const allSeededConnIds = allUserIds.filter(id => seededIdSet.has(id));

  // Fetch real users and seeded users
  const { data: realUsers } = allRealIds.length
    ? await q(f('users').select('id, full_name, phone').in('id', allRealIds))
    : { data: [] };
  const { data: seededUsers } = allSeededConnIds.length
    ? await q(f('seeded_users').select('id, full_name').in('id', allSeededConnIds))
    : { data: [] };

  const realMap = Object.fromEntries((realUsers || []).map(u => [u.id, u]));
  const seededMap = Object.fromEntries((seededUsers || []).map(u => [u.id, u]));

  // Helper: identify which side is seeded
  const getParties = (r) => {
    const senderIsSeeded = seededIdSet.has(r.sender_id);
    const realUser = senderIsSeeded ? (realMap[r.receiver_id] || {}) : (realMap[r.sender_id] || {});
    const seededUser = senderIsSeeded ? (seededMap[r.sender_id] || {}) : (seededMap[r.receiver_id] || {});
    const seededId = senderIsSeeded ? r.sender_id : r.receiver_id;
    const direction = senderIsSeeded ? '← sent by seeded' : '→ sent to seeded';
    return { realUser, seededUser, seededId, direction, senderIsSeeded };
  };

  // Fetch conversations for accepted connections
  const { data: convs } = accepted.length
    ? await q(f('conversations').select('id, connection_id').in('connection_id', accepted.map(c => c.id)))
    : { data: [] };
  const convByConn = Object.fromEntries((convs || []).map(c => [c.connection_id, c.id]));

  // Build pending rows
  const pendingRows = pending.map(r => {
    const { realUser, seededUser, direction, senderIsSeeded } = getParties(r);
    const date = new Date(r.created_at).toLocaleDateString('en-IN', { day:'numeric', month:'short' });
    const dirLabel = senderIsSeeded
      ? `<span style="font-size:10px;color:var(--adm-text-dim);">seeded → real</span>`
      : `<span style="font-size:10px;color:var(--adm-text-dim);">real → seeded</span>`;
    // Only show Accept for "real → seeded" (admin acts as seeded).
    // "seeded → real" must be accepted by the real user themselves.
    const actionCell = senderIsSeeded
      ? `<td><span style="font-size:11px;color:var(--adm-text-dim);">Waiting for user</span></td><td></td>`
      : `<td><button class="adm-btn adm-btn--ok adm-btn--sm" data-accept-seeded="${r.id}" data-sender="${r.sender_id}" data-receiver="${r.receiver_id}">Accept</button></td><td></td>`;
    return `<tr>
      <td><strong>${esc(realUser.full_name || '—')}</strong><br><span style="font-size:11px;color:var(--adm-text-dim);">${esc(realUser.phone || '')}</span></td>
      <td>${esc(seededUser.full_name || '—')} ${dirLabel}</td>
      <td><span style="color:#f59e0b;font-weight:600;">Pending</span></td>
      <td>${date}</td>
      ${actionCell}
    </tr>`;
  }).join('');

  // Build accepted rows with message input
  const acceptedRows = accepted.map(r => {
    const { realUser, seededUser, seededId, senderIsSeeded } = getParties(r);
    const convId = convByConn[r.id] || '';
    const date = new Date(r.created_at).toLocaleDateString('en-IN', { day:'numeric', month:'short' });
    const dirLabel = senderIsSeeded
      ? `<span style="font-size:10px;color:var(--adm-text-dim);">seeded → real</span>`
      : `<span style="font-size:10px;color:var(--adm-text-dim);">real → seeded</span>`;
    return `<tr>
      <td><strong>${esc(realUser.full_name || '—')}</strong><br><span style="font-size:11px;color:var(--adm-text-dim);">${esc(realUser.phone || '')}</span></td>
      <td>${esc(seededUser.full_name || '—')} ${dirLabel}</td>
      <td><span style="color:#16a34a;font-weight:600;">Active</span></td>
      <td>${date}</td>
      <td colspan="2">
        <div style="display:flex;gap:6px;align-items:center;">
          <input type="text" class="adm-search" placeholder="Type as ${esc(seededUser.full_name || 'seeded')}…"
                 data-msg-input="${convId}" data-seeded-id="${seededId}"
                 style="flex:1;padding:6px 10px;font-size:12px;min-width:120px;" maxlength="500" />
          <button class="adm-btn adm-btn--ok adm-btn--sm" data-msg-send="${convId}" data-seeded-id="${seededId}">Send</button>
        </div>
      </td>
    </tr>`;
  }).join('');

  el.innerHTML = `<table class="adm-table"><thead><tr>
    <th>Real User</th><th>Seeded User</th><th>Status</th><th>Date</th><th colspan="2">Action / Message</th>
  </tr></thead><tbody>${pendingRows}${acceptedRows}</tbody></table>`;

  // Wire accept buttons
  el.querySelectorAll('[data-accept-seeded]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const connId = btn.dataset.acceptSeeded;
      const senderId = btn.dataset.sender;
      const receiverId = btn.dataset.receiver;
      btn.disabled = true;
      btn.textContent = 'Accepting…';

      const { data, error } = await adminAcceptSeededRequest(connId);
      if (error) {
        toast('Failed: ' + error.message, 'error');
        btn.disabled = false;
        btn.textContent = 'Accept';
        return;
      }

      await createConversation(connId, senderId, receiverId);

      toast('Accepted with greeting!', 'success');
      // Refresh to show message input
      loaded.delete('seeded-requests');
      loadSeededRequests();
    });
  });

  // Wire send message buttons
  el.querySelectorAll('[data-msg-send]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const convId = btn.dataset.msgSend;
      const seededId = btn.dataset.seededId;
      const input = el.querySelector(`[data-msg-input="${convId}"]`);
      const msg = (input?.value || '').trim();
      if (!msg || !convId) return;

      btn.disabled = true;
      btn.textContent = 'Sending…';
      const { error } = await sendMessage(convId, seededId, msg);
      if (error) {
        toast('Failed to send: ' + error.message, 'error');
        btn.disabled = false;
        btn.textContent = 'Send';
        return;
      }
      input.value = '';
      btn.disabled = false;
      btn.textContent = 'Send';
      toast('Message sent as seeded user ✓', 'success');
    });

    // Enter key support
    const input = el.querySelector(`[data-msg-input="${btn.dataset.msgSend}"]`);
    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') btn.click();
    });
  });
}

function renderSeededTable(users) {
  const rows = users.map(u => {
    const paused = u.is_profile_paused;
    return `<tr>
      <td>${esc(u.full_name||'—')}</td>
      <td>${esc(u.gender||'—')}</td>
      <td style="font-size:11px">${esc(u.exam_centre_district||'—')}</td>
      <td style="font-size:11px">${esc(u.exam_center||'—')}</td>
      <td>${esc(u.travel_mode||'—')}</td>
      <td>${esc(u.stay_plan||'—')}</td>
      <td><span class="adm-pill adm-pill--${paused?'paused':'active'}">${paused?'Hidden':'Visible'}</span></td>
      <td>
        <div class="adm-actions" style="gap:4px;">
          <button class="adm-btn adm-btn--sm ${paused?'adm-btn--ok':'adm-btn--warn'}"
            data-action="${paused?'show-seeded':'hide-seeded'}" data-id="${esc(u.id)}">
            ${paused?'Show':'Hide'}
          </button>
          <button class="adm-btn adm-btn--sm adm-btn--danger"
            data-action="delete-seeded" data-id="${esc(u.id)}" data-name="${esc(u.full_name||'user')}">
            Delete
          </button>
        </div>
      </td>
    </tr>`;
  }).join('');
  return `<table class="adm-table"><thead><tr>
    <th>Name</th><th>Gender</th><th>District</th><th>Exam Centre</th>
    <th>Travel</th><th>Stay</th><th>Status</th><th>Actions</th>
  </tr></thead><tbody>${rows}</tbody></table>`;
}

async function loadFeedback() {
  const { getRecentFeedbacks } = await import('./supabase.js');
  const { data, error } = await getRecentFeedbacks(200);
  if (error || !data) { document.getElementById('adm-feedback-list').innerHTML = emptyState('⚠️','Could not load.'); return; }
  allFeedbacks = data;
  renderFilteredFeedback();
}

function renderFilteredFeedback() {
  const filtered = allFeedbacks;
  const el = document.getElementById('adm-feedback-list');
  el.innerHTML = filtered.length ? renderFeedbackTable(filtered) : emptyState('💬','No feedback matches filters.');
}

let reportUserMap = {}; // id → { full_name, phone }

async function loadReports() {
  const { getRecentReports, getUsersByIds } = await import('./supabase.js');
  const { data, error } = await getRecentReports(200);
  if (error || !data) { document.getElementById('adm-reports-list').innerHTML = emptyState('⚠️','Could not load.'); return; }
  allReports = data;

  // Fetch user details for both sides of each block so we can show names
  const ids = [...new Set(data.flatMap(r => [r.blocker_user_id, r.blocked_user_id].filter(Boolean)))];
  if (ids.length) {
    const { data: users } = await getUsersByIds(ids);
    reportUserMap = Object.fromEntries((users || []).map(u => [u.id, u]));
  }

  renderFilteredReports();
}

function renderFilteredReports() {
  const filtered = allReports;
  const el = document.getElementById('adm-reports-list');
  if (!filtered.length) { el.innerHTML = emptyState('🚩', 'No block reports yet.'); return; }

  const nameCell = (id) => {
    const u = reportUserMap[id];
    return u ? `${esc(u.full_name || '—')}<br><small style="color:var(--adm-text-dim)">${esc(formatPhonePretty(u.phone) || '')}</small>` : `<code style="font-size:11px">${esc((id||'').slice(0,8))}…</code>`;
  };

  el.innerHTML = `<table class="adm-table">
    <thead><tr><th>Date</th><th>Reported by</th><th>Reported user</th><th>Reason</th><th>Action</th></tr></thead>
    <tbody>${filtered.map(r => `
      <tr>
        <td>${esc(fmtDate(r.created_at))}</td>
        <td>${nameCell(r.blocker_user_id)}</td>
        <td>${nameCell(r.blocked_user_id)}</td>
        <td>${esc(r.reason || '—')}</td>
        <td>
          ${reportUserMap[r.blocked_user_id]?.is_profile_paused
            ? `<button class="adm-btn adm-btn--ok adm-btn--sm" data-action="reactivate-reported" data-id="${esc(r.blocked_user_id)}">Reactivate</button>`
            : `<button class="adm-btn adm-btn--warn adm-btn--sm" data-action="suspend-reported" data-id="${esc(r.blocked_user_id)}">Suspend user</button>`}
        </td>
      </tr>`).join('')}
    </tbody></table>`;
}

async function loadExams() {
  const el = document.getElementById('adm-exams-content');
  const exams = platformConfig.exam_config || [];
  if (!exams.length) { el.innerHTML = emptyState('🎓','No exam config.'); return; }
  el.innerHTML = `<div class="adm-exams-grid">${exams.map(e => `
    <div class="adm-exam-card" data-exam-id="${esc(e.id)}">
      <div class="adm-exam-card__header">
        <strong>${esc(e.label)}</strong>
        <span class="adm-pill adm-pill--${esc(e.status)}">${esc(e.status)}</span>
      </div>
      <div class="adm-exam-card__actions">
        ${['live','maintenance','coming_soon','disabled'].map(s =>
          `<button class="adm-btn adm-btn--${s==='live'?'ok':s==='disabled'?'danger':'ghost'} adm-btn--sm ${e.status===s?'is-current':''}"
            data-action="set-exam-status" data-exam="${esc(e.id)}" data-status="${esc(s)}"
            ${e.status===s?'disabled':''}>
            ${esc(s.replace('_',' '))}
          </button>`).join('')}
      </div>
    </div>`).join('')}
  </div>`;
}

const ALL_EXAM_TYPES = ['NEET UG', 'NEET PG', 'UPSC CMS', 'INICET', 'NEET MDS', 'NEET SS', 'FMGE'];

async function loadAnalytics() {
  const el = document.getElementById('adm-analytics-content');
  const { getAnalyticsData, getAdminStats } = await import('./supabase.js');
  const [statsRes, analyticsRes] = await Promise.all([getAdminStats(), getAnalyticsData()]);
  const s = statsRes.data || {};
  const a = analyticsRes.data || {};
  // Ensure all known exam types appear (0 when no users exist yet)
  a.byExam = { ...Object.fromEntries(ALL_EXAM_TYPES.map(t => [t, 0])), ...a.byExam };
  el.innerHTML = `
    <!-- Key metrics row -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:20px;">
      <div class="adm-card" style="text-align:center;padding:20px 16px;">
        <div style="font-size:28px;font-weight:700;color:var(--adm-primary);">${s.totalUsers ?? '—'}</div>
        <div style="font-size:12px;color:var(--adm-text-muted);margin-top:4px;">Total Registrations</div>
      </div>
      <div class="adm-card" style="text-align:center;padding:20px 16px;">
        <div style="font-size:28px;font-weight:700;color:#16a34a;">${a.matchRatePct ?? '—'}%</div>
        <div style="font-size:12px;color:var(--adm-text-muted);margin-top:4px;">Found a Centre-Mate</div>
        <div style="font-size:11px;color:var(--adm-text-dim);margin-top:2px;">${a.matchedUsers ?? 0} of ${a.totalUsers ?? 0} users</div>
      </div>
      <div class="adm-card" style="text-align:center;padding:20px 16px;">
        <div style="font-size:28px;font-weight:700;color:#0ea5e9;">${a.totalConversations ?? '—'}</div>
        <div style="font-size:12px;color:var(--adm-text-muted);margin-top:4px;">Conversations Initiated</div>
        <div style="font-size:11px;color:var(--adm-text-dim);margin-top:2px;">Total contact reveals</div>
      </div>
      <div class="adm-card" style="text-align:center;padding:20px 16px;">
        <div style="font-size:28px;font-weight:700;color:#f59e0b;">${a.acceptedConnections ?? '—'}</div>
        <div style="font-size:12px;color:var(--adm-text-muted);margin-top:4px;">Accepted Connections</div>
      </div>
    </div>
    <!-- Breakdowns -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px;">
      ${renderBreakdown('Exam Type Distribution',   a.byExam)}
      ${renderBreakdown('Gender Distribution',      a.byGender)}
      ${renderBreakdown('Top Districts', sortedTop(a.byDistrict,8))}
    </div>`;
}

function renderBreakdown(title, obj) {
  const entries = Object.entries(obj || {}).sort((a,b) => b[1]-a[1]);
  const total   = entries.reduce((s,[,v]) => s+v, 0);
  if (!entries.length) return `<div class="adm-card"><div class="adm-card__header">${esc(title)}</div><div class="adm-empty" style="padding:24px;">No data</div></div>`;
  return `<div class="adm-card">
    <div class="adm-card__header">${esc(title)}</div>
    <div class="adm-card__body" style="padding:16px 20px;">
      ${entries.map(([k,v]) => `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
          <span style="flex:1;font-size:13px;color:var(--adm-text)">${esc(k)}</span>
          <div style="flex:2;background:var(--adm-surface-2);border-radius:4px;height:6px;">
            <div style="width:${total?Math.round(v/total*100):0}%;background:var(--adm-primary);height:6px;border-radius:4px;"></div>
          </div>
          <span style="font-size:12px;color:var(--adm-text-muted);min-width:28px;text-align:right">${v}</span>
        </div>`).join('')}
    </div>
  </div>`;
}

function sortedTop(obj, n) {
  const entries = Object.entries(obj || {}).sort((a,b) => b[1]-a[1]).slice(0, n);
  return Object.fromEntries(entries);
}

async function loadPlus() {
  const el = document.getElementById('adm-plus-content');
  el.innerHTML = `
    <div style="display:grid;gap:16px;">

      <!-- Settings Card -->
      <div class="adm-card">
        <div class="adm-card__header" style="display:flex;align-items:center;justify-content:space-between;">
          <span>⭐ Zenter Plus Settings</span>
          <label class="adm-switch">
            <input type="checkbox" data-config="plus_enabled" ${platformConfig.plus_enabled !== false ? 'checked' : ''}>
            <span class="adm-switch__track"></span>
          </label>
        </div>
        <div class="adm-card__body" style="padding:16px 20px;">
          <p style="font-size:13px;color:var(--adm-text-muted);margin:0 0 12px;">
            When enabled, free users are limited to the number of active chats below. Plus members get unlimited chats and premium features.
          </p>
          <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
            <label style="font-size:13px;font-weight:600;">Free active chats:</label>
            <input type="number" id="adm-free-chat-limit" min="1" max="20"
              value="${platformConfig.free_active_chats ?? 2}"
              style="width:64px;padding:6px 8px;border:1px solid var(--adm-border);border-radius:6px;background:var(--adm-surface);color:var(--adm-text);font-size:13px;" />
            <button class="adm-btn adm-btn--ok adm-btn--sm" id="adm-save-chat-limit">Save</button>
          </div>
          <div style="margin-top:10px;padding:10px 14px;background:var(--adm-surface-2);border-radius:6px;font-size:12px;color:var(--adm-text-dim);">
            💬 <strong style="color:var(--adm-text);">Plus benefits:</strong> Unlimited chats · Verified badge · Featured profile · Priority visibility · Early supporter badge
          </div>
        </div>
      </div>

      <!-- Pricing Card -->
      <div class="adm-card">
        <div class="adm-card__header">
          <span>💳 Pricing Tiers</span>
        </div>
        <div class="adm-card__body" id="adm-pricing-list" style="padding:16px 20px;">
          <div class="adm-empty" style="padding:24px;">Loading…</div>
        </div>
      </div>

      <!-- Promo Codes Card -->
      <div class="adm-card">
        <div class="adm-card__header" style="display:flex;align-items:center;justify-content:space-between;">
          <span>🎟️ Promo Codes</span>
          <button class="adm-btn adm-btn--ok adm-btn--sm" id="adm-add-coupon">+ New Coupon</button>
        </div>
        <div class="adm-card__body" id="adm-coupons-list" style="padding:16px 20px;">
          <div class="adm-empty" style="padding:24px;">Loading…</div>
        </div>
      </div>

    </div>`;

  wireUpPlusSettings();
  await loadPricingTiers();
  await loadCoupons();
  document.getElementById('adm-add-coupon')?.addEventListener('click', () => openCouponForm(null));
}

function wireUpPlusSettings() {
  document.querySelectorAll('[data-config]').forEach(input => {
    if (input.dataset.config === 'plus_enabled') {
      input.addEventListener('change', async () => {
        const { adminUpdateConfig } = await import('./supabase.js');
        const { error } = await adminUpdateConfig('plus_enabled', input.checked, adminPhone);
        if (error) { toast('Save failed: ' + error.message, 'error'); input.checked = !input.checked; return; }
        platformConfig.plus_enabled = input.checked;
        toast(`Plus feature ${input.checked ? 'enabled' : 'disabled'} ✓`, 'success');
      });
    }
  });

  document.getElementById('adm-save-chat-limit')?.addEventListener('click', async () => {
    const val = parseInt(document.getElementById('adm-free-chat-limit')?.value, 10);
    if (!val || val < 1) { toast('Enter a valid number (min 1)', 'error'); return; }
    const { adminUpdateConfig } = await import('./supabase.js');
    const { error } = await adminUpdateConfig('free_active_chats', val, adminPhone);
    if (error) { toast('Save failed: ' + error.message, 'error'); return; }
    platformConfig.free_active_chats = val;
    toast(`Free active chats set to ${val} ✓`, 'success');
  });

  document.getElementById('adm-save-plus-price')?.addEventListener('click', async () => {
    const val = parseInt(document.getElementById('adm-plus-price')?.value, 10);
    if (!val || val < 100) { toast('Enter a valid price in paise (min 100 = ₹1)', 'error'); return; }
    const { adminUpdateConfig } = await import('./supabase.js');
    const { error } = await adminUpdateConfig('plus_price_paise', val, window._adminPhone);
    if (error) { toast('Save failed: ' + error.message, 'error'); return; }
    platformConfig.plus_price_paise = val;
    toast(`Price set to ₹${val/100} ✓`, 'success');
  });
}

async function loadSettings() {
  const el    = document.getElementById('adm-settings-content');
  const ft    = platformConfig.feature_toggles || {};
  const gm    = platformConfig.global_maintenance === true || platformConfig.global_maintenance === 'true';
  el.innerHTML = `
    <div class="adm-settings-grid">

      <div class="adm-card adm-settings-card" style="grid-column:1/-1;">
        <div class="adm-card__header" style="display:flex;align-items:center;justify-content:space-between;">
          <span>📢 Announcements</span>
          <label class="adm-switch">
            <input type="checkbox" data-config="feature_toggles.announcements" ${ft['announcements'] !== false ? 'checked' : ''}>
            <span class="adm-switch__track"></span>
          </label>
        </div>
        <div class="adm-card__body" style="padding:16px 20px;">
          <div id="adm-announcements-list"></div>
          <button class="adm-btn adm-btn--ok" id="adm-add-announcement" style="margin-top:12px;">+ New announcement</button>
        </div>
      </div>

<div class="adm-card adm-settings-card" style="grid-column:1/-1;">
        <div class="adm-card__header">📋 Recent Audit Log</div>
        <div class="adm-card__body" id="adm-audit-log"><div class="adm-empty" style="padding:24px;">Loading…</div></div>
      </div>

    </div>`;

  // Wire toggle changes
  document.querySelectorAll('[data-config]').forEach(input => {
    input.addEventListener('change', async () => {
      const cfg   = input.dataset.config;
      const isGlobal = cfg === 'global_maintenance';
      const isFt  = cfg.startsWith('feature_toggles.');
      const isDirect = ['plus_enabled'].includes(cfg); // direct top-level config keys
      const ftKey = isFt ? cfg.split('.')[1] : null;
      const { adminUpdateConfig } = await import('./supabase.js');
      let key, value;
      if (isGlobal)  { key = 'global_maintenance'; value = input.checked; }
      else if (isDirect) { key = cfg; value = input.checked; }
      else if (isFt) {
        const ft = { ...(platformConfig.feature_toggles || {}) };
        ft[ftKey] = input.checked;
        key = 'feature_toggles'; value = ft;
      }
      const { error } = await adminUpdateConfig(key, value, adminPhone);
      if (error) { toast('Save failed: ' + error.message, 'error'); input.checked = !input.checked; return; }
      platformConfig[key] = value;
      toast(`${capitalize(key)} updated ✓`, 'success');
    });
  });

  // Wire free chat limit save button
  document.getElementById('adm-save-chat-limit')?.addEventListener('click', async () => {
    const val = parseInt(document.getElementById('adm-free-chat-limit')?.value, 10);
    if (!val || val < 1) { toast('Enter a valid number (min 1)', 'error'); return; }
    const { adminUpdateConfig } = await import('./supabase.js');
    const { error } = await adminUpdateConfig('free_active_chats', val, adminPhone);
    if (error) { toast('Save failed: ' + error.message, 'error'); return; }
    platformConfig.free_active_chats = val;
    toast(`Free active chats set to ${val} ✓`, 'success');
  });

  // Wire Plus price save button
  document.getElementById('adm-save-plus-price')?.addEventListener('click', async () => {
    const val = parseInt(document.getElementById('adm-plus-price')?.value, 10);
    if (!val || val < 100) { toast('Enter a valid price in paise (min 100 = ₹1)', 'error'); return; }
    const { adminUpdateConfig } = await import('./supabase.js');
    const { error } = await adminUpdateConfig('plus_price_paise', val, adminPhone);
    if (error) { toast('Save failed: ' + error.message, 'error'); return; }
    platformConfig.plus_price_paise = val;
    toast(`Price set to ₹${val/100} ✓`, 'success');
  });

  // Load announcements list
  await refreshAnnouncementsList();

  // Load audit log
  const { getAuditLog, getRecentUsers } = await import('./supabase.js');
  const [auditRes, adminsRes] = await Promise.all([getAuditLog(30), getRecentUsers(500)]);
  const phoneToName = Object.fromEntries(
    (adminsRes.data || []).map(u => [u.phone, u.full_name || u.phone])
  );
  const auditEl = document.getElementById('adm-audit-log');
  const auditData = auditRes.data || [];
  if (!auditData.length) { auditEl.innerHTML = emptyState('📋','No audit entries yet.'); }
  else {
    auditEl.innerHTML = `<table class="adm-table">
      <thead><tr><th>Time</th><th>Admin</th><th>Action</th><th>Target</th></tr></thead>
      <tbody>${auditData.map(a => `
        <tr>
          <td>${esc(fmtDate(a.created_at))}</td>
          <td>${esc(phoneToName[a.admin_phone] || a.admin_phone?.slice(-6) || '—')}</td>
          <td>${esc(a.action)}</td>
          <td style="font-size:11px">${esc(a.target_type || '')} ${esc((a.target_id || '').slice(0,8))}</td>
        </tr>`).join('')}
      </tbody></table>`;
  }

  // New announcement button
  document.getElementById('adm-add-announcement')?.addEventListener('click', () => openAnnouncementForm(null));

  // Load coupons
  await loadCoupons();
  document.getElementById('adm-add-coupon')?.addEventListener('click', () => openCouponForm(null));
}

async function loadCoupons() {
  const el = document.getElementById('adm-coupons-list');
  if (!el) return;
  const { query: q, from: f } = await import('./supabase.js');
  const { data } = await q(f('coupons').select('*').order('created_at', { ascending: false }));
  if (!data?.length) { el.innerHTML = '<p style="color:var(--adm-text-muted);font-size:13px;margin:0;">No coupons yet. Click "+ New Coupon" to create one.</p>'; return; }

  el.innerHTML = `<table class="adm-table">
    <thead><tr>
      <th>Code</th><th>Price</th><th>Uses</th><th>Status</th><th>Actions</th>
    </tr></thead>
    <tbody>${data.map(c => `
      <tr ${!c.is_active ? 'style="opacity:0.5;"' : ''}>
        <td><code style="font-family:monospace;font-weight:700;">${esc(c.code)}</code></td>
        <td>₹${(c.discounted_paise/100).toFixed(c.discounted_paise % 100 === 0 ? 0 : 2)}</td>
        <td>${c.usage_count}${c.max_uses ? ` / ${c.max_uses}` : ''}</td>
        <td>
          ${c.is_active
            ? '<span class="adm-pill" style="background:#16a34a;color:#fff;">Active</span>'
            : '<span class="adm-pill" style="background:#94a3b8;color:#fff;">Inactive</span>'}
        </td>
        <td>
          <button class="adm-btn adm-btn--sm ${c.is_active ? 'adm-btn--warn' : 'adm-btn--ok'}"
                  data-coupon-toggle="${esc(c.code)}" data-active="${c.is_active}">
            ${c.is_active ? 'Disable' : 'Enable'}
          </button>
          <button class="adm-btn adm-btn--sm adm-btn--danger" data-coupon-delete="${esc(c.code)}">Delete</button>
        </td>
      </tr>`).join('')}
    </tbody></table>`;

  // Wire toggle
  el.querySelectorAll('[data-coupon-toggle]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const code = btn.dataset.couponToggle;
      const isActive = btn.dataset.active === 'true';
      btn.disabled = true;
      const { supabase: sb } = await import('./supabase.js');
      const { error } = await sb.rpc('admin_toggle_coupon', { p_code: code, p_active: !isActive });
      if (error) { toast('Error: ' + error.message, 'error'); btn.disabled = false; return; }
      toast(`Coupon ${!isActive ? 'enabled' : 'disabled'} ✓`, 'success');
      await loadCoupons();
    });
  });

  // Wire delete
  el.querySelectorAll('[data-coupon-delete]').forEach(btn => {
    btn.addEventListener('click', () => {
      const code = btn.dataset.couponDelete;
      confirm_({
        title: `Delete coupon ${code}?`,
        msg: 'This action cannot be undone.',
        danger: true,
      }, async () => {
        const { supabase: sb } = await import('./supabase.js');
        const { error } = await sb.rpc('admin_delete_coupon', { p_code: code });
        if (error) { toast('Error: ' + error.message, 'error'); return; }
        toast('Coupon deleted ✓', 'success');
        await loadCoupons();
      });
    });
  });
}

async function loadPricingTiers() {
  const el = document.getElementById('adm-pricing-list');
  if (!el) return;

  // Get current pricing from platform config
  const basePrice = platformConfig.plus_price_paise ?? 4900;
  const priceRupees = Math.round(basePrice / 100);

  el.innerHTML = `<table class="adm-table">
    <thead><tr>
      <th>Tier Name</th><th>Price</th><th>Description</th><th>Actions</th>
    </tr></thead>
    <tbody>
      <tr>
        <td><strong>Standard</strong></td>
        <td><strong>₹${priceRupees}</strong></td>
        <td>Base price for Zenter Plus</td>
        <td>
          <button class="adm-btn adm-btn--sm adm-btn--primary" id="adm-edit-price">Edit</button>
        </td>
      </tr>
      <tr style="opacity:0.7;">
        <td>With Coupon</td>
        <td>Varies</td>
        <td>Apply promo codes for discounts</td>
        <td><span style="font-size:12px;color:var(--adm-text-muted);">See Promo Codes</span></td>
      </tr>
    </tbody></table>`;

  document.getElementById('adm-edit-price')?.addEventListener('click', () => openPricingForm());
}

function openPricingForm() {
  const basePrice = platformConfig.plus_price_paise ?? 4900;
  const priceRupees = Math.round(basePrice / 100);

  const overlay = document.createElement('div');
  overlay.className = 'adm-overlay';
  overlay.innerHTML = `
    <div class="adm-dialog" style="max-width:400px;">
      <h4>Edit Zenter Plus Pricing</h4>
      <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:16px;">
        <div>
          <label style="font-size:12px;font-weight:600;color:var(--adm-text-muted);display:block;margin-bottom:4px;">Price in Rupees (₹)</label>
          <input type="number" id="pricing-rupees" class="adm-search" placeholder="49" min="1" step="1"
                 style="width:100%;padding:10px;font-size:14px;"
                 value="${priceRupees}" />
        </div>
        <div style="padding:12px;background:var(--adm-surface-2);border-radius:6px;font-size:12px;color:var(--adm-text-muted);">
          💡 This is the base price shown on the Plus page. Promo codes will offer discounts on this price.
        </div>
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end;">
        <button class="adm-btn adm-btn--ghost" id="pricing-cancel">Cancel</button>
        <button class="adm-btn adm-btn--ok" id="pricing-save">Save</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);

  overlay.querySelector('#pricing-cancel').addEventListener('click', () => overlay.remove());

  overlay.querySelector('#pricing-save').addEventListener('click', async () => {
    const priceRupees = parseInt(overlay.querySelector('#pricing-rupees').value, 10);
    if (!priceRupees || priceRupees < 1) { toast('Enter a valid price (min 1)', 'error'); return; }

    const pricePaise = priceRupees * 100;
    const { adminUpdateConfig } = await import('./supabase.js');
    const { error } = await adminUpdateConfig('plus_price_paise', pricePaise, adminPhone);
    if (error) { toast('Save failed: ' + error.message, 'error'); return; }

    platformConfig.plus_price_paise = pricePaise;
    toast(`Price updated to ₹${priceRupees} ✓`, 'success');
    overlay.remove();
    await loadPricingTiers();
  });
}

function openCouponForm(existing) {
  const overlay = document.createElement('div');
  overlay.className = 'adm-overlay';
  overlay.innerHTML = `
    <div class="adm-dialog" style="max-width:480px;">
      <h4>${existing ? 'Edit' : 'New'} Coupon</h4>
      <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:16px;">
        <div>
          <label style="font-size:12px;font-weight:600;color:var(--adm-text-muted);display:block;margin-bottom:4px;">Coupon Code</label>
          <input type="text" id="cp-code" class="adm-search" placeholder="e.g. SUMMER50"
                 style="width:100%;padding:10px;text-transform:uppercase;letter-spacing:1px;font-family:monospace;font-weight:700;"
                 value="${existing ? esc(existing.code) : ''}" ${existing ? 'disabled' : ''} maxlength="20" />
        </div>
        <div>
          <label style="font-size:12px;font-weight:600;color:var(--adm-text-muted);display:block;margin-bottom:4px;">Discounted Price (₹)</label>
          <input type="number" id="cp-price" class="adm-search" placeholder="9" min="0" step="1"
                 style="width:100%;padding:10px;" value="${existing ? (existing.discounted_paise/100) : ''}" />
          <p style="font-size:11px;color:var(--adm-text-dim);margin:4px 0 0;">User pays this amount when coupon is applied.</p>
        </div>
        <div>
          <label style="font-size:12px;font-weight:600;color:var(--adm-text-muted);display:block;margin-bottom:4px;">Max Uses (optional)</label>
          <input type="number" id="cp-max-uses" class="adm-search" placeholder="Unlimited" min="1" step="1"
                 style="width:100%;padding:10px;" value="${existing?.max_uses || ''}" />
        </div>
        <div>
          <label style="font-size:12px;font-weight:600;color:var(--adm-text-muted);display:block;margin-bottom:4px;">Expires At (optional)</label>
          <input type="date" id="cp-expires" class="adm-search"
                 style="width:100%;padding:10px;" value="${existing?.expires_at ? new Date(existing.expires_at).toISOString().slice(0,10) : ''}" />
        </div>
      </div>
      <div class="adm-dialog__actions">
        <button type="button" class="adm-btn adm-btn--ghost" id="cp-cancel">Cancel</button>
        <button type="button" class="adm-btn adm-btn--ok" id="cp-save">Save</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.hidden = false;

  const close = () => overlay.remove();
  document.getElementById('cp-cancel').onclick = close;
  document.getElementById('cp-save').onclick = async () => {
    const code = (document.getElementById('cp-code').value || '').trim().toUpperCase();
    const price = parseInt(document.getElementById('cp-price').value, 10);
    const maxUses = parseInt(document.getElementById('cp-max-uses').value, 10) || null;
    const expires = document.getElementById('cp-expires').value || null;

    if (!code) { toast('Coupon code required', 'error'); return; }
    if (isNaN(price) || price < 0) { toast('Valid price required', 'error'); return; }

    const { supabase: sb } = await import('./supabase.js');
    const { error } = await sb.rpc('admin_upsert_coupon', {
      p_code: code,
      p_discounted_paise: price * 100,
      p_max_uses: maxUses,
      p_expires_at: expires ? new Date(expires).toISOString() : null,
    });

    if (error) {
      toast('Error: ' + error.message, 'error');
      return;
    }
    toast(`Coupon ${existing ? 'updated' : 'created'} ✓`, 'success');
    close();
    await loadCoupons();
  };
}

async function refreshAnnouncementsList() {
  const { getAllAnnouncements } = await import('./supabase.js');
  const { data } = await getAllAnnouncements();
  const el = document.getElementById('adm-announcements-list');
  if (!data?.length) { el.innerHTML = '<p style="color:var(--adm-text-muted);font-size:13px;">No announcements yet.</p>'; return; }
  el.innerHTML = data.map(a => `
    <div class="adm-ann-row" data-ann-id="${esc(a.id)}">
      <div class="adm-ann-row__text">
        <span class="adm-pill adm-pill--${a.is_active ? 'active' : 'suspended'}" style="margin-right:8px;">${a.is_active ? 'Active' : 'Off'}</span>
        ${esc(a.message)}
        ${a.exam_target ? `<span class="adm-pill adm-pill--info" style="margin-left:6px;">${esc(a.exam_target)}</span>` : ''}
        ${a.expires_at ? `<span style="font-size:11px;color:var(--adm-text-dim);margin-left:6px;">expires ${esc(fmtDate(a.expires_at))}</span>` : ''}
      </div>
      <div class="adm-actions">
        <button class="adm-btn adm-btn--ghost adm-btn--sm" data-action="edit-announcement" data-id="${esc(a.id)}">Edit</button>
        <button class="adm-btn adm-btn--danger adm-btn--sm" data-action="delete-announcement" data-id="${esc(a.id)}">Delete</button>
      </div>
    </div>`).join('');
}

// ─── Announcement form ────────────────────────────────────────────────────────

function openAnnouncementForm(existing) {
  const overlay = document.getElementById('adm-ann-overlay');
  if (!overlay) return;
  document.getElementById('adm-ann-id').value      = existing?.id      || '';
  document.getElementById('adm-ann-message').value  = existing?.message || '';
  document.getElementById('adm-ann-active').checked = existing ? existing.is_active : true;
  document.getElementById('adm-ann-priority').value = existing?.priority || 0;
  document.getElementById('adm-ann-target').value   = existing?.exam_target || '';
  document.getElementById('adm-ann-expires').value  = existing?.expires_at ? existing.expires_at.slice(0,10) : '';
  overlay.hidden = false;
}

// ─── Stat-box navigation ─────────────────────────────────────────────────────
document.addEventListener('click', (e) => {
  const stat = e.target.closest('[data-nav]');
  if (!stat) return;
  navigateTo(stat.dataset.nav);
});

// ─── Delegated action handlers ────────────────────────────────────────────────

document.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn || btn.disabled) return;
  const action = btn.dataset.action;
  const id     = btn.dataset.id;

  // ── Feedback actions ──────────────────────────────────────────────────────
  if (action === 'resolve-fb') {
    confirm_({ title:'Mark resolved?', msg:'Marks this feedback as handled.' }, async () => {
      btn.disabled = true;
      const { adminResolveFeedback } = await import('./supabase.js');
      const { error } = await adminResolveFeedback(id, adminPhone);
      if (error) { toast('Error: ' + error.message, 'error'); btn.disabled = false; return; }
      const fb = allFeedbacks.find(f => f.id === id);
      if (fb) { fb.is_resolved = true; fb.resolved_at = new Date().toISOString(); }
      renderFilteredFeedback();
      toast('Marked resolved ✓', 'success');
    }); return;
  }
  if (action === 'delete-fb') {
    confirm_({ title:'Delete feedback?', msg:'This permanently removes the entry.', danger:true }, async () => {
      btn.disabled = true;
      const { adminDeleteFeedback } = await import('./supabase.js');
      const { error } = await adminDeleteFeedback(id, adminPhone);
      if (error) { toast('Error: ' + error.message, 'error'); btn.disabled = false; return; }
      allFeedbacks = allFeedbacks.filter(f => f.id !== id);
      renderFilteredFeedback();
      toast('Feedback deleted', 'info');
    }); return;
  }

  // ── Report actions ────────────────────────────────────────────────────────
  const reportStatus = { 'review-report':'reviewing','resolve-report':'resolved','dismiss-report':'dismissed' }[action];
  if (reportStatus) {
    btn.disabled = true;
    const { adminUpdateReport } = await import('./supabase.js');
    const { error } = await adminUpdateReport(id, reportStatus, null, adminPhone);
    if (error) { toast('Error: ' + error.message, 'error'); btn.disabled = false; return; }
    const r = allReports.find(r => r.id === id);
    if (r) r.status = reportStatus;
    renderFilteredReports();
    toast(`Report ${reportStatus} ✓`, 'success');
    return;
  }

  // ── User actions ──────────────────────────────────────────────────────────
  // Suspend (from Users panel) — Reactivate is Reports panel only
  if (action === 'suspend') {
    confirm_({ title:'Suspend this user?', msg:'Their profile will be hidden from Find Mates.', danger:true }, async () => {
      btn.disabled = true;
      const { adminSetUserPaused } = await import('./supabase.js');
      const { error } = await adminSetUserPaused(id, adminPhone, true);
      if (error) { toast('Error: ' + error.message, 'error'); btn.disabled = false; return; }
      const u = allUsers.find(u => u.id === id);
      if (u) u.is_profile_paused = true;
      renderFilteredUsers();
      toast('User suspended ✓', 'success');
    }); return;
  }

  // Suspend / Unsuspend from Users panel (sets account_status — user sees suspension message)
  if (action === 'suspend-user' || action === 'unsuspend-user') {
    const suspending = action === 'suspend-user';
    confirm_(suspending
      ? { title: 'Suspend this user?', msg: 'They will be locked out and shown a suspension message.', danger: true }
      : { title: 'Unsuspend this user?', msg: 'Restores their full access to the app.', danger: false },
    async () => {
      btn.disabled = true;
      const { adminSetUserStatus } = await import('./supabase.js');
      const { error } = await adminSetUserStatus(id, adminPhone, suspending ? 'suspended' : 'active');
      if (error) { toast('Error: ' + error.message, 'error'); btn.disabled = false; return; }
      const u = allUsers.find(u => u.id === id);
      if (u) {
        u.account_status = suspending ? 'suspended' : 'active';
        if (!suspending) u.appeal_submitted_at = null;
      }
      renderFilteredUsers();
      toast(suspending ? 'User suspended ✓' : 'User unsuspended ✓', 'success');
    }); return;
  }

  // Suspend reported user directly from Reports page
  if (action === 'suspend-reported' || action === 'reactivate-reported') {
    const pausing = action === 'suspend-reported';
    confirm_(pausing
      ? { title:'Suspend this user?',    msg:'Their profile will be hidden from Find Mates.', danger:true  }
      : { title:'Reactivate this user?', msg:'Restores their profile visibility.', danger:false },
    async () => {
      btn.disabled = true;
      const { adminSetUserPaused } = await import('./supabase.js');
      const { error } = await adminSetUserPaused(id, adminPhone, pausing);
      if (error) { toast('Error: ' + error.message, 'error'); btn.disabled = false; return; }
      // Update local cache so button flips immediately
      if (reportUserMap[id]) reportUserMap[id].is_profile_paused = pausing;
      renderFilteredReports();
      toast(pausing ? 'User suspended ✓' : 'User reactivated ✓', 'success');
    }); return;
  }

  if (action === 'set-role') {
    const newRole = btn.dataset.role;
    confirm_({ title:`Set role to ${newRole}?`, msg:'Changes this user\'s admin level.', danger: newRole !== 'user' }, async () => {
      btn.disabled = true;
      const { adminSetUserRole } = await import('./supabase.js');
      const { error } = await adminSetUserRole(id, newRole, adminPhone);
      if (error) { toast('Error: ' + error.message, 'error'); btn.disabled = false; return; }
      const u = allUsers.find(u => u.id === id);
      if (u) u.role = newRole;
      renderFilteredUsers();
      toast(`Role updated to ${newRole} ✓`, 'success');
    }); return;
  }

  // ── Grant / Revoke Plus membership ───────────────────────────────────────
  if (action === 'grant-plus' || action === 'revoke-plus') {
    const granting = action === 'grant-plus';
    const userName = btn.dataset.name || 'this user';
    confirm_({
      title: granting ? `Grant Plus to ${esc(userName)}?` : `Revoke Plus from ${esc(userName)}?`,
      msg:   granting ? 'Gives unlimited contact reveals and Plus badge.' : 'Removes Plus benefits. Existing revealed contacts remain visible.',
      danger: !granting,
    }, async () => {
      btn.disabled = true;
      const { adminSetPlusMember } = await import('./supabase.js');
      const { error } = await adminSetPlusMember(id, granting);
      if (error) { toast('Error: ' + error.message, 'error'); btn.disabled = false; return; }
      const u = allUsers.find(u => u.id === id);
      if (u) u.plus_member = granting;
      renderFilteredUsers();
      toast(granting ? `⭐ Plus granted to ${esc(userName)} ✓` : `Plus revoked from ${esc(userName)} ✓`, 'success');
    }); return;
  }

  // ── Roll No Requests panel: approve / reject ─────────────────────────────
  if (action === 'rollno-approve' || action === 'rollno-reject') {
    const approving = action === 'rollno-approve';
    const userName = btn.dataset.name || 'this user';
    confirm_({
      title:  approving ? `Approve Roll No for ${esc(userName)}?` : `Reject Roll No request for ${esc(userName)}?`,
      msg:    approving ? 'Grants the green Verified badge and unlocks contact reveals.' : 'Marks the request as rejected. User can resubmit with a corrected Roll Number.',
      danger: !approving,
    }, async () => {
      btn.disabled = true;
      const { adminSetVerifiedAspirant } = await import('./supabase.js');
      const { error } = await adminSetVerifiedAspirant(id, approving);
      if (error) { toast('Error: ' + error.message, 'error'); btn.disabled = false; return; }
      // Drop the row from the pending queue (either outcome removes it from this list)
      allRollNoRequests = allRollNoRequests.filter(u => u.id !== id);
      updateRollNoNavBadge();
      renderRollNoRequests();
      // Keep the Users panel in sync if it's already loaded
      const u = allUsers.find(u => u.id === id);
      if (u) {
        if (approving) { u.is_verified_aspirant = true; u.verification_requested = false; u.verification_rejected = false; }
        else           { u.is_verified_aspirant = false; u.verification_requested = false; u.verification_rejected = true; }
        if (loaded.has('users')) renderFilteredUsers();
      }
      toast(approving ? `✓ Roll No verified for ${esc(userName)}` : `Request rejected ✓`, 'success');
    }); return;
  }

  // ── Reject Aspirant verification request (Users panel button) ────────────
  if (action === 'reject-aspirant') {
    const userName = btn.dataset.name || 'this user';
    confirm_({
      title: `Reject verification for ${esc(userName)}?`,
      msg:   'Marks the request as rejected. User can resubmit with corrected details.',
      danger: true,
    }, async () => {
      btn.disabled = true;
      const { adminSetVerifiedAspirant } = await import('./supabase.js');
      const { error } = await adminSetVerifiedAspirant(id, false);
      if (error) { toast('Error: ' + error.message, 'error'); btn.disabled = false; return; }
      const u = allUsers.find(u => u.id === id);
      if (u) { u.is_verified_aspirant = false; u.verification_requested = false; u.verification_rejected = true; }
      renderFilteredUsers();
      toast(`Request rejected ✓`, 'success');
    }); return;
  }

  // ── Verify / Unverify Aspirant (Roll No) ─────────────────────────────────
  if (action === 'verify-aspirant' || action === 'unverify-aspirant') {
    const verifying = action === 'verify-aspirant';
    const userName  = btn.dataset.name || 'this user';
    confirm_({
      title: verifying ? `Verify Roll No for ${esc(userName)}?` : `Remove verification for ${esc(userName)}?`,
      msg:   verifying ? 'Grants full green Verified badge — confirm Roll Number has been checked.' : 'Downgrades to phone-only verification.',
      danger: !verifying,
    }, async () => {
      btn.disabled = true;
      const { adminSetVerifiedAspirant } = await import('./supabase.js');
      const { error } = await adminSetVerifiedAspirant(id, verifying);
      if (error) { toast('Error: ' + error.message, 'error'); btn.disabled = false; return; }
      const u = allUsers.find(u => u.id === id);
      if (u) u.is_verified_aspirant = verifying;
      renderFilteredUsers();
      toast(verifying ? `✓ Roll No verified for ${esc(userName)} ✓` : `Verification removed ✓`, 'success');
    }); return;
  }

  // ── Delete user ───────────────────────────────────────────────────────────
  // ── Seeded user actions ───────────────────────────────────────────────────
  if (action === 'delete-all-seeded') {
    const count = allSeeded.length;
    confirm_({
      title: `Delete all ${count} seeded users?`,
      msg: 'This permanently removes all demo accounts from the seeded_users table. Real users are unaffected. Cannot be undone.',
      danger: true,
    }, async () => {
      btn.disabled = true;
      const { deleteAllSeededUsers } = await import('./supabase.js');
      const { error } = await deleteAllSeededUsers();
      if (error) { toast('Error: ' + error.message, 'error'); btn.disabled = false; return; }
      allSeeded = [];
      renderFilteredSeeded();
      toast(`${count} seeded users deleted ✓`, 'info');
    }); return;
  }

  if (action === 'delete-seeded') {
    const name = btn.dataset.name || 'this seeded user';
    confirm_({ title: `Delete ${esc(name)}?`, msg: 'Removes this demo account permanently.', danger: true }, async () => {
      btn.disabled = true;
      const { deleteSeededUser } = await import('./supabase.js');
      const { error } = await deleteSeededUser(id);
      if (error) { toast('Error: ' + error.message, 'error'); btn.disabled = false; return; }
      allSeeded = allSeeded.filter(u => u.id !== id);
      renderFilteredSeeded();
      toast(`${esc(name)} deleted ✓`, 'info');
    }); return;
  }

  if (action === 'hide-seeded' || action === 'show-seeded') {
    const pausing = action === 'hide-seeded';
    btn.disabled = true;
    const { toggleSeededUserPause } = await import('./supabase.js');
    const { error } = await toggleSeededUserPause(id, pausing);
    if (error) { toast('Error: ' + error.message, 'error'); btn.disabled = false; return; }
    const u = allSeeded.find(u => u.id === id);
    if (u) u.is_profile_paused = pausing;
    renderFilteredSeeded();
    toast(pausing ? 'Seeded user hidden ✓' : 'Seeded user visible ✓', 'success');
    return;
  }

  if (action === 'clear-suspicious') {
    const { adminClearSuspiciousFlags } = await import('./supabase.js');
    const { error } = await adminClearSuspiciousFlags(id, adminPhone);
    if (error) { toast('Error: ' + error.message, 'error'); return; }
    const u = allUsers.find(u => u.id === id);
    if (u) u.suspicious_flags = {};
    renderFilteredUsers();
    toast('Suspicious flags cleared ✓', 'success');
    return;
  }

  if (action === 'delete-user') {
    const userName = btn.dataset.name || 'this user';
    confirm_({
      title: `Delete ${esc(userName)}?`,
      msg: 'This permanently removes all their data — profile, connections, and blocks. This cannot be undone.',
      danger: true,
    }, async () => {
      btn.disabled = true;
      const { deleteUserData } = await import('./supabase.js');
      const { error } = await deleteUserData(id);
      if (error) { toast('Error: ' + error.message, 'error'); btn.disabled = false; return; }
      allUsers = allUsers.filter(u => u.id !== id);
      renderFilteredUsers();
      toast(`${esc(userName)} deleted ✓`, 'info');
    }); return;
  }

  // ── Exam status ───────────────────────────────────────────────────────────
  if (action === 'set-exam-status') {
    const examId = btn.dataset.exam;
    const status = btn.dataset.status;
    confirm_({ title:`Set ${examId} to "${status}"?`, msg:'This changes how this exam is shown to users.', danger: status==='disabled' }, async () => {
      btn.disabled = true;
      const { adminUpdateConfig } = await import('./supabase.js');
      const newConfig = (platformConfig.exam_config || []).map(e =>
        e.id === examId ? { ...e, status } : e
      );
      const { error } = await adminUpdateConfig('exam_config', newConfig, adminPhone);
      if (error) { toast('Error: ' + error.message, 'error'); btn.disabled = false; return; }
      platformConfig.exam_config = newConfig;
      loaded.delete('exams');
      loadExams();
      toast(`${examId} → ${status} ✓`, 'success');
    }); return;
  }

  // ── Announcement CRUD ─────────────────────────────────────────────────────
  if (action === 'edit-announcement') {
    const { getAllAnnouncements } = await import('./supabase.js');
    const { data } = await getAllAnnouncements();
    const ann = data?.find(a => a.id === id);
    if (ann) openAnnouncementForm(ann);
    return;
  }
  if (action === 'delete-announcement') {
    confirm_({ title:'Delete announcement?', msg:'This removes it immediately.', danger:true }, async () => {
      btn.disabled = true;
      const { adminDeleteAnnouncement } = await import('./supabase.js');
      const { error } = await adminDeleteAnnouncement(id, adminPhone);
      if (error) { toast('Error: ' + error.message, 'error'); btn.disabled = false; return; }
      await refreshAnnouncementsList();
      toast('Announcement deleted', 'info');
    }); return;
  }

  // ── Announcement form save ────────────────────────────────────────────────
  if (action === 'save-announcement') {
    const msg = document.getElementById('adm-ann-message')?.value.trim();
    if (!msg) { toast('Message is required.', 'error'); return; }
    btn.disabled = true; btn.textContent = 'Saving…';
    const { adminUpsertAnnouncement } = await import('./supabase.js');
    const { error } = await adminUpsertAnnouncement({
      id:         document.getElementById('adm-ann-id')?.value || null,
      message:    msg,
      is_active:  document.getElementById('adm-ann-active')?.checked ?? true,
      priority:   parseInt(document.getElementById('adm-ann-priority')?.value) || 0,
      exam_target:document.getElementById('adm-ann-target')?.value || null,
      expires_at: document.getElementById('adm-ann-expires')?.value || null,
    }, adminPhone);
    btn.disabled = false; btn.textContent = 'Save';
    if (error) { toast('Error: ' + error.message, 'error'); return; }
    document.getElementById('adm-ann-overlay').hidden = true;
    await refreshAnnouncementsList();
    toast('Announcement saved ✓', 'success');
    return;
  }
  if (action === 'cancel-announcement') {
    document.getElementById('adm-ann-overlay').hidden = true; return;
  }
});

// ─── Render helpers ───────────────────────────────────────────────────────────

function renderUsersTable(users, withActions = false) {
  // Build device fingerprint → [user] map for multi-account detection
  const fpMap = {};
  users.forEach(u => { if (u.device_fingerprint) { (fpMap[u.device_fingerprint] = fpMap[u.device_fingerprint] || []).push(u); } });

  const rows = users.map(u => {
    const status  = u.account_status || 'active';
    const display = u.is_profile_paused ? 'paused' : status;
    const isAdmin = u.role === 'admin';
    const isSuperAdmin = u.role === 'superadmin';
    const isPrivileged = isAdmin || isSuperAdmin;

    const examCentreState    = u.exam_centre_state    || '—';
    const examCentreDistrict = u.exam_centre_district || '—';
    const examCentreName     = u.exam_center          || '—';

    // Suspicious flags
    const flags     = u.suspicious_flags || {};
    const rapidFlag = flags.rapid_reveal;
    const multiAcct = u.device_fingerprint && (fpMap[u.device_fingerprint]?.length || 0) > 1;
    const suspCell  = `<td style="font-size:11px;">
      ${rapidFlag
        ? `<span class="adm-pill" style="background:#fef3c7;color:#92400e;border:1px solid #fde68a;" title="Revealed 2 contacts under 60s">⚡ Rapid reveal</span>`
        : ''}
      ${multiAcct
        ? `<span class="adm-pill" style="background:#fee2e2;color:#b91c1c;border:1px solid #fca5a5;margin-top:3px;display:block;" title="${(fpMap[u.device_fingerprint]?.length||0)} accounts same device">📱 Multi-account</span>`
        : ''}
      ${!rapidFlag && !multiAcct ? '<span style="color:var(--adm-text-dim);">—</span>' : ''}
      ${(rapidFlag || multiAcct) && withActions
        ? `<button class="adm-btn adm-btn--sm" style="margin-top:4px;font-size:10px;" data-action="clear-suspicious" data-id="${esc(u.id)}">Clear</button>`
        : ''}
    </td>`;

    const actions = withActions ? `<td>
      <div class="adm-actions" style="gap:4px;flex-wrap:wrap;">
        ${isSuperAdmin
          ? '<span class="adm-pill adm-pill--admin" style="font-size:10px;">⚡ superadmin</span>'
          : `<button class="adm-btn adm-btn--sm ${isAdmin ? 'adm-btn--danger' : 'adm-btn--ok'}"
              data-action="set-role" data-id="${esc(u.id)}" data-role="${isAdmin ? 'user' : 'admin'}">
              ${isAdmin ? 'Revoke admin' : 'Make admin'}
            </button>`}
        <button class="adm-btn adm-btn--sm ${u.plus_member ? 'adm-btn--warn' : 'adm-btn--ok'}"
          data-action="${u.plus_member ? 'revoke-plus' : 'grant-plus'}" data-id="${esc(u.id)}" data-name="${esc(u.full_name||'User')}">
          ${u.plus_member ? 'Revoke Plus' : 'Grant Plus'}
        </button>
        <button class="adm-btn adm-btn--sm ${u.is_verified_aspirant ? 'adm-btn--warn' : 'adm-btn--ok'}"
          data-action="${u.is_verified_aspirant ? 'unverify-aspirant' : 'verify-aspirant'}" data-id="${esc(u.id)}" data-name="${esc(u.full_name||'User')}">
          ${u.is_verified_aspirant ? 'Unverify' : 'Verify Roll No'}
        </button>
        ${u.verification_requested && !u.is_verified_aspirant
          ? `<button class="adm-btn adm-btn--sm adm-btn--danger"
               data-action="reject-aspirant" data-id="${esc(u.id)}" data-name="${esc(u.full_name||'User')}">
               Reject
             </button>`
          : ''}
        ${!isPrivileged
          ? `<button class="adm-btn adm-btn--sm ${u.account_status === 'suspended' ? 'adm-btn--ok' : 'adm-btn--warn'}"
               data-action="${u.account_status === 'suspended' ? 'unsuspend-user' : 'suspend-user'}" data-id="${esc(u.id)}" data-name="${esc(u.full_name||'User')}">
               ${u.account_status === 'suspended' ? 'Unsuspend' : 'Suspend'}
             </button>
             <button class="adm-btn adm-btn--sm adm-btn--danger"
               data-action="delete-user" data-id="${esc(u.id)}" data-name="${esc(u.full_name||'User')}">
               Delete
             </button>`
          : `<span class="adm-pill" style="font-size:10px;opacity:.5;" title="Revoke admin first">Protected</span>`}
      </div>
    </td>` : '';

    return `<tr>
      <td>${esc(u.full_name||'—')}</td>
      <td style="font-size:11px">${esc(formatPhonePretty(u.phone)||u.phone||'—')}</td>
      <td>${esc(u.gender||'—')}</td>
      <td>${esc(u.exam_type||'—')}</td>
      <td style="font-size:11px">${esc([u.district,u.state].filter(Boolean).join(', ')||'—')}</td>
      <td style="font-size:11px">
        <div>${esc(examCentreState)}</div>
        <div style="color:var(--adm-text-dim)">${esc(examCentreDistrict)}</div>
        <div style="color:var(--adm-text-dim);font-size:10px;">${esc(examCentreName)}</div>
      </td>
      <td><span class="adm-pill adm-pill--${esc(u.role||'user')}">${esc(u.role||'user')}</span></td>
      <td>
        ${u.plus_member
          ? '<span class="adm-pill" style="background:#fef9c3;color:#854d0e;border:1px solid #fef08a;">⭐ Plus</span>'
          : '<span style="font-size:11px;color:var(--adm-text-dim);">Free</span>'}
      </td>
      <td style="font-size:12px;">
        ${u.is_verified_aspirant
          ? `<span class="adm-pill" style="background:#16a34a;color:#fff;">✓ Verified</span>
             ${u.nta_application_number
               ? `<div style="font-size:10px;color:var(--adm-text-dim);margin-top:2px;font-family:monospace;">${esc(u.nta_application_number)}</div>`
               : ''}`
          : u.verification_requested
            ? `<span class="adm-pill" style="background:#fef3c7;color:#92400e;border:1px solid #fde68a;">⏳ Pending</span>
               <div style="font-size:10px;color:var(--adm-text-dim);margin-top:2px;font-family:monospace;">${esc(u.nta_application_number||'')}</div>`
            : u.verification_rejected
              ? `<span class="adm-pill" style="background:#fee2e2;color:#b91c1c;border:1px solid #fca5a5;">✗ Rejected</span>
                 ${u.nta_application_number ? `<div style="font-size:10px;color:var(--adm-text-dim);margin-top:2px;font-family:monospace;">${esc(u.nta_application_number)}</div>` : ''}`
              : '<span style="color:var(--adm-text-dim);">Phone only</span>'}
      </td>
      <td>
        <span class="adm-pill adm-pill--${esc(display)}">${esc(display)}</span>
      </td>
      ${suspCell}
      <td style="font-size:11px">${esc(fmtDate(u.created_at))}</td>
      ${actions}
    </tr>`;
  }).join('');
  const ah = withActions ? '<th>Actions</th>' : '';
  return `<table class="adm-table"><thead><tr>
    <th>Name</th><th>Phone</th><th>Gender</th><th>Exam</th>
    <th>Home Location</th><th>Exam Centre</th>
    <th>Role</th><th>Plus</th><th>Verified</th><th>Status</th><th>⚠️ Flags</th><th>Joined</th>${ah}
  </tr></thead><tbody>${rows}</tbody></table>`;
}

function renderFeedbackTable(items) {
  return `<table class="adm-table">
    <thead><tr><th>Date</th><th>User</th><th>Exam</th><th>Message</th><th>Status</th><th>Actions</th></tr></thead>
    <tbody>${items.map(f => `
      <tr class="${f.is_resolved?'is-resolved':''}" data-fb-id="${esc(f.id)}">
        <td>${esc(fmtDate(f.created_at))}</td>
        <td>${esc(f.user_name||'—')}</td>
        <td>${esc(f.exam_type||'—')}</td>
        <td>${esc(f.feedback_message||'')}</td>
        <td><span class="adm-pill adm-pill--${f.is_resolved?'resolved':'pending'}">${f.is_resolved?'Resolved':'Pending'}</span></td>
        <td><div class="adm-actions">
          ${!f.is_resolved?`<button class="adm-btn adm-btn--ok adm-btn--sm" data-action="resolve-fb" data-id="${esc(f.id)}">Resolve</button>`:''}
          <button class="adm-btn adm-btn--danger adm-btn--sm" data-action="delete-fb" data-id="${esc(f.id)}">Delete</button>
        </div></td>
      </tr>`).join('')}
    </tbody></table>`;
}

// set-role is now wired directly via data-action="set-role" on the button — no extra event needed.

// ─── Confirm dialog ───────────────────────────────────────────────────────────

let _confirmResolver = null;
function wireConfirmDialog() {
  document.getElementById('adm-confirm-cancel')?.addEventListener('click', () => {
    document.getElementById('adm-confirm-overlay').hidden = true; _confirmResolver?.(false);
  });
  document.getElementById('adm-confirm-ok')?.addEventListener('click', () => {
    document.getElementById('adm-confirm-overlay').hidden = true; _confirmResolver?.(true);
  });
}
function confirm_({ title, msg, danger = false }, onConfirm) {
  document.getElementById('adm-confirm-title').textContent = title;
  document.getElementById('adm-confirm-msg').textContent   = msg;
  const ok = document.getElementById('adm-confirm-ok');
  ok.className = `adm-btn ${danger ? 'adm-btn--danger' : 'adm-btn--ok'}`;
  ok.textContent = 'Confirm';
  document.getElementById('adm-confirm-overlay').hidden = false;
  _confirmResolver = (c) => { if (c) onConfirm(); };
}

// ─── Toast ────────────────────────────────────────────────────────────────────

let toastTimer;
function wireToast() {}
function toast(msg, type = 'info') {
  const el = document.getElementById('adm-toast');
  if (!el) return;
  el.textContent = msg;
  el.className   = `adm-toast adm-toast--${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('is-hidden'), 3000);
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function emptyState(icon, text) {
  return `<div class="adm-empty"><div class="adm-empty__icon">${icon}</div>${esc(text)}</div>`;
}
function setStat(id, v) { const el=document.getElementById(id); if(el) el.textContent=String(v??'—'); }
function capitalize(s)   { return s ? s[0].toUpperCase()+s.slice(1) : ''; }
function fmtDate(iso)    { if(!iso)return'—'; return new Date(iso).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}); }
function esc(str)        { return String(str??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function debounce(fn,ms) { let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),ms); }; }
