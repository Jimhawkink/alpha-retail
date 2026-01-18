'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';

// Types for Retail POS
interface Product {
    id: number;
    name: string;
    barcode: string;
    category: string;
    availableQty: number;
    costPrice: number;
    salesPrice: number;
    color?: string;
    imageUrl?: string;
}

interface CartItem extends Product {
    qty: number;
    discount: number;
}

interface Category {
    category_id: number;
    category_name: string;
    icon: string;
    color: string;
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
            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${product.availableQty > 10
                ? 'bg-green-100 text-green-700'
                : product.availableQty > 0
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-red-100 text-red-700'
                }`}>
                {product.availableQty}
            </span>
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

// Cart Item Row Component
const CartItemRow = ({
    item,
    onIncrease,
    onDecrease,
    onRemove,
    onEditDiscount
}: {
    item: CartItem;
    onIncrease: () => void;
    onDecrease: () => void;
    onRemove: () => void;
    onEditDiscount: () => void;
}) => {
    const itemTotal = (item.salesPrice * item.qty) - item.discount;

    return (
        <div className="bg-white rounded-xl p-3 space-y-2 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 text-sm truncate">{item.name}</p>
                    <p className="text-xs text-gray-500">@ Ksh {item.salesPrice.toLocaleString()}</p>
                    {item.barcode && (
                        <p className="text-xs text-gray-400 font-mono">{item.barcode}</p>
                    )}
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={onDecrease}
                        className="w-8 h-8 rounded-lg bg-orange-500 hover:bg-orange-600 flex items-center justify-center font-bold text-white transition-colors text-lg shadow-sm"
                    >
                        −
                    </button>
                    <span className="w-8 text-center font-bold text-gray-800">{item.qty}</span>
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
            <button
                onClick={onEditDiscount}
                className="w-full py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600 transition-colors font-medium"
            >
                💰 Discount
            </button>
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
                <img src={product.imageUrl} alt={product.name} className="max-h-[100px] max-w-[100px] object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            ) : (
                <div className="w-14 h-14 bg-gray-100 rounded-lg flex items-center justify-center"><span className="text-xl" title="No image">📦</span></div>
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
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${product.availableQty === 0 ? 'bg-red-100 text-red-600' : product.availableQty < 10 ? 'bg-amber-100 text-amber-600' : 'bg-teal-100 text-teal-600'}`}>
                    {product.availableQty === 0 ? 'Out' : `${product.availableQty} Pcs`}
                </span>
            </div>
            <button onClick={(e) => { e.stopPropagation(); if (product.availableQty > 0) onAdd(); }} disabled={product.availableQty === 0}
                className={`w-full py-1.5 rounded-lg text-[11px] font-medium flex items-center justify-center gap-1 ${product.availableQty === 0 ? 'bg-gray-100 text-gray-400' : 'bg-emerald-500 text-white hover:bg-emerald-600 active:scale-[0.98]'}`}>
                + Add to Cart
            </button>
        </div>
    </div>
);

// Payment Modal
const PaymentModal = ({
    isOpen,
    onClose,
    total,
    onComplete,
    receiptNo
}: {
    isOpen: boolean;
    onClose: () => void;
    total: number;
    onComplete: (method: string, amountPaid: number, mpesaReceipt?: string, customerName?: string) => void;
    receiptNo: string;
}) => {
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [amountPaid, setAmountPaid] = useState('');
    const [mpesaPhone, setMpesaPhone] = useState('');
    const [mpesaReceipt, setMpesaReceipt] = useState('');
    const [customerName, setCustomerName] = useState('');

    const change = paymentMethod === 'cash' ? Math.max(0, Number(amountPaid) - total) : 0;
    const quickAmounts = [100, 200, 500, 1000, 2000, 5000];

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl">
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
                            onClick={() => setPaymentMethod(method.id)}
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
                    </div>
                )}

                {/* M-Pesa Input */}
                {paymentMethod === 'mpesa' && (
                    <div className="space-y-4 mb-6">
                        <div>
                            <label className="text-sm font-medium text-gray-600 mb-2 block">Phone Number</label>
                            <input
                                type="tel"
                                value={mpesaPhone}
                                onChange={(e) => setMpesaPhone(e.target.value)}
                                placeholder="0712345678"
                                className="w-full p-4 bg-gray-50 border-2 border-gray-200 rounded-xl focus:border-green-500 focus:outline-none text-lg"
                            />
                        </div>
                        <button className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2">
                            <span>📤</span> Send STK Push
                        </button>
                        <div>
                            <label className="text-sm font-medium text-gray-600 mb-2 block">M-Pesa Receipt (Optional)</label>
                            <input
                                type="text"
                                value={mpesaReceipt}
                                onChange={(e) => setMpesaReceipt(e.target.value)}
                                placeholder="e.g. QJK2A5B..."
                                className="w-full p-3 bg-gray-50 border-2 border-gray-200 rounded-xl focus:border-green-500 focus:outline-none"
                            />
                        </div>
                    </div>
                )}

                {/* Credit Customer */}
                {paymentMethod === 'credit' && (
                    <div className="space-y-4 mb-6">
                        <div>
                            <label className="text-sm font-medium text-gray-600 mb-2 block">Customer Name</label>
                            <input
                                type="text"
                                value={customerName}
                                onChange={(e) => setCustomerName(e.target.value)}
                                placeholder="Enter customer name..."
                                className="w-full p-4 bg-gray-50 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none text-lg"
                            />
                        </div>
                        <div className="p-4 bg-orange-50 rounded-xl border border-orange-200">
                            <p className="text-orange-700 text-sm">⚠️ This sale will be recorded as credit</p>
                        </div>
                    </div>
                )}

                {/* Actions */}
                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 border-2 border-gray-200 text-gray-600 rounded-xl font-semibold hover:bg-gray-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onComplete(paymentMethod, Number(amountPaid) || total, mpesaReceipt, customerName)}
                        className="flex-1 py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-bold text-lg hover:shadow-lg transition-all flex items-center justify-center gap-2"
                    >
                        <span>✅</span>
                        <span>Complete Sale</span>
                    </button>
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

// Main Retail POS Page
export default function RetailPOSPage() {
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

    const searchInputRef = useRef<HTMLInputElement>(null);

    // Load products from database
    const loadProducts = useCallback(async () => {
        setIsLoading(true);
        try {
            // Load products from retail_products table
            const { data, error } = await supabase
                .from('retail_products')
                .select('*')
                .eq('active', true)
                .order('product_name');

            if (error) throw error;

            // Load stock data from retail_stock table
            const { data: stockData } = await supabase
                .from('retail_stock')
                .select('pid, qty');

            // Build stock map
            const stockMap: Record<number, number> = {};
            (stockData || []).forEach((s) => {
                stockMap[s.pid] = (stockMap[s.pid] || 0) + (s.qty || 0);
            });

            // Transform to POS format
            const posProducts: Product[] = (data || []).map(p => ({
                id: p.pid,
                name: p.product_name,
                barcode: p.barcode || '',
                category: p.category || 'Uncategorized',
                availableQty: stockMap[p.pid] || 0,
                costPrice: p.purchase_cost || 0,
                salesPrice: p.sales_cost || 0,
                color: p.button_ui_color || 'from-blue-400 to-blue-600',
                imageUrl: p.photo || '',
            }));

            setProducts(posProducts);
        } catch (err) {
            console.error('Error loading products:', err);
            toast.error('Failed to load products');
        }
        setIsLoading(false);
    }, []);

    // Load categories from database
    const loadCategories = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('retail_categories')
                .select('*')
                .eq('active', true)
                .order('category_name');

            if (error) throw error;

            setCategories(data || []);
        } catch (err) {
            console.error('Error loading categories:', err);
        }
    }, []);

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

    // Generate next receipt number
    const loadNextReceiptNo = useCallback(async () => {
        try {
            const { data } = await supabase
                .from('retail_sales')
                .select('receipt_no')
                .order('sale_id', { ascending: false })
                .limit(1)
                .single();

            if (data?.receipt_no) {
                const match = data.receipt_no.match(/RCP-(\d+)/);
                if (match) {
                    const nextNum = parseInt(match[1]) + 1;
                    setReceiptNo(`RCP-${String(nextNum).padStart(5, '0')}`);
                }
            }
        } catch {
            setReceiptNo('RCP-00001');
        }
    }, []);

    // Initial load
    useEffect(() => {
        loadProducts();
        loadCategories();
        loadStoreName();
        loadNextReceiptNo();
    }, [loadProducts, loadCategories, loadStoreName, loadNextReceiptNo]);

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
    const addToCart = useCallback((product: Product) => {
        if (product.availableQty === 0) {
            toast.error('Out of stock!');
            return;
        }

        setCart(prev => {
            const existing = prev.find(item => item.id === product.id);
            if (existing) {
                return prev.map(item =>
                    item.id === product.id
                        ? { ...item, qty: item.qty + 1 }
                        : item
                );
            }
            return [...prev, { ...product, qty: 1, discount: 0 }];
        });

        toast.success(`${product.name} added`);
        setSearchQuery('');
        searchInputRef.current?.focus();
    }, []);

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

    // Cart operations
    const increaseQty = (id: number) => {
        setCart(prev => prev.map(item =>
            item.id === id ? { ...item, qty: item.qty + 1 } : item
        ));
    };

    const decreaseQty = (id: number) => {
        setCart(prev => prev.map(item =>
            item.id === id && item.qty > 1 ? { ...item, qty: item.qty - 1 } : item
        ).filter(item => item.qty > 0));
    };

    const removeFromCart = (id: number) => {
        setCart(prev => prev.filter(item => item.id !== id));
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
                item.id === editingCartItem.id ? { ...item, discount } : item
            ));
        }
    };

    // Calculate totals
    const subtotal = cart.reduce((sum, item) => sum + (item.salesPrice * item.qty), 0);
    const totalDiscount = cart.reduce((sum, item) => sum + item.discount, 0);
    const grandTotal = subtotal - totalDiscount;

    // Complete sale
    const completeSale = async (method: string, amountPaid: number, mpesaReceipt?: string, customerName?: string) => {
        try {
            // Create sale record in retail_sales table
            const { data: sale, error: saleError } = await supabase
                .from('retail_sales')
                .insert([{
                    receipt_no: receiptNo,
                    sale_date: new Date().toISOString().split('T')[0],
                    sale_datetime: new Date().toISOString(),
                    customer_name: customerName || 'Walk-in Customer',
                    subtotal: subtotal,
                    discount: totalDiscount,
                    total_amount: grandTotal,
                    payment_method: method.toUpperCase(),
                    amount_paid: amountPaid,
                    change_amount: Math.max(0, amountPaid - grandTotal),
                    mpesa_code: mpesaReceipt,
                    status: 'Completed'
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
                unit_price: item.salesPrice,
                cost_price: item.costPrice,
                discount: item.discount,
                subtotal: (item.salesPrice * item.qty) - item.discount
            }));

            await supabase.from('retail_sales_items').insert(saleItems);

            // Update stock (decrease) using retail function
            for (const item of cart) {
                await supabase.rpc('retail_decrease_stock', {
                    p_product_id: item.id,
                    p_qty: item.qty
                });
            }

            toast.success('Sale completed successfully!');
            setShowPayment(false);
            setCart([]);
            loadNextReceiptNo();
            loadProducts(); // Refresh stock
        } catch (err) {
            console.error('Error completing sale:', err);
            toast.error('Failed to complete sale');
        }
    };

    return (
        <div className="h-screen flex flex-col bg-gray-50">
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
                </div>
            </div>

            {/* Main Header */}
            <div className="bg-white border-b border-gray-200 px-4 py-3">
                <div className="flex items-center justify-between gap-4">
                    {/* Left - Store/Branch Dropdown */}
                    <div className="flex items-center gap-4">
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Store/Branch</label>
                            <select className="px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-700 font-medium focus:outline-none focus:border-blue-500 cursor-pointer min-w-[180px]">
                                <option>🏪 Main Store</option>
                                <option>🏪 Branch 1</option>
                                <option>🏪 Branch 2</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Counter</label>
                            <select className="px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-700 font-medium focus:outline-none focus:border-blue-500 cursor-pointer min-w-[120px]">
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
                        <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg">
                            <span className="text-gray-500">👤</span>
                            <span className="text-gray-700 font-medium text-sm">Walk-in Customer</span>
                        </div>
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
                        {cart.length > 0 && (
                            <button
                                onClick={clearCart}
                                className="text-sm bg-white/20 hover:bg-white/30 px-3 py-1 rounded-lg transition-colors"
                            >
                                Clear
                            </button>
                        )}
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
                                    key={item.id}
                                    item={item}
                                    onIncrease={() => increaseQty(item.id)}
                                    onDecrease={() => decreaseQty(item.id)}
                                    onRemove={() => removeFromCart(item.id)}
                                    onEditDiscount={() => openDiscountModal(item)}
                                />
                            ))
                        )}
                    </div>

                    {/* Cart Summary */}
                    <div className="border-t border-gray-200 p-4 bg-gray-50 space-y-2">
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
                    <div className="p-4 border-t border-gray-200">
                        <button
                            onClick={() => setShowPayment(true)}
                            disabled={cart.length === 0}
                            className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-2xl font-bold text-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            <span>💳</span>
                            <span>PAY Ksh {grandTotal.toLocaleString()}</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Modals */}
            <PaymentModal
                isOpen={showPayment}
                onClose={() => setShowPayment(false)}
                total={grandTotal}
                onComplete={completeSale}
                receiptNo={receiptNo}
            />

            <DiscountModal
                isOpen={showDiscountModal}
                onClose={() => { setShowDiscountModal(false); setEditingCartItem(null); }}
                item={editingCartItem}
                onSave={saveItemDiscount}
            />
        </div>
    );
}
