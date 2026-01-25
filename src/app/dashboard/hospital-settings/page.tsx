'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';

export default function HospitalSettingsPage() {
    const [isLoading, setIsLoading] = useState(true);
    const [settings, setSettings] = useState({
        hospital_name: 'ALPHA PLUS HOSPITAL',
        hospital_motto: 'RECOVER WELL',
        address: '123 Medical Plaza, Nairobi',
        phone: '0720316175',
    });

    useEffect(() => {
        const loadSettings = async () => {
            setIsLoading(true);
            const { data } = await supabase.from('hospital_settings').select('*').single();
            if (data) {
                setSettings({
                    hospital_name: data.hospital_name || 'ALPHA PLUS HOSPITAL',
                    hospital_motto: data.hospital_motto || 'RECOVER WELL',
                    address: data.address || '',
                    phone: data.phone || '',
                });
            }
            setIsLoading(false);
        };
        loadSettings();
    }, []);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const { error } = await supabase.from('hospital_settings').upsert([settings]);
            if (error) throw error;
            toast.success('Facility configuration synchronized');
        } catch (err) {
            toast.error('Synchronization failed');
        }
    };

    if (isLoading) return <div className="p-8 text-slate-400 font-bold uppercase tracking-widest text-xs animate-pulse">Initializing Parameters...</div>;

    return (
        <div className="space-y-10 max-w-4xl mx-auto pb-20">
            <div>
                <h1 className="text-4xl font-bold text-slate-900 tracking-tight">Facility Identity</h1>
                <p className="text-slate-500 font-medium mt-2">Manage the core credentials and branding of the clinical environment</p>
            </div>

            <div className="bg-white rounded-[40px] border border-slate-100 shadow-xl shadow-slate-200/40 overflow-hidden p-10">
                <form onSubmit={handleSave} className="space-y-10">
                    <div className="grid md:grid-cols-2 gap-10">
                        <div className="space-y-3">
                            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">Hospital Name</label>
                            <input
                                required
                                type="text"
                                className="w-full p-5 bg-slate-50 border border-slate-200 rounded-2xl focus:border-blue-500 focus:bg-white focus:outline-none transition-all font-bold text-slate-800 shadow-inner"
                                value={settings.hospital_name}
                                onChange={(e) => setSettings({ ...settings, hospital_name: e.target.value })}
                            />
                        </div>
                        <div className="space-y-3">
                            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">Facility Motto</label>
                            <input
                                required
                                type="text"
                                className="w-full p-5 bg-slate-50 border border-slate-200 rounded-2xl focus:border-blue-500 focus:bg-white focus:outline-none transition-all font-bold text-slate-800 shadow-inner"
                                value={settings.hospital_motto}
                                onChange={(e) => setSettings({ ...settings, hospital_motto: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="space-y-3">
                        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">Situated At (Physical Address)</label>
                        <input
                            required
                            type="text"
                            className="w-full p-5 bg-slate-50 border border-slate-200 rounded-2xl focus:border-blue-500 focus:bg-white focus:outline-none transition-all font-bold text-slate-800 shadow-inner"
                            value={settings.address}
                            onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                        />
                    </div>

                    <div className="space-y-3">
                        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">Official Phone Number</label>
                        <input
                            required
                            type="tel"
                            className="w-full p-5 bg-slate-50 border border-slate-200 rounded-2xl focus:border-blue-500 focus:bg-white focus:outline-none transition-all font-bold text-slate-800 shadow-inner"
                            value={settings.phone}
                            onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                        />
                    </div>

                    <button className="w-full py-6 bg-slate-900 hover:bg-black text-white rounded-[28px] font-bold text-lg shadow-2xl shadow-slate-900/20 transition-all active:scale-[0.98] uppercase tracking-widest border-b-4 border-slate-700">
                        Synchronize Settings
                    </button>
                </form>
            </div>

            {/* Visual Branding Preview */}
            <div className="bg-blue-50/50 p-10 rounded-[40px] border border-blue-100 flex flex-col items-center text-center">
                <div className="w-20 h-20 bg-blue-600 rounded-[28px] flex items-center justify-center text-4xl shadow-2xl shadow-blue-500/30 mb-6">🏥</div>
                <h2 className="text-3xl font-bold text-slate-900 uppercase tracking-tight">{settings.hospital_name}</h2>
                <p className="text-blue-600 font-bold italic mt-2 tracking-wide">"{settings.hospital_motto}"</p>
                <div className="h-px w-20 bg-blue-200 my-6"></div>
                <p className="text-slate-500 text-sm font-medium uppercase tracking-widest flex items-center gap-2">
                    📍 {settings.address} <span className="text-slate-300">•</span> 📞 {settings.phone}
                </p>
            </div>
        </div>
    );
}
