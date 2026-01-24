'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface BillingRecord {
    billing_id: number;
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
            const { data, error } = await supabase.from('hospital_billing').select('*').gte('created_at', `${dateFrom}T00:00:00`).lte('created_at', `${dateTo}T23:59:59`).order('created_at', { ascending: false });
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
    }, []);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-800">Hospital Billing Reports</h1>
                <p className="text-gray-500">Summary of all medical services billed</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Total Revenue</p>
                    <p className="text-3xl font-black text-blue-600">Ksh {summary.totalRevenue.toLocaleString()}</p>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Transactions</p>
                    <p className="text-3xl font-black text-gray-800">{summary.totalTransactions}</p>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Cash Payments</p>
                    <p className="text-3xl font-black text-emerald-500">Ksh {summary.cashTotal.toLocaleString()}</p>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">M-Pesa Payments</p>
                    <p className="text-3xl font-black text-green-500">Ksh {summary.mpesaTotal.toLocaleString()}</p>
                </div>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
                    <h2 className="font-bold text-gray-700">Recent Transactions</h2>
                    <button className="text-xs font-bold text-blue-600 hover:underline">Export to Excel</button>
                </div>
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-gray-100">
                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Date</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Receipt No</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Patient Name</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Method</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Amount</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {records.map(record => (
                            <tr key={record.billing_id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-4 text-sm text-gray-500">
                                    {new Date(record.created_at).toLocaleDateString()}
                                </td>
                                <td className="px-6 py-4 font-mono text-sm font-bold text-blue-600">{record.receipt_no}</td>
                                <td className="px-6 py-4 font-bold text-gray-800">{record.patient_name}</td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${record.payment_method === 'MPESA' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'
                                        }`}>
                                        {record.payment_method}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right font-black text-gray-900">Ksh {Number(record.total_amount).toLocaleString()}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {records.length === 0 && !isLoading && (
                    <div className="py-20 text-center opacity-30 italic">
                        No transactions recorded yet
                    </div>
                )}
            </div>
        </div>
    );
}
