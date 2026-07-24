/**
 * Fix the 14 products that failed due to decimal values in bigint columns
 * Rounds decimal prices to nearest integer and inserts them
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const sb = createClient(
    'https://zkamuhvrmazozhudbtuw.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InprYW11aHZybWF6b3podWRidHV3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDI0MTc5NiwiZXhwIjoyMDk5ODE3Nzk2fQ.1TiRblZHKNcNAJd4j5Oh_xl38Qo0TuaaROIP8iDVpYw'
);

const FAILED_PIDS = [3600, 2724, 2731, 2786, 2793, 3825, 3478, 3525, 3760, 3945, 3359, 21, 3884, 3361];
const MIGRATION_FILE = 'E:\\Res Pos\\MIGRATION_SQL_EDITOR.sql';

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
            if (str[i + 1] === "'") {
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

async function run() {
    console.log('=== Fixing 14 Decimal-Price Products ===\n');

    const content = fs.readFileSync(MIGRATION_FILE, 'utf8');
    console.log('Migration file loaded:', (content.length / 1024 / 1024).toFixed(1), 'MB');

    const blockRegex = /INSERT INTO public\."retail_products"\s*\(([^)]+)\)\s*VALUES\s*([\s\S]+?)ON CONFLICT DO NOTHING;/gi;
    const columnRegex = /INSERT INTO public\."retail_products"\s*\(([^)]+)\)/i;

    let allProducts = [];
    let match;

    while ((match = blockRegex.exec(content)) !== null) {
        const fullBlock = match[0];
        const colMatch = columnRegex.exec(fullBlock);
        if (!colMatch) continue;
        const columns = colMatch[1].split(',').map(c => c.trim().replace(/"/g, ''));

        const valuesSection = match[2];
        const rowRegex = /\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g;
        let rowMatch;
        while ((rowMatch = rowRegex.exec(valuesSection)) !== null) {
            const values = parseCSVRow(rowMatch[1]);
            if (values.length !== columns.length) continue;
            const product = {};
            columns.forEach((col, i) => {
                let val = values[i].trim();
                if (val === 'NULL' || val === 'null') product[col] = null;
                else if (val === 'TRUE' || val === 'true') product[col] = true;
                else if (val === 'FALSE' || val === 'false') product[col] = false;
                else if (val.startsWith("'") && val.endsWith("'")) product[col] = val.slice(1, -1).replace(/''/g, "'");
                else if (!isNaN(val) && val !== '') product[col] = Number(val);
                else product[col] = val;
            });
            if (product.pid && FAILED_PIDS.includes(product.pid)) {
                allProducts.push(product);
            }
        }
    }

    console.log(`Found ${allProducts.length} of the 14 failed products in migration SQL\n`);

    // Fix decimal fields by rounding to integers
    const numericFields = ['purchase_cost', 'sales_cost', 'wholesale_price', 'margin_per', 'reorder_point', 'vat', 'pieces_per_package'];

    let fixed = 0, stillFailed = 0;
    for (const p of allProducts) {
        // Round all numeric fields to avoid bigint issues
        for (const f of numericFields) {
            if (p[f] !== null && p[f] !== undefined && typeof p[f] === 'number') {
                p[f] = Math.round(p[f]);
            }
        }

        const { error } = await sb.from('retail_products').insert(p, { ignoreDuplicates: true });
        if (error) {
            console.log(`❌ STILL FAILED PID ${p.pid} (${p.product_name}): ${error.message.substring(0, 100)}`);
            stillFailed++;
        } else {
            console.log(`✅ Fixed PID ${p.pid} - ${p.product_name} (outlet ${p.outlet_id})`);
            fixed++;
        }
    }

    // Final count
    const { count } = await sb.from('retail_products').select('*', { count: 'exact', head: true });
    console.log(`\n📊 Fixed: ${fixed}, Still failed: ${stillFailed}`);
    console.log(`\n🎉 FINAL TOTAL: ${count} products in Supabase`);

    // Distribution per outlet
    const { data: prod } = await sb.from('retail_products').select('outlet_id, active');
    const dist = {};
    const activeDist = {};
    (prod || []).forEach(p => { dist[p.outlet_id] = (dist[p.outlet_id] || 0) + 1; });
    (prod || []).filter(p => p.active).forEach(p => { activeDist[p.outlet_id] = (activeDist[p.outlet_id] || 0) + 1; });

    console.log('\nAll products per outlet:');
    console.log('  Outlet 1 - Main Outlet:   ', dist[1] || 0);
    console.log('  Outlet 2 - CHEBUNYO:      ', dist[2] || 0);
    console.log('  Outlet 3 - LIX VENTURES:  ', dist[3] || 0);
    console.log('  Outlet 4 - DUSIT HARDWARE:', dist[4] || 0);
    console.log('\nActive products per outlet:');
    console.log('  Outlet 1 - Main Outlet:   ', activeDist[1] || 0);
    console.log('  Outlet 2 - CHEBUNYO:      ', activeDist[2] || 0);
    console.log('  Outlet 3 - LIX VENTURES:  ', activeDist[3] || 0);
    console.log('  Outlet 4 - DUSIT HARDWARE:', activeDist[4] || 0);
}

run().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
