'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';
import { useCompanyName } from '@/context/SettingsContext';
import toast, { Toaster } from 'react-hot-toast';
import {
  FiTrendingUp,
  FiDollarSign,
  FiShoppingBag,
  FiCreditCard,
  FiSmartphone,
  FiRefreshCw,
  FiDownload,
  FiPrinter,
  FiCalendar,
  FiUsers,
  FiPackage,
  FiAlertTriangle,
  FiPieChart,
  FiBarChart2,
  FiActivity,
  FiArrowUpRight,
  FiArrowDownRight,
  FiClock,
  FiCheckCircle,
  FiXCircle,
  FiSliders,
  FiSearch,
  FiRotateCcw,
  FiTruck,
  FiPercent,
  FiLayers,
  FiArchive,
  FiShield,
  FiChevronLeft,
  FiChevronRight,
  FiChevronsLeft,
  FiChevronsRight,
  FiInfo,
} from 'react-icons/fi';

import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

/* ══════════════════════════════════════════════════════════════════════════════
   TYPES & INTERFACES
   ══════════════════════════════════════════════════════════════════════════════ */
interface DailyStat {
  date: string;
  dayLabel: string;
  cash: number;
  mpesa: number;
  credit: number;
  total: number;
  orders: number;
  profit: number;
  avgTicket: number;
}

interface PaymentStat {
  name: string;
  value: number;
  count: number;
  color: string;
  percentage: number;
}

interface TopProduct {
  pid: number | string;
  product_name: string;
  category: string;
  quantitySold: number;
  revenue: number;
  cost: number;
  profit: number;
  marginPct: number;
  stockOnHand: number;
}

interface SlowProduct {
  pid: number | string;
  product_name: string;
  category: string;
  stockOnHand: number;
  quantitySold: number;
  salesCost: number;
  lockedCapital: number;
}

interface CashierStat {
  name: string;
  orders: number;
  totalSales: number;
  cash: number;
  mpesa: number;
  credit: number;
  avgTicket: number;
  sharePct: number;
}

interface CategoryStat {
  category: string;
  revenue: number;
  orders: number;
  profit: number;
  sharePct: number;
}

interface DebtorStat {
  customer_id: number;
  customer_name: string;
  phone: string;
  current_balance: number;
  credit_limit: number;
  riskPct: number;
}

interface PurchaseSummary {
  purchase_id: number;
  purchase_no: string;
  purchase_date: string;
  supplier_name: string;
  grand_total: number;
  status: string;
}

/* ══════════════════════════════════════════════════════════════════════════════
   FORMATTERS & HELPERS
   ══════════════════════════════════════════════════════════════════════════════ */
const fmt = (n: any) => {
  const num = typeof n === 'number' ? n : parseFloat(n) || 0;
  return `Ksh ${num.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const fmtKES = (n: any) => {
  const num = typeof n === 'number' ? n : parseFloat(n) || 0;
  return `Ksh ${Math.round(num).toLocaleString('en-KE')}`;
};

const fmtK = (n: any) => {
  const num = typeof n === 'number' ? n : parseFloat(n) || 0;
  if (Math.abs(num) >= 1_000_000) return `Ksh ${(num / 1_000_000).toFixed(2)}M`;
  if (Math.abs(num) >= 1_000) return `Ksh ${(num / 1_000).toFixed(1)}K`;
  return `Ksh ${Math.round(num).toLocaleString('en-KE')}`;
};

const fmtN = (n: any) => {
  const num = typeof n === 'number' ? n : parseFloat(n) || 0;
  return num.toLocaleString('en-KE');
};

const toDay = () => new Date().toISOString().split('T')[0];

const getYesterday = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
};

const getDaysAgo = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
};

const firstOfMonth = () => {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().split('T')[0];
};

const firstOfYear = () => {
  const d = new Date();
  return `${d.getFullYear()}-01-01`;
};

const formatDate = (val: string) => {
  if (!val) return '—';
  const dt = new Date(val);
  if (isNaN(dt.getTime())) return val;
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const PIE_COLORS = ['#10B981', '#06B6D4', '#F59E0B', '#6366F1', '#EC4899', '#8B5CF6'];

/* ══════════════════════════════════════════════════════════════════════════════
   MAIN SALES SUMMARY COMPONENT
   ══════════════════════════════════════════════════════════════════════════════ */
export default function SalesSummaryPage() {
  const [mounted, setMounted] = useState(false);
  const { activeOutlet } = useOutlet();
  const outletId = activeOutlet?.outlet_id || 1;
  const companyName = useCompanyName();

  // Navigation Tabs for 30 Analytical Modules
  const [activeTab, setActiveTab] = useState<'overview' | 'products' | 'credit' | 'operations' | 'ledger'>('overview');

  // Filter States
  const [datePreset, setDatePresetState] = useState('30d');
  const [dateFrom, setDateFrom] = useState(getDaysAgo(30));
  const [dateTo, setDateTo] = useState(toDay());
  const [filterPayment, setFilterPayment] = useState('All');
  const [filterCashier, setFilterCashier] = useState('All');

  // Loading & Data States
  const [loading, setLoading] = useState(true);
  const [salesRows, setSalesRows] = useState<any[]>([]);
  const [salesItemsRows, setSalesItemsRows] = useState<any[]>([]);
  const [returnsRows, setReturnsRows] = useState<any[]>([]);
  const [purchasesRows, setPurchasesRows] = useState<PurchaseSummary[]>([]);
  const [creditCustomersRows, setCreditCustomersRows] = useState<DebtorStat[]>([]);
  const [creditPaymentsRows, setCreditPaymentsRows] = useState<any[]>([]);
  const [expensesRows, setExpensesRows] = useState<any[]>([]);
  const [productsMaster, setProductsMaster] = useState<any[]>([]);
  const [stockMap, setStockMap] = useState<Record<string | number, number>>({});

  // Pagination for Daily Ledger Tab
  const [ledgerPage, setLedgerPage] = useState(1);
  const [ledgerPerPage, setLedgerPerPage] = useState(15);
  const [ledgerSearch, setLedgerSearch] = useState('');

  // Hydration safety
  useEffect(() => {
    setMounted(true);
  }, []);

  // Preset Date Setter
  const applyPreset = (preset: string) => {
    setDatePresetState(preset);
    const todayStr = toDay();
    let from = todayStr;
    let to = todayStr;

    if (preset === 'today') {
      from = todayStr;
      to = todayStr;
    } else if (preset === 'yesterday') {
      from = getYesterday();
      to = getYesterday();
    } else if (preset === '7d') {
      from = getDaysAgo(7);
      to = todayStr;
    } else if (preset === '14d') {
      from = getDaysAgo(14);
      to = todayStr;
    } else if (preset === '30d') {
      from = getDaysAgo(30);
      to = todayStr;
    } else if (preset === 'month') {
      from = firstOfMonth();
      to = todayStr;
    } else if (preset === 'year') {
      from = firstOfYear();
      to = todayStr;
    }
    setDateFrom(from);
    setDateTo(to);
  };

  /* ─────────────────────────────────────────────────────────────────────────
     LOAD COMPLETE MULTI-DIMENSIONAL AUDIT DATA
     ───────────────────────────────────────────────────────────────────────── */
  const loadCompleteSummary = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Parallel execution across all core commerce tables
      const [
        salesRes,
        itemsRes,
        returnsRes,
        purchasesRes,
        customersRes,
        paymentsRes,
        expensesRes,
        productsRes,
        stockRes,
      ] = await Promise.all([
        supabase
          .from('retail_sales')
          .select('sale_id, receipt_no, sale_date, sale_time, sale_datetime, total_amount, subtotal, discount, payment_method, profit, created_by, status, customer_name, customer_phone, outlet_id')
          .gte('sale_date', dateFrom)
          .lte('sale_date', dateTo)
          .order('sale_date', { ascending: true })
          .limit(4000),

        supabase
          .from('retail_sales_items')
          .select('item_id, sale_id, product_id, product_name, barcode, quantity, unit_price, cost_price, discount, subtotal, profit')
          .limit(8000),

        supabase
          .from('sales_returns')
          .select('*')
          .gte('return_date', dateFrom)
          .lte('return_date', dateTo)
          .limit(2000),

        supabase
          .from('retail_purchases')
          .select('purchase_id, purchase_no, purchase_date, supplier_name, grand_total, status')
          .gte('purchase_date', dateFrom)
          .lte('purchase_date', dateTo)
          .order('purchase_date', { ascending: false })
          .limit(1000),

        supabase
          .from('retail_credit_customers')
          .select('customer_id, customer_name, phone, current_balance, credit_limit')
          .order('current_balance', { ascending: false })
          .limit(1000),

        supabase
          .from('retail_credit_payments')
          .select('payment_id, customer_id, amount_paid, payment_date, payment_method, receipt_no')
          .gte('payment_date', dateFrom)
          .lte('payment_date', dateTo)
          .limit(1000),

        supabase
          .from('expenses')
          .select('expense_id, amount, expense_date, category, description, expense_name')
          .gte('expense_date', dateFrom)
          .lte('expense_date', dateTo)
          .limit(1000),

        supabase
          .from('retail_products')
          .select('pid, product_name, barcode, category, purchase_cost, sales_cost, active')
          .limit(3000),

        supabase
          .from('retail_stock')
          .select('pid, qty, outlet_id')
          .limit(10000),
      ]);

      // Handle Sales
      const sales = salesRes.data || [];
      setSalesRows(sales);

      // Handle Stock Map (Net On-Hand Qty)
      const stMap: Record<string | number, number> = {};
      (stockRes.data || []).forEach((row) => {
        if (row.pid) {
          stMap[row.pid] = (stMap[row.pid] || 0) + Number(row.qty || 0);
        }
      });
      setStockMap(stMap);

      // Handle Line Items: Match with Sales in this Period
      const saleIdSet = new Set(sales.map((s) => Number(s.sale_id)).filter(Boolean));
      const filteredItems = (itemsRes.data || []).filter((it) => saleIdSet.has(Number(it.sale_id)));
      setSalesItemsRows(filteredItems.length > 0 ? filteredItems : (itemsRes.data || []).slice(0, 1000));

      // Handle Returns
      setReturnsRows(returnsRes.data || []);

      // Handle Purchases
      setPurchasesRows(purchasesRes.data || []);

      // Handle Debtors & Payments
      const debtors = (customersRes.data || []).map((c: any) => ({
        customer_id: c.customer_id,
        customer_name: c.customer_name || 'Account Customer',
        phone: c.phone || '—',
        current_balance: Number(c.current_balance || 0),
        credit_limit: Number(c.credit_limit || 0),
        riskPct: c.credit_limit > 0 ? Math.min(100, Math.round((Number(c.current_balance || 0) / Number(c.credit_limit)) * 100)) : 0,
      }));
      setCreditCustomersRows(debtors);
      setCreditPaymentsRows(paymentsRes.data || []);

      // Handle Expenses
      setExpensesRows(expensesRes.data || []);

      // Handle Products Master
      setProductsMaster(productsRes.data || []);
    } catch (err: any) {
      console.error('Failed to load comprehensive sales summary:', err);
      toast.error('Error refreshing summary analytics');
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    loadCompleteSummary();
  }, [loadCompleteSummary]);

  /* ─────────────────────────────────────────────────────────────────────────
     FILTERED SALES SUBSET (By Cashier & Payment Method)
     ───────────────────────────────────────────────────────────────────────── */
  const filteredSales = useMemo(() => {
    return salesRows.filter((s) => {
      if (filterPayment !== 'All') {
        const pm = (s.payment_method || '').toLowerCase();
        if (filterPayment === 'Cash' && !pm.includes('cash')) return false;
        if (filterPayment === 'M-Pesa' && !pm.includes('mpesa') && !pm.includes('m-pesa')) return false;
        if (filterPayment === 'Credit' && !pm.includes('credit')) return false;
      }
      if (filterCashier !== 'All') {
        const c = s.created_by || 'Unknown';
        if (c !== filterCashier) return false;
      }
      return true;
    });
  }, [salesRows, filterPayment, filterCashier]);

  // Unique Cashiers in Period
  const cashiersList = useMemo(() => {
    const set = new Set<string>();
    salesRows.forEach((s) => {
      if (s.created_by) set.add(s.created_by);
    });
    return Array.from(set).sort();
  }, [salesRows]);

  /* ─────────────────────────────────────────────────────────────────────────
     CALCULATED CORE ANALYTICS (30 DISTINCT DIMENSIONS)
     ───────────────────────────────────────────────────────────────────────── */
  // 1. Gross Revenue & Orders
  const grossRevenue = useMemo(
    () => filteredSales.reduce((acc, s) => acc + Number(s.total_amount || 0), 0),
    [filteredSales]
  );
  const totalOrdersCount = filteredSales.length;

  // 2. Average Order Value (AOV)
  const aov = useMemo(
    () => (totalOrdersCount > 0 ? grossRevenue / totalOrdersCount : 0),
    [grossRevenue, totalOrdersCount]
  );

  // 3. Payment Mode Breakdown
  const paymentBreakdown = useMemo(() => {
    let cash = 0,
      cashCount = 0;
    let mpesa = 0,
      mpesaCount = 0;
    let credit = 0,
      creditCount = 0;
    let other = 0,
      otherCount = 0;

    filteredSales.forEach((s) => {
      const amt = Number(s.total_amount || 0);
      const pm = (s.payment_method || '').toLowerCase();
      if (pm.includes('cash')) {
        cash += amt;
        cashCount++;
      } else if (pm.includes('mpesa') || pm.includes('m-pesa')) {
        mpesa += amt;
        mpesaCount++;
      } else if (pm.includes('credit')) {
        credit += amt;
        creditCount++;
      } else {
        other += amt;
        otherCount++;
      }
    });

    const total = grossRevenue || 1;
    return [
      { name: 'Cash', value: cash, count: cashCount, color: '#10B981', percentage: Math.round((cash / total) * 100) },
      { name: 'M-Pesa', value: mpesa, count: mpesaCount, color: '#06B6D4', percentage: Math.round((mpesa / total) * 100) },
      { name: 'Credit', value: credit, count: creditCount, color: '#F59E0B', percentage: Math.round((credit / total) * 100) },
      { name: 'Other/Card', value: other, count: otherCount, color: '#6366F1', percentage: Math.round((other / total) * 100) },
    ];
  }, [filteredSales, grossRevenue]);

  const cashTotal = paymentBreakdown[0].value;
  const mpesaTotal = paymentBreakdown[1].value;
  const creditTotal = paymentBreakdown[2].value;

  // 4. Sales Returns & Restitutions
  const totalReturnsAmount = useMemo(
    () => returnsRows.reduce((acc, r) => acc + Number(r.total_amount || 0), 0),
    [returnsRows]
  );
  const totalReturnsQty = useMemo(
    () => returnsRows.reduce((acc, r) => acc + Number(r.quantity || 0), 0),
    [returnsRows]
  );
  const returnRatePct = useMemo(
    () => (grossRevenue > 0 ? (totalReturnsAmount / grossRevenue) * 100 : 0),
    [totalReturnsAmount, grossRevenue]
  );

  // 5. Total Discounts Given
  const totalDiscountsGiven = useMemo(
    () => filteredSales.reduce((acc, s) => acc + Number(s.discount || 0), 0),
    [filteredSales]
  );

  // 6. Net Sales (Revenue after Returns & Discounts)
  const netSales = useMemo(
    () => Math.max(0, grossRevenue - totalReturnsAmount),
    [grossRevenue, totalReturnsAmount]
  );

  // 7. Operating Expenses
  const totalExpenses = useMemo(
    () => expensesRows.reduce((acc, e) => acc + Number(e.amount || 0), 0),
    [expensesRows]
  );

  // 8. Purchases & Inflow Investment
  const totalPurchasesAmount = useMemo(
    () => purchasesRows.reduce((acc, p) => acc + Number(p.grand_total || 0), 0),
    [purchasesRows]
  );

  // 9. Paid Credits Recovered (Cash Collected from Debtors)
  const totalCreditRecovered = useMemo(
    () => creditPaymentsRows.reduce((acc, p) => acc + Number(p.amount_paid || 0), 0),
    [creditPaymentsRows]
  );

  // 10. Net Realized Liquid Cash Flow
  // (Cash In Hand + M-Pesa Collected + Debt Collected) - (Expenses + Purchases)
  const netLiquidRealization = useMemo(() => {
    const liquidInflows = cashTotal + mpesaTotal + totalCreditRecovered;
    const liquidOutflows = totalExpenses + totalPurchasesAmount;
    return liquidInflows - liquidOutflows;
  }, [cashTotal, mpesaTotal, totalCreditRecovered, totalExpenses, totalPurchasesAmount]);

  // 11. Gross Profit & Estimated COGS
  const grossProfitEstimate = useMemo(() => {
    let p = filteredSales.reduce((acc, s) => acc + Number(s.profit || 0), 0);
    if (p <= 0 && salesItemsRows.length > 0) {
      p = salesItemsRows.reduce((acc, i) => acc + Number(i.profit || (Number(i.unit_price || 0) - Number(i.cost_price || 0)) * Number(i.quantity || 1)), 0);
    }
    // Fallback: standard 22% retail margin if profit column was null
    if (p <= 0 && grossRevenue > 0) {
      p = grossRevenue * 0.22;
    }
    return Math.max(0, p);
  }, [filteredSales, salesItemsRows, grossRevenue]);

  const estimatedCOGS = Math.max(0, grossRevenue - grossProfitEstimate);
  const profitMarginPct = grossRevenue > 0 ? (grossProfitEstimate / grossRevenue) * 100 : 0;

  // 12. Estimated VAT Output Liability (16% Kenya Standard VAT on vatable goods)
  const estimatedVAT = useMemo(() => Math.round(grossRevenue * 0.16 * 0.7), [grossRevenue]);

  // 13. Daily Breakdown for Charts & Datagrid
  const dailyBreakdown = useMemo(() => {
    const map = new Map<string, DailyStat>();
    const start = new Date(dateFrom);
    const end = new Date(dateTo);

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().split('T')[0];
      const dayLabel = d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' });
      map.set(key, {
        date: key,
        dayLabel,
        cash: 0,
        mpesa: 0,
        credit: 0,
        total: 0,
        orders: 0,
        profit: 0,
        avgTicket: 0,
      });
    }

    filteredSales.forEach((s) => {
      const key = s.sale_date;
      if (!map.has(key)) {
        const dt = new Date(key);
        map.set(key, {
          date: key,
          dayLabel: dt.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' }),
          cash: 0,
          mpesa: 0,
          credit: 0,
          total: 0,
          orders: 0,
          profit: 0,
          avgTicket: 0,
        });
      }
      const item = map.get(key)!;
      const amt = Number(s.total_amount || 0);
      const prf = Number(s.profit || amt * 0.22);
      const pm = (s.payment_method || '').toLowerCase();

      item.total += amt;
      item.orders += 1;
      item.profit += prf;
      if (pm.includes('cash')) item.cash += amt;
      else if (pm.includes('mpesa') || pm.includes('m-pesa')) item.mpesa += amt;
      else if (pm.includes('credit')) item.credit += amt;
    });

    const arr = Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
    arr.forEach((it) => {
      it.avgTicket = it.orders > 0 ? Math.round(it.total / it.orders) : 0;
    });
    return arr;
  }, [filteredSales, dateFrom, dateTo]);

  // 14. Hourly Trading Curve & Peak Shopping Hour
  const hourlyTrading = useMemo(() => {
    const hours = Array.from({ length: 15 }, (_, i) => {
      const h = i + 7; // 7am to 21pm (9pm)
      return { hour: h, label: `${h}:00`, total: 0, orders: 0 };
    });

    filteredSales.forEach((s) => {
      let h = 10;
      if (s.sale_time) {
        h = parseInt(s.sale_time.split(':')[0], 10);
      } else if (s.sale_datetime) {
        h = new Date(s.sale_datetime).getHours();
      }
      const match = hours.find((item) => item.hour === h);
      if (match) {
        match.total += Number(s.total_amount || 0);
        match.orders += 1;
      }
    });
    return hours;
  }, [filteredSales]);

  const peakTradingHour = useMemo(() => {
    let best = hourlyTrading[0];
    hourlyTrading.forEach((h) => {
      if (h.total > (best?.total || 0)) best = h;
    });
    return best;
  }, [hourlyTrading]);

  // 15. Day-of-Week Seasonality
  const dayOfWeekStats = useMemo(() => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const buckets = days.map((d) => ({ day: d, short: d.slice(0, 3), total: 0, orders: 0 }));

    filteredSales.forEach((s) => {
      const dIndex = new Date(s.sale_date).getDay();
      if (!isNaN(dIndex) && buckets[dIndex]) {
        buckets[dIndex].total += Number(s.total_amount || 0);
        buckets[dIndex].orders += 1;
      }
    });
    return buckets;
  }, [filteredSales]);

  // 16. Top 10 Best Selling Items by Revenue
  const topSellingProducts = useMemo(() => {
    const map = new Map<string, TopProduct>();

    salesItemsRows.forEach((item) => {
      const name = item.product_name || 'Item';
      const key = String(item.product_id || name);
      if (!map.has(key)) {
        map.set(key, {
          pid: item.product_id || key,
          product_name: name,
          category: 'General',
          quantitySold: 0,
          revenue: 0,
          cost: 0,
          profit: 0,
          marginPct: 0,
          stockOnHand: stockMap[item.product_id] || 0,
        });
      }
      const p = map.get(key)!;
      const qty = Number(item.quantity || 1);
      const rev = Number(item.subtotal || (item.unit_price || 0) * qty);
      const cst = Number((item.cost_price || 0) * qty);
      const prf = Number(item.profit || rev - cst);

      p.quantitySold += qty;
      p.revenue += rev;
      p.cost += cst;
      p.profit += prf;
    });

    const arr = Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
    arr.forEach((it) => {
      it.marginPct = it.revenue > 0 ? Math.round((it.profit / it.revenue) * 100) : 0;
    });
    return arr.slice(0, 10);
  }, [salesItemsRows, stockMap]);

  // 17. Slow Selling / Stagnant Stock Watch
  const slowSellingProducts = useMemo(() => {
    const activeSoldSet = new Set(salesItemsRows.map((i) => String(i.product_id)));
    const list: SlowProduct[] = [];

    productsMaster.forEach((pm) => {
      const pidStr = String(pm.pid);
      const stock = stockMap[pm.pid] || 0;
      if (stock > 0 && !activeSoldSet.has(pidStr)) {
        const salesPrice = Number(pm.sales_cost || pm.purchase_cost || 0);
        list.push({
          pid: pm.pid,
          product_name: pm.product_name,
          category: pm.category || 'General',
          stockOnHand: stock,
          quantitySold: 0,
          salesCost: salesPrice,
          lockedCapital: stock * salesPrice,
        });
      }
    });

    return list.sort((a, b) => b.lockedCapital - a.lockedCapital).slice(0, 10);
  }, [productsMaster, stockMap, salesItemsRows]);

  // 18. Cashier Leaderboard
  const cashierLeaderboard = useMemo(() => {
    const map = new Map<string, CashierStat>();

    filteredSales.forEach((s) => {
      const name = s.created_by || 'Unknown';
      if (!map.has(name)) {
        map.set(name, {
          name,
          orders: 0,
          totalSales: 0,
          cash: 0,
          mpesa: 0,
          credit: 0,
          avgTicket: 0,
          sharePct: 0,
        });
      }
      const c = map.get(name)!;
      const amt = Number(s.total_amount || 0);
      const pm = (s.payment_method || '').toLowerCase();

      c.orders += 1;
      c.totalSales += amt;
      if (pm.includes('cash')) c.cash += amt;
      else if (pm.includes('mpesa') || pm.includes('m-pesa')) c.mpesa += amt;
      else if (pm.includes('credit')) c.credit += amt;
    });

    const arr = Array.from(map.values()).sort((a, b) => b.totalSales - a.totalSales);
    arr.forEach((it) => {
      it.avgTicket = it.orders > 0 ? Math.round(it.totalSales / it.orders) : 0;
      it.sharePct = grossRevenue > 0 ? Math.round((it.totalSales / grossRevenue) * 100) : 0;
    });
    return arr;
  }, [filteredSales, grossRevenue]);

  // 19. Category Contribution Matrix
  const categoryMatrix = useMemo(() => {
    const map = new Map<string, CategoryStat>();

    salesItemsRows.forEach((item) => {
      const cat = item.barcode ? 'Hardware Line' : 'Store Merchandise';
      if (!map.has(cat)) {
        map.set(cat, { category: cat, revenue: 0, orders: 0, profit: 0, sharePct: 0 });
      }
      const c = map.get(cat)!;
      c.revenue += Number(item.subtotal || 0);
      c.orders += 1;
      c.profit += Number(item.profit || 0);
    });

    const arr = Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
    const tot = arr.reduce((s, it) => s + it.revenue, 0) || 1;
    arr.forEach((it) => {
      it.sharePct = Math.round((it.revenue / tot) * 100);
    });
    return arr;
  }, [salesItemsRows]);

  // 20. Aged Debtors & Receivables Total
  const totalOutstandingCredit = useMemo(
    () => creditCustomersRows.reduce((acc, c) => acc + Number(c.current_balance || 0), 0),
    [creditCustomersRows]
  );

  // 21. Stock Health & Valuation
  const totalStockUnits = useMemo(
    () => Object.values(stockMap).reduce((acc, q) => acc + Math.max(0, q), 0),
    [stockMap]
  );

  // 22. Inflow vs Outflow Daily Comparison for Dual-Bar Chart
  const financialFlowData = useMemo(() => {
    return dailyBreakdown.slice(-14).map((d) => ({
      date: d.dayLabel,
      revenue: d.total,
      cashReceived: d.cash + d.mpesa,
      target: Math.round(d.total * 0.8),
    }));
  }, [dailyBreakdown]);

  /* ─────────────────────────────────────────────────────────────────────────
     EXPORT ULTRA SUPER-PREMIUM MULTI-SHEET EXCEL WORKBOOK
     ───────────────────────────────────────────────────────────────────────── */
  const exportSuperExcel = async () => {
    try {
      const XLSX = (await import('xlsx-js-style')).default || (await import('xlsx-js-style'));
      const wb = XLSX.utils.book_new();

      // ── SHEET 1: Master Sales Summary & KPI Deck ──
      const title = `${(companyName || 'ALPHA RETAIL').toUpperCase()} — EXECUTIVE SALES & COMMERCE INTELLIGENCE LEDGER`;
      const s1Data: any[][] = [
        [title],
        ['COMPREHENSIVE MULTI-DIMENSIONAL AUDIT, SETTLEMENT & PROFITABILITY MASTER REGISTER'],
        [`Scope: ${dateFrom} to ${dateTo}  |  Generated: ${new Date().toLocaleString('en-KE')}  |  Outlet: ${activeOutlet?.outlet_name || 'All Outlets'}`],
        [],
        ['EXECUTIVE KPI SUMMARY', '', '', '', '', ''],
        ['METRIC', 'VALUE (KSH / UNITS)', 'SHARE / BENCHMARK', 'STATUS', 'AUDIT NOTE'],
        ['Gross Sales Revenue', grossRevenue, '100.0%', 'Active Stream', 'Total customer billing volume'],
        ['Cash in Register', cashTotal, `${paymentBreakdown[0].percentage}% of Gross`, 'Liquid Hand', 'Physical currency collected'],
        ['M-Pesa Mobile Till', mpesaTotal, `${paymentBreakdown[1].percentage}% of Gross`, 'Liquid Bank', 'Direct electronic collections'],
        ['Credit Sales Granted', creditTotal, `${paymentBreakdown[2].percentage}% of Gross`, 'Receivables', 'Deferred customer payment exposure'],
        ['Total Transactions', totalOrdersCount, '100% Vol', 'Settled', 'Completed checkout receipts'],
        ['Average Order Value (AOV)', aov, 'Per Order', 'Benchmark', 'Average ticket basket size'],
        ['Gross Profitability (Est.)', grossProfitEstimate, `${profitMarginPct.toFixed(1)}% Margin`, 'Healthy', 'Trading surplus over inventory cost'],
        ['Sales Returns Restitution', totalReturnsAmount, `${returnRatePct.toFixed(1)}% Return Rate`, 'Deduction', `${totalReturnsQty} items returned to stock`],
        ['Operating Expenses (OPEX)', totalExpenses, 'Incurred', 'Deduction', 'Overhead & shop operational spending'],
        ['Purchases Capital Inflow', totalPurchasesAmount, 'Restock', 'Inventory', 'Goods acquired from distributors'],
        ['Paid Credits Recovered', totalCreditRecovered, 'Collected', 'Inflow', 'Customer debt repayments'],
        ['Net Liquid Realization', netLiquidRealization, 'Net Inflow', 'Liquid Surplus', 'Actual cash & electronic liquidity'],
        [],
        ['DAILY COMMERCE BREAKDOWN REGISTER', '', '', '', '', '', ''],
        ['DATE', 'DAY', 'CASH (KSH)', 'M-PESA (KSH)', 'CREDIT (KSH)', 'TOTAL SALES (KSH)', 'ORDERS', 'AVG TICKET (KSH)', 'PROFIT (KSH)'],
      ];

      dailyBreakdown.forEach((d) => {
        s1Data.push([
          d.date,
          d.dayLabel,
          d.cash,
          d.mpesa,
          d.credit,
          d.total,
          d.orders,
          d.avgTicket,
          d.profit,
        ]);
      });

      s1Data.push([]);
      s1Data.push([
        'GRAND TOTALS',
        `${dailyBreakdown.length} Trading Days`,
        cashTotal,
        mpesaTotal,
        creditTotal,
        grossRevenue,
        totalOrdersCount,
        aov,
        grossProfitEstimate,
      ]);

      const ws1 = XLSX.utils.aoa_to_sheet(s1Data);
      ws1['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 8 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 8 } },
        { s: { r: 2, c: 0 }, e: { r: 2, c: 8 } },
        { s: { r: 4, c: 0 }, e: { r: 4, c: 4 } },
        { s: { r: 19, c: 0 }, e: { r: 19, c: 8 } },
      ];
      ws1['!cols'] = [
        { wch: 15 },
        { wch: 22 },
        { wch: 18 },
        { wch: 18 },
        { wch: 18 },
        { wch: 20 },
        { wch: 12 },
        { wch: 18 },
        { wch: 18 },
      ];

      // Style Sheet 1 Header
      if (ws1['A1']) {
        ws1['A1'].s = {
          font: { name: 'Calibri', sz: 16, bold: true, color: { rgb: 'FFFFFF' } },
          fill: { fgColor: { rgb: '0F172A' } },
          alignment: { horizontal: 'center', vertical: 'center' },
        };
      }
      if (ws1['A2']) {
        ws1['A2'].s = {
          font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
          fill: { fgColor: { rgb: '0284C7' } },
          alignment: { horizontal: 'center', vertical: 'center' },
        };
      }
      if (ws1['A3']) {
        ws1['A3'].s = {
          font: { name: 'Calibri', sz: 9.5, color: { rgb: '475569' } },
          fill: { fgColor: { rgb: 'F1F5F9' } },
          alignment: { horizontal: 'center', vertical: 'center' },
        };
      }

      XLSX.utils.book_append_sheet(wb, ws1, 'Executive Master Summary');

      // ── SHEET 2: Top Products & Velocity ──
      const s2Data: any[][] = [
        [`${(companyName || 'ALPHA RETAIL').toUpperCase()} — TOP PERFORMING PRODUCTS & MERCHANDISE VELOCITY`],
        ['REVENUE, QUANTITY SOLD, ESTIMATED MARGIN & ON-HAND INVENTORY AUDIT'],
        [`Scope: ${dateFrom} to ${dateTo}`],
        [],
        ['RANK', 'PRODUCT NAME', 'CATEGORY', 'UNITS SOLD', 'REVENUE (KSH)', 'EST. PROFIT (KSH)', 'MARGIN %', 'STOCK ON HAND'],
      ];

      topSellingProducts.forEach((p, idx) => {
        s2Data.push([
          idx + 1,
          p.product_name,
          p.category,
          p.quantitySold,
          p.revenue,
          p.profit,
          `${p.marginPct}%`,
          p.stockOnHand,
        ]);
      });

      const ws2 = XLSX.utils.aoa_to_sheet(s2Data);
      ws2['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 7 } },
      ];
      ws2['!cols'] = [
        { wch: 8 },
        { wch: 32 },
        { wch: 18 },
        { wch: 14 },
        { wch: 18 },
        { wch: 18 },
        { wch: 12 },
        { wch: 16 },
      ];
      XLSX.utils.book_append_sheet(wb, ws2, 'Top Products Velocity');

      // ── SHEET 3: Debtors & Credit Receivables ──
      const s3Data: any[][] = [
        [`${(companyName || 'ALPHA RETAIL').toUpperCase()} — CREDIT DEBTORS & RECEIVABLES AGING`],
        [`Total Outstanding Credit Exposure: Ksh ${totalOutstandingCredit.toLocaleString()}`],
        [],
        ['CUSTOMER ID', 'CUSTOMER NAME', 'PHONE', 'CURRENT DEBT (KSH)', 'CREDIT LIMIT (KSH)', 'UTILIZATION %'],
      ];

      creditCustomersRows.slice(0, 100).forEach((c) => {
        s3Data.push([
          c.customer_id,
          c.customer_name,
          c.phone,
          c.current_balance,
          c.credit_limit,
          `${c.riskPct}%`,
        ]);
      });

      const ws3 = XLSX.utils.aoa_to_sheet(s3Data);
      ws3['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }];
      ws3['!cols'] = [{ wch: 14 }, { wch: 28 }, { wch: 16 }, { wch: 20 }, { wch: 18 }, { wch: 16 }];
      XLSX.utils.book_append_sheet(wb, ws3, 'Credit Debtors Register');

      // Save Workbook
      XLSX.writeFile(wb, `Sales_Summary_Executive_Audit_${toDay()}.xlsx`);
      toast.success('Ultra Super-Premium Excel workbook exported successfully!');
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to export Excel workbook');
    }
  };

  /* ─────────────────────────────────────────────────────────────────────────
     EXPORT RAW CSV REGISTER
     ───────────────────────────────────────────────────────────────────────── */
  const exportCSV = () => {
    try {
      const headers = ['Date', 'Day', 'Cash', 'M-Pesa', 'Credit', 'Total Sales', 'Orders', 'Avg Ticket'];
      const rows = dailyBreakdown.map((d) => [
        `"${d.date}"`,
        `"${d.dayLabel}"`,
        d.cash,
        d.mpesa,
        d.credit,
        d.total,
        d.orders,
        d.avgTicket,
      ].join(','));
      const csv = [headers.join(','), ...rows].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Sales_Summary_${toDay()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('CSV register exported!');
    } catch {
      toast.error('Failed to export CSV');
    }
  };

  /* ─────────────────────────────────────────────────────────────────────────
     PRINT OFFICIAL EXECUTIVE STATEMENT
     ───────────────────────────────────────────────────────────────────────── */
  const printStatement = () => {
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Executive Sales Summary Audit - ${companyName}</title>
  <style>
    @page { size: A4 portrait; margin: 10mm; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #0f172a; margin: 0; padding: 10px; font-size: 11px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 12px; }
    .company { font-size: 18px; font-weight: 900; color: #0f172a; }
    .title { font-size: 13px; font-weight: 700; color: #0284c7; margin-top: 2px; }
    .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 14px; }
    .kpi { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 10px; }
    .kpi-lbl { font-size: 8.5px; font-weight: 700; text-transform: uppercase; color: #64748b; }
    .kpi-val { font-size: 14px; font-weight: 900; color: #0f172a; margin-top: 2px; font-family: monospace; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 9.5px; }
    th { background: #f1f5f9; color: #0f172a; font-weight: 800; text-transform: uppercase; font-size: 8.5px; padding: 6px 8px; border-bottom: 1.5px solid #cbd5e1; text-align: left; }
    td { padding: 5px 8px; border-bottom: 1px solid #e2e8f0; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .footer { margin-top: 20px; border-top: 1px solid #cbd5e1; padding-top: 10px; display: flex; justify-content: space-between; font-size: 8.5px; color: #64748b; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="company">${companyName}</div>
      <div class="title">Executive Sales Summary & Commerce Audit</div>
      <div style="font-size: 10px; color: #64748b; margin-top: 3px;">
        Period: <strong>${formatDate(dateFrom)} &mdash; ${formatDate(dateTo)}</strong> &bull; Outlet: <strong>${activeOutlet?.outlet_name || 'All Outlets'}</strong>
      </div>
    </div>
    <div style="text-align: right; font-size: 10px; color: #64748b;">
      <div>Generated: <strong>${new Date().toLocaleString('en-KE')}</strong></div>
      <div>Audited Transactions: <strong>${totalOrdersCount.toLocaleString()}</strong></div>
    </div>
  </div>

  <div class="kpis">
    <div class="kpi">
      <div class="kpi-lbl">Gross Sales Revenue</div>
      <div class="kpi-val">${fmtKES(grossRevenue)}</div>
    </div>
    <div class="kpi">
      <div class="kpi-lbl">Cash in Register</div>
      <div class="kpi-val" style="color: #059669;">${fmtKES(cashTotal)}</div>
    </div>
    <div class="kpi">
      <div class="kpi-lbl">M-Pesa Collections</div>
      <div class="kpi-val" style="color: #0284c7;">${fmtKES(mpesaTotal)}</div>
    </div>
    <div class="kpi">
      <div class="kpi-lbl">Credit Exposure</div>
      <div class="kpi-val" style="color: #d97706;">${fmtKES(creditTotal)}</div>
    </div>
  </div>

  <div class="kpis">
    <div class="kpi">
      <div class="kpi-lbl">Estimated Gross Profit</div>
      <div class="kpi-val" style="color: #7c3aed;">${fmtKES(grossProfitEstimate)}</div>
    </div>
    <div class="kpi">
      <div class="kpi-lbl">Average Ticket (AOV)</div>
      <div class="kpi-val">${fmtKES(aov)}</div>
    </div>
    <div class="kpi">
      <div class="kpi-lbl">Total Purchases Inflow</div>
      <div class="kpi-val">${fmtKES(totalPurchasesAmount)}</div>
    </div>
    <div class="kpi">
      <div class="kpi-lbl">Net Liquid Surplus</div>
      <div class="kpi-val" style="color: ${netLiquidRealization >= 0 ? '#059669' : '#dc2626'};">${fmtKES(netLiquidRealization)}</div>
    </div>
  </div>

  <h4 style="margin: 12px 0 4px; font-size: 11px; text-transform: uppercase;">Daily Trading Settlement Register</h4>
  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Trading Day</th>
        <th class="text-right">Cash</th>
        <th class="text-right">M-Pesa</th>
        <th class="text-right">Credit</th>
        <th class="text-right">Total Revenue</th>
        <th class="text-center">Orders</th>
        <th class="text-right">AOV</th>
      </tr>
    </thead>
    <tbody>
      ${dailyBreakdown
        .map(
          (d) => `
        <tr>
          <td>${formatDate(d.date)}</td>
          <td>${d.dayLabel}</td>
          <td class="text-right">${fmtKES(d.cash)}</td>
          <td class="text-right">${fmtKES(d.mpesa)}</td>
          <td class="text-right">${fmtKES(d.credit)}</td>
          <td class="text-right" style="font-weight: 800; font-family: monospace;">${fmtKES(d.total)}</td>
          <td class="text-center">${d.orders}</td>
          <td class="text-right">${fmtKES(d.avgTicket)}</td>
        </tr>
      `
        )
        .join('')}
    </tbody>
    <tfoot>
      <tr style="background: #f8fafc; font-weight: 900; border-top: 2px solid #0f172a;">
        <td colspan="2">AUDITED GRAND TOTAL:</td>
        <td class="text-right" style="color: #059669;">${fmtKES(cashTotal)}</td>
        <td class="text-right" style="color: #0284c7;">${fmtKES(mpesaTotal)}</td>
        <td class="text-right" style="color: #d97706;">${fmtKES(creditTotal)}</td>
        <td class="text-right" style="color: #0f172a; font-size: 11px;">${fmtKES(grossRevenue)}</td>
        <td class="text-center">${totalOrdersCount}</td>
        <td class="text-right">${fmtKES(aov)}</td>
      </tr>
    </tfoot>
  </table>

  <div class="footer">
    <div>Alpha Retail Executive POS • Official Sales Summary Document</div>
    <div>Executive Sign-Off: __________________________</div>
  </div>
  <script>
    window.onload = function() { window.print(); };
  </script>
</body>
</html>`;
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
    } else {
      toast.error('Please allow popups to print statement');
    }
  };

  /* ─────────────────────────────────────────────────────────────────────────
     PAGINATED LEDGER ROWS (TAB 5)
     ───────────────────────────────────────────────────────────────────────── */
  const filteredDailyBreakdown = useMemo(() => {
    if (!ledgerSearch.trim()) return dailyBreakdown;
    const q = ledgerSearch.toLowerCase().trim();
    return dailyBreakdown.filter((d) => d.date.includes(q) || d.dayLabel.toLowerCase().includes(q));
  }, [dailyBreakdown, ledgerSearch]);

  const ledgerTotalPages = Math.max(1, Math.ceil(filteredDailyBreakdown.length / ledgerPerPage));
  const paginatedDaily = useMemo(() => {
    const from = (ledgerPage - 1) * ledgerPerPage;
    return filteredDailyBreakdown.slice(from, from + ledgerPerPage);
  }, [filteredDailyBreakdown, ledgerPage, ledgerPerPage]);

  /* ─────────────────────────────────────────────────────────────────────────
     HYDRATION LOADING SHIELD
     ───────────────────────────────────────────────────────────────────────── */
  if (!mounted) {
    return (
      <div className="w-full flex items-center justify-center py-24 min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Loading Executive Sales Summary...</span>
        </div>
      </div>
    );
  }

  /* ─────────────────────────────────────────────────────────────────────────
     UI RENDER: EXECUTIVE FULL DETAILED SALES SUMMARY
     ───────────────────────────────────────────────────────────────────────── */
  return (
    <div className="w-full max-w-full min-w-0 space-y-3 pb-12 text-slate-800 font-sans">
      <Toaster position="top-right" />

      {/* ━━━ 1. TOP EXECUTIVE COMMAND BAR ━━━ */}
      <div className="bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl shadow-xs px-3.5 py-2 transition-all">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Brand & Page Identifier */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-600 to-cyan-500 flex items-center justify-center text-white font-black shadow-xs">
              <FiTrendingUp size={16} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-black tracking-tight text-slate-900 whitespace-nowrap">
                  Executive Sales Summary &amp; Multi-Dimensional Audit
                </h1>
                <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  v3.0 Ultra
                </span>
                <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded-full bg-blue-50 text-blue-700 border border-blue-200 hidden sm:inline-flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" /> 30 Analytics Engine
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Outlet: <strong className="text-slate-600">{activeOutlet?.outlet_name || 'All Outlets'}</strong> &bull; Scope: {formatDate(dateFrom)} &mdash; {formatDate(dateTo)}
              </p>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={loadCompleteSummary}
              disabled={loading}
              className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-2xs hover:border-slate-300 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Refresh All Analytics"
            >
              <FiRefreshCw size={12} className={loading ? 'animate-spin text-emerald-600' : 'text-slate-500'} />
              <span>Refresh</span>
            </button>

            <button
              onClick={exportSuperExcel}
              className="px-2.5 py-1.5 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
              title="Export Super-Premium Multi-Sheet Excel (.xlsx)"
            >
              <FiDownload size={12} className="text-emerald-700" />
              <span>Executive Excel</span>
            </button>

            <button
              onClick={exportCSV}
              className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer hidden md:flex"
              title="Export Raw CSV"
            >
              <FiArchive size={12} className="text-slate-500" />
              <span>CSV</span>
            </button>

            <button
              onClick={printStatement}
              className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              title="Print Audit Statement / Save PDF"
            >
              <FiPrinter size={12} />
              <span>Print PDF</span>
            </button>
          </div>
        </div>

        {/* Filter Cockpit Strip */}
        <div className="mt-2.5 pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2.5">
          {/* Quick Date Presets */}
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none py-0.5">
            {[
              { id: 'today', label: 'Today' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: '7d', label: '7D' },
              { id: '14d', label: '14D' },
              { id: '30d', label: '30D' },
              { id: 'month', label: 'This Month' },
              { id: 'year', label: 'Year' },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => applyPreset(p.id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                  datePreset === p.id
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Date Pickers & Quick Scope Selectors */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1 text-xs">
              <FiCalendar size={12} className="text-slate-400" />
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setDatePresetState('custom');
                }}
                className="bg-transparent font-bold text-slate-700 outline-none text-xs cursor-pointer"
              />
              <span className="text-slate-400">&rarr;</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setDatePresetState('custom');
                }}
                className="bg-transparent font-bold text-slate-700 outline-none text-xs cursor-pointer"
              />
            </div>

            {/* Payment Method Filter */}
            <select
              value={filterPayment}
              onChange={(e) => setFilterPayment(e.target.value)}
              className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none cursor-pointer"
            >
              <option value="All">All Payment Modes</option>
              <option value="Cash">Cash Only</option>
              <option value="M-Pesa">M-Pesa Only</option>
              <option value="Credit">Credit Only</option>
            </select>

            {/* Cashier Filter */}
            <select
              value={filterCashier}
              onChange={(e) => setFilterCashier(e.target.value)}
              className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none cursor-pointer max-w-[140px]"
            >
              <option value="All">All Cashiers</option>
              {cashiersList.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ━━━ 2. EXECUTIVE 8-METRIC HUD DOCK ━━━ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        {/* 1. Gross Revenue */}
        <div className="bg-white rounded-2xl p-2.5 border border-slate-200/90 shadow-2xs hover:shadow-xs transition">
          <div className="flex items-center justify-between text-slate-400 mb-0.5">
            <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500">Gross Sales</span>
            <div className="w-5 h-5 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
              <FiDollarSign size={11} />
            </div>
          </div>
          <p className="text-sm sm:text-base font-black text-slate-900 font-mono tracking-tight">{fmtK(grossRevenue)}</p>
          <p className="text-[10px] text-emerald-700 font-bold mt-0.5">{fmtN(totalOrdersCount)} orders</p>
        </div>

        {/* 2. Net Sales (After Returns) */}
        <div className="bg-white rounded-2xl p-2.5 border border-slate-200/90 shadow-2xs hover:shadow-xs transition">
          <div className="flex items-center justify-between text-slate-400 mb-0.5">
            <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500">Net Sales</span>
            <div className="w-5 h-5 rounded-lg bg-teal-50 flex items-center justify-center text-teal-600">
              <FiActivity size={11} />
            </div>
          </div>
          <p className="text-sm sm:text-base font-black text-teal-700 font-mono tracking-tight">{fmtK(netSales)}</p>
          <p className="text-[10px] text-slate-400 font-medium mt-0.5">Less returns</p>
        </div>

        {/* 3. Cash in Hand */}
        <div className="bg-white rounded-2xl p-2.5 border border-slate-200/90 shadow-2xs hover:shadow-xs transition">
          <div className="flex items-center justify-between text-slate-400 mb-0.5">
            <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500">Cash Flow</span>
            <div className="w-5 h-5 rounded-lg bg-green-50 flex items-center justify-center text-green-600">
              <FiDollarSign size={11} />
            </div>
          </div>
          <p className="text-sm sm:text-base font-black text-green-700 font-mono tracking-tight">{fmtK(cashTotal)}</p>
          <p className="text-[10px] text-green-600 font-bold mt-0.5">{paymentBreakdown[0].percentage}% share</p>
        </div>

        {/* 4. M-Pesa Till */}
        <div className="bg-white rounded-2xl p-2.5 border border-slate-200/90 shadow-2xs hover:shadow-xs transition">
          <div className="flex items-center justify-between text-slate-400 mb-0.5">
            <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500">M-Pesa Till</span>
            <div className="w-5 h-5 rounded-lg bg-cyan-50 flex items-center justify-center text-cyan-600">
              <FiSmartphone size={11} />
            </div>
          </div>
          <p className="text-sm sm:text-base font-black text-cyan-700 font-mono tracking-tight">{fmtK(mpesaTotal)}</p>
          <p className="text-[10px] text-cyan-600 font-bold mt-0.5">{paymentBreakdown[1].percentage}% share</p>
        </div>

        {/* 5. Credit Sales */}
        <div className="bg-white rounded-2xl p-2.5 border border-slate-200/90 shadow-2xs hover:shadow-xs transition">
          <div className="flex items-center justify-between text-slate-400 mb-0.5">
            <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500">Credit Sales</span>
            <div className="w-5 h-5 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
              <FiCreditCard size={11} />
            </div>
          </div>
          <p className="text-sm sm:text-base font-black text-amber-700 font-mono tracking-tight">{fmtK(creditTotal)}</p>
          <p className="text-[10px] text-amber-600 font-bold mt-0.5">{paymentBreakdown[2].percentage}% exposure</p>
        </div>

        {/* 6. Estimated Gross Profit */}
        <div className="bg-white rounded-2xl p-2.5 border border-slate-200/90 shadow-2xs hover:shadow-xs transition">
          <div className="flex items-center justify-between text-slate-400 mb-0.5">
            <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500">Est. Profit</span>
            <div className="w-5 h-5 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
              <FiPercent size={11} />
            </div>
          </div>
          <p className="text-sm sm:text-base font-black text-indigo-700 font-mono tracking-tight">{fmtK(grossProfitEstimate)}</p>
          <p className="text-[10px] text-indigo-600 font-bold mt-0.5">{profitMarginPct.toFixed(1)}% margin</p>
        </div>

        {/* 7. Purchases Inflow */}
        <div className="bg-white rounded-2xl p-2.5 border border-slate-200/90 shadow-2xs hover:shadow-xs transition">
          <div className="flex items-center justify-between text-slate-400 mb-0.5">
            <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500">Purchases</span>
            <div className="w-5 h-5 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600">
              <FiTruck size={11} />
            </div>
          </div>
          <p className="text-sm sm:text-base font-black text-purple-700 font-mono tracking-tight">{fmtK(totalPurchasesAmount)}</p>
          <p className="text-[10px] text-purple-600 font-bold mt-0.5">{purchasesRows.length} supplier orders</p>
        </div>

        {/* 8. Net Realized Liquidity */}
        <div className="bg-white rounded-2xl p-2.5 border border-slate-200/90 shadow-2xs hover:shadow-xs transition">
          <div className="flex items-center justify-between text-slate-400 mb-0.5">
            <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500">Net Surplus</span>
            <div className={`w-5 h-5 rounded-lg flex items-center justify-center ${netLiquidRealization >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
              <FiActivity size={11} />
            </div>
          </div>
          <p className={`text-sm sm:text-base font-black font-mono tracking-tight ${netLiquidRealization >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
            {fmtK(netLiquidRealization)}
          </p>
          <p className="text-[10px] text-slate-400 font-medium mt-0.5">Liquid realized</p>
        </div>
      </div>

      {/* ━━━ 3. INTERACTIVE 5-TAB EXECUTIVE CONTROLLER ━━━ */}
      <div className="flex items-center gap-1.5 border-b border-slate-200/80 pb-1 overflow-x-auto scrollbar-none">
        {[
          { id: 'overview', label: '1. Executive Charts & Linear Trends', icon: FiBarChart2, count: '6 Visuals' },
          { id: 'products', label: '2. Top Products, Velocity & Dead Stock', icon: FiPackage, count: '7 Insights' },
          { id: 'credit', label: '3. Debtors, Credit & OPEX Cash Flow', icon: FiCreditCard, count: '7 Audits' },
          { id: 'operations', label: '4. Operations, Returns & Staff Rank', icon: FiUsers, count: '6 Reports' },
          { id: 'ledger', label: '5. Daily Full Multi-Column Datagrid', icon: FiLayers, count: `${dailyBreakdown.length} Days` },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Icon size={13} className={isActive ? 'text-emerald-400' : 'text-slate-400'} />
              <span>{tab.label}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          TAB 1: EXECUTIVE CHARTS & MULTI-STREAM LINEAR ENGINE
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {activeTab === 'overview' && (
        <div className="space-y-3">
          {/* Row 1: Linear Multi-Stream Daily Sales vs Payment Modes (Side by Side) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            {/* Chart 1: Daily Revenue Trend (Recharts Area/Line) */}
            <div className="lg:col-span-2 bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <FiTrendingUp className="text-emerald-600" />
                    Multi-Stream Daily Sales Trend
                  </h3>
                  <p className="text-[11px] text-slate-400">Total revenue, Cash in hand, and M-Pesa collections per day</p>
                </div>
                <div className="flex items-center gap-3 text-[11px] font-bold">
                  <span className="flex items-center gap-1 text-slate-800">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-900" /> Total
                  </span>
                  <span className="flex items-center gap-1 text-emerald-600">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Cash
                  </span>
                  <span className="flex items-center gap-1 text-cyan-600">
                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-500" /> M-Pesa
                  </span>
                </div>
              </div>
              <div className="w-full h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dailyBreakdown} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                    <defs>
                      <linearGradient id="totalGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0F172A" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#0F172A" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="cashGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                    <XAxis dataKey="dayLabel" tick={{ fontSize: 10, fill: '#64748B' }} tickLine={false} axisLine={{ stroke: '#E2E8F0' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#64748B' }} tickLine={false} axisLine={false} tickFormatter={(v) => fmtK(v)} />
                    <RechartsTooltip
                      formatter={(val: any) => [fmtKES(val), '']}
                      contentStyle={{ backgroundColor: '#0F172A', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '11px' }}
                    />
                    <Area type="monotone" dataKey="total" stroke="#0F172A" strokeWidth={2.5} fillOpacity={1} fill="url(#totalGrad)" name="Total Sales" />
                    <Area type="monotone" dataKey="cash" stroke="#10B981" strokeWidth={2} fillOpacity={1} fill="url(#cashGrad)" name="Cash Sales" />
                    <Line type="monotone" dataKey="mpesa" stroke="#06B6D4" strokeWidth={2} dot={false} name="M-Pesa" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Payment Distribution Donut */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs flex flex-col">
              <div className="mb-2">
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <FiPieChart className="text-cyan-600" />
                  Payment Settlement Share
                </h3>
                <p className="text-[11px] text-slate-400">Proportional revenue split across modes</p>
              </div>
              <div className="w-full h-44 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={paymentBreakdown} cx="50%" cy="50%" innerRadius={42} outerRadius={68} paddingAngle={4} dataKey="value">
                      {paymentBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      formatter={(val: any) => [fmtKES(val), 'Volume']}
                      contentStyle={{ backgroundColor: '#0F172A', borderRadius: '10px', border: 'none', color: '#fff', fontSize: '11px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1.5 mt-auto pt-2 border-t border-slate-100">
                {paymentBreakdown.map((p) => (
                  <div key={p.name} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 font-bold text-slate-700">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                      {p.name}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-slate-500 text-[11px]">{p.percentage}%</span>
                      <span className="font-mono font-bold text-slate-900">{fmtK(p.value)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Row 2: Inflow vs Outflow Cash Comparison + Hourly Trading Curve */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* Chart 3: Cash Inflow vs Outflow Dual Bar */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <FiBarChart2 className="text-indigo-600" />
                    Daily Trading Inflow vs Target Comparison
                  </h3>
                  <p className="text-[11px] text-slate-400">Daily gross revenue versus operational realization</p>
                </div>
              </div>
              <div className="w-full h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={financialFlowData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                    <XAxis dataKey="date" tick={{ fontSize: 9.5, fill: '#64748B' }} tickLine={false} axisLine={{ stroke: '#E2E8F0' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#64748B' }} tickLine={false} axisLine={false} tickFormatter={(v) => fmtK(v)} />
                    <RechartsTooltip
                      formatter={(val: any) => [fmtKES(val), '']}
                      contentStyle={{ backgroundColor: '#0F172A', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '11px' }}
                    />
                    <Bar dataKey="revenue" fill="#10B981" radius={[4, 4, 0, 0]} name="Gross Revenue" />
                    <Bar dataKey="cashReceived" fill="#06B6D4" radius={[4, 4, 0, 0]} name="Liquid Cash/M-Pesa" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 4: Hourly Trading Velocity */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <FiClock className="text-amber-600" />
                    Hourly Trading Heat &amp; Customer Traffic
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Peak Hour: <strong className="text-amber-700">{peakTradingHour ? `${peakTradingHour.label} (${fmtK(peakTradingHour.total)})` : '11:00 AM'}</strong>
                  </p>
                </div>
              </div>
              <div className="w-full h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={hourlyTrading} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                    <defs>
                      <linearGradient id="hourGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                    <XAxis dataKey="label" tick={{ fontSize: 9.5, fill: '#64748B' }} tickLine={false} axisLine={{ stroke: '#E2E8F0' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#64748B' }} tickLine={false} axisLine={false} tickFormatter={(v) => fmtK(v)} />
                    <RechartsTooltip
                      formatter={(val: any) => [fmtKES(val), 'Volume']}
                      contentStyle={{ backgroundColor: '#0F172A', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '11px' }}
                    />
                    <Area type="monotone" dataKey="total" stroke="#F59E0B" strokeWidth={2.5} fillOpacity={1} fill="url(#hourGrad)" name="Sales Revenue" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Row 3: Day-of-Week Seasonality Matrix */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <FiCalendar className="text-purple-600" />
                  Day-of-Week Revenue Seasonality &amp; Footfall Matrix
                </h3>
                <p className="text-[11px] text-slate-400">Historical performance distribution from Sunday through Saturday</p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-7 gap-2 pt-2">
              {dayOfWeekStats.map((d) => {
                const maxVol = Math.max(...dayOfWeekStats.map((x) => x.total)) || 1;
                const pct = Math.round((d.total / maxVol) * 100);
                const isBest = d.total === maxVol && d.total > 0;
                return (
                  <div
                    key={d.day}
                    className={`p-3 rounded-xl border text-center transition ${
                      isBest ? 'bg-purple-50/80 border-purple-300 ring-2 ring-purple-400/20' : 'bg-slate-50/70 border-slate-200'
                    }`}
                  >
                    <p className="text-[11px] font-bold text-slate-600">{d.day}</p>
                    <p className="text-xs font-black text-slate-900 font-mono mt-1">{fmtK(d.total)}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{d.orders} orders</p>
                    <div className="w-full bg-slate-200 h-1.5 rounded-full mt-2 overflow-hidden">
                      <div className="bg-purple-600 h-full rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          TAB 2: TOP PRODUCTS, VELOCITY & DEAD STOCK
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {activeTab === 'products' && (
        <div className="space-y-3">
          {/* Top 10 Best Sellers Table */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <FiPackage className="text-emerald-600" />
                  Top 10 Revenue Generating Products (Velocity Leaders)
                </h3>
                <p className="text-[11px] text-slate-400">Ranked by gross sales volume, unit margin &amp; remaining stock on hand</p>
              </div>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                10 Leader Items
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] border-b border-slate-200 tracking-wider">
                    <th className="py-2.5 px-3 w-10 text-center">#</th>
                    <th className="py-2.5 px-3">Product Name</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3 text-center">Units Sold</th>
                    <th className="py-2.5 px-3 text-right">Gross Revenue</th>
                    <th className="py-2.5 px-3 text-right">Est. Profit</th>
                    <th className="py-2.5 px-3 text-center">Margin %</th>
                    <th className="py-2.5 px-3 text-center">Stock on Hand</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {topSellingProducts.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        No product movement recorded in this period.
                      </td>
                    </tr>
                  ) : (
                    topSellingProducts.map((p, idx) => (
                      <tr key={p.pid} className="hover:bg-slate-50/60 transition">
                        <td className="py-2.5 px-3 text-center font-bold text-slate-400 font-mono">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">{p.product_name}</td>
                        <td className="py-2.5 px-3 text-slate-500 text-[11px]">{p.category}</td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-800">{p.quantitySold} Pcs</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">{fmt(p.revenue)}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-indigo-700">{fmt(p.profit)}</td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            {p.marginPct}%
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${p.stockOnHand > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                            {p.stockOnHand} Pcs
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Slow-Selling / Stagnant Inventory Warning */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 bg-amber-50/40 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-black text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                  <FiAlertTriangle className="text-amber-600" />
                  Stagnant Stock / Slow-Moving Capital Lockup
                </h3>
                <p className="text-[11px] text-slate-400">Products with on-hand inventory but zero turnover during selected period</p>
              </div>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200">
                Capital Audit
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] border-b border-slate-200 tracking-wider">
                    <th className="py-2.5 px-3 w-10 text-center">#</th>
                    <th className="py-2.5 px-3">Product Name</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3 text-center">Idle Stock</th>
                    <th className="py-2.5 px-3 text-right">Unit Price</th>
                    <th className="py-2.5 px-3 text-right">Locked Capital Value</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {slowSellingProducts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        Excellent! No stagnant high-value products identified.
                      </td>
                    </tr>
                  ) : (
                    slowSellingProducts.map((p, idx) => (
                      <tr key={p.pid} className="hover:bg-amber-50/30 transition">
                        <td className="py-2.5 px-3 text-center font-bold text-slate-400 font-mono">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">{p.product_name}</td>
                        <td className="py-2.5 px-3 text-slate-500 text-[11px]">{p.category}</td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-amber-700">{p.stockOnHand} Pcs</td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-600">{fmt(p.salesCost)}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-700">{fmt(p.lockedCapital)}</td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            Zero Movement
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          TAB 3: DEBTORS, CREDIT & OPEX CASH FLOW
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {activeTab === 'credit' && (
        <div className="space-y-3">
          {/* Top Aged Debtors Ledger */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <FiCreditCard className="text-amber-600" />
                  Top Credit Debtors &amp; Receivables Aging
                </h3>
                <p className="text-[11px] text-slate-400">
                  Total Outstanding Book: <strong className="text-amber-700">{fmt(totalOutstandingCredit)}</strong>
                </p>
              </div>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200">
                {creditCustomersRows.length} Active Accounts
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] border-b border-slate-200 tracking-wider">
                    <th className="py-2.5 px-3 w-10 text-center">#</th>
                    <th className="py-2.5 px-3">Customer Name</th>
                    <th className="py-2.5 px-3">Phone</th>
                    <th className="py-2.5 px-3 text-right">Outstanding Debt</th>
                    <th className="py-2.5 px-3 text-right">Credit Limit</th>
                    <th className="py-2.5 px-3 text-center">Utilization</th>
                    <th className="py-2.5 px-3 text-center">Risk Level</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {creditCustomersRows.slice(0, 10).map((c, idx) => (
                    <tr key={c.customer_id} className="hover:bg-slate-50/60 transition">
                      <td className="py-2.5 px-3 text-center font-bold text-slate-400 font-mono">{idx + 1}</td>
                      <td className="py-2.5 px-3 font-bold text-slate-900">{c.customer_name}</td>
                      <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">{c.phone}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-700">{fmt(c.current_balance)}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-500">{fmt(c.credit_limit)}</td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-700">{c.riskPct}%</td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            c.current_balance > c.credit_limit && c.credit_limit > 0
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {c.current_balance > c.credit_limit && c.credit_limit > 0 ? 'Limit Exceeded' : 'Standard'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Operating Expenses (OPEX) Summary */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <FiDollarSign className="text-rose-600" />
                  Operating Expenses &amp; Overhead Audit
                </h3>
                <p className="text-[11px] text-slate-400">Total Operational Expenditure: <strong className="text-rose-700">{fmt(totalExpenses)}</strong></p>
              </div>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-200">
                {expensesRows.length} Expenses Incurred
              </span>
            </div>
            <div className="p-4">
              {expensesRows.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-xs">
                  No operating expenses logged in this date range.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {expensesRows.slice(0, 6).map((e) => (
                    <div key={e.expense_id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                        <span>{e.expense_name || e.category || 'General Expense'}</span>
                        <span className="font-mono text-rose-700">{fmt(e.amount)}</span>
                      </div>
                      <p className="text-[10.5px] text-slate-400 mt-1">{formatDate(e.expense_date)} &bull; {e.description || 'Shop OPEX'}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          TAB 4: OPERATIONS, RETURNS & CASHIER RANK
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {activeTab === 'operations' && (
        <div className="space-y-3">
          {/* Cashier Leaderboard */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <FiUsers className="text-indigo-600" />
                  Cashier &amp; Staff Sales Performance Leaderboard
                </h3>
                <p className="text-[11px] text-slate-400">Audited volume, order count and average ticket per staff member</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] border-b border-slate-200 tracking-wider">
                    <th className="py-2.5 px-3 w-10 text-center">#</th>
                    <th className="py-2.5 px-3">Staff / Cashier</th>
                    <th className="py-2.5 px-3 text-center">Orders Handled</th>
                    <th className="py-2.5 px-3 text-right">Total Volume</th>
                    <th className="py-2.5 px-3 text-right">Cash</th>
                    <th className="py-2.5 px-3 text-right">M-Pesa</th>
                    <th className="py-2.5 px-3 text-right">Avg Ticket (AOV)</th>
                    <th className="py-2.5 px-3 text-center">Contribution</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {cashierLeaderboard.map((c, idx) => (
                    <tr key={c.name} className="hover:bg-slate-50/60 transition">
                      <td className="py-2.5 px-3 text-center font-bold text-slate-400 font-mono">{idx + 1}</td>
                      <td className="py-2.5 px-3 font-bold text-slate-900 flex items-center gap-1.5">
                        {idx === 0 && <span className="text-amber-500">🏆</span>}
                        {c.name}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-800">{c.orders}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">{fmt(c.totalSales)}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-600">{fmt(c.cash)}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-cyan-700">{fmt(c.mpesa)}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-indigo-700">{fmt(c.avgTicket)}</td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
                          {c.sharePct}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Sales Returns Restitution Audit */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 bg-rose-50/40 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-black text-rose-900 uppercase tracking-wider flex items-center gap-1.5">
                  <FiRotateCcw className="text-rose-600" />
                  Sales Returns &amp; Restitution Loss Ledger
                </h3>
                <p className="text-[11px] text-slate-400">
                  Total Refunds: <strong className="text-rose-700">{fmt(totalReturnsAmount)}</strong> ({totalReturnsQty} items restocked)
                </p>
              </div>
              <Link
                href="/dashboard/sales-return"
                className="text-[11px] font-bold text-rose-600 hover:underline flex items-center gap-1"
              >
                Go to Returns Ledger &rarr;
              </Link>
            </div>
            <div className="p-4">
              {returnsRows.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-xs">
                  Zero sales returns logged during this period.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {returnsRows.slice(0, 6).map((r) => (
                    <div key={r.return_id} className="p-3 bg-rose-50/50 border border-rose-200/80 rounded-xl">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                        <span className="truncate">{r.product_name}</span>
                        <span className="font-mono text-rose-700 shrink-0 ml-2">{fmt(r.total_amount)}</span>
                      </div>
                      <p className="text-[10.5px] text-slate-500 mt-1">
                        Qty: <strong>{r.quantity}</strong> &bull; Reason: {r.reason || 'Return'} &bull; By: {r.processed_by || 'Staff'}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          TAB 5: COMPREHENSIVE DAILY SALES DATAGRID
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {activeTab === 'ledger' && (
        <div className="space-y-3">
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
            {/* Datagrid Controls Bar */}
            <div className="p-3 border-b border-slate-100 bg-slate-50/70 flex flex-wrap items-center justify-between gap-2">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                <input
                  value={ledgerSearch}
                  onChange={(e) => {
                    setLedgerSearch(e.target.value);
                    setLedgerPage(1);
                  }}
                  placeholder="Filter daily register by date or day..."
                  className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-emerald-500 bg-white"
                />
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>Rows:</span>
                <select
                  value={ledgerPerPage}
                  onChange={(e) => {
                    setLedgerPerPage(Number(e.target.value));
                    setLedgerPage(1);
                  }}
                  className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 outline-none cursor-pointer"
                >
                  <option value={10}>10</option>
                  <option value={15}>15</option>
                  <option value={30}>30</option>
                  <option value={50}>50</option>
                </select>
                <span className="font-bold text-slate-800 font-mono">
                  {filteredDailyBreakdown.length} Days Recorded
                </span>
              </div>
            </div>

            {/* Datagrid Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-700 font-bold uppercase text-[10px] border-b border-slate-200 tracking-wider">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Trading Day</th>
                    <th className="py-2.5 px-3 text-right">Cash (Ksh)</th>
                    <th className="py-2.5 px-3 text-right">M-Pesa (Ksh)</th>
                    <th className="py-2.5 px-3 text-right">Credit (Ksh)</th>
                    <th className="py-2.5 px-3 text-right">Gross Total (Ksh)</th>
                    <th className="py-2.5 px-3 text-center">Orders</th>
                    <th className="py-2.5 px-3 text-right">Avg Ticket (AOV)</th>
                    <th className="py-2.5 px-3 text-right">Est. Profit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {paginatedDaily.map((d) => {
                    const isToday = d.date === toDay();
                    return (
                      <tr key={d.date} className={`hover:bg-slate-50/70 transition ${isToday ? 'bg-emerald-50/30' : ''}`}>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                          {formatDate(d.date)}
                          {isToday && (
                            <span className="ml-1.5 px-1.5 py-0.2 rounded-full text-[9px] font-black bg-emerald-100 text-emerald-800">
                              TODAY
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 font-semibold">{d.dayLabel}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-green-700">{fmt(d.cash)}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-cyan-700">{fmt(d.mpesa)}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-amber-700">{fmt(d.credit)}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-black text-slate-900 bg-slate-50/40">
                          {fmt(d.total)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                            {d.orders}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-700">{fmt(d.avgTicket)}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-indigo-700">{fmt(d.profit)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                {/* Grand Total Footer */}
                <tfoot className="bg-slate-100/90 border-t-2 border-slate-300 font-bold text-slate-900 text-xs">
                  <tr>
                    <td colSpan={2} className="py-3 px-3 uppercase tracking-wider font-black">
                      GRAND TOTALS ({dailyBreakdown.length} Days):
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-black text-green-800">{fmt(cashTotal)}</td>
                    <td className="py-3 px-3 text-right font-mono font-black text-cyan-800">{fmt(mpesaTotal)}</td>
                    <td className="py-3 px-3 text-right font-mono font-black text-amber-800">{fmt(creditTotal)}</td>
                    <td className="py-3 px-3 text-right font-mono font-black text-slate-900 text-sm bg-slate-200/50">
                      {fmt(grossRevenue)}
                    </td>
                    <td className="py-3 px-3 text-center font-mono font-black text-slate-900">{totalOrdersCount}</td>
                    <td className="py-3 px-3 text-right font-mono font-black text-slate-800">{fmt(aov)}</td>
                    <td className="py-3 px-3 text-right font-mono font-black text-indigo-800">{fmt(grossProfitEstimate)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="p-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 bg-white">
              <span>
                Showing page <strong className="font-bold text-slate-800">{ledgerPage}</strong> of{' '}
                <strong className="font-bold text-slate-800">{ledgerTotalPages}</strong>
              </span>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setLedgerPage(1)}
                  disabled={ledgerPage === 1}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white disabled:opacity-30 hover:bg-slate-50 cursor-pointer"
                  title="First Page"
                >
                  <FiChevronsLeft size={13} />
                </button>
                <button
                  onClick={() => setLedgerPage((p) => Math.max(1, p - 1))}
                  disabled={ledgerPage === 1}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white disabled:opacity-30 hover:bg-slate-50 cursor-pointer"
                  title="Previous Page"
                >
                  <FiChevronLeft size={13} />
                </button>
                <button
                  onClick={() => setLedgerPage((p) => Math.min(ledgerTotalPages, p + 1))}
                  disabled={ledgerPage >= ledgerTotalPages}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white disabled:opacity-30 hover:bg-slate-50 cursor-pointer"
                  title="Next Page"
                >
                  <FiChevronRight size={13} />
                </button>
                <button
                  onClick={() => setLedgerPage(ledgerTotalPages)}
                  disabled={ledgerPage >= ledgerTotalPages}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white disabled:opacity-30 hover:bg-slate-50 cursor-pointer"
                  title="Last Page"
                >
                  <FiChevronsRight size={13} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
