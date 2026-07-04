'use client';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';
import toast from 'react-hot-toast';

interface DamageRecord { id:number; damage_date:string; product_id:number; product_name:string; category:string; quantity:number; cost_price:number; total_cost:number; reason:string; damage_type:'damage'|'expired'|'theft'|'wastage'|'other'; recorded_by:string; notes:string; }
const PAGE_SIZE=25;
const REASONS=['Dropped/Broken','Expired/Past Date','Water Damage','Theft/Pilferage','Faulty/Defective','Over-ripe/Spoiled','Pest Damage','Handling Damage','Other'];
const TYPES=[{v:'damage',l:'Physical Damage',icon:'💔',color:'text-red-600 bg-red-50'},{v:'expired',l:'Expired Goods',icon:'⏰',color:'text-orange-600 bg-orange-50'},{v:'theft',l:'Theft/Pilferage',icon:'🔒',color:'text-purple-600 bg-purple-50'},{v:'wastage',l:'Wastage',icon:'🗑️',color:'text-gray-600 bg-gray-50'},{v:'other',l:'Other',icon:'📦',color:'text-blue-600 bg-blue-50'}];

export default function DamageWastagePage() {
  const { activeOutlet } = useOutlet();
  const outletId = activeOutlet?.outlet_id||1;
  const [records, setRecords] = useState<DamageRecord[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({damage_date:new Date().toISOString().split('T')[0],product_id:'',quantity:1,reason:REASONS[0],damage_type:'damage',recorded_by:'',notes:''});
  const [dateFrom, setDateFrom] = useState(()=>{const d=new Date();d.setDate(d.getDate()-30);return d.toISOString().split('T')[0];});
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [filterType, setFilterType] = useState('All');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const load = useCallback(async()=>{
    setLoading(true);
    try {
      const [{ data },{ data: prods }] = await Promise.all([
        supabase.from('retail_damage_records').select('*').eq('outlet_id',outletId).gte('damage_date',dateFrom).lte('damage_date',dateTo).order('damage_date',{ascending:false}),
        supabase.from('retail_products').select('pid,product_name,category,cost_price').eq('outlet_id',outletId).eq('active',true).order('product_name'),
      ]);
      setRecords(data||[]);setProducts(prods||[]);setPage(1);
    } catch { toast.error('Failed to load'); }
    setLoading(false);
  },[outletId,dateFrom,dateTo]);

  useEffect(()=>{load();},[load]);

  const save=async()=>{
    if(!form.product_id){toast.error('Select a product');return;}
    if(!form.quantity||form.quantity<=0){toast.error('Enter valid quantity');return;}
    setSaving(true);
    try {
      const prod=products.find(p=>p.pid===Number(form.product_id));
      const totalCost=(prod?.cost_price||0)*form.quantity;
      await supabase.from('retail_damage_records').insert({outlet_id:outletId,damage_date:form.damage_date,product_id:Number(form.product_id),product_name:prod?.product_name,category:prod?.category,quantity:form.quantity,cost_price:prod?.cost_price||0,total_cost:totalCost,reason:form.reason,damage_type:form.damage_type,recorded_by:form.recorded_by,notes:form.notes,created_at:new Date().toISOString()});
      // Deduct from stock (best-effort — RPC may not exist on all deployments)
      try { await supabase.rpc('decrement_stock',{p_outlet_id:outletId,p_product_id:Number(form.product_id),p_qty:form.quantity}); } catch(_){}
      toast.success('Damage/wastage recorded!');
      setShowForm(false);setForm({damage_date:new Date().toISOString().split('T')[0],product_id:'',quantity:1,reason:REASONS[0],damage_type:'damage',recorded_by:'',notes:''});
      load();
    } catch { toast.error('Failed to save'); }
    setSaving(false);
  };

  const filtered=records.filter(r=>{
    const mt=filterType==='All'||r.damage_type===filterType;
    const ms=!search||(r.product_name||'').toLowerCase().includes(search.toLowerCase())||(r.reason||'').toLowerCase().includes(search.toLowerCase());
    return mt&&ms;
  });
  const totalPages=Math.ceil(filtered.length/PAGE_SIZE);
  const paged=filtered.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE);
  const totalLoss=filtered.reduce((s,r)=>s+r.total_cost,0);
  const typeTotals=TYPES.map(t=>({...t,count:filtered.filter(r=>r.damage_type===t.v).length,value:filtered.filter(r=>r.damage_type===t.v).reduce((s,r)=>s+r.total_cost,0)}));

  const exportCSV=()=>{
    const rows=[['Date','Product','Category','Type','Reason','Qty','Cost Price','Total Cost','Recorded By','Notes']];
    filtered.forEach(r=>rows.push([r.damage_date,r.product_name,r.category||'',r.damage_type,r.reason,String(r.quantity),String(r.cost_price),String(Math.round(r.total_cost)),r.recorded_by||'',r.notes||'']));
    const blob=new Blob([rows.map(r=>r.join(',')).join('\n')],{type:'text/csv'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`damage_wastage_${dateFrom}_${dateTo}.csv`;a.click();
    toast.success('Exported!');
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center text-3xl shadow-lg shadow-red-200">💔</div>
          <div><h1 className="text-2xl font-black text-gray-800">Damage & Wastage</h1>
          <p className="text-sm text-gray-500 mt-0.5">Record damaged, expired & stolen stock · Loss tracking · {activeOutlet?.outlet_name}</p></div>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-semibold text-sm transition-all">📥 Export</button>
          <button onClick={()=>setShowForm(true)} className="px-5 py-2.5 bg-gradient-to-r from-red-500 to-orange-600 text-white rounded-xl font-bold text-sm transition-all shadow-md">+ Record Loss</button>
        </div>
      </div>

      {/* Type Summary */}
      <div className="grid grid-cols-5 gap-3">
        {typeTotals.map(t=>(
          <button key={t.v} onClick={()=>setFilterType(filterType===t.v?'All':t.v)} className={`bg-white rounded-2xl border p-4 text-left shadow-sm hover:shadow-md transition-all ${filterType===t.v?'ring-2 ring-red-400 ring-offset-2':''}`}>
            <div className="text-xl mb-2">{t.icon}</div>
            <p className={`text-xs font-bold ${t.color.split(' ')[0]}`}>{t.l}</p>
            <p className="text-2xl font-black text-gray-800 mt-1">{t.count}</p>
            <p className="text-xs text-red-500 font-bold mt-0.5">Ksh {Math.round(t.value).toLocaleString()}</p>
          </button>
        ))}
      </div>

      {/* Total Loss Banner */}
      <div className="bg-red-50 border border-red-200 rounded-2xl p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-3xl">⚠️</span>
          <div>
            <p className="font-black text-red-800 text-lg">Total Loss This Period</p>
            <p className="text-red-600 text-sm">{filtered.length} damage/wastage records · {dateFrom} to {dateTo}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-4xl font-black text-red-600">Ksh {Math.round(totalLoss).toLocaleString()}</p>
          <p className="text-xs text-red-400">at cost price</p>
        </div>
      </div>

      {/* Form Modal */}
      {showForm&&(
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-gradient-to-r from-red-500 to-orange-600 p-6">
              <h2 className="text-xl font-black text-white">Record Damage / Wastage</h2>
              <p className="text-red-100 text-sm mt-0.5">This will deduct stock from inventory</p>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-600 uppercase mb-1.5 block">Date</label>
                  <input type="date" value={form.damage_date} onChange={e=>setForm({...form,damage_date:e.target.value})} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-400"/>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-600 uppercase mb-1.5 block">Type</label>
                  <select value={form.damage_type} onChange={e=>setForm({...form,damage_type:e.target.value})} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-400 bg-white">
                    {TYPES.map(t=><option key={t.v} value={t.v}>{t.icon} {t.l}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600 uppercase mb-1.5 block">Product *</label>
                <select value={form.product_id} onChange={e=>setForm({...form,product_id:e.target.value})} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-400 bg-white">
                  <option value="">Select product…</option>
                  {products.map(p=><option key={p.pid} value={p.pid}>{p.product_name} — Ksh {p.cost_price}/unit</option>)}
                </select>
                {form.product_id&&<p className="text-xs text-red-500 mt-1 font-semibold">
                  Estimated loss: Ksh {((products.find(p=>p.pid===Number(form.product_id))?.cost_price||0)*form.quantity).toLocaleString()}
                </p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-600 uppercase mb-1.5 block">Quantity *</label>
                  <input type="number" value={form.quantity} onChange={e=>setForm({...form,quantity:Number(e.target.value)})} min="1" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-400"/>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-600 uppercase mb-1.5 block">Reason</label>
                  <select value={form.reason} onChange={e=>setForm({...form,reason:e.target.value})} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-400 bg-white">
                    {REASONS.map(r=><option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600 uppercase mb-1.5 block">Recorded By</label>
                <input value={form.recorded_by} onChange={e=>setForm({...form,recorded_by:e.target.value})} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-400" placeholder="Staff name"/>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600 uppercase mb-1.5 block">Notes</label>
                <textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} rows={2} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none" placeholder="Additional details…"/>
              </div>
            </div>
            <div className="flex gap-3 p-6 pt-0">
              <button onClick={()=>setShowForm(false)} className="flex-1 py-3 border border-gray-200 rounded-xl font-semibold text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={save} disabled={saving} className="flex-1 py-3 bg-gradient-to-r from-red-500 to-orange-600 text-white rounded-xl font-bold text-sm disabled:opacity-60">{saving?'Saving…':'Record Loss'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-2xl border p-4 flex flex-wrap items-center gap-3 shadow-sm">
        <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-400"/>
        <span className="text-gray-400">→</span>
        <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-400"/>
        <div className="flex-1 relative min-w-[160px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
          <input value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} placeholder="Search product or reason…" className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-400"/>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border overflow-hidden shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="bg-gradient-to-r from-red-50 to-orange-50 border-b">
              {['#','Date','Product','Category','Type','Reason','Qty','Cost/Unit','Total Loss','Recorded By'].map(h=>(
                <th key={h} className={`py-3.5 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider ${['Qty','Cost/Unit','Total Loss'].includes(h)?'text-right':'text-left'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading?(<tr><td colSpan={10} className="py-20 text-center"><div className="w-10 h-10 border-4 border-red-400 border-t-transparent rounded-full animate-spin mx-auto"/></td></tr>)
            :paged.length===0?(<tr><td colSpan={10} className="py-20 text-center"><div className="text-5xl mb-3">✅</div><p className="font-bold text-gray-700">No damage/wastage records found!</p></td></tr>)
            :paged.map((r,i)=>{
              const tc=TYPES.find(t=>t.v===r.damage_type);
              return (
                <tr key={r.id} className="hover:bg-red-50/20 transition-colors">
                  <td className="py-3 px-4 text-xs text-gray-400">{(page-1)*PAGE_SIZE+i+1}</td>
                  <td className="py-3 px-4 text-sm text-gray-600">{r.damage_date}</td>
                  <td className="py-3 px-4 font-semibold text-sm text-gray-800">{r.product_name}</td>
                  <td className="py-3 px-4"><span className="px-2 py-0.5 bg-gray-100 rounded-md text-xs text-gray-500">{r.category||'—'}</span></td>
                  <td className="py-3 px-4"><span className={`px-2.5 py-1 rounded-full text-xs font-bold ${tc?.color||'bg-gray-100 text-gray-600'}`}>{tc?.icon} {tc?.l}</span></td>
                  <td className="py-3 px-4 text-sm text-gray-500">{r.reason}</td>
                  <td className="py-3 px-4 text-right font-bold text-sm text-gray-800">{r.quantity}</td>
                  <td className="py-3 px-4 text-right text-sm text-gray-500">Ksh {(r.cost_price||0).toLocaleString()}</td>
                  <td className="py-3 px-4 text-right font-black text-sm text-red-600">Ksh {Math.round(r.total_cost).toLocaleString()}</td>
                  <td className="py-3 px-4 text-sm text-gray-400">{r.recorded_by||'—'}</td>
                </tr>
              );
            })}
          </tbody>
          {filtered.length>0&&<tfoot><tr className="bg-gradient-to-r from-red-50 to-orange-50 border-t font-bold"><td colSpan={8} className="py-3 px-4 text-sm text-gray-600">TOTAL LOSS — {filtered.length} records</td><td className="py-3 px-4 text-right text-sm text-red-700">Ksh {Math.round(totalLoss).toLocaleString()}</td><td/></tr></tfoot>}
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
