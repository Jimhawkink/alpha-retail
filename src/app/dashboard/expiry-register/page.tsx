'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';
import toast from 'react-hot-toast';
import { FiSearch, FiPlus, FiEdit3, FiTrash2, FiAlertTriangle, FiX, FiRefreshCw } from 'react-icons/fi';

interface Batch {
    batch_id: number;
    pid: number;
    product_name: string;
    batch_number: string;
    expiry_date: string;
    qty_received: number;
    qty_remaining: number;
    cost_price: number;
    selling_price: number;
    supplier_name: string;
    received_date: string;
    outlet_id: number;
    status: string;
    notes: string;
    daysLeft: number;
}

interface Product {
    pid: number;
    product_name: string;
    purchase_cost: number;
    sales_cost: number;
}

export default function ExpiryRegisterPage() {
    const { activeOutlet, expiryEnabled } = useOutlet();
    const outletId = activeOutlet?.outlet_id || 1;

    const [batches, setBatches] = useState<Batch[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState<'all' | 'expired' | 'critical' | 'warning' | 'ok'>('all');

    // Add/Edit Modal
    const [showModal, setShowModal] = useState(false);
    const [editingBatch, setEditingBatch] = useState<Batch | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [form, setForm] = useState({
        pid: 0, product_name: '', batch_number: '', expiry_date: '',
        qty_received: 0, qty_remaining: 0, cost_price: 0, selling_price: 0,
        supplier_name: '', notes: '',
    });

    const loadData = useCallback(async () => {
        if (!activeOutlet) return;
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('retail_product_batches')
                .select('*')
                .eq('outlet_id', outletId)
                .eq('status', 'Active')
                .order('expiry_date', { ascending: true });

            if (error) throw error;

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const enriched = (data || []).map(b => {
                const exp = new Date(b.expiry_date);
                exp.setHours(0, 0, 0, 0);
                const daysLeft = Math.ceil((exp.getTime() - today.getTime()) / 86400000);
                return { ...b, daysLeft };
            });

            setBatches(enriched);

            // Load products for the dropdown
            const { data: prods } = await supabase
                .from('retail_products')
                .select('pid, product_name, purchase_cost, sales_cost')
                .eq('active', true)
                .eq('outlet_id', outletId)
                .order('product_name');
            setProducts(prods || []);
        } catch (err: any) {
            console.error('Failed to load batches:', err);
            toast.error('Failed to load expiry data');
        }
        setIsLoading(false);
    }, [activeOutlet, outletId]);

    useEffect(() => { loadData(); }, [loadData]);

    // Stats
    const expired = batches.filter(b => b.daysLeft <= 0);
    const critical = batches.filter(b => b.daysLeft > 0 && b.daysLeft <= 1);
    const warning = batches.filter(b => b.daysLeft > 1 && b.daysLeft <= 7);
    const ok = batches.filter(b => b.daysLeft > 7);

    // Filter
    const filtered = batches
        .filter(b => {
            if (filter === 'expired') return b.daysLeft <= 0;
            if (filter === 'critical') return b.daysLeft > 0 && b.daysLeft <= 1;
            if (filter === 'warning') return b.daysLeft > 0 && b.daysLeft <= 7;
            if (filter === 'ok') return b.daysLeft > 7;
            return true;
        })
        .filter(b => {
            if (!search.trim()) return true;
            const q = search.toLowerCase();
            return b.product_name?.toLowerCase().includes(q) || b.batch_number?.toLowerCase().includes(q);
        });

    // Open add modal
    const openAdd = () => {
        setEditingBatch(null);
        setForm({
            pid: 0, product_name: '', batch_number: '', expiry_date: '',
            qty_received: 0, qty_remaining: 0, cost_price: 0, selling_price: 0,
            supplier_name: '', notes: '',
        });
        setShowModal(true);
    };

    // Open edit modal
    const openEdit = (b: Batch) => {
        setEditingBatch(b);
        setForm({
            pid: b.pid, product_name: b.product_name,
            batch_number: b.batch_number || '', expiry_date: b.expiry_date || '',
            qty_received: b.qty_received || 0, qty_remaining: b.qty_remaining || 0,
            cost_price: b.cost_price || 0, selling_price: b.selling_price || 0,
            supplier_name: b.supplier_name || '', notes: b.notes || '',
        });
        setShowModal(true);
    };

    // Save batch
    const saveBatch = async () => {
        if (!form.pid || !form.expiry_date) {
            toast.error('Select a product and set expiry date');
            return;
        }
        setIsSaving(true);
        try {
            const payload = {
                pid: form.pid,
                product_name: form.product_name,
                batch_number: form.batch_number || `B-${Date.now().toString(36).toUpperCase()}`,
                expiry_date: form.expiry_date,
                qty_received: form.qty_received,
                qty_remaining: form.qty_remaining,
                cost_price: form.cost_price,
                selling_price: form.selling_price,
                supplier_name: form.supplier_name,
                notes: form.notes,
                outlet_id: outletId,
                status: 'Active',
                updated_at: new Date().toISOString(),
            };

            if (editingBatch) {
                const { error } = await supabase.from('retail_product_batches')
                    .update(payload)
                    .eq('batch_id', editingBatch.batch_id);
                if (error) throw error;
                toast.success('Batch updated!');
            } else {
                const { error } = await supabase.from('retail_product_batches')
                    .insert({ ...payload, received_date: new Date().toISOString().split('T')[0] });
                if (error) throw error;
                toast.success('Batch created!');
            }
            setShowModal(false);
            loadData();
        } catch (err: any) {
            toast.error(err.message || 'Error saving batch');
        }
        setIsSaving(false);
    };

    // Delete batch
    const deleteBatch = async (b: Batch) => {
        if (!confirm(`Remove batch "${b.batch_number}" for ${b.product_name}?`)) return;
        await supabase.from('retail_product_batches')
            .update({ status: 'Removed' })
            .eq('batch_id', b.batch_id);
        toast.success('Batch removed');
        loadData();
    };

    // Badge helper
    const getBadge = (daysLeft: number) => {
        if (daysLeft <= 0) return { text: 'EXPIRED', bg: 'bg-red-600 text-white' };
        if (daysLeft <= 1) return { text: `${daysLeft}d - BLOCKED`, bg: 'bg-red-500 text-white' };
        if (daysLeft <= 2) return { text: `${daysLeft}d left ⚠️`, bg: 'bg-orange-500 text-white' };
        if (daysLeft <= 7) return { text: `${daysLeft}d left`, bg: 'bg-amber-100 text-amber-700' };
        return { text: `${daysLeft}d left`, bg: 'bg-emerald-100 text-emerald-700' };
    };

    if (!expiryEnabled) {
        return (
            <div className="flex flex-col items-center justify-center h-96 text-center" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
                <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center text-4xl mb-4">⏰</div>
                <h2 className="text-xl font-bold text-gray-700">Expiry Tracking Not Enabled</h2>
                <p className="text-gray-500 mt-2 max-w-md">
                    This outlet does not have expiry tracking enabled. Go to <strong>Outlets</strong> → Edit your outlet → Enable &quot;Expiry Tracking&quot; to use this feature.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-5" style={{ fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>

            {/* Add/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-md flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
                        <div className="bg-gradient-to-r from-orange-500 to-red-500 px-6 py-4 text-white rounded-t-3xl flex items-center justify-between">
                            <h2 className="text-lg font-bold flex items-center gap-2">⏰ {editingBatch ? 'Edit Batch' : 'Add Product Batch'}</h2>
                            <button onClick={() => setShowModal(false)} className="p-1 hover:bg-white/20 rounded-lg"><FiX size={18} /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Product *</label>
                                <select value={form.pid} onChange={e => {
                                    const pid = Number(e.target.value);
                                    const prod = products.find(p => p.pid === pid);
                                    setForm({
                                        ...form, pid,
                                        product_name: prod?.product_name || '',
                                        cost_price: prod?.purchase_cost || 0,
                                        selling_price: prod?.sales_cost || 0,
                                    });
                                }} className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:border-orange-500 outline-none">
                                    <option value={0}>Select product...</option>
                                    {products.map(p => <option key={p.pid} value={p.pid}>{p.product_name}</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Batch Number</label>
                                    <input type="text" value={form.batch_number} onChange={e => setForm({ ...form, batch_number: e.target.value })}
                                        placeholder="Auto-generated if empty"
                                        className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:border-orange-500 outline-none" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-red-500 uppercase mb-1 block">Expiry Date *</label>
                                    <input type="date" value={form.expiry_date} onChange={e => setForm({ ...form, expiry_date: e.target.value })}
                                        className="w-full px-3 py-2.5 bg-gray-50 border border-red-200 rounded-xl text-sm focus:border-red-500 outline-none" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Qty Received</label>
                                    <input type="number" value={form.qty_received} onChange={e => {
                                        const v = Number(e.target.value) || 0;
                                        setForm({ ...form, qty_received: v, qty_remaining: editingBatch ? form.qty_remaining : v });
                                    }} className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:border-orange-500 outline-none" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Qty Remaining</label>
                                    <input type="number" value={form.qty_remaining} onChange={e => setForm({ ...form, qty_remaining: Number(e.target.value) || 0 })}
                                        className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:border-orange-500 outline-none" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Cost Price</label>
                                    <input type="number" value={form.cost_price} onChange={e => setForm({ ...form, cost_price: Number(e.target.value) || 0 })}
                                        className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:border-orange-500 outline-none" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Selling Price</label>
                                    <input type="number" value={form.selling_price} onChange={e => setForm({ ...form, selling_price: Number(e.target.value) || 0 })}
                                        className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:border-orange-500 outline-none" />
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Supplier</label>
                                <input type="text" value={form.supplier_name} onChange={e => setForm({ ...form, supplier_name: e.target.value })}
                                    placeholder="e.g. Nairobi Bakeries"
                                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:border-orange-500 outline-none" />
                            </div>
                            <div className="flex gap-3 pt-3 border-t">
                                <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-3 border-2 border-gray-200 text-gray-600 font-bold rounded-xl text-sm">Cancel</button>
                                <button onClick={saveBatch} disabled={isSaving}
                                    className="flex-1 px-4 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold rounded-xl text-sm disabled:opacity-50">
                                    {isSaving ? 'Saving...' : editingBatch ? 'Update Batch' : 'Add Batch'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TOP BAR */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shadow-lg shadow-orange-300/40">
                        <span className="text-white text-2xl">⏰</span>
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">Expiry Register</h1>
                        <p className="text-gray-500 text-sm mt-1">Track product batch expiry dates — FEFO (First Expiry, First Out)</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={loadData} className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium flex items-center gap-2 text-sm"><FiRefreshCw size={14} /> Refresh</button>
                    <button onClick={openAdd} className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl font-semibold flex items-center gap-2 shadow-lg hover:shadow-xl transition-all text-sm">
                        <FiPlus size={16} /> Add Batch
                    </button>
                </div>
            </div>

            {/* STAT CARDS */}
            <div className="grid grid-cols-4 gap-4">
                {[
                    { label: 'Expired', value: expired.length, color: 'from-red-500 to-red-600', icon: '⛔', click: () => setFilter('expired') },
                    { label: 'Critical (≤1 day)', value: critical.length, color: 'from-orange-500 to-red-500', icon: '🔴', click: () => setFilter('critical') },
                    { label: 'Warning (≤7 days)', value: warning.length, color: 'from-amber-500 to-orange-500', icon: '🟠', click: () => setFilter('warning') },
                    { label: 'OK (7+ days)', value: ok.length, color: 'from-emerald-500 to-green-600', icon: '🟢', click: () => setFilter('ok') },
                ].map((s, i) => (
                    <button key={i} onClick={s.click}
                        className={`bg-white rounded-2xl p-5 border shadow-sm text-left relative overflow-hidden transition-all hover:shadow-md ${filter === ['all', 'expired', 'critical', 'warning', 'ok'][i + 1] ? 'ring-2 ring-blue-500' : 'border-gray-100'}`}>
                        <div className={`absolute top-0 right-0 w-20 h-20 bg-gradient-to-br ${s.color} opacity-10 rounded-bl-full`} />
                        <span className="text-2xl">{s.icon}</span>
                        <p className="text-2xl font-black text-gray-800 mt-2">{s.value}</p>
                        <p className="text-xs text-gray-500 font-medium">{s.label}</p>
                    </button>
                ))}
            </div>

            {/* Search + Filter */}
            <div className="flex gap-3">
                <div className="flex-1 relative">
                    <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search product or batch..."
                        className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:border-orange-500 outline-none shadow-sm" />
                </div>
                <button onClick={() => setFilter('all')}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${filter === 'all' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                    All ({batches.length})
                </button>
            </div>

            {/* BATCHES TABLE */}
            <div className="bg-white rounded-2xl border overflow-hidden shadow-sm">
                <table className="w-full">
                    <thead className="bg-gradient-to-r from-orange-500 to-red-500">
                        <tr>
                            <th className="text-left py-3 px-4 font-bold text-xs text-white">PRODUCT</th>
                            <th className="text-left py-3 px-4 font-bold text-xs text-white">BATCH #</th>
                            <th className="text-center py-3 px-4 font-bold text-xs text-white">EXPIRY DATE</th>
                            <th className="text-center py-3 px-4 font-bold text-xs text-white">DAYS LEFT</th>
                            <th className="text-center py-3 px-4 font-bold text-xs text-white">QTY</th>
                            <th className="text-right py-3 px-4 font-bold text-xs text-white">COST</th>
                            <th className="text-right py-3 px-4 font-bold text-xs text-white">SELL</th>
                            <th className="text-left py-3 px-4 font-bold text-xs text-white">SUPPLIER</th>
                            <th className="text-center py-3 px-4 font-bold text-xs text-white">ACTIONS</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <tr><td colSpan={9} className="py-16 text-center">
                                <div className="flex items-center justify-center gap-3">
                                    <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
                                    <span>Loading...</span>
                                </div>
                            </td></tr>
                        ) : filtered.length === 0 ? (
                            <tr><td colSpan={9} className="py-16 text-center text-gray-500">
                                <FiAlertTriangle size={32} className="mx-auto mb-3 opacity-30" />
                                <p className="font-medium">No batches found</p>
                                <p className="text-sm">Click &quot;Add Batch&quot; to track product expiry dates</p>
                            </td></tr>
                        ) : filtered.map(b => {
                            const badge = getBadge(b.daysLeft);
                            const rowBg = b.daysLeft <= 0 ? 'bg-red-50' : b.daysLeft <= 1 ? 'bg-red-50/50' : b.daysLeft <= 2 ? 'bg-orange-50' : b.daysLeft <= 7 ? 'bg-amber-50/50' : '';
                            return (
                                <tr key={b.batch_id} className={`border-t border-gray-100 hover:bg-blue-50/30 transition-colors ${rowBg}`}>
                                    <td className="py-3 px-4 font-semibold text-sm text-gray-800">{b.product_name}</td>
                                    <td className="py-3 px-4"><span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">{b.batch_number || '-'}</span></td>
                                    <td className="py-3 px-4 text-center text-sm">{new Date(b.expiry_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                                    <td className="py-3 px-4 text-center">
                                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${badge.bg}`}>{badge.text}</span>
                                    </td>
                                    <td className="py-3 px-4 text-center font-bold text-sm">{b.qty_remaining}</td>
                                    <td className="py-3 px-4 text-right text-sm text-gray-600">{(b.cost_price || 0).toLocaleString()}</td>
                                    <td className="py-3 px-4 text-right text-sm font-semibold text-blue-600">{(b.selling_price || 0).toLocaleString()}</td>
                                    <td className="py-3 px-4 text-sm text-gray-500">{b.supplier_name || '-'}</td>
                                    <td className="py-3 px-4 text-center">
                                        <div className="flex items-center justify-center gap-1">
                                            <button onClick={() => openEdit(b)} className="p-1.5 text-indigo-500 hover:bg-indigo-50 rounded-lg"><FiEdit3 size={14} /></button>
                                            <button onClick={() => deleteBatch(b)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"><FiTrash2 size={14} /></button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
