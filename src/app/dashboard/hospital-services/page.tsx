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

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to retire this medical service?')) return;
        try {
            await supabase.from('hospital_services').delete().eq('service_id', id);
            toast.success('Service retired from catalog');
            loadServices();
        } catch (err) {
            toast.error('Retirement failed');
        }
    };

    if (isLoading) return <div className="p-8 text-slate-400 font-bold uppercase tracking-widest text-xs animate-pulse">Accessing Medical Catalog...</div>;

    return (
        <div className="space-y-10 max-w-[1400px] mx-auto pb-20">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm">
                <div className="flex items-center gap-5">
                    <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-3xl shadow-inner">
                        🧪
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Medical Service Catalog</h1>
                        <p className="text-slate-500 font-medium text-sm mt-1 uppercase tracking-wider">Configure hospital billing modules and registration fees</p>
                    </div>
                </div>
                <button
                    onClick={() => { setIsModalOpen(true); setEditingService(null); setFormData({ service_name: '', category: 'Registration', price: 0, reg_type: 'Non-SHA' }); }}
                    className="px-8 py-4 bg-slate-900 text-white rounded-[24px] font-bold hover:bg-black transition-all shadow-xl shadow-slate-900/20 active:scale-95 flex items-center gap-3 uppercase text-xs tracking-widest border-b-4 border-slate-700"
                >
                    <span>➕</span> Register New Entry
                </button>
            </div>

            <div className="bg-white rounded-[40px] shadow-xl shadow-slate-200/40 border border-slate-100 overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50/50 border-b border-slate-100">
                            <th className="px-10 py-6 text-[11px] font-bold text-slate-400 uppercase tracking-[2px]">Clinical Service / Item</th>
                            <th className="px-10 py-6 text-[11px] font-bold text-slate-400 uppercase tracking-[2px]">Specialization</th>
                            <th className="px-10 py-6 text-[11px] font-bold text-slate-400 uppercase tracking-[2px]">Unit Charge</th>
                            <th className="px-10 py-6 text-[11px] font-bold text-slate-400 uppercase tracking-[2px]">Compliance</th>
                            <th className="px-10 py-6 text-[11px] font-bold text-slate-400 uppercase tracking-[2px] text-right">Operations</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {services.map(svc => (
                            <tr key={svc.service_id} className="hover:bg-blue-50/30 transition-colors group">
                                <td className="px-10 py-6">
                                    <span className="font-bold text-slate-900 text-lg leading-tight block">{svc.service_name}</span>
                                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mt-1 block">CODE: MED-{svc.service_id.toString().padStart(4, '0')}</span>
                                </td>
                                <td className="px-10 py-6">
                                    <span className="px-4 py-1.5 bg-slate-100 rounded-xl text-[10px] font-bold uppercase tracking-widest text-slate-500 border border-slate-200">{svc.category}</span>
                                </td>
                                <td className="px-10 py-6 font-bold text-slate-900 text-base tracking-tighter">Ksh {svc.price.toLocaleString()}</td>
                                <td className="px-10 py-6">
                                    <span className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest ${svc.reg_type === 'SHA' ? 'bg-blue-100 text-blue-600 border border-blue-200' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                                        {svc.reg_type}
                                    </span>
                                </td>
                                <td className="px-10 py-6 text-right">
                                    <div className="flex items-center justify-end gap-3">
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
                                            className="w-12 h-12 flex items-center justify-center bg-white border border-slate-200 rounded-xl hover:border-blue-500 hover:text-blue-600 transition-all text-lg shadow-sm"
                                            title="Edit Config"
                                        >
                                            ⚙️
                                        </button>
                                        <button
                                            onClick={() => handleDelete(svc.service_id)}
                                            className="w-12 h-12 flex items-center justify-center bg-white border border-slate-200 rounded-xl hover:border-rose-500 hover:text-rose-600 transition-all text-lg shadow-sm"
                                            title="Retire Service"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {services.length === 0 && !isLoading && (
                    <div className="py-32 text-center bg-slate-50/50">
                        <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center text-5xl mx-auto mb-6 shadow-inner grayscale opacity-30">🩺</div>
                        <p className="font-bold text-slate-400 uppercase tracking-[3px] text-xs">Medical Catalog Empty</p>
                    </div>
                )}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xl z-[200] flex items-center justify-center p-4 animate-in fade-in duration-500">
                    <div className="bg-white rounded-[40px] w-full max-w-xl overflow-hidden shadow-2xl border border-white/20">
                        <div className="bg-slate-900 p-10 text-white flex justify-between items-center relative overflow-hidden border-b border-white/5">
                            <div className="relative z-10">
                                <h2 className="text-3xl font-bold tracking-tight">{editingService ? 'Update Configuration' : 'Service Registration'}</h2>
                                <p className="text-blue-400 text-[10px] font-bold uppercase tracking-[3px] mt-2 opacity-80">Official Clinical Catalog</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="w-12 h-12 bg-white/5 hover:bg-white/10 rounded-full flex items-center justify-center text-2xl transition-all relative z-10">✕</button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-10 space-y-8 bg-white">
                            <div className="space-y-3">
                                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">Service Designation (Name)</label>
                                <input
                                    required
                                    type="text"
                                    className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl focus:border-blue-500 focus:bg-white focus:outline-none transition-all font-bold text-slate-900 shadow-inner"
                                    value={formData.service_name}
                                    onChange={(e) => setFormData({ ...formData, service_name: e.target.value })}
                                    placeholder="e.g. Cardiology Consultation"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-8">
                                <div className="space-y-3">
                                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">Operational Category</label>
                                    <select
                                        className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl focus:border-blue-500 focus:bg-white focus:outline-none transition-all font-bold text-slate-900 appearance-none shadow-inner"
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
                                <div className="space-y-3">
                                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">Standard Unit Fee (Ksh)</label>
                                    <input
                                        required
                                        type="number"
                                        className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl focus:border-blue-500 focus:bg-white focus:outline-none transition-all font-bold text-slate-900 shadow-inner"
                                        value={formData.price}
                                        onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                                    />
                                </div>
                            </div>
                            <div className="space-y-4">
                                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">Compliance/Regulatory Designation</label>
                                <div className="flex gap-4 p-2 bg-slate-50 rounded-[28px] border border-slate-100">
                                    {['Non-SHA', 'SHA'].map(type => (
                                        <button
                                            key={type}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, reg_type: type })}
                                            className={`flex-1 py-4 rounded-[22px] font-bold text-xs uppercase tracking-widest transition-all ${formData.reg_type === type
                                                ? 'bg-white text-blue-600 shadow-xl shadow-blue-500/10 border border-blue-50'
                                                : 'text-slate-400 hover:text-slate-600'
                                                }`}
                                        >
                                            {type}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <button className="w-full py-6 bg-slate-900 hover:bg-black text-white rounded-[28px] font-bold text-lg shadow-2xl shadow-slate-900/20 transition-all hover:scale-[1.01] active:scale-[0.98] uppercase tracking-widest border-b-4 border-slate-700">
                                {editingService ? 'Authorize & Update catalog' : 'Finalize & Commit catalog entry'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
