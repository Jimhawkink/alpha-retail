'use client';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';
import toast from 'react-hot-toast';

interface PO { po_id:number; po_number:string; supplier_id:number; supplier_name:string; order_date:string; expected_date:string; status:'draft'|'sent'|'partial'|'received'|'cancelled'; total_amount:number; grand_total?:number; notes:string; items_count:number; }
interface POItem { item_id:number; product_id:number; product_name:string; quantity:number; unit_cost:number; received_qty:number; }
interface Supplier { supplier_id:number; supplier_name:string; }
interface Product { pid:number; product_name:string; cost_price:number; }

const STATUS_CFG={draft:{label:'Draft',bg:'bg-gray-100',text:'text-gray-600'},sent:{label:'Sent to Supplier',bg:'bg-blue-100',text:'text-blue-700'},partial:{label:'Partially Received',bg:'bg-amber-100',text:'text-amber-700'},received:{label:'Fully Received',bg:'bg-emerald-100',text:'text-emerald-700'},cancelled:{label:'Cancelled',bg:'bg-red-100',text:'text-red-600'}};
const PAGE_SIZE=15;

export default function PurchaseOrdersPage() {
  const { activeOutlet } = useOutlet();
  const outletId = activeOutlet?.outlet_id||1;
  const [orders, setOrders] = useState<PO[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list'|'new'|'detail'>('list');
  const [selected, setSelected] = useState<PO|null>(null);
  const [poItems, setPOItems] = useState<POItem[]>([]);
  const [filterStatus, setFilterStatus] = useState('All');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({supplier_id:'',expected_date:'',notes:''});
  const [formItems, setFormItems] = useState<{product_id:number;product_name:string;quantity:number;unit_cost:number}[]>([]);

  const load = useCallback(async()=>{
    setLoading(true);
    try {
      const [{ data: pos },{ data: sups },{ data: prods }] = await Promise.all([
        supabase.from('retail_purchases').select('*').eq('outlet_id',outletId).order('created_at',{ascending:false}),
        supabase.from('retail_suppliers').select('supplier_id,supplier_name').order('supplier_name'),
        supabase.from('retail_products').select('pid,product_name,cost_price').eq('outlet_id',outletId).eq('active',true).order('product_name'),
      ]);
      setOrders(pos||[]);setSuppliers(sups||[]);setProducts(prods||[]);
    } catch { toast.error('Failed to load'); }
    setLoading(false);
  },[outletId]);

  useEffect(()=>{load();},[load]);

  const loadDetail=async(po:PO)=>{
    setSelected(po);
    const { data } = await supabase.from('retail_purchase_items').select('*').eq('purchase_id',po.po_id);
    setPOItems(data||[]);setView('detail');
  };

  const addItem=()=>setFormItems([...formItems,{product_id:0,product_name:'',quantity:1,unit_cost:0}]);
  const removeItem=(i:number)=>setFormItems(formItems.filter((_,idx)=>idx!==i));
  const updateItem=(i:number,field:string,val:any)=>{
    const items=[...formItems];items[i]={...items[i],[field]:val};
    if(field==='product_id'){const p=products.find(pr=>pr.pid===Number(val));if(p){items[i].product_name=p.product_name;items[i].unit_cost=p.cost_price;}}
    setFormItems(items);
  };

  const savePO=async()=>{
    if(!form.supplier_id){toast.error('Select a supplier');return;}
    if(formItems.length===0){toast.error('Add at least one item');return;}
    if(formItems.some(it=>!it.product_id||it.quantity<=0)){toast.error('Fill all item details');return;}
    setSaving(true);
    try {
      const sup=suppliers.find(s=>s.supplier_id===Number(form.supplier_id));
      const grand_total=formItems.reduce((s,it)=>s+it.quantity*it.unit_cost,0);
      const poNumber=`PO-${Date.now().toString().slice(-6)}`;
      const { data: newPO } = await supabase.from('retail_purchases').insert({po_number:poNumber,outlet_id:outletId,supplier_id:Number(form.supplier_id),supplier_name:sup?.supplier_name,order_date:new Date().toISOString().split('T')[0],expected_date:form.expected_date,status:'draft',grand_total,notes:form.notes}).select().single();
      if(newPO){
        await supabase.from('retail_purchase_items').insert(formItems.map(it=>({purchase_id:newPO.po_id||newPO.id,product_id:it.product_id,product_name:it.product_name,quantity:it.quantity,unit_cost:it.unit_cost,subtotal:it.quantity*it.unit_cost,received_qty:0,outlet_id:outletId})));
      }
      toast.success(`Purchase Order ${poNumber} created!`);
      setView('list');setForm({supplier_id:'',expected_date:'',notes:''});setFormItems([]);load();
    } catch { toast.error('Failed to create PO'); }
    setSaving(false);
  };

  const updateStatus=async(po:PO,status:string)=>{
    await supabase.from('retail_purchases').update({status}).eq('po_id',po.po_id);
    toast.success('Status updated');load();if(selected?.po_id===po.po_id)setSelected({...po,status:status as any});
  };

  const filtered=orders.filter(o=>{
    const ms=filterStatus==='All'||o.status===filterStatus;
    const mq=!search||(o.po_number||'').toLowerCase().includes(search.toLowerCase())||(o.supplier_name||'').toLowerCase().includes(search.toLowerCase());
    return ms&&mq;
  });
  const totalPages=Math.ceil(filtered.length/PAGE_SIZE);
  const paged=filtered.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE);
  const draftCount=orders.filter(o=>o.status==='draft').length;
  const pendingValue=orders.filter(o=>['draft','sent'].includes(o.status)).reduce((s,o)=>s+(o.total_amount||o.grand_total||0),0);

  const printPO=(po:PO)=>{
    const html=`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Purchase Order ${po.po_number}</title>
<style>body{font-family:Arial,sans-serif;font-size:11px;padding:15mm;}h2{font-size:18px;margin:0 0 4px;}
.header{display:flex;justify-content:space-between;border-bottom:2px solid #333;padding-bottom:10px;margin-bottom:12px;}
.info{font-size:10px;color:#555;}.badge{background:#e5e7eb;padding:3px 8px;border-radius:12px;font-size:9px;font-weight:700;margin-top:4px;display:inline-block;}
table{width:100%;border-collapse:collapse;margin-top:12px;}th,td{border:1px solid #ddd;padding:5px 8px;font-size:10px;}th{background:#f3f4f6;font-weight:700;}.r{text-align:right;}.total{background:#f9f9f9;font-weight:700;}</style></head><body>
<div class="header"><div><h2>PURCHASE ORDER</h2><div class="info">Alpha Retail — ${activeOutlet?.outlet_name}</div><span class="badge">${(STATUS_CFG[po.status]||STATUS_CFG.draft).label}</span></div>
<div style="text-align:right"><div style="font-size:16px;font-weight:900;color:#1e40af">${po.po_number}</div><div class="info">Order Date: ${po.order_date}</div><div class="info">Expected: ${po.expected_date||'—'}</div></div></div>
<div class="info"><strong>Supplier:</strong> ${po.supplier_name}</div>
<table><tr><th>#</th><th>Product</th><th class="r">Qty</th><th class="r">Unit Cost</th><th class="r">Subtotal</th></tr>
${poItems.map((it,i)=>`<tr><td>${i+1}</td><td>${it.product_name}</td><td class="r">${it.quantity}</td><td class="r">Ksh ${it.unit_cost.toLocaleString()}</td><td class="r">Ksh ${(it.quantity*it.unit_cost).toLocaleString()}</td></tr>`).join('')}
<tr class="total"><td colspan="4" class="r"><strong>Grand Total</strong></td><td class="r"><strong>Ksh ${(po.total_amount||po.grand_total||0).toLocaleString()}</strong></td></tr></table>
${po.notes?`<p style="margin-top:12px;font-size:10px;color:#555"><strong>Notes:</strong> ${po.notes}</p>`:''}
<div style="margin-top:30px;display:flex;justify-content:space-between"><div style="border-top:1px solid #333;width:180px;text-align:center;padding-top:4px;font-size:10px;">Authorized Signature</div><div style="border-top:1px solid #333;width:180px;text-align:center;padding-top:4px;font-size:10px;">Supplier Signature</div></div></body></html>`;
    const w=window.open('','_blank');if(w){w.document.write(html);w.document.close();w.print();}
  };

  if(view==='new') return (
    <div className="space-y-6 pb-8">
      <div className="flex items-center gap-4">
        <button onClick={()=>{setView('list');setFormItems([]);}} className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-600">← Back</button>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-2xl">📋</div>
          <div><h1 className="text-xl font-black text-gray-800">New Purchase Order</h1><p className="text-sm text-gray-500">Fill in order details below</p></div>
        </div>
      </div>
      <div className="bg-white rounded-2xl border p-6 shadow-sm space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2">
            <label className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5 block">Supplier *</label>
            <select value={form.supplier_id} onChange={e=>setForm({...form,supplier_id:e.target.value})} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white">
              <option value="">Select supplier…</option>
              {suppliers.map(s=><option key={s.supplier_id} value={s.supplier_id}>{s.supplier_name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5 block">Expected Delivery</label>
            <input type="date" value={form.expected_date} onChange={e=>setForm({...form,expected_date:e.target.value})} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"/>
          </div>
        </div>
        <div>
          <label className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5 block">Notes</label>
          <textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} rows={2} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none" placeholder="Optional notes for supplier…"/>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="font-bold text-sm text-gray-700">Order Items</p>
            <button onClick={addItem} className="px-3 py-1.5 bg-blue-500 text-white rounded-xl text-xs font-bold hover:bg-blue-600 transition-all">+ Add Item</button>
          </div>
          {formItems.length===0?<div className="bg-blue-50 border-2 border-dashed border-blue-200 rounded-xl p-8 text-center"><p className="text-blue-400 font-semibold text-sm">No items added yet. Click "+ Add Item" to start.</p></div>
          :<div className="space-y-2">
            {formItems.map((it,i)=>(
              <div key={i} className="grid grid-cols-12 gap-2 items-center bg-gray-50 rounded-xl p-3">
                <div className="col-span-5">
                  <select value={it.product_id||''} onChange={e=>updateItem(i,'product_id',e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white">
                    <option value="">Select product…</option>
                    {products.map(p=><option key={p.pid} value={p.pid}>{p.product_name}</option>)}
                  </select>
                </div>
                <div className="col-span-2"><input type="number" value={it.quantity} onChange={e=>updateItem(i,'quantity',Number(e.target.value))} min="1" placeholder="Qty" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"/></div>
                <div className="col-span-3"><input type="number" value={it.unit_cost} onChange={e=>updateItem(i,'unit_cost',Number(e.target.value))} min="0" step="0.01" placeholder="Unit Cost" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"/></div>
                <div className="col-span-1 text-right text-sm font-bold text-blue-600">Ksh {(it.quantity*it.unit_cost).toLocaleString()}</div>
                <div className="col-span-1 text-center"><button onClick={()=>removeItem(i)} className="text-red-400 hover:text-red-600 transition-colors text-lg">✕</button></div>
              </div>
            ))}
            <div className="text-right p-3 bg-blue-50 rounded-xl"><span className="font-black text-lg text-blue-700">Grand Total: Ksh {formItems.reduce((s,it)=>s+it.quantity*it.unit_cost,0).toLocaleString()}</span></div>
          </div>}
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={()=>{setView('list');setFormItems([]);}} className="flex-1 py-3 border border-gray-200 rounded-xl font-semibold text-sm text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
          <button onClick={savePO} disabled={saving} className="flex-2 px-8 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-bold text-sm hover:from-blue-600 hover:to-indigo-700 transition-all disabled:opacity-60">{saving?'Creating PO…':'Create Purchase Order'}</button>
        </div>
      </div>
    </div>
  );

  if(view==='detail'&&selected) return (
    <div className="space-y-6 pb-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={()=>setView('list')} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">← Back</button>
          <div><h1 className="text-xl font-black text-gray-800">{selected.po_number}</h1><p className="text-sm text-gray-500">{selected.supplier_name} · {selected.order_date}</p></div>
        </div>
        <div className="flex gap-2">
          <button onClick={()=>printPO(selected)} className="px-4 py-2 bg-gray-600 text-white rounded-xl text-sm font-bold hover:bg-gray-700 transition-all">🖨️ Print PO</button>
          {selected.status==='draft'&&<button onClick={()=>updateStatus(selected,'sent')} className="px-4 py-2 bg-blue-500 text-white rounded-xl text-sm font-bold hover:bg-blue-600 transition-all">📤 Mark as Sent</button>}
          {selected.status==='sent'&&<button onClick={()=>updateStatus(selected,'received')} className="px-4 py-2 bg-emerald-500 text-white rounded-xl text-sm font-bold hover:bg-emerald-600 transition-all">✅ Mark Received</button>}
        </div>
      </div>
      <div className="bg-white rounded-2xl border p-6 shadow-sm">
        <div className="flex items-start justify-between mb-6">
          <div>
            <span className={`px-3 py-1.5 rounded-full text-xs font-bold ${STATUS_CFG[selected.status]?.bg} ${STATUS_CFG[selected.status]?.text}`}>{STATUS_CFG[selected.status]?.label}</span>
            <div className="mt-3 space-y-1 text-sm text-gray-600">
              <p>Supplier: <strong>{selected.supplier_name}</strong></p>
              <p>Order Date: <strong>{selected.order_date}</strong></p>
              <p>Expected: <strong>{selected.expected_date||'—'}</strong></p>
              {selected.notes&&<p>Notes: <strong>{selected.notes}</strong></p>}
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400 uppercase font-bold">Grand Total</p>
            <p className="text-3xl font-black text-blue-600">Ksh {(selected.total_amount||selected.grand_total||0).toLocaleString()}</p>
          </div>
        </div>
        <table className="w-full">
          <thead><tr className="bg-blue-50 border-b"><th className="text-left py-3 px-4 text-xs font-bold text-gray-500 uppercase">Product</th><th className="text-right py-3 px-4 text-xs font-bold text-gray-500 uppercase">Ordered</th><th className="text-right py-3 px-4 text-xs font-bold text-gray-500 uppercase">Received</th><th className="text-right py-3 px-4 text-xs font-bold text-gray-500 uppercase">Unit Cost</th><th className="text-right py-3 px-4 text-xs font-bold text-gray-500 uppercase">Subtotal</th></tr></thead>
          <tbody className="divide-y divide-gray-100">
            {poItems.map((it,i)=>(
              <tr key={i} className="hover:bg-gray-50/60">
                <td className="py-3 px-4 font-semibold text-sm text-gray-800">{it.product_name}</td>
                <td className="py-3 px-4 text-right font-bold text-sm">{it.quantity}</td>
                <td className="py-3 px-4 text-right text-sm"><span className={`font-bold ${(it.received_qty||0)>=it.quantity?'text-emerald-600':(it.received_qty||0)>0?'text-amber-600':'text-gray-400'}`}>{it.received_qty||0}</span></td>
                <td className="py-3 px-4 text-right text-sm text-gray-600">Ksh {(it.unit_cost||0).toLocaleString()}</td>
                <td className="py-3 px-4 text-right font-bold text-sm text-blue-600">Ksh {((it.quantity||0)*(it.unit_cost||0)).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr className="bg-blue-50 font-bold"><td colSpan={4} className="py-3 px-4 text-sm">GRAND TOTAL</td><td className="py-3 px-4 text-right text-sm text-blue-700">Ksh {(selected.total_amount||selected.grand_total||0).toLocaleString()}</td></tr></tfoot>
        </table>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-700 flex items-center justify-center text-3xl shadow-lg shadow-blue-200">📋</div>
          <div><h1 className="text-2xl font-black text-gray-800">Purchase Orders</h1>
          <p className="text-sm text-gray-500 mt-0.5">Create, track and receive stock orders · {activeOutlet?.outlet_name}</p></div>
        </div>
        <button onClick={()=>setView('new')} className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-xl font-bold text-sm transition-all shadow-md flex items-center gap-2">+ New Purchase Order</button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {label:'Draft Orders',value:draftCount,icon:'📝',color:'border-l-gray-400',bg:'bg-gray-50',vc:'text-gray-600'},
          {label:'Sent to Supplier',value:orders.filter(o=>o.status==='sent').length,icon:'📤',color:'border-l-blue-500',bg:'bg-blue-50',vc:'text-blue-700'},
          {label:'Pending Value',value:`Ksh ${Math.round(pendingValue).toLocaleString()}`,icon:'💰',color:'border-l-amber-500',bg:'bg-amber-50',vc:'text-amber-700'},
          {label:'Received',value:orders.filter(o=>o.status==='received').length,icon:'✅',color:'border-l-emerald-500',bg:'bg-emerald-50',vc:'text-emerald-700'},
        ].map((c,i)=>(
          <div key={i} className={`bg-white rounded-2xl border-l-4 ${c.color} ${c.bg} p-5 shadow-sm`}>
            <div className="flex items-center gap-2 mb-2"><span className="text-xl">{c.icon}</span><p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{c.label}</p></div>
            <p className={`text-2xl font-black ${c.vc}`}>{c.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border p-4 flex flex-wrap items-center gap-3 shadow-sm">
        <div className="flex bg-gray-100 rounded-xl p-1 gap-0.5 flex-wrap">
          {['All','draft','sent','partial','received','cancelled'].map(s=>(
            <button key={s} onClick={()=>setFilterStatus(s)} className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${filterStatus===s?'bg-white text-blue-600 shadow-sm':'text-gray-500 hover:text-gray-700'}`}>{STATUS_CFG[s as keyof typeof STATUS_CFG]?.label||'All'}</button>
          ))}
        </div>
        <div className="flex-1 relative min-w-[180px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
          <input value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} placeholder="Search PO or supplier…" className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"/>
        </div>
      </div>

      <div className="bg-white rounded-2xl border overflow-hidden shadow-sm">
        <table className="w-full">
          <thead><tr className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
            {['PO Number','Supplier','Order Date','Expected','Status','Total','Items','Actions'].map(h=>(
              <th key={h} className={`py-3.5 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider ${['Total','Items'].includes(h)?'text-right':'text-left'}`}>{h}</th>
            ))}
          </tr></thead>
          <tbody className="divide-y divide-gray-100">
            {loading?(<tr><td colSpan={8} className="py-20 text-center"><div className="w-12 h-12 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto"/></td></tr>)
            :paged.length===0?(<tr><td colSpan={8} className="py-20 text-center"><div className="text-5xl mb-3">📋</div><p className="font-bold text-gray-700">No purchase orders found</p></td></tr>)
            :paged.map(po=>{
              const cfg=STATUS_CFG[po.status]||STATUS_CFG.draft;
              const today=new Date().toISOString().split('T')[0];
              const overdue=po.expected_date&&po.expected_date<today&&!['received','cancelled'].includes(po.status);
              return (
                <tr key={po.po_id} className={`hover:bg-blue-50/30 transition-colors ${overdue?'bg-red-50/20':''}`}>
                  <td className="py-3 px-4 font-black text-sm text-blue-600">{po.po_number}</td>
                  <td className="py-3 px-4 font-semibold text-sm text-gray-800">{po.supplier_name}</td>
                  <td className="py-3 px-4 text-sm text-gray-500">{po.order_date}</td>
                  <td className="py-3 px-4 text-sm"><span className={overdue?'text-red-600 font-bold':'text-gray-500'}>{po.expected_date||'—'}{overdue&&' ⚠️'}</span></td>
                  <td className="py-3 px-4"><span className={`px-2.5 py-1 rounded-full text-xs font-bold ${cfg.bg} ${cfg.text}`}>{cfg.label}</span></td>
                  <td className="py-3 px-4 text-right font-black text-sm text-blue-600">Ksh {(po.total_amount||po.grand_total||0).toLocaleString()}</td>
                  <td className="py-3 px-4 text-right text-sm text-gray-500">{po.items_count||'—'}</td>
                  <td className="py-3 px-4">
                    <div className="flex gap-1">
                      <button onClick={()=>loadDetail(po)} className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-xs font-bold hover:bg-blue-200 transition-all">View</button>
                      {po.status==='draft'&&<button onClick={()=>updateStatus(po,'sent')} className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-bold hover:bg-gray-200 transition-all">Send</button>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {totalPages>1&&(
          <div className="flex items-center justify-between px-4 py-3.5 border-t bg-gray-50/50">
            <p className="text-sm text-gray-500">Showing <strong>{(page-1)*PAGE_SIZE+1}–{Math.min(page*PAGE_SIZE,filtered.length)}</strong> of <strong>{filtered.length}</strong></p>
            <div className="flex items-center gap-1">
              <button onClick={()=>setPage(1)} disabled={page===1} className="px-2.5 py-1.5 rounded-lg text-xs font-bold disabled:opacity-30 hover:bg-gray-200">«</button>
              <button onClick={()=>setPage(p=>p-1)} disabled={page===1} className="px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-30 hover:bg-gray-200">‹</button>
              {Array.from({length:Math.min(7,totalPages)},(_,i)=>{let pg=i+1;if(totalPages>7&&page>4)pg=page-3+i;if(pg<1||pg>totalPages)return null;return <button key={pg} onClick={()=>setPage(pg)} className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${pg===page?'bg-blue-500 text-white shadow-md':'hover:bg-gray-200 text-gray-600'}`}>{pg}</button>;})}
              <button onClick={()=>setPage(p=>p+1)} disabled={page===totalPages} className="px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-30 hover:bg-gray-200">›</button>
              <button onClick={()=>setPage(totalPages)} disabled={page===totalPages} className="px-2.5 py-1.5 rounded-lg text-xs font-bold disabled:opacity-30 hover:bg-gray-200">»</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
