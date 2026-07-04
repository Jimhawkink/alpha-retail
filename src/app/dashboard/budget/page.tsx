'use client';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';
import toast from 'react-hot-toast';

interface BudgetLine { id:number; category:string; budget_month:string; budgeted:number; actual:number; variance:number; variance_pct:number; }
const CATEGORIES=['Sales Revenue','Cost of Goods Sold','Gross Profit','Salaries & Wages','Rent & Utilities','Marketing & Advertising','Transport & Delivery','Office & Supplies','Equipment Maintenance','Petty Cash','Other Expenses'];
const PAGE_SIZE=20;

export default function BudgetPage() {
  const { activeOutlet } = useOutlet();
  const outletId = activeOutlet?.outlet_id||1;
  const [lines, setLines] = useState<BudgetLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(()=>new Date().toISOString().slice(0,7));
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({category:CATEGORIES[0],budgeted:''});
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<number|null>(null);
  const [editBudget, setEditBudget] = useState('');

  const load = useCallback(async()=>{
    setLoading(true);
    try {
      const { data: budget } = await supabase.from('retail_budgets').select('*').eq('outlet_id',outletId).eq('budget_month',selectedMonth).order('category');
      // Pull actuals
      const [yr,mo]=selectedMonth.split('-');
      const from=`${yr}-${mo}-01`;
      const lastDay=new Date(Number(yr),Number(mo),0).getDate();
      const to=`${yr}-${mo}-${lastDay}`;
      const [{ data: sales },{ data: expenses },{ data: purchases }] = await Promise.all([
        supabase.from('retail_sales').select('total_amount,profit,status').eq('outlet_id',outletId).gte('sale_date',from).lte('sale_date',to).eq('status','Completed'),
        supabase.from('retail_expenses').select('amount,category').eq('outlet_id',outletId).gte('expense_date',from).lte('expense_date',to),
        supabase.from('retail_purchases').select('grand_total').eq('outlet_id',outletId).gte('purchase_date',from).lte('purchase_date',to),
      ]);
      const totalRevenue=(sales||[]).reduce((s:number,r:any)=>s+(r.total_amount||0),0);
      const totalCOGS=(purchases||[]).reduce((s:number,r:any)=>s+(r.grand_total||0),0);
      const totalGP=(sales||[]).reduce((s:number,r:any)=>s+(r.profit||0),0);
      const expenseByCategory:Record<string,number>={};
      (expenses||[]).forEach((e:any)=>{expenseByCategory[e.category]=(expenseByCategory[e.category]||0)+(e.amount||0);});
      const totalExpenses=(expenses||[]).reduce((s:number,e:any)=>s+(e.amount||0),0);

      const actuals:Record<string,number>={
        'Sales Revenue':totalRevenue,'Cost of Goods Sold':totalCOGS,'Gross Profit':totalGP,
        ...Object.fromEntries(Object.entries(expenseByCategory)),
        'Other Expenses':expenseByCategory['Other']||0,
      };

      const result:BudgetLine[]=(budget||[]).map((b:any)=>{
        const actual=actuals[b.category]||0;
        const variance=b.category==='Sales Revenue'||b.category==='Gross Profit'?actual-b.budgeted:b.budgeted-actual;
        return {...b,actual,variance,variance_pct:b.budgeted>0?(variance/b.budgeted)*100:0};
      });
      setLines(result);
    } catch { toast.error('Failed to load'); }
    setLoading(false);
  },[outletId,selectedMonth]);

  useEffect(()=>{load();},[load]);

  const save=async()=>{
    if(!form.budgeted||Number(form.budgeted)<=0){toast.error('Enter budget amount');return;}
    setSaving(true);
    try {
      const exists=lines.find(l=>l.category===form.category);
      if(exists){await supabase.from('retail_budgets').update({budgeted:Number(form.budgeted)}).eq('id',exists.id);}
      else{await supabase.from('retail_budgets').insert({outlet_id:outletId,category:form.category,budget_month:selectedMonth,budgeted:Number(form.budgeted)});}
      toast.success('Budget saved!');setShowForm(false);setForm({category:CATEGORIES[0],budgeted:''});load();
    } catch { toast.error('Failed'); }
    setSaving(false);
  };

  const saveEdit=async(id:number)=>{
    if(!editBudget||Number(editBudget)<=0){toast.error('Enter valid amount');return;}
    await supabase.from('retail_budgets').update({budgeted:Number(editBudget)}).eq('id',id);
    toast.success('Updated!');setEditId(null);load();
  };

  const totalBudgeted=lines.filter(l=>CATEGORIES.slice(3).includes(l.category)).reduce((s,l)=>s+l.budgeted,0);
  const totalActual=lines.filter(l=>CATEGORIES.slice(3).includes(l.category)).reduce((s,l)=>s+l.actual,0);
  const revLine=lines.find(l=>l.category==='Sales Revenue');
  const gpLine=lines.find(l=>l.category==='Gross Profit');
  const overBudget=lines.filter(l=>l.variance<0&&!['Sales Revenue','Gross Profit'].includes(l.category)).length;

  const fmtMonth=(m:string)=>{const [y,mo]=m.split('-');const n=['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];return `${n[parseInt(mo)]} ${y}`;};

  const months=Array.from({length:12},(_,i)=>{const d=new Date();d.setMonth(d.getMonth()-i);return d.toISOString().slice(0,7);});

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-700 flex items-center justify-center text-3xl shadow-lg shadow-indigo-200">🎯</div>
          <div><h1 className="text-2xl font-black text-gray-800">Budget vs Actual</h1>
          <p className="text-sm text-gray-500 mt-0.5">Set monthly budgets · Track performance · {activeOutlet?.outlet_name}</p></div>
        </div>
        <div className="flex gap-2">
          <select value={selectedMonth} onChange={e=>setSelectedMonth(e.target.value)} className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white">
            {months.map(m=><option key={m} value={m}>{fmtMonth(m)}</option>)}
          </select>
          <button onClick={()=>setShowForm(true)} className="px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-blue-700 text-white rounded-xl font-bold text-sm shadow-md">+ Add Budget Line</button>
        </div>
      </div>

      {/* KPI Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {label:'Revenue (Budget)',value:`Ksh ${Math.round(revLine?.budgeted||0).toLocaleString()}`,sub:`Actual: Ksh ${Math.round(revLine?.actual||0).toLocaleString()}`,icon:'💰',color:'border-l-blue-500',bg:'bg-blue-50',vc:'text-blue-700'},
          {label:'Revenue Achievement',value:`${revLine?.budgeted?(((revLine.actual||0)/(revLine.budgeted||1))*100).toFixed(1):0}%`,sub:revLine&&revLine.variance>=0?'On target ✅':'Below target ⚠️',icon:'📊',color:'border-l-emerald-500',bg:'bg-emerald-50',vc:'text-emerald-700'},
          {label:'Total Expenses Budgeted',value:`Ksh ${Math.round(totalBudgeted).toLocaleString()}`,sub:`Actual: Ksh ${Math.round(totalActual).toLocaleString()}`,icon:'💸',color:'border-l-amber-500',bg:'bg-amber-50',vc:'text-amber-700'},
          {label:'Over-Budget Lines',value:overBudget,sub:overBudget>0?'Categories overspent':'All within budget ✅',icon:'⚠️',color:overBudget>0?'border-l-red-500':'border-l-emerald-500',bg:overBudget>0?'bg-red-50':'bg-emerald-50',vc:overBudget>0?'text-red-600':'text-emerald-700'},
        ].map((c,i)=>(
          <div key={i} className={`bg-white rounded-2xl border-l-4 ${c.color} ${c.bg} p-5 shadow-sm`}>
            <div className="flex items-center gap-2 mb-2"><span className="text-xl">{c.icon}</span><p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{c.label}</p></div>
            <p className={`text-2xl font-black ${c.vc}`}>{c.value}</p>
            <p className="text-xs text-gray-400 mt-1">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Form Modal */}
      {showForm&&(
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-500 to-blue-700 p-6"><h2 className="text-xl font-black text-white">Add Budget Line</h2><p className="text-indigo-200 text-sm mt-0.5">{fmtMonth(selectedMonth)}</p></div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-600 uppercase mb-1.5 block">Category</label>
                <select value={form.category} onChange={e=>setForm({...form,category:e.target.value})} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white">
                  {CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600 uppercase mb-1.5 block">Budgeted Amount (Ksh)</label>
                <input type="number" value={form.budgeted} onChange={e=>setForm({...form,budgeted:e.target.value})} min="0" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" placeholder="0.00"/>
              </div>
            </div>
            <div className="flex gap-3 p-6 pt-0">
              <button onClick={()=>setShowForm(false)} className="flex-1 py-3 border border-gray-200 rounded-xl font-semibold text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={save} disabled={saving} className="flex-1 py-3 bg-gradient-to-r from-indigo-500 to-blue-700 text-white rounded-xl font-bold text-sm disabled:opacity-60">{saving?'Saving…':'Save Budget'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Budget Table */}
      <div className="bg-white rounded-2xl border overflow-hidden shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="bg-gradient-to-r from-indigo-50 to-blue-50 border-b">
              {['Category','Budgeted','Actual','Variance','Achievement','Status','Edit'].map(h=>(
                <th key={h} className={`py-3.5 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider ${['Budgeted','Actual','Variance','Achievement'].includes(h)?'text-right':'text-left'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading?(<tr><td colSpan={7} className="py-20 text-center"><div className="w-10 h-10 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin mx-auto"/></td></tr>)
            :lines.length===0?(<tr><td colSpan={7} className="py-20 text-center"><div className="text-5xl mb-3">🎯</div><p className="font-bold text-gray-700">No budget lines for {fmtMonth(selectedMonth)}</p><p className="text-gray-400 text-sm mt-1">Click "+ Add Budget Line" to start</p></td></tr>)
            :lines.map(l=>{
              const isRevenue=['Sales Revenue','Gross Profit'].includes(l.category);
              const onTarget=isRevenue?l.actual>=l.budgeted:l.actual<=l.budgeted;
              const achievement=l.budgeted>0?(l.actual/l.budgeted)*100:0;
              return (
                <tr key={l.id} className={`hover:bg-indigo-50/20 transition-colors ${!onTarget&&l.budgeted>0?'bg-red-50/20':''}`}>
                  <td className="py-3 px-4 font-semibold text-sm text-gray-800">{l.category}</td>
                  {editId===l.id?(
                    <td className="py-2 px-2"><input type="number" value={editBudget} onChange={e=>setEditBudget(e.target.value)} className="w-28 px-2 py-1.5 border-2 border-indigo-400 rounded-lg text-sm font-bold text-right focus:outline-none" min="0"/></td>
                  ):(
                    <td className="py-3 px-4 text-right font-bold text-sm text-gray-700">Ksh {Math.round(l.budgeted).toLocaleString()}</td>
                  )}
                  <td className="py-3 px-4 text-right font-bold text-sm text-blue-600">Ksh {Math.round(l.actual).toLocaleString()}</td>
                  <td className="py-3 px-4 text-right"><span className={`font-black text-sm ${l.variance>=0?'text-emerald-600':'text-red-600'}`}>{l.variance>=0?'+':''}Ksh {Math.round(Math.abs(l.variance)).toLocaleString()}</span></td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-20 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-2 rounded-full ${achievement>=100?'bg-emerald-500':achievement>=70?'bg-amber-500':'bg-red-500'}`} style={{width:`${Math.min(100,achievement)}%`}}/>
                      </div>
                      <span className="font-bold text-xs text-gray-700">{achievement.toFixed(0)}%</span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${onTarget?'bg-emerald-100 text-emerald-700':'bg-red-100 text-red-600'}`}>{onTarget?'✅ On Track':'❌ Off Track'}</span>
                  </td>
                  <td className="py-3 px-4">
                    {editId===l.id?(
                      <div className="flex gap-1">
                        <button onClick={()=>saveEdit(l.id)} className="px-3 py-1.5 bg-indigo-500 text-white rounded-lg text-xs font-bold hover:bg-indigo-600">Save</button>
                        <button onClick={()=>setEditId(null)} className="px-3 py-1.5 bg-gray-100 rounded-lg text-xs font-bold hover:bg-gray-200">✕</button>
                      </div>
                    ):(
                      <button onClick={()=>{setEditId(l.id);setEditBudget(String(l.budgeted));}} className="px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold hover:bg-indigo-200 transition-all">✏️ Edit</button>
                    )}
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
