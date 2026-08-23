// ═══════════════════════════════════════════════════════════════
// ALPHA RETAIL — KCB Buni Callback Handler
// POST /api/kcb/callback
//
// KCB fires this URL after customer enters M-Pesa PIN.
// Updates retail_kcb_stk_requests status.
// Response format per KCB Buni API documentation:
// { header: { messageID, originatorConversationID, statusCode, statusMessage },
//   responsePayload: { transactionInfo: { transactionId } } }
// ═══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// KCB Buni required IPN response per API documentation
function kcbResponse(messageID: string, originatorConversationID: string, transactionId: string) {
    return NextResponse.json({
        header: {
            messageID,
            originatorConversationID,
            statusCode: '0',
            statusMessage: 'Notification received',
        },
        responsePayload: {
            transactionInfo: {
                transactionId,
            },
        },
    });
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        console.log('[KCB Retail Callback] Raw payload:', JSON.stringify(body));

        // Extract fields — handle all known KCB callback shapes
        const resultCode  = body?.Body?.stkCallback?.ResultCode
                         ?? body?.resultCode
                         ?? body?.ResultCode
                         ?? body?.header?.statusCode
                         ?? body?.response?.ResultCode;

        const resultDesc  = body?.Body?.stkCallback?.ResultDesc
                         ?? body?.resultDesc
                         ?? body?.ResultDesc
                         ?? body?.header?.statusMessage
                         ?? 'Unknown';

        const checkoutId  = body?.Body?.stkCallback?.CheckoutRequestID
                         ?? body?.CheckoutRequestID
                         ?? body?.checkoutRequestId
                         ?? body?.response?.CheckoutRequestID
                         ?? `RETAIL_${Date.now()}`;

        const merchantId  = body?.Body?.stkCallback?.MerchantRequestID
                         ?? body?.MerchantRequestID
                         ?? body?.header?.originatorConversationID
                         ?? `MSG_${Date.now()}`;

        const messageID   = body?.header?.messageID
                         ?? body?.messageID
                         ?? `${Date.now()}`;

        const originatorConversationID = body?.header?.originatorConversationID
                         ?? body?.originatorConversationID
                         ?? merchantId;

        // Extract receipt and amount from callback items
        const items = body?.Body?.stkCallback?.CallbackMetadata?.Item || [];
        const getItem = (name: string) => items.find((i: any) => i.Name === name)?.Value;
        const mpesaReceipt = getItem('MpesaReceiptNumber') || body?.mpesaReceiptNumber || '';
        const amountPaid   = getItem('Amount') || body?.amount || 0;
        const transactionId = mpesaReceipt || body?.responsePayload?.transactionInfo?.transactionId || checkoutId;

        const isSuccess = String(resultCode) === '0';

        console.log('[KCB Retail Callback] checkoutId:', checkoutId, '| success:', isSuccess, '| receipt:', mpesaReceipt);

        // Update retail_kcb_stk_requests
        const { error: updateErr } = await supabase
            .from('retail_kcb_stk_requests')
            .update({
                status:        isSuccess ? 'Completed' : 'Failed',
                result_code:   String(resultCode ?? ''),
                result_desc:   String(resultDesc),
                mpesa_receipt: mpesaReceipt || null,
                amount_paid:   amountPaid ? Number(amountPaid) : null,
                updated_at:    new Date().toISOString(),
            })
            .eq('checkout_request_id', checkoutId);

        if (updateErr) {
            console.error('[KCB Retail Callback] DB update error:', updateErr.message);
        }

        // Return exact KCB Buni IPN response format per API documentation
        return kcbResponse(messageID, originatorConversationID, transactionId);

    } catch (err: any) {
        console.error('[KCB Retail Callback] Error:', err.message);
        return kcbResponse(`${Date.now()}`, `ERR_${Date.now()}`, '0');
    }
}

// Health check — browser GET request
export async function GET() {
    return NextResponse.json({
        status: 'Alpha Retail KCB Buni IPN Active',
        endpoint: 'POST /api/kcb/callback',
        time: new Date().toISOString(),
    });
}
