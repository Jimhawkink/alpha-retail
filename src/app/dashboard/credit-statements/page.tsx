'use client';

import { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';
import toast from 'react-hot-toast';
import {
    FiFileText, FiSearch, FiPrinter, FiDownload, FiRefreshCw,
    FiUser, FiPhone, FiMail, FiMapPin, FiDollarSign, FiCalendar,
    FiArrowUp, FiArrowDown, FiAlertCircle, FiChevronLeft, FiFilter,
    FiTrendingUp, FiCreditCard, FiCheckCircle, FiX, FiClock
} from 'react-icons/fi';

interface Customer {
    customer_id: number; customer_code: string; customer_name: string;
    phone: string; email: string; address: string; credit_limit: number;
    current_balance: number; opening_balance: number; active: boolean;
    outlet_id: number; notes: string; created_at: string;
}
interface LedgerEntry {
    date: string; type: 'opening' | 'sale' | 'payment' | 'prepayment';
    description: string; debit: number; credit: number; balance: number;
    reference: string; method?: string; receipt_no?: string; raw: any;
}
interface Outlet { outlet_id: number; outlet_name: string; }

function CreditStatementsInner() {
    const { activeOutlet, outlets } = useOutlet();
    const outletId = activeOutlet?.outlet_id ?? null;
    const searchParams = useSearchParams();
    const preselectedId = searchParams.get('customer');

    const [customers, setCustomers] = useState<Customer[]>([]);
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [customerSearch, setCustomerSearch] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);
    const [ledger, setLedger] = useState<LedgerEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingCustomers, setLoadingCustomers] = useState(true);
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
    const [typeFilter, setTypeFilter] = useState<'all' | 'sale' | 'payment'>('all');

    useEffect(() => {
        loadCustomers();
    }, [outletId]);

    useEffect(() => {
        if (customers.length > 0 && preselectedId) {
            const c = customers.find(c => String(c.customer_id) === preselectedId);
            if (c) { setSelectedCustomer(c); setCustomerSearch(c.customer_name); }
        }
    }, [customers, preselectedId]);

    useEffect(() => {
        if (selectedCustomer) buildLedger(selectedCustomer);
    }, [selectedCustomer, dateFrom, dateTo]);

    const loadCustomers = async () => {
        setLoadingCustomers(true);
        // ── STRICT per-outlet filter — use global outlet context ──
        let q = supabase.from('retail_credit_customers').select('*').eq('active', true).order('customer_name');
        if (outletId) q = q.eq('outlet_id', outletId);
        const { data } = await q;
        setCustomers(data || []);
        setLoadingCustomers(false);
    };

    const buildLedger = useCallback(async (c: Customer) => {
        setLoading(true);
        try {
            // Fetch all sales for this customer
            let salesQ = supabase.from('retail_sales').select('*').eq('customer_id', c.customer_id).order('sale_datetime');
            if (dateFrom) salesQ = salesQ.gte('sale_date', dateFrom);
            if (dateTo) salesQ = salesQ.lte('sale_date', dateTo);
            const { data: sales } = await salesQ;

            // Fetch all payments
            let paymentsQ = supabase.from('retail_credit_payments').select('*').eq('customer_id', c.customer_id).order('payment_datetime');
            if (dateFrom) paymentsQ = paymentsQ.gte('payment_date', dateFrom);
            if (dateTo) paymentsQ = paymentsQ.lte('payment_date', dateTo);
            const { data: payments } = await paymentsQ;

            const entries: LedgerEntry[] = [];

            // Opening balance entry (always first)
            const openBal = c.opening_balance || 0;
            if (openBal !== 0) {
                entries.push({
                    date: c.created_at?.split('T')[0] || '2024-01-01',
                    type: openBal > 0 ? 'opening' : 'prepayment',
                    description: openBal > 0 ? 'Opening Balance (brought forward)' : 'Opening Prepayment (brought forward)',
                    debit: openBal > 0 ? openBal : 0,
                    credit: openBal < 0 ? Math.abs(openBal) : 0,
                    balance: openBal, reference: 'OB', method: 'Opening Balance', raw: null
                });
            }

            // Combine and sort chronologically
            const allItems: Array<{ date: string; ts: string; type: 'sale' | 'payment'; data: any }> = [
                ...(sales || []).map(s => ({ date: s.sale_date, ts: s.sale_datetime || s.created_at, type: 'sale' as const, data: s })),
                ...(payments || []).filter(p => p.transaction_type !== 'opening_balance').map(p => ({
                    date: p.payment_date, ts: p.payment_datetime || p.created_at, type: 'payment' as const, data: p
                }))
            ].sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());

            let runningBalance = openBal;
            for (const item of allItems) {
                if (item.type === 'sale') {
                    const s = item.data;
                    const isCredit = s.payment_method === 'CREDIT';
                    const amount = s.total_amount || 0;
                    if (isCredit) runningBalance += amount;
                    entries.push({
                        date: s.sale_date || s.sale_datetime?.split('T')[0],
                        type: 'sale',
                        description: `Sale - ${s.items_count || ''} item(s)`,
                        debit: isCredit ? amount : 0,
                        credit: !isCredit ? amount : 0,
                        balance: runningBalance,
                        reference: s.receipt_no || String(s.sale_id),
                        receipt_no: s.receipt_no,
                        method: s.payment_method,
                        raw: s
                    });
                } else {
                    const p = item.data;
                    const amount = p.amount_paid || 0;
                    runningBalance -= amount;
                    entries.push({
                        date: p.payment_date || p.payment_datetime?.split('T')[0],
                        type: 'payment',
                        description: p.payment_note || `Payment received`,
                        debit: 0,
                        credit: amount,
                        balance: runningBalance,
                        reference: p.receipt_no || `PMT-${p.payment_id}`,
                        method: p.payment_method,
                        raw: p
                    });
                }
            }
            setLedger(entries);
        } catch (err: any) {
            toast.error('Failed to build statement: ' + err.message);
        } finally { setLoading(false); }
    }, [dateFrom, dateTo]);

    const filteredLedger = useMemo(() => {
        if (typeFilter === 'all') return ledger;
        return ledger.filter(e => typeFilter === 'sale' ? e.type === 'sale' : (e.type === 'payment' || e.type === 'prepayment'));
    }, [ledger, typeFilter]);

    const filteredCustomers = useMemo(() => {
        const q = customerSearch.toLowerCase();
        return customers.filter(c =>
            c.customer_name?.toLowerCase().includes(q) ||
            c.phone?.includes(q) || c.customer_code?.toLowerCase().includes(q)
        );
    }, [customers, customerSearch]);

    const totalDebit = filteredLedger.reduce((s, e) => s + e.debit, 0);
    const totalCredit = filteredLedger.reduce((s, e) => s + e.credit, 0);
    const closingBalance = selectedCustomer?.current_balance || 0;

    const handlePrint = () => {
        window.print();
    };

    const exportCSV = () => {
        if (!selectedCustomer) return;
        const h = ['Date', 'Description', 'Reference', 'Method', 'Debit (Dr)', 'Credit (Cr)', 'Balance'];
        const rows = filteredLedger.map(e => [e.date, e.description, e.reference, e.method || '', e.debit || '', e.credit || '', e.balance]);
        const csv = [h, ...rows].map(r => r.map(v => `"${v ?? ''}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url;
        a.download = `statement-${selectedCustomer.customer_code}-${dateFrom || 'all'}-to-${dateTo}.csv`;
        a.click(); URL.revokeObjectURL(url);
        toast.success('Statement exported!');
    };

    return (
        <div className="space-y-5 print:space-y-3" style={{ fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>

            {/* ━━━ PREMIUM BANNER ━━━ */}
            <div className="rounded-2xl overflow-hidden shadow-2xl print:hidden" style={{ background: 'linear-gradient(135deg, #2D1B69 0%, #4C1D95 50%, #6D28D9 100%)' }}>
                <div className="px-6 py-5">
                    <div className="flex items-center gap-2 text-purple-300 text-xs mb-3">
                        <span>Dashboard</span><span className="opacity-50">/</span>
                        <span>Finance</span><span className="opacity-50">/</span>
                        <span className="text-violet-200 font-semibold">📋 Credit Statements</span>
                    </div>
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                        <div className="flex items-start gap-4">
                            <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0" style={{ background: 'linear-gradient(135deg, #7C3AED, #6D28D9)' }}>
                                <FiFileText size={26} color="#fff" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                    <h1 className="text-2xl font-black text-white">Customer Statements</h1>
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-300 text-violet-900">FULL LEDGER</span>
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400 text-amber-900">
                                        {outlets.find(o => o.outlet_id === outletId)?.outlet_name || 'All Outlets'}
                                    </span>
                                </div>
                                <p className="text-purple-200 text-sm">Full Dr/Cr ledger · Running balance · Per-outlet strict · Print ready</p>
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                    {['Running Balance', 'Date Filter', 'Quick Periods', 'Print Statement', 'CSV Export', 'Credit Utilisation'].map(tag => (
                                        <span key={tag} className="px-2 py-0.5 rounded text-[10px] text-purple-200 border border-white/10" style={{ background: 'rgba(255,255,255,0.07)' }}>{tag}</span>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <button onClick={() => loadCustomers()} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-purple-200 hover:text-white hover:bg-white/10 border border-white/10 transition-all"><FiRefreshCw size={12} /> Refresh</button>
                            {selectedCustomer && <>
                                <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-purple-200 hover:text-white hover:bg-white/10 border border-white/10 transition-all"><FiDownload size={12} /> Export CSV</button>
                                <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white shadow-lg active:scale-95 transition-all" style={{ background: 'linear-gradient(135deg, #059669, #10B981)' }}><FiPrinter size={14} /> Print</button>
                            </>}
                        </div>
                    </div>
                </div>
                {/* KPI Bar */}
                <div className="grid grid-cols-4 border-t border-white/10">
                    {[
                        { l: 'Customers', v: String(customers.length), c: '#C4B5FD' },
                        { l: 'Selected', v: selectedCustomer?.customer_name?.split(' ')[0] || '—', c: '#34D399' },
                        { l: 'Balance', v: selectedCustomer ? `Ksh ${selectedCustomer.current_balance.toLocaleString()}` : '—', c: selectedCustomer && selectedCustomer.current_balance > 0 ? '#F87171' : '#34D399' },
                        { l: 'Transactions', v: String(ledger.length), c: '#FCD34D' },
                    ].map((s, i) => (
                        <div key={i} className="px-4 py-3 flex items-center gap-2 border-r border-white/10 last:border-0">
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: s.c + '22' }}>
                                <FiFileText size={11} style={{ color: s.c }} />
                            </div>
                            <div>
                                <div className="text-base font-black leading-none truncate max-w-[100px]" style={{ color: s.c }}>{s.v}</div>
                                <div className="text-[9px] text-purple-300 leading-tight mt-0.5">{s.l}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>


            {/* ━━━ CUSTOMER SELECTOR + FILTERS ━━━ */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm print:hidden">
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                    {/* Customer Search */}
                    <div className="lg:col-span-2 relative">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 block">Select Customer</label>
                        <div className="relative">
                            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <input
                                value={customerSearch}
                                onChange={e => { setCustomerSearch(e.target.value); setShowDropdown(true); if (!e.target.value) setSelectedCustomer(null); }}
                                onFocus={() => setShowDropdown(true)}
                                placeholder={loadingCustomers ? 'Loading...' : 'Search by name, phone, or code...'}
                                className="w-full pl-10 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-400/20 transition-all font-medium"
                            />
                            {selectedCustomer && (
                                <button onClick={() => { setSelectedCustomer(null); setCustomerSearch(''); setLedger([]); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500"><FiX size={16} /></button>
                            )}
                            {showDropdown && customerSearch && (
                                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-2xl shadow-2xl z-40 max-h-64 overflow-y-auto">
                                    {filteredCustomers.length === 0 ? (
                                        <div className="p-4 text-center text-gray-400 text-sm">No customers found</div>
                                    ) : filteredCustomers.slice(0, 12).map(c => (
                                        <button key={c.customer_id}
                                            onClick={() => { setSelectedCustomer(c); setCustomerSearch(c.customer_name); setShowDropdown(false); }}
                                            className="w-full text-left px-4 py-3.5 hover:bg-indigo-50 transition-colors border-b border-gray-50 last:border-0 group">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="font-semibold text-gray-800 group-hover:text-indigo-700">{c.customer_name}</p>
                                                    <p className="text-xs text-gray-500">{c.customer_code} · {c.phone}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className={`text-sm font-bold ${c.current_balance > 0 ? 'text-red-600' : c.current_balance < 0 ? 'text-purple-600' : 'text-green-600'}`}>
                                                        {c.current_balance < 0 ? '−' : ''}Ksh {Math.abs(c.current_balance).toLocaleString()}
                                                    </p>
                                                    <p className="text-xs text-gray-400">{c.current_balance > 0 ? 'owes' : c.current_balance < 0 ? 'prepaid' : 'clear'}</p>
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Date From */}
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 block">Date From</label>
                        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-400/20 transition-all text-sm" />
                    </div>

                    {/* Date To */}
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 block">Date To</label>
                        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-400/20 transition-all text-sm" />
                    </div>
                </div>

                {/* Quick date filters */}
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                    <span className="text-xs text-gray-400 font-semibold">Quick:</span>
                    {[
                        ['Today', () => { const t = new Date().toISOString().split('T')[0]; setDateFrom(t); setDateTo(t); }],
                        ['This Week', () => { const d = new Date(); d.setDate(d.getDate() - d.getDay()); setDateFrom(d.toISOString().split('T')[0]); setDateTo(new Date().toISOString().split('T')[0]); }],
                        ['This Month', () => { const d = new Date(); setDateFrom(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`); setDateTo(new Date().toISOString().split('T')[0]); }],
                        ['Last 3 Months', () => { const d = new Date(); d.setMonth(d.getMonth() - 3); setDateFrom(d.toISOString().split('T')[0]); setDateTo(new Date().toISOString().split('T')[0]); }],
                        ['This Year', () => { setDateFrom(`${new Date().getFullYear()}-01-01`); setDateTo(new Date().toISOString().split('T')[0]); }],
                        ['All Time', () => { setDateFrom(''); setDateTo(new Date().toISOString().split('T')[0]); }],
                    ].map(([label, action]: any) => (
                        <button key={label} onClick={action} className="px-3 py-1.5 bg-gray-100 hover:bg-indigo-100 hover:text-indigo-700 text-gray-600 rounded-lg text-xs font-semibold transition-all">{label}</button>
                    ))}
                    <div className="ml-auto flex items-center gap-2">
                        <span className="text-xs text-gray-400">Type:</span>
                        {(['all', 'sale', 'payment'] as const).map(t => (
                            <button key={t} onClick={() => setTypeFilter(t)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${typeFilter === t ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{t}</button>
                        ))}
                    </div>
                </div>
            </div>

            {/* ━━━ NO CUSTOMER SELECTED ━━━ */}
            {!selectedCustomer && (
                <div className="text-center py-24 bg-white rounded-2xl border border-gray-200 shadow-sm">
                    <div className="w-20 h-20 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-3xl flex items-center justify-center mx-auto mb-5">
                        <FiFileText size={36} className="text-indigo-400" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-700 mb-2">Select a Customer</h2>
                    <p className="text-gray-400">Search for a customer above to view their full statement</p>
                    <div className="mt-6 flex items-center justify-center gap-4 text-sm text-gray-400">
                        <span className="flex items-center gap-1.5"><FiArrowUp size={14} className="text-red-400" />Debit = Amount owed</span>
                        <span className="flex items-center gap-1.5"><FiArrowDown size={14} className="text-green-400" />Credit = Payment received</span>
                    </div>
                </div>
            )}

            {/* ━━━ CUSTOMER STATEMENT ━━━ */}
            {selectedCustomer && (
                <>
                    {/* Customer Header (printable) */}
                    <div className="bg-gradient-to-r from-indigo-600 to-purple-700 rounded-2xl p-6 text-white shadow-xl">
                        <div className="flex items-start justify-between flex-wrap gap-4">
                            <div>
                                <p className="text-indigo-200 text-xs font-bold uppercase tracking-widest mb-1">Account Statement</p>
                                <h2 className="text-2xl font-bold">{selectedCustomer.customer_name}</h2>
                                <p className="text-indigo-200 text-sm mt-1">{selectedCustomer.customer_code}</p>
                                <div className="flex flex-wrap gap-4 mt-3 text-sm">
                                    {selectedCustomer.phone && <span className="flex items-center gap-1.5 text-indigo-100"><FiPhone size={13} />{selectedCustomer.phone}</span>}
                                    {selectedCustomer.email && <span className="flex items-center gap-1.5 text-indigo-100"><FiMail size={13} />{selectedCustomer.email}</span>}
                                    {selectedCustomer.address && <span className="flex items-center gap-1.5 text-indigo-100"><FiMapPin size={13} />{selectedCustomer.address}</span>}
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-indigo-200 text-xs mb-1">Period</p>
                                <p className="font-semibold text-sm">{dateFrom || 'All Time'} → {dateTo}</p>
                                <p className="text-indigo-200 text-xs mt-2 mb-1">Printed</p>
                                <p className="font-semibold text-sm">{new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                            </div>
                        </div>

                        {/* Summary row */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
                            {[
                                { label: 'Opening Balance', value: `Ksh ${(selectedCustomer.opening_balance || 0).toLocaleString()}`, icon: FiClock, color: 'bg-white/10' },
                                { label: 'Total Sales (Dr)', value: `Ksh ${totalDebit.toLocaleString()}`, icon: FiArrowUp, color: 'bg-red-500/20' },
                                { label: 'Total Paid (Cr)', value: `Ksh ${totalCredit.toLocaleString()}`, icon: FiArrowDown, color: 'bg-green-500/20' },
                                { label: 'Current Balance', value: `Ksh ${Math.abs(closingBalance).toLocaleString()}`, icon: FiDollarSign, color: closingBalance > 0 ? 'bg-red-500/30' : closingBalance < 0 ? 'bg-purple-500/30' : 'bg-green-500/30' },
                            ].map((s, i) => (
                                <div key={i} className={`${s.color} rounded-xl p-4 backdrop-blur-sm`}>
                                    <div className="flex items-center gap-2 mb-1"><s.icon size={14} className="text-indigo-200" /><p className="text-xs text-indigo-200 font-semibold">{s.label}</p></div>
                                    <p className="text-xl font-bold">{s.value}</p>
                                    {i === 3 && closingBalance < 0 && <p className="text-xs text-purple-200 mt-0.5">Prepayment</p>}
                                    {i === 3 && closingBalance > 0 && <p className="text-xs text-red-200 mt-0.5">Amount Owed</p>}
                                    {i === 3 && closingBalance === 0 && <p className="text-xs text-green-200 mt-0.5">Cleared ✓</p>}
                                </div>
                            ))}
                        </div>

                        {/* Credit limit bar */}
                        {selectedCustomer.credit_limit > 0 && (
                            <div className="mt-4">
                                <div className="flex items-center justify-between text-xs text-indigo-200 mb-1.5">
                                    <span>Credit Utilisation</span>
                                    <span>{Math.min(100, Math.round((closingBalance / selectedCustomer.credit_limit) * 100))}% of Ksh {selectedCustomer.credit_limit.toLocaleString()} limit</span>
                                </div>
                                <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all ${closingBalance > selectedCustomer.credit_limit ? 'bg-red-400' : closingBalance > selectedCustomer.credit_limit * 0.7 ? 'bg-orange-400' : 'bg-green-400'}`}
                                        style={{ width: `${Math.min(100, (closingBalance / selectedCustomer.credit_limit) * 100)}%` }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Ledger Table */}
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-gray-200">
                            <div className="w-14 h-14 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                            <p className="mt-4 text-gray-500 font-medium">Building statement...</p>
                        </div>
                    ) : filteredLedger.length === 0 ? (
                        <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
                            <FiFileText size={40} className="mx-auto text-gray-300 mb-3" />
                            <p className="text-gray-500 font-medium">No transactions in this period</p>
                            <p className="text-gray-400 text-sm mt-1">Try expanding the date range</p>
                        </div>
                    ) : (
                        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="bg-gradient-to-r from-indigo-600 to-purple-700">
                                            <th className="px-4 py-3.5 text-left text-[10px] font-bold text-indigo-100 uppercase tracking-widest w-28">Date</th>
                                            <th className="px-4 py-3.5 text-left text-[10px] font-bold text-indigo-100 uppercase tracking-widest">Description</th>
                                            <th className="px-4 py-3.5 text-left text-[10px] font-bold text-indigo-100 uppercase tracking-widest">Reference</th>
                                            <th className="px-4 py-3.5 text-center text-[10px] font-bold text-indigo-100 uppercase tracking-widest">Method</th>
                                            <th className="px-4 py-3.5 text-right text-[10px] font-bold text-indigo-100 uppercase tracking-widest">Debit (Dr)</th>
                                            <th className="px-4 py-3.5 text-right text-[10px] font-bold text-indigo-100 uppercase tracking-widest">Credit (Cr)</th>
                                            <th className="px-4 py-3.5 text-right text-[10px] font-bold text-indigo-100 uppercase tracking-widest">Balance</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredLedger.map((entry, idx) => {
                                            const isOpening = entry.type === 'opening' || entry.type === 'prepayment';
                                            const isPayment = entry.type === 'payment';
                                            const isNegBal = entry.balance < 0;
                                            return (
                                                <tr key={idx} className={`border-b border-gray-50 text-sm transition-colors
                                                    ${isOpening ? 'bg-gray-50 font-medium' : ''}
                                                    ${isPayment ? 'hover:bg-green-50/30' : 'hover:bg-red-50/10'}`}>
                                                    <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">
                                                        {entry.date ? new Date(entry.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : '-'}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <p className={`font-medium ${isOpening ? 'text-gray-700' : isPayment ? 'text-green-700' : 'text-gray-800'}`}>
                                                            {entry.description}
                                                        </p>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className={`text-xs font-mono px-2 py-0.5 rounded-lg ${isOpening ? 'bg-gray-100 text-gray-600' : isPayment ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                                                            {entry.reference}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        {entry.method && (
                                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${entry.method === 'MPESA' ? 'bg-green-100 text-green-700' : entry.method === 'CREDIT' ? 'bg-orange-100 text-orange-700' : entry.method === 'Opening Balance' ? 'bg-gray-100 text-gray-600' : 'bg-blue-100 text-blue-700'}`}>
                                                                {entry.method}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-semibold text-red-600">
                                                        {entry.debit > 0 ? `Ksh ${entry.debit.toLocaleString()}` : '-'}
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-semibold text-green-600">
                                                        {entry.credit > 0 ? `Ksh ${entry.credit.toLocaleString()}` : '-'}
                                                    </td>
                                                    <td className={`px-4 py-3 text-right font-bold ${isNegBal ? 'text-purple-600' : entry.balance > 0 ? 'text-red-700' : 'text-green-700'}`}>
                                                        {isNegBal ? '−' : ''}Ksh {Math.abs(entry.balance).toLocaleString()}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                    {/* Totals row */}
                                    <tfoot>
                                        <tr className="bg-gradient-to-r from-gray-50 to-indigo-50 border-t-2 border-indigo-200">
                                            <td colSpan={4} className="px-4 py-4 text-sm font-bold text-gray-700">TOTALS ({filteredLedger.length} transactions)</td>
                                            <td className="px-4 py-4 text-right font-bold text-red-700 text-sm">Ksh {totalDebit.toLocaleString()}</td>
                                            <td className="px-4 py-4 text-right font-bold text-green-700 text-sm">Ksh {totalCredit.toLocaleString()}</td>
                                            <td className={`px-4 py-4 text-right font-bold text-base ${closingBalance > 0 ? 'text-red-700' : closingBalance < 0 ? 'text-purple-700' : 'text-green-700'}`}>
                                                {closingBalance < 0 ? '−' : ''}Ksh {Math.abs(closingBalance).toLocaleString()}
                                                <p className="text-xs font-normal mt-0.5">{closingBalance > 0 ? 'Amount Owed' : closingBalance < 0 ? 'Prepayment' : '✓ Cleared'}</p>
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Print footer */}
                    <div className="hidden print:block text-center text-xs text-gray-500 border-t pt-4 mt-4">
                        <p>Alpha Retail · Statement for {selectedCustomer.customer_name} · Printed {new Date().toLocaleDateString()}</p>
                        <p className="mt-1">This is a computer-generated statement. For queries contact your store manager.</p>
                    </div>
                </>
            )}

            <style jsx global>{`
                @media print {
                    .print\\:hidden { display: none !important; }
                    .print\\:block { display: block !important; }
                    body { background: white; }
                    .rounded-2xl, .rounded-3xl { border-radius: 8px !important; }
                    .shadow-sm, .shadow-xl { box-shadow: none !important; }
                }
            `}</style>
        </div>
    );
}

export default function CreditStatementsPage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-gray-500 text-sm">Loading statements...</p>
                </div>
            </div>
        }>
            <CreditStatementsInner />
        </Suspense>
    );
}
