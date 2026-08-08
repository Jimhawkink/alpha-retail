'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';
import toast from 'react-hot-toast';
import {
    BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart
} from 'recharts';
import {
    FiUsers, FiAlertTriangle, FiCheckCircle, FiClock, FiDollarSign,
    FiSearch, FiFilter, FiDownload, FiRefreshCw, FiTrendingUp, FiTrendingDown,
    FiPhone, FiMail, FiMapPin, FiCalendar, FiStar, FiAlertCircle,
    FiActivity, FiBarChart2, FiPieChart, FiXCircle, FiX, FiArrowUp, FiArrowDown,
    FiFileText, FiBell, FiChevronDown, FiChevronUp
} from 'react-icons/fi';

interface Customer {
    customer_id: number; customer_code: string; customer_name: string;
    phone: string; email: string; address: string; credit_limit: number;
    current_balance: number; opening_balance: number; active: boolean;
    outlet_id: number; notes: string; created_at: string;
}
interface Payment {
    payment_id: number; customer_id: number; amount_paid: number;
    payment_date: string; payment_datetime: string; transaction_type: string;
    payment_method: string; outlet_id: number; created_at: string;
}
interface Sale {
    sale_id: number; customer_id: number; total_amount: number;
    amount_paid: number; sale_date: string; sale_datetime: string;
    payment_method: string; status: string;
}
interface Pledge {
    pledge_id: number; customer_id: number; pledge_date: string;
    pledge_amount: number; note: string; status: string; created_at: string;
    customer_name?: string; phone?: string;
}

type AgingBucket = '0-30' | '31-60' | '61-90' | '90+';
type ActivityFilter = 'all' | 'active' | 'inactive' | 'busy' | 'quiet' | 'overdue' | 'over_limit';

const AGING_COLORS = ['#10B981', '#F59E0B', '#EF4444', '#7C3AED'];
const CHART_COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'];

export default function CustomerAtGlancePage() {
    const { activeOutlet, outlets } = useOutlet();
    const outletId = activeOutlet?.outlet_id ?? null;

    const [customers, setCustomers] = useState<Customer[]>([]);
    const [payments, setPayments] = useState<Payment[]>([]);
    const [sales, setSales] = useState<Sale[]>([]);
    const [pledges, setPledges] = useState<Pledge[]>([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [search, setSearch] = useState('');
    const [phoneSearch, setPhoneSearch] = useState('');
    const [dateFrom, setDateFrom] = useState(() => {
        const d = new Date(); d.setMonth(d.getMonth() - 6);
        return d.toISOString().split('T')[0];
    });
    const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
    const [activityFilter, setActivityFilter] = useState<ActivityFilter>('all');
    const [minBalance, setMinBalance] = useState('');
    const [maxBalance, setMaxBalance] = useState('');
    const [sortBy, setSortBy] = useState<'balance' | 'name' | 'activity' | 'aging'>('balance');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
    const [expandedCustomer, setExpandedCustomer] = useState<number | null>(null);
    const [activeChart, setActiveChart] = useState<'aging' | 'payments' | 'trend'>('aging');
    const [showFilters, setShowFilters] = useState(false);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            let cQ = supabase.from('retail_credit_customers').select('*').order('customer_name');
            if (outletId) cQ = cQ.eq('outlet_id', outletId);
            const { data: cData } = await cQ;

            const ids = (cData || []).map((c: Customer) => c.customer_id);
            if (ids.length === 0) { setCustomers([]); setPayments([]); setSales([]); setPledges([]); setLoading(false); return; }

            const [pRes, sRes, plRes] = await Promise.all([
                supabase.from('retail_credit_payments').select('*')
                    .in('customer_id', ids).gte('payment_date', dateFrom).lte('payment_date', dateTo)
                    .order('payment_date'),
                supabase.from('retail_sales').select('*')
                    .in('customer_id', ids).not('customer_id', 'is', null)
                    .gte('sale_date', dateFrom).lte('sale_date', dateTo),
                supabase.from('retail_credit_pledges').select('*, retail_credit_customers(customer_name, phone)')
                    .in('customer_id', ids).order('pledge_date'),
            ]);

            setCustomers(cData || []);
            setPayments(pRes.data || []);
            setSales(sRes.data || []);
            const rawPledges = (plRes.data || []).map((p: any) => ({
                ...p,
                customer_name: p.retail_credit_customers?.customer_name,
                phone: p.retail_credit_customers?.phone,
            }));
            setPledges(rawPledges);
        } catch (e) {
            toast.error('Failed to load data');
        }
        setLoading(false);
    }, [outletId, dateFrom, dateTo]);

    useEffect(() => { loadData(); }, [loadData]);

    // Aging calculation
    const getAgingDays = (c: Customer) => {
        if (c.current_balance <= 0) return 0;
        const lastPayment = payments.filter(p => p.customer_id === c.customer_id && p.transaction_type === 'payment')
            .sort((a, b) => b.payment_date.localeCompare(a.payment_date))[0];
        const refDate = lastPayment?.payment_date || c.created_at?.split('T')[0] || c.created_at;
        return Math.floor((Date.now() - new Date(refDate).getTime()) / 86400000);
    };

    const getAgingBucket = (days: number): AgingBucket => {
        if (days <= 30) return '0-30';
        if (days <= 60) return '31-60';
        if (days <= 90) return '61-90';
        return '90+';
    };

    const getCustomerActivity = (c: Customer) => {
        const custSales = sales.filter(s => s.customer_id === c.customer_id);
        const custPayments = payments.filter(p => p.customer_id === c.customer_id && p.transaction_type === 'payment');
        return { salesCount: custSales.length, paymentsCount: custPayments.length, totalSales: custSales.reduce((s, x) => s + x.total_amount, 0), totalPaid: custPayments.reduce((s, x) => s + x.amount_paid, 0) };
    };

    // Filtered & sorted customers
    const filtered = useMemo(() => {
        let list = customers;
        if (search) list = list.filter(c => c.customer_name?.toLowerCase().includes(search.toLowerCase()) || c.customer_code?.toLowerCase().includes(search.toLowerCase()));
        if (phoneSearch) list = list.filter(c => c.phone?.includes(phoneSearch));
        if (minBalance) list = list.filter(c => c.current_balance >= Number(minBalance));
        if (maxBalance) list = list.filter(c => c.current_balance <= Number(maxBalance));
        switch (activityFilter) {
            case 'active': list = list.filter(c => c.active); break;
            case 'inactive': list = list.filter(c => !c.active); break;
            case 'overdue': list = list.filter(c => getAgingDays(c) > 30 && c.current_balance > 0); break;
            case 'over_limit': list = list.filter(c => c.credit_limit > 0 && c.current_balance > c.credit_limit); break;
            case 'busy': list = list.filter(c => { const a = getCustomerActivity(c); return a.salesCount >= 3; }); break;
            case 'quiet': list = list.filter(c => { const a = getCustomerActivity(c); return a.salesCount < 2; }); break;
        }
        list = [...list].sort((a, b) => {
            let va: any, vb: any;
            if (sortBy === 'balance') { va = a.current_balance; vb = b.current_balance; }
            else if (sortBy === 'name') { va = a.customer_name; vb = b.customer_name; }
            else if (sortBy === 'activity') { va = getCustomerActivity(a).salesCount; vb = getCustomerActivity(b).salesCount; }
            else { va = getAgingDays(a); vb = getAgingDays(b); }
            if (va < vb) return sortDir === 'asc' ? -1 : 1;
            if (va > vb) return sortDir === 'asc' ? 1 : -1;
            return 0;
        });
        return list;
    }, [customers, search, phoneSearch, minBalance, maxBalance, activityFilter, sortBy, sortDir, payments, sales]);

    // KPIs
    const totalOwed = customers.reduce((s, c) => s + Math.max(0, c.current_balance), 0);
    const totalPrepayment = customers.reduce((s, c) => s + Math.max(0, -(c.current_balance)), 0);
    const totalCollected = payments.filter(p => p.transaction_type === 'payment').reduce((s, p) => s + p.amount_paid, 0);
    const overLimitCount = customers.filter(c => c.credit_limit > 0 && c.current_balance > c.credit_limit).length;
    const overdueCustomers = customers.filter(c => getAgingDays(c) > 30 && c.current_balance > 0);
    const activeCount = customers.filter(c => c.active).length;
    const pendingPledges = pledges.filter(p => p.status === 'pending' && new Date(p.pledge_date) <= new Date());

    // Aging chart data
    const agingData = useMemo(() => {
        const buckets: Record<AgingBucket, { count: number; amount: number }> = { '0-30': { count: 0, amount: 0 }, '31-60': { count: 0, amount: 0 }, '61-90': { count: 0, amount: 0 }, '90+': { count: 0, amount: 0 } };
        customers.filter(c => c.current_balance > 0).forEach(c => {
            const b = getAgingBucket(getAgingDays(c));
            buckets[b].count++;
            buckets[b].amount += c.current_balance;
        });
        return Object.entries(buckets).map(([name, v]) => ({ name, count: v.count, amount: Math.round(v.amount) }));
    }, [customers, payments]);

    // Payments vs Sales monthly trend
    const trendData = useMemo(() => {
        const months: Record<string, { month: string; payments: number; sales: number }> = {};
        payments.filter(p => p.transaction_type === 'payment').forEach(p => {
            const m = p.payment_date?.substring(0, 7) || '';
            if (!months[m]) months[m] = { month: m, payments: 0, sales: 0 };
            months[m].payments += p.amount_paid;
        });
        sales.forEach(s => {
            const m = s.sale_date?.substring(0, 7) || '';
            if (!months[m]) months[m] = { month: m, payments: 0, sales: 0 };
            months[m].sales += s.total_amount;
        });
        return Object.values(months).sort((a, b) => a.month.localeCompare(b.month))
            .map(m => ({ ...m, month: new Date(m.month + '-01').toLocaleDateString('en', { month: 'short', year: '2-digit' }), payments: Math.round(m.payments), sales: Math.round(m.sales) }));
    }, [payments, sales]);

    // Pie data (aging by amount)
    const pieData = agingData.map((d, i) => ({ name: d.name + ' days', value: d.amount, color: AGING_COLORS[i] })).filter(d => d.value > 0);

    const exportCSV = () => {
        const h = ['Code', 'Name', 'Phone', 'Email', 'Balance (Ksh)', 'Credit Limit', 'Aging (days)', 'Bucket', 'Sales Count', 'Total Sales', 'Total Paid', 'Active', 'Outlet', 'Notes'];
        const rows = filtered.map(c => {
            const days = getAgingDays(c);
            const act = getCustomerActivity(c);
            return [c.customer_code, c.customer_name, c.phone, c.email, c.current_balance, c.credit_limit, days, getAgingBucket(days), act.salesCount, act.totalSales, act.totalPaid, c.active ? 'Yes' : 'No', outlets.find(o => o.outlet_id === c.outlet_id)?.outlet_name || '-', c.notes || ''];
        });
        const csv = [h, ...rows].map(r => r.map(v => `"${v ?? ''}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob); const a = document.createElement('a');
        a.href = url; a.download = `customer-at-glance-${dateTo}.csv`; a.click();
        URL.revokeObjectURL(url); toast.success('Exported!');
    };

    const fmtKsh = (n: number) => `Ksh ${(n || 0).toLocaleString()}`;
    const toggleSort = (col: typeof sortBy) => { if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortBy(col); setSortDir('desc'); } };

    const agingColor = (days: number) => days <= 30 ? 'text-emerald-600 bg-emerald-50' : days <= 60 ? 'text-amber-600 bg-amber-50' : days <= 90 ? 'text-orange-600 bg-orange-50' : 'text-red-600 bg-red-50';
    const balanceColor = (c: Customer) => c.current_balance <= 0 ? 'text-emerald-600' : c.credit_limit > 0 && c.current_balance > c.credit_limit ? 'text-red-600 font-black' : 'text-gray-800';

    return (
        <div className="space-y-5" style={{ fontFamily: "'Inter','Segoe UI',system-ui,sans-serif" }}>

            {/* ━━━ OVERDUE PLEDGE ALERTS ━━━ */}
            {pendingPledges.length > 0 && (
                <div className="rounded-2xl border border-red-200 overflow-hidden" style={{ background: 'linear-gradient(135deg,#FEF2F2,#FFF7F7)' }}>
                    <div className="px-5 py-3 flex items-center justify-between border-b border-red-100">
                        <div className="flex items-center gap-2 text-red-700 font-bold text-sm">
                            <FiBell className="animate-pulse" size={16} />
                            ⚠️ {pendingPledges.length} Overdue Payment Pledge{pendingPledges.length > 1 ? 's' : ''}
                        </div>
                        <span className="text-xs text-red-400">These customers pledged to pay but haven't yet</span>
                    </div>
                    <div className="divide-y divide-red-50">
                        {pendingPledges.slice(0, 5).map(p => (
                            <div key={p.pledge_id} className="px-5 py-2.5 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-7 h-7 rounded-lg bg-red-100 flex items-center justify-center"><FiAlertTriangle size={13} className="text-red-500" /></div>
                                    <div>
                                        <span className="font-semibold text-sm text-gray-800">{p.customer_name}</span>
                                        {p.phone && <span className="text-xs text-gray-400 ml-2">{p.phone}</span>}
                                        {p.note && <span className="text-xs text-gray-500 ml-2 italic">"{p.note}"</span>}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-red-600 font-black text-sm">{fmtKsh(p.pledge_amount)}</div>
                                    <div className="text-xs text-red-400">Pledged: {new Date(p.pledge_date).toLocaleDateString()}</div>
                                </div>
                            </div>
                        ))}
                        {pendingPledges.length > 5 && <div className="px-5 py-2 text-xs text-red-400 text-center">+{pendingPledges.length - 5} more overdue pledges</div>}
                    </div>
                </div>
            )}

            {/* ━━━ PREMIUM BANNER ━━━ */}
            <div className="rounded-2xl overflow-hidden shadow-2xl" style={{ background: 'linear-gradient(135deg,#0F0C29 0%,#302B63 50%,#24243E 100%)' }}>
                <div className="px-6 py-5">
                    <div className="flex items-center gap-2 text-indigo-300 text-xs mb-3">
                        <span>Dashboard</span><span className="opacity-50">/</span>
                        <span>Reports</span><span className="opacity-50">/</span>
                        <span className="text-violet-200 font-semibold">👥 Customer at Glance</span>
                    </div>
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                        <div className="flex items-start gap-4">
                            <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0" style={{ background: 'linear-gradient(135deg,#6366F1,#8B5CF6)' }}>
                                <FiUsers size={26} color="#fff" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                    <h1 className="text-2xl font-black text-white">Customer at Glance</h1>
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-400 text-violet-900">CREDIT ANALYTICS</span>
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400 text-amber-900">
                                        {outlets.find(o => o.outlet_id === outletId)?.outlet_name || 'All Outlets'}
                                    </span>
                                    {pendingPledges.length > 0 && (
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-400 text-red-900 animate-pulse">
                                            🔔 {pendingPledges.length} OVERDUE PLEDGES
                                        </span>
                                    )}
                                </div>
                                <p className="text-indigo-200 text-sm">Aging analysis · Pledge tracking · Payment trends · Activity scoring · Full export</p>
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                    {['Aging Buckets', 'Payment Trends', 'Pledge Alerts', 'Activity Score', 'CSV Export', 'Bar & Line Charts'].map(tag => (
                                        <span key={tag} className="px-2 py-0.5 rounded text-[10px] text-indigo-200 border border-white/10" style={{ background: 'rgba(255,255,255,0.07)' }}>{tag}</span>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <button onClick={loadData} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-indigo-200 hover:text-white hover:bg-white/10 border border-white/10 transition-all"><FiRefreshCw size={12} /> Refresh</button>
                            <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white shadow-lg active:scale-95 transition-all" style={{ background: 'linear-gradient(135deg,#059669,#10B981)' }}><FiDownload size={14} /> Export CSV</button>
                        </div>
                    </div>
                </div>
                {/* KPI Bar */}
                <div className="grid grid-cols-3 md:grid-cols-6 border-t border-white/10">
                    {[
                        { l: 'Customers', v: String(customers.length), c: '#A5B4FC' },
                        { l: 'Total Owed', v: `Ksh ${Math.round(totalOwed).toLocaleString()}`, c: '#F87171' },
                        { l: 'Collected', v: `Ksh ${Math.round(totalCollected).toLocaleString()}`, c: '#34D399' },
                        { l: 'Prepayments', v: `Ksh ${Math.round(totalPrepayment).toLocaleString()}`, c: '#60A5FA' },
                        { l: 'Over Limit', v: String(overLimitCount), c: '#FCD34D' },
                        { l: 'Overdue >30d', v: String(overdueCustomers.length), c: '#F87171' },
                    ].map((s, i) => (
                        <div key={i} className="px-4 py-3 flex items-center gap-2 border-r border-white/10 last:border-0">
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: s.c + '22' }}>
                                <FiUsers size={11} style={{ color: s.c }} />
                            </div>
                            <div>
                                <div className="text-sm font-black leading-none" style={{ color: s.c }}>{s.v}</div>
                                <div className="text-[9px] text-indigo-300 leading-tight mt-0.5">{s.l}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ━━━ FILTER BAR ━━━ */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-5 py-3 flex items-center justify-between border-b border-gray-100 cursor-pointer" onClick={() => setShowFilters(f => !f)}>
                    <div className="flex items-center gap-2 text-sm font-bold text-gray-700"><FiFilter size={15} /> Filters & Search</div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">{filtered.length} of {customers.length} customers shown</span>
                        {showFilters ? <FiChevronUp size={15} className="text-gray-400" /> : <FiChevronDown size={15} className="text-gray-400" />}
                    </div>
                </div>
                <div className={`transition-all overflow-hidden ${showFilters ? 'max-h-96' : 'max-h-0'}`}>
                    <div className="p-5 grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="relative"><FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Customer name / code..." className="w-full pl-9 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400 transition-all" /></div>
                        <div className="relative"><FiPhone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} /><input value={phoneSearch} onChange={e => setPhoneSearch(e.target.value)} placeholder="Phone number..." className="w-full pl-9 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400 transition-all" /></div>
                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Date From</label>
                            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400 transition-all" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Date To</label>
                            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400 transition-all" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Min Balance (Ksh)</label>
                            <input type="number" value={minBalance} onChange={e => setMinBalance(e.target.value)} placeholder="0" className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400 transition-all" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Max Balance (Ksh)</label>
                            <input type="number" value={maxBalance} onChange={e => setMaxBalance(e.target.value)} placeholder="Any" className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400 transition-all" />
                        </div>
                        <div className="lg:col-span-2">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Customer Type</label>
                            <div className="flex flex-wrap gap-1.5">
                                {([['all', 'All'], ['active', '✅ Active'], ['inactive', '❌ Inactive'], ['busy', '🔥 Busy (3+ sales)'], ['quiet', '😴 Quiet'], ['overdue', '⚠️ Overdue >30d'], ['over_limit', '🚨 Over Limit']] as const).map(([v, l]) => (
                                    <button key={v} onClick={() => setActivityFilter(v)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${activityFilter === v ? 'bg-indigo-600 text-white shadow' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{l}</button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
                {/* Always-visible quick filters */}
                <div className="px-5 py-3 flex flex-wrap gap-2 border-t border-gray-100">
                    <span className="text-xs text-gray-400 self-center">Quick:</span>
                    {([['all', 'All Customers'], ['active', '✅ Active'], ['overdue', '⚠️ Overdue'], ['busy', '🔥 Busy'], ['over_limit', '🚨 Over Limit']] as const).map(([v, l]) => (
                        <button key={v} onClick={() => setActivityFilter(v)} className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${activityFilter === v ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{l}</button>
                    ))}
                    <button onClick={() => setShowFilters(f => !f)} className="ml-auto px-3 py-1 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-all">
                        {showFilters ? 'Hide filters' : 'More filters...'}
                    </button>
                </div>
            </div>

            {/* ━━━ CHARTS ROW ━━━ */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-5 py-4 flex items-center justify-between border-b border-gray-100">
                    <div className="flex items-center gap-2 font-bold text-gray-800 text-sm"><FiBarChart2 size={16} className="text-indigo-500" /> Analytics</div>
                    <div className="flex gap-1">
                        {([['aging', '📊 Aging'], ['payments', '💰 Paid vs Owed'], ['trend', '📈 Monthly Trend']] as const).map(([k, l]) => (
                            <button key={k} onClick={() => setActiveChart(k)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeChart === k ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{l}</button>
                        ))}
                    </div>
                </div>
                <div className="p-5">
                    {loading ? (
                        <div className="h-64 flex items-center justify-center text-gray-400 text-sm">Loading chart data...</div>
                    ) : activeChart === 'aging' ? (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div>
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Outstanding Amount by Aging Bucket</h3>
                                <ResponsiveContainer width="100%" height={260}>
                                    <BarChart data={agingData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                                        <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                                        <Tooltip formatter={(v: number) => [`Ksh ${v.toLocaleString()}`, 'Outstanding']} />
                                        <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                                            {agingData.map((_, i) => <Cell key={i} fill={AGING_COLORS[i]} />)}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                            <div>
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Aging Distribution (by Ksh)</h3>
                                <div className="flex gap-4 items-center h-[260px]">
                                    <ResponsiveContainer width="60%" height="100%">
                                        <PieChart>
                                            <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="value">
                                                {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                                            </Pie>
                                            <Tooltip formatter={(v: number) => `Ksh ${v.toLocaleString()}`} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div className="flex flex-col gap-2">
                                        {agingData.map((d, i) => (
                                            <div key={i} className="flex items-center gap-2">
                                                <div className="w-3 h-3 rounded-full" style={{ background: AGING_COLORS[i] }} />
                                                <div>
                                                    <div className="text-xs font-bold text-gray-700">{d.name} days</div>
                                                    <div className="text-xs text-gray-400">{d.count} customers · Ksh {d.amount.toLocaleString()}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : activeChart === 'payments' ? (
                        <div>
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Payments Collected vs Outstanding (by Customer)</h3>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={filtered.slice(0, 20).map(c => { const act = getCustomerActivity(c); return { name: c.customer_name?.split(' ')[0] || c.customer_code, paid: Math.round(act.totalPaid), owed: Math.round(Math.max(0, c.current_balance)) }; })} margin={{ top: 5, right: 10, left: 10, bottom: 40 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                                    <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-35} textAnchor="end" />
                                    <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                                    <Tooltip formatter={(v: number) => `Ksh ${v.toLocaleString()}`} />
                                    <Legend />
                                    <Bar dataKey="paid" fill="#10B981" name="Paid" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="owed" fill="#EF4444" name="Outstanding" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div>
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Monthly Sales vs Payments Trend</h3>
                            <ResponsiveContainer width="100%" height={300}>
                                <AreaChart data={trendData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                                    <defs>
                                        <linearGradient id="gradSales" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366F1" stopOpacity={0.3} /><stop offset="95%" stopColor="#6366F1" stopOpacity={0} /></linearGradient>
                                        <linearGradient id="gradPayments" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10B981" stopOpacity={0.3} /><stop offset="95%" stopColor="#10B981" stopOpacity={0} /></linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                                    <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                                    <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                                    <Tooltip formatter={(v: number) => `Ksh ${v.toLocaleString()}`} />
                                    <Legend />
                                    <Area type="monotone" dataKey="sales" stroke="#6366F1" fill="url(#gradSales)" strokeWidth={2} name="Sales" dot={{ r: 3 }} />
                                    <Area type="monotone" dataKey="payments" stroke="#10B981" fill="url(#gradPayments)" strokeWidth={2} name="Payments" dot={{ r: 3 }} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>
            </div>

            {/* ━━━ CUSTOMER TABLE ━━━ */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-5 py-4 flex items-center justify-between border-b border-gray-100">
                    <div className="flex items-center gap-2 font-bold text-gray-800 text-sm"><FiUsers size={15} className="text-indigo-500" /> {filtered.length} Customers</div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                        Sort by:
                        {([['balance', 'Balance'], ['name', 'Name'], ['activity', 'Activity'], ['aging', 'Aging']] as const).map(([col, label]) => (
                            <button key={col} onClick={() => toggleSort(col)} className={`px-2 py-1 rounded font-semibold transition-all flex items-center gap-1 ${sortBy === col ? 'bg-indigo-100 text-indigo-700' : 'hover:bg-gray-100 text-gray-500'}`}>
                                {label}{sortBy === col && (sortDir === 'asc' ? <FiArrowUp size={10} /> : <FiArrowDown size={10} />)}
                            </button>
                        ))}
                    </div>
                </div>

                {loading ? (
                    <div className="p-12 text-center text-gray-400">
                        <div className="w-8 h-8 border-3 border-indigo-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                        Loading customers...
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="p-12 text-center text-gray-400">
                        <FiUsers size={36} className="mx-auto mb-3 opacity-30" />
                        <p>No customers match your filters</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                                    <th className="px-4 py-3 text-left font-bold">Customer</th>
                                    <th className="px-4 py-3 text-left font-bold">Contact</th>
                                    <th className="px-4 py-3 text-right font-bold">Balance</th>
                                    <th className="px-4 py-3 text-right font-bold">Credit Limit</th>
                                    <th className="px-4 py-3 text-center font-bold">Aging</th>
                                    <th className="px-4 py-3 text-center font-bold">Sales</th>
                                    <th className="px-4 py-3 text-right font-bold">Collected</th>
                                    <th className="px-4 py-3 text-center font-bold">Pledges</th>
                                    <th className="px-4 py-3 text-center font-bold">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filtered.map(c => {
                                    const act = getCustomerActivity(c);
                                    const days = getAgingDays(c);
                                    const bucket = getAgingBucket(days);
                                    const custPledges = pledges.filter(p => p.customer_id === c.customer_id);
                                    const overduePledges = custPledges.filter(p => p.status === 'pending' && new Date(p.pledge_date) <= new Date());
                                    const utilPct = c.credit_limit > 0 ? Math.round((c.current_balance / c.credit_limit) * 100) : 0;
                                    const isExpanded = expandedCustomer === c.customer_id;

                                    return (
                                        <>
                                            <tr key={c.customer_id} onClick={() => setExpandedCustomer(isExpanded ? null : c.customer_id)} className={`cursor-pointer transition-colors ${isExpanded ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${c.active ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-400'}`}>
                                                            {c.customer_name?.charAt(0) || '?'}
                                                        </div>
                                                        <div>
                                                            <div className="font-semibold text-gray-800 text-sm">{c.customer_name}</div>
                                                            <div className="text-xs text-gray-400">{c.customer_code}</div>
                                                        </div>
                                                        {overduePledges.length > 0 && <span className="ml-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] flex items-center justify-center animate-pulse font-bold">{overduePledges.length}</span>}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-xs text-gray-500">
                                                    <div>{c.phone || '—'}</div>
                                                    <div className="text-gray-400">{c.email || ''}</div>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <span className={`font-bold text-sm ${balanceColor(c)}`}>{fmtKsh(c.current_balance)}</span>
                                                    {utilPct > 0 && <div className="text-[10px] text-gray-400 mt-0.5">{utilPct}% of limit</div>}
                                                </td>
                                                <td className="px-4 py-3 text-right text-xs text-gray-500">{c.credit_limit > 0 ? fmtKsh(c.credit_limit) : <span className="text-emerald-500">Unlimited</span>}</td>
                                                <td className="px-4 py-3 text-center">
                                                    {c.current_balance > 0 ? (
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${agingColor(days)}`}>{bucket} days</span>
                                                    ) : (
                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold text-emerald-600 bg-emerald-50">✓ Clear</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${act.salesCount >= 5 ? 'bg-amber-100 text-amber-700' : act.salesCount >= 2 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                                                        {act.salesCount} {act.salesCount >= 5 ? '🔥' : ''}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-right text-xs font-semibold text-emerald-600">{fmtKsh(act.totalPaid)}</td>
                                                <td className="px-4 py-3 text-center">
                                                    {custPledges.length > 0 ? (
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${overduePledges.length > 0 ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-gray-100 text-gray-500'}`}>
                                                            {overduePledges.length > 0 ? `⚠️ ${overduePledges.length} overdue` : `${custPledges.length} pledge${custPledges.length > 1 ? 's' : ''}`}
                                                        </span>
                                                    ) : <span className="text-gray-300 text-[10px]">None</span>}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${c.active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'}`}>
                                                        {c.active ? 'Active' : 'Inactive'}
                                                    </span>
                                                </td>
                                            </tr>
                                            {isExpanded && (
                                                <tr key={`${c.customer_id}-exp`} className="bg-indigo-50/50">
                                                    <td colSpan={9} className="px-6 py-4">
                                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                                                            <div className="bg-white rounded-xl p-3 border border-indigo-100">
                                                                <div className="font-bold text-gray-600 mb-2 flex items-center gap-1"><FiActivity size={12} /> Activity Summary</div>
                                                                <div className="space-y-1 text-gray-600">
                                                                    <div className="flex justify-between"><span>Total Sales:</span><span className="font-bold">{fmtKsh(act.totalSales)}</span></div>
                                                                    <div className="flex justify-between"><span>Payments Made:</span><span className="font-bold text-emerald-600">{fmtKsh(act.totalPaid)}</span></div>
                                                                    <div className="flex justify-between"><span>Sales Count:</span><span className="font-bold">{act.salesCount}</span></div>
                                                                    <div className="flex justify-between"><span>Payment Count:</span><span className="font-bold">{act.paymentsCount}</span></div>
                                                                    <div className="flex justify-between"><span>Opening Balance:</span><span className="font-bold">{fmtKsh(c.opening_balance)}</span></div>
                                                                </div>
                                                            </div>
                                                            <div className="bg-white rounded-xl p-3 border border-indigo-100">
                                                                <div className="font-bold text-gray-600 mb-2 flex items-center gap-1"><FiMapPin size={12} /> Details</div>
                                                                <div className="space-y-1 text-gray-600">
                                                                    <div><span className="text-gray-400">Phone:</span> {c.phone || '—'}</div>
                                                                    <div><span className="text-gray-400">Email:</span> {c.email || '—'}</div>
                                                                    <div><span className="text-gray-400">Address:</span> {c.address || '—'}</div>
                                                                    <div><span className="text-gray-400">Since:</span> {c.created_at ? new Date(c.created_at).toLocaleDateString() : '—'}</div>
                                                                    {c.notes && <div><span className="text-gray-400">Notes:</span> {c.notes}</div>}
                                                                </div>
                                                            </div>
                                                            <div className="bg-white rounded-xl p-3 border border-indigo-100">
                                                                <div className="font-bold text-gray-600 mb-2 flex items-center gap-1"><FiBell size={12} /> Pledges</div>
                                                                {custPledges.length === 0 ? <div className="text-gray-400">No pledges recorded</div> : (
                                                                    <div className="space-y-1">
                                                                        {custPledges.slice(0, 4).map(p => (
                                                                            <div key={p.pledge_id} className={`flex justify-between ${p.status === 'pending' && new Date(p.pledge_date) <= new Date() ? 'text-red-600' : p.status === 'paid' ? 'text-emerald-600' : 'text-gray-600'}`}>
                                                                                <span>{new Date(p.pledge_date).toLocaleDateString()} — {fmtKsh(p.pledge_amount)}</span>
                                                                                <span className="font-bold capitalize">{p.status}</span>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* ━━━ PLEDGES SECTION ━━━ */}
            {pledges.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                        <div className="flex items-center gap-2 font-bold text-gray-800 text-sm"><FiBell size={15} className="text-amber-500" /> Payment Pledges Overview</div>
                        <span className="text-xs text-gray-400">{pledges.length} total pledges</span>
                    </div>
                    <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-3">
                        {[
                            { label: 'Pending', items: pledges.filter(p => p.status === 'pending' && new Date(p.pledge_date) > new Date()), color: 'amber' },
                            { label: 'Overdue', items: pledges.filter(p => p.status === 'pending' && new Date(p.pledge_date) <= new Date()), color: 'red' },
                            { label: 'Fulfilled', items: pledges.filter(p => p.status === 'paid'), color: 'emerald' },
                        ].map(({ label, items, color }) => (
                            <div key={label} className={`rounded-xl p-3 bg-${color}-50 border border-${color}-100`}>
                                <div className={`font-bold text-${color}-700 mb-2 text-sm`}>{label} ({items.length})</div>
                                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                                    {items.slice(0, 10).map(p => (
                                        <div key={p.pledge_id} className="flex justify-between text-xs">
                                            <span className="font-medium text-gray-700">{p.customer_name}</span>
                                            <span className={`font-bold text-${color}-600`}>{fmtKsh(p.pledge_amount)}</span>
                                        </div>
                                    ))}
                                    {items.length === 0 && <div className="text-xs text-gray-400">None</div>}
                                </div>
                                <div className={`mt-2 pt-2 border-t border-${color}-100 text-xs font-bold text-${color}-700`}>
                                    Total: {fmtKsh(items.reduce((s, p) => s + p.pledge_amount, 0))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
