-- rls_policies.sql
-- Row-Level Security policies using `user_profiles` mapping table
-- Run this in Supabase SQL editor after `schema.sql` and `seeds.sql`.

-- Safety: revoke broad public privileges (optional but recommended)
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM public;

-- Ensure RLS is enabled (schema.sql enables some, but reinforce)
ALTER TABLE phc_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE medicines ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE shortage_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE redistribution_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE transfer_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Helper: check role in user_profiles
-- Many policies use EXISTS(...) to find the caller's profile

-- ===== user_profiles policies =====
-- Allow users to insert their own profile (on signup)
CREATE POLICY profiles_insert_self ON user_profiles
  FOR INSERT
  WITH CHECK (auth.uid()::uuid = id);

-- Allow users to select and update their own profile; allow state_admin to see all; district_officer to see same district
CREATE POLICY profiles_select ON user_profiles
  FOR SELECT
  USING (
    auth.uid()::uuid = id
    OR EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'state_admin')
    OR EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'district_officer' AND up.district = user_profiles.district)
  );

CREATE POLICY profiles_update_self ON user_profiles
  FOR UPDATE
  USING (auth.uid()::uuid = id OR EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'state_admin'))
  WITH CHECK (auth.uid()::uuid = id OR EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'state_admin'));

-- ===== phc_centers policies =====
-- Selectable by any authenticated user
CREATE POLICY centers_select_auth ON phc_centers
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Modifications only by State Admin
CREATE POLICY centers_manage_admin ON phc_centers
  FOR ALL
  USING (EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'state_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'state_admin'));

-- ===== medicines policies =====
CREATE POLICY medicines_select_auth ON medicines
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY medicines_manage_admin ON medicines
  FOR ALL
  USING (EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'state_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'state_admin'));

-- ===== inventory policies =====
-- Allow PHC staff to manage inventory for their center; district_officer for their district; state_admin for all
CREATE POLICY inventory_access ON inventory
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'state_admin')
    OR EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'phc_staff' AND up.center_id = inventory.center_id)
    OR EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'district_officer' AND up.district = (SELECT district FROM phc_centers WHERE id = inventory.center_id))
  );

CREATE POLICY inventory_insert_update ON inventory
  FOR INSERT, UPDATE
  USING (
    EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'state_admin')
    OR EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'phc_staff' AND up.center_id = inventory.center_id)
  )
  WITH CHECK (
    (
      EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'state_admin')
    ) OR (
      EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'phc_staff' AND up.center_id = inventory.center_id)
    )
  );

CREATE POLICY inventory_delete ON inventory
  FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'state_admin')
    OR EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'phc_staff' AND up.center_id = inventory.center_id)
  );

-- ===== shortage_flags policies =====
-- Allow PHC staff to view flags for their center, district_officer for their district, state_admin for all
CREATE POLICY shortage_flags_select ON shortage_flags
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'state_admin')
    OR EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'phc_staff' AND up.center_id = shortage_flags.center_id)
    OR EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'district_officer' AND up.district = (SELECT district FROM phc_centers WHERE id = shortage_flags.center_id))
  );

-- Allow inserts (triggers or system) and allow state_admin/district_officer to insert manually
CREATE POLICY shortage_flags_insert ON shortage_flags
  FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role IN ('state_admin','district_officer'))
    OR auth.role() = 'authenticated'
  );

CREATE POLICY shortage_flags_update ON shortage_flags
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'state_admin')
    OR EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'phc_staff' AND up.center_id = shortage_flags.center_id)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'state_admin')
    OR EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'phc_staff' AND up.center_id = shortage_flags.center_id)
  );

-- ===== redistribution_requests policies =====
-- Create: only PHC staff for their center
CREATE POLICY requests_create_phc ON redistribution_requests
  FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'phc_staff' AND up.center_id = redistribution_requests.requesting_center_id)
  );

-- Select: requesting/supplying center staff, district officer for the district, state_admin
CREATE POLICY requests_select ON redistribution_requests
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'state_admin')
    OR EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'phc_staff' AND (up.center_id = redistribution_requests.requesting_center_id OR up.center_id = redistribution_requests.supplying_center_id))
    OR EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'district_officer' AND up.district = (SELECT district FROM phc_centers WHERE id = redistribution_requests.requesting_center_id))
  );

-- Update: status updates by district_officer or state_admin; phc_staff can update their own pending requests (e.g., cancel)
CREATE POLICY requests_update ON redistribution_requests
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'state_admin')
    OR (EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'district_officer' AND up.district = (SELECT district FROM phc_centers WHERE id = redistribution_requests.requesting_center_id)))
    OR (EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'phc_staff' AND up.center_id = redistribution_requests.requesting_center_id))
  )
  WITH CHECK (
    (
      (redistribution_requests.status IN ('approved','rejected') AND EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role IN ('district_officer','state_admin')))
    ) OR (
      (redistribution_requests.status = 'pending' AND EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'phc_staff' AND up.center_id = redistribution_requests.requesting_center_id))
    )
  );

-- ===== transfer_logs policies =====
CREATE POLICY transfer_logs_select ON transfer_logs
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'state_admin')
    OR EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'district_officer' AND up.district = (SELECT district FROM phc_centers WHERE id = transfer_logs.supplying_center_id))
    OR EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'phc_staff' AND (up.center_id = transfer_logs.supplying_center_id OR up.center_id = transfer_logs.requesting_center_id))
  );

-- No direct INSERT/UPDATE by clients; logs are created by triggers when requests approved
CREATE POLICY transfer_logs_no_client_write ON transfer_logs
  FOR INSERT, UPDATE, DELETE
  USING (EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'state_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'state_admin'));

-- End of RLS policies
