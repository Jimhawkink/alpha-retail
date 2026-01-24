'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';

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
    purchase_cost: number;
    category: string;
}

interface PurchaseItem {
    id: number;
    productId: number;
    productCode: string;
    productName: string;
    unit: string;
    qty: number;
    price: number;
    total: number;
}

export default function PurchaseEntryPage() {
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // Form state
    const [invoiceNo, setInvoiceNo] = useState('');
    const [selectedSupplier, setSelectedSupplier] = useState<number>(0);
    const [supplierInvoiceNo, setSupplierInvoiceNo] = useState('');
    const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
    const [items, setItems] = useState<PurchaseItem[]>([]);

    // Add item form
    const [selectedProduct, setSelectedProduct] = useState<number>(0);
    const [qty, setQty] = useState<number>(1);
    const [price, setPrice] = useState<number>(0);
    const [selectedUnit, setSelectedUnit] = useState<string>('');
    const [availableQty, setAvailableQty] = useState<number>(0);

    // Load initial data
    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            try {
                // Load suppliers from retail_suppliers table
                const { data: suppliersData, error: suppliersError } = await supabase
                    .from('retail_suppliers')
                    .select('supplier_id, supplier_code, supplier_name, phone, contact_person')
                    .eq('active', true)
                    .order('supplier_name');

                if (suppliersError) {
                    console.error('Error loading suppliers:', suppliersError);
                } else {
                    setSuppliers(suppliersData || []);
                }

                // Load products from retail_products table
                const { data: productsData, error: productsError } = await supabase
                    .from('retail_products')
                    .select('pid, product_code, product_name, purchase_unit, purchase_cost, category')
                    .eq('active', true)
                    .order('product_name');

                if (productsError) {
                    console.error('Error loading products:', productsError);
                } else {
                    setProducts(productsData || []);
                }

                // Generate next invoice number
                await generateInvoiceNo();
            } catch (err) {
                console.error('Error loading data:', err);
                toast.error('Failed to load data');
            }
            setIsLoading(false);
        };
        loadData();
    }, []);

    // Generate next invoice number in format INV-01, INV-02, etc.
    const generateInvoiceNo = async () => {
        try {
            const { data, error } = await supabase
                .from('retail_purchases')
                .select('purchase_no')
                .order('purchase_id', { ascending: false })
                .limit(1);

            if (error) throw error;

            let nextNum = 1;
            if (data && data.length > 0) {
                const lastNo = data[0].purchase_no;
                // Extract number from INV-XX format
                const match = lastNo.match(/INV-(\d+)/);
                if (match) {
                    nextNum = parseInt(match[1]) + 1;
                }
            }

            setInvoiceNo(`INV-${String(nextNum).padStart(2, '0')}`);
        } catch (err) {
            console.error('Error generating invoice no:', err);
            setInvoiceNo(`INV-${Date.now().toString().slice(-4)}`);
        }
    };

    // Add item to purchase list
    const addItem = () => {
        if (selectedProduct === 0 || qty <= 0 || price <= 0) {
            toast.error('Please select product, quantity, and price');
            return;
        }

        const product = products.find(p => p.pid === selectedProduct);
        if (!product) return;

        // Check if already exists
        const existingIndex = items.findIndex(i => i.productId === selectedProduct);
        if (existingIndex >= 0) {
            // Update existing item
            setItems(prev => prev.map((item, idx) =>
                idx === existingIndex
                    ? { ...item, qty: item.qty + qty, total: (item.qty + qty) * item.price }
                    : item
            ));
        } else {
            // Add new item
            const newItem: PurchaseItem = {
                id: Date.now(),
                productId: product.pid,
                productCode: product.product_code || '',
                productName: product.product_name,
                unit: selectedUnit || product.purchase_unit || 'PCS',
                qty,
                price,
                total: qty * price,
            };
            setItems(prev => [...prev, newItem]);
        }

        // Reset form
        setSelectedProduct(0);
        setQty(1);
        setPrice(0);
        setSelectedUnit('');
        toast.success('Item added! 📦');
    };

    // Remove item
    const removeItem = (id: number) => {
        setItems(prev => prev.filter(item => item.id !== id));
    };

    // Calculate totals
    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    const discount = 0;
    const total = subtotal - discount;

    // Save purchase
    const savePurchase = async () => {
        if (selectedSupplier === 0) {
            toast.error('Please select a supplier');
            return;
        }
        if (items.length === 0) {
            toast.error('Please add at least one item');
            return;
        }

        setIsSaving(true);
        try {
            const userData = localStorage.getItem('user');
            const currentUser = userData ? JSON.parse(userData) : null;
            const supplier = suppliers.find(s => s.supplier_id === selectedSupplier);

            // 1. Create purchase record in retail_purchases
            const { data: purchaseData, error: purchaseError } = await supabase
                .from('retail_purchases')
                .insert({
                    purchase_no: invoiceNo,
                    purchase_date: purchaseDate,
                    supplier_id: selectedSupplier,
                    supplier_name: supplier?.supplier_name || '',
                    supplier_invoice: supplierInvoiceNo,
                    sub_total: subtotal,
                    discount: discount,
                    vat: 0,
                    grand_total: total,
                    status: 'Completed',
                    payment_status: 'Paid',
                    created_by: currentUser?.name || 'Unknown'
                })
                .select()
                .single();

            if (purchaseError) throw purchaseError;

            const purchaseId = purchaseData.purchase_id;

            // 2. Add purchase items to retail_purchase_products
            const purchaseItems = items.map(item => ({
                purchase_id: purchaseId,
                product_id: item.productId,
                product_code: item.productCode,
                product_name: item.productName,
                quantity: item.qty,
                unit: item.unit,
                rate: item.price,
                total_amount: item.total
            }));

            const { error: itemsError } = await supabase
                .from('retail_purchase_products')
                .insert(purchaseItems);

            if (itemsError) throw itemsError;

            // 3. Update stock for each product in retail_stock table
            for (const item of items) {
                // Check if stock entry exists for this product
                const { data: stockData } = await supabase
                    .from('retail_stock')
                    .select('st_id, qty')
                    .eq('pid', item.productId)
                    .single();

                if (stockData) {
                    // Update existing stock
                    await supabase
                        .from('retail_stock')
                        .update({
                            qty: (stockData.qty || 0) + item.qty,
                            invoice_no: invoiceNo,
                            updated_at: new Date().toISOString()
                        })
                        .eq('st_id', stockData.st_id);
                } else {
                    // Insert new stock entry
                    await supabase
                        .from('retail_stock')
                        .insert({
                            pid: item.productId,
                            invoice_no: invoiceNo,
                            qty: item.qty,
                            storage_type: 'Store'
                        });
                }
            }

            toast.success(`✅ Purchase ${invoiceNo} saved successfully!`);

            // Reset form
            setItems([]);
            setSelectedSupplier(0);
            setSupplierInvoiceNo('');
            await generateInvoiceNo();
        } catch (err: unknown) {
            console.error('Error saving purchase:', err);
            const errorMessage = err instanceof Error ? err.message :
                (typeof err === 'object' && err !== null && 'message' in err) ? String((err as { message: unknown }).message) :
                    'Unknown error';
            toast.error(`Failed to save: ${errorMessage}`);
        }
        setIsSaving(false);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center">
                    <div className="inline-block animate-spin text-5xl mb-4">🔄</div>
                    <p className="text-gray-500">Loading purchase data...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-700 pb-12">
            {/* Header section with Invoice Badge */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 flex items-center gap-4">
                        <span className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-teal-700 rounded-[22px] flex items-center justify-center text-white text-3xl shadow-2xl shadow-emerald-200/50">📥</span>
                        Stock Acquisition
                    </h1>
                    <p className="text-slate-400 text-sm font-bold uppercase tracking-[0.2em] mt-3 ml-1">
                        Inventory Procurement • Audit Registry v4.0
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="px-6 py-4 bg-emerald-50 border-2 border-emerald-100 rounded-[24px] shadow-inner flex flex-col items-center min-w-[160px]">
                        <span className="text-[10px] text-emerald-600 font-black uppercase tracking-widest">System Ref</span>
                        <span className="text-xl font-black text-slate-900 font-mono">{invoiceNo}</span>
                    </div>
                    <a
                        href="/dashboard/purchases"
                        className="w-14 h-14 bg-white border-2 border-slate-100 text-slate-400 rounded-[22px] hover:border-emerald-600 hover:text-emerald-600 transition-all flex items-center justify-center text-xl shadow-sm hover:shadow-md"
                        title="Acquisition Ledger"
                    >
                        📋
                    </a>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
                {/* Primary Data Input - Left Panel */}
                <div className="xl:col-span-8 space-y-8">
                    {/* Origin & Ref Info */}
                    <div className="bg-white rounded-[40px] p-8 shadow-2xl shadow-slate-200/50 border border-slate-50">
                        <div className="flex items-center gap-3 mb-8">
                            <span className="text-2xl">🏢</span>
                            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Acquisition Source</h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1 block">Vendor Profile *</label>
                                <div className="relative group">
                                    <select
                                        value={selectedSupplier}
                                        onChange={(e) => setSelectedSupplier(Number(e.target.value))}
                                        className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-[20px] text-slate-900 font-bold focus:outline-none focus:border-emerald-600 transition-all appearance-none cursor-pointer"
                                    >
                                        <option value={0}>Identify Vendor</option>
                                        {suppliers.map(supplier => (
                                            <option key={supplier.supplier_id} value={supplier.supplier_id}>
                                                {supplier.supplier_name}
                                            </option>
                                        ))}
                                    </select>
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-40 font-black">▼</span>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1 block">Vendor Invoice Ref</label>
                                <input
                                    type="text"
                                    value={supplierInvoiceNo}
                                    onChange={(e) => setSupplierInvoiceNo(e.target.value)}
                                    placeholder="e.g. SN-99201"
                                    className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-[20px] text-slate-900 font-bold focus:outline-none focus:border-emerald-600 transition-all shadow-inner"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1 block">Acquisition Date</label>
                                <input
                                    type="date"
                                    value={purchaseDate}
                                    onChange={(e) => setPurchaseDate(e.target.value)}
                                    className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-[20px] text-slate-900 font-bold focus:outline-none focus:border-emerald-600 transition-all"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Operational Input - Product Entry */}
                    <div className="bg-white rounded-[40px] p-8 shadow-2xl shadow-slate-200/50 border border-slate-50">
                        <div className="flex items-center gap-3 mb-8">
                            <span className="text-2xl">📦</span>
                            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Item Specification</h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-12 gap-6 items-end">
                            <div className="md:col-span-2 lg:col-span-5 space-y-2">
                                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1 block">Register Product *</label>
                                <div className="relative group">
                                    <select
                                        value={selectedProduct}
                                        onChange={async (e) => {
                                            const prodId = Number(e.target.value);
                                            setSelectedProduct(prodId);
                                            setAvailableQty(0);
                                            const product = products.find(p => p.pid === prodId);
                                            if (product) {
                                                setPrice(product.purchase_cost || 0);
                                                setSelectedUnit(product.purchase_unit || 'PCS');
                                                const { data: stockData } = await supabase.from('retail_stock').select('qty').eq('pid', prodId);
                                                const totalStock = stockData?.reduce((sum, s) => sum + (s.qty || 0), 0) || 0;
                                                setAvailableQty(totalStock);
                                            }
                                        }}
                                        className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-[20px] text-slate-900 font-bold focus:outline-none focus:border-emerald-600 transition-all appearance-none cursor-pointer"
                                    >
                                        <option value={0}>Select Inventory Item</option>
                                        {products.map(product => (
                                            <option key={product.pid} value={product.pid}>
                                                {product.product_name}
                                            </option>
                                        ))}
                                    </select>
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-40 font-black">▼</span>
                                </div>
                            </div>
                            <div className="md:col-span-1 lg:col-span-2 space-y-2">
                                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1 block">Quantity</label>
                                <input
                                    type="number"
                                    value={qty}
                                    onChange={(e) => setQty(Number(e.target.value))}
                                    className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-[20px] text-slate-900 font-bold focus:outline-none focus:border-emerald-600 transition-all shadow-inner text-center"
                                />
                            </div>
                            <div className="md:col-span-1 lg:col-span-3 space-y-2">
                                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1 block">Unit Valuation (Ksh)</label>
                                <input
                                    type="number"
                                    value={price}
                                    onChange={(e) => setPrice(Number(e.target.value))}
                                    className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-[20px] text-slate-900 font-bold focus:outline-none focus:border-emerald-600 transition-all shadow-inner text-right"
                                />
                            </div>
                            <div className="md:col-span-1 lg:col-span-2">
                                <button
                                    onClick={addItem}
                                    className="w-full h-[60px] bg-slate-900 text-white rounded-[20px] font-black uppercase text-xs tracking-widest hover:bg-emerald-600 hover:shadow-xl hover:shadow-emerald-200/50 transition-all flex items-center justify-center gap-2"
                                >
                                    <span>➕</span> Add
                                </button>
                            </div>
                        </div>
                        {selectedProduct > 0 && (
                            <div className="mt-4 flex items-center gap-2 px-4 py-2 bg-blue-50/50 rounded-xl w-fit">
                                <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Current Stock Balance:</span>
                                <span className="text-sm font-black text-slate-900">{availableQty.toLocaleString()} {selectedUnit}</span>
                            </div>
                        )}
                    </div>

                    {/* Acquisition Manifest - Table */}
                    <div className="bg-white rounded-[40px] shadow-2xl shadow-slate-200/50 border border-slate-50 overflow-hidden">
                        <div className="px-8 py-6 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
                            <h2 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em]">Acquisition Manifest</h2>
                            <span className="px-4 py-1.5 bg-white text-slate-900 text-[10px] font-black rounded-full shadow-sm border border-slate-100 tracking-[0.1em]">
                                {items.length} ENTRIES REGISTERED
                            </span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr>
                                        <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Descriptor</th>
                                        <th className="px-8 py-5 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Quantity</th>
                                        <th className="px-8 py-5 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Valuation</th>
                                        <th className="px-8 py-5 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Extended</th>
                                        <th className="px-8 py-5 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Audit</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y-2 divide-slate-50">
                                    {items.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-8 py-20 text-center">
                                                <div className="flex flex-col items-center gap-4 opacity-30 grayscale">
                                                    <span className="text-6xl">📥</span>
                                                    <span className="text-xs font-black uppercase tracking-[0.3em]">Manifest empty: Waiting for input</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        items.map((item, idx) => (
                                            <tr key={item.id} className="group hover:bg-emerald-50/30 transition-all duration-300">
                                                <td className="px-8 py-6">
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-black text-slate-800 leading-tight">{item.productName}</span>
                                                        <span className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-tighter">{item.productCode} • {item.unit}</span>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-6 text-center">
                                                    <span className="px-3 py-1.5 bg-slate-100 rounded-lg text-xs font-black text-slate-700">{item.qty}</span>
                                                </td>
                                                <td className="px-8 py-6 text-right">
                                                    <span className="text-xs font-black text-slate-900">Ksh {item.price.toLocaleString()}</span>
                                                </td>
                                                <td className="px-8 py-6 text-right">
                                                    <span className="text-sm font-black text-emerald-600">Ksh {item.total.toLocaleString()}</span>
                                                </td>
                                                <td className="px-8 py-6 text-center">
                                                    <button
                                                        onClick={() => removeItem(item.id)}
                                                        className="w-10 h-10 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-600 hover:text-white transition-all flex items-center justify-center shadow-inner group-hover:shadow-lg group-hover:shadow-rose-200/50"
                                                    >
                                                        🗑️
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Audit & Settlement - Right Panel */}
                <div className="xl:col-span-4 space-y-8 sticky top-24">
                    {/* Valuations Summary */}
                    <div className="bg-slate-900 rounded-[40px] p-8 text-white shadow-2xl shadow-slate-200 overflow-hidden relative group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-125 transition-transform duration-700"></div>
                        <h2 className="text-xl font-black uppercase tracking-tight mb-8 flex items-center gap-3">
                            <span className="w-8 h-8 bg-white/10 rounded-xl flex items-center justify-center text-sm">📊</span>
                            Audit Summary
                        </h2>

                        <div className="space-y-4 mb-10">
                            <div className="flex justify-between items-center opacity-60">
                                <span className="text-[11px] font-black uppercase tracking-widest">Gross Manifest</span>
                                <span className="font-bold">Ksh {subtotal.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-[11px] font-black uppercase tracking-widest text-emerald-400">Ledger Deduction</span>
                                <span className="font-bold text-emerald-400">- Ksh {discount.toLocaleString()}</span>
                            </div>
                            <div className="pt-6 border-t border-white/10">
                                <p className="text-[11px] font-black text-white/40 uppercase tracking-[0.2em] mb-2">Total Procurement Cost</p>
                                <p className="text-5xl font-black tracking-tighter">Ksh {total.toLocaleString()}</p>
                            </div>
                        </div>

                        {selectedSupplier > 0 && (
                            <div className="p-5 bg-white/5 backdrop-blur-md rounded-3xl border border-white/10 mb-8 animate-in slide-in-from-right-4 duration-500">
                                <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-2">Authorized Source</p>
                                <p className="font-black text-emerald-400 uppercase leading-snug tracking-tight">
                                    {suppliers.find(s => s.supplier_id === selectedSupplier)?.supplier_name}
                                </p>
                            </div>
                        )}

                        <div className="space-y-4">
                            <button
                                onClick={savePurchase}
                                disabled={items.length === 0 || isSaving}
                                className="w-full py-6 bg-emerald-500 text-white rounded-[28px] font-black uppercase tracking-[0.2em] text-xs shadow-xl shadow-emerald-500/20 hover:bg-emerald-400 hover:shadow-2xl transition-all disabled:opacity-20 disabled:grayscale disabled:shadow-none"
                            >
                                {isSaving ? "Synchronizing..." : "Submit Acquisition"}
                            </button>
                            <button
                                onClick={() => setItems([])}
                                className="w-full py-4 text-white/30 hover:text-rose-400 font-black uppercase text-[10px] tracking-[0.2em] transition-colors"
                            >
                                Purge All Entries
                            </button>
                        </div>
                    </div>

                    {/* Quick Analytics Card */}
                    <div className="bg-white rounded-[40px] p-8 shadow-xl shadow-slate-200/40 border border-slate-50 overflow-hidden relative group">
                        <div className="absolute -right-4 -top-4 w-24 h-24 bg-slate-50 rounded-full group-hover:scale-110 transition-transform duration-500"></div>
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 relative">Procurement KPIs</h3>
                        <div className="space-y-4 relative">
                            <div className="flex items-center justify-between p-4 bg-slate-50/50 rounded-3xl border border-slate-50">
                                <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">SKU Count</span>
                                <span className="text-lg font-black text-slate-900">{items.length}</span>
                            </div>
                            <div className="flex items-center justify-between p-4 bg-slate-50/50 rounded-3xl border border-slate-50">
                                <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Global Qty</span>
                                <span className="text-lg font-black text-emerald-600">{items.reduce((sum, item) => sum + item.qty, 0).toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
