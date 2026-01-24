'use client';

import React from 'react';

interface ReceiptProps {
    receiptData: {
        receiptNo: string;
        patientName: string;
        items: Array<{ service_name: string; qty: number; price: number }>;
        total: number;
        paymentMethod: string;
        date: string;
        verificationHash: string;
    };
    hospitalInfo: {
        name: string;
        address: string;
        phone: string;
        pin: string;
    };
}

export const HospitalReceipt = React.forwardRef<HTMLDivElement, ReceiptProps>(({ receiptData, hospitalInfo }, ref) => {
    return (
        <div ref={ref} className="bg-white text-black p-4 w-[80mm] mx-auto font-mono text-sm leading-tight border border-gray-100 shadow-sm print:shadow-none print:border-none">
            {/* Header */}
            <div className="text-center mb-4 uppercase">
                <h1 className="font-black text-lg leading-tight">{hospitalInfo.name}</h1>
                <p className="text-xs">{hospitalInfo.address}</p>
                <p className="text-xs">Tel: {hospitalInfo.phone}</p>
                <p className="text-xs font-bold">PIN: {hospitalInfo.pin}</p>
            </div>

            <div className="border-t border-dashed border-black my-2"></div>

            {/* Bill Info */}
            <div className="flex justify-between font-bold mb-1">
                <span>{receiptData.paymentMethod} SALE</span>
                <span>{receiptData.patientName}</span>
            </div>
            <div className="flex justify-between mb-1">
                <span>{receiptData.receiptNo}</span>
                <span>{receiptData.date}</span>
            </div>
            <div className="mb-2">Admin: Reception</div>

            <div className="border-t border-dashed border-black my-2"></div>

            {/* Table Header */}
            <div className="flex justify-between font-bold mb-1">
                <span className="w-1/2">Item</span>
                <span className="w-1/6 text-center">Qty</span>
                <span className="w-1/6 text-right">Price</span>
                <span className="w-1/6 text-right">Amount</span>
            </div>
            <div className="border-t border-dashed border-black mb-2"></div>

            {/* Items */}
            {receiptData.items.map((item, idx) => (
                <div key={idx} className="mb-2 uppercase">
                    <p className="font-bold">{item.service_name}</p>
                    <div className="flex justify-between pl-4">
                        <span className="w-1/6 text-center">{item.qty}</span>
                        <span className="w-1/6 text-right">{item.price.toFixed(2)}</span>
                        <span className="w-1/6 text-right font-bold">{(item.qty * item.price).toFixed(2)}</span>
                    </div>
                </div>
            ))}

            <div className="border-t border-dashed border-black my-2"></div>

            {/* Totals */}
            <div className="flex justify-between font-bold text-base mb-1">
                <span>TOTAL:</span>
                <span>{receiptData.items.length} Items</span>
                <span>{receiptData.total.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center mb-1">
                <span>Payment Received</span>
                <span className="font-bold">{receiptData.total.toFixed(2)}</span>
            </div>

            <div className="border-t border-dashed border-black my-2"></div>

            {/* QR Verification Section */}
            <div className="flex flex-col items-center py-4 border-2 border-dashed border-black rounded-lg my-4">
                <p className="font-bold text-xs mb-2 text-center">SCAN TO VERIFY RECEIPT</p>
                <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`https://alphaplusweb.vercel.app/verify-receipt?hash=${receiptData.verificationHash}`)}`}
                    alt="Verification QR"
                    className="w-32 h-32 border border-black"
                />
                <p className="text-[10px] mt-2 font-bold tracking-widest">{receiptData.verificationHash}</p>
            </div>

            {/* Footer */}
            <div className="text-center font-bold">
                <p className="text-base mb-1">*** THANK YOU! ***</p>
                <p className="text-[10px]">Medical services once rendered are not refundable</p>
                <p className="text-[10px] mt-2">Powered by Alpha Hospital POS</p>
            </div>
        </div>
    );
});

HospitalReceipt.displayName = 'HospitalReceipt';
