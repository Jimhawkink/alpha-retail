import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const callback = body?.Body?.stkCallback;
        if (!callback) return NextResponse.json({ ResultCode: 0, ResultDesc: 'ok' });

        const { CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = callback;
        console.log('[M-Pesa Callback]', { CheckoutRequestID, ResultCode, ResultDesc });

        const items: Record<string, string | number> = {};
        (CallbackMetadata?.Item || []).forEach((i: { Name: string; Value: string | number }) => { items[i.Name] = i.Value; });

        const updateData: Record<string, unknown> = {
            result_code: String(ResultCode),
            result_desc: ResultDesc,
            status:      ResultCode === 0 ? 'Completed' : 'Failed',
            updated_at:  new Date().toISOString(),
        };
        if (ResultCode === 0) {
            updateData.mpesa_receipt_number = items['MpesaReceiptNumber'];
            updateData.transaction_date     = String(items['TransactionDate'] || '');
        }

        await supabase.from('mpesa_transactions').update(updateData).eq('checkout_request_id', CheckoutRequestID);
        return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[M-Pesa Callback] Error:', msg);
        return NextResponse.json({ ResultCode: 0, ResultDesc: 'ok' });
    }
}

export async function GET() {
    return NextResponse.json({ status: 'Alpha Retail M-Pesa Callback Active' });
}