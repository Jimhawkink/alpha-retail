'use client';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';
import toast from 'react-hot-toast';

interface PettyCash { id:number; txn_date:string; description:string; category:string; amount:number; txn_type:'in'|'out'; reference:string; approved_by:string; created_by:string; balance_after:number; }
const PAGE_SIZE=25;
const CATEGORIES=['Office Supplies','Transport','Cleaning','Utilities','Staff Welfare','Repairs','Miscellaneous','Marketing','Entertainment','Communication'];

export default function PettyCashPage() {
  const { activeOutlet } = useOutlet();
  const outletId = activeOutlet?.outlet_id||1;
  const [txns, setTxns] = useState<PettyCash[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({txn_date:new Date().toISOString().split('T')[0],description:'',category:'Office Supplies',amount:'',txn_type:'out',reference:'',approved_by:''});
  const [dateFrom, setDateFrom] = useState(()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`;});
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [filterType, setFilterType] = useState('All');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [fundAmount, setFundAmount] = useState(0);

  const load = useCallback(async()=>{
    setLoading(true);
    try {
      const { data } = await supabase.from('retail_petty_cash').select('*').eq('outlet_id',outletId).gte('txn_date',dateFrom).lte('txn_date',dateTo).order('txn_date',{ascending:false}).order('created_at',{ascending:false});
      // Compute running balance
      const sorted=[...(data||[])].sort((a:any,b:any)=>a.txn_date.localeCompare(b.txn_date)||a.id-b.id);
      let bal=fundAmount;
      const withBal=sorted.map((t:any)=>{bal+=t.txn_type==='in'?t.amount:-t.amount;return{...t,balance_after:bal};});
      setTxns(withBal.reverse());
      setPage(1);
    } catch { toast.error('Failed to load'); }
    setLoading(false);
  },[outletId,dateFrom,dateTo,fundAmount]);

  useEffect(()=>{load();},[load]);

  const save=async()=>{
    if(!form.description.trim()){toast.error('Enter description');return;}
    if(!form.amount||Number(form.amount)<=0){toast.error('Enter valid amount');return;}
    setSaving(true);
    try {
      await supabase.from('retail_petty_cash').insert({outlet_id:outletId,txn_date:form.txn_date,description:form.description,category:form.category,amount:Number(form.amount),txn_type:form.txn_type,reference:form.reference,approved_by:form.approved_by,created_at:new Date().toISOString()});
      toast.success(`${form.txn_type==='in'?'Fund received':'Expense recorded'}!`);
      setShowForm(false);setForm({txn_date:new Date().toISOString().split('T')[0],description:'',category:'Office Supplies',amount:'',txn_type:'out',reference:'',approved_by:''});
      load();
    } catch { toast.error('Failed to save'); }
    setSaving(false);
  };

  const filtered=txns.filter(t=>{
    const mt=filterType==='All'||t.txn_type===filterType;
    const ms=!search||(t.description||'').toLowerCase().includes(search.toLowerCase())||(t.category||'').toLowerCase().includes(search.toLowerCase());
    return mt&&ms;
  });
  const totalPages=Math.ceil(filtered.length/PAGE_SIZE);
  const paged=filtered.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE);
  const totalIn=txns.filter(t=>t.txn_type==='in').reduce((s,t)=>s+t.amount,0);
  const totalOut=txns.filter(t=>t.txn_type==='out').reduce((s,t)=>s+t.amount,0);
  const balance=fundAmount+totalIn-totalOut;

  // Category breakdown
  const catMap:Record<string,number>={};
  txns.filter(t=>t.txn_type==='out').forEach(t=>{catMap[t.category]=(catMap[t.category]||0)+t.amount;});
  const catList=Object.entries(catMap).sort(([,a],[,b])=>b-a);

  const exportCSV=()=>{
    const rows=[['Date','Description','Category','Type','Amount','Reference','Approved By']];
    filtered.forEach(t=>rows.push([t.txn_date,t.description,t.category,t.txn_type,String(t.amount),t.reference||'',t.approved_by||'']));
    const blob=new Blob([rows.map(r=>r.join(',')).join('\n')],{type:'text/csv'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`petty_cash_${dateFrom}_${dateTo}.csv`;a.click();
    toast.success('Exported!');
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-lime-500 to-green-600 flex items-center justify-center text-3xl shadow-lg shadow-lime-200">💵</div>
          <div><h1 className="text-2xl font-black text-gray-800">Petty Cash Book</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track daily cash expenses · Fund management · {activeOutlet?.outlet_name}</p></div>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-semibold text-sm transition-all">📥 Export</button>
          <button onClick={()=>setShowForm(true)} className="px-5 py-2.5 bg-gradient-to-r from-lime-500 to-green-600 text-white rounded-xl font-bold text-sm transition-all shadow-md">+ Add Entry</button>
        </div>
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {label:'Opening Fund',value:`Ksh ${fundAmount.toLocaleString()}`,icon:'🏦',color:'border-l-blue-500',bg:'bg-blue-50',vc:'text-blue-700'},
          {label:'Total Received',value:`Ksh ${Math.round(totalIn).toLocaleString()}`,icon:'📥',color:'border-l-emerald-500',bg:'bg-emerald-50',vc:'text-emerald-700'},
          {label:'Total Spent',value:`Ksh ${Math.round(totalOut).toLocaleString()}`,icon:'📤',color:'border-l-red-500',bg:'bg-red-50',vc:'text-red-600'},
          {label:'Current Balance',value:`Ksh ${Math.round(balance).toLocaleString()}`,icon:'💵',color:balance>=0?'border-l-lime-500':'border-l-red-500',bg:balance>=0?'bg-lime-50':'bg-red-50',vc:balance>=0?'text-lime-700':'text-red-600'},
        ].map((c,i)=>(
          <div key={i} className={`bg-white rounded-2xl border-l-4 ${c.color} ${c.bg} p-5 shadow-sm`}>
            <div className="flex items-center gap-2 mb-2"><span className="text-xl">{c.icon}</span><p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{c.label}</p></div>
            <p className={`text-2xl font-black ${c.vc}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Category Breakdown */}
      {catList.length>0&&(
        <div className="bg-white rounded-2xl border p-5 shadow-sm">
          <h3 className="text-sm font-bold text-gray-700 mb-4 uppercase tracking-wider">📊 Expense by Category</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {catList.slice(0,8).map(([cat,amt])=>(
              <div key={cat} className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs font-bold text-gray-500 truncate">{cat}</p>
                <p className="text-lg font-black text-gray-800 mt-1">Ksh {Math.round(amt).toLocaleString()}</p>
                <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden"><div className="h-1.5 rounded-full bg-gradient-to-r from-lime-500 to-green-500" style={{width:`${totalOut>0?(amt/totalOut)*100:0}%`}}/></div>
                <p className="text-xs text-gray-400 mt-1">{totalOut>0?((amt/totalOut)*100).toFixed(1):0}% of total</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Form Modal */}
      {showForm&&(
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-gradient-to-r from-lime-500 to-green-600 p-6">
              <h2 className="text-xl font-black text-white">New Petty Cash Entry</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex bg-gray-100 rounded-xl p-1 gap-0.5">
                {[{l:'💸 Expense (Out)',v:'out'},{l:'📥 Receive Funds (In)',v:'in'}].map(t=>(
                  <button key={t.v} onClick={()=>setForm({...form,txn_type:t.v})} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${form.txn_type===t.v?'bg-white text-green-700 shadow-sm':'text-gray-500'}`}>{t.l}</button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-600 uppercase mb-1.5 block">Date</label>
                  <input type="date" value={form.txn_date} onChange={e=>setForm({...form,txn_date:e.target.value})} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-lime-400"/>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-600 uppercase mb-1.5 block">Amount (Ksh)</label>
                  <input type="number" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})} min="0" step="0.01" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-lime-400" placeholder="0.00"/>
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600 uppercase mb-1.5 block">Description *</label>
                <input value={form.description} onChange={e=>setForm({...form,description:e.target.value})} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-lime-400" placeholder="What was this expense for?"/>
              </div>
              {form.txn_type==='out'&&<div>
                <label className="text-xs font-bold text-gray-600 uppercase mb-1.5 block">Category</label>
                <select value={form.category} onChange={e=>setForm({...form,category:e.target.value})} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-lime-400 bg-white">
                  {CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </div>}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-600 uppercase mb-1.5 block">Reference</label>
                  <input value={form.reference} onChange={e=>setForm({...form,reference:e.target.value})} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-lime-400" placeholder="Receipt no."/>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-600 uppercase mb-1.5 block">Approved By</label>
                  <input value={form.approved_by} onChange={e=>setForm({...form,approved_by:e.target.value})} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-lime-400" placeholder="Manager name"/>
                </div>
              </div>
            </div>
            <div className="flex gap-3 p-6 pt-0">
              <button onClick={()=>setShowForm(false)} className="flex-1 py-3 border border-gray-200 rounded-xl font-semibold text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={save} disabled={saving} className="flex-1 py-3 bg-gradient-to-r from-lime-500 to-green-600 text-white rounded-xl font-bold text-sm disabled:opacity-60">{saving?'Saving…':'Save Entry'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-2xl border p-4 flex flex-wrap items-center gap-3 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-600">Opening Fund: Ksh</span>
          <input type="number" value={fundAmount||''} onChange={e=>setFundAmount(Number(e.target.value))} className="w-28 px-3 py-1.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-lime-400" placeholder="0"/>
        </div>
        <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-lime-400"/>
        <span className="text-gray-400">→</span>
        <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-lime-400"/>
        <div className="flex bg-gray-100 rounded-xl p-1 gap-0.5">
          {['All','in','out'].map(t=><button key={t} onClick={()=>setFilterType(t)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filterType===t?'bg-white text-green-700 shadow-sm':'text-gray-500 hover:text-gray-700'}`}>{t==='in'?'📥 Received':t==='out'?'📤 Expenses':'All'}</button>)}
        </div>
        <div className="flex-1 relative min-w-[160px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
          <input value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} placeholder="Search…" className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-lime-400"/>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-white rounded-2xl border overflow-hidden shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="bg-gradient-to-r from-lime-50 to-green-50 border-b">
              {['Date','Description','Category','Reference','Approved By','Received','Spent','Balance'].map(h=>(
                <th key={h} className={`py-3.5 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider ${['Received','Spent','Balance'].includes(h)?'text-right':'text-left'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading?(<tr><td colSpan={8} className="py-20 text-center"><div className="w-10 h-10 border-4 border-lime-400 border-t-transparent rounded-full animate-spin mx-auto"/></td></tr>)
            :paged.length===0?(<tr><td colSpan={8} className="py-20 text-center text-gray-400">No petty cash entries found</td></tr>)
            :paged.map((t,i)=>(
              <tr key={t.id||i} className={`hover:bg-gray-50/60 transition-colors ${t.txn_type==='in'?'bg-emerald-50/20':''}`}>
                <td className="py-3 px-4 text-sm text-gray-600">{t.txn_date}</td>
                <td className="py-3 px-4 font-semibold text-sm text-gray-800">{t.description}</td>
                <td className="py-3 px-4"><span className="px-2 py-0.5 bg-gray-100 rounded-md text-xs text-gray-500">{t.category||'—'}</span></td>
                <td className="py-3 px-4 text-sm text-gray-400">{t.reference||'—'}</td>
                <td className="py-3 px-4 text-sm text-gray-500">{t.approved_by||'—'}</td>
                <td className="py-3 px-4 text-right font-bold text-sm text-emerald-600">{t.txn_type==='in'?`Ksh ${t.amount.toLocaleString()}`:'—'}</td>
                <td className="py-3 px-4 text-right font-bold text-sm text-red-500">{t.txn_type==='out'?`Ksh ${t.amount.toLocaleString()}`:'—'}</td>
                <td className="py-3 px-4 text-right"><span className={`font-black text-sm ${t.balance_after>=0?'text-gray-800':'text-red-600'}`}>Ksh {Math.round(t.balance_after||0).toLocaleString()}</span></td>
              </tr>
            ))}
          </tbody>
          {filtered.length>0&&<tfoot><tr className="bg-gradient-to-r from-lime-50 to-green-50 border-t font-bold"><td colSpan={5} className="py-3 px-4 text-sm text-gray-600">TOTALS</td><td className="py-3 px-4 text-right text-sm text-emerald-700">Ksh {Math.round(totalIn).toLocaleString()}</td><td className="py-3 px-4 text-right text-sm text-red-600">Ksh {Math.round(totalOut).toLocaleString()}</td><td className="py-3 px-4 text-right text-sm"><span className={balance>=0?'text-lime-700 font-black':'text-red-600 font-black'}>Ksh {Math.round(balance).toLocaleString()}</span></td></tr></tfoot>}
        </table>
        {totalPages>1&&(
          <div className="flex items-center justify-between px-4 py-3.5 border-t bg-gray-50/50">
            <p className="text-sm text-gray-500">Showing <strong>{(page-1)*PAGE_SIZE+1}–{Math.min(page*PAGE_SIZE,filtered.length)}</strong> of <strong>{filtered.length}</strong></p>
            <div className="flex items-center gap-1">
              <button onClick={()=>setPage(1)} disabled={page===1} className="px-2.5 py-1.5 rounded-lg text-xs font-bold disabled:opacity-30 hover:bg-gray-200">«</button>
              <button onClick={()=>setPage(p=>p-1)} disabled={page===1} className="px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-30 hover:bg-gray-200">‹</button>
              {Array.from({length:Math.min(7,totalPages)},(_,i)=>{let pg=i+1;if(totalPages>7&&page>4)pg=page-3+i;if(pg<1||pg>totalPages)return null;return <button key={pg} onClick={()=>setPage(pg)} className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${pg===page?'bg-lime-500 text-white shadow-md':'hover:bg-gray-200 text-gray-600'}`}>{pg}</button>;})}
              <button onClick={()=>setPage(p=>p+1)} disabled={page===totalPages} className="px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-30 hover:bg-gray-200">›</button>
              <button onClick={()=>setPage(totalPages)} disabled={page===totalPages} className="px-2.5 py-1.5 rounded-lg text-xs font-bold disabled:opacity-30 hover:bg-gray-200">»</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
