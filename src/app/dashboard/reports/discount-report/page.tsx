'use client';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';
import toast from 'react-hot-toast';

interface DiscountRow { sale_id:number; receipt_no:string; sale_date:string; customer_name:string; subtotal:number; discount:number; discount_pct:number; total_amount:number; payment_method:string; created_by:string; }
const PAGE_SIZE=25;

export default function DiscountReportPage() {
  const { activeOutlet } = useOutlet();
  const outletId = activeOutlet?.outlet_id||1;
  const [data, setData] = useState<DiscountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(()=>{const d=new Date();d.setDate(d.getDate()-30);return d.toISOString().split('T')[0];});
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [preset, setPreset] = useState('30d');
  const [minDiscount, setMinDiscount] = useState(0);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const setPresetDate=(p:string)=>{
    setPreset(p);const now=new Date();const to=now.toISOString().split('T')[0];let from=to;
    if(p==='7d'){const d=new Date();d.setDate(d.getDate()-7);from=d.toISOString().split('T')[0];}
    else if(p==='30d'){const d=new Date();d.setDate(d.getDate()-30);from=d.toISOString().split('T')[0];}
    else if(p==='month'){from=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;}
    setDateFrom(from);setDateTo(to);
  };

  const load = useCallback(async()=>{
    if(!activeOutlet)return;
    setLoading(true);
    try {
      const { data: sales } = await supabase
        .from('retail_sales').select('sale_id,receipt_no,sale_date,customer_name,subtotal,discount,total_amount,payment_method,created_by,status')
        .eq('outlet_id',outletId).gte('sale_date',dateFrom).lte('sale_date',dateTo).gt('discount',0).order('discount',{ascending:false});
      const result:DiscountRow[]=(sales||[]).map((s:any)=>({
        sale_id:s.sale_id,receipt_no:s.receipt_no,sale_date:s.sale_date,customer_name:s.customer_name||'Walk-in',
        subtotal:s.subtotal||0,discount:s.discount||0,
        discount_pct:s.subtotal>0?((s.discount||0)/s.subtotal)*100:0,
        total_amount:s.total_amount||0,payment_method:s.payment_method||'Cash',created_by:s.created_by||'—',
      }));
      setData(result);setPage(1);
    } catch { toast.error('Failed to load'); }
    setLoading(false);
  },[outletId,dateFrom,dateTo,activeOutlet]);

  useEffect(()=>{load();},[load]);
  const filtered=data.filter(r=>{
    const md=r.discount>=minDiscount;
    const ms=!search||(r.receipt_no||'').toLowerCase().includes(search.toLowerCase())||(r.customer_name||'').toLowerCase().includes(search.toLowerCase())||(r.created_by||'').toLowerCase().includes(search.toLowerCase());
    return md&&ms;
  });
  const totalPages=Math.ceil(filtered.length/PAGE_SIZE);
  const paged=filtered.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE);
  const totDiscount=filtered.reduce((s,r)=>s+r.discount,0);
  const totSubtotal=filtered.reduce((s,r)=>s+r.subtotal,0);
  const avgDiscPct=filtered.length>0?filtered.reduce((s,r)=>s+r.discount_pct,0)/filtered.length:0;

  // By cashier summary
  const byCashier:Record<string,{count:number;total:number}> = {};
  filtered.forEach(r=>{if(!byCashier[r.created_by])byCashier[r.created_by]={count:0,total:0};byCashier[r.created_by].count++;byCashier[r.created_by].total+=r.discount;});
  const cashierList=Object.entries(byCashier).sort(([,a],[,b])=>b.total-a.total);

  const exportCSV=()=>{
    const rows=[['Date','Receipt','Customer','Subtotal','Discount','Discount%','Total','Payment','Cashier']];
    filtered.forEach(r=>rows.push([r.sale_date,r.receipt_no,r.customer_name,String(Math.round(r.subtotal)),String(Math.round(r.discount)),r.discount_pct.toFixed(1)+'%',String(Math.round(r.total_amount)),r.payment_method,r.created_by]));
    const blob=new Blob([rows.map(r=>r.join(',')).join('\n')],{type:'text/csv'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`discount_report_${dateFrom}_${dateTo}.csv`;a.click();
    toast.success('Exported!');
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-3xl shadow-lg shadow-amber-200">🏷️</div>
          <div><h1 className="text-2xl font-black text-gray-800">Discount & Promotion Report</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track all discounts given · Detect abuse · {activeOutlet?.outlet_name}</p></div>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-semibold text-sm transition-all">📥 Export</button>
          <button onClick={load} disabled={loading} className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-semibold text-sm transition-all disabled:opacity-60">🔄 Refresh</button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {label:'Transactions w/ Discount',value:filtered.length,icon:'🧾',color:'border-l-amber-500',bg:'bg-amber-50',vc:'text-amber-700'},
          {label:'Total Discounts Given',value:`Ksh ${Math.round(totDiscount).toLocaleString()}`,icon:'💸',color:'border-l-red-500',bg:'bg-red-50',vc:'text-red-600'},
          {label:'Revenue Before Discount',value:`Ksh ${Math.round(totSubtotal).toLocaleString()}`,icon:'💰',color:'border-l-blue-500',bg:'bg-blue-50',vc:'text-blue-700'},
          {label:'Avg Discount %',value:`${avgDiscPct.toFixed(1)}%`,icon:'📊',color:'border-l-purple-500',bg:'bg-purple-50',vc:'text-purple-700'},
        ].map((c,i)=>(
          <div key={i} className={`bg-white rounded-2xl border-l-4 ${c.color} ${c.bg} p-5 shadow-sm`}>
            <div className="flex items-center gap-2 mb-2"><span className="text-xl">{c.icon}</span><p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{c.label}</p></div>
            <p className={`text-2xl font-black ${c.vc}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* By Cashier */}
      {cashierList.length > 1 && (
        <div className="bg-white rounded-2xl border p-5 shadow-sm">
          <h3 className="text-sm font-bold text-gray-700 mb-4 uppercase tracking-wider">👤 Discounts by Cashier</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {cashierList.map(([name,v],i)=>(
              <div key={name} className={`p-4 rounded-xl border ${i===0?'bg-amber-50 border-amber-200':'bg-gray-50 border-gray-200'}`}>
                <p className="font-bold text-sm text-gray-800">{name}</p>
                <p className={`text-xl font-black mt-1 ${i===0?'text-amber-600':'text-gray-700'}`}>Ksh {Math.round(v.total).toLocaleString()}</p>
                <p className="text-xs text-gray-400 mt-0.5">{v.count} discounts {i===0&&'⚠️'}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border p-4 flex flex-wrap items-center gap-3 shadow-sm">
        <div className="flex bg-gray-100 rounded-xl p-1 gap-0.5">
          {[{l:'7D',v:'7d'},{l:'30D',v:'30d'},{l:'Month',v:'month'}].map(p=>(
            <button key={p.v} onClick={()=>setPresetDate(p.v)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${preset===p.v?'bg-white text-amber-600 shadow-sm':'text-gray-500 hover:text-gray-700'}`}>{p.l}</button>
          ))}
        </div>
        <input type="date" value={dateFrom} onChange={e=>{setDateFrom(e.target.value);setPreset('');}} className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"/>
        <span className="text-gray-400">→</span>
        <input type="date" value={dateTo} onChange={e=>{setDateTo(e.target.value);setPreset('');}} className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"/>
        <select value={minDiscount} onChange={e=>{setMinDiscount(Number(e.target.value));setPage(1);}} className="px-3 py-2 border border-gray-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white">
          <option value={0}>All discounts</option><option value={100}>Min Ksh 100</option><option value={500}>Min Ksh 500</option><option value={1000}>Min Ksh 1,000</option>
        </select>
        <div className="flex-1 relative min-w-[160px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
          <input value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} placeholder="Search receipt, customer, cashier…" className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"/>
        </div>
      </div>

      <div className="bg-white rounded-2xl border overflow-hidden shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="bg-gradient-to-r from-amber-50 to-orange-50 border-b">
              {['#','Date','Receipt','Customer','Subtotal','Discount','Disc %','Total','Payment','Cashier'].map(h=>(
                <th key={h} className={`py-3.5 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider ${['#','Date','Receipt','Customer','Payment','Cashier'].includes(h)?'text-left':'text-right'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading?(<tr><td colSpan={10} className="py-20 text-center"><div className="flex flex-col items-center gap-3"><div className="w-12 h-12 border-4 border-amber-400 border-t-transparent rounded-full animate-spin"/><p className="text-gray-400 text-sm">Loading discount data…</p></div></td></tr>)
            :paged.length===0?(<tr><td colSpan={10} className="py-20 text-center text-gray-400">No discounted transactions found</td></tr>)
            :paged.map((r,i)=>(
              <tr key={r.sale_id} className={`hover:bg-amber-50/30 transition-colors ${r.discount_pct>20?'bg-red-50/20':''}`}>
                <td className="py-3 px-4 text-xs text-gray-400">{(page-1)*PAGE_SIZE+i+1}</td>
                <td className="py-3 px-4 text-sm text-gray-600">{r.sale_date}</td>
                <td className="py-3 px-4 font-semibold text-sm text-blue-600">{r.receipt_no}</td>
                <td className="py-3 px-4 text-sm text-gray-700">{r.customer_name}</td>
                <td className="py-3 px-4 text-right text-sm text-gray-600">Ksh {Math.round(r.subtotal).toLocaleString()}</td>
                <td className="py-3 px-4 text-right font-black text-sm text-amber-600">-Ksh {Math.round(r.discount).toLocaleString()}</td>
                <td className="py-3 px-4 text-right"><span className={`px-2.5 py-1 rounded-full text-xs font-bold ${r.discount_pct>20?'bg-red-100 text-red-700':r.discount_pct>10?'bg-amber-100 text-amber-700':'bg-gray-100 text-gray-600'}`}>{r.discount_pct.toFixed(1)}%</span></td>
                <td className="py-3 px-4 text-right font-bold text-sm text-gray-800">Ksh {Math.round(r.total_amount).toLocaleString()}</td>
                <td className="py-3 px-4"><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${r.payment_method?.toLowerCase().includes('mpesa')?'bg-green-100 text-green-700':'bg-blue-100 text-blue-700'}`}>{r.payment_method}</span></td>
                <td className="py-3 px-4 text-sm text-gray-500">{r.created_by}</td>
              </tr>
            ))}
          </tbody>
          {filtered.length>0&&<tfoot><tr className="bg-gradient-to-r from-amber-50 to-orange-50 border-t font-bold"><td colSpan={4} className="py-3 px-4 text-sm text-gray-600">TOTALS — {filtered.length} discounts</td><td className="py-3 px-4 text-right text-sm">Ksh {Math.round(totSubtotal).toLocaleString()}</td><td className="py-3 px-4 text-right text-sm text-amber-700">-Ksh {Math.round(totDiscount).toLocaleString()}</td><td/><td colSpan={3}/></tr></tfoot>}
        </table>
        {totalPages>1&&(
          <div className="flex items-center justify-between px-4 py-3.5 border-t bg-gray-50/50">
            <p className="text-sm text-gray-500">Showing <strong>{(page-1)*PAGE_SIZE+1}–{Math.min(page*PAGE_SIZE,filtered.length)}</strong> of <strong>{filtered.length}</strong></p>
            <div className="flex items-center gap-1">
              <button onClick={()=>setPage(1)} disabled={page===1} className="px-2.5 py-1.5 rounded-lg text-xs font-bold disabled:opacity-30 hover:bg-gray-200">«</button>
              <button onClick={()=>setPage(p=>p-1)} disabled={page===1} className="px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-30 hover:bg-gray-200">‹</button>
              {Array.from({length:Math.min(7,totalPages)},(_,i)=>{let pg=i+1;if(totalPages>7&&page>4)pg=page-3+i;if(pg<1||pg>totalPages)return null;return <button key={pg} onClick={()=>setPage(pg)} className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${pg===page?'bg-amber-500 text-white shadow-md':'hover:bg-gray-200 text-gray-600'}`}>{pg}</button>;})}
              <button onClick={()=>setPage(p=>p+1)} disabled={page===totalPages} className="px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-30 hover:bg-gray-200">›</button>
              <button onClick={()=>setPage(totalPages)} disabled={page===totalPages} className="px-2.5 py-1.5 rounded-lg text-xs font-bold disabled:opacity-30 hover:bg-gray-200">»</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
