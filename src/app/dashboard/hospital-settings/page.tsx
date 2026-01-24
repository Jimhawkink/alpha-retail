'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';

export default function HospitalSettingsPage() {
    const [isLoading, setIsLoading] = useState(true);
    const [settings, setSettings] = useState({
        hospital_name: 'ALPHA PLUS HOSPITAL',
        address: '123 Medical Plaza, Nairobi',
        phone: '0720316175',
        pin_number: 'P051234567X',
        email: 'info@alphaplus.med',
        receipt_footer: 'Quality Care, Every Step of the Way.',
    });

    useEffect(() => {
        const loadSettings = async () => {
            setIsLoading(true);
            const { data } = await supabase.from('hospital_settings').select('*').single();
            if (data) {
                setSettings(data);
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
            toast.success('Facility settings updated successfully');
        } catch (err) {
            toast.error('Failed to update settings');
        }
    };

    return (
        <div className="space-y-8 bg-[#fbfcfd] min-h-screen text-black">
            <div>
                <h1 className="text-4xl font-black text-slate-900 tracking-tight">Facility Configuration</h1>
                <p className="text-slate-500 font-medium">Manage hospital branding and core system parameters</p>
            </div>

            <div className="grid lg:grid-cols-3 gap-8 text-black">
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden p-8">
                        <form onSubmit={handleSave} className="space-y-8">
                            <div className="grid md:grid-cols-2 gap-8">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Hospital Name</label>
                                    <input
                                        required
                                        type="text"
                                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:border-blue-600 focus:bg-white focus:outline-none transition-all font-bold text-slate-800"
                                        value={settings.hospital_name}
                                        onChange={(e) => setSettings({ ...settings, hospital_name: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">KRA PIN Number</label>
                                    <input
                                        required
                                        type="text"
                                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:border-blue-600 focus:bg-white focus:outline-none transition-all font-bold text-slate-800"
                                        value={settings.pin_number}
                                        onChange={(e) => setSettings({ ...settings, pin_number: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Official Address</label>
                                <input
                                    required
                                    type="text"
                                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:border-blue-600 focus:bg-white focus:outline-none transition-all font-bold text-slate-800"
                                    value={settings.address}
                                    onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                                />
                            </div>

                            <div className="grid md:grid-cols-2 gap-8">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Contact Phone</label>
                                    <input
                                        required
                                        type="tel"
                                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:border-blue-600 focus:bg-white focus:outline-none transition-all font-bold text-slate-800"
                                        value={settings.phone}
                                        onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Support Email</label>
                                    <input
                                        required
                                        type="email"
                                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:border-blue-600 focus:bg-white focus:outline-none transition-all font-bold text-slate-800"
                                        value={settings.email}
                                        onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Billing Receipt Footer</label>
                                <textarea
                                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:border-blue-600 focus:bg-white focus:outline-none h-24 resize-none transition-all font-bold text-slate-800"
                                    value={settings.receipt_footer}
                                    onChange={(e) => setSettings({ ...settings, receipt_footer: e.target.value })}
                                />
                            </div>

                            <button className="w-full py-5 bg-slate-900 hover:bg-black text-white rounded-[24px] font-black text-lg shadow-xl shadow-slate-900/20 transition-all hover:-translate-y-1 active:scale-95">
                                Save Facility Parameters
                            </button>
                        </form>
                    </div>
                </div>

                <div className="space-y-8">
                    <div className="bg-blue-600 p-8 rounded-[40px] text-white shadow-xl shadow-blue-600/20 relative overflow-hidden text-black">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full translate-x-10 -translate-y-10"></div>
                        <h3 className="text-2xl font-black mb-4 relative z-10 text-white">System Status</h3>
                        <div className="space-y-4 relative z-10">
                            <div className="flex justify-between items-center bg-white/10 p-4 rounded-2xl border border-white/10">
                                <span className="font-bold text-sm text-white">Database Integration</span>
                                <span className="text-[10px] font-black bg-white/20 px-2 py-1 rounded uppercase text-white">Isolated</span>
                            </div>
                            <div className="flex justify-between items-center bg-white/10 p-4 rounded-2xl border border-white/10">
                                <span className="font-bold text-sm text-white">Auth Standard</span>
                                <span className="text-[10px] font-black bg-white/20 px-2 py-1 rounded uppercase text-white">Bcrypt v2</span>
                            </div>
                            <div className="flex justify-between items-center bg-white/10 p-4 rounded-2xl border border-white/10">
                                <span className="font-bold text-sm text-white">API Version</span>
                                <span className="text-[10px] font-black bg-white/20 px-2 py-1 rounded uppercase text-white">v1.03.24</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm">
                        <h4 className="font-black text-slate-400 text-[10px] uppercase tracking-widest mb-6 border-b border-slate-50 pb-4">Branding Preview</h4>
                        <div className="text-center p-8 bg-slate-50 rounded-[32px] border border-slate-100">
                            <div className="w-16 h-16 bg-blue-600 rounded-2xl mx-auto mb-4 flex items-center justify-center text-3xl shadow-lg">🏥</div>
                            <p className="font-black text-slate-800 text-lg">{settings.hospital_name}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{settings.pin_number}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
