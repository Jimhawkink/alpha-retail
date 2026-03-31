'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';

export default function SalesSummaryPage() {
    const { activeOutlet } = useOutlet();
    const outletId = activeOutlet?.outlet_id || 1;
    const [loading, setLoading] = useState(true);
    const [dateFrom, setDateFrom] = useState(new Date().toISOString().split('T')[0]);
    const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
    const [preset, setPreset] = useState('today');

    // Summary data
    const [totalSales, setTotalSales] = useState(0);
    const [totalCash, setTotalCash] = useState(0);
    const [totalMpesa, setTotalMpesa] = useState(0);
    const [totalCredit, setTotalCredit] = useState(0);
    const [totalCard, setTotalCard] = useState(0);
    const [totalOrders, setTotalOrders] = useState(0);
    const [totalReturns, setTotalReturns] = useState(0);
    const [totalReturnAmount, setTotalReturnAmount] = useState(0);
    const [totalExpenses, setTotalExpenses] = useState(0);
    const [totalPayroll, setTotalPayroll] = useState(0);
    const [totalAdvances, setTotalAdvances] = useState(0);
    const [totalDiscount, setTotalDiscount] = useState(0);
    const [avgOrderValue, setAvgOrderValue] = useState(0);
    const [topCashier, setTopCashier] = useState('');
    const [topCashierSales, setTopCashierSales] = useState(0);
    const [dailyBreakdown, setDailyBreakdown] = useState<Array<{
        date: string; cash: number; mpesa: number; credit: number; total: number; orders: number;
    }>>([]);

    const setDatePreset = (p: string) => {
        setPreset(p);
        const now = new Date();
        const to = now.toISOString().split('T')[0];
        let from = to;
        if (p === '7d') { const d = new Date(); d.setDate(d.getDate() - 7); from = d.toISOString().split('T')[0]; }
        else if (p === '14d') { const d = new Date(); d.setDate(d.getDate() - 14); from = d.toISOString().split('T')[0]; }
        else if (p === '30d') { const d = new Date(); d.setDate(d.getDate() - 30); from = d.toISOString().split('T')[0]; }
        else if (p === 'month') { from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`; }
        else if (p === 'year') { from = `${now.getFullYear()}-01-01`; }
        setDateFrom(from); setDateTo(to);
    };

    const loadSummary = useCallback(async () => {
        if (!activeOutlet) return;
        setLoading(true);

        try {
            // ── Sales Data ──
            const { data: sales } = await supabase
                .from('retail_sales').select('total_amount, payment_method, discount, created_by')
                .eq('outlet_id', outletId)
                .gte('sale_date', dateFrom).lte('sale_date', dateTo);

            const salesArr = sales || [];
            const total = salesArr.reduce((s, r) => s + (r.total_amount || 0), 0);
            const cash = salesArr.filter(r => (r.payment_method || '').toLowerCase().includes('cash')).reduce((s, r) => s + (r.total_amount || 0), 0);
            const mpesa = salesArr.filter(r => (r.payment_method || '').toLowerCase().includes('mpesa')).reduce((s, r) => s + (r.total_amount || 0), 0);
            const credit = salesArr.filter(r => (r.payment_method || '').toLowerCase().includes('credit')).reduce((s, r) => s + (r.total_amount || 0), 0);
            const card = salesArr.filter(r => (r.payment_method || '').toLowerCase().includes('card')).reduce((s, r) => s + (r.total_amount || 0), 0);
            const disc = salesArr.reduce((s, r) => s + (r.discount || 0), 0);

            setTotalSales(total);
            setTotalCash(cash);
            setTotalMpesa(mpesa);
            setTotalCredit(credit);
            setTotalCard(card);
            setTotalOrders(salesArr.length);
            setTotalDiscount(disc);
            setAvgOrderValue(salesArr.length > 0 ? Math.round(total / salesArr.length) : 0);

            // Top cashier
            const cashierMap = new Map<string, number>();
            salesArr.forEach(s => {
                const name = s.created_by || 'Unknown';
                cashierMap.set(name, (cashierMap.get(name) || 0) + (s.total_amount || 0));
            });
            let topName = '', topVal = 0;
            cashierMap.forEach((val, name) => { if (val > topVal) { topName = name; topVal = val; } });
            setTopCashier(topName);
            setTopCashierSales(topVal);

            // ── Daily Sales Breakdown ──
            const { data: rangeSales } = await supabase
                .from('retail_sales').select('sale_date, total_amount, payment_method')
                .eq('outlet_id', outletId)
                .gte('sale_date', dateFrom).lte('sale_date', dateTo)
                .order('sale_date');

            const dayMap = new Map<string, { date: string; cash: number; mpesa: number; credit: number; total: number; orders: number }>();
            const start = new Date(dateFrom); const end = new Date(dateTo);
            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                const key = d.toISOString().split('T')[0];
                dayMap.set(key, { date: key, cash: 0, mpesa: 0, credit: 0, total: 0, orders: 0 });
            }
            (rangeSales || []).forEach(s => {
                const key = s.sale_date;
                if (!dayMap.has(key)) dayMap.set(key, { date: key, cash: 0, mpesa: 0, credit: 0, total: 0, orders: 0 });
                const entry = dayMap.get(key)!;
                const amt = s.total_amount || 0;
                const method = (s.payment_method || '').toLowerCase();
                entry.total += amt; entry.orders += 1;
                if (method.includes('mpesa')) entry.mpesa += amt;
                else if (method.includes('credit')) entry.credit += amt;
                else entry.cash += amt;
            });
            setDailyBreakdown(Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date)));

            // ── Sales Returns ──
            const { data: returns } = await supabase
                .from('sales_returns').select('total_amount, return_date')
                .gte('return_date', dateFrom).lte('return_date', dateTo);
            setTotalReturns((returns || []).length);
            setTotalReturnAmount((returns || []).reduce((s, r) => s + (r.total_amount || 0), 0));

            // ── Expenses ──
            const { data: expenses } = await supabase
                .from('expenses').select('amount')
                .eq('outlet_id', outletId)
                .gte('expense_date', dateFrom).lte('expense_date', dateTo);
            setTotalExpenses((expenses || []).reduce((s, e) => s + (e.amount || 0), 0));

            // ── Payroll ──
            const { data: payroll } = await supabase
                .from('payroll').select('net_pay')
                .gte('pay_date', dateFrom).lte('pay_date', dateTo);
            setTotalPayroll((payroll || []).reduce((s, p) => s + (p.net_pay || 0), 0));

            // ── Advances ──
            const { data: advances } = await supabase
                .from('advances').select('amount')
                .gte('advance_date', dateFrom).lte('advance_date', dateTo);
            setTotalAdvances((advances || []).reduce((s, a) => s + (a.amount || 0), 0));

        } catch (err) {
            console.error('Sales summary error:', err);
        }
        setLoading(false);
    }, [dateFrom, dateTo, outletId, activeOutlet]);

    useEffect(() => { loadSummary(); }, [loadSummary]);

    const fmt = (n: number) => n >= 1000000 ? `${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : n.toLocaleString();
    const netRevenue = totalSales - totalReturnAmount - totalExpenses - totalPayroll - totalAdvances;

    const printSummary = () => {
        const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Sales Summary</title>
<style>@page{margin:10mm;size:A4;}body{font-family:Arial,sans-serif;font-size:11px;color:#000;}h1{font-size:18px;margin:0 0 4px;}
.info{font-size:10px;color:#555;margin-bottom:12px;}.cards{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;}
.card{border:1px solid #ddd;border-radius:6px;padding:8px 12px;min-width:140px;}.card-label{font-size:9px;color:#777;text-transform:uppercase;}
.card-value{font-size:16px;font-weight:700;margin-top:2px;}table{width:100%;border-collapse:collapse;margin-top:8px;}
th,td{border:1px solid #ddd;padding:4px 6px;text-align:left;font-size:10px;}th{background:#f5f5f5;font-weight:700;}
.r{text-align:right;}.b{font-weight:700;}.sum{background:#f0f0f0;font-weight:700;}</style></head><body>
<h1>📈 Sales Summary Report</h1>
<div class="info">${activeOutlet?.outlet_name || 'Alpha Retail'} | ${dateFrom} to ${dateTo}</div>
<div class="cards">
<div class="card"><div class="card-label">Total Sales</div><div class="card-value">Ksh ${totalSales.toLocaleString()}</div></div>
<div class="card"><div class="card-label">Cash</div><div class="card-value">Ksh ${totalCash.toLocaleString()}</div></div>
<div class="card"><div class="card-label">M-Pesa</div><div class="card-value">Ksh ${totalMpesa.toLocaleString()}</div></div>
<div class="card"><div class="card-label">Credit</div><div class="card-value">Ksh ${totalCredit.toLocaleString()}</div></div>
<div class="card"><div class="card-label">Expenses</div><div class="card-value">Ksh ${totalExpenses.toLocaleString()}</div></div>
<div class="card"><div class="card-label">Net Revenue</div><div class="card-value">Ksh ${netRevenue.toLocaleString()}</div></div>
</div>
<table><tr><th>Date</th><th class="r">Cash</th><th class="r">M-Pesa</th><th class="r">Credit</th><th class="r">Total</th><th class="r">Orders</th></tr>
${dailyBreakdown.map(d => `<tr><td>${d.date}</td><td class="r">${d.cash.toLocaleString()}</td><td class="r">${d.mpesa.toLocaleString()}</td><td class="r">${d.credit.toLocaleString()}</td><td class="r b">${d.total.toLocaleString()}</td><td class="r">${d.orders}</td></tr>`).join('')}
<tr class="sum"><td>TOTAL</td><td class="r">${totalCash.toLocaleString()}</td><td class="r">${totalMpesa.toLocaleString()}</td><td class="r">${totalCredit.toLocaleString()}</td><td class="r">${totalSales.toLocaleString()}</td><td class="r">${totalOrders}</td></tr>
</table>
<div style="margin-top:12px;font-size:9px;color:#888;">Printed: ${new Date().toLocaleString('en-GB')}</div></body></html>`;
        const w = window.open('', '_blank'); if (w) { w.document.write(html); w.document.close(); w.print(); }
    };

    return (
        <div className="space-y-6 pb-8">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-extrabold text-gray-900 flex items-center gap-3">
                        <span className="w-12 h-12 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-2xl flex items-center justify-center text-white text-2xl shadow-lg shadow-teal-200">📈</span>
                        Sales Summary
                    </h1>
                    <p className="text-sm text-gray-500 mt-0.5">Comprehensive overview of all transactions</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={printSummary} className="px-4 py-2 bg-blue-500 text-white rounded-xl font-semibold hover:bg-blue-600 transition-all text-sm flex items-center gap-1.5">🖨️ Print</button>
                    <button onClick={loadSummary} className="px-4 py-2 bg-gradient-to-r from-teal-500 to-emerald-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all text-sm flex items-center gap-1.5">
                        {loading ? '⏳' : '🔄'} Refresh
                    </button>
                </div>
            </div>

            {/* Date Filters */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm flex items-center gap-4 flex-wrap">
                <div className="flex gap-1.5">
                    {[
                        { l: 'Today', v: 'today' }, { l: '7 Days', v: '7d' }, { l: '14 Days', v: '14d' },
                        { l: '30 Days', v: '30d' }, { l: 'This Month', v: 'month' }, { l: 'This Year', v: 'year' }
                    ].map(p => (
                        <button key={p.v} onClick={() => setDatePreset(p.v)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${preset === p.v
                                ? 'bg-gradient-to-r from-teal-500 to-emerald-600 text-white shadow-md shadow-teal-200'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                            {p.l}
                        </button>
                    ))}
                </div>
                <div className="flex items-center gap-2 ml-auto">
                    <div className="flex items-center gap-1.5">
                        <label className="text-xs text-gray-500 font-medium">From</label>
                        <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPreset(''); }}
                            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:ring-2 focus:ring-teal-300 focus:outline-none" />
                    </div>
                    <span className="text-gray-400">→</span>
                    <div className="flex items-center gap-1.5">
                        <label className="text-xs text-gray-500 font-medium">To</label>
                        <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPreset(''); }}
                            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:ring-2 focus:ring-teal-300 focus:outline-none" />
                    </div>
                </div>
            </div>

            {/* Loading */}
            {loading && (
                <div className="flex items-center justify-center py-12">
                    <div className="flex flex-col items-center gap-3">
                        <div className="w-10 h-10 border-4 border-teal-400/30 border-t-teal-500 rounded-full animate-spin"></div>
                        <span className="text-gray-400 font-medium">Loading summary...</span>
                    </div>
                </div>
            )}

            {!loading && (
                <>
                    {/* ══════ Payment Mode Cards ══════ */}
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                        {/* Total Sales */}
                        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-5 text-white shadow-lg shadow-emerald-200/50 relative overflow-hidden">
                            <div className="absolute -top-6 -right-6 w-20 h-20 bg-white/10 rounded-full" />
                            <div className="absolute -bottom-3 -left-3 w-14 h-14 bg-white/5 rounded-full" />
                            <p className="text-xs font-semibold opacity-80 uppercase tracking-wider">💰 Total Sales</p>
                            <p className="text-3xl font-extrabold mt-2">Ksh {fmt(totalSales)}</p>
                            <p className="text-xs opacity-70 mt-1">{totalOrders} orders</p>
                        </div>

                        {/* Cash */}
                        <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-5 text-white shadow-lg shadow-green-200/50 relative overflow-hidden">
                            <div className="absolute -top-4 -right-4 w-16 h-16 bg-white/10 rounded-full" />
                            <p className="text-xs font-semibold opacity-80 uppercase tracking-wider">💵 Cash Sales</p>
                            <p className="text-3xl font-extrabold mt-2">Ksh {fmt(totalCash)}</p>
                            <p className="text-xs opacity-70 mt-1">{totalSales > 0 ? ((totalCash / totalSales) * 100).toFixed(1) : 0}% of total</p>
                        </div>

                        {/* M-Pesa */}
                        <div className="bg-gradient-to-br from-lime-500 to-green-600 rounded-2xl p-5 text-white shadow-lg shadow-lime-200/50 relative overflow-hidden">
                            <div className="absolute -bottom-4 -right-4 w-16 h-16 bg-white/10 rounded-full" />
                            <p className="text-xs font-semibold opacity-80 uppercase tracking-wider">📱 M-Pesa Sales</p>
                            <p className="text-3xl font-extrabold mt-2">Ksh {fmt(totalMpesa)}</p>
                            <p className="text-xs opacity-70 mt-1">{totalSales > 0 ? ((totalMpesa / totalSales) * 100).toFixed(1) : 0}% of total</p>
                        </div>

                        {/* Credit */}
                        <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl p-5 text-white shadow-lg shadow-amber-200/50 relative overflow-hidden">
                            <div className="absolute -top-4 -left-4 w-14 h-14 bg-white/10 rounded-full" />
                            <p className="text-xs font-semibold opacity-80 uppercase tracking-wider">🏦 Credit Sales</p>
                            <p className="text-3xl font-extrabold mt-2">Ksh {fmt(totalCredit)}</p>
                            <p className="text-xs opacity-70 mt-1">{totalSales > 0 ? ((totalCredit / totalSales) * 100).toFixed(1) : 0}% of total</p>
                        </div>

                        {/* Card */}
                        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-5 text-white shadow-lg shadow-blue-200/50 relative overflow-hidden">
                            <div className="absolute -bottom-4 -left-4 w-14 h-14 bg-white/10 rounded-full" />
                            <p className="text-xs font-semibold opacity-80 uppercase tracking-wider">💳 Card Sales</p>
                            <p className="text-3xl font-extrabold mt-2">Ksh {fmt(totalCard)}</p>
                            <p className="text-xs opacity-70 mt-1">{totalSales > 0 ? ((totalCard / totalSales) * 100).toFixed(1) : 0}% of total</p>
                        </div>

                        {/* Avg Order */}
                        <div className="bg-gradient-to-br from-violet-600 to-purple-700 rounded-2xl p-5 text-white shadow-lg shadow-purple-200/50 relative overflow-hidden">
                            <div className="absolute -top-4 -right-4 w-16 h-16 bg-white/10 rounded-full" />
                            <p className="text-xs font-semibold opacity-80 uppercase tracking-wider">📊 Avg Order</p>
                            <p className="text-3xl font-extrabold mt-2">Ksh {fmt(avgOrderValue)}</p>
                            <p className="text-xs opacity-70 mt-1">{totalOrders} total orders</p>
                        </div>
                    </div>

                    {/* ══════ Deductions & Net Revenue Cards ══════ */}
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                        {/* Returns */}
                        <div className="bg-white rounded-2xl p-4 border-2 border-rose-200 shadow-sm hover:shadow-md transition-all group">
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">↩️ Sales Returns</p>
                                    <p className="text-xl font-extrabold text-rose-600 mt-1">Ksh {fmt(totalReturnAmount)}</p>
                                    <p className="text-[11px] text-gray-500 mt-0.5">{totalReturns} returns</p>
                                </div>
                                <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center text-lg group-hover:scale-110 transition-transform">↩️</div>
                            </div>
                        </div>

                        {/* Expenses */}
                        <div className="bg-white rounded-2xl p-4 border-2 border-pink-200 shadow-sm hover:shadow-md transition-all group">
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">💸 Expenses</p>
                                    <p className="text-xl font-extrabold text-pink-600 mt-1">Ksh {fmt(totalExpenses)}</p>
                                    <p className="text-[11px] text-gray-500 mt-0.5">Period total</p>
                                </div>
                                <div className="w-10 h-10 rounded-xl bg-pink-100 flex items-center justify-center text-lg group-hover:scale-110 transition-transform">💸</div>
                            </div>
                        </div>

                        {/* Payroll */}
                        <div className="bg-white rounded-2xl p-4 border-2 border-violet-200 shadow-sm hover:shadow-md transition-all group">
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">👥 Payroll</p>
                                    <p className="text-xl font-extrabold text-violet-600 mt-1">Ksh {fmt(totalPayroll)}</p>
                                    <p className="text-[11px] text-gray-500 mt-0.5">Salaries paid</p>
                                </div>
                                <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center text-lg group-hover:scale-110 transition-transform">👥</div>
                            </div>
                        </div>

                        {/* Advances */}
                        <div className="bg-white rounded-2xl p-4 border-2 border-orange-200 shadow-sm hover:shadow-md transition-all group">
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">💵 Advances</p>
                                    <p className="text-xl font-extrabold text-orange-600 mt-1">Ksh {fmt(totalAdvances)}</p>
                                    <p className="text-[11px] text-gray-500 mt-0.5">Staff advances</p>
                                </div>
                                <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center text-lg group-hover:scale-110 transition-transform">💵</div>
                            </div>
                        </div>

                        {/* Discounts */}
                        <div className="bg-white rounded-2xl p-4 border-2 border-amber-200 shadow-sm hover:shadow-md transition-all group">
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">🏷️ Discounts</p>
                                    <p className="text-xl font-extrabold text-amber-600 mt-1">Ksh {fmt(totalDiscount)}</p>
                                    <p className="text-[11px] text-gray-500 mt-0.5">Total given</p>
                                </div>
                                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-lg group-hover:scale-110 transition-transform">🏷️</div>
                            </div>
                        </div>

                        {/* Net Revenue */}
                        <div className={`rounded-2xl p-4 border-2 shadow-sm hover:shadow-md transition-all group ${netRevenue >= 0 ? 'border-emerald-300 bg-emerald-50/50' : 'border-red-300 bg-red-50/50'}`}>
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">📊 Net Revenue</p>
                                    <p className={`text-xl font-extrabold mt-1 ${netRevenue >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>Ksh {fmt(netRevenue)}</p>
                                    <p className="text-[11px] text-gray-500 mt-0.5">After deductions</p>
                                </div>
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg group-hover:scale-110 transition-transform ${netRevenue >= 0 ? 'bg-emerald-100' : 'bg-red-100'}`}>
                                    {netRevenue >= 0 ? '📈' : '📉'}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ══════ Top Cashier Banner ══════ */}
                    {topCashier && (
                        <div className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-2xl px-6 py-4 text-white flex items-center justify-between shadow-lg shadow-purple-200/50">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center text-2xl backdrop-blur-sm">🏆</div>
                                <div>
                                    <p className="text-sm font-medium opacity-90">Top Performer</p>
                                    <p className="text-xl font-extrabold">{topCashier}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-sm opacity-80">Total Sales</p>
                                <p className="text-2xl font-extrabold">Ksh {topCashierSales.toLocaleString()}</p>
                            </div>
                        </div>
                    )}

                    {/* ══════ Daily Breakdown Table ══════ */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="bg-gradient-to-r from-teal-50 to-emerald-50 px-6 py-4 border-b border-gray-100">
                            <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                <span className="w-8 h-8 bg-teal-100 rounded-lg flex items-center justify-center text-sm">📅</span>
                                Daily Breakdown
                            </h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50/80">
                                    <tr>
                                        <th className="text-left py-3 px-5 text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
                                        <th className="text-right py-3 px-5 text-xs font-bold text-green-600 uppercase tracking-wider">💵 Cash</th>
                                        <th className="text-right py-3 px-5 text-xs font-bold text-lime-600 uppercase tracking-wider">📱 M-Pesa</th>
                                        <th className="text-right py-3 px-5 text-xs font-bold text-orange-600 uppercase tracking-wider">🏦 Credit</th>
                                        <th className="text-right py-3 px-5 text-xs font-bold text-gray-700 uppercase tracking-wider">Total</th>
                                        <th className="text-center py-3 px-5 text-xs font-bold text-gray-500 uppercase tracking-wider">Orders</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {dailyBreakdown.length === 0 ? (
                                        <tr><td colSpan={6} className="py-16 text-center text-gray-400">No sales data for this period</td></tr>
                                    ) : dailyBreakdown.map((d, i) => {
                                        const dt = new Date(d.date);
                                        const dayLabel = dt.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
                                        const isToday = d.date === new Date().toISOString().split('T')[0];
                                        return (
                                            <tr key={i} className={`transition-colors ${isToday ? 'bg-teal-50/50' : 'hover:bg-gray-50/50'}`}>
                                                <td className="py-3 px-5 text-sm font-medium text-gray-800">
                                                    {dayLabel}
                                                    {isToday && <span className="ml-2 px-2 py-0.5 bg-teal-100 text-teal-700 rounded-full text-[10px] font-bold">TODAY</span>}
                                                </td>
                                                <td className="py-3 px-5 text-right text-sm font-semibold text-green-600">Ksh {d.cash.toLocaleString()}</td>
                                                <td className="py-3 px-5 text-right text-sm font-semibold text-lime-600">Ksh {d.mpesa.toLocaleString()}</td>
                                                <td className="py-3 px-5 text-right text-sm font-semibold text-orange-600">Ksh {d.credit.toLocaleString()}</td>
                                                <td className="py-3 px-5 text-right text-sm font-extrabold text-gray-800">Ksh {d.total.toLocaleString()}</td>
                                                <td className="py-3 px-5 text-center">
                                                    <span className="px-2.5 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-bold">{d.orders}</span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                {dailyBreakdown.length > 0 && (
                                    <tfoot>
                                        <tr className="bg-gradient-to-r from-teal-50 to-emerald-50 font-extrabold border-t-2 border-teal-200">
                                            <td className="py-3 px-5 text-sm">TOTALS</td>
                                            <td className="py-3 px-5 text-right text-sm text-green-700">Ksh {totalCash.toLocaleString()}</td>
                                            <td className="py-3 px-5 text-right text-sm text-lime-700">Ksh {totalMpesa.toLocaleString()}</td>
                                            <td className="py-3 px-5 text-right text-sm text-orange-700">Ksh {totalCredit.toLocaleString()}</td>
                                            <td className="py-3 px-5 text-right text-sm text-gray-900">Ksh {totalSales.toLocaleString()}</td>
                                            <td className="py-3 px-5 text-center">
                                                <span className="px-3 py-1 bg-teal-200 text-teal-800 rounded-full text-xs font-extrabold">{totalOrders}</span>
                                            </td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
