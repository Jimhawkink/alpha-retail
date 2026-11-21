'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';
import toast, { Toaster } from 'react-hot-toast';
import { printCustomerReceipt, loadCompanyInfo } from '@/lib/receiptPrinter';
import * as XLSX from 'xlsx-js-style';
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
  FiDownload,
  FiPrinter,
  FiSearch,
  FiRefreshCw,
  FiChevronDown,
  FiChevronUp,
  FiFilter,
  FiX,
  FiBarChart2,
  FiUser,
  FiChevronLeft,
  FiChevronRight,
  FiArrowRight,
  FiFileText,
  FiDollarSign,
  FiTrendingUp,
  FiTrendingDown,
  FiLayers,
  FiCheckCircle,
  FiCalendar,
  FiClock,
  FiSliders,
  FiPieChart,
  FiShoppingBag,
  FiActivity,
  FiAward,
  FiCopy,
  FiCheck,
  FiZap,
  FiSun,
  FiMoon,
} from 'react-icons/fi';

// ─────────────────────────────────────────────────────────────────────────────
// Formatters & Safe Date Helpers
// ─────────────────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  `Ksh ${(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtK = (n: number) => {
  if (Math.abs(n) >= 1_000_000) return `Ksh ${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `Ksh ${(n / 1_000).toFixed(1)}K`;
  return `Ksh ${(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};
const fmtN = (n: number) => (n || 0).toLocaleString('en-KE');

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

const safeDate = (val: any): Date | null => {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
};

const PAY_METHODS = ['All', 'Cash', 'M-Pesa', 'Card', 'Credit', 'Split'];
const PAGE_SIZES = [25, 50, 100, 200];
const PIE_COLORS = ['#10B981', '#0284C7', '#8B5CF6', '#F59E0B', '#EC4899', '#64748B'];

// ─────────────────────────────────────────────────────────────────────────────
// Uniform Badge Component (No Giant Fonts, Clean Professional Tag)
// ─────────────────────────────────────────────────────────────────────────────
function Bdg({ txt, color }: { txt: string; color: string }) {
  const c: Record<string, string> = {
    green: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    blue: 'bg-sky-50 text-sky-800 border-sky-200',
    indigo: 'bg-indigo-50 text-indigo-800 border-indigo-200',
    amber: 'bg-amber-50 text-amber-800 border-amber-200',
    purple: 'bg-purple-50 text-purple-800 border-purple-200',
    rose: 'bg-rose-50 text-rose-800 border-rose-200',
    gray: 'bg-slate-100 text-slate-700 border-slate-200',
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[10.5px] font-semibold border whitespace-nowrap leading-tight ${
        c[color] || c.gray
      }`}
    >
      {txt || '—'}
    </span>
  );
}

export default function FullSalesReportPage() {
  const { activeOutlet } = useOutlet();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // User state & permissions
  const [user, setUser] = useState<any>(null);
  const [isCashier, setIsCashier] = useState(false);
  const [cashierName, setCashierName] = useState('');
  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem('user') || '{}');
      setUser(u);
      const isC = ['cashier', 'waiter'].includes((u.userType || u.user_type || '').toLowerCase());
      setIsCashier(isC);
      if (isC) {
        // Grab every possible name field the POS might store
        const rawName = u.name || u.full_name || u.username || u.email || '';
        setCashierName(rawName.trim());
      }
    } catch {}
  }, []);

  // Workspace Navigation Tabs
  const [activeTab, setActiveTab] = useState<'ledger' | 'hourly' | 'trends' | 'channels' | 'staff'>('ledger');

  // Filter controls state
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState(toDay());
  const [dateTo, setDateTo] = useState(toDay());
  const [payFilter, setPayFilter] = useState('All');
  const [spFilter, setSpFilter] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'highest_amount' | 'highest_profit'>('newest');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // UI Drawer / Visibility States
  const [showFilters, setShowFilters] = useState(true);
  const [showStatDrawer, setShowStatDrawer] = useState(false);
  const [showHudCards, setShowHudCards] = useState(true);

  // Sales data state
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [returnedSales, setReturnedSales] = useState<Set<string>>(new Set());
  const [creditPaidData, setCreditPaidData] = useState<{
    total: number;
    txns: number;
    cashPaid: number;
    mpesaPaid: number;
  }>({ total: 0, txns: 0, cashPaid: 0, mpesaPaid: 0 });

  // Expandable line items state
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [itemsMap, setItemsMap] = useState<Record<number, any[]>>({});
  const [loadingItems, setLoadingItems] = useState<Set<number>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut Ctrl+F
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Primary Fetch: Sales Ledger + Returns + Credit Settlements
  // ─────────────────────────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const outletId = activeOutlet?.outlet_id;
      let salesData: any[] = [];

      // Build a reusable base query builder
      const buildQuery = (withOutlet: boolean) => {
        let q = supabase
          .from('retail_sales')
          .select('*')
          .gte('sale_date', dateFrom)
          .lte('sale_date', dateTo)
          .order('sale_datetime', { ascending: false })
          .limit(3000);
        if (withOutlet && outletId) q = q.eq('outlet_id', outletId);
        // For cashier users: filter by their own name in created_by (case-insensitive)
        if (isCashier && cashierName) {
          q = q.ilike('created_by', `%${cashierName}%`);
        }
        return q;
      };

      // Try outlet-scoped first; fall back to unscoped if empty
      if (outletId) {
        const r = await buildQuery(true);
        if (!r.error) salesData = r.data || [];
      }
      if (!salesData.length) {
        const r2 = await buildQuery(false);
        salesData = r2.data || [];
      }

      // For cashier: if still empty, try broader name variations
      if (isCashier && cashierName && !salesData.length) {
        // Try first name only
        const firstName = cashierName.split(/[\s_]+/)[0];
        if (firstName && firstName !== cashierName) {
          const r3 = await supabase
            .from('retail_sales')
            .select('*')
            .gte('sale_date', dateFrom)
            .lte('sale_date', dateTo)
            .ilike('created_by', `%${firstName}%`)
            .order('sale_datetime', { ascending: false })
            .limit(3000);
          if (!r3.error) salesData = r3.data || [];
        }
      }

      setSales(salesData);

      // Returns cross-check
      const receiptNos = salesData.map((s: any) => s.receipt_no).filter(Boolean);
      if (receiptNos.length > 0) {
        const { data: retData } = await supabase
          .from('sales_returns')
          .select('original_sale_id')
          .in('original_sale_id', receiptNos);
        setReturnedSales(new Set((retData || []).map((r: any) => r.original_sale_id)));
      } else {
        setReturnedSales(new Set());
      }

      // Credit payments collected within this window
      try {
        let cpQuery = supabase
          .from('retail_credit_payments')
          .select('amount_paid, payment_date, payment_datetime, payment_method, outlet_id, transaction_type')
          .eq('transaction_type', 'payment')
          .gte('payment_date', dateFrom)
          .lte('payment_date', dateTo);
        if (outletId) cpQuery = (cpQuery as any).eq('outlet_id', outletId);
        const { data: cpData } = await cpQuery;
        const cpRows = cpData || [];
        const cpTotal = cpRows.reduce((s: number, r: any) => s + (r.amount_paid || 0), 0);
        const cpCash = cpRows
          .filter((r: any) => (r.payment_method || '').toLowerCase() === 'cash')
          .reduce((s: number, r: any) => s + (r.amount_paid || 0), 0);
        const cpMpesa = cpRows
          .filter((r: any) => ['m-pesa', 'mpesa'].includes((r.payment_method || '').toLowerCase()))
          .reduce((s: number, r: any) => s + (r.amount_paid || 0), 0);
        setCreditPaidData({ total: cpTotal, txns: cpRows.length, cashPaid: cpCash, mpesaPaid: cpMpesa });
      } catch {
        setCreditPaidData({ total: 0, txns: 0, cashPaid: 0, mpesaPaid: 0 });
      }
    } catch (e) {
      console.error('loadAll error:', e);
      toast.error('Failed to load sales ledger');
      setSales([]);
    }
    setLoading(false);
  }, [activeOutlet?.outlet_id, dateFrom, dateTo, isCashier, cashierName]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Salesperson helper
  const getSP = (s: any) => s.created_by || s.served_by || s.waiter_name || s.cashier_name || '—';

  const payColor = (m: string) => {
    const v = (m || '').toLowerCase();
    if (v === 'cash') return 'green';
    if (v === 'm-pesa' || v === 'mpesa') return 'blue';
    if (v === 'card') return 'purple';
    if (v === 'credit') return 'amber';
    if (v === 'split') return 'indigo';
    return 'gray';
  };

  const salesPersons = useMemo(
    () => Array.from(new Set(sales.map(getSP).filter((s) => s !== '—'))).sort(),
    [sales]
  );

  // For non-cashier admins only: auto-select salesperson filter if name matches
  useEffect(() => {
    if (!isCashier && user && salesPersons.length && !spFilter) {
      const myName = user.name || user.full_name || user.username || '';
      const match = salesPersons.find(
        (sp) =>
          sp?.toLowerCase() === myName?.toLowerCase() ||
          sp?.toLowerCase().includes(myName?.toLowerCase())
      );
      // Only auto-set for non-cashier (admins/managers who want to filter by their name)
      // Cashiers get their data filtered at the DB query level already
      if (match) setSpFilter(match);
    }
  }, [isCashier, user, salesPersons, spFilter]);

  // ─────────────────────────────────────────────────────────────────────────
  // Filter & Sort Pipeline
  // ─────────────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    let res = sales.filter((s) => {
      if (q) {
        const hay = [s.receipt_no, s.customer_name, s.customer_phone, getSP(s), s.mpesa_code]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (payFilter !== 'All') {
        const pm = (s.payment_method || '').toLowerCase();
        if (payFilter === 'M-Pesa') {
          if (!['m-pesa', 'mpesa'].includes(pm)) return false;
        } else if (pm !== payFilter.toLowerCase()) return false;
      }
      if (spFilter && spFilter !== 'All') {
        if (getSP(s) !== spFilter) return false;
      }
      return true;
    });

    if (sortBy === 'newest') {
      res.sort((a, b) => {
        const tA = safeDate(a.sale_datetime || a.sale_date)?.getTime() || 0;
        const tB = safeDate(b.sale_datetime || b.sale_date)?.getTime() || 0;
        return tB - tA;
      });
    } else if (sortBy === 'oldest') {
      res.sort((a, b) => {
        const tA = safeDate(a.sale_datetime || a.sale_date)?.getTime() || 0;
        const tB = safeDate(b.sale_datetime || b.sale_date)?.getTime() || 0;
        return tA - tB;
      });
    } else if (sortBy === 'highest_amount') {
      res.sort((a, b) => (b.total_amount || 0) - (a.total_amount || 0));
    } else if (sortBy === 'highest_profit') {
      res.sort((a, b) => (b.profit || 0) - (a.profit || 0));
    }

    return res;
  }, [sales, search, payFilter, spFilter, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page, pageSize]
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Financial Statistics
  // ─────────────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const txns = filtered.length;
    const totalQty = Object.entries(itemsMap)
      .filter(([sid]) => filtered.find((s) => Number(s.sale_id) === Number(sid)))
      .reduce((s, [, items]) => s + items.reduce((q, it) => q + (it.quantity || 0), 0), 0);

    if (isCashier) {
      // Cashiers see their own sales totals — only profit/cost/margin hidden
      const revenue = filtered.reduce((s, r) => s + (r.total_amount || 0), 0);
      const discount = filtered.reduce((s, r) => s + (r.discount || 0), 0);
      const avg = txns > 0 ? revenue / txns : 0;
      const cashRows = filtered.filter((r) => (r.payment_method || '').toLowerCase() === 'cash');
      const mpesaRows = filtered.filter((r) => ['m-pesa', 'mpesa'].includes((r.payment_method || '').toLowerCase()));
      const cardRows = filtered.filter((r) => (r.payment_method || '').toLowerCase() === 'card');
      const creditRows = filtered.filter((r) => (r.payment_method || '').toLowerCase() === 'credit');
      return {
        txns,
        totalQty,
        revenue,
        discount,
        avg,
        cash: cashRows.reduce((s, r) => s + (r.total_amount || 0), 0),
        mpesa: mpesaRows.reduce((s, r) => s + (r.total_amount || 0), 0),
        card: cardRows.reduce((s, r) => s + (r.total_amount || 0), 0),
        credit: creditRows.reduce((s, r) => s + (r.total_amount || 0), 0),
        profit: 0,   // hidden
        cost: 0,     // hidden
        margin: 0,   // hidden
        cashTxns: cashRows.length,
        mpesaTxns: mpesaRows.length,
        cardTxns: cardRows.length,
        creditTxns: creditRows.length,
        discountTxns: filtered.filter((r) => (r.discount || 0) > 0).length,
        minSale: 0,
        maxSale: 0,
      };
    }

    const revenue = filtered.reduce((s, r) => s + (r.total_amount || 0), 0);
    const cost = filtered.reduce((s, r) => s + (r.total_cost || 0), 0);
    const discount = filtered.reduce((s, r) => s + (r.discount || 0), 0);
    const discountTxns = filtered.filter((r) => (r.discount || 0) > 0).length;
    const avg = txns > 0 ? revenue / txns : 0;
    const profit = filtered.reduce((s, r) => s + (r.profit || 0), 0);
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

    const cashRows = filtered.filter((r) => (r.payment_method || '').toLowerCase() === 'cash');
    const mpesaRows = filtered.filter((r) => ['m-pesa', 'mpesa'].includes((r.payment_method || '').toLowerCase()));
    const cardRows = filtered.filter((r) => (r.payment_method || '').toLowerCase() === 'card');
    const creditRows = filtered.filter((r) => (r.payment_method || '').toLowerCase() === 'credit');

    const cash = cashRows.reduce((s, r) => s + (r.total_amount || 0), 0);
    const mpesa = mpesaRows.reduce((s, r) => s + (r.total_amount || 0), 0);
    const card = cardRows.reduce((s, r) => s + (r.total_amount || 0), 0);
    const credit = creditRows.reduce((s, r) => s + (r.total_amount || 0), 0);

    const amounts = filtered.map((r) => r.total_amount || 0);
    const minSale = amounts.length ? Math.min(...amounts) : 0;
    const maxSale = amounts.length ? Math.max(...amounts) : 0;

    return {
      txns,
      totalQty,
      revenue,
      cost,
      discount,
      avg,
      cash,
      mpesa,
      card,
      credit,
      profit,
      margin,
      cashTxns: cashRows.length,
      mpesaTxns: mpesaRows.length,
      cardTxns: cardRows.length,
      creditTxns: creditRows.length,
      discountTxns,
      minSale,
      maxSale,
    };
  }, [filtered, itemsMap, isCashier]);

  // ─────────────────────────────────────────────────────────────────────────
  // BRAND NEW: Hourly Sales & Peak Velocity Analytics
  // ─────────────────────────────────────────────────────────────────────────
  const hourlyAnalysis = useMemo(() => {
    // 24 slots: 0 to 23
    const slots: Record<
      number,
      {
        hour: number;
        hourWindow: string;
        displayHour: string;
        dayPart: string;
        dayPartColor: string;
        orders: number;
        revenue: number;
        cost: number;
        profit: number;
        units: number;
      }
    > = {};

    for (let h = 0; h < 24; h++) {
      const pad = String(h).padStart(2, '0');
      const nextPad = String((h + 1) % 24).padStart(2, '0');
      const ampm = h >= 12 ? 'PM' : 'AM';
      const h12 = h % 12 === 0 ? 12 : h % 12;

      let dayPart = 'Night / Off-Hours';
      let dayPartColor = 'bg-slate-100 text-slate-700 border-slate-200';
      if (h >= 6 && h < 11) {
        dayPart = 'Morning Rush';
        dayPartColor = 'bg-amber-50 text-amber-800 border-amber-200';
      } else if (h >= 11 && h < 15) {
        dayPart = 'Midday Peak';
        dayPartColor = 'bg-indigo-50 text-indigo-800 border-indigo-200';
      } else if (h >= 15 && h < 18) {
        dayPart = 'Afternoon Trade';
        dayPartColor = 'bg-sky-50 text-sky-800 border-sky-200';
      } else if (h >= 18 && h < 23) {
        dayPart = 'Evening Rush';
        dayPartColor = 'bg-purple-50 text-purple-800 border-purple-200';
      }

      slots[h] = {
        hour: h,
        hourWindow: `${pad}:00 – ${nextPad}:00`,
        displayHour: `${pad}:00 (${h12} ${ampm})`,
        dayPart,
        dayPartColor,
        orders: 0,
        revenue: 0,
        cost: 0,
        profit: 0,
        units: 0,
      };
    }

    let totRev = 0;
    let totOrders = 0;
    let totUnits = 0;
    let totProfit = 0;

    filtered.forEach((s: any) => {
      let h = -1;
      if (s.sale_datetime) {
        const dt = safeDate(s.sale_datetime);
        if (dt) h = dt.getHours();
      }
      if (h === -1 && s.sale_time && typeof s.sale_time === 'string') {
        const parts = s.sale_time.split(':');
        if (parts.length >= 1) {
          const parsed = parseInt(parts[0], 10);
          if (!isNaN(parsed) && parsed >= 0 && parsed <= 23) h = parsed;
        }
      }
      if (h === -1) h = 12; // fallback

      const rev = Number(s.total_amount ?? s.grand_total ?? 0);
      const cost = Number(s.total_cost ?? 0);
      const prof = Number(s.profit ?? (rev - cost));
      const qty = Number(s.total_items ?? s.total_qty ?? 1);

      if (slots[h]) {
        slots[h].orders += 1;
        slots[h].revenue += rev;
        slots[h].cost += cost;
        slots[h].profit += prof;
        slots[h].units += qty;

        totRev += rev;
        totOrders += 1;
        totUnits += qty;
        totProfit += prof;
      }
    });

    const allSlotsList = Object.values(slots).map((sl) => {
      const avgTicket = sl.orders > 0 ? sl.revenue / sl.orders : 0;
      const margin = sl.revenue > 0 ? (sl.profit / sl.revenue) * 100 : 0;
      const pctOfDay = totRev > 0 ? (sl.revenue / totRev) * 100 : 0;
      return {
        ...sl,
        avgTicket,
        margin,
        pctOfDay,
      };
    });

    // Peak identification
    const sortedByRev = [...allSlotsList].sort((a, b) => b.revenue - a.revenue);
    const peakSlot = sortedByRev[0]?.revenue > 0 ? sortedByRev[0] : null;
    const runnerUpSlot = sortedByRev[1]?.revenue > 0 ? sortedByRev[1] : null;

    const sortedByOrders = [...allSlotsList].sort((a, b) => b.orders - a.orders);
    const peakOrdersSlot = sortedByOrders[0]?.orders > 0 ? sortedByOrders[0] : null;

    // Active operational hours filter (6:00 to 22:00 or any slot with sales)
    const activeSlots = allSlotsList.filter((sl) => (sl.hour >= 6 && sl.hour <= 22) || sl.orders > 0);

    // 4 Key Day-Parts Breakdown
    const dayParts = [
      {
        id: 'morning',
        name: 'Morning Rush',
        window: '06:00 AM – 11:00 AM',
        icon: '🌅',
        hours: allSlotsList.filter((h) => h.hour >= 6 && h.hour < 11),
      },
      {
        id: 'midday',
        name: 'Midday Peak',
        window: '11:00 AM – 03:00 PM',
        icon: '☀️',
        hours: allSlotsList.filter((h) => h.hour >= 11 && h.hour < 15),
      },
      {
        id: 'afternoon',
        name: 'Afternoon Trade',
        window: '03:00 PM – 06:00 PM',
        icon: '☕',
        hours: allSlotsList.filter((h) => h.hour >= 15 && h.hour < 18),
      },
      {
        id: 'evening',
        name: 'Evening Rush',
        window: '06:00 PM – 11:00 PM',
        icon: '🌙',
        hours: allSlotsList.filter((h) => h.hour >= 18 && h.hour < 23),
      },
    ].map((dp) => {
      const rev = dp.hours.reduce((s, h) => s + h.revenue, 0);
      const orders = dp.hours.reduce((s, h) => s + h.orders, 0);
      const units = dp.hours.reduce((s, h) => s + h.units, 0);
      const prof = dp.hours.reduce((s, h) => s + h.profit, 0);
      const share = totRev > 0 ? (rev / totRev) * 100 : 0;
      const aov = orders > 0 ? rev / orders : 0;
      return {
        ...dp,
        revenue: rev,
        orders,
        units,
        profit: prof,
        share,
        aov,
      };
    });

    return {
      allSlots: allSlotsList,
      activeSlots: activeSlots.length > 0 ? activeSlots : allSlotsList,
      peakSlot,
      runnerUpSlot,
      peakOrdersSlot,
      totRev,
      totOrders,
      totUnits,
      totProfit,
      dayParts,
    };
  }, [filtered]);

  // ─────────────────────────────────────────────────────────────────────────
  // Linear Daily Trends (Recharts)
  // ─────────────────────────────────────────────────────────────────────────
  const trendData = useMemo(() => {
    const map: Record<string, { date: string; sales: number; profit: number; count: number }> = {};
    filtered.forEach((s) => {
      const dt = safeDate(s.sale_datetime || s.sale_date);
      const d = dt ? dt.toISOString().split('T')[0] : s.sale_date || 'Unknown';
      if (!map[d]) map[d] = { date: d, sales: 0, profit: 0, count: 0 };
      map[d].sales += s.total_amount || 0;
      map[d].profit += s.profit || 0;
      map[d].count += 1;
    });
    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
  }, [filtered]);

  // Payment Breakdown
  const paymentBreakdown = useMemo(() => {
    const map: Record<string, { method: string; count: number; total: number }> = {};
    filtered.forEach((s) => {
      const m = s.payment_method || 'Other';
      if (!map[m]) map[m] = { method: m, count: 0, total: 0 };
      map[m].count += 1;
      map[m].total += s.total_amount || 0;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [filtered]);

  // Salesperson Leaderboard
  const staffBreakdown = useMemo(() => {
    const map: Record<string, { name: string; count: number; revenue: number; profit: number }> = {};
    filtered.forEach((s) => {
      const sp = getSP(s);
      if (!map[sp]) map[sp] = { name: sp, count: 0, revenue: 0, profit: 0 };
      map[sp].count += 1;
      map[sp].revenue += s.total_amount || 0;
      map[sp].profit += s.profit || 0;
    });
    return Object.values(map)
      .map((st) => ({
        ...st,
        avgSale: st.count > 0 ? st.revenue / st.count : 0,
        margin: st.revenue > 0 ? (st.profit / st.revenue) * 100 : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [filtered]);

  // ─────────────────────────────────────────────────────────────────────────
  // Row Expansion & Print Handlers
  // ─────────────────────────────────────────────────────────────────────────
  const toggleRow = async (id: number) => {
    setExpandedRows((prev) => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
    if (!itemsMap[id]) {
      setLoadingItems((prev) => new Set(prev).add(id));
      try {
        const { data, error } = await supabase.from('retail_sales_items').select('*').eq('sale_id', id);
        if (error) console.error('items load error:', error);
        setItemsMap((prev) => ({ ...prev, [id]: data || [] }));
      } catch (e) {
        console.error('items load exception:', e);
      }
      setLoadingItems((prev) => {
        const s = new Set(prev);
        s.delete(id);
        return s;
      });
    }
  };

  const expandAll = async () => {
    const ids = paginated.map((s) => s.sale_id).filter(Boolean);
    setExpandedRows(new Set(ids));
    for (const sid of ids) {
      if (!itemsMap[sid]) {
        try {
          const { data } = await supabase.from('retail_sales_items').select('*').eq('sale_id', sid);
          if (data) setItemsMap((prev) => ({ ...prev, [sid]: data }));
        } catch {}
      }
    }
  };

  const collapseAll = () => {
    setExpandedRows(new Set());
  };

  const copyReceiptNo = (receiptNo: string) => {
    if (!receiptNo) return;
    navigator.clipboard.writeText(receiptNo);
    setCopiedId(receiptNo);
    toast.success(`Copied: ${receiptNo}`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handlePrintReceipt = async (sale: any) => {
    const sid = sale.sale_id;
    let saleItems = itemsMap[sid];
    if (!saleItems) {
      const { data } = await supabase.from('retail_sales_items').select('*').eq('sale_id', sid);
      saleItems = data || [];
      setItemsMap((prev) => ({ ...prev, [sid]: saleItems }));
    }
    try {
      const company = await loadCompanyInfo();
      const dt = safeDate(sale.sale_datetime || sale.sale_date) || new Date();
      const receiptData = {
        invoiceNo: sale.receipt_no || '—',
        date: dt.toLocaleDateString('en-GB'),
        time: dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        cashier: getSP(sale),
        customer: sale.customer_name || 'Walk-in Customer',
        customerPhone: sale.customer_phone || '',
        items: (saleItems || []).map((it: any) => ({
          name: it.product_name || it.item_name || 'Item',
          qty: it.quantity || 1,
          price: it.unit_price || 0,
          total: it.total_price || (it.quantity || 1) * (it.unit_price || 0),
        })),
        subtotal: sale.total_amount || 0,
        discount: sale.discount || 0,
        tax: 0,
        total: sale.total_amount || 0,
        paymentMethod: sale.payment_method || 'Cash',
        amountPaid: sale.total_amount || 0,
        change: 0,
        mpesaCode: sale.mpesa_code || '',
        company: company || undefined,
      };
      printCustomerReceipt(receiptData);
    } catch {
      toast.error('Print preview failed');
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Export Handlers (Excel & CSV)
  // ─────────────────────────────────────────────────────────────────────────
  const exportExcel = () => {
    try {
      const rows = filtered.map((s, idx) => {
        const dt = safeDate(s.sale_datetime || s.sale_date);
        return {
          '#': idx + 1,
          'Receipt No': s.receipt_no || '',
          Date: dt ? dt.toLocaleDateString('en-GB') : s.sale_date || '',
          Time: dt ? dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : s.sale_time || '',
          'Customer Name': s.customer_name || 'Walk-in Customer',
          'Customer Phone': s.customer_phone || '',
          'Sales Person': getSP(s),
          'Payment Method': s.payment_method || 'Cash',
          'M-Pesa Code': s.mpesa_code || '',
          Units: s.total_items || s.total_qty || 1,
          'Cost Price (Ksh)': Number(s.total_cost || 0),
          'Subtotal (Ksh)': Number(s.subtotal || s.total_amount || 0),
          'Discount (Ksh)': Number(s.discount || 0),
          'Total Amount (Ksh)': Number(s.total_amount || 0),
          'Gross Profit (Ksh)': Number(s.profit || 0),
          'Margin %': s.total_amount > 0 ? Number(((s.profit / s.total_amount) * 100).toFixed(1)) : 0,
        };
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Sales Ledger');

      // Add Hourly Sheet
      const hourlyRows = hourlyAnalysis.allSlots.map((h) => ({
        'Hour Slot': h.hourWindow,
        'Day-Part': h.dayPart,
        Transactions: h.orders,
        'Gross Sales (Ksh)': h.revenue,
        '% Day Share': Number(h.pctOfDay.toFixed(1)),
        Units: h.units,
        'Avg Order (Ksh)': Number(h.avgTicket.toFixed(2)),
        'Gross Profit (Ksh)': h.profit,
        'Margin %': Number(h.margin.toFixed(1)),
      }));
      const wsHourly = XLSX.utils.json_to_sheet(hourlyRows);
      XLSX.utils.book_append_sheet(wb, wsHourly, 'Hourly Peak Analysis');

      XLSX.writeFile(wb, `Sales_Report_${dateFrom}_to_${dateTo}.xlsx`);
      toast.success('Excel workbook exported successfully!');
    } catch {
      toast.error('Failed to export Excel workbook');
    }
  };

  const exportCSV = () => {
    try {
      const headers = ['Receipt No', 'Date', 'Time', 'Customer', 'Salesperson', 'Payment', 'Total Amount', 'Profit'];
      const lines = filtered.map((s) => {
        const dt = safeDate(s.sale_datetime || s.sale_date);
        return [
          `"${s.receipt_no || ''}"`,
          `"${dt ? dt.toLocaleDateString('en-GB') : s.sale_date || ''}"`,
          `"${dt ? dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : s.sale_time || ''}"`,
          `"${s.customer_name || 'Walk-in Customer'}"`,
          `"${getSP(s)}"`,
          `"${s.payment_method || 'Cash'}"`,
          Number(s.total_amount || 0),
          Number(s.profit || 0),
        ].join(',');
      });
      const csv = [headers.join(','), ...lines].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Sales_${dateFrom}_${dateTo}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('CSV file exported!');
    } catch {
      toast.error('Failed to export CSV');
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // UI RENDER (Zero Top Blank Space, Screen-Fitting, High-Contrast Headers)
  // ─────────────────────────────────────────────────────────────────────────
  if (!mounted) {
    return (
      <div className="w-full flex items-center justify-center py-20">
        <div className="w-7 h-7 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-full min-w-0 space-y-2 text-slate-800 font-sans">
      <Toaster position="top-right" />

      {/* ═══ 1. COMPACT UNIFIED COMMAND HEADER & WORKSPACE TABS (MATCHING VOTE HEADS) ═══ */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-2.5 sm:p-3 shadow-xs space-y-2">
        {/* Top Bar: Title & Primary Actions */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-700 flex items-center justify-center text-white shadow-xs shrink-0">
              <FiBarChart2 size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base font-black text-slate-900 tracking-tight leading-tight">
                  Full Sales &amp; Revenue Master Report
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {activeOutlet?.outlet_name || 'All Outlets'}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live Ledger
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium leading-none mt-0.5">
                Multi-dimensional sales audit, cashier reconciliation, profit margin intelligence, and itemized invoice registry.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap shrink-0">
            <button
              onClick={loadAll}
              disabled={loading}
              title="Refresh Sales Ledger"
              className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-xs"
            >
              <FiRefreshCw size={12} className={loading ? 'animate-spin text-indigo-600' : ''} />
              <span>Refresh</span>
            </button>

            <button
              onClick={exportExcel}
              className="px-2.5 py-1.5 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-black flex items-center gap-1 shadow-xs transition cursor-pointer"
              title="Download official Microsoft Excel (.xlsx) workbook"
            >
              <FiDownload size={12} className="text-emerald-700" />
              <span>Excel</span>
            </button>

            <button
              onClick={exportCSV}
              className="px-2 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1 shadow-xs transition cursor-pointer"
            >
              <FiFileText size={12} />
              <span>CSV</span>
            </button>

            <button
              onClick={() => window.print()}
              className="px-2 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1 shadow-xs transition cursor-pointer"
            >
              <FiPrinter size={12} />
              <span>Print</span>
            </button>
          </div>
        </div>

        {/* Integrated Workspace Tabs Bar */}
        <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex gap-1 flex-wrap items-center">
            {[
              { id: 'ledger', label: 'Detailed Datagrid', icon: '📊', count: filtered.length, badge: '' },
              {
                id: 'hourly',
                label: 'Hourly Peak Sales & Velocity',
                icon: '🕒',
                count: 0,
                badge: hourlyAnalysis.peakSlot ? `${hourlyAnalysis.peakSlot.displayHour} Peak` : 'Velocity',
                badgeBg: 'bg-amber-100 text-amber-800 font-black animate-pulse',
              },
              {
                id: 'trends',
                label: 'Linear Charts & Trends',
                icon: '📈',
                count: 0,
                badge: 'Recharts',
                badgeBg: 'bg-emerald-100 text-emerald-800',
              },
              {
                id: 'channels',
                label: 'Payment Channels & Mix',
                icon: '💳',
                count: 0,
                badge: 'Tender Mix',
                badgeBg: 'bg-sky-100 text-sky-800',
              },
              {
                id: 'staff',
                label: 'Salesperson Performance',
                icon: '👤',
                count: salesPersons.length,
                badge: 'Leaderboard',
                badgeBg: 'bg-purple-100 text-purple-800',
              },
            ].map((t) => {
              const active = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTab(t.id as any)}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition-all cursor-pointer ${
                    active
                      ? 'bg-amber-600 text-white shadow-md shadow-amber-200'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-bold'
                  }`}
                >
                  <span className="text-xs">{t.icon}</span>
                  <span>{t.label}</span>
                  {t.count > 0 && (
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[9px] font-mono font-black min-w-[16px] text-center ${
                        active ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {t.count}
                    </span>
                  )}
                  {t.badge && !t.count && (
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[8.5px] font-black uppercase ${
                        active ? 'bg-white/25 text-white' : t.badgeBg
                      }`}
                    >
                      {t.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1.5 ml-auto">
            <button
              onClick={() => setShowHudCards((prev) => !prev)}
              className={`px-2 py-1 rounded-xl border text-[10.5px] font-bold flex items-center gap-1 transition cursor-pointer ${
                showHudCards
                  ? 'border-indigo-300 bg-indigo-50 text-indigo-700 font-black'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
              title="Toggle Executive Financial HUD Cards"
            >
              <span>{showHudCards ? '▲ Hide HUD' : '▼ 6 Metrics HUD'}</span>
            </button>

            <button
              onClick={() => setShowStatDrawer((prev) => !prev)}
              className={`px-2 py-1 rounded-xl border text-[10.5px] font-bold flex items-center gap-1 transition cursor-pointer ${
                showStatDrawer
                  ? 'border-indigo-300 bg-indigo-50 text-indigo-700 font-black'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
              title="Toggle all 12 stat chips & breakdown"
            >
              <span>{showStatDrawer ? '▲ Hide Chips' : '▼ 12 Mini Chips'}</span>
            </button>

            <button
              onClick={() => setShowFilters((prev) => !prev)}
              className={`px-2 py-1 rounded-xl border text-[10.5px] font-bold flex items-center gap-1 transition cursor-pointer ${
                showFilters
                  ? 'border-indigo-300 bg-indigo-50 text-indigo-700 font-black'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <FiFilter size={11} />
              <span>{showFilters ? 'Hide Filters' : 'Filters'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ═══ 2. EXECUTIVE FINANCIAL COMMAND HUD (6 LOW-PROFILE CARDS) ═══ */}
      {showHudCards && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {[
            {
              label: 'Gross Sales',
              value: fmt(stats.revenue),
              sub: `${fmtN(stats.txns)} orders · Disc -${fmt(stats.discount)}`,
              color: 'text-indigo-700',
              bg: 'bg-indigo-50 text-indigo-600 border border-indigo-200',
              icon: <FiDollarSign size={13} />,
            },
            {
              label: 'Net Profit',
              value: isCashier ? '—' : fmt(stats.profit),
              sub: isCashier ? 'Manager access only' : `${(stats.margin || 0).toFixed(1)}% margin · Cost ${fmtK(stats.cost)}`,
              color: stats.profit >= 0 ? 'text-emerald-700' : 'text-rose-700',
              bg:
                stats.profit >= 0
                  ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                  : 'bg-rose-50 text-rose-600 border border-rose-200',
              icon: <FiTrendingUp size={13} />,
            },
            {
              label: 'Units Sold',
              value: `${fmtN(stats.totalQty)} Pcs`,
              sub: `Avg order ${fmtK(stats.avg)}`,
              color: 'text-sky-700',
              bg: 'bg-sky-50 text-sky-600 border border-sky-200',
              icon: <FiShoppingBag size={13} />,
            },
            {
              label: 'Cash in Hand',
              value: fmt(stats.cash + creditPaidData.total),
              sub: `Sales: ${fmtK(stats.cash)} + Cr: ${fmtK(creditPaidData.total)}`,
              color: 'text-cyan-700',
              bg: 'bg-cyan-50 text-cyan-600 border border-cyan-200',
              icon: <FiLayers size={13} />,
            },
            {
              label: 'M-Pesa Volume',
              value: fmt(stats.mpesa),
              sub: `${fmtN(stats.mpesaTxns)} txns · ${
                stats.revenue > 0 ? ((stats.mpesa / stats.revenue) * 100).toFixed(1) : 0
              }% share`,
              color: 'text-purple-700',
              bg: 'bg-purple-50 text-purple-600 border border-purple-200',
              icon: <FiActivity size={13} />,
            },
            {
              label: 'Credit Collected',
              value: fmt(creditPaidData.total),
              sub: `${fmtN(creditPaidData.txns)} debt settlements`,
              color: 'text-amber-700',
              bg: 'bg-amber-50 text-amber-600 border border-amber-200',
              icon: <FiCheckCircle size={13} />,
            },
          ].map((k, i) => (
            <div
              key={i}
              className="bg-white border border-slate-200/90 rounded-xl p-2 shadow-xs flex flex-col justify-between hover:border-indigo-300 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="text-[9.5px] font-black text-slate-500 uppercase tracking-wider">{k.label}</span>
                <div className={`w-5 h-5 rounded-lg ${k.bg} flex items-center justify-center shrink-0`}>
                  {k.icon}
                </div>
              </div>
              <div className="mt-1">
                <p className={`text-sm font-black font-mono ${k.color} tracking-tight leading-tight`}>{k.value}</p>
                <p className="text-[9px] text-slate-500 font-bold truncate mt-0.5">{k.sub}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ═══ EXPANDABLE STAT DRAWER (12 MINI CHIPS) ═══ */}
      {showStatDrawer && (
        <div className="space-y-1.5 p-2 rounded-xl bg-slate-100/70 border border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-700">
              Complete 12-Point Stat Registry
            </span>
            <button
              onClick={() => setShowStatDrawer(false)}
              className="text-[11px] text-slate-400 hover:text-slate-600 font-bold cursor-pointer"
            >
              ✕ Close
            </button>
          </div>

          <div className="flex flex-wrap gap-1">
            {[
              { icon: '🛒', label: 'Transactions', value: fmtN(stats.txns), bg: 'bg-indigo-50 text-indigo-800 border-indigo-200' },
              { icon: '📦', label: 'Qty Sold', value: fmtN(stats.totalQty), bg: 'bg-sky-50 text-sky-800 border-sky-200' },
              { icon: '💰', label: 'Total Sales', value: isCashier ? 'Ksh 0.00' : fmt(stats.revenue), bg: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
              { icon: '🏷️', label: 'Discounts', value: isCashier ? 'Ksh 0.00' : fmt(stats.discount), bg: 'bg-amber-50 text-amber-800 border-amber-200' },
              { icon: '📊', label: 'Avg Sale', value: isCashier ? 'Ksh 0.00' : fmt(stats.avg), bg: 'bg-blue-50 text-blue-800 border-blue-200' },
              { icon: '💵', label: 'Cash', value: isCashier ? 'Ksh 0.00' : fmt(stats.cash), bg: 'bg-green-50 text-green-800 border-green-200' },
              { icon: '📱', label: 'M-Pesa', value: isCashier ? 'Ksh 0.00' : fmt(stats.mpesa), bg: 'bg-rose-50 text-rose-800 border-rose-200' },
              { icon: '💳', label: 'Card', value: isCashier ? 'Ksh 0.00' : fmt(stats.card), bg: 'bg-purple-50 text-purple-800 border-purple-200' },
              { icon: '🧾', label: 'Credit (Sales)', value: isCashier ? 'Ksh 0.00' : fmt(stats.credit), bg: 'bg-orange-50 text-orange-800 border-orange-200' },
              { icon: '✅', label: 'Credit Paid', value: isCashier ? 'Ksh 0.00' : fmt(creditPaidData.total), bg: 'bg-lime-50 text-lime-800 border-lime-200' },
              { icon: '🏦', label: 'Cash + Credit Pd', value: isCashier ? 'Ksh 0.00' : fmt(stats.cash + creditPaidData.total), bg: 'bg-cyan-50 text-cyan-800 border-cyan-200' },
              {
                icon: '📈',
                label: 'Profit',
                value: isCashier ? 'Ksh 0.00' : fmt(stats.profit),
                bg: isCashier
                  ? 'bg-gray-50 text-gray-500 border-gray-200'
                  : stats.profit >= 0
                  ? 'bg-teal-50 text-teal-800 border-teal-200'
                  : 'bg-red-50 text-red-800 border-red-200',
              },
            ].map((c, i) => (
              <div key={i} className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs shadow-xs ${c.bg}`}>
                <span className="text-xs">{c.icon}</span>
                <div>
                  <p className="font-bold uppercase tracking-wide opacity-60 text-[8px] leading-none">{c.label}</p>
                  <p className="font-black text-[11px] leading-none font-mono mt-0.5">{c.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ 3. SLEEK FILTERS COCKPIT (ZERO DEAD SPACE) ═══ */}
      {showFilters && (
        <div className="bg-white border border-slate-200/90 rounded-2xl p-2 sm:p-2.5 shadow-xs space-y-1.5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2">
            {/* Left Side: Search + Date Presets */}
            <div className="flex items-center gap-1.5 flex-wrap flex-1">
              {/* Search Bar */}
              <div className="relative flex-1 min-w-[180px]">
                <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search receipt, customer, phone, M-Pesa, salesperson..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="w-full pl-7 pr-6 py-1 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 bg-slate-50/70 focus:bg-white outline-none transition"
                />
                {search && (
                  <button
                    onClick={() => {
                      setSearch('');
                      setPage(1);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Date Presets */}
              <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200/80 gap-0.5">
                {[
                  { label: 'Today', from: toDay(), to: toDay() },
                  { label: 'Yesterday', from: getYesterday(), to: getYesterday() },
                  { label: '7D', from: getDaysAgo(6), to: toDay() },
                  { label: '30D', from: getDaysAgo(29), to: toDay() },
                  { label: 'Month', from: firstOfMonth(), to: toDay() },
                ].map((p) => {
                  const isSel = dateFrom === p.from && dateTo === p.to;
                  return (
                    <button
                      key={p.label}
                      onClick={() => {
                        setDateFrom(p.from);
                        setDateTo(p.to);
                        setPage(1);
                      }}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                        isSel
                          ? 'bg-white text-indigo-700 shadow-xs font-black'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>

              {/* Exact Dates */}
              <div className="flex items-center gap-1">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => {
                    setDateFrom(e.target.value);
                    setPage(1);
                  }}
                  className="px-2 py-1 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 bg-slate-50 focus:bg-white outline-none cursor-pointer"
                />
                <span className="text-slate-400 text-xs">to</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => {
                    setDateTo(e.target.value);
                    setPage(1);
                  }}
                  className="px-2 py-1 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 bg-slate-50 focus:bg-white outline-none cursor-pointer"
                />
              </div>
            </div>

            {/* Right Side: Payment, Salesperson, Sort */}
            <div className="flex items-center gap-1.5 flex-wrap shrink-0">
              <select
                value={payFilter}
                onChange={(e) => {
                  setPayFilter(e.target.value);
                  setPage(1);
                }}
                className="px-2 py-1 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 bg-slate-50 focus:bg-white outline-none cursor-pointer"
              >
                {PAY_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m === 'All' ? '💳 All Payments' : m}
                  </option>
                ))}
              </select>

              <select
                value={spFilter}
                onChange={(e) => {
                  setSpFilter(e.target.value);
                  setPage(1);
                }}
                className="px-2 py-1 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 bg-slate-50 focus:bg-white outline-none cursor-pointer"
              >
                <option value="">👤 All Staff</option>
                {salesPersons.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-2 py-1 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 bg-slate-50 focus:bg-white outline-none cursor-pointer"
              >
                <option value="newest">Sort: Newest</option>
                <option value="oldest">Sort: Oldest</option>
                <option value="highest_amount">Sort: Highest Amount</option>
                <option value="highest_profit">Sort: Highest Profit</option>
              </select>

              {(search || payFilter !== 'All' || spFilter) && (
                <button
                  onClick={() => {
                    setSearch('');
                    setPayFilter('All');
                    setSpFilter('');
                    setSortBy('newest');
                    setPage(1);
                  }}
                  className="px-2 py-1 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-xs font-bold hover:bg-rose-100 transition cursor-pointer"
                  title="Clear all active search and filter parameters"
                >
                  Reset
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══ TAB 1: DETAILED DATAGRID (LIGHT THEME — VISIBLE HEADINGS, UNIFORM FONTS, NO HANGING) ═══ */}
      {activeTab === 'ledger' && (
        <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
          {/* Datagrid Toolbar */}
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-200 bg-slate-50/80 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-700">
                {loading ? (
                  <span className="text-indigo-600 animate-pulse font-bold">Loading records...</span>
                ) : (
                  <>
                    <strong className="text-indigo-700">{fmtN(filtered.length)}</strong> transactions
                    {filtered.length !== sales.length && (
                      <span className="text-slate-400 font-normal"> (filtered from {fmtN(sales.length)})</span>
                    )}
                  </>
                )}
              </span>

              <div className="hidden sm:flex items-center gap-1.5 ml-2 border-l border-slate-200 pl-2.5">
                <button
                  onClick={expandAll}
                  className="text-[11px] font-medium text-slate-500 hover:text-indigo-600 transition cursor-pointer"
                >
                  Expand All
                </button>
                <span className="text-slate-300">·</span>
                <button
                  onClick={collapseAll}
                  className="text-[11px] font-medium text-slate-500 hover:text-slate-700 transition cursor-pointer"
                >
                  Collapse All
                </button>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Per Page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="border border-slate-200 rounded-lg px-1.5 py-0.5 text-xs font-medium text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400 cursor-pointer"
              >
                {PAGE_SIZES.map((s) => (
                  <option key={s} value={s}>
                    {s} rows
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Table Container - Fits Screen Cleanly without Right Cut-off */}
          <div className="w-full overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              {/* High-Contrast Light Header (Deep slate #0f172a, 100% visible) */}
              <thead className="bg-slate-100 border-b-2 border-slate-300">
                <tr className="bg-slate-100 border-b-2 border-slate-300">
                  <th
                    style={{ color: '#0f172a' }}
                    className="py-2.5 px-2.5 w-7 text-center font-black uppercase text-[10.5px] tracking-wider text-slate-900 border-r border-slate-200"
                  >
                    #
                  </th>
                  <th
                    style={{ color: '#0f172a' }}
                    className="py-2.5 px-3 whitespace-nowrap font-black uppercase text-[10.5px] tracking-wider text-slate-900 border-r border-slate-200"
                  >
                    Receipt No
                  </th>
                  <th
                    style={{ color: '#0f172a' }}
                    className="py-2.5 px-3 whitespace-nowrap font-black uppercase text-[10.5px] tracking-wider text-slate-900 border-r border-slate-200"
                  >
                    Date
                  </th>
                  <th
                    style={{ color: '#0f172a' }}
                    className="py-2.5 px-2.5 whitespace-nowrap font-black uppercase text-[10.5px] tracking-wider text-slate-900 border-r border-slate-200"
                  >
                    Time
                  </th>
                  <th
                    style={{ color: '#0f172a' }}
                    className="py-2.5 px-3 whitespace-nowrap font-black uppercase text-[10.5px] tracking-wider text-slate-900 border-r border-slate-200"
                  >
                    Customer
                  </th>
                  <th
                    style={{ color: '#0f172a' }}
                    className="py-2.5 px-3 whitespace-nowrap font-black uppercase text-[10.5px] tracking-wider text-slate-900 border-r border-slate-200"
                  >
                    Sales Person
                  </th>
                  <th
                    style={{ color: '#0f172a' }}
                    className="py-2.5 px-3 whitespace-nowrap text-center font-black uppercase text-[10.5px] tracking-wider text-slate-900 border-r border-slate-200"
                  >
                    Payment
                  </th>
                  <th
                    style={{ color: '#0f172a' }}
                    className="py-2.5 px-3 whitespace-nowrap font-black uppercase text-[10.5px] tracking-wider text-slate-900 border-r border-slate-200"
                  >
                    M-Pesa Code
                  </th>
                  <th
                    style={{ color: '#0f172a' }}
                    className="py-2.5 px-2.5 whitespace-nowrap text-center font-black uppercase text-[10.5px] tracking-wider text-slate-900 border-r border-slate-200"
                  >
                    Units
                  </th>
                  <th
                    style={{ color: '#0f172a' }}
                    className="py-2.5 px-3 whitespace-nowrap text-right font-black uppercase text-[10.5px] tracking-wider text-slate-900 border-r border-slate-200"
                  >
                    Cost Price
                  </th>
                  <th
                    style={{ color: '#0f172a' }}
                    className="py-2.5 px-3 whitespace-nowrap text-right font-black uppercase text-[10.5px] tracking-wider text-slate-900 border-r border-slate-200"
                  >
                    Subtotal
                  </th>
                  <th
                    style={{ color: '#0f172a' }}
                    className="py-2.5 px-3 whitespace-nowrap text-right font-black uppercase text-[10.5px] tracking-wider text-slate-900 border-r border-slate-200"
                  >
                    Total Amount
                  </th>
                  <th
                    style={{ color: '#0f172a' }}
                    className="py-2.5 px-3 whitespace-nowrap text-right font-black uppercase text-[10.5px] tracking-wider text-slate-900 border-r border-slate-200"
                  >
                    Profit
                  </th>
                  <th
                    style={{ color: '#0f172a' }}
                    className="py-2.5 px-2.5 whitespace-nowrap text-center font-black uppercase text-[10.5px] tracking-wider text-slate-900"
                  >
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={14} className="py-16 text-center">
                      <div className="w-7 h-7 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-2" />
                      <p className="text-slate-400 text-xs font-semibold">Loading sales records...</p>
                    </td>
                  </tr>
                ) : paginated.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="py-16 text-center text-slate-400">
                      <FiSearch size={28} className="mx-auto mb-2 text-slate-300" />
                      <p className="text-xs font-semibold">No sales transactions matched your filter criteria.</p>
                      <button
                        onClick={() => {
                          setSearch('');
                          setPayFilter('All');
                          setSpFilter('');
                          setDateFrom(toDay());
                          setDateTo(toDay());
                        }}
                        className="mt-2 text-indigo-600 hover:underline text-xs font-bold cursor-pointer"
                      >
                        Reset filters to Today
                      </button>
                    </td>
                  </tr>
                ) : (
                  paginated.map((sale) => {
                    const sid = sale.sale_id;
                    const isExp = expandedRows.has(sid);
                    const isRet = returnedSales.has(sale.receipt_no);
                    const dt = safeDate(sale.sale_datetime || sale.sale_date);
                    const childItems = itemsMap[sid] || [];
                    const isItemLoading = loadingItems.has(sid);
                    const profitVal = Number(sale.profit || 0);

                    return (
                      <React.Fragment key={sid}>
                        <tr
                          className={`hover:bg-indigo-50/40 transition-colors ${
                            isExp ? 'bg-indigo-50/30' : ''
                          } ${isRet ? 'bg-amber-50/30' : ''}`}
                        >
                          {/* 1. Expand Toggle */}
                          <td className="py-2 px-2.5 text-center border-r border-slate-100">
                            <button
                              onClick={() => toggleRow(sid)}
                              className="p-1 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-slate-100 transition cursor-pointer"
                              title="Toggle line items"
                            >
                              {isExp ? <FiChevronUp size={13} /> : <FiChevronDown size={13} />}
                            </button>
                          </td>

                          {/* 2. Receipt No (Copyable) */}
                          <td className="py-2 px-3 whitespace-nowrap border-r border-slate-100 font-mono text-xs">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-indigo-700 hover:underline cursor-pointer" onClick={() => toggleRow(sid)}>
                                {sale.receipt_no || '—'}
                              </span>
                              <button
                                onClick={() => copyReceiptNo(sale.receipt_no)}
                                className="text-slate-300 hover:text-slate-600 transition"
                                title="Copy receipt number"
                              >
                                {copiedId === sale.receipt_no ? <FiCheck size={11} className="text-emerald-600" /> : <FiCopy size={11} />}
                              </button>
                              {isRet && (
                                <span className="px-1 py-0.2 rounded text-[8.5px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                  RET
                                </span>
                              )}
                            </div>
                          </td>

                          {/* 3. Date */}
                          <td className="py-2 px-3 whitespace-nowrap font-mono text-xs text-slate-600 border-r border-slate-100">
                            {dt ? dt.toLocaleDateString('en-GB') : sale.sale_date || '—'}
                          </td>

                          {/* 4. Time */}
                          <td className="py-2 px-2.5 whitespace-nowrap font-mono text-xs text-slate-500 border-r border-slate-100">
                            {dt
                              ? dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
                              : sale.sale_time || '—'}
                          </td>

                          {/* 5. Customer (Uniform text-xs font-medium text-slate-800) */}
                          <td className="py-2 px-3 whitespace-nowrap border-r border-slate-100">
                            <div className="text-xs font-medium text-slate-800 truncate max-w-[150px]">
                              {sale.customer_name || 'Walk-in Customer'}
                            </div>
                            {sale.customer_phone && (
                              <div className="font-mono text-[10.5px] text-slate-400">{sale.customer_phone}</div>
                            )}
                          </td>

                          {/* 6. Sales Person (Uniform text-xs font-medium text-slate-700) */}
                          <td className="py-2 px-3 whitespace-nowrap text-xs font-medium text-slate-700 border-r border-slate-100">
                            <div className="flex items-center gap-1.5 truncate max-w-[140px]">
                              <FiUser size={11} className="text-slate-400 shrink-0" />
                              <span className="truncate">{getSP(sale)}</span>
                            </div>
                          </td>

                          {/* 7. Payment (Clean Uniform Bdg) */}
                          <td className="py-2 px-3 whitespace-nowrap text-center border-r border-slate-100">
                            <Bdg txt={sale.payment_method || 'Cash'} color={payColor(sale.payment_method)} />
                          </td>

                          {/* 8. M-Pesa Code */}
                          <td className="py-2 px-3 whitespace-nowrap font-mono text-[11px] text-slate-600 border-r border-slate-100">
                            {sale.mpesa_code ? (
                              <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                                {sale.mpesa_code}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>

                          {/* 9. Units */}
                          <td className="py-2 px-2.5 whitespace-nowrap text-center font-mono text-xs text-slate-700 border-r border-slate-100 font-medium">
                            {sale.total_items ?? sale.total_qty ?? '—'}
                          </td>

                          {/* 10. Cost Price — hidden from cashiers */}
                          <td className="py-2 px-3 whitespace-nowrap text-right font-mono text-xs text-slate-600 border-r border-slate-100">
                            {isCashier ? <span className="text-slate-300 text-[10px]">—</span> : fmt(sale.total_cost || 0)}
                          </td>

                          {/* 11. Subtotal — cashiers CAN see this */}
                          <td className="py-2 px-3 whitespace-nowrap text-right font-mono text-xs text-slate-600 border-r border-slate-100">
                            {fmt(sale.subtotal || sale.total_amount || 0)}
                          </td>

                          {/* 12. Total Amount — cashiers CAN see this */}
                          <td className="py-2 px-3 whitespace-nowrap text-right font-mono text-xs font-semibold text-slate-900 border-r border-slate-100">
                            {fmt(sale.total_amount || 0)}
                          </td>

                          {/* 13. Profit — hidden from cashiers */}
                          <td className="py-2 px-3 whitespace-nowrap text-right font-mono text-xs font-semibold border-r border-slate-100">
                            {isCashier ? (
                              <span className="text-slate-300 text-[10px]">—</span>
                            ) : (
                              <span
                                className={`px-1.5 py-0.5 rounded border ${
                                  profitVal >= 0
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80'
                                    : 'bg-rose-50 text-rose-700 border-rose-200/80'
                                }`}
                              >
                                {profitVal >= 0 ? `+${fmt(profitVal)}` : fmt(profitVal)}
                              </span>
                            )}
                          </td>

                          {/* 14. Action */}
                          <td className="py-2 px-2.5 whitespace-nowrap text-center">
                            <button
                              onClick={() => handlePrintReceipt(sale)}
                              className="p-1 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-indigo-600 transition shadow-2xs cursor-pointer"
                              title="Print customer receipt"
                            >
                              <FiPrinter size={12} />
                            </button>
                          </td>
                        </tr>

                        {/* Expandable Line Items Drawer */}
                        {isExp && (
                          <tr className="bg-slate-50/70 border-b border-slate-200">
                            <td colSpan={14} className="p-3 pl-8">
                              <div className="bg-white border border-slate-200 rounded-xl p-2.5 shadow-2xs">
                                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-slate-800">
                                      Line Items for Receipt: <code className="text-indigo-600 font-mono">{sale.receipt_no}</code>
                                    </span>
                                    <span className="text-[11px] text-slate-400">({childItems.length} items recorded)</span>
                                  </div>
                                  <button
                                    onClick={() => handlePrintReceipt(sale)}
                                    className="px-2 py-0.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-700 flex items-center gap-1 transition"
                                  >
                                    <FiPrinter size={11} /> Print Receipt
                                  </button>
                                </div>

                                {isItemLoading ? (
                                  <div className="py-4 text-center text-xs text-slate-400 animate-pulse">
                                    Loading itemized line records...
                                  </div>
                                ) : childItems.length === 0 ? (
                                  <div className="py-3 text-center text-xs text-slate-400">
                                    No item-level details captured for this sale record.
                                  </div>
                                ) : (
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs">
                                      <thead>
                                        <tr className="text-[10px] font-black uppercase text-slate-400 border-b border-slate-100">
                                          <th className="py-1 px-2">Product Name</th>
                                          <th className="py-1 px-2 font-mono">Barcode / SKU</th>
                                          <th className="py-1 px-2 text-center">Qty</th>
                                          <th className="py-1 px-2 text-right">Unit Price</th>
                                          <th className="py-1 px-2 text-right">Line Total</th>
                                          {!isCashier && <th className="py-1 px-2 text-right">Profit</th>}
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-50">
                                        {childItems.map((it: any, idx: number) => {
                                          const itCost = (it.cost_price || 0) * (it.quantity || 1);
                                          const itTotal = it.total_price || (it.unit_price || 0) * (it.quantity || 1);
                                          const itProf = itTotal - itCost;
                                          return (
                                            <tr key={idx} className="hover:bg-slate-50">
                                              <td className="py-1.5 px-2 font-medium text-slate-800">
                                                {it.product_name || it.item_name || 'Item'}
                                              </td>
                                              <td className="py-1.5 px-2 font-mono text-[10.5px] text-slate-500">
                                                {it.barcode || it.sku || '—'}
                                              </td>
                                              <td className="py-1.5 px-2 text-center font-mono font-bold text-slate-700">
                                                {it.quantity || 1}
                                              </td>
                                              <td className="py-1.5 px-2 text-right font-mono text-slate-600">
                                                {fmt(it.unit_price || 0)}
                                              </td>
                                              <td className="py-1.5 px-2 text-right font-mono font-semibold text-slate-900">
                                                {fmt(itTotal)}
                                              </td>
                                              {!isCashier && (
                                                <td
                                                  className={`py-1.5 px-2 text-right font-mono text-xs font-semibold ${
                                                    itProf >= 0 ? 'text-emerald-600' : 'text-rose-600'
                                                  }`}
                                                >
                                                  {fmt(itProf)}
                                                </td>
                                              )}
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>

              {/* High-Contrast Integrated Table Footer (NO Detached Black Bar, Fits Columns) */}
              <tfoot className="bg-slate-100 border-t-2 border-slate-300 text-slate-900 font-bold">
                <tr>
                  <td colSpan={4} className="py-2.5 px-3 text-left border-r border-slate-200">
                    <span className="uppercase tracking-wider text-[11px] font-black text-slate-800">Grand Total:</span>
                    <span className="font-mono text-slate-900 text-xs font-black ml-1.5">
                      {fmtN(filtered.length)} Records
                    </span>
                    {stats.discount > 0 && (
                      <span className="text-amber-700 text-[10.5px] ml-2 font-mono font-bold">
                        Disc -{fmt(stats.discount)}
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-xs text-slate-500 font-medium border-r border-slate-200 truncate">
                    Store Ledger
                  </td>
                  <td className="py-2.5 px-3 text-xs text-slate-600 font-medium border-r border-slate-200 truncate">
                    {salesPersons.length} Staff
                  </td>
                  <td className="py-2.5 px-3 text-center border-r border-slate-200">
                    <span className="text-[10px] font-mono font-bold text-slate-600">{payFilter}</span>
                  </td>
                  <td className="py-2.5 px-3 font-mono text-[11px] text-slate-400 border-r border-slate-200">—</td>
                  <td className="py-2.5 px-2.5 text-center font-mono text-xs font-black text-slate-900 border-r border-slate-200">
                    {fmtN(stats.totalQty)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-xs font-semibold text-slate-700 border-r border-slate-200">
                    {isCashier ? '—' : fmt(stats.cost)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-xs font-semibold text-slate-700 border-r border-slate-200">
                    {isCashier ? '—' : fmt(stats.revenue + stats.discount)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-xs font-black text-indigo-950 bg-indigo-50/70 border-r border-slate-200">
                    {isCashier ? '—' : fmt(stats.revenue)}
                  </td>
                  <td
                    className={`py-2.5 px-3 text-right font-mono text-xs font-black border-r border-slate-200 ${
                      stats.profit >= 0 ? 'text-emerald-800 bg-emerald-50/70' : 'text-rose-800 bg-rose-50/70'
                    }`}
                  >
                    {isCashier ? '—' : fmt(stats.profit)}
                  </td>
                  <td className="py-2.5 px-2.5 text-center text-[10px] text-slate-400">—</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Seamless Executive Pagination Bar */}
          <div className="flex items-center justify-between px-3 py-2 border-t border-slate-200 bg-slate-50/80 text-xs text-slate-600 shrink-0">
            <div>
              Showing <strong className="text-slate-800">{filtered.length === 0 ? 0 : (page - 1) * pageSize + 1}</strong> to{' '}
              <strong className="text-slate-800">{Math.min(page * pageSize, filtered.length)}</strong> of{' '}
              <strong className="text-slate-800">{fmtN(filtered.length)}</strong> entries
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(1)}
                disabled={page <= 1}
                className="px-2 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 text-xs font-semibold transition cursor-pointer"
              >
                « First
              </button>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-2 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 text-xs font-semibold transition cursor-pointer"
              >
                ‹ Prev
              </button>

              <div className="flex items-center gap-1 px-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pNum = i + 1;
                  if (totalPages > 5 && page > 3) {
                    pNum = Math.min(page - 2 + i, totalPages);
                  }
                  return (
                    <button
                      key={pNum}
                      onClick={() => setPage(pNum)}
                      className={`w-7 h-7 rounded-lg text-xs font-black transition cursor-pointer ${
                        page === pNum
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {pNum}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-2 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 text-xs font-semibold transition cursor-pointer"
              >
                Next ›
              </button>
              <button
                onClick={() => setPage(totalPages)}
                disabled={page >= totalPages}
                className="px-2 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 text-xs font-semibold transition cursor-pointer"
              >
                Last »
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ TAB 2: BRAND NEW HOURLY SALES & PEAK VELOCITY ANALYTICS ═══ */}
      {activeTab === 'hourly' && (
        <div className="space-y-2.5">
          {/* 1. Peak Velocity Trading Banner */}
          <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 rounded-2xl p-3 text-white shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-white text-xl shrink-0">
                  ⚡
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10.5px] font-black uppercase tracking-wider bg-black/20 px-2 py-0.5 rounded-full">
                      Peak Velocity Window
                    </span>
                    <span className="text-xs font-bold text-amber-100">
                      {dateFrom === dateTo ? `Date: ${dateFrom}` : `${dateFrom} to ${dateTo}`}
                    </span>
                  </div>
                  <h3 className="text-base sm:text-lg font-black tracking-tight mt-0.5">
                    {hourlyAnalysis.peakSlot
                      ? `🔥 Highest Sales Velocity: ${hourlyAnalysis.peakSlot.displayHour} (${hourlyAnalysis.peakSlot.hourWindow})`
                      : 'No trading transactions in active filter'}
                  </h3>
                  <p className="text-xs text-amber-50 font-medium">
                    {hourlyAnalysis.peakSlot
                      ? `Generated ${fmt(hourlyAnalysis.peakSlot.revenue)} across ${hourlyAnalysis.peakSlot.orders} invoices (${hourlyAnalysis.peakSlot.pctOfDay.toFixed(1)}% of total daily volume).`
                      : 'Expand date filters or select another trading day.'}
                  </p>
                </div>
              </div>

              {hourlyAnalysis.runnerUpSlot && (
                <div className="bg-white/15 backdrop-blur-xs rounded-xl p-2 px-3 border border-white/20 shrink-0 text-right md:text-left">
                  <span className="text-[9.5px] uppercase tracking-wider text-amber-100 font-bold block">
                    Runner-up Peak Hour
                  </span>
                  <span className="text-xs font-black text-white block">
                    {hourlyAnalysis.runnerUpSlot.displayHour} — {fmt(hourlyAnalysis.runnerUpSlot.revenue)}
                  </span>
                  <span className="text-[10px] text-amber-100 font-mono block">
                    {hourlyAnalysis.runnerUpSlot.orders} orders handled
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* 2. Four Day-Part Heat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {hourlyAnalysis.dayParts.map((dp) => (
              <div
                key={dp.id}
                className="bg-white border border-slate-200/90 rounded-2xl p-2.5 shadow-xs flex flex-col justify-between hover:border-amber-300 transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-base">{dp.icon}</span>
                      <h4 className="text-xs font-black text-slate-800">{dp.name}</h4>
                    </div>
                    <span className="px-1.5 py-0.5 rounded text-[9.5px] font-mono font-bold bg-slate-100 text-slate-600">
                      {dp.share.toFixed(1)}% Day
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium mt-0.5">{dp.window}</p>
                </div>

                <div className="mt-2 pt-2 border-t border-slate-100">
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm font-black font-mono text-slate-900">{fmt(dp.revenue)}</span>
                    <span className="text-[11px] font-mono font-bold text-slate-600">{fmtN(dp.orders)} txns</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono mt-1">
                    <span>Avg Ticket: {fmt(dp.aov)}</span>
                    <span className="text-emerald-700 font-bold">Profit: {fmtK(dp.profit)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 3. Recharts Hourly Composed Volume Chart */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-3 shadow-xs">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FiClock className="text-amber-600" size={15} />
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                  Hourly Revenue &amp; Transaction Velocity (00:00 – 23:00)
                </h3>
              </div>
              <span className="text-[10.5px] font-mono text-slate-500">
                Total Day Sales: <strong className="text-slate-900 font-bold">{fmt(hourlyAnalysis.totRev)}</strong>
              </span>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={hourlyAnalysis.activeSlots} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="displayHour" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={{ stroke: '#e2e8f0' }} />
                  <YAxis
                    yAxisId="left"
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    tickFormatter={(v) => fmtK(v)}
                    axisLine={{ stroke: '#e2e8f0' }}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 10, fill: '#10b981' }}
                    axisLine={{ stroke: '#e2e8f0' }}
                  />
                  <RechartsTooltip
                    formatter={(val: any, name: any) => [
                      name === 'Gross Sales' ? fmt(Number(val)) : fmtN(Number(val)),
                      name,
                    ]}
                    labelFormatter={(label) => `Trading Window: ${label}`}
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderRadius: '12px',
                      color: '#fff',
                      fontSize: '11px',
                      border: 'none',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }} />
                  <Bar
                    yAxisId="left"
                    dataKey="revenue"
                    name="Gross Sales"
                    fill="#f59e0b"
                    radius={[4, 4, 0, 0]}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="orders"
                    name="Transactions Count"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: '#10b981' }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 4. Super Premium Hourly Breakdown Datagrid */}
          <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
            <div className="px-3 py-2 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between">
              <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
                Itemized Hourly Trading Registry &amp; Margin Velocity
              </span>
              <span className="text-[11px] font-mono text-slate-500">24 Operational Slots</span>
            </div>

            <div className="w-full overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 border-b-2 border-slate-300">
                  <tr className="bg-slate-100 border-b-2 border-slate-300">
                    <th style={{ color: '#0f172a' }} className="py-2.5 px-3 font-black uppercase text-[10.5px] border-r border-slate-200">
                      Hour Window
                    </th>
                    <th style={{ color: '#0f172a' }} className="py-2.5 px-3 font-black uppercase text-[10.5px] border-r border-slate-200">
                      Day-Part
                    </th>
                    <th style={{ color: '#0f172a' }} className="py-2.5 px-3 text-center font-black uppercase text-[10.5px] border-r border-slate-200">
                      Orders
                    </th>
                    <th style={{ color: '#0f172a' }} className="py-2.5 px-3 text-right font-black uppercase text-[10.5px] border-r border-slate-200">
                      Gross Sales (Ksh)
                    </th>
                    <th style={{ color: '#0f172a' }} className="py-2.5 px-3 font-black uppercase text-[10.5px] border-r border-slate-200">
                      % Day Share
                    </th>
                    <th style={{ color: '#0f172a' }} className="py-2.5 px-3 text-center font-black uppercase text-[10.5px] border-r border-slate-200">
                      Units Sold
                    </th>
                    <th style={{ color: '#0f172a' }} className="py-2.5 px-3 text-right font-black uppercase text-[10.5px] border-r border-slate-200">
                      Avg Order (AOV)
                    </th>
                    <th style={{ color: '#0f172a' }} className="py-2.5 px-3 text-right font-black uppercase text-[10.5px] border-r border-slate-200">
                      Gross Profit
                    </th>
                    <th style={{ color: '#0f172a' }} className="py-2.5 px-3 text-right font-black uppercase text-[10.5px] border-r border-slate-200">
                      Margin %
                    </th>
                    <th style={{ color: '#0f172a' }} className="py-2.5 px-3 text-center font-black uppercase text-[10.5px]">
                      Velocity Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {hourlyAnalysis.activeSlots.map((sl) => {
                    const isPeak = hourlyAnalysis.peakSlot?.hour === sl.hour;
                    const isRunner = hourlyAnalysis.runnerUpSlot?.hour === sl.hour;

                    return (
                      <tr
                        key={sl.hour}
                        className={`hover:bg-slate-50 transition-colors ${
                          isPeak ? 'bg-amber-50/50 font-semibold' : ''
                        }`}
                      >
                        {/* Hour Window */}
                        <td className="py-2 px-3 whitespace-nowrap font-mono text-xs font-bold text-slate-800 border-r border-slate-100">
                          {sl.hourWindow}
                        </td>

                        {/* Day-Part */}
                        <td className="py-2 px-3 whitespace-nowrap border-r border-slate-100">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${sl.dayPartColor}`}>
                            {sl.dayPart}
                          </span>
                        </td>

                        {/* Orders */}
                        <td className="py-2 px-3 text-center font-mono text-xs font-bold text-slate-700 border-r border-slate-100">
                          {fmtN(sl.orders)}
                        </td>

                        {/* Gross Sales */}
                        <td className="py-2 px-3 text-right font-mono text-xs font-bold text-slate-900 border-r border-slate-100">
                          {fmt(sl.revenue)}
                        </td>

                        {/* % Day Share with visual mini bar */}
                        <td className="py-2 px-3 border-r border-slate-100">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  isPeak ? 'bg-amber-500' : 'bg-indigo-500'
                                }`}
                                style={{ width: `${Math.min(100, sl.pctOfDay)}%` }}
                              />
                            </div>
                            <span className="font-mono text-[10.5px] font-bold text-slate-600">
                              {sl.pctOfDay.toFixed(1)}%
                            </span>
                          </div>
                        </td>

                        {/* Units Sold */}
                        <td className="py-2 px-3 text-center font-mono text-xs text-slate-700 border-r border-slate-100 font-medium">
                          {fmtN(sl.units)}
                        </td>

                        {/* AOV */}
                        <td className="py-2 px-3 text-right font-mono text-xs text-slate-600 border-r border-slate-100">
                          {fmt(sl.avgTicket)}
                        </td>

                        {/* Profit */}
                        <td className="py-2 px-3 text-right font-mono text-xs font-semibold text-emerald-700 border-r border-slate-100">
                          {fmt(sl.profit)}
                        </td>

                        {/* Margin % */}
                        <td className="py-2 px-3 text-right font-mono text-xs text-slate-600 border-r border-slate-100">
                          {sl.margin.toFixed(1)}%
                        </td>

                        {/* Velocity Status */}
                        <td className="py-2 px-3 text-center">
                          {isPeak ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-white shadow-2xs">
                              🔥 PEAK HOUR
                            </span>
                          ) : isRunner ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-800 border border-orange-200">
                              ⚡ RUNNER UP
                            </span>
                          ) : sl.orders > 0 ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Normal Active
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-300 font-mono">Quiet</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-slate-100 border-t-2 border-slate-300 font-bold text-slate-900">
                  <tr>
                    <td colSpan={2} className="py-2.5 px-3 uppercase text-[11px] font-black border-r border-slate-200">
                      Total 24-Hour Velocity
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-xs font-black border-r border-slate-200">
                      {fmtN(hourlyAnalysis.totOrders)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-xs font-black text-indigo-900 border-r border-slate-200">
                      {fmt(hourlyAnalysis.totRev)}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] font-black text-slate-700 border-r border-slate-200">
                      100.0%
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-xs font-bold border-r border-slate-200">
                      {fmtN(hourlyAnalysis.totUnits)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-xs text-slate-600 border-r border-slate-200">
                      {hourlyAnalysis.totOrders > 0
                        ? fmt(hourlyAnalysis.totRev / hourlyAnalysis.totOrders)
                        : 'Ksh 0.00'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-xs font-black text-emerald-800 border-r border-slate-200">
                      {fmt(hourlyAnalysis.totProfit)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-xs text-slate-700 border-r border-slate-200">
                      {hourlyAnalysis.totRev > 0
                        ? `${((hourlyAnalysis.totProfit / hourlyAnalysis.totRev) * 100).toFixed(1)}%`
                        : '0.0%'}
                    </td>
                    <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[10px]">—</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══ TAB 3: LINEAR TRENDS & ANALYTICS (RECHARTS) ═══ */}
      {activeTab === 'trends' && (
        <div className="space-y-2.5">
          <div className="bg-white border border-slate-200/90 rounded-2xl p-3 shadow-xs">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FiTrendingUp className="text-indigo-600" size={16} />
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                  Revenue vs Profit Daily Trajectory
                </h3>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                {trendData.length} data point{trendData.length !== 1 ? 's' : ''} in view
              </span>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.5} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={{ stroke: '#e2e8f0' }} />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    tickFormatter={(v) => fmtK(v)}
                    axisLine={{ stroke: '#e2e8f0' }}
                  />
                  <RechartsTooltip
                    formatter={(val: any, name: any) => [fmt(Number(val)), name]}
                    labelFormatter={(label) => `Date: ${label}`}
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderRadius: '12px',
                      color: '#fff',
                      fontSize: '11px',
                      border: 'none',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }} />
                  <Area
                    type="monotone"
                    dataKey="sales"
                    name="Gross Sales"
                    stroke="#4f46e5"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorSales)"
                  />
                  <Area
                    type="monotone"
                    dataKey="profit"
                    name="Gross Profit"
                    stroke="#10b981"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorProfit)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* ═══ TAB 4: PAYMENT CHANNELS & TENDER MIX ═══ */}
      {activeTab === 'channels' && (
        <div className="space-y-2.5">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-2.5">
            {/* Pie Chart Card */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-3 shadow-xs flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-2 pb-1 border-b border-slate-100 flex items-center gap-1.5">
                  <FiPieChart className="text-indigo-600" />
                  <span>Tender Mix Share</span>
                </h3>
                <div className="h-56 w-full flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={paymentBreakdown}
                        dataKey="total"
                        nameKey="method"
                        cx="50%"
                        cy="50%"
                        outerRadius={75}
                        innerRadius={45}
                        paddingAngle={3}
                      >
                        {paymentBreakdown.map((_, idx) => (
                          <Cell key={`cell-${idx}`} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        formatter={(val: any, name: any) => [fmt(Number(val)), name]}
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          borderRadius: '12px',
                          color: '#fff',
                          fontSize: '11px',
                          border: 'none',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 justify-center pt-2 border-t border-slate-100">
                {paymentBreakdown.map((pm, idx) => (
                  <div key={pm.method} className="flex items-center gap-1.5 text-[10.5px]">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}
                    />
                    <span className="font-semibold text-slate-700">{pm.method}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Itemized Channel Cards */}
            <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {paymentBreakdown.map((pm, idx) => {
                const pct = stats.revenue > 0 ? (pm.total / stats.revenue) * 100 : 0;
                return (
                  <div
                    key={pm.method}
                    className="bg-white border border-slate-200/90 rounded-2xl p-3 shadow-xs flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}
                        />
                        <h4 className="text-xs font-black text-slate-900">{pm.method} Tender</h4>
                      </div>
                      <span className="font-mono text-xs font-bold text-slate-500">{fmtN(pm.count)} txns</span>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-100">
                      <div className="flex items-baseline justify-between">
                        <span className="text-sm font-black font-mono text-slate-900">{fmt(pm.total)}</span>
                        <span className="text-xs font-mono font-bold text-indigo-600">{pct.toFixed(1)}% Share</span>
                      </div>
                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-1.5">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(100, pct)}%`,
                            backgroundColor: PIE_COLORS[idx % PIE_COLORS.length],
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ═══ TAB 5: SALESPERSON PERFORMANCE LEADERBOARD ═══ */}
      {activeTab === 'staff' && (
        <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
          <div className="px-3 py-2 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between">
            <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
              Sales Personnel Performance Registry &amp; Profit Contribution
            </span>
            <span className="text-[11px] font-mono text-slate-500">{staffBreakdown.length} Cashiers / Staff</span>
          </div>

          <div className="w-full overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 border-b-2 border-slate-300">
                <tr className="bg-slate-100 border-b-2 border-slate-300">
                  <th style={{ color: '#0f172a' }} className="py-2.5 px-3 text-center w-14 font-black uppercase text-[10.5px]">
                    Rank
                  </th>
                  <th style={{ color: '#0f172a' }} className="py-2.5 px-3 font-black uppercase text-[10.5px]">
                    Sales Person
                  </th>
                  <th style={{ color: '#0f172a' }} className="py-2.5 px-3 text-center font-black uppercase text-[10.5px]">
                    Invoices
                  </th>
                  <th style={{ color: '#0f172a' }} className="py-2.5 px-3 text-right font-black uppercase text-[10.5px]">
                    Gross Sales
                  </th>
                  <th style={{ color: '#0f172a' }} className="py-2.5 px-3 text-right font-black uppercase text-[10.5px]">
                    Avg Order
                  </th>
                  <th style={{ color: '#0f172a' }} className="py-2.5 px-3 text-right font-black uppercase text-[10.5px]">
                    Profit Generated
                  </th>
                  <th style={{ color: '#0f172a' }} className="py-2.5 px-3 text-center font-black uppercase text-[10.5px]">
                    Share
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {staffBreakdown.map((st, idx) => {
                  const sharePct = stats.revenue > 0 ? (st.revenue / stats.revenue) * 100 : 0;
                  return (
                    <tr key={st.name} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2 px-3 text-center">
                        <span
                          className={`inline-flex items-center justify-center w-6 h-6 rounded-lg text-xs font-bold font-mono ${
                            idx === 0
                              ? 'bg-amber-500 text-white'
                              : idx === 1
                              ? 'bg-slate-400 text-white'
                              : idx === 2
                              ? 'bg-amber-700 text-white'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          #{idx + 1}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-xs font-medium text-slate-800">
                        {st.name}
                      </td>
                      <td className="py-2 px-3 text-center font-mono text-xs text-slate-700 font-medium">
                        {fmtN(st.count)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-xs font-semibold text-slate-900">
                        {fmt(st.revenue)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-xs text-slate-600">
                        {fmt(st.avgSale)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-xs font-semibold text-emerald-600">
                        {fmt(st.profit)}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 font-mono">
                          {sharePct.toFixed(1)}%
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
