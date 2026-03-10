-- =====================================================
-- OUTLET INDEPENDENCE MIGRATION
-- Makes products and categories outlet-specific
-- Run this on your Supabase SQL Editor
-- =====================================================

-- 1. Add outlet_id to retail_products
DO $$ BEGIN
    ALTER TABLE retail_products ADD COLUMN outlet_id INTEGER DEFAULT 1;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- 2. Add outlet_id to retail_categories  
DO $$ BEGIN
    ALTER TABLE retail_categories ADD COLUMN outlet_id INTEGER DEFAULT 1;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- 3. Set all existing products and categories to main outlet (outlet_id = 1)
UPDATE retail_products SET outlet_id = 1 WHERE outlet_id IS NULL;
UPDATE retail_categories SET outlet_id = 1 WHERE outlet_id IS NULL;

-- 4. Create indexes for faster outlet-filtered queries
CREATE INDEX IF NOT EXISTS idx_products_outlet ON retail_products(outlet_id);
CREATE INDEX IF NOT EXISTS idx_categories_outlet ON retail_categories(outlet_id);

-- Done! Each outlet now has independent products and categories.
