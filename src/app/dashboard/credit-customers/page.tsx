'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import {
    FiUsers, FiPlus, FiSearch, FiFilter, FiEdit2, FiTrash2, FiRefreshCw,
    FiDownload, FiPhone, FiMail, FiMapPin, FiDollarSign, FiUserCheck,
    FiAlertTriangle, FiX, FiChevronLeft, FiChevronRight, FiEye,
    FiUpload, FiFileText, FiCheckCircle, FiAlertCircle, FiPrinter,
    FiTrendingUp, FiTrendingDown, FiCreditCard, FiSliders, FiClock,
    FiArrowRight, FiStar, FiActivity
} from 'react-icons/fi';

interface Outlet { outlet_id: number; outlet_name: string; }
interface Customer {
    customer_id: number; customer_code: string; customer_name: string;
    phone: string; email: string; address: string; credit_limit: number;
    current_balance: number; opening_balance: number; prepayment_balance: number;
    active: boolean; outlet_id: number; notes: string; created_at: string;
}
interface ImportRow {
    customer_name: string; phone: string; email: string; address: string;
    credit_limit: number; opening_balance: number; notes: string; status?: string; error?: string;
}

const emptyForm = {
    customer_name: '', phone: '', email: '', address: '',
    credit_limit: 0, opening_balance: 0, notes: '', active: true, outlet_id: 1
};

const TABS = ['customers', 'import'] as const;
type Tab = typeof TABS[number];

export default function CreditCustomersPage() {
    const [activeTab, setActiveTab] = useState<Tab>('customers');
    const [outlets, setOutlets] = useState<Outlet[]>([]);
    const [selectedOutletId, setSelectedOutletId] = useState<number | 'all'>('all');
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState<'All' | 'With Balance' | 'In Credit' | 'Over Limit' | 'Inactive'>('All');
    const [sortBy, setSortBy] = useState<'name' | 'balance' | 'limit' | 'date'>('name');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
    const [showModal, setShowModal] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
    const [formData, setFormData] = useState({ ...emptyForm });
    const [formLoading, setFormLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [viewCustomer, setViewCustomer] = useState<Customer | null>(null);
    const [customerSales, setCustomerSales] = useState<any[]>([]);
    const [customerPayments, setCustomerPayments] = useState<any[]>([]);
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<Customer | null>(null);
    const perPage = 20;

    // Import state
    const [importFile, setImportFile] = useState<File | null>(null);
    const [importRows, setImportRows] = useState<ImportRow[]>([]);
    const [importHeaders, setImportHeaders] = useState<string[]>([]);
    const [importMapping, setImportMapping] = useState<Record<string, string>>({});
    const [importStep, setImportStep] = useState<'upload' | 'map' | 'preview' | 'done'>('upload');
    const [importProgress, setImportProgress] = useState(0);
    const [importImporting, setImportImporting] = useState(false);
    const [importResults, setImportResults] = useState<{ success: number; failed: number; errors: string[] }>({ success: 0, failed: 0, errors: [] });
    const fileRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        loadOutlets();
        // Restore outlet from localStorage
        const saved = localStorage.getItem('selectedOutletId');
        if (saved) setSelectedOutletId(Number(saved));
    }, []);

    useEffect(() => { loadCustomers(); }, [selectedOutletId]);

    const loadOutlets = async () => {
        const { data } = await supabase.from('retail_outlets').select('outlet_id, outlet_name').order('outlet_name');
        setOutlets(data || []);
    };

    const loadCustomers = useCallback(async () => {
        setLoading(true);
        let q = supabase.from('retail_credit_customers').select('*').order('customer_name');
        if (selectedOutletId !== 'all') q = q.eq('outlet_id', selectedOutletId);
        const { data, error } = await q;
        if (error) toast.error('Failed to load customers');
        else setCustomers(data || []);
        setLoading(false);
    }, [selectedOutletId]);

    const loadCustomerDetails = async (c: Customer) => {
        setViewCustomer(c);
        setLoadingDetails(true);
        const [{ data: sales }, { data: payments }] = await Promise.all([
            supabase.from('retail_sales').select('*').eq('customer_id', c.customer_id).order('sale_datetime', { ascending: false }).limit(100),
            supabase.from('retail_credit_payments').select('*').eq('customer_id', c.customer_id).order('payment_datetime', { ascending: false }).limit(100)
        ]);
        setCustomerSales(sales || []);
        setCustomerPayments(payments || []);
        setLoadingDetails(false);
    };

    const filtered = useMemo(() => {
        let list = customers;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            list = list.filter(c =>
                c.customer_name?.toLowerCase().includes(q) || c.phone?.includes(q) ||
                c.email?.toLowerCase().includes(q) || c.customer_code?.toLowerCase().includes(q)
            );
        }
        if (filterStatus === 'With Balance') list = list.filter(c => c.current_balance > 0);
        if (filterStatus === 'In Credit') list = list.filter(c => c.current_balance < 0);
        if (filterStatus === 'Over Limit') list = list.filter(c => c.credit_limit > 0 && c.current_balance > c.credit_limit);
        if (filterStatus === 'Inactive') list = list.filter(c => !c.active);
        // Sort
        list = [...list].sort((a, b) => {
            let va: any, vb: any;
            if (sortBy === 'name') { va = a.customer_name; vb = b.customer_name; }
            else if (sortBy === 'balance') { va = a.current_balance; vb = b.current_balance; }
            else if (sortBy === 'limit') { va = a.credit_limit; vb = b.credit_limit; }
            else { va = a.created_at; vb = b.created_at; }
            if (va < vb) return sortDir === 'asc' ? -1 : 1;
            if (va > vb) return sortDir === 'asc' ? 1 : -1;
            return 0;
        });
        return list;
    }, [customers, searchQuery, filterStatus, sortBy, sortDir]);

    const totalPages = Math.ceil(filtered.length / perPage);
    const paginated = filtered.slice((page - 1) * perPage, page * perPage);

    const totalOwed = customers.reduce((s, c) => s + Math.max(0, c.current_balance || 0), 0);
    const totalPrepayment = customers.reduce((s, c) => s + Math.max(0, -(c.current_balance || 0)), 0);
    const activeCount = customers.filter(c => c.active).length;
    const withBalance = customers.filter(c => c.current_balance > 0).length;
    const overLimit = customers.filter(c => c.credit_limit > 0 && c.current_balance > c.credit_limit).length;

    const generateCode = () => `CUST-${String(customers.length + 1).padStart(4, '0')}`;

    const openAddModal = () => {
        setEditingCustomer(null);
        setFormData({ ...emptyForm, outlet_id: selectedOutletId === 'all' ? 1 : selectedOutletId });
        setShowModal(true);
    };

    const openEditModal = (c: Customer) => {
        setEditingCustomer(c);
        setFormData({
            customer_name: c.customer_name || '', phone: c.phone || '', email: c.email || '',
            address: c.address || '', credit_limit: c.credit_limit || 0, opening_balance: c.opening_balance || 0,
            notes: c.notes || '', active: c.active !== false, outlet_id: c.outlet_id || 1
        });
        setShowModal(true);
    };

    const handleSubmit = async () => {
        if (!formData.customer_name.trim()) { toast.error('Customer name is required'); return; }
        setFormLoading(true);
        try {
            if (editingCustomer) {
                const { error } = await supabase.from('retail_credit_customers').update({
                    customer_name: formData.customer_name.trim(), phone: formData.phone.trim(),
                    email: formData.email.trim(), address: formData.address.trim(),
                    credit_limit: Number(formData.credit_limit) || 0, notes: formData.notes,
                    active: formData.active, outlet_id: formData.outlet_id
                }).eq('customer_id', editingCustomer.customer_id);
                if (error) throw error;
                toast.success('✅ Customer updated!');
            } else {
                const openBal = Number(formData.opening_balance) || 0;
                const { data: newCust, error } = await supabase.from('retail_credit_customers').insert({
                    customer_code: generateCode(), customer_name: formData.customer_name.trim(),
                    phone: formData.phone.trim(), email: formData.email.trim(),
                    address: formData.address.trim(), credit_limit: Number(formData.credit_limit) || 0,
                    opening_balance: openBal, current_balance: openBal,
                    notes: formData.notes, active: formData.active, outlet_id: formData.outlet_id
                }).select().single();
                if (error) throw error;
                // Record opening balance as a payment entry if non-zero
                if (openBal !== 0 && newCust) {
                    await supabase.from('retail_credit_payments').insert({
                        customer_id: newCust.customer_id, sale_id: null, receipt_no: null,
                        amount_paid: Math.abs(openBal), balance_before: 0, balance_after: openBal,
                        payment_method: 'Opening Balance', transaction_type: openBal > 0 ? 'opening_balance' : 'prepayment',
                        payment_note: openBal < 0 ? 'Opening prepayment' : 'Opening balance (amount owed)',
                        outlet_id: formData.outlet_id
                    });
                }
                toast.success('✅ Customer added!');
            }
            setShowModal(false); loadCustomers();
        } catch (err: any) { toast.error(err.message || 'Failed to save'); }
        finally { setFormLoading(false); }
    };

    const handleDelete = async (c: Customer) => {
        const { error } = await supabase.from('retail_credit_customers').delete().eq('customer_id', c.customer_id);
        if (error) toast.error(error.message);
        else { toast.success('Customer deleted'); setShowDeleteConfirm(null); loadCustomers(); }
    };

    const exportCSV = () => {
        const h = ['Code', 'Name', 'Phone', 'Email', 'Address', 'Balance', 'Credit Limit', 'Opening Balance', 'Active', 'Outlet', 'Notes'];
        const rows = filtered.map(c => [c.customer_code, c.customer_name, c.phone, c.email, c.address, c.current_balance, c.credit_limit, c.opening_balance, c.active ? 'Yes' : 'No', outlets.find(o => o.outlet_id === c.outlet_id)?.outlet_name || '-', c.notes || '']);
        const csv = [h, ...rows].map(r => r.map(v => `"${v ?? ''}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url;
        a.download = `credit-customers-${new Date().toISOString().split('T')[0]}.csv`; a.click(); URL.revokeObjectURL(url);
        toast.success('Exported!');
    };

    const downloadTemplate = () => {
        const csv = `Customer Name,Phone,Email,Address,Credit Limit,Opening Balance (negative = prepayment),Notes\nJohn Kamau,0712345678,john@email.com,"Nairobi, Kenya",50000,5000,Good customer\nMary Wanjiku,0723456789,,,"Mombasa, Kenya",0,-2000,Has prepayment`;
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url;
        a.download = 'customer-import-template.csv'; a.click(); URL.revokeObjectURL(url);
    };

    const parseCSV = (text: string): string[][] => {
        const lines = text.split('\n').filter(l => l.trim());
        return lines.map(line => {
            const result: string[] = []; let current = ''; let inQuotes = false;
            for (const char of line) {
                if (char === '"') inQuotes = !inQuotes;
                else if (char === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
                else current += char;
            }
            result.push(current.trim()); return result;
        });
    };

    const handleFileUpload = (file: File) => {
        setImportFile(file);
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result as string;
            const rows = parseCSV(text);
            if (rows.length < 2) { toast.error('CSV has no data rows'); return; }
            const headers = rows[0].map(h => h.replace(/"/g, '').trim());
            setImportHeaders(headers);
            // Auto-map common headers
            const auto: Record<string, string> = {};
            const mappings: Record<string, string> = {
                'customer name': 'customer_name', 'name': 'customer_name', 'full name': 'customer_name',
                'phone': 'phone', 'mobile': 'phone', 'tel': 'phone', 'telephone': 'phone',
                'email': 'email', 'e-mail': 'email', 'address': 'address', 'location': 'address',
                'credit limit': 'credit_limit', 'limit': 'credit_limit',
                'opening balance': 'opening_balance', 'balance': 'opening_balance', 'opening bal': 'opening_balance',
                'notes': 'notes', 'note': 'notes', 'remarks': 'notes'
            };
            headers.forEach(h => {
                const key = (mappings[h.toLowerCase()] || '');
                if (key) auto[h] = key;
            });
            setImportMapping(auto);
            setImportRows(rows.slice(1).map(row => ({
                customer_name: '', phone: '', email: '', address: '', credit_limit: 0, opening_balance: 0, notes: ''
            })));
            setImportStep('map');
        };
        reader.readAsText(file);
    };

    const applyMappingAndPreview = () => {
        if (!importMapping['customer_name'] && !Object.values(importMapping).includes('customer_name')) {
            toast.error('Please map the Customer Name column'); return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result as string;
            const rows = parseCSV(text).slice(1);
            const mapped: ImportRow[] = rows.filter(r => r.some(c => c)).map(row => {
                const obj: any = { customer_name: '', phone: '', email: '', address: '', credit_limit: 0, opening_balance: 0, notes: '' };
                importHeaders.forEach((h, i) => {
                    const field = importMapping[h];
                    if (field) { obj[field] = row[i]?.replace(/"/g, '').trim() || ''; }
                });
                obj.credit_limit = parseFloat(obj.credit_limit) || 0;
                obj.opening_balance = parseFloat(obj.opening_balance) || 0;
                obj.status = obj.customer_name ? 'ready' : 'error';
                if (!obj.customer_name) obj.error = 'Missing customer name';
                return obj;
            });
            setImportRows(mapped);
            setImportStep('preview');
        };
        reader.readAsText(importFile!);
    };

    const handleImport = async () => {
        const validRows = importRows.filter(r => r.customer_name && r.status !== 'error');
        setImportImporting(true); setImportProgress(0);
        const results = { success: 0, failed: 0, errors: [] as string[] };
        for (let i = 0; i < validRows.length; i++) {
            const r = validRows[i];
            try {
                const openBal = Number(r.opening_balance) || 0;
                const outletId = selectedOutletId === 'all' ? 1 : selectedOutletId;
                const code = `CUST-${String(customers.length + i + 1).padStart(4, '0')}`;
                const { data: nc, error } = await supabase.from('retail_credit_customers').insert({
                    customer_code: code, customer_name: r.customer_name, phone: r.phone || '',
                    email: r.email || '', address: r.address || '',
                    credit_limit: Number(r.credit_limit) || 0, opening_balance: openBal,
                    current_balance: openBal, notes: r.notes || '', active: true, outlet_id: outletId
                }).select().single();
                if (error) throw error;
                if (openBal !== 0 && nc) {
                    await supabase.from('retail_credit_payments').insert({
                        customer_id: nc.customer_id, amount_paid: Math.abs(openBal),
                        balance_before: 0, balance_after: openBal,
                        payment_method: 'Opening Balance', transaction_type: openBal < 0 ? 'prepayment' : 'opening_balance',
                        payment_note: openBal < 0 ? 'Opening prepayment (import)' : 'Opening balance (import)', outlet_id: outletId
                    });
                }
                results.success++;
            } catch (err: any) { results.failed++; results.errors.push(`Row ${i + 1}: ${err.message}`); }
            setImportProgress(Math.round(((i + 1) / validRows.length) * 100));
        }
        setImportResults(results); setImportStep('done'); setImportImporting(false);
        loadCustomers();
        toast.success(`✅ Imported ${results.success} customers!`);
    };

    const toggleSort = (field: typeof sortBy) => {
        if (sortBy === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortBy(field); setSortDir('asc'); }
    };

    const SortIcon = ({ field }: { field: typeof sortBy }) =>
        sortBy === field ? (sortDir === 'asc' ? <FiTrendingUp size={12} className="text-blue-300" /> : <FiTrendingDown size={12} className="text-blue-300" />) : null;

    return (
        <div className="space-y-5" style={{ fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>

            {/* ━━━ TOP BAR ━━━ */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-300/40">
                        <FiUsers className="text-white" size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">Credit Customers</h1>
                        <p className="text-gray-500 text-sm mt-0.5">Manage credit accounts · Balances · Import · Per-outlet</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Outlet Selector */}
                    <select value={selectedOutletId} onChange={e => { const v = e.target.value === 'all' ? 'all' : Number(e.target.value); setSelectedOutletId(v); if (v !== 'all') localStorage.setItem('selectedOutletId', String(v)); setPage(1); }}
                        className="px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 focus:outline-none focus:border-blue-500 shadow-sm">
                        <option value="all">🏪 All Outlets</option>
                        {outlets.map(o => <option key={o.outlet_id} value={o.outlet_id}>{o.outlet_name}</option>)}
                    </select>
                    <button onClick={loadCustomers} className="p-2.5 rounded-xl bg-white border border-gray-200 text-gray-500 hover:text-blue-600 hover:border-blue-300 transition-all shadow-sm" title="Refresh"><FiRefreshCw size={16} /></button>
                    <button onClick={exportCSV} className="px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-600 hover:text-blue-600 hover:border-blue-300 transition-all text-sm font-semibold flex items-center gap-2 shadow-sm"><FiDownload size={14} /> Export</button>
                    <button onClick={openAddModal} className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-300/40 hover:scale-105 active:scale-95 transition-all"><FiPlus size={16} strokeWidth={3} /> Add Customer</button>
                </div>
            </div>

            {/* ━━━ STAT CARDS ━━━ */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                {[
                    { label: 'Total Customers', value: customers.length, icon: FiUsers, g: 'from-blue-500 to-blue-600', bg: 'from-blue-50 to-blue-100 border-blue-200', t: 'text-blue-600' },
                    { label: 'Active', value: activeCount, icon: FiUserCheck, g: 'from-green-500 to-green-600', bg: 'from-green-50 to-green-100 border-green-200', t: 'text-green-600' },
                    { label: 'With Balance', value: withBalance, icon: FiAlertTriangle, g: 'from-orange-500 to-orange-600', bg: 'from-orange-50 to-orange-100 border-orange-200', t: 'text-orange-600' },
                    { label: 'Total Owed', value: `Ksh ${totalOwed.toLocaleString()}`, icon: FiTrendingDown, g: 'from-red-500 to-red-600', bg: 'from-red-50 to-red-100 border-red-200', t: 'text-red-600' },
                    { label: 'Prepayments', value: `Ksh ${totalPrepayment.toLocaleString()}`, icon: FiStar, g: 'from-purple-500 to-purple-600', bg: 'from-purple-50 to-purple-100 border-purple-200', t: 'text-purple-600' },
                ].map((s, i) => (
                    <div key={i} className={`bg-gradient-to-br ${s.bg} rounded-2xl p-4 border hover:shadow-lg transition-all group cursor-default`}>
                        <div className="flex items-center gap-3">
                            <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${s.g} flex items-center justify-center text-white shadow-md group-hover:scale-110 transition-transform`}><s.icon size={18} /></div>
                            <div><p className={`text-xs ${s.t} font-semibold`}>{s.label}</p><p className="text-xl font-bold text-gray-800">{s.value}</p></div>
                        </div>
                    </div>
                ))}
            </div>

            {/* ━━━ TABS ━━━ */}
            <div className="flex gap-2 border-b border-gray-200 pb-0">
                {([['customers', FiUsers, 'Customer List'], ['import', FiUpload, 'Import CSV']] as const).map(([tab, Icon, label]) => (
                    <button key={tab} onClick={() => setActiveTab(tab as Tab)}
                        className={`flex items-center gap-2 px-5 py-3 font-semibold text-sm rounded-t-xl transition-all border-b-2 -mb-px ${activeTab === tab ? 'bg-white border-blue-500 text-blue-600 shadow-sm' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                        <Icon size={15} />{label}
                    </button>
                ))}
            </div>

            {/* ━━━ CUSTOMERS TAB ━━━ */}
            {activeTab === 'customers' && (
                <>
                    {/* Search & Filter Bar */}
                    <div className="bg-white rounded-2xl border border-gray-200 p-4 flex flex-col lg:flex-row gap-3 shadow-sm">
                        <div className="flex-1 relative">
                            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input type="text" value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
                                placeholder="Search by name, phone, email, or code..." autoComplete="off"
                                className="w-full px-5 py-3 pl-12 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-400/20 transition-all" />
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <FiFilter className="text-gray-400" size={14} />
                            {(['All', 'With Balance', 'In Credit', 'Over Limit', 'Inactive'] as const).map(s => (
                                <button key={s} onClick={() => { setFilterStatus(s); setPage(1); }}
                                    className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all ${filterStatus === s ? 'bg-blue-500 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{s}</button>
                            ))}
                            <select value={sortBy} onChange={e => { setSortBy(e.target.value as any); setPage(1); }}
                                className="px-3 py-2 bg-gray-100 border-0 rounded-xl text-xs font-semibold text-gray-600 focus:outline-none">
                                <option value="name">Sort: Name</option>
                                <option value="balance">Sort: Balance</option>
                                <option value="limit">Sort: Limit</option>
                                <option value="date">Sort: Date</option>
                            </select>
                        </div>
                    </div>

                    {/* Table */}
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-gray-200">
                            <div className="w-14 h-14 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                            <p className="mt-4 text-gray-500 font-medium">Loading customers...</p>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="text-center py-20 bg-white rounded-2xl border border-gray-200">
                            <FiUsers size={48} className="mx-auto text-gray-300 mb-4" />
                            <p className="text-gray-500 font-medium mb-1">No customers found</p>
                            <p className="text-gray-400 text-sm mb-4">{searchQuery ? 'Try a different search' : 'Add your first credit customer'}</p>
                            {!searchQuery && <button onClick={openAddModal} className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-semibold shadow-lg hover:scale-105 transition-all">+ Add Customer</button>}
                        </div>
                    ) : (
                        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="bg-gradient-to-r from-blue-600 to-indigo-700">
                                            <th className="px-4 py-3.5 text-left text-[10px] font-bold text-blue-100 uppercase tracking-widest">Code</th>
                                            <th className="px-4 py-3.5 text-left text-[10px] font-bold text-blue-100 uppercase tracking-widest cursor-pointer hover:text-white" onClick={() => toggleSort('name')}>
                                                <span className="flex items-center gap-1">Name <SortIcon field="name" /></span>
                                            </th>
                                            <th className="px-4 py-3.5 text-left text-[10px] font-bold text-blue-100 uppercase tracking-widest">Contact</th>
                                            <th className="px-4 py-3.5 text-right text-[10px] font-bold text-blue-100 uppercase tracking-widest cursor-pointer hover:text-white" onClick={() => toggleSort('balance')}>
                                                <span className="flex items-center justify-end gap-1">Balance <SortIcon field="balance" /></span>
                                            </th>
                                            <th className="px-4 py-3.5 text-right text-[10px] font-bold text-blue-100 uppercase tracking-widest cursor-pointer hover:text-white" onClick={() => toggleSort('limit')}>
                                                <span className="flex items-center justify-end gap-1">Limit <SortIcon field="limit" /></span>
                                            </th>
                                            <th className="px-4 py-3.5 text-center text-[10px] font-bold text-blue-100 uppercase tracking-widest">Outlet</th>
                                            <th className="px-4 py-3.5 text-center text-[10px] font-bold text-blue-100 uppercase tracking-widest">Status</th>
                                            <th className="px-4 py-3.5 text-center text-[10px] font-bold text-blue-100 uppercase tracking-widest">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paginated.map((c, idx) => {
                                            const isOverLimit = c.credit_limit > 0 && c.current_balance > c.credit_limit;
                                            const isPrepayment = c.current_balance < 0;
                                            const usagePct = c.credit_limit > 0 ? Math.min(100, (c.current_balance / c.credit_limit) * 100) : 0;
                                            return (
                                                <tr key={c.customer_id} className={`border-b border-gray-50 hover:bg-blue-50/30 transition-colors ${isOverLimit ? 'bg-red-50/20' : ''}`}>
                                                    <td className="px-4 py-3">
                                                        <span className="text-xs font-mono text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">{c.customer_code}</span>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <p className="font-semibold text-gray-800 text-sm">{c.customer_name}</p>
                                                        {c.address && <p className="text-[10px] text-gray-400 truncate max-w-[160px]">{c.address}</p>}
                                                        {c.notes && <p className="text-[10px] text-indigo-400 italic truncate max-w-[160px]">{c.notes}</p>}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm">
                                                        {c.phone && <p className="text-gray-600 flex items-center gap-1"><FiPhone size={11} />{c.phone}</p>}
                                                        {c.email && <p className="text-gray-400 text-xs truncate max-w-[150px]">{c.email}</p>}
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <p className={`font-bold text-sm ${isPrepayment ? 'text-purple-600' : c.current_balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                                            {isPrepayment ? '−' : ''}Ksh {Math.abs(c.current_balance || 0).toLocaleString()}
                                                        </p>
                                                        {c.credit_limit > 0 && c.current_balance > 0 && (
                                                            <div className="mt-1 h-1.5 bg-gray-100 rounded-full overflow-hidden w-20 ml-auto">
                                                                <div className={`h-full rounded-full transition-all ${isOverLimit ? 'bg-red-500' : usagePct > 70 ? 'bg-orange-400' : 'bg-green-400'}`} style={{ width: `${usagePct}%` }} />
                                                            </div>
                                                        )}
                                                        {isPrepayment && <span className="text-[9px] text-purple-500 font-bold">PREPAYMENT</span>}
                                                        {isOverLimit && <span className="text-[9px] text-red-500 font-bold">OVER LIMIT</span>}
                                                    </td>
                                                    <td className="px-4 py-3 text-right text-sm text-gray-600">Ksh {(c.credit_limit || 0).toLocaleString()}</td>
                                                    <td className="px-4 py-3 text-center">
                                                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-lg">
                                                            {outlets.find(o => o.outlet_id === c.outlet_id)?.outlet_name || 'Main'}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold ${c.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                                            ● {c.active ? 'Active' : 'Inactive'}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <div className="flex items-center justify-center gap-1">
                                                            <button onClick={() => loadCustomerDetails(c)} className="p-1.5 bg-white border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-all" title="View Details"><FiEye size={13} className="text-blue-500" /></button>
                                                            <a href={`/dashboard/credit-statements?customer=${c.customer_id}`} className="p-1.5 bg-white border border-gray-200 rounded-lg hover:bg-indigo-50 hover:border-indigo-300 transition-all" title="Statement"><FiFileText size={13} className="text-indigo-500" /></a>
                                                            <button onClick={() => openEditModal(c)} className="p-1.5 bg-white border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-all" title="Edit"><FiEdit2 size={13} className="text-blue-500" /></button>
                                                            <button onClick={() => setShowDeleteConfirm(c)} className="p-1.5 bg-white border border-gray-200 rounded-lg hover:bg-red-50 hover:border-red-300 transition-all" title="Delete"><FiTrash2 size={13} className="text-red-500" /></button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            {/* Pagination */}
                            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                                <span className="text-xs text-gray-500">{filtered.length} customers · Showing {Math.min((page - 1) * perPage + 1, filtered.length)}–{Math.min(page * perPage, filtered.length)}</span>
                                <div className="flex items-center gap-1">
                                    <button onClick={() => setPage(1)} disabled={page === 1} className="px-2 py-1.5 rounded-lg disabled:opacity-30 hover:bg-gray-100 text-xs font-bold transition-all">«</button>
                                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-2 rounded-lg disabled:opacity-30 hover:bg-gray-100 transition-all"><FiChevronLeft size={16} /></button>
                                    {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                                        const pg = totalPages <= 7 ? i + 1 : Math.max(1, page - 3) + i;
                                        if (pg > totalPages) return null;
                                        return <button key={pg} onClick={() => setPage(pg)} className={`w-9 h-9 rounded-xl text-sm font-bold transition-all ${pg === page ? 'bg-blue-500 text-white shadow-md' : 'text-gray-500 hover:bg-gray-100'}`}>{pg}</button>;
                                    })}
                                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-2 rounded-lg disabled:opacity-30 hover:bg-gray-100 transition-all"><FiChevronRight size={16} /></button>
                                    <button onClick={() => setPage(totalPages)} disabled={page === totalPages} className="px-2 py-1.5 rounded-lg disabled:opacity-30 hover:bg-gray-100 text-xs font-bold transition-all">»</button>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* ━━━ IMPORT TAB ━━━ */}
            {activeTab === 'import' && (
                <div className="space-y-5">
                    {/* Step indicator */}
                    <div className="flex items-center gap-0">
                        {[['upload', '1', 'Upload File'], ['map', '2', 'Map Columns'], ['preview', '3', 'Preview'], ['done', '4', 'Done']].map(([step, num, label], i) => (
                            <div key={step} className="flex items-center">
                                <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${importStep === step ? 'bg-blue-500 text-white shadow-lg shadow-blue-300/40' : ['upload', 'map', 'preview', 'done'].indexOf(importStep) > i ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${importStep === step ? 'bg-white/20' : ''}`}>{['upload', 'map', 'preview', 'done'].indexOf(importStep) > i ? '✓' : num}</span>
                                    {label}
                                </div>
                                {i < 3 && <FiArrowRight className="text-gray-300 mx-1" size={16} />}
                            </div>
                        ))}
                    </div>

                    {/* Step 1: Upload */}
                    {importStep === 'upload' && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><FiUpload size={18} className="text-blue-500" /> Upload CSV File</h3>
                                <div
                                    onClick={() => fileRef.current?.click()}
                                    onDragOver={e => e.preventDefault()}
                                    onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFileUpload(f); }}
                                    className="border-2 border-dashed border-blue-200 hover:border-blue-400 bg-blue-50/30 hover:bg-blue-50/60 rounded-2xl p-10 text-center cursor-pointer transition-all group">
                                    <FiUpload size={40} className="mx-auto text-blue-300 group-hover:text-blue-500 mb-3 transition-colors" />
                                    <p className="font-semibold text-gray-600 mb-1">Drag & drop your CSV file here</p>
                                    <p className="text-sm text-gray-400">or click to browse</p>
                                    <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }} />
                                </div>
                                {importFile && <p className="mt-3 text-sm text-green-600 flex items-center gap-2"><FiCheckCircle size={16} /> {importFile.name}</p>}
                            </div>
                            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><FiFileText size={18} className="text-indigo-500" /> Import Instructions</h3>
                                <div className="space-y-3 text-sm text-gray-600">
                                    <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-xl">
                                        <span className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">1</span>
                                        <p>Download the template CSV and fill in your customer data</p>
                                    </div>
                                    <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-xl">
                                        <span className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">2</span>
                                        <p>For <strong>Opening Balance</strong>: positive = customer owes money, negative = customer has prepayment</p>
                                    </div>
                                    <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-xl">
                                        <span className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">3</span>
                                        <p>All imported customers will be assigned to the <strong>currently selected outlet</strong></p>
                                    </div>
                                    <div className="flex items-start gap-3 p-3 bg-orange-50 rounded-xl border border-orange-200">
                                        <FiAlertCircle size={16} className="text-orange-500 flex-shrink-0 mt-0.5" />
                                        <p className="text-orange-700">Duplicate customers will be imported as new entries. Review before importing.</p>
                                    </div>
                                </div>
                                <button onClick={downloadTemplate} className="mt-4 w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold rounded-xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-300/40">
                                    <FiDownload size={16} /> Download Import Template
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Map Columns */}
                    {importStep === 'map' && (
                        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                            <h3 className="font-bold text-gray-800 mb-5 flex items-center gap-2"><FiSliders size={18} className="text-blue-500" /> Map CSV Columns to Fields</h3>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                {importHeaders.map(header => (
                                    <div key={header} className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
                                        <div className="flex-1">
                                            <p className="text-xs text-gray-400 font-medium mb-0.5">CSV Column</p>
                                            <p className="font-semibold text-gray-800">{header}</p>
                                        </div>
                                        <FiArrowRight size={16} className="text-gray-300" />
                                        <div className="flex-1">
                                            <p className="text-xs text-gray-400 font-medium mb-0.5">Maps to Field</p>
                                            <select value={importMapping[header] || ''} onChange={e => setImportMapping(prev => ({ ...prev, [header]: e.target.value }))}
                                                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500">
                                                <option value="">— Skip this column —</option>
                                                <option value="customer_name">Customer Name *</option>
                                                <option value="phone">Phone</option>
                                                <option value="email">Email</option>
                                                <option value="address">Address</option>
                                                <option value="credit_limit">Credit Limit</option>
                                                <option value="opening_balance">Opening Balance</option>
                                                <option value="notes">Notes</option>
                                            </select>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="flex gap-3 mt-5">
                                <button onClick={() => { setImportStep('upload'); setImportFile(null); setImportHeaders([]); }} className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-semibold hover:bg-gray-200 transition-all">← Back</button>
                                <button onClick={applyMappingAndPreview} className="flex-1 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-blue-300/40 hover:scale-[1.02] active:scale-95 transition-all">Preview Data →</button>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Preview */}
                    {importStep === 'preview' && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="bg-green-100 text-green-700 px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2"><FiCheckCircle size={16} />{importRows.filter(r => r.status !== 'error').length} Ready</div>
                                    {importRows.filter(r => r.status === 'error').length > 0 && <div className="bg-red-100 text-red-700 px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2"><FiAlertCircle size={16} />{importRows.filter(r => r.status === 'error').length} Errors</div>}
                                </div>
                                <div className="flex gap-3">
                                    <button onClick={() => setImportStep('map')} className="px-4 py-2.5 bg-gray-100 text-gray-600 rounded-xl font-semibold hover:bg-gray-200 text-sm transition-all">← Back</button>
                                    <button onClick={handleImport} disabled={importImporting || importRows.filter(r => r.status !== 'error').length === 0}
                                        className="px-6 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-xl shadow-lg shadow-green-300/40 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2">
                                        {importImporting ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Importing {importProgress}%</> : <><FiCheckCircle size={16} />Import {importRows.filter(r => r.status !== 'error').length} Customers</>}
                                    </button>
                                </div>
                            </div>
                            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                                <div className="overflow-x-auto max-h-[400px]">
                                    <table className="w-full">
                                        <thead className="sticky top-0">
                                            <tr className="bg-gradient-to-r from-blue-600 to-indigo-700">
                                                <th className="px-4 py-3 text-left text-[10px] font-bold text-blue-100 uppercase">#</th>
                                                <th className="px-4 py-3 text-left text-[10px] font-bold text-blue-100 uppercase">Name</th>
                                                <th className="px-4 py-3 text-left text-[10px] font-bold text-blue-100 uppercase">Phone</th>
                                                <th className="px-4 py-3 text-right text-[10px] font-bold text-blue-100 uppercase">Credit Limit</th>
                                                <th className="px-4 py-3 text-right text-[10px] font-bold text-blue-100 uppercase">Opening Bal</th>
                                                <th className="px-4 py-3 text-left text-[10px] font-bold text-blue-100 uppercase">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {importRows.map((r, i) => (
                                                <tr key={i} className={`border-b border-gray-50 text-sm ${r.status === 'error' ? 'bg-red-50' : ''}`}>
                                                    <td className="px-4 py-2.5 text-gray-400 text-xs">{i + 1}</td>
                                                    <td className="px-4 py-2.5 font-medium text-gray-800">{r.customer_name || <span className="text-red-400">Missing!</span>}</td>
                                                    <td className="px-4 py-2.5 text-gray-600">{r.phone || '-'}</td>
                                                    <td className="px-4 py-2.5 text-right text-gray-700">Ksh {(r.credit_limit || 0).toLocaleString()}</td>
                                                    <td className={`px-4 py-2.5 text-right font-semibold ${r.opening_balance < 0 ? 'text-purple-600' : r.opening_balance > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                                                        {r.opening_balance !== 0 ? `Ksh ${Math.abs(r.opening_balance).toLocaleString()}${r.opening_balance < 0 ? ' (prepay)' : ''}` : '-'}
                                                    </td>
                                                    <td className="px-4 py-2.5">
                                                        {r.status === 'error' ? <span className="text-xs text-red-600 flex items-center gap-1"><FiAlertCircle size={12} />{r.error}</span> : <span className="text-xs text-green-600 flex items-center gap-1"><FiCheckCircle size={12} />Ready</span>}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 4: Done */}
                    {importStep === 'done' && (
                        <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center shadow-sm">
                            <div className="w-20 h-20 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-5 shadow-xl shadow-green-300/40">
                                <FiCheckCircle className="text-white" size={36} />
                            </div>
                            <h2 className="text-2xl font-bold text-gray-800 mb-2">Import Complete!</h2>
                            <p className="text-gray-500 mb-6">Your customers have been imported successfully</p>
                            <div className="flex items-center justify-center gap-6 mb-8">
                                <div className="text-center"><p className="text-3xl font-bold text-green-600">{importResults.success}</p><p className="text-sm text-gray-500">Imported</p></div>
                                {importResults.failed > 0 && <div className="text-center"><p className="text-3xl font-bold text-red-600">{importResults.failed}</p><p className="text-sm text-gray-500">Failed</p></div>}
                            </div>
                            {importResults.errors.length > 0 && (
                                <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-left mb-5">
                                    <p className="text-sm font-semibold text-red-700 mb-2">Errors:</p>
                                    {importResults.errors.map((e, i) => <p key={i} className="text-xs text-red-600">{e}</p>)}
                                </div>
                            )}
                            <div className="flex gap-3 justify-center">
                                <button onClick={() => { setImportStep('upload'); setImportFile(null); setImportHeaders([]); setImportRows([]); setImportMapping({}); }}
                                    className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-all">Import More</button>
                                <button onClick={() => setActiveTab('customers')} className="px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-blue-300/40 hover:scale-[1.02] transition-all">View Customers →</button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ━━━ VIEW CUSTOMER MODAL ━━━ */}
            {viewCustomer && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl max-h-[92vh] overflow-y-auto">
                        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-6 py-5 text-white rounded-t-3xl">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-xl font-bold">{viewCustomer.customer_name}</h2>
                                    <p className="text-blue-200 text-sm">{viewCustomer.customer_code} · {viewCustomer.phone}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <a href={`/dashboard/credit-statements?customer=${viewCustomer.customer_id}`}
                                        className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-sm font-semibold transition-colors">
                                        <FiFileText size={14} /> Full Statement
                                    </a>
                                    <button onClick={() => setViewCustomer(null)} className="p-2 hover:bg-white/20 rounded-xl transition-colors"><FiX size={20} /></button>
                                </div>
                            </div>
                        </div>
                        <div className="p-6 space-y-5">
                            {/* Summary Cards */}
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                <div className="bg-blue-50 p-4 rounded-xl text-center">
                                    <p className="text-xs text-blue-600 font-semibold mb-1">Current Balance</p>
                                    <p className={`text-2xl font-bold ${viewCustomer.current_balance > 0 ? 'text-red-600' : viewCustomer.current_balance < 0 ? 'text-purple-600' : 'text-green-600'}`}>
                                        Ksh {Math.abs(viewCustomer.current_balance || 0).toLocaleString()}
                                    </p>
                                    {viewCustomer.current_balance < 0 && <p className="text-xs text-purple-500 mt-1">Prepayment</p>}
                                </div>
                                <div className="bg-green-50 p-4 rounded-xl text-center">
                                    <p className="text-xs text-green-600 font-semibold mb-1">Credit Limit</p>
                                    <p className="text-2xl font-bold text-green-700">Ksh {(viewCustomer.credit_limit || 0).toLocaleString()}</p>
                                </div>
                                <div className="bg-purple-50 p-4 rounded-xl text-center">
                                    <p className="text-xs text-purple-600 font-semibold mb-1">Total Sales</p>
                                    <p className="text-2xl font-bold text-purple-700">{customerSales.length}</p>
                                </div>
                                <div className="bg-orange-50 p-4 rounded-xl text-center">
                                    <p className="text-xs text-orange-600 font-semibold mb-1">Total Paid</p>
                                    <p className="text-2xl font-bold text-orange-700">Ksh {customerPayments.reduce((s, p) => s + (p.amount_paid || 0), 0).toLocaleString()}</p>
                                </div>
                            </div>
                            {/* Contact & Notes */}
                            <div className="flex flex-wrap gap-4 text-sm text-gray-600 p-4 bg-gray-50 rounded-xl">
                                {viewCustomer.phone && <span className="flex items-center gap-1.5"><FiPhone size={14} className="text-blue-500" />{viewCustomer.phone}</span>}
                                {viewCustomer.email && <span className="flex items-center gap-1.5"><FiMail size={14} className="text-blue-500" />{viewCustomer.email}</span>}
                                {viewCustomer.address && <span className="flex items-center gap-1.5"><FiMapPin size={14} className="text-blue-500" />{viewCustomer.address}</span>}
                                {viewCustomer.notes && <span className="flex items-center gap-1.5 text-indigo-600 italic">{viewCustomer.notes}</span>}
                            </div>
                            {loadingDetails ? (
                                <div className="flex justify-center py-10"><div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>
                            ) : (
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                                    {/* Recent Sales */}
                                    <div>
                                        <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2"><FiActivity size={16} className="text-blue-500" />Recent Sales ({customerSales.length})</h3>
                                        <div className="space-y-2 max-h-52 overflow-y-auto">
                                            {customerSales.length === 0 ? <p className="text-gray-400 text-sm p-3 bg-gray-50 rounded-xl">No sales found</p> :
                                                customerSales.slice(0, 15).map((s: any) => (
                                                    <div key={s.sale_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-blue-50 transition-colors">
                                                        <div>
                                                            <p className="text-sm font-semibold text-gray-800">{s.receipt_no}</p>
                                                            <p className="text-xs text-gray-500">{new Date(s.sale_datetime).toLocaleDateString('en-GB')} · <span className={s.payment_method === 'CREDIT' ? 'text-orange-600 font-semibold' : 'text-green-600'}>{s.payment_method}</span></p>
                                                        </div>
                                                        <p className="font-bold text-gray-800 text-sm">Ksh {(s.total_amount || 0).toLocaleString()}</p>
                                                    </div>
                                                ))}
                                        </div>
                                    </div>
                                    {/* Payment History */}
                                    <div>
                                        <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2"><FiDollarSign size={16} className="text-green-500" />Payments ({customerPayments.length})</h3>
                                        <div className="space-y-2 max-h-52 overflow-y-auto">
                                            {customerPayments.length === 0 ? <p className="text-gray-400 text-sm p-3 bg-gray-50 rounded-xl">No payments found</p> :
                                                customerPayments.slice(0, 15).map((p: any) => (
                                                    <div key={p.payment_id} className="flex items-center justify-between p-3 bg-green-50 rounded-xl hover:bg-green-100 transition-colors">
                                                        <div>
                                                            <p className="text-sm font-semibold text-gray-800">Ksh {(p.amount_paid || 0).toLocaleString()}</p>
                                                            <p className="text-xs text-gray-500">{new Date(p.payment_datetime || p.created_at).toLocaleDateString('en-GB')} · {p.payment_method}</p>
                                                            {p.mpesa_code && <p className="text-xs text-green-600 font-mono">{p.mpesa_code}</p>}
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-xs text-gray-400">Bal after</p>
                                                            <p className="font-bold text-sm text-gray-700">Ksh {(p.balance_after || 0).toLocaleString()}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ━━━ ADD/EDIT MODAL ━━━ */}
            {showModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl max-h-[92vh] overflow-y-auto">
                        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-6 py-5 text-white rounded-t-3xl">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-xl font-bold">{editingCustomer ? 'Edit Customer' : 'Add New Customer'}</h2>
                                    {editingCustomer && <p className="text-blue-200 text-xs mt-0.5">{editingCustomer.customer_code}</p>}
                                </div>
                                <button onClick={() => setShowModal(false)} className="p-2 hover:bg-white/20 rounded-xl transition-colors"><FiX size={20} /></button>
                            </div>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Customer Name *</label>
                                <input value={formData.customer_name} onChange={e => setFormData({ ...formData, customer_name: e.target.value })}
                                    placeholder="e.g., John Kamau" autoFocus
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-400/20 transition-all" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Phone</label>
                                    <input value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                        placeholder="07XX XXX XXX"
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-400/20 transition-all" />
                                </div>
                                <div>
                                    <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Email</label>
                                    <input value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })}
                                        placeholder="email@example.com" type="email"
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-400/20 transition-all" />
                                </div>
                            </div>
                            <div>
                                <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Address</label>
                                <input value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })}
                                    placeholder="P.O. Box 123, Nairobi"
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-400/20 transition-all" />
                            </div>
                            <div>
                                <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Notes / Remarks</label>
                                <textarea value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                    placeholder="Internal notes about this customer..." rows={2}
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-400/20 transition-all resize-none" />
                            </div>
                            {/* Credit Settings */}
                            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-5 border border-blue-200">
                                <h3 className="font-bold text-blue-800 mb-4 flex items-center gap-2"><FiCreditCard size={16} /> Credit Settings</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Credit Limit (Ksh)</label>
                                        <input type="number" value={formData.credit_limit} onChange={e => setFormData({ ...formData, credit_limit: Number(e.target.value) })}
                                            min="0" placeholder="0"
                                            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-400/20 transition-all" />
                                        <p className="text-xs text-gray-400 mt-1">0 = unlimited</p>
                                    </div>
                                    {!editingCustomer && (
                                        <div>
                                            <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Opening Balance (Ksh)</label>
                                            <input type="number" value={formData.opening_balance} onChange={e => setFormData({ ...formData, opening_balance: Number(e.target.value) })}
                                                placeholder="0"
                                                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-400/20 transition-all" />
                                            <p className="text-xs text-gray-400 mt-1">Negative = prepayment</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                            {/* Outlet + Active */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Outlet</label>
                                    <select value={formData.outlet_id} onChange={e => setFormData({ ...formData, outlet_id: Number(e.target.value) })}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 transition-all text-sm">
                                        {outlets.map(o => <option key={o.outlet_id} value={o.outlet_id}>{o.outlet_name}</option>)}
                                        {outlets.length === 0 && <option value={1}>Main Store</option>}
                                    </select>
                                </div>
                                <div className="flex items-end">
                                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl w-full">
                                        <input type="checkbox" checked={formData.active} onChange={e => setFormData({ ...formData, active: e.target.checked })}
                                            className="w-5 h-5 rounded-lg accent-blue-500" />
                                        <span className="text-sm font-medium text-gray-700">Active Customer</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button onClick={() => setShowModal(false)} className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-semibold hover:bg-gray-200 transition-all">Cancel</button>
                                <button onClick={handleSubmit} disabled={formLoading}
                                    className="flex-1 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-blue-300/40 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                                    {formLoading ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving...</> : editingCustomer ? 'Update Customer' : 'Add Customer'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ━━━ DELETE CONFIRM ━━━ */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl p-8 text-center">
                        <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-5"><FiTrash2 size={28} className="text-red-500" /></div>
                        <h2 className="text-xl font-bold text-gray-800 mb-2">Delete Customer?</h2>
                        <p className="text-gray-500 mb-2">This will permanently delete <strong>{showDeleteConfirm.customer_name}</strong>.</p>
                        {showDeleteConfirm.current_balance > 0 && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-xl mb-4">⚠️ This customer has an outstanding balance of Ksh {showDeleteConfirm.current_balance.toLocaleString()}</p>}
                        <div className="flex gap-3">
                            <button onClick={() => setShowDeleteConfirm(null)} className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-semibold hover:bg-gray-200 transition-all">Cancel</button>
                            <button onClick={() => handleDelete(showDeleteConfirm)} className="flex-1 py-3 bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-xl font-bold shadow-lg hover:scale-[1.02] active:scale-95 transition-all">Delete</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
