import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const MPESA_LIVE_URL    = 'https://api.safaricom.co.ke';
const MPESA_SANDBOX_URL = 'https://sandbox.safaricom.co.ke';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const {
            phone, amount, accountReference, transactionDesc, outletId,
            consumerKey: bodyConsumerKey,
            consumerSecret: bodyConsumerSecret,
            shortCode: bodyShortCode,
            tillNumber: bodyTillNumber,
            passKey: bodyPassKey,
            callbackUrl: bodyCallbackUrl,
            environment: bodyEnvironment,
            accountType: bodyAccountType,
        } = body;

        console.log('[M-Pesa STK] outletId:', outletId, 'phone:', phone, 'amount:', amount);

        let CONSUMER_KEY    = bodyConsumerKey    || '';
        let CONSUMER_SECRET = bodyConsumerSecret || '';
        let SHORTCODE       = bodyShortCode      || '';
        let TILL_NUMBER     = bodyTillNumber     || '';
        let PASSKEY         = bodyPassKey        || '';
        let CALLBACK_URL    = bodyCallbackUrl    || '';
        const ENVIRONMENT   = bodyEnvironment    || 'production';
        const ACCOUNT_TYPE  = bodyAccountType    || 'Till';

        if (outletId && (!CONSUMER_KEY || !CONSUMER_SECRET || !SHORTCODE)) {
            const { data: outlet } = await supabase
                .from('retail_outlets')
                .select('mpesa_consumer_key,mpesa_consumer_secret,mpesa_shortcode,mpesa_till_number,mpesa_passkey,mpesa_callback_url')
                .eq('outlet_id', outletId)
                .single();
            if (outlet) {
                CONSUMER_KEY    = CONSUMER_KEY    || outlet.mpesa_consumer_key    || '';
                CONSUMER_SECRET = CONSUMER_SECRET || outlet.mpesa_consumer_secret || '';
                SHORTCODE       = SHORTCODE       || outlet.mpesa_shortcode       || '';
                TILL_NUMBER     = TILL_NUMBER     || outlet.mpesa_till_number     || '';
                PASSKEY         = PASSKEY         || outlet.mpesa_passkey         || '';
                CALLBACK_URL    = CALLBACK_URL    || outlet.mpesa_callback_url    || '';
            }
        }

        // For Buy Goods (Lipa na Mpesa):
        //   BusinessShortCode = SHORTCODE (4501727) — org shortcode in Daraja
        //   PartyB            = TILL_NUMBER (3150733) — the actual till
        //   Password          = base64(SHORTCODE + Passkey + Timestamp)
        // For Paybill:
        //   BusinessShortCode = PartyB = SHORTCODE
        const IS_TILL      = ACCOUNT_TYPE.toLowerCase() !== 'paybill';
        const BSSC         = SHORTCODE;
        const PARTY_B      = (IS_TILL && TILL_NUMBER) ? TILL_NUMBER : SHORTCODE;
        const TRANS_TYPE   = IS_TILL ? 'CustomerBuyGoodsOnline' : 'CustomerPayBillOnline';

        console.log('[M-Pesa STK] BSSC:', BSSC, 'PartyB:', PARTY_B, 'type:', TRANS_TYPE);

        if (!CONSUMER_KEY || !CONSUMER_SECRET || !BSSC || !PASSKEY) {
            console.error('[M-Pesa STK] Missing credentials. BSSC:', BSSC, 'CK:', !!CONSUMER_KEY);
            return NextResponse.json({ success: false, error: 'M-Pesa credentials not configured.' }, { status: 400 });
        }

        const BASE_URL   = ENVIRONMENT === 'production' ? MPESA_LIVE_URL : MPESA_SANDBOX_URL;
        const authString = Buffer.from(CONSUMER_KEY + ':' + CONSUMER_SECRET).toString('base64');
        const tokenRes   = await fetch(BASE_URL + '/oauth/v1/generate?grant_type=client_credentials', {
            method: 'GET', headers: { Authorization: 'Basic ' + authString },
        });
        if (!tokenRes.ok) {
            const errText = await tokenRes.text();
            console.error('[M-Pesa STK] Token error:', errText);
            return NextResponse.json({ success: false, error: 'Failed to get access token.' }, { status: 500 });
        }
        const { access_token: accessToken } = await tokenRes.json();

        const now = new Date();
        const timestamp = [
            now.getFullYear(),
            String(now.getMonth() + 1).padStart(2, '0'),
            String(now.getDate()).padStart(2, '0'),
            String(now.getHours()).padStart(2, '0'),
            String(now.getMinutes()).padStart(2, '0'),
            String(now.getSeconds()).padStart(2, '0'),
        ].join('');
        const password = Buffer.from(BSSC + PASSKEY + timestamp).toString('base64');

        const finalCallback = CALLBACK_URL || 'https://alpha-retail.vercel.app/api/mpesa/callback';

        const stkPayload = {
            BusinessShortCode: BSSC,
            Password:          password,
            Timestamp:         timestamp,
            TransactionType:   TRANS_TYPE,
            Amount:            Math.ceil(Number(amount)),
            PartyA:            phone,
            PartyB:            PARTY_B,
            PhoneNumber:       phone,
            CallBackURL:       finalCallback,
            AccountReference:  accountReference || 'Payment',
            TransactionDesc:   transactionDesc  || 'Payment',
        };

        console.log('[M-Pesa STK] Final — BSSC:', BSSC, 'PartyB:', PARTY_B, 'callback:', finalCallback);

        const stkRes  = await fetch(BASE_URL + '/mpesa/stkpush/v1/processrequest', {
            method: 'POST',
            headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
            body: JSON.stringify(stkPayload),
        });
        const stkData = await stkRes.json();
        console.log('[M-Pesa STK] Safaricom response:', stkData);

        if (stkData.ResponseCode === '0') {
            return NextResponse.json({
                success: true, message: 'STK Push sent successfully',
                CheckoutRequestID:   stkData.CheckoutRequestID,
                checkout_request_id: stkData.CheckoutRequestID,
                MerchantRequestID:   stkData.MerchantRequestID,
            });
        }
        return NextResponse.json({ success: false, error: stkData.errorMessage || stkData.ResponseDescription || 'STK Push failed', details: stkData }, { status: 400 });

    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[M-Pesa STK] Error:', msg);
        return NextResponse.json({ success: false, error: msg }, { status: 500 });
    }
}

export async function GET() {
    return NextResponse.json({ status: 'Alpha Retail M-Pesa STK Active', time: new Date().toISOString() });
}