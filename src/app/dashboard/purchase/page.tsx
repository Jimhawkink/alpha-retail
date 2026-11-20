'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';
import toast, { Toaster } from 'react-hot-toast';
import {
    FiShoppingBag,
    FiPackage,
    FiX,
    FiPlus,
    FiTrash2,
    FiDollarSign,
    FiTruck,
    FiCalendar,
    FiHash,
    FiSave,
    FiCheckCircle,
    FiAlertTriangle,
    FiTrendingUp,
    FiSearch,
    FiRefreshCw,
    FiEdit3,
    FiArrowRight,
    FiClock,
    FiShield,
    FiZap,
    FiActivity,
    FiLayers,
    FiCheck,
    FiChevronDown,
    FiBox,
    FiFileText,
    FiTag
} from 'react-icons/fi';

/* ══════════════════════════════════════════════════════════════════════════════
   UNIT CONVERSIONS & CONSTANTS
   ══════════════════════════════════════════════════════════════════════════════ */
const UNIT_CONVERSIONS: Record<string, Record<string, number>> = {
    'Box': { 'Piece': 1, 'Box': 1 },
    'Pack': { 'Piece': 1, 'Pack': 1 },
    'Dozen': { 'Piece': 12, 'Dozen': 1 },
    'Kilogram': { 'Gram': 1000, 'Kilogram': 1 },
    'Bag': { 'Kilogram': 1, 'Gram': 1000, 'Bag': 1 },
    'Liter': { 'Milliliter': 1000, 'Liter': 1 },
};

const ALL_UNITS = [
    'Piece', 'Box', 'Pack', 'Dozen', 'Kilogram', 'Gram', 'Bag', 'Liter',
    'Milliliter', 'Carton', 'Bundle', 'Roll', 'Bottle', 'Sachet', 'Tablet', 'Strip'
];

interface Supplier {
    supplier_id: number;
    supplier_code: string;
    supplier_name: string;
    phone: string;
    contact_person: string;
}

interface Product {
    pid: number;
    product_code: string;
    product_name: string;
    purchase_unit: string;
    sales_unit: string;
    purchase_cost: number;
    sales_cost: number;
    category: string;
    pieces_per_package: number;
    barcode: string;
}

interface PurchaseItem {
    id: number;
    productId: number;
    productCode: string;
    productName: string;
    purchaseUnit: string;
    qty: number;
    price: number;
    total: number;
    bagQty: number;
    pieceQty: number;
    batchNumber: string;
    expiryDate: string;
    oldCost: number;
    oldSell: number;
    newCost: number;
    newSell: number;
    updatePrices: boolean;
    piecesPerPackage: number;
}

const fmtKES = (n: number) => `Ksh ${Math.round(n || 0).toLocaleString('en-KE')}`;
const fmtK = (n: number) => {
    if (n >= 1_000_000) return `Ksh ${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000) return `Ksh ${(n / 1_000).toFixed(1)}K`;
    return `Ksh ${Math.round(n || 0).toLocaleString('en-KE')}`;
};

export default function PurchaseEntryPage() {
    const { activeOutlet, expiryEnabled } = useOutlet();
    const outletId = activeOutlet?.outlet_id || 1;

    // Core Data
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // Search Engine
    const [productSearch, setProductSearch] = useState('');
    const [showProductDropdown, setShowProductDropdown] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Header & Order Metadata
    const [invoiceNo, setInvoiceNo] = useState('');
    const [selectedSupplier, setSelectedSupplier] = useState<string>('');
    const [supplierInvoiceNo, setSupplierInvoiceNo] = useState('');
    const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
    const [paymentStatus, setPaymentStatus] = useState<'Paid' | 'Unpaid' | 'Partial'>('Paid');
    const [notes, setNotes] = useState('');

    // Active Cart Items
    const [items, setItems] = useState<PurchaseItem[]>([]);

    // Product Staging & Dual-Stock Inputs
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [qty, setQty] = useState<number>(1);
    const [price, setPrice] = useState<number>(0);
    const [purchaseUnit, setPurchaseUnit] = useState<string>('');
    const [availableQty, setAvailableQty] = useState<number>(0);
    const [currentBagQty, setCurrentBagQty] = useState<number>(0);
    const [currentPieceQty, setCurrentPieceQty] = useState<number>(0);
    const [itemBagQty, setItemBagQty] = useState<number>(0);
    const [itemPieceQty, setItemPieceQty] = useState<number>(0);
    const [itemBatchNumber, setItemBatchNumber] = useState('');
    const [itemExpiryDate, setItemExpiryDate] = useState('');
    const [newSellPrice, setNewSellPrice] = useState<number>(0);
    const [shouldUpdatePrices, setShouldUpdatePrices] = useState(false);
    const [priceChanged, setPriceChanged] = useState(false);

    // Modals
    const [showSuccess, setShowSuccess] = useState(false);
    const [savedInvoice, setSavedInvoice] = useState('');
    const [showPriceConfirm, setShowPriceConfirm] = useState(false);

    // ─── GENERATE INVOICE NO ───
    const generateInvoiceNo = useCallback(async () => {
        try {
            const { data } = await supabase
                .from('retail_purchases')
                .select('purchase_no')
                .like('purchase_no', 'INV-%');
            let maxN = 0;
            if (data && data.length > 0) {
                for (const row of data) {
                    const m = row.purchase_no?.match(/INV-(\d+)/);
                    if (m) {
                        const n = parseInt(m[1], 10);
                        if (n > maxN) maxN = n;
                    }
                }
            }
            setInvoiceNo(`INV-${String(maxN + 1).padStart(4, '0')}`);
        } catch {
            setInvoiceNo(`INV-${Date.now().toString(36).toUpperCase()}`);
        }
    }, []);

    // ─── INITIAL LOAD ───
    useEffect(() => {
        const loadInitialData = async () => {
            if (!activeOutlet) return;
            setIsLoading(true);
            try {
                const [suppRes, invRes] = await Promise.all([
                    supabase
                        .from('retail_suppliers')
                        .select('supplier_id, supplier_code, supplier_name, phone, contact_person')
                        .order('supplier_name'),
                    generateInvoiceNo()
                ]);

                if (suppRes.error) {
                    toast.error(`Suppliers load error: ${suppRes.error.message}`);
                }
                setSuppliers(suppRes.data || []);
            } catch {
                toast.error('Failed to initialize purchase studio');
            }
            setIsLoading(false);
        };
        loadInitialData();
    }, [activeOutlet, outletId, generateInvoiceNo]);

    // ─── LIVE SERVER SEARCH DEBOUNCE ───
    useEffect(() => {
        if (productSearch.trim().length < 1) {
            setProducts([]);
            setIsSearching(false);
            return;
        }

        if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
        searchDebounceRef.current = setTimeout(async () => {
            setIsSearching(true);
            const q = productSearch.trim();

            try {
                // Prefix match (highest ranking)
                const { data: prefixData } = await supabase
                    .from('retail_products')
                    .select('pid, product_code, product_name, purchase_unit, sales_unit, purchase_cost, sales_cost, category, pieces_per_package, barcode')
                    .eq('outlet_id', outletId)
                    .neq('active', false)
                    .or(`product_name.ilike.${q}%,product_code.ilike.${q}%,barcode.ilike.${q}%`)
                    .order('product_name')
                    .limit(10);

                // Substring match
                const { data: containsData } = await supabase
                    .from('retail_products')
                    .select('pid, product_code, product_name, purchase_unit, sales_unit, purchase_cost, sales_cost, category, pieces_per_package, barcode')
                    .eq('outlet_id', outletId)
                    .neq('active', false)
                    .or(`product_name.ilike.%${q}%,product_code.ilike.%${q}%,barcode.ilike.%${q}%`)
                    .order('product_name')
                    .limit(15);

                const prefixPids = new Set((prefixData || []).map((p: any) => p.pid));
                const merged = [
                    ...(prefixData || []),
                    ...(containsData || []).filter((p: any) => !prefixPids.has(p.pid))
                ].slice(0, 15);

                setProducts(merged);
            } catch {
                // Ignore search error
            }
            setIsSearching(false);
        }, 250);
    }, [productSearch, outletId]);

    // ─── SELECT PRODUCT & LOAD DUAL-STOCK ───
    const selectProduct = async (product: Product) => {
        setSelectedProduct(product);
        setProductSearch(product.product_name);
        setShowProductDropdown(false);
        setPurchaseUnit(product.purchase_unit || 'Piece');
        setPrice(product.purchase_cost || 0);
        setNewSellPrice(product.sales_cost || 0);
        setShouldUpdatePrices(false);
        setPriceChanged(false);
        setQty(1);
        setItemBagQty(0);
        setItemPieceQty(0);
        setItemBatchNumber('');
        setItemExpiryDate('');

        // Fetch current dual-stock (Bags & Pieces)
        const loadStock = async (withOutlet: boolean) => {
            let q = supabase.from('retail_stock').select('qty, storage_type').eq('pid', product.pid);
            if (withOutlet) q = (q as any).eq('outlet_id', outletId);
            const { data } = await q;
            return data || [];
        };

        let stockRows = await loadStock(true);
        if (!stockRows || stockRows.length === 0) stockRows = await loadStock(false);

        const bags = stockRows.filter((r: any) => r.storage_type === 'Bags').reduce((s: number, r: any) => s + (Number(r.qty) || 0), 0);
        const pieces = stockRows.filter((r: any) => r.storage_type !== 'Bags').reduce((s: number, r: any) => s + (Number(r.qty) || 0), 0);

        setCurrentBagQty(bags);
        setCurrentPieceQty(pieces);
        setAvailableQty(bags + pieces);
    };

    const handlePriceChange = (newCost: number) => {
        setPrice(newCost);
        setPriceChanged(false);
    };

    const getAvailableUnits = (product: Product): string[] => {
        const units = new Set<string>();
        units.add(product.purchase_unit || 'Piece');
        units.add(product.sales_unit || 'Piece');
        const conv = UNIT_CONVERSIONS[product.purchase_unit];
        if (conv) Object.keys(conv).forEach(u => units.add(u));
        const conv2 = UNIT_CONVERSIONS[product.sales_unit];
        if (conv2) Object.keys(conv2).forEach(u => units.add(u));
        ALL_UNITS.forEach(u => units.add(u));
        return Array.from(units);
    };

    const getStockQty = (q: number, unit: string, product: Product): number => {
        const prodPurchaseUnit = product.purchase_unit || 'Piece';
        if (unit === prodPurchaseUnit) return q;
        const conv = UNIT_CONVERSIONS[prodPurchaseUnit];
        if (conv && conv[unit]) return q / conv[unit];
        const revConv = UNIT_CONVERSIONS[unit];
        if (revConv && revConv[prodPurchaseUnit]) return q * revConv[prodPurchaseUnit];
        return q;
    };

    // ─── ADD ITEM TO ORDER ───
    const addItem = () => {
        if (!selectedProduct) {
            toast.error('Select a product to stage');
            return;
        }
        if (price <= 0) {
            toast.error('Unit rate must be greater than Ksh 0');
            return;
        }
        if (itemBagQty <= 0 && itemPieceQty <= 0 && qty <= 0) {
            toast.error('Enter full boxes or loose pieces quantity');
            return;
        }

        const useDualQty = itemBagQty > 0 || itemPieceQty > 0;
        const effectiveQty = useDualQty ? (itemBagQty + itemPieceQty) : qty;
        const ppp = selectedProduct.pieces_per_package || 1;
        const lineTotal = useDualQty
            ? (itemBagQty * price) + (itemPieceQty * (price / ppp))
            : qty * price;

        const newItem: PurchaseItem = {
            id: Date.now(),
            productId: selectedProduct.pid,
            productCode: selectedProduct.product_code || '',
            productName: selectedProduct.product_name,
            purchaseUnit: purchaseUnit,
            qty: effectiveQty,
            price: price,
            total: Math.round(lineTotal),
            bagQty: itemBagQty,
            pieceQty: itemPieceQty,
            batchNumber: itemBatchNumber || '',
            expiryDate: itemExpiryDate || '',
            oldCost: selectedProduct.purchase_cost || 0,
            oldSell: selectedProduct.sales_cost || 0,
            newCost: price,
            newSell: newSellPrice,
            updatePrices: shouldUpdatePrices,
            piecesPerPackage: ppp,
        };

        setItems(prev => [newItem, ...prev]);
        toast.success(`Added ${selectedProduct.product_name} (${fmtKES(lineTotal)})`);

        // Reset Staging fields
        setSelectedProduct(null);
        setQty(1);
        setPrice(0);
        setPurchaseUnit('');
        setProductSearch('');
        setPriceChanged(false);
        setShouldUpdatePrices(false);
        setItemBagQty(0);
        setItemPieceQty(0);
        setItemBatchNumber('');
        setItemExpiryDate('');
        if (searchInputRef.current) searchInputRef.current.focus();
    };

    const toggleItemPriceUpdate = (itemId: number, update: boolean) => {
        setItems(prev => prev.map(i => i.id === itemId ? { ...i, updatePrices: update } : i));
    };

    const editItemSellPrice = (itemId: number, newSell: number) => {
        setItems(prev => prev.map(i => i.id === itemId ? { ...i, newSell } : i));
    };

    const removeItem = (id: number) => {
        setItems(prev => prev.filter(i => i.id !== id));
        toast.success('Line item removed');
    };

    const subtotal = items.reduce((s, i) => s + i.total, 0);
    const total = subtotal;
    const totalBags = items.reduce((s, i) => s + (i.bagQty || 0), 0);
    const totalPieces = items.reduce((s, i) => s + (i.pieceQty || 0), 0);
    const currentSupplierObj = suppliers.find(s => s.supplier_code === selectedSupplier);

    // ─── COMMIT PURCHASE ORDER ───
    const savePurchase = async () => {
        if (!selectedSupplier) {
            toast.error('Select an authorized supplier');
            return;
        }
        if (items.length === 0) {
            toast.error('Stage at least one line item before saving');
            return;
        }

        const priceUpdateItems = items.filter(i => i.updatePrices && (i.newCost !== i.oldCost || i.newSell !== i.oldSell));
        if (priceUpdateItems.length > 0 && !showPriceConfirm) {
            setShowPriceConfirm(true);
            return;
        }
        setShowPriceConfirm(false);
        setIsSaving(true);

        try {
            const userData = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
            const user = userData ? JSON.parse(userData) : null;
            const supplier = suppliers.find(s => s.supplier_code === selectedSupplier);

            // Fetch true max purchase_id to avoid serial collisions
            const { data: maxRow } = await supabase
                .from('retail_purchases')
                .select('purchase_id')
                .not('purchase_id', 'is', null)
                .order('purchase_id', { ascending: false })
                .limit(1)
                .maybeSingle();

            const nextPurchaseId = ((maxRow?.purchase_id as number) || 1000) + 1;

            const { data: purchaseData, error: pErr } = await supabase
                .from('retail_purchases')
                .insert({
                    purchase_id: nextPurchaseId,
                    purchase_no: invoiceNo,
                    purchase_date: purchaseDate,
                    supplier_id: supplier?.supplier_id || null,
                    supplier_name: supplier?.supplier_name || '',
                    supplier_invoice: supplierInvoiceNo,
                    sub_total: subtotal,
                    discount: 0,
                    vat: 0,
                    grand_total: total,
                    status: 'Completed',
                    payment_status: paymentStatus,
                    created_by: user?.name || 'Administrator',
                    outlet_id: outletId
                })
                .select()
                .single();

            if (pErr) throw new Error(`Save purchase header: ${pErr.message}`);
            const pid = purchaseData?.purchase_id ?? nextPurchaseId;

            // Insert line items
            const purchaseItemsData = items.map(i => ({
                purchase_id: pid,
                product_id: i.productId,
                product_code: i.productCode,
                product_name: i.productName,
                quantity: i.qty,
                unit: i.purchaseUnit,
                rate: i.price,
                total_amount: i.total,
                bag_qty: i.bagQty || 0,
                piece_qty: i.pieceQty || 0,
                batch_number: i.batchNumber || null,
                expiry_date: i.expiryDate || null,
            }));

            let { error: iErr } = await supabase.from('retail_purchase_products').insert(purchaseItemsData);
            if (iErr && iErr.message?.includes('column')) {
                // Fallback for missing optional columns
                const fallbackData = items.map(i => ({
                    purchase_id: pid,
                    product_id: i.productId,
                    product_code: i.productCode,
                    product_name: i.productName,
                    quantity: i.qty,
                    unit: i.purchaseUnit,
                    rate: i.price,
                    total_amount: i.total,
                }));
                const fb = await supabase.from('retail_purchase_products').insert(fallbackData);
                iErr = fb.error;
            }
            if (iErr) throw iErr;

            // Dual Stock Ledger & WAC Updates
            for (const item of items) {
                const hasDualQty = item.bagQty > 0 || item.pieceQty > 0;

                if (hasDualQty) {
                    // Update Bags Ledger
                    if (item.bagQty > 0) {
                        const { data: bagRow } = await supabase.from('retail_stock')
                            .select('st_id, qty')
                            .eq('pid', item.productId)
                            .eq('outlet_id', outletId)
                            .eq('storage_type', 'Bags')
                            .order('qty', { ascending: false })
                            .limit(1)
                            .maybeSingle();

                        if (bagRow) {
                            const { error: e } = await supabase.from('retail_stock')
                                .update({ qty: (bagRow.qty || 0) + item.bagQty, invoice_no: invoiceNo })
                                .eq('st_id', bagRow.st_id);
                            if (e) throw new Error(`Bags update: ${e.message}`);
                        } else {
                            const { error: e } = await supabase.from('retail_stock')
                                .insert({ pid: item.productId, invoice_no: invoiceNo, qty: item.bagQty, storage_type: 'Bags', outlet_id: outletId });
                            if (e) throw new Error(`Bags insert: ${e.message}`);
                        }
                    }

                    // Update Pieces Ledger
                    if (item.pieceQty > 0) {
                        const { data: pcRow } = await supabase.from('retail_stock')
                            .select('st_id, qty')
                            .eq('pid', item.productId)
                            .eq('outlet_id', outletId)
                            .eq('storage_type', 'Pieces')
                            .order('qty', { ascending: false })
                            .limit(1)
                            .maybeSingle();

                        if (pcRow) {
                            const { error: e } = await supabase.from('retail_stock')
                                .update({ qty: (pcRow.qty || 0) + item.pieceQty, invoice_no: invoiceNo })
                                .eq('st_id', pcRow.st_id);
                            if (e) throw new Error(`Pieces update: ${e.message}`);
                        } else {
                            const { error: e } = await supabase.from('retail_stock')
                                .insert({ pid: item.productId, invoice_no: invoiceNo, qty: item.pieceQty, storage_type: 'Pieces', outlet_id: outletId });
                            if (e) throw new Error(`Pieces insert: ${e.message}`);
                        }
                    }
                } else {
                    // Single unit legacy ledger
                    const product = products.find(p => p.pid === item.productId);
                    const stockQty = product ? getStockQty(item.qty, item.purchaseUnit, product) : item.qty;
                    const { data: sData } = await supabase.from('retail_stock')
                        .select('st_id, qty')
                        .eq('pid', item.productId)
                        .eq('outlet_id', outletId)
                        .order('qty', { ascending: false })
                        .limit(1)
                        .maybeSingle();

                    if (sData) {
                        const { error: e } = await supabase.from('retail_stock')
                            .update({ qty: (sData.qty || 0) + stockQty, invoice_no: invoiceNo })
                            .eq('st_id', sData.st_id);
                        if (e) throw new Error(`Stock update: ${e.message}`);
                    } else {
                        await supabase.from('retail_stock')
                            .insert({ pid: item.productId, invoice_no: invoiceNo, qty: stockQty, storage_type: 'Store', outlet_id: outletId });
                    }
                }

                // Expiry Batch Tracking
                if (item.expiryDate && expiryEnabled) {
                    try {
                        const batchNum = item.batchNumber || `B-${Date.now().toString(36).toUpperCase()}`;
                        const totalBatchQty = item.bagQty > 0
                            ? item.bagQty * (item.piecesPerPackage || 1) + (item.pieceQty || 0)
                            : item.pieceQty > 0 ? item.pieceQty : item.qty;

                        await supabase.from('retail_product_batches').insert({
                            pid: item.productId,
                            product_name: item.productName,
                            batch_number: batchNum,
                            expiry_date: item.expiryDate,
                            qty_received: totalBatchQty,
                            qty_remaining: totalBatchQty,
                            cost_price: item.price,
                            selling_price: item.newSell || item.oldSell,
                            supplier_name: supplier?.supplier_name || '',
                            outlet_id: outletId,
                            status: 'Active',
                            received_date: purchaseDate,
                        });
                    } catch {
                        // ignore if batches table does not exist
                    }
                }

                // Weighted Average Cost (WAC) Update
                if (item.newCost > 0) {
                    const { data: currentStockRows } = await supabase.from('retail_stock').select('qty').eq('pid', item.productId).eq('outlet_id', outletId);
                    const currentTotalQty = currentStockRows?.reduce((sum, row) => sum + (row.qty || 0), 0) || 0;

                    let wac = item.newCost;
                    if (currentTotalQty > 0 && item.oldCost > 0) {
                        const currentStockInPurchaseUnits = currentTotalQty / (item.piecesPerPackage || 1);
                        const totalValueOld = currentStockInPurchaseUnits * item.oldCost;
                        const receivedQtyInPurchaseUnits = item.qty;
                        const totalValueNew = receivedQtyInPurchaseUnits * item.newCost;
                        wac = (totalValueOld + totalValueNew) / (currentStockInPurchaseUnits + receivedQtyInPurchaseUnits);
                    }
                    const newWac = Math.round(wac * 100) / 100;
                    const existingSell = item.oldSell || 0;
                    const margin = newWac > 0 ? Math.round(((existingSell - newWac) / newWac) * 10000) / 100 : 0;

                    await supabase.from('retail_products').update({
                        purchase_cost: newWac,
                        margin_per: margin,
                    }).eq('pid', item.productId);

                    if (newWac !== item.oldCost) {
                        try {
                            await supabase.from('retail_price_history').insert({
                                pid: item.productId,
                                old_purchase_cost: item.oldCost,
                                new_purchase_cost: newWac,
                                old_sales_cost: item.oldSell,
                                new_sales_cost: item.oldSell,
                                changed_by: user?.name || 'Purchase Studio',
                                reason: `Purchase ${invoiceNo} - WAC Cost auto-update`,
                            });
                        } catch {
                            // ignore price history errors
                        }
                    }
                }
            }

            setSavedInvoice(invoiceNo);
            setShowSuccess(true);
            setItems([]);
            setSelectedSupplier('');
            setSupplierInvoiceNo('');
            setNotes('');
            await generateInvoiceNo();
        } catch (err: any) {
            toast.error(`Order failed: ${err.message || 'Unknown error'}`);
        }
        setIsSaving(false);
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-3">
                <div className="relative">
                    <div className="w-14 h-14 rounded-2xl border-4 border-slate-200 border-t-amber-500 animate-spin" />
                    <FiShoppingBag className="absolute inset-0 m-auto text-amber-500" size={20} />
                </div>
                <div className="text-center">
                    <p className="text-sm font-extrabold text-slate-800 tracking-tight">Initializing Purchase Studio</p>
                    <p className="text-xs text-slate-400 font-medium">Syncing supplier ledger and catalog...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="-mt-2 sm:-mt-3.5 pt-0 space-y-2.5 pb-10" style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
            <Toaster position="top-right" toastOptions={{ style: { background: '#0f172a', color: '#fff', fontSize: '12px', fontWeight: 'bold', borderRadius: '12px' } }} />

            {/* ══════════════════════════════════════════════════════════════════════════
               1. EXECUTIVE COMMAND HEADER
               ══════════════════════════════════════════════════════════════════════════ */}
            <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200/90 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500 via-orange-500 to-amber-600 flex items-center justify-center shadow-md shadow-amber-500/20 text-white font-black">
                            <FiShoppingBag size={22} />
                        </div>
                        <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white ring-1 ring-emerald-500/30 animate-pulse" />
                    </div>
                    <div>
                        <div className="flex flex-wrap items-center gap-2">
                            <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                                Purchase Order Entry Studio
                            </h1>
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-amber-50 text-amber-700 border border-amber-200/80">
                                <FiHash size={11} className="text-amber-500" />
                                {invoiceNo}
                            </span>
                            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                🏪 {activeOutlet?.outlet_name || 'Main Warehouse'}
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                            <span>Dual-stock ledger intake (Bags & Pieces)</span>
                            <span className="text-slate-300">•</span>
                            <span className="text-emerald-600 font-bold">Weighted Average Cost (WAC) Auto-sync</span>
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 self-end md:self-center">
                    <button
                        onClick={() => {
                            setItems([]);
                            setSelectedProduct(null);
                            setProductSearch('');
                            toast.success('Studio workspace cleared');
                        }}
                        className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs hover:border-slate-300"
                        title="Reset all lines"
                    >
                        <FiRefreshCw size={13} className="text-slate-400" />
                        <span>Clear Form</span>
                    </button>

                    <Link
                        href="/dashboard/purchases"
                        className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm hover:shadow"
                    >
                        <FiFileText size={13} className="text-amber-400" />
                        <span>View Purchase History</span>
                        <FiArrowRight size={13} className="text-slate-400" />
                    </Link>
                </div>
            </div>

            {/* ══════════════════════════════════════════════════════════════════════════
               2. EXECUTIVE FINANCIAL HUD METRICS (6 COMPACT CARDS)
               ══════════════════════════════════════════════════════════════════════════ */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {/* 1. Staged Lines */}
                <div className="bg-white rounded-2xl p-2.5 sm:p-3 border border-slate-200/90 shadow-2xs hover:shadow-xs transition-shadow">
                    <div className="flex items-center justify-between text-slate-400 mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Cart Lines</span>
                        <div className="w-5 h-5 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                            <FiPackage size={11} />
                        </div>
                    </div>
                    <div className="text-lg font-black text-slate-900 font-mono">{items.length}</div>
                    <div className="text-[10px] text-slate-400 font-medium">Distinct line items</div>
                </div>

                {/* 2. Order Gross Total */}
                <div className="bg-white rounded-2xl p-2.5 sm:p-3 border border-emerald-200/90 bg-gradient-to-br from-emerald-50/40 via-white to-white shadow-2xs">
                    <div className="flex items-center justify-between text-slate-400 mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Gross Total</span>
                        <div className="w-5 h-5 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700">
                            <FiDollarSign size={11} />
                        </div>
                    </div>
                    <div className="text-lg font-black text-emerald-600 font-mono">{fmtK(total)}</div>
                    <div className="text-[10px] text-emerald-600 font-bold truncate">{fmtKES(total)}</div>
                </div>

                {/* 3. Bulk Boxes/Bags */}
                <div className="bg-white rounded-2xl p-2.5 sm:p-3 border border-amber-200/90 bg-gradient-to-br from-amber-50/30 via-white to-white shadow-2xs">
                    <div className="flex items-center justify-between text-slate-400 mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Bags / Boxes</span>
                        <div className="w-5 h-5 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700">
                            <FiBox size={11} />
                        </div>
                    </div>
                    <div className="text-lg font-black text-amber-700 font-mono">{totalBags}</div>
                    <div className="text-[10px] text-amber-600 font-medium">Wholesale containers</div>
                </div>

                {/* 4. Loose Pieces */}
                <div className="bg-white rounded-2xl p-2.5 sm:p-3 border border-sky-200/90 bg-gradient-to-br from-sky-50/30 via-white to-white shadow-2xs">
                    <div className="flex items-center justify-between text-slate-400 mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-sky-700">Loose Pieces</span>
                        <div className="w-5 h-5 rounded-lg bg-sky-100 flex items-center justify-center text-sky-700">
                            <FiLayers size={11} />
                        </div>
                    </div>
                    <div className="text-lg font-black text-sky-700 font-mono">{totalPieces}</div>
                    <div className="text-[10px] text-sky-600 font-medium">Individual retail pieces</div>
                </div>

                {/* 5. Assigned Supplier */}
                <div className="bg-white rounded-2xl p-2.5 sm:p-3 border border-slate-200/90 shadow-2xs">
                    <div className="flex items-center justify-between text-slate-400 mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Supplier</span>
                        <div className="w-5 h-5 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600">
                            <FiTruck size={11} />
                        </div>
                    </div>
                    <div className="text-xs font-black text-slate-800 truncate">
                        {currentSupplierObj?.supplier_name || 'Not Selected'}
                    </div>
                    <div className="text-[10px] text-purple-600 font-bold truncate">
                        {currentSupplierObj?.supplier_code || 'Select vendor below'}
                    </div>
                </div>

                {/* 6. Terms */}
                <div className="bg-white rounded-2xl p-2.5 sm:p-3 border border-slate-200/90 shadow-2xs">
                    <div className="flex items-center justify-between text-slate-400 mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Terms</span>
                        <div className="w-5 h-5 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
                            <FiShield size={11} />
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={`w-2 h-2 rounded-full ${paymentStatus === 'Paid' ? 'bg-emerald-500' : paymentStatus === 'Partial' ? 'bg-amber-500' : 'bg-rose-500'}`} />
                        <span className="text-xs font-extrabold text-slate-800">{paymentStatus}</span>
                    </div>
                    <div className="text-[10px] text-slate-400 font-medium">{purchaseDate}</div>
                </div>
            </div>

            {/* ══════════════════════════════════════════════════════════════════════════
               3. TWO-COLUMN STUDIO WORKSPACE
               ══════════════════════════════════════════════════════════════════════════ */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5">
                
                {/* ─────────────────────────────────────────────────────────────────
                   LEFT WORKSPACE (Cols 1-8): Supplier Cockpit + Product Intake + Datagrid
                   ───────────────────────────────────────────────────────────────── */}
                <div className="lg:col-span-8 space-y-2.5">

                    {/* Cockpit: Supplier & Invoice Parameters */}
                    <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200/90 shadow-xs">
                        <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-slate-100">
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                                    <FiTruck size={13} />
                                </div>
                                <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                                    Supplier & Invoice Parameters
                                </span>
                            </div>
                            <span className="text-[11px] font-medium text-slate-400">Step 1 of 2</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                            {/* Supplier Selector */}
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">
                                    Supplier <span className="text-rose-500">*</span>
                                </label>
                                <div className="relative">
                                    <select
                                        value={selectedSupplier}
                                        onChange={e => setSelectedSupplier(e.target.value)}
                                        className="w-full pl-3 pr-8 py-2 bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:border-amber-500 outline-none transition-all cursor-pointer appearance-none"
                                    >
                                        <option value="">Select Registered Supplier</option>
                                        {suppliers.map(s => (
                                            <option key={s.supplier_code} value={s.supplier_code}>
                                                {s.supplier_code} — {s.supplier_name}
                                            </option>
                                        ))}
                                    </select>
                                    <FiChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={13} />
                                </div>
                                {suppliers.length === 0 && (
                                    <p className="text-[10px] text-amber-600 mt-1 flex items-center gap-1 font-semibold">
                                        <FiAlertTriangle size={10} />
                                        <Link href="/dashboard/suppliers" className="text-blue-600 underline">Add Supplier</Link>
                                    </p>
                                )}
                            </div>

                            {/* Supplier Invoice Ref */}
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">
                                    Supplier Inv Ref #
                                </label>
                                <input
                                    type="text"
                                    value={supplierInvoiceNo}
                                    onChange={e => setSupplierInvoiceNo(e.target.value)}
                                    placeholder="e.g. SUP-90214"
                                    className="w-full px-3 py-2 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:border-amber-500 outline-none transition-all font-mono"
                                />
                            </div>

                            {/* Purchase Date */}
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">
                                    Invoice Date
                                </label>
                                <div className="relative">
                                    <input
                                        type="date"
                                        value={purchaseDate}
                                        onChange={e => setPurchaseDate(e.target.value)}
                                        className="w-full pl-8 pr-3 py-2 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:border-amber-500 outline-none transition-all cursor-pointer"
                                    />
                                    <FiCalendar className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={13} />
                                </div>
                            </div>

                            {/* Payment Status */}
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">
                                    Payment Terms
                                </label>
                                <div className="grid grid-cols-3 gap-1 bg-slate-100 p-0.5 rounded-xl border border-slate-200">
                                    {(['Paid', 'Unpaid', 'Partial'] as const).map(st => (
                                        <button
                                            key={st}
                                            type="button"
                                            onClick={() => setPaymentStatus(st)}
                                            className={`py-1.5 text-[10px] font-black rounded-lg transition-all ${
                                                paymentStatus === st
                                                    ? st === 'Paid'
                                                        ? 'bg-emerald-600 text-white shadow-xs'
                                                        : st === 'Unpaid'
                                                        ? 'bg-rose-600 text-white shadow-xs'
                                                        : 'bg-amber-600 text-white shadow-xs'
                                                    : 'text-slate-600 hover:text-slate-900'
                                            }`}
                                        >
                                            {st}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Cockpit: Product Intake & Dual-Stock Matrix */}
                    <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200/90 shadow-xs relative">
                        <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-slate-100">
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                                    <FiPackage size={13} />
                                </div>
                                <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                                    Product Intake & Stock Allocation
                                </span>
                            </div>
                            <span className="text-[11px] font-semibold text-slate-400">Step 2 of 2</span>
                        </div>

                        {/* Instant Search Bar */}
                        <div className="relative mb-3">
                            <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 z-10" size={15} />
                            <input
                                ref={searchInputRef}
                                type="text"
                                value={productSearch}
                                onChange={e => {
                                    setProductSearch(e.target.value);
                                    setShowProductDropdown(e.target.value.trim().length > 0);
                                    if (!e.target.value.trim()) setSelectedProduct(null);
                                }}
                                onFocus={() => {
                                    if (productSearch.trim().length > 0) setShowProductDropdown(true);
                                }}
                                placeholder="Type product name, SKU code or scan barcode (e.g. Sugar, OMO, 0012)..."
                                className="w-full pl-10 pr-24 py-2.5 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10 outline-none transition-all shadow-2xs"
                            />

                            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                                {isSearching && (
                                    <div className="w-3.5 h-3.5 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
                                )}
                                {productSearch && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setProductSearch('');
                                            setShowProductDropdown(false);
                                            setSelectedProduct(null);
                                        }}
                                        className="p-1 text-slate-400 hover:text-slate-600 rounded-md"
                                    >
                                        <FiX size={13} />
                                    </button>
                                )}
                                <span className="hidden sm:inline-block text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-200/70 text-slate-500">
                                    FAST-SEARCH
                                </span>
                            </div>

                            {/* Dropdown Results */}
                            {showProductDropdown && products.length > 0 && (
                                <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl max-h-64 overflow-y-auto divide-y divide-slate-100">
                                    {products.map(p => (
                                        <button
                                            key={p.pid}
                                            type="button"
                                            onClick={() => selectProduct(p)}
                                            className="w-full text-left px-3.5 py-2 hover:bg-amber-50/60 transition-colors flex items-center justify-between group"
                                        >
                                            <div className="flex items-center gap-2.5">
                                                <div className="w-7 h-7 rounded-lg bg-slate-100 group-hover:bg-amber-100 text-slate-700 group-hover:text-amber-800 flex items-center justify-center font-mono text-[10px] font-bold">
                                                    {p.product_code?.slice(-3) || 'SKU'}
                                                </div>
                                                <div>
                                                    <p className="text-xs font-black text-slate-900 group-hover:text-amber-900">{p.product_name}</p>
                                                    <p className="text-[10px] text-slate-400">
                                                        <span className="font-mono text-indigo-500">{p.product_code}</span>
                                                        {p.category && ` • ${p.category}`}
                                                        {p.pieces_per_package > 1 && ` • ${p.pieces_per_package} pcs/pkg`}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-xs font-mono font-black text-emerald-600">
                                                    {fmtKES(p.purchase_cost || 0)}
                                                </div>
                                                <div className="text-[10px] text-slate-400 font-medium">
                                                    Buy: {p.purchase_unit || 'Piece'}
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {showProductDropdown && productSearch.trim().length > 0 && products.length === 0 && !isSearching && (
                                <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl p-4 text-center">
                                    <p className="text-xs font-bold text-slate-700">No matching retail products found</p>
                                    <p className="text-[11px] text-slate-400 mt-0.5">Try searching with a barcode or general keyword</p>
                                </div>
                            )}
                        </div>

                        {/* Selected Product Matrix Panel */}
                        {selectedProduct ? (
                            <div className="bg-gradient-to-br from-slate-50 to-indigo-50/30 border border-indigo-200/70 rounded-2xl p-3 sm:p-3.5 space-y-3 shadow-inner-xs">
                                {/* Header Strip of Selected Product */}
                                <div className="flex items-center justify-between bg-white rounded-xl p-2.5 border border-indigo-100 shadow-2xs">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center font-black text-xs shadow-xs">
                                            <FiTag size={14} />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="text-xs font-black text-slate-900">{selectedProduct.product_name}</h3>
                                                <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded text-[10px] font-mono font-bold">
                                                    {selectedProduct.product_code}
                                                </span>
                                            </div>
                                            <p className="text-[10px] text-slate-500 mt-0.5">
                                                Default Unit: <span className="font-bold text-slate-700">{selectedProduct.purchase_unit || 'Piece'}</span>
                                                {' '}• Retail Unit: <span className="font-bold text-slate-700">{selectedProduct.sales_unit || 'Piece'}</span>
                                                {selectedProduct.pieces_per_package > 1 && (
                                                    <span className="text-amber-700 font-bold ml-1.5 bg-amber-50 px-1 rounded">
                                                        ({selectedProduct.pieces_per_package} pcs per {selectedProduct.purchase_unit})
                                                    </span>
                                                )}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Current Stock Indicators */}
                                    <div className="flex items-center gap-2">
                                        <div className="text-right">
                                            <div className="text-[9px] uppercase font-bold text-slate-400">Current Stock</div>
                                            <div className="flex items-center gap-1 justify-end">
                                                {currentBagQty > 0 && (
                                                    <span className="text-[10px] font-black text-amber-700 bg-amber-100/70 px-1.5 py-0.5 rounded">
                                                        📦 {currentBagQty} {selectedProduct.purchase_unit || 'Boxes'}
                                                    </span>
                                                )}
                                                <span className="text-[10px] font-black text-sky-700 bg-sky-100/70 px-1.5 py-0.5 rounded">
                                                    🔢 {currentPieceQty} Pcs
                                                </span>
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSelectedProduct(null);
                                                setProductSearch('');
                                            }}
                                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors"
                                            title="Unselect product"
                                        >
                                            <FiX size={15} />
                                        </button>
                                    </div>
                                </div>

                                {/* Matrix Row 1: Unit, Cost Rate, Total Display */}
                                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                                    {/* Unit Picker */}
                                    <div className="sm:col-span-4">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">
                                            Inflow Unit (Buying In)
                                        </label>
                                        <select
                                            value={purchaseUnit}
                                            onChange={e => {
                                                const unit = e.target.value;
                                                setPurchaseUnit(unit);
                                                if (selectedProduct) {
                                                    const basePrice = selectedProduct.purchase_cost;
                                                    const basePU = selectedProduct.purchase_unit || 'Piece';
                                                    if (unit === basePU) {
                                                        setPrice(basePrice);
                                                    } else {
                                                        const conv = UNIT_CONVERSIONS[basePU];
                                                        if (conv && conv[unit]) {
                                                            setPrice(Math.round(basePrice / conv[unit] * 100) / 100);
                                                        }
                                                    }
                                                }
                                            }}
                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:border-amber-500 outline-none cursor-pointer"
                                        >
                                            {getAvailableUnits(selectedProduct).map(u => (
                                                <option key={u} value={u}>{u}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Purchase Rate */}
                                    <div className="sm:col-span-4">
                                        <div className="flex items-center justify-between mb-1">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                                Unit Rate (Ksh)
                                            </label>
                                            <span className="text-[9px] font-bold text-slate-400">
                                                Catalog: {fmtKES(selectedProduct.purchase_cost)}
                                            </span>
                                        </div>
                                        <input
                                            type="number"
                                            value={price || ''}
                                            onChange={e => handlePriceChange(Number(e.target.value))}
                                            min={0}
                                            step={0.01}
                                            placeholder="0.00"
                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-900 focus:border-amber-500 outline-none font-mono"
                                        />
                                    </div>

                                    {/* Calculated Line Value */}
                                    <div className="sm:col-span-4">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">
                                            Calculated Line Value
                                        </label>
                                        <div className="w-full px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-black text-emerald-700 font-mono flex items-center justify-between">
                                            <span>Payable:</span>
                                            <span>
                                                {(() => {
                                                    const useDual = itemBagQty > 0 || itemPieceQty > 0;
                                                    const ppp = selectedProduct.pieces_per_package || 1;
                                                    if (useDual) {
                                                        const bagTotal = itemBagQty * price;
                                                        const pcTotal = itemPieceQty * (price / ppp);
                                                        return fmtKES(bagTotal + pcTotal);
                                                    }
                                                    return fmtKES(qty * price);
                                                })()}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Matrix Row 2: Dual Stock Quantities (Bags & Pieces) */}
                                <div className="bg-white border border-slate-200 rounded-xl p-3">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                                            <FiLayers className="text-amber-500" size={13} />
                                            Dual-Stock Intake Allocation
                                        </span>
                                        <span className="text-[10px] text-slate-400 font-medium">
                                            Specify full boxes/bags and/or loose pieces
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                                        {/* Full Bags / Boxes */}
                                        <div className="sm:col-span-4">
                                            <label className="text-[10px] font-bold text-amber-700 uppercase mb-1 block">
                                                📦 Full {selectedProduct.purchase_unit || 'Box'} Qty
                                            </label>
                                            <input
                                                type="number"
                                                value={itemBagQty || ''}
                                                onChange={e => setItemBagQty(Math.max(0, parseInt(e.target.value, 10) || 0))}
                                                min={0}
                                                step={1}
                                                placeholder="e.g. 5"
                                                className="w-full px-3 py-2 bg-amber-50/50 border border-amber-200 focus:border-amber-500 rounded-xl text-xs font-black text-amber-900 outline-none text-center font-mono"
                                            />
                                        </div>

                                        {/* Loose Pieces */}
                                        <div className="sm:col-span-4">
                                            <label className="text-[10px] font-bold text-sky-700 uppercase mb-1 block">
                                                🔢 Loose Pieces Qty
                                            </label>
                                            <input
                                                type="number"
                                                value={itemPieceQty || ''}
                                                onChange={e => setItemPieceQty(Math.max(0, parseInt(e.target.value, 10) || 0))}
                                                min={0}
                                                step={1}
                                                placeholder="e.g. 10"
                                                className="w-full px-3 py-2 bg-sky-50/50 border border-sky-200 focus:border-sky-500 rounded-xl text-xs font-black text-sky-900 outline-none text-center font-mono"
                                            />
                                        </div>

                                        {/* Action Button: Add Item */}
                                        <div className="sm:col-span-4">
                                            <button
                                                type="button"
                                                onClick={addItem}
                                                className="w-full py-2 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-700 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-sm hover:shadow active:scale-98"
                                            >
                                                <FiPlus size={15} />
                                                <span>Add To Order</span>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Conversion Math Preview */}
                                    {selectedProduct.pieces_per_package > 1 && (itemBagQty > 0 || itemPieceQty > 0) && (
                                        <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
                                            <span>
                                                Packaging breakdown: {itemBagQty > 0 ? `${itemBagQty} × ${selectedProduct.pieces_per_package} pcs` : '0 pcs'}
                                                {itemPieceQty > 0 ? ` + ${itemPieceQty} loose pcs` : ''}
                                            </span>
                                            <span className="font-black text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                                                Total {(itemBagQty * selectedProduct.pieces_per_package) + itemPieceQty} {selectedProduct.sales_unit || 'Piece(s)'}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {/* Matrix Row 3: Expiry & Batch Tracking (Conditional) */}
                                {expiryEnabled && (
                                    <div className="bg-white border border-slate-200 rounded-xl p-3">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                                                <FiClock className="text-amber-500" size={13} />
                                                Batch & Expiry Date Protocol
                                            </span>
                                            <span className="text-[10px] text-emerald-600 font-bold">Enabled for this outlet</span>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Batch Number</label>
                                                <input
                                                    type="text"
                                                    value={itemBatchNumber}
                                                    onChange={e => setItemBatchNumber(e.target.value)}
                                                    placeholder="Auto-generated if blank (e.g. B-092)"
                                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 font-mono outline-none focus:border-amber-500"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Expiry Date</label>
                                                <input
                                                    type="date"
                                                    value={itemExpiryDate}
                                                    onChange={e => setItemExpiryDate(e.target.value)}
                                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-amber-500 cursor-pointer"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="border border-dashed border-slate-200 rounded-2xl p-6 text-center bg-slate-50/50">
                                <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400 mb-2">
                                    <FiSearch size={18} />
                                </div>
                                <p className="text-xs font-bold text-slate-700">No product staged yet</p>
                                <p className="text-[11px] text-slate-400 mt-0.5">
                                    Search above to select a product and assign dual-stock inventory quantities.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* ══════════════════════════════════════════════════════════════════
                       DATAGRID: STAGED PURCHASE LINE ITEMS
                       ══════════════════════════════════════════════════════════════════ */}
                    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
                        {/* Table Header Bar */}
                        <div className="px-3.5 py-2.5 bg-slate-900 text-white flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-amber-400" />
                                <h2 className="text-xs font-black uppercase tracking-wider text-slate-100">
                                    Purchase Order Schedule
                                </h2>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-800 text-amber-300 border border-slate-700">
                                    {items.length} {items.length === 1 ? 'Line Item' : 'Line Items'}
                                </span>
                            </div>

                            {items.length > 0 && (
                                <button
                                    onClick={() => setItems([])}
                                    className="text-xs text-rose-300 hover:text-rose-100 font-bold flex items-center gap-1 transition-colors"
                                >
                                    <FiTrash2 size={12} />
                                    <span>Clear Cart</span>
                                </button>
                            )}
                        </div>

                        {/* Table or Empty State */}
                        {items.length === 0 ? (
                            <div className="p-8 text-center text-slate-400">
                                <FiBox size={36} className="mx-auto mb-2 text-slate-300" />
                                <p className="text-xs font-extrabold text-slate-700">No items staged in this purchase order</p>
                                <p className="text-[11px] text-slate-400 mt-0.5">
                                    Search and add products above to build your order schedule.
                                </p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-100/80 border-b border-slate-200 text-[10px] font-black text-slate-600 uppercase tracking-wider">
                                            <th className="py-2.5 px-3 w-8 text-center">#</th>
                                            <th className="py-2.5 px-3">Product Particulars</th>
                                            <th className="py-2.5 px-3 text-center">Bags/Boxes</th>
                                            <th className="py-2.5 px-3 text-center">Loose Pcs</th>
                                            <th className="py-2.5 px-3 text-right">Unit Rate</th>
                                            <th className="py-2.5 px-3 text-right">Line Total</th>
                                            {expiryEnabled && <th className="py-2.5 px-3 text-center">Batch / Expiry</th>}
                                            <th className="py-2.5 px-3 text-center w-10">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                                        {items.map((item, idx) => (
                                            <tr key={item.id} className="hover:bg-amber-50/30 transition-colors">
                                                <td className="py-2 px-3 text-center text-[11px] font-bold text-slate-400 font-mono">
                                                    {idx + 1}
                                                </td>

                                                <td className="py-2 px-3">
                                                    <div className="font-extrabold text-slate-900">{item.productName}</div>
                                                    <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1.5">
                                                        <span className="text-indigo-600 font-bold">{item.productCode}</span>
                                                        <span>•</span>
                                                        <span>Unit: {item.purchaseUnit}</span>
                                                    </div>
                                                </td>

                                                <td className="py-2 px-3 text-center">
                                                    {item.bagQty > 0 ? (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-black bg-amber-50 text-amber-800 border border-amber-200/80 font-mono">
                                                            📦 {item.bagQty}
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-300 font-mono">—</span>
                                                    )}
                                                </td>

                                                <td className="py-2 px-3 text-center">
                                                    {item.pieceQty > 0 ? (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-black bg-sky-50 text-sky-800 border border-sky-200/80 font-mono">
                                                            🔢 {item.pieceQty}
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-300 font-mono">—</span>
                                                    )}
                                                </td>

                                                <td className="py-2 px-3 text-right font-mono font-bold text-slate-800">
                                                    {fmtKES(item.price)}
                                                </td>

                                                <td className="py-2 px-3 text-right font-mono font-black text-emerald-600">
                                                    {fmtKES(item.total)}
                                                </td>

                                                {expiryEnabled && (
                                                    <td className="py-2 px-3 text-center">
                                                        {item.expiryDate ? (
                                                            <div className="text-[10px]">
                                                                <span className="font-mono font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                                                    {item.batchNumber || 'AUTO'}
                                                                </span>
                                                                <div className="text-[9px] text-slate-400 mt-0.5">
                                                                    {new Date(item.expiryDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <span className="text-slate-300 text-[10px]">—</span>
                                                        )}
                                                    </td>
                                                )}

                                                <td className="py-2 px-3 text-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => removeItem(item.id)}
                                                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                                        title="Remove item"
                                                    >
                                                        <FiTrash2 size={13} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    {items.length > 0 && (
                                        <tfoot>
                                            <tr className="bg-slate-50 font-black text-slate-900 border-t border-slate-200 text-xs">
                                                <td colSpan={2} className="py-2.5 px-3 uppercase tracking-wider text-[10px] text-slate-500">
                                                    Cart Schedule Total
                                                </td>
                                                <td className="py-2.5 px-3 text-center font-mono text-amber-700">
                                                    {totalBags > 0 ? `${totalBags} pkgs` : '—'}
                                                </td>
                                                <td className="py-2.5 px-3 text-center font-mono text-sky-700">
                                                    {totalPieces > 0 ? `${totalPieces} pcs` : '—'}
                                                </td>
                                                <td className="py-2.5 px-3 text-right text-[10px] text-slate-400 uppercase">
                                                    Payable:
                                                </td>
                                                <td className="py-2.5 px-3 text-right font-mono text-emerald-600 text-sm">
                                                    {fmtKES(total)}
                                                </td>
                                                {expiryEnabled && <td></td>}
                                                <td></td>
                                            </tr>
                                        </tfoot>
                                    )}
                                </table>
                            </div>
                        )}
                    </div>
                </div>

                {/* ─────────────────────────────────────────────────────────────────
                   RIGHT WORKSPACE (Cols 9-12): Order Settlement Summary (Sticky)
                   ───────────────────────────────────────────────────────────────── */}
                <div className="lg:col-span-4 space-y-2.5">
                    
                    {/* Primary Order Settlement Card */}
                    <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs sticky top-4">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                            <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                                    <FiDollarSign size={15} />
                                </div>
                                <div>
                                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
                                        Order Settlement
                                    </h3>
                                    <p className="text-[10px] text-slate-400 font-medium">Financial breakdown</p>
                                </div>
                            </div>
                            <span className="text-[11px] font-mono font-black text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                                {invoiceNo}
                            </span>
                        </div>

                        {/* Breakdown Numbers */}
                        <div className="py-3.5 space-y-2.5 text-xs">
                            <div className="flex items-center justify-between text-slate-600">
                                <span className="font-medium">Subtotal ({items.length} lines)</span>
                                <span className="font-mono font-bold text-slate-900">{fmtKES(subtotal)}</span>
                            </div>

                            <div className="flex items-center justify-between text-slate-600">
                                <span className="font-medium">Tax / VAT (0%)</span>
                                <span className="font-mono font-semibold text-slate-500">Ksh 0.00</span>
                            </div>

                            <div className="flex items-center justify-between text-slate-600">
                                <span className="font-medium">Invoice Discount</span>
                                <span className="font-mono font-semibold text-slate-500">Ksh 0.00</span>
                            </div>

                            <div className="pt-2 border-t border-slate-100 flex items-baseline justify-between">
                                <span className="text-xs font-black uppercase tracking-wider text-slate-800">Grand Total</span>
                                <div className="text-right">
                                    <div className="text-xl font-black text-emerald-600 font-mono tracking-tight">
                                        {fmtKES(total)}
                                    </div>
                                    <div className="text-[10px] text-emerald-700 font-bold">
                                        Net Payable to Supplier
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Vendor Snapshot Pill */}
                        {currentSupplierObj && (
                            <div className="mb-3 p-2.5 rounded-xl bg-purple-50/70 border border-purple-200/80">
                                <div className="flex items-center justify-between">
                                    <span className="text-[9px] font-black uppercase text-purple-700 tracking-wider">Target Vendor</span>
                                    <span className="text-[10px] font-mono font-bold text-purple-600">{currentSupplierObj.supplier_code}</span>
                                </div>
                                <div className="text-xs font-black text-slate-900 mt-0.5">{currentSupplierObj.supplier_name}</div>
                                {currentSupplierObj.phone && (
                                    <div className="text-[10px] text-slate-500 mt-0.5">{currentSupplierObj.phone}</div>
                                )}
                            </div>
                        )}

                        {/* Optional Notes */}
                        <div className="mb-3.5">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">
                                Internal Notes / Remarks
                            </label>
                            <textarea
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                rows={2}
                                placeholder="Special instructions, delivery note #..."
                                className="w-full px-3 py-2 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:border-amber-500 outline-none resize-none transition-all"
                            />
                        </div>

                        {/* Action Commit Button */}
                        <div className="space-y-2">
                            <button
                                type="button"
                                onClick={savePurchase}
                                disabled={items.length === 0 || isSaving}
                                className="w-full py-3 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded-xl text-xs font-black tracking-wide transition-all flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 hover:shadow-lg disabled:opacity-40 disabled:cursor-not-allowed active:scale-98"
                            >
                                {isSaving ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        <span>Posting to Stock Ledger...</span>
                                    </>
                                ) : (
                                    <>
                                        <FiSave size={16} />
                                        <span>Save & Post Purchase Order</span>
                                    </>
                                )}
                            </button>

                            <button
                                type="button"
                                onClick={() => setItems([])}
                                disabled={items.length === 0 || isSaving}
                                className="w-full py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 disabled:opacity-40"
                            >
                                <FiTrash2 size={13} className="text-slate-400" />
                                <span>Discard Staged Items</span>
                            </button>
                        </div>
                    </div>

                    {/* Operational Protocols & WAC Reference */}
                    <div className="bg-white rounded-2xl p-3.5 border border-slate-200/90 shadow-2xs space-y-2 text-[11px] text-slate-500">
                        <div className="flex items-center gap-1.5 font-black uppercase tracking-wider text-slate-700 text-[10px]">
                            <FiShield size={12} className="text-amber-500" />
                            Inventory Protocol Verification
                        </div>
                        <ul className="space-y-1 text-slate-600">
                            <li className="flex items-start gap-1.5">
                                <FiCheck size={12} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                                <span>Dual stock ledger tracks wholesale boxes & retail pieces separately.</span>
                            </li>
                            <li className="flex items-start gap-1.5">
                                <FiCheck size={12} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                                <span>Catalog cost automatically updates with Weighted Average Cost (WAC).</span>
                            </li>
                            <li className="flex items-start gap-1.5">
                                <FiCheck size={12} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                                <span>Historical audit trail saved to <code className="font-mono text-slate-700 font-bold">retail_price_history</code>.</span>
                            </li>
                        </ul>
                    </div>

                </div>

            </div>

            {/* ══════════════════════════════════════════════════════════════════════════
               4. SUCCESS CONFIRMATION MODAL
               ══════════════════════════════════════════════════════════════════════════ */}
            {showSuccess && (
                <div
                    className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                    onClick={() => setShowSuccess(false)}
                >
                    <div
                        className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 text-center border border-slate-100 animate-in fade-in zoom-in-95 duration-150"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-emerald-500/30 text-white font-black">
                            <FiCheckCircle size={32} />
                        </div>
                        <h2 className="text-lg font-black text-slate-900">Purchase Order Posted!</h2>
                        <p className="text-xs text-slate-500 mt-1">
                            Invoice <span className="font-mono font-black text-indigo-600">{savedInvoice}</span> has been written to the ledger, and stock has been incremented.
                        </p>

                        <div className="flex gap-2 mt-5">
                            <button
                                onClick={() => setShowSuccess(false)}
                                className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-black rounded-xl text-xs shadow-sm hover:shadow"
                            >
                                New Purchase
                            </button>
                            <Link
                                href="/dashboard/purchases"
                                className="flex-1 py-2.5 border border-slate-200 text-slate-700 font-bold rounded-xl text-xs text-center hover:bg-slate-50 transition-colors"
                            >
                                View Records
                            </Link>
                        </div>
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════════════
               5. SYSTEM-WIDE PRICE UPDATE CONFIRMATION MODAL
               ══════════════════════════════════════════════════════════════════════════ */}
            {showPriceConfirm && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100">
                        <div className="bg-gradient-to-r from-amber-500 to-orange-600 px-5 py-3.5 text-white flex items-center gap-2.5">
                            <FiAlertTriangle size={18} />
                            <h2 className="text-sm font-black tracking-wide uppercase">Confirm System Price Adjustments</h2>
                        </div>
                        <div className="p-5 space-y-3.5">
                            <p className="text-xs text-slate-600">
                                The following items have altered cost rates and will affect system-wide inventory valuation:
                            </p>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                                {items
                                    .filter(i => i.updatePrices && (i.newCost !== i.oldCost || i.newSell !== i.oldSell))
                                    .map(i => (
                                        <div key={i.id} className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-xs">
                                            <p className="font-extrabold text-slate-800">{i.productName}</p>
                                            <div className="flex gap-4 mt-1 text-[11px]">
                                                <span className="text-slate-500">
                                                    Cost: <span className="line-through text-rose-400 font-mono">Ksh {i.oldCost}</span>{' '}
                                                    <FiArrowRight className="inline" size={10} />{' '}
                                                    <span className="font-black text-emerald-600 font-mono">Ksh {i.newCost}</span>
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                            </div>
                            <div className="flex gap-2 pt-2 border-t border-slate-100">
                                <button
                                    onClick={() => setShowPriceConfirm(false)}
                                    className="flex-1 py-2.5 border border-slate-200 text-slate-600 font-bold rounded-xl text-xs hover:bg-slate-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={savePurchase}
                                    className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-black rounded-xl text-xs shadow-sm hover:shadow"
                                >
                                    Confirm & Save
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
