-- admin_upsert_coupon exists but was never granted EXECUTE to the client roles,
-- hence "permission denied for function admin_upsert_coupon" from the admin panel.
-- Looked up by name (not a fixed signature) so this works regardless of exact
-- parameter types.
DO $$
DECLARE
  fn_signature text;
BEGIN
  FOR fn_signature IN
    SELECT p.oid::regprocedure::text
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'admin_upsert_coupon' AND n.nspname = 'public'
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon, authenticated', fn_signature);
  END LOOP;
END;
$$;
