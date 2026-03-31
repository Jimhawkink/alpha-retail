'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';

interface SalesReturn {
    return_id: number;
    return_no: string;
    return_date: string;
    original_sale_id: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    total_amount: number;
    reason: string;
    status: string;
    processed_by: string;
}

export default function SalesReturnPage() {
    const [returns, setReturns] = useState<SalesReturn[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [formData, setFormData] = useState({ original_sale_id: '', product_name: '', quantity: 1, unit_price: 0, reason: 'Wrong Order' });
    const [isCashier, setIsCashier] = useState(false);
    const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

    // Check user role
    useEffect(() => {
        try {
            const userData = localStorage.getItem('user');
            if (userData) {
                const parsed = JSON.parse(userData);
                const role = (parsed.userType || '').toLowerCase();
                setIsCashier(['cashier', 'waiter'].includes(role));
            }
        } catch { /* ignore */ }
    }, []);

    const loadReturns = async () => {
        setIsLoading(true);
        const { data } = await supabase.from('sales_returns').select('*').order('return_id', { ascending: false });
        setReturns(data || []);
        setIsLoading(false);
    };

    useEffect(() => { loadReturns(); }, []);

    const generateReturnNo = async () => {
        const { data } = await supabase.from('sales_returns').select('return_no').order('return_id', { ascending: false }).limit(1);
        if (data && data.length > 0) {
            const match = data[0].return_no.match(/SR-(\d+)/);
            if (match) return `SR-${String(parseInt(match[1]) + 1).padStart(4, '0')}`;
        }
        return 'SR-0001';
    };

    const handleSave = async () => {
        if (!formData.product_name || formData.quantity <= 0) { toast.error('Fill required fields'); return; }
        setIsSaving(true);
        const returnNo = await generateReturnNo();
        const userData = localStorage.getItem('user');
        const user = userData ? JSON.parse(userData) : null;
        const { error } = await supabase.from('sales_returns').insert({
            return_no: returnNo,
            return_date: new Date().toISOString().split('T')[0],
            original_sale_id: formData.original_sale_id,
            product_name: formData.product_name,
            quantity: formData.quantity,
            unit_price: formData.unit_price,
            total_amount: formData.quantity * formData.unit_price,
            reason: formData.reason,
            status: 'Completed',
            processed_by: user?.name || 'Admin'
        });
        if (error) toast.error('Failed'); else {
            toast.success('Return processed!');
            setShowModal(false);
            setFormData({ original_sale_id: '', product_name: '', quantity: 1, unit_price: 0, reason: 'Wrong Order' });
            loadReturns();
        }
        setIsSaving(false);
    };

    const handleDelete = async (returnId: number) => {
        const { error } = await supabase.from('sales_returns').delete().eq('return_id', returnId);
        if (error) toast.error('Failed to delete');
        else { toast.success('Return deleted'); loadReturns(); }
        setDeleteConfirmId(null);
    };

    const totalReturns = returns.reduce((sum, r) => sum + (r.total_amount || 0), 0);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
                    <span className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl flex items-center justify-center text-white text-2xl">↩️</span>
                    Sales Returns
                </h1>
                <button onClick={() => setShowModal(true)} className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all flex items-center gap-2">➕ New Return</button>
            </div>

            <div className="grid grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl p-5 text-white shadow-lg shadow-orange-200/50"><span className="text-3xl">↩️</span><p className="text-sm opacity-80 mt-2">Total Returns</p><p className="text-3xl font-bold">{returns.length}</p></div>
                <div className="bg-gradient-to-br from-rose-500 to-pink-600 rounded-2xl p-5 text-white shadow-lg shadow-rose-200/50"><span className="text-3xl">💰</span><p className="text-sm opacity-80 mt-2">Return Value</p><p className="text-3xl font-bold">Ksh {totalReturns.toLocaleString()}</p></div>
                <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-5 text-white shadow-lg shadow-green-200/50"><span className="text-3xl">✅</span><p className="text-sm opacity-80 mt-2">Completed</p><p className="text-3xl font-bold">{returns.filter(r => r.status === 'Completed').length}</p></div>
            </div>

            <div className="bg-white rounded-2xl border overflow-hidden shadow-sm">
                <table className="w-full">
                    <thead className="bg-gradient-to-r from-orange-50 to-red-50">
                        <tr>
                            <th className="text-left py-4 px-4 font-bold text-xs uppercase tracking-wider text-gray-500">Return #</th>
                            <th className="text-left py-4 px-4 font-bold text-xs uppercase tracking-wider text-gray-500">Date</th>
                            <th className="text-left py-4 px-4 font-bold text-xs uppercase tracking-wider text-gray-500">Original Sale</th>
                            <th className="text-left py-4 px-4 font-bold text-xs uppercase tracking-wider text-gray-500">Product</th>
                            <th className="text-center py-4 px-4 font-bold text-xs uppercase tracking-wider text-gray-500">Qty</th>
                            <th className="text-right py-4 px-4 font-bold text-xs uppercase tracking-wider text-gray-500">Amount</th>
                            <th className="text-left py-4 px-4 font-bold text-xs uppercase tracking-wider text-gray-500">Reason</th>
                            <th className="text-center py-4 px-4 font-bold text-xs uppercase tracking-wider text-gray-500">Status</th>
                            <th className="text-left py-4 px-4 font-bold text-xs uppercase tracking-wider text-gray-500">By</th>
                            {!isCashier && <th className="text-center py-4 px-4 font-bold text-xs uppercase tracking-wider text-gray-500">Action</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? <tr><td colSpan={isCashier ? 9 : 10} className="py-16 text-center text-gray-400">Loading...</td></tr> :
                            returns.length === 0 ? <tr><td colSpan={isCashier ? 9 : 10} className="py-16 text-center text-gray-500">No returns</td></tr> :
                                returns.map(r => (
                                    <tr key={r.return_id} className="border-t hover:bg-orange-50/30 transition-colors">
                                        <td className="py-3 px-4"><span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-lg font-semibold text-sm">{r.return_no}</span></td>
                                        <td className="py-3 px-4 text-sm text-gray-600">{new Date(r.return_date).toLocaleDateString()}</td>
                                        <td className="py-3 px-4 text-gray-600 text-sm">{r.original_sale_id || '-'}</td>
                                        <td className="py-3 px-4 font-medium text-sm">{r.product_name}</td>
                                        <td className="py-3 px-4 text-center text-sm font-semibold">{r.quantity}</td>
                                        <td className="py-3 px-4 text-right font-bold text-red-600 text-sm">Ksh {r.total_amount?.toLocaleString()}</td>
                                        <td className="py-3 px-4 text-sm text-gray-600">{r.reason}</td>
                                        <td className="py-3 px-4 text-center"><span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">{r.status}</span></td>
                                        <td className="py-3 px-4 text-xs text-gray-500">{r.processed_by}</td>
                                        {!isCashier && (
                                            <td className="py-3 px-4 text-center">
                                                {deleteConfirmId === r.return_id ? (
                                                    <div className="flex items-center justify-center gap-1">
                                                        <button onClick={() => handleDelete(r.return_id)} className="px-2 py-1 bg-red-500 text-white rounded text-xs font-bold hover:bg-red-600">Yes</button>
                                                        <button onClick={() => setDeleteConfirmId(null)} className="px-2 py-1 bg-gray-200 text-gray-600 rounded text-xs font-bold hover:bg-gray-300">No</button>
                                                    </div>
                                                ) : (
                                                    <button onClick={() => setDeleteConfirmId(r.return_id)} className="px-2.5 py-1 bg-red-50 text-red-500 rounded-lg text-xs font-semibold hover:bg-red-100 transition-colors">🗑️ Delete</button>
                                                )}
                                            </td>
                                        )}
                                    </tr>
                                ))}
                    </tbody>
                </table>
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl">
                        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">↩️ New Sales Return</h2>
                        <div className="space-y-4">
                            <div><label className="text-sm text-gray-600 font-medium block mb-1">Original Sale ID</label><input value={formData.original_sale_id} onChange={e => setFormData({ ...formData, original_sale_id: e.target.value })} className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-300 focus:outline-none" placeholder="e.g. INV-0001" /></div>
                            <div><label className="text-sm text-gray-600 font-medium block mb-1">Product Name *</label><input value={formData.product_name} onChange={e => setFormData({ ...formData, product_name: e.target.value })} className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-300 focus:outline-none" /></div>
                            <div className="grid grid-cols-2 gap-3">
                                <div><label className="text-sm text-gray-600 font-medium block mb-1">Quantity *</label><input type="number" value={formData.quantity} onChange={e => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })} className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-300 focus:outline-none" /></div>
                                <div><label className="text-sm text-gray-600 font-medium block mb-1">Unit Price</label><input type="number" value={formData.unit_price} onChange={e => setFormData({ ...formData, unit_price: parseFloat(e.target.value) || 0 })} className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-300 focus:outline-none" /></div>
                            </div>
                            <div>
                                <label className="text-sm text-gray-600 font-medium block mb-1">Reason</label>
                                <select value={formData.reason} onChange={e => setFormData({ ...formData, reason: e.target.value })} className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-300 focus:outline-none">
                                    <option>Wrong Order</option><option>Quality Issue</option><option>Overcharge</option><option>Customer Request</option><option>Expired Product</option><option>Damaged Product</option><option>Other</option>
                                </select>
                            </div>
                            {formData.quantity > 0 && formData.unit_price > 0 && (
                                <div className="bg-orange-50 rounded-xl p-3 border border-orange-200">
                                    <p className="text-sm text-orange-700 font-medium">Return Total: <strong>Ksh {(formData.quantity * formData.unit_price).toLocaleString()}</strong></p>
                                </div>
                            )}
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button onClick={() => setShowModal(false)} className="flex-1 py-3 border-2 border-gray-200 rounded-xl font-semibold text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
                            <button onClick={handleSave} disabled={isSaving} className="flex-1 py-3 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50">{isSaving ? 'Processing...' : '✅ Process Return'}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
