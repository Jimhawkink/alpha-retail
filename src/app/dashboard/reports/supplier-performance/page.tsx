'use client';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';
import toast from 'react-hot-toast';

interface SupplierRow { supplier_id:number; supplier_name:string; phone:string; email:string; total_purchases:number; total_amount:number; total_returns:number; avg_order_value:number; last_purchase:string|null; product_count:number; }
const PAGE_SIZE=20;

export default function SupplierPerformancePage() {
  const { activeOutlet } = useOutlet();
  const outletId = activeOutlet?.outlet_id||1;
  const [data, setData] = useState<SupplierRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(()=>{const d=new Date();d.setDate(d.getDate()-90);return d.toISOString().split('T')[0];});
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'amount'|'purchases'|'avg'>('amount');
  const [page, setPage] = useState(1);

  const load = useCallback(async()=>{
    if(!activeOutlet)return;
    setLoading(true);
    try {
      const [{ data: suppliers },{ data: purchases },{ data: returns }] = await Promise.all([
        supabase.from('retail_suppliers').select('supplier_id,supplier_name,phone,email,contact_person'),
        supabase.from('retail_purchases').select('supplier_id,grand_total,purchase_date,status').eq('outlet_id',outletId).gte('purchase_date',dateFrom).lte('purchase_date',dateTo),
        supabase.from('retail_purchase_returns').select('supplier_id,total_amount').eq('outlet_id',outletId).gte('return_date',dateFrom).lte('return_date',dateTo),
      ]);
      const purchMap:Record<number,{count:number;amount:number;lastDate:string}> = {};
      (purchases||[]).forEach((p:any)=>{
        if(!purchMap[p.supplier_id])purchMap[p.supplier_id]={count:0,amount:0,lastDate:''};
        purchMap[p.supplier_id].count++;
        purchMap[p.supplier_id].amount+=(p.grand_total||0);
        if(!purchMap[p.supplier_id].lastDate||p.purchase_date>purchMap[p.supplier_id].lastDate)purchMap[p.supplier_id].lastDate=p.purchase_date;
      });
      const retMap:Record<number,number>={};
      (returns||[]).forEach((r:any)=>{retMap[r.supplier_id]=(retMap[r.supplier_id]||0)+(r.total_amount||0);});

      const result:SupplierRow[]=(suppliers||[]).map((s:any)=>{
        const pm=purchMap[s.supplier_id]||{count:0,amount:0,lastDate:null};
        return {supplier_id:s.supplier_id,supplier_name:s.supplier_name,phone:s.phone||'—',email:s.email||'—',total_purchases:pm.count,total_amount:pm.amount,total_returns:retMap[s.supplier_id]||0,avg_order_value:pm.count>0?Math.round(pm.amount/pm.count):0,last_purchase:pm.lastDate||null,product_count:0};
      }).filter(s=>s.total_purchases>0);
      result.sort((a,b)=>sortBy==='purchases'?b.total_purchases-a.total_purchases:sortBy==='avg'?b.avg_order_value-a.avg_order_value:b.total_amount-a.total_amount);
      setData(result);setPage(1);
    } catch { toast.error('Failed to load'); }
    setLoading(false);
  },[outletId,dateFrom,dateTo,sortBy,activeOutlet]);

  useEffect(()=>{load();},[load]);
  const filtered=data.filter(r=>!search||r.supplier_name.toLowerCase().includes(search.toLowerCase())||(r.phone||'').includes(search));
  const totalPages=Math.ceil(filtered.length/PAGE_SIZE);
  const paged=filtered.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE);
  const totAmount=filtered.reduce((s,r)=>s+r.total_amount,0);
  const totReturns=filtered.reduce((s,r)=>s+r.total_returns,0);
  const maxAmount=Math.max(...filtered.map(r=>r.total_amount),1);

  const exportCSV=()=>{
    const rows=[['Supplier','Phone','Email','Total Orders','Total Purchased','Avg Order','Returns','Last Purchase']];
    filtered.forEach(r=>rows.push([r.supplier_name,r.phone,r.email,String(r.total_purchases),String(Math.round(r.total_amount)),String(r.avg_order_value),String(Math.round(r.total_returns)),r.last_purchase||'—']));
    const blob=new Blob([rows.map(r=>r.join(',')).join('\n')],{type:'text/csv'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`supplier_performance_${dateFrom}_${dateTo}.csv`;a.click();
    toast.success('Exported!');
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-700 flex items-center justify-center text-3xl shadow-lg shadow-teal-200">🚚</div>
          <div><h1 className="text-2xl font-black text-gray-800">Supplier Performance Report</h1>
          <p className="text-sm text-gray-500 mt-0.5">Purchase history & supplier analytics · {activeOutlet?.outlet_name}</p></div>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-semibold text-sm transition-all">📥 Export</button>
          <button onClick={load} disabled={loading} className="px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-xl font-semibold text-sm transition-all disabled:opacity-60">🔄 Refresh</button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          {label:'Active Suppliers',value:filtered.length,icon:'🚚',color:'border-l-teal-500',bg:'bg-teal-50',vc:'text-teal-700'},
          {label:'Total Purchased',value:`Ksh ${Math.round(totAmount).toLocaleString()}`,icon:'💰',color:'border-l-blue-500',bg:'bg-blue-50',vc:'text-blue-700'},
          {label:'Total Returns',value:`Ksh ${Math.round(totReturns).toLocaleString()}`,icon:'↩️',color:'border-l-orange-500',bg:'bg-orange-50',vc:'text-orange-700'},
        ].map((c,i)=>(
          <div key={i} className={`bg-white rounded-2xl border-l-4 ${c.color} ${c.bg} p-5 shadow-sm`}>
            <div className="flex items-center gap-2 mb-2"><span className="text-xl">{c.icon}</span><p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{c.label}</p></div>
            <p className={`text-2xl font-black ${c.vc}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Visual bars */}
      {!loading && filtered.length > 0 && (
        <div className="bg-white rounded-2xl border p-6 shadow-sm">
          <h3 className="text-sm font-bold text-gray-700 mb-4 uppercase tracking-wider">📊 Top Suppliers by Purchase Value</h3>
          <div className="space-y-3">
            {filtered.slice(0,8).map((r,i)=>{
              const medals=['🥇','🥈','🥉'];
              return (
                <div key={r.supplier_id}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2"><span className="text-base">{medals[i]||`${i+1}.`}</span><span className="font-semibold text-sm text-gray-800">{r.supplier_name}</span></div>
                    <span className="font-black text-sm text-teal-600">Ksh {Math.round(r.total_amount).toLocaleString()}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden"><div className="h-2 rounded-full bg-gradient-to-r from-teal-500 to-cyan-500 transition-all duration-700" style={{width:`${(r.total_amount/maxAmount)*100}%`}}/></div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border p-4 flex flex-wrap items-center gap-3 shadow-sm">
        <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"/>
        <span className="text-gray-400">→</span>
        <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"/>
        <select value={sortBy} onChange={e=>setSortBy(e.target.value as any)} className="px-3 py-2 border border-gray-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white">
          <option value="amount">↓ Total Amount</option><option value="purchases">↓ No. of Orders</option><option value="avg">↓ Avg Order Value</option>
        </select>
        <div className="flex-1 relative min-w-[160px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
          <input value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} placeholder="Search supplier…" className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"/>
        </div>
      </div>

      <div className="bg-white rounded-2xl border overflow-hidden shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="bg-gradient-to-r from-teal-50 to-cyan-50 border-b">
              {['#','Supplier','Phone','Orders','Total Purchased','Avg Order','Returns','Net Purchased','Last Purchase'].map(h=>(
                <th key={h} className={`py-3.5 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider ${['#','Supplier','Phone'].includes(h)?'text-left':'text-right'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading?(<tr><td colSpan={9} className="py-20 text-center"><div className="flex flex-col items-center gap-3"><div className="w-12 h-12 border-4 border-teal-400 border-t-transparent rounded-full animate-spin"/><p className="text-gray-400 text-sm">Loading supplier data…</p></div></td></tr>)
            :paged.length===0?(<tr><td colSpan={9} className="py-20 text-center text-gray-400">No supplier purchases found for this period</td></tr>)
            :paged.map((r,i)=>{
              const net=r.total_amount-r.total_returns;
              const returnRate=r.total_amount>0?((r.total_returns/r.total_amount)*100):0;
              return (
                <tr key={r.supplier_id} className="hover:bg-teal-50/30 transition-colors">
                  <td className="py-3 px-4 text-xs text-gray-400">{(page-1)*PAGE_SIZE+i+1}</td>
                  <td className="py-3 px-4"><p className="font-bold text-sm text-gray-800">{r.supplier_name}</p><p className="text-xs text-gray-400">{r.email!=='—'?r.email:''}</p></td>
                  <td className="py-3 px-4 text-sm text-gray-500">{r.phone}</td>
                  <td className="py-3 px-4 text-right font-bold text-sm">{r.total_purchases}</td>
                  <td className="py-3 px-4 text-right font-black text-sm text-teal-600">Ksh {Math.round(r.total_amount).toLocaleString()}</td>
                  <td className="py-3 px-4 text-right text-sm text-gray-600">Ksh {r.avg_order_value.toLocaleString()}</td>
                  <td className="py-3 px-4 text-right text-sm text-red-500">{r.total_returns>0?`Ksh ${Math.round(r.total_returns).toLocaleString()}`:'—'}{r.total_returns>0&&<span className="text-xs text-gray-400 ml-1">({returnRate.toFixed(1)}%)</span>}</td>
                  <td className="py-3 px-4 text-right font-bold text-sm text-gray-800">Ksh {Math.round(net).toLocaleString()}</td>
                  <td className="py-3 px-4 text-right text-sm text-gray-400">{r.last_purchase||'—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {totalPages>1&&(
          <div className="flex items-center justify-between px-4 py-3.5 border-t bg-gray-50/50">
            <p className="text-sm text-gray-500">Showing <strong>{(page-1)*PAGE_SIZE+1}–{Math.min(page*PAGE_SIZE,filtered.length)}</strong> of <strong>{filtered.length}</strong></p>
            <div className="flex items-center gap-1">
              <button onClick={()=>setPage(1)} disabled={page===1} className="px-2.5 py-1.5 rounded-lg text-xs font-bold disabled:opacity-30 hover:bg-gray-200">«</button>
              <button onClick={()=>setPage(p=>p-1)} disabled={page===1} className="px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-30 hover:bg-gray-200">‹</button>
              {Array.from({length:Math.min(7,totalPages)},(_,i)=>{let pg=i+1;if(totalPages>7&&page>4)pg=page-3+i;if(pg<1||pg>totalPages)return null;return <button key={pg} onClick={()=>setPage(pg)} className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${pg===page?'bg-teal-500 text-white shadow-md':'hover:bg-gray-200 text-gray-600'}`}>{pg}</button>;})}
              <button onClick={()=>setPage(p=>p+1)} disabled={page===totalPages} className="px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-30 hover:bg-gray-200">›</button>
              <button onClick={()=>setPage(totalPages)} disabled={page===totalPages} className="px-2.5 py-1.5 rounded-lg text-xs font-bold disabled:opacity-30 hover:bg-gray-200">»</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
