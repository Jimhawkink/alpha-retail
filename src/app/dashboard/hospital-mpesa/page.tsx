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

    return (
        <div className="space-y-8 bg-[#fbfcfd] min-h-screen text-black">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight">Mobile Revenue</h1>
                    <p className="text-slate-500 font-medium">M-Pesa transaction auditing for medical services</p>
                </div>
                <button
                    onClick={loadTransactions}
                    className="px-8 py-4 bg-white border border-slate-200 text-slate-700 rounded-[24px] font-black hover:bg-slate-50 transition-all active:scale-95 flex items-center gap-2"
                >
                    <span>🔄</span> Refresh Stream
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-emerald-600 p-8 rounded-[40px] text-white shadow-xl shadow-emerald-500/20 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full translate-x-10 -translate-y-10"></div>
                    <span className="text-4xl mb-6 block relative z-10">📱</span>
                    <p className="text-emerald-100 text-[10px] font-black uppercase tracking-widest mb-1 relative z-10">Total M-Pesa Collection</p>
                    <p className="text-4xl font-black relative z-10">Ksh {stats.total.toLocaleString()}</p>
                </div>
                <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm relative overflow-hidden group">
                    <span className="text-4xl mb-6 block">📝</span>
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Transaction Volume</p>
                    <p className="text-4xl font-black text-slate-900">{stats.volume} Records</p>
                </div>
                <div className="bg-blue-600 p-8 rounded-[40px] text-white shadow-xl shadow-blue-500/20 relative overflow-hidden">
                    <span className="text-4xl mb-6 block">🛡️</span>
                    <p className="text-blue-100 text-[10px] font-black uppercase tracking-widest mb-1">Verification Status</p>
                    <p className="text-4xl font-black">100% Secured</p>
                </div>
            </div>

            <div className="bg-white rounded-[40px] shadow-sm border border-slate-100 overflow-hidden text-black">
                <div className="p-8 border-b border-slate-50 flex items-center justify-between">
                    <h3 className="font-black text-xl text-slate-900">M-Pesa Audit Logs</h3>
                    <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-lg uppercase">Real-time Feed</span>
                </div>
                <div className="overflow-x-auto text-black">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-100">
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[2px]">Timestamp</th>
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[2px]">Receipt</th>
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[2px]">Patient Entity</th>
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[2px]">M-Pesa Code</th>
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[2px] text-right">Settlement</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {transactions.map(t => (
                                <tr key={t.sale_id} className="hover:bg-blue-50/20 transition-colors group">
                                    <td className="px-8 py-5 text-slate-400 font-bold text-xs">{new Date(t.created_at).toLocaleString()}</td>
                                    <td className="px-8 py-5 font-black text-sm text-blue-600">{t.receipt_no}</td>
                                    <td className="px-8 py-5 font-bold text-slate-800">{t.patient_name}</td>
                                    <td className="px-8 py-5">
                                        <span className="px-3 py-1 bg-slate-900 text-white rounded-lg text-xs font-black tracking-widest">{t.mpesa_code || '---'}</span>
                                    </td>
                                    <td className="px-8 py-5 text-right font-black text-slate-900">Ksh {t.total_amount.toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {transactions.length === 0 && !isLoading && (
                        <div className="py-24 text-center">
                            <span className="text-6xl mb-6 block opacity-10">📱</span>
                            <p className="font-black text-slate-300 uppercase tracking-widest text-sm">No M-Pesa payments detected in medical streams</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
