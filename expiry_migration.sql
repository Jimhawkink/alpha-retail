-- ============================================
-- ALPHA RETAIL — EXPIRY TRACKING MIGRATION
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Add expiry tracking toggle to outlets (default OFF)
ALTER TABLE retail_outlets ADD COLUMN IF NOT EXISTS enable_expiry_tracking BOOLEAN DEFAULT false;

-- 2. Create product batches table for per-batch expiry tracking
CREATE TABLE IF NOT EXISTS retail_product_batches (
    batch_id SERIAL PRIMARY KEY,
    pid INTEGER NOT NULL,
    product_name TEXT NOT NULL,
    batch_number TEXT,
    expiry_date DATE NOT NULL,
    qty_received INTEGER DEFAULT 0,
    qty_remaining INTEGER DEFAULT 0,
    cost_price NUMERIC(12,2) DEFAULT 0,
    selling_price NUMERIC(12,2) DEFAULT 0,
    supplier_name TEXT,
    received_date DATE DEFAULT CURRENT_DATE,
    outlet_id INTEGER NOT NULL,
    status TEXT DEFAULT 'Active',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_rpb_pid_outlet ON retail_product_batches(pid, outlet_id);
CREATE INDEX IF NOT EXISTS idx_rpb_expiry ON retail_product_batches(expiry_date);
CREATE INDEX IF NOT EXISTS idx_rpb_outlet_status ON retail_product_batches(outlet_id, status);

-- 4. Enable RLS (optional — match your existing policy)
ALTER TABLE retail_product_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for retail_product_batches" ON retail_product_batches FOR ALL USING (true) WITH CHECK (true);
