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
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <span>📋</span> Sales Records
                    </h1>
                    <p className="text-xs text-gray-500">View and manage all sales transactions</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={loadSales}
                        className="flex items-center gap-1 px-3 py-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-xs"
                    >
                        <span>🔄</span> Refresh
                    </button>
                    <button className="flex items-center gap-1 px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-xs">
                        <span>📥</span> Export
                    </button>
                </div>
            </div>

            {/* Stats - Compact */}
            <div className="grid grid-cols-4 gap-3">
                <div className="bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl p-3 text-white">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm">💰</span>
                        <span className="text-xs opacity-90">Total Revenue</span>
                    </div>
                    <p className="text-lg font-bold">Ksh {totalRevenue.toLocaleString()}</p>
                    <p className="text-[10px] opacity-80">{filteredSales.length} transactions</p>
                </div>
                <div className="bg-white rounded-xl p-3 border border-gray-100">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm">💵</span>
                        <span className="text-xs text-yellow-600">Cash</span>
                    </div>
                    <p className="text-sm font-bold text-gray-800">Ksh {cashTotal.toLocaleString()}</p>
                </div>
                <div className="bg-white rounded-xl p-3 border border-gray-100">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm">📱</span>
                        <span className="text-xs text-green-600">M-Pesa</span>
                    </div>
                    <p className="text-sm font-bold text-gray-800">Ksh {mpesaTotal.toLocaleString()}</p>
                </div>
                <div className="bg-white rounded-xl p-3 border border-gray-100">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm">💳</span>
                        <span className="text-xs text-orange-600">Credit</span>
                    </div>
                    <p className="text-sm font-bold text-gray-800">Ksh {creditTotal.toLocaleString()}</p>
                </div>
            </div>

            {/* Filters - Compact */}
            <div className="bg-white rounded-xl p-3 border border-gray-100">
                <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search receipt, customer, phone, M-Pesa code..."
                            className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 text-xs"
                        />
                    </div>
                    <input
                        type="date"
                        value={filterDate}
                        onChange={(e) => setFilterDate(e.target.value)}
                        className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 text-xs"
                    />
                    <select
                        value={filterPayment}
                        onChange={(e) => setFilterPayment(e.target.value)}
                        className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 text-xs"
                    >
                        <option value="All">All Payments</option>
                        <option value="Cash">Cash</option>
                        <option value="MPESA">M-Pesa</option>
                        <option value="Credit">Credit</option>
                    </select>
                </div>
            </div>

            {/* Sales Table - Compact with small fonts */}
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-gray-500">
                        <div className="animate-spin text-2xl mb-2">⏳</div>
                        <p className="text-xs">Loading sales...</p>
                    </div>
                ) : filteredSales.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                        <div className="text-2xl mb-2">📭</div>
                        <p className="text-xs">No sales found for selected date</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="text-left py-2 px-2 font-semibold text-gray-600">Receipt</th>
                                    <th className="text-left py-2 px-2 font-semibold text-gray-600">Time</th>
                                    <th className="text-left py-2 px-2 font-semibold text-gray-600">Customer</th>
                                    <th className="text-left py-2 px-2 font-semibold text-gray-600">Phone</th>
                                    <th className="text-left py-2 px-2 font-semibold text-gray-600">Payment</th>
                                    <th className="text-left py-2 px-2 font-semibold text-gray-600">M-Pesa Code</th>
                                    <th className="text-right py-2 px-2 font-semibold text-gray-600">Amount</th>
                                    <th className="text-center py-2 px-2 font-semibold text-gray-600">Status</th>
                                    <th className="text-center py-2 px-2 font-semibold text-gray-600">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredSales.map(sale => (
                                    <tr key={sale.sale_id} className="border-t border-gray-50 hover:bg-gray-50 transition-colors">
                                        <td className="py-2 px-2">
                                            <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] font-medium">
                                                {sale.receipt_no || '-'}
                                            </span>
                                        </td>
                                        <td className="py-2 px-2 text-gray-600">
                                            {formatTime(sale.sale_datetime)}
                                        </td>
                                        <td className="py-2 px-2 text-gray-800">
                                            {sale.customer_name || 'Walk-in'}
                                        </td>
                                        <td className="py-2 px-2 text-gray-600">
                                            {sale.customer_phone || '-'}
                                        </td>
                                        <td className="py-2 px-2">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${(sale.payment_method || '').toUpperCase() === 'CASH' ? 'bg-yellow-100 text-yellow-700' :
                                                    (sale.payment_method || '').toUpperCase() === 'MPESA' || (sale.payment_method || '').toUpperCase() === 'M-PESA' ? 'bg-green-100 text-green-700' :
                                                        'bg-orange-100 text-orange-700'
                                                }`}>
                                                {sale.payment_method || '-'}
                                            </span>
                                        </td>
                                        <td className="py-2 px-2">
                                            {sale.mpesa_code ? (
                                                <span className="px-2 py-0.5 bg-green-50 text-green-700 rounded text-[10px] font-mono">
                                                    {sale.mpesa_code}
                                                </span>
                                            ) : (
                                                <span className="text-gray-400">-</span>
                                            )}
                                        </td>
                                        <td className="py-2 px-2 text-right font-semibold text-gray-800">
                                            Ksh {(sale.total_amount || 0).toLocaleString()}
                                        </td>
                                        <td className="py-2 px-2 text-center">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${sale.status === 'Completed' ? 'bg-green-100 text-green-700' :
                                                    sale.status === 'Credit' ? 'bg-yellow-100 text-yellow-700' :
                                                        'bg-red-100 text-red-700'
                                                }`}>
                                                {sale.status === 'Completed' ? '✅' : sale.status === 'Credit' ? '🔄' : '❌'} {sale.status}
                                            </span>
                                        </td>
                                        <td className="py-2 px-2">
                                            <div className="flex items-center justify-center gap-1">
                                                <button
                                                    onClick={() => viewReceipt(sale)}
                                                    className="p-1 hover:bg-blue-50 rounded text-blue-500"
                                                    title="View Receipt"
                                                >
                                                    👁️
                                                </button>
                                                <button className="p-1 hover:bg-gray-100 rounded text-gray-500" title="Print">
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

            {/* Receipt Modal - Compact */}
            {showReceiptModal && selectedSale && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl p-4 w-full max-w-xs shadow-2xl">
                        <div className="text-center border-b border-dashed border-gray-300 pb-3 mb-3">
                            <h2 className="text-sm font-bold text-gray-800">{companyName}</h2>
                            <p className="text-[10px] text-gray-500">Sales Receipt</p>
                        </div>

                        <div className="space-y-1 text-xs mb-3">
                            <div className="flex justify-between">
                                <span className="text-gray-500">Receipt:</span>
                                <span className="font-semibold">{selectedSale.receipt_no}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Date/Time:</span>
                                <span>{new Date(selectedSale.sale_datetime).toLocaleString('en-KE')}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Customer:</span>
                                <span>{selectedSale.customer_name || 'Walk-in'}</span>
                            </div>
                            {selectedSale.customer_phone && (
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Phone:</span>
                                    <span>{selectedSale.customer_phone}</span>
                                </div>
                            )}
                            <div className="flex justify-between">
                                <span className="text-gray-500">Payment:</span>
                                <span>{selectedSale.payment_method}</span>
                            </div>
                            {selectedSale.mpesa_code && (
                                <div className="flex justify-between">
                                    <span className="text-gray-500">M-Pesa Code:</span>
                                    <span className="font-mono text-green-600">{selectedSale.mpesa_code}</span>
                                </div>
                            )}
                        </div>

                        <div className="border-t border-dashed border-gray-300 pt-3 mb-3">
                            <div className="flex justify-between text-sm font-bold">
                                <span>Total:</span>
                                <span className="text-blue-600">Ksh {(selectedSale.total_amount || 0).toLocaleString()}</span>
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={() => setShowReceiptModal(false)}
                                className="flex-1 py-2 border-2 border-gray-200 text-gray-600 rounded-lg text-xs font-semibold hover:bg-gray-50"
                            >
                                Close
                            </button>
                            <button className="flex-1 py-2 bg-gradient-to-r from-blue-500 to-blue-700 text-white rounded-lg text-xs font-semibold hover:shadow-lg flex items-center justify-center gap-1">
                                <span>🖨️</span> Print
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
