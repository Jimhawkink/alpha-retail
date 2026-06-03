'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { logActivity } from '@/lib/supabase';

// ── Hybrid password verification (PBKDF2-SHA512 + plain-text fallback) ─
async function verifyPassword(entered: string, stored: string): Promise<boolean> {
    if (!stored) return false;
    if (stored.includes(':')) {
        try {
            const [saltHex, expectedHex] = stored.split(':');
            const enc = new TextEncoder();
            const key = await crypto.subtle.importKey(
                'raw', enc.encode(entered), 'PBKDF2', false, ['deriveBits']
            );
            const bits = await crypto.subtle.deriveBits(
                { name: 'PBKDF2', salt: enc.encode(saltHex), iterations: 210000, hash: 'SHA-512' },
                key, 512
            );
            const derived = Array.from(new Uint8Array(bits))
                .map(b => b.toString(16).padStart(2, '0')).join('');
            return derived === expectedHex;
        } catch { return false; }
    }
    return stored === entered;
}

// ── Floating label input ─────────────────────────────────────────────
function FloatingInput({
    id, label, type = 'text', value, onChange, icon, rightEl,
}: {
    id: string; label: string; type?: string; value: string;
    onChange: (v: string) => void; icon: React.ReactNode; rightEl?: React.ReactNode;
}) {
    const [focused, setFocused] = useState(false);
    const up = focused || value.length > 0;
    return (
        <div className="relative">
            <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${up ? 'text-teal-400' : 'text-slate-500'}`}>
                {icon}
            </div>
            <input
                id={id}
                type={type}
                value={value}
                onChange={e => onChange(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                placeholder={up ? '' : label}
                className={`w-full pl-11 pr-12 py-4 rounded-xl bg-slate-800/60 border text-white text-sm outline-none transition-all placeholder:text-slate-500
                    ${up ? 'border-teal-500/70 ring-2 ring-teal-500/10' : 'border-slate-700 hover:border-slate-600'}`}
            />
            {up && (
                <label htmlFor={id} className="absolute left-11 -top-2.5 text-[10px] font-bold text-teal-400 bg-slate-900 px-1.5 rounded">
                    {label}
                </label>
            )}
            {rightEl && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2">{rightEl}</div>
            )}
        </div>
    );
}

export default function LoginPage() {
    const router = useRouter();

    // Login state
    const [username, setUsername]         = useState('');
    const [password, setPassword]         = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading]       = useState(false);
    const [error, setError]               = useState('');
    const [currentTime, setCurrentTime]   = useState('');
    const [currentDate, setCurrentDate]   = useState('');
    const [storeName, setStoreName]       = useState('Alpha Retail');

    // Outlet picker
    const [showOutletPicker, setShowOutletPicker] = useState(false);
    const [userOutlets, setUserOutlets] = useState<{ outlet_id: number; outlet_name: string; outlet_code: string; is_main: boolean }[]>([]);
    const [pendingUser, setPendingUser] = useState<any>(null);

    // Forgot password
    const [showForgot, setShowForgot]   = useState(false);
    const [fpUsername, setFpUsername]   = useState('');
    const [fpLoading, setFpLoading]     = useState(false);
    const [fpResult, setFpResult]       = useState<{ ok: boolean; msg: string; pin?: string } | null>(null);

    // Animated particles
    const particles = Array.from({ length: 20 }, (_, i) => i);

    useEffect(() => {
        const tick = () => {
            const n = new Date();
            setCurrentTime(n.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }));
            setCurrentDate(n.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }));
        };
        tick();
        const iv = setInterval(tick, 1000);

        supabase.from('retail_settings').select('setting_value').eq('setting_key', 'company_name').single()
            .then(({ data }) => { if (data?.setting_value) setStoreName(data.setting_value); });

        return () => clearInterval(iv);
    }, []);

    const completeLogin = (userData: any, outletId: number, outletName: string) => {
        localStorage.setItem('user', JSON.stringify({
            userId:   userData.user_id,
            userName: userData.user_name,
            name:     userData.name,
            userType: userData.user_type,
            email:    userData.email,
        }));
        localStorage.setItem('activeOutletId', String(outletId));
        localStorage.setItem('activeOutletName', outletName);
        logActivity('Login', `${userData.name} logged in`, `User: ${userData.user_name}, Role: ${userData.user_type}, Outlet: ${outletName}`);
        router.push('/dashboard');
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        if (!username || !password) {
            setError('Please enter your username and password.');
            setIsLoading(false);
            return;
        }

        try {
            const { data, error: dbError } = await supabase
                .from('retail_users')
                .select('*')
                .ilike('user_name', username)
                .eq('active', true)
                .single();

            if (dbError || !data) {
                setError('Invalid username or password.');
                logActivity('Login', `Failed login attempt for: ${username}`, 'Invalid credentials');
                setIsLoading(false);
                return;
            }

            const passwordValid = await verifyPassword(password, data.password_hash);
            if (passwordValid || data.pin === password) {
                const { data: outletLinks } = await supabase
                    .from('retail_user_outlets').select('outlet_id').eq('user_id', data.user_id);

                let available: typeof userOutlets = [];
                if (outletLinks && outletLinks.length > 0) {
                    const ids = outletLinks.map((l: any) => l.outlet_id);
                    const { data: od } = await supabase.from('retail_outlets')
                        .select('outlet_id, outlet_name, outlet_code, is_main').in('outlet_id', ids).eq('active', true);
                    available = od || [];
                } else {
                    const { data: od } = await supabase.from('retail_outlets')
                        .select('outlet_id, outlet_name, outlet_code, is_main').eq('active', true);
                    available = od || [];
                }

                if (available.length > 1) {
                    setPendingUser(data); setUserOutlets(available); setShowOutletPicker(true);
                } else {
                    const outlet = available[0] || { outlet_id: 1, outlet_name: 'Main Outlet' };
                    completeLogin(data, outlet.outlet_id, outlet.outlet_name);
                }
            } else {
                setError('Invalid username or password.');
            }
        } catch {
            setError('Connection error. Please try again.');
        }
        setIsLoading(false);
    };

    // Forgot password — generate temp PIN and update DB
    const handleForgotPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!fpUsername.trim()) { setFpResult({ ok: false, msg: 'Enter your username first.' }); return; }
        setFpLoading(true);
        setFpResult(null);

        const { data, error } = await supabase
            .from('retail_users')
            .select('user_id, user_name, name, email, active')
            .ilike('user_name', fpUsername.trim())
            .single();

        if (error || !data) {
            setFpResult({ ok: false, msg: 'Username not found. Contact your system administrator.' });
            setFpLoading(false);
            return;
        }
        if (!data.active) {
            setFpResult({ ok: false, msg: 'This account is inactive. Contact your administrator.' });
            setFpLoading(false);
            return;
        }

        // Generate a secure 6-digit temp PIN
        const tempPin = Math.floor(100000 + Math.random() * 900000).toString();
        await supabase.from('retail_users').update({ pin: tempPin }).eq('user_id', data.user_id);

        setFpResult({
            ok: true,
            msg: `Temporary PIN generated for ${data.name}. Use it to login, then update your password in Settings.`,
            pin: tempPin,
        });
        setFpLoading(false);
    };

    // ── Outlet picker ────────────────────────────────────────────────
    if (showOutletPicker) return (
        <div className="min-h-screen flex items-center justify-center p-4"
            style={{ background: 'linear-gradient(135deg, #0f172a 0%, #134e4a 50%, #0f172a 100%)' }}>
            <div className="w-full max-w-md">
                <div className="bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
                    <div className="px-8 py-7 border-b border-white/10 text-center"
                        style={{ background: 'linear-gradient(135deg, #14b8a6, #0d9488)' }}>
                        <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-3">
                            <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"/>
                            </svg>
                        </div>
                        <h1 className="text-xl font-bold text-white">Select Outlet</h1>
                        <p className="text-teal-100/80 text-sm mt-1">Welcome {pendingUser?.name}! Choose your outlet</p>
                    </div>
                    <div className="p-6 space-y-3">
                        {userOutlets.map(outlet => (
                            <button key={outlet.outlet_id}
                                onClick={() => completeLogin(pendingUser, outlet.outlet_id, outlet.outlet_name)}
                                className="w-full flex items-center gap-4 p-4 rounded-xl border border-white/10 hover:border-teal-500/50 hover:bg-teal-500/10 transition-all group text-left">
                                <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-white shadow-md ${outlet.is_main ? 'bg-gradient-to-br from-amber-500 to-orange-600' : 'bg-gradient-to-br from-teal-500 to-emerald-600'}`}>
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4z" clipRule="evenodd"/>
                                    </svg>
                                </div>
                                <div className="flex-1">
                                    <p className="font-bold text-white text-sm group-hover:text-teal-300 transition-colors">{outlet.outlet_name}</p>
                                    <p className="text-xs text-slate-400 font-mono">{outlet.outlet_code}{outlet.is_main ? ' · Head Office' : ''}</p>
                                </div>
                                <svg className="w-5 h-5 text-slate-600 group-hover:text-teal-400 transition-colors" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd"/>
                                </svg>
                            </button>
                        ))}
                        <button onClick={() => { setShowOutletPicker(false); setPendingUser(null); }}
                            className="w-full py-3 text-sm text-slate-500 hover:text-slate-300 border border-white/10 rounded-xl mt-2 transition-colors">
                            ← Back to Login
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );

    // ── Main login / forgot password screen ──────────────────────────
    return (
        <div className="min-h-screen flex relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #0f172a 0%, #134e4a 50%, #0f172a 100%)' }}>

            {/* Animated background orbs */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full opacity-20"
                    style={{ background: 'radial-gradient(circle, #14b8a6, transparent)', filter: 'blur(80px)', animation: 'pulse 6s ease-in-out infinite' }} />
                <div className="absolute bottom-[-10%] left-[-5%] w-[600px] h-[600px] rounded-full opacity-15"
                    style={{ background: 'radial-gradient(circle, #0d9488, transparent)', filter: 'blur(100px)', animation: 'pulse 8s ease-in-out infinite reverse' }} />
                <div className="absolute top-[40%] left-[30%] w-[300px] h-[300px] rounded-full opacity-10"
                    style={{ background: 'radial-gradient(circle, #134e4a, transparent)', filter: 'blur(60px)' }} />
            </div>

            {/* Floating particles */}
            <div className="absolute inset-0 pointer-events-none">
                {particles.map(i => (
                    <div key={i} className="absolute rounded-full bg-teal-400/20"
                        style={{
                            width: Math.random() * 4 + 2 + 'px',
                            height: Math.random() * 4 + 2 + 'px',
                            left: Math.random() * 100 + '%',
                            top: Math.random() * 100 + '%',
                            animation: `float ${Math.random() * 10 + 5}s ease-in-out infinite`,
                            animationDelay: Math.random() * 5 + 's',
                        }} />
                ))}
            </div>

            <style>{`
                @keyframes float {
                    0%, 100% { transform: translateY(0px) scale(1); opacity: 0.3; }
                    50% { transform: translateY(-30px) scale(1.2); opacity: 0.8; }
                }
                @keyframes slideUp {
                    from { transform: translateY(20px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
                    20%, 40%, 60%, 80% { transform: translateX(4px); }
                }
                .animate-shake { animation: shake 0.5s ease-in-out; }
                .slide-up { animation: slideUp 0.4s ease-out; }
            `}</style>

            {/* ── LEFT: Branding Panel ── */}
            <div className="hidden lg:flex lg:w-[48%] flex-col justify-between p-12 relative z-10">
                <div>
                    {/* Logo */}
                    <div className="flex items-center gap-3 mb-12">
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-xl"
                            style={{ background: 'linear-gradient(135deg, #14b8a6, #0d9488)' }}>
                            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"/>
                            </svg>
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-white tracking-tight" style={{ fontFamily: 'Outfit, sans-serif' }}>
                                Alpha<span className="text-teal-400">Retail</span>
                            </h1>
                            <p className="text-[10px] text-teal-500/70 font-semibold tracking-[0.2em] uppercase">Enterprise POS</p>
                        </div>
                    </div>

                    {/* Tagline */}
                    <div className="mb-10">
                        <h2 className="text-4xl font-black text-white leading-tight mb-4">
                            Smart Retail<br />
                            <span className="text-transparent bg-clip-text"
                                style={{ backgroundImage: 'linear-gradient(90deg, #14b8a6, #34d399)' }}>
                                Management
                            </span>
                        </h2>
                        <p className="text-slate-400 text-base leading-relaxed max-w-sm">
                            Comprehensive point of sale, inventory, finance, and M-Pesa integration — all in one powerful enterprise platform.
                        </p>
                    </div>

                    {/* Feature cards */}
                    <div className="grid grid-cols-2 gap-3">
                        {[
                            { icon: '⚡', label: 'Instant POS', desc: 'Fast checkout with M-Pesa & cash' },
                            { icon: '📦', label: 'Smart Inventory', desc: 'Real-time stock tracking' },
                            { icon: '📊', label: 'Live Analytics', desc: 'Sales, profit & P&L reports' },
                            { icon: '🏢', label: 'Multi-Outlet', desc: 'Manage all branches centrally' },
                        ].map(f => (
                            <div key={f.label} className="rounded-xl border border-white/10 p-4 hover:border-teal-500/30 hover:bg-teal-500/5 transition-all"
                                style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(10px)' }}>
                                <div className="text-2xl mb-2">{f.icon}</div>
                                <p className="text-sm font-bold text-white">{f.label}</p>
                                <p className="text-[11px] text-slate-500 mt-0.5">{f.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Bottom: time + credits */}
                <div className="border-t border-white/10 pt-6">
                    <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
                        <span className="text-teal-400 font-bold">{currentTime}</span>
                        <span>·</span>
                        <span>{currentDate}</span>
                    </div>
                    <p className="text-slate-600 text-xs">Powered by <span className="text-teal-400 font-semibold">Alpha Solutions</span></p>
                    <p className="text-slate-700 text-[10px] mt-0.5">Developed by Jimhawkins Korir · 0720316175</p>
                </div>
            </div>

            {/* ── RIGHT: Login / Forgot Password Form ── */}
            <div className="flex-1 flex items-center justify-center p-6 relative z-10">
                <div className="w-full max-w-[420px]">

                    {/* Mobile logo */}
                    <div className="lg:hidden text-center mb-8">
                        <div className="inline-flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                                style={{ background: 'linear-gradient(135deg, #14b8a6, #0d9488)' }}>
                                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"/>
                                </svg>
                            </div>
                            <span className="text-xl font-bold text-white">Alpha<span className="text-teal-400">Retail</span></span>
                        </div>
                        <p className="text-slate-500 text-sm">{storeName}</p>
                    </div>

                    {/* Card */}
                    <div className="rounded-2xl border border-white/10 shadow-2xl overflow-hidden slide-up"
                        style={{ background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(20px)' }}>

                        {/* Card header */}
                        <div className="px-8 pt-8 pb-6">
                            {!showForgot ? (
                                <>
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
                                        <span className="text-[11px] font-bold text-teal-400 uppercase tracking-widest">Secure Access</span>
                                    </div>
                                    <h2 className="text-2xl font-black text-white">Welcome back</h2>
                                    <p className="text-slate-400 text-sm mt-1">Sign in to {storeName} POS</p>
                                </>
                            ) : (
                                <>
                                    <button onClick={() => { setShowForgot(false); setFpResult(null); setFpUsername(''); }}
                                        className="flex items-center gap-1.5 text-slate-400 hover:text-teal-400 text-sm mb-4 transition-colors">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                        </svg>
                                        Back to Login
                                    </button>
                                    <h2 className="text-2xl font-black text-white">Forgot Password?</h2>
                                    <p className="text-slate-400 text-sm mt-1">A temporary PIN will be generated for you</p>
                                </>
                            )}
                        </div>

                        <div className="px-8 pb-8">
                            {/* ── LOGIN FORM ── */}
                            {!showForgot && (
                                <form onSubmit={handleLogin} className="space-y-4">
                                    {/* Username */}
                                    <FloatingInput
                                        id="username"
                                        label="Username"
                                        value={username}
                                        onChange={setUsername}
                                        icon={
                                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"/>
                                            </svg>
                                        }
                                    />

                                    {/* Password */}
                                    <FloatingInput
                                        id="password"
                                        label="Password or PIN"
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={setPassword}
                                        icon={
                                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/>
                                            </svg>
                                        }
                                        rightEl={
                                            <button type="button" onClick={() => setShowPassword(!showPassword)}
                                                className="text-slate-500 hover:text-teal-400 transition-colors">
                                                {showPassword ? (
                                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                                        <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd"/>
                                                        <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z"/>
                                                    </svg>
                                                ) : (
                                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                                        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
                                                        <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"/>
                                                    </svg>
                                                )}
                                            </button>
                                        }
                                    />

                                    {/* Error */}
                                    {error && (
                                        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm animate-shake">
                                            <svg className="w-5 h-5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                                            </svg>
                                            {error}
                                        </div>
                                    )}

                                    {/* Forgot password link */}
                                    <div className="flex justify-end">
                                        <button type="button" onClick={() => { setShowForgot(true); setError(''); }}
                                            className="text-[12px] text-slate-400 hover:text-teal-400 transition-colors font-medium">
                                            Forgot password?
                                        </button>
                                    </div>

                                    {/* Submit */}
                                    <button type="submit" disabled={isLoading}
                                        className="w-full py-4 rounded-xl text-white font-black text-sm shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:scale-100 flex items-center justify-center gap-3"
                                        style={{ background: 'linear-gradient(135deg, #14b8a6, #0d9488)', boxShadow: '0 8px 32px rgba(20,184,166,0.3)' }}>
                                        {isLoading ? (
                                            <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /><span>Signing in...</span></>
                                        ) : (
                                            <><svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M3 3a1 1 0 011 1v12a1 1 0 11-2 0V4a1 1 0 011-1zm7.707 3.293a1 1 0 010 1.414L9.414 9H17a1 1 0 110 2H9.414l1.293 1.293a1 1 0 01-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0z" clipRule="evenodd"/>
                                            </svg><span>Sign In to POS</span></>
                                        )}
                                    </button>

                                    {/* Security badge */}
                                    <div className="flex items-center justify-center gap-2 text-[11px] text-slate-600 pt-2">
                                        <svg className="w-3.5 h-3.5 text-teal-500/50" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                                        </svg>
                                        256-bit encrypted · PBKDF2-SHA512 authentication
                                    </div>
                                </form>
                            )}

                            {/* ── FORGOT PASSWORD FORM ── */}
                            {showForgot && (
                                <form onSubmit={handleForgotPassword} className="space-y-4 slide-up">
                                    <FloatingInput
                                        id="fp-username"
                                        label="Your Username"
                                        value={fpUsername}
                                        onChange={setFpUsername}
                                        icon={
                                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"/>
                                            </svg>
                                        }
                                    />

                                    {/* Result */}
                                    {fpResult && (
                                        <div className={`px-4 py-4 rounded-xl border text-sm slide-up ${
                                            fpResult.ok
                                                ? 'bg-teal-500/10 border-teal-500/30 text-teal-300'
                                                : 'bg-red-500/10 border-red-500/30 text-red-400'
                                        }`}>
                                            <p className="font-semibold">{fpResult.ok ? '✅' : '❌'} {fpResult.msg}</p>
                                            {fpResult.pin && (
                                                <div className="mt-3 p-3 bg-slate-800 rounded-lg border border-teal-500/30">
                                                    <p className="text-[11px] text-slate-400 uppercase tracking-wider mb-1">Your Temporary PIN</p>
                                                    <p className="text-3xl font-black text-teal-300 tracking-[0.3em]">{fpResult.pin}</p>
                                                    <p className="text-[10px] text-slate-500 mt-2">⚠️ Copy this PIN now. Use it to login, then change your password in Settings.</p>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {!fpResult?.ok && (
                                        <button type="submit" disabled={fpLoading}
                                            className="w-full py-4 rounded-xl text-white font-black text-sm transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2"
                                            style={{ background: 'linear-gradient(135deg, #14b8a6, #0d9488)', boxShadow: '0 8px 32px rgba(20,184,166,0.3)' }}>
                                            {fpLoading ? (
                                                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Generating...</>
                                            ) : '🔑 Generate Temp PIN'}
                                        </button>
                                    )}

                                    {fpResult?.ok && (
                                        <button type="button" onClick={() => { setShowForgot(false); setFpResult(null); setFpUsername(''); }}
                                            className="w-full py-4 rounded-xl text-white font-black text-sm transition-all hover:scale-[1.02]"
                                            style={{ background: 'linear-gradient(135deg, #14b8a6, #0d9488)', boxShadow: '0 8px 32px rgba(20,184,166,0.3)' }}>
                                            ← Back to Login
                                        </button>
                                    )}
                                </form>
                            )}
                        </div>

                        {/* Card footer */}
                        <div className="px-8 py-4 border-t border-white/5 flex items-center justify-between">
                            <p className="text-[10px] text-slate-700">© 2025 Alpha Retail POS · v2.0</p>
                            <p className="text-[10px] text-slate-700">By Alpha Solutions</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
