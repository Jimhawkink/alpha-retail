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

interface Category {
    category_id: number;
    category_name: string;
    icon: string;
    color: string;
}

interface Supplier {
    supplier_id: number;
    supplier_code: string;
    supplier_name: string;
    is_kitchen?: boolean;
}

interface Unit {
    unit_id: number;
    unit_name: string;
    abbreviation: string;
}

const defaultProduct: Omit<Product, 'pid' | 'product_code'> = {
    product_name: '',
    alias: '',
    vat_commodity: 'Standard',
    description: '',
    barcode: '',
    category: '',
    purchase_unit: 'Piece',
    sales_unit: 'Piece',
    purchase_cost: 0,
    sales_cost: 0,
    reorder_point: 10,
    margin_per: 0,
    show_ps: true,
    button_ui_color: 'from-blue-400 to-blue-600',
    photo: '',
    hscode: '',
    batch_no: '',
    supplier_name: '',
    active: true,
};

const vatOptions = ['Standard', 'Zero Rated', 'Exempt', 'Inclusive'];

// POS Button Color Presets (matching POS page)
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

export default function ProductsPage() {
    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [units, setUnits] = useState<Unit[]>([]);
    const [companyName, setCompanyName] = useState<string>('');
    const [isLoading, setIsLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [formData, setFormData] = useState(defaultProduct);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCategory, setFilterCategory] = useState('All');
    const [isSaving, setIsSaving] = useState(false);
    const [openingQty, setOpeningQty] = useState(0);
    const [selectedProducts, setSelectedProducts] = useState<number[]>([]);
    const [stockData, setStockData] = useState<Record<number, number>>({});
    const [showPriceList, setShowPriceList] = useState(false);

    const loadProducts = useCallback(async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('retail_products')
                .select('*')
                .order('pid', { ascending: false });

            if (error) throw error;
            setProducts(data || []);
        } catch (err) {
            console.error('Error loading products:', err);
            toast.error('Failed to load products');
        }
        setIsLoading(false);
    }, []);

    const loadStockData = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('retail_stock')
                .select('pid, qty');

            if (error) throw error;

            const stockMap: Record<number, number> = {};
            (data || []).forEach((s: { pid: number; qty: number }) => {
                stockMap[s.pid] = (stockMap[s.pid] || 0) + (s.qty || 0);
            });
            setStockData(stockMap);
        } catch (err) {
            console.error('Error loading stock data:', err);
        }
    }, []);

    const loadCategories = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('retail_categories')
                .select('*')
                .eq('active', true)
                .order('category_name');

            if (error) throw error;
            setCategories(data || []);
        } catch (err) {
            console.error('Error loading categories:', err);
        }
    }, []);

    const loadSuppliers = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('retail_suppliers')
                .select('supplier_id, supplier_code, supplier_name')
                .eq('active', true)
                .order('supplier_name');

            if (error) throw error;
            setSuppliers(data || []);
        } catch (err) {
            console.error('Error loading suppliers:', err);
        }
    }, []);

    const loadUnits = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('product_units')
                .select('unit_id, unit_name, abbreviation')
                .eq('active', true)
                .order('unit_name');

            if (error) throw error;
            setUnits(data || []);
        } catch (err) {
            console.error('Error loading units:', err);
            // Fallback to default units if table doesn't exist
            setUnits([
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
            ]);
        }
    }, []);

    const loadCompanyName = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('organisation_settings')
                .select('setting_value')
                .eq('setting_key', 'company_name')
                .single();

            if (error) throw error;
            if (data?.setting_value) {
                // Remove "Hotel" from name and add "Kitchen"
                const name = data.setting_value.replace(/\s*Hotel\s*/gi, ' ').trim();
                setCompanyName(`${name} Kitchen`);
            }
        } catch (err) {
            console.error('Error loading company name:', err);
            setCompanyName('Kitchen');
        }
    }, []);

    useEffect(() => {
        loadProducts();
        loadStockData();
        loadCategories();
        loadSuppliers();
        loadUnits();
        loadCompanyName();
    }, [loadProducts, loadStockData, loadCategories, loadSuppliers, loadUnits, loadCompanyName]);

    // Get kitchen supplier name (default)
    const getKitchenSupplier = () => companyName || 'Kitchen';

    // Generate auto barcode starting from 101
    const generateBarcode = async (): Promise<string> => {
        try {
            const { data } = await supabase
                .from('retail_products')
                .select('barcode')
                .like('barcode', '1%')
                .order('barcode', { ascending: false })
                .limit(1);

            if (data && data.length > 0 && data[0].barcode) {
                const lastBarcode = parseInt(data[0].barcode) || 100;
                return String(lastBarcode + 1);
            }
            return '101';
        } catch {
            return '101';
        }
    };

    const generateProductCode = async (): Promise<string> => {
        try {
            const { data } = await supabase
                .from('retail_products')
                .select('product_code')
                .like('product_code', 'PRD-%')
                .order('product_code', { ascending: false })
                .limit(1);

            if (data && data.length > 0) {
                const lastCode = data[0].product_code;
                const lastNum = parseInt(lastCode.replace('PRD-', '')) || 0;
                return `PRD-${String(lastNum + 1).padStart(2, '0')}`;
            }
            return 'PRD-01';
        } catch {
            return 'PRD-01';
        }
    };

    const calculateMargin = (purchaseCost: number, salesCost: number): number => {
        if (purchaseCost <= 0) return 0;
        return Math.round(((salesCost - purchaseCost) / purchaseCost) * 100 * 100) / 100;
    };

    const openAddModal = async () => {
        setEditingProduct(null);
        const newBarcode = await generateBarcode();
        setFormData({
            ...defaultProduct,
            barcode: newBarcode,
            supplier_name: getKitchenSupplier(), // Default to kitchen for food items
        });
        setOpeningQty(0);
        setShowModal(true);
    };

    const openEditModal = (product: Product) => {
        setEditingProduct(product);
        setFormData({
            product_name: product.product_name,
            alias: product.alias || '',
            vat_commodity: product.vat_commodity || 'Standard',
            description: product.description || '',
            barcode: product.barcode || '',
            category: product.category || '',
            purchase_unit: product.purchase_unit || 'Piece',
            sales_unit: product.sales_unit || 'Piece',
            purchase_cost: product.purchase_cost || 0,
            sales_cost: product.sales_cost || 0,
            reorder_point: product.reorder_point || 10,
            margin_per: product.margin_per || 0,
            show_ps: product.show_ps !== false,
            button_ui_color: product.button_ui_color || 'from-blue-400 to-blue-600',
            photo: product.photo || '',
            hscode: product.hscode || '',
            batch_no: product.batch_no || '',
            supplier_name: product.supplier_name || '',
            active: product.active !== false,
        });
        setShowModal(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.product_name.trim()) {
            toast.error('Product name required!');
            return;
        }

        setIsSaving(true);
        try {
            const margin = calculateMargin(formData.purchase_cost, formData.sales_cost);

            // Prepare product data for database
            const productData = {
                product_name: formData.product_name,
                alias: formData.alias || null,
                description: formData.description || null,
                barcode: formData.barcode || null,
                category: formData.category || null,
                purchase_unit: formData.purchase_unit,
                sales_unit: formData.sales_unit,
                purchase_cost: formData.purchase_cost || 0,
                sales_cost: formData.sales_cost || 0,
                reorder_point: formData.reorder_point || 10,
                margin_per: margin,
                show_in_pos: formData.show_ps !== false,
                button_ui_color: formData.button_ui_color,
                photo: formData.photo || null,
                batch_no: formData.batch_no || null,
                supplier_name: formData.supplier_name || null,
                active: formData.active !== false,
            };

            if (editingProduct) {
                const { error } = await supabase
                    .from('retail_products')
                    .update({
                        ...productData,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('pid', editingProduct.pid);

                if (error) throw error;
                toast.success('Product updated! ✓');
            } else {
                const newCode = await generateProductCode();
                const { data: newProduct, error } = await supabase
                    .from('retail_products')
                    .insert({
                        ...productData,
                        product_code: newCode,
                        created_at: new Date().toISOString(),
                    })
                    .select()
                    .single();

                if (error) throw error;

                if (openingQty > 0 && newProduct) {
                    await supabase
                        .from('retail_stock')
                        .insert({
                            pid: newProduct.pid,
                            invoice_no: 'OPENING',
                            qty: openingQty,
                            storage_type: 'Store'
                        });
                }
                toast.success(`Product ${newCode} created! ✓`);
            }

            setShowModal(false);
            loadProducts();
            loadStockData();
        } catch (err: any) {
            console.error('Error saving product:', err);
            toast.error(`Failed to save: ${err.message}`);
        }
        setIsSaving(false);
    };

    const deleteProduct = async (pid: number) => {
        if (!confirm(`Are you sure?`)) return;
        try {
            const { error } = await supabase.from('retail_products').delete().eq('pid', pid);
            if (error) throw error;
            toast.success('Record purged');
            loadProducts();
        } catch (err) {
            toast.error('Purge failed');
        }
    };

    const toggleStatus = async (pid: number, currentStatus: boolean) => {
        try {
            const { error } = await supabase
                .from('retail_products')
                .update({ active: !currentStatus })
                .eq('pid', pid);
            if (error) throw error;
            loadProducts();
        } catch (err) {
            toast.error('Status toggle failed');
        }
    };

    const filteredProducts = products.filter(p => {
        const matchesSearch = p.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.product_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (p.barcode && p.barcode.includes(searchQuery));
        const matchesCategory = filterCategory === 'All' || p.category === filterCategory;
        return matchesSearch && matchesCategory;
    });

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 bg-white p-10 rounded-[40px] border border-slate-100 shadow-xl shadow-slate-200/40 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-64 h-64 bg-slate-50 rounded-full translate-x-20 -translate-y-20 opacity-50"></div>

                <div className="relative z-10 flex items-center gap-6">
                    <div className="w-20 h-20 bg-slate-900 rounded-[28px] flex items-center justify-center text-4xl shadow-2xl shadow-slate-900/20 group-hover:scale-105 transition-transform duration-500">
                        📦
                    </div>
                    <div>
                        <h1 className="text-4xl font-black text-slate-900 tracking-tight">Inventory Master</h1>
                        <p className="text-slate-500 font-bold text-xs mt-1 uppercase tracking-[3px] opacity-70">
                            Global product tracking • Professional Tier Control
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 relative z-10">
                    <button
                        onClick={openAddModal}
                        className="px-10 py-5 bg-slate-900 text-white rounded-[24px] font-black hover:bg-black transition-all shadow-2xl shadow-slate-900/30 active:scale-95 flex items-center gap-3 uppercase text-xs tracking-[2px] border-b-4 border-slate-700 hover:border-slate-800"
                    >
                        <span>➕</span> Create New Stock Item
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                <div className="bg-white p-10 rounded-[44px] shadow-xl shadow-slate-200/40 border border-slate-100 relative overflow-hidden group hover:scale-[1.02] transition-all">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full translate-x-12 -translate-y-12 opacity-50 group-hover:scale-110 transition-transform"></div>
                    <span className="text-4xl">📦</span>
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[3px] mt-8 mb-2">Total Registry</p>
                    <p className="text-4xl font-black text-slate-900 tracking-tighter">{products.length}</p>
                </div>

                <div className="bg-white p-10 rounded-[44px] shadow-xl shadow-slate-200/40 border border-slate-100 relative overflow-hidden group hover:scale-[1.02] transition-all">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full translate-x-12 -translate-y-12 opacity-50 group-hover:scale-110 transition-transform"></div>
                    <span className="text-4xl">✅</span>
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[3px] mt-8 mb-2">Active SKUs</p>
                    <p className="text-4xl font-black text-slate-900 tracking-tighter">{products.filter(p => p.active).length}</p>
                </div>

                <div className="bg-white p-10 rounded-[44px] shadow-xl shadow-slate-200/40 border border-slate-100 relative overflow-hidden group hover:scale-[1.02] transition-all">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full translate-x-12 -translate-y-12 opacity-50 group-hover:scale-110 transition-transform"></div>
                    <span className="text-4xl">🏷️</span>
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[3px] mt-8 mb-2">Distributions</p>
                    <p className="text-4xl font-black text-slate-900 tracking-tighter">{categories.length}</p>
                </div>

                <div className="bg-slate-900 p-10 rounded-[44px] shadow-2xl shadow-slate-900/20 text-white relative overflow-hidden group hover:scale-[1.02] transition-all">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/10 rounded-full translate-x-12 -translate-y-12 transition-transform"></div>
                    <span className="text-4xl text-rose-500 animate-pulse">⚠️</span>
                    <p className="text-rose-400/80 text-[10px] font-bold uppercase tracking-[3px] mt-8 mb-2">Low Inventory</p>
                    <p className="text-4xl font-black text-white tracking-tighter">0</p>
                </div>
            </div>

            {/* Toolbar */}
            <div className="bg-white rounded-[44px] p-10 shadow-xl shadow-slate-200/40 border border-slate-100">
                <div className="flex flex-col lg:flex-row gap-8">
                    <div className="flex-1 relative group">
                        <span className="absolute left-6 top-1/2 -translate-y-1/2 text-2xl group-focus-within:scale-110 transition-transform">🔍</span>
                        <input
                            type="text"
                            placeholder="Search by name, code, or barcode..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full px-8 py-5 pl-16 bg-slate-50 border-2 border-slate-50 rounded-[24px] text-slate-900 font-bold placeholder:text-slate-300 focus:outline-none focus:border-blue-600 focus:bg-white transition-all shadow-inner text-lg"
                        />
                    </div>
                    <div className="flex gap-4">
                        <select
                            value={filterCategory}
                            onChange={(e) => setFilterCategory(e.target.value)}
                            className="appearance-none px-8 py-5 bg-slate-50 border-2 border-slate-50 rounded-[24px] text-slate-700 font-bold focus:outline-none focus:border-blue-600 transition-all cursor-pointer min-w-[240px] text-lg shadow-inner"
                        >
                            <option value="All">All Categories</option>
                            {categories.map(cat => <option key={cat.category_id} value={cat.category_name}>{cat.category_name}</option>)}
                        </select>
                        <button onClick={loadProducts} className="w-16 h-16 bg-slate-100 rounded-[24px] flex items-center justify-center text-2xl active:scale-95 transition-all">🔄</button>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-[44px] shadow-2xl shadow-slate-200/40 border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-white border-b border-slate-100">
                                <th className="px-10 py-6 text-[11px] font-bold text-slate-400 uppercase tracking-[2px]">Item Identity</th>
                                <th className="px-10 py-6 text-[11px] font-bold text-slate-400 uppercase tracking-[2px]">Core Attributes</th>
                                <th className="px-10 py-6 text-[11px] font-bold text-slate-400 uppercase tracking-[2px]">Commercials</th>
                                <th className="px-10 py-6 text-[11px] font-bold text-slate-400 uppercase tracking-[2px] text-center">In-Stock</th>
                                <th className="px-10 py-6 text-[11px] font-bold text-slate-400 uppercase tracking-[2px] text-right">Operations</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr>
                                    <td colSpan={5} className="px-10 py-32 text-center">
                                        <div className="flex flex-col items-center gap-6">
                                            <div className="w-16 h-16 border-4 border-slate-100 border-t-slate-900 rounded-full animate-spin"></div>
                                            <span className="text-slate-400 font-bold uppercase tracking-[3px] text-xs">Synchronizing...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredProducts.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-10 py-32 text-center text-slate-400 font-bold">No Records Found</td>
                                </tr>
                            ) : (
                                filteredProducts.map((product) => (
                                    <tr key={product.pid} className="group hover:bg-slate-50/50 transition-all border-b border-slate-50 last:border-0">
                                        <td className="px-10 py-8">
                                            <div className="flex items-center gap-5">
                                                <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-2xl border border-slate-100 group-hover:scale-110 transition-transform">📦</div>
                                                <div>
                                                    <p className="font-black text-slate-900 text-lg uppercase tracking-tight">{product.product_name}</p>
                                                    <p className="text-[10px] font-black text-slate-400 font-mono tracking-widest bg-slate-100 px-2 py-0.5 rounded inline-block mt-1">{product.product_code}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-10 py-8">
                                            <span className="px-3 py-1 bg-slate-900 text-white text-[9px] font-black uppercase tracking-[2px] rounded-full">{product.category || 'N/A'}</span>
                                        </td>
                                        <td className="px-10 py-8">
                                            <p className="text-lg font-black text-slate-900 tracking-tighter">Ksh {product.sales_cost?.toLocaleString()}</p>
                                        </td>
                                        <td className="px-10 py-8 text-center text-2xl font-black text-slate-900">
                                            {stockData[product.pid] || 0}
                                        </td>
                                        <td className="px-10 py-8 text-right">
                                            <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all">
                                                <button onClick={() => openEditModal(product)} className="w-12 h-12 bg-white border border-slate-200 rounded-xl flex items-center justify-center hover:bg-slate-900 hover:text-white transition-all shadow-sm">✏️</button>
                                                <button onClick={() => deleteProduct(product.pid)} className="w-12 h-12 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-400 hover:bg-rose-600 hover:text-white transition-all shadow-sm">🗑️</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-6 z-[100]">
                    <div className="bg-white rounded-[44px] shadow-2xl w-full max-w-6xl overflow-hidden flex flex-col max-h-[95vh] border border-white/20 animate-in zoom-in-95 duration-500">
                        <div className="bg-slate-900 px-12 py-10 text-white flex items-center justify-between relative overflow-hidden shrink-0">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 rounded-full translate-x-20 -translate-y-20 blur-3xl"></div>
                            <div className="relative z-10">
                                <span className="inline-block px-4 py-1.5 bg-blue-600/20 text-blue-400 text-[10px] font-black uppercase tracking-[3px] rounded-full mb-4 border border-blue-600/30">Registry Control</span>
                                <h2 className="text-4xl font-black tracking-tight flex items-center gap-5">
                                    <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center text-2xl">{editingProduct ? '✏️' : '➕'}</div>
                                    {editingProduct ? 'Update SKU' : 'Add New Item'}
                                </h2>
                            </div>
                            <button onClick={() => setShowModal(false)} className="w-16 h-16 bg-white/5 hover:bg-white/10 rounded-[24px] transition-all flex items-center justify-center text-3xl">✕</button>
                        </div>

                        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-12 bg-slate-50/20 custom-scrollbar">
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-12">
                                <div className="space-y-10">
                                    <div className="bg-white p-10 rounded-[40px] border border-slate-100 shadow-sm space-y-8">
                                        <div className="flex items-center gap-4 border-b border-slate-50 pb-6">
                                            <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center font-black text-sm">01</div>
                                            <h3 className="font-black text-slate-800 text-sm uppercase tracking-widest">Base Identity</h3>
                                        </div>
                                        <div className="space-y-6">
                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Official Name</label>
                                                <input required type="text" value={formData.product_name} onChange={(e) => setFormData({ ...formData, product_name: e.target.value })} className="w-full p-5 bg-slate-50 border-2 border-slate-50 rounded-[24px] focus:border-blue-600 focus:bg-white focus:outline-none transition-all font-black text-slate-900 shadow-inner" placeholder="E.g. Coca Cola 500ml" />
                                            </div>
                                            <div className="grid grid-cols-2 gap-6">
                                                <div className="space-y-3">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Alias/Short</label>
                                                    <input type="text" value={formData.alias} onChange={(e) => setFormData({ ...formData, alias: e.target.value })} className="w-full p-5 bg-slate-50 border-2 border-slate-50 rounded-[24px] focus:border-blue-600 focus:outline-none transition-all font-bold" />
                                                </div>
                                                <div className="space-y-3">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Barcode</label>
                                                    <input type="text" value={formData.barcode} onChange={(e) => setFormData({ ...formData, barcode: e.target.value })} className="w-full p-5 bg-slate-50 border-2 border-slate-50 rounded-[24px] focus:border-blue-600 focus:outline-none transition-all font-bold" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-white p-10 rounded-[40px] border border-slate-100 shadow-sm space-y-8">
                                        <div className="flex items-center gap-4 border-b border-slate-50 pb-6">
                                            <div className="w-10 h-10 bg-emerald-600 text-white rounded-xl flex items-center justify-center font-black text-sm">02</div>
                                            <h3 className="font-black text-slate-800 text-sm uppercase tracking-widest">Classification</h3>
                                        </div>
                                        <div className="grid grid-cols-2 gap-6">
                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Category</label>
                                                <select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} className="w-full p-5 bg-slate-50 border-2 border-slate-50 rounded-[24px] focus:border-emerald-600 outline-none transition-all font-bold cursor-pointer">
                                                    <option value="">Select Category</option>
                                                    {categories.map(c => <option key={c.category_id} value={c.category_name}>{c.category_name}</option>)}
                                                </select>
                                            </div>
                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Supplier</label>
                                                <select value={formData.supplier_name} onChange={(e) => setFormData({ ...formData, supplier_name: e.target.value })} className="w-full p-5 bg-slate-50 border-2 border-slate-50 rounded-[24px] focus:border-emerald-600 outline-none transition-all font-bold cursor-pointer">
                                                    <option value="">Select Supplier</option>
                                                    {suppliers.map(s => <option key={s.supplier_id} value={s.supplier_name}>{s.supplier_name}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-10">
                                    <div className="bg-slate-900 p-10 rounded-[40px] shadow-xl space-y-8 border-b-8 border-blue-600">
                                        <div className="flex items-center gap-4 border-b border-white/5 pb-6">
                                            <div className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center font-black text-sm">03</div>
                                            <h3 className="font-black text-white text-sm uppercase tracking-widest">Commercial Registry</h3>
                                        </div>
                                        <div className="grid grid-cols-2 gap-8">
                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Cost Price (Ksh)</label>
                                                <input type="number" value={formData.purchase_cost} onChange={(e) => setFormData({ ...formData, purchase_cost: parseFloat(e.target.value) || 0 })} className="w-full p-6 bg-white/5 border-2 border-white/5 rounded-[28px] focus:border-blue-500 text-white font-black text-2xl outline-none" />
                                            </div>
                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Sale Rate (Ksh)</label>
                                                <input type="number" value={formData.sales_cost} onChange={(e) => setFormData({ ...formData, sales_cost: parseFloat(e.target.value) || 0 })} className="w-full p-6 bg-blue-600 rounded-[28px] text-white font-black text-2xl outline-none shadow-xl shadow-blue-500/20" />
                                            </div>
                                        </div>
                                        <div className="p-6 bg-white/5 rounded-3xl flex flex-col items-center">
                                            <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-1">Expected Margin</span>
                                            <span className="text-3xl font-black text-white">{calculateMargin(formData.purchase_cost, formData.sales_cost)}%</span>
                                        </div>
                                    </div>

                                    <div className="bg-white p-10 rounded-[40px] border border-slate-100 shadow-sm space-y-8">
                                        <div className="flex items-center gap-4 border-b border-slate-50 pb-6">
                                            <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center font-black text-sm">04</div>
                                            <h3 className="font-black text-slate-800 text-sm uppercase tracking-widest">Operations</h3>
                                        </div>
                                        <div className="grid grid-cols-2 gap-6">
                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Alert Threshold</label>
                                                <input type="number" value={formData.reorder_point} onChange={(e) => setFormData({ ...formData, reorder_point: parseInt(e.target.value) || 0 })} className="w-full p-5 bg-slate-50 border-2 border-slate-50 rounded-[24px] font-black text-lg outline-none" />
                                            </div>
                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Initial Stock</label>
                                                <input type="number" value={openingQty} onChange={(e) => setOpeningQty(parseInt(e.target.value) || 0)} disabled={!!editingProduct} className="w-full p-5 bg-slate-50 border-2 border-slate-50 rounded-[24px] font-black text-lg outline-none disabled:opacity-50" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-12 flex gap-6 shrink-0 pt-10 border-t border-slate-100">
                                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-7 bg-white border-2 border-slate-100 text-slate-400 rounded-[28px] font-black uppercase text-xs tracking-[3px] hover:border-slate-300 transition-all">Dismiss</button>
                                <button type="submit" disabled={isSaving} className="flex-[3] py-7 bg-slate-900 text-white rounded-[28px] font-black uppercase text-xs tracking-[4px] shadow-2xl hover:bg-black transition-all border-b-4 border-slate-700 active:scale-95">
                                    {isSaving ? 'Processing...' : (editingProduct ? 'Update Registry' : 'Commit SKU')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
