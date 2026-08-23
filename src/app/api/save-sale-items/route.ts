import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Server-side only — uses service role key to bypass RLS on INSERT
const adminSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
    try {
        const { items } = await req.json();
        if (!items || !items.length) {
            return NextResponse.json({ success: true, count: 0 });
        }
        const { data, error } = await adminSupabase
            .from('retail_sales_items')
            .insert(items)
            .select();

        if (error) {
            console.error('save-sale-items error:', error);
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
        return NextResponse.json({ success: true, count: data?.length || 0 });
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
