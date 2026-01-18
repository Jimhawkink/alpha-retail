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
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
                        <span className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center text-white text-2xl shadow-lg">📥</span>
                        <span className="bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                            Purchase Entry
                        </span>
                    </h1>
                    <p className="text-gray-500 mt-1">Record new product purchases from suppliers</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="px-4 py-2 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl">
                        <span className="text-sm text-green-600 font-medium">Invoice #</span>
                        <span className="ml-2 font-bold text-green-700">{invoiceNo}</span>
                    </div>
                    <a
                        href="/dashboard/purchases"
                        className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                    >
                        <span>📋</span>
                        <span className="font-medium text-gray-600">View Records</span>
                    </a>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-6">
                {/* Left Panel - Purchase Details */}
                <div className="col-span-2 space-y-6">
                    {/* Supplier & Invoice Info */}
                    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                            <span className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">🏢</span>
                            Supplier Information
                        </h2>
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="text-sm font-medium text-gray-600 mb-1 block">Supplier *</label>
                                <select
                                    value={selectedSupplier}
                                    onChange={(e) => setSelectedSupplier(Number(e.target.value))}
                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-green-400"
                                >
                                    <option value={0}>Select Supplier</option>
                                    {suppliers.map(supplier => (
                                        <option key={supplier.supplier_id} value={supplier.supplier_id}>
                                            {supplier.supplier_code} - {supplier.supplier_name}
                                        </option>
                                    ))}
                                </select>
                                {suppliers.length === 0 ? (
                                    <p className="text-xs text-amber-600 mt-1">
                                        ⚠️ No suppliers. <a href="/dashboard/suppliers" className="text-blue-600 underline hover:text-blue-800">Add Supplier</a>
                                    </p>
                                ) : (
                                    <a href="/dashboard/suppliers" className="text-xs text-blue-600 hover:underline mt-1 inline-block">
                                        ➕ Add New Supplier
                                    </a>
                                )}
                            </div>
                            <div>
                                <label className="text-sm font-medium text-gray-600 mb-1 block">Supplier Invoice No</label>
                                <input
                                    type="text"
                                    value={supplierInvoiceNo}
                                    onChange={(e) => setSupplierInvoiceNo(e.target.value)}
                                    placeholder="Supplier's Invoice No"
                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-green-400"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-gray-600 mb-1 block">Date</label>
                                <input
                                    type="date"
                                    value={purchaseDate}
                                    onChange={(e) => setPurchaseDate(e.target.value)}
                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-green-400"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Add Items */}
                    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                            <span className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">📦</span>
                            Add Products
                        </h2>
                        <div className="grid grid-cols-5 gap-4 mb-4">
                            <div className="col-span-2">
                                <label className="text-sm font-medium text-gray-600 mb-1 block">Product *</label>
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

                                            // Fetch available stock
                                            const { data: stockData } = await supabase
                                                .from('retail_stock')
                                                .select('qty')
                                                .eq('pid', prodId);

                                            const totalStock = stockData?.reduce((sum, s) => sum + (s.qty || 0), 0) || 0;
                                            setAvailableQty(totalStock);
                                        }
                                    }}
                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-green-400"
                                >
                                    <option value={0}>Select Product</option>
                                    {products.map(product => (
                                        <option key={product.pid} value={product.pid}>
                                            {product.product_code} - {product.product_name} ({product.purchase_unit || 'PCS'})
                                        </option>
                                    ))}
                                </select>
                                {selectedProduct > 0 && (
                                    <p className="text-xs mt-1 font-medium text-blue-600">
                                        📦 Available Stock: {availableQty.toLocaleString()} {selectedUnit}
                                    </p>
                                )}
                                {products.length === 0 && (
                                    <p className="text-xs text-amber-600 mt-1">⚠️ No products found. Add products first.</p>
                                )}
                            </div>
                            <div>
                                <label className="text-sm font-medium text-gray-600 mb-1 block">Quantity *</label>
                                <input
                                    type="number"
                                    value={qty}
                                    onChange={(e) => setQty(Number(e.target.value))}
                                    min={0.1}
                                    step={0.1}
                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-green-400"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-gray-600 mb-1 block">Unit Price *</label>
                                <input
                                    type="number"
                                    value={price}
                                    onChange={(e) => setPrice(Number(e.target.value))}
                                    min={0}
                                    step={0.01}
                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-green-400"
                                />
                            </div>
                            <div className="flex items-end">
                                <button
                                    onClick={addItem}
                                    className="w-full py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all flex items-center justify-center gap-2"
                                >
                                    <span>➕</span> Add
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Items List */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-green-50 to-emerald-50">
                            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                                <span>🛒</span> Purchase Items
                                <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-600 text-sm rounded-full">
                                    {items.length} items
                                </span>
                            </h2>
                        </div>

                        {items.length === 0 ? (
                            <div className="p-12 text-center text-gray-400">
                                <span className="text-5xl block mb-4">📭</span>
                                <p className="font-medium">No items added yet</p>
                                <p className="text-sm">Select ingredients and add them to the list</p>
                            </div>
                        ) : (
                            <table className="w-full text-xs">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="text-left py-2 px-3 text-xs font-semibold text-gray-600">#</th>
                                        <th className="text-left py-2 px-3 text-xs font-semibold text-gray-600">Code</th>
                                        <th className="text-left py-2 px-3 text-xs font-semibold text-gray-600">Product</th>
                                        <th className="text-center py-2 px-3 text-xs font-semibold text-gray-600">Unit</th>
                                        <th className="text-right py-2 px-3 text-xs font-semibold text-gray-600">Qty</th>
                                        <th className="text-right py-2 px-3 text-xs font-semibold text-gray-600">Price</th>
                                        <th className="text-right py-2 px-3 text-xs font-semibold text-gray-600">Total</th>
                                        <th className="text-center py-2 px-3 text-xs font-semibold text-gray-600">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map((item, idx) => (
                                        <tr key={item.id} className="border-t border-gray-50 hover:bg-green-50/30">
                                            <td className="py-2 px-3 text-gray-500 text-xs">{idx + 1}</td>
                                            <td className="py-2 px-3 font-mono text-xs text-gray-600">{item.productCode}</td>
                                            <td className="py-2 px-3 font-medium text-gray-800 text-xs" title={item.productName}>{item.productName}</td>
                                            <td className="py-2 px-3 text-center">
                                                <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">{item.unit}</span>
                                            </td>
                                            <td className="py-2 px-3 text-right text-gray-600 font-medium text-xs">{item.qty}</td>
                                            <td className="py-2 px-3 text-right text-gray-600 text-xs">Ksh {item.price.toLocaleString()}</td>
                                            <td className="py-2 px-3 text-right font-bold text-green-600 text-xs">Ksh {item.total.toLocaleString()}</td>
                                            <td className="py-2 px-3 text-center">
                                                <button
                                                    onClick={() => removeItem(item.id)}
                                                    className="p-1.5 hover:bg-red-50 rounded-lg text-red-500 transition-colors"
                                                    title="Remove Item"
                                                >
                                                    🗑️
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>

                {/* Right Panel - Summary */}
                <div className="space-y-6">
                    {/* Order Summary */}
                    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm sticky top-24">
                        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                            <span className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">📊</span>
                            Purchase Summary
                        </h2>

                        <div className="space-y-3 mb-6">
                            <div className="flex justify-between text-gray-600">
                                <span>Subtotal</span>
                                <span className="font-medium">Ksh {subtotal.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-gray-600">
                                <span>Discount</span>
                                <span className="font-medium text-green-600">- Ksh {discount.toLocaleString()}</span>
                            </div>
                            <div className="h-px bg-gray-100"></div>
                            <div className="flex justify-between text-xl font-bold text-gray-800">
                                <span>Total</span>
                                <span className="text-green-600">Ksh {total.toLocaleString()}</span>
                            </div>
                        </div>

                        {/* Supplier Info Display */}
                        {selectedSupplier > 0 && (
                            <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl mb-6 border border-green-100">
                                <p className="text-sm font-medium text-green-700 mb-1">Selected Supplier</p>
                                <p className="font-semibold text-gray-800">{suppliers.find(s => s.supplier_id === selectedSupplier)?.supplier_name}</p>
                                <p className="text-sm text-gray-600">{suppliers.find(s => s.supplier_id === selectedSupplier)?.phone}</p>
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="space-y-3">
                            <button
                                onClick={savePurchase}
                                disabled={items.length === 0 || isSaving}
                                className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-bold hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSaving ? (
                                    <><span className="animate-spin">⏳</span> Saving...</>
                                ) : (
                                    <><span>💾</span> Save Purchase</>
                                )}
                            </button>
                            <button
                                onClick={() => setItems([])}
                                className="w-full py-3 border-2 border-gray-200 text-gray-600 rounded-xl font-semibold hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
                            >
                                <span>🗑️</span>
                                <span>Clear All</span>
                            </button>
                        </div>
                    </div>

                    {/* Quick Stats */}
                    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                        <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                            <span>📈</span> Quick Stats
                        </h3>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                                <span className="text-gray-600">Total Items</span>
                                <span className="font-bold text-gray-800">{items.length}</span>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                                <span className="text-gray-600">Total Qty</span>
                                <span className="font-bold text-gray-800">{items.reduce((sum, item) => sum + item.qty, 0).toLocaleString()}</span>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                                <span className="text-gray-600">Avg. Price</span>
                                <span className="font-bold text-gray-800">
                                    Ksh {items.length > 0 ? Math.round(total / items.reduce((sum, item) => sum + item.qty, 0)).toLocaleString() : 0}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
