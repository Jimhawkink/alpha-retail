'use client';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';
import toast from 'react-hot-toast';

interface Customer { customer_id:number; name:string; phone:string; credit_limit:number; balance:number; }
interface LedgerRow { date:string; type:'sale'|'payment'|'return'; ref:string; description:string; debit:number; credit:number; running_balance:number; }
const PAGE_SIZE=25;

export default function CustomerStatementPage() {
  const { activeOutlet } = useOutlet();
  const outletId = activeOutlet?.outlet_id||1;
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer|null>(null);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingCusts, setLoadingCusts] = useState(true);
  const [dateFrom, setDateFrom] = useState(()=>{const d=new Date();d.setDate(d.getDate()-90);return d.toISOString().split('T')[0];});
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  useEffect(()=>{
    const fetchCusts=async()=>{
      setLoadingCusts(true);
      const { data } = await supabase.from('retail_credit_customers').select('customer_id,name,phone,credit_limit,balance').eq('outlet_id',outletId).order('name');
      setCustomers(data||[]);
      setLoadingCusts(false);
    };
    fetchCusts();
  },[outletId]);

  const loadStatement = useCallback(async(cust:Customer)=>{
    setSelectedCustomer(cust);
    setLoading(true);
    setPage(1);
    try {
      const [{ data: sales },{ data: payments }] = await Promise.all([
        supabase.from('retail_sales').select('sale_id,sale_date,receipt_no,total_amount,status').eq('outlet_id',outletId).eq('customer_id',cust.customer_id).gte('sale_date',dateFrom).lte('sale_date',dateTo).order('sale_date',{ascending:true}),
        supabase.from('retail_credit_payments').select('payment_id,payment_date,amount,reference,notes').eq('customer_id',cust.customer_id).gte('payment_date',dateFrom).lte('payment_date',dateTo).order('payment_date',{ascending:true}),
      ]);
      const rows:Omit<LedgerRow,'running_balance'>[] = [
        ...(sales||[]).map((s:any)=>({date:s.sale_date,type:'sale' as const,ref:s.receipt_no,description:`Sale — Receipt ${s.receipt_no}`,debit:s.total_amount||0,credit:0})),
        ...(payments||[]).map((p:any)=>({date:p.payment_date,type:'payment' as const,ref:p.reference||`PMT-${p.payment_id}`,description:p.notes||'Credit Payment',debit:0,credit:p.amount||0})),
      ].sort((a,b)=>a.date.localeCompare(b.date));
      let running=0;
      const withBalance:LedgerRow[]=rows.map(r=>{running+=r.debit-r.credit;return {...r,running_balance:running};});
      setLedger(withBalance);
    } catch { toast.error('Failed to load statement'); }
    setLoading(false);
  },[outletId,dateFrom,dateTo]);

  const filteredCusts=customers.filter(c=>!search||(c.name||'').toLowerCase().includes(search.toLowerCase())||(c.phone||'').includes(search));
  const totalPages=Math.ceil(ledger.length/PAGE_SIZE);
  const paged=ledger.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE);
  const totDebit=ledger.reduce((s,r)=>s+r.debit,0);
  const totCredit=ledger.reduce((s,r)=>s+r.credit,0);
  const closingBalance=ledger.length>0?ledger[ledger.length-1].running_balance:0;

  const printStatement=()=>{
    if(!selectedCustomer)return;
    const html=`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Customer Statement</title>
<style>@page{margin:15mm;}body{font-family:Arial,sans-serif;font-size:11px;}h2{font-size:16px;margin:0 0 4px;}
.info{font-size:10px;color:#555;margin-bottom:10px;}.header{border-bottom:2px solid #333;padding-bottom:8px;margin-bottom:12px;}
table{width:100%;border-collapse:collapse;}th,td{border:1px solid #ddd;padding:5px 8px;text-align:left;font-size:10px;}
th{background:#f5f5f5;font-weight:700;}.r{text-align:right;}.b{font-weight:700;}
.credit{color:green;}.debit{color:#333;}.balance{background:#f9f9f9;font-weight:700;}</style></head><body>
<div class="header"><h2>Customer Account Statement</h2>
<div class="info"><strong>${selectedCustomer.name}</strong> | Phone: ${selectedCustomer.phone} | Period: ${dateFrom} to ${dateTo}</div>
<div class="info">Credit Limit: Ksh ${(selectedCustomer.credit_limit||0).toLocaleString()} | Current Balance: Ksh ${(selectedCustomer.balance||0).toLocaleString()}</div></div>
<table><tr><th>Date</th><th>Type</th><th>Reference</th><th>Description</th><th class="r">Debit (Dr)</th><th class="r">Credit (Cr)</th><th class="r">Balance</th></tr>
${ledger.map(r=>`<tr><td>${r.date}</td><td>${r.type==='sale'?'Sale':'Payment'}</td><td>${r.ref}</td><td>${r.description}</td><td class="r debit">${r.debit>0?'Ksh '+r.debit.toLocaleString():'-'}</td><td class="r credit">${r.credit>0?'Ksh '+r.credit.toLocaleString():'-'}</td><td class="r balance">Ksh ${r.running_balance.toLocaleString()}</td></tr>`).join('')}
<tr class="balance"><td colspan="4"><strong>CLOSING BALANCE</strong></td><td class="r b">Ksh ${totDebit.toLocaleString()}</td><td class="r b credit">Ksh ${totCredit.toLocaleString()}</td><td class="r b">Ksh ${closingBalance.toLocaleString()}</td></tr>
</table><div style="margin-top:12px;font-size:9px;color:#999;">Printed: ${new Date().toLocaleString('en-GB')} — Alpha Retail</div></body></html>`;
    const w=window.open('','_blank');if(w){w.document.write(html);w.document.close();w.print();}
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-700 flex items-center justify-center text-3xl shadow-lg shadow-sky-200">📋</div>
          <div><h1 className="text-2xl font-black text-gray-800">Credit Customer Statement</h1>
          <p className="text-sm text-gray-500 mt-0.5">Full ledger per customer · Sales & payments · {activeOutlet?.outlet_name}</p></div>
        </div>
        {selectedCustomer&&(
          <div className="flex gap-2">
            <button onClick={printStatement} className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-semibold text-sm transition-all">🖨️ Print Statement</button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Customer list */}
        <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
          <div className="p-4 border-b bg-sky-50">
            <p className="font-bold text-sm text-gray-700 mb-3">Select Customer</p>
            <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search…" className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"/></div>
          </div>
          <div className="overflow-y-auto max-h-[500px] divide-y divide-gray-100">
            {loadingCusts?<div className="py-8 text-center text-gray-400 text-sm">Loading customers…</div>
            :filteredCusts.map(c=>(
              <button key={c.customer_id} onClick={()=>loadStatement(c)} className={`w-full text-left p-4 hover:bg-sky-50/60 transition-colors ${selectedCustomer?.customer_id===c.customer_id?'bg-sky-50 border-l-4 border-l-sky-500':''}`}>
                <p className="font-bold text-sm text-gray-800">{c.name}</p>
                <p className="text-xs text-gray-400">{c.phone}</p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-gray-400">Balance:</span>
                  <span className={`text-xs font-black ${(c.balance||0)>0?'text-red-600':'text-emerald-600'}`}>Ksh {(c.balance||0).toLocaleString()}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Statement */}
        <div className="lg:col-span-2 space-y-4">
          {!selectedCustomer ? (
            <div className="bg-white rounded-2xl border p-16 text-center shadow-sm">
              <div className="text-6xl mb-4">👈</div>
              <p className="font-bold text-gray-700">Select a customer to view their statement</p>
            </div>
          ) : (
            <>
              {/* Customer KPIs */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  {label:'Total Purchases',value:`Ksh ${Math.round(totDebit).toLocaleString()}`,color:'text-blue-600',bg:'bg-blue-50',icon:'🛒'},
                  {label:'Total Paid',value:`Ksh ${Math.round(totCredit).toLocaleString()}`,color:'text-emerald-600',bg:'bg-emerald-50',icon:'✅'},
                  {label:'Outstanding Balance',value:`Ksh ${Math.round(closingBalance).toLocaleString()}`,color:closingBalance>0?'text-red-600':'text-emerald-600',bg:closingBalance>0?'bg-red-50':'bg-emerald-50',icon:closingBalance>0?'⚠️':'✅'},
                ].map((c,i)=>(
                  <div key={i} className={`${c.bg} rounded-xl p-4`}>
                    <div className="flex items-center gap-2 mb-1"><span>{c.icon}</span><p className="text-xs font-bold text-gray-500 uppercase">{c.label}</p></div>
                    <p className={`text-lg font-black ${c.color}`}>{c.value}</p>
                  </div>
                ))}
              </div>

              {/* Date filter */}
              <div className="bg-white rounded-xl border p-3 flex items-center gap-3">
                <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"/>
                <span className="text-gray-400">→</span>
                <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"/>
                <button onClick={()=>loadStatement(selectedCustomer)} className="px-3 py-1.5 bg-sky-500 text-white rounded-lg text-xs font-bold hover:bg-sky-600 transition-all">Apply</button>
              </div>

              {/* Ledger */}
              <div className="bg-white rounded-2xl border overflow-hidden shadow-sm">
                <table className="w-full">
                  <thead><tr className="bg-gradient-to-r from-sky-50 to-blue-50 border-b">
                    <th className="text-left py-3 px-4 text-xs font-bold text-gray-500 uppercase">Date</th>
                    <th className="text-left py-3 px-4 text-xs font-bold text-gray-500 uppercase">Type</th>
                    <th className="text-left py-3 px-4 text-xs font-bold text-gray-500 uppercase">Reference</th>
                    <th className="text-left py-3 px-4 text-xs font-bold text-gray-500 uppercase">Description</th>
                    <th className="text-right py-3 px-4 text-xs font-bold text-gray-500 uppercase">Debit (Dr)</th>
                    <th className="text-right py-3 px-4 text-xs font-bold text-gray-500 uppercase">Credit (Cr)</th>
                    <th className="text-right py-3 px-4 text-xs font-bold text-gray-500 uppercase">Balance</th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    {loading?(<tr><td colSpan={7} className="py-16 text-center"><div className="w-10 h-10 border-4 border-sky-400 border-t-transparent rounded-full animate-spin mx-auto"/></td></tr>)
                    :paged.length===0?(<tr><td colSpan={7} className="py-16 text-center text-gray-400">No transactions in this period</td></tr>)
                    :paged.map((r,i)=>(
                      <tr key={i} className={`hover:bg-gray-50/60 transition-colors ${r.type==='payment'?'bg-emerald-50/20':''}`}>
                        <td className="py-2.5 px-4 text-sm text-gray-600">{r.date}</td>
                        <td className="py-2.5 px-4"><span className={`px-2.5 py-1 rounded-full text-xs font-bold ${r.type==='sale'?'bg-blue-100 text-blue-700':'bg-emerald-100 text-emerald-700'}`}>{r.type==='sale'?'Sale':'Payment'}</span></td>
                        <td className="py-2.5 px-4 text-sm font-semibold text-gray-700">{r.ref}</td>
                        <td className="py-2.5 px-4 text-sm text-gray-600">{r.description}</td>
                        <td className="py-2.5 px-4 text-right text-sm font-bold text-gray-800">{r.debit>0?`Ksh ${r.debit.toLocaleString()}`:'—'}</td>
                        <td className="py-2.5 px-4 text-right text-sm font-bold text-emerald-600">{r.credit>0?`Ksh ${r.credit.toLocaleString()}`:'—'}</td>
                        <td className="py-2.5 px-4 text-right font-black text-sm"><span className={r.running_balance>0?'text-red-600':'text-emerald-600'}>Ksh {r.running_balance.toLocaleString()}</span></td>
                      </tr>
                    ))}
                  </tbody>
                  {ledger.length>0&&<tfoot><tr className="bg-sky-50 border-t font-bold"><td colSpan={4} className="py-3 px-4 text-sm">CLOSING BALANCE</td><td className="py-3 px-4 text-right text-sm text-gray-800">Ksh {Math.round(totDebit).toLocaleString()}</td><td className="py-3 px-4 text-right text-sm text-emerald-700">Ksh {Math.round(totCredit).toLocaleString()}</td><td className="py-3 px-4 text-right text-sm"><span className={closingBalance>0?'text-red-600 font-black':'text-emerald-600 font-black'}>Ksh {Math.round(closingBalance).toLocaleString()}</span></td></tr></tfoot>}
                </table>
                {totalPages>1&&(
                  <div className="flex items-center justify-between px-4 py-3.5 border-t bg-gray-50/50">
                    <p className="text-sm text-gray-500">Showing <strong>{(page-1)*PAGE_SIZE+1}–{Math.min(page*PAGE_SIZE,ledger.length)}</strong> of <strong>{ledger.length}</strong></p>
                    <div className="flex items-center gap-1">
                      <button onClick={()=>setPage(1)} disabled={page===1} className="px-2.5 py-1.5 rounded-lg text-xs font-bold disabled:opacity-30 hover:bg-gray-200">«</button>
                      <button onClick={()=>setPage(p=>p-1)} disabled={page===1} className="px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-30 hover:bg-gray-200">‹</button>
                      {Array.from({length:Math.min(5,totalPages)},(_,i)=>{let pg=i+1;if(pg>totalPages)return null;return <button key={pg} onClick={()=>setPage(pg)} className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${pg===page?'bg-sky-500 text-white shadow-md':'hover:bg-gray-200 text-gray-600'}`}>{pg}</button>;})}
                      <button onClick={()=>setPage(p=>p+1)} disabled={page===totalPages} className="px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-30 hover:bg-gray-200">›</button>
                      <button onClick={()=>setPage(totalPages)} disabled={page===totalPages} className="px-2.5 py-1.5 rounded-lg text-xs font-bold disabled:opacity-30 hover:bg-gray-200">»</button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
