'use client';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';

interface Insight { id:string; title:string; body:string; severity:'success'|'warning'|'danger'|'info'; icon:string; value?:string; action?:string; }

export default function SmartInsightsPage() {
  const { activeOutlet } = useOutlet();
  const outletId = activeOutlet?.outlet_id||1;
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  const run = useCallback(async()=>{
    if(!activeOutlet)return;
    setLoading(true);
    const found:Insight[]=[];
    const today=new Date().toISOString().split('T')[0];
    const d30=new Date();d30.setDate(d30.getDate()-30);const from30=d30.toISOString().split('T')[0];
    const d7=new Date();d7.setDate(d7.getDate()-7);const from7=d7.toISOString().split('T')[0];
    const d14=new Date();d14.setDate(d14.getDate()-14);const from14=d14.toISOString().split('T')[0];

    try {
      // 1. Revenue trend
      const [{ data: salesThisWeek },{ data: salesLastWeek }] = await Promise.all([
        supabase.from('retail_sales').select('total_amount').eq('outlet_id',outletId).gte('sale_date',from7).lte('sale_date',today).eq('status','Completed'),
        supabase.from('retail_sales').select('total_amount').eq('outlet_id',outletId).gte('sale_date',from14).lt('sale_date',from7).eq('status','Completed'),
      ]);
      const thisWeekRev=(salesThisWeek||[]).reduce((s:number,r:any)=>s+(r.total_amount||0),0);
      const lastWeekRev=(salesLastWeek||[]).reduce((s:number,r:any)=>s+(r.total_amount||0),0);
      const revChange=lastWeekRev>0?((thisWeekRev-lastWeekRev)/lastWeekRev)*100:0;
      if(revChange>=15){found.push({id:'rev_up',title:'Revenue Surge 🚀',body:`Revenue is up ${revChange.toFixed(1)}% this week vs last week. Ksh ${Math.round(thisWeekRev).toLocaleString()} vs Ksh ${Math.round(lastWeekRev).toLocaleString()}.`,severity:'success',icon:'📈',value:`+${revChange.toFixed(1)}%`});}
      else if(revChange<=-15){found.push({id:'rev_down',title:'Revenue Drop Alert',body:`Revenue is down ${Math.abs(revChange).toFixed(1)}% this week vs last week. Investigate if there's a pattern.`,severity:'danger',icon:'📉',value:`${revChange.toFixed(1)}%`,action:'Check Sales Report'});}
      else{found.push({id:'rev_stable',title:'Revenue Stable',body:`Revenue changed by ${revChange>=0?'+':''}${revChange.toFixed(1)}% this week. Ksh ${Math.round(thisWeekRev).toLocaleString()} this week.`,severity:'info',icon:'📊',value:`${revChange>=0?'+':''}${revChange.toFixed(1)}%`});}

      // 2. Low stock check
      const { data: stock } = await supabase.from('retail_stock').select('pid,qty,reorder_level').eq('outlet_id',outletId).lt('qty',5);
      const criticalStock=(stock||[]).filter((s:any)=>s.qty<=0);
      const lowStock=(stock||[]).filter((s:any)=>s.qty>0&&s.qty<5);
      if(criticalStock.length>0)found.push({id:'out_of_stock',title:'Out of Stock Items',body:`${criticalStock.length} products are completely out of stock. Immediate replenishment needed.`,severity:'danger',icon:'📦',value:`${criticalStock.length} items`,action:'View Reorder Suggestions'});
      if(lowStock.length>0)found.push({id:'low_stock',title:'Low Stock Warning',body:`${lowStock.length} products have less than 5 units remaining. Consider placing purchase orders soon.`,severity:'warning',icon:'⚠️',value:`${lowStock.length} products`,action:'Check Stock Levels'});

      // 3. Top selling product today
      const { data: todaySales } = await supabase.from('retail_sale_items').select('product_name,quantity').gte('created_at',today+'T00:00:00');
      if(todaySales&&todaySales.length>0){
        const prodMap:Record<string,number>={};
        todaySales.forEach((it:any)=>{prodMap[it.product_name]=(prodMap[it.product_name]||0)+(it.quantity||0);});
        const top=Object.entries(prodMap).sort(([,a],[,b])=>b-a)[0];
        if(top)found.push({id:'top_seller',title:'Today\'s Top Seller',body:`"${top[0]}" is your best seller today with ${top[1]} units sold.`,severity:'success',icon:'🏆',value:`${top[1]} units`});
      }

      // 4. High discount check
      const { data: highDisc } = await supabase.from('retail_sales').select('receipt_no,discount,total_amount,created_by').eq('outlet_id',outletId).gte('sale_date',from7).gt('discount',500).order('discount',{ascending:false}).limit(5);
      if(highDisc&&highDisc.length>0){
        const totalDisc=(highDisc||[]).reduce((s:number,r:any)=>s+(r.discount||0),0);
        found.push({id:'high_discounts',title:'High Discounts This Week',body:`${highDisc.length} transactions had discounts over Ksh 500. Total: Ksh ${Math.round(totalDisc).toLocaleString()}. Review cashier authorization.`,severity:'warning',icon:'🏷️',value:`Ksh ${Math.round(totalDisc).toLocaleString()}`,action:'View Discount Report'});
      }

      // 5. Profit margin check
      const { data: salesMonth } = await supabase.from('retail_sales').select('total_amount,profit').eq('outlet_id',outletId).gte('sale_date',from30).lte('sale_date',today).eq('status','Completed');
      const monthRev=(salesMonth||[]).reduce((s:number,r:any)=>s+(r.total_amount||0),0);
      const monthProfit=(salesMonth||[]).reduce((s:number,r:any)=>s+(r.profit||0),0);
      const marginPct=monthRev>0?(monthProfit/monthRev)*100:0;
      if(marginPct>0&&marginPct<15){found.push({id:'low_margin',title:'Low Profit Margin Warning',body:`Your gross margin is ${marginPct.toFixed(1)}% over the last 30 days, below the recommended 20%. Review pricing and cost of goods.`,severity:'danger',icon:'📊',value:`${marginPct.toFixed(1)}%`,action:'View Gross Margin Report'});}
      else if(marginPct>=25){found.push({id:'good_margin',title:'Healthy Profit Margin',body:`Excellent! Your gross margin is ${marginPct.toFixed(1)}% over the last 30 days — above industry benchmark.`,severity:'success',icon:'💰',value:`${marginPct.toFixed(1)}%`});}

      // 6. Slow moving stock
      const { data: slowProds } = await supabase.from('retail_products').select('pid,product_name').eq('outlet_id',outletId).eq('active',true).limit(200);
      const { data: recentSold } = await supabase.from('retail_sale_items').select('product_id').gte('created_at',from30+'T00:00:00');
      const soldIds=new Set((recentSold||[]).map((s:any)=>s.product_id));
      const noSales=(slowProds||[]).filter((p:any)=>!soldIds.has(p.pid));
      if(noSales.length>5)found.push({id:'slow_stock',title:'Dead Stock Alert',body:`${noSales.length} products haven't been sold in the last 30 days. Consider promotions or markdown to free up capital.`,severity:'warning',icon:'📭',value:`${noSales.length} products`,action:'View Fast/Slow Moving'});

      // 7. Top customer
      const { data: salesCust } = await supabase.from('retail_sales').select('customer_name,total_amount').eq('outlet_id',outletId).gte('sale_date',from30).lte('sale_date',today).neq('customer_name',null).eq('status','Completed');
      if(salesCust&&salesCust.length>0){
        const custMap:Record<string,number>={};
        salesCust.forEach((s:any)=>{if(s.customer_name&&s.customer_name!=='Walk-in')custMap[s.customer_name]=(custMap[s.customer_name]||0)+(s.total_amount||0);});
        const topCust=Object.entries(custMap).sort(([,a],[,b])=>b-a)[0];
        if(topCust)found.push({id:'top_customer',title:'Top Customer This Month',body:`"${topCust[0]}" is your highest spending customer with Ksh ${Math.round(topCust[1]).toLocaleString()} in the last 30 days. Consider a loyalty reward.`,severity:'info',icon:'👑',value:`Ksh ${Math.round(topCust[1]).toLocaleString()}`});
      }

      // 8. Expense vs revenue ratio
      const { data: expenses } = await supabase.from('retail_expenses').select('amount').eq('outlet_id',outletId).gte('expense_date',from30).lte('expense_date',today);
      const totalExp=(expenses||[]).reduce((s:number,e:any)=>s+(e.amount||0),0);
      const expRatio=monthRev>0?(totalExp/monthRev)*100:0;
      if(expRatio>50)found.push({id:'high_expenses',title:'High Expense Ratio',body:`Expenses are ${expRatio.toFixed(1)}% of revenue over the last 30 days. Ksh ${Math.round(totalExp).toLocaleString()} in expenses vs Ksh ${Math.round(monthRev).toLocaleString()} revenue. Review cost reduction.`,severity:'danger',icon:'💸',value:`${expRatio.toFixed(1)}%`,action:'View Expense Trend'});
      else if(expRatio>0&&expRatio<20)found.push({id:'good_expenses',title:'Efficient Cost Control',body:`Expenses are only ${expRatio.toFixed(1)}% of revenue — excellent cost management!`,severity:'success',icon:'✅',value:`${expRatio.toFixed(1)}%`});

    } catch {}
    setInsights(found);
    setLastUpdated(new Date().toLocaleTimeString('en-KE'));
    setLoading(false);
  },[outletId,activeOutlet]);

  useEffect(()=>{run();},[run]);

  const SEV_CFG={success:{bg:'bg-emerald-50',border:'border-emerald-200',badge:'bg-emerald-100 text-emerald-700',title:'text-emerald-800',body:'text-emerald-700'},warning:{bg:'bg-amber-50',border:'border-amber-200',badge:'bg-amber-100 text-amber-700',title:'text-amber-800',body:'text-amber-700'},danger:{bg:'bg-red-50',border:'border-red-200',badge:'bg-red-100 text-red-700',title:'text-red-800',body:'text-red-700'},info:{bg:'bg-blue-50',border:'border-blue-200',badge:'bg-blue-100 text-blue-700',title:'text-blue-800',body:'text-blue-600'}};

  const counts={success:insights.filter(i=>i.severity==='success').length,warning:insights.filter(i=>i.severity==='warning').length,danger:insights.filter(i=>i.severity==='danger').length,info:insights.filter(i=>i.severity==='info').length};

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 via-purple-600 to-indigo-700 flex items-center justify-center text-3xl shadow-lg shadow-violet-300 animate-pulse">🧠</div>
          <div>
            <h1 className="text-2xl font-black text-gray-800">Smart Business Insights</h1>
            <p className="text-sm text-gray-500 mt-0.5">AI-powered analysis · Automated alerts · {activeOutlet?.outlet_name}</p>
            {lastUpdated&&<p className="text-xs text-gray-400 mt-0.5">Last updated: {lastUpdated}</p>}
          </div>
        </div>
        <button onClick={run} disabled={loading} className="px-5 py-2.5 bg-gradient-to-r from-violet-500 to-indigo-700 text-white rounded-xl font-bold text-sm shadow-md flex items-center gap-2 disabled:opacity-60">
          {loading?<><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>Analysing…</>:<>🔄 Refresh Insights</>}
        </button>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-4 gap-3">
        {[
          {label:'Positive',count:counts.success,icon:'✅',bg:'bg-emerald-50',text:'text-emerald-700',border:'border-emerald-200'},
          {label:'Warnings',count:counts.warning,icon:'⚠️',bg:'bg-amber-50',text:'text-amber-700',border:'border-amber-200'},
          {label:'Alerts',count:counts.danger,icon:'🚨',bg:'bg-red-50',text:'text-red-600',border:'border-red-200'},
          {label:'Info',count:counts.info,icon:'ℹ️',bg:'bg-blue-50',text:'text-blue-700',border:'border-blue-200'},
        ].map((c,i)=>(
          <div key={i} className={`${c.bg} border ${c.border} rounded-2xl p-5`}>
            <div className="flex items-center gap-2 mb-2"><span className="text-xl">{c.icon}</span><p className={`text-xs font-bold uppercase ${c.text}`}>{c.label}</p></div>
            <p className={`text-4xl font-black ${c.text}`}>{c.count}</p>
          </div>
        ))}
      </div>

      {loading?(
        <div className="flex flex-col items-center py-20 gap-4">
          <div className="relative w-20 h-20">
            <div className="w-20 h-20 border-4 border-violet-200 rounded-full"/>
            <div className="w-20 h-20 border-4 border-t-violet-600 rounded-full animate-spin absolute top-0 left-0"/>
            <div className="absolute inset-0 flex items-center justify-center text-2xl">🧠</div>
          </div>
          <div className="text-center">
            <p className="font-black text-gray-800 text-lg">Analysing your business data…</p>
            <p className="text-gray-400 text-sm mt-1">Checking revenue, stock, margins, discounts and more</p>
          </div>
        </div>
      ):insights.length===0?(
        <div className="bg-white rounded-2xl border p-16 text-center shadow-sm">
          <div className="text-6xl mb-4">🎉</div>
          <p className="font-black text-gray-800 text-xl">All Clear!</p>
          <p className="text-gray-400 text-sm mt-2">No significant issues detected. Your business looks healthy.</p>
        </div>
      ):(
        <div className="space-y-4">
          {/* Danger first, then warning, info, success */}
          {(['danger','warning','info','success'] as const).flatMap(sev=>
            insights.filter(i=>i.severity===sev).map(insight=>{
              const cfg=SEV_CFG[insight.severity];
              return (
                <div key={insight.id} className={`${cfg.bg} border ${cfg.border} rounded-2xl p-6 flex items-start gap-5 hover:shadow-md transition-all`}>
                  <div className="text-4xl flex-shrink-0">{insight.icon}</div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className={`font-black text-lg ${cfg.title}`}>{insight.title}</p>
                        <p className={`text-sm mt-1 leading-relaxed ${cfg.body}`}>{insight.body}</p>
                        {insight.action&&<p className={`text-xs font-bold mt-2 ${cfg.title}`}>→ {insight.action}</p>}
                      </div>
                      {insight.value&&(
                        <div className="flex-shrink-0 text-right">
                          <span className={`text-2xl font-black px-4 py-2 rounded-xl ${cfg.badge}`}>{insight.value}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      <div className="bg-gradient-to-r from-violet-50 to-indigo-50 rounded-2xl border border-violet-200 p-5">
        <div className="flex items-start gap-3">
          <span className="text-2xl">🔮</span>
          <div>
            <p className="font-black text-violet-800">How Smart Insights Works</p>
            <p className="text-violet-600 text-sm mt-1">
              This module automatically analyses your sales, stock, expenses, discounts and profit margins in real time. 
              It surfaces the most critical issues first so you always know exactly where to focus your attention.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
