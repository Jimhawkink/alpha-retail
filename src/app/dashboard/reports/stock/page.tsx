'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';
import { useCompanyName } from '@/context/SettingsContext';
import toast, { Toaster } from 'react-hot-toast';
import {
  ResponsiveContainer,
  ComposedChart,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  FiBox,
  FiPackage,
  FiTrendingUp,
  FiTrendingDown,
  FiAlertTriangle,
  FiAlertCircle,
  FiCheckCircle,
  FiXCircle,
  FiDollarSign,
  FiShoppingBag,
  FiSearch,
  FiFilter,
  FiDownload,
  FiPrinter,
  FiRefreshCw,
  FiCalendar,
  FiClock,
  FiLayers,
  FiSliders,
  FiEye,
  FiEdit2,
  FiPlus,
  FiArrowRight,
  FiArrowUpRight,
  FiArrowDownRight,
  FiActivity,
  FiPieChart as FiPieChartIcon,
  FiBarChart2,
  FiCheck,
  FiX,
  FiChevronLeft,
  FiChevronRight,
  FiChevronsLeft,
  FiChevronsRight,
  FiFileText,
  FiCopy,
  FiTruck,
  FiTag,
  FiPercent,
  FiShield,
} from 'react-icons/fi';

/* ══════════════════════════════════════════════════════════════════════════════
   TYPES & INTERFACES
   ══════════════════════════════════════════════════════════════════════════════ */
interface StockItem {
  pid: number;
  product_name: string;
  product_code: string;
  barcode: string;
  category: string;
  supplier_name: string;
  purchase_unit: string;
  sales_unit: string;
  purchase_cost: number;
  sales_cost: number;
  margin_per: number;
  reorder_point: number;
  // Computed inventory balances
  stock_qty: number;
  total_inflow: number;
  total_outflow: number;
  movements_count: number;
  last_movement_date: string | null;
  // Valuations
  cost_value: number;
  retail_value: number;
  projected_profit: number;
  effective_margin: number;
  status: 'ok' | 'low' | 'critical' | 'out' | 'negative';
}

interface StockMovementRow {
  st_id: number;
  pid: number;
  product_name?: string;
  product_code?: string;
  barcode?: string;
  category?: string;
  invoice_no: string;
  qty: number;
  storage_type: string;
  notes: string | null;
  created_at: string;
}

interface MovementDailyPoint {
  date: string;
  displayDate: string;
  inflow: number;
  outflow: number;
  net: number;
}

const PIE_COLORS = ['#10B981', '#F59E0B', '#EF4444', '#64748B', '#8B5CF6'];

/* ══════════════════════════════════════════════════════════════════════════════
   FORMATTERS
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

const fmtN = (n: number) => (n || 0).toLocaleString('en-KE');

const safeDate = (val: any): Date | null => {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
};

const formatDate = (val: string | null | undefined) => {
  if (!val) return '—';
  const dt = safeDate(val);
  if (!dt) return val;
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatDateTime = (val: string | null | undefined) => {
  if (!val) return '—';
  const dt = safeDate(val);
  if (!dt) return val;
  return dt.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/* ══════════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════════════════════════ */
export default function StockReportPage() {
  const [mounted, setMounted] = useState(false);
  const { activeOutlet } = useOutlet();
  const outletId = activeOutlet?.outlet_id || 1;
  const companyName = useCompanyName();

  // Primary Data
  const [items, setItems] = useState<StockItem[]>([]);
  const [recentMovements, setRecentMovements] = useState<StockMovementRow[]>([]);
  const [dailyMovementPoints, setDailyMovementPoints] = useState<MovementDailyPoint[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [suppliersList, setSuppliersList] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Active Workspace Tab
  const [activeTab, setActiveTab] = useState<'inventory' | 'movement-charts' | 'history-ledger' | 'reorder-watch' | 'category-analytics'>('inventory');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [filterSupplier, setFilterSupplier] = useState<string>('All');
  const [filterValueRange, setFilterValueRange] = useState<string>('All');
  const [sortBy, setSortBy] = useState<string>('value_desc');
  const [movementDays, setMovementDays] = useState<number>(30);

  // Pagination
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);

  // Modals & Drawers
  const [viewingItem, setViewingItem] = useState<StockItem | null>(null);
  const [viewingItemMovements, setViewingItemMovements] = useState<StockMovementRow[]>([]);
  const [loadingItemMovements, setLoadingItemMovements] = useState(false);
  const [adjustingItem, setAdjustingItem] = useState<StockItem | null>(null);
  const [adjustQty, setAdjustQty] = useState<number>(1);
  const [adjustType, setAdjustType] = useState<'add' | 'deduct'>('add');
  const [adjustReason, setAdjustReason] = useState<string>('Physical Stocktake Correction');
  const [adjustNotes, setAdjustNotes] = useState<string>('');
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Hydration Guard
  useEffect(() => {
    setMounted(true);
  }, []);

  // Keyboard shortcut Ctrl+F
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

  /* ─────────────────────────────────────────────────────────────────────────
     LOAD COMPLETE STOCK INTELLIGENCE & MOVEMENTS
     ───────────────────────────────────────────────────────────────────────── */
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. Fetch active products (up to 5000)
      let productsQ = supabase
        .from('retail_products')
        .select('pid, product_code, product_name, barcode, category, purchase_cost, sales_cost, margin_per, reorder_point, purchase_unit, sales_unit, supplier_name, active, outlet_id')
        .eq('active', true)
        .order('product_name')
        .limit(5000);

      if (outletId) {
        productsQ = productsQ.eq('outlet_id', outletId);
      }

      const { data: productsData, error: prodErr } = await productsQ;
      if (prodErr) throw prodErr;

      const products = productsData || [];

      // 2. Fetch stock ledger entries (up to 40,000 in parallel/limit)
      let stockQ = supabase
        .from('retail_stock')
        .select('st_id, pid, qty, invoice_no, storage_type, notes, created_at')
        .order('created_at', { ascending: false })
        .limit(40000);

      if (outletId) {
        stockQ = stockQ.eq('outlet_id', outletId);
      }

      const { data: stockData, error: stockErr } = await stockQ;
      if (stockErr) throw stockErr;

      const rawStockRows: StockMovementRow[] = stockData || [];

      // 3. Build product map for lookups
      const prodLookup = new Map<number, any>();
      products.forEach((p) => prodLookup.set(p.pid, p));

      // 4. Aggregate stock metrics per product
      const stockBalanceMap = new Map<number, number>();
      const inflowMap = new Map<number, number>();
      const outflowMap = new Map<number, number>();
      const countMap = new Map<number, number>();
      const lastDateMap = new Map<number, string>();

      // 5. Build daily movement trends
      const dailyMap = new Map<string, { inflow: number; outflow: number }>();

      rawStockRows.forEach((row) => {
        const pid = row.pid;
        const q = Number(row.qty) || 0;

        // Current balance sum
        stockBalanceMap.set(pid, (stockBalanceMap.get(pid) || 0) + q);
        countMap.set(pid, (countMap.get(pid) || 0) + 1);

        if (q > 0) {
          inflowMap.set(pid, (inflowMap.get(pid) || 0) + q);
        } else if (q < 0) {
          outflowMap.set(pid, (outflowMap.get(pid) || 0) + Math.abs(q));
        }

        if (row.created_at) {
          const dtStr = row.created_at.split('T')[0];
          if (!lastDateMap.has(pid)) {
            lastDateMap.set(pid, row.created_at);
          }

          if (!dailyMap.has(dtStr)) {
            dailyMap.set(dtStr, { inflow: 0, outflow: 0 });
          }
          const pt = dailyMap.get(dtStr)!;
          if (q > 0) pt.inflow += q;
          else if (q < 0) pt.outflow += Math.abs(q);
        }
      });

      // 6. Enrich movement rows with product metadata for history ledger
      const enrichedMovements: StockMovementRow[] = rawStockRows.slice(0, 1500).map((row) => {
        const p = prodLookup.get(row.pid);
        return {
          ...row,
          product_name: p?.product_name || `Product #${row.pid}`,
          product_code: p?.product_code || '—',
          barcode: p?.barcode || '—',
          category: p?.category || 'General',
        };
      });
      setRecentMovements(enrichedMovements);

      // 7. Format Daily Movement Points for linear charts (sorted chronologically)
      const sortedDailyDates = Array.from(dailyMap.keys()).sort();
      // Cut to selected timeframe (e.g. last 30 days)
      const recentDates = sortedDailyDates.slice(-30);
      const points: MovementDailyPoint[] = recentDates.map((dt) => {
        const data = dailyMap.get(dt)!;
        const dObj = new Date(dt);
        const displayDate = isNaN(dObj.getTime())
          ? dt
          : dObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
        return {
          date: dt,
          displayDate,
          inflow: Math.round(data.inflow),
          outflow: Math.round(data.outflow),
          net: Math.round(data.inflow - data.outflow),
        };
      });
      setDailyMovementPoints(points);

      // 8. Compile Master Stock Items
      const compiledItems: StockItem[] = products.map((p) => {
        const currentStock = stockBalanceMap.get(p.pid) ?? 0;
        const reorder = Number(p.reorder_point) || 5;
        const cost = Number(p.purchase_cost) || 0;
        const price = Number(p.sales_cost) || 0;

        let status: StockItem['status'] = 'ok';
        if (currentStock < 0) status = 'negative';
        else if (currentStock === 0) status = 'out';
        else if (currentStock <= Math.max(1, Math.round(reorder * 0.4))) status = 'critical';
        else if (currentStock <= reorder) status = 'low';

        const costVal = currentStock > 0 ? currentStock * cost : 0;
        const retailVal = currentStock > 0 ? currentStock * price : 0;
        const profit = retailVal - costVal;
        const effMargin = retailVal > 0 ? (profit / retailVal) * 100 : Number(p.margin_per) || 0;

        return {
          pid: p.pid,
          product_name: p.product_name || 'Unnamed Product',
          product_code: p.product_code || '—',
          barcode: p.barcode || '—',
          category: p.category || 'General',
          supplier_name: p.supplier_name || 'Default Supplier',
          purchase_unit: p.purchase_unit || 'Piece',
          sales_unit: p.sales_unit || 'Piece',
          purchase_cost: cost,
          sales_cost: price,
          margin_per: Number(p.margin_per) || 0,
          reorder_point: reorder,
          stock_qty: currentStock,
          total_inflow: inflowMap.get(p.pid) || 0,
          total_outflow: outflowMap.get(p.pid) || 0,
          movements_count: countMap.get(p.pid) || 0,
          last_movement_date: lastDateMap.get(p.pid) || null,
          cost_value: costVal,
          retail_value: retailVal,
          projected_profit: profit,
          effective_margin: effMargin,
          status,
        };
      });

      // Natural initial sort: highest stock value first
      compiledItems.sort((a, b) => b.cost_value - a.cost_value);

      setItems(compiledItems);

      // Unique categories & suppliers
      const cats = Array.from(new Set(compiledItems.map((i) => i.category).filter(Boolean))).sort();
      const supps = Array.from(new Set(compiledItems.map((i) => i.supplier_name).filter(Boolean))).sort();
      setCategories(cats);
      setSuppliersList(supps);
    } catch (err: any) {
      console.error('Stock load error:', err);
      toast.error('Failed to load inventory valuation telemetry');
    } finally {
      setIsLoading(false);
    }
  }, [outletId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /* ─────────────────────────────────────────────────────────────────────────
     FETCH SPECIFIC PRODUCT MOVEMENT HISTORY
     ───────────────────────────────────────────────────────────────────────── */
  const openProductDossier = async (item: StockItem) => {
    setViewingItem(item);
    setLoadingItemMovements(true);
    try {
      let q = supabase
        .from('retail_stock')
        .select('*')
        .eq('pid', item.pid)
        .order('created_at', { ascending: false })
        .limit(200);

      if (outletId) q = q.eq('outlet_id', outletId);

      const { data, error } = await q;
      if (!error && data) {
        setViewingItemMovements(data);
      } else {
        setViewingItemMovements([]);
      }
    } catch {
      setViewingItemMovements([]);
    } finally {
      setLoadingItemMovements(false);
    }
  };

  /* ─────────────────────────────────────────────────────────────────────────
     QUICK STOCK ADJUSTMENT HANDLER
     ───────────────────────────────────────────────────────────────────────── */
  const handleQuickAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingItem) return;
    if (adjustQty <= 0) {
      toast.error('Adjustment quantity must be greater than zero');
      return;
    }

    setIsAdjusting(true);
    try {
      const signedQty = adjustType === 'add' ? adjustQty : -adjustQty;
      const notes = [adjustReason, adjustNotes.trim()].filter(Boolean).join(' — ');

      const { error } = await supabase.from('retail_stock').insert({
        pid: adjustingItem.pid,
        outlet_id: outletId,
        invoice_no: 'ADJ',
        qty: signedQty,
        storage_type: adjustingItem.sales_unit || 'Pieces',
        notes: notes || 'Manual Stock Adjustment',
        created_at: new Date().toISOString(),
      });

      if (error) throw error;

      toast.success(
        `Stock adjusted! ${signedQty > 0 ? `+${signedQty}` : signedQty} ${adjustingItem.sales_unit} for ${
          adjustingItem.product_name
        }`
      );

      // Optimistic state update
      setItems((prev) =>
        prev.map((it) => {
          if (it.pid === adjustingItem.pid) {
            const nextStock = it.stock_qty + signedQty;
            const costVal = nextStock > 0 ? nextStock * it.purchase_cost : 0;
            const retailVal = nextStock > 0 ? nextStock * it.sales_cost : 0;
            return {
              ...it,
              stock_qty: nextStock,
              cost_value: costVal,
              retail_value: retailVal,
              projected_profit: retailVal - costVal,
              status:
                nextStock <= 0
                  ? 'out'
                  : nextStock <= it.reorder_point * 0.4
                  ? 'critical'
                  : nextStock <= it.reorder_point
                  ? 'low'
                  : 'ok',
            };
          }
          return it;
        })
      );

      setAdjustingItem(null);
      setAdjustQty(1);
      setAdjustNotes('');
      // Refresh background
      loadData();
    } catch (err: any) {
      console.error('Adjustment error:', err);
      toast.error(err.message || 'Failed to adjust stock');
    } finally {
      setIsAdjusting(false);
    }
  };

  const copyText = (txt: string, label: string) => {
    if (!txt) return;
    navigator.clipboard.writeText(txt);
    setCopiedText(txt);
    toast.success(`Copied ${label}: ${txt}`);
    setTimeout(() => setCopiedText(null), 2000);
  };

  /* ─────────────────────────────────────────────────────────────────────────
     FILTERING & SORTING PIPELINE
     ───────────────────────────────────────────────────────────────────────── */
  const filteredItems = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    let res = items.filter((it) => {
      // Search across name, code, barcode, category, supplier
      if (q) {
        const hay = [it.product_name, it.product_code, it.barcode, it.category, it.supplier_name]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }

      // Status
      if (filterStatus === 'ok' && it.status !== 'ok') return false;
      if (filterStatus === 'low' && it.status !== 'low') return false;
      if (filterStatus === 'critical' && it.status !== 'critical') return false;
      if (filterStatus === 'out' && it.status !== 'out') return false;
      if (filterStatus === 'negative' && it.status !== 'negative') return false;
      if (filterStatus === 'needs_reorder' && !['low', 'critical', 'out', 'negative'].includes(it.status)) return false;

      // Category
      if (filterCategory !== 'All' && it.category !== filterCategory) return false;

      // Supplier
      if (filterSupplier !== 'All' && it.supplier_name !== filterSupplier) return false;

      // Value range
      if (filterValueRange === 'high' && it.cost_value < 50000) return false;
      if (filterValueRange === 'medium' && (it.cost_value < 10000 || it.cost_value >= 50000)) return false;
      if (filterValueRange === 'low' && it.cost_value >= 10000) return false;

      return true;
    });

    // Sort
    res.sort((a, b) => {
      if (sortBy === 'value_desc') return b.cost_value - a.cost_value;
      if (sortBy === 'value_asc') return a.cost_value - b.cost_value;
      if (sortBy === 'qty_desc') return b.stock_qty - a.stock_qty;
      if (sortBy === 'qty_asc') return a.stock_qty - b.stock_qty;
      if (sortBy === 'retail_desc') return b.retail_value - a.retail_value;
      if (sortBy === 'profit_desc') return b.projected_profit - a.projected_profit;
      if (sortBy === 'margin_desc') return b.effective_margin - a.effective_margin;
      if (sortBy === 'name_asc') return a.product_name.localeCompare(b.product_name);
      if (sortBy === 'name_desc') return b.product_name.localeCompare(a.product_name);
      return 0;
    });

    return res;
  }, [items, searchQuery, filterStatus, filterCategory, filterSupplier, filterValueRange, sortBy]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / perPage));
  const paginatedItems = useMemo(() => {
    return filteredItems.slice((page - 1) * perPage, page * perPage);
  }, [filteredItems, page, perPage]);

  // Reset page on filter changes
  useEffect(() => {
    setPage(1);
  }, [searchQuery, filterStatus, filterCategory, filterSupplier, filterValueRange, sortBy, perPage]);

  /* ─────────────────────────────────────────────────────────────────────────
     EXECUTIVE 8-METRIC COMMAND DOCK
     ───────────────────────────────────────────────────────────────────────── */
  const metrics = useMemo(() => {
    const totalSKUs = items.length;
    const totalUnitsOnHand = items.reduce((s, it) => s + (it.stock_qty > 0 ? it.stock_qty : 0), 0);
    const totalCostValue = items.reduce((s, it) => s + it.cost_value, 0);
    const totalRetailValue = items.reduce((s, it) => s + it.retail_value, 0);
    const totalProjectedProfit = totalRetailValue - totalCostValue;
    const avgMarkup = totalCostValue > 0 ? (totalProjectedProfit / totalCostValue) * 100 : 0;

    const inStockCount = items.filter((it) => it.status === 'ok').length;
    const lowStockCount = items.filter((it) => it.status === 'low').length;
    const criticalCount = items.filter((it) => it.status === 'critical').length;
    const outOfStockCount = items.filter((it) => it.status === 'out').length;
    const negativeCount = items.filter((it) => it.status === 'negative').length;

    // Capital tied in reorder deficit
    const deficitItems = items.filter((it) => it.stock_qty < it.reorder_point);
    const replenishmentCapitalRequired = deficitItems.reduce((s, it) => {
      const def = Math.max(0, it.reorder_point - it.stock_qty);
      return s + def * it.purchase_cost;
    }, 0);

    return {
      totalSKUs,
      totalUnitsOnHand,
      totalCostValue,
      totalRetailValue,
      totalProjectedProfit,
      avgMarkup,
      inStockCount,
      lowStockCount,
      criticalCount,
      outOfStockCount,
      negativeCount,
      replenishmentCapitalRequired,
      deficitItemsCount: deficitItems.length,
    };
  }, [items]);

  /* ─────────────────────────────────────────────────────────────────────────
     CATEGORY VALUATION BREAKDOWN FOR CHARTS & TAB
     ───────────────────────────────────────────────────────────────────────── */
  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, { skus: number; units: number; costVal: number; retailVal: number }>();
    items.forEach((it) => {
      const cat = it.category || 'General';
      if (!map.has(cat)) {
        map.set(cat, { skus: 0, units: 0, costVal: 0, retailVal: 0 });
      }
      const c = map.get(cat)!;
      c.skus += 1;
      c.units += Math.max(0, it.stock_qty);
      c.costVal += it.cost_value;
      c.retailVal += it.retail_value;
    });

    const arr = Array.from(map.entries()).map(([category, d]) => {
      const profit = d.retailVal - d.costVal;
      const margin = d.retailVal > 0 ? (profit / d.retailVal) * 100 : 0;
      const share = metrics.totalCostValue > 0 ? (d.costVal / metrics.totalCostValue) * 100 : 0;
      return {
        category,
        skus: d.skus,
        units: Math.round(d.units),
        costVal: Math.round(d.costVal),
        retailVal: Math.round(d.retailVal),
        profit: Math.round(profit),
        margin: Math.round(margin * 10) / 10,
        share: Math.round(share * 10) / 10,
      };
    });

    return arr.sort((a, b) => b.costVal - a.costVal);
  }, [items, metrics.totalCostValue]);

  // Inventory Health Pie Chart Data
  const healthPieData = useMemo(() => {
    return [
      { name: 'In Stock (Healthy)', value: metrics.inStockCount, color: '#10B981' },
      { name: 'Low Stock Alert', value: metrics.lowStockCount, color: '#F59E0B' },
      { name: 'Critical Stock', value: metrics.criticalCount, color: '#F97316' },
      { name: 'Out of Stock (Zero)', value: metrics.outOfStockCount, color: '#EF4444' },
      { name: 'Negative Balance', value: metrics.negativeCount, color: '#64748B' },
    ].filter((p) => p.value > 0);
  }, [metrics]);

  /* ─────────────────────────────────────────────────────────────────────────
     SUPER ULTRA-PREMIUM MULTI-SHEET EXCEL EXPORT (.XLSX)
     ───────────────────────────────────────────────────────────────────────── */
  const exportExcel = async () => {
    try {
      const XLSX = (await import('xlsx-js-style')).default || (await import('xlsx-js-style'));
      const wb = XLSX.utils.book_new();

      // ── SHEET 1: Master Inventory Valuation & Audit Ledger ──
      const s1Data: any[][] = [];
      const title = `${(companyName || 'ALPHA RETAIL').toUpperCase()} — ${(activeOutlet?.outlet_name || 'MAIN OUTLET').toUpperCase()}`;
      s1Data.push([title]);
      s1Data.push(['MASTER INVENTORY VALUATION & STOCK TELEMETRY REGISTER']);
      s1Data.push([
        `Generated: ${new Date().toLocaleString('en-KE')}  |  Catalog SKUs: ${filteredItems.length}  |  Asset Valuation: Ksh ${metrics.totalCostValue.toLocaleString()}  |  Projected Turnover: Ksh ${metrics.totalRetailValue.toLocaleString()}`,
      ]);
      s1Data.push([]);

      // Column Headers
      const headers = [
        '#',
        'BARCODE',
        'PRODUCT CODE',
        'PRODUCT NAME',
        'CATEGORY',
        'PREFERRED SUPPLIER',
        'PURCHASE UNIT',
        'SALES UNIT',
        'STOCK ON HAND',
        'REORDER LEVEL',
        'UNIT COST (KSH)',
        'SELLING PRICE (KSH)',
        'GROSS MARGIN %',
        'TOTAL COST VALUE (KSH)',
        'POTENTIAL RETAIL VALUE (KSH)',
        'PROJECTED PROFIT (KSH)',
        'STOCK STATUS',
      ];
      s1Data.push(headers);

      filteredItems.forEach((it, idx) => {
        s1Data.push([
          idx + 1,
          it.barcode || '—',
          it.product_code || '—',
          it.product_name,
          it.category,
          it.supplier_name,
          it.purchase_unit,
          it.sales_unit,
          it.stock_qty,
          it.reorder_point,
          Number(it.purchase_cost),
          Number(it.sales_cost),
          `${it.effective_margin.toFixed(1)}%`,
          Number(it.cost_value),
          Number(it.retail_value),
          Number(it.projected_profit),
          it.status.toUpperCase(),
        ]);
      });

      // Spacer & Grand Totals
      s1Data.push([]);
      const sumFilteredQty = filteredItems.reduce((s, it) => s + it.stock_qty, 0);
      const sumFilteredCost = filteredItems.reduce((s, it) => s + it.cost_value, 0);
      const sumFilteredRetail = filteredItems.reduce((s, it) => s + it.retail_value, 0);
      const sumFilteredProfit = sumFilteredRetail - sumFilteredCost;

      s1Data.push([
        'GRAND TOTAL REGISTER',
        '',
        '',
        '',
        '',
        '',
        '',
        `${filteredItems.length} SKUs`,
        sumFilteredQty,
        '',
        '',
        '',
        'TOTALS',
        sumFilteredCost,
        sumFilteredRetail,
        sumFilteredProfit,
        'AUDITED',
      ]);

      const ws1 = XLSX.utils.aoa_to_sheet(s1Data);

      // Sheet 1 Styling & Merges
      ws1['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 16 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 16 } },
        { s: { r: 2, c: 0 }, e: { r: 2, c: 16 } },
        { s: { r: s1Data.length - 1, c: 0 }, e: { r: s1Data.length - 1, c: 6 } },
      ];

      // Auto-fit Column widths
      ws1['!cols'] = [
        { wch: 6 },  // #
        { wch: 16 }, // Barcode
        { wch: 14 }, // Code
        { wch: 34 }, // Name
        { wch: 18 }, // Category
        { wch: 22 }, // Supplier
        { wch: 14 }, // Purchase Unit
        { wch: 14 }, // Sales Unit
        { wch: 14 }, // Stock Qty
        { wch: 14 }, // Reorder Level
        { wch: 16 }, // Unit Cost
        { wch: 16 }, // Selling Price
        { wch: 14 }, // Margin %
        { wch: 22 }, // Total Cost Value
        { wch: 24 }, // Total Retail Value
        { wch: 22 }, // Projected Profit
        { wch: 14 }, // Status
      ];

      // Row heights
      const rHeights: any[] = [
        { hpt: 38 }, // Title
        { hpt: 24 }, // Subtitle
        { hpt: 20 }, // Meta
        { hpt: 12 }, // Spacer
        { hpt: 26 }, // Headers
      ];
      for (let i = 0; i < filteredItems.length; i++) rHeights.push({ hpt: 20 });
      rHeights.push({ hpt: 12 });
      rHeights.push({ hpt: 28 }); // Grand total
      ws1['!rows'] = rHeights;

      // Header Fill & Fonts
      if (ws1['A1']) {
        ws1['A1'].s = {
          font: { name: 'Calibri', sz: 16, bold: true, color: { rgb: 'FFFFFF' } },
          fill: { fgColor: { rgb: '091D3E' } },
          alignment: { horizontal: 'center', vertical: 'center' },
        };
      }
      if (ws1['A2']) {
        ws1['A2'].s = {
          font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
          fill: { fgColor: { rgb: '1E40AF' } },
          alignment: { horizontal: 'center', vertical: 'center' },
        };
      }
      if (ws1['A3']) {
        ws1['A3'].s = {
          font: { name: 'Calibri', sz: 9.5, bold: true, color: { rgb: '1E293B' } },
          fill: { fgColor: { rgb: 'E2E8F0' } },
          alignment: { horizontal: 'center', vertical: 'center' },
        };
      }

      // Column header cells (row 5)
      const colLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q'];
      colLetters.forEach((col) => {
        const ref = `${col}5`;
        if (ws1[ref]) {
          ws1[ref].s = {
            font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: 'FFFFFF' } },
            fill: { fgColor: { rgb: '0F172A' } },
            alignment: { horizontal: 'center', vertical: 'center' },
            border: { bottom: { style: 'medium', color: { rgb: '00E676' } } },
          };
        }
      });

      XLSX.utils.book_append_sheet(wb, ws1, 'Stock Valuation Master');

      // ── SHEET 2: Reorder & Replenishment Deficit Watchlist ──
      const s2Data: any[][] = [];
      s2Data.push([title]);
      s2Data.push(['INVENTORY REORDER DEFICIT & REPLENISHMENT WATCHLIST']);
      s2Data.push([`Estimated Capital Required: Ksh ${metrics.replenishmentCapitalRequired.toLocaleString()}`]);
      s2Data.push([]);
      s2Data.push([
        '#',
        'PRODUCT NAME',
        'CATEGORY',
        'PREFERRED SUPPLIER',
        'CURRENT STOCK',
        'REORDER LEVEL',
        'DEFICIT UNITS',
        'ESTIMATED UNIT COST (KSH)',
        'CAPITAL REQUIRED (KSH)',
        'STATUS',
      ]);

      const deficitList = items.filter((it) => it.stock_qty <= it.reorder_point);
      deficitList.forEach((it, idx) => {
        const def = Math.max(0, it.reorder_point - it.stock_qty);
        s2Data.push([
          idx + 1,
          it.product_name,
          it.category,
          it.supplier_name,
          it.stock_qty,
          it.reorder_point,
          def,
          it.purchase_cost,
          def * it.purchase_cost,
          it.status.toUpperCase(),
        ]);
      });

      const ws2 = XLSX.utils.aoa_to_sheet(s2Data);
      ws2['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 9 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 9 } },
        { s: { r: 2, c: 0 }, e: { r: 2, c: 9 } },
      ];
      ws2['!cols'] = [
        { wch: 6 },
        { wch: 34 },
        { wch: 18 },
        { wch: 22 },
        { wch: 14 },
        { wch: 14 },
        { wch: 14 },
        { wch: 20 },
        { wch: 22 },
        { wch: 14 },
      ];
      XLSX.utils.book_append_sheet(wb, ws2, 'Reorder Watchlist');

      // ── SHEET 3: Category Asset Allocation ──
      const s3Data: any[][] = [];
      s3Data.push([title]);
      s3Data.push(['CATEGORY ASSET ALLOCATION & MARGIN INTELLIGENCE']);
      s3Data.push([]);
      s3Data.push([
        'CATEGORY',
        'TOTAL SKUs',
        'TOTAL ON HAND UNITS',
        'VALUATION AT COST (KSH)',
        'POTENTIAL RETAIL (KSH)',
        'PROJECTED PROFIT (KSH)',
        'AVERAGE MARGIN %',
        'SHARE OF INVENTORY CAPITAL',
      ]);
      categoryBreakdown.forEach((c) => {
        s3Data.push([
          c.category,
          c.skus,
          c.units,
          c.costVal,
          c.retailVal,
          c.profit,
          `${c.margin}%`,
          `${c.share}%`,
        ]);
      });
      const ws3 = XLSX.utils.aoa_to_sheet(s3Data);
      ws3['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 7 } },
      ];
      ws3['!cols'] = [
        { wch: 22 },
        { wch: 12 },
        { wch: 18 },
        { wch: 22 },
        { wch: 22 },
        { wch: 22 },
        { wch: 18 },
        { wch: 22 },
      ];
      XLSX.utils.book_append_sheet(wb, ws3, 'Category Analytics');

      XLSX.writeFile(wb, `Stock_Valuation_Master_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success('Super-premium multi-sheet Excel report exported! ✓');
    } catch (err: any) {
      console.error('Excel export error:', err);
      toast.error('Failed to export Excel: ' + (err.message || ''));
    }
  };

  /* ─────────────────────────────────────────────────────────────────────────
     EXPORT CSV
     ───────────────────────────────────────────────────────────────────────── */
  const exportCSV = () => {
    const headers = [
      'Barcode',
      'Product Code',
      'Product Name',
      'Category',
      'Supplier',
      'Purchase Unit',
      'Sales Unit',
      'Stock On Hand',
      'Reorder Point',
      'Purchase Cost',
      'Selling Price',
      'Margin %',
      'Total Cost Value',
      'Total Retail Value',
      'Projected Profit',
      'Status',
    ];
    const rows = filteredItems.map((it) => [
      `"${it.barcode}"`,
      `"${it.product_code}"`,
      `"${it.product_name.replace(/"/g, '""')}"`,
      `"${it.category}"`,
      `"${it.supplier_name}"`,
      `"${it.purchase_unit}"`,
      `"${it.sales_unit}"`,
      it.stock_qty,
      it.reorder_point,
      it.purchase_cost,
      it.sales_cost,
      `${it.effective_margin.toFixed(1)}%`,
      it.cost_value,
      it.retail_value,
      it.projected_profit,
      `"${it.status}"`,
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventory_valuation_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Inventory CSV ledger exported! ✓');
  };

  /* ─────────────────────────────────────────────────────────────────────────
     PRINT AUDIT REPORT (EXECUTIVE LANDSCAPE)
     ───────────────────────────────────────────────────────────────────────── */
  const printReport = () => {
    const rowsHtml = filteredItems
      .slice(0, 500)
      .map(
        (it, idx) => `
      <tr>
        <td style="text-align:center;">${idx + 1}</td>
        <td><b>${it.barcode || '—'}</b></td>
        <td><b>${it.product_name}</b><br/><small style="color:#64748b;">${it.category} · ${it.supplier_name}</small></td>
        <td style="text-align:center;">${it.sales_unit}</td>
        <td style="text-align:right; font-weight:bold; color:${
          it.stock_qty <= 0 ? '#ef4444' : it.stock_qty <= it.reorder_point ? '#f59e0b' : '#0f172a'
        };">${it.stock_qty}</td>
        <td style="text-align:center;">${it.reorder_point}</td>
        <td style="text-align:right;">${fmtKES(it.purchase_cost)}</td>
        <td style="text-align:right;">${fmtKES(it.sales_cost)}</td>
        <td style="text-align:right; font-weight:bold;">${fmtKES(it.cost_value)}</td>
        <td style="text-align:right;">${fmtKES(it.retail_value)}</td>
        <td style="text-align:center;">${it.status.toUpperCase()}</td>
      </tr>
    `
      )
      .join('');

    const html = `<!DOCTYPE html>
    <html>
      <head>
        <title>Inventory Valuation Audit — ${companyName}</title>
        <style>
          @page { size: landscape; margin: 8mm; }
          body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 10.5px; color: #0f172a; margin: 0; padding: 10px; }
          .header { border-bottom: 2px solid #091D3E; padding-bottom: 8px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: flex-end; }
          .title { font-size: 17px; font-weight: 900; color: #091D3E; text-transform: uppercase; }
          .subtitle { font-size: 10.5px; color: #64748b; margin-top: 2px; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; }
          th { background: #091D3E; color: #ffffff; padding: 5px 6px; font-size: 9.5px; text-align: left; text-transform: uppercase; }
          td { border-bottom: 1px solid #e2e8f0; padding: 5px 6px; font-size: 10px; }
          .totals { margin-top: 12px; padding: 10px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; display: flex; justify-content: space-between; font-weight: bold; font-size: 10.5px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="title">${companyName || 'ALPHA RETAIL'} — STOCK VALUATION & AUDIT REPORT</div>
            <div class="subtitle">Official inventory ledger, physical counts, cost assets & projected retail turnover</div>
          </div>
          <div style="text-align:right; font-size:10px;">
            <div>Outlet: <b>${activeOutlet?.outlet_name || 'Main Store'}</b></div>
            <div>Generated: <b>${new Date().toLocaleString('en-KE')}</b></div>
            <div>Audited SKUs: <b>${filteredItems.length}</b></div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width:25px; text-align:center;">#</th>
              <th>Barcode</th>
              <th>Product & Category</th>
              <th style="text-align:center;">Unit</th>
              <th style="text-align:right;">Stock Qty</th>
              <th style="text-align:center;">Reorder</th>
              <th style="text-align:right;">Cost Price</th>
              <th style="text-align:right;">Selling Price</th>
              <th style="text-align:right;">Stock Value (Cost)</th>
              <th style="text-align:right;">Retail Value</th>
              <th style="text-align:center;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <div class="totals">
          <span>Total Products: ${filteredItems.length}</span>
          <span>Physical Units: ${fmtN(metrics.totalUnitsOnHand)}</span>
          <span style="color:#091D3E;">Valuation at Cost: ${fmtKES(metrics.totalCostValue)}</span>
          <span style="color:#16a34a;">Projected Retail Turnover: ${fmtKES(metrics.totalRetailValue)}</span>
          <span>Projected Profit: ${fmtKES(metrics.totalProjectedProfit)}</span>
        </div>
      </body>
    </html>`;

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
      }, 400);
    }
  };

  if (!mounted) return null;

  return (
    <div
      className="-mt-2 sm:-mt-3.5 space-y-3 pb-12 text-slate-800"
      style={{ fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}
    >
      <Toaster position="top-right" />

      {/* ══════════════════════════════════════════════════════════════════
          1. COMPACT EXECUTIVE COMMAND HEADER (MATCHING APSIMS STUDIO)
          ══════════════════════════════════════════════════════════════════ */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-3 sm:p-3.5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          {/* Left: Branding, Outlet Pill & Live Metrics */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#091D3E] via-[#0E2852] to-[#12356B] text-white flex items-center justify-center font-black text-lg shrink-0 shadow-xs border border-emerald-400/30">
              <FiBox size={20} className="text-[#00E676]" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base font-extrabold text-slate-900 tracking-tight">
                  Inventory &amp; Stock Intelligence Studio
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/80">
                  🏪 {activeOutlet?.outlet_name || 'Main Store'} · Outlet #{outletId}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                  {items.length} Active SKUs
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200/80">
                  Valuation: {fmtK(metrics.totalCostValue)}
                </span>
                {metrics.deficitItemsCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200/80 animate-pulse">
                    ⚠️ {metrics.deficitItemsCount} Deficit SKUs
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                Real-time stock ledger · Dual cost/retail valuation · Movement telemetry &amp; replenishment intelligence
              </p>
            </div>
          </div>

          {/* Right: Studio Shortcuts & Direct Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href="/dashboard/purchase"
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-black shadow-xs flex items-center gap-1.5 transition cursor-pointer"
            >
              <FiShoppingBag size={13} />
              <span>New Stock Purchase</span>
            </Link>

            <Link
              href="/dashboard/stock-movement"
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white text-xs font-black shadow-xs flex items-center gap-1.5 transition cursor-pointer"
              title="Open Stock Movement Ledger"
            >
              <FiActivity size={13} />
              <span>Movement Ledger</span>
            </Link>

            <button
              onClick={exportExcel}
              className="px-3 py-1.5 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-extrabold flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
              title="Export ultra-premium styled multi-sheet Excel workbook"
            >
              <FiDownload size={13} className="text-emerald-700" />
              <span>Excel</span>
            </button>

            <button
              onClick={exportCSV}
              className="px-2.5 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1 shadow-2xs transition cursor-pointer"
              title="Export CSV"
            >
              <FiFileText size={13} />
              <span>CSV</span>
            </button>

            <button
              onClick={printReport}
              className="px-2.5 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1 shadow-2xs transition cursor-pointer"
              title="Print Official Stock Audit Report"
            >
              <FiPrinter size={13} />
              <span>Print</span>
            </button>

            <button
              onClick={loadData}
              disabled={isLoading}
              className="p-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-600 text-xs font-bold shadow-2xs transition cursor-pointer"
              title="Refresh Stock Telemetry"
            >
              <FiRefreshCw size={13} className={isLoading ? 'animate-spin text-emerald-600' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          2. EXECUTIVE 8-METRIC COMMAND HUD DOCK
          ══════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        {/* Card 1: Asset Valuation (Cost) */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-2.5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Asset Value (Cost)</span>
            <div className="w-5 h-5 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center">
              <FiDollarSign size={11} />
            </div>
          </div>
          <div>
            <div className="text-base font-black text-slate-900 leading-tight">
              {fmtK(metrics.totalCostValue)}
            </div>
            <div className="text-[9.5px] text-slate-500 font-semibold mt-0.5 truncate">
              Acquisition inventory capital
            </div>
          </div>
        </div>

        {/* Card 2: Retail Valuation */}
        <div className="bg-white border border-emerald-200/90 rounded-2xl p-2.5 shadow-xs flex flex-col justify-between bg-gradient-to-b from-emerald-50/20 to-white">
          <div className="flex items-center justify-between text-emerald-700 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Retail Value</span>
            <div className="w-5 h-5 rounded-md bg-emerald-100 border border-emerald-200 text-emerald-700 flex items-center justify-center">
              <FiTrendingUp size={11} />
            </div>
          </div>
          <div>
            <div className="text-base font-black text-emerald-700 leading-tight">
              {fmtK(metrics.totalRetailValue)}
            </div>
            <div className="text-[9.5px] text-emerald-600 font-semibold mt-0.5 truncate">
              Projected turnover potential
            </div>
          </div>
        </div>

        {/* Card 3: Unrealized Profit */}
        <div className="bg-white border border-teal-200/90 rounded-2xl p-2.5 shadow-xs flex flex-col justify-between bg-gradient-to-b from-teal-50/20 to-white">
          <div className="flex items-center justify-between text-teal-700 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Projected Profit</span>
            <div className="w-5 h-5 rounded-md bg-teal-100 border border-teal-200 text-teal-700 flex items-center justify-center">
              <FiPercent size={11} />
            </div>
          </div>
          <div>
            <div className="text-base font-black text-teal-700 leading-tight">
              {fmtK(metrics.totalProjectedProfit)}
            </div>
            <div className="text-[9.5px] text-teal-600 font-semibold mt-0.5 truncate">
              +{metrics.avgMarkup.toFixed(1)}% markup potential
            </div>
          </div>
        </div>

        {/* Card 4: Total Units */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-2.5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Total Physical Units</span>
            <div className="w-5 h-5 rounded-md bg-sky-50 border border-sky-200 text-sky-700 flex items-center justify-center">
              <FiPackage size={11} />
            </div>
          </div>
          <div>
            <div className="text-base font-black text-slate-900 leading-tight">
              {fmtN(metrics.totalUnitsOnHand)}
            </div>
            <div className="text-[9.5px] text-slate-500 font-semibold mt-0.5 truncate">
              Across {metrics.totalSKUs} active SKUs
            </div>
          </div>
        </div>

        {/* Card 5: In Stock (Healthy) */}
        <div className="bg-white border border-emerald-200/90 rounded-2xl p-2.5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-emerald-700 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">In Stock (OK)</span>
            <div className="w-5 h-5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center">
              <FiCheckCircle size={11} />
            </div>
          </div>
          <div>
            <div className="text-base font-black text-emerald-700 leading-tight">
              {fmtN(metrics.inStockCount)}
            </div>
            <div className="text-[9.5px] text-emerald-600 font-semibold mt-0.5 truncate">
              {metrics.totalSKUs > 0 ? ((metrics.inStockCount / metrics.totalSKUs) * 100).toFixed(0) : 0}% optimal level
            </div>
          </div>
        </div>

        {/* Card 6: Low Stock Alert */}
        <div className="bg-white border border-amber-200/90 rounded-2xl p-2.5 shadow-xs flex flex-col justify-between bg-gradient-to-b from-amber-50/20 to-white">
          <div className="flex items-center justify-between text-amber-700 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Low Stock</span>
            <div className="w-5 h-5 rounded-md bg-amber-100 border border-amber-200 text-amber-700 flex items-center justify-center">
              <FiAlertTriangle size={11} />
            </div>
          </div>
          <div>
            <div className="text-base font-black text-amber-700 leading-tight">
              {fmtN(metrics.lowStockCount)}
            </div>
            <div className="text-[9.5px] text-amber-600 font-semibold mt-0.5 truncate">
              Below safety buffer
            </div>
          </div>
        </div>

        {/* Card 7: Critical Stock */}
        <div className="bg-white border border-orange-200/90 rounded-2xl p-2.5 shadow-xs flex flex-col justify-between bg-gradient-to-b from-orange-50/20 to-white">
          <div className="flex items-center justify-between text-orange-700 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Critical Stock</span>
            <div className="w-5 h-5 rounded-md bg-orange-100 border border-orange-200 text-orange-700 flex items-center justify-center">
              <FiAlertCircle size={11} />
            </div>
          </div>
          <div>
            <div className="text-base font-black text-orange-700 leading-tight">
              {fmtN(metrics.criticalCount)}
            </div>
            <div className="text-[9.5px] text-orange-600 font-semibold mt-0.5 truncate">
              Immediate reorder needed
            </div>
          </div>
        </div>

        {/* Card 8: Out of Stock (Zero) */}
        <div className="bg-white border border-rose-200/90 rounded-2xl p-2.5 shadow-xs flex flex-col justify-between bg-gradient-to-b from-rose-50/20 to-white">
          <div className="flex items-center justify-between text-rose-700 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Out of Stock</span>
            <div className="w-5 h-5 rounded-md bg-rose-100 border border-rose-200 text-rose-700 flex items-center justify-center">
              <FiXCircle size={11} />
            </div>
          </div>
          <div>
            <div className="text-base font-black text-rose-700 leading-tight">
              {fmtN(metrics.outOfStockCount)}
            </div>
            <div className="text-[9.5px] text-rose-600 font-semibold mt-0.5 truncate">
              Zero inventory on shelf
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          3. TABS CONTROLLER (INVENTORY, CHARTS, HISTORY, REORDER, CATEGORIES)
          ══════════════════════════════════════════════════════════════════ */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-1.5 flex-wrap gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setActiveTab('inventory')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'inventory'
                ? 'bg-[#091D3E] text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
            }`}
          >
            <FiLayers size={13} />
            <span>Stock Valuation Master</span>
            <span className="px-1.5 py-0.2 rounded-full text-[9.5px] bg-white/20 text-white ml-0.5 font-bold">
              {filteredItems.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('movement-charts')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'movement-charts'
                ? 'bg-[#091D3E] text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
            }`}
          >
            <FiActivity size={13} className="text-[#00E676]" />
            <span>Movement Charts &amp; Velocity</span>
          </button>

          <button
            onClick={() => setActiveTab('history-ledger')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'history-ledger'
                ? 'bg-[#091D3E] text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
            }`}
          >
            <FiClock size={13} className="text-sky-400" />
            <span>Stock Ledger Audit Stream</span>
            <span className="px-1.5 py-0.2 rounded-full text-[9.5px] bg-sky-500 text-white ml-0.5 font-bold">
              {recentMovements.length}
            </span>
          </button>

          <button
            onClick={() => {
              setActiveTab('reorder-watch');
              setFilterStatus('needs_reorder');
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'reorder-watch'
                ? 'bg-[#091D3E] text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
            }`}
          >
            <FiAlertTriangle size={13} className="text-amber-400" />
            <span>Reorder Watchlist</span>
            <span className="px-1.5 py-0.2 rounded-full text-[9.5px] bg-rose-500 text-white ml-0.5 font-bold">
              {metrics.deficitItemsCount}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('category-analytics')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'category-analytics'
                ? 'bg-[#091D3E] text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
            }`}
          >
            <FiPieChartIcon size={13} className="text-purple-400" />
            <span>Category Analytics</span>
          </button>
        </div>

        <div className="text-[11px] text-slate-500 font-semibold hidden md:block">
          Showing {paginatedItems.length} of {filteredItems.length} items
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          4. COMMAND BAR & ADVANCED MULTI-FILTERS
          ══════════════════════════════════════════════════════════════════ */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-2.5 sm:p-3 shadow-xs space-y-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2">
          {/* Universal Search (Col span 4) */}
          <div className="lg:col-span-4 relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search product, barcode, SKU, category, supplier... [Ctrl+F]"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 outline-none focus:border-emerald-500 focus:bg-white transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <FiX size={12} />
              </button>
            )}
          </div>

          {/* Status Filter (Col span 2) */}
          <div className="lg:col-span-2">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="All">All Health Statuses</option>
              <option value="ok">In Stock (Healthy)</option>
              <option value="low">Low Stock Alert</option>
              <option value="critical">Critical Stock</option>
              <option value="out">Out of Stock (Zero)</option>
              <option value="negative">Negative Balance Alert</option>
              <option value="needs_reorder">All Needing Reorder</option>
            </select>
          </div>

          {/* Category Filter (Col span 2) */}
          <div className="lg:col-span-2">
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="All">All Categories ({categories.length})</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Supplier Filter (Col span 2) */}
          <div className="lg:col-span-2">
            <select
              value={filterSupplier}
              onChange={(e) => setFilterSupplier(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="All">All Suppliers ({suppliersList.length})</option>
              {suppliersList.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Sort By (Col span 2) */}
          <div className="lg:col-span-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="value_desc">Valuation (Highest First)</option>
              <option value="qty_desc">Stock Qty (Highest First)</option>
              <option value="qty_asc">Stock Qty (Lowest / Deficit)</option>
              <option value="retail_desc">Retail Value (Highest First)</option>
              <option value="profit_desc">Projected Profit (Highest)</option>
              <option value="margin_desc">Margin % (Highest First)</option>
              <option value="name_asc">Name (A → Z)</option>
            </select>
          </div>
        </div>

        {/* Active Filter Chips */}
        {(searchQuery || filterStatus !== 'All' || filterCategory !== 'All' || filterSupplier !== 'All') && (
          <div className="flex items-center gap-1.5 pt-1 border-t border-slate-100 flex-wrap text-[11px]">
            <span className="text-slate-400 font-semibold">Active filters:</span>
            {searchQuery && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold border border-slate-200">
                Search: &quot;{searchQuery}&quot;
                <FiX className="cursor-pointer" size={10} onClick={() => setSearchQuery('')} />
              </span>
            )}
            {filterStatus !== 'All' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
                Status: {filterStatus}
                <FiX className="cursor-pointer" size={10} onClick={() => setFilterStatus('All')} />
              </span>
            )}
            {filterCategory !== 'All' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 font-semibold border border-purple-200">
                Category: {filterCategory}
                <FiX className="cursor-pointer" size={10} onClick={() => setFilterCategory('All')} />
              </span>
            )}
            <button
              onClick={() => {
                setSearchQuery('');
                setFilterStatus('All');
                setFilterCategory('All');
                setFilterSupplier('All');
              }}
              className="text-emerald-600 hover:text-emerald-700 font-bold ml-1 cursor-pointer"
            >
              Reset all
            </button>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          TAB 1: STOCK VALUATION & MASTER CATALOG DATAGRID (ENRICHED)
          ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'inventory' && (
        <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gradient-to-r from-[#091D3E] via-[#0E2852] to-[#12356B] text-white border-b border-emerald-500/20">
                  <th className="py-2.5 px-3 font-extrabold uppercase tracking-wider text-[10px] w-10 text-center">#</th>
                  <th className="py-2.5 px-3 font-extrabold uppercase tracking-wider text-[10px]">Barcode / Code</th>
                  <th className="py-2.5 px-3 font-extrabold uppercase tracking-wider text-[10px]">Product &amp; Category</th>
                  <th className="py-2.5 px-3 font-extrabold uppercase tracking-wider text-[10px]">Supplier</th>
                  <th className="py-2.5 px-3 font-extrabold uppercase tracking-wider text-[10px] text-center">Units</th>
                  <th className="py-2.5 px-3 font-extrabold uppercase tracking-wider text-[10px] text-right">Stock on Hand</th>
                  <th className="py-2.5 px-3 font-extrabold uppercase tracking-wider text-[10px] text-center">Reorder</th>
                  <th className="py-2.5 px-3 font-extrabold uppercase tracking-wider text-[10px] text-right">Cost Price</th>
                  <th className="py-2.5 px-3 font-extrabold uppercase tracking-wider text-[10px] text-right">Selling Price</th>
                  <th className="py-2.5 px-3 font-extrabold uppercase tracking-wider text-[10px] text-center">Margin %</th>
                  <th className="py-2.5 px-3 font-extrabold uppercase tracking-wider text-[10px] text-right">Cost Value</th>
                  <th className="py-2.5 px-3 font-extrabold uppercase tracking-wider text-[10px] text-right">Retail Value</th>
                  <th className="py-2.5 px-3 font-extrabold uppercase tracking-wider text-[10px] text-right">Projected Profit</th>
                  <th className="py-2.5 px-3 font-extrabold uppercase tracking-wider text-[10px] text-center">Status</th>
                  <th className="py-2.5 px-3 font-extrabold uppercase tracking-wider text-[10px] text-center w-28">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={15} className="py-16 text-center">
                      <div className="flex flex-col items-center justify-center gap-2.5 text-slate-400">
                        <FiRefreshCw size={26} className="animate-spin text-emerald-600" />
                        <span className="text-xs font-semibold text-slate-600">
                          Computing inventory telemetry &amp; live valuations...
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : paginatedItems.length === 0 ? (
                  <tr>
                    <td colSpan={15} className="py-16 text-center">
                      <div className="flex flex-col items-center justify-center gap-2 text-slate-400">
                        <FiBox size={36} className="text-slate-300" />
                        <p className="text-sm font-bold text-slate-700">No stock products match your filter</p>
                        <p className="text-xs text-slate-400">Try adjusting your search criteria or reset filters.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedItems.map((item, idx) => {
                    const globalIdx = (page - 1) * perPage + idx + 1;
                    const isNeg = item.stock_qty < 0;
                    const isZero = item.stock_qty === 0;

                    return (
                      <tr key={item.pid} className="hover:bg-slate-50/80 transition-colors group">
                        {/* 1. Index */}
                        <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px] font-semibold">
                          {globalIdx}
                        </td>

                        {/* 2. Barcode & Code */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <div className="flex flex-col">
                            {item.barcode && item.barcode !== '—' ? (
                              <button
                                onClick={() => copyText(item.barcode, 'Barcode')}
                                className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-slate-800 hover:text-emerald-600 cursor-pointer text-left"
                                title="Click to copy barcode"
                              >
                                <span>{item.barcode}</span>
                                <FiCopy size={9} className="text-slate-400" />
                              </button>
                            ) : (
                              <span className="text-slate-400 text-[10px]">—</span>
                            )}
                            <span className="text-[9.5px] font-mono text-slate-400">{item.product_code || `PID-${item.pid}`}</span>
                          </div>
                        </td>

                        {/* 3. Product Name & Category */}
                        <td className="py-2.5 px-3">
                          <div className="flex flex-col">
                            <button
                              onClick={() => openProductDossier(item)}
                              className="font-extrabold text-slate-900 hover:text-emerald-600 text-left text-xs transition tracking-tight flex items-center gap-1.5 group-hover:translate-x-0.5 duration-150"
                            >
                              <span>{item.product_name}</span>
                            </button>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="px-1.5 py-0.2 rounded text-[9.5px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                                {item.category}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* 4. Supplier */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className="text-[11px] text-slate-600 truncate max-w-[120px] block" title={item.supplier_name}>
                            {item.supplier_name || '—'}
                          </span>
                        </td>

                        {/* 5. Units */}
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <span className="text-[10.5px] font-semibold text-slate-600">
                            {item.sales_unit || item.purchase_unit || 'Pcs'}
                          </span>
                        </td>

                        {/* 6. Stock on Hand */}
                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          <div
                            className={`font-mono font-black text-xs ${
                              isNeg
                                ? 'text-purple-700'
                                : isZero
                                ? 'text-rose-600'
                                : item.stock_qty <= item.reorder_point
                                ? 'text-amber-600'
                                : 'text-slate-900'
                            }`}
                          >
                            {fmtN(item.stock_qty)}
                          </div>
                          <div className="text-[9.5px] text-slate-400 font-medium">
                            {item.movements_count} txns
                          </div>
                        </td>

                        {/* 7. Reorder Point */}
                        <td className="py-2.5 px-3 text-center whitespace-nowrap font-mono text-[11px] text-slate-500 font-semibold">
                          {item.reorder_point}
                        </td>

                        {/* 8. Purchase Cost */}
                        <td className="py-2.5 px-3 text-right whitespace-nowrap font-mono text-[11px] text-slate-700">
                          {fmtKES(item.purchase_cost)}
                        </td>

                        {/* 9. Selling Price */}
                        <td className="py-2.5 px-3 text-right whitespace-nowrap font-mono text-[11px] text-slate-900 font-semibold">
                          {fmtKES(item.sales_cost)}
                        </td>

                        {/* 10. Margin % */}
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <span
                            className={`inline-block px-1.5 py-0.2 rounded text-[10px] font-bold ${
                              item.effective_margin >= 30
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : item.effective_margin > 0
                                ? 'bg-sky-50 text-sky-700 border border-sky-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {item.effective_margin >= 0 ? `+${item.effective_margin.toFixed(0)}%` : `${item.effective_margin.toFixed(0)}%`}
                          </span>
                        </td>

                        {/* 11. Cost Value */}
                        <td className="py-2.5 px-3 text-right whitespace-nowrap font-mono text-xs font-black text-slate-900">
                          {fmtKES(item.cost_value)}
                        </td>

                        {/* 12. Retail Value */}
                        <td className="py-2.5 px-3 text-right whitespace-nowrap font-mono text-xs font-bold text-emerald-700">
                          {fmtKES(item.retail_value)}
                        </td>

                        {/* 13. Projected Profit */}
                        <td className="py-2.5 px-3 text-right whitespace-nowrap font-mono text-[11px] font-bold text-teal-700">
                          {fmtKES(item.projected_profit)}
                        </td>

                        {/* 14. Status */}
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          {item.status === 'ok' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              ● In Stock
                            </span>
                          )}
                          {item.status === 'low' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              ▲ Low Stock
                            </span>
                          )}
                          {item.status === 'critical' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-50 text-orange-700 border border-orange-200 animate-pulse">
                              ▲ Critical
                            </span>
                          )}
                          {item.status === 'out' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              ✕ Out of Stock
                            </span>
                          )}
                          {item.status === 'negative' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                              ⚠ Negative
                            </span>
                          )}
                        </td>

                        {/* 15. Actions */}
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            {/* View Movement Ledger */}
                            <button
                              onClick={() => openProductDossier(item)}
                              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 transition"
                              title="View Product Movement Ledger"
                            >
                              <FiEye size={12} />
                            </button>

                            {/* Quick Adjust */}
                            <button
                              onClick={() => {
                                setAdjustingItem(item);
                                setAdjustQty(1);
                                setAdjustType('add');
                                setAdjustReason('Physical Stocktake Correction');
                                setAdjustNotes('');
                              }}
                              className="p-1.5 rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition"
                              title="Quick Stock Adjustment (+ / -)"
                            >
                              <FiSliders size={12} />
                            </button>

                            {/* Order Stock Shortcut */}
                            <Link
                              href={`/dashboard/purchase`}
                              className="p-1.5 rounded-lg border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-700 transition"
                              title="Create Purchase Order"
                            >
                              <FiShoppingBag size={12} />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Floating Pagination Bar */}
          <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600 font-semibold">
            <div className="flex items-center gap-2">
              <span>Rows per page:</span>
              <select
                value={perPage}
                onChange={(e) => setPerPage(Number(e.target.value))}
                className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none cursor-pointer"
              >
                {[25, 50, 100, 200].map((sz) => (
                  <option key={sz} value={sz}>
                    {sz} rows
                  </option>
                ))}
              </select>
              <span className="text-slate-400">|</span>
              <span>
                Showing {filteredItems.length === 0 ? 0 : (page - 1) * perPage + 1} to{' '}
                {Math.min(page * perPage, filteredItems.length)} of {filteredItems.length} products
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(1)}
                disabled={page <= 1}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 disabled:opacity-30 disabled:pointer-events-none"
              >
                <FiChevronsLeft size={13} />
              </button>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 disabled:opacity-30 disabled:pointer-events-none"
              >
                <FiChevronLeft size={13} />
              </button>

              <span className="px-3 py-1 font-mono font-bold text-slate-700 bg-white border border-slate-200 rounded-lg">
                {page} / {totalPages}
              </span>

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 disabled:opacity-30 disabled:pointer-events-none"
              >
                <FiChevronRight size={13} />
              </button>
              <button
                onClick={() => setPage(totalPages)}
                disabled={page >= totalPages}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 disabled:opacity-30 disabled:pointer-events-none"
              >
                <FiChevronsRight size={13} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB 2: LINEAR CHARTS & GRAPHS FOR STOCK MOVEMENT
          ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'movement-charts' && (
        <div className="space-y-3">
          {/* Top Charts Row: Linear Movement Velocity & Category Valuation */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
            {/* Linear Chart: Daily Inflow vs Outflow Velocity (Col Span 8) */}
            <div className="lg:col-span-8 bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3 flex-wrap gap-2">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 tracking-tight flex items-center gap-1.5">
                    <FiActivity size={16} className="text-[#00E676]" />
                    <span>Linear Stock Movement Velocity (Daily Inflows vs Outflows)</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Tracking incoming inventory replenishment (purchases/returns) vs outflow sales &amp; issues
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Stock Inflow
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> Stock Outflow
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span> Net Velocity
                  </span>
                </div>
              </div>

              <div className="h-[280px] w-full">
                {dailyMovementPoints.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                    No movement records in this window.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={dailyMovementPoints} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="inflowGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                        </linearGradient>
                        <linearGradient id="outflowGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#EF4444" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#EF4444" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      <XAxis dataKey="displayDate" stroke="#94A3B8" fontSize={10} tickLine={false} />
                      <YAxis stroke="#94A3B8" fontSize={10} tickLine={false} />
                      <RechartsTooltip
                        contentStyle={{
                          backgroundColor: '#091D3E',
                          borderRadius: '12px',
                          border: 'none',
                          color: '#fff',
                          fontSize: '11px',
                          fontWeight: 'bold',
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="inflow"
                        name="Stock Inflow (Units)"
                        stroke="#10B981"
                        strokeWidth={2}
                        fill="url(#inflowGrad)"
                      />
                      <Area
                        type="monotone"
                        dataKey="outflow"
                        name="Stock Outflow (Units)"
                        stroke="#EF4444"
                        strokeWidth={2}
                        fill="url(#outflowGrad)"
                      />
                      <Line
                        type="monotone"
                        dataKey="net"
                        name="Net Trajectory"
                        stroke="#6366F1"
                        strokeWidth={2}
                        dot={{ r: 2 }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Donut Chart: Inventory Health Breakdown (Col Span 4) */}
            <div className="lg:col-span-4 bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
              <div className="pb-2 border-b border-slate-100">
                <h3 className="text-sm font-extrabold text-slate-900 tracking-tight flex items-center gap-1.5">
                  <FiPieChartIcon size={16} className="text-purple-500" />
                  <span>Inventory Health Balance</span>
                </h3>
                <p className="text-[11px] text-slate-500 font-medium">SKU proportion by shelf status</p>
              </div>

              <div className="h-[210px] w-full relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={healthPieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                    >
                      {healthPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      contentStyle={{
                        backgroundColor: '#091D3E',
                        borderRadius: '10px',
                        border: 'none',
                        color: '#fff',
                        fontSize: '11px',
                        fontWeight: 'bold',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-lg font-black text-slate-900 leading-tight">{metrics.totalSKUs}</span>
                  <span className="text-[10px] font-bold text-slate-400">Total SKUs</span>
                </div>
              </div>

              <div className="space-y-1 pt-1 text-[11px]">
                {healthPieData.map((item) => (
                  <div key={item.name} className="flex items-center justify-between font-semibold">
                    <span className="flex items-center gap-1.5 text-slate-600">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }}></span>
                      {item.name}
                    </span>
                    <span className="font-mono text-slate-900 font-bold">
                      {item.value} ({((item.value / metrics.totalSKUs) * 100).toFixed(0)}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom Chart: Category Valuation & Capital Distribution */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
            <div className="pb-3 border-b border-slate-100 mb-3 flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 tracking-tight flex items-center gap-1.5">
                  <FiBarChart2 size={16} className="text-indigo-600" />
                  <span>Category Stock Asset Valuation (Cost vs Retail Turnover)</span>
                </h3>
                <p className="text-[11px] text-slate-500 font-medium">
                  Capital allocation comparison across merchandise departments
                </p>
              </div>
            </div>

            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryBreakdown.slice(0, 10)} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="category" stroke="#64748B" fontSize={10} tickLine={false} interval={0} angle={-15} textAnchor="end" />
                  <YAxis stroke="#64748B" fontSize={10} tickLine={false} tickFormatter={(v) => fmtK(v)} />
                  <RechartsTooltip
                    formatter={(val: any) => fmt(val)}
                    contentStyle={{
                      backgroundColor: '#091D3E',
                      borderRadius: '12px',
                      border: 'none',
                      color: '#fff',
                      fontSize: '11px',
                      fontWeight: 'bold',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
                  <Bar dataKey="costVal" name="Valuation at Cost (Ksh)" fill="#091D3E" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="retailVal" name="Projected Retail Value (Ksh)" fill="#10B981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB 3: STOCK LEDGER AUDIT STREAM (HISTORY MOVEMENT)
          ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'history-ledger' && (
        <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
          <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <FiClock size={13} className="text-sky-600" />
                <span>Live Stock Movement Telemetry (Last {recentMovements.length} Transactions)</span>
              </h3>
              <p className="text-[10.5px] text-slate-500 font-medium">
                Complete transactional audit trail of sales deductions, purchase inflows, and stocktake adjustments
              </p>
            </div>
            <button
              onClick={loadData}
              className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-100 flex items-center gap-1 cursor-pointer"
            >
              <FiRefreshCw size={11} className={isLoading ? 'animate-spin' : ''} />
              <span>Refresh Stream</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-extrabold uppercase text-[10px]">
                  <th className="py-2.5 px-3">Date &amp; Time</th>
                  <th className="py-2.5 px-3">Product Name</th>
                  <th className="py-2.5 px-3">Movement Type</th>
                  <th className="py-2.5 px-3 text-right">Quantity Changed</th>
                  <th className="py-2.5 px-3 text-center">Unit / Storage</th>
                  <th className="py-2.5 px-3">Reference / Document</th>
                  <th className="py-2.5 px-3">Audit Notes &amp; Reasons</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentMovements.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-14 text-center text-slate-400">
                      No stock movement history recorded yet.
                    </td>
                  </tr>
                ) : (
                  recentMovements.slice(0, 150).map((mov) => {
                    const isPositive = mov.qty > 0;
                    const invType = (mov.invoice_no || '').toUpperCase();

                    return (
                      <tr key={mov.st_id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2 px-3 whitespace-nowrap text-slate-600 font-mono text-[11px]">
                          {formatDateTime(mov.created_at)}
                        </td>
                        <td className="py-2 px-3">
                          <span className="font-bold text-slate-900 block">{mov.product_name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {mov.barcode !== '—' ? mov.barcode : mov.product_code}
                          </span>
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap">
                          {invType.includes('SALE') ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              <FiArrowDownRight size={10} /> Sale Deduction
                            </span>
                          ) : invType.includes('INV') || invType.includes('PURCHASE') ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <FiArrowUpRight size={10} /> Purchase Inflow
                            </span>
                          ) : invType.includes('OPEN') ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                              ● Opening Balance
                            </span>
                          ) : invType.includes('ADJ') ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                              ⚡ Stock Adjustment
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                              {mov.invoice_no}
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right whitespace-nowrap">
                          <span
                            className={`font-mono font-black text-xs ${
                              isPositive ? 'text-emerald-700' : 'text-rose-700'
                            }`}
                          >
                            {isPositive ? `+${mov.qty}` : mov.qty}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-center whitespace-nowrap text-slate-600 font-semibold text-[10.5px]">
                          {mov.storage_type || 'Pieces'}
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap font-mono text-[11px] font-bold text-slate-800">
                          {mov.invoice_no || '—'}
                        </td>
                        <td className="py-2 px-3 text-slate-600 text-[11px] max-w-xs truncate" title={mov.notes || ''}>
                          {mov.notes || '—'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB 4: REORDER & REPLENISHMENT WATCHLIST
          ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'reorder-watch' && (
        <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
          <div className="p-3 bg-amber-50/50 border-b border-amber-200/80 flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-xs font-extrabold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                <FiAlertTriangle size={14} className="text-amber-600" />
                <span>Replenishment Watchlist — Below Reorder Levels ({metrics.deficitItemsCount} SKUs)</span>
              </h3>
              <p className="text-[10.5px] text-amber-800 font-medium">
                Total replenishment capital required to restore safety buffer: <b>{fmtKES(metrics.replenishmentCapitalRequired)}</b>
              </p>
            </div>
            <Link
              href="/dashboard/purchase"
              className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl text-xs font-black shadow-xs flex items-center gap-1.5"
            >
              <FiShoppingBag size={12} />
              <span>Launch Purchase Order</span>
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-extrabold uppercase text-[10px]">
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">Product Name</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3">Supplier</th>
                  <th className="py-2.5 px-3 text-right">Current Stock</th>
                  <th className="py-2.5 px-3 text-center">Reorder Point</th>
                  <th className="py-2.5 px-3 text-right">Deficit Needed</th>
                  <th className="py-2.5 px-3 text-right">Unit Cost</th>
                  <th className="py-2.5 px-3 text-right">Capital Required</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items
                  .filter((it) => it.stock_qty <= it.reorder_point)
                  .map((it, idx) => {
                    const deficit = Math.max(0, it.reorder_point - it.stock_qty);
                    const capital = deficit * it.purchase_cost;

                    return (
                      <tr key={it.pid} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px] font-semibold">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">{it.product_name}</td>
                        <td className="py-2.5 px-3 text-slate-600">{it.category}</td>
                        <td className="py-2.5 px-3 text-slate-600">{it.supplier_name}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-black text-rose-700">{it.stock_qty}</td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-700">{it.reorder_point}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-700">+{deficit}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-700">{fmtKES(it.purchase_cost)}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-black text-slate-900">{fmtKES(capital)}</td>
                        <td className="py-2.5 px-3 text-center">
                          {it.stock_qty <= 0 ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                              OUT OF STOCK
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                              LOW STOCK
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <Link
                            href="/dashboard/purchase"
                            className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-[10.5px] font-bold transition inline-flex items-center gap-1"
                          >
                            <FiShoppingBag size={11} />
                            <span>Order</span>
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB 5: CATEGORY ASSET VALUATION & ALLOCATION
          ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'category-analytics' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {categoryBreakdown.map((cat) => (
            <div key={cat.category} className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <h4 className="font-extrabold text-slate-900 text-sm tracking-tight">{cat.category}</h4>
                  <span className="px-2 py-0.5 rounded-md font-mono text-[10px] font-bold bg-[#091D3E]/5 text-[#091D3E]">
                    {cat.skus} SKUs
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 my-3 text-xs">
                  <div className="p-2 rounded-xl bg-slate-50">
                    <span className="text-[10px] font-semibold text-slate-400 block uppercase">Cost Valuation</span>
                    <span className="text-sm font-black font-mono text-slate-900">{fmtKES(cat.costVal)}</span>
                  </div>
                  <div className="p-2 rounded-xl bg-emerald-50/50">
                    <span className="text-[10px] font-semibold text-emerald-600 block uppercase">Retail Value</span>
                    <span className="text-sm font-black font-mono text-emerald-700">{fmtKES(cat.retailVal)}</span>
                  </div>
                </div>

                <div className="space-y-1 text-[11px] text-slate-600 font-semibold">
                  <div className="flex justify-between">
                    <span>Physical Units:</span>
                    <span className="font-bold text-slate-900">{fmtN(cat.units)} Pcs</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Gross Markup Margin:</span>
                    <span className="font-bold text-teal-700">+{cat.margin}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Share of Total Asset Capital:</span>
                    <span className="font-bold text-indigo-700">{cat.share}%</span>
                  </div>
                </div>
              </div>

              {/* Share Progress Bar */}
              <div className="mt-3 pt-2 border-t border-slate-100">
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-emerald-500 to-teal-600 h-full rounded-full"
                    style={{ width: `${Math.min(100, Math.max(3, cat.share))}%` }}
                  ></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          6. PRODUCT MOVEMENT DOSSIER DRAWER / MODAL
          ══════════════════════════════════════════════════════════════════ */}
      {viewingItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto border border-slate-200 flex flex-col animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="bg-gradient-to-r from-[#091D3E] via-[#0E2852] to-[#12356B] px-5 py-4 text-white sticky top-0 z-10 flex items-center justify-between border-b border-emerald-500/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-emerald-400 font-black border border-white/15">
                  <FiBox size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-extrabold tracking-tight">{viewingItem.product_name}</h2>
                    <span className="px-2 py-0.5 rounded-md font-mono text-[10.5px] font-bold bg-white/15 text-white border border-white/20">
                      {viewingItem.barcode !== '—' ? viewingItem.barcode : viewingItem.product_code}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 font-medium mt-0.5">
                    {viewingItem.category} · Preferred Supplier: {viewingItem.supplier_name}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setViewingItem(null)}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
              >
                <FiX size={16} />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 space-y-4">
              {/* Valuation Snapshot Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Current Stock</span>
                  <div className="text-base font-black font-mono text-slate-900 mt-0.5">
                    {fmtN(viewingItem.stock_qty)} {viewingItem.sales_unit}
                  </div>
                  <span className="text-[9.5px] font-semibold text-slate-500">
                    Reorder point: {viewingItem.reorder_point}
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Stock Value (Cost)</span>
                  <div className="text-base font-black font-mono text-slate-900 mt-0.5">
                    {fmtKES(viewingItem.cost_value)}
                  </div>
                  <span className="text-[9.5px] font-semibold text-slate-500">
                    @ {fmtKES(viewingItem.purchase_cost)} / unit
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Retail Value</span>
                  <div className="text-base font-black font-mono text-emerald-700 mt-0.5">
                    {fmtKES(viewingItem.retail_value)}
                  </div>
                  <span className="text-[9.5px] font-semibold text-emerald-600">
                    @ {fmtKES(viewingItem.sales_cost)} / unit
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Projected Margin</span>
                  <div className="text-base font-black font-mono text-teal-700 mt-0.5">
                    +{viewingItem.effective_margin.toFixed(1)}%
                  </div>
                  <span className="text-[9.5px] font-semibold text-teal-600">
                    Profit: {fmtKES(viewingItem.projected_profit)}
                  </span>
                </div>
              </div>

              {/* Movement Ledger History */}
              <div className="pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-extrabold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <FiClock size={13} className="text-sky-600" />
                    <span>Transaction Movement History ({viewingItemMovements.length})</span>
                  </h4>
                  <button
                    onClick={() => {
                      setAdjustingItem(viewingItem);
                      setAdjustQty(1);
                      setAdjustType('add');
                      setAdjustReason('Physical Stocktake Correction');
                      setAdjustNotes('');
                    }}
                    className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                  >
                    <span>⚡ Quick Adjust Stock</span>
                  </button>
                </div>

                {loadingItemMovements ? (
                  <div className="p-8 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
                    <FiRefreshCw size={20} className="animate-spin text-emerald-600" />
                    <span>Loading chronological stock ledger...</span>
                  </div>
                ) : viewingItemMovements.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
                    No movement records found for this product.
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-slate-200 rounded-2xl max-h-[300px]">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-600 font-extrabold uppercase text-[10px] sticky top-0">
                        <tr>
                          <th className="py-2 px-3">Date</th>
                          <th className="py-2 px-3">Document / Ref</th>
                          <th className="py-2 px-3 text-right">Quantity</th>
                          <th className="py-2 px-3 text-center">Unit</th>
                          <th className="py-2 px-3">Audit Reason</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {viewingItemMovements.map((m) => {
                          const isPos = m.qty > 0;
                          return (
                            <tr key={m.st_id} className="hover:bg-slate-50">
                              <td className="py-2 px-3 text-slate-600 font-mono text-[11px]">
                                {formatDateTime(m.created_at)}
                              </td>
                              <td className="py-2 px-3 font-mono font-bold text-slate-800">{m.invoice_no}</td>
                              <td
                                className={`py-2 px-3 text-right font-mono font-black ${
                                  isPos ? 'text-emerald-700' : 'text-rose-700'
                                }`}
                              >
                                {isPos ? `+${m.qty}` : m.qty}
                              </td>
                              <td className="py-2 px-3 text-center text-slate-500 font-semibold">{m.storage_type || 'Pieces'}</td>
                              <td className="py-2 px-3 text-slate-600 text-[11px] truncate max-w-xs">{m.notes || '—'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Modal Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <Link
                  href="/dashboard/purchase"
                  className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl text-xs font-black shadow-xs flex items-center gap-1.5"
                >
                  <FiShoppingBag size={12} />
                  <span>Order More Stock</span>
                </Link>

                <button
                  onClick={() => setViewingItem(null)}
                  className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-extrabold cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          7. QUICK STOCK ADJUSTMENT MODAL
          ══════════════════════════════════════════════════════════════════ */}
      {adjustingItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md border border-slate-200 p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center">
                  <FiSliders size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">Adjust Physical Stock</h3>
                  <p className="text-[10.5px] text-slate-500 truncate max-w-[240px] font-semibold">
                    {adjustingItem.product_name}
                  </p>
                </div>
              </div>
              <button onClick={() => setAdjustingItem(null)} className="text-slate-400 hover:text-slate-600">
                <FiX size={16} />
              </button>
            </div>

            <form onSubmit={handleQuickAdjust} className="space-y-3 text-xs">
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <span className="font-bold text-slate-600">Current Stock On Hand:</span>
                <span className="font-mono font-black text-sm text-slate-900">
                  {fmtN(adjustingItem.stock_qty)} {adjustingItem.sales_unit}
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Adjustment Action</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustType('add')}
                    className={`py-2 rounded-xl font-bold border transition flex items-center justify-center gap-1 cursor-pointer ${
                      adjustType === 'add'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <FiPlus size={13} />
                    <span>Add to Stock (+)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustType('deduct')}
                    className={`py-2 rounded-xl font-bold border transition flex items-center justify-center gap-1 cursor-pointer ${
                      adjustType === 'deduct'
                        ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <FiTrendingDown size={13} />
                    <span>Deduct (-)</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Quantity ({adjustingItem.sales_unit || 'Units'})
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="any"
                  required
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-sm font-bold text-slate-900 focus:bg-white focus:border-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Audit Reason</label>
                <select
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:bg-white focus:border-emerald-500 outline-none cursor-pointer"
                >
                  <option value="Physical Stocktake Correction">Physical Stocktake Correction</option>
                  <option value="Damaged / Broken Goods">Damaged / Broken Goods</option>
                  <option value="Expired Product Disposal">Expired Product Disposal</option>
                  <option value="Internal Business Usage">Internal Business Usage</option>
                  <option value="Found Unrecorded Stock">Found Unrecorded Stock</option>
                  <option value="Supplier Surplus Bonus">Supplier Surplus Bonus</option>
                  <option value="Theft / Shrinkage Loss">Theft / Shrinkage Loss</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Additional Notes</label>
                <textarea
                  rows={2}
                  placeholder="e.g., Counted during weekend audit by supervisor"
                  value={adjustNotes}
                  onChange={(e) => setAdjustNotes(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:bg-white focus:border-emerald-500 outline-none resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAdjustingItem(null)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAdjusting}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isAdjusting ? (
                    <>
                      <FiRefreshCw size={12} className="animate-spin" />
                      <span>Applying...</span>
                    </>
                  ) : (
                    <>
                      <FiCheck size={13} />
                      <span>Save Adjustment</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
