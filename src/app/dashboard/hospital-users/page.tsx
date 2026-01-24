'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import bcrypt from 'bcryptjs';

interface HospitalUser {
    user_id: number;
    user_code: string;
    user_name: string;
    full_name: string;
    user_type: string;
    phone: string;
    active: boolean;
}

export default function HospitalUsersPage() {
    const [users, setUsers] = useState<HospitalUser[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState({
        user_code: '',
        user_name: '',
        password_hash: '',
        full_name: '',
        user_type: 'Cashier',
        phone: ''
    });

    const loadUsers = async () => {
        setIsLoading(true);
        const { data, error } = await supabase.from('hospital_users').select('*').order('created_at', { ascending: false });
        setUsers(data || []);
        setIsLoading(false);
    };

    useEffect(() => {
        loadUsers();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            // Hash password before saving
            const salt = bcrypt.genSaltSync(10);
            const hashedPassword = bcrypt.hashSync(formData.password_hash, salt);

            const submissionData = {
                ...formData,
                password_hash: hashedPassword
            };

            const { error } = await supabase.from('hospital_users').insert([submissionData]);

            if (error) throw error;

            toast.success('User created with secure password');
            setIsModalOpen(false);
            setFormData({ user_code: '', user_name: '', password_hash: '', full_name: '', user_type: 'Cashier', phone: '' });
            loadUsers();
        } catch (err: any) {
            console.error('Error creating user:', err);
            toast.error(err.message || 'Failed to create user');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Hospital Staff</h1>
                    <p className="text-gray-500">Manage hospital personnel and access rights</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 active:scale-95 flex items-center gap-2"
                >
                    <span>➕</span> Add Medical Staff
                </button>
            </div>

            <div className="bg-white rounded-[32px] shadow-sm border border-slate-100 overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50/50 border-b border-slate-100">
                            <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[2px]">Staff ID</th>
                            <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[2px]">Medical Professional</th>
                            <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[2px]">Role</th>
                            <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[2px]">Identifier</th>
                            <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[2px]">State</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {users.map(user => (
                            <tr key={user.user_id} className="hover:bg-blue-50/30 transition-colors group">
                                <td className="px-8 py-5 font-black text-sm text-blue-600">{user.user_code}</td>
                                <td className="px-8 py-5">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs uppercase">
                                            {user.full_name.charAt(0)}
                                        </div>
                                        <span className="font-black text-slate-800">{user.full_name}</span>
                                    </div>
                                </td>
                                <td className="px-8 py-5">
                                    <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${user.user_type === 'Doctor' ? 'bg-indigo-100 text-indigo-600' :
                                            user.user_type === 'Admin' ? 'bg-slate-800 text-white' :
                                                'bg-blue-100 text-blue-600'
                                        }`}>
                                        {user.user_type}
                                    </span>
                                </td>
                                <td className="px-8 py-5 text-slate-500 font-bold text-sm">@{user.user_name}</td>
                                <td className="px-8 py-5">
                                    <div className="flex items-center gap-2">
                                        <span className={`w-2 h-2 rounded-full ${user.active ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`}></span>
                                        <span className={`text-[10px] font-black uppercase ${user.active ? 'text-emerald-600' : 'text-slate-400'}`}>
                                            {user.active ? 'Active' : 'Disabled'}
                                        </span>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl">
                        <div className="bg-slate-900 p-8 text-white flex justify-between items-center relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/20 rounded-full translate-x-10 -translate-y-10"></div>
                            <div className="relative z-10">
                                <h2 className="text-2xl font-black">Register Professional</h2>
                                <p className="text-blue-400 text-xs font-bold uppercase tracking-widest mt-1">Hospital Staff Intake</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="text-2xl hover:rotate-90 transition-transform relative z-10">✕</button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-8 space-y-6">
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Medical ID</label>
                                    <input
                                        required
                                        type="text"
                                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:border-blue-600 focus:bg-white focus:outline-none transition-all font-bold text-slate-800"
                                        value={formData.user_code}
                                        onChange={(e) => setFormData({ ...formData, user_code: e.target.value })}
                                        placeholder="HOSP-DR-001"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Professional Designation</label>
                                    <select
                                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:border-blue-600 focus:bg-white focus:outline-none transition-all font-bold text-slate-800 appearance-none"
                                        value={formData.user_type}
                                        onChange={(e) => setFormData({ ...formData, user_type: e.target.value })}
                                    >
                                        <option>Doctor</option>
                                        <option>Nurse</option>
                                        <option>Cashier</option>
                                        <option>Admin</option>
                                        <option>Pharmacist</option>
                                        <option>Lab Tech</option>
                                    </select>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Full Name & Title</label>
                                <input
                                    required
                                    type="text"
                                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:border-blue-600 focus:bg-white focus:outline-none transition-all font-bold text-slate-800"
                                    value={formData.full_name}
                                    placeholder="e.g. Dr. John Doe"
                                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">System Username</label>
                                    <input
                                        required
                                        type="text"
                                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:border-blue-600 focus:bg-white focus:outline-none transition-all font-bold text-slate-800"
                                        value={formData.user_name}
                                        onChange={(e) => setFormData({ ...formData, user_name: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Security Credentials</label>
                                    <input
                                        required
                                        type="password"
                                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:border-blue-600 focus:bg-white focus:outline-none transition-all font-bold text-slate-800"
                                        value={formData.password_hash}
                                        placeholder="••••••••"
                                        onChange={(e) => setFormData({ ...formData, password_hash: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Contact Number</label>
                                <input
                                    type="tel"
                                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:border-blue-600 focus:bg-white focus:outline-none transition-all font-bold text-slate-800"
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                />
                            </div>
                            <button className="w-full py-5 bg-blue-600 hover:bg-blue-700 text-white rounded-[24px] font-black text-lg shadow-xl shadow-blue-500/30 transition-all hover:-translate-y-1 active:scale-95">
                                Authorize Account Creation
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
