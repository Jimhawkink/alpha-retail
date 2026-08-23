import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const adminSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const saleIdsParam = searchParams.get('sale_ids');
    if (!saleIdsParam) return NextResponse.json({ items: [], error: null, debug: 'no sale_ids param' });

    const saleIds = saleIdsParam.split(',').map(Number).filter(Boolean);
    if (!saleIds.length) return NextResponse.json({ items: [], error: null, debug: 'empty sale_ids' });

    const { data, error } = await adminSupabase
        .from('retail_sales_items')
        .select('*')
        .in('sale_id', saleIds);

    if (error) {
        console.error('sales-items API error:', error);
        return NextResponse.json(
            { items: [], error: error.message, code: error.code, debug: 'query_error' },
            { status: 500 }
        );
    }
    return NextResponse.json({ items: data || [], error: null, count: data?.length || 0 });
}
