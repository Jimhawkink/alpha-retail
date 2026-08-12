'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';
import {
    FiDownload, FiPrinter, FiSearch, FiRefreshCw, FiChevronDown, FiChevronRight,
    FiFilter, FiX, FiTrendingUp, FiTrendingDown, FiDollarSign, FiShoppingCart,
    FiPackage, FiCalendar, FiUser, FiCreditCard, FiFileText, FiBarChart2,
    FiGrid, FiChevronLeft, FiArrowRight
} from 'react-icons/fi';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface SaleRow {
    sale_id: number; receipt_no: string; sale_date: string; sale_datetime: string;
    customer_name: string; customer_phone: string; served_by: string;
    subtotal: number; discount: number; total_amount: number;
    payment_method: string; amount_paid: number; status: string;
    outlet_id: number; mpesa_code: string;
    // computed
    items?: SaleItemRow[];
    expanded?: boolean;
    cost?: number;
    profit?: number;
}
interface SaleItemRow {
    item_id: number; sale_id: number; product_id: number; product_name: string;
    quantity: number; unit_price: number; discount: number; subtotal: number;
    selling_unit: string; cost_price?: number;
}

const PAYMENT_METHODS = ['All', 'Cash', 'M-Pesa', 'Card', 'Credit', 'Split'];
const PAGE_SIZES = [25, 50, 100, 200];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const fmt = (n: number) => `Ksh ${(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 2 })}`;
const fmtNum = (n: number) => (n || 0).toLocaleString('en-KE');
const today = () => new Date().toISOString().split('T')[0];
const firstOfMonth = () => { const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0]; };

function Badge({ children, color }: { children: React.ReactNode; color: string }) {
    const colors: Record<string, string> = {
        green: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
        blue: 'bg-blue-50 text-blue-700 border border-blue-200',
        amber: 'bg-amber-50 text-amber-700 border border-amber-200',
        red: 'bg-red-50 text-red-700 border border-red-200',
        purple: 'bg-purple-50 text-purple-700 border border-purple-200',
        gray: 'bg-gray-50 text-gray-600 border border-gray-200',
    };
    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold ${colors[color] || colors.gray}`}>
            {children}
        </span>
    );
}

function StatCard({ icon: Icon, label, value, sub, gradient }: any) {
    return (
        <div className={`rounded-2xl p-5 text-white shadow-lg ${gradient} relative overflow-hidden`}>
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, white 0%, transparent 60%)' }} />
            <div className="relative z-10">
                <div className="flex items-center gap-2 mb-3">
                    <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                        <Icon size={18} />
                    </div>
                    <span className="text-sm font-semibold text-white/80">{label}</span>
                </div>
                <p className="text-2xl font-black mb-0.5">{value}</p>
                {sub && <p className="text-xs text-white/70">{sub}</p>}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────
export default function FullSalesReportPage() {
    const { activeOutlet } = useOutlet();
    const outletId = activeOutlet?.outlet_id || 1;

    // ── Filters ──────────────────────────────────────────────────────────────
    const [dateFrom, setDateFrom] = useState(firstOfMonth());
    const [dateTo, setDateTo] = useState(today());
    const [search, setSearch] = useState('');
    const [paymentFilter, setPaymentFilter] = useState('All');
    const [statusFilter, setStatusFilter] = useState('All');
    const [salesPersonFilter, setSalesPersonFilter] = useState('All');
    const [minAmount, setMinAmount] = useState('');
    const [maxAmount, setMaxAmount] = useState('');
    const [showFilters, setShowFilters] = useState(false);

    // ── Data ──────────────────────────────────────────────────────────────────
    const [sales, setSales] = useState<SaleRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
    const [itemsCache, setItemsCache] = useState<Record<number, SaleItemRow[]>>({});
    const [loadingItems, setLoadingItems] = useState<Set<number>>(new Set());
    const [salesPersons, setSalesPersons] = useState<string[]>([]);

    // ── Pagination ────────────────────────────────────────────────────────────
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);

    // ─────────────────────────────────────────────────────────────────────────
    // Load
    // ─────────────────────────────────────────────────────────────────────────
    const loadSales = useCallback(async () => {
        setLoading(true);
        setExpandedRows(new Set());
        try {
            let q = supabase.from('retail_sales')
                .select('sale_id,receipt_no,sale_date,sale_datetime,customer_name,customer_phone,served_by,subtotal,discount,total_amount,payment_method,amount_paid,status,outlet_id,mpesa_code')
                .eq('outlet_id', outletId)
                .gte('sale_date', dateFrom)
                .lte('sale_date', dateTo)
                .order('sale_datetime', { ascending: false })
                .limit(2000);

            const { data, error } = await q;
            if (error) throw error;
            const rows = data || [];
            setSales(rows);

            // Unique sales persons
            const persons = [...new Set(rows.map((r: any) => r.served_by).filter(Boolean))].sort() as string[];
            setSalesPersons(persons);
        } catch {
            setSales([]);
        }
        setLoading(false);
    }, [outletId, dateFrom, dateTo]);

    useEffect(() => { loadSales(); }, [loadSales]);

    // ─────────────────────────────────────────────────────────────────────────
    // Expand row — load items
    // ─────────────────────────────────────────────────────────────────────────
    const toggleRow = async (saleId: number) => {
        setExpandedRows(prev => {
            const next = new Set(prev);
            next.has(saleId) ? next.delete(saleId) : next.add(saleId);
            return next;
        });
        if (!itemsCache[saleId]) {
            setLoadingItems(prev => new Set(prev).add(saleId));
            try {
                const { data } = await supabase.from('retail_sale_items')
                    .select('item_id,sale_id,product_id,product_name,quantity,unit_price,discount,subtotal,selling_unit,cost_price')
                    .eq('sale_id', saleId);
                setItemsCache(prev => ({ ...prev, [saleId]: data || [] }));
            } catch {
                setItemsCache(prev => ({ ...prev, [saleId]: [] }));
            }
            setLoadingItems(prev => { const s = new Set(prev); s.delete(saleId); return s; });
        }
    };

    // ─────────────────────────────────────────────────────────────────────────
    // Filtered + Paginated
    // ─────────────────────────────────────────────────────────────────────────
    const filtered = useMemo(() => {
        const q = search.toLowerCase().trim();
        return sales.filter(s => {
            if (q && !s.receipt_no?.toLowerCase().includes(q) &&
                !s.customer_name?.toLowerCase().includes(q) &&
                !s.customer_phone?.includes(q) &&
                !s.served_by?.toLowerCase().includes(q) &&
                !s.mpesa_code?.toLowerCase().includes(q)) return false;
            if (paymentFilter !== 'All' && s.payment_method?.toLowerCase() !== paymentFilter.toLowerCase()) return false;
            if (statusFilter !== 'All' && s.status !== statusFilter) return false;
            if (salesPersonFilter !== 'All' && s.served_by !== salesPersonFilter) return false;
            if (minAmount && s.total_amount < parseFloat(minAmount)) return false;
            if (maxAmount && s.total_amount > parseFloat(maxAmount)) return false;
            return true;
        });
    }, [sales, search, paymentFilter, statusFilter, salesPersonFilter, minAmount, maxAmount]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

    // ── Summary stats ──────────────────────────────────────────────────────
    const stats = useMemo(() => {
        const totalSales = filtered.reduce((s, r) => s + (r.total_amount || 0), 0);
        const totalDiscount = filtered.reduce((s, r) => s + (r.discount || 0), 0);
        const totalTransactions = filtered.length;
        const avgSale = totalTransactions > 0 ? totalSales / totalTransactions : 0;
        const cashTotal = filtered.filter(r => r.payment_method?.toLowerCase() === 'cash').reduce((s, r) => s + r.total_amount, 0);
        const mpesaTotal = filtered.filter(r => r.payment_method?.toLowerCase() === 'm-pesa').reduce((s, r) => s + r.total_amount, 0);
        return { totalSales, totalDiscount, totalTransactions, avgSale, cashTotal, mpesaTotal };
    }, [filtered]);

    // ─────────────────────────────────────────────────────────────────────────
    // Export Excel (CSV)
    // ─────────────────────────────────────────────────────────────────────────
    const exportCSV = () => {
        const headers = ['Receipt No', 'Date', 'DateTime', 'Customer', 'Phone', 'Sales Person', 'Payment Method', 'M-Pesa Code', 'Subtotal', 'Discount', 'Total', 'Amount Paid', 'Status'];
        const rows = filtered.map(s => [
            s.receipt_no, s.sale_date, s.sale_datetime, s.customer_name || 'Walk-in',
            s.customer_phone || '', s.served_by || '', s.payment_method || '',
            s.mpesa_code || '', s.subtotal?.toFixed(2), s.discount?.toFixed(2),
            s.total_amount?.toFixed(2), s.amount_paid?.toFixed(2), s.status || '',
        ]);
        const csv = [headers, ...rows].map(r => r.map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `Full-Sales-Report-${dateFrom}-to-${dateTo}.csv`;
        a.click();
    };

    // ─────────────────────────────────────────────────────────────────────────
    // Print
    // ─────────────────────────────────────────────────────────────────────────
    const printReport = () => window.print();

    const paymentColor = (method: string) => {
        const m = method?.toLowerCase();
        if (m === 'cash') return 'green';
        if (m === 'm-pesa') return 'blue';
        if (m === 'card') return 'purple';
        if (m === 'credit') return 'amber';
        if (m === 'split') return 'gray';
        return 'gray';
    };

    // ─────────────────────────────────────────────────────────────────────────
    // Render
    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20" style={{ fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>
            <div className="max-w-[1600px] mx-auto px-4 py-6 space-y-6">

                {/* ── HEADER ── */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-300/40"
                            style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}>
                            <FiBarChart2 size={26} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-gray-900">Full Sales Report</h1>
                            <p className="text-sm text-gray-500 mt-0.5">
                                Detailed sales analytics · <span className="font-semibold text-indigo-600">{activeOutlet?.outlet_name}</span>
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <button onClick={() => setShowFilters(f => !f)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-bold transition-all ${showFilters ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-gray-200 text-gray-700 hover:border-indigo-300'}`}>
                            <FiFilter size={15} /> Filters {showFilters ? '▲' : '▼'}
                        </button>
                        <button onClick={loadSales} className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700 hover:border-indigo-300 transition-all">
                            <FiRefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh
                        </button>
                        <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white shadow-md hover:shadow-lg transition-all"
                            style={{ background: 'linear-gradient(135deg,#059669,#047857)' }}>
                            <FiDownload size={15} /> Export Excel
                        </button>
                        <button onClick={printReport} className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700 hover:border-indigo-300 transition-all">
                            <FiPrinter size={15} /> Print
                        </button>
                    </div>
                </div>

                {/* ── QUICK DATE RANGE + MAIN FILTERS ── */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        {/* Date From */}
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">📅 Date From</label>
                            <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }}
                                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent" />
                        </div>
                        {/* Date To */}
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">📅 Date To</label>
                            <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }}
                                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent" />
                        </div>
                        {/* Search */}
                        <div className="md:col-span-2">
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">🔍 Search</label>
                            <div className="relative">
                                <FiSearch size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                                    placeholder="Receipt No, Customer, Phone, M-Pesa Code..."
                                    className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent" />
                                {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><FiX size={14} /></button>}
                            </div>
                        </div>
                        {/* Quick ranges */}
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">⚡ Quick Range</label>
                            <div className="flex gap-1.5 flex-wrap">
                                {[['Today', today(), today()], ['7 Days', (() => { const d = new Date(); d.setDate(d.getDate() - 6); return d.toISOString().split('T')[0]; })(), today()], ['This Month', firstOfMonth(), today()]].map(([label, from, to]) => (
                                    <button key={label} onClick={() => { setDateFrom(from); setDateTo(to); setPage(1); }}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${dateFrom === from && dateTo === to ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-indigo-300'}`}>
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Advanced Filters */}
                    {showFilters && (
                        <div className="mt-5 pt-5 border-t border-gray-100 grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">💳 Payment Method</label>
                                <select value={paymentFilter} onChange={e => { setPaymentFilter(e.target.value); setPage(1); }}
                                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-400">
                                    {PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">👤 Sales Person</label>
                                <select value={salesPersonFilter} onChange={e => { setSalesPersonFilter(e.target.value); setPage(1); }}
                                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-400">
                                    <option>All</option>
                                    {salesPersons.map(p => <option key={p}>{p}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">📊 Min Amount</label>
                                <input type="number" value={minAmount} onChange={e => { setMinAmount(e.target.value); setPage(1); }}
                                    placeholder="0" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">📊 Max Amount</label>
                                <input type="number" value={maxAmount} onChange={e => { setMaxAmount(e.target.value); setPage(1); }}
                                    placeholder="999999" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                            </div>
                        </div>
                    )}
                </div>

                {/* ── STAT CARDS ── */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    <StatCard icon={FiShoppingCart} label="Transactions" value={fmtNum(stats.totalTransactions)}
                        sub={`${dateFrom} → ${dateTo}`} gradient="bg-gradient-to-br from-indigo-500 to-violet-600" />
                    <StatCard icon={FiDollarSign} label="Total Sales" value={fmt(stats.totalSales)}
                        sub="Gross revenue" gradient="bg-gradient-to-br from-emerald-500 to-teal-600" />
                    <StatCard icon={FiTrendingDown} label="Discounts" value={fmt(stats.totalDiscount)}
                        sub="Total given" gradient="bg-gradient-to-br from-amber-500 to-orange-500" />
                    <StatCard icon={FiBarChart2} label="Avg Sale" value={fmt(stats.avgSale)}
                        sub="Per transaction" gradient="bg-gradient-to-br from-blue-500 to-cyan-500" />
                    <StatCard icon={FiDollarSign} label="Cash" value={fmt(stats.cashTotal)}
                        sub="Cash payments" gradient="bg-gradient-to-br from-green-500 to-emerald-600" />
                    <StatCard icon={FiCreditCard} label="M-Pesa" value={fmt(stats.mpesaTotal)}
                        sub="M-Pesa payments" gradient="bg-gradient-to-br from-rose-500 to-pink-600" />
                </div>

                {/* ── DATA TABLE ── */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    {/* Table Header bar */}
                    <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                        <div className="flex items-center gap-3">
                            <FiGrid size={18} className="text-indigo-500" />
                            <span className="font-bold text-gray-800">
                                {loading ? 'Loading...' : `${filtered.length.toLocaleString()} records`}
                                {filtered.length !== sales.length && <span className="text-gray-400 font-normal ml-1">(of {sales.length.toLocaleString()} total)</span>}
                            </span>
                        </div>
                        <div className="flex items-center gap-3">
                            <label className="text-xs font-bold text-gray-500">Rows per page:</label>
                            <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
                                className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-400">
                                {PAGE_SIZES.map(s => <option key={s}>{s}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)' }}>
                                    {['', 'Receipt No', 'Date & Time', 'Customer', 'Sales Person', 'Payment', 'M-Pesa Code', 'Subtotal', 'Discount', 'Total', 'Status', 'Actions'].map(h => (
                                        <th key={h} className="px-4 py-3.5 text-left text-xs font-black text-indigo-200 uppercase tracking-wider whitespace-nowrap">
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {loading ? (
                                    <tr><td colSpan={12} className="py-20 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                                            <p className="text-gray-400 font-medium text-sm">Loading sales data...</p>
                                        </div>
                                    </td></tr>
                                ) : paginated.length === 0 ? (
                                    <tr><td colSpan={12} className="py-20 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center">
                                                <FiFileText size={28} className="text-gray-400" />
                                            </div>
                                            <p className="font-bold text-gray-600">No sales found</p>
                                            <p className="text-gray-400 text-sm">Try adjusting your filters or date range</p>
                                        </div>
                                    </td></tr>
                                ) : paginated.map((sale, idx) => {
                                    const isExpanded = expandedRows.has(sale.sale_id);
                                    const items = itemsCache[sale.sale_id] || [];
                                    const isLoadingItems = loadingItems.has(sale.sale_id);
                                    const rowBg = idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60';
                                    const itemCost = items.reduce((s, it) => s + ((it.cost_price || 0) * it.quantity), 0);
                                    const itemProfit = items.length > 0 ? sale.total_amount - itemCost : null;

                                    return (<>
                                        <tr key={sale.sale_id} className={`${rowBg} hover:bg-indigo-50/40 transition-colors cursor-pointer group`}
                                            onClick={() => toggleRow(sale.sale_id)}>
                                            {/* Expand chevron */}
                                            <td className="pl-4 pr-2 py-3 w-8">
                                                <div className={`w-6 h-6 rounded-md flex items-center justify-center transition-all ${isExpanded ? 'bg-indigo-100 text-indigo-600 rotate-180' : 'bg-gray-100 text-gray-400 group-hover:bg-indigo-50 group-hover:text-indigo-500'}`}>
                                                    <FiChevronDown size={14} />
                                                </div>
                                            </td>
                                            {/* Receipt */}
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <span className="font-black text-indigo-600 text-sm">{sale.receipt_no || '—'}</span>
                                            </td>
                                            {/* DateTime */}
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <div className="font-semibold text-gray-800 text-sm">{sale.sale_date}</div>
                                                <div className="text-[11px] text-gray-400">
                                                    {sale.sale_datetime ? new Date(sale.sale_datetime).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' }) : ''}
                                                </div>
                                            </td>
                                            {/* Customer */}
                                            <td className="px-4 py-3">
                                                <div className="font-semibold text-gray-800 text-sm max-w-[140px] truncate">{sale.customer_name || 'Walk-in'}</div>
                                                {sale.customer_phone && <div className="text-[11px] text-gray-400">{sale.customer_phone}</div>}
                                            </td>
                                            {/* Sales Person */}
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <div className="flex items-center gap-1.5">
                                                    <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center">
                                                        <FiUser size={11} className="text-indigo-600" />
                                                    </div>
                                                    <span className="text-sm text-gray-700 font-medium">{sale.served_by || '—'}</span>
                                                </div>
                                            </td>
                                            {/* Payment */}
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <Badge color={paymentColor(sale.payment_method)}>{sale.payment_method || '—'}</Badge>
                                            </td>
                                            {/* M-Pesa */}
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                {sale.mpesa_code ? (
                                                    <span className="font-mono text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded border border-green-200">{sale.mpesa_code}</span>
                                                ) : <span className="text-gray-300">—</span>}
                                            </td>
                                            {/* Subtotal */}
                                            <td className="px-4 py-3 whitespace-nowrap text-right">
                                                <span className="text-sm text-gray-600">{fmt(sale.subtotal)}</span>
                                            </td>
                                            {/* Discount */}
                                            <td className="px-4 py-3 whitespace-nowrap text-right">
                                                {sale.discount > 0 ? (
                                                    <span className="text-amber-600 font-bold text-sm">-{fmt(sale.discount)}</span>
                                                ) : <span className="text-gray-300">—</span>}
                                            </td>
                                            {/* Total */}
                                            <td className="px-4 py-3 whitespace-nowrap text-right">
                                                <span className="font-black text-gray-900 text-sm">{fmt(sale.total_amount)}</span>
                                            </td>
                                            {/* Status */}
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <Badge color={sale.status === 'Completed' || sale.status === 'Paid' ? 'green' : 'amber'}>
                                                    {sale.status || 'Completed'}
                                                </Badge>
                                            </td>
                                            {/* Actions */}
                                            <td className="px-4 py-3 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                                                <button
                                                    onClick={() => toggleRow(sale.sale_id)}
                                                    className="text-indigo-500 hover:text-indigo-700 font-bold text-xs px-2.5 py-1.5 rounded-lg hover:bg-indigo-50 transition-all flex items-center gap-1">
                                                    {isExpanded ? 'Collapse' : 'View Items'}
                                                </button>
                                            </td>
                                        </tr>

                                        {/* ── EXPANDED ITEMS ROW ── */}
                                        {isExpanded && (
                                            <tr key={`exp-${sale.sale_id}`} className="bg-indigo-50/60">
                                                <td colSpan={12} className="px-6 py-4">
                                                    {isLoadingItems ? (
                                                        <div className="flex items-center gap-2 text-indigo-500 text-sm py-2">
                                                            <div className="w-4 h-4 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
                                                            Loading items...
                                                        </div>
                                                    ) : items.length === 0 ? (
                                                        <p className="text-gray-400 text-sm py-2">No items found for this sale.</p>
                                                    ) : (
                                                        <div>
                                                            <div className="rounded-xl overflow-hidden border border-indigo-100 shadow-sm">
                                                                <table className="w-full text-xs">
                                                                    <thead>
                                                                        <tr className="bg-indigo-600 text-white">
                                                                            <th className="px-4 py-2.5 text-left font-bold">Product Name</th>
                                                                            <th className="px-4 py-2.5 text-center font-bold">Qty</th>
                                                                            <th className="px-4 py-2.5 text-center font-bold">Unit</th>
                                                                            <th className="px-4 py-2.5 text-right font-bold">Unit Price</th>
                                                                            <th className="px-4 py-2.5 text-right font-bold">Cost Price</th>
                                                                            <th className="px-4 py-2.5 text-right font-bold">Discount</th>
                                                                            <th className="px-4 py-2.5 text-right font-bold">Line Total</th>
                                                                            <th className="px-4 py-2.5 text-right font-bold">Profit/Loss</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody className="divide-y divide-indigo-50 bg-white">
                                                                        {items.map((item, i) => {
                                                                            const lineCost = (item.cost_price || 0) * item.quantity;
                                                                            const lineProfit = item.subtotal - lineCost;
                                                                            return (
                                                                                <tr key={item.item_id || i} className="hover:bg-indigo-50/40">
                                                                                    <td className="px-4 py-2.5">
                                                                                        <span className="font-semibold text-gray-800">{item.product_name}</span>
                                                                                    </td>
                                                                                    <td className="px-4 py-2.5 text-center font-bold text-indigo-600">{item.quantity}</td>
                                                                                    <td className="px-4 py-2.5 text-center text-gray-500">{item.selling_unit || 'Pcs'}</td>
                                                                                    <td className="px-4 py-2.5 text-right font-semibold text-gray-800">{fmt(item.unit_price)}</td>
                                                                                    <td className="px-4 py-2.5 text-right text-gray-500">{item.cost_price ? fmt(item.cost_price) : '—'}</td>
                                                                                    <td className="px-4 py-2.5 text-right text-amber-600">{item.discount > 0 ? `-${fmt(item.discount)}` : '—'}</td>
                                                                                    <td className="px-4 py-2.5 text-right font-black text-gray-900">{fmt(item.subtotal)}</td>
                                                                                    <td className="px-4 py-2.5 text-right">
                                                                                        {item.cost_price ? (
                                                                                            <span className={`font-bold ${lineProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                                                                                {lineProfit >= 0 ? '+' : ''}{fmt(lineProfit)}
                                                                                            </span>
                                                                                        ) : <span className="text-gray-300">—</span>}
                                                                                    </td>
                                                                                </tr>
                                                                            );
                                                                        })}
                                                                    </tbody>
                                                                    {/* Item totals footer */}
                                                                    <tfoot>
                                                                        <tr className="bg-indigo-50 border-t-2 border-indigo-200">
                                                                            <td colSpan={4} className="px-4 py-2.5 font-black text-indigo-800 text-xs">
                                                                                RECEIPT SUMMARY · {items.length} item(s) · {items.reduce((s, i) => s + i.quantity, 0)} units
                                                                            </td>
                                                                            <td className="px-4 py-2.5 text-right font-bold text-gray-600 text-xs">
                                                                                Cost: {itemCost > 0 ? fmt(itemCost) : '—'}
                                                                            </td>
                                                                            <td className="px-4 py-2.5 text-right"></td>
                                                                            <td className="px-4 py-2.5 text-right font-black text-gray-900 text-xs">{fmt(sale.total_amount)}</td>
                                                                            <td className="px-4 py-2.5 text-right">
                                                                                {itemProfit !== null && (
                                                                                    <span className={`font-black text-xs ${itemProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                                                                        {itemProfit >= 0 ? '+' : ''}{fmt(itemProfit)}
                                                                                    </span>
                                                                                )}
                                                                            </td>
                                                                        </tr>
                                                                    </tfoot>
                                                                </table>
                                                            </div>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        )}
                                    </>);
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* ── PAGINATION ── */}
                    <div className="flex flex-col md:flex-row items-center justify-between gap-3 px-5 py-4 border-t border-gray-100 bg-gray-50/50">
                        <div className="text-sm text-gray-500">
                            Showing <span className="font-bold text-gray-800">{((page - 1) * pageSize) + 1}</span> – <span className="font-bold text-gray-800">{Math.min(page * pageSize, filtered.length)}</span> of <span className="font-bold text-gray-800">{filtered.length.toLocaleString()}</span> results
                        </div>
                        <div className="flex items-center gap-1.5">
                            <button onClick={() => setPage(1)} disabled={page === 1}
                                className="px-2.5 py-1.5 rounded-lg text-xs font-bold border border-gray-200 disabled:opacity-40 disabled:cursor-not-allowed hover:border-indigo-300 hover:text-indigo-600 transition-all">«</button>
                            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                                className="px-3 py-1.5 rounded-lg text-xs font-bold border border-gray-200 disabled:opacity-40 disabled:cursor-not-allowed hover:border-indigo-300 hover:text-indigo-600 transition-all flex items-center gap-1">
                                <FiChevronLeft size={13} /> Prev
                            </button>
                            {/* Page numbers */}
                            {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                                let p: number;
                                if (totalPages <= 7) p = i + 1;
                                else if (page <= 4) p = i + 1;
                                else if (page >= totalPages - 3) p = totalPages - 6 + i;
                                else p = page - 3 + i;
                                return (
                                    <button key={p} onClick={() => setPage(p)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${p === page ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'border-gray-200 hover:border-indigo-300 hover:text-indigo-600'}`}>
                                        {p}
                                    </button>
                                );
                            })}
                            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                                className="px-3 py-1.5 rounded-lg text-xs font-bold border border-gray-200 disabled:opacity-40 disabled:cursor-not-allowed hover:border-indigo-300 hover:text-indigo-600 transition-all flex items-center gap-1">
                                Next <FiArrowRight size={13} />
                            </button>
                            <button onClick={() => setPage(totalPages)} disabled={page === totalPages}
                                className="px-2.5 py-1.5 rounded-lg text-xs font-bold border border-gray-200 disabled:opacity-40 disabled:cursor-not-allowed hover:border-indigo-300 hover:text-indigo-600 transition-all">»</button>
                        </div>
                        <div className="text-sm text-gray-500">
                            Page <span className="font-bold text-gray-800">{page}</span> of <span className="font-bold text-gray-800">{totalPages}</span>
                        </div>
                    </div>
                </div>

                {/* ── FOOTER TOTALS ── */}
                <div className="bg-gradient-to-r from-indigo-900 to-violet-900 rounded-2xl p-5 text-white shadow-xl">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        <div>
                            <p className="text-indigo-300 text-xs font-bold uppercase tracking-wider mb-1">Total Transactions</p>
                            <p className="text-2xl font-black">{fmtNum(stats.totalTransactions)}</p>
                        </div>
                        <div>
                            <p className="text-indigo-300 text-xs font-bold uppercase tracking-wider mb-1">Gross Sales</p>
                            <p className="text-2xl font-black">{fmt(stats.totalSales)}</p>
                        </div>
                        <div>
                            <p className="text-indigo-300 text-xs font-bold uppercase tracking-wider mb-1">Total Discounts</p>
                            <p className="text-2xl font-black text-amber-300">{fmt(stats.totalDiscount)}</p>
                        </div>
                        <div>
                            <p className="text-indigo-300 text-xs font-bold uppercase tracking-wider mb-1">Net Revenue</p>
                            <p className="text-2xl font-black text-emerald-300">{fmt(stats.totalSales - stats.totalDiscount)}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
