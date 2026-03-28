# 🏠 Blite PMS — Property Management System

Full-stack PG management portal for Blite Sector 57, Gurgaon.

**Stack:** React 18 + Vite · Node.js + Express · Supabase (Postgres, Auth, Storage) · Razorpay · Leegality

---

## What's built

| Module | Frontend page | Backend route | Status |
|--------|--------------|---------------|--------|
| Auth | Login.jsx | Supabase Auth | ✅ |
| Dashboard | Dashboard.jsx | /api/dashboard/summary | ✅ |
| Tenants | Tenants.jsx, TenantDetail.jsx | /api/tenants | ✅ |
| Rooms | Rooms.jsx | /api/rooms | ✅ |
| Payments | Payments.jsx | /api/payments | ✅ |
| Maintenance | Maintenance.jsx | /api/maintenance | ✅ |
| Rent Deeds | RentDeeds.jsx | /api/rent-deeds | ✅ |
| KYC Upload | TenantDetail.jsx | Supabase Storage | ✅ |
| Razorpay | Payments.jsx | /api/payments/create-order | ✅ |
| PDF Generation | RentDeeds.jsx | /api/rent-deeds/:id/generate-pdf | ✅ |
| Leegality e-Sign | RentDeeds.jsx | /api/rent-deeds/:id/send-for-sign | ✅ |

---

## Setup (step by step)

### 1. Supabase
1. Create project at supabase.com (region: ap-south-1 Mumbai)
2. SQL Editor → paste + run `supabase/migrations/001_initial_schema.sql`
3. Storage → create 4 buckets: `kyc-documents` (private), `rent-deeds` (private), `maintenance` (private), `room-photos` (public)
4. Settings → API → copy Project URL, anon key, service_role key

### 2. Environment files
```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Fill in `backend/.env`:
```
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
LEEGALITY_API_TOKEN=...
LEEGALITY_BASE_URL=https://sandbox.leegality.com/api/v3.0
```

Fill in `frontend/.env`:
```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_API_BASE_URL=http://localhost:3001/api
VITE_RAZORPAY_KEY_ID=rzp_test_...
```

### 3. Install and run
```bash
# Install all dependencies
cd backend && npm install
cd ../frontend && npm install

# Run backend (terminal 1)
cd backend && npm run dev
# → API running on http://localhost:3001

# Run frontend (terminal 2)
cd frontend && npm run dev
# → App running on http://localhost:5173
```

### 4. First login
- Open http://localhost:5173
- Click "Sign up" → create your owner account
- You'll be auto-redirected to the dashboard
- Run seed SQL (002_seed_data.sql) to populate sample data

---

## Razorpay setup
1. Dashboard → Settings → API Keys → copy Test keys
2. Add to backend/.env
3. For webhooks: Razorpay Dashboard → Webhooks → `https://yourdomain.com/api/payments/webhook`

## Leegality setup
1. Sign up at leegality.com → get sandbox API token
2. Add `LEEGALITY_API_TOKEN` to backend/.env
3. Webhook URL for signed documents: `https://yourdomain.com/api/rent-deeds/webhook/leegality`

## PDF generation (Puppeteer)
- Puppeteer is installed with backend dependencies
- On Linux servers, may need: `apt-get install -y chromium-browser`
- Or set `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser` in .env

---

## Database tables
```
properties → rooms → tenants → kyc_documents
                            → rent_ledger
                            → rent_deeds
maintenance_tickets
notifications
```

## API endpoints
```
GET  /api/dashboard/summary?property_id=
GET  /api/tenants?property_id=&status=
POST /api/tenants
GET  /api/tenants/:id
PATCH /api/tenants/:id
POST /api/tenants/:id/kyc
GET  /api/rooms?property_id=
POST /api/rooms
GET  /api/payments/ledger?property_id=&month=&year=
POST /api/payments/create-order
POST /api/payments/verify
POST /api/payments/record-manual
POST /api/payments/generate-ledger
GET  /api/maintenance?property_id=
POST /api/maintenance
PATCH /api/maintenance/:id
GET  /api/rent-deeds?property_id=
POST /api/rent-deeds
POST /api/rent-deeds/:id/generate-pdf
POST /api/rent-deeds/:id/send-for-sign
POST /api/rent-deeds/webhook/leegality
```
