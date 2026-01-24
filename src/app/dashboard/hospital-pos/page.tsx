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

    const categories = ['All', ...Array.from(new Set(services.map(s => s.category)))];

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

    const removeFromCart = (id: number) => {
        setCart(prev => prev.filter(item => item.service_id !== id));
    };

    const total = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

    const completeSale = async (method: string) => {
        if (!patientSearch && !selectedPatient) {
            toast.error('Please specify patient name');
            return;
        }
        if (cart.length === 0) {
            toast.error('Clinical cart is empty');
            return;
        }

        try {
            const userData = localStorage.getItem('user');
            const currentUser = userData ? JSON.parse(userData) : null;

            // 1. Resolve Patient
            let patientId = selectedPatient?.patient_id;
            let finalPatientName = selectedPatient?.patient_name || patientSearch;

            if (!patientId) {
                // Check if patient already exists to avoid duplicates
                const { data: existing } = await supabase
                    .from('hospital_patients')
                    .select('patient_id')
                    .ilike('patient_name', finalPatientName)
                    .single();

                if (existing) {
                    patientId = existing.patient_id;
                } else {
                    const { data: newPatient } = await supabase
                        .from('hospital_patients')
                        .insert({ patient_name: finalPatientName })
                        .select()
                        .single();
                    patientId = newPatient?.patient_id;
                }
            }

            const vHash = Math.random().toString(36).substring(2, 10).toUpperCase();

            // 2. Create entry in hospital_sales
            const { data: sale, error: saleError } = await supabase
                .from('hospital_sales')
                .insert({
                    receipt_no: receiptNo,
                    patient_id: patientId,
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

            // 3. Insert items
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

            toast.success('Medical billing complete');
            setCart([]);
            setPatientSearch('');
            setSelectedPatient(null);
            loadInitData(); // Refresh state
        } catch (err) {
            console.error('Error completing clinical sale:', err);
            toast.error('System failed to process billing');
        }
    };

    const handlePrint = () => {
        window.print();
        setShowReceipt(false);
    };

    return (
        <div className="flex h-[calc(100vh-100px)] gap-4">
            <div className="flex-1 flex flex-col gap-4">
                {/* Header */}
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold text-gray-800">Hospital POS</h1>
                        <p className="text-sm text-gray-500">Billing & Service Registration</p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-gray-400">Receipt No</p>
                        <p className="text-lg font-bold text-blue-600">{receiptNo}</p>
                    </div>
                </div>

                {/* Patient Search & Registration */}
                <div className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-100 relative z-50">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Patient Identifier (Name/ID)</label>
                    <div className="relative">
                        <input
                            type="text"
                            value={patientSearch}
                            onChange={(e) => {
                                setPatientSearch(e.target.value);
                                if (selectedPatient && e.target.value !== selectedPatient.patient_name) {
                                    setSelectedPatient(null);
                                }
                            }}
                            placeholder="Type to search or register new patient..."
                            className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-blue-600 focus:bg-white focus:outline-none text-lg font-black transition-all"
                        />
                        {patients.length > 0 && !selectedPatient && (
                            <div className="absolute top-full left-0 right-0 bg-white border border-slate-100 mt-2 rounded-2xl shadow-2xl overflow-hidden z-[100]">
                                {patients.map(p => (
                                    <button
                                        key={p.patient_id}
                                        onClick={() => {
                                            setSelectedPatient(p);
                                            setPatientSearch(p.patient_name);
                                            setPatients([]);
                                        }}
                                        className="w-full p-4 text-left hover:bg-blue-50 border-b border-slate-50 last:border-0 transition-colors flex justify-between items-center"
                                    >
                                        <span className="font-bold text-slate-700">{p.patient_name}</span>
                                        <span className="text-[10px] font-black text-blue-600 uppercase bg-blue-100 px-2 py-1 rounded">M-Account</span>
                                    </button>
                                ))}
                            </div>
                        )}
                        {selectedPatient && (
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                <span className="bg-emerald-100 text-emerald-600 px-3 py-1 rounded-full text-[10px] font-black uppercase">Verified Patient</span>
                                <button onClick={() => { setSelectedPatient(null); setPatientSearch(''); }} className="text-slate-400 hover:text-slate-600 font-bold text-xl">✕</button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Services Grid */}
                <div className="flex-1 bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-4 overflow-hidden">
                    <div className="flex flex-col gap-4">
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">🔍</span>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search medical services or drugs..."
                                className="w-full pl-11 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-blue-600 focus:bg-white focus:outline-none text-sm font-semibold transition-all"
                            />
                        </div>

                        {/* Category Tabs */}
                        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                            {categories.map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setSelectedCategory(cat)}
                                    className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest whitespace-nowrap transition-all ${selectedCategory === cat
                                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
                                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                        }`}
                                >
                                    {cat === 'Pharmacy' ? '💊 Drugs' : cat === 'Laboratory' ? '🔬 Lab' : cat === 'All' ? '📂 All' : cat}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto grid grid-cols-2 md:grid-cols-3 gap-3 pr-2">
                        {filteredServices.map(svc => (
                            <button
                                key={svc.service_id}
                                onClick={() => addToCart(svc)}
                                className="p-4 bg-gray-50 hover:bg-blue-50 border border-gray-100 hover:border-blue-200 rounded-2xl text-left transition-all group relative overflow-hidden"
                            >
                                <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <span className="bg-blue-500 text-white p-1 rounded-full text-xs">+</span>
                                </div>
                                <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">{svc.category}</span>
                                <h3 className="font-bold text-gray-800 line-clamp-2 mt-1">{svc.service_name}</h3>
                                <p className="text-lg font-black text-gray-900 mt-2">Ksh {svc.price.toLocaleString()}</p>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Cart Section */}
            <div className="w-96 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col overflow-hidden">
                <div className="p-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                    <h2 className="font-bold flex items-center gap-2">
                        <span>🛒</span> Cart ({cart.length} items)
                    </h2>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {cart.map(item => (
                        <div key={item.service_id} className="flex justify-between items-start border-b border-gray-50 pb-3">
                            <div className="flex-1">
                                <h4 className="font-semibold text-gray-800 text-sm">{item.service_name}</h4>
                                <p className="text-xs text-gray-400">Ksh {item.price.toLocaleString()} x {item.qty}</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="font-bold text-gray-800">{(item.price * item.qty).toLocaleString()}</span>
                                <button onClick={() => removeFromCart(item.service_id)} className="text-red-400 hover:text-red-600">✕</button>
                            </div>
                        </div>
                    ))}
                    {cart.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full text-gray-300 opacity-50">
                            <span className="text-6xl mb-4">🛒</span>
                            <p className="font-medium">Cart is empty</p>
                        </div>
                    )}
                </div>

                <div className="p-4 bg-gray-50 border-t border-gray-100 space-y-4">
                    <div className="flex justify-between items-end">
                        <span className="text-gray-500 font-medium">TOTAL AMOUNT</span>
                        <span className="text-3xl font-black text-gray-900 border-b-4 border-blue-500">Ksh {total.toLocaleString()}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <button
                            onClick={() => completeSale('CASH')}
                            className="p-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl transition-all shadow-lg active:scale-95"
                        >
                            💵 CASH
                        </button>
                        <button
                            onClick={() => completeSale('MPESA')}
                            className="p-3 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl transition-all shadow-lg active:scale-95"
                        >
                            📱 M-PESA
                        </button>
                    </div>
                </div>
            </div>
            {/* Receipt Print Overlay */}
            {showReceipt && printData && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex flex-col items-center justify-center p-4 print:p-0 print:bg-white print:static">
                    <div className="bg-white p-6 rounded-3xl shadow-2xl max-h-[90vh] overflow-y-auto mb-4 print:shadow-none print:p-0 print:m-0">
                        <HospitalReceipt
                            ref={receiptRef}
                            receiptData={printData}
                            hospitalInfo={hospitalInfo}
                        />
                    </div>
                    <div className="flex gap-4 print:hidden">
                        <button
                            onClick={handlePrint}
                            className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-xl active:scale-95"
                        >
                            🖨️ PRINT RECEIPT
                        </button>
                        <button
                            onClick={() => setShowReceipt(false)}
                            className="px-8 py-4 bg-white text-gray-600 rounded-2xl font-bold border border-gray-200"
                        >
                            CLOSE
                        </button>
                    </div>
                </div>
            )}

            <style jsx global>{`
                @media print {
                    body * {
                        visibility: hidden;
                    }
                    .print-area, .print-area * {
                        visibility: visible;
                    }
                    .print-area {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                    }
                    /* Ensure only the receipt is printed */
                    main, aside, header, nav, button {
                        display: none !important;
                    }
                    .fixed {
                        position: static !important;
                        background: white !important;
                        padding: 0 !important;
                    }
                    .shadow-2xl, .backdrop-blur-sm {
                        box-shadow: none !important;
                        backdrop-filter: none !important;
                    }
                }
            `}</style>
        </div>
    );
}
