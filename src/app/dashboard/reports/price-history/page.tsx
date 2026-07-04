'use client';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';
import toast from 'react-hot-toast';

interface PriceChange { id:number; product_id:number; product_name:string; category:string; change_type:'cost'|'selling'; old_price:number; new_price:number; change_pct:number; changed_by:string; changed_at:string; notes:string; }
const PAGE_SIZE=25;

export default function PriceHistoryPage() {
  const { activeOutlet } = useOutlet();
  const outletId = activeOutlet?.outlet_id||1;
  const [data, setData] = useState<PriceChange[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(()=>{const d=new Date();d.setDate(d.getDate()-90);return d.toISOString().split('T')[0];});
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [filterType, setFilterType] = useState('All');
  const [filterProduct, setFilterProduct] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const load = useCallback(async()=>{
    if(!activeOutlet)return;
    setLoading(true);
    try {
      const [{ data: history }, { data: prods }] = await Promise.all([
        supabase.from('retail_price_history').select('*').eq('outlet_id',outletId).gte('changed_at',dateFrom+'T00:00:00').lte('changed_at',dateTo+'T23:59:59').order('changed_at',{ascending:false}),
        supabase.from('retail_products').select('pid,product_name,category').eq('outlet_id',outletId).eq('active',true),
      ]);
      setData(history||[]);
      setProducts(prods||[]);
    } catch { toast.error('Failed to load'); }
    setLoading(false); setPage(1);
  },[outletId,dateFrom,dateTo,activeOutlet]);

  useEffect(()=>{load();},[load]);

  const filtered=data.filter(r=>{
    const mt=filterType==='All'||r.change_type===filterType;
    const mp=!filterProduct||String(r.product_id)===filterProduct;
    const ms=!search||r.product_name?.toLowerCase().includes(search.toLowerCase());
    return mt&&mp&&ms;
  });
  const totalPages=Math.ceil(filtered.length/PAGE_SIZE);
  const paged=filtered.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE);
  const increases=filtered.filter(r=>r.change_pct>0).length;
  const decreases=filtered.filter(r=>r.change_pct<0).length;

  const exportCSV=()=>{
    const rows=[['Date','Product','Category','Type','Old Price','New Price','Change %','Changed By','Notes']];
    filtered.forEach(r=>rows.push([r.changed_at?.split('T')[0],r.product_name,r.category||'',r.change_type,String(r.old_price),String(r.new_price),(r.change_pct>0?'+':'')+r.change_pct.toFixed(1)+'%',r.changed_by||'',r.notes||'']));
    const blob=new Blob([rows.map(r=>r.join(',')).join('\n')],{type:'text/csv'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`price_history_${dateFrom}_${dateTo}.csv`;a.click();
    toast.success('Exported!');
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center text-3xl shadow-lg shadow-orange-200">🏷️</div>
          <div><h1 className="text-2xl font-black text-gray-800">Price History Report</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track all price changes · Cost & selling prices · {activeOutlet?.outlet_name}</p></div>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-semibold text-sm transition-all">📥 Export</button>
          <button onClick={load} disabled={loading} className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-semibold text-sm transition-all disabled:opacity-60">🔄 Refresh</button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          {label:'Total Changes',value:filtered.length,color:'border-l-blue-500',bg:'bg-blue-50',vc:'text-blue-700',icon:'🔄'},
          {label:'Price Increases',value:increases,color:'border-l-red-500',bg:'bg-red-50',vc:'text-red-600',icon:'📈'},
          {label:'Price Decreases',value:decreases,color:'border-l-emerald-500',bg:'bg-emerald-50',vc:'text-emerald-600',icon:'📉'},
        ].map((c,i)=>(
          <div key={i} className={`bg-white rounded-2xl border-l-4 ${c.color} ${c.bg} p-5 shadow-sm`}>
            <div className="flex items-center gap-2 mb-2"><span className="text-xl">{c.icon}</span><p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{c.label}</p></div>
            <p className={`text-3xl font-black ${c.vc}`}>{c.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
        <span className="text-2xl mt-0.5">💡</span>
        <div><p className="font-bold text-amber-800 text-sm">Price History Tracking</p>
        <p className="text-amber-700 text-sm mt-1">This report pulls from the <code className="bg-amber-100 px-1 rounded">retail_price_history</code> table. Every time a product price is edited, a record is automatically created. If this table doesn&apos;t exist yet, run: <code className="bg-amber-100 px-1 rounded text-xs">CREATE TABLE retail_price_history (id SERIAL PRIMARY KEY, outlet_id INT, product_id INT, product_name TEXT, category TEXT, change_type TEXT, old_price NUMERIC, new_price NUMERIC, change_pct NUMERIC, changed_by TEXT, changed_at TIMESTAMPTZ DEFAULT NOW(), notes TEXT);</code></p></div>
      </div>

      <div className="bg-white rounded-2xl border p-4 flex flex-wrap items-center gap-3 shadow-sm">
        <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"/>
        <span className="text-gray-400">→</span>
        <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"/>
        <select value={filterType} onChange={e=>{setFilterType(e.target.value);setPage(1);}} className="px-3 py-2 border border-gray-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white">
          <option value="All">All Types</option><option value="cost">Cost Price</option><option value="selling">Selling Price</option>
        </select>
        <select value={filterProduct} onChange={e=>{setFilterProduct(e.target.value);setPage(1);}} className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white">
          <option value="">All Products</option>
          {products.map((p:any)=><option key={p.pid} value={String(p.pid)}>{p.product_name}</option>)}
        </select>
        <div className="flex-1 relative min-w-[160px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
          <input value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} placeholder="Search product…" className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"/>
        </div>
      </div>

      <div className="bg-white rounded-2xl border overflow-hidden shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="bg-gradient-to-r from-orange-50 to-amber-50 border-b">
              {['#','Date & Time','Product','Category','Type','Old Price','New Price','Change','Changed By','Notes'].map(h=>(
                <th key={h} className="text-left py-3.5 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading?(<tr><td colSpan={10} className="py-20 text-center"><div className="flex flex-col items-center gap-3"><div className="w-12 h-12 border-4 border-orange-400 border-t-transparent rounded-full animate-spin"/><p className="text-gray-400 text-sm">Loading price history…</p></div></td></tr>)
            :paged.length===0?(<tr><td colSpan={10} className="py-20 text-center text-gray-400">No price changes found for this period</td></tr>)
            :paged.map((r,i)=>{
              const up=r.change_pct>0; const dn=r.change_pct<0;
              return (
                <tr key={r.id} className="hover:bg-gray-50/60 transition-colors">
                  <td className="py-3 px-4 text-xs text-gray-400">{(page-1)*PAGE_SIZE+i+1}</td>
                  <td className="py-3 px-4 text-sm text-gray-600">{r.changed_at?.split('T')[0]} <span className="text-gray-400">{r.changed_at?.split('T')[1]?.slice(0,5)}</span></td>
                  <td className="py-3 px-4 font-semibold text-sm text-gray-800">{r.product_name}</td>
                  <td className="py-3 px-4"><span className="px-2 py-0.5 bg-gray-100 rounded-md text-xs text-gray-500">{r.category||'—'}</span></td>
                  <td className="py-3 px-4"><span className={`px-2.5 py-1 rounded-full text-xs font-bold ${r.change_type==='cost'?'bg-blue-100 text-blue-700':'bg-purple-100 text-purple-700'}`}>{r.change_type==='cost'?'Cost Price':'Selling Price'}</span></td>
                  <td className="py-3 px-4 text-right text-sm text-gray-500">Ksh {(r.old_price||0).toLocaleString()}</td>
                  <td className="py-3 px-4 text-right font-bold text-sm text-gray-800">Ksh {(r.new_price||0).toLocaleString()}</td>
                  <td className="py-3 px-4 text-center"><span className={`px-2.5 py-1 rounded-full text-xs font-black ${up?'bg-red-100 text-red-700':dn?'bg-emerald-100 text-emerald-700':'bg-gray-100 text-gray-600'}`}>{r.change_pct>0?'+':''}{(r.change_pct||0).toFixed(1)}%</span></td>
                  <td className="py-3 px-4 text-sm text-gray-500">{r.changed_by||'System'}</td>
                  <td className="py-3 px-4 text-sm text-gray-400 max-w-[120px] truncate">{r.notes||'—'}</td>
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
              {Array.from({length:Math.min(7,totalPages)},(_,i)=>{let pg=i+1;if(totalPages>7&&page>4)pg=page-3+i;if(pg<1||pg>totalPages)return null;return <button key={pg} onClick={()=>setPage(pg)} className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${pg===page?'bg-orange-500 text-white shadow-md':'hover:bg-gray-200 text-gray-600'}`}>{pg}</button>;})}
              <button onClick={()=>setPage(p=>p+1)} disabled={page===totalPages} className="px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-30 hover:bg-gray-200">›</button>
              <button onClick={()=>setPage(totalPages)} disabled={page===totalPages} className="px-2.5 py-1.5 rounded-lg text-xs font-bold disabled:opacity-30 hover:bg-gray-200">»</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
