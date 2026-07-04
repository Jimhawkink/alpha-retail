'use client';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';
import toast from 'react-hot-toast';

interface OutletStats { outlet_id:number; outlet_name:string; outlet_code:string; revenue:number; orders:number; profit:number; expenses:number; avg_order:number; cash:number; mpesa:number; credit:number; net:number; }

export default function OutletComparisonPage() {
  const [data, setData] = useState<OutletStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(()=>{const d=new Date();d.setDate(d.getDate()-30);return d.toISOString().split('T')[0];});
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [preset, setPreset] = useState('30d');

  const setPresetDate=(p:string)=>{
    setPreset(p); const now=new Date(); const to=now.toISOString().split('T')[0]; let from=to;
    if(p==='7d'){const d=new Date();d.setDate(d.getDate()-7);from=d.toISOString().split('T')[0];}
    else if(p==='30d'){const d=new Date();d.setDate(d.getDate()-30);from=d.toISOString().split('T')[0];}
    else if(p==='month'){from=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;}
    else if(p==='year'){from=`${now.getFullYear()}-01-01`;}
    setDateFrom(from);setDateTo(to);
  };

  const load = useCallback(async()=>{
    setLoading(true);
    try {
      const [{ data: outlets }, { data: sales }, { data: exps }] = await Promise.all([
        supabase.from('retail_outlets').select('outlet_id,outlet_name,outlet_code'),
        supabase.from('retail_sales').select('outlet_id,total_amount,profit,payment_method').gte('sale_date',dateFrom).lte('sale_date',dateTo).eq('status','Completed'),
        supabase.from('retail_expenses').select('outlet_id,amount').gte('expense_date',dateFrom).lte('expense_date',dateTo),
      ]);
      const result:OutletStats[]=(outlets||[]).map((o:any)=>{
        const oSales=(sales||[]).filter((s:any)=>s.outlet_id===o.outlet_id);
        const oExps=(exps||[]).filter((e:any)=>e.outlet_id===o.outlet_id);
        const revenue=oSales.reduce((s:number,r:any)=>s+(r.total_amount||0),0);
        const profit=oSales.reduce((s:number,r:any)=>s+(r.profit||0),0);
        const expenses=oExps.reduce((s:number,r:any)=>s+(r.amount||0),0);
        const orders=oSales.length;
        const cash=oSales.filter((r:any)=>r.payment_method?.toLowerCase().includes('cash')).reduce((s:number,r:any)=>s+(r.total_amount||0),0);
        const mpesa=oSales.filter((r:any)=>r.payment_method?.toLowerCase().includes('mpesa')).reduce((s:number,r:any)=>s+(r.total_amount||0),0);
        const credit=oSales.filter((r:any)=>r.payment_method?.toLowerCase().includes('credit')).reduce((s:number,r:any)=>s+(r.total_amount||0),0);
        return {outlet_id:o.outlet_id,outlet_name:o.outlet_name,outlet_code:o.outlet_code,revenue,orders,profit,expenses,avg_order:orders>0?Math.round(revenue/orders):0,cash,mpesa,credit,net:profit-expenses};
      });
      result.sort((a,b)=>b.revenue-a.revenue);
      setData(result);
    } catch { toast.error('Failed to load'); }
    setLoading(false);
  },[dateFrom,dateTo]);

  useEffect(()=>{load();},[load]);

  const maxRev=Math.max(...data.map(o=>o.revenue),1);
  const totRev=data.reduce((s,o)=>s+o.revenue,0);
  const totOrders=data.reduce((s,o)=>s+o.orders,0);
  const totProfit=data.reduce((s,o)=>s+o.profit,0);
  const colors=['from-blue-500 to-indigo-600','from-emerald-500 to-teal-600','from-violet-500 to-purple-600','from-orange-500 to-amber-600','from-rose-500 to-pink-600'];

  const exportCSV=()=>{
    const rows=[['Outlet','Revenue','Orders','Avg Order','Cash','M-Pesa','Credit','Profit','Expenses','Net']];
    data.forEach(o=>rows.push([o.outlet_name,String(Math.round(o.revenue)),String(o.orders),String(o.avg_order),String(Math.round(o.cash)),String(Math.round(o.mpesa)),String(Math.round(o.credit)),String(Math.round(o.profit)),String(Math.round(o.expenses)),String(Math.round(o.net))]));
    const blob=new Blob([rows.map(r=>r.join(',')).join('\n')],{type:'text/csv'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`outlet_comparison_${dateFrom}_${dateTo}.csv`;a.click();
    toast.success('Exported!');
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-700 flex items-center justify-center text-3xl shadow-lg shadow-blue-200">🏪</div>
          <div><h1 className="text-2xl font-black text-gray-800">Multi-Outlet Comparison</h1>
          <p className="text-sm text-gray-500 mt-0.5">Side-by-side performance across all branches</p></div>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-semibold text-sm transition-all">📥 Export</button>
          <button onClick={load} disabled={loading} className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-semibold text-sm transition-all disabled:opacity-60">🔄 Refresh</button>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-2xl border p-4 flex flex-wrap items-center gap-3 shadow-sm">
        <div className="flex bg-gray-100 rounded-xl p-1 gap-0.5">
          {[{l:'7D',v:'7d'},{l:'30D',v:'30d'},{l:'Month',v:'month'},{l:'Year',v:'year'}].map(p=>(
            <button key={p.v} onClick={()=>setPresetDate(p.v)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${preset===p.v?'bg-white text-blue-600 shadow-sm':'text-gray-500 hover:text-gray-700'}`}>{p.l}</button>
          ))}
        </div>
        <input type="date" value={dateFrom} onChange={e=>{setDateFrom(e.target.value);setPreset('');}} className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"/>
        <span className="text-gray-400">→</span>
        <input type="date" value={dateTo} onChange={e=>{setDateTo(e.target.value);setPreset('');}} className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"/>
      </div>

      {/* Total Summaries */}
      <div className="grid grid-cols-3 gap-4">
        {[
          {label:'Combined Revenue',value:`Ksh ${Math.round(totRev).toLocaleString()}`,icon:'💰',color:'bg-blue-50 border-l-blue-500',vc:'text-blue-700'},
          {label:'Total Orders',value:totOrders.toLocaleString(),icon:'🧾',color:'bg-emerald-50 border-l-emerald-500',vc:'text-emerald-700'},
          {label:'Combined Profit',value:`Ksh ${Math.round(totProfit).toLocaleString()}`,icon:'📈',color:'bg-violet-50 border-l-violet-500',vc:'text-violet-700'},
        ].map((c,i)=>(
          <div key={i} className={`bg-white rounded-2xl border-l-4 ${c.color} p-5 shadow-sm`}>
            <div className="flex items-center gap-2 mb-2"><span className="text-xl">{c.icon}</span><p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{c.label}</p></div>
            <p className={`text-3xl font-black ${c.vc}`}>{c.value}</p>
            <p className="text-xs text-gray-400 mt-1">all {data.length} outlets combined</p>
          </div>
        ))}
      </div>

      {/* Outlet Revenue Bars */}
      <div className="bg-white rounded-2xl border p-6 shadow-sm">
        <h3 className="text-sm font-bold text-gray-700 mb-4 uppercase tracking-wider">📊 Revenue Comparison</h3>
        <div className="space-y-4">
          {loading?<div className="flex justify-center py-8"><div className="w-10 h-10 border-4 border-blue-400 border-t-transparent rounded-full animate-spin"/></div>
          :data.map((o,i)=>{
            const pct=maxRev>0?(o.revenue/maxRev)*100:0;
            const rankEmoji=i===0?'🥇':i===1?'🥈':i===2?'🥉':`${i+1}.`;
            return (
              <div key={o.outlet_id}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2"><span className="text-lg">{rankEmoji}</span><span className="font-bold text-sm text-gray-800">{o.outlet_name}</span><span className="text-xs text-gray-400">({o.outlet_code})</span></div>
                  <div className="text-right"><span className="font-black text-sm text-gray-800">Ksh {Math.round(o.revenue).toLocaleString()}</span><span className="text-xs text-gray-400 ml-2">{o.orders} orders</span></div>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-3 rounded-full bg-gradient-to-r ${colors[i%colors.length]} transition-all duration-700`} style={{width:`${pct}%`}}/>
                </div>
                <div className="flex gap-4 mt-1.5 text-xs text-gray-400">
                  <span>💵 Cash: Ksh {Math.round(o.cash).toLocaleString()}</span>
                  <span>📱 M-Pesa: Ksh {Math.round(o.mpesa).toLocaleString()}</span>
                  <span>📋 Credit: Ksh {Math.round(o.credit).toLocaleString()}</span>
                  <span className={`ml-auto font-semibold ${o.net>=0?'text-emerald-600':'text-red-500'}`}>Net: Ksh {Math.round(o.net).toLocaleString()}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Detailed Table */}
      <div className="bg-white rounded-2xl border overflow-hidden shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
              {['Rank','Outlet','Revenue','Orders','Avg Order','Cash','M-Pesa','Credit','Profit','Expenses','Net P&L'].map(h=>(
                <th key={h} className={`py-3.5 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider ${['Revenue','Orders','Avg Order','Cash','M-Pesa','Credit','Profit','Expenses','Net P&L'].includes(h)?'text-right':'text-left'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading?(<tr><td colSpan={11} className="py-16 text-center"><div className="w-10 h-10 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto"/></td></tr>)
            :data.map((o,i)=>(
              <tr key={o.outlet_id} className={`hover:bg-blue-50/30 transition-colors ${i===0?'bg-amber-50/30':''}`}>
                <td className="py-3 px-4 text-lg">{i===0?'🥇':i===1?'🥈':i===2?'🥉':`#${i+1}`}</td>
                <td className="py-3 px-4"><p className="font-bold text-sm text-gray-800">{o.outlet_name}</p><p className="text-xs text-gray-400">{o.outlet_code}</p></td>
                <td className="py-3 px-4 text-right font-black text-sm text-blue-600">Ksh {Math.round(o.revenue).toLocaleString()}</td>
                <td className="py-3 px-4 text-right font-bold text-sm">{o.orders}</td>
                <td className="py-3 px-4 text-right text-sm text-gray-600">Ksh {o.avg_order.toLocaleString()}</td>
                <td className="py-3 px-4 text-right text-sm text-gray-600">Ksh {Math.round(o.cash).toLocaleString()}</td>
                <td className="py-3 px-4 text-right text-sm text-emerald-600">Ksh {Math.round(o.mpesa).toLocaleString()}</td>
                <td className="py-3 px-4 text-right text-sm text-amber-600">Ksh {Math.round(o.credit).toLocaleString()}</td>
                <td className="py-3 px-4 text-right font-bold text-sm text-emerald-600">Ksh {Math.round(o.profit).toLocaleString()}</td>
                <td className="py-3 px-4 text-right text-sm text-red-500">Ksh {Math.round(o.expenses).toLocaleString()}</td>
                <td className="py-3 px-4 text-right"><span className={`font-black text-sm ${o.net>=0?'text-emerald-600':'text-red-500'}`}>Ksh {Math.round(o.net).toLocaleString()}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
