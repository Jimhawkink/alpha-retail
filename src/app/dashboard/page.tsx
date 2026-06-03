'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
    AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import {
    FiTrendingUp, FiTrendingDown, FiShoppingCart, FiPackage,
    FiDollarSign, FiAlertTriangle, FiRefreshCw, FiClock,
    FiArrowUp, FiArrowDown, FiMinus, FiCalendar, FiBarChart2,
    FiActivity, FiCreditCard, FiSmartphone, FiZap
} from 'react-icons/fi';

// ── Helpers ───────────────────────────────────────────────────────────
const fmt = (n: number, sym = 'KSh') =>
    `${sym} ${n.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const pct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;

const COLORS = ['#4f46e5','#059669','#f59e0b','#ef4444','#8b5cf6','#0ea5e9','#ec4899','#14b8a6'];

interface KpiData {
    revenue: number; profit: number; transactions: number; avgOrder: number;
    revYest: number; profitYest: number; txYest: number; avgYest: number;
    expenses: number; grossMargin: number;
}
interface TrendPoint { date: string; revenue: number; profit: number; transactions: number; }
interface ProductMove { name: string; qty: number; revenue: number; profit: number; category: string; }
interface PaymentBreak { method: string; amount: number; count: number; }
interface StockAlert { name: string; qty: number; reorder: number; category: string; }
interface RecentSale { id: number; receipt: string; customer: string; amount: number; method: string; time: string; items: number; }
interface CategorySales { category: string; revenue: number; qty: number; }

// ── Custom tooltip ────────────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-3 text-xs">
            <p className="font-bold text-gray-700 mb-1">{label}</p>
            {payload.map((p: any) => (
                <div key={p.name} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
                    <span className="text-gray-500">{p.name}:</span>
                    <span className="font-bold text-gray-800">{typeof p.value === 'number' ? fmt(p.value) : p.value}</span>
                </div>
            ))}
        </div>
    );
};

// ── KPI Card ──────────────────────────────────────────────────────────
function KpiCard({ title, value, prev, icon: Icon, color, prefix = 'KSh', isCount = false, suffix = '' }: {
    title: string; value: number; prev: number; icon: any; color: string;
    prefix?: string; isCount?: boolean; suffix?: string;
}) {
    const change = prev > 0 ? ((value - prev) / prev) * 100 : 0;
    const up = change >= 0;
    const display = isCount ? value.toLocaleString() : fmt(value, prefix);
    return (
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
                <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{title}</p>
                    <p className="text-2xl font-black text-gray-800 mt-1">{display}{suffix}</p>
                </div>
                <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: `${color}18` }}>
                    <Icon size={20} style={{ color }} />
                </div>
            </div>
            <div className="flex items-center gap-1.5">
                <div className={`flex items-center gap-0.5 text-xs font-bold px-1.5 py-0.5 rounded-full ${up ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
                    {change === 0 ? <FiMinus size={10} /> : up ? <FiArrowUp size={10} /> : <FiArrowDown size={10} />}
                    {pct(change)}
                </div>
                <span className="text-[11px] text-gray-400">vs yesterday</span>
            </div>
        </div>
    );
}

// ── Section header ────────────────────────────────────────────────────
function SectionHeader({ title, sub, icon: Icon, color = '#4f46e5' }: { title: string; sub?: string; icon: any; color?: string }) {
    return (
        <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${color}18` }}>
                <Icon size={15} style={{ color }} />
            </div>
            <div>
                <h3 className="font-black text-gray-800 text-sm">{title}</h3>
                {sub && <p className="text-[11px] text-gray-400">{sub}</p>}
            </div>
        </div>
    );
}

export default function DashboardPage() {
    const [kpi, setKpi]               = useState<KpiData | null>(null);
    const [trend, setTrend]           = useState<TrendPoint[]>([]);
    const [bestMovers, setBestMovers] = useState<ProductMove[]>([]);
    const [slowMovers, setSlowMovers] = useState<ProductMove[]>([]);
    const [payments, setPayments]     = useState<PaymentBreak[]>([]);
    const [stockAlerts, setStockAlerts] = useState<StockAlert[]>([]);
    const [recentSales, setRecentSales] = useState<RecentSale[]>([]);
    const [catSales, setCatSales]     = useState<CategorySales[]>([]);
    const [loading, setLoading]       = useState(true);
    const [range, setRange]           = useState<7 | 30>(7);
    const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
    const [currSym, setCurrSym]       = useState('KSh');

    const today     = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    const loadDashboard = useCallback(async () => {
        setLoading(true);
        try {
            // Currency symbol from settings
            const { data: curr } = await supabase.from('organisation_settings')
                .select('setting_value').eq('setting_key','currency_symbol').single();
            if (curr?.setting_value) setCurrSym(curr.setting_value);

            // ── KPIs: Today ─────────────────────────────────────────
            const { data: todaySales } = await supabase.from('sales')
                .select('total_amount, profit, payment_method')
                .eq('sale_date', today).eq('status','Completed');
            const { data: yesterdaySales } = await supabase.from('sales')
                .select('total_amount, profit')
                .eq('sale_date', yesterday).eq('status','Completed');

            const rev   = todaySales?.reduce((s,r) => s + (r.total_amount||0), 0) || 0;
            const prof  = todaySales?.reduce((s,r) => s + (r.profit||0), 0) || 0;
            const txns  = todaySales?.length || 0;
            const avg   = txns > 0 ? rev / txns : 0;
            const revY  = yesterdaySales?.reduce((s,r) => s + (r.total_amount||0), 0) || 0;
            const profY = yesterdaySales?.reduce((s,r) => s + (r.profit||0), 0) || 0;
            const txY   = yesterdaySales?.length || 0;

            // Today's expenses
            const { data: expData } = await supabase.from('expenses')
                .select('amount').eq('expense_date', today);
            const exps = expData?.reduce((s,r) => s + (r.amount||0), 0) || 0;

            setKpi({
                revenue: rev, profit: prof, transactions: txns, avgOrder: avg,
                revYest: revY, profitYest: profY, txYest: txY, avgYest: txY > 0 ? revY/txY : 0,
                expenses: exps, grossMargin: rev > 0 ? (prof/rev)*100 : 0,
            });

            // ── Revenue trend ────────────────────────────────────────
            const startDate = new Date(Date.now() - (range - 1) * 86400000).toISOString().split('T')[0];
            const { data: trendData } = await supabase.from('sales')
                .select('sale_date, total_amount, profit')
                .gte('sale_date', startDate).eq('status','Completed')
                .order('sale_date');

            const tMap: Record<string, TrendPoint> = {};
            for (let i = range - 1; i >= 0; i--) {
                const d = new Date(Date.now() - i * 86400000).toISOString().split('T')[0];
                const label = new Date(d).toLocaleDateString('en-US', { month:'short', day:'numeric' });
                tMap[d] = { date: label, revenue: 0, profit: 0, transactions: 0 };
            }
            trendData?.forEach(r => {
                if (tMap[r.sale_date]) {
                    tMap[r.sale_date].revenue += r.total_amount || 0;
                    tMap[r.sale_date].profit  += r.profit || 0;
                    tMap[r.sale_date].transactions++;
                }
            });
            setTrend(Object.values(tMap));

            // ── Best moving products (last 30 days) ──────────────────
            const rangeStart = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
            const { data: itemData } = await supabase.from('sales_items')
                .select('product_name, quantity, subtotal, profit, sales!inner(sale_date, status)')
                .gte('sales.sale_date', rangeStart).eq('sales.status','Completed');

            const prodMap: Record<string, { qty: number; revenue: number; profit: number }> = {};
            itemData?.forEach((it: any) => {
                const name = it.product_name || 'Unknown';
                if (!prodMap[name]) prodMap[name] = { qty: 0, revenue: 0, profit: 0 };
                prodMap[name].qty     += it.quantity || 0;
                prodMap[name].revenue += it.subtotal || 0;
                prodMap[name].profit  += it.profit   || 0;
            });
            const sorted = Object.entries(prodMap).map(([name, v]) => ({ name, ...v, category: '' }))
                .sort((a, b) => b.qty - a.qty);
            setBestMovers(sorted.slice(0, 8));
            setSlowMovers(sorted.filter(p => p.qty > 0).slice(-8).reverse());

            // ── Payment breakdown (today) ────────────────────────────
            const pmMap: Record<string, { amount: number; count: number }> = {};
            todaySales?.forEach(r => {
                const m = r.payment_method || 'Cash';
                if (!pmMap[m]) pmMap[m] = { amount: 0, count: 0 };
                pmMap[m].amount += r.total_amount || 0;
                pmMap[m].count++;
            });
            setPayments(Object.entries(pmMap).map(([method, v]) => ({ method, ...v })));

            // ── Stock alerts ─────────────────────────────────────────
            const { data: stockData } = await supabase
                .from('products').select('product_name, reorder_point, category, pid').eq('active', true).limit(200);
            const { data: stockQty } = await supabase.from('stock').select('pid, qty');
            const qtyMap: Record<number, number> = {};
            stockQty?.forEach(s => { qtyMap[s.pid] = (qtyMap[s.pid]||0) + (s.qty||0); });
            const alerts = (stockData || [])
                .map(p => ({ name: p.product_name, qty: qtyMap[p.pid]||0, reorder: p.reorder_point||5, category: p.category||'' }))
                .filter(p => p.qty <= p.reorder)
                .sort((a, b) => a.qty - b.qty).slice(0, 10);
            setStockAlerts(alerts);

            // ── Category sales ───────────────────────────────────────
            const { data: catData } = await supabase.from('sales_items')
                .select('product_id, quantity, subtotal, products!inner(category)')
                .gte('created_at', `${rangeStart}T00:00:00`).limit(2000);
            const catMap: Record<string, { revenue: number; qty: number }> = {};
            catData?.forEach((it: any) => {
                const cat = it.products?.category || 'Uncategorized';
                if (!catMap[cat]) catMap[cat] = { revenue: 0, qty: 0 };
                catMap[cat].revenue += it.subtotal || 0;
                catMap[cat].qty     += it.quantity || 0;
            });
            setCatSales(Object.entries(catMap).map(([category, v]) => ({ category, ...v }))
                .sort((a,b) => b.revenue - a.revenue).slice(0, 8));

            // ── Recent sales ─────────────────────────────────────────
            const { data: recSales } = await supabase.from('sales')
                .select('sale_id, receipt_no, customer_name, total_amount, payment_method, created_at, partial_payment_count')
                .order('created_at', { ascending: false }).limit(15);
            const { data: itemCounts } = await supabase.from('sales_items')
                .select('sale_id').in('sale_id', (recSales||[]).map(s => s.sale_id));
            const countMap: Record<number, number> = {};
            itemCounts?.forEach(i => { countMap[i.sale_id] = (countMap[i.sale_id]||0)+1; });
            setRecentSales((recSales||[]).map(s => ({
                id: s.sale_id, receipt: s.receipt_no || `#${s.sale_id}`,
                customer: s.customer_name || 'Walk-in',
                amount: s.total_amount || 0, method: s.payment_method || 'Cash',
                time: new Date(s.created_at).toLocaleTimeString('en-KE',{hour:'2-digit',minute:'2-digit'}),
                items: countMap[s.sale_id] || 0,
            })));

        } catch (err) { console.error('Dashboard load error:', err); }
        setLoading(false);
        setLastRefresh(new Date());
    }, [today, yesterday, range]);

    useEffect(() => { loadDashboard(); }, [loadDashboard]);

    const paymentIcon: Record<string, any> = {
        Cash: FiDollarSign, Mpesa: FiSmartphone, 'M-Pesa': FiSmartphone,
        Card: FiCreditCard, Credit: FiActivity,
    };
    const paymentColor: Record<string, string> = {
        Cash: '#059669', Mpesa: '#10b981', 'M-Pesa': '#10b981',
        Card: '#4f46e5', Credit: '#f59e0b',
    };

    return (
        <div className="space-y-5">
            <style>{`
                @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
                .fu{animation:fadeUp .35s ease-out}
                .trow:hover{background:#f8fafc}
            `}</style>

            {/* ── Page header ── */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-black text-gray-800">Dashboard</h1>
                    <p className="text-sm text-gray-400 flex items-center gap-1.5 mt-0.5">
                        <FiClock size={12} />
                        Last updated: {lastRefresh.toLocaleTimeString('en-KE',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex bg-white rounded-xl border border-gray-200 overflow-hidden">
                        {([7,30] as const).map(d => (
                            <button key={d} onClick={() => setRange(d)}
                                className={`px-4 py-2 text-xs font-bold transition-all ${range===d ? 'text-white' : 'text-gray-500 hover:bg-gray-50'}`}
                                style={range===d ? {background:'linear-gradient(135deg,#4f46e5,#7c3aed)'} : {}}>
                                {d}D
                            </button>
                        ))}
                    </div>
                    <button onClick={loadDashboard} disabled={loading}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-gray-200 text-xs font-bold text-gray-600 hover:border-indigo-300 hover:text-indigo-600 transition-all disabled:opacity-50">
                        <FiRefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                        Refresh
                    </button>
                </div>
            </div>

            {/* ── KPI Cards ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 fu">
                <KpiCard title="Today's Revenue" value={kpi?.revenue||0} prev={kpi?.revYest||0} icon={FiDollarSign} color="#4f46e5" prefix={currSym} />
                <KpiCard title="Gross Profit" value={kpi?.profit||0} prev={kpi?.profitYest||0} icon={FiTrendingUp} color="#059669" prefix={currSym} />
                <KpiCard title="Transactions" value={kpi?.transactions||0} prev={kpi?.txYest||0} icon={FiShoppingCart} color="#f59e0b" isCount />
                <KpiCard title="Avg Order Value" value={kpi?.avgOrder||0} prev={kpi?.avgYest||0} icon={FiActivity} color="#8b5cf6" prefix={currSym} />
            </div>

            {/* ── Secondary KPIs ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                    { label: 'Gross Margin', val: `${(kpi?.grossMargin||0).toFixed(1)}%`, color:'#4f46e5', icon: FiBarChart2 },
                    { label: "Today's Expenses", val: fmt(kpi?.expenses||0, currSym), color:'#ef4444', icon: FiTrendingDown },
                    { label: 'Net Profit', val: fmt((kpi?.profit||0)-(kpi?.expenses||0), currSym), color:'#059669', icon: FiZap },
                    { label: 'Stock Alerts', val: `${stockAlerts.length} items`, color: stockAlerts.length>5?'#ef4444':'#f59e0b', icon: FiAlertTriangle },
                ].map(c => {
                    const Icon = c.icon;
                    return (
                        <div key={c.label} className="bg-white rounded-xl px-4 py-3 border border-gray-100 shadow-sm flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{background:`${c.color}18`}}>
                                <Icon size={14} style={{color:c.color}} />
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{c.label}</p>
                                <p className="text-sm font-black text-gray-800">{c.val}</p>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* ── Revenue Trend + Payment Breakdown ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Revenue trend chart */}
                <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <SectionHeader title={`Revenue & Profit Trend (${range} days)`} sub="Daily breakdown" icon={FiTrendingUp} />
                    <ResponsiveContainer width="100%" height={220}>
                        <AreaChart data={trend} margin={{top:5,right:5,left:5,bottom:0}}>
                            <defs>
                                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.15}/>
                                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                                </linearGradient>
                                <linearGradient id="profGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#059669" stopOpacity={0.15}/>
                                    <stop offset="95%" stopColor="#059669" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis dataKey="date" tick={{fontSize:10,fill:'#94a3b8'}} axisLine={false} tickLine={false} />
                            <YAxis tick={{fontSize:10,fill:'#94a3b8'}} axisLine={false} tickLine={false} tickFormatter={v => v>=1000?`${(v/1000).toFixed(0)}k`:String(v)} />
                            <Tooltip content={<ChartTooltip />} />
                            <Legend iconType="circle" iconSize={8} wrapperStyle={{fontSize:'11px',paddingTop:'8px'}} />
                            <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#4f46e5" strokeWidth={2.5} fill="url(#revGrad)" dot={false} activeDot={{r:4,fill:'#4f46e5'}} />
                            <Area type="monotone" dataKey="profit"  name="Profit"  stroke="#059669" strokeWidth={2}   fill="url(#profGrad)" dot={false} activeDot={{r:4,fill:'#059669'}} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                {/* Payment methods */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <SectionHeader title="Payment Methods" sub="Today's breakdown" icon={FiCreditCard} color="#059669" />
                    {payments.length === 0 ? (
                        <div className="flex items-center justify-center h-[160px] text-gray-300 text-sm">No sales today</div>
                    ) : (
                        <>
                            <ResponsiveContainer width="100%" height={140}>
                                <PieChart>
                                    <Pie data={payments} dataKey="amount" nameKey="method" cx="50%" cy="50%" outerRadius={60} innerRadius={35} paddingAngle={3}>
                                        {payments.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                    </Pie>
                                    <Tooltip formatter={(val: any) => [fmt(Number(val), currSym), 'Amount']} contentStyle={{fontSize:'11px',borderRadius:'10px'}} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="space-y-1.5 mt-2">
                                {payments.map((p, i) => {
                                    const Icon = paymentIcon[p.method] || FiDollarSign;
                                    const pctShare = kpi?.revenue ? (p.amount/kpi.revenue*100) : 0;
                                    return (
                                        <div key={p.method} className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{background:`${COLORS[i%COLORS.length]}18`}}>
                                                <Icon size={11} style={{color:COLORS[i%COLORS.length]}} />
                                            </div>
                                            <span className="text-xs text-gray-600 flex-1">{p.method}</span>
                                            <div className="w-16 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                                                <div className="h-1.5 rounded-full" style={{width:`${pctShare}%`,background:COLORS[i%COLORS.length]}} />
                                            </div>
                                            <span className="text-[11px] font-bold text-gray-700 w-10 text-right">{pctShare.toFixed(0)}%</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* ── Category Sales Chart ── */}
            {catSales.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <SectionHeader title="Sales by Category (30 days)" sub="Revenue per product category" icon={FiBarChart2} color="#f59e0b" />
                    <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={catSales} layout="vertical" margin={{top:0,right:20,left:60,bottom:0}}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                            <XAxis type="number" tick={{fontSize:10,fill:'#94a3b8'}} axisLine={false} tickLine={false} tickFormatter={v => v>=1000?`${(v/1000).toFixed(0)}k`:String(v)} />
                            <YAxis type="category" dataKey="category" tick={{fontSize:10,fill:'#475569'}} axisLine={false} tickLine={false} width={55} />
                            <Tooltip formatter={(val: any) => [fmt(Number(val),currSym), 'Revenue']} contentStyle={{fontSize:'11px',borderRadius:'10px'}} />

                            <Bar dataKey="revenue" name="Revenue" radius={[0,6,6,0]}>
                                {catSales.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}

            {/* ── Best & Slow Movers ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Best movers */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-5 pt-5 pb-3">
                        <SectionHeader title="🚀 Best Moving Products" sub="Last 30 days by quantity sold" icon={FiTrendingUp} color="#059669" />
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="bg-gray-50 border-y border-gray-100">
                                    <th className="text-left px-5 py-2.5 font-bold text-gray-500 text-[10px] uppercase tracking-wider">#</th>
                                    <th className="text-left px-3 py-2.5 font-bold text-gray-500 text-[10px] uppercase tracking-wider">Product</th>
                                    <th className="text-right px-3 py-2.5 font-bold text-gray-500 text-[10px] uppercase tracking-wider">Qty Sold</th>
                                    <th className="text-right px-5 py-2.5 font-bold text-gray-500 text-[10px] uppercase tracking-wider">Revenue</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {bestMovers.length === 0 ? (
                                    <tr><td colSpan={4} className="text-center py-8 text-gray-300 text-sm">No sales data</td></tr>
                                ) : bestMovers.map((p, i) => (
                                    <tr key={p.name} className="trow transition-colors">
                                        <td className="px-5 py-3">
                                            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white ${i===0?'bg-amber-500':i===1?'bg-gray-400':i===2?'bg-orange-500':'bg-gray-200 !text-gray-500'}`}>{i+1}</span>
                                        </td>
                                        <td className="px-3 py-3 font-semibold text-gray-800 max-w-[160px]">
                                            <div className="truncate">{p.name}</div>
                                        </td>
                                        <td className="px-3 py-3 text-right">
                                            <span className="font-black text-emerald-600">{p.qty.toLocaleString()}</span>
                                        </td>
                                        <td className="px-5 py-3 text-right font-bold text-gray-800">{fmt(p.revenue, currSym)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Slow movers */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-5 pt-5 pb-3">
                        <SectionHeader title="🐢 Slow Moving Products" sub="Lowest sales velocity (30 days)" icon={FiTrendingDown} color="#f59e0b" />
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="bg-gray-50 border-y border-gray-100">
                                    <th className="text-left px-5 py-2.5 font-bold text-gray-500 text-[10px] uppercase tracking-wider">#</th>
                                    <th className="text-left px-3 py-2.5 font-bold text-gray-500 text-[10px] uppercase tracking-wider">Product</th>
                                    <th className="text-right px-3 py-2.5 font-bold text-gray-500 text-[10px] uppercase tracking-wider">Qty Sold</th>
                                    <th className="text-right px-5 py-2.5 font-bold text-gray-500 text-[10px] uppercase tracking-wider">Revenue</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {slowMovers.length === 0 ? (
                                    <tr><td colSpan={4} className="text-center py-8 text-gray-300 text-sm">No data yet</td></tr>
                                ) : slowMovers.map((p, i) => (
                                    <tr key={p.name} className="trow transition-colors">
                                        <td className="px-5 py-3">
                                            <span className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center text-[10px] font-black text-amber-600">{i+1}</span>
                                        </td>
                                        <td className="px-3 py-3 font-semibold text-gray-800 max-w-[160px]">
                                            <div className="truncate">{p.name}</div>
                                        </td>
                                        <td className="px-3 py-3 text-right">
                                            <span className="font-black text-amber-500">{p.qty.toLocaleString()}</span>
                                        </td>
                                        <td className="px-5 py-3 text-right font-bold text-gray-500">{fmt(p.revenue, currSym)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* ── Stock Alerts ── */}
            {stockAlerts.length > 0 && (
                <div className="bg-white rounded-2xl border border-red-100 shadow-sm overflow-hidden">
                    <div className="px-5 pt-5 pb-3 flex items-center justify-between">
                        <SectionHeader title="⚠️ Low Stock Alerts" sub={`${stockAlerts.length} products need restocking`} icon={FiAlertTriangle} color="#ef4444" />
                        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-red-50 text-red-600 border border-red-200">{stockAlerts.length} alerts</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="bg-red-50/50 border-y border-red-100">
                                    <th className="text-left px-5 py-2.5 font-bold text-gray-500 text-[10px] uppercase tracking-wider">Product</th>
                                    <th className="text-left px-3 py-2.5 font-bold text-gray-500 text-[10px] uppercase tracking-wider">Category</th>
                                    <th className="text-right px-3 py-2.5 font-bold text-gray-500 text-[10px] uppercase tracking-wider">Current Stock</th>
                                    <th className="text-right px-5 py-2.5 font-bold text-gray-500 text-[10px] uppercase tracking-wider">Reorder Point</th>
                                    <th className="text-center px-5 py-2.5 font-bold text-gray-500 text-[10px] uppercase tracking-wider">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {stockAlerts.map(a => (
                                    <tr key={a.name} className="trow transition-colors">
                                        <td className="px-5 py-3 font-semibold text-gray-800">{a.name}</td>
                                        <td className="px-3 py-3 text-gray-500">{a.category || '—'}</td>
                                        <td className="px-3 py-3 text-right">
                                            <span className={`font-black ${a.qty===0?'text-red-600':'text-amber-500'}`}>{a.qty}</span>
                                        </td>
                                        <td className="px-5 py-3 text-right text-gray-500">{a.reorder}</td>
                                        <td className="px-5 py-3 text-center">
                                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${a.qty===0?'bg-red-50 text-red-600 border-red-200':'bg-amber-50 text-amber-600 border-amber-200'}`}>
                                                {a.qty===0?'OUT OF STOCK':'LOW STOCK'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ── Recent Transactions ── */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 pt-5 pb-3">
                    <SectionHeader title="Recent Transactions" sub="Latest 15 sales" icon={FiCalendar} />
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="bg-gray-50 border-y border-gray-100">
                                {['Receipt','Customer','Items','Amount','Method','Time'].map(h => (
                                    <th key={h} className="px-4 py-2.5 font-bold text-gray-500 text-[10px] uppercase tracking-wider text-left last:text-right">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {recentSales.length === 0 ? (
                                <tr><td colSpan={6} className="text-center py-8 text-gray-300">No recent transactions</td></tr>
                            ) : recentSales.map(s => {
                                const Icon = paymentIcon[s.method] || FiDollarSign;
                                const col  = paymentColor[s.method] || '#4f46e5';
                                return (
                                    <tr key={s.id} className="trow transition-colors">
                                        <td className="px-4 py-3 font-mono font-bold text-indigo-600">{s.receipt}</td>
                                        <td className="px-4 py-3 text-gray-700 font-medium max-w-[140px]">
                                            <div className="truncate">{s.customer}</div>
                                        </td>
                                        <td className="px-4 py-3 text-gray-500">{s.items} item{s.items!==1?'s':''}</td>
                                        <td className="px-4 py-3 font-black text-gray-800">{fmt(s.amount, currSym)}</td>
                                        <td className="px-4 py-3">
                                            <span className="flex items-center gap-1 w-fit px-2 py-0.5 rounded-full border text-[10px] font-bold"
                                                style={{borderColor:`${col}40`,background:`${col}10`,color:col}}>
                                                <Icon size={9} />{s.method}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right text-gray-400 font-mono">{s.time}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

        </div>
    );
}
