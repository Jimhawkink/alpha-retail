'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

function VerificationContent() {
    const searchParams = useSearchParams();
    const [status, setStatus] = useState<'loading' | 'valid' | 'invalid'>('loading');
    const [report, setReport] = useState<any>(null);

    useEffect(() => {
        const verify = async () => {
            const hash = searchParams.get('hash');
            if (!hash) {
                setStatus('invalid');
                return;
            }

            const { data, error } = await supabase
                .from('hospital_billing')
                .select('*')
                .eq('verification_hash', hash)
                .single();

            if (error || !data) {
                setStatus('invalid');
            } else {
                setReport(data);
                setStatus('valid');
            }
        };
        verify();
    }, [searchParams]);

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
            <div className="w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">
                <div className="bg-blue-600 p-8 text-center text-white">
                    <div className="text-5xl mb-4">🏥</div>
                    <h1 className="text-2xl font-black">RECEIPT VERIFICATION</h1>
                </div>

                <div className="p-8">
                    {status === 'loading' && (
                        <div className="text-center space-y-4">
                            <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
                            <p className="text-gray-500 font-bold">Verifying authenticity...</p>
                        </div>
                    )}

                    {status === 'valid' && report && (
                        <div className="text-center space-y-6">
                            <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto text-4xl">
                                ✓
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-green-600 uppercase tracking-tight">Authentic Receipt</h2>
                                <p className="text-gray-500">This receipt was issued by Alpha Hospital Systems</p>
                            </div>

                            <div className="bg-gray-50 rounded-2xl p-6 text-left space-y-3 border border-gray-100">
                                <div className="flex justify-between border-b border-gray-200 pb-2">
                                    <span className="text-xs font-bold text-gray-400">PATIENT</span>
                                    <span className="font-bold text-gray-800">{report.patient_name}</span>
                                </div>
                                <div className="flex justify-between border-b border-gray-200 pb-2">
                                    <span className="text-xs font-bold text-gray-400">RECEIPT NO</span>
                                    <span className="font-mono font-bold text-blue-600">{report.receipt_no}</span>
                                </div>
                                <div className="flex justify-between border-b border-gray-200 pb-2">
                                    <span className="text-xs font-bold text-gray-400">AMOUNT PAID</span>
                                    <span className="font-black text-gray-900">Ksh {Number(report.total_amount).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-xs font-bold text-gray-400">DATE</span>
                                    <span className="text-gray-600 text-sm font-medium">{new Date(report.created_at).toLocaleString()}</span>
                                </div>
                            </div>

                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                                Verification Hash: {report.verification_hash}
                            </p>
                        </div>
                    )}

                    {status === 'invalid' && (
                        <div className="text-center space-y-6">
                            <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto text-4xl">
                                ⚠
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-red-600 uppercase tracking-tight">Invalid Receipt</h2>
                                <p className="text-gray-500">This receipt could not be verified in our system.</p>
                            </div>
                            <div className="p-4 bg-red-50 rounded-xl text-red-700 text-sm font-medium">
                                Warning: Potential counterfeit receipt. Please contact the hospital administration.
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-6 bg-gray-50 border-t border-gray-100 text-center">
                    <p className="text-xs text-gray-400 font-medium">Powered by Alpha Hospital Management Systems</p>
                </div>
            </div>
        </div>
    );
}

export default function VerifyReceiptPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
            </div>
        }>
            <VerificationContent />
        </Suspense>
    );
}
