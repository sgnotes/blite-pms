-- ============================================================
-- BLITE PMS — Full Database Schema
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE room_status AS ENUM ('vacant', 'occupied', 'maintenance');
CREATE TYPE gender_preference AS ENUM ('male', 'female', 'any');
CREATE TYPE meal_plan AS ENUM ('none', 'breakfast', 'two_meals', 'three_meals');
CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'overdue', 'partial', 'waived');
CREATE TYPE payment_method AS ENUM ('upi', 'cash', 'bank_transfer', 'razorpay', 'cheque');
CREATE TYPE ticket_status AS ENUM ('open', 'in_progress', 'resolved', 'closed');
CREATE TYPE ticket_priority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE deed_status AS ENUM ('draft', 'sent', 'signed', 'expired');
CREATE TYPE kyc_status AS ENUM ('pending', 'submitted', 'verified', 'rejected');
CREATE TYPE tenant_status AS ENUM ('active', 'notice_period', 'vacated');

-- ============================================================
-- PROFILES (extends Supabase auth.users)
-- ============================================================

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'manager', 'staff')),
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PROPERTIES
-- ============================================================

CREATE TABLE properties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                     -- e.g. "Blite Sector 57 Block A"
  address TEXT NOT NULL,
  city TEXT NOT NULL DEFAULT 'Gurgaon',
  state TEXT NOT NULL DEFAULT 'Haryana',
  pincode TEXT,
  gstin TEXT,                             -- GST number if registered
  pan TEXT,
  total_rooms INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ROOMS
-- ============================================================

CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  room_number TEXT NOT NULL,              -- e.g. "101", "G-02"
  floor INT DEFAULT 0,
  capacity INT NOT NULL DEFAULT 1,        -- beds in room
  occupied_beds INT DEFAULT 0,
  room_type TEXT DEFAULT 'single',        -- single, double, triple, dormitory
  gender_preference gender_preference DEFAULT 'any',
  meal_plan meal_plan DEFAULT 'none',
  base_rent NUMERIC(10,2) NOT NULL,
  security_deposit NUMERIC(10,2) DEFAULT 0,
  amenities TEXT[] DEFAULT '{}',          -- ['ac', 'wifi', 'attached_bath']
  status room_status DEFAULT 'vacant',
  photos TEXT[] DEFAULT '{}',             -- Supabase storage URLs
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(property_id, room_number)
);

-- ============================================================
-- TENANTS
-- ============================================================

CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES rooms(id),
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  date_of_birth DATE,
  gender TEXT CHECK (gender IN ('male', 'female', 'other')),

  -- Address
  permanent_address TEXT,
  home_city TEXT,
  home_state TEXT,

  -- Work/Study
  occupation TEXT,                        -- 'working', 'student'
  company_or_college TEXT,
  employee_id TEXT,

  -- Emergency contact
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  emergency_contact_relation TEXT,

  -- Stay details
  check_in_date DATE NOT NULL,
  check_out_date DATE,
  expected_stay_months INT DEFAULT 12,
  rent_amount NUMERIC(10,2) NOT NULL,
  security_deposit_paid NUMERIC(10,2) DEFAULT 0,
  rent_due_day INT DEFAULT 1 CHECK (rent_due_day BETWEEN 1 AND 28),
  meal_plan meal_plan DEFAULT 'none',

  -- Status
  status tenant_status DEFAULT 'active',
  kyc_status kyc_status DEFAULT 'pending',
  notice_given_date DATE,

  -- Meta
  notes TEXT,
  added_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- KYC DOCUMENTS
-- ============================================================

CREATE TABLE kyc_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL CHECK (doc_type IN (
    'aadhaar_front', 'aadhaar_back', 'pan_card',
    'passport', 'driving_license', 'voter_id',
    'company_id', 'student_id', 'police_verification', 'photo'
  )),
  file_url TEXT NOT NULL,                 -- Supabase storage URL
  file_name TEXT,
  is_verified BOOLEAN DEFAULT FALSE,
  verified_by UUID REFERENCES profiles(id),
  verified_at TIMESTAMPTZ,
  notes TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- RENT LEDGER (payment tracking)
-- ============================================================

CREATE TABLE rent_ledger (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id),
  room_id UUID NOT NULL REFERENCES rooms(id),

  -- Billing period
  billing_month INT NOT NULL CHECK (billing_month BETWEEN 1 AND 12),
  billing_year INT NOT NULL,
  due_date DATE NOT NULL,

  -- Amounts
  rent_amount NUMERIC(10,2) NOT NULL,
  meal_charges NUMERIC(10,2) DEFAULT 0,
  electricity_charges NUMERIC(10,2) DEFAULT 0,
  water_charges NUMERIC(10,2) DEFAULT 0,
  other_charges NUMERIC(10,2) DEFAULT 0,
  discount NUMERIC(10,2) DEFAULT 0,
  total_due NUMERIC(10,2) GENERATED ALWAYS AS (
    rent_amount + meal_charges + electricity_charges +
    water_charges + other_charges - discount
  ) STORED,

  -- Payment
  amount_paid NUMERIC(10,2) DEFAULT 0,
  payment_status payment_status DEFAULT 'pending',
  payment_method payment_method,
  payment_date DATE,
  transaction_id TEXT,                    -- Razorpay payment ID
  razorpay_order_id TEXT,
  receipt_url TEXT,

  -- Late fee
  late_fee NUMERIC(10,2) DEFAULT 0,
  late_fee_applied_at TIMESTAMPTZ,

  notes TEXT,
  recorded_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(tenant_id, billing_month, billing_year)
);

-- ============================================================
-- RENT DEEDS
-- ============================================================

CREATE TABLE rent_deeds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id),
  room_id UUID NOT NULL REFERENCES rooms(id),

  -- Agreement details
  deed_number TEXT UNIQUE,               -- e.g. BLITE/2025/001
  agreement_start DATE NOT NULL,
  agreement_end DATE NOT NULL,
  monthly_rent NUMERIC(10,2) NOT NULL,
  security_deposit NUMERIC(10,2) DEFAULT 0,
  notice_period_days INT DEFAULT 30,
  lock_in_months INT DEFAULT 0,

  -- Template & PDF
  template_version TEXT DEFAULT 'v1',
  pdf_url TEXT,                          -- generated PDF in Supabase storage
  deed_html TEXT,                        -- snapshot of deed HTML

  -- e-Sign (Leegality)
  leegality_document_id TEXT,
  leegality_invite_url TEXT,
  status deed_status DEFAULT 'draft',
  owner_signed_at TIMESTAMPTZ,
  tenant_signed_at TIMESTAMPTZ,
  signed_pdf_url TEXT,

  -- Meta
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- MAINTENANCE TICKETS
-- ============================================================

CREATE TABLE maintenance_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  room_id UUID REFERENCES rooms(id),
  tenant_id UUID REFERENCES tenants(id),

  title TEXT NOT NULL,
  description TEXT,
  category TEXT CHECK (category IN (
    'plumbing', 'electrical', 'appliance',
    'furniture', 'cleaning', 'internet', 'ac', 'other'
  )),
  priority ticket_priority DEFAULT 'medium',
  status ticket_status DEFAULT 'open',

  -- Photos
  photos TEXT[] DEFAULT '{}',

  -- Resolution
  assigned_to TEXT,                      -- name of vendor / staff
  assigned_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  repair_cost NUMERIC(10,2),

  -- Meta
  raised_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- NOTIFICATIONS LOG
-- ============================================================

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID REFERENCES properties(id),
  tenant_id UUID REFERENCES tenants(id),
  type TEXT NOT NULL CHECK (type IN (
    'rent_reminder', 'rent_received', 'deed_sent',
    'deed_signed', 'ticket_update', 'kyc_verified', 'custom'
  )),
  channel TEXT CHECK (channel IN ('whatsapp', 'sms', 'email', 'in_app')),
  message TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  delivered BOOLEAN DEFAULT FALSE,
  error TEXT
);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE kyc_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE rent_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE rent_deeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Profiles: users can see and edit their own profile
CREATE POLICY "profiles_own" ON profiles
  FOR ALL USING (auth.uid() = id);

-- Properties: owner can do everything with their properties
CREATE POLICY "properties_owner" ON properties
  FOR ALL USING (owner_id = auth.uid());

-- Rooms: accessible if you own the parent property
CREATE POLICY "rooms_owner" ON rooms
  FOR ALL USING (
    property_id IN (SELECT id FROM properties WHERE owner_id = auth.uid())
  );

-- Tenants: accessible if you own the parent property
CREATE POLICY "tenants_owner" ON tenants
  FOR ALL USING (
    property_id IN (SELECT id FROM properties WHERE owner_id = auth.uid())
  );

-- KYC: accessible if you own the tenant's property
CREATE POLICY "kyc_owner" ON kyc_documents
  FOR ALL USING (
    tenant_id IN (
      SELECT t.id FROM tenants t
      JOIN properties p ON p.id = t.property_id
      WHERE p.owner_id = auth.uid()
    )
  );

-- Rent ledger: accessible if you own the property
CREATE POLICY "rent_ledger_owner" ON rent_ledger
  FOR ALL USING (
    property_id IN (SELECT id FROM properties WHERE owner_id = auth.uid())
  );

-- Rent deeds: accessible if you own the property
CREATE POLICY "rent_deeds_owner" ON rent_deeds
  FOR ALL USING (
    property_id IN (SELECT id FROM properties WHERE owner_id = auth.uid())
  );

-- Maintenance: accessible if you own the property
CREATE POLICY "maintenance_owner" ON maintenance_tickets
  FOR ALL USING (
    property_id IN (SELECT id FROM properties WHERE owner_id = auth.uid())
  );

-- Notifications: accessible if you own the property
CREATE POLICY "notifications_owner" ON notifications
  FOR ALL USING (
    property_id IN (SELECT id FROM properties WHERE owner_id = auth.uid())
  );

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Owner'),
    NEW.raw_user_meta_data->>'phone'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Auto-update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_properties_updated BEFORE UPDATE ON properties FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_rooms_updated      BEFORE UPDATE ON rooms      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_tenants_updated    BEFORE UPDATE ON tenants    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_rent_ledger_updated BEFORE UPDATE ON rent_ledger FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_rent_deeds_updated BEFORE UPDATE ON rent_deeds FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_maintenance_updated BEFORE UPDATE ON maintenance_tickets FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-update room occupancy when tenant changes
CREATE OR REPLACE FUNCTION sync_room_occupancy()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE rooms SET
    occupied_beds = (
      SELECT COUNT(*) FROM tenants
      WHERE room_id = COALESCE(NEW.room_id, OLD.room_id)
      AND status = 'active'
    ),
    status = CASE
      WHEN (SELECT COUNT(*) FROM tenants WHERE room_id = COALESCE(NEW.room_id, OLD.room_id) AND status = 'active') = 0 THEN 'vacant'::room_status
      ELSE 'occupied'::room_status
    END
  WHERE id = COALESCE(NEW.room_id, OLD.room_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_tenant_room_sync
  AFTER INSERT OR UPDATE OR DELETE ON tenants
  FOR EACH ROW EXECUTE FUNCTION sync_room_occupancy();

-- Auto-generate deed number
CREATE OR REPLACE FUNCTION generate_deed_number()
RETURNS TRIGGER AS $$
DECLARE
  prop_name TEXT;
  seq INT;
BEGIN
  SELECT UPPER(SUBSTRING(name, 1, 5)) INTO prop_name FROM properties WHERE id = NEW.property_id;
  SELECT COALESCE(MAX(CAST(SUBSTRING(deed_number FROM '\d+$') AS INT)), 0) + 1
    INTO seq FROM rent_deeds WHERE property_id = NEW.property_id;
  NEW.deed_number := prop_name || '/' || EXTRACT(YEAR FROM NOW()) || '/' || LPAD(seq::TEXT, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_deed_number
  BEFORE INSERT ON rent_deeds
  FOR EACH ROW WHEN (NEW.deed_number IS NULL)
  EXECUTE FUNCTION generate_deed_number();

-- ============================================================
-- STORAGE BUCKETS (run separately in Supabase Dashboard)
-- ============================================================
-- Create these buckets in Supabase Dashboard > Storage:
--   1. kyc-documents   (private)
--   2. rent-deeds      (private)
--   3. maintenance     (private)
--   4. room-photos     (public)

-- ============================================================
-- INDEXES for performance
-- ============================================================

CREATE INDEX idx_rooms_property ON rooms(property_id);
CREATE INDEX idx_rooms_status ON rooms(status);
CREATE INDEX idx_tenants_property ON tenants(property_id);
CREATE INDEX idx_tenants_room ON tenants(room_id);
CREATE INDEX idx_tenants_status ON tenants(status);
CREATE INDEX idx_rent_ledger_tenant ON rent_ledger(tenant_id);
CREATE INDEX idx_rent_ledger_status ON rent_ledger(payment_status);
CREATE INDEX idx_rent_ledger_month ON rent_ledger(billing_year, billing_month);
CREATE INDEX idx_maintenance_property ON maintenance_tickets(property_id);
CREATE INDEX idx_maintenance_status ON maintenance_tickets(status);
CREATE INDEX idx_deeds_tenant ON rent_deeds(tenant_id);
CREATE INDEX idx_kyc_tenant ON kyc_documents(tenant_id);
