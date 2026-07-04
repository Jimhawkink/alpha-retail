'use client';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';
import toast from 'react-hot-toast';

interface Quotation { id:number; quote_number:string; customer_name:string; customer_phone:string; quote_date:string; valid_until:string; status:'draft'|'sent'|'accepted'|'rejected'|'expired'; total_amount:number; notes:string; }
interface QuoteItem { product_id:number; product_name:string; quantity:number; unit_price:number; discount:number; subtotal:number; }
const STATUS_CFG={draft:{l:'Draft',bg:'bg-gray-100',t:'text-gray-600'},sent:{l:'Sent',bg:'bg-blue-100',t:'text-blue-700'},accepted:{l:'Accepted ✅',bg:'bg-emerald-100',t:'text-emerald-700'},rejected:{l:'Rejected',bg:'bg-red-100',t:'text-red-600'},expired:{l:'Expired',bg:'bg-amber-100',t:'text-amber-700'}};

export default function QuotationsPage() {
  const { activeOutlet } = useOutlet();
  const outletId = activeOutlet?.outlet_id||1;
  const [quotes, setQuotes] = useState<Quotation[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list'|'new'>('list');
  const [saving, setSaving] = useState(false);
  const [filterStatus, setFilterStatus] = useState('All');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({customer_name:'',customer_phone:'',valid_until:'',notes:''});
  const [items, setItems] = useState<QuoteItem[]>([]);

  const load = useCallback(async()=>{
    setLoading(true);
    const [{ data: qs },{ data: prods }] = await Promise.all([
      supabase.from('retail_quotations').select('*').eq('outlet_id',outletId).order('created_at',{ascending:false}),
      supabase.from('retail_products').select('pid,product_name,selling_price').eq('outlet_id',outletId).eq('active',true).order('product_name'),
    ]);
    setQuotes(qs||[]);setProducts(prods||[]);setLoading(false);
  },[outletId]);

  useEffect(()=>{load();},[load]);

  const addItem=()=>setItems([...items,{product_id:0,product_name:'',quantity:1,unit_price:0,discount:0,subtotal:0}]);
  const removeItem=(i:number)=>setItems(items.filter((_,idx)=>idx!==i));
  const updateItem=(i:number,field:string,val:any)=>{
    const arr=[...items];arr[i]={...arr[i],[field]:val};
    if(field==='product_id'){const p=products.find(pr=>pr.pid===Number(val));if(p){arr[i].product_name=p.product_name;arr[i].unit_price=p.selling_price||0;}}
    arr[i].subtotal=(arr[i].unit_price*arr[i].quantity)*(1-arr[i].discount/100);
    setItems(arr);
  };

  const saveQuote=async()=>{
    if(!form.customer_name.trim()){toast.error('Enter customer name');return;}
    if(items.length===0){toast.error('Add at least one item');return;}
    setSaving(true);
    try {
      const total=items.reduce((s,it)=>s+it.subtotal,0);
      const qNum=`QT-${Date.now().toString().slice(-6)}`;
      await supabase.from('retail_quotations').insert({outlet_id:outletId,quote_number:qNum,customer_name:form.customer_name,customer_phone:form.customer_phone,quote_date:new Date().toISOString().split('T')[0],valid_until:form.valid_until,status:'draft',total_amount:total,notes:form.notes,items:JSON.stringify(items),created_at:new Date().toISOString()});
      toast.success(`Quotation ${qNum} created!`);
      setView('list');setForm({customer_name:'',customer_phone:'',valid_until:'',notes:''});setItems([]);load();
    } catch { toast.error('Failed to create'); }
    setSaving(false);
  };

  const updateStatus=async(q:Quotation,status:string)=>{
    await supabase.from('retail_quotations').update({status}).eq('id',q.id);
    toast.success('Status updated');load();
  };

  const printQuote=async(q:Quotation)=>{
    let qItems:QuoteItem[]=[];
    try{qItems=JSON.parse((q as any).items||'[]');}catch{}
    const html=`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Quotation ${q.quote_number}</title>
<style>@page{margin:15mm;}body{font-family:Arial,sans-serif;font-size:11px;}
.hdr{display:flex;justify-content:space-between;border-bottom:2px solid #333;padding-bottom:10px;margin-bottom:12px;}
h2{font-size:20px;margin:0;}h3{font-size:13px;margin:0;}
table{width:100%;border-collapse:collapse;margin-top:12px;}th,td{border:1px solid #ddd;padding:5px 8px;font-size:10px;}
th{background:#f3f4f6;font-weight:700;}.r{text-align:right;}.total{background:#e5e7eb;font-weight:700;}
.badge{background:#d1fae5;color:#065f46;padding:2px 8px;border-radius:10px;font-size:9px;font-weight:700;}
.validity{color:#d97706;font-size:10px;margin-top:3px;}</style></head><body>
<div class="hdr"><div><h2>QUOTATION</h2><h3>${activeOutlet?.outlet_name||'Alpha Retail'}</h3></div>
<div style="text-align:right"><div style="font-size:18px;font-weight:900;color:#1e40af">${q.quote_number}</div>
<div style="font-size:10px;color:#555;">Date: ${q.quote_date}</div>
<div class="validity">Valid until: ${q.valid_until||'—'}</div>
<span class="badge">${STATUS_CFG[q.status]?.l||q.status}</span></div></div>
<div style="font-size:10px;color:#555;margin-bottom:10px;"><strong>Prepared for:</strong> ${q.customer_name}${q.customer_phone?' | '+q.customer_phone:''}</div>
<table><tr><th>#</th><th>Description</th><th class="r">Qty</th><th class="r">Unit Price</th><th class="r">Discount</th><th class="r">Subtotal</th></tr>
${qItems.map((it,i)=>`<tr><td>${i+1}</td><td>${it.product_name}</td><td class="r">${it.quantity}</td><td class="r">Ksh ${(it.unit_price||0).toLocaleString()}</td><td class="r">${it.discount||0}%</td><td class="r">Ksh ${Math.round(it.subtotal).toLocaleString()}</td></tr>`).join('')}
<tr class="total"><td colspan="5" class="r"><strong>TOTAL</strong></td><td class="r"><strong>Ksh ${Math.round(q.total_amount).toLocaleString()}</strong></td></tr></table>
${q.notes?`<p style="margin-top:12px;font-size:10px;"><strong>Notes:</strong> ${q.notes}</p>`:''}
<p style="margin-top:16px;font-size:9px;color:#777;">This is a quotation and not a tax invoice. Prices are valid until ${q.valid_until||'further notice'}.</p>
<div style="margin-top:24px;display:flex;justify-content:space-between;"><div style="text-align:center;width:200px;border-top:1px solid #333;padding-top:4px;font-size:9px;">Authorized By</div><div style="text-align:center;width:200px;border-top:1px solid #333;padding-top:4px;font-size:9px;">Customer Acceptance</div></div>
</body></html>`;
    const w=window.open('','_blank');if(w){w.document.write(html);w.document.close();w.print();}
  };

  const filtered=quotes.filter(q=>{
    const ms=filterStatus==='All'||q.status===filterStatus;
    const mq=!search||(q.quote_number||'').toLowerCase().includes(search.toLowerCase())||(q.customer_name||'').toLowerCase().includes(search.toLowerCase());
    return ms&&mq;
  });

  const grandTotal=items.reduce((s,it)=>s+it.subtotal,0);

  if(view==='new') return (
    <div className="space-y-6 pb-8">
      <div className="flex items-center gap-4">
        <button onClick={()=>{setView('list');setItems([]);}} className="p-2 hover:bg-gray-100 rounded-xl text-gray-600">← Back</button>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center text-2xl">📄</div>
          <h1 className="text-xl font-black text-gray-800">New Quotation</h1>
        </div>
      </div>
      <div className="bg-white rounded-2xl border p-6 shadow-sm space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2">
            <label className="text-xs font-bold text-gray-600 uppercase mb-1.5 block">Customer Name *</label>
            <input value={form.customer_name} onChange={e=>setForm({...form,customer_name:e.target.value})} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" placeholder="Customer or business name"/>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-600 uppercase mb-1.5 block">Phone</label>
            <input value={form.customer_phone} onChange={e=>setForm({...form,customer_phone:e.target.value})} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" placeholder="0712 345678"/>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-gray-600 uppercase mb-1.5 block">Valid Until</label>
            <input type="date" value={form.valid_until} onChange={e=>setForm({...form,valid_until:e.target.value})} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"/>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-600 uppercase mb-1.5 block">Notes</label>
            <input value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" placeholder="Terms, conditions…"/>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="font-bold text-sm text-gray-700">Quote Items</p>
            <button onClick={addItem} className="px-3 py-1.5 bg-violet-500 text-white rounded-xl text-xs font-bold hover:bg-violet-600 transition-all">+ Add Item</button>
          </div>
          {items.length===0?<div className="bg-violet-50 border-2 border-dashed border-violet-200 rounded-xl p-8 text-center"><p className="text-violet-400 text-sm font-semibold">Click "+ Add Item" to add products to this quotation</p></div>
          :<div className="space-y-2">
            {items.map((it,i)=>(
              <div key={i} className="grid grid-cols-12 gap-2 items-center bg-gray-50 rounded-xl p-3">
                <div className="col-span-4"><select value={it.product_id||''} onChange={e=>updateItem(i,'product_id',e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white"><option value="">Select…</option>{products.map(p=><option key={p.pid} value={p.pid}>{p.product_name}</option>)}</select></div>
                <div className="col-span-2"><input type="number" value={it.quantity} onChange={e=>updateItem(i,'quantity',Number(e.target.value))} min="1" placeholder="Qty" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"/></div>
                <div className="col-span-2"><input type="number" value={it.unit_price} onChange={e=>updateItem(i,'unit_price',Number(e.target.value))} min="0" placeholder="Price" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"/></div>
                <div className="col-span-2"><input type="number" value={it.discount} onChange={e=>updateItem(i,'discount',Number(e.target.value))} min="0" max="100" placeholder="Disc%" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"/></div>
                <div className="col-span-1 text-right text-sm font-bold text-violet-600">Ksh {Math.round(it.subtotal).toLocaleString()}</div>
                <div className="col-span-1 text-center"><button onClick={()=>removeItem(i)} className="text-red-400 hover:text-red-600 text-lg">✕</button></div>
              </div>
            ))}
            <div className="text-right p-3 bg-violet-50 rounded-xl"><span className="font-black text-xl text-violet-700">Total: Ksh {Math.round(grandTotal).toLocaleString()}</span></div>
          </div>}
        </div>
        <div className="flex gap-3 pt-2">
          <button onClick={()=>{setView('list');setItems([]);}} className="flex-1 py-3 border border-gray-200 rounded-xl font-semibold text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={saveQuote} disabled={saving} className="px-8 py-3 bg-gradient-to-r from-violet-500 to-purple-700 text-white rounded-xl font-bold text-sm disabled:opacity-60">{saving?'Creating…':'Create Quotation'}</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center text-3xl shadow-lg shadow-violet-200">📄</div>
          <div><h1 className="text-2xl font-black text-gray-800">Quotations Manager</h1>
          <p className="text-sm text-gray-500 mt-0.5">Create & send price quotes to customers · {activeOutlet?.outlet_name}</p></div>
        </div>
        <button onClick={()=>setView('new')} className="px-5 py-2.5 bg-gradient-to-r from-violet-500 to-purple-700 text-white rounded-xl font-bold text-sm shadow-md flex items-center gap-2">+ New Quotation</button>
      </div>

      <div className="grid grid-cols-5 gap-3">
        {Object.entries(STATUS_CFG).map(([s,cfg])=>(
          <button key={s} onClick={()=>setFilterStatus(filterStatus===s?'All':s)} className={`bg-white rounded-2xl border p-4 text-left shadow-sm hover:shadow-md transition-all ${filterStatus===s?'ring-2 ring-violet-400 ring-offset-2':''}`}>
            <span className={`text-xs font-bold ${cfg.t}`}>{cfg.l}</span>
            <p className="text-2xl font-black text-gray-800 mt-2">{quotes.filter(q=>q.status===s).length}</p>
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border p-4 flex flex-wrap items-center gap-3 shadow-sm">
        <div className="flex-1 relative min-w-[200px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search quote no. or customer…" className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"/>
        </div>
        <span className="text-xs text-gray-500 bg-gray-100 px-3 py-1.5 rounded-lg">{filtered.length} quotations</span>
      </div>

      <div className="bg-white rounded-2xl border overflow-hidden shadow-sm">
        <table className="w-full">
          <thead><tr className="bg-gradient-to-r from-violet-50 to-purple-50 border-b">
            {['Quote No.','Customer','Phone','Date','Valid Until','Status','Total','Actions'].map(h=>(
              <th key={h} className={`py-3.5 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider ${h==='Total'?'text-right':'text-left'}`}>{h}</th>
            ))}
          </tr></thead>
          <tbody className="divide-y divide-gray-100">
            {loading?(<tr><td colSpan={8} className="py-20 text-center"><div className="w-10 h-10 border-4 border-violet-400 border-t-transparent rounded-full animate-spin mx-auto"/></td></tr>)
            :filtered.length===0?(<tr><td colSpan={8} className="py-20 text-center text-gray-400">No quotations found</td></tr>)
            :filtered.map(q=>{
              const cfg=STATUS_CFG[q.status]||STATUS_CFG.draft;
              const today=new Date().toISOString().split('T')[0];
              const expired=q.valid_until&&q.valid_until<today&&q.status==='sent';
              return (
                <tr key={q.id} className="hover:bg-violet-50/20 transition-colors">
                  <td className="py-3 px-4 font-black text-sm text-violet-600">{q.quote_number}</td>
                  <td className="py-3 px-4 font-semibold text-sm text-gray-800">{q.customer_name}</td>
                  <td className="py-3 px-4 text-sm text-gray-500">{q.customer_phone||'—'}</td>
                  <td className="py-3 px-4 text-sm text-gray-500">{q.quote_date}</td>
                  <td className="py-3 px-4 text-sm"><span className={expired?'text-red-600 font-bold':'text-gray-500'}>{q.valid_until||'—'}{expired&&' ⚠️'}</span></td>
                  <td className="py-3 px-4"><span className={`px-2.5 py-1 rounded-full text-xs font-bold ${cfg.bg} ${cfg.t}`}>{cfg.l}</span></td>
                  <td className="py-3 px-4 text-right font-black text-sm text-violet-600">Ksh {(q.total_amount||0).toLocaleString()}</td>
                  <td className="py-3 px-4">
                    <div className="flex gap-1">
                      <button onClick={()=>printQuote(q)} className="px-3 py-1.5 bg-violet-100 text-violet-700 rounded-lg text-xs font-bold hover:bg-violet-200">🖨️ Print</button>
                      {q.status==='draft'&&<button onClick={()=>updateStatus(q,'sent')} className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-xs font-bold hover:bg-blue-200">Send</button>}
                      {q.status==='sent'&&<button onClick={()=>updateStatus(q,'accepted')} className="px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold hover:bg-emerald-200">✅</button>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
