-- ══════════════════════════════════════════════════════════════
-- Customer Pledge (Payment Promise) Table  — FIXED VERSION
-- No foreign key constraints (avoids constraint lookup errors)
-- Run this in Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════

-- 1. Create the pledges table (no FK constraints)
CREATE TABLE IF NOT EXISTS retail_credit_pledges (
    pledge_id       SERIAL PRIMARY KEY,
    customer_id     INTEGER NOT NULL,
    outlet_id       INTEGER,
    pledge_date     DATE NOT NULL,
    pledge_amount   NUMERIC(12, 2) NOT NULL DEFAULT 0,
    note            TEXT,
    status          VARCHAR(20) NOT NULL DEFAULT 'pending',
    recorded_by     TEXT,
    sale_id         INTEGER,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_credit_pledges_customer ON retail_credit_pledges(customer_id);
CREATE INDEX IF NOT EXISTS idx_credit_pledges_date     ON retail_credit_pledges(pledge_date);
CREATE INDEX IF NOT EXISTS idx_credit_pledges_status   ON retail_credit_pledges(status);
CREATE INDEX IF NOT EXISTS idx_credit_pledges_outlet   ON retail_credit_pledges(outlet_id);

-- 3. Enable Row Level Security
ALTER TABLE retail_credit_pledges ENABLE ROW LEVEL SECURITY;

-- 4. Policy (DROP first to avoid duplicate error on re-run)
DROP POLICY IF EXISTS "Allow all on pledges" ON retail_credit_pledges;
CREATE POLICY "Allow all on pledges" ON retail_credit_pledges
    FOR ALL USING (true) WITH CHECK (true);

-- 5. Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_pledge_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pledge_updated_at ON retail_credit_pledges;
CREATE TRIGGER trg_pledge_updated_at
    BEFORE UPDATE ON retail_credit_pledges
    FOR EACH ROW EXECUTE FUNCTION update_pledge_timestamp();

-- ══════════════════════════════════════════════════════════════
-- VERIFICATION — should return columns list
-- ══════════════════════════════════════════════════════════════
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'retail_credit_pledges'
ORDER BY ordinal_position;
