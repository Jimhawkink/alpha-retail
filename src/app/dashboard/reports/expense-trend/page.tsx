'use client';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';
import toast from 'react-hot-toast';

interface MonthData { month:string; revenue:number; expenses:number; profit:number; orders:number; net:number; }

export default function ExpenseTrendPage() {
  const { activeOutlet } = useOutlet();
  const outletId = activeOutlet?.outlet_id||1;
  const [data, setData] = useState<MonthData[]>([]);
  const [loading, setLoading] = useState(true);
  const [months, setMonths] = useState(12);

  const load = useCallback(async()=>{
    if(!activeOutlet)return;
    setLoading(true);
    try {
      const from=new Date();from.setMonth(from.getMonth()-(months-1));
      const fromStr=`${from.getFullYear()}-${String(from.getMonth()+1).padStart(2,'0')}-01`;
      const today=new Date().toISOString().split('T')[0];
      const [{ data: sales },{ data: expenses }] = await Promise.all([
        supabase.from('retail_sales').select('sale_date,total_amount,profit,status').eq('outlet_id',outletId).gte('sale_date',fromStr).lte('sale_date',today).eq('status','Completed'),
        supabase.from('retail_expenses').select('expense_date,amount').eq('outlet_id',outletId).gte('expense_date',fromStr).lte('expense_date',today),
      ]);
      // Build month map
      const monthMap:Record<string,{revenue:number;profit:number;expenses:number;orders:number}>={};
      // Populate all months in range
      for(let i=0;i<months;i++){const d=new Date();d.setMonth(d.getMonth()-i);const k=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;monthMap[k]={revenue:0,profit:0,expenses:0,orders:0};}
      (sales||[]).forEach((s:any)=>{const k=s.sale_date?.slice(0,7);if(k&&monthMap[k]){monthMap[k].revenue+=(s.total_amount||0);monthMap[k].profit+=(s.profit||0);monthMap[k].orders++;}});
      (expenses||[]).forEach((e:any)=>{const k=e.expense_date?.slice(0,7);if(k&&monthMap[k])monthMap[k].expenses+=(e.amount||0);});
      const result:MonthData[]=Object.entries(monthMap).map(([month,v])=>({month,revenue:v.revenue,expenses:v.expenses,profit:v.profit,orders:v.orders,net:v.profit-v.expenses})).sort((a,b)=>a.month.localeCompare(b.month));
      setData(result);
    } catch { toast.error('Failed to load'); }
    setLoading(false);
  },[outletId,months,activeOutlet]);

  useEffect(()=>{load();},[load]);

  const maxRevenue=Math.max(...data.map(d=>d.revenue),1);
  const maxExpenses=Math.max(...data.map(d=>d.expenses),1);
  const maxBar=Math.max(maxRevenue,maxExpenses,1);
  const totRevenue=data.reduce((s,d)=>s+d.revenue,0);
  const totExpenses=data.reduce((s,d)=>s+d.expenses,0);
  const totProfit=data.reduce((s,d)=>s+d.profit,0);
  const totNet=data.reduce((s,d)=>s+d.net,0);
  const avgMonthlyRev=data.length>0?totRevenue/data.length:0;

  // Trend detection
  const recentMonths=data.slice(-3);
  const olderMonths=data.slice(-6,-3);
  const recentAvg=recentMonths.length>0?recentMonths.reduce((s,d)=>s+d.revenue,0)/recentMonths.length:0;
  const olderAvg=olderMonths.length>0?olderMonths.reduce((s,d)=>s+d.revenue,0)/olderMonths.length:0;
  const trendPct=olderAvg>0?((recentAvg-olderAvg)/olderAvg)*100:0;

  const exportCSV=()=>{
    const rows=[['Month','Revenue','Expenses','Gross Profit','Net (Profit-Expenses)','Orders']];
    data.forEach(d=>rows.push([d.month,String(Math.round(d.revenue)),String(Math.round(d.expenses)),String(Math.round(d.profit)),String(Math.round(d.net)),String(d.orders)]));
    const blob=new Blob([rows.map(r=>r.join(',')).join('\n')],{type:'text/csv'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`expense_revenue_trend_${months}m.csv`;a.click();
    toast.success('Exported!');
  };

  const fmtMonth=(m:string)=>{const [y,mo]=m.split('-');const names=['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];return `${names[parseInt(mo)]} ${y}`;};

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-700 flex items-center justify-center text-3xl shadow-lg shadow-blue-200">📉</div>
          <div><h1 className="text-2xl font-black text-gray-800">Revenue vs Expenses Trend</h1>
          <p className="text-sm text-gray-500 mt-0.5">Monthly comparison · Net profitability · {activeOutlet?.outlet_name}</p></div>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-semibold text-sm transition-all">📥 Export</button>
          <button onClick={load} disabled={loading} className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-semibold text-sm transition-all disabled:opacity-60">🔄 Refresh</button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {label:'Total Revenue',value:`Ksh ${Math.round(totRevenue).toLocaleString()}`,icon:'💰',color:'border-l-blue-500',bg:'bg-blue-50',vc:'text-blue-700'},
          {label:'Total Expenses',value:`Ksh ${Math.round(totExpenses).toLocaleString()}`,icon:'💸',color:'border-l-red-400',bg:'bg-red-50',vc:'text-red-600'},
          {label:'Gross Profit',value:`Ksh ${Math.round(totProfit).toLocaleString()}`,icon:'📈',color:'border-l-emerald-500',bg:'bg-emerald-50',vc:'text-emerald-700'},
          {label:'Net Profit',value:`Ksh ${Math.round(totNet).toLocaleString()}`,icon:'🏆',color:totNet>=0?'border-l-violet-500':'border-l-red-500',bg:totNet>=0?'bg-violet-50':'bg-red-50',vc:totNet>=0?'text-violet-700':'text-red-600'},
        ].map((c,i)=>(
          <div key={i} className={`bg-white rounded-2xl border-l-4 ${c.color} ${c.bg} p-5 shadow-sm`}>
            <div className="flex items-center gap-2 mb-2"><span className="text-xl">{c.icon}</span><p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{c.label}</p></div>
            <p className={`text-2xl font-black ${c.vc}`}>{c.value}</p>
            <p className="text-xs text-gray-400 mt-1">{months}-month period</p>
          </div>
        ))}
      </div>

      {/* Trend badge */}
      {data.length>=6&&(
        <div className={`rounded-2xl p-4 flex items-center gap-3 ${trendPct>=0?'bg-emerald-50 border border-emerald-200':'bg-red-50 border border-red-200'}`}>
          <span className="text-2xl">{trendPct>=10?'🚀':trendPct>=0?'📈':trendPct>=-10?'📉':'⚠️'}</span>
          <div>
            <p className={`font-bold text-sm ${trendPct>=0?'text-emerald-800':'text-red-800'}`}>Revenue Trend: {trendPct>=0?'+':''}{trendPct.toFixed(1)}% vs previous quarter</p>
            <p className={`text-sm mt-0.5 ${trendPct>=0?'text-emerald-600':'text-red-600'}`}>
              Recent 3-month avg: Ksh {Math.round(recentAvg).toLocaleString()} · Previous 3-month avg: Ksh {Math.round(olderAvg).toLocaleString()}
            </p>
          </div>
        </div>
      )}

      {/* Period Selector */}
      <div className="bg-white rounded-2xl border p-4 flex items-center gap-3 shadow-sm">
        <span className="text-sm font-semibold text-gray-600">Show last:</span>
        <div className="flex bg-gray-100 rounded-xl p-1 gap-0.5">
          {[{l:'6 Months',v:6},{l:'12 Months',v:12},{l:'24 Months',v:24}].map(m=>(
            <button key={m.v} onClick={()=>setMonths(m.v)} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${months===m.v?'bg-white text-blue-600 shadow-sm':'text-gray-500 hover:text-gray-700'}`}>{m.l}</button>
          ))}
        </div>
        <span className="text-xs text-gray-400 ml-2">Avg monthly revenue: Ksh {Math.round(avgMonthlyRev).toLocaleString()}</span>
      </div>

      {/* Bar Chart */}
      <div className="bg-white rounded-2xl border p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">📊 Monthly Revenue vs Expenses</h3>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-blue-500 inline-block"/><span className="text-gray-500">Revenue</span></span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-400 inline-block"/><span className="text-gray-500">Expenses</span></span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block"/><span className="text-gray-500">Net Profit</span></span>
          </div>
        </div>
        {loading?<div className="h-48 flex items-center justify-center"><div className="w-10 h-10 border-4 border-blue-400 border-t-transparent rounded-full animate-spin"/></div>
        :<div className="overflow-x-auto">
          <div className="flex items-end gap-2 min-w-max pb-2" style={{height:'200px'}}>
            {data.map((d,i)=>{
              const revH=maxBar>0?(d.revenue/maxBar)*180:0;
              const expH=maxBar>0?(d.expenses/maxBar)*180:0;
              const netPos=d.net>=0;
              const isCurrentMonth=d.month===new Date().toISOString().slice(0,7);
              return (
                <div key={d.month} className="flex flex-col items-center gap-1 group cursor-default" style={{minWidth:'52px'}}>
                  <div className="relative flex items-end gap-0.5" style={{height:'180px'}}>
                    <div className={`w-5 rounded-t-md transition-all ${isCurrentMonth?'bg-blue-600':'bg-blue-400'} hover:opacity-80`} style={{height:`${revH}px`}} title={`Revenue: Ksh ${Math.round(d.revenue).toLocaleString()}`}/>
                    <div className="w-5 rounded-t-md bg-red-400 hover:opacity-80 transition-all" style={{height:`${expH}px`}} title={`Expenses: Ksh ${Math.round(d.expenses).toLocaleString()}`}/>
                  </div>
                  <div className={`w-2 h-2 rounded-full ${netPos?'bg-emerald-500':'bg-red-500'}`} title={`Net: Ksh ${Math.round(d.net).toLocaleString()}`}/>
                  <span className="text-[9px] text-gray-400 font-medium whitespace-nowrap">{fmtMonth(d.month)}</span>
                </div>
              );
            })}
          </div>
        </div>}
      </div>

      {/* Monthly Table */}
      <div className="bg-white rounded-2xl border overflow-hidden shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
              {['Month','Revenue','Expenses','Gross Profit','Net (P-E)','Orders','Rev/Order'].map(h=>(
                <th key={h} className={`py-3.5 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider ${h==='Month'?'text-left':'text-right'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading?(<tr><td colSpan={7} className="py-20 text-center"><div className="w-10 h-10 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto"/></td></tr>)
            :[...data].reverse().map((d)=>{
              const isCurrentMonth=d.month===new Date().toISOString().slice(0,7);
              return (
                <tr key={d.month} className={`hover:bg-blue-50/30 transition-colors ${isCurrentMonth?'bg-blue-50/40':''}`}>
                  <td className="py-3 px-4 font-bold text-sm text-gray-800">{fmtMonth(d.month)}{isCurrentMonth&&<span className="ml-2 text-xs text-blue-500 font-semibold">(Current)</span>}</td>
                  <td className="py-3 px-4 text-right font-bold text-sm text-blue-600">Ksh {Math.round(d.revenue).toLocaleString()}</td>
                  <td className="py-3 px-4 text-right text-sm text-red-500">Ksh {Math.round(d.expenses).toLocaleString()}</td>
                  <td className="py-3 px-4 text-right font-bold text-sm text-emerald-600">Ksh {Math.round(d.profit).toLocaleString()}</td>
                  <td className="py-3 px-4 text-right"><span className={`font-black text-sm ${d.net>=0?'text-violet-600':'text-red-500'}`}>Ksh {Math.round(d.net).toLocaleString()}</span></td>
                  <td className="py-3 px-4 text-right text-sm text-gray-600">{d.orders}</td>
                  <td className="py-3 px-4 text-right text-sm text-gray-500">Ksh {d.orders>0?Math.round(d.revenue/d.orders).toLocaleString():'—'}</td>
                </tr>
              );
            })}
          </tbody>
          {data.length>0&&<tfoot><tr className="bg-gradient-to-r from-blue-50 to-indigo-50 border-t font-bold"><td className="py-3 px-4 text-sm text-gray-600">TOTALS ({months} months)</td><td className="py-3 px-4 text-right text-sm text-blue-700">Ksh {Math.round(totRevenue).toLocaleString()}</td><td className="py-3 px-4 text-right text-sm text-red-500">Ksh {Math.round(totExpenses).toLocaleString()}</td><td className="py-3 px-4 text-right text-sm text-emerald-700">Ksh {Math.round(totProfit).toLocaleString()}</td><td className="py-3 px-4 text-right text-sm"><span className={totNet>=0?'text-violet-700 font-black':'text-red-600 font-black'}>Ksh {Math.round(totNet).toLocaleString()}</span></td><td className="py-3 px-4 text-right text-sm">{data.reduce((s,d)=>s+d.orders,0)}</td><td/></tr></tfoot>}
        </table>
      </div>
    </div>
  );
}
