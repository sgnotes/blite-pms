-- ============================================================
-- BLITE PMS — Seed Data (Dev / Testing)
-- Run AFTER 001_initial_schema.sql
-- Replace <YOUR_USER_UUID> with your Supabase auth user ID
-- ============================================================

-- Insert your profile (if not auto-created by trigger)
-- UPDATE profiles SET full_name = 'Your Name', phone = '9999999999'
-- WHERE id = '<YOUR_USER_UUID>';

-- ============================================================
-- SAMPLE PROPERTY — Blite Sector 57, Gurgaon
-- ============================================================

INSERT INTO properties (id, owner_id, name, address, city, state, pincode)
VALUES (
  'aaaaaaaa-0000-0000-0000-000000000001',
  (SELECT id FROM profiles LIMIT 1),   -- replace with real owner UUID in prod
  'Blite Sector 57',
  'Plot No 12, Sector 57, Near IFFCO Chowk',
  'Gurgaon',
  'Haryana',
  '122011'
);

-- ============================================================
-- SAMPLE ROOMS
-- ============================================================

INSERT INTO rooms (property_id, room_number, floor, capacity, room_type, gender_preference, meal_plan, base_rent, security_deposit, amenities, status)
VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', '101', 1, 1, 'single', 'male', 'none', 12000, 24000, ARRAY['wifi','ac','attached_bath'], 'occupied'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '102', 1, 2, 'double', 'male', 'two_meals', 8500, 17000, ARRAY['wifi','attached_bath'], 'occupied'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '103', 1, 1, 'single', 'female', 'none', 11000, 22000, ARRAY['wifi','ac'], 'vacant'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '201', 2, 1, 'single', 'male', 'none', 13000, 26000, ARRAY['wifi','ac','attached_bath','tv'], 'occupied'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '202', 2, 3, 'triple', 'male', 'three_meals', 7000, 14000, ARRAY['wifi'], 'occupied'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '203', 2, 1, 'single', 'any', 'none', 10500, 21000, ARRAY['wifi','ac'], 'vacant'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '301', 3, 2, 'double', 'female', 'breakfast', 9000, 18000, ARRAY['wifi','ac','attached_bath'], 'occupied'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '302', 3, 1, 'single', 'male', 'none', 12500, 25000, ARRAY['wifi','ac','balcony'], 'occupied');

-- ============================================================
-- SAMPLE TENANTS
-- ============================================================

INSERT INTO tenants (
  property_id, room_id, full_name, phone, email,
  gender, occupation, company_or_college,
  check_in_date, rent_amount, security_deposit_paid,
  rent_due_day, meal_plan, status, kyc_status
)
SELECT
  'aaaaaaaa-0000-0000-0000-000000000001',
  r.id, t.full_name, t.phone, t.email,
  t.gender, t.occupation, t.company,
  t.check_in::DATE, t.rent, t.deposit,
  1, t.meal::meal_plan, 'active', 'verified'
FROM (VALUES
  ('101', 'Amit Sharma',    '9811234567', 'amit@example.com',   'male',   'working', 'Infosys',      '2024-09-01', 12000, 24000, 'none'),
  ('102', 'Rahul Verma',    '9822345678', 'rahul@example.com',  'male',   'working', 'Wipro',        '2024-10-15', 8500,  17000, 'two_meals'),
  ('102', 'Suresh Kumar',   '9833456789', 'suresh@example.com', 'male',   'student', 'MDU Rohtak',   '2024-11-01', 8500,  17000, 'two_meals'),
  ('201', 'Priya Nair',     '9844567890', 'priya@example.com',  'female', 'working', 'Accenture',    '2024-08-01', 13000, 26000, 'none'),
  ('202', 'Vikas Singh',    '9855678901', 'vikas@example.com',  'male',   'working', 'HCL Tech',     '2025-01-01', 7000,  14000, 'three_meals'),
  ('202', 'Deepak Yadav',   '9866789012', 'deepak@example.com', 'male',   'student', 'GD Goenka',    '2025-01-01', 7000,  14000, 'three_meals'),
  ('301', 'Sneha Gupta',    '9877890123', 'sneha@example.com',  'female', 'working', 'Genpact',      '2024-12-01', 9000,  18000, 'breakfast'),
  ('302', 'Arjun Mehta',    '9888901234', 'arjun@example.com',  'male',   'working', 'Deloitte',     '2025-02-01', 12500, 25000, 'none')
) AS t(room_num, full_name, phone, email, gender, occupation, company, check_in, rent, deposit, meal)
JOIN rooms r ON r.room_number = t.room_num
  AND r.property_id = 'aaaaaaaa-0000-0000-0000-000000000001';

-- ============================================================
-- SAMPLE RENT LEDGER (last 2 months)
-- ============================================================

INSERT INTO rent_ledger (
  tenant_id, property_id, room_id,
  billing_month, billing_year, due_date,
  rent_amount, amount_paid, payment_status, payment_method, payment_date
)
SELECT
  t.id, t.property_id, t.room_id,
  2, 2025, '2025-02-01'::DATE,
  t.rent_amount,
  CASE WHEN t.full_name IN ('Amit Sharma','Rahul Verma','Priya Nair','Sneha Gupta') THEN t.rent_amount ELSE 0 END,
  CASE WHEN t.full_name IN ('Amit Sharma','Rahul Verma','Priya Nair','Sneha Gupta') THEN 'paid' ELSE 'pending' END,
  CASE WHEN t.full_name IN ('Amit Sharma','Rahul Verma','Priya Nair','Sneha Gupta') THEN 'upi' ELSE NULL END,
  CASE WHEN t.full_name IN ('Amit Sharma','Rahul Verma','Priya Nair','Sneha Gupta') THEN '2025-02-02'::DATE ELSE NULL END
FROM tenants t
WHERE t.property_id = 'aaaaaaaa-0000-0000-0000-000000000001';

-- March 2025 — current month, mostly pending
INSERT INTO rent_ledger (
  tenant_id, property_id, room_id,
  billing_month, billing_year, due_date,
  rent_amount, amount_paid, payment_status
)
SELECT
  t.id, t.property_id, t.room_id,
  3, 2025, '2025-03-01'::DATE,
  t.rent_amount, 0, 'pending'
FROM tenants t
WHERE t.property_id = 'aaaaaaaa-0000-0000-0000-000000000001';

-- ============================================================
-- SAMPLE MAINTENANCE TICKETS
-- ============================================================

INSERT INTO maintenance_tickets (property_id, room_id, tenant_id, title, description, category, priority, status)
SELECT
  'aaaaaaaa-0000-0000-0000-000000000001',
  r.id, t.id,
  m.title, m.description, m.category::ticket_category_type, m.priority::ticket_priority, m.status::ticket_status
FROM (VALUES
  ('101', 'AC not cooling', 'AC is running but room temperature stays high even on 18°C setting', 'ac', 'high', 'open'),
  ('202', 'Leaking tap in bathroom', 'Hot water tap in bathroom drips constantly', 'plumbing', 'medium', 'in_progress'),
  ('301', 'WiFi signal very weak', 'Can barely get 1 bar of signal near the window', 'internet', 'low', 'open')
) AS m(room_num, title, description, category, priority, status)
JOIN rooms r ON r.room_number = m.room_num AND r.property_id = 'aaaaaaaa-0000-0000-0000-000000000001'
JOIN tenants t ON t.room_id = r.id AND t.status = 'active'
LIMIT 3;
