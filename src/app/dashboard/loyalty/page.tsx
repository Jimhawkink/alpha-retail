'use client';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';
import toast from 'react-hot-toast';

interface LoyaltyCustomer { customer_id:number; name:string; phone:string; email:string; points:number; total_spent:number; tier:string; join_date:string; last_visit:string|null; visits:number; }
interface LoyaltyTxn { txn_id:number; customer_id:number; txn_type:'earn'|'redeem'; points:number; description:string; created_at:string; }
const PAGE_SIZE=20;
const TIERS=[{name:'Bronze',min:0,max:999,color:'bg-amber-700',text:'text-amber-700',bg:'bg-amber-50',icon:'🥉'},{name:'Silver',min:1000,max:4999,color:'bg-gray-400',text:'text-gray-600',bg:'bg-gray-50',icon:'🥈'},{name:'Gold',min:5000,max:19999,color:'bg-yellow-500',text:'text-yellow-700',bg:'bg-yellow-50',icon:'🥇'},{name:'Platinum',min:20000,max:Infinity,color:'bg-violet-500',text:'text-violet-700',bg:'bg-violet-50',icon:'💎'}];
const getTier=(points:number)=>TIERS.find(t=>points>=t.min&&points<=t.max)||TIERS[0];

export default function LoyaltyPage() {
  const { activeOutlet } = useOutlet();
  const outletId = activeOutlet?.outlet_id||1;
  const [customers, setCustomers] = useState<LoyaltyCustomer[]>([]);
  const [selected, setSelected] = useState<LoyaltyCustomer|null>(null);
  const [txns, setTxns] = useState<LoyaltyTxn[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingTxns, setLoadingTxns] = useState(false);
  const [search, setSearch] = useState('');
  const [filterTier, setFilterTier] = useState('All');
  const [page, setPage] = useState(1);
  const [showAdjust, setShowAdjust] = useState(false);
  const [adjustForm, setAdjustForm] = useState({type:'earn',points:0,description:''});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async()=>{
    setLoading(true);
    try {
      const { data } = await supabase.from('retail_loyalty_customers').select('*').eq('outlet_id',outletId).order('points',{ascending:false});
      setCustomers(data||[]);
    } catch { toast.error('Failed to load'); }
    setLoading(false);
  },[outletId]);

  const loadTxns = useCallback(async(c:LoyaltyCustomer)=>{
    setSelected(c);setLoadingTxns(true);
    const { data } = await supabase.from('retail_loyalty_transactions').select('*').eq('customer_id',c.customer_id).order('created_at',{ascending:false}).limit(50);
    setTxns(data||[]);setLoadingTxns(false);
  },[]);

  useEffect(()=>{load();},[load]);

  const adjustPoints=async()=>{
    if(!selected)return;
    if(!adjustForm.points||adjustForm.points<=0){toast.error('Enter points amount');return;}
    if(!adjustForm.description.trim()){toast.error('Enter description');return;}
    setSaving(true);
    try {
      const delta=adjustForm.type==='earn'?adjustForm.points:-adjustForm.points;
      await supabase.from('retail_loyalty_transactions').insert({customer_id:selected.customer_id,outlet_id:outletId,txn_type:adjustForm.type,points:adjustForm.points,description:adjustForm.description,created_at:new Date().toISOString()});
      await supabase.from('retail_loyalty_customers').update({points:Math.max(0,(selected.points||0)+delta)}).eq('customer_id',selected.customer_id);
      toast.success(`Points ${adjustForm.type==='earn'?'added':'redeemed'}!`);
      setShowAdjust(false);setAdjustForm({type:'earn',points:0,description:''});
      load();loadTxns({...selected,points:(selected.points||0)+delta});
    } catch { toast.error('Failed to adjust'); }
    setSaving(false);
  };

  const filtered=customers.filter(c=>{
    const mq=!search||(c.name||'').toLowerCase().includes(search.toLowerCase())||(c.phone||'').includes(search);
    const mt=filterTier==='All'||getTier(c.points||0).name===filterTier;
    return mq&&mt;
  });
  const totalPages=Math.ceil(filtered.length/PAGE_SIZE);
  const paged=filtered.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE);
  const totalPoints=customers.reduce((s,c)=>s+(c.points||0),0);
  const tierCounts=TIERS.map(t=>({...t,count:customers.filter(c=>getTier(c.points||0).name===t.name).length}));

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-yellow-400 to-amber-600 flex items-center justify-center text-3xl shadow-lg shadow-amber-200">⭐</div>
          <div><h1 className="text-2xl font-black text-gray-800">Customer Loyalty Program</h1>
          <p className="text-sm text-gray-500 mt-0.5">Points, tiers, rewards · Build customer retention · {activeOutlet?.outlet_name}</p></div>
        </div>
      </div>

      {/* Tier Overview */}
      <div className="grid grid-cols-4 gap-3">
        {tierCounts.map(t=>(
          <button key={t.name} onClick={()=>setFilterTier(filterTier===t.name?'All':t.name)} className={`bg-white rounded-2xl border p-4 text-left shadow-sm hover:shadow-md transition-all ${filterTier===t.name?'ring-2 ring-amber-400 ring-offset-2':''}`}>
            <div className="flex items-center gap-2 mb-2"><span className="text-2xl">{t.icon}</span><span className={`font-black text-sm ${t.text}`}>{t.name}</span></div>
            <p className="text-3xl font-black text-gray-800">{t.count}</p>
            <p className="text-xs text-gray-400 mt-1">{t.min.toLocaleString()}+ pts</p>
          </button>
        ))}
      </div>

      {/* KPI */}
      <div className="grid grid-cols-3 gap-4">
        {[
          {label:'Enrolled Customers',value:customers.length,icon:'👥',color:'border-l-amber-500',bg:'bg-amber-50',vc:'text-amber-700'},
          {label:'Total Points Issued',value:totalPoints.toLocaleString(),icon:'⭐',color:'border-l-yellow-500',bg:'bg-yellow-50',vc:'text-yellow-700'},
          {label:'Avg Points/Customer',value:customers.length>0?Math.round(totalPoints/customers.length).toLocaleString():'0',icon:'📊',color:'border-l-blue-500',bg:'bg-blue-50',vc:'text-blue-700'},
        ].map((c,i)=>(
          <div key={i} className={`bg-white rounded-2xl border-l-4 ${c.color} ${c.bg} p-5 shadow-sm`}>
            <div className="flex items-center gap-2 mb-2"><span className="text-xl">{c.icon}</span><p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{c.label}</p></div>
            <p className={`text-2xl font-black ${c.vc}`}>{c.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Customer List */}
        <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
          <div className="p-4 border-b bg-amber-50">
            <p className="font-bold text-sm text-gray-700 mb-3">Loyalty Members</p>
            <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by name or phone…" className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"/></div>
          </div>
          <div className="overflow-y-auto max-h-[520px] divide-y divide-gray-100">
            {loading?<div className="py-8 text-center text-gray-400">Loading…</div>
            :paged.map(c=>{
              const tier=getTier(c.points||0);
              return (
                <button key={c.customer_id} onClick={()=>loadTxns(c)} className={`w-full text-left p-4 hover:bg-amber-50/60 transition-colors ${selected?.customer_id===c.customer_id?'bg-amber-50 border-l-4 border-l-amber-500':''}`}>
                  <div className="flex items-start justify-between">
                    <div><p className="font-bold text-sm text-gray-800">{c.name}</p><p className="text-xs text-gray-400">{c.phone}</p></div>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${tier.bg} ${tier.text}`}>{tier.icon} {tier.name}</span>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex-1 bg-gray-100 rounded-full h-1.5 mr-2 overflow-hidden">
                      <div className="h-1.5 rounded-full bg-gradient-to-r from-amber-400 to-yellow-500" style={{width:`${Math.min(100,((c.points||0)/Math.max(totalPoints/customers.length||1,1))*100)}%`}}/>
                    </div>
                    <span className="text-xs font-black text-amber-600">⭐ {(c.points||0).toLocaleString()}</span>
                  </div>
                </button>
              );
            })}
          </div>
          {totalPages>1&&(
            <div className="p-3 border-t flex justify-center gap-1">
              <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1} className="px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-30 hover:bg-gray-100">‹</button>
              <span className="px-3 py-1.5 text-xs text-gray-500">{page}/{totalPages}</span>
              <button onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages} className="px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-30 hover:bg-gray-100">›</button>
            </div>
          )}
        </div>

        {/* Customer Detail */}
        <div className="lg:col-span-2 space-y-4">
          {!selected?(<div className="bg-white rounded-2xl border p-16 text-center shadow-sm"><div className="text-6xl mb-4">⭐</div><p className="font-bold text-gray-700">Select a customer to view their loyalty details</p></div>)
          :(
            <>
              <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                {(() => { const tier=getTier(selected.points||0); const nextTier=TIERS[TIERS.indexOf(tier)+1]; const ptsToNext=nextTier?nextTier.min-(selected.points||0):0; return (
                  <div>
                    <div className={`p-6 ${tier.bg}`}>
                      <div className="flex items-start justify-between">
                        <div>
                          <p className={`text-xs font-bold uppercase tracking-wider ${tier.text}`}>{tier.icon} {tier.name} Member</p>
                          <h3 className="text-2xl font-black text-gray-800 mt-1">{selected.name}</h3>
                          <p className="text-gray-500 text-sm">{selected.phone}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-4xl font-black text-amber-600">{(selected.points||0).toLocaleString()}</p>
                          <p className="text-xs text-gray-400">points balance</p>
                        </div>
                      </div>
                      {nextTier&&<div className="mt-4">
                        <div className="flex justify-between text-xs mb-1"><span className="text-gray-500">Progress to {nextTier.name}</span><span className="font-bold">{ptsToNext} pts to go</span></div>
                        <div className="h-2 bg-white/60 rounded-full overflow-hidden"><div className={`h-2 rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 transition-all`} style={{width:`${Math.min(100,((selected.points||0)-tier.min)/(nextTier.min-tier.min)*100)}%`}}/></div>
                      </div>}
                    </div>
                    <div className="p-4 flex items-center justify-between border-b bg-white">
                      <div className="flex gap-4 text-sm text-gray-500">
                        <span>Total Spent: <strong className="text-gray-800">Ksh {(selected.total_spent||0).toLocaleString()}</strong></span>
                        <span>Visits: <strong className="text-gray-800">{selected.visits||0}</strong></span>
                        {selected.last_visit&&<span>Last Visit: <strong className="text-gray-800">{selected.last_visit}</strong></span>}
                      </div>
                      <button onClick={()=>setShowAdjust(true)} className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-bold transition-all">⭐ Adjust Points</button>
                    </div>
                  </div>
                );})()}

                {/* Point Adjust Panel */}
                {showAdjust&&(
                  <div className="p-4 bg-amber-50 border-b">
                    <p className="font-bold text-sm text-gray-700 mb-3">Adjust Points for {selected.name}</p>
                    <div className="flex gap-3">
                      <select value={adjustForm.type} onChange={e=>setAdjustForm({...adjustForm,type:e.target.value})} className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white">
                        <option value="earn">+ Add Points</option><option value="redeem">- Redeem Points</option>
                      </select>
                      <input type="number" value={adjustForm.points||''} onChange={e=>setAdjustForm({...adjustForm,points:Number(e.target.value)})} placeholder="Points" min="1" className="w-28 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"/>
                      <input value={adjustForm.description} onChange={e=>setAdjustForm({...adjustForm,description:e.target.value})} placeholder="Reason…" className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"/>
                      <button onClick={adjustPoints} disabled={saving} className="px-4 py-2 bg-amber-500 text-white rounded-xl text-sm font-bold hover:bg-amber-600 transition-all disabled:opacity-60">{saving?'…':'Apply'}</button>
                      <button onClick={()=>setShowAdjust(false)} className="px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-500 hover:bg-white transition-colors">✕</button>
                    </div>
                  </div>
                )}

                {/* Transaction History */}
                <div className="divide-y divide-gray-100">
                  <div className="px-4 py-3 bg-gray-50"><p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Recent Point Transactions</p></div>
                  {loadingTxns?<div className="py-8 text-center"><div className="w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto"/></div>
                  :txns.length===0?<div className="py-8 text-center text-gray-400 text-sm">No transactions yet</div>
                  :txns.map(t=>(
                    <div key={t.txn_id} className="px-4 py-3 flex items-center justify-between hover:bg-gray-50/60">
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{t.description}</p>
                        <p className="text-xs text-gray-400">{t.created_at?.split('T')[0]}</p>
                      </div>
                      <span className={`font-black text-sm ${t.txn_type==='earn'?'text-emerald-600':'text-red-500'}`}>{t.txn_type==='earn'?'+':'-'}{t.points} pts</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
