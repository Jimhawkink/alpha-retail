'use client';

import { useState, useEffect } from 'react';
import { useCompanyName } from '@/context/SettingsContext';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';

interface Sale {
    sale_id: number;
    receipt_no: string;
    sale_date: string;
    sale_datetime: string;
    customer_name: string;
    customer_phone: string;
    subtotal: number;
    discount: number;
    total_amount: number;
    payment_method: string;
    amount_paid: number;
    change_amount: number;
    mpesa_code: string;
    checkout_request_id: string;
    status: string;
}

export default function SalesPage() {
    const [sales, setSales] = useState<Sale[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
    const [filterPayment, setFilterPayment] = useState('All');
    const [showReceiptModal, setShowReceiptModal] = useState(false);
    const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
    const companyName = useCompanyName();

    // Load sales from database
    const loadSales = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('retail_sales')
                .select('*')
                .eq('sale_date', filterDate)
                .order('sale_datetime', { ascending: false });

            if (error) throw error;
            setSales(data || []);
        } catch (err) {
            console.error('Error loading sales:', err);
            toast.error('Failed to load sales');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadSales();
    }, [filterDate]);

    const filteredSales = sales.filter(s => {
        const matchesSearch =
            (s.receipt_no || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (s.customer_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (s.customer_phone || '').includes(searchQuery) ||
            (s.mpesa_code || '').toLowerCase().includes(searchQuery.toLowerCase());
        const matchesPayment = filterPayment === 'All' || (s.payment_method || '').toUpperCase() === filterPayment.toUpperCase();
        return matchesSearch && matchesPayment;
    });

    const totalRevenue = filteredSales.reduce((sum, s) => sum + (s.total_amount || 0), 0);
    const cashTotal = filteredSales.filter(s => (s.payment_method || '').toUpperCase() === 'CASH').reduce((sum, s) => sum + (s.total_amount || 0), 0);
    const mpesaTotal = filteredSales.filter(s => (s.payment_method || '').toUpperCase() === 'MPESA' || (s.payment_method || '').toUpperCase() === 'M-PESA').reduce((sum, s) => sum + (s.total_amount || 0), 0);
    const creditTotal = filteredSales.filter(s => (s.payment_method || '').toUpperCase() === 'CREDIT').reduce((sum, s) => sum + (s.total_amount || 0), 0);

    const viewReceipt = (sale: Sale) => {
        setSelectedSale(sale);
        setShowReceiptModal(true);
    };

    const formatTime = (datetime: string) => {
        if (!datetime) return '';
        const date = new Date(datetime);
        return date.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 flex items-center gap-4">
                        <span className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-teal-700 rounded-[22px] flex items-center justify-center text-white text-3xl shadow-2xl shadow-emerald-200/50">💰</span>
                        Revenue Registry
                    </h1>
                    <p className="text-slate-400 text-sm font-bold uppercase tracking-[0.2em] mt-3 ml-1">
                        Global Financial Audit • Terminal v4.0
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    <button
                        onClick={loadSales}
                        className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-[20px] hover:bg-emerald-600 hover:text-white transition-all flex items-center justify-center text-xl shadow-inner group"
                        title="Synchronize Records"
                    >
                        <span className="group-hover:rotate-180 transition-transform duration-700">🔄</span>
                    </button>
                    <div className="relative group h-14 bg-white rounded-[20px] border-2 border-slate-100 px-6 flex items-center shadow-sm group-hover:shadow-md transition-all">
                        <input
                            type="date"
                            value={filterDate}
                            onChange={(e) => setFilterDate(e.target.value)}
                            className="bg-transparent text-slate-900 font-black focus:outline-none cursor-pointer"
                        />
                    </div>
                </div>
            </div>

            {/* Performance Matrix */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="bg-white rounded-[40px] p-8 shadow-xl shadow-slate-200/50 border border-slate-50 relative overflow-hidden group hover:-translate-y-2 transition-all duration-500">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-125 transition-transform duration-700"></div>
                    <div className="relative">
                        <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2">Daily Revenue</p>
                        <p className="text-3xl font-black text-slate-900">Ksh {totalRevenue.toLocaleString()}</p>
                        <div className="flex items-center gap-2 mt-4">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span className="text-[11px] font-black text-emerald-600 uppercase tracking-tighter">Settled Today</span>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-[40px] p-8 shadow-xl shadow-slate-200/50 border border-slate-50 relative overflow-hidden group hover:-translate-y-2 transition-all duration-500">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-125 transition-transform duration-700"></div>
                    <div className="relative">
                        <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2">Liquid Cash</p>
                        <p className="text-3xl font-black text-slate-900">Ksh {cashTotal.toLocaleString()}</p>
                        <div className="flex items-center gap-2 mt-4">
                            <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                            <span className="text-[11px] font-black text-blue-600 uppercase tracking-tighter">On-Hand Assets</span>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-[40px] p-8 shadow-xl shadow-slate-200/50 border border-slate-50 relative overflow-hidden group hover:-translate-y-2 transition-all duration-500">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-purple-50 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-125 transition-transform duration-700"></div>
                    <div className="relative">
                        <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2">Digital Flow</p>
                        <p className="text-3xl font-black text-slate-900">Ksh {mpesaTotal.toLocaleString()}</p>
                        <div className="flex items-center gap-2 mt-4">
                            <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span>
                            <span className="text-[11px] font-black text-purple-600 uppercase tracking-tighter">M-Pesa Ledger</span>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-[40px] p-8 shadow-xl shadow-slate-200/50 border border-slate-50 relative overflow-hidden group hover:-translate-y-2 transition-all duration-500">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-rose-50 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-125 transition-transform duration-700"></div>
                    <div className="relative">
                        <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2">Receivables</p>
                        <p className="text-3xl font-black text-rose-600">Ksh {creditTotal.toLocaleString()}</p>
                        <div className="flex items-center gap-2 mt-4">
                            <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                            <span className="text-[11px] font-black text-rose-600 uppercase tracking-tighter">Outstanding</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Advanced Filters */}
            <div className="bg-white rounded-[32px] p-6 shadow-xl shadow-slate-200/40 border border-slate-50">
                <div className="flex flex-col md:flex-row gap-6">
                    <div className="flex-1 relative group">
                        <span className="absolute left-5 top-1/2 -translate-y-1/2 text-xl pointer-events-none group-focus-within:scale-110 transition-transform">🔍</span>
                        <input
                            type="text"
                            placeholder="Identify by receipt, customer or code..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full px-6 py-4 pl-16 bg-slate-50 border-2 border-slate-100 rounded-[24px] text-slate-900 font-bold placeholder:text-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white transition-all shadow-inner"
                        />
                    </div>
                    <div className="relative">
                        <select
                            value={filterPayment}
                            onChange={(e) => setFilterPayment(e.target.value)}
                            className="appearance-none px-8 py-4 pr-16 bg-slate-50 border-2 border-slate-100 rounded-[24px] text-slate-700 font-bold focus:outline-none focus:border-emerald-600 transition-all cursor-pointer min-w-[220px]"
                        >
                            <option value="All">All Transactions</option>
                            <option value="CASH">💵 Liquid Cash</option>
                            <option value="MPESA">📱 M-Pesa Digital</option>
                            <option value="CREDIT">💳 Credit Account</option>
                        </select>
                        <span className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none opacity-40">▼</span>
                    </div>
                </div>
            </div>

            {/* Audit Table */}
            <div className="bg-white rounded-[40px] shadow-2xl shadow-slate-200/60 border border-slate-50 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-slate-50/50">
                                <th className="px-8 py-6 text-left text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Transaction Ref</th>
                                <th className="px-8 py-6 text-left text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Entity Integrity</th>
                                <th className="px-8 py-6 text-right text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Valuation</th>
                                <th className="px-8 py-6 text-center text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Settlement</th>
                                <th className="px-8 py-6 text-center text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Status</th>
                                <th className="px-8 py-6 text-center text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Audit</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y-2 divide-slate-50">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="px-8 py-24 text-center">
                                        <div className="flex flex-col items-center gap-4">
                                            <div className="w-12 h-12 border-4 border-emerald-600/20 border-t-emerald-600 rounded-full animate-spin"></div>
                                            <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Compiling Records...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredSales.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-8 py-24 text-center">
                                        <div className="flex flex-col items-center gap-6 opacity-40">
                                            <span className="text-7xl">📂</span>
                                            <span className="text-xs font-black text-slate-400 uppercase tracking-[0.3em]">Registry Empty for this Selection</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredSales.map((sale) => (
                                    <tr key={sale.sale_id} className="group hover:bg-emerald-50/30 transition-all duration-300">
                                        <td className="px-8 py-6">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-black text-emerald-600 font-mono tracking-tighter">{sale.receipt_no}</span>
                                                <span className="text-[11px] font-bold text-slate-400 mt-1 uppercase">{formatTime(sale.sale_datetime)}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-xl shadow-inner group-hover:scale-110 group-hover:bg-white transition-all duration-500">
                                                    👤
                                                </div>
                                                <div>
                                                    <p className="font-black text-slate-800 text-sm leading-tight">{sale.customer_name || 'Anonymous Client'}</p>
                                                    <p className="text-[11px] font-bold text-slate-400 uppercase mt-1 tracking-tighter">{sale.customer_phone || 'NO CONTACT'}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6 text-right font-black text-slate-900">
                                            <div className="flex flex-col items-end">
                                                <span className="text-sm">Ksh {sale.total_amount.toLocaleString()}</span>
                                                <span className="text-[10px] text-slate-400 font-bold uppercase mt-1">Total Bill</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6 text-center">
                                            <span className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm ${(sale.payment_method || '').toUpperCase() === 'CREDIT'
                                                ? 'bg-rose-100 text-rose-600'
                                                : (sale.payment_method || '').toUpperCase() === 'MPESA'
                                                    ? 'bg-purple-100 text-purple-600'
                                                    : 'bg-emerald-100 text-emerald-600'
                                                }`}>
                                                {sale.payment_method}
                                            </span>
                                        </td>
                                        <td className="px-8 py-6 text-center">
                                            <span className={`w-3 h-3 rounded-full inline-block ${sale.status === 'Completed' ? 'bg-emerald-500 shadow-lg shadow-emerald-200' : 'bg-rose-500 shadow-lg shadow-rose-200'
                                                }`}></span>
                                        </td>
                                        <td className="px-8 py-6 text-center">
                                            <button
                                                onClick={() => viewReceipt(sale)}
                                                className="w-12 h-12 bg-slate-50 text-slate-600 rounded-2xl hover:bg-emerald-600 hover:text-white transition-all duration-500 flex items-center justify-center shadow-inner group-hover:shadow-lg group-hover:shadow-emerald-200/50"
                                            >
                                                📄
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Receipt Modal */}
            {showReceiptModal && selectedSale && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xl flex items-center justify-center p-4 z-50 animate-in fade-in zoom-in duration-300">
                    <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden">
                        <div className="p-8 pb-4 border-b border-slate-100 flex justify-between items-center">
                            <h2 className="text-2xl font-black text-slate-900">Tax Invoice</h2>
                            <button
                                onClick={() => setShowReceiptModal(false)}
                                className="w-10 h-10 bg-slate-100 hover:bg-slate-200 rounded-full flex items-center justify-center transition-all"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-8 space-y-6">
                            <div className="text-center space-y-2">
                                <h3 className="text-2xl font-black text-emerald-600 tracking-tighter uppercase">{companyName}</h3>
                                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Premium Retailer</p>
                            </div>

                            <div className="bg-slate-50 rounded-[32px] p-6 space-y-4 shadow-inner">
                                <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-slate-400">
                                    <span>Receipt No</span>
                                    <span className="text-slate-900 font-black">{selectedSale.receipt_no}</span>
                                </div>
                                <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-slate-400">
                                    <span>Date & Time</span>
                                    <span className="text-slate-900 font-black">{new Date(selectedSale.sale_datetime).toLocaleString()}</span>
                                </div>
                                <div className="border-t-2 border-dashed border-slate-200 my-4"></div>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-black text-slate-900">Total Amount</span>
                                    <span className="text-2xl font-black text-emerald-600">Ksh {selectedSale.total_amount.toLocaleString()}</span>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest text-center">Customer Verification</p>
                                <div className="p-4 bg-white border-2 border-slate-100 rounded-2xl flex justify-between items-center">
                                    <div className="flex flex-col">
                                        <span className="text-xs font-black text-slate-900 uppercase">{selectedSale.customer_name || 'Walking Customer'}</span>
                                        <span className="text-[10px] font-bold text-slate-400">{selectedSale.customer_phone || 'No Contact'}</span>
                                    </div>
                                    <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600 font-black text-xs">
                                        OK
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-8 pt-0 mt-auto">
                            <button
                                onClick={() => window.print()}
                                className="w-full py-5 bg-slate-900 text-white rounded-[24px] font-black uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-xl shadow-slate-200"
                            >
                                Re-Print Invoice
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
