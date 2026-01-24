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
        const { data } = await supabase.from('hospital.companies').select('*').order('company_name');
        setCompanies(data || []);
        setIsLoading(false);
    };

    useEffect(() => {
        loadCompanies();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingCompany) {
                await supabase.from('hospital.companies').update(formData).eq('id', editingCompany.id);
                toast.success('Company updated');
            } else {
                await supabase.from('hospital.companies').insert([formData]);
                toast.success('Company registered');
            }
            setIsModalOpen(false);
            setEditingCompany(null);
            setFormData({ company_name: '', contact_person: '', phone: '', email: '', address: '' });
            loadCompanies();
        } catch (err) {
            toast.error('Operation failed');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Hospital Companies</h1>
                    <p className="text-gray-500">Manage partner companies and insurance providers</p>
                </div>
                <button
                    onClick={() => { setIsModalOpen(true); setEditingCompany(null); }}
                    className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg active:scale-95"
                >
                    + Register Company
                </button>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Company Details</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Contact Person</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Support info</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {companies.map(company => (
                            <tr key={company.id} className="hover:bg-blue-50/30 transition-colors">
                                <td className="px-6 py-4">
                                    <p className="font-bold text-gray-800">{company.company_name}</p>
                                    <p className="text-xs text-gray-500">{company.address}</p>
                                </td>
                                <td className="px-6 py-4 font-medium text-gray-700">{company.contact_person}</td>
                                <td className="px-6 py-4">
                                    <p className="text-sm font-semibold text-gray-700">{company.phone}</p>
                                    <p className="text-xs text-gray-400">{company.email}</p>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${company.active ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                        {company.active ? 'Active' : 'Inactive'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right">
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
                                        className="text-blue-500 hover:text-blue-700 font-bold px-3 py-1 bg-blue-50 rounded-lg"
                                    >
                                        Edit
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {companies.length === 0 && !isLoading && (
                    <div className="py-20 text-center opacity-30">
                        <span className="text-6xl mb-4 block">🏢</span>
                        <p className="font-bold">No companies found</p>
                    </div>
                )}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl">
                        <div className="bg-blue-600 p-6 text-white flex justify-between items-center">
                            <h2 className="text-xl font-bold">{editingCompany ? 'Edit Company' : 'Register Company'}</h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-2xl">✕</button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div className="space-y-1">
                                <label className="text-sm font-bold text-gray-600">Company Name</label>
                                <input
                                    required
                                    type="text"
                                    className="w-full p-3 bg-gray-50 border-2 border-gray-100 rounded-xl focus:border-blue-500 focus:outline-none"
                                    value={formData.company_name}
                                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-sm font-bold text-gray-600">Contact Person</label>
                                    <input
                                        required
                                        type="text"
                                        className="w-full p-3 bg-gray-50 border-2 border-gray-100 rounded-xl focus:border-blue-500 focus:outline-none"
                                        value={formData.contact_person}
                                        onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-sm font-bold text-gray-600">Phone</label>
                                    <input
                                        required
                                        type="tel"
                                        className="w-full p-3 bg-gray-50 border-2 border-gray-100 rounded-xl focus:border-blue-500 focus:outline-none"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm font-bold text-gray-600">Email Address</label>
                                <input
                                    type="email"
                                    className="w-full p-3 bg-gray-50 border-2 border-gray-100 rounded-xl focus:border-blue-500 focus:outline-none"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm font-bold text-gray-600">Address/Location</label>
                                <textarea
                                    className="w-full p-3 bg-gray-50 border-2 border-gray-100 rounded-xl focus:border-blue-500 focus:outline-none h-24 resize-none"
                                    value={formData.address}
                                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                />
                            </div>
                            <button className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-500/30">
                                {editingCompany ? 'Save Changes' : 'Register Now'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
