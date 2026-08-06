-- ============================================================
-- ALPHA RETAIL — CREATE MISSING TABLES (New Supabase Project)
-- Run this in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/zkamuhvrmazozhudbtuw/sql/new
--
-- SAFE: Uses CREATE TABLE IF NOT EXISTS — won't affect existing tables
-- ============================================================

-- ── retail_shifts (POS Register Open/Close) ─────────────────
CREATE TABLE IF NOT EXISTS retail_shifts (
    shift_id     SERIAL PRIMARY KEY,
    shift_date   DATE DEFAULT CURRENT_DATE,
    shift_type   VARCHAR DEFAULT 'Day',
    start_time   TIME,
    end_time     TIME,
    opening_cash NUMERIC DEFAULT 0,
    closing_cash NUMERIC DEFAULT 0,
    total_sales  NUMERIC DEFAULT 0,
    total_expenses NUMERIC DEFAULT 0,
    net_sales    NUMERIC DEFAULT 0,
    status       VARCHAR DEFAULT 'Open',
    opened_by    VARCHAR,
    closed_by    VARCHAR,
    outlet_id    INTEGER DEFAULT 1,
    notes        TEXT,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS and open policy
ALTER TABLE retail_shifts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "retail_shifts_policy" ON retail_shifts;
CREATE POLICY "retail_shifts_policy" ON retail_shifts FOR ALL USING (true);

-- ── retail_settings (Store Settings) ────────────────────────
CREATE TABLE IF NOT EXISTS retail_settings (
    id            SERIAL PRIMARY KEY,
    setting_key   VARCHAR NOT NULL UNIQUE,
    setting_value TEXT,
    setting_type  VARCHAR DEFAULT 'text',
    description   TEXT,
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE retail_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "retail_settings_policy" ON retail_settings;
CREATE POLICY "retail_settings_policy" ON retail_settings FOR ALL USING (true);

-- Insert default settings (skip if already exist)
INSERT INTO retail_settings (setting_key, setting_value, description)
VALUES
    ('company_name',    'Alpha Retail',                  'Store Name'),
    ('company_address', 'Nairobi, Kenya',                'Store Address'),
    ('company_phone',   '+254 700 000 000',              'Store Phone'),
    ('company_email',   'info@alpharetail.com',          'Store Email'),
    ('receipt_header',  'Thank you for shopping with us!','Receipt Header'),
    ('receipt_footer',  'Please come again!',            'Receipt Footer'),
    ('currency',        'KES',                           'Currency Code'),
    ('tax_rate',        '16',                            'Default Tax Rate %')
ON CONFLICT (setting_key) DO NOTHING;

-- ── retail_tax_settings ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS retail_tax_settings (
    tax_id       SERIAL PRIMARY KEY,
    tax_code     VARCHAR UNIQUE,
    tax_name     VARCHAR NOT NULL,
    tax_rate     NUMERIC DEFAULT 0,
    tax_type     VARCHAR DEFAULT 'VAT',
    is_inclusive BOOLEAN DEFAULT false,
    is_default   BOOLEAN DEFAULT false,
    active       BOOLEAN DEFAULT true,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE retail_tax_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "retail_tax_settings_policy" ON retail_tax_settings;
CREATE POLICY "retail_tax_settings_policy" ON retail_tax_settings FOR ALL USING (true);

-- ── retail_stock_movements ───────────────────────────────────
CREATE TABLE IF NOT EXISTS retail_stock_movements (
    movement_id    SERIAL PRIMARY KEY,
    movement_date  DATE NOT NULL DEFAULT CURRENT_DATE,
    product_id     INTEGER,
    product_name   VARCHAR,
    product_code   VARCHAR,
    movement_type  VARCHAR NOT NULL,
    quantity       NUMERIC DEFAULT 0,
    unit           VARCHAR DEFAULT 'PCS',
    unit_cost      NUMERIC DEFAULT 0,
    total_cost     NUMERIC DEFAULT 0,
    reference_no   VARCHAR,
    reference_type VARCHAR,
    reason         TEXT,
    outlet_id      INTEGER DEFAULT 1,
    created_by     VARCHAR,
    created_at     TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE retail_stock_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "retail_stock_movements_policy" ON retail_stock_movements;
CREATE POLICY "retail_stock_movements_policy" ON retail_stock_movements FOR ALL USING (true);

-- ── retail_credit_customers ──────────────────────────────────
CREATE TABLE IF NOT EXISTS retail_credit_customers (
    customer_id      SERIAL PRIMARY KEY,
    customer_code    VARCHAR UNIQUE,
    customer_name    VARCHAR NOT NULL,
    phone            VARCHAR,
    email            VARCHAR,
    address          TEXT,
    credit_limit     NUMERIC DEFAULT 0,
    current_balance  NUMERIC DEFAULT 0,
    active           BOOLEAN DEFAULT true,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE retail_credit_customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "retail_credit_customers_policy" ON retail_credit_customers;
CREATE POLICY "retail_credit_customers_policy" ON retail_credit_customers FOR ALL USING (true);

-- ── retail_credit_payments ───────────────────────────────────
CREATE TABLE IF NOT EXISTS retail_credit_payments (
    payment_id      SERIAL PRIMARY KEY,
    customer_id     INTEGER REFERENCES retail_credit_customers(customer_id),
    payment_date    DATE DEFAULT CURRENT_DATE,
    amount          NUMERIC DEFAULT 0,
    payment_method  VARCHAR DEFAULT 'Cash',
    reference_no    VARCHAR,
    notes           TEXT,
    received_by     VARCHAR,
    outlet_id       INTEGER DEFAULT 1,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE retail_credit_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "retail_credit_payments_policy" ON retail_credit_payments;
CREATE POLICY "retail_credit_payments_policy" ON retail_credit_payments FOR ALL USING (true);

-- ── CONFIRM: list all retail_ tables now existing ────────────
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE 'retail_%'
ORDER BY table_name;

-- ============================================================
-- DONE ✅
-- retail_shifts   → Open Register will now work
-- retail_settings → Store settings will load
-- retail_tax_settings, retail_stock_movements etc. also created
-- ============================================================
