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
                    className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg active:scale-95"
                >
                    + Add Staff Member
                </button>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Staff ID</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Name</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Role</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Username</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {users.map(user => (
                            <tr key={user.user_id} className="hover:bg-emerald-50/30 transition-colors">
                                <td className="px-6 py-4 font-mono text-sm font-bold text-emerald-600">{user.user_code}</td>
                                <td className="px-6 py-4 font-bold text-gray-800">{user.full_name}</td>
                                <td className="px-6 py-4">
                                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${user.user_type === 'Doctor' ? 'bg-blue-100 text-blue-600' :
                                        user.user_type === 'Admin' ? 'bg-purple-100 text-purple-600' :
                                            'bg-gray-100 text-gray-600'
                                        }`}>
                                        {user.user_type}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-gray-700 font-medium">@{user.user_name}</td>
                                <td className="px-6 py-4">
                                    <span className={`w-2.5 h-2.5 rounded-full inline-block mr-2 ${user.active ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                    <span className="text-sm font-medium text-gray-600">{user.active ? 'Active' : 'Offline'}</span>
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
                        <div className="bg-emerald-600 p-6 text-white flex justify-between items-center">
                            <h2 className="text-xl font-bold">New Staff Member</h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-2xl">✕</button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-sm font-bold text-gray-600">Staff ID (Code)</label>
                                    <input
                                        required
                                        type="text"
                                        className="w-full p-3 bg-gray-50 border-2 border-gray-100 rounded-xl focus:border-emerald-500 focus:outline-none"
                                        value={formData.user_code}
                                        onChange={(e) => setFormData({ ...formData, user_code: e.target.value })}
                                        placeholder="H-001"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-sm font-bold text-gray-600">Role/Type</label>
                                    <select
                                        className="w-full p-3 bg-gray-50 border-2 border-gray-100 rounded-xl focus:border-emerald-500 focus:outline-none"
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
                            <div className="space-y-1">
                                <label className="text-sm font-bold text-gray-600">Full Name</label>
                                <input
                                    required
                                    type="text"
                                    className="w-full p-3 bg-gray-50 border-2 border-gray-100 rounded-xl focus:border-emerald-500 focus:outline-none"
                                    value={formData.full_name}
                                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-sm font-bold text-gray-600">Username</label>
                                    <input
                                        required
                                        type="text"
                                        className="w-full p-3 bg-gray-50 border-2 border-gray-100 rounded-xl focus:border-emerald-500 focus:outline-none"
                                        value={formData.user_name}
                                        onChange={(e) => setFormData({ ...formData, user_name: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-sm font-bold text-gray-600">Initial Password</label>
                                    <input
                                        required
                                        type="password"
                                        className="w-full p-3 bg-gray-50 border-2 border-gray-100 rounded-xl focus:border-emerald-500 focus:outline-none"
                                        value={formData.password_hash}
                                        onChange={(e) => setFormData({ ...formData, password_hash: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm font-bold text-gray-600">Phone Number</label>
                                <input
                                    type="tel"
                                    className="w-full p-3 bg-gray-50 border-2 border-gray-100 rounded-xl focus:border-emerald-500 focus:outline-none"
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                />
                            </div>
                            <button className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold shadow-lg shadow-emerald-500/30">
                                Create Staff Account
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
