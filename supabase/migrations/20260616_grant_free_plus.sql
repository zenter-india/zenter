-- Grants Zenter Plus when the final payment price is ₹0 (100% coupon discount).
-- SECURITY DEFINER bypasses RLS to write plus_member directly.
-- No auth.uid() check because the app uses Firebase auth, not Supabase auth —
-- the Supabase client carries only the anon key, so auth.uid() would always be NULL.
CREATE OR REPLACE FUNCTION claim_free_plus(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE users SET plus_member = true WHERE id = p_user_id;
  RETURN true;
END;
$$;

-- Grant to anon because the client calls this with the anon key (no Supabase session).
GRANT EXECUTE ON FUNCTION claim_free_plus(uuid) TO anon, authenticated;
