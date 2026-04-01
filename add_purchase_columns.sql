-- Add missing columns to retail_purchase_products for bags/pieces and batch/expiry tracking
-- Run this in your Supabase SQL Editor

ALTER TABLE retail_purchase_products ADD COLUMN IF NOT EXISTS bag_qty numeric DEFAULT 0;
ALTER TABLE retail_purchase_products ADD COLUMN IF NOT EXISTS piece_qty numeric DEFAULT 0;
ALTER TABLE retail_purchase_products ADD COLUMN IF NOT EXISTS batch_number character varying;
ALTER TABLE retail_purchase_products ADD COLUMN IF NOT EXISTS expiry_date date;
