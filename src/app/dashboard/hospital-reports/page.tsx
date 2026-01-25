'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface BillingRecord {
    sale_id: number;
    receipt_no: string;
    patient_name: string;
    total_amount: number;
    payment_method: string;
    created_at: string;
}

export default function HospitalReportsPage() {
    const [records, setRecords] = useState<BillingRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [summary, setSummary] = useState({
        totalRevenue: 0,
        totalTransactions: 0,
        cashTotal: 0,
        mpesaTotal: 0
    });
    const today = new Date().toISOString().split('T')[0];
    const [dateFrom, setDateFrom] = useState(today);
    const [dateTo, setDateTo] = useState(today);

    useEffect(() => {
        const loadReports = async () => {
            setIsLoading(true);
            const { data, error } = await supabase
                .from('hospital_sales')
                .select('*')
                .gte('created_at', `${dateFrom}T00:00:00`)
                .lte('created_at', `${dateTo}T23:59:59`)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error fetching billing records:', error);
                setIsLoading(false);
                return;
            }
            if (data) {
                setRecords(data);
                const revenue = data.reduce((sum, r) => sum + Number(r.total_amount || 0), 0);
                const cash = data.filter(r => r.payment_method === 'CASH').reduce((sum, r) => sum + Number(r.total_amount || 0), 0);
                const mpesa = data.filter(r => r.payment_method === 'MPESA').reduce((sum, r) => sum + Number(r.total_amount || 0), 0);

                setSummary({
                    totalRevenue: revenue,
                    totalTransactions: data.length,
                    cashTotal: cash,
                    mpesaTotal: mpesa
                });
            }
            setIsLoading(false);
        };
        loadReports();
    }, [dateFrom, dateTo]);

    return (
        <div className="space-y-10 max-w-[1400px] mx-auto pb-20">
            {/* Elegant Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm">
                <div className="flex items-center gap-5">
                    <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-3xl shadow-inner">
                        📊
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Billing Intelligence</h1>
                        <p className="text-slate-500 font-medium text-sm mt-1 uppercase tracking-wider">Comprehensive medical revenue auditing & analytics</p>
                    </div>
                </div>
                <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-2xl border border-slate-100 shadow-inner">
                    <div className="flex flex-col px-4 border-r border-slate-200">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">From</span>
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={(e) => setDateFrom(e.target.value)}
                            className="bg-transparent font-bold text-slate-900 border-none p-0 text-sm focus:ring-0 cursor-pointer"
                        />
                    </div>
                    <div className="flex flex-col px-4">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">To</span>
                        <input
                            type="date"
                            value={dateTo}
                            onChange={(e) => setDateTo(e.target.value)}
                            className="bg-transparent font-bold text-slate-900 border-none p-0 text-sm focus:ring-0 cursor-pointer"
                        />
                    </div>
                </div>
            </div>

            {/* Premium Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                <div className="bg-white p-10 rounded-[40px] border border-slate-100 shadow-xl shadow-slate-200/40 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full translate-x-10 -translate-y-10 opacity-50"></div>
                    <span className="text-4xl relative z-10">💎</span>
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-8 mb-2">Total Revenue</p>
                    <p className="text-4xl font-bold text-slate-900 tracking-tighter">Ksh {summary.totalRevenue.toLocaleString()}</p>
                </div>

                <div className="bg-white p-10 rounded-[40px] border border-slate-100 shadow-xl shadow-slate-200/40 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full translate-x-10 -translate-y-10 opacity-50"></div>
                    <span className="text-4xl relative z-10">📜</span>
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-8 mb-2">Total Transactions</p>
                    <p className="text-4xl font-bold text-slate-900 tracking-tighter">{summary.totalTransactions}</p>
                </div>

                <div className="bg-white p-10 rounded-[40px] border border-slate-100 shadow-xl shadow-slate-200/40 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full translate-x-10 -translate-y-10 opacity-50"></div>
                    <span className="text-4xl relative z-10">💵</span>
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-8 mb-2">Cash Collections</p>
                    <p className="text-4xl font-bold text-slate-900 tracking-tighter">Ksh {summary.cashTotal.toLocaleString()}</p>
                </div>

                <div className="bg-slate-900 p-10 rounded-[40px] text-white shadow-2xl shadow-slate-900/10 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/10 rounded-full translate-x-10 -translate-y-10"></div>
                    <span className="text-4xl relative z-10 text-emerald-400">📱</span>
                    <p className="text-emerald-400/80 text-[10px] font-bold uppercase tracking-widest mt-8 mb-2">M-Pesa Collections</p>
                    <p className="text-4xl font-bold text-white tracking-tighter">Ksh {summary.mpesaTotal.toLocaleString()}</p>
                </div>
            </div>

            {/* Records Table */}
            <div className="bg-white rounded-[44px] shadow-xl shadow-slate-200/40 border border-slate-100 overflow-hidden">
                <div className="px-10 py-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/20">
                    <div className="flex items-center gap-4">
                        <div className="w-2 h-8 bg-blue-600 rounded-full"></div>
                        <h3 className="font-bold text-xl text-slate-900 tracking-tight">Audit Trail</h3>
                    </div>
                    <button className="px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-2xl font-bold hover:bg-slate-50 transition-all flex items-center gap-3 uppercase text-[10px] tracking-widest shadow-sm border-b-2 active:scale-95">
                        <span>📥</span> Export Audit Log
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-white border-b border-slate-100">
                                <th className="px-10 py-6 text-[11px] font-bold text-slate-400 uppercase tracking-[2px]">Date</th>
                                <th className="px-10 py-6 text-[11px] font-bold text-slate-400 uppercase tracking-[2px]">Journal No</th>
                                <th className="px-10 py-6 text-[11px] font-bold text-slate-400 uppercase tracking-[2px]">Patient Entity</th>
                                <th className="px-10 py-6 text-[11px] font-bold text-slate-400 uppercase tracking-[2px]">Method</th>
                                <th className="px-10 py-6 text-[11px] font-bold text-slate-400 uppercase tracking-[2px] text-right">Amount</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {records.map(record => (
                                <tr key={record.sale_id} className="hover:bg-blue-50/30 transition-colors group">
                                    <td className="px-10 py-6 text-slate-400 font-bold text-[11px] uppercase tracking-wider">
                                        {new Date(record.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </td>
                                    <td className="px-10 py-6 font-bold text-blue-600 text-sm tracking-wider uppercase">{record.receipt_no}</td>
                                    <td className="px-10 py-6 font-bold text-slate-800 text-lg leading-tight group-hover:text-blue-600 transition-colors">{record.patient_name}</td>
                                    <td className="px-10 py-6">
                                        <span className={`px-4 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-widest border ${record.payment_method === 'MPESA'
                                                ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                                : 'bg-blue-50 text-blue-600 border-blue-100'
                                            }`}>
                                            {record.payment_method}
                                        </span>
                                    </td>
                                    <td className="px-10 py-6 text-right font-bold text-slate-900 text-lg tracking-tighter">Ksh {Number(record.total_amount).toLocaleString()}</td>
                                </tr>
                            ))}
                            {records.length === 0 && !isLoading && (
                                <tr>
                                    <td colSpan={5} className="py-32 text-center bg-slate-50/20">
                                        <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center text-4xl mx-auto mb-6 shadow-inner grayscale opacity-30">📊</div>
                                        <p className="font-bold text-slate-400 uppercase tracking-[3px] text-xs">No Records Found for Selected Period</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
