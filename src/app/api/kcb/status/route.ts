// ═══════════════════════════════════════════════════════════════
// ALPHA RETAIL — KCB Buni Status Polling
// GET /api/kcb/status?checkoutRequestId=xxx
// ═══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const checkoutRequestId = searchParams.get('checkoutRequestId');

        if (!checkoutRequestId) {
            return NextResponse.json({ error: 'Missing checkoutRequestId' }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('retail_kcb_stk_requests')
            .select('status, mpesa_receipt, amount_paid, result_code, result_desc')
            .eq('checkout_request_id', checkoutRequestId)
            .single();

        if (error || !data) {
            return NextResponse.json({ status: 'Pending', receipt: null });
        }

        return NextResponse.json({
            status:     data.status,
            receipt:    data.mpesa_receipt,
            amount:     data.amount_paid,
            resultCode: data.result_code,
            resultDesc: data.result_desc,
        });

    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
