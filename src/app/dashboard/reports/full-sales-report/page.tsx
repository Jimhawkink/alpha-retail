'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';
import toast, { Toaster } from 'react-hot-toast';
import { printCustomerReceipt, loadCompanyInfo } from '@/lib/receiptPrinter';
import * as XLSX from 'xlsx';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
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
  FiArrowRight,
  FiFileText,
  FiDollarSign,
  FiTrendingUp,
  FiLayers,
  FiCheckCircle,
  FiCalendar,
  FiClock,
  FiSliders,
  FiPieChart,
  FiShoppingBag,
  FiActivity,
  FiArrowUpRight,
  FiArrowDownRight,
  FiCheck,
  FiMaximize2,
  FiMinimize2,
  FiCreditCard,
  FiShield,
  FiAward,
} from 'react-icons/fi';

// ─────────────────────────────────────────────────────────────────────────────
// Formatters & Date Helpers
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

const PAY_METHODS = ['All', 'Cash', 'M-Pesa', 'Card', 'Credit', 'Split'];
const PAGE_SIZES = [25, 50, 100, 200];
const PIE_COLORS = ['#10B981', '#0284C7', '#8B5CF6', '#F59E0B', '#EC4899', '#64748B'];

// ─────────────────────────────────────────────────────────────────────────────
// Badge Component
// ─────────────────────────────────────────────────────────────────────────────
function Bdg({ txt, color }: { txt: string; color: string }) {
  const c: Record<string, string> = {
    green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    blue: 'bg-sky-50 text-sky-700 border-sky-200',
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
    rose: 'bg-rose-50 text-rose-700 border-rose-200',
    gray: 'bg-slate-100 text-slate-600 border-slate-200',
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold border whitespace-nowrap ${
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
  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem('user') || '{}');
      setUser(u);
      setIsCashier(['cashier', 'waiter'].includes((u.userType || u.user_type || '').toLowerCase()));
    } catch {}
  }, []);

  // Workspace Navigation Tabs
  const [activeTab, setActiveTab] = useState<'ledger' | 'trends' | 'channels' | 'staff'>('ledger');

  // Filters
  const [dateFrom, setDateFrom] = useState(toDay());
  const [dateTo, setDateTo] = useState(toDay());
  const [search, setSearch] = useState('');
  const [payFilter, setPayFilter] = useState('All');
  const [spFilter, setSpFilter] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'highest_amount' | 'highest_profit'>('newest');
  const [showFilters, setShowFilters] = useState(true);

  // Data
  const [sales, setSales] = useState<any[]>([]);
  const [itemsMap, setItemsMap] = useState<Record<number, any[]>>({});
  const [loadingItems, setLoadingItems] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Returned & Credit Collections Data
  const [returnedSales, setReturnedSales] = useState<Set<string>>(new Set());
  const [creditPaidData, setCreditPaidData] = useState({ total: 0, txns: 0, cashPaid: 0, mpesaPaid: 0 });

  const searchInputRef = useRef<HTMLInputElement>(null);

  // ─────────────────────────────────────────────────────────────────────────
  // Data Loader
  // ─────────────────────────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setLoading(true);
    setExpandedRows(new Set());
    setItemsMap({});

    const outletId = activeOutlet?.outlet_id;
    try {
      let salesData: any[] = [];
      if (outletId) {
        const r = await supabase
          .from('retail_sales')
          .select('*')
          .eq('outlet_id', outletId)
          .gte('sale_date', dateFrom)
          .lte('sale_date', dateTo)
          .order('sale_datetime', { ascending: false })
          .limit(3000);
        if (!r.error) salesData = r.data || [];
      }
      if (!salesData.length) {
        const r2 = await supabase
          .from('retail_sales')
          .select('*')
          .gte('sale_date', dateFrom)
          .lte('sale_date', dateTo)
          .order('sale_datetime', { ascending: false })
          .limit(3000);
        salesData = r2.data || [];
      }
      setSales(salesData);

      // Load return identifiers
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
  }, [activeOutlet?.outlet_id, dateFrom, dateTo]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Helpers
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
    () => [...new Set(sales.map(getSP).filter((s) => s !== '—'))].sort(),
    [sales]
  );

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
      res.sort((a, b) => new Date(b.sale_datetime || b.sale_date).getTime() - new Date(a.sale_datetime || a.sale_date).getTime());
    } else if (sortBy === 'oldest') {
      res.sort((a, b) => new Date(a.sale_datetime || a.sale_date).getTime() - new Date(b.sale_datetime || b.sale_date).getTime());
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
      return {
        txns,
        totalQty,
        revenue: 0,
        discount: 0,
        avg: 0,
        cash: 0,
        mpesa: 0,
        card: 0,
        credit: 0,
        profit: 0,
        cost: 0,
        cashTxns: 0,
        mpesaTxns: 0,
        cardTxns: 0,
        creditTxns: 0,
        discountTxns: 0,
        minSale: 0,
        maxSale: 0,
        margin: 0,
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
  // Linear Trend / Chart Analytics Aggregators
  // ─────────────────────────────────────────────────────────────────────────
  const trendData = useMemo(() => {
    const isSingleDay = dateFrom === dateTo;
    const grouped: Record<string, { label: string; revenue: number; profit: number; count: number; cost: number }> = {};

    filtered.forEach((sale) => {
      let key = '';
      let displayLabel = '';
      const dt = new Date(sale.sale_datetime || sale.sale_date);

      if (isSingleDay) {
        const hour = isNaN(dt.getHours()) ? '12:00' : `${String(dt.getHours()).padStart(2, '0')}:00`;
        key = hour;
        displayLabel = hour;
      } else {
        key = sale.sale_date || dt.toISOString().split('T')[0];
        displayLabel = new Date(key).toLocaleDateString('en-KE', { month: 'short', day: 'numeric' });
      }

      if (!grouped[key]) {
        grouped[key] = { label: displayLabel, revenue: 0, profit: 0, count: 0, cost: 0 };
      }
      grouped[key].revenue += sale.total_amount || 0;
      grouped[key].profit += sale.profit || 0;
      grouped[key].cost += sale.total_cost || 0;
      grouped[key].count += 1;
    });

    return Object.keys(grouped)
      .sort()
      .map((k) => grouped[k]);
  }, [filtered, dateFrom, dateTo]);

  // Payment Breakdown for Pie & Cards
  const paymentBreakdownData = useMemo(() => {
    const methods: Record<string, { name: string; value: number; count: number }> = {};
    filtered.forEach((s) => {
      let m = (s.payment_method || 'Other').toUpperCase();
      if (m === 'MPESA') m = 'M-PESA';
      if (!methods[m]) methods[m] = { name: m, value: 0, count: 0 };
      methods[m].value += s.total_amount || 0;
      methods[m].count += 1;
    });
    return Object.values(methods).sort((a, b) => b.value - a.value);
  }, [filtered]);

  // Salesperson Leaderboard Data
  const staffLeaderboard = useMemo(() => {
    const staffMap: Record<string, { name: string; revenue: number; profit: number; count: number; avgSale: number }> = {};
    filtered.forEach((s) => {
      const sp = getSP(s);
      if (!staffMap[sp]) {
        staffMap[sp] = { name: sp, revenue: 0, profit: 0, count: 0, avgSale: 0 };
      }
      staffMap[sp].revenue += s.total_amount || 0;
      staffMap[sp].profit += s.profit || 0;
      staffMap[sp].count += 1;
    });
    const arr = Object.values(staffMap);
    arr.forEach((item) => {
      item.avgSale = item.count > 0 ? item.revenue / item.count : 0;
    });
    return arr.sort((a, b) => b.revenue - a.revenue);
  }, [filtered]);

  // ─────────────────────────────────────────────────────────────────────────
  // Row Expansion & Item Fetching
  // ─────────────────────────────────────────────────────────────────────────
  const toggleRow = async (saleId: number) => {
    const id = Number(saleId);
    setExpandedRows((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
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
    const allIds = paginated.map((s) => Number(s.sale_id));
    setExpandedRows(new Set(allIds));
    // Fetch any missing
    for (const sid of allIds) {
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

  // ─────────────────────────────────────────────────────────────────────────
  // Reprint Receipt Handler
  // ─────────────────────────────────────────────────────────────────────────
  const reprintSale = async (sale: any, e: React.MouseEvent) => {
    e.stopPropagation();
    const sid = Number(sale.sale_id);
    let saleItems = itemsMap[sid];
    if (!saleItems) {
      const { data } = await supabase.from('retail_sales_items').select('*').eq('sale_id', sid);
      saleItems = data || [];
      setItemsMap((prev) => ({ ...prev, [sid]: saleItems }));
    }
    try {
      const company = await loadCompanyInfo();
      const d = new Date(sale.sale_datetime || sale.sale_date);
      const receiptData = {
        invoiceNo: sale.receipt_no || '—',
        date: d.toLocaleDateString('en-GB'),
        time: d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        cashier: sale.created_by || sale.salesperson_name || 'Cashier',
        items:
          saleItems.length > 0
            ? saleItems.map((it: any) => ({
                name: it.product_name || 'Item',
                qty: it.quantity || 1,
                price: it.unit_price || 0,
                total: it.subtotal || (it.unit_price || 0) * (it.quantity || 1),
              }))
            : [{ name: '(Standard Sale)', qty: 1, price: sale.total_amount || 0, total: sale.total_amount || 0 }],
        subtotal: sale.subtotal || sale.total_amount || 0,
        discount: sale.discount || 0,
        tax: 0,
        total: sale.total_amount || 0,
        paymentMethod: sale.payment_method || 'CASH',
        amountPaid: sale.amount_paid || sale.total_amount || 0,
        change: sale.change_amount || 0,
        customerName: sale.customer_name || undefined,
        customerPhone: sale.customer_phone || undefined,
        mpesaReceipt: sale.mpesa_code || undefined,
        isPaid: true,
      };
      printCustomerReceipt(receiptData, company);
      toast.success(`Reprinting receipt ${sale.receipt_no}`);
    } catch (err) {
      console.error('Reprint error:', err);
      toast.error('Failed to trigger receipt reprint');
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Official Excel & CSV Export
  // ─────────────────────────────────────────────────────────────────────────
  const exportExcel = () => {
    try {
      const rows = filtered.map((s) => ({
        'Receipt No': s.receipt_no || '—',
        Date: s.sale_date,
        Time: s.sale_datetime ? new Date(s.sale_datetime).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' }) : s.sale_time || '',
        'Customer Name': s.customer_name || 'Walk-in',
        'Customer Phone': s.customer_phone || '',
        'Salesperson / Cashier': getSP(s),
        'Payment Method': s.payment_method || 'CASH',
        'M-Pesa Reference': s.mpesa_code || '',
        'Subtotal (KES)': s.subtotal || 0,
        'Discount (KES)': s.discount || 0,
        'Cost Amount (KES)': s.total_cost || 0,
        'Total Amount (KES)': s.total_amount || 0,
        'Gross Profit (KES)': s.profit || 0,
        Status: s.status || 'Completed',
      }));

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Sales Ledger');
      XLSX.writeFile(wb, `Sales-Master-Ledger-${dateFrom}-to-${dateTo}.xlsx`);
      toast.success('Excel workbook downloaded successfully! ✓');
    } catch (e: any) {
      console.error(e);
      toast.error('Failed to export Excel workbook');
    }
  };

  const exportCSV = () => {
    const h = [
      'Receipt',
      'Date',
      'Time',
      'Customer',
      'Phone',
      'Sales Person',
      'Payment',
      'M-Pesa Code',
      'Subtotal',
      'Discount',
      'Total Cost',
      'Total',
      'Profit',
      'Status',
    ];
    const rows = filtered.map((s) => [
      s.receipt_no,
      s.sale_date,
      s.sale_datetime ? new Date(s.sale_datetime).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' }) : '',
      s.customer_name || 'Walk-in',
      s.customer_phone || '',
      getSP(s),
      s.payment_method || '',
      s.mpesa_code || '',
      s.subtotal,
      s.discount,
      s.total_cost,
      s.total_amount,
      s.profit,
      s.status || '',
    ]);
    const csv = [h, ...rows].map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Sales-Report-${dateFrom}-to-${dateTo}.csv`;
    a.click();
    toast.success('CSV report exported successfully');
  };

  // ─────────────────────────────────────────────────────────────────────────
  // UI RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3.5 pb-10 max-w-[1600px] mx-auto text-slate-800 p-3 sm:p-4 font-sans">
      <Toaster position="top-right" />

      {/* ═══ 1. COMPACT EXECUTIVE COMMAND HEADER (MATCHING VOTE HEADS) ═══ */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-xs shrink-0">
              <FiBarChart2 size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                  Full Sales &amp; Revenue Master Report
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {activeOutlet?.outlet_name || 'All Outlets'}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  ● Live Ledger
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Executive revenue analytics, cashier settlement breakdown, itemized invoice registry, and linear trends.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={loadAll}
              disabled={loading}
              title="Refresh Sales Ledger"
              className="p-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <FiRefreshCw size={13} className={loading ? 'animate-spin text-indigo-600' : ''} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <button
              onClick={exportExcel}
              className="px-3 py-1.5 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-extrabold flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
              title="Download official Microsoft Excel (.xlsx) workbook"
            >
              <FiDownload size={13} className="text-emerald-700" />
              <span>Excel Workbook</span>
            </button>

            <button
              onClick={exportCSV}
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
            >
              <FiFileText size={13} />
              <span>CSV</span>
            </button>

            <button
              onClick={() => window.print()}
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
            >
              <FiPrinter size={13} />
              <span>Print</span>
            </button>
          </div>
        </div>
      </div>

      {/* ═══ 2. STANDALONE ULTRA-PREMIUM WORKSPACE TAB BAR ═══ */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-2 print:hidden">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex gap-1.5 flex-wrap items-center">
            {[
              { id: 'ledger', label: 'Detailed Datagrid', icon: '📊', count: filtered.length, badge: '' },
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
                badge: 'Cash / MPesa',
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
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black whitespace-nowrap transition-all cursor-pointer ${
                    active
                      ? 'bg-amber-600 text-white shadow-md shadow-amber-200'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-bold'
                  }`}
                >
                  <span className="text-sm">{t.icon}</span>
                  <span>{t.label}</span>
                  {t.count > 0 && (
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-[9.5px] font-mono font-black min-w-[18px] text-center ${
                        active ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {t.count}
                    </span>
                  )}
                  {t.badge && !t.count && (
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase ${
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

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters((prev) => !prev)}
              className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                showFilters
                  ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <FiFilter size={12} />
              <span>{showFilters ? 'Hide Controls' : 'Show Controls'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ═══ 3. EXECUTIVE FINANCIAL COMMAND HUD (6 LOW-PROFILE CARDS) ═══ */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {[
          {
            label: 'Gross Revenue',
            value: isCashier ? 'Ksh 0.00' : fmtK(stats.revenue),
            sub: `${fmtN(stats.txns)} total transactions`,
            color: 'text-emerald-700',
            bg: 'bg-emerald-50/70',
            border: 'border-emerald-100',
            icon: <FiDollarSign size={14} className="text-emerald-600" />,
          },
          {
            label: 'Net Profit',
            value: isCashier ? 'Ksh 0.00' : fmtK(stats.profit),
            sub: `${(stats.margin || 0).toFixed(1)}% profit margin`,
            color: stats.profit >= 0 ? 'text-teal-700' : 'text-rose-700',
            bg: 'bg-teal-50/70',
            border: 'border-teal-100',
            icon: <FiTrendingUp size={14} className="text-teal-600" />,
          },
          {
            label: 'Quantity Sold',
            value: `${fmtN(stats.totalQty)} Units`,
            sub: `Avg sale ${isCashier ? '0' : fmtK(stats.avg)}`,
            color: 'text-indigo-700',
            bg: 'bg-indigo-50/70',
            border: 'border-indigo-100',
            icon: <FiShoppingBag size={14} className="text-indigo-600" />,
          },
          {
            label: 'Cash in Hand',
            value: isCashier ? 'Ksh 0.00' : fmtK(stats.cash + creditPaidData.total),
            sub: `Sales cash + credit recvd`,
            color: 'text-cyan-700',
            bg: 'bg-cyan-50/70',
            border: 'border-cyan-100',
            icon: <FiLayers size={14} className="text-cyan-600" />,
          },
          {
            label: 'M-Pesa Volume',
            value: isCashier ? 'Ksh 0.00' : fmtK(stats.mpesa),
            sub: `${fmtN(stats.mpesaTxns)} mobile payments`,
            color: 'text-purple-700',
            bg: 'bg-purple-50/70',
            border: 'border-purple-100',
            icon: <FiActivity size={14} className="text-purple-600" />,
          },
          {
            label: 'Credit Payments',
            value: isCashier ? 'Ksh 0.00' : fmtK(creditPaidData.total),
            sub: `${fmtN(creditPaidData.txns)} payments recorded`,
            color: 'text-amber-700',
            bg: 'bg-amber-50/70',
            border: 'border-amber-100',
            icon: <FiCheckCircle size={14} className="text-amber-600" />,
          },
        ].map((k, i) => (
          <div
            key={i}
            className={`bg-white border ${k.border} rounded-xl p-2.5 shadow-2xs flex flex-col justify-between`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{k.label}</span>
              <div className={`w-6 h-6 rounded-lg ${k.bg} flex items-center justify-center shrink-0`}>{k.icon}</div>
            </div>
            <div className="mt-1">
              <p className={`text-sm font-extrabold font-mono ${k.color} tracking-tight`}>{k.value}</p>
              <p className="text-[9.5px] text-slate-400 font-medium truncate">{k.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ═══ 4. SIDE-TO-SIDE COCKPIT / ULTRA-LATEST FILTERS ═══ */}
      {showFilters && (
        <div className="bg-white border border-slate-200/90 rounded-2xl p-3 shadow-xs space-y-2.5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
            {/* Left Side: Search + Date Presets */}
            <div className="flex items-center gap-2 flex-wrap flex-1">
              {/* Search Bar */}
              <div className="relative flex-1 min-w-[220px]">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search receipt, customer, phone, M-Pesa, salesperson..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="w-full pl-8 pr-7 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 bg-slate-50/70 focus:bg-white outline-none transition"
                />
                {search && (
                  <button
                    onClick={() => {
                      setSearch('');
                      setPage(1);
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                  >
                    ×
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
                      className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold transition cursor-pointer ${
                        isSel
                          ? 'bg-white text-indigo-700 shadow-2xs font-extrabold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>

              {/* Exact Dates */}
              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => {
                    setDateFrom(e.target.value);
                    setPage(1);
                  }}
                  className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-slate-50 focus:bg-white outline-none cursor-pointer"
                />
                <span className="text-slate-400 text-xs font-bold">to</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => {
                    setDateTo(e.target.value);
                    setPage(1);
                  }}
                  className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-slate-50 focus:bg-white outline-none cursor-pointer"
                />
              </div>
            </div>

            {/* Right Side: Payment, Salesperson, Sort */}
            <div className="flex items-center gap-2 flex-wrap shrink-0">
              <select
                value={payFilter}
                onChange={(e) => {
                  setPayFilter(e.target.value);
                  setPage(1);
                }}
                className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-slate-50 focus:bg-white outline-none cursor-pointer"
              >
                {PAY_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m === 'All' ? '💳 All Payment Methods' : `💳 ${m}`}
                  </option>
                ))}
              </select>

              <select
                value={spFilter}
                onChange={(e) => {
                  setSpFilter(e.target.value);
                  setPage(1);
                }}
                className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-slate-50 focus:bg-white outline-none cursor-pointer"
              >
                <option value="">👤 All Sales Staff</option>
                {salesPersons.map((p) => (
                  <option key={p} value={p}>
                    👤 {p}
                  </option>
                ))}
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-slate-50 focus:bg-white outline-none cursor-pointer"
              >
                <option value="newest">⚡ Sort: Newest First</option>
                <option value="oldest">⏳ Sort: Oldest First</option>
                <option value="highest_amount">💰 Sort: Highest Amount</option>
                <option value="highest_profit">📈 Sort: Highest Profit</option>
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
                  className="px-2.5 py-1.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-xs font-bold hover:bg-rose-100 transition cursor-pointer"
                  title="Clear all active search and filter parameters"
                >
                  Reset
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══ TAB 1: DETAILED DATAGRID (LIGHT THEME — NOT BLACK!) ═══ */}
      {activeTab === 'ledger' && (
        <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
          {/* Datagrid Toolbar */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 bg-slate-50/50 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700">
                {loading ? (
                  <span className="text-indigo-600 animate-pulse font-extrabold">Loading sales records...</span>
                ) : (
                  <>
                    <strong className="text-indigo-700">{fmtN(filtered.length)}</strong> records found
                    {filtered.length !== sales.length && (
                      <span className="text-slate-400 font-normal"> (filtered from {fmtN(sales.length)})</span>
                    )}
                  </>
                )}
              </span>

              <div className="hidden sm:flex items-center gap-1.5 ml-2 border-l border-slate-200 pl-3">
                <button
                  onClick={expandAll}
                  className="text-[11px] font-bold text-slate-500 hover:text-indigo-600 transition cursor-pointer"
                >
                  Expand Page
                </button>
                <span className="text-slate-300">·</span>
                <button
                  onClick={collapseAll}
                  className="text-[11px] font-bold text-slate-500 hover:text-slate-700 transition cursor-pointer"
                >
                  Collapse All
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400 font-bold">Rows per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400 cursor-pointer"
              >
                {PAGE_SIZES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/90 border-b border-slate-200 text-[10px] font-black uppercase text-slate-500 tracking-wider sticky top-0 z-10 backdrop-blur-xs">
                  <th className="py-2.5 px-3 w-8 text-center" />
                  <th className="py-2.5 px-3 whitespace-nowrap">Receipt No</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Date</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Time</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Customer &amp; Phone</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Sales Person</th>
                  <th className="py-2.5 px-3 whitespace-nowrap text-center">Payment</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">M-Pesa Code</th>
                  <th className="py-2.5 px-3 whitespace-nowrap text-center">Units</th>
                  <th className="py-2.5 px-3 whitespace-nowrap text-right">Cost Price</th>
                  <th className="py-2.5 px-3 whitespace-nowrap text-right">Subtotal</th>
                  <th className="py-2.5 px-3 whitespace-nowrap text-right">Total Amount</th>
                  <th className="py-2.5 px-3 whitespace-nowrap text-right">Profit</th>
                  <th className="py-2.5 px-3 whitespace-nowrap text-center">Status &amp; Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={14} className="py-20 text-center">
                      <div className="w-8 h-8 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-2" />
                      <p className="text-slate-400 text-xs font-medium">Synchronizing live sales records...</p>
                    </td>
                  </tr>
                ) : paginated.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="py-20 text-center">
                      <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-slate-200 text-slate-400">
                        <FiFileText size={24} />
                      </div>
                      <h3 className="text-sm font-extrabold text-slate-800">No Sales Transactions Found</h3>
                      <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                        No transactions match your current filters or date range ({dateFrom} to {dateTo}).
                      </p>
                    </td>
                  </tr>
                ) : (
                  paginated.map((sale, idx) => {
                    const sid = Number(sale.sale_id);
                    const isExp = expandedRows.has(sid);
                    const items: any[] = itemsMap[sid] || [];
                    const rowQty = items.reduce((s, it) => s + (it.quantity || 0), 0);
                    const rowBg = idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40';

                    return (
                      <React.Fragment key={sid}>
                        <tr
                          onClick={() => toggleRow(sid)}
                          className={`${rowBg} hover:bg-indigo-50/40 transition-colors cursor-pointer group`}
                        >
                          {/* Expand chevron */}
                          <td className="py-2.5 px-3 text-center">
                            <FiChevronDown
                              size={13}
                              className={`transition-transform duration-200 ${
                                isExp ? 'rotate-180 text-indigo-600' : 'text-slate-400 group-hover:text-indigo-500'
                              }`}
                            />
                          </td>

                          {/* Receipt */}
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span className="font-mono font-extrabold text-indigo-600 hover:underline">
                              {sale.receipt_no || '—'}
                            </span>
                          </td>

                          {/* Date */}
                          <td className="py-2.5 px-3 whitespace-nowrap font-medium text-slate-700">
                            {sale.sale_date}
                          </td>

                          {/* Time */}
                          <td className="py-2.5 px-3 whitespace-nowrap font-mono text-[11px] text-slate-500">
                            {sale.sale_datetime
                              ? new Date(sale.sale_datetime).toLocaleTimeString('en-KE', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : sale.sale_time || '—'}
                          </td>

                          {/* Customer */}
                          <td className="py-2.5 px-3 max-w-[150px]">
                            <div className="font-bold text-slate-900 truncate">
                              {sale.customer_name || 'Walk-in Customer'}
                            </div>
                            {sale.customer_phone && (
                              <div className="text-[10px] text-slate-400 font-mono">{sale.customer_phone}</div>
                            )}
                          </td>

                          {/* Sales Person */}
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                                <FiUser size={10} />
                              </span>
                              <span className="text-slate-700 font-medium truncate max-w-[100px]">
                                {getSP(sale)}
                              </span>
                            </div>
                          </td>

                          {/* Payment Method */}
                          <td className="py-2.5 px-3 whitespace-nowrap text-center">
                            <Bdg txt={sale.payment_method} color={payColor(sale.payment_method)} />
                          </td>

                          {/* M-Pesa Code */}
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            {sale.mpesa_code ? (
                              <span className="font-mono text-[10px] bg-emerald-50 text-emerald-800 font-bold px-1.5 py-0.5 rounded border border-emerald-200">
                                {sale.mpesa_code}
                              </span>
                            ) : (
                              <span className="text-slate-300 font-mono">—</span>
                            )}
                          </td>

                          {/* Units */}
                          <td className="py-2.5 px-3 whitespace-nowrap text-center">
                            {rowQty > 0 ? (
                              <span className="font-mono font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-full text-[10px] border border-sky-200">
                                {fmtN(rowQty)}
                              </span>
                            ) : (
                              <span className="text-slate-300 font-mono">—</span>
                            )}
                          </td>

                          {/* Cost */}
                          <td className="py-2.5 px-3 whitespace-nowrap text-right font-mono text-slate-500">
                            {fmt(sale.total_cost)}
                          </td>

                          {/* Subtotal */}
                          <td className="py-2.5 px-3 whitespace-nowrap text-right font-mono text-slate-700">
                            {fmt(sale.subtotal)}
                          </td>

                          {/* Total */}
                          <td className="py-2.5 px-3 whitespace-nowrap text-right font-mono font-black text-slate-900">
                            {fmt(sale.total_amount)}
                          </td>

                          {/* Profit */}
                          <td className="py-2.5 px-3 whitespace-nowrap text-right font-mono font-extrabold">
                            {isCashier ? (
                              <span className="text-slate-400">0.00</span>
                            ) : sale.profit !== null && sale.profit !== undefined ? (
                              <span className={(sale.profit || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                                {(sale.profit || 0) >= 0 ? '+' : ''}
                                {fmt(sale.profit)}
                              </span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>

                          {/* Status & Action */}
                          <td className="py-2.5 px-3 whitespace-nowrap text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <Bdg
                                txt={sale.status || 'Completed'}
                                color={['Completed', 'Paid'].includes(sale.status) ? 'green' : 'amber'}
                              />
                              {returnedSales.has(sale.receipt_no) && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-rose-100 text-rose-700 border border-rose-200">
                                  ↩ Returned
                                </span>
                              )}
                              <button
                                onClick={(e) => reprintSale(sale, e)}
                                title="Reprint Official Customer Receipt"
                                className="p-1.5 rounded-lg border border-slate-200 hover:border-indigo-300 bg-white hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 transition cursor-pointer shadow-2xs"
                              >
                                <FiPrinter size={12} />
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* ── EXPANDED INVOICE ITEMS SUB-TABLE (LIGHT THEME) ── */}
                        {isExp && (
                          <tr key={`items-${sid}`}>
                            <td colSpan={14} className="px-6 py-3.5 bg-slate-50/80 border-y border-slate-200">
                              {loadingItems.has(sid) ? (
                                <div className="flex items-center gap-2 py-3 text-indigo-600 text-xs font-bold">
                                  <div className="w-4 h-4 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
                                  <span>Fetching itemized breakdown...</span>
                                </div>
                              ) : items.length === 0 ? (
                                <p className="text-slate-400 text-xs italic py-2 flex items-center gap-2">
                                  <span>📦</span> No detailed line items recorded for this invoice.
                                </p>
                              ) : (
                                <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                                  <div className="px-3.5 py-2 bg-slate-100/80 border-b border-slate-200 flex items-center justify-between">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-600">
                                      Invoice Line Items ({items.length})
                                    </span>
                                    <span className="text-[10px] font-mono text-slate-500 font-bold">
                                      Receipt: {sale.receipt_no}
                                    </span>
                                  </div>
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-wider border-b border-slate-200">
                                        <th className="px-3 py-2 text-left w-10">#</th>
                                        <th className="px-3 py-2 text-left">Product Name</th>
                                        <th className="px-3 py-2 text-center">Qty</th>
                                        <th className="px-3 py-2 text-right">Cost Price</th>
                                        <th className="px-3 py-2 text-right">Unit Price</th>
                                        <th className="px-3 py-2 text-right">Line Total</th>
                                        <th className="px-3 py-2 text-right">Profit</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                      {items.map((it, i) => {
                                        const qty = it.quantity || 0;
                                        const lineProfit = it.profit || 0;
                                        return (
                                          <tr key={it.item_id || i} className="hover:bg-slate-50/50">
                                            <td className="px-3 py-2 text-slate-400 font-mono text-[10px]">{i + 1}</td>
                                            <td className="px-3 py-2 font-bold text-slate-800">{it.product_name}</td>
                                            <td className="px-3 py-2 text-center font-mono font-bold text-indigo-600">
                                              {qty}
                                            </td>
                                            <td className="px-3 py-2 text-right font-mono text-slate-500">
                                              {(it.cost_price || 0) > 0 ? fmt(it.cost_price) : '—'}
                                            </td>
                                            <td className="px-3 py-2 text-right font-mono text-slate-700">
                                              {fmt(it.unit_price)}
                                            </td>
                                            <td className="px-3 py-2 text-right font-mono font-bold text-slate-900">
                                              {fmt(it.subtotal || it.unit_price * qty)}
                                            </td>
                                            <td className="px-3 py-2 text-right font-mono font-bold">
                                              <span
                                                className={
                                                  isCashier
                                                    ? 'text-slate-400'
                                                    : lineProfit >= 0
                                                    ? 'text-emerald-600'
                                                    : 'text-rose-600'
                                                }
                                              >
                                                {isCashier ? '0.00' : (lineProfit >= 0 ? '+' : '') + fmt(lineProfit)}
                                              </span>
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                    <tfoot>
                                      <tr className="bg-slate-50/90 border-t border-slate-200 font-extrabold text-xs">
                                        <td colSpan={2} className="px-3 py-2 text-slate-700 uppercase tracking-wider text-[10px]">
                                          Items Total
                                        </td>
                                        <td className="px-3 py-2 text-center font-mono text-indigo-700">
                                          {items.reduce((s, it) => s + (it.quantity || 0), 0)}
                                        </td>
                                        <td className="px-3 py-2 text-right font-mono text-slate-500">
                                          {fmt(items.reduce((s, it) => s + (it.cost_price || 0) * (it.quantity || 0), 0))}
                                        </td>
                                        <td />
                                        <td className="px-3 py-2 text-right font-mono text-slate-900 font-black">
                                          {fmt(sale.total_amount)}
                                        </td>
                                        <td className="px-3 py-2 text-right font-mono text-emerald-600 font-black">
                                          {!isCashier && (
                                            <span>{(sale.profit || 0) >= 0 ? '+' : ''}{fmt(sale.profit)}</span>
                                          )}
                                        </td>
                                      </tr>
                                    </tfoot>
                                  </table>
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>

              {/* Summary Totals Footer */}
              <tfoot>
                <tr className="bg-slate-900 text-white font-extrabold border-t-2 border-slate-700">
                  <td colSpan={5} className="py-3 px-3 uppercase tracking-wider text-[11px] text-slate-300">
                    Grand Total ({fmtN(filtered.length)} Records)
                  </td>
                  <td colSpan={3} className="py-3 px-3 text-right text-[11px] text-slate-400 font-mono">
                    Discounts: -{fmt(stats.discount)}
                  </td>
                  <td className="py-3 px-3 text-center font-mono text-xs text-sky-400 font-black">
                    {fmtN(stats.totalQty)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-xs text-slate-300">
                    {isCashier ? '—' : fmt(stats.cost)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-xs text-slate-300">
                    {isCashier ? '—' : fmt(stats.revenue + stats.discount)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-sm text-emerald-400 font-black">
                    {isCashier ? 'Ksh 0.00' : fmt(stats.revenue)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-sm text-teal-400 font-black">
                    {isCashier ? 'Ksh 0.00' : fmt(stats.profit)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-slate-200 bg-slate-50/50 shrink-0 text-xs">
            <span className="text-slate-500 font-medium">
              Showing <b>{Math.min((page - 1) * pageSize + 1, Math.max(1, filtered.length))}</b> to{' '}
              <b>{Math.min(page * pageSize, filtered.length)}</b> of <b>{fmtN(filtered.length)}</b> entries
            </span>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(1)}
                disabled={page === 1}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-30 font-bold text-xs cursor-pointer"
              >
                « First
              </button>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-30 font-bold text-xs flex items-center gap-1 cursor-pointer"
              >
                <FiChevronLeft size={12} /> Prev
              </button>

              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const p =
                  totalPages <= 5
                    ? i + 1
                    : page <= 3
                    ? i + 1
                    : page >= totalPages - 2
                    ? totalPages - 4 + i
                    : page - 2 + i;
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-black transition-all cursor-pointer ${
                      p === page
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-300'
                    }`}
                  >
                    {p}
                  </button>
                );
              })}

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-30 font-bold text-xs flex items-center gap-1 cursor-pointer"
              >
                Next <FiArrowRight size={12} />
              </button>
              <button
                onClick={() => setPage(totalPages)}
                disabled={page === totalPages}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-30 font-bold text-xs cursor-pointer"
              >
                Last »
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ TAB 2: LINEAR CHARTS & TRENDS (RECHARTS) ═══ */}
      {activeTab === 'trends' && (
        <div className="space-y-4">
          {/* Main Linear Trend Area Chart */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                  <FiTrendingUp className="text-emerald-600" />
                  <span>Revenue &amp; Net Profit Linear Trajectory</span>
                </h3>
                <p className="text-[11px] text-slate-400 font-medium">
                  {dateFrom === dateTo
                    ? `Hourly financial velocity throughout ${dateFrom}`
                    : `Daily progression from ${dateFrom} to ${dateTo}`}
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs font-mono">
                <span className="flex items-center gap-1.5 font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-xl border border-indigo-200">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" /> Revenue: {fmtK(stats.revenue)}
                </span>
                <span className="flex items-center gap-1.5 font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" /> Profit: {fmtK(stats.profit)}
                </span>
              </div>
            </div>

            {trendData.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-xs">
                No trend points available for the selected parameters.
              </div>
            ) : (
              <div className="h-72 w-full">
                {mounted && (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.0} />
                        </linearGradient>
                        <linearGradient id="colorProf" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#059669" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#059669" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 10, fill: '#64748b' }}
                        tickLine={false}
                        axisLine={{ stroke: '#cbd5e1' }}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: '#64748b' }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => fmtK(v)}
                      />
                      <RechartsTooltip
                        content={({ active, payload, label }) => {
                          if (active && payload && payload.length) {
                            const d = payload[0].payload;
                            return (
                              <div className="bg-slate-900 text-white rounded-xl p-3 shadow-xl text-xs space-y-1.5 font-sans border border-slate-700">
                                <p className="font-extrabold text-slate-200 border-b border-slate-800 pb-1">
                                  📅 {d.label}
                                </p>
                                <div className="space-y-1 font-mono">
                                  <div className="flex justify-between gap-4">
                                    <span className="text-indigo-300">Revenue:</span>
                                    <strong className="text-white">{fmt(d.revenue)}</strong>
                                  </div>
                                  <div className="flex justify-between gap-4">
                                    <span className="text-emerald-300">Net Profit:</span>
                                    <strong className="text-emerald-400">{fmt(d.profit)}</strong>
                                  </div>
                                  <div className="flex justify-between gap-4">
                                    <span className="text-slate-400">Transactions:</span>
                                    <strong className="text-slate-200">{d.count} sales</strong>
                                  </div>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        stroke="#4f46e5"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#colorRev)"
                        name="Gross Revenue"
                      />
                      <Area
                        type="monotone"
                        dataKey="profit"
                        stroke="#059669"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorProf)"
                        name="Net Profit"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            )}
          </div>

          {/* Secondary Velocity & Transaction Count Bar Chart */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs space-y-2">
              <h3 className="text-sm font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                <FiBarChart2 className="text-indigo-600" />
                <span>Transaction Order Velocity</span>
              </h3>
              <p className="text-[10px] text-slate-400 font-medium">
                Distribution of sales transactions per period interval
              </p>
              <div className="h-56 w-full pt-2">
                {mounted && (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#64748b' }} tickLine={false} />
                      <YAxis tick={{ fontSize: 9, fill: '#64748b' }} tickLine={false} />
                      <RechartsTooltip />
                      <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} name="Orders" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                  <FiAward className="text-amber-500" />
                  <span>Executive Revenue Insights</span>
                </h3>
                <p className="text-[10px] text-slate-400 font-medium mb-3">Key financial efficiency indicators</p>
              </div>

              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] text-slate-400 uppercase font-black">Average Ticket Size</span>
                  <p className="text-base font-mono font-extrabold text-slate-900 mt-1">{fmt(stats.avg)}</p>
                  <span className="text-[9.5px] text-slate-500 font-medium">Per checkout receipt</span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] text-slate-400 uppercase font-black">Overall Profit Margin</span>
                  <p className="text-base font-mono font-extrabold text-emerald-600 mt-1">
                    {(stats.margin || 0).toFixed(1)}%
                  </p>
                  <span className="text-[9.5px] text-slate-500 font-medium">Cost vs Selling price</span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] text-slate-400 uppercase font-black">Peak Transaction</span>
                  <p className="text-base font-mono font-extrabold text-indigo-600 mt-1">{fmt(stats.maxSale)}</p>
                  <span className="text-[9.5px] text-slate-500 font-medium">Largest single order</span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] text-slate-400 uppercase font-black">Discounts Incurred</span>
                  <p className="text-base font-mono font-extrabold text-amber-600 mt-1">{fmt(stats.discount)}</p>
                  <span className="text-[9.5px] text-slate-500 font-medium">Across {stats.discountTxns} orders</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ TAB 3: PAYMENT CHANNELS & MIX ═══ */}
      {activeTab === 'channels' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {/* Donut Chart */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs md:col-span-1 flex flex-col items-center justify-between">
              <div className="w-full text-left">
                <h3 className="text-sm font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                  <FiPieChart className="text-indigo-600" />
                  <span>Tender Mix Share</span>
                </h3>
                <p className="text-[10px] text-slate-400 font-medium">Proportion of sales by settlement type</p>
              </div>

              <div className="w-full h-56 relative flex items-center justify-center my-2">
                {mounted && (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={paymentBreakdownData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={55}
                        outerRadius={80}
                        paddingAngle={4}
                      >
                        {paymentBreakdownData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip formatter={(v: any) => fmt(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Total Sales</span>
                  <span className="text-xs font-black text-slate-800 font-mono">{fmtK(stats.revenue)}</span>
                </div>
              </div>

              <div className="w-full flex flex-wrap gap-2 justify-center text-[11px] font-bold">
                {paymentBreakdownData.map((p, idx) => (
                  <span key={p.name} className="flex items-center gap-1.5 text-slate-600">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}
                    />
                    <span>{p.name}</span>
                  </span>
                ))}
              </div>
            </div>

            {/* Detailed Channel Breakdown Cards */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs md:col-span-2 space-y-3">
              <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">
                Channel Volume &amp; Settlement Performance
              </h3>
              <p className="text-[10px] text-slate-400 font-medium mb-2">
                Real-time breakdown of transactions by payment gateway
              </p>

              <div className="space-y-2.5">
                {paymentBreakdownData.map((p, idx) => {
                  const pct = stats.revenue > 0 ? (p.value / stats.revenue) * 100 : 0;
                  return (
                    <div
                      key={p.name}
                      className="p-3 rounded-xl border border-slate-200/80 bg-slate-50/60 flex flex-col justify-between"
                    >
                      <div className="flex items-center justify-between text-xs font-extrabold text-slate-800 mb-1">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-md"
                            style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}
                          />
                          <span>{p.name}</span>
                          <span className="text-[10px] text-slate-400 font-normal">({p.count} transactions)</span>
                        </div>
                        <span className="font-mono text-indigo-700">{fmt(p.value)}</span>
                      </div>

                      <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden my-1.5">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.min(100, Math.max(3, pct))}%`,
                            backgroundColor: PIE_COLORS[idx % PIE_COLORS.length],
                          }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                        <span>Share of Revenue:</span>
                        <strong className="text-slate-800 font-bold">{pct.toFixed(1)}%</strong>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ TAB 4: SALESPERSON PERFORMANCE MATRIX ═══ */}
      {activeTab === 'staff' && (
        <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/60">
            <h3 className="text-sm font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <FiUser className="text-indigo-600" />
              <span>Sales Staff &amp; Cashier Performance Leaderboard</span>
            </h3>
            <p className="text-[10px] text-slate-400 font-medium">
              Ranked revenue generation, invoice counts, and profit margin contribution
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/90 border-b border-slate-200 text-[10px] font-black uppercase text-slate-500 tracking-wider">
                  <th className="py-2.5 px-3.5 text-center w-16">Rank</th>
                  <th className="py-2.5 px-3">Sales Person</th>
                  <th className="py-2.5 px-3 text-center">Invoices Handled</th>
                  <th className="py-2.5 px-3 text-right">Gross Sales</th>
                  <th className="py-2.5 px-3 text-right">Avg Order Size</th>
                  <th className="py-2.5 px-3 text-right">Profit Generated</th>
                  <th className="py-2.5 px-3 text-center">Store Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {staffLeaderboard.map((st, idx) => {
                  const sharePct = stats.revenue > 0 ? (st.revenue / stats.revenue) * 100 : 0;
                  return (
                    <tr key={st.name} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-3.5 text-center">
                        <span
                          className={`inline-flex items-center justify-center w-7 h-7 rounded-xl font-black text-xs font-mono shadow-2xs ${
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
                      <td className="py-2.5 px-3">
                        <div className="font-extrabold text-slate-900 text-xs flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 font-bold text-[10px]">
                            {st.name.charAt(0).toUpperCase()}
                          </span>
                          <span>{st.name}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-700">
                        {fmtN(st.count)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-black text-slate-900">
                        {fmt(st.revenue)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                        {fmt(st.avgSale)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-extrabold text-emerald-600">
                        {fmt(st.profit)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 font-mono">
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
