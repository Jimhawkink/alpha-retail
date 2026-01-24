'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function HospitalDashboardPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const [user, setUser] = useState<any>(null);
    const [stats, setStats] = useState({
        patientsToday: 0,
        revenueToday: 0,
        registrationsToday: 0,
        mpesaTotal: 0,
    });
    const [recentBills, setRecentBills] = useState<any[]>([]);

    const loadData = useCallback(async () => {
        setIsLoading(true);
        const today = new Date().toISOString().split('T')[0];

        try {
            // Check auth
            const storedUser = localStorage.getItem('user');
            if (!storedUser) {
                router.push('/hospital-login');
                return;
            }
            const parsedUser = JSON.parse(storedUser);
            if (!parsedUser.isHospital) {
                router.push('/');
                return;
            }
            setUser(parsedUser);

            // Fetch Today's Hospital Sales
            const { data: sales } = await supabase
                .from('hospital_sales')
                .select('total_amount, payment_method, created_at')
                .gte('created_at', `${today}T00:00:00`);

            const revenueToday = (sales || []).reduce((sum, s) => sum + (s.total_amount || 0), 0);
            const mpesa = (sales || []).filter(s => s.payment_method === 'MPESA').reduce((sum, s) => sum + (s.total_amount || 0), 0);

            // Today's Patients
            const { count: patientsCount } = await supabase
                .from('hospital_patients')
                .select('*', { count: 'exact', head: true })
                .gte('created_at', `${today}T00:00:00`);

            // Recent bills
            const { data: recent } = await supabase
                .from('hospital_sales')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(8);

            setStats({
                patientsToday: patientsCount || 0,
                revenueToday: revenueToday,
                registrationsToday: (sales || []).length,
                mpesaTotal: mpesa,
            });
            setRecentBills(recent || []);

        } catch (err) {
            console.error('Hospital Dashboard Error:', err);
        }
        setIsLoading(false);
    }, [router]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    if (!user && !isLoading) return null;

    return (
        <div className="p-6 space-y-8 bg-[#fbfcfd] min-h-screen">
            {/* Elegant Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight">Hospital Console</h1>
                    <p className="text-slate-500 font-medium">Welcome back, <span className="text-blue-600 font-bold">{user?.name}</span> • Medical Center Overview</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={loadData}
                        className="px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-2xl font-bold hover:bg-slate-50 transition-all flex items-center gap-2"
                    >
                        <span>🔄</span> Sync Data
                    </button>
                    <button
                        onClick={() => router.push('/dashboard/hospital-pos')}
                        className="px-8 py-3 bg-blue-600 text-white rounded-2xl font-black hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 active:scale-95"
                    >
                        + New Billing
                    </button>
                </div>
            </div>

            {/* Premium Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-bl-full -translate-y-8 translate-x-8 transition-transform group-hover:scale-110"></div>
                    <span className="text-4xl relative z-10">👥</span>
                    <p className="text-slate-400 text-xs font-black uppercase tracking-widest mt-6 mb-1">New Patients</p>
                    <p className="text-4xl font-black text-slate-900">{stats.patientsToday}</p>
                </div>

                <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-bl-full -translate-y-8 translate-x-8 transition-transform group-hover:scale-110"></div>
                    <span className="text-4xl relative z-10">💰</span>
                    <p className="text-slate-400 text-xs font-black uppercase tracking-widest mt-6 mb-1">Total Revenue</p>
                    <p className="text-4xl font-black text-slate-900">Ksh {stats.revenueToday.toLocaleString()}</p>
                </div>

                <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50 rounded-bl-full -translate-y-8 translate-x-8 transition-transform group-hover:scale-110"></div>
                    <span className="text-4xl relative z-10">📱</span>
                    <p className="text-slate-400 text-xs font-black uppercase tracking-widest mt-6 mb-1">M-Pesa Intake</p>
                    <p className="text-4xl font-black text-slate-900">Ksh {stats.mpesaTotal.toLocaleString()}</p>
                </div>

                <div className="bg-white p-8 rounded-[32px] border border-teal-500 bg-teal-500 shadow-lg shadow-teal-500/20 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-bl-full -translate-y-8 translate-x-8 transition-transform group-hover:scale-110"></div>
                    <span className="text-4xl relative z-10">📜</span>
                    <p className="text-white/70 text-xs font-black uppercase tracking-widest mt-6 mb-1">Total Bills</p>
                    <p className="text-4xl font-black text-white">{stats.registrationsToday}</p>
                </div>
            </div>

            {/* Activity and Management Section */}
            <div className="grid lg:grid-cols-3 gap-8 text-black">
                {/* Recent Billing Table */}
                <div className="lg:col-span-2 bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden">
                    <div className="p-8 border-b border-slate-50 flex items-center justify-between">
                        <h3 className="font-black text-xl text-slate-900">Recent Transactions</h3>
                        <button onClick={() => router.push('/dashboard/hospital-reports')} className="text-blue-600 font-bold text-sm hover:underline">Full Analytics →</button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-slate-50/50 text-slate-400 text-[10px] font-black uppercase tracking-[2px]">
                                    <th className="px-8 py-5">Receipt No</th>
                                    <th className="px-8 py-5">Patient Name</th>
                                    <th className="px-8 py-5">Amount</th>
                                    <th className="px-8 py-5">Method</th>
                                    <th className="px-8 py-5 text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {recentBills.map((bill, i) => (
                                    <tr key={i} className="hover:bg-blue-50/20 transition-colors group">
                                        <td className="px-8 py-5 font-black text-slate-900 text-sm">{bill.receipt_no}</td>
                                        <td className="px-8 py-5 font-bold text-slate-600 group-hover:text-blue-600 transition-colors">{bill.patient_name}</td>
                                        <td className="px-8 py-5 font-black text-slate-900 text-sm">Ksh {bill.total_amount.toLocaleString()}</td>
                                        <td className="px-8 py-5">
                                            <span className="px-3 py-1 bg-slate-100 rounded-lg text-[10px] font-black uppercase tracking-wider">{bill.payment_method}</span>
                                        </td>
                                        <td className="px-8 py-5 text-center">
                                            <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-[10px] font-black uppercase tracking-wider">Confirmed</span>
                                        </td>
                                    </tr>
                                ))}
                                {recentBills.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-8 py-20 text-center">
                                            <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">No transaction data available for today</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Quick Shortcuts */}
                <div className="space-y-6">
                    <div className="bg-blue-600 rounded-[40px] p-8 text-white shadow-xl shadow-blue-600/20">
                        <h3 className="text-2xl font-black mb-2">Hospital Quick Links</h3>
                        <p className="text-blue-100 font-medium mb-8 text-sm opacity-80">Shortcut to hospital management modules.</p>
                        <div className="grid gap-3">
                            <button onClick={() => router.push('/dashboard/hospital-users')} className="w-full p-4 bg-white/10 hover:bg-white/20 rounded-2xl flex items-center justify-between transition-all group border border-white/10">
                                <span className="font-bold">Staff Management</span>
                                <span className="group-hover:translate-x-1 transition-transform">→</span>
                            </button>
                            <button onClick={() => router.push('/dashboard/hospital-companies')} className="w-full p-4 bg-white/10 hover:bg-white/20 rounded-2xl flex items-center justify-between transition-all group border border-white/10">
                                <span className="font-bold">Companies & Insurers</span>
                                <span className="group-hover:translate-x-1 transition-transform">→</span>
                            </button>
                            <button onClick={() => router.push('/dashboard/hospital-reports')} className="w-full p-4 bg-white/10 hover:bg-white/20 rounded-2xl flex items-center justify-between transition-all group border border-white/10">
                                <span className="font-bold">Usage Analytics</span>
                                <span className="group-hover:translate-x-1 transition-transform">→</span>
                            </button>
                        </div>
                    </div>

                    <div className="bg-white rounded-[40px] border border-slate-100 p-8 shadow-sm">
                        <h4 className="font-black text-slate-400 text-[10px] uppercase tracking-widest mb-4">Support & System</h4>
                        <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <div className="w-10 h-10 bg-slate-200 rounded-xl flex items-center justify-center text-xl">💎</div>
                            <div>
                                <p className="font-black text-slate-800 text-sm">Alpha Solutions</p>
                                <p className="text-slate-400 text-[10px] font-bold">Standard Support Active</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
