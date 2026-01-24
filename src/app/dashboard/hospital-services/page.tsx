'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';

interface Service {
    service_id: number;
    service_name: string;
    category: string;
    price: number;
    reg_type: string;
    active: boolean;
}

export default function HospitalServicesPage() {
    const [services, setServices] = useState<Service[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingService, setEditingService] = useState<Service | null>(null);
    const [formData, setFormData] = useState({
        service_name: '',
        category: 'Registration',
        price: 0,
        reg_type: 'Non-SHA',
    });

    const loadServices = async () => {
        setIsLoading(true);
        const { data } = await supabase.from('hospital_services').select('*').order('category');
        setServices(data || []);
        setIsLoading(false);
    };

    useEffect(() => {
        loadServices();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingService) {
                await supabase.from('hospital_services').update(formData).eq('service_id', editingService.service_id);
                toast.success('Clinical service updated');
            } else {
                await supabase.from('hospital_services').insert([formData]);
                toast.success('New service registered successfully');
            }
            setIsModalOpen(false);
            setEditingService(null);
            setFormData({ service_name: '', category: 'Registration', price: 0, reg_type: 'Non-SHA' });
            loadServices();
        } catch (err) {
            toast.error('Operation failed');
        }
    };

    return (
        <div className="space-y-8 bg-[#fbfcfd] min-h-screen text-black">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight">Clinical Services</h1>
                    <p className="text-slate-500 font-medium">Define billable procedures and medical consultations</p>
                </div>
                <button
                    onClick={() => { setIsModalOpen(true); setEditingService(null); }}
                    className="px-8 py-4 bg-blue-600 text-white rounded-[24px] font-black hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20 active:scale-95 flex items-center gap-2"
                >
                    <span>➕</span> Add Medical Service
                </button>
            </div>

            <div className="bg-white rounded-[40px] shadow-sm border border-slate-100 overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50/50 border-b border-slate-100">
                            <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[2px]">Clinical Service</th>
                            <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[2px]">Specialization</th>
                            <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[2px]">Pricing (Ksh)</th>
                            <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[2px]">Designation</th>
                            <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[2px] text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {services.map(svc => (
                            <tr key={svc.service_id} className="hover:bg-blue-50/30 transition-colors group">
                                <td className="px-8 py-5">
                                    <span className="font-black text-slate-900">{svc.service_name}</span>
                                </td>
                                <td className="px-8 py-5">
                                    <span className="px-3 py-1 bg-slate-100 rounded-lg text-[10px] font-black uppercase tracking-wider text-slate-600">{svc.category}</span>
                                </td>
                                <td className="px-8 py-5 font-black text-slate-900 text-sm">Ksh {svc.price.toLocaleString()}</td>
                                <td className="px-8 py-5">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-black ${svc.reg_type === 'SHA' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-600'}`}>
                                        {svc.reg_type}
                                    </span>
                                </td>
                                <td className="px-8 py-5 text-right">
                                    <button
                                        onClick={() => {
                                            setEditingService(svc);
                                            setFormData({
                                                service_name: svc.service_name,
                                                category: svc.category,
                                                price: svc.price,
                                                reg_type: svc.reg_type
                                            });
                                            setIsModalOpen(true);
                                        }}
                                        className="text-[10px] font-black uppercase tracking-widest text-blue-600 hover:bg-blue-600 hover:text-white px-4 py-2 border border-blue-100 rounded-xl transition-all"
                                    >
                                        Configure
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {services.length === 0 && !isLoading && (
                    <div className="py-24 text-center">
                        <span className="text-6xl mb-6 block opacity-20">🩺</span>
                        <p className="font-black text-slate-300 uppercase tracking-widest text-sm">No medical services configured in the system</p>
                    </div>
                )}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[40px] w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-300">
                        <div className="bg-slate-900 p-8 text-white flex justify-between items-center relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/20 rounded-full translate-x-10 -translate-y-10 text-black"></div>
                            <div className="relative z-10 text-white">
                                <h2 className="text-2xl font-black">{editingService ? 'Modify Service' : 'Service Entry'}</h2>
                                <p className="text-blue-400 text-xs font-bold uppercase tracking-widest mt-1">Medical Catalog Management</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="text-2xl hover:rotate-90 transition-transform relative z-10 text-white">✕</button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-8 space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Service Designation</label>
                                <input
                                    required
                                    type="text"
                                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:border-blue-600 focus:bg-white focus:outline-none transition-all font-bold text-slate-800"
                                    value={formData.service_name}
                                    onChange={(e) => setFormData({ ...formData, service_name: e.target.value })}
                                    placeholder="e.g. Ultra Sound Level 2"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Specialization/Category</label>
                                    <select
                                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:border-blue-600 focus:bg-white focus:outline-none transition-all font-bold text-slate-800 appearance-none"
                                        value={formData.category}
                                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                    >
                                        <option>Registration</option>
                                        <option>Consultation</option>
                                        <option>Radiology</option>
                                        <option>Laboratory</option>
                                        <option>Pharmacy</option>
                                        <option>Dental</option>
                                        <option>Surgery</option>
                                        <option>Ward/Admission</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Billing Amount (Ksh)</label>
                                    <input
                                        required
                                        type="number"
                                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:border-blue-600 focus:bg-white focus:outline-none transition-all font-bold text-slate-800"
                                        value={formData.price}
                                        onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Regulatory Type</label>
                                <div className="flex gap-4">
                                    {['Non-SHA', 'SHA'].map(type => (
                                        <button
                                            key={type}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, reg_type: type })}
                                            className={`flex-1 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${formData.reg_type === type
                                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                                                    : 'bg-slate-50 text-slate-400 border border-slate-100 hover:bg-slate-100'
                                                }`}
                                        >
                                            {type}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <button className="w-full py-5 bg-blue-600 hover:bg-blue-700 text-white rounded-[24px] font-black text-lg shadow-xl shadow-blue-500/30 transition-all hover:-translate-y-1 active:scale-95">
                                {editingService ? 'Authorize Catalog Update' : 'Finalize Catalog Entry'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
