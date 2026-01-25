'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';

interface Patient {
    patient_id: number;
    patient_name: string;
    phone: string;
    email: string;
    id_number: string;
    registration_date: string;
    active: boolean;
}

export default function HospitalPatientsPage() {
    const [patients, setPatients] = useState<Patient[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
    const [formData, setFormData] = useState({
        patient_name: '',
        phone: '',
        email: '',
        id_number: '',
    });

    const loadPatients = async () => {
        setIsLoading(true);
        const { data } = await supabase.from('hospital_patients').select('*').order('registration_date', { ascending: false });
        setPatients(data || []);
        setIsLoading(false);
    };

    useEffect(() => {
        loadPatients();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingPatient) {
                await supabase.from('hospital_patients').update(formData).eq('patient_id', editingPatient.patient_id);
                toast.success('Patient record updated');
            } else {
                await supabase.from('hospital_patients').insert([formData]);
                toast.success('Patient registered successfully');
            }
            setIsModalOpen(false);
            setEditingPatient(null);
            setFormData({ patient_name: '', phone: '', email: '', id_number: '' });
            loadPatients();
        } catch (err) {
            toast.error('Operation failed');
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to retire this patient record?')) return;
        try {
            await supabase.from('hospital_patients').delete().eq('patient_id', id);
            toast.success('Patient record retired');
            loadPatients();
        } catch (err) {
            toast.error('Retirement failed');
        }
    };

    if (isLoading) return <div className="p-8 text-slate-400 font-bold uppercase tracking-widest text-xs animate-pulse">Accessing Medical Records...</div>;

    return (
        <div className="space-y-10 max-w-[1400px] mx-auto pb-20">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm">
                <div className="flex items-center gap-5">
                    <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-3xl shadow-inner">
                        👥
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Patient Registry</h1>
                        <p className="text-slate-500 font-medium text-sm mt-1 uppercase tracking-wider">Manage medical records and patient demographics</p>
                    </div>
                </div>
                <button
                    onClick={() => { setIsModalOpen(true); setEditingPatient(null); setFormData({ patient_name: '', phone: '', email: '', id_number: '' }); }}
                    className="px-8 py-4 bg-slate-900 text-white rounded-[24px] font-bold hover:bg-black transition-all shadow-xl shadow-slate-900/20 active:scale-95 flex items-center gap-3 uppercase text-xs tracking-widest border-b-4 border-slate-700"
                >
                    <span>➕</span> Enroll New Patient
                </button>
            </div>

            <div className="bg-white rounded-[40px] shadow-xl shadow-slate-200/40 border border-slate-100 overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50/50 border-b border-slate-100">
                            <th className="px-10 py-6 text-[11px] font-bold text-slate-400 uppercase tracking-[2px]">Patient Identity</th>
                            <th className="px-10 py-6 text-[11px] font-bold text-slate-400 uppercase tracking-[2px]">Contact info</th>
                            <th className="px-10 py-6 text-[11px] font-bold text-slate-400 uppercase tracking-[2px]">ID / Civil Number</th>
                            <th className="px-10 py-6 text-[11px] font-bold text-slate-400 uppercase tracking-[2px]">Enrollment</th>
                            <th className="px-10 py-6 text-[11px] font-bold text-slate-400 uppercase tracking-[2px] text-right">Operations</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {patients.map(patient => (
                            <tr key={patient.patient_id} className="hover:bg-blue-50/30 transition-colors group">
                                <td className="px-10 py-6">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 font-bold group-hover:bg-blue-600 group-hover:text-white transition-all text-xl shadow-inner">
                                            {patient.patient_name.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <span className="font-bold text-slate-900 text-lg leading-tight block">{patient.patient_name}</span>
                                            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mt-1 block">PID: {patient.patient_id.toString().padStart(5, '0')}</span>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-10 py-6">
                                    <p className="font-bold text-slate-700 text-sm tracking-tight">{patient.phone || 'N/A'}</p>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">{patient.email || 'No Email Registered'}</p>
                                </td>
                                <td className="px-10 py-6 text-slate-500 font-bold text-sm tracking-tighter">{patient.id_number || '---'}</td>
                                <td className="px-10 py-6">
                                    <span className="text-slate-400 font-bold text-[11px] uppercase tracking-widest block">{new Date(patient.registration_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                </td>
                                <td className="px-10 py-6 text-right">
                                    <div className="flex items-center justify-end gap-3">
                                        <button
                                            onClick={() => {
                                                setEditingPatient(patient);
                                                setFormData({
                                                    patient_name: patient.patient_name,
                                                    phone: patient.phone,
                                                    email: patient.email,
                                                    id_number: patient.id_number
                                                });
                                                setIsModalOpen(true);
                                            }}
                                            className="w-12 h-12 flex items-center justify-center bg-white border border-slate-200 rounded-xl hover:border-blue-500 hover:text-blue-600 transition-all text-lg shadow-sm"
                                            title="Update File"
                                        >
                                            📝
                                        </button>
                                        <button
                                            onClick={() => handleDelete(patient.patient_id)}
                                            className="w-12 h-12 flex items-center justify-center bg-white border border-slate-200 rounded-xl hover:border-rose-500 hover:text-rose-600 transition-all text-lg shadow-sm"
                                            title="Retire File"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {patients.length === 0 && !isLoading && (
                    <div className="py-32 text-center bg-slate-50/50">
                        <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center text-5xl mx-auto mb-6 shadow-inner grayscale opacity-30">👥</div>
                        <p className="font-bold text-slate-400 uppercase tracking-[3px] text-xs">Registry Currently Empty</p>
                    </div>
                )}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xl z-[200] flex items-center justify-center p-4 animate-in fade-in duration-500">
                    <div className="bg-white rounded-[40px] w-full max-w-lg overflow-hidden shadow-2xl border border-white/20">
                        <div className="bg-slate-900 p-10 text-white flex justify-between items-center relative overflow-hidden border-b border-white/5">
                            <div className="relative z-10">
                                <h2 className="text-3xl font-bold tracking-tight">{editingPatient ? 'Update File' : 'New Enrollment'}</h2>
                                <p className="text-blue-400 text-[10px] font-bold uppercase tracking-[3px] mt-2 opacity-80">Authorized Medical Registry</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="w-12 h-12 bg-white/5 hover:bg-white/10 rounded-full flex items-center justify-center text-2xl transition-all relative z-10">✕</button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-10 space-y-8 bg-white">
                            <div className="space-y-3">
                                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">Full Legal Name</label>
                                <input
                                    required
                                    type="text"
                                    className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl focus:border-blue-500 focus:bg-white focus:outline-none transition-all font-bold text-slate-900 shadow-inner"
                                    value={formData.patient_name}
                                    onChange={(e) => setFormData({ ...formData, patient_name: e.target.value })}
                                    placeholder="Patient name"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-8">
                                <div className="space-y-3">
                                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">Civil ID Number</label>
                                    <input
                                        type="text"
                                        className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl focus:border-blue-500 focus:bg-white focus:outline-none transition-all font-bold text-slate-900 shadow-inner"
                                        value={formData.id_number}
                                        onChange={(e) => setFormData({ ...formData, id_number: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">Contact Phone</label>
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
                                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">Official Email Address</label>
                                <input
                                    type="email"
                                    className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl focus:border-blue-500 focus:bg-white focus:outline-none transition-all font-bold text-slate-900 shadow-inner"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                />
                            </div>
                            <button className="w-full py-6 bg-slate-900 hover:bg-black text-white rounded-[28px] font-bold text-lg shadow-2xl shadow-slate-900/20 transition-all hover:scale-[1.01] active:scale-[0.98] uppercase tracking-widest border-b-4 border-slate-700">
                                {editingPatient ? 'Authorize File Update' : 'Initialize Enrollment Registry'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
