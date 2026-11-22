'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';
import { useCompanyName } from '@/context/SettingsContext';
import toast, { Toaster } from 'react-hot-toast';
import {
  FiTruck,
  FiPhone,
  FiMail,
  FiMapPin,
  FiUser,
  FiDollarSign,
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiEye,
  FiSearch,
  FiFilter,
  FiDownload,
  FiPrinter,
  FiRefreshCw,
  FiCheckCircle,
  FiXCircle,
  FiClock,
  FiAlertTriangle,
  FiTrendingUp,
  FiLayers,
  FiSliders,
  FiCalendar,
  FiCheck,
  FiX,
  FiChevronLeft,
  FiChevronRight,
  FiChevronsLeft,
  FiChevronsRight,
  FiFileText,
  FiCopy,
  FiExternalLink,
  FiShield,
  FiShoppingBag,
  FiArrowRight,
  FiTrendingDown,
  FiPercent,
} from 'react-icons/fi';

/* ══════════════════════════════════════════════════════════════════════════════
   TYPES & INTERFACES
   ══════════════════════════════════════════════════════════════════════════════ */
interface Supplier {
  supplier_id: number | null;
  supplier_code: string;
  supplier_name: string;
  address: string;
  city: string;
  phone: string;
  phone2: string;
  email: string;
  contact_person: string;
  kra_pin: string;
  opening_balance: number;
  balance_type: 'Credit' | 'Debit';
  current_balance: number;
  payment_terms: string;
  notes: string;
  is_kitchen: boolean;
  active: boolean;
  created_at?: string | null;
  updated_at?: string | null;
  // Computed analytics
  purchases_count?: number;
  purchases_total?: number;
  last_purchase_date?: string | null;
}

interface PurchaseRecord {
  purchase_id: number;
  purchase_no: string;
  purchase_date: string;
  supplier_id?: number | null;
  supplier_name?: string;
  grand_total: number;
  payment_status: string;
  status: string;
}

const defaultFormData: Omit<Supplier, 'supplier_id' | 'purchases_count' | 'purchases_total' | 'last_purchase_date'> = {
  supplier_code: '',
  supplier_name: '',
  address: '',
  city: '',
  phone: '',
  phone2: '',
  email: '',
  contact_person: '',
  kra_pin: '',
  opening_balance: 0,
  balance_type: 'Credit',
  current_balance: 0,
  payment_terms: 'Net 30',
  notes: '',
  is_kitchen: false,
  active: true,
};

const PAYMENT_TERMS_PRESETS = [
  'Cash on Delivery (COD)',
  'Net 7 Days',
  'Net 14 Days',
  'Net 30 Days',
  'Net 60 Days',
  'Advance Payment',
  'Immediate Payment',
  'End of Month (EOM)',
];

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

/* ══════════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════════════════════════ */
export default function SuppliersPage() {
  const [mounted, setMounted] = useState(false);
  const { activeOutlet } = useOutlet();
  const outletId = activeOutlet?.outlet_id || 1;
  const companyName = useCompanyName();

  // Primary Data
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Tabs & Views
  const [activeTab, setActiveTab] = useState<'directory' | 'payables' | 'procurement' | 'analytics'>('directory');

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'All' | 'Active' | 'Inactive'>('All');
  const [filterType, setFilterType] = useState<'All' | 'External' | 'Kitchen'>('All');
  const [filterBalance, setFilterBalance] = useState<'All' | 'HasBalance' | 'Credit' | 'Debit' | 'Zero'>('All');
  const [filterCity, setFilterCity] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'code_asc' | 'name_asc' | 'name_desc' | 'balance_desc' | 'spend_desc' | 'newest'>('code_asc');

  // Pagination
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);

  // Modals & Drawers
  const [showModal, setShowModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [viewingSupplier, setViewingSupplier] = useState<Supplier | null>(null);
  const [formData, setFormData] = useState(defaultFormData);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Supplier | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

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
     LOAD DATA: Suppliers + Purchases Cross-Check
     ───────────────────────────────────────────────────────────────────────── */
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. Fetch all suppliers
      const { data: suppData, error: suppErr } = await supabase
        .from('retail_suppliers')
        .select('*');

      if (suppErr) throw suppErr;

      // 2. Fetch purchases to compute spend metrics per supplier
      let purRows: PurchaseRecord[] = [];
      try {
        const { data: pData } = await supabase
          .from('retail_purchases')
          .select('purchase_id, purchase_no, purchase_date, supplier_id, supplier_name, grand_total, payment_status, status')
          .order('purchase_date', { ascending: false })
          .limit(5000);
        purRows = pData || [];
        setPurchases(purRows);
      } catch {
        /* purchases table optional fallback */
      }

      // Map purchase statistics to suppliers
      const purchasesBySuppId: Record<number, { count: number; total: number; latest: string | null }> = {};
      const purchasesByName: Record<string, { count: number; total: number; latest: string | null }> = {};

      purRows.forEach((p) => {
        const amt = Number(p.grand_total || 0);
        const pDate = p.purchase_date;

        if (p.supplier_id) {
          if (!purchasesBySuppId[p.supplier_id]) {
            purchasesBySuppId[p.supplier_id] = { count: 0, total: 0, latest: null };
          }
          purchasesBySuppId[p.supplier_id].count += 1;
          purchasesBySuppId[p.supplier_id].total += amt;
          if (!purchasesBySuppId[p.supplier_id].latest || (pDate && pDate > purchasesBySuppId[p.supplier_id].latest!)) {
            purchasesBySuppId[p.supplier_id].latest = pDate;
          }
        }

        if (p.supplier_name) {
          const normName = p.supplier_name.trim().toLowerCase();
          if (!purchasesByName[normName]) {
            purchasesByName[normName] = { count: 0, total: 0, latest: null };
          }
          purchasesByName[normName].count += 1;
          purchasesByName[normName].total += amt;
          if (!purchasesByName[normName].latest || (pDate && pDate > purchasesByName[normName].latest!)) {
            purchasesByName[normName].latest = pDate;
          }
        }
      });

      const mergedSuppliers: Supplier[] = (suppData || []).map((s: any) => {
        const sid = s.supplier_id ? Number(s.supplier_id) : null;
        const normName = (s.supplier_name || '').trim().toLowerCase();
        const stat = (sid && purchasesBySuppId[sid]) || purchasesByName[normName] || { count: 0, total: 0, latest: null };

        return {
          ...s,
          supplier_id: sid,
          opening_balance: Number(s.opening_balance || 0),
          current_balance: Number(s.current_balance ?? s.opening_balance ?? 0),
          balance_type: s.balance_type || 'Credit',
          active: s.active !== false,
          is_kitchen: !!s.is_kitchen,
          purchases_count: stat.count,
          purchases_total: stat.total,
          last_purchase_date: stat.latest,
        };
      });

      // Natural sort by supplier_code (SUP-01, SUP-02...)
      mergedSuppliers.sort((a, b) => {
        const numA = parseInt((a.supplier_code || '').replace(/\D/g, ''), 10) || 0;
        const numB = parseInt((b.supplier_code || '').replace(/\D/g, ''), 10) || 0;
        return numA - numB;
      });

      setSuppliers(mergedSuppliers);
    } catch (err: any) {
      console.error('Error loading suppliers:', err);
      toast.error('Failed to load suppliers registry');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /* ─────────────────────────────────────────────────────────────────────────
     AUTONOMOUS CODE GENERATOR
     Parses all existing SUP-XX codes and returns the true highest + 1
     ───────────────────────────────────────────────────────────────────────── */
  const generateNextSupplierCode = useCallback((): string => {
    let maxNum = 0;
    suppliers.forEach((s) => {
      if (s.supplier_code) {
        const match = s.supplier_code.match(/SUP-(\d+)/i);
        if (match) {
          const n = parseInt(match[1], 10);
          if (!isNaN(n) && n > maxNum) maxNum = n;
        }
      }
    });
    return `SUP-${String(maxNum + 1).padStart(2, '0')}`;
  }, [suppliers]);

  /* ─────────────────────────────────────────────────────────────────────────
     MODAL CONTROLS & FORM ACTIONS
     ───────────────────────────────────────────────────────────────────────── */
  const openAddModal = () => {
    setEditingSupplier(null);
    const nextCode = generateNextSupplierCode();
    setFormData({
      ...defaultFormData,
      supplier_code: nextCode,
    });
    setShowModal(true);
  };

  const openEditModal = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setFormData({
      supplier_code: supplier.supplier_code || '',
      supplier_name: supplier.supplier_name || '',
      address: supplier.address || '',
      city: supplier.city || '',
      phone: supplier.phone || '',
      phone2: supplier.phone2 || '',
      email: supplier.email || '',
      contact_person: supplier.contact_person || '',
      kra_pin: supplier.kra_pin || '',
      opening_balance: supplier.opening_balance || 0,
      balance_type: supplier.balance_type || 'Credit',
      current_balance: supplier.current_balance || 0,
      payment_terms: supplier.payment_terms || 'Net 30 Days',
      notes: supplier.notes || '',
      is_kitchen: !!supplier.is_kitchen,
      active: supplier.active !== false,
    });
    setShowModal(true);
  };

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.supplier_name.trim()) {
      toast.error('Supplier name is required!');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        supplier_code: formData.supplier_code.trim() || generateNextSupplierCode(),
        supplier_name: formData.supplier_name.trim(),
        address: formData.address.trim(),
        city: formData.city.trim(),
        phone: formData.phone.trim(),
        phone2: formData.phone2.trim(),
        email: formData.email.trim(),
        contact_person: formData.contact_person.trim(),
        kra_pin: formData.kra_pin.trim().toUpperCase(),
        opening_balance: Number(formData.opening_balance) || 0,
        current_balance: Number(formData.current_balance ?? formData.opening_balance ?? 0),
        balance_type: formData.balance_type,
        payment_terms: formData.payment_terms.trim(),
        notes: formData.notes.trim(),
        is_kitchen: Boolean(formData.is_kitchen),
        active: Boolean(formData.active),
        updated_at: new Date().toISOString(),
      };

      if (editingSupplier) {
        // Robust update: support supplier_id if present, fallback to supplier_code
        let q = supabase.from('retail_suppliers').update(payload);
        if (editingSupplier.supplier_id) {
          q = q.eq('supplier_id', editingSupplier.supplier_id);
        } else {
          q = q.eq('supplier_code', editingSupplier.supplier_code);
        }

        const { error } = await q;
        if (error) throw error;
        toast.success(`Supplier ${payload.supplier_name} updated! ✓`);
      } else {
        // Create new record
        const insertPayload = {
          ...payload,
          created_at: new Date().toISOString(),
        };

        const { error } = await supabase.from('retail_suppliers').insert(insertPayload);
        if (error) throw error;
        toast.success(`Supplier ${payload.supplier_code} registered! ✓`);
      }

      setShowModal(false);
      setEditingSupplier(null);
      await loadData();
    } catch (err: any) {
      console.error('Error saving supplier:', err);
      toast.error(err.message || 'Failed to save supplier');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSupplier = async (supplier: Supplier) => {
    try {
      let q = supabase.from('retail_suppliers').delete();
      if (supplier.supplier_id) {
        q = q.eq('supplier_id', supplier.supplier_id);
      } else {
        q = q.eq('supplier_code', supplier.supplier_code);
      }

      const { error } = await q;
      if (error) throw error;

      toast.success(`Supplier ${supplier.supplier_name} deleted`);
      setDeleteConfirm(null);
      if (viewingSupplier?.supplier_code === supplier.supplier_code) {
        setViewingSupplier(null);
      }
      loadData();
    } catch (err: any) {
      console.error('Error deleting supplier:', err);
      toast.error(err.message || 'Failed to delete supplier');
    }
  };

  const toggleSupplierActive = async (supplier: Supplier) => {
    try {
      const nextActive = !supplier.active;
      let q = supabase
        .from('retail_suppliers')
        .update({ active: nextActive, updated_at: new Date().toISOString() });

      if (supplier.supplier_id) {
        q = q.eq('supplier_id', supplier.supplier_id);
      } else {
        q = q.eq('supplier_code', supplier.supplier_code);
      }

      const { error } = await q;
      if (error) throw error;

      setSuppliers((prev) =>
        prev.map((s) => (s.supplier_code === supplier.supplier_code ? { ...s, active: nextActive } : s))
      );
      toast.success(`${supplier.supplier_name} ${nextActive ? 'activated' : 'deactivated'}`);
    } catch {
      toast.error('Failed to toggle status');
    }
  };

  const copyText = (txt: string, label: string) => {
    if (!txt) return;
    navigator.clipboard.writeText(txt);
    setCopiedCode(txt);
    toast.success(`Copied ${label}: ${txt}`);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  /* ─────────────────────────────────────────────────────────────────────────
     FILTERING & SORTING PIPELINE
     ───────────────────────────────────────────────────────────────────────── */
  const uniqueCities = useMemo(() => {
    const list = suppliers.map((s) => s.city?.trim()).filter(Boolean);
    return Array.from(new Set(list)).sort();
  }, [suppliers]);

  const filteredSuppliers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    let res = suppliers.filter((s) => {
      // Search query across name, code, phone, email, contact person, KRA PIN
      if (q) {
        const hay = [
          s.supplier_name,
          s.supplier_code,
          s.contact_person,
          s.phone,
          s.phone2,
          s.email,
          s.kra_pin,
          s.city,
          s.address,
          s.payment_terms,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }

      // Status Filter
      if (filterStatus === 'Active' && !s.active) return false;
      if (filterStatus === 'Inactive' && s.active) return false;

      // Type Filter
      if (filterType === 'External' && s.is_kitchen) return false;
      if (filterType === 'Kitchen' && !s.is_kitchen) return false;

      // Balance Filter
      if (filterBalance === 'HasBalance' && (s.current_balance || 0) === 0) return false;
      if (filterBalance === 'Credit' && (s.balance_type !== 'Credit' || (s.current_balance || 0) <= 0)) return false;
      if (filterBalance === 'Debit' && (s.balance_type !== 'Debit' || (s.current_balance || 0) <= 0)) return false;
      if (filterBalance === 'Zero' && (s.current_balance || 0) !== 0) return false;

      // City Filter
      if (filterCity !== 'All' && s.city?.trim().toLowerCase() !== filterCity.toLowerCase()) return false;

      return true;
    });

    // Sorting
    res.sort((a, b) => {
      if (sortBy === 'code_asc') {
        const numA = parseInt((a.supplier_code || '').replace(/\D/g, ''), 10) || 0;
        const numB = parseInt((b.supplier_code || '').replace(/\D/g, ''), 10) || 0;
        return numA - numB;
      }
      if (sortBy === 'name_asc') return (a.supplier_name || '').localeCompare(b.supplier_name || '');
      if (sortBy === 'name_desc') return (b.supplier_name || '').localeCompare(a.supplier_name || '');
      if (sortBy === 'balance_desc') {
        const effA = a.balance_type === 'Credit' ? a.current_balance : -a.current_balance;
        const effB = b.balance_type === 'Credit' ? b.current_balance : -b.current_balance;
        return effB - effA;
      }
      if (sortBy === 'spend_desc') return (b.purchases_total || 0) - (a.purchases_total || 0);
      if (sortBy === 'newest') {
        const dateA = safeDate(a.created_at)?.getTime() || 0;
        const dateB = safeDate(b.created_at)?.getTime() || 0;
        return dateB - dateA;
      }
      return 0;
    });

    return res;
  }, [suppliers, searchQuery, filterStatus, filterType, filterBalance, filterCity, sortBy]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredSuppliers.length / perPage));
  const paginatedSuppliers = useMemo(() => {
    return filteredSuppliers.slice((page - 1) * perPage, page * perPage);
  }, [filteredSuppliers, page, perPage]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [searchQuery, filterStatus, filterType, filterBalance, filterCity, sortBy, perPage]);

  /* ─────────────────────────────────────────────────────────────────────────
     EXECUTIVE HUD METRICS
     ───────────────────────────────────────────────────────────────────────── */
  const metrics = useMemo(() => {
    const totalVendors = suppliers.length;
    const activeVendors = suppliers.filter((s) => s.active).length;
    const kitchenVendors = suppliers.filter((s) => s.is_kitchen).length;

    // Total payables (We owe them)
    const totalCreditPayables = suppliers
      .filter((s) => s.balance_type === 'Credit')
      .reduce((sum, s) => sum + (s.current_balance || 0), 0);

    // Total advances (They owe us)
    const totalDebitAdvances = suppliers
      .filter((s) => s.balance_type === 'Debit')
      .reduce((sum, s) => sum + (s.current_balance || 0), 0);

    const netExposure = totalCreditPayables - totalDebitAdvances;

    // Total procurement spend across directory
    const totalProcurementSpend = suppliers.reduce((sum, s) => sum + (s.purchases_total || 0), 0);
    const totalPOs = suppliers.reduce((sum, s) => sum + (s.purchases_count || 0), 0);

    return {
      totalVendors,
      activeVendors,
      kitchenVendors,
      totalCreditPayables,
      totalDebitAdvances,
      netExposure,
      totalProcurementSpend,
      totalPOs,
    };
  }, [suppliers]);

  /* ─────────────────────────────────────────────────────────────────────────
     PURCHASES FOR VIEWING MODAL
     ───────────────────────────────────────────────────────────────────────── */
  const viewingSupplierPurchases = useMemo(() => {
    if (!viewingSupplier) return [];
    return purchases
      .filter((p) => {
        if (viewingSupplier.supplier_id && p.supplier_id === viewingSupplier.supplier_id) return true;
        if (p.supplier_name && p.supplier_name.trim().toLowerCase() === viewingSupplier.supplier_name.trim().toLowerCase()) return true;
        return false;
      })
      .slice(0, 15);
  }, [viewingSupplier, purchases]);

  /* ─────────────────────────────────────────────────────────────────────────
     SUPER ULTRA-PREMIUM EXCEL EXPORT (.XLSX)
     ══════════════════════════════════════════════════════════════════════════ */
  const exportExcel = async () => {
    try {
      const XLSX = (await import('xlsx-js-style')).default || (await import('xlsx-js-style'));
      const wb = XLSX.utils.book_new();

      // 1. Data Matrix (AOA)
      const data: any[][] = [];

      // Row 0: Centered Large Colorful Title Header
      const companyTitle = `${(companyName || 'ALPHA RETAIL').toUpperCase()} — ${(activeOutlet?.outlet_name || 'MAIN OUTLET').toUpperCase()}`;
      data.push([companyTitle]);

      // Row 1: Subtitle
      data.push(['OFFICIAL VENDOR MASTER DIRECTORY & ACCOUNTS PAYABLE LEDGER']);

      // Row 2: Metadata Strip
      const meta = `Generated: ${new Date().toLocaleString('en-KE')}  |  Audited Vendors: ${filteredSuppliers.length}  |  Outstanding Payables: Ksh ${metrics.totalCreditPayables.toLocaleString()}  |  Total Spend: Ksh ${metrics.totalProcurementSpend.toLocaleString()}`;
      data.push([meta]);

      // Row 3: Blank Spacer
      data.push([]);

      // Row 4: Column Headers
      const headers = [
        '#',
        'CODE',
        'SUPPLIER NAME',
        'CONTACT PERSON',
        'PHONE',
        'EMAIL',
        'LOCATION / CITY',
        'KRA PIN',
        'PAYMENT TERMS',
        'CATEGORY',
        'TOTAL POs',
        'TOTAL SPEND (KSH)',
        'BALANCE TYPE',
        'CURRENT BALANCE (KSH)',
        'STATUS',
      ];
      data.push(headers);

      // Rows 5..5+N-1: Data Rows
      filteredSuppliers.forEach((s, idx) => {
        data.push([
          idx + 1,
          s.supplier_code || '',
          s.supplier_name || '',
          s.contact_person || '—',
          s.phone || s.phone2 || '—',
          s.email || '—',
          [s.city, s.address].filter(Boolean).join(', ') || '—',
          s.kra_pin || '—',
          s.payment_terms || 'Net 30',
          s.is_kitchen ? 'Kitchen (Internal)' : 'External Vendor',
          s.purchases_count || 0,
          Number(s.purchases_total || 0),
          s.balance_type || 'Credit',
          Number(s.current_balance || 0),
          s.active ? 'Active' : 'Inactive',
        ]);
      });

      // Spacer
      data.push([]);

      // Grand Total Row
      const totalFilteredSpend = filteredSuppliers.reduce((sum, s) => sum + (s.purchases_total || 0), 0);
      const totalFilteredBalance = filteredSuppliers.reduce((sum, s) => sum + (s.current_balance || 0), 0);
      const totalFilteredPOs = filteredSuppliers.reduce((sum, s) => sum + (s.purchases_count || 0), 0);

      data.push([
        'GRAND TOTAL REGISTER',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        `${filteredSuppliers.length} Vendors`,
        totalFilteredPOs,
        totalFilteredSpend,
        'NET BALANCE',
        totalFilteredBalance,
        'AUDITED',
      ]);

      const ws = XLSX.utils.aoa_to_sheet(data);

      // Merges
      ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 14 } }, // Title
        { s: { r: 1, c: 0 }, e: { r: 1, c: 14 } }, // Subtitle
        { s: { r: 2, c: 0 }, e: { r: 2, c: 14 } }, // Metadata
        { s: { r: data.length - 1, c: 0 }, e: { r: data.length - 1, c: 8 } }, // Grand Total Label
      ];

      // Row Heights
      const rowsConfig: any[] = [
        { hpt: 38 }, // Row 0: Business Title
        { hpt: 24 }, // Row 1: Subtitle
        { hpt: 20 }, // Row 2: Metadata Strip
        { hpt: 12 }, // Row 3: Spacer
        { hpt: 26 }, // Row 4: Column Headers
      ];
      for (let i = 0; i < filteredSuppliers.length; i++) {
        rowsConfig.push({ hpt: 20 });
      }
      rowsConfig.push({ hpt: 12 }); // Spacer
      rowsConfig.push({ hpt: 28 }); // Grand Total
      ws['!rows'] = rowsConfig;

      // Auto-fitting Column Widths
      ws['!cols'] = [
        { wch: 6 },  // #
        { wch: 14 }, // Code
        { wch: 32 }, // Supplier Name
        { wch: 20 }, // Contact Person
        { wch: 18 }, // Phone
        { wch: 24 }, // Email
        { wch: 24 }, // Location / City
        { wch: 16 }, // KRA PIN
        { wch: 18 }, // Payment Terms
        { wch: 18 }, // Category
        { wch: 12 }, // Total POs
        { wch: 22 }, // Total Spend (Ksh)
        { wch: 16 }, // Balance Type
        { wch: 24 }, // Current Balance (Ksh)
        { wch: 12 }, // Status
      ];

      // Cell Styling
      if (ws['A1']) {
        ws['A1'].s = {
          font: { name: 'Calibri', sz: 16, bold: true, color: { rgb: 'FFFFFF' } },
          fill: { fgColor: { rgb: '091D3E' } }, // Deep Navy
          alignment: { horizontal: 'center', vertical: 'center' },
        };
      }
      if (ws['A2']) {
        ws['A2'].s = {
          font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
          fill: { fgColor: { rgb: '1E40AF' } }, // Royal Blue
          alignment: { horizontal: 'center', vertical: 'center' },
        };
      }
      if (ws['A3']) {
        ws['A3'].s = {
          font: { name: 'Calibri', sz: 9.5, bold: true, color: { rgb: '1E293B' } },
          fill: { fgColor: { rgb: 'E2E8F0' } }, // Slate 200
          alignment: { horizontal: 'center', vertical: 'center' },
        };
      }

      // Headers row (Row index 4)
      const headerCols = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O'];
      headerCols.forEach((col) => {
        const ref = `${col}5`;
        if (ws[ref]) {
          ws[ref].s = {
            font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: 'FFFFFF' } },
            fill: { fgColor: { rgb: '0F172A' } }, // Slate 900
            alignment: { horizontal: 'center', vertical: 'center' },
            border: {
              top: { style: 'thin', color: { rgb: '475569' } },
              bottom: { style: 'medium', color: { rgb: '00E676' } },
            },
          };
        }
      });

      // Grand Total Row
      const grandRowIdx = data.length;
      headerCols.forEach((col) => {
        const ref = `${col}${grandRowIdx}`;
        if (ws[ref]) {
          ws[ref].s = {
            font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
            fill: { fgColor: { rgb: '091D3E' } },
            alignment: { horizontal: ['L', 'N'].includes(col) ? 'right' : 'center', vertical: 'center' },
          };
        }
      });

      XLSX.utils.book_append_sheet(wb, ws, 'Vendors Registry');
      XLSX.writeFile(wb, `Suppliers_Register_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success('Super-premium Excel sheet exported! ✓');
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
      'Code',
      'Supplier Name',
      'Contact Person',
      'Phone',
      'Email',
      'City',
      'Address',
      'KRA PIN',
      'Payment Terms',
      'Category',
      'Total POs',
      'Total Spend',
      'Balance Type',
      'Current Balance',
      'Status',
    ];
    const rows = filteredSuppliers.map((s) => [
      `"${s.supplier_code}"`,
      `"${s.supplier_name.replace(/"/g, '""')}"`,
      `"${(s.contact_person || '').replace(/"/g, '""')}"`,
      `"${s.phone || ''}"`,
      `"${s.email || ''}"`,
      `"${(s.city || '').replace(/"/g, '""')}"`,
      `"${(s.address || '').replace(/"/g, '""')}"`,
      `"${s.kra_pin || ''}"`,
      `"${s.payment_terms || ''}"`,
      `"${s.is_kitchen ? 'Kitchen' : 'External'}"`,
      s.purchases_count || 0,
      s.purchases_total || 0,
      `"${s.balance_type}"`,
      s.current_balance || 0,
      `"${s.active ? 'Active' : 'Inactive'}"`,
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `suppliers_ledger_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV ledger downloaded! ✓');
  };

  /* ─────────────────────────────────────────────────────────────────────────
     PRINT REGISTRY (EXECUTIVE PDF STYLED)
     ───────────────────────────────────────────────────────────────────────── */
  const printRegister = () => {
    const printRows = filteredSuppliers
      .map(
        (s, i) => `
        <tr>
          <td style="text-align:center;">${i + 1}</td>
          <td><b>${s.supplier_code}</b></td>
          <td><b>${s.supplier_name}</b><br/><small style="color:#64748b;">${s.contact_person || '—'}</small></td>
          <td>${s.phone || '—'}</td>
          <td>${[s.city, s.address].filter(Boolean).join(', ') || '—'}</td>
          <td>${s.payment_terms || 'Net 30'}</td>
          <td style="text-align:center;">${s.is_kitchen ? 'Kitchen' : 'External'}</td>
          <td style="text-align:right;">${fmtKES(s.purchases_total || 0)}</td>
          <td style="text-align:right; font-weight:bold; color:${s.balance_type === 'Credit' ? '#dc2626' : '#16a34a'};">
            ${fmtKES(s.current_balance || 0)} (${s.balance_type})
          </td>
          <td style="text-align:center;">${s.active ? 'Active' : 'Inactive'}</td>
        </tr>
      `
      )
      .join('');

    const html = `<!DOCTYPE html>
    <html>
      <head>
        <title>Suppliers Register — ${companyName}</title>
        <style>
          @page { size: landscape; margin: 8mm; }
          body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #0f172a; margin: 0; padding: 10px; }
          .header { border-bottom: 2px solid #091D3E; padding-bottom: 8px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: flex-end; }
          .title { font-size: 18px; font-weight: 900; color: #091D3E; text-transform: uppercase; }
          .subtitle { font-size: 10.5px; color: #64748b; margin-top: 2px; }
          .meta { font-size: 10px; text-align: right; color: #475569; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; }
          th { background: #091D3E; color: #ffffff; padding: 6px 8px; font-size: 10px; text-align: left; text-transform: uppercase; }
          td { border-bottom: 1px solid #e2e8f0; padding: 6px 8px; font-size: 10.5px; }
          .totals { margin-top: 14px; padding: 10px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; display: flex; justify-content: space-between; font-weight: bold; font-size: 11px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="title">${companyName || 'ALPHA RETAIL'} — SUPPLIER AUDIT REGISTER</div>
            <div class="subtitle">Official vendor directory, terms, balances and procurement history</div>
          </div>
          <div class="meta">
            <div>Outlet: <b>${activeOutlet?.outlet_name || 'Main Store'}</b></div>
            <div>Printed: <b>${new Date().toLocaleString('en-KE')}</b></div>
            <div>Total Vendors: <b>${filteredSuppliers.length}</b></div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width:30px; text-align:center;">#</th>
              <th>Code</th>
              <th>Supplier Name & Contact</th>
              <th>Phone</th>
              <th>Location</th>
              <th>Terms</th>
              <th style="text-align:center;">Type</th>
              <th style="text-align:right;">Procurement Spend</th>
              <th style="text-align:right;">Current Balance</th>
              <th style="text-align:center;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${printRows}
          </tbody>
        </table>

        <div class="totals">
          <span>Audited Vendors: ${filteredSuppliers.length}</span>
          <span>Total Spend: ${fmtKES(metrics.totalProcurementSpend)}</span>
          <span style="color:#dc2626;">Total Payables (We Owe): ${fmtKES(metrics.totalCreditPayables)}</span>
          <span style="color:#16a34a;">Total Advances (They Owe): ${fmtKES(metrics.totalDebitAdvances)}</span>
          <span>Net Position: ${fmtKES(metrics.netExposure)}</span>
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
          1. COMPACT EXECUTIVE COMMAND HEADER (MATCHING PURCHASES STUDIO)
          ══════════════════════════════════════════════════════════════════ */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-3 sm:p-3.5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          {/* Left: Branding, Outlet Pill & Live Metrics */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#091D3E] via-[#0E2852] to-[#12356B] text-white flex items-center justify-center font-black text-lg shrink-0 shadow-xs border border-emerald-400/30">
              <FiTruck size={20} className="text-[#00E676]" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base font-extrabold text-slate-900 tracking-tight">
                  Suppliers &amp; Vendor Management Studio
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/80">
                  🏪 {activeOutlet?.outlet_name || 'Main Store'} · Outlet #{outletId}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                  {suppliers.length} Registered Vendors
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200/80">
                  Payables: {fmtK(metrics.totalCreditPayables)}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                Real-time vendor procurement tracking · Accounts payable aging · Multi-channel supply chains
              </p>
            </div>
          </div>

          {/* Right: Studio Shortcuts & Direct Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={openAddModal}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-black shadow-xs flex items-center gap-1.5 transition cursor-pointer"
            >
              <FiPlus size={14} />
              <span>Add New Supplier</span>
            </button>

            <Link
              href="/dashboard/purchase"
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-black shadow-xs flex items-center gap-1.5 transition cursor-pointer"
              title="Create new Purchase Order"
            >
              <FiShoppingBag size={13} />
              <span>New Purchase Order</span>
            </Link>

            <button
              onClick={exportExcel}
              className="px-3 py-1.5 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-extrabold flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
              title="Export ultra-premium styled Excel workbook"
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
              onClick={printRegister}
              className="px-2.5 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1 shadow-2xs transition cursor-pointer"
              title="Print Supplier Registry"
            >
              <FiPrinter size={13} />
              <span>Print</span>
            </button>

            <button
              onClick={loadData}
              disabled={isLoading}
              className="p-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-600 text-xs font-bold shadow-2xs transition cursor-pointer"
              title="Refresh Supplier Data"
            >
              <FiRefreshCw size={13} className={isLoading ? 'animate-spin text-emerald-600' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          2. EXECUTIVE 6-METRIC HUD DOCK
          ══════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-2.5">
        {/* Card 1: Total Registered */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-3 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[10.5px] font-bold uppercase tracking-wider">Total Vendors</span>
            <div className="w-6 h-6 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center">
              <FiTruck size={12} />
            </div>
          </div>
          <div>
            <div className="text-lg font-black text-slate-900 leading-tight">
              {fmtN(metrics.totalVendors)}
            </div>
            <div className="text-[10px] text-slate-500 font-semibold mt-0.5">
              {metrics.activeVendors} Active · {metrics.totalVendors - metrics.activeVendors} Inactive
            </div>
          </div>
        </div>

        {/* Card 2: Total Payables (Credit) */}
        <div className="bg-white border border-rose-200/90 rounded-2xl p-3 shadow-xs flex flex-col justify-between bg-gradient-to-b from-rose-50/30 to-white">
          <div className="flex items-center justify-between text-rose-700 mb-1">
            <span className="text-[10.5px] font-bold uppercase tracking-wider">Payables (We Owe)</span>
            <div className="w-6 h-6 rounded-lg bg-rose-100 border border-rose-200 text-rose-700 flex items-center justify-center">
              <FiAlertTriangle size={12} />
            </div>
          </div>
          <div>
            <div className="text-lg font-black text-rose-700 leading-tight">
              {fmtKES(metrics.totalCreditPayables)}
            </div>
            <div className="text-[10px] text-rose-600 font-semibold mt-0.5">
              Outstanding vendor credit
            </div>
          </div>
        </div>

        {/* Card 3: Total Advances (Debit) */}
        <div className="bg-white border border-emerald-200/90 rounded-2xl p-3 shadow-xs flex flex-col justify-between bg-gradient-to-b from-emerald-50/30 to-white">
          <div className="flex items-center justify-between text-emerald-700 mb-1">
            <span className="text-[10.5px] font-bold uppercase tracking-wider">Advances (They Owe)</span>
            <div className="w-6 h-6 rounded-lg bg-emerald-100 border border-emerald-200 text-emerald-700 flex items-center justify-center">
              <FiDollarSign size={12} />
            </div>
          </div>
          <div>
            <div className="text-lg font-black text-emerald-700 leading-tight">
              {fmtKES(metrics.totalDebitAdvances)}
            </div>
            <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">
              Prepaid vendor deposits
            </div>
          </div>
        </div>

        {/* Card 4: Net Position */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-3 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[10.5px] font-bold uppercase tracking-wider">Net Liability</span>
            <div className="w-6 h-6 rounded-lg bg-sky-50 border border-sky-200 text-sky-700 flex items-center justify-center">
              <FiLayers size={12} />
            </div>
          </div>
          <div>
            <div className="text-lg font-black text-slate-900 leading-tight">
              {fmtKES(metrics.netExposure)}
            </div>
            <div className="text-[10px] text-slate-500 font-semibold mt-0.5">
              Net balance exposure
            </div>
          </div>
        </div>

        {/* Card 5: Total Procurement Spend */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-3 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[10.5px] font-bold uppercase tracking-wider">Total Purchases</span>
            <div className="w-6 h-6 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center">
              <FiShoppingBag size={12} />
            </div>
          </div>
          <div>
            <div className="text-lg font-black text-slate-900 leading-tight">
              {fmtK(metrics.totalProcurementSpend)}
            </div>
            <div className="text-[10px] text-slate-500 font-semibold mt-0.5">
              {fmtN(metrics.totalPOs)} Purchase Orders logged
            </div>
          </div>
        </div>

        {/* Card 6: Kitchen / In-House */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-3 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[10.5px] font-bold uppercase tracking-wider">Internal Kitchen</span>
            <div className="w-6 h-6 rounded-lg bg-purple-50 border border-purple-200 text-purple-700 flex items-center justify-center">
              <FiCheckCircle size={12} />
            </div>
          </div>
          <div>
            <div className="text-lg font-black text-purple-700 leading-tight">
              {fmtN(metrics.kitchenVendors)}
            </div>
            <div className="text-[10px] text-slate-500 font-semibold mt-0.5">
              Internal supply divisions
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          3. TABS CONTROLLER (DIRECTORY, PAYABLES, PROCUREMENT, ANALYTICS)
          ══════════════════════════════════════════════════════════════════ */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-1.5 flex-wrap gap-2">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setActiveTab('directory')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'directory'
                ? 'bg-[#091D3E] text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
            }`}
          >
            <FiTruck size={13} />
            <span>Vendor Directory</span>
            <span className="px-1.5 py-0.2 rounded-full text-[9.5px] bg-white/20 text-white ml-0.5 font-bold">
              {filteredSuppliers.length}
            </span>
          </button>

          <button
            onClick={() => {
              setActiveTab('payables');
              setFilterBalance('Credit');
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'payables'
                ? 'bg-[#091D3E] text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
            }`}
          >
            <FiAlertTriangle size={13} className="text-amber-400" />
            <span>Payables Ledger</span>
            <span className="px-1.5 py-0.2 rounded-full text-[9.5px] bg-rose-500 text-white ml-0.5 font-bold">
              {suppliers.filter((s) => s.balance_type === 'Credit' && s.current_balance > 0).length}
            </span>
          </button>

          <button
            onClick={() => {
              setActiveTab('procurement');
              setSortBy('spend_desc');
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'procurement'
                ? 'bg-[#091D3E] text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
            }`}
          >
            <FiShoppingBag size={13} className="text-emerald-400" />
            <span>Procurement Volume</span>
          </button>
        </div>

        <div className="text-[11px] text-slate-500 font-semibold hidden md:block">
          Showing {paginatedSuppliers.length} of {filteredSuppliers.length} vendors
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          4. COMMAND BAR & ADVANCED FILTERS DOCK
          ══════════════════════════════════════════════════════════════════ */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-2.5 sm:p-3 shadow-xs space-y-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2">
          {/* Search Box (Col span 4) */}
          <div className="lg:col-span-4 relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search by vendor, code (SUP-XX), phone, contact, KRA PIN... [Ctrl+F]"
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
              onChange={(e: any) => setFilterStatus(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="All">All Status (Active/Inactive)</option>
              <option value="Active">Active Only</option>
              <option value="Inactive">Inactive Only</option>
            </select>
          </div>

          {/* Vendor Type Filter (Col span 2) */}
          <div className="lg:col-span-2">
            <select
              value={filterType}
              onChange={(e: any) => setFilterType(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="All">All Vendor Types</option>
              <option value="External">External Commercial</option>
              <option value="Kitchen">Internal Kitchen</option>
            </select>
          </div>

          {/* Balance Filter (Col span 2) */}
          <div className="lg:col-span-2">
            <select
              value={filterBalance}
              onChange={(e: any) => setFilterBalance(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="All">All Balance Positions</option>
              <option value="Credit">We Owe Them (Credit Payables)</option>
              <option value="Debit">They Owe Us (Debit Advances)</option>
              <option value="HasBalance">Has Outstanding Balance</option>
              <option value="Zero">Zero / Settled Balance</option>
            </select>
          </div>

          {/* Sort By (Col span 2) */}
          <div className="lg:col-span-2">
            <select
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="code_asc">Sort: Code (SUP-01 → SUP-XX)</option>
              <option value="name_asc">Sort: Name (A → Z)</option>
              <option value="name_desc">Sort: Name (Z → A)</option>
              <option value="balance_desc">Sort: Balance (Highest First)</option>
              <option value="spend_desc">Sort: Spend (Highest Procurement)</option>
              <option value="newest">Sort: Newest Registered</option>
            </select>
          </div>
        </div>

        {/* Quick Filter Tag Bar */}
        {(searchQuery || filterStatus !== 'All' || filterType !== 'All' || filterBalance !== 'All' || filterCity !== 'All') && (
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
            {filterType !== 'All' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 font-semibold border border-purple-200">
                Type: {filterType}
                <FiX className="cursor-pointer" size={10} onClick={() => setFilterType('All')} />
              </span>
            )}
            {filterBalance !== 'All' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 font-semibold border border-rose-200">
                Balance: {filterBalance}
                <FiX className="cursor-pointer" size={10} onClick={() => setFilterBalance('All')} />
              </span>
            )}
            <button
              onClick={() => {
                setSearchQuery('');
                setFilterStatus('All');
                setFilterType('All');
                setFilterBalance('All');
                setFilterCity('All');
              }}
              className="text-emerald-600 hover:text-emerald-700 font-bold ml-1 cursor-pointer"
            >
              Reset all
            </button>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          5. DATAGRID (ULTRA-PREMIUM VENDOR REGISTER TABLE)
          ══════════════════════════════════════════════════════════════════ */}
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-gradient-to-r from-[#091D3E] via-[#0E2852] to-[#12356B] text-white border-b border-emerald-500/20">
                <th className="py-2.5 px-3 font-extrabold uppercase tracking-wider text-[10.5px] w-12 text-center">#</th>
                <th className="py-2.5 px-3 font-extrabold uppercase tracking-wider text-[10.5px]">Vendor Code</th>
                <th className="py-2.5 px-3 font-extrabold uppercase tracking-wider text-[10.5px]">Supplier Name &amp; Contact</th>
                <th className="py-2.5 px-3 font-extrabold uppercase tracking-wider text-[10.5px]">Communication</th>
                <th className="py-2.5 px-3 font-extrabold uppercase tracking-wider text-[10.5px]">Location</th>
                <th className="py-2.5 px-3 font-extrabold uppercase tracking-wider text-[10.5px]">Terms &amp; Type</th>
                <th className="py-2.5 px-3 font-extrabold uppercase tracking-wider text-[10.5px] text-right">Procurement Spend</th>
                <th className="py-2.5 px-3 font-extrabold uppercase tracking-wider text-[10.5px] text-right">Current Balance</th>
                <th className="py-2.5 px-3 font-extrabold uppercase tracking-wider text-[10.5px] text-center">Status</th>
                <th className="py-2.5 px-3 font-extrabold uppercase tracking-wider text-[10.5px] text-center w-36">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="py-14 text-center">
                    <div className="flex flex-col items-center justify-center gap-2.5 text-slate-400">
                      <FiRefreshCw size={26} className="animate-spin text-emerald-600" />
                      <span className="text-xs font-semibold text-slate-500">Loading vendor ledger &amp; balances...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedSuppliers.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-14 text-center">
                    <div className="flex flex-col items-center justify-center gap-2 text-slate-400">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 text-xl">
                        🏢
                      </div>
                      <p className="text-sm font-bold text-slate-700">No matching suppliers found</p>
                      <p className="text-xs text-slate-400 max-w-sm">
                        Try clearing filters or search query, or add a new supplier using the button above.
                      </p>
                      <button
                        onClick={openAddModal}
                        className="mt-2 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                      >
                        <FiPlus size={13} />
                        Add First Supplier
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedSuppliers.map((supplier, idx) => {
                  const globalIdx = (page - 1) * perPage + idx + 1;
                  const isCredit = supplier.balance_type === 'Credit';
                  const bal = supplier.current_balance || 0;

                  return (
                    <tr
                      key={supplier.supplier_id ? `id-${supplier.supplier_id}` : `code-${supplier.supplier_code}`}
                      className="hover:bg-slate-50/80 transition-colors group"
                    >
                      {/* 1. Index */}
                      <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px] font-semibold">
                        {globalIdx}
                      </td>

                      {/* 2. Code */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <button
                          onClick={() => copyText(supplier.supplier_code, 'Supplier Code')}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#091D3E]/5 hover:bg-[#091D3E]/10 text-[#091D3E] font-mono text-[11px] font-extrabold border border-[#091D3E]/15 cursor-pointer transition"
                          title="Click to copy code"
                        >
                          <span>{supplier.supplier_code}</span>
                          <FiCopy size={10} className="text-slate-400" />
                        </button>
                      </td>

                      {/* 3. Name & Contact Person */}
                      <td className="py-2.5 px-3">
                        <div className="flex flex-col">
                          <button
                            onClick={() => setViewingSupplier(supplier)}
                            className="font-extrabold text-slate-900 hover:text-emerald-600 text-left text-xs transition tracking-tight flex items-center gap-1.5 group-hover:translate-x-0.5 duration-150"
                          >
                            <span>{supplier.supplier_name}</span>
                          </button>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            {supplier.contact_person && (
                              <span className="text-[10.5px] text-slate-500 font-semibold flex items-center gap-1">
                                <FiUser size={10} className="text-slate-400" />
                                {supplier.contact_person}
                              </span>
                            )}
                            {supplier.kra_pin && (
                              <span className="px-1.5 py-0.2 rounded text-[9.5px] font-mono font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                PIN: {supplier.kra_pin}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 4. Phone & Email */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="flex flex-col text-[11px]">
                          {supplier.phone ? (
                            <a
                              href={`tel:${supplier.phone}`}
                              className="font-semibold text-slate-700 hover:text-emerald-600 flex items-center gap-1"
                            >
                              <FiPhone size={10} className="text-emerald-500" />
                              <span>{supplier.phone}</span>
                            </a>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                          {supplier.email && (
                            <a
                              href={`mailto:${supplier.email}`}
                              className="text-[10px] text-slate-500 hover:text-sky-600 flex items-center gap-1 mt-0.5 truncate max-w-[150px]"
                              title={supplier.email}
                            >
                              <FiMail size={10} className="text-sky-500" />
                              <span>{supplier.email}</span>
                            </a>
                          )}
                        </div>
                      </td>

                      {/* 5. Location */}
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1 text-[11px] text-slate-600">
                          <FiMapPin size={11} className="text-slate-400 shrink-0" />
                          <span className="truncate max-w-[140px]" title={[supplier.city, supplier.address].filter(Boolean).join(', ')}>
                            {supplier.city || supplier.address || '—'}
                          </span>
                        </div>
                      </td>

                      {/* 6. Terms & Type */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="flex flex-col gap-1">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200 w-fit">
                            {supplier.payment_terms || 'Net 30 Days'}
                          </span>
                          {supplier.is_kitchen ? (
                            <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-purple-50 text-purple-700 border border-purple-200 w-fit">
                              🍳 Kitchen Division
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-blue-50 text-blue-700 border border-blue-200 w-fit">
                              🏢 External Vendor
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 7. Procurement Spend */}
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <div className="font-extrabold text-slate-900 font-mono text-xs">
                          {fmtKES(supplier.purchases_total || 0)}
                        </div>
                        <div className="text-[10px] text-slate-400 font-medium">
                          {supplier.purchases_count || 0} Purchase Orders
                        </div>
                      </td>

                      {/* 8. Current Balance */}
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <div
                          className={`font-mono text-xs font-black ${
                            bal === 0
                              ? 'text-slate-600'
                              : isCredit
                              ? 'text-rose-700'
                              : 'text-emerald-700'
                          }`}
                        >
                          {fmtKES(bal)}
                        </div>
                        <div className="mt-0.5">
                          {bal === 0 ? (
                            <span className="inline-block px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                              Settled (0.00)
                            </span>
                          ) : isCredit ? (
                            <span className="inline-block px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              We Owe (Credit)
                            </span>
                          ) : (
                            <span className="inline-block px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              They Owe (Advance)
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 9. Status */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <button
                          onClick={() => toggleSupplierActive(supplier)}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border transition cursor-pointer ${
                            supplier.active
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                              : 'bg-slate-100 text-slate-500 border-slate-300 hover:bg-slate-200'
                          }`}
                          title="Click to toggle active status"
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${supplier.active ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                          {supplier.active ? 'Active' : 'Inactive'}
                        </button>
                      </td>

                      {/* 10. Actions */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          {/* View Dossier */}
                          <button
                            onClick={() => setViewingSupplier(supplier)}
                            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 transition"
                            title="View Supplier Dossier"
                          >
                            <FiEye size={12} />
                          </button>

                          {/* Edit */}
                          <button
                            onClick={() => openEditModal(supplier)}
                            className="p-1.5 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 transition"
                            title="Edit Supplier"
                          >
                            <FiEdit2 size={12} />
                          </button>

                          {/* New PO shortcut */}
                          <Link
                            href={`/dashboard/purchase?supplier=${encodeURIComponent(supplier.supplier_code)}`}
                            className="p-1.5 rounded-lg border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-700 transition"
                            title="Create Purchase Order for this vendor"
                          >
                            <FiShoppingBag size={12} />
                          </Link>

                          {/* Delete */}
                          <button
                            onClick={() => setDeleteConfirm(supplier)}
                            className="p-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 transition"
                            title="Delete Supplier"
                          >
                            <FiTrash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            PAGINATION DOCK
            ══════════════════════════════════════════════════════════════════ */}
        <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600 font-semibold">
          <div className="flex items-center gap-2">
            <span>Rows per page:</span>
            <select
              value={perPage}
              onChange={(e) => setPerPage(Number(e.target.value))}
              className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none cursor-pointer"
            >
              {[10, 20, 50, 100].map((sz) => (
                <option key={sz} value={sz}>
                  {sz} rows
                </option>
              ))}
            </select>
            <span className="text-slate-400">|</span>
            <span>
              Showing {filteredSuppliers.length === 0 ? 0 : (page - 1) * perPage + 1} to{' '}
              {Math.min(page * perPage, filteredSuppliers.length)} of {filteredSuppliers.length} vendors
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(1)}
              disabled={page <= 1}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 disabled:opacity-30 disabled:pointer-events-none"
              title="First Page"
            >
              <FiChevronsLeft size={13} />
            </button>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 disabled:opacity-30 disabled:pointer-events-none"
              title="Previous Page"
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
              title="Next Page"
            >
              <FiChevronRight size={13} />
            </button>
            <button
              onClick={() => setPage(totalPages)}
              disabled={page >= totalPages}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 disabled:opacity-30 disabled:pointer-events-none"
              title="Last Page"
            >
              <FiChevronsRight size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          6. ADD / EDIT SUPPLIER MODAL (ULTRA-CLEAN 2-COLUMN DOSSIER)
          ══════════════════════════════════════════════════════════════════ */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto border border-slate-200 flex flex-col animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-[#091D3E] via-[#0E2852] to-[#12356B] px-5 py-4 text-white sticky top-0 z-10 flex items-center justify-between border-b border-emerald-500/20">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-emerald-400 font-black border border-white/15">
                  <FiTruck size={18} />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-extrabold tracking-tight">
                    {editingSupplier ? 'Edit Vendor Dossier' : 'Register New Supplier'}
                  </h2>
                  <p className="text-[11px] text-slate-300 font-medium">
                    {editingSupplier
                      ? `Updating records for ${editingSupplier.supplier_code}`
                      : `Assigning code ${formData.supplier_code || 'SUP-XX'}`}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
              >
                <FiX size={16} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveSupplier} className="p-5 space-y-4">
              {/* SECTION 1: Company Profile */}
              <div>
                <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  Company &amp; Identification
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Supplier / Business Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g., NAIROBI STORES LTD"
                      value={formData.supplier_name}
                      onChange={(e) => setFormData({ ...formData, supplier_name: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-emerald-500 outline-none transition"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Supplier Code</label>
                    <input
                      type="text"
                      value={formData.supplier_code}
                      onChange={(e) => setFormData({ ...formData, supplier_code: e.target.value.toUpperCase() })}
                      placeholder="SUP-XX"
                      className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 focus:bg-white focus:border-emerald-500 outline-none transition"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Contact Person</label>
                    <input
                      type="text"
                      placeholder="e.g., Jane Doe"
                      value={formData.contact_person}
                      onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-emerald-500 outline-none transition"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">KRA PIN / Tax ID</label>
                    <input
                      type="text"
                      placeholder="e.g., P051234567X"
                      value={formData.kra_pin}
                      onChange={(e) => setFormData({ ...formData, kra_pin: e.target.value.toUpperCase() })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 focus:bg-white focus:border-emerald-500 outline-none transition"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">City / Region</label>
                    <input
                      type="text"
                      placeholder="e.g., Nairobi, Bomet"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-emerald-500 outline-none transition"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 2: Communication & Location */}
              <div className="pt-2 border-t border-slate-100">
                <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-sky-500"></span>
                  Communication &amp; Logistics
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Primary Phone</label>
                    <input
                      type="tel"
                      placeholder="e.g., 0720123456"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-emerald-500 outline-none transition"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Alternative Phone</label>
                    <input
                      type="tel"
                      placeholder="Secondary contact"
                      value={formData.phone2}
                      onChange={(e) => setFormData({ ...formData, phone2: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-emerald-500 outline-none transition"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Email Address</label>
                    <input
                      type="email"
                      placeholder="supplier@company.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-emerald-500 outline-none transition"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Street Address</label>
                    <input
                      type="text"
                      placeholder="Physical depot / warehouse address"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-emerald-500 outline-none transition"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 3: Financial & Balances */}
              <div className="pt-2 border-t border-slate-100 bg-slate-50/70 p-3.5 rounded-2xl border border-slate-200/80">
                <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  Financial Position &amp; Payment Terms
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Opening Balance (Ksh)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.opening_balance}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setFormData({
                          ...formData,
                          opening_balance: val,
                          current_balance: editingSupplier ? formData.current_balance : val,
                        });
                      }}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 focus:border-emerald-500 outline-none transition"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Balance Type</label>
                    <select
                      value={formData.balance_type}
                      onChange={(e: any) => setFormData({ ...formData, balance_type: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:border-emerald-500 outline-none cursor-pointer"
                    >
                      <option value="Credit">Credit (We Owe Them)</option>
                      <option value="Debit">Debit (They Owe Us)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Payment Terms</label>
                    <input
                      type="text"
                      list="terms-list"
                      placeholder="e.g., Net 30 Days"
                      value={formData.payment_terms}
                      onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:border-emerald-500 outline-none"
                    />
                    <datalist id="terms-list">
                      {PAYMENT_TERMS_PRESETS.map((t) => (
                        <option key={t} value={t} />
                      ))}
                    </datalist>
                  </div>
                </div>
              </div>

              {/* SECTION 4: Classification & Notes */}
              <div className="pt-2 border-t border-slate-100">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                  <div className="flex items-center gap-5 pt-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.is_kitchen}
                        onChange={(e) => setFormData({ ...formData, is_kitchen: e.target.checked })}
                        className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500"
                      />
                      <span className="text-xs font-bold text-slate-700">Internal Kitchen Division</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.active}
                        onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                        className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="text-xs font-bold text-slate-700">Active Vendor</span>
                    </label>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Operational Notes</label>
                    <textarea
                      rows={2}
                      placeholder="Credit limits, delivery schedules, bank details..."
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-emerald-500 outline-none resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-extrabold shadow-sm transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <FiRefreshCw size={12} className="animate-spin" />
                      <span>Saving Vendor...</span>
                    </>
                  ) : (
                    <>
                      <FiCheck size={14} />
                      <span>{editingSupplier ? 'Update Vendor Dossier' : 'Save & Register Vendor'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          7. VIEW SUPPLIER DOSSIER & PURCHASES DRAWER / MODAL
          ══════════════════════════════════════════════════════════════════ */}
      {viewingSupplier && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto border border-slate-200 flex flex-col animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="bg-gradient-to-r from-[#091D3E] via-[#0E2852] to-[#12356B] px-6 py-4 text-white sticky top-0 z-10 flex items-center justify-between border-b border-emerald-500/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-emerald-400 font-black border border-white/15">
                  <FiTruck size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-extrabold tracking-tight">{viewingSupplier.supplier_name}</h2>
                    <span className="px-2 py-0.5 rounded-md font-mono text-[10.5px] font-bold bg-white/15 text-white border border-white/20">
                      {viewingSupplier.supplier_code}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        viewingSupplier.active ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-500/30 text-slate-300'
                      }`}
                    >
                      {viewingSupplier.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 font-medium mt-0.5">
                    {viewingSupplier.is_kitchen ? 'Internal Kitchen Production Division' : 'Commercial External Supplier'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setViewingSupplier(null)}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
              >
                <FiX size={16} />
              </button>
            </div>

            {/* Content Dossier */}
            <div className="p-5 space-y-4">
              {/* Quick Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Current Balance</span>
                  <div
                    className={`text-base font-black font-mono mt-0.5 ${
                      viewingSupplier.current_balance === 0
                        ? 'text-slate-800'
                        : viewingSupplier.balance_type === 'Credit'
                        ? 'text-rose-700'
                        : 'text-emerald-700'
                    }`}
                  >
                    {fmtKES(viewingSupplier.current_balance)}
                  </div>
                  <span className="text-[9.5px] font-bold text-slate-500">{viewingSupplier.balance_type}</span>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Spend</span>
                  <div className="text-base font-black font-mono text-slate-900 mt-0.5">
                    {fmtKES(viewingSupplier.purchases_total || 0)}
                  </div>
                  <span className="text-[9.5px] font-bold text-slate-500">{viewingSupplier.purchases_count || 0} Invoices</span>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Payment Terms</span>
                  <div className="text-xs font-bold text-slate-800 mt-1 truncate">
                    {viewingSupplier.payment_terms || 'Net 30 Days'}
                  </div>
                  <span className="text-[9.5px] font-bold text-slate-400">Commercial Term</span>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Last Purchase</span>
                  <div className="text-xs font-bold text-slate-800 mt-1">
                    {formatDate(viewingSupplier.last_purchase_date)}
                  </div>
                  <span className="text-[9.5px] font-bold text-slate-400">Recent PO</span>
                </div>
              </div>

              {/* Contact & Legal Dossier Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 rounded-2xl border border-slate-200 bg-white space-y-2">
                  <h4 className="font-extrabold text-slate-900 uppercase tracking-wider text-[11px] border-b border-slate-100 pb-1">
                    Contact &amp; Personnel
                  </h4>
                  <div className="space-y-1.5 text-slate-600">
                    <div>
                      <span className="text-slate-400 font-semibold block text-[10.5px]">Contact Person:</span>
                      <span className="font-bold text-slate-800">{viewingSupplier.contact_person || 'Not specified'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-semibold block text-[10.5px]">Primary Phone:</span>
                      {viewingSupplier.phone ? (
                        <a href={`tel:${viewingSupplier.phone}`} className="font-bold text-emerald-700 hover:underline">
                          {viewingSupplier.phone}
                        </a>
                      ) : (
                        '—'
                      )}
                    </div>
                    {viewingSupplier.phone2 && (
                      <div>
                        <span className="text-slate-400 font-semibold block text-[10.5px]">Alternative Phone:</span>
                        <span className="font-semibold text-slate-800">{viewingSupplier.phone2}</span>
                      </div>
                    )}
                    <div>
                      <span className="text-slate-400 font-semibold block text-[10.5px]">Email:</span>
                      {viewingSupplier.email ? (
                        <a href={`mailto:${viewingSupplier.email}`} className="font-bold text-sky-700 hover:underline">
                          {viewingSupplier.email}
                        </a>
                      ) : (
                        '—'
                      )}
                    </div>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl border border-slate-200 bg-white space-y-2">
                  <h4 className="font-extrabold text-slate-900 uppercase tracking-wider text-[11px] border-b border-slate-100 pb-1">
                    Tax &amp; Location
                  </h4>
                  <div className="space-y-1.5 text-slate-600">
                    <div>
                      <span className="text-slate-400 font-semibold block text-[10.5px]">KRA Tax PIN:</span>
                      <span className="font-mono font-bold text-slate-800">{viewingSupplier.kra_pin || 'Not registered'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-semibold block text-[10.5px]">City / Region:</span>
                      <span className="font-bold text-slate-800">{viewingSupplier.city || '—'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-semibold block text-[10.5px]">Physical Address:</span>
                      <span className="font-medium text-slate-800">{viewingSupplier.address || '—'}</span>
                    </div>
                    {viewingSupplier.notes && (
                      <div>
                        <span className="text-slate-400 font-semibold block text-[10.5px]">Notes:</span>
                        <span className="text-slate-600 italic">{viewingSupplier.notes}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Purchase History Ledger */}
              <div className="pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-extrabold text-slate-900 uppercase tracking-wider text-[11px]">
                    Recent Purchase Orders ({viewingSupplierPurchases.length})
                  </h4>
                  <Link
                    href={`/dashboard/purchase?supplier=${encodeURIComponent(viewingSupplier.supplier_code)}`}
                    className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                  >
                    <span>+ New PO for this vendor</span>
                    <FiArrowRight size={11} />
                  </Link>
                </div>

                {viewingSupplierPurchases.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
                    No purchase orders recorded yet for this supplier.
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-600 font-extrabold uppercase text-[10px]">
                        <tr>
                          <th className="py-2 px-3">PO #</th>
                          <th className="py-2 px-3">Date</th>
                          <th className="py-2 px-3 text-right">Grand Total</th>
                          <th className="py-2 px-3 text-center">Payment</th>
                          <th className="py-2 px-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {viewingSupplierPurchases.map((p) => (
                          <tr key={p.purchase_id} className="hover:bg-slate-50">
                            <td className="py-2 px-3 font-mono font-bold text-slate-800">{p.purchase_no}</td>
                            <td className="py-2 px-3 text-slate-600">{formatDate(p.purchase_date)}</td>
                            <td className="py-2 px-3 text-right font-mono font-extrabold text-slate-900">
                              {fmtKES(p.grand_total)}
                            </td>
                            <td className="py-2 px-3 text-center">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  p.payment_status === 'Paid'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-amber-50 text-amber-800 border border-amber-200'
                                }`}
                              >
                                {p.payment_status || 'Pending'}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-center text-slate-600">{p.status || 'Completed'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <button
                  onClick={() => {
                    setViewingSupplier(null);
                    openEditModal(viewingSupplier);
                  }}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer"
                >
                  <FiEdit2 size={12} />
                  <span>Edit Dossier</span>
                </button>

                <div className="flex items-center gap-2">
                  <Link
                    href={`/dashboard/purchase?supplier=${encodeURIComponent(viewingSupplier.supplier_code)}`}
                    className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl text-xs font-extrabold shadow-sm flex items-center gap-1.5 cursor-pointer"
                  >
                    <FiShoppingBag size={12} />
                    <span>Create Purchase Order</span>
                  </Link>

                  <button
                    onClick={() => setViewingSupplier(null)}
                    className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-extrabold cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          8. DELETE CONFIRMATION MODAL
          ══════════════════════════════════════════════════════════════════ */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-5 shadow-2xl max-w-md w-full border border-slate-200 space-y-3 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto text-xl font-black">
              <FiTrash2 size={22} />
            </div>
            <div className="text-center">
              <h3 className="text-base font-extrabold text-slate-900">Delete Supplier Record?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Are you sure you want to delete <b className="text-slate-800">{deleteConfirm.supplier_name}</b> (
                {deleteConfirm.supplier_code})?
              </p>
              {deleteConfirm.current_balance !== 0 && (
                <div className="mt-2.5 p-2 rounded-xl bg-rose-50 border border-rose-200 text-[11px] font-bold text-rose-700">
                  ⚠️ Note: This supplier currently carries an outstanding balance of {fmtKES(deleteConfirm.current_balance)} (
                  {deleteConfirm.balance_type}).
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteSupplier(deleteConfirm)}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black shadow-xs cursor-pointer"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
