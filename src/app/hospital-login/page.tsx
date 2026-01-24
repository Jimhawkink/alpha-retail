'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';

export default function HospitalLoginPage() {
    const router = useRouter();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);

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
                toast.error('Invalid hospital credentials');
                setIsLoading(false);
                return;
            }

            if (data.password_hash === password) {
                localStorage.setItem('user', JSON.stringify({
                    userId: data.user_id,
                    userName: data.user_name,
                    name: data.full_name,
                    userType: data.user_type,
                    isHospital: true
                }));
                toast.success(`Welcome Dr/Mr/Ms ${data.full_name}`);
                router.push('/dashboard/hospital-pos');
            } else {
                toast.error('Invalid password');
            }
        } catch (err) {
            toast.error('Connection error');
        }
        setIsLoading(false);
    };

    return (
        <div className="min-h-screen bg-blue-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-blue-100">
                    <div className="bg-gradient-to-br from-blue-600 to-indigo-700 px-8 py-10 text-center text-white relative">
                        <div className="text-6xl mb-4">🏥</div>
                        <h1 className="text-3xl font-black tracking-tight">HOSPITAL LOGIN</h1>
                        <p className="opacity-80 mt-2 font-medium">Medical Billing Management</p>
                    </div>

                    <form onSubmit={handleLogin} className="p-8 space-y-6">
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-gray-600 block">Username</label>
                            <input
                                required
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full p-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-blue-500 focus:outline-none text-lg"
                                placeholder="Enter username"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-gray-600 block">Password</label>
                            <input
                                required
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full p-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-blue-500 focus:outline-none text-lg"
                                placeholder="••••••••"
                            />
                        </div>

                        <button
                            disabled={isLoading}
                            className="w-full py-5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-xl shadow-xl shadow-blue-500/20 transition-all active:scale-95 flex items-center justify-center gap-3"
                        >
                            {isLoading ? 'VERIFYING...' : 'SIGN IN →'}
                        </button>

                        <div className="text-center pt-4">
                            <button
                                type="button"
                                onClick={() => router.push('/')}
                                className="text-sm font-bold text-gray-400 hover:text-blue-600 transition-colors"
                            >
                                ← Switch to Retail POS Login
                            </button>
                        </div>
                    </form>
                </div>
                <p className="text-center mt-8 text-gray-400 text-xs font-bold uppercase tracking-widest">
                    Alpha Solutions • Hospital Billing v1.0
                </p>
            </div>
        </div>
    );
}
