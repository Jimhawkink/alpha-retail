'use client';

import { useState, useEffect } from 'react';
import { useCompanyName } from '@/context/SettingsContext';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';

interface Sale {
    sale_id: number;
    receipt_no: string;
    sale_date: string;
    sale_datetime: string;
    customer_name: string;
    customer_phone: string;
    subtotal: number;
    discount: number;
    total_amount: number;
    payment_method: string;
    amount_paid: number;
    change_amount: number;
    mpesa_code: string;
    checkout_request_id: string;
    status: string;
}

export default function SalesPage() {
    const [sales, setSales] = useState<Sale[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
    const [filterPayment, setFilterPayment] = useState('All');
    const [showReceiptModal, setShowReceiptModal] = useState(false);
    const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
    const companyName = useCompanyName();

    // Load sales from database
    const loadSales = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('retail_sales')
                .select('*')
                .eq('sale_date', filterDate)
                .order('sale_datetime', { ascending: false });

            if (error) throw error;
            setSales(data || []);
        } catch (err) {
            console.error('Error loading sales:', err);
            toast.error('Failed to load sales');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadSales();
    }, [filterDate]);

    const filteredSales = sales.filter(s => {
        const matchesSearch =
            (s.receipt_no || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (s.customer_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (s.customer_phone || '').includes(searchQuery) ||
            (s.mpesa_code || '').toLowerCase().includes(searchQuery.toLowerCase());
        const matchesPayment = filterPayment === 'All' || (s.payment_method || '').toUpperCase() === filterPayment.toUpperCase();
        return matchesSearch && matchesPayment;
    });

    const totalRevenue = filteredSales.reduce((sum, s) => sum + (s.total_amount || 0), 0);
    const cashTotal = filteredSales.filter(s => (s.payment_method || '').toUpperCase() === 'CASH').reduce((sum, s) => sum + (s.total_amount || 0), 0);
    const mpesaTotal = filteredSales.filter(s => (s.payment_method || '').toUpperCase() === 'MPESA' || (s.payment_method || '').toUpperCase() === 'M-PESA').reduce((sum, s) => sum + (s.total_amount || 0), 0);
    const creditTotal = filteredSales.filter(s => (s.payment_method || '').toUpperCase() === 'CREDIT').reduce((sum, s) => sum + (s.total_amount || 0), 0);

    const viewReceipt = (sale: Sale) => {
        setSelectedSale(sale);
        setShowReceiptModal(true);
    };

    const formatTime = (datetime: string) => {
        if (!datetime) return '';
        const date = new Date(datetime);
        return date.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <span>💰</span> Sales & Transactions
                    </h1>
                    <p className="text-sm text-gray-500">View all sales across your store</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={loadSales}
                        className="flex items-center gap-2 px-4 py-2.5 bg-blue-500 text-white rounded-xl hover:bg-blue-600 font-medium transition-colors"
                    >
                        <span>🔄</span> Refresh
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 font-medium">
                        <span>📥</span> Export
                    </button>
                </div>
            </div>

            {/* Stats Cards - Colorful Gradients like Energy App */}
            <div className="grid grid-cols-4 gap-4">
                {/* Total Sales - Blue/Purple Gradient */}
                <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                            <span className="text-2xl">📊</span>
                        </div>
                        <div>
                            <p className="text-sm opacity-90 font-medium">Total Sales</p>
                            <p className="text-xl font-bold">Ksh {totalRevenue.toLocaleString()}</p>
                        </div>
                    </div>
                    <p className="text-xs opacity-80 mt-2">{filteredSales.length} transactions</p>
                </div>

                {/* M-Pesa - Green Gradient */}
                <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-6 text-white shadow-lg">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                            <span className="text-2xl">📱</span>
                        </div>
                        <div>
                            <p className="text-sm opacity-90 font-medium">M-Pesa</p>
                            <p className="text-xl font-bold">Ksh {mpesaTotal.toLocaleString()}</p>
                        </div>
                    </div>
                    <p className="text-xs opacity-80 mt-2">Mobile payments</p>
                </div>

                {/* Cash - Orange Gradient */}
                <div className="bg-gradient-to-br from-orange-500 to-amber-600 rounded-2xl p-6 text-white shadow-lg">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                            <span className="text-2xl">💵</span>
                        </div>
                        <div>
                            <p className="text-sm opacity-90 font-medium">Cash</p>
                            <p className="text-xl font-bold">Ksh {cashTotal.toLocaleString()}</p>
                        </div>
                    </div>
                    <p className="text-xs opacity-80 mt-2">Cash payments</p>
                </div>

                {/* Credit - Cyan Gradient */}
                <div className="bg-gradient-to-br from-cyan-500 to-blue-500 rounded-2xl p-6 text-white shadow-lg">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                            <span className="text-2xl">💳</span>
                        </div>
                        <div>
                            <p className="text-sm opacity-90 font-medium">Credit</p>
                            <p className="text-xl font-bold">Ksh {creditTotal.toLocaleString()}</p>
                        </div>
                    </div>
                    <p className="text-xs opacity-80 mt-2">Credit sales</p>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="flex-1 relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search receipt, customer, phone, M-Pesa code..."
                            className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-400 text-sm"
                        />
                    </div>
                    <input
                        type="date"
                        value={filterDate}
                        onChange={(e) => setFilterDate(e.target.value)}
                        className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-400 text-sm"
                    />
                    <select
                        value={filterPayment}
                        onChange={(e) => setFilterPayment(e.target.value)}
                        className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-400 text-sm"
                    >
                        <option value="All">All Payments</option>
                        <option value="Cash">Cash</option>
                        <option value="MPESA">M-Pesa</option>
                        <option value="Credit">Credit</option>
                    </select>
                </div>
            </div>

            {/* Sales Table */}
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                {loading ? (
                    <div className="p-12 text-center text-gray-500">
                        <div className="animate-spin text-3xl mb-3">⏳</div>
                        <p className="text-sm">Loading sales...</p>
                    </div>
                ) : filteredSales.length === 0 ? (
                    <div className="p-12 text-center text-gray-500">
                        <div className="text-4xl mb-3">📭</div>
                        <p className="text-sm">No sales found for selected date</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                                <tr>
                                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Receipt</th>
                                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Time</th>
                                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Customer</th>
                                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Phone</th>
                                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Payment</th>
                                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">M-Pesa Code</th>
                                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Amount</th>
                                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Status</th>
                                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredSales.map(sale => (
                                    <tr key={sale.sale_id} className="border-t border-gray-100 hover:bg-blue-50 transition-colors">
                                        <td className="py-3 px-4">
                                            <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium">
                                                {sale.receipt_no || '-'}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-sm text-gray-600">
                                            {formatTime(sale.sale_datetime)}
                                        </td>
                                        <td className="py-3 px-4 text-sm font-medium text-gray-800">
                                            {sale.customer_name || 'Walk-in'}
                                        </td>
                                        <td className="py-3 px-4 text-sm text-gray-600">
                                            {sale.customer_phone || '-'}
                                        </td>
                                        <td className="py-3 px-4">
                                            <span className={`px-3 py-1 rounded-lg text-sm font-medium ${(sale.payment_method || '').toUpperCase() === 'CASH' ? 'bg-yellow-100 text-yellow-700' :
                                                (sale.payment_method || '').toUpperCase() === 'MPESA' || (sale.payment_method || '').toUpperCase() === 'M-PESA' ? 'bg-green-100 text-green-700' :
                                                    'bg-orange-100 text-orange-700'
                                                }`}>
                                                {sale.payment_method || '-'}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4">
                                            {sale.mpesa_code ? (
                                                <span className="px-3 py-1 bg-green-50 text-green-700 rounded-lg text-sm font-mono font-semibold">
                                                    {sale.mpesa_code}
                                                </span>
                                            ) : (
                                                <span className="text-gray-400 text-sm">-</span>
                                            )}
                                        </td>
                                        <td className="py-3 px-4 text-right font-bold text-gray-900 text-sm">
                                            Ksh {(sale.total_amount || 0).toLocaleString()}
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                            <span className={`px-3 py-1 rounded-lg text-sm font-medium ${sale.status === 'Completed' ? 'bg-green-100 text-green-700' :
                                                sale.status === 'Credit' ? 'bg-yellow-100 text-yellow-700' :
                                                    'bg-red-100 text-red-700'
                                                }`}>
                                                {sale.status === 'Completed' ? '✅' : sale.status === 'Credit' ? '🔄' : '❌'} {sale.status}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4">
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    onClick={() => viewReceipt(sale)}
                                                    className="p-2 hover:bg-blue-100 rounded-lg text-blue-600 transition-colors"
                                                    title="View Receipt"
                                                >
                                                    👁️
                                                </button>
                                                <button className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors" title="Print">
                                                    🖨️
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Receipt Modal */}
            {showReceiptModal && selectedSale && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
                        <div className="text-center border-b border-dashed border-gray-300 pb-4 mb-4">
                            <h2 className="text-xl font-bold text-gray-800">{companyName}</h2>
                            <p className="text-sm text-gray-500">Sales Receipt</p>
                        </div>

                        <div className="space-y-2 text-sm mb-4">
                            <div className="flex justify-between">
                                <span className="text-gray-600">Receipt:</span>
                                <span className="font-semibold">{selectedSale.receipt_no}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">Date/Time:</span>
                                <span>{new Date(selectedSale.sale_datetime).toLocaleString('en-KE')}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">Customer:</span>
                                <span>{selectedSale.customer_name || 'Walk-in'}</span>
                            </div>
                            {selectedSale.customer_phone && (
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Phone:</span>
                                    <span className="font-mono">{selectedSale.customer_phone}</span>
                                </div>
                            )}
                            <div className="flex justify-between">
                                <span className="text-gray-600">Payment:</span>
                                <span className="font-medium">{selectedSale.payment_method}</span>
                            </div>
                            {selectedSale.mpesa_code && (
                                <div className="flex justify-between">
                                    <span className="text-gray-600">M-Pesa Code:</span>
                                    <span className="font-mono text-green-600 font-semibold">{selectedSale.mpesa_code}</span>
                                </div>
                            )}
                        </div>

                        <div className="border-t border-dashed border-gray-300 pt-4 mb-4">
                            <div className="flex justify-between text-lg font-bold">
                                <span>Total:</span>
                                <span className="text-blue-600">Ksh {(selectedSale.total_amount || 0).toLocaleString()}</span>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowReceiptModal(false)}
                                className="flex-1 py-3 border-2 border-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
                            >
                                Close
                            </button>
                            <button className="flex-1 py-3 bg-gradient-to-r from-blue-500 to-blue-700 text-white rounded-xl font-semibold hover:shadow-lg transition-all flex items-center justify-center gap-2">
                                <span>🖨️</span> Print
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
