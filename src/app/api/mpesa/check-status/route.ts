import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const MPESA_LIVE_URL    = 'https://api.safaricom.co.ke';
const MPESA_SANDBOX_URL = 'https://sandbox.safaricom.co.ke';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const checkoutRequestId = searchParams.get('checkout_request_id') || searchParams.get('checkoutRequestId');
        const outletId          = searchParams.get('outletId');

        if (!checkoutRequestId) {
            return NextResponse.json({ success: false, error: 'checkout_request_id is required' }, { status: 400 });
        }

        console.log('[M-Pesa Status] Checking:', checkoutRequestId, 'outletId:', outletId);

        // SOURCE 1: Check our DB first (populated by /api/mpesa/callback)
        const { data: tx } = await supabase
            .from('mpesa_transactions')
            .select('*')
            .eq('checkout_request_id', checkoutRequestId)
            .single();

        if (tx && tx.result_code !== null && tx.result_code !== undefined) {
            console.log('[M-Pesa Status] Found in DB:', tx.status, tx.result_code);
            const receipt = tx.mpesa_receipt_number || tx.mpesa_receipt;
            return NextResponse.json({
                success:             String(tx.result_code) === '0',
                ResultCode:          tx.result_code,
                resultCode:          tx.result_code,
                MpesaReceiptNumber:  receipt,
                mpesaReceiptNumber:  receipt,
                mpesa_receipt_number: receipt,
                Amount:              tx.amount,
                status:              tx.status,
                resultDesc:          tx.result_desc || (String(tx.result_code) === '0' ? 'Success' : 'Failed'),
            });
        }

        // SOURCE 2: Query Safaricom STK status API directly
        // Get outlet credentials from DB
        let CONSUMER_KEY    = '';
        let CONSUMER_SECRET = '';
        let SHORTCODE       = '';
        let PASSKEY         = '';

        if (outletId) {
            const { data: outlet } = await supabase
                .from('retail_outlets')
                .select('mpesa_consumer_key,mpesa_consumer_secret,mpesa_shortcode,mpesa_passkey')
                .eq('outlet_id', outletId)
                .single();
            if (outlet) {
                CONSUMER_KEY    = outlet.mpesa_consumer_key    || '';
                CONSUMER_SECRET = outlet.mpesa_consumer_secret || '';
                SHORTCODE       = outlet.mpesa_shortcode       || '';
                PASSKEY         = outlet.mpesa_passkey         || '';
            }
        }

        if (!CONSUMER_KEY || !CONSUMER_SECRET || !SHORTCODE || !PASSKEY) {
            // No credentials — just return pending, keep polling DB
            return NextResponse.json({ success: false, status: 'pending', message: 'Transaction still pending' });
        }

        const BASE_URL    = 'production' === 'production' ? MPESA_LIVE_URL : MPESA_SANDBOX_URL;
        const authString  = Buffer.from(CONSUMER_KEY + ':' + CONSUMER_SECRET).toString('base64');
        const tokenRes    = await fetch(BASE_URL + '/oauth/v1/generate?grant_type=client_credentials', {
            method: 'GET', headers: { Authorization: 'Basic ' + authString },
        });

        if (!tokenRes.ok) {
            return NextResponse.json({ success: false, status: 'pending', message: 'Could not get token, retrying...' });
        }

        const { access_token: accessToken } = await tokenRes.json();

        const now       = new Date();
        const timestamp = [
            now.getFullYear(),
            String(now.getMonth() + 1).padStart(2, '0'),
            String(now.getDate()).padStart(2, '0'),
            String(now.getHours()).padStart(2, '0'),
            String(now.getMinutes()).padStart(2, '0'),
            String(now.getSeconds()).padStart(2, '0'),
        ].join('');
        const password = Buffer.from(SHORTCODE + PASSKEY + timestamp).toString('base64');

        const queryRes  = await fetch(BASE_URL + '/mpesa/stkpushquery/v1/query', {
            method: 'POST',
            headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
            body: JSON.stringify({ BusinessShortCode: SHORTCODE, Password: password, Timestamp: timestamp, CheckoutRequestID: checkoutRequestId }),
        });
        const queryData = await queryRes.json();
        console.log('[M-Pesa Status] Safaricom query response:', queryData);

        if (queryData.ResultCode !== undefined) {
            const rc = parseInt(String(queryData.ResultCode));
            if (rc === 0) {
                return NextResponse.json({ success: true, ResultCode: 0, resultCode: 0, ResultDesc: queryData.ResultDesc, resultDesc: queryData.ResultDesc, status: 'completed' });
            }
            const desc          = queryData.ResultDesc || '';
            const isClearFail   = rc === 1 || rc === 2001 || desc.toLowerCase().includes('insufficient') || desc.toLowerCase().includes('wrong pin') || desc.toLowerCase().includes('cancelled');
            return NextResponse.json({ success: false, ResultCode: rc, resultCode: rc, ResultDesc: desc, resultDesc: desc, status: isClearFail ? 'failed' : 'pending' });
        }

        return NextResponse.json({ success: false, status: 'pending', message: 'Transaction still pending' });

    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[M-Pesa Status] Error:', msg);
        return NextResponse.json({ success: false, status: 'pending', error: msg });
    }
}