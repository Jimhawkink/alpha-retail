'use client';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';
import toast from 'react-hot-toast';

interface PPVRow { pid:number; product_name:string; category:string; supplier_name:string; prev_cost:number; new_cost:number; variance:number; variance_pct:number; last_purchase_date:string; qty_purchased:number; variance_impact:number; }
const PAGE_SIZE=25;

export default function PurchasePriceVariancePage() {
  const { activeOutlet } = useOutlet();
  const outletId = activeOutlet?.outlet_id||1;
  const [data, setData] = useState<PPVRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(()=>{const d=new Date();d.setDate(d.getDate()-90);return d.toISOString().split('T')[0];});
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [filterType, setFilterType] = useState('All');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const load = useCallback(async()=>{
    if(!activeOutlet)return;
    setLoading(true);
    try {
      const { data: purchItems } = await supabase
        .from('retail_purchase_items')
        .select('product_id,product_name,unit_cost,quantity,created_at,purchase_id')
        .gte('created_at',dateFrom+'T00:00:00').lte('created_at',dateTo+'T23:59:59')
        .order('created_at',{ascending:true});
      const { data: purchases } = await supabase
        .from('retail_purchases').select('purchase_id,supplier_id').eq('outlet_id',outletId);
      const { data: suppliers } = await supabase.from('retail_suppliers').select('supplier_id,supplier_name');
      const { data: prods } = await supabase.from('retail_products').select('pid,category').eq('outlet_id',outletId);

      const supplierMap:Record<number,string>={};
      (suppliers||[]).forEach((s:any)=>{supplierMap[s.supplier_id]=s.supplier_name;});
      const purchSupMap:Record<number,number>={};
      (purchases||[]).forEach((p:any)=>{purchSupMap[p.purchase_id]=p.supplier_id;});
      const catMap:Record<number,string>={};
      (prods||[]).forEach((p:any)=>{catMap[p.pid]=p.category||'Uncategorized';});

      // Group by product, find first and last cost in period
      const prodMap:Record<number,{name:string;costs:{cost:number;qty:number;date:string;supId:number}[]}> = {};
      (purchItems||[]).forEach((it:any)=>{
        if(!prodMap[it.product_id])prodMap[it.product_id]={name:it.product_name,costs:[]};
        prodMap[it.product_id].costs.push({cost:it.unit_cost||0,qty:it.quantity||0,date:it.created_at,supId:purchSupMap[it.purchase_id]||0});
      });

      const result:PPVRow[]=Object.entries(prodMap)
        .filter(([,v])=>v.costs.length>=2)
        .map(([pid,v])=>{
          const sorted=v.costs.sort((a,b)=>a.date.localeCompare(b.date));
          const prev=sorted[0]; const latest=sorted[sorted.length-1];
          const variance=latest.cost-prev.cost;
          const variancePct=prev.cost>0?(variance/prev.cost)*100:0;
          const totalQty=sorted.reduce((s,c)=>s+c.qty,0);
          return {pid:Number(pid),product_name:v.name,category:catMap[Number(pid)]||'Uncategorized',supplier_name:supplierMap[latest.supId]||'—',prev_cost:prev.cost,new_cost:latest.cost,variance,variance_pct:variancePct,last_purchase_date:latest.date.split('T')[0],qty_purchased:totalQty,variance_impact:variance*totalQty};
        })
        .sort((a,b)=>Math.abs(b.variance_impact)-Math.abs(a.variance_impact));

      setData(result);setPage(1);
    } catch { toast.error('Failed to load'); }
    setLoading(false);
  },[outletId,dateFrom,dateTo,activeOutlet]);

  useEffect(()=>{load();},[load]);
  const filtered=data.filter(r=>{
    const mt=filterType==='All'||(filterType==='increase'&&r.variance>0)||(filterType==='decrease'&&r.variance<0);
    const ms=!search||r.product_name.toLowerCase().includes(search.toLowerCase())||(r.supplier_name||'').toLowerCase().includes(search.toLowerCase());
    return mt&&ms;
  });
  const totalPages=Math.ceil(filtered.length/PAGE_SIZE);
  const paged=filtered.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE);
  const totImpact=filtered.reduce((s,r)=>s+r.variance_impact,0);
  const increases=filtered.filter(r=>r.variance>0).length;
  const decreases=filtered.filter(r=>r.variance<0).length;

  const exportCSV=()=>{
    const rows=[['Product','Category','Supplier','Previous Cost','New Cost','Variance','Variance%','Qty Purchased','Cost Impact','Last Purchase']];
    filtered.forEach(r=>rows.push([r.product_name,r.category,r.supplier_name,String(r.prev_cost),String(r.new_cost),(r.variance>0?'+':'')+r.variance.toFixed(2),(r.variance_pct>0?'+':'')+r.variance_pct.toFixed(1)+'%',String(r.qty_purchased),(r.variance_impact>0?'+':'')+Math.round(r.variance_impact).toString(),r.last_purchase_date]));
    const blob=new Blob([rows.map(r=>r.join(',')).join('\n')],{type:'text/csv'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`purchase_price_variance_${dateFrom}_${dateTo}.csv`;a.click();
    toast.success('Exported!');
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-fuchsia-500 to-purple-700 flex items-center justify-center text-3xl shadow-lg shadow-fuchsia-200">📊</div>
          <div><h1 className="text-2xl font-black text-gray-800">Purchase Price Variance</h1>
          <p className="text-sm text-gray-500 mt-0.5">Detect supplier price changes · Cost impact analysis · {activeOutlet?.outlet_name}</p></div>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-semibold text-sm transition-all">📥 Export</button>
          <button onClick={load} disabled={loading} className="px-4 py-2 bg-fuchsia-500 hover:bg-fuchsia-600 text-white rounded-xl font-semibold text-sm transition-all disabled:opacity-60">🔄 Refresh</button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          {label:'Price Increases',value:increases,sub:'products cost more',color:'border-l-red-500',bg:'bg-red-50',vc:'text-red-600',icon:'📈'},
          {label:'Price Decreases',value:decreases,sub:'products cost less',color:'border-l-emerald-500',bg:'bg-emerald-50',vc:'text-emerald-600',icon:'📉'},
          {label:'Net Cost Impact',value:`${totImpact>=0?'+':''}Ksh ${Math.abs(Math.round(totImpact)).toLocaleString()}`,sub:totImpact>0?'extra cost incurred':'cost saved',color:totImpact>0?'border-l-red-500':'border-l-emerald-500',bg:totImpact>0?'bg-red-50':'bg-emerald-50',vc:totImpact>0?'text-red-600':'text-emerald-600',icon:'💰'},
        ].map((c,i)=>(
          <div key={i} className={`bg-white rounded-2xl border-l-4 ${c.color} ${c.bg} p-5 shadow-sm`}>
            <div className="flex items-center gap-2 mb-2"><span className="text-xl">{c.icon}</span><p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{c.label}</p></div>
            <p className={`text-3xl font-black ${c.vc}`}>{c.value}</p>
            <p className="text-xs text-gray-400 mt-1">{c.sub}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border p-4 flex flex-wrap items-center gap-3 shadow-sm">
        <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-fuchsia-400"/>
        <span className="text-gray-400">→</span>
        <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-fuchsia-400"/>
        <div className="flex bg-gray-100 rounded-xl p-1 gap-0.5">
          {[{l:'All',v:'All'},{l:'📈 Increases',v:'increase'},{l:'📉 Decreases',v:'decrease'}].map(f=>(
            <button key={f.v} onClick={()=>{setFilterType(f.v);setPage(1);}} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filterType===f.v?'bg-white text-fuchsia-600 shadow-sm':'text-gray-500 hover:text-gray-700'}`}>{f.l}</button>
          ))}
        </div>
        <div className="flex-1 relative min-w-[160px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
          <input value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} placeholder="Search product or supplier…" className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-fuchsia-400"/>
        </div>
        <span className="text-xs text-gray-500 bg-gray-100 px-3 py-1.5 rounded-lg">{filtered.length} products</span>
      </div>

      <div className="bg-white rounded-2xl border overflow-hidden shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="bg-gradient-to-r from-fuchsia-50 to-purple-50 border-b">
              {['#','Product','Category','Supplier','Prev Cost','New Cost','Change','Change %','Qty Bought','Cost Impact','Last Purchase'].map(h=>(
                <th key={h} className={`py-3.5 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider ${['#','Product','Category','Supplier','Last Purchase'].includes(h)?'text-left':'text-right'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading?(<tr><td colSpan={11} className="py-20 text-center"><div className="flex flex-col items-center gap-3"><div className="w-12 h-12 border-4 border-fuchsia-400 border-t-transparent rounded-full animate-spin"/><p className="text-gray-400 text-sm">Analysing price variance…</p></div></td></tr>)
            :paged.length===0?(<tr><td colSpan={11} className="py-20 text-center text-gray-400">No price variance found — all products purchased at same price in this period</td></tr>)
            :paged.map((r,i)=>{
              const up=r.variance>0;
              return (
                <tr key={r.pid} className={`hover:bg-gray-50/60 transition-colors ${up?'bg-red-50/20':r.variance<0?'bg-emerald-50/20':''}`}>
                  <td className="py-3 px-4 text-xs text-gray-400">{(page-1)*PAGE_SIZE+i+1}</td>
                  <td className="py-3 px-4 font-semibold text-sm text-gray-800">{r.product_name}</td>
                  <td className="py-3 px-4"><span className="px-2 py-0.5 bg-gray-100 rounded-md text-xs text-gray-500">{r.category}</span></td>
                  <td className="py-3 px-4 text-sm text-gray-500">{r.supplier_name}</td>
                  <td className="py-3 px-4 text-right text-sm text-gray-500 line-through">Ksh {r.prev_cost.toLocaleString()}</td>
                  <td className="py-3 px-4 text-right font-bold text-sm text-gray-800">Ksh {r.new_cost.toLocaleString()}</td>
                  <td className="py-3 px-4 text-right"><span className={`font-bold text-sm ${up?'text-red-600':'text-emerald-600'}`}>{up?'+':''}Ksh {Math.abs(r.variance).toFixed(2)}</span></td>
                  <td className="py-3 px-4 text-right"><span className={`px-2.5 py-1 rounded-full text-xs font-black ${up?'bg-red-100 text-red-700':'bg-emerald-100 text-emerald-700'}`}>{up?'+':''}{r.variance_pct.toFixed(1)}%</span></td>
                  <td className="py-3 px-4 text-right text-sm text-gray-600">{r.qty_purchased}</td>
                  <td className="py-3 px-4 text-right"><span className={`font-black text-sm ${up?'text-red-600':'text-emerald-600'}`}>{up?'+':''}Ksh {Math.abs(Math.round(r.variance_impact)).toLocaleString()}</span></td>
                  <td className="py-3 px-4 text-sm text-gray-400">{r.last_purchase_date}</td>
                </tr>
              );
            })}
          </tbody>
          {filtered.length>0&&<tfoot><tr className="bg-gradient-to-r from-fuchsia-50 to-purple-50 border-t font-bold"><td colSpan={9} className="py-3 px-4 text-sm text-gray-600">TOTAL NET COST IMPACT</td><td className="py-3 px-4 text-right text-sm"><span className={totImpact>0?'text-red-700':'text-emerald-700'}>{totImpact>0?'+':''}Ksh {Math.abs(Math.round(totImpact)).toLocaleString()}</span></td><td/></tr></tfoot>}
        </table>
        {totalPages>1&&(
          <div className="flex items-center justify-between px-4 py-3.5 border-t bg-gray-50/50">
            <p className="text-sm text-gray-500">Showing <strong>{(page-1)*PAGE_SIZE+1}–{Math.min(page*PAGE_SIZE,filtered.length)}</strong> of <strong>{filtered.length}</strong></p>
            <div className="flex items-center gap-1">
              <button onClick={()=>setPage(1)} disabled={page===1} className="px-2.5 py-1.5 rounded-lg text-xs font-bold disabled:opacity-30 hover:bg-gray-200">«</button>
              <button onClick={()=>setPage(p=>p-1)} disabled={page===1} className="px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-30 hover:bg-gray-200">‹</button>
              {Array.from({length:Math.min(7,totalPages)},(_,i)=>{let pg=i+1;if(totalPages>7&&page>4)pg=page-3+i;if(pg<1||pg>totalPages)return null;return <button key={pg} onClick={()=>setPage(pg)} className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${pg===page?'bg-fuchsia-500 text-white shadow-md':'hover:bg-gray-200 text-gray-600'}`}>{pg}</button>;})}
              <button onClick={()=>setPage(p=>p+1)} disabled={page===totalPages} className="px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-30 hover:bg-gray-200">›</button>
              <button onClick={()=>setPage(totalPages)} disabled={page===totalPages} className="px-2.5 py-1.5 rounded-lg text-xs font-bold disabled:opacity-30 hover:bg-gray-200">»</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
