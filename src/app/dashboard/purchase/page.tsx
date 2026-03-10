'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import { FiShoppingBag, FiPackage, FiX, FiPlus, FiTrash2, FiDollarSign, FiTruck, FiCalendar, FiHash, FiSave, FiCheckCircle, FiAlertTriangle, FiTrendingUp, FiSearch } from 'react-icons/fi';

interface Supplier {
    supplier_id: number; supplier_code: string; supplier_name: string;
    phone: string; contact_person: string;
}
interface Product {
    pid: number; product_code: string; product_name: string;
    purchase_unit: string; purchase_cost: number; category: string;
}
interface PurchaseItem {
    id: number; productId: number; productCode: string; productName: string;
    unit: string; qty: number; price: number; total: number;
}

export default function PurchaseEntryPage() {
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [productSearch, setProductSearch] = useState('');

    // Form
    const [invoiceNo, setInvoiceNo] = useState('');
    const [selectedSupplier, setSelectedSupplier] = useState<number>(0);
    const [supplierInvoiceNo, setSupplierInvoiceNo] = useState('');
    const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
    const [items, setItems] = useState<PurchaseItem[]>([]);
    const [paymentStatus, setPaymentStatus] = useState('Paid');
    const [notes, setNotes] = useState('');

    // Add item
    const [selectedProduct, setSelectedProduct] = useState<number>(0);
    const [qty, setQty] = useState<number>(1);
    const [price, setPrice] = useState<number>(0);
    const [selectedUnit, setSelectedUnit] = useState<string>('');
    const [availableQty, setAvailableQty] = useState<number>(0);

    // Success state
    const [showSuccess, setShowSuccess] = useState(false);
    const [savedInvoice, setSavedInvoice] = useState('');

    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            try {
                const [{ data: suppData }, { data: prodData }] = await Promise.all([
                    supabase.from('retail_suppliers').select('supplier_id, supplier_code, supplier_name, phone, contact_person').eq('active', true).order('supplier_name'),
                    supabase.from('retail_products').select('pid, product_code, product_name, purchase_unit, purchase_cost, category').eq('active', true).order('product_name'),
                ]);
                setSuppliers(suppData || []); setProducts(prodData || []);
                await generateInvoiceNo();
            } catch { toast.error('Failed to load data'); }
            setIsLoading(false);
        };
        loadData();
    }, []);

    const generateInvoiceNo = async () => {
        try {
            const { data } = await supabase.from('retail_purchases').select('purchase_no').order('purchase_id', { ascending: false }).limit(1);
            let n = 1;
            if (data?.[0]) { const m = data[0].purchase_no.match(/INV-(\d+)/); if (m) n = parseInt(m[1]) + 1; }
            setInvoiceNo(`INV-${String(n).padStart(3, '0')}`);
        } catch { setInvoiceNo(`INV-${Date.now().toString().slice(-4)}`); }
    };

    const selectProduct = async (prodId: number) => {
        setSelectedProduct(prodId); setAvailableQty(0);
        const product = products.find(p => p.pid === prodId);
        if (product) {
            setPrice(product.purchase_cost || 0); setSelectedUnit(product.purchase_unit || 'PCS');
            const { data: stockData } = await supabase.from('retail_stock').select('qty').eq('pid', prodId);
            setAvailableQty(stockData?.reduce((s, r) => s + (r.qty || 0), 0) || 0);
        }
    };

    const addItem = () => {
        if (!selectedProduct || qty <= 0 || price <= 0) { toast.error('Please select product, qty & price'); return; }
        const product = products.find(p => p.pid === selectedProduct);
        if (!product) return;
        const existing = items.findIndex(i => i.productId === selectedProduct);
        if (existing >= 0) {
            setItems(prev => prev.map((item, idx) => idx === existing ? { ...item, qty: item.qty + qty, total: (item.qty + qty) * item.price } : item));
            toast.success('Quantity updated');
        } else {
            setItems(prev => [...prev, { id: Date.now(), productId: product.pid, productCode: product.product_code || '', productName: product.product_name, unit: selectedUnit || product.purchase_unit || 'PCS', qty, price, total: qty * price }]);
            toast.success('Item added');
        }
        setSelectedProduct(0); setQty(1); setPrice(0); setSelectedUnit(''); setProductSearch('');
    };

    const subtotal = items.reduce((s, i) => s + i.total, 0);
    const total = subtotal;

    const filteredProducts = products.filter(p => {
        if (!productSearch.trim()) return true;
        const q = productSearch.toLowerCase();
        return p.product_name.toLowerCase().includes(q) || p.product_code.toLowerCase().includes(q);
    });

    const savePurchase = async () => {
        if (!selectedSupplier) { toast.error('Select a supplier'); return; }
        if (items.length === 0) { toast.error('Add at least one item'); return; }
        setIsSaving(true);
        try {
            const userData = localStorage.getItem('user');
            const user = userData ? JSON.parse(userData) : null;
            const supplier = suppliers.find(s => s.supplier_id === selectedSupplier);
            const { data: purchaseData, error: pErr } = await supabase.from('retail_purchases').insert({
                purchase_no: invoiceNo, purchase_date: purchaseDate,
                supplier_id: selectedSupplier, supplier_name: supplier?.supplier_name || '',
                supplier_invoice: supplierInvoiceNo, sub_total: subtotal, discount: 0, vat: 0, grand_total: total,
                status: 'Completed', payment_status: paymentStatus, created_by: user?.name || 'Unknown'
            }).select().single();
            if (pErr) throw pErr;
            const pid = purchaseData.purchase_id;
            const purchaseItemsData = items.map(i => ({ purchase_id: pid, product_id: i.productId, product_code: i.productCode, product_name: i.productName, quantity: i.qty, unit: i.unit, rate: i.price, total_amount: i.total }));
            const { error: iErr } = await supabase.from('retail_purchase_products').insert(purchaseItemsData);
            if (iErr) throw iErr;
            for (const item of items) {
                const { data: sData } = await supabase.from('retail_stock').select('st_id, qty').eq('pid', item.productId).single();
                if (sData) { await supabase.from('retail_stock').update({ qty: (sData.qty || 0) + item.qty, invoice_no: invoiceNo, updated_at: new Date().toISOString() }).eq('st_id', sData.st_id); }
                else { await supabase.from('retail_stock').insert({ pid: item.productId, invoice_no: invoiceNo, qty: item.qty, storage_type: 'Store' }); }
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

            {/* Success Dialog */}
            {showSuccess && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-md flex items-center justify-center z-50" onClick={() => setShowSuccess(false)}>
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 text-center" onClick={e => e.stopPropagation()}>
                        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center mx-auto mb-4 shadow-xl shadow-emerald-300/40 animate-bounce">
                            <FiCheckCircle className="text-white" size={36} />
                        </div>
                        <p className="text-2xl font-black text-gray-800">Purchase Saved!</p>
                        <p className="text-sm text-gray-500 mt-2">Invoice <span className="font-bold text-indigo-600">{savedInvoice}</span> saved and stock updated.</p>
                        <div className="flex gap-3 mt-6">
                            <button onClick={() => setShowSuccess(false)} className="flex-1 px-4 py-3 bg-gradient-to-r from-emerald-500 to-green-600 text-white font-bold rounded-xl text-sm">New Purchase</button>
                            <a href="/dashboard/purchases" className="flex-1 px-4 py-3 border-2 border-gray-200 text-gray-600 font-bold rounded-xl text-sm text-center">View Records</a>
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
                        <p className="text-gray-500 text-sm mt-1">Record new product purchases from suppliers</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="px-4 py-2.5 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl flex items-center gap-2">
                        <FiHash size={14} className="text-indigo-500" />
                        <span className="text-sm font-bold text-indigo-700">{invoiceNo}</span>
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
                                {suppliers.length === 0 && <p className="text-[10px] text-amber-600 mt-1 flex items-center gap-1"><FiAlertTriangle size={10} /> No suppliers. <a href="/dashboard/suppliers" className="text-blue-600 underline">Add Supplier</a></p>}
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Supplier Invoice</label>
                                <input type="text" value={supplierInvoiceNo} onChange={e => setSupplierInvoiceNo(e.target.value)} placeholder="Supplier's invoice..."
                                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:border-indigo-500 outline-none" />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Purchase Date</label>
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

                    {/* Add Product */}
                    <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                        <h2 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2 uppercase tracking-wider">
                            <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center"><FiPackage className="text-emerald-600" size={14} /></div>
                            Add Products to Purchase
                        </h2>
                        <div className="grid grid-cols-12 gap-3 items-end">
                            <div className="col-span-5">
                                <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Product *</label>
                                <div className="relative">
                                    <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                                    <input type="text" value={productSearch} onChange={e => setProductSearch(e.target.value)} placeholder="Search product..."
                                        className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:border-indigo-500 outline-none" />
                                </div>
                                <select size={Math.min(5, filteredProducts.length || 1)} value={selectedProduct} onChange={e => selectProduct(Number(e.target.value))}
                                    className="w-full mt-1 px-3 py-1 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:border-indigo-500 outline-none">
                                    <option value={0}>— Select —</option>
                                    {filteredProducts.map(p => <option key={p.pid} value={p.pid}>{p.product_code} • {p.product_name} ({p.purchase_unit || 'PCS'})</option>)}
                                </select>
                                {selectedProduct > 0 && <p className="text-[10px] text-blue-600 mt-1 font-medium">📦 Current Stock: {availableQty.toLocaleString()} {selectedUnit}</p>}
                            </div>
                            <div className="col-span-2">
                                <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Qty *</label>
                                <input type="number" value={qty} onChange={e => setQty(Number(e.target.value))} min={0.1} step={0.1}
                                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:border-indigo-500 outline-none text-center" />
                            </div>
                            <div className="col-span-2">
                                <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Unit Price *</label>
                                <input type="number" value={price} onChange={e => setPrice(Number(e.target.value))} min={0} step={0.01}
                                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:border-indigo-500 outline-none text-center" />
                            </div>
                            <div className="col-span-2">
                                <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Total</label>
                                <div className="w-full px-3 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-sm font-black text-emerald-700 text-center">
                                    Ksh {(qty * price).toLocaleString()}
                                </div>
                            </div>
                            <div className="col-span-1">
                                <button onClick={addItem} className="w-full py-2.5 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-xl font-bold hover:shadow-lg transition-all flex items-center justify-center" title="Add Item">
                                    <FiPlus size={18} />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Items List */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="px-5 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 flex items-center justify-between">
                            <h2 className="text-sm font-bold text-white flex items-center gap-2">
                                <FiPackage size={14} /> Purchase Items
                                <span className="ml-2 px-2 py-0.5 bg-white/20 text-white text-xs rounded-full">{items.length}</span>
                            </h2>
                            {items.length > 0 && <button onClick={() => setItems([])} className="text-xs text-white/80 hover:text-white flex items-center gap-1"><FiTrash2 size={11} /> Clear All</button>}
                        </div>
                        {items.length === 0 ? (
                            <div className="text-center py-12 text-gray-400">
                                <FiPackage size={40} className="mx-auto mb-3 opacity-30" />
                                <p className="font-medium text-sm">No items added yet</p>
                                <p className="text-xs">Select products above and click + to add</p>
                            </div>
                        ) : (
                            <table className="w-full">
                                <thead><tr className="bg-gray-50">
                                    <th className="px-4 py-2.5 text-left text-[10px] font-bold text-gray-500 uppercase">#</th>
                                    <th className="px-4 py-2.5 text-left text-[10px] font-bold text-gray-500 uppercase">Code</th>
                                    <th className="px-4 py-2.5 text-left text-[10px] font-bold text-gray-500 uppercase">Product</th>
                                    <th className="px-4 py-2.5 text-center text-[10px] font-bold text-gray-500 uppercase">Unit</th>
                                    <th className="px-4 py-2.5 text-right text-[10px] font-bold text-gray-500 uppercase">Qty</th>
                                    <th className="px-4 py-2.5 text-right text-[10px] font-bold text-gray-500 uppercase">Price</th>
                                    <th className="px-4 py-2.5 text-right text-[10px] font-bold text-gray-500 uppercase">Total</th>
                                    <th className="px-4 py-2.5 text-center text-[10px] font-bold text-gray-500 uppercase w-12"></th>
                                </tr></thead>
                                <tbody>
                                    {items.map((item, idx) => (
                                        <tr key={item.id} className={`border-b border-gray-50 hover:bg-emerald-50/40 transition-colors ${idx % 2 ? 'bg-gray-50/30' : ''}`}>
                                            <td className="px-4 py-2.5 text-xs text-gray-400">{idx + 1}</td>
                                            <td className="px-4 py-2.5 text-xs text-indigo-600 font-mono">{item.productCode}</td>
                                            <td className="px-4 py-2.5 text-sm font-semibold text-gray-800">{item.productName}</td>
                                            <td className="px-4 py-2.5 text-center"><span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">{item.unit}</span></td>
                                            <td className="px-4 py-2.5 text-right text-sm font-bold text-gray-700">{item.qty}</td>
                                            <td className="px-4 py-2.5 text-right text-xs text-gray-500">Ksh {item.price.toLocaleString()}</td>
                                            <td className="px-4 py-2.5 text-right text-sm font-bold text-emerald-600">Ksh {item.total.toLocaleString()}</td>
                                            <td className="px-4 py-2.5 text-center">
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

                        {/* Selected Supplier Info */}
                        {selectedSupplier > 0 && (() => {
                            const sup = suppliers.find(s => s.supplier_id === selectedSupplier);
                            return sup ? (
                                <div className="p-3 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl mb-5">
                                    <p className="text-[10px] font-bold text-indigo-500 uppercase">Selected Supplier</p>
                                    <p className="text-sm font-bold text-gray-800 mt-0.5">{sup.supplier_name}</p>
                                    {sup.phone && <p className="text-xs text-gray-500">{sup.phone}</p>}
                                    {sup.contact_person && <p className="text-xs text-gray-500">{sup.contact_person}</p>}
                                </div>
                            ) : null;
                        })()}

                        {/* Notes */}
                        <div className="mb-5">
                            <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Notes (Optional)</label>
                            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Additional notes..."
                                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:border-indigo-500 outline-none resize-none" rows={2} />
                        </div>

                        {/* Action Buttons */}
                        <div className="space-y-3">
                            <button onClick={savePurchase} disabled={items.length === 0 || isSaving}
                                className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-300/30 hover:shadow-xl disabled:opacity-40 disabled:cursor-not-allowed">
                                {isSaving ? (<><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving...</>) : (<><FiSave size={16} /> Save Purchase</>)}
                            </button>
                            <button onClick={() => setItems([])} className="w-full py-3 border-2 border-gray-200 text-gray-500 rounded-xl font-semibold hover:bg-gray-50 transition-all text-sm flex items-center justify-center gap-2">
                                <FiTrash2 size={14} /> Clear All Items
                            </button>
                        </div>
                    </div>

                    {/* Quick Stats */}
                    <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                        <h3 className="text-xs font-bold text-gray-500 mb-3 uppercase tracking-wider flex items-center gap-2"><FiTrendingUp size={12} /> Quick Stats</h3>
                        <div className="space-y-2">
                            {[
                                { label: 'Total Items', value: items.length, color: 'text-indigo-600' },
                                { label: 'Total Qty', value: items.reduce((s, i) => s + i.qty, 0).toLocaleString(), color: 'text-blue-600' },
                                { label: 'Avg. Unit Price', value: `Ksh ${items.length > 0 ? Math.round(total / items.reduce((s, i) => s + i.qty, 0)).toLocaleString() : 0}`, color: 'text-emerald-600' },
                            ].map((s, i) => (
                                <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                                    <span className="text-xs text-gray-500">{s.label}</span>
                                    <span className={`text-sm font-bold ${s.color}`}>{s.value}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
