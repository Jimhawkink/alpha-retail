'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import { FiPackage, FiPlus, FiEdit2, FiTrash2, FiShoppingCart, FiDownload, FiRefreshCw, FiSearch, FiGrid, FiList, FiChevronLeft, FiChevronRight, FiX, FiUpload, FiCheck, FiAlertTriangle, FiTag, FiDollarSign, FiLayers, FiFilter, FiTrendingUp, FiImage } from 'react-icons/fi';

interface Product {
    pid: number; product_code: string; product_name: string; alias: string;
    vat_commodity: string; description: string; barcode: string; category: string;
    purchase_unit: string; sales_unit: string; purchase_cost: number; sales_cost: number;
    reorder_point: number; margin_per: number; show_ps: boolean; button_ui_color: string;
    photo: string; hscode: string; batch_no: string; supplier_name: string; active: boolean;
}
interface Category { category_id: number; category_name: string; icon: string; color: string; }
interface Supplier { supplier_id: number; supplier_code: string; supplier_name: string; is_kitchen?: boolean; }
interface Unit { unit_id: number; unit_name: string; abbreviation: string; }

const defaultProduct: Omit<Product, 'pid' | 'product_code'> = {
    product_name: '', alias: '', vat_commodity: 'Standard', description: '', barcode: '',
    category: '', purchase_unit: 'Piece', sales_unit: 'Piece', purchase_cost: 0, sales_cost: 0,
    reorder_point: 10, margin_per: 0, show_ps: true, button_ui_color: 'from-blue-400 to-blue-600',
    photo: '', hscode: '', batch_no: '', supplier_name: '', active: true,
};
const vatOptions = ['Standard', 'Zero Rated', 'Exempt', 'Inclusive'];
const colorPresets = [
    { name: 'Orange', gradient: 'from-orange-400 to-orange-600', hex: '#F97316' },
    { name: 'Red', gradient: 'from-red-400 to-red-600', hex: '#EF4444' },
    { name: 'Yellow Orange', gradient: 'from-yellow-500 to-orange-500', hex: '#F59E0B' },
    { name: 'Pink', gradient: 'from-red-500 to-pink-600', hex: '#EC4899' },
    { name: 'Rose', gradient: 'from-rose-500 to-red-600', hex: '#F43F5E' },
    { name: 'Green', gradient: 'from-green-400 to-emerald-600', hex: '#10B981' },
    { name: 'Yellow', gradient: 'from-yellow-400 to-yellow-600', hex: '#EAB308' },
    { name: 'Amber', gradient: 'from-amber-400 to-amber-600', hex: '#F59E0B' },
    { name: 'Blue', gradient: 'from-blue-400 to-blue-600', hex: '#3B82F6' },
    { name: 'Cyan', gradient: 'from-cyan-400 to-cyan-600', hex: '#06B6D4' },
    { name: 'Teal', gradient: 'from-teal-400 to-teal-600', hex: '#14B8A6' },
    { name: 'Purple', gradient: 'from-purple-400 to-purple-600', hex: '#A855F7' },
    { name: 'Brown', gradient: 'from-amber-600 to-amber-800', hex: '#92400E' },
    { name: 'Red Dark', gradient: 'from-red-600 to-red-800', hex: '#DC2626' },
];
const defUnits: Unit[] = [
    { unit_id: 1, unit_name: 'Piece', abbreviation: 'Pc' }, { unit_id: 2, unit_name: 'Kilogram', abbreviation: 'Kg' },
    { unit_id: 3, unit_name: 'Gram', abbreviation: 'g' }, { unit_id: 4, unit_name: 'Liter', abbreviation: 'L' },
    { unit_id: 5, unit_name: 'Milliliter', abbreviation: 'ml' }, { unit_id: 6, unit_name: 'Box', abbreviation: 'Box' },
    { unit_id: 7, unit_name: 'Pack', abbreviation: 'Pk' }, { unit_id: 8, unit_name: 'Dozen', abbreviation: 'Dz' },
    { unit_id: 9, unit_name: 'Bottle', abbreviation: 'Btl' }, { unit_id: 10, unit_name: 'Plate', abbreviation: 'Plt' },
];

export default function ProductsPage() {
    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [units, setUnits] = useState<Unit[]>(defUnits);
    const [companyName, setCompanyName] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [formData, setFormData] = useState(defaultProduct);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCategory, setFilterCategory] = useState('All');
    const [isSaving, setIsSaving] = useState(false);
    const [openingQty, setOpeningQty] = useState(0);
    const [stockData, setStockData] = useState<Record<number, number>>({});
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
    const [page, setPage] = useState(1);
    const perPage = 12;

    // ─── DATA LOADING ───
    const loadProducts = useCallback(async () => {
        setIsLoading(true);
        try { const { data, error } = await supabase.from('retail_products').select('*').order('pid', { ascending: false }); if (error) throw error; setProducts(data || []); }
        catch { toast.error('Failed to load products'); }
        setIsLoading(false);
    }, []);

    const loadStockData = useCallback(async () => {
        try {
            const { data, error } = await supabase.from('retail_stock').select('pid, qty'); if (error) throw error;
            const m: Record<number, number> = {}; (data || []).forEach((s: { pid: number; qty: number }) => { m[s.pid] = (m[s.pid] || 0) + (s.qty || 0); }); setStockData(m);
        } catch { /* silent */ }
    }, []);

    const loadCategories = useCallback(async () => {
        try { const { data, error } = await supabase.from('retail_categories').select('*').eq('active', true).order('category_name'); if (error) throw error; setCategories(data || []); }
        catch { /* silent */ }
    }, []);

    const loadSuppliers = useCallback(async () => {
        try { const { data, error } = await supabase.from('retail_suppliers').select('supplier_id, supplier_code, supplier_name').eq('active', true).order('supplier_name'); if (error) throw error; setSuppliers(data || []); }
        catch { /* silent */ }
    }, []);

    const loadUnits = useCallback(async () => {
        try { const { data, error } = await supabase.from('product_units').select('unit_id, unit_name, abbreviation').eq('active', true).order('unit_name'); if (error) throw error; setUnits(data || []); }
        catch { setUnits(defUnits); }
    }, []);

    const loadCompanyName = useCallback(async () => {
        try {
            const { data } = await supabase.from('organisation_settings').select('setting_value').eq('setting_key', 'company_name').single();
            if (data?.setting_value) setCompanyName(data.setting_value.trim());
        } catch { setCompanyName('Alpha Retail'); }
    }, []);

    useEffect(() => { loadProducts(); loadStockData(); loadCategories(); loadSuppliers(); loadUnits(); loadCompanyName(); },
        [loadProducts, loadStockData, loadCategories, loadSuppliers, loadUnits, loadCompanyName]);

    const getKitchenSupplier = () => companyName || 'Kitchen';

    const generateBarcode = async (): Promise<string> => {
        try {
            const { data } = await supabase.from('retail_products').select('barcode').like('barcode', '1%').order('barcode', { ascending: false }).limit(1);
            if (data?.length && data[0].barcode) return String((parseInt(data[0].barcode) || 100) + 1); return '101';
        } catch { return '101'; }
    };

    const generateProductCode = async (): Promise<string> => {
        try {
            const { data } = await supabase.from('retail_products').select('product_code').like('product_code', 'PRD-%').order('product_code', { ascending: false }).limit(1);
            if (data?.length) return `PRD-${String((parseInt(data[0].product_code.replace('PRD-', '')) || 0) + 1).padStart(2, '0')}`; return 'PRD-01';
        } catch { return 'PRD-01'; }
    };

    const calcMargin = (pc: number, sc: number) => pc <= 0 ? 0 : Math.round(((sc - pc) / pc) * 10000) / 100;

    const openAddModal = async () => {
        setEditingProduct(null); const bc = await generateBarcode();
        setFormData({ ...defaultProduct, barcode: bc, supplier_name: getKitchenSupplier() }); setOpeningQty(0); setShowModal(true);
    };

    const openEditModal = (p: Product) => {
        setEditingProduct(p);
        setFormData({
            product_name: p.product_name, alias: p.alias || '', vat_commodity: p.vat_commodity || 'Standard',
            description: p.description || '', barcode: p.barcode || '', category: p.category || '',
            purchase_unit: p.purchase_unit || 'Piece', sales_unit: p.sales_unit || 'Piece',
            purchase_cost: p.purchase_cost || 0, sales_cost: p.sales_cost || 0, reorder_point: p.reorder_point || 10,
            margin_per: p.margin_per || 0, show_ps: p.show_ps !== false, button_ui_color: p.button_ui_color || 'from-blue-400 to-blue-600',
            photo: p.photo || '', hscode: p.hscode || '', batch_no: p.batch_no || '', supplier_name: p.supplier_name || '', active: p.active !== false,
        }); setShowModal(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault(); if (!formData.product_name.trim()) { toast.error('Product name required!'); return; }
        setIsSaving(true);
        try {
            const margin = calcMargin(formData.purchase_cost, formData.sales_cost);
            const d = {
                product_name: formData.product_name, alias: formData.alias || null, description: formData.description || null,
                barcode: formData.barcode || null, category: formData.category || null, purchase_unit: formData.purchase_unit,
                sales_unit: formData.sales_unit, purchase_cost: formData.purchase_cost || 0, sales_cost: formData.sales_cost || 0,
                reorder_point: formData.reorder_point || 10, margin_per: margin, show_in_pos: formData.show_ps !== false,
                button_ui_color: formData.button_ui_color, photo: formData.photo || null, batch_no: formData.batch_no || null,
                supplier_name: formData.supplier_name || null, active: formData.active !== false
            };
            if (editingProduct) {
                const { error } = await supabase.from('retail_products').update({ ...d, updated_at: new Date().toISOString() }).eq('pid', editingProduct.pid);
                if (error) throw new Error(error.message); toast.success('Product updated!');
            } else {
                const code = await generateProductCode();
                const { data: np, error } = await supabase.from('retail_products').insert({ ...d, product_code: code, created_at: new Date().toISOString() }).select().single();
                if (error) throw new Error(error.message);
                if (openingQty > 0 && np) await supabase.from('retail_stock').insert({ pid: np.pid, invoice_no: 'OPENING', qty: openingQty, storage_type: 'Store' });
                toast.success(`Product ${code} created!`);
            }
            setShowModal(false); loadProducts(); loadStockData();
        } catch (err: unknown) { toast.error(`Failed: ${err instanceof Error ? err.message : 'Unknown'}`); }
        setIsSaving(false);
    };

    const deleteProduct = async (p: Product) => {
        if (!confirm(`Delete "${p.product_name}"?`)) return;
        try { const { error } = await supabase.from('retail_products').delete().eq('pid', p.pid); if (error) throw error; toast.success('Deleted'); loadProducts(); }
        catch { toast.error('Failed'); }
    };

    const exportCSV = () => {
        const csv = [['Code', 'Name', 'Category', 'Buy', 'Sell', 'Stock', 'Margin%', 'Status'].join(','),
        ...filtered.map(p => [p.product_code, `"${p.product_name}"`, p.category || '', p.purchase_cost, p.sales_cost, stockData[p.pid] || 0, p.margin_per?.toFixed(1), p.active ? 'Active' : 'Off'].join(','))].join('\n');
        const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'products.csv'; a.click();
        toast.success('Exported!');
    };

    const filtered = products.filter(p => {
        const q = searchQuery.toLowerCase();
        return (p.product_name.toLowerCase().includes(q) || p.product_code.toLowerCase().includes(q) || (p.barcode && p.barcode.includes(searchQuery)))
            && (filterCategory === 'All' || p.category === filterCategory);
    });
    const totalPages = Math.ceil(filtered.length / perPage);
    const paginated = filtered.slice((page - 1) * perPage, page * perPage);
    const lowStock = products.filter(p => (stockData[p.pid] || 0) <= (p.reorder_point || 10) && p.active).length;
    const stockVal = products.reduce((s, p) => s + (stockData[p.pid] || 0) * (p.sales_cost || 0), 0);

    // ─── UI ───
    return (
        <div className="space-y-5" style={{ fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>

            {/* ━━━ TOP BAR ━━━ */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                        <FiPackage className="text-white" size={24} />
                    </div>
                    <div>
                        <h1 className="text-xl font-extrabold text-gray-900 tracking-tight">Products Master</h1>
                        <p className="text-xs text-gray-400 font-medium tracking-wide">Inventory &bull; Pricing &bull; SKU Management</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => { loadProducts(); loadStockData(); }} className="p-2.5 rounded-xl bg-white border border-gray-200 text-gray-500 hover:text-indigo-600 hover:border-indigo-300 transition-all shadow-sm" title="Refresh">
                        <FiRefreshCw size={16} />
                    </button>
                    <button onClick={exportCSV} className="px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-600 hover:text-indigo-600 hover:border-indigo-300 transition-all text-sm font-semibold flex items-center gap-2 shadow-sm">
                        <FiDownload size={14} /> Export
                    </button>
                    <button onClick={openAddModal} className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-sm font-bold shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40 hover:scale-[1.03] active:scale-95 transition-all flex items-center gap-2">
                        <FiPlus size={16} strokeWidth={3} /> Add Product
                    </button>
                </div>
            </div>

            {/* ━━━ STAT CARDS ━━━ */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Total Products', value: products.length, icon: FiPackage, gradient: 'from-sky-400 to-blue-600', shadow: 'shadow-sky-500/20', bg: 'bg-sky-50', text: 'text-sky-700' },
                    { label: 'Active SKUs', value: products.filter(p => p.active).length, icon: FiCheck, gradient: 'from-emerald-400 to-green-600', shadow: 'shadow-emerald-500/20', bg: 'bg-emerald-50', text: 'text-emerald-700' },
                    { label: 'Categories', value: categories.length, icon: FiLayers, gradient: 'from-violet-400 to-purple-600', shadow: 'shadow-violet-500/20', bg: 'bg-violet-50', text: 'text-violet-700' },
                    { label: 'Low Inventory', value: lowStock, icon: FiAlertTriangle, gradient: lowStock > 0 ? 'from-red-400 to-rose-600' : 'from-teal-400 to-cyan-600', shadow: lowStock > 0 ? 'shadow-red-500/20' : 'shadow-teal-500/20', bg: lowStock > 0 ? 'bg-red-50' : 'bg-teal-50', text: lowStock > 0 ? 'text-red-700' : 'text-teal-700' },
                ].map((s, i) => (
                    <div key={i} className={`${s.bg} rounded-2xl p-4 border border-gray-100/80 hover:shadow-lg transition-all group cursor-default`}>
                        <div className="flex items-center justify-between mb-3">
                            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.gradient} flex items-center justify-center shadow-md ${s.shadow} group-hover:scale-110 transition-transform`}>
                                <s.icon className="text-white" size={18} />
                            </div>
                        </div>
                        <p className="text-2xl font-extrabold text-gray-900">{s.value}</p>
                        <p className={`text-[11px] font-semibold ${s.text} mt-0.5 uppercase tracking-wider`}>{s.label}</p>
                    </div>
                ))}
            </div>

            {/* Stock value bar */}
            <div className="flex items-center justify-between px-5 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-700 text-white shadow-md">
                <div className="flex items-center gap-2 text-sm font-semibold">
                    <FiDollarSign size={16} />
                    <span className="text-indigo-200">Stock Value:</span>
                    <span className="text-lg font-extrabold">Ksh {stockVal.toLocaleString()}</span>
                </div>
                <span className="text-xs text-indigo-200">{filtered.length} products found</span>
            </div>

            {/* ━━━ SEARCH & FILTER BAR ━━━ */}
            <div className="glass-card p-4 flex flex-col lg:flex-row gap-3 items-center">
                <div className="flex-1 relative w-full">
                    <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input type="text" value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
                        placeholder="Search by name, code, or barcode..."
                        className="w-full pl-12 pr-4 py-3 rounded-xl bg-white border-2 border-gray-200 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all text-sm font-medium placeholder-gray-400" />
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <FiFilter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                        <select value={filterCategory} onChange={e => { setFilterCategory(e.target.value); setPage(1); }}
                            className="pl-9 pr-4 py-3 rounded-xl bg-white border-2 border-gray-200 focus:border-indigo-400 outline-none text-sm font-medium cursor-pointer min-w-[150px]">
                            <option value="All">All Categories</option>
                            {categories.map(c => <option key={c.category_id} value={c.category_name}>{c.category_name}</option>)}
                        </select>
                    </div>
                    <div className="flex rounded-xl overflow-hidden border-2 border-gray-200 bg-white">
                        <button onClick={() => setViewMode('list')} className={`p-3 transition-all ${viewMode === 'list' ? 'bg-indigo-500 text-white' : 'text-gray-400 hover:text-indigo-500'}`}><FiList size={16} /></button>
                        <button onClick={() => setViewMode('grid')} className={`p-3 transition-all ${viewMode === 'grid' ? 'bg-indigo-500 text-white' : 'text-gray-400 hover:text-indigo-500'}`}><FiGrid size={16} /></button>
                    </div>
                </div>
            </div>

            {/* ━━━ CONTENT ━━━ */}
            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20">
                    <div className="w-14 h-14 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                    <p className="mt-4 text-gray-500 font-medium text-sm">Loading products...</p>
                </div>
            ) : paginated.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 glass-card">
                    <FiPackage className="text-gray-300" size={64} />
                    <p className="mt-4 text-gray-500 font-semibold">No products found</p>
                    <button onClick={openAddModal} className="mt-3 px-5 py-2 bg-indigo-500 text-white rounded-xl font-semibold hover:bg-indigo-600 transition-all text-sm">Add First Product</button>
                </div>
            ) : viewMode === 'grid' ? (
                /* ── CARD GRID VIEW ── */
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {paginated.map(p => {
                        const stk = stockData[p.pid] || 0;
                        return (
                            <div key={p.pid} className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
                                {/* Card image/color */}
                                <div className={`h-32 bg-gradient-to-br ${p.button_ui_color || 'from-blue-400 to-blue-600'} relative flex items-center justify-center`}>
                                    {p.photo ? (
                                        <img src={p.photo} alt={p.product_name} className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                    ) : (
                                        <span className="text-white text-4xl font-black opacity-40">{p.product_name.charAt(0)}</span>
                                    )}
                                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => openEditModal(p)} className="p-1.5 bg-white/90 rounded-lg text-indigo-600 hover:bg-white shadow-sm"><FiEdit2 size={12} /></button>
                                        <button onClick={() => deleteProduct(p)} className="p-1.5 bg-white/90 rounded-lg text-red-500 hover:bg-white shadow-sm"><FiTrash2 size={12} /></button>
                                    </div>
                                    <span className={`absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-bold ${p.active ? 'bg-emerald-500 text-white' : 'bg-gray-500 text-white'}`}>{p.active ? 'ACTIVE' : 'OFF'}</span>
                                </div>
                                <div className="p-3">
                                    <p className="text-sm font-bold text-gray-900 truncate">{p.product_name}</p>
                                    <div className="flex items-center justify-between mt-1">
                                        <span className="text-[10px] font-semibold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full">{p.product_code}</span>
                                        <span className="text-[10px] font-medium text-gray-400">{p.category || 'N/A'}</span>
                                    </div>
                                    <div className="flex items-center justify-between mt-3">
                                        <p className="text-base font-extrabold text-gray-900">Ksh {(p.sales_cost || 0).toLocaleString()}</p>
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${stk > 10 ? 'bg-emerald-100 text-emerald-700' : stk > 0 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{stk} pcs</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                /* ── LIST/TABLE VIEW ── */
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-gradient-to-r from-indigo-600 to-purple-700">
                                    <th className="px-4 py-3.5 text-left text-[11px] font-bold text-indigo-100 uppercase tracking-wider">Product</th>
                                    <th className="px-4 py-3.5 text-left text-[11px] font-bold text-indigo-100 uppercase tracking-wider hidden md:table-cell">Category</th>
                                    <th className="px-4 py-3.5 text-right text-[11px] font-bold text-indigo-100 uppercase tracking-wider">Buy Price</th>
                                    <th className="px-4 py-3.5 text-right text-[11px] font-bold text-indigo-100 uppercase tracking-wider">Sell Price</th>
                                    <th className="px-4 py-3.5 text-center text-[11px] font-bold text-indigo-100 uppercase tracking-wider">Stock</th>
                                    <th className="px-4 py-3.5 text-center text-[11px] font-bold text-indigo-100 uppercase tracking-wider hidden lg:table-cell">Margin</th>
                                    <th className="px-4 py-3.5 text-center text-[11px] font-bold text-indigo-100 uppercase tracking-wider">Status</th>
                                    <th className="px-4 py-3.5 text-center text-[11px] font-bold text-indigo-100 uppercase tracking-wider w-28">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginated.map((p, idx) => {
                                    const stk = stockData[p.pid] || 0;
                                    return (
                                        <tr key={p.pid} className={`border-b border-gray-50 hover:bg-indigo-50/40 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    {p.photo ? (
                                                        <div className="w-10 h-10 rounded-xl overflow-hidden border border-gray-200 flex-shrink-0 shadow-sm">
                                                            <img src={p.photo} alt="" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                                        </div>
                                                    ) : (
                                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold bg-gradient-to-br ${p.button_ui_color || 'from-blue-400 to-blue-600'} shadow-sm`}>
                                                            {p.product_name.charAt(0)}
                                                        </div>
                                                    )}
                                                    <div>
                                                        <p className="text-sm font-semibold text-gray-900">{p.product_name}</p>
                                                        <p className="text-[11px] text-indigo-500 font-medium">{p.product_code}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 hidden md:table-cell">
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-50 text-purple-700 rounded-lg text-[11px] font-semibold">
                                                    <FiTag size={10} /> {p.category || 'N/A'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right text-xs text-gray-500 font-medium">Ksh {(p.purchase_cost || 0).toLocaleString()}</td>
                                            <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">Ksh {(p.sales_cost || 0).toLocaleString()}</td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`inline-block min-w-[36px] px-2 py-1 rounded-lg text-xs font-bold ${stk > 10 ? 'bg-emerald-100 text-emerald-700' : stk > 0 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{stk}</span>
                                            </td>
                                            <td className="px-4 py-3 text-center hidden lg:table-cell">
                                                <div className="flex items-center justify-center gap-1">
                                                    <FiTrendingUp size={11} className={(p.margin_per || 0) >= 20 ? 'text-emerald-500' : 'text-red-400'} />
                                                    <span className={`text-xs font-bold ${(p.margin_per || 0) >= 30 ? 'text-emerald-600' : (p.margin_per || 0) >= 15 ? 'text-amber-600' : 'text-red-600'}`}>{p.margin_per?.toFixed(1) || '0'}%</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${p.active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-500'}`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${p.active ? 'bg-emerald-500' : 'bg-gray-400'}`} />{p.active ? 'Live' : 'Off'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center justify-center gap-1">
                                                    <button onClick={() => openEditModal(p)} className="p-2 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-all" title="Edit"><FiEdit2 size={13} /></button>
                                                    <button onClick={() => window.location.href = `/dashboard/purchase?product=${p.pid}`} className="p-2 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-all" title="Purchase"><FiShoppingCart size={13} /></button>
                                                    <button onClick={() => deleteProduct(p)} className="p-2 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-all" title="Delete"><FiTrash2 size={13} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ━━━ PAGINATION ━━━ */}
            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-2.5 rounded-xl bg-white border border-gray-200 text-gray-500 hover:text-indigo-600 hover:border-indigo-300 disabled:opacity-40 transition-all shadow-sm">
                        <FiChevronLeft size={16} />
                    </button>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                        const pg = start + i; if (pg > totalPages) return null;
                        return (
                            <button key={pg} onClick={() => setPage(pg)}
                                className={`w-10 h-10 rounded-xl text-sm font-bold transition-all ${pg === page ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/30' : 'bg-white border border-gray-200 text-gray-600 hover:text-indigo-600 hover:border-indigo-300'}`}>{pg}</button>
                        );
                    })}
                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-2.5 rounded-xl bg-white border border-gray-200 text-gray-500 hover:text-indigo-600 hover:border-indigo-300 disabled:opacity-40 transition-all shadow-sm">
                        <FiChevronRight size={16} />
                    </button>
                </div>
            )}

            {/* ━━━ ADD/EDIT MODAL ━━━ */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-md flex items-center justify-center p-4 z-50" onClick={() => setShowModal(false)}>
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="bg-gradient-to-r from-indigo-600 to-purple-700 px-6 py-5 text-white sticky top-0 z-10 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center"><FiPackage size={20} /></div>
                                <div>
                                    <h2 className="text-lg font-extrabold">{editingProduct ? 'Edit Product' : 'New Product'}</h2>
                                    {editingProduct && <p className="text-indigo-200 text-xs">{editingProduct.product_code}</p>}
                                </div>
                            </div>
                            <button onClick={() => setShowModal(false)} className="p-2 hover:bg-white/20 rounded-xl transition-colors"><FiX size={18} /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-5">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Product Name *</label>
                                    <input type="text" value={formData.product_name} onChange={e => setFormData({ ...formData, product_name: e.target.value })}
                                        placeholder="e.g., Sugar 2Kg" required className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 outline-none font-medium text-sm" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Alias</label>
                                    <input type="text" value={formData.alias} onChange={e => setFormData({ ...formData, alias: e.target.value })} placeholder="Short name"
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-indigo-400 outline-none text-sm" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Category</label>
                                    <select value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-indigo-400 outline-none text-sm cursor-pointer">
                                        <option value="">Select Category</option>
                                        {categories.map(c => <option key={c.category_id} value={c.category_name}>{c.category_name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Barcode</label>
                                    <input type="text" value={formData.barcode} onChange={e => setFormData({ ...formData, barcode: e.target.value })} placeholder="Scan or enter"
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-indigo-400 outline-none text-sm" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">HS Code</label>
                                    <input type="text" value={formData.hscode} onChange={e => setFormData({ ...formData, hscode: e.target.value })} placeholder="Tax code"
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-indigo-400 outline-none text-sm" />
                                </div>
                                {!editingProduct && (
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Opening Qty</label>
                                        <input type="number" value={openingQty} onChange={e => setOpeningQty(Number(e.target.value))} min="0"
                                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-indigo-400 outline-none text-sm" />
                                    </div>
                                )}
                                {/* Image */}
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Product Image</label>
                                    <div className="flex items-start gap-4">
                                        <label className="flex-1 flex flex-col items-center justify-center h-24 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer bg-gray-50 hover:bg-indigo-50 hover:border-indigo-300 transition-all">
                                            <FiUpload className="text-gray-400 mb-1" size={20} />
                                            <p className="text-xs text-gray-500 font-medium">Click to upload (max 500KB)</p>
                                            <input type="file" className="hidden" accept="image/*" onChange={async e => {
                                                const f = e.target.files?.[0]; if (!f) return;
                                                if (f.size > 500 * 1024) { toast.error('Max 500KB'); return; }
                                                const r = new FileReader(); r.onloadend = () => { setFormData({ ...formData, photo: r.result as string }); toast.success('Added!'); }; r.readAsDataURL(f);
                                            }} />
                                        </label>
                                        <div className="w-24 h-24 rounded-xl bg-gray-100 border-2 border-gray-200 overflow-hidden flex items-center justify-center flex-shrink-0">
                                            {formData.photo ? (
                                                <div className="relative w-full h-full">
                                                    <img src={formData.photo} alt="Preview" className="w-full h-full object-cover" />
                                                    <button type="button" onClick={() => setFormData({ ...formData, photo: '' })} className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center"><FiX size={10} /></button>
                                                </div>
                                            ) : <FiImage className="text-gray-300" size={24} />}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Pricing */}
                            <div className="bg-indigo-50/50 rounded-2xl p-5 border border-indigo-100">
                                <h3 className="font-extrabold text-indigo-800 mb-4 flex items-center gap-2 text-sm"><FiDollarSign size={16} /> Pricing & Units</h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-600 mb-1 uppercase tracking-wider">Buy Unit</label>
                                        <select value={formData.purchase_unit} onChange={e => setFormData({ ...formData, purchase_unit: e.target.value })}
                                            className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:border-indigo-400 outline-none">{units.map(u => <option key={u.unit_id} value={u.unit_name}>{u.unit_name}</option>)}</select>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-600 mb-1 uppercase tracking-wider">Buy Price (Ksh)</label>
                                        <input type="number" value={formData.purchase_cost} onChange={e => setFormData({ ...formData, purchase_cost: parseFloat(e.target.value) || 0 })}
                                            className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:border-indigo-400 outline-none" min="0" step="0.01" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-600 mb-1 uppercase tracking-wider">Sell Unit</label>
                                        <select value={formData.sales_unit} onChange={e => setFormData({ ...formData, sales_unit: e.target.value })}
                                            className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:border-indigo-400 outline-none">{units.map(u => <option key={u.unit_id} value={u.unit_name}>{u.unit_name}</option>)}</select>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-600 mb-1 uppercase tracking-wider">Sell Price (Ksh)</label>
                                        <input type="number" value={formData.sales_cost} onChange={e => setFormData({ ...formData, sales_cost: parseFloat(e.target.value) || 0 })}
                                            className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:border-indigo-400 outline-none" min="0" step="0.01" />
                                    </div>
                                </div>
                                {formData.purchase_cost > 0 && formData.sales_cost > 0 && (
                                    <div className="mt-3 p-3 bg-white rounded-xl border border-indigo-200 text-sm">
                                        Margin: <span className="font-extrabold text-indigo-600">{calcMargin(formData.purchase_cost, formData.sales_cost).toFixed(1)}%</span> &bull; Profit: <span className="font-bold">Ksh {(formData.sales_cost - formData.purchase_cost).toLocaleString()}</span>
                                    </div>
                                )}
                            </div>

                            {/* Extra */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">VAT Type</label>
                                    <select value={formData.vat_commodity} onChange={e => setFormData({ ...formData, vat_commodity: e.target.value })}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:border-indigo-400 outline-none">{vatOptions.map(v => <option key={v} value={v}>{v}</option>)}</select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Reorder Point</label>
                                    <input type="number" value={formData.reorder_point} onChange={e => setFormData({ ...formData, reorder_point: parseInt(e.target.value) || 10 })}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:border-indigo-400 outline-none" min="0" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Supplier</label>
                                    <select value={formData.supplier_name} onChange={e => setFormData({ ...formData, supplier_name: e.target.value })}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:border-indigo-400 outline-none cursor-pointer">
                                        <option value="">Select Supplier</option>
                                        <option value={getKitchenSupplier()}>{getKitchenSupplier()}</option>
                                        {suppliers.filter(s => !s.is_kitchen).map(s => <option key={s.supplier_id} value={s.supplier_name}>{s.supplier_name}</option>)}
                                    </select>
                                </div>
                                <div className="md:col-span-3">
                                    <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">POS Button Color</label>
                                    <div className="grid grid-cols-7 gap-2">
                                        {colorPresets.map(c => (
                                            <button key={c.name} type="button" onClick={() => setFormData({ ...formData, button_ui_color: c.gradient })}
                                                className={`h-8 rounded-xl bg-gradient-to-br ${c.gradient} transition-all hover:scale-110 ${formData.button_ui_color === c.gradient ? 'ring-2 ring-offset-2 ring-indigo-500 scale-110' : ''}`} title={c.name} />
                                        ))}
                                    </div>
                                </div>
                                <div className="flex items-center gap-6 pt-4">
                                    <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-gray-700">
                                        <input type="checkbox" checked={formData.active} onChange={e => setFormData({ ...formData, active: e.target.checked })} className="w-4 h-4 rounded accent-indigo-500" /> Active
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-gray-700">
                                        <input type="checkbox" checked={formData.show_ps} onChange={e => setFormData({ ...formData, show_ps: e.target.checked })} className="w-4 h-4 rounded accent-indigo-500" /> Show in POS
                                    </label>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Description</label>
                                <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="Optional..." rows={2}
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:border-indigo-400 outline-none resize-none" />
                            </div>
                            <div className="flex gap-3 pt-4 border-t border-gray-100">
                                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-5 py-3 border-2 border-gray-200 text-gray-600 font-bold rounded-xl hover:bg-gray-50 transition-all text-sm">Cancel</button>
                                <button type="submit" disabled={isSaving}
                                    className="flex-1 px-5 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/30 hover:shadow-xl transition-all flex items-center justify-center gap-2 disabled:opacity-60 text-sm">
                                    {isSaving ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving...</> : <>{editingProduct ? 'Update Product' : 'Create Product'}</>}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
