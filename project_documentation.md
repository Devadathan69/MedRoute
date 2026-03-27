# MedRoute: Project Implementation & Architecture Guide
*This document serves as a comprehensive description of the MedRoute project, from the UI layers down to the lowest database triggers. Use this to guide your presentation.*

---

## 1. Project Overview
**MedRoute** is a modern, role-based geographic inventory management system designed to eliminate medicine wastage and resolve local shortages across Primary Health Centers (PHCs). By connecting isolated clinics into a responsive network, MedRoute allows centers facing critical shortages to instantly locate surplus stock in nearby centers and request redistributions.

### Core Tech Stack
*   **Frontend**: React.js (via Vite), React Router for role-based navigation.
*   **UI/UX**: Custom premium Vanilla CSS featuring a state-of-the-art Glassmorphism design system, smooth micro-animations, and dynamic data tables.
*   **Backend & Auth**: Supabase (PostgreSQL serverless backend) providing JWT authentication, REST APIs, and Realtime capabilities.
*   **Special Integrations**: Leaflet/React-Leaflet for mapping, Chart.js for analytics, PostGIS for geospatial math.

---

## 2. Database Architecture (Supabase / PostgreSQL)
The backend is deeply relational and heavily relies on database automation to prevent frontend race conditions. 

### Core Tables
1.  **`phc_centers`**: The physical health clinics. Contains geographic locations (`latitude`, `longitude`) mapped to PostGIS geometry points for distance calculations.
2.  **`medicines`**: The master registry/catalog of all drugs, holding standard units, prices, and `min_stock_threshold` limits.
3.  **`user_profiles`**: Maps authenticated users (via their `auth.uid`) to a specific role (`state_admin`, `district_officer`, `phc_staff`) and ties staff to a specific `center_id`.
4.  **`inventory`**: The heart of the system. Maps `center_id` to `medicine_id` across specific `batch_number`s, keeping track of `quantity_available` and `expiry_date`.
5.  **`redistribution_requests`**: Logs a pending request representing the desire to move a medicine from a `supplying_center_id` to a `requesting_center_id`.
6.  **`transfer_logs`**: Permanent audit trails that log the financial and logistical history of completed transfers.
7.  **`shortage_flags`**: Alerts indicating when a center is dangerously low on stock or holding expiring goods.

### Backend Automation (Triggers & RPCs)
To keep the frontend fast and secure, complex logic is offloaded to the database:
*   **`trg_inventory_flag` (Trigger)**: Whenever inventory is logged or updated, the database automatically checks the new quantity against the medicine's `min_stock_threshold`. If it's too low, or if the `expiry_date` is under 30 days away, the database autonomously creates a rapid alert in `shortage_flags`.
*   **`trg_redistribution_approved` (Trigger)**: When a request is marked as 'approved', the database autonomously deducts the stock from the supplier's inventory table and issues a secure `transfer_log` receipt.
*   **`nearest_surplus_phcs` (RPC Function)**: An advanced Remote Procedure Call using PostGIS. It takes the requesting PHC's coordinates, scans every other PHC in the state, aggregates their inventory for the requested medicine, and uses `ST_DistanceSphere` to calculate the exact distance in kilometers, returning an ordered list of closest surviving centers.

---

## 3. Dashboard Features & Application Flow

### Authentication & Routing
When a user logs in, the [App.jsx](file:///d:/Project/Micro%20Project/DBMS/src/App.jsx) router pulls their `user_profile` to enforce strict Role-Based Access Control (RBAC). State Admins see holistic charts and macro-management tables, while PHC staff see only their clinic's localized inventory logic.

### 1. PHC Dashboard ([PHCDashboard.jsx](file:///d:/Project/Micro%20Project/DBMS/src/pages/PHCDashboard.jsx))
*   **What you see**: A personalized command center for the login clinic.
*   **Features**: Displays aggregated statistics (Total Medicines, Expiry Alerts). It houses the **Expiring Soon** table and the **My Outgoing Requests** table. 
*   **Under the hood**: Executes multiple parallel queries to `shortage_flags` and `expiring_soon` (a custom SQL View) filtered natively by the logged-in user's `center_id`.

### 2. Log Inventory ([LogInventory.jsx](file:///d:/Project/Micro%20Project/DBMS/src/pages/LogInventory.jsx))
*   **What you see**: A dual-pane interface to quickly log new drug shipments alongside a live chronological table of all current stock.
*   **What happens when you click "Save Inventory"**: 
    1. The frontend packages the data and fires an `upsert` query to Supabase. 
    2. Supabase checks if that exact batch exists for that PHC; if it does, it adds the quantities together. If not, it creates a new row.
    3. The `trg_inventory_flag` backend trigger quietly evaluates if this new stock clears any existing shortage flags and auto-resolves them if true.

### 3. Redistribution Finder ([RedistributionFinder.jsx](file:///d:/Project/Micro%20Project/DBMS/src/pages/RedistributionFinder.jsx))
*   **What you see**: A geographic search engine and interactive Leaflet map.
*   **What happens when you click "Find Match"**: 
    1. The frontend hits the `nearest_surplus_phcs` database RPC. 
    2. The database performs heavy spherical math to locate PHCs radiating outward from your clinic that hold an abundance of the required medicine.
    3. The map dynamically plots markers identifying the exact distance to backup clinics.
*   **What happens when you click "Request"**: The frontend inserts a new row into the `redistribution_requests` table with a status of `pending`.

### 4. Transfer Approvals
*   **What you see**: An inbox for PHC Officers (and District Admins) to review incoming medicine requests from other clinics.
*   **What happens when you click "Approve"**: 
    1. An [update](file:///d:/Project/Micro%20Project/DBMS/src/pages/DistrictApproval.jsx#43-49) query sets the request status to `approved`.
    2. Supabase intercepts this update using its trigger system.
    3. Without writing any extra React code, the database finds the oldest expiring batch of that medicine at the supplying PHC, deducts the specified quantity, and writes the timestamped historical audit to `transfer_logs`.

### 5. Analytics & Reports ([AnalyticsDashboard.jsx](file:///d:/Project/Micro%20Project/DBMS/src/pages/AnalyticsDashboard.jsx))
*   **What you see**: High-level statistical charts built on Chart.js.
*   **Features**: Uses the `transfer_logs` historical data to calculate exactly how much money has been saved preventing waste (Waste Prevented metric) and visualizes the top 10 medicines expiring statewide to facilitate proactive distribution before spoilage occurs.

### 6. State Admin Pages
Specialized management tables solely accessible to administrators to scale the network:
*   **State Admin Dashboard**: Ranks `phcs_chronic_shortage` to identify systemic supply chain failures and visually exposes them.
*   **Manage PHCs / Medicines**: Admin forms explicitly designed to expand the master catalog (`medicines` table) and map geographic expansion (`phc_centers`). All guarded tightly by Supabase JWT internal Row Level Security logic preventing non-admins from mutating the data.
