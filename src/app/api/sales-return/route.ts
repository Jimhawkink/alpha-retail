import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InprYW11aHZybWF6b3podWRidHV3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDI0MTc5NiwiZXhwIjoyMDk5ODE3Nzk2fQ.1TiRblZHKNcNAJd4j5Oh_xl38Qo0TuaaROIP8iDVpYw';
const SUPABASE_URL = 'https://zkamuhvrmazozhudbtuw.supabase.co';

const admin = createClient(SUPABASE_URL, SERVICE_KEY);

export async function POST(req: NextRequest) {
    try {
        const { records, stockRows } = await req.json();

        if (!records || !Array.isArray(records) || records.length === 0) {
            return NextResponse.json({ error: 'No return records provided' }, { status: 400 });
        }

        // Insert return records
        const { error: retErr } = await admin.from('sales_returns').insert(records);
        if (retErr) throw new Error(`Return insert failed: ${retErr.message}`);

        // Restore stock if provided — round qty for bigint column
        if (stockRows && stockRows.length > 0) {
            const rounded = stockRows.map((r: any) => ({ ...r, qty: Math.round(Number(r.qty)) }));
            const { error: stockErr } = await admin.from('retail_stock').insert(rounded);
            if (stockErr) throw new Error(`Stock restore failed: ${stockErr.message}`);
        }

        return NextResponse.json({ success: true });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
