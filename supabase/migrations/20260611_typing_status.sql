-- ============================================================================
-- Typing Status for Real-Time Chat
-- Migration: 20260611_typing_status.sql
--
-- Tracks when users are typing in conversations for real-time indicators.
-- ============================================================================

CREATE TABLE IF NOT EXISTS typing_status (
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_typing BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX idx_typing_status_conversation ON typing_status(conversation_id);
CREATE INDEX idx_typing_status_updated ON typing_status(updated_at);

-- Enable Realtime for typing_status table
ALTER PUBLICATION supabase_realtime ADD TABLE typing_status;
