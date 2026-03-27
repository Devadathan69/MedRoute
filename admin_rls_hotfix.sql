-- admin_rls_hotfix.sql
-- Run this snippet in your Supabase SQL Editor.

-- 1) Secures internal database side-effects
-- The transfer logs and automated inventory deduction require SECURITY DEFINER
-- so the database can automate internal workflows across tables without failing 
-- due to missing permission grants to standard users.
CREATE OR REPLACE FUNCTION redistribution_requests_to_transfer_log()
RETURNS trigger AS $$
DECLARE
  inv_record RECORD;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    IF NOT EXISTS (SELECT 1 FROM transfer_logs WHERE request_id = NEW.id) THEN
      SELECT id, expiry_date, quantity_available FROM inventory
      WHERE center_id = NEW.supplying_center_id AND medicine_id = NEW.medicine_id AND quantity_available >= NEW.quantity
      ORDER BY expiry_date ASC LIMIT 1
      INTO inv_record;

      INSERT INTO transfer_logs(request_id, medicine_id, quantity, date_transferred, supplying_center_id, requesting_center_id, expiry_date, unit_price)
      VALUES (
        NEW.id,
        NEW.medicine_id,
        NEW.quantity,
        now(),
        NEW.supplying_center_id,
        NEW.requesting_center_id,
        COALESCE(inv_record.expiry_date, NULL),
        (SELECT unit_price FROM medicines WHERE id = NEW.medicine_id)
      );

      IF inv_record.id IS NOT NULL THEN
        UPDATE inventory SET quantity_available = quantity_available - NEW.quantity WHERE id = inv_record.id AND quantity_available >= NEW.quantity;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2) Let state admins manage PHC centers
DROP POLICY IF EXISTS "centers_manage" ON phc_centers;
CREATE POLICY "centers_manage" ON phc_centers
  FOR ALL
  USING (jwt_claim('role') = 'state_admin')
  WITH CHECK (jwt_claim('role') = 'state_admin');

-- 3) Let state admins manage medicines
DROP POLICY IF EXISTS "medicines_manage" ON medicines;
CREATE POLICY "medicines_manage" ON medicines
  FOR ALL
  USING (jwt_claim('role') = 'state_admin')
  WITH CHECK (jwt_claim('role') = 'state_admin');
