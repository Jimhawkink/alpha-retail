'use client';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';
import toast from 'react-hot-toast';

interface ReorderItem { pid:number; product_name:string; category:string; current_stock:number; reorder_point:number; shortage:number; avg_daily_sales:number; days_remaining:number; suggested_qty:number; cost_price:number; suggested_cost:number; supplier_name:string; urgency:'critical'|'low'|'medium'; }

export default function ReorderSuggestionPage() {
  const { activeOutlet } = useOutlet();
  const outletId = activeOutlet?.outlet_id||1;
  const [data, setData] = useState<ReorderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterUrgency, setFilterUrgency] = useState('All');
  const [search, setSearch] = useState('');
  const [includeAll, setIncludeAll] = useState(false);
  const [page, setPage] = useState(1);
  const PAGE_SIZE=25;

  const load = useCallback(async()=>{
    if(!activeOutlet)return;
    setLoading(true);
    try {
      const [{ data: prods }, { data: stocks }, { data: salesItems }, { data: suppliers }] = await Promise.all([
        supabase.from('retail_products').select('pid,product_name,category,reorder_point,cost_price,supplier_id').eq('outlet_id',outletId).eq('active',true),
        supabase.from('retail_stock').select('pid,qty').eq('outlet_id',outletId),
        supabase.from('retail_sales_items').select('product_id,quantity,created_at').gte('created_at',new Date(Date.now()-30*86400000).toISOString()),
        supabase.from('retail_suppliers').select('supplier_id,supplier_name'),
      ]);
      const stockMap:Record<number,number>={};
      (stocks||[]).forEach((s:any)=>{stockMap[s.pid]=(stockMap[s.pid]||0)+(s.qty||0);});
      const salesMap:Record<number,number>={};
      (salesItems||[]).forEach((it:any)=>{salesMap[it.product_id]=(salesMap[it.product_id]||0)+(it.quantity||0);});
      const supplierMap:Record<number,string>={};
      (suppliers||[]).forEach((s:any)=>{supplierMap[s.supplier_id]=s.supplier_name;});

      const result:ReorderItem[]=(prods||[])
        .map((p:any)=>{
          const currentStock=stockMap[p.pid]||0;
          const reorderPoint=p.reorder_point||5;
          const totalSold30=salesMap[p.pid]||0;
          const avgDailySales=totalSold30/30;
          const daysRemaining=avgDailySales>0?Math.floor(currentStock/avgDailySales):999;
          const shortage=Math.max(0,reorderPoint-currentStock);
          const suggestedQty=Math.max(shortage, Math.ceil(avgDailySales*30));
          const urgency:ReorderItem['urgency']=currentStock===0?'critical':currentStock<=reorderPoint?'low':daysRemaining<=7?'medium':'medium';
          return {pid:p.pid,product_name:p.product_name,category:p.category||'Uncategorized',current_stock:currentStock,reorder_point:reorderPoint,shortage,avg_daily_sales:avgDailySales,days_remaining:daysRemaining,suggested_qty:suggestedQty,cost_price:p.cost_price||0,suggested_cost:suggestedQty*(p.cost_price||0),supplier_name:supplierMap[p.supplier_id]||'—',urgency};
        })
        .filter(p=>includeAll||(p.current_stock<=p.reorder_point||p.days_remaining<=14))
        .sort((a,b)=>{const order={critical:0,low:1,medium:2};return order[a.urgency]-order[b.urgency]||a.days_remaining-b.days_remaining;});
      setData(result); setPage(1);
    } catch { toast.error('Failed to load'); }
    setLoading(false);
  },[outletId,includeAll,activeOutlet]);

  useEffect(()=>{load();},[load]);
  const filtered=data.filter(p=>{
    const mu=filterUrgency==='All'||p.urgency===filterUrgency;
    const ms=!search||p.product_name.toLowerCase().includes(search.toLowerCase())||p.category.toLowerCase().includes(search.toLowerCase());
    return mu&&ms;
  });
  const totalPages=Math.ceil(filtered.length/PAGE_SIZE);
  const paged=filtered.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE);
  const critical=filtered.filter(p=>p.urgency==='critical').length;
  const low=filtered.filter(p=>p.urgency==='low').length;
  const totalSuggestedCost=filtered.reduce((s,p)=>s+p.suggested_cost,0);

  const urgCfg={critical:{label:'Out of Stock',emoji:'🔴',bg:'bg-red-50',text:'text-red-700',border:'border-l-red-500',badge:'bg-red-500'},low:{label:'Below Reorder',emoji:'🟡',bg:'bg-amber-50',text:'text-amber-700',border:'border-l-amber-500',badge:'bg-amber-500'},medium:{label:'Reorder Soon',emoji:'🟢',bg:'bg-blue-50',text:'text-blue-700',border:'border-l-blue-500',badge:'bg-blue-500'}};

  const exportCSV=()=>{
    const rows=[['Product','Category','Urgency','Current Stock','Reorder Point','Shortage','Avg Daily Sales','Days Left','Suggested Order','Cost/Unit','Estimated Cost','Supplier']];
    filtered.forEach(p=>rows.push([p.product_name,p.category,p.urgency,String(p.current_stock),String(p.reorder_point),String(p.shortage),p.avg_daily_sales.toFixed(2),p.days_remaining>=999?'∞':String(p.days_remaining),String(p.suggested_qty),String(p.cost_price),String(Math.round(p.suggested_cost)),p.supplier_name]));
    const blob=new Blob([rows.map(r=>r.join(',')).join('\n')],{type:'text/csv'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='reorder_suggestions.csv';a.click();
    toast.success('Exported!');
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-3xl shadow-lg shadow-cyan-200">🔄</div>
          <div><h1 className="text-2xl font-black text-gray-800">Reorder Suggestion Report</h1>
          <p className="text-sm text-gray-500 mt-0.5">Smart purchase suggestions · Based on sales velocity · {activeOutlet?.outlet_name}</p></div>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-semibold text-sm transition-all">📥 Export PO List</button>
          <button onClick={load} disabled={loading} className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-xl font-semibold text-sm transition-all disabled:opacity-60">🔄 Refresh</button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {label:'Out of Stock',value:critical,color:'border-l-red-500',bg:'bg-red-50',vc:'text-red-600',icon:'🔴'},
          {label:'Below Reorder Point',value:low,color:'border-l-amber-500',bg:'bg-amber-50',vc:'text-amber-600',icon:'🟡'},
          {label:'Items Needing Reorder',value:filtered.length,color:'border-l-cyan-500',bg:'bg-cyan-50',vc:'text-cyan-600',icon:'📦'},
          {label:'Estimated Purchase Cost',value:`Ksh ${Math.round(totalSuggestedCost).toLocaleString()}`,color:'border-l-blue-500',bg:'bg-blue-50',vc:'text-blue-600',icon:'💰'},
        ].map((c,i)=>(
          <div key={i} className={`bg-white rounded-2xl border-l-4 ${c.color} ${c.bg} p-5 shadow-sm`}>
            <div className="flex items-center gap-2 mb-2"><span className="text-xl">{c.icon}</span><p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{c.label}</p></div>
            <p className={`text-2xl font-black ${c.vc}`}>{c.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border p-4 flex flex-wrap items-center gap-3 shadow-sm">
        <div className="flex bg-gray-100 rounded-xl p-1 gap-0.5">
          {['All','critical','low','medium'].map(u=>(
            <button key={u} onClick={()=>{setFilterUrgency(u);setPage(1);}} className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${filterUrgency===u?'bg-white text-cyan-600 shadow-sm':'text-gray-500 hover:text-gray-700'}`}>{u==='critical'?'🔴 Out of Stock':u==='low'?'🟡 Below Reorder':u==='medium'?'🟢 Reorder Soon':'All'}</button>
          ))}
        </div>
        <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={includeAll} onChange={e=>setIncludeAll(e.target.checked)} className="rounded"/><span className="text-sm font-medium text-gray-600">Show all products</span></label>
        <div className="flex-1 relative min-w-[160px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
          <input value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} placeholder="Search product…" className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400"/>
        </div>
      </div>

      <div className="bg-white rounded-2xl border overflow-hidden shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="bg-gradient-to-r from-cyan-50 to-blue-50 border-b">
              {['#','Product','Category','Urgency','In Stock','Reorder Pt','Days Left','Avg/Day','Suggest Order','Est. Cost','Supplier'].map(h=>(
                <th key={h} className={`py-3.5 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider ${['In Stock','Reorder Pt','Days Left','Avg/Day','Suggest Order','Est. Cost'].includes(h)?'text-right':'text-left'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading?(<tr><td colSpan={11} className="py-20 text-center"><div className="flex flex-col items-center gap-3"><div className="w-12 h-12 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin"/><p className="text-gray-400 text-sm">Calculating reorder needs…</p></div></td></tr>)
            :paged.length===0?(<tr><td colSpan={11} className="py-20 text-center"><div className="text-5xl mb-3">✅</div><p className="font-bold text-gray-700">All stock levels are healthy!</p></td></tr>)
            :paged.map((p,i)=>{
              const cfg=urgCfg[p.urgency];
              return (
                <tr key={p.pid} className="hover:bg-gray-50/60 transition-colors">
                  <td className="py-3 px-4 text-xs text-gray-400">{(page-1)*PAGE_SIZE+i+1}</td>
                  <td className="py-3 px-4 font-semibold text-sm text-gray-800">{p.product_name}</td>
                  <td className="py-3 px-4"><span className="px-2 py-0.5 bg-gray-100 rounded-md text-xs text-gray-500">{p.category}</span></td>
                  <td className="py-3 px-4"><span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${cfg.bg} ${cfg.text}`}>{cfg.emoji} {cfg.label}</span></td>
                  <td className="py-3 px-4 text-right"><span className={`font-black text-sm ${p.current_stock===0?'text-red-600':p.current_stock<=p.reorder_point?'text-amber-600':'text-gray-800'}`}>{p.current_stock}</span></td>
                  <td className="py-3 px-4 text-right text-sm text-gray-500">{p.reorder_point}</td>
                  <td className="py-3 px-4 text-right"><span className={`font-bold text-sm ${p.days_remaining<=3?'text-red-600':p.days_remaining<=7?'text-amber-600':'text-gray-600'}`}>{p.days_remaining>=999?'∞':`${p.days_remaining}d`}</span></td>
                  <td className="py-3 px-4 text-right text-sm text-gray-500">{p.avg_daily_sales.toFixed(2)}</td>
                  <td className="py-3 px-4 text-right font-black text-sm text-cyan-600">{p.suggested_qty}</td>
                  <td className="py-3 px-4 text-right font-bold text-sm text-blue-600">Ksh {Math.round(p.suggested_cost).toLocaleString()}</td>
                  <td className="py-3 px-4 text-sm text-gray-500">{p.supplier_name}</td>
                </tr>
              );
            })}
          </tbody>
          {filtered.length>0&&<tfoot><tr className="bg-gradient-to-r from-cyan-50 to-blue-50 border-t font-bold"><td colSpan={8} className="py-3 px-4 text-sm text-gray-600">TOTAL ESTIMATED PURCHASE COST</td><td/><td className="py-3 px-4 text-right text-sm text-blue-700">Ksh {Math.round(totalSuggestedCost).toLocaleString()}</td><td/></tr></tfoot>}
        </table>
        {totalPages>1&&(
          <div className="flex items-center justify-between px-4 py-3.5 border-t bg-gray-50/50">
            <p className="text-sm text-gray-500">Showing <strong>{(page-1)*PAGE_SIZE+1}–{Math.min(page*PAGE_SIZE,filtered.length)}</strong> of <strong>{filtered.length}</strong></p>
            <div className="flex items-center gap-1">
              <button onClick={()=>setPage(1)} disabled={page===1} className="px-2.5 py-1.5 rounded-lg text-xs font-bold disabled:opacity-30 hover:bg-gray-200">«</button>
              <button onClick={()=>setPage(p=>p-1)} disabled={page===1} className="px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-30 hover:bg-gray-200">‹</button>
              {Array.from({length:Math.min(7,totalPages)},(_,i)=>{let pg=i+1;if(totalPages>7&&page>4)pg=page-3+i;if(pg<1||pg>totalPages)return null;return <button key={pg} onClick={()=>setPage(pg)} className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${pg===page?'bg-cyan-500 text-white shadow-md':'hover:bg-gray-200 text-gray-600'}`}>{pg}</button>;})}
              <button onClick={()=>setPage(p=>p+1)} disabled={page===totalPages} className="px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-30 hover:bg-gray-200">›</button>
              <button onClick={()=>setPage(totalPages)} disabled={page===totalPages} className="px-2.5 py-1.5 rounded-lg text-xs font-bold disabled:opacity-30 hover:bg-gray-200">»</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
