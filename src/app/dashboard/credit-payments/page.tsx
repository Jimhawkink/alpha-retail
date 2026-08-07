'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import {
    FiDollarSign, FiSearch, FiFilter, FiUsers, FiCreditCard, FiCheck,
    FiX, FiChevronLeft, FiChevronRight, FiRefreshCw, FiPhone, FiFileText,
    FiDownload, FiPrinter, FiCheckCircle, FiAlertCircle, FiTrendingDown,
    FiTrendingUp, FiCalendar, FiActivity, FiClipboard, FiMapPin, FiClock,
    FiStar, FiMail, FiArrowRight
} from 'react-icons/fi';

interface Outlet { outlet_id: number; outlet_name: string; }
interface Customer {
    customer_id: number; customer_code: string; customer_name: string;
    phone: string; email: string; current_balance: number; credit_limit: number;
    outlet_id: number; opening_balance: number;
}
interface Sale {
    sale_id: number; receipt_no: string; sale_datetime: string; sale_date: string;
    total_amount: number; amount_paid: number; payment_method: string; status: string;
}
interface Payment {
    payment_id: number; customer_id: number; sale_id: number | null;
    receipt_no: string; payment_date: string; payment_datetime: string;
    amount_paid: number; balance_before: number; balance_after: number;
    payment_method: string; mpesa_code: string; reference_no: string;
    payment_note: string; received_by: string; transaction_type: string;
    outlet_id: number; created_at: string;
    customer_name?: string; customer_phone?: string;
}

const PAYMENT_METHODS = ['Cash', 'M-Pesa', 'Card', 'Bank Transfer', 'Cheque'];

export default function CreditPaymentsPage() {
    const [outlets, setOutlets] = useState<Outlet[]>([]);
    const [selectedOutletId, setSelectedOutletId] = useState<number | 'all'>('all');
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [customerSearch, setCustomerSearch] = useState('');
    const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
    const [outstandingSales, setOutstandingSales] = useState<Sale[]>([]);
    const [selectedSales, setSelectedSales] = useState<number[]>([]);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('Cash');
    const [mpesaCode, setMpesaCode] = useState('');
    const [referenceNo, setReferenceNo] = useState('');
    const [paymentNote, setPaymentNote] = useState('');
    const [receivedBy, setReceivedBy] = useState('');
    const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [paymentMode, setPaymentMode] = useState<'general' | 'invoice'>('general');

    // History
    const [payments, setPayments] = useState<Payment[]>([]);
    const [historyLoading, setHistoryLoading] = useState(true);
    const [historySearch, setHistorySearch] = useState('');
    const [historyDateFrom, setHistoryDateFrom] = useState('');
    const [historyDateTo, setHistoryDateTo] = useState(new Date().toISOString().split('T')[0]);
    const [historyMethodFilter, setHistoryMethodFilter] = useState('All');
    const [historyTypeFilter, setHistoryTypeFilter] = useState('All');
    const [page, setPage] = useState(1);
    const perPage = 15;

    useEffect(() => {
        loadOutlets();
        const saved = localStorage.getItem('selectedOutletId');
        if (saved) setSelectedOutletId(Number(saved));
    }, []);

    useEffect(() => {
        loadCustomers();
        loadPaymentHistory();
    }, [selectedOutletId]);

    const loadOutlets = async () => {
        const { data } = await supabase.from('retail_outlets').select('outlet_id, outlet_name').order('outlet_name');
        setOutlets(data || []);
    };

    const loadCustomers = useCallback(async () => {
        let q = supabase.from('retail_credit_customers').select('*').eq('active', true).order('customer_name');
        if (selectedOutletId !== 'all') q = q.eq('outlet_id', selectedOutletId);
        const { data } = await q;
        setCustomers(data || []);
    }, [selectedOutletId]);

    const loadPaymentHistory = useCallback(async () => {
        setHistoryLoading(true);
        let q = supabase.from('retail_credit_payments').select(`
            *, retail_credit_customers(customer_name, phone)
        `).order('created_at', { ascending: false }).limit(500);
        if (selectedOutletId !== 'all') q = q.eq('outlet_id', selectedOutletId);
        const { data, error } = await q;
        if (!error) {
            const mapped = (data || []).map((p: any) => ({
                ...p,
                customer_name: p.retail_credit_customers?.customer_name,
                customer_phone: p.retail_credit_customers?.phone,
            }));
            setPayments(mapped);
        }
        setHistoryLoading(false);
    }, [selectedOutletId]);

    const loadOutstandingSales = async (customerId: number) => {
        const { data } = await supabase.from('retail_sales')
            .select('*').eq('customer_id', customerId)
            .eq('payment_method', 'CREDIT').order('sale_datetime', { ascending: false });
        setOutstandingSales(data || []);
    };

    const handleSelectCustomer = (c: Customer) => {
        setSelectedCustomer(c);
        setCustomerSearch(c.customer_name);
        setShowCustomerDropdown(false);
        setPaymentAmount(c.current_balance > 0 ? String(c.current_balance) : '');
        setSelectedSales([]);
        loadOutstandingSales(c.customer_id);
    };

    const filteredCustomers = useMemo(() => {
        const q = customerSearch.toLowerCase();
        return customers.filter(c =>
            c.customer_name?.toLowerCase().includes(q) ||
            c.phone?.includes(q) || c.customer_code?.toLowerCase().includes(q)
        );
    }, [customers, customerSearch]);

    const processPayment = async () => {
        if (!selectedCustomer) { toast.error('Select a customer first'); return; }
        const amount = Number(paymentAmount);
        if (!amount || amount <= 0) { toast.error('Enter a valid payment amount'); return; }
        if (paymentMethod === 'M-Pesa' && !mpesaCode.trim()) { toast.error('Enter M-Pesa receipt code'); return; }

        setIsProcessing(true);
        try {
            const balanceBefore = selectedCustomer.current_balance;
            const balanceAfter = balanceBefore - amount;
            const now = new Date().toISOString();

            // 1. Record payment in credit_payments table — FULL DETAILS
            const { error: payErr } = await supabase.from('retail_credit_payments').insert({
                customer_id:      selectedCustomer.customer_id,
                sale_id:          paymentMode === 'invoice' && selectedSales.length === 1 ? selectedSales[0] : null,
                receipt_no:       null,
                payment_date:     paymentDate,
                payment_datetime: now,
                amount_paid:      amount,
                balance_before:   balanceBefore,
                balance_after:    balanceAfter,
                payment_method:   paymentMethod,
                mpesa_code:       paymentMethod === 'M-Pesa' ? mpesaCode.trim().toUpperCase() : null,
                reference_no:     referenceNo.trim() || null,
                payment_note:     paymentNote.trim() ||
                    (paymentMode === 'invoice' && selectedSales.length > 0
                        ? `Payment for ${selectedSales.length} invoice(s)`
                        : `General payment — balance cleared`),
                received_by:      receivedBy.trim() || null,
                transaction_type: 'payment',
                outlet_id:        selectedOutletId === 'all' ? (selectedCustomer.outlet_id || 1) : selectedOutletId,
            });
            if (payErr) throw payErr;

            // 2. Update customer running balance
            const { error: balErr } = await supabase.from('retail_credit_customers')
                .update({ current_balance: balanceAfter })
                .eq('customer_id', selectedCustomer.customer_id);
            if (balErr) throw balErr;

            // 3. If invoice mode, mark selected invoices as paid
            if (paymentMode === 'invoice' && selectedSales.length > 0) {
                const { error: saleErr } = await supabase.from('retail_sales')
                    .update({ payment_method: 'CREDIT_PAID', amount_paid: amount })
                    .in('sale_id', selectedSales);
                if (saleErr) console.warn('Invoice mark failed:', saleErr.message);
            }

            toast.success(`✅ Payment of Ksh ${amount.toLocaleString()} recorded!`);

            // Reset form
            setSelectedCustomer(null); setCustomerSearch(''); setPaymentAmount('');
            setMpesaCode(''); setReferenceNo(''); setPaymentNote(''); setReceivedBy('');
            setSelectedSales([]); setOutstandingSales([]);
            setPaymentDate(new Date().toISOString().split('T')[0]);
            loadCustomers(); loadPaymentHistory();
        } catch (err: any) {
            toast.error(err.message || 'Payment failed');
        } finally {
            setIsProcessing(false);
        }
    };

    // Stats
    const today = new Date().toISOString().split('T')[0];
    const todayPayments = payments.filter(p => p.payment_date === today && p.transaction_type === 'payment');
    const todayTotal = todayPayments.reduce((s, p) => s + (p.amount_paid || 0), 0);
    const monthPayments = payments.filter(p => {
        const d = new Date(p.payment_datetime || p.created_at);
        const n = new Date();
        return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear() && p.transaction_type === 'payment';
    });
    const monthTotal = monthPayments.reduce((s, p) => s + (p.amount_paid || 0), 0);
    const totalOutstanding = customers.reduce((s, c) => s + Math.max(0, c.current_balance || 0), 0);
    const totalPrepayments = customers.reduce((s, c) => s + Math.max(0, -(c.current_balance || 0)), 0);

    // Filtered history
    const filteredPayments = useMemo(() => {
        let list = payments;
        if (historySearch) {
            const q = historySearch.toLowerCase();
            list = list.filter(p =>
                p.customer_name?.toLowerCase().includes(q) ||
                p.mpesa_code?.toLowerCase().includes(q) ||
                p.receipt_no?.toLowerCase().includes(q) ||
                p.payment_note?.toLowerCase().includes(q)
            );
        }
        if (historyDateFrom) list = list.filter(p => p.payment_date >= historyDateFrom);
        if (historyDateTo) list = list.filter(p => p.payment_date <= historyDateTo);
        if (historyMethodFilter !== 'All') list = list.filter(p => p.payment_method === historyMethodFilter);
        if (historyTypeFilter === 'Payments') list = list.filter(p => p.transaction_type === 'payment' || p.transaction_type === 'partial_payment');
        if (historyTypeFilter === 'Credit Sales') list = list.filter(p => p.transaction_type === 'credit_sale');
        if (historyTypeFilter === 'Opening') list = list.filter(p => p.transaction_type === 'opening_balance' || p.transaction_type === 'prepayment');
        return list;
    }, [payments, historySearch, historyDateFrom, historyDateTo, historyMethodFilter, historyTypeFilter]);

    const totalPages = Math.ceil(filteredPayments.length / perPage);
    const paginatedPayments = filteredPayments.slice((page - 1) * perPage, page * perPage);

    const exportCSV = () => {
        const h = ['Date', 'Customer', 'Phone', 'Type', 'Amount', 'Method', 'M-Pesa Code', 'Balance Before', 'Balance After', 'Note', 'Received By'];
        const rows = filteredPayments.map(p => [p.payment_date, p.customer_name, p.customer_phone, p.transaction_type, p.amount_paid, p.payment_method, p.mpesa_code || '', p.balance_before, p.balance_after, p.payment_note || '', p.received_by || '']);
        const csv = [h, ...rows].map(r => r.map(v => `"${v ?? ''}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url;
        a.download = `credit-payments-${today}.csv`; a.click(); URL.revokeObjectURL(url);
        toast.success('Exported!');
    };

    const getTypeLabel = (type: string) => {
        switch (type) {
            case 'payment': return { label: 'Payment', cls: 'bg-green-100 text-green-700' };
            case 'partial_payment': return { label: 'Partial Pay', cls: 'bg-blue-100 text-blue-700' };
            case 'credit_sale': return { label: 'Credit Sale', cls: 'bg-orange-100 text-orange-700' };
            case 'opening_balance': return { label: 'Opening Bal', cls: 'bg-gray-100 text-gray-600' };
            case 'prepayment': return { label: 'Prepayment', cls: 'bg-purple-100 text-purple-700' };
            default: return { label: type || 'Unknown', cls: 'bg-gray-100 text-gray-500' };
        }
    };

    return (
        <div className="space-y-5" style={{ fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>

            {/* ━━━ TOP BAR ━━━ */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-300/40">
                        <FiDollarSign className="text-white" size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">Credit Payments</h1>
                        <p className="text-gray-500 text-sm mt-0.5">Collect payments · Record transactions · Per-outlet</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <select value={selectedOutletId}
                        onChange={e => { const v = e.target.value === 'all' ? 'all' : Number(e.target.value); setSelectedOutletId(v); if (v !== 'all') localStorage.setItem('selectedOutletId', String(v)); setPage(1); }}
                        className="px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 focus:outline-none focus:border-green-500 shadow-sm">
                        <option value="all">🏪 All Outlets</option>
                        {outlets.map(o => <option key={o.outlet_id} value={o.outlet_id}>{o.outlet_name}</option>)}
                    </select>
                    <button onClick={() => { loadCustomers(); loadPaymentHistory(); }} className="p-2.5 rounded-xl bg-white border border-gray-200 text-gray-500 hover:text-green-600 hover:border-green-300 transition-all shadow-sm"><FiRefreshCw size={16} /></button>
                    <button onClick={exportCSV} className="px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-600 hover:text-green-600 hover:border-green-300 transition-all text-sm font-semibold flex items-center gap-2 shadow-sm"><FiDownload size={14} /> Export</button>
                </div>
            </div>

            {/* ━━━ STAT CARDS ━━━ */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: "Today's Collections", value: `Ksh ${todayTotal.toLocaleString()}`, sub: `${todayPayments.length} payments`, icon: FiCheckCircle, g: 'from-green-500 to-green-600', bg: 'from-green-50 to-green-100 border-green-200', t: 'text-green-600' },
                    { label: 'This Month', value: `Ksh ${monthTotal.toLocaleString()}`, sub: `${monthPayments.length} payments`, icon: FiTrendingUp, g: 'from-blue-500 to-blue-600', bg: 'from-blue-50 to-blue-100 border-blue-200', t: 'text-blue-600' },
                    { label: 'Total Outstanding', value: `Ksh ${totalOutstanding.toLocaleString()}`, sub: `${customers.filter(c => c.current_balance > 0).length} customers`, icon: FiAlertCircle, g: 'from-red-500 to-red-600', bg: 'from-red-50 to-red-100 border-red-200', t: 'text-red-600' },
                    { label: 'Prepayments Held', value: `Ksh ${totalPrepayments.toLocaleString()}`, sub: `${customers.filter(c => c.current_balance < 0).length} customers`, icon: FiStar, g: 'from-purple-500 to-purple-600', bg: 'from-purple-50 to-purple-100 border-purple-200', t: 'text-purple-600' },
                ].map((s, i) => (
                    <div key={i} className={`bg-gradient-to-br ${s.bg} rounded-2xl p-4 border hover:shadow-lg transition-all group`}>
                        <div className="flex items-center gap-3">
                            <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${s.g} flex items-center justify-center text-white shadow-md group-hover:scale-110 transition-transform`}><s.icon size={18} /></div>
                            <div><p className={`text-xs ${s.t} font-semibold`}>{s.label}</p><p className="text-xl font-bold text-gray-800">{s.value}</p><p className="text-xs text-gray-500 mt-0.5">{s.sub}</p></div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

                {/* ━━━ PAYMENT FORM (3 cols) ━━━ */}
                <div className="lg:col-span-3 space-y-4">
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-green-600 to-emerald-700 px-6 py-4 text-white">
                            <h2 className="text-lg font-bold flex items-center gap-2"><FiDollarSign size={18} /> Record Payment</h2>
                            <p className="text-green-200 text-xs mt-0.5">Collect cash/M-Pesa/bank payment from credit customer</p>
                        </div>

                        <div className="p-6 space-y-4">
                            {/* Mode Toggle */}
                            <div className="flex gap-2 bg-gray-100 p-1 rounded-xl">
                                {[['general', FiDollarSign, 'General Payment'], ['invoice', FiFileText, 'Invoice Payment']].map(([mode, Icon, label]: any) => (
                                    <button key={mode} onClick={() => { setPaymentMode(mode); setSelectedSales([]); }}
                                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${paymentMode === mode ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                                        <Icon size={14} />{label}
                                    </button>
                                ))}
                            </div>

                            {/* Customer Selector */}
                            <div>
                                <label className="text-sm font-bold text-gray-700 mb-1.5 block">Customer</label>
                                <div className="relative">
                                    <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                    <input value={customerSearch}
                                        onChange={e => { setCustomerSearch(e.target.value); setShowCustomerDropdown(true); if (!e.target.value) { setSelectedCustomer(null); setOutstandingSales([]); setPaymentAmount(''); } }}
                                        onFocus={() => setShowCustomerDropdown(true)}
                                        placeholder="Search customer by name, phone or code..."
                                        className="w-full pl-10 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-400/20 transition-all font-medium" />
                                    {showCustomerDropdown && customerSearch && (
                                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-2xl shadow-2xl z-40 max-h-56 overflow-y-auto">
                                            {filteredCustomers.length === 0 ? (
                                                <p className="p-4 text-center text-gray-400 text-sm">No customers found</p>
                                            ) : filteredCustomers.slice(0, 10).map(c => (
                                                <button key={c.customer_id} onClick={() => handleSelectCustomer(c)}
                                                    className="w-full text-left px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-green-50 transition-colors group">
                                                    <div className="flex items-center justify-between">
                                                        <div>
                                                            <p className="font-semibold text-gray-800 group-hover:text-green-700">{c.customer_name}</p>
                                                            <p className="text-xs text-gray-500">{c.customer_code} · {c.phone || 'No phone'}</p>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className={`text-sm font-bold ${c.current_balance > 0 ? 'text-red-600' : c.current_balance < 0 ? 'text-purple-600' : 'text-green-600'}`}>
                                                                {c.current_balance < 0 ? '−' : ''}Ksh {Math.abs(c.current_balance).toLocaleString()}
                                                            </p>
                                                            <p className="text-xs text-gray-400">{c.current_balance > 0 ? 'owes' : c.current_balance < 0 ? 'prepaid' : '✓ clear'}</p>
                                                        </div>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Selected customer card */}
                                {selectedCustomer && (
                                    <div className="mt-3 p-4 bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <p className="font-bold text-green-800">{selectedCustomer.customer_name}</p>
                                                <div className="flex flex-wrap gap-3 mt-1 text-xs text-green-600">
                                                    {selectedCustomer.phone && <span className="flex items-center gap-1"><FiPhone size={11} />{selectedCustomer.phone}</span>}
                                                    <span>{selectedCustomer.customer_code}</span>
                                                </div>
                                            </div>
                                            <button onClick={() => { setSelectedCustomer(null); setCustomerSearch(''); setOutstandingSales([]); setPaymentAmount(''); }}
                                                className="text-red-400 hover:text-red-600 p-1 hover:bg-red-50 rounded-lg transition-all"><FiX size={16} /></button>
                                        </div>
                                        <div className="grid grid-cols-3 gap-3 mt-3">
                                            <div className="bg-white p-3 rounded-xl text-center border border-green-100">
                                                <p className="text-xs text-gray-500">Balance</p>
                                                <p className={`font-bold text-lg ${selectedCustomer.current_balance > 0 ? 'text-red-600' : selectedCustomer.current_balance < 0 ? 'text-purple-600' : 'text-green-600'}`}>
                                                    {selectedCustomer.current_balance < 0 ? '−' : ''}Ksh {Math.abs(selectedCustomer.current_balance).toLocaleString()}
                                                </p>
                                            </div>
                                            <div className="bg-white p-3 rounded-xl text-center border border-green-100">
                                                <p className="text-xs text-gray-500">Credit Limit</p>
                                                <p className="font-bold text-lg text-gray-700">Ksh {(selectedCustomer.credit_limit || 0).toLocaleString()}</p>
                                            </div>
                                            <div className="bg-white p-3 rounded-xl text-center border border-green-100">
                                                <p className="text-xs text-gray-500">After Payment</p>
                                                <p className={`font-bold text-lg ${(selectedCustomer.current_balance - (Number(paymentAmount) || 0)) > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                                                    Ksh {Math.max(0, selectedCustomer.current_balance - (Number(paymentAmount) || 0)).toLocaleString()}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Invoice selection (invoice mode) */}
                            {paymentMode === 'invoice' && selectedCustomer && outstandingSales.length > 0 && (
                                <div>
                                    <label className="text-sm font-bold text-gray-700 mb-2 block flex items-center justify-between">
                                        <span>Select Invoices</span>
                                        <button onClick={() => setSelectedSales(outstandingSales.map(s => s.sale_id))} className="text-xs text-blue-600 hover:underline">Select All</button>
                                    </label>
                                    <div className="space-y-2 max-h-36 overflow-y-auto border border-gray-200 rounded-xl p-2">
                                        {outstandingSales.map(s => (
                                            <label key={s.sale_id} className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${selectedSales.includes(s.sale_id) ? 'bg-green-50 border border-green-200' : 'hover:bg-gray-50 border border-transparent'}`}>
                                                <input type="checkbox" checked={selectedSales.includes(s.sale_id)}
                                                    onChange={e => setSelectedSales(prev => e.target.checked ? [...prev, s.sale_id] : prev.filter(id => id !== s.sale_id))}
                                                    className="w-4 h-4 accent-green-500 rounded" />
                                                <div className="flex-1 flex items-center justify-between">
                                                    <div>
                                                        <p className="text-sm font-semibold text-gray-800">{s.receipt_no}</p>
                                                        <p className="text-xs text-gray-500">{s.sale_date ? new Date(s.sale_date).toLocaleDateString('en-GB') : '-'}</p>
                                                    </div>
                                                    <p className="font-bold text-red-600 text-sm">Ksh {(s.total_amount || 0).toLocaleString()}</p>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                    {selectedSales.length > 0 && (
                                        <p className="text-xs text-green-600 font-semibold mt-1 flex items-center gap-1">
                                            <FiCheckCircle size={12} /> {selectedSales.length} invoice(s) selected
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Amount */}
                            <div>
                                <label className="text-sm font-bold text-gray-700 mb-1.5 block">Amount (Ksh)</label>
                                <input type="number" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)}
                                    placeholder="0.00" min="0"
                                    className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-400/20 text-xl font-bold transition-all" />
                                {selectedCustomer && selectedCustomer.current_balance > 0 && (
                                    <div className="flex gap-2 mt-2">
                                        {[500, 1000, 2000, selectedCustomer.current_balance].map(amt => (
                                            <button key={amt} onClick={() => setPaymentAmount(String(Math.min(amt, selectedCustomer.current_balance)))}
                                                className="px-3 py-1.5 bg-green-50 border border-green-200 text-green-700 rounded-lg text-xs font-bold hover:bg-green-100 transition-all">
                                                {amt === selectedCustomer.current_balance ? 'Full Bal' : amt.toLocaleString()}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Payment Method */}
                            <div>
                                <label className="text-sm font-bold text-gray-700 mb-1.5 block">Payment Method</label>
                                <div className="grid grid-cols-5 gap-2">
                                    {PAYMENT_METHODS.map(m => (
                                        <button key={m} onClick={() => setPaymentMethod(m)}
                                            className={`py-2.5 rounded-xl text-xs font-bold transition-all ${paymentMethod === m ? 'bg-green-500 text-white shadow-md shadow-green-300/40' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                                            {m === 'Cash' ? '💵' : m === 'M-Pesa' ? '📱' : m === 'Card' ? '💳' : m === 'Bank Transfer' ? '🏦' : '📄'}<br />{m}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* M-Pesa Code */}
                            {paymentMethod === 'M-Pesa' && (
                                <div>
                                    <label className="text-sm font-bold text-gray-700 mb-1.5 block">M-Pesa Receipt Code *</label>
                                    <input value={mpesaCode} onChange={e => setMpesaCode(e.target.value.toUpperCase())}
                                        placeholder="e.g. RLJ5XXXXXX" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-mono focus:outline-none focus:border-green-500 transition-all" />
                                </div>
                            )}

                            {/* Ref / Note / Received By */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-gray-600 mb-1 block">Reference No</label>
                                    <input value={referenceNo} onChange={e => setReferenceNo(e.target.value)}
                                        placeholder="Optional" className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-green-500 transition-all" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-600 mb-1 block">Received By</label>
                                    <input value={receivedBy} onChange={e => setReceivedBy(e.target.value)}
                                        placeholder="Staff name" className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-green-500 transition-all" />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-600 mb-1 block">Payment Note</label>
                                <input value={paymentNote} onChange={e => setPaymentNote(e.target.value)}
                                    placeholder="Optional notes about this payment..." className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-green-500 transition-all" />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-600 mb-1 block">Payment Date</label>
                                <input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)}
                                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-green-500 transition-all" />
                            </div>

                            {/* Submit */}
                            <button onClick={processPayment} disabled={isProcessing || !selectedCustomer || !paymentAmount}
                                className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-green-300/40 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100 flex items-center justify-center gap-3 text-base">
                                {isProcessing ? (
                                    <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />Processing...</>
                                ) : (
                                    <><FiCheckCircle size={20} />Record Payment {paymentAmount ? `· Ksh ${Number(paymentAmount).toLocaleString()}` : ''}</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                {/* ━━━ QUICK OUTSTANDING CUSTOMERS (2 cols) ━━━ */}
                <div className="lg:col-span-2">
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm h-full">
                        <div className="bg-gradient-to-r from-red-500 to-rose-600 px-5 py-4 text-white rounded-t-2xl">
                            <h3 className="font-bold flex items-center gap-2"><FiAlertCircle size={16} /> Outstanding Balances</h3>
                            <p className="text-red-200 text-xs mt-0.5">Click to select customer</p>
                        </div>
                        <div className="overflow-y-auto" style={{ maxHeight: '520px' }}>
                            {customers.filter(c => c.current_balance > 0).length === 0 ? (
                                <div className="text-center py-10 text-gray-400">
                                    <FiCheckCircle size={32} className="mx-auto mb-2 text-green-400" />
                                    <p className="text-sm font-medium text-green-600">All balances clear!</p>
                                </div>
                            ) : customers.filter(c => c.current_balance > 0).sort((a, b) => b.current_balance - a.current_balance).map(c => {
                                const overLimit = c.credit_limit > 0 && c.current_balance > c.credit_limit;
                                return (
                                    <button key={c.customer_id} onClick={() => handleSelectCustomer(c)}
                                        className={`w-full text-left px-4 py-3.5 border-b border-gray-50 hover:bg-red-50/40 transition-colors flex items-center justify-between group ${selectedCustomer?.customer_id === c.customer_id ? 'bg-green-50 border-l-4 border-l-green-500' : ''}`}>
                                        <div className="flex-1">
                                            <p className="font-semibold text-gray-800 text-sm group-hover:text-red-700 transition-colors">{c.customer_name}</p>
                                            <p className="text-xs text-gray-500 mt-0.5">{c.phone || 'No phone'} · {c.customer_code}</p>
                                            {overLimit && <span className="text-[9px] text-red-500 font-bold bg-red-50 px-1.5 py-0.5 rounded">OVER LIMIT</span>}
                                        </div>
                                        <div className="text-right ml-3">
                                            <p className="font-bold text-red-600 text-sm">Ksh {c.current_balance.toLocaleString()}</p>
                                            {c.credit_limit > 0 && <p className="text-[9px] text-gray-400">/{c.credit_limit.toLocaleString()} limit</p>}
                                            <FiArrowRight size={14} className="text-gray-300 group-hover:text-green-500 transition-colors ml-auto mt-1" />
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            {/* ━━━ PAYMENT HISTORY ━━━ */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="bg-gradient-to-r from-indigo-600 to-purple-700 px-6 py-4 text-white">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                        <div>
                            <h2 className="text-lg font-bold flex items-center gap-2"><FiActivity size={18} /> Payment History</h2>
                            <p className="text-indigo-200 text-xs mt-0.5">{filteredPayments.length} transactions · All ledger entries</p>
                        </div>
                        <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-sm font-semibold transition-colors">
                            <FiDownload size={14} /> Export CSV
                        </button>
                    </div>
                </div>

                {/* Filters */}
                <div className="p-4 border-b border-gray-100 flex flex-col lg:flex-row gap-3">
                    <div className="flex-1 relative">
                        <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
                        <input value={historySearch} onChange={e => { setHistorySearch(e.target.value); setPage(1); }}
                            placeholder="Search customer, M-Pesa code, note..." className="w-full pl-10 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 transition-all" />
                    </div>
                    <input type="date" value={historyDateFrom} onChange={e => { setHistoryDateFrom(e.target.value); setPage(1); }}
                        className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 transition-all" />
                    <input type="date" value={historyDateTo} onChange={e => { setHistoryDateTo(e.target.value); setPage(1); }}
                        className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 transition-all" />
                    <select value={historyMethodFilter} onChange={e => { setHistoryMethodFilter(e.target.value); setPage(1); }}
                        className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500">
                        <option value="All">All Methods</option>
                        {PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}
                        <option value="CREDIT">CREDIT</option>
                    </select>
                    <select value={historyTypeFilter} onChange={e => { setHistoryTypeFilter(e.target.value); setPage(1); }}
                        className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500">
                        <option value="All">All Types</option>
                        <option value="Payments">Payments Only</option>
                        <option value="Credit Sales">Credit Sales</option>
                        <option value="Opening">Opening Balances</option>
                    </select>
                </div>

                {/* Table */}
                {historyLoading ? (
                    <div className="flex flex-col items-center py-16"><div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" /><p className="mt-3 text-gray-400 text-sm">Loading history...</p></div>
                ) : filteredPayments.length === 0 ? (
                    <div className="text-center py-16"><FiActivity size={36} className="mx-auto text-gray-300 mb-3" /><p className="text-gray-500 font-medium">No transactions found</p></div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-200">
                                    {['Date', 'Customer', 'Type', 'Amount', 'Method', 'M-Pesa / Ref', 'Bal Before', 'Bal After', 'Note'].map(h => (
                                        <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedPayments.map((p, i) => {
                                    const { label, cls } = getTypeLabel(p.transaction_type);
                                    const isPayment = p.transaction_type === 'payment' || p.transaction_type === 'partial_payment';
                                    return (
                                        <tr key={p.payment_id} className={`border-b border-gray-50 text-sm hover:bg-indigo-50/20 transition-colors ${i % 2 === 0 ? '' : 'bg-gray-50/30'}`}>
                                            <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">
                                                {p.payment_date ? new Date(p.payment_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : '-'}
                                                <p className="text-gray-400 text-[9px]">{p.payment_datetime ? new Date(p.payment_datetime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : ''}</p>
                                            </td>
                                            <td className="px-4 py-3">
                                                <p className="font-semibold text-gray-800">{p.customer_name || '-'}</p>
                                                {p.customer_phone && <p className="text-xs text-gray-400">{p.customer_phone}</p>}
                                            </td>
                                            <td className="px-4 py-3"><span className={`text-[10px] font-bold px-2 py-1 rounded-full ${cls}`}>{label}</span></td>
                                            <td className="px-4 py-3">
                                                <p className={`font-bold text-sm ${isPayment ? 'text-green-600' : 'text-red-600'}`}>
                                                    {isPayment ? '+' : ''}Ksh {(p.amount_paid || 0).toLocaleString()}
                                                </p>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${p.payment_method === 'M-Pesa' || p.payment_method === 'MPESA' ? 'bg-green-100 text-green-700' : p.payment_method === 'CREDIT' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                                                    {p.payment_method}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-xs text-gray-600 font-mono">{p.mpesa_code || p.reference_no || '-'}</td>
                                            <td className="px-4 py-3 text-sm text-gray-600">{p.balance_before != null ? `Ksh ${p.balance_before.toLocaleString()}` : '-'}</td>
                                            <td className={`px-4 py-3 text-sm font-semibold ${(p.balance_after || 0) > 0 ? 'text-red-600' : (p.balance_after || 0) < 0 ? 'text-purple-600' : 'text-green-600'}`}>
                                                {p.balance_after != null ? `Ksh ${Math.abs(p.balance_after).toLocaleString()}` : '-'}
                                            </td>
                                            <td className="px-4 py-3 text-xs text-gray-500 max-w-[180px] truncate">{p.payment_note || '-'}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>

                        {/* Pagination */}
                        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                            <span className="text-xs text-gray-500">{filteredPayments.length} records · Page {page} of {totalPages}</span>
                            <div className="flex items-center gap-1">
                                <button onClick={() => setPage(1)} disabled={page === 1} className="px-2 py-1 rounded-lg disabled:opacity-30 hover:bg-gray-100 text-xs font-bold">«</button>
                                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-2 rounded-lg disabled:opacity-30 hover:bg-gray-100"><FiChevronLeft size={15} /></button>
                                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                                    const pg = Math.max(1, Math.min(totalPages - 4, page - 2)) + i;
                                    return pg <= totalPages ? (
                                        <button key={pg} onClick={() => setPage(pg)} className={`w-9 h-9 rounded-xl text-sm font-bold transition-all ${pg === page ? 'bg-indigo-500 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>{pg}</button>
                                    ) : null;
                                })}
                                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-2 rounded-lg disabled:opacity-30 hover:bg-gray-100"><FiChevronRight size={15} /></button>
                                <button onClick={() => setPage(totalPages)} disabled={page === totalPages} className="px-2 py-1 rounded-lg disabled:opacity-30 hover:bg-gray-100 text-xs font-bold">»</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
