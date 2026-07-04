'use client';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';
import toast from 'react-hot-toast';

interface Promo { promo_id:number; promo_name:string; promo_type:'percentage'|'fixed'|'buy_x_get_y'|'bundle'; discount_value:number; min_purchase:number; start_date:string; end_date:string; status:'active'|'expired'|'draft'; times_used:number; total_discount_given:number; products:string; }
const TYPES=['percentage','fixed','buy_x_get_y','bundle'];
const STATUS_CFG={active:{label:'Active',bg:'bg-emerald-100',text:'text-emerald-700'},expired:{label:'Expired',bg:'bg-gray-100',text:'text-gray-500'},draft:{label:'Draft',bg:'bg-amber-100',text:'text-amber-700'}};

const EMPTY:Omit<Promo,'promo_id'|'times_used'|'total_discount_given'>={promo_name:'',promo_type:'percentage',discount_value:0,min_purchase:0,start_date:new Date().toISOString().split('T')[0],end_date:'',status:'draft',products:''};

export default function PromotionsPage() {
  const { activeOutlet } = useOutlet();
  const outletId = activeOutlet?.outlet_id||1;
  const [promos, setPromos] = useState<Promo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<any>({...EMPTY});
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<number|null>(null);
  const [filterStatus, setFilterStatus] = useState('All');
  const [search, setSearch] = useState('');

  const load = useCallback(async()=>{
    setLoading(true);
    try {
      const { data } = await supabase.from('retail_promotions').select('*').eq('outlet_id',outletId).order('created_at',{ascending:false});
      // Auto-update status based on dates
      const today=new Date().toISOString().split('T')[0];
      const updated=(data||[]).map((p:any)=>{
        let status=p.status;
        if(status!=='draft'&&p.end_date&&p.end_date<today)status='expired';
        else if(status!=='draft'&&p.start_date<=today)status='active';
        return {...p,status};
      });
      setPromos(updated);
    } catch { toast.error('Failed to load'); }
    setLoading(false);
  },[outletId]);

  useEffect(()=>{load();},[load]);

  const save=async()=>{
    if(!form.promo_name.trim()){toast.error('Promotion name required');return;}
    if(!form.discount_value||form.discount_value<=0){toast.error('Discount value required');return;}
    setSaving(true);
    try {
      const payload={...form,outlet_id:outletId};
      if(editId){
        await supabase.from('retail_promotions').update(payload).eq('promo_id',editId);
        toast.success('Promotion updated!');
      } else {
        await supabase.from('retail_promotions').insert(payload);
        toast.success('Promotion created!');
      }
      setShowForm(false);setEditId(null);setForm({...EMPTY});load();
    } catch { toast.error('Failed to save'); }
    setSaving(false);
  };

  const del=async(id:number)=>{
    if(!confirm('Delete this promotion?'))return;
    await supabase.from('retail_promotions').delete().eq('promo_id',id);
    toast.success('Deleted');load();
  };

  const edit=(p:Promo)=>{setEditId(p.promo_id);setForm({...p});setShowForm(true);};

  const filtered=promos.filter(p=>{
    const ms=filterStatus==='All'||p.status===filterStatus;
    const mq=!search||p.promo_name.toLowerCase().includes(search.toLowerCase());
    return ms&&mq;
  });

  const activeCount=promos.filter(p=>p.status==='active').length;
  const totalSaved=promos.reduce((s,p)=>s+(p.total_discount_given||0),0);

  const typeLabel=(t:string)=>({percentage:'% Off',fixed:'Fixed Ksh Off',buy_x_get_y:'Buy X Get Y',bundle:'Bundle Deal'}[t]||t);

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center text-3xl shadow-lg shadow-pink-200">🎁</div>
          <div><h1 className="text-2xl font-black text-gray-800">Promotions Manager</h1>
          <p className="text-sm text-gray-500 mt-0.5">Create & manage discounts, offers and deals · {activeOutlet?.outlet_name}</p></div>
        </div>
        <button onClick={()=>{setShowForm(true);setEditId(null);setForm({...EMPTY});}} className="px-5 py-2.5 bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 text-white rounded-xl font-bold text-sm transition-all shadow-md shadow-pink-200 flex items-center gap-2">+ New Promotion</button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          {label:'Active Promotions',value:activeCount,icon:'✅',color:'border-l-emerald-500',bg:'bg-emerald-50',vc:'text-emerald-700'},
          {label:'Total Promotions',value:promos.length,icon:'🎁',color:'border-l-pink-500',bg:'bg-pink-50',vc:'text-pink-700'},
          {label:'Total Savings Given',value:`Ksh ${Math.round(totalSaved).toLocaleString()}`,icon:'💰',color:'border-l-blue-500',bg:'bg-blue-50',vc:'text-blue-700'},
        ].map((c,i)=>(
          <div key={i} className={`bg-white rounded-2xl border-l-4 ${c.color} ${c.bg} p-5 shadow-sm`}>
            <div className="flex items-center gap-2 mb-2"><span className="text-xl">{c.icon}</span><p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{c.label}</p></div>
            <p className={`text-3xl font-black ${c.vc}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Form Modal */}
      {showForm&&(
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="bg-gradient-to-r from-pink-500 to-rose-600 p-6">
              <h2 className="text-xl font-black text-white">{editId?'Edit Promotion':'New Promotion'}</h2>
              <p className="text-pink-100 text-sm mt-0.5">Fill in the promotion details below</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5 block">Promotion Name *</label>
                <input value={form.promo_name} onChange={e=>setForm({...form,promo_name:e.target.value})} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-pink-400" placeholder="e.g., Weekend Flash Sale"/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5 block">Type</label>
                  <select value={form.promo_type} onChange={e=>setForm({...form,promo_type:e.target.value})} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-pink-400 bg-white">
                    {TYPES.map(t=><option key={t} value={t}>{typeLabel(t)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5 block">Discount Value {form.promo_type==='percentage'?'(%)':'(Ksh)'}</label>
                  <input type="number" value={form.discount_value} onChange={e=>setForm({...form,discount_value:Number(e.target.value)})} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-pink-400" min="0"/>
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5 block">Minimum Purchase (Ksh)</label>
                <input type="number" value={form.min_purchase} onChange={e=>setForm({...form,min_purchase:Number(e.target.value)})} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-pink-400" min="0"/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5 block">Start Date</label>
                  <input type="date" value={form.start_date} onChange={e=>setForm({...form,start_date:e.target.value})} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-pink-400"/>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5 block">End Date</label>
                  <input type="date" value={form.end_date} onChange={e=>setForm({...form,end_date:e.target.value})} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-pink-400"/>
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5 block">Applicable Products (optional, comma-separated)</label>
                <input value={form.products} onChange={e=>setForm({...form,products:e.target.value})} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-pink-400" placeholder="Leave blank for all products"/>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5 block">Status</label>
                <select value={form.status} onChange={e=>setForm({...form,status:e.target.value})} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-pink-400 bg-white">
                  <option value="draft">Draft</option><option value="active">Active</option><option value="expired">Expired</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 p-6 pt-0">
              <button onClick={()=>{setShowForm(false);setEditId(null);}} className="flex-1 py-3 border border-gray-200 rounded-xl font-semibold text-sm text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={save} disabled={saving} className="flex-1 py-3 bg-gradient-to-r from-pink-500 to-rose-600 text-white rounded-xl font-bold text-sm hover:from-pink-600 hover:to-rose-700 transition-all disabled:opacity-60">{saving?'Saving…':editId?'Update Promotion':'Create Promotion'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-2xl border p-4 flex flex-wrap items-center gap-3 shadow-sm">
        <div className="flex bg-gray-100 rounded-xl p-1 gap-0.5">
          {['All','active','draft','expired'].map(s=>(
            <button key={s} onClick={()=>setFilterStatus(s)} className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${filterStatus===s?'bg-white text-pink-600 shadow-sm':'text-gray-500 hover:text-gray-700'}`}>{s==='active'?'✅ Active':s==='draft'?'📝 Draft':s==='expired'?'❌ Expired':'All'}</button>
          ))}
        </div>
        <div className="flex-1 relative min-w-[160px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search promotion…" className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-pink-400"/>
        </div>
      </div>

      {/* Grid Cards */}
      {loading?(<div className="flex justify-center py-16"><div className="w-12 h-12 border-4 border-pink-400 border-t-transparent rounded-full animate-spin"/></div>)
      :filtered.length===0?(<div className="bg-white rounded-2xl border p-16 text-center shadow-sm"><div className="text-6xl mb-4">🎁</div><p className="font-bold text-gray-700 text-lg">No promotions yet</p><p className="text-gray-400 text-sm mt-2">Create your first promotion to boost sales</p><button onClick={()=>setShowForm(true)} className="mt-4 px-5 py-2.5 bg-pink-500 text-white rounded-xl font-bold text-sm hover:bg-pink-600 transition-all">+ Create Promotion</button></div>)
      :<div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(p=>{
          const cfg=STATUS_CFG[p.status]||STATUS_CFG.draft;
          const today=new Date().toISOString().split('T')[0];
          const daysLeft=p.end_date?Math.max(0,Math.ceil((new Date(p.end_date).getTime()-Date.now())/86400000)):null;
          return (
            <div key={p.promo_id} className={`bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all overflow-hidden ${p.status==='active'?'ring-1 ring-emerald-300':''}`}>
              <div className={`p-5 ${p.status==='active'?'bg-gradient-to-r from-pink-50 to-rose-50':p.status==='draft'?'bg-amber-50':'bg-gray-50'}`}>
                <div className="flex items-start justify-between mb-3">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${cfg.bg} ${cfg.text}`}>{cfg.label}</span>
                  <div className="flex gap-1">
                    <button onClick={()=>edit(p)} className="p-1.5 hover:bg-white rounded-lg transition-colors text-gray-400 hover:text-blue-600">✏️</button>
                    <button onClick={()=>del(p.promo_id)} className="p-1.5 hover:bg-white rounded-lg transition-colors text-gray-400 hover:text-red-600">🗑️</button>
                  </div>
                </div>
                <h3 className="font-black text-lg text-gray-800">{p.promo_name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="px-2 py-0.5 bg-white/80 rounded-md text-xs font-semibold text-gray-600">{typeLabel(p.promo_type)}</span>
                  <span className="text-2xl font-black text-pink-600">{p.promo_type==='percentage'?`${p.discount_value}% OFF`:`Ksh ${(p.discount_value||0).toLocaleString()} OFF`}</span>
                </div>
              </div>
              <div className="p-4 space-y-2 text-sm text-gray-500">
                {p.min_purchase>0&&<div className="flex items-center justify-between"><span>Min purchase</span><span className="font-semibold text-gray-700">Ksh {p.min_purchase.toLocaleString()}</span></div>}
                <div className="flex items-center justify-between"><span>Valid</span><span className="font-semibold text-gray-700">{p.start_date} → {p.end_date||'No end'}</span></div>
                {daysLeft!==null&&p.status==='active'&&<div className="flex items-center justify-between"><span>Days remaining</span><span className={`font-black ${daysLeft<=3?'text-red-500':daysLeft<=7?'text-amber-600':'text-emerald-600'}`}>{daysLeft} days</span></div>}
                {p.times_used>0&&<div className="flex items-center justify-between"><span>Times used</span><span className="font-semibold text-gray-700">{p.times_used} times</span></div>}
                {p.total_discount_given>0&&<div className="flex items-center justify-between"><span>Total saved by customers</span><span className="font-bold text-rose-600">Ksh {Math.round(p.total_discount_given).toLocaleString()}</span></div>}
                {p.products&&<div className="flex items-start justify-between gap-2"><span>Products</span><span className="font-semibold text-gray-700 text-right text-xs">{p.products}</span></div>}
              </div>
            </div>
          );
        })}
      </div>}
    </div>
  );
}
