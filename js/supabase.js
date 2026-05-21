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
    from('users').select('id, profile_completed').eq('phone', phone).maybeSingle()
  );
}

// Fetch the full profile row for the current user (looked up by phone).
// Returns { data: <row|null>, error }. Selects only the columns guaranteed by
// the current onboarding schema; richer fields (home_city, college, etc.) are
// merged in by the profile page from row[field] if the column exists on the
// server — this keeps the helper resilient to forward-compat columns being
// missing without throwing PGRST errors.
export function getProfileByPhone(phone) {
  return query(
    from('users')
      .select(
        'id, phone, full_name, gender, state, district, exam_center, ' +
        'college, travel_mode, stay_plan, bio, profile_completed, created_at'
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

// Fetch all users with completed profiles for the dashboard feed.
// Includes enrichment fields (travel_mode, stay_plan, bio) so cards can
// show travel/stay context without a separate fetch.
export function getAllUsers() {
  return query(
    from('users')
      .select('id, full_name, gender, state, district, exam_center, phone, travel_mode, stay_plan, bio, created_at')
      .eq('profile_completed', true)
      .order('created_at', { ascending: false })
  );
}

// ─── Connection helpers ───────────────────────────────────────────────────────

export function getMyConnections(userId) {
  return query(
    from('connections')
      .select('id, sender_id, receiver_id, status')
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
      .select('id, full_name, state, district, exam_center, phone, travel_mode, stay_plan, bio')
      .in('id', ids)
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
      .update({ status })
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
