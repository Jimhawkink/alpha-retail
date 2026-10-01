'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';
import toast from 'react-hot-toast';
import { FiBox, FiTrendingUp, FiCalendar, FiSearch, FiChevronDown, FiChevronUp, FiList, FiArrowDownRight, FiArrowUpRight, FiRefreshCw, FiPackage, FiDollarSign, FiShoppingCart, FiActivity } from 'react-icons/fi';

interface ProductMovement {
    pid: number;
    product_name: string;
    product_code: string;
    category: string;
    base_unit: string;
    cost_price: number;
    
    opening_qty: number;
    purchased_qty: number;
    issued_qty: number;
    adjusted_qty: number;
    closing_qty: number;
    
    ledger: LedgerEntry[];
}

interface LedgerEntry {
    date: string;
    type: 'Purchase' | 'Sale' | 'Adjustment' | 'Opening';
    qty_change: number;
    reference: string;
    details?: string;
}

export default function StockMovementPage() {
    const { activeOutlet } = useOutlet();
    const outletId = activeOutlet?.outlet_id;

    const [isLoading, setIsLoading] = useState(true);
    const [movements, setMovements] = useState<ProductMovement[]>([]);
    
    const today = new Date().toISOString().split('T')[0];
    const [dateFrom, setDateFrom] = useState(today);
    const [dateTo, setDateTo] = useState(today);
    const [searchQuery, setSearchQuery] = useState('');
    
    const [page, setPage] = useState(1);
    const rowsPerPage = 15;

    const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

    const toggleRow = (pid: number) => {
        const newSet = new Set(expandedRows);
        if (newSet.has(pid)) newSet.delete(pid);
        else newSet.add(pid);
        setExpandedRows(newSet);
    };

    const loadData = useCallback(async () => {
        if (!outletId) return;
        setIsLoading(true);
        try {
            const PAGE = 1000;
            
            // 1. Fetch Products (Paginated)
            let allProducts: any[] = [];
            let pFrom = 0;
            while (true) {
                const { data, error } = await supabase.from('retail_products').select('pid, product_name, product_code, category, purchase_unit, purchase_cost').eq('outlet_id', outletId).eq('active', true).range(pFrom, pFrom + PAGE - 1);
                if (error || !data?.length) break;
                allProducts = allProducts.concat(data);
                if (data.length < PAGE) break;
                pFrom += PAGE;
            }

            // 2. Fetch Current Stock (Paginated)
            let allStockData: any[] = [];
            let sFrom = 0;
            while (true) {
                const { data, error } = await supabase.from('retail_stock').select('pid, qty').eq('outlet_id', outletId).range(sFrom, sFrom + PAGE - 1);
                if (error || !data?.length) break;
                allStockData = allStockData.concat(data);
                if (data.length < PAGE) break;
                sFrom += PAGE;
            }
                
            const currentStockMap = new Map<number, number>();
            allStockData.forEach(s => {
                currentStockMap.set(s.pid, (currentStockMap.get(s.pid) || 0) + (s.qty || 0));
            });

            // 3. Fetch Purchases
            const { data: purchases } = await supabase.from('retail_purchases').select('purchase_id, purchase_date, purchase_no, supplier_name').eq('outlet_id', outletId).gte('purchase_date', dateFrom);
            const purchaseIds = (purchases || []).map(p => p.purchase_id);
            let purchaseItems: any[] = [];
            if (purchaseIds.length > 0) {
                let piFrom = 0;
                while(true){
                    const { data: pi } = await supabase.from('retail_purchase_products').select('product_id, quantity, purchase_id').in('purchase_id', purchaseIds).range(piFrom, piFrom + PAGE - 1);
                    if(!pi?.length) break;
                    purchaseItems = purchaseItems.concat(pi);
                    if(pi.length < PAGE) break;
                    piFrom += PAGE;
                }
            }
            const purchaseMap = new Map((purchases || []).map(p => [p.purchase_id, p]));

            // 4. Fetch Sales
            const { data: sales } = await supabase.from('retail_sales').select('sale_id, sale_date, receipt_no, customer_name').eq('outlet_id', outletId).gte('sale_date', dateFrom);
            const saleIds = (sales || []).map(s => s.sale_id);
            let saleItems: any[] = [];
            if (saleIds.length > 0) {
                let siFrom = 0;
                while(true){
                    const { data: si } = await supabase.from('retail_sales_items').select('product_id, quantity, sale_id').in('sale_id', saleIds).range(siFrom, siFrom + PAGE - 1);
                    if(!si?.length) break;
                    saleItems = saleItems.concat(si);
                    if(si.length < PAGE) break;
                    siFrom += PAGE;
                }
            }
            const salesMap = new Map((sales || []).map(s => [s.sale_id, s]));

            // 5. Fetch Movements
            let stockMovements: any[] = [];
            try {
                let smFrom = 0;
                while(true){
                    const { data: sm } = await supabase.from('retail_stock_movements').select('product_id, quantity, movement_type, movement_date, reference_no, reason').gte('movement_date', dateFrom).range(smFrom, smFrom + PAGE - 1);
                    if(!sm?.length) break;
                    stockMovements = stockMovements.concat(sm);
                    if(sm.length < PAGE) break;
                    smFrom += PAGE;
                }
            } catch (e) {
                // silent
            }

            const result: ProductMovement[] = [];

            allProducts.forEach(prod => {
                const pid = prod.pid;
                const currentQty = currentStockMap.get(pid) || 0;
                
                let inPeriodPurchases = 0;
                let postPeriodPurchases = 0;
                let inPeriodSales = 0;
                let postPeriodSales = 0;
                let inPeriodAdjustments = 0;
                let postPeriodAdjustments = 0;
                
                const ledger: LedgerEntry[] = [];

                purchaseItems.filter(pi => pi.product_id === pid).forEach(pi => {
                    const purchase = purchaseMap.get(pi.purchase_id);
                    if (!purchase) return;
                    const pDate = purchase.purchase_date.split('T')[0];
                    if (pDate >= dateFrom && pDate <= dateTo) {
                        inPeriodPurchases += pi.quantity;
                        ledger.push({ date: pDate, type: 'Purchase', qty_change: pi.quantity, reference: purchase.purchase_no || `PUR-${purchase.purchase_id}`, details: purchase.supplier_name });
                    } else if (pDate > dateTo) {
                        postPeriodPurchases += pi.quantity;
                    }
                });

                saleItems.filter(si => si.product_id === pid).forEach(si => {
                    const sale = salesMap.get(si.sale_id);
                    if (!sale) return;
                    const sDate = sale.sale_date.split('T')[0];
                    if (sDate >= dateFrom && sDate <= dateTo) {
                        inPeriodSales += si.quantity;
                        ledger.push({ date: sDate, type: 'Sale', qty_change: -si.quantity, reference: sale.receipt_no || `REC-${sale.sale_id}`, details: sale.customer_name });
                    } else if (sDate > dateTo) {
                        postPeriodSales += si.quantity;
                    }
                });

                stockMovements.filter(sm => sm.product_id === pid).forEach(sm => {
                    const mDate = (sm.movement_date || '').split('T')[0];
                    if (!mDate) return;
                    const isOut = sm.movement_type?.toLowerCase() === 'out';
                    const qtyChange = isOut ? -Math.abs(sm.quantity) : Math.abs(sm.quantity);
                    if (mDate >= dateFrom && mDate <= dateTo) {
                        inPeriodAdjustments += qtyChange;
                        ledger.push({ date: mDate, type: 'Adjustment', qty_change: qtyChange, reference: sm.reference_no || 'ADJ', details: sm.reason });
                    } else if (mDate > dateTo) {
                        postPeriodAdjustments += qtyChange;
                    }
                });

                const netPostPeriod = postPeriodPurchases - postPeriodSales + postPeriodAdjustments;
                const closingQty = currentQty - netPostPeriod;
                const netInPeriod = inPeriodPurchases - inPeriodSales + inPeriodAdjustments;
                const openingQty = closingQty - netInPeriod;
                
                ledger.push({ date: dateFrom, type: 'Opening', qty_change: openingQty, reference: 'Opening Balance', details: 'Calculated Balance' });
                ledger.sort((a, b) => {
                    if (a.type === 'Opening') return -1;
                    if (b.type === 'Opening') return 1;
                    return new Date(a.date).getTime() - new Date(b.date).getTime();
                });

                if (openingQty !== 0 || closingQty !== 0 || inPeriodPurchases !== 0 || inPeriodSales !== 0 || inPeriodAdjustments !== 0 || currentQty !== 0) {
                    result.push({
                        pid: prod.pid,
                        product_name: prod.product_name,
                        product_code: prod.product_code || '-',
                        category: prod.category || 'Uncategorized',
                        base_unit: prod.purchase_unit || 'PCS',
                        cost_price: prod.purchase_cost || 0,
                        opening_qty: openingQty,
                        purchased_qty: inPeriodPurchases,
                        issued_qty: inPeriodSales,
                        adjusted_qty: inPeriodAdjustments,
                        closing_qty: closingQty,
                        ledger
                    });
                }
            });

            setMovements(result.sort((a, b) => a.product_name.localeCompare(b.product_name)));

        } catch (err: any) {
            console.error(err);
            toast.error('Failed to load stock movements');
        } finally {
            setIsLoading(false);
        }
    }, [outletId, dateFrom, dateTo]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const filtered = useMemo(() => {
        return movements.filter(m => 
            m.product_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
            m.product_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
            m.category.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [movements, searchQuery]);

    const totalPages = Math.ceil(filtered.length / rowsPerPage);
    const paginated = filtered.slice((page - 1) * rowsPerPage, page * rowsPerPage);

    const stats = useMemo(() => {
        let openingTotal = 0;
        let closingTotal = 0;
        let purchasedTotal = 0;
        let soldTotal = 0;
        filtered.forEach(m => {
            openingTotal += m.opening_qty * m.cost_price;
            closingTotal += m.closing_qty * m.cost_price;
            purchasedTotal += m.purchased_qty * m.cost_price;
            soldTotal += m.issued_qty * m.cost_price;
        });
        return { openingTotal, closingTotal, purchasedTotal, soldTotal };
    }, [filtered]);

    return (
        <div className="space-y-6 animate-fadeIn">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                <div>
                    <h1 className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">Stock Movement Ledger</h1>
                    <p className="text-sm text-gray-500 mt-1 font-medium">Robust ultra-premium tracking of stock lifecycle per product.</p>
                </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="relative overflow-hidden rounded-2xl bg-white border border-blue-100 p-5 shadow-sm hover:shadow-xl transition-all group">
                    <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-gradient-to-br from-blue-100 to-blue-50 opacity-60 group-hover:scale-125 transition-transform" />
                    <div className="relative flex items-center justify-between">
                        <div><p className="text-xs font-bold text-blue-500 uppercase tracking-wider">Total Value In</p><p className="text-2xl font-black text-gray-800 mt-1">Ksh {stats.purchasedTotal.toLocaleString()}</p><p className="text-[10px] text-gray-400 mt-1">Purchases in period</p></div>
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-300/30 group-hover:scale-110 transition-transform"><FiPackage className="text-white" size={22} /></div>
                    </div>
                </div>
                <div className="relative overflow-hidden rounded-2xl bg-white border border-emerald-100 p-5 shadow-sm hover:shadow-xl transition-all group">
                    <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-gradient-to-br from-emerald-100 to-green-50 opacity-60 group-hover:scale-125 transition-transform" />
                    <div className="relative flex items-center justify-between">
                        <div><p className="text-xs font-bold text-emerald-500 uppercase tracking-wider">Total Value Out</p><p className="text-2xl font-black text-gray-800 mt-1">Ksh {stats.soldTotal.toLocaleString()}</p><p className="text-[10px] text-gray-400 mt-1">Cost of Goods Sold</p></div>
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-lg shadow-emerald-300/30 group-hover:scale-110 transition-transform"><FiShoppingCart className="text-white" size={22} /></div>
                    </div>
                </div>
                <div className="relative overflow-hidden rounded-2xl bg-white border border-purple-100 p-5 shadow-sm hover:shadow-xl transition-all group">
                    <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-gradient-to-br from-purple-100 to-violet-50 opacity-60 group-hover:scale-125 transition-transform" />
                    <div className="relative flex items-center justify-between">
                        <div><p className="text-xs font-bold text-purple-500 uppercase tracking-wider">Opening Value</p><p className="text-2xl font-black text-gray-800 mt-1">Ksh {stats.openingTotal.toLocaleString()}</p><p className="text-[10px] text-gray-400 mt-1">Start of period</p></div>
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center shadow-lg shadow-purple-300/30 group-hover:scale-110 transition-transform"><FiActivity className="text-white" size={22} /></div>
                    </div>
                </div>
                <div className="relative overflow-hidden rounded-2xl bg-white border border-teal-100 p-5 shadow-sm hover:shadow-xl transition-all group">
                    <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-gradient-to-br from-teal-100 to-cyan-50 opacity-60 group-hover:scale-125 transition-transform" />
                    <div className="relative flex items-center justify-between">
                        <div><p className="text-xs font-bold text-teal-500 uppercase tracking-wider">Closing Value</p><p className="text-2xl font-black text-gray-800 mt-1">Ksh {stats.closingTotal.toLocaleString()}</p><p className="text-[10px] text-gray-400 mt-1">End of period</p></div>
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-teal-300/30 group-hover:scale-110 transition-transform"><FiDollarSign className="text-white" size={22} /></div>
                    </div>
                </div>
            </div>

            <div className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 flex flex-wrap gap-4 items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-xl border border-gray-200">
                        <FiCalendar className="text-gray-400" />
                        <div className="flex items-center gap-2">
                            <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }} className="bg-transparent text-sm font-bold text-gray-700 outline-none" />
                            <span className="text-gray-400 font-bold">→</span>
                            <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }} className="bg-transparent text-sm font-bold text-gray-700 outline-none" />
                        </div>
                    </div>
                    
                    <button onClick={loadData} disabled={isLoading} className="bg-blue-50 text-blue-600 p-2.5 rounded-xl hover:bg-blue-100 transition-colors">
                        <FiRefreshCw className={isLoading ? 'animate-spin' : ''} />
                    </button>
                </div>

                <div className="relative w-full max-w-sm">
                    <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="text" placeholder="Search product, code, category..." value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
                        className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
            </div>

            <div className="bg-white rounded-3xl border border-gray-200 shadow-lg overflow-hidden flex flex-col">
                <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-white flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center text-white shadow-md shadow-blue-200">
                            <FiBox size={20} />
                        </div>
                        <h2 className="text-lg font-black text-gray-800">Movement Summary</h2>
                    </div>
                    <div className="text-xs font-bold text-gray-500 bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm">
                        Showing {paginated.length} of {filtered.length} products
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-blue-600 text-white border-b border-blue-700">
                                <th className="px-5 py-4 text-[10px] font-black uppercase tracking-wider w-10"></th>
                                <th className="px-5 py-4 text-[10px] font-black uppercase tracking-wider">Product Info</th>
                                <th className="px-5 py-4 text-[10px] font-black uppercase tracking-wider text-center">Unit</th>
                                <th className="px-5 py-4 text-[10px] font-black uppercase tracking-wider text-center text-blue-100">Opening</th>
                                <th className="px-5 py-4 text-[10px] font-black uppercase tracking-wider text-center text-emerald-200">In (Purch)</th>
                                <th className="px-5 py-4 text-[10px] font-black uppercase tracking-wider text-center text-rose-200">Out (Sales)</th>
                                <th className="px-5 py-4 text-[10px] font-black uppercase tracking-wider text-center text-amber-200">Adj.</th>
                                <th className="px-5 py-4 text-[10px] font-black uppercase tracking-wider text-center">Closing</th>
                                <th className="px-5 py-4 text-[10px] font-black uppercase tracking-wider text-right">Total Value</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={9} className="py-16 text-center">
                                        <div className="flex flex-col items-center justify-center">
                                            <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                                            <p className="text-sm text-gray-500 font-medium mt-3">Loading robust ledger...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : paginated.length === 0 ? (
                                <tr><td colSpan={9} className="py-16 text-center text-gray-500 font-medium">No stock movements found for selected filters.</td></tr>
                            ) : (
                                paginated.map(m => {
                                    const isExpanded = expandedRows.has(m.pid);
                                    return (
                                        <React.Fragment key={m.pid}>
                                            <tr onClick={() => toggleRow(m.pid)} className={`hover:bg-blue-50/30 transition-colors cursor-pointer group ${isExpanded ? 'bg-blue-50/50' : ''}`}>
                                                <td className="px-5 py-4 text-gray-400 group-hover:text-blue-600">
                                                    {isExpanded ? <FiChevronUp size={18} /> : <FiChevronDown size={18} />}
                                                </td>
                                                <td className="px-5 py-4">
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-gray-900">{m.product_name}</span>
                                                        <span className="text-[10px] text-purple-500 font-bold bg-purple-50 w-fit px-1.5 py-0.5 rounded mt-1 border border-purple-100">{m.product_code} • {m.category}</span>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4 text-center">
                                                    <span className="text-xs font-bold text-gray-500 bg-gray-50 border border-gray-200 px-2 py-1 rounded-lg">{m.base_unit}</span>
                                                </td>
                                                <td className="px-5 py-4 text-center">
                                                    <span className="font-black text-gray-700">{m.opening_qty.toLocaleString()}</span>
                                                </td>
                                                <td className="px-5 py-4 text-center">
                                                    <span className={`font-black ${m.purchased_qty > 0 ? 'text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100' : 'text-gray-400'}`}>
                                                        {m.purchased_qty > 0 ? '+' : ''}{m.purchased_qty.toLocaleString()}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-4 text-center">
                                                    <span className={`font-black ${m.issued_qty > 0 ? 'text-rose-600 bg-rose-50 px-2 py-1 rounded-lg border border-rose-100' : 'text-gray-400'}`}>
                                                        {m.issued_qty > 0 ? '-' : ''}{m.issued_qty.toLocaleString()}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-4 text-center">
                                                    <span className={`font-black ${m.adjusted_qty !== 0 ? 'text-amber-600 bg-amber-50 px-2 py-1 rounded-lg border border-amber-100' : 'text-gray-400'}`}>
                                                        {m.adjusted_qty > 0 ? '+' : ''}{m.adjusted_qty.toLocaleString()}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-4 text-center">
                                                    <span className="font-black text-white bg-blue-600 px-3 py-1 rounded-lg shadow-sm text-sm border border-blue-700">{m.closing_qty.toLocaleString()}</span>
                                                </td>
                                                <td className="px-5 py-4 text-right">
                                                    <span className="font-bold text-slate-700">Ksh {(m.closing_qty * m.cost_price).toLocaleString()}</span>
                                                </td>
                                            </tr>

                                            {isExpanded && (
                                                <tr>
                                                    <td colSpan={9} className="bg-gradient-to-b from-blue-50 to-white p-0 border-b border-blue-100">
                                                        <div className="p-8">
                                                            <h4 className="text-sm font-black text-gray-800 mb-5 flex items-center gap-2">
                                                                <FiList className="text-blue-500" size={18}/> 
                                                                Detailed Ledger: {m.product_name}
                                                            </h4>
                                                            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                                                                <table className="w-full text-left text-xs">
                                                                    <thead className="bg-gray-50 border-b border-gray-100">
                                                                        <tr>
                                                                            <th className="px-4 py-3 font-bold text-gray-600">Date</th>
                                                                            <th className="px-4 py-3 font-bold text-gray-600">Type</th>
                                                                            <th className="px-4 py-3 font-bold text-gray-600 text-center">Qty Change</th>
                                                                            <th className="px-4 py-3 font-bold text-gray-600">Reference</th>
                                                                            <th className="px-4 py-3 font-bold text-gray-600">Details</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody className="divide-y divide-gray-100">
                                                                        {m.ledger.length === 0 ? (
                                                                            <tr><td colSpan={5} className="p-4 text-center text-gray-400">No activity in this period.</td></tr>
                                                                        ) : (
                                                                            m.ledger.map((l, i) => (
                                                                                <tr key={i} className="hover:bg-gray-50 transition-colors">
                                                                                    <td className="px-4 py-3 font-medium text-gray-600">{l.date}</td>
                                                                                    <td className="px-4 py-3">
                                                                                        <span className={`px-2 py-0.5 rounded font-bold text-[10px] uppercase
                                                                                            ${l.type === 'Opening' ? 'bg-gray-100 text-gray-600 border border-gray-200' : 
                                                                                              l.type === 'Purchase' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
                                                                                              l.type === 'Sale' ? 'bg-rose-100 text-rose-700 border border-rose-200' :
                                                                                              'bg-amber-100 text-amber-700 border border-amber-200'}`}>
                                                                                            {l.type}
                                                                                        </span>
                                                                                    </td>
                                                                                    <td className="px-4 py-3 text-center">
                                                                                        <span className={`font-black text-sm flex items-center justify-center gap-1
                                                                                            ${l.qty_change > 0 && l.type !== 'Opening' ? 'text-emerald-600' : 
                                                                                              l.qty_change < 0 ? 'text-rose-600' : 'text-gray-700'}`}>
                                                                                            {l.qty_change > 0 && l.type !== 'Opening' ? <FiArrowUpRight size={12}/> : 
                                                                                             l.qty_change < 0 ? <FiArrowDownRight size={12}/> : null}
                                                                                            {l.type === 'Opening' ? l.qty_change : Math.abs(l.qty_change)}
                                                                                        </span>
                                                                                    </td>
                                                                                    <td className="px-4 py-3 font-medium text-gray-800">{l.reference}</td>
                                                                                    <td className="px-4 py-3 text-gray-500">{l.details || '-'}</td>
                                                                                </tr>
                                                                            ))
                                                                        )}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {totalPages > 1 && (
                    <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-500">
                            Showing <span className="text-gray-900">{(page - 1) * rowsPerPage + 1}</span> to <span className="text-gray-900">{Math.min(page * rowsPerPage, filtered.length)}</span> of {filtered.length} Entries
                        </span>
                        <div className="flex gap-1">
                            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                                className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-all shadow-sm">
                                Prev
                            </button>
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                const p = totalPages <= 5 ? i + 1 : page <= 3 ? i + 1 : page >= totalPages - 2 ? totalPages - 4 + i : page - 2 + i;
                                return (
                                    <button key={p} onClick={() => setPage(p)}
                                        className={`w-8 py-1.5 rounded-lg border text-xs font-black transition-all shadow-sm
                                        ${page === p ? 'bg-blue-600 text-white border-blue-600 shadow-blue-200' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                                        {p}
                                    </button>
                                );
                            })}
                            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                                className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-all shadow-sm">
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
