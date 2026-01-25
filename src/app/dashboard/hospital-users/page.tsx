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
    const [editingUser, setEditingUser] = useState<HospitalUser | null>(null);
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
        const { data } = await supabase.from('hospital_users').select('*').order('created_at', { ascending: false });
        setUsers(data || []);
        setIsLoading(false);
    };

    useEffect(() => {
        loadUsers();
    }, []);

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to retire this staff account?')) return;
        try {
            await supabase.from('hospital_users').delete().eq('user_id', id);
            toast.success('Professional account retired');
            loadUsers();
        } catch (err) {
            toast.error('Retirement failed');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            let submissionData = { ...formData };

            if (formData.password_hash) {
                const salt = bcrypt.genSaltSync(10);
                submissionData.password_hash = bcrypt.hashSync(formData.password_hash, salt);
            } else if (editingUser) {
                delete (submissionData as any).password_hash;
            }

            if (editingUser) {
                const { error } = await supabase.from('hospital_users').update(submissionData).eq('user_id', editingUser.user_id);
                if (error) throw error;
                toast.success('Professional profile updated');
            } else {
                const { error } = await supabase.from('hospital_users').insert([submissionData]);
                if (error) throw error;
                toast.success('Professional account activated');
            }

            setIsModalOpen(false);
            setEditingUser(null);
            setFormData({ user_code: '', user_name: '', password_hash: '', full_name: '', user_type: 'Cashier', phone: '' });
            loadUsers();
        } catch (err: any) {
            toast.error(err.message || 'Authorization failed');
        }
    };

    if (isLoading) return <div className="p-8 text-slate-400 font-bold uppercase tracking-widest text-xs animate-pulse">Syncing Personnel Registry...</div>;

    return (
        <div className="space-y-10 max-w-[1400px] mx-auto pb-20">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm">
                <div className="flex items-center gap-5">
                    <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-3xl shadow-inner">
                        🛡️
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Personnel Registry</h1>
                        <p className="text-slate-500 font-medium text-sm mt-1 uppercase tracking-wider">Manage hospital staff access and professional credentials</p>
                    </div>
                </div>
                <button
                    onClick={() => { setIsModalOpen(true); setEditingUser(null); setFormData({ user_code: '', user_name: '', password_hash: '', full_name: '', user_type: 'Cashier', phone: '' }); }}
                    className="px-8 py-4 bg-slate-900 text-white rounded-[24px] font-bold hover:bg-black transition-all shadow-xl shadow-slate-900/20 active:scale-95 flex items-center gap-3 uppercase text-xs tracking-widest border-b-4 border-slate-700"
                >
                    <span>➕</span> Register Professional
                </button>
            </div>

            <div className="bg-white rounded-[40px] shadow-xl shadow-slate-200/40 border border-slate-100 overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50/50 border-b border-slate-100">
                            <th className="px-10 py-6 text-[11px] font-bold text-slate-400 uppercase tracking-[2px]">Professional ID</th>
                            <th className="px-10 py-6 text-[11px] font-bold text-slate-400 uppercase tracking-[2px]">Title & Name</th>
                            <th className="px-10 py-6 text-[11px] font-bold text-slate-400 uppercase tracking-[2px]">Designation</th>
                            <th className="px-10 py-6 text-[11px] font-bold text-slate-400 uppercase tracking-[2px]">Operational Status</th>
                            <th className="px-10 py-6 text-[11px] font-bold text-slate-400 uppercase tracking-[2px] text-right">Operations</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {users.map(user => (
                            <tr key={user.user_id} className="hover:bg-blue-50/30 transition-colors group">
                                <td className="px-10 py-6 font-bold text-sm text-blue-600 tracking-widest">{user.user_code}</td>
                                <td className="px-10 py-6">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm uppercase shadow-inner">
                                            {user.full_name.charAt(0)}
                                        </div>
                                        <div>
                                            <span className="font-bold text-slate-900 text-lg leading-tight block">{user.full_name}</span>
                                            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mt-1 block">@{user.user_name}</span>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-10 py-6">
                                    <span className={`px-4 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-widest border ${user.user_type === 'Doctor' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' :
                                        user.user_type === 'Admin' ? 'bg-slate-900 text-white border-slate-900' :
                                            'bg-blue-50 text-blue-600 border-blue-100'
                                        }`}>
                                        {user.user_type}
                                    </span>
                                </td>
                                <td className="px-10 py-6">
                                    <div className="flex items-center gap-3">
                                        <span className={`w-2 h-2 rounded-full ${user.active ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-300'}`}></span>
                                        <span className={`text-[10px] font-bold uppercase tracking-widest ${user.active ? 'text-emerald-600' : 'text-slate-400'}`}>
                                            {user.active ? 'Authorized' : 'Suspended'}
                                        </span>
                                    </div>
                                </td>
                                <td className="px-10 py-6 text-right">
                                    <div className="flex items-center justify-end gap-3">
                                        <button
                                            onClick={() => {
                                                setEditingUser(user);
                                                setFormData({
                                                    user_code: user.user_code,
                                                    user_name: user.user_name,
                                                    password_hash: '',
                                                    full_name: user.full_name,
                                                    user_type: user.user_type,
                                                    phone: user.phone
                                                });
                                                setIsModalOpen(true);
                                            }}
                                            className="w-12 h-12 flex items-center justify-center bg-white border border-slate-200 rounded-xl hover:border-blue-500 hover:text-blue-600 transition-all text-lg shadow-sm"
                                            title="Update Profile"
                                        >
                                            🛂
                                        </button>
                                        <button
                                            onClick={() => handleDelete(user.user_id)}
                                            className="w-12 h-12 flex items-center justify-center bg-white border border-slate-200 rounded-xl hover:border-rose-500 hover:text-rose-600 transition-all text-lg shadow-sm"
                                            title="Revoke Access"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {users.length === 0 && !isLoading && (
                    <div className="py-32 text-center bg-slate-50/50">
                        <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center text-5xl mx-auto mb-6 shadow-inner grayscale opacity-30">🛡️</div>
                        <p className="font-bold text-slate-400 uppercase tracking-[3px] text-xs">No Personnel Registered</p>
                    </div>
                )}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xl z-[200] flex items-center justify-center p-4 animate-in fade-in duration-500">
                    <div className="bg-white rounded-[40px] w-full max-w-lg overflow-hidden shadow-2xl border border-white/20">
                        <div className="bg-slate-900 p-10 text-white flex justify-between items-center relative overflow-hidden border-b border-white/5">
                            <div className="relative z-10">
                                <h2 className="text-3xl font-bold tracking-tight">{editingUser ? 'Update Profile' : 'Staff Onboarding'}</h2>
                                <p className="text-blue-400 text-[10px] font-bold uppercase tracking-[3px] mt-2 opacity-80">Security & Access Control</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="w-12 h-12 bg-white/5 hover:bg-white/10 rounded-full flex items-center justify-center text-2xl transition-all relative z-10">✕</button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-10 space-y-8 bg-white">
                            <div className="grid grid-cols-2 gap-8">
                                <div className="space-y-3">
                                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">Medical ID Code</label>
                                    <input
                                        required
                                        type="text"
                                        className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl focus:border-blue-500 focus:bg-white focus:outline-none transition-all font-bold text-slate-900 shadow-inner"
                                        value={formData.user_code}
                                        onChange={(e) => setFormData({ ...formData, user_code: e.target.value })}
                                        placeholder="HOSP-DR-001"
                                    />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">Professional Rank</label>
                                    <select
                                        className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl focus:border-blue-500 focus:bg-white focus:outline-none transition-all font-bold text-slate-900 appearance-none shadow-inner"
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
                            <div className="space-y-3">
                                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">Full Legal Name & Title</label>
                                <input
                                    required
                                    type="text"
                                    className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl focus:border-blue-500 focus:bg-white focus:outline-none transition-all font-bold text-slate-900 shadow-inner"
                                    value={formData.full_name}
                                    placeholder="e.g. Dr. Jane Smith"
                                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-8">
                                <div className="space-y-3">
                                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">Login Username</label>
                                    <input
                                        required
                                        type="text"
                                        className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl focus:border-blue-500 focus:bg-white focus:outline-none transition-all font-bold text-slate-900 shadow-inner"
                                        value={formData.user_name}
                                        onChange={(e) => setFormData({ ...formData, user_name: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">Security Key</label>
                                    <input
                                        required={!editingUser}
                                        type="password"
                                        className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl focus:border-blue-500 focus:bg-white focus:outline-none transition-all font-bold text-slate-900 shadow-inner"
                                        value={formData.password_hash}
                                        placeholder={editingUser ? 'Leave blank to retain' : '••••••••'}
                                        onChange={(e) => setFormData({ ...formData, password_hash: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="space-y-3">
                                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">Primary Contact Line</label>
                                <input
                                    type="tel"
                                    className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl focus:border-blue-500 focus:bg-white focus:outline-none transition-all font-bold text-slate-900 shadow-inner"
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                />
                            </div>
                            <button className="w-full py-6 bg-slate-900 hover:bg-black text-white rounded-[28px] font-bold text-lg shadow-2xl shadow-slate-900/20 transition-all hover:scale-[1.01] active:scale-[0.98] uppercase tracking-widest border-b-4 border-slate-700">
                                {editingUser ? 'Authorize Profile Synchronization' : 'Finalize Staff Activation'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
