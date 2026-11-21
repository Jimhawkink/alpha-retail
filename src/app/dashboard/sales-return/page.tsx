'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';
import { useCompanyName } from '@/context/SettingsContext';
import toast, { Toaster } from 'react-hot-toast';
import {
  FiRotateCcw,
  FiSearch,
  FiCalendar,
  FiRefreshCw,
  FiDownload,
  FiPrinter,
  FiFileText,
  FiPlus,
  FiX,
  FiCheck,
  FiCheckCircle,
  FiAlertTriangle,
  FiTrash2,
  FiCopy,
  FiChevronLeft,
  FiChevronRight,
  FiChevronsLeft,
  FiChevronsRight,
  FiDollarSign,
  FiLayers,
  FiUser,
  FiClock,
  FiTrendingDown,
  FiPackage,
  FiArrowRight,
  FiSliders,
  FiShoppingBag,
} from 'react-icons/fi';

/* ══════════════════════════════════════════════════════════════════════════════
   TYPES & INTERFACES
   ══════════════════════════════════════════════════════════════════════════════ */
interface Sale {
  sale_id: number;
  receipt_no: string;
  sale_date: string;
  customer_name: string;
  customer_phone?: string | null;
  total_amount: number;
  payment_method: string;
  outlet_id: number;
  created_by?: string;
  cashier_name?: string;
  sale_time?: string;
  sale_datetime?: string;
}

interface SaleItem {
  item_id?: number | null;
  _idx: number;
  sale_id: number;
  product_id: number;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  barcode?: string | null;
  cost_price?: number;
  discount?: number;
  selling_unit?: string;
  returnQty: number;
  selected: boolean;
}

interface ReturnRecord {
  return_id: number;
  return_no: string;
  return_date: string;
  original_sale_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  reason: string;
  status: string;
  processed_by: string;
  created_at?: string;
}

const REASONS = [
  'Wrong Order',
  'Quality Issue',
  'Overcharge',
  'Customer Request',
  'Expired Product',
  'Damaged Product',
  'Double Charge',
  'Other',
];

const PAGE_SIZES = [10, 20, 50, 100];

/* ══════════════════════════════════════════════════════════════════════════════
   FORMATTERS & HELPERS
   ══════════════════════════════════════════════════════════════════════════════ */
const fmt = (n: any) => {
  const num = typeof n === 'number' ? n : parseFloat(n) || 0;
  return `Ksh ${num.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const fmtKES = (n: any) => {
  const num = typeof n === 'number' ? n : parseFloat(n) || 0;
  return `Ksh ${num.toLocaleString('en-KE')}`;
};

const fmtK = (n: any) => {
  const num = typeof n === 'number' ? n : parseFloat(n) || 0;
  if (Math.abs(num) >= 1_000_000) return `Ksh ${(num / 1_000_000).toFixed(2)}M`;
  if (Math.abs(num) >= 1_000) return `Ksh ${(num / 1_000).toFixed(1)}K`;
  return `Ksh ${num.toLocaleString('en-KE')}`;
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

const formatDate = (val: string) => {
  const dt = safeDate(val);
  if (!dt) return val || '—';
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

/* ══════════════════════════════════════════════════════════════════════════════
   REASON BADGE COMPONENT
   ══════════════════════════════════════════════════════════════════════════════ */
function ReasonBadge({ reason }: { reason: string }) {
  const r = (reason || '').toLowerCase();
  let cls = 'bg-slate-100 text-slate-700 border-slate-200';
  if (r.includes('wrong')) cls = 'bg-sky-50 text-sky-800 border-sky-200';
  else if (r.includes('quality') || r.includes('damage')) cls = 'bg-rose-50 text-rose-800 border-rose-200';
  else if (r.includes('expired')) cls = 'bg-amber-50 text-amber-800 border-amber-200';
  else if (r.includes('overcharge') || r.includes('double')) cls = 'bg-purple-50 text-purple-800 border-purple-200';
  else if (r.includes('customer')) cls = 'bg-indigo-50 text-indigo-800 border-indigo-200';

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[10.5px] font-semibold border whitespace-nowrap leading-tight ${cls}`}
    >
      {reason || 'Return'}
    </span>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   MAIN SALES RETURN PAGE
   ══════════════════════════════════════════════════════════════════════════════ */
export default function SalesReturnPage() {
  const [mounted, setMounted] = useState(false);
  const { activeOutlet } = useOutlet();
  const outletId = activeOutlet?.outlet_id || null;
  const companyName = useCompanyName();

  // User state & permissions
  const [userName, setUserName] = useState('Admin');
  const [isCashier, setIsCashier] = useState(false);

  // Return History States
  const [returns, setReturns] = useState<ReturnRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [historySearch, setHistorySearch] = useState('');
  const [filterReason, setFilterReason] = useState('All');
  const [dateFilter, setDateFilter] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [copiedReturnNo, setCopiedReturnNo] = useState<string | null>(null);

  // Pagination for Returns History
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);

  // Find Sale & Return Modal State
  const [showLookup, setShowLookup] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);

  // Step 1: Sale Search & Selection
  const [saleSearch, setSaleSearch] = useState('');
  const [salesList, setSalesList] = useState<Sale[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [saleDateFilter, setSaleDateFilter] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Step 2: Items to Return
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [returnReason, setReturnReason] = useState('Wrong Order');
  const [isProcessing, setIsProcessing] = useState(false);

  // Search input ref for Ctrl+F
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
    try {
      const ud = localStorage.getItem('user');
      if (ud) {
        const p = JSON.parse(ud);
        setUserName(p.name || p.username || 'Admin');
        setIsCashier(['cashier', 'waiter'].includes((p.userType || '').toLowerCase()));
      }
    } catch {}
  }, []);

  // Keyboard shortcut listener
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

  /* ─────────────────────────────────────────────────────────────────────────
     Load Return History
     ───────────────────────────────────────────────────────────────────────── */
  const loadReturns = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('sales_returns')
        .select('*')
        .order('return_id', { ascending: false })
        .limit(2000);

      if (!error && data) {
        setReturns(data);
      } else {
        setReturns([]);
      }
    } catch (err) {
      console.error('Error loading returns:', err);
      toast.error('Failed to load return history');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReturns();
  }, [loadReturns]);

  /* ─────────────────────────────────────────────────────────────────────────
     Fetch Sales for Lookup Modal
     ───────────────────────────────────────────────────────────────────────── */
  const fetchSales = useCallback(
    async (query = '', date = '', currentOutletId: number | null = null) => {
      setIsSearching(true);
      try {
        let q = supabase
          .from('retail_sales')
          .select('sale_id,receipt_no,sale_date,sale_time,sale_datetime,customer_name,customer_phone,total_amount,payment_method,outlet_id,created_by')
          .order('sale_datetime', { ascending: false })
          .limit(50);

        if (currentOutletId) q = q.eq('outlet_id', currentOutletId);
        if (query.trim()) {
          q = q.or(`receipt_no.ilike.%${query.trim()}%,customer_name.ilike.%${query.trim()}%,customer_phone.ilike.%${query.trim()}%`);
        }
        if (date) q = q.eq('sale_date', date);

        let { data, error } = await q;

        // Fallback without outlet constraint if 0 records returned
        if ((!data || data.length === 0) && currentOutletId) {
          let fallbackQ = supabase
            .from('retail_sales')
            .select('sale_id,receipt_no,sale_date,sale_time,sale_datetime,customer_name,customer_phone,total_amount,payment_method,outlet_id,created_by')
            .order('sale_datetime', { ascending: false })
            .limit(50);

          if (query.trim()) {
            fallbackQ = fallbackQ.or(`receipt_no.ilike.%${query.trim()}%,customer_name.ilike.%${query.trim()}%,customer_phone.ilike.%${query.trim()}%`);
          }
          if (date) fallbackQ = fallbackQ.eq('sale_date', date);

          const fallbackRes = await fallbackQ;
          if (!fallbackRes.error && fallbackRes.data) {
            data = fallbackRes.data;
            error = null;
          }
        }

        if (!error && data) {
          setSalesList(data);
        } else {
          setSalesList([]);
        }
      } catch (err) {
        console.error('Error fetching sales:', err);
        setSalesList([]);
      } finally {
        setIsSearching(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!showLookup || step !== 1) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSales(saleSearch, saleDateFilter, outletId), 350);
  }, [saleSearch, saleDateFilter, showLookup, step, fetchSales, outletId]);

  /* ─────────────────────────────────────────────────────────────────────────
     Open & Close Modal
     ───────────────────────────────────────────────────────────────────────── */
  const openLookup = () => {
    setShowLookup(true);
    setStep(1);
    setSaleSearch('');
    setSaleDateFilter('');
    setSalesList([]);
    setSelectedSale(null);
    setSaleItems([]);
    setReturnReason('Wrong Order');
    fetchSales('', '', outletId);
  };

  const closeLookup = () => {
    setShowLookup(false);
    setStep(1);
    setSaleSearch('');
    setSaleDateFilter('');
    setSalesList([]);
    setSelectedSale(null);
    setSaleItems([]);
  };

  /* ─────────────────────────────────────────────────────────────────────────
     Select a Sale to Return Items
     ───────────────────────────────────────────────────────────────────────── */
  const selectSale = useCallback(async (sale: Sale) => {
    setSelectedSale(sale);
    setLoadingItems(true);
    setStep(2);
    try {
      let sid = Number(sale.sale_id);
      let itemsData: any[] = [];

      // If sale_id is missing/0, attempt to look it up by receipt_no
      if ((!sid || isNaN(sid)) && sale.receipt_no) {
        const { data: saleRow } = await supabase
          .from('retail_sales')
          .select('sale_id')
          .eq('receipt_no', sale.receipt_no)
          .limit(1);
        if (saleRow && saleRow[0]?.sale_id) {
          sid = Number(saleRow[0].sale_id);
        }
      }

      if (sid && !isNaN(sid)) {
        const { data, error } = await supabase
          .from('retail_sales_items')
          .select('item_id,sale_id,product_id,product_name,barcode,quantity,unit_price,cost_price,discount,subtotal')
          .eq('sale_id', sid);

        if (!error && data && data.length > 0) {
          itemsData = data;
        }
      }

      setSaleItems(
        itemsData.map((i: any, idx: number) => ({
          ...i,
          _idx: idx,
          unit_price: Number(i.unit_price || 0),
          subtotal: Number(i.subtotal || (Number(i.unit_price || 0) * (Number(i.quantity) || 1))),
          returnQty: 0,
          selected: false,
        }))
      );
    } catch (err) {
      console.error('Error loading sale items:', err);
      toast.error('Failed to load invoice items');
    } finally {
      setLoadingItems(false);
    }
  }, []);

  const toggleItem = (_idx: number) => {
    setSaleItems((prev) =>
      prev.map((i) =>
        i._idx === _idx
          ? { ...i, selected: !i.selected, returnQty: !i.selected ? i.quantity : 0 }
          : i
      )
    );
  };

  const setReturnQty = (_idx: number, val: number) => {
    setSaleItems((prev) =>
      prev.map((i) => {
        if (i._idx !== _idx) return i;
        const capped = Math.min(Math.max(0, val), i.quantity);
        return { ...i, returnQty: capped, selected: capped > 0 };
      })
    );
  };

  const generateReturnNo = async (): Promise<string> => {
    try {
      const { data } = await supabase
        .from('sales_returns')
        .select('return_no')
        .order('return_id', { ascending: false })
        .limit(1);

      if (data && data.length > 0 && data[0]?.return_no) {
        const m = String(data[0].return_no).match(/SR-(\d+)/);
        if (m) return `SR-${String(parseInt(m[1], 10) + 1).padStart(4, '0')}`;
      }
    } catch {}
    return 'SR-0001';
  };

  /* ─────────────────────────────────────────────────────────────────────────
     Process Return & Restitute Stock
     ───────────────────────────────────────────────────────────────────────── */
  const processReturn = async () => {
    const toReturn = saleItems.filter((i) => i.selected && i.returnQty > 0);
    if (!toReturn.length) {
      toast.error('Select at least one item with return quantity > 0');
      return;
    }
    setIsProcessing(true);
    try {
      const returnNo = await generateReturnNo();
      const today = new Date().toISOString().split('T')[0];
      const originalRef = selectedSale?.receipt_no || String(selectedSale?.sale_id);

      const records = toReturn.map((item) => ({
        return_no: returnNo,
        return_date: today,
        original_sale_id: originalRef,
        product_name: item.product_name,
        quantity: Math.round(item.returnQty * 100) / 100,
        unit_price: item.unit_price,
        total_amount: Math.round(item.returnQty * item.unit_price),
        reason: returnReason,
        status: 'Completed',
        processed_by: userName,
      }));

      const stockRows = outletId
        ? toReturn
            .filter((i) => i.product_id)
            .map((i) => ({
              pid: i.product_id,
              invoice_no: `RTN-${returnNo}`,
              qty: i.returnQty,
              storage_type: 'Pieces',
              outlet_id: outletId,
            }))
        : [];

      const totalRefund = toReturn.reduce((s, i) => s + i.returnQty * i.unit_price, 0);

      const returnItems = toReturn.map((i) => ({
        product_id: i.product_id,
        returnQty: Math.round(i.returnQty * 100) / 100,
      }));

      const res = await fetch('/api/sales-return', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          records,
          stockRows,
          saleId: Number(selectedSale?.sale_id),
          totalRefundAmount: Math.round(totalRefund),
          returnItems,
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to process return');

      toast.success(`Return ${returnNo} processed! Ksh ${Math.round(totalRefund).toLocaleString()} refunded`);
      closeLookup();
      loadReturns();
    } catch (err: any) {
      toast.error(`Return failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  /* ─────────────────────────────────────────────────────────────────────────
     Delete Return Record
     ───────────────────────────────────────────────────────────────────────── */
  const handleDelete = async (id: number) => {
    try {
      const { error } = await supabase.from('sales_returns').delete().eq('return_id', id);
      if (error) {
        toast.error('Failed to delete return');
      } else {
        toast.success('Return record deleted');
        loadReturns();
      }
    } catch {
      toast.error('Deletion error');
    }
    setDeleteConfirmId(null);
  };

  const copyText = (txt: string) => {
    if (!txt) return;
    navigator.clipboard.writeText(txt);
    setCopiedReturnNo(txt);
    toast.success(`Copied: ${txt}`);
    setTimeout(() => setCopiedReturnNo(null), 2000);
  };

  /* ─────────────────────────────────────────────────────────────────────────
     Ultra Super-Premium Styled Excel Export (.xlsx)
     ───────────────────────────────────────────────────────────────────────── */
  const exportExcel = async () => {
    try {
      const XLSX = (await import('xlsx-js-style')).default || (await import('xlsx-js-style'));
      const wb = XLSX.utils.book_new();

      // 1. Data Matrix (AOA)
      const data: any[][] = [];

      // Row 0: Business Title Header (Centered, Colorful, Large)
      const titleText = `${(companyName || 'ALPHA RETAIL').toUpperCase()} — ${(activeOutlet?.outlet_name || 'MAIN OUTLET').toUpperCase()}`;
      data.push([titleText]);

      // Row 1: Subtitle
      data.push(['OFFICIAL SALES RETURNS & INVENTORY RESTITUTION AUDIT REGISTER']);

      // Row 2: Metadata Strip
      const totalUnits = filteredHistory.reduce((s, r) => s + (r.quantity || 0), 0);
      const metaText = `Generated: ${new Date().toLocaleString('en-KE')}  |  Total Audited Records: ${filteredHistory.length}  |  Restocked Units: ${totalUnits} Pcs  |  Total Refund Capital: Ksh ${totalValue.toLocaleString()}`;
      data.push([metaText]);

      // Row 3: Spacer
      data.push([]);

      // Row 4: Column Headers
      const headers = [
        '#',
        'RETURN NO',
        'RETURN DATE',
        'ORIGINAL INVOICE',
        'PRODUCT NAME',
        'RESTOCKED QTY',
        'UNIT PRICE (KSH)',
        'REFUND AMOUNT (KSH)',
        'RETURN REASON',
        'STATUS',
        'PROCESSED BY',
      ];
      data.push(headers);

      // Rows 5..5+N-1: Data Rows
      filteredHistory.forEach((r, idx) => {
        data.push([
          idx + 1,
          r.return_no || '',
          r.return_date ? formatDate(r.return_date) : '',
          r.original_sale_id || '—',
          r.product_name || '',
          r.quantity || 0,
          Number(r.unit_price || 0),
          Number(r.total_amount || 0),
          r.reason || 'General Return',
          r.status || 'Completed',
          r.processed_by || 'Staff',
        ]);
      });

      // Spacer
      data.push([]);

      // Grand Total Row
      data.push([
        'GRAND TOTAL RESTITUTIONS',
        '',
        '',
        '',
        `${filteredHistory.length} Audited Records`,
        totalUnits,
        '',
        totalValue,
        '100% RESTOCKED',
        'COMPLETED',
        'AUDITED',
      ]);

      const ws = XLSX.utils.aoa_to_sheet(data);

      // Merges
      ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 10 } }, // Business Title
        { s: { r: 1, c: 0 }, e: { r: 1, c: 10 } }, // Subtitle
        { s: { r: 2, c: 0 }, e: { r: 2, c: 10 } }, // Metadata Strip
        { s: { r: data.length - 1, c: 0 }, e: { r: data.length - 1, c: 3 } }, // Grand Total Label
      ];

      // Row Heights
      const rowsConfig: any[] = [
        { hpt: 38 }, // Row 0: Business Title
        { hpt: 24 }, // Row 1: Subtitle
        { hpt: 20 }, // Row 2: Metadata
        { hpt: 12 }, // Row 3: Spacer
        { hpt: 26 }, // Row 4: Column Headers
      ];
      for (let i = 0; i < filteredHistory.length; i++) {
        rowsConfig.push({ hpt: 20 });
      }
      rowsConfig.push({ hpt: 12 }); // Spacer
      rowsConfig.push({ hpt: 28 }); // Grand Total
      ws['!rows'] = rowsConfig;

      // Auto-fitting Column Widths
      ws['!cols'] = [
        { wch: 6 },  // #
        { wch: 17 }, // Return No
        { wch: 16 }, // Return Date
        { wch: 20 }, // Original Invoice
        { wch: 34 }, // Product Name
        { wch: 16 }, // Restocked Qty
        { wch: 18 }, // Unit Price
        { wch: 22 }, // Refund Amount
        { wch: 22 }, // Return Reason
        { wch: 15 }, // Status
        { wch: 18 }, // Processed By
      ];

      // Styling: Row 0 (Business Title)
      if (ws['A1']) {
        ws['A1'].s = {
          font: { name: 'Calibri', sz: 16, bold: true, color: { rgb: 'FFFFFF' } },
          fill: { fgColor: { rgb: '0F172A' } }, // Slate 900
          alignment: { horizontal: 'center', vertical: 'center' },
        };
      }
      // Styling: Row 1 (Subtitle)
      if (ws['A2']) {
        ws['A2'].s = {
          font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
          fill: { fgColor: { rgb: 'BE123C' } }, // Rose 700
          alignment: { horizontal: 'center', vertical: 'center' },
        };
      }
      // Styling: Row 2 (Metadata)
      if (ws['A3']) {
        ws['A3'].s = {
          font: { name: 'Calibri', sz: 9.5, bold: true, color: { rgb: '881337' } },
          fill: { fgColor: { rgb: 'FFE4E6' } }, // Rose 100
          alignment: { horizontal: 'center', vertical: 'center' },
        };
      }

      // Styling: Row 4 (Table Headers)
      const headerFills = [
        '1E1B4B', // # (Indigo)
        'BE123C', // Return No (Rose)
        '1E293B', // Date (Slate)
        '1D4ED8', // Original Invoice (Blue)
        '0F172A', // Product Name (Dark Slate)
        '0369A1', // Restocked Qty (Sky)
        '0F172A', // Unit Price
        '9F1239', // Refund Amount (Rose)
        '4338CA', // Reason (Indigo)
        '047857', // Status (Emerald)
        '334155', // Processed By
      ];

      for (let c = 0; c < 11; c++) {
        const cellRef = XLSX.utils.encode_cell({ r: 4, c });
        if (ws[cellRef]) {
          ws[cellRef].s = {
            font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: 'FFFFFF' } },
            fill: { fgColor: { rgb: headerFills[c] || '1E1B4B' } },
            alignment: {
              horizontal: c === 4 ? 'left' : c === 6 || c === 7 ? 'right' : 'center',
              vertical: 'center',
            },
            border: {
              top: { style: 'medium', color: { rgb: '0F172A' } },
              bottom: { style: 'medium', color: { rgb: '0F172A' } },
              left: { style: 'thin', color: { rgb: 'FFFFFF' } },
              right: { style: 'thin', color: { rgb: 'FFFFFF' } },
            },
          };
        }
      }

      // Styling: Data Rows
      const borderThin = {
        top: { style: 'thin', color: { rgb: 'E2E8F0' } },
        bottom: { style: 'thin', color: { rgb: 'E2E8F0' } },
        left: { style: 'thin', color: { rgb: 'E2E8F0' } },
        right: { style: 'thin', color: { rgb: 'E2E8F0' } },
      };

      for (let r = 0; r < filteredHistory.length; r++) {
        const rowIdx = 5 + r;
        const isOdd = r % 2 === 1;
        const rowBg = isOdd ? 'FFF1F2' : 'FFFFFF'; // Alternating soft rose & white

        for (let c = 0; c < 11; c++) {
          const cellRef = XLSX.utils.encode_cell({ r: rowIdx, c });
          if (!ws[cellRef]) continue;

          let fontColor = '1E293B';
          let isBold = false;
          let cellBg = rowBg;
          let horiz: 'center' | 'left' | 'right' = 'center';

          if (c === 0) {
            fontColor = '64748B';
          } else if (c === 1) {
            fontColor = 'BE123C';
            isBold = true;
          } else if (c === 3) {
            fontColor = '1D4ED8';
            isBold = true;
          } else if (c === 4) {
            fontColor = '0F172A';
            isBold = true;
            horiz = 'left';
          } else if (c === 5) {
            cellBg = isOdd ? 'FFE4E6' : 'F1F5F9';
            isBold = true;
          } else if (c === 6) {
            horiz = 'right';
            ws[cellRef].z = '#,##0.00';
          } else if (c === 7) {
            horiz = 'right';
            isBold = true;
            fontColor = '9F1239';
            cellBg = 'FFE4E6';
            ws[cellRef].z = '#,##0.00';
          } else if (c === 9) {
            fontColor = '047857';
            isBold = true;
          } else if (c === 10) {
            horiz = 'left';
          }

          ws[cellRef].s = {
            font: { name: 'Calibri', sz: 9.5, bold: isBold, color: { rgb: fontColor } },
            fill: { fgColor: { rgb: cellBg } },
            alignment: { horizontal: horiz, vertical: 'center' },
            border: borderThin,
          };
        }
      }

      // Styling: Grand Total Row
      const totalRowIdx = data.length - 1;
      for (let c = 0; c < 11; c++) {
        const cellRef = XLSX.utils.encode_cell({ r: totalRowIdx, c });
        if (!ws[cellRef]) continue;

        let totalBg = '9F1239'; // Rich Crimson
        let horiz: 'center' | 'left' | 'right' = 'center';
        let fSize = 10.5;

        if (c <= 4) {
          totalBg = '9F1239';
          horiz = 'right';
          fSize = 11;
        } else if (c === 5) {
          totalBg = '1E1B4B'; // Indigo
          fSize = 11;
        } else if (c === 7) {
          totalBg = '881337'; // Dark Wine
          horiz = 'right';
          fSize = 12;
          ws[cellRef].z = '#,##0.00';
        } else if (c >= 8) {
          totalBg = '065F46'; // Emerald
          fSize = 10;
        }

        ws[cellRef].s = {
          font: { name: 'Calibri', sz: fSize, bold: true, color: { rgb: 'FFFFFF' } },
          fill: { fgColor: { rgb: totalBg } },
          alignment: { horizontal: horiz, vertical: 'center' },
          border: {
            top: { style: 'medium', color: { rgb: '0F172A' } },
            bottom: { style: 'double', color: { rgb: '0F172A' } },
          },
        };
      }

      XLSX.utils.book_append_sheet(wb, ws, 'Sales Returns Master');

      // ─── SHEET 2: Executive Analytics & Reasons Breakdown ───
      const reasonMap: Record<string, { count: number; total: number; qty: number }> = {};
      filteredHistory.forEach((r) => {
        const rsn = r.reason || 'Other';
        if (!reasonMap[rsn]) reasonMap[rsn] = { count: 0, total: 0, qty: 0 };
        reasonMap[rsn].count += 1;
        reasonMap[rsn].total += Number(r.total_amount || 0);
        reasonMap[rsn].qty += Number(r.quantity || 0);
      });

      const analyticsData: any[][] = [
        [`${(companyName || 'ALPHA RETAIL').toUpperCase()} — EXECUTIVE REASON INTELLIGENCE`],
        ['RESTITUTION FREQUENCY & REFUND VALUE BY RETURN REASON'],
        [`Generated: ${new Date().toLocaleString('en-KE')}  |  Total Audited Restitutions: ${filteredHistory.length}`],
        [],
        ['RETURN REASON', 'INCIDENTS', 'RESTOCKED PCS', 'REFUND CAPITAL (KSH)', 'AVG PER RETURN (KSH)', '% SHARE OF CAPITAL'],
      ];

      Object.entries(reasonMap).forEach(([reasonName, stats]) => {
        const share = totalValue > 0 ? (stats.total / totalValue) * 100 : 0;
        const avgR = stats.count > 0 ? stats.total / stats.count : 0;
        analyticsData.push([
          reasonName,
          stats.count,
          stats.qty,
          stats.total,
          avgR,
          `${share.toFixed(1)}%`,
        ]);
      });

      analyticsData.push([]);
      analyticsData.push([
        'TOTAL BY REASONS',
        filteredHistory.length,
        totalUnits,
        totalValue,
        filteredHistory.length > 0 ? totalValue / filteredHistory.length : 0,
        '100.0%',
      ]);

      const wsAnalytics = XLSX.utils.aoa_to_sheet(analyticsData);
      wsAnalytics['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } },
        { s: { r: 2, c: 0 }, e: { r: 2, c: 5 } },
      ];
      wsAnalytics['!cols'] = [
        { wch: 28 }, // Reason
        { wch: 14 }, // Incidents
        { wch: 16 }, // Pcs
        { wch: 24 }, // Refund
        { wch: 22 }, // Avg
        { wch: 18 }, // % Share
      ];
      wsAnalytics['!rows'] = [
        { hpt: 34 },
        { hpt: 22 },
        { hpt: 18 },
        { hpt: 10 },
        { hpt: 26 },
      ];

      // Sheet 2 Header Styling
      if (wsAnalytics['A1']) {
        wsAnalytics['A1'].s = {
          font: { name: 'Calibri', sz: 15, bold: true, color: { rgb: 'FFFFFF' } },
          fill: { fgColor: { rgb: '1E1B4B' } },
          alignment: { horizontal: 'center', vertical: 'center' },
        };
      }
      if (wsAnalytics['A2']) {
        wsAnalytics['A2'].s = {
          font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
          fill: { fgColor: { rgb: 'BE123C' } },
          alignment: { horizontal: 'center', vertical: 'center' },
        };
      }
      if (wsAnalytics['A3']) {
        wsAnalytics['A3'].s = {
          font: { name: 'Calibri', sz: 9, bold: true, color: { rgb: '475569' } },
          fill: { fgColor: { rgb: 'F1F5F9' } },
          alignment: { horizontal: 'center', vertical: 'center' },
        };
      }

      // Sheet 2 Table Header (Row 4)
      for (let c = 0; c < 6; c++) {
        const cellRef = XLSX.utils.encode_cell({ r: 4, c });
        if (wsAnalytics[cellRef]) {
          wsAnalytics[cellRef].s = {
            font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: 'FFFFFF' } },
            fill: { fgColor: { rgb: '0F172A' } },
            alignment: { horizontal: c === 0 ? 'left' : 'center', vertical: 'center' },
            border: { top: { style: 'medium' }, bottom: { style: 'medium' } },
          };
        }
      }

      // Sheet 2 Data Rows
      const reasonsList = Object.entries(reasonMap);
      for (let i = 0; i < reasonsList.length; i++) {
        const rIdx = 5 + i;
        const isOdd = i % 2 === 1;
        const bg = isOdd ? 'FFF1F2' : 'FFFFFF';
        for (let c = 0; c < 6; c++) {
          const cellRef = XLSX.utils.encode_cell({ r: rIdx, c });
          if (!wsAnalytics[cellRef]) continue;
          wsAnalytics[cellRef].s = {
            font: { name: 'Calibri', sz: 9.5, bold: c === 0 || c === 3, color: { rgb: c === 3 ? 'BE123C' : '1E293B' } },
            fill: { fgColor: { rgb: c === 3 ? 'FFE4E6' : bg } },
            alignment: { horizontal: c === 0 ? 'left' : c === 3 || c === 4 ? 'right' : 'center', vertical: 'center' },
            border: borderThin,
          };
          if (c === 3 || c === 4) wsAnalytics[cellRef].z = '#,##0.00';
        }
      }

      // Sheet 2 Total Row
      const s2TotalIdx = analyticsData.length - 1;
      for (let c = 0; c < 6; c++) {
        const cellRef = XLSX.utils.encode_cell({ r: s2TotalIdx, c });
        if (!wsAnalytics[cellRef]) continue;
        wsAnalytics[cellRef].s = {
          font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
          fill: { fgColor: { rgb: '9F1239' } },
          alignment: { horizontal: c === 0 ? 'left' : c === 3 || c === 4 ? 'right' : 'center', vertical: 'center' },
          border: { top: { style: 'medium' }, bottom: { style: 'double' } },
        };
        if (c === 3 || c === 4) wsAnalytics[cellRef].z = '#,##0.00';
      }

      XLSX.utils.book_append_sheet(wb, wsAnalytics, 'Reason Intelligence');

      XLSX.writeFile(wb, `Sales_Returns_Master_${toDay()}.xlsx`);
      toast.success('Ultra Super-Premium Excel workbook exported successfully!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to export Excel workbook');
    }
  };

  const exportCSV = () => {
    try {
      const headers = ['Return No', 'Date', 'Original Sale', 'Product', 'Qty', 'Unit Price', 'Refund', 'Reason', 'By'];
      const lines = filteredHistory.map((r) => [
        `"${r.return_no || ''}"`,
        `"${r.return_date || ''}"`,
        `"${r.original_sale_id || ''}"`,
        `"${r.product_name || ''}"`,
        r.quantity || 0,
        r.unit_price || 0,
        r.total_amount || 0,
        `"${r.reason || ''}"`,
        `"${r.processed_by || ''}"`,
      ].join(','));
      const csv = [headers.join(','), ...lines].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Sales_Returns_${toDay()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('CSV file exported!');
    } catch {
      toast.error('Failed to export CSV');
    }
  };

  /* ─────────────────────────────────────────────────────────────────────────
     Print Statement / PDF
     ───────────────────────────────────────────────────────────────────────── */
  const printStatement = () => {
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Sales Returns & Refund Audit Statement - ${companyName}</title>
  <style>
    @page { size: A4 portrait; margin: 10mm; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #0f172a; margin: 0; padding: 8px; font-size: 11px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 12px; }
    .company { font-size: 17px; font-weight: 900; color: #0f172a; letter-spacing: -0.5px; }
    .title { font-size: 13px; font-weight: 700; color: #e11d48; margin-top: 2px; }
    .kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 14px; }
    .kpi { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 10px; }
    .kpi-lbl { font-size: 8.5px; font-weight: 700; text-transform: uppercase; color: #64748b; }
    .kpi-val { font-size: 13px; font-weight: 900; color: #0f172a; margin-top: 2px; font-family: monospace; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 9.5px; }
    th { background: #f1f5f9; color: #0f172a; font-weight: 800; text-transform: uppercase; font-size: 8.5px; padding: 6px 8px; border-bottom: 1.5px solid #cbd5e1; text-align: left; }
    td { padding: 5px 8px; border-bottom: 1px solid #e2e8f0; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .footer { margin-top: 16px; border-top: 1px solid #cbd5e1; padding-top: 8px; display: flex; justify-content: space-between; font-size: 8.5px; color: #64748b; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="company">${companyName}</div>
      <div class="title">Sales Returns & Refund Audit Statement</div>
      <div style="font-size: 10px; color: #64748b; margin-top: 3px;">
        Outlet: <strong>${activeOutlet?.outlet_name || 'All Outlets'}</strong> &bull; Generated: <strong>${new Date().toLocaleString('en-KE')}</strong>
      </div>
    </div>
    <div style="text-align: right; font-size: 10px; color: #64748b;">
      <div>Returns Logged: <strong>${filteredHistory.length}</strong></div>
      <div>Refund Capital: <strong>Ksh ${totalValue.toLocaleString()}</strong></div>
    </div>
  </div>

  <div class="kpis">
    <div class="kpi">
      <div class="kpi-lbl">Total Returns Logged</div>
      <div class="kpi-val">${filteredHistory.length} records</div>
    </div>
    <div class="kpi">
      <div class="kpi-lbl">Total Capital Refunded</div>
      <div class="kpi-val" style="color: #e11d48;">Ksh ${totalValue.toLocaleString()}</div>
    </div>
    <div class="kpi">
      <div class="kpi-lbl">Today's Returns</div>
      <div class="kpi-val">${todayCount} records</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 20px;">#</th>
        <th>Return #</th>
        <th>Date</th>
        <th>Original Sale</th>
        <th>Product Name</th>
        <th class="text-center">Restocked Qty</th>
        <th class="text-right">Unit Price</th>
        <th class="text-right">Refund Amount</th>
        <th>Reason</th>
        <th>Processed By</th>
      </tr>
    </thead>
    <tbody>
      ${filteredHistory
        .map(
          (r, idx) => `
        <tr>
          <td>${idx + 1}</td>
          <td style="font-family: monospace; font-weight: 700; color: #e11d48;">${r.return_no}</td>
          <td>${formatDate(r.return_date)}</td>
          <td style="font-family: monospace;">${r.original_sale_id || '—'}</td>
          <td style="font-weight: 600;">${r.product_name}</td>
          <td class="text-center" style="font-weight: 700;">${r.quantity}</td>
          <td class="text-right">Ksh ${(r.unit_price || 0).toLocaleString()}</td>
          <td class="text-right" style="font-weight: 800; font-family: monospace; color: #e11d48;">Ksh ${(
            r.total_amount || 0
          ).toLocaleString()}</td>
          <td>${r.reason}</td>
          <td>${r.processed_by || 'Staff'}</td>
        </tr>
      `
        )
        .join('')}
    </tbody>
    <tfoot>
      <tr style="background: #f8fafc; font-weight: 800; border-top: 2px solid #0f172a;">
        <td colspan="7" class="text-right">TOTAL REFUNDED CAPITAL:</td>
        <td class="text-right" style="color: #e11d48; font-family: monospace; font-size: 11px;">Ksh ${totalValue.toLocaleString()}</td>
        <td colspan="2"></td>
      </tr>
    </tfoot>
  </table>

  <div class="footer">
    <div>Alpha Retail Executive POS • Official Sales Returns Document</div>
    <div>Page 1 of 1</div>
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
     Filter Pipeline
     ───────────────────────────────────────────────────────────────────────── */
  const filteredHistory = useMemo(() => {
    const q = historySearch.toLowerCase().trim();
    return returns.filter((r) => {
      if (q) {
        const hay = [r.return_no, r.product_name, r.original_sale_id, r.reason, r.processed_by]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filterReason !== 'All' && r.reason !== filterReason) {
        return false;
      }
      if (dateFilter && r.return_date !== dateFilter) {
        return false;
      }
      return true;
    });
  }, [returns, historySearch, filterReason, dateFilter]);

  // Pagination for Returns History
  const totalPages = Math.max(1, Math.ceil(filteredHistory.length / perPage));
  const paginatedReturns = useMemo(() => {
    const from = (page - 1) * perPage;
    return filteredHistory.slice(from, from + perPage);
  }, [filteredHistory, page, perPage]);

  // Calculations
  const totalValue = useMemo(
    () => filteredHistory.reduce((s, r) => s + (r.total_amount || 0), 0),
    [filteredHistory]
  );
  const todayCount = useMemo(
    () => returns.filter((r) => r.return_date === toDay()).length,
    [returns]
  );
  const selectedCount = useMemo(
    () => saleItems.filter((i) => i.selected && i.returnQty > 0).length,
    [saleItems]
  );
  const selectedTotal = useMemo(
    () =>
      saleItems
        .filter((i) => i.selected)
        .reduce((s, i) => s + i.returnQty * i.unit_price, 0),
    [saleItems]
  );

  if (!mounted) {
    return (
      <div className="w-full flex items-center justify-center py-24 min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-rose-200 border-t-rose-600 rounded-full animate-spin" />
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Loading Sales Return Ledger...</span>
        </div>
      </div>
    );
  }

  /* ─────────────────────────────────────────────────────────────────────────
     UI RENDER: Matching Products Page Design System
     ───────────────────────────────────────────────────────────────────────── */
  return (
    <div className="w-full max-w-full min-w-0 space-y-2.5 pb-10 text-slate-800 font-sans">
      <Toaster position="top-right" />

      {/* ━━━ 1. TOP EXECUTIVE COMMAND BAR (SINGLE-LINE SCREEN-FITTING) ━━━ */}
      <div className="bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl shadow-xs px-3 py-1.5 transition-all">
        <div className="flex items-center justify-between gap-2 overflow-x-auto scrollbar-none">
          {/* Brand & Returns Scope Pill */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-rose-600 via-rose-500 to-amber-500 flex items-center justify-center text-white font-black shadow-xs">
              <FiRotateCcw size={14} />
            </div>
            <div className="leading-tight">
              <div className="flex items-center gap-1.5">
                <h1 className="text-xs font-black tracking-tight text-slate-900 whitespace-nowrap">
                  Sales Returns &amp; Restitution Ledger
                </h1>
                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                  v2.6
                </span>
                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live Audit
                </span>
              </div>
              <div className="text-[10px] font-semibold text-slate-400 flex items-center gap-1.5 whitespace-nowrap">
                <span className="text-slate-600">{companyName || 'Alpha Retail'}</span>
                <span>•</span>
                <span className="font-mono text-slate-700 font-bold">{activeOutlet?.outlet_name || 'Main Outlet'}</span>
                <span>•</span>
                <span className="text-rose-600 font-bold">{filteredHistory.length} Logged Returns</span>
              </div>
            </div>
          </div>

          {/* Quick Action Toolbar */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => {
                loadReturns();
                toast.success('Return records refreshed');
              }}
              className="px-2 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-bold transition-all shadow-2xs hover:border-slate-300 flex items-center gap-1 cursor-pointer"
              title="Refresh Return History"
            >
              <FiRefreshCw size={11} className={isLoading ? 'animate-spin text-rose-600' : 'text-slate-500'} />
              <span>Refresh</span>
            </button>

            <button
              onClick={exportExcel}
              className="px-2 py-1 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[11px] font-bold transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
              title="Export Official Excel (.xlsx) Workbook"
            >
              <FiDownload size={11} className="text-emerald-700" />
              <span>Excel</span>
            </button>

            <button
              onClick={exportCSV}
              className="px-2 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-bold transition-all shadow-2xs hover:border-slate-300 flex items-center gap-1 cursor-pointer"
              title="Export CSV Register"
            >
              <FiFileText size={11} className="text-slate-500" />
              <span>CSV</span>
            </button>

            <button
              onClick={printStatement}
              className="px-2 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-bold transition-all shadow-2xs hover:border-slate-300 flex items-center gap-1 cursor-pointer"
              title="Print Audit Statement / Save as PDF"
            >
              <FiPrinter size={11} className="text-indigo-600" />
              <span>Print PDF</span>
            </button>

            <button
              onClick={openLookup}
              className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-rose-600 via-rose-500 to-amber-500 text-white text-[11px] font-black transition-all shadow-xs hover:shadow-rose-500/25 active:scale-[0.98] flex items-center gap-1 shrink-0 cursor-pointer"
              title="Find Sale &amp; Process Return"
            >
              <FiPlus size={12} className="stroke-[3]" />
              <span>Find Sale &amp; Return</span>
            </button>
          </div>
        </div>
      </div>

      {/* ━━━ 2. EXECUTIVE METRIC HUD CARDS (COMPACT EXACT MATCH) ━━━ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {/* 1. Total Returns */}
        <div className="bg-white rounded-2xl p-2.5 sm:p-3 border border-slate-200/90 shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Returns</span>
            <div className="w-5 h-5 rounded-lg bg-rose-50 flex items-center justify-center text-rose-600">
              <FiRotateCcw size={11} />
            </div>
          </div>
          <div className="text-base sm:text-lg font-black text-slate-900 font-mono tracking-tight">
            {fmtN(returns.length)}
          </div>
          <div className="text-[10px] text-slate-500 font-medium truncate mt-0.5">All historic restitutions</div>
        </div>

        {/* 2. Total Refunded Capital */}
        <div className="bg-white rounded-2xl p-2.5 sm:p-3 border border-rose-200/90 bg-gradient-to-br from-rose-50/30 via-white to-white shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700">Total Refunded</span>
            <div className="w-5 h-5 rounded-lg bg-rose-100 flex items-center justify-center text-rose-700">
              <FiTrendingDown size={11} />
            </div>
          </div>
          <div className="text-base sm:text-lg font-black text-rose-700 font-mono tracking-tight">
            {fmt(totalValue)}
          </div>
          <div className="text-[10px] text-rose-600 font-medium truncate mt-0.5">
            Avg {returns.length > 0 ? fmt(totalValue / returns.length) : 'Ksh 0.00'} / return
          </div>
        </div>

        {/* 3. Today's Returns */}
        <div className="bg-white rounded-2xl p-2.5 sm:p-3 border border-amber-200/90 bg-gradient-to-br from-amber-50/30 via-white to-white shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Today&apos;s Returns</span>
            <div className="w-5 h-5 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700">
              <FiClock size={11} />
            </div>
          </div>
          <div className="text-base sm:text-lg font-black text-amber-800 font-mono tracking-tight">
            {fmtN(todayCount)}
          </div>
          <div className="text-[10px] text-amber-600 font-medium truncate mt-0.5">Logged on {formatDate(toDay())}</div>
        </div>

        {/* 4. Restitution Status */}
        <div className="bg-white rounded-2xl p-2.5 sm:p-3 border border-emerald-200/90 bg-gradient-to-br from-emerald-50/30 via-white to-white shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Inventory Status</span>
            <div className="w-5 h-5 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700">
              <FiCheckCircle size={11} />
            </div>
          </div>
          <div className="text-base sm:text-lg font-black text-emerald-700 font-mono tracking-tight">
            100% Synced
          </div>
          <div className="text-[10px] text-emerald-600 font-medium truncate mt-0.5">Automated stock restitution</div>
        </div>
      </div>

      {/* ━━━ 3. SLEEK SEARCH & FILTER COCKPIT ━━━ */}
      <div className="bg-white/95 backdrop-blur-md rounded-2xl p-2.5 sm:p-3 border border-slate-200/90 shadow-2xs space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          {/* Search Input */}
          <div className="relative flex-1">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
            <input
              ref={searchInputRef}
              type="text"
              value={historySearch}
              onChange={(e) => {
                setHistorySearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search return #, original receipt, product name, reason, or staff... (Ctrl+F)"
              className="w-full pl-8 pr-8 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:border-rose-500 focus:bg-white outline-none transition-all placeholder:text-slate-400"
            />
            {historySearch && (
              <button
                onClick={() => {
                  setHistorySearch('');
                  setPage(1);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <FiX size={12} />
              </button>
            )}
          </div>

          {/* Quick Filters */}
          <div className="flex items-center gap-1.5 flex-wrap shrink-0">
            <select
              value={filterReason}
              onChange={(e) => {
                setFilterReason(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-rose-500 cursor-pointer"
            >
              <option value="All">All Return Reasons</option>
              {REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>

            <input
              type="date"
              value={dateFilter}
              onChange={(e) => {
                setDateFilter(e.target.value);
                setPage(1);
              }}
              className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-rose-500 cursor-pointer"
              title="Filter by specific return date"
            />

            {(historySearch || filterReason !== 'All' || dateFilter) && (
              <button
                onClick={() => {
                  setHistorySearch('');
                  setFilterReason('All');
                  setDateFilter('');
                  setPage(1);
                }}
                className="px-2 py-1 bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 rounded-xl text-xs font-bold transition cursor-pointer"
                title="Reset active filters"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Filter Summary */}
        <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-slate-100 text-slate-500">
          <div>
            Showing <strong className="font-mono text-slate-800">{filteredHistory.length}</strong> of{' '}
            <strong className="font-mono text-slate-800">{returns.length}</strong> return records
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-bold uppercase text-[10px]">Rows:</span>
            <select
              value={perPage}
              onChange={(e) => {
                setPerPage(Number(e.target.value));
                setPage(1);
              }}
              className="border border-slate-200 rounded-lg px-2 py-0.5 text-xs font-bold text-slate-700 bg-white cursor-pointer"
            >
              {PAGE_SIZES.map((s) => (
                <option key={s} value={s}>
                  {s} / page
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ━━━ 4. DATAGRID TABLE (SCREEN-FITTING, NO ENDLESS SCROLLING) ━━━ */}
      {isLoading ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200/90 shadow-2xs">
          <FiRefreshCw className="animate-spin text-rose-600 mx-auto mb-2" size={24} />
          <p className="text-xs font-bold text-slate-700">Loading returns history...</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Fetching verified restitutions from database</p>
        </div>
      ) : filteredHistory.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200/90 shadow-2xs">
          <FiRotateCcw className="text-slate-300 mx-auto mb-2" size={36} />
          <p className="text-xs font-bold text-slate-700">
            {historySearch ? 'No matching return records found' : 'No sales returns logged yet'}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Click &quot;Find Sale &amp; Return&quot; above to look up an invoice and process a refund
          </p>
          <button
            onClick={openLookup}
            className="mt-3 px-3 py-1.5 bg-gradient-to-r from-rose-600 to-amber-500 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow-rose-500/25 transition inline-flex items-center gap-1 cursor-pointer"
          >
            <FiPlus size={12} /> Find Sale &amp; Return
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[950px]">
              <thead className="bg-slate-50/90 border-b-2 border-slate-200">
                <tr className="bg-slate-50/90 border-b-2 border-slate-200 text-[10.5px] font-black uppercase text-slate-700 tracking-wider">
                  <th className="py-2.5 px-3 w-8 text-center border-r border-slate-200">#</th>
                  <th className="py-2.5 px-3 whitespace-nowrap border-r border-slate-200">Return #</th>
                  <th className="py-2.5 px-3 whitespace-nowrap border-r border-slate-200">Return Date</th>
                  <th className="py-2.5 px-3 whitespace-nowrap border-r border-slate-200">Original Sale Ref</th>
                  <th className="py-2.5 px-3 whitespace-nowrap border-r border-slate-200">Product Name</th>
                  <th className="py-2.5 px-3 text-center whitespace-nowrap border-r border-slate-200">Restocked Qty</th>
                  <th className="py-2.5 px-3 text-right whitespace-nowrap border-r border-slate-200">Unit Price</th>
                  <th className="py-2.5 px-3 text-right whitespace-nowrap border-r border-slate-200">Refund Amount</th>
                  <th className="py-2.5 px-3 whitespace-nowrap border-r border-slate-200">Reason</th>
                  <th className="py-2.5 px-3 text-center whitespace-nowrap border-r border-slate-200">Status</th>
                  <th className="py-2.5 px-3 whitespace-nowrap border-r border-slate-200">Processed By</th>
                  {!isCashier && <th className="py-2.5 px-3 text-center whitespace-nowrap w-20">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                {paginatedReturns.map((r, idx) => {
                  const isCopied = copiedReturnNo === r.return_no;
                  return (
                    <tr
                      key={r.return_id}
                      className={`transition-colors hover:bg-rose-50/30 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}
                    >
                      {/* # */}
                      <td className="py-2 px-3 text-center border-r border-slate-100 text-slate-400 text-[11px]">
                        {(page - 1) * perPage + idx + 1}
                      </td>

                      {/* Return No */}
                      <td className="py-2 px-3 whitespace-nowrap border-r border-slate-100 font-mono text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200/70">
                            {r.return_no}
                          </span>
                          <button
                            onClick={() => copyText(r.return_no)}
                            className="text-slate-300 hover:text-slate-600 transition cursor-pointer"
                            title="Copy Return #"
                          >
                            {isCopied ? <FiCheck size={11} className="text-emerald-600" /> : <FiCopy size={11} />}
                          </button>
                        </div>
                      </td>

                      {/* Date */}
                      <td className="py-2 px-3 whitespace-nowrap border-r border-slate-100 text-slate-600 font-semibold">
                        {formatDate(r.return_date)}
                      </td>

                      {/* Original Sale Ref */}
                      <td className="py-2 px-3 whitespace-nowrap border-r border-slate-100 font-mono text-xs text-indigo-700 font-semibold">
                        <div className="flex items-center gap-1.5">
                          <span>{r.original_sale_id || '—'}</span>
                          {r.original_sale_id && (
                            <button
                              onClick={() => copyText(r.original_sale_id)}
                              className="text-slate-300 hover:text-slate-600 transition cursor-pointer"
                              title="Copy Original Sale Ref"
                            >
                              <FiCopy size={10} />
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Product Name */}
                      <td className="py-2 px-3 border-r border-slate-100">
                        <div className="font-semibold text-slate-900 truncate max-w-[200px]" title={r.product_name}>
                          {r.product_name}
                        </div>
                      </td>

                      {/* Restocked Qty */}
                      <td className="py-2 px-3 text-center font-mono font-bold text-slate-800 border-r border-slate-100">
                        <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-xs">
                          {r.quantity} Pcs
                        </span>
                      </td>

                      {/* Unit Price */}
                      <td className="py-2 px-3 text-right font-mono text-xs text-slate-600 border-r border-slate-100">
                        {fmt(r.unit_price || 0)}
                      </td>

                      {/* Refund Amount */}
                      <td className="py-2 px-3 text-right font-mono text-xs font-bold text-rose-700 bg-rose-50/40 border-r border-slate-100">
                        {fmt(r.total_amount || 0)}
                      </td>

                      {/* Reason */}
                      <td className="py-2 px-3 whitespace-nowrap border-r border-slate-100">
                        <ReasonBadge reason={r.reason} />
                      </td>

                      {/* Status */}
                      <td className="py-2 px-3 whitespace-nowrap text-center border-r border-slate-100">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
                          <FiCheckCircle size={10} /> {r.status || 'Completed'}
                        </span>
                      </td>

                      {/* Processed By */}
                      <td className="py-2 px-3 whitespace-nowrap text-xs text-slate-500 border-r border-slate-100">
                        <div className="flex items-center gap-1">
                          <FiUser size={11} className="text-slate-400" />
                          <span>{r.processed_by || 'Staff'}</span>
                        </div>
                      </td>

                      {/* Action */}
                      {!isCashier && (
                        <td className="py-2 px-3 whitespace-nowrap text-center">
                          {deleteConfirmId === r.return_id ? (
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleDelete(r.return_id)}
                                className="px-1.5 py-0.5 bg-rose-600 text-white rounded text-[10px] font-bold hover:bg-rose-700 cursor-pointer"
                              >
                                Yes
                              </button>
                              <button
                                onClick={() => setDeleteConfirmId(null)}
                                className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-bold hover:bg-slate-200 cursor-pointer"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirmId(r.return_id)}
                              className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                              title="Delete Return Record"
                            >
                              <FiTrash2 size={12} />
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>

              {/* Grand Total Footer */}
              <tfoot className="bg-slate-50/90 border-t-2 border-slate-200 font-bold text-slate-800 text-xs">
                <tr>
                  <td colSpan={4} className="py-2.5 px-3 border-r border-slate-200">
                    <span className="uppercase tracking-wider text-[10.5px] font-black text-slate-800">
                      Grand Total:
                    </span>
                    <span className="font-mono text-slate-900 text-xs font-black ml-1.5">
                      {fmtN(filteredHistory.length)} Records
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-500 border-r border-slate-200">All Restitutions</td>
                  <td className="py-2.5 px-3 text-center border-r border-slate-200 font-mono">
                    {fmtN(filteredHistory.reduce((s, r) => s + (r.quantity || 0), 0))} Pcs
                  </td>
                  <td className="py-2.5 px-3 text-slate-400 border-r border-slate-200 font-mono">—</td>
                  <td className="py-2.5 px-3 text-right font-mono text-xs font-black text-rose-800 bg-rose-50/70 border-r border-slate-200">
                    {fmt(totalValue)}
                  </td>
                  <td className="py-2.5 px-3 text-center border-r border-slate-200 text-slate-500 text-[10.5px]">
                    {filterReason}
                  </td>
                  <td className="py-2.5 px-3 text-center border-r border-slate-200 text-emerald-700 text-[10.5px]">
                    Completed
                  </td>
                  <td className="py-2.5 px-3 text-slate-500 border-r border-slate-200">Audit Verified</td>
                  {!isCashier && <td className="py-2.5 px-3 text-center text-slate-400">—</td>}
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ━━━ 5. FLOATING COMPACT PAGINATION FOOTER ━━━ */}
      <div className="sticky bottom-0 z-30 bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl shadow-lg px-4 py-2 mt-2">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span>Show</span>
            <select
              value={perPage}
              onChange={(e) => {
                setPerPage(parseInt(e.target.value, 10));
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
              of <strong className="font-bold text-slate-800 font-mono">{filteredHistory.length}</strong> returns
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(1)}
              disabled={page === 1}
              className="p-1 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-rose-600 disabled:opacity-30 transition-all cursor-pointer"
              title="First Page"
            >
              <FiChevronsLeft size={12} />
            </button>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-rose-600 disabled:opacity-30 transition-all cursor-pointer"
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
                      ? 'bg-rose-600 text-white shadow-2xs font-black'
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
              className="p-1 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-rose-600 disabled:opacity-30 transition-all cursor-pointer"
              title="Next Page"
            >
              <FiChevronRight size={12} />
            </button>
            <button
              onClick={() => setPage(totalPages)}
              disabled={page >= totalPages}
              className="p-1 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-rose-600 disabled:opacity-30 transition-all cursor-pointer"
              title="Last Page"
            >
              <FiChevronsRight size={12} />
            </button>
          </div>
        </div>
      </div>

      {/* ━━━ 6. EXECUTIVE LOOKUP & RETURN PROCESSOR MODAL (STEPPER UI) ━━━ */}
      {showLookup && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50/80">
              <div className="flex items-center gap-2.5">
                {step === 2 && (
                  <button
                    onClick={() => {
                      setStep(1);
                      setSelectedSale(null);
                      setSaleItems([]);
                    }}
                    className="p-1.5 hover:bg-white rounded-xl transition text-slate-500 hover:text-slate-800 border border-slate-200 shadow-2xs cursor-pointer"
                    title="Back to Sales Selection"
                  >
                    <FiChevronLeft size={16} />
                  </button>
                )}
                <div>
                  <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <span>{step === 1 ? 'Locate Original Sale to Return' : 'Select Line Items to Restitute'}</span>
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                      Step {step} of 2
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {step === 1
                      ? 'Search by invoice/receipt number or customer name to verify original sale'
                      : `Invoice: ${selectedSale?.receipt_no} • Customer: ${selectedSale?.customer_name || 'Walk-in'} • Amount: ${fmt(selectedSale?.total_amount || 0)}`}
                  </p>
                </div>
              </div>
              <button
                onClick={closeLookup}
                className="p-1.5 hover:bg-white rounded-xl text-slate-400 hover:text-slate-600 border border-slate-200 transition cursor-pointer"
              >
                <FiX size={15} />
              </button>
            </div>

            {/* STEP 1: Search Sales */}
            {step === 1 && (
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                {/* Search Bar & Date Controls */}
                <div className="p-3 border-b border-slate-100 bg-white space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                      <input
                        autoFocus
                        value={saleSearch}
                        onChange={(e) => setSaleSearch(e.target.value)}
                        placeholder="Search receipt number, customer name, or phone..."
                        className="w-full pl-8 pr-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-rose-400 bg-slate-50 focus:bg-white"
                      />
                      {saleSearch && (
                        <button
                          onClick={() => setSaleSearch('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          <FiX size={12} />
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <input
                        type="date"
                        value={saleDateFilter}
                        onChange={(e) => setSaleDateFilter(e.target.value)}
                        className="px-2.5 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-rose-400 bg-slate-50 cursor-pointer"
                        title="Filter by sale date"
                      />
                      {saleDateFilter && (
                        <button
                          onClick={() => setSaleDateFilter('')}
                          className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold cursor-pointer"
                          title="Clear date filter"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Quick Preset Buttons */}
                  <div className="flex items-center gap-1 text-[10.5px]">
                    <span className="text-slate-400 font-bold uppercase text-[9.5px] mr-1">Quick Scope:</span>
                    <button
                      onClick={() => setSaleDateFilter('')}
                      className={`px-2 py-0.5 rounded-lg font-bold transition cursor-pointer ${
                        !saleDateFilter ? 'bg-rose-600 text-white shadow-2xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      All Recent
                    </button>
                    <button
                      onClick={() => setSaleDateFilter(toDay())}
                      className={`px-2 py-0.5 rounded-lg font-bold transition cursor-pointer ${
                        saleDateFilter === toDay() ? 'bg-rose-600 text-white shadow-2xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Today
                    </button>
                    <button
                      onClick={() => setSaleDateFilter(getYesterday())}
                      className={`px-2 py-0.5 rounded-lg font-bold transition cursor-pointer ${
                        saleDateFilter === getYesterday() ? 'bg-rose-600 text-white shadow-2xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Yesterday
                    </button>
                  </div>
                </div>

                {/* Sales List */}
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {isSearching ? (
                    <div className="flex items-center justify-center py-16 gap-2 text-slate-400 text-xs">
                      <FiRefreshCw className="animate-spin text-rose-500" size={16} />
                      <span>Searching sales register...</span>
                    </div>
                  ) : salesList.length === 0 ? (
                    <div className="text-center py-16 text-slate-400">
                      <FiSearch size={32} className="mx-auto mb-2 text-slate-300" />
                      <p className="font-bold text-xs text-slate-600">No sales transactions found</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {saleDateFilter ? `No sales recorded on ${formatDate(saleDateFilter)}. Try clearing date or search.` : 'Try typing a receipt number or picking a date.'}
                      </p>
                      {saleDateFilter && (
                        <button
                          onClick={() => setSaleDateFilter('')}
                          className="mt-2 px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition cursor-pointer"
                        >
                          Clear Date Filter (Show All)
                        </button>
                      )}
                    </div>
                  ) : (
                    salesList.map((sale) => (
                      <button
                        key={sale.sale_id || sale.receipt_no}
                        type="button"
                        onClick={() => selectSale(sale)}
                        className="w-full text-left p-3 rounded-2xl border border-slate-200 hover:border-rose-300 hover:bg-rose-50/40 transition-all flex items-center justify-between gap-3 group cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-200/80 flex items-center justify-center text-rose-600 font-black shrink-0">
                            <FiShoppingBag size={16} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs text-slate-900 font-mono">{sale.receipt_no}</span>
                              <span className="px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-slate-100 text-slate-700">
                                {sale.payment_method || 'Cash'}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              {sale.customer_name || 'Walk-in Customer'}
                              {sale.customer_phone ? ` (${sale.customer_phone})` : ''} &bull; {formatDate(sale.sale_date)}
                              {sale.created_by ? ` • ${sale.created_by}` : ''}
                            </p>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <p className="font-mono font-bold text-xs text-slate-900">{fmt(sale.total_amount || 0)}</p>
                          <span className="text-[10px] text-rose-600 font-bold group-hover:underline inline-flex items-center gap-0.5 mt-0.5">
                            Select Invoice <FiArrowRight size={10} />
                          </span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* STEP 2: Item Selection & Quantities */}
            {step === 2 && (
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                  {loadingItems ? (
                    <div className="flex items-center justify-center py-16 gap-2 text-slate-400 text-xs">
                      <FiRefreshCw className="animate-spin text-rose-500" size={16} />
                      <span>Loading line items from sale record...</span>
                    </div>
                  ) : saleItems.length === 0 ? (
                    <div className="text-center py-16 text-slate-400">
                      <FiPackage size={32} className="mx-auto mb-2 text-slate-300" />
                      <p className="font-bold text-xs text-slate-600">No items found for this sale</p>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between pb-1 text-[11px] font-bold text-slate-500 uppercase">
                        <span>Click an item to select • specify return quantity</span>
                        <span>{selectedCount} selected</span>
                      </div>

                      {saleItems.map((item) => (
                        <div
                          key={item._idx}
                          className={`rounded-2xl border-2 p-3 transition-all ${
                            item.selected
                              ? 'border-rose-400 bg-rose-50/60 shadow-2xs'
                              : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => toggleItem(item._idx)}
                              className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition cursor-pointer ${
                                item.selected
                                  ? 'bg-rose-600 border-rose-600 text-white'
                                  : 'border-slate-300 bg-white hover:border-rose-400'
                              }`}
                            >
                              {item.selected && <FiCheck size={12} strokeWidth={3} />}
                            </button>

                            <div className="flex-1 min-w-0 cursor-pointer" onClick={() => toggleItem(item._idx)}>
                              <p className="font-bold text-slate-800 text-xs truncate">{item.product_name}</p>
                              <p className="text-[10.5px] text-slate-400 mt-0.5">
                                Sold: <strong>{item.quantity}</strong> × {fmt(item.unit_price)} ={' '}
                                <strong className="text-slate-700">{fmt(item.subtotal || item.quantity * item.unit_price)}</strong>
                              </p>
                            </div>

                            {item.selected && (
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-[10.5px] font-bold text-slate-500 hidden sm:inline">Qty:</span>
                                <div className="flex items-center border border-rose-300 rounded-lg overflow-hidden bg-white shadow-2xs">
                                  <button
                                    onClick={() => setReturnQty(item._idx, item.returnQty - 1)}
                                    className="w-7 h-7 flex items-center justify-center text-rose-600 hover:bg-rose-50 font-black text-sm cursor-pointer"
                                  >
                                    −
                                  </button>
                                  <input
                                    type="number"
                                    min={0}
                                    max={item.quantity}
                                    value={item.returnQty}
                                    onChange={(e) => setReturnQty(item._idx, parseFloat(e.target.value) || 0)}
                                    className="w-10 text-center text-xs font-black text-slate-900 focus:outline-none py-1"
                                  />
                                  <button
                                    onClick={() => setReturnQty(item._idx, item.returnQty + 1)}
                                    className="w-7 h-7 flex items-center justify-center text-rose-600 hover:bg-rose-50 font-black text-sm cursor-pointer"
                                  >
                                    +
                                  </button>
                                </div>
                                <span className="text-xs font-mono font-bold text-rose-700 min-w-[70px] text-right">
                                  {fmt(Math.round(item.returnQty * item.unit_price))}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>

                {/* Modal Footer: Reason & Confirmation */}
                {!loadingItems && saleItems.length > 0 && (
                  <div className="p-4 border-t border-slate-200 bg-slate-50/90 space-y-3">
                    <div className="flex items-center gap-3">
                      <label className="text-xs font-bold text-slate-700 shrink-0">Return Reason:</label>
                      <select
                        value={returnReason}
                        onChange={(e) => setReturnReason(e.target.value)}
                        className="flex-1 px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 bg-white outline-none focus:border-rose-400 cursor-pointer"
                      >
                        {REASONS.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <div>
                        {selectedCount > 0 ? (
                          <>
                            <p className="text-xs font-bold text-slate-800">
                              {selectedCount} item{selectedCount !== 1 ? 's' : ''} flagged for return
                            </p>
                            <p className="text-[11px] text-slate-500">
                              Total Refund:{' '}
                              <span className="font-mono font-black text-rose-700 text-sm">
                                {fmt(Math.round(selectedTotal))}
                              </span>
                            </p>
                          </>
                        ) : (
                          <p className="text-xs text-slate-400">Select at least one item above to process return</p>
                        )}
                      </div>

                      <button
                        onClick={processReturn}
                        disabled={selectedCount === 0 || isProcessing}
                        className="flex items-center gap-1.5 px-5 py-2.5 bg-gradient-to-r from-rose-600 via-rose-500 to-amber-500 hover:from-rose-700 hover:to-amber-600 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none cursor-pointer"
                      >
                        {isProcessing ? (
                          <>
                            <FiRefreshCw className="animate-spin" size={13} />
                            <span>Processing Restitution...</span>
                          </>
                        ) : (
                          <>
                            <FiCheckCircle size={13} />
                            <span>Confirm &amp; Restock</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
