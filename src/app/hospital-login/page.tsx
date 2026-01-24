'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import bcryptjs from 'bcryptjs';

export default function HospitalLoginPage() {
    const router = useRouter();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const { data, error: dbError } = await supabase
                .from('hospital_users')
                .select('*')
                .eq('user_name', username)
                .eq('active', true)
                .single();

            if (dbError || !data) {
                toast.error('Invalid credentials or account inactive');
                setIsLoading(false);
                return;
            }

            // Check password with bcrypt fallback
            let isMatch = false;
            try {
                if (data.password_hash && (data.password_hash.startsWith('$2a$') || data.password_hash.startsWith('$2b$'))) {
                    isMatch = await bcryptjs.compare(password, data.password_hash);
                }
            } catch (err) {
                console.error('Bcrypt error:', err);
            }

            if (!isMatch && data.password_hash === password) {
                isMatch = true;
            }

            if (isMatch) {
                localStorage.setItem('user', JSON.stringify({
                    userId: data.user_id,
                    userName: data.user_name,
                    name: data.full_name,
                    userType: data.user_type,
                    isHospital: true
                }));
                toast.success(`Welcome back, ${data.full_name}`);
                router.push('/dashboard/hospital-dashboard');
            } else {
                toast.error('Incorrect password');
            }
        } catch (err) {
            toast.error('Authentication service unavailable');
        }
        setIsLoading(false);
    };

    if (!mounted) return null;

    return (
        <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-6 relative overflow-hidden font-sans">
            {/* Professional Background Elements */}
            <div className="absolute inset-0 z-0">
                <div className="absolute top-0 right-0 w-[50%] h-[100%] bg-blue-600/5 -skew-x-12 transform translate-x-20"></div>
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/10 rounded-full blur-[100px]"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-blue-400/10 rounded-full blur-[80px]"></div>

                {/* Decorative Grid */}
                <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#1e40af 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
            </div>

            <main className="relative z-10 w-full max-w-[1000px] flex bg-white rounded-[40px] shadow-2xl shadow-blue-900/10 border border-white overflow-hidden min-h-[600px]">
                {/* Sidebar / Aesthetic Illustration Area */}
                <div className="hidden lg:flex w-[45%] bg-gradient-to-br from-blue-700 via-blue-800 to-indigo-900 p-12 flex-col justify-between text-white relative overflow-hidden">
                    <div className="absolute inset-0 opacity-10">
                        <svg className="w-full h-full" viewBox="0 0 100 100" fill="none">
                            <path d="M0 20 L100 80 M0 50 L100 50 M0 80 L100 20" stroke="currentColor" strokeWidth="0.5" />
                        </svg>
                    </div>

                    <div className="relative">
                        <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/20 mb-8">
                            <span className="text-3xl text-white">🏥</span>
                        </div>
                        <h2 className="text-4xl font-black leading-tight mb-4">
                            Alpha <br />
                            Medical <br />
                            Portal.
                        </h2>
                        <div className="h-1.5 w-12 bg-blue-400 rounded-full"></div>
                    </div>

                    <div className="relative">
                        <p className="text-blue-100/70 text-sm font-medium mb-6">
                            Secure access for authorized medical staff. Manage patient billing, insurance claims, and hospital services with ease.
                        </p>
                        <div className="flex items-center gap-3 text-xs font-bold tracking-widest uppercase opacity-50">
                            <span>Clinical Excellence</span>
                            <span className="w-1 h-1 bg-white rounded-full"></span>
                            <span>Secure Data</span>
                        </div>
                    </div>
                </div>

                {/* Login Form Area */}
                <div className="flex-1 p-8 md:p-16 flex flex-col justify-center bg-white">
                    <div className="max-w-md mx-auto w-full">
                        <div className="mb-12">
                            <h3 className="text-3xl font-black text-slate-900 mb-2 whitespace-nowrap">Authorized Sign In</h3>
                            <p className="text-slate-500 font-medium">Please enter your hospital credentials to proceed.</p>
                        </div>

                        <form onSubmit={handleLogin} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Professional Identifier</label>
                                <div className="relative group">
                                    <input
                                        required
                                        type="text"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        className="w-full h-14 pl-12 pr-4 bg-slate-50 border border-slate-200 rounded-2xl focus:border-blue-600 focus:bg-white focus:outline-none transition-all font-semibold text-slate-800"
                                        placeholder="Username"
                                    />
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30 group-focus-within:opacity-100 transition-opacity">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                                    </span>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between items-center px-1">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Security Pin / Pass</label>
                                    <button type="button" className="text-xs font-bold text-blue-600 hover:text-blue-700">Request Reset?</button>
                                </div>
                                <div className="relative group">
                                    <input
                                        required
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full h-14 pl-12 pr-12 bg-slate-50 border border-slate-200 rounded-2xl focus:border-blue-600 focus:bg-white focus:outline-none transition-all font-semibold text-slate-800"
                                        placeholder="••••••••"
                                    />
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30 group-focus-within:opacity-100 transition-opacity">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 opacity-40 hover:opacity-100 transition-opacity"
                                    >
                                        {showPassword ? 'Hide' : 'Show'}
                                    </button>
                                </div>
                            </div>

                            <div className="pt-2">
                                <button
                                    disabled={isLoading}
                                    className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-lg shadow-xl shadow-blue-500/30 transition-all hover:-translate-y-1 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3"
                                >
                                    {isLoading ? (
                                        <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    ) : (
                                        <>
                                            Authorize Access
                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>

                        <div className="mt-12 text-center">
                            <button
                                type="button"
                                onClick={() => router.push('/')}
                                className="group inline-flex items-center gap-2 text-slate-400 font-bold hover:text-slate-600 transition-colors"
                            >
                                <span className="text-sm">← Exit to Retail POS Portal</span>
                                <div className="w-1 h-1 bg-slate-300 rounded-full group-hover:bg-blue-600 transition-colors"></div>
                                <span className="text-[10px] uppercase tracking-tighter opacity-50">Authorized Personnel Only</span>
                            </button>
                        </div>
                    </div>
                </div>
            </main>

            {/* Footer Copyright */}
            <div className="absolute bottom-8 left-0 w-full text-center z-10 pointer-events-none">
                <p className="text-slate-400 text-xs font-bold tracking-[4px] uppercase opacity-50">
                    Alpha Solution • Security Compliance Standard v2.1
                </p>
            </div>
        </div>
    );
}
