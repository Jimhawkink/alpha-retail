'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import { HospitalReceipt } from '@/components/HospitalReceipt';

// Types
interface HospitalService {
    service_id: number;
    service_name: string;
    category: string;
    price: number;
}

interface CartItem extends HospitalService {
    qty: number;
}

export default function HospitalPOSPage() {
    // State
    const [services, setServices] = useState<HospitalService[]>([]);
    const [filteredServices, setFilteredServices] = useState<HospitalService[]>([]);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [customerName, setCustomerName] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('All Categories');
    const [receiptNo, setReceiptNo] = useState('RCP-00020');
    const [isLoading, setIsLoading] = useState(true);
    const [showReceipt, setShowReceipt] = useState(false);
    const [printData, setPrintData] = useState<any>(null);
    const [currentDate, setCurrentDate] = useState('');

    // Static Data
    const hospitalInfo = {
        name: "ALPHA PLUS HOSPITAL",
        address: "123 Medical Plaza, Nairobi",
        phone: "0720316175",
        pin: "P051234567X"
    };

    const categories = ['All Categories', 'Registration', 'Consultation', 'Laboratory', 'Pharmacy', 'Radiology', 'Dental', 'Procedure'];

    // Effects
    useEffect(() => {
        loadInitData();
        const date = new Date();
        setCurrentDate(date.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }));
    }, []);

    useEffect(() => {
        const query = searchQuery.toLowerCase();
        setFilteredServices(
            services.filter(s => {
                const matchesSearch = s.service_name.toLowerCase().includes(query);
                const matchesCategory = selectedCategory === 'All Categories' || s.category === selectedCategory;
                return matchesSearch && matchesCategory;
            })
        );
    }, [searchQuery, services, selectedCategory]);

    // Functions
    const loadInitData = async () => {
        setIsLoading(true);
        try {
            const { data } = await supabase.from('hospital_services').select('*').eq('active', true);
            setServices(data || []);
            setFilteredServices(data || []);

            // Get next receipt number
            const { data: saleData } = await supabase
                .from('hospital_sales')
                .select('receipt_no')
                .order('sale_id', { ascending: false })
                .limit(1);

            if (saleData?.[0]?.receipt_no) {
                const match = saleData[0].receipt_no.match(/RCP-(\d+)/);
                if (match) {
                    const nextNum = parseInt(match[1]) + 1;
                    setReceiptNo(`RCP-${String(nextNum).padStart(5, '0')}`);
                }
            }
        } catch (err) {
            console.error(err);
        }
        setIsLoading(false);
    };

    const addToCart = (service: HospitalService) => {
        setCart(prev => {
            const existing = prev.find(item => item.service_id === service.service_id);
            if (existing) {
                return prev.map(item => item.service_id === service.service_id ? { ...item, qty: item.qty + 1 } : item);
            }
            return [...prev, { ...service, qty: 1 }];
        });
        toast.success('Added to cart');
    };

    const updateQty = (id: number, delta: number) => {
        setCart(prev => prev.map(item => {
            if (item.service_id === id) {
                const newQty = Math.max(1, item.qty + delta);
                return { ...item, qty: newQty };
            }
            return item;
        }));
    };

    const removeFromCart = (id: number) => {
        setCart(prev => prev.filter(item => item.service_id !== id));
    };

    const total = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

    const completeSale = async (method: string) => {
        if (cart.length === 0) return;

        try {
            const userData = localStorage.getItem('user');
            const currentUser = userData ? JSON.parse(userData) : null;
            const vHash = Math.random().toString(36).substring(2, 10).toUpperCase();

            // Save Sale
            const { data: sale, error } = await supabase
                .from('hospital_sales')
                .insert({
                    receipt_no: receiptNo,
                    patient_name: customerName || 'Walk-in Customer',
                    total_amount: total,
                    payment_method: method,
                    status: 'Completed',
                    created_by: currentUser?.userId,
                    verification_hash: vHash
                })
                .select()
                .single();

            if (error) throw error;

            // Save Items
            const items = cart.map(item => ({
                sale_id: sale.sale_id,
                service_id: item.service_id,
                service_name: item.service_name,
                price: item.price,
                quantity: item.qty,
                subtotal: item.price * item.qty
            }));

            await supabase.from('hospital_sales_items').insert(items);

            setPrintData({
                receiptNo,
                patientName: customerName || 'Walk-in Customer',
                items: [...cart],
                total,
                date: new Date().toLocaleString(),
                verificationHash: vHash
            });
            setShowReceipt(true);
            setCart([]);
            loadInitData();
            toast.success('Sale Completed');

        } catch (err) {
            toast.error('Transaction Failed');
        }
    }

    const handlePrint = () => {
        window.print();
        setShowReceipt(false);
    };

    const toggleFullScreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
    };

    return (
        <div className="h-[calc(100vh-theme(spacing.16))] flex flex-col bg-slate-50 font-sans text-slate-800 p-6">
            <div className="flex gap-6 h-full">

                {/* Left Side - Product Grid */}
                <div className="flex-1 flex flex-col gap-6 h-full overflow-hidden">

                    {/* Header Bar */}
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-3">
                            <span className="text-rose-500 text-xs font-bold">📍 POS - Point of Sale</span>
                            <span className="text-slate-300">|</span>
                            <span className="text-slate-500 text-sm font-medium">HOSPITAL</span>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                                <span className="text-emerald-600 text-xs font-bold uppercase">Online</span>
                            </div>
                            <span className="text-xs font-bold text-slate-400">{currentDate}</span>
                            <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-md text-xs font-bold border border-blue-100">{receiptNo}</span>
                            <button onClick={toggleFullScreen} className="w-8 h-8 bg-slate-800 text-white rounded-lg flex items-center justify-center hover:bg-black transition-colors">
                                ⛶
                            </button>
                        </div>
                    </div>

                    {/* Filter Bar */}
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 grid grid-cols-12 gap-4 items-center shrink-0">
                        <div className="col-span-2">
                            <label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">Store/Branch</label>
                            <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200">
                                <span className="text-lg">🏪</span>
                                <span className="text-sm font-bold text-slate-700">Main Store</span>
                            </div>
                        </div>
                        <div className="col-span-2">
                            <label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">Counter</label>
                            <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200">
                                <span className="text-sm font-bold text-slate-700">Counter 1</span>
                            </div>
                        </div>
                        <div className="col-span-3 self-end">
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">🔍</span>
                                <input
                                    type="text"
                                    placeholder="Search service..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-slate-600 font-medium"
                                />
                            </div>
                        </div>
                        <div className="col-span-2">
                            <label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">Category</label>
                            <select
                                value={selectedCategory}
                                onChange={(e) => setSelectedCategory(e.target.value)}
                                className="w-full bg-slate-50 p-2 rounded-lg border border-slate-200 text-sm font-bold text-slate-700 outline-none"
                            >
                                {categories.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div className="col-span-3 self-end">
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">👤</span>
                                <input
                                    type="text"
                                    value={customerName}
                                    onChange={(e) => setCustomerName(e.target.value)}
                                    placeholder="Customer Name"
                                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-bold text-slate-700"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Products Grid */}
                    <div className="flex-1 overflow-y-auto pr-2">
                        {isLoading ? (
                            <div className="flex items-center justify-center h-full">
                                <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 pb-4">
                                {filteredServices.map(svc => (
                                    <div key={svc.service_id} className="bg-white rounded-xl border border-slate-100 shadow-sm p-3 flex flex-col group hover:shadow-md transition-shadow">
                                        <div className="h-20 mb-3 bg-slate-50 rounded-lg flex items-center justify-center relative overflow-hidden group-hover:bg-slate-100 transition-colors">
                                            <img
                                                src={
                                                    svc.category === 'Pharmacy' ? '/services/pharmacy.png' :
                                                        svc.category === 'Laboratory' ? '/services/lab.png' :
                                                            svc.category === 'Radiology' ? '/services/ultrasound.png' :
                                                                svc.category === 'Dental' ? '/services/dental.png' :
                                                                    svc.category === 'Procedure' ? '/services/procedure.png' :
                                                                        svc.category === 'Consultation' ? '/services/consultation.png' :
                                                                            '/services/registration.png'
                                                }
                                                alt={svc.service_name}
                                                className="h-16 object-contain mix-blend-multiply group-hover:scale-110 transition-transform duration-500"
                                            />
                                        </div>

                                        <div className="mb-2">
                                            <h3 className="text-xs font-bold text-slate-800 line-clamp-1 uppercase leading-tight" title={svc.service_name}>{svc.service_name}</h3>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">SKU: {svc.service_id}</span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3 mt-auto">
                                            <span className="text-sm font-bold text-slate-900">Ksh {svc.price.toLocaleString()}</span>
                                            <button
                                                onClick={() => addToCart(svc)}
                                                className="ml-auto w-8 h-8 bg-emerald-500 text-white rounded-lg flex items-center justify-center hover:bg-emerald-600 transition-colors shadow-md shadow-emerald-200 active:scale-95"
                                            >
                                                +
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                </div>

                {/* Right Side - Cart */}
                <div className="w-[380px] flex flex-col bg-white rounded-xl shadow-lg border border-slate-100 overflow-hidden h-full shrink-0">
                    {/* Cart Header */}
                    <div className="bg-emerald-500 p-4 flex items-center justify-between text-white shrink-0">
                        <div className="flex items-center gap-2">
                            <span className="text-lg">🛒</span>
                            <span className="font-bold">Cart ({cart.reduce((a, b) => a + b.qty, 0)})</span>
                        </div>
                        <button onClick={() => setCart([])} className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded text-xs font-bold transition-colors">
                            Clear
                        </button>
                    </div>

                    {/* Cart Items */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
                        {cart.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-slate-400 opacity-50">
                                <span className="text-4xl mb-3">🛒</span>
                                <p className="font-bold uppercase text-xs tracking-widest">Cart Empty</p>
                            </div>
                        ) : (
                            cart.map(item => (
                                <div key={item.service_id} className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm relative group">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="pr-6">
                                            <h4 className="font-bold text-slate-800 text-xs line-clamp-2 uppercase leading-tight">{item.service_name}</h4>
                                            <div className="flex items-center gap-1 mt-1 text-[10px] text-slate-400 font-bold">
                                                <span>@ {item.price.toLocaleString()}</span>
                                            </div>
                                        </div>
                                        <p className="font-bold text-slate-900 text-sm">{(item.price * item.qty).toLocaleString()}</p>
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => updateQty(item.service_id, -1)} className="w-6 h-6 flex items-center justify-center bg-orange-100 text-orange-600 rounded-md font-bold hover:bg-orange-200">-</button>
                                            <span className="w-6 text-center font-bold text-slate-700 text-sm">{item.qty}</span>
                                            <button onClick={() => updateQty(item.service_id, 1)} className="w-6 h-6 flex items-center justify-center bg-emerald-100 text-emerald-600 rounded-md font-bold hover:bg-emerald-200">+</button>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => removeFromCart(item.service_id)}
                                        className="absolute top-2 right-2 w-5 h-5 flex items-center justify-center text-rose-300 hover:text-rose-500 hover:bg-rose-50 rounded transition-all"
                                    >
                                        ✕
                                    </button>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Cart Footer */}
                    <div className="bg-white p-6 border-t border-slate-100 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)] shrink-0">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-slate-500 font-medium text-sm">Subtotal</span>
                            <span className="font-bold text-slate-600">Ksh {total.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center mb-6 pt-4 border-t border-slate-100 border-dashed">
                            <span className="text-slate-800 font-bold text-lg uppercase">Total</span>
                            <span className="font-bold text-slate-900 text-2xl">Ksh {total.toLocaleString()}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => completeSale('Access')}
                                disabled={cart.length === 0}
                                className="py-3 bg-slate-900 text-white rounded-xl font-bold uppercase tracking-widest text-xs shadow-lg active:scale-95 hover:bg-black transition-all disabled:opacity-50"
                            >
                                💵 Cash
                            </button>
                            <button
                                onClick={() => completeSale('MPESA')}
                                disabled={cart.length === 0}
                                className="py-3 bg-emerald-600 text-white rounded-xl font-bold uppercase tracking-widest text-xs shadow-lg active:scale-95 hover:bg-emerald-700 transition-all disabled:opacity-50"
                            >
                                📱 M-Pesa
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Hidden Receipt Component */}
            {showReceipt && printData && (
                <div className="fixed inset-0 bg-white z-[100] flex flex-col items-center justify-center">
                    <HospitalReceipt
                        receiptData={printData}
                        hospitalInfo={hospitalInfo}
                    />
                    <div className="mt-8 flex gap-4 print:hidden">
                        <button onClick={handlePrint} className="px-8 py-3 bg-blue-600 text-white rounded font-bold">Print</button>
                        <button onClick={() => setShowReceipt(false)} className="px-8 py-3 bg-gray-200 text-gray-800 rounded font-bold">Close</button>
                    </div>
                </div>
            )}
        </div>
    );
}
