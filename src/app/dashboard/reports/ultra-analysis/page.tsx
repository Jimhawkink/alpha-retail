'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';
import toast from 'react-hot-toast';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  LineChart, Line, AreaChart, Area
} from 'recharts';
import { FiTrendingUp, FiTrendingDown, FiAlertCircle, FiSearch, FiCalendar, FiClock, FiMaximize2, FiMinimize2, FiDownload, FiDollarSign, FiPackage, FiShoppingCart } from 'react-icons/fi';

interface Product {
  pid: number;
  product_name: string;
  category: string;
  purchase_cost: number;
  wholesale_price: number;
}

interface SaleItem {
  item_id: number;
  sale_id: number;
  product_id: number;
  product_name: string;
  quantity: number;
  subtotal: number;
  unit_price: number;
  created_at: string;
}

interface Sale {
  sale_id: number;
  receipt_no: string;
  customer_name: string;
  sale_datetime: string;
  payment_method: string;
}

interface AnalyzedProduct extends Product {
  totalQty: number;
  totalRevenue: number;
  totalOrders: number;
  avgOrderValue: number;
  sales: (SaleItem & { sale?: Sale })[];
  velocity: 'Best Seller' | 'Average' | 'Poor' | 'Not Sold';
  lastSoldDate: string | null;
}

export default function UltraAnalysisPage() {
  const { activeOutlet } = useOutlet();
  const outletId = activeOutlet?.outlet_id || 1;

  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [salesItems, setSalesItems] = useState<SaleItem[]>([]);
  const [salesMap, setSalesMap] = useState<Record<number, Sale>>({});
  
  // Filters
  const [dateRange, setDateRange] = useState<'today'|'7days'|'30days'|'this_month'|'all_time'>('30days');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [timeFilter, setTimeFilter] = useState<'all'|'morning'|'afternoon'|'evening'>('all');
  const [velocityFilter, setVelocityFilter] = useState<'All'|'Best Seller'|'Average'|'Poor'|'Not Sold'>('All');
  const [search, setSearch] = useState('');
  
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  const loadData = useCallback(async () => {
    if (!activeOutlet) return;
    setLoading(true);
    try {
      let fromDate = new Date();
      let toDate = new Date();
      
      if (dateRange === 'today') {
        fromDate.setHours(0,0,0,0);
        toDate.setHours(23,59,59,999);
      } else if (dateRange === '7days') {
        fromDate.setDate(fromDate.getDate() - 7);
      } else if (dateRange === '30days') {
        fromDate.setDate(fromDate.getDate() - 30);
      } else if (dateRange === 'this_month') {
        fromDate = new Date(fromDate.getFullYear(), fromDate.getMonth(), 1);
      } else if (dateRange === 'all_time') {
        fromDate = new Date('2020-01-01');
      }

      const fromStr = customStart ? customStart + 'T00:00:00' : fromDate.toISOString();
      const toStr = customEnd ? customEnd + 'T23:59:59' : toDate.toISOString();

      const [prodsRes, salesRes] = await Promise.all([
        supabase.from('retail_products').select('pid,product_name,category,purchase_cost,wholesale_price').eq('outlet_id', outletId).eq('active', true),
        supabase.from('retail_sales').select('sale_id,receipt_no,customer_name,sale_datetime,payment_method').eq('outlet_id', outletId).gte('sale_datetime', fromStr).lte('sale_datetime', toStr)
      ]);

      if (prodsRes.error) throw prodsRes.error;
      if (salesRes.error) throw salesRes.error;

      const salesData = salesRes.data || [];
      const saleIds = salesData.map(s => s.sale_id).filter(id => id != null);
      
      const sMap: Record<number, Sale> = {};
      salesData.forEach(s => { sMap[s.sale_id] = s; });
      setSalesMap(sMap);

      // Fetch items in chunks to avoid URL too long error
      const fetchedItems: SaleItem[] = [];
      const chunkSize = 150;
      if (saleIds.length > 0) {
        for (let i = 0; i < saleIds.length; i += chunkSize) {
          const chunk = saleIds.slice(i, i + chunkSize);
          const { data: chunkItems, error: itemsErr } = await supabase.from('retail_sales_items')
            .select('item_id,sale_id,product_id,product_name,quantity,subtotal,unit_price,created_at')
            .in('sale_id', chunk);
          if (itemsErr) throw itemsErr;
          if (chunkItems) fetchedItems.push(...chunkItems);
        }
      }

      setProducts(prodsRes.data || []);
      setSalesItems(fetchedItems);
      
    } catch (err: any) {
      toast.error('Failed to load analysis data: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [activeOutlet, outletId, dateRange, customStart, customEnd]);

  useEffect(() => { loadData(); }, [loadData]);

  const analyzedData = useMemo(() => {
    const itemMap: Record<number, (SaleItem & { sale?: Sale })[]> = {};
    salesItems.forEach(item => {
      const sale = salesMap[item.sale_id];
      const itemDate = sale?.sale_datetime || new Date().toISOString();
      
      // Apply Time Filter
      if (timeFilter !== 'all') {
        const hour = new Date(itemDate).getHours();
        if (timeFilter === 'morning' && (hour < 5 || hour >= 12)) return;
        if (timeFilter === 'afternoon' && (hour < 12 || hour >= 17)) return;
        if (timeFilter === 'evening' && (hour < 17)) return;
      }

      if (!itemMap[item.product_id]) itemMap[item.product_id] = [];
      itemMap[item.product_id].push({ ...item, sale, created_at: itemDate });
    });

    return products.map(p => {
      const pSales = itemMap[p.pid] || [];
      const totalQty = pSales.reduce((acc, curr) => acc + Number(curr.quantity || 0), 0);
      const totalRevenue = pSales.reduce((acc, curr) => acc + Number(curr.subtotal || 0), 0);
      const uniqueSales = new Set(pSales.map(s => s.sale_id));
      const totalOrders = uniqueSales.size;

      // Calculate Velocity
      let velocity: 'Best Seller' | 'Average' | 'Poor' | 'Not Sold' = 'Not Sold';
      if (totalQty === 0) velocity = 'Not Sold';
      else if (totalQty >= 50 || totalRevenue >= 50000) velocity = 'Best Seller';
      else if (totalQty >= 10 || totalRevenue >= 5000) velocity = 'Average';
      else velocity = 'Poor';

      // Sort sales by date desc
      pSales.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      const lastSoldDate = pSales.length > 0 ? pSales[0].created_at : null;

      return {
        ...p,
        totalQty,
        totalRevenue,
        totalOrders,
        avgOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
        sales: pSales,
        velocity,
        lastSoldDate
      } as AnalyzedProduct;
    });
  }, [products, salesItems, salesMap, timeFilter]);

  const filteredData = useMemo(() => {
    return analyzedData.filter(p => {
      const searchStr = (search || '').toLowerCase();
      const matchSearch = (p.product_name || '').toLowerCase().includes(searchStr) || 
                          (p.category || '').toLowerCase().includes(searchStr);
      const matchVelocity = velocityFilter === 'All' || p.velocity === velocityFilter;
      return matchSearch && matchVelocity;
    }).sort((a, b) => b.totalRevenue - a.totalRevenue); // Default sort by revenue desc
  }, [analyzedData, search, velocityFilter]);

  const toggleRow = (pid: number) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(pid)) newSet.delete(pid);
      else newSet.add(pid);
      return newSet;
    });
  };

  // Metrics for Charts
  const top10Revenue = useMemo(() => [...filteredData].sort((a,b)=>b.totalRevenue - a.totalRevenue).slice(0, 10), [filteredData]);
  const top10Qty = useMemo(() => [...filteredData].sort((a,b)=>b.totalQty - a.totalQty).slice(0, 10), [filteredData]);

  // Aggregate daily sales for trend line
  const trendData = useMemo(() => {
    const daily: Record<string, number> = {};
    salesItems.forEach(item => {
      const sale = salesMap[item.sale_id];
      const itemDate = sale?.sale_datetime || new Date().toISOString();
      const date = itemDate.split('T')[0];
      daily[date] = (daily[date] || 0) + Number(item.subtotal || 0);
    });
    return Object.entries(daily).map(([date, amount]) => ({ date, amount })).sort((a, b) => a.date.localeCompare(b.date));
  }, [salesItems, salesMap]);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(start, start + itemsPerPage);
  }, [filteredData, currentPage]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, velocityFilter, dateRange, customStart, customEnd, timeFilter]);

  const exportCSV = () => {
    const rows = [['Product', 'Category', 'Velocity', 'Total Qty', 'Total Revenue', 'Total Orders', 'Avg Order Value', 'Last Sold']];
    filteredData.forEach(p => {
      rows.push([
        p.product_name, p.category || 'N/A', p.velocity, String(p.totalQty), String(p.totalRevenue), String(p.totalOrders), p.avgOrderValue.toFixed(2), p.lastSoldDate ? new Date(p.lastSoldDate).toLocaleDateString() : 'Never'
      ]);
    });
    const blob = new Blob([rows.map(r => r.join(',')).join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Ultra_Analysis_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">Ultra Product Analysis</h1>
          <p className="text-sm text-gray-500 mt-1 font-medium">Deep-dive into sales performance, velocities, and customer trends.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="px-5 py-2.5 bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-bold text-sm flex items-center gap-2 transition-all shadow-md hover:shadow-lg">
            <FiDownload /> Export CSV
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5"><FiCalendar/> Date Range</label>
          <select value={dateRange} onChange={e => setDateRange(e.target.value as any)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all">
            <option value="today">Today</option>
            <option value="7days">Last 7 Days</option>
            <option value="30days">Last 30 Days</option>
            <option value="this_month">This Month</option>
            <option value="all_time">All Time</option>
            <option value="custom">Custom Range</option>
          </select>
        </div>
        
        {dateRange === 'custom' && (
          <div className="space-y-1.5 col-span-1 lg:col-span-2 grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Start</label>
              <input type="date" value={customStart} onChange={e=>setCustomStart(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">End</label>
              <input type="date" value={customEnd} onChange={e=>setCustomEnd(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5"><FiClock/> Time of Day</label>
          <select value={timeFilter} onChange={e => setTimeFilter(e.target.value as any)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all">
            <option value="all">All Hours</option>
            <option value="morning">Morning (5am - 12pm)</option>
            <option value="afternoon">Afternoon (12pm - 5pm)</option>
            <option value="evening">Evening (5pm onwards)</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5"><FiTrendingUp/> Performance</label>
          <select value={velocityFilter} onChange={e => setVelocityFilter(e.target.value as any)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all">
            <option value="All">All Items</option>
            <option value="Best Seller">🏆 Best Sellers</option>
            <option value="Average">📈 Average Performers</option>
            <option value="Poor">📉 Poor Performers</option>
            <option value="Not Sold">💀 Not Sold</option>
          </select>
        </div>

        <div className="space-y-1.5 lg:col-span-1">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5"><FiSearch/> Search</label>
          <input type="text" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search item or category..." className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-blue-500 outline-none" />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Revenue Analyzed', value: `Ksh ${analyzedData.reduce((a,b)=>a+b.totalRevenue,0).toLocaleString()}`, icon: FiDollarSign, color: 'text-emerald-600', bg: 'bg-emerald-100' },
          { label: 'Total Items Sold', value: analyzedData.reduce((a,b)=>a+b.totalQty,0).toLocaleString(), icon: FiPackage, color: 'text-blue-600', bg: 'bg-blue-100' },
          { label: 'Best Sellers Count', value: analyzedData.filter(p=>p.velocity==='Best Seller').length, icon: FiTrendingUp, color: 'text-violet-600', bg: 'bg-violet-100' },
          { label: 'Dead/Unsold Items', value: analyzedData.filter(p=>p.velocity==='Not Sold').length, icon: FiAlertCircle, color: 'text-red-600', bg: 'bg-red-100' },
        ].map((kpi, i) => (
          <div key={i} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl ${kpi.bg} ${kpi.color}`}>
              <kpi.icon />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{kpi.label}</p>
              <p className="text-2xl font-black text-gray-800">{kpi.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm h-[400px]">
          <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2"><FiTrendingUp className="text-blue-500"/> Top 10 Products by Revenue</h2>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={top10Revenue} layout="vertical" margin={{ top: 0, right: 30, left: 40, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
              <XAxis type="number" tickFormatter={(val) => `Ksh ${Number(val || 0)/1000}k`} stroke="#9ca3af" fontSize={12} />
              <YAxis dataKey="product_name" type="category" width={100} tick={{fontSize: 11, fill: '#4b5563'}} />
              <RechartsTooltip cursor={{fill: '#f3f4f6'}} contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} formatter={(val: number) => [`Ksh ${Number(val || 0).toLocaleString()}`, 'Revenue']} />
              <Bar dataKey="totalRevenue" fill="url(#colorRev)" radius={[0, 8, 8, 0]} barSize={20} />
              <defs>
                <linearGradient id="colorRev" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#4f46e5" />
                  <stop offset="100%" stopColor="#8b5cf6" />
                </linearGradient>
              </defs>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm h-[400px]">
          <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2"><FiCalendar className="text-indigo-500"/> Revenue Trend over Time</h2>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendData} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="date" stroke="#9ca3af" fontSize={12} tickFormatter={(val) => typeof val === 'string' ? val.split('-').slice(1).join('/') : val} />
              <YAxis stroke="#9ca3af" fontSize={12} tickFormatter={(val) => `${Number(val)/1000}k`} />
              <RechartsTooltip cursor={{stroke: '#8b5cf6', strokeWidth: 2}} contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} formatter={(val: number) => [`Ksh ${Number(val || 0).toLocaleString()}`, 'Revenue']} />
              <Area type="monotone" dataKey="amount" stroke="#8b5cf6" strokeWidth={3} fill="url(#colorTrend)" />
              <defs>
                <linearGradient id="colorTrend" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Datagrid */}
      <div className="bg-white rounded-3xl border border-gray-200 shadow-lg overflow-hidden flex flex-col">
        <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600">
              <FiPackage size={20} />
            </div>
            <div>
              <h2 className="text-xl font-black text-gray-800">Detailed Product Analysis</h2>
              <p className="text-xs text-gray-500 font-medium mt-0.5">Click any row to view full invoice breakdown</p>
            </div>
          </div>
          <span className="text-sm font-black text-blue-600 bg-blue-50 px-4 py-1.5 rounded-xl border border-blue-100 shadow-inner">{filteredData.length} Results Found</span>
        </div>
        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gradient-to-r from-slate-800 to-slate-900 border-b border-gray-200">
                <th className="px-5 py-4 text-xs font-black text-slate-300 uppercase tracking-wider w-10"></th>
                <th className="px-5 py-4 text-xs font-black text-slate-300 uppercase tracking-wider">Product Info</th>
                <th className="px-5 py-4 text-xs font-black text-slate-300 uppercase tracking-wider text-center">Velocity</th>
                <th className="px-5 py-4 text-xs font-black text-slate-300 uppercase tracking-wider text-right">Qty Sold</th>
                <th className="px-5 py-4 text-xs font-black text-slate-300 uppercase tracking-wider text-right">Revenue</th>
                <th className="px-5 py-4 text-xs font-black text-slate-300 uppercase tracking-wider text-center">Orders</th>
                <th className="px-5 py-4 text-xs font-black text-slate-300 uppercase tracking-wider text-right">Avg Order</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={7} className="py-32 text-center text-blue-500 font-bold text-lg">Crunching robust analytics data...</td></tr>
              ) : paginatedData.length === 0 ? (
                <tr><td colSpan={7} className="py-32 text-center text-gray-400 font-medium">No results found for current filters.</td></tr>
              ) : paginatedData.map((p) => {
                const isExpanded = expandedRows.has(p.pid);
                const velColors = {
                  'Best Seller': 'bg-gradient-to-r from-emerald-100 to-green-100 text-emerald-800 border-emerald-300 shadow-sm',
                  'Average': 'bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-800 border-blue-300 shadow-sm',
                  'Poor': 'bg-gradient-to-r from-amber-100 to-orange-100 text-amber-800 border-amber-300 shadow-sm',
                  'Not Sold': 'bg-gradient-to-r from-red-100 to-rose-100 text-red-800 border-red-300 shadow-sm'
                };
                return (
                  <React.Fragment key={p.pid}>
                    <tr className={`hover:bg-blue-50/50 transition-colors cursor-pointer ${isExpanded ? 'bg-blue-50/80 border-l-4 border-l-blue-500' : 'border-l-4 border-l-transparent'}`} onClick={() => toggleRow(p.pid)}>
                      <td className="px-5 py-4 text-gray-400">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${isExpanded ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500 group-hover:bg-blue-50'}`}>
                           {isExpanded ? <FiMinimize2 size={16} /> : <FiMaximize2 size={16} />}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-bold text-gray-800 text-base">{p.product_name}</div>
                        <div className="text-xs text-gray-400 font-semibold mt-1">{p.category || 'Uncategorized'}</div>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className={`px-3.5 py-1.5 rounded-xl text-xs font-black border ${velColors[p.velocity]}`}>
                          {p.velocity}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right font-black text-gray-700">{p.totalQty.toLocaleString()}</td>
                      <td className="px-5 py-4 text-right font-black text-blue-600">Ksh {p.totalRevenue.toLocaleString()}</td>
                      <td className="px-5 py-4 text-center font-bold text-gray-600">
                        <span className="bg-gray-100 px-3 py-1 rounded-lg">{p.totalOrders}</span>
                      </td>
                      <td className="px-5 py-4 text-right font-bold text-gray-600">Ksh {p.avgOrderValue.toFixed(0)}</td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={7} className="bg-gradient-to-b from-blue-50/50 to-white p-0 border-b-2 border-blue-200">
                          <div className="p-8">
                            <h4 className="text-sm font-black text-gray-800 mb-5 flex items-center gap-2"><FiShoppingCart className="text-blue-500" size={18}/> Full Invoice Breakdown for {p.product_name}</h4>
                            {p.sales.length === 0 ? (
                              <div className="bg-white p-6 rounded-2xl border border-gray-200 text-center">
                                <p className="text-sm text-gray-500 font-medium">No sales data recorded in this period.</p>
                              </div>
                            ) : (
                              <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-md">
                                <table className="w-full text-left text-sm">
                                  <thead className="bg-slate-50 border-b border-gray-200">
                                    <tr>
                                      <th className="px-5 py-3.5 font-bold text-slate-700">Date & Time</th>
                                      <th className="px-5 py-3.5 font-bold text-slate-700">Receipt No</th>
                                      <th className="px-5 py-3.5 font-bold text-slate-700">Customer Name</th>
                                      <th className="px-5 py-3.5 font-bold text-slate-700 text-right">Qty</th>
                                      <th className="px-5 py-3.5 font-bold text-slate-700 text-right">Unit Price</th>
                                      <th className="px-5 py-3.5 font-bold text-slate-700 text-right">Subtotal</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-100">
                                    {p.sales.map((sale, idx) => (
                                      <tr key={sale.item_id || idx} className="hover:bg-blue-50/30 transition-colors">
                                        <td className="px-5 py-3 text-gray-600 font-medium">{new Date(sale.created_at).toLocaleString('en-GB', {day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}</td>
                                        <td className="px-5 py-3 font-bold text-blue-600">{sale.sale?.receipt_no || 'N/A'}</td>
                                        <td className="px-5 py-3 text-gray-700 font-medium">{sale.sale?.customer_name || 'Walk-in Customer'}</td>
                                        <td className="px-5 py-3 text-right font-bold text-gray-800">{sale.quantity}</td>
                                        <td className="px-5 py-3 text-right text-gray-500 font-semibold">Ksh {sale.unit_price}</td>
                                        <td className="px-5 py-3 text-right font-black text-gray-900">Ksh {sale.subtotal}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Controls */}
        {!loading && totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
            <p className="text-sm text-gray-500 font-medium">
              Showing <span className="font-bold text-gray-800">{((currentPage - 1) * itemsPerPage) + 1}</span> to <span className="font-bold text-gray-800">{Math.min(currentPage * itemsPerPage, filteredData.length)}</span> of <span className="font-bold text-gray-800">{filteredData.length}</span> results
            </p>
            <div className="flex gap-2">
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 rounded-xl text-sm font-bold bg-white border border-gray-200 text-gray-700 hover:bg-gray-100 hover:text-blue-600 disabled:opacity-50 disabled:hover:bg-white disabled:hover:text-gray-700 transition-all shadow-sm"
              >
                Previous
              </button>
              
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  // Logic to show a sliding window of pages
                  let pageNum = currentPage;
                  if (currentPage <= 3) pageNum = i + 1;
                  else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                  else pageNum = currentPage - 2 + i;
                  
                  if (pageNum < 1 || pageNum > totalPages) return null;
                  
                  const isCurrent = pageNum === currentPage;
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-9 h-9 rounded-xl text-sm font-bold flex items-center justify-center transition-all shadow-sm ${isCurrent ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-100 hover:text-blue-600'}`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 rounded-xl text-sm font-bold bg-white border border-gray-200 text-gray-700 hover:bg-gray-100 hover:text-blue-600 disabled:opacity-50 disabled:hover:bg-white disabled:hover:text-gray-700 transition-all shadow-sm"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
