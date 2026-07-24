/**
 * Alpha Retail — Missing Products Recovery Script
 * Finds products in the migration SQL that are NOT in the new Supabase
 * and re-inserts them
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://zkamuhvrmazozhudbtuw.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InprYW11aHZybWF6b3podWRidHV3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDI0MTc5NiwiZXhwIjoyMDk5ODE3Nzk2fQ.1TiRblZHKNcNAJd4j5Oh_xl38Qo0TuaaROIP8iDVpYw';

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// Path to the big migration SQL file
const MIGRATION_FILE = path.join('E:\\Res Pos\\MIGRATION_SQL_EDITOR.sql');

async function getExistingPIDs() {
    let allPIDs = new Set();
    let page = 0;
    const pageSize = 1000;
    while (true) {
        const { data, error } = await sb.from('retail_products')
            .select('pid')
            .range(page * pageSize, (page + 1) * pageSize - 1);
        if (error || !data || data.length === 0) break;
        data.forEach(r => allPIDs.add(r.pid));
        if (data.length < pageSize) break;
        page++;
    }
    console.log(`✅ Found ${allPIDs.size} existing products in Supabase`);
    return allPIDs;
}

function parseMigrationSQL(content) {
    // Extract all retail_products INSERT blocks
    const blockRegex = /INSERT INTO public\."retail_products"\s*\([^)]+\)\s*VALUES\s*([\s\S]+?)ON CONFLICT DO NOTHING;/gi;
    const columnRegex = /INSERT INTO public\."retail_products"\s*\(([^)]+)\)/i;
    
    const products = [];
    let match;
    
    while ((match = blockRegex.exec(content)) !== null) {
        const fullBlock = match[0];
        
        // Extract column names
        const colMatch = columnRegex.exec(fullBlock);
        if (!colMatch) continue;
        const columns = colMatch[1].split(',').map(c => c.trim().replace(/"/g, ''));
        
        // Extract VALUE rows
        const valuesSection = match[1];
        // Match each row: (val1, val2, ...)
        const rowRegex = /\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g;
        let rowMatch;
        while ((rowMatch = rowRegex.exec(valuesSection)) !== null) {
            const rowStr = rowMatch[1];
            // Parse values (simple CSV aware of quotes)
            const values = parseCSVRow(rowStr);
            if (values.length !== columns.length) continue;
            
            const product = {};
            columns.forEach((col, i) => {
                let val = values[i].trim();
                if (val === 'NULL' || val === 'null') product[col] = null;
                else if (val === 'TRUE' || val === 'true') product[col] = true;
                else if (val === 'FALSE' || val === 'false') product[col] = false;
                else if (val.startsWith("'") && val.endsWith("'")) {
                    product[col] = val.slice(1, -1).replace(/''/g, "'");
                } else if (!isNaN(val) && val !== '') {
                    product[col] = Number(val);
                } else {
                    product[col] = val;
                }
            });
            if (product.pid) products.push(product);
        }
    }
    return products;
}

function parseCSVRow(str) {
    const values = [];
    let current = '';
    let inQuote = false;
    for (let i = 0; i < str.length; i++) {
        const ch = str[i];
        if (ch === "'" && !inQuote) {
            inQuote = true;
            current += ch;
        } else if (ch === "'" && inQuote) {
            if (str[i+1] === "'") {
                current += "''";
                i++;
            } else {
                inQuote = false;
                current += ch;
            }
        } else if (ch === ',' && !inQuote) {
            values.push(current.trim());
            current = '';
        } else {
            current += ch;
        }
    }
    if (current.trim()) values.push(current.trim());
    return values;
}

async function insertMissingProducts(missingProducts) {
    console.log(`\n🔄 Inserting ${missingProducts.length} missing products...`);
    let success = 0, fail = 0, errors = [];
    
    // Insert in batches of 50 using ignoreDuplicates (no constraint needed)
    const batchSize = 50;
    for (let i = 0; i < missingProducts.length; i += batchSize) {
        const batch = missingProducts.slice(i, i + batchSize);
        const { error } = await sb.from('retail_products')
            .insert(batch, { ignoreDuplicates: true });
        
        if (error) {
            // Fallback: insert row-by-row to skip individual failures
            console.log(`  ⚠️  Batch ${i}-${i+batchSize} failed (${error.message.substring(0,60)}), trying row-by-row...`);
            for (const product of batch) {
                const { error: rowErr } = await sb.from('retail_products').insert(product, { ignoreDuplicates: true });
                if (rowErr) {
                    fail++;
                    errors.push(`PID ${product.pid}: ${rowErr.message.substring(0,80)}`);
                } else {
                    success++;
                }
            }
        } else {
            success += batch.length;
            const batchEnd = Math.min(i + batchSize, missingProducts.length);
            console.log(`  ✅ Batch ${Math.floor(i/batchSize)+1}: inserted ${batch.length} products (PIDs ${batch[0].pid}–${batch[batch.length-1].pid})`);
        }
    }
    
    return { success, fail, errors };
}

async function fixOutletsTable() {
    console.log('\n🔧 Checking retail_outlets table...');
    
    // Check if retail_outlets table exists
    const { data: existing, error: checkErr } = await sb.from('retail_outlets').select('*').limit(1);
    if (!checkErr) {
        console.log('✅ retail_outlets table exists with data');
        return;
    }
    
    console.log('❌ retail_outlets table missing — creating...');
    // The outlets table needs to be created via SQL, not JS
    // Instead, check what outlet IDs are referenced and report
    const { data: outletIds } = await sb.from('retail_products')
        .select('outlet_id')
        .order('outlet_id');
    
    const unique = [...new Set(outletIds?.map(r => r.outlet_id))];
    console.log('Outlet IDs referenced in products:', unique);
    console.log('⚠️  retail_outlets table needs SQL creation — see fix below');
    
    return unique;
}

async function main() {
    console.log('=== Alpha Retail — Missing Products Recovery ===\n');
    
    // Step 1: Get existing PIDs
    const existingPIDs = await getExistingPIDs();
    
    // Step 2: Read migration SQL
    console.log('\n📖 Reading migration SQL...');
    if (!fs.existsSync(MIGRATION_FILE)) {
        console.error('ERROR: Migration file not found:', MIGRATION_FILE);
        process.exit(1);
    }
    const content = fs.readFileSync(MIGRATION_FILE, 'utf8');
    console.log(`File size: ${(content.length / 1024 / 1024).toFixed(1)} MB`);
    
    // Step 3: Parse products from SQL
    const sqlProducts = parseMigrationSQL(content);
    console.log(`Products found in migration SQL: ${sqlProducts.length}`);
    
    // Step 4: Find missing
    const missingProducts = sqlProducts.filter(p => !existingPIDs.has(p.pid));
    console.log(`\n🔍 Missing from Supabase: ${missingProducts.length} products`);
    
    if (missingProducts.length > 0) {
        console.log('Sample missing PIDs:', missingProducts.slice(0, 10).map(p => p.pid).join(', '));
        
        // Step 5: Insert missing
        const result = await insertMissingProducts(missingProducts);
        console.log(`\n📊 Results: ${result.success} inserted, ${result.fail} failed`);
        if (result.errors.length > 0) {
            console.log('Errors:', result.errors.join('\n'));
        }
    } else {
        console.log('✅ All products from migration SQL are already in Supabase!');
    }
    
    // Step 6: Fix outlets
    const outletIds = await fixOutletsTable();
    
    // Step 7: Final count
    const { count } = await sb.from('retail_products').select('*', { count: 'exact', head: true });
    console.log(`\n✅ FINAL: ${count} total products in Supabase`);
    
    if (outletIds) {
        console.log('\n⚠️  ACTION NEEDED: Run this SQL in Supabase SQL Editor to create retail_outlets table:');
        console.log(`
-- Create retail_outlets table (the app uses retail_ prefix)
CREATE TABLE IF NOT EXISTS retail_outlets (
    outlet_id SERIAL PRIMARY KEY,
    outlet_code VARCHAR(50) UNIQUE,
    outlet_name VARCHAR(200) NOT NULL,
    address TEXT,
    phone VARCHAR(50),
    email VARCHAR(200),
    is_main BOOLEAN DEFAULT false,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS with open policy
ALTER TABLE retail_outlets ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
    CREATE POLICY "Allow all retail_outlets" ON retail_outlets FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Insert known outlets (based on product outlet_ids)
INSERT INTO retail_outlets (outlet_id, outlet_code, outlet_name, is_main, active) VALUES
    (1, 'OTL-001', 'Main Store', true, true),
    (2, 'OTL-002', 'Branch 2', false, true),
    (3, 'OTL-003', 'Bomet Store', false, true),
    (4, 'OTL-004', 'Branch 4', false, true)
ON CONFLICT (outlet_id) DO NOTHING;

-- Reset sequence so new outlets get correct IDs
SELECT setval('retail_outlets_outlet_id_seq', (SELECT MAX(outlet_id) FROM retail_outlets));
        `);
    }
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
