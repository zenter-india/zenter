-- ============================================================================
-- User Activity Tracking
-- Migration: 20260611_user_activity_tracking.sql
--
-- Track when users were last active for real-time user metrics.
-- ============================================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_users_last_active ON users(last_active_at DESC) WHERE last_active_at IS NOT NULL;

-- RPC to update user's last_active_at (called after API actions)
CREATE OR REPLACE FUNCTION update_user_activity(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE users SET last_active_at = now() WHERE id = p_user_id;
END;
$$;
