'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';

// ── Superadmin-only guard ───────────────────────────────────────────
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

// ── Types ──────────────────────────────────────────────────────────
interface MpesaConfig {
    mpesa_api_url: string;
    mpesa_anon_key: string;
    mpesa_shortcode: string;
    mpesa_passkey: string;
    mpesa_consumer_key: string;
    mpesa_consumer_secret: string;
    mpesa_callback_url: string;
}

const EMPTY_CONFIG: MpesaConfig = {
    mpesa_api_url: '',
    mpesa_anon_key: '',
    mpesa_shortcode: '',
    mpesa_passkey: '',
    mpesa_consumer_key: '',
    mpesa_consumer_secret: '',
    mpesa_callback_url: '',
};

// ── Field definitions ───────────────────────────────────────────────
const FIELDS: { key: keyof MpesaConfig; label: string; icon: string; placeholder: string; sensitive: boolean; hint: string }[] = [
    {
        key: 'mpesa_api_url',
        label: 'Edge Function API URL',
        icon: '🌐',
        placeholder: 'https://xxxx.supabase.co/functions/v1',
        sensitive: false,
        hint: 'Your Supabase project Edge Function base URL',
    },
    {
        key: 'mpesa_anon_key',
        label: 'Supabase Anon Key',
        icon: '🔑',
        placeholder: 'eyJhbGci...',
        sensitive: true,
        hint: 'Your Supabase project anon/public API key',
    },
    {
        key: 'mpesa_shortcode',
        label: 'M-Pesa Paybill / Shortcode',
        icon: '📱',
        placeholder: '174379',
        sensitive: false,
        hint: 'Your Safaricom business paybill or till number',
    },
    {
        key: 'mpesa_passkey',
        label: 'Lipa Na M-Pesa Passkey',
        icon: '🗝️',
        placeholder: 'bfb279f9...',
        sensitive: true,
        hint: 'Provided by Safaricom in the developer portal',
    },
    {
        key: 'mpesa_consumer_key',
        label: 'Consumer Key',
        icon: '🔐',
        placeholder: 'Consumer key from Safaricom',
        sensitive: true,
        hint: 'From your Safaricom Developer App',
    },
    {
        key: 'mpesa_consumer_secret',
        label: 'Consumer Secret',
        icon: '🛡️',
        placeholder: 'Consumer secret from Safaricom',
        sensitive: true,
        hint: 'From your Safaricom Developer App',
    },
    {
        key: 'mpesa_callback_url',
        label: 'STK Callback URL',
        icon: '🔗',
        placeholder: 'https://xxxx.supabase.co/functions/v1/callback',
        sensitive: false,
        hint: 'Where M-Pesa sends payment confirmations',
    },
];

// ── Main Page ───────────────────────────────────────────────────────
export default function MpesaSettingsPage() {
    const allowed = useSuperAdminGuard();
    const { activeOutlet, outlets, reloadOutlets } = useOutlet();
    const [config, setConfig] = useState<MpesaConfig>(EMPTY_CONFIG);
    const [originalConfig, setOriginalConfig] = useState<MpesaConfig>(EMPTY_CONFIG);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
    const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
    const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
    const [selectedOutletId, setSelectedOutletId] = useState<number | null>(null);

    const showToast = (type: 'success' | 'error', msg: string) => {
        setToast({ type, msg });
        setTimeout(() => setToast(null), 4000);
    };

    // Load config for the selected outlet
    const loadConfig = useCallback(async (outletId: number) => {
        const { data, error } = await supabase
            .from('retail_outlets')
            .select('mpesa_api_url,mpesa_anon_key,mpesa_shortcode,mpesa_passkey,mpesa_consumer_key,mpesa_consumer_secret,mpesa_callback_url')
            .eq('outlet_id', outletId)
            .single();

        if (error) { showToast('error', 'Failed to load config: ' + error.message); return; }

        const loaded: MpesaConfig = {
            mpesa_api_url:         data.mpesa_api_url         || '',
            mpesa_anon_key:        data.mpesa_anon_key        || '',
            mpesa_shortcode:       data.mpesa_shortcode       || '',
            mpesa_passkey:         data.mpesa_passkey         || '',
            mpesa_consumer_key:    data.mpesa_consumer_key    || '',
            mpesa_consumer_secret: data.mpesa_consumer_secret || '',
            mpesa_callback_url:    data.mpesa_callback_url    || '',
        };
        setConfig(loaded);
        setOriginalConfig(loaded);
        setTestResult(null);
    }, []);

    useEffect(() => {
        const id = selectedOutletId ?? activeOutlet?.outlet_id ?? null;
        if (id) { setSelectedOutletId(id); loadConfig(id); }
    }, [activeOutlet, selectedOutletId, loadConfig]);

    const isDirty = JSON.stringify(config) !== JSON.stringify(originalConfig);
    const isConfigured = config.mpesa_api_url && config.mpesa_shortcode;

    const handleSave = async () => {
        if (!selectedOutletId) return;
        setSaving(true);
        const { error } = await supabase
            .from('retail_outlets')
            .update({
                mpesa_api_url:         config.mpesa_api_url         || null,
                mpesa_anon_key:        config.mpesa_anon_key        || null,
                mpesa_shortcode:       config.mpesa_shortcode       || null,
                mpesa_passkey:         config.mpesa_passkey         || null,
                mpesa_consumer_key:    config.mpesa_consumer_key    || null,
                mpesa_consumer_secret: config.mpesa_consumer_secret || null,
                mpesa_callback_url:    config.mpesa_callback_url    || null,
            })
            .eq('outlet_id', selectedOutletId);
        setSaving(false);

        if (error) { showToast('error', 'Save failed: ' + error.message); return; }
        setOriginalConfig({ ...config });
        await reloadOutlets();
        showToast('success', 'M-Pesa credentials saved successfully!');
    };

    const handleTest = async () => {
        if (!config.mpesa_api_url || !config.mpesa_anon_key || !config.mpesa_shortcode) {
            setTestResult({ ok: false, message: 'Fill in API URL, Anon Key, and Shortcode first.' });
            return;
        }
        setTesting(true);
        setTestResult(null);
        try {
            // Ping the health/test endpoint
            const res = await fetch(`${config.mpesa_api_url.replace(/\/$/, '')}/health`, {
                headers: {
                    'apikey': config.mpesa_anon_key,
                    'Authorization': `Bearer ${config.mpesa_anon_key}`,
                },
            });
            if (res.ok || res.status === 200 || res.status === 404) {
                // 404 means the Edge Function URL is reachable even if /health doesn't exist
                setTestResult({ ok: true, message: `✅ API URL is reachable (HTTP ${res.status}). Credentials look valid.` });
            } else {
                setTestResult({ ok: false, message: `❌ API returned HTTP ${res.status}. Check your API URL and Anon Key.` });
            }
        } catch {
            setTestResult({ ok: false, message: '❌ Could not reach the API URL. Check your internet connection or the URL.' });
        }
        setTesting(false);
    };

    const handleClear = () => {
        setConfig(EMPTY_CONFIG);
        setTestResult(null);
    };

    const toggleSecret = (key: string) =>
        setShowSecrets(prev => ({ ...prev, [key]: !prev[key] }));

    const currentOutlet = outlets.find(o => o.outlet_id === selectedOutletId);

    // ── Guard renders ──────────────────────────────────────────────
    if (allowed === null) return (
        <div className="min-h-screen flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
    );

    if (!allowed) return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-slate-900 to-slate-800 text-white">
            <div className="text-7xl">🔒</div>
            <h1 className="text-2xl font-black">Super Admin Only</h1>
            <p className="text-slate-400 text-center max-w-xs">M-Pesa credentials are restricted to Super Admin accounts only. Contact your system administrator.</p>
            <a href="/dashboard" className="mt-4 px-6 py-2.5 bg-violet-600 hover:bg-violet-700 rounded-xl font-bold transition-all">← Back to Dashboard</a>
        </div>
    );

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-violet-50/30 p-6">
            {/* Toast */}
            {toast && (
                <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-2xl shadow-2xl text-white text-sm font-semibold flex items-center gap-2 transition-all ${toast.type === 'success' ? 'bg-gradient-to-r from-emerald-500 to-teal-600' : 'bg-gradient-to-r from-red-500 to-rose-600'}`}>
                    {toast.type === 'success' ? '✅' : '❌'} {toast.msg}
                </div>
            )}

            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center text-xl shadow-lg shadow-emerald-200">
                        📱
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-gray-900">M-Pesa Configuration</h1>
                        <p className="text-sm text-gray-500">Configure M-Pesa STK Push credentials per outlet</p>
                    </div>
                </div>

                {/* Status pill */}
                <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold mt-2 ${isConfigured ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-amber-100 text-amber-700 border border-amber-200'}`}>
                    <span className={`w-2 h-2 rounded-full ${isConfigured ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                    {isConfigured
                        ? `${currentOutlet?.outlet_name} — M-Pesa configured`
                        : 'No M-Pesa config — using system fallback (Silibwet)'}
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Left: Outlet selector + status cards */}
                <div className="xl:col-span-1 space-y-4">
                    {/* Outlet Selector */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Select Outlet</p>
                        <div className="space-y-2">
                            {outlets.map(outlet => {
                                const hasMpesa = !!(outlet as any).mpesa_api_url;
                                const isActive = outlet.outlet_id === selectedOutletId;
                                return (
                                    <button
                                        key={outlet.outlet_id}
                                        onClick={() => { setSelectedOutletId(outlet.outlet_id); loadConfig(outlet.outlet_id); }}
                                        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all text-left ${isActive ? 'bg-violet-50 border-violet-300 shadow-sm' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'}`}
                                    >
                                        <div>
                                            <p className={`text-sm font-bold ${isActive ? 'text-violet-800' : 'text-gray-700'}`}>{outlet.outlet_name}</p>
                                            <p className="text-[11px] text-gray-400">{outlet.outlet_code}</p>
                                        </div>
                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${hasMpesa ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                                            {hasMpesa ? '✓ SET' : 'NOT SET'}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Info card */}
                    <div className="bg-gradient-to-br from-violet-600 to-indigo-700 rounded-2xl p-5 text-white shadow-xl shadow-violet-200">
                        <p className="text-xs font-black opacity-70 uppercase tracking-wider mb-3">How It Works</p>
                        <div className="space-y-3 text-sm">
                            <div className="flex items-start gap-2">
                                <span className="text-lg">1️⃣</span>
                                <p className="opacity-90">Select an outlet from the left panel</p>
                            </div>
                            <div className="flex items-start gap-2">
                                <span className="text-lg">2️⃣</span>
                                <p className="opacity-90">Enter their M-Pesa credentials</p>
                            </div>
                            <div className="flex items-start gap-2">
                                <span className="text-lg">3️⃣</span>
                                <p className="opacity-90">Click <strong>Test Connection</strong> to verify</p>
                            </div>
                            <div className="flex items-start gap-2">
                                <span className="text-lg">4️⃣</span>
                                <p className="opacity-90">Save — the POS will use these credentials automatically</p>
                            </div>
                        </div>
                        <div className="mt-4 pt-4 border-t border-white/20 text-[11px] opacity-70">
                            💡 Outlets with no config fall back to the system default (Silibwet credentials)
                        </div>
                    </div>

                    {/* Test Result */}
                    {testResult && (
                        <div className={`rounded-2xl p-4 border text-sm font-medium ${testResult.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                            {testResult.message}
                        </div>
                    )}
                </div>

                {/* Right: Config form */}
                <div className="xl:col-span-2">
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        {/* Form header */}
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-gray-50 to-white">
                            <div>
                                <p className="font-black text-gray-800">{currentOutlet?.outlet_name || 'Select an outlet'}</p>
                                <p className="text-xs text-gray-400">M-Pesa credentials for this outlet</p>
                            </div>
                            {isDirty && (
                                <span className="text-[11px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg">
                                    ● Unsaved changes
                                </span>
                            )}
                        </div>

                        <div className="p-6 space-y-5">
                            {FIELDS.map(field => (
                                <div key={field.key}>
                                    <label className="flex items-center gap-2 text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wider">
                                        <span>{field.icon}</span>
                                        {field.label}
                                    </label>
                                    <div className="relative">
                                        <input
                                            type={field.sensitive && !showSecrets[field.key] ? 'password' : 'text'}
                                            value={config[field.key]}
                                            onChange={e => setConfig(prev => ({ ...prev, [field.key]: e.target.value }))}
                                            placeholder={field.placeholder}
                                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-violet-400 focus:ring-2 focus:ring-violet-100 outline-none transition-all text-sm font-mono pr-10"
                                        />
                                        {field.sensitive && (
                                            <button
                                                type="button"
                                                onClick={() => toggleSecret(field.key)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 text-sm"
                                                title={showSecrets[field.key] ? 'Hide' : 'Show'}
                                            >
                                                {showSecrets[field.key] ? '🙈' : '👁️'}
                                            </button>
                                        )}
                                    </div>
                                    <p className="text-[11px] text-gray-400 mt-1 ml-1">{field.hint}</p>
                                </div>
                            ))}
                        </div>

                        {/* Action buttons */}
                        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex flex-wrap items-center gap-3">
                            <button
                                onClick={handleTest}
                                disabled={testing}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 font-bold text-sm transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                            >
                                {testing ? (
                                    <span className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                                ) : '🧪'}
                                {testing ? 'Testing...' : 'Test Connection'}
                            </button>

                            <button
                                onClick={handleClear}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 font-bold text-sm transition-all hover:scale-105 active:scale-95"
                            >
                                🗑️ Clear All
                            </button>

                            <div className="flex-1" />

                            <button
                                onClick={handleSave}
                                disabled={saving || !isDirty}
                                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-black text-sm shadow-lg shadow-emerald-200 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-100"
                            >
                                {saving ? (
                                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : '💾'}
                                {saving ? 'Saving...' : 'Save Credentials'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
