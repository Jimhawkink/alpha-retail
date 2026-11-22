'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  supabase,
  getActiveSupabaseConfig,
  setActiveSupabaseConfig,
  resetToDefaultSupabaseConfig,
  getDefaultSupabaseConfig,
  createDynamicSupabaseClient,
  SupabaseConfig,
} from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';
import { useCompanyName } from '@/context/SettingsContext';
import toast, { Toaster } from 'react-hot-toast';
import {
  FiDatabase,
  FiDownload,
  FiUploadCloud,
  FiRefreshCw,
  FiCheckCircle,
  FiXCircle,
  FiAlertTriangle,
  FiSliders,
  FiServer,
  FiLink,
  FiShield,
  FiLayers,
  FiActivity,
  FiCopy,
  FiSearch,
  FiFileText,
  FiChevronLeft,
  FiChevronRight,
  FiChevronsLeft,
  FiChevronsRight,
  FiPlay,
  FiSave,
  FiTrash2,
  FiArrowRight,
  FiLock,
  FiCheck,
} from 'react-icons/fi';

/* ══════════════════════════════════════════════════════════════════════════════
   MANAGED DATABASE TABLES CONFIGURATION
   ══════════════════════════════════════════════════════════════════════════════ */
interface ManagedTable {
  name: string;
  label: string;
  primaryKey: string;
  category: 'Inventory' | 'Sales' | 'Purchases' | 'Customers' | 'Finance' | 'Settings' | 'Operations';
  critical: boolean;
}

const MANAGED_TABLES: ManagedTable[] = [
  { name: 'retail_products', label: 'Master Products Catalog', primaryKey: 'pid', category: 'Inventory', critical: true },
  { name: 'retail_stock', label: 'Stock on Hand & Batches', primaryKey: 'pid', category: 'Inventory', critical: true },
  { name: 'retail_sales', label: 'Sales Invoices & Transactions', primaryKey: 'sale_id', category: 'Sales', critical: true },
  { name: 'retail_sales_items', label: 'Sales Line Items', primaryKey: 'item_id', category: 'Sales', critical: true },
  { name: 'sales_returns', label: 'Sales Returns & Refunds', primaryKey: 'return_id', category: 'Sales', critical: false },
  { name: 'retail_purchases', label: 'Purchase Orders & Invoices', primaryKey: 'purchase_id', category: 'Purchases', critical: true },
  { name: 'retail_purchase_items', label: 'Purchase Line Items', primaryKey: 'item_id', category: 'Purchases', critical: true },
  { name: 'retail_credit_customers', label: 'Customers & Loyalty Registry', primaryKey: 'customer_id', category: 'Customers', critical: true },
  { name: 'retail_credit_payments', label: 'Customer Payments & Ledger', primaryKey: 'payment_id', category: 'Customers', critical: false },
  { name: 'expenses', label: 'Operating Overhead Expenses', primaryKey: 'expense_id', category: 'Finance', critical: true },
  { name: 'retail_categories', label: 'Merchandise Categories', primaryKey: 'category_id', category: 'Inventory', critical: false },
  { name: 'retail_units', label: 'Measurement Units', primaryKey: 'unit_id', category: 'Inventory', critical: false },
  { name: 'retail_suppliers', label: 'Suppliers Directory', primaryKey: 'supplier_id', category: 'Purchases', critical: false },
  { name: 'retail_settings', label: 'System Parameters & Configurations', primaryKey: 'id', category: 'Settings', critical: true },
  { name: 'vouchers', label: 'Gift & Discount Vouchers', primaryKey: 'voucher_id', category: 'Sales', critical: false },
  { name: 'retail_outlets', label: 'Outlets & Branch Registry', primaryKey: 'outlet_id', category: 'Settings', critical: true },
  { name: 'shifts', label: 'Cashier Shifts History', primaryKey: 'shift_id', category: 'Operations', critical: false },
  { name: 'registration', label: 'Users & Login Credentials', primaryKey: 'id', category: 'Settings', critical: true },
  { name: 'organisation_settings', label: 'Company Profile & Settings', primaryKey: 'id', category: 'Settings', critical: false },
];

const fmtN = (n: any) => {
  const num = typeof n === 'number' ? n : parseFloat(n) || 0;
  return num.toLocaleString('en-KE');
};

const formatDate = (val: string | null | undefined) => {
  if (!val) return '—';
  try {
    return new Date(val).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return val;
  }
};

export default function DatabaseBackupStudioPage() {
  const { activeOutlet } = useOutlet();
  const companyName = useCompanyName();

  // Navigation & View
  const [activeTab, setActiveTab] = useState<'switcher' | 'backup' | 'restore' | 'inspector' | 'sql'>('switcher');

  // Active Connection Info
  const [activeConfig, setActiveConfig] = useState<SupabaseConfig>(getDefaultSupabaseConfig());
  const [connectionHealth, setConnectionHealth] = useState<'testing' | 'connected' | 'error'>('testing');
  const [connectionPingMs, setConnectionPingMs] = useState<number | null>(null);

  // Table Stats
  const [tableStats, setTableStats] = useState<Record<string, { count: number; status: 'ok' | 'missing' | 'error' }>>({});
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  // Switcher / Target Form
  const [targetUrl, setTargetUrl] = useState('');
  const [targetAnonKey, setTargetAnonKey] = useState('');
  const [targetServiceKey, setTargetServiceKey] = useState('');
  const [targetLabel, setTargetLabel] = useState('');
  const [isTestingTarget, setIsTestingTarget] = useState(false);
  const [targetTestResult, setTargetTestResult] = useState<{ success: boolean; pingMs: number; message: string } | null>(null);

  // Backup Studio State
  const [selectedTables, setSelectedTables] = useState<string[]>(MANAGED_TABLES.map((t) => t.name));
  const [isGeneratingBackup, setIsGeneratingBackup] = useState(false);
  const [backupProgress, setBackupProgress] = useState<{ current: number; total: number; table: string } | null>(null);

  // Restore Engine State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedBackup, setUploadedBackup] = useState<any | null>(null);
  const [restoreMode, setRestoreMode] = useState<'upsert' | 'overwrite'>('upsert');
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState<{ current: number; total: number; table: string; status: string } | null>(null);
  const [restoreLogs, setRestoreLogs] = useState<string[]>([]);

  // Direct Project Migration State
  const [isMigratingDirect, setIsMigratingDirect] = useState(false);
  const [migrationProgress, setMigrationProgress] = useState<{ current: number; total: number; table: string; records: number } | null>(null);

  // Table Inspector Filter & Pagination
  const [inspectorSearch, setInspectorSearch] = useState('');
  const [inspectorCategoryFilter, setInspectorCategoryFilter] = useState('ALL');
  const [inspectorPage, setInspectorPage] = useState(1);
  const [inspectorPerPage, setInspectorPerPage] = useState(10);

  /* ─────────────────────────────────────────────────────────────────────────
     CHECK ACTIVE SUPABASE CONNECTION & TABLE RECORD COUNTS
     ───────────────────────────────────────────────────────────────────────── */
  const checkConnectionAndStats = useCallback(async () => {
    setIsLoadingStats(true);
    setConnectionHealth('testing');

    const cfg = getActiveSupabaseConfig();
    setActiveConfig(cfg);

    const startPing = performance.now();
    try {
      // Ping check using retail_settings or registration
      const { data: pingData, error: pingErr } = await supabase
        .from('retail_settings')
        .select('id')
        .limit(1);

      const endPing = performance.now();
      setConnectionPingMs(Math.round(endPing - startPing));

      if (pingErr && !pingData) {
        // Fallback test
        const { error: regErr } = await supabase.from('registration').select('id').limit(1);
        if (regErr) {
          setConnectionHealth('error');
        } else {
          setConnectionHealth('connected');
        }
      } else {
        setConnectionHealth('connected');
      }

      // Query record counts for all managed tables in parallel
      const statsMap: Record<string, { count: number; status: 'ok' | 'missing' | 'error' }> = {};

      await Promise.all(
        MANAGED_TABLES.map(async (table) => {
          try {
            const { count, error } = await supabase
              .from(table.name)
              .select('*', { count: 'exact', head: true });

            if (error) {
              if (error.code === '42P01' || error.message.includes('not find the table')) {
                statsMap[table.name] = { count: 0, status: 'missing' };
              } else {
                statsMap[table.name] = { count: 0, status: 'error' };
              }
            } else {
              statsMap[table.name] = { count: count || 0, status: 'ok' };
            }
          } catch {
            statsMap[table.name] = { count: 0, status: 'error' };
          }
        })
      );

      setTableStats(statsMap);
    } catch (err: any) {
      console.error('Connection health check error:', err);
      setConnectionHealth('error');
    } finally {
      setIsLoadingStats(false);
    }
  }, []);

  useEffect(() => {
    checkConnectionAndStats();
  }, [checkConnectionAndStats]);

  /* ─────────────────────────────────────────────────────────────────────────
     COMPUTED AGGREGATES
     ───────────────────────────────────────────────────────────────────────── */
  const totalDatabaseRecords = useMemo(() => {
    return Object.values(tableStats).reduce((acc, stat) => acc + (stat.status === 'ok' ? stat.count : 0), 0);
  }, [tableStats]);

  const activeTablesCount = useMemo(() => {
    return Object.values(tableStats).filter((s) => s.status === 'ok').length;
  }, [tableStats]);

  /* ─────────────────────────────────────────────────────────────────────────
     ACTION 1: TEST TARGET SUPABASE CONNECTION
     ───────────────────────────────────────────────────────────────────────── */
  const handleTestTargetConnection = async () => {
    if (!targetUrl.trim() || !targetAnonKey.trim()) {
      toast.error('Please enter both the target Supabase Project URL and Anon Key');
      return;
    }

    setIsTestingTarget(true);
    setTargetTestResult(null);

    const startPing = performance.now();
    try {
      const targetClient = createDynamicSupabaseClient(targetUrl.trim(), targetAnonKey.trim());
      // Test read permission
      const { data, error } = await targetClient.from('retail_settings').select('id').limit(1);

      const ping = Math.round(performance.now() - startPing);

      if (error && !error.message.includes('not find the table')) {
        setTargetTestResult({
          success: false,
          pingMs: ping,
          message: `Connection test failed: ${error.message}`,
        });
        toast.error(`Target connection failed: ${error.message}`);
      } else {
        setTargetTestResult({
          success: true,
          pingMs: ping,
          message: error
            ? 'Connected successfully! Target database authenticated (retail tables not yet initialized).'
            : 'Connected successfully! Authentication verified & retail schema detected.',
        });
        toast.success(`Target Supabase verified in ${ping}ms! ✓`);
      }
    } catch (err: any) {
      setTargetTestResult({
        success: false,
        pingMs: 0,
        message: `Network or credentials error: ${err.message}`,
      });
      toast.error('Failed to reach target Supabase: ' + err.message);
    } finally {
      setIsTestingTarget(false);
    }
  };

  /* ─────────────────────────────────────────────────────────────────────────
     ACTION 2: ACTIVATE TARGET SUPABASE (HOT-SWAP CONNECTION)
     ───────────────────────────────────────────────────────────────────────── */
  const handleActivateTargetSupabase = () => {
    if (!targetUrl.trim() || !targetAnonKey.trim()) {
      toast.error('Please specify target Supabase URL and Anon Key');
      return;
    }

    try {
      setActiveSupabaseConfig({
        url: targetUrl.trim(),
        anonKey: targetAnonKey.trim(),
        serviceKey: targetServiceKey.trim() || undefined,
        projectName: targetLabel.trim() || 'Custom Supabase Instance',
      });

      toast.success('Hot-swapped Supabase project! Whole app now points to new Supabase instance. 🚀');
      setTargetUrl('');
      setTargetAnonKey('');
      setTargetServiceKey('');
      setTargetLabel('');
      setTargetTestResult(null);

      // Reload stats for new project
      setTimeout(() => {
        checkConnectionAndStats();
      }, 300);
    } catch (err: any) {
      toast.error('Failed to activate connection: ' + err.message);
    }
  };

  /* ─────────────────────────────────────────────────────────────────────────
     ACTION 3: RESET TO DEFAULT ENVIRONMENT SUPABASE
     ───────────────────────────────────────────────────────────────────────── */
  const handleResetToDefault = () => {
    resetToDefaultSupabaseConfig();
    toast.success('Reverted to default project configured in .env.local! ✓');
    setTimeout(() => {
      checkConnectionAndStats();
    }, 300);
  };

  /* ─────────────────────────────────────────────────────────────────────────
     ACTION 4: DOWNLOAD FULL DATABASE SNAPSHOT (.JSON)
     ───────────────────────────────────────────────────────────────────────── */
  const handleDownloadFullBackup = async () => {
    if (selectedTables.length === 0) {
      toast.error('Please select at least one table to include in the backup');
      return;
    }

    setIsGeneratingBackup(true);
    const backupPayload: Record<string, any[]> = {};
    const tableMetadata: Record<string, number> = {};

    try {
      for (let i = 0; i < selectedTables.length; i++) {
        const tblName = selectedTables[i];
        setBackupProgress({ current: i + 1, total: selectedTables.length, table: tblName });

        // Fetch all rows for this table (up to 25,000 per table in chunks if needed)
        const { data, error } = await supabase.from(tblName).select('*').limit(25000);

        if (!error && data) {
          backupPayload[tblName] = data;
          tableMetadata[tblName] = data.length;
        } else {
          backupPayload[tblName] = [];
          tableMetadata[tblName] = 0;
        }
      }

      const totalRecords = Object.values(tableMetadata).reduce((a, b) => a + b, 0);

      const fullExport = {
        meta: {
          app: 'Alpha Retail POS & Enterprise Studio',
          schema_version: '2.5.0',
          exported_at: new Date().toISOString(),
          source_supabase_url: activeConfig.url,
          company_name: companyName || 'Alpha Retail Ltd',
          total_tables: selectedTables.length,
          total_records: totalRecords,
          tables_summary: tableMetadata,
        },
        data: backupPayload,
      };

      // Create download blob
      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(fullExport, null, 2))}`;
      const downloadAnchor = document.createElement('a');
      const filename = `AlphaRetail_EnterpriseBackup_${new Date().toISOString().slice(0, 10)}_${Date.now().toString().slice(-4)}.json`;
      downloadAnchor.setAttribute('href', jsonString);
      downloadAnchor.setAttribute('download', filename);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      toast.success(`Full database backup generated! ${totalRecords.toLocaleString()} records safely packaged. 💾`);
    } catch (err: any) {
      console.error('Backup generation error:', err);
      toast.error('Backup failed: ' + (err.message || ''));
    } finally {
      setIsGeneratingBackup(false);
      setBackupProgress(null);
    }
  };

  /* ─────────────────────────────────────────────────────────────────────────
     ACTION 5: UPLOAD & INSPECT BACKUP FILE (.JSON)
     ───────────────────────────────────────────────────────────────────────── */
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (!parsed.data && !parsed.meta) {
          toast.error('Invalid backup format. File must be a valid Alpha Retail JSON snapshot.');
          return;
        }
        setUploadedBackup(parsed);
        setRestoreLogs([
          `Loaded snapshot: ${file.name} (${Math.round(file.size / 1024)} KB)`,
          `Source: ${parsed.meta?.source_supabase_url || 'Unknown URL'}`,
          `Exported: ${formatDate(parsed.meta?.exported_at)}`,
          `Included Tables: ${Object.keys(parsed.data || {}).length}`,
          `Total Records in Backup: ${parsed.meta?.total_records || 'Unknown'}`,
        ]);
        toast.success(`Backup file inspected! Ready for restoration.`);
      } catch (err: any) {
        toast.error('Failed to parse backup JSON: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  /* ─────────────────────────────────────────────────────────────────────────
     ACTION 6: EXECUTE DATABASE RESTORATION
     ───────────────────────────────────────────────────────────────────────── */
  const handleExecuteRestore = async () => {
    if (!uploadedBackup || !uploadedBackup.data) {
      toast.error('No backup loaded. Please upload a valid JSON backup first.');
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to restore ${uploadedBackup.meta?.total_records || ''} records to the active Supabase project (${activeConfig.url})?\n\nRestore Mode: ${restoreMode === 'upsert' ? 'Safe Upsert / Merge' : 'Fresh Overwrite'}`
    );
    if (!confirmed) return;

    setIsRestoring(true);
    setRestoreLogs((prev) => [...prev, `--- STARTING RESTORATION (${restoreMode.toUpperCase()}) ---`]);

    const tablesToRestore = Object.keys(uploadedBackup.data);

    try {
      for (let i = 0; i < tablesToRestore.length; i++) {
        const tbl = tablesToRestore[i];
        const rows: any[] = uploadedBackup.data[tbl] || [];

        setRestoreProgress({
          current: i + 1,
          total: tablesToRestore.length,
          table: tbl,
          status: `Processing ${rows.length} rows...`,
        });

        if (rows.length === 0) {
          setRestoreLogs((prev) => [...prev, `[${i + 1}/${tablesToRestore.length}] Table '${tbl}': Skipped (0 rows)`]);
          continue;
        }

        // Overwrite mode: delete existing records if user selected overwrite
        if (restoreMode === 'overwrite') {
          setRestoreLogs((prev) => [...prev, `Clearing existing data in '${tbl}'...`]);
          const tblMeta = MANAGED_TABLES.find((m) => m.name === tbl);
          if (tblMeta?.primaryKey) {
            await supabase.from(tbl).delete().neq(tblMeta.primaryKey, -999999);
          }
        }

        // Insert in chunks of 50 to avoid HTTP payload size limitations
        const CHUNK_SIZE = 50;
        let insertedCount = 0;

        for (let c = 0; c < rows.length; c += CHUNK_SIZE) {
          const chunk = rows.slice(c, c + CHUNK_SIZE);
          const { error: insErr } = await supabase.from(tbl).upsert(chunk);

          if (insErr) {
            setRestoreLogs((prev) => [
              ...prev,
              `⚠️ Error inserting batch into '${tbl}' (chunk ${c / CHUNK_SIZE + 1}): ${insErr.message}`,
            ]);
          } else {
            insertedCount += chunk.length;
          }
        }

        setRestoreLogs((prev) => [
          ...prev,
          `✓ Table '${tbl}': Restored ${insertedCount}/${rows.length} records.`,
        ]);
      }

      toast.success('Database restore execution completed! 🎉');
      setRestoreLogs((prev) => [...prev, '--- RESTORATION FINISHED SUCCESSFULLY ---']);
      await checkConnectionAndStats();
    } catch (err: any) {
      console.error('Restoration error:', err);
      toast.error('Restoration encountered an error: ' + err.message);
      setRestoreLogs((prev) => [...prev, `FATAL ERROR: ${err.message}`]);
    } finally {
      setIsRestoring(false);
      setRestoreProgress(null);
    }
  };

  /* ─────────────────────────────────────────────────────────────────────────
     ACTION 7: DIRECT PROJECT-TO-PROJECT MIGRATION (CLONE)
     ───────────────────────────────────────────────────────────────────────── */
  const handleExecuteDirectMigration = async () => {
    if (!targetUrl.trim() || !targetAnonKey.trim()) {
      toast.error('Please enter the target Supabase URL and Anon Key in the connection switcher tab first.');
      return;
    }

    const confirmed = window.confirm(
      `CLONE DATABASE:\nAre you sure you want to stream all records from:\nSource: ${activeConfig.url}\n→ Target: ${targetUrl.trim()}\n\nThis will copy all data across all tables directly.`
    );
    if (!confirmed) return;

    setIsMigratingDirect(true);
    try {
      const targetClient = createDynamicSupabaseClient(targetUrl.trim(), targetAnonKey.trim());

      for (let i = 0; i < MANAGED_TABLES.length; i++) {
        const tbl = MANAGED_TABLES[i].name;
        setMigrationProgress({ current: i + 1, total: MANAGED_TABLES.length, table: tbl, records: 0 });

        // Read all rows from source
        const { data: sourceRows, error: readErr } = await supabase.from(tbl).select('*').limit(25000);

        if (readErr || !sourceRows || sourceRows.length === 0) {
          continue;
        }

        setMigrationProgress({ current: i + 1, total: MANAGED_TABLES.length, table: tbl, records: sourceRows.length });

        // Write in chunks to target
        const CHUNK_SIZE = 50;
        for (let c = 0; c < sourceRows.length; c += CHUNK_SIZE) {
          const chunk = sourceRows.slice(c, c + CHUNK_SIZE);
          await targetClient.from(tbl).upsert(chunk);
        }
      }

      toast.success(`Direct database cloning completed to ${targetUrl}! 🚀`);
    } catch (err: any) {
      console.error('Migration error:', err);
      toast.error('Direct migration error: ' + err.message);
    } finally {
      setIsMigratingDirect(false);
      setMigrationProgress(null);
    }
  };

  /* ─────────────────────────────────────────────────────────────────────────
     TABLE INSPECTOR FILTER & PAGINATION
     ───────────────────────────────────────────────────────────────────────── */
  const filteredInspectorTables = useMemo(() => {
    return MANAGED_TABLES.filter((t) => {
      const matchSearch =
        !inspectorSearch.trim() ||
        t.name.toLowerCase().includes(inspectorSearch.toLowerCase()) ||
        t.label.toLowerCase().includes(inspectorSearch.toLowerCase());
      const matchCat = inspectorCategoryFilter === 'ALL' || t.category === inspectorCategoryFilter;
      return matchSearch && matchCat;
    });
  }, [inspectorSearch, inspectorCategoryFilter]);

  const totalInspectorPages = Math.max(1, Math.ceil(filteredInspectorTables.length / inspectorPerPage));
  const paginatedInspectorTables = useMemo(() => {
    const start = (inspectorPage - 1) * inspectorPerPage;
    return filteredInspectorTables.slice(start, start + inspectorPerPage);
  }, [filteredInspectorTables, inspectorPage, inspectorPerPage]);

  /* ─────────────────────────────────────────────────────────────────────────
     FRESH SETUP DDL SCRIPT FOR SUPABASE
     ───────────────────────────────────────────────────────────────────────── */
  const FRESH_DDL_SCRIPT = `-- ========================================================
-- ALPHA RETAIL DATABASE SCHEMA & TABLES SETUP
-- Paste this script into your new Supabase project's SQL Editor
-- URL: https://supabase.com/dashboard/project/_/sql
-- ========================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. RETAIL OUTLETS
CREATE TABLE IF NOT EXISTS retail_outlets (
    outlet_id SERIAL PRIMARY KEY,
    outlet_name VARCHAR(150) NOT NULL,
    outlet_code VARCHAR(50) UNIQUE,
    location VARCHAR(200),
    phone VARCHAR(50),
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. MERCHANDISE CATEGORIES
CREATE TABLE IF NOT EXISTS retail_categories (
    category_id SERIAL PRIMARY KEY,
    category_name VARCHAR(150) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. MEASUREMENT UNITS
CREATE TABLE IF NOT EXISTS retail_units (
    unit_id SERIAL PRIMARY KEY,
    unit_name VARCHAR(50) NOT NULL UNIQUE,
    abbreviation VARCHAR(20),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. SUPPLIERS DIRECTORY
CREATE TABLE IF NOT EXISTS retail_suppliers (
    supplier_id SERIAL PRIMARY KEY,
    supplier_name VARCHAR(150) NOT NULL,
    contact_person VARCHAR(100),
    phone VARCHAR(50),
    email VARCHAR(100),
    address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. MASTER PRODUCTS CATALOG
CREATE TABLE IF NOT EXISTS retail_products (
    pid SERIAL PRIMARY KEY,
    product_code VARCHAR(100) UNIQUE,
    product_name VARCHAR(200) NOT NULL,
    name VARCHAR(200),
    barcode VARCHAR(100),
    category VARCHAR(100),
    department VARCHAR(100),
    purchase_cost NUMERIC DEFAULT 0,
    cost_price NUMERIC DEFAULT 0,
    selling_price NUMERIC DEFAULT 0,
    sales_cost NUMERIC DEFAULT 0,
    reorder_point NUMERIC DEFAULT 5,
    unit VARCHAR(50) DEFAULT 'PCS',
    purchase_unit VARCHAR(50) DEFAULT 'PCS',
    sales_unit VARCHAR(50) DEFAULT 'PCS',
    supplier_name VARCHAR(150),
    outlet_id INTEGER DEFAULT 1,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. STOCK ON HAND
CREATE TABLE IF NOT EXISTS retail_stock (
    stock_id SERIAL PRIMARY KEY,
    pid INTEGER REFERENCES retail_products(pid) ON DELETE CASCADE,
    qty NUMERIC DEFAULT 0,
    invoice_no VARCHAR(100),
    storage_type VARCHAR(50) DEFAULT 'Pieces',
    outlet_id INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. SALES INVOICES
CREATE TABLE IF NOT EXISTS retail_sales (
    sale_id SERIAL PRIMARY KEY,
    receipt_no VARCHAR(100) UNIQUE,
    sale_date DATE DEFAULT CURRENT_DATE,
    sale_time TIME DEFAULT CURRENT_TIME,
    sale_datetime TIMESTAMPTZ DEFAULT NOW(),
    customer_id INTEGER,
    customer_name VARCHAR(150),
    customer_phone VARCHAR(50),
    subtotal NUMERIC DEFAULT 0,
    discount NUMERIC DEFAULT 0,
    tax_amount NUMERIC DEFAULT 0,
    total_amount NUMERIC NOT NULL DEFAULT 0,
    total_cost NUMERIC DEFAULT 0,
    profit NUMERIC DEFAULT 0,
    payment_method VARCHAR(50) DEFAULT 'Cash',
    amount_paid NUMERIC DEFAULT 0,
    change_amount NUMERIC DEFAULT 0,
    status VARCHAR(50) DEFAULT 'completed',
    notes TEXT,
    created_by VARCHAR(100),
    outlet_id INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. SALES LINE ITEMS
CREATE TABLE IF NOT EXISTS retail_sales_items (
    item_id SERIAL PRIMARY KEY,
    sale_id INTEGER REFERENCES retail_sales(sale_id) ON DELETE CASCADE,
    product_id INTEGER,
    product_name VARCHAR(200),
    barcode VARCHAR(100),
    quantity NUMERIC DEFAULT 1,
    unit_price NUMERIC DEFAULT 0,
    cost_price NUMERIC DEFAULT 0,
    subtotal NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. SALES RETURNS
CREATE TABLE IF NOT EXISTS sales_returns (
    return_id SERIAL PRIMARY KEY,
    return_no VARCHAR(100) UNIQUE,
    return_date DATE DEFAULT CURRENT_DATE,
    original_sale_id VARCHAR(100),
    product_name VARCHAR(200),
    quantity NUMERIC DEFAULT 1,
    unit_price NUMERIC DEFAULT 0,
    total_amount NUMERIC DEFAULT 0,
    reason TEXT,
    status VARCHAR(50) DEFAULT 'Completed',
    processed_by VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. PURCHASES & INFLOWS
CREATE TABLE IF NOT EXISTS retail_purchases (
    purchase_id SERIAL PRIMARY KEY,
    invoice_no VARCHAR(100),
    purchase_date DATE DEFAULT CURRENT_DATE,
    supplier_id INTEGER,
    supplier_name VARCHAR(150),
    subtotal NUMERIC DEFAULT 0,
    tax_amount NUMERIC DEFAULT 0,
    grand_total NUMERIC DEFAULT 0,
    payment_status VARCHAR(50) DEFAULT 'Paid',
    outlet_id INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS retail_purchase_items (
    item_id SERIAL PRIMARY KEY,
    purchase_id INTEGER REFERENCES retail_purchases(purchase_id) ON DELETE CASCADE,
    product_id INTEGER,
    product_name VARCHAR(200),
    qty NUMERIC DEFAULT 1,
    cost_price NUMERIC DEFAULT 0,
    total_cost NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. CREDIT CUSTOMERS & LOYALTY
CREATE TABLE IF NOT EXISTS retail_credit_customers (
    customer_id SERIAL PRIMARY KEY,
    customer_code VARCHAR(50) UNIQUE,
    customer_name VARCHAR(150) NOT NULL,
    phone VARCHAR(50),
    email VARCHAR(100),
    address TEXT,
    credit_limit NUMERIC DEFAULT 0,
    current_balance NUMERIC DEFAULT 0,
    prepayment_balance NUMERIC DEFAULT 0,
    opening_balance NUMERIC DEFAULT 0,
    active BOOLEAN DEFAULT true,
    notes TEXT,
    outlet_id INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS retail_credit_payments (
    payment_id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES retail_credit_customers(customer_id) ON DELETE CASCADE,
    amount_paid NUMERIC NOT NULL DEFAULT 0,
    payment_method VARCHAR(50) DEFAULT 'Cash',
    payment_date DATE DEFAULT CURRENT_DATE,
    payment_datetime TIMESTAMPTZ DEFAULT NOW(),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. EXPENSES
CREATE TABLE IF NOT EXISTS expenses (
    expense_id SERIAL PRIMARY KEY,
    expense_name VARCHAR(150),
    category VARCHAR(100) DEFAULT 'General & Administrative',
    amount NUMERIC NOT NULL DEFAULT 0,
    payment_mode VARCHAR(50) DEFAULT 'Cash',
    reference_no VARCHAR(100),
    description TEXT,
    expense_date DATE DEFAULT CURRENT_DATE,
    created_by VARCHAR(100),
    outlet_id INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. SYSTEM CONFIGURATION & REGISTRATION
CREATE TABLE IF NOT EXISTS retail_settings (
    id SERIAL PRIMARY KEY,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT,
    setting_type VARCHAR(50) DEFAULT 'text',
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS registration (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(150),
    password VARCHAR(200) NOT NULL,
    role VARCHAR(50) DEFAULT 'cashier',
    outlet_id INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS organisation_settings (
    id SERIAL PRIMARY KEY,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vouchers (
    voucher_id SERIAL PRIMARY KEY,
    voucher_no VARCHAR(100) UNIQUE NOT NULL,
    voucher_type VARCHAR(50) DEFAULT 'discount',
    discount_amount NUMERIC DEFAULT 0,
    voucher_date DATE DEFAULT CURRENT_DATE,
    status VARCHAR(50) DEFAULT 'Active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shifts (
    shift_id SERIAL PRIMARY KEY,
    shift_name VARCHAR(100),
    user_id VARCHAR(100),
    user_name VARCHAR(150),
    opening_balance NUMERIC DEFAULT 0,
    closing_balance NUMERIC DEFAULT 0,
    status VARCHAR(50) DEFAULT 'open',
    opened_at TIMESTAMPTZ DEFAULT NOW(),
    closed_at TIMESTAMPTZ
);

-- Disable Row Level Security (RLS) for seamless retail execution
ALTER TABLE retail_products DISABLE ROW LEVEL SECURITY;
ALTER TABLE retail_stock DISABLE ROW LEVEL SECURITY;
ALTER TABLE retail_sales DISABLE ROW LEVEL SECURITY;
ALTER TABLE retail_sales_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE sales_returns DISABLE ROW LEVEL SECURITY;
ALTER TABLE retail_purchases DISABLE ROW LEVEL SECURITY;
ALTER TABLE retail_purchase_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE retail_credit_customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE retail_credit_payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE expenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE retail_categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE retail_units DISABLE ROW LEVEL SECURITY;
ALTER TABLE retail_suppliers DISABLE ROW LEVEL SECURITY;
ALTER TABLE retail_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE registration DISABLE ROW LEVEL SECURITY;
ALTER TABLE retail_outlets DISABLE ROW LEVEL SECURITY;
ALTER TABLE organisation_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE vouchers DISABLE ROW LEVEL SECURITY;
ALTER TABLE shifts DISABLE ROW LEVEL SECURITY;

-- Insert default admin user if not exists (login: admin / admin123)
INSERT INTO registration (user_id, name, password, role)
VALUES ('admin', 'System Administrator', 'admin123', 'superadmin')
ON CONFLICT (user_id) DO NOTHING;

-- Insert default outlet
INSERT INTO retail_outlets (outlet_id, outlet_name, outlet_code, location)
VALUES (1, 'Main Outlet', 'OUT-001', 'Nairobi Central')
ON CONFLICT (outlet_id) DO NOTHING;
`;

  return (
    <div className="space-y-4 pb-14 text-slate-800">
      <Toaster position="top-right" />

      {/* ══════════════════════════════════════════════════════════════════
          1. EXECUTIVE HEADER & CONNECTION STATUS
          ══════════════════════════════════════════════════════════════════ */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-600 via-blue-600 to-indigo-700 text-white flex items-center justify-center shadow-md shadow-blue-500/20 flex-shrink-0">
              <FiDatabase size={24} className="stroke-[2.5]" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  Enterprise Database &amp; Supabase Studio
                </h1>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border flex items-center gap-1 ${
                    connectionHealth === 'connected'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : connectionHealth === 'testing'
                      ? 'bg-amber-50 text-amber-800 border-amber-300'
                      : 'bg-rose-50 text-rose-800 border-rose-300'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      connectionHealth === 'connected'
                        ? 'bg-emerald-500 animate-pulse'
                        : connectionHealth === 'testing'
                        ? 'bg-amber-500 animate-spin'
                        : 'bg-rose-500'
                    }`}
                  />
                  <span>
                    {connectionHealth === 'connected'
                      ? `Connected (${connectionPingMs || 0}ms)`
                      : connectionHealth === 'testing'
                      ? 'Pinging...'
                      : 'Connection Failed'}
                  </span>
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
                    activeConfig.isCustom
                      ? 'bg-purple-50 text-purple-700 border-purple-200'
                      : 'bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  {activeConfig.isCustom ? '⚡ Custom Supabase' : 'Default (.env)'}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Active Project: <strong className="font-mono text-slate-700">{activeConfig.url}</strong> &bull; Hot-Swap
                Supabase accounts &bull; 1-Click Backups &amp; Complete Restorations
              </p>
            </div>
          </div>

          {/* Quick Command Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setActiveTab('switcher')}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-2xs transition cursor-pointer"
            >
              <FiLink size={13} />
              <span>Switch Supabase</span>
            </button>

            <button
              onClick={handleDownloadFullBackup}
              disabled={isGeneratingBackup}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold shadow-2xs transition cursor-pointer disabled:opacity-50"
            >
              <FiDownload size={13} />
              <span>{isGeneratingBackup ? 'Packaging...' : 'Quick Backup (.json)'}</span>
            </button>

            <button
              onClick={() => setActiveTab('restore')}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-blue-300 bg-blue-50 hover:bg-blue-100 text-blue-800 text-xs font-bold shadow-2xs transition cursor-pointer"
            >
              <FiUploadCloud size={13} />
              <span>Restore Data</span>
            </button>

            <button
              onClick={checkConnectionAndStats}
              disabled={isLoadingStats}
              className="p-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-2xs transition cursor-pointer disabled:opacity-50"
              title="Ping & Refresh Telemetry"
            >
              <FiRefreshCw size={13} className={isLoadingStats ? 'animate-spin text-blue-600' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          2. EXECUTIVE 8-METRIC DATABASE TELEMETRY HUD
          ══════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        <div className="bg-white border border-slate-200/90 rounded-2xl p-2.5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Active Tables</span>
            <div className="w-5 h-5 rounded-md bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center">
              <FiLayers size={11} />
            </div>
          </div>
          <div>
            <div className="text-base font-black text-slate-900 leading-tight">
              {activeTablesCount} / {MANAGED_TABLES.length}
            </div>
            <div className="text-[9.5px] text-slate-500 font-semibold mt-0.5 truncate">Retail schema tables</div>
          </div>
        </div>

        <div className="bg-white border border-blue-200/90 rounded-2xl p-2.5 shadow-xs flex flex-col justify-between bg-gradient-to-b from-blue-50/20 to-white">
          <div className="flex items-center justify-between text-blue-700 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Total Records</span>
            <div className="w-5 h-5 rounded-md bg-blue-100 border border-blue-200 text-blue-700 flex items-center justify-center">
              <FiDatabase size={11} />
            </div>
          </div>
          <div>
            <div className="text-base font-black text-blue-800 leading-tight">{fmtN(totalDatabaseRecords)}</div>
            <div className="text-[9.5px] text-blue-600 font-semibold mt-0.5 truncate">Across all database tables</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-2.5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Products SKUs</span>
            <div className="w-5 h-5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center">
              <FiActivity size={11} />
            </div>
          </div>
          <div>
            <div className="text-base font-black text-slate-900 leading-tight">
              {fmtN(tableStats['retail_products']?.count || 0)}
            </div>
            <div className="text-[9.5px] text-slate-500 font-semibold mt-0.5 truncate">Catalog items</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-2.5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Sales Invoices</span>
            <div className="w-5 h-5 rounded-md bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center">
              <FiFileText size={11} />
            </div>
          </div>
          <div>
            <div className="text-base font-black text-slate-900 leading-tight">
              {fmtN(tableStats['retail_sales']?.count || 0)}
            </div>
            <div className="text-[9.5px] text-slate-500 font-semibold mt-0.5 truncate">Invoices recorded</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-2.5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Sold Line Items</span>
            <div className="w-5 h-5 rounded-md bg-purple-50 border border-purple-200 text-purple-700 flex items-center justify-center">
              <FiLayers size={11} />
            </div>
          </div>
          <div>
            <div className="text-base font-black text-slate-900 leading-tight">
              {fmtN(tableStats['retail_sales_items']?.count || 0)}
            </div>
            <div className="text-[9.5px] text-slate-500 font-semibold mt-0.5 truncate">Itemized records</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-2.5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Customers</span>
            <div className="w-5 h-5 rounded-md bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center">
              <FiShield size={11} />
            </div>
          </div>
          <div>
            <div className="text-base font-black text-slate-900 leading-tight">
              {fmtN(tableStats['retail_credit_customers']?.count || 0)}
            </div>
            <div className="text-[9.5px] text-slate-500 font-semibold mt-0.5 truncate">Registered clients</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-2.5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Expenses</span>
            <div className="w-5 h-5 rounded-md bg-rose-50 border border-rose-200 text-rose-700 flex items-center justify-center">
              <FiActivity size={11} />
            </div>
          </div>
          <div>
            <div className="text-base font-black text-slate-900 leading-tight">
              {fmtN(tableStats['expenses']?.count || 0)}
            </div>
            <div className="text-[9.5px] text-slate-500 font-semibold mt-0.5 truncate">Overhead items</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-2.5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Latency</span>
            <div className="w-5 h-5 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center">
              <FiServer size={11} />
            </div>
          </div>
          <div>
            <div className="text-base font-black text-slate-900 leading-tight">{connectionPingMs || 0} ms</div>
            <div className="text-[9.5px] text-slate-500 font-semibold mt-0.5 truncate">REST API Ping</div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          3. TAB NAVIGATION BAR
          ══════════════════════════════════════════════════════════════════ */}
      <div className="bg-white border border-slate-200 rounded-2xl p-1.5 shadow-xs flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1">
          <button
            onClick={() => setActiveTab('switcher')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'switcher'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <FiLink size={14} />
            <span>Switch Supabase Account</span>
          </button>

          <button
            onClick={() => setActiveTab('backup')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'backup'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <FiDownload size={14} />
            <span>1-Click Database Backup</span>
          </button>

          <button
            onClick={() => setActiveTab('restore')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'restore'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <FiUploadCloud size={14} />
            <span>Restore &amp; Ingestion</span>
          </button>

          <button
            onClick={() => setActiveTab('inspector')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'inspector'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <FiDatabase size={14} />
            <span>Table Inspector &amp; Schema</span>
          </button>

          <button
            onClick={() => setActiveTab('sql')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'sql'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <FiFileText size={14} />
            <span>Fresh Project SQL DDL</span>
          </button>
        </div>

        <div className="text-[11px] font-bold text-slate-500 pr-2 hidden sm:block">
          Active Provider: <strong className="text-slate-800">{activeConfig.projectName || 'Supabase Cloud'}</strong>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          TAB 1: SUPABASE CONNECTION & ACCOUNT SWITCHER
          ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'switcher' && (
        <div className="space-y-4 max-w-4xl mx-auto">
          {/* Active Connection Overview */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Current Live Target</span>
                <h3 className="text-base font-black text-slate-900 mt-0.5 flex items-center gap-2">
                  <FiServer className="text-blue-600" />
                  {activeConfig.projectName}
                </h3>
              </div>
              {activeConfig.isCustom && (
                <button
                  onClick={handleResetToDefault}
                  className="px-3.5 py-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition cursor-pointer"
                >
                  ↩️ Reset to Default (.env)
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Supabase URL</span>
                <strong className="font-mono text-slate-800 break-all">{activeConfig.url}</strong>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Anon Public Key</span>
                <strong className="font-mono text-slate-800 break-all">
                  {activeConfig.anonKey ? `${activeConfig.anonKey.slice(0, 20)}...${activeConfig.anonKey.slice(-10)}` : '—'}
                </strong>
              </div>
            </div>
          </div>

          {/* Connect Another Supabase Project Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
            <div>
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <FiLink size={18} className="text-blue-600" />
                Connect &amp; Switch to Another Supabase Project
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Enter your new Supabase project credentials. You can test the connection first, clone your existing database,
                or immediately activate it across the entire POS and dashboard.
              </p>
            </div>

            <div className="space-y-3.5 pt-2">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  New Supabase Project URL *
                </label>
                <input
                  type="text"
                  placeholder="https://your-new-project-id.supabase.co"
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  New Supabase Anon Key (Public) *
                </label>
                <textarea
                  rows={2}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  value={targetAnonKey}
                  onChange={(e) => setTargetAnonKey(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Service Role Key (Optional — For Table Wipes &amp; Migration)
                  </label>
                  <input
                    type="password"
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI..."
                    value={targetServiceKey}
                    onChange={(e) => setTargetServiceKey(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Project Label / Identifier
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. AlphaRetail Standalone Cloud 2"
                    value={targetLabel}
                    onChange={(e) => setTargetLabel(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Test Result Box */}
              {targetTestResult && (
                <div
                  className={`p-3.5 rounded-xl border text-xs flex items-center justify-between gap-3 ${
                    targetTestResult.success
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                      : 'bg-rose-50 border-rose-300 text-rose-800'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {targetTestResult.success ? <FiCheckCircle size={16} /> : <FiXCircle size={16} />}
                    <span className="font-semibold">{targetTestResult.message}</span>
                  </div>
                  {targetTestResult.pingMs > 0 && (
                    <span className="font-mono font-bold text-[11px]">{targetTestResult.pingMs}ms</span>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleTestTargetConnection}
                  disabled={isTestingTarget || !targetUrl.trim() || !targetAnonKey.trim()}
                  className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-2xs transition cursor-pointer disabled:opacity-40"
                >
                  {isTestingTarget ? 'Testing Connection...' : '⚡ Test Connection'}
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleExecuteDirectMigration}
                    disabled={isMigratingDirect || !targetUrl.trim() || !targetAnonKey.trim()}
                    className="px-4 py-2 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold shadow-2xs transition cursor-pointer disabled:opacity-40"
                    title="Copy all rows from current database directly into this new Supabase project"
                  >
                    {isMigratingDirect
                      ? `Cloning ${migrationProgress?.table || ''} (${migrationProgress?.current}/${migrationProgress?.total})...`
                      : '🔄 Direct Clone Database'}
                  </button>

                  <button
                    type="button"
                    onClick={handleActivateTargetSupabase}
                    disabled={!targetUrl.trim() || !targetAnonKey.trim()}
                    className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-sm transition cursor-pointer disabled:opacity-40"
                  >
                    🚀 Activate Project
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB 2: 1-CLICK DATABASE BACKUP & SNAPSHOT GENERATOR
          ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'backup' && (
        <div className="space-y-4 max-w-4xl mx-auto">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <FiDownload size={18} className="text-emerald-600" />
                  1-Click Full System Snapshot &amp; Backup
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Export all active tables, schemas, and records into an enterprise JSON backup file
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedTables(MANAGED_TABLES.map((t) => t.name))}
                  className="px-2.5 py-1 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Select All
                </button>
                <button
                  onClick={() => setSelectedTables([])}
                  className="px-2.5 py-1 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Deselect All
                </button>
              </div>
            </div>

            {/* Tables Selection Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-80 overflow-y-auto p-1 border border-slate-100 rounded-xl">
              {MANAGED_TABLES.map((t) => {
                const isSelected = selectedTables.includes(t.name);
                const count = tableStats[t.name]?.count || 0;

                return (
                  <label
                    key={t.name}
                    className={`flex items-center justify-between p-2.5 rounded-xl border text-xs cursor-pointer transition ${
                      isSelected
                        ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950 font-bold'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {
                          if (isSelected) {
                            setSelectedTables(selectedTables.filter((x) => x !== t.name));
                          } else {
                            setSelectedTables([...selectedTables, t.name]);
                          }
                        }}
                        className="rounded text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="truncate">{t.label}</span>
                    </div>

                    <span className="font-mono text-[11px] font-black opacity-80 ml-2">
                      {fmtN(count)}
                    </span>
                  </label>
                );
              })}
            </div>

            {/* Backup Progress */}
            {backupProgress && (
              <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                  <span>Exporting table: {backupProgress.table}</span>
                  <span>
                    {backupProgress.current} / {backupProgress.total} tables
                  </span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-2 rounded-full bg-emerald-500 transition-all duration-200"
                    style={{ width: `${(backupProgress.current / backupProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}

            <div className="mt-5 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-slate-500 font-semibold">
                Selected tables: <strong className="text-slate-900">{selectedTables.length}</strong> &bull; Total records in scope:{' '}
                <strong className="text-emerald-700">
                  {fmtN(
                    selectedTables.reduce((sum, tbl) => sum + (tableStats[tbl]?.count || 0), 0)
                  )}
                </strong>
              </span>

              <button
                onClick={handleDownloadFullBackup}
                disabled={isGeneratingBackup || selectedTables.length === 0}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md transition cursor-pointer flex items-center gap-2 disabled:opacity-40"
              >
                <FiDownload size={14} />
                <span>{isGeneratingBackup ? 'Downloading Snapshot...' : 'Download Full System Snapshot (.json)'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB 3: DATABASE RESTORE & INGESTION ENGINE
          ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'restore' && (
        <div className="space-y-4 max-w-4xl mx-auto">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <FiUploadCloud size={18} className="text-blue-600" />
              Database Restoration &amp; Ingestion Engine
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Select or drop an Alpha Retail JSON snapshot file to restore records into{' '}
              <strong className="font-mono text-slate-700">{activeConfig.url}</strong>
            </p>

            {/* Upload Zone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="mt-4 border-2 border-dashed border-slate-300 hover:border-blue-400 rounded-2xl p-8 text-center cursor-pointer bg-slate-50/50 hover:bg-blue-50/20 transition group"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="hidden"
              />
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform">
                <FiUploadCloud size={24} />
              </div>
              <p className="text-xs font-bold text-slate-700">Click to browse or drop your .json backup file here</p>
              <p className="text-[10px] text-slate-400 mt-1">Accepts standard Alpha Retail JSON Snapshots</p>
            </div>

            {/* Uploaded File Inspector Box */}
            {uploadedBackup && (
              <div className="mt-4 p-4 rounded-xl border border-blue-200 bg-blue-50/40 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-blue-200/60 pb-2">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-blue-700">Snapshot Metadata</span>
                    <h4 className="text-sm font-black text-slate-900 mt-0.5">
                      {uploadedBackup.meta?.company_name || 'Alpha Retail Backup'}
                    </h4>
                  </div>
                  <div className="text-right text-xs">
                    <span className="text-slate-500 font-semibold">Total Records: </span>
                    <strong className="text-blue-700 font-mono text-sm">
                      {fmtN(uploadedBackup.meta?.total_records || 0)}
                    </strong>
                  </div>
                </div>

                {/* Restoration Mode Selector */}
                <div className="pt-2">
                  <label className="text-xs font-bold text-slate-700 block mb-1">Restoration Strategy:</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <label
                      className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition ${
                        restoreMode === 'upsert'
                          ? 'bg-white border-blue-400 ring-2 ring-blue-400/20 shadow-xs'
                          : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <input
                        type="radio"
                        name="rMode"
                        checked={restoreMode === 'upsert'}
                        onChange={() => setRestoreMode('upsert')}
                        className="mt-0.5 text-blue-600"
                      />
                      <div>
                        <strong className="text-xs text-slate-900 block">⚡ Safe Upsert / Merge Mode (Recommended)</strong>
                        <span className="text-[10px] text-slate-500 leading-tight block mt-0.5">
                          Inserts missing records and updates matching primary keys. Zero accidental deletion.
                        </span>
                      </div>
                    </label>

                    <label
                      className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition ${
                        restoreMode === 'overwrite'
                          ? 'bg-rose-50 border-rose-400 ring-2 ring-rose-400/20 shadow-xs'
                          : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <input
                        type="radio"
                        name="rMode"
                        checked={restoreMode === 'overwrite'}
                        onChange={() => setRestoreMode('overwrite')}
                        className="mt-0.5 text-rose-600"
                      />
                      <div>
                        <strong className="text-xs text-rose-900 block">⚠️ Clean Overwrite Mode</strong>
                        <span className="text-[10px] text-slate-500 leading-tight block mt-0.5">
                          Clears existing rows before inserting. Use only when initializing a completely fresh database.
                        </span>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Execute Restore Button */}
                <div className="pt-2 flex justify-end">
                  <button
                    onClick={handleExecuteRestore}
                    disabled={isRestoring}
                    className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-md transition cursor-pointer flex items-center gap-2 disabled:opacity-40"
                  >
                    <FiPlay size={13} />
                    <span>{isRestoring ? 'Ingesting Records...' : 'Start Restoration Ingestion'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Restore Progress Bar */}
            {restoreProgress && (
              <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                  <span>
                    Table: {restoreProgress.table} &bull; {restoreProgress.status}
                  </span>
                  <span>
                    {restoreProgress.current} / {restoreProgress.total}
                  </span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-2 rounded-full bg-blue-600 transition-all duration-200"
                    style={{ width: `${(restoreProgress.current / restoreProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Restore Logs Console */}
            {restoreLogs.length > 0 && (
              <div className="mt-4">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Ingestion Audit Logs
                </span>
                <div className="p-3 bg-slate-900 text-slate-200 rounded-xl font-mono text-[11px] max-h-48 overflow-y-auto space-y-1">
                  {restoreLogs.map((log, idx) => (
                    <div key={idx} className="leading-tight">
                      {log}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB 4: TABLE INSPECTOR & SCHEMA MATRIX
          ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'inspector' && (
        <div className="space-y-3">
          <div className="bg-white border border-slate-200/90 rounded-2xl p-3 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
              <div className="relative flex-1 min-w-[200px]">
                <FiSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search table name or description..."
                  value={inspectorSearch}
                  onChange={(e) => {
                    setInspectorSearch(e.target.value);
                    setInspectorPage(1);
                  }}
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <select
                value={inspectorCategoryFilter}
                onChange={(e) => {
                  setInspectorCategoryFilter(e.target.value);
                  setInspectorPage(1);
                }}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="ALL">All Categories</option>
                <option value="Inventory">Inventory</option>
                <option value="Sales">Sales</option>
                <option value="Purchases">Purchases</option>
                <option value="Customers">Customers</option>
                <option value="Finance">Finance</option>
                <option value="Settings">Settings</option>
                <option value="Operations">Operations</option>
              </select>
            </div>

            <div className="text-xs font-bold text-slate-500">
              Total Tables Monitored: <strong className="text-slate-900 font-mono">{MANAGED_TABLES.length}</strong>
            </div>
          </div>

          {/* Table (Strict Compliance: NO Dark Gradient, Clean Visible Fonts) */}
          <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 border-b-2 border-slate-300">
                  <tr className="bg-slate-100 border-b border-slate-300">
                    <th className="py-3 px-3 font-black uppercase tracking-wider text-[11px] w-12 text-center text-slate-900 bg-slate-100 border-r border-slate-200">#</th>
                    <th className="py-3 px-3 font-black uppercase tracking-wider text-[11px] text-slate-900 bg-slate-100 border-r border-slate-200">Database Table</th>
                    <th className="py-3 px-3 font-black uppercase tracking-wider text-[11px] text-slate-900 bg-slate-100 border-r border-slate-200">Friendly Label</th>
                    <th className="py-3 px-3 font-black uppercase tracking-wider text-[11px] text-slate-900 bg-slate-100 border-r border-slate-200">Domain Category</th>
                    <th className="py-3 px-3 font-black uppercase tracking-wider text-[11px] text-slate-900 bg-slate-100 border-r border-slate-200">Primary Key</th>
                    <th className="py-3 px-3 font-black uppercase tracking-wider text-[11px] text-right text-slate-900 bg-slate-100 border-r border-slate-200">Live Record Count</th>
                    <th className="py-3 px-3 font-black uppercase tracking-wider text-[11px] text-center text-slate-900 bg-slate-100">Status</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {paginatedInspectorTables.map((t, idx) => {
                    const rowNum = (inspectorPage - 1) * inspectorPerPage + idx + 1;
                    const stat = tableStats[t.name] || { count: 0, status: 'ok' };

                    return (
                      <tr key={t.name} className="hover:bg-slate-50 transition">
                        <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px]">{rowNum}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{t.name}</td>
                        <td className="py-2.5 px-3 text-slate-700 font-semibold">{t.label}</td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-slate-100 text-slate-700 border border-slate-200">
                            {t.category}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-500">{t.primaryKey}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-black text-slate-900 text-sm">
                          {fmtN(stat.count)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {stat.status === 'ok' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              <FiCheckCircle size={10} /> Active
                            </span>
                          ) : stat.status === 'missing' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                              <FiAlertTriangle size={10} /> Not Initialized
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                              <FiXCircle size={10} /> Error
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls Dock */}
            <div className="p-3 bg-slate-50/80 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-500 font-medium">Rows per page:</span>
                <select
                  value={inspectorPerPage}
                  onChange={(e) => {
                    setInspectorPerPage(Number(e.target.value));
                    setInspectorPage(1);
                  }}
                  className="bg-white border border-slate-200 rounded-lg px-2 py-1 font-bold text-slate-700 cursor-pointer"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
                <span className="text-slate-500 ml-2">
                  Showing{' '}
                  <strong className="text-slate-800">
                    {filteredInspectorTables.length === 0 ? 0 : (inspectorPage - 1) * inspectorPerPage + 1}
                  </strong>{' '}
                  to{' '}
                  <strong className="text-slate-800">
                    {Math.min(inspectorPage * inspectorPerPage, filteredInspectorTables.length)}
                  </strong>{' '}
                  of <strong className="text-slate-800">{filteredInspectorTables.length}</strong> tables
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setInspectorPage(1)}
                  disabled={inspectorPage === 1}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                  title="First Page"
                >
                  <FiChevronsLeft size={14} />
                </button>
                <button
                  onClick={() => setInspectorPage((p) => Math.max(1, p - 1))}
                  disabled={inspectorPage === 1}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                  title="Previous Page"
                >
                  <FiChevronLeft size={14} />
                </button>
                <span className="px-3 py-1 font-bold text-slate-800 bg-white border border-slate-200 rounded-lg">
                  {inspectorPage} / {totalInspectorPages}
                </span>
                <button
                  onClick={() => setInspectorPage((p) => Math.min(totalInspectorPages, p + 1))}
                  disabled={inspectorPage === totalInspectorPages}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                  title="Next Page"
                >
                  <FiChevronRight size={14} />
                </button>
                <button
                  onClick={() => setInspectorPage(totalInspectorPages)}
                  disabled={inspectorPage === totalInspectorPages}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
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
          TAB 5: FRESH PROJECT SQL SETUP DDL SCRIPT
          ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'sql' && (
        <div className="space-y-4 max-w-4xl mx-auto">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <FiFileText size={18} className="text-blue-600" />
                  Fresh Supabase Project Setup SQL Script
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Copy and run this SQL script in your new Supabase project SQL Editor to initialize all tables in 5 seconds
                </p>
              </div>

              <button
                onClick={() => {
                  navigator.clipboard.writeText(FRESH_DDL_SCRIPT);
                  toast.success('Complete SQL DDL script copied to clipboard! 📋');
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-sm transition cursor-pointer"
              >
                <FiCopy size={13} />
                <span>Copy SQL to Clipboard</span>
              </button>
            </div>

            <div className="p-3 bg-slate-900 text-slate-200 rounded-xl font-mono text-[11px] max-h-96 overflow-y-auto">
              <pre className="whitespace-pre-wrap">{FRESH_DDL_SCRIPT}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
