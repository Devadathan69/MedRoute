import fs from 'fs'
import { createClient } from '@supabase/supabase-js'

const envText = fs.readFileSync('.env', 'utf-8')
const SUPABASE_URL = envText.match(/VITE_SUPABASE_URL=(.*)/)[1].trim()
const SUPABASE_KEY = envText.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim()

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function seed() {
  console.log("Starting DB Seeder...")

  // 1. Create PHC Centers
  const centersToInsert = [
    { name: 'City Hospital PHC', district: 'Downtown', state: 'Metro', latitude: 19.123, longitude: 72.85, contact: '1234567890', in_charge_name: 'Dr. Smith' },
    { name: 'Rural Block PHC', district: 'Uptown', state: 'Metro', latitude: 19.345, longitude: 72.95, contact: '0987654321', in_charge_name: 'Dr. John' }
  ]
  
  let centerIds = []
  for (const c of centersToInsert) {
    const { data: existing } = await supabase.from('phc_centers').select('id').eq('name', c.name).single()
    if (existing) {
      centerIds.push(existing.id)
    } else {
      const { data, error } = await supabase.from('phc_centers').insert(c).select('id').single()
      if (error) console.error("Error creating center:", error.message)
      else centerIds.push(data.id)
    }
  }

  // 2. Create Medicines
  const medicinesToInsert = [
    { name: 'Paracetamol 500mg', category: 'Analgesic', unit: 'Tablet', min_stock_threshold: 100, unit_price: 2 },
    { name: 'Amoxicillin 250mg', category: 'Antibiotic', unit: 'Capsule', min_stock_threshold: 50, unit_price: 5 },
    { name: 'Cough Syrup 100ml', category: 'Syrup', unit: 'Bottle', min_stock_threshold: 20, unit_price: 45 }
  ]

  let medIds = []
  for (const m of medicinesToInsert) {
    const { data: existing } = await supabase.from('medicines').select('id').eq('name', m.name).single()
    if (existing) {
      medIds.push({ id: existing.id, name: m.name })
    } else {
      const { data, error } = await supabase.from('medicines').insert(m).select('id, name').single()
      if (error) console.error("Error creating medicine:", error.message)
      else medIds.push(data)
    }
  }

  // 3. Create Users
  const usersToCreate = [
    { email: 'admin@medroute.com', password: 'password123', role: 'state_admin', center_id: null },
    { email: 'district@medroute.com', password: 'password123', role: 'district_officer', center_id: null },
    { email: 'staff1@medroute.com', password: 'password123', role: 'phc_staff', center_id: centerIds[0] },
    { email: 'staff2@medroute.com', password: 'password123', role: 'phc_staff', center_id: centerIds[1] }
  ]

  for (const u of usersToCreate) {
    // Attempt sign up
    const { data, error } = await supabase.auth.signUp({
      email: u.email,
      password: u.password
    })
    
    // If it says user exists, we can't easily get the ID to insert into user_profiles here with just anon key, 
    // but sign up will return data.user if it succeeds.
    if (error) {
      console.log(`User ${u.email} might already exist or error:`, error.message)
    } else if (data?.user) {
      console.log(`User created: ${u.email}`)
      // Insert profile
      await supabase.from('user_profiles').upsert({
        id: data.user.id,
        email: u.email,
        role: u.role,
        center_id: u.center_id
      })
    }
  }

  // 4. Create Inventory for centers
  if (centerIds.length > 0 && medIds.length > 0) {
    const expiryDate1 = new Date(); expiryDate1.setDate(expiryDate1.getDate() + 25) // expiring soon
    const expiryDate2 = new Date(); expiryDate2.setDate(expiryDate2.getDate() + 150) // good

    await supabase.from('inventory').upsert([
      { center_id: centerIds[0], medicine_id: medIds[0].id, quantity_available: 50, batch_number: 'B1-001', expiry_date: expiryDate1.toISOString().split('T')[0] },
      { center_id: centerIds[0], medicine_id: medIds[1].id, quantity_available: 200, batch_number: 'B1-002', expiry_date: expiryDate2.toISOString().split('T')[0] },
      { center_id: centerIds[1], medicine_id: medIds[0].id, quantity_available: 300, batch_number: 'C2-001', expiry_date: expiryDate2.toISOString().split('T')[0] },
      { center_id: centerIds[1], medicine_id: medIds[2].id, quantity_available: 5, batch_number: 'C2-002', expiry_date: expiryDate1.toISOString().split('T')[0] }
    ], { onConflict: 'center_id, medicine_id, batch_number' })

    console.log("Inventory seeded.")
  }

  console.log("Seeding complete!")
}

seed()
