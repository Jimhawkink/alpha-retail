'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import { HospitalReceipt } from '@/components/HospitalReceipt';

interface Patient {
    patient_id: number;
    patient_name: string;
}

interface HospitalService {
    service_id: number;
    service_name: string;
    category: string;
    price: number;
    reg_type: string;
}

interface CartItem extends HospitalService {
    qty: number;
}

export default function HospitalPOSPage() {
    const [patients, setPatients] = useState<Patient[]>([]);
    const [services, setServices] = useState<HospitalService[]>([]);
    const [filteredServices, setFilteredServices] = useState<HospitalService[]>([]);
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [cart, setCart] = useState<CartItem[]>([]);
    const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
    const [patientSearch, setPatientSearch] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [receiptNo, setReceiptNo] = useState('HOSP-00001');
    const [showReceipt, setShowReceipt] = useState(false);
    const [printData, setPrintData] = useState<any>(null);
    const [hospitalInfo, setHospitalInfo] = useState({
        name: "ALPHA PLUS HOSPITAL",
        address: "123 Medical Plaza, Nairobi",
        phone: "0720316175",
        pin: "P051234567X"
    });

    const receiptRef = useRef<HTMLDivElement>(null);

    // Load initialization data
    const loadInitData = async () => {
        setIsLoading(true);
        try {
            // 1. Load clinical services
            const { data: svcData } = await supabase.from('hospital_services').select('*').eq('active', true);
            setServices(svcData || []);
            setFilteredServices(svcData || []);

            // 2. Load facility settings
            const { data: settings } = await supabase.from('hospital_settings').select('*').single();
            if (settings) {
                setHospitalInfo({
                    name: settings.hospital_name,
                    address: settings.address,
                    phone: settings.phone,
                    pin: settings.pin_number
                });
            }

            // 3. Load next receipt number
            const { data: saleData } = await supabase
                .from('hospital_sales')
                .select('receipt_no')
                .order('sale_id', { ascending: false })
                .limit(1);

            if (saleData?.[0]?.receipt_no) {
                const match = saleData[0].receipt_no.match(/HOSP-(\d+)/);
                if (match) {
                    const nextNum = parseInt(match[1]) + 1;
                    setReceiptNo(`HOSP-${String(nextNum).padStart(5, '0')}`);
                }
            }
        } catch (err) {
            console.error('Error loading initialization data:', err);
        }
        setIsLoading(false);
    };

    useEffect(() => {
        loadInitData();
    }, []);

    // Patient Search Effect
    useEffect(() => {
        const searchPatients = async () => {
            if (patientSearch.length < 2) {
                setPatients([]);
                return;
            }
            const { data } = await supabase
                .from('hospital_patients')
                .select('patient_id, patient_name')
                .ilike('patient_name', `%${patientSearch}%`)
                .limit(5);
            setPatients(data || []);
        };
        const timer = setTimeout(searchPatients, 300);
        return () => clearTimeout(timer);
    }, [patientSearch]);

    // Filter services
    useEffect(() => {
        const query = searchQuery.toLowerCase();
        setFilteredServices(
            services.filter(s => {
                const matchesSearch = s.service_name.toLowerCase().includes(query) ||
                    s.category.toLowerCase().includes(query);
                const matchesCategory = selectedCategory === 'All' || s.category === selectedCategory;
                return matchesSearch && matchesCategory;
            })
        );
    }, [searchQuery, services, selectedCategory]);

    const categories = ['All', 'Registration', 'Consultation', 'Laboratory', 'Radiology', 'Pharmacy', 'Dental'];

    const addToCart = (service: HospitalService) => {
        setCart(prev => {
            const existing = prev.find(item => item.service_id === service.service_id);
            if (existing) {
                return prev.map(item =>
                    item.service_id === service.service_id ? { ...item, qty: item.qty + 1 } : item
                );
            }
            return [...prev, { ...service, qty: 1 }];
        });
        toast.success(`${service.service_name} added`);
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
        if (!patientSearch.trim()) {
            toast.error('Please enter patient name manually');
            return;
        }
        if (cart.length === 0) {
            toast.error('Clinical manifest is empty');
            return;
        }

        try {
            const userData = localStorage.getItem('user');
            const currentUser = userData ? JSON.parse(userData) : null;
            const finalPatientName = patientSearch.trim();

            const vHash = Math.random().toString(36).substring(2, 10).toUpperCase();

            // 1. Create entry in hospital_sales
            const { data: sale, error: saleError } = await supabase
                .from('hospital_sales')
                .insert({
                    receipt_no: receiptNo,
                    patient_name: finalPatientName,
                    total_amount: total,
                    payment_method: method,
                    status: 'Completed',
                    created_by: currentUser?.userId,
                    verification_hash: vHash
                })
                .select()
                .single();

            if (saleError) throw saleError;

            // 2. Insert items
            const saleItems = cart.map(item => ({
                sale_id: sale.sale_id,
                service_id: item.service_id,
                service_name: item.service_name,
                price: item.price,
                quantity: item.qty,
                subtotal: item.price * item.qty
            }));

            const { error: itemsError } = await supabase
                .from('hospital_sales_items')
                .insert(saleItems);

            if (itemsError) throw itemsError;

            // Prepare for print
            setPrintData({
                receiptNo,
                patientName: finalPatientName,
                items: [...cart],
                total,
                paymentMethod: method,
                date: new Date().toLocaleString(),
                verificationHash: vHash
            });
            setShowReceipt(true);

            toast.success('Clinical Bill Finalized');
            setCart([]);
            setPatientSearch('');
            loadInitData();
        } catch (err) {
            console.error('Error completing clinical sale:', err);
            toast.error('Processing failed');
        }
    };

    const handlePrint = () => {
        window.print();
        setShowReceipt(false);
    };

    if (isLoading) return (
        <div className="flex items-center justify-center h-96">
            <div className="text-center animate-pulse">
                <span className="text-4xl">🏥</span>
                <p className="mt-4 font-bold text-slate-400 uppercase tracking-widest text-xs">Loading Console...</p>
            </div>
        </div>
    );

    return (
        <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
            {/* Minimalist Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm">
                <div className="flex items-center gap-5">
                    <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-3xl shadow-inner">
                        🩺
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Clinical Point-of-Sale</h1>
                        <p className="text-slate-400 font-medium text-sm mt-1 uppercase tracking-wider">Revenue Operations • {hospitalInfo.name}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-right">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Receipt Ref</p>
                        <p className="text-xl font-bold text-blue-600 font-mono tracking-tighter">{receiptNo}</p>
                    </div>
                    <button onClick={loadInitData} className="w-14 h-14 bg-white border border-slate-200 rounded-2xl hover:border-blue-500 hover:text-blue-600 transition-all flex items-center justify-center text-xl shadow-sm">
                        🔄
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                {/* Left Side: Services & Patient */}
                <div className="xl:col-span-8 space-y-6">
                    {/* Manual Patient Entry */}
                    <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 ml-1">Patient Name • Manual Entry Only</label>
                        <div className="relative group">
                            <span className="absolute left-5 top-1/2 -translate-y-1/2 text-2xl group-focus-within:scale-110 transition-transform">👤</span>
                            <input
                                type="text"
                                value={patientSearch}
                                onChange={(e) => setPatientSearch(e.target.value)}
                                placeholder="Key in patient name precisely as it should appear on receipt..."
                                className="w-full pl-16 pr-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-blue-500 focus:bg-white focus:outline-none text-xl font-bold transition-all placeholder:text-slate-300 shadow-inner"
                            />
                        </div>
                    </div>

                    {/* Services Explorer */}
                    <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm flex flex-col gap-8 min-h-[600px]">
                        <div className="flex flex-col md:flex-row gap-6 items-center">
                            <div className="flex-1 relative w-full">
                                <span className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Filter services or medicines..."
                                    className="w-full pl-12 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:border-blue-500 focus:bg-white focus:outline-none text-sm font-semibold transition-all shadow-inner"
                                />
                            </div>
                            <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
                                {categories.map(cat => (
                                    <button
                                        key={cat}
                                        onClick={() => setSelectedCategory(cat)}
                                        className={`px-6 py-3 rounded-xl text-[11px] font-bold uppercase tracking-widest whitespace-nowrap transition-all ${selectedCategory === cat
                                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
                                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                            }`}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 2xl:grid-cols-4 gap-4 overflow-y-auto pr-2">
                            {filteredServices.map(svc => (
                                <button
                                    key={svc.service_id}
                                    onClick={() => addToCart(svc)}
                                    className="p-6 bg-slate-50/50 hover:bg-blue-50 border border-slate-100 hover:border-blue-200 rounded-3xl text-left transition-all group relative overflow-hidden flex flex-col justify-between h-40"
                                >
                                    <div>
                                        <span className="text-[9px] font-bold text-blue-500 uppercase tracking-[2px]">{svc.category}</span>
                                        <h3 className="font-bold text-slate-800 line-clamp-2 mt-2 leading-tight">{svc.service_name}</h3>
                                    </div>
                                    <div className="flex items-center justify-between mt-auto">
                                        <p className="text-lg font-bold text-slate-900 tracking-tighter">Ksh {svc.price.toLocaleString()}</p>
                                        <span className="w-8 h-8 bg-white rounded-xl flex items-center justify-center text-blue-600 shadow-sm opacity-0 group-hover:opacity-100 transition-all scale-75 group-hover:scale-100">➕</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right Side: Medical Bill / Cart */}
                <div className="xl:col-span-4 sticky top-24">
                    <div className="bg-slate-900 rounded-[40px] shadow-2xl shadow-blue-900/10 flex flex-col overflow-hidden min-h-[700px]">
                        <div className="p-8 bg-slate-900 text-white border-b border-white/5 flex justify-between items-center">
                            <div>
                                <h2 className="text-xl font-bold tracking-tight">Medical Manifest</h2>
                                <p className="text-xs text-slate-400 font-medium mt-1">Authorized Billing Console</p>
                            </div>
                            <span className="bg-blue-600 text-white px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest leading-none">
                                {cart.length} Unit(s)
                            </span>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-4">
                            {cart.map(item => (
                                <div key={item.service_id} className="bg-white/5 p-5 rounded-3xl border border-white/5 group hover:border-white/10 transition-all">
                                    <div className="flex justify-between items-start gap-4">
                                        <div className="flex-1">
                                            <h4 className="font-bold text-white text-sm leading-tight">{item.service_name}</h4>
                                            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mt-1">{item.category}</p>
                                        </div>
                                        <button onClick={() => removeFromCart(item.service_id)} className="text-slate-600 hover:text-rose-500 transition-colors">✕</button>
                                    </div>
                                    <div className="flex justify-between items-center mt-6">
                                        <div className="flex items-center bg-black/40 rounded-2xl p-1 border border-white/5">
                                            <button onClick={() => updateQty(item.service_id, -1)} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white transition-all text-lg">−</button>
                                            <span className="w-10 text-center font-bold text-white text-xs">{item.qty}</span>
                                            <button onClick={() => updateQty(item.service_id, 1)} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white transition-all text-lg">＋</button>
                                        </div>
                                        <p className="font-bold text-blue-400">Ksh {(item.price * item.qty).toLocaleString()}</p>
                                    </div>
                                </div>
                            ))}
                            {cart.length === 0 && (
                                <div className="flex flex-col items-center justify-center h-[400px] text-slate-700">
                                    <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center text-4xl mb-6 grayscale opacity-50">📋</div>
                                    <p className="font-bold text-sm tracking-widest uppercase opacity-40">Bill Empty</p>
                                </div>
                            )}
                        </div>

                        <div className="p-8 bg-black/40 border-t border-white/5 backdrop-blur-xl">
                            <div className="flex justify-between items-end mb-8">
                                <div>
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[2px] mb-1">Total Payables</p>
                                    <h3 className="text-4xl font-bold text-white tracking-tighter">Ksh {total.toLocaleString()}</h3>
                                </div>
                                <button onClick={() => setCart([])} className="text-[10px] text-slate-500 hover:text-rose-500 font-bold uppercase tracking-widest mb-2 border-b border-transparent hover:border-rose-500 transition-all">
                                    Clear all
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <button
                                    onClick={() => completeSale('CASH')}
                                    disabled={cart.length === 0}
                                    className="py-5 bg-white text-slate-900 font-bold rounded-2xl transition-all shadow-xl active:scale-95 disabled:opacity-10 disabled:grayscale uppercase text-xs tracking-widest"
                                >
                                    💸 Liquid Cash
                                </button>
                                <button
                                    onClick={() => completeSale('MPESA')}
                                    disabled={cart.length === 0}
                                    className="py-5 bg-blue-600 text-white font-bold rounded-2xl transition-all shadow-xl active:scale-95 disabled:opacity-10 disabled:grayscale uppercase text-xs tracking-widest"
                                >
                                    📱 M-Pesa
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Receipt Modal */}
            {showReceipt && printData && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xl z-[200] flex flex-col items-center justify-center p-4 animate-in fade-in duration-500">
                    <div className="bg-white p-1 rounded-[40px] shadow-2xl max-w-md w-full overflow-hidden mb-6">
                        <div className="max-h-[70vh] overflow-y-auto p-4">
                            <HospitalReceipt
                                ref={receiptRef}
                                receiptData={printData}
                                hospitalInfo={hospitalInfo}
                            />
                        </div>
                    </div>
                    <div className="flex gap-4">
                        <button
                            onClick={handlePrint}
                            className="px-10 py-5 bg-blue-600 text-white rounded-[24px] font-bold shadow-2xl active:scale-95 uppercase text-xs tracking-widest transition-all hover:bg-blue-500"
                        >
                            🖨️ Commit & Print
                        </button>
                        <button
                            onClick={() => setShowReceipt(false)}
                            className="px-10 py-5 bg-white/10 text-white rounded-[24px] font-bold backdrop-blur-md uppercase text-xs tracking-widest border border-white/20 transition-all hover:bg-white/20"
                        >
                            Dismiss
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
