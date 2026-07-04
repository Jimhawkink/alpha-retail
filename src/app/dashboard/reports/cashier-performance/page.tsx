'use client';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';
import toast from 'react-hot-toast';

interface CashierStats { cashier:string; orders:number; revenue:number; cash:number; mpesa:number; credit:number; discounts:number; returns:number; avg_order:number; }
const PAGE_SIZE=20;

export default function CashierPerformancePage() {
  const { activeOutlet } = useOutlet();
  const outletId = activeOutlet?.outlet_id||1;
  const [data, setData] = useState<CashierStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(()=>{const d=new Date();d.setDate(d.getDate()-30);return d.toISOString().split('T')[0];});
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [preset, setPreset] = useState('30d');
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
      const [{ data: sales },{ data: returns }] = await Promise.all([
        supabase.from('retail_sales').select('created_by,total_amount,payment_method,discount,status').eq('outlet_id',outletId).gte('sale_date',dateFrom).lte('sale_date',dateTo),
        supabase.from('retail_sales_returns').select('created_by,total_amount').eq('outlet_id',outletId).gte('return_date',dateFrom).lte('return_date',dateTo),
      ]);
      const map:Record<string,{orders:number;revenue:number;cash:number;mpesa:number;credit:number;discounts:number;returns:number}>={};
      (sales||[]).forEach((s:any)=>{
        const k=s.created_by||'Unknown';
        if(!map[k])map[k]={orders:0,revenue:0,cash:0,mpesa:0,credit:0,discounts:0,returns:0};
        if(s.status==='Completed'||!s.status){
          map[k].orders++;
          map[k].revenue+=(s.total_amount||0);
          if(s.payment_method?.toLowerCase().includes('cash'))map[k].cash+=(s.total_amount||0);
          else if(s.payment_method?.toLowerCase().includes('mpesa'))map[k].mpesa+=(s.total_amount||0);
          else if(s.payment_method?.toLowerCase().includes('credit'))map[k].credit+=(s.total_amount||0);
          map[k].discounts+=(s.discount||0);
        }
      });
      (returns||[]).forEach((r:any)=>{
        const k=r.created_by||'Unknown';
        if(!map[k])map[k]={orders:0,revenue:0,cash:0,mpesa:0,credit:0,discounts:0,returns:0};
        map[k].returns+=(r.total_amount||0);
      });
      const result:CashierStats[]=Object.entries(map).map(([cashier,v])=>({cashier,orders:v.orders,revenue:v.revenue,cash:v.cash,mpesa:v.mpesa,credit:v.credit,discounts:v.discounts,returns:v.returns,avg_order:v.orders>0?Math.round(v.revenue/v.orders):0}));
      result.sort((a,b)=>b.revenue-a.revenue);
      setData(result);setPage(1);
    } catch { toast.error('Failed to load'); }
    setLoading(false);
  },[outletId,dateFrom,dateTo,activeOutlet]);

  useEffect(()=>{load();},[load]);
  const filtered=data.filter(r=>!search||r.cashier.toLowerCase().includes(search.toLowerCase()));
  const totalPages=Math.ceil(filtered.length/PAGE_SIZE);
  const paged=filtered.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE);
  const maxRev=Math.max(...filtered.map(r=>r.revenue),1);
  const totRev=filtered.reduce((s,r)=>s+r.revenue,0);

  const exportCSV=()=>{
    const rows=[['Cashier','Orders','Revenue','Avg Order','Cash','M-Pesa','Credit','Discounts Given','Returns']];
    filtered.forEach(r=>rows.push([r.cashier,String(r.orders),String(Math.round(r.revenue)),String(r.avg_order),String(Math.round(r.cash)),String(Math.round(r.mpesa)),String(Math.round(r.credit)),String(Math.round(r.discounts)),String(Math.round(r.returns))]));
    const blob=new Blob([rows.map(r=>r.join(',')).join('\n')],{type:'text/csv'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`cashier_performance_${dateFrom}_${dateTo}.csv`;a.click();
    toast.success('Exported!');
  };

  const colors=['from-blue-500 to-indigo-600','from-emerald-500 to-teal-600','from-violet-500 to-purple-600','from-orange-500 to-amber-600','from-rose-500 to-pink-600'];
  const medals=['🥇','🥈','🥉'];

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-700 flex items-center justify-center text-3xl shadow-lg shadow-indigo-200">👤</div>
          <div><h1 className="text-2xl font-black text-gray-800">Cashier Performance Report</h1>
          <p className="text-sm text-gray-500 mt-0.5">Staff sales analytics · Rankings · {activeOutlet?.outlet_name}</p></div>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-semibold text-sm transition-all">📥 Export</button>
          <button onClick={load} disabled={loading} className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-semibold text-sm transition-all disabled:opacity-60">🔄 Refresh</button>
        </div>
      </div>

      {/* Date controls */}
      <div className="bg-white rounded-2xl border p-4 flex flex-wrap items-center gap-3 shadow-sm">
        <div className="flex bg-gray-100 rounded-xl p-1 gap-0.5">
          {[{l:'7D',v:'7d'},{l:'30D',v:'30d'},{l:'Month',v:'month'}].map(p=>(
            <button key={p.v} onClick={()=>setPresetDate(p.v)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${preset===p.v?'bg-white text-indigo-600 shadow-sm':'text-gray-500 hover:text-gray-700'}`}>{p.l}</button>
          ))}
        </div>
        <input type="date" value={dateFrom} onChange={e=>{setDateFrom(e.target.value);setPreset('');}} className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"/>
        <span className="text-gray-400">→</span>
        <input type="date" value={dateTo} onChange={e=>{setDateTo(e.target.value);setPreset('');}} className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"/>
        <div className="flex-1 relative min-w-[160px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
          <input value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} placeholder="Search cashier…" className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"/>
        </div>
      </div>

      {/* Leaderboard bars */}
      {!loading && filtered.length > 0 && (
        <div className="bg-white rounded-2xl border p-6 shadow-sm">
          <h3 className="text-sm font-bold text-gray-700 mb-4 uppercase tracking-wider">🏆 Sales Leaderboard</h3>
          <div className="space-y-4">
            {filtered.slice(0,10).map((r,i)=>(
              <div key={r.cashier}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${colors[i%colors.length]} flex items-center justify-center text-white font-black text-xs shadow-md`}>{medals[i]||i+1}</div>
                    <span className="font-bold text-sm text-gray-800">{r.cashier}</span>
                  </div>
                  <div className="text-right"><span className="font-black text-sm text-gray-800">Ksh {Math.round(r.revenue).toLocaleString()}</span><span className="text-xs text-gray-400 ml-2">{r.orders} orders</span></div>
                </div>
                <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-2.5 rounded-full bg-gradient-to-r ${colors[i%colors.length]} transition-all duration-700`} style={{width:`${Math.round((r.revenue/maxRev)*100)}%`}}/>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Detailed Table */}
      <div className="bg-white rounded-2xl border overflow-hidden shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="bg-gradient-to-r from-indigo-50 to-violet-50 border-b">
              {['Rank','Cashier','Orders','Revenue','Avg Order','Cash','M-Pesa','Credit','Discounts','Returns','Share%'].map(h=>(
                <th key={h} className={`py-3.5 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider ${['Rank','Cashier'].includes(h)?'text-left':'text-right'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading?(<tr><td colSpan={11} className="py-20 text-center"><div className="flex flex-col items-center gap-3"><div className="w-12 h-12 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin"/><p className="text-gray-400 text-sm">Loading cashier data…</p></div></td></tr>)
            :paged.length===0?(<tr><td colSpan={11} className="py-20 text-center text-gray-400">No sales data for this period</td></tr>)
            :paged.map((r,i)=>{
              const rank=(page-1)*PAGE_SIZE+i+1;
              const share=totRev>0?((r.revenue/totRev)*100):0;
              return (
                <tr key={r.cashier} className="hover:bg-indigo-50/30 transition-colors">
                  <td className="py-3 px-4 text-lg">{rank<=3?medals[rank-1]:`#${rank}`}</td>
                  <td className="py-3 px-4"><div className="flex items-center gap-2"><div className={`w-8 h-8 rounded-full bg-gradient-to-br ${colors[(rank-1)%colors.length]} flex items-center justify-center text-white text-xs font-black`}>{r.cashier[0]?.toUpperCase()}</div><span className="font-bold text-sm text-gray-800">{r.cashier}</span></div></td>
                  <td className="py-3 px-4 text-right font-bold text-sm">{r.orders}</td>
                  <td className="py-3 px-4 text-right font-black text-sm text-indigo-600">Ksh {Math.round(r.revenue).toLocaleString()}</td>
                  <td className="py-3 px-4 text-right text-sm text-gray-600">Ksh {r.avg_order.toLocaleString()}</td>
                  <td className="py-3 px-4 text-right text-sm">Ksh {Math.round(r.cash).toLocaleString()}</td>
                  <td className="py-3 px-4 text-right text-sm text-emerald-600">Ksh {Math.round(r.mpesa).toLocaleString()}</td>
                  <td className="py-3 px-4 text-right text-sm text-amber-600">Ksh {Math.round(r.credit).toLocaleString()}</td>
                  <td className="py-3 px-4 text-right text-sm text-red-500">{r.discounts>0?`-Ksh ${Math.round(r.discounts).toLocaleString()}`:'—'}</td>
                  <td className="py-3 px-4 text-right text-sm text-gray-500">{r.returns>0?`Ksh ${Math.round(r.returns).toLocaleString()}`:'—'}</td>
                  <td className="py-3 px-4 text-right"><span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-xs font-bold">{share.toFixed(1)}%</span></td>
                </tr>
              );
            })}
          </tbody>
          {filtered.length>0&&<tfoot><tr className="bg-gradient-to-r from-indigo-50 to-violet-50 border-t font-bold"><td colSpan={2} className="py-3 px-4 text-sm text-gray-600">TOTALS — {filtered.length} cashiers</td><td className="py-3 px-4 text-right text-sm">{filtered.reduce((s,r)=>s+r.orders,0)}</td><td className="py-3 px-4 text-right text-sm text-indigo-700">Ksh {Math.round(totRev).toLocaleString()}</td><td colSpan={7}/></tr></tfoot>}
        </table>
        {totalPages>1&&(
          <div className="flex items-center justify-between px-4 py-3.5 border-t bg-gray-50/50">
            <p className="text-sm text-gray-500">Showing <strong>{(page-1)*PAGE_SIZE+1}–{Math.min(page*PAGE_SIZE,filtered.length)}</strong> of <strong>{filtered.length}</strong></p>
            <div className="flex items-center gap-1">
              <button onClick={()=>setPage(1)} disabled={page===1} className="px-2.5 py-1.5 rounded-lg text-xs font-bold disabled:opacity-30 hover:bg-gray-200">«</button>
              <button onClick={()=>setPage(p=>p-1)} disabled={page===1} className="px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-30 hover:bg-gray-200">‹</button>
              {Array.from({length:Math.min(7,totalPages)},(_,i)=>{let pg=i+1;if(totalPages>7&&page>4)pg=page-3+i;if(pg<1||pg>totalPages)return null;return <button key={pg} onClick={()=>setPage(pg)} className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${pg===page?'bg-indigo-500 text-white shadow-md':'hover:bg-gray-200 text-gray-600'}`}>{pg}</button>;})}
              <button onClick={()=>setPage(p=>p+1)} disabled={page===totalPages} className="px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-30 hover:bg-gray-200">›</button>
              <button onClick={()=>setPage(totalPages)} disabled={page===totalPages} className="px-2.5 py-1.5 rounded-lg text-xs font-bold disabled:opacity-30 hover:bg-gray-200">»</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
