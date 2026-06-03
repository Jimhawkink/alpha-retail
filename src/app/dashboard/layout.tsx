'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
    FiHome, FiShoppingCart, FiPackage, FiTag, FiFileText, FiRefreshCw,
    FiTruck, FiUsers, FiBox, FiActivity, FiRepeat, FiAlertCircle,
    FiDollarSign, FiClock, FiTrendingDown, FiCreditCard, FiSmartphone,
    FiTrendingUp, FiBarChart2, FiPieChart, FiSettings, FiMapPin, FiShield,
    FiZap, FiBriefcase, FiChevronDown, FiChevronLeft, FiChevronRight,
    FiLogOut, FiSearch, FiBell, FiMenu, FiX, FiDatabase, FiSliders,
    FiDownload, FiLayers
} from 'react-icons/fi';
import { SettingsProvider, useCompanyName } from '@/context/SettingsContext';
import { OutletProvider, useOutlet } from '@/context/OutletContext';
import { logActivity } from '@/lib/supabase';

// ── Menu groups ───────────────────────────────────────────────────────
const menuGroups = [
    { label: '', collapsible: false, name: 'main', items: [
        { href: '/dashboard',     label: 'Dashboard',  icon: FiHome,         roles: 'all' },
        { href: '/dashboard/pos', label: 'Retail POS', icon: FiShoppingCart, roles: 'all', badge: 'LIVE' },
    ]},
    { label: 'Sales & Products', icon: FiShoppingCart, name: 'sales', collapsible: true, items: [
        { href: '/dashboard/products',     label: 'Products',       icon: FiPackage,  roles: 'all' },
        { href: '/dashboard/categories',   label: 'Categories',     icon: FiTag,      roles: 'all' },
        { href: '/dashboard/sales',        label: 'Sales Records',  icon: FiFileText, roles: 'all' },
        { href: '/dashboard/sales-return', label: 'Sales Return',   icon: FiRefreshCw,roles: 'all' },
    ]},
    { label: 'Purchases', icon: FiTruck, name: 'purchases', collapsible: true, items: [
        { href: '/dashboard/suppliers',       label: 'Suppliers',        icon: FiUsers,    roles: 'all' },
        { href: '/dashboard/purchase',        label: 'Purchase Entry',   icon: FiDownload, roles: 'all' },
        { href: '/dashboard/purchases',       label: 'Purchase Records', icon: FiFileText, roles: 'all' },
        { href: '/dashboard/purchase-return', label: 'Purchase Return',  icon: FiRefreshCw,roles: 'all' },
    ]},
    { label: 'Inventory', icon: FiBox, name: 'inventory', collapsible: true, items: [
        { href: '/dashboard/stock-movement',  label: 'Stock Movement',  icon: FiActivity,    roles: 'all' },
        { href: '/dashboard/stock-transfer',  label: 'Stock Transfer',  icon: FiRepeat,      roles: 'all' },
        { href: '/dashboard/low-stock',       label: 'Low Stock',       icon: FiAlertCircle, roles: 'all' },
        { href: '/dashboard/expiry-register', label: 'Expiry Register', icon: FiClock,       roles: 'all' },
    ]},
    { label: 'Finance', icon: FiDollarSign, name: 'finance', collapsible: true, items: [
        { href: '/dashboard/expenses',         label: 'Expenses',         icon: FiTrendingDown, roles: 'all' },
        { href: '/dashboard/credit-customers', label: 'Credit Customers', icon: FiUsers,        roles: 'all' },
        { href: '/dashboard/credit-payments',  label: 'Credit Payments',  icon: FiCreditCard,   roles: 'all' },
        { href: '/dashboard/mpesa',            label: 'M-Pesa',           icon: FiSmartphone,   roles: 'all' },
    ]},
    { label: 'HR & Payroll', icon: FiUsers, name: 'hr', collapsible: true, items: [
        { href: '/dashboard/payroll',       label: 'Payroll',       icon: FiDollarSign, roles: 'all' },
        { href: '/dashboard/advances',      label: 'Advances',      icon: FiTrendingUp, roles: 'all' },
        { href: '/dashboard/shifts',        label: 'Shifts',        icon: FiClock,      roles: 'all' },
        { href: '/dashboard/shift-reports', label: 'Shift Reports', icon: FiFileText,   roles: 'all' },
    ]},
    { label: 'Reports', icon: FiBarChart2, name: 'reports', collapsible: true, items: [
        { href: '/dashboard/sales-summary',         label: 'Sales Summary',  icon: FiTrendingUp,  roles: 'all' },
        { href: '/dashboard/reports/sales',         label: 'Sales Report',   icon: FiFileText,    roles: 'all' },
        { href: '/dashboard/reports/profit',        label: 'Profit Report',  icon: FiPieChart,    roles: 'all' },
        { href: '/dashboard/reports/stock',         label: 'Stock Report',   icon: FiBox,         roles: 'all' },
        { href: '/dashboard/reports/profit-loss',   label: 'P&L Report',     icon: FiTrendingDown,roles: 'all' },
        { href: '/dashboard/reports/trial-balance', label: 'Trial Balance',  icon: FiDatabase,    roles: 'all' },
        { href: '/dashboard/reports/balance-sheet', label: 'Balance Sheet',  icon: FiFileText,    roles: 'all' },
        { href: '/dashboard/reports/cash-book',     label: 'Cash Book',      icon: FiDollarSign,  roles: 'all' },
        { href: '/dashboard/reports/mpesa',         label: 'M-Pesa Report',  icon: FiSmartphone,  roles: 'all' },
    ]},
    { label: 'Administration', icon: FiSettings, name: 'admin', collapsible: true, items: [
        { href: '/dashboard/outlets',        label: 'Outlets',      icon: FiMapPin,    roles: 'superadmin' },
        { href: '/dashboard/users',          label: 'Users',        icon: FiUsers,     roles: 'all' },
        { href: '/dashboard/user-roles',     label: 'User Roles',   icon: FiShield,    roles: 'all' },
        { href: '/dashboard/activity-log',   label: 'Activity Log', icon: FiActivity,  roles: 'admin' },
        { href: '/dashboard/company',        label: 'Company',      icon: FiHome,      roles: 'all' },
        { href: '/dashboard/tax-settings',   label: 'Tax Settings', icon: FiFileText,  roles: 'all' },
        { href: '/dashboard/units',          label: 'Units',        icon: FiSliders,   roles: 'all' },
        { href: '/dashboard/mpesa-settings', label: 'M-Pesa Config',icon: FiZap,       roles: 'superadmin', badge: 'SA' },
        { href: '/dashboard/businesses',     label: 'Businesses',   icon: FiBriefcase, roles: 'superadmin', badge: 'SA' },
    ]},
];

function canSee(roles: string, userType: string) {
    if (roles === 'all') return true;
    const t = (userType || '').toLowerCase().replace(/\s/g, '');
    const isSuperAdmin = t === 'superadmin' || t === 'superuser';
    const isAdmin = isSuperAdmin || t === 'admin' || t === 'manager';
    if (roles === 'superadmin') return isSuperAdmin;
    if (roles === 'admin') return isAdmin;
    return false;
}

// ── Outlet switcher in header ─────────────────────────────────────────
function OutletSwitcher() {
    const { activeOutlet, outlets, switchOutlet } = useOutlet();
    if (outlets.length <= 1) return null;
    return (
        <select
            value={activeOutlet?.outlet_id || ''}
            onChange={e => switchOutlet(Number(e.target.value))}
            className="px-3 py-1.5 bg-teal-500/10 border border-teal-500/30 rounded-lg text-xs font-semibold text-teal-300 focus:border-teal-400 outline-none cursor-pointer"
        >
            {outlets.map(o => (
                <option key={o.outlet_id} value={o.outlet_id} className="bg-slate-800 text-white">
                    {o.is_main ? '⭐ ' : '📍 '}{o.outlet_name}
                </option>
            ))}
        </select>
    );
}

// ── Main Layout ───────────────────────────────────────────────────────
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const router    = useRouter();
    const pathname  = usePathname();
    const [user, setUser]               = useState<{ userId: string; name: string; userType: string } | null>(null);
    const [collapsed, setCollapsed]     = useState(false);
    const [mobileOpen, setMobileOpen]   = useState(false);
    const [expanded, setExpanded]       = useState<Record<string, boolean>>({});
    const [loading, setLoading]         = useState(false);
    const prevPath = useRef(pathname);

    useEffect(() => {
        const raw = localStorage.getItem('user');
        if (!raw) { router.push('/'); return; }
        setUser(JSON.parse(raw));
    }, [router]);

    // Auto-expand active group
    useEffect(() => {
        const ns: Record<string, boolean> = { ...expanded };
        let changed = false;
        menuGroups.forEach(g => {
            const active = g.items.some(i =>
                i.href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(i.href)
            );
            if (active && !expanded[g.name]) { ns[g.name] = true; changed = true; }
        });
        if (changed) setExpanded(ns);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pathname]);

    // Loading bar on route change
    useEffect(() => {
        if (prevPath.current !== pathname) {
            setLoading(true); prevPath.current = pathname;
            const t = setTimeout(() => setLoading(false), 800);
            return () => clearTimeout(t);
        }
    }, [pathname]);

    const toggle = (name: string) => {
        if (collapsed) { setCollapsed(false); setExpanded({ [name]: true }); }
        else setExpanded(p => ({ ...p, [name]: !p[name] }));
    };

    const isActive = (href: string) =>
        href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href);

    const handleLogout = async () => {
        await logActivity('Logout', `${user?.name || 'Unknown'} logged out`);
        localStorage.removeItem('user');
        router.push('/');
    };

    if (!user) return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="text-center">
                <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-gray-500 text-sm">Loading...</p>
            </div>
        </div>
    );

    const isCashier = ['cashier', 'waiter'].includes((user.userType || '').toLowerCase());

    const filteredGroups = menuGroups.map(g => ({
        ...g,
        items: g.items.filter(i => canSee(i.roles ?? 'all', user.userType))
    })).filter(g => g.items.length > 0);

    return (
        <SettingsProvider>
            <OutletProvider>
                <div className="min-h-screen bg-[#f0f2f5] flex font-sans text-gray-800">

                    {/* ── Loading bar (exact AlphaTVET) ── */}
                    {loading && (
                        <div style={{
                            position: 'fixed', top: 0, left: 0, right: 0, height: 3, zIndex: 9999,
                            background: 'linear-gradient(90deg, transparent 0%, #0d9488 40%, #14b8a6 60%, transparent 100%)',
                            animation: 'loadbar 0.8s ease-in-out'
                        }} />
                    )}
                    <style>{`
                        @keyframes loadbar { 0% { transform: translateX(-100%); } 100% { transform: translateX(0); } }
                        .sidebar-scroll { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.1) transparent; }
                        .sidebar-scroll::-webkit-scrollbar { width: 4px; }
                        .sidebar-scroll::-webkit-scrollbar-track { background: transparent; }
                        .sidebar-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
                    `}</style>

                    {/* Mobile overlay */}
                    {mobileOpen && (
                        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 lg:hidden"
                            onClick={() => setMobileOpen(false)} />
                    )}

                    {/* ════════════════ SIDEBAR (exact AlphaTVET) ════════════════ */}
                    {!isCashier && (
                        <aside
                            className={`fixed top-0 left-0 h-full z-50 border-r border-slate-700/30 shadow-xl transition-all duration-300 ease-in-out flex flex-col
                                ${collapsed ? 'w-[72px]' : 'w-[270px]'}
                                ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
                            style={{ background: 'linear-gradient(180deg, #0f172a 0%, #134e4a 50%, #0f172a 100%)' }}>

                            {/* Logo — exact AlphaTVET */}
                            <div className={`flex items-center ${collapsed ? 'justify-center px-2' : 'px-5'} h-[60px] border-b border-white/10`}>
                                {!collapsed && (
                                    <div className="flex items-center gap-2.5 flex-1">
                                        <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white shadow-lg"
                                            style={{ background: 'linear-gradient(135deg, #14b8a6, #0d9488)' }}>
                                            <FiShoppingCart size={18} />
                                        </div>
                                        <div>
                                            <h1 className="text-[15px] font-bold text-white tracking-tight" style={{ fontFamily: 'Outfit, sans-serif' }}>
                                                Alpha<span className="text-teal-400">Retail</span>
                                            </h1>
                                            <p className="text-[9px] text-teal-500/60 font-semibold tracking-[0.15em] uppercase">Point of Sale</p>
                                        </div>
                                    </div>
                                )}
                                {collapsed && (
                                    <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white"
                                        style={{ background: 'linear-gradient(135deg, #14b8a6, #0d9488)' }}>
                                        <FiShoppingCart size={18} />
                                    </div>
                                )}
                                <button onClick={() => setCollapsed(!collapsed)}
                                    className="hidden lg:flex items-center justify-center w-6 h-6 rounded-md border border-white/10 hover:bg-white/10 transition-colors ml-auto text-slate-400 hover:text-white">
                                    {collapsed ? <FiChevronRight size={12} /> : <FiChevronLeft size={12} />}
                                </button>
                                <button onClick={() => setMobileOpen(false)} className="lg:hidden ml-auto text-slate-400 hover:text-white">
                                    <FiX size={20} />
                                </button>
                            </div>

                            {/* Navigation — exact AlphaTVET */}
                            <nav className="flex-1 overflow-y-auto overflow-x-hidden sidebar-scroll py-3 px-3 space-y-0.5">
                                {filteredGroups.map(group => {
                                    const isExp   = expanded[group.name];
                                    const GIcon   = group.icon as React.ElementType | undefined;
                                    const gActive = group.items.some(i => isActive(i.href));

                                    /* Non-collapsible top items (Dashboard, POS) */
                                    if (!group.collapsible) {
                                        return group.items.map(item => {
                                            const IIcon  = item.icon as React.ElementType;
                                            const active = isActive(item.href);
                                            return (
                                                <Link key={item.href} href={item.href}
                                                    onClick={() => setMobileOpen(false)}
                                                    title={collapsed ? item.label : undefined}
                                                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all mb-2
                                                        ${active ? 'bg-teal-500/20 text-teal-300 font-semibold' : 'text-slate-400 hover:bg-white/5 hover:text-white'}
                                                        ${collapsed ? 'justify-center' : ''}`}>
                                                    <IIcon size={18} className={active ? 'text-teal-400' : 'text-slate-500'} />
                                                    {!collapsed && <span>{item.label}</span>}
                                                    {!collapsed && item.badge && (
                                                        <span className="ml-auto text-[9px] font-black px-1.5 py-0.5 rounded-full bg-teal-500/20 text-teal-400">{item.badge}</span>
                                                    )}
                                                    {active && !collapsed && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-teal-400" />}
                                                </Link>
                                            );
                                        });
                                    }

                                    /* Collapsible group */
                                    return (
                                        <div key={group.name} className="mb-0.5">
                                            <button onClick={() => toggle(group.name)}
                                                title={collapsed ? group.label : undefined}
                                                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all
                                                    ${gActive ? 'text-teal-300 bg-teal-500/10' : 'text-slate-400 hover:bg-white/5 hover:text-white'}
                                                    ${collapsed ? 'justify-center' : ''}`}>
                                                {GIcon && <GIcon size={17} className={gActive ? 'text-teal-400' : 'text-slate-500'} />}
                                                {!collapsed && (
                                                    <>
                                                        <span className="flex-1 text-left">{group.label}</span>
                                                        <FiChevronDown size={14}
                                                            className={`text-slate-500 transition-transform duration-200 ${isExp ? 'rotate-180' : ''}`} />
                                                    </>
                                                )}
                                            </button>

                                            {/* Sub-items — exact AlphaTVET indent + border */}
                                            <div className={`overflow-hidden transition-all duration-200 ease-in-out
                                                ${isExp && !collapsed ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                                                <div className="ml-[22px] pl-3 mt-0.5 space-y-0.5 border-l border-white/10">
                                                    {group.items.map(item => {
                                                        const IIcon  = item.icon as React.ElementType;
                                                        const active = isActive(item.href);
                                                        return (
                                                            <Link key={item.href} href={item.href}
                                                                onClick={() => setMobileOpen(false)}
                                                                className={`flex items-center gap-2 px-2.5 py-[7px] rounded-md text-[12.5px] transition-all
                                                                    ${active ? 'text-teal-300 bg-teal-500/15 font-semibold' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}>
                                                                <IIcon size={14} className={active ? 'text-teal-400' : 'text-slate-600'} />
                                                                <span>{item.label}</span>
                                                                {item.badge && (
                                                                    <span className="ml-auto text-[8px] font-black px-1 py-0.5 rounded-full bg-violet-500/20 text-violet-400">{item.badge}</span>
                                                                )}
                                                            </Link>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </nav>

                            {/* User footer — exact AlphaTVET */}
                            <div className={`border-t border-white/10 ${collapsed ? 'p-2' : 'p-3'}`}>
                                {!collapsed ? (
                                    <div className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-white/5 transition-colors">
                                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold"
                                            style={{ background: 'linear-gradient(135deg, #14b8a6, #0d9488)' }}>
                                            {user.name?.charAt(0)?.toUpperCase() || '?'}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[12.5px] font-semibold text-white truncate">{user.name}</p>
                                            <p className="text-[10.5px] text-teal-400 capitalize font-medium">{user.userType}</p>
                                        </div>
                                        <button onClick={handleLogout}
                                            className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
                                            title="Logout">
                                            <FiLogOut size={15} />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                                            style={{ background: 'linear-gradient(135deg, #14b8a6, #0d9488)' }}>
                                            {user.name?.charAt(0)?.toUpperCase() || '?'}
                                        </div>
                                        <button onClick={handleLogout}
                                            className="p-1.5 text-slate-500 hover:text-red-400 rounded-md transition-colors"
                                            title="Logout">
                                            <FiLogOut size={15} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </aside>
                    )}

                    {/* ════════════════ MAIN CONTENT ════════════════ */}
                    <main className={`flex-1 flex flex-col min-h-screen transition-all duration-300
                        ${isCashier ? 'ml-0' : collapsed ? 'lg:ml-[72px]' : 'lg:ml-[270px]'}`}>

                        {/* Header — exact AlphaTVET */}
                        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-gray-200/70 px-4 lg:px-6 h-14 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                {!isCashier && (
                                    <button onClick={() => setMobileOpen(true)} className="lg:hidden text-gray-500 hover:text-gray-800">
                                        <FiMenu size={22} />
                                    </button>
                                )}
                                <div className="hidden sm:flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 w-72 focus-within:w-96 focus-within:ring-2 focus-within:ring-teal-100 focus-within:bg-white focus-within:border-teal-300 transition-all duration-300">
                                    <FiSearch className="text-gray-400" size={15} />
                                    <input type="text" placeholder="Search products, customers, reports..."
                                        className="bg-transparent text-[13px] text-gray-800 outline-none w-full placeholder:text-gray-400" />
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <OutletSwitcher />
                                <button className="relative p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors">
                                    <FiBell size={17} />
                                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
                                </button>
                                <button className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors" onClick={() => router.push('/dashboard/company')}>
                                    <FiSettings size={17} />
                                </button>
                                <div className="flex items-center gap-2 pl-2 border-l border-gray-200 ml-1">
                                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                                        style={{ background: 'linear-gradient(135deg, #14b8a6, #0d9488)' }}>
                                        {user.name?.charAt(0)?.toUpperCase() || '?'}
                                    </div>
                                    <div className="hidden sm:block">
                                        <p className="text-[12px] font-bold text-gray-800 leading-tight">{user.name}</p>
                                        <p className="text-[10px] text-teal-600 capitalize font-medium">{user.userType}</p>
                                    </div>
                                </div>
                            </div>
                        </header>

                        <div className="p-4 lg:p-6 flex-1 overflow-x-hidden">{children}</div>
                    </main>
                </div>
            </OutletProvider>
        </SettingsProvider>
    );
}
