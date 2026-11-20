'use client';

import { useState, useEffect, useCallback } from 'react';
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
    FiHash
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
    { name: 'Orange', gradient: 'from-orange-400 to-orange-600', hex: '#F97316' },
    { name: 'Red', gradient: 'from-red-400 to-red-600', hex: '#EF4444' },
    { name: 'Yellow Orange', gradient: 'from-yellow-500 to-orange-500', hex: '#F59E0B' },
    { name: 'Pink', gradient: 'from-red-500 to-pink-600', hex: '#EC4899' },
    { name: 'Rose', gradient: 'from-rose-500 to-red-600', hex: '#F43F5E' },
    { name: 'Green', gradient: 'from-green-400 to-emerald-600', hex: '#10B981' },
    { name: 'Yellow', gradient: 'from-yellow-400 to-yellow-600', hex: '#EAB308' },
    { name: 'Amber', gradient: 'from-amber-400 to-amber-600', hex: '#F59E0B' },
    { name: 'Blue', gradient: 'from-blue-400 to-blue-600', hex: '#3B82F6' },
    { name: 'Cyan', gradient: 'from-cyan-400 to-cyan-600', hex: '#06B6D4' },
    { name: 'Teal', gradient: 'from-teal-400 to-teal-600', hex: '#14B8A6' },
    { name: 'Purple', gradient: 'from-purple-400 to-purple-600', hex: '#A855F7' },
    { name: 'Brown', gradient: 'from-amber-600 to-amber-800', hex: '#92400E' },
    { name: 'Red Dark', gradient: 'from-red-600 to-red-800', hex: '#DC2626' },
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

const fmtKES = (n: number) => `Ksh ${Math.round(n || 0).toLocaleString('en-KE')}`;
const fmtK = (n: number) => {
    if (n >= 1_000_000) return `Ksh ${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000) return `Ksh ${(n / 1_000).toFixed(1)}K`;
    return `Ksh ${Math.round(n || 0).toLocaleString('en-KE')}`;
};

// Helper: Fetch ALL retail_stock rows by paginating
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
        if (error) { console.error('Stock fetch page error:', page, error.message); break; }
        if (data && data.length > 0) allRows = allRows.concat(data);
        if (!data || data.length < PAGE_SIZE) hasMore = false;
        else page++;
    }
    return allRows;
}

export default function ProductsPage() {
    const { activeOutlet, expiryEnabled } = useOutlet();
    const outletId = activeOutlet?.outlet_id || 1;

    // Core Data
    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [units, setUnits] = useState<Unit[]>(defUnits);
    const [companyName, setCompanyName] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    // Modal & Form State
    const [showModal, setShowModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [previewPid, setPreviewPid] = useState<number | null>(null);
    const [previewCode, setPreviewCode] = useState<string>('');
    const [formData, setFormData] = useState(defaultProduct);
    const [isSaving, setIsSaving] = useState(false);
    const [openingBags, setOpeningBags] = useState(0);
    const [openingPieces, setOpeningPieces] = useState(0);

    // Stock Data Maps
    const [stockData, setStockData] = useState<Record<number, number>>({});
    const [bagStockData, setBagStockData] = useState<Record<number, number>>({});
    const [pieceStockData, setPieceStockData] = useState<Record<number, number>>({});

    // Views & Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCategory, setFilterCategory] = useState('All');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
    const [showValuation, setShowValuation] = useState(true);
    const [showInactive, setShowInactive] = useState(false);
    const [selectedPids, setSelectedPids] = useState<Set<number>>(new Set());
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(20);
    const [isAddMode, setIsAddMode] = useState(false);

    // Feature Flags from license
    const [hasRetailProfitFeature, setHasRetailProfitFeature] = useState(false);
    const [hasWholesaleProfitFeature, setHasWholesaleProfitFeature] = useState(false);
    const [hasValuationCardsFeature, setHasValuationCardsFeature] = useState(false);
    const hasValuationAccess = hasValuationCardsFeature;

    // Sub-Modals
    const [showLabelModal, setShowLabelModal] = useState(false);
    const [labelProducts, setLabelProducts] = useState<number[]>([]);
    const [labelQty, setLabelQty] = useState<Record<number, number>>({});
    const [labelSearch, setLabelSearch] = useState('');
    const [labelSize, setLabelSize] = useState<'small' | 'medium' | 'large'>('medium');

    const [showLookupModal, setShowLookupModal] = useState(false);
    const [lookupQuery, setLookupQuery] = useState('');
    const [lookupResult, setLookupResult] = useState<Product | null>(null);

    const [showStockHistoryModal, setShowStockHistoryModal] = useState(false);
    const [stockHistoryProduct, setStockHistoryProduct] = useState<Product | null>(null);
    const [stockHistory, setStockHistory] = useState<StockHistoryRow[]>([]);

    const [showPriceHistoryModal, setShowPriceHistoryModal] = useState(false);
    const [priceHistoryProduct, setPriceHistoryProduct] = useState<Product | null>(null);
    const [priceHistory, setPriceHistory] = useState<PriceHistoryRow[]>([]);

    const [showStockAdjustModal, setShowStockAdjustModal] = useState(false);
    const [adjustProduct, setAdjustProduct] = useState<Product | null>(null);
    const [adjustBags, setAdjustBags] = useState(0);
    const [adjustPieces, setAdjustPieces] = useState(0);
    const [adjustType, setAdjustType] = useState<'add' | 'remove'>('add');
    const [adjustReason, setAdjustReason] = useState('');

    // Expiry Batches
    const [productBatches, setProductBatches] = useState<Array<{
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
    }>>([]);
    const [batchForm, setBatchForm] = useState({
        batch_number: '',
        expiry_date: '',
        qty_received: 0,
        qty_remaining: 0,
        cost_price: 0,
        selling_price: 0,
        supplier_name: ''
    });
    const [showBatchForm, setShowBatchForm] = useState(false);
    const [editingBatchIdx, setEditingBatchIdx] = useState<number | null>(null);

    // CSV Import
    const [showImportModal, setShowImportModal] = useState(false);
    const [importFile, setImportFile] = useState<File | null>(null);
    const [importMode, setImportMode] = useState<'overwrite' | 'update' | 'add_new'>('add_new');
    const [importProgress, setImportProgress] = useState(0);
    const [importTotal, setImportTotal] = useState(0);
    const [importCurrentItem, setImportCurrentItem] = useState('');
    const [importStatus, setImportStatus] = useState<'idle' | 'parsing' | 'importing' | 'success' | 'error'>('idle');
    const [importErrors, setImportErrors] = useState<string[]>([]);
    const [importSuccessCount, setImportSuccessCount] = useState(0);

    // ─── DATA LOADING ───
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
        } catch { /* silent */ }
    }, [activeOutlet, outletId]);

    // Auto-convert big units when loose pieces = 0
    const autoConvertBigUnitsToPieces = useCallback(async (prods?: any[]) => {
        if (!activeOutlet) return;
        const prodList = prods || products;
        if (prodList.length === 0) return;
        try {
            const PAGE_SIZE = 1000;
            let allStockRows: any[] = [];
            let page = 0, hasMore = true;
            while (hasMore) {
                const { data } = await supabase
                    .from('retail_stock')
                    .select('st_id, pid, qty, storage_type')
                    .eq('outlet_id', outletId)
                    .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
                if (data && data.length > 0) allStockRows = allStockRows.concat(data);
                if (!data || data.length < PAGE_SIZE) hasMore = false;
                else page++;
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
                    await supabase.from('retail_stock')
                        .update({ qty: pcsRow.qty + ppp })
                        .eq('st_id', pcsRow.st_id);
                } else {
                    await supabase.from('retail_stock')
                        .insert({ pid: product.pid, qty: ppp, storage_type: 'Pieces', outlet_id: outletId });
                }
                converted++;
            }

            if (converted > 0) {
                await loadStockData();
            }
        } catch (e) {
            console.error('Auto-convert error:', e);
        }
    }, [activeOutlet, outletId, products, loadStockData]);

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
        } catch { /* silent */ }
    }, [activeOutlet, outletId]);

    const loadSuppliers = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('retail_suppliers')
                .select('supplier_id, supplier_code, supplier_name')
                .eq('active', true)
                .order('supplier_name');
            if (error) throw error;
            setSuppliers(data || []);
        } catch { /* silent */ }
    }, []);

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

    const loadCompanyName = useCallback(async () => {
        try {
            const { data } = await supabase.from('organisation_settings').select('setting_value').eq('setting_key', 'company_name').single();
            if (data?.setting_value) setCompanyName(data.setting_value.trim());
        } catch {
            setCompanyName('Alpha Retail');
        }
    }, []);

    useEffect(() => {
        loadProducts();
        loadStockData();
        loadCategories();
        loadSuppliers();
        loadUnits();
        loadCompanyName();
    }, [loadProducts, loadStockData, loadCategories, loadSuppliers, loadUnits, loadCompanyName]);

    useEffect(() => {
        if (products.length === 0 || isLoading) return;
        autoConvertBigUnitsToPieces();
        const iv = setInterval(autoConvertBigUnitsToPieces, 60_000);
        return () => clearInterval(iv);
    }, [products.length, isLoading, autoConvertBigUnitsToPieces]);

    useEffect(() => {
        if (!isLoading && isAddMode && !showModal) {
            openAddModal();
        }
    }, [isLoading, isAddMode, showModal]);

    useEffect(() => {
        try {
            const raw = localStorage.getItem('user');
            if (!raw) return;
            const u = JSON.parse(raw);
            const t = (u.userType || '').toLowerCase().replace(/\s/g, '');
            if (t === 'superadmin' || t === 'superuser') {
                setHasRetailProfitFeature(true);
                setHasWholesaleProfitFeature(true);
                setHasValuationCardsFeature(true);
                return;
            }
            const oid = activeOutlet?.outlet_id || 1;
            supabase.from('license_settings').select('setting_value')
                .eq('setting_key', `outlet_features_${oid}`).single()
                .then(({ data }) => {
                    try {
                        const features: string[] = JSON.parse(data?.setting_value || '[]');
                        setHasRetailProfitFeature(features.includes('retail_profit'));
                        setHasWholesaleProfitFeature(features.includes('wholesale_profit'));
                        setHasValuationCardsFeature(features.includes('valuation_cards'));
                    } catch { /* silent */ }
                });
        } catch { /* silent */ }
    }, [activeOutlet]);

    const getKitchenSupplier = () => companyName || 'Kitchen';

    const generateBarcode = async (): Promise<string> => {
        try {
            const { data } = await supabase
                .from('retail_products')
                .select('barcode')
                .eq('outlet_id', outletId)
                .like('barcode', '1%')
                .order('barcode', { ascending: false })
                .limit(1);
            if (data?.length && data[0].barcode) return String((parseInt(data[0].barcode, 10) || 100) + 1);
            return '101';
        } catch {
            return '101';
        }
    };

    const generateProductCode = async (): Promise<{ code: string; pid: number }> => {
        try {
            const { data } = await supabase
                .from('retail_products')
                .select('pid')
                .not('pid', 'is', null)
                .order('pid', { ascending: false })
                .limit(1);
            const maxPid = Number(data?.[0]?.pid || 0);
            const nextPid = maxPid + 1;
            return { code: `PRD-${String(nextPid).padStart(4, '0')}`, pid: nextPid };
        } catch {
            const ts = Date.now();
            return { code: `PRD-${ts.toString().slice(-6)}`, pid: ts };
        }
    };

    const calcMargin = (pc: number, sc: number) => pc <= 0 ? sc : Math.round((sc - pc) * 100) / 100;

    const openAddModal = async () => {
        setEditingProduct(null);
        const bc = await generateBarcode();
        const { code, pid: nextPid } = await generateProductCode();
        setPreviewPid(nextPid);
        setPreviewCode(code);
        setFormData({ ...defaultProduct, barcode: bc, supplier_name: getKitchenSupplier() });
        setOpeningBags(0);
        setOpeningPieces(0);
        setProductBatches([]);
        setShowBatchForm(false);
        setEditingBatchIdx(null);
        setShowModal(true);
        if (typeof window !== 'undefined' && window.location.search.includes('action=add')) setIsAddMode(true);
    };

    const openEditModal = (p: Product) => {
        setEditingProduct(p);
        setFormData({
            product_name: p.product_name,
            alias: p.alias || '',
            vat_commodity: p.vat_commodity || 'Standard',
            description: p.description || '',
            barcode: p.barcode || '',
            category: p.category || '',
            purchase_unit: p.purchase_unit || 'Piece',
            sales_unit: p.sales_unit || 'Piece',
            purchase_cost: p.purchase_cost || 0,
            sales_cost: p.sales_cost || 0,
            wholesale_price: (p as any).wholesale_price || 0,
            package_sales_cost: (p as any).package_sales_cost || 0,
            reorder_point: p.reorder_point || 10,
            margin_per: p.margin_per || 0,
            show_ps: p.show_ps !== false,
            button_ui_color: p.button_ui_color || 'from-blue-400 to-blue-600',
            photo: p.photo || '',
            hscode: p.hscode || '',
            batch_no: p.batch_no || '',
            supplier_name: p.supplier_name || '',
            active: p.active !== false,
            pieces_per_package: p.pieces_per_package || 1,
        });
        setShowBatchForm(false);
        setEditingBatchIdx(null);
        if (expiryEnabled) {
            supabase.from('retail_product_batches')
                .select('*')
                .eq('pid', p.pid)
                .eq('outlet_id', outletId)
                .eq('status', 'Active')
                .order('expiry_date', { ascending: true })
                .then(({ data }) => setProductBatches((data || []).map(b => ({ ...b, isNew: false, isEditing: false }))));
        } else {
            setProductBatches([]);
        }
        setShowModal(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.product_name.trim()) {
            toast.error('Product name required!');
            return;
        }
        setIsSaving(true);
        try {
            const costPerPiece = formData.purchase_cost / (formData.pieces_per_package || 1);
            const margin = calcMargin(costPerPiece, formData.wholesale_price || formData.sales_cost);
            const pkgCost = parseFloat(String(formData.package_sales_cost)) || 0;
            const d = {
                product_name: formData.product_name,
                alias: formData.alias || null,
                description: formData.description || null,
                barcode: formData.barcode || null,
                category: formData.category || null,
                purchase_unit: formData.purchase_unit,
                sales_unit: formData.sales_unit,
                purchase_cost: parseFloat(String(formData.purchase_cost)) || 0,
                sales_cost: parseFloat(String(formData.sales_cost)) || 0,
                wholesale_price: parseFloat(String(formData.wholesale_price)) || 0,
                package_sales_cost: pkgCost,
                reorder_point: Math.round(parseFloat(String(formData.reorder_point)) || 10),
                margin_per: margin,
                show_in_pos: formData.show_ps !== false,
                button_ui_color: formData.button_ui_color,
                photo: formData.photo || null,
                batch_no: formData.batch_no || null,
                supplier_name: formData.supplier_name || null,
                active: formData.active !== false,
                pieces_per_package: Math.round(parseFloat(String(formData.pieces_per_package)) || 1),
            };

            if (editingProduct) {
                if (editingProduct.purchase_cost !== formData.purchase_cost || editingProduct.sales_cost !== formData.sales_cost) {
                    try {
                        await supabase.from('retail_price_history').insert({
                            pid: editingProduct.pid,
                            product_name: editingProduct.product_name,
                            old_buy: editingProduct.purchase_cost,
                            new_buy: formData.purchase_cost,
                            old_sell: editingProduct.sales_cost,
                            new_sell: formData.sales_cost,
                            changed_at: new Date().toISOString(),
                        });
                    } catch { /* silent */ }
                }
                let updatePayload: any = { ...d, updated_at: new Date().toISOString() };
                let { error } = await supabase.from('retail_products').update(updatePayload).eq('pid', editingProduct.pid);
                if (error && error.message?.includes('package_sales_cost')) {
                    delete updatePayload.package_sales_cost;
                    const res2 = await supabase.from('retail_products').update(updatePayload).eq('pid', editingProduct.pid);
                    error = res2.error;
                }
                if (error) throw new Error(error.message);
                toast.success('Product updated successfully!');
                logActivity('Update', `Updated product: ${formData.product_name}`, `PID: ${editingProduct.pid}`);
            } else {
                const { data: existing } = await supabase
                    .from('retail_products')
                    .select('pid, product_name')
                    .eq('outlet_id', outletId)
                    .ilike('product_name', formData.product_name.trim())
                    .limit(1)
                    .maybeSingle();

                if (existing) {
                    toast.error(`"${formData.product_name}" already exists in this outlet!`);
                    setIsSaving(false);
                    return;
                }

                const { code, pid: newPid } = previewCode && previewPid
                    ? { code: previewCode, pid: previewPid }
                    : await generateProductCode();

                let insertPayload: any = {
                    ...d,
                    pid: newPid,
                    product_code: code,
                    outlet_id: outletId,
                    created_at: new Date().toISOString()
                };

                let { data: np, error } = await supabase
                    .from('retail_products')
                    .insert(insertPayload)
                    .select()
                    .single();

                if (error && error.message?.includes('package_sales_cost')) {
                    delete insertPayload.package_sales_cost;
                    const res2 = await supabase
                        .from('retail_products')
                        .insert(insertPayload)
                        .select()
                        .single();
                    np = res2.data;
                    error = res2.error;
                }
                if (error) throw new Error(error.message);

                if (np) {
                    const stockRecords: any[] = [];
                    if (openingBags > 0) stockRecords.push({ pid: np.pid, invoice_no: 'OPENING', qty: openingBags, storage_type: 'Bags', outlet_id: outletId });
                    if (openingPieces > 0) stockRecords.push({ pid: np.pid, invoice_no: 'OPENING', qty: openingPieces, storage_type: 'Pieces', outlet_id: outletId });
                    if (stockRecords.length > 0) await supabase.from('retail_stock').insert(stockRecords);

                    if (expiryEnabled && productBatches.length > 0) {
                        const newBatches = productBatches.filter(b => b.isNew).map(b => ({
                            pid: np.pid,
                            product_name: formData.product_name,
                            batch_number: b.batch_number || `B-${Date.now().toString(36).toUpperCase()}`,
                            expiry_date: b.expiry_date,
                            qty_received: b.qty_received,
                            qty_remaining: b.qty_remaining,
                            cost_price: b.cost_price,
                            selling_price: b.selling_price,
                            supplier_name: b.supplier_name,
                            outlet_id: outletId,
                            status: 'Active',
                            received_date: new Date().toISOString().split('T')[0],
                        }));
                        if (newBatches.length > 0) await supabase.from('retail_product_batches').insert(newBatches);
                    }
                }
                toast.success(`Product ${code} created!`);
                logActivity('Create', `Created product: ${formData.product_name}`, `Code: ${code}`);
            }
            setShowModal(false);
            loadProducts();
            loadStockData();
        } catch (err: unknown) {
            toast.error(`Failed: ${err instanceof Error ? err.message : 'Unknown'}`);
        }
        setIsSaving(false);
    };

    const deleteProduct = async (p: Product) => {
        if (!confirm(`Remove "${p.product_name}"?\n\nIf it has sales history it will be deactivated.\nIf no sales history it will be permanently deleted.`)) return;
        try {
            if (!p.pid) {
                await supabase.from('retail_products').delete().eq('outlet_id', outletId).eq('product_name', p.product_name);
                toast.success(`"${p.product_name}" deleted`);
                loadProducts();
                loadStockData();
                return;
            }

            const { data: salesCheck } = await supabase
                .from('retail_sales_items')
                .select('sale_id')
                .eq('pid', p.pid)
                .limit(1)
                .maybeSingle();

            if (salesCheck) {
                const { error } = await supabase.from('retail_products').update({ active: false }).eq('pid', p.pid);
                if (error) throw error;
                toast.success(`"${p.product_name}" deactivated (has sales history)`);
                logActivity('Deactivate', `Deactivated product (has sales): ${p.product_name}`, `PID: ${p.pid}`);
            } else {
                await supabase.from('retail_stock').delete().eq('pid', p.pid);
                const { error } = await supabase.from('retail_products').delete().eq('pid', p.pid);
                if (error) throw error;
                toast.success(`"${p.product_name}" permanently deleted`);
                logActivity('Delete', `Deleted product: ${p.product_name}`, `PID: ${p.pid}`);
            }
            loadProducts();
            loadStockData();
        } catch (err: any) {
            toast.error(`Failed: ${err?.message || 'Unknown error'}`);
        }
    };

    const deactivateProduct = async (p: Product) => {
        const action = p.active ? 'Deactivate' : 'Reactivate';
        if (!confirm(`${action} "${p.product_name}"?`)) return;
        try {
            const { error } = await supabase.from('retail_products').update({ active: !p.active }).eq('pid', p.pid);
            if (error) throw error;
            toast.success(`${p.active ? '🔒 Deactivated' : '✅ Reactivated'}: ${p.product_name}`);
            logActivity(action, `${action}d product: ${p.product_name}`, `PID: ${p.pid}`);
            loadProducts();
        } catch {
            toast.error(`Failed to ${action.toLowerCase()} product`);
        }
    };

    // ─── BULK OPERATIONS ───
    const toggleSelect = (pid: number) => {
        setSelectedPids(prev => {
            const next = new Set(prev);
            if (next.has(pid)) next.delete(pid); else next.add(pid);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selectedPids.size === paginated.length) {
            setSelectedPids(new Set());
        } else {
            setSelectedPids(new Set(paginated.map(p => p.pid)));
        }
    };

    const bulkDeactivate = async () => {
        if (selectedPids.size === 0) return;
        if (!confirm(`Deactivate ${selectedPids.size} selected product(s)?`)) return;
        try {
            const pids = Array.from(selectedPids);
            const { error } = await supabase.from('retail_products').update({ active: false }).in('pid', pids);
            if (error) throw error;
            toast.success(`🔒 ${pids.length} product(s) deactivated`);
            logActivity('Deactivate', `Bulk deactivated ${pids.length} products`, `PIDs: ${pids.join(', ')}`);
            setSelectedPids(new Set());
            loadProducts();
        } catch {
            toast.error('Bulk deactivate failed');
        }
    };

    const bulkDelete = async () => {
        if (selectedPids.size === 0) return;
        if (!confirm(`PERMANENTLY DELETE ${selectedPids.size} selected product(s)?`)) return;
        try {
            const pids = Array.from(selectedPids);
            const { error } = await supabase.from('retail_products').delete().in('pid', pids);
            if (error) throw error;
            toast.success(`🗑️ ${pids.length} product(s) deleted`);
            logActivity('Delete', `Bulk deleted ${pids.length} products`, `PIDs: ${pids.join(', ')}`);
            setSelectedPids(new Set());
            loadProducts();
        } catch {
            toast.error('Bulk delete failed');
        }
    };

    const exportCSV = () => {
        const csv = [
            ['Code', 'Name', 'Category', 'Buy', 'Cost_Per_Pc', 'Sell', 'Big_Qty_Price', 'Wholesale', 'Stock', 'Margin', 'Status'].join(','),
            ...filtered.map(p => {
                const cpp = (p.purchase_cost || 0) / (p.pieces_per_package || 1);
                const sp = (p as any).wholesale_price || p.sales_cost || 0;
                const bigPrice = (p.pieces_per_package || 1) > 1
                    ? ((p.package_sales_cost && p.package_sales_cost > 0) ? p.package_sales_cost : ((p.sales_cost || 0) * (p.pieces_per_package || 1)))
                    : '';
                return [
                    p.product_code,
                    `"${p.product_name}"`,
                    p.category || '',
                    p.purchase_cost,
                    Math.round(cpp),
                    p.sales_cost,
                    bigPrice,
                    (p as any).wholesale_price || 0,
                    stockData[p.pid] || 0,
                    (sp - cpp).toFixed(0),
                    p.active ? 'Active' : 'Off'
                ].join(',');
            })
        ].join('\n');
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
        a.download = `products-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        toast.success('Products exported to CSV');
    };

    // ─── STOCK HISTORY MODAL ───
    const openStockHistory = async (p: Product) => {
        setStockHistoryProduct(p);
        setShowStockHistoryModal(true);
        try {
            const rows: StockHistoryRow[] = [];
            const { data: stockRows } = await supabase.from('retail_stock').select('*').eq('pid', p.pid).order('created_at', { ascending: true });
            (stockRows || []).forEach((r: any, i: number) => rows.push({
                id: i,
                date: new Date(r.created_at).toLocaleDateString('en-GB'),
                ref: r.invoice_no || 'N/A',
                type: 'Purchase/Opening',
                qty_in: r.qty || 0,
                qty_out: 0,
                balance: 0
            }));
            const { data: saleRows } = await supabase.from('retail_sales_items').select('*, retail_sales!inner(sale_datetime, receipt_no)').eq('product_id', p.pid).order('retail_sales(sale_datetime)', { ascending: true });
            (saleRows || []).forEach((r: any, i: number) => rows.push({
                id: 1000 + i,
                date: new Date(r.retail_sales?.sale_datetime).toLocaleDateString('en-GB'),
                ref: r.retail_sales?.receipt_no || 'N/A',
                type: 'Sale',
                qty_in: 0,
                qty_out: r.quantity || 0,
                balance: 0
            }));
            rows.sort((a, b) => a.date.localeCompare(b.date));
            let bal = 0;
            rows.forEach(r => { bal += r.qty_in - r.qty_out; r.balance = bal; });
            setStockHistory(rows);
        } catch {
            setStockHistory([]);
        }
    };

    // ─── PRICE HISTORY MODAL ───
    const openPriceHistory = async (p: Product) => {
        setPriceHistoryProduct(p);
        setShowPriceHistoryModal(true);
        try {
            const { data } = await supabase.from('retail_price_history').select('*').eq('pid', p.pid).order('changed_at', { ascending: false });
            setPriceHistory((data || []).map((r: any, i: number) => ({
                id: i,
                date: new Date(r.changed_at).toLocaleString('en-GB'),
                old_buy: r.old_buy,
                new_buy: r.new_buy,
                old_sell: r.old_sell,
                new_sell: r.new_sell
            })));
        } catch {
            setPriceHistory([]);
        }
    };

    // ─── STOCK ADJUSTMENT MODAL ───
    const openStockAdjust = (p: Product) => {
        setAdjustProduct(p);
        setAdjustBags(0);
        setAdjustPieces(0);
        setAdjustType('add');
        setAdjustReason('');
        setShowStockAdjustModal(true);
    };

    const submitStockAdjust = async () => {
        if (!adjustProduct || (adjustBags <= 0 && adjustPieces <= 0)) {
            toast.error('Enter valid quantity');
            return;
        }
        try {
            const ref = `ADJ-${Date.now().toString(36).toUpperCase()}`;
            const stockRecords: any[] = [];
            if (adjustBags > 0) {
                stockRecords.push({
                    pid: adjustProduct.pid,
                    invoice_no: ref,
                    qty: adjustType === 'add' ? adjustBags : -adjustBags,
                    storage_type: 'Bags',
                    notes: adjustReason || 'Stock Adjustment',
                    outlet_id: outletId
                });
            }
            if (adjustPieces > 0) {
                stockRecords.push({
                    pid: adjustProduct.pid,
                    invoice_no: ref,
                    qty: adjustType === 'add' ? adjustPieces : -adjustPieces,
                    storage_type: 'Pieces',
                    notes: adjustReason || 'Stock Adjustment',
                    outlet_id: outletId
                });
            }
            if (stockRecords.length > 0) await supabase.from('retail_stock').insert(stockRecords);
            const parts: string[] = [];
            if (adjustBags > 0) parts.push(`${adjustBags} ${adjustProduct.purchase_unit}(s)`);
            if (adjustPieces > 0) parts.push(`${adjustPieces} ${adjustProduct.sales_unit}(s)`);
            toast.success(`Stock ${adjustType === 'add' ? 'added' : 'removed'}: ${parts.join(' + ')}`);
            setShowStockAdjustModal(false);
            loadStockData();
        } catch {
            toast.error('Adjustment failed');
        }
    };

    // ─── LABEL GENERATOR ───
    const labelSizes = {
        small: { w: '38mm', h: '25mm', name: 11, barcode: 14, price: 13, code: 8 },
        medium: { w: '50mm', h: '30mm', name: 13, barcode: 18, price: 16, code: 9 },
        large: { w: '62mm', h: '35mm', name: 15, barcode: 22, price: 20, code: 10 }
    };

    const getLabelHTML = () => {
        const selectedProds = products.filter(p => labelProducts.includes(p.pid));
        if (selectedProds.length === 0) return '';
        const labels = selectedProds.flatMap(p => Array.from({ length: labelQty[p.pid] || 1 }, () => p));
        const s = labelSizes[labelSize];
        return `<!DOCTYPE html><html><head><style>
            @page{margin:3mm;}*{box-sizing:border-box;margin:0;padding:0;}
            body{font-family:'Arial',sans-serif;display:flex;flex-wrap:wrap;gap:2mm;padding:0;}
            .label{width:${s.w};height:${s.h};border:1.5px solid #222;border-radius:3px;padding:2mm;display:flex;flex-direction:column;justify-content:space-between;page-break-inside:avoid;overflow:hidden;}
            .company{font-size:${s.code}px;text-align:center;color:#888;text-transform:uppercase;letter-spacing:1px;}
            .name{font-size:${s.name}px;font-weight:bold;text-transform:uppercase;text-align:center;line-height:1.1;overflow:hidden;max-height:${s.name * 2.2}px;}
            .barcode{font-size:${s.barcode}px;text-align:center;font-weight:900;letter-spacing:3px;font-family:'Courier New',monospace;}
            .price{font-size:${s.price}px;font-weight:900;text-align:center;background:#000;color:#fff;border-radius:2px;padding:1mm 0;}
            .code{font-size:${s.code}px;text-align:center;color:#555;}
        </style></head><body>${labels.map(p => `<div class='label'><div class='company'>${companyName || 'Alpha Retail'}</div><div class='name'>${p.product_name}</div><div class='barcode'>${p.barcode || p.product_code}</div><div class='price'>Ksh ${(p.sales_cost || 0).toLocaleString()}</div><div class='code'>${p.product_code} • ${p.sales_unit || 'Pc'}</div></div>`).join('')}</body></html>`;
    };

    const printLabels = () => {
        const html = getLabelHTML();
        if (!html) { toast.error('Select at least one product'); return; }
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
            }, 500);
        }
    };

    const filteredLabelProducts = products.filter(p => {
        if (!p.active) return false;
        if (!labelSearch.trim()) return true;
        const q = labelSearch.toLowerCase();
        return p.product_name.toLowerCase().includes(q) || p.product_code.toLowerCase().includes(q) || (p.barcode && p.barcode.includes(labelSearch));
    });

    // ─── CSV IMPORT ───
    const parseCSV = (text: string): Record<string, string>[] => {
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length < 2) return [];
        const headers = lines[0].split(',').map(h => h.trim().replace(/^"(.*)"$/, '$1').toLowerCase().replace(/\s+/g, '_'));
        return lines.slice(1).map(line => {
            const vals: string[] = [];
            let current = '';
            let inQuotes = false;
            for (const ch of line) {
                if (ch === '"') { inQuotes = !inQuotes; }
                else if (ch === ',' && !inQuotes) { vals.push(current.trim()); current = ''; }
                else { current += ch; }
            }
            vals.push(current.trim());
            const row: Record<string, string> = {};
            headers.forEach((h, i) => { row[h] = (vals[i] || '').replace(/^"(.*)"$/, '$1'); });
            return row;
        });
    };

    const importProducts = async () => {
        if (!importFile) { toast.error('Please select a CSV file'); return; }
        setImportStatus('parsing');
        setImportErrors([]);
        setImportSuccessCount(0);
        setImportProgress(0);
        try {
            const text = await importFile.text();
            const rows = parseCSV(text);
            if (rows.length === 0) {
                toast.error('No data found in file');
                setImportStatus('error');
                return;
            }
            setImportTotal(rows.length);
            setImportStatus('importing');

            if (importMode === 'overwrite') {
                setImportCurrentItem('Clearing existing products...');
                await supabase.from('retail_stock').delete().eq('outlet_id', outletId);
                await supabase.from('retail_products').delete().eq('outlet_id', outletId);
                setImportProgress(0);
            }

            let success = 0;
            const errors: string[] = [];
            for (let i = 0; i < rows.length; i++) {
                const r = rows[i];
                const name = r.product_name || r.name || r.item_name || r.item || '';
                if (!name) { errors.push(`Row ${i + 2}: Missing product name`); setImportProgress(i + 1); continue; }
                setImportCurrentItem(name);

                const prodData = {
                    product_name: name,
                    alias: r.alias || r.short_name || '',
                    barcode: r.barcode || r.bar_code || r.upc || '',
                    category: r.category || r.group || r.type || '',
                    purchase_unit: r.purchase_unit || r.buy_unit || 'Piece',
                    sales_unit: r.sales_unit || r.sell_unit || r.unit || 'Piece',
                    purchase_cost: parseFloat(r.purchase_cost || r.buy_price || r.cost_price || r.cost || '0') || 0,
                    sales_cost: parseFloat(r.sales_cost || r.sell_price || r.selling_price || r.price || '0') || 0,
                    reorder_point: parseInt(r.reorder_point || r.reorder || r.min_stock || '10', 10) || 10,
                    vat_commodity: r.vat_commodity || r.vat || r.tax || 'Standard',
                    supplier_name: r.supplier_name || r.supplier || '',
                    hscode: r.hscode || r.hs_code || '',
                    batch_no: r.batch_no || r.batch || '',
                    description: r.description || r.desc || '',
                    active: (r.active || r.status || 'true').toLowerCase() !== 'false',
                    pieces_per_package: parseInt(r.pieces_per_package || r.pcs_per_pack || '1', 10) || 1,
                    wholesale_price: parseFloat(r.wholesale_price || r.wholesale || r.ws_price || '0') || 0,
                    margin_per: 0,
                };
                if (prodData.purchase_cost > 0) {
                    const cpp = prodData.purchase_cost / (prodData.pieces_per_package || 1);
                    const sp = prodData.wholesale_price || prodData.sales_cost;
                    prodData.margin_per = Math.round((sp - cpp) * 100) / 100;
                }

                try {
                    if (importMode === 'update') {
                        const existing = products.find(ep => ep.product_name.toLowerCase() === name.toLowerCase() || (ep.barcode && ep.barcode === prodData.barcode));
                        if (existing) {
                            await supabase.from('retail_products').update(prodData).eq('pid', existing.pid);
                        } else {
                            const code = `PRD-${String(products.length + i + 1).padStart(2, '0')}`;
                            await supabase.from('retail_products').insert({ ...prodData, product_code: code });
                        }
                    } else {
                        const code = `PRD-${String(i + 1).padStart(3, '0')}`;
                        await supabase.from('retail_products').insert({ ...prodData, product_code: code });
                    }
                    const qty = parseFloat(r.quantity || r.stock || r.qty || r.opening_stock || '0');
                    if (qty > 0) {
                        const { data: newP } = await supabase.from('retail_products').select('pid').eq('product_name', name).eq('outlet_id', outletId).order('pid', { ascending: false }).limit(1);
                        if (newP?.[0]) await supabase.from('retail_stock').insert({ pid: newP[0].pid, invoice_no: 'IMPORT', qty, storage_type: 'Store', outlet_id: outletId });
                    }
                    success++;
                } catch (err: any) {
                    errors.push(`Row ${i + 2} (${name}): ${err.message || 'DB error'}`);
                }
                setImportProgress(i + 1);
                await new Promise(res => setTimeout(res, 30));
            }
            setImportSuccessCount(success);
            setImportErrors(errors);
            setImportStatus(errors.length > 0 && success === 0 ? 'error' : 'success');
            loadProducts();
            loadStockData();
        } catch (err: any) {
            setImportStatus('error');
            setImportErrors([err.message || 'Failed to parse file']);
        }
    };

    // ─── ITEM LOOKUP ───
    const doLookup = () => {
        const q = lookupQuery.toLowerCase().trim();
        const found = products.find(p => p.barcode === lookupQuery || p.product_code.toLowerCase() === q || p.product_name.toLowerCase().includes(q));
        setLookupResult(found || null);
        if (!found) toast.error('Product not found');
    };

    // Filter calculations
    const filtered = products.filter(p => {
        if (!showInactive && !p.active) return false;
        const q = searchQuery.toLowerCase();
        return (
            (p.product_name || '').toLowerCase().includes(q) ||
            (p.product_code || '').toLowerCase().includes(q) ||
            (p.barcode || '').includes(searchQuery) ||
            (p.category || '').toLowerCase().includes(q)
        ) && (filterCategory === 'All' || p.category === filterCategory);
    });

    const totalPages = Math.ceil(filtered.length / perPage);
    const paginated = filtered.slice((page - 1) * perPage, page * perPage);

    // Active valuations
    const activeProducts = products.filter(p => p.active);
    const lowStock = activeProducts.filter(p => (stockData[p.pid] || 0) <= (p.reorder_point || 10)).length;

    const stockValCost = activeProducts.reduce((s, p) => {
        const b = bagStockData[p.pid] || 0;
        const pc = pieceStockData[p.pid] || 0;
        const ppp = p.pieces_per_package || 1;
        return s + (b * (p.purchase_cost || 0)) + (pc * ((p.purchase_cost || 0) / ppp));
    }, 0);

    const stockValSales = activeProducts.reduce((s, p) => {
        const b = bagStockData[p.pid] || 0;
        const pc = pieceStockData[p.pid] || 0;
        const ppp = p.pieces_per_package || 1;
        const wsPrice = (p as any).wholesale_price || p.sales_cost || 0;
        return s + (b * ppp * wsPrice) + (pc * wsPrice);
    }, 0);

    const potentialProfit = stockValSales - stockValCost;

    const stockValRetail = activeProducts.reduce((s, p) => {
        const b = bagStockData[p.pid] || 0;
        const pc = pieceStockData[p.pid] || 0;
        const ppp = p.pieces_per_package || 1;
        const rp = p.sales_cost || 0;
        return s + (b * ppp * rp) + (pc * rp);
    }, 0);

    const stockValWholesale = activeProducts.reduce((s, p) => {
        const b = bagStockData[p.pid] || 0;
        const pc = pieceStockData[p.pid] || 0;
        const ppp = p.pieces_per_package || 1;
        const wp = (p as any).wholesale_price || 0;
        return s + (b * ppp * wp) + (pc * wp);
    }, 0);

    const stockRetailProfit = stockValRetail - stockValCost;
    const stockWholesaleProfit = stockValWholesale - stockValCost;

    // ─── RENDER ───
    return (
        <div className="-mt-2 sm:-mt-3.5 pt-0 space-y-2.5 pb-10" style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
            <Toaster position="top-right" toastOptions={{ style: { background: '#0f172a', color: '#fff', fontSize: '12px', fontWeight: 'bold', borderRadius: '12px' } }} />

            {/* ══════════════════════════════════════════════════════════════════════════
               1. EXECUTIVE COMMAND HEADER
               ══════════════════════════════════════════════════════════════════════════ */}
            <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200/90 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-blue-700 flex items-center justify-center shadow-md shadow-blue-500/20 text-white font-black">
                            <FiPackage size={22} />
                        </div>
                        <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white ring-1 ring-emerald-500/30 animate-pulse" />
                    </div>
                    <div>
                        <div className="flex flex-wrap items-center gap-2">
                            <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                                Products & Inventory Master
                            </h1>
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-blue-50 text-blue-700 border border-blue-200/80 font-mono">
                                <FiHash size={11} className="text-blue-500" />
                                {products.length} SKUs Cataloged
                            </span>
                            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                🏪 {activeOutlet?.outlet_name || 'Main Warehouse'}
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                            <span>Dual-stock ledger (Bags & Pieces)</span>
                            <span className="text-slate-300">•</span>
                            <span className="text-emerald-600 font-bold">Multi-tier Wholesale & Retail Pricing</span>
                        </p>
                    </div>
                </div>

                {/* Executive Action Toolbar */}
                <div className="flex flex-wrap items-center gap-1.5 self-end md:self-center">
                    <button
                        onClick={() => { loadProducts(); loadStockData(); }}
                        className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-blue-600 transition-all shadow-2xs"
                        title="Refresh Inventory"
                    >
                        <FiRefreshCw size={14} />
                    </button>

                    <button
                        onClick={() => { setShowLabelModal(true); setLabelProducts([]); setLabelQty({}); }}
                        className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs"
                        title="Thermal barcode & shelf label generator"
                    >
                        <FiPrinter size={13} className="text-purple-600" />
                        <span className="hidden sm:inline">Labels</span>
                    </button>

                    <button
                        onClick={() => { setShowLookupModal(true); setLookupQuery(''); setLookupResult(null); }}
                        className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs"
                        title="Instant Item Lookup"
                    >
                        <FiEye size={13} className="text-emerald-600" />
                        <span className="hidden sm:inline">Lookup</span>
                    </button>

                    <button
                        onClick={exportCSV}
                        className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs"
                        title="Export filtered records"
                    >
                        <FiDownload size={13} className="text-slate-500" />
                        <span className="hidden sm:inline">Export</span>
                    </button>

                    <button
                        onClick={() => setShowInactive(v => !v)}
                        className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs ${
                            showInactive
                                ? 'bg-amber-50 border-amber-300 text-amber-800'
                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                        title="Toggle visibility of inactive SKUs"
                    >
                        {showInactive ? <FiEyeOff size={13} className="text-amber-600" /> : <FiEye size={13} className="text-slate-400" />}
                        <span className="hidden sm:inline">{showInactive ? 'Inactive Visible' : 'Active Only'}</span>
                    </button>

                    <button
                        onClick={() => {
                            setShowImportModal(true);
                            setImportFile(null);
                            setImportStatus('idle');
                            setImportErrors([]);
                            setImportProgress(0);
                            setImportMode('add_new');
                        }}
                        className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs"
                        title="Bulk CSV Import"
                    >
                        <FiUpload size={13} className="text-emerald-600" />
                        <span className="hidden sm:inline">Import</span>
                    </button>

                    <button
                        onClick={openAddModal}
                        className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-700 text-white text-xs font-black transition-all flex items-center gap-1.5 shadow-sm hover:shadow active:scale-98"
                    >
                        <FiPlus size={14} strokeWidth={3} />
                        <span>Add Product</span>
                    </button>
                </div>
            </div>

            {/* ══════════════════════════════════════════════════════════════════════════
               2. EXECUTIVE METRIC HUD CARDS (4 SUMMARY CARDS)
               ══════════════════════════════════════════════════════════════════════════ */}
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
                    <div className="text-lg font-black text-emerald-700 font-mono">{products.filter(p => p.active).length.toLocaleString()}</div>
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
                    lowStock > 0
                        ? 'border-rose-200/90 bg-gradient-to-br from-rose-50/40 via-white to-white'
                        : 'border-teal-200/90 bg-gradient-to-br from-teal-50/30 via-white to-white'
                }`}>
                    <div className="flex items-center justify-between text-slate-400 mb-1">
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${lowStock > 0 ? 'text-rose-700' : 'text-teal-700'}`}>
                            Low Inventory
                        </span>
                        <div className={`w-5 h-5 rounded-lg flex items-center justify-center ${lowStock > 0 ? 'bg-rose-100 text-rose-700' : 'bg-teal-100 text-teal-700'}`}>
                            <FiAlertTriangle size={11} />
                        </div>
                    </div>
                    <div className={`text-lg font-black font-mono ${lowStock > 0 ? 'text-rose-700' : 'text-teal-700'}`}>
                        {lowStock}
                    </div>
                    <div className={`text-[10px] font-medium ${lowStock > 0 ? 'text-rose-600' : 'text-teal-600'}`}>
                        {lowStock > 0 ? 'Reorder threshold reached' : 'All items optimal'}
                    </div>
                </div>
            </div>

            {/* ══════════════════════════════════════════════════════════════════════════
               3. VALUATION INTELLIGENCE CARDS (5 METRIC STRIP)
               ══════════════════════════════════════════════════════════════════════════ */}
            {showValuation && (
                <div className="bg-white rounded-2xl p-3 sm:p-3.5 border border-slate-200/90 shadow-2xs space-y-2.5">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                                Stock Valuation & Capital Intelligence
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
            )}

            {/* ══════════════════════════════════════════════════════════════════════════
               4. SEARCH & FILTER COCKPIT
               ══════════════════════════════════════════════════════════════════════════ */}
            <div className="bg-white rounded-2xl p-3 border border-slate-200/90 shadow-xs flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2.5">
                {/* Search Bar */}
                <div className="relative flex-1">
                    <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
                        placeholder="Search products by SKU code, name, barcode, or category..."
                        className="w-full pl-10 pr-10 py-2 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 outline-none transition-all shadow-2xs"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                            <FiX size={14} />
                        </button>
                    )}
                </div>

                {/* Filter Controls */}
                <div className="flex flex-wrap items-center gap-2">
                    {/* Category Selector */}
                    <div className="relative">
                        <FiFilter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={13} />
                        <select
                            value={filterCategory}
                            onChange={e => { setFilterCategory(e.target.value); setPage(1); }}
                            className="pl-8 pr-7 py-2 bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:border-blue-500 outline-none transition-all cursor-pointer appearance-none min-w-[140px]"
                        >
                            <option value="All">All Categories ({categories.length})</option>
                            {categories.map(c => (
                                <option key={c.category_id} value={c.category_name}>
                                    {c.category_name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* View Switcher: List vs Grid */}
                    <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200">
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white text-blue-600 shadow-2xs' : 'text-slate-400 hover:text-slate-700'}`}
                            title="List Table View"
                        >
                            <FiList size={14} />
                        </button>
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white text-blue-600 shadow-2xs' : 'text-slate-400 hover:text-slate-700'}`}
                            title="Grid Card View"
                        >
                            <FiGrid size={14} />
                        </button>
                    </div>

                    {/* Valuation Toggle */}
                    <button
                        onClick={() => setShowValuation(!showValuation)}
                        className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 ${
                            showValuation
                                ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                        title={showValuation ? 'Hide Valuation Strip' : 'Show Valuation Strip'}
                    >
                        <FiEye size={13} />
                        <span>{showValuation ? 'Hide Valuation' : 'Show Valuation'}</span>
                    </button>
                </div>
            </div>

            {/* ══════════════════════════════════════════════════════════════════════════
               5. BULK ACTION BAR (ACTIVE WHEN PRODUCTS SELECTED)
               ══════════════════════════════════════════════════════════════════════════ */}
            {selectedPids.size > 0 && (
                <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-slate-900 rounded-2xl text-white shadow-md animate-in slide-in-from-top-1">
                    <div className="flex items-center gap-2.5">
                        <span className="w-6 h-6 rounded-lg bg-amber-500 text-white font-black text-xs flex items-center justify-center font-mono">
                            {selectedPids.size}
                        </span>
                        <span className="text-xs font-bold text-slate-200">
                            {selectedPids.size === 1 ? 'Product selected' : 'Products selected'}
                        </span>
                        <button
                            onClick={() => setSelectedPids(new Set())}
                            className="text-[11px] font-bold text-slate-400 hover:text-white underline ml-1"
                        >
                            Deselect all
                        </button>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={bulkDeactivate}
                            className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs transition-colors flex items-center gap-1 shadow-xs"
                        >
                            <FiEyeOff size={12} /> Deactivate Selected
                        </button>
                        <button
                            onClick={bulkDelete}
                            className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs transition-colors flex items-center gap-1 shadow-xs"
                        >
                            <FiTrash2 size={12} /> Delete Selected
                        </button>
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════════════
               6. DATAGRID: PRODUCTS TABLE & CARDS
               ══════════════════════════════════════════════════════════════════════════ */}
            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-slate-200/90 space-y-3">
                    <div className="w-12 h-12 rounded-2xl border-4 border-slate-200 border-t-blue-600 animate-spin" />
                    <p className="text-xs font-extrabold text-slate-700 tracking-tight">Syncing Product Ledger...</p>
                </div>
            ) : paginated.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-slate-200/90 text-center p-6">
                    <FiPackage className="text-slate-300 mb-2" size={48} />
                    <h3 className="text-sm font-black text-slate-800">No products match your criteria</h3>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm">
                        Try adjusting your search query, selecting &quot;All Categories&quot;, or adding a new inventory product.
                    </p>
                    <button
                        onClick={openAddModal}
                        className="mt-4 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-black text-xs rounded-xl shadow-sm hover:shadow"
                    >
                        Add New Product
                    </button>
                </div>
            ) : viewMode === 'grid' ? (
                /* ── GRID CARD VIEW ── */
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
                    {paginated.map(p => {
                        const stk = stockData[p.pid] || 0;
                        const isSelected = selectedPids.has(p.pid);
                        return (
                            <div
                                key={p.pid}
                                className={`bg-white rounded-2xl border overflow-hidden shadow-2xs hover:shadow-md transition-all group flex flex-col justify-between ${
                                    isSelected ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-slate-200/90'
                                }`}
                            >
                                <div className={`h-28 bg-gradient-to-br ${p.button_ui_color || 'from-blue-400 to-blue-600'} relative flex items-center justify-center overflow-hidden`}>
                                    {p.photo ? (
                                        <img
                                            src={p.photo}
                                            alt={p.product_name}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                            onError={e => { (e.target as HTMLImageElement).src = '/no-image.png'; }}
                                        />
                                    ) : (
                                        <img src="/no-image.png" alt="No image" className="h-16 w-16 object-contain opacity-70" />
                                    )}

                                    {/* Action overlay */}
                                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => openEditModal(p)}
                                            className="p-1.5 bg-white/95 rounded-lg text-blue-600 hover:bg-white shadow-xs"
                                            title="Edit"
                                        >
                                            <FiEdit2 size={12} />
                                        </button>
                                        <button
                                            onClick={() => deactivateProduct(p)}
                                            className={`p-1.5 bg-white/95 rounded-lg shadow-xs ${p.active ? 'text-amber-600' : 'text-emerald-600'}`}
                                            title={p.active ? 'Deactivate' : 'Reactivate'}
                                        >
                                            {p.active ? <FiEyeOff size={12} /> : <FiEye size={12} />}
                                        </button>
                                        <button
                                            onClick={() => deleteProduct(p)}
                                            className="p-1.5 bg-white/95 rounded-lg text-rose-600 hover:bg-white shadow-xs"
                                            title="Delete"
                                        >
                                            <FiTrash2 size={12} />
                                        </button>
                                    </div>

                                    {/* Status Badge */}
                                    <span className={`absolute top-2 left-2 px-2 py-0.5 rounded-full text-[9px] font-black tracking-wider ${
                                        p.active ? 'bg-emerald-500 text-white shadow-2xs' : 'bg-slate-600 text-white'
                                    }`}>
                                        {p.active ? 'ACTIVE' : 'OFF'}
                                    </span>
                                </div>

                                <div className="p-3 flex-1 flex flex-col justify-between">
                                    <div>
                                        <div className="flex items-center justify-between gap-1 mb-1">
                                            <span className="text-[10px] font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
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

                                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-end justify-between">
                                        <div>
                                            <div className="text-xs font-black text-slate-900 font-mono">
                                                {fmtKES(p.sales_cost || 0)}
                                            </div>
                                            {(p.pieces_per_package || 1) > 1 && (
                                                <div className="text-[10px] font-black text-indigo-600 font-mono">
                                                    📦 {fmtKES((p.package_sales_cost && p.package_sales_cost > 0) ? p.package_sales_cost : ((p.sales_cost || 0) * (p.pieces_per_package || 1)))}
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex flex-col items-end gap-1">
                                            {(bagStockData[p.pid] || 0) > 0 && (
                                                <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200/80 font-mono">
                                                    📦 {bagStockData[p.pid]} {p.purchase_unit}
                                                </span>
                                            )}
                                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded font-mono ${
                                                (pieceStockData[p.pid] || 0) > 0
                                                    ? 'bg-sky-50 text-sky-800 border border-sky-200/80'
                                                    : stk <= 0
                                                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                                    : 'bg-amber-50 text-amber-700'
                                            }`}>
                                                🔢 {pieceStockData[p.pid] || 0} {p.sales_unit}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                /* ── LIST/TABLE VIEW (ULTRA DATAGRID) ── */
                <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-wider">
                                    <th className="py-2.5 px-3 w-8 text-center">
                                        <input
                                            type="checkbox"
                                            checked={selectedPids.size > 0 && selectedPids.size === paginated.length}
                                            onChange={toggleSelectAll}
                                            className="rounded border-slate-600 accent-amber-500 cursor-pointer"
                                        />
                                    </th>
                                    <th className="py-2.5 px-3">Product Name & SKU</th>
                                    <th className="py-2.5 px-3 hidden md:table-cell">Category</th>
                                    <th className="py-2.5 px-3 text-right">Buy Price</th>
                                    <th className="py-2.5 px-3 text-right hidden lg:table-cell">Cost / Pc</th>
                                    <th className="py-2.5 px-3 text-right">Sell Price</th>
                                    <th className="py-2.5 px-3 text-right">Big Qty Price</th>
                                    <th className="py-2.5 px-3 text-right hidden lg:table-cell">Wholesale</th>
                                    <th className="py-2.5 px-3 text-center">Stock Ledger</th>
                                    <th className="py-2.5 px-3 text-center hidden lg:table-cell">Profit Margin</th>
                                    <th className="py-2.5 px-3 text-center">Status</th>
                                    <th className="py-2.5 px-3 text-center w-28">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                                {paginated.map((p, idx) => {
                                    const stk = stockData[p.pid] || 0;
                                    const isSelected = selectedPids.has(p.pid);
                                    const ppp = p.pieces_per_package || 1;
                                    const cpp = (p.purchase_cost || 0) / ppp;
                                    const sp = (p as any).wholesale_price || p.sales_cost || 0;
                                    const pieceProfit = Math.round((sp - cpp) * 100) / 100;
                                    const pkgSell = (p.package_sales_cost && p.package_sales_cost > 0)
                                        ? p.package_sales_cost
                                        : (sp * ppp);
                                    const pkgProfit = Math.round((pkgSell - (p.purchase_cost || 0)) * 100) / 100;

                                    return (
                                        <tr
                                            key={p.pid}
                                            className={`hover:bg-amber-50/30 transition-colors ${
                                                isSelected ? 'bg-indigo-50/40' : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'
                                            }`}
                                        >
                                            {/* Select Checkbox */}
                                            <td className="py-2 px-3 text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => toggleSelect(p.pid)}
                                                    className="rounded border-slate-300 accent-amber-500 cursor-pointer"
                                                />
                                            </td>

                                            {/* Product Particulars */}
                                            <td className="py-2 px-3">
                                                <div className="flex items-center gap-2.5">
                                                    {p.photo ? (
                                                        <div className="w-8 h-8 rounded-lg overflow-hidden border border-slate-200 shrink-0 shadow-2xs">
                                                            <img
                                                                src={p.photo}
                                                                alt=""
                                                                className="w-full h-full object-cover"
                                                                onError={e => { (e.target as HTMLImageElement).src = '/no-image.png'; }}
                                                            />
                                                        </div>
                                                    ) : (
                                                        <div className="w-8 h-8 rounded-lg border border-slate-200 shrink-0 bg-slate-50 flex items-center justify-center">
                                                            <img src="/no-image.png" alt="No image" className="w-5 h-5 object-contain opacity-50" />
                                                        </div>
                                                    )}
                                                    <div>
                                                        <div className="font-extrabold text-slate-900 tracking-tight leading-tight">
                                                            {p.product_name}
                                                        </div>
                                                        <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1.5 mt-0.5">
                                                            <span className="text-indigo-600 font-bold">{p.product_code}</span>
                                                            {p.barcode && <span>• Barcode: {p.barcode}</span>}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Category */}
                                            <td className="py-2 px-3 hidden md:table-cell">
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[10px] font-bold">
                                                    <FiTag size={9} className="text-slate-400" />
                                                    {p.category || 'N/A'}
                                                </span>
                                            </td>

                                            {/* Buy Price */}
                                            <td className="py-2 px-3 text-right font-mono font-bold text-slate-700 text-xs">
                                                {fmtKES(p.purchase_cost || 0)}
                                            </td>

                                            {/* Cost / Pc */}
                                            <td className="py-2 px-3 text-right hidden lg:table-cell font-mono text-xs font-bold text-amber-800">
                                                {fmtKES(Math.round(cpp))}
                                                {ppp > 1 && (
                                                    <span className="text-[9px] text-slate-400 block font-normal">
                                                        ÷ {ppp} pcs
                                                    </span>
                                                )}
                                            </td>

                                            {/* Sell Price */}
                                            <td className="py-2 px-3 text-right font-mono font-black text-slate-900 text-xs">
                                                {fmtKES(p.sales_cost || 0)}
                                            </td>

                                            {/* Big Qty Price */}
                                            <td className="py-2 px-3 text-right">
                                                {ppp > 1 ? (
                                                    <div>
                                                        <span className="text-xs font-mono font-black text-indigo-700">
                                                            {fmtKES((p.package_sales_cost && p.package_sales_cost > 0) ? p.package_sales_cost : ((p.sales_cost || 0) * ppp))}
                                                        </span>
                                                        <span className="text-[9px] text-indigo-600 block font-medium">
                                                            /{p.purchase_unit || 'Pack'} ({ppp} pcs)
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-300 font-mono text-xs">—</span>
                                                )}
                                            </td>

                                            {/* Wholesale */}
                                            <td className="py-2 px-3 text-right hidden lg:table-cell font-mono text-xs font-bold text-purple-700">
                                                {(p as any).wholesale_price ? fmtKES((p as any).wholesale_price) : '—'}
                                            </td>

                                            {/* Dual-Stock Ledger */}
                                            <td className="py-2 px-3 text-center">
                                                <div className="flex flex-col items-center gap-0.5">
                                                    {(bagStockData[p.pid] || 0) > 0 && (
                                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-black bg-amber-50 text-amber-800 border border-amber-200/80 font-mono">
                                                            📦 {bagStockData[p.pid]} {p.purchase_unit}
                                                        </span>
                                                    )}
                                                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-black font-mono ${
                                                        (pieceStockData[p.pid] || 0) > 0
                                                            ? 'bg-sky-50 text-sky-800 border border-sky-200/80'
                                                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                                                    }`}>
                                                        🔢 {pieceStockData[p.pid] || 0} {p.sales_unit}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* Profit Margin */}
                                            <td className="py-2 px-3 text-center hidden lg:table-cell">
                                                <div className="flex flex-col items-center justify-center gap-0.5">
                                                    <div className="flex items-center gap-1 font-mono font-bold text-[11px]">
                                                        <span className={pieceProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                                                            +{fmtKES(pieceProfit)} <span className="text-[9px] text-slate-400 font-normal">/pc</span>
                                                        </span>
                                                    </div>
                                                    {ppp > 1 && (
                                                        <span className={`text-[10px] font-mono font-bold ${pkgProfit >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>
                                                            +{fmtKES(pkgProfit)} <span className="text-[9px] text-slate-400 font-normal">/{p.purchase_unit || 'pkg'}</span>
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Status Badge */}
                                            <td className="py-2 px-3 text-center">
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black ${
                                                    p.active ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500 border border-slate-200'
                                                }`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${p.active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                                                    {p.active ? 'Live' : 'Off'}
                                                </span>
                                            </td>

                                            {/* Action Toolbar */}
                                            <td className="py-2 px-3 text-center">
                                                <div className="flex items-center justify-center gap-1 flex-wrap">
                                                    <button
                                                        onClick={() => openEditModal(p)}
                                                        className="p-1 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                                                        title="Edit Product"
                                                    >
                                                        <FiEdit2 size={12} />
                                                    </button>
                                                    <button
                                                        onClick={() => openStockHistory(p)}
                                                        className="p-1 rounded-lg bg-sky-50 text-sky-600 hover:bg-sky-100 transition-colors"
                                                        title="Stock Ledger Movements"
                                                    >
                                                        <FiClock size={12} />
                                                    </button>
                                                    <button
                                                        onClick={() => openPriceHistory(p)}
                                                        className="p-1 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors"
                                                        title="Price Change History"
                                                    >
                                                        <FiTrendingUp size={12} />
                                                    </button>
                                                    <button
                                                        onClick={() => openStockAdjust(p)}
                                                        className="p-1 rounded-lg bg-purple-50 text-purple-600 hover:bg-purple-100 transition-colors"
                                                        title="Manual Stock Adjustment"
                                                    >
                                                        <FiSliders size={12} />
                                                    </button>
                                                    <button
                                                        onClick={() => deactivateProduct(p)}
                                                        className={`p-1 rounded-lg transition-colors ${
                                                            p.active ? 'bg-orange-50 text-orange-600 hover:bg-orange-100' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                                                        }`}
                                                        title={p.active ? 'Deactivate' : 'Reactivate'}
                                                    >
                                                        {p.active ? <FiEyeOff size={12} /> : <FiEye size={12} />}
                                                    </button>
                                                    <button
                                                        onClick={() => deleteProduct(p)}
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
            )}

            {/* ══════════════════════════════════════════════════════════════════════════
               7. FLOATING PAGINATION BAR
               ══════════════════════════════════════════════════════════════════════════ */}
            <div className="sticky bottom-0 z-30 bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl shadow-lg px-4 py-2.5 mt-3">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span>Show</span>
                        <select
                            value={perPage}
                            onChange={e => { setPerPage(parseInt(e.target.value, 10)); setPage(1); }}
                            className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 outline-none cursor-pointer"
                        >
                            {[10, 20, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                        <span>per page • Total <strong className="font-mono text-slate-800 font-bold">{filtered.length}</strong> products</span>
                    </div>

                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setPage(1)}
                            disabled={page === 1}
                            className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed"
                            title="First page"
                        >
                            <FiChevronsLeft size={13} />
                        </button>
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Previous page"
                        >
                            <FiChevronLeft size={13} />
                        </button>

                        <span className="px-2.5 text-xs font-mono font-bold text-slate-700">
                            Page {page} of {totalPages || 1}
                        </span>

                        <button
                            onClick={() => setPage(p => Math.min(totalPages || 1, p + 1))}
                            disabled={page >= totalPages}
                            className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Next page"
                        >
                            <FiChevronRight size={13} />
                        </button>
                        <button
                            onClick={() => setPage(totalPages || 1)}
                            disabled={page >= totalPages}
                            className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Last page"
                        >
                            <FiChevronsRight size={13} />
                        </button>
                    </div>
                </div>
            </div>

            {/* ══════════════════════════════════════════════════════════════════════════
               8. ADD/EDIT PRODUCT MODAL (ULTRA STUDIO STYLING)
               ══════════════════════════════════════════════════════════════════════════ */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setShowModal(false)}>
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto border border-slate-100" onClick={e => e.stopPropagation()}>
                        {/* Modal Header */}
                        <div className="bg-slate-900 px-6 py-4 text-white sticky top-0 z-20 flex items-center justify-between border-b border-slate-800">
                            <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center font-black">
                                    <FiPackage size={18} />
                                </div>
                                <div>
                                    <h2 className="text-sm font-black tracking-wide uppercase">
                                        {editingProduct ? 'Edit Catalog Product' : 'Register New Inventory Product'}
                                    </h2>
                                    <p className="text-[11px] text-slate-400 font-mono">
                                        {editingProduct ? editingProduct.product_code : `${previewCode || 'PRD-AUTO'} • Auto-assigned`}
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
                                <FiX size={16} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs font-medium text-slate-700">
                            {/* Product Particulars */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="md:col-span-2">
                                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                                        Product Name <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.product_name}
                                        onChange={e => setFormData({ ...formData, product_name: e.target.value })}
                                        placeholder="e.g. Sugar 2Kg Mumias"
                                        required
                                        className="w-full px-3 py-2 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:border-amber-500 outline-none transition-all shadow-2xs"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Alias / Short Name</label>
                                    <input
                                        type="text"
                                        value={formData.alias}
                                        onChange={e => setFormData({ ...formData, alias: e.target.value })}
                                        placeholder="e.g. Sug2k"
                                        className="w-full px-3 py-2 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:border-amber-500 outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Category</label>
                                    <select
                                        value={formData.category}
                                        onChange={e => setFormData({ ...formData, category: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:border-amber-500 outline-none cursor-pointer"
                                    >
                                        <option value="">Select Category</option>
                                        {categories.map(c => <option key={c.category_id} value={c.category_name}>{c.category_name}</option>)}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Barcode / SKU</label>
                                    <input
                                        type="text"
                                        value={formData.barcode}
                                        onChange={e => setFormData({ ...formData, barcode: e.target.value })}
                                        placeholder="Scan or type barcode"
                                        className="w-full px-3 py-2 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 font-mono focus:border-amber-500 outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">HS Code (Taxation)</label>
                                    <input
                                        type="text"
                                        value={formData.hscode}
                                        onChange={e => setFormData({ ...formData, hscode: e.target.value })}
                                        placeholder="Optional tax tariff code"
                                        className="w-full px-3 py-2 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 font-mono focus:border-amber-500 outline-none"
                                    />
                                </div>

                                {/* Dual Stock Opening Fields (Only when adding) */}
                                {!editingProduct && (
                                    <>
                                        <div>
                                            <label className="block text-[10px] font-black uppercase tracking-wider text-amber-700 mb-1">
                                                📦 Opening {formData.purchase_unit}s (Bulk Boxes / Bags)
                                            </label>
                                            <input
                                                type="number"
                                                value={openingBags || ''}
                                                onChange={e => setOpeningBags(Math.max(0, parseInt(e.target.value, 10) || 0))}
                                                min="0"
                                                placeholder="e.g. 5"
                                                className="w-full px-3 py-2 bg-amber-50/50 border border-amber-200 rounded-xl text-xs font-black text-amber-900 font-mono text-center focus:border-amber-500 outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black uppercase tracking-wider text-sky-700 mb-1">
                                                🔢 Opening {formData.sales_unit}s (Loose Pieces)
                                            </label>
                                            <input
                                                type="number"
                                                value={openingPieces || ''}
                                                onChange={e => setOpeningPieces(Math.max(0, parseInt(e.target.value, 10) || 0))}
                                                min="0"
                                                placeholder="e.g. 20"
                                                className="w-full px-3 py-2 bg-sky-50/50 border border-sky-200 rounded-xl text-xs font-black text-sky-900 font-mono text-center focus:border-sky-500 outline-none"
                                            />
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Pricing & Packaging Matrix Card */}
                            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/90 space-y-3">
                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                                    <FiDollarSign className="text-amber-500" size={13} />
                                    Pricing, Packaging Multiplier & Sales Units
                                </span>

                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                                    <div>
                                        <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Buy Unit</label>
                                        <select
                                            value={formData.purchase_unit}
                                            onChange={e => {
                                                const pu = e.target.value;
                                                const conv = UNIT_CONVERSIONS[pu];
                                                setFormData({ ...formData, purchase_unit: pu, pieces_per_package: conv?.[formData.sales_unit] || formData.pieces_per_package });
                                            }}
                                            className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none"
                                        >
                                            {units.map(u => <option key={u.unit_id} value={u.unit_name}>{u.unit_name}</option>)}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Buy Price (Ksh)</label>
                                        <input
                                            type="number"
                                            value={formData.purchase_cost}
                                            onChange={e => setFormData({ ...formData, purchase_cost: parseFloat(e.target.value) || 0 })}
                                            min="0"
                                            step="0.01"
                                            className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 outline-none"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[9px] font-bold text-amber-700 uppercase mb-1">Pcs / Package</label>
                                        <input
                                            type="number"
                                            value={formData.pieces_per_package}
                                            onChange={e => setFormData({ ...formData, pieces_per_package: parseInt(e.target.value, 10) || 1 })}
                                            min="1"
                                            className="w-full px-2.5 py-1.5 bg-amber-50 border border-amber-300 rounded-xl text-xs font-mono font-black text-amber-900 outline-none text-center"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Sell Unit</label>
                                        <select
                                            value={formData.sales_unit}
                                            onChange={e => setFormData({ ...formData, sales_unit: e.target.value })}
                                            className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none"
                                        >
                                            {units.map(u => <option key={u.unit_id} value={u.unit_name}>{u.unit_name}</option>)}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Sell Price (Ksh)</label>
                                        <input
                                            type="number"
                                            value={formData.sales_cost}
                                            onChange={e => setFormData({ ...formData, sales_cost: parseFloat(e.target.value) || 0 })}
                                            min="0"
                                            step="0.01"
                                            className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-mono font-black text-emerald-600 outline-none"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[9px] font-bold text-purple-700 uppercase mb-1">Wholesale (Ksh)</label>
                                        <input
                                            type="number"
                                            value={formData.wholesale_price}
                                            onChange={e => setFormData({ ...formData, wholesale_price: parseFloat(e.target.value) || 0 })}
                                            min="0"
                                            step="0.01"
                                            className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-purple-700 outline-none"
                                        />
                                    </div>
                                </div>

                                {/* Big Quantity Selling Price Input */}
                                {formData.pieces_per_package > 1 && (
                                    <div className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                        <div>
                                            <span className="text-[10px] font-black uppercase text-indigo-950 block">
                                                📦 Selling Price / Full {formData.purchase_unit} (Big Qty Price)
                                            </span>
                                            <p className="text-[10px] text-indigo-700">
                                                Charged when POS cashier selects selling by full {formData.purchase_unit} ({formData.pieces_per_package} {formData.sales_unit}s)
                                            </p>
                                        </div>
                                        <div className="w-full sm:w-48">
                                            <input
                                                type="number"
                                                step="any"
                                                min="0"
                                                value={(formData as any).package_sales_cost || ''}
                                                onChange={e => setFormData({ ...formData, package_sales_cost: parseFloat(e.target.value) || 0 } as any)}
                                                placeholder={String((formData.sales_cost || 0) * (formData.pieces_per_package || 1))}
                                                className="w-full px-3 py-1.5 bg-white border border-indigo-300 rounded-xl text-xs font-mono font-black text-indigo-900 outline-none focus:border-indigo-500 text-right"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* VAT, Supplier, Reorder */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">VAT Type</label>
                                    <select
                                        value={formData.vat_commodity}
                                        onChange={e => setFormData({ ...formData, vat_commodity: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none"
                                    >
                                        {vatOptions.map(v => <option key={v} value={v}>{v}</option>)}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Reorder Point</label>
                                    <input
                                        type="number"
                                        value={formData.reorder_point}
                                        onChange={e => setFormData({ ...formData, reorder_point: parseInt(e.target.value, 10) || 10 })}
                                        min="0"
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Supplier</label>
                                    <select
                                        value={formData.supplier_name}
                                        onChange={e => setFormData({ ...formData, supplier_name: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none cursor-pointer"
                                    >
                                        <option value="">Select Supplier</option>
                                        <option value={getKitchenSupplier()}>{getKitchenSupplier()}</option>
                                        {suppliers.filter(s => !s.is_kitchen).map(s => <option key={s.supplier_id} value={s.supplier_name}>{s.supplier_name}</option>)}
                                    </select>
                                </div>
                            </div>

                            {/* Color presets & flags */}
                            <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="flex items-center gap-4">
                                    <label className="flex items-center gap-1.5 cursor-pointer font-bold text-xs text-slate-700">
                                        <input
                                            type="checkbox"
                                            checked={formData.active}
                                            onChange={e => setFormData({ ...formData, active: e.target.checked })}
                                            className="rounded border-slate-300 accent-emerald-500"
                                        />
                                        <span>Active SKU</span>
                                    </label>
                                    <label className="flex items-center gap-1.5 cursor-pointer font-bold text-xs text-slate-700">
                                        <input
                                            type="checkbox"
                                            checked={formData.show_ps}
                                            onChange={e => setFormData({ ...formData, show_ps: e.target.checked })}
                                            className="rounded border-slate-300 accent-emerald-500"
                                        />
                                        <span>Show in POS</span>
                                    </label>
                                </div>

                                <div className="flex items-center gap-1">
                                    {colorPresets.slice(0, 8).map(c => (
                                        <button
                                            key={c.name}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, button_ui_color: c.gradient })}
                                            className={`w-5 h-5 rounded-md bg-gradient-to-br ${c.gradient} transition-transform ${formData.button_ui_color === c.gradient ? 'ring-2 ring-blue-500 scale-110' : ''}`}
                                            title={c.name}
                                        />
                                    ))}
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-2 pt-4 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 py-2.5 border border-slate-200 text-slate-600 font-bold rounded-xl text-xs hover:bg-slate-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-700 text-white font-black rounded-xl text-xs shadow-md shadow-amber-500/20 hover:shadow-lg transition-all flex items-center justify-center gap-1.5 disabled:opacity-40"
                                >
                                    {isSaving ? 'Processing...' : editingProduct ? 'Save Product Changes' : 'Create Inventory Product'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════════════
               9. LABEL GENERATOR MODAL
               ══════════════════════════════════════════════════════════════════════════ */}
            {showLabelModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setShowLabelModal(false)}>
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border border-slate-100" onClick={e => e.stopPropagation()}>
                        <div className="bg-slate-900 px-6 py-3.5 text-white flex items-center justify-between border-b border-slate-800">
                            <div className="flex items-center gap-2.5">
                                <FiPrinter size={18} className="text-purple-400" />
                                <div>
                                    <h2 className="text-sm font-black tracking-wide uppercase">Thermal Barcode & Shelf Label Studio</h2>
                                    <p className="text-[10px] text-slate-400 font-mono">
                                        {labelProducts.length} products selected • {labelProducts.reduce((s, id) => s + (labelQty[id] || 1), 0)} total labels queued
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setShowLabelModal(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-white">
                                <FiX size={16} />
                            </button>
                        </div>

                        <div className="flex flex-1 overflow-hidden">
                            {/* Left: Product Selector */}
                            <div className="flex-1 p-4 flex flex-col overflow-hidden border-r border-slate-100">
                                <div className="relative mb-2.5">
                                    <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                    <input
                                        type="text"
                                        value={labelSearch}
                                        onChange={e => setLabelSearch(e.target.value)}
                                        placeholder="Filter products to label..."
                                        className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none"
                                    />
                                </div>

                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl border border-slate-200">
                                        {(['small', 'medium', 'large'] as const).map(sz => (
                                            <button
                                                key={sz}
                                                onClick={() => setLabelSize(sz)}
                                                className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase transition-all ${labelSize === sz ? 'bg-purple-600 text-white shadow-xs' : 'text-slate-600'}`}
                                            >
                                                {sz}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="flex gap-1.5">
                                        <button
                                            onClick={() => {
                                                const ids = filteredLabelProducts.map(p => p.pid);
                                                setLabelProducts(ids);
                                                const q: Record<number, number> = {};
                                                ids.forEach(id => q[id] = labelQty[id] || 1);
                                                setLabelQty(q);
                                            }}
                                            className="px-2 py-1 bg-purple-50 text-purple-700 rounded-lg text-[10px] font-black"
                                        >
                                            Select All
                                        </button>
                                        <button
                                            onClick={() => setLabelProducts([])}
                                            className="px-2 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-black"
                                        >
                                            Clear
                                        </button>
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto space-y-1">
                                    {filteredLabelProducts.map(p => (
                                        <div
                                            key={p.pid}
                                            onClick={() => {
                                                if (labelProducts.includes(p.pid)) {
                                                    setLabelProducts(labelProducts.filter(id => id !== p.pid));
                                                } else {
                                                    setLabelProducts([...labelProducts, p.pid]);
                                                    setLabelQty({ ...labelQty, [p.pid]: labelQty[p.pid] || 1 });
                                                }
                                            }}
                                            className={`flex items-center gap-2 p-2 rounded-xl border transition-all cursor-pointer ${
                                                labelProducts.includes(p.pid) ? 'border-purple-300 bg-purple-50/50' : 'border-slate-100 hover:bg-slate-50'
                                            }`}
                                        >
                                            <input type="checkbox" checked={labelProducts.includes(p.pid)} readOnly className="rounded accent-purple-600 pointer-events-none" />
                                            <div className="flex-1 min-w-0">
                                                <div className="text-xs font-bold text-slate-800 truncate">{p.product_name}</div>
                                                <div className="text-[10px] text-slate-400 font-mono">
                                                    {p.product_code} • {fmtKES(p.sales_cost || 0)}
                                                </div>
                                            </div>
                                            {labelProducts.includes(p.pid) && (
                                                <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                                    <button
                                                        onClick={() => setLabelQty({ ...labelQty, [p.pid]: Math.max(1, (labelQty[p.pid] || 1) - 1) })}
                                                        className="w-5 h-5 rounded bg-purple-200 text-purple-800 font-black text-xs flex items-center justify-center"
                                                    >
                                                        -
                                                    </button>
                                                    <span className="w-6 text-center text-xs font-bold font-mono">{labelQty[p.pid] || 1}</span>
                                                    <button
                                                        onClick={() => setLabelQty({ ...labelQty, [p.pid]: (labelQty[p.pid] || 1) + 1 })}
                                                        className="w-5 h-5 rounded bg-purple-200 text-purple-800 font-black text-xs flex items-center justify-center"
                                                    >
                                                        +
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Right: Preview & Print */}
                            <div className="w-[320px] p-4 bg-slate-50 flex flex-col justify-between shrink-0">
                                <div>
                                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-700 block mb-2">Live Preview</span>
                                    <div className="border border-slate-200 rounded-xl bg-white p-3 min-h-[160px] flex items-center justify-center text-center">
                                        {labelProducts.length === 0 ? (
                                            <div className="text-slate-400">
                                                <FiPrinter size={28} className="mx-auto mb-1 text-slate-300" />
                                                <p className="text-xs font-bold">No products selected</p>
                                            </div>
                                        ) : (
                                            <div className="text-xs font-mono font-bold text-purple-700">
                                                Ready to print {labelProducts.reduce((s, id) => s + (labelQty[id] || 1), 0)} labels ({labelSize})
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-2 pt-3">
                                    <button
                                        onClick={printLabels}
                                        disabled={labelProducts.length === 0}
                                        className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-black rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-1.5 disabled:opacity-40"
                                    >
                                        <FiPrinter size={14} />
                                        <span>Print Thermal Labels</span>
                                    </button>
                                    <button
                                        onClick={() => setShowLabelModal(false)}
                                        className="w-full py-2 border border-slate-200 text-slate-600 font-bold rounded-xl text-xs hover:bg-white"
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════════════
               10. ITEM LOOKUP MODAL
               ══════════════════════════════════════════════════════════════════════════ */}
            {showLookupModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setShowLookupModal(false)}>
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg border border-slate-100 overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="bg-slate-900 px-6 py-3.5 text-white flex items-center justify-between border-b border-slate-800">
                            <div className="flex items-center gap-2.5">
                                <FiEye size={18} className="text-emerald-400" />
                                <h2 className="text-sm font-black tracking-wide uppercase">Quick Item Lookup</h2>
                            </div>
                            <button onClick={() => setShowLookupModal(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-white">
                                <FiX size={16} />
                            </button>
                        </div>
                        <div className="p-5 space-y-3.5">
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={lookupQuery}
                                    onChange={e => setLookupQuery(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && doLookup()}
                                    placeholder="Scan barcode or type SKU name..."
                                    className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-emerald-500"
                                    autoFocus
                                />
                                <button
                                    onClick={doLookup}
                                    className="px-4 py-2 bg-emerald-600 text-white font-bold text-xs rounded-xl"
                                >
                                    Lookup
                                </button>
                            </div>

                            {lookupResult && (
                                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-2.5 text-xs">
                                    <div>
                                        <div className="font-extrabold text-slate-900 text-sm">{lookupResult.product_name}</div>
                                        <div className="text-[10px] text-slate-400 font-mono">
                                            {lookupResult.product_code} • Barcode: {lookupResult.barcode || 'N/A'}
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200">
                                        <div className="bg-white p-2 rounded-lg border border-slate-100">
                                            <span className="text-[9px] uppercase font-bold text-slate-400 block">Buy Rate</span>
                                            <span className="font-mono font-bold text-slate-800">{fmtKES(lookupResult.purchase_cost || 0)}</span>
                                        </div>
                                        <div className="bg-white p-2 rounded-lg border border-slate-100">
                                            <span className="text-[9px] uppercase font-bold text-slate-400 block">Sell Rate</span>
                                            <span className="font-mono font-bold text-emerald-600">{fmtKES(lookupResult.sales_cost || 0)}</span>
                                        </div>
                                        <div className="bg-white p-2 rounded-lg border border-slate-100">
                                            <span className="text-[9px] uppercase font-bold text-slate-400 block">Bags/Boxes</span>
                                            <span className="font-mono font-bold text-amber-800">📦 {bagStockData[lookupResult.pid] || 0}</span>
                                        </div>
                                        <div className="bg-white p-2 rounded-lg border border-slate-100">
                                            <span className="text-[9px] uppercase font-bold text-slate-400 block">Loose Pcs</span>
                                            <span className="font-mono font-bold text-sky-800">🔢 {pieceStockData[lookupResult.pid] || 0}</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════════════
               11. STOCK HISTORY MODAL
               ══════════════════════════════════════════════════════════════════════════ */}
            {showStockHistoryModal && stockHistoryProduct && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setShowStockHistoryModal(false)}>
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto border border-slate-100" onClick={e => e.stopPropagation()}>
                        <div className="bg-slate-900 px-6 py-3.5 text-white flex items-center justify-between border-b border-slate-800 sticky top-0 z-10">
                            <div>
                                <h2 className="text-sm font-black tracking-wide uppercase flex items-center gap-2">
                                    <FiClock size={16} className="text-sky-400" />
                                    <span>Stock Ledger Movements</span>
                                </h2>
                                <p className="text-[10px] text-slate-400 font-mono">
                                    {stockHistoryProduct.product_name} ({stockHistoryProduct.product_code})
                                </p>
                            </div>
                            <button onClick={() => setShowStockHistoryModal(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-white">
                                <FiX size={16} />
                            </button>
                        </div>
                        <div className="p-5">
                            {stockHistory.length === 0 ? (
                                <p className="text-center text-slate-400 py-10 text-xs">No recorded ledger movements</p>
                            ) : (
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="bg-slate-100 text-slate-600 font-bold text-[10px] uppercase">
                                            <th className="px-3 py-2 text-left">Date</th>
                                            <th className="px-3 py-2 text-left">Reference</th>
                                            <th className="px-3 py-2 text-left">Type</th>
                                            <th className="px-3 py-2 text-right text-emerald-600">In</th>
                                            <th className="px-3 py-2 text-right text-rose-600">Out</th>
                                            <th className="px-3 py-2 text-right">Balance</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {stockHistory.map(r => (
                                            <tr key={r.id} className="hover:bg-slate-50">
                                                <td className="px-3 py-2 font-mono text-[11px] text-slate-500">{r.date}</td>
                                                <td className="px-3 py-2 font-mono font-bold text-indigo-600 text-[11px]">{r.ref}</td>
                                                <td className="px-3 py-2 text-[11px] text-slate-600">{r.type}</td>
                                                <td className="px-3 py-2 text-right font-mono font-bold text-emerald-600">{r.qty_in > 0 ? `+${r.qty_in}` : ''}</td>
                                                <td className="px-3 py-2 text-right font-mono font-bold text-rose-600">{r.qty_out > 0 ? `-${r.qty_out}` : ''}</td>
                                                <td className="px-3 py-2 text-right font-mono font-bold text-slate-800">{r.balance}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════════════
               12. PRICE HISTORY MODAL
               ══════════════════════════════════════════════════════════════════════════ */}
            {showPriceHistoryModal && priceHistoryProduct && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setShowPriceHistoryModal(false)}>
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl max-h-[85vh] overflow-y-auto border border-slate-100" onClick={e => e.stopPropagation()}>
                        <div className="bg-slate-900 px-6 py-3.5 text-white flex items-center justify-between border-b border-slate-800 sticky top-0 z-10">
                            <div>
                                <h2 className="text-sm font-black tracking-wide uppercase flex items-center gap-2">
                                    <FiTrendingUp size={16} className="text-amber-400" />
                                    <span>Price Adjustment Audit Trail</span>
                                </h2>
                                <p className="text-[10px] text-slate-400 font-mono">{priceHistoryProduct.product_name}</p>
                            </div>
                            <button onClick={() => setShowPriceHistoryModal(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-white">
                                <FiX size={16} />
                            </button>
                        </div>
                        <div className="p-5">
                            {priceHistory.length === 0 ? (
                                <p className="text-center text-slate-400 py-10 text-xs">No price revisions logged</p>
                            ) : (
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="bg-slate-100 text-slate-600 font-bold text-[10px] uppercase">
                                            <th className="px-3 py-2 text-left">Date</th>
                                            <th className="px-3 py-2 text-right">Old Buy</th>
                                            <th className="px-3 py-2 text-right">New Buy</th>
                                            <th className="px-3 py-2 text-right">Old Sell</th>
                                            <th className="px-3 py-2 text-right">New Sell</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {priceHistory.map(r => (
                                            <tr key={r.id} className="hover:bg-slate-50 font-mono text-[11px]">
                                                <td className="px-3 py-2 text-slate-500">{r.date}</td>
                                                <td className="px-3 py-2 text-right line-through text-slate-400">{r.old_buy.toLocaleString()}</td>
                                                <td className="px-3 py-2 text-right font-bold text-blue-600">{r.new_buy.toLocaleString()}</td>
                                                <td className="px-3 py-2 text-right line-through text-slate-400">{r.old_sell.toLocaleString()}</td>
                                                <td className="px-3 py-2 text-right font-bold text-emerald-600">{r.new_sell.toLocaleString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════════════
               13. STOCK ADJUSTMENT MODAL
               ══════════════════════════════════════════════════════════════════════════ */}
            {showStockAdjustModal && adjustProduct && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setShowStockAdjustModal(false)}>
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md border border-slate-100 overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="bg-slate-900 px-6 py-3.5 text-white flex items-center justify-between border-b border-slate-800">
                            <div>
                                <h2 className="text-sm font-black tracking-wide uppercase flex items-center gap-2">
                                    <FiSliders size={16} className="text-purple-400" />
                                    <span>Manual Stock Adjustment</span>
                                </h2>
                                <p className="text-[10px] text-slate-400 font-mono">
                                    {adjustProduct.product_name} • 📦 {bagStockData[adjustProduct.pid] || 0} {adjustProduct.purchase_unit} • 🔢 {pieceStockData[adjustProduct.pid] || 0} Pcs
                                </p>
                            </div>
                            <button onClick={() => setShowStockAdjustModal(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-white">
                                <FiX size={16} />
                            </button>
                        </div>
                        <div className="p-5 space-y-3.5">
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setAdjustType('add')}
                                    className={`flex-1 py-2 rounded-xl font-black text-xs transition-all ${
                                        adjustType === 'add' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600'
                                    }`}
                                >
                                    ➕ Add Stock (Increment)
                                </button>
                                <button
                                    onClick={() => setAdjustType('remove')}
                                    className={`flex-1 py-2 rounded-xl font-black text-xs transition-all ${
                                        adjustType === 'remove' ? 'bg-rose-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600'
                                    }`}
                                >
                                    ➖ Remove Stock (Deduct)
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-2.5">
                                <div>
                                    <label className="block text-[10px] font-black uppercase text-amber-700 mb-1">
                                        📦 Full {adjustProduct.purchase_unit}s
                                    </label>
                                    <input
                                        type="number"
                                        value={adjustBags || ''}
                                        onChange={e => setAdjustBags(Math.max(0, parseInt(e.target.value, 10) || 0))}
                                        min="0"
                                        placeholder="0"
                                        className="w-full px-3 py-2 bg-amber-50/50 border border-amber-200 rounded-xl text-center font-mono font-black text-amber-900 text-sm outline-none"
                                        autoFocus
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase text-sky-700 mb-1">
                                        🔢 Loose {adjustProduct.sales_unit}s
                                    </label>
                                    <input
                                        type="number"
                                        value={adjustPieces || ''}
                                        onChange={e => setAdjustPieces(Math.max(0, parseInt(e.target.value, 10) || 0))}
                                        min="0"
                                        placeholder="0"
                                        className="w-full px-3 py-2 bg-sky-50/50 border border-sky-200 rounded-xl text-center font-mono font-black text-sky-900 text-sm outline-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Audit Reason / Note</label>
                                <input
                                    type="text"
                                    value={adjustReason}
                                    onChange={e => setAdjustReason(e.target.value)}
                                    placeholder="e.g. Physical inventory count, damaged goods..."
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none"
                                />
                            </div>

                            <div className="flex gap-2 pt-2 border-t border-slate-100">
                                <button
                                    onClick={() => setShowStockAdjustModal(false)}
                                    className="flex-1 py-2 border border-slate-200 text-slate-600 font-bold rounded-xl text-xs"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={submitStockAdjust}
                                    className={`flex-1 py-2 font-black rounded-xl text-xs text-white shadow-xs ${
                                        adjustType === 'add' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                                    }`}
                                >
                                    {adjustType === 'add' ? 'Post Addition' : 'Post Deduction'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════════════
               14. IMPORT PRODUCTS MODAL
               ══════════════════════════════════════════════════════════════════════════ */}
            {showImportModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => importStatus !== 'importing' && setShowImportModal(false)}>
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl max-h-[85vh] overflow-y-auto border border-slate-100" onClick={e => e.stopPropagation()}>
                        <div className="bg-slate-900 px-6 py-3.5 text-white flex items-center justify-between border-b border-slate-800">
                            <div className="flex items-center gap-2.5">
                                <FiUpload size={18} className="text-amber-400" />
                                <h2 className="text-sm font-black tracking-wide uppercase">CSV Batch Product Importer</h2>
                            </div>
                            {importStatus !== 'importing' && (
                                <button onClick={() => setShowImportModal(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-white">
                                    <FiX size={16} />
                                </button>
                            )}
                        </div>

                        <div className="p-6 space-y-4 text-xs font-medium text-slate-700">
                            {importStatus === 'success' && (
                                <div className="text-center py-4">
                                    <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-emerald-500/30 text-white font-black">
                                        <FiCheck size={32} />
                                    </div>
                                    <h3 className="text-lg font-black text-slate-900">{importSuccessCount} Products Imported!</h3>
                                    <button
                                        onClick={() => setShowImportModal(false)}
                                        className="mt-4 px-6 py-2.5 bg-slate-900 text-white font-black rounded-xl text-xs"
                                    >
                                        Close Wizard
                                    </button>
                                </div>
                            )}

                            {(importStatus === 'idle' || importStatus === 'parsing') && (
                                <>
                                    <div>
                                        <label className="block text-[10px] font-black uppercase text-slate-500 mb-1.5">Select CSV File</label>
                                        <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-slate-300 rounded-2xl bg-slate-50 hover:bg-slate-100/80 cursor-pointer transition-colors">
                                            <FiFileText size={28} className="text-slate-400 mb-1" />
                                            <p className="text-xs font-bold text-slate-700">{importFile ? importFile.name : 'Click to select CSV'}</p>
                                            <input type="file" accept=".csv" className="hidden" onChange={e => { if (e.target.files?.[0]) setImportFile(e.target.files[0]); }} />
                                        </label>
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-black uppercase text-slate-500 mb-1.5">Import Mode</label>
                                        <div className="grid grid-cols-3 gap-2">
                                            {([
                                                { value: 'add_new' as const, label: 'Add New', desc: 'Skip existing' },
                                                { value: 'update' as const, label: 'Update Existing', desc: 'Sync prices' },
                                                { value: 'overwrite' as const, label: 'Full Wipe', desc: 'Danger mode' },
                                            ]).map(m => (
                                                <label
                                                    key={m.value}
                                                    className={`p-2.5 rounded-xl border text-center cursor-pointer transition-all ${
                                                        importMode === m.value ? 'bg-amber-50 border-amber-300 text-amber-900 shadow-2xs font-bold' : 'border-slate-200'
                                                    }`}
                                                >
                                                    <input type="radio" name="importMode" value={m.value} checked={importMode === m.value} onChange={() => setImportMode(m.value)} className="hidden" />
                                                    <div className="text-xs font-black">{m.label}</div>
                                                    <div className="text-[10px] text-slate-400 mt-0.5">{m.desc}</div>
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="flex gap-2 pt-3 border-t border-slate-100">
                                        <button
                                            onClick={() => setShowImportModal(false)}
                                            className="flex-1 py-2.5 border border-slate-200 text-slate-600 font-bold rounded-xl text-xs"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={importProducts}
                                            disabled={!importFile}
                                            className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-black rounded-xl text-xs shadow-sm hover:shadow disabled:opacity-40"
                                        >
                                            Start Batch Import
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
