-- populate.sql
-- Comprehensive Seed Data for MedRoute (Kerala Context)
-- Run this directly in the Supabase SQL Editor to bypass Row Level Security (RLS)

-- 0. Clean Slate: Wipe existing test data to prevent unique constraint conflicts
TRUNCATE TABLE public.shortage_flags, public.transfer_logs, public.redistribution_requests, public.inventory, public.medicines, public.phc_centers, public.user_profiles CASCADE;


-- 0. Update RLS Policy to allow Supplying PHCs to approve/reject requests natively
DROP POLICY IF EXISTS "requests_update_status" ON redistribution_requests;
CREATE POLICY "requests_update_status" ON redistribution_requests
  FOR UPDATE
  USING (
    current_setting('jwt.claims.role', true) IN ('district_officer','state_admin')
    OR (current_setting('jwt.claims.role', true) = 'phc_staff' AND supplying_center_id::text = current_setting('jwt.claims.center_id', true))
  )
  WITH CHECK (
    (status IN ('approved','rejected') AND (current_setting('jwt.claims.role', true) IN ('district_officer','state_admin') OR (current_setting('jwt.claims.role', true) = 'phc_staff' AND supplying_center_id::text = current_setting('jwt.claims.center_id', true))))
    OR (status = 'pending' AND current_setting('jwt.claims.role', true) = 'phc_staff' AND requesting_center_id::text = current_setting('jwt.claims.center_id', true))
  );

-- 1. Create PHC Centers (Kerala - Ernakulam, Idukki, Kottayam)
INSERT INTO public.phc_centers (id, name, district, state, latitude, longitude, contact, in_charge_name)
VALUES
  -- Ernakulam
  ('ce110000-0000-0000-0000-000000000001', 'Kalamassery PHC', 'Ernakulam', 'Kerala', 10.046, 76.318, '0484-2532222', 'Dr. Sajith'),
  ('ce110000-0000-0000-0000-000000000002', 'Vyttila PHC', 'Ernakulam', 'Kerala', 9.967, 76.318, '0484-2304444', 'Dr. Lakshmi'),
  -- Idukki
  ('c1d20000-0000-0000-0000-000000000001', 'Munnar PHC', 'Idukki', 'Kerala', 10.089, 77.059, '04865-230321', 'Dr. Arun'),
  ('c1d20000-0000-0000-0000-000000000002', 'Thodupuzha PHC', 'Idukki', 'Kerala', 9.896, 76.714, '04862-222222', 'Dr. Varghese'),
  -- Kottayam
  ('c4010000-0000-0000-0000-000000000001', 'Pala PHC', 'Kottayam', 'Kerala', 9.711, 76.683, '04822-212222', 'Dr. Oommen'),
  ('c4010000-0000-0000-0000-000000000002', 'Ettumanoor PHC', 'Kottayam', 'Kerala', 9.664, 76.561, '0481-2531111', 'Dr. Anjali')
ON CONFLICT DO NOTHING;

-- 2. Create Common Medicines
INSERT INTO public.medicines (id, name, category, unit, min_stock_threshold, standard_dosage, unit_price)
VALUES
  ('d1100000-0000-0000-0000-000000000001', 'Paracetamol 500mg', 'Analgesic', 'Tablet', 500, '500mg every 6h', 1.00),
  ('d1200000-0000-0000-0000-000000000002', 'Azithromycin 500mg', 'Antibiotic', 'Tablet', 100, '500mg daily for 3 days', 18.00),
  ('d1300000-0000-0000-0000-000000000003', 'Metformin 500mg', 'Antidiabetic', 'Tablet', 300, '500mg twice daily with meals', 3.50),
  ('d1400000-0000-0000-0000-000000000004', 'Amlodipine 5mg', 'Antihypertensive', 'Tablet', 200, '5mg daily', 2.00),
  ('d1500000-0000-0000-0000-000000000005', 'Insulin Glargine 100IU', 'Antidiabetic', 'Vial', 50, '10IU subcutaneously daily', 150.00)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- 3. Clear existing test auth users to avoid conflicts
DELETE FROM auth.users WHERE id IN (
  'aa000000-0000-0000-0000-000000000001',
  'aa000000-0000-0000-0000-000000000002',
  'aa000000-0000-0000-0000-000000000003',
  'aa000000-0000-0000-0000-000000000004',
  'aa000000-0000-0000-0000-000000000005'
);

-- 4. Create Auth Users with Hashed Passwords ('password123' for all)
INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, 
  created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token, raw_app_meta_data, raw_user_meta_data
)
VALUES
  ('aa000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'state_admin@medroute.com', crypt('password123', gen_salt('bf')), now(), now(), now(), '', '', '', '', '{"provider":"email","providers":["email"]}', '{"role":"state_admin"}'),
  ('aa000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ekm_admin@medroute.com', crypt('password123', gen_salt('bf')), now(), now(), now(), '', '', '', '', '{"provider":"email","providers":["email"]}', '{"role":"district_officer","district":"Ernakulam"}'),
  ('aa000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ekm_phc@medroute.com', crypt('password123', gen_salt('bf')), now(), now(), now(), '', '', '', '', '{"provider":"email","providers":["email"]}', '{"role":"phc_staff","center_id":"ce110000-0000-0000-0000-000000000001"}'),
  ('aa000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'idukki_phc@medroute.com', crypt('password123', gen_salt('bf')), now(), now(), now(), '', '', '', '', '{"provider":"email","providers":["email"]}', '{"role":"phc_staff","center_id":"c1d20000-0000-0000-0000-000000000001"}'),
  ('aa000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'kottayam_phc@medroute.com', crypt('password123', gen_salt('bf')), now(), now(), now(), '', '', '', '', '{"provider":"email","providers":["email"]}', '{"role":"phc_staff","center_id":"c4010000-0000-0000-0000-000000000001"}');

-- 5. Create corresponding User Profiles
INSERT INTO public.user_profiles (id, email, role, center_id, district)
VALUES
  ('aa000000-0000-0000-0000-000000000001', 'state_admin@medroute.com', 'state_admin', null, 'Kerala'),
  ('aa000000-0000-0000-0000-000000000002', 'ekm_admin@medroute.com', 'district_officer', null, 'Ernakulam'),
  ('aa000000-0000-0000-0000-000000000003', 'ekm_phc@medroute.com', 'phc_staff', 'ce110000-0000-0000-0000-000000000001', 'Ernakulam'),
  ('aa000000-0000-0000-0000-000000000004', 'idukki_phc@medroute.com', 'phc_staff', 'c1d20000-0000-0000-0000-000000000001', 'Idukki'),
  ('aa000000-0000-0000-0000-000000000005', 'kottayam_phc@medroute.com', 'phc_staff', 'c4010000-0000-0000-0000-000000000001', 'Kottayam')
ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, role = EXCLUDED.role, center_id = EXCLUDED.center_id, district = EXCLUDED.district;

-- 6. Insert Inventory (Simulating distinct geographic scenarios)
INSERT INTO public.inventory (center_id, medicine_id, quantity_available, expiry_date, batch_number)
VALUES
  -- Ernakulam (Kalamassery) -> Needs Paracetamol, Huge stock of Azithromycin
  ('ce110000-0000-0000-0000-000000000001', 'd1100000-0000-0000-0000-000000000001', 20, (now() + INTERVAL '120 days')::date, 'E-PARA-01'), -- Crisis Shortage
  ('ce110000-0000-0000-0000-000000000001', 'd1200000-0000-0000-0000-000000000002', 1200, (now() + INTERVAL '280 days')::date, 'E-AZI-01'), -- Huge Surplus
  ('ce110000-0000-0000-0000-000000000001', 'd1500000-0000-0000-0000-000000000005', 10, (now() + INTERVAL '15 days')::date, 'E-INS-01'), -- Expiring very soon

  -- Idukki (Munnar) -> Needs Azithromycin, Huge stock of Paracetamol
  ('c1d20000-0000-0000-0000-000000000001', 'd1100000-0000-0000-0000-000000000001', 4000, (now() + INTERVAL '150 days')::date, 'M-PARA-01'), -- Huge Surplus
  ('c1d20000-0000-0000-0000-000000000001', 'd1200000-0000-0000-0000-000000000002', 5, (now() + INTERVAL '90 days')::date, 'M-AZI-01'), -- Crisis Shortage

  -- Kottayam (Pala) -> Excellent Stock
  ('c4010000-0000-0000-0000-000000000001', 'd1300000-0000-0000-0000-000000000003', 600, (now() + INTERVAL '25 days')::date, 'K-MET-01'), -- Expiring fairly soon
  ('c4010000-0000-0000-0000-000000000001', 'd1400000-0000-0000-0000-000000000004', 500, (now() + INTERVAL '300 days')::date, 'K-AML-01')
ON CONFLICT DO NOTHING;

-- 7. Insert Dummy Redistribution Requests
-- Munnar PHC (Idukki) requesting Azithromycin from Kalamassery PHC (Ernakulam)
INSERT INTO public.redistribution_requests (requesting_center_id, supplying_center_id, medicine_id, quantity, status, requested_by)
VALUES
  ('c1d20000-0000-0000-0000-000000000001', 'ce110000-0000-0000-0000-000000000001', 'd1200000-0000-0000-0000-000000000002', 200, 'pending', 'aa000000-0000-0000-0000-000000000004')
ON CONFLICT DO NOTHING;
