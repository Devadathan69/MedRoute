-- MedRoute schema.sql
-- Run this in Supabase SQL editor. Includes tables, triggers, RLS examples, and views.

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS postgis;

-- ============================================================
-- 1) phc_centers
-- ============================================================
CREATE TABLE IF NOT EXISTS phc_centers (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  district text NOT NULL,
  state text NOT NULL,
  latitude double precision NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude double precision NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  contact text,
  in_charge_name text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS phc_centers_geom_idx ON phc_centers USING GIST (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326));

-- ============================================================
-- 2) medicines
-- ============================================================
CREATE TABLE IF NOT EXISTS medicines (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  category text,
  unit text NOT NULL,
  min_stock_threshold integer NOT NULL CHECK (min_stock_threshold >= 0),
  standard_dosage text,
  unit_price numeric(10,2) DEFAULT 0.00 CHECK (unit_price >= 0),
  created_at timestamptz DEFAULT now(),
  UNIQUE (name)
);

-- ============================================================
-- user_profiles (maps auth.uid() to roles and centers)
-- ============================================================
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY,
  email text,
  role text NOT NULL CHECK (role IN ('phc_staff','district_officer','state_admin')),
  center_id uuid,
  district text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_profiles_select ON user_profiles
  FOR SELECT
  USING (auth.role() = 'authenticated');


-- ============================================================
-- 3) inventory
-- ============================================================
CREATE TABLE IF NOT EXISTS inventory (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  center_id uuid NOT NULL REFERENCES phc_centers(id) ON DELETE CASCADE,
  medicine_id uuid NOT NULL REFERENCES medicines(id) ON DELETE CASCADE,
  quantity_available integer NOT NULL CHECK (quantity_available >= 0),
  expiry_date date NOT NULL,
  batch_number text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (center_id, medicine_id, batch_number)
);

-- ============================================================
-- 4) shortage_flags
-- ============================================================
CREATE TABLE IF NOT EXISTS shortage_flags (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  center_id uuid NOT NULL REFERENCES phc_centers(id) ON DELETE CASCADE,
  medicine_id uuid NOT NULL REFERENCES medicines(id) ON DELETE CASCADE,
  inventory_id uuid REFERENCES inventory(id) ON DELETE SET NULL,
  flag_type text NOT NULL CHECK (flag_type IN ('low_stock','expiring_soon')),
  flagged_at timestamptz DEFAULT now(),
  resolved boolean DEFAULT false,
  notes text,
  UNIQUE (center_id, medicine_id, flag_type, inventory_id)
);

-- ============================================================
-- 5) redistribution_requests
-- ============================================================
CREATE TABLE IF NOT EXISTS redistribution_requests (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  requesting_center_id uuid NOT NULL REFERENCES phc_centers(id) ON DELETE CASCADE,
  supplying_center_id uuid NOT NULL REFERENCES phc_centers(id) ON DELETE CASCADE,
  medicine_id uuid NOT NULL REFERENCES medicines(id) ON DELETE CASCADE,
  quantity integer NOT NULL CHECK (quantity > 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  requested_by uuid,
  requested_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE OR REPLACE FUNCTION redistribution_requests_update_timestamp()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_redistribution_requests_timestamp
BEFORE UPDATE ON redistribution_requests
FOR EACH ROW
EXECUTE PROCEDURE redistribution_requests_update_timestamp();

-- ============================================================
-- 6) transfer_logs
-- ============================================================
CREATE TABLE IF NOT EXISTS transfer_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id uuid NOT NULL UNIQUE REFERENCES redistribution_requests(id) ON DELETE CASCADE,
  medicine_id uuid NOT NULL REFERENCES medicines(id) ON DELETE CASCADE,
  quantity integer NOT NULL CHECK (quantity > 0),
  date_transferred timestamptz DEFAULT now(),
  transferred_by uuid,
  received_by uuid,
  supplying_center_id uuid NOT NULL REFERENCES phc_centers(id) ON DELETE CASCADE,
  requesting_center_id uuid NOT NULL REFERENCES phc_centers(id) ON DELETE CASCADE,
  expiry_date date,
  unit_price numeric(10,2) DEFAULT 0.00 CHECK (unit_price >= 0)
);

-- ============================================================
-- Trigger: auto-insert shortage_flags on inventory INSERT/UPDATE
-- ============================================================
CREATE OR REPLACE FUNCTION inventory_flag_trigger()
RETURNS trigger AS $$
DECLARE
  med_threshold integer;
  soon_threshold INTERVAL := '30 days';
  existing_id uuid;
  is_low boolean := false;
  is_expiring boolean := false;
BEGIN
  SELECT min_stock_threshold INTO med_threshold FROM medicines WHERE id = NEW.medicine_id;

  IF NEW.quantity_available < COALESCE(med_threshold, 0) THEN
    is_low := true;
  END IF;

  IF NEW.expiry_date <= (now()::date + soon_threshold) THEN
    is_expiring := true;
  END IF;

  IF is_low THEN
    SELECT id INTO existing_id FROM shortage_flags
      WHERE center_id = NEW.center_id AND medicine_id = NEW.medicine_id AND flag_type = 'low_stock';
    IF existing_id IS NULL THEN
      INSERT INTO shortage_flags(center_id, medicine_id, inventory_id, flag_type, flagged_at)
      VALUES (NEW.center_id, NEW.medicine_id, NEW.id, 'low_stock', now());
    ELSE
      UPDATE shortage_flags SET inventory_id = NEW.id, flagged_at = now(), resolved = false WHERE id = existing_id;
    END IF;
  ELSE
    UPDATE shortage_flags SET resolved = true WHERE center_id = NEW.center_id AND medicine_id = NEW.medicine_id AND flag_type = 'low_stock';
  END IF;

  IF is_expiring THEN
    SELECT id INTO existing_id FROM shortage_flags
      WHERE center_id = NEW.center_id AND medicine_id = NEW.medicine_id AND flag_type = 'expiring_soon';
    IF existing_id IS NULL THEN
      INSERT INTO shortage_flags(center_id, medicine_id, inventory_id, flag_type, flagged_at)
      VALUES (NEW.center_id, NEW.medicine_id, NEW.id, 'expiring_soon', now());
    ELSE
      UPDATE shortage_flags SET inventory_id = NEW.id, flagged_at = now(), resolved = false WHERE id = existing_id;
    END IF;
  ELSE
    UPDATE shortage_flags SET resolved = true WHERE center_id = NEW.center_id AND medicine_id = NEW.medicine_id AND flag_type = 'expiring_soon';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_inventory_flag
AFTER INSERT OR UPDATE ON inventory
FOR EACH ROW
EXECUTE PROCEDURE inventory_flag_trigger();

-- ============================================================
-- Trigger: create transfer_log when redistribution_requests.status -> 'approved'
-- ============================================================
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
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_redistribution_approved
AFTER UPDATE ON redistribution_requests
FOR EACH ROW
EXECUTE PROCEDURE redistribution_requests_to_transfer_log();

-- ============================================================
-- View: expiring_soon
-- ============================================================
CREATE OR REPLACE VIEW expiring_soon AS
SELECT
  i.id AS inventory_id,
  i.center_id,
  pc.name AS center_name,
  i.medicine_id,
  m.name AS medicine_name,
  i.quantity_available,
  i.expiry_date,
  i.batch_number,
  m.unit,
  m.unit_price
FROM inventory i
JOIN medicines m ON i.medicine_id = m.id
JOIN phc_centers pc ON i.center_id = pc.id
WHERE i.expiry_date <= (now()::date + INTERVAL '30 days')
ORDER BY i.expiry_date ASC;

-- ============================================================
-- RLS and policies (examples for Supabase)
-- ============================================================
ALTER TABLE phc_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE medicines ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE shortage_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE redistribution_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE transfer_logs ENABLE ROW LEVEL SECURITY;

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

CREATE POLICY "phc_staff_inventory_manage" ON inventory
  FOR ALL
  USING (
    (
      (jwt_claim('role') = 'phc_staff' AND center_id::text = jwt_claim('center_id'))
      OR jwt_claim('role') IN ('district_officer','state_admin')
    )
  )
  WITH CHECK (
    (
      (jwt_claim('role') = 'phc_staff' AND center_id::text = jwt_claim('center_id'))
      OR jwt_claim('role') IN ('district_officer','state_admin')
    )
  );

CREATE POLICY "flags_view" ON shortage_flags
  FOR SELECT
  USING (
    jwt_claim('role') = 'state_admin'
    OR (jwt_claim('role') = 'district_officer' AND (SELECT district FROM phc_centers WHERE id = center_id) = jwt_claim('district'))
    OR (jwt_claim('role') = 'phc_staff' AND center_id::text = jwt_claim('center_id'))
  );

CREATE POLICY "requests_create" ON redistribution_requests
  FOR INSERT
  WITH CHECK (
    jwt_claim('role') = 'phc_staff'
    AND requesting_center_id::text = jwt_claim('center_id')
  );

CREATE POLICY "requests_manage" ON redistribution_requests
  FOR SELECT
  USING (
    jwt_claim('role') = 'state_admin'
    OR (jwt_claim('role') = 'district_officer' AND (SELECT district FROM phc_centers WHERE id = requesting_center_id) = jwt_claim('district'))
    OR (jwt_claim('role') = 'phc_staff' AND (requesting_center_id::text = jwt_claim('center_id') OR supplying_center_id::text = jwt_claim('center_id')))
  );

CREATE POLICY "requests_update_status" ON redistribution_requests
  FOR UPDATE
  USING (
    jwt_claim('role') IN ('district_officer','state_admin')
    OR (jwt_claim('role') = 'phc_staff' AND supplying_center_id::text = jwt_claim('center_id'))
  )
  WITH CHECK (
    (status IN ('approved','rejected') AND (jwt_claim('role') IN ('district_officer','state_admin') OR (jwt_claim('role') = 'phc_staff' AND supplying_center_id::text = jwt_claim('center_id'))))
    OR (status = 'pending' AND jwt_claim('role') = 'phc_staff' AND requesting_center_id::text = jwt_claim('center_id'))
  );

CREATE POLICY "transfer_logs_view" ON transfer_logs
  FOR SELECT
  USING (
    jwt_claim('role') = 'state_admin'
    OR (jwt_claim('role') = 'district_officer' AND (SELECT district FROM phc_centers WHERE id = supplying_center_id) = jwt_claim('district'))
    OR (jwt_claim('role') = 'phc_staff' AND (supplying_center_id::text = jwt_claim('center_id') OR requesting_center_id::text = jwt_claim('center_id')))
  );

CREATE POLICY "centers_select" ON phc_centers
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "medicines_select" ON medicines
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- ============================================================
-- Example RPC functions (create these in Supabase SQL editor)
-- ============================================================
CREATE OR REPLACE FUNCTION nearest_surplus_phcs(_requesting_center_id uuid, _medicine_id uuid, _quantity_needed integer)
RETURNS TABLE(id uuid, name text, district text, state text, latitude double precision, longitude double precision, total_available integer, distance_meters double precision) AS $$
BEGIN
  RETURN QUERY
  WITH requester AS (SELECT latitude, longitude FROM phc_centers WHERE id = _requesting_center_id),
  surplus AS (
    SELECT pc.*, SUM(i.quantity_available) AS total_available, ST_SetSRID(ST_MakePoint(pc.longitude, pc.latitude),4326)::geography AS geom
    FROM phc_centers pc
    JOIN inventory i ON i.center_id = pc.id
    WHERE i.medicine_id = _medicine_id
    GROUP BY pc.id
    HAVING SUM(i.quantity_available) >= _quantity_needed
  )
  SELECT s.id, s.name, s.district, s.state, s.latitude, s.longitude, s.total_available,
    ST_DistanceSphere(s.geom::geometry, ST_SetSRID(ST_MakePoint(requester.longitude, requester.latitude),4326)::geometry)::double precision AS distance_meters
  FROM surplus s, requester
  ORDER BY distance_meters ASC;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION monthly_waste_saved()
RETURNS TABLE(month date, waste_prevented_rupees numeric) AS $$
BEGIN
  RETURN QUERY
  SELECT date_trunc('month', tl.date_transferred) AS month,
    SUM(tl.quantity * COALESCE(tl.unit_price, m.unit_price))::numeric(12,2) AS waste_prevented_rupees
  FROM transfer_logs tl
  LEFT JOIN medicines m ON tl.medicine_id = m.id
  WHERE tl.expiry_date <= (tl.date_transferred::date + INTERVAL '30 days')
  GROUP BY 1
  ORDER BY 1 DESC;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION phcs_chronic_shortage()
RETURNS TABLE(center_id uuid, center_name text, flag_count int) AS $$
BEGIN
  RETURN QUERY
  SELECT pc.id, pc.name, COUNT(sf.id) FROM shortage_flags sf
  JOIN phc_centers pc ON pc.id = sf.center_id
  WHERE sf.flagged_at >= (now() - INTERVAL '180 days') AND sf.resolved = false
  GROUP BY pc.id, pc.name HAVING COUNT(sf.id) >= 3 ORDER BY COUNT(sf.id) DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================
-- End of schema
-- ============================================================
