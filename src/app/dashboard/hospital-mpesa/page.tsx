'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface MpesaTransaction {
    sale_id: number;
    receipt_no: string;
    patient_name: string;
    total_amount: number;
    mpesa_code: string;
    created_at: string;
}

export default function HospitalMpesaPage() {
    const [transactions, setTransactions] = useState<MpesaTransaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [stats, setStats] = useState({
        total: 0,
        volume: 0,
    });

    const loadTransactions = async () => {
        setIsLoading(true);
        const { data } = await supabase
            .from('hospital_sales')
            .select('sale_id, receipt_no, patient_name, total_amount, mpesa_code, created_at')
            .eq('payment_method', 'MPESA')
            .order('created_at', { ascending: false });

        if (data) {
            setTransactions(data);
            const total = data.reduce((sum, t) => sum + Number(t.total_amount || 0), 0);
            setStats({ total, volume: data.length });
        }
        setIsLoading(false);
    };

    useEffect(() => {
        loadTransactions();
    }, []);

    if (isLoading) return <div className="p-8 text-slate-400 font-bold uppercase tracking-widest text-xs animate-pulse">Syncing Mobile Revenue Records...</div>;

    return (
        <div className="space-y-10 max-w-[1400px] mx-auto pb-20">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm">
                <div className="flex items-center gap-5">
                    <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-3xl shadow-inner">
                        📱
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Mobile Revenue</h1>
                        <p className="text-slate-500 font-medium text-sm mt-1 uppercase tracking-wider">M-Pesa transaction auditing for medical services</p>
                    </div>
                </div>
                <button
                    onClick={loadTransactions}
                    className="px-8 py-4 bg-slate-900 text-white rounded-[24px] font-bold hover:bg-black transition-all shadow-xl shadow-slate-900/20 active:scale-95 flex items-center gap-3 uppercase text-xs tracking-widest border-b-4 border-slate-700"
                >
                    <span>🔄</span> Refresh Stream
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                <div className="bg-slate-900 p-8 rounded-[40px] text-white shadow-2xl shadow-slate-900/10 relative overflow-hidden border border-white/5">
                    <div className="absolute top-0 right-0 w-40 h-40 bg-blue-600/10 rounded-full translate-x-10 -translate-y-10"></div>
                    <div className="relative z-10">
                        <span className="text-4xl mb-6 block">📱</span>
                        <p className="text-blue-400 text-[10px] font-bold uppercase tracking-widest mb-2">Total Collection</p>
                        <p className="text-4xl font-bold tracking-tighter">Ksh {stats.total.toLocaleString()}</p>
                    </div>
                </div>
                <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-xl shadow-slate-200/40 relative overflow-hidden group">
                    <span className="text-4xl mb-6 block">📝</span>
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-2">Transaction Count</p>
                    <p className="text-4xl font-bold text-slate-900 tracking-tighter">{stats.volume} Records</p>
                </div>
                <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-xl shadow-slate-200/40 relative overflow-hidden">
                    <span className="text-4xl mb-6 block">🛡️</span>
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-2">Audit Status</p>
                    <p className="text-4xl font-bold text-blue-600 tracking-tighter">SECURED</p>
                </div>
            </div>

            <div className="bg-white rounded-[40px] shadow-xl shadow-slate-200/40 border border-slate-100 overflow-hidden">
                <div className="px-10 py-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
                    <h3 className="font-bold text-xl text-slate-900 tracking-tight">M-Pesa Revenue Stream</h3>
                    <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-4 py-2 rounded-xl uppercase tracking-widest border border-blue-100">Live Synchronization</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-white border-b border-slate-100">
                                <th className="px-10 py-6 text-[11px] font-bold text-slate-400 uppercase tracking-[2px]">Timestamp</th>
                                <th className="px-10 py-6 text-[11px] font-bold text-slate-400 uppercase tracking-[2px]">Journal Ref</th>
                                <th className="px-10 py-6 text-[11px] font-bold text-slate-400 uppercase tracking-[2px]">Patient Entity</th>
                                <th className="px-10 py-6 text-[11px] font-bold text-slate-400 uppercase tracking-[2px]">M-Pesa Reference</th>
                                <th className="px-10 py-6 text-[11px] font-bold text-slate-400 uppercase tracking-[2px] text-right">Settlement</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {transactions.map(t => (
                                <tr key={t.sale_id} className="hover:bg-blue-50/30 transition-colors group">
                                    <td className="px-10 py-6 text-slate-400 font-bold text-[11px] uppercase tracking-wider">{new Date(t.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                                    <td className="px-10 py-6 font-bold text-sm text-blue-600 tracking-widest">{t.receipt_no}</td>
                                    <td className="px-10 py-6 font-bold text-slate-800 text-lg leading-tight">{t.patient_name}</td>
                                    <td className="px-10 py-6">
                                        <span className="px-4 py-2 bg-slate-900 text-white rounded-xl text-[11px] font-bold tracking-[3px] shadow-lg shadow-slate-900/10">{t.mpesa_code || '---'}</span>
                                    </td>
                                    <td className="px-10 py-6 text-right font-bold text-slate-900 text-lg">Ksh {t.total_amount.toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {transactions.length === 0 && !isLoading && (
                        <div className="py-32 text-center bg-slate-50/30">
                            <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center text-5xl mx-auto mb-6 shadow-inner grayscale opacity-30">📱</div>
                            <p className="font-bold text-slate-400 uppercase tracking-[4px] text-xs">Revenue Stream Empty</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
