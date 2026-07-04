'use client';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';
import toast from 'react-hot-toast';

interface AgingRow { pid:number; product_name:string; category:string; stock_qty:number; cost_price:number; selling_price:number; stock_value:number; days_in_stock:number; bucket:string; first_received:string|null; }
const PAGE_SIZE=25;
const BUCKETS=[{label:'0–30 days',min:0,max:30,color:'bg-emerald-100 text-emerald-700',bar:'bg-emerald-500'},{label:'31–60 days',min:31,max:60,color:'bg-blue-100 text-blue-700',bar:'bg-blue-500'},{label:'61–90 days',min:61,max:90,color:'bg-amber-100 text-amber-700',bar:'bg-amber-500'},{label:'91–180 days',min:91,max:180,color:'bg-orange-100 text-orange-700',bar:'bg-orange-500'},{label:'180+ days ⚠️',min:181,max:Infinity,color:'bg-red-100 text-red-700',bar:'bg-red-500'}];

export default function StockAgingPage() {
  const { activeOutlet } = useOutlet();
  const outletId = activeOutlet?.outlet_id||1;
  const [data, setData] = useState<AgingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterBucket, setFilterBucket] = useState('All');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const load = useCallback(async()=>{
    if(!activeOutlet)return;
    setLoading(true);
    try {
      const [{ data: prods },{ data: stocks },{ data: firstPurchases }] = await Promise.all([
        supabase.from('retail_products').select('pid,product_name,category,cost_price,selling_price').eq('outlet_id',outletId).eq('active',true),
        supabase.from('retail_stock').select('pid,qty').eq('outlet_id',outletId),
        supabase.from('retail_purchase_items').select('product_id,created_at').order('created_at',{ascending:true}).limit(5000),
      ]);
      const stockMap:Record<number,number>={};
      (stocks||[]).forEach((s:any)=>{stockMap[s.pid]=(stockMap[s.pid]||0)+(s.qty||0);});
      const firstMap:Record<number,string>={};
      (firstPurchases||[]).forEach((p:any)=>{if(!firstMap[p.product_id])firstMap[p.product_id]=p.created_at;});

      const result:AgingRow[]=(prods||[])
        .filter((p:any)=>(stockMap[p.pid]||0)>0)
        .map((p:any)=>{
          const sq=stockMap[p.pid]||0;
          const fr=firstMap[p.pid];
          const days=fr?Math.floor((Date.now()-new Date(fr).getTime())/86400000):0;
          const bkt=BUCKETS.find(b=>days>=b.min&&days<=b.max)?.label||'0–30 days';
          return {pid:p.pid,product_name:p.product_name,category:p.category||'Uncategorized',stock_qty:sq,cost_price:p.cost_price||0,selling_price:p.selling_price||0,stock_value:sq*(p.cost_price||0),days_in_stock:days,bucket:bkt,first_received:fr?fr.split('T')[0]:null};
        })
        .sort((a,b)=>b.days_in_stock-a.days_in_stock);

      setData(result);setPage(1);
    } catch { toast.error('Failed to load'); }
    setLoading(false);
  },[outletId,activeOutlet]);

  useEffect(()=>{load();},[load]);
  const filtered=data.filter(r=>{
    const mb=filterBucket==='All'||r.bucket===filterBucket;
    const ms=!search||r.product_name.toLowerCase().includes(search.toLowerCase())||r.category.toLowerCase().includes(search.toLowerCase());
    return mb&&ms;
  });
  const totalPages=Math.ceil(filtered.length/PAGE_SIZE);
  const paged=filtered.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE);

  // Bucket summary
  const bucketSummary=BUCKETS.map(b=>{
    const items=data.filter(r=>r.bucket===b.label);
    return {...b,count:items.length,value:items.reduce((s,r)=>s+r.stock_value,0)};
  });
  const maxBucketValue=Math.max(...bucketSummary.map(b=>b.value),1);
  const criticalValue=data.filter(r=>r.bucket==='180+ days ⚠️').reduce((s,r)=>s+r.stock_value,0);
  const totalValue=filtered.reduce((s,r)=>s+r.stock_value,0);

  const exportCSV=()=>{
    const rows=[['Product','Category','Stock Qty','Cost Price','Stock Value','Days In Stock','Bucket','First Received']];
    filtered.forEach(r=>rows.push([r.product_name,r.category,String(r.stock_qty),String(r.cost_price),String(Math.round(r.stock_value)),String(r.days_in_stock),r.bucket,r.first_received||'Unknown']));
    const blob=new Blob([rows.map(r=>r.join(',')).join('\n')],{type:'text/csv'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='stock_aging_report.csv';a.click();
    toast.success('Exported!');
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-500 to-gray-700 flex items-center justify-center text-3xl shadow-lg shadow-slate-200">⏳</div>
          <div><h1 className="text-2xl font-black text-gray-800">Stock Aging Report</h1>
          <p className="text-sm text-gray-500 mt-0.5">How long has your stock been sitting · Age buckets · {activeOutlet?.outlet_name}</p></div>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-semibold text-sm transition-all">📥 Export</button>
          <button onClick={load} disabled={loading} className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-xl font-semibold text-sm transition-all disabled:opacity-60">🔄 Refresh</button>
        </div>
      </div>

      {criticalValue>0&&(
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
          <span className="text-2xl">⚠️</span>
          <div><p className="font-bold text-red-800">Old Stock Alert</p>
          <p className="text-red-600 text-sm mt-0.5">{data.filter(r=>r.bucket==='180+ days ⚠️').length} products have stock sitting for 180+ days with Ksh {Math.round(criticalValue).toLocaleString()} tied up. Consider running promotions to clear this stock.</p></div>
        </div>
      )}

      {/* Aging Buckets Chart */}
      <div className="bg-white rounded-2xl border p-6 shadow-sm">
        <h3 className="text-sm font-bold text-gray-700 mb-5 uppercase tracking-wider">📊 Stock Aging Distribution</h3>
        <div className="space-y-4">
          {bucketSummary.map(b=>(
            <button key={b.label} onClick={()=>setFilterBucket(filterBucket===b.label?'All':b.label)} className={`w-full text-left group transition-all ${filterBucket===b.label?'ring-2 ring-offset-2 ring-slate-400 rounded-xl':''}`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${b.color}`}>{b.label}</span>
                <div className="text-right"><span className="font-black text-sm text-gray-800">{b.count} products</span><span className="text-xs text-gray-400 ml-2">Ksh {Math.round(b.value).toLocaleString()}</span></div>
              </div>
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden"><div className={`h-3 rounded-full ${b.bar} transition-all duration-700 group-hover:opacity-80`} style={{width:`${maxBucketValue>0?(b.value/maxBucketValue)*100:0}%`}}/></div>
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-4 text-center">Click a bucket to filter the table below</p>
      </div>

      {/* Filter & Search */}
      <div className="bg-white rounded-2xl border p-4 flex flex-wrap items-center gap-3 shadow-sm">
        <div className="flex bg-gray-100 rounded-xl p-1 gap-0.5 flex-wrap">
          <button onClick={()=>setFilterBucket('All')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filterBucket==='All'?'bg-white text-slate-700 shadow-sm':'text-gray-500 hover:text-gray-700'}`}>All</button>
          {BUCKETS.map(b=><button key={b.label} onClick={()=>setFilterBucket(b.label)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filterBucket===b.label?'bg-white text-slate-700 shadow-sm':'text-gray-500 hover:text-gray-700'}`}>{b.label}</button>)}
        </div>
        <div className="flex-1 relative min-w-[160px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
          <input value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} placeholder="Search product or category…" className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"/>
        </div>
        <span className="text-xs text-gray-500 bg-gray-100 px-3 py-1.5 rounded-lg">{filtered.length} items · Ksh {Math.round(totalValue).toLocaleString()}</span>
      </div>

      <div className="bg-white rounded-2xl border overflow-hidden shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="bg-gradient-to-r from-slate-50 to-gray-50 border-b">
              {['#','Product','Category','Stock Qty','Cost Price','Stock Value','Days In Stock','Age Bucket','First Received'].map(h=>(
                <th key={h} className={`py-3.5 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider ${['#','Product','Category','Age Bucket','First Received'].includes(h)?'text-left':'text-right'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading?(<tr><td colSpan={9} className="py-20 text-center"><div className="flex flex-col items-center gap-3"><div className="w-12 h-12 border-4 border-slate-400 border-t-transparent rounded-full animate-spin"/><p className="text-gray-400 text-sm">Calculating stock age…</p></div></td></tr>)
            :paged.length===0?(<tr><td colSpan={9} className="py-20 text-center text-gray-400">No stock found</td></tr>)
            :paged.map((r,i)=>{
              const bkt=BUCKETS.find(b=>b.label===r.bucket)||BUCKETS[0];
              return (
                <tr key={r.pid} className={`hover:bg-gray-50/60 transition-colors ${r.bucket==='180+ days ⚠️'?'bg-red-50/20':''}`}>
                  <td className="py-3 px-4 text-xs text-gray-400">{(page-1)*PAGE_SIZE+i+1}</td>
                  <td className="py-3 px-4 font-semibold text-sm text-gray-800">{r.product_name}</td>
                  <td className="py-3 px-4"><span className="px-2 py-0.5 bg-gray-100 rounded-md text-xs text-gray-500">{r.category}</span></td>
                  <td className="py-3 px-4 text-right font-bold text-sm text-gray-800">{r.stock_qty}</td>
                  <td className="py-3 px-4 text-right text-sm text-gray-600">Ksh {r.cost_price.toLocaleString()}</td>
                  <td className="py-3 px-4 text-right font-bold text-sm text-slate-600">Ksh {Math.round(r.stock_value).toLocaleString()}</td>
                  <td className="py-3 px-4 text-right font-bold text-sm">{r.days_in_stock} days</td>
                  <td className="py-3 px-4"><span className={`px-2.5 py-1 rounded-full text-xs font-bold ${bkt.color}`}>{r.bucket}</span></td>
                  <td className="py-3 px-4 text-sm text-gray-400">{r.first_received||'—'}</td>
                </tr>
              );
            })}
          </tbody>
          {filtered.length>0&&<tfoot><tr className="bg-gradient-to-r from-slate-50 to-gray-50 border-t font-bold"><td colSpan={4} className="py-3 px-4 text-sm text-gray-600">TOTALS — {filtered.length} products</td><td/><td className="py-3 px-4 text-right text-sm text-slate-700">Ksh {Math.round(totalValue).toLocaleString()}</td><td colSpan={3}/></tr></tfoot>}
        </table>
        {totalPages>1&&(
          <div className="flex items-center justify-between px-4 py-3.5 border-t bg-gray-50/50">
            <p className="text-sm text-gray-500">Showing <strong>{(page-1)*PAGE_SIZE+1}–{Math.min(page*PAGE_SIZE,filtered.length)}</strong> of <strong>{filtered.length}</strong></p>
            <div className="flex items-center gap-1">
              <button onClick={()=>setPage(1)} disabled={page===1} className="px-2.5 py-1.5 rounded-lg text-xs font-bold disabled:opacity-30 hover:bg-gray-200">«</button>
              <button onClick={()=>setPage(p=>p-1)} disabled={page===1} className="px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-30 hover:bg-gray-200">‹</button>
              {Array.from({length:Math.min(7,totalPages)},(_,i)=>{let pg=i+1;if(totalPages>7&&page>4)pg=page-3+i;if(pg<1||pg>totalPages)return null;return <button key={pg} onClick={()=>setPage(pg)} className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${pg===page?'bg-slate-600 text-white shadow-md':'hover:bg-gray-200 text-gray-600'}`}>{pg}</button>;})}
              <button onClick={()=>setPage(p=>p+1)} disabled={page===totalPages} className="px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-30 hover:bg-gray-200">›</button>
              <button onClick={()=>setPage(totalPages)} disabled={page===totalPages} className="px-2.5 py-1.5 rounded-lg text-xs font-bold disabled:opacity-30 hover:bg-gray-200">»</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
