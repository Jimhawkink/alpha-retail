-- ============================================================
-- ALPHA RETAIL — Credit Customer System: Schema Additions
-- Run in Supabase SQL Editor BEFORE using the new features
-- SAFE: Uses IF NOT EXISTS / DO NOTHING everywhere
-- ============================================================

-- 1. Add outlet_id to retail_credit_customers
ALTER TABLE retail_credit_customers
    ADD COLUMN IF NOT EXISTS outlet_id INTEGER DEFAULT 1,
    ADD COLUMN IF NOT EXISTS opening_balance NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS notes TEXT,
    ADD COLUMN IF NOT EXISTS prepayment_balance NUMERIC DEFAULT 0;

-- 2. Add outlet_id + transaction_type to retail_credit_payments
ALTER TABLE retail_credit_payments
    ADD COLUMN IF NOT EXISTS outlet_id INTEGER DEFAULT 1,
    ADD COLUMN IF NOT EXISTS transaction_type VARCHAR DEFAULT 'payment',
    ADD COLUMN IF NOT EXISTS received_by VARCHAR;

-- 3. Update existing customers to have outlet_id = 1 if null
UPDATE retail_credit_customers SET outlet_id = 1 WHERE outlet_id IS NULL;
UPDATE retail_credit_payments SET outlet_id = 1 WHERE outlet_id IS NULL;

-- 4. Recreate retail_credit_payments table if columns are missing
-- (Only needed if the table was created without all columns)
CREATE TABLE IF NOT EXISTS retail_credit_payments (
    payment_id        SERIAL PRIMARY KEY,
    customer_id       INTEGER REFERENCES retail_credit_customers(customer_id),
    sale_id           INTEGER,
    receipt_no        VARCHAR,
    payment_date      DATE DEFAULT CURRENT_DATE,
    payment_datetime  TIMESTAMPTZ DEFAULT NOW(),
    amount_paid       NUMERIC DEFAULT 0,
    balance_before    NUMERIC DEFAULT 0,
    balance_after     NUMERIC DEFAULT 0,
    payment_method    VARCHAR DEFAULT 'Cash',
    mpesa_code        VARCHAR,
    reference_no      VARCHAR,
    payment_note      TEXT,
    received_by       VARCHAR,
    transaction_type  VARCHAR DEFAULT 'payment',
    outlet_id         INTEGER DEFAULT 1,
    created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Enable RLS on both tables
ALTER TABLE retail_credit_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE retail_credit_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "retail_credit_customers_policy" ON retail_credit_customers;
DROP POLICY IF EXISTS "retail_credit_payments_policy" ON retail_credit_payments;

CREATE POLICY "retail_credit_customers_policy" ON retail_credit_customers FOR ALL USING (true);
CREATE POLICY "retail_credit_payments_policy" ON retail_credit_payments FOR ALL USING (true);

-- 6. Verify: show all columns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name IN ('retail_credit_customers', 'retail_credit_payments')
  AND table_schema = 'public'
ORDER BY table_name, ordinal_position;

-- ============================================================
-- DONE ✅ — Now run the new credit-customers page code
-- ============================================================
