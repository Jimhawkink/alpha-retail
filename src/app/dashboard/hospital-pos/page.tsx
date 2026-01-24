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
    const [cart, setCart] = useState<CartItem[]>([]);
    const [patientName, setPatientName] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [receiptNo, setReceiptNo] = useState('HOSP-00001');
    const [showReceipt, setShowReceipt] = useState(false);
    const [printData, setPrintData] = useState<any>(null);

    const receiptRef = useRef<HTMLDivElement>(null);

    // Load patients and services
    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            try {
                const { data: svcData } = await supabase.from('hospital_services').select('*').eq('active', true);
                setServices(svcData || []);
                setFilteredServices(svcData || []);

                // Load next receipt number
                const { data: saleData } = await supabase
                    .from('hospital_billing')
                    .select('receipt_no')
                    .order('billing_id', { ascending: false })
                    .limit(1);

                if (saleData?.[0]?.receipt_no) {
                    const match = saleData[0].receipt_no.match(/HOSP-(\d+)/);
                    if (match) {
                        const nextNum = parseInt(match[1]) + 1;
                        setReceiptNo(`HOSP-${String(nextNum).padStart(5, '0')}`);
                    }
                }
            } catch (err) {
                console.error('Error loading data:', err);
            }
            setIsLoading(false);
        };
        loadData();
    }, []);

    // Filter services
    useEffect(() => {
        const query = searchQuery.toLowerCase();
        setFilteredServices(
            services.filter(s =>
                s.service_name.toLowerCase().includes(query) ||
                s.category.toLowerCase().includes(query)
            )
        );
    }, [searchQuery, services]);

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
        if (!patientName) {
            toast.error('Please enter patient name');
            return;
        }
        if (cart.length === 0) {
            toast.error('Cart is empty');
            return;
        }

        try {
            // 1. Create patient if not exists (simplified for now)
            const { data: patient } = await supabase
                .from('hospital_patients')
                .insert({ patient_name: patientName })
                .select()
                .single();

            // 2. Create entry in public.sales (base table)
            const { data: sale, error: saleError } = await supabase
                .from('public.sales')
                .insert({
                    receipt_no: receiptNo,
                    customer_name: patientName,
                    total_amount: total,
                    payment_method: method,
                    status: 'Completed',
                    order_type: 'Hospital Billing'
                })
                .select()
                .single();

            if (saleError) throw saleError;

            const vHash = Math.random().toString(36).substring(2, 10).toUpperCase();

            // 3. Create entry in hospital.billing (metadata)
            await supabase.from('hospital_billing').insert({
                sale_id: sale.sale_id,
                receipt_no: receiptNo,
                patient_id: patient?.patient_id,
                patient_name: patientName,
                total_amount: total,
                payment_method: method,
                verification_hash: vHash
            });

            // Prepare for print
            setPrintData({
                receiptNo,
                patientName,
                items: [...cart],
                total,
                paymentMethod: method,
                date: new Date().toLocaleString(),
                verificationHash: vHash
            });
            setShowReceipt(true);

            toast.success('Billing completed successfully!');
            setCart([]);
            setPatientName('');
            loadData(); // Refresh receipt number
        } catch (err) {
            console.error('Error completing sale:', err);
            toast.error('Failed to complete sale');
        }
    };

    const handlePrint = () => {
        window.print();
        setShowReceipt(false);
    };

    const loadData = async () => {
        setIsLoading(true);
        try {
            const { data: svcData } = await supabase.from('hospital_services').select('*').eq('active', true);
            setServices(svcData || []);
            setFilteredServices(svcData || []);

            // Load next receipt number
            const { data: saleData } = await supabase
                .from('hospital_billing')
                .select('receipt_no')
                .order('billing_id', { ascending: false })
                .limit(1);

            if (saleData?.[0]?.receipt_no) {
                const match = saleData[0].receipt_no.match(/HOSP-(\d+)/);
                if (match) {
                    const nextNum = parseInt(match[1]) + 1;
                    setReceiptNo(`HOSP-${String(nextNum).padStart(5, '0')}`);
                }
            }
        } catch (err) {
            console.error('Error loading data:', err);
        }
        setIsLoading(false);
    };

    useEffect(() => {
        loadData();
    }, []);

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

                {/* Patient Selection */}
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Patient Name</label>
                    <input
                        type="text"
                        value={patientName}
                        onChange={(e) => setPatientName(e.target.value)}
                        placeholder="Enter patient full name..."
                        className="w-full p-4 bg-blue-50/50 border-2 border-blue-100 rounded-xl focus:border-blue-500 focus:outline-none text-lg"
                    />
                </div>

                {/* Services Grid */}
                <div className="flex-1 bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-4 overflow-hidden">
                    <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search services (e.g. Ultra Sound, Dental...)"
                            className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
                        />
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
                            hospitalInfo={{
                                name: "ALPHA PLUS HOSPITAL",
                                address: "123 Medical Plaza, Nairobi",
                                phone: "0720316175",
                                pin: "P051234567X"
                            }}
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
