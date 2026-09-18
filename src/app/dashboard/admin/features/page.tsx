'use client';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { FiSliders, FiCheck, FiX, FiRefreshCw, FiPlus } from 'react-icons/fi';

interface Outlet { outlet_id: number; outlet_name: string; }
interface FeatureDef { feature_key: string; feature_label: string; feature_description: string; feature_category: string; }

export default function FeatureManagerPage() {
    const router = useRouter();
    const [outlets, setOutlets] = useState<Outlet[]>([]);
    const [features, setFeatures] = useState<FeatureDef[]>([]);
    const [flags, setFlags] = useState<Record<string, Record<string, boolean>>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);
    const [toast, setToast] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [newFeat, setNewFeat] = useState({ key: '', label: '', description: '', category: 'General' });
    const [registering, setRegistering] = useState(false);

    useEffect(() => {
        try {
            const u = JSON.parse(localStorage.getItem('user') || '{}');
            const t = (u.userType || u.user_type || '').toLowerCase();
            if (t !== 'superadmin' && t !== 'superuser') router.replace('/dashboard');
        } catch { router.replace('/dashboard'); }
    }, [router]);

    const load = useCallback(async () => {
        setLoading(true);
        const [{ data: outletData }, { data: featData }, { data: flagData }] = await Promise.all([
            supabase.from('retail_outlets').select('outlet_id, outlet_name').order('outlet_name'),
            supabase.from('retail_features_registry').select('*').order('feature_category').order('feature_label'),
            supabase.from('retail_outlet_features').select('outlet_id, feature_key, enabled'),
        ]);
        const outletList: Outlet[] = outletData || [];
        const featList: FeatureDef[] = featData || [];
        setOutlets(outletList);
        setFeatures(featList);
        const map: Record<string, Record<string, boolean>> = {};
        outletList.forEach(o => {
            map[o.outlet_id] = {};
            featList.forEach(f => { map[o.outlet_id][f.feature_key] = false; });
        });
        (flagData || []).forEach((r: any) => {
            if (map[r.outlet_id]) map[r.outlet_id][r.feature_key] = r.enabled;
        });
        setFlags(map);
        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3500); };

    const toggle = async (outletId: number, featureKey: string) => {
        const current = flags[outletId]?.[featureKey] ?? false;
        const newVal = !current;
        setSaving(outletId + '-' + featureKey);
        setFlags(prev => ({ ...prev, [outletId]: { ...prev[outletId], [featureKey]: newVal } }));
        const { error } = await supabase.from('retail_outlet_features').upsert(
            { outlet_id: outletId, feature_key: featureKey, enabled: newVal, updated_at: new Date().toISOString() },
            { onConflict: 'outlet_id,feature_key' }
        );
        if (error) {
            setFlags(prev => ({ ...prev, [outletId]: { ...prev[outletId], [featureKey]: current } }));
            showToast('Error: ' + error.message);
        } else {
            showToast((newVal ? 'Enabled' : 'Disabled') + ' for outlet');
        }
        setSaving(null);
    };

    const enableAll = async (outletId: number) => {
        const updates = features.map(f => ({ outlet_id: outletId, feature_key: f.feature_key, enabled: true, updated_at: new Date().toISOString() }));
        await supabase.from('retail_outlet_features').upsert(updates, { onConflict: 'outlet_id,feature_key' });
        setFlags(prev => {
            const n = { ...prev, [outletId]: { ...prev[outletId] } };
            features.forEach(f => { n[outletId][f.feature_key] = true; });
            return n;
        });
        showToast('All features enabled for outlet');
    };

    const disableAll = async (outletId: number) => {
        const updates = features.map(f => ({ outlet_id: outletId, feature_key: f.feature_key, enabled: false, updated_at: new Date().toISOString() }));
        await supabase.from('retail_outlet_features').upsert(updates, { onConflict: 'outlet_id,feature_key' });
        setFlags(prev => {
            const n = { ...prev, [outletId]: { ...prev[outletId] } };
            features.forEach(f => { n[outletId][f.feature_key] = false; });
            return n;
        });
        showToast('All features disabled for outlet');
    };

    const registerFeature = async () => {
        if (!newFeat.key || !newFeat.label) { showToast('Key and Label are required'); return; }
        const key = newFeat.key.toLowerCase().replace(/[^a-z0-9_]/g, '_');
        setRegistering(true);
        const { error } = await supabase.from('retail_features_registry').insert({
            feature_key: key, feature_label: newFeat.label,
            feature_description: newFeat.description, feature_category: newFeat.category || 'General',
        });
        if (error) { showToast('Error: ' + error.message); setRegistering(false); return; }
        // Auto-create disabled entry for all outlets
        const inserts = outlets.map(o => ({ outlet_id: o.outlet_id, feature_key: key, enabled: false, updated_at: new Date().toISOString() }));
        await supabase.from('retail_outlet_features').upsert(inserts, { onConflict: 'outlet_id,feature_key' });
        showToast('Feature registered! Now enable it per outlet below.');
        setNewFeat({ key: '', label: '', description: '', category: 'General' });
        setShowForm(false);
        setRegistering(false);
        load();
    };

    const categories = [...new Set(features.map(f => f.feature_category))];

    return (
        <div className="p-6 max-w-[1400px] mx-auto space-y-6">
            {toast && <div className="fixed bottom-6 right-6 z-50 bg-gray-900 text-white px-5 py-3 rounded-xl shadow-2xl text-sm font-medium">{toast}</div>}

            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <span className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
                        <FiSliders size={22} />
                    </span>
                    <div>
                        <h1 className="text-2xl font-extrabold text-gray-800">Feature Manager</h1>
                        <p className="text-sm text-gray-500">SuperAdmin only — control features per outlet</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setShowForm(v => !v)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition font-semibold text-sm shadow">
                        <FiPlus size={14} /> Register New Feature
                    </button>
                    <button onClick={load} className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition font-semibold text-sm">
                        <FiRefreshCw size={14} /> Refresh
                    </button>
                </div>
            </div>

            {/* Warning */}
            <div className="bg-orange-50 border border-orange-200 rounded-2xl px-5 py-3 flex items-center gap-3">
                <span className="text-2xl">🔐</span>
                <p className="text-sm text-orange-700"><strong>SuperAdmin Restricted.</strong> Features disabled here will be completely hidden from that outlet's users. New modules you build must be registered here to be controllable.</p>
            </div>

            {/* Register New Feature Form */}
            {showForm && (
                <div className="bg-white rounded-2xl border border-indigo-200 shadow-lg p-6 space-y-4">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2"><FiPlus className="text-indigo-500" /> Register New Feature/Module</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Feature Key <span className="text-red-500">*</span></label>
                            <input value={newFeat.key} onChange={e => setNewFeat(p => ({ ...p, key: e.target.value }))}
                                placeholder="e.g. quotations_module"
                                className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                            <p className="text-xs text-gray-400 mt-1">Unique key used in code. Lowercase, underscores only.</p>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Feature Label <span className="text-red-500">*</span></label>
                            <input value={newFeat.label} onChange={e => setNewFeat(p => ({ ...p, label: e.target.value }))}
                                placeholder="e.g. Quotations Module"
                                className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Description</label>
                            <input value={newFeat.description} onChange={e => setNewFeat(p => ({ ...p, description: e.target.value }))}
                                placeholder="What does this feature do?"
                                className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Category</label>
                            <input value={newFeat.category} onChange={e => setNewFeat(p => ({ ...p, category: e.target.value }))}
                                placeholder="e.g. Sales, Finance, Reports"
                                className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                        </div>
                    </div>
                    <div className="flex gap-3 pt-2">
                        <button onClick={registerFeature} disabled={registering}
                            className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition disabled:opacity-50">
                            {registering ? 'Registering...' : 'Register Feature'}
                        </button>
                        <button onClick={() => setShowForm(false)} className="px-6 py-2.5 bg-gray-100 text-gray-600 rounded-xl font-bold text-sm hover:bg-gray-200 transition">Cancel</button>
                    </div>
                </div>
            )}

            {loading ? (
                <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Loading features and outlets...</div>
            ) : (
                <div className="space-y-6">
                    {outlets.map(outlet => {
                        const enabledCount = Object.values(flags[outlet.outlet_id] || {}).filter(Boolean).length;
                        return (
                            <div key={outlet.outlet_id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                                <div className="bg-gradient-to-r from-indigo-600 to-purple-700 px-6 py-4 flex items-center justify-between flex-wrap gap-3">
                                    <div className="flex items-center gap-3">
                                        <span className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center text-white font-black text-lg">{outlet.outlet_name[0]}</span>
                                        <div>
                                            <h2 className="font-bold text-white">{outlet.outlet_name}</h2>
                                            <p className="text-indigo-200 text-xs">{enabledCount}/{features.length} features enabled</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => enableAll(outlet.outlet_id)} className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-bold transition">Enable All</button>
                                        <button onClick={() => disableAll(outlet.outlet_id)} className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-bold transition">Disable All</button>
                                    </div>
                                </div>
                                <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {categories.map(cat => (
                                        <div key={cat}>
                                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">{cat}</p>
                                            <div className="space-y-2">
                                                {features.filter(f => f.feature_category === cat).map(feat => {
                                                    const enabled = flags[outlet.outlet_id]?.[feat.feature_key] ?? false;
                                                    const isSaving = saving === outlet.outlet_id + '-' + feat.feature_key;
                                                    return (
                                                        <div key={feat.feature_key} onClick={() => !isSaving && toggle(outlet.outlet_id, feat.feature_key)}
                                                            className={"flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all hover:shadow-sm " + (enabled ? 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100' : 'bg-gray-50 border-gray-100 hover:bg-gray-100')}>
                                                            <div className={"w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all " + (enabled ? 'bg-emerald-500 shadow-md shadow-emerald-200' : 'bg-gray-200')}>
                                                                {isSaving ? <span className="animate-spin text-white text-xs">⟳</span> : enabled ? <FiCheck className="text-white" size={14} /> : <FiX className="text-gray-400" size={14} />}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className={"text-sm font-bold truncate " + (enabled ? 'text-emerald-800' : 'text-gray-600')}>{feat.feature_label}</p>
                                                                <p className="text-xs text-gray-400 leading-tight mt-0.5">{feat.feature_description}</p>
                                                                <p className="text-[10px] font-mono text-gray-300 mt-0.5">{feat.feature_key}</p>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}