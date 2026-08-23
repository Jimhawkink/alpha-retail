'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';
import {
    FiDownload, FiPrinter, FiSearch, FiRefreshCw, FiChevronDown,
    FiFilter, FiX, FiBarChart2, FiUser, FiChevronLeft,
    FiArrowRight, FiFileText
} from 'react-icons/fi';
import { printCustomerReceipt, loadCompanyInfo } from '@/lib/receiptPrinter';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
    `Ksh ${(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtN = (n: number) => (n || 0).toLocaleString('en-KE');
const toDay = () => new Date().toISOString().split('T')[0];
const firstOfMonth = () => { const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0]; };

const PAY_METHODS = ['All', 'Cash', 'M-Pesa', 'Card', 'Credit', 'Split'];
const PAGE_SIZES = [25, 50, 100, 200];

// ─────────────────────────────────────────────────────────────────────────────
// Mini stat chip
// ─────────────────────────────────────────────────────────────────────────────
function Chip({ icon, label, value, bg }: { icon: string; label: string; value: string; bg: string }) {
    return (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs flex-shrink-0 ${bg}`}>
            <span className="text-base leading-none">{icon}</span>
            <div>
                <p className="font-bold uppercase tracking-wide opacity-50 text-[9px] leading-none mb-0.5">{label}</p>
                <p className="font-black text-sm leading-none">{value}</p>
            </div>
        </div>
    );
}

function Bdg({ txt, color }: { txt: string; color: string }) {
    const c: Record<string, string> = {
        green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        blue: 'bg-blue-50 text-blue-700 border-blue-200',
        amber: 'bg-amber-50 text-amber-700 border-amber-200',
        purple: 'bg-purple-50 text-purple-700 border-purple-200',
        gray: 'bg-gray-100 text-gray-600 border-gray-200',
    };
    return <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap ${c[color] || c.gray}`}>{txt || '—'}</span>;
}

// ─────────────────────────────────────────────────────────────────────────────
export default function FullSalesReportPage() {
    const { activeOutlet } = useOutlet();

    // User info
    const [user, setUser] = useState<any>(null);
    const [isCashier, setIsCashier] = useState(false);
    useEffect(() => {
        try {
            const u = JSON.parse(localStorage.getItem('user') || '{}');
            setUser(u);
            setIsCashier(['cashier', 'waiter'].includes((u.userType || u.user_type || '').toLowerCase()));
        } catch { }
    }, []);

    // Filters
    const [dateFrom, setDateFrom] = useState(toDay());
    const [dateTo, setDateTo] = useState(toDay());
    const [search, setSearch] = useState('');
    const [payFilter, setPayFilter] = useState('All');
    const [spFilter, setSpFilter] = useState('');
    const [showFilters, setShowFilters] = useState(false);

    // Data
    const [sales, setSales] = useState<any[]>([]);
    const [itemsMap, setItemsMap] = useState<Record<number, any[]>>({});   // sale_id → items[]
    const [loadingItems, setLoadingItems] = useState<Set<number>>(new Set()); // which rows are loading
    const [loading, setLoading] = useState(false);
    const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

    // Pagination
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);

    // ─────────────────────────────────────────────────────────────────────────
    // Load sales only (items loaded on-demand when chevron clicked)
    // ─────────────────────────────────────────────────────────────────────────
    const loadAll = useCallback(async () => {
        setLoading(true);
        setExpandedRows(new Set());
        setItemsMap({});

        const outletId = activeOutlet?.outlet_id;
        try {
            let salesData: any[] = [];
            if (outletId) {
                const r = await supabase
                    .from('retail_sales')
                    .select('*')
                    .eq('outlet_id', outletId)
                    .gte('sale_date', dateFrom)
                    .lte('sale_date', dateTo)
                    .order('sale_datetime', { ascending: false })
                    .limit(2000);
                if (!r.error) salesData = r.data || [];
            }
            if (!salesData.length) {
                const r2 = await supabase
                    .from('retail_sales')
                    .select('*')
                    .gte('sale_date', dateFrom)
                    .lte('sale_date', dateTo)
                    .order('sale_datetime', { ascending: false })
                    .limit(2000);
                salesData = r2.data || [];
            }
            setSales(salesData);
        } catch (e) { console.error('loadAll error:', e); setSales([]); }
        setLoading(false);
    }, [activeOutlet?.outlet_id, dateFrom, dateTo]);

    useEffect(() => { loadAll(); }, [loadAll]);

    // ─────────────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────────────
    // retail_sales uses `created_by` for salesperson (confirmed by schema)
    const getSP = (s: any) => s.created_by || s.served_by || s.waiter_name || s.cashier_name || '—';

    const payColor = (m: string) => {
        const v = (m || '').toLowerCase();
        if (v === 'cash') return 'green';
        if (v === 'm-pesa' || v === 'mpesa') return 'blue';
        if (v === 'card') return 'purple';
        if (v === 'credit') return 'amber';
        return 'gray';
    };

    // Unique sales persons
    const salesPersons = useMemo(() =>
        [...new Set(sales.map(getSP).filter(s => s !== '—'))].sort(),
        [sales]);

    // Default spFilter to logged-in user on first load
    useEffect(() => {
        if (user && salesPersons.length && !spFilter) {
            const myName = user.name || user.full_name || user.username || '';
            const match = salesPersons.find(sp =>
                sp?.toLowerCase() === myName?.toLowerCase() ||
                sp?.toLowerCase().includes(myName?.toLowerCase())
            );
            if (match) setSpFilter(match);
        }
    }, [user, salesPersons]);

    // ─────────────────────────────────────────────────────────────────────────
    // Filter + Paginate
    // ─────────────────────────────────────────────────────────────────────────
    const filtered = useMemo(() => {
        const q = search.toLowerCase().trim();
        return sales.filter(s => {
            if (q) {
                const hay = [s.receipt_no, s.customer_name, s.customer_phone, getSP(s), s.mpesa_code]
                    .filter(Boolean).join(' ').toLowerCase();
                if (!hay.includes(q)) return false;
            }
            if (payFilter !== 'All') {
                const pm = (s.payment_method || '').toLowerCase();
                if (payFilter === 'M-Pesa') { if (!['m-pesa', 'mpesa'].includes(pm)) return false; }
                else if (pm !== payFilter.toLowerCase()) return false;
            }
            if (spFilter && spFilter !== 'All') {
                if (getSP(s) !== spFilter) return false;
            }
            return true;
        });
    }, [sales, search, payFilter, spFilter]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const paginated = useMemo(() =>
        filtered.slice((page - 1) * pageSize, page * pageSize),
        [filtered, page, pageSize]);

    // ── Stats — cashier cards show 0 for all money values
    const stats = useMemo(() => {
        const txns = filtered.length;
        // Total qty sold — summed from loaded items map
        const totalQty = Object.entries(itemsMap)
            .filter(([sid]) => filtered.find(s => Number(s.sale_id) === Number(sid)))
            .reduce((s, [, items]) => s + items.reduce((q, it) => q + (it.quantity || 0), 0), 0);
        if (isCashier) return { txns, totalQty, revenue: 0, discount: 0, avg: 0, cash: 0, mpesa: 0, card: 0, credit: 0, profit: 0 };
        const revenue = filtered.reduce((s, r) => s + (r.total_amount || 0), 0);
        const discount = filtered.reduce((s, r) => s + (r.discount || 0), 0);
        const avg = txns > 0 ? revenue / txns : 0;
        // Use profit stored directly in retail_sales (confirmed in schema)
        const profit = filtered.reduce((s, r) => s + (r.profit || 0), 0);
        const cash = filtered.filter(r => (r.payment_method || '').toLowerCase() === 'cash').reduce((s, r) => s + (r.total_amount || 0), 0);
        const mpesa = filtered.filter(r => ['m-pesa', 'mpesa'].includes((r.payment_method || '').toLowerCase())).reduce((s, r) => s + (r.total_amount || 0), 0);
        const card = filtered.filter(r => (r.payment_method || '').toLowerCase() === 'card').reduce((s, r) => s + (r.total_amount || 0), 0);
        const credit = filtered.filter(r => (r.payment_method || '').toLowerCase() === 'credit').reduce((s, r) => s + (r.total_amount || 0), 0);
        return { txns, totalQty, revenue, discount, avg, cash, mpesa, card, credit, profit };
    }, [filtered, itemsMap, isCashier]);

    // ── Toggle expand — loads items on-demand (same pattern as purchases page)
    const toggleRow = async (saleId: number) => {
        const id = Number(saleId);
        setExpandedRows(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
        // Load items if not already cached
        if (!itemsMap[id]) {
            setLoadingItems(prev => new Set(prev).add(id));
            try {
                const { data, error } = await supabase
                    .from('retail_sales_items')
                    .select('*')
                    .eq('sale_id', id);
                if (error) console.error('items load error:', error);
                setItemsMap(prev => ({ ...prev, [id]: data || [] }));
            } catch (e) { console.error('items load exception:', e); }
            setLoadingItems(prev => { const s = new Set(prev); s.delete(id); return s; });
        }
    };

    // ── Reprint sale receipt
    const reprintSale = async (sale: any, e: React.MouseEvent) => {
        e.stopPropagation(); // Don't expand row
        const sid = Number(sale.sale_id);
        // Load items if not cached
        let saleItems = itemsMap[sid];
        if (!saleItems) {
            const { data } = await supabase.from('retail_sales_items').select('*').eq('sale_id', sid);
            saleItems = data || [];
            setItemsMap(prev => ({ ...prev, [sid]: saleItems }));
        }
        try {
            const company = await loadCompanyInfo();
            const d = new Date(sale.sale_datetime || sale.sale_date);
            const receiptData = {
                invoiceNo: sale.receipt_no || '—',
                date: d.toLocaleDateString('en-GB'),
                time: d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
                cashier: sale.created_by || sale.salesperson_name || 'Cashier',
                items: saleItems.length > 0
                    ? saleItems.map((it: any) => ({
                        name: it.product_name || 'Item',
                        qty: it.quantity || 1,
                        price: it.unit_price || 0,
                        total: it.subtotal || ((it.unit_price || 0) * (it.quantity || 1))
                    }))
                    : [{ name: '(No item details)', qty: 1, price: sale.total_amount || 0, total: sale.total_amount || 0 }],
                subtotal: sale.subtotal || sale.total_amount || 0,
                discount: sale.discount || 0,
                tax: 0,
                total: sale.total_amount || 0,
                paymentMethod: sale.payment_method || 'CASH',
                amountPaid: sale.amount_paid || sale.total_amount || 0,
                change: sale.change_amount || 0,
                customerName: sale.customer_name || undefined,
                customerPhone: sale.customer_phone || undefined,
                mpesaReceipt: sale.mpesa_code || undefined,
                isPaid: true,
            };
            printCustomerReceipt(receiptData, company);
        } catch (err) { console.error('Reprint error:', err); }
    };

    // ── Export CSV
    const exportCSV = () => {
        const h = ['Receipt', 'Date', 'Time', 'Customer', 'Phone', 'Sales Person',
            'Payment', 'M-Pesa Code', 'Subtotal', 'Discount', 'Total Cost', 'Total', 'Profit', 'Status'];
        const rows = filtered.map(s => [
            s.receipt_no, s.sale_date,
            s.sale_datetime ? new Date(s.sale_datetime).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' }) : '',
            s.customer_name || 'Walk-in', s.customer_phone || '', getSP(s),
            s.payment_method || '', s.mpesa_code || '',
            s.subtotal, s.discount, s.total_cost, s.total_amount, s.profit, s.status || '',
        ]);
        const csv = [h, ...rows].map(r =>
            r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `Sales-Report-${dateFrom}-to-${dateTo}.csv`;
        a.click();
    };

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div className="flex flex-col h-full min-h-0 bg-gray-50" style={{ fontFamily: "'Inter','Segoe UI',system-ui,sans-serif" }}>
            <div className="flex flex-col flex-1 min-h-0 w-full px-4 py-4 gap-3">

                {/* ── HEADER ──────────────────────────────────────────────────── */}
                <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow"
                            style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
                            <FiBarChart2 size={20} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg font-black text-gray-900 leading-tight">Full Sales Report</h1>
                            <p className="text-xs text-gray-400 font-medium">{activeOutlet?.outlet_name || 'Loading...'}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <button onClick={() => setShowFilters(f => !f)}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-bold transition-all ${showFilters ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-gray-200 text-gray-700 hover:border-indigo-300'}`}>
                            <FiFilter size={12} /> Filters
                        </button>
                        <button onClick={loadAll} className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-700 hover:border-indigo-300 transition-all">
                            <FiRefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
                        </button>
                        <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-white shadow"
                            style={{ background: 'linear-gradient(135deg,#059669,#047857)' }}>
                            <FiDownload size={12} /> Export CSV
                        </button>
                        <button onClick={() => window.print()} className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-700 hover:border-indigo-300 transition-all">
                            <FiPrinter size={12} /> Print
                        </button>
                    </div>
                </div>

                {/* ── FILTER BAR ──────────────────────────────────────────────── */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 shrink-0">
                    <div className="flex flex-wrap gap-2 items-end">
                        <div>
                            <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1">📅 From</label>
                            <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }}
                                className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                        </div>
                        <div>
                            <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1">📅 To</label>
                            <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }}
                                className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                        </div>
                        <div className="flex gap-1.5">
                            {([['Today', toDay(), toDay()],
                                ['7D', (() => { const d = new Date(); d.setDate(d.getDate() - 6); return d.toISOString().split('T')[0]; })(), toDay()],
                                ['Month', firstOfMonth(), toDay()]] as [string, string, string][]).map(([l, f, t]) => (
                                <button key={l} onClick={() => { setDateFrom(f); setDateTo(t); setPage(1); }}
                                    className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${dateFrom === f && dateTo === t ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-indigo-300'}`}>
                                    {l}
                                </button>
                            ))}
                        </div>
                        <div className="flex-1 min-w-[180px]">
                            <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1">🔍 Search</label>
                            <div className="relative">
                                <FiSearch size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                                    placeholder="Receipt, customer, phone, M-Pesa..."
                                    className="w-full pl-7 pr-7 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                                {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><FiX size={11} /></button>}
                            </div>
                        </div>
                        {showFilters && (<>
                            <div>
                                <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1">💳 Payment</label>
                                <select value={payFilter} onChange={e => { setPayFilter(e.target.value); setPage(1); }}
                                    className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-400">
                                    {PAY_METHODS.map(m => <option key={m}>{m}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1">👤 Sales Person</label>
                                <select value={spFilter} onChange={e => { setSpFilter(e.target.value); setPage(1); }}
                                    className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-400">
                                    <option value="">All</option>
                                    {salesPersons.map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                            </div>
                        </>)}
                    </div>
                </div>

                {/* ── STAT CHIPS ──────────────────────────────────────────────── */}
                <div className="flex flex-wrap gap-2 shrink-0">
                    <Chip icon="🛒" label="Transactions" value={fmtN(stats.txns)} bg="bg-indigo-50 text-indigo-800 border-indigo-100" />
                    <Chip icon="📦" label="Qty Sold" value={fmtN(stats.totalQty)} bg="bg-sky-50 text-sky-800 border-sky-100" />
                    <Chip icon="💰" label="Total Sales" value={isCashier ? 'Ksh 0.00' : fmt(stats.revenue)} bg="bg-emerald-50 text-emerald-800 border-emerald-100" />
                    <Chip icon="🏷️" label="Discounts" value={isCashier ? 'Ksh 0.00' : fmt(stats.discount)} bg="bg-amber-50 text-amber-800 border-amber-100" />
                    <Chip icon="📊" label="Avg Sale" value={isCashier ? 'Ksh 0.00' : fmt(stats.avg)} bg="bg-blue-50 text-blue-800 border-blue-100" />
                    <Chip icon="💵" label="Cash" value={isCashier ? 'Ksh 0.00' : fmt(stats.cash)} bg="bg-green-50 text-green-800 border-green-100" />
                    <Chip icon="📱" label="M-Pesa" value={isCashier ? 'Ksh 0.00' : fmt(stats.mpesa)} bg="bg-rose-50 text-rose-800 border-rose-100" />
                    <Chip icon="💳" label="Card" value={isCashier ? 'Ksh 0.00' : fmt(stats.card)} bg="bg-purple-50 text-purple-800 border-purple-100" />
                    <Chip icon="🧾" label="Credit" value={isCashier ? 'Ksh 0.00' : fmt(stats.credit)} bg="bg-orange-50 text-orange-800 border-orange-100" />
                    <Chip icon="📈" label="Profit" value={isCashier ? 'Ksh 0.00' : fmt(stats.profit)}
                        bg={isCashier ? 'bg-gray-50 text-gray-500 border-gray-100' : stats.profit >= 0 ? 'bg-teal-50 text-teal-800 border-teal-100' : 'bg-red-50 text-red-800 border-red-100'} />
                </div>

                {/* ── TABLE ───────────────────────────────────────────────────── */}
                <div className="flex flex-col flex-1 min-h-0 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">

                    {/* Toolbar */}
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 shrink-0">
                        <span className="text-xs font-bold text-gray-600">
                            {loading
                                ? <span className="text-indigo-500 animate-pulse">Loading...</span>
                                : <>{fmtN(filtered.length)} record{filtered.length !== 1 ? 's' : ''}
                                    {filtered.length !== sales.length && <span className="text-gray-400 font-normal"> of {fmtN(sales.length)}</span>}
                                </>}
                        </span>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] text-gray-400 font-bold">Rows:</span>
                            <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
                                className="border border-gray-200 rounded-lg px-2 py-1 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-400">
                                {PAGE_SIZES.map(s => <option key={s}>{s}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Scrollable table */}
                    <div className="overflow-auto flex-1">
                        <table className="w-full text-xs border-collapse">
                            <thead className="sticky top-0 z-10">
                                <tr style={{ background: 'linear-gradient(135deg,#1e1b4b,#312e81)' }}>
                                    {['', 'Receipt No', 'Date', 'Time', 'Customer', 'Sales Person', 'Payment', 'M-Pesa Code', 'Qty', 'Cost', 'Sales Price', 'Total', 'Profit', 'Status'].map(h => (
                                        <th key={h} className="px-3 py-2.5 text-left text-[10px] font-black text-indigo-200 uppercase tracking-wider whitespace-nowrap">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={14} className="py-20 text-center">
                                        <div className="w-8 h-8 border-[3px] border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-2" />
                                        <p className="text-gray-400 text-xs">Loading sales data...</p>
                                    </td></tr>
                                ) : paginated.length === 0 ? (
                                    <tr><td colSpan={14} className="py-20 text-center">
                                        <FiFileText size={28} className="mx-auto text-gray-300 mb-2" />
                                        <p className="text-gray-500 font-bold text-sm">No sales found</p>
                                        <p className="text-gray-400 text-xs mt-1">Adjust your filters or date range</p>
                                    </td></tr>
                                ) : paginated.map((sale, idx) => {
                                    const sid = Number(sale.sale_id);
                                    const isExp = expandedRows.has(sid);
                                    const items: any[] = itemsMap[sid] || [];
                                    const rowQty = items.reduce((s, it) => s + (it.quantity || 0), 0);
                                    const rowBg = idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60';

                                    return (
                                        <>
                                            <tr key={sid}
                                                className={`${rowBg} hover:bg-indigo-50/40 cursor-pointer transition-colors border-b border-gray-50`}
                                                onClick={() => toggleRow(sid)}>
                                                <td className="pl-3 pr-1 py-2.5 w-7">
                                                    <FiChevronDown size={13} className={`transition-transform duration-200 ${isExp ? 'rotate-180 text-indigo-500' : 'text-gray-300'}`} />
                                                </td>
                                                <td className="px-3 py-2.5 whitespace-nowrap font-black text-indigo-600">{sale.receipt_no || '—'}</td>
                                                <td className="px-3 py-2.5 whitespace-nowrap font-medium text-gray-700">{sale.sale_date}</td>
                                                <td className="px-3 py-2.5 whitespace-nowrap text-gray-500">
                                                    {sale.sale_datetime ? new Date(sale.sale_datetime).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' }) : sale.sale_time || '—'}
                                                </td>
                                                <td className="px-3 py-2.5 max-w-[130px]">
                                                    <div className="font-semibold text-gray-800 truncate">{sale.customer_name || 'Walk-in'}</div>
                                                    {sale.customer_phone && <div className="text-[10px] text-gray-400">{sale.customer_phone}</div>}
                                                </td>
                                                <td className="px-3 py-2.5 whitespace-nowrap">
                                                    <div className="flex items-center gap-1">
                                                        <FiUser size={9} className="text-indigo-300 shrink-0" />
                                                        <span className="text-gray-700 truncate max-w-[90px]">{getSP(sale)}</span>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-2.5 whitespace-nowrap">
                                                    <Bdg txt={sale.payment_method} color={payColor(sale.payment_method)} />
                                                </td>
                                                <td className="px-3 py-2.5 whitespace-nowrap">
                                                    {sale.mpesa_code
                                                        ? <span className="font-mono text-[10px] bg-green-50 text-green-700 px-1.5 py-0.5 rounded border border-green-200">{sale.mpesa_code}</span>
                                                        : <span className="text-gray-300">—</span>}
                                                </td>
                                                <td className="px-3 py-2.5 whitespace-nowrap text-center">
                                                    {rowQty > 0
                                                        ? <span className="font-black text-sky-700 bg-sky-50 px-2 py-0.5 rounded-full text-[10px] border border-sky-200">{fmtN(rowQty)}</span>
                                                        : <span className="text-gray-300">—</span>}
                                                </td>
                                                <td className="px-3 py-2.5 whitespace-nowrap text-right text-gray-500">{fmt(sale.total_cost)}</td>
                                                <td className="px-3 py-2.5 whitespace-nowrap text-right text-gray-600">{fmt(sale.subtotal)}</td>
                                                <td className="px-3 py-2.5 whitespace-nowrap text-right font-black text-gray-900">{fmt(sale.total_amount)}</td>
                                                <td className="px-3 py-2.5 whitespace-nowrap text-right">
                                                    {isCashier ? (
                                                        <span className="text-gray-400 font-bold text-xs">0</span>
                                                    ) : ((sale.profit !== null && sale.profit !== undefined) && (
                                                        <span className={`font-bold text-xs ${(sale.profit || 0) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                                            {(sale.profit || 0) >= 0 ? '+' : ''}{fmt(sale.profit)}
                                                        </span>
                                                    ))}
                                                </td>
                                                <td className="px-2 py-2.5 whitespace-nowrap">
                                                    <div className="flex items-center gap-1.5">
                                                        <Bdg txt={sale.status || 'Completed'} color={['Completed', 'Paid'].includes(sale.status) ? 'green' : 'amber'} />
                                                        <button
                                                            onClick={(e) => reprintSale(sale, e)}
                                                            title="Reprint Invoice"
                                                            className="p-1 rounded-lg hover:bg-indigo-100 text-indigo-400 hover:text-indigo-700 transition-colors"
                                                        >
                                                            <FiPrinter size={13} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>

                                            {/* ── EXPANDED: Invoice Items ────────────────────────────── */}
                                            {isExp && (
                                                <tr key={`items-${sid}`}>
                                                    <td colSpan={14} className="px-5 py-3 bg-gradient-to-r from-indigo-50/60 to-violet-50/40 border-b border-indigo-100">
                                                        {loadingItems.has(sid) ? (
                                                            <div className="flex items-center gap-2 py-2">
                                                                <div className="w-4 h-4 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
                                                                <span className="text-indigo-500 text-xs">Loading items...</span>
                                                            </div>
                                                        ) : items.length === 0 ? (
                                                            <p className="text-gray-400 text-xs italic py-1 flex items-center gap-1.5">
                                                                <span>⚠️</span> No item details found for this invoice. Make a new sale to see items here.
                                                            </p>
                                                        ) : (
                                                            <div className="rounded-lg overflow-hidden border border-indigo-100 shadow-sm">
                                                                <table className="w-full text-xs">
                                                                    <thead>
                                                                        <tr className="bg-indigo-600 text-white">
                                                                            <th className="px-3 py-2 text-left font-bold">#</th>
                                                                            <th className="px-3 py-2 text-left font-bold">Product Name</th>
                                                                            <th className="px-3 py-2 text-center font-bold">Qty</th>
                                                                            <th className="px-3 py-2 text-right font-bold">Cost</th>
                                                                            <th className="px-3 py-2 text-right font-bold">Sales Price</th>
                                                                            <th className="px-3 py-2 text-right font-bold">Profit</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody className="divide-y divide-gray-100 bg-white">
                                                                        {items.map((it, i) => {
                                                                            const qty = it.quantity || 0;
                                                                            const profit = it.profit || 0;
                                                                            return (
                                                                                <tr key={it.item_id || i} className="hover:bg-indigo-50/30">
                                                                                    <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                                                                                    <td className="px-3 py-2 font-semibold text-gray-800">{it.product_name}</td>
                                                                                    <td className="px-3 py-2 text-center font-bold text-indigo-600">{qty}</td>
                                                                                    <td className="px-3 py-2 text-right text-gray-600">{(it.cost_price || 0) > 0 ? fmt(it.cost_price) : <span className="text-gray-300">—</span>}</td>
                                                                                    <td className="px-3 py-2 text-right font-semibold text-gray-800">{fmt(it.unit_price)}</td>
                                                                                    <td className="px-3 py-2 text-right">
                                                                                        <span className={`font-bold ${isCashier ? 'text-gray-400' : profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                                                                            {isCashier ? '0' : (profit >= 0 ? '+' : '') + fmt(profit)}
                                                                                        </span>
                                                                                    </td>
                                                                                </tr>
                                                                            );
                                                                        })}
                                                                    </tbody>
                                                                    <tfoot>
                                                                        <tr className="bg-indigo-50 border-t-2 border-indigo-200 font-black text-xs">
                                                                            <td className="px-3 py-2 text-indigo-700" colSpan={2}>
                                                                                TOTAL · {items.length} item{items.length !== 1 ? 's' : ''}
                                                                            </td>
                                                                            <td className="px-3 py-2 text-center text-indigo-700">
                                                                                {items.reduce((s, it) => s + (it.quantity || 0), 0)}
                                                                            </td>
                                                                            <td className="px-3 py-2 text-right text-gray-600">
                                                                                {fmt(items.reduce((s, it) => s + (it.cost_price || 0) * (it.quantity || 0), 0))}
                                                                            </td>
                                                                            <td className="px-3 py-2 text-right text-gray-900">{fmt(sale.total_amount)}</td>
                                                                            <td className="px-3 py-2 text-right">
                                                                                {!isCashier && (
                                                                                    <span className={`font-black ${(sale.profit || 0) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                                                                        {(sale.profit || 0) >= 0 ? '+' : ''}{fmt(sale.profit)}
                                                                                    </span>
                                                                                )}
                                                                            </td>
                                                                        </tr>
                                                                    </tfoot>
                                                                </table>
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            )}
                                        </>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* ── PAGINATION ──────────────────────────────────────────── */}
                    <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-t border-gray-100 bg-gray-50/50 shrink-0 text-xs">
                        <span className="text-gray-500">
                            Showing <b>{Math.min((page - 1) * pageSize + 1, Math.max(1, filtered.length))}</b>–<b>{Math.min(page * pageSize, filtered.length)}</b> of <b>{fmtN(filtered.length)}</b>
                        </span>
                        <div className="flex items-center gap-1">
                            <button onClick={() => setPage(1)} disabled={page === 1} className="px-2 py-1 rounded border border-gray-200 disabled:opacity-30 hover:border-indigo-300 font-bold text-[10px]">«</button>
                            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-2 py-1 rounded border border-gray-200 disabled:opacity-30 hover:border-indigo-300 font-bold text-[10px] flex items-center gap-0.5"><FiChevronLeft size={10} />Prev</button>
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                const p = totalPages <= 5 ? i + 1 : page <= 3 ? i + 1 : page >= totalPages - 2 ? totalPages - 4 + i : page - 2 + i;
                                return <button key={p} onClick={() => setPage(p)} className={`px-2.5 py-1 rounded border font-bold text-[10px] transition-all ${p === page ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 hover:border-indigo-300'}`}>{p}</button>;
                            })}
                            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-2 py-1 rounded border border-gray-200 disabled:opacity-30 hover:border-indigo-300 font-bold text-[10px] flex items-center gap-0.5">Next<FiArrowRight size={10} /></button>
                            <button onClick={() => setPage(totalPages)} disabled={page === totalPages} className="px-2 py-1 rounded border border-gray-200 disabled:opacity-30 hover:border-indigo-300 font-bold text-[10px]">»</button>
                        </div>
                        {!isCashier && (
                            <div className="flex items-center gap-3">
                                <span className="text-gray-500">Revenue: <b className="text-gray-800">{fmt(stats.revenue)}</b></span>
                                <span className="text-amber-600">Disc: <b>-{fmt(stats.discount)}</b></span>
                                <span className={stats.profit >= 0 ? 'text-emerald-600' : 'text-red-500'}>Profit: <b>{fmt(stats.profit)}</b></span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
