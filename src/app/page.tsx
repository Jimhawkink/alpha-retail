'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { logActivity } from '@/lib/supabase';

// ── Hybrid PBKDF2 / plain-text password verification ─────────────────
async function verifyPassword(entered: string, stored: string): Promise<boolean> {
    if (!stored) return false;
    if (stored.includes(':')) {
        try {
            const [saltHex, expectedHex] = stored.split(':');
            const enc = new TextEncoder();
            const key = await crypto.subtle.importKey('raw', enc.encode(entered), 'PBKDF2', false, ['deriveBits']);
            const bits = await crypto.subtle.deriveBits(
                { name: 'PBKDF2', salt: enc.encode(saltHex), iterations: 210000, hash: 'SHA-512' }, key, 512
            );
            const derived = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
            return derived === expectedHex;
        } catch { return false; }
    }
    return stored === entered;
}

// ── Visual Feature Pills ─────────────────────────────────────────────
const visualFeatures = [
    {
        title: 'Fast & Reliable',
        subtitle: 'Billing',
        icon: (
            <svg className="w-5 h-5 text-[#00E676]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
        ),
    },
    {
        title: 'Powerful',
        subtitle: 'Analytics',
        icon: (
            <svg className="w-5 h-5 text-[#00E676]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
        ),
    },
    {
        title: 'Smart Inventory',
        subtitle: 'Management',
        icon: (
            <svg className="w-5 h-5 text-[#00E676]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
        ),
    },
    {
        title: 'Secure & Reliable',
        subtitle: '',
        icon: (
            <svg className="w-5 h-5 text-[#00E676]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
        ),
    },
    {
        title: 'Multi-Outlet',
        subtitle: 'Support',
        icon: (
            <svg className="w-5 h-5 text-[#00E676]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
        ),
    },
    {
        title: 'Cloud Backup',
        subtitle: '& Access',
        icon: (
            <svg className="w-5 h-5 text-[#00E676]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
        ),
    },
];

export default function LoginPage() {
    const router = useRouter();

    // ── Login state
    const [username, setUsername]         = useState('');
    const [password, setPassword]         = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading]       = useState(false);
    const [error, setError]               = useState('');
    const [storeName, setStoreName]       = useState('AlphaRetail');
    const [currentTime, setCurrentTime]   = useState('');
    const [currentDate, setCurrentDate]   = useState('');

    // ── Outlet picker
    const [showOutletPicker, setShowOutletPicker]     = useState(false);
    const [userOutlets, setUserOutlets]               = useState<any[]>([]);
    const [pendingUser, setPendingUser]               = useState<any>(null);
    const [outletPickerError, setOutletPickerError]   = useState('');

    // ── Forgot password
    const [view, setView]             = useState<'login' | 'forgot' | 'sent'>('login');
    const [fpUsername, setFpUsername] = useState('');
    const [fpLoading, setFpLoading]   = useState(false);
    const [fpError, setFpError]       = useState('');

    useEffect(() => {
        const tick = () => {
            const n = new Date();
            setCurrentTime(n.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }));
            setCurrentDate(n.toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }));
        };
        tick();
        const iv = setInterval(tick, 1000);
        supabase.from('retail_settings').select('setting_value').eq('setting_key', 'company_name').single()
            .then(({ data }) => { if (data?.setting_value) setStoreName(data.setting_value); });
        return () => clearInterval(iv);
    }, []);

    const completeLogin = (userData: any, outletId: number, outletName: string) => {
        localStorage.setItem('user', JSON.stringify({
            userId: userData.user_id, userName: userData.user_name,
            name: userData.name, userType: userData.user_type, email: userData.email,
        }));
        localStorage.setItem('activeOutletId', String(outletId));
        localStorage.setItem('activeOutletName', outletName);
        logActivity('Login', `${userData.name} logged in`, `User: ${userData.user_name}, Outlet: ${outletName}`);
        router.push('/dashboard');
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!username.trim() || !password.trim()) {
            setError('Enter your username and password.');
            return;
        }
        setIsLoading(true);
        try {
            // 1. Find user (case-insensitive username)
            const { data, error: dbError } = await supabase
                .from('retail_users')
                .select('*')
                .ilike('user_name', username.trim())
                .eq('active', true)
                .maybeSingle();

            if (dbError) throw dbError;
            if (!data) {
                setError('Invalid username or password.');
                logActivity('Login Failed', `User not found: ${username}`);
                return;
            }

            // 2. Verify password — PBKDF2 hash OR plain text OR PIN
            const ok = await verifyPassword(password, data.password_hash || '');
            const pinMatch = data.pin != null && String(data.pin).trim() === String(password).trim();

            if (!ok && !pinMatch) {
                setError('Invalid username or password.');
                logActivity('Login Failed', `Wrong password for: ${username}`);
                return;
            }

            // 3. Load assigned outlets from retail_user_outlets
            const { data: links, error: linkErr } = await supabase
                .from('retail_user_outlets')
                .select('outlet_id')
                .eq('user_id', data.user_id);

            if (linkErr) console.warn('retail_user_outlets error:', linkErr.message);

            // Detect if user is super admin (sees ALL outlets)
            const isSuperAdmin =
                data.is_super_admin === true ||
                ['superadmin', 'super admin', 'superuser', 'super user', 'admin']
                    .includes((data.user_type || '').toLowerCase()) ||
                ['superadmin', 'superuser', 'admin']
                    .includes((data.user_name || '').toLowerCase());

            let available: any[] = [];
            if (links && links.length > 0) {
                const ids = links.map((l: any) => l.outlet_id);
                const { data: od } = await supabase
                    .from('retail_outlets')
                    .select('outlet_id,outlet_name,outlet_code,is_main')
                    .in('outlet_id', ids)
                    .eq('active', true)
                    .order('is_main', { ascending: false })
                    .order('outlet_name');
                available = od || [];
            } else if (isSuperAdmin) {
                const { data: od } = await supabase
                    .from('retail_outlets')
                    .select('outlet_id,outlet_name,outlet_code,is_main')
                    .eq('active', true)
                    .order('is_main', { ascending: false })
                    .order('outlet_name');
                available = od || [];
            } else {
                const { data: mainOutlet } = await supabase
                    .from('retail_outlets')
                    .select('outlet_id,outlet_name,outlet_code,is_main')
                    .eq('active', true)
                    .eq('is_main', true)
                    .maybeSingle();
                if (mainOutlet) {
                    available = [mainOutlet];
                } else {
                    const { data: firstOd } = await supabase
                        .from('retail_outlets')
                        .select('outlet_id,outlet_name,outlet_code,is_main')
                        .eq('active', true)
                        .order('outlet_id')
                        .limit(1);
                    available = firstOd || [];
                }
            }

            // 3.5 Check lockout status for all available outlets
            const { data: lockoutRows } = await supabase
                .from('organisation_settings')
                .select('setting_key, setting_value')
                .like('setting_key', 'system_lockout_%');

            const lockMap: Record<string, string> = {};
            (lockoutRows || []).forEach((r: any) => { lockMap[r.setting_key] = r.setting_value || ''; });

            const enrichedOutlets = available.map((o: any) => ({
                ...o,
                locked: lockMap[`system_lockout_outlet_${o.outlet_id}`] === 'true',
                lockoutReason: lockMap[`system_lockout_reason_${o.outlet_id}`] || 'Cloud access has ended. Please pay for cloud hosting to avoid interruptions.'
            }));

            // 4. Single outlet → auto-login; Multiple → show picker
            if (enrichedOutlets.length > 1) {
                setPendingUser({ ...data, isSuperAdmin });
                setUserOutlets(enrichedOutlets);
                setOutletPickerError('');
                setShowOutletPicker(true);
            } else {
                const o = enrichedOutlets[0] || { outlet_id: 1, outlet_name: 'Main Outlet', outlet_code: 'MAIN', locked: false };
                if (o.locked && !isSuperAdmin) {
                    setError(`🔒 Access Suspended: Cloud access for ${o.outlet_name} has ended. Please pay for cloud hosting to restore service.`);
                    return;
                }
                completeLogin(data, o.outlet_id, o.outlet_name);
            }
        } catch (err: any) {
            console.error('Login error:', err);
            setError('Connection error. Please check your internet and try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleForgotPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!fpUsername.trim()) { setFpError('Enter your username.'); return; }
        setFpLoading(true); setFpError('');
        try {
            const res = await fetch('/api/auth/forgot-password', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: fpUsername.trim() }),
            });
            const data = await res.json();
            if (res.status === 429) { setFpError(data.error); }
            else { setView('sent'); }
        } catch { setFpError('Network error. Please try again.'); }
        setFpLoading(false);
    };

    // ── Outlet picker screen ─────────────────────────────────────────────
    if (showOutletPicker) return (
        <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
            style={{
                backgroundColor: '#041226',
                backgroundImage: `radial-gradient(ellipse at 80% 20%, rgba(16, 185, 129, 0.15), transparent 50%),
                                  radial-gradient(ellipse at 20% 80%, rgba(14, 165, 233, 0.12), transparent 50%)`
            }}>

            {/* Background elements */}
            <div className="absolute inset-0 bg-cover bg-center opacity-20 pointer-events-none"
                style={{ backgroundImage: `url('https://images.unsplash.com/photo-1578916171728-46686eac8d58?auto=format&fit=crop&w=2000&q=80')` }} />

            <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden relative z-10 border-2 border-emerald-400/80"
                style={{ boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.5), 0 0 40px rgba(16, 185, 129, 0.2)' }}>

                {/* Header */}
                <div className="p-8 text-center bg-gradient-to-br from-[#091D3E] via-[#0E2852] to-[#12356B] relative">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center mx-auto mb-3 text-2xl shadow-lg">
                        🏪
                    </div>
                    <h1 className="text-2xl font-black text-white tracking-tight">Select Your Outlet</h1>
                    <p className="text-slate-300 text-xs mt-1">
                        Welcome <span className="text-emerald-400 font-bold">{pendingUser?.name}</span>! Choose your terminal location
                    </p>
                    <div className="inline-flex items-center gap-1.5 mt-2.5 px-3 py-1 rounded-full text-[11px] font-bold bg-white/10 text-emerald-300 border border-emerald-400/30">
                        {pendingUser?.isSuperAdmin ? '👑 Super Admin Access' : '👤 Assigned Staff'}
                    </div>
                </div>

                {/* Outlets list */}
                <div className="p-6 space-y-3 bg-white">
                    {outletPickerError && (
                        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold leading-relaxed flex items-start gap-2">
                            <span className="text-base shrink-0">⚠️</span>
                            <span>{outletPickerError}</span>
                        </div>
                    )}

                    <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
                        {userOutlets.map(outlet => {
                            const isLocked = outlet.locked;
                            const isSA = pendingUser?.isSuperAdmin;
                            return (
                                <button
                                    key={outlet.outlet_id}
                                    onClick={() => {
                                        if (isLocked && !isSA) {
                                            setOutletPickerError(`🔒 Cloud access for ${outlet.outlet_name} has ended. Access is blocked until payment is made. Please contact Alpha Retail support.`);
                                            return;
                                        }
                                        completeLogin(pendingUser, outlet.outlet_id, outlet.outlet_name);
                                    }}
                                    className={`w-full flex items-center gap-3.5 p-3.5 rounded-2xl border-2 transition-all text-left group ${
                                        isLocked
                                            ? 'border-rose-200 bg-rose-50/60 hover:border-rose-300'
                                            : 'border-slate-100 bg-slate-50/50 hover:border-emerald-400 hover:bg-emerald-50/40 hover:shadow-md'
                                    }`}
                                >
                                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0 shadow-sm ${
                                        isLocked
                                            ? 'bg-gradient-to-br from-rose-500 to-red-600 text-white'
                                            : outlet.is_main
                                            ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white'
                                            : 'bg-gradient-to-br from-[#091D3E] to-[#12356B] text-emerald-400'
                                    }`}>
                                        {isLocked ? '🔒' : outlet.is_main ? '⭐' : '🏪'}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className={`font-black text-sm truncate ${
                                                isLocked ? 'text-rose-900' : 'text-slate-800 group-hover:text-emerald-700'
                                            }`}>
                                                {outlet.outlet_name}
                                            </p>
                                            {outlet.is_main && !isLocked && (
                                                <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                                                    HEAD OFFICE
                                                </span>
                                            )}
                                            {isLocked && (
                                                <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 border border-rose-300">
                                                    LOCKED
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                                            {outlet.outlet_code}{isLocked ? ' · Subscription Due' : ' · Active Terminal'}
                                        </p>
                                    </div>
                                    <svg className={`w-4 h-4 shrink-0 transition-transform group-hover:translate-x-1 ${
                                        isLocked ? 'text-rose-400' : 'text-slate-300 group-hover:text-emerald-600'
                                    }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                                    </svg>
                                </button>
                            );
                        })}
                    </div>

                    <button
                        onClick={() => { setShowOutletPicker(false); setPendingUser(null); setOutletPickerError(''); }}
                        className="w-full py-3 text-xs font-bold text-slate-500 hover:text-slate-800 border border-slate-200 rounded-xl hover:bg-slate-50 transition-all mt-3"
                    >
                        ← Back to Login Credentials
                    </button>
                </div>
            </div>
        </div>
    );

    // ── Main layout (Matches Exact Image 2) ──────────────────────────────
    return (
        <div className="min-h-screen flex flex-col justify-between relative overflow-hidden font-sans"
            style={{ backgroundColor: '#041226' }}>

            {/* ═══════════════════════════════════════════════════
                SUPERMARKET AISLE PHOTO BACKGROUND
            ═══════════════════════════════════════════════════ */}
            <div
                className="absolute inset-0 bg-cover bg-center pointer-events-none"
                style={{
                    backgroundImage: `url('https://images.unsplash.com/photo-1578916171728-46686eac8d58?auto=format&fit=crop&w=2200&q=85')`,
                    filter: 'brightness(0.38) saturate(1.2)'
                }}
            />

            {/* Rich Navy Blue & Emerald Gradient Vignette */}
            <div
                className="absolute inset-0 pointer-events-none"
                style={{
                    background: `linear-gradient(90deg, 
                        rgba(4, 18, 38, 0.97) 0%, 
                        rgba(4, 22, 46, 0.92) 35%, 
                        rgba(5, 28, 58, 0.85) 60%, 
                        rgba(4, 18, 38, 0.90) 100%)`
                }}
            />

            {/* ═══════════════════════════════════════════════════
                SWEEPING EMERALD & GOLD DYNAMIC CURVED RIBBONS
            ═══════════════════════════════════════════════════ */}
            {/* Top Ribbon Wave */}
            <div className="absolute top-0 right-0 left-0 h-48 pointer-events-none overflow-hidden opacity-90">
                <svg className="w-full h-full" viewBox="0 0 1440 280" fill="none" preserveAspectRatio="none">
                    <path
                        d="M600 0 C780 120, 1000 180, 1440 30 L1440 0 Z"
                        fill="url(#topGreenGrad)"
                        opacity="0.8"
                    />
                    <path
                        d="M680 0 C840 90, 1080 140, 1440 10 L1440 0 Z"
                        fill="url(#topGoldGrad)"
                        opacity="0.7"
                    />
                    <defs>
                        <linearGradient id="topGreenGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#00E676" />
                            <stop offset="100%" stopColor="#059669" />
                        </linearGradient>
                        <linearGradient id="topGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#F59E0B" />
                            <stop offset="100%" stopColor="#EAB308" />
                        </linearGradient>
                    </defs>
                </svg>
            </div>

            {/* Bottom Swooshing Curved Ribbon */}
            <div className="absolute bottom-10 left-0 right-0 h-64 pointer-events-none overflow-hidden opacity-95">
                <svg className="w-full h-full" viewBox="0 0 1440 320" fill="none" preserveAspectRatio="none">
                    <path
                        d="M-50 280 C320 280, 560 210, 850 120 C1020 70, 1220 90, 1500 240 L1500 340 L-50 340 Z"
                        fill="url(#bottomGreenRibbon)"
                    />
                    <path
                        d="M-50 295 C300 295, 520 240, 780 165 C960 115, 1180 135, 1500 280 L1500 340 L-50 340 Z"
                        fill="url(#bottomGoldRibbon)"
                    />
                    <defs>
                        <linearGradient id="bottomGreenRibbon" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#00E676" />
                            <stop offset="50%" stopColor="#10B981" />
                            <stop offset="100%" stopColor="#047857" />
                        </linearGradient>
                        <linearGradient id="bottomGoldRibbon" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#F59E0B" />
                            <stop offset="60%" stopColor="#D97706" />
                            <stop offset="100%" stopColor="#047857" />
                        </linearGradient>
                    </defs>
                </svg>
            </div>

            {/* ═══════════════════════════════════════════════════
                MAIN CONTENT: LEFT SHOWCASE & RIGHT LOGIN CARD
            ═══════════════════════════════════════════════════ */}
            <div className="flex-1 flex flex-col lg:flex-row items-center justify-between px-6 sm:px-10 lg:px-16 xl:px-20 py-8 lg:py-12 relative z-10 gap-10">

                {/* ── LEFT SHOWCASE ── */}
                <div className="w-full lg:max-w-[560px] xl:max-w-[620px] flex flex-col justify-between">

                    {/* Brand Logo Header */}
                    <div className="flex items-center gap-3.5 mb-8">
                        <div className="w-13 h-13 rounded-2xl bg-[#00E676]/15 border-2 border-[#00E676]/40 flex items-center justify-center p-2.5 shadow-lg shadow-emerald-500/10">
                            <svg className="w-8 h-8 text-[#00E676]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                        </div>
                        <div>
                            <div className="text-3xl font-black text-white tracking-tight leading-none">
                                Alpha<span className="text-[#00E676]">Retail</span>
                            </div>
                            <div className="text-[10px] font-bold tracking-[0.25em] text-slate-300 uppercase mt-1">
                                ENTERPRISE POS SYSTEM
                            </div>
                        </div>
                    </div>

                    {/* Headline */}
                    <div className="mb-8">
                        <h1 className="text-4xl sm:text-5xl lg:text-[52px] font-black text-white leading-[1.12] tracking-tight">
                            Everything You Need<br />
                            <span className="text-[#00E676]">to Run Retail.</span>
                        </h1>
                        <p className="text-slate-300 text-sm sm:text-base leading-relaxed mt-4 max-w-lg font-normal">
                            Kenya's most complete point-of-sale system —<br className="hidden sm:inline" />
                            for supermarkets, mini-marts, pharmacies and more.
                        </p>
                    </div>

                    {/* 6 Feature Pills in 2 Columns */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                        {visualFeatures.map((item, idx) => (
                            <div
                                key={idx}
                                className="flex items-center gap-3.5 px-4 py-3 rounded-2xl bg-[#081B38]/85 backdrop-blur-md border border-[#163866] hover:border-emerald-400/50 transition-all duration-200 group"
                            >
                                <div className="w-10 h-10 rounded-xl bg-[#0D2852] border border-[#1E4D8A] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                                    {item.icon}
                                </div>
                                <div className="min-w-0">
                                    <p className="text-white font-bold text-xs leading-tight truncate">
                                        {item.title}
                                    </p>
                                    {item.subtitle && (
                                        <p className="text-slate-300 text-[11px] leading-tight mt-0.5 truncate">
                                            {item.subtitle}
                                        </p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Bottom Tagline */}
                    <div className="flex items-center gap-2.5">
                        <span className="w-1 h-5 rounded-full bg-[#00E676] inline-block shadow-sm shadow-emerald-400" />
                        <p className="text-slate-200 text-sm font-medium">
                            Grow Your Business with <span className="text-[#00E676] font-bold">AlphaRetail</span>
                        </p>
                    </div>
                </div>

                {/* ── RIGHT LOGIN CARD (EXACT IMAGE 2) ── */}
                <div className="w-full max-w-[430px] relative">

                    {/* Glowing outer border frame */}
                    <div className="w-full bg-white rounded-3xl p-7 sm:p-9 shadow-2xl relative border-2 border-emerald-400/80"
                        style={{
                            boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.6), 0 0 35px rgba(16, 185, 129, 0.2)'
                        }}
                    >

                        {/* Top Badge: Shield Icon + Secure Access */}
                        <div className="flex items-center gap-3 mb-6 pb-2">
                            <div className="w-12 h-12 rounded-2xl bg-[#091D3E] text-white flex items-center justify-center shadow-md shrink-0">
                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                            </div>
                            <div>
                                <div className="text-xs font-black text-emerald-600 uppercase tracking-wide">
                                    Secure Access
                                </div>
                                <div className="text-xs text-slate-500 font-medium">
                                    Sign in to your AlphaRetail account
                                </div>
                            </div>
                        </div>

                        {/* Heading */}
                        <div className="mb-5">
                            {view === 'login' && (
                                <>
                                    <h2 className="text-3xl font-black text-[#091D3E] tracking-tight">
                                        Welcome back
                                    </h2>
                                    <p className="text-xs text-slate-500 mt-1 font-medium">
                                        Sign in to continue to <span className="font-bold text-[#091D3E]">{storeName} POS</span>
                                    </p>
                                </>
                            )}
                            {view === 'forgot' && (
                                <>
                                    <button
                                        onClick={() => { setView('login'); setFpError(''); setFpUsername(''); }}
                                        className="flex items-center gap-1.5 text-slate-400 hover:text-indigo-600 text-xs mb-3 font-semibold transition-colors"
                                    >
                                        ← Back to login
                                    </button>
                                    <h2 className="text-2xl font-black text-[#091D3E] tracking-tight">
                                        Forgot Password?
                                    </h2>
                                    <p className="text-xs text-slate-500 mt-1">
                                        Enter your username — we'll email you a reset link.
                                    </p>
                                </>
                            )}
                            {view === 'sent' && (
                                <div className="text-center py-2">
                                    <div className="text-4xl mb-2">📨</div>
                                    <h2 className="text-xl font-black text-[#091D3E]">Check Your Email</h2>
                                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                                        If <span className="font-bold text-indigo-600">{fpUsername}</span> is registered, a secure reset link has been sent.
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* ── LOGIN FORM ── */}
                        {view === 'login' && (
                            <form onSubmit={handleLogin} className="space-y-4">
                                {/* Username */}
                                <div>
                                    <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1.5">
                                        <svg className="w-4 h-4 text-slate-500" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"/>
                                        </svg>
                                        Username
                                    </label>
                                    <div className="relative">
                                        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                                            <svg className="w-4.5 h-4.5" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"/>
                                            </svg>
                                        </div>
                                        <input
                                            id="username"
                                            type="text"
                                            value={username}
                                            onChange={e => setUsername(e.target.value)}
                                            placeholder="Enter your username"
                                            autoComplete="username"
                                            className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 text-sm font-medium focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all placeholder:text-slate-400"
                                        />
                                    </div>
                                </div>

                                {/* Password or PIN */}
                                <div>
                                    <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1.5">
                                        <svg className="w-4 h-4 text-slate-500" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/>
                                        </svg>
                                        Password or PIN
                                    </label>
                                    <div className="relative">
                                        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                                            <svg className="w-4.5 h-4.5" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/>
                                            </svg>
                                        </div>
                                        <input
                                            id="password"
                                            type={showPassword ? 'text' : 'password'}
                                            value={password}
                                            onChange={e => setPassword(e.target.value)}
                                            placeholder="Enter your password or PIN"
                                            autoComplete="current-password"
                                            className="w-full pl-11 pr-11 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 text-sm font-medium focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all placeholder:text-slate-400"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-0.5"
                                        >
                                            {showPassword ? (
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                                                </svg>
                                            ) : (
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                </svg>
                                            )}
                                        </button>
                                    </div>
                                </div>

                                {/* Error alert */}
                                {error && (
                                    <div className="flex items-center gap-2.5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                                        <svg className="w-4 h-4 shrink-0 text-rose-500" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                                        </svg>
                                        <span>{error}</span>
                                    </div>
                                )}

                                {/* Forgot Password Link */}
                                <div className="flex justify-end pt-0.5">
                                    <button
                                        type="button"
                                        onClick={() => { setView('forgot'); setError(''); }}
                                        className="text-xs text-[#1E40AF] hover:text-[#1D4ED8] font-bold hover:underline transition-colors"
                                    >
                                        Forgot password?
                                    </button>
                                </div>

                                {/* Sign In Button (Deep Midnight Navy) */}
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full py-3.5 rounded-xl text-white font-bold text-sm tracking-wide bg-gradient-to-r from-[#091D3E] via-[#0E2852] to-[#12356B] hover:from-[#0B2349] hover:to-[#174384] active:scale-[0.99] transition-all flex items-center justify-center gap-2 shadow-lg shadow-slate-900/30 disabled:opacity-60 cursor-pointer"
                                >
                                    {isLoading ? (
                                        <>
                                            <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                                            <span>Signing in...</span>
                                        </>
                                    ) : (
                                        <>
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                            </svg>
                                            <span>Sign In</span>
                                        </>
                                    )}
                                </button>

                                {/* Protected Note */}
                                <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500 pt-2">
                                    <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                                    </svg>
                                    <span>Your data is protected and secure</span>
                                </div>
                            </form>
                        )}

                        {/* ── FORGOT PASSWORD FORM ── */}
                        {view === 'forgot' && (
                            <form onSubmit={handleForgotPassword} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Your Username</label>
                                    <input
                                        type="text"
                                        value={fpUsername}
                                        onChange={e => setFpUsername(e.target.value)}
                                        placeholder="Enter your username"
                                        autoFocus
                                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 text-sm font-medium focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none"
                                    />
                                </div>

                                {fpError && (
                                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                                        {fpError}
                                    </div>
                                )}

                                <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700 leading-relaxed">
                                    🔒 A secure reset link will be sent to your registered email address. The link expires in 1 hour.
                                </div>

                                <button
                                    type="submit"
                                    disabled={fpLoading}
                                    className="w-full py-3.5 rounded-xl text-white font-bold text-sm bg-gradient-to-r from-[#091D3E] via-[#0E2852] to-[#12356B] flex items-center justify-center gap-2 shadow-lg disabled:opacity-60"
                                >
                                    {fpLoading ? 'Sending link...' : '📧 Send Reset Link'}
                                </button>
                            </form>
                        )}

                        {/* ── EMAIL SENT ── */}
                        {view === 'sent' && (
                            <div className="space-y-3 mt-4">
                                <button
                                    onClick={() => { setView('login'); setFpUsername(''); setFpError(''); }}
                                    className="w-full py-3.5 rounded-xl text-white font-bold text-sm bg-gradient-to-r from-[#091D3E] via-[#0E2852] to-[#12356B] shadow-lg"
                                >
                                    ← Back to Login
                                </button>
                                <button
                                    onClick={() => { setView('forgot'); setFpError(''); }}
                                    className="w-full py-3 text-xs text-indigo-600 font-bold border border-indigo-200 rounded-xl hover:bg-indigo-50"
                                >
                                    Resend Reset Email
                                </button>
                            </div>
                        )}

                        {/* Card Bottom Footer */}
                        <div className="pt-4 mt-5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                            <span>© {new Date().getFullYear()} AlphaRetail POS v2.0</span>
                            <div className="flex items-center gap-2">
                                <span className="flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
                                    <span className="text-slate-600 font-semibold">Online</span>
                                </span>
                                <span className="text-slate-300">|</span>
                                <span>Enterprise Ready</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══════════════════════════════════════════════════
                BOTTOM FULL-WIDTH FOOTER BAR (EXACT IMAGE 2)
            ═══════════════════════════════════════════════════ */}
            <div className="w-full bg-[#030B17] border-t border-[#0A1E3F] px-6 lg:px-12 py-3 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-400 relative z-20">
                <div className="flex items-center gap-6 sm:gap-8 flex-wrap">
                    <div className="flex items-center gap-2">
                        <span className="text-sm">🎧</span>
                        <span className="font-semibold text-slate-300">24/7 Support</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-sm">⚡</span>
                        <span className="font-semibold text-slate-300">High Performance</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-sm">🛡️</span>
                        <span className="font-semibold text-slate-300">Enterprise Security</span>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <span className="font-bold text-white tracking-wide">
                        Alpha<span className="text-[#00E676]">Retail</span>
                    </span>
                    <span className="text-slate-600">|</span>
                    <span className="text-slate-400 italic">Retail Smarter. Grow Faster.</span>
                </div>
            </div>
        </div>
    );
}
