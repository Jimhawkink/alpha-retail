'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { logActivity } from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';
import toast, { Toaster } from 'react-hot-toast';
import {
    FiPackage,
    FiPlus,
    FiEdit2,
    FiTrash2,
    FiShoppingCart,
    FiDownload,
    FiRefreshCw,
    FiSearch,
    FiGrid,
    FiList,
    FiChevronLeft,
    FiChevronRight,
    FiX,
    FiUpload,
    FiCheck,
    FiAlertTriangle,
    FiTag,
    FiDollarSign,
    FiLayers,
    FiFilter,
    FiTrendingUp,
    FiImage,
    FiPrinter,
    FiZap,
    FiClock,
    FiSliders,
    FiEye,
    FiEyeOff,
    FiChevronsLeft,
    FiChevronsRight,
    FiFileText,
    FiBox,
    FiArrowRight,
    FiCheckCircle,
    FiShield,
    FiHash,
    FiActivity,
    FiBarChart2,
    FiPieChart,
    FiCalendar,
    FiHelpCircle,
    FiMaximize2,
    FiMinimize2,
    FiCopy,
    FiAward,
    FiTrendingDown,
    FiInfo,
    FiExternalLink,
    FiPercent,
    FiCheckSquare,
    FiSquare,
    FiArchive,
    FiTruck
} from 'react-icons/fi';

/* ══════════════════════════════════════════════════════════════════════════════
   TYPES & DEFAULT INTERFACES
   ══════════════════════════════════════════════════════════════════════════════ */
interface Product {
    pid: number;
    product_code: string;
    product_name: string;
    alias: string;
    vat_commodity: string;
    description: string;
    barcode: string;
    category: string;
    purchase_unit: string;
    sales_unit: string;
    purchase_cost: number;
    sales_cost: number;
    wholesale_price: number;
    reorder_point: number;
    margin_per: number;
    show_ps: boolean;
    button_ui_color: string;
    photo: string;
    hscode: string;
    batch_no: string;
    supplier_name: string;
    active: boolean;
    pieces_per_package: number;
    package_sales_cost?: number;
}

interface StockHistoryRow {
    id: number;
    date: string;
    ref: string;
    type: string;
    qty_in: number;
    qty_out: number;
    balance: number;
}

interface PriceHistoryRow {
    id: number;
    date: string;
    old_buy: number;
    new_buy: number;
    old_sell: number;
    new_sell: number;
}

interface Category {
    category_id: number;
    category_name: string;
    icon: string;
    color: string;
}

interface Supplier {
    supplier_id: number;
    supplier_code: string;
    supplier_name: string;
    is_kitchen?: boolean;
}

interface Unit {
    unit_id: number;
    unit_name: string;
    abbreviation: string;
}

interface ProductBatch {
    batch_id?: number;
    batch_number: string;
    expiry_date: string;
    qty_received: number;
    qty_remaining: number;
    cost_price: number;
    selling_price: number;
    supplier_name: string;
    isNew?: boolean;
    isEditing?: boolean;
}

interface BatchFormState {
    batch_number: string;
    expiry_date: string;
    qty_received: number;
    qty_remaining: number;
    cost_price: number;
    selling_price: number;
    supplier_name: string;
}

interface ChartDataPoint {
    pid: number;
    name: string;
    code: string;
    category: string;
    sellPrice: number;
    costPrice: number;
    wholesalePrice: number;
    marginKsh: number;
    marginPer: number;
    bigQtyPrice: number;
    stockPieces: number;
    stockBags: number;
    ratio: number;
}

interface CategoryValuationPoint {
    name: string;
    costVal: number;
    retailVal: number;
    profitVal: number;
    count: number;
    totalPieces: number;
    totalBags: number;
}

interface ExpiryAgingTier {
    tier: string;
    count: number;
    value: number;
    color: string;
}

/* ══════════════════════════════════════════════════════════════════════════════
   CONSTANTS & CONFIGURATION
   ══════════════════════════════════════════════════════════════════════════════ */
const defaultProduct: Omit<Product, 'pid' | 'product_code'> = {
    product_name: '',
    alias: '',
    vat_commodity: 'Standard',
    description: '',
    barcode: '',
    category: '',
    purchase_unit: 'Piece',
    sales_unit: 'Piece',
    purchase_cost: 0,
    sales_cost: 0,
    wholesale_price: 0,
    package_sales_cost: 0,
    reorder_point: 10,
    margin_per: 0,
    show_ps: true,
    button_ui_color: 'from-blue-400 to-blue-600',
    photo: '',
    hscode: '',
    batch_no: '',
    supplier_name: '',
    active: true,
    pieces_per_package: 1,
};

const UNIT_CONVERSIONS: Record<string, Record<string, number>> = {
    'Box': { 'Piece': 1, 'Box': 1 },
    'Pack': { 'Piece': 1, 'Pack': 1 },
    'Dozen': { 'Piece': 12, 'Dozen': 1 },
    'Kilogram': { 'Gram': 1000, 'Kilogram': 1 },
    'Liter': { 'Milliliter': 1000, 'Liter': 1 },
};

const vatOptions = ['Standard', 'Zero Rated', 'Exempt', 'Inclusive'];

const colorPresets = [
    { name: 'Orange Glow', gradient: 'from-orange-400 to-orange-600', hex: '#F97316', ring: 'ring-orange-500' },
    { name: 'Crimson Red', gradient: 'from-red-400 to-red-600', hex: '#EF4444', ring: 'ring-red-500' },
    { name: 'Sunset Amber', gradient: 'from-yellow-500 to-orange-500', hex: '#F59E0B', ring: 'ring-amber-500' },
    { name: 'Neon Pink', gradient: 'from-red-500 to-pink-600', hex: '#EC4899', ring: 'ring-pink-500' },
    { name: 'Deep Rose', gradient: 'from-rose-500 to-red-600', hex: '#F43F5E', ring: 'ring-rose-500' },
    { name: 'Emerald Forest', gradient: 'from-green-400 to-emerald-600', hex: '#10B981', ring: 'ring-emerald-500' },
    { name: 'Electric Yellow', gradient: 'from-yellow-400 to-yellow-600', hex: '#EAB308', ring: 'ring-yellow-500' },
    { name: 'Warm Amber', gradient: 'from-amber-400 to-amber-600', hex: '#F59E0B', ring: 'ring-amber-500' },
    { name: 'Royal Blue', gradient: 'from-blue-400 to-blue-600', hex: '#3B82F6', ring: 'ring-blue-500' },
    { name: 'Vibrant Cyan', gradient: 'from-cyan-400 to-cyan-600', hex: '#06B6D4', ring: 'ring-cyan-500' },
    { name: 'Lagoon Teal', gradient: 'from-teal-400 to-teal-600', hex: '#14B8A6', ring: 'ring-teal-500' },
    { name: 'Purple Galaxy', gradient: 'from-purple-400 to-purple-600', hex: '#A855F7', ring: 'ring-purple-500' },
    { name: 'Espresso Brown', gradient: 'from-amber-600 to-amber-800', hex: '#92400E', ring: 'ring-amber-700' },
    { name: 'Dark Burgundy', gradient: 'from-red-600 to-red-800', hex: '#DC2626', ring: 'ring-red-700' },
];

const defUnits: Unit[] = [
    { unit_id: 1, unit_name: 'Piece', abbreviation: 'Pc' },
    { unit_id: 2, unit_name: 'Kilogram', abbreviation: 'Kg' },
    { unit_id: 3, unit_name: 'Gram', abbreviation: 'g' },
    { unit_id: 4, unit_name: 'Liter', abbreviation: 'L' },
    { unit_id: 5, unit_name: 'Milliliter', abbreviation: 'ml' },
    { unit_id: 6, unit_name: 'Box', abbreviation: 'Box' },
    { unit_id: 7, unit_name: 'Pack', abbreviation: 'Pk' },
    { unit_id: 8, unit_name: 'Dozen', abbreviation: 'Dz' },
    { unit_id: 9, unit_name: 'Bottle', abbreviation: 'Btl' },
    { unit_id: 10, unit_name: 'Plate', abbreviation: 'Plt' },
];

/* ══════════════════════════════════════════════════════════════════════════════
   HELPER UTILITY FUNCTIONS
   ══════════════════════════════════════════════════════════════════════════════ */
function fmtK(n: number): string {
    if (!n || isNaN(n)) return '0';
    if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(1) + 'K';
    return Math.round(n).toLocaleString();
}

function fmtKES(n: number): string {
    if (!n || isNaN(n)) return 'Ksh 0';
    return 'Ksh ' + Math.round(n).toLocaleString();
}

function formatKsh(val: number): string {
    if (isNaN(val) || val === null || val === undefined) return '0.00';
    return Number(val).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatCompactNumber(val: number): string {
    if (isNaN(val) || val === null || val === undefined) return '0';
    if (Math.abs(val) >= 1_000_000) return (val / 1_000_000).toFixed(2) + 'M';
    if (Math.abs(val) >= 1_000) return (val / 1_000).toFixed(1) + 'K';
    return Number(val).toLocaleString('en-KE');
}

function calcMargin(sell: number, cost: number): number {
    if (!sell || sell <= 0) return 0;
    return Number((((sell - cost) / sell) * 100).toFixed(1));
}

function calcMarkup(sell: number, cost: number): number {
    if (!cost || cost <= 0) return 0;
    return Number((((sell - cost) / cost) * 100).toFixed(1));
}

function getBezierPath(points: { x: number; y: number }[]): string {
    if (!points || points.length === 0) return '';
    if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
    let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
    for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[i];
        const p1 = points[i + 1];
        const cp1x = (p0.x + (p1.x - p0.x) / 2).toFixed(1);
        const cp2x = cp1x;
        d += ` C ${cp1x} ${p0.y.toFixed(1)}, ${cp2x} ${p1.y.toFixed(1)}, ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
    }
    return d;
}

function getAreaPath(points: { x: number; y: number }[], baseY: number): string {
    if (!points || points.length === 0) return '';
    const linePath = getBezierPath(points);
    const first = points[0];
    const last = points[points.length - 1];
    return `${linePath} L ${last.x.toFixed(1)} ${baseY.toFixed(1)} L ${first.x.toFixed(1)} ${baseY.toFixed(1)} Z`;
}

function getBatchStatus(expiryDate: string): {
    label: string;
    daysLeft: number;
    color: string;
    bg: string;
    border: string;
    isExpired: boolean;
    isBlocked: boolean;
    isWarning: boolean;
    isSoon: boolean;
} {
    if (!expiryDate) {
        return {
            label: 'NO DATE',
            daysLeft: 9999,
            color: 'text-slate-500',
            bg: 'bg-slate-100',
            border: 'border-slate-200',
            isExpired: false,
            isBlocked: false,
            isWarning: false,
            isSoon: false,
        };
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const exp = new Date(expiryDate);
    const diffMs = exp.getTime() - today.getTime();
    const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    const isExpired = daysLeft < 0;
    const isBlocked = daysLeft <= 0;
    const isWarning = daysLeft >= 0 && daysLeft <= 30;
    const isSoon = daysLeft > 30 && daysLeft <= 60;

    if (isExpired) {
        return {
            label: `EXPIRED (${Math.abs(daysLeft)}d ago)`,
            daysLeft,
            color: 'text-rose-700',
            bg: 'bg-rose-50',
            border: 'border-rose-300',
            isExpired: true,
            isBlocked: true,
            isWarning: false,
            isSoon: false,
        };
    }
    if (isWarning) {
        return {
            label: `CRITICAL (${daysLeft}d left)`,
            daysLeft,
            color: 'text-amber-800',
            bg: 'bg-amber-100',
            border: 'border-amber-300',
            isExpired: false,
            isBlocked: false,
            isWarning: true,
            isSoon: false,
        };
    }
    if (isSoon) {
        return {
            label: `SOON (${daysLeft}d)`,
            daysLeft,
            color: 'text-amber-700',
            bg: 'bg-amber-50',
            border: 'border-amber-200',
            isExpired: false,
            isBlocked: false,
            isWarning: false,
            isSoon: true,
        };
    }
    return {
        label: `FRESH (${daysLeft}d)`,
        daysLeft,
        color: 'text-emerald-700',
        bg: 'bg-emerald-50',
        border: 'border-emerald-200',
        isExpired: false,
        isBlocked: false,
        isWarning: false,
        isSoon: false,
    };
}

async function fetchAllStock(outletId: number): Promise<Array<{ pid: number; qty: number; storage_type: string }>> {
    const PAGE_SIZE = 1000;
    let allRows: Array<{ pid: number; qty: number; storage_type: string }> = [];
    let page = 0;
    let hasMore = true;
    while (hasMore) {
        const from = page * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;
        const { data, error } = await supabase
            .from('retail_stock')
            .select('pid, qty, storage_type')
            .eq('outlet_id', outletId)
            .range(from, to);
        if (error) {
            console.error('Stock fetch page error:', page, error.message);
            break;
        }
        if (data && data.length > 0) allRows = allRows.concat(data);
        if (!data || data.length < PAGE_SIZE) hasMore = false;
        else page++;
    }
    return allRows;
}

function parseCSV(text: string): string[][] {
    const lines: string[][] = [];
    let row: string[] = [];
    let inQuotes = false;
    let cur = '';

    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        const next = text[i + 1];

        if (c === '"') {
            if (inQuotes && next === '"') {
                cur += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (c === ',' && !inQuotes) {
            row.push(cur);
            cur = '';
        } else if ((c === '\r' || c === '\n') && !inQuotes) {
            if (c === '\r' && next === '\n') i++;
            row.push(cur);
            cur = '';
            if (row.some(val => val.trim().length > 0)) {
                lines.push(row);
            }
            row = [];
        } else {
            cur += c;
        }
    }
    if (cur.length > 0 || row.length > 0) {
        row.push(cur);
        if (row.some(val => val.trim().length > 0)) lines.push(row);
    }
    return lines;
}


export default function ProductsPage() {
    const { activeOutlet, expiryEnabled } = useOutlet();
    const outletId = activeOutlet?.outlet_id || 1;

    // ─── CORE ENTITY STATES ───
    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [units, setUnits] = useState<Unit[]>(defUnits);
    const [companyName, setCompanyName] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    // ─── ADD / EDIT PRODUCT MODAL STATES ───
    const [showModal, setShowModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [previewPid, setPreviewPid] = useState<number | null>(null);
    const [previewCode, setPreviewCode] = useState<string>('');
    const [formData, setFormData] = useState(defaultProduct);
    const [isSaving, setIsSaving] = useState(false);
    const [openingBags, setOpeningBags] = useState(0);
    const [openingPieces, setOpeningPieces] = useState(0);
    const [costPerPieceOverride, setCostPerPieceOverride] = useState<number | null>(null);
    const [modalActiveTab, setModalActiveTab] = useState<'general' | 'stock' | 'pricing' | 'batches' | 'tax' | 'pos'>('general');

    // ─── SEARCH & FILTER STATES ───
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCategory, setFilterCategory] = useState('All');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
    const [showValuation, setShowValuation] = useState(true);
    const [showInactive, setShowInactive] = useState(false);
    const [selectedPids, setSelectedPids] = useState<Set<number>>(new Set());
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(20);
    const [isAddMode, setIsAddMode] = useState(false);

    // ─── FEATURE ACCESS CONTROL FLAGS ───
    const [hasRetailProfitFeature, setHasRetailProfitFeature] = useState(false);
    const [hasWholesaleProfitFeature, setHasWholesaleProfitFeature] = useState(false);
    const [hasValuationCardsFeature, setHasValuationCardsFeature] = useState(false);
    const hasValuationAccess = hasValuationCardsFeature;

    // ─── DUAL-STOCK LEDGER MAPS (By PID) ───
    const [stockData, setStockData] = useState<Record<number, number>>({});
    const [bagStockData, setBagStockData] = useState<Record<number, number>>({});
    const [pieceStockData, setPieceStockData] = useState<Record<number, number>>({});

    // ─── INTERACTIVE ANALYTICS & LINEAR TREND STUDIO STATES ───
    const [showAnalyticsStudio, setShowAnalyticsStudio] = useState(true);
    const [analyticsChartMode, setAnalyticsChartMode] = useState<'price_margin' | 'valuation_category' | 'expiry_horizon'>('price_margin');
    const [linearChartMetric, setLinearChartMetric] = useState<'all' | 'top_margin' | 'top_price' | 'low_stock'>('all');
    const [activeHoverIndex, setActiveHoverIndex] = useState<number | null>(null);
    const [activeValHoverIndex, setActiveValHoverIndex] = useState<number | null>(null);

    // ─── EXPIRY BATCH TRACKING STATES ───
    const [productBatches, setProductBatches] = useState<ProductBatch[]>([]);
    const [batchForm, setBatchForm] = useState<BatchFormState>({
        batch_number: '',
        expiry_date: '',
        qty_received: 0,
        qty_remaining: 0,
        cost_price: 0,
        selling_price: 0,
        supplier_name: '',
    });
    const [showBatchForm, setShowBatchForm] = useState(false);
    const [editingBatchIdx, setEditingBatchIdx] = useState<number | null>(null);

    // ─── BARCODE LABEL GENERATOR MODAL STATES ───
    const [showLabelModal, setShowLabelModal] = useState(false);
    const [labelProducts, setLabelProducts] = useState<number[]>([]);
    const [labelQty, setLabelQty] = useState<Record<number, number>>({});
    const [labelSearch, setLabelSearch] = useState('');
    const [labelSize, setLabelSize] = useState<'small' | 'medium' | 'large'>('medium');
    const [showLabelPreview, setShowLabelPreview] = useState(false);

    // ─── FAST ITEM LOOKUP MODAL STATES ───
    const [showLookupModal, setShowLookupModal] = useState(false);
    const [lookupQuery, setLookupQuery] = useState('');
    const [lookupResult, setLookupResult] = useState<Product | null>(null);

    // ─── STOCK HISTORY LEDGER MODAL STATES ───
    const [showStockHistoryModal, setShowStockHistoryModal] = useState(false);
    const [stockHistoryProduct, setStockHistoryProduct] = useState<Product | null>(null);
    const [stockHistory, setStockHistory] = useState<StockHistoryRow[]>([]);

    // ─── PRICE HISTORY TIMELINE MODAL STATES ───
    const [showPriceHistoryModal, setShowPriceHistoryModal] = useState(false);
    const [priceHistoryProduct, setPriceHistoryProduct] = useState<Product | null>(null);
    const [priceHistory, setPriceHistory] = useState<PriceHistoryRow[]>([]);

    // ─── DUAL-STOCK ADJUSTMENT MODAL STATES ───
    const [showStockAdjustModal, setShowStockAdjustModal] = useState(false);
    const [adjustProduct, setAdjustProduct] = useState<Product | null>(null);
    const [adjustBags, setAdjustBags] = useState(0);
    const [adjustPieces, setAdjustPieces] = useState(0);
    const [adjustType, setAdjustType] = useState<'add' | 'remove'>('add');
    const [adjustReason, setAdjustReason] = useState('Stocktake Audit Adjustment');

    // ─── CSV BATCH IMPORTER MODAL STATES ───
    const [showImportModal, setShowImportModal] = useState(false);
    const [importFile, setImportFile] = useState<File | null>(null);
    const [importMode, setImportMode] = useState<'overwrite' | 'update' | 'add_new'>('add_new');
    const [importProgress, setImportProgress] = useState(0);
    const [importTotal, setImportTotal] = useState(0);
    const [importCurrentItem, setImportCurrentItem] = useState('');
    const [importStatus, setImportStatus] = useState<'idle' | 'parsing' | 'importing' | 'success' | 'error'>('idle');
    const [importErrors, setImportErrors] = useState<string[]>([]);
    const [importSuccessCount, setImportSuccessCount] = useState(0);

    // ─── GLOBAL KEYBOARD SHORTCUTS (ACCESSIBILITY & PRODUCTIVITY) ───
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Avoid triggering shortcuts when typing inside form inputs or textareas
            const target = e.target as HTMLElement;
            const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';

            if (e.key === 'Escape') {
                if (showModal) setShowModal(false);
                if (showLookupModal) setShowLookupModal(false);
                if (showLabelModal) setShowLabelModal(false);
                if (showStockHistoryModal) setShowStockHistoryModal(false);
                if (showPriceHistoryModal) setShowPriceHistoryModal(false);
                if (showStockAdjustModal) setShowStockAdjustModal(false);
                if (showImportModal) setShowImportModal(false);
                return;
            }

            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n' && !isTyping) {
                e.preventDefault();
                openAddModal();
            } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k' && !isTyping) {
                e.preventDefault();
                setShowLookupModal(true);
            } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e' && !isTyping) {
                e.preventDefault();
                exportCSV();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [showModal, showLookupModal, showLabelModal, showStockHistoryModal, showPriceHistoryModal, showStockAdjustModal, showImportModal]);

    // ─── DATA LOADING: PRODUCTS ───
    const loadProducts = useCallback(async () => {
        if (!activeOutlet) return;
        setIsLoading(true);
        try {
            const PAGE = 1000;
            let allProducts: any[] = [];
            let from = 0;
            let keepGoing = true;
            while (keepGoing) {
                const { data, error } = await supabase
                    .from('retail_products')
                    .select('*')
                    .eq('outlet_id', outletId)
                    .order('pid', { ascending: false })
                    .range(from, from + PAGE - 1);

                if (error || !data?.length) break;
                allProducts = allProducts.concat(data);
                if (data.length < PAGE) keepGoing = false;
                from += PAGE;
            }
            setProducts(allProducts);
        } catch {
            toast.error('Failed to load products');
        }
        setIsLoading(false);

        if (typeof window !== 'undefined' && window.location.search.includes('action=add')) {
            setIsAddMode(true);
        }
    }, [activeOutlet, outletId]);

    // ─── DATA LOADING: STOCK LEDGER MAPS ───
    const loadStockData = useCallback(async () => {
        if (!activeOutlet) return;
        try {
            const data = await fetchAllStock(outletId);
            const total: Record<number, number> = {};
            const bags: Record<number, number> = {};
            const pcs: Record<number, number> = {};

            (data || []).forEach((s: any) => {
                const q = s.qty || 0;
                if (s.storage_type === 'Bags') {
                    bags[s.pid] = (bags[s.pid] || 0) + q;
                } else {
                    pcs[s.pid] = (pcs[s.pid] || 0) + q;
                }
                total[s.pid] = (total[s.pid] || 0) + q;
            });

            setStockData(total);
            setBagStockData(bags);
            setPieceStockData(pcs);
        } catch {
            /* silent */
        }
    }, [activeOutlet, outletId]);

    // ─── AUTO-CONVERT BULK PACKAGES TO LOOSE PIECES ───
    const autoConvertBigUnitsToPieces = useCallback(async (prodList: Product[]) => {
        if (!activeOutlet || !prodList || prodList.length === 0) return;
        try {
            const PAGE_SIZE = 1000;
            let allStockRows: any[] = [];
            let pageIdx = 0;
            let hasMore = true;
            while (hasMore) {
                const { data } = await supabase
                    .from('retail_stock')
                    .select('st_id, pid, qty, storage_type')
                    .eq('outlet_id', outletId)
                    .range(pageIdx * PAGE_SIZE, (pageIdx + 1) * PAGE_SIZE - 1);
                if (data && data.length > 0) allStockRows = allStockRows.concat(data);
                if (!data || data.length < PAGE_SIZE) hasMore = false;
                else pageIdx++;
            }

            const bigUnitRowsMap: Record<number, Array<{ st_id: number; qty: number }>> = {};
            const pieceRowsMap: Record<number, Array<{ st_id: number; qty: number }>> = {};
            allStockRows.forEach((row: any) => {
                const isBig = row.storage_type === 'Bags';
                const map = isBig ? bigUnitRowsMap : pieceRowsMap;
                if (!map[row.pid]) map[row.pid] = [];
                map[row.pid].push({ st_id: row.st_id, qty: row.qty || 0 });
            });

            const toConvert = prodList.filter((p: any) => {
                if ((p.pieces_per_package || 1) <= 1) return false;
                const totalPcs = (pieceRowsMap[p.pid] || []).reduce((s: number, r: any) => s + r.qty, 0);
                const totalBags = (bigUnitRowsMap[p.pid] || []).reduce((s: number, r: any) => s + r.qty, 0);
                return totalPcs <= 0 && totalBags > 0;
            });

            if (toConvert.length === 0) return;

            let converted = 0;
            for (const product of toConvert) {
                const ppp = product.pieces_per_package || 1;
                const bagRows = bigUnitRowsMap[product.pid] || [];
                const pcsRows = pieceRowsMap[product.pid] || [];

                const bagRow = bagRows.find((r: any) => r.qty > 0);
                if (!bagRow) continue;

                const { error: e1 } = await supabase
                    .from('retail_stock')
                    .update({ qty: bagRow.qty - 1 })
                    .eq('st_id', bagRow.st_id);
                if (e1) continue;

                const pcsRow = pcsRows[0];
                if (pcsRow) {
                    await supabase
                        .from('retail_stock')
                        .update({ qty: pcsRow.qty + ppp })
                        .eq('st_id', pcsRow.st_id);
                } else {
                    await supabase
                        .from('retail_stock')
                        .insert({ pid: product.pid, qty: ppp, storage_type: 'Pieces', outlet_id: outletId });
                }
                converted++;
            }

            if (converted > 0) {
                console.log(`📦 Auto-converted ${converted} product(s): 1 bulk unit → pieces`);
                await loadStockData();
            }
        } catch (e) {
            console.error('Auto-convert error:', e);
        }
    }, [activeOutlet, outletId, loadStockData]);

    // ─── DATA LOADING: CATEGORIES ───
    const loadCategories = useCallback(async () => {
        if (!activeOutlet) return;
        try {
            let { data, error } = await supabase
                .from('retail_categories')
                .select('*')
                .eq('active', true)
                .eq('outlet_id', outletId)
                .order('category_name');
            if (error || !data || data.length === 0) {
                const fb = await supabase.from('retail_categories').select('*').eq('active', true).order('category_name');
                data = fb.data;
            }
            setCategories(data || []);
        } catch {
            /* silent */
        }
    }, [activeOutlet, outletId]);

    // ─── DATA LOADING: SUPPLIERS ───
    const loadSuppliers = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('retail_suppliers')
                .select('supplier_id, supplier_code, supplier_name')
                .eq('active', true)
                .order('supplier_name');
            if (error) throw error;
            setSuppliers(data || []);
        } catch {
            /* silent */
        }
    }, []);

    // ─── DATA LOADING: UNITS ───
    const loadUnits = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('product_units')
                .select('unit_id, unit_name, abbreviation')
                .eq('active', true)
                .order('unit_name');
            if (error) throw error;
            setUnits(data || []);
        } catch {
            setUnits(defUnits);
        }
    }, []);

    // ─── DATA LOADING: COMPANY NAME ───
    const loadCompanyName = useCallback(async () => {
        try {
            const iv = (activeOutlet as any)?.company_id || (activeOutlet as any)?.outlet_id || 1;
            const { data } = await supabase.from('retail_companies').select('company_name').eq('id', iv).single();
            if (data?.company_name) setCompanyName(data.company_name);
        } catch {
            /* silent */
        }
    }, [activeOutlet]);

    // ─── DATA LOADING: FEATURE PERMISSIONS ───
    const checkFeatures = useCallback(async () => {
        try {
            const raw = localStorage.getItem('pos_user');
            if (!raw) return;
            const u = JSON.parse(raw);
            const t = u.token || u.user_id;
            const oid = activeOutlet?.outlet_id || u.outlet_id;
            if (!t) return;
            const { data } = await supabase.from('retail_users').select('features').eq('token', t).eq('outlet_id', oid).single();
            if (data?.features) {
                const features: string[] = Array.isArray(data.features) ? data.features : [];
                setHasRetailProfitFeature(features.includes('feature_retail_profit'));
                setHasWholesaleProfitFeature(features.includes('feature_wholesale_profit'));
                setHasValuationCardsFeature(features.includes('feature_valuation_cards'));
            }
        } catch {
            /* silent */
        }
    }, [activeOutlet]);

    useEffect(() => {
        loadProducts();
        loadStockData();
        loadCategories();
        loadSuppliers();
        loadUnits();
        loadCompanyName();
        checkFeatures();
    }, [loadProducts, loadStockData, loadCategories, loadSuppliers, loadUnits, loadCompanyName, checkFeatures]);

    useEffect(() => {
        if (products.length > 0) {
            autoConvertBigUnitsToPieces(products);
        }
    }, [products, autoConvertBigUnitsToPieces]);

    useEffect(() => {
        if (isAddMode && products.length > 0) {
            openAddModal();
            setIsAddMode(false);
        }
    }, [isAddMode, products]);


    // ─── UTILITY: KITCHEN SUPPLIER CHECK ───
    const getKitchenSupplier = () => {
        return suppliers.find(s => s.is_kitchen)?.supplier_name || 'Kitchen';
    };

    // ─── BARCODE & CODE GENERATION ───
    const generateBarcode = () => {
        return Math.floor(100000 + Math.random() * 900000).toString();
    };

    const generateProductCode = (maxPid: number) => {
        const nextPid = maxPid + 1;
        const ts = Date.now().toString().slice(-4);
        return `PRD-${nextPid}-${ts}`;
    };

    // ─── MODAL OPENERS ───
    const openAddModal = async () => {
        setEditingProduct(null);
        setOpeningBags(0);
        setOpeningPieces(0);
        setCostPerPieceOverride(null);
        setProductBatches([]);
        setShowBatchForm(false);
        setEditingBatchIdx(null);
        setModalActiveTab('general');

        let maxPid = 0;
        try {
            const { data } = await supabase
                .from('retail_products')
                .select('pid')
                .order('pid', { ascending: false })
                .limit(1);
            if (data && data.length > 0) maxPid = data[0].pid;
        } catch {
            maxPid = products.reduce((max, p) => Math.max(max, p.pid), 0);
        }
        const nextPid = maxPid + 1;
        setPreviewPid(nextPid);
        setPreviewCode(generateProductCode(maxPid));

        const bc = generateBarcode();
        setFormData({
            ...defaultProduct,
            barcode: bc,
            category: categories[0]?.category_name || '',
            supplier_name: getKitchenSupplier(),
            purchase_unit: 'Piece',
            sales_unit: 'Piece',
            pieces_per_package: 1,
            package_sales_cost: 0,
        });
        setShowModal(true);
    };

    const openEditModal = async (product: Product) => {
        setEditingProduct(product);
        setPreviewPid(product.pid);
        setPreviewCode(product.product_code);
        setCostPerPieceOverride(null);
        setModalActiveTab('general');

        const ppp = product.pieces_per_package || 1;
        const initialPkgCost = product.package_sales_cost ?? (ppp > 1 ? product.sales_cost * ppp : 0);

        setFormData({
            product_name: product.product_name,
            alias: product.alias || '',
            vat_commodity: product.vat_commodity || 'Standard',
            description: product.description || '',
            barcode: product.barcode || '',
            category: product.category || '',
            purchase_unit: product.purchase_unit || 'Piece',
            sales_unit: product.sales_unit || 'Piece',
            purchase_cost: product.purchase_cost || 0,
            sales_cost: product.sales_cost || 0,
            wholesale_price: product.wholesale_price || 0,
            package_sales_cost: initialPkgCost,
            reorder_point: product.reorder_point || 10,
            margin_per: product.margin_per || 0,
            show_ps: product.show_ps !== false,
            button_ui_color: product.button_ui_color || 'from-blue-400 to-blue-600',
            photo: product.photo || '',
            hscode: product.hscode || '',
            batch_no: product.batch_no || '',
            supplier_name: product.supplier_name || '',
            active: product.active !== false,
            pieces_per_package: ppp,
        });

        // Load existing batches for this product
        try {
            const { data: bData } = await supabase
                .from('retail_product_batches')
                .select('*')
                .eq('pid', product.pid)
                .order('expiry_date', { ascending: true });
            setProductBatches(bData || []);
        } catch {
            setProductBatches([]);
        }
        setShowBatchForm(false);
        setEditingBatchIdx(null);
        setShowModal(true);
    };

    // ─── EXPIRY BATCH MANAGEMENT HANDLERS ───
    const handleSaveBatch = () => {
        if (!batchForm.expiry_date) {
            toast.error('Expiry date is mandatory for batch tracking');
            return;
        }
        const bNum = batchForm.batch_number.trim() || `BAT-${Date.now().toString().slice(-6)}`;
        if (editingBatchIdx !== null) {
            setProductBatches(prev =>
                prev.map((b, idx) => (idx === editingBatchIdx ? { ...b, ...batchForm, batch_number: bNum, isEditing: true } : b))
            );
            toast.success('Batch details updated');
        } else {
            setProductBatches(prev => [
                ...prev,
                {
                    batch_number: bNum,
                    expiry_date: batchForm.expiry_date,
                    qty_received: Number(batchForm.qty_received) || 0,
                    qty_remaining: Number(batchForm.qty_remaining) || Number(batchForm.qty_received) || 0,
                    cost_price: Number(batchForm.cost_price) || 0,
                    selling_price: Number(batchForm.selling_price) || 0,
                    supplier_name: batchForm.supplier_name || formData.supplier_name || '',
                    isNew: true,
                },
            ]);
            toast.success('New batch queued for saving');
        }
        setBatchForm({ batch_number: '', expiry_date: '', qty_received: 0, qty_remaining: 0, cost_price: 0, selling_price: 0, supplier_name: '' });
        setShowBatchForm(false);
        setEditingBatchIdx(null);
    };

    const handleDeleteBatch = (idx: number) => {
        setProductBatches(prev => prev.filter((_, i) => i !== idx));
        toast.success('Batch removed from list');
    };

    const handleEditBatch = (idx: number) => {
        const b = productBatches[idx];
        setBatchForm({
            batch_number: b.batch_number,
            expiry_date: b.expiry_date,
            qty_received: b.qty_received,
            qty_remaining: b.qty_remaining,
            cost_price: b.cost_price,
            selling_price: b.selling_price,
            supplier_name: b.supplier_name,
        });
        setEditingBatchIdx(idx);
        setShowBatchForm(true);
    };

    // ─── FORM SUBMISSION (PRODUCT SAVE & STOCK WRITE) ───
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.product_name.trim()) {
            toast.error('Product name cannot be empty');
            return;
        }
        setIsSaving(true);
        try {
            const ppp = formData.pieces_per_package || 1;
            const costPerPiece = costPerPieceOverride !== null ? costPerPieceOverride : (ppp > 1 ? formData.purchase_cost / ppp : formData.purchase_cost);
            const margin = calcMargin(formData.sales_cost, costPerPiece);
            const pkgCost = formData.package_sales_cost ?? (ppp > 1 ? formData.sales_cost * ppp : 0);

            if (editingProduct) {
                // Update existing product
                const { error } = await supabase
                    .from('retail_products')
                    .update({
                        product_name: formData.product_name,
                        alias: formData.alias,
                        vat_commodity: formData.vat_commodity,
                        description: formData.description,
                        barcode: formData.barcode,
                        category: formData.category,
                        purchase_unit: formData.purchase_unit,
                        sales_unit: formData.sales_unit,
                        purchase_cost: formData.purchase_cost,
                        sales_cost: formData.sales_cost,
                        wholesale_price: formData.wholesale_price,
                        package_sales_cost: pkgCost,
                        reorder_point: formData.reorder_point,
                        margin_per: margin,
                        show_ps: formData.show_ps,
                        button_ui_color: formData.button_ui_color,
                        photo: formData.photo,
                        hscode: formData.hscode,
                        batch_no: formData.batch_no,
                        supplier_name: formData.supplier_name,
                        active: formData.active,
                        pieces_per_package: ppp,
                    })
                    .eq('pid', editingProduct.pid);

                if (error) throw error;

                // Sync batches if any modified
                for (const b of productBatches) {
                    if (b.isNew) {
                        await supabase.from('retail_product_batches').insert({
                            pid: editingProduct.pid,
                            batch_number: b.batch_number,
                            expiry_date: b.expiry_date,
                            qty_received: b.qty_received,
                            qty_remaining: b.qty_remaining,
                            cost_price: b.cost_price,
                            selling_price: b.selling_price,
                            supplier_name: b.supplier_name,
                            outlet_id: outletId,
                        });
                    } else if (b.batch_id && b.isEditing) {
                        await supabase
                            .from('retail_product_batches')
                            .update({
                                batch_number: b.batch_number,
                                expiry_date: b.expiry_date,
                                qty_received: b.qty_received,
                                qty_remaining: b.qty_remaining,
                                cost_price: b.cost_price,
                                selling_price: b.selling_price,
                                supplier_name: b.supplier_name,
                            })
                            .eq('batch_id', b.batch_id);
                    }
                }

                logActivity('PRODUCT_UPDATE', `Updated inventory product: ${formData.product_name} (${editingProduct.product_code})`);
                toast.success('Product updated successfully!');
            } else {
                // Insert new product
                let maxPid = 0;
                try {
                    const { data } = await supabase
                        .from('retail_products')
                        .select('pid')
                        .order('pid', { ascending: false })
                        .limit(1);
                    if (data && data.length > 0) maxPid = data[0].pid;
                } catch {
                    maxPid = products.reduce((max, p) => Math.max(max, p.pid), 0);
                }
                const newCode = previewCode || generateProductCode(maxPid);

                const { data: inserted, error: insertError } = await supabase
                    .from('retail_products')
                    .insert({
                        product_code: newCode,
                        product_name: formData.product_name,
                        alias: formData.alias,
                        vat_commodity: formData.vat_commodity,
                        description: formData.description,
                        barcode: formData.barcode,
                        category: formData.category,
                        purchase_unit: formData.purchase_unit,
                        sales_unit: formData.sales_unit,
                        purchase_cost: formData.purchase_cost,
                        sales_cost: formData.sales_cost,
                        wholesale_price: formData.wholesale_price,
                        package_sales_cost: pkgCost,
                        reorder_point: formData.reorder_point,
                        margin_per: margin,
                        show_ps: formData.show_ps,
                        button_ui_color: formData.button_ui_color,
                        photo: formData.photo,
                        hscode: formData.hscode,
                        batch_no: formData.batch_no,
                        supplier_name: formData.supplier_name,
                        active: formData.active,
                        pieces_per_package: ppp,
                        outlet_id: outletId,
                    })
                    .select()
                    .single();

                if (insertError) throw insertError;
                const newPid = inserted.pid;

                // Write opening stock for Bags and Pieces
                const stockInserts = [];
                if (openingBags > 0) {
                    stockInserts.push({
                        pid: newPid,
                        qty: openingBags,
                        storage_type: 'Bags',
                        outlet_id: outletId,
                    });
                }
                if (openingPieces > 0) {
                    stockInserts.push({
                        pid: newPid,
                        qty: openingPieces,
                        storage_type: 'Pieces',
                        outlet_id: outletId,
                    });
                }
                if (stockInserts.length > 0) {
                    await supabase.from('retail_stock').insert(stockInserts);
                }

                // Insert queued batches
                if (productBatches.length > 0) {
                    const batchInserts = productBatches.map(b => ({
                        pid: newPid,
                        batch_number: b.batch_number,
                        expiry_date: b.expiry_date,
                        qty_received: b.qty_received,
                        qty_remaining: b.qty_remaining,
                        cost_price: b.cost_price,
                        selling_price: b.selling_price,
                        supplier_name: b.supplier_name,
                        outlet_id: outletId,
                    }));
                    await supabase.from('retail_product_batches').insert(batchInserts);
                }

                logActivity('PRODUCT_CREATE', `Created new inventory product: ${formData.product_name} (${newCode})`);
                toast.success('Product created with opening inventory!');
            }

            setShowModal(false);
            await loadProducts();
            await loadStockData();
        } catch (err: any) {
            toast.error(err.message || 'Error occurred while saving product');
        }
        setIsSaving(false);
    };

    // ─── PRODUCT DELETION & TOGGLE STATUS ───
    const deleteProduct = async (product: Product) => {
        if (!confirm(`Are you sure you want to permanently delete "${product.product_name}"? This action cannot be undone.`)) return;
        try {
            await supabase.from('retail_stock').delete().eq('pid', product.pid).eq('outlet_id', outletId);
            await supabase.from('retail_product_batches').delete().eq('pid', product.pid).eq('outlet_id', outletId);
            const { error } = await supabase.from('retail_products').delete().eq('pid', product.pid);
            if (error) throw error;
            logActivity('PRODUCT_DELETE', `Deleted product: ${product.product_name} (${product.product_code})`);
            toast.success('Product deleted successfully');
            await loadProducts();
            await loadStockData();
        } catch (err: any) {
            toast.error(err.message || 'Failed to delete product');
        }
    };

    const deactivateProduct = async (product: Product) => {
        const nextState = !product.active;
        try {
            const { error } = await supabase.from('retail_products').update({ active: nextState }).eq('pid', product.pid);
            if (error) throw error;
            toast.success(`Product ${nextState ? 'activated' : 'deactivated'}`);
            setProducts(prev => prev.map(p => (p.pid === product.pid ? { ...p, active: nextState } : p)));
        } catch (err: any) {
            toast.error(err.message || 'Failed to update status');
        }
    };

    // ─── BULK SELECTION HANDLERS ───
    const toggleSelect = (pid: number) => {
        setSelectedPids(prev => {
            const next = new Set(prev);
            if (next.has(pid)) next.delete(pid);
            else next.add(pid);
            return next;
        });
    };

    const toggleSelectAll = (filteredList: Product[]) => {
        if (selectedPids.size === filteredList.length) {
            setSelectedPids(new Set());
        } else {
            setSelectedPids(new Set(filteredList.map(p => p.pid)));
        }
    };

    const bulkDeactivate = async () => {
        if (selectedPids.size === 0) return;
        if (!confirm(`Deactivate ${selectedPids.size} selected products?`)) return;
        try {
            const pids = Array.from(selectedPids);
            const { error } = await supabase.from('retail_products').update({ active: false }).in('pid', pids);
            if (error) throw error;
            toast.success(`${pids.length} products deactivated`);
            setSelectedPids(new Set());
            await loadProducts();
        } catch (err: any) {
            toast.error(err.message || 'Bulk deactivate failed');
        }
    };

    const bulkDelete = async () => {
        if (selectedPids.size === 0) return;
        if (!confirm(`PERMANENTLY delete ${selectedPids.size} selected products and their stock?`)) return;
        try {
            const pids = Array.from(selectedPids);
            await supabase.from('retail_stock').delete().in('pid', pids).eq('outlet_id', outletId);
            const { error } = await supabase.from('retail_products').delete().in('pid', pids);
            if (error) throw error;
            toast.success(`${pids.length} products deleted`);
            setSelectedPids(new Set());
            await loadProducts();
            await loadStockData();
        } catch (err: any) {
            toast.error(err.message || 'Bulk delete failed');
        }
    };

    // ─── CSV EXPORT ───
    const exportCSV = () => {
        const headers = [
            'PID',
            'Product Code',
            'Product Name',
            'Alias',
            'Category',
            'Barcode',
            'Buy Unit',
            'Sell Unit',
            'Pcs Per Pkg',
            'Buy Price (Ksh)',
            'Cost Per Pc (Ksh)',
            'Sell Price (Ksh)',
            'Big Qty Price (Ksh)',
            'Wholesale (Ksh)',
            'Margin %',
            'Bags Stock',
            'Pieces Stock',
            'Total Stock',
            'Active',
        ];

        const rows = products.map(p => {
            const ppp = p.pieces_per_package || 1;
            const cpp = ppp > 1 ? (p.purchase_cost / ppp).toFixed(2) : p.purchase_cost.toFixed(2);
            const bigPrice = p.package_sales_cost ?? (ppp > 1 ? (p.sales_cost * ppp).toFixed(2) : '0.00');
            return [
                p.pid,
                `"${p.product_code}"`,
                `"${p.product_name.replace(/"/g, '""')}"`,
                `"${(p.alias || '').replace(/"/g, '""')}"`,
                `"${p.category || ''}"`,
                `"${p.barcode || ''}"`,
                p.purchase_unit,
                p.sales_unit,
                ppp,
                p.purchase_cost,
                cpp,
                p.sales_cost,
                bigPrice,
                p.wholesale_price,
                p.margin_per,
                bagStockData[p.pid] || 0,
                pieceStockData[p.pid] || 0,
                stockData[p.pid] || 0,
                p.active ? 'Yes' : 'No',
            ];
        });

        const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `inventory-catalog-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success(`Exported ${products.length} catalog items to CSV`);
    };

    // ─── STOCK & PRICE HISTORY AUDIT MODALS ───
    const openStockHistory = async (p: Product) => {
        setStockHistoryProduct(p);
        setShowStockHistoryModal(true);
        try {
            const { data } = await supabase
                .from('retail_stock_movements')
                .select('*')
                .eq('pid', p.pid)
                .order('id', { ascending: false })
                .limit(40);
            setStockHistory(data || []);
        } catch {
            setStockHistory([]);
        }
    };

    const openPriceHistory = async (p: Product) => {
        setPriceHistoryProduct(p);
        setShowPriceHistoryModal(true);
        try {
            const { data } = await supabase
                .from('retail_price_history')
                .select('*')
                .eq('pid', p.pid)
                .order('id', { ascending: false })
                .limit(30);
            setPriceHistory(data || []);
        } catch {
            setPriceHistory([]);
        }
    };

    // ─── DUAL-STOCK ADJUSTMENT HANDLER ───
    const openStockAdjust = (p: Product) => {
        setAdjustProduct(p);
        setAdjustBags(0);
        setAdjustPieces(0);
        setAdjustType('add');
        setAdjustReason('Physical Stocktake Audit');
        setShowStockAdjustModal(true);
    };

    const submitStockAdjust = async () => {
        if (!adjustProduct) return;
        if (adjustBags === 0 && adjustPieces === 0) {
            toast.error('Enter at least 1 bag or 1 piece to adjust');
            return;
        }
        try {
            const mult = adjustType === 'add' ? 1 : -1;
            if (adjustBags > 0) {
                const curBags = bagStockData[adjustProduct.pid] || 0;
                const newBags = Math.max(0, curBags + adjustBags * mult);
                await supabase
                    .from('retail_stock')
                    .upsert(
                        { pid: adjustProduct.pid, qty: newBags, storage_type: 'Bags', outlet_id: outletId },
                        { onConflict: 'pid,storage_type,outlet_id' }
                    );
            }
            if (adjustPieces > 0) {
                const curPieces = pieceStockData[adjustProduct.pid] || 0;
                const newPieces = Math.max(0, curPieces + adjustPieces * mult);
                await supabase
                    .from('retail_stock')
                    .upsert(
                        { pid: adjustProduct.pid, qty: newPieces, storage_type: 'Pieces', outlet_id: outletId },
                        { onConflict: 'pid,storage_type,outlet_id' }
                    );
            }

            logActivity('STOCK_ADJUST', `Stock adjusted for ${adjustProduct.product_name}: ${adjustType} (${adjustBags} bags, ${adjustPieces} pcs) - Reason: ${adjustReason}`);
            toast.success('Inventory balance adjusted successfully');
            setShowStockAdjustModal(false);
            await loadStockData();
        } catch (err: any) {
            toast.error(err.message || 'Failed to adjust stock');
        }
    };

    // ─── BARCODE LABEL GENERATOR ───
    const openLabelModal = (p?: Product) => {
        if (p) {
            setLabelProducts([p.pid]);
            setLabelQty({ [p.pid]: 1 });
        } else if (selectedPids.size > 0) {
            setLabelProducts(Array.from(selectedPids));
            const q: Record<number, number> = {};
            selectedPids.forEach(id => {
                q[id] = 1;
            });
            setLabelQty(q);
        } else {
            setLabelProducts([]);
            setLabelQty({});
        }
        setShowLabelModal(true);
    };

    const printLabels = () => {
        const selected = products.filter(p => labelProducts.includes(p.pid));
        if (selected.length === 0) {
            toast.error('Select at least one product for barcode generation');
            return;
        }

        const sizeStyles = {
            small: 'width: 38mm; height: 25mm; font-size: 8px; padding: 2mm;',
            medium: 'width: 50mm; height: 30mm; font-size: 10px; padding: 3mm;',
            large: 'width: 70mm; height: 40mm; font-size: 12px; padding: 4mm;',
        };

        let labelHtml = '';
        selected.forEach(p => {
            const count = labelQty[p.pid] || 1;
            for (let i = 0; i < count; i++) {
                labelHtml += `
                    <div style="${sizeStyles[labelSize]} border: 1px dashed #cbd5e1; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; justify-content: space-between; page-break-inside: avoid; text-align: center; font-family: monospace;">
                        <div style="font-weight: 900; text-transform: uppercase; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; max-width: 100%; font-size: 11px;">
                            ${companyName || 'ALPHA RETAIL'}
                        </div>
                        <div style="font-weight: bold; overflow: hidden; max-height: 2.2em; line-height: 1.1; margin: 2px 0;">
                            ${p.product_name}
                        </div>
                        <div style="font-size: 14px; font-weight: 900; color: #000;">
                            Ksh ${formatKsh(p.sales_cost)}
                        </div>
                        <div style="letter-spacing: 3px; font-size: 11px; font-weight: bold; border-top: 1px solid #000; padding-top: 1px; width: 85%;">
                            *${p.barcode || p.product_code}*
                        </div>
                        <div style="font-size: 8px; color: #64748b;">
                            ${p.product_code}
                        </div>
                    </div>
                `;
            }
        });

        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            toast.error('Please allow popups to print barcode labels');
            return;
        }
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
                <head>
                    <title>Barcode Labels - ${companyName || 'Alpha Retail'}</title>
                    <style>
                        @page { margin: 5mm; }
                        body { margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 3mm; background: #fff; }
                        @media print { body { gap: 0; } }
                    </style>
                </head>
                <body>
                    ${labelHtml}
                    <script>
                        window.onload = function() { window.print(); }
                    </script>
                </body>
            </html>
        `);
        printWindow.document.close();
    };

    // ─── FAST ITEM LOOKUP ───
    const openLookupModal = () => {
        setLookupQuery('');
        setLookupResult(null);
        setShowLookupModal(true);
    };

    const doLookup = (q: string) => {
        setLookupQuery(q);
        const query = q.trim().toLowerCase();
        if (!query) {
            setLookupResult(null);
            return;
        }
        const match = products.find(
            p =>
                p.barcode?.toLowerCase() === query ||
                p.product_code?.toLowerCase() === query ||
                p.product_name?.toLowerCase().includes(query) ||
                p.alias?.toLowerCase().includes(query)
        );
        setLookupResult(match || null);
    };

    // ─── CSV BATCH IMPORTER ───
    const importProducts = async () => {
        if (!importFile) {
            toast.error('Select a CSV file first');
            return;
        }
        setImportStatus('parsing');
        setImportErrors([]);
        setImportProgress(0);

        try {
            const text = await importFile.text();
            const rows = parseCSV(text);
            if (rows.length < 2) {
                toast.error('CSV file has no valid data rows');
                setImportStatus('idle');
                return;
            }

            const headerRow = rows[0].map(h => h.trim().toLowerCase().replace(/[\s_]+/g, ''));
            const dataRows = rows.slice(1);
            setImportTotal(dataRows.length);
            setImportStatus('importing');

            const nameIdx = headerRow.findIndex(h => h.includes('name') || h.includes('productname') || h.includes('item'));
            const costIdx = headerRow.findIndex(h => h.includes('buy') || h.includes('cost') || h.includes('purchaseprice'));
            const sellIdx = headerRow.findIndex(h => h.includes('sell') || h.includes('retail') || h.includes('price'));
            const codeIdx = headerRow.findIndex(h => h.includes('code') || h.includes('sku') || h.includes('itemcode'));
            const catIdx = headerRow.findIndex(h => h.includes('cat') || h.includes('category'));
            const barIdx = headerRow.findIndex(h => h.includes('bar') || h.includes('barcode'));
            const pppIdx = headerRow.findIndex(h => h.includes('pcs') || h.includes('ratio') || h.includes('pkg'));
            const bigPriceIdx = headerRow.findIndex(h => h.includes('big') || h.includes('box') || h.includes('packageprice'));
            const wsIdx = headerRow.findIndex(h => h.includes('wholesale') || h.includes('ws'));

            if (nameIdx === -1) {
                toast.error('Missing required "Product Name" column in CSV');
                setImportStatus('idle');
                return;
            }

            let success = 0;
            const errs: string[] = [];

            for (let i = 0; i < dataRows.length; i++) {
                const r = dataRows[i];
                const rawName = r[nameIdx]?.trim();
                if (!rawName) continue;

                setImportCurrentItem(rawName);
                setImportProgress(Math.round(((i + 1) / dataRows.length) * 100));

                const pCost = costIdx !== -1 ? parseFloat(r[costIdx]) || 0 : 0;
                const sCost = sellIdx !== -1 ? parseFloat(r[sellIdx]) || 0 : 0;
                const pCode = codeIdx !== -1 && r[codeIdx]?.trim() ? r[codeIdx].trim() : `PRD-IMP-${Date.now().toString().slice(-4)}-${i}`;
                const pCat = catIdx !== -1 && r[catIdx]?.trim() ? r[catIdx].trim() : 'General';
                const pBar = barIdx !== -1 && r[barIdx]?.trim() ? r[barIdx].trim() : generateBarcode();
                const ppp = pppIdx !== -1 ? parseInt(r[pppIdx], 10) || 1 : 1;
                const bigPrice = bigPriceIdx !== -1 ? parseFloat(r[bigPriceIdx]) || 0 : ppp > 1 ? sCost * ppp : 0;
                const wsPrice = wsIdx !== -1 ? parseFloat(r[wsIdx]) || 0 : 0;

                const costPerPiece = ppp > 1 ? pCost / ppp : pCost;
                const margin = calcMargin(sCost, costPerPiece);

                const existing = products.find(
                    p => p.barcode === pBar || p.product_code === pCode || p.product_name.toLowerCase() === rawName.toLowerCase()
                );

                if (existing && importMode === 'add_new') {
                    // Skip or log
                    errs.push(`Row ${i + 2}: "${rawName}" already exists (skipped in Add-New mode)`);
                    continue;
                }

                if (existing && (importMode === 'update' || importMode === 'overwrite')) {
                    const { error } = await supabase
                        .from('retail_products')
                        .update({
                            product_name: rawName,
                            purchase_cost: pCost,
                            sales_cost: sCost,
                            wholesale_price: wsPrice,
                            package_sales_cost: bigPrice,
                            pieces_per_package: ppp,
                            margin_per: margin,
                            category: pCat,
                        })
                        .eq('pid', existing.pid);
                    if (error) errs.push(`Row ${i + 2}: ${error.message}`);
                    else success++;
                } else {
                    const { error } = await supabase.from('retail_products').insert({
                        product_code: pCode,
                        product_name: rawName,
                        barcode: pBar,
                        category: pCat,
                        purchase_cost: pCost,
                        sales_cost: sCost,
                        wholesale_price: wsPrice,
                        package_sales_cost: bigPrice,
                        pieces_per_package: ppp,
                        margin_per: margin,
                        purchase_unit: 'Piece',
                        sales_unit: 'Piece',
                        reorder_point: 10,
                        active: true,
                        outlet_id: outletId,
                    });
                    if (error) errs.push(`Row ${i + 2}: ${error.message}`);
                    else success++;
                }
            }

            setImportSuccessCount(success);
            setImportErrors(errs);
            setImportStatus('success');
            toast.success(`Import complete: ${success} products processed!`);
            await loadProducts();
            await loadStockData();
        } catch (err: any) {
            setImportStatus('error');
            toast.error(err.message || 'Import failed');
        }
    };


    // ─── FILTERED & PAGINATED LISTS ───
    const filtered = useMemo(() => {
        return products.filter(p => {
            const matchesSearch =
                p.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.product_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (p.barcode && p.barcode.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (p.alias && p.alias.toLowerCase().includes(searchQuery.toLowerCase()));
            const matchesCategory = filterCategory === 'All' || p.category === filterCategory;
            const matchesActive = showInactive ? true : p.active !== false;
            return matchesSearch && matchesCategory && matchesActive;
        });
    }, [products, searchQuery, filterCategory, showInactive]);

    const totalPages = Math.ceil(filtered.length / perPage);
    const paginated = useMemo(() => {
        const start = (page - 1) * perPage;
        return filtered.slice(start, start + perPage);
    }, [filtered, page, perPage]);

    // ─── KEY METRICS & VALUATION CALCULATIONS ───
    const activeProducts = useMemo(() => products.filter(p => p.active !== false), [products]);
    const lowStock = useMemo(
        () => products.filter(p => (stockData[p.pid] || 0) <= (p.reorder_point || 10)),
        [products, stockData]
    );

    const { stockValCost, stockValRetail, stockValWholesale, stockRetailProfit, stockWholesaleProfit } = useMemo(() => {
        let costSum = 0;
        let retailSum = 0;
        let wholesaleSum = 0;

        products.forEach(p => {
            const ppp = p.pieces_per_package || 1;
            const cpp = ppp > 1 ? p.purchase_cost / ppp : p.purchase_cost;
            const b = bagStockData[p.pid] || 0;
            const pc = pieceStockData[p.pid] || 0;

            const itemCost = b * p.purchase_cost + pc * cpp;
            costSum += itemCost;

            const pkgSell = p.package_sales_cost && p.package_sales_cost > 0 ? p.package_sales_cost : p.sales_cost * ppp;
            const itemRetail = b * pkgSell + pc * p.sales_cost;
            retailSum += itemRetail;

            const wsPrice = p.wholesale_price && p.wholesale_price > 0 ? p.wholesale_price : p.sales_cost;
            const itemWs = b * wsPrice * ppp + pc * wsPrice;
            wholesaleSum += itemWs;
        });

        return {
            stockValCost: costSum,
            stockValRetail: retailSum,
            stockValWholesale: wholesaleSum,
            stockRetailProfit: Math.max(0, retailSum - costSum),
            stockWholesaleProfit: Math.max(0, wholesaleSum - costSum),
        };
    }, [products, bagStockData, pieceStockData]);

    // ─── SPARKLINE GENERATOR FOR STAT CARDS ───
    const sparkPath = useCallback((values: number[], width = 90, height = 28) => {
        if (!values || values.length === 0) return '';
        const min = Math.min(...values);
        const max = Math.max(...values);
        const range = max - min || 1;
        const pts = values.map((v, i) => {
            const x = (i / (values.length - 1)) * width;
            const y = height - ((v - min) / range) * (height - 6) - 3;
            return { x, y };
        });
        return getBezierPath(pts);
    }, []);

    // ─── LINEAR PRICE & PROFIT TREND CHART DATA (CHART 1) ───
    const linearPriceChart = useMemo(() => {
        let baseList = [...products].filter(p => p.sales_cost > 0);

        if (linearChartMetric === 'top_margin') {
            baseList.sort((a, b) => b.margin_per - a.margin_per);
        } else if (linearChartMetric === 'top_price') {
            baseList.sort((a, b) => b.sales_cost - a.sales_cost);
        } else if (linearChartMetric === 'low_stock') {
            baseList.sort((a, b) => (stockData[a.pid] || 0) - (stockData[b.pid] || 0));
        } else {
            // Default: sort by sales cost descending
            baseList.sort((a, b) => b.sales_cost - a.sales_cost);
        }

        const items = baseList.slice(0, 12);
        if (items.length === 0) return null;

        const maxPrice = Math.max(...items.map(p => Math.max(p.sales_cost, p.purchase_cost, p.wholesale_price || 0)), 100);
        const svgW = 540;
        const svgH = 190;
        const padT = 18;
        const padB = 30;
        const padL = 46;
        const padR = 20;
        const plotW = svgW - padL - padR;
        const plotH = svgH - padT - padB;

        const sellPts: { x: number; y: number }[] = [];
        const costPts: { x: number; y: number }[] = [];
        const wsPts: { x: number; y: number }[] = [];

        const pointsData: ChartDataPoint[] = items.map((p, idx) => {
            const ppp = p.pieces_per_package || 1;
            const cpp = ppp > 1 ? p.purchase_cost / ppp : p.purchase_cost;
            const ws = p.wholesale_price || p.sales_cost * 0.9;
            const x = padL + (idx / Math.max(items.length - 1, 1)) * plotW;
            const ySell = padT + plotH - (p.sales_cost / maxPrice) * plotH;
            const yCost = padT + plotH - (cpp / maxPrice) * plotH;
            const yWs = padT + plotH - (ws / maxPrice) * plotH;

            sellPts.push({ x, y: ySell });
            costPts.push({ x, y: yCost });
            wsPts.push({ x, y: yWs });

            return {
                pid: p.pid,
                name: p.product_name,
                code: p.product_code,
                category: p.category,
                sellPrice: p.sales_cost,
                costPrice: cpp,
                wholesalePrice: ws,
                marginKsh: p.sales_cost - cpp,
                marginPer: calcMargin(p.sales_cost, cpp),
                bigQtyPrice: p.package_sales_cost || p.sales_cost * ppp,
                stockPieces: pieceStockData[p.pid] || 0,
                stockBags: bagStockData[p.pid] || 0,
                ratio: ppp,
            };
        });

        // Compute closed profit area path between sell line and cost line
        let profitAreaPath = '';
        if (sellPts.length > 0 && costPts.length > 0) {
            const sellBezier = getBezierPath(sellPts);
            // Walk backwards along cost points
            const revCost = [...costPts].reverse();
            let backPath = '';
            for (let i = 0; i < revCost.length; i++) {
                backPath += ` L ${revCost[i].x.toFixed(1)} ${revCost[i].y.toFixed(1)}`;
            }
            profitAreaPath = `${sellBezier}${backPath} Z`;
        }

        const highestMarginItem = [...pointsData].sort((a, b) => b.marginPer - a.marginPer)[0];
        const lowestMarginItem = [...pointsData].sort((a, b) => a.marginPer - b.marginPer)[0];
        const avgMargin = (pointsData.reduce((s, p) => s + p.marginPer, 0) / pointsData.length).toFixed(1);

        return {
            svgW,
            svgH,
            padL,
            padR,
            padT,
            padB,
            plotW,
            plotH,
            maxPrice,
            sellPath: getBezierPath(sellPts),
            costPath: getBezierPath(costPts),
            wsPath: getBezierPath(wsPts),
            profitAreaPath,
            sellPts,
            costPts,
            wsPts,
            pointsData,
            highestMarginItem,
            lowestMarginItem,
            avgMargin,
        };
    }, [products, linearChartMetric, pieceStockData, bagStockData, stockData]);

    // ─── CATEGORY VALUATION & ASSET SPREAD CHART DATA (CHART 2) ───
    const categoryValuationChart = useMemo(() => {
        const catMap: Record<string, { cost: number; retail: number; pieces: number; bags: number; count: number }> = {};

        products.forEach(p => {
            const cat = p.category || 'General';
            if (!catMap[cat]) catMap[cat] = { cost: 0, retail: 0, pieces: 0, bags: 0, count: 0 };
            const ppp = p.pieces_per_package || 1;
            const cpp = ppp > 1 ? p.purchase_cost / ppp : p.purchase_cost;
            const b = bagStockData[p.pid] || 0;
            const pc = pieceStockData[p.pid] || 0;

            const cVal = b * p.purchase_cost + pc * cpp;
            const rVal = b * (p.package_sales_cost || p.sales_cost * ppp) + pc * p.sales_cost;

            catMap[cat].cost += cVal;
            catMap[cat].retail += rVal;
            catMap[cat].pieces += pc;
            catMap[cat].bags += b;
            catMap[cat].count += 1;
        });

        const catList: CategoryValuationPoint[] = Object.keys(catMap)
            .map(k => ({
                name: k,
                costVal: catMap[k].cost,
                retailVal: catMap[k].retail,
                profitVal: Math.max(0, catMap[k].retail - catMap[k].cost),
                count: catMap[k].count,
                totalPieces: catMap[k].pieces,
                totalBags: catMap[k].bags,
            }))
            .sort((a, b) => b.retailVal - a.retailVal)
            .slice(0, 8);

        if (catList.length === 0) return null;

        const maxVal = Math.max(...catList.map(c => Math.max(c.retailVal, c.costVal)), 1000);
        const svgW = 540;
        const svgH = 190;
        const padT = 18;
        const padB = 30;
        const padL = 52;
        const padR = 20;
        const plotW = svgW - padL - padR;
        const plotH = svgH - padT - padB;

        const retailPts: { x: number; y: number }[] = [];
        const costPts: { x: number; y: number }[] = [];

        catList.forEach((c, idx) => {
            const x = padL + (idx / Math.max(catList.length - 1, 1)) * plotW;
            const yRetail = padT + plotH - (c.retailVal / maxVal) * plotH;
            const yCost = padT + plotH - (c.costVal / maxVal) * plotH;
            retailPts.push({ x, y: yRetail });
            costPts.push({ x, y: yCost });
        });

        const topCapitalCategory = [...catList].sort((a, b) => b.costVal - a.costVal)[0];
        const topRevenueCategory = [...catList].sort((a, b) => b.retailVal - a.retailVal)[0];
        const totalCatCost = catList.reduce((s, c) => s + c.costVal, 0);
        const totalCatRetail = catList.reduce((s, c) => s + c.retailVal, 0);

        return {
            svgW,
            svgH,
            padL,
            padR,
            padT,
            padB,
            plotW,
            plotH,
            maxVal,
            retailPath: getBezierPath(retailPts),
            costPath: getBezierPath(costPts),
            retailAreaPath: getAreaPath(retailPts, padT + plotH),
            costAreaPath: getAreaPath(costPts, padT + plotH),
            retailPts,
            costPts,
            catList,
            topCapitalCategory,
            topRevenueCategory,
            totalCatCost,
            totalCatRetail,
        };
    }, [products, bagStockData, pieceStockData]);

    // ─── EXPIRY HORIZON AGING DISTRIBUTION ───
    const expiryHorizon = useMemo(() => {
        let expiredVal = 0;
        let warningVal = 0;
        let soonVal = 0;
        let freshVal = 0;

        let expiredCount = 0;
        let warningCount = 0;
        let soonCount = 0;
        let freshCount = 0;

        productBatches.forEach(b => {
            const status = getBatchStatus(b.expiry_date);
            const val = b.qty_remaining * b.cost_price;
            if (status.isExpired) {
                expiredVal += val;
                expiredCount += b.qty_remaining;
            } else if (status.isWarning) {
                warningVal += val;
                warningCount += b.qty_remaining;
            } else if (status.isSoon) {
                soonVal += val;
                soonCount += b.qty_remaining;
            } else {
                freshVal += val;
                freshCount += b.qty_remaining;
            }
        });

        return {
            expiredVal,
            expiredCount,
            warningVal,
            warningCount,
            soonVal,
            soonCount,
            freshVal,
            freshCount,
            totalValAtRisk: expiredVal + warningVal,
        };
    }, [productBatches]);


    return (
        <div className="-mt-2 sm:-mt-3.5 pt-0 space-y-2.5 pb-8 text-slate-800">
            <Toaster position="top-right" />

            {/* ━━━ TOP EXECUTIVE COMMAND BAR (SINGLE-LINE SCREEN-FITTING WITH SMALL FONTS & NO DUPLICATE ICONS) ━━━ */}
            <div className="bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl shadow-xs px-3 py-1.5 transition-all">
                <div className="flex items-center justify-between gap-2 overflow-x-auto scrollbar-none">
                    
                    {/* Brand & Inventory Scope Pill (Small fonts fitting in one line) */}
                    <div className="flex items-center gap-2 shrink-0">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-blue-600 via-indigo-600 to-sky-500 flex items-center justify-center text-white font-black shadow-xs">
                            <FiPackage size={14} />
                        </div>
                        <div className="leading-tight">
                            <div className="flex items-center gap-1.5">
                                <h1 className="text-xs font-black tracking-tight text-slate-900 whitespace-nowrap">
                                    Inventory Catalog &amp; Stock Ledger
                                </h1>
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                                    v2.6
                                </span>
                            </div>
                            <div className="text-[10px] font-semibold text-slate-400 flex items-center gap-1.5 whitespace-nowrap">
                                <span className="text-slate-600">{companyName || 'Alpha Retail'}</span>
                                <span>•</span>
                                <span className="font-mono text-slate-700 font-bold">{products.length} SKUs</span>
                                <span>•</span>
                                <span className="text-emerald-600 font-bold">● Active Matrix</span>
                            </div>
                        </div>
                    </div>

                    {/* Quick Action Toolbar - Clean single icons, NO DUPLICATE EMOJIS! */}
                    <div className="flex items-center gap-1 shrink-0">
                        <button
                            onClick={() => {
                                loadProducts();
                                loadStockData();
                                toast.success('Catalog data refreshed');
                            }}
                            className="px-2 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-bold transition-all shadow-2xs hover:border-slate-300 flex items-center gap-1"
                            title="Refresh Catalog Data"
                        >
                            <FiRefreshCw size={11} className={isLoading ? 'animate-spin text-blue-600' : 'text-slate-500'} />
                            <span>Refresh</span>
                        </button>

                        <button
                            onClick={() => openLabelModal()}
                            className="px-2 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-bold transition-all shadow-2xs hover:border-slate-300 flex items-center gap-1"
                            title="Print Barcode Labels (Ctrl+L)"
                        >
                            <FiPrinter size={11} className="text-indigo-600" />
                            <span>Labels</span>
                        </button>

                        <button
                            onClick={openLookupModal}
                            className="px-2 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-bold transition-all shadow-2xs hover:border-slate-300 flex items-center gap-1"
                            title="Fast Barcode Lookup (Ctrl+K)"
                        >
                            <FiSearch size={11} className="text-sky-600" />
                            <span>Lookup</span>
                        </button>

                        <button
                            onClick={() => setShowAnalyticsStudio(prev => !prev)}
                            className={`px-2 py-1 rounded-lg border text-[11px] font-bold transition-all shadow-2xs flex items-center gap-1 ${
                                showAnalyticsStudio
                                    ? 'bg-blue-50 border-blue-300 text-blue-700'
                                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                            }`}
                            title="Toggle Linear Trend Charts Studio"
                        >
                            <FiBarChart2 size={11} className="text-blue-600" />
                            <span>{showAnalyticsStudio ? 'Charts On' : 'Charts'}</span>
                        </button>

                        <button
                            onClick={exportCSV}
                            className="px-2 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-bold transition-all shadow-2xs hover:border-slate-300 flex items-center gap-1"
                            title="Export Catalog to CSV (Ctrl+E)"
                        >
                            <FiDownload size={11} className="text-emerald-600" />
                            <span>Export</span>
                        </button>

                        <button
                            onClick={() => setShowInactive(prev => !prev)}
                            className={`px-2 py-1 rounded-lg border text-[11px] font-bold transition-all shadow-2xs flex items-center gap-1 ${
                                showInactive
                                    ? 'bg-amber-50 border-amber-300 text-amber-700'
                                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                            }`}
                            title="Show / Hide Inactive SKUs"
                        >
                            {showInactive ? <FiEye size={11} className="text-amber-600" /> : <FiEyeOff size={11} className="text-slate-400" />}
                            <span>{showInactive ? 'Inactive On' : 'Inactive Off'}</span>
                        </button>

                        <button
                            onClick={() => setShowImportModal(true)}
                            className="px-2 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-bold transition-all shadow-2xs hover:border-slate-300 flex items-center gap-1"
                            title="Batch CSV Import"
                        >
                            <FiUpload size={11} className="text-violet-600" />
                            <span>Import</span>
                        </button>

                        <button
                            onClick={openAddModal}
                            className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 text-white text-[11px] font-black transition-all shadow-xs hover:shadow-blue-500/25 active:scale-[0.98] flex items-center gap-1 shrink-0"
                            title="Add New Inventory Product (Ctrl+N)"
                        >
                            <FiPlus size={12} className="stroke-[3]" />
                            <span>Add Product</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* ━━━ EXECUTIVE METRIC HUD CARDS (EXACT COMPACT CARDS FROM 6d90947) ━━━ */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {/* 1. Total Catalog */}
                <div className="bg-white rounded-2xl p-2.5 sm:p-3 border border-slate-200/90 shadow-2xs hover:shadow-xs transition-shadow">
                    <div className="flex items-center justify-between text-slate-400 mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Products</span>
                        <div className="w-5 h-5 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                            <FiPackage size={11} />
                        </div>
                    </div>
                    <div className="text-lg font-black text-slate-900 font-mono">{products.length.toLocaleString()}</div>
                    <div className="text-[10px] text-slate-400 font-medium">All registered items</div>
                </div>

                {/* 2. Active SKUs */}
                <div className="bg-white rounded-2xl p-2.5 sm:p-3 border border-emerald-200/90 bg-gradient-to-br from-emerald-50/30 via-white to-white shadow-2xs">
                    <div className="flex items-center justify-between text-slate-400 mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Live Active SKUs</span>
                        <div className="w-5 h-5 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700">
                            <FiCheck size={11} />
                        </div>
                    </div>
                    <div className="text-lg font-black text-emerald-700 font-mono">{activeProducts.length.toLocaleString()}</div>
                    <div className="text-[10px] text-emerald-600 font-medium">Selling in POS</div>
                </div>

                {/* 3. Product Categories */}
                <div className="bg-white rounded-2xl p-2.5 sm:p-3 border border-purple-200/90 bg-gradient-to-br from-purple-50/30 via-white to-white shadow-2xs">
                    <div className="flex items-center justify-between text-slate-400 mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700">Categories</span>
                        <div className="w-5 h-5 rounded-lg bg-purple-100 flex items-center justify-center text-purple-700">
                            <FiLayers size={11} />
                        </div>
                    </div>
                    <div className="text-lg font-black text-purple-700 font-mono">{categories.length}</div>
                    <div className="text-[10px] text-purple-600 font-medium">Distinct taxonomies</div>
                </div>

                {/* 4. Low Inventory Warnings */}
                <div className={`bg-white rounded-2xl p-2.5 sm:p-3 border shadow-2xs ${
                    lowStock.length > 0
                        ? 'border-rose-200/90 bg-gradient-to-br from-rose-50/40 via-white to-white'
                        : 'border-teal-200/90 bg-gradient-to-br from-teal-50/30 via-white to-white'
                }`}>
                    <div className="flex items-center justify-between text-slate-400 mb-1">
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${lowStock.length > 0 ? 'text-rose-700' : 'text-teal-700'}`}>
                            Low Inventory
                        </span>
                        <div className={`w-5 h-5 rounded-lg flex items-center justify-center ${lowStock.length > 0 ? 'bg-rose-100 text-rose-700' : 'bg-teal-100 text-teal-700'}`}>
                            <FiAlertTriangle size={11} />
                        </div>
                    </div>
                    <div className={`text-lg font-black font-mono ${lowStock.length > 0 ? 'text-rose-700' : 'text-teal-700'}`}>
                        {lowStock.length}
                    </div>
                    <div className={`text-[10px] font-medium ${lowStock.length > 0 ? 'text-rose-600' : 'text-teal-600'}`}>
                        {lowStock.length > 0 ? 'Reorder threshold reached' : 'All items optimal'}
                    </div>
                </div>
            </div>

            {/* ━━━ STOCK VALUATION & CAPITAL INTELLIGENCE STRIP (EXACT 5-BOX CARD FROM 6d90947) ━━━ */}
            {hasValuationAccess ? (
                <div className="bg-white rounded-2xl p-2.5 sm:p-3 border border-slate-200/90 shadow-2xs">
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                                Stock Valuation &amp; Capital Intelligence
                            </span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                            {products.length} cataloged • {Object.keys(stockData).length} with active balances
                        </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                        {/* 1. Cost Basis */}
                        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-0.5">Cost Valuation</span>
                            <div className="text-sm font-black text-slate-900 font-mono">{fmtK(stockValCost)}</div>
                            <div className="text-[10px] text-slate-400 font-mono truncate">{fmtKES(stockValCost)}</div>
                        </div>

                        {/* 2. Retail Valuation */}
                        <div className="p-2.5 rounded-xl bg-emerald-50/60 border border-emerald-200">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block mb-0.5">Retail Gross</span>
                            <div className="text-sm font-black text-emerald-700 font-mono">{fmtK(stockValRetail)}</div>
                            <div className="text-[10px] text-emerald-600 font-mono truncate">{fmtKES(stockValRetail)}</div>
                        </div>

                        {/* 3. Wholesale Valuation */}
                        <div className="p-2.5 rounded-xl bg-sky-50/60 border border-sky-200">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-sky-700 block mb-0.5">Wholesale Gross</span>
                            <div className="text-sm font-black text-sky-700 font-mono">{fmtK(stockValWholesale)}</div>
                            <div className="text-[10px] text-sky-600 font-mono truncate">{fmtKES(stockValWholesale)}</div>
                        </div>

                        {/* 4. Retail Potential Profit */}
                        <div className="p-2.5 rounded-xl bg-teal-50/60 border border-teal-200">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700 block mb-0.5">Retail Profit</span>
                            <div className="text-sm font-black text-teal-700 font-mono">{fmtK(stockRetailProfit)}</div>
                            <div className="text-[10px] text-teal-600 font-bold truncate">
                                {stockValCost > 0 ? `+${((stockRetailProfit / stockValCost) * 100).toFixed(1)}% margin` : '0%'}
                            </div>
                        </div>

                        {/* 5. Wholesale Potential Profit */}
                        <div className="p-2.5 rounded-xl bg-amber-50/60 border border-amber-200">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 block mb-0.5">Wholesale Profit</span>
                            <div className="text-sm font-black text-amber-800 font-mono">{fmtK(stockWholesaleProfit)}</div>
                            <div className="text-[10px] text-amber-600 font-bold truncate">
                                {stockValCost > 0 ? `+${((stockWholesaleProfit / stockValCost) * 100).toFixed(1)}% margin` : '0%'}
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="bg-white rounded-2xl p-2.5 border border-slate-200 shadow-2xs flex items-center justify-between">
                        <div>
                            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Inventory Cost</div>
                            <div className="text-sm font-black text-slate-900 font-mono">{fmtKES(stockValCost)}</div>
                        </div>
                        <FiDollarSign className="text-blue-500" size={16} />
                    </div>
                    <div className="bg-white rounded-2xl p-2.5 border border-slate-200 shadow-2xs flex items-center justify-between">
                        <div>
                            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Retail Worth</div>
                            <div className="text-sm font-black text-slate-900 font-mono">{fmtKES(stockValRetail)}</div>
                        </div>
                        <FiTrendingUp className="text-emerald-500" size={16} />
                    </div>
                    <div className="bg-white rounded-2xl p-2.5 border border-slate-200 shadow-2xs flex items-center justify-between">
                        <div>
                            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Potential Profit</div>
                            <div className="text-sm font-black text-emerald-700 font-mono">+{fmtKES(stockRetailProfit)}</div>
                        </div>
                        <FiAward className="text-emerald-500" size={16} />
                    </div>
                </div>
            )}


            {/* ━━━ INTERACTIVE ANALYTICS & LINEAR TREND STUDIO (SIDE-BY-SIDE CHARTS) ━━━ */}
            {showAnalyticsStudio && (
                <div className="bg-white/95 backdrop-blur-md rounded-2xl p-3 sm:p-3.5 border border-slate-200/90 shadow-sm transition-all space-y-3">
                    
                    {/* Studio Header & Navigation Pills */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-indigo-600 to-blue-500 text-white flex items-center justify-center shadow-xs">
                                <FiBarChart2 size={14} />
                            </div>
                            <div>
                                <h2 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                                    <span>Realtime Financial &amp; Linear Trend Studio</span>
                                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 font-mono">
                                        Live Vector Engine
                                    </span>
                                </h2>
                                <p className="text-[10px] text-slate-500 font-medium">
                                    Side-by-side pricing spreads, cost margins &amp; category asset distribution curves
                                </p>
                            </div>
                        </div>

                        {/* Interactive Metric Filter Horizon */}
                        <div className="flex items-center gap-1 flex-wrap">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider mr-1">Sort:</span>
                            {(['all', 'top_margin', 'top_price', 'low_stock'] as const).map(metric => (
                                <button
                                    key={metric}
                                    onClick={() => setLinearChartMetric(metric)}
                                    className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all ${
                                        linearChartMetric === metric
                                            ? 'bg-indigo-600 text-white shadow-2xs'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                >
                                    {metric === 'all' && 'Top Products'}
                                    {metric === 'top_margin' && 'Top Margins'}
                                    {metric === 'top_price' && 'High Price'}
                                    {metric === 'low_stock' && 'Stock Critical'}
                                </button>
                            ))}
                            <button
                                onClick={() => setShowAnalyticsStudio(false)}
                                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors ml-1"
                                title="Collapse Studio"
                            >
                                <FiX size={13} />
                            </button>
                        </div>
                    </div>

                    {/* SIDE-BY-SIDE CHARTS GRID */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                        
                        {/* ─── LEFT CHART: LINEAR PRICING & PROFIT SPREAD ─── */}
                        <div className="bg-slate-50/70 rounded-2xl p-3 border border-slate-200/80 relative overflow-hidden flex flex-col justify-between">
                            
                            {/* Left Chart Header */}
                            <div className="flex items-center justify-between mb-1.5">
                                <div>
                                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                                        <span>Linear Price vs Cost Spread</span>
                                    </h3>
                                    <p className="text-[10px] text-slate-500 font-medium">
                                        Multi-curve cubic bezier trajectory across active SKUs
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 text-[10px] font-bold">
                                    <span className="inline-flex items-center gap-1 text-emerald-600">
                                        <span className="w-2 h-2 rounded-full bg-emerald-500" /> Sell
                                    </span>
                                    <span className="inline-flex items-center gap-1 text-rose-600">
                                        <span className="w-2 h-2 rounded-full bg-rose-500" /> Cost
                                    </span>
                                    <span className="inline-flex items-center gap-1 text-purple-600">
                                        <span className="w-2 h-2 rounded-full bg-purple-500" /> Wholesale
                                    </span>
                                </div>
                            </div>

                            {/* Left Chart KPI Mini HUD */}
                            {linearPriceChart && (
                                <div className="grid grid-cols-3 gap-1.5 mb-2">
                                    <div className="bg-white/90 p-1.5 rounded-xl border border-slate-200/80">
                                        <div className="text-[9px] font-bold text-slate-400 uppercase">Avg Margin</div>
                                        <div className="text-xs font-black text-emerald-700 font-mono">+{linearPriceChart.avgMargin}%</div>
                                    </div>
                                    <div className="bg-white/90 p-1.5 rounded-xl border border-slate-200/80">
                                        <div className="text-[9px] font-bold text-slate-400 uppercase">Top Margin SKU</div>
                                        <div className="text-xs font-black text-indigo-700 truncate font-mono">
                                            {linearPriceChart.highestMarginItem ? `+${linearPriceChart.highestMarginItem.marginPer}%` : 'N/A'}
                                        </div>
                                    </div>
                                    <div className="bg-white/90 p-1.5 rounded-xl border border-slate-200/80">
                                        <div className="text-[9px] font-bold text-slate-400 uppercase">Max Unit Price</div>
                                        <div className="text-xs font-black text-slate-800 font-mono">
                                            Ksh {formatCompactNumber(linearPriceChart.maxPrice)}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Left SVG Vector Chart */}
                            {linearPriceChart ? (
                                <div className="relative w-full h-44 bg-white rounded-xl border border-slate-200/90 shadow-inner p-1">
                                    <svg
                                        viewBox={`0 0 ${linearPriceChart.svgW} ${linearPriceChart.svgH}`}
                                        className="w-full h-full overflow-visible"
                                    >
                                        <defs>
                                            <linearGradient id="profitLinearGradient" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#10B981" stopOpacity="0.25" />
                                                <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.04" />
                                            </linearGradient>
                                            <linearGradient id="sellCurveGrad" x1="0" y1="0" x2="1" y2="0">
                                                <stop offset="0%" stopColor="#10B981" />
                                                <stop offset="100%" stopColor="#059669" />
                                            </linearGradient>
                                        </defs>

                                        {/* Horizontal Gridlines & Price Markers */}
                                        {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
                                            const y = linearPriceChart.padT + linearPriceChart.plotH * (1 - pct);
                                            const priceVal = linearPriceChart.maxPrice * pct;
                                            return (
                                                <g key={idx}>
                                                    <line
                                                        x1={linearPriceChart.padL}
                                                        y1={y}
                                                        x2={linearPriceChart.svgW - linearPriceChart.padR}
                                                        y2={y}
                                                        stroke="#F1F5F9"
                                                        strokeWidth="1.2"
                                                        strokeDasharray="3 3"
                                                    />
                                                    <text
                                                        x={linearPriceChart.padL - 6}
                                                        y={y + 3}
                                                        textAnchor="end"
                                                        fontSize="8.5"
                                                        fill="#94A3B8"
                                                        fontFamily="monospace"
                                                        fontWeight="600"
                                                    >
                                                        {formatCompactNumber(priceVal)}
                                                    </text>
                                                </g>
                                            );
                                        })}

                                        {/* Profit Shading Area between Sell & Cost Curves */}
                                        {linearPriceChart.profitAreaPath && (
                                            <path d={linearPriceChart.profitAreaPath} fill="url(#profitLinearGradient)" />
                                        )}

                                        {/* Wholesale Curve Line */}
                                        {linearPriceChart.wsPath && (
                                            <path
                                                d={linearPriceChart.wsPath}
                                                fill="none"
                                                stroke="#8B5CF6"
                                                strokeWidth="1.8"
                                                strokeDasharray="4 3"
                                                strokeLinecap="round"
                                            />
                                        )}

                                        {/* Cost Price Curve Line */}
                                        {linearPriceChart.costPath && (
                                            <path
                                                d={linearPriceChart.costPath}
                                                fill="none"
                                                stroke="#F43F5E"
                                                strokeWidth="2.2"
                                                strokeLinecap="round"
                                            />
                                        )}

                                        {/* Sell Price Curve Line */}
                                        {linearPriceChart.sellPath && (
                                            <path
                                                d={linearPriceChart.sellPath}
                                                fill="none"
                                                stroke="url(#sellCurveGrad)"
                                                strokeWidth="2.8"
                                                strokeLinecap="round"
                                            />
                                        )}

                                        {/* Vertical Cursor on Active Hover */}
                                        {activeHoverIndex !== null && linearPriceChart.pointsData[activeHoverIndex] && (
                                            <line
                                                x1={linearPriceChart.sellPts[activeHoverIndex]?.x}
                                                y1={linearPriceChart.padT}
                                                x2={linearPriceChart.sellPts[activeHoverIndex]?.x}
                                                y2={linearPriceChart.padT + linearPriceChart.plotH}
                                                stroke="#3B82F6"
                                                strokeWidth="1.5"
                                                strokeDasharray="2 2"
                                            />
                                        )}

                                        {/* Data Interactive Anchor Points */}
                                        {linearPriceChart.pointsData.map((pt, i) => {
                                            const sellPt = linearPriceChart.sellPts[i];
                                            const isHovered = activeHoverIndex === i;
                                            if (!sellPt) return null;
                                            return (
                                                <g
                                                    key={pt.pid}
                                                    className="cursor-pointer"
                                                    onMouseEnter={() => setActiveHoverIndex(i)}
                                                    onMouseLeave={() => setActiveHoverIndex(null)}
                                                >
                                                    <circle cx={sellPt.x} cy={sellPt.y} r="10" fill="transparent" />
                                                    <circle
                                                        cx={sellPt.x}
                                                        cy={sellPt.y}
                                                        r={isHovered ? 5 : 3}
                                                        fill="#10B981"
                                                        stroke="#FFFFFF"
                                                        strokeWidth="1.5"
                                                        className="transition-all"
                                                    />
                                                </g>
                                            );
                                        })}
                                    </svg>

                                    {/* Dynamic Interactive Tooltip Floating Badge */}
                                    {activeHoverIndex !== null && linearPriceChart.pointsData[activeHoverIndex] && (
                                        <div
                                            className="absolute top-2 z-20 bg-slate-900/95 backdrop-blur-md text-white px-2.5 py-1.5 rounded-xl text-[11px] shadow-xl border border-slate-700 pointer-events-none transition-all"
                                            style={{
                                                left: `${Math.min(
                                                    Math.max(10, (linearPriceChart.sellPts[activeHoverIndex]?.x / linearPriceChart.svgW) * 100 - 20),
                                                    65
                                                )}%`,
                                            }}
                                        >
                                            <div className="font-bold text-amber-300 truncate max-w-[180px]">
                                                {linearPriceChart.pointsData[activeHoverIndex].name}
                                            </div>
                                            <div className="text-[9px] text-slate-300 font-mono mb-0.5">
                                                {linearPriceChart.pointsData[activeHoverIndex].code} • {linearPriceChart.pointsData[activeHoverIndex].category}
                                            </div>
                                            <div className="grid grid-cols-2 gap-x-2 text-[10px] font-mono">
                                                <span className="text-emerald-400">
                                                    Sell: {fmtKES(linearPriceChart.pointsData[activeHoverIndex].sellPrice)}
                                                </span>
                                                <span className="text-rose-400">
                                                    Cost: {fmtKES(linearPriceChart.pointsData[activeHoverIndex].costPrice)}
                                                </span>
                                                <span className="text-purple-300">
                                                    WS: {fmtKES(linearPriceChart.pointsData[activeHoverIndex].wholesalePrice)}
                                                </span>
                                                <span className="text-amber-400 font-bold">
                                                    +{linearPriceChart.pointsData[activeHoverIndex].marginPer}%
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="h-44 flex items-center justify-center text-xs text-slate-400">
                                    No pricing trend data available
                                </div>
                            )}
                        </div>

                        {/* ─── RIGHT CHART: CATEGORY ASSET & VALUATION DISTRIBUTION ─── */}
                        <div className="bg-slate-50/70 rounded-2xl p-3 border border-slate-200/80 relative overflow-hidden flex flex-col justify-between">
                            
                            {/* Right Chart Header */}
                            <div className="flex items-center justify-between mb-1.5">
                                <div>
                                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                                        <span>Category Capital &amp; Asset Spread</span>
                                    </h3>
                                    <p className="text-[10px] text-slate-500 font-medium">
                                        Purchasing cost tied vs potential retail revenue by department
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 text-[10px] font-bold">
                                    <span className="inline-flex items-center gap-1 text-blue-600">
                                        <span className="w-2 h-2 rounded-full bg-blue-500" /> Cost
                                    </span>
                                    <span className="inline-flex items-center gap-1 text-emerald-600">
                                        <span className="w-2 h-2 rounded-full bg-emerald-500" /> Retail
                                    </span>
                                </div>
                            </div>

                            {/* Right Chart KPI Mini HUD */}
                            {categoryValuationChart && (
                                <div className="grid grid-cols-3 gap-1.5 mb-2">
                                    <div className="bg-white/90 p-1.5 rounded-xl border border-slate-200/80">
                                        <div className="text-[9px] font-bold text-slate-400 uppercase">Top Cost Dept</div>
                                        <div className="text-xs font-black text-blue-700 truncate font-mono">
                                            {categoryValuationChart.topCapitalCategory?.name || 'General'}
                                        </div>
                                    </div>
                                    <div className="bg-white/90 p-1.5 rounded-xl border border-slate-200/80">
                                        <div className="text-[9px] font-bold text-slate-400 uppercase">Top Retail Dept</div>
                                        <div className="text-xs font-black text-emerald-700 truncate font-mono">
                                            {categoryValuationChart.topRevenueCategory?.name || 'General'}
                                        </div>
                                    </div>
                                    <div className="bg-white/90 p-1.5 rounded-xl border border-slate-200/80">
                                        <div className="text-[9px] font-bold text-slate-400 uppercase">Total Worth</div>
                                        <div className="text-xs font-black text-slate-800 font-mono">
                                            {fmtK(categoryValuationChart.totalCatRetail)}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Right SVG Vector Chart */}
                            {categoryValuationChart ? (
                                <div className="relative w-full h-44 bg-white rounded-xl border border-slate-200/90 shadow-inner p-1">
                                    <svg
                                        viewBox={`0 0 ${categoryValuationChart.svgW} ${categoryValuationChart.svgH}`}
                                        className="w-full h-full overflow-visible"
                                    >
                                        <defs>
                                            <linearGradient id="catRetailAreaGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#10B981" stopOpacity="0.28" />
                                                <stop offset="100%" stopColor="#10B981" stopOpacity="0.03" />
                                            </linearGradient>
                                            <linearGradient id="catCostAreaGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.22" />
                                                <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.02" />
                                            </linearGradient>
                                        </defs>

                                        {/* Horizontal Gridlines */}
                                        {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
                                            const y = categoryValuationChart.padT + categoryValuationChart.plotH * (1 - pct);
                                            const val = categoryValuationChart.maxVal * pct;
                                            return (
                                                <g key={idx}>
                                                    <line
                                                        x1={categoryValuationChart.padL}
                                                        y1={y}
                                                        x2={categoryValuationChart.svgW - categoryValuationChart.padR}
                                                        y2={y}
                                                        stroke="#F1F5F9"
                                                        strokeWidth="1.2"
                                                        strokeDasharray="3 3"
                                                    />
                                                    <text
                                                        x={categoryValuationChart.padL - 6}
                                                        y={y + 3}
                                                        textAnchor="end"
                                                        fontSize="8.5"
                                                        fill="#94A3B8"
                                                        fontFamily="monospace"
                                                        fontWeight="600"
                                                    >
                                                        {formatCompactNumber(val)}
                                                    </text>
                                                </g>
                                            );
                                        })}

                                        {/* Retail Area Fill */}
                                        {categoryValuationChart.retailAreaPath && (
                                            <path d={categoryValuationChart.retailAreaPath} fill="url(#catRetailAreaGrad)" />
                                        )}

                                        {/* Cost Area Fill */}
                                        {categoryValuationChart.costAreaPath && (
                                            <path d={categoryValuationChart.costAreaPath} fill="url(#catCostAreaGrad)" />
                                        )}

                                        {/* Cost Curve Line */}
                                        {categoryValuationChart.costPath && (
                                            <path
                                                d={categoryValuationChart.costPath}
                                                fill="none"
                                                stroke="#3B82F6"
                                                strokeWidth="2.4"
                                                strokeLinecap="round"
                                            />
                                        )}

                                        {/* Retail Curve Line */}
                                        {categoryValuationChart.retailPath && (
                                            <path
                                                d={categoryValuationChart.retailPath}
                                                fill="none"
                                                stroke="#10B981"
                                                strokeWidth="2.8"
                                                strokeLinecap="round"
                                            />
                                        )}

                                        {/* Category Anchors & Interactive Nodes */}
                                        {categoryValuationChart.catList.map((cat, i) => {
                                            const rPt = categoryValuationChart.retailPts[i];
                                            const cPt = categoryValuationChart.costPts[i];
                                            const isHovered = activeValHoverIndex === i;
                                            if (!rPt || !cPt) return null;
                                            return (
                                                <g
                                                    key={cat.name}
                                                    className="cursor-pointer"
                                                    onMouseEnter={() => setActiveValHoverIndex(i)}
                                                    onMouseLeave={() => setActiveValHoverIndex(null)}
                                                >
                                                    <circle cx={rPt.x} cy={rPt.y} r={isHovered ? 5 : 3} fill="#10B981" stroke="#FFFFFF" strokeWidth="1.5" />
                                                    <circle cx={cPt.x} cy={cPt.y} r={isHovered ? 4.5 : 2.5} fill="#3B82F6" stroke="#FFFFFF" strokeWidth="1.5" />
                                                    <text
                                                        x={rPt.x}
                                                        y={categoryValuationChart.padT + categoryValuationChart.plotH + 14}
                                                        textAnchor="middle"
                                                        fontSize="8"
                                                        fill={isHovered ? '#1E293B' : '#64748B'}
                                                        fontWeight={isHovered ? 'bold' : 'normal'}
                                                    >
                                                        {cat.name.length > 8 ? `${cat.name.slice(0, 7)}…` : cat.name}
                                                    </text>
                                                </g>
                                            );
                                        })}
                                    </svg>

                                    {/* Dynamic Interactive Tooltip Floating Badge */}
                                    {activeValHoverIndex !== null && categoryValuationChart.catList[activeValHoverIndex] && (
                                        <div
                                            className="absolute top-2 z-20 bg-slate-900/95 backdrop-blur-md text-white px-2.5 py-1.5 rounded-xl text-[11px] shadow-xl border border-slate-700 pointer-events-none transition-all"
                                            style={{
                                                left: `${Math.min(
                                                    Math.max(
                                                        10,
                                                        (categoryValuationChart.retailPts[activeValHoverIndex]?.x / categoryValuationChart.svgW) * 100 - 20
                                                    ),
                                                    65
                                                )}%`,
                                            }}
                                        >
                                            <div className="font-bold text-emerald-300">
                                                {categoryValuationChart.catList[activeValHoverIndex].name}
                                            </div>
                                            <div className="text-[9px] text-slate-300 font-mono mb-0.5">
                                                {categoryValuationChart.catList[activeValHoverIndex].count} SKUs Cataloged
                                            </div>
                                            <div className="grid grid-cols-2 gap-x-2 text-[10px] font-mono">
                                                <span className="text-blue-400">
                                                    Cost: {fmtK(categoryValuationChart.catList[activeValHoverIndex].costVal)}
                                                </span>
                                                <span className="text-emerald-400">
                                                    Retail: {fmtK(categoryValuationChart.catList[activeValHoverIndex].retailVal)}
                                                </span>
                                                <span className="text-amber-400 font-bold col-span-2">
                                                    Margin: +{fmtK(categoryValuationChart.catList[activeValHoverIndex].profitVal)}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="h-44 flex items-center justify-center text-xs text-slate-400">
                                    No category valuation data available
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Expiry Risk Horizon Alert Bar */}
                    {expiryHorizon.totalValAtRisk > 0 && (
                        <div className="p-2 bg-amber-50 rounded-xl border border-amber-200 flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1.5">
                                <span className="p-1 rounded-md bg-amber-200 text-amber-800">
                                    <FiAlertTriangle size={12} />
                                </span>
                                <span className="font-bold text-amber-900">
                                    Expiry Risk: <strong>{fmtKES(expiryHorizon.totalValAtRisk)}</strong> across near-expiry/expired batches.
                                </span>
                            </div>
                            <span className="text-[10px] font-mono text-amber-800 font-bold">
                                {expiryHorizon.expiredCount} Expired • {expiryHorizon.warningCount} &lt;30d Critical
                            </span>
                        </div>
                    )}
                </div>
            )}


            {/* ━━━ SEARCH, FILTER & VIEW BAR ━━━ */}
            <div className="bg-white/95 backdrop-blur-md rounded-2xl p-2.5 sm:p-3 border border-slate-200/90 shadow-2xs space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    
                    {/* Search Input */}
                    <div className="relative flex-1">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => {
                                setSearchQuery(e.target.value);
                                setPage(1);
                            }}
                            placeholder="Search by product name, SKU code, barcode, or alias... (Ctrl+F)"
                            className="w-full pl-8 pr-8 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:border-blue-500 focus:bg-white outline-none transition-all placeholder:text-slate-400"
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

                    {/* Filter Category Dropdown */}
                    <div className="flex items-center gap-2">
                        <div className="relative min-w-[140px]">
                            <select
                                value={filterCategory}
                                onChange={e => {
                                    setFilterCategory(e.target.value);
                                    setPage(1);
                                }}
                                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-blue-500 cursor-pointer"
                            >
                                <option value="All">All Categories ({categories.length})</option>
                                {categories.map(c => (
                                    <option key={c.category_id} value={c.category_name}>
                                        {c.category_name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* View Mode Toggle */}
                        <div className="flex items-center border border-slate-200 rounded-xl p-0.5 bg-slate-50">
                            <button
                                onClick={() => setViewMode('list')}
                                className={`p-1 rounded-lg text-xs transition-all ${
                                    viewMode === 'list' ? 'bg-white shadow-2xs text-blue-600 font-bold' : 'text-slate-400 hover:text-slate-700'
                                }`}
                                title="List / Datagrid View"
                            >
                                <FiList size={13} />
                            </button>
                            <button
                                onClick={() => setViewMode('grid')}
                                className={`p-1 rounded-lg text-xs transition-all ${
                                    viewMode === 'grid' ? 'bg-white shadow-2xs text-blue-600 font-bold' : 'text-slate-400 hover:text-slate-700'
                                }`}
                                title="Card Grid View"
                            >
                                <FiGrid size={13} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Active Category Chips */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-[10px] font-semibold text-slate-600 scrollbar-none">
                    <button
                        onClick={() => {
                            setFilterCategory('All');
                            setPage(1);
                        }}
                        className={`px-2 py-0.5 rounded-lg transition-all shrink-0 ${
                            filterCategory === 'All'
                                ? 'bg-blue-600 text-white font-bold shadow-2xs'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                    >
                        All Items ({products.length})
                    </button>
                    {categories.slice(0, 10).map(c => {
                        const count = products.filter(p => p.category === c.category_name).length;
                        return (
                            <button
                                key={c.category_id}
                                onClick={() => {
                                    setFilterCategory(c.category_name);
                                    setPage(1);
                                }}
                                className={`px-2 py-0.5 rounded-lg transition-all shrink-0 ${
                                    filterCategory === c.category_name
                                        ? 'bg-blue-600 text-white font-bold shadow-2xs'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                            >
                                {c.category_name} ({count})
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* ━━━ BULK ACTION BAR (WHEN ITEMS SELECTED) ━━━ */}
            {selectedPids.size > 0 && (
                <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 text-white rounded-2xl px-3.5 py-2 shadow-md flex items-center justify-between gap-2.5 animate-fadeIn">
                    <div className="flex items-center gap-2 text-xs font-bold">
                        <span className="w-5 h-5 rounded-full bg-white text-blue-600 flex items-center justify-center text-[10px] font-black">
                            {selectedPids.size}
                        </span>
                        <span>Products Selected</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <button
                            onClick={() => openLabelModal()}
                            className="px-2.5 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-bold transition-all flex items-center gap-1"
                        >
                            <FiPrinter size={12} /> Print Labels
                        </button>
                        <button
                            onClick={bulkDeactivate}
                            className="px-2.5 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-bold transition-all flex items-center gap-1"
                        >
                            <FiEyeOff size={12} /> Deactivate
                        </button>
                        <button
                            onClick={bulkDelete}
                            className="px-2.5 py-1 bg-rose-500/80 hover:bg-rose-600 rounded-lg text-xs font-bold transition-all flex items-center gap-1"
                        >
                            <FiTrash2 size={12} /> Delete
                        </button>
                        <button
                            onClick={() => setSelectedPids(new Set())}
                            className="p-1 hover:bg-white/20 rounded-lg text-xs"
                            title="Deselect All"
                        >
                            <FiX size={13} />
                        </button>
                    </div>
                </div>
            )}

            {/* ━━━ CONTENT: LIST VIEW (DATAGRID TABLE) OR GRID VIEW ━━━ */}
            {isLoading ? (
                <div className="bg-white rounded-2xl p-10 text-center border border-slate-200 shadow-2xs">
                    <FiRefreshCw className="animate-spin text-blue-600 mx-auto mb-2" size={24} />
                    <p className="text-xs font-bold text-slate-600">Loading catalog inventory &amp; live valuation...</p>
                </div>
            ) : filtered.length === 0 ? (
                <div className="bg-white rounded-2xl p-10 text-center border border-slate-200 shadow-2xs">
                    <FiPackage className="text-slate-300 mx-auto mb-2" size={36} />
                    <p className="text-xs font-bold text-slate-700">No products match your search or filter</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Try clearing filters or adding a new inventory product</p>
                    <button
                        onClick={openAddModal}
                        className="mt-3 px-3 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-xs hover:bg-blue-700 transition-all inline-flex items-center gap-1"
                    >
                        <FiPlus size={13} /> Add Product
                    </button>
                </div>
            ) : viewMode === 'list' ? (
                /* ─── DATAGRID TABLE (LIGHT APSIMS STUDIO HEADER - NO BLACK BACKGROUND) ─── */
                <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[1050px]">
                            <thead>
                                <tr className="bg-slate-50/90 border-b border-slate-200 text-[10px] font-black uppercase text-slate-500 tracking-wider">
                                    <th className="py-2.5 px-3 w-8 text-center">
                                        <input
                                            type="checkbox"
                                            checked={selectedPids.size === filtered.length && filtered.length > 0}
                                            onChange={() => toggleSelectAll(filtered)}
                                            className="rounded border-slate-300 accent-blue-600 cursor-pointer"
                                        />
                                    </th>
                                    <th className="py-2.5 px-3">Product Name &amp; SKU</th>
                                    <th className="py-2.5 px-3">Category</th>
                                    <th className="py-2.5 px-3 text-right">Buy Price</th>
                                    <th className="py-2.5 px-3 text-right">Cost / Pc</th>
                                    <th className="py-2.5 px-3 text-right">Sell Price</th>
                                    <th className="py-2.5 px-3 text-right">Big Qty Price</th>
                                    <th className="py-2.5 px-3 text-right">Wholesale</th>
                                    <th className="py-2.5 px-3 text-center">Stock Ledger</th>
                                    <th className="py-2.5 px-3 text-center">Profit Margin</th>
                                    <th className="py-2.5 px-3 text-center">Status</th>
                                    <th className="py-2.5 px-3 text-center w-36">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                                {paginated.map((product, idx) => {
                                    const ppp = product.pieces_per_package || 1;
                                    const costPerPiece = ppp > 1 ? product.purchase_cost / ppp : product.purchase_cost;
                                    const profitPerPiece = product.sales_cost - costPerPiece;
                                    const marginPercent = calcMargin(product.sales_cost, costPerPiece);
                                    const bags = bagStockData[product.pid] || 0;
                                    const pieces = pieceStockData[product.pid] || 0;
                                    const totalEquivalent = bags * ppp + pieces;
                                    const isLow = totalEquivalent <= (product.reorder_point || 10);
                                    const isSelected = selectedPids.has(product.pid);
                                    const bigPrice =
                                        product.package_sales_cost && product.package_sales_cost > 0
                                            ? product.package_sales_cost
                                            : ppp > 1
                                            ? product.sales_cost * ppp
                                            : 0;

                                    return (
                                        <tr
                                            key={product.pid}
                                            className={`transition-colors hover:bg-amber-50/30 ${
                                                isSelected ? 'bg-blue-50/70' : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'
                                            } ${!product.active ? 'opacity-60' : ''}`}
                                        >
                                            {/* Checkbox */}
                                            <td className="py-2 px-3 text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => toggleSelect(product.pid)}
                                                    className="rounded border-slate-300 accent-blue-600 cursor-pointer"
                                                />
                                            </td>

                                            {/* Product Particulars */}
                                            <td className="py-2 px-3">
                                                <div className="flex items-center gap-2">
                                                    {product.photo ? (
                                                        <div className="w-8 h-8 rounded-lg overflow-hidden border border-slate-200 shrink-0 shadow-2xs">
                                                            <img
                                                                src={product.photo}
                                                                alt=""
                                                                className="w-full h-full object-cover"
                                                                onError={e => {
                                                                    (e.target as HTMLImageElement).src = '/no-image.png';
                                                                }}
                                                            />
                                                        </div>
                                                    ) : (
                                                        <div
                                                            className={`w-8 h-8 rounded-lg bg-gradient-to-tr ${
                                                                product.button_ui_color || 'from-blue-500 to-indigo-600'
                                                            } flex items-center justify-center text-white font-bold text-[10px] shadow-2xs shrink-0`}
                                                        >
                                                            {product.product_name.slice(0, 2).toUpperCase()}
                                                        </div>
                                                    )}
                                                    <div className="min-w-0">
                                                        <div className="font-extrabold text-slate-900 tracking-tight leading-tight truncate max-w-[200px]">
                                                            {product.product_name}
                                                        </div>
                                                        <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1.5 mt-0.5">
                                                            <span className="text-indigo-600 font-bold">{product.product_code}</span>
                                                            {product.barcode && <span>• #{product.barcode}</span>}
                                                            {product.alias && <span className="text-blue-600 italic">({product.alias})</span>}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Category */}
                                            <td className="py-2 px-3">
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[10px] font-bold">
                                                    <FiTag size={9} className="text-slate-400" />
                                                    {product.category || 'General'}
                                                </span>
                                            </td>

                                            {/* Buy Price */}
                                            <td className="py-2 px-3 text-right font-mono font-bold text-slate-700 text-xs">
                                                {fmtKES(product.purchase_cost || 0)}
                                            </td>

                                            {/* Cost / Pc */}
                                            <td className="py-2 px-3 text-right font-mono text-xs font-bold text-amber-800">
                                                {fmtKES(Math.round(costPerPiece))}
                                                {ppp > 1 && (
                                                    <span className="text-[9px] text-slate-400 block font-normal">
                                                        1:{ppp}
                                                    </span>
                                                )}
                                            </td>

                                            {/* Sell Price */}
                                            <td className="py-2 px-3 text-right font-mono font-black text-slate-900 text-xs">
                                                {fmtKES(product.sales_cost || 0)}
                                            </td>

                                            {/* Big Qty Price */}
                                            <td className="py-2 px-3 text-right font-mono font-black text-indigo-700 text-xs">
                                                {ppp > 1 && bigPrice > 0 ? (
                                                    <div>
                                                        <span>{fmtKES(bigPrice)}</span>
                                                        <span className="text-[9px] text-indigo-500 block font-medium">
                                                            /{product.purchase_unit} ({ppp} pcs)
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-300 text-xs">—</span>
                                                )}
                                            </td>

                                            {/* Wholesale */}
                                            <td className="py-2 px-3 text-right font-mono font-bold text-purple-700 text-xs">
                                                {product.wholesale_price && product.wholesale_price > 0 ? (
                                                    fmtKES(product.wholesale_price)
                                                ) : (
                                                    <span className="text-slate-300">—</span>
                                                )}
                                            </td>

                                            {/* Stock Ledger (Dual-Stock Pills) */}
                                            <td className="py-2 px-3 text-center">
                                                <div className="flex flex-col items-center gap-0.5">
                                                    {ppp > 1 && bags > 0 && (
                                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-black bg-amber-50 text-amber-800 border border-amber-200/80 font-mono">
                                                            📦 {bags} {product.purchase_unit}
                                                        </span>
                                                    )}
                                                    <span
                                                        className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-black font-mono ${
                                                            pieces > 0
                                                                ? 'bg-sky-50 text-sky-800 border border-sky-200/80'
                                                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                                                        }`}
                                                    >
                                                        🔢 {pieces} {product.sales_unit}
                                                    </span>
                                                </div>
                                                {isLow && (
                                                    <div className="text-[9px] font-bold text-rose-600 mt-0.5 flex items-center justify-center gap-0.5">
                                                        <FiAlertTriangle size={9} /> Low Stock
                                                    </div>
                                                )}
                                            </td>

                                            {/* Profit Margin */}
                                            <td className="py-2 px-3 text-center">
                                                <div className="flex flex-col items-center justify-center gap-0.5">
                                                    <span
                                                        className={`inline-block px-1.5 py-0.2 rounded-full text-[10px] font-black font-mono ${
                                                            marginPercent >= 20
                                                                ? 'bg-emerald-100 text-emerald-800'
                                                                : marginPercent > 0
                                                                ? 'bg-blue-100 text-blue-800'
                                                                : 'bg-rose-100 text-rose-800'
                                                        }`}
                                                    >
                                                        +{marginPercent}%
                                                    </span>
                                                    <span className="text-[9px] font-mono text-emerald-700 font-bold">
                                                        +{fmtKES(profitPerPiece)}/pc
                                                    </span>
                                                </div>
                                            </td>

                                            {/* Status Badge */}
                                            <td className="py-2 px-3 text-center">
                                                <span
                                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black ${
                                                        product.active
                                                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                            : 'bg-slate-100 text-slate-500 border border-slate-200'
                                                    }`}
                                                >
                                                    <span className={`w-1.5 h-1.5 rounded-full ${product.active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                                                    {product.active ? 'Live' : 'Off'}
                                                </span>
                                            </td>

                                            {/* Action Toolbar — RESTORED COLORFUL BUTTONS FROM 6d90947 */}
                                            <td className="py-2 px-3 text-center">
                                                <div className="flex items-center justify-center gap-1 flex-wrap">
                                                    <button
                                                        onClick={() => openEditModal(product)}
                                                        className="p-1 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                                                        title="Edit Product Details"
                                                    >
                                                        <FiEdit2 size={12} />
                                                    </button>
                                                    <button
                                                        onClick={() => openStockHistory(product)}
                                                        className="p-1 rounded-lg bg-sky-50 text-sky-600 hover:bg-sky-100 transition-colors"
                                                        title="Stock Ledger Movements"
                                                    >
                                                        <FiClock size={12} />
                                                    </button>
                                                    <button
                                                        onClick={() => openPriceHistory(product)}
                                                        className="p-1 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors"
                                                        title="Price Change History"
                                                    >
                                                        <FiTrendingUp size={12} />
                                                    </button>
                                                    <button
                                                        onClick={() => openStockAdjust(product)}
                                                        className="p-1 rounded-lg bg-purple-50 text-purple-600 hover:bg-purple-100 transition-colors"
                                                        title="Manual Stock Adjustment"
                                                    >
                                                        <FiSliders size={12} />
                                                    </button>
                                                    <button
                                                        onClick={() => deactivateProduct(product)}
                                                        className={`p-1 rounded-lg transition-colors ${
                                                            product.active
                                                                ? 'bg-orange-50 text-orange-600 hover:bg-orange-100'
                                                                : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                                                        }`}
                                                        title={product.active ? 'Deactivate' : 'Reactivate'}
                                                    >
                                                        {product.active ? <FiEyeOff size={12} /> : <FiEye size={12} />}
                                                    </button>
                                                    <button
                                                        onClick={() => deleteProduct(product)}
                                                        className="p-1 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors"
                                                        title="Delete Permanently"
                                                    >
                                                        <FiTrash2 size={12} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                /* ─── CARD GRID VIEW (GRID MODE) ─── */
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
                    {paginated.map(p => {
                        const stk = stockData[p.pid] || 0;
                        const isSelected = selectedPids.has(p.pid);
                        const ppp = p.pieces_per_package || 1;
                        const cpp = (p.purchase_cost || 0) / ppp;
                        const marginPercent = calcMargin(p.sales_cost, cpp);
                        const bags = bagStockData[p.pid] || 0;
                        const pieces = pieceStockData[p.pid] || 0;
                        const bigPrice =
                            p.package_sales_cost && p.package_sales_cost > 0
                                ? p.package_sales_cost
                                : ppp > 1
                                ? p.sales_cost * ppp
                                : 0;

                        return (
                            <div
                                key={p.pid}
                                className={`bg-white rounded-2xl border overflow-hidden shadow-2xs hover:shadow-md transition-all group flex flex-col justify-between ${
                                    isSelected ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-slate-200/90'
                                }`}
                            >
                                <div className={`h-24 bg-gradient-to-br ${p.button_ui_color || 'from-blue-400 to-blue-600'} relative flex items-center justify-center overflow-hidden`}>
                                    {p.photo ? (
                                        <img
                                            src={p.photo}
                                            alt={p.product_name}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                            onError={e => {
                                                (e.target as HTMLImageElement).src = '/no-image.png';
                                            }}
                                        />
                                    ) : (
                                        <div className="text-white font-black text-sm uppercase">
                                            {p.product_name.slice(0, 2)}
                                        </div>
                                    )}

                                    {/* Action overlay */}
                                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => openEditModal(p)}
                                            className="p-1 bg-white/95 rounded-lg text-blue-600 hover:bg-white shadow-xs"
                                            title="Edit"
                                        >
                                            <FiEdit2 size={11} />
                                        </button>
                                        <button
                                            onClick={() => deactivateProduct(p)}
                                            className={`p-1 bg-white/95 rounded-lg shadow-xs ${p.active ? 'text-amber-600' : 'text-emerald-600'}`}
                                            title={p.active ? 'Deactivate' : 'Reactivate'}
                                        >
                                            {p.active ? <FiEyeOff size={11} /> : <FiEye size={11} />}
                                        </button>
                                        <button
                                            onClick={() => deleteProduct(p)}
                                            className="p-1 bg-white/95 rounded-lg text-rose-600 hover:bg-white shadow-xs"
                                            title="Delete"
                                        >
                                            <FiTrash2 size={11} />
                                        </button>
                                    </div>

                                    {/* Status Badge */}
                                    <span
                                        className={`absolute top-2 left-2 px-1.5 py-0.2 rounded-full text-[9px] font-black tracking-wider ${
                                            p.active ? 'bg-emerald-500 text-white shadow-2xs' : 'bg-slate-600 text-white'
                                        }`}
                                    >
                                        {p.active ? 'ACTIVE' : 'OFF'}
                                    </span>
                                </div>

                                <div className="p-2.5 flex-1 flex flex-col justify-between">
                                    <div>
                                        <div className="flex items-center justify-between gap-1 mb-1">
                                            <span className="text-[10px] font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.2 rounded">
                                                {p.product_code}
                                            </span>
                                            <span className="text-[10px] text-slate-400 font-medium truncate">
                                                {p.category || 'General'}
                                            </span>
                                        </div>
                                        <p className="text-xs font-black text-slate-900 truncate" title={p.product_name}>
                                            {p.product_name}
                                        </p>
                                    </div>

                                    {/* Dual-Stock Pills */}
                                    <div className="flex items-center gap-1 my-2">
                                        {ppp > 1 && bags > 0 && (
                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                                📦 {bags} {p.purchase_unit}
                                            </span>
                                        )}
                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-50 text-sky-800 border border-sky-200">
                                            🔢 {pieces} {p.sales_unit}
                                        </span>
                                        <span className="ml-auto text-[10px] font-black text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded">
                                            +{marginPercent}%
                                        </span>
                                    </div>

                                    {/* Pricing Matrix */}
                                    <div className="p-1.5 bg-slate-50 rounded-xl space-y-0.5 text-[11px] font-mono">
                                        <div className="flex justify-between">
                                            <span className="text-slate-500">Retail Sell:</span>
                                            <span className="font-bold text-emerald-700">{fmtKES(p.sales_cost || 0)}</span>
                                        </div>
                                        {ppp > 1 && bigPrice > 0 && (
                                            <div className="flex justify-between text-indigo-700">
                                                <span>Big Qty:</span>
                                                <span className="font-bold">{fmtKES(bigPrice)}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between text-slate-400 text-[10px]">
                                            <span>Buy Cost:</span>
                                            <span>{fmtKES(p.purchase_cost || 0)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ━━━ FLOATING PAGINATION FOOTER ━━━ */}
            <div className="sticky bottom-0 z-30 bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl shadow-lg px-4 py-2 mt-2">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
                    <div className="flex items-center gap-2">
                        <span>Show</span>
                        <select
                            value={perPage}
                            onChange={e => {
                                setPerPage(parseInt(e.target.value, 10));
                                setPage(1);
                            }}
                            className="px-2 py-0.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 outline-none cursor-pointer"
                        >
                            {[10, 20, 50, 100].map(n => (
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
                            className="p-1 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-blue-600 disabled:opacity-30 transition-all"
                            title="First Page"
                        >
                            <FiChevronsLeft size={12} />
                        </button>
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="p-1 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-blue-600 disabled:opacity-30 transition-all"
                            title="Previous Page"
                        >
                            <FiChevronLeft size={12} />
                        </button>
                        {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                            const start = Math.max(1, Math.min(page - 3, totalPages - 6));
                            const pg = start + i;
                            if (pg > totalPages) return null;
                            return (
                                <button
                                    key={pg}
                                    onClick={() => setPage(pg)}
                                    className={`w-6 h-6 rounded-lg text-[11px] font-bold font-mono transition-all ${
                                        pg === page
                                            ? 'bg-blue-600 text-white shadow-xs'
                                            : 'bg-slate-50 border border-slate-200 text-slate-600 hover:text-blue-600'
                                    }`}
                                >
                                    {pg}
                                </button>
                            );
                        })}
                        <button
                            onClick={() => setPage(p => Math.min(totalPages || 1, p + 1))}
                            disabled={page >= totalPages}
                            className="p-1 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-blue-600 disabled:opacity-30 transition-all"
                            title="Next Page"
                        >
                            <FiChevronRight size={12} />
                        </button>
                        <button
                            onClick={() => setPage(totalPages || 1)}
                            disabled={page >= totalPages}
                            className="p-1 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-blue-600 disabled:opacity-30 transition-all"
                            title="Last Page"
                        >
                            <FiChevronsRight size={12} />
                        </button>
                    </div>

                    <span className="text-[11px] text-slate-400 font-mono">
                        Page <strong className="font-bold text-slate-700">{page}</strong> of{' '}
                        <strong className="font-bold text-slate-700">{totalPages || 1}</strong>
                    </span>
                </div>
            </div>


            {/* ━━━ ADD / EDIT PRODUCT MODAL (ULTRA COMPACT, BALANCED & PROFESSIONAL - NOT TOO BIG, NOT TOO SMALL) ━━━ */}
            {showModal && (
                <div
                    className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 z-50 animate-fadeIn"
                    onClick={() => setShowModal(false)}
                >
                    <div
                        className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[88vh] overflow-hidden border border-slate-100 flex flex-col"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* ─── VIBRANT ROYAL GRADIENT HEADER (COMPACT & SLEEK - NO DARK HEADER) ─── */}
                        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 px-5 py-3 text-white shrink-0 flex items-center justify-between shadow-md relative overflow-hidden">
                            <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white font-black shadow-inner">
                                    <FiPackage size={18} />
                                </div>
                                <div>
                                    <div className="flex items-center gap-1.5">
                                        <h2 className="text-sm sm:text-base font-black tracking-wide text-white">
                                            {editingProduct ? 'Edit Catalog Product' : 'Register New Inventory Product'}
                                        </h2>
                                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-white/20 text-white font-mono uppercase">
                                            {editingProduct ? 'Edit' : 'New'}
                                        </span>
                                    </div>
                                    <p className="text-blue-100 text-[11px] font-mono flex items-center gap-1.5">
                                        {editingProduct ? (
                                            <span className="bg-white/20 px-1.5 py-0.2 rounded font-bold text-white">
                                                {editingProduct.product_code}
                                            </span>
                                        ) : (
                                            <span className="bg-white/20 px-1.5 py-0.2 rounded font-bold text-white">
                                                {previewCode || 'PRD-AUTO'} • Auto-assigned
                                            </span>
                                        )}
                                        <span>•</span>
                                        <span className="text-white/80">Dual-Stock Matrix &amp; Profit Engine</span>
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-1.5">
                                <span className="hidden sm:inline-block text-[10px] text-blue-200 font-mono bg-white/10 px-1.5 py-0.5 rounded">
                                    Esc
                                </span>
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="p-1.5 hover:bg-white/20 rounded-xl transition-all text-white/90 hover:text-white"
                                    title="Close Window (Esc)"
                                >
                                    <FiX size={18} />
                                </button>
                            </div>
                        </div>

                        {/* ─── COMPACT NAVIGATION TABS SUBHEADER ─── */}
                        <div className="bg-slate-50 border-b border-slate-200 px-5 py-1.5 shrink-0 flex items-center gap-1 overflow-x-auto scrollbar-none text-[11px] font-bold text-slate-600">
                            {[
                                { id: 'general', label: 'Basic Info' },
                                { id: 'stock', label: 'Dual-Stock' },
                                { id: 'pricing', label: 'Pricing Matrix' },
                                { id: 'batches', label: `Batches (${productBatches.length})` },
                                { id: 'tax', label: 'Tax & Safety' },
                                { id: 'pos', label: 'POS Theme' },
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setModalActiveTab(tab.id as any)}
                                    className={`px-2.5 py-1 rounded-lg transition-all shrink-0 ${
                                        modalActiveTab === tab.id
                                            ? 'bg-blue-600 text-white shadow-2xs font-extrabold'
                                            : 'hover:bg-slate-200/70 text-slate-600'
                                    }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {/* ─── MODAL BODY: COMPACT SCROLLABLE SECTIONS ─── */}
                        <form onSubmit={handleSubmit} className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
                            
                            {/* SECTION 1: CORE IDENTIFICATION */}
                            {(modalActiveTab === 'general' || modalActiveTab === 'stock' || modalActiveTab === 'pricing') && (
                                <div className="bg-white rounded-2xl border border-slate-200/90 p-3.5 shadow-2xs space-y-2.5">
                                    <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                                        <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                                            <span>Product Master Identification</span>
                                        </h3>
                                        <span className="text-[9px] text-slate-400 font-bold uppercase">Particulars</span>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                                        {/* Product Name */}
                                        <div className="md:col-span-2">
                                            <label className="block text-xs font-black text-slate-700 mb-1 uppercase tracking-wider">
                                                Product Name <span className="text-rose-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                value={formData.product_name}
                                                onChange={e => setFormData({ ...formData, product_name: e.target.value })}
                                                placeholder="e.g., Sugar 2Kg Mumias"
                                                required
                                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:border-blue-500 focus:bg-white outline-none font-bold text-xs"
                                            />
                                        </div>

                                        {/* PID & Code Preview */}
                                        {!editingProduct && (
                                            <div className="md:col-span-2 grid grid-cols-2 gap-2">
                                                <div>
                                                    <label className="block text-[9px] font-black text-slate-500 mb-0.5 uppercase tracking-wider">
                                                        Master PID
                                                    </label>
                                                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-50/70 border border-blue-200 rounded-xl">
                                                        <span className="font-bold text-blue-700 font-mono text-xs">{previewPid ?? '...'}</span>
                                                        <span className="ml-auto text-[9px] text-blue-500 italic">Auto</span>
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="block text-[9px] font-black text-slate-500 mb-0.5 uppercase tracking-wider">
                                                        Master Code
                                                    </label>
                                                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-50/70 border border-emerald-200 rounded-xl">
                                                        <span className="font-bold text-emerald-700 font-mono text-xs">{previewCode || '...'}</span>
                                                        <span className="ml-auto text-[9px] text-emerald-500 italic">Auto</span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Alias */}
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                                                Alias / Short Name
                                            </label>
                                            <input
                                                type="text"
                                                value={formData.alias}
                                                onChange={e => setFormData({ ...formData, alias: e.target.value })}
                                                placeholder="e.g., Sug2k"
                                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:border-blue-500 outline-none text-xs font-bold"
                                            />
                                        </div>

                                        {/* Category */}
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                                                Category Department
                                            </label>
                                            <select
                                                value={formData.category}
                                                onChange={e => setFormData({ ...formData, category: e.target.value })}
                                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:border-blue-500 outline-none text-xs font-bold cursor-pointer"
                                            >
                                                <option value="">Select Category</option>
                                                {categories.map(c => (
                                                    <option key={c.category_id} value={c.category_name}>
                                                        {c.category_name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Barcode */}
                                        <div>
                                            <div className="flex items-center justify-between mb-1">
                                                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                                                    Barcode / SKU
                                                </label>
                                                <button
                                                    type="button"
                                                    onClick={() => setFormData({ ...formData, barcode: generateBarcode() })}
                                                    className="text-[10px] font-bold text-blue-600 hover:text-blue-800"
                                                >
                                                    Generate
                                                </button>
                                            </div>
                                            <input
                                                type="text"
                                                value={formData.barcode}
                                                onChange={e => setFormData({ ...formData, barcode: e.target.value })}
                                                placeholder="Scan or enter code"
                                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:border-blue-500 outline-none text-xs font-mono font-bold"
                                            />
                                        </div>

                                        {/* HS Code */}
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                                                HS Code (Taxation)
                                            </label>
                                            <input
                                                type="text"
                                                value={formData.hscode}
                                                onChange={e => setFormData({ ...formData, hscode: e.target.value })}
                                                placeholder="Optional tariff code"
                                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:border-blue-500 outline-none text-xs font-mono font-bold"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* SECTION 2: DUAL-STOCK & PACKAGING EQUATION */}
                            {(modalActiveTab === 'stock' || modalActiveTab === 'general' || modalActiveTab === 'pricing') && (
                                <div className="bg-white rounded-2xl border border-slate-200/90 p-3.5 shadow-2xs space-y-2.5">
                                    <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                                        <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                                            <span>Packaging Ratio &amp; Stock</span>
                                        </h3>
                                        <span className="text-[9px] text-amber-600 font-bold uppercase">Dual-Stock</span>
                                    </div>

                                    {/* Packaging Equation Badge */}
                                    <div className="p-2.5 bg-amber-50/70 rounded-xl border border-amber-200 flex items-center justify-between text-xs">
                                        <span className="font-bold text-amber-900 flex items-center gap-1.5">
                                            <span>Packaging Equation:</span>
                                            <strong className="font-mono">
                                                1 {formData.purchase_unit} = {formData.pieces_per_package || 1}{' '}
                                                {formData.sales_unit?.toLowerCase() === formData.purchase_unit?.toLowerCase()
                                                    ? 'Piece'
                                                    : formData.sales_unit}
                                                s
                                            </strong>
                                        </span>
                                        <span className="text-[10px] text-amber-700 font-semibold hidden sm:inline">
                                            Auto-converts bulk packages when pieces reach 0
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-700 mb-1 uppercase tracking-wider">
                                                Purchase Unit (Bulk)
                                            </label>
                                            <select
                                                value={formData.purchase_unit}
                                                onChange={e => setFormData({ ...formData, purchase_unit: e.target.value })}
                                                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-blue-500 outline-none text-xs font-bold cursor-pointer"
                                            >
                                                {units.map(u => (
                                                    <option key={u.unit_id} value={u.unit_name}>
                                                        {u.unit_name} ({u.abbreviation})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-700 mb-1 uppercase tracking-wider">
                                                Sales Unit (Loose)
                                            </label>
                                            <select
                                                value={formData.sales_unit}
                                                onChange={e => setFormData({ ...formData, sales_unit: e.target.value })}
                                                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-blue-500 outline-none text-xs font-bold cursor-pointer"
                                            >
                                                {units.map(u => (
                                                    <option key={u.unit_id} value={u.unit_name}>
                                                        {u.unit_name} ({u.abbreviation})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-[11px] font-bold text-orange-800 mb-1 uppercase tracking-wider">
                                                Pcs per {formData.purchase_unit}
                                            </label>
                                            <input
                                                type="number"
                                                value={formData.pieces_per_package}
                                                onChange={e => setFormData({ ...formData, pieces_per_package: parseInt(e.target.value, 10) || 1 })}
                                                min="1"
                                                className="w-full px-2.5 py-1.5 bg-orange-50 border border-orange-300 rounded-xl focus:border-orange-500 outline-none text-xs font-mono font-black text-orange-900 text-center"
                                            />
                                        </div>
                                    </div>

                                    {/* Opening Stock Inputs (Only on Add) */}
                                    {!editingProduct ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-2 border-t border-slate-100">
                                            <div>
                                                <label className="block text-xs font-bold text-amber-700 mb-1 uppercase tracking-wider">
                                                    📦 Opening {formData.purchase_unit}s (Bulk Boxes / Bags / Big Qty)
                                                </label>
                                                <input
                                                    type="number"
                                                    value={openingBags}
                                                    onChange={e => setOpeningBags(Number(e.target.value))}
                                                    min="0"
                                                    placeholder="e.g. 5"
                                                    className="w-full px-3 py-2 bg-amber-50/60 border border-amber-200 rounded-xl focus:border-amber-500 outline-none text-xs font-mono font-black text-amber-900 text-center"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-sky-700 mb-1 uppercase tracking-wider">
                                                    Opening Loose Pieces ({formData.sales_unit}s)
                                                </label>
                                                <input
                                                    type="number"
                                                    value={openingPieces}
                                                    onChange={e => setOpeningPieces(Number(e.target.value))}
                                                    min="0"
                                                    placeholder="e.g. 20"
                                                    className="w-full px-3 py-2 bg-sky-50/60 border border-sky-200 rounded-xl focus:border-sky-500 outline-none text-xs font-mono font-black text-sky-900 text-center"
                                                />
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="pt-2 border-t border-slate-100">
                                            <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                                                Current Ledger Stock
                                            </label>
                                            <div className="flex gap-2">
                                                <div className="flex-1 px-2.5 py-1.5 bg-amber-50 border border-amber-200 rounded-xl text-xs font-black text-amber-900 font-mono">
                                                    📦 {bagStockData[editingProduct.pid] || 0} {editingProduct.purchase_unit}(s)
                                                </div>
                                                <div className="flex-1 px-2.5 py-1.5 bg-sky-50 border border-sky-200 rounded-xl text-xs font-black text-sky-900 font-mono">
                                                    🔢 {pieceStockData[editingProduct.pid] || 0} {editingProduct.sales_unit}(s)
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* SECTION 3: PRICING & LIVE PROFIT INTELLIGENCE MATRIX */}
                            {(modalActiveTab === 'pricing' || modalActiveTab === 'general' || modalActiveTab === 'stock') && (
                                <div className="bg-white rounded-2xl border border-slate-200/90 p-3.5 shadow-2xs space-y-2.5">
                                    <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                                        <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                                            <span>Pricing &amp; Live Profit Matrix</span>
                                        </h3>
                                        <span className="text-[9px] text-emerald-600 font-bold uppercase">Dual-Pricing</span>
                                    </div>

                                    {/* 3-Column Base Pricing Inputs */}
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-600 mb-1 uppercase tracking-wider">
                                                💵 Buy Price / {formData.purchase_unit}
                                            </label>
                                            <input
                                                type="number"
                                                value={formData.purchase_cost}
                                                onChange={e => setFormData({ ...formData, purchase_cost: parseFloat(e.target.value) || 0 })}
                                                min="0"
                                                step="0.01"
                                                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 outline-none focus:border-blue-500"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-[10px] font-bold text-emerald-700 mb-1 uppercase tracking-wider">
                                                💎 Sell Price / {formData.sales_unit} (Loose)
                                            </label>
                                            <input
                                                type="number"
                                                value={formData.sales_cost}
                                                onChange={e => setFormData({ ...formData, sales_cost: parseFloat(e.target.value) || 0 })}
                                                min="0"
                                                step="0.01"
                                                className="w-full px-2.5 py-1.5 bg-emerald-50/70 border border-emerald-300 rounded-xl text-xs font-mono font-black text-emerald-800 outline-none focus:border-emerald-500"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-[10px] font-bold text-purple-700 mb-1 uppercase tracking-wider">
                                                🤝 Wholesale / {formData.sales_unit}
                                            </label>
                                            <input
                                                type="number"
                                                value={formData.wholesale_price}
                                                onChange={e => setFormData({ ...formData, wholesale_price: parseFloat(e.target.value) || 0 })}
                                                min="0"
                                                step="0.01"
                                                placeholder="0.00"
                                                className="w-full px-2.5 py-1.5 bg-purple-50/70 border border-purple-200 rounded-xl text-xs font-mono font-bold text-purple-700 outline-none focus:border-purple-500"
                                            />
                                        </div>
                                    </div>

                                    {/* ── Pack / Box Selling Price (Big Quantity Price) ── */}
                                    <div className="p-3 bg-gradient-to-r from-indigo-50/90 via-purple-50/70 to-blue-50/90 rounded-2xl border-2 border-indigo-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                                        <div className="flex-1">
                                            <label className="block text-xs font-black text-indigo-950 uppercase tracking-wider flex items-center gap-1.5 mb-0.5">
                                                <span>📦 Selling Price / {formData.purchase_unit} (Big Qty Price in Ksh)</span>
                                            </label>
                                            <p className="text-[11px] text-indigo-700 font-medium leading-tight">
                                                1 {formData.purchase_unit} = {formData.pieces_per_package || 1} {formData.sales_unit}s. Charged at POS when selling a full {formData.purchase_unit}.
                                            </p>
                                        </div>
                                        <div className="w-full sm:w-60">
                                            <div className="relative">
                                                <span className="absolute left-3 top-2 text-xs font-bold text-indigo-500 font-mono">Ksh</span>
                                                <input
                                                    type="number"
                                                    step="any"
                                                    min="0"
                                                    value={formData.package_sales_cost || ''}
                                                    onChange={e => setFormData({ ...formData, package_sales_cost: parseFloat(e.target.value) || 0 })}
                                                    placeholder={String((formData.sales_cost || 0) * (formData.pieces_per_package || 1))}
                                                    className="w-full pl-11 pr-3 py-1.5 bg-white border-2 border-indigo-300 rounded-xl text-sm font-black text-indigo-900 focus:border-indigo-600 outline-none shadow-inner font-mono"
                                                />
                                            </div>
                                            <p className="text-[10px] text-slate-500 mt-1 text-right font-mono">
                                                Standard: Ksh {((formData.sales_cost || 0) * (formData.pieces_per_package || 1)).toLocaleString()}
                                                {formData.package_sales_cost && formData.package_sales_cost > 0 && formData.package_sales_cost !== ((formData.sales_cost || 0) * (formData.pieces_per_package || 1)) && (
                                                    <span className="font-bold ml-1 text-emerald-600">
                                                        (Special: Ksh {Number(formData.package_sales_cost).toLocaleString()})
                                                    </span>
                                                )}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Cost per piece override */}
                                    {formData.pieces_per_package > 1 && (
                                        <div className="p-2 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                                            <div>
                                                <span className="font-bold text-slate-700">Cost Per Piece:</span>{' '}
                                                <span className="font-mono font-black text-blue-700">
                                                    Ksh {(formData.purchase_cost / formData.pieces_per_package).toFixed(2)}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[10px] text-slate-400 font-bold uppercase">Override:</span>
                                                <input
                                                    type="number"
                                                    value={costPerPieceOverride !== null ? costPerPieceOverride : ''}
                                                    onChange={e => setCostPerPieceOverride(e.target.value ? parseFloat(e.target.value) : null)}
                                                    placeholder="Auto"
                                                    step="0.01"
                                                    className="w-16 px-1.5 py-0.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-center outline-none"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* 3 Compact Live Profit Cards */}
                                    {(() => {
                                        const ppp = formData.pieces_per_package || 1;
                                        const cpp = costPerPieceOverride !== null ? costPerPieceOverride : (ppp > 1 ? formData.purchase_cost / ppp : formData.purchase_cost);
                                        const retailProfit = formData.sales_cost - cpp;
                                        const retailMargin = calcMargin(formData.sales_cost, cpp);

                                        const wsProfit = (formData.wholesale_price || 0) > 0 ? (formData.wholesale_price - cpp) : 0;
                                        const wsMargin = (formData.wholesale_price || 0) > 0 ? calcMargin(formData.wholesale_price, cpp) : 0;

                                        const boxSell = (formData.package_sales_cost || 0) > 0 ? (formData.package_sales_cost || 0) : (formData.sales_cost * ppp);
                                        const boxProfit = boxSell - formData.purchase_cost;
                                        const boxMargin = calcMargin(boxSell, formData.purchase_cost);

                                        return (
                                            <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-100">
                                                <div className="bg-emerald-50 rounded-xl p-2 border border-emerald-200">
                                                    <div className="text-[9px] font-bold text-emerald-800 uppercase">Retail Margin</div>
                                                    <div className="text-xs font-black text-emerald-900 font-mono mt-0.5">
                                                        +{fmtKES(retailProfit)}/pc
                                                    </div>
                                                    <div className="text-[9px] font-bold text-emerald-700">+{retailMargin}% Gross</div>
                                                </div>

                                                <div className="bg-purple-50 rounded-xl p-2 border border-purple-200">
                                                    <div className="text-[9px] font-bold text-purple-800 uppercase">Wholesale</div>
                                                    <div className="text-xs font-black text-purple-900 font-mono mt-0.5">
                                                        {formData.wholesale_price > 0 ? `+${fmtKES(wsProfit)}/pc` : '—'}
                                                    </div>
                                                    <div className="text-[9px] font-bold text-purple-700">
                                                        {formData.wholesale_price > 0 ? `+${wsMargin}% Margin` : 'None'}
                                                    </div>
                                                </div>

                                                <div className="bg-indigo-50 rounded-xl p-2 border border-indigo-200">
                                                    <div className="text-[9px] font-bold text-indigo-800 uppercase">Full Box</div>
                                                    <div className="text-xs font-black text-indigo-900 font-mono mt-0.5">
                                                        +{fmtKES(boxProfit)}/box
                                                    </div>
                                                    <div className="text-[9px] font-bold text-indigo-700">+{boxMargin}% Markup</div>
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>
                            )}

                            {/* SECTION 4: BATCH & EXPIRY MANAGEMENT SUITE */}
                            {(modalActiveTab === 'batches' || modalActiveTab === 'general') && (
                                <div className="bg-white rounded-2xl border border-slate-200/90 p-3.5 shadow-2xs space-y-2.5">
                                    <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                                        <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                                            <span>Expiry &amp; Lot Batches</span>
                                            <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded-full bg-orange-100 text-orange-800">
                                                {productBatches.length} Batches
                                            </span>
                                        </h3>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setBatchForm({
                                                    batch_number: `BAT-${Date.now().toString().slice(-6)}`,
                                                    expiry_date: '',
                                                    qty_received: 0,
                                                    qty_remaining: 0,
                                                    cost_price: formData.purchase_cost,
                                                    selling_price: formData.sales_cost,
                                                    supplier_name: formData.supplier_name,
                                                });
                                                setEditingBatchIdx(null);
                                                setShowBatchForm(true);
                                            }}
                                            className="px-2.5 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1"
                                        >
                                            <FiPlus size={11} /> Add Batch
                                        </button>
                                    </div>

                                    {/* Inline Add / Edit Batch Form */}
                                    {showBatchForm && (
                                        <div className="bg-orange-50/70 rounded-xl p-3 border border-orange-200 space-y-2 animate-fadeIn">
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                                <div>
                                                    <label className="block text-[9px] font-bold text-slate-600 uppercase mb-0.5">
                                                        Batch #
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={batchForm.batch_number}
                                                        onChange={e => setBatchForm({ ...batchForm, batch_number: e.target.value })}
                                                        placeholder="Auto"
                                                        className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold outline-none"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[9px] font-bold text-rose-600 uppercase mb-0.5">
                                                        Expiry Date *
                                                    </label>
                                                    <input
                                                        type="date"
                                                        value={batchForm.expiry_date}
                                                        onChange={e => setBatchForm({ ...batchForm, expiry_date: e.target.value })}
                                                        required
                                                        className="w-full px-2 py-1 bg-white border border-rose-300 rounded-lg text-xs font-bold text-slate-800 outline-none"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[9px] font-bold text-slate-600 uppercase mb-0.5">
                                                        Supplier
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={batchForm.supplier_name}
                                                        onChange={e => setBatchForm({ ...batchForm, supplier_name: e.target.value })}
                                                        placeholder="Optional"
                                                        className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none"
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-4 gap-2">
                                                <div>
                                                    <label className="block text-[9px] font-bold text-slate-600 uppercase mb-0.5">
                                                        Qty Received
                                                    </label>
                                                    <input
                                                        type="number"
                                                        value={batchForm.qty_received}
                                                        onChange={e => {
                                                            const val = Number(e.target.value) || 0;
                                                            setBatchForm({
                                                                ...batchForm,
                                                                qty_received: val,
                                                                qty_remaining: editingBatchIdx !== null ? batchForm.qty_remaining : val,
                                                            });
                                                        }}
                                                        className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold outline-none"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[9px] font-bold text-slate-600 uppercase mb-0.5">
                                                        Qty Left
                                                    </label>
                                                    <input
                                                        type="number"
                                                        value={batchForm.qty_remaining}
                                                        onChange={e => setBatchForm({ ...batchForm, qty_remaining: Number(e.target.value) || 0 })}
                                                        className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold outline-none"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[9px] font-bold text-slate-600 uppercase mb-0.5">
                                                        Cost
                                                    </label>
                                                    <input
                                                        type="number"
                                                        value={batchForm.cost_price}
                                                        onChange={e => setBatchForm({ ...batchForm, cost_price: Number(e.target.value) || 0 })}
                                                        className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold outline-none"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[9px] font-bold text-slate-600 uppercase mb-0.5">
                                                        Sell
                                                    </label>
                                                    <input
                                                        type="number"
                                                        value={batchForm.selling_price}
                                                        onChange={e => setBatchForm({ ...batchForm, selling_price: Number(e.target.value) || 0 })}
                                                        className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold outline-none"
                                                    />
                                                </div>
                                            </div>

                                            <div className="flex justify-end gap-1.5 pt-1">
                                                <button
                                                    type="button"
                                                    onClick={() => setShowBatchForm(false)}
                                                    className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 rounded-lg text-xs font-bold text-slate-700"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={handleSaveBatch}
                                                    className="px-3 py-1 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-bold shadow-xs"
                                                >
                                                    {editingBatchIdx !== null ? 'Save Batch' : 'Queue Batch'}
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Batches Table List */}
                                    {productBatches.length > 0 ? (
                                        <div className="overflow-x-auto rounded-xl border border-slate-200">
                                            <table className="w-full text-left text-xs divide-y divide-slate-100">
                                                <thead className="bg-slate-50 text-[9px] font-black uppercase text-slate-600">
                                                    <tr>
                                                        <th className="p-2">Batch #</th>
                                                        <th className="p-2">Expiry</th>
                                                        <th className="p-2 text-center">Left</th>
                                                        <th className="p-2 text-right">Cost</th>
                                                        <th className="p-2 text-right">Sell</th>
                                                        <th className="p-2 text-center">Status</th>
                                                        <th className="p-2 text-center">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                                                    {productBatches.map((b, idx) => {
                                                        const status = getBatchStatus(b.expiry_date);
                                                        return (
                                                            <tr key={idx} className="hover:bg-slate-50">
                                                                <td className="p-2 font-bold text-slate-800">{b.batch_number}</td>
                                                                <td className="p-2 text-slate-600">{b.expiry_date}</td>
                                                                <td className="p-2 text-center font-bold text-blue-700">{b.qty_remaining}</td>
                                                                <td className="p-2 text-right text-slate-600">{fmtKES(b.cost_price)}</td>
                                                                <td className="p-2 text-right text-emerald-700 font-bold">{fmtKES(b.selling_price)}</td>
                                                                <td className="p-2 text-center">
                                                                    <span
                                                                        className={`inline-block px-1.5 py-0.2 rounded text-[9px] font-bold border ${status.bg} ${status.color} ${status.border}`}
                                                                    >
                                                                        {status.label}
                                                                    </span>
                                                                </td>
                                                                <td className="p-2 text-center">
                                                                    <div className="flex items-center justify-center gap-1 font-sans">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleEditBatch(idx)}
                                                                            className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                                                                        >
                                                                            <FiEdit2 size={11} />
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleDeleteBatch(idx)}
                                                                            className="p-1 text-rose-600 hover:bg-rose-50 rounded"
                                                                        >
                                                                            <FiTrash2 size={11} />
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : (
                                        <div className="p-3 bg-slate-50 rounded-xl text-center text-xs text-slate-400">
                                            No tracking batches recorded for this product.
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* SECTION 5: TAX, SUPPLIER & REORDER SAFETY */}
                            {(modalActiveTab === 'tax' || modalActiveTab === 'general') && (
                                <div className="bg-white rounded-2xl border border-slate-200/90 p-3.5 shadow-2xs space-y-2.5">
                                    <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                                        <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                                            <span>Taxation &amp; Logistics</span>
                                        </h3>
                                        <span className="text-[9px] text-slate-400 font-bold uppercase">Compliance</span>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                                                VAT Commodity
                                            </label>
                                            <select
                                                value={formData.vat_commodity}
                                                onChange={e => setFormData({ ...formData, vat_commodity: e.target.value })}
                                                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-blue-500 outline-none text-xs font-bold cursor-pointer"
                                            >
                                                {vatOptions.map(v => (
                                                    <option key={v} value={v}>
                                                        {v}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                                                Reorder Safety Point
                                            </label>
                                            <input
                                                type="number"
                                                value={formData.reorder_point}
                                                onChange={e => setFormData({ ...formData, reorder_point: parseInt(e.target.value, 10) || 0 })}
                                                min="0"
                                                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-blue-500 outline-none text-xs font-mono font-bold"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                                                Supplier
                                            </label>
                                            <select
                                                value={formData.supplier_name}
                                                onChange={e => setFormData({ ...formData, supplier_name: e.target.value })}
                                                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-blue-500 outline-none text-xs font-bold cursor-pointer"
                                            >
                                                <option value="">Select Supplier</option>
                                                {suppliers.map(s => (
                                                    <option key={s.supplier_id} value={s.supplier_name}>
                                                        {s.supplier_name} {s.is_kitchen ? '(Kitchen)' : ''}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* SECTION 6: POS THEME & IMAGE */}
                            {(modalActiveTab === 'pos' || modalActiveTab === 'general') && (
                                <div className="bg-white rounded-2xl border border-slate-200/90 p-3.5 shadow-2xs space-y-2.5">
                                    <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                                        <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                                            <span>POS Tile Palette &amp; Image</span>
                                        </h3>
                                        <span className="text-[9px] text-slate-400 font-bold uppercase">Appearance</span>
                                    </div>

                                    {/* 14 POS Color Gradient Presets */}
                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                                            Tile Gradient Swatch
                                        </label>
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            {colorPresets.map(preset => {
                                                const isSelected = formData.button_ui_color === preset.gradient;
                                                return (
                                                    <button
                                                        key={preset.name}
                                                        type="button"
                                                        onClick={() => setFormData({ ...formData, button_ui_color: preset.gradient })}
                                                        className={`w-6 h-6 rounded-lg bg-gradient-to-tr ${preset.gradient} transition-transform ${
                                                            isSelected ? 'scale-125 ring-2 ring-blue-600 ring-offset-1 shadow-xs' : 'opacity-80 hover:opacity-100'
                                                        }`}
                                                        title={preset.name}
                                                    />
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Image & URL */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-slate-100">
                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-700 mb-1 uppercase tracking-wider">
                                                Image URL
                                            </label>
                                            <input
                                                type="text"
                                                value={formData.photo}
                                                onChange={e => setFormData({ ...formData, photo: e.target.value })}
                                                placeholder="https://..."
                                                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono outline-none focus:border-blue-500"
                                            />
                                        </div>

                                        <div className="flex items-center gap-2.5">
                                            <div
                                                className={`w-10 h-10 rounded-xl bg-gradient-to-tr ${formData.button_ui_color} flex items-center justify-center text-white font-black text-xs shadow-xs overflow-hidden shrink-0`}
                                            >
                                                {formData.photo ? (
                                                    <img src={formData.photo} alt="Preview" className="w-full h-full object-cover" />
                                                ) : (
                                                    formData.product_name ? formData.product_name.slice(0, 2).toUpperCase() : 'POS'
                                                )}
                                            </div>
                                            <div className="text-[11px] text-slate-500 leading-tight">
                                                <div className="font-bold text-slate-800">Cashier Tile Preview</div>
                                                <div className="text-[10px] text-slate-400">Renders on touchscreen</div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Checkboxes */}
                                    <div className="flex items-center gap-6 pt-2">
                                        <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-slate-800">
                                            <input
                                                type="checkbox"
                                                checked={formData.active}
                                                onChange={e => setFormData({ ...formData, active: e.target.checked })}
                                                className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-0 cursor-pointer"
                                            />
                                            <span>Active SKU</span>
                                        </label>

                                        <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-slate-800">
                                            <input
                                                type="checkbox"
                                                checked={formData.show_ps}
                                                onChange={e => setFormData({ ...formData, show_ps: e.target.checked })}
                                                className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-0 cursor-pointer"
                                            />
                                            <span>Show in POS</span>
                                        </label>
                                    </div>
                                </div>
                            )}

                            {/* ─── MODAL FOOTER ACTIONS ─── */}
                            <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-700 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className="px-5 py-1.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 text-white rounded-xl text-xs font-black shadow-md hover:shadow-blue-500/25 transition-all flex items-center gap-1.5 active:scale-98 disabled:opacity-50"
                                >
                                    {isSaving ? (
                                        <>
                                            <FiRefreshCw size={13} className="animate-spin" />
                                            <span>Saving...</span>
                                        </>
                                    ) : (
                                        <>
                                            <FiCheck size={13} className="stroke-[3]" />
                                            <span>{editingProduct ? 'Save Changes' : 'Create Product'}</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}


            {/* ━━━ BARCODE LABEL GENERATOR MODAL ━━━ */}
            {showLabelModal && (
                <div
                    className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-50 animate-fadeIn"
                    onClick={() => setShowLabelModal(false)}
                >
                    <div
                        className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden border border-slate-100 flex flex-col"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 text-white flex items-center justify-between shrink-0 shadow-md">
                            <div className="flex items-center gap-2.5">
                                <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center">
                                    <FiPrinter size={20} />
                                </div>
                                <div>
                                    <h3 className="text-sm sm:text-base font-black">🏷️ Barcode & Shelf Label Studio</h3>
                                    <p className="text-indigo-100 text-xs font-mono">Format, Print & Shelf Tag Matrix</p>
                                </div>
                            </div>
                            <button onClick={() => setShowLabelModal(false)} className="p-2 hover:bg-white/20 rounded-xl text-white">
                                <FiX size={18} />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto space-y-4 flex-1">
                            {/* Format Size Selector */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                                    Select Label Format Size
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                    {(['small', 'medium', 'large'] as const).map(size => (
                                        <button
                                            key={size}
                                            type="button"
                                            onClick={() => setLabelSize(size)}
                                            className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-center capitalize ${
                                                labelSize === size
                                                    ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-2xs'
                                                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                            }`}
                                        >
                                            {size} ({size === 'small' ? '38x25mm' : size === 'medium' ? '50x30mm' : '70x40mm'})
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Product Search & Select for labels */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                                    Queue Products for Barcodes ({labelProducts.length} Selected)
                                </label>
                                <div className="relative mb-2">
                                    <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                                    <input
                                        type="text"
                                        value={labelSearch}
                                        onChange={e => setLabelSearch(e.target.value)}
                                        placeholder="Search products to add to label print queue..."
                                        className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:border-indigo-500"
                                    />
                                </div>

                                <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
                                    {products
                                        .filter(p => !labelSearch || p.product_name.toLowerCase().includes(labelSearch.toLowerCase()))
                                        .slice(0, 30)
                                        .map(p => {
                                            const isSelected = labelProducts.includes(p.pid);
                                            return (
                                                <div
                                                    key={p.pid}
                                                    className={`p-2 flex items-center justify-between text-xs hover:bg-slate-50 ${
                                                        isSelected ? 'bg-indigo-50/50' : ''
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={() => {
                                                                if (isSelected) {
                                                                    setLabelProducts(prev => prev.filter(id => id !== p.pid));
                                                                } else {
                                                                    setLabelProducts(prev => [...prev, p.pid]);
                                                                    setLabelQty(prev => ({ ...prev, [p.pid]: 1 }));
                                                                }
                                                            }}
                                                            className="rounded border-slate-300 text-indigo-600 focus:ring-0"
                                                        />
                                                        <div>
                                                            <div className="font-bold text-slate-800">{p.product_name}</div>
                                                            <div className="text-[10px] font-mono text-slate-400">
                                                                {p.product_code} • Ksh {formatKsh(p.sales_cost)}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {isSelected && (
                                                        <div className="flex items-center gap-1 font-mono">
                                                            <span className="text-[10px] text-slate-500 font-bold">Qty:</span>
                                                            <input
                                                                type="number"
                                                                min="1"
                                                                value={labelQty[p.pid] || 1}
                                                                onChange={e =>
                                                                    setLabelQty({ ...labelQty, [p.pid]: Math.max(1, parseInt(e.target.value, 10) || 1) })
                                                                }
                                                                className="w-14 px-2 py-0.5 border border-slate-200 rounded text-center text-xs font-bold"
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                </div>
                            </div>
                        </div>

                        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
                            <span className="text-xs text-slate-500 font-mono">
                                Total tags to print:{' '}
                                <strong className="text-slate-800">
                                    {labelProducts.reduce((sum, id) => sum + (labelQty[id] || 1), 0)}
                                </strong>
                            </span>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setShowLabelModal(false)}
                                    className="px-3 py-2 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl text-xs font-bold text-slate-700"
                                >
                                    Close
                                </button>
                                <button
                                    onClick={printLabels}
                                    className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl text-xs font-black shadow-md flex items-center gap-1.5"
                                >
                                    <FiPrinter size={13} />
                                    <span>Print Barcode Sheets</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ━━━ FAST ITEM LOOKUP MODAL ━━━ */}
            {showLookupModal && (
                <div
                    className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-50 animate-fadeIn"
                    onClick={() => setShowLookupModal(false)}
                >
                    <div
                        className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100 flex flex-col"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="bg-gradient-to-r from-sky-600 to-blue-600 px-6 py-4 text-white flex items-center justify-between shadow-md">
                            <div className="flex items-center gap-2.5">
                                <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center">
                                    <FiSearch size={20} />
                                </div>
                                <div>
                                    <h3 className="text-sm sm:text-base font-black">🔍 Fast Product Price & Stock Scanner</h3>
                                    <p className="text-sky-100 text-xs font-mono">Instant SKU verification</p>
                                </div>
                            </div>
                            <button onClick={() => setShowLookupModal(false)} className="p-2 hover:bg-white/20 rounded-xl text-white">
                                <FiX size={18} />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div className="relative">
                                <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                <input
                                    type="text"
                                    autoFocus
                                    value={lookupQuery}
                                    onChange={e => doLookup(e.target.value)}
                                    placeholder="Scan barcode or type product name/SKU..."
                                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl text-sm font-bold outline-none focus:border-sky-500 focus:bg-white transition-all font-mono"
                                />
                            </div>

                            {lookupResult ? (
                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <h4 className="text-sm font-black text-slate-900">{lookupResult.product_name}</h4>
                                            <div className="text-xs font-mono text-slate-500 mt-0.5">
                                                {lookupResult.product_code} • Barcode: {lookupResult.barcode || 'None'}
                                            </div>
                                        </div>
                                        <span className="px-2 py-0.5 rounded-lg text-xs font-bold bg-blue-100 text-blue-700">
                                            {lookupResult.category}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                                        <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                                            <span className="text-[10px] text-slate-400 block uppercase font-bold">💎 Retail Price</span>
                                            <span className="text-sm font-black text-emerald-700">
                                                Ksh {formatKsh(lookupResult.sales_cost)}
                                            </span>
                                        </div>
                                        <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                                            <span className="text-[10px] text-slate-400 block uppercase font-bold">📦 Big Qty Price</span>
                                            <span className="text-sm font-black text-indigo-700">
                                                Ksh {formatKsh(lookupResult.package_sales_cost || 0)}
                                            </span>
                                        </div>
                                        <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                                            <span className="text-[10px] text-slate-400 block uppercase font-bold">📦 Bulk Stock</span>
                                            <span className="text-sm font-black text-amber-800">
                                                {bagStockData[lookupResult.pid] || 0} {lookupResult.purchase_unit}
                                            </span>
                                        </div>
                                        <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                                            <span className="text-[10px] text-slate-400 block uppercase font-bold">🔢 Loose Pieces</span>
                                            <span className="text-sm font-black text-sky-800">
                                                {pieceStockData[lookupResult.pid] || 0} {lookupResult.sales_unit}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="pt-2 flex justify-end gap-2 border-t border-slate-200">
                                        <button
                                            onClick={() => {
                                                setShowLookupModal(false);
                                                openEditModal(lookupResult);
                                            }}
                                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1"
                                        >
                                            <FiEdit2 size={12} /> Edit Product
                                        </button>
                                    </div>
                                </div>
                            ) : lookupQuery ? (
                                <div className="p-6 text-center text-xs text-slate-400">
                                    No item matching "{lookupQuery}" found in active store catalog
                                </div>
                            ) : (
                                <div className="p-6 text-center text-xs text-slate-400">
                                    Scan barcode scanner or start typing to inspect inventory record
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ━━━ STOCK HISTORY LEDGER MODAL ━━━ */}
            {showStockHistoryModal && stockHistoryProduct && (
                <div
                    className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-50 animate-fadeIn"
                    onClick={() => setShowStockHistoryModal(false)}
                >
                    <div
                        className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden border border-slate-100 flex flex-col"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="bg-gradient-to-r from-teal-600 to-emerald-600 px-6 py-4 text-white flex items-center justify-between shadow-md">
                            <div>
                                <h3 className="text-sm sm:text-base font-black flex items-center gap-2">
                                    <span>📊 Stock Movement Ledger</span>
                                    <span className="text-xs bg-white/20 px-2 py-0.5 rounded-md font-mono">
                                        {stockHistoryProduct.product_code}
                                    </span>
                                </h3>
                                <p className="text-teal-100 text-xs font-medium">{stockHistoryProduct.product_name}</p>
                            </div>
                            <button onClick={() => setShowStockHistoryModal(false)} className="p-2 hover:bg-white/20 rounded-xl text-white">
                                <FiX size={18} />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto space-y-3 flex-1 font-mono text-xs">
                            {stockHistory.length > 0 ? (
                                <div className="rounded-xl border border-slate-200 overflow-hidden">
                                    <table className="w-full text-left divide-y divide-slate-100">
                                        <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-600">
                                            <tr>
                                                <th className="p-2.5">Date</th>
                                                <th className="p-2.5">Ref / Source</th>
                                                <th className="p-2.5">Type</th>
                                                <th className="p-2.5 text-right">In</th>
                                                <th className="p-2.5 text-right">Out</th>
                                                <th className="p-2.5 text-right">Balance</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {stockHistory.map((row, idx) => (
                                                <tr key={idx} className="hover:bg-slate-50">
                                                    <td className="p-2.5 text-slate-500 text-[11px]">{row.date}</td>
                                                    <td className="p-2.5 font-bold text-slate-800">{row.ref}</td>
                                                    <td className="p-2.5">
                                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                                                            {row.type}
                                                        </span>
                                                    </td>
                                                    <td className="p-2.5 text-right text-emerald-600 font-bold">
                                                        {row.qty_in > 0 ? `+${row.qty_in}` : '—'}
                                                    </td>
                                                    <td className="p-2.5 text-right text-rose-600 font-bold">
                                                        {row.qty_out > 0 ? `-${row.qty_out}` : '—'}
                                                    </td>
                                                    <td className="p-2.5 text-right font-black text-slate-900">{row.balance}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="p-8 text-center text-slate-400">No previous stock movement ledger records found</div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ━━━ PRICE HISTORY TIMELINE MODAL ━━━ */}
            {showPriceHistoryModal && priceHistoryProduct && (
                <div
                    className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-50 animate-fadeIn"
                    onClick={() => setShowPriceHistoryModal(false)}
                >
                    <div
                        className="bg-white rounded-3xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-hidden border border-slate-100 flex flex-col"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-4 text-white flex items-center justify-between shadow-md">
                            <div>
                                <h3 className="text-sm sm:text-base font-black flex items-center gap-2">
                                    <span>📈 Price Adjustment Audit Log</span>
                                    <span className="text-xs bg-white/20 px-2 py-0.5 rounded-md font-mono">
                                        {priceHistoryProduct.product_code}
                                    </span>
                                </h3>
                                <p className="text-purple-100 text-xs font-medium">{priceHistoryProduct.product_name}</p>
                            </div>
                            <button onClick={() => setShowPriceHistoryModal(false)} className="p-2 hover:bg-white/20 rounded-xl text-white">
                                <FiX size={18} />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto space-y-3 flex-1 font-mono text-xs">
                            {priceHistory.length > 0 ? (
                                <div className="rounded-xl border border-slate-200 overflow-hidden">
                                    <table className="w-full text-left divide-y divide-slate-100">
                                        <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-600">
                                            <tr>
                                                <th className="p-2.5">Date</th>
                                                <th className="p-2.5 text-right">Old Buy</th>
                                                <th className="p-2.5 text-right">New Buy</th>
                                                <th className="p-2.5 text-right">Old Sell</th>
                                                <th className="p-2.5 text-right">New Sell</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {priceHistory.map((row, idx) => (
                                                <tr key={idx} className="hover:bg-slate-50">
                                                    <td className="p-2.5 text-slate-500 text-[11px]">{row.date}</td>
                                                    <td className="p-2.5 text-right text-slate-500">Ksh {formatKsh(row.old_buy)}</td>
                                                    <td className="p-2.5 text-right font-bold text-slate-800">Ksh {formatKsh(row.new_buy)}</td>
                                                    <td className="p-2.5 text-right text-slate-500">Ksh {formatKsh(row.old_sell)}</td>
                                                    <td className="p-2.5 text-right font-bold text-emerald-700">Ksh {formatKsh(row.new_sell)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="p-8 text-center text-slate-400">No historical price changes recorded for this item</div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ━━━ DUAL-STOCK ADJUSTMENT MODAL ━━━ */}
            {showStockAdjustModal && adjustProduct && (
                <div
                    className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-50 animate-fadeIn"
                    onClick={() => setShowStockAdjustModal(false)}
                >
                    <div
                        className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 flex flex-col"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="bg-gradient-to-r from-amber-500 to-orange-600 px-6 py-4 text-white flex items-center justify-between shadow-md">
                            <div>
                                <h3 className="text-sm sm:text-base font-black flex items-center gap-2">
                                    <span>⚖️ Adjust Inventory Balance</span>
                                </h3>
                                <p className="text-amber-100 text-xs font-mono">{adjustProduct.product_name}</p>
                            </div>
                            <button onClick={() => setShowStockAdjustModal(false)} className="p-2 hover:bg-white/20 rounded-xl text-white">
                                <FiX size={18} />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            {/* Current Stock Snapshot */}
                            <div className="p-3 bg-amber-50/70 rounded-2xl border border-amber-200 text-xs flex justify-between font-mono">
                                <div>
                                    <span className="text-[10px] text-amber-800 font-bold block">Current Bulk:</span>
                                    <strong className="text-sm text-amber-900">
                                        {bagStockData[adjustProduct.pid] || 0} {adjustProduct.purchase_unit}
                                    </strong>
                                </div>
                                <div className="text-right">
                                    <span className="text-[10px] text-amber-800 font-bold block">Current Pieces:</span>
                                    <strong className="text-sm text-amber-900">
                                        {pieceStockData[adjustProduct.pid] || 0} {adjustProduct.sales_unit}
                                    </strong>
                                </div>
                            </div>

                            {/* Adjustment Type */}
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    onClick={() => setAdjustType('add')}
                                    className={`p-2.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                                        adjustType === 'add'
                                            ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-2xs'
                                            : 'bg-white border-slate-200 text-slate-600'
                                    }`}
                                >
                                    <FiPlus size={14} /> Add Stock (+)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setAdjustType('remove')}
                                    className={`p-2.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                                        adjustType === 'remove'
                                            ? 'bg-rose-50 border-rose-500 text-rose-800 shadow-2xs'
                                            : 'bg-white border-slate-200 text-slate-600'
                                    }`}
                                >
                                    <FiX size={14} /> Deduct Stock (-)
                                </button>
                            </div>

                            {/* Dual Inputs */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        {adjustProduct.purchase_unit}s (Bulk)
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={adjustBags}
                                        onChange={e => setAdjustBags(Math.max(0, parseInt(e.target.value, 10) || 0))}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-center outline-none focus:border-amber-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        {adjustProduct.sales_unit}s (Loose)
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={adjustPieces}
                                        onChange={e => setAdjustPieces(Math.max(0, parseInt(e.target.value, 10) || 0))}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-center outline-none focus:border-amber-500"
                                    />
                                </div>
                            </div>

                            {/* Reason */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Reason for Adjustment</label>
                                <select
                                    value={adjustReason}
                                    onChange={e => setAdjustReason(e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none cursor-pointer"
                                >
                                    <option value="Physical Stocktake Audit">Physical Stocktake Audit</option>
                                    <option value="Damaged Goods Write-off">Damaged Goods Write-off</option>
                                    <option value="Expired Stock Removal">Expired Stock Removal</option>
                                    <option value="Supplier Return">Supplier Return</option>
                                    <option value="Internal Store Transfer">Internal Store Transfer</option>
                                    <option value="Initial Opening Stock Correction">Initial Opening Stock Correction</option>
                                </select>
                            </div>

                            <button
                                type="button"
                                onClick={submitStockAdjust}
                                className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl text-xs font-black shadow-md hover:from-amber-600 hover:to-orange-700 transition-all"
                            >
                                Confirm Stock Adjustment
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ━━━ CSV BATCH IMPORTER MODAL ━━━ */}
            {showImportModal && (
                <div
                    className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-50 animate-fadeIn"
                    onClick={() => setShowImportModal(false)}
                >
                    <div
                        className="bg-white rounded-3xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-hidden border border-slate-100 flex flex-col"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-4 text-white flex items-center justify-between shadow-md">
                            <div className="flex items-center gap-2.5">
                                <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center">
                                    <FiUpload size={20} />
                                </div>
                                <div>
                                    <h3 className="text-sm sm:text-base font-black">📤 Batch CSV Catalog Importer</h3>
                                    <p className="text-violet-100 text-xs font-mono">Fast bulk migration & price update</p>
                                </div>
                            </div>
                            <button onClick={() => setShowImportModal(false)} className="p-2 hover:bg-white/20 rounded-xl text-white">
                                <FiX size={18} />
                            </button>
                        </div>

                        <div className="p-6 space-y-4 overflow-y-auto">
                            {/* File Upload Dropzone */}
                            <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center hover:border-violet-400 transition-colors">
                                <FiFileText className="text-violet-500 mx-auto mb-2" size={32} />
                                <label className="cursor-pointer">
                                    <span className="text-xs font-bold text-violet-600 hover:text-violet-700">
                                        Choose CSV File to Upload
                                    </span>
                                    <input
                                        type="file"
                                        accept=".csv,text/csv"
                                        onChange={e => setImportFile(e.target.files?.[0] || null)}
                                        className="hidden"
                                    />
                                </label>
                                {importFile && (
                                    <p className="text-xs font-mono font-bold text-slate-800 mt-2">
                                        Selected: {importFile.name} ({(importFile.size / 1024).toFixed(1)} KB)
                                    </p>
                                )}
                            </div>

                            {/* Import Mode */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                                    Import Conflict Policy
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                    {(['add_new', 'update', 'overwrite'] as const).map(mode => (
                                        <button
                                            key={mode}
                                            type="button"
                                            onClick={() => setImportMode(mode)}
                                            className={`p-2 rounded-xl border text-[11px] font-bold transition-all capitalize ${
                                                importMode === mode
                                                    ? 'bg-violet-50 border-violet-500 text-violet-700 shadow-2xs'
                                                    : 'bg-white border-slate-200 text-slate-600'
                                            }`}
                                        >
                                            {mode === 'add_new' && 'Add New Only'}
                                            {mode === 'update' && 'Update Prices'}
                                            {mode === 'overwrite' && 'Overwrite All'}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Progress bar during import */}
                            {importStatus === 'importing' && (
                                <div className="space-y-1">
                                    <div className="flex justify-between text-xs font-mono text-slate-600">
                                        <span>Importing {importCurrentItem}...</span>
                                        <span>{importProgress}%</span>
                                    </div>
                                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                                        <div
                                            className="bg-violet-600 h-full transition-all duration-300"
                                            style={{ width: `${importProgress}%` }}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Results & Error log */}
                            {importErrors.length > 0 && (
                                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 max-h-36 overflow-y-auto font-mono space-y-1">
                                    <div className="font-bold">Import Warnings:</div>
                                    {importErrors.map((err, i) => (
                                        <div key={i}>{err}</div>
                                    ))}
                                </div>
                            )}

                            <button
                                type="button"
                                onClick={importProducts}
                                disabled={!importFile || importStatus === 'importing'}
                                className="w-full py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl text-xs font-black shadow-md hover:from-violet-700 hover:to-indigo-700 transition-all disabled:opacity-50"
                            >
                                {importStatus === 'importing' ? 'Processing CSV Records...' : 'Start Batch Import'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}


