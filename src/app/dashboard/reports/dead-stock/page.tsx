'use client';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';
import toast from 'react-hot-toast';

interface DeadItem { pid:number; product_name:string; category:string; stock_qty:number; cost_price:number; selling_price:number; stock_cost_value:number; stock_sell_value:number; days_since_sold:number; last_sold_date:string|null; }
const PAGE_SIZE=25;

export default function DeadStockPage() {
  const { activeOutlet } = useOutlet();
  const outletId = activeOutlet?.outlet_id||1;
  const [data, setData] = useState<DeadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [threshold, setThreshold] = useState(30);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<'value'|'days'|'qty'>('value');

  const load = useCallback(async () => {
    if (!activeOutlet) return;
    setLoading(true);
    try {
      const [{ data: prods }, { data: stocks }, { data: lastSales }] = await Promise.all([
        supabase.from('retail_products').select('pid,product_name,category,cost_price,selling_price').eq('outlet_id',outletId).eq('active',true),
        supabase.from('retail_stock').select('pid,qty').eq('outlet_id',outletId),
        supabase.from('retail_sales_items').select('product_id,created_at').order('created_at',{ascending:false}).limit(5000),
      ]);
      const stockMap:Record<number,number>={};
      (stocks||[]).forEach((s:any)=>{stockMap[s.pid]=(stockMap[s.pid]||0)+(s.qty||0);});
      const lastMap:Record<number,string>={};
      (lastSales||[]).forEach((s:any)=>{if(!lastMap[s.product_id])lastMap[s.product_id]=s.created_at;});
      const cutoff=Date.now()-(threshold*86400000);
      const result:DeadItem[]=(prods||[])
        .map((p:any)=>{
          const sq=stockMap[p.pid]||0; if(sq<=0) return null;
          const ls=lastMap[p.pid]; const lastDate=ls?new Date(ls):null;
          const daysSince=lastDate?Math.floor((Date.now()-lastDate.getTime())/86400000):999;
          if(daysSince<threshold) return null;
          return {pid:p.pid,product_name:p.product_name,category:p.category||'Uncategorized',stock_qty:sq,cost_price:p.cost_price||0,selling_price:p.selling_price||0,stock_cost_value:sq*(p.cost_price||0),stock_sell_value:sq*(p.selling_price||0),days_since_sold:daysSince,last_sold_date:lastDate?lastDate.toISOString().split('T')[0]:null};
        })
        .filter(Boolean) as DeadItem[];
      result.sort((a,b)=>sortBy==='days'?b.days_since_sold-a.days_since_sold:sortBy==='qty'?b.stock_qty-a.stock_qty:b.stock_cost_value-a.stock_cost_value);
      setData(result); setPage(1);
    } catch { toast.error('Failed to load'); }
    setLoading(false);
  },[outletId,threshold,sortBy,activeOutlet]);

  useEffect(()=>{load();},[load]);

  const filtered=data.filter(p=>!search||p.product_name.toLowerCase().includes(search.toLowerCase())||p.category.toLowerCase().includes(search.toLowerCase()));
  const totalPages=Math.ceil(filtered.length/PAGE_SIZE);
  const paged=filtered.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE);
  const totalCostValue=filtered.reduce((s,p)=>s+p.stock_cost_value,0);
  const totalSellValue=filtered.reduce((s,p)=>s+p.stock_sell_value,0);
  const neverSold=filtered.filter(p=>p.days_since_sold>=999).length;

  const exportCSV=()=>{
    const rows=[['Product','Category','Stock Qty','Cost Price','Sell Price','Cost Value','Sell Value','Days No Sale','Last Sold']];
    filtered.forEach(p=>rows.push([p.product_name,p.category,String(p.stock_qty),String(p.cost_price),String(p.selling_price),String(Math.round(p.stock_cost_value)),String(Math.round(p.stock_sell_value)),p.days_since_sold>=999?'Never':String(p.days_since_sold),p.last_sold_date||'Never']));
    const blob=new Blob([rows.map(r=>r.join(',')).join('\n')],{type:'text/csv'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`dead_stock_${threshold}d.csv`;a.click();
    toast.success('Exported!');
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-500 to-rose-700 flex items-center justify-center text-3xl shadow-lg shadow-red-200">💀</div>
          <div>
            <h1 className="text-2xl font-black text-gray-800">Dead Stock Report</h1>
            <p className="text-sm text-gray-500 mt-0.5">Products in stock with no sales · Capital locked up · {activeOutlet?.outlet_name}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-semibold text-sm transition-all shadow-sm">📥 Export CSV</button>
          <button onClick={load} disabled={loading} className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl font-semibold text-sm transition-all shadow-sm disabled:opacity-60">🔄 Refresh</button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {label:'Dead Stock Items',value:filtered.length,sub:'products with no sales',color:'border-l-red-500',bg:'bg-red-50',vc:'text-red-600',icon:'💀'},
          {label:'Capital Locked (Cost)',value:`Ksh ${Math.round(totalCostValue).toLocaleString()}`,sub:'cost value tied up',color:'border-l-orange-500',bg:'bg-orange-50',vc:'text-orange-600',icon:'🔒'},
          {label:'Potential Revenue',value:`Ksh ${Math.round(totalSellValue).toLocaleString()}`,sub:'at selling price',color:'border-l-amber-500',bg:'bg-amber-50',vc:'text-amber-600',icon:'💰'},
          {label:'Never Sold',value:neverSold,sub:'products with 0 sales ever',color:'border-l-gray-500',bg:'bg-gray-50',vc:'text-gray-600',icon:'❌'},
        ].map((c,i)=>(
          <div key={i} className={`bg-white rounded-2xl border-l-4 ${c.color} ${c.bg} p-5 shadow-sm`}>
            <div className="flex items-center gap-2 mb-2"><span className="text-xl">{c.icon}</span><p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{c.label}</p></div>
            <p className={`text-2xl font-black ${c.vc}`}>{c.value}</p>
            <p className="text-xs text-gray-400 mt-1">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="bg-white rounded-2xl border p-4 flex flex-wrap items-center gap-3 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-600">No sales in:</span>
          <div className="flex bg-gray-100 rounded-xl p-1 gap-0.5">
            {[{l:'30d',v:30},{l:'60d',v:60},{l:'90d',v:90},{l:'180d',v:180}].map(d=>(
              <button key={d.v} onClick={()=>{setThreshold(d.v);setPage(1);}} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${threshold===d.v?'bg-white text-red-600 shadow-sm':'text-gray-500 hover:text-gray-700'}`}>{d.l}</button>
            ))}
          </div>
        </div>
        <select value={sortBy} onChange={e=>setSortBy(e.target.value as any)} className="px-3 py-2 border border-gray-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-red-400 bg-white">
          <option value="value">↓ Cost Value</option>
          <option value="days">↓ Days No Sale</option>
          <option value="qty">↓ Stock Qty</option>
        </select>
        <div className="flex-1 relative min-w-[180px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
          <input value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} placeholder="Search product or category…" className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-400"/>
        </div>
        <span className="text-xs text-gray-500 font-medium bg-red-50 text-red-600 px-3 py-1.5 rounded-lg border border-red-200">{filtered.length} dead items</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border overflow-hidden shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="bg-gradient-to-r from-red-50 to-rose-50 border-b">
              <th className="text-left py-3.5 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">#</th>
              <th className="text-left py-3.5 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Product</th>
              <th className="text-left py-3.5 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Category</th>
              <th className="text-right py-3.5 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Stock Qty</th>
              <th className="text-right py-3.5 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Cost Price</th>
              <th className="text-right py-3.5 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Sell Price</th>
              <th className="text-right py-3.5 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Cost Value</th>
              <th className="text-right py-3.5 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Sell Value</th>
              <th className="text-center py-3.5 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Days No Sale</th>
              <th className="text-center py-3.5 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Last Sold</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading?(<tr><td colSpan={10} className="py-24 text-center"><div className="flex flex-col items-center gap-3"><div className="w-12 h-12 border-4 border-red-400 border-t-transparent rounded-full animate-spin"/><p className="text-gray-400 text-sm">Finding dead stock…</p></div></td></tr>)
            :paged.length===0?(<tr><td colSpan={10} className="py-24 text-center"><div className="text-center"><div className="text-5xl mb-3">🎉</div><p className="font-bold text-gray-700">No dead stock found!</p><p className="text-gray-400 text-sm mt-1">All products with stock have sold in the last {threshold} days</p></div></td></tr>)
            :paged.map((p,i)=>{
              const urgency=p.days_since_sold>=180?'bg-red-100 text-red-700':p.days_since_sold>=90?'bg-orange-100 text-orange-700':'bg-amber-100 text-amber-700';
              return (
                <tr key={p.pid} className="hover:bg-red-50/30 transition-colors">
                  <td className="py-3 px-4 text-xs text-gray-400">{(page-1)*PAGE_SIZE+i+1}</td>
                  <td className="py-3 px-4 font-semibold text-sm text-gray-800">{p.product_name}</td>
                  <td className="py-3 px-4"><span className="px-2 py-0.5 bg-gray-100 rounded-md text-xs text-gray-500">{p.category}</span></td>
                  <td className="py-3 px-4 text-right font-bold text-sm text-gray-800">{p.stock_qty.toLocaleString()}</td>
                  <td className="py-3 px-4 text-right text-sm text-gray-600">Ksh {p.cost_price.toLocaleString()}</td>
                  <td className="py-3 px-4 text-right text-sm text-gray-600">Ksh {p.selling_price.toLocaleString()}</td>
                  <td className="py-3 px-4 text-right font-bold text-sm text-red-600">Ksh {Math.round(p.stock_cost_value).toLocaleString()}</td>
                  <td className="py-3 px-4 text-right font-bold text-sm text-amber-600">Ksh {Math.round(p.stock_sell_value).toLocaleString()}</td>
                  <td className="py-3 px-4 text-center"><span className={`px-2.5 py-1 rounded-full text-xs font-bold ${urgency}`}>{p.days_since_sold>=999?'Never sold':`${p.days_since_sold} days`}</span></td>
                  <td className="py-3 px-4 text-center text-xs text-gray-400">{p.last_sold_date||'—'}</td>
                </tr>
              );
            })}
          </tbody>
          {filtered.length>0&&(
            <tfoot>
              <tr className="bg-gradient-to-r from-red-50 to-rose-50 border-t font-bold">
                <td colSpan={6} className="py-3 px-4 text-sm text-gray-600">TOTALS — {filtered.length} dead items</td>
                <td className="py-3 px-4 text-right text-sm text-red-600">Ksh {Math.round(totalCostValue).toLocaleString()}</td>
                <td className="py-3 px-4 text-right text-sm text-amber-600">Ksh {Math.round(totalSellValue).toLocaleString()}</td>
                <td colSpan={2}/>
              </tr>
            </tfoot>
          )}
        </table>
        {totalPages>1&&(
          <div className="flex items-center justify-between px-4 py-3.5 border-t bg-gray-50/50">
            <p className="text-sm text-gray-500">Showing <strong>{(page-1)*PAGE_SIZE+1}–{Math.min(page*PAGE_SIZE,filtered.length)}</strong> of <strong>{filtered.length}</strong></p>
            <div className="flex items-center gap-1">
              <button onClick={()=>setPage(1)} disabled={page===1} className="px-2.5 py-1.5 rounded-lg text-xs font-bold disabled:opacity-30 hover:bg-gray-200">«</button>
              <button onClick={()=>setPage(p=>p-1)} disabled={page===1} className="px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-30 hover:bg-gray-200">‹</button>
              {Array.from({length:Math.min(7,totalPages)},(_,i)=>{let pg=i+1;if(totalPages>7&&page>4)pg=page-3+i;if(pg<1||pg>totalPages)return null;return <button key={pg} onClick={()=>setPage(pg)} className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${pg===page?'bg-red-500 text-white shadow-md':'hover:bg-gray-200 text-gray-600'}`}>{pg}</button>;})}
              <button onClick={()=>setPage(p=>p+1)} disabled={page===totalPages} className="px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-30 hover:bg-gray-200">›</button>
              <button onClick={()=>setPage(totalPages)} disabled={page===totalPages} className="px-2.5 py-1.5 rounded-lg text-xs font-bold disabled:opacity-30 hover:bg-gray-200">»</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
