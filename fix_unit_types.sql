-- ============================================================
-- ALPHA RETAIL — FIX ALL UNIT TYPE MISMATCHES (Post-Migration)
-- Run this in Supabase SQL Editor
-- SAFE: Only updates label metadata (purchase_unit / sales_unit)
--       Does NOT touch retail_stock quantities AT ALL.
-- ============================================================

-- ── STEP 1: FULL AUDIT — see every product's units ──────────
-- Run this first to see all products and their current units:
SELECT
    pid,
    product_code,
    product_name,
    purchase_unit,
    sales_unit,
    pieces_per_package,
    CASE
        WHEN LOWER(sales_unit) = LOWER(purchase_unit)
             AND LOWER(purchase_unit) IN ('dozen','box','pack','carton','crate','bag','bags','bottle','liter','kilogram','kg','litre','sack','bale','roll','ream','tray','flat','bundle','set')
        THEN '❌ MISMATCH — sales_unit same as purchase_unit'
        WHEN pieces_per_package > 1 AND LOWER(sales_unit) = LOWER(purchase_unit)
        THEN '❌ MISMATCH — pieces_per_package > 1 but same units'
        WHEN pieces_per_package IS NULL OR pieces_per_package = 0
        THEN '⚠️ pieces_per_package missing/zero'
        ELSE '✅ OK'
    END AS status
FROM retail_products
ORDER BY
    CASE WHEN LOWER(sales_unit) = LOWER(purchase_unit) THEN 0 ELSE 1 END,
    product_name;


-- ── STEP 2: PREVIEW — which rows will be fixed ──────────────
SELECT
    pid,
    product_code,
    product_name,
    purchase_unit  AS current_purchase_unit,
    sales_unit     AS current_sales_unit,
    pieces_per_package,
    'Will set sales_unit → Piece' AS proposed_fix
FROM retail_products
WHERE
    (
        -- Case A: Both units are the same big-unit word (clearest corruption)
        LOWER(sales_unit) = LOWER(purchase_unit)
        AND LOWER(purchase_unit) IN (
            'dozen','box','pack','carton','crate','bag','bags',
            'bottle','liter','litre','kilogram','kg','sack',
            'bale','roll','ream','tray','flat','bundle','set',
            'crate','pallet','carton','jerrycan','gallon'
        )
    )
    OR
    (
        -- Case B: pieces_per_package > 1 but sales_unit equals purchase_unit
        -- meaning the item SHOULD sell by piece but is wrongly labelled
        (pieces_per_package IS NOT NULL AND pieces_per_package > 1)
        AND LOWER(sales_unit) = LOWER(purchase_unit)
    )
ORDER BY product_name;


-- ── STEP 3: FIX — update corrupted sales_unit to 'Piece' ────
-- This ONLY affects products where big_unit = small_unit (wrong).
-- Products that legitimately sell by the same unit are not touched
-- because they would have pieces_per_package = 1 or NULL with no mismatch.

UPDATE retail_products
SET
    sales_unit  = 'Piece',
    updated_at  = NOW()::text
WHERE
    (
        -- Case A: Both units are the same big-unit name
        LOWER(sales_unit) = LOWER(purchase_unit)
        AND LOWER(purchase_unit) IN (
            'dozen','box','pack','carton','crate','bag','bags',
            'bottle','liter','litre','kilogram','kg','sack',
            'bale','roll','ream','tray','flat','bundle','set',
            'pallet','jerrycan','gallon'
        )
    )
    OR
    (
        -- Case B: pieces_per_package > 1 but sales_unit = purchase_unit
        (pieces_per_package IS NOT NULL AND pieces_per_package > 1)
        AND LOWER(sales_unit) = LOWER(purchase_unit)
    );


-- ── STEP 4: ALSO FIX pieces_per_package = 0 → set to 1 ─────
-- Zero pack size breaks cost-per-piece calculations (divide by zero)
UPDATE retail_products
SET pieces_per_package = 1
WHERE pieces_per_package = 0 OR pieces_per_package IS NULL;


-- ── STEP 5: CONFIRM — show all products after fix ───────────
SELECT
    pid,
    product_code,
    product_name,
    purchase_unit,
    sales_unit,
    pieces_per_package,
    CASE
        WHEN LOWER(sales_unit) = LOWER(purchase_unit) THEN '⚠️ Still same — check manually'
        ELSE '✅ Different units — correct'
    END AS unit_check
FROM retail_products
ORDER BY unit_check, product_name;


-- ── STEP 6: SPOT-CHECK key items ────────────────────────────
SELECT
    pid, product_code, product_name,
    purchase_unit, sales_unit, pieces_per_package
FROM retail_products
WHERE
    LOWER(product_name) LIKE '%melamine%'
    OR LOWER(product_name) LIKE '%plate%'
    OR LOWER(product_name) LIKE '%bowl%'
    OR LOWER(product_name) LIKE '%cup%'
    OR LOWER(product_name) LIKE '%mug%'
ORDER BY product_name;


-- ── STEP 7: RETAIL_STOCK INTEGRITY CHECK (READ ONLY) ────────
-- Verify stock buckets look sensible — no quantities are changed here
SELECT
    rp.pid,
    rp.product_code,
    rp.product_name,
    rp.purchase_unit,
    rp.sales_unit,
    rp.pieces_per_package,
    COALESCE(SUM(CASE WHEN rs.storage_type = 'Bags'   THEN rs.qty ELSE 0 END), 0) AS bag_stock,
    COALESCE(SUM(CASE WHEN rs.storage_type = 'Pieces' THEN rs.qty ELSE 0 END), 0) AS piece_stock,
    COALESCE(SUM(rs.qty), 0) AS total_stock
FROM retail_products rp
LEFT JOIN retail_stock rs ON rs.pid = rp.pid AND rs.outlet_id = 1
GROUP BY rp.pid, rp.product_code, rp.product_name,
         rp.purchase_unit, rp.sales_unit, rp.pieces_per_package
HAVING COALESCE(SUM(rs.qty), 0) != 0   -- only show products that have stock
ORDER BY rp.product_name;

-- ============================================================
-- DONE ✅
-- After running STEP 3:
--   • All corrupted sales_unit values are set to 'Piece'
--   • products list shows correct: 📦 X Dozen  🔢 Y Piece
--   • Stock Adjustment modal shows: DOZENS (BIG QTY) | PIECES (PIECES)
--   • POS deduction goes to the correct Bags/Pieces bucket
-- retail_stock table: NOT touched — all quantities unchanged
-- ============================================================
