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

    if (isLoading) return <div className="p-8 text-slate-400 font-bold uppercase tracking-widest text-xs animate-pulse">Syncing Medical Console Data...</div>;
    if (!user) return null;

    return (
        <div className="space-y-10 max-w-[1400px] mx-auto pb-20">
            {/* Elegant Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm">
                <div className="flex items-center gap-5">
                    <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-3xl shadow-inner">
                        🏥
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Hospital Console</h1>
                        <p className="text-slate-500 font-medium text-sm mt-1 uppercase tracking-wider">Welcome back, <span className="text-blue-600 font-bold">{user?.name}</span> • Medical Center Overview</p>
                    </div>
                </div>
                <div className="flex gap-4">
                    <button
                        onClick={loadData}
                        className="px-6 py-4 bg-white border border-slate-200 text-slate-700 rounded-2xl font-bold hover:bg-slate-50 transition-all flex items-center gap-3 uppercase text-[11px] tracking-widest shadow-sm active:scale-95"
                    >
                        <span>🔄</span> Sync Records
                    </button>
                    <button
                        onClick={() => router.push('/dashboard/hospital-pos')}
                        className="px-8 py-4 bg-slate-900 text-white rounded-[24px] font-bold hover:bg-black transition-all shadow-xl shadow-slate-900/20 active:scale-95 flex items-center gap-3 uppercase text-[11px] tracking-widest border-b-4 border-slate-700"
                    >
                        <span>➕</span> New Patient Billing
                    </button>
                </div>
            </div>

            {/* Premium Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                <div className="bg-white p-10 rounded-[40px] border border-slate-100 shadow-xl shadow-slate-200/40 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full translate-x-10 -translate-y-10 opacity-50"></div>
                    <span className="text-4xl relative z-10">👥</span>
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-8 mb-2">New Patients Today</p>
                    <p className="text-4xl font-bold text-slate-900 tracking-tighter">{stats.patientsToday}</p>
                </div>

                <div className="bg-white p-10 rounded-[40px] border border-slate-100 shadow-xl shadow-slate-200/40 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full translate-x-10 -translate-y-10 opacity-50"></div>
                    <span className="text-4xl relative z-10">💰</span>
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-8 mb-2">Revenue Generated</p>
                    <p className="text-4xl font-bold text-slate-900 tracking-tighter">Ksh {stats.revenueToday.toLocaleString()}</p>
                </div>

                <div className="bg-white p-10 rounded-[40px] border border-slate-100 shadow-xl shadow-slate-200/40 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full translate-x-10 -translate-y-10 opacity-50"></div>
                    <span className="text-4xl relative z-10">📱</span>
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-8 mb-2">Mobile Intake</p>
                    <p className="text-4xl font-bold text-slate-900 tracking-tighter">Ksh {stats.mpesaTotal.toLocaleString()}</p>
                </div>

                <div className="bg-slate-900 p-10 rounded-[40px] text-white shadow-2xl shadow-slate-900/10 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/10 rounded-full translate-x-10 -translate-y-10"></div>
                    <span className="text-4xl relative z-10 text-blue-400">📜</span>
                    <p className="text-blue-400/80 text-[10px] font-bold uppercase tracking-widest mt-8 mb-2">Journal Entries</p>
                    <p className="text-4xl font-bold text-white tracking-tighter">{stats.registrationsToday}</p>
                </div>
            </div>

            {/* Activity and Management Section */}
            <div className="grid lg:grid-cols-3 gap-10">
                {/* Recent Billing Table */}
                <div className="lg:col-span-2 bg-white rounded-[44px] shadow-xl shadow-slate-200/40 border border-slate-100 overflow-hidden">
                    <div className="px-10 py-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/20">
                        <h3 className="font-bold text-xl text-slate-900 tracking-tight">Recent Patient Journal</h3>
                        <button onClick={() => router.push('/dashboard/hospital-reports')} className="text-blue-600 font-bold text-[11px] uppercase tracking-widest hover:text-blue-700 transition-colors bg-white px-5 py-2 rounded-xl border border-blue-50 shadow-sm">Detailed Analytics</button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-white border-b border-slate-100">
                                    <th className="px-10 py-6 text-[11px] font-bold text-slate-400 uppercase tracking-[2px]">Timestamp</th>
                                    <th className="px-10 py-6 text-[11px] font-bold text-slate-400 uppercase tracking-[2px]">Patient Name</th>
                                    <th className="px-10 py-6 text-[11px] font-bold text-slate-400 uppercase tracking-[2px]">Amount</th>
                                    <th className="px-10 py-6 text-[11px] font-bold text-slate-400 uppercase tracking-[2px]">Method</th>
                                    <th className="px-10 py-6 text-[11px] font-bold text-slate-400 uppercase tracking-[2px] text-right">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {recentBills.map((bill, i) => (
                                    <tr key={i} className="hover:bg-blue-50/30 transition-colors group">
                                        <td className="px-10 py-6 text-slate-400 font-bold text-[11px] uppercase tracking-wider">{new Date(bill.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                                        <td className="px-10 py-6 font-bold text-slate-800 text-lg leading-tight group-hover:text-blue-600 transition-colors">{bill.patient_name}</td>
                                        <td className="px-10 py-6 font-bold text-slate-900 text-lg tracking-tighter">Ksh {bill.total_amount.toLocaleString()}</td>
                                        <td className="px-10 py-6">
                                            <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-bold uppercase tracking-widest">{bill.payment_method}</span>
                                        </td>
                                        <td className="px-10 py-6 text-right">
                                            <span className="px-4 py-1.5 bg-blue-50 text-blue-600 rounded-xl text-[10px] font-bold uppercase tracking-widest border border-blue-100">Confirmed</span>
                                        </td>
                                    </tr>
                                ))}
                                {recentBills.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="py-32 text-center bg-slate-50/20">
                                            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center text-4xl mx-auto mb-6 shadow-inner grayscale opacity-30">📜</div>
                                            <p className="font-bold text-slate-400 uppercase tracking-[3px] text-xs">No Activity Detected Today</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Quick Shortcuts */}
                <div className="space-y-8">
                    <div className="bg-slate-900 rounded-[44px] p-10 text-white shadow-2xl shadow-slate-900/20 relative overflow-hidden border border-white/5">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/10 rounded-full translate-x-10 -translate-y-10"></div>
                        <h3 className="text-2xl font-bold tracking-tight mb-2 relative z-10">Quick Directives</h3>
                        <p className="text-slate-400 font-medium mb-10 text-sm leading-relaxed relative z-10">Instant access to clinical management modules.</p>
                        <div className="grid gap-4 relative z-10">
                            {[
                                { name: 'Staff Management', icon: '🛡️', path: '/dashboard/hospital-users' },
                                { name: 'Partner Entities', icon: '🏢', path: '/dashboard/hospital-companies' },
                                { name: 'Usage Analytics', icon: '📈', path: '/dashboard/hospital-reports' },
                                { name: 'Patient Registry', icon: '👥', path: '/dashboard/hospital-patients' }
                            ].map((item, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => router.push(item.path)}
                                    className="w-full p-5 bg-white/5 hover:bg-white/10 rounded-2xl flex items-center justify-between transition-all group border border-white/5 shadow-sm active:scale-95"
                                >
                                    <div className="flex items-center gap-4">
                                        <span className="text-xl grayscale group-hover:grayscale-0 transition-all">{item.icon}</span>
                                        <span className="font-bold text-sm text-slate-200">{item.name}</span>
                                    </div>
                                    <span className="text-slate-500 group-hover:text-blue-400 group-hover:translate-x-1 transition-all">→</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="bg-white rounded-[44px] border border-slate-100 p-10 shadow-xl shadow-slate-200/40">
                        <h4 className="font-bold text-slate-400 text-[10px] uppercase tracking-[3px] mb-6">Service & Intelligence</h4>
                        <div className="flex items-center gap-5 p-6 bg-slate-50 rounded-3xl border border-slate-100 shadow-inner">
                            <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-2xl shadow-sm">💎</div>
                            <div>
                                <p className="font-bold text-slate-900 text-base tracking-tight">Alpha Solutions</p>
                                <p className="text-blue-600 text-[10px] font-bold uppercase tracking-widest mt-1">Clinical Intelligence Active</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

