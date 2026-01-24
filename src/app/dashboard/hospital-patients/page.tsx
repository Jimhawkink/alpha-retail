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

    return (
        <div className="space-y-8 bg-[#fbfcfd] min-h-screen text-black">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight">Patient Registry</h1>
                    <p className="text-slate-500 font-medium">Manage medical records and patient demographics</p>
                </div>
                <button
                    onClick={() => { setIsModalOpen(true); setEditingPatient(null); }}
                    className="px-8 py-4 bg-blue-600 text-white rounded-[24px] font-black hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20 active:scale-95 flex items-center gap-2"
                >
                    <span>➕</span> Register New Patient
                </button>
            </div>

            <div className="bg-white rounded-[40px] shadow-sm border border-slate-100 overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50/50 border-b border-slate-100">
                            <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[2px]">Patient Name</th>
                            <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[2px]">Contact info</th>
                            <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[2px]">ID / Civil Number</th>
                            <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[2px]">Reg. Date</th>
                            <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[2px] text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {patients.map(patient => (
                            <tr key={patient.patient_id} className="hover:bg-blue-50/30 transition-colors group">
                                <td className="px-8 py-5">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 font-bold group-hover:bg-blue-600 group-hover:text-white transition-all">
                                            {patient.patient_name.charAt(0).toUpperCase()}
                                        </div>
                                        <span className="font-black text-slate-900">{patient.patient_name}</span>
                                    </div>
                                </td>
                                <td className="px-8 py-5">
                                    <p className="font-bold text-slate-700">{patient.phone || 'N/A'}</p>
                                    <p className="text-[10px] font-bold text-slate-400">{patient.email || 'No Email'}</p>
                                </td>
                                <td className="px-8 py-5 text-slate-500 font-black text-sm">{patient.id_number || '---'}</td>
                                <td className="px-8 py-5 text-slate-400 font-bold text-xs">{new Date(patient.registration_date).toLocaleDateString()}</td>
                                <td className="px-8 py-5 text-right">
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
                                        className="text-[10px] font-black uppercase tracking-widest text-blue-600 hover:bg-blue-600 hover:text-white px-4 py-2 border border-blue-100 rounded-xl transition-all"
                                    >
                                        Edit File
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {patients.length === 0 && !isLoading && (
                    <div className="py-24 text-center">
                        <span className="text-6xl mb-6 block opacity-20">👥</span>
                        <p className="font-black text-slate-300 uppercase tracking-widest text-sm">No patients registered in medical records</p>
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
                                <h2 className="text-2xl font-black">{editingPatient ? 'Update Record' : 'Patient Enrollment'}</h2>
                                <p className="text-blue-400 text-xs font-bold uppercase tracking-widest mt-1">Authorized Medical Registry</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="text-2xl hover:rotate-90 transition-transform relative z-10 text-white">✕</button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-8 space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Full Legal Name</label>
                                <input
                                    required
                                    type="text"
                                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:border-blue-600 focus:bg-white focus:outline-none transition-all font-bold text-slate-800"
                                    value={formData.patient_name}
                                    onChange={(e) => setFormData({ ...formData, patient_name: e.target.value })}
                                    placeholder="Patient name"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">ID Number</label>
                                    <input
                                        type="text"
                                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:border-blue-600 focus:bg-white focus:outline-none transition-all font-bold text-slate-800"
                                        value={formData.id_number}
                                        onChange={(e) => setFormData({ ...formData, id_number: e.target.value })}
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
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email Address (Optional)</label>
                                <input
                                    type="email"
                                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:border-blue-600 focus:bg-white focus:outline-none transition-all font-bold text-slate-800"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                />
                            </div>
                            <button className="w-full py-5 bg-blue-600 hover:bg-blue-700 text-white rounded-[24px] font-black text-lg shadow-xl shadow-blue-500/30 transition-all hover:-translate-y-1 active:scale-95">
                                {editingPatient ? 'Authorize Update' : 'Initialize Enrollment'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
