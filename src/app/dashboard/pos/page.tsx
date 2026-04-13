'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';
import toast from 'react-hot-toast';
import { printMpesaReceipt, printCustomerReceipt, ReceiptData, loadCompanyInfo } from '@/lib/receiptPrinter';

// Types for Retail POS
interface Product {
    id: number;
    name: string;
    barcode: string;
    category: string;
    availableQty: number;
    costPrice: number;
    salesPrice: number;
    retailPrice?: number;
    color?: string;
    imageUrl?: string;
    salesUnit?: string;
    purchaseUnit?: string;
    piecesPerPackage?: number;
    bagQty?: number;
    pieceQty?: number;
}

interface CartItem extends Product {
    qty: number;
    discount: number;
    sellingUnit: string;       // Which unit the cashier chose (Kg, Bag, Piece, etc.)
    unitMultiplier: number;    // How many sales units per selling unit (1 for Kg, 50 for Bag)
    effectivePrice: number;    // Price per selling unit (140 for Kg, 7000 for Bag)
}

interface Category {
    category_id: number;
    category_name: string;
    icon: string;
    color: string;
}

interface CreditCustomer {
    customer_id: number;
    customer_code: string;
    customer_name: string;
    phone: string;
    current_balance: number;
    credit_limit: number;
}

// Product Search DataGrid Row
const ProductRow = ({
    product,
    isSelected,
    onClick,
    onDoubleClick
}: {
    product: Product;
    isSelected: boolean;
    onClick: () => void;
    onDoubleClick: () => void;
}) => (
    <tr
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        className={`cursor-pointer transition-all border-b border-gray-100 ${isSelected
            ? 'bg-blue-50 border-l-4 border-l-blue-500'
            : 'hover:bg-gray-50'
            }`}
    >
        <td className="px-4 py-3">
            <p className="font-semibold text-gray-800">{product.name}</p>
        </td>
        <td className="px-4 py-3 font-mono text-sm text-gray-600">
            {product.barcode || '-'}
        </td>
        <td className="px-4 py-3 text-center">
            <div className="flex flex-col items-center gap-0.5">
                {(product.bagQty || 0) > 0 && (
                    <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-100 text-indigo-700">📦 {product.bagQty} {product.purchaseUnit}</span>
                )}
                <span className={`inline-block min-w-[36px] px-2 py-0.5 rounded-md text-[10px] font-bold ${(product.pieceQty || 0) > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>🔢 {product.pieceQty || 0} {product.salesUnit}</span>
            </div>
        </td>
        <td className="px-4 py-3 text-right text-gray-600">
            {product.costPrice.toLocaleString()}
        </td>
        <td className="px-4 py-3 text-right font-bold text-green-600">
            {product.salesPrice.toLocaleString()}
        </td>
        <td className="px-4 py-3 text-center">
            <button
                onClick={(e) => { e.stopPropagation(); onDoubleClick(); }}
                className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"
            >
                + Add
            </button>
        </td>
    </tr>
);

// Cart Item Row Component — qty is clickable to type a custom number
const CartItemRow = ({
    item,
    onIncrease,
    onDecrease,
    onRemove,
    onEditDiscount,
    onSetQty,
    canDiscount = true
}: {
    item: CartItem;
    onIncrease: () => void;
    onDecrease: () => void;
    onRemove: () => void;
    onEditDiscount: () => void;
    onSetQty: (qty: number) => void;
    canDiscount?: boolean;
}) => {
    const [editingQty, setEditingQty] = useState(false);
    const [qtyInput, setQtyInput] = useState(item.qty.toString());
    const itemTotal = (item.effectivePrice * item.qty) - item.discount;

    const handleQtySubmit = () => {
        const newQty = parseInt(qtyInput) || 1;
        if (newQty > 0) onSetQty(newQty);
        setEditingQty(false);
    };

    return (
        <div className="bg-white rounded-xl p-3 space-y-2 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 text-sm truncate">{item.name}</p>
                    <p className="text-xs text-gray-500">@ Ksh {item.effectivePrice.toLocaleString()} / {item.sellingUnit || item.salesUnit || 'Pc'}</p>
                    {item.unitMultiplier > 1 && (
                        <p className="text-[10px] text-purple-500 font-medium">📦 1 {item.sellingUnit} = {item.unitMultiplier} {item.salesUnit}</p>
                    )}
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={onDecrease}
                        className="w-8 h-8 rounded-lg bg-orange-500 hover:bg-orange-600 flex items-center justify-center font-bold text-white transition-colors text-lg shadow-sm"
                    >
                        −
                    </button>
                    {editingQty ? (
                        <input
                            type="number"
                            value={qtyInput}
                            onChange={(e) => setQtyInput(e.target.value)}
                            onBlur={handleQtySubmit}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleQtySubmit(); }}
                            className="w-16 text-center font-bold text-gray-800 border-2 border-blue-400 rounded-lg py-1 text-sm focus:outline-none focus:border-blue-600"
                            autoFocus
                            min={1}
                        />
                    ) : (
                        <button
                            onClick={() => { setQtyInput(item.qty.toString()); setEditingQty(true); }}
                            className="w-10 text-center font-bold text-gray-800 hover:bg-blue-100 rounded-lg py-1 cursor-pointer transition-colors border border-transparent hover:border-blue-300"
                            title="Click to type quantity"
                        >
                            {item.qty}
                        </button>
                    )}
                    <button
                        onClick={onIncrease}
                        className="w-8 h-8 rounded-lg bg-green-500 hover:bg-green-600 flex items-center justify-center font-bold text-white transition-colors text-lg shadow-sm"
                    >
                        +
                    </button>
                </div>
                <div className="text-right min-w-[80px]">
                    <p className="font-bold text-gray-800">{itemTotal.toLocaleString()}</p>
                    {item.discount > 0 && (
                        <p className="text-xs text-green-600">-{item.discount.toLocaleString()}</p>
                    )}
                </div>
                <button
                    onClick={onRemove}
                    className="w-8 h-8 rounded-lg bg-red-50 hover:bg-red-100 flex items-center justify-center text-red-500 transition-colors"
                >
                    ✕
                </button>
            </div>
            {canDiscount && (
                <button
                    onClick={onEditDiscount}
                    className="w-full py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600 transition-colors font-medium"
                >
                    💰 Discount
                </button>
            )}
        </div>
    );
};

// Category Button Component
const CategoryButton = ({
    category,
    isSelected,
    onClick
}: {
    category: Category;
    isSelected: boolean;
    onClick: () => void;
}) => (
    <button
        onClick={onClick}
        className={`flex flex-col items-center justify-center p-4 rounded-xl transition-all ${isSelected
            ? 'bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-lg scale-105'
            : 'bg-white border-2 border-gray-200 text-gray-700 hover:border-blue-400 hover:shadow-md'
            }`}
        style={{ minWidth: '100px' }}
    >
        <span className="text-2xl mb-1">{category.icon || '📦'}</span>
        <span className="text-xs font-semibold text-center line-clamp-2">{category.category_name}</span>
    </button>
);

// Product Card - Fixed Height, Compact Design
const ProductCard = ({ product, onAdd }: { product: Product; onAdd: () => void }) => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow h-[240px] flex flex-col" title={product.name}>
        {/* Image - Fixed 110px */}
        <div className="h-[110px] bg-gray-50 flex items-center justify-center flex-shrink-0">
            {product.imageUrl ? (
                <img src={product.imageUrl} alt={product.name} className="max-h-[100px] max-w-[100px] object-contain" onError={(e) => { (e.target as HTMLImageElement).src = '/no-image.png'; }} />
            ) : (
                <img src="/no-image.png" alt="No image" className="h-[100px] w-[100px] object-contain" />
            )}
        </div>
        {/* Content */}
        <div className="flex-1 p-2 flex flex-col">
            <h3 className="text-[12px] font-medium text-gray-800 line-clamp-1 cursor-default" title={product.name}>{product.name}</h3>
            <p className="text-[9px] text-gray-400 truncate" title={`SKU: ${product.barcode || product.id}`}>SKU: {product.barcode || product.id}</p>
            <div className="h-[18px] flex items-center">
                <span className="px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded text-[8px]">{product.category || 'General'}</span>
            </div>
            <div className="flex-1"></div>
            <div className="flex items-center gap-2 mb-2">
                <span className="text-[15px] font-bold text-gray-900">Ksh {product.salesPrice.toLocaleString()}</span>
                <div className="flex flex-col gap-0.5">
                    {(product.bagQty || 0) > 0 && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-100 text-indigo-700">📦 {product.bagQty} {product.purchaseUnit}</span>
                    )}
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${(product.pieceQty || 0) > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>🔢 {product.pieceQty || 0} {product.salesUnit}</span>
                </div>
            </div>
            <button onClick={(e) => { e.stopPropagation(); if (product.availableQty > 0) onAdd(); }} disabled={product.availableQty === 0}
                className={`w-full py-1.5 rounded-lg text-[11px] font-medium flex items-center justify-center gap-1 ${product.availableQty === 0 ? 'bg-gray-100 text-gray-400' : 'bg-emerald-500 text-white hover:bg-emerald-600 active:scale-[0.98]'}`}>
                + Add to Cart
            </button>
        </div>
    </div>
);

// M-Pesa API URL - using AlphaRetail's own Supabase Edge Functions
const MPESA_API_URL = 'https://enlqpifpxuecxxozyiak.supabase.co/functions/v1';
const MPESA_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVubHFwaWZweHVlY3h4b3p5aWFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwMjUzNjgsImV4cCI6MjA4MTYwMTM2OH0.-z3-2Mf3SkkZR3ZryOGyG-60jWERX9YLKIee048OziE';

// Format phone number for M-Pesa
const formatMpesaPhone = (phone: string): string => {
    let cleaned = phone.replace(/\s/g, '').replace(/\+/g, '').replace(/-/g, '');
    if (cleaned.startsWith('0')) {
        cleaned = '254' + cleaned.substring(1);
    } else if (!cleaned.startsWith('254')) {
        cleaned = '254' + cleaned;
    }
    return cleaned;
};

// Validate Kenyan phone number
const isValidKenyanPhone = (phone: string): boolean => {
    const cleaned = phone.replace(/\s/g, '').replace(/\+/g, '').replace(/-/g, '');
    return /^(07\d{8}|01\d{8}|254\d{9})$/.test(cleaned);
};

// Payment Modal with M-Pesa STK Push
const PaymentModal = ({
    isOpen,
    onClose,
    total,
    onComplete,
    receiptNo,
    creditCustomers,
    selectedCustomer,
    setSelectedCustomer,
    loadCreditCustomers,
}: {
    isOpen: boolean;
    onClose: () => void;
    total: number;
    onComplete: (method: string, amountPaid: number, mpesaReceipt?: string, customerName?: string, checkoutRequestId?: string, customerPhone?: string) => void;
    receiptNo: string;
    creditCustomers: CreditCustomer[];
    selectedCustomer: CreditCustomer | null;
    setSelectedCustomer: (c: CreditCustomer | null) => void;
    loadCreditCustomers: () => void;
}) => {
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [amountPaid, setAmountPaid] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [mpesaPhone, setMpesaPhone] = useState('');
    const [mpesaReceipt, setMpesaReceipt] = useState('');
    const [customerName, setCustomerName] = useState('');
    const [creditSearch, setCreditSearch] = useState('');
    const [newCreditName, setNewCreditName] = useState('');
    const [newCreditPhone, setNewCreditPhone] = useState('');
    const [addingCustomer, setAddingCustomer] = useState(false);

    // M-Pesa STK Push State
    const [mpesaStatus, setMpesaStatus] = useState<'idle' | 'sending' | 'waiting' | 'success' | 'failed'>('idle');
    const [mpesaStatusMessage, setMpesaStatusMessage] = useState('');
    const [checkoutRequestId, setCheckoutRequestId] = useState('');
    const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const saleCompletedRef = useRef<boolean>(false); // Prevent multiple sale completions

    const change = paymentMethod === 'cash' ? Math.max(0, Number(amountPaid) - total) : 0;
    const quickAmounts = [100, 200, 500, 1000, 2000, 5000];

    // Cleanup polling on unmount
    useEffect(() => {
        return () => {
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
            }
        };
    }, []);

    // Reset M-Pesa state
    const resetMpesaState = () => {
        if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
        }
        setMpesaStatus('idle');
        setMpesaStatusMessage('');
        setCheckoutRequestId('');
        saleCompletedRef.current = false; // Reset for next payment
    };

    // Handle M-Pesa STK Push
    const handleMpesaSTKPush = async () => {
        if (!isValidKenyanPhone(mpesaPhone)) {
            toast.error('📱 Please enter a valid Kenyan phone number (e.g., 0712345678)');
            return;
        }

        setMpesaStatus('sending');
        setMpesaStatusMessage('📤 Sending STK Push...');

        try {
            const phone = formatMpesaPhone(mpesaPhone);
            console.log('🔵 Sending STK to:', `${MPESA_API_URL}/stkpush`);
            console.log('🔵 Phone:', phone, 'Amount:', Math.ceil(total));

            const response = await fetch(`${MPESA_API_URL}/stkpush`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': MPESA_SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${MPESA_SUPABASE_ANON_KEY}`
                },
                body: JSON.stringify({
                    phone,
                    amount: Math.ceil(total),
                    accountReference: receiptNo,
                    transactionDesc: `Alpha Retail - ${receiptNo}`,
                }),
            });

            const data = await response.json();
            console.log('🔵 STK Response:', data);

            if (data.success && (data.checkout_request_id || data.CheckoutRequestID || data.checkoutRequestId)) {
                const requestId = data.checkout_request_id || data.CheckoutRequestID || data.checkoutRequestId;
                setCheckoutRequestId(requestId);
                setMpesaStatus('waiting');
                setMpesaStatusMessage('📲 Enter your M-Pesa PIN on your phone...');

                // Save pending transaction to local database (for visibility)
                await supabase.from('mpesa_transactions').insert({
                    checkout_request_id: requestId,
                    phone_number: phone,
                    amount: total,
                    account_reference: receiptNo,
                    status: 'Pending',
                });

                // Poll Energy App's check-status for receipt updates
                startStatusPolling(requestId);
            } else {
                const errorMsg = data.error || data.errorMessage || data.message || JSON.stringify(data);
                console.error('❌ STK Failed:', errorMsg);
                setMpesaStatus('failed');
                setMpesaStatusMessage(`❌ ${errorMsg}`);
                toast.error(`STK Error: ${errorMsg}`);
            }
        } catch (err: any) {
            console.error('❌ Network Error:', err);
            setMpesaStatus('failed');
            setMpesaStatusMessage(`❌ ${err.message}`);
            toast.error(`Network error: ${err.message}`);
        }
    };

    // Poll for M-Pesa payment status
    const startStatusPolling = (requestId: string) => {
        let attempts = 0;
        const maxAttempts = 24; // 2 minutes (24 * 5 seconds) - more time for callback

        pollIntervalRef.current = setInterval(async () => {
            attempts++;

            try {
                const response = await fetch(`${MPESA_API_URL}/check-status?checkout_request_id=${requestId}`, {
                    headers: {
                        'apikey': MPESA_SUPABASE_ANON_KEY,
                        'Authorization': `Bearer ${MPESA_SUPABASE_ANON_KEY}`
                    }
                });
                const data = await response.json();
                console.log('🔵 check-status Response:', JSON.stringify(data, null, 2));

                if (data.resultCode === 0) {
                    // Payment successful!
                    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

                    // Get receipt from response - check multiple possible field names
                    let receipt = data.mpesaReceiptNumber || data.MpesaReceiptNumber || data.mpesa_receipt_number || data.mpesa_receipt || null;

                    // If no receipt in response, try to extract from resultDesc (format: "...UALHE4GP51...")
                    if (!receipt && data.resultDesc) {
                        const match = data.resultDesc.match(/([A-Z0-9]{10})/);
                        if (match) receipt = match[1];
                    }

                    // If still no receipt, poll a few more times (callback may still be processing)
                    if (!receipt && attempts < maxAttempts) {
                        console.log('⏳ Payment success but receipt not yet available, retrying...');
                        // Poll again after 2 seconds (callback should have saved by now)
                        setTimeout(async () => {
                            for (let retry = 0; retry < 5; retry++) {
                                await new Promise(resolve => setTimeout(resolve, 1000));
                                try {
                                    const retryResponse = await fetch(`${MPESA_API_URL}/check-status?checkout_request_id=${requestId}`, {
                                        headers: {
                                            'apikey': MPESA_SUPABASE_ANON_KEY,
                                            'Authorization': `Bearer ${MPESA_SUPABASE_ANON_KEY}`
                                        }
                                    });
                                    const retryData = await retryResponse.json();
                                    if (retryData.mpesaReceiptNumber) {
                                        receipt = retryData.mpesaReceiptNumber;
                                        console.log('✅ Got receipt on retry:', receipt);
                                        break;
                                    }
                                } catch (e) {
                                    console.error('Retry error:', e);
                                }
                            }

                            // Final completion with whatever receipt we have
                            if (!receipt) {
                                console.warn('⚠️ Could not get M-Pesa receipt after retries');
                                receipt = `MPESA-${Date.now().toString(36).toUpperCase()}`;
                            }

                            setMpesaStatus('success');
                            setMpesaStatusMessage(`✅ Payment received! Receipt: ${receipt}`);
                            setMpesaReceipt(receipt);
                            toast.success(`✅ M-Pesa payment successful! ${receipt}`);

                            // Update transaction in database
                            await supabase.from('mpesa_transactions')
                                .update({
                                    status: 'Completed',
                                    mpesa_receipt_number: receipt,
                                    updated_at: new Date().toISOString()
                                })
                                .eq('checkout_request_id', requestId);

                            // Complete the sale
                            if (!saleCompletedRef.current) {
                                saleCompletedRef.current = true;
                                onComplete('MPESA', total, receipt, customerName, requestId, mpesaPhone);
                            }
                        }, 500);
                        return;
                    }

                    console.log('✅ M-Pesa Receipt:', receipt);
                    setMpesaStatus('success');
                    setMpesaStatusMessage(`✅ Payment received! Receipt: ${receipt}`);
                    setMpesaReceipt(receipt);
                    toast.success(`✅ M-Pesa payment successful! ${receipt}`);

                    // Update transaction in database
                    await supabase.from('mpesa_transactions')
                        .update({
                            status: 'Completed',
                            mpesa_receipt_number: receipt,
                            updated_at: new Date().toISOString()
                        })
                        .eq('checkout_request_id', requestId);

                    // Auto-complete the sale after 1 second (only if not already completed)
                    setTimeout(() => {
                        if (!saleCompletedRef.current) {
                            saleCompletedRef.current = true;
                            onComplete('MPESA', total, receipt, customerName, requestId, mpesaPhone);
                        }
                    }, 1000);

                } else if ((data.success === false || (data.resultCode !== undefined && data.resultCode !== null && data.resultCode !== 0)) && data.status !== 'pending') {
                    // Payment failed or cancelled (but NOT if still pending - waiting for callback)
                    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
                    setMpesaStatus('failed');

                    // Determine error message
                    let desc = '❌ Payment failed';

                    const errorMessages: Record<number, string> = {
                        1: '❌ Insufficient funds in M-Pesa account',
                        1032: '❌ Request cancelled by user',
                        1037: '❌ Request timed out - no response from phone',
                        2001: '❌ Wrong M-Pesa PIN entered',
                    };

                    if (data.resultCode && errorMessages[data.resultCode]) {
                        desc = errorMessages[data.resultCode];
                    } else if (data.resultDesc) {
                        const descLower = data.resultDesc.toLowerCase();
                        if (descLower.includes('insufficient') || descLower.includes('balance')) {
                            desc = '❌ Insufficient funds in M-Pesa account';
                        } else if (descLower.includes('cancel')) {
                            desc = '❌ Request cancelled by user';
                        } else {
                            desc = `❌ Payment failed: ${data.resultDesc}`;
                        }
                    } else if (data.resultCode) {
                        desc = `❌ Payment failed (Code: ${data.resultCode})`;
                    }

                    setMpesaStatusMessage(desc);
                    toast.error(desc);

                    // Update transaction status
                    await supabase.from('mpesa_transactions')
                        .update({ status: 'Failed', result_desc: desc })
                        .eq('checkout_request_id', requestId);

                } else if (attempts >= maxAttempts) {
                    // Timeout
                    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
                    setMpesaStatus('failed');
                    setMpesaStatusMessage('⏰ Payment timeout - please check your M-Pesa messages');
                    toast.error('Payment timeout - please check your M-Pesa messages');
                }
            } catch {
                // Continue polling on error
            }
        }, 5000);
    };

    // Handle close with cleanup
    const handleClose = () => {
        resetMpesaState();
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <span>💳</span> Payment
                    </h2>
                    <div className="text-right">
                        <p className="text-xs text-gray-500">Receipt</p>
                        <p className="font-semibold text-blue-600">{receiptNo}</p>
                    </div>
                </div>

                {/* Total */}
                <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl p-5 text-white mb-6">
                    <p className="text-sm opacity-90">Total Amount</p>
                    <p className="text-4xl font-bold">Ksh {total.toLocaleString()}</p>
                </div>

                {/* Payment Methods */}
                <div className="grid grid-cols-4 gap-2 mb-6">
                    {[
                        { id: 'cash', icon: '💵', label: 'Cash' },
                        { id: 'mpesa', icon: '📱', label: 'M-Pesa' },
                        { id: 'card', icon: '💳', label: 'Card' },
                        { id: 'credit', icon: '📋', label: 'Credit' },
                    ].map(method => (
                        <button
                            key={method.id}
                            onClick={() => { setPaymentMethod(method.id); resetMpesaState(); }}
                            className={`p-3 rounded-xl border-2 transition-all ${paymentMethod === method.id
                                ? 'border-green-500 bg-green-50'
                                : 'border-gray-200 hover:border-gray-300 bg-gray-50'
                                }`}
                        >
                            <span className="text-2xl block mb-1">{method.icon}</span>
                            <span className="text-xs font-medium text-gray-600">{method.label}</span>
                        </button>
                    ))}
                </div>

                {/* Cash Input */}
                {paymentMethod === 'cash' && (
                    <div className="space-y-4 mb-6">
                        <div>
                            <label className="text-sm font-medium text-gray-600 mb-2 block">Amount Received</label>
                            <input
                                type="number"
                                value={amountPaid}
                                onChange={(e) => setAmountPaid(e.target.value)}
                                placeholder="Enter amount..."
                                className="w-full p-4 bg-gray-50 border-2 border-gray-200 rounded-xl focus:border-green-500 focus:outline-none text-lg font-semibold"
                            />
                        </div>
                        <div className="grid grid-cols-6 gap-2">
                            {quickAmounts.map(amt => (
                                <button
                                    key={amt}
                                    onClick={() => setAmountPaid(amt.toString())}
                                    className="py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-700 font-medium transition-colors text-sm"
                                >
                                    {amt.toLocaleString()}
                                </button>
                            ))}
                        </div>
                        <button
                            onClick={() => setAmountPaid(total.toString())}
                            className="w-full py-2 bg-green-100 hover:bg-green-200 rounded-xl text-green-700 font-medium transition-colors"
                        >
                            Exact Amount ({total.toLocaleString()})
                        </button>
                        <div className="flex items-center justify-between p-4 bg-green-50 rounded-xl border border-green-200">
                            <span className="text-green-700 font-medium">Change:</span>
                            <span className="text-2xl font-bold text-green-600">Ksh {change.toLocaleString()}</span>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-gray-600 mb-2 block">👤 Customer Name (Optional)</label>
                            <input
                                type="text"
                                value={customerName}
                                onChange={(e) => setCustomerName(e.target.value)}
                                placeholder="Enter customer name"
                                className="w-full p-3 bg-gray-50 border-2 border-gray-200 rounded-xl focus:border-green-500 focus:outline-none"
                            />
                        </div>
                    </div>
                )}

                {/* M-Pesa STK Push Section */}
                {paymentMethod === 'mpesa' && (
                    <div className="space-y-4 mb-6">
                        <div>
                            <label className="text-sm font-medium text-gray-600 mb-2 block">📱 Customer Phone Number</label>
                            <input
                                type="tel"
                                value={mpesaPhone}
                                onChange={(e) => setMpesaPhone(e.target.value)}
                                placeholder="07XX XXX XXX or 01XX XXX XXX"
                                className="w-full p-4 bg-gray-50 border-2 border-gray-200 rounded-xl focus:border-green-500 focus:outline-none text-lg"
                                disabled={mpesaStatus === 'sending' || mpesaStatus === 'waiting'}
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-gray-600 mb-2 block">👤 Customer Name (Optional)</label>
                            <input
                                type="text"
                                value={customerName}
                                onChange={(e) => setCustomerName(e.target.value)}
                                placeholder="Enter customer name"
                                className="w-full p-4 bg-gray-50 border-2 border-gray-200 rounded-xl focus:border-green-500 focus:outline-none text-lg"
                                disabled={mpesaStatus === 'sending' || mpesaStatus === 'waiting'}
                            />
                        </div>

                        {/* M-Pesa Status Display */}
                        {mpesaStatus !== 'idle' && (
                            <div className={`p-4 rounded-xl flex items-center gap-3 ${mpesaStatus === 'sending' ? 'bg-amber-50 border border-amber-300' :
                                mpesaStatus === 'waiting' ? 'bg-blue-50 border border-blue-300' :
                                    mpesaStatus === 'success' ? 'bg-green-50 border border-green-300' :
                                        'bg-red-50 border border-red-300'
                                }`}>
                                {(mpesaStatus === 'sending' || mpesaStatus === 'waiting') && (
                                    <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                                )}
                                <span className={`font-medium ${mpesaStatus === 'sending' ? 'text-amber-700' :
                                    mpesaStatus === 'waiting' ? 'text-blue-700' :
                                        mpesaStatus === 'success' ? 'text-green-700' :
                                            'text-red-700'
                                    }`}>{mpesaStatusMessage}</span>
                            </div>
                        )}

                        {/* Send STK Push Button */}
                        {(mpesaStatus === 'idle' || mpesaStatus === 'failed') && (
                            <button
                                onClick={handleMpesaSTKPush}
                                className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
                            >
                                <span>📤</span> Send STK Push
                            </button>
                        )}

                        {/* Manual Receipt Entry */}
                        <div className="pt-4 border-t border-gray-200">
                            <p className="text-xs text-gray-500 mb-2 text-center">- OR enter receipt manually if customer has already paid -</p>
                            <input
                                type="text"
                                value={mpesaReceipt}
                                onChange={(e) => setMpesaReceipt(e.target.value.toUpperCase())}
                                placeholder="M-Pesa Receipt e.g. RLJ5XXXXXX"
                                className="w-full p-3 bg-gray-50 border-2 border-gray-200 rounded-xl focus:border-green-500 focus:outline-none"
                            />
                        </div>
                    </div>
                )}

                {/* Credit Customer Selection */}
                {paymentMethod === 'credit' && (
                    <div className="space-y-3 mb-6">
                        <div className="p-3 bg-orange-50 rounded-xl border border-orange-200">
                            <p className="text-orange-700 text-sm font-medium">Select a credit customer to proceed with credit sale</p>
                        </div>
                        {/* Search */}
                        <input
                            type="text"
                            value={creditSearch}
                            onChange={(e) => setCreditSearch(e.target.value)}
                            placeholder="Search customer name or phone..."
                            className="w-full p-3 bg-gray-50 border-2 border-gray-200 rounded-xl focus:border-orange-400 focus:outline-none text-sm"
                        />
                        {/* Customer List */}
                        <div className="max-h-44 overflow-y-auto rounded-xl border border-gray-200 bg-white">
                            {creditCustomers.filter(c =>
                                !creditSearch ||
                                c.customer_name?.toLowerCase().includes(creditSearch.toLowerCase()) ||
                                c.phone?.includes(creditSearch)
                            ).length === 0 ? (
                                <p className="p-4 text-center text-gray-400 text-sm">No customers found</p>
                            ) : (
                                creditCustomers.filter(c =>
                                    !creditSearch ||
                                    c.customer_name?.toLowerCase().includes(creditSearch.toLowerCase()) ||
                                    c.phone?.includes(creditSearch)
                                ).map(c => (
                                    <button
                                        key={c.customer_id}
                                        onClick={() => { setSelectedCustomer(c); setCustomerName(c.customer_name); setCreditSearch(''); }}
                                        className={`w-full text-left px-4 py-3 border-b border-gray-100 last:border-0 transition-colors ${
                                            selectedCustomer?.customer_id === c.customer_id
                                            ? 'bg-orange-50 border-l-4 border-l-orange-500'
                                            : 'hover:bg-gray-50'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="font-semibold text-gray-800 text-sm">{c.customer_name}</p>
                                                <p className="text-xs text-gray-500">{c.phone || 'No phone'}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className={`text-sm font-bold ${(c.current_balance || 0) > 0 ? 'text-red-500' : 'text-green-600'}`}>
                                                    Ksh {(c.current_balance || 0).toLocaleString()}
                                                </p>
                                                <p className="text-[10px] text-gray-400">Balance</p>
                                            </div>
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                        {/* Selected Customer */}
                        {selectedCustomer && (
                            <div className="flex items-center gap-3 p-3 bg-green-50 rounded-xl border border-green-200">
                                <div className="flex-1">
                                    <p className="font-bold text-green-800 text-sm">{selectedCustomer.customer_name}</p>
                                    <p className="text-xs text-green-600">
                                        Current: Ksh {(selectedCustomer.current_balance || 0).toLocaleString()} →
                                        After: Ksh {((selectedCustomer.current_balance || 0) + total).toLocaleString()}
                                    </p>
                                </div>
                                <button onClick={() => { setSelectedCustomer(null); setCustomerName(''); }}
                                    className="text-red-400 hover:text-red-600 text-xs font-bold px-2">Clear</button>
                            </div>
                        )}
                        {/* Add New Customer */}
                        {!selectedCustomer && (
                            <div className="border-t border-gray-200 pt-3">
                                <p className="text-xs text-gray-500 mb-2 text-center">Or add a new credit customer</p>
                                <div className="flex gap-2">
                                    <input type="text" value={newCreditName} onChange={(e) => setNewCreditName(e.target.value)}
                                        placeholder="Name" className="flex-1 p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-orange-400" />
                                    <input type="text" value={newCreditPhone} onChange={(e) => setNewCreditPhone(e.target.value)}
                                        placeholder="Phone" className="w-28 p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-orange-400" />
                                    <button
                                        disabled={addingCustomer || !newCreditName.trim()}
                                        onClick={async () => {
                                            if (!newCreditName.trim()) return;
                                            setAddingCustomer(true);
                                            try {
                                                const { data, error } = await supabase.from('retail_credit_customers').insert({
                                                    customer_name: newCreditName.trim(),
                                                    phone: newCreditPhone.trim() || null,
                                                    current_balance: 0,
                                                    credit_limit: 0,
                                                    active: true,
                                                }).select().single();
                                                if (error) throw error;
                                                toast.success(`Added ${newCreditName}`);
                                                setSelectedCustomer(data);
                                                setCustomerName(data.customer_name);
                                                setNewCreditName('');
                                                setNewCreditPhone('');
                                                loadCreditCustomers();
                                            } catch (err: any) {
                                                toast.error(err?.message || 'Failed to add');
                                            }
                                            setAddingCustomer(false);
                                        }}
                                        className="px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                                    >+ Add</button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Actions */}
                <div className="flex gap-3">
                    <button
                        onClick={handleClose}
                        className="flex-1 py-3 border-2 border-gray-200 text-gray-600 rounded-xl font-semibold hover:bg-gray-50"
                        disabled={mpesaStatus === 'sending' || mpesaStatus === 'waiting'}
                    >
                        Cancel
                    </button>
                    {mpesaStatus !== 'waiting' && mpesaStatus !== 'sending' && (
                        <button
                            onClick={async () => {
                                if (isSaving) return; // Prevent double-click
                                if (paymentMethod === 'credit' && !selectedCustomer) {
                                    toast.error('Please select a credit customer first');
                                    return;
                                }
                                setIsSaving(true);
                                try {
                                    await onComplete(
                                        paymentMethod === 'mpesa' ? 'MPESA' : paymentMethod.toUpperCase(),
                                        Number(amountPaid) || total,
                                        mpesaReceipt,
                                        selectedCustomer ? selectedCustomer.customer_name : customerName,
                                        checkoutRequestId,
                                        selectedCustomer ? (selectedCustomer.phone || undefined) : undefined
                                    );
                                } catch (err) {
                                    console.error('Complete sale error:', err);
                                } finally {
                                    setIsSaving(false);
                                }
                            }}
                            disabled={isSaving || (paymentMethod === 'mpesa' && !mpesaReceipt && mpesaStatus !== 'success') || (paymentMethod === 'credit' && !selectedCustomer)}
                            className={`flex-1 py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2 ${
                                isSaving || (paymentMethod === 'mpesa' && !mpesaReceipt && mpesaStatus !== 'success') || (paymentMethod === 'credit' && !selectedCustomer)
                                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                : 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:shadow-lg'
                                }`}
                        >
                            <span>{isSaving ? '⏳' : '✅'}</span>
                            <span>{isSaving ? 'Processing...' : (paymentMethod === 'credit' && !selectedCustomer ? 'Select Customer' : 'Complete Sale')}</span>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

// Discount Modal
const DiscountModal = ({
    isOpen,
    onClose,
    item,
    onSave
}: {
    isOpen: boolean;
    onClose: () => void;
    item: CartItem | null;
    onSave: (discount: number) => void;
}) => {
    const [discount, setDiscount] = useState('');

    useEffect(() => {
        if (item) {
            setDiscount(item.discount > 0 ? item.discount.toString() : '');
        }
    }, [item]);

    if (!isOpen || !item) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
                <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <span>💰</span> Item Discount
                </h2>
                <p className="text-sm text-gray-600 mb-4">
                    {item.name} @ Ksh {item.salesPrice.toLocaleString()} x {item.qty}
                </p>
                <input
                    type="number"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                    placeholder="Enter discount amount..."
                    className="w-full p-4 bg-gray-50 border-2 border-gray-200 rounded-xl focus:border-green-500 focus:outline-none text-lg font-semibold mb-4"
                />
                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 border-2 border-gray-200 text-gray-600 rounded-xl font-semibold hover:bg-gray-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => { onSave(Number(discount) || 0); onClose(); }}
                        className="flex-1 py-3 bg-green-500 text-white rounded-xl font-semibold hover:bg-green-600"
                    >
                        Save
                    </button>
                </div>
            </div>
        </div>
    );
};

// Helper: Fetch ALL retail_stock rows by paginating (Supabase caps at 1000 per request)
async function fetchAllStock(outletId: number): Promise<Array<{pid: number; qty: number; storage_type: string}>> {
    const PAGE_SIZE = 1000;
    let allRows: Array<{pid: number; qty: number; storage_type: string}> = [];
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

        if (error) {
            console.error('Stock fetch error on page', page, error.message);
            break;
        }

        if (data && data.length > 0) {
            allRows = allRows.concat(data);
        }

        // If we got fewer than PAGE_SIZE rows, we've reached the end
        if (!data || data.length < PAGE_SIZE) {
            hasMore = false;
        } else {
            page++;
        }
    }

    console.log(`📊 Fetched ${allRows.length} total stock rows for outlet ${outletId} (${page + 1} pages)`);
    return allRows;
}

// Main Retail POS Page
export default function RetailPOSPage() {
    const { activeOutlet, expiryEnabled } = useOutlet();
    const outletId = activeOutlet?.outlet_id || 1;
    const outletCode = activeOutlet?.outlet_code || 'RCP';
    const [products, setProducts] = useState<Product[]>([]);
    const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedProductIndex, setSelectedProductIndex] = useState<number>(-1);
    const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
    const [showCategories, setShowCategories] = useState(false);
    const [categoryProducts, setCategoryProducts] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showPayment, setShowPayment] = useState(false);
    const [showDiscountModal, setShowDiscountModal] = useState(false);
    const [editingCartItem, setEditingCartItem] = useState<CartItem | null>(null);
    const [receiptNo, setReceiptNo] = useState('RCP-00001');
    const [storeName, setStoreName] = useState('Alpha Retail');
    const [isFullscreen, setIsFullscreen] = useState(false);

    // Customer selection
    const [creditCustomers, setCreditCustomers] = useState<CreditCustomer[]>([]);
    const [selectedCustomer, setSelectedCustomer] = useState<CreditCustomer | null>(null);
    const [customerSearch, setCustomerSearch] = useState('');
    const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

    // Unit picker state
    const [showUnitPicker, setShowUnitPicker] = useState(false);
    const [unitPickerProduct, setUnitPickerProduct] = useState<Product | null>(null);

    // ─── EXPIRY BATCH MODAL (only for expiry-enabled outlets) ───
    const [showBatchModal, setShowBatchModal] = useState(false);
    const [batchModalProduct, setBatchModalProduct] = useState<Product | null>(null);
    const [productBatches, setProductBatches] = useState<Array<{
        batch_id: number; batch_number: string; expiry_date: string;
        qty_remaining: number; cost_price: number; selling_price: number;
        daysLeft: number; status: string;
    }>>([]);
    const [loadingBatches, setLoadingBatches] = useState(false);

    // Opening Drop / Close Register state
    const [showOpeningDrop, setShowOpeningDrop] = useState(false);
    const [openingDropAmount, setOpeningDropAmount] = useState('');
    const [currentShiftId, setCurrentShiftId] = useState<number | null>(null);
    const [registerOpen, setRegisterOpen] = useState(false);
    const [showCloseRegister, setShowCloseRegister] = useState(false);
    const [closeRegisterData, setCloseRegisterData] = useState<{
        totalSales: number; totalCash: number; totalMpesa: number;
        totalCredit: number; totalExpenses: number; openingCash: number;
        netSales: number; orderCount: number; profit: number;
    } | null>(null);
    const [isLoadingRegister, setIsLoadingRegister] = useState(false);

    // ─── LOW STOCK NOTIFICATION ───
    const [showLowStockModal, setShowLowStockModal] = useState(false);
    const [lowStockItems, setLowStockItems] = useState<Array<{ name: string; pieceQty: number; bagQty: number; salesUnit: string; purchaseUnit: string }>>([]);

    // Compute low stock items from loaded products (pieces < 10)
    useEffect(() => {
        const low = products.filter(p => (p.pieceQty || 0) < 10).map(p => ({
            name: p.name,
            pieceQty: p.pieceQty || 0,
            bagQty: p.bagQty || 0,
            salesUnit: p.salesUnit || 'Pc',
            purchaseUnit: p.purchaseUnit || 'Bag',
        })).sort((a, b) => a.pieceQty - b.pieceQty);
        setLowStockItems(low);
    }, [products]);

    // ─── HOLD / RECALL SALE ───
    interface HeldSale {
        id: string;
        cart: CartItem[];
        receiptNo: string;
        heldAt: string;
        total: number;
        itemCount: number;
        customerName?: string;
    }
    const [heldSales, setHeldSales] = useState<HeldSale[]>([]);
    const [showHeldSalesModal, setShowHeldSalesModal] = useState(false);

    // Load held sales from localStorage on mount
    useEffect(() => {
        try {
            const saved = localStorage.getItem('alpha_retail_held_sales');
            if (saved) setHeldSales(JSON.parse(saved));
        } catch (_) {}
    }, []);

    // Persist held sales to localStorage whenever they change
    useEffect(() => {
        try {
            localStorage.setItem('alpha_retail_held_sales', JSON.stringify(heldSales));
        } catch (_) {}
    }, [heldSales]);

    // Hold current sale
    const holdCurrentSale = async () => {
        if (cart.length === 0) {
            toast.error('Cart is empty — nothing to hold');
            return;
        }
        const subtot = cart.reduce((s, i) => s + (i.effectivePrice * i.qty), 0);
        const disc = cart.reduce((s, i) => s + i.discount, 0);
        const held: HeldSale = {
            id: `HOLD-${Date.now()}`,
            cart: [...cart],
            receiptNo,
            heldAt: new Date().toISOString(),
            total: subtot - disc,
            itemCount: cart.length,
        };
        setHeldSales(prev => [...prev, held]);
        setCart([]);
        await loadNextReceiptNo();
        toast.success(`Sale held (${held.itemCount} items — Ksh ${held.total.toLocaleString()})`);
    };

    // Recall a held sale
    const recallHeldSale = async (heldId: string) => {
        const sale = heldSales.find(h => h.id === heldId);
        if (!sale) return;
        if (cart.length > 0) {
            // Auto-hold current cart before recalling
            await holdCurrentSale();
        }
        setCart(sale.cart);
        // ALWAYS get a fresh receipt number — the old one may have been used
        // while this sale was on hold
        await loadNextReceiptNo();
        setHeldSales(prev => prev.filter(h => h.id !== heldId));
        setShowHeldSalesModal(false);
        toast.success('Sale recalled — continue where you left off');
    };

    // Delete a held sale
    const deleteHeldSale = (heldId: string) => {
        setHeldSales(prev => prev.filter(h => h.id !== heldId));
        toast.success('Held sale removed');
    };

    const searchInputRef = useRef<HTMLInputElement>(null);

    // User role for discount permission
    const [userType, setUserType] = useState<string>('');
    const [isWaiterUser, setIsWaiterUser] = useState(false);
    const [loggedInUserName, setLoggedInUserName] = useState('');
    useEffect(() => {
        try {
            const userData = localStorage.getItem('user');
            if (userData) {
                const parsed = JSON.parse(userData);
                setUserType(parsed.userType || '');
                const waiter = parsed.isWaiter === true || (parsed.userType || '').toLowerCase() === 'waiter' || (parsed.userType || '').toLowerCase() === 'cashier';
                setIsWaiterUser(waiter);
                setLoggedInUserName(parsed.name || '');
            }
        } catch { /* ignore */ }
        // Auto-fullscreen POS on load for ALL users
        setTimeout(() => {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(() => {});
            }
        }, 500);
    }, []);
    const canDiscount = ['Admin', 'SuperAdmin', 'Super User', 'admin', 'superadmin', 'super user'].includes(userType);

    // Toggle fullscreen mode
    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().then(() => {
                setIsFullscreen(true);
            }).catch(err => {
                console.error('Fullscreen error:', err);
            });
        } else {
            document.exitFullscreen().then(() => {
                setIsFullscreen(false);
            }).catch(err => {
                console.error('Exit fullscreen error:', err);
            });
        }
    };

    // Load products from database
    const loadProducts = useCallback(async () => {
        if (!activeOutlet) return; // Wait for outlet context to load
        setIsLoading(true);
        try {
            // NOTE: Auto-convert Bags→Pieces is ONLY done at SALE TIME (when pieces reach 0).
            // We do NOT convert on page load — bags and pieces are kept separate until needed.

            // Load products from retail_products table - FILTERED BY OUTLET
            const { data, error } = await supabase
                .from('retail_products')
                .select('*')
                .eq('active', true)
                .eq('outlet_id', outletId)
                .order('product_name');

            if (error) throw error;

            // Load stock data from retail_stock table - PAGINATED TO GET ALL ROWS
            // Supabase enforces 1000-row server limit, so we must paginate
            const stockData = await fetchAllStock(outletId);

            // Build stock maps by storage_type (same as products list page)
            const stockMap: Record<number, number> = {};
            const bagMap: Record<number, number> = {};
            const pieceMap: Record<number, number> = {};
            (stockData || []).forEach((s: any) => {
                const q = s.qty || 0;
                if (s.storage_type === 'Bags') {
                    bagMap[s.pid] = (bagMap[s.pid] || 0) + q;
                } else {
                    pieceMap[s.pid] = (pieceMap[s.pid] || 0) + q;
                }
                stockMap[s.pid] = (stockMap[s.pid] || 0) + q;
            });

            // Transform to POS format
            const posProducts: Product[] = (data || []).map(p => ({
                id: p.pid,
                name: p.product_name,
                barcode: p.barcode || '',
                category: p.category || 'Uncategorized',
                availableQty: stockMap[p.pid] || 0,
                costPrice: p.purchase_cost || 0,
                salesPrice: p.wholesale_price || p.sales_cost || 0,
                retailPrice: p.sales_cost || p.wholesale_price || 0,
                color: p.button_ui_color || 'from-blue-400 to-blue-600',
                imageUrl: p.photo || '',
                salesUnit: p.sales_unit || 'Piece',
                purchaseUnit: p.purchase_unit || 'Piece',
                piecesPerPackage: p.pieces_per_package || 1,
                bagQty: bagMap[p.pid] || 0,
                pieceQty: pieceMap[p.pid] || 0,
            }));

            setProducts(posProducts);
        } catch (err) {
            console.error('Error loading products:', err);
            toast.error('Failed to load products');
        }
        setIsLoading(false);
    }, [activeOutlet, outletId]);

    // Load categories from database
    const loadCategories = useCallback(async () => {
        if (!activeOutlet) return; // Wait for outlet context
        try {
            // Try loading with outlet_id filter first
            let { data, error } = await supabase
                .from('retail_categories')
                .select('*')
                .eq('active', true)
                .eq('outlet_id', outletId)
                .order('category_name');

            // If outlet_id filter fails (column doesn't exist), load ALL categories
            if (error) {
                const fallback = await supabase
                    .from('retail_categories')
                    .select('*')
                    .eq('active', true)
                    .order('category_name');
                data = fallback.data;
            }

            setCategories(data || []);
        } catch (err) {
            console.error('Error loading categories:', err);
        }
    }, [activeOutlet, outletId]);

    // Load store name
    const loadStoreName = useCallback(async () => {
        try {
            const { data } = await supabase
                .from('retail_settings')
                .select('setting_value')
                .eq('setting_key', 'company_name')
                .single();

            if (data?.setting_value) {
                setStoreName(data.setting_value);
            }
        } catch (err) {
            console.log('Could not load store name');
        }
    }, []);

    // Generate next receipt number — find max across ALL receipts to avoid duplicates
    const loadNextReceiptNo = useCallback(async () => {
        if (!activeOutlet) return; // Wait for outlet context
        // Each outlet has its own receipt number sequence: MAIN-RCP01, BMS-RCP01
        const prefix = outletCode ? `${outletCode}-RCP` : 'RCP';
        try {
            const { data, error } = await supabase
                .from('retail_sales')
                .select('receipt_no')
                .eq('outlet_id', outletId)
                .like('receipt_no', `${prefix}%`)
                .order('sale_id', { ascending: false })
                .limit(500);

            if (error) {
                console.error('Receipt query error:', error);
                // ALWAYS fall back to clean format, never timestamps
                setReceiptNo(`${prefix}01`);
                return;
            }

            let nextNum = 1;
            if (data && data.length > 0) {
                let maxNum = 0;
                const regex = new RegExp(`${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\d+)`);
                for (const row of data) {
                    const match = row.receipt_no?.match(regex);
                    if (match) {
                        const num = parseInt(match[1]);
                        if (num > maxNum) maxNum = num;
                    }
                }
                if (maxNum > 0) {
                    nextNum = maxNum + 1;
                }
            }

            // Check against held sales to avoid receipt conflicts
            let candidate = `${prefix}${String(nextNum).padStart(2, '0')}`;
            const heldReceiptNos = heldSales.map(h => h.receiptNo);
            while (heldReceiptNos.includes(candidate)) {
                nextNum++;
                candidate = `${prefix}${String(nextNum).padStart(2, '0')}`;
            }

            setReceiptNo(candidate);
        } catch (err) {
            console.error('Exception loading receipt number:', err);
            // ALWAYS fall back to clean format, never timestamps
            setReceiptNo(`${prefix}01`);
        }
    }, [activeOutlet, outletId, outletCode, heldSales]);

    // Load credit customers for dropdown
    const loadCreditCustomers = useCallback(async () => {
        try {
            const { data } = await supabase
                .from('retail_credit_customers')
                .select('customer_id, customer_code, customer_name, phone, current_balance, credit_limit')
                .eq('active', true)
                .order('customer_name');
            setCreditCustomers(data || []);
        } catch (err) {
            console.error('Error loading customers:', err);
        }
    }, []);

    // Load active shift (persists across sessions)
    const loadActiveShift = useCallback(async () => {
        try {
            const { data } = await supabase
                .from('retail_shifts')
                .select('*')
                .eq('status', 'Open')
                .order('shift_id', { ascending: false })
                .limit(1)
                .maybeSingle();
            if (data) {
                setCurrentShiftId(data.shift_id);
                setRegisterOpen(true);
            }
        } catch (err) { console.error('Load shift error:', err); }
    }, []);

    // Initial load
    useEffect(() => {
        loadProducts();
        loadCategories();
        loadStoreName();
        loadNextReceiptNo();
        loadCreditCustomers();
        loadActiveShift();
    }, [loadProducts, loadCategories, loadStoreName, loadNextReceiptNo, loadCreditCustomers]);

    // Search products when query changes
    useEffect(() => {
        if (!searchQuery.trim()) {
            setFilteredProducts([]);
            setSelectedProductIndex(-1);
            return;
        }

        const query = searchQuery.toLowerCase();
        const results = products.filter(p =>
            p.name.toLowerCase().includes(query) ||
            (p.barcode && p.barcode.toLowerCase().includes(query))
        ).slice(0, 20); // Limit to 20 results

        setFilteredProducts(results);
        setSelectedProductIndex(results.length > 0 ? 0 : -1);
    }, [searchQuery, products]);

    // Load products by category
    const loadCategoryProducts = useCallback((categoryId: number, categoryName: string) => {
        setSelectedCategory(categoryId);
        const catProducts = products.filter(p =>
            p.category.toLowerCase() === categoryName.toLowerCase()
        );
        setCategoryProducts(catProducts);
    }, [products]);

    // Add product to cart
    // Add to cart with specific unit selection — accepts optional qty (default 1)
    const addToCartWithUnit = useCallback((product: Product, sellingUnit: string, unitMultiplier: number, effectivePrice: number, qty: number = 1) => {
        const addQty = Math.max(1, Math.floor(qty));
        setCart(prev => {
            // Check for existing item with SAME product AND SAME selling unit
            const existing = prev.find(item => item.id === product.id && item.sellingUnit === sellingUnit);
            if (existing) {
                return prev.map(item =>
                    item.id === product.id && item.sellingUnit === sellingUnit
                        ? { ...item, qty: item.qty + addQty }
                        : item
                );
            }
            return [...prev, { ...product, qty: addQty, discount: 0, sellingUnit, unitMultiplier, effectivePrice }];
        });

        toast.success(`${product.name} x${addQty} (${sellingUnit}) added`);
        setSearchQuery('');
        searchInputRef.current?.focus();
    }, []);

    // Set exact qty for a cart item (for clicking on qty to type)
    const setCartItemQty = useCallback((id: number, sellingUnit: string, qty: number) => {
        const newQty = Math.max(1, Math.floor(qty));
        setCart(prev => prev.map(item =>
            item.id === id && item.sellingUnit === sellingUnit
                ? { ...item, qty: newQty }
                : item
        ));
    }, []);

    // Add product to cart (checks for unit picker)
    const addToCart = useCallback((product: Product) => {
        if (product.availableQty === 0) {
            toast.error('Out of stock!');
            return;
        }

        // ─── EXPIRY CHECK (ONLY for expiry-enabled outlets) ───
        // Normal outlets skip this entirely and go straight to unit picker
        if (expiryEnabled) {
            // Fetch batches for this product and show batch selector
            setBatchModalProduct(product);
            setShowBatchModal(true);
            setLoadingBatches(true);
            supabase
                .from('retail_product_batches')
                .select('*')
                .eq('pid', product.id)
                .eq('outlet_id', outletId)
                .eq('status', 'Active')
                .gt('qty_remaining', 0)
                .order('expiry_date', { ascending: true })
                .then(({ data, error }) => {
                    if (error) {
                        console.error('Batch fetch error:', error);
                        setProductBatches([]);
                    } else {
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        const batches = (data || []).map(b => {
                            const exp = new Date(b.expiry_date);
                            exp.setHours(0, 0, 0, 0);
                            const daysLeft = Math.ceil((exp.getTime() - today.getTime()) / 86400000);
                            return { ...b, daysLeft };
                        });
                        setProductBatches(batches);
                    }
                    setLoadingBatches(false);
                });
            return; // Don't proceed to normal add-to-cart
        }

        // ─── NORMAL FLOW (unchanged for non-expiry outlets) ───
        // Check if product has different purchase/sales units
        const ppp = product.piecesPerPackage || 1;
        const pu = (product.purchaseUnit || '').trim().toLowerCase();
        const su = (product.salesUnit || '').trim().toLowerCase();
        const hasDifferentUnits = (pu && su && pu !== su) || (ppp > 1 && pu && su && pu !== su);

        if (hasDifferentUnits) {
            // Show unit picker modal
            setUnitPickerProduct(product);
            setShowUnitPicker(true);
            return;
        }

        // Same unit — always show Retail vs Wholesale picker
        setUnitPickerProduct(product);
        setShowUnitPicker(true);
    }, [addToCartWithUnit, expiryEnabled, outletId]);

    // Handle batch selection from expiry modal
    const handleBatchSelect = useCallback((batch: typeof productBatches[0]) => {
        if (!batchModalProduct) return;

        // Block expired or expiring tomorrow
        if (batch.daysLeft <= 1) {
            toast.error(`🚫 ${batchModalProduct.name} (Batch ${batch.batch_number || ''}) has expired or expires tomorrow! Cannot sell.`);
            return;
        }

        // Warn if expiring in 2 days
        if (batch.daysLeft <= 2) {
            toast(`⚠️ ${batchModalProduct.name} expires in ${batch.daysLeft} day(s)!`, { icon: '⚠️', duration: 4000 });
        }

        setShowBatchModal(false);

        // Now proceed to normal unit picker flow
        const product = batchModalProduct;
        const ppp = product.piecesPerPackage || 1;
        const pu = (product.purchaseUnit || '').trim().toLowerCase();
        const su = (product.salesUnit || '').trim().toLowerCase();
        const hasDifferentUnits = (pu && su && pu !== su) || (ppp > 1 && pu && su && pu !== su);

        if (hasDifferentUnits) {
            setUnitPickerProduct(product);
            setShowUnitPicker(true);
            return;
        }

        setUnitPickerProduct(product);
        setShowUnitPicker(true);
    }, [batchModalProduct]);

    // Handle keyboard navigation in search results
    const handleSearchKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedProductIndex(prev =>
                prev < filteredProducts.length - 1 ? prev + 1 : prev
            );
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedProductIndex(prev => prev > 0 ? prev - 1 : 0);
        } else if (e.key === 'Enter' && selectedProductIndex >= 0) {
            e.preventDefault();
            addToCart(filteredProducts[selectedProductIndex]);
        }
    };

    // Cart operations — use sellingUnit as part of key (same product can be in cart with different units)
    const increaseQty = (id: number, sellingUnit: string) => {
        setCart(prev => prev.map(item =>
            item.id === id && item.sellingUnit === sellingUnit ? { ...item, qty: item.qty + 1 } : item
        ));
    };

    const decreaseQty = (id: number, sellingUnit: string) => {
        setCart(prev => prev.map(item =>
            item.id === id && item.sellingUnit === sellingUnit && item.qty > 1 ? { ...item, qty: item.qty - 1 } : item
        ).filter(item => item.qty > 0));
    };

    const removeFromCart = (id: number, sellingUnit: string) => {
        setCart(prev => prev.filter(item => !(item.id === id && item.sellingUnit === sellingUnit)));
    };

    const clearCart = () => {
        setCart([]);
        toast.success('Cart cleared');
    };

    const openDiscountModal = (item: CartItem) => {
        setEditingCartItem(item);
        setShowDiscountModal(true);
    };

    const saveItemDiscount = (discount: number) => {
        if (editingCartItem) {
            setCart(prev => prev.map(item =>
                item.id === editingCartItem.id && item.sellingUnit === editingCartItem.sellingUnit ? { ...item, discount } : item
            ));
        }
    };

    // ─── OPEN REGISTER ───
    const handleOpenRegister = async () => {
        const amount = Number(openingDropAmount) || 0;
        try {
            const { data: shift, error } = await supabase.from('retail_shifts').insert({
                shift_date: new Date().toISOString().split('T')[0],
                shift_type: 'Day',
                start_time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
                opening_cash: amount,
                status: 'Open',
                opened_by: 'Cashier'
            }).select('shift_id').single();

            if (error) throw error;
            setCurrentShiftId(shift.shift_id);
            setRegisterOpen(true);
            setShowOpeningDrop(false);
            setOpeningDropAmount('');
            toast.success(`Register opened with Ksh ${amount.toLocaleString()} opening cash`);
        } catch (err: any) {
            console.error('Open register error:', err);
            toast.error('Failed to open register: ' + err.message);
        }
    };

    // ─── CLOSE REGISTER ───
    const handleCloseRegister = async () => {
        setIsLoadingRegister(true);
        try {
            const today = new Date().toISOString().split('T')[0];

            // Get all sales today
            const { data: salesData } = await supabase
                .from('retail_sales')
                .select('sale_id, total_amount, payment_method')
                .eq('sale_date', today)
                .eq('outlet_id', outletId);

            // Get expenses today
            const { data: expData } = await supabase
                .from('retail_expenses')
                .select('amount')
                .eq('expense_date', today)
                .eq('outlet_id', outletId);

            // Get shift opening cash
            let openingCash = 0;
            if (currentShiftId) {
                const { data: shiftData } = await supabase
                    .from('retail_shifts')
                    .select('opening_cash')
                    .eq('shift_id', currentShiftId)
                    .single();
                openingCash = shiftData?.opening_cash || 0;
            }

            const sales = salesData || [];
            const totalSales = sales.reduce((s, r) => s + (r.total_amount || 0), 0);
            const totalCash = sales.filter(r => (r.payment_method || '').toLowerCase().includes('cash')).reduce((s, r) => s + (r.total_amount || 0), 0);
            const totalMpesa = sales.filter(r => (r.payment_method || '').toLowerCase().includes('mpesa')).reduce((s, r) => s + (r.total_amount || 0), 0);
            const totalCredit = sales.filter(r => (r.payment_method || '').toLowerCase().includes('credit')).reduce((s, r) => s + (r.total_amount || 0), 0);
            const totalExpenses = (expData || []).reduce((s, e) => s + (e.amount || 0), 0);
            const netSales = totalSales - totalExpenses - totalCredit;

            // Calculate profit (revenue - purchase cost)
            const saleIds = (salesData || []).map((s: any) => s.sale_id);
            let totalCostPrice = 0;
            if (saleIds.length > 0) {
                const { data: itemsData } = await supabase
                    .from('retail_sale_items')
                    .select('quantity, unit_cost')
                    .in('sale_id', saleIds);
                totalCostPrice = (itemsData || []).reduce((sum: number, item: any) => sum + ((item.unit_cost || 0) * (item.quantity || 0)), 0);
            }
            const profit = totalSales - totalCostPrice;

            setCloseRegisterData({
                totalSales, totalCash, totalMpesa, totalCredit,
                totalExpenses, openingCash, netSales, orderCount: sales.length, profit
            });
            setShowCloseRegister(true);
        } catch (err: any) {
            toast.error('Failed to load register data: ' + err.message);
        }
        setIsLoadingRegister(false);
    };

    // Print Close Register Report on 80mm thermal
    const printCloseRegisterReport = () => {
        if (!closeRegisterData) return;
        const d = closeRegisterData;
        const now = new Date();
        const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Close Register</title>
<style>
  @page{margin:0;size:80mm auto;}
  *{margin:0;padding:0;box-sizing:border-box;}
  body{font-family:Arial,sans-serif;font-size:11px;font-weight:700;width:80mm;padding:4mm;background:#fff;color:#000;line-height:1.4;}
  .c{text-align:center;}
  .r{display:flex;justify-content:space-between;padding:3px 0;border-bottom:0.5px dashed #ccc;}
  .d{border:none;border-top:1px solid #000;margin:4px 0;}
  .dd{border:none;border-top:1px dashed #000;margin:3px 0;}
  .big{font-size:14px;font-weight:900;}
  @media print{body{width:80mm;}}
</style></head><body>
  <div class="c">
    <div style="font-size:14px;font-weight:900;text-transform:uppercase;">${storeName}</div>
    <div style="font-size:9px;margin:2px 0;">Close Register Report</div>
  </div>
  <hr class="d">
  <div class="c" style="margin:4px 0;">
    <div style="background:#000;color:#fff;padding:4px 12px;display:inline-block;font-size:11px;font-weight:900;letter-spacing:1px;">END OF DAY REPORT</div>
  </div>
  <hr class="dd">
  <div class="r"><span style="font-size:9px;">Date</span><span style="font-size:10px;">${now.toLocaleDateString('en-GB')}</span></div>
  <div class="r"><span style="font-size:9px;">Time</span><span style="font-size:10px;">${now.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</span></div>
  <div class="r"><span style="font-size:9px;">Total Orders</span><span style="font-size:10px;">${d.orderCount}</span></div>
  <hr class="d">
  <div class="c" style="font-size:9px;font-weight:900;letter-spacing:1px;margin:3px 0;">SALES BREAKDOWN</div>
  <div class="r"><span>💵 Cash Sales</span><span class="big">Ksh ${d.totalCash.toLocaleString()}</span></div>
  <div class="r"><span>📱 M-Pesa Sales</span><span class="big">Ksh ${d.totalMpesa.toLocaleString()}</span></div>
  <div class="r"><span>📋 Credit Sales</span><span class="big">Ksh ${d.totalCredit.toLocaleString()}</span></div>
  <hr class="dd">
  <div style="background:#000;color:#fff;padding:5px 8px;margin:4px 0;display:flex;justify-content:space-between;">
    <span style="font-size:11px;font-weight:900;">TOTAL SALES</span>
    <span style="font-size:14px;font-weight:900;">Ksh ${d.totalSales.toLocaleString()}</span>
  </div>
  <hr class="d">
  <div class="c" style="font-size:9px;font-weight:900;letter-spacing:1px;margin:3px 0;">DEDUCTIONS</div>
  <div class="r"><span>💰 Total Expenses</span><span style="color:#c00;" class="big">Ksh ${d.totalExpenses.toLocaleString()}</span></div>
  <div class="r"><span>📋 Total Credit</span><span style="color:#c00;" class="big">Ksh ${d.totalCredit.toLocaleString()}</span></div>
  <hr class="d">
  <div class="c" style="font-size:9px;font-weight:900;letter-spacing:1px;margin:3px 0;">CASH SUMMARY</div>
  <div class="r"><span>🟢 Opening Cash</span><span class="big">Ksh ${d.openingCash.toLocaleString()}</span></div>
  <div class="r"><span>💵 Cash Sales</span><span class="big">Ksh ${d.totalCash.toLocaleString()}</span></div>
  <div class="r"><span>🔴 Expenses</span><span style="color:#c00;" class="big">-Ksh ${d.totalExpenses.toLocaleString()}</span></div>
  <hr class="dd">
  <div style="background:#000;color:#fff;padding:6px 8px;margin:4px 0;display:flex;justify-content:space-between;">
    <span style="font-size:12px;font-weight:900;">NET SALES</span>
    <span style="font-size:16px;font-weight:900;">Ksh ${d.netSales.toLocaleString()}</span>
  </div>
  <div style="background:#000;color:#fff;padding:5px 8px;margin:2px 0;display:flex;justify-content:space-between;">
    <span style="font-size:10px;font-weight:900;">EXPECTED IN DRAWER</span>
    <span style="font-size:13px;font-weight:900;">Ksh ${(d.openingCash + d.totalCash - d.totalExpenses).toLocaleString()}</span>
  </div>
  <div style="background:#000;color:#fff;padding:6px 8px;margin:4px 0;display:flex;justify-content:space-between;">
    <span style="font-size:12px;font-weight:900;">📈 PROFIT</span>
    <span style="font-size:16px;font-weight:900;">Ksh ${(d.profit || 0).toLocaleString()}</span>
  </div>
  <hr class="d">
  <div class="c" style="padding:4px 0;">
    <div style="font-size:8px;">Printed: ${now.toLocaleDateString('en-GB')} ${now.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</div>
    <div style="font-size:7px;margin-top:2px;color:#000;">Powered by Alpha Retail POS</div>
  </div>
</body></html>`;

        // Print using iframe
        const iframe = document.createElement('iframe');
        iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:none;visibility:hidden;';
        document.body.appendChild(iframe);
        const doc = iframe.contentWindow?.document;
        if (doc) {
            doc.open(); doc.write(html); doc.close();
            iframe.onload = () => {
                setTimeout(() => {
                    try { iframe.contentWindow?.focus(); iframe.contentWindow?.print(); } catch (e) { console.error(e); }
                    setTimeout(() => document.body.removeChild(iframe), 1000);
                }, 300);
            };
        }
    };

    // Finalize close register
    const finalizeCloseRegister = async () => {
        if (currentShiftId && closeRegisterData) {
            await supabase.from('retail_shifts').update({
                end_time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
                closing_cash: closeRegisterData.totalCash,
                total_sales: closeRegisterData.totalSales,
                total_expenses: closeRegisterData.totalExpenses,
                net_sales: closeRegisterData.netSales,
                status: 'Closed',
                closed_by: 'Cashier'
            }).eq('shift_id', currentShiftId);
        }
        setRegisterOpen(false);
        setCurrentShiftId(null);
        setShowCloseRegister(false);
        setCloseRegisterData(null);
        toast.success('Register closed successfully');
    };

    // Calculate totals
    const subtotal = cart.reduce((sum, item) => sum + (item.effectivePrice * item.qty), 0);
    const totalDiscount = cart.reduce((sum, item) => sum + item.discount, 0);
    const grandTotal = subtotal - totalDiscount;

    // Complete sale
    const completeSale = async (method: string, amountPaid: number, mpesaReceipt?: string, customerName?: string, checkoutRequestId?: string, customerPhone?: string) => {
        try {
            // Use selected customer info if available
            const custName = selectedCustomer ? selectedCustomer.customer_name : (customerName || 'Walk-in Customer');
            const custPhone = selectedCustomer ? selectedCustomer.phone : (customerPhone || null);
            const custId = selectedCustomer ? selectedCustomer.customer_id : null;

            // Generate a FRESH receipt number right before insert to avoid duplicates
            let freshReceiptNo = receiptNo;
            const prefix = outletCode ? `${outletCode}-RCP` : 'RCP';
            try {
                const { data: latestSales } = await supabase
                    .from('retail_sales')
                    .select('receipt_no')
                    .eq('outlet_id', outletId)
                    .like('receipt_no', `${prefix}%`)
                    .order('sale_id', { ascending: false })
                    .limit(1);

                if (latestSales && latestSales.length > 0) {
                    const regex = new RegExp(`${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\d+)`);
                    const match = latestSales[0].receipt_no?.match(regex);
                    if (match) {
                        freshReceiptNo = `${prefix}${String(parseInt(match[1]) + 1).padStart(2, '0')}`;
                    }
                }
            } catch {
                // Keep the current receipt number as-is, don't generate timestamps
            }

            // Create sale record in retail_sales table
            const { data: sale, error: saleError } = await supabase
                .from('retail_sales')
                .insert([{
                    receipt_no: freshReceiptNo,
                    sale_date: new Date().toISOString().split('T')[0],
                    sale_datetime: new Date().toISOString(),
                    customer_name: custName,
                    customer_phone: custPhone,
                    customer_id: custId,
                    subtotal: subtotal,
                    discount: totalDiscount,
                    total_amount: grandTotal,
                    payment_method: method.toUpperCase(),
                    amount_paid: method.toUpperCase() === 'CREDIT' ? 0 : amountPaid,
                    change_amount: Math.max(0, amountPaid - grandTotal),
                    mpesa_code: mpesaReceipt || null,
                    checkout_request_id: checkoutRequestId || null,
                    status: 'Completed',
                    outlet_id: outletId
                }])
                .select()
                .single();

            if (saleError) throw saleError;

            // Create sale items
            const saleItems = cart.map(item => ({
                sale_id: sale.sale_id,
                product_id: item.id,
                product_name: item.name,
                barcode: item.barcode,
                quantity: item.qty,
                unit_price: item.effectivePrice,
                cost_price: item.costPrice,
                discount: item.discount,
                subtotal: (item.effectivePrice * item.qty) - item.discount,
                notes: item.unitMultiplier > 1 ? `Sold as ${item.sellingUnit} (x${item.unitMultiplier})` : null
            }));

            const { error: itemsError } = await supabase.from('retail_sales_items').insert(saleItems);
            if (itemsError) console.error('❌ Failed to save sale items:', itemsError);

            // ═══════════════════════════════════════════════════════════════
            // STOCK DEDUCTION — BULLETPROOF, OUTLET-AWARE, UNIT-AWARE
            // ═══════════════════════════════════════════════════════════════
            // retail_stock is a LEDGER: each row has +/- qty.
            // Total stock = SUM(qty) WHERE pid=X AND outlet_id=Y
            // We INSERT a new row with NEGATIVE qty for every sale item.
            //
            // STRATEGY: BATCH INSERT all deductions in ONE call to prevent
            // partial deductions from network errors interrupting a loop.
            // If batch fails, fall back to individual inserts with isolation.
            // ═══════════════════════════════════════════════════════════════

            // Step 1: Build ALL stock deduction rows upfront
            const stockDeductionRows: Array<{
                pid: number; invoice_no: string; qty: number;
                storage_type: string; outlet_id: number;
                itemName: string; // for logging only, not inserted
            }> = [];

            for (const item of cart) {
                const sellingUnit = (item.sellingUnit || 'Piece').toLowerCase();
                const isBagSale = ['bag', 'bags', 'box', 'carton', 'crate', 'pack', 'dozen'].includes(sellingUnit);

                let deductStorageType: string;
                let deductQty: number;

                if (isBagSale) {
                    deductStorageType = 'Bags';
                    deductQty = item.qty;
                } else {
                    deductStorageType = 'Pieces';
                    deductQty = item.qty * (item.unitMultiplier || 1);
                }

                stockDeductionRows.push({
                    pid: item.id,
                    invoice_no: `SALE-${freshReceiptNo}`,
                    qty: -deductQty,
                    storage_type: deductStorageType,
                    outlet_id: outletId,
                    itemName: item.name,
                });
                console.log(`📦 Stock deduct planned: product=${item.id} (${item.name}), qty=-${deductQty}, type=${deductStorageType}, outlet=${outletId}`);
            }

            // Step 2: BATCH INSERT all deductions in ONE Supabase call
            if (stockDeductionRows.length > 0) {
                // Remove itemName before inserting (it's for logging only)
                const dbRows = stockDeductionRows.map(({ itemName, ...row }) => row);
                const { error: batchStockErr } = await supabase.from('retail_stock').insert(dbRows);

                if (batchStockErr) {
                    // BATCH FAILED — fall back to individual inserts with isolation
                    console.warn('⚠️ Batch stock deduction failed, falling back to individual inserts:', batchStockErr.message);

                    for (const row of stockDeductionRows) {
                        try {
                            const { itemName, ...dbRow } = row;
                            const { error: err1 } = await supabase.from('retail_stock').insert(dbRow);
                            if (err1) {
                                // Retry once with different invoice_no
                                console.warn(`⚠️ Individual deduct failed for ${itemName}, retrying:`, err1.message);
                                const { error: err2 } = await supabase.from('retail_stock').insert({
                                    ...dbRow,
                                    invoice_no: `SALE-RETRY-${freshReceiptNo}`,
                                });
                                if (err2) {
                                    console.error(`❌ Stock deduct FAILED for ${itemName} after 2 attempts:`, err2.message);
                                } else {
                                    console.log(`✅ Stock deducted on retry: ${itemName}`);
                                }
                            } else {
                                console.log(`✅ Stock deducted individually: ${itemName}`);
                            }
                        } catch (itemErr) {
                            // Catch ANY error (network timeout, etc.) — continue to next item
                            console.error(`❌ Exception deducting stock for ${row.itemName}:`, itemErr);
                        }
                    }
                } else {
                    console.log(`✅ Batch stock deduction successful: ${stockDeductionRows.length} items deducted in 1 call`);
                }
            }

            // Step 3: AUTO-CONVERT Bags→Pieces if Pieces ran out
            for (const item of cart) {
                const sellingUnit = (item.sellingUnit || 'Piece').toLowerCase();
                const isBagSale = ['bag', 'bags', 'box', 'carton', 'crate', 'pack', 'dozen'].includes(sellingUnit);
                if (!isBagSale) {
                    const piecesPerPkg = item.piecesPerPackage || 1;
                    if (piecesPerPkg > 1) {
                        try {
                            const { data: allStockRows } = await supabase
                                .from('retail_stock')
                                .select('qty, storage_type')
                                .eq('pid', item.id)
                                .eq('outlet_id', outletId);

                            if (allStockRows && allStockRows.length > 0) {
                                let totalBags = 0, totalPieces = 0;
                                allStockRows.forEach((r: any) => {
                                    if ((r.storage_type || '') === 'Bags') totalBags += (r.qty || 0);
                                    else totalPieces += (r.qty || 0);
                                });

                                if (totalPieces <= 0 && totalBags > 0) {
                                    console.log(`🔄 Auto-converting 1 Bag → ${piecesPerPkg} pieces for ${item.name}`);
                                    await supabase.from('retail_stock').insert({
                                        pid: item.id, invoice_no: 'AUTO-CONVERT', qty: -1,
                                        storage_type: 'Bags', outlet_id: outletId,
                                    });
                                    await supabase.from('retail_stock').insert({
                                        pid: item.id, invoice_no: 'AUTO-CONVERT', qty: piecesPerPkg,
                                        storage_type: 'Pieces', outlet_id: outletId,
                                    });
                                    console.log(`✅ Converted: Bags ${totalBags}→${totalBags - 1}, Pieces ${totalPieces}→${totalPieces + piecesPerPkg}`);
                                }
                            }
                        } catch (convertErr) {
                            console.warn('Auto-convert bags→pieces error (non-critical):', convertErr);
                        }
                    }
                }
            }

            // Auto-print receipt for M-Pesa payments
            if (method.toUpperCase() === 'MPESA') {
                try {
                    console.log('🖨️ Auto-printing M-Pesa receipt...');
                    const company = await loadCompanyInfo();
                    const now = new Date();
                    const receiptData: ReceiptData = {
                        invoiceNo: freshReceiptNo,
                        date: now.toLocaleDateString('en-GB'),
                        time: now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
                        cashier: 'Cashier',
                        items: cart.map(item => ({
                            name: `${item.name}${item.unitMultiplier > 1 ? ` (${item.sellingUnit})` : ''}`,
                            qty: item.qty,
                            price: item.effectivePrice,
                            total: (item.effectivePrice * item.qty) - item.discount
                        })),
                        subtotal: subtotal,
                        discount: totalDiscount,
                        tax: 0,
                        total: grandTotal,
                        paymentMethod: 'MPESA',
                        amountPaid: amountPaid,
                        change: 0,
                        customerName: customerName || undefined,
                        customerPhone: customerPhone || undefined,
                        mpesaReceipt: mpesaReceipt || undefined
                    };
                    console.log('🖨️ Receipt data:', receiptData);
                    printMpesaReceipt(receiptData, company);
                    console.log('🖨️ Print function called');
                } catch (printErr) {
                    console.error('❌ Receipt print error:', printErr);
                }
            }


            // Auto-print receipt for Cash payments
            if (method.toUpperCase() === 'CASH') {
                try {
                    const company = await loadCompanyInfo();
                    const now = new Date();
                    const receiptData: ReceiptData = {
                        invoiceNo: freshReceiptNo,
                        date: now.toLocaleDateString('en-GB'),
                        time: now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
                        cashier: 'Cashier',
                        items: cart.map(item => ({
                            name: `${item.name}${item.unitMultiplier > 1 ? ` (${item.sellingUnit})` : ''}`,
                            qty: item.qty,
                            price: item.effectivePrice,
                            total: (item.effectivePrice * item.qty) - item.discount
                        })),
                        subtotal: subtotal,
                        discount: totalDiscount,
                        tax: 0,
                        total: grandTotal,
        paymentMethod: 'CASH',
                        amountPaid: amountPaid,
                        change: Math.max(0, amountPaid - grandTotal),
                        customerName: custName,
                        isPaid: true
                    };
                    printCustomerReceipt(receiptData, company);
                } catch (printErr) {
                    console.error('Cash receipt print error:', printErr);
                }
            }

            // If credit sale, update customer balance + insert credit payment record
            if (method.toUpperCase() === 'CREDIT' && selectedCustomer) {
                const newBalance = (selectedCustomer.current_balance || 0) + grandTotal;
                await supabase.from('retail_credit_customers')
                    .update({ current_balance: newBalance })
                    .eq('customer_id', selectedCustomer.customer_id);

                // Insert credit payment record for statement/history
                await supabase.from('retail_credit_payments').insert({
                    customer_id: selectedCustomer.customer_id,
                    amount: grandTotal,
                    payment_type: 'CREDIT_SALE',
                    payment_method: 'Credit',
                    reference: freshReceiptNo,
                    notes: `Credit sale - ${freshReceiptNo}`,
                    outlet_id: outletId,
                    balance_after: newBalance,
                });
            }

            toast.success('Sale completed successfully!');
            setShowPayment(false);
            setCart([]);
            setSelectedCustomer(null);
            setCustomerSearch('');
            loadNextReceiptNo();
            loadProducts(); // Refresh stock
            loadCreditCustomers(); // Refresh balances
        } catch (err: any) {
            console.error('Error completing sale:', err);
            toast.error(`Failed to complete sale: ${err?.message || err?.details || 'Unknown error'}`);
        }
    };

    return (
        <div className="h-[calc(100vh-64px)] flex flex-col bg-gray-50">
            {/* Top Bar - Breadcrumb & Session */}
            <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <span className="text-gray-400 text-sm">📍 POS - Point of Sale</span>
                    <span className="text-gray-300">|</span>
                    <span className="text-gray-600 text-sm font-medium">{storeName}</span>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-500">
                        {new Date().toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                    <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-sm font-semibold">{receiptNo}</span>
                    {/* Waiter badge + Logout */}
                    {isWaiterUser && (
                        <>
                            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-purple-50 rounded-lg border border-purple-200">
                                <span className="text-xs">👤</span>
                                <span className="text-xs font-semibold text-purple-700">{loggedInUserName}</span>
                            </div>
                            <button
                                onClick={() => { localStorage.removeItem('user'); window.location.href = '/'; }}
                                className="px-2.5 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                                title="Logout"
                            >
                                🚪 Logout
                            </button>
                        </>
                    )}
                    <button
                        onClick={toggleFullscreen}
                        className="p-2 bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white rounded-lg transition-all hover:scale-105 active:scale-95 shadow-md"
                        title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
                    >
                        {isFullscreen ? (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
                            </svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                            </svg>
                        )}
                    </button>
                </div>
            </div>

            {/* ═══ Quick Action Buttons Strip (Light Theme) ═══ */}
            <div className="bg-gradient-to-r from-gray-50 via-white to-gray-50 border-b border-gray-200 px-4 py-2 flex items-center gap-2 overflow-x-auto">
                {[
                    { key: 'purchases', icon: '📥', label: 'Purchases', href: '/dashboard/purchases', cashierEnabled: false },
                    { key: 'stock_available', icon: '📦', label: 'Stock Available', href: '/dashboard/products', cashierEnabled: false },
                    { key: 'expiry_register', icon: '⏰', label: 'Expiry Register', href: '/dashboard/expiry-register', cashierEnabled: false },
                    { key: 'sales_returns', icon: '↩️', label: 'Sales Returns', href: '/dashboard/sales-return', cashierEnabled: true },
                    { key: 'register_history', icon: '🧾', label: 'Register History', href: '/dashboard/shift-reports', cashierEnabled: false },
                    { key: 'reports', icon: '📊', label: 'Reports', href: '/dashboard/reports/sales', cashierEnabled: false },
                    { key: 'sales_summary', icon: '📈', label: 'Sales Summary', href: '/dashboard/sales-summary', cashierEnabled: true },
                    { key: 'expenses', icon: '💸', label: 'Expenses', href: '/dashboard/expenses', cashierEnabled: false },
                    { key: 'payroll', icon: '👥', label: 'Payroll', href: '/dashboard/payroll', cashierEnabled: false },
                ].filter(btn => {
                    // Only show buttons that are enabled for this outlet
                    const qa = activeOutlet?.allowed_quick_actions;
                    if (!qa) return false;
                    return qa[btn.key] === true;
                }).map(btn => {
                    const disabled = isWaiterUser && !btn.cashierEnabled;
                    return disabled ? (
                        <button
                            key={btn.label}
                            disabled
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-lg text-gray-300 cursor-not-allowed border border-gray-200 whitespace-nowrap"
                            title="Admin only"
                        >
                            <span className="text-sm">{btn.icon}</span>
                            <span className="text-[11px] font-medium">{btn.label}</span>
                        </button>
                    ) : (
                        <a
                            key={btn.label}
                            href={btn.href}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-blue-50 rounded-lg text-gray-700 hover:text-blue-700 transition-all hover:scale-105 border border-gray-200 hover:border-blue-300 shadow-sm hover:shadow whitespace-nowrap"
                        >
                            <span className="text-sm">{btn.icon}</span>
                            <span className="text-[11px] font-semibold">{btn.label}</span>
                        </a>
                    );
                })}

                {/* Divider */}
                <div className="h-6 w-px bg-gray-300 mx-1 shrink-0" />

                {/* Low Stock Notification Button */}
                <button
                    onClick={() => setShowLowStockModal(true)}
                    className="relative flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-red-50 rounded-lg text-gray-700 hover:text-red-700 transition-all hover:scale-105 border border-gray-200 hover:border-red-300 shadow-sm hover:shadow whitespace-nowrap"
                >
                    <span className="text-sm">🔔</span>
                    <span className="text-[11px] font-semibold">Low Stock</span>
                    {lowStockItems.length > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center animate-pulse">
                            {lowStockItems.length}
                        </span>
                    )}
                </button>
            </div>

            {/* Main Header */}
            <div className="bg-white border-b border-gray-200 px-4 py-3">
                <div className="flex items-center justify-between gap-4">
                    {/* Left - Store/Branch Dropdown (disabled for waiters) */}
                    <div className="flex items-center gap-4">
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Store/Branch</label>
                            <select className={`px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-700 font-medium focus:outline-none focus:border-blue-500 cursor-pointer min-w-[180px] ${isWaiterUser ? 'opacity-40 pointer-events-none' : ''}`} disabled={isWaiterUser}>
                                <option>🏪 Main Store</option>
                                <option>🏪 Branch 1</option>
                                <option>🏪 Branch 2</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Counter</label>
                            <select className={`px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-700 font-medium focus:outline-none focus:border-blue-500 cursor-pointer min-w-[120px] ${isWaiterUser ? 'opacity-40 pointer-events-none' : ''}`} disabled={isWaiterUser}>
                                <option>Counter 1</option>
                                <option>Counter 2</option>
                            </select>
                        </div>
                    </div>

                    {/* Center - Search */}
                    <div className="flex-1 max-w-xl">
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                            <input
                                ref={searchInputRef}
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyDown={handleSearchKeyDown}
                                placeholder="Search products by name or barcode..."
                                className="w-full pl-11 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                                autoFocus
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => { setSearchQuery(''); searchInputRef.current?.focus(); }}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Right - Customer & Filters */}
                    <div className="flex items-center gap-3">
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Category</label>
                            <select
                                value={selectedCategory || ''}
                                onChange={(e) => {
                                    const catId = Number(e.target.value);
                                    if (catId) {
                                        const cat = categories.find(c => c.category_id === catId);
                                        if (cat) loadCategoryProducts(catId, cat.category_name);
                                    } else {
                                        setSelectedCategory(null);
                                        setCategoryProducts([]);
                                    }
                                }}
                                className="px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-700 focus:outline-none focus:border-blue-500 cursor-pointer min-w-[140px]"
                            >
                                <option value="">All Categories</option>
                                {categories.map(cat => (
                                    <option key={cat.category_id} value={cat.category_id}>
                                        {cat.icon} {cat.category_name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="relative">
                            <label className="block text-xs text-gray-500 mb-1">Customer</label>
                            <div className="relative">
                                <input
                                    value={customerSearch}
                                    onChange={e => { setCustomerSearch(e.target.value); setShowCustomerDropdown(true); if (!e.target.value) setSelectedCustomer(null); }}
                                    onFocus={() => setShowCustomerDropdown(true)}
                                    onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 200)}
                                    placeholder={selectedCustomer ? selectedCustomer.customer_name : '👤 Walk-in Customer'}
                                    className={`px-3 py-2 border rounded-lg bg-gray-50 focus:outline-none focus:border-blue-500 cursor-text min-w-[200px] text-sm ${selectedCustomer ? 'border-blue-400 bg-blue-50 font-semibold text-blue-800' : 'border-gray-200 text-gray-700'}`}
                                />
                                {selectedCustomer && (
                                    <button onClick={() => { setSelectedCustomer(null); setCustomerSearch(''); }}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 text-xs">✕</button>
                                )}
                            </div>
                            {showCustomerDropdown && customerSearch && (
                                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto">
                                    {creditCustomers.filter(c => c.customer_name?.toLowerCase().includes(customerSearch.toLowerCase()) || c.phone?.includes(customerSearch)).length === 0 ? (
                                        <p className="p-3 text-sm text-gray-400">No customers found</p>
                                    ) : (
                                        creditCustomers.filter(c => c.customer_name?.toLowerCase().includes(customerSearch.toLowerCase()) || c.phone?.includes(customerSearch)).slice(0, 8).map(c => (
                                            <button key={c.customer_id} onMouseDown={() => { setSelectedCustomer(c); setCustomerSearch(c.customer_name); setShowCustomerDropdown(false); }}
                                                className="w-full text-left px-3 py-2 hover:bg-blue-50 transition-colors border-b border-gray-50 last:border-0">
                                                <p className="font-semibold text-gray-800 text-sm">{c.customer_name}</p>
                                                <p className="text-[10px] text-gray-500">{c.phone} &bull; Bal: Ksh {(c.current_balance || 0).toLocaleString()}</p>
                                            </button>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Register Open/Close Buttons — disabled for cashiers */}
                    <div className="flex items-center gap-2">
                        {!registerOpen ? (
                            <button
                                onClick={() => setShowOpeningDrop(true)}
                                disabled={isWaiterUser}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${isWaiterUser ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-green-500 hover:bg-green-600 text-white'}`}
                                title={isWaiterUser ? 'Only admins can open the register' : 'Open Register'}
                            >
                                🟢 Open Register
                            </button>
                        ) : (
                            <button
                                onClick={handleCloseRegister}
                                disabled={isWaiterUser}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${isWaiterUser ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-red-500 hover:bg-red-600 text-white'}`}
                                title={isWaiterUser ? 'Only admins can close the register' : 'Close Register'}
                            >
                                🔴 Close Register
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left Side - Products */}
                <div className="flex-1 flex flex-col p-4 overflow-hidden">

                    {/* Products Grid - Filters by search AND category */}
                    <div className="flex-1 overflow-y-auto">
                        {isLoading ? (
                            <div className="flex items-center justify-center h-full text-gray-400">
                                <div className="flex flex-col items-center gap-3">
                                    <div className="w-10 h-10 border-4 border-teal-400/30 border-t-teal-500 rounded-full animate-spin"></div>
                                    <span>Loading products...</span>
                                </div>
                            </div>
                        ) : (
                            <>
                                {/* Filter by search or category */}
                                {(() => {
                                    const displayProducts = searchQuery
                                        ? filteredProducts
                                        : (selectedCategory ? categoryProducts : products);

                                    return displayProducts.length > 0 ? (
                                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                            {displayProducts.map(product => (
                                                <ProductCard
                                                    key={product.id}
                                                    product={product}
                                                    onAdd={() => addToCart(product)}
                                                />
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="flex-1 flex flex-col items-center justify-center text-gray-400 py-12">
                                            <span className="text-5xl mb-3">{searchQuery ? '🔍' : '📦'}</span>
                                            <p className="text-lg font-medium">
                                                {searchQuery ? `No products found for "${searchQuery}"` : 'No products found'}
                                            </p>
                                            <p className="text-sm">
                                                {searchQuery ? 'Try a different search term' : 'Add products in the Products page'}
                                            </p>
                                        </div>
                                    );
                                })()}
                            </>
                        )}
                    </div>
                </div>

                {/* Right Side - Cart */}
                <div className="w-[400px] bg-white flex flex-col border-l border-gray-200 shadow-lg">
                    {/* Cart Header */}
                    <div className="px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white flex items-center justify-between">
                        <h2 className="font-bold flex items-center gap-2">
                            <span>🛒</span> Cart ({cart.length} items)
                        </h2>
                        <div className="flex items-center gap-1.5">
                            {/* Recall / Held Sales Button */}
                            <button
                                onClick={() => setShowHeldSalesModal(true)}
                                className="relative text-sm bg-white/20 hover:bg-white/30 px-3 py-1 rounded-lg transition-colors flex items-center gap-1"
                            >
                                <span>📋</span> Recall
                                {heldSales.length > 0 && (
                                    <span className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-lg animate-pulse">
                                        {heldSales.length}
                                    </span>
                                )}
                            </button>
                            {/* Hold Sale Button */}
                            {cart.length > 0 && (
                                <button
                                    onClick={holdCurrentSale}
                                    className="text-sm bg-amber-500/80 hover:bg-amber-500 px-3 py-1 rounded-lg transition-colors flex items-center gap-1"
                                >
                                    <span>⏸️</span> Hold
                                </button>
                            )}
                            {/* Clear Cart */}
                            {cart.length > 0 && (
                                <button
                                    onClick={clearCart}
                                    className="text-sm bg-white/20 hover:bg-white/30 px-3 py-1 rounded-lg transition-colors"
                                >
                                    Clear
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Cart Items */}
                    <div className="flex-1 overflow-y-auto p-3 space-y-2">
                        {cart.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-gray-400">
                                <span className="text-5xl mb-3">🛒</span>
                                <p className="font-medium">Cart is empty</p>
                                <p className="text-sm">Add products to begin</p>
                            </div>
                        ) : (
                            cart.map(item => (
                                <CartItemRow
                                    key={`${item.id}-${item.sellingUnit}`}
                                    item={item}
                                    onIncrease={() => increaseQty(item.id, item.sellingUnit)}
                                    onDecrease={() => decreaseQty(item.id, item.sellingUnit)}
                                    onRemove={() => removeFromCart(item.id, item.sellingUnit)}
                                    onEditDiscount={() => openDiscountModal(item)}
                                    onSetQty={(qty) => setCartItemQty(item.id, item.sellingUnit, qty)}
                                    canDiscount={canDiscount}
                                />
                            ))
                        )}
                    </div>

                    {/* Cart Summary */}
                    <div className="border-t border-gray-200 p-3 bg-gray-50 space-y-1 shrink-0">
                        <div className="flex justify-between text-sm text-gray-600">
                            <span>Subtotal</span>
                            <span>Ksh {subtotal.toLocaleString()}</span>
                        </div>
                        {totalDiscount > 0 && (
                            <div className="flex justify-between text-sm text-green-600">
                                <span>Discount</span>
                                <span>- Ksh {totalDiscount.toLocaleString()}</span>
                            </div>
                        )}
                        <div className="flex justify-between text-xl font-bold text-gray-800 pt-2 border-t border-gray-300">
                            <span>TOTAL</span>
                            <span>Ksh {grandTotal.toLocaleString()}</span>
                        </div>
                    </div>

                    {/* Pay Button */}
                    <div className="p-3 border-t border-gray-200 shrink-0">
                        <button
                            onClick={() => setShowPayment(true)}
                            disabled={cart.length === 0}
                            className="w-full py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-bold text-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            <span>💳</span>
                            <span>PAY Ksh {grandTotal.toLocaleString()}</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Held Sales Modal */}
            {showHeldSalesModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowHeldSalesModal(false)}>
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-4 text-white flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-bold flex items-center gap-2">📋 Held Sales</h2>
                                <p className="text-amber-100 text-xs mt-0.5">{heldSales.length} transaction{heldSales.length !== 1 ? 's' : ''} on hold</p>
                            </div>
                            <button onClick={() => setShowHeldSalesModal(false)} className="p-2 hover:bg-white/20 rounded-xl text-white text-lg">✕</button>
                        </div>

                        <div className="flex-1 overflow-auto p-4">
                            {heldSales.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                                    <span className="text-5xl mb-3">📋</span>
                                    <p className="font-medium">No held sales</p>
                                    <p className="text-sm">Hold a sale from the cart to see it here</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {heldSales.map(h => {
                                        const heldTime = new Date(h.heldAt);
                                        const minsAgo = Math.floor((Date.now() - heldTime.getTime()) / 60000);
                                        const timeLabel = minsAgo < 1 ? 'Just now' : minsAgo < 60 ? `${minsAgo}m ago` : `${Math.floor(minsAgo / 60)}h ${minsAgo % 60}m ago`;
                                        return (
                                            <div key={h.id} className="bg-white rounded-2xl border-2 border-amber-200 shadow-sm hover:shadow-md transition-all p-4">
                                                <div className="flex items-center justify-between mb-3">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xl">🧾</span>
                                                        <div>
                                                            <p className="font-bold text-gray-800">{h.receiptNo}</p>
                                                            <p className="text-xs text-gray-500">⏱️ {timeLabel}</p>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-lg font-black text-green-600">Ksh {h.total.toLocaleString()}</p>
                                                        <p className="text-xs text-gray-500">{h.itemCount} item{h.itemCount !== 1 ? 's' : ''}</p>
                                                    </div>
                                                </div>

                                                {/* Items preview */}
                                                <div className="bg-gray-50 rounded-xl p-2.5 mb-3 max-h-[100px] overflow-y-auto">
                                                    {h.cart.map((item, idx) => (
                                                        <div key={idx} className="flex justify-between text-xs py-0.5">
                                                            <span className="text-gray-600">{item.name} × {item.qty}</span>
                                                            <span className="font-bold text-gray-800">Ksh {((item.effectivePrice * item.qty) - item.discount).toLocaleString()}</span>
                                                        </div>
                                                    ))}
                                                </div>

                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => recallHeldSale(h.id)}
                                                        className="flex-1 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-bold text-sm hover:shadow-lg transition-all flex items-center justify-center gap-1.5"
                                                    >
                                                        <span>▶️</span> Recall Sale
                                                    </button>
                                                    <button
                                                        onClick={() => deleteHeldSale(h.id)}
                                                        className="py-2.5 px-4 bg-red-50 text-red-500 rounded-xl font-bold text-sm hover:bg-red-100 transition-all"
                                                    >
                                                        🗑️
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <div className="p-4 border-t border-gray-200">
                            <button onClick={() => setShowHeldSalesModal(false)} className="w-full py-3 border-2 border-gray-200 text-gray-600 rounded-xl font-semibold hover:bg-gray-50 transition-colors">Close</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modals */}
            <PaymentModal
                isOpen={showPayment}
                onClose={() => setShowPayment(false)}
                total={grandTotal}
                onComplete={completeSale}
                receiptNo={receiptNo}
                creditCustomers={creditCustomers}
                selectedCustomer={selectedCustomer}
                setSelectedCustomer={setSelectedCustomer}
                loadCreditCustomers={loadCreditCustomers}
            />

            <DiscountModal
                isOpen={showDiscountModal}
                onClose={() => { setShowDiscountModal(false); setEditingCartItem(null); }}
                item={editingCartItem}
                onSave={saveItemDiscount}
            />

                 {/* Unit Picker Modal — shows Retail, Wholesale, Big Qty prices + QUANTITY INPUT */}
            {showUnitPicker && unitPickerProduct && (() => {
                const ppp = unitPickerProduct.piecesPerPackage || 1;
                const retailPrice = unitPickerProduct.retailPrice || unitPickerProduct.salesPrice;
                const wholesalePrice = unitPickerProduct.salesPrice;
                const bigQtyPrice = wholesalePrice * ppp;
                return (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowUnitPicker(false)}>
                    <div className="bg-white rounded-2xl shadow-2xl p-6 w-[440px] max-w-[95vw]" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-bold text-gray-800 mb-1">📦 Select Selling Unit & Price</h3>
                        <p className="text-sm text-gray-500 mb-3">{unitPickerProduct.name}</p>

                        {/* ── QUANTITY INPUT ── */}
                        <div className="mb-4 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
                            <label className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-1.5 block">🔢 Quantity</label>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => {
                                        const el = document.getElementById('unit-picker-qty') as HTMLInputElement;
                                        if (el) { const v = Math.max(1, (parseInt(el.value) || 1) - 1); el.value = v.toString(); }
                                    }}
                                    className="w-10 h-10 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-bold text-xl flex items-center justify-center shadow-sm"
                                >−</button>
                                <input
                                    id="unit-picker-qty"
                                    type="number"
                                    defaultValue={1}
                                    min={1}
                                    className="flex-1 text-center text-2xl font-bold py-2 border-2 border-blue-300 rounded-xl focus:outline-none focus:border-blue-500 bg-white"
                                    onFocus={(e) => e.target.select()}
                                />
                                <button
                                    onClick={() => {
                                        const el = document.getElementById('unit-picker-qty') as HTMLInputElement;
                                        if (el) { const v = (parseInt(el.value) || 1) + 1; el.value = v.toString(); }
                                    }}
                                    className="w-10 h-10 rounded-lg bg-green-500 hover:bg-green-600 text-white font-bold text-xl flex items-center justify-center shadow-sm"
                                >+</button>
                            </div>
                            <div className="flex gap-1.5 mt-2">
                                {[1, 5, 10, 20, 50, 100].map(q => (
                                    <button key={q} onClick={() => {
                                        const el = document.getElementById('unit-picker-qty') as HTMLInputElement;
                                        if (el) el.value = q.toString();
                                    }}
                                    className="flex-1 py-1 bg-white border border-blue-200 hover:bg-blue-100 rounded-lg text-xs font-semibold text-blue-700 transition-colors"
                                    >{q}</button>
                                ))}
                            </div>
                        </div>

                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Per {unitPickerProduct.salesUnit}</p>
                        <div className="space-y-2 mb-4">
                            {/* Retail Price */}
                            <button
                                onClick={() => {
                                    const qty = parseInt((document.getElementById('unit-picker-qty') as HTMLInputElement)?.value) || 1;
                                    addToCartWithUnit(unitPickerProduct, unitPickerProduct.salesUnit || 'Piece', 1, retailPrice, qty);
                                    setShowUnitPicker(false);
                                    setUnitPickerProduct(null);
                                }}
                                className="w-full flex items-center justify-between p-4 rounded-xl border-2 border-blue-200 bg-blue-50 hover:bg-blue-100 transition-all"
                            >
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl">🏷️</span>
                                    <div className="text-left">
                                        <p className="font-bold text-gray-800">Retail Price</p>
                                        <p className="text-xs text-gray-500">Per {unitPickerProduct.salesUnit}</p>
                                    </div>
                                </div>
                                <span className="text-lg font-bold text-blue-700">Ksh {retailPrice.toLocaleString()}</span>
                            </button>

                            {/* Wholesale Price */}
                            <button
                                onClick={() => {
                                    const qty = parseInt((document.getElementById('unit-picker-qty') as HTMLInputElement)?.value) || 1;
                                    addToCartWithUnit(unitPickerProduct, unitPickerProduct.salesUnit || 'Piece', 1, wholesalePrice, qty);
                                    setShowUnitPicker(false);
                                    setUnitPickerProduct(null);
                                }}
                                className="w-full flex items-center justify-between p-4 rounded-xl border-2 border-green-200 bg-green-50 hover:bg-green-100 transition-all"
                            >
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl">💰</span>
                                    <div className="text-left">
                                        <p className="font-bold text-gray-800">Wholesale Price</p>
                                        <p className="text-xs text-gray-500">Per {unitPickerProduct.salesUnit}</p>
                                    </div>
                                </div>
                                <span className="text-lg font-bold text-green-700">Ksh {wholesalePrice.toLocaleString()}</span>
                            </button>
                        </div>

                        {ppp > 1 && (<>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Per {unitPickerProduct.purchaseUnit}</p>
                        <div className="space-y-2">
                            {/* Big Quantity / Bag Price */}
                            <button
                                onClick={() => {
                                    const qty = parseInt((document.getElementById('unit-picker-qty') as HTMLInputElement)?.value) || 1;
                                    addToCartWithUnit(unitPickerProduct, unitPickerProduct.purchaseUnit || 'Bag', ppp, bigQtyPrice, qty);
                                    setShowUnitPicker(false);
                                    setUnitPickerProduct(null);
                                }}
                                className="w-full flex items-center justify-between p-4 rounded-xl border-2 border-purple-200 bg-purple-50 hover:bg-purple-100 transition-all"
                            >
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl">📦</span>
                                    <div className="text-left">
                                        <p className="font-bold text-gray-800">Per {unitPickerProduct.purchaseUnit}</p>
                                        <p className="text-xs text-gray-500">1 {unitPickerProduct.purchaseUnit} = {ppp} {unitPickerProduct.salesUnit}</p>
                                    </div>
                                </div>
                                <span className="text-lg font-bold text-purple-700">Ksh {bigQtyPrice.toLocaleString()}</span>
                            </button>
                        </div>
                        </>)}

                        <button
                            onClick={() => { setShowUnitPicker(false); setUnitPickerProduct(null); }}
                            className="w-full mt-4 py-2 text-sm text-gray-500 hover:text-gray-700 font-medium"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
                );
            })()}

            {/* Opening Drop Modal */}
            {showOpeningDrop && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl shadow-2xl p-6 w-[420px] max-w-[95vw]">
                        <h3 className="text-xl font-bold text-gray-800 mb-2 flex items-center gap-2">
                            🟢 Open Register
                        </h3>
                        <p className="text-sm text-gray-500 mb-4">Enter the opening cash amount in the register drawer.</p>

                        <div className="mb-4">
                            <label className="text-sm font-medium text-gray-600 mb-2 block">💰 Opening Cash Amount</label>
                            <input
                                type="number"
                                value={openingDropAmount}
                                onChange={(e) => setOpeningDropAmount(e.target.value)}
                                placeholder="Enter amount (e.g., 5000)"
                                className="w-full p-4 bg-gray-50 border-2 border-gray-200 rounded-xl focus:border-green-500 focus:outline-none text-xl font-bold text-center"
                                autoFocus
                            />
                        </div>
                        <div className="grid grid-cols-4 gap-2 mb-4">
                            {[0, 1000, 2000, 5000].map(amt => (
                                <button
                                    key={amt}
                                    onClick={() => setOpeningDropAmount(amt.toString())}
                                    className="py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-700 font-medium transition-colors text-sm"
                                >
                                    {amt === 0 ? 'Zero' : `Ksh ${amt.toLocaleString()}`}
                                </button>
                            ))}
                        </div>

                        <div className="p-4 bg-green-50 rounded-xl border border-green-200 mb-4 text-center">
                            <span className="text-green-700 font-medium text-sm">Opening Cash: </span>
                            <span className="text-2xl font-bold text-green-600">Ksh {(Number(openingDropAmount) || 0).toLocaleString()}</span>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => { setShowOpeningDrop(false); setOpeningDropAmount(''); }}
                                className="flex-1 py-3 border-2 border-gray-200 text-gray-600 rounded-xl font-semibold hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleOpenRegister}
                                className="flex-1 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-bold hover:shadow-lg transition-all"
                            >
                                ✅ Open Register
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Close Register Modal */}
            {showCloseRegister && closeRegisterData && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl shadow-2xl p-6 w-[480px] max-w-[95vw] max-h-[90vh] overflow-y-auto">
                        <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                            🔴 Close Register — End of Day Report
                        </h3>

                        {/* Sales Breakdown */}
                        <div className="space-y-2 mb-4">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Sales Breakdown</p>
                            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                                <span className="text-gray-600">💵 Cash Sales</span>
                                <span className="font-bold text-gray-800 text-lg">Ksh {closeRegisterData.totalCash.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                                <span className="text-gray-600">📱 M-Pesa Sales</span>
                                <span className="font-bold text-green-600 text-lg">Ksh {closeRegisterData.totalMpesa.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                                <span className="text-gray-600">📋 Credit Sales</span>
                                <span className="font-bold text-orange-600 text-lg">Ksh {closeRegisterData.totalCredit.toLocaleString()}</span>
                            </div>
                        </div>

                        {/* Total Sales */}
                        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl p-4 text-white mb-4">
                            <div className="flex justify-between items-center">
                                <span className="font-medium">Total Sales ({closeRegisterData.orderCount} orders)</span>
                                <span className="text-2xl font-bold">Ksh {closeRegisterData.totalSales.toLocaleString()}</span>
                            </div>
                        </div>

                        {/* Deductions */}
                        <div className="space-y-2 mb-4">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Deductions</p>
                            <div className="flex justify-between items-center p-3 bg-red-50 rounded-xl border border-red-200">
                                <span className="text-red-600">💰 Total Expenses</span>
                                <span className="font-bold text-red-600 text-lg">-Ksh {closeRegisterData.totalExpenses.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-orange-50 rounded-xl border border-orange-200">
                                <span className="text-orange-600">📋 Total Credit</span>
                                <span className="font-bold text-orange-600 text-lg">-Ksh {closeRegisterData.totalCredit.toLocaleString()}</span>
                            </div>
                        </div>

                        {/* Cash Summary */}
                        <div className="space-y-2 mb-4">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Cash Summary</p>
                            <div className="flex justify-between items-center p-3 bg-green-50 rounded-xl">
                                <span className="text-gray-600">🟢 Opening Cash</span>
                                <span className="font-bold text-gray-800">Ksh {closeRegisterData.openingCash.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-green-50 rounded-xl">
                                <span className="text-gray-600">Expected in Drawer</span>
                                <span className="font-bold text-gray-800">Ksh {(closeRegisterData.openingCash + closeRegisterData.totalCash - closeRegisterData.totalExpenses).toLocaleString()}</span>
                            </div>
                        </div>

                        {/* Net Sales */}
                        <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl p-4 text-white mb-6">
                            <div className="flex justify-between items-center">
                                <span className="font-bold text-lg">NET SALES</span>
                                <span className="text-3xl font-bold">Ksh {closeRegisterData.netSales.toLocaleString()}</span>
                            </div>
                        </div>

                        {/* Profit */}
                        <div className={`rounded-xl p-4 mb-6 ${(closeRegisterData?.profit || 0) >= 0 ? 'bg-gradient-to-r from-amber-400 to-yellow-500' : 'bg-gradient-to-r from-red-500 to-red-600'} text-white`}>
                            <div className="flex justify-between items-center">
                                <span className="font-bold text-lg">📈 PROFIT</span>
                                <span className="text-3xl font-bold">Ksh {(closeRegisterData?.profit || 0).toLocaleString()}</span>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-3">
                            <button
                                onClick={() => { setShowCloseRegister(false); setCloseRegisterData(null); }}
                                className="flex-1 py-3 border-2 border-gray-200 text-gray-600 rounded-xl font-semibold hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={printCloseRegisterReport}
                                className="flex-1 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                            >
                                🖨️ Print Report
                            </button>
                            <button
                                onClick={finalizeCloseRegister}
                                className="flex-1 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl font-bold hover:shadow-lg transition-all"
                            >
                                ✅ Close & Save
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ EXPIRY BATCH SELECTION MODAL (only for expiry-enabled outlets) ═══ */}
            {showBatchModal && batchModalProduct && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowBatchModal(false)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div className="bg-gradient-to-r from-orange-500 to-red-500 px-6 py-4 text-white rounded-t-2xl flex items-center justify-between shrink-0">
                            <div>
                                <h2 className="text-lg font-bold flex items-center gap-2">{'\u23f0'} Select Batch</h2>
                                <p className="text-xs text-white/80 mt-0.5">{batchModalProduct.name} — First Expiry First Out</p>
                            </div>
                            <button onClick={() => setShowBatchModal(false)} className="p-1.5 hover:bg-white/20 rounded-lg text-white font-bold text-lg">{'\u2715'}</button>
                        </div>

                        {/* Content */}
                        <div className="overflow-y-auto p-4 space-y-2 flex-1">
                            {loadingBatches ? (
                                <div className="flex flex-col items-center justify-center py-12">
                                    <div className="w-10 h-10 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin" />
                                    <p className="mt-3 text-sm text-gray-500">Loading batches...</p>
                                </div>
                            ) : productBatches.length === 0 ? (
                                <div className="text-center py-12">
                                    <p className="text-4xl mb-3">{'\ud83d\udce6'}</p>
                                    <p className="font-medium text-gray-600">No batches found for this product</p>
                                    <p className="text-sm text-gray-400 mt-1">Add batches in Products {'\u2192'} Expiry Management</p>
                                    <button
                                        onClick={() => {
                                            setShowBatchModal(false);
                                            // Let them add without batch for now
                                            setUnitPickerProduct(batchModalProduct);
                                            setShowUnitPicker(true);
                                        }}
                                        className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-xl text-sm font-medium hover:bg-blue-600"
                                    >
                                        Add Without Batch
                                    </button>
                                </div>
                            ) : (
                                <>
                                    {/* Legend */}
                                    <div className="flex gap-2 mb-2 text-[10px] font-medium">
                                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full">{'\ud83d\udfe2'} OK</span>
                                        <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full">{'\ud83d\udfe0'} 2-7 days</span>
                                        <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full">{'\ud83d\udd34'} {'\u2264'}2 days (warn)</span>
                                        <span className="px-2 py-0.5 bg-gray-800 text-white rounded-full">{'\u26d4'} Expired (blocked)</span>
                                    </div>

                                    {productBatches.map(batch => {
                                        const isExpired = batch.daysLeft <= 0;
                                        const isBlocked = batch.daysLeft <= 1;
                                        const isWarning = batch.daysLeft <= 2;
                                        const isSoon = batch.daysLeft <= 7;

                                        let bgColor = 'bg-white border-emerald-200 hover:border-emerald-400';
                                        let badgeColor = 'bg-emerald-100 text-emerald-700';
                                        let badgeText = `${batch.daysLeft}d left`;

                                        if (isExpired) {
                                            bgColor = 'bg-gray-100 border-red-300 opacity-60';
                                            badgeColor = 'bg-red-600 text-white';
                                            badgeText = 'EXPIRED';
                                        } else if (isBlocked) {
                                            bgColor = 'bg-red-50 border-red-300';
                                            badgeColor = 'bg-red-500 text-white';
                                            badgeText = `${batch.daysLeft}d - BLOCKED`;
                                        } else if (isWarning) {
                                            bgColor = 'bg-orange-50 border-orange-300';
                                            badgeColor = 'bg-orange-500 text-white';
                                            badgeText = `${batch.daysLeft}d left ⚠️`;
                                        } else if (isSoon) {
                                            bgColor = 'bg-amber-50 border-amber-200';
                                            badgeColor = 'bg-amber-100 text-amber-700';
                                            badgeText = `${batch.daysLeft}d left`;
                                        }

                                        return (
                                            <button
                                                key={batch.batch_id}
                                                onClick={() => handleBatchSelect(batch)}
                                                disabled={isBlocked}
                                                className={`w-full p-4 rounded-xl border-2 text-left transition-all ${bgColor} ${isBlocked ? 'cursor-not-allowed' : 'cursor-pointer hover:shadow-md active:scale-[0.98]'}`}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <p className="font-bold text-gray-800 text-sm">
                                                            {batch.batch_number || `Batch #${batch.batch_id}`}
                                                        </p>
                                                        <p className="text-xs text-gray-500 mt-0.5">
                                                            Expires: {new Date(batch.expiry_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                        </p>
                                                        <p className="text-xs text-gray-400 mt-0.5">
                                                            Qty: {batch.qty_remaining} remaining
                                                        </p>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${badgeColor}`}>
                                                            {badgeText}
                                                        </span>
                                                        {!isBlocked && (
                                                            <p className="text-xs text-blue-600 font-medium mt-1">{'\u2192'} Select</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-3 border-t bg-gray-50 rounded-b-2xl shrink-0">
                            <button onClick={() => setShowBatchModal(false)} className="w-full py-2.5 border-2 border-gray-200 text-gray-600 font-bold rounded-xl text-sm hover:bg-gray-100">
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Loading Register Overlay */}
            {isLoadingRegister && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl p-6 flex items-center gap-3">
                        <div className="w-6 h-6 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        <span className="font-medium text-gray-700">Loading register data...</span>
                    </div>
                </div>
            )}

            {/* ═══ Low Stock Notification Modal ═══ */}
            {showLowStockModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowLowStockModal(false)}>
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="bg-gradient-to-r from-red-500 to-orange-500 px-6 py-4 text-white flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-bold flex items-center gap-2">🔔 Low Stock Alert</h2>
                                <p className="text-red-100 text-xs mt-0.5">{lowStockItems.length} product{lowStockItems.length !== 1 ? 's' : ''} below 10 pieces</p>
                            </div>
                            <button onClick={() => setShowLowStockModal(false)} className="p-2 hover:bg-white/20 rounded-xl text-white text-lg">✕</button>
                        </div>

                        <div className="flex-1 overflow-auto">
                            {lowStockItems.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                                    <span className="text-5xl mb-3">✅</span>
                                    <p className="font-medium">All stock levels are good!</p>
                                    <p className="text-sm">No products below 10 pieces</p>
                                </div>
                            ) : (
                                <table className="w-full">
                                    <thead className="bg-gray-50 sticky top-0">
                                        <tr>
                                            <th className="text-left py-3 px-4 text-xs font-bold text-gray-500 uppercase">#</th>
                                            <th className="text-left py-3 px-4 text-xs font-bold text-gray-500 uppercase">Product</th>
                                            <th className="text-center py-3 px-4 text-xs font-bold text-gray-500 uppercase">Bags</th>
                                            <th className="text-center py-3 px-4 text-xs font-bold text-gray-500 uppercase">Pieces</th>
                                            <th className="text-center py-3 px-4 text-xs font-bold text-gray-500 uppercase">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {lowStockItems.map((item, i) => {
                                            const status = item.pieceQty === 0 ? 'out' : item.pieceQty <= 3 ? 'critical' : 'low';
                                            return (
                                                <tr key={i} className={`transition-colors ${status === 'out' ? 'bg-red-50' : status === 'critical' ? 'bg-orange-50' : 'hover:bg-yellow-50/50'}`}>
                                                    <td className="py-3 px-4 text-sm text-gray-400">{i + 1}</td>
                                                    <td className="py-3 px-4">
                                                        <p className="font-semibold text-gray-800 text-sm">{item.name}</p>
                                                    </td>
                                                    <td className="py-3 px-4 text-center">
                                                        <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs font-bold">
                                                            📦 {item.bagQty} {item.purchaseUnit}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-4 text-center">
                                                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${item.pieceQty === 0 ? 'bg-red-200 text-red-800' : item.pieceQty <= 3 ? 'bg-orange-200 text-orange-800' : 'bg-yellow-200 text-yellow-800'}`}>
                                                            🔢 {item.pieceQty} {item.salesUnit}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-4 text-center">
                                                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold ${
                                                            status === 'out' ? 'bg-red-200 text-red-800' :
                                                            status === 'critical' ? 'bg-orange-200 text-orange-800' :
                                                            'bg-yellow-200 text-yellow-800'
                                                        }`}>
                                                            {status === 'out' ? '❌ OUT' : status === 'critical' ? '🔴 CRITICAL' : '🟡 LOW'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        <div className="p-4 border-t border-gray-200 flex gap-2">
                            <a href="/dashboard/low-stock" className="flex-1 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl font-semibold text-center hover:shadow-lg transition-all text-sm">
                                📦 View Full Stock Report
                            </a>
                            <button onClick={() => setShowLowStockModal(false)} className="px-6 py-3 border-2 border-gray-200 text-gray-600 rounded-xl font-semibold hover:bg-gray-50 transition-colors text-sm">Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
