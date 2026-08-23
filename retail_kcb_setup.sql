-- ══════════════════════════════════════════════════════════
-- ALPHA RETAIL — KCB Buni Setup SQL
-- Run this in Supabase SQL Editor for the Alpha Retail project
-- ══════════════════════════════════════════════════════════

-- Step 1: Add KCB columns to retail_outlets table
ALTER TABLE retail_outlets
  ADD COLUMN IF NOT EXISTS kcb_consumer_key    TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS kcb_consumer_secret TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS kcb_till_number     TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS kcb_enabled         BOOLEAN DEFAULT FALSE;

-- Step 2: Create KCB STK requests tracking table
CREATE TABLE IF NOT EXISTS retail_kcb_stk_requests (
    id                   BIGSERIAL PRIMARY KEY,
    checkout_request_id  TEXT NOT NULL UNIQUE,
    merchant_request_id  TEXT,
    outlet_id            INTEGER,
    sale_id              TEXT,
    amount               NUMERIC(10,2) NOT NULL,
    amount_paid          NUMERIC(10,2),
    phone                TEXT NOT NULL,
    invoice_number       TEXT,
    status               TEXT NOT NULL DEFAULT 'Pending',
    mpesa_receipt        TEXT,
    result_code          TEXT,
    result_desc          TEXT,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_retail_kcb_checkout
    ON retail_kcb_stk_requests(checkout_request_id);

ALTER TABLE retail_kcb_stk_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON retail_kcb_stk_requests
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "anon_read" ON retail_kcb_stk_requests
    FOR SELECT TO anon, authenticated USING (true);

-- Step 3: Insert VINROSE sandbox credentials (find the correct outlet_id first)
-- Replace 1 with the actual VINROSE outlet ID from your retail_outlets table
UPDATE retail_outlets SET
    kcb_consumer_key    = 'x_6oXOjdajJwiFkgIwefe0UeOIka',
    kcb_consumer_secret = 'tfuEox33L3oIOeJ6zQJE4POE3vca',
    kcb_till_number     = '5891388',
    kcb_enabled         = TRUE
WHERE outlet_name ILIKE '%vinrose%' OR id = 1;
-- ⚠️ Verify the WHERE clause matches VINROSE before running!
