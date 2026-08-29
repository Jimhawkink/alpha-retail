'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Sale {
    sale_id: number;
    receipt_no: string;
    sale_date: string;
    customer_name: string;
    total_amount: number;
    payment_method: string;
    outlet_id: number;
    created_by: string;
}

interface SaleItem {
    item_id: number;
    sale_id: number;
    product_id: number;
    product_name: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
    // UI fields
    returnQty: number;
    selected: boolean;
}

interface ReturnRecord {
    return_id: number;
    return_no: string;
    return_date: string;
    original_sale_id: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    total_amount: number;
    reason: string;
    status: string;
    processed_by: string;
}

const REASONS = ['Wrong Order', 'Quality Issue', 'Overcharge', 'Customer Request', 'Expired Product', 'Damaged Product', 'Double Charge', 'Other'];

// ─── Spinner ──────────────────────────────────────────────────────────────────
const Spinner = ({ cls = 'w-5 h-5' }: { cls?: string }) => (
    <svg className={`${cls} animate-spin`} fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
);

// ─── Main Component ───────────────────────────────────────────────────────────
export default function SalesReturnPage() {

    // User / outlet
    const [userName, setUserName] = useState('Admin');
    const [isCashier, setIsCashier] = useState(false);
    const [outletId, setOutletId] = useState<number | null>(null);

    // Returns history
    const [returns, setReturns] = useState<ReturnRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [historySearch, setHistorySearch] = useState('');
    const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

    // Lookup modal
    const [showLookup, setShowLookup] = useState(false);
    const [step, setStep] = useState<1 | 2>(1);

    // Step 1 — search sales
    const [saleSearch, setSaleSearch] = useState('');
    const [salesList, setSalesList] = useState<Sale[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [dateFilter, setDateFilter] = useState('');
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Step 2 — item selection
    const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
    const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
    const [loadingItems, setLoadingItems] = useState(false);
    const [returnReason, setReturnReason] = useState('Wrong Order');
    const [isProcessing, setIsProcessing] = useState(false);

    // ── Init user & outlet ───────────────────────────────────────────────────
    useEffect(() => {
        try {
            const ud = localStorage.getItem('user');
            if (ud) {
                const p = JSON.parse(ud);
                setUserName(p.name || p.username || 'Admin');
                setIsCashier(['cashier', 'waiter'].includes((p.userType || '').toLowerCase()));
            }
            const od = localStorage.getItem('activeOutlet');
            if (od) { const p = JSON.parse(od); setOutletId(p.outlet_id || null); }
        } catch { /* ignore */ }
    }, []);

    // ── Load return history ──────────────────────────────────────────────────
    const loadReturns = useCallback(async () => {
        setIsLoading(true);
        const { data } = await supabase.from('sales_returns').select('*').order('return_id', { ascending: false });
        setReturns(data || []);
        setIsLoading(false);
    }, []);

    useEffect(() => { loadReturns(); }, [loadReturns]);

    // ── Fetch sales list ─────────────────────────────────────────────────────
    const fetchSales = useCallback(async (query = '', date = '') => {
        setIsSearching(true);
        let q = supabase
            .from('retail_sales')
            .select('sale_id,receipt_no,sale_date,customer_name,total_amount,payment_method,outlet_id,created_by')
            .order('sale_id', { ascending: false })
            .limit(40);
        if (query.trim()) q = q.or(`receipt_no.ilike.%${query.trim()}%,customer_name.ilike.%${query.trim()}%`);
        if (date) q = q.eq('sale_date', date);
        const { data } = await q;
        setSalesList(data || []);
        setIsSearching(false);
    }, []);

    // Debounced search trigger
    useEffect(() => {
        if (!showLookup || step !== 1) return;
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => fetchSales(saleSearch, dateFilter), 350);
    }, [saleSearch, dateFilter, showLookup, step, fetchSales]);

    // ── Open lookup ──────────────────────────────────────────────────────────
    const openLookup = () => {
        setShowLookup(true);
        setStep(1);
        setSaleSearch('');
        setDateFilter('');
        setSalesList([]);
        setSelectedSale(null);
        setSaleItems([]);
        setReturnReason('Wrong Order');
        fetchSales();
    };

    const closeLookup = () => {
        setShowLookup(false);
        setStep(1);
        setSaleSearch('');
        setDateFilter('');
        setSalesList([]);
        setSelectedSale(null);
        setSaleItems([]);
    };

    // ── Select a sale ────────────────────────────────────────────────────────
    const selectSale = useCallback(async (sale: Sale) => {
        setSelectedSale(sale);
        setLoadingItems(true);
        setStep(2);
        const { data } = await supabase
            .from('retail_sales_items')
            .select('item_id,sale_id,product_id,product_name,quantity,unit_price,subtotal')
            .eq('sale_id', sale.sale_id);
        setSaleItems((data || []).map((i: any) => ({ ...i, returnQty: 0, selected: false })));
        setLoadingItems(false);
    }, []);

    // ── Item selection helpers ───────────────────────────────────────────────
    const toggleItem = (item_id: number) => {
        setSaleItems(prev => prev.map(i =>
            i.item_id === item_id
                ? { ...i, selected: !i.selected, returnQty: !i.selected ? i.quantity : 0 }
                : i
        ));
    };

    const setReturnQty = (item_id: number, val: number) => {
        setSaleItems(prev => prev.map(i => {
            if (i.item_id !== item_id) return i;
            const capped = Math.min(Math.max(0, val), i.quantity);
            return { ...i, returnQty: capped, selected: capped > 0 };
        }));
    };

    // ── Generate return number ───────────────────────────────────────────────
    const generateReturnNo = async (): Promise<string> => {
        const { data } = await supabase.from('sales_returns').select('return_no').order('return_id', { ascending: false }).limit(1);
        if (data && data.length > 0) {
            const m = data[0].return_no.match(/SR-(\d+)/);
            if (m) return `SR-${String(parseInt(m[1]) + 1).padStart(4, '0')}`;
        }
        return 'SR-0001';
    };

    // ── Process return ───────────────────────────────────────────────────────
    const processReturn = async () => {
        const toReturn = saleItems.filter(i => i.selected && i.returnQty > 0);
        if (!toReturn.length) { toast.error('Select at least one item with qty > 0'); return; }
        setIsProcessing(true);
        try {
            const returnNo = await generateReturnNo();
            const today = new Date().toISOString().split('T')[0];
            const originalRef = selectedSale?.receipt_no || String(selectedSale?.sale_id);

            const records = toReturn.map(item => ({
                return_no: returnNo,
                return_date: today,
                original_sale_id: originalRef,
                product_name: item.product_name,
                quantity: item.returnQty,
                unit_price: item.unit_price,
                total_amount: Math.round(item.returnQty * item.unit_price),
                reason: returnReason,
                status: 'Completed',
                processed_by: userName,
            }));

            const { error: insErr } = await supabase.from('sales_returns').insert(records);
            if (insErr) throw insErr;

            // Restore stock
            if (outletId) {
                const stockRows = toReturn.filter(i => i.product_id).map(i => ({
                    pid: i.product_id,
                    invoice_no: `RTN-${returnNo}`,
                    qty: i.returnQty,
                    storage_type: 'Pieces',
                    outlet_id: outletId,
                }));
                if (stockRows.length) await supabase.from('retail_stock').insert(stockRows);
            }

            const totalRefund = toReturn.reduce((s, i) => s + i.returnQty * i.unit_price, 0);
            toast.success(`Return ${returnNo} — Ksh ${Math.round(totalRefund).toLocaleString()} refunded`);
            closeLookup();
            loadReturns();
        } catch (err: any) {
            toast.error(`Failed: ${err.message}`);
        } finally {
            setIsProcessing(false);
        }
    };

    // ── Delete return ────────────────────────────────────────────────────────
    const handleDelete = async (id: number) => {
        const { error } = await supabase.from('sales_returns').delete().eq('return_id', id);
        if (error) toast.error('Failed to delete');
        else { toast.success('Return deleted'); loadReturns(); }
        setDeleteConfirmId(null);
    };

    // ── Derived ──────────────────────────────────────────────────────────────
    const totalValue = returns.reduce((s, r) => s + (r.total_amount || 0), 0);
    const todayCount = returns.filter(r => r.return_date === new Date().toISOString().split('T')[0]).length;
    const filteredHistory = returns.filter(r => {
        if (!historySearch) return true;
        const q = historySearch.toLowerCase();
        return r.return_no.toLowerCase().includes(q)
            || r.product_name.toLowerCase().includes(q)
            || (r.original_sale_id || '').toLowerCase().includes(q)
            || (r.reason || '').toLowerCase().includes(q);
    });
    const selectedCount = saleItems.filter(i => i.selected && i.returnQty > 0).length;
    const selectedTotal = saleItems.filter(i => i.selected).reduce((s, i) => s + i.returnQty * i.unit_price, 0);

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div className="space-y-6">

            {/* ── Header ────────────────────────────────────────────────── */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
                        <span className="w-11 h-11 bg-gradient-to-br from-rose-500 to-orange-500 rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-rose-200">
                            ↩
                        </span>
                        Sales Returns
                    </h1>
                    <p className="text-sm text-gray-400 mt-1 ml-14">Browse past sales and process refunds</p>
                </div>
                <button
                    onClick={openLookup}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-rose-500 to-orange-500 text-white rounded-xl font-semibold shadow-lg shadow-rose-200 hover:shadow-xl hover:scale-[1.02] transition-all text-sm"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    Find Sale &amp; Return
                </button>
            </div>

            {/* ── Stats cards ───────────────────────────────────────────── */}
            <div className="grid grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-rose-500 to-orange-500 rounded-2xl p-5 text-white shadow-lg shadow-rose-200/50">
                    <div className="text-3xl mb-1">↩</div>
                    <p className="text-xs font-medium opacity-75 uppercase tracking-wider">Total Returns</p>
                    <p className="text-3xl font-bold mt-1">{returns.length}</p>
                </div>
                <div className="bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl p-5 text-white shadow-lg shadow-violet-200/50">
                    <div className="text-3xl mb-1">💸</div>
                    <p className="text-xs font-medium opacity-75 uppercase tracking-wider">Total Refunded</p>
                    <p className="text-2xl font-bold mt-1">Ksh {totalValue.toLocaleString()}</p>
                </div>
                <div className="bg-gradient-to-br from-sky-500 to-blue-600 rounded-2xl p-5 text-white shadow-lg shadow-sky-200/50">
                    <div className="text-3xl mb-1">📅</div>
                    <p className="text-xs font-medium opacity-75 uppercase tracking-wider">Today</p>
                    <p className="text-3xl font-bold mt-1">{todayCount}</p>
                </div>
            </div>

            {/* ── History table ─────────────────────────────────────────── */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                    <h2 className="font-bold text-gray-800">Returns History</h2>
                    <div className="relative">
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                            value={historySearch}
                            onChange={e => setHistorySearch(e.target.value)}
                            placeholder="Search returns..."
                            className="pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-300 w-56"
                        />
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                {['Return #', 'Date', 'Original Sale', 'Product', 'Qty', 'Refund', 'Reason', 'Status', 'By'].map(h => (
                                    <th key={h} className="text-left py-3 px-4 text-xs font-bold uppercase tracking-wider text-gray-400">{h}</th>
                                ))}
                                {!isCashier && <th className="text-center py-3 px-4 text-xs font-bold uppercase tracking-wider text-gray-400">Action</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr><td colSpan={isCashier ? 9 : 10} className="py-16 text-center text-gray-400">
                                    <div className="flex items-center justify-center gap-2"><Spinner />Loading...</div>
                                </td></tr>
                            ) : filteredHistory.length === 0 ? (
                                <tr><td colSpan={isCashier ? 9 : 10} className="py-20 text-center">
                                    <div className="text-gray-400">
                                        <div className="text-5xl mb-3">📭</div>
                                        <p className="font-semibold text-gray-500">{historySearch ? 'No matching returns' : 'No returns yet'}</p>
                                        <p className="text-sm mt-1">Click &quot;Find Sale &amp; Return&quot; to get started</p>
                                    </div>
                                </td></tr>
                            ) : filteredHistory.map(r => (
                                <tr key={r.return_id} className="border-t border-gray-50 hover:bg-rose-50/30 transition-colors">
                                    <td className="py-3 px-4">
                                        <span className="px-2.5 py-1 bg-rose-100 text-rose-700 rounded-lg font-bold text-xs">{r.return_no}</span>
                                    </td>
                                    <td className="py-3 px-4 text-sm text-gray-600">{new Date(r.return_date).toLocaleDateString('en-GB')}</td>
                                    <td className="py-3 px-4 text-sm font-mono text-gray-500">{r.original_sale_id || '—'}</td>
                                    <td className="py-3 px-4 text-sm font-medium text-gray-800">{r.product_name}</td>
                                    <td className="py-3 px-4 text-sm text-center font-semibold text-gray-700">{r.quantity}</td>
                                    <td className="py-3 px-4 text-right font-bold text-rose-600 text-sm">Ksh {(r.total_amount || 0).toLocaleString()}</td>
                                    <td className="py-3 px-4">
                                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-md text-xs">{r.reason}</span>
                                    </td>
                                    <td className="py-3 px-4 text-center">
                                        <span className="px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">{r.status}</span>
                                    </td>
                                    <td className="py-3 px-4 text-xs text-gray-400">{r.processed_by}</td>
                                    {!isCashier && (
                                        <td className="py-3 px-4 text-center">
                                            {deleteConfirmId === r.return_id ? (
                                                <div className="flex items-center justify-center gap-1">
                                                    <button onClick={() => handleDelete(r.return_id)} className="px-2 py-1 bg-red-500 text-white rounded text-xs font-bold hover:bg-red-600">Yes</button>
                                                    <button onClick={() => setDeleteConfirmId(null)} className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">No</button>
                                                </div>
                                            ) : (
                                                <button onClick={() => setDeleteConfirmId(r.return_id)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                </button>
                                            )}
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ══════════════════════════════════════════════════════════════
                LOOKUP MODAL
            ══════════════════════════════════════════════════════════════ */}
            {showLookup && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">

                        {/* Modal header */}
                        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
                            <div className="flex items-center gap-3">
                                {step === 2 && (
                                    <button
                                        onClick={() => { setStep(1); setSelectedSale(null); setSaleItems([]); }}
                                        className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-500"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                        </svg>
                                    </button>
                                )}
                                <div>
                                    <h2 className="text-lg font-bold text-gray-800">
                                        {step === 1 ? '🔍 Find a Sale to Return' : `↩ Return Items — ${selectedSale?.receipt_no}`}
                                    </h2>
                                    <p className="text-xs text-gray-400 mt-0.5">
                                        {step === 1
                                            ? 'Browse recent sales — search by receipt no. or customer name'
                                            : `${selectedSale?.customer_name || 'Walk-in'} · ${selectedSale?.sale_date ? new Date(selectedSale.sale_date).toLocaleDateString('en-GB') : ''} · Ksh ${(selectedSale?.total_amount || 0).toLocaleString()}`
                                        }
                                    </p>
                                </div>
                            </div>
                            <button onClick={closeLookup} className="p-2 hover:bg-gray-100 rounded-xl text-gray-400 hover:text-gray-600 transition-colors">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* ── STEP 1: Browse / search sales ── */}
                        {step === 1 && (
                            <>
                                {/* Search controls */}
                                <div className="px-6 py-4 border-b border-gray-100 flex gap-3">
                                    <div className="relative flex-1">
                                        <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                        </svg>
                                        <input
                                            autoFocus
                                            value={saleSearch}
                                            onChange={e => setSaleSearch(e.target.value)}
                                            placeholder="Receipt no. or customer name..."
                                            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-300"
                                        />
                                    </div>
                                    <input
                                        type="date"
                                        value={dateFilter}
                                        onChange={e => setDateFilter(e.target.value)}
                                        title="Filter by date"
                                        className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-300 text-gray-600"
                                    />
                                </div>

                                {/* Sales list */}
                                <div className="flex-1 overflow-y-auto px-6 py-3 space-y-2">
                                    {isSearching ? (
                                        <div className="flex items-center justify-center py-16 gap-3 text-gray-400">
                                            <Spinner /> Searching sales...
                                        </div>
                                    ) : salesList.length === 0 ? (
                                        <div className="text-center py-16 text-gray-400">
                                            <div className="text-5xl mb-3">🔍</div>
                                            <p className="font-medium">No sales found</p>
                                            <p className="text-sm">Try different search or pick a date</p>
                                        </div>
                                    ) : salesList.map(sale => (
                                        <button
                                            key={sale.sale_id}
                                            onClick={() => selectSale(sale)}
                                            className="w-full text-left p-4 rounded-2xl border border-gray-100 hover:border-rose-300 hover:bg-rose-50/50 transition-all group flex items-center gap-4"
                                        >
                                            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-rose-100 to-orange-100 flex items-center justify-center text-lg group-hover:from-rose-200 group-hover:to-orange-200 transition-colors flex-shrink-0">
                                                🧾
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="font-bold text-gray-800 text-sm">{sale.receipt_no}</span>
                                                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                                        sale.payment_method === 'MPESA' ? 'bg-green-100 text-green-700'
                                                        : sale.payment_method === 'CREDIT' ? 'bg-orange-100 text-orange-700'
                                                        : 'bg-blue-100 text-blue-700'
                                                    }`}>{sale.payment_method}</span>
                                                </div>
                                                <p className="text-xs text-gray-400 mt-0.5 truncate">
                                                    {sale.customer_name || 'Walk-in'} &middot; {sale.sale_date ? new Date(sale.sale_date).toLocaleDateString('en-GB') : ''}
                                                    {sale.created_by ? ` · ${sale.created_by}` : ''}
                                                </p>
                                            </div>
                                            <div className="text-right flex-shrink-0">
                                                <p className="font-bold text-gray-800">Ksh {(sale.total_amount || 0).toLocaleString()}</p>
                                                <p className="text-xs text-rose-500 font-medium mt-0.5 group-hover:text-rose-600">Select →</p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}

                        {/* ── STEP 2: Select items to return ── */}
                        {step === 2 && (
                            <>
                                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
                                    {loadingItems ? (
                                        <div className="flex items-center justify-center py-16 gap-3 text-gray-400">
                                            <Spinner /> Loading items...
                                        </div>
                                    ) : saleItems.length === 0 ? (
                                        <div className="text-center py-16 text-gray-400">
                                            <div className="text-5xl mb-3">📭</div>
                                            <p className="font-medium">No items found for this sale</p>
                                        </div>
                                    ) : (
                                        <>
                                            <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider pb-2">
                                                Tap item to select · set the return quantity
                                            </p>
                                            {saleItems.map(item => (
                                                <div
                                                    key={item.item_id}
                                                    className={`rounded-2xl border-2 p-4 transition-all ${
                                                        item.selected ? 'border-rose-400 bg-rose-50/60' : 'border-gray-100 bg-white hover:border-gray-200'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-3 flex-wrap">
                                                        {/* Checkbox */}
                                                        <button
                                                            onClick={() => toggleItem(item.item_id)}
                                                            className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                                                                item.selected ? 'bg-rose-500 border-rose-500 text-white' : 'border-gray-300 hover:border-rose-400'
                                                            }`}
                                                        >
                                                            {item.selected && (
                                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                                </svg>
                                                            )}
                                                        </button>

                                                        {/* Product info */}
                                                        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => toggleItem(item.item_id)}>
                                                            <p className="font-semibold text-gray-800 text-sm truncate">{item.product_name}</p>
                                                            <p className="text-xs text-gray-400 mt-0.5">
                                                                Sold: <strong>{item.quantity}</strong> × Ksh {item.unit_price.toLocaleString()}
                                                                {' = '}
                                                                <strong>Ksh {(item.subtotal || item.quantity * item.unit_price).toLocaleString()}</strong>
                                                            </p>
                                                        </div>

                                                        {/* Return qty control */}
                                                        {item.selected && (
                                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                                <span className="text-xs text-gray-500 font-medium hidden sm:block">Return:</span>
                                                                <div className="flex items-center border-2 border-rose-200 rounded-xl overflow-hidden bg-white">
                                                                    <button
                                                                        onClick={() => setReturnQty(item.item_id, item.returnQty - 1)}
                                                                        className="w-8 h-8 flex items-center justify-center text-rose-500 hover:bg-rose-50 font-bold text-lg transition-colors"
                                                                    >−</button>
                                                                    <input
                                                                        type="number"
                                                                        min={0}
                                                                        max={item.quantity}
                                                                        value={item.returnQty}
                                                                        onChange={e => setReturnQty(item.item_id, parseFloat(e.target.value) || 0)}
                                                                        className="w-12 text-center text-sm font-bold text-gray-800 focus:outline-none py-1"
                                                                    />
                                                                    <button
                                                                        onClick={() => setReturnQty(item.item_id, item.returnQty + 1)}
                                                                        className="w-8 h-8 flex items-center justify-center text-rose-500 hover:bg-rose-50 font-bold text-lg transition-colors"
                                                                    >+</button>
                                                                </div>
                                                                <span className="text-xs text-rose-600 font-bold min-w-[64px] text-right">
                                                                    Ksh {Math.round(item.returnQty * item.unit_price).toLocaleString()}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </>
                                    )}
                                </div>

                                {/* Footer: reason + confirm */}
                                {!loadingItems && saleItems.length > 0 && (
                                    <div className="border-t border-gray-100 px-6 py-4 bg-gray-50/60 space-y-3">
                                        <div className="flex items-center gap-3">
                                            <label className="text-sm font-semibold text-gray-600 flex-shrink-0">Reason:</label>
                                            <select
                                                value={returnReason}
                                                onChange={e => setReturnReason(e.target.value)}
                                                className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-300 bg-white"
                                            >
                                                {REASONS.map(r => <option key={r}>{r}</option>)}
                                            </select>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div>
                                                {selectedCount > 0 ? (
                                                    <>
                                                        <p className="text-sm font-semibold text-gray-700">
                                                            {selectedCount} item{selectedCount !== 1 ? 's' : ''} selected
                                                        </p>
                                                        <p className="text-xs text-gray-400 mt-0.5">
                                                            Refund: <span className="font-bold text-rose-600">Ksh {Math.round(selectedTotal).toLocaleString()}</span>
                                                        </p>
                                                    </>
                                                ) : (
                                                    <p className="text-sm text-gray-400">Select items above to return</p>
                                                )}
                                            </div>
                                            <button
                                                onClick={processReturn}
                                                disabled={selectedCount === 0 || isProcessing}
                                                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-rose-500 to-orange-500 text-white rounded-xl font-semibold shadow-md shadow-rose-200 hover:shadow-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
                                            >
                                                {isProcessing ? (
                                                    <><Spinner cls="w-4 h-4" /> Processing...</>
                                                ) : (
                                                    <>
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                        </svg>
                                                        Process Return
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                    </div>
                </div>
            )}
        </div>
    );
}
