'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';
import toast from 'react-hot-toast';
import { FiShoppingBag, FiPackage, FiX, FiPlus, FiTrash2, FiDollarSign, FiTruck, FiCalendar, FiHash, FiSave, FiCheckCircle, FiAlertTriangle, FiTrendingUp, FiSearch, FiRefreshCw, FiEdit3, FiArrowRight } from 'react-icons/fi';

// ─── UNIT CONVERSIONS ───
const UNIT_CONVERSIONS: Record<string, Record<string, number>> = {
    'Box': { 'Piece': 1, 'Box': 1 }, 'Pack': { 'Piece': 1, 'Pack': 1 },
    'Dozen': { 'Piece': 12, 'Dozen': 1 }, 'Kilogram': { 'Gram': 1000, 'Kilogram': 1 },
    'Bag': { 'Kilogram': 1, 'Gram': 1000, 'Bag': 1 }, 'Liter': { 'Milliliter': 1000, 'Liter': 1 },
};
const ALL_UNITS = ['Piece', 'Box', 'Pack', 'Dozen', 'Kilogram', 'Gram', 'Bag', 'Liter', 'Milliliter', 'Carton', 'Bundle', 'Roll', 'Bottle', 'Sachet', 'Tablet', 'Strip'];

interface Supplier {
    supplier_id: number; supplier_code: string; supplier_name: string;
    phone: string; contact_person: string;
}
interface Product {
    pid: number; product_code: string; product_name: string;
    purchase_unit: string; sales_unit: string; purchase_cost: number;
    sales_cost: number; category: string; pieces_per_package: number;
    barcode: string;
}
interface PurchaseItem {
    id: number; productId: number; productCode: string; productName: string;
    purchaseUnit: string; // the unit user is buying in (could be Kg, Piece, Box etc)
    qty: number; price: number; total: number;
    // Bags & Pieces (dual stock)
    bagQty: number; pieceQty: number;
    // Expiry batch tracking
    batchNumber: string; expiryDate: string;
    // Price change tracking
    oldCost: number; oldSell: number; newCost: number; newSell: number;
    updatePrices: boolean; // whether to update product prices in DB after saving
    piecesPerPackage: number; // conversion factor
}

export default function PurchaseEntryPage() {
    const { activeOutlet, expiryEnabled } = useOutlet();
    const outletId = activeOutlet?.outlet_id || 1;
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [productSearch, setProductSearch] = useState('');
    const [showProductDropdown, setShowProductDropdown] = useState(false);

    // Form
    const [invoiceNo, setInvoiceNo] = useState('');
    const [selectedSupplier, setSelectedSupplier] = useState<number>(0);
    const [supplierInvoiceNo, setSupplierInvoiceNo] = useState('');
    const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
    const [items, setItems] = useState<PurchaseItem[]>([]);
    const [paymentStatus, setPaymentStatus] = useState('Paid');
    const [notes, setNotes] = useState('');

    // Add item form
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [qty, setQty] = useState<number>(1);
    const [price, setPrice] = useState<number>(0);
    const [purchaseUnit, setPurchaseUnit] = useState<string>('');
    const [availableQty, setAvailableQty] = useState<number>(0);
    // Bags & Pieces qty
    const [itemBagQty, setItemBagQty] = useState<number>(0);
    const [itemPieceQty, setItemPieceQty] = useState<number>(0);
    // Expiry batch fields
    const [itemBatchNumber, setItemBatchNumber] = useState('');
    const [itemExpiryDate, setItemExpiryDate] = useState('');
    // Price change fields
    const [newSellPrice, setNewSellPrice] = useState<number>(0);
    const [shouldUpdatePrices, setShouldUpdatePrices] = useState(false);
    const [priceChanged, setPriceChanged] = useState(false);

    // Success state
    const [showSuccess, setShowSuccess] = useState(false);
    const [savedInvoice, setSavedInvoice] = useState('');

    // Price change confirmation modal
    const [showPriceConfirm, setShowPriceConfirm] = useState(false);

    useEffect(() => {
        const loadData = async () => {
            if (!activeOutlet) return; // Wait for outlet context
            setIsLoading(true);
            try {
                // Products: try with outlet_id, fallback without
                let prodData: any[] | null = null;
                const r1 = await supabase.from('retail_products').select('pid, product_code, product_name, purchase_unit, sales_unit, purchase_cost, sales_cost, category, pieces_per_package, barcode').eq('active', true).eq('outlet_id', outletId).order('product_name');
                if (r1.error) {
                    const r2 = await supabase.from('retail_products').select('pid, product_code, product_name, purchase_unit, sales_unit, purchase_cost, sales_cost, category, pieces_per_package, barcode').eq('active', true).order('product_name');
                    prodData = r2.data;
                } else {
                    prodData = r1.data;
                }

                const [{ data: suppData }] = await Promise.all([
                    supabase.from('retail_suppliers').select('supplier_id, supplier_code, supplier_name, phone, contact_person').eq('active', true).order('supplier_name'),
                ]);
                setSuppliers(suppData || []); setProducts(prodData || []);
                await generateInvoiceNo();
            } catch { toast.error('Failed to load data'); }
            setIsLoading(false);
        };
        loadData();
    }, [activeOutlet, outletId]);

    const generateInvoiceNo = async () => {
        try {
            // Query ALL purchases globally (not per-outlet) since purchase_no has a global unique constraint
            const { data } = await supabase.from('retail_purchases').select('purchase_no').order('purchase_id', { ascending: false }).limit(1);
            let n = 1;
            if (data?.[0]) { const m = data[0].purchase_no.match(/INV-(\d+)/); if (m) n = parseInt(m[1]) + 1; }
            setInvoiceNo(`INV-${String(n).padStart(4, '0')}`);
        } catch { setInvoiceNo(`INV-${Date.now().toString(36).toUpperCase()}`); }
    };

    // ─── PRODUCT SELECTION ───
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
        // Load stock for this outlet
        const { data: stockData } = await supabase.from('retail_stock').select('qty').eq('pid', product.pid).eq('outlet_id', outletId);
        setAvailableQty(stockData?.reduce((s, r) => s + (r.qty || 0), 0) || 0);
    };

    // Detect price change
    const handlePriceChange = (newCost: number) => {
        setPrice(newCost);
        if (selectedProduct && newCost !== selectedProduct.purchase_cost) {
            setPriceChanged(true);
            // Auto-suggest new sell price maintaining the same margin
            if (selectedProduct.purchase_cost > 0) {
                const marginRatio = selectedProduct.sales_cost / selectedProduct.purchase_cost;
                setNewSellPrice(Math.round(newCost * marginRatio));
            }
        } else {
            setPriceChanged(false);
        }
    };

    // Get actual quantity in base units for stock
    const getStockQty = (qty: number, unit: string, product: Product): number => {
        const prodPurchaseUnit = product.purchase_unit || 'Piece';
        if (unit === prodPurchaseUnit) return qty;

        // Converting from smaller to base
        // e.g., purchasing 2 Kgs of something that's normally bought in Bags (50kg bags)
        const conv = UNIT_CONVERSIONS[prodPurchaseUnit];
        if (conv && conv[unit]) {
            // unit is a sub-unit of purchase_unit, so: qty / conversion
            return qty / conv[unit];
        }
        // Check reverse
        const revConv = UNIT_CONVERSIONS[unit];
        if (revConv && revConv[prodPurchaseUnit]) {
            return qty * revConv[prodPurchaseUnit];
        }
        return qty;
    };

    // Get available units for a product
    const getAvailableUnits = (product: Product): string[] => {
        const units = new Set<string>();
        units.add(product.purchase_unit || 'Piece');
        units.add(product.sales_unit || 'Piece');
        // Add related conversion units
        const conv = UNIT_CONVERSIONS[product.purchase_unit];
        if (conv) Object.keys(conv).forEach(u => units.add(u));
        const conv2 = UNIT_CONVERSIONS[product.sales_unit];
        if (conv2) Object.keys(conv2).forEach(u => units.add(u));
        // Always include these common ones
        ALL_UNITS.forEach(u => units.add(u));
        return Array.from(units);
    };

    // ─── ADD ITEM ───
    const addItem = () => {
        if (!selectedProduct || price <= 0) { toast.error('Select product & enter price'); return; }
        if (itemBagQty <= 0 && itemPieceQty <= 0 && qty <= 0) { toast.error('Enter bags qty or pieces qty'); return; }
        // Use bag+piece if either is set, otherwise fall back to single qty
        const useDualQty = itemBagQty > 0 || itemPieceQty > 0;
        const effectiveQty = useDualQty ? (itemBagQty + itemPieceQty) : qty;
        const lineTotal = useDualQty ? (itemBagQty * price) + (itemPieceQty * (price / (selectedProduct.pieces_per_package || 1))) : qty * price;

        const newItem: PurchaseItem = {
            id: Date.now(),
            productId: selectedProduct.pid,
            productCode: selectedProduct.product_code || '',
            productName: selectedProduct.product_name,
            purchaseUnit: purchaseUnit,
            qty: effectiveQty, price,
            total: Math.round(lineTotal),
            bagQty: itemBagQty,
            pieceQty: itemPieceQty,
            batchNumber: itemBatchNumber || '',
            expiryDate: itemExpiryDate || '',
            oldCost: selectedProduct.purchase_cost,
            oldSell: selectedProduct.sales_cost,
            newCost: price,
            newSell: newSellPrice,
            updatePrices: shouldUpdatePrices,
            piecesPerPackage: selectedProduct.pieces_per_package || 1,
        };
        setItems(prev => [...prev, newItem]);
        toast.success('Item added');
        setSelectedProduct(null); setQty(1); setPrice(0); setPurchaseUnit(''); setProductSearch('');
        setPriceChanged(false); setShouldUpdatePrices(false);
        setItemBagQty(0); setItemPieceQty(0); setItemBatchNumber(''); setItemExpiryDate('');
    };

    // ─── TOGGLE PRICE UPDATE FOR AN ITEM ───
    const toggleItemPriceUpdate = (itemId: number, update: boolean) => {
        setItems(prev => prev.map(i => i.id === itemId ? { ...i, updatePrices: update } : i));
    };

    // ─── EDIT ITEM SELL PRICE ───
    const editItemSellPrice = (itemId: number, newSell: number) => {
        setItems(prev => prev.map(i => i.id === itemId ? { ...i, newSell } : i));
    };

    const subtotal = items.reduce((s, i) => s + i.total, 0);
    const total = subtotal;

    // Products filtered only when search has text
    const filteredProducts = productSearch.trim().length >= 1
        ? products.filter(p => {
            const q = productSearch.toLowerCase();
            return p.product_name.toLowerCase().includes(q) || p.product_code.toLowerCase().includes(q) || (p.barcode && p.barcode.includes(productSearch));
        }).slice(0, 15)
        : [];

    // ─── SAVE PURCHASE ───
    const savePurchase = async () => {
        if (!selectedSupplier) { toast.error('Select a supplier'); return; }
        if (items.length === 0) { toast.error('Add at least one item'); return; }
        // Check for price updates
        const priceUpdateItems = items.filter(i => i.updatePrices && (i.newCost !== i.oldCost || i.newSell !== i.oldSell));
        if (priceUpdateItems.length > 0 && !showPriceConfirm) {
            setShowPriceConfirm(true);
            return;
        }
        setShowPriceConfirm(false);
        setIsSaving(true);
        try {
            const userData = localStorage.getItem('user');
            const user = userData ? JSON.parse(userData) : null;
            const supplier = suppliers.find(s => s.supplier_id === selectedSupplier);
            const { data: purchaseData, error: pErr } = await supabase.from('retail_purchases').insert({
                purchase_no: invoiceNo, purchase_date: purchaseDate,
                supplier_id: selectedSupplier, supplier_name: supplier?.supplier_name || '',
                supplier_invoice: supplierInvoiceNo, sub_total: subtotal, discount: 0, vat: 0, grand_total: total,
                status: 'Completed', payment_status: paymentStatus, created_by: user?.name || 'Unknown',
                outlet_id: outletId
            }).select().single();
            if (pErr) throw pErr;
            const pid = purchaseData.purchase_id;

            // Insert purchase items (try with new columns, fallback to base columns if they don't exist yet)
            const purchaseItemsData = items.map(i => ({
                purchase_id: pid, product_id: i.productId, product_code: i.productCode,
                product_name: i.productName, quantity: i.qty, unit: i.purchaseUnit,
                rate: i.price, total_amount: i.total,
                bag_qty: i.bagQty || 0, piece_qty: i.pieceQty || 0,
                batch_number: i.batchNumber || null, expiry_date: i.expiryDate || null,
            }));
            let { error: iErr } = await supabase.from('retail_purchase_products').insert(purchaseItemsData);
            if (iErr && iErr.message?.includes('column')) {
                // Fallback: insert without new columns if they don't exist in DB yet
                const fallbackData = items.map(i => ({
                    purchase_id: pid, product_id: i.productId, product_code: i.productCode,
                    product_name: i.productName, quantity: i.qty, unit: i.purchaseUnit,
                    rate: i.price, total_amount: i.total,
                }));
                const fb = await supabase.from('retail_purchase_products').insert(fallbackData);
                iErr = fb.error;
            }
            if (iErr) throw iErr;

            // Update stock & prices for each item
            for (const item of items) {
                const hasDualQty = item.bagQty > 0 || item.pieceQty > 0;

                if (hasDualQty) {
                    // ─── DUAL STOCK: Separate Bags + Pieces rows (matching Add Product pattern) ───
                    if (item.bagQty > 0) {
                        const { data: bagRow } = await supabase.from('retail_stock').select('st_id, qty').eq('pid', item.productId).eq('outlet_id', outletId).eq('storage_type', 'Bags').single();
                        if (bagRow) {
                            await supabase.from('retail_stock').update({ qty: (bagRow.qty || 0) + item.bagQty, invoice_no: invoiceNo, updated_at: new Date().toISOString() }).eq('st_id', bagRow.st_id);
                        } else {
                            await supabase.from('retail_stock').insert({ pid: item.productId, invoice_no: invoiceNo, qty: item.bagQty, storage_type: 'Bags', outlet_id: outletId });
                        }
                    }
                    if (item.pieceQty > 0) {
                        const { data: pcRow } = await supabase.from('retail_stock').select('st_id, qty').eq('pid', item.productId).eq('outlet_id', outletId).eq('storage_type', 'Pieces').single();
                        if (pcRow) {
                            await supabase.from('retail_stock').update({ qty: (pcRow.qty || 0) + item.pieceQty, invoice_no: invoiceNo, updated_at: new Date().toISOString() }).eq('st_id', pcRow.st_id);
                        } else {
                            await supabase.from('retail_stock').insert({ pid: item.productId, invoice_no: invoiceNo, qty: item.pieceQty, storage_type: 'Pieces', outlet_id: outletId });
                        }
                    }
                } else {
                    // ─── LEGACY: Single qty stock row ───
                    const product = products.find(p => p.pid === item.productId);
                    const stockQty = product ? getStockQty(item.qty, item.purchaseUnit, product) : item.qty;
                    const { data: sData } = await supabase.from('retail_stock').select('st_id, qty').eq('pid', item.productId).eq('outlet_id', outletId).single();
                    if (sData) {
                        await supabase.from('retail_stock').update({ qty: (sData.qty || 0) + stockQty, invoice_no: invoiceNo, updated_at: new Date().toISOString() }).eq('st_id', sData.st_id);
                    } else {
                        await supabase.from('retail_stock').insert({ pid: item.productId, invoice_no: invoiceNo, qty: stockQty, storage_type: 'Store', outlet_id: outletId });
                    }
                }

                // ─── EXPIRY BATCH INSERT ───
                if (item.expiryDate && expiryEnabled) {
                    try {
                        const batchNum = item.batchNumber || `B-${Date.now().toString(36).toUpperCase()}`;
                        const totalBatchQty = item.bagQty > 0 ? item.bagQty * (item.piecesPerPackage || 1) + (item.pieceQty || 0) : item.pieceQty > 0 ? item.pieceQty : item.qty;
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
                    } catch { /* batch table may not exist */ }
                }

                // Update product prices if flagged
                if (item.updatePrices && (item.newCost !== item.oldCost || item.newSell !== item.oldSell)) {
                    const margin = item.newCost > 0 ? Math.round(((item.newSell - item.newCost) / item.newCost) * 10000) / 100 : 0;
                    await supabase.from('retail_products').update({
                        purchase_cost: item.newCost,
                        sales_cost: item.newSell,
                        margin_per: margin,
                    }).eq('pid', item.productId);

                    // Log price change in history
                    try {
                        await supabase.from('retail_price_history').insert({
                            pid: item.productId,
                            old_purchase_cost: item.oldCost,
                            new_purchase_cost: item.newCost,
                            old_sales_cost: item.oldSell,
                            new_sales_cost: item.newSell,
                            changed_by: user?.name || 'Purchase Entry',
                            reason: `Purchase ${invoiceNo} - Price update`,
                        });
                    } catch { /* price history table may not exist yet */ }
                }
            }

            setSavedInvoice(invoiceNo); setShowSuccess(true);
            setItems([]); setSelectedSupplier(0); setSupplierInvoiceNo(''); setNotes('');
            await generateInvoiceNo();
        } catch (err: any) { toast.error(`Failed: ${err.message || 'Unknown error'}`); }
        setIsSaving(false);
    };

    if (isLoading) return (
        <div className="flex flex-col items-center justify-center h-96">
            <div className="w-14 h-14 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
            <p className="mt-4 text-gray-500 font-medium text-sm">Loading purchase data...</p>
        </div>
    );

    return (
        <div className="space-y-5" style={{ fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>

            {/* ─── SUCCESS DIALOG ─── */}
            {showSuccess && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-md flex items-center justify-center z-50" onClick={() => setShowSuccess(false)}>
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 text-center" onClick={e => e.stopPropagation()}>
                        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center mx-auto mb-4 shadow-xl shadow-emerald-300/40 animate-bounce">
                            <FiCheckCircle className="text-white" size={36} />
                        </div>
                        <p className="text-2xl font-black text-gray-800">Purchase Saved!</p>
                        <p className="text-sm text-gray-500 mt-2">Invoice <span className="font-bold text-indigo-600">{savedInvoice}</span> saved, stock updated.</p>
                        <div className="flex gap-3 mt-6">
                            <button onClick={() => setShowSuccess(false)} className="flex-1 px-4 py-3 bg-gradient-to-r from-emerald-500 to-green-600 text-white font-bold rounded-xl text-sm">New Purchase</button>
                            <a href="/dashboard/purchases" className="flex-1 px-4 py-3 border-2 border-gray-200 text-gray-600 font-bold rounded-xl text-sm text-center">View Records</a>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── PRICE CHANGE CONFIRMATION ─── */}
            {showPriceConfirm && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-md flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md">
                        <div className="bg-gradient-to-r from-amber-500 to-orange-600 px-6 py-4 text-white rounded-t-3xl flex items-center gap-3">
                            <FiAlertTriangle size={20} />
                            <h2 className="text-lg font-bold">Confirm Price Updates</h2>
                        </div>
                        <div className="p-5 space-y-4">
                            <p className="text-sm text-gray-600">The following product prices will be updated <span className="font-bold text-amber-700">system-wide</span> (affects POS, product list, etc.):</p>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                                {items.filter(i => i.updatePrices && (i.newCost !== i.oldCost || i.newSell !== i.oldSell)).map(i => (
                                    <div key={i.id} className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                                        <p className="text-sm font-bold text-gray-800">{i.productName}</p>
                                        <div className="flex gap-4 mt-1 text-xs">
                                            <span className="text-gray-500">Cost: <span className="line-through text-red-400">Ksh {i.oldCost}</span> <FiArrowRight className="inline" size={10} /> <span className="font-bold text-emerald-600">Ksh {i.newCost}</span></span>
                                            <span className="text-gray-500">Sell: <span className="line-through text-red-400">Ksh {i.oldSell}</span> <FiArrowRight className="inline" size={10} /> <span className="font-bold text-emerald-600">Ksh {i.newSell}</span></span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="flex gap-3 pt-3 border-t">
                                <button onClick={() => setShowPriceConfirm(false)} className="flex-1 px-4 py-3 border-2 border-gray-200 text-gray-600 font-bold rounded-xl text-sm">Cancel</button>
                                <button onClick={savePurchase} className="flex-1 px-4 py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold rounded-xl text-sm">Confirm & Save</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ━━━ TOP BAR ━━━ */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-300/40">
                        <FiShoppingBag className="text-white" size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">Purchase Entry</h1>
                        <p className="text-gray-500 text-sm mt-1">Record purchases with unit conversion & price management</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="px-4 py-2.5 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl flex items-center gap-2">
                        <FiHash size={14} className="text-indigo-500" />
                        <span className="text-sm font-bold text-indigo-700">{invoiceNo}</span>
                        <span className="text-[10px] text-indigo-400">(auto)</span>
                    </div>
                    <a href="/dashboard/purchases" className="px-5 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-600 hover:text-indigo-600 hover:border-indigo-300 transition-all text-sm font-semibold flex items-center gap-2 shadow-sm">
                        <FiShoppingBag size={14} /> View Records
                    </a>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-5">
                {/* ━━━ LEFT PANEL ━━━ */}
                <div className="col-span-2 space-y-5">

                    {/* Supplier & Details */}
                    <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                        <h2 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2 uppercase tracking-wider">
                            <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center"><FiTruck className="text-blue-600" size={14} /></div>
                            Supplier & Invoice Details
                        </h2>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                            <div>
                                <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Supplier *</label>
                                <select value={selectedSupplier} onChange={e => setSelectedSupplier(Number(e.target.value))}
                                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:border-indigo-500 outline-none cursor-pointer">
                                    <option value={0}>Select Supplier</option>
                                    {suppliers.map(s => <option key={s.supplier_id} value={s.supplier_id}>{s.supplier_code} - {s.supplier_name}</option>)}
                                </select>
                                {suppliers.length === 0 && <p className="text-[10px] text-amber-600 mt-1 flex items-center gap-1"><FiAlertTriangle size={10} /> <a href="/dashboard/suppliers" className="text-blue-600 underline">Add Supplier</a></p>}
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Supplier Invoice</label>
                                <input type="text" value={supplierInvoiceNo} onChange={e => setSupplierInvoiceNo(e.target.value)} placeholder="Supplier's invoice..."
                                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:border-indigo-500 outline-none" />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Date</label>
                                <input type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)}
                                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:border-indigo-500 outline-none" />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Payment</label>
                                <select value={paymentStatus} onChange={e => setPaymentStatus(e.target.value)}
                                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:border-indigo-500 outline-none cursor-pointer">
                                    <option value="Paid">Paid</option>
                                    <option value="Unpaid">Unpaid / Credit</option>
                                    <option value="Partial">Partial</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* ━━━ ADD PRODUCT SECTION ━━━ */}
                    <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                        <h2 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2 uppercase tracking-wider">
                            <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center"><FiPackage className="text-emerald-600" size={14} /></div>
                            Add Products
                        </h2>

                        {/* Product Search (typing only) */}
                        <div className="relative mb-4">
                            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 z-10" size={16} />
                            <input type="text" value={productSearch}
                                onChange={e => { setProductSearch(e.target.value); setShowProductDropdown(e.target.value.trim().length > 0); setSelectedProduct(null); }}
                                onFocus={() => { if (productSearch.trim().length > 0) setShowProductDropdown(true); }}
                                placeholder="Type to search products by name, code or barcode..."
                                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:border-indigo-500 outline-none" />
                            {/* Dropdown - only when typing */}
                            {showProductDropdown && filteredProducts.length > 0 && (
                                <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                                    {filteredProducts.map(p => (
                                        <button key={p.pid} onClick={() => selectProduct(p)}
                                            className="w-full text-left px-4 py-2.5 hover:bg-indigo-50 transition-colors flex items-center justify-between border-b border-gray-50 last:border-b-0">
                                            <div>
                                                <span className="text-xs text-indigo-500 font-mono">{p.product_code}</span>
                                                <span className="ml-2 text-sm font-semibold text-gray-800">{p.product_name}</span>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-xs text-gray-400">{p.purchase_unit || 'Piece'}</span>
                                                <span className="ml-2 text-xs font-bold text-emerald-600">Ksh {p.purchase_cost?.toLocaleString()}</span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                            {showProductDropdown && productSearch.trim().length > 0 && filteredProducts.length === 0 && (
                                <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg p-4 text-center text-gray-400 text-sm">No products found</div>
                            )}
                        </div>

                        {/* Selected Product Details + Add */}
                        {selectedProduct && (
                            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-bold text-gray-800">{selectedProduct.product_name}</p>
                                        <p className="text-xs text-gray-500">{selectedProduct.product_code} • Buy Unit: {selectedProduct.purchase_unit || 'Piece'} • Sell Unit: {selectedProduct.sales_unit || 'Piece'} {selectedProduct.pieces_per_package > 1 ? `• ${selectedProduct.pieces_per_package} pcs/pkg` : ''}</p>
                                    </div>
                                    <button onClick={() => { setSelectedProduct(null); setProductSearch(''); }} className="p-1.5 text-gray-400 hover:text-red-500"><FiX size={14} /></button>
                                </div>

                                {/* ─── ROW 1: Unit, Cost, Stock ─── */}
                                <div className="grid grid-cols-12 gap-3 items-end">
                                    {/* Purchase Unit */}
                                    <div className="col-span-3">
                                        <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Buy In (Unit)</label>
                                        <select value={purchaseUnit} onChange={e => {
                                            const unit = e.target.value;
                                            setPurchaseUnit(unit);
                                            if (selectedProduct) {
                                                const basePrice = selectedProduct.purchase_cost;
                                                const basePU = selectedProduct.purchase_unit || 'Piece';
                                                if (unit === basePU) { setPrice(basePrice); }
                                                else {
                                                    const conv = UNIT_CONVERSIONS[basePU];
                                                    if (conv && conv[unit]) { setPrice(Math.round(basePrice / conv[unit] * 100) / 100); }
                                                }
                                            }
                                        }}
                                            className="w-full px-2 py-2.5 bg-white border border-gray-200 rounded-xl text-xs focus:border-indigo-500 outline-none font-bold">
                                            {getAvailableUnits(selectedProduct).map(u => <option key={u} value={u}>{u}</option>)}
                                        </select>
                                    </div>

                                    {/* Cost Price */}
                                    <div className="col-span-3">
                                        <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">
                                            Cost/{purchaseUnit || 'Unit'} <span className="text-gray-300">(was {selectedProduct.purchase_cost})</span>
                                        </label>
                                        <input type="number" value={price} onChange={e => handlePriceChange(Number(e.target.value))} min={0} step={0.01}
                                            className={`w-full px-3 py-2.5 border rounded-xl text-sm font-bold outline-none text-center ${priceChanged ? 'bg-amber-50 border-amber-400 text-amber-800' : 'bg-white border-gray-200'}`} />
                                    </div>

                                    {/* Stock Info */}
                                    <div className="col-span-2 text-center">
                                        <p className="text-[9px] text-gray-400 uppercase mb-1">Current Stock</p>
                                        <p className="text-sm font-bold text-blue-600">{availableQty}</p>
                                    </div>

                                    {/* Line Total */}
                                    <div className="col-span-4">
                                        <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Line Total</label>
                                        <div className="w-full px-3 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-sm font-black text-emerald-700 text-center">
                                            Ksh {(() => {
                                                const useDual = itemBagQty > 0 || itemPieceQty > 0;
                                                if (useDual) {
                                                    const bagTotal = itemBagQty * price;
                                                    const pcTotal = itemPieceQty * (price / (selectedProduct.pieces_per_package || 1));
                                                    return Math.round(bagTotal + pcTotal).toLocaleString();
                                                }
                                                return (qty * price).toLocaleString();
                                            })()}
                                        </div>
                                    </div>
                                </div>

                                {/* ─── ROW 2: Bags Qty + Pieces Qty (like Add Product) ─── */}
                                <div className="bg-white border border-blue-200 rounded-xl p-3">
                                    <p className="text-[10px] font-bold text-blue-700 uppercase mb-2 flex items-center gap-1">📦 Purchase Quantities</p>
                                    <div className="grid grid-cols-12 gap-3 items-end">
                                        <div className="col-span-4">
                                            <label className="text-[10px] font-bold text-indigo-500 uppercase mb-1 block">
                                                📦 {selectedProduct.purchase_unit || 'Bags'} Qty
                                            </label>
                                            <input type="number" value={itemBagQty || ''} onChange={e => setItemBagQty(Number(e.target.value))} min={0} step={1}
                                                placeholder="e.g. 5"
                                                className="w-full px-3 py-2.5 bg-indigo-50 border border-indigo-200 rounded-xl text-sm font-bold focus:border-indigo-500 outline-none text-center" />
                                        </div>
                                        <div className="col-span-4">
                                            <label className="text-[10px] font-bold text-emerald-500 uppercase mb-1 block">
                                                🔢 {selectedProduct.sales_unit || 'Pieces'} Qty
                                            </label>
                                            <input type="number" value={itemPieceQty || ''} onChange={e => setItemPieceQty(Number(e.target.value))} min={0} step={1}
                                                placeholder="e.g. 10"
                                                className="w-full px-3 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-sm font-bold focus:border-emerald-500 outline-none text-center" />
                                        </div>
                                        {/* Add Button */}
                                        <div className="col-span-4">
                                            <button onClick={addItem} className="w-full py-2.5 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-xl font-bold hover:shadow-lg transition-all flex items-center justify-center gap-2" title="Add Item">
                                                <FiPlus size={16} /> Add Item
                                            </button>
                                        </div>
                                    </div>
                                    {selectedProduct.pieces_per_package > 1 && (itemBagQty > 0 || itemPieceQty > 0) && (
                                        <p className="text-[10px] text-blue-600 mt-2 bg-blue-50 px-2 py-1 rounded-lg">
                                            📊 Total: {itemBagQty > 0 ? `${itemBagQty} ${selectedProduct.purchase_unit}(s) × ${selectedProduct.pieces_per_package} = ${itemBagQty * selectedProduct.pieces_per_package} pcs` : ''}
                                            {itemBagQty > 0 && itemPieceQty > 0 ? ' + ' : ''}
                                            {itemPieceQty > 0 ? `${itemPieceQty} ${selectedProduct.sales_unit}(s)` : ''}
                                            {' = '}<span className="font-bold">{(itemBagQty * selectedProduct.pieces_per_package) + itemPieceQty} total {selectedProduct.sales_unit}(s)</span>
                                        </p>
                                    )}
                                </div>

                                {/* ─── ROW 3: Batch & Expiry (only if expiry tracking enabled) ─── */}
                                {expiryEnabled && (
                                    <div className="bg-white border border-amber-200 rounded-xl p-3">
                                        <p className="text-[10px] font-bold text-amber-700 uppercase mb-2 flex items-center gap-1">⏰ Batch & Expiry Tracking</p>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Batch Number</label>
                                                <input type="text" value={itemBatchNumber} onChange={e => setItemBatchNumber(e.target.value)}
                                                    placeholder="e.g. B-2024-001 (auto if empty)"
                                                    className="w-full px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-sm focus:border-amber-500 outline-none font-mono" />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Expiry Date *</label>
                                                <input type="date" value={itemExpiryDate} onChange={e => setItemExpiryDate(e.target.value)}
                                                    className="w-full px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-sm focus:border-amber-500 outline-none font-bold" />
                                            </div>
                                        </div>
                                        {itemExpiryDate && (
                                            <p className="text-[10px] text-amber-600 mt-2">
                                                ✅ Batch {itemBatchNumber || '(auto-generated)'} expires on <span className="font-bold">{new Date(itemExpiryDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                                {' • '}{Math.ceil((new Date(itemExpiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days from now
                                            </p>
                                        )}
                                    </div>
                                )}

                                {/* ─── PRICE CHANGE WARNING ─── */}
                                {priceChanged && (
                                    <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-3 mt-2">
                                        <div className="flex items-center gap-2 mb-2">
                                            <FiAlertTriangle className="text-amber-600 flex-shrink-0" size={14} />
                                            <p className="text-xs font-bold text-amber-700">Price differs from current product price!</p>
                                        </div>
                                        <p className="text-[11px] text-gray-600 mb-2">Current: Cost <span className="font-bold">Ksh {selectedProduct.purchase_cost}</span>, Sell <span className="font-bold">Ksh {selectedProduct.sales_cost}</span></p>
                                        <div className="flex items-center gap-3">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input type="checkbox" checked={shouldUpdatePrices} onChange={e => setShouldUpdatePrices(e.target.checked)} className="accent-amber-600" />
                                                <span className="text-xs font-semibold text-amber-800">Update system prices</span>
                                            </label>
                                            {shouldUpdatePrices && (
                                                <div className="flex items-center gap-2">
                                                    <label className="text-[10px] text-gray-500 font-bold">New Sell Price:</label>
                                                    <input type="number" value={newSellPrice} onChange={e => setNewSellPrice(Number(e.target.value))} min={0} step={0.01}
                                                        className="w-24 px-2 py-1 bg-white border border-amber-300 rounded-lg text-xs font-bold text-amber-700 focus:border-amber-500 outline-none text-center" />
                                                </div>
                                            )}
                                        </div>
                                        {shouldUpdatePrices && (
                                            <p className="text-[10px] text-amber-600 mt-1">
                                                ✅ Cost: Ksh {selectedProduct.purchase_cost} → <span className="font-bold">Ksh {price}</span> | Sell: Ksh {selectedProduct.sales_cost} → <span className="font-bold">Ksh {newSellPrice}</span>
                                                {price > 0 && ` | Margin: ${((newSellPrice - price) / price * 100).toFixed(1)}%`}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* ━━━ ITEMS LIST ━━━ */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="px-5 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 flex items-center justify-between">
                            <h2 className="text-sm font-bold text-white flex items-center gap-2">
                                <FiPackage size={14} /> Purchase Items
                                <span className="ml-2 px-2 py-0.5 bg-white/20 text-white text-xs rounded-full">{items.length}</span>
                            </h2>
                            {items.length > 0 && <button onClick={() => setItems([])} className="text-xs text-white/80 hover:text-white flex items-center gap-1"><FiTrash2 size={11} /> Clear</button>}
                        </div>
                        {items.length === 0 ? (
                            <div className="text-center py-12 text-gray-400">
                                <FiPackage size={40} className="mx-auto mb-3 opacity-30" />
                                <p className="font-medium text-sm">No items added yet</p>
                                <p className="text-xs">Search for products above to add</p>
                            </div>
                        ) : (
                            <table className="w-full">
                                <thead><tr className="bg-gray-50">
                                    <th className="px-2 py-2 text-left text-[10px] font-bold text-gray-500 uppercase">#</th>
                                    <th className="px-2 py-2 text-left text-[10px] font-bold text-gray-500 uppercase">Product</th>
                                    <th className="px-2 py-2 text-center text-[10px] font-bold text-gray-500 uppercase">📦 Bags</th>
                                    <th className="px-2 py-2 text-center text-[10px] font-bold text-gray-500 uppercase">🔢 Pcs</th>
                                    <th className="px-2 py-2 text-right text-[10px] font-bold text-gray-500 uppercase">Cost</th>
                                    <th className="px-2 py-2 text-right text-[10px] font-bold text-gray-500 uppercase">Total</th>
                                    {expiryEnabled && <th className="px-2 py-2 text-center text-[10px] font-bold text-gray-500 uppercase">Batch/Expiry</th>}
                                    <th className="px-2 py-2 text-center text-[10px] font-bold text-gray-500 uppercase">Price</th>
                                    <th className="px-2 py-2 text-center text-[10px] font-bold text-gray-500 uppercase w-8"></th>
                                </tr></thead>
                                <tbody>
                                    {items.map((item, idx) => (
                                        <tr key={item.id} className={`border-b border-gray-50 hover:bg-emerald-50/40 transition-colors ${idx % 2 ? 'bg-gray-50/30' : ''}`}>
                                            <td className="px-2 py-2 text-xs text-gray-400">{idx + 1}</td>
                                            <td className="px-2 py-2">
                                                <p className="text-xs font-semibold text-gray-800">{item.productName}</p>
                                                <p className="text-[10px] text-indigo-500 font-mono">{item.productCode} • {item.purchaseUnit}</p>
                                            </td>
                                            <td className="px-2 py-2 text-center">
                                                {item.bagQty > 0 ? (
                                                    <span className="inline-flex items-center px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs font-bold">{item.bagQty}</span>
                                                ) : <span className="text-[10px] text-gray-300">—</span>}
                                            </td>
                                            <td className="px-2 py-2 text-center">
                                                {item.pieceQty > 0 ? (
                                                    <span className="inline-flex items-center px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded text-xs font-bold">{item.pieceQty}</span>
                                                ) : <span className="text-[10px] text-gray-300">—</span>}
                                            </td>
                                            <td className="px-2 py-2 text-right text-xs text-gray-500">Ksh {item.price.toLocaleString()}</td>
                                            <td className="px-2 py-2 text-right text-sm font-bold text-emerald-600">Ksh {item.total.toLocaleString()}</td>
                                            {expiryEnabled && (
                                                <td className="px-2 py-2 text-center">
                                                    {item.expiryDate ? (
                                                        <div>
                                                            <span className="text-[10px] font-mono text-amber-700 bg-amber-50 px-1 rounded">{item.batchNumber || 'Auto'}</span>
                                                            <p className="text-[9px] text-gray-400 mt-0.5">{new Date(item.expiryDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}</p>
                                                        </div>
                                                    ) : <span className="text-[10px] text-gray-300">—</span>}
                                                </td>
                                            )}
                                            <td className="px-2 py-2 text-center">
                                                {item.newCost !== item.oldCost || item.newSell !== item.oldSell ? (
                                                    <div className="flex items-center justify-center gap-1">
                                                        <label className="flex items-center gap-1 cursor-pointer">
                                                            <input type="checkbox" checked={item.updatePrices} onChange={e => toggleItemPriceUpdate(item.id, e.target.checked)} className="accent-amber-600" />
                                                            <span className="text-[10px] text-amber-700 font-bold">Upd</span>
                                                        </label>
                                                        {item.updatePrices && (
                                                            <input type="number" value={item.newSell} onChange={e => editItemSellPrice(item.id, Number(e.target.value))}
                                                                className="w-14 px-1 py-0.5 text-[10px] border border-amber-300 rounded text-center bg-amber-50 font-bold" title="New sell price" />
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-[10px] text-gray-300">—</span>
                                                )}
                                            </td>
                                            <td className="px-2 py-2 text-center">
                                                <button onClick={() => setItems(prev => prev.filter(i => i.id !== item.id))} className="p-1 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600 transition-all"><FiTrash2 size={12} /></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>

                {/* ━━━ RIGHT PANEL ━━━ */}
                <div className="space-y-5">
                    {/* Summary */}
                    <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm sticky top-24">
                        <h2 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2 uppercase tracking-wider">
                            <div className="w-7 h-7 rounded-lg bg-purple-100 flex items-center justify-center"><FiDollarSign className="text-purple-600" size={14} /></div>
                            Purchase Summary
                        </h2>
                        <div className="space-y-3 mb-5">
                            <div className="flex justify-between"><span className="text-sm text-gray-500">Subtotal</span><span className="text-sm font-medium">Ksh {subtotal.toLocaleString()}</span></div>
                            <div className="border-t border-gray-100" />
                            <div className="flex justify-between"><span className="text-lg font-bold text-gray-700">Grand Total</span><span className="text-xl font-black text-emerald-600">Ksh {total.toLocaleString()}</span></div>
                        </div>

                        {/* Supplier info */}
                        {selectedSupplier > 0 && (() => {
                            const sup = suppliers.find(s => s.supplier_id === selectedSupplier);
                            return sup ? (
                                <div className="p-3 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl mb-5">
                                    <p className="text-[10px] font-bold text-indigo-500 uppercase">Supplier</p>
                                    <p className="text-sm font-bold text-gray-800 mt-0.5">{sup.supplier_name}</p>
                                    {sup.phone && <p className="text-xs text-gray-500">{sup.phone}</p>}
                                </div>
                            ) : null;
                        })()}

                        {/* Notes */}
                        <div className="mb-5">
                            <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Notes</label>
                            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes..."
                                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:border-indigo-500 outline-none resize-none" rows={2} />
                        </div>

                        {/* Price updates summary */}
                        {items.some(i => i.updatePrices) && (
                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-5">
                                <p className="text-[10px] font-bold text-amber-700 uppercase flex items-center gap-1"><FiEdit3 size={10} /> Price Updates Queued</p>
                                <p className="text-xs text-amber-600 mt-1">{items.filter(i => i.updatePrices).length} product(s) will have prices updated system-wide</p>
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="space-y-3">
                            <button onClick={savePurchase} disabled={items.length === 0 || isSaving}
                                className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-300/30 hover:shadow-xl disabled:opacity-40 disabled:cursor-not-allowed">
                                {isSaving ? (<><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving...</>) : (<><FiSave size={16} /> Save Purchase</>)}
                            </button>
                            <button onClick={() => setItems([])} className="w-full py-3 border-2 border-gray-200 text-gray-500 rounded-xl font-semibold hover:bg-gray-50 transition-all text-sm flex items-center justify-center gap-2">
                                <FiTrash2 size={14} /> Clear All
                            </button>
                        </div>
                    </div>

                    {/* Quick Stats */}
                    <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                        <h3 className="text-xs font-bold text-gray-500 mb-3 uppercase tracking-wider flex items-center gap-2"><FiTrendingUp size={12} /> Quick Stats</h3>
                        <div className="space-y-2">
                            {[
                                { label: 'Line Items', value: String(items.length), color: 'text-indigo-600' },
                                { label: 'Total Qty', value: items.reduce((s, i) => s + i.qty, 0).toLocaleString(), color: 'text-blue-600' },
                                { label: 'Avg. Unit Price', value: `Ksh ${items.length > 0 ? Math.round(total / items.reduce((s, i) => s + i.qty, 0) || 0).toLocaleString() : '0'}`, color: 'text-emerald-600' },
                                { label: 'Price Updates', value: String(items.filter(i => i.updatePrices).length), color: 'text-amber-600' },
                            ].map((s, i) => (
                                <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                                    <span className="text-xs text-gray-500">{s.label}</span>
                                    <span className={`text-sm font-bold ${s.color}`}>{s.value}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Unit Conversion Help */}
                    <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                        <h3 className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">Unit Conversion Guide</h3>
                        <div className="space-y-1 text-[10px] text-gray-400">
                            <p>📦 <span className="text-gray-600 font-medium">Box → Pieces</span>: Uses pcs/package setting</p>
                            <p>⚖️ <span className="text-gray-600 font-medium">Bag/Kg → Grams</span>: 1 Kg = 1000 Grams</p>
                            <p>🧴 <span className="text-gray-600 font-medium">Liter → ML</span>: 1 Liter = 1000 ML</p>
                            <p>📏 <span className="text-gray-600 font-medium">Dozen → Pieces</span>: 1 Dozen = 12 Pcs</p>
                            <p className="text-amber-500 mt-2">💡 Price auto-adjusts when you change the buy unit</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
