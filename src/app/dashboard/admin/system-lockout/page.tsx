'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

interface OutletLockState {
    outlet_id: number;
    outlet_name: string;
    outlet_code: string;
    locked: boolean;
    reason: string;
    locked_at: string;
    saving: boolean;
    reasonDirty: boolean;
}

// ── Pulsing lock icon ──────────────────────────────────────────────────────
function PulseLock() {
    return (
        <div className="relative">
            <div className="absolute inset-0 rounded-full bg-red-500/30 animate-ping" />
            <div className="relative w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-[10px] font-black">●</div>
        </div>
    );
}

// ── Big dramatic toggle ────────────────────────────────────────────────────
function LockToggle({ locked, saving, onToggle }: { locked: boolean; saving: boolean; onToggle: () => void }) {
    return (
        <button
            onClick={onToggle}
            disabled={saving}
            className={`relative flex items-center gap-3 px-6 py-3.5 rounded-2xl font-black text-sm transition-all duration-300 select-none disabled:opacity-70
                ${locked
                    ? 'bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-xl shadow-green-500/30 hover:scale-105 active:scale-95'
                    : 'bg-gradient-to-r from-red-500 to-rose-600 text-white shadow-xl shadow-red-500/40 hover:scale-105 active:scale-95'
                }`}
        >
            {saving ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Processing...</>
            ) : locked ? (
                <>🔓 RESTORE ACCESS</>
            ) : (
                <>🔴 LOCK SYSTEM NOW</>
            )}
        </button>
    );
}

export default function SystemLockoutPage() {
    const router = useRouter();
    const [authChecked, setAuthChecked]   = useState(false);
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);
    const [outlets, setOutlets]           = useState<OutletLockState[]>([]);
    const [loading, setLoading]           = useState(true);

    // ── SUPER ADMIN GUARD — No admin, no manager, ONLY superadmin ─────────
    useEffect(() => {
        try {
            const raw = localStorage.getItem('user') || '{}';
            const u   = JSON.parse(raw);
            const t   = (u.userType || u.user_type || '').toLowerCase().replace(/\s/g, '');
            if (t === 'superadmin' || t === 'superuser') {
                setIsSuperAdmin(true);
            } else {
                // Immediately bounce anyone who is not superadmin
                router.replace('/dashboard');
                return;
            }
        } catch {
            router.replace('/dashboard');
            return;
        }
        setAuthChecked(true);
    }, [router]);

    // ── Load outlet lockout states ─────────────────────────────────────────
    const load = useCallback(async () => {
        setLoading(true);
        const [{ data: outletData }, { data: settingsData }] = await Promise.all([
            supabase.from('retail_outlets').select('outlet_id, outlet_name, outlet_code').order('outlet_id'),
            supabase.from('organisation_settings').select('setting_key, setting_value').like('setting_key', 'system_lockout_%'),
        ]);

        const sm: Record<string, string> = {};
        (settingsData || []).forEach((r: any) => { sm[r.setting_key] = r.setting_value || ''; });

        const result: OutletLockState[] = (outletData || []).map((o: any) => ({
            outlet_id:   o.outlet_id,
            outlet_name: o.outlet_name,
            outlet_code: o.outlet_code,
            locked:      sm[`system_lockout_outlet_${o.outlet_id}`] === 'true',
            reason:      sm[`system_lockout_reason_${o.outlet_id}`] || 'Your subscription payment is overdue. Please contact Alpha Retail support to restore access.',
            locked_at:   sm[`system_lockout_at_${o.outlet_id}`] || '',
            saving:      false,
            reasonDirty: false,
        }));

        setOutlets(result);
        setLoading(false);
    }, []);

    useEffect(() => { if (isSuperAdmin) load(); }, [isSuperAdmin, load]);

    // ── Toggle lock for one outlet ─────────────────────────────────────────
    const toggleLock = async (outletId: number) => {
        const outlet = outlets.find(o => o.outlet_id === outletId);
        if (!outlet) return;
        const newLocked = !outlet.locked;
        const now = new Date().toISOString();

        setOutlets(prev => prev.map(o => o.outlet_id === outletId ? { ...o, saving: true } : o));

        try {
            const rows = [
                { setting_key: `system_lockout_outlet_${outletId}`, setting_value: String(newLocked), setting_type: 'boolean', description: `Lockout flag for outlet ${outletId}` },
                { setting_key: `system_lockout_at_${outletId}`,     setting_value: now,              setting_type: 'text',    description: `Lockout timestamp for outlet ${outletId}` },
            ];
            for (const row of rows) {
                const { error } = await supabase.from('organisation_settings').upsert(row, { onConflict: 'setting_key' });
                if (error) throw error;
            }
            setOutlets(prev => prev.map(o =>
                o.outlet_id === outletId ? { ...o, locked: newLocked, locked_at: now, saving: false } : o
            ));
            if (newLocked) {
                toast.error(`🔴 ${outlet.outlet_name} is now LOCKED — users will see the payment required screen`);
            } else {
                toast.success(`✅ ${outlet.outlet_name} access RESTORED — users can access the system again`);
            }
        } catch (err: any) {
            setOutlets(prev => prev.map(o => o.outlet_id === outletId ? { ...o, saving: false } : o));
            toast.error('Failed to update lockout: ' + (err.message || 'Unknown error'));
        }
    };

    // ── Save lockout reason message ────────────────────────────────────────
    const saveReason = async (outletId: number) => {
        const outlet = outlets.find(o => o.outlet_id === outletId);
        if (!outlet) return;
        const { error } = await supabase.from('organisation_settings').upsert(
            { setting_key: `system_lockout_reason_${outletId}`, setting_value: outlet.reason, setting_type: 'text', description: `Lockout message for outlet ${outletId}` },
            { onConflict: 'setting_key' }
        );
        if (error) toast.error('Failed to save message');
        else {
            setOutlets(prev => prev.map(o => o.outlet_id === outletId ? { ...o, reasonDirty: false } : o));
            toast.success('✅ Lockout message saved');
        }
    };

    // ── Lock / unlock ALL outlets ─────────────────────────────────────────
    const lockAll = async () => {
        for (const o of outlets) { if (!o.locked) await toggleLock(o.outlet_id); }
    };
    const unlockAll = async () => {
        for (const o of outlets) { if (o.locked) await toggleLock(o.outlet_id); }
    };

    // ── Loading / auth ─────────────────────────────────────────────────────
    if (!authChecked || (!isSuperAdmin && !authChecked)) return null;

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <div className="text-center">
                <div className="w-10 h-10 border-4 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-gray-500 text-sm font-semibold">Loading system access controls...</p>
            </div>
        </div>
    );

    if (!isSuperAdmin) return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center">
                <div className="text-6xl mb-4">🚫</div>
                <h2 className="text-xl font-black text-gray-800 mb-2">Access Denied</h2>
                <p className="text-gray-400 text-sm">This page is restricted to Super Administrators only.</p>
            </div>
        </div>
    );

    const lockedCount   = outlets.filter(o => o.locked).length;
    const activeCount   = outlets.filter(o => !o.locked).length;

    return (
        <div className="max-w-4xl mx-auto pb-12">
            <style>{`
                @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
                .fu { animation: fadeUp .35s ease-out; }
                @keyframes glow { 0%,100%{box-shadow:0 0 20px rgba(239,68,68,.4)} 50%{box-shadow:0 0 40px rgba(239,68,68,.8)} }
                .locked-glow { animation: glow 2s ease-in-out infinite; }
            `}</style>

            {/* ── Dramatic Header ──────────────────────────────────────────── */}
            <div className="rounded-3xl overflow-hidden shadow-2xl mb-6 fu" style={{ background: 'linear-gradient(135deg,#0f0c29,#302b63,#24243e)' }}>
                <div className="px-8 py-8">
                    <div className="flex items-center gap-5 mb-4">
                        <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-4xl" style={{ background: 'rgba(239,68,68,.15)', border: '2px solid rgba(239,68,68,.4)' }}>
                            🔐
                        </div>
                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                <h1 className="text-3xl font-black text-white tracking-tight">System Access Control</h1>
                                <span className="text-[9px] font-black px-3 py-1.5 rounded-full flex items-center gap-1.5" style={{ background: 'rgba(239,68,68,.25)', color: '#fca5a5', border: '1px solid rgba(239,68,68,.4)' }}>
                                    ⚡ SUPER ADMIN ONLY
                                </span>
                            </div>
                            <p className="text-white/40 text-sm max-w-xl">
                                Lock or restore customer system access per outlet — instantly. When locked, all users of that outlet see a "Subscription Suspended" screen and cannot access any feature.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Stats bar */}
                <div className="grid grid-cols-3 border-t" style={{ borderColor: 'rgba(255,255,255,.08)' }}>
                    {[
                        { label: 'Total Outlets',  val: outlets.length, color: '#93c5fd', emoji: '🏢' },
                        { label: 'Access Active',  val: activeCount,    color: '#6ee7b7', emoji: '✅' },
                        { label: 'Locked Out',     val: lockedCount,    color: lockedCount > 0 ? '#fca5a5' : '#94a3b8', emoji: lockedCount > 0 ? '🔴' : '—' },
                    ].map(s => (
                        <div key={s.label} className="px-6 py-4 text-center">
                            <p className="font-black text-3xl" style={{ color: s.color }}>{s.emoji} {s.val}</p>
                            <p className="text-white/30 text-[11px] uppercase tracking-widest mt-1">{s.label}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Warning banner ──────────────────────────────────────────── */}
            <div className="mb-5 p-4 bg-red-50 border-2 border-red-300 rounded-2xl flex items-start gap-3 fu">
                <span className="text-2xl shrink-0 mt-0.5">⚠️</span>
                <div>
                    <p className="text-sm font-black text-red-800">Immediate Effect — No Confirmation Required</p>
                    <p className="text-xs text-red-600 mt-1 leading-relaxed">
                        Toggling <strong>LOCK</strong> will <strong>instantly block all users</strong> of that outlet from accessing the system — they will see a payment suspension screen. Super Admin is never affected. Toggle <strong>RESTORE ACCESS</strong> to let them back in immediately.
                    </p>
                </div>
            </div>

            {/* ── Quick actions (only if multiple outlets) ────────────────── */}
            {outlets.length > 1 && (
                <div className="flex gap-3 mb-5 fu">
                    <button onClick={lockAll}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 text-white text-xs font-black hover:bg-red-700 active:scale-95 transition-all shadow-lg shadow-red-200">
                        🔴 Lock ALL Outlets
                    </button>
                    <button onClick={unlockAll}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-black hover:bg-emerald-700 active:scale-95 transition-all shadow-lg shadow-emerald-200">
                        🔓 Restore ALL Access
                    </button>
                    <button onClick={load}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-800 text-white text-xs font-bold hover:bg-gray-700 active:scale-95 transition-all ml-auto">
                        🔄 Refresh
                    </button>
                </div>
            )}

            {/* ── Outlet cards ─────────────────────────────────────────────── */}
            <div className="space-y-4 fu">
                {outlets.map(outlet => (
                    <div key={outlet.outlet_id}
                        className={`rounded-2xl overflow-hidden border-2 transition-all duration-500 ${
                            outlet.locked
                                ? 'border-red-400 shadow-xl locked-glow'
                                : 'border-gray-200 shadow-sm'
                        }`}
                    >
                        {/* Card header */}
                        <div className={`px-6 py-5 flex items-center justify-between transition-all duration-500 ${
                            outlet.locked
                                ? 'bg-gradient-to-r from-red-700 via-rose-700 to-red-800'
                                : 'bg-gradient-to-r from-slate-800 to-gray-900'
                        }`}>
                            <div className="flex items-center gap-4">
                                {/* Outlet avatar */}
                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl border-2 font-black transition-all duration-300 ${
                                    outlet.locked
                                        ? 'bg-red-900/50 border-red-400'
                                        : 'bg-white/10 border-white/20 text-white'
                                }`}>
                                    {outlet.locked ? '🔒' : outlet.outlet_name.charAt(0)}
                                </div>
                                <div>
                                    <p className="font-black text-white text-xl">{outlet.outlet_name}</p>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-white/40 text-xs font-mono bg-white/10 px-2 py-0.5 rounded-lg">{outlet.outlet_code}</span>
                                        <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border flex items-center gap-1 ${
                                            outlet.locked
                                                ? 'bg-red-950/50 text-red-200 border-red-500'
                                                : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                        }`}>
                                            {outlet.locked ? '🔴 SYSTEM LOCKED' : '✅ FULL ACCESS'}
                                        </span>
                                        {outlet.locked && outlet.locked_at && (
                                            <span className="text-[10px] text-white/30">
                                                Locked {new Date(outlet.locked_at).toLocaleDateString('en-GB')} at {new Date(outlet.locked_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* The Big Toggle Button */}
                            <LockToggle locked={outlet.locked} saving={outlet.saving} onToggle={() => toggleLock(outlet.outlet_id)} />
                        </div>

                        {/* Lockout message section */}
                        <div className={`px-6 py-5 transition-colors ${outlet.locked ? 'bg-red-50' : 'bg-white'}`}>
                            <label className={`text-xs font-bold uppercase tracking-wider mb-2 block ${outlet.locked ? 'text-red-600' : 'text-gray-400'}`}>
                                {outlet.locked ? '🔴 Message displayed to locked-out users:' : 'Lockout message (if locked):'}
                            </label>
                            <div className="flex gap-3 items-start">
                                <textarea
                                    value={outlet.reason}
                                    onChange={e => setOutlets(prev => prev.map(o =>
                                        o.outlet_id === outlet.outlet_id ? { ...o, reason: e.target.value, reasonDirty: true } : o
                                    ))}
                                    rows={2}
                                    className={`flex-1 text-sm border-2 rounded-xl px-4 py-3 resize-none focus:outline-none transition-all ${
                                        outlet.locked
                                            ? 'border-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-100 bg-white'
                                            : 'border-gray-200 focus:border-gray-400 focus:ring-2 focus:ring-gray-100'
                                    }`}
                                    placeholder="e.g. Your subscription payment is overdue. Please contact Alpha Retail support to restore access."
                                />
                                <button
                                    onClick={() => saveReason(outlet.outlet_id)}
                                    disabled={!outlet.reasonDirty}
                                    className="px-4 py-2.5 bg-gray-900 text-white text-xs font-black rounded-xl hover:bg-gray-700 active:scale-95 transition-all self-start shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    💾 Save
                                </button>
                            </div>

                            {outlet.locked && (
                                <div className="mt-3 flex items-center gap-2 p-3 bg-red-100 border border-red-200 rounded-xl">
                                    <PulseLock />
                                    <p className="text-xs text-red-700 font-semibold">
                                        <strong>This outlet is LOCKED.</strong> All non-super-admin users will see the lockout screen until you restore access.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
