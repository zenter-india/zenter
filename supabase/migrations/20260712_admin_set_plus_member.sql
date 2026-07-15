-- The `users` table has a trigger blocking direct client updates to privileged
-- columns (plus_member, role, account_status, etc.) — hence "Modifying privileged
-- columns is not allowed" when the admin panel tried a plain .update() on plus_member.
-- SECURITY DEFINER bypasses that trigger, same pattern as admin_set_user_status.
CREATE OR REPLACE FUNCTION admin_set_plus_member(p_target_id uuid, p_is_plus boolean, p_requester_phone text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requester_role text;
BEGIN
  SELECT role INTO requester_role FROM users WHERE phone = p_requester_phone;

  IF requester_role NOT IN ('admin', 'superadmin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE users SET plus_member = p_is_plus WHERE id = p_target_id;
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_set_plus_member(uuid, boolean, text) TO anon, authenticated;
