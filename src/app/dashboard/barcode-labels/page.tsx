'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';
import toast from 'react-hot-toast';

interface Product { pid:number; product_name:string; barcode:string; selling_price:number; category:string; }
const PAGE_SIZE=20;
const LABEL_SIZES=[{id:'small',label:'Small (38×25mm)',w:144,h:96},{id:'medium',label:'Medium (50×30mm)',w:189,h:113},{id:'large',label:'Large (72×36mm)',w:272,h:136}];

export default function BarcodeLabelsPage() {
  const { activeOutlet } = useOutlet();
  const outletId = activeOutlet?.outlet_id||1;
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('All');
  const [categories, setCategories] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [labelSize, setLabelSize] = useState('medium');
  const [copies, setCopies] = useState(1);
  const [showPrice, setShowPrice] = useState(true);
  const [showBarcode, setShowBarcode] = useState(true);
  const [showName, setShowName] = useState(true);
  const [showOutlet, setShowOutlet] = useState(false);
  const [page, setPage] = useState(1);
  const printRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async()=>{
    setLoading(true);
    try {
      const { data } = await supabase.from('retail_products').select('pid,product_name,barcode,selling_price,category').eq('outlet_id',outletId).eq('active',true).order('product_name');
      setProducts(data||[]);
      const cats=Array.from(new Set((data||[]).map((p:any)=>p.category||'Uncategorized'))).sort();
      setCategories(cats);
    } catch { toast.error('Failed to load'); }
    setLoading(false);
  },[outletId]);

  useEffect(()=>{load();},[load]);

  const filtered=products.filter(p=>{
    const mq=!search||p.product_name.toLowerCase().includes(search.toLowerCase())||(p.barcode||'').includes(search);
    const mc=filterCat==='All'||(p.category||'Uncategorized')===filterCat;
    return mq&&mc;
  });
  const totalPages=Math.ceil(filtered.length/PAGE_SIZE);
  const paged=filtered.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE);

  const toggleSelect=(pid:number)=>{
    const s=new Set(selected);s.has(pid)?s.delete(pid):s.add(pid);setSelected(s);
  };
  const selectAll=()=>{
    if(selected.size===filtered.length){setSelected(new Set());}
    else{setSelected(new Set(filtered.map(p=>p.pid)));}
  };

  const selectedProducts=products.filter(p=>selected.has(p.pid));
  const size=LABEL_SIZES.find(s=>s.id===labelSize)||LABEL_SIZES[1];

  const printLabels=()=>{
    if(selectedProducts.length===0){toast.error('Select at least one product');return;}
    const labelsHtml=selectedProducts.flatMap(p=>
      Array.from({length:copies}).map(()=>`
        <div style="width:${size.w}px;height:${size.h}px;border:1px solid #ccc;display:inline-flex;flex-direction:column;align-items:center;justify-content:center;margin:2px;padding:4px;font-family:Arial,sans-serif;page-break-inside:avoid;box-sizing:border-box;">
          ${showName?`<div style="font-size:${size.id==='small'?8:size.id==='medium'?9:11}px;font-weight:700;text-align:center;line-height:1.2;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${p.product_name}</div>`:''}
          ${showBarcode&&p.barcode?`<div style="font-size:${size.id==='small'?18:size.id==='medium'?22:28}px;font-family:'Libre Barcode 128',monospace;letter-spacing:0;">${p.barcode}</div><div style="font-size:7px;color:#555;">${p.barcode}</div>`:''}
          ${!showBarcode&&p.barcode?`<div style="font-size:8px;color:#555;font-weight:700;">${p.barcode}</div>`:''}
          ${showPrice?`<div style="font-size:${size.id==='small'?11:size.id==='medium'?14:18}px;font-weight:900;color:#1e40af;margin-top:2px;">Ksh ${(p.selling_price||0).toLocaleString()}</div>`:''}
          ${showOutlet?`<div style="font-size:7px;color:#888;margin-top:2px;">${activeOutlet?.outlet_name||''}</div>`:''}
        </div>`)
    ).join('');
    const html=`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Barcode Labels</title>
<link href="https://fonts.googleapis.com/css2?family=Libre+Barcode+128&display=swap" rel="stylesheet">
<style>@page{margin:8mm;}body{margin:0;padding:0;}.labels{display:flex;flex-wrap:wrap;gap:0;}@media print{body{margin:0;}}</style>
</head><body><div class="labels">${labelsHtml}</div></body></html>`;
    const w=window.open('','_blank');if(w){w.document.write(html);w.document.close();setTimeout(()=>w.print(),800);}
    toast.success(`Printing ${selectedProducts.length * copies} labels!`);
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center text-3xl shadow-lg shadow-gray-300">🏷️</div>
          <div><h1 className="text-2xl font-black text-gray-800">Barcode Label Printer</h1>
          <p className="text-sm text-gray-500 mt-0.5">Select products, configure and print shelf/price labels · {activeOutlet?.outlet_name}</p></div>
        </div>
        <button onClick={printLabels} disabled={selected.size===0} className="px-5 py-2.5 bg-gradient-to-r from-gray-700 to-gray-900 text-white rounded-xl font-bold text-sm transition-all shadow-md flex items-center gap-2 disabled:opacity-40">🖨️ Print {selected.size>0?`${selected.size * copies} Labels`:''}</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Label Settings Panel */}
        <div className="bg-white rounded-2xl border shadow-sm p-5 space-y-5">
          <h3 className="font-black text-sm text-gray-700 uppercase tracking-wider">⚙️ Label Settings</h3>

          <div>
            <p className="text-xs font-bold text-gray-500 uppercase mb-2">Label Size</p>
            <div className="space-y-2">
              {LABEL_SIZES.map(s=>(
                <label key={s.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${labelSize===s.id?'border-gray-700 bg-gray-50 ring-1 ring-gray-700':'border-gray-200 hover:border-gray-300'}`}>
                  <input type="radio" name="size" value={s.id} checked={labelSize===s.id} onChange={()=>setLabelSize(s.id)} className="accent-gray-700"/>
                  <div><p className="text-sm font-bold text-gray-700">{s.label}</p><p className="text-xs text-gray-400">{s.w}×{s.h}px preview</p></div>
                </label>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-bold text-gray-500 uppercase mb-2">Copies Per Product</p>
            <div className="flex items-center gap-3">
              <button onClick={()=>setCopies(c=>Math.max(1,c-1))} className="w-9 h-9 rounded-xl border border-gray-200 font-black text-gray-600 hover:bg-gray-50 flex items-center justify-center text-lg">−</button>
              <span className="text-2xl font-black text-gray-800 w-10 text-center">{copies}</span>
              <button onClick={()=>setCopies(c=>Math.min(50,c+1))} className="w-9 h-9 rounded-xl border border-gray-200 font-black text-gray-600 hover:bg-gray-50 flex items-center justify-center text-lg">+</button>
            </div>
          </div>

          <div>
            <p className="text-xs font-bold text-gray-500 uppercase mb-2">Label Content</p>
            <div className="space-y-2">
              {[{label:'Product Name',val:showName,set:setShowName},{label:'Barcode',val:showBarcode,set:setShowBarcode},{label:'Price (Ksh)',val:showPrice,set:setShowPrice},{label:'Outlet Name',val:showOutlet,set:setShowOutlet}].map(item=>(
                <label key={item.label} className="flex items-center gap-3 cursor-pointer">
                  <div onClick={()=>item.set(!item.val)} className={`w-10 h-6 rounded-full transition-all relative ${item.val?'bg-gray-800':'bg-gray-200'}`}>
                    <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${item.val?'left-5':'left-1'}`}/>
                  </div>
                  <span className="text-sm text-gray-700 font-medium">{item.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase mb-2">Preview</p>
            <div className="bg-gray-50 rounded-xl p-4 flex justify-center">
              <div style={{width:`${size.w/2}px`,height:`${size.h/2}px`}} className="border border-gray-400 flex flex-col items-center justify-center p-1 bg-white shadow-sm rounded">
                {showName&&<p className="text-[7px] font-bold text-center leading-tight truncate w-full text-center">Sample Product</p>}
                {showBarcode&&<p className="text-[16px] leading-none font-bold">|||||||</p>}
                {showBarcode&&<p className="text-[6px] text-gray-500">1234567890</p>}
                {showPrice&&<p className="text-[10px] font-black text-blue-600">Ksh 250</p>}
                {showOutlet&&<p className="text-[5px] text-gray-400">{activeOutlet?.outlet_name}</p>}
              </div>
            </div>
          </div>

          <div className="bg-gray-800 rounded-xl p-4 text-white">
            <p className="text-xs font-bold uppercase tracking-wider mb-1">Selected</p>
            <p className="text-3xl font-black">{selected.size} <span className="text-sm font-normal text-gray-300">products</span></p>
            <p className="text-sm text-gray-300 mt-0.5">{selected.size * copies} labels total</p>
          </div>
        </div>

        {/* Product List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl border p-4 flex flex-wrap items-center gap-3 shadow-sm">
            <div className="flex-1 relative min-w-[160px]">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
              <input value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} placeholder="Search product or barcode…" className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"/>
            </div>
            <select value={filterCat} onChange={e=>{setFilterCat(e.target.value);setPage(1);}} className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 bg-white">
              <option value="All">All Categories</option>
              {categories.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
            <button onClick={selectAll} className="px-4 py-2 bg-gray-800 text-white rounded-xl text-sm font-bold hover:bg-gray-700 transition-all">
              {selected.size===filtered.length&&filtered.length>0?'Deselect All':'Select All'}
            </button>
          </div>

          <div className="bg-white rounded-2xl border overflow-hidden shadow-sm">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-gray-50 to-slate-50 border-b">
                  <th className="py-3.5 px-4 text-left w-8"><input type="checkbox" checked={selected.size===filtered.length&&filtered.length>0} onChange={selectAll} className="rounded accent-gray-700"/></th>
                  <th className="text-left py-3.5 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Product</th>
                  <th className="text-left py-3.5 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Category</th>
                  <th className="text-left py-3.5 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Barcode</th>
                  <th className="text-right py-3.5 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading?(<tr><td colSpan={5} className="py-20 text-center"><div className="w-10 h-10 border-4 border-gray-400 border-t-transparent rounded-full animate-spin mx-auto"/></td></tr>)
                :paged.length===0?(<tr><td colSpan={5} className="py-20 text-center text-gray-400">No products found</td></tr>)
                :paged.map(p=>(
                  <tr key={p.pid} onClick={()=>toggleSelect(p.pid)} className={`cursor-pointer hover:bg-gray-50/80 transition-colors ${selected.has(p.pid)?'bg-gray-900/5':''}`}>
                    <td className="py-3 px-4"><input type="checkbox" checked={selected.has(p.pid)} onChange={()=>toggleSelect(p.pid)} onClick={e=>e.stopPropagation()} className="rounded accent-gray-700"/></td>
                    <td className="py-3 px-4 font-semibold text-sm text-gray-800">{p.product_name}</td>
                    <td className="py-3 px-4"><span className="px-2 py-0.5 bg-gray-100 rounded-md text-xs text-gray-500">{p.category||'Uncategorized'}</span></td>
                    <td className="py-3 px-4 font-mono text-xs text-gray-500">{p.barcode||<span className="text-red-400 italic">No barcode</span>}</td>
                    <td className="py-3 px-4 text-right font-bold text-sm text-blue-600">Ksh {(p.selling_price||0).toLocaleString()}</td>
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
                  {Array.from({length:Math.min(7,totalPages)},(_,i)=>{let pg=i+1;if(totalPages>7&&page>4)pg=page-3+i;if(pg<1||pg>totalPages)return null;return <button key={pg} onClick={()=>setPage(pg)} className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${pg===page?'bg-gray-800 text-white shadow-md':'hover:bg-gray-200 text-gray-600'}`}>{pg}</button>;})}
                  <button onClick={()=>setPage(p=>p+1)} disabled={page===totalPages} className="px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-30 hover:bg-gray-200">›</button>
                  <button onClick={()=>setPage(totalPages)} disabled={page===totalPages} className="px-2.5 py-1.5 rounded-lg text-xs font-bold disabled:opacity-30 hover:bg-gray-200">»</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
