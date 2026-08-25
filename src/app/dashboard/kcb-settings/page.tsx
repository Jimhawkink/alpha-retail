'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';

// Superadmin-only guard
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

interface KcbConfig {
    kcb_consumer_key:    string;
    kcb_consumer_secret: string;
    kcb_till_number:     string;
    kcb_enabled:         boolean;
}

const EMPTY_CONFIG: KcbConfig = {
    kcb_consumer_key:    '',
    kcb_consumer_secret: '',
    kcb_till_number:     '',
    kcb_enabled:         false,
};

export default function KcbSettingsPage() {
    const allowed = useSuperAdminGuard();
    const { activeOutlet } = useOutlet();
    const [config, setConfig]     = useState<KcbConfig>(EMPTY_CONFIG);
    const [loading, setLoading]   = useState(true);
    const [saving, setSaving]     = useState(false);
    const [message, setMessage]   = useState('');
    const [showSecret, setShowSecret] = useState(false);

    // Load existing config from retail_outlets
    useEffect(() => {
        // FIX: use outlet_id not id
        if (!activeOutlet?.outlet_id) return;
        (async () => {
            setLoading(true);
            const { data, error } = await supabase
                .from('retail_outlets')
                .select('kcb_consumer_key, kcb_consumer_secret, kcb_till_number, kcb_enabled')
                .eq('outlet_id', activeOutlet.outlet_id)
                .single();
            if (data) {
                setConfig({
                    kcb_consumer_key:    data.kcb_consumer_key    || '',
                    kcb_consumer_secret: data.kcb_consumer_secret || '',
                    kcb_till_number:     data.kcb_till_number     || '',
                    kcb_enabled:         data.kcb_enabled         || false,
                });
            } else if (error) {
                // Columns may not exist yet — show empty form anyway
                setConfig(EMPTY_CONFIG);
            }
            setLoading(false);
        })();
    }, [activeOutlet?.outlet_id]); // FIX: watch outlet_id not id

    const handleSave = async () => {
        if (!activeOutlet?.outlet_id) return; // FIX: outlet_id not id
        setSaving(true);
        setMessage('');
        const { error } = await supabase
            .from('retail_outlets')
            .update({
                kcb_consumer_key:    config.kcb_consumer_key.trim(),
                kcb_consumer_secret: config.kcb_consumer_secret.trim(),
                kcb_till_number:     config.kcb_till_number.trim(),
                kcb_enabled:         config.kcb_enabled,
            })
            .eq('outlet_id', activeOutlet.outlet_id);
        setSaving(false);
        setMessage(error ? `❌ Error: ${error.message}` : '✅ KCB settings saved successfully!');
        setTimeout(() => setMessage(''), 4000);
    };

    if (allowed === null) return <div className="p-8 text-gray-400">Checking access...</div>;
    if (!allowed) return (
        <div className="p-8">
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                <p className="text-red-600 font-semibold">🔒 Access Denied</p>
                <p className="text-red-500 text-sm mt-1">KCB Settings is restricted to Super Admins only.</p>
            </div>
        </div>
    );

    return (
        <div className="p-6 max-w-2xl mx-auto">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">🏦 KCB Buni Settings</h1>
                <p className="text-gray-500 text-sm mt-1">
                    Configure KCB Buni STK Push for outlet: <strong>{activeOutlet?.outlet_name || '—'}</strong>
                </p>
            </div>

            {loading ? (
                <div className="text-gray-400 py-8 text-center">Loading settings...</div>
            ) : (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5">

                    {/* Enable toggle */}
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div>
                            <p className="font-medium text-gray-800">Enable KCB Buni</p>
                            <p className="text-xs text-gray-500">Show KCB Buni payment option in POS</p>
                        </div>
                        <button
                            onClick={() => setConfig(c => ({ ...c, kcb_enabled: !c.kcb_enabled }))}
                            className={`relative w-12 h-6 rounded-full transition-colors ${config.kcb_enabled ? 'bg-green-500' : 'bg-gray-300'}`}
                        >
                            <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${config.kcb_enabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
                        </button>
                    </div>

                    {/* Consumer Key */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            🔑 Consumer Key
                        </label>
                        <input
                            type="text"
                            value={config.kcb_consumer_key}
                            onChange={e => setConfig(c => ({ ...c, kcb_consumer_key: e.target.value }))}
                            placeholder="e.g. x_6oXOjdajJwiFkgIwefe0UeOIka"
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 font-mono"
                        />
                        <p className="text-xs text-gray-400 mt-1">From KCB Buni portal → Sandbox Keys → OAuth2 Tokens</p>
                    </div>

                    {/* Consumer Secret */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            🔒 Consumer Secret
                        </label>
                        <div className="relative">
                            <input
                                type={showSecret ? 'text' : 'password'}
                                value={config.kcb_consumer_secret}
                                onChange={e => setConfig(c => ({ ...c, kcb_consumer_secret: e.target.value }))}
                                placeholder="e.g. tfuEox33L3oIOeJ6zQJE4POE3vca"
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 font-mono pr-16"
                            />
                            <button
                                type="button"
                                onClick={() => setShowSecret(s => !s)}
                                className="absolute right-3 top-2 text-xs text-gray-400 hover:text-gray-700"
                            >
                                {showSecret ? 'Hide' : 'Show'}
                            </button>
                        </div>
                    </div>

                    {/* Till Number */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            📟 Till Number
                        </label>
                        <input
                            type="text"
                            value={config.kcb_till_number}
                            onChange={e => setConfig(c => ({ ...c, kcb_till_number: e.target.value }))}
                            placeholder="e.g. 5891388"
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 font-mono"
                        />
                        <p className="text-xs text-gray-400 mt-1">KCB Till number customers pay to</p>
                    </div>

                    {/* Info box */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <p className="text-xs text-blue-700 font-medium">ℹ️ How to get PRODUCTION credentials</p>
                        <ol className="text-xs text-blue-600 mt-1 space-y-0.5 list-decimal list-inside">
                            <li>Go to developer.buni.kcbgroup.com/devportal</li>
                            <li>Applications → your application</li>
                            <li>Production Keys → Generate Keys</li>
                            <li>Copy Consumer Key and Consumer Secret</li>
                            <li>Till Number = your KCB Paybill/Till e.g. 5891388</li>
                        </ol>
                    </div>

                    {/* Message */}
                    {message && (
                        <div className={`text-sm font-medium p-3 rounded-lg ${message.startsWith('✅') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                            {message}
                        </div>
                    )}

                    {/* Save button */}
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold py-2.5 rounded-lg transition-colors"
                    >
                        {saving ? 'Saving...' : '💾 Save KCB Settings'}
                    </button>
                </div>
            )}
        </div>
    );
}
