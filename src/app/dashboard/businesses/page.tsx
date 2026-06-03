'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

// ── SuperAdmin guard ────────────────────────────────────────────────
function useSuperAdminGuard() {
    const [allowed, setAllowed] = useState<boolean | null>(null);
    useEffect(() => {
        try {
            const raw = localStorage.getItem('user');
            if (!raw) { setAllowed(false); return; }
            const u = JSON.parse(raw);
            const t = (u?.userType || '').toLowerCase().replace(/\s/g, '');
            setAllowed(t === 'superadmin' || t === 'superuser' || u?.is_super_admin === true);
        } catch { setAllowed(false); }
    }, []);
    return allowed;
}

// ── Types ───────────────────────────────────────────────────────────
interface Business {
    business_id: string;
    business_name: string;
    db_schema: string;
    license_key: string;
    plan: string;
    contact_email: string | null;
    contact_phone: string | null;
    country: string;
    active: boolean;
    created_at: string;
    notes: string | null;
}

const PLANS = ['starter', 'pro', 'enterprise'];

function generateSchema(name: string) {
    return name.toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .trim()
        .replace(/\s+/g, '_')
        .substring(0, 30);
}

function generateLicense(schema: string) {
    const prefix = schema.substring(0, 3).toUpperCase();
    const year = new Date().getFullYear();
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}-${year}-${rand}`;
}

// ── Main Page ────────────────────────────────────────────────────────
export default function BusinessesPage() {
    const allowed = useSuperAdminGuard();
    const [businesses, setBusinesses] = useState<Business[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
    const [progress, setProgress] = useState('');

    // Form state
    const [form, setForm] = useState({
        business_name: '',
        db_schema: '',
        license_key: '',
        plan: 'starter',
        contact_email: '',
        contact_phone: '',
        country: 'Kenya',
        notes: '',
    });

    const showToast = (type: 'success' | 'error', msg: string) => {
        setToast({ type, msg });
        setTimeout(() => setToast(null), 5000);
    };

    // Auto-fill schema + license when business name changes
    const handleNameChange = (name: string) => {
        const schema = generateSchema(name);
        const license = generateLicense(schema || 'biz');
        setForm(prev => ({
            ...prev,
            business_name: name,
            db_schema: schema,
            license_key: prev.license_key || license,
        }));
    };

    const regenerateLicense = () => {
        setForm(prev => ({ ...prev, license_key: generateLicense(prev.db_schema || 'biz') }));
    };

    // Load all businesses
    const loadBusinesses = useCallback(async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('businesses')
            .select('*')
            .order('created_at', { ascending: false });
        if (!error && data) setBusinesses(data);
        setLoading(false);
    }, []);

    useEffect(() => {
        if (allowed) loadBusinesses();
    }, [allowed, loadBusinesses]);

    // Create new business
    const handleCreate = async () => {
        if (!form.business_name.trim() || !form.db_schema.trim() || !form.license_key.trim()) {
            showToast('error', 'Business name, schema and license key are required.');
            return;
        }

        // Validate schema name (postgres identifier rules)
        if (!/^[a-z][a-z0-9_]{0,29}$/.test(form.db_schema)) {
            showToast('error', 'Schema name must start with a letter, contain only lowercase letters, numbers and underscores.');
            return;
        }

        setCreating(true);

        // Step 1: Create the database schema
        setProgress('📦 Creating database schema (this may take 10–20 seconds)...');
        const { data: schemaResult, error: schemaError } = await supabase
            .rpc('create_business_schema', { p_schema: form.db_schema });

        if (schemaError) {
            showToast('error', 'Schema creation failed: ' + schemaError.message);
            setCreating(false);
            setProgress('');
            return;
        }

        // Step 2: Register in master businesses table
        setProgress('📋 Registering business in master directory...');
        const { error: insertError } = await supabase
            .from('businesses')
            .insert({
                business_name:  form.business_name.trim(),
                db_schema:      form.db_schema.trim(),
                license_key:    form.license_key.trim(),
                plan:           form.plan,
                contact_email:  form.contact_email.trim() || null,
                contact_phone:  form.contact_phone.trim() || null,
                country:        form.country.trim() || 'Kenya',
                notes:          form.notes.trim() || null,
                active:         true,
            });

        setCreating(false);
        setProgress('');

        if (insertError) {
            showToast('error', 'Business registered in DB but directory insert failed: ' + insertError.message);
            return;
        }

        showToast('success', `✅ ${form.business_name} created successfully! Schema: ${form.db_schema}`);

        // Reset form
        setForm({
            business_name: '',
            db_schema: '',
            license_key: '',
            plan: 'starter',
            contact_email: '',
            contact_phone: '',
            country: 'Kenya',
            notes: '',
        });
        setShowForm(false);
        await loadBusinesses();
    };

    // Toggle business active status
    const toggleActive = async (id: string, current: boolean) => {
        await supabase.from('businesses').update({ active: !current }).eq('business_id', id);
        setBusinesses(prev => prev.map(b => b.business_id === id ? { ...b, active: !current } : b));
    };

    // Guard renders
    if (allowed === null) return (
        <div className="min-h-screen flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
    );

    if (!allowed) return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-slate-900 to-slate-800 text-white">
            <div className="text-7xl">🔒</div>
            <h1 className="text-2xl font-black">Super Admin Only</h1>
            <p className="text-slate-400 text-center max-w-xs">Business management is restricted to Super Admin only.</p>
            <a href="/dashboard" className="mt-4 px-6 py-2.5 bg-violet-600 hover:bg-violet-700 rounded-xl font-bold transition-all">← Back to Dashboard</a>
        </div>
    );

    const planColors: Record<string, string> = {
        starter: 'bg-gray-100 text-gray-600',
        pro: 'bg-blue-100 text-blue-700',
        enterprise: 'bg-violet-100 text-violet-700',
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-violet-50/20 p-6">
            {/* Toast */}
            {toast && (
                <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-2xl shadow-2xl text-white text-sm font-semibold flex items-center gap-2 max-w-sm ${toast.type === 'success' ? 'bg-gradient-to-r from-emerald-500 to-teal-600' : 'bg-gradient-to-r from-red-500 to-rose-600'}`}>
                    {toast.type === 'success' ? '✅' : '❌'} {toast.msg}
                </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-2xl flex items-center justify-center text-2xl shadow-lg shadow-violet-200">
                        🏢
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-gray-900">Business Management</h1>
                        <p className="text-sm text-gray-500">Create and manage tenant businesses — Super Admin only</p>
                    </div>
                </div>
                <button
                    onClick={() => setShowForm(true)}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-black text-sm rounded-xl shadow-lg shadow-violet-200 transition-all hover:scale-105 active:scale-95"
                >
                    ＋ New Business
                </button>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                {[
                    { label: 'Total Businesses', value: businesses.length, icon: '🏢', color: 'violet' },
                    { label: 'Active', value: businesses.filter(b => b.active).length, icon: '✅', color: 'emerald' },
                    { label: 'Pro / Enterprise', value: businesses.filter(b => ['pro', 'enterprise'].includes(b.plan)).length, icon: '⭐', color: 'blue' },
                    { label: 'Inactive', value: businesses.filter(b => !b.active).length, icon: '⏸️', color: 'gray' },
                ].map(stat => (
                    <div key={stat.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                        <div className="flex items-center gap-3">
                            <span className="text-2xl">{stat.icon}</span>
                            <div>
                                <p className="text-2xl font-black text-gray-800">{stat.value}</p>
                                <p className="text-xs text-gray-400 font-medium">{stat.label}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Businesses list */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
                </div>
            ) : businesses.length === 0 ? (
                <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-16 text-center">
                    <div className="text-6xl mb-4">🏢</div>
                    <h3 className="text-lg font-bold text-gray-700 mb-2">No businesses yet</h3>
                    <p className="text-sm text-gray-400 mb-6">Click <strong>+ New Business</strong> to onboard your first tenant</p>
                    <button onClick={() => setShowForm(true)} className="px-6 py-2.5 bg-violet-600 text-white font-bold rounded-xl hover:bg-violet-700 transition-all">
                        Create First Business
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                    {businesses.map(biz => (
                        <div key={biz.business_id} className={`bg-white rounded-2xl border shadow-sm p-5 transition-all hover:shadow-md ${!biz.active ? 'opacity-60' : 'border-gray-100'}`}>
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <div className="w-9 h-9 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-xl flex items-center justify-center text-white font-black text-sm">
                                        {biz.business_name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <p className="font-black text-gray-800 text-sm">{biz.business_name}</p>
                                        <p className="text-[11px] text-gray-400 font-mono">{biz.db_schema}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full capitalize ${planColors[biz.plan] || 'bg-gray-100 text-gray-600'}`}>
                                        {biz.plan}
                                    </span>
                                    <button
                                        onClick={() => toggleActive(biz.business_id, biz.active)}
                                        className={`w-5 h-5 rounded-full border-2 transition-all ${biz.active ? 'bg-emerald-500 border-emerald-500' : 'bg-white border-gray-300'}`}
                                        title={biz.active ? 'Click to deactivate' : 'Click to activate'}
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5 text-xs text-gray-500">
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-gray-400 w-14">License</span>
                                    <span className="font-mono bg-gray-50 px-2 py-0.5 rounded text-gray-700">{biz.license_key}</span>
                                </div>
                                {biz.contact_email && (
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-gray-400 w-14">Email</span>
                                        <span className="truncate">{biz.contact_email}</span>
                                    </div>
                                )}
                                {biz.contact_phone && (
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-gray-400 w-14">Phone</span>
                                        <span>{biz.contact_phone}</span>
                                    </div>
                                )}
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-gray-400 w-14">Created</span>
                                    <span>{new Date(biz.created_at).toLocaleDateString('en-KE')}</span>
                                </div>
                            </div>

                            {biz.notes && (
                                <p className="mt-3 text-[11px] text-gray-400 bg-gray-50 rounded-lg px-3 py-2 italic">{biz.notes}</p>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* ── Create Business Modal ── */}
            {showForm && (
                <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
                        {/* Modal header */}
                        <div className="bg-gradient-to-r from-violet-600 to-indigo-700 px-6 py-5 rounded-t-2xl text-white">
                            <h2 className="text-xl font-black">🏢 Create New Business</h2>
                            <p className="text-violet-200 text-sm mt-1">Sets up an isolated database schema + registers the tenant</p>
                        </div>

                        <div className="p-6 space-y-4">
                            {/* Business Name */}
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Business Name *</label>
                                <input
                                    type="text"
                                    value={form.business_name}
                                    onChange={e => handleNameChange(e.target.value)}
                                    placeholder="e.g. Nairobi Fresh Mart"
                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-violet-400 focus:ring-2 focus:ring-violet-100 outline-none transition-all text-sm"
                                />
                            </div>

                            {/* Schema Name */}
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Database Schema *</label>
                                <input
                                    type="text"
                                    value={form.db_schema}
                                    onChange={e => setForm(prev => ({ ...prev, db_schema: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') }))}
                                    placeholder="nairobi_fresh_mart"
                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-violet-400 focus:ring-2 focus:ring-violet-100 outline-none transition-all text-sm font-mono"
                                />
                                <p className="text-[11px] text-gray-400 mt-1">Lowercase, underscores only. Auto-generated from business name.</p>
                            </div>

                            {/* License Key */}
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">License Key *</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={form.license_key}
                                        onChange={e => setForm(prev => ({ ...prev, license_key: e.target.value.toUpperCase() }))}
                                        placeholder="NBI-2026-XXXX"
                                        className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-violet-400 focus:ring-2 focus:ring-violet-100 outline-none transition-all text-sm font-mono"
                                    />
                                    <button
                                        type="button"
                                        onClick={regenerateLicense}
                                        className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm font-bold text-gray-600 transition-all"
                                        title="Generate new license key"
                                    >
                                        🔄
                                    </button>
                                </div>
                                <p className="text-[11px] text-gray-400 mt-1">This key will be used to identify this tenant. Keep it safe.</p>
                            </div>

                            {/* Plan */}
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Plan</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {PLANS.map(p => (
                                        <button
                                            key={p}
                                            type="button"
                                            onClick={() => setForm(prev => ({ ...prev, plan: p }))}
                                            className={`py-2.5 rounded-xl border-2 text-sm font-bold capitalize transition-all ${form.plan === p ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300'}`}
                                        >
                                            {p === 'starter' ? '🌱' : p === 'pro' ? '⭐' : '🚀'} {p}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Contact */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Contact Email</label>
                                    <input
                                        type="email"
                                        value={form.contact_email}
                                        onChange={e => setForm(prev => ({ ...prev, contact_email: e.target.value }))}
                                        placeholder="admin@business.co.ke"
                                        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-violet-400 outline-none transition-all text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Contact Phone</label>
                                    <input
                                        type="tel"
                                        value={form.contact_phone}
                                        onChange={e => setForm(prev => ({ ...prev, contact_phone: e.target.value }))}
                                        placeholder="0712345678"
                                        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-violet-400 outline-none transition-all text-sm"
                                    />
                                </div>
                            </div>

                            {/* Country */}
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Country</label>
                                <input
                                    type="text"
                                    value={form.country}
                                    onChange={e => setForm(prev => ({ ...prev, country: e.target.value }))}
                                    placeholder="Kenya"
                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-violet-400 outline-none transition-all text-sm"
                                />
                            </div>

                            {/* Notes */}
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Notes (optional)</label>
                                <textarea
                                    value={form.notes}
                                    onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
                                    placeholder="Any notes about this business..."
                                    rows={2}
                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-violet-400 outline-none transition-all text-sm resize-none"
                                />
                            </div>

                            {/* Progress indicator */}
                            {creating && progress && (
                                <div className="flex items-center gap-3 px-4 py-3 bg-violet-50 border border-violet-200 rounded-xl text-sm text-violet-700 font-medium">
                                    <div className="w-4 h-4 border-2 border-violet-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                                    {progress}
                                </div>
                            )}

                            {/* Info box */}
                            <div className="flex gap-2 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700">
                                ℹ️ <span>This will create a <strong>completely isolated database schema</strong> for this business — their data never mixes with other outlets.</span>
                            </div>
                        </div>

                        {/* Modal footer */}
                        <div className="px-6 pb-6 flex gap-3">
                            <button
                                onClick={() => setShowForm(false)}
                                disabled={creating}
                                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50 transition-all disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreate}
                                disabled={creating || !form.business_name || !form.db_schema || !form.license_key}
                                className="flex-1 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-black text-sm rounded-xl shadow-lg shadow-violet-200 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2"
                            >
                                {creating ? (
                                    <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Creating...</>
                                ) : '🚀 Create Business'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
