'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useCompanyName } from '@/context/SettingsContext';
import { supabase } from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';
import { printCustomerReceipt, loadCompanyInfo } from '@/lib/receiptPrinter';
import toast, { Toaster } from 'react-hot-toast';
import * as XLSX from 'xlsx';
import {
  FiDollarSign,
  FiShoppingBag,
  FiDownload,
  FiPrinter,
  FiRefreshCw,
  FiSearch,
  FiChevronLeft,
  FiChevronRight,
  FiChevronsLeft,
  FiChevronsRight,
  FiChevronDown,
  FiChevronUp,
  FiX,
  FiCheck,
  FiCheckCircle,
  FiClock,
  FiSliders,
  FiEye,
  FiFileText,
  FiCopy,
  FiPlus,
  FiTrendingUp,
  FiZap,
  FiActivity,
  FiLayers,
  FiUser,
  FiArrowRight,
  FiCalendar,
  FiFilter,
  FiRotateCcw,
} from 'react-icons/fi';

/* ══════════════════════════════════════════════════════════════════════════════
   TYPES & INTERFACES
   ══════════════════════════════════════════════════════════════════════════════ */
interface Sale {
  sale_id: number;
  receipt_no: string;
  sale_date: string;
  sale_datetime: string;
  customer_name: string;
  customer_phone: string;
  subtotal: number;
  discount: number;
  total_amount: number;
  payment_method: string;
  amount_paid: number;
  change_amount: number;
  mpesa_code: string;
  checkout_request_id?: string;
  status: string;
  created_by?: string;
  served_by?: string;
  cashier_name?: string;
  outlet_id?: number;
  total_items?: number;
  total_qty?: number;
}

interface SaleItem {
  item_id: number;
  sale_id: number;
  product_id: number;
  product_name: string;
  quantity: number;
  unit_price: number;
  discount: number;
  subtotal: number;
  selling_unit?: string;
  barcode?: string;
}

/* ══════════════════════════════════════════════════════════════════════════════
   FORMATTERS & SAFE HELPERS
   ══════════════════════════════════════════════════════════════════════════════ */
const fmt = (n: number) =>
  `Ksh ${(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtKES = (n: number) => `Ksh ${(n || 0).toLocaleString('en-KE')}`;

const fmtK = (n: number) => {
  if (Math.abs(n) >= 1_000_000) return `Ksh ${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `Ksh ${(n / 1_000).toFixed(1)}K`;
  return `Ksh ${(n || 0).toLocaleString('en-KE')}`;
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

const formatTime = (val: string) => {
  const dt = safeDate(val);
  if (!dt) return '—';
  return dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
};

const PAY_METHODS = ['All', 'Cash', 'M-Pesa', 'Credit', 'Card', 'Split'];
const PAGE_SIZES = [10, 20, 50, 100];

/* ══════════════════════════════════════════════════════════════════════════════
   UNIFORM STATUS & BADGE PILLS
   ══════════════════════════════════════════════════════════════════════════════ */
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

const payColor = (m: string) => {
  const v = (m || '').toLowerCase();
  if (v === 'cash') return 'green';
  if (v === 'm-pesa' || v === 'mpesa') return 'blue';
  if (v === 'card') return 'purple';
  if (v === 'credit') return 'amber';
  if (v === 'split') return 'indigo';
  return 'gray';
};

/* ══════════════════════════════════════════════════════════════════════════════
   MAIN SALES PAGE COMPONENT
   ══════════════════════════════════════════════════════════════════════════════ */
export default function SalesPage() {
  const { activeOutlet } = useOutlet();
  const outletId = activeOutlet?.outlet_id || 1;
  const companyName = useCompanyName();

  // Core Data States
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [returnedSales, setReturnedSales] = useState<Set<string>>(new Set());

  // Filter & Search Controls
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState(toDay());
  const [dateTo, setDateTo] = useState(toDay());
  const [filterPayment, setFilterPayment] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'highest_amount'>('newest');

  // Pagination Controls (Fixes long datagrid)
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);

  // Expandable Row & Items Cache
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [saleItemsCache, setSaleItemsCache] = useState<Record<number, SaleItem[]>>({});
  const [loadingItems, setLoadingItems] = useState<Set<number>>(new Set());
  const [copiedReceipt, setCopiedReceipt] = useState<string | null>(null);

  // Receipt Modal State
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [selectedSaleItems, setSelectedSaleItems] = useState<SaleItem[]>([]);

  // Search input ref for Ctrl+F
  const searchInputRef = useRef<HTMLInputElement>(null);

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
     Data Loading: Sales Register & Returns
     ───────────────────────────────────────────────────────────────────────── */
  const loadSales = useCallback(async () => {
    setLoading(true);
    try {
      let salesData: Sale[] = [];

      // Query with date range and outlet filter
      if (outletId) {
        const { data, error } = await supabase
          .from('retail_sales')
          .select('*')
          .eq('outlet_id', outletId)
          .gte('sale_date', dateFrom)
          .lte('sale_date', dateTo)
          .order('sale_datetime', { ascending: false })
          .limit(3000);

        if (!error && data) {
          salesData = data;
        }
      }

      // Fallback query if no rows found or outlet filter failed
      if (salesData.length === 0) {
        const { data } = await supabase
          .from('retail_sales')
          .select('*')
          .gte('sale_date', dateFrom)
          .lte('sale_date', dateTo)
          .order('sale_datetime', { ascending: false })
          .limit(3000);

        if (data) salesData = data;
      }

      setSales(salesData);
      setExpandedRows(new Set());

      // Query returned sales
      const receiptNos = salesData.map((s) => s.receipt_no).filter(Boolean);
      if (receiptNos.length > 0) {
        const { data: retData } = await supabase
          .from('sales_returns')
          .select('original_sale_id')
          .in('original_sale_id', receiptNos);
        setReturnedSales(new Set((retData || []).map((r: any) => r.original_sale_id)));
      } else {
        setReturnedSales(new Set());
      }
    } catch (err) {
      console.error('Error loading sales:', err);
      toast.error('Failed to load sales register');
    } finally {
      setLoading(false);
    }
  }, [outletId, dateFrom, dateTo]);

  useEffect(() => {
    loadSales();
  }, [loadSales]);

  /* ─────────────────────────────────────────────────────────────────────────
     Load Itemized Line Records for a Specific Sale
     ───────────────────────────────────────────────────────────────────────── */
  const loadSaleItems = async (saleId: number): Promise<SaleItem[]> => {
    if (saleItemsCache[saleId]) return saleItemsCache[saleId];
    setLoadingItems((prev) => new Set(prev).add(saleId));
    try {
      const { data } = await supabase
        .from('retail_sales_items')
        .select('*')
        .eq('sale_id', saleId)
        .order('item_id');
      const items = (data || []).map((it: any) => ({
        ...it,
        subtotal: it.subtotal || (it.unit_price || 0) * (it.quantity || 1),
      }));
      setSaleItemsCache((prev) => ({ ...prev, [saleId]: items }));
      return items;
    } catch (err) {
      console.error('Error loading sale items:', err);
      return [];
    } finally {
      setLoadingItems((prev) => {
        const next = new Set(prev);
        next.delete(saleId);
        return next;
      });
    }
  };

  /* ─────────────────────────────────────────────────────────────────────────
     Expand / Collapse Handlers
     ───────────────────────────────────────────────────────────────────────── */
  const toggleRow = async (saleId: number) => {
    const next = new Set(expandedRows);
    if (next.has(saleId)) {
      next.delete(saleId);
    } else {
      next.add(saleId);
      await loadSaleItems(saleId);
    }
    setExpandedRows(next);
  };

  const expandAll = async () => {
    const ids = paginatedSales.map((s) => s.sale_id);
    setExpandedRows(new Set(ids));
    for (const sid of ids) {
      if (!saleItemsCache[sid]) {
        await loadSaleItems(sid);
      }
    }
    toast.success(`Expanded ${ids.length} visible transactions`);
  };

  const collapseAll = () => {
    setExpandedRows(new Set());
  };

  const copyReceiptNo = (receiptNo: string) => {
    if (!receiptNo) return;
    navigator.clipboard.writeText(receiptNo);
    setCopiedReceipt(receiptNo);
    toast.success(`Copied: ${receiptNo}`);
    setTimeout(() => setCopiedReceipt(null), 2000);
  };

  /* ─────────────────────────────────────────────────────────────────────────
     View & Print Handlers
     ───────────────────────────────────────────────────────────────────────── */
  const viewReceipt = async (sale: Sale) => {
    setSelectedSale(sale);
    const items = await loadSaleItems(sale.sale_id);
    setSelectedSaleItems(items);
    setShowReceiptModal(true);
  };

  const handlePrintReceipt = async (sale: Sale) => {
    const items = await loadSaleItems(sale.sale_id);
    try {
      const company = await loadCompanyInfo();
      const dt = safeDate(sale.sale_datetime || sale.sale_date) || new Date();
      const receiptData = {
        invoiceNo: sale.receipt_no || '—',
        date: dt.toLocaleDateString('en-GB'),
        time: dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        cashier: sale.created_by || sale.cashier_name || sale.served_by || 'Staff',
        customer: sale.customer_name || 'Walk-in Customer',
        customerPhone: sale.customer_phone || '',
        items: items.map((it) => ({
          name: it.product_name || 'Item',
          qty: it.quantity || 1,
          price: it.unit_price || 0,
          total: it.subtotal || it.quantity * it.unit_price,
        })),
        subtotal: sale.subtotal || sale.total_amount || 0,
        discount: sale.discount || 0,
        tax: 0,
        total: sale.total_amount || 0,
        paymentMethod: sale.payment_method || 'Cash',
        amountPaid: sale.amount_paid || sale.total_amount || 0,
        change: sale.change_amount || 0,
        mpesaCode: sale.mpesa_code || '',
        company: company || undefined,
      };
      printCustomerReceipt(receiptData);
    } catch {
      // Fallback native printer
      printNativeReceipt(sale, items);
    }
  };

  const printNativeReceipt = (sale: Sale, items: SaleItem[]) => {
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Receipt ${sale.receipt_no}</title>
<style>
@page{margin:5mm;size:80mm auto;}
body{font-family:'Courier New',monospace;font-size:11px;margin:0;padding:8px;max-width:280px;color:#000;}
.center{text-align:center;}.bold{font-weight:700;}.line{border-top:1px dashed #000;margin:6px 0;}
table{width:100%;border-collapse:collapse;}td{padding:2px 0;font-size:10px;}
.right{text-align:right;}.total-row td{border-top:1px solid #000;font-weight:700;padding-top:4px;}
</style></head><body>
<div class="center bold" style="font-size:14px;">${companyName}</div>
<div class="center" style="font-size:9px;color:#444;">Sales Receipt</div>
<div class="line"></div>
<div style="font-size:10px;">
<div>Receipt: <strong>${sale.receipt_no}</strong></div>
<div>Date: ${sale.sale_date} ${formatTime(sale.sale_datetime)}</div>
<div>Customer: ${sale.customer_name || 'Walk-in'}</div>
${sale.customer_phone ? `<div>Phone: ${sale.customer_phone}</div>` : ''}
<div>Payment: ${sale.payment_method || 'Cash'}</div>
${sale.mpesa_code ? `<div>M-Pesa: <strong>${sale.mpesa_code}</strong></div>` : ''}
</div>
<div class="line"></div>
<table>
<tr><td class="bold">Item</td><td class="center bold">Qty</td><td class="right bold">Price</td><td class="right bold">Total</td></tr>
${items
  .map(
    (i) =>
      `<tr><td>${i.product_name}</td><td class="center">${i.quantity}</td><td class="right">${(
        i.unit_price || 0
      ).toLocaleString()}</td><td class="right">${(i.subtotal || 0).toLocaleString()}</td></tr>`
  )
  .join('')}
<tr class="total-row"><td colspan="3" class="right">TOTAL:</td><td class="right">Ksh ${(
      sale.total_amount || 0
    ).toLocaleString()}</td></tr>
</table>
${(sale.discount || 0) > 0 ? `<div style="font-size:10px;">Discount: -Ksh ${(sale.discount || 0).toLocaleString()}</div>` : ''}
<div class="line"></div>
<div class="center" style="font-size:9px;color:#555;">Thank you for your business!</div>
</body></html>`;
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
      w.print();
    }
  };

  /* ─────────────────────────────────────────────────────────────────────────
     Super-Premium Excel Export (.xlsx)
     ───────────────────────────────────────────────────────────────────────── */
  const exportExcel = () => {
    try {
      const rows = filteredSales.map((s, idx) => {
        const dt = safeDate(s.sale_datetime || s.sale_date);
        return {
          '#': idx + 1,
          'Receipt No': s.receipt_no || '',
          Date: dt ? dt.toLocaleDateString('en-GB') : s.sale_date || '',
          Time: dt ? dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '',
          'Customer Name': s.customer_name || 'Walk-in Customer',
          'Customer Phone': s.customer_phone || '',
          'Payment Method': s.payment_method || 'Cash',
          'M-Pesa Code': s.mpesa_code || '',
          'Subtotal (Ksh)': Number(s.subtotal || s.total_amount || 0),
          'Discount (Ksh)': Number(s.discount || 0),
          'Total Amount (Ksh)': Number(s.total_amount || 0),
          Status: s.status || 'Completed',
          Cashier: s.created_by || s.cashier_name || 'Staff',
        };
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Sales Register');

      // Add Executive Summary Sheet
      const summaryRows = [
        { Parameter: 'Company Name', Value: companyName },
        { Parameter: 'Outlet Name', Value: activeOutlet?.outlet_name || 'All Outlets' },
        { Parameter: 'Date Range Window', Value: `${dateFrom} to ${dateTo}` },
        { Parameter: 'Total Transactions', Value: filteredSales.length },
        { Parameter: 'Gross Sales Revenue (Ksh)', Value: totalRevenue },
        { Parameter: 'Cash Volume (Ksh)', Value: cashTotal },
        { Parameter: 'M-Pesa Volume (Ksh)', Value: mpesaTotal },
        { Parameter: 'Credit Sales (Ksh)', Value: creditTotal },
        {
          Parameter: 'Average Order Value (AOV)',
          Value: filteredSales.length > 0 ? Number((totalRevenue / filteredSales.length).toFixed(2)) : 0,
        },
        { Parameter: 'Generated At', Value: new Date().toLocaleString('en-KE') },
      ];
      const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Executive Summary');

      XLSX.writeFile(wb, `Sales_Register_${dateFrom}_to_${dateTo}.xlsx`);
      toast.success('Super-premium Excel workbook exported successfully!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to export Excel workbook');
    }
  };

  /* ─────────────────────────────────────────────────────────────────────────
     Export CSV
     ───────────────────────────────────────────────────────────────────────── */
  const exportCSV = () => {
    try {
      const headers = ['Receipt No', 'Date', 'Time', 'Customer', 'Phone', 'Payment', 'M-Pesa', 'Amount', 'Status'];
      const lines = filteredSales.map((s) => {
        const dt = safeDate(s.sale_datetime || s.sale_date);
        return [
          `"${s.receipt_no || ''}"`,
          `"${dt ? dt.toLocaleDateString('en-GB') : s.sale_date || ''}"`,
          `"${formatTime(s.sale_datetime)}"`,
          `"${s.customer_name || 'Walk-in'}"`,
          `"${s.customer_phone || ''}"`,
          `"${s.payment_method || 'Cash'}"`,
          `"${s.mpesa_code || ''}"`,
          Number(s.total_amount || 0),
          `"${s.status || 'Completed'}"`,
        ].join(',');
      });
      const csv = [headers.join(','), ...lines].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Sales_Register_${dateFrom}_to_${dateTo}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('CSV register downloaded!');
    } catch {
      toast.error('Failed to export CSV');
    }
  };

  /* ─────────────────────────────────────────────────────────────────────────
     Print Official Statement & PDF Export
     ───────────────────────────────────────────────────────────────────────── */
  const printStatement = () => {
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Sales Audit Statement - ${companyName}</title>
  <style>
    @page { size: A4 portrait; margin: 10mm; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #0f172a; margin: 0; padding: 8px; font-size: 11px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 12px; }
    .company { font-size: 17px; font-weight: 900; color: #0f172a; letter-spacing: -0.5px; }
    .title { font-size: 13px; font-weight: 700; color: #4338ca; margin-top: 2px; }
    .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 14px; }
    .kpi { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 10px; }
    .kpi-lbl { font-size: 8.5px; font-weight: 700; text-transform: uppercase; color: #64748b; }
    .kpi-val { font-size: 13px; font-weight: 900; color: #0f172a; margin-top: 2px; font-family: monospace; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 9.5px; }
    th { background: #f1f5f9; color: #0f172a; font-weight: 800; text-transform: uppercase; font-size: 8.5px; padding: 6px 8px; border-bottom: 1.5px solid #cbd5e1; text-align: left; }
    td { padding: 5px 8px; border-bottom: 1px solid #e2e8f0; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 8.5px; font-weight: 700; }
    .badge-cash { background: #ecfdf5; color: #065f46; }
    .badge-mpesa { background: #f0f9ff; color: #0369a1; }
    .badge-credit { background: #fffbeb; color: #92400e; }
    .footer { margin-top: 16px; border-top: 1px solid #cbd5e1; padding-top: 8px; display: flex; justify-content: space-between; font-size: 8.5px; color: #64748b; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="company">${companyName}</div>
      <div class="title">Sales Register & Transaction Audit Statement</div>
      <div style="font-size: 10px; color: #64748b; margin-top: 3px;">
        Outlet: <strong>${activeOutlet?.outlet_name || 'All Outlets'}</strong> &bull; Period: <strong>${dateFrom}</strong> to <strong>${dateTo}</strong>
      </div>
    </div>
    <div style="text-align: right; font-size: 10px; color: #64748b;">
      <div>Generated: ${new Date().toLocaleString('en-KE')}</div>
      <div>Transactions: <strong>${filteredSales.length}</strong></div>
    </div>
  </div>

  <div class="kpis">
    <div class="kpi">
      <div class="kpi-lbl">Gross Sales</div>
      <div class="kpi-val">Ksh ${totalRevenue.toLocaleString()}</div>
    </div>
    <div class="kpi">
      <div class="kpi-lbl">Cash In Hand</div>
      <div class="kpi-val">Ksh ${cashTotal.toLocaleString()}</div>
    </div>
    <div class="kpi">
      <div class="kpi-lbl">M-Pesa Volume</div>
      <div class="kpi-val">Ksh ${mpesaTotal.toLocaleString()}</div>
    </div>
    <div class="kpi">
      <div class="kpi-lbl">Credit Total</div>
      <div class="kpi-val">Ksh ${creditTotal.toLocaleString()}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 20px;">#</th>
        <th>Receipt No</th>
        <th>Date & Time</th>
        <th>Customer</th>
        <th>Payment</th>
        <th>M-Pesa Code</th>
        <th class="text-right">Subtotal</th>
        <th class="text-right">Discount</th>
        <th class="text-right">Total Amount</th>
        <th class="text-center">Status</th>
      </tr>
    </thead>
    <tbody>
      ${filteredSales
        .map(
          (s, idx) => `
        <tr>
          <td>${idx + 1}</td>
          <td style="font-family: monospace; font-weight: 700;">${s.receipt_no || '—'}</td>
          <td>${s.sale_date || ''} ${formatTime(s.sale_datetime)}</td>
          <td>${s.customer_name || 'Walk-in'}${s.customer_phone ? ` (${s.customer_phone})` : ''}</td>
          <td><span class="badge ${
            s.payment_method?.toUpperCase() === 'CASH'
              ? 'badge-cash'
              : s.payment_method?.toUpperCase() === 'CREDIT'
              ? 'badge-credit'
              : 'badge-mpesa'
          }">${s.payment_method || 'Cash'}</span></td>
          <td style="font-family: monospace;">${s.mpesa_code || '—'}</td>
          <td class="text-right">Ksh ${(s.subtotal || s.total_amount || 0).toLocaleString()}</td>
          <td class="text-right">${(s.discount || 0) > 0 ? `-Ksh ${s.discount.toLocaleString()}` : '—'}</td>
          <td class="text-right" style="font-weight: 800; font-family: monospace;">Ksh ${(
            s.total_amount || 0
          ).toLocaleString()}</td>
          <td class="text-center">${s.status || 'Completed'}</td>
        </tr>
      `
        )
        .join('')}
    </tbody>
    <tfoot>
      <tr style="background: #f8fafc; font-weight: 800; border-top: 2px solid #0f172a;">
        <td colspan="8" class="text-right">GRAND TOTAL (${filteredSales.length} Transactions):</td>
        <td class="text-right" style="color: #4338ca; font-family: monospace; font-size: 11px;">Ksh ${totalRevenue.toLocaleString()}</td>
        <td></td>
      </tr>
    </tfoot>
  </table>

  <div class="footer">
    <div>Alpha Retail Executive POS • Official Statement</div>
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
  const filteredSales = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    let res = sales.filter((s) => {
      if (q) {
        const hay = [
          s.receipt_no,
          s.customer_name,
          s.customer_phone,
          s.mpesa_code,
          s.created_by,
          s.cashier_name,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }

      if (filterPayment !== 'All') {
        const pm = (s.payment_method || '').toLowerCase();
        if (filterPayment === 'M-Pesa') {
          if (!['m-pesa', 'mpesa'].includes(pm)) return false;
        } else if (pm !== filterPayment.toLowerCase()) {
          return false;
        }
      }

      if (filterStatus !== 'All') {
        const st = (s.status || '').toLowerCase();
        if (filterStatus === 'Returned') {
          if (!returnedSales.has(s.receipt_no)) return false;
        } else if (st !== filterStatus.toLowerCase()) {
          return false;
        }
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
    }

    return res;
  }, [sales, searchQuery, filterPayment, filterStatus, sortBy, returnedSales]);

  // Paginated Slices (Fixes long datagrid)
  const totalPages = Math.max(1, Math.ceil(filteredSales.length / perPage));
  const paginatedSales = useMemo(() => {
    const from = (page - 1) * perPage;
    return filteredSales.slice(from, from + perPage);
  }, [filteredSales, page, perPage]);

  // Financial Metric Calculations
  const totalRevenue = useMemo(
    () => filteredSales.reduce((sum, s) => sum + (s.total_amount || 0), 0),
    [filteredSales]
  );
  const totalDiscount = useMemo(
    () => filteredSales.reduce((sum, s) => sum + (s.discount || 0), 0),
    [filteredSales]
  );
  const cashRows = useMemo(
    () => filteredSales.filter((s) => (s.payment_method || '').toUpperCase() === 'CASH'),
    [filteredSales]
  );
  const mpesaRows = useMemo(
    () =>
      filteredSales.filter((s) => {
        const m = (s.payment_method || '').toUpperCase();
        return m === 'MPESA' || m === 'M-PESA';
      }),
    [filteredSales]
  );
  const creditRows = useMemo(
    () => filteredSales.filter((s) => (s.payment_method || '').toUpperCase() === 'CREDIT'),
    [filteredSales]
  );

  const cashTotal = useMemo(() => cashRows.reduce((sum, s) => sum + (s.total_amount || 0), 0), [cashRows]);
  const mpesaTotal = useMemo(() => mpesaRows.reduce((sum, s) => sum + (s.total_amount || 0), 0), [mpesaRows]);
  const creditTotal = useMemo(() => creditRows.reduce((sum, s) => sum + (s.total_amount || 0), 0), [creditRows]);
  const avgOrder = useMemo(
    () => (filteredSales.length > 0 ? totalRevenue / filteredSales.length : 0),
    [filteredSales.length, totalRevenue]
  );

  /* ─────────────────────────────────────────────────────────────────────────
     UI RENDER: Matching Products Page Design System
     ───────────────────────────────────────────────────────────────────────── */
  return (
    <div className="w-full max-w-full min-w-0 space-y-2.5 pb-10 text-slate-800 font-sans">
      <Toaster position="top-right" />

      {/* ━━━ 1. TOP EXECUTIVE COMMAND BAR (SINGLE-LINE SCREEN-FITTING) ━━━ */}
      <div className="bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl shadow-xs px-3 py-1.5 transition-all">
        <div className="flex items-center justify-between gap-2 overflow-x-auto scrollbar-none">
          {/* Brand & Sales Scope Pill */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-blue-600 via-indigo-600 to-sky-500 flex items-center justify-center text-white font-black shadow-xs">
              <FiShoppingBag size={14} />
            </div>
            <div className="leading-tight">
              <div className="flex items-center gap-1.5">
                <h1 className="text-xs font-black tracking-tight text-slate-900 whitespace-nowrap">
                  Sales Register &amp; Transaction Hub
                </h1>
                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  v2.6
                </span>
                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live Stream
                </span>
              </div>
              <div className="text-[10px] font-semibold text-slate-400 flex items-center gap-1.5 whitespace-nowrap">
                <span className="text-slate-600">{companyName || 'Alpha Retail'}</span>
                <span>•</span>
                <span className="font-mono text-slate-700 font-bold">{activeOutlet?.outlet_name || 'Main Outlet'}</span>
                <span>•</span>
                <span className="text-indigo-600 font-bold">{filteredSales.length} Transactions</span>
              </div>
            </div>
          </div>

          {/* Quick Action Toolbar */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => {
                loadSales();
                toast.success('Sales ledger refreshed');
              }}
              className="px-2 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-bold transition-all shadow-2xs hover:border-slate-300 flex items-center gap-1 cursor-pointer"
              title="Refresh Sales Data"
            >
              <FiRefreshCw size={11} className={loading ? 'animate-spin text-blue-600' : 'text-slate-500'} />
              <span>Refresh</span>
            </button>

            <button
              onClick={exportExcel}
              className="px-2 py-1 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[11px] font-bold transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
              title="Export Official Microsoft Excel (.xlsx) Workbook"
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

            <Link
              href="/dashboard/pos"
              className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 text-white text-[11px] font-black transition-all shadow-xs hover:shadow-blue-500/25 active:scale-[0.98] flex items-center gap-1 shrink-0"
              title="Launch POS Terminal (New Sale)"
            >
              <FiPlus size={12} className="stroke-[3]" />
              <span>New Sale</span>
            </Link>
          </div>
        </div>
      </div>

      {/* ━━━ 2. EXECUTIVE METRIC HUD CARDS (COMPACT EXACT MATCH) ━━━ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2">
        {/* 1. Total Gross Sales */}
        <div className="bg-white rounded-2xl p-2.5 sm:p-3 border border-slate-200/90 shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Gross Sales</span>
            <div className="w-5 h-5 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
              <FiDollarSign size={11} />
            </div>
          </div>
          <div className="text-base sm:text-lg font-black text-indigo-950 font-mono tracking-tight">
            {fmt(totalRevenue)}
          </div>
          <div className="text-[10px] text-slate-500 font-medium truncate mt-0.5">
            {fmtN(filteredSales.length)} orders
            {totalDiscount > 0 ? ` · Disc -${fmt(totalDiscount)}` : ''}
          </div>
        </div>

        {/* 2. M-Pesa Total */}
        <div className="bg-white rounded-2xl p-2.5 sm:p-3 border border-sky-200/90 bg-gradient-to-br from-sky-50/30 via-white to-white shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-sky-700">M-Pesa Volume</span>
            <div className="w-5 h-5 rounded-lg bg-sky-100 flex items-center justify-center text-sky-700">
              <FiZap size={11} />
            </div>
          </div>
          <div className="text-base sm:text-lg font-black text-sky-700 font-mono tracking-tight">
            {fmt(mpesaTotal)}
          </div>
          <div className="text-[10px] text-sky-600 font-medium truncate mt-0.5">
            {fmtN(mpesaRows.length)} txns ({totalRevenue > 0 ? ((mpesaTotal / totalRevenue) * 100).toFixed(1) : 0}%)
          </div>
        </div>

        {/* 3. Cash In Hand */}
        <div className="bg-white rounded-2xl p-2.5 sm:p-3 border border-emerald-200/90 bg-gradient-to-br from-emerald-50/30 via-white to-white shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Cash in Hand</span>
            <div className="w-5 h-5 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700">
              <FiCheckCircle size={11} />
            </div>
          </div>
          <div className="text-base sm:text-lg font-black text-emerald-700 font-mono tracking-tight">
            {fmt(cashTotal)}
          </div>
          <div className="text-[10px] text-emerald-600 font-medium truncate mt-0.5">
            {fmtN(cashRows.length)} cash payments
          </div>
        </div>

        {/* 4. Credit / Accounts */}
        <div className="bg-white rounded-2xl p-2.5 sm:p-3 border border-amber-200/90 bg-gradient-to-br from-amber-50/30 via-white to-white shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Credit Sales</span>
            <div className="w-5 h-5 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700">
              <FiClock size={11} />
            </div>
          </div>
          <div className="text-base sm:text-lg font-black text-amber-800 font-mono tracking-tight">
            {fmt(creditTotal)}
          </div>
          <div className="text-[10px] text-amber-600 font-medium truncate mt-0.5">
            {fmtN(creditRows.length)} invoices unsettled
          </div>
        </div>

        {/* 5. Average Order Value (AOV) */}
        <div className="bg-white rounded-2xl p-2.5 sm:p-3 border border-purple-200/90 bg-gradient-to-br from-purple-50/30 via-white to-white shadow-2xs col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700">Avg Ticket (AOV)</span>
            <div className="w-5 h-5 rounded-lg bg-purple-100 flex items-center justify-center text-purple-700">
              <FiTrendingUp size={11} />
            </div>
          </div>
          <div className="text-base sm:text-lg font-black text-purple-800 font-mono tracking-tight">
            {fmt(avgOrder)}
          </div>
          <div className="text-[10px] text-purple-600 font-medium truncate mt-0.5">Per retail transaction</div>
        </div>
      </div>

      {/* ━━━ 3. SLEEK SEARCH, FILTER & DATE COCKPIT ━━━ */}
      <div className="bg-white/95 backdrop-blur-md rounded-2xl p-2.5 sm:p-3 border border-slate-200/90 shadow-2xs space-y-2">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2">
          {/* Search Bar */}
          <div className="relative flex-1 min-w-[200px]">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search receipt, customer, phone, M-Pesa code, cashier... (Ctrl+F)"
              className="w-full pl-8 pr-8 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:border-blue-500 focus:bg-white outline-none transition-all placeholder:text-slate-400"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setPage(1);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <FiX size={12} />
              </button>
            )}
          </div>

          {/* Quick Date Presets */}
          <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200/80 gap-0.5 shrink-0">
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
                      ? 'bg-white text-indigo-700 shadow-2xs font-black'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          {/* Exact Date Range Inputs */}
          <div className="flex items-center gap-1 shrink-0">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
              className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-blue-500 cursor-pointer"
            />
            <span className="text-slate-400 text-xs">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
              className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-blue-500 cursor-pointer"
            />
          </div>

          {/* Payment & Status Selectors */}
          <div className="flex items-center gap-1.5 flex-wrap shrink-0">
            <select
              value={filterPayment}
              onChange={(e) => {
                setFilterPayment(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-blue-500 cursor-pointer"
            >
              {PAY_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m === 'All' ? '💳 All Tender Methods' : `${m}`}
                </option>
              ))}
            </select>

            <select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="All">All Statuses</option>
              <option value="Completed">Completed</option>
              <option value="Credit">Credit</option>
              <option value="Returned">Returned</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="newest">Sort: Newest</option>
              <option value="oldest">Sort: Oldest</option>
              <option value="highest_amount">Sort: Highest Value</option>
            </select>

            {(searchQuery || filterPayment !== 'All' || filterStatus !== 'All') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setFilterPayment('All');
                  setFilterStatus('All');
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

        {/* Quick Filter Status Bar */}
        <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-slate-100 text-slate-500">
          <div className="flex items-center gap-2">
            <span>
              Showing <strong className="font-mono text-slate-800">{filteredSales.length}</strong> sales matching filter
            </span>
            <span className="text-slate-300">•</span>
            <button
              onClick={expandAll}
              className="text-slate-500 hover:text-indigo-600 font-semibold cursor-pointer"
            >
              Expand All
            </button>
            <span className="text-slate-300">·</span>
            <button
              onClick={collapseAll}
              className="text-slate-500 hover:text-slate-800 font-semibold cursor-pointer"
            >
              Collapse All
            </button>
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
      {loading ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200/90 shadow-2xs">
          <FiRefreshCw className="animate-spin text-blue-600 mx-auto mb-2" size={24} />
          <p className="text-xs font-bold text-slate-700">Loading sales records...</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Fetching verified transactions from live register</p>
        </div>
      ) : filteredSales.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200/90 shadow-2xs">
          <FiShoppingBag className="text-slate-300 mx-auto mb-2" size={36} />
          <p className="text-xs font-bold text-slate-700">No sales transactions matched your filter criteria</p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Try adjusting your date range or clearing search keywords
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setFilterPayment('All');
              setFilterStatus('All');
              setDateFrom(toDay());
              setDateTo(toDay());
            }}
            className="mt-3 px-3 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-xs hover:bg-blue-700 transition inline-flex items-center gap-1 cursor-pointer"
          >
            <FiRefreshCw size={12} /> Reset to Today
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[950px]">
              {/* High-Contrast Light Header (Deep Slate, 100% visible) */}
              <thead className="bg-slate-50/90 border-b-2 border-slate-200">
                <tr className="bg-slate-50/90 border-b-2 border-slate-200 text-[10.5px] font-black uppercase text-slate-700 tracking-wider">
                  <th className="py-2.5 px-3 w-8 text-center border-r border-slate-200">#</th>
                  <th className="py-2.5 px-3 whitespace-nowrap border-r border-slate-200">Receipt No</th>
                  <th className="py-2.5 px-3 whitespace-nowrap border-r border-slate-200">Date &amp; Time</th>
                  <th className="py-2.5 px-3 whitespace-nowrap border-r border-slate-200">Customer</th>
                  <th className="py-2.5 px-3 whitespace-nowrap border-r border-slate-200">Staff / Cashier</th>
                  <th className="py-2.5 px-3 text-center whitespace-nowrap border-r border-slate-200">
                    Payment Method
                  </th>
                  <th className="py-2.5 px-3 whitespace-nowrap border-r border-slate-200">M-Pesa Code</th>
                  <th className="py-2.5 px-3 text-right whitespace-nowrap border-r border-slate-200">
                    Total Amount
                  </th>
                  <th className="py-2.5 px-3 text-center whitespace-nowrap border-r border-slate-200">Status</th>
                  <th className="py-2.5 px-3 text-center whitespace-nowrap w-28">Quick Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                {paginatedSales.map((sale, idx) => {
                  const isExpanded = expandedRows.has(sale.sale_id);
                  const isReturned = returnedSales.has(sale.receipt_no);
                  const items = saleItemsCache[sale.sale_id] || [];
                  const isItemsLoading = loadingItems.has(sale.sale_id);

                  return (
                    <React.Fragment key={sale.sale_id}>
                      <tr
                        className={`transition-colors hover:bg-indigo-50/40 ${
                          isExpanded ? 'bg-indigo-50/30' : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'
                        } ${isReturned ? 'bg-rose-50/30' : ''}`}
                      >
                        {/* 1. Expand Toggle */}
                        <td className="py-2 px-3 text-center border-r border-slate-100">
                          <button
                            onClick={() => toggleRow(sale.sale_id)}
                            className="p-1 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-slate-100 transition cursor-pointer"
                            title="Toggle itemized records"
                          >
                            {isExpanded ? <FiChevronUp size={13} /> : <FiChevronDown size={13} />}
                          </button>
                        </td>

                        {/* 2. Receipt No (Copyable) */}
                        <td className="py-2 px-3 whitespace-nowrap border-r border-slate-100 font-mono text-xs">
                          <div className="flex items-center gap-1.5">
                            <span
                              onClick={() => toggleRow(sale.sale_id)}
                              className="font-bold text-indigo-700 hover:underline cursor-pointer"
                            >
                              {sale.receipt_no || '—'}
                            </span>
                            <button
                              onClick={() => copyReceiptNo(sale.receipt_no)}
                              className="text-slate-300 hover:text-slate-600 transition cursor-pointer"
                              title="Copy receipt number"
                            >
                              {copiedReceipt === sale.receipt_no ? (
                                <FiCheck size={11} className="text-emerald-600" />
                              ) : (
                                <FiCopy size={11} />
                              )}
                            </button>
                            {isReturned && (
                              <span className="px-1 py-0.2 rounded text-[8.5px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                RET
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 3. Date & Time */}
                        <td className="py-2 px-3 whitespace-nowrap border-r border-slate-100 text-xs">
                          <div className="font-semibold text-slate-800">{formatDate(sale.sale_date)}</div>
                          <div className="font-mono text-[10.5px] text-slate-400">
                            {formatTime(sale.sale_datetime)}
                          </div>
                        </td>

                        {/* 4. Customer */}
                        <td className="py-2 px-3 whitespace-nowrap border-r border-slate-100">
                          <div className="font-medium text-slate-800 truncate max-w-[150px]">
                            {sale.customer_name || 'Walk-in Customer'}
                          </div>
                          {sale.customer_phone && (
                            <div className="font-mono text-[10.5px] text-slate-400">{sale.customer_phone}</div>
                          )}
                        </td>

                        {/* 5. Sales Person / Cashier */}
                        <td className="py-2 px-3 whitespace-nowrap text-xs font-medium text-slate-700 border-r border-slate-100">
                          <div className="flex items-center gap-1.5 truncate max-w-[140px]">
                            <FiUser size={11} className="text-slate-400 shrink-0" />
                            <span className="truncate">
                              {sale.created_by || sale.cashier_name || sale.served_by || 'Staff'}
                            </span>
                          </div>
                        </td>

                        {/* 6. Payment Method */}
                        <td className="py-2 px-3 whitespace-nowrap text-center border-r border-slate-100">
                          <Bdg txt={sale.payment_method || 'Cash'} color={payColor(sale.payment_method)} />
                        </td>

                        {/* 7. M-Pesa Code */}
                        <td className="py-2 px-3 whitespace-nowrap font-mono text-[11px] text-slate-600 border-r border-slate-100">
                          {sale.mpesa_code ? (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
                              {sale.mpesa_code}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>

                        {/* 8. Total Amount */}
                        <td className="py-2 px-3 whitespace-nowrap text-right font-mono text-xs font-bold text-slate-900 border-r border-slate-100">
                          {fmt(sale.total_amount || 0)}
                        </td>

                        {/* 9. Status */}
                        <td className="py-2 px-3 whitespace-nowrap text-center border-r border-slate-100">
                          {isReturned ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 inline-flex items-center gap-1">
                              <FiRotateCcw size={10} /> Returned
                            </span>
                          ) : sale.status === 'Credit' ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 inline-flex items-center gap-1">
                              <FiClock size={10} /> Credit
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
                              <FiCheckCircle size={10} /> Completed
                            </span>
                          )}
                        </td>

                        {/* 10. Quick Actions & Controls */}
                        <td className="py-2 px-3 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => viewReceipt(sale)}
                              className="p-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-blue-600 hover:border-blue-300 transition shadow-2xs cursor-pointer"
                              title="View Full Receipt Details"
                            >
                              <FiEye size={12} />
                            </button>
                            <button
                              onClick={() => handlePrintReceipt(sale)}
                              className="p-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 hover:text-indigo-600 hover:border-indigo-300 transition shadow-2xs cursor-pointer"
                              title="Thermal Print Receipt"
                            >
                              <FiPrinter size={12} />
                            </button>
                            <button
                              onClick={() => copyReceiptNo(sale.receipt_no)}
                              className="p-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-800 transition shadow-2xs cursor-pointer"
                              title="Copy Receipt Number"
                            >
                              <FiCopy size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expandable Line Items Drawer */}
                      {isExpanded && (
                        <tr className="bg-slate-50/70 border-b border-slate-200">
                          <td colSpan={10} className="p-3 pl-8">
                            <div className="bg-white border border-slate-200 rounded-xl p-2.5 shadow-2xs">
                              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-slate-800">
                                    Line Items for Receipt:{' '}
                                    <code className="text-indigo-600 font-mono">{sale.receipt_no}</code>
                                  </span>
                                  <span className="text-[11px] text-slate-400">
                                    ({items.length} item{items.length !== 1 ? 's' : ''} captured)
                                  </span>
                                </div>
                                <button
                                  onClick={() => handlePrintReceipt(sale)}
                                  className="px-2 py-0.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-700 flex items-center gap-1 transition cursor-pointer"
                                >
                                  <FiPrinter size={11} /> Print Receipt
                                </button>
                              </div>

                              {isItemsLoading ? (
                                <div className="py-4 text-center text-xs text-slate-400 animate-pulse">
                                  Loading itemized line records...
                                </div>
                              ) : items.length === 0 ? (
                                <div className="py-3 text-center text-xs text-slate-400">
                                  No item-level details captured for this transaction.
                                </div>
                              ) : (
                                <div className="overflow-x-auto">
                                  <table className="w-full text-left text-xs">
                                    <thead>
                                      <tr className="text-[10px] font-black uppercase text-slate-400 border-b border-slate-100">
                                        <th className="py-1 px-2">#</th>
                                        <th className="py-1 px-2">Product Name</th>
                                        <th className="py-1 px-2 text-center">Qty</th>
                                        <th className="py-1 px-2 text-right">Unit Price</th>
                                        <th className="py-1 px-2 text-right">Discount</th>
                                        <th className="py-1 px-2 text-right">Subtotal</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                      {items.map((it, idx2) => (
                                        <tr key={it.item_id || idx2} className="hover:bg-slate-50">
                                          <td className="py-1.5 px-2 text-slate-400 text-[10.5px]">{idx2 + 1}</td>
                                          <td className="py-1.5 px-2 font-medium text-slate-800">
                                            {it.product_name}
                                            {it.selling_unit && it.selling_unit !== 'Piece' && (
                                              <span className="ml-1 text-[10px] text-slate-400">
                                                ({it.selling_unit})
                                              </span>
                                            )}
                                          </td>
                                          <td className="py-1.5 px-2 text-center font-mono font-bold text-slate-700">
                                            {it.quantity}
                                          </td>
                                          <td className="py-1.5 px-2 text-right font-mono text-slate-600">
                                            {fmt(it.unit_price || 0)}
                                          </td>
                                          <td className="py-1.5 px-2 text-right font-mono text-xs">
                                            {(it.discount || 0) > 0 ? (
                                              <span className="text-rose-600 font-bold">-{fmt(it.discount)}</span>
                                            ) : (
                                              <span className="text-slate-300">—</span>
                                            )}
                                          </td>
                                          <td className="py-1.5 px-2 text-right font-mono font-bold text-slate-900">
                                            {fmt(it.subtotal || 0)}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                    <tfoot>
                                      <tr className="border-t-2 border-slate-200 bg-slate-50/70 font-bold text-slate-800">
                                        <td colSpan={5} className="py-1.5 px-2 text-right text-xs">
                                          Transaction Total:
                                        </td>
                                        <td className="py-1.5 px-2 text-right font-mono text-xs font-black text-indigo-700">
                                          {fmt(sale.total_amount || 0)}
                                        </td>
                                      </tr>
                                    </tfoot>
                                  </table>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>

              {/* Integrated Grand Total Table Footer */}
              <tfoot className="bg-slate-50/90 border-t-2 border-slate-200 font-bold text-slate-800 text-xs">
                <tr>
                  <td colSpan={3} className="py-2.5 px-3 border-r border-slate-200">
                    <span className="uppercase tracking-wider text-[10.5px] font-black text-slate-800">
                      Grand Total:
                    </span>
                    <span className="font-mono text-slate-900 text-xs font-black ml-1.5">
                      {fmtN(filteredSales.length)} Records
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-500 border-r border-slate-200">Store Register</td>
                  <td className="py-2.5 px-3 text-slate-500 border-r border-slate-200">All Cashiers</td>
                  <td className="py-2.5 px-3 text-center border-r border-slate-200">
                    <span className="text-[10px] font-mono font-bold text-slate-600">{filterPayment}</span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-400 border-r border-slate-200 font-mono">—</td>
                  <td className="py-2.5 px-3 text-right font-mono text-xs font-black text-indigo-950 bg-indigo-50/70 border-r border-slate-200">
                    {fmt(totalRevenue)}
                  </td>
                  <td className="py-2.5 px-3 text-center border-r border-slate-200 text-slate-500 text-[10.5px]">
                    {filterStatus}
                  </td>
                  <td className="py-2.5 px-3 text-center text-[10.5px] text-slate-400">—</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ━━━ 5. FLOATING COMPACT PAGINATION FOOTER (MATCHING PRODUCTS PAGE) ━━━ */}
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
              of <strong className="font-bold text-slate-800 font-mono">{filteredSales.length}</strong> sales
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(1)}
              disabled={page === 1}
              className="p-1 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-blue-600 disabled:opacity-30 transition-all cursor-pointer"
              title="First Page"
            >
              <FiChevronsLeft size={12} />
            </button>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-blue-600 disabled:opacity-30 transition-all cursor-pointer"
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
                      ? 'bg-blue-600 text-white shadow-2xs font-black'
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
              className="p-1 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-blue-600 disabled:opacity-30 transition-all cursor-pointer"
              title="Next Page"
            >
              <FiChevronRight size={12} />
            </button>
            <button
              onClick={() => setPage(totalPages)}
              disabled={page >= totalPages}
              className="p-1 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-blue-600 disabled:opacity-30 transition-all cursor-pointer"
              title="Last Page"
            >
              <FiChevronsRight size={12} />
            </button>
          </div>
        </div>
      </div>

      {/* ━━━ 6. EXECUTIVE RECEIPT MODAL WITH ITEMS ━━━ */}
      {showReceiptModal && selectedSale && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 animate-fadeIn">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto flex flex-col justify-between">
            <div className="p-4 sm:p-5">
              {/* Header */}
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-dashed border-slate-200">
                <div>
                  <h3 className="text-base font-black text-slate-900 tracking-tight">{companyName}</h3>
                  <p className="text-xs text-slate-500 font-medium">Sales Invoice &amp; Customer Receipt</p>
                </div>
                <button
                  onClick={() => setShowReceiptModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  <FiX size={16} />
                </button>
              </div>

              {/* Receipt Metadata */}
              <div className="space-y-1.5 text-xs text-slate-600 mb-3 bg-slate-50/70 p-2.5 rounded-xl border border-slate-100">
                <div className="flex justify-between">
                  <span className="text-slate-500">Invoice No:</span>
                  <span className="font-mono font-bold text-indigo-700">{selectedSale.receipt_no}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Date &amp; Time:</span>
                  <span className="font-medium text-slate-800">
                    {formatDate(selectedSale.sale_date)} {formatTime(selectedSale.sale_datetime)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Customer:</span>
                  <span className="font-medium text-slate-800">
                    {selectedSale.customer_name || 'Walk-in Customer'}
                  </span>
                </div>
                {selectedSale.customer_phone && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Phone:</span>
                    <span className="font-mono text-slate-800">{selectedSale.customer_phone}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-500">Cashier:</span>
                  <span className="font-medium text-slate-800">
                    {selectedSale.created_by || selectedSale.cashier_name || 'Staff'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Payment:</span>
                  <span className="font-bold text-slate-900">{selectedSale.payment_method || 'Cash'}</span>
                </div>
                {selectedSale.mpesa_code && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">M-Pesa Reference:</span>
                    <span className="font-mono font-bold text-emerald-600">{selectedSale.mpesa_code}</span>
                  </div>
                )}
              </div>

              {/* Items Table */}
              <div className="mb-3">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                  Itemized Line Register
                </span>
                {selectedSaleItems.length === 0 ? (
                  <div className="py-3 text-center text-xs text-slate-400 bg-slate-50 rounded-xl">
                    No items captured
                  </div>
                ) : (
                  <div className="rounded-xl border border-slate-200 overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase border-b border-slate-200">
                        <tr>
                          <th className="py-1.5 px-2.5">Item</th>
                          <th className="py-1.5 px-2 text-center">Qty</th>
                          <th className="py-1.5 px-2 text-right">Price</th>
                          <th className="py-1.5 px-2.5 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedSaleItems.map((it, i) => (
                          <tr key={it.item_id || i} className="hover:bg-slate-50/50">
                            <td className="py-1.5 px-2.5 font-medium text-slate-800">
                              {it.product_name}
                              {it.selling_unit && it.selling_unit !== 'Piece' && (
                                <span className="text-[10px] text-slate-400 ml-1">({it.selling_unit})</span>
                              )}
                            </td>
                            <td className="py-1.5 px-2 text-center font-mono font-bold text-slate-700">
                              {it.quantity}
                            </td>
                            <td className="py-1.5 px-2 text-right font-mono text-slate-600">
                              {fmt(it.unit_price || 0)}
                            </td>
                            <td className="py-1.5 px-2.5 text-right font-mono font-bold text-slate-900">
                              {fmt(it.subtotal || 0)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Totals Summary */}
              <div className="pt-2 border-t border-dashed border-slate-200 space-y-1 text-xs">
                {(selectedSale.discount || 0) > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Discount:</span>
                    <span className="font-mono font-bold text-rose-600">
                      -Ksh {(selectedSale.discount || 0).toLocaleString()}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-black text-slate-900 pt-1 border-t border-slate-100">
                  <span>Grand Total:</span>
                  <span className="font-mono text-indigo-700 text-base">{fmt(selectedSale.total_amount || 0)}</span>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-3 bg-slate-50 border-t border-slate-200 rounded-b-2xl flex items-center gap-2">
              <button
                onClick={() => setShowReceiptModal(false)}
                className="flex-1 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={() => handlePrintReceipt(selectedSale)}
                className="flex-1 py-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <FiPrinter size={13} />
                <span>Thermal Print</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
