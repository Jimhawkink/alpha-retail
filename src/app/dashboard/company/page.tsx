'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import {
    FiHome, FiMapPin, FiFileText, FiSettings, FiMail, FiSave,
    FiShield, FiEye, FiEyeOff, FiSend, FiInfo, FiCheck, FiAlertTriangle
} from 'react-icons/fi';

// ── Types ────────────────────────────────────────────────────────────
interface OrgSettings {
    company_name: string; address: string; city: string; country: string;
    phone: string; phone2: string; email: string; website: string;
    kra_pin: string; currency_code: string; currency_symbol: string;
    location_type: 'single' | 'multi'; location_name: string;
    footer_note: string; receipt_header: string; receipt_footer: string;
    logo_url: string; enable_shifts: boolean; enable_loyalty: boolean; vat_rate: number;
}
interface SmtpSettings {
    smtp_host: string; smtp_port: string; smtp_user: string;
    smtp_pass: string; smtp_from: string; company_name: string;
}

const defaultOrg: OrgSettings = {
    company_name: '', address: '', city: '', country: 'Kenya',
    phone: '', phone2: '', email: '', website: '', kra_pin: '',
    currency_code: 'KES', currency_symbol: 'KSh', location_type: 'single',
    location_name: '', footer_note: 'Thank you for your business!',
    receipt_header: '', receipt_footer: 'Thank you for visiting us!',
    logo_url: '', enable_shifts: true, enable_loyalty: false, vat_rate: 16,
};
const defaultSmtp: SmtpSettings = {
    smtp_host: 'smtp.gmail.com', smtp_port: '587',
    smtp_user: '', smtp_pass: '', smtp_from: '', company_name: '',
};
const currencies = [
    { code: 'KES', symbol: 'KSh', name: 'Kenya Shilling' },
    { code: 'USD', symbol: '$',   name: 'US Dollar' },
    { code: 'EUR', symbol: '€',   name: 'Euro' },
    { code: 'GBP', symbol: '£',   name: 'British Pound' },
    { code: 'TZS', symbol: 'TSh', name: 'Tanzania Shilling' },
    { code: 'UGX', symbol: 'USh', name: 'Uganda Shilling' },
];

// ── Toggle component ──────────────────────────────────────────────────
function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
    return (
        <button type="button" onClick={onChange}
            className={`relative w-12 h-6 rounded-full transition-all duration-300 focus:outline-none ${checked ? 'bg-indigo-600' : 'bg-gray-200'}`}>
            <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all duration-300 ${checked ? 'left-6' : 'left-0.5'}`} />
        </button>
    );
}

// ── Field wrapper ─────────────────────────────────────────────────────
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
    return (
        <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">{label}</label>
            {children}
            {hint && <p className="text-[11px] text-gray-400 mt-1">{hint}</p>}
        </div>
    );
}

// ── Input styling ─────────────────────────────────────────────────────
const inp = 'w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-800 text-sm placeholder:text-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all';

export default function CompanyPage() {
    const [org, setOrg]               = useState<OrgSettings>(defaultOrg);
    const [smtp, setSmtp]             = useState<SmtpSettings>(defaultSmtp);
    const [loading, setLoading]       = useState(true);
    const [saving, setSaving]         = useState(false);
    const [savingSmtp, setSavingSmtp] = useState(false);
    const [testingMail, setTestingMail] = useState(false);
    const [showPass, setShowPass]     = useState(false);
    const [testEmail, setTestEmail]   = useState('');
    const [userType, setUserType]     = useState('');
    const [activeTab, setActiveTab]   = useState<'general' | 'location' | 'receipt' | 'system' | 'email'>('general');
    const [posDefaultPrice, setPosDefaultPrice] = useState<'retail' | 'wholesale'>('wholesale');

    const isSuperAdmin = ['superadmin', 'superuser'].includes((userType || '').toLowerCase().replace(/\s/g, ''));

    // ── Load settings ─────────────────────────────────────────────────
    const loadAll = useCallback(async () => {
        setLoading(true);
        const raw = localStorage.getItem('user');
        if (raw) setUserType(JSON.parse(raw).userType || '');

        // Load org settings
        const { data: orgData } = await supabase.from('organisation_settings').select('setting_key,setting_value');
        if (orgData) {
            const o = { ...defaultOrg };
            orgData.forEach((r: any) => {
                const k = r.setting_key as keyof OrgSettings;
                if (k in o) {
                    if (typeof o[k] === 'boolean') (o as any)[k] = r.setting_value === 'true';
                    else if (typeof o[k] === 'number') (o as any)[k] = parseFloat(r.setting_value) || 0;
                    else (o as any)[k] = r.setting_value || '';
                }
            });
            setOrg(o);
            // Load pos_default_price separately (not in OrgSettings interface)
            const pdp = orgData.find((r: any) => r.setting_key === 'pos_default_price');
            if (pdp?.setting_value === 'retail') setPosDefaultPrice('retail');
            else setPosDefaultPrice('wholesale');
        }

        // Load smtp settings
        const { data: smtpData } = await supabase
            .from('retail_settings').select('setting_key,setting_value')
            .in('setting_key', ['smtp_host','smtp_port','smtp_user','smtp_pass','smtp_from','company_name']);
        if (smtpData) {
            const s = { ...defaultSmtp };
            smtpData.forEach((r: any) => { (s as any)[r.setting_key] = r.setting_value || ''; });
            setSmtp(s);
        }
        setLoading(false);
    }, []);

    useEffect(() => { loadAll(); }, [loadAll]);

    // ── Save org settings ─────────────────────────────────────────────
    const saveOrg = async () => {
        if (!org.company_name.trim()) { toast.error('Company name is required!'); return; }
        setSaving(true);
        try {
            for (const [key, value] of Object.entries(org)) {
                await supabase.from('organisation_settings').upsert(
                    { setting_key: key, setting_value: String(value), updated_at: new Date().toISOString() },
                    { onConflict: 'setting_key' }
                );
            }
            toast.success('✅ Company settings saved!');
        } catch { toast.error('Save failed. Please try again.'); }
        // Also save pos_default_price
        await supabase.from('organisation_settings').upsert(
            { setting_key: 'pos_default_price', setting_value: posDefaultPrice, updated_at: new Date().toISOString() },
            { onConflict: 'setting_key' }
        );
        setSaving(false);
    };

    // ── Save SMTP settings ────────────────────────────────────────────
    const saveSmtp = async () => {
        if (!smtp.smtp_user || !smtp.smtp_pass) { toast.error('SMTP email and password are required.'); return; }
        setSavingSmtp(true);
        try {
            for (const [key, value] of Object.entries(smtp)) {
                await supabase.from('retail_settings').upsert(
                    { setting_key: key, setting_value: value },
                    { onConflict: 'setting_key' }
                );
            }
            toast.success('✅ Email settings saved!');
        } catch { toast.error('Failed to save email settings.'); }
        setSavingSmtp(false);
    };

    // ── Send test email ───────────────────────────────────────────────
    const sendTestEmail = async () => {
        if (!testEmail || !testEmail.includes('@')) { toast.error('Enter a valid test email address.'); return; }
        setTestingMail(true);
        try {
            const res = await fetch('/api/auth/test-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ to: testEmail }),
            });
            const data = await res.json();
            if (data.ok) toast.success(`✅ Test email sent to ${testEmail}!`);
            else toast.error(data.error || 'Failed to send test email.');
        } catch { toast.error('Network error. Check SMTP settings.'); }
        setTestingMail(false);
    };

    const tabs = [
        { id: 'general',  label: 'General',  icon: FiHome,      desc: 'Business details' },
        { id: 'location', label: 'Location',  icon: FiMapPin,    desc: 'Address & branches' },
        { id: 'receipt',  label: 'Receipts',  icon: FiFileText,  desc: 'Receipt design' },
        { id: 'system',   label: 'System',    icon: FiSettings,  desc: 'Preferences' },
        ...(isSuperAdmin ? [{ id: 'email', label: 'Email Setup', icon: FiMail, desc: 'SMTP config' }] : []),
    ];

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <div className="text-center">
                <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-gray-400 text-sm">Loading settings...</p>
            </div>
        </div>
    );

    return (
        <div className="max-w-5xl mx-auto">
            <style>{`
                @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
                .fu{animation:fadeUp .3s ease-out}
            `}</style>

            {/* ── Page header ── */}
            <div className="mb-6">
                <div className="rounded-2xl overflow-hidden shadow-sm" style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
                    <div className="px-8 py-6 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center text-2xl">🏪</div>
                            <div>
                                <h1 className="text-xl font-black text-white">Company Settings</h1>
                                <p className="text-white/65 text-sm">Configure your business across the entire system</p>
                            </div>
                        </div>
                        {activeTab !== 'email' && (
                            <button onClick={saveOrg} disabled={saving}
                                className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-indigo-700 bg-white hover:bg-indigo-50 transition-all hover:scale-[1.03] disabled:opacity-60 shadow-lg">
                                {saving ? <><div className="w-4 h-4 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />Saving...</> : <><FiSave size={15} />Save Changes</>}
                            </button>
                        )}
                        {activeTab === 'email' && (
                            <button onClick={saveSmtp} disabled={savingSmtp}
                                className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-indigo-700 bg-white hover:bg-indigo-50 transition-all hover:scale-[1.03] disabled:opacity-60 shadow-lg">
                                {savingSmtp ? <><div className="w-4 h-4 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />Saving...</> : <><FiSave size={15} />Save SMTP</>}
                            </button>
                        )}
                    </div>

                    {/* Company preview strip */}
                    {org.company_name && (
                        <div className="px-8 pb-5 flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-emerald-400 flex items-center justify-center text-white font-black text-sm">
                                {org.company_name.charAt(0)}
                            </div>
                            <div>
                                <span className="text-white font-bold text-sm">{org.company_name}</span>
                                <span className="text-white/50 text-xs ml-2">· {org.city || 'Location not set'} · {org.phone || 'No phone'}</span>
                            </div>
                            <span className="ml-auto flex items-center gap-1 text-emerald-300 text-xs font-bold">
                                <FiCheck size={12} /> Active
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Tab bar ── */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-1.5 mb-5 flex gap-1 overflow-x-auto">
                {tabs.map(tab => {
                    const Icon = tab.icon;
                    const active = activeTab === tab.id;
                    return (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id as typeof activeTab)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all
                                ${active ? 'text-white shadow-md' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'}`}
                            style={active ? { background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' } : {}}>
                            <Icon size={14} />
                            <span>{tab.label}</span>
                            {tab.id === 'email' && <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-white/20 text-white">SA</span>}
                        </button>
                    );
                })}
            </div>

            {/* ── Tab content ── */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden fu">

                {/* ═══ GENERAL ═══ */}
                {activeTab === 'general' && (
                    <div className="p-6 space-y-6">
                        <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
                            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center"><FiHome className="text-indigo-600" size={15} /></div>
                            <div><h3 className="font-black text-gray-800">General Information</h3><p className="text-xs text-gray-400">Core business details</p></div>
                        </div>

                        {/* Company name — hero field */}
                        <div className="p-5 rounded-2xl border-2 border-indigo-200 bg-indigo-50/40">
                            <label className="block text-sm font-black text-indigo-700 mb-2">🏪 Company Name <span className="text-red-500">*</span></label>
                            <input type="text" value={org.company_name} onChange={e => setOrg({ ...org, company_name: e.target.value })}
                                placeholder="e.g. Alpha Supermarket Ltd"
                                className="w-full px-5 py-4 rounded-xl border-2 border-indigo-300 bg-white text-gray-800 text-base font-bold placeholder:text-gray-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 outline-none transition-all" />
                            <p className="text-[11px] text-indigo-500 mt-1.5">⚡ Appears on receipts, reports, emails and login screen</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Field label="📧 Company Email">
                                <input type="email" value={org.email} onChange={e => setOrg({ ...org, email: e.target.value })} placeholder="info@business.com" className={inp} />
                            </Field>
                            <Field label="🌐 Website">
                                <input type="url" value={org.website} onChange={e => setOrg({ ...org, website: e.target.value })} placeholder="www.business.com" className={inp} />
                            </Field>
                            <Field label="📞 Main Phone">
                                <input type="tel" value={org.phone} onChange={e => setOrg({ ...org, phone: e.target.value })} placeholder="0720 316 175" className={inp} />
                            </Field>
                            <Field label="📱 Secondary Phone">
                                <input type="tel" value={org.phone2} onChange={e => setOrg({ ...org, phone2: e.target.value })} placeholder="Optional" className={inp} />
                            </Field>
                            <Field label="🏛️ KRA PIN / Tax ID">
                                <input type="text" value={org.kra_pin} onChange={e => setOrg({ ...org, kra_pin: e.target.value.toUpperCase() })} placeholder="P051234567X" className={`${inp} uppercase`} />
                            </Field>
                            <Field label="💰 Currency">
                                <select value={org.currency_code}
                                    onChange={e => { const c = currencies.find(x => x.code === e.target.value); if (c) setOrg({ ...org, currency_code: c.code, currency_symbol: c.symbol }); }}
                                    className={inp}>
                                    {currencies.map(c => <option key={c.code} value={c.code}>{c.symbol} — {c.name} ({c.code})</option>)}
                                </select>
                            </Field>
                            <Field label="📊 VAT Rate (%)" hint="Standard rate in Kenya is 16%">
                                <input type="number" value={org.vat_rate} min={0} max={100}
                                    onChange={e => setOrg({ ...org, vat_rate: parseFloat(e.target.value) || 0 })} placeholder="16" className={inp} />
                            </Field>
                        </div>
                    </div>
                )}

                {/* ═══ LOCATION ═══ */}
                {activeTab === 'location' && (
                    <div className="p-6 space-y-6">
                        <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
                            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center"><FiMapPin className="text-emerald-600" size={15} /></div>
                            <div><h3 className="font-black text-gray-800">Location Settings</h3><p className="text-xs text-gray-400">Physical address and branch type</p></div>
                        </div>

                        {/* Business type */}
                        <div className="grid grid-cols-2 gap-3">
                            {[
                                { v: 'single', icon: '🏠', label: 'Single Location', sub: 'One branch only' },
                                { v: 'multi',  icon: '🏢', label: 'Multi Location',  sub: 'Multiple branches' },
                            ].map(opt => (
                                <button key={opt.v} onClick={() => setOrg({ ...org, location_type: opt.v as any })}
                                    className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${org.location_type === opt.v ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                                    <span className="text-2xl">{opt.icon}</span>
                                    <div className="text-left">
                                        <p className={`text-sm font-bold ${org.location_type === opt.v ? 'text-indigo-700' : 'text-gray-700'}`}>{opt.label}</p>
                                        <p className="text-[11px] text-gray-400">{opt.sub}</p>
                                    </div>
                                    {org.location_type === opt.v && <FiCheck className="ml-auto text-indigo-600" size={16} />}
                                </button>
                            ))}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2">
                                <Field label={`📍 ${org.location_type === 'multi' ? 'Main Branch Name' : 'Location Name'}`}>
                                    <input type="text" value={org.location_name} onChange={e => setOrg({ ...org, location_name: e.target.value })} placeholder="Main Branch / Head Office" className={inp} />
                                </Field>
                            </div>
                            <div className="md:col-span-2">
                                <Field label="🏠 Physical Address">
                                    <textarea value={org.address} onChange={e => setOrg({ ...org, address: e.target.value })}
                                        placeholder="Building, Street, Area..." rows={2} className={`${inp} resize-none`} />
                                </Field>
                            </div>
                            <Field label="🌆 City / Town">
                                <input type="text" value={org.city} onChange={e => setOrg({ ...org, city: e.target.value })} placeholder="Nairobi" className={inp} />
                            </Field>
                            <Field label="🌍 Country">
                                <input type="text" value={org.country} onChange={e => setOrg({ ...org, country: e.target.value })} placeholder="Kenya" className={inp} />
                            </Field>
                        </div>
                    </div>
                )}

                {/* ═══ RECEIPT ═══ */}
                {activeTab === 'receipt' && (
                    <div className="p-6 space-y-6">
                        <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
                            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center"><FiFileText className="text-amber-600" size={15} /></div>
                            <div><h3 className="font-black text-gray-800">Receipt Settings</h3><p className="text-xs text-gray-400">Customize customer-facing receipts</p></div>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <Field label="📝 Receipt Header" hint="Shown at the top of every receipt">
                                    <textarea value={org.receipt_header} onChange={e => setOrg({ ...org, receipt_header: e.target.value })}
                                        placeholder="Welcome! Thank you for choosing us." rows={2} className={`${inp} resize-none`} />
                                </Field>
                                <Field label="✨ Footer Motto">
                                    <textarea value={org.footer_note} onChange={e => setOrg({ ...org, footer_note: e.target.value })}
                                        placeholder="Your satisfaction is our priority!" rows={2} className={`${inp} resize-none`} />
                                </Field>
                                <Field label="👋 Receipt Footer">
                                    <textarea value={org.receipt_footer} onChange={e => setOrg({ ...org, receipt_footer: e.target.value })}
                                        placeholder="Thank you for visiting. Come again soon!" rows={2} className={`${inp} resize-none`} />
                                </Field>
                            </div>
                            {/* Live receipt preview */}
                            <div>
                                <p className="text-sm font-semibold text-gray-500 mb-3">👁 Live Preview</p>
                                <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200">
                                    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 font-mono text-xs max-w-[260px] mx-auto">
                                        <div className="text-center border-b border-dashed border-gray-300 pb-3 mb-3">
                                            <p className="font-black text-sm text-gray-800">{org.company_name || 'Your Business'}</p>
                                            <p className="text-gray-500 mt-0.5">{org.address || '123 Main St'}</p>
                                            <p className="text-gray-500">Tel: {org.phone || '0720 316 175'}</p>
                                            {org.kra_pin && <p className="text-gray-500">PIN: {org.kra_pin}</p>}
                                            {org.receipt_header && <p className="text-indigo-600 mt-1.5 italic text-[10px]">{org.receipt_header}</p>}
                                        </div>
                                        <div className="space-y-1 border-b border-dashed border-gray-300 pb-3 mb-3">
                                            <div className="flex justify-between"><span>1x Coffee</span><span>150</span></div>
                                            <div className="flex justify-between"><span>2x Bread</span><span>120</span></div>
                                            <div className="flex justify-between font-black border-t border-gray-200 pt-1.5 mt-1.5">
                                                <span>TOTAL</span><span>{org.currency_symbol} 270</span>
                                            </div>
                                        </div>
                                        <div className="text-center text-gray-500 text-[10px] space-y-0.5">
                                            {org.footer_note && <p className="italic">{org.footer_note}</p>}
                                            {org.receipt_footer && <p>{org.receipt_footer}</p>}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ═══ SYSTEM ═══ */}
                {activeTab === 'system' && (
                    <div className="p-6 space-y-6">
                        <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
                            <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center"><FiSettings className="text-violet-600" size={15} /></div>
                            <div><h3 className="font-black text-gray-800">System Preferences</h3><p className="text-xs text-gray-400">Feature toggles and system info</p></div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {[
                                { key: 'enable_shifts',  emoji: '⏰', label: 'Shift Management',  sub: 'Track sales by day/night shift' },
                                { key: 'enable_loyalty', emoji: '🎁', label: 'Loyalty Program',    sub: 'Customer points & rewards' },
                            ].map(item => (
                                <div key={item.key} className="flex items-center justify-between p-5 bg-gray-50 rounded-2xl border border-gray-100">
                                    <div className="flex items-center gap-3">
                                        <span className="text-2xl">{item.emoji}</span>
                                        <div>
                                            <p className="font-bold text-sm text-gray-800">{item.label}</p>
                                            <p className="text-[11px] text-gray-400">{item.sub}</p>
                                        </div>
                                    </div>
                                    <Toggle checked={(org as any)[item.key]} onChange={() => setOrg({ ...org, [item.key]: !(org as any)[item.key] })} />
                                </div>
                            ))}
                        </div>

                        {/* ─── POS Price Display (SuperAdmin only) ─── */}
                        {isSuperAdmin && (
                            <div className="p-5 rounded-2xl border-2 border-violet-200 bg-violet-50/40">
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="text-lg">🏷️</span>
                                    <div>
                                        <p className="font-bold text-sm text-violet-800">POS Product Card — Default Price Display</p>
                                        <p className="text-[11px] text-violet-500">Choose which price is shown on product cards in the POS screen for cashiers</p>
                                    </div>
                                    <span className="ml-auto text-[9px] font-black px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 flex items-center gap-1"><FiShield size={9} /> SUPERADMIN</span>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    {[
                                        { v: 'retail',    icon: '🏪', label: 'Retail Price',    sub: 'Show sales_cost — standard customer price' },
                                        { v: 'wholesale', icon: '🤝', label: 'Wholesale Price',  sub: 'Show wholesale_price — bulk/trade price' },
                                    ].map(opt => (
                                        <button key={opt.v} type="button" onClick={() => setPosDefaultPrice(opt.v as any)}
                                            className={`flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                                                posDefaultPrice === opt.v
                                                    ? 'border-violet-500 bg-violet-50 shadow-sm'
                                                    : 'border-gray-200 bg-white hover:border-violet-300'
                                            }`}>
                                            <span className="text-2xl">{opt.icon}</span>
                                            <div>
                                                <p className={`text-sm font-bold ${posDefaultPrice === opt.v ? 'text-violet-700' : 'text-gray-700'}`}>{opt.label}</p>
                                                <p className="text-[10px] text-gray-400">{opt.sub}</p>
                                            </div>
                                            {posDefaultPrice === opt.v && <FiCheck className="ml-auto text-violet-600 shrink-0" size={16} />}
                                        </button>
                                    ))}
                                </div>
                                <p className="text-[11px] text-violet-400 mt-2">💡 This setting is saved when you click <strong>Save Changes</strong> above. The POS reads it automatically on next load.</p>
                            </div>
                        )}

                        {/* System info card */}
                        <div className="rounded-2xl overflow-hidden border border-gray-200">
                            <div className="px-5 py-3 flex items-center gap-2" style={{ background: 'linear-gradient(135deg,#1e293b,#334155)' }}>
                                <FiInfo className="text-white/60" size={14} />
                                <p className="text-sm font-bold text-white">System Information</p>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-gray-100">
                                {[
                                    { label: 'Version', value: 'v3.1.0' },
                                    { label: 'License', value: '✅ Active' },
                                    { label: 'Database', value: 'Supabase' },
                                    { label: 'Support', value: '0720 316 175' },
                                ].map(item => (
                                    <div key={item.label} className="bg-white p-4">
                                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{item.label}</p>
                                        <p className="text-sm font-black text-gray-800 mt-0.5">{item.value}</p>
                                    </div>
                                ))}
                            </div>
                            <div className="bg-white px-5 py-3 text-center border-t border-gray-100">
                                <p className="text-[11px] text-gray-400">Powered by Alpha Solutions · Developed by Jimhawkins Korir</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* ═══ EMAIL SETUP (SuperAdmin only) ═══ */}
                {activeTab === 'email' && isSuperAdmin && (
                    <div className="p-6 space-y-6">
                        <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
                                <FiMail className="text-white" size={15} />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h3 className="font-black text-gray-800">Email / SMTP Configuration</h3>
                                    <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 flex items-center gap-1"><FiShield size={9} /> SUPERADMIN ONLY</span>
                                </div>
                                <p className="text-xs text-gray-400">Configure outbound email for password resets and notifications</p>
                            </div>
                        </div>

                        {/* Gmail setup guide */}
                        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                            <div className="flex items-start gap-3">
                                <div className="text-2xl">📱</div>
                                <div>
                                    <p className="text-sm font-black text-blue-800 mb-1">Gmail Setup Guide</p>
                                    <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside">
                                        <li>Enable 2-Factor Authentication on your Gmail account</li>
                                        <li>Go to: <strong>Google Account → Security → App Passwords</strong></li>
                                        <li>Create an App Password for <strong>"Mail"</strong> and <strong>"Windows Computer"</strong></li>
                                        <li>Copy the 16-character password and paste it in <strong>SMTP Password</strong> below</li>
                                        <li>Use your Gmail address for both <strong>SMTP User</strong> and <strong>From Address</strong></li>
                                    </ol>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Field label="🖥️ SMTP Host" hint="Gmail: smtp.gmail.com">
                                <input type="text" value={smtp.smtp_host} onChange={e => setSmtp({ ...smtp, smtp_host: e.target.value })} placeholder="smtp.gmail.com" className={inp} />
                            </Field>
                            <Field label="🔌 SMTP Port" hint="587 for TLS (recommended) · 465 for SSL">
                                <select value={smtp.smtp_port} onChange={e => setSmtp({ ...smtp, smtp_port: e.target.value })} className={inp}>
                                    <option value="587">587 — TLS (recommended)</option>
                                    <option value="465">465 — SSL</option>
                                    <option value="25">25 — Plain (not secure)</option>
                                </select>
                            </Field>
                            <Field label="📧 SMTP Username (Gmail address)" hint="Your full Gmail address">
                                <input type="email" value={smtp.smtp_user} onChange={e => setSmtp({ ...smtp, smtp_user: e.target.value })} placeholder="yourmail@gmail.com" className={inp} />
                            </Field>
                            <Field label="🔐 SMTP Password" hint="Gmail App Password (16 characters, NOT your login password)">
                                <div className="relative">
                                    <input type={showPass ? 'text' : 'password'} value={smtp.smtp_pass}
                                        onChange={e => setSmtp({ ...smtp, smtp_pass: e.target.value })}
                                        placeholder="xxxx xxxx xxxx xxxx"
                                        className={`${inp} pr-10 font-mono`} />
                                    <button type="button" onClick={() => setShowPass(!showPass)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-indigo-600">
                                        {showPass ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                                    </button>
                                </div>
                            </Field>
                            <Field label="✉️ From Address" hint="Email address shown to recipients">
                                <input type="email" value={smtp.smtp_from} onChange={e => setSmtp({ ...smtp, smtp_from: e.target.value })} placeholder="noreply@business.com" className={inp} />
                            </Field>
                            <Field label="🏷️ From Name" hint="Business name shown in email client">
                                <input type="text" value={smtp.company_name} onChange={e => setSmtp({ ...smtp, company_name: e.target.value })} placeholder="Alpha Retail POS" className={inp} />
                            </Field>
                        </div>

                        {/* Save SMTP */}
                        <button onClick={saveSmtp} disabled={savingSmtp}
                            className="flex items-center gap-2 px-6 py-3.5 rounded-xl text-white font-black text-sm transition-all hover:scale-[1.02] disabled:opacity-60 shadow-lg"
                            style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', boxShadow: '0 6px 20px rgba(79,70,229,.3)' }}>
                            {savingSmtp ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving...</> : <><FiSave size={15} />Save Email Settings</>}
                        </button>

                        {/* Test email */}
                        <div className="border-t border-gray-100 pt-5">
                            <p className="text-sm font-black text-gray-700 mb-3 flex items-center gap-2">
                                <FiSend size={14} className="text-emerald-600" /> Send Test Email
                            </p>
                            <div className="flex gap-3">
                                <input type="email" value={testEmail} onChange={e => setTestEmail(e.target.value)}
                                    placeholder="Enter test recipient email..." className={`${inp} flex-1`} />
                                <button onClick={sendTestEmail} disabled={testingMail}
                                    className="flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm text-white transition-all hover:scale-[1.02] disabled:opacity-60"
                                    style={{ background: 'linear-gradient(135deg,#059669,#0d9488)', boxShadow: '0 4px 16px rgba(5,150,105,.3)' }}>
                                    {testingMail ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Sending...</> : <><FiSend size={14} />Send Test</>}
                                </button>
                            </div>
                            <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2">
                                <FiAlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={13} />
                                <p className="text-[11px] text-amber-700">Save settings first before sending a test email. The test verifies your SMTP configuration is working correctly.</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
