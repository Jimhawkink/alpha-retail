'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';

interface Product {
    pid: number;
    product_code: string;
    product_name: string;
    alias: string;
    vat_commodity: string;
    description: string;
    barcode: string;
    category: string;
    purchase_unit: string;
    sales_unit: string;
    purchase_cost: number;
    sales_cost: number;
    reorder_point: number;
    margin_per: number;
    show_ps: boolean;
    button_ui_color: string;
    photo: string;
    hscode: string;
    batch_no: string;
    supplier_name: string;
    active: boolean;
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

const defaultUnits: Unit[] = [
    { unit_id: 1, unit_name: 'Piece', abbreviation: 'Pc' },
    { unit_id: 2, unit_name: 'Kilogram', abbreviation: 'Kg' },
    { unit_id: 3, unit_name: 'Gram', abbreviation: 'g' },
    { unit_id: 4, unit_name: 'Liter', abbreviation: 'L' },
    { unit_id: 5, unit_name: 'Milliliter', abbreviation: 'ml' },
    { unit_id: 6, unit_name: 'Box', abbreviation: 'Box' },
    { unit_id: 7, unit_name: 'Pack', abbreviation: 'Pk' },
    { unit_id: 8, unit_name: 'Dozen', abbreviation: 'Dz' },
    { unit_id: 9, unit_name: 'Bottle', abbreviation: 'Btl' },
    { unit_id: 10, unit_name: 'Plate', abbreviation: 'Plt' },
    { unit_id: 11, unit_name: 'Serving', abbreviation: 'Srv' },
    { unit_id: 12, unit_name: 'Cup', abbreviation: 'Cup' },
];

export default function ProductsPage() {
    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [units, setUnits] = useState<Unit[]>(defaultUnits);
    const [companyName, setCompanyName] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [formData, setFormData] = useState(defaultProduct);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCategory, setFilterCategory] = useState('All');
    const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
    const [isSaving, setIsSaving] = useState(false);
    const [openingQty, setOpeningQty] = useState(0);
    const [selectedProducts, setSelectedProducts] = useState<number[]>([]);
    const [stockData, setStockData] = useState<Record<number, number>>({});
    const [sortField, setSortField] = useState<'name' | 'price' | 'stock' | 'margin'>('name');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 15;

    const loadProducts = useCallback(async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase.from('retail_products').select('*').order('pid', { ascending: false });
            if (error) throw error;
            setProducts(data || []);
        } catch (err) { console.error('Error loading products:', err); toast.error('Failed to load products'); }
        setIsLoading(false);
    }, []);

    const loadStockData = useCallback(async () => {
        try {
            const { data, error } = await supabase.from('retail_stock').select('pid, qty');
            if (error) throw error;
            const m: Record<number, number> = {};
            (data || []).forEach((s: { pid: number; qty: number }) => { m[s.pid] = (m[s.pid] || 0) + (s.qty || 0); });
            setStockData(m);
        } catch (err) { console.error('Error loading stock:', err); }
    }, []);

    const loadCategories = useCallback(async () => {
        try {
            const { data, error } = await supabase.from('retail_categories').select('*').eq('active', true).order('category_name');
            if (error) throw error;
            setCategories(data || []);
        } catch (err) { console.error('Error loading categories:', err); }
    }, []);

    const loadSuppliers = useCallback(async () => {
        try {
            const { data, error } = await supabase.from('retail_suppliers').select('supplier_id, supplier_code, supplier_name').eq('active', true).order('supplier_name');
            if (error) throw error;
            setSuppliers(data || []);
        } catch (err) { console.error('Error loading suppliers:', err); }
    }, []);

    const loadUnits = useCallback(async () => {
        try {
            const { data, error } = await supabase.from('product_units').select('unit_id, unit_name, abbreviation').eq('active', true).order('unit_name');
            if (error) throw error;
            setUnits(data || []);
        } catch { setUnits(defaultUnits); }
    }, []);

    const loadCompanyName = useCallback(async () => {
        try {
            const { data, error } = await supabase.from('organisation_settings').select('setting_value').eq('setting_key', 'company_name').single();
            if (error) throw error;
            if (data?.setting_value) setCompanyName(data.setting_value.trim());
        } catch { setCompanyName('Alpha Retail'); }
    }, []);

    useEffect(() => {
        loadProducts(); loadStockData(); loadCategories(); loadSuppliers(); loadUnits(); loadCompanyName();
    }, [loadProducts, loadStockData, loadCategories, loadSuppliers, loadUnits, loadCompanyName]);

    const getKitchenSupplier = () => companyName || 'Kitchen';

    const generateBarcode = async (): Promise<string> => {
        try {
            const { data } = await supabase.from('retail_products').select('barcode').like('barcode', '1%').order('barcode', { ascending: false }).limit(1);
            if (data?.length && data[0].barcode) return String((parseInt(data[0].barcode) || 100) + 1);
            return '101';
        } catch { return '101'; }
    };

    const generateProductCode = async (): Promise<string> => {
        try {
            const { data } = await supabase.from('retail_products').select('product_code').like('product_code', 'PRD-%').order('product_code', { ascending: false }).limit(1);
            if (data?.length) { const n = parseInt(data[0].product_code.replace('PRD-', '')) || 0; return `PRD-${String(n + 1).padStart(2, '0')}`; }
            return 'PRD-01';
        } catch { return 'PRD-01'; }
    };

    const calcMargin = (pc: number, sc: number) => pc <= 0 ? 0 : Math.round(((sc - pc) / pc) * 10000) / 100;

    const openAddModal = async () => {
        setEditingProduct(null);
        const bc = await generateBarcode();
        setFormData({ ...defaultProduct, barcode: bc, supplier_name: getKitchenSupplier() });
        setOpeningQty(0);
        setShowModal(true);
    };

    const openEditModal = (p: Product) => {
        setEditingProduct(p);
        setFormData({
            product_name: p.product_name, alias: p.alias || '', vat_commodity: p.vat_commodity || 'Standard',
            description: p.description || '', barcode: p.barcode || '', category: p.category || '',
            purchase_unit: p.purchase_unit || 'Piece', sales_unit: p.sales_unit || 'Piece',
            purchase_cost: p.purchase_cost || 0, sales_cost: p.sales_cost || 0,
            reorder_point: p.reorder_point || 10, margin_per: p.margin_per || 0,
            show_ps: p.show_ps !== false, button_ui_color: p.button_ui_color || 'from-blue-400 to-blue-600',
            photo: p.photo || '', hscode: p.hscode || '', batch_no: p.batch_no || '',
            supplier_name: p.supplier_name || '', active: p.active !== false,
        });
        setShowModal(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.product_name.trim()) { toast.error('Product name required!'); return; }
        setIsSaving(true);
        try {
            const margin = calcMargin(formData.purchase_cost, formData.sales_cost);
            const productData = {
                product_name: formData.product_name, alias: formData.alias || null,
                description: formData.description || null, barcode: formData.barcode || null,
                category: formData.category || null, purchase_unit: formData.purchase_unit,
                sales_unit: formData.sales_unit, purchase_cost: formData.purchase_cost || 0,
                sales_cost: formData.sales_cost || 0, reorder_point: formData.reorder_point || 10,
                margin_per: margin, show_in_pos: formData.show_ps !== false,
                button_ui_color: formData.button_ui_color, photo: formData.photo || null,
                batch_no: formData.batch_no || null, supplier_name: formData.supplier_name || null,
                active: formData.active !== false,
            };
            if (editingProduct) {
                const { error } = await supabase.from('retail_products').update({ ...productData, updated_at: new Date().toISOString() }).eq('pid', editingProduct.pid);
                if (error) throw new Error(error.message);
                toast.success('Product updated! ✓');
            } else {
                const newCode = await generateProductCode();
                const { data: np, error } = await supabase.from('retail_products').insert({ ...productData, product_code: newCode, created_at: new Date().toISOString() }).select().single();
                if (error) throw new Error(error.message);
                if (openingQty > 0 && np) {
                    await supabase.from('retail_stock').insert({ pid: np.pid, invoice_no: 'OPENING', qty: openingQty, storage_type: 'Store' });
                }
                toast.success(`Product ${newCode} created! ✓`);
            }
            setShowModal(false); loadProducts(); loadStockData();
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Unknown error';
            toast.error(`Failed: ${msg}`);
        }
        setIsSaving(false);
    };

    const deleteProduct = async (p: Product) => {
        if (!confirm(`Delete "${p.product_name}"?`)) return;
        try {
            const { error } = await supabase.from('retail_products').delete().eq('pid', p.pid);
            if (error) throw error;
            toast.success('Product deleted'); loadProducts();
        } catch { toast.error('Failed to delete'); }
    };

    const exportCSV = () => {
        const csv = [
            ['Code', 'Name', 'Category', 'Purchase', 'Sales', 'Stock', 'Margin%', 'Status'].join(','),
            ...filteredProducts.map(p => [p.product_code, `"${p.product_name}"`, p.category || '', p.purchase_cost, p.sales_cost, stockData[p.pid] || 0, p.margin_per?.toFixed(1), p.active ? 'Active' : 'Inactive'].join(','))
        ].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'products.csv'; a.click();
        toast.success('Exported to CSV! 📥');
    };

    // Filtering + sorting
    const filteredProducts = products.filter(p => {
        const q = searchQuery.toLowerCase();
        const matchSearch = p.product_name.toLowerCase().includes(q) || p.product_code.toLowerCase().includes(q) || (p.barcode && p.barcode.includes(searchQuery));
        const matchCat = filterCategory === 'All' || p.category === filterCategory;
        const matchStatus = filterStatus === 'all' || (filterStatus === 'active' ? p.active : !p.active);
        return matchSearch && matchCat && matchStatus;
    }).sort((a, b) => {
        let cmp = 0;
        if (sortField === 'name') cmp = a.product_name.localeCompare(b.product_name);
        else if (sortField === 'price') cmp = (a.sales_cost || 0) - (b.sales_cost || 0);
        else if (sortField === 'stock') cmp = (stockData[a.pid] || 0) - (stockData[b.pid] || 0);
        else if (sortField === 'margin') cmp = (a.margin_per || 0) - (b.margin_per || 0);
        return sortDir === 'asc' ? cmp : -cmp;
    });

    const totalPages = Math.ceil(filteredProducts.length / pageSize);
    const paginatedProducts = filteredProducts.slice((currentPage - 1) * pageSize, currentPage * pageSize);
    const totalProducts = products.length;
    const activeProducts = products.filter(p => p.active).length;
    const lowStockCount = products.filter(p => (stockData[p.pid] || 0) <= (p.reorder_point || 10) && p.active).length;
    const totalStockValue = products.reduce((s, p) => s + (stockData[p.pid] || 0) * (p.sales_cost || 0), 0);

    const handleSort = (field: typeof sortField) => {
        if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortField(field); setSortDir('asc'); }
    };

    const SortIcon = ({ field }: { field: typeof sortField }) => (
        <span className="ml-1 text-[10px]">{sortField === field ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}</span>
    );

    return (
        <div className="space-y-5">
            {/* ═══ HERO HEADER ═══ */}
            <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700 rounded-3xl p-6 text-white relative overflow-hidden shadow-xl">
                <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4" />
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/4" />
                <div className="relative flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center text-4xl shadow-lg border border-white/20">📦</div>
                        <div>
                            <h1 className="text-2xl font-extrabold tracking-tight">Products Master</h1>
                            <p className="text-emerald-100 text-sm mt-0.5">Inventory Control • SKU Management • Price Engine</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={exportCSV} className="px-4 py-2.5 bg-white/15 hover:bg-white/25 backdrop-blur-sm rounded-xl text-sm font-semibold transition-all border border-white/20 flex items-center gap-2">📥 Export</button>
                        <button onClick={openAddModal} className="px-5 py-2.5 bg-white text-emerald-700 hover:bg-emerald-50 rounded-xl text-sm font-bold shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center gap-2">
                            <span className="text-lg">＋</span> New Product
                        </button>
                    </div>
                </div>
            </div>

            {/* ═══ STAT CARDS ═══ */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow group">
                    <div className="flex items-center justify-between mb-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-xl text-white shadow-md group-hover:scale-110 transition-transform">📦</div>
                        <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded-full">TOTAL</span>
                    </div>
                    <p className="text-3xl font-extrabold text-gray-800">{totalProducts}</p>
                    <p className="text-xs text-gray-500 mt-1 font-medium">Total Registry</p>
                </div>
                <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow group">
                    <div className="flex items-center justify-between mb-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl flex items-center justify-center text-xl text-white shadow-md group-hover:scale-110 transition-transform">✅</div>
                        <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">LIVE</span>
                    </div>
                    <p className="text-3xl font-extrabold text-gray-800">{activeProducts}</p>
                    <p className="text-xs text-gray-500 mt-1 font-medium">Active SKUs</p>
                </div>
                <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow group">
                    <div className="flex items-center justify-between mb-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center text-xl text-white shadow-md group-hover:scale-110 transition-transform">🏷️</div>
                        <span className="text-xs font-semibold text-violet-600 bg-violet-50 px-2 py-1 rounded-full">GROUPS</span>
                    </div>
                    <p className="text-3xl font-extrabold text-gray-800">{categories.length}</p>
                    <p className="text-xs text-gray-500 mt-1 font-medium">Categories</p>
                </div>
                <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow group">
                    <div className="flex items-center justify-between mb-3">
                        <div className={`w-12 h-12 bg-gradient-to-br ${lowStockCount > 0 ? 'from-red-500 to-orange-600' : 'from-teal-500 to-cyan-600'} rounded-xl flex items-center justify-center text-xl text-white shadow-md group-hover:scale-110 transition-transform`}>{lowStockCount > 0 ? '⚠️' : '💎'}</div>
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${lowStockCount > 0 ? 'text-red-600 bg-red-50' : 'text-teal-600 bg-teal-50'}`}>{lowStockCount > 0 ? 'ALERT' : 'OK'}</span>
                    </div>
                    <p className="text-3xl font-extrabold text-gray-800">{lowStockCount}</p>
                    <p className="text-xs text-gray-500 mt-1 font-medium">Low Inventory</p>
                </div>
            </div>

            {/* Stock value ribbon */}
            <div className="bg-gradient-to-r from-slate-800 via-slate-900 to-slate-800 rounded-2xl px-6 py-3 flex items-center justify-between text-white">
                <div className="flex items-center gap-3">
                    <span className="text-lg">💰</span>
                    <span className="text-sm font-medium text-slate-300">Total Stock Value</span>
                    <span className="text-lg font-extrabold">Ksh {totalStockValue.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-400">
                    <span>📋 Showing {filteredProducts.length} of {totalProducts}</span>
                    <span>•</span>
                    <span>🔄 Page {currentPage}/{totalPages || 1}</span>
                </div>
            </div>

            {/* ═══ SEARCH + FILTERS ═══ */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <div className="flex flex-col lg:flex-row gap-3">
                    <div className="flex-1 relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl">🔍</span>
                        <input type="text" placeholder="Search products by name, code, or barcode..." value={searchQuery}
                            onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                            className="w-full pl-12 pr-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all font-medium" />
                    </div>
                    <select value={filterCategory} onChange={e => { setFilterCategory(e.target.value); setCurrentPage(1); }}
                        className="px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-gray-700 focus:outline-none focus:border-emerald-500 cursor-pointer font-medium min-w-[160px]">
                        <option value="All">🏷️ All Categories</option>
                        {categories.map(c => <option key={c.category_id} value={c.category_name}>{c.icon} {c.category_name}</option>)}
                    </select>
                    <div className="flex rounded-xl overflow-hidden border-2 border-gray-200">
                        {(['all', 'active', 'inactive'] as const).map(s => (
                            <button key={s} onClick={() => { setFilterStatus(s); setCurrentPage(1); }}
                                className={`px-4 py-3 text-sm font-semibold transition-all ${filterStatus === s
                                    ? 'bg-emerald-500 text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>
                                {s === 'all' ? '📋 All' : s === 'active' ? '✅ Active' : '⏸️ Inactive'}
                            </button>
                        ))}
                    </div>
                    <button onClick={() => { loadProducts(); loadStockData(); }} className="px-5 py-3 bg-emerald-50 text-emerald-700 rounded-xl hover:bg-emerald-100 font-semibold transition-all flex items-center gap-2 border-2 border-emerald-200">
                        🔄 Refresh
                    </button>
                </div>
            </div>

            {/* ═══ DATA GRID ═══ */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-gradient-to-r from-slate-700 via-slate-800 to-slate-700">
                                <th className="px-3 py-3.5 text-center w-10">
                                    <input type="checkbox" checked={selectedProducts.length === paginatedProducts.length && paginatedProducts.length > 0}
                                        onChange={e => setSelectedProducts(e.target.checked ? paginatedProducts.map(p => p.pid) : [])}
                                        className="w-4 h-4 rounded cursor-pointer accent-emerald-500" />
                                </th>
                                <th className="px-3 py-3.5 text-left text-[11px] font-bold text-slate-300 uppercase tracking-wider">Product</th>
                                <th className="px-3 py-3.5 text-left text-[11px] font-bold text-slate-300 uppercase tracking-wider hidden md:table-cell">Category</th>
                                <th onClick={() => handleSort('price')} className="px-3 py-3.5 text-right text-[11px] font-bold text-slate-300 uppercase tracking-wider cursor-pointer hover:text-white">
                                    Buy / Sell <SortIcon field="price" />
                                </th>
                                <th onClick={() => handleSort('stock')} className="px-3 py-3.5 text-center text-[11px] font-bold text-slate-300 uppercase tracking-wider cursor-pointer hover:text-white">
                                    Stock <SortIcon field="stock" />
                                </th>
                                <th onClick={() => handleSort('margin')} className="px-3 py-3.5 text-center text-[11px] font-bold text-slate-300 uppercase tracking-wider cursor-pointer hover:text-white hidden lg:table-cell">
                                    Margin <SortIcon field="margin" />
                                </th>
                                <th className="px-3 py-3.5 text-center text-[11px] font-bold text-slate-300 uppercase tracking-wider">Status</th>
                                <th className="px-3 py-3.5 text-center text-[11px] font-bold text-slate-300 uppercase tracking-wider w-32">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {isLoading ? (
                                <tr><td colSpan={8} className="py-16 text-center">
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
                                        <span className="text-gray-500 font-medium">Loading products...</span>
                                    </div>
                                </td></tr>
                            ) : paginatedProducts.length === 0 ? (
                                <tr><td colSpan={8} className="py-16 text-center">
                                    <div className="flex flex-col items-center gap-3">
                                        <span className="text-6xl">📦</span>
                                        <p className="text-gray-500 font-medium">No products found</p>
                                        <button onClick={openAddModal} className="px-5 py-2 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 font-semibold transition-all">Add First Product</button>
                                    </div>
                                </td></tr>
                            ) : paginatedProducts.map(p => {
                                const stk = stockData[p.pid] || 0;
                                const isLow = stk <= (p.reorder_point || 10) && p.active;
                                return (
                                    <tr key={p.pid} className={`hover:bg-emerald-50/40 transition-colors ${selectedProducts.includes(p.pid) ? 'bg-emerald-50' : ''} ${isLow ? 'border-l-4 border-l-red-400' : ''}`}>
                                        <td className="px-3 py-3 text-center">
                                            <input type="checkbox" checked={selectedProducts.includes(p.pid)}
                                                onChange={e => setSelectedProducts(e.target.checked ? [...selectedProducts, p.pid] : selectedProducts.filter(id => id !== p.pid))}
                                                className="w-4 h-4 rounded cursor-pointer accent-emerald-500" />
                                        </td>
                                        <td className="px-3 py-3">
                                            <div className="flex items-center gap-3">
                                                {p.photo ? (
                                                    <div className="w-10 h-10 rounded-xl bg-gray-100 overflow-hidden border border-gray-200 flex-shrink-0 shadow-sm">
                                                        <img src={p.photo} alt={p.product_name} className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                                    </div>
                                                ) : (
                                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold bg-gradient-to-br ${p.button_ui_color || 'from-blue-400 to-blue-600'} shadow-sm`}>
                                                        {p.product_name.charAt(0).toUpperCase()}
                                                    </div>
                                                )}
                                                <div>
                                                    <p className="text-sm font-semibold text-gray-800 leading-tight">{p.product_name}</p>
                                                    <p className="text-[11px] text-emerald-600 font-medium mt-0.5">{p.product_code}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-3 py-3 hidden md:table-cell">
                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-violet-50 text-violet-700 rounded-lg text-[11px] font-semibold">{p.category || 'N/A'}</span>
                                        </td>
                                        <td className="px-3 py-3 text-right">
                                            <p className="text-[11px] text-gray-400">Ksh {(p.purchase_cost || 0).toLocaleString()}</p>
                                            <p className="text-sm font-bold text-gray-800">Ksh {(p.sales_cost || 0).toLocaleString()}</p>
                                        </td>
                                        <td className="px-3 py-3 text-center">
                                            <span className={`inline-flex items-center justify-center min-w-[40px] px-2.5 py-1 rounded-lg text-xs font-bold ${stk > 10 ? 'bg-emerald-100 text-emerald-700' : stk > 0 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{stk}</span>
                                        </td>
                                        <td className="px-3 py-3 text-center hidden lg:table-cell">
                                            <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${(p.margin_per || 0) >= 30 ? 'bg-emerald-100 text-emerald-700' : (p.margin_per || 0) >= 15 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                                                {p.margin_per?.toFixed(1) || '0'}%
                                            </span>
                                        </td>
                                        <td className="px-3 py-3 text-center">
                                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold ${p.active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${p.active ? 'bg-emerald-500' : 'bg-gray-400'}`} />{p.active ? 'Active' : 'Off'}
                                            </span>
                                        </td>
                                        <td className="px-3 py-3">
                                            <div className="flex items-center justify-center gap-1">
                                                <button onClick={() => openEditModal(p)} className="p-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg transition-all" title="Edit">✏️</button>
                                                <button onClick={() => window.location.href = `/dashboard/purchase?product=${p.pid}`} className="p-2 bg-green-50 hover:bg-green-100 text-green-600 rounded-lg transition-all" title="Purchase">🛒</button>
                                                <button onClick={() => deleteProduct(p)} className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-all" title="Delete">🗑️</button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-t border-gray-100">
                        <p className="text-sm text-gray-500 font-medium">{filteredProducts.length} products • Page {currentPage} of {totalPages}</p>
                        <div className="flex items-center gap-1">
                            <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-white disabled:opacity-40 transition-all">«</button>
                            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-white disabled:opacity-40 transition-all">‹</button>
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                const start = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
                                const pg = start + i;
                                if (pg > totalPages) return null;
                                return (
                                    <button key={pg} onClick={() => setCurrentPage(pg)}
                                        className={`w-9 h-9 rounded-lg text-sm font-bold transition-all ${pg === currentPage ? 'bg-emerald-500 text-white shadow-md' : 'text-gray-600 hover:bg-white'}`}>{pg}</button>
                                );
                            })}
                            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-white disabled:opacity-40 transition-all">›</button>
                            <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} className="px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-white disabled:opacity-40 transition-all">»</button>
                        </div>
                    </div>
                )}
            </div>

            {/* ═══ ADD/EDIT MODAL ═══ */}
            {showModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
                        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700 px-6 py-5 text-white sticky top-0 z-10">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-extrabold flex items-center gap-2">{editingProduct ? '✏️ Edit Product' : '＋ New Product'}</h2>
                                <button onClick={() => setShowModal(false)} className="p-2 hover:bg-white/20 rounded-full transition-colors text-lg">✕</button>
                            </div>
                            {editingProduct && <p className="text-emerald-100 text-sm mt-1">Code: {editingProduct.product_code}</p>}
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-5">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-bold text-gray-700 mb-1.5">📦 Product Name <span className="text-red-500">*</span></label>
                                    <input type="text" value={formData.product_name} onChange={e => setFormData({ ...formData, product_name: e.target.value })}
                                        placeholder="e.g., Sugar 2Kg" required className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-gray-800 focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 font-medium" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1.5">📝 Alias</label>
                                    <input type="text" value={formData.alias} onChange={e => setFormData({ ...formData, alias: e.target.value })} placeholder="Short name"
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 focus:outline-none focus:border-emerald-500" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1.5">🏷️ Category</label>
                                    <select value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 focus:outline-none focus:border-emerald-500 cursor-pointer">
                                        <option value="">Select Category</option>
                                        {categories.map(c => <option key={c.category_id} value={c.category_name}>{c.icon} {c.category_name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1.5">📊 Barcode</label>
                                    <input type="text" value={formData.barcode} onChange={e => setFormData({ ...formData, barcode: e.target.value })} placeholder="Scan or enter"
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 focus:outline-none focus:border-emerald-500" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1.5">🔢 HS Code</label>
                                    <input type="text" value={formData.hscode} onChange={e => setFormData({ ...formData, hscode: e.target.value })} placeholder="Tax code"
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 focus:outline-none focus:border-emerald-500" />
                                </div>
                                {!editingProduct && (
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1.5">📦 Opening Qty</label>
                                        <input type="number" value={openingQty} onChange={e => setOpeningQty(Number(e.target.value))} min="0" placeholder="Initial stock"
                                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 focus:outline-none focus:border-emerald-500" />
                                    </div>
                                )}
                                {/* Image Upload */}
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-bold text-gray-700 mb-1.5">🖼️ Product Image</label>
                                    <div className="flex items-start gap-4">
                                        <label className="flex-1 flex flex-col items-center justify-center h-28 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer bg-gray-50 hover:bg-gray-100 hover:border-emerald-400 transition-all">
                                            <span className="text-2xl mb-1">📷</span>
                                            <p className="text-xs text-gray-500 font-medium">Click to upload (max 500KB)</p>
                                            <input type="file" className="hidden" accept="image/*" onChange={async e => {
                                                const file = e.target.files?.[0]; if (!file) return;
                                                if (file.size > 500 * 1024) { toast.error('Max 500KB'); return; }
                                                const reader = new FileReader();
                                                reader.onloadend = () => { setFormData({ ...formData, photo: reader.result as string }); toast.success('Image added!'); };
                                                reader.readAsDataURL(file);
                                            }} />
                                        </label>
                                        <div className="w-28 h-28 rounded-xl bg-gray-100 border-2 border-gray-200 overflow-hidden flex items-center justify-center flex-shrink-0">
                                            {formData.photo ? (
                                                <div className="relative w-full h-full">
                                                    <img src={formData.photo} alt="Preview" className="w-full h-full object-cover" />
                                                    <button type="button" onClick={() => setFormData({ ...formData, photo: '' })} className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center">✕</button>
                                                </div>
                                            ) : <span className="text-gray-400 text-2xl">📦</span>}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Pricing */}
                            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-2xl p-5 border border-emerald-200">
                                <h3 className="font-extrabold text-emerald-800 mb-4 flex items-center gap-2">💰 Pricing & Units</h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Purchase Unit</label>
                                        <select value={formData.purchase_unit} onChange={e => setFormData({ ...formData, purchase_unit: e.target.value })}
                                            className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-800 focus:outline-none focus:border-emerald-500 text-sm">
                                            {units.map(u => <option key={u.unit_id} value={u.unit_name}>{u.unit_name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Purchase Cost (Ksh)</label>
                                        <input type="number" value={formData.purchase_cost} onChange={e => setFormData({ ...formData, purchase_cost: parseFloat(e.target.value) || 0 })}
                                            className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-800 focus:outline-none focus:border-emerald-500 text-sm" min="0" step="0.01" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Sales Unit</label>
                                        <select value={formData.sales_unit} onChange={e => setFormData({ ...formData, sales_unit: e.target.value })}
                                            className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-800 focus:outline-none focus:border-emerald-500 text-sm">
                                            {units.map(u => <option key={u.unit_id} value={u.unit_name}>{u.unit_name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Sales Price (Ksh)</label>
                                        <input type="number" value={formData.sales_cost} onChange={e => setFormData({ ...formData, sales_cost: parseFloat(e.target.value) || 0 })}
                                            className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-800 focus:outline-none focus:border-emerald-500 text-sm" min="0" step="0.01" />
                                    </div>
                                </div>
                                {formData.purchase_cost > 0 && formData.sales_cost > 0 && (
                                    <div className="mt-3 p-3 bg-white rounded-xl border border-emerald-200 flex items-center gap-4">
                                        <span className="text-sm text-gray-600">Margin: <span className="font-extrabold text-emerald-600">{calcMargin(formData.purchase_cost, formData.sales_cost).toFixed(1)}%</span></span>
                                        <span className="text-sm text-gray-500">• Profit: <span className="font-bold">Ksh {(formData.sales_cost - formData.purchase_cost).toLocaleString()}</span></span>
                                    </div>
                                )}
                            </div>

                            {/* Extra fields */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1.5">📊 VAT Type</label>
                                    <select value={formData.vat_commodity} onChange={e => setFormData({ ...formData, vat_commodity: e.target.value })}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 focus:outline-none focus:border-emerald-500">
                                        {vatOptions.map(v => <option key={v} value={v}>{v}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1.5">⚠️ Reorder Point</label>
                                    <input type="number" value={formData.reorder_point} onChange={e => setFormData({ ...formData, reorder_point: parseInt(e.target.value) || 10 })}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 focus:outline-none focus:border-emerald-500" min="0" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1.5">🏭 Supplier</label>
                                    <select value={formData.supplier_name} onChange={e => setFormData({ ...formData, supplier_name: e.target.value })}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 focus:outline-none focus:border-emerald-500 cursor-pointer">
                                        <option value="">Select Supplier</option>
                                        <option value={getKitchenSupplier()}>🍳 {getKitchenSupplier()}</option>
                                        {suppliers.filter(s => !s.is_kitchen).map(s => <option key={s.supplier_id} value={s.supplier_name}>🏢 {s.supplier_name}</option>)}
                                    </select>
                                </div>
                                <div className="md:col-span-3">
                                    <label className="block text-sm font-bold text-gray-700 mb-1.5">🎨 POS Button Color</label>
                                    <div className="grid grid-cols-7 gap-2">
                                        {colorPresets.map(c => (
                                            <button key={c.name} type="button" onClick={() => setFormData({ ...formData, button_ui_color: c.gradient })}
                                                className={`h-9 rounded-xl bg-gradient-to-br ${c.gradient} transition-all hover:scale-110 ${formData.button_ui_color === c.gradient ? 'ring-2 ring-offset-2 ring-emerald-500 scale-110' : ''}`} title={c.name} />
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1.5">📋 Batch No</label>
                                    <input type="text" value={formData.batch_no} onChange={e => setFormData({ ...formData, batch_no: e.target.value })} placeholder="Batch"
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 focus:outline-none focus:border-emerald-500" />
                                </div>
                                <div className="flex items-center gap-6 pt-6">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="checkbox" checked={formData.active} onChange={e => setFormData({ ...formData, active: e.target.checked })} className="w-5 h-5 rounded accent-emerald-500" />
                                        <span className="font-semibold text-gray-700 text-sm">Active</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="checkbox" checked={formData.show_ps} onChange={e => setFormData({ ...formData, show_ps: e.target.checked })} className="w-5 h-5 rounded accent-emerald-500" />
                                        <span className="font-semibold text-gray-700 text-sm">Show in POS</span>
                                    </label>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1.5">📝 Description</label>
                                <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="Optional description..." rows={2}
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 focus:outline-none focus:border-emerald-500 resize-none" />
                            </div>
                            <div className="flex gap-3 pt-4 border-t border-gray-100">
                                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-6 py-3 border-2 border-gray-200 text-gray-600 font-bold rounded-xl hover:bg-gray-50 transition-all">Cancel</button>
                                <button type="submit" disabled={isSaving}
                                    className="flex-1 px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-300/40 transition-all flex items-center justify-center gap-2 disabled:opacity-60">
                                    {isSaving ? (<><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving...</>) : (<>{editingProduct ? '💾 Update' : '＋ Create'}</>)}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
