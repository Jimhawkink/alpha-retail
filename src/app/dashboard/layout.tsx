'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
    Home, ShoppingCart, Package, Tag, FileText, RefreshCw,
    Truck, Users, Box, Activity, Repeat, AlertCircle,
    DollarSign, Clock, TrendingDown, CreditCard, Smartphone,
    TrendingUp, BarChart2, PieChart, Settings, MapPin, Shield,
    Zap, Briefcase, ChevronDown, ChevronLeft, ChevronRight,
    LogOut, Search, Bell, Menu, X, Database, Sliders, Download, Lock,
    Store, Calendar
} from 'lucide-react';
import { SettingsProvider, useCompanyName } from '@/context/SettingsContext';
import { OutletProvider, useOutlet } from '@/context/OutletContext';
import { FeatureProvider } from '@/context/FeatureContext';
import { logActivity, supabase } from '@/lib/supabase';




const menuGroups = [
    { label: '', collapsible: false, name: 'main', items: [
        { href: '/dashboard',     label: 'Dashboard',  icon: Home,         roles: 'all' },
        { href: '/dashboard/pos', label: 'Retail POS', icon: ShoppingCart, roles: 'all', badge: 'LIVE' },
    ]},
    { label: 'Sales & Products', icon: ShoppingCart, name: 'sales', collapsible: true, items: [
        { href: '/dashboard/products',     label: 'Products',       icon: Package,    roles: 'all' },
        { href: '/dashboard/categories',   label: 'Categories',     icon: Tag,        roles: 'all' },
        { href: '/dashboard/sales',        label: 'Sales Records',  icon: FileText,   roles: 'all' },
        { href: '/dashboard/sales-return', label: 'Sales Return',   icon: RefreshCw,  roles: 'all' },
    ]},
    { label: 'Purchases', icon: Truck, name: 'purchases', collapsible: true, items: [
        { href: '/dashboard/suppliers',       label: 'Suppliers',        icon: Users,      roles: 'all' },
        { href: '/dashboard/purchase',        label: 'Purchase Entry',   icon: Download,   roles: 'all' },
        { href: '/dashboard/purchases',       label: 'Purchase Records', icon: FileText,   roles: 'all' },
        { href: '/dashboard/purchase-return', label: 'Purchase Return',  icon: RefreshCw,  roles: 'all' },
    ]},
    { label: 'Inventory', icon: Box, name: 'inventory', collapsible: true, items: [
        { href: '/dashboard/stock-movement',  label: 'Stock Movement',  icon: Activity,    roles: 'all' },
        { href: '/dashboard/stock-transfer',  label: 'Stock Transfer',  icon: Repeat,      roles: 'all' },
        { href: '/dashboard/low-stock',       label: 'Low Stock',       icon: AlertCircle, roles: 'all' },
        { href: '/dashboard/expiry-register', label: 'Expiry Register', icon: Clock,       roles: 'all' },
    ]},
    { label: 'Finance', icon: DollarSign, name: 'finance', collapsible: true, items: [
        { href: '/dashboard/expenses',          label: 'Expenses',           icon: TrendingDown, roles: 'all' },
        { href: '/dashboard/credit-customers',  label: 'Credit Customers',   icon: Users,        roles: 'all' },
        { href: '/dashboard/credit-payments',   label: 'Credit Payments',    icon: CreditCard,   roles: 'all' },
        { href: '/dashboard/credit-statements', label: 'Credit Statements',  icon: FileText,     roles: 'all', badge: 'NEW' },
        { href: '/dashboard/mpesa',             label: 'M-Pesa',             icon: Smartphone,   roles: 'all' },
    ]},
    { label: 'HR & Payroll', icon: Users, name: 'hr', collapsible: true, items: [
        { href: '/dashboard/payroll',       label: 'Payroll',       icon: DollarSign, roles: 'all' },
        { href: '/dashboard/advances',      label: 'Advances',      icon: TrendingUp, roles: 'all' },
        { href: '/dashboard/shifts',        label: 'Shifts',        icon: Clock,      roles: 'all' },
        { href: '/dashboard/shift-reports', label: 'Shift Reports', icon: FileText,   roles: 'all' },
    ]},
    { label: '', icon: undefined, name: 'fullsalesreport', collapsible: false, items: [
        { href: '/dashboard/reports/full-sales-report', label: 'Full Sales Report', icon: BarChart2, roles: 'all', badge: 'NEW' },
    ]},
    { label: 'Reports', icon: BarChart2, name: 'reports', collapsible: true, items: [
        { href: '/dashboard/reports/full-sales-report',              label: 'Full Sales Report',        icon: BarChart2,    roles: 'all', badge: 'NEW' },
        { href: '/dashboard/sales-summary',                      label: 'Sales Summary',           icon: TrendingUp,   roles: 'all' },
        { href: '/dashboard/reports/sales',                      label: 'Sales Report',            icon: FileText,     roles: 'all' },
        { href: '/dashboard/reports/profit',                     label: 'Profit Report',           icon: PieChart,     roles: 'all' },
        { href: '/dashboard/reports/stock',                      label: 'Stock Report',            icon: Box,          roles: 'all' },
        { href: '/dashboard/reports/profit-loss',                label: 'P&L Report',              icon: TrendingDown, roles: 'all' },
        { href: '/dashboard/reports/trial-balance',              label: 'Trial Balance',           icon: Database,     roles: 'all' },
        { href: '/dashboard/reports/balance-sheet',              label: 'Balance Sheet',           icon: FileText,     roles: 'all' },
        { href: '/dashboard/reports/cash-book',                  label: 'Cash Book',               icon: DollarSign,   roles: 'all' },
        { href: '/dashboard/reports/mpesa',                      label: 'M-Pesa Report',           icon: Smartphone,   roles: 'all' },
        { href: '/dashboard/reports/fast-slow-moving',           label: 'Fast/Slow Moving',        icon: Activity,     roles: 'all' },
        { href: '/dashboard/reports/ultra-analysis',             label: 'Ultra Analysis',          icon: TrendingUp,   roles: 'all', badge: 'NEW' },
        { href: '/dashboard/reports/dead-stock',                 label: 'Dead Stock',              icon: AlertCircle,  roles: 'all' },
        { href: '/dashboard/reports/gross-margin',               label: 'Gross Margin',            icon: PieChart,     roles: 'all' },
        { href: '/dashboard/reports/price-history',              label: 'Price History',           icon: TrendingUp,   roles: 'all' },
        { href: '/dashboard/reports/outlet-comparison',          label: 'Outlet Comparison',       icon: MapPin,       roles: 'all' },
        { href: '/dashboard/reports/reorder-suggestion',         label: 'Reorder Suggestions',     icon: AlertCircle,  roles: 'all' },
        { href: '/dashboard/reports/cashier-performance',        label: 'Cashier Performance',     icon: Users,        roles: 'all' },
        { href: '/dashboard/reports/stock-variance',             label: 'Stock Variance',          icon: Activity,     roles: 'all' },
        { href: '/dashboard/reports/vat-report',                 label: 'VAT Report',              icon: FileText,     roles: 'all' },
        { href: '/dashboard/reports/supplier-performance',       label: 'Supplier Performance',    icon: Truck,        roles: 'all' },
        { href: '/dashboard/reports/discount-report',            label: 'Discount Report',         icon: Tag,          roles: 'all' },
        { href: '/dashboard/reports/customer-statement',         label: 'Customer Statement',      icon: CreditCard,   roles: 'all' },
        { href: '/dashboard/reports/purchase-price-variance',    label: 'Purchase Price Variance', icon: TrendingDown, roles: 'all' },
        { href: '/dashboard/reports/stock-aging',                label: 'Stock Aging',             icon: Clock,        roles: 'all' },
        { href: '/dashboard/reports/expense-trend',              label: 'Revenue vs Expenses',     icon: BarChart2,    roles: 'all' },
        { href: '/dashboard/reports/customer-at-glance',         label: 'Customer at Glance',      icon: Users,        roles: 'all', badge: 'NEW' },
    ]},
    { label: 'Operations', icon: Zap, name: 'operations', collapsible: true, items: [
        { href: '/dashboard/promotions',      label: 'Promotions',       icon: Tag,         roles: 'all', badge: 'NEW' },
        { href: '/dashboard/loyalty',         label: 'Loyalty Program',  icon: Activity,    roles: 'all', badge: 'NEW' },
        { href: '/dashboard/purchase-orders', label: 'Purchase Orders',  icon: FileText,    roles: 'all', badge: 'NEW' },
        { href: '/dashboard/barcode-labels',  label: 'Barcode Labels',   icon: BarChart2,   roles: 'all', badge: 'NEW' },
        { href: '/dashboard/quotations',      label: 'Quotations',       icon: FileText,    roles: 'all', badge: 'NEW' },
        { href: '/dashboard/price-list',      label: 'Price List',       icon: DollarSign,  roles: 'all', badge: 'NEW' },
    ]},
    { label: 'Management', icon: Briefcase, name: 'management', collapsible: true, items: [
        { href: '/dashboard/petty-cash',      label: 'Petty Cash',       icon: DollarSign,  roles: 'all', badge: 'NEW' },
        { href: '/dashboard/damage-wastage',  label: 'Damage & Wastage', icon: AlertCircle, roles: 'all', badge: 'NEW' },
        { href: '/dashboard/budget',          label: 'Budget vs Actual', icon: PieChart,    roles: 'all', badge: 'NEW' },
        { href: '/dashboard/smart-insights',  label: 'Smart Insights 🧠',icon: Zap,         roles: 'all', badge: 'AI' },
    ]},
    { label: 'Administration', icon: Settings, name: 'admin', collapsible: true, items: [
        { href: '/dashboard/outlets',           label: 'Outlets',           icon: MapPin,      roles: 'superadmin' },
        { href: '/dashboard/users',             label: 'Users',             icon: Users,       roles: 'all' },
        { href: '/dashboard/user-roles',        label: 'User Roles',        icon: Shield,      roles: 'all' },
        { href: '/dashboard/activity-log',      label: 'Activity Log',      icon: Activity,    roles: 'admin' },
        { href: '/dashboard/company',           label: 'Company',           icon: Home,        roles: 'all' },
        { href: '/dashboard/tax-settings',      label: 'Tax Settings',      icon: FileText,    roles: 'all' },
        { href: '/dashboard/units',             label: 'Units',             icon: Sliders,     roles: 'all' },
        { href: '/dashboard/mpesa-settings',    label: 'M-Pesa Config',     icon: Zap,         roles: 'superadmin', badge: 'SA' },
        { href: '/dashboard/kcb-settings',      label: 'KCB Buni Config',   icon: Zap,         roles: 'superadmin', badge: 'SA' },
        { href: '/dashboard/businesses',        label: 'Businesses',        icon: Briefcase,   roles: 'superadmin', badge: 'SA' },
        { href: '/dashboard/license',                   label: '🔐 License Mgmt',     icon: Shield,      roles: 'superadmin', badge: 'SA' },
        { href: '/dashboard/admin/features',            label: '🚀 Feature Manager',   icon: Sliders,     roles: 'superadmin', badge: 'SA' },
        { href: '/dashboard/admin/system-lockout',      label: '🔴 System Lockout',    icon: Lock,        roles: 'superadmin', badge: 'SA' },
    ]},
];

// ── Pledge Notification Bell ──────────────────────────────────────────
interface PledgeNotif {
    pledge_id: number; customer_id: number; pledge_date: string;
    pledge_amount: number; note: string; status: string;
    customer_name?: string; phone?: string;
}

function PledgeNotificationBell() {
    const { activeOutlet } = useOutlet();
    const outletId = activeOutlet?.outlet_id ?? null;
    const [pledges, setPledges] = useState<PledgeNotif[]>([]);
    const [open, setOpen]       = useState(false);
    const [marking, setMarking] = useState<number | null>(null);
    const ref = useRef<HTMLDivElement>(null);

    const loadPledges = useCallback(async () => {
        try {
            let q = supabase
                .from('retail_credit_pledges')
                .select('*, retail_credit_customers(customer_name, phone)')
                .eq('status', 'pending')
                .lte('pledge_date', new Date().toISOString().split('T')[0])
                .order('pledge_date');
            if (outletId) q = q.eq('outlet_id', outletId);
            const { data } = await q;
            const mapped = (data || []).map((p: any) => ({
                ...p,
                customer_name: p.retail_credit_customers?.customer_name || 'Unknown',
                phone: p.retail_credit_customers?.phone || '',
            }));
            setPledges(mapped);
        } catch {}
    }, [outletId]);

    // Load on mount and every 5 minutes
    useEffect(() => {
        loadPledges();
        const iv = setInterval(loadPledges, 5 * 60 * 1000);
        return () => clearInterval(iv);
    }, [loadPledges]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const markPaid = async (pledgeId: number) => {
        setMarking(pledgeId);
        await supabase.from('retail_credit_pledges').update({ status: 'paid' }).eq('pledge_id', pledgeId);
        setPledges(prev => prev.filter(p => p.pledge_id !== pledgeId));
        setMarking(null);
    };

    const daysOverdue = (date: string) =>
        Math.floor((Date.now() - new Date(date).getTime()) / 86400000);

    const count = pledges.length;

    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => setOpen(o => !o)}
                className="relative p-2 rounded-xl text-gray-500 hover:bg-gray-100 transition-colors"
            >
                <Bell size={17} className={count > 0 ? 'text-red-500' : ''} />
                {count > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center border border-white animate-pulse">
                        {count > 9 ? '9+' : count}
                    </span>
                )}
            </button>

            {open && (
                <div className="absolute right-0 top-12 w-80 z-50 rounded-2xl shadow-2xl border border-red-100 overflow-hidden"
                    style={{ background: 'linear-gradient(135deg,#FFF5F5,#FFFFFF)' }}>
                    {/* Header */}
                    <div className="px-4 py-3 flex items-center justify-between border-b border-red-100" style={{ background: 'linear-gradient(135deg,#FEE2E2,#FEF2F2)' }}>
                        <div className="flex items-center gap-2">
                            <Bell size={14} className="text-red-500" />
                            <span className="text-sm font-black text-red-700">Payment Pledges</span>
                            {count > 0 && (
                                <span className="px-1.5 py-0.5 bg-red-500 text-white text-[9px] font-black rounded-full">{count} overdue</span>
                            )}
                        </div>
                        <button onClick={() => setOpen(false)} className="text-red-300 hover:text-red-600 transition-colors">
                            <X size={14} />
                        </button>
                    </div>

                    {/* Pledge list */}
                    <div className="max-h-80 overflow-y-auto">
                        {count === 0 ? (
                            <div className="py-8 text-center">
                                <div className="text-2xl mb-2">✅</div>
                                <p className="text-sm font-semibold text-gray-600">No overdue pledges!</p>
                                <p className="text-xs text-gray-400 mt-1">All payment promises are on track</p>
                            </div>
                        ) : (
                            pledges.map(p => {
                                const od = daysOverdue(p.pledge_date);
                                return (
                                    <div key={p.pledge_id} className="px-4 py-3 border-b border-red-50 hover:bg-red-50/50 transition-colors">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span className="font-bold text-sm text-gray-800 truncate">{p.customer_name}</span>
                                                    <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black bg-red-100 text-red-600">{od}d overdue</span>
                                                </div>
                                                {p.phone && (
                                                    <a href={`tel:${p.phone}`} className="flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700 mt-0.5 font-medium">
                                                        📞 {p.phone} — Call now!
                                                    </a>
                                                )}
                                                <div className="text-xs text-gray-500 mt-0.5">
                                                    Pledged: {new Date(p.pledge_date).toLocaleDateString()}
                                                    {p.note && <span className="ml-1 italic text-gray-400">· "{p.note}"</span>}
                                                </div>
                                            </div>
                                            <div className="text-right flex-shrink-0">
                                                <div className="font-black text-red-600 text-sm">Ksh {(p.pledge_amount || 0).toLocaleString()}</div>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => markPaid(p.pledge_id)}
                                            disabled={marking === p.pledge_id}
                                            className="mt-2 w-full py-1.5 rounded-lg text-xs font-bold transition-all"
                                            style={{ background: marking === p.pledge_id ? '#E5E7EB' : 'linear-gradient(135deg,#10B981,#059669)', color: marking === p.pledge_id ? '#9CA3AF' : '#fff' }}
                                        >
                                            {marking === p.pledge_id ? 'Marking...' : '✅ Mark as Paid / Dismiss'}
                                        </button>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Footer */}
                    <div className="px-4 py-2.5 border-t border-red-100 flex items-center justify-between">
                        <button onClick={loadPledges} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 transition-colors">
                            <RefreshCw size={10} /> Refresh
                        </button>
                        <a href="/dashboard/reports/customer-at-glance" className="text-xs text-indigo-500 hover:text-indigo-700 font-semibold transition-colors">
                            View all →
                        </a>
                    </div>
                </div>
            )}
        </div>
    );
}


function canSee(roles: string, userType: string) {
    if (roles === 'all') return true;
    const t = (userType || '').toLowerCase().replace(/\s/g, '');
    const isSA = t === 'superadmin' || t === 'superuser';
    const isAdmin = isSA || t === 'admin' || t === 'manager';
    if (roles === 'superadmin') return isSA;
    if (roles === 'admin') return isAdmin;
    return false;
}

function OutletSwitcher() {
    const { activeOutlet, outlets, switchOutlet } = useOutlet();

    // Read user role from localStorage
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);
    useEffect(() => {
        try {
            const raw = localStorage.getItem('user');
            if (raw) {
                const u = JSON.parse(raw);
                const t = (u.userType || '').toLowerCase().replace(/\s/g, '');
                setIsSuperAdmin(t === 'superadmin' || t === 'superuser');
            }
        } catch {}
    }, []);

    if (!activeOutlet) return null;

    // SuperAdmin: full dropdown to switch between all outlets
    if (isSuperAdmin && outlets.length > 1) {
        return (
            <select
                value={activeOutlet.outlet_id}
                onChange={e => switchOutlet(Number(e.target.value))}
                className="px-3 py-1.5 bg-indigo-50 border border-indigo-200 rounded-xl text-xs font-bold text-indigo-700 outline-none cursor-pointer"
            >
                {outlets.map(o => (
                    <option key={o.outlet_id} value={o.outlet_id}>
                        {o.is_main ? '⭐ ' : '📍 '}{o.outlet_name}
                    </option>
                ))}
            </select>
        );
    }

    // Everyone else: just a read-only badge — no switching allowed
    return (
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl">
            <span className="text-xs">📍</span>
            <span className="text-xs font-bold text-gray-700">{activeOutlet.outlet_name}</span>
        </div>
    );
}

function CompanyBrand() {
    return (
        <div className="min-w-0">
            <p className="text-[13px] font-black text-white truncate leading-tight tracking-wide">Alpha Retail System</p>
            <p className="text-[10px] text-emerald-300 font-bold truncate">Build Better. Live Better.</p>
        </div>
    );
}

function HeaderOutletBadge() {
    const { activeOutlet, outlets, switchOutlet } = useOutlet();
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);
    useEffect(() => {
        try {
            const raw = localStorage.getItem('user');
            if (raw) {
                const u = JSON.parse(raw);
                const t = (u.userType || '').toLowerCase().replace(/\s/g, '');
                setIsSuperAdmin(t === 'superadmin' || t === 'superuser');
            }
        } catch {}
    }, []);

    if (!activeOutlet) return null;

    if (isSuperAdmin && outlets.length > 1) {
        return (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-[#01341a] border border-emerald-500/40 rounded-xl text-white shadow-xs">
                <Store size={15} className="text-emerald-400 shrink-0" />
                <select
                    value={activeOutlet.outlet_id}
                    onChange={e => switchOutlet(Number(e.target.value))}
                    className="bg-transparent text-white text-[11px] font-bold outline-none cursor-pointer"
                >
                    {outlets.map(o => (
                        <option key={o.outlet_id} value={o.outlet_id} className="bg-slate-900 text-white">
                            {o.outlet_name} ({o.outlet_code || 'Outlet'})
                        </option>
                    ))}
                </select>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-[#01341a] border border-emerald-500/40 rounded-xl text-white shadow-xs">
            <Store size={15} className="text-emerald-400 shrink-0" />
            <div className="text-left leading-none">
                <p className="text-[11px] font-black text-white truncate max-w-[120px]">{activeOutlet.outlet_name}</p>
                <p className="text-[9px] font-bold text-emerald-300/80 mt-0.5">{activeOutlet.outlet_code || 'Head Office'}</p>
            </div>
        </div>
    );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const router   = useRouter();
    const pathname = usePathname();
    const [user, setUser]             = useState<{ userId: string; name: string; userType: string } | null>(null);
    const [collapsed, setCollapsed]   = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [expanded, setExpanded]     = useState<Record<string, boolean>>({});
    const [loading, setLoading]       = useState(false);
    // ── Subscription Lockout state ────────────────────────────────────────
    const [systemLocked, setSystemLocked]           = useState(false);
    const [lockoutReason, setLockoutReason]         = useState('');
    const [lockoutChecked, setLockoutChecked]       = useState(false);
    const [isSuperAdminUser, setIsSuperAdminUser]   = useState(false);
    const [superAdminBypass, setSuperAdminBypass]   = useState(false);
    const prevPath = useRef(pathname);


    useEffect(() => {
        const raw = localStorage.getItem('user');
        if (!raw) { router.push('/'); return; }
        setUser(JSON.parse(raw));
    }, [router]);

    // ── Subscription Lockout & Session Termination Check ─────────────────
    // Runs whenever the user or active outlet changes, plus polling every 10s.
    useEffect(() => {
        const checkLockout = async () => {
            setLockoutChecked(false);
            try {
                const raw = localStorage.getItem('user') || '{}';
                const u   = JSON.parse(raw);
                if (!u || !u.userId) { setLockoutChecked(true); return; }

                const t   = (u.userType || u.user_type || '').toLowerCase().replace(/\s/g, '');
                const isSA = t === 'superadmin' || t === 'superuser';
                setIsSuperAdminUser(isSA);

                // 1. Verify if user is still active in database
                const { data: dbUser } = await supabase
                    .from('retail_users')
                    .select('active')
                    .eq('user_id', u.userId)
                    .maybeSingle();

                if (dbUser && dbUser.active === false) {
                    // Forcefully cut off session immediately
                    localStorage.removeItem('user');
                    localStorage.removeItem('activeOutletId');
                    localStorage.removeItem('alpharetail_last_activity');
                    router.replace('/');
                    return;
                }

                // Read activeOutletId directly from localStorage or from user object
                const rawOutletId = localStorage.getItem('activeOutletId');
                const outletId = rawOutletId ? Number(rawOutletId) : (u.outletId || u.outlet_id || null);

                if (!outletId) { setLockoutChecked(true); return; }

                // 2. Check outlet active status
                const { data: outletDb } = await supabase
                    .from('retail_outlets')
                    .select('active')
                    .eq('outlet_id', outletId)
                    .maybeSingle();

                if (outletDb && outletDb.active === false && !isSA) {
                    setSystemLocked(true);
                    setLockoutReason('Subscription Expired. Access to this branch has been deactivated pending subscription renewal.');
                    setLockoutChecked(true);
                    return;
                }

                // 3. Check organisation_settings lockout status
                const { data } = await supabase
                    .from('organisation_settings')
                    .select('setting_key, setting_value')
                    .in('setting_key', [
                        `system_lockout_outlet_${outletId}`,
                        `system_lockout_reason_${outletId}`,
                    ]);

                const sm: Record<string, string> = {};
                (data || []).forEach((r: any) => { sm[r.setting_key] = r.setting_value || ''; });

                const locked = sm[`system_lockout_outlet_${outletId}`] === 'true';
                const reason = sm[`system_lockout_reason_${outletId}`] || 'Your subscription has ended. Please contact support to restore access.';
                setSystemLocked(locked);
                setLockoutReason(reason);
            } catch { /* silent fail */ }
            setLockoutChecked(true);
        };
        checkLockout();
        // Re-check every 10 seconds for real-time cutoff
        const interval = setInterval(checkLockout, 10000);
        window.addEventListener('focus', checkLockout);
        return () => {
            clearInterval(interval);
            window.removeEventListener('focus', checkLockout);
        };
    }, [router]);

    // ── Global Silent Session Auto-Logout after 5 Minutes Inactivity ──
    // Completely silent: NO modal, NO countdown popup.
    // Syncs across all tabs using localStorage.
    useEffect(() => {
        const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
        const STORAGE_KEY = 'alpharetail_last_activity';

        const now = Date.now();
        if (!localStorage.getItem(STORAGE_KEY)) {
            localStorage.setItem(STORAGE_KEY, String(now));
        }

        const performSilentLogout = async () => {
            try {
                const stored = localStorage.getItem('user');
                const u = stored ? JSON.parse(stored) : null;
                if (u?.name) {
                    await logActivity('Auto Logout', `${u.name} automatically logged out after 5 mins of inactivity`);
                }
            } catch { /* silent */ }
            localStorage.removeItem('user');
            localStorage.removeItem(STORAGE_KEY);
            router.replace('/');
        };

        const updateActivity = () => {
            const current = Date.now();
            const last = Number(localStorage.getItem(STORAGE_KEY) || 0);
            if (current - last > 2000) {
                localStorage.setItem(STORAGE_KEY, String(current));
            }
        };

        const checkTimeout = () => {
            const last = Number(localStorage.getItem(STORAGE_KEY) || 0);
            if (last > 0 && Date.now() - last >= IDLE_TIMEOUT_MS) {
                performSilentLogout();
            }
        };

        const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click', 'wheel'];
        events.forEach(e => window.addEventListener(e, updateActivity, { passive: true }));

        const intervalId = setInterval(checkTimeout, 5000);

        const onVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                checkTimeout();
            }
        };
        document.addEventListener('visibilitychange', onVisibilityChange);

        const onStorageChange = (e: StorageEvent) => {
            if (e.key === 'user' && !e.newValue) {
                router.replace('/');
            }
        };
        window.addEventListener('storage', onStorageChange);

        return () => {
            clearInterval(intervalId);
            events.forEach(e => window.removeEventListener(e, updateActivity));
            document.removeEventListener('visibilitychange', onVisibilityChange);
            window.removeEventListener('storage', onStorageChange);
        };
    }, [router]);

    useEffect(() => {
        const ns: Record<string, boolean> = { ...expanded };
        let changed = false;
        menuGroups.forEach(g => {
            const active = g.items.some(i => i.href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(i.href));
            if (active && !expanded[g.name]) { ns[g.name] = true; changed = true; }
        });
        if (changed) setExpanded(ns);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pathname]);

    useEffect(() => {
        if (prevPath.current !== pathname) {
            setLoading(true); prevPath.current = pathname;
            const t = setTimeout(() => setLoading(false), 600);
            return () => clearTimeout(t);
        }
    }, [pathname]);

    const toggle = (name: string) => {
        if (collapsed) { setCollapsed(false); setExpanded({ [name]: true }); }
        else setExpanded(p => ({ ...p, [name]: !p[name] }));
    };

    const isActive = (href: string) => href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href);

    const handleLogout = async () => {
        await logActivity('Logout', `${user?.name || 'Unknown'} logged out`);
        localStorage.removeItem('user');
        localStorage.removeItem('alpharetail_last_activity');
        router.push('/');
    };


    if (!user) return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="text-center">
                <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-gray-400 text-sm font-medium">Loading...</p>
            </div>
        </div>
    );

    // ── SUBSCRIPTION LOCKOUT SCREEN ───────────────────────────────────────
    // Shows for ALL users when their outlet is locked.
    // Super Admin can always access /dashboard/admin/system-lockout or bypass for preview.
    const shouldShowLockout = lockoutChecked && systemLocked && (
        !isSuperAdminUser || (!superAdminBypass && pathname !== '/dashboard/admin/system-lockout')
    );

    if (shouldShowLockout) return (
        <div className="min-h-screen flex items-center justify-center p-4"
            style={{ background: 'linear-gradient(135deg,#0f0c29 0%,#1a0533 40%,#0d1b2a 100%)' }}>
            <style>{`
                @keyframes lockPulse { 0%,100%{transform:scale(1);box-shadow:0 0 0 0 rgba(239,68,68,.7)} 50%{transform:scale(1.05);box-shadow:0 0 0 30px rgba(239,68,68,0)} }
                @keyframes floatUp { 0%{opacity:0;transform:translateY(30px)} 100%{opacity:1;transform:translateY(0)} }
                @keyframes shimmer { 0%{background-position:-200% center} 100%{background-position:200% center} }
                @keyframes glowPulse { 0%,100%{opacity:.4} 50%{opacity:1} }
                .lock-icon { animation: lockPulse 2.5s ease-in-out infinite; }
                .fade-up-1 { animation: floatUp .6s ease-out .1s both; }
                .fade-up-2 { animation: floatUp .6s ease-out .25s both; }
                .fade-up-3 { animation: floatUp .6s ease-out .4s both; }
                .fade-up-4 { animation: floatUp .6s ease-out .55s both; }
                .fade-up-5 { animation: floatUp .6s ease-out .7s both; }
                .shimmer-text { background: linear-gradient(90deg,#f43f5e,#fb923c,#fbbf24,#f43f5e); background-size:200% auto; -webkit-background-clip:text; -webkit-text-fill-color:transparent; animation:shimmer 3s linear infinite; }
                .glow-ring { animation: glowPulse 2s ease-in-out infinite; }
            `}</style>

            {/* Background grid pattern */}
            <div className="absolute inset-0 opacity-5" style={{
                backgroundImage: 'linear-gradient(rgba(255,255,255,.1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.1) 1px,transparent 1px)',
                backgroundSize: '40px 40px'
            }} />

            {/* Glow orbs */}
            <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-10 glow-ring" style={{ background: 'radial-gradient(circle,#ef4444,transparent)' }} />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full opacity-10 glow-ring" style={{ background: 'radial-gradient(circle,#7c3aed,transparent)', animationDelay: '1s' }} />

            <div className="relative z-10 text-center max-w-lg w-full">
                {/* Super Admin Notice (Only for Super Admin) */}
                {isSuperAdminUser && (
                    <div className="fade-up-1 mb-6 p-4 rounded-2xl bg-amber-500/20 border-2 border-amber-400 text-amber-200 text-left backdrop-blur-md">
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                            <span className="text-xs font-black uppercase tracking-wider text-amber-300">
                                👑 Super Admin Security Alert
                            </span>
                            <span className="text-[10px] bg-red-500/40 text-red-100 border border-red-400 px-2 py-0.5 rounded font-mono font-bold">
                                OUTLET LOCKED
                            </span>
                        </div>
                        <p className="text-xs text-amber-100/90 mb-3">
                            This outlet is <strong>currently locked</strong>. All cashiers and staff attempting to use the POS or dashboard see this screen and are completely blocked.
                        </p>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => router.push('/dashboard/admin/system-lockout')}
                                className="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold text-xs transition-all shadow-md"
                            >
                                ⚙️ Manage Lockout Settings
                            </button>
                            <button
                                onClick={() => setSuperAdminBypass(true)}
                                className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold border border-white/20 transition-all"
                            >
                                Preview Dashboard as Super Admin →
                            </button>
                        </div>
                    </div>
                )}

                {/* Lock icon */}
                <div className="fade-up-1 mb-8 flex justify-center">
                    <div className="lock-icon w-28 h-28 rounded-3xl flex items-center justify-center text-6xl"
                        style={{ background: 'linear-gradient(135deg,#7f1d1d,#991b1b)', border: '3px solid rgba(239,68,68,.5)' }}>
                        🔒
                    </div>
                </div>

                {/* Main card */}
                <div className="fade-up-2 rounded-3xl overflow-hidden shadow-2xl"
                    style={{ background: 'rgba(255,255,255,.05)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,.1)' }}>

                    {/* Top red bar */}
                    <div className="h-1.5 w-full" style={{ background: 'linear-gradient(90deg,#dc2626,#f43f5e,#fb923c,#f43f5e,#dc2626)', backgroundSize: '200% auto', animation: 'shimmer 3s linear infinite' }} />

                    <div className="px-8 py-10">
                        {/* Badge */}
                        <div className="fade-up-2 inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6"
                            style={{ background: 'rgba(239,68,68,.2)', border: '1px solid rgba(239,68,68,.4)' }}>
                            <div className="w-2 h-2 rounded-full bg-red-500" style={{ animation: 'lockPulse 1.5s ease-in-out infinite' }} />
                            <span className="text-xs font-black text-red-400 tracking-widest uppercase">Subscription Suspended</span>
                        </div>

                        {/* Headline */}
                        <h1 className="fade-up-3 text-4xl font-black text-white mb-3 leading-tight">
                            Cloud Access<br />
                            <span className="shimmer-text">Has Ended</span>
                        </h1>

                        {/* Divider */}
                        <div className="fade-up-3 w-16 h-1 rounded-full mx-auto mb-6" style={{ background: 'linear-gradient(90deg,#f43f5e,#fb923c)' }} />

                        {/* Message */}
                        <p className="fade-up-4 text-white/60 text-sm leading-relaxed mb-8 px-4">
                            {lockoutReason || 'Your subscription payment is overdue. Your data is safe — renew your plan to restore full access immediately.'}
                        </p>

                        {/* Feature bullets */}
                        <div className="fade-up-4 grid grid-cols-2 gap-3 mb-8 text-left">
                            {[
                                { icon: '💾', text: 'Your data is safe' },
                                { icon: '⚡', text: 'Instant restoration' },
                                { icon: '🔐', text: 'Secured & encrypted' },
                                { icon: '📞', text: 'Support available' },
                            ].map(f => (
                                <div key={f.text} className="flex items-center gap-2 px-3 py-2 rounded-xl"
                                    style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)' }}>
                                    <span className="text-lg">{f.icon}</span>
                                    <span className="text-xs text-white/60 font-semibold">{f.text}</span>
                                </div>
                            ))}
                        </div>

                        {/* CTA */}
                        <div className="fade-up-5 space-y-3">
                            <div className="px-6 py-4 rounded-2xl text-center"
                                style={{ background: 'linear-gradient(135deg,rgba(239,68,68,.15),rgba(251,146,60,.15))', border: '1px solid rgba(239,68,68,.3)' }}>
                                <p className="text-white/40 text-xs mb-1 uppercase tracking-widest font-bold">To restore access, contact</p>
                                <p className="text-white font-black text-lg">Alpha Retail Support</p>
                                <p className="text-orange-300/70 text-sm mt-1">Pay your subscription to get back online instantly</p>
                            </div>

                            {/* Logout button */}
                            <button
                                onClick={() => { localStorage.removeItem('user'); window.location.href = '/'; }}
                                className="w-full py-3 rounded-2xl text-white/50 text-sm font-semibold border transition-all hover:border-white/30 hover:text-white/80"
                                style={{ borderColor: 'rgba(255,255,255,.1)', background: 'rgba(255,255,255,.03)' }}>
                                Sign out ↗
                            </button>
                        </div>
                    </div>

                    {/* Bottom bar */}
                    <div className="px-8 py-4 flex items-center justify-between" style={{ background: 'rgba(0,0,0,.3)', borderTop: '1px solid rgba(255,255,255,.06)' }}>
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-lg flex items-center justify-center text-xs" style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>α</div>
                            <span className="text-white/30 text-xs font-bold">Alpha Retail Cloud</span>
                        </div>
                        <span className="text-white/20 text-[10px]">Your account is on hold</span>
                    </div>
                </div>

                <p className="fade-up-5 text-white/20 text-xs mt-6">
                    If you believe this is a mistake, please contact your system administrator.
                </p>
            </div>
        </div>
    );

    const isCashier = ['cashier', 'waiter'].includes((user.userType || '').toLowerCase());
    const filtered  = menuGroups.map(g => ({ ...g, items: g.items.filter(i => canSee(i.roles ?? 'all', user.userType)) })).filter(g => g.items.length > 0);

    // ── Cashier access restriction ────────────────────────────────────────────
    // Cashiers can only access POS + Purchase Entry + Credit Customers + Credit Payments + Products (Add Product) + Returns + Summary
    const cashierAllowedPages = [
        '/dashboard/pos',
        '/dashboard/purchase',
        '/dashboard/credit-customers',
        '/dashboard/credit-payments',
        '/dashboard/products',
        '/dashboard/sales-return',
        '/dashboard/sales-summary',
        '/dashboard/reports/full-sales-report',
        '/dashboard/suppliers',
    ];
    if (isCashier && !cashierAllowedPages.some(p => pathname.startsWith(p))) {
        router.replace('/dashboard/pos');
        return null;
    }

    return (
        <SettingsProvider>
            <OutletProvider>
                <FeatureProvider>
                <div className="min-h-screen bg-[#f4f6f9] flex font-sans">

                    {/* Top loading bar */}
                    {loading && (
                        <div style={{ position:'fixed', top:0, left:0, right:0, height:3, zIndex:9999,
                            background:'linear-gradient(90deg,#4f46e5,#7c3aed,#059669)',
                            animation:'loadbar 0.6s ease-out forwards' }} />
                    )}
                    <style>{`
                        @keyframes loadbar { from{transform:translateX(-100%)} to{transform:translateX(0)} }
                        .sb-scroll{scrollbar-width:thin;scrollbar-color:#e2e8f0 transparent}
                        .sb-scroll::-webkit-scrollbar{width:4px}
                        .sb-scroll::-webkit-scrollbar-thumb{background:#e2e8f0;border-radius:4px}
                    `}</style>

                    {mobileOpen && (
                        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
                            onClick={() => setMobileOpen(false)} />
                    )}

                    {/* ═══════════ SIDEBAR (Emerald Forest Hardware Theme matching Mockup) ═══════════ */}
                    {!isCashier && (
                        <aside className={`fixed top-0 left-0 h-full z-50 shadow-2xl flex flex-col transition-all duration-300 ease-in-out border-r border-emerald-900/60 text-white
                            ${collapsed ? 'w-[72px]' : 'w-[265px]'}
                            ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
                            style={{
                                background: 'linear-gradient(180deg, #011d0e 0%, #022a15 45%, #01160a 100%)',
                            }}>

                            {/* Logo matching mockup */}
                            <div className={`flex items-center h-[65px] border-b border-emerald-500/20 px-3.5 gap-2.5 shrink-0 ${collapsed ? 'justify-center !px-2' : ''}`}>
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-transparent">
                                    <svg className="w-9 h-9" viewBox="0 0 100 80" fill="none">
                                        <path d="M10 45 L50 15 L70 30" stroke="#ffffff" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
                                        <polygon points="50,22 68,35 60,45 42,32" fill="#facc15" />
                                        <polygon points="56,28 74,41 68,49 50,36" fill="#eab308" />
                                        <path d="M68 18 L80 8 L86 14 L74 24 Z" fill="#ffffff" />
                                        <rect x="74" y="19" width="5" height="18" transform="rotate(45 74 19)" fill="#ffffff" rx="2" />
                                        <rect x="44" y="40" width="5" height="5" fill="#facc15" />
                                        <rect x="51" y="40" width="5" height="5" fill="#facc15" />
                                        <rect x="44" y="47" width="5" height="5" fill="#facc15" />
                                        <rect x="51" y="47" width="5" height="5" fill="#facc15" />
                                    </svg>
                                </div>
                                {!collapsed && <CompanyBrand />}
                                {!collapsed && (
                                    <button onClick={() => setCollapsed(true)}
                                        className="hidden lg:flex w-6 h-6 items-center justify-center rounded-lg border border-emerald-500/20 text-emerald-200 hover:text-white hover:border-emerald-400 transition-colors ml-auto shrink-0 bg-white/5">
                                        <ChevronLeft size={12} />
                                    </button>
                                )}
                                {collapsed && (
                                    <button onClick={() => setCollapsed(false)}
                                        className="hidden lg:flex w-6 h-6 items-center justify-center rounded-lg border border-emerald-500/20 text-emerald-200 hover:text-white hover:border-emerald-400 transition-colors bg-white/5">
                                        <ChevronRight size={12} />
                                    </button>
                                )}
                                <button onClick={() => setMobileOpen(false)} className="lg:hidden ml-auto text-emerald-200 hover:text-white">
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Nav */}
                            <nav className="flex-1 overflow-y-auto sb-scroll py-3 px-2.5 space-y-1">
                                {filtered.map(group => {
                                    const isExp   = expanded[group.name];
                                    const GIcon   = group.icon as React.ElementType | undefined;
                                    const gActive = group.items.some(i => isActive(i.href));

                                    if (!group.collapsible) {
                                        return group.items.map(item => {
                                            const IIcon = item.icon as React.ElementType;
                                            const active = isActive(item.href);
                                            return (
                                                <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)}
                                                    title={collapsed ? item.label : undefined}
                                                    className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-full text-[13px] font-bold transition-all mb-1.5
                                                        ${active
                                                            ? 'bg-gradient-to-r from-emerald-500 via-emerald-500 to-green-500 text-white shadow-lg shadow-emerald-500/40 ring-1 ring-emerald-300/40 font-black'
                                                            : 'text-emerald-100/85 hover:text-white hover:bg-white/10'}
                                                        ${collapsed ? 'justify-center !px-2.5' : ''}`}>
                                                    <IIcon size={17} className={active ? 'text-white' : 'text-emerald-300'} />
                                                    {!collapsed && <span className="flex-1 tracking-tight">{item.label}</span>}
                                                    {!collapsed && item.badge && (
                                                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${active ? 'bg-slate-950 text-emerald-300' : 'bg-emerald-400 text-slate-950 shadow-sm'}`}>
                                                            {item.badge}
                                                        </span>
                                                    )}
                                                    {active && !collapsed && <div className="w-2 h-2 rounded-full bg-white shrink-0 shadow-sm" />}
                                                </Link>
                                            );
                                        });
                                    }

                                    return (
                                        <div key={group.name} className="mb-0.5">
                                            <button onClick={() => toggle(group.name)}
                                                title={collapsed ? group.label : undefined}
                                                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[12.5px] font-bold transition-all
                                                    ${gActive ? 'text-emerald-300 bg-white/10 shadow-sm' : 'text-emerald-100/80 hover:bg-white/10 hover:text-white'}
                                                    ${collapsed ? 'justify-center' : ''}`}>
                                                {GIcon && <GIcon size={16} className={gActive ? 'text-emerald-400' : 'text-emerald-300'} />}
                                                {!collapsed && (
                                                    <>
                                                        <span className="flex-1 text-left">{group.label}</span>
                                                        <ChevronDown size={13} className={`text-emerald-300 transition-transform duration-200 ${isExp ? 'rotate-180 text-emerald-400' : ''}`} />
                                                    </>
                                                )}
                                            </button>

                                            <div className={`overflow-hidden transition-all duration-200 ease-in-out ${isExp && !collapsed ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                                                <div className="ml-[18px] pl-3 mt-1 pb-1 space-y-1 border-l-2 border-emerald-500/40">
                                                    {group.items.map(item => {
                                                        const IIcon  = item.icon as React.ElementType;
                                                        const active = isActive(item.href);
                                                        return (
                                                            <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)}
                                                                className={`flex items-center gap-2 px-2.5 py-[7px] rounded-lg text-[12px] transition-all
                                                                    ${active ? 'text-white bg-gradient-to-r from-emerald-500 to-green-500 font-extrabold shadow-sm' : 'text-emerald-100/80 hover:text-white hover:bg-white/10'}`}>
                                                                <IIcon size={13} className={active ? 'text-white' : 'text-emerald-300/80'} />
                                                                <span className="flex-1">{item.label}</span>
                                                                {item.badge && <span className="text-[8px] font-black px-1 py-0.5 rounded-full bg-emerald-400 text-slate-950">{item.badge}</span>}
                                                                {active && <div className="w-1.5 h-1.5 rounded-full bg-white shrink-0" />}
                                                            </Link>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </nav>

                            {/* Secure & Compliant Badge matching mockup */}
                            {!collapsed && (
                                <div className="mx-2.5 my-2 p-2 rounded-xl bg-amber-400/10 border border-amber-400/30 flex items-center gap-2">
                                    <Shield size={16} className="text-amber-400 shrink-0" />
                                    <div>
                                        <p className="text-[10px] font-black text-amber-300 leading-tight">Secure & Compliant</p>
                                        <p className="text-[8.5px] text-amber-200/70 leading-tight">Your Data, Our Priority.</p>
                                    </div>
                                </div>
                            )}

                            {/* User footer matching mockup */}
                            <div className={`border-t border-emerald-500/20 shrink-0 ${collapsed ? 'p-2' : 'p-2.5'}`}>
                                {!collapsed ? (
                                    <div className="flex items-center gap-2 p-2 rounded-2xl bg-[#012814]/90 border border-emerald-500/30 backdrop-blur-md shadow-lg">
                                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-slate-950 text-xs font-black shrink-0 bg-gradient-to-tr from-amber-400 to-yellow-300 ring-2 ring-amber-300/60 shadow">
                                            {user.name?.charAt(0)?.toUpperCase() || 'U'}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[12px] font-black text-white truncate leading-tight">{user.name}</p>
                                            <p className="text-[10px] text-emerald-300 font-bold capitalize truncate">{user.userType || 'Administrator'}</p>
                                        </div>
                                        <div className="h-4 w-px bg-emerald-500/20 mx-0.5" />
                                        <button onClick={() => router.push('/dashboard/company')} title="Settings"
                                            className="p-1.5 text-emerald-200 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                                            <Settings size={14} />
                                        </button>
                                        <button onClick={handleLogout} title="Logout"
                                            className="p-1.5 text-rose-300 hover:text-white hover:bg-rose-500/30 rounded-lg transition-colors">
                                            <LogOut size={14} />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-slate-950 text-xs font-black bg-gradient-to-tr from-amber-400 to-yellow-300 ring-2 ring-amber-300/60 shadow">
                                            {user.name?.charAt(0)?.toUpperCase() || 'U'}
                                        </div>
                                        <button onClick={handleLogout} title="Logout"
                                            className="p-1.5 text-rose-300 hover:text-white hover:bg-rose-500/30 rounded-lg transition-colors">
                                            <LogOut size={14} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </aside>
                    )}

                    {/* ═══════════ MAIN ═══════════ */}
                    <main className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ${isCashier ? '' : collapsed ? 'lg:ml-[72px]' : 'lg:ml-[265px]'}`}>
                        {/* Header matching Mockup */}
                        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/90 h-[64px] flex items-center px-4 lg:px-6 gap-3 shadow-xs">
                            {!isCashier && (
                                <button onClick={() => setMobileOpen(true)} className="lg:hidden w-8 h-8 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shadow-xs">
                                    <Menu size={18} />
                                </button>
                            )}
                            <div className="hidden sm:flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-full px-4 py-1.5 w-64 lg:w-80 shadow-inner focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500 transition-all">
                                <Search className="text-slate-400 shrink-0" size={14} />
                                <input type="text" placeholder="Search products, reports, customers..." className="bg-transparent text-[12px] text-slate-700 outline-none w-full placeholder:text-slate-400" />
                                <span className="text-[9px] font-bold text-slate-400 bg-slate-200/70 px-1.5 py-0.5 rounded border border-slate-300 shrink-0">Ctrl + K</span>
                            </div>
                            <div className="flex items-center gap-2.5 ml-auto">
                                <HeaderOutletBadge />
                                <PledgeNotificationBell />
                                <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 shadow-xs">
                                    <Calendar size={13} className="text-slate-400 shrink-0" />
                                    <span>Mon, 03 Nov 2025 | 09:24:17 AM</span>
                                </div>
                                <div className="flex items-center gap-1.5 px-3 py-1 bg-white border border-emerald-500/30 rounded-full text-xs font-bold text-emerald-700 shadow-xs">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                    <span>Online</span>
                                </div>
                                <button onClick={() => router.push('/dashboard/company')} className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 transition-colors">
                                    <Settings size={16} />
                                </button>
                                <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
                                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-slate-950 text-xs font-black shadow-xs bg-gradient-to-tr from-emerald-400 to-green-300 ring-1 ring-emerald-300">
                                        {user.name?.charAt(0)?.toUpperCase() || 'U'}
                                    </div>
                                </div>
                            </div>
                        </header>

                        <div className="flex-1 p-4 lg:p-6 overflow-x-hidden">{children}</div>
                    </main>
                </div>
                </FeatureProvider>
            </OutletProvider>
        </SettingsProvider>
    );
}
