'use client';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';
import toast from 'react-hot-toast';

interface VATRow { sale_date:string; receipt_no:string; customer_name:string; subtotal:number; taxable_amount:number; vat_amount:number; vat_rate:number; total_amount:number; payment_method:string; }
const PAGE_SIZE=25;
const VAT_RATE=16; // Kenya standard VAT

export default function VATReportPage() {
  const { activeOutlet } = useOutlet();
  const outletId = activeOutlet?.outlet_id||1;
  const [data, setData] = useState<VATRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`;});
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [preset, setPreset] = useState('month');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const setPresetDate=(p:string)=>{
    setPreset(p);const now=new Date();const to=now.toISOString().split('T')[0];let from=to;
    if(p==='month'){from=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;}
    else if(p==='lastmonth'){const lm=new Date(now.getFullYear(),now.getMonth()-1,1);from=lm.toISOString().split('T')[0];const end=new Date(now.getFullYear(),now.getMonth(),0);setDateTo(end.toISOString().split('T')[0]);setDateFrom(from);setPreset(p);return;}
    else if(p==='q1'){from=`${now.getFullYear()}-01-01`;setDateTo(`${now.getFullYear()}-03-31`);}
    else if(p==='q2'){from=`${now.getFullYear()}-04-01`;setDateTo(`${now.getFullYear()}-06-30`);}
    else if(p==='q3'){from=`${now.getFullYear()}-07-01`;setDateTo(`${now.getFullYear()}-09-30`);}
    else if(p==='year'){from=`${now.getFullYear()}-01-01`;}
    setDateFrom(from);if(p!=='lastmonth')setDateTo(to);
  };

  const load = useCallback(async()=>{
    if(!activeOutlet)return;
    setLoading(true);
    try {
      const { data: sales } = await supabase
        .from('retail_sales').select('sale_date,receipt_no,customer_name,subtotal,total_amount,payment_method,tax_amount,discount,status')
        .eq('outlet_id',outletId).gte('sale_date',dateFrom).lte('sale_date',dateTo).eq('status','Completed').order('sale_date',{ascending:false});
      const result:VATRow[]=(sales||[]).map((s:any)=>{
        const taxable=s.subtotal||(s.total_amount||0);
        const vatAmt=s.tax_amount||(taxable*(VAT_RATE/(100+VAT_RATE)));
        return {sale_date:s.sale_date,receipt_no:s.receipt_no,customer_name:s.customer_name||'Walk-in',subtotal:s.subtotal||0,taxable_amount:taxable,vat_amount:vatAmt,vat_rate:VAT_RATE,total_amount:s.total_amount||0,payment_method:s.payment_method||'Cash'};
      });
      setData(result);setPage(1);
    } catch { toast.error('Failed to load'); }
    setLoading(false);
  },[outletId,dateFrom,dateTo,activeOutlet]);

  useEffect(()=>{load();},[load]);
  const filtered=data.filter(r=>!search||(r.receipt_no||'').toLowerCase().includes(search.toLowerCase())||(r.customer_name||'').toLowerCase().includes(search.toLowerCase()));
  const totalPages=Math.ceil(filtered.length/PAGE_SIZE);
  const paged=filtered.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE);
  const totTaxable=filtered.reduce((s,r)=>s+r.taxable_amount,0);
  const totVAT=filtered.reduce((s,r)=>s+r.vat_amount,0);
  const totRevenue=filtered.reduce((s,r)=>s+r.total_amount,0);

  // Monthly summary for KRA filing
  const monthlyMap:Record<string,{taxable:number;vat:number;transactions:number}> = {};
  filtered.forEach(r=>{
    const m=r.sale_date?.slice(0,7)||'Unknown';
    if(!monthlyMap[m])monthlyMap[m]={taxable:0,vat:0,transactions:0};
    monthlyMap[m].taxable+=r.taxable_amount;
    monthlyMap[m].vat+=r.vat_amount;
    monthlyMap[m].transactions++;
  });

  const exportCSV=()=>{
    const rows=[['Date','Receipt No','Customer','Taxable Amount','VAT Rate','VAT Amount','Total','Payment']];
    filtered.forEach(r=>rows.push([r.sale_date,r.receipt_no,r.customer_name,String(Math.round(r.taxable_amount)),r.vat_rate+'%',String(Math.round(r.vat_amount)),String(Math.round(r.total_amount)),r.payment_method]));
    const blob=new Blob([rows.map(r=>r.join(',')).join('\n')],{type:'text/csv'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`vat_report_${dateFrom}_${dateTo}.csv`;a.click();
    toast.success('KRA VAT report exported!');
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center text-3xl shadow-lg shadow-red-200">🇰🇪</div>
          <div>
            <h1 className="text-2xl font-black text-gray-800">KRA VAT Report</h1>
            <p className="text-sm text-gray-500 mt-0.5">Kenya Revenue Authority · VAT {VAT_RATE}% · Tax compliance · {activeOutlet?.outlet_name}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-semibold text-sm transition-all">📥 Export for KRA</button>
          <button onClick={load} disabled={loading} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold text-sm transition-all disabled:opacity-60">🔄 Refresh</button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {label:'Total Transactions',value:filtered.length,icon:'🧾',color:'border-l-blue-500',bg:'bg-blue-50',vc:'text-blue-700'},
          {label:'Taxable Turnover',value:`Ksh ${Math.round(totTaxable).toLocaleString()}`,icon:'💰',color:'border-l-emerald-500',bg:'bg-emerald-50',vc:'text-emerald-700'},
          {label:'VAT Collected',value:`Ksh ${Math.round(totVAT).toLocaleString()}`,icon:'🏦',color:'border-l-red-500',bg:'bg-red-50',vc:'text-red-700'},
          {label:'Total Revenue (incl. VAT)',value:`Ksh ${Math.round(totRevenue).toLocaleString()}`,icon:'📊',color:'border-l-purple-500',bg:'bg-purple-50',vc:'text-purple-700'},
        ].map((c,i)=>(
          <div key={i} className={`bg-white rounded-2xl border-l-4 ${c.color} ${c.bg} p-5 shadow-sm`}>
            <div className="flex items-center gap-2 mb-2"><span className="text-xl">{c.icon}</span><p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{c.label}</p></div>
            <p className={`text-2xl font-black ${c.vc}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* KRA Filing Summary by Month */}
      {Object.keys(monthlyMap).length > 1 && (
        <div className="bg-white rounded-2xl border p-6 shadow-sm">
          <h3 className="text-sm font-bold text-gray-700 mb-4 uppercase tracking-wider">📋 Monthly VAT Summary (for KRA Filing)</h3>
          <table className="w-full">
            <thead><tr className="bg-red-50 border-b"><th className="text-left py-2 px-4 text-xs font-bold text-gray-500 uppercase">Month</th><th className="text-right py-2 px-4 text-xs font-bold text-gray-500 uppercase">Transactions</th><th className="text-right py-2 px-4 text-xs font-bold text-gray-500 uppercase">Taxable Turnover</th><th className="text-right py-2 px-4 text-xs font-bold text-gray-500 uppercase">VAT @ {VAT_RATE}%</th></tr></thead>
            <tbody className="divide-y divide-gray-100">
              {Object.entries(monthlyMap).sort(([a],[b])=>b.localeCompare(a)).map(([month,v])=>(
                <tr key={month} className="hover:bg-gray-50/60">
                  <td className="py-2.5 px-4 font-semibold text-sm text-gray-800">{month}</td>
                  <td className="py-2.5 px-4 text-right text-sm">{v.transactions}</td>
                  <td className="py-2.5 px-4 text-right font-bold text-sm text-gray-800">Ksh {Math.round(v.taxable).toLocaleString()}</td>
                  <td className="py-2.5 px-4 text-right font-black text-sm text-red-600">Ksh {Math.round(v.vat).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr className="bg-red-50 border-t font-bold"><td className="py-2.5 px-4 text-sm">TOTAL</td><td className="py-2.5 px-4 text-right text-sm">{filtered.length}</td><td className="py-2.5 px-4 text-right text-sm">Ksh {Math.round(totTaxable).toLocaleString()}</td><td className="py-2.5 px-4 text-right text-sm text-red-700">Ksh {Math.round(totVAT).toLocaleString()}</td></tr></tfoot>
          </table>
        </div>
      )}

      {/* Period Selector */}
      <div className="bg-white rounded-2xl border p-4 flex flex-wrap items-center gap-3 shadow-sm">
        <div className="flex bg-gray-100 rounded-xl p-1 gap-0.5">
          {[{l:'This Month',v:'month'},{l:'Last Month',v:'lastmonth'},{l:'Q1',v:'q1'},{l:'Q2',v:'q2'},{l:'Q3',v:'q3'},{l:'Full Year',v:'year'}].map(p=>(
            <button key={p.v} onClick={()=>setPresetDate(p.v)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${preset===p.v?'bg-white text-red-600 shadow-sm':'text-gray-500 hover:text-gray-700'}`}>{p.l}</button>
          ))}
        </div>
        <input type="date" value={dateFrom} onChange={e=>{setDateFrom(e.target.value);setPreset('');}} className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-400"/>
        <span className="text-gray-400">→</span>
        <input type="date" value={dateTo} onChange={e=>{setDateTo(e.target.value);setPreset('');}} className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-400"/>
        <div className="flex-1 relative min-w-[160px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
          <input value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} placeholder="Search receipt or customer…" className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-400"/>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-2xl border overflow-hidden shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="bg-gradient-to-r from-red-50 to-rose-50 border-b">
              {['#','Date','Receipt','Customer','Taxable Amt','VAT 16%','Total','Payment'].map(h=>(
                <th key={h} className={`py-3.5 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider ${['#','Date','Receipt','Customer','Payment'].includes(h)?'text-left':'text-right'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading?(<tr><td colSpan={8} className="py-20 text-center"><div className="flex flex-col items-center gap-3"><div className="w-12 h-12 border-4 border-red-400 border-t-transparent rounded-full animate-spin"/><p className="text-gray-400 text-sm">Loading VAT data…</p></div></td></tr>)
            :paged.length===0?(<tr><td colSpan={8} className="py-20 text-center text-gray-400">No taxable transactions found for this period</td></tr>)
            :paged.map((r,i)=>(
              <tr key={i} className="hover:bg-gray-50/60 transition-colors">
                <td className="py-3 px-4 text-xs text-gray-400">{(page-1)*PAGE_SIZE+i+1}</td>
                <td className="py-3 px-4 text-sm text-gray-600">{r.sale_date}</td>
                <td className="py-3 px-4 font-semibold text-sm text-blue-600">{r.receipt_no}</td>
                <td className="py-3 px-4 text-sm text-gray-700">{r.customer_name}</td>
                <td className="py-3 px-4 text-right text-sm">Ksh {Math.round(r.taxable_amount).toLocaleString()}</td>
                <td className="py-3 px-4 text-right font-bold text-sm text-red-600">Ksh {Math.round(r.vat_amount).toLocaleString()}</td>
                <td className="py-3 px-4 text-right font-black text-sm text-gray-800">Ksh {Math.round(r.total_amount).toLocaleString()}</td>
                <td className="py-3 px-4"><span className={`px-2.5 py-1 rounded-full text-xs font-bold ${r.payment_method?.toLowerCase().includes('mpesa')?'bg-green-100 text-green-700':r.payment_method?.toLowerCase().includes('credit')?'bg-orange-100 text-orange-700':'bg-blue-100 text-blue-700'}`}>{r.payment_method}</span></td>
              </tr>
            ))}
          </tbody>
          {filtered.length>0&&<tfoot><tr className="bg-gradient-to-r from-red-50 to-rose-50 border-t font-bold"><td colSpan={4} className="py-3 px-4 text-sm text-gray-600">TOTALS ({filtered.length} transactions)</td><td className="py-3 px-4 text-right text-sm">Ksh {Math.round(totTaxable).toLocaleString()}</td><td className="py-3 px-4 text-right text-sm text-red-700">Ksh {Math.round(totVAT).toLocaleString()}</td><td className="py-3 px-4 text-right text-sm">Ksh {Math.round(totRevenue).toLocaleString()}</td><td/></tr></tfoot>}
        </table>
        {totalPages>1&&(
          <div className="flex items-center justify-between px-4 py-3.5 border-t bg-gray-50/50">
            <p className="text-sm text-gray-500">Showing <strong>{(page-1)*PAGE_SIZE+1}–{Math.min(page*PAGE_SIZE,filtered.length)}</strong> of <strong>{filtered.length}</strong></p>
            <div className="flex items-center gap-1">
              <button onClick={()=>setPage(1)} disabled={page===1} className="px-2.5 py-1.5 rounded-lg text-xs font-bold disabled:opacity-30 hover:bg-gray-200">«</button>
              <button onClick={()=>setPage(p=>p-1)} disabled={page===1} className="px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-30 hover:bg-gray-200">‹</button>
              {Array.from({length:Math.min(7,totalPages)},(_,i)=>{let pg=i+1;if(totalPages>7&&page>4)pg=page-3+i;if(pg<1||pg>totalPages)return null;return <button key={pg} onClick={()=>setPage(pg)} className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${pg===page?'bg-red-600 text-white shadow-md':'hover:bg-gray-200 text-gray-600'}`}>{pg}</button>;})}
              <button onClick={()=>setPage(p=>p+1)} disabled={page===totalPages} className="px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-30 hover:bg-gray-200">›</button>
              <button onClick={()=>setPage(totalPages)} disabled={page===totalPages} className="px-2.5 py-1.5 rounded-lg text-xs font-bold disabled:opacity-30 hover:bg-gray-200">»</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
