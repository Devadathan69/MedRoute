-- public_portal.sql
-- Run this snippet in your Supabase SQL Editor.
-- This creates a highly secure Read-Only RPC function allowing unauthenticated citizens
-- to perform geographic searches against the inventory WITHOUT exposing exact stock numbers 
-- or breaching Row-Level Security.

CREATE OR REPLACE FUNCTION search_public_medicine(search_term text, user_lat double precision, user_lon double precision)
RETURNS TABLE(
  center_id uuid, center_name text, district text, state text, 
  latitude double precision, longitude double precision, 
  distance_km double precision, stock_status text
) AS $$
BEGIN
  RETURN QUERY
  WITH matching_meds AS (
    SELECT id FROM medicines WHERE name ILIKE '%' || search_term || '%'
  ),
  aggregated_inv AS (
    SELECT i.center_id, SUM(i.quantity_available) as total_qty
    FROM inventory i
    JOIN matching_meds m ON m.id = i.medicine_id
    GROUP BY i.center_id
    HAVING SUM(i.quantity_available) > 0
  )
  SELECT 
    pc.id, pc.name, pc.district, pc.state, pc.latitude, pc.longitude,
    (ST_DistanceSphere(
      ST_SetSRID(ST_MakePoint(pc.longitude, pc.latitude), 4326)::geometry,
      ST_SetSRID(ST_MakePoint(user_lon, user_lat), 4326)::geometry
    ) / 1000.0)::double precision AS distance_km,
    CASE 
      WHEN a.total_qty > 50 THEN 'High Stock' 
      WHEN a.total_qty > 10 THEN 'Adequate' 
      ELSE 'Low Stock' 
    END AS stock_status
  FROM phc_centers pc
  JOIN aggregated_inv a ON a.center_id = pc.id
  ORDER BY distance_km ASC
  LIMIT 5;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Explicitly expose this capability to the public, unauthenticated web clients
GRANT EXECUTE ON FUNCTION search_public_medicine(text, double precision, double precision) TO anon;
GRANT EXECUTE ON FUNCTION search_public_medicine(text, double precision, double precision) TO authenticated;
