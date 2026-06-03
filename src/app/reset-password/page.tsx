'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function PasswordStrengthBar({ password }: { password: string }) {
    const checks = [
        { label: '8+ characters', ok: password.length >= 8 },
        { label: 'Uppercase', ok: /[A-Z]/.test(password) },
        { label: 'Lowercase', ok: /[a-z]/.test(password) },
        { label: 'Number', ok: /[0-9]/.test(password) },
        { label: 'Special char', ok: /[^A-Za-z0-9]/.test(password) },
    ];
    const score = checks.filter(c => c.ok).length;
    const colors = ['', '#ef4444', '#f97316', '#eab308', '#22c55e', '#10b981'];
    const labels = ['', 'Very Weak', 'Weak', 'Fair', 'Strong', 'Very Strong'];

    if (!password) return null;
    return (
        <div className="mt-2 space-y-2">
            <div className="flex gap-1">
                {[1,2,3,4,5].map(i => (
                    <div key={i} className="flex-1 h-1.5 rounded-full transition-all duration-300"
                        style={{ background: i <= score ? colors[score] : '#e2e8f0' }} />
                ))}
            </div>
            <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold" style={{ color: colors[score] }}>{labels[score]}</p>
                <div className="flex gap-2 flex-wrap justify-end">
                    {checks.map(c => (
                        <span key={c.label} className={`text-[10px] px-1.5 py-0.5 rounded font-medium transition-all ${c.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'}`}>
                            {c.ok ? '✓' : '○'} {c.label}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    );
}

function ResetPasswordForm() {
    const router       = useRouter();
    const params       = useSearchParams();
    const token        = params.get('token') || '';
    const uid          = params.get('uid')   || '';

    const [newPassword, setNewPassword]     = useState('');
    const [confirm, setConfirm]             = useState('');
    const [showNew, setShowNew]             = useState(false);
    const [showConf, setShowConf]           = useState(false);
    const [loading, setLoading]             = useState(false);
    const [result, setResult]               = useState<{ ok: boolean; msg: string } | null>(null);
    const [countdown, setCountdown]         = useState(5);

    // Invalid link
    if (!token || !uid) {
        return (
            <div className="text-center">
                <div className="text-6xl mb-4">❌</div>
                <h2 className="text-xl font-black text-gray-800 mb-2">Invalid Reset Link</h2>
                <p className="text-gray-500 text-sm mb-6">This link is missing required parameters. Please request a new password reset.</p>
                <button onClick={() => router.push('/')} className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all">
                    Back to Login
                </button>
            </div>
        );
    }

    // Countdown redirect after success
    useEffect(() => {
        if (result?.ok) {
            const iv = setInterval(() => {
                setCountdown(c => {
                    if (c <= 1) { clearInterval(iv); router.push('/'); }
                    return c - 1;
                });
            }, 1000);
            return () => clearInterval(iv);
        }
    }, [result, router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword !== confirm) {
            setResult({ ok: false, msg: 'Passwords do not match.' });
            return;
        }

        setLoading(true);
        setResult(null);

        try {
            const res = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, uid, newPassword }),
            });
            const data = await res.json();
            setResult({ ok: data.ok, msg: data.message || data.error });
        } catch {
            setResult({ ok: false, msg: 'Network error. Please try again.' });
        }
        setLoading(false);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-5">
            {/* New Password */}
            <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">New Password</label>
                <div className="relative">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/>
                        </svg>
                    </div>
                    <input type={showNew ? 'text' : 'password'} value={newPassword}
                        onChange={e => setNewPassword(e.target.value)} required
                        placeholder="Enter new password"
                        className="w-full pl-11 pr-11 py-3.5 rounded-xl border border-gray-200 bg-white text-gray-800 placeholder:text-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all text-sm" />
                    <button type="button" onClick={() => setShowNew(!showNew)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            {showNew
                                ? <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd"/>
                                : <><path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"/></>
                            }
                        </svg>
                    </button>
                </div>
                <PasswordStrengthBar password={newPassword} />
            </div>

            {/* Confirm Password */}
            <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Confirm Password</label>
                <div className="relative">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                        </svg>
                    </div>
                    <input type={showConf ? 'text' : 'password'} value={confirm}
                        onChange={e => setConfirm(e.target.value)} required
                        placeholder="Confirm new password"
                        className={`w-full pl-11 pr-11 py-3.5 rounded-xl border bg-white text-gray-800 placeholder:text-gray-400 focus:ring-2 outline-none transition-all text-sm
                            ${confirm && newPassword !== confirm ? 'border-red-400 focus:border-red-400 focus:ring-red-100' : 'border-gray-200 focus:border-indigo-500 focus:ring-indigo-100'}`} />
                    <button type="button" onClick={() => setShowConf(!showConf)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            {showConf
                                ? <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd"/>
                                : <><path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"/></>
                            }
                        </svg>
                    </button>
                </div>
                {confirm && newPassword !== confirm && (
                    <p className="text-red-500 text-xs mt-1 font-medium">Passwords do not match</p>
                )}
            </div>

            {/* Result */}
            {result && (
                <div className={`px-4 py-3.5 rounded-xl border text-sm font-medium ${result.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-700'}`}>
                    {result.ok ? '✅' : '❌'} {result.msg}
                    {result.ok && <span className="block text-xs mt-1 text-emerald-600">Redirecting to login in {countdown}s...</span>}
                </div>
            )}

            {!result?.ok && (
                <button type="submit" disabled={loading || newPassword !== confirm || newPassword.length < 8}
                    className="w-full py-4 rounded-xl text-white font-black text-sm transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2 shadow-lg"
                    style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', boxShadow: '0 8px 24px rgba(79,70,229,0.3)' }}>
                    {loading ? (
                        <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /><span>Resetting...</span></>
                    ) : '🔐 Set New Password'}
                </button>
            )}

            {result?.ok && (
                <button type="button" onClick={() => router.push('/')}
                    className="w-full py-3.5 rounded-xl text-white font-bold text-sm transition-all hover:scale-[1.02]"
                    style={{ background: 'linear-gradient(135deg, #059669, #0d9488)' }}>
                    ← Go to Login Now
                </button>
            )}
        </form>
    );
}

export default function ResetPasswordPage() {
    return (
        <div className="min-h-screen flex items-center justify-center p-4"
            style={{ background: 'linear-gradient(135deg, #f0f9ff 0%, #faf5ff 100%)' }}>
            <div className="w-full max-w-[440px]">
                {/* Logo */}
                <div className="text-center mb-6">
                    <div className="inline-flex items-center gap-2.5 mb-2">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg"
                            style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}>
                            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3z"/>
                            </svg>
                        </div>
                        <span className="text-xl font-black text-gray-800">Alpha<span className="text-indigo-600">Retail</span></span>
                    </div>
                </div>

                {/* Card */}
                <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                    <div className="px-8 pt-8 pb-3 border-b border-gray-100"
                        style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}>
                        <div className="flex items-center gap-2 mb-1">
                            <div className="w-2 h-2 rounded-full bg-white/60 animate-pulse" />
                            <span className="text-[11px] font-bold text-white/70 uppercase tracking-widest">Secure Reset</span>
                        </div>
                        <h1 className="text-xl font-black text-white mb-1">Set New Password</h1>
                        <p className="text-white/70 text-sm pb-5">Choose a strong password for your account.</p>
                    </div>
                    <div className="p-8">
                        <Suspense fallback={<div className="text-center text-gray-400 py-8">Loading...</div>}>
                            <ResetPasswordForm />
                        </Suspense>
                    </div>
                    <div className="px-8 py-4 bg-gray-50 border-t border-gray-100 flex items-center gap-2 text-xs text-gray-400">
                        <svg className="w-3.5 h-3.5 text-indigo-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                        </svg>
                        PBKDF2-SHA512 encrypted · One-time link · Expires in 1 hour
                    </div>
                </div>
                <p className="text-center text-xs text-gray-400 mt-4">© 2025 Alpha Retail POS · Alpha Solutions</p>
            </div>
        </div>
    );
}
