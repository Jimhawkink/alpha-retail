'use client';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';
import toast from 'react-hot-toast';

interface ProductPrice { pid:number; product_name:string; category:string; barcode:string; cost_price:number; selling_price:number; margin:number; margin_pct:number; stock_qty:number; }
const PAGE_SIZE=25;

export default function PriceListPage() {
  const { activeOutlet } = useOutlet();
  const outletId = activeOutlet?.outlet_id||1;
  const [products, setProducts] = useState<ProductPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<string[]>([]);
  const [filterCat, setFilterCat] = useState('All');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [editId, setEditId] = useState<number|null>(null);
  const [editValues, setEditValues] = useState<{cost:number;sell:number}>({cost:0,sell:0});
  const [saving, setSaving] = useState(false);
  const [markupMode, setMarkupMode] = useState(false);
  const [bulkMarkup, setBulkMarkup] = useState('');

  const load = useCallback(async()=>{
    setLoading(true);
    try {
      const [{ data: prods },{ data: stocks }] = await Promise.all([
        supabase.from('retail_products').select('pid,product_name,category,barcode,cost_price,selling_price').eq('outlet_id',outletId).eq('active',true).order('product_name'),
        supabase.from('retail_stock').select('pid,qty').eq('outlet_id',outletId),
      ]);
      const stockMap:Record<number,number>={};
      (stocks||[]).forEach((s:any)=>{stockMap[s.pid]=(stockMap[s.pid]||0)+(s.qty||0);});
      const result:ProductPrice[]=(prods||[]).map((p:any)=>{
        const margin=(p.selling_price||0)-(p.cost_price||0);
        const margin_pct=p.selling_price>0?(margin/p.selling_price)*100:0;
        return {...p,margin,margin_pct,stock_qty:stockMap[p.pid]||0};
      });
      setProducts(result);
      setCategories(Array.from(new Set(result.map(p=>p.category||'Uncategorized'))).sort());
    } catch { toast.error('Failed to load'); }
    setLoading(false);
  },[outletId]);

  useEffect(()=>{load();},[load]);

  const savePrice=async(pid:number)=>{
    if(editValues.sell<=0){toast.error('Selling price must be greater than 0');return;}
    if(editValues.sell<editValues.cost){toast.error('Warning: Selling price below cost price!');} // Allow but warn
    setSaving(true);
    try {
      await supabase.from('retail_products').update({cost_price:editValues.cost,selling_price:editValues.sell}).eq('pid',pid);
      // Log price change (best-effort)
      try {
        const oldProd = products.find(p=>p.pid===pid);
        const oldPrice = oldProd?.selling_price||0;
        const changePct = oldPrice>0?((editValues.sell-oldPrice)/oldPrice)*100:0;
        await supabase.from('retail_price_history').insert({outlet_id:outletId,product_id:pid,change_type:'selling',old_price:oldPrice,new_price:editValues.sell,change_pct:changePct,changed_at:new Date().toISOString()});
      } catch(_){}
      toast.success('Price updated!');
      setEditId(null);load();
    } catch { toast.error('Failed to save'); }
    setSaving(false);
  };

  const applyBulkMarkup=async()=>{
    const pct=Number(bulkMarkup);
    if(!pct||pct<=0){toast.error('Enter a valid markup %');return;}
    if(!confirm(`Apply ${pct}% markup to ALL ${filtered.length} filtered products?`))return;
    setSaving(true);
    try {
      for(const p of filtered){
        const newSell=Math.ceil(p.cost_price*(1+pct/100));
        await supabase.from('retail_products').update({selling_price:newSell}).eq('pid',p.pid);
      }
      toast.success(`Markup applied to ${filtered.length} products!`);
      setBulkMarkup('');load();
    } catch { toast.error('Failed'); }
    setSaving(false);
  };

  const printPriceList=()=>{
    const html=`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Price List</title>
<style>@page{margin:12mm;}body{font-family:Arial,sans-serif;font-size:10px;}h2{font-size:16px;margin:0 0 3px;}
table{width:100%;border-collapse:collapse;margin-top:10px;}th,td{border:1px solid #ddd;padding:4px 7px;font-size:9px;}
th{background:#f3f4f6;font-weight:700;}.r{text-align:right;}.green{color:green;}.red{color:red;}</style></head><body>
<h2>Price List — ${activeOutlet?.outlet_name}</h2>
<div style="font-size:9px;color:#555;margin-bottom:8px;">Generated: ${new Date().toLocaleString('en-KE')} · ${filtered.length} products${filterCat!=='All'?' · '+filterCat:''}</div>
<table><tr><th>#</th><th>Product</th><th>Category</th><th>Barcode</th><th class="r">Cost (Ksh)</th><th class="r">Price (Ksh)</th><th class="r">Margin%</th><th class="r">Stock</th></tr>
${filtered.map((p,i)=>`<tr><td>${i+1}</td><td>${p.product_name}</td><td>${p.category||'—'}</td><td>${p.barcode||'—'}</td><td class="r">${(p.cost_price||0).toLocaleString()}</td><td class="r"><strong>${(p.selling_price||0).toLocaleString()}</strong></td><td class="r ${p.margin_pct>=20?'green':'red'}">${p.margin_pct.toFixed(1)}%</td><td class="r">${p.stock_qty}</td></tr>`).join('')}
</table></body></html>`;
    const w=window.open('','_blank');if(w){w.document.write(html);w.document.close();w.print();}
    toast.success('Price list printed!');
  };

  const filtered=products.filter(p=>{
    const mc=filterCat==='All'||(p.category||'Uncategorized')===filterCat;
    const mq=!search||p.product_name.toLowerCase().includes(search.toLowerCase())||(p.barcode||'').includes(search);
    return mc&&mq;
  });
  const totalPages=Math.ceil(filtered.length/PAGE_SIZE);
  const paged=filtered.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE);
  const avgMargin=filtered.length>0?filtered.reduce((s,p)=>s+p.margin_pct,0)/filtered.length:0;
  const belowCost=filtered.filter(p=>p.selling_price<p.cost_price).length;

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-3xl shadow-lg shadow-emerald-200">💲</div>
          <div><h1 className="text-2xl font-black text-gray-800">Price List Manager</h1>
          <p className="text-sm text-gray-500 mt-0.5">View & edit all product prices · Bulk markup · Print price list · {activeOutlet?.outlet_name}</p></div>
        </div>
        <div className="flex gap-2">
          <button onClick={printPriceList} className="px-4 py-2 bg-gray-700 hover:bg-gray-800 text-white rounded-xl font-semibold text-sm transition-all">🖨️ Print</button>
          <button onClick={()=>setMarkupMode(!markupMode)} className={`px-4 py-2 rounded-xl font-semibold text-sm transition-all ${markupMode?'bg-emerald-500 text-white':'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'}`}>⚡ Bulk Markup</button>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-3 gap-4">
        {[
          {label:'Total Products',value:filtered.length,icon:'📦',color:'border-l-blue-500',bg:'bg-blue-50',vc:'text-blue-700'},
          {label:'Avg Margin',value:`${avgMargin.toFixed(1)}%`,icon:'📊',color:avgMargin>=20?'border-l-emerald-500':'border-l-amber-500',bg:avgMargin>=20?'bg-emerald-50':'bg-amber-50',vc:avgMargin>=20?'text-emerald-700':'text-amber-700'},
          {label:'Below Cost Price',value:belowCost,icon:'⚠️',color:'border-l-red-500',bg:'bg-red-50',vc:'text-red-600'},
        ].map((c,i)=>(
          <div key={i} className={`bg-white rounded-2xl border-l-4 ${c.color} ${c.bg} p-5 shadow-sm`}>
            <div className="flex items-center gap-2 mb-2"><span className="text-xl">{c.icon}</span><p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{c.label}</p></div>
            <p className={`text-3xl font-black ${c.vc}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Bulk markup panel */}
      {markupMode&&(
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚡</span>
            <div><p className="font-bold text-emerald-800">Bulk Markup Tool</p><p className="text-emerald-600 text-sm">Applies to {filtered.length} currently filtered products</p></div>
          </div>
          <div className="flex items-center gap-3 ml-auto">
            <span className="text-sm font-semibold text-emerald-700">Markup %:</span>
            <input type="number" value={bulkMarkup} onChange={e=>setBulkMarkup(e.target.value)} min="1" max="500" placeholder="e.g. 30" className="w-24 px-3 py-2 border border-emerald-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"/>
            <span className="text-sm text-emerald-600">New price = cost × {bulkMarkup?(1+Number(bulkMarkup)/100).toFixed(2):'1.XX'}</span>
            <button onClick={applyBulkMarkup} disabled={saving} className="px-5 py-2 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-all disabled:opacity-60">{saving?'Applying…':'Apply Markup'}</button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-2xl border p-4 flex flex-wrap items-center gap-3 shadow-sm">
        <select value={filterCat} onChange={e=>{setFilterCat(e.target.value);setPage(1);}} className="px-3 py-2 border border-gray-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white">
          <option value="All">All Categories</option>
          {categories.map(c=><option key={c} value={c}>{c}</option>)}
        </select>
        <div className="flex-1 relative min-w-[200px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
          <input value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} placeholder="Search product or barcode…" className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"/>
        </div>
        <span className="text-xs text-gray-500 bg-gray-100 px-3 py-1.5 rounded-lg">{filtered.length} products</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border overflow-hidden shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="bg-gradient-to-r from-emerald-50 to-teal-50 border-b">
              {['#','Product','Category','Barcode','Cost Price','Selling Price','Margin','Margin %','Stock','Actions'].map(h=>(
                <th key={h} className={`py-3.5 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider ${['Cost Price','Selling Price','Margin','Margin %','Stock'].includes(h)?'text-right':'text-left'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading?(<tr><td colSpan={10} className="py-20 text-center"><div className="w-10 h-10 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto"/></td></tr>)
            :paged.length===0?(<tr><td colSpan={10} className="py-20 text-center text-gray-400">No products found</td></tr>)
            :paged.map((p,i)=>(
              <tr key={p.pid} className={`hover:bg-gray-50/60 transition-colors ${p.selling_price<p.cost_price?'bg-red-50/30':''}`}>
                <td className="py-3 px-4 text-xs text-gray-400">{(page-1)*PAGE_SIZE+i+1}</td>
                <td className="py-3 px-4 font-semibold text-sm text-gray-800">{p.product_name}</td>
                <td className="py-3 px-4"><span className="px-2 py-0.5 bg-gray-100 rounded-md text-xs text-gray-500">{p.category||'—'}</span></td>
                <td className="py-3 px-4 font-mono text-xs text-gray-400">{p.barcode||'—'}</td>
                {editId===p.pid ? (
                  <>
                    <td className="py-2 px-2"><input type="number" value={editValues.cost} onChange={e=>setEditValues({...editValues,cost:Number(e.target.value)})} className="w-24 px-2 py-1.5 border-2 border-blue-400 rounded-lg text-sm font-bold text-right focus:outline-none" min="0" step="0.01"/></td>
                    <td className="py-2 px-2"><input type="number" value={editValues.sell} onChange={e=>setEditValues({...editValues,sell:Number(e.target.value)})} className="w-24 px-2 py-1.5 border-2 border-emerald-400 rounded-lg text-sm font-bold text-right focus:outline-none" min="0" step="0.01"/></td>
                    <td className="py-3 px-4 text-right text-sm font-bold text-emerald-600">Ksh {Math.round(editValues.sell-editValues.cost).toLocaleString()}</td>
                    <td className="py-3 px-4 text-right"><span className={`text-xs font-black px-2 py-0.5 rounded-full ${editValues.sell>0&&(editValues.sell-editValues.cost)/editValues.sell*100>=20?'bg-emerald-100 text-emerald-700':'bg-red-100 text-red-600'}`}>{editValues.sell>0?(((editValues.sell-editValues.cost)/editValues.sell)*100).toFixed(1):0}%</span></td>
                  </>
                ) : (
                  <>
                    <td className="py-3 px-4 text-right text-sm text-gray-500">Ksh {(p.cost_price||0).toLocaleString()}</td>
                    <td className="py-3 px-4 text-right font-black text-sm text-gray-800">Ksh {(p.selling_price||0).toLocaleString()}</td>
                    <td className="py-3 px-4 text-right font-bold text-sm text-emerald-600">Ksh {Math.round(p.margin).toLocaleString()}</td>
                    <td className="py-3 px-4 text-right"><span className={`px-2.5 py-1 rounded-full text-xs font-black ${p.margin_pct>=30?'bg-emerald-100 text-emerald-700':p.margin_pct>=15?'bg-amber-100 text-amber-700':'bg-red-100 text-red-600'}`}>{p.margin_pct.toFixed(1)}%</span></td>
                  </>
                )}
                <td className="py-3 px-4 text-right text-sm font-bold text-gray-600">{p.stock_qty}</td>
                <td className="py-3 px-4">
                  {editId===p.pid ? (
                    <div className="flex gap-1">
                      <button onClick={()=>savePrice(p.pid)} disabled={saving} className="px-3 py-1.5 bg-emerald-500 text-white rounded-lg text-xs font-bold hover:bg-emerald-600 disabled:opacity-60">{saving?'…':'Save'}</button>
                      <button onClick={()=>setEditId(null)} className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-bold hover:bg-gray-200">✕</button>
                    </div>
                  ) : (
                    <button onClick={()=>{setEditId(p.pid);setEditValues({cost:p.cost_price||0,sell:p.selling_price||0});}} className="px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold hover:bg-emerald-200 transition-all">✏️ Edit</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {totalPages>1&&(
          <div className="flex items-center justify-between px-4 py-3.5 border-t bg-gray-50/50">
            <p className="text-sm text-gray-500">Showing <strong>{(page-1)*PAGE_SIZE+1}–{Math.min(page*PAGE_SIZE,filtered.length)}</strong> of <strong>{filtered.length}</strong></p>
            <div className="flex items-center gap-1">
              <button onClick={()=>setPage(1)} disabled={page===1} className="px-2.5 py-1.5 rounded-lg text-xs font-bold disabled:opacity-30 hover:bg-gray-200">«</button>
              <button onClick={()=>setPage(p=>p-1)} disabled={page===1} className="px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-30 hover:bg-gray-200">‹</button>
              {Array.from({length:Math.min(7,totalPages)},(_,i)=>{let pg=i+1;if(totalPages>7&&page>4)pg=page-3+i;if(pg<1||pg>totalPages)return null;return <button key={pg} onClick={()=>setPage(pg)} className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${pg===page?'bg-emerald-500 text-white shadow-md':'hover:bg-gray-200 text-gray-600'}`}>{pg}</button>;})}
              <button onClick={()=>setPage(p=>p+1)} disabled={page===totalPages} className="px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-30 hover:bg-gray-200">›</button>
              <button onClick={()=>setPage(totalPages)} disabled={page===totalPages} className="px-2.5 py-1.5 rounded-lg text-xs font-bold disabled:opacity-30 hover:bg-gray-200">»</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
