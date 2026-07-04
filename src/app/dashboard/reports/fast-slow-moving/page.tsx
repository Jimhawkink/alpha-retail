'use client';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';
import toast from 'react-hot-toast';

interface ProductVelocity {
  pid: number; product_name: string; category: string;
  total_qty: number; total_revenue: number; total_orders: number;
  avg_daily_qty: number; days_last_sold: number;
  velocity_class: 'A' | 'B' | 'C'; stock_qty: number; stock_value: number;
}

const PAGE_SIZE = 25;
const clsCfg = {
  A: { label:'Fast Mover', emoji:'🚀', bg:'bg-emerald-50', text:'text-emerald-700', border:'border-l-emerald-500', badge:'bg-emerald-500', ring:'ring-emerald-400' },
  B: { label:'Medium Mover', emoji:'📦', bg:'bg-amber-50', text:'text-amber-700', border:'border-l-amber-500', badge:'bg-amber-500', ring:'ring-amber-400' },
  C: { label:'Slow / Dead', emoji:'🐌', bg:'bg-red-50', text:'text-red-700', border:'border-l-red-500', badge:'bg-red-500', ring:'ring-red-400' },
};

export default function FastSlowMovingPage() {
  const { activeOutlet } = useOutlet();
  const outletId = activeOutlet?.outlet_id || 1;
  const [data, setData] = useState<ProductVelocity[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [filterCls, setFilterCls] = useState('All');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'revenue'|'qty'|'orders'|'days'>('revenue');
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    if (!activeOutlet) return;
    setLoading(true);
    try {
      const from = new Date(); from.setDate(from.getDate() - days);
      const fromStr = from.toISOString().split('T')[0];
      const today = new Date().toISOString().split('T')[0];
      const [{ data: prods }, { data: items }, { data: stocks }, { data: lastSold }] = await Promise.all([
        supabase.from('retail_products').select('pid,product_name,category,cost_price').eq('outlet_id', outletId).eq('active', true),
        supabase.from('retail_sales_items').select('product_id,product_name,quantity,subtotal,sale_id').gte('created_at', fromStr+'T00:00:00').lte('created_at', today+'T23:59:59'),
        supabase.from('retail_stock').select('pid,qty').eq('outlet_id', outletId),
        supabase.from('retail_sales_items').select('product_id,created_at').order('created_at',{ascending:false}).limit(2000),
      ]);
      const stockMap: Record<number,number> = {};
      (stocks||[]).forEach((s:any) => { stockMap[s.pid]=(stockMap[s.pid]||0)+(s.qty||0); });
      const lastMap: Record<number,string> = {};
      (lastSold||[]).forEach((s:any) => { if(!lastMap[s.product_id]) lastMap[s.product_id]=s.created_at; });
      const salesMap: Record<number,{qty:number;rev:number;orders:Set<number>}> = {};
      (items||[]).forEach((it:any) => {
        if(!salesMap[it.product_id]) salesMap[it.product_id]={qty:0,rev:0,orders:new Set()};
        salesMap[it.product_id].qty+=(it.quantity||0);
        salesMap[it.product_id].rev+=(it.subtotal||0);
        salesMap[it.product_id].orders.add(it.sale_id);
      });
      const result: ProductVelocity[] = (prods||[]).map((p:any) => {
        const s=salesMap[p.pid]; const totalQty=s?.qty||0; const totalRev=s?.rev||0; const totalOrd=s?.orders?.size||0;
        const avgDaily=totalQty/days;
        const ls=lastMap[p.pid]; const daysLast=ls?Math.floor((Date.now()-new Date(ls).getTime())/86400000):999;
        const sq=stockMap[p.pid]||0;
        let vc:'A'|'B'|'C'='C';
        if(avgDaily>=1||totalOrd>=10) vc='A';
        else if(avgDaily>=0.2||totalOrd>=3) vc='B';
        return {pid:p.pid,product_name:p.product_name,category:p.category||'Uncategorized',total_qty:totalQty,total_revenue:totalRev,total_orders:totalOrd,avg_daily_qty:avgDaily,days_last_sold:daysLast,velocity_class:vc,stock_qty:sq,stock_value:sq*(p.cost_price||0)};
      });
      result.sort((a,b)=>sortBy==='qty'?b.total_qty-a.total_qty:sortBy==='orders'?b.total_orders-a.total_orders:sortBy==='days'?a.days_last_sold-b.days_last_sold:b.total_revenue-a.total_revenue);
      setData(result); setPage(1);
    } catch { toast.error('Failed to load'); }
    setLoading(false);
  }, [outletId, days, sortBy, activeOutlet]);

  useEffect(() => { load(); }, [load]);

  const filtered = data.filter(p => {
    const mc = filterCls==='All'||p.velocity_class===filterCls;
    const ms = !search||p.product_name.toLowerCase().includes(search.toLowerCase())||p.category.toLowerCase().includes(search.toLowerCase());
    return mc&&ms;
  });
  const totalPages = Math.ceil(filtered.length/PAGE_SIZE);
  const paged = filtered.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE);
  const counts={A:data.filter(p=>p.velocity_class==='A').length,B:data.filter(p=>p.velocity_class==='B').length,C:data.filter(p=>p.velocity_class==='C').length};
  const revs={A:data.filter(p=>p.velocity_class==='A').reduce((s,p)=>s+p.total_revenue,0),B:data.filter(p=>p.velocity_class==='B').reduce((s,p)=>s+p.total_revenue,0),C:data.filter(p=>p.velocity_class==='C').reduce((s,p)=>s+p.total_revenue,0)};
  const deadStockValue=data.filter(p=>p.velocity_class==='C').reduce((s,p)=>s+p.stock_value,0);

  const exportCSV = () => {
    const rows=[['Product','Category','Class','Qty Sold','Revenue','Orders','Avg/Day','Days Last Sold','Stock Qty','Stock Value']];
    filtered.forEach(p=>rows.push([p.product_name,p.category,p.velocity_class,String(p.total_qty),String(p.total_revenue),String(p.total_orders),p.avg_daily_qty.toFixed(2),p.days_last_sold>=999?'Never':String(p.days_last_sold),String(p.stock_qty),String(Math.round(p.stock_value))]));
    const blob=new Blob([rows.map(r=>r.join(',')).join('\n')],{type:'text/csv'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`velocity_report_${days}d.csv`; a.click();
    toast.success('Exported!');
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center text-3xl shadow-lg shadow-purple-200">🚀</div>
          <div>
            <h1 className="text-2xl font-black text-gray-800">Inventory Velocity Analysis</h1>
            <p className="text-sm text-gray-500 mt-0.5">Fast · Medium · Slow Movers · ABC Classification · {activeOutlet?.outlet_name}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-semibold text-sm flex items-center gap-2 transition-all shadow-sm">📥 Export CSV</button>
          <button onClick={load} disabled={loading} className="px-4 py-2 bg-violet-500 hover:bg-violet-600 text-white rounded-xl font-semibold text-sm flex items-center gap-2 transition-all shadow-sm disabled:opacity-60">🔄 Refresh</button>
        </div>
      </div>

      {/* Dead Stock Alert */}
      {deadStockValue > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-3">
          <span className="text-2xl">⚠️</span>
          <div>
            <p className="font-bold text-red-800 text-sm">Dead Stock Alert — Capital Tied Up</p>
            <p className="text-red-600 text-sm mt-0.5"><strong>{counts.C} slow-moving products</strong> have Ksh {Math.round(deadStockValue).toLocaleString()} worth of stock that hasn&apos;t sold well in the last {days} days. Consider promotions or returning to suppliers.</p>
          </div>
        </div>
      )}

      {/* ABC Cards */}
      <div className="grid grid-cols-3 gap-4">
        {(['A','B','C'] as const).map(cls => {
          const cfg=clsCfg[cls];
          const active=filterCls===cls;
          return (
            <button key={cls} onClick={()=>setFilterCls(active?'All':cls)} className={`text-left bg-white rounded-2xl border-l-4 ${cfg.border} p-5 shadow-sm hover:shadow-md transition-all ${active?`ring-2 ring-offset-2 ${cfg.ring}`:''}`}>
              <div className="flex items-start justify-between">
                <div>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${cfg.bg} ${cfg.text} mb-3`}>{cfg.emoji} {cfg.label}</span>
                  <p className="text-4xl font-black text-gray-800">{counts[cls]}</p>
                  <p className="text-xs text-gray-400 font-semibold mt-1">products</p>
                  <p className="text-sm font-bold text-gray-600 mt-2">Ksh {revs[cls].toLocaleString()}</p>
                  <p className="text-xs text-gray-400">total revenue</p>
                </div>
                <div className={`w-11 h-11 ${cfg.badge} rounded-xl flex items-center justify-center text-white font-black text-lg shadow-md`}>{cls}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Controls */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 flex flex-wrap items-center gap-3 shadow-sm">
        <div className="flex bg-gray-100 rounded-xl p-1 gap-0.5">
          {[{l:'7 Days',v:7},{l:'30 Days',v:30},{l:'60 Days',v:60},{l:'90 Days',v:90}].map(d=>(
            <button key={d.v} onClick={()=>{setDays(d.v);setPage(1);}} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${days===d.v?'bg-white text-violet-600 shadow-sm':'text-gray-500 hover:text-gray-700'}`}>{d.l}</button>
          ))}
        </div>
        <select value={filterCls} onChange={e=>{setFilterCls(e.target.value);setPage(1);}} className="px-3 py-2 border border-gray-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white">
          <option value="All">All Classes</option>
          <option value="A">🚀 Fast Movers (A)</option>
          <option value="B">📦 Medium Movers (B)</option>
          <option value="C">🐌 Slow / Dead (C)</option>
        </select>
        <select value={sortBy} onChange={e=>setSortBy(e.target.value as any)} className="px-3 py-2 border border-gray-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white">
          <option value="revenue">↓ Revenue</option>
          <option value="qty">↓ Qty Sold</option>
          <option value="orders">↓ # Orders</option>
          <option value="days">↑ Days Since Sale</option>
        </select>
        <div className="flex-1 relative min-w-[180px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
          <input value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} placeholder="Search product or category…" className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
        </div>
        <span className="text-xs text-gray-500 font-medium bg-gray-100 px-3 py-1.5 rounded-lg">{filtered.length} products</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="bg-gradient-to-r from-violet-50 via-purple-50 to-indigo-50 border-b border-gray-200">
              <th className="text-left py-3.5 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">#</th>
              <th className="text-left py-3.5 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Product</th>
              <th className="text-left py-3.5 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Category</th>
              <th className="text-center py-3.5 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Class</th>
              <th className="text-right py-3.5 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Qty Sold</th>
              <th className="text-right py-3.5 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Revenue</th>
              <th className="text-center py-3.5 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Orders</th>
              <th className="text-center py-3.5 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Avg/Day</th>
              <th className="text-center py-3.5 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Last Sold</th>
              <th className="text-right py-3.5 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">In Stock</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={10} className="py-24 text-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin"/>
                  <p className="text-gray-400 text-sm font-medium">Analysing inventory velocity…</p>
                </div>
              </td></tr>
            ) : paged.length === 0 ? (
              <tr><td colSpan={10} className="py-24 text-center text-gray-400">No products found matching filters</td></tr>
            ) : paged.map((p, i) => {
              const cfg=clsCfg[p.velocity_class];
              const rowNum=(page-1)*PAGE_SIZE+i+1;
              return (
                <tr key={p.pid} className="hover:bg-gray-50/60 transition-colors">
                  <td className="py-3 px-4 text-xs text-gray-400 font-medium">{rowNum}</td>
                  <td className="py-3 px-4">
                    <span className="font-semibold text-sm text-gray-800">{p.product_name}</span>
                  </td>
                  <td className="py-3 px-4 text-xs text-gray-500 bg-gray-50/60">
                    <span className="px-2 py-0.5 bg-gray-100 rounded-md">{p.category}</span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${cfg.bg} ${cfg.text}`}>{cfg.emoji} {p.velocity_class}</span>
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-sm text-gray-800">{p.total_qty.toLocaleString()}</td>
                  <td className="py-3 px-4 text-right font-bold text-sm text-violet-600">Ksh {p.total_revenue.toLocaleString()}</td>
                  <td className="py-3 px-4 text-center text-sm text-gray-600">{p.total_orders}</td>
                  <td className="py-3 px-4 text-center">
                    <span className={`text-xs font-bold ${p.avg_daily_qty>=1?'text-emerald-600':p.avg_daily_qty>=0.2?'text-amber-600':'text-red-500'}`}>{p.avg_daily_qty.toFixed(2)}</span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${p.days_last_sold<=7?'bg-emerald-100 text-emerald-700':p.days_last_sold<=30?'bg-amber-100 text-amber-700':'bg-red-100 text-red-700'}`}>
                      {p.days_last_sold>=999?'Never':`${p.days_last_sold}d ago`}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className={`font-bold text-sm ${p.stock_qty===0?'text-red-500':p.stock_qty<=5?'text-amber-600':'text-gray-800'}`}>{p.stock_qty}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
          {filtered.length > 0 && (
            <tfoot>
              <tr className="bg-gradient-to-r from-violet-50 to-purple-50 border-t border-gray-200 font-bold">
                <td colSpan={4} className="py-3 px-4 text-sm text-gray-600">TOTALS — {filtered.length} products</td>
                <td className="py-3 px-4 text-right text-sm">{filtered.reduce((s,p)=>s+p.total_qty,0).toLocaleString()}</td>
                <td className="py-3 px-4 text-right text-sm text-violet-600">Ksh {filtered.reduce((s,p)=>s+p.total_revenue,0).toLocaleString()}</td>
                <td className="py-3 px-4 text-center text-sm">{filtered.reduce((s,p)=>s+p.total_orders,0)}</td>
                <td colSpan={3}/>
              </tr>
            </tfoot>
          )}
        </table>
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3.5 border-t border-gray-100 bg-gray-50/50">
            <p className="text-sm text-gray-500">Showing <strong>{(page-1)*PAGE_SIZE+1}–{Math.min(page*PAGE_SIZE,filtered.length)}</strong> of <strong>{filtered.length}</strong> products</p>
            <div className="flex items-center gap-1">
              <button onClick={()=>setPage(1)} disabled={page===1} className="px-2.5 py-1.5 rounded-lg text-xs font-bold disabled:opacity-30 hover:bg-gray-200 transition-colors">«</button>
              <button onClick={()=>setPage(p=>p-1)} disabled={page===1} className="px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-30 hover:bg-gray-200 transition-colors">‹</button>
              {Array.from({length:Math.min(7,totalPages)},(_,i)=>{
                let pg=i+1; if(totalPages>7&&page>4) pg=page-3+i; if(pg<1||pg>totalPages) return null;
                return <button key={pg} onClick={()=>setPage(pg)} className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${pg===page?'bg-violet-500 text-white shadow-md':'hover:bg-gray-200 text-gray-600'}`}>{pg}</button>;
              })}
              <button onClick={()=>setPage(p=>p+1)} disabled={page===totalPages} className="px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-30 hover:bg-gray-200 transition-colors">›</button>
              <button onClick={()=>setPage(totalPages)} disabled={page===totalPages} className="px-2.5 py-1.5 rounded-lg text-xs font-bold disabled:opacity-30 hover:bg-gray-200 transition-colors">»</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
