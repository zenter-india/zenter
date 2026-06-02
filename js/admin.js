// Zenter Admin Platform — Phase 3: Final Operational Completion.
// All 7 sections fully implemented. All mutations via SECURITY DEFINER functions.

import { requireAdmin, logout } from './auth.js';
import { formatPhonePretty }    from './utils.js';

const ROUTES = ['dashboard','users','feedback','reports','exams','analytics','settings'];
const loaded     = new Set();
let allUsers     = [];
let allFeedbacks = [];
let allReports   = [];
let adminPhone   = '';
let platformConfig = {};   // { feature_toggles:{}, exam_config:[], global_maintenance:false }

// ─── Bootstrap ───────────────────────────────────────────────────────────────

(async function init() {
  const user = await requireAdmin();
  if (!user) return;
  adminPhone = user.phoneNumber || '';

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
})();

// ─── Router ───────────────────────────────────────────────────────────────────

function getRouteFromHash() {
  const h = (location.hash || '').slice(1).toLowerCase();
  return ROUTES.includes(h) ? h : 'dashboard';
}
function wireRouter() {
  window.addEventListener('hashchange', () => activateRoute(getRouteFromHash()));
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
  dashboard:  loadDashboard,
  users:      loadUsers,
  feedback:   loadFeedback,
  reports:    loadReports,
  exams:      loadExams,
  analytics:  loadAnalytics,
  settings:   loadSettings,
};

async function loadDashboard() {
  const { getAdminStats, getRecentUsers } = await import('./supabase.js');
  const [statsRes, usersRes] = await Promise.all([getAdminStats(), getRecentUsers(8)]);
  if (statsRes.data) {
    setStat('stat-total-users',  statsRes.data.totalUsers);
    setStat('stat-active-users', statsRes.data.activeUsers);
    setStat('stat-feedback',     statsRes.data.feedback);
    setStat('stat-reports',      statsRes.data.reports);
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
  ['adm-user-search','adm-user-filter-exam','adm-user-filter-gender']
    .forEach(id => document.getElementById(id)?.addEventListener('input', rerender));
}

function renderFilteredUsers() {
  const search = (document.getElementById('adm-user-search')?.value || '').toLowerCase();
  const exam   = document.getElementById('adm-user-filter-exam')?.value   || '';
  const gender = document.getElementById('adm-user-filter-gender')?.value || '';
  const filtered = allUsers.filter(u => {
    if (search && !`${u.full_name} ${u.phone}`.toLowerCase().includes(search)) return false;
    if (exam   && u.exam_type !== exam)  return false;
    if (gender && u.gender   !== gender) return false;
    return true;
  });
  const el = document.getElementById('adm-users-list');
  el.innerHTML = filtered.length ? renderUsersTable(filtered, true) : emptyState('🔍','No users match filters.');
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

async function loadAnalytics() {
  const el = document.getElementById('adm-analytics-content');
  const { getAnalyticsData, getAdminStats } = await import('./supabase.js');
  const [statsRes, analyticsRes] = await Promise.all([getAdminStats(), getAnalyticsData()]);
  const s = statsRes.data || {};
  const a = analyticsRes.data || {};
  el.innerHTML = `
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
      const ftKey = isFt ? cfg.split('.')[1] : null;
      const { adminUpdateConfig } = await import('./supabase.js');
      let key, value;
      if (isGlobal) { key = 'global_maintenance'; value = input.checked; }
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

  // ── Delete user ───────────────────────────────────────────────────────────
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
  const rows = users.map(u => {
    const status  = u.account_status || 'active';
    const display = u.is_profile_paused ? 'paused' : status;
    const isAdmin = u.role === 'admin';
    const isSuperAdmin = u.role === 'superadmin';
    const isPrivileged = isAdmin || isSuperAdmin;

    // Exam centre: state → district → centre name
    const examCentreState    = u.exam_centre_state    || '—';
    const examCentreDistrict = u.exam_centre_district || '—';
    const examCentreName     = u.exam_center          || '—';

    const actions = withActions ? `<td>
      <div class="adm-actions" style="gap:4px;">
        ${isSuperAdmin
          ? '<span class="adm-pill adm-pill--admin" style="font-size:10px;">⚡ superadmin</span>'
          : `<button class="adm-btn adm-btn--sm ${isAdmin ? 'adm-btn--danger' : 'adm-btn--ok'}"
              data-action="set-role" data-id="${esc(u.id)}" data-role="${isAdmin ? 'user' : 'admin'}">
              ${isAdmin ? 'Revoke admin' : 'Make admin'}
            </button>`}
        ${!isPrivileged
          ? `<button class="adm-btn adm-btn--sm adm-btn--danger"
               data-action="delete-user" data-id="${esc(u.id)}" data-name="${esc(u.full_name||'User')}">
               Delete
             </button>`
          : `<span class="adm-pill" style="font-size:10px;opacity:.5;" title="Revoke admin first to delete">Protected</span>`}
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
      <td><span class="adm-pill adm-pill--${esc(display)}">${esc(display)}</span></td>
      <td style="font-size:11px">${esc(fmtDate(u.created_at))}</td>
      ${actions}
    </tr>`;
  }).join('');
  const ah = withActions ? '<th>Actions</th>' : '';
  return `<table class="adm-table"><thead><tr>
    <th>Name</th><th>Phone</th><th>Gender</th><th>Exam</th>
    <th>Home Location</th><th>Exam Centre</th>
    <th>Role</th><th>Status</th><th>Joined</th>${ah}
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
