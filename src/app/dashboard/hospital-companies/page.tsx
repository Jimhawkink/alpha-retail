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

    return (
        <div className="space-y-8 bg-[#fbfcfd] min-h-screen text-black">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight">Partner Entities</h1>
                    <p className="text-slate-500 font-medium">Manage insurance providers and corporate partners</p>
                </div>
                <button
                    onClick={() => { setIsModalOpen(true); setEditingCompany(null); }}
                    className="px-8 py-4 bg-blue-600 text-white rounded-[24px] font-black hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20 active:scale-95 flex items-center gap-2"
                >
                    <span>➕</span> Register New Partner
                </button>
            </div>

            <div className="bg-white rounded-[40px] shadow-sm border border-slate-100 overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50/50 border-b border-slate-100">
                            <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[2px]">Entity Name</th>
                            <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[2px]">Primary Liaison</th>
                            <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[2px]">Communication</th>
                            <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[2px]">State</th>
                            <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[2px] text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {companies.map(company => (
                            <tr key={company.id} className="hover:bg-blue-50/30 transition-colors group">
                                <td className="px-8 py-5">
                                    <p className="font-black text-slate-900">{company.company_name}</p>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">{company.address || 'No Address Listed'}</p>
                                </td>
                                <td className="px-8 py-5 font-bold text-slate-600 group-hover:text-blue-600 transition-colors">{company.contact_person}</td>
                                <td className="px-8 py-5">
                                    <p className="text-sm font-black text-slate-800">{company.phone}</p>
                                    <p className="text-[10px] font-bold text-slate-400">{company.email}</p>
                                </td>
                                <td className="px-8 py-5">
                                    <div className="flex items-center gap-2">
                                        <span className={`w-2 h-2 rounded-full ${company.active ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
                                        <span className={`text-[10px] font-black uppercase tracking-wider ${company.active ? 'text-emerald-600' : 'text-slate-400'}`}>
                                            {company.active ? 'Operational' : 'Inactive'}
                                        </span>
                                    </div>
                                </td>
                                <td className="px-8 py-5 text-right">
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
                                        className="text-[10px] font-black uppercase tracking-widest text-blue-600 hover:bg-blue-600 hover:text-white px-4 py-2 border border-blue-100 rounded-xl transition-all"
                                    >
                                        Modify
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {companies.length === 0 && !isLoading && (
                    <div className="py-24 text-center">
                        <span className="text-6xl mb-6 block opacity-20">🏢</span>
                        <p className="font-black text-slate-300 uppercase tracking-widest text-sm">No corporate entities registered yet</p>
                    </div>
                )}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[40px] w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-300">
                        <div className="bg-slate-900 p-8 text-white flex justify-between items-center relative overflow-hidden text-black">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/20 rounded-full translate-x-10 -translate-y-10"></div>
                            <div className="relative z-10">
                                <h2 className="text-2xl font-black">{editingCompany ? 'Modify Partner' : 'Register Partner'}</h2>
                                <p className="text-blue-400 text-xs font-bold uppercase tracking-widest mt-1">Corporate & Insurance Management</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="text-2xl hover:rotate-90 transition-transform relative z-10">✕</button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-8 space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Company Legal Name</label>
                                <input
                                    required
                                    type="text"
                                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:border-blue-600 focus:bg-white focus:outline-none transition-all font-bold text-slate-800"
                                    value={formData.company_name}
                                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                                    placeholder="e.g. NHIF / Jubilee Insurance"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Liaison Name</label>
                                    <input
                                        required
                                        type="text"
                                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:border-blue-600 focus:bg-white focus:outline-none transition-all font-bold text-slate-800"
                                        value={formData.contact_person}
                                        onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Phone Number</label>
                                    <input
                                        required
                                        type="tel"
                                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:border-blue-600 focus:bg-white focus:outline-none transition-all font-bold text-slate-800"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Corporate Email</label>
                                <input
                                    type="email"
                                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:border-blue-600 focus:bg-white focus:outline-none transition-all font-bold text-slate-800"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Physical Address</label>
                                <textarea
                                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:border-blue-600 focus:bg-white focus:outline-none h-24 resize-none transition-all font-bold text-slate-800"
                                    value={formData.address}
                                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                />
                            </div>
                            <button className="w-full py-5 bg-blue-600 hover:bg-blue-700 text-white rounded-[24px] font-black text-lg shadow-xl shadow-blue-500/30 transition-all hover:-translate-y-1 active:scale-95">
                                {editingCompany ? 'Authorize Update' : 'Finalize Registration'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
