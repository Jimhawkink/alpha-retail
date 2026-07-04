'use client';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';
import toast from 'react-hot-toast';

interface MarginRow { id:string; name:string; type:'product'|'category'; total_qty:number; revenue:number; cost:number; gross_profit:number; margin_pct:number; transactions:number; }
const PAGE_SIZE=25;

export default function GrossMarginPage() {
  const { activeOutlet } = useOutlet();
  const outletId = activeOutlet?.outlet_id||1;
  const [data, setData] = useState<MarginRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'product'|'category'>('product');
  const [dateFrom, setDateFrom] = useState(()=>{ const d=new Date(); d.setDate(d.getDate()-30); return d.toISOString().split('T')[0]; });
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [preset, setPreset] = useState('30d');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'profit'|'margin'|'revenue'|'qty'>('profit');
  const [page, setPage] = useState(1);

  const setPresetDate=(p:string)=>{
    setPreset(p); const now=new Date(); const to=now.toISOString().split('T')[0]; let from=to;
    if(p==='7d'){const d=new Date();d.setDate(d.getDate()-7);from=d.toISOString().split('T')[0];}
    else if(p==='30d'){const d=new Date();d.setDate(d.getDate()-30);from=d.toISOString().split('T')[0];}
    else if(p==='month'){from=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;}
    else if(p==='year'){from=`${now.getFullYear()}-01-01`;}
    setDateFrom(from);setDateTo(to);
  };

  const load = useCallback(async()=>{
    if(!activeOutlet)return;
    setLoading(true);
    try {
      const { data: items } = await supabase
        .from('retail_sales_items')
        .select('product_id,product_name,quantity,unit_price,cost_price,subtotal,profit,sale_id')
        .gte('created_at',dateFrom+'T00:00:00').lte('created_at',dateTo+'T23:59:59');
      const { data: prods } = await supabase.from('retail_products').select('pid,product_name,category').eq('outlet_id',outletId).eq('active',true);
      const catMap:Record<number,string>={};
      (prods||[]).forEach((p:any)=>{catMap[p.pid]=p.category||'Uncategorized';});

      if(view==='product'){
        const map:Record<number,{name:string;qty:number;rev:number;cost:number;profit:number;txns:Set<number>}>={};
        (items||[]).forEach((it:any)=>{
          if(!map[it.product_id])map[it.product_id]={name:it.product_name||`Product #${it.product_id}`,qty:0,rev:0,cost:0,profit:0,txns:new Set()};
          map[it.product_id].qty+=(it.quantity||0);
          map[it.product_id].rev+=(it.subtotal||0);
          map[it.product_id].cost+=(it.quantity||0)*(it.cost_price||0);
          map[it.product_id].profit+=(it.profit||0);
          map[it.product_id].txns.add(it.sale_id);
        });
        const result:MarginRow[]=Object.entries(map).map(([pid,v])=>({
          id:pid,name:v.name,type:'product',total_qty:v.qty,revenue:v.rev,cost:v.cost,
          gross_profit:v.profit>0?v.profit:v.rev-v.cost,
          margin_pct:v.rev>0?((v.profit>0?v.profit:v.rev-v.cost)/v.rev)*100:0,
          transactions:v.txns.size,
        }));
        result.sort((a,b)=>sortBy==='margin'?b.margin_pct-a.margin_pct:sortBy==='revenue'?b.revenue-a.revenue:sortBy==='qty'?b.total_qty-a.total_qty:b.gross_profit-a.gross_profit);
        setData(result);
      } else {
        const map:Record<string,{qty:number;rev:number;cost:number;profit:number;txns:Set<number>}>={};
        (items||[]).forEach((it:any)=>{
          const cat=catMap[it.product_id]||'Uncategorized';
          if(!map[cat])map[cat]={qty:0,rev:0,cost:0,profit:0,txns:new Set()};
          map[cat].qty+=(it.quantity||0);
          map[cat].rev+=(it.subtotal||0);
          map[cat].cost+=(it.quantity||0)*(it.cost_price||0);
          map[cat].profit+=(it.profit||0);
          map[cat].txns.add(it.sale_id);
        });
        const result:MarginRow[]=Object.entries(map).map(([cat,v])=>({
          id:cat,name:cat,type:'category',total_qty:v.qty,revenue:v.rev,cost:v.cost,
          gross_profit:v.profit>0?v.profit:v.rev-v.cost,
          margin_pct:v.rev>0?((v.profit>0?v.profit:v.rev-v.cost)/v.rev)*100:0,
          transactions:v.txns.size,
        }));
        result.sort((a,b)=>sortBy==='margin'?b.margin_pct-a.margin_pct:sortBy==='revenue'?b.revenue-a.revenue:sortBy==='qty'?b.total_qty-a.total_qty:b.gross_profit-a.gross_profit);
        setData(result);
      }
    } catch { toast.error('Failed to load'); }
    setLoading(false);
    setPage(1);
  },[outletId,dateFrom,dateTo,view,sortBy,activeOutlet]);

  useEffect(()=>{load();},[load]);
  const filtered=data.filter(r=>!search||r.name.toLowerCase().includes(search.toLowerCase()));
  const totalPages=Math.ceil(filtered.length/PAGE_SIZE);
  const paged=filtered.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE);
  const totRev=filtered.reduce((s,r)=>s+r.revenue,0);
  const totCost=filtered.reduce((s,r)=>s+r.cost,0);
  const totProfit=filtered.reduce((s,r)=>s+r.gross_profit,0);
  const overallMargin=totRev>0?(totProfit/totRev)*100:0;
  const topMarginItem=filtered.length>0?[...filtered].sort((a,b)=>b.margin_pct-a.margin_pct)[0]:null;
  const lowestMarginItem=filtered.filter(r=>r.revenue>0).length>0?[...filtered].filter(r=>r.revenue>0).sort((a,b)=>a.margin_pct-b.margin_pct)[0]:null;

  const marginColor=(pct:number)=>pct>=40?'text-emerald-600 bg-emerald-50':pct>=20?'text-amber-600 bg-amber-50':'text-red-600 bg-red-50';
  const marginBar=(pct:number)=>pct>=40?'bg-emerald-500':pct>=20?'bg-amber-500':'bg-red-500';

  const exportCSV=()=>{
    const rows=[[view==='product'?'Product':'Category','Revenue','Cost','Gross Profit','Margin %','Qty Sold','Transactions']];
    filtered.forEach(r=>rows.push([r.name,String(Math.round(r.revenue)),String(Math.round(r.cost)),String(Math.round(r.gross_profit)),r.margin_pct.toFixed(1)+'%',String(r.total_qty),String(r.transactions)]));
    const blob=new Blob([rows.map(r=>r.join(',')).join('\n')],{type:'text/csv'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`gross_margin_${view}_${dateFrom}_${dateTo}.csv`;a.click();
    toast.success('Exported!');
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-3xl shadow-lg shadow-emerald-200">📐</div>
          <div>
            <h1 className="text-2xl font-black text-gray-800">Gross Margin Analysis</h1>
            <p className="text-sm text-gray-500 mt-0.5">Profitability by {view} · {activeOutlet?.outlet_name}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-semibold text-sm transition-all">📥 Export</button>
          <button onClick={load} disabled={loading} className="px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-xl font-semibold text-sm transition-all disabled:opacity-60">🔄 Refresh</button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {label:'Total Revenue',value:`Ksh ${Math.round(totRev).toLocaleString()}`,color:'border-l-blue-500',bg:'bg-blue-50',vc:'text-blue-700',icon:'💰'},
          {label:'Total Cost',value:`Ksh ${Math.round(totCost).toLocaleString()}`,color:'border-l-red-400',bg:'bg-red-50',vc:'text-red-600',icon:'🏷️'},
          {label:'Gross Profit',value:`Ksh ${Math.round(totProfit).toLocaleString()}`,color:'border-l-emerald-500',bg:'bg-emerald-50',vc:'text-emerald-700',icon:'📈'},
          {label:'Overall Margin',value:`${overallMargin.toFixed(1)}%`,color:'border-l-teal-500',bg:'bg-teal-50',vc:'text-teal-700',icon:'📐'},
        ].map((c,i)=>(
          <div key={i} className={`bg-white rounded-2xl border-l-4 ${c.color} ${c.bg} p-5 shadow-sm`}>
            <div className="flex items-center gap-2 mb-2"><span className="text-lg">{c.icon}</span><p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{c.label}</p></div>
            <p className={`text-2xl font-black ${c.vc}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Insights */}
      {(topMarginItem||lowestMarginItem)&&(
        <div className="grid grid-cols-2 gap-4">
          {topMarginItem&&<div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3">
            <span className="text-3xl">🏆</span>
            <div><p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Highest Margin</p><p className="font-black text-gray-800 mt-0.5">{topMarginItem.name}</p><p className="text-emerald-700 font-bold text-lg">{topMarginItem.margin_pct.toFixed(1)}% margin</p></div>
          </div>}
          {lowestMarginItem&&<div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-3">
            <span className="text-3xl">⚠️</span>
            <div><p className="text-xs font-bold text-red-500 uppercase tracking-wider">Lowest Margin</p><p className="font-black text-gray-800 mt-0.5">{lowestMarginItem.name}</p><p className="text-red-600 font-bold text-lg">{lowestMarginItem.margin_pct.toFixed(1)}% margin</p></div>
          </div>}
        </div>
      )}

      {/* Controls */}
      <div className="bg-white rounded-2xl border p-4 flex flex-wrap items-center gap-3 shadow-sm">
        <div className="flex bg-gray-100 rounded-xl p-1 gap-0.5">
          {['product','category'].map(v=>(
            <button key={v} onClick={()=>{setView(v as any);setPage(1);}} className={`px-4 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${view===v?'bg-white text-teal-600 shadow-sm':'text-gray-500 hover:text-gray-700'}`}>{v==='product'?'By Product':'By Category'}</button>
          ))}
        </div>
        <div className="flex bg-gray-100 rounded-xl p-1 gap-0.5">
          {[{l:'7D',v:'7d'},{l:'30D',v:'30d'},{l:'Month',v:'month'},{l:'Year',v:'year'}].map(p=>(
            <button key={p.v} onClick={()=>setPresetDate(p.v)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${preset===p.v?'bg-white text-teal-600 shadow-sm':'text-gray-500 hover:text-gray-700'}`}>{p.l}</button>
          ))}
        </div>
        <input type="date" value={dateFrom} onChange={e=>{setDateFrom(e.target.value);setPreset('');}} className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"/>
        <span className="text-gray-400 text-sm">→</span>
        <input type="date" value={dateTo} onChange={e=>{setDateTo(e.target.value);setPreset('');}} className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"/>
        <select value={sortBy} onChange={e=>setSortBy(e.target.value as any)} className="px-3 py-2 border border-gray-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white">
          <option value="profit">↓ Gross Profit</option><option value="margin">↓ Margin %</option><option value="revenue">↓ Revenue</option><option value="qty">↓ Qty Sold</option>
        </select>
        <div className="flex-1 relative min-w-[160px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
          <input value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} placeholder="Search…" className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"/>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border overflow-hidden shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="bg-gradient-to-r from-teal-50 to-emerald-50 border-b">
              <th className="text-left py-3.5 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">#</th>
              <th className="text-left py-3.5 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">{view==='product'?'Product':'Category'}</th>
              <th className="text-right py-3.5 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Revenue</th>
              <th className="text-right py-3.5 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Cost</th>
              <th className="text-right py-3.5 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Gross Profit</th>
              <th className="text-center py-3.5 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Margin %</th>
              <th className="text-center py-3.5 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Margin Bar</th>
              <th className="text-right py-3.5 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Qty Sold</th>
              <th className="text-center py-3.5 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Txns</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading?(<tr><td colSpan={9} className="py-24 text-center"><div className="flex flex-col items-center gap-3"><div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"/><p className="text-gray-400 text-sm">Computing margins…</p></div></td></tr>)
            :paged.length===0?(<tr><td colSpan={9} className="py-20 text-center text-gray-400">No data found for this period</td></tr>)
            :paged.map((r,i)=>(
              <tr key={r.id} className="hover:bg-gray-50/60 transition-colors">
                <td className="py-3 px-4 text-xs text-gray-400">{(page-1)*PAGE_SIZE+i+1}</td>
                <td className="py-3 px-4 font-semibold text-sm text-gray-800">{r.name}</td>
                <td className="py-3 px-4 text-right text-sm text-gray-700">Ksh {Math.round(r.revenue).toLocaleString()}</td>
                <td className="py-3 px-4 text-right text-sm text-red-500">Ksh {Math.round(r.cost).toLocaleString()}</td>
                <td className="py-3 px-4 text-right font-bold text-sm text-emerald-600">Ksh {Math.round(r.gross_profit).toLocaleString()}</td>
                <td className="py-3 px-4 text-center"><span className={`px-2.5 py-1 rounded-full text-xs font-black ${marginColor(r.margin_pct)}`}>{r.margin_pct.toFixed(1)}%</span></td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden"><div className={`h-2 rounded-full ${marginBar(r.margin_pct)}`} style={{width:`${Math.min(100,Math.max(0,r.margin_pct))}%`}}/></div>
                  </div>
                </td>
                <td className="py-3 px-4 text-right text-sm text-gray-600">{r.total_qty.toLocaleString()}</td>
                <td className="py-3 px-4 text-center text-sm text-gray-500">{r.transactions}</td>
              </tr>
            ))}
          </tbody>
          {filtered.length>0&&(
            <tfoot><tr className="bg-gradient-to-r from-teal-50 to-emerald-50 border-t font-bold">
              <td colSpan={2} className="py-3 px-4 text-sm text-gray-600">TOTALS — {filtered.length} {view}s</td>
              <td className="py-3 px-4 text-right text-sm text-blue-700">Ksh {Math.round(totRev).toLocaleString()}</td>
              <td className="py-3 px-4 text-right text-sm text-red-500">Ksh {Math.round(totCost).toLocaleString()}</td>
              <td className="py-3 px-4 text-right text-sm text-emerald-700">Ksh {Math.round(totProfit).toLocaleString()}</td>
              <td className="py-3 px-4 text-center"><span className={`px-2.5 py-1 rounded-full text-xs font-black ${marginColor(overallMargin)}`}>{overallMargin.toFixed(1)}%</span></td>
              <td colSpan={3}/>
            </tr></tfoot>
          )}
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
