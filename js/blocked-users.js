// HallMate — Blocked users management page.

import { requireOnboarded }                   from './auth.js';
import { checkSuspended }                     from './utils.js';
import { getBlockedList, getUsersByIds,
         unblockUser, deleteConnectionsBetween } from './supabase.js';
import { setButtonBusy, toast }                from './ui.js';

let myUserId   = null;
let myPhone    = null;

async function init() {
  const firebaseUser = await requireOnboarded();
  if (!firebaseUser) return;

  myPhone = firebaseUser.phoneNumber;

  // Get myUserId from sessionStorage-cached profile or fetch fresh.
  const { getUserByPhone } = await import('./supabase.js');
  const { data: me } = await getUserByPhone(myPhone);
  if (checkSuspended(me)) return;
  myUserId = me?.id || null;
  if (!myUserId) return;

  await loadBlocked();
}

async function loadBlocked() {
  const list = document.getElementById('hm-blocked-list');

  const { data: rows, error } = await getBlockedList(myUserId);
  if (error) {
    list.innerHTML = `<p class="hm-text-muted">Could not load blocked users. Please try again.</p>`;
    return;
  }
  if (!rows || rows.length === 0) {
    list.innerHTML = `
      <div class="hm-empty" style="text-align:center;padding:var(--hm-space-7) 0;">
        <div class="hm-empty__icon" aria-hidden="true" style="margin:0 auto var(--hm-space-3);">🙌</div>
        <h3>No blocked users</h3>
        <p class="hm-text-muted">You haven't blocked anyone yet.</p>
      </div>`;
    return;
  }

  // Fetch names for the blocked user IDs.
  const ids = rows.map(r => r.blocked_user_id);
  const { data: users } = await getUsersByIds(ids);
  const userMap = new Map((users || []).map(u => [u.id, u]));

  list.innerHTML = rows.map(row => {
    const u    = userMap.get(row.blocked_user_id);
    const name = u?.full_name || 'Unknown user';
    const initials = name.split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
    const date = new Date(row.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
    const reason = (row.reason || '').trim();
    return `
      <div class="hm-card hm-blocked-item" data-blocker="${esc(myUserId)}" data-blocked="${esc(row.blocked_user_id)}"
           style="display:flex;align-items:flex-start;gap:var(--hm-space-3);padding:var(--hm-space-4);margin-bottom:var(--hm-space-3);">
        <div class="hm-avatar hm-avatar--sm" style="background:var(--hm-surface-2);color:var(--hm-text-subtle);flex-shrink:0;margin-top:2px;" aria-hidden="true">
          ${esc(initials)}
        </div>
        <div style="flex:1;min-width:0;">
          <p style="margin:0;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
            ${esc(name)}
          </p>
          <p style="margin:0;font-size:var(--hm-text-xs);color:var(--hm-text-muted);">Blocked ${esc(date)}</p>
          ${reason ? `<p style="margin:6px 0 0;font-size:var(--hm-text-xs);color:var(--hm-text-subtle);font-style:italic;">"${esc(reason)}"</p>` : ''}
        </div>
        <button class="hm-btn hm-btn--ghost hm-btn--sm hm-unblock-btn flex-shrink-0" type="button"
                data-blocked-id="${esc(row.blocked_user_id)}">
          Unblock
        </button>
      </div>`;
  }).join('');

  // Wire unblock buttons
  list.querySelectorAll('.hm-unblock-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const blockedId = btn.dataset.blockedId;
      setButtonBusy(btn, true, 'Unblocking…');
      const { error } = await unblockUser(myUserId, blockedId);
      if (error) {
        toast(error.message || 'Could not unblock. Please try again.', { variant: 'danger' });
        setButtonBusy(btn, false);
        return;
      }
      // Clean up any stale connection rows (e.g. a request the blocked user
      // sent while blocked). This gives both users a clean slate so they can
      // send fresh requests after unblocking.
      await deleteConnectionsBetween(myUserId, blockedId).catch(() => {});

      // Remove row from UI
      btn.closest('.hm-blocked-item')?.remove();
      // If list is now empty show empty state
      if (!document.querySelector('.hm-blocked-item')) {
        list.innerHTML = `
          <div class="hm-empty" style="text-align:center;padding:var(--hm-space-7) 0;">
            <div class="hm-empty__icon" aria-hidden="true" style="margin:0 auto var(--hm-space-3);">🙌</div>
            <h3>No blocked users</h3>
            <p class="hm-text-muted">You haven't blocked anyone.</p>
          </div>`;
      }
      // Mark that an unblock happened so dashboard.js re-fetches on next load
      try { sessionStorage.setItem('hm.unblocked', '1'); } catch {}
      toast('User unblocked — taking you to Find Mates.', { variant: 'success' });
      // Force a fresh dashboard load after a short delay so the unblocked user
      // is guaranteed to appear (eliminates any bfcache or stale-state issue).
      setTimeout(() => { window.location.href = '/dashboard.html'; }, 1200);
    });
  });
}

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

document.addEventListener('DOMContentLoaded', init);
