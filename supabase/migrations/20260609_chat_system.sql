-- ============================================================================
-- Zenter Chat System — Database Schema
-- Migration: 20260609_chat_system.sql
--
-- New tables:
--   conversations             — 1:1 chat rooms (created when connection accepted)
--   messages                  — text messages within conversations
--   contact_exchange_requests — mutual consent contact sharing inside chat
--
-- Config updates:
--   platform_config rows for free_active_chats, contact_exchange_enabled
-- ============================================================================

-- ── 1. Conversations ────────────────────────────────────────────────────────
-- One conversation per accepted connection. Maps 1:1 to a connections row.

CREATE TABLE IF NOT EXISTS conversations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL UNIQUE REFERENCES connections(id) ON DELETE CASCADE,
  user_a        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_b        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Ensure user_a < user_b to prevent duplicate conversations
  CONSTRAINT conversations_user_order CHECK (user_a < user_b)
);

CREATE INDEX idx_conversations_user_a ON conversations(user_a) WHERE is_active = true;
CREATE INDEX idx_conversations_user_b ON conversations(user_b) WHERE is_active = true;
CREATE INDEX idx_conversations_connection ON conversations(connection_id);

-- ── 2. Messages ─────────────────────────────────────────────────────────────
-- Text-only messages. No media, no typing indicators, no read receipts (V1).

CREATE TABLE IF NOT EXISTS messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body            TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  message_type    TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'system')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at DESC);
CREATE INDEX idx_messages_sender ON messages(sender_id);

-- ── 3. Contact Exchange Requests ────────────────────────────────────────────
-- Mutual consent flow: User A requests → User B accepts/declines.
-- Only after acceptance are phone numbers revealed to both parties.

CREATE TABLE IF NOT EXISTS contact_exchange_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  requester_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  responder_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  responded_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Only one active (pending) exchange request per conversation at a time
  CONSTRAINT unique_pending_exchange UNIQUE (conversation_id, status)
);

CREATE INDEX idx_contact_exchange_conversation ON contact_exchange_requests(conversation_id);
CREATE INDEX idx_contact_exchange_responder ON contact_exchange_requests(responder_id, status);

-- ── 4. Platform Config — Chat defaults ──────────────────────────────────────

INSERT INTO platform_config (key, value, updated_by)
VALUES
  ('free_active_chats', '2', 'migration'),
  ('contact_exchange_enabled', 'true', 'migration')
ON CONFLICT (key) DO NOTHING;

-- ── 5. RPC: Create conversation when connection is accepted ─────────────────
-- Called from the client after accepting a connection request.

CREATE OR REPLACE FUNCTION create_conversation_for_connection(
  p_connection_id UUID,
  p_user_a UUID,
  p_user_b UUID
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_conv_id UUID;
  v_ordered_a UUID;
  v_ordered_b UUID;
BEGIN
  -- Enforce user_a < user_b ordering
  IF p_user_a < p_user_b THEN
    v_ordered_a := p_user_a;
    v_ordered_b := p_user_b;
  ELSE
    v_ordered_a := p_user_b;
    v_ordered_b := p_user_a;
  END IF;

  -- Upsert — idempotent if conversation already exists for this connection
  INSERT INTO conversations (connection_id, user_a, user_b)
  VALUES (p_connection_id, v_ordered_a, v_ordered_b)
  ON CONFLICT (connection_id) DO NOTHING
  RETURNING id INTO v_conv_id;

  -- If already existed, fetch the existing id
  IF v_conv_id IS NULL THEN
    SELECT id INTO v_conv_id FROM conversations WHERE connection_id = p_connection_id;
  END IF;

  RETURN v_conv_id;
END;
$$;

-- ── 6. RPC: Send a message ──────────────────────────────────────────────────
-- Validates sender is part of the conversation and conversation is active.

CREATE OR REPLACE FUNCTION send_message(
  p_conversation_id UUID,
  p_sender_id UUID,
  p_body TEXT,
  p_message_type TEXT DEFAULT 'text'
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_msg_id UUID;
  v_conv RECORD;
BEGIN
  -- Validate conversation exists, is active, and sender is a participant
  SELECT * INTO v_conv FROM conversations
  WHERE id = p_conversation_id AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conversation not found or inactive';
  END IF;

  IF p_sender_id != v_conv.user_a AND p_sender_id != v_conv.user_b THEN
    RAISE EXCEPTION 'Not a participant in this conversation';
  END IF;

  INSERT INTO messages (conversation_id, sender_id, body, message_type)
  VALUES (p_conversation_id, p_sender_id, p_body, p_message_type)
  RETURNING id INTO v_msg_id;

  -- Update conversation timestamp
  UPDATE conversations SET updated_at = now() WHERE id = p_conversation_id;

  RETURN v_msg_id;
END;
$$;

-- ── 7. RPC: Request contact exchange ────────────────────────────────────────

CREATE OR REPLACE FUNCTION request_contact_exchange(
  p_conversation_id UUID,
  p_requester_id UUID
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_req_id UUID;
  v_conv RECORD;
  v_responder UUID;
  v_existing RECORD;
BEGIN
  -- Validate conversation
  SELECT * INTO v_conv FROM conversations
  WHERE id = p_conversation_id AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conversation not found or inactive';
  END IF;

  IF p_requester_id != v_conv.user_a AND p_requester_id != v_conv.user_b THEN
    RAISE EXCEPTION 'Not a participant';
  END IF;

  -- Determine responder
  v_responder := CASE WHEN p_requester_id = v_conv.user_a THEN v_conv.user_b ELSE v_conv.user_a END;

  -- Check for existing pending request
  SELECT * INTO v_existing FROM contact_exchange_requests
  WHERE conversation_id = p_conversation_id AND status = 'pending';

  IF FOUND THEN
    RAISE EXCEPTION 'A contact exchange request is already pending';
  END IF;

  -- Check if already accepted
  SELECT * INTO v_existing FROM contact_exchange_requests
  WHERE conversation_id = p_conversation_id AND status = 'accepted';

  IF FOUND THEN
    RAISE EXCEPTION 'Contact has already been exchanged';
  END IF;

  INSERT INTO contact_exchange_requests (conversation_id, requester_id, responder_id)
  VALUES (p_conversation_id, p_requester_id, v_responder)
  RETURNING id INTO v_req_id;

  -- Insert system message
  INSERT INTO messages (conversation_id, sender_id, body, message_type)
  VALUES (p_conversation_id, p_requester_id, 'requested to exchange contact details.', 'system');

  UPDATE conversations SET updated_at = now() WHERE id = p_conversation_id;

  RETURN v_req_id;
END;
$$;

-- ── 8. RPC: Respond to contact exchange ─────────────────────────────────────

CREATE OR REPLACE FUNCTION respond_contact_exchange(
  p_request_id UUID,
  p_responder_id UUID,
  p_accept BOOLEAN
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_req RECORD;
  v_phone_a TEXT;
  v_phone_b TEXT;
  v_name_a TEXT;
  v_name_b TEXT;
  v_result JSONB;
BEGIN
  SELECT * INTO v_req FROM contact_exchange_requests
  WHERE id = p_request_id AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found or already responded';
  END IF;

  IF v_req.responder_id != p_responder_id THEN
    RAISE EXCEPTION 'Not authorized to respond to this request';
  END IF;

  IF p_accept THEN
    UPDATE contact_exchange_requests
    SET status = 'accepted', responded_at = now()
    WHERE id = p_request_id;

    -- Fetch both users' phone numbers
    SELECT phone, full_name INTO v_phone_a, v_name_a FROM users WHERE id = v_req.requester_id;
    SELECT phone, full_name INTO v_phone_b, v_name_b FROM users WHERE id = v_req.responder_id;

    -- System message announcing exchange
    INSERT INTO messages (conversation_id, sender_id, body, message_type)
    VALUES (v_req.conversation_id, p_responder_id,
            'Contact details have been exchanged! You can now see each other''s phone numbers.',
            'system');

    v_result := jsonb_build_object(
      'status', 'accepted',
      'requester_phone', v_phone_a,
      'requester_name', v_name_a,
      'responder_phone', v_phone_b,
      'responder_name', v_name_b
    );
  ELSE
    UPDATE contact_exchange_requests
    SET status = 'declined', responded_at = now()
    WHERE id = p_request_id;

    INSERT INTO messages (conversation_id, sender_id, body, message_type)
    VALUES (v_req.conversation_id, p_responder_id,
            'declined the contact exchange request.',
            'system');

    v_result := jsonb_build_object('status', 'declined');
  END IF;

  UPDATE conversations SET updated_at = now() WHERE id = v_req.conversation_id;

  RETURN v_result;
END;
$$;

-- ── 9. RPC: Get active chat count for a user ────────────────────────────────

CREATE OR REPLACE FUNCTION get_active_chat_count(p_user_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COUNT(*)::INTEGER
  FROM conversations
  WHERE (user_a = p_user_id OR user_b = p_user_id)
    AND is_active = true;
$$;

-- ── 10. RPC: Check if user can start new chat ──────────────────────────────

CREATE OR REPLACE FUNCTION can_start_chat(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
  v_limit INTEGER;
  v_is_plus BOOLEAN;
  v_free_limit INTEGER;
BEGIN
  -- Check Plus membership
  SELECT plus_member INTO v_is_plus FROM users WHERE id = p_user_id;
  v_is_plus := COALESCE(v_is_plus, false);

  -- Get limit from config
  SELECT COALESCE(value::text::integer, 2) INTO v_free_limit
  FROM platform_config WHERE key = 'free_active_chats';

  IF v_is_plus THEN
    RETURN jsonb_build_object('can_chat', true, 'is_plus', true, 'active_chats', 0, 'limit', -1);
  END IF;

  -- Count active conversations
  SELECT COUNT(*)::INTEGER INTO v_count
  FROM conversations
  WHERE (user_a = p_user_id OR user_b = p_user_id) AND is_active = true;

  RETURN jsonb_build_object(
    'can_chat', v_count < v_free_limit,
    'is_plus', false,
    'active_chats', v_count,
    'limit', v_free_limit
  );
END;
$$;

-- ── 11. Realtime — Enable for messages table ────────────────────────────────
-- Supabase realtime listens to INSERT on messages for live chat.

ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- ── 12. RLS policies ────────────────────────────────────────────────────────

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_exchange_requests ENABLE ROW LEVEL SECURITY;

-- Conversations: users can read their own conversations
CREATE POLICY conversations_select ON conversations
  FOR SELECT USING (auth.uid() = user_a OR auth.uid() = user_b);

-- Messages: users can read messages in their conversations
CREATE POLICY messages_select ON messages
  FOR SELECT USING (
    conversation_id IN (
      SELECT id FROM conversations WHERE user_a = auth.uid() OR user_b = auth.uid()
    )
  );

-- Contact exchange: users can read their own exchange requests
CREATE POLICY exchange_select ON contact_exchange_requests
  FOR SELECT USING (requester_id = auth.uid() OR responder_id = auth.uid());
