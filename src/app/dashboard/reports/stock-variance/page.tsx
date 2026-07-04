'use client';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';
import toast from 'react-hot-toast';

interface StockVarianceRow { pid:number; product_name:string; category:string; opening_stock:number; purchased:number; expected_stock:number; actual_stock:number; variance:number; variance_value:number; cost_price:number; variance_pct:number; }
const PAGE_SIZE=25;

export default function StockVariancePage() {
  const { activeOutlet } = useOutlet();
  const outletId = activeOutlet?.outlet_id||1;
  const [data, setData] = useState<StockVarianceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(()=>{const d=new Date();d.setDate(d.getDate()-30);return d.toISOString().split('T')[0];});
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [filterType, setFilterType] = useState('All');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const load = useCallback(async()=>{
    if(!activeOutlet)return;
    setLoading(true);
    try {
      const [{ data: prods },{ data: stocks },{ data: salesItems },{ data: purchaseItems },{ data: adjustments }] = await Promise.all([
        supabase.from('retail_products').select('pid,product_name,category,cost_price').eq('outlet_id',outletId).eq('active',true),
        supabase.from('retail_stock').select('pid,qty').eq('outlet_id',outletId),
        supabase.from('retail_sales_items').select('product_id,quantity').gte('created_at',dateFrom+'T00:00:00').lte('created_at',dateTo+'T23:59:59'),
        supabase.from('retail_purchase_items').select('product_id,quantity').gte('created_at',dateFrom+'T00:00:00').lte('created_at',dateTo+'T23:59:59'),
        supabase.from('retail_stock_adjustments').select('product_id,quantity_change').eq('outlet_id',outletId).gte('created_at',dateFrom+'T00:00:00').lte('created_at',dateTo+'T23:59:59'),
      ]);
      const stockMap:Record<number,number>={};
      (stocks||[]).forEach((s:any)=>{stockMap[s.pid]=(stockMap[s.pid]||0)+(s.qty||0);});
      const soldMap:Record<number,number>={};
      (salesItems||[]).forEach((it:any)=>{soldMap[it.product_id]=(soldMap[it.product_id]||0)+(it.quantity||0);});
      const purchasedMap:Record<number,number>={};
      (purchaseItems||[]).forEach((it:any)=>{purchasedMap[it.product_id]=(purchasedMap[it.product_id]||0)+(it.quantity||0);});
      const adjMap:Record<number,number>={};
      (adjustments||[]).forEach((a:any)=>{adjMap[a.product_id]=(adjMap[a.product_id]||0)+(a.quantity_change||0);});

      const result:StockVarianceRow[]=(prods||[]).map((p:any)=>{
        const actual=stockMap[p.pid]||0;
        const sold=soldMap[p.pid]||0;
        const purchased=purchasedMap[p.pid]||0;
        const adj=adjMap[p.pid]||0;
        const opening=actual+sold-purchased-adj;
        const expected=opening+purchased+adj-sold;
        const variance=actual-expected;
        const variancePct=expected!==0?(variance/Math.abs(expected))*100:0;
        return {pid:p.pid,product_name:p.product_name,category:p.category||'Uncategorized',opening_stock:Math.max(0,opening),purchased,expected_stock:Math.max(0,expected),actual_stock:actual,variance,variance_value:variance*(p.cost_price||0),cost_price:p.cost_price||0,variance_pct:variancePct};
      }).filter(r=>Math.abs(r.variance)>0||filterType==='All');
      result.sort((a,b)=>Math.abs(b.variance_value)-Math.abs(a.variance_value));
      setData(result);setPage(1);
    } catch { toast.error('Failed to load'); }
    setLoading(false);
  },[outletId,dateFrom,dateTo,activeOutlet]);

  useEffect(()=>{load();},[load]);
  const filtered=data.filter(r=>{
    const mt=filterType==='All'||(filterType==='shortage'&&r.variance<0)||(filterType==='surplus'&&r.variance>0)||(filterType==='match'&&r.variance===0);
    const ms=!search||r.product_name.toLowerCase().includes(search.toLowerCase());
    return mt&&ms;
  });
  const totalPages=Math.ceil(filtered.length/PAGE_SIZE);
  const paged=filtered.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE);
  const totalLoss=filtered.filter(r=>r.variance<0).reduce((s,r)=>s+Math.abs(r.variance_value),0);
  const shortages=filtered.filter(r=>r.variance<0).length;
  const surpluses=filtered.filter(r=>r.variance>0).length;

  const exportCSV=()=>{
    const rows=[['Product','Category','Opening','Purchased','Expected','Actual','Variance Qty','Variance Value','Cost Price']];
    filtered.forEach(r=>rows.push([r.product_name,r.category,String(r.opening_stock),String(r.purchased),String(r.expected_stock),String(r.actual_stock),String(r.variance),String(Math.round(r.variance_value)),String(r.cost_price)]));
    const blob=new Blob([rows.map(r=>r.join(',')).join('\n')],{type:'text/csv'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`stock_variance_${dateFrom}_${dateTo}.csv`;a.click();
    toast.success('Exported!');
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-rose-500 to-red-700 flex items-center justify-center text-3xl shadow-lg shadow-rose-200">⚖️</div>
          <div><h1 className="text-2xl font-black text-gray-800">Stock Variance & Shrinkage</h1>
          <p className="text-sm text-gray-500 mt-0.5">Expected vs Actual stock · Detect theft & losses · {activeOutlet?.outlet_name}</p></div>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-semibold text-sm transition-all">📥 Export</button>
          <button onClick={load} disabled={loading} className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-xl font-semibold text-sm transition-all disabled:opacity-60">🔄 Refresh</button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          {label:'Shortages Found',value:shortages,sub:'items missing stock',color:'border-l-red-500',bg:'bg-red-50',vc:'text-red-600',icon:'📉'},
          {label:'Estimated Loss Value',value:`Ksh ${Math.round(totalLoss).toLocaleString()}`,sub:'cost value of shortages',color:'border-l-orange-500',bg:'bg-orange-50',vc:'text-orange-600',icon:'💸'},
          {label:'Surpluses Found',value:surpluses,sub:'items with extra stock',color:'border-l-emerald-500',bg:'bg-emerald-50',vc:'text-emerald-600',icon:'📈'},
        ].map((c,i)=>(
          <div key={i} className={`bg-white rounded-2xl border-l-4 ${c.color} ${c.bg} p-5 shadow-sm`}>
            <div className="flex items-center gap-2 mb-2"><span className="text-xl">{c.icon}</span><p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{c.label}</p></div>
            <p className={`text-2xl font-black ${c.vc}`}>{c.value}</p>
            <p className="text-xs text-gray-400 mt-1">{c.sub}</p>
          </div>
        ))}
      </div>

      {totalLoss > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
          <span className="text-2xl">🚨</span>
          <div><p className="font-bold text-red-800">Shrinkage Alert!</p>
          <p className="text-red-600 text-sm mt-0.5">Ksh {Math.round(totalLoss).toLocaleString()} worth of stock is unaccounted for. This could be due to theft, damage, data entry errors, or expired goods. Investigate the items marked in red below immediately.</p></div>
        </div>
      )}

      <div className="bg-white rounded-2xl border p-4 flex flex-wrap items-center gap-3 shadow-sm">
        <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"/>
        <span className="text-gray-400">→</span>
        <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"/>
        <select value={filterType} onChange={e=>{setFilterType(e.target.value);setPage(1);}} className="px-3 py-2 border border-gray-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-rose-400 bg-white">
          <option value="All">All Variances</option><option value="shortage">📉 Shortages Only</option><option value="surplus">📈 Surpluses Only</option><option value="match">✅ Matched</option>
        </select>
        <div className="flex-1 relative min-w-[160px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
          <input value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} placeholder="Search product…" className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"/>
        </div>
      </div>

      <div className="bg-white rounded-2xl border overflow-hidden shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="bg-gradient-to-r from-rose-50 to-red-50 border-b">
              {['#','Product','Category','Opening','Purchased','Expected','Actual','Variance Qty','Variance Value'].map(h=>(
                <th key={h} className={`py-3.5 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider ${['#','Product','Category'].includes(h)?'text-left':'text-right'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading?(<tr><td colSpan={9} className="py-20 text-center"><div className="flex flex-col items-center gap-3"><div className="w-12 h-12 border-4 border-rose-400 border-t-transparent rounded-full animate-spin"/><p className="text-gray-400 text-sm">Calculating stock variance…</p></div></td></tr>)
            :paged.length===0?(<tr><td colSpan={9} className="py-20 text-center"><div className="text-5xl mb-3">✅</div><p className="font-bold text-gray-700">No variances found!</p><p className="text-gray-400 text-sm mt-1">Stock levels match expected quantities</p></td></tr>)
            :paged.map((r,i)=>{
              const isShort=r.variance<0; const isSurplus=r.variance>0;
              return (
                <tr key={r.pid} className={`hover:bg-gray-50/60 transition-colors ${isShort?'bg-red-50/30':''}`}>
                  <td className="py-3 px-4 text-xs text-gray-400">{(page-1)*PAGE_SIZE+i+1}</td>
                  <td className="py-3 px-4 font-semibold text-sm text-gray-800">{r.product_name}</td>
                  <td className="py-3 px-4"><span className="px-2 py-0.5 bg-gray-100 rounded-md text-xs text-gray-500">{r.category}</span></td>
                  <td className="py-3 px-4 text-right text-sm text-gray-600">{r.opening_stock}</td>
                  <td className="py-3 px-4 text-right text-sm text-gray-600">{r.purchased}</td>
                  <td className="py-3 px-4 text-right font-bold text-sm text-gray-800">{r.expected_stock}</td>
                  <td className="py-3 px-4 text-right font-bold text-sm text-gray-800">{r.actual_stock}</td>
                  <td className="py-3 px-4 text-right"><span className={`font-black text-sm px-2.5 py-1 rounded-full ${isShort?'bg-red-100 text-red-700':isSurplus?'bg-emerald-100 text-emerald-700':'bg-gray-100 text-gray-600'}`}>{r.variance>0?'+':''}{r.variance}</span></td>
                  <td className="py-3 px-4 text-right"><span className={`font-bold text-sm ${isShort?'text-red-600':isSurplus?'text-emerald-600':'text-gray-500'}`}>{isShort?'-':'+'} Ksh {Math.abs(Math.round(r.variance_value)).toLocaleString()}</span></td>
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
              {Array.from({length:Math.min(7,totalPages)},(_,i)=>{let pg=i+1;if(totalPages>7&&page>4)pg=page-3+i;if(pg<1||pg>totalPages)return null;return <button key={pg} onClick={()=>setPage(pg)} className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${pg===page?'bg-rose-500 text-white shadow-md':'hover:bg-gray-200 text-gray-600'}`}>{pg}</button>;})}
              <button onClick={()=>setPage(p=>p+1)} disabled={page===totalPages} className="px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-30 hover:bg-gray-200">›</button>
              <button onClick={()=>setPage(totalPages)} disabled={page===totalPages} className="px-2.5 py-1.5 rounded-lg text-xs font-bold disabled:opacity-30 hover:bg-gray-200">»</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
