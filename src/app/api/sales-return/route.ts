import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InprYW11aHZybWF6b3podWRidHV3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDI0MTc5NiwiZXhwIjoyMDk5ODE3Nzk2fQ.1TiRblZHKNcNAJd4j5Oh_xl38Qo0TuaaROIP8iDVpYw';
const SUPABASE_URL = 'https://zkamuhvrmazozhudbtuw.supabase.co';
const admin = createClient(SUPABASE_URL, SERVICE_KEY);

export async function POST(req: NextRequest) {
    try {
        const { records, stockRows, saleId, totalRefundAmount, returnItems } = await req.json();
        if (!records || !Array.isArray(records) || records.length === 0)
            return NextResponse.json({ error: 'No return records provided' }, { status: 400 });

        // 1. Insert return records
        const { error: retErr } = await admin.from('sales_returns').insert(records);
        if (retErr) throw new Error(`Return insert failed: ${retErr.message}`);

        // 2. Restore stock
        if (stockRows && stockRows.length > 0) {
            const rounded = stockRows.map((r: any) => ({ ...r, qty: Math.round(Number(r.qty)) }));
            const { error: stockErr } = await admin.from('retail_stock').insert(rounded);
            if (stockErr) throw new Error(`Stock restore failed: ${stockErr.message}`);
        }

        // 3. Deduct refund from original sale total_amount
        if (saleId && totalRefundAmount > 0) {
            const { data: saleData } = await admin.from('retail_sales')
                .select('sale_id, total_amount, profit').eq('sale_id', saleId).single();
            if (saleData) {
                const newTotal = Math.max(0, (Number(saleData.total_amount) || 0) - totalRefundAmount);
                const newProfit = (Number(saleData.profit) || 0) - totalRefundAmount;
                await admin.from('retail_sales').update({ total_amount: newTotal, profit: newProfit }).eq('sale_id', saleId);
            }

            // 4. Reduce retail_sales_items quantities
            if (returnItems && returnItems.length > 0) {
                for (const ri of returnItems) {
                    if (!ri.product_id) continue;
                    const { data: itemRows } = await admin.from('retail_sales_items')
                        .select('item_id, quantity').eq('sale_id', saleId).eq('product_id', ri.product_id).limit(1);
                    if (itemRows && itemRows.length > 0) {
                        const newQty = Math.max(0, (Number(itemRows[0].quantity) || 0) - ri.returnQty);
                        await admin.from('retail_sales_items').update({ quantity: newQty }).eq('item_id', itemRows[0].item_id);
                    }
                }
            }
        }

        return NextResponse.json({ success: true });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
