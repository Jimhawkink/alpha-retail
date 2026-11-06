'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';
import { useFeatures } from '@/context/FeatureContext';
import Link from 'next/link';
import {
    TrendingUp, TrendingDown, ShoppingCart, DollarSign, Clock,
    Package, AlertTriangle, Users, RefreshCw, ArrowRight,
    CheckCircle2, Activity, ShieldCheck, Zap, Layers, Truck,
    BarChart3, PieChart, CreditCard, Smartphone, Calendar,
    AlertCircle, Sparkles, ShoppingBag, Eye, Store, Percent,
    Wallet, ArrowUpRight, ArrowDownRight, Award, Download,
    FileText, Repeat
} from 'lucide-react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
    Filler,
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
    Filler
);

// ────────────────── Types ──────────────────
interface DailySales {
    date: string;
    cash: number;
    mpesa: number;
    credit: number;
    kcb: number;
    total: number;
    orders: number;
    profit: number;
}

interface TopProduct {
    name: string;
    category?: string;
    qty: number;
    revenue: number;
    avgPrice: number;
    stock?: number;
}

interface LowStockItem {
    pid: number;
    name: string;
    category?: string;
    stock: number;
    reorder: number;
    costPrice: number;
    status: 'out' | 'critical' | 'low';
}

interface CashierPerformance {
    name: string;
    sales: number;
    orders: number;
    avgTicket: number;
    sharePct: number;
}

interface DebtorItem {
    id?: number;
    name: string;
    phone: string;
    balance: number;
    creditLimit?: number;
}

interface RecentPurchase {
    purchaseNo: string;
    date: string;
    supplier: string;
    total: number;
    status: string;
}

interface CategorySales {
    category: string;
    revenue: number;
    qty: number;
}

// ────────────────── Main Dashboard Component ──────────────────
export default function DashboardPage() {
    const { activeOutlet } = useOutlet();
    const outletId = activeOutlet?.outlet_id || 1;
    const { hasFeature } = useFeatures();

    const [isLoading, setIsLoading] = useState(true);
    const [dateFrom, setDateFrom] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        return d.toISOString().split('T')[0];
    });
    const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
    const [rangePreset, setRangePreset] = useState<string>('7d');
    const [chartMode, setChartMode] = useState<'revenue' | 'profit' | 'orders'>('revenue');
    const [stockFilter, setStockFilter] = useState<'all' | 'out' | 'critical'>('all');

    // KPI Metrics
    const [todaySales, setTodaySales] = useState(0);
    const [yesterdaySales, setYesterdaySales] = useState(0);
    const [todayOrders, setTodayOrders] = useState(0);
    const [yesterdayOrders, setYesterdayOrders] = useState(0);
    const [todayProfit, setTodayProfit] = useState(0);
    const [todayCash, setTodayCash] = useState(0);
    const [todayMpesa, setTodayMpesa] = useState(0);
    const [todayKcb, setTodayKcb] = useState(0);
    const [todayCredit, setTodayCredit] = useState(0);
    const [todayReturns, setTodayReturns] = useState(0);
    const [todayCreditPaid, setTodayCreditPaid] = useState(0);
    const [totalExpenses, setTotalExpenses] = useState(0);
    const [activeShifts, setActiveShifts] = useState(0);
    const [pendingBills, setPendingBills] = useState(0);

    // Range aggregates & datasets
    const [dailySales, setDailySales] = useState<DailySales[]>([]);
    const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
    const [lowStock, setLowStock] = useState<LowStockItem[]>([]);
    const [cashierSales, setCashierSales] = useState<CashierPerformance[]>([]);
    const [recentPurchases, setRecentPurchases] = useState<RecentPurchase[]>([]);
    const [hourlyData, setHourlyData] = useState<{ hour: number; sales: number; orders: number }[]>([]);
    const [topDebtors, setTopDebtors] = useState<DebtorItem[]>([]);
    const [outstandingCredit, setOutstandingCredit] = useState(0);
    const [totalCreditCustomers, setTotalCreditCustomers] = useState(0);
    const [totalRangeProfit, setTotalRangeProfit] = useState(0);
    const [categorySales, setCategorySales] = useState<CategorySales[]>([]);
    const [inventoryValue, setInventoryValue] = useState(0);

    // ──── Date Presets ────
    const setPreset = (preset: string) => {
        setRangePreset(preset);
        const now = new Date();
        const to = now.toISOString().split('T')[0];
        let from = to;
        if (preset === '1d') {
            from = to;
        } else if (preset === 'yesterday') {
            const y = new Date(Date.now() - 86400000).toISOString().split('T')[0];
            setDateFrom(y);
            setDateTo(y);
            return;
        } else if (preset === '7d') {
            const d = new Date();
            d.setDate(d.getDate() - 7);
            from = d.toISOString().split('T')[0];
        } else if (preset === '14d') {
            const d = new Date();
            d.setDate(d.getDate() - 14);
            from = d.toISOString().split('T')[0];
        } else if (preset === '30d') {
            const d = new Date();
            d.setDate(d.getDate() - 30);
            from = d.toISOString().split('T')[0];
        } else if (preset === 'month') {
            from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
        }
        setDateFrom(from);
        setDateTo(to);
    };

    // ──── Load All Enterprise Dashboard Data ────
    const loadDashboardData = useCallback(async () => {
        setIsLoading(true);
        const today = new Date().toISOString().split('T')[0];
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

        try {
            // ── 1. Today's Sales ──
            const { data: todaySalesData } = await supabase
                .from('retail_sales')
                .select('total_amount, payment_method, receipt_no, sale_datetime, profit, status')
                .eq('sale_date', today)
                .eq('outlet_id', outletId);

            const tData = todaySalesData || [];
            const grossToday = tData.reduce((s, r) => s + (Number(r.total_amount) || 0), 0);
            setTodaySales(grossToday);
            setTodayOrders(tData.length);
            setTodayProfit(tData.reduce((s, r) => s + (Number(r.profit) || 0), 0));

            // Payment methods breakdown for today
            let cashT = 0, mpesaT = 0, kcbT = 0, creditT = 0;
            tData.forEach(r => {
                const amt = Number(r.total_amount) || 0;
                const m = (r.payment_method || '').toLowerCase();
                if (m.includes('mpesa')) mpesaT += amt;
                else if (m.includes('kcb')) kcbT += amt;
                else if (m.includes('credit')) creditT += amt;
                else cashT += amt;
            });
            setTodayCash(cashT);
            setTodayMpesa(mpesaT);
            setTodayKcb(kcbT);
            setTodayCredit(creditT);

            // ── 2. Hourly Footfall & Sales Velocity ──
            const hrs = Array.from({ length: 24 }, (_, i) => ({ hour: i, sales: 0, orders: 0 }));
            tData.forEach((s: any) => {
                if (s.sale_datetime) {
                    const dt = new Date(s.sale_datetime);
                    const h = dt.getHours();
                    if (h >= 0 && h < 24) {
                        hrs[h].sales += Number(s.total_amount) || 0;
                        hrs[h].orders += 1;
                    }
                }
            });
            setHourlyData(hrs);

            // ── 3. Yesterday's Comparison ──
            const { data: yData } = await supabase
                .from('retail_sales')
                .select('total_amount')
                .eq('sale_date', yesterday)
                .eq('outlet_id', outletId);
            setYesterdaySales((yData || []).reduce((s, r) => s + (Number(r.total_amount) || 0), 0));
            setYesterdayOrders((yData || []).length);

            // ── 4. Debt Collections Today ──
            const { data: cpData } = await supabase
                .from('retail_credit_payments')
                .select('amount_paid')
                .eq('payment_date', today)
                .eq('outlet_id', outletId)
                .eq('transaction_type', 'payment');
            setTodayCreditPaid((cpData || []).reduce((s, r) => s + (Number(r.amount_paid) || 0), 0));

            // ── 5. Today's Returns ──
            const todayReceiptNos = tData.map(r => r.receipt_no).filter(Boolean);
            if (todayReceiptNos.length > 0) {
                const { data: retData } = await supabase
                    .from('sales_returns')
                    .select('total_amount')
                    .in('original_sale_id', todayReceiptNos);
                setTodayReturns((retData || []).reduce((s, r) => s + (Number(r.total_amount) || 0), 0));
            } else {
                setTodayReturns(0);
            }

            // ── 6. Range Sales Timeline & Trends ──
            const { data: rangeSales } = await supabase
                .from('retail_sales')
                .select('sale_date, total_amount, payment_method, profit, created_by, status')
                .gte('sale_date', dateFrom)
                .lte('sale_date', dateTo)
                .eq('outlet_id', outletId)
                .order('sale_date');

            const rData = rangeSales || [];
            setTotalRangeProfit(rData.reduce((s, r) => s + (Number(r.profit) || 0), 0));

            const salesMap = new Map<string, DailySales>();
            const start = new Date(dateFrom);
            const end = new Date(dateTo);
            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                const key = d.toISOString().split('T')[0];
                salesMap.set(key, { date: key, cash: 0, mpesa: 0, credit: 0, kcb: 0, total: 0, orders: 0, profit: 0 });
            }
            rData.forEach(s => {
                const key = s.sale_date;
                if (!salesMap.has(key)) {
                    salesMap.set(key, { date: key, cash: 0, mpesa: 0, credit: 0, kcb: 0, total: 0, orders: 0, profit: 0 });
                }
                const entry = salesMap.get(key)!;
                const amt = Number(s.total_amount) || 0;
                const method = (s.payment_method || '').toLowerCase();
                entry.total += amt;
                entry.orders += 1;
                entry.profit += Number(s.profit) || 0;
                if (method.includes('kcb')) entry.kcb += amt;
                else if (method.includes('mpesa')) entry.mpesa += amt;
                else if (method.includes('credit')) entry.credit += amt;
                else entry.cash += amt;
            });
            setDailySales(Array.from(salesMap.values()).sort((a, b) => a.date.localeCompare(b.date)));

            // ── 7. Top Selling Products in Range ──
            const { data: salesItems } = await supabase
                .from('retail_sales_items')
                .select('product_name, quantity, subtotal, created_at')
                .gte('created_at', `${dateFrom}T00:00:00`)
                .lte('created_at', `${dateTo}T23:59:59`)
                .limit(2000);

            const prodMap = new Map<string, { qty: number; revenue: number }>();
            (salesItems || []).forEach(item => {
                const name = item.product_name || 'Standard Retail Item';
                if (!prodMap.has(name)) prodMap.set(name, { qty: 0, revenue: 0 });
                const e = prodMap.get(name)!;
                e.qty += Number(item.quantity) || 0;
                e.revenue += Number(item.subtotal) || 0;
            });

            // ── 8. Retail Products & Inventory Health ──
            const { data: retailProds } = await supabase
                .from('retail_products')
                .select('pid, product_name, category, cost_price, selling_price, reorder_point')
                .eq('active', true)
                .eq('outlet_id', outletId);

            const { data: retailStock } = await supabase
                .from('retail_stock')
                .select('pid, qty')
                .eq('outlet_id', outletId);

            const stockMap: Record<number, number> = {};
            (retailStock || []).forEach(s => {
                stockMap[s.pid] = (stockMap[s.pid] || 0) + (Number(s.qty) || 0);
            });

            const catMap = new Map<string, { revenue: number; qty: number }>();
            const prodCategoryLookup = new Map<string, string>();
            let totalVal = 0;

            const lowItems: LowStockItem[] = [];
            (retailProds || []).forEach(p => {
                const stock = stockMap[p.pid] || 0;
                const reorder = p.reorder_point || 5;
                const cost = Number(p.cost_price) || 0;
                totalVal += stock * cost;
                if (p.category) {
                    prodCategoryLookup.set(p.product_name.toLowerCase(), p.category);
                }
                if (stock <= reorder) {
                    lowItems.push({
                        pid: p.pid,
                        name: p.product_name,
                        category: p.category || 'General',
                        stock,
                        reorder,
                        costPrice: cost,
                        status: stock === 0 ? 'out' : stock <= reorder * 0.35 ? 'critical' : 'low',
                    });
                }
            });
            setLowStock(lowItems.sort((a, b) => a.stock - b.stock));
            setInventoryValue(totalVal);

            // Compute Top Products with category & avg price
            const rankedProds: TopProduct[] = Array.from(prodMap.entries())
                .map(([name, data]) => ({
                    name,
                    category: prodCategoryLookup.get(name.toLowerCase()) || 'Hardware / Retail',
                    qty: data.qty,
                    revenue: data.revenue,
                    avgPrice: data.qty > 0 ? Math.round(data.revenue / data.qty) : 0,
                }))
                .sort((a, b) => b.revenue - a.revenue)
                .slice(0, 10);
            setTopProducts(rankedProds);

            // Category sales estimation
            rankedProds.forEach(p => {
                const cat = p.category || 'General Store';
                if (!catMap.has(cat)) catMap.set(cat, { revenue: 0, qty: 0 });
                const c = catMap.get(cat)!;
                c.revenue += p.revenue;
                c.qty += p.qty;
            });
            setCategorySales(
                Array.from(catMap.entries())
                    .map(([category, val]) => ({ category, ...val }))
                    .sort((a, b) => b.revenue - a.revenue)
            );

            // ── 9. Cashier Sales Leaderboard ──
            const cashierMap = new Map<string, { sales: number; orders: number }>();
            rData.forEach(s => {
                const name = s.created_by || 'Cashier Desk';
                if (!cashierMap.has(name)) cashierMap.set(name, { sales: 0, orders: 0 });
                const c = cashierMap.get(name)!;
                c.sales += Number(s.total_amount) || 0;
                c.orders += 1;
            });
            const totalR = rData.reduce((s, r) => s + (Number(r.total_amount) || 0), 0);
            setCashierSales(
                Array.from(cashierMap.entries())
                    .map(([name, data]) => ({
                        name,
                        sales: data.sales,
                        orders: data.orders,
                        avgTicket: data.orders > 0 ? Math.round(data.sales / data.orders) : 0,
                        sharePct: totalR > 0 ? Math.round((data.sales / totalR) * 100) : 0,
                    }))
                    .sort((a, b) => b.sales - a.sales)
            );

            // ── 10. Expenses & Financials ──
            const { data: expData } = await supabase
                .from('expenses')
                .select('amount')
                .gte('expense_date', dateFrom)
                .lte('expense_date', dateTo)
                .eq('outlet_id', outletId);
            setTotalExpenses((expData || []).reduce((s, e) => s + (Number(e.amount) || 0), 0));

            // ── 11. Shifts & Pending Registers ──
            const { data: shiftData } = await supabase
                .from('retail_shifts')
                .select('status')
                .gte('shift_date', dateFrom)
                .lte('shift_date', dateTo);
            setActiveShifts((shiftData || []).filter(s => s.status === 'Open').length);

            const { data: pendingData } = await supabase
                .from('retail_sales')
                .select('sale_id')
                .eq('status', 'Pending')
                .eq('outlet_id', outletId);
            setPendingBills(pendingData?.length || 0);

            // ── 12. Recent Supplier Purchases ──
            const { data: purchasesData } = await supabase
                .from('retail_purchases')
                .select('purchase_no, purchase_date, supplier_name, grand_total, status')
                .eq('outlet_id', outletId)
                .order('purchase_date', { ascending: false })
                .limit(6);
            setRecentPurchases(
                (purchasesData || []).map(p => ({
                    purchaseNo: p.purchase_no || 'PO-REC',
                    date: p.purchase_date,
                    supplier: p.supplier_name || 'Standard Supplier',
                    total: Number(p.grand_total) || 0,
                    status: p.status || 'Received',
                }))
            );

            // ── 13. Debtors & Outstanding Credit ──
            const { data: debtorsData } = await supabase
                .from('retail_credit_customers')
                .select('customer_id, customer_name, phone, current_balance, credit_limit')
                .eq('outlet_id', outletId)
                .lt('current_balance', 0)
                .eq('active', true)
                .order('current_balance', { ascending: true })
                .limit(8);

            const { data: allDebtData } = await supabase
                .from('retail_credit_customers')
                .select('current_balance')
                .eq('outlet_id', outletId)
                .lt('current_balance', 0)
                .eq('active', true);

            setTopDebtors(
                (debtorsData || []).map((d: any) => ({
                    id: d.customer_id,
                    name: d.customer_name,
                    phone: d.phone || '',
                    balance: Math.abs(Number(d.current_balance) || 0),
                    creditLimit: Number(d.credit_limit) || 0,
                }))
            );
            setOutstandingCredit((allDebtData || []).reduce((s, r) => s + Math.abs(Number(r.current_balance) || 0), 0));
            setTotalCreditCustomers((allDebtData || []).length);

        } catch (err) {
            console.error('Error loading enterprise dashboard data:', err);
        }
        setIsLoading(false);
    }, [dateFrom, dateTo, outletId]);

    useEffect(() => {
        loadDashboardData();
    }, [loadDashboardData]);

    // ──── Computed Analytics & Store Health ────
    const totalPaymentsToday = todayCash + todayMpesa + todayKcb + todayCredit;
    const totalRangeSales = useMemo(() => dailySales.reduce((s, d) => s + d.total, 0), [dailySales]);
    const totalRangeOrders = useMemo(() => dailySales.reduce((s, d) => s + d.orders, 0), [dailySales]);
    const avgOrderValue = totalRangeOrders > 0 ? Math.round(totalRangeSales / totalRangeOrders) : 0;
    const grossMarginPct = totalRangeSales > 0 ? Math.round((totalRangeProfit / totalRangeSales) * 100) : 0;
    const todayMarginPct = todaySales > 0 ? Math.round((todayProfit / todaySales) * 100) : 0;
    const salesChange = yesterdaySales > 0 ? ((todaySales - yesterdaySales) / yesterdaySales) * 100 : 0;
    const netOperatingBalance = todaySales - totalExpenses;

    const activeHours = useMemo(() => hourlyData.filter(h => h.orders > 0), [hourlyData]);
    const peakHour = useMemo(() => {
        return hourlyData.reduce((best, h) => (h.sales > best.sales ? h : best), { hour: 0, sales: 0, orders: 0 });
    }, [hourlyData]);
    const maxHourlySales = useMemo(() => Math.max(...hourlyData.map(h => h.sales), 1), [hourlyData]);

    // Intelligent Store Health Score (0 - 100)
    const storeHealthScore = useMemo(() => {
        let score = 70; // baseline
        if (todaySales >= yesterdaySales && yesterdaySales > 0) score += 10;
        if (todayMarginPct >= 18) score += 10;
        else if (todayMarginPct >= 12) score += 5;
        if (lowStock.filter(s => s.status === 'out').length === 0) score += 10;
        else score -= Math.min(15, lowStock.filter(s => s.status === 'out').length * 2);
        return Math.max(10, Math.min(99, score));
    }, [todaySales, yesterdaySales, todayMarginPct, lowStock]);

    // Helper formatters
    const fmt = (n: number) => {
        if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
        if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
        return Math.round(n).toLocaleString();
    };

    // Filtered Stock Items
    const filteredStock = useMemo(() => {
        if (stockFilter === 'out') return lowStock.filter(s => s.status === 'out');
        if (stockFilter === 'critical') return lowStock.filter(s => s.status === 'critical');
        return lowStock;
    }, [lowStock, stockFilter]);

    // ──── Chart Configs ────
    const chartLabels = useMemo(() => {
        return dailySales.map(d => {
            const dt = new Date(d.date);
            return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
        });
    }, [dailySales]);

    const trendChartData = useMemo(() => {
        if (chartMode === 'profit') {
            return {
                labels: chartLabels,
                datasets: [
                    {
                        label: 'Gross Profit (Ksh)',
                        data: dailySales.map(d => d.profit),
                        borderColor: '#f59e0b',
                        backgroundColor: 'rgba(245, 158, 11, 0.15)',
                        fill: true,
                        tension: 0.4,
                        borderWidth: 3,
                        pointBackgroundColor: '#f59e0b',
                        pointHoverRadius: 6,
                    },
                ],
            };
        }
        if (chartMode === 'orders') {
            return {
                labels: chartLabels,
                datasets: [
                    {
                        label: 'Completed Orders',
                        data: dailySales.map(d => d.orders),
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.15)',
                        fill: true,
                        tension: 0.35,
                        borderWidth: 3,
                        pointBackgroundColor: '#3b82f6',
                        pointHoverRadius: 6,
                    },
                ],
            };
        }
        return {
            labels: chartLabels,
            datasets: [
                {
                    label: 'Gross Sales (Ksh)',
                    data: dailySales.map(d => d.total),
                    borderColor: '#0047cc',
                    backgroundColor: 'rgba(0, 71, 204, 0.12)',
                    fill: true,
                    tension: 0.38,
                    borderWidth: 3,
                    pointBackgroundColor: '#0047cc',
                    pointHoverRadius: 6,
                },
                {
                    label: 'M-Pesa',
                    data: dailySales.map(d => d.mpesa),
                    borderColor: '#10b981',
                    fill: false,
                    tension: 0.38,
                    borderWidth: 2,
                    borderDash: [4, 4],
                    pointRadius: 0,
                },
                {
                    label: 'Cash',
                    data: dailySales.map(d => d.cash),
                    borderColor: '#f59e0b',
                    fill: false,
                    tension: 0.38,
                    borderWidth: 2,
                    borderDash: [2, 2],
                    pointRadius: 0,
                },
            ],
        };
    }, [chartMode, chartLabels, dailySales]);

    const trendChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'top' as const,
                labels: {
                    usePointStyle: true,
                    padding: 15,
                    font: { size: 12, weight: 600 as const },
                },
            },
            tooltip: {
                backgroundColor: 'rgba(2, 22, 69, 0.95)',
                titleFont: { size: 13, weight: 'bold' as const },
                padding: 12,
                cornerRadius: 10,
                callbacks: {
                    label: (ctx: any) => `${ctx.dataset.label}: ${chartMode === 'orders' ? ctx.parsed.y : `Ksh ${(ctx.parsed.y || 0).toLocaleString()}`}`,
                },
            },
        },
        scales: {
            x: { grid: { display: false }, ticks: { font: { size: 11 } } },
            y: {
                grid: { color: 'rgba(0,0,0,0.04)' },
                ticks: {
                    font: { size: 11 },
                    callback: (v: any) => chartMode === 'orders' ? v : `Ksh ${fmt(Number(v))}`,
                },
            },
        },
    };

    // Payment donut chart data
    const paymentDonutData = {
        labels: ['Cash', 'M-Pesa Paybill / Till', 'KCB Buni POS', 'Customer Credit'],
        datasets: [
            {
                data: [todayCash || 0.01, todayMpesa || 0.01, todayKcb || 0.01, todayCredit || 0.01],
                backgroundColor: ['#f59e0b', '#10b981', '#3b82f6', '#ef4444'],
                borderWidth: 0,
                cutout: '74%',
            },
        ],
    };

    const paymentDonutOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: 'rgba(2, 22, 69, 0.95)',
                padding: 12,
                cornerRadius: 10,
                callbacks: {
                    label: (ctx: any) => `${ctx.label}: Ksh ${Number(ctx.parsed).toLocaleString()}`,
                },
            },
        },
    };

    return (
        <div className="space-y-6 pb-12 font-sans">
            {/* ══════════════════════════════════════════════════════════════════
                1. EXECUTIVE INTELLIGENCE HERO BANNER
            ══════════════════════════════════════════════════════════════════ */}
            <div
                className="rounded-3xl p-6 lg:p-8 text-white relative overflow-hidden shadow-2xl border border-blue-800/40"
                style={{
                    background: 'linear-gradient(135deg, #021a4d 0%, #003399 50%, #002266 100%)',
                }}
            >
                {/* Tech background hexagon accent glow */}
                <div className="absolute top-0 right-0 w-96 h-96 bg-amber-400/10 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -bottom-10 -left-10 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />

                <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    {/* Store Title & Badge */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-2.5 flex-wrap">
                            <span className="px-3 py-1 rounded-full text-xs font-black bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-950 shadow-md flex items-center gap-1.5">
                                <ShieldCheck size={13} />
                                ULTRA INTELLIGENCE POS
                            </span>
                            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-white/10 text-blue-200 border border-white/15">
                                Active Outlet: {activeOutlet?.outlet_name || 'Main Hardware Hub'}
                            </span>
                            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300 border border-emerald-400/30 flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                LIVE CLOUD SYNC
                            </span>
                        </div>
                        <h1 className="text-3xl lg:text-4xl font-black tracking-tight text-white flex items-center gap-3">
                            Executive Command Dashboard
                        </h1>
                        <p className="text-blue-100/80 text-sm max-w-2xl leading-relaxed">
                            Real-time sales velocity, multi-channel cash flow, predictive inventory reorders, and debtor risk intelligence.
                        </p>
                    </div>

                    {/* Store Health Index & POS Quick Launch */}
                    <div className="flex items-center gap-4 flex-wrap">
                        {/* Store Health Score Gauge */}
                        <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-3.5 flex items-center gap-3.5 shadow-lg">
                            <div className="relative w-14 h-14 flex items-center justify-center">
                                <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
                                    <circle cx="28" cy="28" r="23" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="5" />
                                    <circle
                                        cx="28"
                                        cy="28"
                                        r="23"
                                        fill="none"
                                        stroke={storeHealthScore >= 80 ? '#10b981' : storeHealthScore >= 60 ? '#f59e0b' : '#ef4444'}
                                        strokeWidth="5"
                                        strokeLinecap="round"
                                        strokeDasharray={`${2 * Math.PI * 23}`}
                                        strokeDashoffset={`${2 * Math.PI * 23 * (1 - storeHealthScore / 100)}`}
                                        style={{ transition: 'stroke-dashoffset 1s ease' }}
                                    />
                                </svg>
                                <span className="absolute text-sm font-black text-amber-300">
                                    {storeHealthScore}%
                                </span>
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-wider text-blue-200">Store Health</p>
                                <p className="text-sm font-extrabold text-white">
                                    {storeHealthScore >= 80 ? 'Optimal Operations' : storeHealthScore >= 60 ? 'Standard Pace' : 'Attention Required'}
                                </p>
                                <p className="text-[10px] text-emerald-300 font-semibold">Active Monitoring</p>
                            </div>
                        </div>

                        {/* Quick POS Launch Button (Golden Hero Pill) */}
                        <Link
                            href="/dashboard/pos"
                            className="px-6 py-3.5 rounded-full font-black text-slate-950 text-sm flex items-center gap-2.5 transition-all hover:scale-105 shadow-xl hover:shadow-amber-400/30"
                            style={{
                                background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 50%, #d97706 100%)',
                                boxShadow: '0 8px 25px rgba(245, 158, 11, 0.45)',
                            }}
                        >
                            <ShoppingCart size={18} className="text-slate-950" />
                            <span>LAUNCH RETAIL POS</span>
                            <ArrowRight size={16} />
                        </Link>
                    </div>
                </div>

                {/* Date Controls & Refresh Bar */}
                <div className="mt-6 pt-5 border-t border-white/10 flex flex-wrap items-center justify-between gap-4">
                    {/* Range Preset Tabs */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                        {[
                            { key: '1d', label: 'Today' },
                            { key: 'yesterday', label: 'Yesterday' },
                            { key: '7d', label: '7 Days' },
                            { key: '14d', label: '14 Days' },
                            { key: '30d', label: '30 Days' },
                            { key: 'month', label: 'This Month' },
                        ].map(p => (
                            <button
                                key={p.key}
                                onClick={() => setPreset(p.key)}
                                className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
                                    rangePreset === p.key
                                        ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20'
                                        : 'bg-white/10 hover:bg-white/20 text-white/90'
                                }`}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>

                    {/* Date Pickers & Manual Refresh */}
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 bg-slate-900/60 border border-white/15 px-3 py-1.5 rounded-xl text-xs text-white">
                            <Calendar size={13} className="text-amber-400" />
                            <input
                                type="date"
                                value={dateFrom}
                                onChange={e => { setDateFrom(e.target.value); setRangePreset('custom'); }}
                                className="bg-transparent text-white outline-none text-xs"
                            />
                            <span className="text-white/40">→</span>
                            <input
                                type="date"
                                value={dateTo}
                                onChange={e => { setDateTo(e.target.value); setRangePreset('custom'); }}
                                className="bg-transparent text-white outline-none text-xs"
                            />
                        </div>

                        <button
                            onClick={loadDashboardData}
                            disabled={isLoading}
                            className="px-4 py-1.5 bg-white/15 hover:bg-white/25 border border-white/20 rounded-xl text-xs font-bold text-white transition-all flex items-center gap-1.5"
                        >
                            <RefreshCw size={13} className={isLoading ? 'animate-spin text-amber-300' : 'text-white'} />
                            <span>{isLoading ? 'Updating...' : 'Refresh'}</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* ══════════════════════════════════════════════════════════════════
                2. DYNAMIC REAL-TIME BUSINESS ADVISOR / ALERTS
            ══════════════════════════════════════════════════════════════════ */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Velocity Insight */}
                <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-sm flex items-start gap-3.5 hover:shadow-md transition-all">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 shadow-sm font-black">
                        <Zap size={18} className="text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">Peak Velocity</p>
                        <p className="text-base font-black text-slate-800 truncate">
                            {activeHours.length > 0 ? `${peakHour.hour}:00 hrs Peak` : 'Standard Flow'}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                            {activeHours.length > 0
                                ? `Peak trading generated Ksh ${fmt(peakHour.sales)} with ${peakHour.orders} checkout orders.`
                                : 'Waiting for peak customer footfall.'}
                        </p>
                    </div>
                </div>

                {/* 2. Inventory Alert */}
                <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-sm flex items-start gap-3.5 hover:shadow-md transition-all">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 shadow-sm font-black">
                        <Package size={18} className="text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">Inventory Status</p>
                        <p className="text-base font-black text-slate-800">
                            {lowStock.length === 0 ? 'All Stock Optimal' : `${lowStock.length} Low Stock Items`}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                            {lowStock.filter(s => s.status === 'out').length > 0
                                ? `${lowStock.filter(s => s.status === 'out').length} items completely out of stock.`
                                : `Total warehouse value stands at Ksh ${fmt(inventoryValue)}.`}
                        </p>
                    </div>
                </div>

                {/* 3. Margin & Profitability */}
                <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-sm flex items-start gap-3.5 hover:shadow-md transition-all">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 shadow-sm font-black">
                        <TrendingUp size={18} className="text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">Gross Margin</p>
                        <p className="text-base font-black text-emerald-600">
                            {grossMarginPct}% Margin ({rangePreset.toUpperCase()})
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                            Period gross margin reached Ksh {fmt(totalRangeProfit)} with healthy product markups.
                        </p>
                    </div>
                </div>

                {/* 4. Debtor Risk Exposure */}
                <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-sm flex items-start gap-3.5 hover:shadow-md transition-all">
                    <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 shadow-sm font-black">
                        <CreditCard size={18} className="text-rose-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">Store Credit Risk</p>
                        <p className="text-base font-black text-rose-600">
                            Ksh {fmt(outstandingCredit)}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                            {totalCreditCustomers} active customer credit accounts currently open.
                        </p>
                    </div>
                </div>
            </div>

            {/* ══════════════════════════════════════════════════════════════════
                3. EXECUTIVE FINANCIAL KPI GRID
            ══════════════════════════════════════════════════════════════════ */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
                {/* 1. Today's Gross Sales */}
                <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
                    <div className="h-1 w-full bg-gradient-to-r from-blue-600 to-indigo-600 absolute top-0 left-0" />
                    <p className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wide">Today&apos;s Gross Sales</p>
                    <p className="text-2xl font-black text-slate-900 mt-1">Ksh {fmt(todaySales)}</p>
                    <div className="flex items-center gap-1.5 mt-2">
                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${salesChange >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                            {salesChange >= 0 ? `+${salesChange.toFixed(1)}%` : `${salesChange.toFixed(1)}%`}
                        </span>
                        <span className="text-[11px] text-slate-400">vs yesterday</span>
                    </div>
                </div>

                {/* 2. Today's Profit & Margin */}
                <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-sm hover:shadow-md transition-all relative overflow-hidden">
                    <div className="h-1 w-full bg-gradient-to-r from-amber-500 to-yellow-500 absolute top-0 left-0" />
                    <p className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wide">Today&apos;s Gross Profit</p>
                    <p className="text-2xl font-black text-amber-600 mt-1">Ksh {fmt(todayProfit)}</p>
                    <div className="flex items-center gap-1.5 mt-2">
                        <span className="text-[10px] font-black px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                            {todayMarginPct}% Margin
                        </span>
                        <span className="text-[11px] text-slate-400">profit markup</span>
                    </div>
                </div>

                {/* 3. M-Pesa Collections */}
                <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-sm hover:shadow-md transition-all relative overflow-hidden">
                    <div className="h-1 w-full bg-emerald-500 absolute top-0 left-0" />
                    <p className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                        <Smartphone size={13} className="text-emerald-500" /> M-Pesa Today
                    </p>
                    <p className="text-2xl font-black text-emerald-700 mt-1">Ksh {fmt(todayMpesa)}</p>
                    <p className="text-[11px] text-slate-400 mt-2">
                        {totalPaymentsToday > 0 ? ((todayMpesa / totalPaymentsToday) * 100).toFixed(0) : 0}% of all payments
                    </p>
                </div>

                {/* 4. Cash In Drawer */}
                <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-sm hover:shadow-md transition-all relative overflow-hidden">
                    <div className="h-1 w-full bg-blue-500 absolute top-0 left-0" />
                    <p className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                        <DollarSign size={13} className="text-blue-500" /> Cash In Drawer
                    </p>
                    <p className="text-2xl font-black text-blue-800 mt-1">Ksh {fmt(todayCash)}</p>
                    <p className="text-[11px] text-slate-400 mt-2">
                        {totalPaymentsToday > 0 ? ((todayCash / totalPaymentsToday) * 100).toFixed(0) : 0}% of all payments
                    </p>
                </div>

                {/* 5. Credit Paid / Collected Today */}
                <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-sm hover:shadow-md transition-all relative overflow-hidden">
                    <div className="h-1 w-full bg-teal-500 absolute top-0 left-0" />
                    <p className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wide">Debt Recovered</p>
                    <p className="text-2xl font-black text-teal-700 mt-1">Ksh {fmt(todayCreditPaid)}</p>
                    <p className="text-[11px] text-slate-400 mt-2">Collections from debtors</p>
                </div>

                {/* 6. Completed Orders Today */}
                <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-sm hover:shadow-md transition-all relative overflow-hidden">
                    <div className="h-1 w-full bg-purple-500 absolute top-0 left-0" />
                    <p className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wide">Orders Processed</p>
                    <p className="text-2xl font-black text-purple-800 mt-1">{todayOrders}</p>
                    <p className="text-[11px] text-slate-400 mt-2">
                        Avg Ticket: Ksh {todayOrders > 0 ? Math.round(todaySales / todayOrders).toLocaleString() : 0}
                    </p>
                </div>
            </div>

            {/* ══════════════════════════════════════════════════════════════════
                4. MULTI-DIMENSIONAL REVENUE & PROFIT VISUALIZATIONS
            ══════════════════════════════════════════════════════════════════ */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Interactive Revenue & Profit Trend (2 Cols) */}
                <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-sm">
                                    📈
                                </span>
                                <h3 className="font-extrabold text-slate-900 text-lg">Sales Velocity & Revenue Stream</h3>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Cumulative period revenue: <strong className="text-slate-800">Ksh {totalRangeSales.toLocaleString()}</strong> across {totalRangeOrders} customer orders.
                            </p>
                        </div>

                        {/* Chart Metric Toggle */}
                        <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-bold text-slate-600">
                            <button
                                onClick={() => setChartMode('revenue')}
                                className={`px-3 py-1.5 rounded-lg transition-all ${
                                    chartMode === 'revenue' ? 'bg-blue-600 text-white shadow-sm' : 'hover:text-slate-900'
                                }`}
                            >
                                Revenue
                            </button>
                            <button
                                onClick={() => setChartMode('profit')}
                                className={`px-3 py-1.5 rounded-lg transition-all ${
                                    chartMode === 'profit' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'hover:text-slate-900'
                                }`}
                            >
                                Gross Profit
                            </button>
                            <button
                                onClick={() => setChartMode('orders')}
                                className={`px-3 py-1.5 rounded-lg transition-all ${
                                    chartMode === 'orders' ? 'bg-indigo-600 text-white shadow-sm' : 'hover:text-slate-900'
                                }`}
                            >
                                Volume
                            </button>
                        </div>
                    </div>

                    <div style={{ height: '330px' }}>
                        {dailySales.length > 0 ? (
                            <Line data={trendChartData} options={trendChartOptions} />
                        ) : (
                            <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                                No sales data recorded for the selected timeline.
                            </div>
                        )}
                    </div>
                </div>

                {/* Payment Ecosystem Donut & Breakdown (1 Col) */}
                <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-extrabold text-slate-900 text-lg flex items-center gap-2">
                                <span className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-sm">
                                    💳
                                </span>
                                Payment Channels
                            </h3>
                            <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                                Today
                            </span>
                        </div>

                        {/* Donut Chart with Center Metric */}
                        <div style={{ height: '190px' }} className="relative flex items-center justify-center">
                            <Doughnut data={paymentDonutData} options={paymentDonutOptions} />
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Inflow</span>
                                <span className="text-xl font-black text-slate-900">Ksh {fmt(totalPaymentsToday)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Channel Detail Rows */}
                    <div className="mt-4 space-y-2 pt-3 border-t border-slate-100">
                        {[
                            { label: 'M-Pesa Paybill / Till', value: todayMpesa, color: '#10b981', icon: '📱' },
                            { label: 'Cash in Drawer', value: todayCash, color: '#f59e0b', icon: '💵' },
                            { label: 'KCB Buni POS', value: todayKcb, color: '#3b82f6', icon: '🏦' },
                            { label: 'Customer Credit', value: todayCredit, color: '#ef4444', icon: '📝' },
                        ].map(c => {
                            const pct = totalPaymentsToday > 0 ? ((c.value / totalPaymentsToday) * 100).toFixed(0) : '0';
                            return (
                                <div key={c.label} className="flex items-center justify-between text-xs py-1">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                                        <span className="font-semibold text-slate-700">{c.icon} {c.label}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-black text-slate-900">Ksh {c.value.toLocaleString()}</span>
                                        <span className="text-[10px] font-bold text-slate-400 w-8 text-right">{pct}%</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* ══════════════════════════════════════════════════════════════════
                5. OPERATIONAL INTELLIGENCE: HOURLY HEATMAP & STAFF LEADERBOARD
            ══════════════════════════════════════════════════════════════════ */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Hourly Sales Distribution Heatmap */}
                <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="font-extrabold text-slate-900 text-lg flex items-center gap-2">
                                <span className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-sm">
                                    ⏱️
                                </span>
                                Hourly Sales Velocity — Today
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5">Identifies customer traffic patterns to optimize cashier shift rosters.</p>
                        </div>
                        {activeHours.length > 0 && (
                            <span className="text-xs font-black px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                                🔥 Peak: {peakHour.hour}:00
                            </span>
                        )}
                    </div>

                    {activeHours.length === 0 ? (
                        <div className="h-48 flex items-center justify-center text-slate-400 text-sm">
                            No transactions recorded today yet.
                        </div>
                    ) : (
                        <div className="space-y-2 overflow-y-auto max-h-[300px] pr-2 sb-scroll">
                            {hourlyData.filter(h => h.orders > 0).map(h => {
                                const barWidth = Math.round((h.sales / maxHourlySales) * 100);
                                const isPeak = h.hour === peakHour.hour;
                                return (
                                    <div key={h.hour} className="flex items-center gap-3 text-xs">
                                        <span className="w-12 text-slate-500 font-mono font-bold text-right">
                                            {String(h.hour).padStart(2, '0')}:00
                                        </span>
                                        <div className="flex-1 bg-slate-100 rounded-full h-4 overflow-hidden relative">
                                            <div
                                                className={`h-full rounded-full transition-all ${
                                                    isPeak
                                                        ? 'bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 shadow-sm'
                                                        : 'bg-gradient-to-r from-blue-500 to-indigo-600'
                                                }`}
                                                style={{ width: `${Math.max(5, barWidth)}%` }}
                                            />
                                        </div>
                                        <span className="w-24 text-right font-black text-slate-800">
                                            Ksh {fmt(h.sales)}
                                        </span>
                                        <span className="w-14 text-right text-[11px] text-slate-400 font-semibold">
                                            {h.orders} {h.orders === 1 ? 'sale' : 'sales'}
                                        </span>
                                        {isPeak && <span className="text-amber-500 font-black">⭐</span>}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Cashier Performance Podium Leaderboard */}
                <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="font-extrabold text-slate-900 text-lg flex items-center gap-2">
                                <span className="w-8 h-8 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center font-bold text-sm">
                                    🏆
                                </span>
                                Cashier Performance Leaderboard
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5">Ranked by revenue generation, order throughput, and basket size.</p>
                        </div>
                        <span className="text-xs text-slate-400 font-bold uppercase">{rangePreset} period</span>
                    </div>

                    <div className="overflow-x-auto max-h-[300px] sb-scroll">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 sticky top-0 text-slate-500 font-black uppercase text-[10px]">
                                <tr>
                                    <th className="py-2.5 px-3">Rank</th>
                                    <th className="py-2.5 px-3">Cashier</th>
                                    <th className="py-2.5 px-3 text-right">Orders</th>
                                    <th className="py-2.5 px-3 text-right">Revenue</th>
                                    <th className="py-2.5 px-3 text-right">Avg Basket</th>
                                    <th className="py-2.5 px-3 text-right">% Share</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                                {cashierSales.map((c, idx) => {
                                    const podium = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;
                                    return (
                                        <tr key={c.name} className={`hover:bg-blue-50/40 transition-colors ${idx === 0 ? 'bg-amber-50/40' : ''}`}>
                                            <td className="py-2.5 px-3 text-base">{podium}</td>
                                            <td className="py-2.5 px-3 font-extrabold text-slate-900">{c.name}</td>
                                            <td className="py-2.5 px-3 text-right font-black text-indigo-600">{c.orders}</td>
                                            <td className="py-2.5 px-3 text-right font-black text-slate-900">Ksh {c.sales.toLocaleString()}</td>
                                            <td className="py-2.5 px-3 text-right text-slate-500">Ksh {c.avgTicket.toLocaleString()}</td>
                                            <td className="py-2.5 px-3 text-right">
                                                <span className={`px-2 py-0.5 rounded-full font-black text-[10px] ${
                                                    c.sharePct >= 35 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
                                                }`}>
                                                    {c.sharePct}%
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {cashierSales.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="py-8 text-center text-slate-400">No staff transactions recorded yet.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* ══════════════════════════════════════════════════════════════════
                6. BEST SELLERS LEADERBOARD & CRITICAL INVENTORY RADAR
            ══════════════════════════════════════════════════════════════════ */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Fast-Moving Best Sellers */}
                <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="font-extrabold text-slate-900 text-lg flex items-center gap-2">
                                <span className="w-8 h-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center font-bold text-sm">
                                    🔥
                                </span>
                                Top 10 Best Selling Products
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5">Top revenue contributors and velocity leaders in selected period.</p>
                        </div>
                        <Link href="/dashboard/products" className="text-xs text-blue-600 hover:underline font-bold">
                            All Products →
                        </Link>
                    </div>

                    <div className="overflow-x-auto max-h-[340px] sb-scroll">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 sticky top-0 text-slate-500 font-black uppercase text-[10px]">
                                <tr>
                                    <th className="py-2.5 px-3">#</th>
                                    <th className="py-2.5 px-3">Product Name</th>
                                    <th className="py-2.5 px-3 text-right">Qty Sold</th>
                                    <th className="py-2.5 px-3 text-right">Avg Price</th>
                                    <th className="py-2.5 px-3 text-right">Gross Revenue</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                                {topProducts.map((p, idx) => (
                                    <tr key={p.name} className="hover:bg-slate-50 transition-colors">
                                        <td className="py-2.5 px-3">
                                            <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-black ${
                                                idx === 0 ? 'bg-amber-400 text-slate-950 font-black shadow-sm' : idx === 1 ? 'bg-slate-200 text-slate-800' : idx === 2 ? 'bg-amber-100 text-amber-800' : 'text-slate-400'
                                            }`}>
                                                {idx + 1}
                                            </span>
                                        </td>
                                        <td className="py-2.5 px-3">
                                            <p className="font-extrabold text-slate-900 truncate max-w-[180px]">{p.name}</p>
                                            <p className="text-[10px] text-slate-400">{p.category}</p>
                                        </td>
                                        <td className="py-2.5 px-3 text-right font-black text-blue-600">{p.qty.toLocaleString()}</td>
                                        <td className="py-2.5 px-3 text-right text-slate-500">Ksh {p.avgPrice.toLocaleString()}</td>
                                        <td className="py-2.5 px-3 text-right font-black text-slate-900">Ksh {p.revenue.toLocaleString()}</td>
                                    </tr>
                                ))}
                                {topProducts.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="py-8 text-center text-slate-400">No product sales in this period.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Critical Stock Radar & Reorder Advisory */}
                <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="font-extrabold text-slate-900 text-lg flex items-center gap-2">
                                <span className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center font-bold text-sm">
                                    ⚠️
                                </span>
                                Inventory Reorder Radar
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5">Automated detection of out-of-stock and depleted hardware inventory.</p>
                        </div>
                        {/* Status Filter */}
                        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-[11px] font-bold">
                            <button
                                onClick={() => setStockFilter('all')}
                                className={`px-2 py-1 rounded-lg ${stockFilter === 'all' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}
                            >
                                All ({lowStock.length})
                            </button>
                            <button
                                onClick={() => setStockFilter('out')}
                                className={`px-2 py-1 rounded-lg ${stockFilter === 'out' ? 'bg-rose-600 text-white shadow' : 'text-slate-500'}`}
                            >
                                Out
                            </button>
                            <button
                                onClick={() => setStockFilter('critical')}
                                className={`px-2 py-1 rounded-lg ${stockFilter === 'critical' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-500'}`}
                            >
                                Critical
                            </button>
                        </div>
                    </div>

                    <div className="overflow-x-auto max-h-[340px] sb-scroll">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 sticky top-0 text-slate-500 font-black uppercase text-[10px]">
                                <tr>
                                    <th className="py-2.5 px-3">Item Name</th>
                                    <th className="py-2.5 px-3 text-right">Current Stock</th>
                                    <th className="py-2.5 px-3 text-right">Reorder Point</th>
                                    <th className="py-2.5 px-3 text-center">Status</th>
                                    <th className="py-2.5 px-3 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                                {filteredStock.map(item => (
                                    <tr key={item.pid} className="hover:bg-slate-50 transition-colors">
                                        <td className="py-2.5 px-3">
                                            <p className="font-extrabold text-slate-900 truncate max-w-[170px]">{item.name}</p>
                                            <p className="text-[10px] text-slate-400">{item.category}</p>
                                        </td>
                                        <td className="py-2.5 px-3 text-right font-black text-rose-600">
                                            {item.stock}
                                        </td>
                                        <td className="py-2.5 px-3 text-right text-slate-500">{item.reorder}</td>
                                        <td className="py-2.5 px-3 text-center">
                                            <span className={`px-2 py-0.5 rounded-full font-black text-[10px] ${
                                                item.status === 'out'
                                                    ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                                    : item.status === 'critical'
                                                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                                    : 'bg-yellow-100 text-yellow-800'
                                            }`}>
                                                {item.status === 'out' ? 'OUT OF STOCK' : item.status === 'critical' ? 'CRITICAL LOW' : 'REORDER'}
                                            </span>
                                        </td>
                                        <td className="py-2.5 px-3 text-right">
                                            <Link
                                                href={`/dashboard/purchase?reorder=${item.pid}`}
                                                className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 font-black text-[10px] hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                                            >
                                                Order →
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                                {filteredStock.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="py-8 text-center text-emerald-600 font-bold">
                                            ✅ All warehouse inventory levels are healthy!
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* ══════════════════════════════════════════════════════════════════
                7. DEBTORS & PROCUREMENT INTELLIGENCE
            ══════════════════════════════════════════════════════════════════ */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Outstanding Debtors Ledger */}
                <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="font-extrabold text-slate-900 text-lg flex items-center gap-2">
                                <span className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center font-bold text-sm">
                                    👥
                                </span>
                                Debtor Exposure & Overdue Accounts
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5">Top customer debt balances requiring collection follow-ups.</p>
                        </div>
                        <Link href="/dashboard/credit-customers" className="text-xs text-blue-600 hover:underline font-bold">
                            View All ({totalCreditCustomers}) →
                        </Link>
                    </div>

                    <div className="overflow-x-auto max-h-[280px] sb-scroll">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 sticky top-0 text-slate-500 font-black uppercase text-[10px]">
                                <tr>
                                    <th className="py-2.5 px-3">#</th>
                                    <th className="py-2.5 px-3">Customer Name</th>
                                    <th className="py-2.5 px-3">Contact</th>
                                    <th className="py-2.5 px-3 text-right">Owed Balance</th>
                                    <th className="py-2.5 px-3 text-right">Statement</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                                {topDebtors.map((d, idx) => (
                                    <tr key={d.name} className="hover:bg-slate-50 transition-colors">
                                        <td className="py-2.5 px-3 font-bold text-slate-400">{idx + 1}</td>
                                        <td className="py-2.5 px-3 font-extrabold text-slate-900">{d.name}</td>
                                        <td className="py-2.5 px-3 text-slate-500">{d.phone || '—'}</td>
                                        <td className="py-2.5 px-3 text-right font-black text-rose-600">
                                            Ksh {d.balance.toLocaleString()}
                                        </td>
                                        <td className="py-2.5 px-3 text-right">
                                            <Link
                                                href={`/dashboard/credit-statements?customer=${d.id || ''}`}
                                                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[10px] transition-all"
                                            >
                                                View →
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                                {topDebtors.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="py-8 text-center text-emerald-600 font-bold">
                                            ✅ Zero outstanding debt. Excellent cash flow collection!
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Recent Purchases & Supplier Deliveries */}
                <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="font-extrabold text-slate-900 text-lg flex items-center gap-2">
                                <span className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center font-bold text-sm">
                                    🚚
                                </span>
                                Recent Procurement & Supplier Inbound
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5">Latest goods received vouchers and wholesale purchase entries.</p>
                        </div>
                        <Link href="/dashboard/purchases" className="text-xs text-blue-600 hover:underline font-bold">
                            All Purchases →
                        </Link>
                    </div>

                    <div className="overflow-x-auto max-h-[280px] sb-scroll">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 sticky top-0 text-slate-500 font-black uppercase text-[10px]">
                                <tr>
                                    <th className="py-2.5 px-3">Date</th>
                                    <th className="py-2.5 px-3">Supplier</th>
                                    <th className="py-2.5 px-3 text-right">Total (Ksh)</th>
                                    <th className="py-2.5 px-3 text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                                {recentPurchases.map(p => (
                                    <tr key={p.purchaseNo} className="hover:bg-slate-50 transition-colors">
                                        <td className="py-2.5 px-3 text-slate-500">
                                            {new Date(p.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                                        </td>
                                        <td className="py-2.5 px-3 font-extrabold text-slate-900">{p.supplier}</td>
                                        <td className="py-2.5 px-3 text-right font-black text-slate-900">
                                            Ksh {p.total.toLocaleString()}
                                        </td>
                                        <td className="py-2.5 px-3 text-center">
                                            <span className={`px-2 py-0.5 rounded-full font-black text-[10px] ${
                                                p.status.toLowerCase().includes('complete') || p.status.toLowerCase().includes('received')
                                                    ? 'bg-emerald-100 text-emerald-800'
                                                    : 'bg-amber-100 text-amber-800'
                                            }`}>
                                                {p.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                                {recentPurchases.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="py-8 text-center text-slate-400">
                                            No procurement orders recorded recently.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* ══════════════════════════════════════════════════════════════════
                8. INTERACTIVE ENTERPRISE QUICK ACTIONS COMMAND CENTER
            ══════════════════════════════════════════════════════════════════ */}
            <div
                className="rounded-3xl p-6 text-white shadow-xl border border-blue-900/50"
                style={{
                    background: 'linear-gradient(135deg, #021a4d 0%, #002b80 100%)',
                }}
            >
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-extrabold text-base flex items-center gap-2">
                        <span className="text-amber-400">⚡</span> Enterprise Quick Command Actions
                    </h3>
                    <span className="text-xs text-blue-200">1-Click Fast Navigation</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
                    {[
                        { icon: ShoppingCart, label: 'Retail POS', href: '/dashboard/pos', highlight: true },
                        { icon: Download, label: 'Stock In / PO', href: '/dashboard/purchase' },
                        { icon: Package, label: 'Products', href: '/dashboard/products' },
                        { icon: Users, label: 'Customers', href: '/dashboard/credit-customers' },
                        { icon: TrendingDown, label: 'Expenses', href: '/dashboard/expenses' },
                        { icon: Repeat, label: 'Returns', href: '/dashboard/sales-return' },
                        { icon: FileText, label: 'Sales Records', href: '/dashboard/sales' },
                        { icon: BarChart3, label: 'Full Reports', href: '/dashboard/reports/sales' },
                    ].map(a => {
                        const Icon = a.icon;
                        return (
                            <Link
                                key={a.label}
                                href={a.href}
                                className={`flex flex-col items-center justify-center gap-2.5 p-3.5 rounded-2xl transition-all hover:scale-105 border ${
                                    a.highlight
                                        ? 'bg-gradient-to-br from-amber-400 to-yellow-500 text-slate-950 font-black border-amber-300 shadow-lg shadow-amber-400/25'
                                        : 'bg-white/10 hover:bg-white/20 text-white border-white/10 shadow-sm'
                                }`}
                            >
                                <Icon size={22} className={a.highlight ? 'text-slate-950' : 'text-amber-300'} />
                                <span className="text-xs font-bold text-center leading-tight">{a.label}</span>
                            </Link>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
