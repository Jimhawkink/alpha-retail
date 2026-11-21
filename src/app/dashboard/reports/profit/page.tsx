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
  FiPieChart,
  FiBarChart2,
  FiPercent,
  FiDownload,
  FiPrinter,
  FiRefreshCw,
  FiSearch,
  FiFilter,
  FiCalendar,
  FiChevronLeft,
  FiChevronRight,
  FiChevronsLeft,
  FiChevronsRight,
  FiPackage,
  FiAlertTriangle,
  FiCheckCircle,
  FiXCircle,
  FiLayers,
  FiSliders,
  FiShoppingBag,
  FiActivity,
  FiArrowUpRight,
  FiArrowDownRight,
  FiInfo,
  FiTag,
  FiShield,
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
interface ProfitItem {
  pid: number | string;
  name: string;
  category: string;
  qtySold: number;
  revenue: number;
  costPrice: number;
  sellingPrice: number;
  totalCost: number;
  profit: number;
  margin: number;
  markup: number;
}

interface CategoryProfit {
  category: string;
  itemCount: number;
  qtySold: number;
  revenue: number;
  totalCost: number;
  profit: number;
  margin: number;
  profitSharePct: number;
}

interface DailyProfitPoint {
  date: string;
  dayLabel: string;
  revenue: number;
  cogs: number;
  profit: number;
  margin: number;
}

interface OutletOption {
  outlet_id: number;
  outlet_name: string;
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

const TIER_COLORS = ['#10B981', '#06B6D4', '#F59E0B', '#EF4444'];
const PAGE_SIZES = [10, 20, 50, 100];

/* ══════════════════════════════════════════════════════════════════════════════
   MAIN PROFIT REPORT COMPONENT
   ══════════════════════════════════════════════════════════════════════════════ */
export default function ProfitReportPage() {
  const [mounted, setMounted] = useState(false);
  const { activeOutlet } = useOutlet();
  const companyName = useCompanyName();

  // Primary Navigation Mode
  const [activeView, setActiveView] = useState<'table' | 'charts' | 'categories' | 'risk'>('table');

  // Filter States
  const [datePreset, setDatePresetState] = useState('30d');
  const [dateFrom, setDateFrom] = useState(getDaysAgo(30));
  const [dateTo, setDateTo] = useState(toDay());
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterMarginTier, setFilterMarginTier] = useState<'All' | 'High' | 'Medium' | 'Thin' | 'Loss'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'profit' | 'margin' | 'revenue' | 'qty'>('profit');

  // Outlets
  const [outlets, setOutlets] = useState<OutletOption[]>([]);
  const [selectedOutletId, setSelectedOutletId] = useState<number | 'all'>('all');

  // Core Data States
  const [items, setItems] = useState<ProfitItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [dailyTrend, setDailyTrend] = useState<DailyProfitPoint[]>([]);
  const [loading, setLoading] = useState(true);

  // Pagination Controls
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);

  // Search input ref for Ctrl+F
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Hydration safety
  useEffect(() => {
    setMounted(true);
  }, []);

  // Keyboard shortcut Ctrl+F
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Load Outlets
  useEffect(() => {
    const loadOutlets = async () => {
      try {
        const { data } = await supabase
          .from('retail_outlets')
          .select('outlet_id, outlet_name')
          .eq('active', true)
          .order('outlet_name');
        if (data && data.length > 0) {
          setOutlets(data);
          if (activeOutlet) {
            setSelectedOutletId(activeOutlet.outlet_id);
          }
        }
      } catch (err) {
        console.error('Error loading outlets:', err);
      }
    };
    loadOutlets();
  }, [activeOutlet]);

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
     LOAD COMPLETE PROFIT & MARGIN DATA
     ───────────────────────────────────────────────────────────────────────── */
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Step 1: Query sales in date range with safe sale_date
      let salesQuery = supabase
        .from('retail_sales')
        .select('sale_id, sale_date, total_amount, profit, outlet_id')
        .gte('sale_date', dateFrom)
        .lte('sale_date', dateTo);

      if (selectedOutletId !== 'all') {
        salesQuery = salesQuery.eq('outlet_id', selectedOutletId);
      }

      const { data: salesData, error: salesErr } = await salesQuery.limit(4000);
      if (salesErr) throw salesErr;

      const salesList = salesData || [];
      const saleIds = salesList.map((s) => Number(s.sale_id)).filter(Boolean);

      if (saleIds.length === 0) {
        setItems([]);
        setCategories([]);
        setDailyTrend([]);
        setLoading(false);
        return;
      }

      // Step 2: Fetch Products Master to obtain standard purchase_cost and package multiplier
      let productsQuery = supabase
        .from('retail_products')
        .select('pid, product_name, purchase_cost, sales_cost, category, pieces_per_package');

      if (selectedOutletId !== 'all') {
        productsQuery = productsQuery.eq('outlet_id', selectedOutletId);
      }
      const { data: productsData } = await productsQuery.limit(3000);

      const costMap: Record<string | number, { purchaseCost: number; costPerPiece: number; category: string; piecesPerPackage: number; salesCost: number }> = {};
      (productsData || []).forEach((p) => {
        const ppp = Number(p.pieces_per_package || 1);
        const purchaseCost = Number(p.purchase_cost || 0);
        const costPerPiece = ppp > 0 ? purchaseCost / ppp : purchaseCost;
        costMap[p.pid] = {
          purchaseCost,
          costPerPiece,
          category: p.category || 'General Merchandise',
          piecesPerPackage: ppp,
          salesCost: Number(p.sales_cost || 0),
        };
      });

      // Step 3: Fetch Sales Items in safe chunks of 150 to prevent URI overflow
      const chunks: number[][] = [];
      for (let i = 0; i < saleIds.length; i += 150) {
        chunks.push(saleIds.slice(i, i + 150));
      }

      const chunkResults = await Promise.all(
        chunks.map((chunk) =>
          supabase
            .from('retail_sales_items')
            .select('product_id, product_name, quantity, unit_price, cost_price, discount, subtotal, profit, notes, sale_id')
            .in('sale_id', chunk)
        )
      );

      const allItems = chunkResults.flatMap((r) => r.data || []);

      // Step 4: Map Sales by ID for Daily Trend
      const saleDateMap: Record<number, string> = {};
      salesList.forEach((s) => {
        if (s.sale_id) saleDateMap[Number(s.sale_id)] = s.sale_date;
      });

      // Daily trend aggregator
      const dailyMap: Record<string, { revenue: number; cogs: number; profit: number }> = {};

      // Step 5: Aggregate Line Items by Product
      const profitMap = new Map<string, ProfitItem>();

      allItems.forEach((item) => {
        const key = item.product_name || 'Unknown Product';
        const pid = item.product_id;
        const info = costMap[pid] || {
          purchaseCost: Number(item.cost_price || 0),
          costPerPiece: Number(item.cost_price || 0),
          category: 'General Merchandise',
          piecesPerPackage: 1,
          salesCost: Number(item.unit_price || 0),
        };

        let unitCost = Number(item.cost_price || info.costPerPiece || 0);

        // Package / Bag multiplier detection from notes
        const notes = item.notes || '';
        const multiplierMatch = notes.match(/\(x(\d+)\)/);
        if (multiplierMatch) {
          unitCost = info.purchaseCost;
        }

        const qty = Number(item.quantity || 0);
        const subtotal = Number(item.subtotal || (Number(item.unit_price || 0) * qty));
        const lineCOGS = unitCost * qty;
        const lineProfit = Number(item.profit || (subtotal - lineCOGS));

        if (!profitMap.has(key)) {
          profitMap.set(key, {
            pid: pid || key,
            name: key,
            category: info.category,
            qtySold: 0,
            revenue: 0,
            costPrice: unitCost,
            sellingPrice: Number(item.unit_price || info.salesCost || 0),
            totalCost: 0,
            profit: 0,
            margin: 0,
            markup: 0,
          });
        }

        const p = profitMap.get(key)!;
        p.qtySold += qty;
        p.revenue += subtotal;
        p.totalCost += lineCOGS;
        p.profit += lineProfit;
        if (item.unit_price && Number(item.unit_price) > 0) {
          p.sellingPrice = Number(item.unit_price);
        }

        // Aggregate into Daily Trend
        const sDate = saleDateMap[Number(item.sale_id)] || dateFrom;
        if (!dailyMap[sDate]) {
          dailyMap[sDate] = { revenue: 0, cogs: 0, profit: 0 };
        }
        dailyMap[sDate].revenue += subtotal;
        dailyMap[sDate].cogs += lineCOGS;
        dailyMap[sDate].profit += lineProfit;
      });

      // Format product results
      const finalItems: ProfitItem[] = Array.from(profitMap.values()).map((p) => {
        const margin = p.revenue > 0 ? Math.round((p.profit / p.revenue) * 100) : 0;
        const markup = p.totalCost > 0 ? Math.round((p.profit / p.totalCost) * 100) : 0;
        return {
          ...p,
          margin,
          markup,
        };
      });

      setItems(finalItems);

      // Categories
      const catList = Array.from(new Set(finalItems.map((r) => r.category))).sort();
      setCategories(catList);

      // Format Daily Trend
      const startDt = new Date(dateFrom);
      const endDt = new Date(dateTo);
      const trendPoints: DailyProfitPoint[] = [];

      for (let d = new Date(startDt); d <= endDt; d.setDate(d.getDate() + 1)) {
        const k = d.toISOString().split('T')[0];
        const dayLabel = d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' });
        const val = dailyMap[k] || { revenue: 0, cogs: 0, profit: 0 };
        const m = val.revenue > 0 ? Math.round((val.profit / val.revenue) * 100) : 0;
        trendPoints.push({
          date: k,
          dayLabel,
          revenue: val.revenue,
          cogs: val.cogs,
          profit: val.profit,
          margin: m,
        });
      }
      setDailyTrend(trendPoints);
    } catch (err) {
      console.error('Error loading profit report:', err);
      toast.error('Failed to load profit data');
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, selectedOutletId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /* ─────────────────────────────────────────────────────────────────────────
     FILTER & SORT PIPELINE
     ───────────────────────────────────────────────────────────────────────── */
  const filtered = useMemo(() => {
    return items
      .filter((i) => {
        // Category filter
        if (filterCategory !== 'All' && i.category !== filterCategory) return false;

        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          if (!i.name.toLowerCase().includes(q) && !i.category.toLowerCase().includes(q)) {
            return false;
          }
        }

        // Margin Health Tier filter
        if (filterMarginTier === 'High' && i.margin < 30) return false;
        if (filterMarginTier === 'Medium' && (i.margin < 15 || i.margin >= 30)) return false;
        if (filterMarginTier === 'Thin' && (i.margin < 0 || i.margin >= 15)) return false;
        if (filterMarginTier === 'Loss' && i.profit >= 0) return false;

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'margin') return b.margin - a.margin;
        if (sortBy === 'revenue') return b.revenue - a.revenue;
        if (sortBy === 'qty') return b.qtySold - a.qtySold;
        return b.profit - a.profit;
      });
  }, [items, filterCategory, searchQuery, filterMarginTier, sortBy]);

  // Aggregate Metrics
  const totalRevenue = useMemo(() => filtered.reduce((s, i) => s + i.revenue, 0), [filtered]);
  const totalCOGS = useMemo(() => filtered.reduce((s, i) => s + i.totalCost, 0), [filtered]);
  const grossProfit = useMemo(() => totalRevenue - totalCOGS, [totalRevenue, totalCOGS]);
  const overallMargin = useMemo(
    () => (totalRevenue > 0 ? Math.round((grossProfit / totalRevenue) * 100) : 0),
    [grossProfit, totalRevenue]
  );
  const totalUnitsSold = useMemo(() => filtered.reduce((s, i) => s + i.qtySold, 0), [filtered]);
  const avgProfitPerUnit = useMemo(
    () => (totalUnitsSold > 0 ? grossProfit / totalUnitsSold : 0),
    [grossProfit, totalUnitsSold]
  );

  // Category Profit Matrix
  const categoryMatrix = useMemo(() => {
    const map = new Map<string, CategoryProfit>();
    items.forEach((i) => {
      const cat = i.category || 'General Merchandise';
      if (!map.has(cat)) {
        map.set(cat, {
          category: cat,
          itemCount: 0,
          qtySold: 0,
          revenue: 0,
          totalCost: 0,
          profit: 0,
          margin: 0,
          profitSharePct: 0,
        });
      }
      const c = map.get(cat)!;
      c.itemCount += 1;
      c.qtySold += i.qtySold;
      c.revenue += i.revenue;
      c.totalCost += i.totalCost;
      c.profit += i.profit;
    });

    const arr = Array.from(map.values()).sort((a, b) => b.profit - a.profit);
    const totProfit = arr.reduce((s, c) => s + Math.max(0, c.profit), 0) || 1;

    arr.forEach((c) => {
      c.margin = c.revenue > 0 ? Math.round((c.profit / c.revenue) * 100) : 0;
      c.profitSharePct = Math.round((Math.max(0, c.profit) / totProfit) * 100);
    });
    return arr;
  }, [items]);

  // Margin Health Distribution Tiers
  const marginTiers = useMemo(() => {
    let high = 0,
      med = 0,
      thin = 0,
      loss = 0;
    items.forEach((i) => {
      if (i.profit < 0) loss += i.revenue;
      else if (i.margin >= 30) high += i.revenue;
      else if (i.margin >= 15) med += i.revenue;
      else thin += i.revenue;
    });
    const tot = totalRevenue || 1;
    return [
      { name: 'High Margin (≥30%)', value: high, count: items.filter((i) => i.margin >= 30 && i.profit >= 0).length, color: '#10B981', pct: Math.round((high / tot) * 100) },
      { name: 'Medium Margin (15-30%)', value: med, count: items.filter((i) => i.margin >= 15 && i.margin < 30).length, color: '#06B6D4', pct: Math.round((med / tot) * 100) },
      { name: 'Thin Margin (0-15%)', value: thin, count: items.filter((i) => i.margin >= 0 && i.margin < 15).length, color: '#F59E0B', pct: Math.round((thin / tot) * 100) },
      { name: 'Loss / Negative Margin', value: loss, count: items.filter((i) => i.profit < 0).length, color: '#EF4444', pct: Math.round((loss / tot) * 100) },
    ];
  }, [items, totalRevenue]);

  // Low & Negative Margin Watchlist
  const riskWatchItems = useMemo(() => {
    return items.filter((i) => i.margin < 10 || i.profit < 0).sort((a, b) => a.margin - b.margin);
  }, [items]);

  // Pagination Slice
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paginatedItems = useMemo(() => {
    const from = (page - 1) * perPage;
    return filtered.slice(from, from + perPage);
  }, [filtered, page, perPage]);

  // Outlet Display Name
  const outletDisplayName = useMemo(() => {
    if (selectedOutletId === 'all') return 'All Outlets';
    return outlets.find((o) => o.outlet_id === selectedOutletId)?.outlet_name || activeOutlet?.outlet_name || 'Alpha Retail';
  }, [selectedOutletId, outlets, activeOutlet]);

  /* ─────────────────────────────────────────────────────────────────────────
     EXPORT ULTRA SUPER-PREMIUM MULTI-SHEET EXCEL WORKBOOK
     ───────────────────────────────────────────────────────────────────────── */
  const exportSuperExcel = async () => {
    try {
      const XLSX = (await import('xlsx-js-style')).default || (await import('xlsx-js-style'));
      const wb = XLSX.utils.book_new();

      // ── SHEET 1: Master Product Profitability Ledger ──
      const title = `${(companyName || 'ALPHA RETAIL').toUpperCase()} — ${(outletDisplayName || 'ALL OUTLETS').toUpperCase()}`;
      const s1Data: any[][] = [
        [title],
        ['OFFICIAL PRODUCT PROFITABILITY, MARGIN SPREAD & COST OF GOODS SOLD REGISTER'],
        [`Scope: ${dateFrom} to ${dateTo}  |  Generated: ${new Date().toLocaleString('en-KE')}  |  Products Audited: ${filtered.length}`],
        [],
        ['EXECUTIVE PROFIT & COGS SUMMARY', '', '', '', '', ''],
        ['METRIC', 'VALUE (KSH / UNITS)', 'MARGIN RATE', 'STATUS', 'AUDIT NOTE'],
        ['Gross Sales Revenue', totalRevenue, '100.0%', 'Active Sales', 'Total billing across all filtered products'],
        ['Cost of Goods Sold (COGS)', totalCOGS, `${((totalCOGS / (totalRevenue || 1)) * 100).toFixed(1)}% Cost Rate`, 'Inventory Cost', 'Wholesale replacement acquisition cost'],
        ['Gross Trading Profit', grossProfit, `${overallMargin}% Profit Margin`, grossProfit >= 0 ? 'Surplus' : 'Deficit', 'Gross profit realized before overhead OPEX'],
        ['Units Moved', totalUnitsSold, 'Pcs Sold', 'Volume', 'Total physical merchandise units settled'],
        ['Avg Profit Per Unit', avgProfitPerUnit, 'Per Item', 'Yield', 'Average gross profit earned per piece sold'],
        [],
        ['PRODUCT-BY-PRODUCT PROFITABILITY REGISTER', '', '', '', '', '', '', '', ''],
        ['#', 'PRODUCT NAME', 'CATEGORY', 'QTY SOLD', 'UNIT COST (KSH)', 'UNIT PRICE (KSH)', 'TOTAL COGS (KSH)', 'REVENUE (KSH)', 'GROSS PROFIT (KSH)', 'MARGIN %', 'MARKUP %'],
      ];

      filtered.forEach((i, idx) => {
        s1Data.push([
          idx + 1,
          i.name,
          i.category,
          i.qtySold,
          i.costPrice,
          i.sellingPrice,
          i.totalCost,
          i.revenue,
          i.profit,
          `${i.margin}%`,
          `${i.markup}%`,
        ]);
      });

      s1Data.push([]);
      s1Data.push([
        'AUDITED GRAND TOTALS',
        `${filtered.length} Products`,
        '',
        totalUnitsSold,
        '',
        '',
        totalCOGS,
        totalRevenue,
        grossProfit,
        `${overallMargin}%`,
        `${totalCOGS > 0 ? Math.round((grossProfit / totalCOGS) * 100) : 0}%`,
      ]);

      const ws1 = XLSX.utils.aoa_to_sheet(s1Data);
      ws1['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 10 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 10 } },
        { s: { r: 2, c: 0 }, e: { r: 2, c: 10 } },
        { s: { r: 4, c: 0 }, e: { r: 4, c: 4 } },
        { s: { r: 12, c: 0 }, e: { r: 12, c: 10 } },
      ];
      ws1['!cols'] = [
        { wch: 6 },
        { wch: 34 },
        { wch: 20 },
        { wch: 12 },
        { wch: 16 },
        { wch: 16 },
        { wch: 18 },
        { wch: 18 },
        { wch: 20 },
        { wch: 12 },
        { wch: 12 },
      ];

      // Styling: Title banner
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
          fill: { fgColor: { rgb: '059669' } },
          alignment: { horizontal: 'center', vertical: 'center' },
        };
      }

      XLSX.utils.book_append_sheet(wb, ws1, 'Profitability Master');

      // ── SHEET 2: Category Profit Matrix ──
      const s2Data: any[][] = [
        [`${(companyName || 'ALPHA RETAIL').toUpperCase()} — CATEGORY PROFITABILITY & MARGIN MATRIX`],
        [`Scope: ${dateFrom} to ${dateTo}`],
        [],
        ['CATEGORY', 'PRODUCTS', 'QTY SOLD', 'TOTAL COGS (KSH)', 'TOTAL REVENUE (KSH)', 'GROSS PROFIT (KSH)', 'MARGIN %', 'PROFIT SHARE %'],
      ];

      categoryMatrix.forEach((c) => {
        s2Data.push([
          c.category,
          c.itemCount,
          c.qtySold,
          c.totalCost,
          c.revenue,
          c.profit,
          `${c.margin}%`,
          `${c.profitSharePct}%`,
        ]);
      });

      const ws2 = XLSX.utils.aoa_to_sheet(s2Data);
      ws2['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 7 } },
      ];
      ws2['!cols'] = [
        { wch: 26 },
        { wch: 12 },
        { wch: 14 },
        { wch: 20 },
        { wch: 22 },
        { wch: 22 },
        { wch: 14 },
        { wch: 16 },
      ];
      XLSX.utils.book_append_sheet(wb, ws2, 'Category Profit Matrix');

      // ── SHEET 3: Margin Risk Watchlist ──
      const s3Data: any[][] = [
        [`${(companyName || 'ALPHA RETAIL').toUpperCase()} — MARGIN RISK & PRICING ALERT REGISTER`],
        ['PRODUCTS SELLING AT THIN (<10%) OR NEGATIVE MARGINS'],
        [],
        ['PRODUCT NAME', 'CATEGORY', 'QTY SOLD', 'UNIT COST (KSH)', 'SELLING PRICE (KSH)', 'REVENUE (KSH)', 'PROFIT / LOSS (KSH)', 'MARGIN %'],
      ];

      riskWatchItems.forEach((r) => {
        s3Data.push([
          r.name,
          r.category,
          r.qtySold,
          r.costPrice,
          r.sellingPrice,
          r.revenue,
          r.profit,
          `${r.margin}%`,
        ]);
      });

      const ws3 = XLSX.utils.aoa_to_sheet(s3Data);
      ws3['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 7 } }];
      ws3['!cols'] = [
        { wch: 34 },
        { wch: 20 },
        { wch: 12 },
        { wch: 16 },
        { wch: 18 },
        { wch: 18 },
        { wch: 20 },
        { wch: 12 },
      ];
      XLSX.utils.book_append_sheet(wb, ws3, 'Margin Risk Watchlist');

      XLSX.writeFile(wb, `Profit_Report_Executive_${toDay()}.xlsx`);
      toast.success('Ultra Super-Premium Excel workbook exported successfully!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to export Excel workbook');
    }
  };

  /* ─────────────────────────────────────────────────────────────────────────
     EXPORT RAW CSV REGISTER
     ───────────────────────────────────────────────────────────────────────── */
  const exportCSV = () => {
    try {
      const headers = ['Product', 'Category', 'Qty Sold', 'Unit Cost', 'Unit Price', 'COGS', 'Revenue', 'Profit', 'Margin %', 'Markup %'];
      const rows = filtered.map((i) => [
        `"${i.name}"`,
        `"${i.category}"`,
        i.qtySold,
        i.costPrice,
        i.sellingPrice,
        i.totalCost,
        i.revenue,
        i.profit,
        `"${i.margin}%"`,
        `"${i.markup}%"`,
      ].join(','));
      const csv = [headers.join(','), ...rows].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `profit_report_${dateFrom}_${dateTo}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('CSV exported successfully!');
    } catch {
      toast.error('Failed to export CSV');
    }
  };

  /* ─────────────────────────────────────────────────────────────────────────
     PRINT OFFICIAL EXECUTIVE STATEMENT
     ───────────────────────────────────────────────────────────────────────── */
  const printReport = () => {
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Executive Profit & Margin Statement - ${companyName}</title>
  <style>
    @page { size: A4 portrait; margin: 10mm; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #0f172a; margin: 0; padding: 10px; font-size: 11px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 12px; }
    .company { font-size: 18px; font-weight: 900; color: #0f172a; }
    .title { font-size: 13px; font-weight: 700; color: #059669; margin-top: 2px; }
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
      <div class="title">Product Profitability &amp; Cost of Goods Audit Statement</div>
      <div style="font-size: 10px; color: #64748b; margin-top: 3px;">
        Outlet: <strong>${outletDisplayName}</strong> &bull; Scope: <strong>${formatDate(dateFrom)} &mdash; ${formatDate(dateTo)}</strong>
      </div>
    </div>
    <div style="text-align: right; font-size: 10px; color: #64748b;">
      <div>Generated: <strong>${new Date().toLocaleString('en-KE')}</strong></div>
      <div>Audited Items: <strong>${filtered.length} products</strong></div>
    </div>
  </div>

  <div class="kpis">
    <div class="kpi">
      <div class="kpi-lbl">Total Gross Revenue</div>
      <div class="kpi-val">${fmtKES(totalRevenue)}</div>
    </div>
    <div class="kpi">
      <div class="kpi-lbl">Cost of Goods (COGS)</div>
      <div class="kpi-val" style="color: #dc2626;">${fmtKES(totalCOGS)}</div>
    </div>
    <div class="kpi">
      <div class="kpi-lbl">Gross Trading Profit</div>
      <div class="kpi-val" style="color: #059669;">${fmtKES(grossProfit)}</div>
    </div>
    <div class="kpi">
      <div class="kpi-lbl">Blended Margin Rate</div>
      <div class="kpi-val" style="color: #0284c7;">${overallMargin}%</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 20px;">#</th>
        <th>Product Name</th>
        <th>Category</th>
        <th class="text-center">Units Sold</th>
        <th class="text-right">Unit Cost</th>
        <th class="text-right">Unit Price</th>
        <th class="text-right">Total Revenue</th>
        <th class="text-right">Total COGS</th>
        <th class="text-right">Gross Profit</th>
        <th class="text-center">Margin</th>
      </tr>
    </thead>
    <tbody>
      ${filtered
        .map(
          (i, idx) => `
        <tr>
          <td>${idx + 1}</td>
          <td style="font-weight: 700;">${i.name}</td>
          <td>${i.category}</td>
          <td class="text-center" style="font-weight: 700;">${i.qtySold}</td>
          <td class="text-right">${fmtKES(i.costPrice)}</td>
          <td class="text-right">${fmtKES(i.sellingPrice)}</td>
          <td class="text-right" style="font-weight: 700;">${fmtKES(i.revenue)}</td>
          <td class="text-right" style="color: #dc2626;">${fmtKES(i.totalCost)}</td>
          <td class="text-right" style="font-weight: 800; font-family: monospace; color: ${i.profit >= 0 ? '#059669' : '#dc2626'};">${fmtKES(i.profit)}</td>
          <td class="text-center" style="font-weight: 700;">${i.margin}%</td>
        </tr>
      `
        )
        .join('')}
    </tbody>
    <tfoot>
      <tr style="background: #f8fafc; font-weight: 900; border-top: 2px solid #0f172a;">
        <td colspan="3">AUDITED GRAND TOTALS:</td>
        <td class="text-center">${totalUnitsSold} Pcs</td>
        <td colspan="2"></td>
        <td class="text-right">${fmtKES(totalRevenue)}</td>
        <td class="text-right" style="color: #dc2626;">${fmtKES(totalCOGS)}</td>
        <td class="text-right" style="color: #059669; font-size: 11px;">${fmtKES(grossProfit)}</td>
        <td class="text-center">${overallMargin}%</td>
      </tr>
    </tfoot>
  </table>

  <div class="footer">
    <div>Alpha Retail Executive POS • Official Profitability Audit Document</div>
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
      toast.error('Please allow popups to print report');
    }
  };

  /* ─────────────────────────────────────────────────────────────────────────
     HYDRATION SHIELD
     ───────────────────────────────────────────────────────────────────────── */
  if (!mounted) {
    return (
      <div className="w-full flex items-center justify-center py-24 min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Loading Executive Profit Ledger...</span>
        </div>
      </div>
    );
  }

  /* ─────────────────────────────────────────────────────────────────────────
     UI RENDER: EXECUTIVE ULTRA PROFIT REPORT
     ───────────────────────────────────────────────────────────────────────── */
  return (
    <div className="w-full max-w-full min-w-0 space-y-3 pb-12 text-slate-800 font-sans">
      <Toaster position="top-right" />

      {/* ━━━ 1. TOP EXECUTIVE COMMAND BAR ━━━ */}
      <div className="bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl shadow-xs px-3.5 py-2 transition-all">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Brand & Page Identifier */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-600 to-green-500 flex items-center justify-center text-white font-black shadow-xs">
              <FiTrendingUp size={16} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-black tracking-tight text-slate-900 whitespace-nowrap">
                  Product Profitability &amp; Cost of Goods Ledger
                </h1>
                <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  v3.0 Ultra
                </span>
                <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded-full bg-blue-50 text-blue-700 border border-blue-200 hidden sm:inline-flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" /> Live Margin Engine
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Outlet: <strong className="text-slate-600">{outletDisplayName}</strong> &bull; Scope: {formatDate(dateFrom)} &mdash; {formatDate(dateTo)}
              </p>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={loadData}
              disabled={loading}
              className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-2xs hover:border-slate-300 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Refresh Profit Data"
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
              <FiLayers size={12} className="text-slate-500" />
              <span>CSV</span>
            </button>

            <button
              onClick={printReport}
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
              { id: 'month', label: 'Month' },
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

          {/* Controls: Outlet, Category, Margin Tier, Sort, Search */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Outlet Selector */}
            <select
              value={selectedOutletId}
              onChange={(e) => setSelectedOutletId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="px-2.5 py-1 bg-emerald-50 border border-emerald-300 rounded-xl text-xs font-bold text-emerald-800 outline-none cursor-pointer"
            >
              <option value="all">🏪 All Outlets</option>
              {outlets.map((o) => (
                <option key={o.outlet_id} value={o.outlet_id}>
                  🏪 {o.outlet_name}
                </option>
              ))}
            </select>

            {/* Date Pickers */}
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

            {/* Category Filter */}
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none cursor-pointer max-w-[140px]"
            >
              <option value="All">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            {/* Margin Health Tier Filter */}
            <select
              value={filterMarginTier}
              onChange={(e) => setFilterMarginTier(e.target.value as any)}
              className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none cursor-pointer"
            >
              <option value="All">All Margin Tiers</option>
              <option value="High">High Margin (≥30%)</option>
              <option value="Medium">Medium (15-30%)</option>
              <option value="Thin">Thin (0-15%)</option>
              <option value="Loss">Loss Making (&lt;0%)</option>
            </select>

            {/* Sort By */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none cursor-pointer"
            >
              <option value="profit">Sort by Profit (Ksh)</option>
              <option value="margin">Sort by Margin %</option>
              <option value="revenue">Sort by Revenue (Ksh)</option>
              <option value="qty">Sort by Units Sold</option>
            </select>

            {/* Search Input */}
            <div className="relative">
              <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
              <input
                ref={searchInputRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search product (Ctrl+F)..."
                className="pl-7 pr-3 py-1 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-emerald-500 w-44"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ━━━ 2. EXECUTIVE 6-METRIC HUD DOCK ━━━ */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {/* 1. Gross Revenue */}
        <div className="bg-white rounded-2xl p-2.5 border border-slate-200/90 shadow-2xs hover:shadow-xs transition">
          <div className="flex items-center justify-between text-slate-400 mb-0.5">
            <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500">Gross Revenue</span>
            <div className="w-5 h-5 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
              <FiDollarSign size={11} />
            </div>
          </div>
          <p className="text-sm sm:text-base font-black text-slate-900 font-mono tracking-tight">{fmtK(totalRevenue)}</p>
          <p className="text-[10px] text-blue-600 font-bold mt-0.5">{fmtN(filtered.length)} products moving</p>
        </div>

        {/* 2. Total COGS */}
        <div className="bg-white rounded-2xl p-2.5 border border-slate-200/90 shadow-2xs hover:shadow-xs transition">
          <div className="flex items-center justify-between text-slate-400 mb-0.5">
            <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500">Total COGS</span>
            <div className="w-5 h-5 rounded-lg bg-rose-50 flex items-center justify-center text-rose-600">
              <FiPackage size={11} />
            </div>
          </div>
          <p className="text-sm sm:text-base font-black text-rose-700 font-mono tracking-tight">{fmtK(totalCOGS)}</p>
          <p className="text-[10px] text-slate-400 font-medium mt-0.5">Acquisition cost</p>
        </div>

        {/* 3. Gross Profit */}
        <div className="bg-white rounded-2xl p-2.5 border border-slate-200/90 shadow-2xs hover:shadow-xs transition">
          <div className="flex items-center justify-between text-slate-400 mb-0.5">
            <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500">Gross Profit</span>
            <div className="w-5 h-5 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
              <FiTrendingUp size={11} />
            </div>
          </div>
          <p className={`text-sm sm:text-base font-black font-mono tracking-tight ${grossProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
            {fmtK(grossProfit)}
          </p>
          <p className="text-[10px] text-emerald-600 font-bold mt-0.5">Net Trading Margin</p>
        </div>

        {/* 4. Blended Margin % */}
        <div className="bg-white rounded-2xl p-2.5 border border-slate-200/90 shadow-2xs hover:shadow-xs transition">
          <div className="flex items-center justify-between text-slate-400 mb-0.5">
            <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500">Margin Rate</span>
            <div className="w-5 h-5 rounded-lg bg-teal-50 flex items-center justify-center text-teal-600">
              <FiPercent size={11} />
            </div>
          </div>
          <p className="text-sm sm:text-base font-black text-teal-700 font-mono tracking-tight">{overallMargin}%</p>
          <p className="text-[10px] text-teal-600 font-bold mt-0.5">
            {overallMargin >= 25 ? 'Strong Margin' : overallMargin >= 15 ? 'Healthy Margin' : 'Thin Margin'}
          </p>
        </div>

        {/* 5. Units Sold */}
        <div className="bg-white rounded-2xl p-2.5 border border-slate-200/90 shadow-2xs hover:shadow-xs transition">
          <div className="flex items-center justify-between text-slate-400 mb-0.5">
            <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500">Units Settled</span>
            <div className="w-5 h-5 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
              <FiShoppingBag size={11} />
            </div>
          </div>
          <p className="text-sm sm:text-base font-black text-indigo-700 font-mono tracking-tight">{fmtN(totalUnitsSold)} Pcs</p>
          <p className="text-[10px] text-indigo-600 font-bold mt-0.5">Total units moved</p>
        </div>

        {/* 6. Avg Profit Per Unit */}
        <div className="bg-white rounded-2xl p-2.5 border border-slate-200/90 shadow-2xs hover:shadow-xs transition">
          <div className="flex items-center justify-between text-slate-400 mb-0.5">
            <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500">Yield Per Piece</span>
            <div className="w-5 h-5 rounded-lg bg-cyan-50 flex items-center justify-center text-cyan-600">
              <FiActivity size={11} />
            </div>
          </div>
          <p className="text-sm sm:text-base font-black text-cyan-700 font-mono tracking-tight">{fmt(avgProfitPerUnit)}</p>
          <p className="text-[10px] text-cyan-600 font-bold mt-0.5">Unit economics</p>
        </div>
      </div>

      {/* ━━━ 3. INTERACTIVE 4-VIEW CONTROLLER DOCK ━━━ */}
      <div className="flex items-center gap-1.5 border-b border-slate-200/80 pb-1 overflow-x-auto scrollbar-none">
        {[
          { id: 'table', label: '1. Product Profitability Datagrid', icon: FiLayers, count: `${filtered.length} Items` },
          { id: 'charts', label: '2. Linear Trends & Margin Charts', icon: FiBarChart2, count: '3 Visuals' },
          { id: 'categories', label: '3. Category Profitability Matrix', icon: FiPieChart, count: `${categoryMatrix.length} Categories` },
          { id: 'risk', label: '4. Margin Risk & Pricing Watch', icon: FiAlertTriangle, count: `${riskWatchItems.length} Warnings` },
        ].map((view) => {
          const Icon = view.icon;
          const isActive = activeView === view.id;
          return (
            <button
              key={view.id}
              onClick={() => setActiveView(view.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Icon size={13} className={isActive ? 'text-emerald-400' : 'text-slate-400'} />
              <span>{view.label}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                {view.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          VIEW 1: PRODUCT PROFITABILITY DATAGRID (SUPER DATAGRID)
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {activeView === 'table' && (
        <div className="space-y-3">
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
            {/* Table Container */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-700 font-bold uppercase text-[10px] border-b border-slate-200 tracking-wider">
                    <th className="py-2.5 px-3 w-10 text-center">#</th>
                    <th className="py-2.5 px-3">Product Name</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3 text-center">Units Sold</th>
                    <th className="py-2.5 px-3 text-right">Cost Price</th>
                    <th className="py-2.5 px-3 text-right">Selling Price</th>
                    <th className="py-2.5 px-3 text-right">Total COGS</th>
                    <th className="py-2.5 px-3 text-right">Gross Revenue</th>
                    <th className="py-2.5 px-3 text-right">Gross Profit</th>
                    <th className="py-2.5 px-3 text-center">Margin %</th>
                    <th className="py-2.5 px-3 text-center">Health Tier</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {loading ? (
                    <tr>
                      <td colSpan={11} className="py-16 text-center text-slate-400">
                        <div className="flex items-center justify-center gap-2">
                          <FiRefreshCw className="animate-spin text-emerald-600" size={16} />
                          <span>Computing profit margins and line items...</span>
                        </div>
                      </td>
                    </tr>
                  ) : paginatedItems.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-16 text-center text-slate-400">
                        <FiSearch size={28} className="mx-auto mb-2 text-slate-300" />
                        <p className="font-bold text-xs text-slate-600">No matching sales profit records found</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">Try widening the date range or clearing your filter.</p>
                      </td>
                    </tr>
                  ) : (
                    paginatedItems.map((item, idx) => {
                      const rowNum = (page - 1) * perPage + idx + 1;
                      const isNegative = item.profit < 0;
                      return (
                        <tr key={item.name} className={`hover:bg-slate-50/70 transition ${isNegative ? 'bg-rose-50/30' : ''}`}>
                          <td className="py-2 px-3 text-center font-bold text-slate-400 font-mono">{rowNum}</td>
                          <td className="py-2 px-3 font-bold text-slate-900">{item.name}</td>
                          <td className="py-2 px-3 text-slate-500 text-[11px] whitespace-nowrap">{item.category}</td>
                          <td className="py-2 px-3 text-center font-mono font-bold text-slate-800">{item.qtySold}</td>
                          <td className="py-2 px-3 text-right font-mono text-slate-600">{fmt(item.costPrice)}</td>
                          <td className="py-2 px-3 text-right font-mono text-slate-800 font-semibold">{fmt(item.sellingPrice)}</td>
                          <td className="py-2 px-3 text-right font-mono text-rose-700">{fmt(item.totalCost)}</td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">{fmt(item.revenue)}</td>
                          <td className={`py-2 px-3 text-right font-mono font-black ${isNegative ? 'text-rose-700' : 'text-emerald-700'}`}>
                            {fmt(item.profit)}
                          </td>
                          <td className="py-2 px-3 text-center font-mono font-bold">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                isNegative
                                  ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                  : item.margin >= 30
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                  : item.margin >= 15
                                  ? 'bg-cyan-100 text-cyan-800 border border-cyan-200'
                                  : 'bg-amber-100 text-amber-800 border border-amber-200'
                              }`}
                            >
                              {item.margin}%
                            </span>
                          </td>
                          <td className="py-2 px-3 text-center whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[9.5px] font-bold ${
                                isNegative
                                  ? 'bg-rose-100 text-rose-700 border border-rose-200'
                                  : item.margin >= 30
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : item.margin >= 15
                                  ? 'bg-cyan-50 text-cyan-700 border border-cyan-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}
                            >
                              {isNegative ? 'Loss' : item.margin >= 30 ? 'High' : item.margin >= 15 ? 'Healthy' : 'Thin'}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>

                {/* Grand Total Footer */}
                {filtered.length > 0 && (
                  <tfoot className="bg-slate-100/90 border-t-2 border-slate-300 font-bold text-slate-900 text-xs">
                    <tr>
                      <td colSpan={3} className="py-2.5 px-3 uppercase tracking-wider font-black">
                        GRAND TOTALS ({filtered.length} Products):
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-black text-slate-900">{totalUnitsSold} Pcs</td>
                      <td colSpan={2} className="py-2.5 px-3 text-center text-slate-400 font-mono">—</td>
                      <td className="py-2.5 px-3 text-right font-mono font-black text-rose-800">{fmt(totalCOGS)}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-black text-slate-900 bg-slate-200/50">{fmt(totalRevenue)}</td>
                      <td className={`py-2.5 px-3 text-right font-mono font-black text-sm ${grossProfit >= 0 ? 'text-emerald-800 bg-emerald-50' : 'text-rose-800 bg-rose-50'}`}>
                        {fmt(grossProfit)}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-black text-teal-800">{overallMargin}%</td>
                      <td className="py-2.5 px-3 text-center text-slate-500 text-[10px]">Audit Verified</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {/* Floating Compact Pagination Footer */}
            <div className="p-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500 bg-white">
              <div className="flex items-center gap-2">
                <span>Show</span>
                <select
                  value={perPage}
                  onChange={(e) => {
                    setPerPage(Number(e.target.value));
                    setPage(1);
                  }}
                  className="px-2 py-0.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 outline-none cursor-pointer"
                >
                  {PAGE_SIZES.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
                <span>
                  of <strong className="font-bold text-slate-800 font-mono">{filtered.length}</strong> items
                </span>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(1)}
                  disabled={page === 1}
                  className="p-1 rounded-lg border border-slate-200 bg-white disabled:opacity-30 hover:bg-slate-50 cursor-pointer"
                  title="First Page"
                >
                  <FiChevronsLeft size={12} />
                </button>
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1 rounded-lg border border-slate-200 bg-white disabled:opacity-30 hover:bg-slate-50 cursor-pointer"
                  title="Previous Page"
                >
                  <FiChevronLeft size={12} />
                </button>

                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pNum = i + 1;
                  if (totalPages > 5 && page > 3) {
                    pNum = Math.min(page - 2 + i, totalPages);
                  }
                  return (
                    <button
                      key={pNum}
                      onClick={() => setPage(pNum)}
                      className={`w-7 h-7 rounded-lg text-xs font-bold transition cursor-pointer ${
                        page === pNum
                          ? 'bg-emerald-600 text-white shadow-2xs font-black'
                          : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {pNum}
                    </button>
                  );
                })}

                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="p-1 rounded-lg border border-slate-200 bg-white disabled:opacity-30 hover:bg-slate-50 cursor-pointer"
                  title="Next Page"
                >
                  <FiChevronRight size={12} />
                </button>
                <button
                  onClick={() => setPage(totalPages)}
                  disabled={page >= totalPages}
                  className="p-1 rounded-lg border border-slate-200 bg-white disabled:opacity-30 hover:bg-slate-50 cursor-pointer"
                  title="Last Page"
                >
                  <FiChevronsRight size={12} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          VIEW 2: LINEAR TRENDS & MARGIN CHARTS
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {activeView === 'charts' && (
        <div className="space-y-3">
          {/* Row 1: Daily Revenue vs COGS vs Gross Profit Trend */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <FiTrendingUp className="text-emerald-600" />
                  Daily Revenue, COGS &amp; Gross Profit Spread (Linear Curve)
                </h3>
                <p className="text-[11px] text-slate-400">Comparing gross revenue generated against wholesale inventory cost and net profit</p>
              </div>
              <div className="flex items-center gap-3 text-[11px] font-bold">
                <span className="flex items-center gap-1 text-slate-900">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-900" /> Revenue
                </span>
                <span className="flex items-center gap-1 text-rose-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> COGS
                </span>
                <span className="flex items-center gap-1 text-emerald-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Profit
                </span>
              </div>
            </div>
            <div className="w-full h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyTrend} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <defs>
                    <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0F172A" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#0F172A" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="dayLabel" tick={{ fontSize: 9.5, fill: '#64748B' }} tickLine={false} axisLine={{ stroke: '#E2E8F0' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#64748B' }} tickLine={false} axisLine={false} tickFormatter={(v) => fmtK(v)} />
                  <RechartsTooltip
                    formatter={(val: any) => [fmtKES(val), '']}
                    contentStyle={{ backgroundColor: '#0F172A', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '11px' }}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#0F172A" strokeWidth={2} fillOpacity={1} fill="url(#revGrad)" name="Revenue" />
                  <Line type="monotone" dataKey="cogs" stroke="#EF4444" strokeWidth={2} dot={false} name="COGS" />
                  <Area type="monotone" dataKey="profit" stroke="#10B981" strokeWidth={2.5} fillOpacity={1} fill="url(#profitGrad)" name="Gross Profit" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Row 2: Category Profit Bar Chart & Margin Distribution Donut */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            {/* Category Profitability Bar Chart */}
            <div className="lg:col-span-2 bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <FiBarChart2 className="text-indigo-600" />
                    Gross Profit Generated by Category
                  </h3>
                  <p className="text-[11px] text-slate-400">Total profit contribution from merchandise categories</p>
                </div>
              </div>
              <div className="w-full h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryMatrix.slice(0, 8)} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                    <XAxis dataKey="category" tick={{ fontSize: 9.5, fill: '#64748B' }} tickLine={false} axisLine={{ stroke: '#E2E8F0' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#64748B' }} tickLine={false} axisLine={false} tickFormatter={(v) => fmtK(v)} />
                    <RechartsTooltip
                      formatter={(val: any) => [fmtKES(val), 'Profit']}
                      contentStyle={{ backgroundColor: '#0F172A', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '11px' }}
                    />
                    <Bar dataKey="profit" fill="#10B981" radius={[4, 4, 0, 0]} name="Gross Profit (Ksh)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Margin Distribution Donut */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs flex flex-col">
              <div className="mb-2">
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <FiPieChart className="text-teal-600" />
                  Margin Health Tiers
                </h3>
                <p className="text-[11px] text-slate-400">Revenue split by product margin band</p>
              </div>
              <div className="w-full h-40 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={marginTiers} cx="50%" cy="50%" innerRadius={38} outerRadius={62} paddingAngle={4} dataKey="value">
                      {marginTiers.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      formatter={(val: any) => [fmtKES(val), 'Revenue']}
                      contentStyle={{ backgroundColor: '#0F172A', borderRadius: '10px', border: 'none', color: '#fff', fontSize: '11px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1 mt-auto pt-2 border-t border-slate-100">
                {marginTiers.map((tier) => (
                  <div key={tier.name} className="flex items-center justify-between text-[11px]">
                    <span className="flex items-center gap-1.5 font-bold text-slate-700">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: tier.color }} />
                      {tier.name}
                    </span>
                    <span className="font-mono font-bold text-slate-900">
                      {tier.pct}% ({tier.count})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          VIEW 3: CATEGORY PROFITABILITY MATRIX
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {activeView === 'categories' && (
        <div className="space-y-3">
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <FiPieChart className="text-emerald-600" />
                  Category Contribution &amp; Profit Yield Matrix
                </h3>
                <p className="text-[11px] text-slate-400">Analysis of margins, COGS and share of gross profit generated by merchandise category</p>
              </div>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                {categoryMatrix.length} Categories
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] border-b border-slate-200 tracking-wider">
                    <th className="py-2.5 px-3">Category Name</th>
                    <th className="py-2.5 px-3 text-center">Items Sold</th>
                    <th className="py-2.5 px-3 text-center">Units Moved</th>
                    <th className="py-2.5 px-3 text-right">Total COGS</th>
                    <th className="py-2.5 px-3 text-right">Total Revenue</th>
                    <th className="py-2.5 px-3 text-right">Gross Profit</th>
                    <th className="py-2.5 px-3 text-center">Margin %</th>
                    <th className="py-2.5 px-3 text-center">Profit Share %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {categoryMatrix.map((cat) => (
                    <tr key={cat.category} className="hover:bg-slate-50/60 transition">
                      <td className="py-2.5 px-3 font-bold text-slate-900">{cat.category}</td>
                      <td className="py-2.5 px-3 text-center font-mono">{cat.itemCount}</td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold">{cat.qtySold} Pcs</td>
                      <td className="py-2.5 px-3 text-right font-mono text-rose-700">{fmt(cat.totalCost)}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">{fmt(cat.revenue)}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-black text-emerald-700">{fmt(cat.profit)}</td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {cat.margin}%
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
                          {cat.profitSharePct}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          VIEW 4: MARGIN RISK & PRICING WATCHLIST
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {activeView === 'risk' && (
        <div className="space-y-3">
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 bg-rose-50/50 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-black text-rose-900 uppercase tracking-wider flex items-center gap-1.5">
                  <FiAlertTriangle className="text-rose-600" />
                  Margin Risk Watchlist (Low &amp; Negative Margin Items)
                </h3>
                <p className="text-[11px] text-slate-500">Products selling below replacement cost or at thin margins (&lt;10%) that erode profitability</p>
              </div>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-rose-100 text-rose-800 border border-rose-300">
                {riskWatchItems.length} Products Requiring Price Adjustment
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
                    <th className="py-2.5 px-3 text-right">Unit Cost</th>
                    <th className="py-2.5 px-3 text-right">Selling Price</th>
                    <th className="py-2.5 px-3 text-right">Total Revenue</th>
                    <th className="py-2.5 px-3 text-right">Gross Profit / Loss</th>
                    <th className="py-2.5 px-3 text-center">Margin %</th>
                    <th className="py-2.5 px-3 text-center">Action Recommended</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {riskWatchItems.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-slate-400">
                        <FiCheckCircle size={32} className="mx-auto mb-2 text-emerald-400" />
                        <p className="font-bold text-xs text-slate-700">No high-risk or loss-making products detected!</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">All products are selling above a 10% gross profit margin.</p>
                      </td>
                    </tr>
                  ) : (
                    riskWatchItems.map((item, idx) => {
                      const isLoss = item.profit < 0;
                      return (
                        <tr key={item.name} className={`hover:bg-rose-50/30 transition ${isLoss ? 'bg-rose-50/60' : ''}`}>
                          <td className="py-2.5 px-3 text-center font-bold text-slate-400 font-mono">{idx + 1}</td>
                          <td className="py-2.5 px-3 font-bold text-slate-900">{item.name}</td>
                          <td className="py-2.5 px-3 text-slate-500 text-[11px]">{item.category}</td>
                          <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-800">{item.qtySold}</td>
                          <td className="py-2.5 px-3 text-right font-mono text-rose-700 font-semibold">{fmt(item.costPrice)}</td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-800">{fmt(item.sellingPrice)}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold">{fmt(item.revenue)}</td>
                          <td className={`py-2.5 px-3 text-right font-mono font-black ${isLoss ? 'text-rose-700' : 'text-amber-700'}`}>
                            {fmt(item.profit)}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-bold">
                            <span className={`px-2 py-0.5 rounded text-[10px] ${isLoss ? 'bg-rose-200 text-rose-900 font-black' : 'bg-amber-100 text-amber-800'}`}>
                              {item.margin}%
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[9.5px] font-bold ${isLoss ? 'bg-rose-100 text-rose-800 border border-rose-300' : 'bg-amber-50 text-amber-800 border border-amber-200'}`}>
                              {isLoss ? 'Increase Price Immediately' : 'Review Markup'}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
