import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function getAdminClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    if (!url || !key) return null;
    return createClient(url, key);
}

async function saveToOrganisationSettings(
    supabase: any,
    key: string,
    value: string,
    description: string
) {
    try {
        const now = new Date().toISOString();
        const { data: updated, error: updateErr } = await supabase
            .from('organisation_settings')
            .update({ setting_value: value, updated_at: now })
            .eq('setting_key', key)
            .select('setting_key');

        if (!updateErr && (!updated || updated.length === 0)) {
            await supabase.from('organisation_settings').insert({
                setting_key: key,
                setting_value: value,
                setting_type: 'boolean',
                description,
                updated_at: now,
            });
        }
    } catch {
        /* best-effort sync when table uses RLS */
    }
}

export async function GET(req: NextRequest) {
    try {
        const supabase = getAdminClient();
        if (!supabase) {
            return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
        }

        const outletIdParam = req.nextUrl.searchParams.get('outletId');

        const [{ data: rsRows, error: rsErr }, { data: orgRows }] = await Promise.all([
            supabase
                .from('retail_settings')
                .select('setting_key, setting_value')
                .like('setting_key', 'prevent_negative_stock%'),
            supabase
                .from('organisation_settings')
                .select('setting_key, setting_value')
                .like('setting_key', 'prevent_negative_stock%'),
        ]);

        const merged: Record<string, string> = {};
        // Legacy fallback from organisation_settings first, then retail_settings overrides
        (orgRows || []).forEach((r: any) => {
            if (r.setting_key) merged[r.setting_key] = r.setting_value;
        });
        (rsRows || []).forEach((r: any) => {
            if (r.setting_key) merged[r.setting_key] = r.setting_value;
        });

        const globalVal = merged['prevent_negative_stock'] === 'true';
        const perOutlet: Record<string, boolean> = {};
        for (const [k, v] of Object.entries(merged)) {
            if (k.startsWith('prevent_negative_stock_')) {
                const idPart = k.replace('prevent_negative_stock_', '');
                perOutlet[idPart] = v === 'true';
            }
        }

        const effective =
            outletIdParam && outletIdParam in perOutlet
                ? perOutlet[outletIdParam]
                : globalVal;

        return NextResponse.json(
            {
                ok: !rsErr,
                prevent_negative_stock: globalVal,
                perOutlet,
                effective,
            },
            { headers: { 'Cache-Control': 'no-store, max-age=0' } }
        );
    } catch (err: any) {
        return NextResponse.json({ error: err?.message || 'Failed to load settings' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const supabase = getAdminClient();
        if (!supabase) {
            return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
        }

        const body = await req.json();
        const now = new Date().toISOString();

        // Single arbitrary key/value save (for prevent_negative_stock* or non-secret org prefs)
        if (typeof body.setting_key === 'string' && body.setting_value !== undefined) {
            const key = body.setting_key.trim();
            if (key.includes('smtp') || key.includes('pass') || key.includes('secret') || key.includes('token')) {
                return NextResponse.json({ error: 'Invalid setting key' }, { status: 400 });
            }
            const val = String(body.setting_value);
            const desc = body.description || 'POS operational setting';

            const { error: rsErr } = await supabase.from('retail_settings').upsert(
                {
                    setting_key: key,
                    setting_value: val,
                    setting_type: 'boolean',
                    description: desc,
                    updated_at: now,
                },
                { onConflict: 'setting_key' }
            );
            await saveToOrganisationSettings(supabase, key, val, desc);

            if (rsErr) {
                return NextResponse.json({ ok: false, error: rsErr.message }, { status: 500 });
            }
            return NextResponse.json({ ok: true });
        }

        // Boolean toggle save (supports global + syncing all outlets)
        if (typeof body.prevent_negative_stock === 'boolean') {
            const valStr = String(body.prevent_negative_stock);
            const desc = 'Prevent cashiers from selling items when stock is 0 or would go negative';
            const rowsToUpsert: Array<Record<string, any>> = [];

            if (body.outlet_id) {
                const key = `prevent_negative_stock_${body.outlet_id}`;
                rowsToUpsert.push({
                    setting_key: key,
                    setting_value: valStr,
                    setting_type: 'boolean',
                    description: `${desc} (Outlet ${body.outlet_id})`,
                    updated_at: now,
                });
                await saveToOrganisationSettings(supabase, key, valStr, desc);
            } else {
                rowsToUpsert.push({
                    setting_key: 'prevent_negative_stock',
                    setting_value: valStr,
                    setting_type: 'boolean',
                    description: desc,
                    updated_at: now,
                });
                await saveToOrganisationSettings(supabase, 'prevent_negative_stock', valStr, desc);

                if (body.syncAllOutlets) {
                    const { data: outlets } = await supabase
                        .from('retail_outlets')
                        .select('outlet_id');
                    for (const o of outlets || []) {
                        const oKey = `prevent_negative_stock_${o.outlet_id}`;
                        rowsToUpsert.push({
                            setting_key: oKey,
                            setting_value: valStr,
                            setting_type: 'boolean',
                            description: `${desc} (Outlet ${o.outlet_id})`,
                            updated_at: now,
                        });
                        await saveToOrganisationSettings(supabase, oKey, valStr, desc);
                    }
                }
            }

            const { error: upsertErr } = await supabase
                .from('retail_settings')
                .upsert(rowsToUpsert, { onConflict: 'setting_key' });

            if (upsertErr) {
                return NextResponse.json({ ok: false, error: upsertErr.message }, { status: 500 });
            }

            return NextResponse.json({ ok: true, prevent_negative_stock: body.prevent_negative_stock });
        }

        return NextResponse.json({ error: 'Missing valid payload' }, { status: 400 });
    } catch (err: any) {
        return NextResponse.json({ ok: false, error: err?.message || 'Failed to save POS settings' }, { status: 500 });
    }
}
