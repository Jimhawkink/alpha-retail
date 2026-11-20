'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';
import toast, { Toaster } from 'react-hot-toast';
import {
    FiShoppingBag,
    FiRefreshCw,
    FiSearch,
    FiFilter,
    FiCalendar,
    FiChevronLeft,
    FiChevronRight,
    FiChevronsLeft,
    FiChevronsRight,
    FiX,
    FiEye,
    FiTrash2,
    FiTruck,
    FiDollarSign,
    FiCheckCircle,
    FiClock,
    FiAlertTriangle,
    FiDownload,
    FiPlus,
    FiTrendingUp,
    FiPackage,
    FiPrinter,
    FiFileText,
    FiChevronDown,
    FiChevronUp,
    FiLayers,
    FiShield,
    FiPieChart,
    FiZap,
    FiActivity,
    FiSliders,
    FiArrowLeft
} from 'react-icons/fi';

/* ══════════════════════════════════════════════════════════════════════════════
   TYPES & EXECUTIVE FORMATTERS
   ══════════════════════════════════════════════════════════════════════════════ */
interface Purchase {
    purchase_id: number;
    purchase_no: string;
    purchase_date: string;
    supplier_id: number;
    supplier_name: string;
    supplier_invoice: string;
    sub_total: number;
    discount: number;
    vat: number;
    grand_total: number;
    status: string;
    payment_status: string;
    created_by: string;
    created_at: string;
}

interface PurchaseItem {
    pp_id: number;
    product_id: number;
    product_code: string;
    product_name: string;
    quantity: number;
    unit: string;
    rate: number;
    total_amount: number;
    bag_qty?: number;
    piece_qty?: number;
    batch_number?: string;
    expiry_date?: string;
}

interface Supplier {
    supplier_id: number;
    supplier_name: string;
}

const fmtKES = (n: number) => `Ksh ${Math.round(n || 0).toLocaleString('en-KE')}`;
const fmtK = (n: number) => {
    if (n >= 1_000_000) return `Ksh ${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000) return `Ksh ${(n / 1_000).toFixed(1)}K`;
    return `Ksh ${Math.round(n || 0).toLocaleString('en-KE')}`;
};

export default function PurchasesPage() {
    const { activeOutlet } = useOutlet();
    const outletId = activeOutlet?.outlet_id || 1;
    const expiryEnabled = !!(activeOutlet as any)?.enable_expiry_tracking;

    // Workspace Active Tab
    const [activeTab, setActiveTab] = useState<'invoices' | 'analytics' | 'suppliers' | 'inflow'>('invoices');

    // Data State
    const [purchases, setPurchases] = useState<Purchase[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Filter Controls
    const [searchQuery, setSearchQuery] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [filterSupplier, setFilterSupplier] = useState('All');
    const [filterStatus, setFilterStatus] = useState<'All' | 'Completed' | 'Pending' | 'Cancelled'>('All');
    const [filterPayment, setFilterPayment] = useState<'All' | 'Paid' | 'Unpaid' | 'Partial'>('All');

    // Pagination
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(20);

    // Expandable Rows
    const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
    const [rowItems, setRowItems] = useState<Record<number, PurchaseItem[]>>({});
    const [loadingRows, setLoadingRows] = useState<Set<number>>(new Set());
    const searchInputRef = useRef<HTMLInputElement>(null);

    // ─── DATA LOADING ───
    const loadPurchases = useCallback(async () => {
        if (!activeOutlet) return;
        setIsLoading(true);
        try {
            let query = supabase
                .from('retail_purchases')
                .select('*')
                .eq('outlet_id', outletId)
                .order('purchase_id', { ascending: false });

            if (dateFrom) query = query.gte('purchase_date', dateFrom);
            if (dateTo) query = query.lte('purchase_date', dateTo);

            let { data, error } = await query;
            if (error || (data && data.length === 0)) {
                let fb = supabase.from('retail_purchases').select('*').order('purchase_id', { ascending: false });
                if (dateFrom) fb = fb.gte('purchase_date', dateFrom);
                if (dateTo) fb = fb.lte('purchase_date', dateTo);
                const r2 = await fb;
                if (r2.data && r2.data.length > 0) data = r2.data;
            }
            setPurchases(data || []);
        } catch {
            toast.error('Failed to load purchases');
        }
        setIsLoading(false);
    }, [activeOutlet, outletId, dateFrom, dateTo]);

    const loadSuppliers = useCallback(async () => {
        try {
            const { data } = await supabase
                .from('retail_suppliers')
                .select('supplier_id, supplier_name')
                .eq('active', true)
                .order('supplier_name');
            setSuppliers(data || []);
        } catch {
            /* silent */
        }
    }, []);

    useEffect(() => {
        loadPurchases();
        loadSuppliers();
    }, [loadPurchases, loadSuppliers]);

    // Keyboard shortcut for search
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
                e.preventDefault();
                searchInputRef.current?.focus();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // ─── EXPAND ROW ───
    const toggleRow = async (purchaseId: number) => {
        const newExpanded = new Set(expandedRows);
        if (newExpanded.has(purchaseId)) {
            newExpanded.delete(purchaseId);
            setExpandedRows(newExpanded);
            return;
        }
        newExpanded.add(purchaseId);
        setExpandedRows(newExpanded);

        // Load items if not cached
        if (!rowItems[purchaseId]) {
            setLoadingRows(prev => new Set(prev).add(purchaseId));
            try {
                const { data, error } = await supabase
                    .from('retail_purchase_products')
                    .select('*')
                    .eq('purchase_id', purchaseId);
                if (error) throw error;
                setRowItems(prev => ({ ...prev, [purchaseId]: data || [] }));
            } catch {
                toast.error('Failed to load purchase items');
            }
            setLoadingRows(prev => {
                const n = new Set(prev);
                n.delete(purchaseId);
                return n;
            });
        }
    };

    // ─── ACTIONS ───
    const deletePurchase = async (purchase: Purchase) => {
        if (!confirm(`Delete purchase ${purchase.purchase_no}? This will also delete all items and reverse stock.`)) return;
        try {
            const hasId = !!(purchase.purchase_id && purchase.purchase_id !== null);

            // Step 1: Load purchase items
            let items: any[] = [];
            try {
                const q = supabase.from('retail_purchase_products').select('product_id, quantity, bag_qty, piece_qty');
                const { data, error } = hasId ? await q.eq('purchase_id', purchase.purchase_id) : await q.eq('purchase_no', purchase.purchase_no);
                if (error) throw error;
                items = data || [];
            } catch {
                const q = supabase.from('retail_purchase_products').select('product_id, quantity');
                const { data, error } = hasId ? await q.eq('purchase_id', purchase.purchase_id) : await q.eq('purchase_no', purchase.purchase_no);
                if (error) throw new Error('Load items: ' + error.message);
                items = data || [];
            }

            // Step 2: Reverse stock (ledger — insert negative rows)
            for (const item of items) {
                const bagQty   = Number(item.bag_qty)   || 0;
                const pieceQty = Number(item.piece_qty) || 0;
                const totalQty = Number(item.quantity)  || 0;

                if (bagQty > 0 || pieceQty > 0) {
                    if (bagQty > 0) {
                        await supabase.from('retail_stock').insert({
                            pid: item.product_id,
                            outlet_id: outletId,
                            invoice_no: `DEL-${purchase.purchase_no}`,
                            qty: -bagQty,
                            storage_type: 'Bags',
                            notes: `Purchase ${purchase.purchase_no} deleted`,
                        });
                    }
                    if (pieceQty > 0) {
                        await supabase.from('retail_stock').insert({
                            pid: item.product_id,
                            outlet_id: outletId,
                            invoice_no: `DEL-${purchase.purchase_no}`,
                            qty: -pieceQty,
                            storage_type: 'Pieces',
                            notes: `Purchase ${purchase.purchase_no} deleted`,
                        });
                    }
                } else {
                    const { error: stockErr } = await supabase.from('retail_stock').insert({
                        pid: item.product_id,
                        outlet_id: outletId,
                        invoice_no: `DEL-${purchase.purchase_no}`,
                        qty: -totalQty,
                        storage_type: 'Store',
                        notes: `Purchase ${purchase.purchase_no} deleted`,
                    });
                    if (stockErr) throw new Error('Stock reversal: ' + stockErr.message);
                }
            }

            // Step 3: Delete purchase items
            const delItemsQ = supabase.from('retail_purchase_products').delete();
            const { error: delItemsErr } = hasId
                ? await delItemsQ.eq('purchase_id', purchase.purchase_id)
                : await delItemsQ.eq('purchase_no', purchase.purchase_no);
            if (delItemsErr) throw new Error('Delete items: ' + delItemsErr.message);

            // Step 4: Delete the purchase record
            const delQ = supabase.from('retail_purchases').delete();
            const { error: delErr } = hasId
                ? await delQ.eq('purchase_id', purchase.purchase_id)
                : await delQ.eq('purchase_no', purchase.purchase_no);
            if (delErr) throw new Error('Delete purchase: ' + delErr.message);

            toast.success('✅ Purchase order deleted & stock reversed');
            loadPurchases();
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Unknown error';
            console.error('Delete purchase error:', msg);
            toast.error('Failed to delete purchase: ' + msg);
        }
    };

    const exportPurchases = () => {
        const headers = ['Purchase No,Date,Supplier,Invoice,Sub Total,Discount,Grand Total,Status,Payment'];
        const rows = filtered.map(p => `${p.purchase_no},${p.purchase_date},${p.supplier_name || ''},${p.supplier_invoice || ''},${p.sub_total},${p.discount || 0},${p.grand_total},${p.status || ''},${p.payment_status || ''}`);
        const csv = headers.concat(rows).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `purchases_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Exported successfully!');
    };

    const printPurchaseDetail = (purchase: Purchase, items: PurchaseItem[]) => {
        const html = `<!DOCTYPE html><html><head><style>
            @page{margin:10mm;}body{font-family:'Segoe UI',Arial,sans-serif;font-size:12px;color:#1e293b;}h1{font-size:18px;text-align:center;margin-bottom:4px;font-weight:900;}
            .info{display:flex;justify-content:space-between;margin:8px 0;}.info span{font-size:11px;}.info b{font-size:12px;}
            table{width:100%;border-collapse:collapse;margin-top:10px;}th,td{border:1px solid #cbd5e1;padding:6px 8px;font-size:11px;}
            th{background:#f1f5f9;font-weight:bold;text-align:left;text-transform:uppercase;font-size:10px;}.right{text-align:right;}.total{font-size:14px;font-weight:bold;text-align:right;margin-top:8px;}
        </style></head><body>
        <h1>PURCHASE ORDER — ${purchase.purchase_no}</h1>
        <div class="info"><span>Supplier: <b>${purchase.supplier_name || 'N/A'}</b></span><span>Date: <b>${new Date(purchase.purchase_date).toLocaleDateString('en-GB')}</b></span></div>
        <div class="info"><span>Invoice Ref: <b>${purchase.supplier_invoice || 'N/A'}</b></span><span>Payment Status: <b>${purchase.payment_status || 'N/A'}</b></span></div>
        <table><thead><tr><th>#</th><th>Code</th><th>Product</th><th>Unit</th><th class="right">Bags</th><th class="right">Pcs</th><th class="right">Rate</th><th class="right">Total</th><th>Batch</th><th>Expiry</th></tr></thead>
        <tbody>${items.map((item, i) => `<tr><td>${i + 1}</td><td>${item.product_code}</td><td>${item.product_name}</td><td>${item.unit}</td><td class="right">${item.bag_qty || '—'}</td><td class="right">${item.piece_qty || '—'}</td><td class="right">Ksh ${item.rate?.toLocaleString()}</td><td class="right">Ksh ${item.total_amount?.toLocaleString()}</td><td>${item.batch_number || '—'}</td><td>${item.expiry_date ? new Date(item.expiry_date).toLocaleDateString('en-GB') : '—'}</td></tr>`).join('')}</tbody></table>
        <p class="total">Grand Total: Ksh ${purchase.grand_total.toLocaleString()}</p>
        </body></html>`;
        const iframe = document.createElement('iframe');
        iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:none;';
        document.body.appendChild(iframe);
        const doc = iframe.contentWindow?.document;
        if (doc) {
            doc.open();
            doc.write(html);
            doc.close();
            setTimeout(() => {
                iframe.contentWindow?.print();
                setTimeout(() => document.body.removeChild(iframe), 2000);
            }, 500);
        }
    };

    const clearFilters = () => {
        setSearchQuery('');
        setDateFrom('');
        setDateTo('');
        setFilterSupplier('All');
        setFilterStatus('All');
        setFilterPayment('All');
        setPage(1);
    };

    // ─── COMPUTED METRICS ───
    const filtered = useMemo(() => {
        return purchases.filter(p => {
            const q = searchQuery.toLowerCase();
            const matchSearch =
                !q ||
                p.purchase_no?.toLowerCase().includes(q) ||
                p.supplier_name?.toLowerCase().includes(q) ||
                p.supplier_invoice?.toLowerCase().includes(q);
            const matchSupplier = filterSupplier === 'All' || p.supplier_name === filterSupplier;
            const matchStatus = filterStatus === 'All' || p.status === filterStatus;
            const matchPayment = filterPayment === 'All' || p.payment_status === filterPayment;
            return matchSearch && matchSupplier && matchStatus && matchPayment;
        });
    }, [purchases, searchQuery, filterSupplier, filterStatus, filterPayment]);

    const totalPages = Math.ceil(filtered.length / perPage);
    const paginated = filtered.slice((page - 1) * perPage, page * perPage);

    const totalAmount = filtered.reduce((s, p) => s + (p.grand_total || 0), 0);
    const paidCount = filtered.filter(p => p.payment_status === 'Paid').length;
    const pendingCount = filtered.filter(p => p.payment_status !== 'Paid').length;
    const unpaidBalance = filtered.filter(p => p.payment_status !== 'Paid').reduce((s, p) => s + (p.grand_total || 0), 0);

    const thisMonth = filtered.filter(p => {
        const d = new Date(p.purchase_date);
        const n = new Date();
        return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
    });
    const thisMonthTotal = thisMonth.reduce((s, p) => s + (p.grand_total || 0), 0);
    const uniqueSuppliers = Array.from(new Set(filtered.map(p => p.supplier_name).filter((n): n is string => !!n)));

    // Analytics Breakdown by Supplier
    const supplierSpending = useMemo(() => {
        const map: Record<string, { total: number; count: number }> = {};
        filtered.forEach(p => {
            const name = p.supplier_name || 'General / Unknown';
            if (!map[name]) map[name] = { total: 0, count: 0 };
            map[name].total += p.grand_total || 0;
            map[name].count += 1;
        });
        return Object.entries(map)
            .map(([name, data]) => ({
                name,
                total: data.total,
                count: data.count,
                pct: totalAmount > 0 ? (data.total / totalAmount) * 100 : 0
            }))
            .sort((a, b) => b.total - a.total);
    }, [filtered, totalAmount]);

    return (
        <div className="-mt-2 sm:-mt-3.5 space-y-2.5 pb-10 text-slate-800" style={{ fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>
            <Toaster position="top-right" />

            {/* ══════════════════════════════════════════════════════════════
                1. COMPACT EXECUTIVE COMMAND HEADER (MATCHING APSIMS STUDIO)
            ══════════════════════════════════════════════════════════════ */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-3 sm:p-3.5 shadow-xs">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    {/* Left: Branding, Outlet Pill & Status Badges */}
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 font-black text-lg shrink-0">
                            ⚡
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h1 className="text-base font-extrabold text-slate-900 tracking-tight">
                                    Procurement &amp; Purchases Studio
                                </h1>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/80">
                                    🏪 {activeOutlet?.outlet_name || 'Main Store'} · Outlet #{outletId}
                                </span>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                                    {filtered.length} Invoices Active
                                </span>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200/80">
                                    Dual-Stock Inflow (FIFO)
                                </span>
                            </div>
                            <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                                Real-time vendor procurement tracking · Ledger reversals · Dual inventory allocation
                            </p>
                        </div>
                    </div>

                    {/* Right: Studio Shortcuts & Direct Actions */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <Link
                            href="/dashboard/purchase"
                            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-black shadow-xs flex items-center gap-1.5 transition cursor-pointer"
                        >
                            <FiPlus size={14} />
                            <span>New Purchase Entry</span>
                        </Link>

                        <button
                            onClick={exportPurchases}
                            className="px-3 py-1.5 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-extrabold flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
                            title="Export filtered purchases to CSV"
                        >
                            <FiDownload size={13} className="text-emerald-700" />
                            <span>Export CSV</span>
                        </button>

                        <button
                            onClick={() => { loadPurchases(); loadSuppliers(); }}
                            disabled={isLoading}
                            title="Refresh Invoices"
                            className="p-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 transition cursor-pointer"
                        >
                            <FiRefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </div>
            </div>

            {/* ══════════════════════════════════════════════════════════════
                2. STANDALONE ULTRA-PREMIUM WORKSPACE TAB BAR
            ══════════════════════════════════════════════════════════════ */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-1.5 print:hidden">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex gap-1.5 flex-wrap items-center">
                        {[
                            { id: 'invoices', label: 'Purchase Invoices', icon: '⚡', count: filtered.length, badge: '' },
                            { id: 'analytics', label: 'Vendor Spending & Share', icon: '📊', count: 0, badge: 'Analytics', badgeBg: 'bg-purple-100 text-purple-800' },
                            { id: 'suppliers', label: 'Suppliers Directory', icon: '🏢', count: uniqueSuppliers.length, badge: '' },
                            { id: 'inflow', label: 'Dual-Stock Inflow', icon: '📦', count: 0, badge: 'Audit Inflow', badgeBg: 'bg-sky-100 text-sky-800' },
                        ].map((t) => {
                            const active = activeTab === t.id;
                            return (
                                <button
                                    key={t.id}
                                    type="button"
                                    onClick={() => setActiveTab(t.id as any)}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition-all cursor-pointer ${
                                        active
                                            ? 'bg-amber-600 text-white shadow-md shadow-amber-200'
                                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-bold'
                                    }`}
                                >
                                    <span className="text-sm">{t.icon}</span>
                                    <span>{t.label}</span>
                                    {t.count > 0 && (
                                        <span
                                            className={`px-1.5 py-0.5 rounded-full text-[9.5px] font-mono font-black min-w-[18px] text-center ${
                                                active ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-600'
                                            }`}
                                        >
                                            {t.count}
                                        </span>
                                    )}
                                    {t.badge && !t.count && (
                                        <span
                                            className={`px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase ${
                                                active ? 'bg-white/25 text-white' : t.badgeBg
                                            }`}
                                        >
                                            {t.badge}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    <div className="flex items-center gap-2 text-xs font-mono font-extrabold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-xl border border-indigo-200">
                        Spend: {fmtKES(totalAmount)}
                    </div>
                </div>
            </div>

            {/* ══════════════════════════════════════════════════════════════
                3. EXECUTIVE FINANCIAL COMMAND HUD (6 Low-Profile Cards)
            ══════════════════════════════════════════════════════════════ */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                {[
                    {
                        label: 'Total Invoices',
                        value: filtered.length,
                        sub: `${purchases.length} total across outlet`,
                        color: 'text-indigo-700',
                        bg: 'bg-indigo-50/70',
                        border: 'border-indigo-100',
                        icon: <FiLayers size={14} className="text-indigo-600" />,
                    },
                    {
                        label: 'Gross Spend',
                        value: fmtK(totalAmount),
                        sub: `${uniqueSuppliers.length} vendor accounts`,
                        color: 'text-emerald-700',
                        bg: 'bg-emerald-50/70',
                        border: 'border-emerald-100',
                        icon: <FiDollarSign size={14} className="text-emerald-600" />,
                    },
                    {
                        label: 'This Month',
                        value: fmtK(thisMonthTotal),
                        sub: `${thisMonth.length} orders recorded`,
                        color: 'text-sky-700',
                        bg: 'bg-sky-50/70',
                        border: 'border-sky-100',
                        icon: <FiTrendingUp size={14} className="text-sky-600" />,
                    },
                    {
                        label: 'Settled & Paid',
                        value: paidCount,
                        sub: `${filtered.length > 0 ? ((paidCount / filtered.length) * 100).toFixed(0) : 0}% settlement rate`,
                        color: 'text-emerald-700',
                        bg: 'bg-emerald-50/70',
                        border: 'border-emerald-100',
                        icon: <FiCheckCircle size={14} className="text-emerald-600" />,
                    },
                    {
                        label: 'Unpaid Balance',
                        value: fmtK(unpaidBalance),
                        sub: `${pendingCount} pending payment`,
                        color: 'text-rose-700',
                        bg: 'bg-rose-50/70',
                        border: 'border-rose-100',
                        icon: <FiAlertTriangle size={14} className="text-rose-600" />,
                    },
                    {
                        label: 'Active Vendors',
                        value: uniqueSuppliers.length,
                        sub: 'Procurement suppliers',
                        color: 'text-purple-700',
                        bg: 'bg-purple-50/70',
                        border: 'border-purple-100',
                        icon: <FiTruck size={14} className="text-purple-600" />,
                    },
                ].map((k, i) => (
                    <div
                        key={i}
                        className={`bg-white border ${k.border} rounded-xl p-2.5 shadow-2xs flex flex-col justify-between`}
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{k.label}</span>
                            <div className={`w-6 h-6 rounded-lg ${k.bg} flex items-center justify-center shrink-0`}>
                                {k.icon}
                            </div>
                        </div>
                        <div className="mt-1">
                            <p className={`text-sm font-extrabold font-mono ${k.color} tracking-tight`}>{k.value}</p>
                            <p className="text-[9.5px] text-slate-400 font-medium truncate">{k.sub}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* ══════════════════════════════════════════════════════════════
                TAB 1: INVOICES REGISTRY & DATAGRID
            ══════════════════════════════════════════════════════════════ */}
            {activeTab === 'invoices' && (
                <div className="space-y-2.5">
                    {/* Compact Cockpit: Search + Filters */}
                    <div className="bg-white border border-slate-200/90 rounded-2xl p-2.5 shadow-xs space-y-2">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2 flex-wrap">
                            {/* Search Bar */}
                            <div className="relative flex-1 min-w-[220px]">
                                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
                                <input
                                    ref={searchInputRef}
                                    type="text"
                                    placeholder="Search invoice number, supplier name, invoice ref... (Ctrl+F)"
                                    value={searchQuery}
                                    onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
                                    className="w-full pl-8 pr-7 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 bg-slate-50/70 focus:bg-white outline-none transition"
                                />
                                {searchQuery && (
                                    <button
                                        onClick={() => setSearchQuery('')}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                                    >
                                        ×
                                    </button>
                                )}
                            </div>

                            {/* Payment Status Toggle Pills */}
                            <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200/80 gap-0.5">
                                {(['All', 'Paid', 'Unpaid', 'Partial'] as const).map(s => (
                                    <button
                                        key={s}
                                        onClick={() => { setFilterPayment(s); setPage(1); }}
                                        className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold transition cursor-pointer ${
                                            filterPayment === s
                                                ? 'bg-white text-indigo-700 shadow-2xs font-extrabold'
                                                : 'text-slate-600 hover:text-slate-900'
                                        }`}
                                    >
                                        {s === 'All' ? 'All Payments' : s === 'Paid' ? '✓ Paid' : s === 'Unpaid' ? '⏳ Unpaid' : '⚡ Partial'}
                                    </button>
                                ))}
                            </div>

                            {/* Order Status Toggle Pills */}
                            <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200/80 gap-0.5">
                                {(['All', 'Completed', 'Pending', 'Cancelled'] as const).map(st => (
                                    <button
                                        key={st}
                                        onClick={() => { setFilterStatus(st); setPage(1); }}
                                        className={`px-2 py-1 rounded-lg text-[10.5px] font-bold transition cursor-pointer ${
                                            filterStatus === st
                                                ? 'bg-white text-emerald-700 shadow-2xs font-extrabold'
                                                : 'text-slate-600 hover:text-slate-900'
                                        }`}
                                    >
                                        {st === 'All' ? 'All Orders' : st}
                                    </button>
                                ))}
                            </div>

                            {/* Supplier Selector */}
                            <select
                                value={filterSupplier}
                                onChange={e => { setFilterSupplier(e.target.value); setPage(1); }}
                                className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-slate-50 focus:bg-white outline-none cursor-pointer"
                            >
                                <option value="All">All Suppliers</option>
                                {suppliers.map(s => (
                                    <option key={s.supplier_id} value={s.supplier_name}>
                                        {s.supplier_name}
                                    </option>
                                ))}
                            </select>

                            {/* Date Inputs & Reset */}
                            <div className="flex items-center gap-1.5">
                                <input
                                    type="date"
                                    value={dateFrom}
                                    onChange={e => { setDateFrom(e.target.value); setPage(1); }}
                                    className="px-2 py-1 rounded-xl border border-slate-200 text-[11px] font-mono font-bold text-slate-700 bg-slate-50 outline-none"
                                    title="From Date"
                                />
                                <span className="text-slate-400 text-xs">→</span>
                                <input
                                    type="date"
                                    value={dateTo}
                                    onChange={e => { setDateTo(e.target.value); setPage(1); }}
                                    className="px-2 py-1 rounded-xl border border-slate-200 text-[11px] font-mono font-bold text-slate-700 bg-slate-50 outline-none"
                                    title="To Date"
                                />

                                {(searchQuery || dateFrom || dateTo || filterSupplier !== 'All' || filterStatus !== 'All' || filterPayment !== 'All') && (
                                    <button
                                        onClick={clearFilters}
                                        className="px-2.5 py-1 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                                        title="Clear all active filters"
                                    >
                                        <FiX size={12} /> Clear
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Datagrid Table */}
                    <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
                        {/* High-Contrast Banner Summary Strip */}
                        <div className="px-4 py-2.5 bg-slate-900 text-white flex items-center justify-between flex-wrap gap-2">
                            <div>
                                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-100">
                                    Official Procurement Invoice Registry · {filtered.length} Orders
                                </h3>
                                <p className="text-[10px] text-slate-400">Click any row to view full items ledger &amp; dual-stock distribution</p>
                            </div>
                            <div className="text-right">
                                <span className="text-[10px] uppercase font-bold text-slate-400">Filtered Spend</span>
                                <div className="text-sm font-extrabold font-mono text-emerald-400">{fmtKES(totalAmount)}</div>
                            </div>
                        </div>

                        {isLoading ? (
                            <div className="p-8 space-y-3">
                                {[1, 2, 3, 4, 5].map(i => (
                                    <div key={i} className="h-12 bg-slate-100 rounded-xl animate-pulse" />
                                ))}
                            </div>
                        ) : paginated.length === 0 ? (
                            <div className="text-center py-16 px-4">
                                <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-amber-200 text-amber-600">
                                    <FiShoppingBag size={24} />
                                </div>
                                <h3 className="text-sm font-extrabold text-slate-800">No Purchases Found</h3>
                                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                                    No purchase invoices matched your search criteria. Record fresh inventory intake using the button below.
                                </p>
                                <Link
                                    href="/dashboard/purchase"
                                    className="mt-3 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
                                >
                                    <FiPlus size={13} />
                                    <span>Create Purchase Order</span>
                                </Link>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50/90 border-b border-slate-200 text-[10px] font-black uppercase text-slate-500 tracking-wider">
                                            <th className="py-2.5 px-3 text-center w-10"></th>
                                            <th className="py-2.5 px-3">Invoice Details</th>
                                            <th className="py-2.5 px-3">Purchase Date</th>
                                            <th className="py-2.5 px-3">Supplier Name</th>
                                            <th className="py-2.5 px-3 hidden md:table-cell">Supplier Invoice Ref</th>
                                            <th className="py-2.5 px-3 text-right">Grand Total</th>
                                            <th className="py-2.5 px-3 text-center">Status</th>
                                            <th className="py-2.5 px-3 text-center">Payment</th>
                                            <th className="py-2.5 px-3 text-right w-24">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {paginated.map((p, idx) => {
                                            const isExpanded = expandedRows.has(p.purchase_id);
                                            const items = rowItems[p.purchase_id] || [];
                                            const isLoadingItems = loadingRows.has(p.purchase_id);
                                            return (
                                                <tr
                                                    key={p.purchase_id}
                                                    className={`hover:bg-amber-50/25 transition-colors cursor-pointer ${
                                                        isExpanded ? 'bg-amber-50/40' : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'
                                                    }`}
                                                    onClick={() => toggleRow(p.purchase_id)}
                                                >
                                                    {/* Expand Toggle */}
                                                    <td className="py-2.5 px-3 text-center">
                                                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-lg transition-all ${
                                                            isExpanded ? 'bg-amber-200 text-amber-800' : 'text-slate-400 hover:bg-slate-100'
                                                        }`}>
                                                            {isExpanded ? <FiChevronUp size={13} /> : <FiChevronDown size={13} />}
                                                        </span>
                                                    </td>

                                                    {/* Invoice Number */}
                                                    <td className="py-2.5 px-3">
                                                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-indigo-50 text-indigo-700 font-mono font-extrabold text-[11px] rounded-lg border border-indigo-200/80">
                                                            <FiFileText size={10} /> {p.purchase_no}
                                                        </span>
                                                    </td>

                                                    {/* Purchase Date */}
                                                    <td className="py-2.5 px-3 text-slate-600 font-medium">
                                                        {new Date(p.purchase_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                    </td>

                                                    {/* Supplier */}
                                                    <td className="py-2.5 px-3">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0">
                                                                {(p.supplier_name || 'V')[0]}
                                                            </div>
                                                            <span className="font-extrabold text-slate-900 text-xs truncate max-w-[150px]">
                                                                {p.supplier_name || 'N/A'}
                                                            </span>
                                                        </div>
                                                    </td>

                                                    {/* Supplier Invoice Ref */}
                                                    <td className="py-2.5 px-3 font-mono text-slate-500 text-[11px] hidden md:table-cell">
                                                        {p.supplier_invoice || '—'}
                                                    </td>

                                                    {/* Total Amount */}
                                                    <td className="py-2.5 px-3 text-right font-mono font-black text-slate-900 text-xs">
                                                        {fmtKES(p.grand_total)}
                                                    </td>

                                                    {/* Order Status */}
                                                    <td className="py-2.5 px-3 text-center">
                                                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                                                            p.status === 'Completed'
                                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                                : p.status === 'Cancelled'
                                                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                                                : 'bg-amber-50 text-amber-800 border-amber-200'
                                                        }`}>
                                                            <span className={`w-1.5 h-1.5 rounded-full ${
                                                                p.status === 'Completed' ? 'bg-emerald-500' : p.status === 'Cancelled' ? 'bg-rose-500' : 'bg-amber-500'
                                                            }`} />
                                                            {p.status || 'Pending'}
                                                        </span>
                                                    </td>

                                                    {/* Payment Status */}
                                                    <td className="py-2.5 px-3 text-center">
                                                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                                                            p.payment_status === 'Paid'
                                                                ? 'bg-cyan-50 text-cyan-800 border-cyan-200'
                                                                : p.payment_status === 'Partial'
                                                                ? 'bg-purple-50 text-purple-700 border-purple-200'
                                                                : 'bg-rose-50 text-rose-700 border-rose-200'
                                                        }`}>
                                                            {p.payment_status === 'Paid' ? '✓ Paid' : p.payment_status === 'Partial' ? '⚡ Partial' : '⏳ Unpaid'}
                                                        </span>
                                                    </td>

                                                    {/* Actions */}
                                                    <td className="py-2.5 px-3 text-right" onClick={e => e.stopPropagation()}>
                                                        <div className="flex items-center justify-end gap-1.5">
                                                            {isExpanded && items.length > 0 && (
                                                                <button
                                                                    onClick={() => printPurchaseDetail(p, items)}
                                                                    className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-indigo-600 transition shadow-2xs cursor-pointer"
                                                                    title="Print Purchase Schedule"
                                                                >
                                                                    <FiPrinter size={12} />
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={() => deletePurchase(p)}
                                                                className="p-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-600 transition shadow-2xs cursor-pointer"
                                                                title="Delete purchase order & reverse stock"
                                                            >
                                                                <FiTrash2 size={12} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Expanded Items Viewer Row (When any invoice row is selected) */}
                    {Array.from(expandedRows).map(pid => {
                        const p = purchases.find(item => item.purchase_id === pid);
                        if (!p) return null;
                        const items = rowItems[pid] || [];
                        const isLoadingItems = loadingRows.has(pid);
                        return (
                            <div key={`expanded-card-${pid}`} className="bg-white border-2 border-indigo-200/90 rounded-2xl p-4 shadow-sm space-y-3 fade-in">
                                <div className="flex items-center justify-between pb-2 border-b border-slate-100 flex-wrap gap-2">
                                    <div className="flex items-center gap-2">
                                        <div className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700 font-bold">
                                            <FiPackage size={14} />
                                        </div>
                                        <div>
                                            <h4 className="text-xs font-black text-slate-900 uppercase">
                                                Invoice Line Items — {p.purchase_no} ({items.length} Product Lines)
                                            </h4>
                                            <p className="text-[10px] text-slate-400">Supplier: {p.supplier_name} · Invoiced: {fmtKES(p.grand_total)}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => printPurchaseDetail(p, items)}
                                            className="px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold transition flex items-center gap-1 shadow-2xs cursor-pointer"
                                        >
                                            <FiPrinter size={12} /> Print
                                        </button>
                                        <button
                                            onClick={() => toggleRow(pid)}
                                            className="px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs font-bold cursor-pointer"
                                        >
                                            Collapse ✕
                                        </button>
                                    </div>
                                </div>

                                {isLoadingItems ? (
                                    <div className="flex items-center justify-center py-6 gap-2">
                                        <div className="w-5 h-5 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                                        <span className="text-xs text-slate-400 font-medium">Fetching item breakdown from ledger...</span>
                                    </div>
                                ) : items.length === 0 ? (
                                    <p className="text-center text-slate-400 py-4 text-xs font-medium">No items registered for this purchase</p>
                                ) : (
                                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                                        <table className="w-full text-left text-xs border-collapse">
                                            <thead>
                                                <tr className="bg-slate-50 text-[10px] font-black uppercase text-slate-500 tracking-wider border-b border-slate-200">
                                                    <th className="py-2 px-3 text-center w-8">#</th>
                                                    <th className="py-2 px-3">Item Code</th>
                                                    <th className="py-2 px-3">Product Name</th>
                                                    <th className="py-2 px-3 text-center">Unit</th>
                                                    <th className="py-2 px-3 text-center">📦 Boxes / Bags</th>
                                                    <th className="py-2 px-3 text-center">🔢 Loose Pieces</th>
                                                    <th className="py-2 px-3 text-right">Unit Rate</th>
                                                    <th className="py-2 px-3 text-right">Line Total</th>
                                                    {expiryEnabled && <th className="py-2 px-3 text-center">Batch</th>}
                                                    {expiryEnabled && <th className="py-2 px-3 text-center">Expiry</th>}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 font-medium">
                                                {items.map((item, i) => (
                                                    <tr key={item.pp_id} className="hover:bg-slate-50/70 transition-colors">
                                                        <td className="py-2 px-3 text-center text-[10px] text-slate-400 font-mono">{i + 1}</td>
                                                        <td className="py-2 px-3 font-mono font-bold text-indigo-600 text-[11px]">{item.product_code}</td>
                                                        <td className="py-2 px-3 font-extrabold text-slate-900">{item.product_name}</td>
                                                        <td className="py-2 px-3 text-center">
                                                            <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-semibold">
                                                                {item.unit}
                                                            </span>
                                                        </td>
                                                        <td className="py-2 px-3 text-center font-mono">
                                                            {(item.bag_qty || 0) > 0 ? (
                                                                <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200/80 rounded-md font-bold text-[11px]">
                                                                    {item.bag_qty}
                                                                </span>
                                                            ) : (
                                                                <span className="text-slate-300">—</span>
                                                            )}
                                                        </td>
                                                        <td className="py-2 px-3 text-center font-mono">
                                                            {(item.piece_qty || 0) > 0 ? (
                                                                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200/80 rounded-md font-bold text-[11px]">
                                                                    {item.piece_qty}
                                                                </span>
                                                            ) : item.quantity > 0 ? (
                                                                <span className="text-slate-700 font-bold">{item.quantity}</span>
                                                            ) : (
                                                                <span className="text-slate-300">—</span>
                                                            )}
                                                        </td>
                                                        <td className="py-2 px-3 text-right font-mono text-slate-600">
                                                            {fmtKES(item.rate)}
                                                        </td>
                                                        <td className="py-2 px-3 text-right font-mono font-black text-emerald-700">
                                                            {fmtKES(item.total_amount)}
                                                        </td>
                                                        {expiryEnabled && (
                                                            <td className="py-2 px-3 text-center font-mono text-[10px]">
                                                                {item.batch_number ? (
                                                                    <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded border border-amber-200">
                                                                        {item.batch_number}
                                                                    </span>
                                                                ) : '—'}
                                                            </td>
                                                        )}
                                                        {expiryEnabled && (
                                                            <td className="py-2 px-3 text-center text-[10px] font-bold">
                                                                {item.expiry_date ? (
                                                                    <span className={`px-2 py-0.5 rounded-full ${
                                                                        new Date(item.expiry_date) < new Date() ? 'bg-rose-100 text-rose-700' : 'bg-amber-50 text-amber-700'
                                                                    }`}>
                                                                        {new Date(item.expiry_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}
                                                                    </span>
                                                                ) : '—'}
                                                            </td>
                                                        )}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {/* Ultra-Clean Pagination Footer */}
                    <div className="bg-white border border-slate-200/90 rounded-2xl p-2.5 shadow-xs flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500 font-medium">Rows per page:</span>
                            <select
                                value={perPage}
                                onChange={e => { setPerPage(parseInt(e.target.value)); setPage(1); }}
                                className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 outline-none cursor-pointer"
                            >
                                {[10, 20, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
                            </select>
                            <span className="text-xs text-slate-500 font-medium">
                                Showing <strong>{paginated.length}</strong> of <strong>{filtered.length}</strong> records
                            </span>
                        </div>

                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setPage(1)}
                                disabled={page === 1}
                                className="p-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 disabled:opacity-30 cursor-pointer"
                                title="First Page"
                            >
                                <FiChevronsLeft size={13} />
                            </button>
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="p-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 disabled:opacity-30 cursor-pointer"
                                title="Previous Page"
                            >
                                <FiChevronLeft size={13} />
                            </button>
                            {Array.from({ length: Math.min(5, totalPages || 1) }, (_, i) => {
                                const start = Math.max(1, Math.min(page - 2, (totalPages || 1) - 4));
                                const pg = start + i;
                                if (pg > (totalPages || 1)) return null;
                                return (
                                    <button
                                        key={pg}
                                        onClick={() => setPage(pg)}
                                        className={`w-7 h-7 rounded-lg text-xs font-mono font-bold transition cursor-pointer ${
                                            pg === page
                                                ? 'bg-amber-600 text-white shadow-2xs'
                                                : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                                        }`}
                                    >
                                        {pg}
                                    </button>
                                );
                            })}
                            <button
                                onClick={() => setPage(p => Math.min(totalPages || 1, p + 1))}
                                disabled={page >= (totalPages || 1)}
                                className="p-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 disabled:opacity-30 cursor-pointer"
                                title="Next Page"
                            >
                                <FiChevronRight size={13} />
                            </button>
                            <button
                                onClick={() => setPage(totalPages || 1)}
                                disabled={page >= (totalPages || 1)}
                                className="p-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 disabled:opacity-30 cursor-pointer"
                                title="Last Page"
                            >
                                <FiChevronsRight size={13} />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════
                TAB 2: VENDOR SPENDING & SHARE ANALYTICS
            ══════════════════════════════════════════════════════════════ */}
            {activeTab === 'analytics' && (
                <div className="space-y-3 fade-in">
                    <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
                        <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
                            <div>
                                <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">
                                    Supplier Procurement Weight &amp; Share Breakdown
                                </h3>
                                <p className="text-[10px] text-slate-400 font-medium">
                                    Relative expenditure contribution per vendor for {activeOutlet?.outlet_name || 'Main Store'}
                                </p>
                            </div>
                            <div className="text-xs font-mono font-extrabold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-xl border border-indigo-200">
                                Total Procurement: {fmtKES(totalAmount)}
                            </div>
                        </div>

                        {supplierSpending.length === 0 ? (
                            <div className="py-12 text-center text-slate-400 text-xs font-medium">
                                No purchase records registered to compute vendor share.
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {supplierSpending.map(s => (
                                    <div
                                        key={s.name}
                                        className="p-3 rounded-xl border border-slate-200/80 bg-slate-50/60 flex flex-col justify-between"
                                    >
                                        <div className="flex items-center justify-between text-xs font-extrabold text-slate-800 mb-1">
                                            <span className="truncate max-w-[170px]">{s.name}</span>
                                            <span className="font-mono text-indigo-700">{s.pct.toFixed(1)}%</span>
                                        </div>

                                        <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden my-2">
                                            <div
                                                className="h-full bg-gradient-to-r from-indigo-500 to-amber-500 rounded-full"
                                                style={{ width: `${Math.min(100, Math.max(3, s.pct))}%` }}
                                            />
                                        </div>

                                        <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                                            <span>Orders: <strong>{s.count}</strong></span>
                                            <strong className="text-slate-800">{fmtKES(s.total)}</strong>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════
                TAB 3: SUPPLIERS DIRECTORY
            ══════════════════════════════════════════════════════════════ */}
            {activeTab === 'suppliers' && (
                <div className="space-y-3 fade-in">
                    <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
                        <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 flex-wrap gap-2">
                            <div>
                                <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">
                                    Registered Vendor Directory &amp; Supply Accounts
                                </h3>
                                <p className="text-[10px] text-slate-400 font-medium">
                                    {suppliers.length} active suppliers configured in catalog
                                </p>
                            </div>
                            <Link
                                href="/dashboard/suppliers"
                                className="px-3 py-1.5 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition flex items-center gap-1 shadow-2xs"
                            >
                                <FiTruck size={13} />
                                <span>Manage Suppliers Master →</span>
                            </Link>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {suppliers.map(sup => {
                                const supPurchases = purchases.filter(p => p.supplier_name === sup.supplier_name);
                                const supTotal = supPurchases.reduce((s, p) => s + (p.grand_total || 0), 0);
                                return (
                                    <div key={sup.supplier_id} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-col justify-between space-y-2">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                                                {sup.supplier_name[0]}
                                            </div>
                                            <div>
                                                <h4 className="font-extrabold text-slate-900 text-xs">{sup.supplier_name}</h4>
                                                <span className="text-[10px] font-mono font-bold text-slate-400">ID #{sup.supplier_id}</span>
                                            </div>
                                        </div>
                                        <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between text-[11px] font-mono">
                                            <span className="text-slate-500">Total Invoiced:</span>
                                            <span className="font-bold text-emerald-700">{fmtKES(supTotal)} ({supPurchases.length} orders)</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════
                TAB 4: DUAL-STOCK INFLOW AUDIT
            ══════════════════════════════════════════════════════════════ */}
            {activeTab === 'inflow' && (
                <div className="space-y-3 fade-in">
                    <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
                        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
                            <div className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-700 font-black text-lg">
                                📦
                            </div>
                            <div>
                                <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">
                                    Dual-Stock Ledger Inflow Protocol
                                </h3>
                                <p className="text-[10px] text-slate-400 font-medium">
                                    Automatic distribution into Boxes/Bags vs Loose Pieces upon procurement invoice posting
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="font-extrabold text-slate-900 uppercase text-[11px]">📦 Bulk Package Storage (Bags/Boxes)</span>
                                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-indigo-100 text-indigo-800">Whole Package Stock</span>
                                </div>
                                <p className="text-[10px] text-slate-500 leading-relaxed">
                                    Preserves intact factory packages, bags, and cartons. Inflow rows are stamped with <code>storage_type: &apos;Bags&apos;</code> in <code>retail_stock</code>, retaining package cost integrity.
                                </p>
                            </div>

                            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="font-extrabold text-slate-900 uppercase text-[11px]">🔢 Loose Pieces Storage (Pieces)</span>
                                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-800">Disaggregated Units</span>
                                </div>
                                <p className="text-[10px] text-slate-500 leading-relaxed">
                                    Tracks open-stock pieces available for single retail sales at cashier terminals. Automatically debited first during loose-piece transactions.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
