'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';
import { useCompanyName } from '@/context/SettingsContext';
import toast, { Toaster } from 'react-hot-toast';
import {
  FiTrendingUp,
  FiTrendingDown,
  FiDollarSign,
  FiPieChart,
  FiBarChart2,
  FiPercent,
  FiDownload,
  FiPrinter,
  FiRefreshCw,
  FiSearch,
  FiCalendar,
  FiChevronLeft,
  FiChevronRight,
  FiChevronsLeft,
  FiChevronsRight,
  FiPackage,
  FiActivity,
  FiFileText,
  FiSliders,
  FiArrowUp,
  FiArrowDown,
} from 'react-icons/fi';

import {
  ResponsiveContainer,
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
interface ExpenseRecord {
  expense_id: number;
  expense_name: string;
  category: string;
  description?: string | null;
  amount: number;
  payment_mode?: string | null;
  reference_no?: string | null;
  expense_date: string;
  created_by?: string | null;
}

interface ExpenseCategorySummary {
  name: string;
  amount: number;
  count: number;
  percentageOfOpEx: number;
  percentageOfRevenue: number;
}

interface CategoryContribution {
  category: string;
  skusSold: number;
  unitsSold: number;
  revenue: number;
  costOfSales: number;
  grossProfit: number;
  grossMargin: number;
  profitSharePct: number;
}

interface DailyFinancialPoint {
  date: string;
  dayLabel: string;
  grossSales: number;
  returns: number;
  netRevenue: number;
  cogs: number;
  grossProfit: number;
  expenses: number;
  netProfit: number;
  netMargin: number;
}

interface PriorPeriodMetrics {
  grossSales: number;
  salesReturns: number;
  netRevenue: number;
  cogs: number;
  grossProfit: number;
  expenses: number;
  netProfit: number;
  netMargin: number;
}

/* ══════════════════════════════════════════════════════════════════════════════
   FORMATTERS & HELPERS
   ══════════════════════════════════════════════════════════════════════════════ */
const fmtKES = (n: any) => {
  const num = typeof n === 'number' ? n : parseFloat(n) || 0;
  return `Ksh ${Math.round(num).toLocaleString('en-KE')}`;
};

const fmtDec = (n: any) => {
  const num = typeof n === 'number' ? n : parseFloat(n) || 0;
  return `Ksh ${num.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

const formatDate = (val: string) => {
  if (!val) return '—';
  try {
    return new Date(val).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return val;
  }
};

const PALETTE = ['#0284C7', '#10B981', '#F59E0B', '#6366F1', '#EC4899', '#8B5CF6', '#14B8A6', '#F97316', '#64748B'];

export default function ProfitLossPage() {
  const { activeOutlet, outlets, switchOutlet } = useOutlet();
  const companyName = useCompanyName();
  const outletId = activeOutlet?.outlet_id || 1;

  // View & Tab States
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'statement' | 'visuals' | 'expenses' | 'categories' | 'comparative'>('statement');

  // Date Range States
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [preset, setPreset] = useState('month');

  // Core Financial Figures
  const [grossSales, setGrossSales] = useState(0);
  const [salesReturns, setSalesReturns] = useState(0);
  const [totalCOGS, setTotalCOGS] = useState(0);
  const [purchases, setPurchases] = useState(0);
  const [openingStock, setOpeningStock] = useState(0);
  const [closingStock, setClosingStock] = useState(0);
  const [rawExpenses, setRawExpenses] = useState<ExpenseRecord[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategorySummary[]>([]);
  const [totalExpenses, setTotalExpenses] = useState(0);

  // Sub-metrics
  const [dailyTimeline, setDailyTimeline] = useState<DailyFinancialPoint[]>([]);
  const [categoryContributions, setCategoryContributions] = useState<CategoryContribution[]>([]);
  const [priorMetrics, setPriorMetrics] = useState<PriorPeriodMetrics>({
    grossSales: 0,
    salesReturns: 0,
    netRevenue: 0,
    cogs: 0,
    grossProfit: 0,
    expenses: 0,
    netProfit: 0,
    netMargin: 0,
  });

  // Table Filters & Pagination
  const [expSearch, setExpSearch] = useState('');
  const [expCategoryFilter, setExpCategoryFilter] = useState('ALL');
  const [expPage, setExpPage] = useState(1);
  const [expPerPage, setExpPerPage] = useState(20);

  const [catSearch, setCatSearch] = useState('');
  const [catPage, setCatPage] = useState(1);
  const [catPerPage, setCatPerPage] = useState(10);

  // Computed Financial Milestones
  const netRevenue = grossSales - salesReturns;
  const grossProfit = netRevenue - totalCOGS;
  const netProfit = grossProfit - totalExpenses;
  const grossMargin = netRevenue > 0 ? (grossProfit / netRevenue) * 100 : 0;
  const netMargin = netRevenue > 0 ? (netProfit / netRevenue) * 100 : 0;
  const opexRatio = netRevenue > 0 ? (totalExpenses / netRevenue) * 100 : 0;
  const ebitda = grossProfit - totalExpenses;
  const returnRate = grossSales > 0 ? (salesReturns / grossSales) * 100 : 0;

  /* ─────────────────────────────────────────────────────────────────────────
     DATE PRESET SELECTOR
     ───────────────────────────────────────────────────────────────────────── */
  const setDatePreset = (p: string) => {
    setPreset(p);
    const now = new Date();
    const to = now.toISOString().split('T')[0];
    let from = to;

    if (p === 'today') {
      from = to;
    } else if (p === 'yesterday') {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      from = d.toISOString().split('T')[0];
      setDateFrom(from);
      setDateTo(from);
      return;
    } else if (p === '7d') {
      const d = new Date();
      d.setDate(d.getDate() - 6);
      from = d.toISOString().split('T')[0];
    } else if (p === '30d') {
      const d = new Date();
      d.setDate(d.getDate() - 29);
      from = d.toISOString().split('T')[0];
    } else if (p === 'month') {
      from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    } else if (p === 'last_month') {
      const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
      from = d.toISOString().split('T')[0];
      setDateFrom(from);
      setDateTo(lastDay.toISOString().split('T')[0]);
      return;
    } else if (p === 'quarter') {
      const qm = Math.floor(now.getMonth() / 3) * 3;
      from = `${now.getFullYear()}-${String(qm + 1).padStart(2, '0')}-01`;
    } else if (p === 'year') {
      from = `${now.getFullYear()}-01-01`;
    } else if (p === 'all') {
      from = '2023-01-01';
    }

    setDateFrom(from);
    setDateTo(to);
  };

  /* ─────────────────────────────────────────────────────────────────────────
     LOAD COMPLETE P&L DATA SUITE
     ───────────────────────────────────────────────────────────────────────── */
  const loadData = useCallback(async () => {
    if (!activeOutlet) return;
    setLoading(true);

    try {
      // 1. Gross Sales
      const { data: salesData, error: salesErr } = await supabase
        .from('retail_sales')
        .select('sale_id, sale_date, total_amount')
        .eq('outlet_id', outletId)
        .gte('sale_date', dateFrom)
        .lte('sale_date', dateTo);

      if (salesErr) console.warn('Sales error:', salesErr);
      const grossSalesTotal = (salesData || []).reduce((acc, r) => acc + (Number(r.total_amount) || 0), 0);
      setGrossSales(grossSalesTotal);

      // 2. Sales Returns
      const { data: returnsData, error: returnsErr } = await supabase
        .from('sales_returns')
        .select('return_id, return_date, total_amount, quantity, product_name')
        .gte('return_date', dateFrom)
        .lte('return_date', dateTo);

      if (returnsErr) console.warn('Returns error:', returnsErr);
      const returnsTotal = (returnsData || []).reduce((acc, r) => acc + (Number(r.total_amount) || 0), 0);
      setSalesReturns(returnsTotal);

      // 3. Sold Items for COGS & Category Profit Matrix
      const { data: salesItems, error: itemsErr } = await supabase
        .from('retail_sales_items')
        .select('item_id, sale_id, product_id, quantity, unit_price, cost_price, created_at')
        .gte('created_at', `${dateFrom}T00:00:00`)
        .lte('created_at', `${dateTo}T23:59:59`);

      if (itemsErr) console.warn('Items error:', itemsErr);

      // 4. Products for Cost Map & Category Mapping
      const { data: products, error: prodErr } = await supabase
        .from('retail_products')
        .select('pid, name, category, purchase_cost, selling_price')
        .eq('outlet_id', outletId);

      if (prodErr) console.warn('Products error:', prodErr);

      const prodMap = new Map<number, { name: string; category: string; cost: number; price: number }>();
      (products || []).forEach((p) => {
        prodMap.set(p.pid, {
          name: p.name || 'Unknown Item',
          category: p.category || 'General Merchandise',
          cost: Number(p.purchase_cost) || 0,
          price: Number(p.selling_price) || 0,
        });
      });

      let computedCOGS = 0;
      const catMap = new Map<string, { skus: Set<number>; units: number; rev: number; cost: number }>();

      (salesItems || []).forEach((item) => {
        const pInfo = prodMap.get(item.product_id);
        const itemCost = Number(item.cost_price) > 0 ? Number(item.cost_price) : pInfo?.cost || 0;
        const qty = Number(item.quantity) || 0;
        const rev = Number(item.unit_price || 0) * qty;
        const totalItemCost = itemCost * qty;

        computedCOGS += totalItemCost;

        const catName = pInfo?.category || 'General Merchandise';
        if (!catMap.has(catName)) {
          catMap.set(catName, { skus: new Set(), units: 0, rev: 0, cost: 0 });
        }
        const cEntry = catMap.get(catName)!;
        cEntry.skus.add(item.product_id);
        cEntry.units += qty;
        cEntry.rev += rev;
        cEntry.cost += totalItemCost;
      });

      setTotalCOGS(computedCOGS);

      // 5. Purchases in Period
      const { data: purchaseData, error: purchErr } = await supabase
        .from('retail_purchases')
        .select('purchase_id, grand_total, purchase_date')
        .eq('outlet_id', outletId)
        .gte('purchase_date', dateFrom)
        .lte('purchase_date', dateTo);

      if (purchErr) console.warn('Purchases error:', purchErr);
      const purchTotal = (purchaseData || []).reduce((acc, r) => acc + (Number(r.grand_total) || 0), 0);
      setPurchases(purchTotal);

      // 6. Stock on Hand (Closing Stock)
      const { data: stockData, error: stockErr } = await supabase
        .from('retail_stock')
        .select('pid, qty')
        .eq('outlet_id', outletId);

      if (stockErr) console.warn('Stock error:', stockErr);
      let currentStockVal = 0;
      (stockData || []).forEach((s) => {
        const cost = prodMap.get(s.pid)?.cost || 0;
        currentStockVal += (Number(s.qty) || 0) * cost;
      });
      setClosingStock(currentStockVal);

      // Opening Stock = Closing Stock + COGS - Purchases
      const approxOpeningStock = Math.max(0, currentStockVal + computedCOGS - purchTotal);
      setOpeningStock(approxOpeningStock);

      // 7. Operating Expenses
      const { data: expData, error: expErr } = await supabase
        .from('expenses')
        .select('*')
        .gte('expense_date', dateFrom)
        .lte('expense_date', dateTo)
        .order('expense_date', { ascending: false });

      if (expErr) console.warn('Expenses error:', expErr);

      const parsedExpenses: ExpenseRecord[] = (expData || []).map((e) => ({
        expense_id: e.expense_id,
        expense_name: e.expense_name || e.category || 'Expense Line',
        category: e.category || 'General & Administrative',
        description: e.description,
        amount: Number(e.amount) || 0,
        payment_mode: e.payment_mode || 'Cash',
        reference_no: e.reference_no,
        expense_date: e.expense_date,
        created_by: e.created_by,
      }));
      setRawExpenses(parsedExpenses);

      const totalExpSum = parsedExpenses.reduce((sum, e) => sum + e.amount, 0);
      setTotalExpenses(totalExpSum);

      // Expense Categories
      const expCatMap = new Map<string, { amount: number; count: number }>();
      parsedExpenses.forEach((e) => {
        const cat = e.category || 'General';
        const cur = expCatMap.get(cat) || { amount: 0, count: 0 };
        cur.amount += e.amount;
        cur.count += 1;
        expCatMap.set(cat, cur);
      });

      const effectiveNetRev = grossSalesTotal - returnsTotal;
      const catSummaries: ExpenseCategorySummary[] = Array.from(expCatMap.entries())
        .map(([name, stat]) => ({
          name,
          amount: stat.amount,
          count: stat.count,
          percentageOfOpEx: totalExpSum > 0 ? (stat.amount / totalExpSum) * 100 : 0,
          percentageOfRevenue: effectiveNetRev > 0 ? (stat.amount / effectiveNetRev) * 100 : 0,
        }))
        .sort((a, b) => b.amount - a.amount);

      setExpenseCategories(catSummaries);

      // Category Contributions
      const totalPeriodGP = effectiveNetRev - computedCOGS;
      const catContribList: CategoryContribution[] = Array.from(catMap.entries())
        .map(([category, val]) => {
          const gp = val.rev - val.cost;
          const gm = val.rev > 0 ? (gp / val.rev) * 100 : 0;
          const share = totalPeriodGP > 0 ? Math.max(0, (gp / totalPeriodGP) * 100) : 0;
          return {
            category,
            skusSold: val.skus.size,
            unitsSold: Math.round(val.units * 100) / 100,
            revenue: val.rev,
            costOfSales: val.cost,
            grossProfit: gp,
            grossMargin: gm,
            profitSharePct: share,
          };
        })
        .sort((a, b) => b.revenue - a.revenue);

      setCategoryContributions(catContribList);

      // 8. Daily Timeline
      const dailyMap = new Map<string, { sales: number; returns: number; cogs: number; exp: number }>();
      (salesData || []).forEach((s) => {
        const d = s.sale_date?.slice(0, 10);
        if (!d) return;
        if (!dailyMap.has(d)) dailyMap.set(d, { sales: 0, returns: 0, cogs: 0, exp: 0 });
        dailyMap.get(d)!.sales += Number(s.total_amount) || 0;
      });

      (returnsData || []).forEach((r) => {
        const d = r.return_date?.slice(0, 10);
        if (!d) return;
        if (!dailyMap.has(d)) dailyMap.set(d, { sales: 0, returns: 0, cogs: 0, exp: 0 });
        dailyMap.get(d)!.returns += Number(r.total_amount) || 0;
      });

      (salesItems || []).forEach((item) => {
        const d = item.created_at?.slice(0, 10);
        if (!d) return;
        if (!dailyMap.has(d)) dailyMap.set(d, { sales: 0, returns: 0, cogs: 0, exp: 0 });
        const pInfo = prodMap.get(item.product_id);
        const itemCost = Number(item.cost_price) > 0 ? Number(item.cost_price) : pInfo?.cost || 0;
        dailyMap.get(d)!.cogs += itemCost * (Number(item.quantity) || 0);
      });

      parsedExpenses.forEach((e) => {
        const d = e.expense_date?.slice(0, 10);
        if (!d) return;
        if (!dailyMap.has(d)) dailyMap.set(d, { sales: 0, returns: 0, cogs: 0, exp: 0 });
        dailyMap.get(d)!.exp += e.amount;
      });

      const timeline: DailyFinancialPoint[] = Array.from(dailyMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, val]) => {
          const net = val.sales - val.returns;
          const gp = net - val.cogs;
          const np = gp - val.exp;
          const nm = net > 0 ? (np / net) * 100 : 0;
          return {
            date,
            dayLabel: new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
            grossSales: val.sales,
            returns: val.returns,
            netRevenue: net,
            cogs: val.cogs,
            grossProfit: gp,
            expenses: val.exp,
            netProfit: np,
            netMargin: nm,
          };
        });

      setDailyTimeline(timeline);

      // 9. Prior Period Comparison
      const startT = new Date(dateFrom).getTime();
      const endT = new Date(dateTo).getTime();
      const diffDays = Math.max(1, Math.round((endT - startT) / (1000 * 60 * 60 * 24)) + 1);

      const priorEndDate = new Date(startT - 1000 * 60 * 60 * 24);
      const priorStartDate = new Date(priorEndDate.getTime() - (diffDays - 1) * 1000 * 60 * 60 * 24);

      const pFromStr = priorStartDate.toISOString().split('T')[0];
      const pToStr = priorEndDate.toISOString().split('T')[0];

      const [{ data: pSales }, { data: pReturns }, { data: pExp }] = await Promise.all([
        supabase
          .from('retail_sales')
          .select('total_amount')
          .eq('outlet_id', outletId)
          .gte('sale_date', pFromStr)
          .lte('sale_date', pToStr),
        supabase
          .from('sales_returns')
          .select('total_amount')
          .gte('return_date', pFromStr)
          .lte('return_date', pToStr),
        supabase
          .from('expenses')
          .select('amount')
          .gte('expense_date', pFromStr)
          .lte('expense_date', pToStr),
      ]);

      const priorGross = (pSales || []).reduce((acc, r) => acc + (Number(r.total_amount) || 0), 0);
      const priorRet = (pReturns || []).reduce((acc, r) => acc + (Number(r.total_amount) || 0), 0);
      const priorNet = priorGross - priorRet;
      const priorOpEx = (pExp || []).reduce((acc, r) => acc + (Number(r.amount) || 0), 0);
      const cogsRatio = grossSalesTotal > 0 ? computedCOGS / grossSalesTotal : 0.68;
      const priorCOGS = priorNet * cogsRatio;
      const priorGP = priorNet - priorCOGS;
      const priorNP = priorGP - priorOpEx;
      const priorNM = priorNet > 0 ? (priorNP / priorNet) * 100 : 0;

      setPriorMetrics({
        grossSales: priorGross,
        salesReturns: priorRet,
        netRevenue: priorNet,
        cogs: priorCOGS,
        grossProfit: priorGP,
        expenses: priorOpEx,
        netProfit: priorNP,
        netMargin: priorNM,
      });
    } catch (err: any) {
      console.error('Error loading P&L data:', err);
      toast.error('Failed to compute P&L telemetry: ' + (err.message || ''));
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, outletId, activeOutlet]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /* ─────────────────────────────────────────────────────────────────────────
     FILTERED DATA & PAGINATION (EXPENSES & CATEGORIES)
     ───────────────────────────────────────────────────────────────────────── */
  const filteredExpenses = useMemo(() => {
    return rawExpenses.filter((e) => {
      const matchSearch =
        !expSearch.trim() ||
        e.expense_name.toLowerCase().includes(expSearch.toLowerCase()) ||
        (e.description && e.description.toLowerCase().includes(expSearch.toLowerCase())) ||
        (e.reference_no && e.reference_no.toLowerCase().includes(expSearch.toLowerCase())) ||
        (e.created_by && e.created_by.toLowerCase().includes(expSearch.toLowerCase()));
      const matchCat = expCategoryFilter === 'ALL' || e.category === expCategoryFilter;
      return matchSearch && matchCat;
    });
  }, [rawExpenses, expSearch, expCategoryFilter]);

  const totalExpPages = Math.max(1, Math.ceil(filteredExpenses.length / expPerPage));
  const paginatedExpenses = useMemo(() => {
    const start = (expPage - 1) * expPerPage;
    return filteredExpenses.slice(start, start + expPerPage);
  }, [filteredExpenses, expPage, expPerPage]);

  const filteredCategories = useMemo(() => {
    return categoryContributions.filter((c) => {
      return !catSearch.trim() || c.category.toLowerCase().includes(catSearch.toLowerCase());
    });
  }, [categoryContributions, catSearch]);

  const totalCatPages = Math.max(1, Math.ceil(filteredCategories.length / catPerPage));
  const paginatedCategories = useMemo(() => {
    const start = (catPage - 1) * catPerPage;
    return filteredCategories.slice(start, start + catPerPage);
  }, [filteredCategories, catPage, catPerPage]);

  /* ─────────────────────────────────────────────────────────────────────────
     WATERFALL DATA
     ───────────────────────────────────────────────────────────────────────── */
  const waterfallData = useMemo(() => {
    return [
      { name: 'Gross Sales', amount: grossSales, fill: '#0284C7' },
      { name: 'Returns', amount: -salesReturns, fill: '#EF4444' },
      { name: 'Net Revenue', amount: netRevenue, fill: '#3B82F6' },
      { name: 'COGS', amount: -totalCOGS, fill: '#F97316' },
      { name: 'Gross Profit', amount: grossProfit, fill: '#10B981' },
      { name: 'OpEx', amount: -totalExpenses, fill: '#DC2626' },
      { name: 'Net Profit', amount: netProfit, fill: netProfit >= 0 ? '#059669' : '#B91C1C' },
    ];
  }, [grossSales, salesReturns, netRevenue, totalCOGS, grossProfit, totalExpenses, netProfit]);

  /* ─────────────────────────────────────────────────────────────────────────
     MULTI-SHEET EXCEL EXPORT (.XLSX)
     ───────────────────────────────────────────────────────────────────────── */
  const exportExcel = async () => {
    try {
      const XLSX = (await import('xlsx-js-style')).default || (await import('xlsx-js-style'));
      const wb = XLSX.utils.book_new();

      const titleHeader = `${(companyName || 'ALPHA RETAIL').toUpperCase()} — ${(activeOutlet?.outlet_name || 'MAIN OUTLET').toUpperCase()}`;
      const periodHeader = `STATEMENT OF PROFIT & LOSS • PERIOD: ${dateFrom} TO ${dateTo}`;

      // Sheet 1: P&L Statement
      const s1Data: any[][] = [];
      s1Data.push([titleHeader]);
      s1Data.push([periodHeader]);
      s1Data.push([`Generated on: ${new Date().toLocaleString('en-GB')}`]);
      s1Data.push([]);
      s1Data.push(['FINANCIAL STATEMENT LINE ITEM', 'AMOUNT (KSH)', '% OF NET REVENUE', 'ACCOUNT NOTES']);

      s1Data.push(['INCOME / REVENUE', '', '', 'Top-line sales performance']);
      s1Data.push(['  Gross Merchandise Sales', grossSales, netRevenue > 0 ? (grossSales / netRevenue) * 100 : 0, 'Total customer billings']);
      s1Data.push(['  Less: Sales Returns', -salesReturns, netRevenue > 0 ? (-salesReturns / netRevenue) * 100 : 0, `${returnRate.toFixed(1)}% return frequency`]);
      s1Data.push(['NET REVENUE', netRevenue, 100.0, 'Baseline turnover']);
      s1Data.push([]);

      s1Data.push(['COST OF GOODS SOLD (COGS)', '', '', 'Direct inventory costs']);
      s1Data.push(['  Opening Stock Valuation', openingStock, netRevenue > 0 ? (openingStock / netRevenue) * 100 : 0, 'Beginning inventory']);
      s1Data.push(['  Add: Purchases in Period', purchases, netRevenue > 0 ? (purchases / netRevenue) * 100 : 0, 'Purchases and restocking']);
      s1Data.push(['  Less: Closing Stock Valuation', -closingStock, netRevenue > 0 ? (-closingStock / netRevenue) * 100 : 0, 'Ending stock on hand']);
      s1Data.push(['TOTAL COST OF GOODS SOLD', totalCOGS, netRevenue > 0 ? (totalCOGS / netRevenue) * 100 : 0, 'Cost of items sold']);
      s1Data.push([]);

      s1Data.push(['GROSS PROFIT', grossProfit, grossMargin, `Gross Margin: ${grossMargin.toFixed(1)}%`]);
      s1Data.push([]);

      s1Data.push(['OPERATING EXPENSES (OPEX)', '', '', 'Operational costs']);
      expenseCategories.forEach((cat) => {
        s1Data.push([`  ${cat.name}`, cat.amount, cat.percentageOfRevenue, `${cat.percentageOfOpEx.toFixed(1)}% of OpEx`]);
      });
      s1Data.push(['TOTAL OPERATING EXPENSES', totalExpenses, opexRatio, `OpEx Ratio: ${opexRatio.toFixed(1)}%`]);
      s1Data.push([]);

      s1Data.push([`NET ${netProfit >= 0 ? 'PROFIT' : 'LOSS'}`, netProfit, netMargin, `Net Margin: ${netMargin.toFixed(1)}%`]);

      const ws1 = XLSX.utils.aoa_to_sheet(s1Data);
      ws1['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } },
        { s: { r: 2, c: 0 }, e: { r: 2, c: 3 } },
      ];
      ws1['!cols'] = [{ wch: 38 }, { wch: 18 }, { wch: 18 }, { wch: 32 }];
      XLSX.utils.book_append_sheet(wb, ws1, 'P&L Statement');

      // Sheet 2: Daily Timeline
      const s2Data: any[][] = [];
      s2Data.push([titleHeader]);
      s2Data.push(['DAILY P&L VELOCITY TIMELINE']);
      s2Data.push([]);
      s2Data.push(['DATE', 'GROSS SALES', 'RETURNS', 'NET REVENUE', 'COGS', 'GROSS PROFIT', 'OPEX', 'NET PROFIT', 'MARGIN %']);
      dailyTimeline.forEach((d) => {
        s2Data.push([d.date, d.grossSales, d.returns, d.netRevenue, d.cogs, d.grossProfit, d.expenses, d.netProfit, `${d.netMargin.toFixed(1)}%`]);
      });
      const ws2 = XLSX.utils.aoa_to_sheet(s2Data);
      ws2['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 8 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 8 } },
      ];
      ws2['!cols'] = [{ wch: 14 }, { wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 12 }];
      XLSX.utils.book_append_sheet(wb, ws2, 'Daily Velocity');

      // Sheet 3: Expenses Ledger
      const s3Data: any[][] = [];
      s3Data.push([titleHeader]);
      s3Data.push(['OPERATING EXPENSES AUDIT LEDGER']);
      s3Data.push([]);
      s3Data.push(['DATE', 'EXPENSE NAME', 'CATEGORY', 'DESCRIPTION', 'PAYMENT MODE', 'REF NO', 'RECORDED BY', 'AMOUNT (KSH)']);
      rawExpenses.forEach((e) => {
        s3Data.push([e.expense_date, e.expense_name, e.category, e.description || '—', e.payment_mode || 'Cash', e.reference_no || '—', e.created_by || 'Admin', e.amount]);
      });
      const ws3 = XLSX.utils.aoa_to_sheet(s3Data);
      ws3['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 7 } },
      ];
      ws3['!cols'] = [{ wch: 14 }, { wch: 26 }, { wch: 22 }, { wch: 32 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }];
      XLSX.utils.book_append_sheet(wb, ws3, 'Expenses Ledger');

      // Sheet 4: Category Margin Contribution
      const s4Data: any[][] = [];
      s4Data.push([titleHeader]);
      s4Data.push(['CATEGORY MARGIN CONTRIBUTION & PROFITABILITY']);
      s4Data.push([]);
      s4Data.push(['CATEGORY', 'SKUS SOLD', 'UNITS SOLD', 'REVENUE (KSH)', 'COGS (KSH)', 'GROSS PROFIT (KSH)', 'GROSS MARGIN %', 'PROFIT SHARE %']);
      categoryContributions.forEach((c) => {
        s4Data.push([c.category, c.skusSold, c.unitsSold, c.revenue, c.costOfSales, c.grossProfit, `${c.grossMargin.toFixed(1)}%`, `${c.profitSharePct.toFixed(1)}%`]);
      });
      const ws4 = XLSX.utils.aoa_to_sheet(s4Data);
      ws4['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 7 } },
      ];
      ws4['!cols'] = [{ wch: 26 }, { wch: 12 }, { wch: 14 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 16 }, { wch: 16 }];
      XLSX.utils.book_append_sheet(wb, ws4, 'Category Profit');

      XLSX.writeFile(wb, `Profit_Loss_Statement_${dateFrom}_to_${dateTo}.xlsx`);
      toast.success('Ultra-premium multi-sheet financial Excel exported! ✓');
    } catch (err: any) {
      console.error('Excel export error:', err);
      toast.error('Failed to export Excel: ' + (err.message || ''));
    }
  };

  /* ─────────────────────────────────────────────────────────────────────────
     FORMAL FISCAL PRINT / PDF GENERATOR
     ───────────────────────────────────────────────────────────────────────── */
  const printReport = () => {
    const outletName = activeOutlet?.outlet_name || 'Alpha Retail';
    const cName = companyName || 'Alpha Retail Ltd';

    const expRows = expenseCategories
      .map(
        (c) =>
          `<tr>
            <td style="padding-left: 28px; padding-top: 4px; padding-bottom: 4px; color: #475569;">${c.name}</td>
            <td style="text-align: right; font-family: monospace; font-size: 11px;">Ksh ${c.amount.toLocaleString()}</td>
            <td style="text-align: right; color: #64748B; font-size: 10px;">${c.percentageOfRevenue.toFixed(1)}%</td>
          </tr>`
      )
      .join('');

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Profit & Loss Statement - ${outletName}</title>
  <style>
    @page { margin: 12mm 14mm; size: A4; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #0F172A; background: #FFF; line-height: 1.4; }
    .header { text-align: center; border-bottom: 2px solid #0F172A; padding-bottom: 12px; margin-bottom: 16px; }
    .header h1 { font-size: 18px; margin: 0; text-transform: uppercase; letter-spacing: 1.5px; }
    .header h2 { font-size: 13px; margin: 4px 0; color: #334155; font-weight: 600; }
    .header p { font-size: 10px; color: #64748B; margin: 2px 0; }
    .kpi-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 10.5px; }
    .kpi-table td { padding: 8px 12px; border: 1px solid #E2E8F0; text-align: center; background: #F8FAFC; }
    .kpi-table .val { font-size: 14px; font-weight: 800; font-family: monospace; display: block; margin-top: 2px; }
    .stmt-table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    .stmt-table th { background: #F1F5F9; border-bottom: 2px solid #CBD5E1; text-align: left; padding: 6px 10px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
    .stmt-table td { padding: 5px 10px; }
    .sec-header { background: #F8FAFC; font-weight: 800; font-size: 11px; color: #1E293B; border-top: 1px solid #E2E8F0; border-bottom: 1px solid #E2E8F0; }
    .subtotal-row { border-top: 1px solid #0F172A; font-weight: 700; font-size: 11.5px; }
    .major-row { border-top: 2px solid #0F172A; border-bottom: 1px solid #0F172A; font-weight: 800; font-size: 12px; }
    .net-profit-row { border-top: 2px solid #0F172A; border-bottom: 3px double #0F172A; font-weight: 900; font-size: 13px; background: #F8FAFC; }
    .pos { color: #059669; }
    .neg { color: #DC2626; }
    .sign-block { margin-top: 40px; display: flex; justify-content: space-between; page-break-inside: avoid; }
    .sign-box { width: 30%; border-top: 1px solid #94A3B8; text-align: center; padding-top: 6px; font-size: 10px; color: #475569; }
    .footer { margin-top: 20px; font-size: 9px; color: #94A3B8; text-align: center; border-top: 1px dashed #CBD5E1; padding-top: 8px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${cName}</h1>
    <h2>STATEMENT OF COMPREHENSIVE PROFIT & LOSS</h2>
    <p><strong>Operating Outlet:</strong> ${outletName} &nbsp;|&nbsp; <strong>Reporting Period:</strong> ${formatDate(dateFrom)} to ${formatDate(dateTo)}</p>
    <p>Prepared in compliance with General Financial Reporting Standards &bull; Currency: Kenyan Shillings (Ksh)</p>
  </div>

  <table class="kpi-table">
    <tr>
      <td>NET REVENUE<span class="val">Ksh ${netRevenue.toLocaleString()}</span></td>
      <td>COST OF GOODS SOLD<span class="val">Ksh ${totalCOGS.toLocaleString()}</span></td>
      <td>GROSS PROFIT (${grossMargin.toFixed(1)}%)<span class="val ${grossProfit >= 0 ? 'pos' : 'neg'}">Ksh ${grossProfit.toLocaleString()}</span></td>
      <td>OPERATING EXPENSES<span class="val">Ksh ${totalExpenses.toLocaleString()}</span></td>
      <td>NET ${netProfit >= 0 ? 'PROFIT' : 'LOSS'} (${netMargin.toFixed(1)}%)<span class="val ${netProfit >= 0 ? 'pos' : 'neg'}">Ksh ${Math.abs(netProfit).toLocaleString()}</span></td>
    </tr>
  </table>

  <table class="stmt-table">
    <thead>
      <tr>
        <th style="width: 58%;">Financial Accounts & Line Items</th>
        <th style="text-align: right; width: 24%;">Amount (Ksh)</th>
        <th style="text-align: right; width: 18%;">% Net Revenue</th>
      </tr>
    </thead>
    <tbody>
      <tr class="sec-header">
        <td colspan="3">1. OPERATING REVENUE & MERCHANDISE TURNOVER</td>
      </tr>
      <tr>
        <td style="padding-left: 20px;">Gross Merchandise Sales</td>
        <td style="text-align: right; font-family: monospace;">Ksh ${grossSales.toLocaleString()}</td>
        <td style="text-align: right; color: #64748B;">${netRevenue > 0 ? ((grossSales / netRevenue) * 100).toFixed(1) : '100.0'}%</td>
      </tr>
      <tr>
        <td style="padding-left: 20px; color: #DC2626;">Less: Sales Returns & Refunds</td>
        <td style="text-align: right; font-family: monospace; color: #DC2626;">(Ksh ${salesReturns.toLocaleString()})</td>
        <td style="text-align: right; color: #DC2626;">-${returnRate.toFixed(1)}%</td>
      </tr>
      <tr class="subtotal-row">
        <td>NET REVENUE</td>
        <td style="text-align: right; font-family: monospace;">Ksh ${netRevenue.toLocaleString()}</td>
        <td style="text-align: right;">100.0%</td>
      </tr>

      <tr class="sec-header">
        <td colspan="3" style="padding-top: 10px;">2. COST OF GOODS SOLD (DIRECT INVENTORY ACQUISITION)</td>
      </tr>
      <tr>
        <td style="padding-left: 20px;">Opening Stock Value</td>
        <td style="text-align: right; font-family: monospace;">Ksh ${openingStock.toLocaleString()}</td>
        <td style="text-align: right; color: #64748B;">${netRevenue > 0 ? ((openingStock / netRevenue) * 100).toFixed(1) : '—'}%</td>
      </tr>
      <tr>
        <td style="padding-left: 20px;">Add: Total Purchases in Period</td>
        <td style="text-align: right; font-family: monospace;">Ksh ${purchases.toLocaleString()}</td>
        <td style="text-align: right; color: #64748B;">${netRevenue > 0 ? ((purchases / netRevenue) * 100).toFixed(1) : '—'}%</td>
      </tr>
      <tr>
        <td style="padding-left: 20px; color: #475569;">Less: Closing Stock Value (On-hand)</td>
        <td style="text-align: right; font-family: monospace; color: #475569;">(Ksh ${closingStock.toLocaleString()})</td>
        <td style="text-align: right; color: #64748B;">-${netRevenue > 0 ? ((closingStock / netRevenue) * 100).toFixed(1) : '—'}%</td>
      </tr>
      <tr class="subtotal-row">
        <td>TOTAL COST OF GOODS SOLD (COGS)</td>
        <td style="text-align: right; font-family: monospace;">Ksh ${totalCOGS.toLocaleString()}</td>
        <td style="text-align: right;">${netRevenue > 0 ? ((totalCOGS / netRevenue) * 100).toFixed(1) : '0.0'}%</td>
      </tr>

      <tr class="major-row">
        <td>GROSS PROFIT</td>
        <td style="text-align: right; font-family: monospace;" class="${grossProfit >= 0 ? 'pos' : 'neg'}">Ksh ${grossProfit.toLocaleString()}</td>
        <td style="text-align: right; font-weight: 800;" class="${grossProfit >= 0 ? 'pos' : 'neg'}">${grossMargin.toFixed(1)}%</td>
      </tr>

      <tr class="sec-header">
        <td colspan="3" style="padding-top: 10px;">3. OPERATING OVERHEAD & ADMINISTRATIVE EXPENSES</td>
      </tr>
      ${expRows || '<tr><td colspan="3" style="padding-left: 28px; color: #94A3B8;">No expenses recorded in this period</td></tr>'}
      <tr class="subtotal-row">
        <td>TOTAL OPERATING EXPENSES (OPEX)</td>
        <td style="text-align: right; font-family: monospace;">Ksh ${totalExpenses.toLocaleString()}</td>
        <td style="text-align: right;">${opexRatio.toFixed(1)}%</td>
      </tr>

      <tr class="net-profit-row">
        <td>NET ${netProfit >= 0 ? 'OPERATING PROFIT' : 'DEFICIT (LOSS)'}</td>
        <td style="text-align: right; font-family: monospace;" class="${netProfit >= 0 ? 'pos' : 'neg'}">Ksh ${Math.abs(netProfit).toLocaleString()}</td>
        <td style="text-align: right; font-weight: 900;" class="${netProfit >= 0 ? 'pos' : 'neg'}">${netMargin.toFixed(1)}%</td>
      </tr>
    </tbody>
  </table>

  <div class="sign-block">
    <div class="sign-box">Prepared By (Finance Auditor)</div>
    <div class="sign-box">Reviewed By (Chief Accountant)</div>
    <div class="sign-box">Approved By (Managing Director)</div>
  </div>

  <div class="footer">
    Official Audit Document &bull; Generated: ${new Date().toLocaleString('en-GB')} &bull; Alpha Retail Enterprise POS System
  </div>
</body>
</html>`;

    const printWin = window.open('', '_blank');
    if (printWin) {
      printWin.document.write(html);
      printWin.document.close();
      printWin.focus();
      setTimeout(() => printWin.print(), 350);
    }
  };

  /* ─────────────────────────────────────────────────────────────────────────
     REUSABLE BEAUTIFUL STATEMENT STAT ROW
     ───────────────────────────────────────────────────────────────────────── */
  const StatRow = ({
    label,
    value,
    indent,
    bold,
    line,
    dline,
    negative,
    pct,
    subNote,
  }: {
    label: string;
    value: number;
    indent?: boolean;
    bold?: boolean;
    line?: boolean;
    dline?: boolean;
    negative?: boolean;
    pct?: string;
    subNote?: string;
  }) => (
    <>
      {line && <div className="border-t border-slate-200 my-1.5" />}
      {dline && <div className="border-t-4 border-double border-slate-800 my-2.5" />}
      <div
        className={`flex items-center justify-between py-1.5 ${indent ? 'pl-6' : ''} ${
          bold ? 'font-bold text-slate-900' : 'text-slate-600'
        }`}
      >
        <div className="flex-1 pr-3">
          <span className="text-sm">{label}</span>
          {subNote && <span className="block text-[10px] text-slate-400 font-normal">{subNote}</span>}
        </div>
        <div className="flex items-center gap-6">
          <span className={`text-sm font-mono ${negative ? 'text-rose-600 font-bold' : bold ? 'font-black' : 'font-semibold'}`}>
            {negative ? `(Ksh ${Math.abs(value).toLocaleString()})` : `Ksh ${value.toLocaleString()}`}
          </span>
          {pct && (
            <span
              className={`w-14 text-right font-mono text-[11px] ${
                negative ? 'text-rose-600' : bold ? 'text-slate-700 font-bold' : 'text-slate-400'
              }`}
            >
              {pct}%
            </span>
          )}
        </div>
      </div>
    </>
  );

  return (
    <div className="space-y-5 pb-14 text-slate-800">
      <Toaster position="top-right" />

      {/* ══════════════════════════════════════════════════════════════════
          1. HEADER & EXECUTIVE ACTIONS
          ══════════════════════════════════════════════════════════════════ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-black text-slate-900 flex items-center gap-3">
          <span className="w-12 h-12 bg-gradient-to-br from-rose-500 to-rose-600 rounded-2xl flex items-center justify-center text-white text-2xl shadow-lg shadow-rose-500/20">
            📉
          </span>
          Profit &amp; Loss Statement
        </h1>

        <div className="flex flex-wrap items-center gap-2">
          {outlets && outlets.length > 1 && (
            <select
              value={outletId}
              onChange={(e) => switchOutlet(Number(e.target.value))}
              className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-700 shadow-2xs focus:ring-2 focus:ring-rose-500 cursor-pointer"
            >
              {outlets.map((o) => (
                <option key={o.outlet_id} value={o.outlet_id}>
                  {o.outlet_name}
                </option>
              ))}
            </select>
          )}

          <button
            onClick={printReport}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 text-xs shadow-sm transition flex items-center gap-1.5 cursor-pointer"
          >
            <FiPrinter size={14} />
            <span>🖨️ Print Report</span>
          </button>

          <button
            onClick={exportExcel}
            className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 text-xs shadow-sm transition flex items-center gap-1.5 cursor-pointer"
          >
            <FiDownload size={14} />
            <span>📊 Ultra Excel</span>
          </button>

          <button
            onClick={loadData}
            disabled={loading}
            className="p-2.5 bg-white border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-50 text-xs shadow-2xs transition cursor-pointer disabled:opacity-50"
            title="Refresh Data"
          >
            <FiRefreshCw size={14} className={loading ? 'animate-spin text-rose-600' : ''} />
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          2. THE 5 PROMINENT BEAUTIFUL SUMMARY CARDS
          ══════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        {[
          {
            label: 'Income Statement',
            sub: 'Net Revenue',
            value: fmtKES(netRevenue),
            border: 'border-l-blue-500',
            bg: 'bg-blue-50/40',
            iconBg: 'bg-blue-100',
            iconColor: 'text-blue-600',
            icon: (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
                <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" />
              </svg>
            ),
          },
          {
            label: 'Cost Analysis',
            sub: 'COGS',
            value: fmtKES(totalCOGS),
            border: 'border-l-red-500',
            bg: 'bg-red-50/40',
            iconBg: 'bg-red-100',
            iconColor: 'text-red-600',
            icon: (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 2a4 4 0 00-4 4v1H5a1 1 0 00-.994.89l-1 9A1 1 0 004 18h12a1 1 0 00.994-1.11l-1-9A1 1 0 0015 7h-1V6a4 4 0 00-4-4zm2 5V6a2 2 0 10-4 0v1h4zm-6 3a1 1 0 112 0 1 1 0 01-2 0zm7-1a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd" />
              </svg>
            ),
          },
          {
            label: 'Gross Analysis',
            sub: `Gross Profit (${grossMargin.toFixed(1)}%)`,
            value: fmtKES(grossProfit),
            border: grossProfit >= 0 ? 'border-l-green-500' : 'border-l-red-500',
            bg: grossProfit >= 0 ? 'bg-green-50/40' : 'bg-red-50/40',
            iconBg: grossProfit >= 0 ? 'bg-green-100' : 'bg-red-100',
            iconColor: grossProfit >= 0 ? 'text-green-600' : 'text-red-600',
            icon: (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd" />
              </svg>
            ),
          },
          {
            label: 'Operating Costs',
            sub: 'Total Expenses',
            value: fmtKES(totalExpenses),
            border: 'border-l-orange-500',
            bg: 'bg-orange-50/40',
            iconBg: 'bg-orange-100',
            iconColor: 'text-orange-600',
            icon: (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
              </svg>
            ),
          },
          {
            label: netProfit >= 0 ? 'Net Earnings' : 'Net Deficit',
            sub: `Net ${netProfit >= 0 ? 'Profit' : 'Loss'} (${netMargin.toFixed(1)}%)`,
            value: fmtKES(Math.abs(netProfit)),
            border: netProfit >= 0 ? 'border-l-teal-500' : 'border-l-red-500',
            bg: netProfit >= 0 ? 'bg-teal-50/40' : 'bg-red-50/40',
            iconBg: netProfit >= 0 ? 'bg-teal-100' : 'bg-red-100',
            iconColor: netProfit >= 0 ? 'text-teal-600' : 'text-red-600',
            icon: (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" clipRule="evenodd" />
              </svg>
            ),
          },
        ].map((card, i) => (
          <div
            key={i}
            className={`bg-white rounded-2xl border border-slate-200 border-l-4 ${card.border} ${card.bg} p-4 shadow-xs hover:shadow-md transition-all group`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 truncate">{card.label}</p>
                <p className="text-lg font-black text-slate-800 mt-1 leading-tight">{card.value}</p>
                <p className="text-[11px] text-slate-500 mt-0.5 font-semibold truncate">{card.sub}</p>
              </div>
              <div
                className={`w-9 h-9 rounded-xl ${card.iconBg} ${card.iconColor} flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform shadow-xs ml-2`}
              >
                {card.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          3. DATE PRESETS & FILTER BAR
          ══════════════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-2xl border border-slate-200 p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { l: 'Today', v: 'today' },
            { l: 'Yesterday', v: 'yesterday' },
            { l: '7d', v: '7d' },
            { l: '30d', v: '30d' },
            { l: 'Month', v: 'month' },
            { l: 'Last Month', v: 'last_month' },
            { l: 'Quarter', v: 'quarter' },
            { l: 'Year', v: 'year' },
            { l: 'All', v: 'all' },
          ].map((p) => (
            <button
              key={p.v}
              onClick={() => setDatePreset(p.v)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                preset === p.v ? 'bg-rose-500 text-white shadow-2xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {p.l}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPreset('');
            }}
            className="px-3 py-1.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 shadow-2xs focus:ring-2 focus:ring-rose-500"
          />
          <span className="text-slate-400 font-bold text-xs">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPreset('');
            }}
            className="px-3 py-1.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 shadow-2xs focus:ring-2 focus:ring-rose-500"
          />
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          4. TAB CONTROLS (ADVANCED FEATURES)
          ══════════════════════════════════════════════════════════════════ */}
      <div className="bg-white border border-slate-200 rounded-2xl p-1.5 shadow-xs flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1">
          <button
            onClick={() => setActiveTab('statement')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'statement'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <FiFileText size={14} />
            <span>P&amp;L Statement</span>
          </button>

          <button
            onClick={() => setActiveTab('visuals')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'visuals'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <FiBarChart2 size={14} />
            <span>Waterfall &amp; Trends</span>
          </button>

          <button
            onClick={() => setActiveTab('expenses')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'expenses'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <FiActivity size={14} />
            <span>Expenses Ledger</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                activeTab === 'expenses' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {rawExpenses.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('categories')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'categories'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <FiPieChart size={14} />
            <span>Category Profitability</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                activeTab === 'categories' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {categoryContributions.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('comparative')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'comparative'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <FiSliders size={14} />
            <span>Period Variance (PoP)</span>
          </button>
        </div>

        <div className="text-[11px] font-bold text-slate-500 pr-2 hidden sm:block">
          Net Margin: <span className="text-teal-700 font-black">{netMargin.toFixed(1)}%</span>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          TAB 1: STATEMENT OF PROFIT & LOSS (PRESERVED BEAUTY + ADVANCED ACCURACY)
          ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'statement' && (
        <>
          {loading ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center text-slate-400">
              <FiRefreshCw size={28} className="animate-spin text-rose-600 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-600">Loading P&amp;L statement...</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 max-w-3xl mx-auto shadow-xs">
              <h2 className="text-center text-xl font-black text-slate-900 mb-1">
                {activeOutlet?.outlet_name || 'Alpha Retail'}
              </h2>
              <p className="text-center text-xs text-slate-500 mb-6 font-semibold">
                Profit &amp; Loss Statement for the period {formatDate(dateFrom)} to {formatDate(dateTo)}
              </p>

              {/* SECTION 1: INCOME */}
              <div className="bg-blue-50/90 border border-blue-200 rounded-xl px-5 py-2.5 mb-3 text-sm font-black text-blue-900 flex justify-between items-center">
                <span>📊 1. INCOME</span>
                <span className="text-[11px] text-blue-700 font-extrabold">% Net Rev</span>
              </div>
              <div className="px-2 space-y-1">
                <StatRow
                  label="Gross Sales"
                  value={grossSales}
                  indent
                  pct={netRevenue > 0 ? ((grossSales / netRevenue) * 100).toFixed(1) : '100.0'}
                />
                <StatRow
                  label="Less: Sales Returns"
                  value={salesReturns}
                  indent
                  negative={salesReturns > 0}
                  pct={netRevenue > 0 ? (-returnRate).toFixed(1) : '0.0'}
                />
                <StatRow label="Net Revenue" value={netRevenue} bold line pct="100.0" />
              </div>

              {/* SECTION 2: COST OF GOODS SOLD */}
              <div className="bg-red-50/90 border border-red-200 rounded-xl px-5 py-2.5 mt-5 mb-3 text-sm font-black text-red-900 flex justify-between items-center">
                <span>📦 2. COST OF GOODS SOLD</span>
                <span className="text-[11px] text-red-700 font-extrabold">% Net Rev</span>
              </div>
              <div className="px-2 space-y-1">
                <StatRow
                  label="Opening Stock"
                  value={openingStock}
                  indent
                  pct={netRevenue > 0 ? ((openingStock / netRevenue) * 100).toFixed(1) : '—'}
                />
                <StatRow
                  label="Add: Purchases"
                  value={purchases}
                  indent
                  pct={netRevenue > 0 ? ((purchases / netRevenue) * 100).toFixed(1) : '—'}
                />
                <StatRow
                  label="Less: Closing Stock"
                  value={closingStock}
                  indent
                  negative
                  pct={netRevenue > 0 ? (-((closingStock / netRevenue) * 100)).toFixed(1) : '—'}
                />
                <StatRow
                  label="Cost of Goods Sold (COGS)"
                  value={totalCOGS}
                  bold
                  line
                  pct={netRevenue > 0 ? ((totalCOGS / netRevenue) * 100).toFixed(1) : '0.0'}
                />
              </div>

              {/* SECTION 3: GROSS PROFIT */}
              <div
                className={`rounded-xl px-5 py-3.5 mt-5 text-sm font-black flex justify-between items-center border ${
                  grossProfit >= 0 ? 'bg-green-50 border-green-300 text-green-900' : 'bg-red-50 border-red-300 text-red-900'
                }`}
              >
                <span className="tracking-wide">📈 GROSS PROFIT</span>
                <div className="flex items-center gap-4">
                  <span className="font-mono text-base">{fmtKES(grossProfit)}</span>
                  <span
                    className={`px-2 py-0.5 rounded-lg text-xs font-black ${
                      grossProfit >= 0 ? 'bg-green-200/80 text-green-900' : 'bg-red-200/80 text-red-900'
                    }`}
                  >
                    {grossMargin.toFixed(1)}%
                  </span>
                </div>
              </div>

              {/* SECTION 4: OPERATING EXPENSES */}
              <div className="bg-orange-50/90 border border-orange-200 rounded-xl px-5 py-2.5 mt-5 mb-3 text-sm font-black text-orange-900 flex justify-between items-center">
                <span>💸 3. OPERATING EXPENSES</span>
                <span className="text-[11px] text-orange-700 font-extrabold">% Net Rev</span>
              </div>
              <div className="px-2 space-y-1">
                {expenseCategories.map((cat) => (
                  <StatRow
                    key={cat.name}
                    label={cat.name}
                    value={cat.amount}
                    indent
                    pct={cat.percentageOfRevenue.toFixed(1)}
                    subNote={`${cat.count} recorded transaction${cat.count > 1 ? 's' : ''} &bull; ${cat.percentageOfOpEx.toFixed(1)}% OpEx`}
                  />
                ))}
                {expenseCategories.length === 0 && (
                  <p className="text-xs text-slate-400 pl-8 py-2 italic">No expenses recorded in this period</p>
                )}
                <StatRow
                  label="Total Operating Expenses"
                  value={totalExpenses}
                  bold
                  line
                  pct={opexRatio.toFixed(1)}
                />
              </div>

              {/* SECTION 5: NET PROFIT / LOSS */}
              <div
                className={`rounded-xl px-6 py-4 mt-6 font-black text-lg flex justify-between items-center shadow-xs border-2 ${
                  netProfit >= 0
                    ? 'bg-teal-50 border-teal-400 text-teal-900'
                    : 'bg-red-100 border-red-400 text-red-900'
                }`}
              >
                <span className="tracking-wide">🏆 NET {netProfit >= 0 ? 'PROFIT' : 'LOSS'}</span>
                <div className="flex items-center gap-4">
                  <span className="font-mono text-xl">{fmtKES(Math.abs(netProfit))}</span>
                  <span
                    className={`px-2.5 py-1 rounded-lg text-xs font-black ${
                      netProfit >= 0 ? 'bg-teal-600 text-white shadow-2xs' : 'bg-red-600 text-white shadow-2xs'
                    }`}
                  >
                    {netProfit >= 0 ? `+${netMargin.toFixed(1)}%` : `${netMargin.toFixed(1)}%`}
                  </span>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB 2: WATERFALL & VISUAL FINANCIAL TRENDS
          ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'visuals' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <FiBarChart2 size={16} className="text-blue-600" />
                  Financial Waterfall: Turnover to Net Earnings
                </h3>
                <p className="text-xs text-slate-500">
                  Visual journey showing how gross revenue is allocated across returns, inventory costs, and OpEx
                </p>
              </div>
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={waterfallData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="name" stroke="#64748B" fontSize={11} tickLine={false} />
                  <YAxis stroke="#64748B" fontSize={11} tickFormatter={(val: any) => fmtK(val)} tickLine={false} />
                  <RechartsTooltip
                    formatter={(val: any) => [fmtKES(val), 'Amount']}
                    contentStyle={{ backgroundColor: '#0F172A', borderColor: '#1E293B', borderRadius: '12px', color: '#FFF' }}
                  />
                  <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                    {waterfallData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
              <div className="mb-4">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <FiTrendingUp size={16} className="text-emerald-600" />
                  Daily Net Revenue vs COGS &amp; Net Profit
                </h3>
                <p className="text-xs text-slate-500">Daily financial trajectory across the reporting window</p>
              </div>

              <div className="h-64 w-full">
                {dailyTimeline.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400">
                    No daily movement recorded in this period.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dailyTimeline} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
                      <defs>
                        <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0284C7" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#0284C7" stopOpacity={0.0} />
                        </linearGradient>
                        <linearGradient id="colorNP" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10B981" stopOpacity={0.5} />
                          <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      <XAxis dataKey="dayLabel" stroke="#64748B" fontSize={10} tickLine={false} />
                      <YAxis stroke="#64748B" fontSize={10} tickFormatter={(v: any) => fmtK(v)} tickLine={false} />
                      <RechartsTooltip
                        formatter={(val: any, name: any) => [fmtKES(val), name]}
                        contentStyle={{ backgroundColor: '#0F172A', borderColor: '#1E293B', borderRadius: '12px', color: '#FFF' }}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                      <Area type="monotone" dataKey="netRevenue" name="Net Revenue" stroke="#0284C7" strokeWidth={2} fillOpacity={1} fill="url(#colorRev)" />
                      <Area type="monotone" dataKey="cogs" name="COGS" stroke="#F59E0B" strokeWidth={2} fill="transparent" />
                      <Area type="monotone" dataKey="netProfit" name="Net Profit" stroke="#10B981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorNP)" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
              <div className="mb-4">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <FiPieChart size={16} className="text-rose-600" />
                  OpEx Category Allocation
                </h3>
                <p className="text-xs text-slate-500">Distribution of operating spend across categories</p>
              </div>

              <div className="h-48 w-full">
                {expenseCategories.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400">
                    No expenses to visualize.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={expenseCategories}
                        dataKey="amount"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={75}
                        paddingAngle={3}
                      >
                        {expenseCategories.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={PALETTE[index % PALETTE.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        formatter={(val: any) => [fmtKES(val), 'Spend']}
                        contentStyle={{ backgroundColor: '#0F172A', borderColor: '#1E293B', borderRadius: '12px', color: '#FFF' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="space-y-1.5 mt-2 max-h-36 overflow-y-auto pr-1">
                {expenseCategories.map((cat, idx) => (
                  <div key={cat.name} className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: PALETTE[idx % PALETTE.length] }} />
                      <span className="font-semibold text-slate-700 truncate">{cat.name}</span>
                    </div>
                    <span className="font-mono font-bold text-slate-900">{fmtK(cat.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB 3: OPERATING EXPENSES LEDGER (CLEAN VISIBLE HEADERS + PAGINATION)
          ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'expenses' && (
        <div className="space-y-3">
          <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
              <div className="relative flex-1 min-w-[200px]">
                <FiSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search expense name, note, ref no, user..."
                  value={expSearch}
                  onChange={(e) => {
                    setExpSearch(e.target.value);
                    setExpPage(1);
                  }}
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <select
                value={expCategoryFilter}
                onChange={(e) => {
                  setExpCategoryFilter(e.target.value);
                  setExpPage(1);
                }}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer"
              >
                <option value="ALL">All Categories ({expenseCategories.length})</option>
                {expenseCategories.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name} ({fmtK(c.amount)})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500">
                Total OpEx: <strong className="text-rose-700 font-mono">{fmtKES(totalExpenses)}</strong>
              </span>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 border-b-2 border-slate-300">
                  <tr className="bg-slate-100 border-b border-slate-300">
                    <th className="py-3 px-3 font-black uppercase tracking-wider text-[11px] w-12 text-center text-slate-900 bg-slate-100 border-r border-slate-200">#</th>
                    <th className="py-3 px-3 font-black uppercase tracking-wider text-[11px] text-slate-900 bg-slate-100 border-r border-slate-200">Expense Date</th>
                    <th className="py-3 px-3 font-black uppercase tracking-wider text-[11px] text-slate-900 bg-slate-100 border-r border-slate-200">Expense Title / Item</th>
                    <th className="py-3 px-3 font-black uppercase tracking-wider text-[11px] text-slate-900 bg-slate-100 border-r border-slate-200">Category</th>
                    <th className="py-3 px-3 font-black uppercase tracking-wider text-[11px] text-slate-900 bg-slate-100 border-r border-slate-200">Payment Mode</th>
                    <th className="py-3 px-3 font-black uppercase tracking-wider text-[11px] text-slate-900 bg-slate-100 border-r border-slate-200">Reference No</th>
                    <th className="py-3 px-3 font-black uppercase tracking-wider text-[11px] text-slate-900 bg-slate-100 border-r border-slate-200">Description / Note</th>
                    <th className="py-3 px-3 font-black uppercase tracking-wider text-[11px] text-slate-900 bg-slate-100 border-r border-slate-200">Recorded By</th>
                    <th className="py-3 px-3 font-black uppercase tracking-wider text-[11px] text-right text-slate-900 bg-slate-100">Amount (Ksh)</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {paginatedExpenses.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400 font-medium">
                        No expenses match your search filter in this reporting window.
                      </td>
                    </tr>
                  ) : (
                    paginatedExpenses.map((e, idx) => {
                      const rowNum = (expPage - 1) * expPerPage + idx + 1;
                      return (
                        <tr key={e.expense_id || idx} className="hover:bg-slate-50/80 transition">
                          <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px]">{rowNum}</td>
                          <td className="py-2.5 px-3 font-mono font-semibold text-slate-700 whitespace-nowrap">
                            {formatDate(e.expense_date)}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-slate-900">{e.expense_name}</td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-slate-100 text-slate-700 border border-slate-200">
                              {e.category}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 font-semibold">{e.payment_mode || 'Cash'}</td>
                          <td className="py-2.5 px-3 font-mono text-slate-500">{e.reference_no || '—'}</td>
                          <td className="py-2.5 px-3 text-slate-500 max-w-[220px] truncate" title={e.description || ''}>
                            {e.description || '—'}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 font-medium">{e.created_by || 'Admin'}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-black text-rose-700 text-sm">
                            {fmtKES(e.amount)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-3 bg-slate-50/80 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-500 font-medium">Rows per page:</span>
                <select
                  value={expPerPage}
                  onChange={(e) => {
                    setExpPerPage(Number(e.target.value));
                    setExpPage(1);
                  }}
                  className="bg-white border border-slate-200 rounded-lg px-2 py-1 font-bold text-slate-700 cursor-pointer"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span className="text-slate-500 ml-2">
                  Showing{' '}
                  <strong className="text-slate-800">
                    {filteredExpenses.length === 0 ? 0 : (expPage - 1) * expPerPage + 1}
                  </strong>{' '}
                  to{' '}
                  <strong className="text-slate-800">
                    {Math.min(expPage * expPerPage, filteredExpenses.length)}
                  </strong>{' '}
                  of <strong className="text-slate-800">{filteredExpenses.length}</strong> items
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setExpPage(1)}
                  disabled={expPage === 1}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                  title="First Page"
                >
                  <FiChevronsLeft size={14} />
                </button>
                <button
                  onClick={() => setExpPage((p) => Math.max(1, p - 1))}
                  disabled={expPage === 1}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                  title="Previous Page"
                >
                  <FiChevronLeft size={14} />
                </button>
                <span className="px-3 py-1 font-bold text-slate-800 bg-white border border-slate-200 rounded-lg">
                  {expPage} / {totalExpPages}
                </span>
                <button
                  onClick={() => setExpPage((p) => Math.min(totalExpPages, p + 1))}
                  disabled={expPage === totalExpPages}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                  title="Next Page"
                >
                  <FiChevronRight size={14} />
                </button>
                <button
                  onClick={() => setExpPage(totalExpPages)}
                  disabled={expPage === totalExpPages}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                  title="Last Page"
                >
                  <FiChevronsRight size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB 4: CATEGORY PROFITABILITY (CLEAN VISIBLE HEADERS + PAGINATION)
          ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'categories' && (
        <div className="space-y-3">
          <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[240px] max-w-md">
              <FiSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search category name..."
                value={catSearch}
                onChange={(e) => {
                  setCatSearch(e.target.value);
                  setCatPage(1);
                }}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="text-xs font-bold text-slate-500">
              Total Categories Evaluated:{' '}
              <strong className="text-blue-700 font-mono">{categoryContributions.length}</strong>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 border-b-2 border-slate-300">
                  <tr className="bg-slate-100 border-b border-slate-300">
                    <th className="py-3 px-3 font-black uppercase tracking-wider text-[11px] w-12 text-center text-slate-900 bg-slate-100 border-r border-slate-200">#</th>
                    <th className="py-3 px-3 font-black uppercase tracking-wider text-[11px] text-slate-900 bg-slate-100 border-r border-slate-200">Category Name</th>
                    <th className="py-3 px-3 font-black uppercase tracking-wider text-[11px] text-center text-slate-900 bg-slate-100 border-r border-slate-200">SKUs Sold</th>
                    <th className="py-3 px-3 font-black uppercase tracking-wider text-[11px] text-right text-slate-900 bg-slate-100 border-r border-slate-200">Physical Units</th>
                    <th className="py-3 px-3 font-black uppercase tracking-wider text-[11px] text-right text-slate-900 bg-slate-100 border-r border-slate-200">Turnover (Revenue)</th>
                    <th className="py-3 px-3 font-black uppercase tracking-wider text-[11px] text-right text-slate-900 bg-slate-100 border-r border-slate-200">Direct Cost (COGS)</th>
                    <th className="py-3 px-3 font-black uppercase tracking-wider text-[11px] text-right text-slate-900 bg-slate-100 border-r border-slate-200">Gross Profit</th>
                    <th className="py-3 px-3 font-black uppercase tracking-wider text-[11px] text-center text-slate-900 bg-slate-100 border-r border-slate-200">Gross Margin %</th>
                    <th className="py-3 px-3 font-black uppercase tracking-wider text-[11px] text-right text-slate-900 bg-slate-100">Profit Share %</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {paginatedCategories.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400 font-medium">
                        No merchandise categories recorded sales in this period.
                      </td>
                    </tr>
                  ) : (
                    paginatedCategories.map((c, idx) => {
                      const rowNum = (catPage - 1) * catPerPage + idx + 1;
                      return (
                        <tr key={c.category} className="hover:bg-slate-50/80 transition">
                          <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px]">{rowNum}</td>
                          <td className="py-2.5 px-3 font-bold text-slate-900 flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-blue-600 flex-shrink-0" />
                            {c.category}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-semibold text-slate-700">{c.skusSold}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-800">{fmtN(c.unitsSold)}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-blue-700">{fmtKES(c.revenue)}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-800">{fmtKES(c.costOfSales)}</td>
                          <td className={`py-2.5 px-3 text-right font-mono font-black ${c.grossProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                            {fmtKES(c.grossProfit)}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                                c.grossMargin >= 25
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : c.grossMargin >= 10
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {c.grossMargin.toFixed(1)}%
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-700">
                            {c.profitSharePct.toFixed(1)}%
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-3 bg-slate-50/80 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-500 font-medium">Rows per page:</span>
                <select
                  value={catPerPage}
                  onChange={(e) => {
                    setCatPerPage(Number(e.target.value));
                    setCatPage(1);
                  }}
                  className="bg-white border border-slate-200 rounded-lg px-2 py-1 font-bold text-slate-700 cursor-pointer"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
                <span className="text-slate-500 ml-2">
                  Showing{' '}
                  <strong className="text-slate-800">
                    {filteredCategories.length === 0 ? 0 : (catPage - 1) * catPerPage + 1}
                  </strong>{' '}
                  to{' '}
                  <strong className="text-slate-800">
                    {Math.min(catPage * catPerPage, filteredCategories.length)}
                  </strong>{' '}
                  of <strong className="text-slate-800">{filteredCategories.length}</strong> categories
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCatPage(1)}
                  disabled={catPage === 1}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                  title="First Page"
                >
                  <FiChevronsLeft size={14} />
                </button>
                <button
                  onClick={() => setCatPage((p) => Math.max(1, p - 1))}
                  disabled={catPage === 1}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                  title="Previous Page"
                >
                  <FiChevronLeft size={14} />
                </button>
                <span className="px-3 py-1 font-bold text-slate-800 bg-white border border-slate-200 rounded-lg">
                  {catPage} / {totalCatPages}
                </span>
                <button
                  onClick={() => setCatPage((p) => Math.min(totalCatPages, p + 1))}
                  disabled={catPage === totalCatPages}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                  title="Next Page"
                >
                  <FiChevronRight size={14} />
                </button>
                <button
                  onClick={() => setCatPage(totalCatPages)}
                  disabled={catPage === totalCatPages}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                  title="Last Page"
                >
                  <FiChevronsRight size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB 5: COMPARATIVE PERIOD VARIANCE (PoP)
          ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'comparative' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs max-w-4xl mx-auto space-y-4">
          <div>
            <h3 className="text-base font-black text-slate-900 tracking-tight">
              Period-Over-Period Comparative Variance (PoP)
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Benchmark current period financial performance against the immediately preceding period of equal duration
            </p>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-2xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 border-b-2 border-slate-300">
                <tr className="bg-slate-100 border-b border-slate-300">
                  <th className="py-3 px-4 font-black uppercase tracking-wider text-[11px] text-slate-900 bg-slate-100 border-r border-slate-200">Financial Metric</th>
                  <th className="py-3 px-4 font-black uppercase tracking-wider text-[11px] text-right text-slate-900 bg-slate-100 border-r border-slate-200">Current Period</th>
                  <th className="py-3 px-4 font-black uppercase tracking-wider text-[11px] text-right text-slate-900 bg-slate-100 border-r border-slate-200">Prior Period</th>
                  <th className="py-3 px-4 font-black uppercase tracking-wider text-[11px] text-right text-slate-900 bg-slate-100 border-r border-slate-200">Variance (Ksh)</th>
                  <th className="py-3 px-4 font-black uppercase tracking-wider text-[11px] text-center text-slate-900 bg-slate-100">Growth %</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {[
                  { label: 'Gross Turnover', curr: grossSales, prior: priorMetrics.grossSales, isGoodWhenUp: true },
                  { label: 'Sales Returns', curr: salesReturns, prior: priorMetrics.salesReturns, isGoodWhenUp: false },
                  { label: 'Net Revenue', curr: netRevenue, prior: priorMetrics.netRevenue, isGoodWhenUp: true },
                  { label: 'Cost of Goods Sold (COGS)', curr: totalCOGS, prior: priorMetrics.cogs, isGoodWhenUp: false },
                  { label: 'Gross Profit', curr: grossProfit, prior: priorMetrics.grossProfit, isGoodWhenUp: true },
                  { label: 'Operating Expenses (OpEx)', curr: totalExpenses, prior: priorMetrics.expenses, isGoodWhenUp: false },
                  { label: 'Net Profit', curr: netProfit, prior: priorMetrics.netProfit, isGoodWhenUp: true },
                ].map((row) => {
                  const variance = row.curr - row.prior;
                  const pctChange = row.prior > 0 ? (variance / row.prior) * 100 : row.curr > 0 ? 100 : 0;
                  const isPositive = row.isGoodWhenUp ? variance >= 0 : variance <= 0;

                  return (
                    <tr key={row.label} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4 font-bold text-slate-800">{row.label}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">{fmtKES(row.curr)}</td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-slate-500">{fmtKES(row.prior)}</td>
                      <td
                        className={`py-3 px-4 text-right font-mono font-black ${
                          variance > 0 ? 'text-emerald-700' : variance < 0 ? 'text-rose-700' : 'text-slate-600'
                        }`}
                      >
                        {variance > 0 ? `+${fmtKES(variance)}` : fmtKES(variance)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                            isPositive ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {variance >= 0 ? <FiArrowUp size={10} /> : <FiArrowDown size={10} />}
                          {pctChange > 0 ? `+${pctChange.toFixed(1)}%` : `${pctChange.toFixed(1)}%`}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
