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
      .select('id, profile_completed, exam_type, role, state, exam_centre_state, plus_member, contact_reveals_used')
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
    // seeded_users is now a separate table — users table contains only real users
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
export function getRecentUsers(limit = 50, { seededOnly = false, excludeSeeded = false } = {}) {
  let q = from('users')
    .select('id, full_name, gender, phone, exam_type, state, district, exam_centre_state, exam_centre_district, exam_center, profile_completed, is_profile_paused, account_status, role, is_seeded_user, plus_member, contact_reveals_used, is_verified_aspirant, verification_requested, verification_rejected, nta_application_number, suspicious_flags, device_fingerprint, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (seededOnly)    q = q.eq('is_seeded_user', true);
  if (excludeSeeded) q = q.or('is_seeded_user.is.null,is_seeded_user.eq.false');
  return query(q);
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
        'profile_completed, is_profile_paused, plus_member, contact_reveals_used, is_verified_aspirant, verification_requested, verification_rejected, nta_application_number, created_at'
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
    .select('id, full_name, gender, state, district, exam_centre_state, exam_centre_district, exam_center, phone, travel_mode, stay_plan, bio, exam_type, plus_member, is_verified_aspirant, created_at')
    .eq('profile_completed', true)
    .or('is_profile_paused.is.null,is_profile_paused.eq.false')
    // Exclude admin-suspended and admin-banned users from the public feed
    .or('account_status.is.null,account_status.eq.active');

  if (!examType || examType === 'NEET UG') {
    q = q.or('exam_type.eq.NEET UG,exam_type.is.null');
  } else {
    q = q.eq('exam_type', examType);
  }

  return query(q.order('created_at', { ascending: false }));
}

// ─── Seeded / demo users (separate table) ────────────────────────────────────

/** Fetch active seeded users for the find-mates feed. RLS handles paused/inactive. */
export function getSeededUsers(examType = 'NEET UG') {
  let q = from('seeded_users')
    .select('id, full_name, gender, state, district, exam_centre_state, exam_centre_district, exam_center, phone, travel_mode, stay_plan, bio, exam_type, is_verified_aspirant, created_at');
  if (!examType || examType === 'NEET UG') {
    q = q.or('exam_type.eq.NEET UG,exam_type.is.null');
  } else {
    q = q.eq('exam_type', examType);
  }
  return query(q.order('created_at', { ascending: false }));
}

/** Admin — full seeded user list with moderation fields. */
export function getAllSeededUsers(limit = 200) {
  return query(
    from('seeded_users')
      .select('id, full_name, gender, phone, exam_type, state, district, exam_centre_state, exam_centre_district, exam_center, travel_mode, stay_plan, bio, profile_completed, is_profile_paused, account_status, created_at')
      .order('exam_centre_district', { ascending: true })
      .limit(limit)
  );
}

/** Delete a single seeded user. */
export function deleteSeededUser(id) {
  return query(from('seeded_users').delete().eq('id', id));
}

/** Delete ALL seeded users. */
export function deleteAllSeededUsers() {
  return query(from('seeded_users').delete().neq('id', '00000000-0000-0000-0000-000000000000'));
}

/** Pause / unpause a seeded user to hide/show them in the feed. */
export function toggleSeededUserPause(id, paused) {
  return query(from('seeded_users').update({ is_profile_paused: paused }).eq('id', id));
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
  // seeded_users is a separate table — users table is real users only
  const [examR, genderR, districtR, pendingR, connR, matchR, revealsR] = await Promise.all([
    query(from('users').select('exam_type').eq('profile_completed', true)),
    query(from('users').select('gender').eq('profile_completed', true)),
    query(from('users').select('district').eq('profile_completed', true).not('district', 'is', null)),
    query(from('connections').select('id').eq('status', 'pending')),
    query(from('connections').select('id').eq('status', 'accepted')),
    query(supabase.rpc('get_match_rate')),
    query(from('users').select('contact_reveals_used').or('is_seeded_user.is.null,is_seeded_user.eq.false')),
  ]);
  const countBy = (arr, key) => (arr || []).reduce((acc, r) => {
    const v = r[key] || 'Unknown'; acc[v] = (acc[v] || 0) + 1; return acc;
  }, {});

  const matchData      = matchR.data?.[0] || {};
  const matchedUsers   = Number(matchData.matched_users  || 0);
  const totalUsers     = Number(matchData.total_users    || 0);
  const matchRatePct   = totalUsers > 0 ? Math.round((matchedUsers / totalUsers) * 100) : 0;
  const totalConversations = (revealsR.data || []).reduce((s, r) => s + (r.contact_reveals_used || 0), 0);

  return {
    data: {
      byExam:     countBy(examR.data,     'exam_type'),
      byGender:   countBy(genderR.data,   'gender'),
      byDistrict: countBy(districtR.data, 'district'),
      pendingConnections:  pendingR.data?.length || 0,
      acceptedConnections: connR.data?.length    || 0,
      matchedUsers,
      totalUsers,
      matchRatePct,
      totalConversations,
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

// adminDeleteAllSeeded and adminHideSeededUser removed — seeded users now live
// in the seeded_users table. Use deleteAllSeededUsers / toggleSeededUserPause instead.

// ─── Zenter Plus — Monetization ───────────────────────────────────────────────

// ─── Contact reveal ───────────────────────────────────────────────────────────

/**
 * Attempt to reveal a contact. Atomically increments the counter and returns:
 *   { can_reveal, reveals_used, limit, is_plus, incremented }
 */
export function attemptReveal(userId) {
  return query(supabase.rpc('increment_reveal_count', { p_user_id: userId }));
}

/** Grant or revoke Plus membership (admin). */
export function adminSetPlusMember(targetId, isPlus) {
  return query(from('users').update({ plus_member: isPlus }).eq('id', targetId).select('id').single());
}

// ─── Razorpay Payment ─────────────────────────────────────────────────────────

const EDGE_BASE = 'https://wppuzqaigtffcpuvjolt.supabase.co/functions/v1';

/** Create a Razorpay order server-side. Pass couponCode to apply discount server-side.
 *  dryRun=true validates the coupon and returns pricing without creating a real order.
 *  Retries up to 2 times on failure (Edge Function cold start can cause intermittent errors). */
export async function createRazorpayOrder(userId, couponCode = null, dryRun = false) {
  const MAX_RETRIES = 2;
  let lastError = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) await new Promise(r => setTimeout(r, 1000 * attempt)); // backoff
      const resp = await fetch(`${EDGE_BASE}/create-razorpay-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE.anonKey },
        body: JSON.stringify({ user_id: userId, coupon_code: couponCode || null, dry_run: dryRun }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Could not create order');
      return data;
    } catch (err) {
      lastError = err;
      console.warn(`[razorpay] attempt ${attempt + 1} failed:`, err.message);
    }
  }
  throw lastError;
}

/** Verify payment server-side and grant Plus. */
export async function verifyRazorpayPayment(orderId, paymentId, signature, userId) {
  const resp = await fetch(`${EDGE_BASE}/verify-razorpay-payment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE.anonKey },
    body: JSON.stringify({
      razorpay_order_id:    orderId,
      razorpay_payment_id:  paymentId,
      razorpay_signature:   signature,
      user_id:              userId,
    }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || 'Payment verification failed');
  return data;
}

// ─── Analytics ────────────────────────────────────────────────────────────────

/** Log an analytics event (fire-and-forget). */
export function trackEvent(eventName, userId, properties = {}) {
  return query(
    from('analytics_events').insert({ event_name: eventName, user_id: userId || null, properties })
  );
}

/** Grant or revoke Verified Aspirant status (admit card verified by admin). */
export function adminSetVerifiedAspirant(targetId, isVerified) {
  const updates = isVerified
    ? { is_verified_aspirant: true,  verification_requested: false, verification_rejected: false }
    : { is_verified_aspirant: false, verification_requested: false, verification_rejected: true  };
  return query(from('users').update(updates).eq('id', targetId).select('id').single());
}

/** User submits NTA application number and requests verification. */
export function requestAdmitCardVerification(phone, ntaNumber) {
  return query(
    from('users')
      .update({ nta_application_number: ntaNumber.trim(), verification_requested: true, verification_rejected: false })
      .eq('phone', phone)
      .select('id').single()
  );
}

// ─── Suspicious activity ──────────────────────────────────────────────────────

/** Flag a user as rapidly revealing contacts (called from dashboard after detection). */
export function flagRapidReveal(userId) {
  return query(supabase.rpc('flag_rapid_reveal', { p_user_id: userId }));
}

/** Admin: clear all suspicious flags on a user. */
export function adminClearSuspiciousFlags(targetId, requesterPhone) {
  return query(supabase.rpc('admin_clear_suspicious_flags', {
    p_target_id: targetId, p_requester_phone: requesterPhone,
  }));
}

/** Save device fingerprint on user row (called once during onboarding). */
export function saveDeviceFingerprint(userId, fingerprint) {
  return query(from('users').update({ device_fingerprint: fingerprint }).eq('id', userId));
}

/** Get all users sharing the same device fingerprint (admin: detect multi-account). */
export function getUsersByFingerprint(fingerprint) {
  return query(from('users').select('id, full_name, phone, created_at').eq('device_fingerprint', fingerprint));
}

// ─── Seeded user connection requests ─────────────────────────────────────────

/** Get pending connection requests where receiver is a seeded user. */
export async function getSeededPendingRequests() {
  // Get all seeded user IDs
  const { data: seeded } = await query(from('seeded_users').select('id'));
  if (!seeded?.length) return { data: [], error: null };
  const seededIds = seeded.map(s => s.id);

  // Get pending connections where receiver_id is a seeded user
  const { data, error } = await query(
    from('connections')
      .select('id, sender_id, receiver_id, status, created_at')
      .eq('status', 'pending')
      .in('receiver_id', seededIds)
      .order('created_at', { ascending: false })
  );
  return { data, error };
}

/** Admin: accept a connection request on behalf of a seeded user. */
export function adminAcceptSeededRequest(connectionId) {
  return query(
    from('connections')
      .update({ status: 'accepted' })
      .eq('id', connectionId)
      .select('id, sender_id, receiver_id')
      .single()
  );
}

/** Admin: send a connection request FROM a seeded user TO a real user. */
export function sendSeededConnectionRequest(seededUserId, realUserId) {
  return query(
    from('connections')
      .insert({ sender_id: seededUserId, receiver_id: realUserId, status: 'pending' })
      .select('id')
      .single()
  );
}

// ─── Chat System ─────────────────────────────────────────────────────────────

/** Create a conversation when a connection is accepted. Idempotent. */
export function createConversation(connectionId, userA, userB) {
  return query(supabase.rpc('create_conversation_for_connection', {
    p_connection_id: connectionId, p_user_a: userA, p_user_b: userB,
  }));
}

/** Get all active conversations for a user, with the other user's info. */
export async function getMyConversations(userId) {
  const { data, error } = await query(
    from('conversations')
      .select('id, connection_id, user_a, user_b, is_active, updated_at, created_at')
      .or(`user_a.eq.${userId},user_b.eq.${userId}`)
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
  );
  return { data, error };
}

/** Get messages for a conversation (paginated, newest last). */
export function getMessages(conversationId, limit = 50, before = null) {
  let q = from('messages')
    .select('id, conversation_id, sender_id, body, message_type, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(limit);
  if (before) q = q.lt('created_at', before);
  return query(q);
}

/** Send a text message. Returns message id. */
export function sendMessage(conversationId, senderId, body) {
  return query(supabase.rpc('send_message', {
    p_conversation_id: conversationId,
    p_sender_id: senderId,
    p_body: body,
    p_message_type: 'text',
  }));
}

/** Check if user can start a new chat (free limit check). */
export function canStartChat(userId) {
  return query(supabase.rpc('can_start_chat', { p_user_id: userId }));
}

/** Get active chat count for a user. */
export function getActiveChatCount(userId) {
  return query(supabase.rpc('get_active_chat_count', { p_user_id: userId }));
}

/** Get unread message count across all conversations for a user. */
export async function getUnreadCount(userId, lastReadMap = {}) {
  // lastReadMap: { conversationId: lastReadTimestamp }
  // For V1, count messages where sender != userId and created_at > last visit
  const { data: convs } = await getMyConversations(userId);
  if (!convs?.length) return 0;

  let total = 0;
  for (const conv of convs) {
    const lastRead = lastReadMap[conv.id] || conv.created_at;
    const { data } = await query(
      from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('conversation_id', conv.id)
        .neq('sender_id', userId)
        .gt('created_at', lastRead)
    );
    total += data ?? 0;
  }
  return total;
}

// ─── Contact Exchange ────────────────────────────────────────────────────────

/** Request to exchange contact details inside a chat. */
export function requestContactExchange(conversationId, requesterId) {
  return query(supabase.rpc('request_contact_exchange', {
    p_conversation_id: conversationId,
    p_requester_id: requesterId,
  }));
}

/** Respond to a contact exchange request (accept/decline). */
export function respondContactExchange(requestId, responderId, accept) {
  return query(supabase.rpc('respond_contact_exchange', {
    p_request_id: requestId,
    p_responder_id: responderId,
    p_accept: accept,
  }));
}

/** Get the contact exchange status for a conversation. */
export function getContactExchangeStatus(conversationId) {
  return query(
    from('contact_exchange_requests')
      .select('id, requester_id, responder_id, status, responded_at, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
  );
}

// ─── Realtime subscription ──────────────────────────────────────────────────

/** Subscribe to new messages in a conversation. Returns the channel (call .unsubscribe() to stop). */
export function subscribeToMessages(conversationId, onMessage) {
  return supabase
    .channel(`messages:${conversationId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: `conversation_id=eq.${conversationId}`,
    }, (payload) => onMessage(payload.new))
    .subscribe();
}

/** Subscribe to all new messages across all user's conversations. */
export function subscribeToAllMessages(userId, conversationIds, onMessage) {
  // Subscribe to each conversation's messages
  const channels = conversationIds.map(cid =>
    supabase
      .channel(`messages:${cid}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${cid}`,
      }, (payload) => onMessage(payload.new))
      .subscribe()
  );
  return channels; // caller can .unsubscribe() each
}
