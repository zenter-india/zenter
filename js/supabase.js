import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE } from './config.js';

export const supabase = createClient(SUPABASE.url, SUPABASE.anonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
  global: {
    headers: { 'x-client-info': 'hallmate-web/0.1.0' },
  },
});

export function toUiError(err, fallback = 'Something went wrong. Please try again.') {
  if (!err) return null;
  const msg = err.message || err.error_description || err.hint || fallback;
  return { code: err.code || 'unknown', message: msg };
}

export async function query(builder) {
  try {
    const { data, error } = await builder;
    return { data, error: error ? toUiError(error) : null };
  } catch (err) {
    return { data: null, error: toUiError(err) };
  }
}

export function from(table) {
  return supabase.from(table);
}

// ─── Domain helpers ───────────────────────────────────────────────────────────

// Check if a user with this phone exists and whether profile is complete.
export function getUserByPhone(phone) {
  return query(
    from('users')
      .select('id, profile_completed, exam_type, role, state, exam_centre_state')
      .eq('phone', phone)
      .maybeSingle()
  );
}

// ─── Admin platform — Phase 1 ────────────────────────────────────────────────

/** Read-only role lookup by phone. Used by requireAdmin() guard. */
export function getRoleByPhone(phone) {
  return query(
    from('users').select('role').eq('phone', phone).maybeSingle()
  );
}

/** Fetch counts for the admin dashboard. Each query is small (HEAD count). */
export async function getAdminStats() {
  const headCount = (table, predicate) => {
    const q = from(table).select('*', { count: 'exact', head: true });
    return predicate ? predicate(q) : q;
  };
  const [usersR, activeR, conxR, feedbackR, reportsR] = await Promise.all([
    headCount('users'),
    headCount('users', q => q.or('is_profile_paused.is.null,is_profile_paused.eq.false')),
    headCount('connections', q => q.eq('status', 'accepted')),
    headCount('feedbacks'),
    headCount('blocked_users'),
  ]);
  return {
    data: {
      totalUsers:  usersR.count    ?? 0,
      activeUsers: activeR.count   ?? 0,
      connections: conxR.count     ?? 0,
      feedback:    feedbackR.count ?? 0,
      reports:     reportsR.count  ?? 0,
    },
    error: usersR.error || activeR.error || conxR.error || feedbackR.error || reportsR.error || null,
  };
}

/** Recent users list for the admin Users section — includes moderation fields. */
export function getRecentUsers(limit = 50) {
  return query(
    from('users')
      .select('id, full_name, gender, phone, exam_type, state, district, exam_centre_state, exam_centre_district, exam_center, profile_completed, is_profile_paused, account_status, role, created_at')
      .order('created_at', { ascending: false })
      .limit(limit)
  );
}

/** Recent feedback with resolution state. */
export function getRecentFeedbacks(limit = 50) {
  return query(
    from('feedbacks')
      .select('id, user_name, user_id, exam_type, feedback_message, is_resolved, resolved_at, created_at')
      .order('created_at', { ascending: false })
      .limit(limit)
  );
}

// ─── Admin mutation helpers (call SECURITY DEFINER DB functions) ──────────
// All mutations go through server-side functions that verify admin role —
// direct anon-key writes to protected columns are blocked by a DB trigger.

export function adminSetUserStatus(targetId, requesterPhone, status) {
  return query(
    supabase.rpc('admin_set_user_status', {
      p_target_id:       targetId,
      p_requester_phone: requesterPhone,
      p_status:          status,
    })
  );
}

export function adminSetUserPaused(targetId, requesterPhone, paused) {
  return query(
    supabase.rpc('admin_set_user_paused', {
      p_target_id:       targetId,
      p_requester_phone: requesterPhone,
      p_paused:          paused,
    })
  );
}

export function adminResolveFeedback(feedbackId, requesterPhone) {
  return query(
    supabase.rpc('admin_resolve_feedback', {
      p_feedback_id:     feedbackId,
      p_requester_phone: requesterPhone,
    })
  );
}

export function adminDeleteFeedback(feedbackId, requesterPhone) {
  return query(
    supabase.rpc('admin_delete_feedback', {
      p_feedback_id:     feedbackId,
      p_requester_phone: requesterPhone,
    })
  );
}

/** Recent reports (blocks with reasons). */
export function getRecentReports(limit = 50) {
  return query(
    from('blocked_users')
      .select('id, blocker_user_id, blocked_user_id, reason, created_at')
      .order('created_at', { ascending: false })
      .limit(limit)
  );
}

// Fetch the full profile row for the current user (looked up by phone).
export function getProfileByPhone(phone) {
  return query(
    from('users')
      .select(
        'id, phone, full_name, gender, state, district, ' +
        'exam_centre_state, exam_centre_district, exam_center, exam_type, ' +
        'college, travel_mode, stay_plan, bio, ' +
        'profile_completed, is_profile_paused, created_at'
      )
      .eq('phone', phone)
      .maybeSingle()
  );
}

// Insert or update a user record (conflict key: phone).
export function upsertUser(payload) {
  return query(
    from('users').upsert(payload, { onConflict: 'phone' }).select('id').single()
  );
}

// Fetch all users with completed, non-paused profiles for the dashboard feed,
// scoped to the requested exam ecosystem.
//   - examType='NEET UG' (default / null): include 'NEET UG' AND legacy rows
//     with null exam_type (users created before exam_type was introduced).
//   - Any other examType: strict equality — segregates NEET PG etc.
export function getAllUsers(examType = 'NEET UG') {
  let q = from('users')
    .select('id, full_name, gender, state, district, exam_centre_state, exam_centre_district, exam_center, phone, travel_mode, stay_plan, bio, exam_type, created_at')
    .eq('profile_completed', true)
    .or('is_profile_paused.is.null,is_profile_paused.eq.false')
    // Exclude admin-suspended and admin-banned users from the public feed
    .or('account_status.is.null,account_status.eq.active');

  if (!examType || examType === 'NEET UG') {
    // Include legacy null-exam_type rows alongside explicit NEET UG rows.
    q = q.or('exam_type.eq.NEET UG,exam_type.is.null');
  } else {
    q = q.eq('exam_type', examType);
  }

  return query(q.order('created_at', { ascending: false }));
}

// Set or clear the is_profile_paused flag for the current user.
export function setPausedStatus(phone, paused) {
  return query(
    from('users')
      .update({ is_profile_paused: paused })
      .eq('phone', phone)
      .select('id')
      .single()
  );
}

// Delete all user data: connections first (FK), then the profile row itself.
export async function deleteUserData(userId) {
  const { error: connErr } = await query(
    from('connections')
      .delete()
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
  );
  if (connErr) return { error: connErr };
  return query(from('users').delete().eq('id', userId));
}

// ─── Connection helpers ───────────────────────────────────────────────────────

export function getMyConnections(userId) {
  return query(
    from('connections')
      .select('id, sender_id, receiver_id, status, created_at, updated_at')
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .in('status', ['pending', 'accepted', 'rejected'])
  );
}

// Fetch only ACCEPTED connections for the connections page.
// Returns rows with sender_id + receiver_id so the caller can derive the
// "other" user's id (whichever side is NOT the current user).
export function getAcceptedConnections(userId) {
  return query(
    from('connections')
      .select('id, sender_id, receiver_id')
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .eq('status', 'accepted')
  );
}

// Batch-fetch user profiles by an array of ids.
// Includes enrichment fields so connections cards can show travel/stay context.
export function getUsersByIds(ids) {
  if (!ids || ids.length === 0) return Promise.resolve({ data: [], error: null });
  return query(
    from('users')
      .select('id, full_name, gender, state, district, exam_centre_state, exam_centre_district, exam_center, phone, travel_mode, stay_plan, bio')
      .in('id', ids)
  );
}

// ─── Block helpers ────────────────────────────────────────────────────────────

/** Returns { blocked_user_id }[] for every user blocked by userId. */
export function getBlockedUserIds(userId) {
  return query(
    from('blocked_users')
      .select('blocked_user_id')
      .eq('blocker_user_id', userId)
  );
}

/** Returns { blocker_user_id }[] — users who have blocked userId.
 *  Used to hide the blocker from the blocked user's find-mates feed
 *  so neither side sees each other while a block is active. */
export function getBlockedByIds(userId) {
  return query(
    from('blocked_users')
      .select('blocker_user_id')
      .eq('blocked_user_id', userId)
  );
}

/** Full block list with reason + timestamps — for the Blocked Users page. */
export function getBlockedList(userId) {
  return query(
    from('blocked_users')
      .select('id, blocked_user_id, reason, created_at')
      .eq('blocker_user_id', userId)
      .order('created_at', { ascending: false })
  );
}

export function blockUser(blockerUserId, blockedUserId, reason = null) {
  return query(
    from('blocked_users')
      .insert({
        blocker_user_id: blockerUserId,
        blocked_user_id: blockedUserId,
        reason: reason && String(reason).trim() ? String(reason).trim() : null,
      })
      .select('id')
      .single()
  );
}

export function unblockUser(blockerUserId, blockedUserId) {
  return query(
    from('blocked_users')
      .delete()
      .eq('blocker_user_id', blockerUserId)
      .eq('blocked_user_id', blockedUserId)
  );
}

/** Deletes ALL connection rows between two users (either direction, any status).
 *  Used by the block flow so the relationship disappears immediately. */
export function deleteConnectionsBetween(userIdA, userIdB) {
  return query(
    from('connections')
      .delete()
      .in('sender_id',   [userIdA, userIdB])
      .in('receiver_id', [userIdA, userIdB])
  );
}

// ─── Feedback ────────────────────────────────────────────────────────────────

/** Insert a feedback row. user_id, user_name, exam_type are all optional. */
export function submitFeedback({ user_id = null, user_name = null, exam_type = null, feedback_message }) {
  // Plain INSERT — no .select() to avoid needing a SELECT RLS policy.
  return query(
    from('feedbacks').insert({
      user_id,
      user_name,
      exam_type,
      feedback_message: String(feedback_message).trim(),
    })
  );
}

export function sendConnectionRequest(senderId, receiverId) {
  return query(
    from('connections')
      .insert({ sender_id: senderId, receiver_id: receiverId, status: 'pending' })
      .select('id')
      .single()
  );
}

export function respondToRequest(connectionId, status) {
  return query(
    from('connections')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', connectionId)
      .select('id')
      .single()
  );
}

export function deleteRequest(connectionId) {
  return query(
    from('connections').delete().eq('id', connectionId)
  );
}

// ─── Phase 3: Announcements, Platform Config, Reports, Audit ─────────────────

/** Active announcements for the public banner (sorted by priority). */
export function getActiveAnnouncements(examType = null) {
  let q = from('announcements')
    .select('id, message, priority, exam_target, expires_at')
    .eq('is_active', true)
    .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
    .order('priority', { ascending: false });
  if (examType) q = q.or(`exam_target.is.null,exam_target.eq.${examType}`);
  return query(q);
}

export function getAllAnnouncements() {
  return query(from('announcements').select('*').order('priority', { ascending: false }));
}

/** Platform config: feature toggles + exam config. */
export function getPlatformConfig() {
  return query(from('platform_config').select('key, value'));
}

export function getRecentUserReports(limit = 100) {
  return query(
    from('user_reports')
      .select('id, reporter_id, reported_id, reason, details, status, resolved_by, resolved_note, created_at, updated_at')
      .order('created_at', { ascending: false })
      .limit(limit)
  );
}

export function getAuditLog(limit = 100) {
  return query(
    from('audit_log')
      .select('id, admin_phone, action, target_type, target_id, details, created_at')
      .order('created_at', { ascending: false })
      .limit(limit)
  );
}

/** Admin analytics: richer breakdown queries. */
export async function getAnalyticsData() {
  const [examR, genderR, districtR, pendingR, connR] = await Promise.all([
    query(from('users').select('exam_type').eq('profile_completed', true)),
    query(from('users').select('gender').eq('profile_completed', true)),
    query(from('users').select('district').eq('profile_completed', true).not('district', 'is', null)),
    query(from('connections').select('id').eq('status', 'pending')),
    query(from('connections').select('id').eq('status', 'accepted')),
  ]);
  const countBy = (arr, key) => (arr || []).reduce((acc, r) => {
    const v = r[key] || 'Unknown'; acc[v] = (acc[v] || 0) + 1; return acc;
  }, {});
  return {
    data: {
      byExam:     countBy(examR.data,     'exam_type'),
      byGender:   countBy(genderR.data,   'gender'),
      byDistrict: countBy(districtR.data, 'district'),
      pendingConnections:  pendingR.data?.length || 0,
      acceptedConnections: connR.data?.length    || 0,
    },
    error: examR.error || genderR.error || null,
  };
}

// Admin mutations (SECURITY DEFINER)
export function adminUpsertAnnouncement(data, requesterPhone) {
  return query(supabase.rpc('admin_upsert_announcement', {
    p_id: data.id || null, p_message: data.message, p_is_active: data.is_active,
    p_priority: data.priority || 0, p_exam_target: data.exam_target || null,
    p_expires_at: data.expires_at || null, p_requester_phone: requesterPhone,
  }));
}

export function adminDeleteAnnouncement(id, requesterPhone) {
  return query(supabase.rpc('admin_delete_announcement', {
    p_id: id, p_requester_phone: requesterPhone,
  }));
}

export function adminUpdateConfig(key, value, requesterPhone) {
  return query(supabase.rpc('admin_update_config', {
    p_key: key, p_value: value, p_requester_phone: requesterPhone,
  }));
}

export function adminUpdateReport(id, status, note, requesterPhone) {
  return query(supabase.rpc('admin_update_report', {
    p_id: id, p_status: status, p_note: note || null, p_requester_phone: requesterPhone,
  }));
}

export function adminSetUserRole(targetId, role, requesterPhone) {
  return query(supabase.rpc('admin_set_user_role', {
    p_target_id: targetId, p_role: role, p_requester_phone: requesterPhone,
  }));
}
