'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import {
    FiShield, FiCheck, FiX, FiLock, FiUnlock, FiSave,
    FiCalendar, FiAlertTriangle, FiRefreshCw, FiZap
} from 'react-icons/fi';

// ── Feature definitions ───────────────────────────────────────────────
const ALL_FEATURES = [
    { key: 'pos',              label: 'Point of Sale (POS)',               icon: '🛒', core: true },
    { key: 'advanced_reports', label: 'Advanced Reports (P&L, Balance Sheet, Trial Balance)', icon: '📊', core: false },
    { key: 'hr_payroll',       label: 'HR & Payroll Management',           icon: '👥', core: false },
    { key: 'credit_management',label: 'Credit Customer Management',        icon: '💳', core: false },
    { key: 'mpesa_integration',label: 'M-Pesa Integration',                icon: '📱', core: false },
    { key: 'multi_outlet',     label: 'Multi-Outlet Management',           icon: '🏢', core: false },
    { key: 'hotel_module',     label: 'Hotel Management Module',           icon: '🏨', core: false },
    { key: 'inventory_advanced',label: 'Advanced Inventory (Transfers, Expiry)', icon: '📦', core: false },
];

interface OutletLicense {
    outlet_id: number;
    outlet_name: string;
    outlet_code: string;
    active_license: boolean;
    features: string[];
    expires_at: string;
    dirty: boolean;
}

// ── Toggle ────────────────────────────────────────────────────────────
function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
    return (
        <button type="button" onClick={onChange}
            className={`relative w-12 h-6 rounded-full transition-all duration-300 focus:outline-none shrink-0 ${checked ? 'bg-indigo-600' : 'bg-gray-200'}`}>
            <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-all duration-300 ${checked ? 'left-6' : 'left-0.5'}`} />
        </button>
    );
}

export default function LicensePage() {
    const [licenses, setLicenses]   = useState<OutletLicense[]>([]);
    const [loading, setLoading]     = useState(true);
    const [saving, setSaving]       = useState<number | null>(null);
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);

    // ── Auth guard ────────────────────────────────────────────────────
    useEffect(() => {
        const raw = localStorage.getItem('user');
        if (raw) {
            const u = JSON.parse(raw);
            const t = (u.userType || '').toLowerCase().replace(/\s/g, '');
            setIsSuperAdmin(t === 'superadmin' || t === 'superuser');
        }
    }, []);

    // ── Load ──────────────────────────────────────────────────────────
    const loadLicenses = useCallback(async () => {
        setLoading(true);
        const { data: outlets } = await supabase.from('retail_outlets').select('outlet_id,outlet_name,outlet_code,active').order('outlet_id');
        const { data: lsData  } = await supabase.from('license_settings').select('setting_key,setting_value');

        const lsMap: Record<string, string> = {};
        (lsData || []).forEach((r: any) => { lsMap[r.setting_key] = r.setting_value || ''; });

        const result: OutletLicense[] = (outlets || []).map((o: any) => {
            const activeKey   = `outlet_license_active_${o.outlet_id}`;
            const featuresKey = `outlet_features_${o.outlet_id}`;
            const expiresKey  = `outlet_license_expires_${o.outlet_id}`;

            let features: string[] = ['pos']; // pos always included
            try {
                const parsed = JSON.parse(lsMap[featuresKey] || '["pos"]');
                if (Array.isArray(parsed)) features = parsed;
            } catch { features = ['pos']; }

            return {
                outlet_id:      o.outlet_id,
                outlet_name:    o.outlet_name,
                outlet_code:    o.outlet_code,
                active_license: lsMap[activeKey] === 'true' || !lsMap[activeKey] ? true : false,
                features,
                expires_at:     lsMap[expiresKey] || '',
                dirty: false,
            };
        });
        setLicenses(result);
        setLoading(false);
    }, []);

    useEffect(() => { loadLicenses(); }, [loadLicenses]);

    // ── Mutate helpers ────────────────────────────────────────────────
    const updateLicense = (id: number, patch: Partial<OutletLicense>) => {
        setLicenses(prev => prev.map(l => l.outlet_id === id ? { ...l, ...patch, dirty: true } : l));
    };

    const toggleFeature = (id: number, feat: string) => {
        const lic = licenses.find(l => l.outlet_id === id);
        if (!lic || feat === 'pos') return; // can't remove core POS
        const has = lic.features.includes(feat);
        updateLicense(id, { features: has ? lic.features.filter(f => f !== feat) : [...lic.features, feat] });
    };

    // ── Save single outlet license ────────────────────────────────────
    const saveOutlet = async (lic: OutletLicense) => {
        setSaving(lic.outlet_id);
        try {
            const upserts = [
                { setting_key: `outlet_license_active_${lic.outlet_id}`,  setting_value: String(lic.active_license), description: `License active for outlet ${lic.outlet_id}`, updated_at: new Date().toISOString() },
                { setting_key: `outlet_features_${lic.outlet_id}`,        setting_value: JSON.stringify(lic.features), description: `Features for outlet ${lic.outlet_id}`, updated_at: new Date().toISOString() },
                { setting_key: `outlet_license_expires_${lic.outlet_id}`, setting_value: lic.expires_at, description: `Expiry for outlet ${lic.outlet_id}`, updated_at: new Date().toISOString() },
            ];
            for (const row of upserts) {
                await supabase.from('license_settings').upsert(row, { onConflict: 'setting_key' });
            }
            setLicenses(prev => prev.map(l => l.outlet_id === lic.outlet_id ? { ...l, dirty: false } : l));
            toast.success(`✅ License updated for ${lic.outlet_name}`);
        } catch { toast.error('Failed to save license.'); }
        setSaving(null);
    };

    // ── Access denied ─────────────────────────────────────────────────
    if (!loading && !isSuperAdmin) return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center">
                <div className="w-20 h-20 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
                    <FiLock size={32} className="text-red-400" />
                </div>
                <h2 className="text-xl font-black text-gray-800 mb-2">Access Denied</h2>
                <p className="text-gray-400 text-sm">License Management is restricted to Super Administrators only.</p>
            </div>
        </div>
    );

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <div className="text-center">
                <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-gray-400 text-sm">Loading licenses...</p>
            </div>
        </div>
    );

    return (
        <div className="max-w-5xl mx-auto">
            <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}.fu{animation:fadeUp .3s ease-out}`}</style>

            {/* ── Header ── */}
            <div className="rounded-2xl overflow-hidden shadow-sm mb-6" style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
                <div className="px-8 py-6">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                            <FiShield size={22} className="text-white" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-xl font-black text-white">License Management</h1>
                                <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-white/20 text-white flex items-center gap-1">
                                    <FiZap size={8} /> SUPER ADMIN
                                </span>
                            </div>
                            <p className="text-white/65 text-sm mt-0.5">Control feature access per outlet based on payment status</p>
                        </div>
                        <button onClick={loadLicenses} className="ml-auto flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-white text-sm font-bold transition-all">
                            <FiRefreshCw size={13} /> Refresh
                        </button>
                    </div>

                    {/* Legend */}
                    <div className="flex flex-wrap gap-3">
                        {ALL_FEATURES.filter(f => !f.core).slice(0, 4).map(f => (
                            <div key={f.key} className="flex items-center gap-1.5 text-white/70 text-[11px]">
                                <span>{f.icon}</span><span>{f.label.split('(')[0].trim()}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Stats bar */}
                <div className="grid grid-cols-3 border-t border-white/20">
                    {[
                        { label: 'Total Outlets', val: licenses.length },
                        { label: 'Active Licenses', val: licenses.filter(l => l.active_license).length },
                        { label: 'Inactive/Unpaid', val: licenses.filter(l => !l.active_license).length },
                    ].map(s => (
                        <div key={s.label} className="px-6 py-3 text-center">
                            <p className="text-white font-black text-lg">{s.val}</p>
                            <p className="text-white/60 text-[11px]">{s.label}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Warning banner ── */}
            <div className="mb-5 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3">
                <FiAlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={16} />
                <div>
                    <p className="text-sm font-black text-amber-800">Important: License Changes Take Effect Immediately</p>
                    <p className="text-xs text-amber-700 mt-0.5">Disabling a license will prevent that outlet's users from accessing locked features. Always inform the outlet before making changes. Unpaid outlets should have their features restricted.</p>
                </div>
            </div>

            {/* ── Outlet License Cards ── */}
            <div className="space-y-4 fu">
                {licenses.map(lic => {
                    const isExpired = lic.expires_at && new Date(lic.expires_at) < new Date();
                    const daysLeft  = lic.expires_at ? Math.ceil((new Date(lic.expires_at).getTime() - Date.now()) / 86400000) : null;
                    return (
                        <div key={lic.outlet_id}
                            className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${lic.dirty ? 'border-indigo-300 shadow-indigo-100' : 'border-gray-100'}`}>

                            {/* Card header */}
                            <div className="px-6 py-4 flex items-center justify-between border-b border-gray-100">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-sm shadow"
                                        style={{ background: lic.active_license ? 'linear-gradient(135deg,#4f46e5,#7c3aed)' : 'linear-gradient(135deg,#94a3b8,#64748b)' }}>
                                        {lic.outlet_name.charAt(0)}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <p className="font-black text-gray-800">{lic.outlet_name}</p>
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-mono">{lic.outlet_code}</span>
                                        </div>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border flex items-center gap-1
                                                ${lic.active_license && !isExpired ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-red-50 text-red-500 border-red-200'}`}>
                                                {lic.active_license && !isExpired ? <><FiCheck size={9}/>PAID &amp; ACTIVE</> : <><FiX size={9}/>UNPAID / INACTIVE</>}
                                            </span>
                                            {daysLeft !== null && (
                                                <span className={`text-[10px] font-bold ${isExpired ? 'text-red-500' : daysLeft <= 7 ? 'text-amber-500' : 'text-gray-400'}`}>
                                                    {isExpired ? '⛔ Expired' : `${daysLeft}d left`}
                                                </span>
                                            )}
                                            {lic.dirty && <span className="text-[10px] text-indigo-500 font-bold animate-pulse">● Unsaved changes</span>}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    {/* Master license toggle */}
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-semibold text-gray-500">License Active</span>
                                        <Toggle checked={lic.active_license} onChange={() => updateLicense(lic.outlet_id, { active_license: !lic.active_license })} />
                                    </div>
                                    <button onClick={() => saveOutlet(lic)} disabled={saving === lic.outlet_id}
                                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-xs font-black transition-all hover:scale-[1.02] disabled:opacity-60 shadow"
                                        style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
                                        {saving === lic.outlet_id
                                            ? <><div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving...</>
                                            : <><FiSave size={12} />Save</>}
                                    </button>
                                </div>
                            </div>

                            {/* Expiry date */}
                            <div className="px-6 py-3 bg-gray-50/50 border-b border-gray-100 flex items-center gap-3">
                                <FiCalendar size={13} className="text-gray-400" />
                                <span className="text-xs font-semibold text-gray-500">License Expiry Date:</span>
                                <input type="date" value={lic.expires_at}
                                    onChange={e => updateLicense(lic.outlet_id, { expires_at: e.target.value })}
                                    className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
                                <span className="text-[11px] text-gray-400 ml-1">Leave empty for no expiry</span>
                            </div>

                            {/* Features grid */}
                            <div className="px-6 py-4">
                                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3">Feature Access Control</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {ALL_FEATURES.map(feat => {
                                        const enabled = lic.features.includes(feat.key);
                                        return (
                                            <div key={feat.key}
                                                className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${enabled ? 'bg-indigo-50/60 border-indigo-200' : 'bg-gray-50 border-gray-100'} ${feat.core ? 'opacity-80' : ''}`}>
                                                <span className="text-lg shrink-0">{feat.icon}</span>
                                                <div className="flex-1 min-w-0">
                                                    <p className={`text-xs font-semibold truncate ${enabled ? 'text-indigo-800' : 'text-gray-500'}`}>{feat.label}</p>
                                                    {feat.core && <p className="text-[10px] text-gray-400">Core feature — always included</p>}
                                                </div>
                                                {feat.core ? (
                                                    <span className="shrink-0 flex items-center gap-0.5 text-[9px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-200">
                                                        <FiCheck size={8} />CORE
                                                    </span>
                                                ) : (
                                                    <div className="flex items-center gap-1.5 shrink-0">
                                                        {enabled
                                                            ? <FiUnlock size={11} className="text-indigo-500" />
                                                            : <FiLock size={11} className="text-gray-400" />}
                                                        <Toggle checked={enabled} onChange={() => toggleFeature(lic.outlet_id, feat.key)} />
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Disabled overlay notice */}
                            {!lic.active_license && (
                                <div className="mx-6 mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2">
                                    <FiAlertTriangle size={13} className="text-red-500 shrink-0" />
                                    <p className="text-xs text-red-600 font-medium">
                                        <strong>License inactive.</strong> All features for <strong>{lic.outlet_name}</strong> are locked. Users will see an access restricted message. Enable license after payment is received.
                                    </p>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
