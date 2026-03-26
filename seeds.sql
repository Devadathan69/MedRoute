-- seeds.sql
-- Sample data for MedRoute. Run after schema.sql in Supabase SQL Editor.

-- Insert sample PHC centers
INSERT INTO phc_centers (id, name, district, state, latitude, longitude, contact, in_charge_name)
VALUES
  (uuid_generate_v4(), 'PHC A - Kalyan', 'Kalyan', 'Maharashtra', 19.2385, 73.1308, '022-0000001', 'Dr. A'),
  (uuid_generate_v4(), 'PHC B - Taloja', 'Kalyan', 'Maharashtra', 19.0500, 73.0000, '022-0000002', 'Dr. B'),
  (uuid_generate_v4(), 'PHC C - Dombivli', 'Kalyan', 'Maharashtra', 19.2167, 73.0887, '022-0000003', 'Dr. C');

-- Insert sample medicines
INSERT INTO medicines (id, name, category, unit, min_stock_threshold, standard_dosage, unit_price)
VALUES
  (uuid_generate_v4(), 'Paracetamol 500mg', 'Analgesic', 'tablet', 50, '500mg every 4-6h', 1.50),
  (uuid_generate_v4(), 'Amoxicillin 250mg', 'Antibiotic', 'capsule', 30, '250mg thrice daily', 2.75),
  (uuid_generate_v4(), 'ORS sachet', 'ORS', 'sachet', 100, '1 sachet per sachet package', 5.00);

-- Insert inventory (associate medicines to centers)
INSERT INTO inventory (center_id, medicine_id, quantity_available, expiry_date, batch_number)
SELECT pc.id, m.id, CASE WHEN pc.name LIKE '%A%' THEN 80 WHEN pc.name LIKE '%B%' THEN 10 ELSE 0 END, (now()::date + INTERVAL '25 days')::date, 'BATCH-001'
FROM phc_centers pc CROSS JOIN medicines m WHERE m.name = 'Paracetamol 500mg';

INSERT INTO inventory (center_id, medicine_id, quantity_available, expiry_date, batch_number)
SELECT pc.id, m.id, CASE WHEN pc.name LIKE '%A%' THEN 5 WHEN pc.name LIKE '%B%' THEN 50 ELSE 10 END, (now()::date + INTERVAL '90 days')::date, 'BATCH-002'
FROM phc_centers pc CROSS JOIN medicines m WHERE m.name = 'Amoxicillin 250mg';

INSERT INTO inventory (center_id, medicine_id, quantity_available, expiry_date, batch_number)
SELECT pc.id, m.id, 120, (now()::date + INTERVAL '15 days')::date, 'BATCH-003'
FROM phc_centers pc CROSS JOIN medicines m WHERE m.name = 'ORS sachet' AND pc.name LIKE '%B%';

-- Insert placeholder user_profiles (replace ids with actual auth.uids)
INSERT INTO user_profiles (id, email, role, center_id, district)
VALUES
  (uuid_generate_v4(), 'phc.staff@example.com', 'phc_staff', (SELECT id FROM phc_centers LIMIT 1), 'Kalyan'),
  (uuid_generate_v4(), 'district.officer@example.com', 'district_officer', NULL, 'Kalyan'),
  (uuid_generate_v4(), 'state.admin@example.com', 'state_admin', NULL, 'Maharashtra');

-- Note: Replace the generated uuids in user_profiles with the real auth.uid() values after creating users in Supabase Auth.
