-- rls_hotfix.sql
-- Simply run this block in your Supabase SQL Editor.
-- This natively hot-fixes the Row Level Security logic that governs transfers,
-- entirely eliminating the 403 Forbidden Error.

CREATE OR REPLACE FUNCTION jwt_claim(key text) RETURNS text AS $$
DECLARE
  profile_val text;
BEGIN
  IF key = 'role' THEN
    SELECT role::text INTO profile_val FROM public.user_profiles WHERE id = auth.uid();
  ELSIF key = 'center_id' THEN
    SELECT center_id::text INTO profile_val FROM public.user_profiles WHERE id = auth.uid();
  ELSIF key = 'district' THEN
    SELECT district::text INTO profile_val FROM public.user_profiles WHERE id = auth.uid();
  END IF;
  RETURN profile_val;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
