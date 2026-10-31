'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import {
    FiShield, FiLock, FiUnlock, FiAlertTriangle, FiCheck, FiX,
    FiRefreshCw, FiSearch, FiClock, FiEye, FiSave,
    FiCheckCircle, FiChevronRight, FiSliders
} from 'react-icons/fi';

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

// ── Standard Professional Notice Presets ────────────────────────────────────
const MESSAGE_PRESETS = [
    {
        tag: 'Cloud Overdue',
        text: 'Cloud access has ended. Please pay for cloud hosting to avoid interruptions and restore your POS service immediately.'
    },
    {
        tag: 'Subscription Expired',
        text: 'Your monthly software subscription has expired. Please remit payment to reactivate all branch terminals.'
    },
    {
        tag: 'Account On Hold',
        text: 'Your branch account is temporarily on hold pending payment verification. Your sales data is safe. Contact support to resume.'
    },
    {
        tag: 'Maintenance',
        text: 'System access is temporarily paused for scheduled maintenance and cloud sync. Access will resume shortly.'
    }
];

export default function SystemLockoutPage() {
    const router = useRouter();
    const [authChecked, setAuthChecked]   = useState(false);
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);
    const [outlets, setOutlets]           = useState<OutletLockState[]>([]);
    const [loading, setLoading]           = useState(true);
    const [searchTerm, setSearchTerm]     = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'locked'>('all');
    const [previewOutlet, setPreviewOutlet] = useState<OutletLockState | null>(null);

    // ── SUPER ADMIN GUARD — Strict enforcement ──────────────────────────────
    useEffect(() => {
        try {
            const raw = localStorage.getItem('user') || '{}';
            const u   = JSON.parse(raw);
            const t   = (u.userType || u.user_type || '').toLowerCase().replace(/\s/g, '');
            if (t === 'superadmin' || t === 'superuser') {
                setIsSuperAdmin(true);
            } else {
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

        const defaultNotice = MESSAGE_PRESETS[0].text;

        const result: OutletLockState[] = (outletData || []).map((o: any) => ({
            outlet_id:   o.outlet_id,
            outlet_name: o.outlet_name,
            outlet_code: o.outlet_code,
            locked:      sm[`system_lockout_outlet_${o.outlet_id}`] === 'true',
            reason:      sm[`system_lockout_reason_${o.outlet_id}`] || defaultNotice,
            locked_at:   sm[`system_lockout_at_${o.outlet_id}`] || '',
            saving:      false,
            reasonDirty: false,
        }));

        setOutlets(result);
        setLoading(false);
    }, []);

    useEffect(() => { if (isSuperAdmin) load(); }, [isSuperAdmin, load]);

    // ── Helper to save key-value without requiring unique constraint on setting_key ──
    const saveSetting = async (key: string, value: string, desc = '', type = 'text') => {
        const { data: existing } = await supabase
            .from('organisation_settings')
            .select('id')
            .eq('setting_key', key)
            .limit(1);

        const now = new Date().toISOString();
        if (existing && existing.length > 0) {
            const { error } = await supabase
                .from('organisation_settings')
                .update({ setting_value: value, updated_at: now })
                .eq('id', existing[0].id);
            if (error) throw error;
        } else {
            const { error } = await supabase
                .from('organisation_settings')
                .insert({
                    setting_key: key,
                    setting_value: value,
                    setting_type: type,
                    description: desc,
                    updated_at: now
                });
            if (error) throw error;
        }
    };

    // ── Toggle lock for single outlet ──────────────────────────────────────
    const toggleLock = async (outletId: number) => {
        const outlet = outlets.find(o => o.outlet_id === outletId);
        if (!outlet) return;
        const newLocked = !outlet.locked;
        const now = new Date().toISOString();

        setOutlets(prev => prev.map(o => o.outlet_id === outletId ? { ...o, saving: true } : o));

        try {
            await saveSetting(`system_lockout_outlet_${outletId}`, String(newLocked), `Lockout state for outlet ${outletId}`, 'boolean');
            await saveSetting(`system_lockout_at_${outletId}`, now, `Lockout timestamp for outlet ${outletId}`, 'text');

            setOutlets(prev => prev.map(o =>
                o.outlet_id === outletId ? { ...o, locked: newLocked, locked_at: now, saving: false } : o
            ));

            if (newLocked) {
                toast.error(`🔒 ${outlet.outlet_name} is now locked.`);
            } else {
                toast.success(`✅ ${outlet.outlet_name} access restored.`);
            }
        } catch (err: any) {
            setOutlets(prev => prev.map(o => o.outlet_id === outletId ? { ...o, saving: false } : o));
            toast.error('Failed to update status: ' + (err.message || 'Unknown error'));
        }
    };

    // ── Save lockout reason notice ─────────────────────────────────────────
    const saveReason = async (outletId: number) => {
        const outlet = outlets.find(o => o.outlet_id === outletId);
        if (!outlet) return;
        try {
            await saveSetting(
                `system_lockout_reason_${outletId}`,
                outlet.reason.trim(),
                `Custom suspension notice for outlet ${outletId}`,
                'text'
            );
            setOutlets(prev => prev.map(o => o.outlet_id === outletId ? { ...o, reasonDirty: false } : o));
            toast.success(`✅ Message updated for ${outlet.outlet_name}`);
        } catch (err: any) {
            toast.error('Failed to save message: ' + (err.message || ''));
        }
    };

    // ── Apply preset message to outlet ─────────────────────────────────────
    const applyPreset = (outletId: number, text: string) => {
        setOutlets(prev => prev.map(o =>
            o.outlet_id === outletId ? { ...o, reason: text, reasonDirty: true } : o
        ));
    };

    // ── Global batch operations ────────────────────────────────────────────
    const setAllLocks = async (lockState: boolean) => {
        const targets = outlets.filter(o => o.locked !== lockState);
        if (targets.length === 0) {
            toast('All outlets are already in the requested state.');
            return;
        }

        const now = new Date().toISOString();
        setLoading(true);
        try {
            for (const o of targets) {
                await saveSetting(`system_lockout_outlet_${o.outlet_id}`, String(lockState), `Batch lockout for outlet ${o.outlet_id}`, 'boolean');
                await saveSetting(`system_lockout_at_${o.outlet_id}`, now, `Batch lockout timestamp for outlet ${o.outlet_id}`, 'text');
            }

            setOutlets(prev => prev.map(o => ({ ...o, locked: lockState, locked_at: now })));
            if (lockState) {
                toast.error(`🔒 All ${targets.length} outlets are now locked.`);
            } else {
                toast.success(`✅ All ${targets.length} outlets have been restored.`);
            }
        } catch (err: any) {
            toast.error('Failed batch operation: ' + (err.message || ''));
        } finally {
            setLoading(false);
        }
    };

    // ── Filtered Outlets ───────────────────────────────────────────────────
    const filteredOutlets = useMemo(() => {
        return outlets.filter(o => {
            const matchesSearch = o.outlet_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                  o.outlet_code.toLowerCase().includes(searchTerm.toLowerCase());
            if (!matchesSearch) return false;
            if (statusFilter === 'active') return !o.locked;
            if (statusFilter === 'locked') return o.locked;
            return true;
        });
    }, [outlets, searchTerm, statusFilter]);

    const totalCount  = outlets.length;
    const lockedCount = outlets.filter(o => o.locked).length;
    const activeCount = outlets.filter(o => !o.locked).length;

    if (!authChecked || !isSuperAdmin) {
        return null;
    }

    return (
        <div className="max-w-6xl mx-auto pb-16 px-3 sm:px-6 text-slate-800">
            {/* ── Sleek Minimalist Header (No big banners) ────────────────── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-4 mb-4 border-b border-slate-200">
                <div>
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-1">
                        <span>Admin</span>
                        <FiChevronRight size={12} />
                        <span className="text-indigo-600 font-bold">System Access Control</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                            Subscription & System Lockout
                        </h1>
                        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                            Super Admin Only
                        </span>
                    </div>
                    <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
                        Instantly block or restore branch access when subscription payments lapse.
                    </p>
                </div>

                {/* Header Action Buttons */}
                <div className="flex items-center gap-2 shrink-0">
                    <button
                        onClick={load}
                        disabled={loading}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 text-xs font-semibold shadow-xs transition-all active:scale-95"
                    >
                        <FiRefreshCw className={loading ? 'animate-spin' : ''} size={13} />
                        <span>Refresh</span>
                    </button>
                    <button
                        onClick={() => setAllLocks(false)}
                        disabled={loading || lockedCount === 0}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        <FiCheckCircle size={13} />
                        <span>Restore All</span>
                    </button>
                    <button
                        onClick={() => setAllLocks(true)}
                        disabled={loading || activeCount === 0}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        <FiLock size={13} />
                        <span>Lock All</span>
                    </button>
                </div>
            </div>

            {/* ── Compact Bright Metric Strip ──────────────────────────────── */}
            <div className="grid grid-cols-3 gap-3 mb-5">
                <div className="bg-white rounded-xl p-3.5 border border-slate-200/90 shadow-xs flex items-center justify-between">
                    <div>
                        <div className="text-[11px] font-medium text-slate-400">Total Outlets</div>
                        <div className="text-xl font-bold text-slate-800">{totalCount}</div>
                    </div>
                    <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                        All
                    </span>
                </div>

                <div className="bg-white rounded-xl p-3.5 border border-emerald-200/80 shadow-xs flex items-center justify-between">
                    <div>
                        <div className="text-[11px] font-medium text-emerald-600">Active & Online</div>
                        <div className="text-xl font-bold text-emerald-700">{activeCount}</div>
                    </div>
                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                        ● Live
                    </span>
                </div>

                <div className="bg-white rounded-xl p-3.5 border border-rose-200/80 shadow-xs flex items-center justify-between">
                    <div>
                        <div className="text-[11px] font-medium text-rose-600">Locked Out</div>
                        <div className="text-xl font-bold text-rose-700">{lockedCount}</div>
                    </div>
                    <span className="text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md">
                        ● Blocked
                    </span>
                </div>
            </div>

            {/* ── Search & Filter Bar ──────────────────────────────────────── */}
            <div className="bg-white rounded-xl p-3 border border-slate-200/90 shadow-xs mb-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="relative w-full sm:w-72">
                    <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        placeholder="Search outlet..."
                        className="w-full pl-9 pr-7 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-indigo-500 focus:bg-white text-slate-800"
                    />
                    {searchTerm && (
                        <button onClick={() => setSearchTerm('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                            <FiX size={12} />
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-1 w-full sm:w-auto">
                    {(['all', 'active', 'locked'] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setStatusFilter(tab)}
                            className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition-all ${
                                statusFilter === tab
                                    ? 'bg-slate-900 text-white shadow-2xs'
                                    : 'text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200'
                            }`}
                        >
                            {tab === 'all' ? `All (${totalCount})` : tab === 'active' ? `Active (${activeCount})` : `Locked (${lockedCount})`}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Outlets List ─────────────────────────────────────────────── */}
            {loading ? (
                <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
                    <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-slate-500 text-xs">Loading outlets...</p>
                </div>
            ) : filteredOutlets.length === 0 ? (
                <div className="bg-white rounded-2xl p-10 text-center border border-slate-200">
                    <p className="text-slate-600 text-sm font-semibold">No outlets found</p>
                    <p className="text-slate-400 text-xs mt-0.5">Try clearing your search term.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filteredOutlets.map(outlet => {
                        const isLocked = outlet.locked;
                        return (
                            <div
                                key={outlet.outlet_id}
                                className={`bg-white rounded-2xl border transition-all duration-200 p-4 sm:p-5 shadow-xs ${
                                    isLocked
                                        ? 'border-rose-300 bg-rose-50/20'
                                        : 'border-slate-200 hover:border-slate-300'
                                }`}
                            >
                                {/* Outlet Row Header */}
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                                            isLocked
                                                ? 'bg-rose-100 text-rose-700'
                                                : 'bg-indigo-50 text-indigo-700'
                                        }`}>
                                            {isLocked ? <FiLock size={15} /> : outlet.outlet_name.charAt(0)}
                                        </div>

                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h2 className="text-sm sm:text-base font-bold text-slate-900">
                                                    {outlet.outlet_name}
                                                </h2>
                                                <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                                                    {outlet.outlet_code}
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                                                    isLocked
                                                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                }`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${isLocked ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                                                    {isLocked ? 'Access Blocked' : 'Active & Authorized'}
                                                </span>

                                                {outlet.locked_at && isLocked && (
                                                    <span className="text-[10px] text-slate-400">
                                                        · Locked: {new Date(outlet.locked_at).toLocaleDateString('en-GB')}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex items-center gap-2 self-end sm:self-center">
                                        <button
                                            type="button"
                                            onClick={() => setPreviewOutlet(outlet)}
                                            className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 text-xs font-semibold flex items-center gap-1"
                                            title="Preview screen"
                                        >
                                            <FiEye size={12} />
                                            <span>Preview</span>
                                        </button>

                                        {/* Toggle Action */}
                                        <button
                                            onClick={() => toggleLock(outlet.outlet_id)}
                                            disabled={outlet.saving}
                                            className={`px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all active:scale-95 flex items-center gap-1.5 disabled:opacity-50 ${
                                                isLocked
                                                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                                    : 'bg-rose-600 hover:bg-rose-700 text-white'
                                            }`}
                                        >
                                            {outlet.saving ? (
                                                <div className="w-3 h-3 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                                            ) : isLocked ? (
                                                <FiUnlock size={12} />
                                            ) : (
                                                <FiLock size={12} />
                                            )}
                                            <span>{isLocked ? 'Restore Access' : 'Lock Outlet'}</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Custom Message & Quick Presets */}
                                <div className="mt-2 pt-2.5 border-t border-slate-100">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 mb-1.5">
                                        <span className="text-[11px] font-semibold text-slate-500">
                                            Lockout Notice (shown to branch staff):
                                        </span>

                                        <div className="flex items-center gap-1 flex-wrap">
                                            <span className="text-[10px] text-slate-400">Presets:</span>
                                            {MESSAGE_PRESETS.map(p => (
                                                <button
                                                    key={p.tag}
                                                    type="button"
                                                    onClick={() => applyPreset(outlet.outlet_id, p.text)}
                                                    className="text-[10px] font-semibold text-slate-600 hover:text-indigo-600 px-1.5 py-0.5 rounded bg-slate-100 hover:bg-indigo-50 transition-colors"
                                                >
                                                    {p.tag}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="flex gap-2 items-start">
                                        <textarea
                                            value={outlet.reason}
                                            onChange={e => {
                                                const v = e.target.value;
                                                setOutlets(prev => prev.map(o =>
                                                    o.outlet_id === outlet.outlet_id ? { ...o, reason: v, reasonDirty: true } : o
                                                ));
                                            }}
                                            rows={2}
                                            className={`flex-1 p-2.5 rounded-xl border text-xs font-medium focus:outline-none resize-none transition-all ${
                                                outlet.reasonDirty
                                                    ? 'border-indigo-400 bg-white ring-1 ring-indigo-100 text-slate-900'
                                                    : 'border-slate-200 bg-slate-50/50 text-slate-700 focus:bg-white'
                                            }`}
                                            placeholder="Message displayed when locked..."
                                        />

                                        <button
                                            type="button"
                                            onClick={() => saveReason(outlet.outlet_id)}
                                            disabled={!outlet.reasonDirty}
                                            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1 shrink-0 ${
                                                outlet.reasonDirty
                                                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs'
                                                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                            }`}
                                        >
                                            <FiSave size={12} />
                                            <span>Save</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ── Preview Modal ────────────────────────────────────────────── */}
            {previewOutlet && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
                    <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-xl border border-slate-200">
                        <div className="p-3.5 px-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-700">
                                Client Screen Preview · {previewOutlet.outlet_name}
                            </span>
                            <button
                                onClick={() => setPreviewOutlet(null)}
                                className="text-slate-400 hover:text-slate-700 p-1"
                            >
                                <FiX size={16} />
                            </button>
                        </div>

                        <div className="p-6 text-center bg-slate-900 text-white">
                            <div className="w-14 h-14 rounded-2xl bg-rose-600/20 border border-rose-500/40 text-rose-400 flex items-center justify-center mx-auto mb-3 text-2xl">
                                🔒
                            </div>
                            <span className="text-[10px] font-bold text-rose-400 tracking-wider uppercase bg-rose-950/60 border border-rose-500/30 px-2.5 py-0.5 rounded-full">
                                Subscription Suspended
                            </span>
                            <h3 className="text-lg font-bold text-white mt-2 mb-2">
                                Cloud Access Has Ended
                            </h3>
                            <p className="text-white/70 text-xs leading-relaxed max-w-sm mx-auto mb-4">
                                {previewOutlet.reason}
                            </p>
                            <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                                <div className="text-[10px] text-white/50 uppercase font-semibold">Contact</div>
                                <div className="text-xs font-bold text-white">Alpha Retail Support</div>
                            </div>
                        </div>

                        <div className="p-3 bg-slate-50 border-t border-slate-200 text-right">
                            <button
                                onClick={() => setPreviewOutlet(null)}
                                className="px-4 py-1.5 rounded-lg bg-slate-800 text-white text-xs font-semibold hover:bg-slate-700"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
