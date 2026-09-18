'use client';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { ALL_FEATURES } from '@/context/FeatureContext';
import { useRouter } from 'next/navigation';
import { FiSliders, FiCheck, FiX, FiRefreshCw } from 'react-icons/fi';

interface Outlet { outlet_id: number; outlet_name: string; }

export default function FeatureManagerPage() {
    const router = useRouter();
    const [outlets, setOutlets] = useState<Outlet[]>([]);
    const [flags, setFlags] = useState<Record<string, Record<string, boolean>>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);
    const [toast, setToast] = useState('');

    // Guard — superadmin only
    useEffect(() => {
        try {
            const u = JSON.parse(localStorage.getItem('user') || '{}');
            const t = (u.userType || u.user_type || '').toLowerCase();
            if (t !== 'superadmin' && t !== 'superuser') router.replace('/dashboard');
        } catch { router.replace('/dashboard'); }
    }, [router]);

    const load = useCallback(async () => {
        setLoading(true);
        const { data: outletData } = await supabase.from('retail_outlets').select('outlet_id, outlet_name').order('outlet_name');
        const { data: featData } = await supabase.from('retail_outlet_features').select('outlet_id, feature_key, enabled');
        const outletList: Outlet[] = outletData || [];
        setOutlets(outletList);
        const map: Record<string, Record<string, boolean>> = {};
        outletList.forEach(o => {
            map[o.outlet_id] = {};
            ALL_FEATURES.forEach(f => { map[o.outlet_id][f.key] = false; });
        });
        (featData || []).forEach((r: any) => {
            if (map[r.outlet_id]) map[r.outlet_id][r.feature_key] = r.enabled;
        });
        setFlags(map);
        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    const toggle = async (outletId: number, featureKey: string) => {
        const current = flags[outletId]?.[featureKey] ?? false;
        const newVal = !current;
        setSaving(`${outletId}-${featureKey}`);
        setFlags(prev => ({ ...prev, [outletId]: { ...prev[outletId], [featureKey]: newVal } }));
        const { error } = await supabase.from('retail_outlet_features').upsert(
            { outlet_id: outletId, feature_key: featureKey, enabled: newVal, updated_at: new Date().toISOString() },
            { onConflict: 'outlet_id,feature_key' }
        );
        if (error) {
            setFlags(prev => ({ ...prev, [outletId]: { ...prev[outletId], [featureKey]: current } }));
            setToast('Error saving — ' + error.message);
        } else {
            setToast(`${newVal ? '✅ Enabled' : '🔴 Disabled'} "${ALL_FEATURES.find(f=>f.key===featureKey)?.label}" for outlet`);
        }
        setSaving(null);
        setTimeout(() => setToast(''), 3000);
    };

    const categories = [...new Set(ALL_FEATURES.map(f => f.category))];

    return (
        <div className="p-6 max-w-[1400px] mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <span className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
                        <FiSliders size={22} />
                    </span>
                    <div>
                        <h1 className="text-2xl font-extrabold text-gray-800">Feature Manager</h1>
                        <p className="text-sm text-gray-500">Control which features are enabled per outlet — SuperAdmin only</p>
                    </div>
                </div>
                <button onClick={load} className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition font-semibold text-sm">
                    <FiRefreshCw size={14} /> Refresh
                </button>
            </div>

            {/* SA-only badge */}
            <div className="bg-gradient-to-r from-red-50 to-orange-50 border border-orange-200 rounded-2xl px-5 py-3 flex items-center gap-3">
                <span className="text-2xl">🔐</span>
                <div>
                    <p className="font-bold text-orange-800 text-sm">SuperAdmin Restricted Area</p>
                    <p className="text-xs text-orange-600">Changes here control what each outlet can access. Non-paying outlets should have features disabled.</p>
                </div>
            </div>

            {/* Toast */}
            {toast && (
                <div className="fixed bottom-6 right-6 bg-gray-900 text-white px-5 py-3 rounded-xl shadow-2xl text-sm font-medium z-50 animate-pulse">{toast}</div>
            )}

            {loading ? (
                <div className="flex items-center justify-center h-40 text-gray-400">Loading outlets and features...</div>
            ) : (
                <div className="space-y-8">
                    {outlets.map(outlet => (
                        <div key={outlet.outlet_id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                            {/* Outlet header */}
                            <div className="bg-gradient-to-r from-indigo-600 to-purple-700 px-6 py-4 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <span className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center text-white font-black text-lg">{outlet.outlet_name[0]}</span>
                                    <div>
                                        <h2 className="font-bold text-white text-base">{outlet.outlet_name}</h2>
                                        <p className="text-indigo-200 text-xs">Outlet ID: {outlet.outlet_id}</p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <span className="text-xs text-indigo-200 font-medium">
                                        {Object.values(flags[outlet.outlet_id] || {}).filter(Boolean).length}/{ALL_FEATURES.length} features enabled
                                    </span>
                                </div>
                            </div>

                            {/* Features grid */}
                            <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {categories.map(cat => (
                                    <div key={cat} className="space-y-2">
                                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">{cat}</p>
                                        {ALL_FEATURES.filter(f => f.category === cat).map(feat => {
                                            const enabled = flags[outlet.outlet_id]?.[feat.key] ?? false;
                                            const isSaving = saving === `${outlet.outlet_id}-${feat.key}`;
                                            return (
                                                <div key={feat.key}
                                                    onClick={() => !isSaving && toggle(outlet.outlet_id, feat.key)}
                                                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all hover:shadow-sm
                                                        ${enabled ? 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100' : 'bg-gray-50 border-gray-100 hover:bg-gray-100'}`}>
                                                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-all
                                                        ${enabled ? 'bg-emerald-500 shadow-lg shadow-emerald-200' : 'bg-gray-200'}`}>
                                                        {isSaving ? (
                                                            <span className="animate-spin text-white text-xs">⟳</span>
                                                        ) : enabled ? (
                                                            <FiCheck className="text-white" size={16} />
                                                        ) : (
                                                            <FiX className="text-gray-400" size={16} />
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className={`text-sm font-bold truncate ${enabled ? 'text-emerald-800' : 'text-gray-600'}`}>{feat.label}</p>
                                                        <p className="text-xs text-gray-400 leading-tight mt-0.5">{feat.description}</p>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
