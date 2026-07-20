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

// ── Feature cards ─────────────────────────────────────────────────────
const features = [
    { icon: '📱', label: 'M-Pesa STK Push',      desc: 'Instant mobile payments',        color: '#10b981' },
    { icon: '💳', label: 'Card Payments',          desc: 'Visa, Mastercard & more',        color: '#6366f1' },
    { icon: '🏪', label: 'Multi-Outlet',           desc: 'Manage all branches centrally',  color: '#f59e0b' },
    { icon: '📦', label: 'Smart Inventory',        desc: 'Real-time stock & expiry alerts', color: '#3b82f6' },
    { icon: '📊', label: 'Live Analytics',         desc: 'P&L, sales & profit reports',    color: '#8b5cf6' },
    { icon: '🔐', label: 'Bank-Grade Security',    desc: 'PBKDF2-SHA512 + audit logs',     color: '#ec4899' },
    { icon: '☁️', label: 'Cloud Backup',           desc: 'Supabase PostgreSQL powered',    color: '#14b8a6' },
    { icon: '👥', label: 'HR & Payroll',           desc: 'Staff, shifts & advances',       color: '#f97316' },
];

export default function LoginPage() {
    const router = useRouter();

    // ── Login state
    const [username, setUsername]         = useState('');
    const [password, setPassword]         = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading]       = useState(false);
    const [error, setError]               = useState('');
    const [storeName, setStoreName]       = useState('Alpha Retail');
    const [currentTime, setCurrentTime]   = useState('');
    const [currentDate, setCurrentDate]   = useState('');

    // ── Outlet picker
    const [showOutletPicker, setShowOutletPicker] = useState(false);
    const [userOutlets, setUserOutlets]   = useState<any[]>([]);
    const [pendingUser, setPendingUser]   = useState<any>(null);

    // ── Forgot password
    const [view, setView]           = useState<'login' | 'forgot' | 'sent'>('login');
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
                .maybeSingle();  // maybeSingle — no error if 0 rows

            if (dbError) throw dbError;
            if (!data) {
                setError('Invalid username or password.');
                logActivity('Login Failed', `User not found: ${username}`);
                return;
            }

            // 2. Verify password — PBKDF2 hash OR plain text OR PIN (String comparison to avoid type mismatch)
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

            let available: any[] = [];
            if (links && links.length > 0) {
                // User has specific outlet assignments — load only those
                const ids = links.map((l: any) => l.outlet_id);
                const { data: od } = await supabase
                    .from('retail_outlets')
                    .select('outlet_id,outlet_name,outlet_code,is_main')
                    .in('outlet_id', ids)
                    .eq('active', true)
                    .order('is_main', { ascending: false })  // main outlet first
                    .order('outlet_name');
                available = od || [];
            } else {
                // No specific assignments — user sees ALL active outlets (super admin / unrestricted)
                const { data: od } = await supabase
                    .from('retail_outlets')
                    .select('outlet_id,outlet_name,outlet_code,is_main')
                    .eq('active', true)
                    .order('is_main', { ascending: false })
                    .order('outlet_name');
                available = od || [];
            }

            // 4. Single outlet → auto-login; Multiple → show picker
            if (available.length > 1) {
                setPendingUser(data);
                setUserOutlets(available);
                setShowOutletPicker(true);
            } else {
                const o = available[0] || { outlet_id: 1, outlet_name: 'Main Outlet', outlet_code: 'MAIN' };
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

    // ── Outlet picker screen
    if (showOutletPicker) return (
        <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg,#f0f9ff,#faf5ff)' }}>
            <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
                <div className="p-8 text-center" style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
                    <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-3 text-3xl">🏪</div>
                    <h1 className="text-xl font-black text-white">Select Your Outlet</h1>
                    <p className="text-white/70 text-sm mt-1">Welcome {pendingUser?.name}! Choose your work location</p>
                </div>
                <div className="p-6 space-y-3">
                    {userOutlets.map(outlet => (
                        <button key={outlet.outlet_id} onClick={() => completeLogin(pendingUser, outlet.outlet_id, outlet.outlet_name)}
                            className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-gray-100 hover:border-indigo-300 hover:bg-indigo-50 transition-all group text-left">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white text-xl shadow ${outlet.is_main ? 'bg-gradient-to-br from-amber-500 to-orange-500' : 'bg-gradient-to-br from-indigo-500 to-violet-600'}`}>
                                {outlet.is_main ? '⭐' : '📍'}
                            </div>
                            <div className="flex-1">
                                <p className="font-black text-gray-800 text-sm group-hover:text-indigo-700 transition-colors">{outlet.outlet_name}</p>
                                <p className="text-xs text-gray-400 font-mono">{outlet.outlet_code}{outlet.is_main ? ' · Head Office' : ''}</p>
                            </div>
                            <svg className="w-5 h-5 text-gray-300 group-hover:text-indigo-500 transition-colors" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd"/>
                            </svg>
                        </button>
                    ))}
                    <button onClick={() => { setShowOutletPicker(false); setPendingUser(null); }}
                        className="w-full py-3 text-sm text-gray-400 hover:text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-all mt-2">
                        ← Back to Login
                    </button>
                </div>
            </div>
        </div>
    );

    // ── Main layout
    return (
        <div className="min-h-screen flex" style={{ background: 'linear-gradient(135deg,#f0f9ff 0%,#faf5ff 100%)' }}>
            <style>{`
                @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
                @keyframes shake { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-4px)} 40%,80%{transform:translateX(4px)} }
                .fade-up{animation:fadeUp .4s ease-out}
                .shake{animation:shake .4s ease-in-out}
                .inp{width:100%;padding:14px 14px 14px 44px;border-radius:12px;border:1.5px solid #e2e8f0;background:#fff;color:#1e293b;font-size:14px;outline:none;transition:all .2s}
                .inp:focus{border-color:#4f46e5;box-shadow:0 0 0 3px rgba(79,70,229,.1)}
                .inp::placeholder{color:#94a3b8}
            `}</style>

            {/* ── LEFT PANEL (vibrant gradient + feature cards) ── */}
            <div className="hidden lg:flex lg:w-[52%] flex-col justify-between p-10 relative overflow-hidden"
                style={{ background: 'linear-gradient(145deg, #3730a3 0%, #4f46e5 25%, #7c3aed 55%, #059669 100%)' }}>

                {/* Decorative circles */}
                <div className="absolute top-[-80px] right-[-80px] w-64 h-64 rounded-full opacity-10" style={{ background: 'white' }} />
                <div className="absolute bottom-[-60px] left-[-60px] w-80 h-80 rounded-full opacity-10" style={{ background: 'white' }} />
                <div className="absolute top-[35%] left-[60%] w-32 h-32 rounded-full opacity-10" style={{ background: 'white' }} />

                <div className="relative z-10">
                    {/* Logo */}
                    <div className="flex items-center gap-3 mb-10">
                        <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center text-2xl">🛒</div>
                        <div>
                            <h1 className="text-xl font-black text-white">Alpha<span className="text-emerald-300">Retail</span></h1>
                            <p className="text-white/50 text-[10px] font-bold tracking-[.2em] uppercase">Enterprise POS System</p>
                        </div>
                    </div>

                    {/* Heading */}
                    <div className="mb-8">
                        <h2 className="text-4xl font-black text-white leading-tight mb-3">
                            Everything You Need<br/>
                            <span className="text-emerald-300">to Run Retail.</span>
                        </h2>
                        <p className="text-white/70 text-sm leading-relaxed max-w-sm">
                            Kenya's most complete point-of-sale system — M-Pesa, inventory, payroll, and analytics in one powerful platform.
                        </p>
                    </div>

                    {/* Feature grid */}
                    <div className="grid grid-cols-2 gap-3">
                        {features.map(f => (
                            <div key={f.label} className="rounded-xl p-3.5 flex items-center gap-3 transition-all hover:scale-[1.02]"
                                style={{ background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.15)' }}>
                                <span className="text-2xl shrink-0">{f.icon}</span>
                                <div>
                                    <p className="text-white font-bold text-[12.5px] leading-tight">{f.label}</p>
                                    <p className="text-white/55 text-[10.5px] leading-tight mt-0.5">{f.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Bottom */}
                <div className="relative z-10 border-t border-white/20 pt-5">
                    <div className="flex items-center gap-2 text-white/70 text-sm mb-1">
                        <span className="text-emerald-300 font-bold text-base">{currentTime}</span>
                        <span>·</span>
                        <span>{currentDate}</span>
                    </div>
                    <p className="text-white/40 text-xs">Powered by Alpha Solutions · Dev: Jimhawkins Korir</p>
                </div>
            </div>

            {/* ── RIGHT PANEL (login form) ── */}
            <div className="flex-1 flex items-center justify-center p-6">
                <div className="w-full max-w-[420px]">

                    {/* Mobile logo */}
                    <div className="lg:hidden text-center mb-6">
                        <div className="inline-flex items-center gap-2.5 mb-1">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xl" style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>🛒</div>
                            <span className="text-xl font-black text-gray-800">Alpha<span className="text-indigo-600">Retail</span></span>
                        </div>
                        <p className="text-gray-400 text-sm">{storeName}</p>
                    </div>

                    {/* Card */}
                    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden fade-up">

                        {/* Card header bar */}
                        <div className="h-1.5 w-full" style={{ background: 'linear-gradient(90deg,#4f46e5,#7c3aed,#059669)' }} />

                        <div className="px-8 pt-7 pb-3">
                            {view === 'login' && (
                                <>
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                        <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Secure Access</span>
                                    </div>
                                    <h2 className="text-2xl font-black text-gray-800">Welcome back 👋</h2>
                                    <p className="text-gray-400 text-sm mt-0.5">Sign in to <span className="text-indigo-600 font-semibold">{storeName}</span></p>
                                </>
                            )}
                            {view === 'forgot' && (
                                <>
                                    <button onClick={() => { setView('login'); setFpError(''); setFpUsername(''); }}
                                        className="flex items-center gap-1.5 text-gray-400 hover:text-indigo-600 text-sm mb-3 transition-colors">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                        </svg>
                                        Back to login
                                    </button>
                                    <h2 className="text-2xl font-black text-gray-800">Forgot Password?</h2>
                                    <p className="text-gray-400 text-sm mt-0.5">Enter your username — we'll email you a reset link.</p>
                                </>
                            )}
                            {view === 'sent' && (
                                <div className="text-center py-2">
                                    <div className="text-5xl mb-3">📨</div>
                                    <h2 className="text-xl font-black text-gray-800 mb-2">Check Your Email</h2>
                                    <p className="text-gray-500 text-sm leading-relaxed">
                                        If <span className="font-bold text-indigo-600">{fpUsername}</span> is registered with an email address, a secure reset link has been sent. The link expires in <span className="font-bold">1 hour</span>.
                                    </p>
                                    <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700 text-left">
                                        📌 <strong>Didn't receive it?</strong> Check your spam/junk folder. Make sure your account has a registered email — contact your administrator if you need help.
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="px-8 pb-8">
                            {/* ── LOGIN FORM ── */}
                            {view === 'login' && (
                                <form onSubmit={handleLogin} className="space-y-4 mt-5">
                                    {/* Username */}
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-600 mb-1.5">Username</label>
                                        <div className="relative">
                                            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"/></svg>
                                            </div>
                                            <input id="username" type="text" value={username} onChange={e => setUsername(e.target.value)}
                                                placeholder="Enter your username" autoComplete="username"
                                                className="inp" style={{ paddingRight: '14px' }} />
                                        </div>
                                    </div>

                                    {/* Password */}
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-600 mb-1.5">Password or PIN</label>
                                        <div className="relative">
                                            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/></svg>
                                            </div>
                                            <input id="password" type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                                                placeholder="Enter your password or PIN" autoComplete="current-password"
                                                style={{ paddingRight: '44px' }} className="inp" />
                                            <button type="button" onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-indigo-500 transition-colors">
                                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                                    {showPassword
                                                        ? <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd"/>
                                                        : <><path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"/></>}
                                                </svg>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Error */}
                                    {error && (
                                        <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm shake`}>
                                            <svg className="w-5 h-5 shrink-0 text-red-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
                                            {error}
                                        </div>
                                    )}

                                    <div className="flex justify-end">
                                        <button type="button" onClick={() => { setView('forgot'); setError(''); }}
                                            className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold transition-colors">
                                            Forgot password?
                                        </button>
                                    </div>

                                    <button type="submit" disabled={isLoading}
                                        className="w-full py-4 rounded-xl text-white font-black text-sm transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:scale-100 flex items-center justify-center gap-2 shadow-lg"
                                        style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', boxShadow: '0 6px 24px rgba(79,70,229,.35)' }}>
                                        {isLoading
                                            ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /><span>Signing in...</span></>
                                            : <><svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3 3a1 1 0 011 1v12a1 1 0 11-2 0V4a1 1 0 011-1zm7.707 3.293a1 1 0 010 1.414L9.414 9H17a1 1 0 110 2H9.414l1.293 1.293a1 1 0 01-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0z" clipRule="evenodd"/></svg><span>Sign In</span></>}
                                    </button>

                                    <div className="flex items-center justify-center gap-2 text-[10.5px] text-gray-400 pt-1">
                                        <svg className="w-3.5 h-3.5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
                                        256-bit encrypted · PBKDF2-SHA512 authentication
                                    </div>
                                </form>
                            )}

                            {/* ── FORGOT PASSWORD FORM ── */}
                            {view === 'forgot' && (
                                <form onSubmit={handleForgotPassword} className="space-y-4 mt-5 fade-up">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-600 mb-1.5">Your Username</label>
                                        <div className="relative">
                                            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"/></svg>
                                            </div>
                                            <input type="text" value={fpUsername} onChange={e => setFpUsername(e.target.value)}
                                                placeholder="Enter your username" autoFocus className="inp" style={{ paddingRight: '14px' }} />
                                        </div>
                                    </div>

                                    {fpError && (
                                        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                                            <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
                                            {fpError}
                                        </div>
                                    )}

                                    <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700">
                                        🔒 A secure reset link will be sent to your <strong>registered email address</strong>. The link expires in <strong>1 hour</strong> and can only be used once.
                                    </div>

                                    <button type="submit" disabled={fpLoading}
                                        className="w-full py-4 rounded-xl text-white font-black text-sm transition-all hover:scale-[1.02] disabled:opacity-60 disabled:scale-100 flex items-center justify-center gap-2 shadow-lg"
                                        style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', boxShadow: '0 6px 24px rgba(79,70,229,.3)' }}>
                                        {fpLoading
                                            ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Sending...</>
                                            : '📧 Send Reset Link'}
                                    </button>
                                </form>
                            )}

                            {/* ── EMAIL SENT ── */}
                            {view === 'sent' && (
                                <div className="mt-5 space-y-3 fade-up">
                                    <button onClick={() => { setView('login'); setFpUsername(''); setFpError(''); }}
                                        className="w-full py-4 rounded-xl text-white font-black text-sm transition-all hover:scale-[1.02]"
                                        style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', boxShadow: '0 6px 24px rgba(79,70,229,.3)' }}>
                                        ← Back to Login
                                    </button>
                                    <button onClick={() => { setView('forgot'); setFpError(''); }}
                                        className="w-full py-3 text-sm text-indigo-600 font-semibold border border-indigo-200 rounded-xl hover:bg-indigo-50 transition-all">
                                        Resend Reset Email
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Card footer */}
                        <div className="px-8 py-3.5 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                            <p className="text-[10px] text-gray-400">© {new Date().getFullYear()} Alpha Retail POS v2.0</p>
                            <div className="flex items-center gap-3 text-[10px] text-gray-300">
                                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />M-Pesa</span>
                                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-indigo-400 inline-block" />Cloud</span>
                                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-violet-400 inline-block" />Encrypted</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
