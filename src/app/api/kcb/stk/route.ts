// ═══════════════════════════════════════════════════════════════
// ALPHA RETAIL — KCB Buni STK Push
// POST /api/kcb/stk
//
// Credentials are read from retail_outlets table (NOT hardcoded).
// Each outlet has its own kcb_consumer_key, kcb_consumer_secret,
// kcb_till_number — configured via /dashboard/kcb-settings.
//
// Token URL:  https://accounts.buni.kcbgroup.com/oauth2/token
// STK URL:    https://uat.buni.kcbgroup.com/mm/api/request/1.0.0/stkpush
// ═══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// Service-role client for reading outlet KCB credentials securely
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const KCB_ROUTE_CODE   = '207';
const KCB_CALLBACK_URL = process.env.KCB_CALLBACK_URL || 'https://alpha-retail.vercel.app/api/kcb/callback';
const TOKEN_URL        = 'https://accounts.buni.kcbgroup.com/oauth2/token';
const STK_URL          = 'https://uat.buni.kcbgroup.com/mm/api/request/1.0.0/stkpush';

// Cooldown: KCB blocks same phone within ~90 seconds
const lastPushTime = new Map<string, number>();
const KCB_COOLDOWN_MS = 90_000;

// Step 1: Get OAuth2 Bearer token using outlet's own credentials
async function getKCBToken(consumerKey: string, consumerSecret: string): Promise<string> {
    const credentials = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
    const res = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type':  'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
    });
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`KCB OAuth token error ${res.status}: ${err}`);
    }
    const data = await res.json();
    if (!data.access_token) throw new Error('No access_token in KCB OAuth response');
    return data.access_token;
}

// Step 2: Fire STK Push
async function fireKCBSTK(token: string, params: {
    phone: string; amount: number; invoiceNumber: string;
}) {
    const body = {
        phoneNumber:            params.phone,
        amount:                 String(Math.round(params.amount)),
        invoiceNumber:          params.invoiceNumber,
        sharedShortCode:        true,
        orgShortCode:           '',
        orgPassKey:             '',
        callbackUrl:            KCB_CALLBACK_URL,
        transactionDescription: 'Sale Payment',  // max 13 chars
    };

    console.log('[KCB Retail STK] Payload:', JSON.stringify(body));

    const res = await fetch(STK_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type':  'application/json',
            'accept':        'application/json',
            'routeCode':     KCB_ROUTE_CODE,
            'operation':     'STKPush',
            'messageId':     `RETAIL_${Date.now()}`,
        },
        body: JSON.stringify(body),
    });

    const text = await res.text();
    console.log('[KCB Retail STK] Response:', res.status, text);
    let data: any = {};
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    return { data, httpStatus: res.status };
}

// Main handler
export async function POST(req: NextRequest) {
    try {
        const { phone, amount, outletId, saleId } = await req.json();

        if (!phone || !amount || !outletId) {
            return NextResponse.json({ error: 'Missing required fields: phone, amount, outletId' }, { status: 400 });
        }

        // Fetch KCB credentials from retail_outlets table
        const { data: outlet, error: outletErr } = await supabase
            .from('retail_outlets')
            .select('kcb_consumer_key, kcb_consumer_secret, kcb_till_number, kcb_enabled')
            .eq('outlet_id', outletId)
            .single();

        if (outletErr || !outlet) {
            return NextResponse.json({ error: 'Outlet not found' }, { status: 404 });
        }
        if (!outlet.kcb_enabled) {
            return NextResponse.json({ error: 'KCB Buni is not enabled for this outlet' }, { status: 400 });
        }
        if (!outlet.kcb_consumer_key || !outlet.kcb_consumer_secret) {
            return NextResponse.json({ error: 'KCB credentials not configured. Go to KCB Settings to set up.' }, { status: 400 });
        }

        // Phone normalization → 254XXXXXXXXX
        let normalizedPhone = String(phone).replace(/[\s\-\(\)]/g, '');
        if (normalizedPhone.startsWith('+'))  normalizedPhone = normalizedPhone.slice(1);
        if (normalizedPhone.startsWith('0'))  normalizedPhone = '254' + normalizedPhone.slice(1);
        if (normalizedPhone.length === 9)     normalizedPhone = '254' + normalizedPhone;

        if (!/^254\d{9}$/.test(normalizedPhone)) {
            return NextResponse.json({
                error: `Invalid phone number. Use format: 0712345678 (got: ${normalizedPhone})`,
            }, { status: 400 });
        }

        console.log('[KCB Retail] Phone:', String(phone), '→', normalizedPhone, '| Outlet:', outletId);

        // Cooldown check
        const now = Date.now();
        const lastPush = lastPushTime.get(normalizedPhone);
        if (lastPush && (now - lastPush) < KCB_COOLDOWN_MS) {
            const waitSecs = Math.ceil((KCB_COOLDOWN_MS - (now - lastPush)) / 1000);
            return NextResponse.json({
                error: `STK push already sent. Check your phone, or wait ${waitSecs}s to retry.`,
            }, { status: 429 });
        }

        // invoiceNumber: till-saleId for traceability
        const tillNumber   = outlet.kcb_till_number || outletId;
        const invoiceNumber = `${tillNumber}-${saleId || Date.now()}`;

        // Get token & fire STK
        const token = await getKCBToken(outlet.kcb_consumer_key, outlet.kcb_consumer_secret);
        const { data: result, httpStatus } = await fireKCBSTK(token, {
            phone:         normalizedPhone,
            amount:        Number(amount),
            invoiceNumber,
        });

        // Parse KCB response
        const statusCode    = result?.header?.statusCode;
        const rawDesc       = result?.header?.statusDescription || result?.message || result?.description || 'Unknown KCB error';
        const isSuccess     = httpStatus === 200 && (statusCode === '0' || statusCode === 0);
        const kcbCheckoutId = result?.response?.CheckoutRequestID || invoiceNumber;

        // Log to retail_kcb_stk_requests
        await supabase.from('retail_kcb_stk_requests').insert([{
            checkout_request_id: kcbCheckoutId,
            merchant_request_id: result?.response?.MerchantRequestID || invoiceNumber,
            outlet_id:           Number(outletId),
            sale_id:             String(saleId || ''),
            amount:              Number(amount),
            phone:               normalizedPhone,
            status:              'Pending',
            invoice_number:      invoiceNumber,
            created_at:          new Date().toISOString(),
        }]).then(({ error: e }) => {
            if (e) console.error('[KCB Retail] DB log error:', e.message);
        });

        // Friendly errors
        let friendlyMsg = rawDesc;
        if (rawDesc.toLowerCase().includes('busy'))      friendlyMsg = 'KCB system is busy. Please wait 30 seconds and try again.';
        if (rawDesc.toLowerCase().includes('duplicate')) friendlyMsg = 'Duplicate request. Please wait 60 seconds before retrying.';
        if (rawDesc.toLowerCase().includes('invalid'))   friendlyMsg = 'Invalid request. Please check the phone number.';

        console.log('[KCB Retail] statusCode:', statusCode, '| http:', httpStatus, '| kcbId:', kcbCheckoutId);

        if (isSuccess) {
            lastPushTime.set(normalizedPhone, Date.now());
            return NextResponse.json({
                success:           true,
                checkoutRequestId: kcbCheckoutId,
                message:           'KCB STK Push sent! Check phone for M-Pesa prompt.',
            });
        }

        return NextResponse.json({ error: friendlyMsg, code: statusCode, raw: result }, { status: 400 });

    } catch (err: any) {
        console.error('[KCB Retail STK] Error:', err.message);
        return NextResponse.json({ error: err.message || 'KCB STK Push failed' }, { status: 500 });
    }
}

export async function GET() {
    return NextResponse.json({ status: 'Alpha Retail KCB Buni STK Active', time: new Date().toISOString() });
}
