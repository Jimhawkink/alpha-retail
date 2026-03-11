'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';
import toast from 'react-hot-toast';

interface StockItem {
    pid: number; name: string; category: string; purchaseUnit: string; salesUnit: string;
    stock: number; purchasePrice: number; salesPrice: number; stockValue: number;
    reorderPoint: number; status: 'ok' | 'low' | 'critical' | 'out';
}

export default function StockReportPage() {
    const { activeOutlet } = useOutlet();
    const outletId = activeOutlet?.outlet_id || 1;
    const [items, setItems] = useState<StockItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState('All');
    const [filterCategory, setFilterCategory] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [categories, setCategories] = useState<string[]>([]);

    const loadData = useCallback(async () => {
        if (!activeOutlet) return;
        setLoading(true);
        try {
            const { data: products } = await supabase
                .from('retail_products')
                .select('pid, product_name, category, purchase_unit, sales_unit, purchase_cost, sales_cost, reorder_point')
                .eq('active', true).eq('outlet_id', outletId).order('product_name');

            const { data: stockData } = await supabase
                .from('retail_stock').select('pid, qty').eq('outlet_id', outletId);

            const stockMap: Record<number, number> = {};
            (stockData || []).forEach(s => { stockMap[s.pid] = (stockMap[s.pid] || 0) + (s.qty || 0); });

            const result: StockItem[] = (products || []).map(p => {
                const stock = stockMap[p.pid] || 0;
                const reorder = p.reorder_point || 5;
                let status: StockItem['status'] = 'ok';
                if (stock === 0) status = 'out';
                else if (stock <= reorder * 0.3) status = 'critical';
                else if (stock <= reorder) status = 'low';

                return {
                    pid: p.pid, name: p.product_name, category: p.category || 'Uncategorized',
                    purchaseUnit: p.purchase_unit || 'Piece', salesUnit: p.sales_unit || 'Piece',
                    stock, purchasePrice: p.purchase_cost || 0, salesPrice: p.sales_cost || 0,
                    stockValue: stock * (p.purchase_cost || 0), reorderPoint: reorder, status,
                };
            });

            setItems(result);
            setCategories(Array.from(new Set(result.map(r => r.category))).sort());
        } catch (err) { console.error(err); toast.error('Failed to load stock data'); }
        setLoading(false);
    }, [outletId, activeOutlet]);

    useEffect(() => { loadData(); }, [loadData]);

    const filtered = items.filter(i => {
        const matchStatus = filterStatus === 'All' || i.status === filterStatus.toLowerCase();
        const matchCat = filterCategory === 'All' || i.category === filterCategory;
        const matchSearch = !searchQuery || i.name.toLowerCase().includes(searchQuery.toLowerCase());
        return matchStatus && matchCat && matchSearch;
    });

    const totalProducts = items.length;
    const totalStockValue = filtered.reduce((s, i) => s + i.stockValue, 0);
    const lowStockCount = items.filter(i => i.status === 'low' || i.status === 'critical').length;
    const outOfStockCount = items.filter(i => i.status === 'out').length;
    const totalRetailValue = filtered.reduce((s, i) => s + (i.stock * i.salesPrice), 0);

    const exportCSV = () => {
        const rows = [['Product', 'Category', 'Purchase Unit', 'Sales Unit', 'Stock Qty', 'Purchase Price', 'Sales Price', 'Stock Value', 'Reorder Point', 'Status']];
        filtered.forEach(i => rows.push([i.name, i.category, i.purchaseUnit, i.salesUnit, String(i.stock), String(i.purchasePrice), String(i.salesPrice), String(i.stockValue), String(i.reorderPoint), i.status]));
        const csv = rows.map(r => r.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `stock_report_${new Date().toISOString().split('T')[0]}.csv`; a.click();
        toast.success('CSV exported!');
    };

    const printReport = () => {
        const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Stock Report</title>
<style>@page{margin:8mm;size:A4 landscape;}body{font-family:Arial,sans-serif;font-size:10px;}h1{font-size:16px;}
table{width:100%;border-collapse:collapse;}th,td{border:1px solid #ddd;padding:3px 5px;font-size:9px;}
th{background:#f5f5f5;font-weight:700;}.r{text-align:right;}.out{color:red;font-weight:700;}.low{color:orange;}.ok{color:green;}</style></head><body>
<h1>📊 Stock Report</h1><p>${activeOutlet?.outlet_name || 'Alpha Retail'} | ${new Date().toLocaleDateString('en-GB')} | Total Value: Ksh ${totalStockValue.toLocaleString()}</p>
<table><tr><th>Product</th><th>Category</th><th>Unit</th><th class="r">Stock</th><th class="r">Cost</th><th class="r">Price</th><th class="r">Value</th><th>Status</th></tr>
${filtered.map(i => `<tr><td>${i.name}</td><td>${i.category}</td><td>${i.salesUnit}</td><td class="r">${i.stock}</td><td class="r">Ksh ${i.purchasePrice.toLocaleString()}</td><td class="r">Ksh ${i.salesPrice.toLocaleString()}</td><td class="r">Ksh ${i.stockValue.toLocaleString()}</td><td class="${i.status}">${i.status.toUpperCase()}</td></tr>`).join('')}
</table></body></html>`;
        const w = window.open('', '_blank'); if (w) { w.document.write(html); w.document.close(); w.print(); }
    };

    const statusColors: Record<string, string> = {
        ok: 'bg-green-100 text-green-700', low: 'bg-amber-100 text-amber-700',
        critical: 'bg-red-100 text-red-700', out: 'bg-gray-200 text-gray-700',
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
                    <span className="w-12 h-12 bg-gradient-to-br from-purple-500 to-violet-600 rounded-2xl flex items-center justify-center text-white text-2xl shadow-lg">📊</span>
                    Stock Report
                </h1>
                <div className="flex gap-2">
                    <button onClick={exportCSV} className="px-4 py-2 bg-green-500 text-white rounded-xl font-semibold hover:bg-green-600 text-sm">📥 Export CSV</button>
                    <button onClick={printReport} className="px-4 py-2 bg-blue-500 text-white rounded-xl font-semibold hover:bg-blue-600 text-sm">🖨️ Print</button>
                    <button onClick={loadData} className="px-4 py-2 bg-purple-500 text-white rounded-xl font-semibold hover:bg-purple-600 text-sm">🔄 Refresh</button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-5 gap-4">
                <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-5 text-white shadow-lg">
                    <span className="text-3xl">📦</span><p className="text-sm opacity-80 mt-2">Total Products</p><p className="text-3xl font-bold">{totalProducts}</p>
                </div>
                <div className="bg-gradient-to-br from-emerald-500 to-green-600 rounded-2xl p-5 text-white shadow-lg">
                    <span className="text-3xl">💰</span><p className="text-sm opacity-80 mt-2">Stock Value (Cost)</p><p className="text-2xl font-bold">Ksh {totalStockValue.toLocaleString()}</p>
                </div>
                <div className="bg-gradient-to-br from-teal-500 to-cyan-600 rounded-2xl p-5 text-white shadow-lg">
                    <span className="text-3xl">🏷️</span><p className="text-sm opacity-80 mt-2">Retail Value</p><p className="text-2xl font-bold">Ksh {totalRetailValue.toLocaleString()}</p>
                </div>
                <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl p-5 text-white shadow-lg">
                    <span className="text-3xl">⚠️</span><p className="text-sm opacity-80 mt-2">Low Stock</p><p className="text-3xl font-bold">{lowStockCount}</p>
                </div>
                <div className="bg-gradient-to-br from-red-500 to-rose-600 rounded-2xl p-5 text-white shadow-lg">
                    <span className="text-3xl">🚫</span><p className="text-sm opacity-80 mt-2">Out of Stock</p><p className="text-3xl font-bold">{outOfStockCount}</p>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-2xl border p-4 flex items-center gap-4 flex-wrap">
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-3 py-1.5 border rounded-lg text-sm">
                    <option value="All">All Status</option><option value="ok">In Stock</option><option value="low">Low Stock</option><option value="critical">Critical</option><option value="out">Out of Stock</option>
                </select>
                <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="px-3 py-1.5 border rounded-lg text-sm">
                    <option value="All">All Categories</option>{categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <div className="flex-1">
                    <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="🔍 Search products..." className="w-full px-3 py-1.5 border rounded-lg text-sm" />
                </div>
            </div>

            {/* Stock Table */}
            <div className="bg-white rounded-2xl border overflow-hidden">
                <table className="w-full">
                    <thead className="bg-gradient-to-r from-purple-50 to-violet-50">
                        <tr>
                            <th className="text-left py-3 px-4 text-xs font-bold text-gray-600">Product</th>
                            <th className="text-left py-3 px-4 text-xs font-bold text-gray-600">Category</th>
                            <th className="text-center py-3 px-4 text-xs font-bold text-gray-600">Purchase Unit</th>
                            <th className="text-center py-3 px-4 text-xs font-bold text-gray-600">Sales Unit</th>
                            <th className="text-right py-3 px-4 text-xs font-bold text-gray-600">Stock Qty</th>
                            <th className="text-right py-3 px-4 text-xs font-bold text-gray-600">Cost Price</th>
                            <th className="text-right py-3 px-4 text-xs font-bold text-gray-600">Sales Price</th>
                            <th className="text-right py-3 px-4 text-xs font-bold text-gray-600">Stock Value</th>
                            <th className="text-center py-3 px-4 text-xs font-bold text-gray-600">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={9} className="py-16 text-center text-gray-400">Loading stock data...</td></tr>
                        ) : filtered.length === 0 ? (
                            <tr><td colSpan={9} className="py-16 text-center text-gray-400">No products found</td></tr>
                        ) : filtered.map(item => (
                            <tr key={item.pid} className={`border-t hover:bg-purple-50/30 ${item.status === 'out' ? 'bg-red-50/40' : ''}`}>
                                <td className="py-3 px-4 font-semibold text-sm">{item.name}</td>
                                <td className="py-3 px-4 text-sm"><span className="px-2 py-1 bg-gray-100 rounded-full text-xs">{item.category}</span></td>
                                <td className="py-3 px-4 text-center text-sm text-gray-500">{item.purchaseUnit}</td>
                                <td className="py-3 px-4 text-center text-sm text-gray-500">{item.salesUnit}</td>
                                <td className="py-3 px-4 text-right font-bold text-sm">{item.stock}</td>
                                <td className="py-3 px-4 text-right text-sm">Ksh {item.purchasePrice.toLocaleString()}</td>
                                <td className="py-3 px-4 text-right text-sm">Ksh {item.salesPrice.toLocaleString()}</td>
                                <td className="py-3 px-4 text-right font-semibold text-sm">Ksh {item.stockValue.toLocaleString()}</td>
                                <td className="py-3 px-4 text-center"><span className={`px-2 py-1 rounded-full text-xs font-bold ${statusColors[item.status]}`}>{item.status.toUpperCase()}</span></td>
                            </tr>
                        ))}
                    </tbody>
                    {filtered.length > 0 && (
                        <tfoot>
                            <tr className="bg-gradient-to-r from-purple-50 to-violet-50 font-bold">
                                <td colSpan={4} className="py-3 px-4 text-sm">TOTALS ({filtered.length} products)</td>
                                <td className="py-3 px-4 text-right text-sm">{filtered.reduce((s, i) => s + i.stock, 0)}</td>
                                <td colSpan={2} />
                                <td className="py-3 px-4 text-right text-sm text-purple-600">Ksh {totalStockValue.toLocaleString()}</td>
                                <td />
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>
        </div>
    );
}
