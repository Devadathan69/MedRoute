# MedRoute

MedRoute — Intelligent Rural Medicine Expiry and Redistribution Management System.

Quick start

1. Copy `schema.sql` into Supabase SQL editor and run.
2. Create a `.env` file from `.env.example` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
	- Example: create `.env` at project root with the values.
3. (Optional) Run `seeds.sql` in Supabase SQL editor to populate sample data.
3. Install and run locally:

```bash
npm install
npm run dev
```

Notes
- Ensure Supabase Auth JWT contains `role` and `center_id` (or district) claims for RLS.
- Replace Supabase keys before running.
 - Alternatively use the `user_profiles` table: after creating Auth users, insert rows into `user_profiles` mapping `id = auth.uid()` to `role` and `center_id`.
