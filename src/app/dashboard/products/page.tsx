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

            // Prepare product data for database - only fields that exist in retail_products table
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
                // Update existing product
                const { error } = await supabase
                    .from('retail_products')
                    .update({
                        ...productData,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('pid', editingProduct.pid);

                if (error) {
                    console.error('Supabase update error:', error);
                    throw new Error(error.message);
                }
                toast.success('Product updated! ✓');
            } else {
                // Create new product
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

                if (error) {
                    console.error('Supabase insert error:', error);
                    throw new Error(error.message);
                }

                // If opening qty > 0, insert into retail_stock
                if (openingQty > 0 && newProduct) {
                    const { error: stockError } = await supabase
                        .from('retail_stock')
                        .insert({
                            pid: newProduct.pid,
                            invoice_no: 'OPENING',
                            qty: openingQty,
                            storage_type: 'Store'
                        });

                    if (stockError) {
                        console.warn('Could not add opening stock:', stockError);
                    }
                }

                toast.success(`Product ${newCode} created! ✓`);
            }

            setShowModal(false);
            loadProducts();
        } catch (err: unknown) {
            console.error('Error saving product:', err);
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            toast.error(`Failed to save: ${errorMessage}`);
        }
        setIsSaving(false);
    };

    const deleteProduct = async (pid: number) => {
        if (!confirm(`Are you sure you want to delete this product record?`)) return;

        try {
            const { error } = await supabase
                .from('retail_products')
                .delete()
                .eq('pid', pid);

            if (error) throw error;
            toast.success('Record purged from registry');
            loadProducts();
        } catch (err) {
            console.error('Error deleting product:', err);
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
            toast.success(`Product ${!currentStatus ? 'Activated' : 'Suspended'}`);
            loadProducts();
        } catch (err) {
            console.error('Error toggling status:', err);
            toast.error('Status transition failed');
        }
    };

    const filteredProducts = products.filter(p => {
        const matchesSearch = p.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.product_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (p.barcode && p.barcode.includes(searchQuery));
        const matchesCategory = filterCategory === 'All' || p.category === filterCategory;
        return matchesSearch && matchesCategory;
    });

    const totalProducts = products.length;
    const activeProducts = products.filter(p => p.active).length;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
                        <span className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl flex items-center justify-center text-white text-2xl shadow-xl shadow-blue-200">📦</span>
                        Inventory Master
                    </h1>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-2 ml-1">
                        Global product management • Version 2.4 Control
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={() => toast.success('📝 Purchase Order - Coming soon!')}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-gradient-to-r from-teal-50 to-teal-100 text-teal-700 border border-teal-200 rounded-lg hover:from-teal-100 hover:to-teal-200 transition-all"
                    >
                        📝 Make PO
                    </button>
                    <button
                        onClick={() => toast.success('📊 Review Items - Coming soon!')}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-gradient-to-r from-amber-50 to-amber-100 text-amber-700 border border-amber-200 rounded-lg hover:from-amber-100 hover:to-amber-200 transition-all"
                    >
                        📊 Review
                    </button>
                    <button
                        onClick={() => setShowPriceList(true)}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-gradient-to-r from-purple-50 to-purple-100 text-purple-700 border border-purple-200 rounded-lg hover:from-purple-100 hover:to-purple-200 transition-all"
                    >
                        💰 Price List
                    </button>
                    <button
                        onClick={() => {
                            const csvContent = [
                                ['Code', 'Name', 'Category', 'Purchase', 'Sales', 'Stock', 'Status'].join(','),
                                ...filteredProducts.map(p => [
                                    p.product_code,
                                    `"${p.product_name}"`,
                                    p.category || '',
                                    p.purchase_cost,
                                    p.sales_cost,
                                    stockData[p.pid] || 0,
                                    p.active ? 'Active' : 'Inactive'
                                ].join(','))
                            ].join('\n');
                            const blob = new Blob([csvContent], { type: 'text/csv' });
                            const url = window.URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = 'products.csv';
                            a.click();
                            toast.success('📥 Exported to CSV!');
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-gradient-to-r from-emerald-50 to-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg hover:from-emerald-100 hover:to-emerald-200 transition-all"
                    >
                        📥 Export
                    </button>
                    <button
                        onClick={() => toast.success('⚙️ Settings - Coming soon!')}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-gradient-to-r from-gray-50 to-gray-100 text-gray-700 border border-gray-200 rounded-lg hover:from-gray-100 hover:to-gray-200 transition-all"
                    >
                        ⚙️ Settings
                    </button>
                    <button
                        onClick={openAddModal}
                        className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white text-sm font-medium rounded-xl shadow-md hover:scale-105 active:scale-95 transition-all"
                    >
                        ➕ Add Product
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="bg-white rounded-[32px] p-6 shadow-xl shadow-slate-200/50 border border-slate-50 relative overflow-hidden group hover:-translate-y-1 transition-all">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-110 transition-transform"></div>
                    <div className="relative">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Stock Count</p>
                        <p className="text-3xl font-black text-slate-900">{totalProducts}</p>
                        <div className="flex items-center gap-1.5 mt-2">
                            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                            <span className="text-[10px] font-bold text-blue-600 uppercase">Live Catalog</span>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-[32px] p-6 shadow-xl shadow-slate-200/50 border border-slate-50 relative overflow-hidden group hover:-translate-y-1 transition-all">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-110 transition-transform"></div>
                    <div className="relative">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Active items</p>
                        <p className="text-3xl font-black text-slate-900">{activeProducts}</p>
                        <div className="flex items-center gap-1.5 mt-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                            <span className="text-[10px] font-bold text-emerald-600 uppercase">System Online</span>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-[32px] p-6 shadow-xl shadow-slate-200/50 border border-slate-50 relative overflow-hidden group hover:-translate-y-1 transition-all">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-purple-50 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-110 transition-transform"></div>
                    <div className="relative">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Categories</p>
                        <p className="text-3xl font-black text-slate-900">{categories.length}</p>
                        <div className="flex items-center gap-1.5 mt-2">
                            <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                            <span className="text-[10px] font-bold text-purple-600 uppercase">Organized</span>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-[32px] p-6 shadow-xl shadow-slate-200/50 border border-slate-50 relative overflow-hidden group hover:-translate-y-1 transition-all">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-rose-50 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-110 transition-transform"></div>
                    <div className="relative">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Depleting</p>
                        <p className="text-3xl font-black text-rose-600">0</p>
                        <div className="flex items-center gap-1.5 mt-2">
                            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                            <span className="text-[10px] font-bold text-rose-600 uppercase">Urgent Action</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Actions Toolbar */}
            <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => {
                            if (selectedProducts.length === 1) {
                                const product = products.find(p => p.pid === selectedProducts[0]);
                                if (product) toast.success(`📋 Item history for: ${product.product_name}`);
                            } else {
                                toast('Select one item to view history', { icon: 'ℹ️' });
                            }
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gradient-to-r from-indigo-50 to-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg hover:from-indigo-100 hover:to-indigo-200 transition-all"
                    >
                        🔍 Look Up
                    </button>
                    <button
                        onClick={() => {
                            if (selectedProducts.length > 0) {
                                window.location.href = `/dashboard/purchase?products=${selectedProducts.join(',')}`;
                            } else {
                                window.location.href = '/dashboard/purchase';
                            }
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gradient-to-r from-green-50 to-green-100 text-green-700 border border-green-200 rounded-lg hover:from-green-100 hover:to-green-200 transition-all"
                    >
                        🛒 Purchase
                    </button>
                    <button
                        onClick={() => toast.success('📝 Purchase Order - Coming soon!')}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gradient-to-r from-teal-50 to-teal-100 text-teal-700 border border-teal-200 rounded-lg hover:from-teal-100 hover:to-teal-200 transition-all"
                    >
                        📝 Make PO
                    </button>
                    <button
                        onClick={() => toast.success('📊 Review Items - Coming soon!')}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gradient-to-r from-amber-50 to-amber-100 text-amber-700 border border-amber-200 rounded-lg hover:from-amber-100 hover:to-amber-200 transition-all"
                    >
                        📊 Review
                    </button>
                    <button
                        onClick={() => setShowPriceList(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gradient-to-r from-purple-50 to-purple-100 text-purple-700 border border-purple-200 rounded-lg hover:from-purple-100 hover:to-purple-200 transition-all"
                    >
                        💰 Price List
                    </button>
                    <button
                        onClick={() => {
                            const csvContent = [
                                ['Code', 'Name', 'Category', 'Purchase', 'Sales', 'Stock', 'Status'].join(','),
                                ...filteredProducts.map(p => [
                                    p.product_code,
                                    `"${p.product_name}"`,
                                    p.category || '',
                                    p.purchase_cost,
                                    p.sales_cost,
                                    stockData[p.pid] || 0,
                                    p.active ? 'Active' : 'Inactive'
                                ].join(','))
                            ].join('\n');
                            const blob = new Blob([csvContent], { type: 'text/csv' });
                            const url = window.URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = 'products.csv';
                            a.click();
                            toast.success('📥 Products exported to CSV!');
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gradient-to-r from-emerald-50 to-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg hover:from-emerald-100 hover:to-emerald-200 transition-all"
                    >
                        📥 Export
                    </button>
                    <button
                        onClick={() => toast.success('⚙️ Settings - Coming soon!')}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gradient-to-r from-gray-50 to-gray-100 text-gray-700 border border-gray-200 rounded-lg hover:from-gray-100 hover:to-gray-200 transition-all"
                    >
                        ⚙️ Settings
                    </button>
                    {selectedProducts.length > 0 && (
                        <span className="flex items-center px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg">
                            ✓ {selectedProducts.length} selected
                        </span>
                    )}
                </div>
            </div>

            {/* Search & Filter */}
            <div className="bg-white rounded-[32px] p-6 shadow-xl shadow-slate-200/40 border border-slate-50">
                <div className="flex flex-col md:flex-row gap-6">
                    <div className="flex-1 relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl pointer-events-none">🔍</span>
                        <input
                            type="text"
                            placeholder="Search by name, code, or barcode..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full px-6 py-4 pl-14 bg-slate-50 border-2 border-slate-100 rounded-[20px] text-slate-900 font-bold placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white transition-all shadow-inner"
                        />
                    </div>
                    <div className="flex gap-4">
                        <div className="relative">
                            <select
                                value={filterCategory}
                                onChange={(e) => setFilterCategory(e.target.value)}
                                className="appearance-none px-6 py-4 pr-12 bg-slate-50 border-2 border-slate-100 rounded-[20px] text-slate-700 font-bold focus:outline-none focus:border-blue-600 transition-all cursor-pointer min-w-[200px]"
                            >
                                <option value="All">All Categories</option>
                                {categories.map(cat => (
                                    <option key={cat.category_id} value={cat.category_name}>
                                        {cat.category_name}
                                    </option>
                                ))}
                            </select>
                            <span className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none opacity-40">▼</span>
                        </div>
                        <button
                            onClick={loadProducts}
                            className="w-14 h-14 bg-blue-50 text-blue-600 rounded-[20px] hover:bg-blue-600 hover:text-white transition-all flex items-center justify-center text-xl font-black group"
                        >
                            <span className="group-hover:rotate-180 transition-transform duration-500">🔄</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Products Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
                                <th className="px-2 py-3 text-center w-10">
                                    <input
                                        type="checkbox"
                                        checked={selectedProducts.length === filteredProducts.length && filteredProducts.length > 0}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                setSelectedProducts(filteredProducts.map(p => p.pid));
                                            } else {
                                                setSelectedProducts([]);
                                            }
                                        }}
                                        className="w-4 h-4 rounded border-white/50 cursor-pointer"
                                    />
                                </th>
                                <th className="px-3 py-3 text-left text-xs font-semibold">Code</th>
                                <th className="px-3 py-3 text-left text-xs font-semibold">Product Name</th>
                                <th className="px-3 py-3 text-left text-xs font-semibold hidden md:table-cell">Category</th>
                                <th className="px-3 py-3 text-right text-xs font-semibold">Purchase</th>
                                <th className="px-3 py-3 text-right text-xs font-semibold">Sales</th>
                                <th className="px-3 py-3 text-center text-xs font-semibold">Avail Qty</th>
                                <th className="px-3 py-3 text-center text-xs font-semibold hidden lg:table-cell">Margin %</th>
                                <th className="px-3 py-3 text-center text-xs font-semibold">Status</th>
                                <th className="px-3 py-3 text-center text-xs font-semibold">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr>
                                    <td colSpan={10} className="px-4 py-12 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="w-10 h-10 border-4 border-blue-400/30 border-t-blue-500 rounded-full animate-spin"></div>
                                            <span className="text-gray-500">Loading products...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredProducts.length === 0 ? (
                                <tr>
                                    <td colSpan={10} className="px-4 py-12 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <span className="text-5xl">📦</span>
                                            <p className="text-gray-500">No products found</p>
                                            <button
                                                onClick={openAddModal}
                                                className="px-4 py-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors"
                                            >
                                                Add First Product
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                // Table body
                                filteredProducts.map((product) => (
                                    <tr key={product.pid} className="group hover:bg-blue-50/30 transition-all border-b-2 border-slate-50 last:border-0">
                                        <td className="px-6 py-5">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-black text-blue-600 font-mono tracking-tighter">{product.product_code}</span>
                                                <span className="text-[10px] font-bold text-slate-400 mt-0.5">{product.barcode || 'NO-BARCODE'}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-lg shadow-inner group-hover:scale-110 transition-transform">
                                                    📦
                                                </div>
                                                <div>
                                                    <p className="font-black text-slate-800 text-sm leading-tight">{product.product_name}</p>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">Physical Inventory</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <span className="px-3 py-1.5 bg-slate-100 text-slate-700 text-[10px] font-black uppercase tracking-widest rounded-lg group-hover:bg-white transition-colors">
                                                {product.category || 'Uncategorized'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5 text-right">
                                            <div className="flex flex-col items-end">
                                                <span className="text-sm font-black text-slate-900">Ksh {product.sales_cost?.toLocaleString()}</span>
                                                <span className="text-[10px] font-bold text-slate-400">Unit Rate</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 text-center">
                                            <button
                                                onClick={() => toggleStatus(product.pid, product.active)}
                                                className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${product.active
                                                    ? 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200'
                                                    : 'bg-rose-100 text-rose-600 hover:bg-rose-200'
                                                    }`}
                                            >
                                                {product.active ? '● Fully Active' : '○ Deactivated'}
                                            </button>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => openEditModal(product)}
                                                    className="w-9 h-9 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all flex items-center justify-center shadow-lg shadow-blue-200/50"
                                                    title="Modify Record"
                                                >
                                                    ✏️
                                                </button>
                                                <button
                                                    onClick={() => deleteProduct(product.pid)}
                                                    className="w-9 h-9 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-600 hover:text-white transition-all flex items-center justify-center shadow-lg shadow-rose-200/50"
                                                    title="Delete Record"
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
                        {/* Modal Header */}
                        <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-5 text-white sticky top-0">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-bold flex items-center gap-2">
                                    {editingProduct ? '✏️ Edit Product' : '➕ Add New Product'}
                                </h2>
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="p-2 hover:bg-white/20 rounded-full transition-colors"
                                >
                                    ✕
                                </button>
                            </div>
                            {editingProduct && (
                                <p className="text-blue-100 text-sm mt-1">Code: {editingProduct.product_code}</p>
                            )}
                        </div>

                        {/* Modal Form */}
                        <form onSubmit={handleSubmit} className="p-6 space-y-6">
                            {/* Basic Info */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        🍕 Product Name <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.product_name}
                                        onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
                                        placeholder="e.g., Chicken Burger"
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-400/20"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        📝 Alias / Short Name
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.alias}
                                        onChange={(e) => setFormData({ ...formData, alias: e.target.value })}
                                        placeholder="e.g., Chk Burger"
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-400/20"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        🏷️ Category
                                    </label>
                                    <select
                                        value={formData.category}
                                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-400/20 cursor-pointer"
                                    >
                                        <option value="">Select Category</option>
                                        {categories.map(cat => (
                                            <option key={cat.category_id} value={cat.category_name}>
                                                {cat.icon} {cat.category_name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        📊 Barcode
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.barcode}
                                        onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                                        placeholder="Scan or enter barcode"
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-400/20"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        🔢 HS Code
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.hscode}
                                        onChange={(e) => setFormData({ ...formData, hscode: e.target.value })}
                                        placeholder="HS Code for tax"
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-400/20"
                                    />
                                </div>

                                {/* Opening Qty - Only show when adding NEW product */}
                                {!editingProduct && (
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                                            📦 Opening Qty
                                        </label>
                                        <input
                                            type="number"
                                            value={openingQty}
                                            onChange={(e) => setOpeningQty(Number(e.target.value))}
                                            placeholder="Initial stock quantity"
                                            min="0"
                                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-400/20"
                                        />
                                        <p className="text-xs text-gray-400 mt-1">Initial stock when creating product</p>
                                    </div>
                                )}

                                {/* Product Image Upload */}
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        🖼️ Product Image
                                    </label>
                                    <div className="flex items-start gap-4">
                                        {/* Upload Area */}
                                        <div className="flex-1">
                                            <label className="relative flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer bg-gray-50 hover:bg-gray-100 transition-all hover:border-teal-400">
                                                <div className="flex flex-col items-center justify-center pt-4 pb-4">
                                                    <span className="text-3xl mb-2">📷</span>
                                                    <p className="text-sm text-gray-600 font-medium">Click to upload image</p>
                                                    <p className="text-xs text-gray-400">PNG, JPG up to 2MB</p>
                                                </div>
                                                <input
                                                    type="file"
                                                    className="hidden"
                                                    accept="image/*"
                                                    onChange={async (e) => {
                                                        const file = e.target.files?.[0];
                                                        if (!file) return;

                                                        if (file.size > 500 * 1024) {
                                                            toast.error('Image must be less than 500KB');
                                                            return;
                                                        }

                                                        toast.loading('Processing image...');
                                                        try {
                                                            // Convert to base64
                                                            const reader = new FileReader();
                                                            reader.onloadend = () => {
                                                                const base64String = reader.result as string;
                                                                setFormData({ ...formData, photo: base64String });
                                                                toast.dismiss();
                                                                toast.success('Image added! ✓');
                                                            };
                                                            reader.onerror = () => {
                                                                toast.dismiss();
                                                                toast.error('Failed to read image');
                                                            };
                                                            reader.readAsDataURL(file);
                                                        } catch (err) {
                                                            toast.dismiss();
                                                            console.error('Image error:', err);
                                                            toast.error('Failed to process image');
                                                        }
                                                    }}
                                                />
                                            </label>
                                        </div>

                                        {/* Preview */}
                                        <div className="w-32 h-32 rounded-xl bg-gray-100 border-2 border-gray-200 overflow-hidden flex items-center justify-center flex-shrink-0">
                                            {formData.photo ? (
                                                <div className="relative w-full h-full">
                                                    <img
                                                        src={formData.photo}
                                                        alt="Preview"
                                                        className="w-full h-full object-cover"
                                                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setFormData({ ...formData, photo: '' })}
                                                        className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full text-xs hover:bg-red-600 flex items-center justify-center"
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="text-center text-gray-400">
                                                    <span className="text-2xl">📦</span>
                                                    <p className="text-xs mt-1">No image</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Pricing Section */}
                            <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl p-5 border border-green-200">
                                <h3 className="font-bold text-green-800 mb-4 flex items-center gap-2">
                                    💰 Pricing
                                </h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Purchase Unit</label>
                                        <select
                                            value={formData.purchase_unit}
                                            onChange={(e) => setFormData({ ...formData, purchase_unit: e.target.value })}
                                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-gray-800 focus:outline-none focus:border-green-500"
                                        >
                                            {units.map(u => <option key={u.unit_id} value={u.unit_name}>{u.unit_name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Purchase Cost</label>
                                        <input
                                            type="number"
                                            value={formData.purchase_cost}
                                            onChange={(e) => setFormData({ ...formData, purchase_cost: parseFloat(e.target.value) || 0 })}
                                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-gray-800 focus:outline-none focus:border-green-500"
                                            min="0"
                                            step="0.01"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Sales Unit</label>
                                        <select
                                            value={formData.sales_unit}
                                            onChange={(e) => setFormData({ ...formData, sales_unit: e.target.value })}
                                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-gray-800 focus:outline-none focus:border-green-500"
                                        >
                                            {units.map(u => <option key={u.unit_id} value={u.unit_name}>{u.unit_name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Sales Price</label>
                                        <input
                                            type="number"
                                            value={formData.sales_cost}
                                            onChange={(e) => setFormData({ ...formData, sales_cost: parseFloat(e.target.value) || 0 })}
                                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-gray-800 focus:outline-none focus:border-green-500"
                                            min="0"
                                            step="0.01"
                                        />
                                    </div>
                                </div>
                                {formData.purchase_cost > 0 && formData.sales_cost > 0 && (
                                    <div className="mt-4 p-3 bg-white rounded-xl border border-green-200">
                                        <p className="text-sm text-gray-600">
                                            Profit Margin: <span className="font-bold text-green-600">
                                                {calculateMargin(formData.purchase_cost, formData.sales_cost).toFixed(1)}%
                                            </span>
                                            {' '}(Ksh {(formData.sales_cost - formData.purchase_cost).toLocaleString()} profit)
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Additional Info */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        📊 VAT Type
                                    </label>
                                    <select
                                        value={formData.vat_commodity}
                                        onChange={(e) => setFormData({ ...formData, vat_commodity: e.target.value })}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 focus:outline-none focus:border-blue-500"
                                    >
                                        {vatOptions.map(v => <option key={v} value={v}>{v}</option>)}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        ⚠️ Reorder Point
                                    </label>
                                    <input
                                        type="number"
                                        value={formData.reorder_point}
                                        onChange={(e) => setFormData({ ...formData, reorder_point: parseInt(e.target.value) || 10 })}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 focus:outline-none focus:border-blue-500"
                                        min="0"
                                    />
                                </div>

                                <div className="md:col-span-3">
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        🎨 POS Button Color (same as POS screen)
                                    </label>
                                    <div className="grid grid-cols-7 gap-2">
                                        {colorPresets.map((preset) => (
                                            <button
                                                key={preset.name}
                                                type="button"
                                                onClick={() => setFormData({ ...formData, button_ui_color: preset.gradient })}
                                                className={`h-10 rounded-xl bg-gradient-to-br ${preset.gradient} transition-all hover:scale-110 ${formData.button_ui_color === preset.gradient
                                                    ? 'ring-2 ring-offset-2 ring-blue-500 scale-110'
                                                    : ''
                                                    }`}
                                                title={preset.name}
                                            />
                                        ))}
                                    </div>
                                    {formData.button_ui_color && (
                                        <div className="mt-3 flex items-center gap-3">
                                            <span className="text-sm text-gray-600">Preview:</span>
                                            <div className={`w-20 h-12 rounded-xl bg-gradient-to-br ${formData.button_ui_color} flex items-center justify-center text-white font-bold text-lg`}>
                                                {formData.product_name?.charAt(0)?.toUpperCase() || 'A'}
                                            </div>
                                            <span className="text-xs text-gray-500">{formData.button_ui_color}</span>
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        🏭 Supplier / Source
                                    </label>
                                    <select
                                        value={formData.supplier_name}
                                        onChange={(e) => setFormData({ ...formData, supplier_name: e.target.value })}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 focus:outline-none focus:border-blue-500 cursor-pointer"
                                    >
                                        <option value="">Select Supplier</option>
                                        <option value={getKitchenSupplier()}>🍳 {getKitchenSupplier()} (Default for food)</option>
                                        <optgroup label="External Suppliers">
                                            {suppliers.filter(s => !s.is_kitchen).map(s => (
                                                <option key={s.supplier_id} value={s.supplier_name}>
                                                    🏢 {s.supplier_name}
                                                </option>
                                            ))}
                                        </optgroup>
                                    </select>
                                    <p className="text-xs text-gray-500 mt-1">
                                        Use Kitchen for food made in-house, or select external supplier for items like sodas
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        📋 Batch No
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.batch_no}
                                        onChange={(e) => setFormData({ ...formData, batch_no: e.target.value })}
                                        placeholder="Batch number"
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 focus:outline-none focus:border-blue-500"
                                    />
                                </div>

                                <div className="flex items-center gap-4 pt-8">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.active}
                                            onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                                            className="w-5 h-5 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                                        />
                                        <span className="font-medium text-gray-700">Active</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.show_ps}
                                            onChange={(e) => setFormData({ ...formData, show_ps: e.target.checked })}
                                            className="w-5 h-5 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                                        />
                                        <span className="font-medium text-gray-700">Show in POS</span>
                                    </label>
                                </div>
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    📝 Description
                                </label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Product description..."
                                    rows={2}
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 focus:outline-none focus:border-blue-500 resize-none"
                                />
                            </div>

                            {/* Buttons */}
                            <div className="flex gap-4 pt-4 border-t border-gray-100">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 px-6 py-3 border-2 border-gray-200 text-gray-600 font-semibold rounded-xl hover:bg-gray-50 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-300/40 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                                >
                                    {isSaving ? (
                                        <>
                                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                            Saving...
                                        </>
                                    ) : (
                                        <>
                                            <span>{editingProduct ? '💾' : '➕'}</span>
                                            {editingProduct ? 'Update Product' : 'Create Product'}
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )
            }
        </div >
    );
}
