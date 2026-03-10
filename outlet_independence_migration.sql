-- =====================================================
-- OUTLET INDEPENDENCE MIGRATION (SAFE - re-runnable)
-- Adds outlet_id to all tables that need it
-- Run this on your Supabase SQL Editor
-- =====================================================

-- 1. Add outlet_id to retail_products (skip if exists)
DO $$ BEGIN
    ALTER TABLE retail_products ADD COLUMN outlet_id INTEGER DEFAULT 1;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- 2. Add outlet_id to retail_categories (skip if exists)
DO $$ BEGIN
    ALTER TABLE retail_categories ADD COLUMN outlet_id INTEGER DEFAULT 1;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- 3. Add outlet_id to retail_sales (skip if exists)
DO $$ BEGIN
    ALTER TABLE retail_sales ADD COLUMN outlet_id INTEGER DEFAULT 1;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- 4. Add outlet_id to retail_purchases (skip if exists)
DO $$ BEGIN
    ALTER TABLE retail_purchases ADD COLUMN outlet_id INTEGER DEFAULT 1;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- 5. Add outlet_id to retail_stock (skip if exists)
DO $$ BEGIN
    ALTER TABLE retail_stock ADD COLUMN outlet_id INTEGER DEFAULT 1;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- 6. Set all existing data to main outlet (outlet_id = 1)
UPDATE retail_products SET outlet_id = 1 WHERE outlet_id IS NULL;
UPDATE retail_categories SET outlet_id = 1 WHERE outlet_id IS NULL;
UPDATE retail_sales SET outlet_id = 1 WHERE outlet_id IS NULL;
UPDATE retail_purchases SET outlet_id = 1 WHERE outlet_id IS NULL;
UPDATE retail_stock SET outlet_id = 1 WHERE outlet_id IS NULL;

-- 7. Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_products_outlet ON retail_products(outlet_id);
CREATE INDEX IF NOT EXISTS idx_categories_outlet ON retail_categories(outlet_id);
CREATE INDEX IF NOT EXISTS idx_sales_outlet ON retail_sales(outlet_id);
CREATE INDEX IF NOT EXISTS idx_purchases_outlet ON retail_purchases(outlet_id);
CREATE INDEX IF NOT EXISTS idx_stock_outlet ON retail_stock(outlet_id);

-- Done! Each outlet now has independent data.
-- This is SAFE to re-run — won't duplicate or break anything.
