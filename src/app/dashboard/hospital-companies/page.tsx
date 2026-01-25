'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';

interface HospitalCompany {
    id: number;
    company_name: string;
    contact_person: string;
    phone: string;
    email: string;
    address: string;
    active: boolean;
}

export default function HospitalCompaniesPage() {
    const [companies, setCompanies] = useState<HospitalCompany[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCompany, setEditingCompany] = useState<HospitalCompany | null>(null);
    const [formData, setFormData] = useState({
        company_name: '',
        contact_person: '',
        phone: '',
        email: '',
        address: ''
    });

    const loadCompanies = async () => {
        setIsLoading(true);
        const { data } = await supabase.from('hospital_companies').select('*').order('company_name');
        setCompanies(data || []);
        setIsLoading(false);
    };

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        await loadCompanies();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingCompany) {
                await supabase.from('hospital_companies').update(formData).eq('id', editingCompany.id);
                toast.success('Company details updated');
            } else {
                await supabase.from('hospital_companies').insert([formData]);
                toast.success('New company registered successfully');
            }
            setIsModalOpen(false);
            setEditingCompany(null);
            setFormData({ company_name: '', contact_person: '', phone: '', email: '', address: '' });
            loadCompanies();
        } catch (err) {
            toast.error('Operation failed. Please check connection.');
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to retire this corporate partner?')) return;
        try {
            await supabase.from('hospital_companies').delete().eq('id', id);
            toast.success('Partner record retired');
            loadCompanies();
        } catch (err) {
            toast.error('Retirement failed');
        }
    };

    if (isLoading) return <div className="p-8 text-slate-400 font-bold uppercase tracking-widest text-xs animate-pulse">Syncing Partner Records...</div>;

    return (
        <div className="space-y-10 max-w-[1400px] mx-auto pb-20">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm">
                <div className="flex items-center gap-5">
                    <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-3xl shadow-inner">
                        🏢
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Partner Entities</h1>
                        <p className="text-slate-500 font-medium text-sm mt-1 uppercase tracking-wider">Manage insurance providers and corporate medical partners</p>
                    </div>
                </div>
                <button
                    onClick={() => { setIsModalOpen(true); setEditingCompany(null); setFormData({ company_name: '', contact_person: '', phone: '', email: '', address: '' }); }}
                    className="px-8 py-4 bg-slate-900 text-white rounded-[24px] font-bold hover:bg-black transition-all shadow-xl shadow-slate-900/20 active:scale-95 flex items-center gap-3 uppercase text-xs tracking-widest border-b-4 border-slate-700"
                >
                    <span>➕</span> Register New Partner
                </button>
            </div>

            <div className="bg-white rounded-[40px] shadow-xl shadow-slate-200/40 border border-slate-100 overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50/50 border-b border-slate-100">
                            <th className="px-10 py-6 text-[11px] font-bold text-slate-400 uppercase tracking-[2px]">Entity / Location</th>
                            <th className="px-10 py-6 text-[11px] font-bold text-slate-400 uppercase tracking-[2px]">Primary Liaison</th>
                            <th className="px-10 py-6 text-[11px] font-bold text-slate-400 uppercase tracking-[2px]">Communication</th>
                            <th className="px-10 py-6 text-[11px] font-bold text-slate-400 uppercase tracking-[2px]">Status</th>
                            <th className="px-10 py-6 text-[11px] font-bold text-slate-400 uppercase tracking-[2px] text-right">Operations</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {companies.map(company => (
                            <tr key={company.id} className="hover:bg-blue-50/30 transition-colors group">
                                <td className="px-10 py-6">
                                    <p className="font-bold text-slate-900 text-lg leading-tight">{company.company_name}</p>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{company.address || 'No Address Listed'}</p>
                                </td>
                                <td className="px-10 py-6 font-bold text-slate-600 group-hover:text-blue-600 transition-colors tracking-tight">{company.contact_person}</td>
                                <td className="px-10 py-6">
                                    <p className="text-sm font-bold text-slate-800 tracking-tighter">{company.phone}</p>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">{company.email}</p>
                                </td>
                                <td className="px-10 py-6">
                                    <div className="flex items-center gap-3">
                                        <span className={`w-2.5 h-2.5 rounded-full ${company.active ? 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]' : 'bg-slate-300'}`}></span>
                                        <span className={`text-[10px] font-bold uppercase tracking-widest ${company.active ? 'text-blue-600' : 'text-slate-400'}`}>
                                            {company.active ? 'Operational' : 'Inactive'}
                                        </span>
                                    </div>
                                </td>
                                <td className="px-10 py-6 text-right">
                                    <div className="flex items-center justify-end gap-3">
                                        <button
                                            onClick={() => {
                                                setEditingCompany(company);
                                                setFormData({
                                                    company_name: company.company_name,
                                                    contact_person: company.contact_person,
                                                    phone: company.phone,
                                                    email: company.email,
                                                    address: company.address
                                                });
                                                setIsModalOpen(true);
                                            }}
                                            className="w-12 h-12 flex items-center justify-center bg-white border border-slate-200 rounded-xl hover:border-blue-500 hover:text-blue-600 transition-all text-lg shadow-sm"
                                            title="Edit Records"
                                        >
                                            🏢
                                        </button>
                                        <button
                                            onClick={() => handleDelete(company.id)}
                                            className="w-12 h-12 flex items-center justify-center bg-white border border-slate-200 rounded-xl hover:border-rose-500 hover:text-rose-600 transition-all text-lg shadow-sm"
                                            title="Retire Partner"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {companies.length === 0 && !isLoading && (
                    <div className="py-32 text-center bg-slate-50/50">
                        <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center text-5xl mx-auto mb-6 shadow-inner grayscale opacity-30">🏢</div>
                        <p className="font-bold text-slate-400 uppercase tracking-[3px] text-xs">No Corporate Entities Registered</p>
                    </div>
                )}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xl z-[200] flex items-center justify-center p-4 animate-in fade-in duration-500">
                    <div className="bg-white rounded-[40px] w-full max-w-lg overflow-hidden shadow-2xl border border-white/20">
                        <div className="bg-slate-900 p-10 text-white flex justify-between items-center relative overflow-hidden border-b border-white/5">
                            <div className="relative z-10">
                                <h2 className="text-3xl font-bold tracking-tight">{editingCompany ? 'Update Partner' : 'Register Partner'}</h2>
                                <p className="text-blue-400 text-[10px] font-bold uppercase tracking-[3px] mt-2 opacity-80">Corporate & Insurance Management</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="w-12 h-12 bg-white/5 hover:bg-white/10 rounded-full flex items-center justify-center text-2xl transition-all relative z-10">✕</button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-10 space-y-8 bg-white">
                            <div className="space-y-3">
                                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">Company Legal Name</label>
                                <input
                                    required
                                    type="text"
                                    className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl focus:border-blue-500 focus:bg-white focus:outline-none transition-all font-bold text-slate-900 shadow-inner"
                                    value={formData.company_name}
                                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                                    placeholder="e.g. NHIF / Jubilee Insurance"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-8">
                                <div className="space-y-3">
                                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">Primary Liaison Name</label>
                                    <input
                                        required
                                        type="text"
                                        className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl focus:border-blue-500 focus:bg-white focus:outline-none transition-all font-bold text-slate-900 shadow-inner"
                                        value={formData.contact_person}
                                        onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">Communication Line (Phone)</label>
                                    <input
                                        required
                                        type="tel"
                                        className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl focus:border-blue-500 focus:bg-white focus:outline-none transition-all font-bold text-slate-900 shadow-inner"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="space-y-3">
                                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">Corporate Email Address</label>
                                <input
                                    type="email"
                                    className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl focus:border-blue-500 focus:bg-white focus:outline-none transition-all font-bold text-slate-900 shadow-inner"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                />
                            </div>
                            <div className="space-y-3">
                                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">Headquarters / Physical Address</label>
                                <textarea
                                    className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl focus:border-blue-500 focus:bg-white focus:outline-none h-28 resize-none transition-all font-bold text-slate-900 shadow-inner"
                                    value={formData.address}
                                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                />
                            </div>
                            <button className="w-full py-6 bg-slate-900 hover:bg-black text-white rounded-[28px] font-bold text-lg shadow-2xl shadow-slate-900/20 transition-all hover:scale-[1.01] active:scale-[0.98] uppercase tracking-widest border-b-4 border-slate-700">
                                {editingCompany ? 'Authorize Profile Update' : 'Finalize Partner Registration'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
