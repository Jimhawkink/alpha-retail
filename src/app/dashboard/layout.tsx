'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
    FiHome, FiShoppingCart, FiPackage, FiTag, FiFileText, FiRefreshCw,
    FiTruck, FiUsers, FiBox, FiActivity, FiRepeat, FiAlertCircle,
    FiDollarSign, FiClock, FiTrendingDown, FiCreditCard, FiSmartphone,
    FiTrendingUp, FiBarChart2, FiPieChart, FiSettings, FiMapPin, FiShield,
    FiZap, FiBriefcase, FiChevronDown, FiChevronLeft, FiChevronRight,
    FiLogOut, FiSearch, FiBell, FiMenu, FiX, FiDatabase, FiSliders, FiDownload
} from 'react-icons/fi';
import { SettingsProvider, useCompanyName } from '@/context/SettingsContext';
import { OutletProvider, useOutlet } from '@/context/OutletContext';
import { logActivity } from '@/lib/supabase';

// ── Session timeout config ────────────────────────────────────────────
const IDLE_TIMEOUT_MS    = 30 * 60 * 1000; // 30 minutes idle → show warning
const WARNING_SECONDS    = 120;             // 2-minute countdown before force-logout

// ── Session timeout warning modal ────────────────────────────────────
function SessionTimeoutModal({
    secondsLeft, onStay, onLogout
}: { secondsLeft: number; onStay: () => void; onLogout: () => void }) {
    const pct = (secondsLeft / WARNING_SECONDS) * 100;
    const mins = Math.floor(secondsLeft / 60);
    const secs = secondsLeft % 60;
    const urgent = secondsLeft <= 30;
    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
                style={{ animation: 'fadeUp .3s ease-out' }}>
                {/* Top accent bar */}
                <div className="h-1.5 w-full" style={{ background: urgent ? 'linear-gradient(90deg,#ef4444,#f97316)' : 'linear-gradient(90deg,#4f46e5,#7c3aed)' }} />
                <div className="p-8 text-center">
                    {/* Circular countdown */}
                    <div className="relative w-24 h-24 mx-auto mb-5">
                        <svg className="w-24 h-24 -rotate-90" viewBox="0 0 96 96">
                            <circle cx="48" cy="48" r="42" fill="none" stroke="#e2e8f0" strokeWidth="8"/>
                            <circle cx="48" cy="48" r="42" fill="none"
                                stroke={urgent ? '#ef4444' : '#4f46e5'} strokeWidth="8"
                                strokeLinecap="round"
                                strokeDasharray={`${2 * Math.PI * 42}`}
                                strokeDashoffset={`${2 * Math.PI * 42 * (1 - pct / 100)}`}
                                style={{ transition: 'stroke-dashoffset 1s linear, stroke .3s' }}/>
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className={`text-2xl font-black ${urgent ? 'text-red-500' : 'text-indigo-600'}`}>
                                {mins > 0 ? `${mins}:${String(secs).padStart(2,'0')}` : secs}
                            </span>
                            <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">left</span>
                        </div>
                    </div>
                    <div className="text-2xl mb-2">{urgent ? '🚨' : '⏰'}</div>
                    <h3 className="text-lg font-black text-gray-800 mb-1">Session Expiring Soon</h3>
                    <p className="text-gray-500 text-sm leading-relaxed">
                        Your session will automatically log out due to inactivity.
                        Click <strong>Stay Logged In</strong> to continue.
                    </p>
                </div>
                <div className="px-6 pb-6 space-y-2">
                    <button onClick={onStay}
                        className="w-full py-3.5 rounded-xl text-white font-black text-sm transition-all hover:scale-[1.02] shadow-lg"
                        style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', boxShadow: '0 6px 20px rgba(79,70,229,.35)' }}>
                        ✅ Stay Logged In
                    </button>
                    <button onClick={onLogout}
                        className="w-full py-3 rounded-xl text-red-500 font-bold text-sm border border-red-200 hover:bg-red-50 transition-all">
                        Logout Now
                    </button>
                </div>
                <div className="px-6 pb-4 text-center">
                    <p className="text-[10px] text-gray-300">Auto-logout protects your POS data from unauthorized access</p>
                </div>
            </div>
        </div>
    );
}


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
        { href: '/dashboard/license',        label: '🔐 License Mgmt', icon: FiShield, roles: 'superadmin', badge: 'SA' },
    ]},
];

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
    if (outlets.length <= 1) return null;
    return (
        <select value={activeOutlet?.outlet_id || ''} onChange={e => switchOutlet(Number(e.target.value))}
            className="px-3 py-1.5 bg-indigo-50 border border-indigo-200 rounded-xl text-xs font-bold text-indigo-700 outline-none cursor-pointer">
            {outlets.map(o => (
                <option key={o.outlet_id} value={o.outlet_id}>{o.is_main ? '⭐ ' : '📍 '}{o.outlet_name}</option>
            ))}
        </select>
    );
}

function CompanyBrand() {
    const name = useCompanyName();
    const { activeOutlet } = useOutlet();
    return (
        <div className="min-w-0">
            <p className="text-sm font-black text-gray-800 truncate leading-tight">{name || 'Alpha Retail'}</p>
            {activeOutlet && <p className="text-[10px] text-indigo-500 font-semibold truncate">📍 {activeOutlet.outlet_name}</p>}
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
    // Session timeout state
    const [showTimeoutModal, setShowTimeoutModal] = useState(false);
    const [countdown, setCountdown]               = useState(WARNING_SECONDS);
    const idleTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
    const warnTimer   = useRef<ReturnType<typeof setInterval> | null>(null);
    const prevPath = useRef(pathname);


    useEffect(() => {
        const raw = localStorage.getItem('user');
        if (!raw) { router.push('/'); return; }
        setUser(JSON.parse(raw));
    }, [router]);

    // ── Session timeout logic ─────────────────────────────────────────
    const forceLogout = useCallback(async (reason = 'Session timeout') => {
        if (idleTimer.current)  clearTimeout(idleTimer.current);
        if (warnTimer.current)  clearInterval(warnTimer.current);
        const stored = localStorage.getItem('user');
        const u = stored ? JSON.parse(stored) : null;
        await logActivity('Auto Logout', `${u?.name || 'User'} auto-logged out: ${reason}`);
        localStorage.removeItem('user');
        router.push('/?timeout=1');
    }, [router]);

    const resetIdleTimer = useCallback(() => {
        if (showTimeoutModal) return; // Don't reset while warning is shown
        if (idleTimer.current) clearTimeout(idleTimer.current);
        idleTimer.current = setTimeout(() => {
            // Show warning modal + start countdown
            setShowTimeoutModal(true);
            setCountdown(WARNING_SECONDS);
            let secs = WARNING_SECONDS;
            warnTimer.current = setInterval(() => {
                secs--;
                setCountdown(secs);
                if (secs <= 0) {
                    if (warnTimer.current) clearInterval(warnTimer.current);
                    forceLogout('Idle for 30 minutes');
                }
            }, 1000);
        }, IDLE_TIMEOUT_MS);
    }, [showTimeoutModal, forceLogout]);

    const handleStayLoggedIn = useCallback(() => {
        if (warnTimer.current) clearInterval(warnTimer.current);
        setShowTimeoutModal(false);
        setCountdown(WARNING_SECONDS);
        resetIdleTimer();
    }, [resetIdleTimer]);

    // Attach activity listeners
    useEffect(() => {
        const events = ['mousemove','mousedown','keydown','touchstart','scroll','click','wheel'];
        const handler = () => resetIdleTimer();
        events.forEach(e => window.addEventListener(e, handler, { passive: true }));
        resetIdleTimer(); // Start timer on mount
        return () => {
            events.forEach(e => window.removeEventListener(e, handler));
            if (idleTimer.current)  clearTimeout(idleTimer.current);
            if (warnTimer.current)  clearInterval(warnTimer.current);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);


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
        if (idleTimer.current) clearTimeout(idleTimer.current);
        if (warnTimer.current) clearInterval(warnTimer.current);
        await logActivity('Logout', `${user?.name || 'Unknown'} logged out`);
        localStorage.removeItem('user');
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

    const isCashier = ['cashier', 'waiter'].includes((user.userType || '').toLowerCase());
    const filtered  = menuGroups.map(g => ({ ...g, items: g.items.filter(i => canSee(i.roles ?? 'all', user.userType)) })).filter(g => g.items.length > 0);

    return (
        <SettingsProvider>
            <OutletProvider>
                <div className="min-h-screen bg-[#f4f6f9] flex font-sans">
                    {/* Session timeout modal */}
                    {showTimeoutModal && (
                        <SessionTimeoutModal
                            secondsLeft={countdown}
                            onStay={handleStayLoggedIn}
                            onLogout={() => forceLogout('User chose to logout')}
                        />
                    )}

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

                    {/* ═══════════ SIDEBAR (bright white) ═══════════ */}
                    {!isCashier && (
                        <aside className={`fixed top-0 left-0 h-full z-50 bg-white border-r border-gray-200 shadow-sm flex flex-col transition-all duration-300 ease-in-out
                            ${collapsed ? 'w-[70px]' : 'w-[260px]'}
                            ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>

                            {/* Logo */}
                            <div className={`flex items-center h-[60px] border-b border-gray-100 shrink-0 ${collapsed ? 'px-2 justify-center' : 'px-4 gap-2.5'}`}>
                                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white shadow shrink-0"
                                    style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
                                    <FiShoppingCart size={16} />
                                </div>
                                {!collapsed && <CompanyBrand />}
                                {!collapsed && (
                                    <button onClick={() => setCollapsed(true)}
                                        className="hidden lg:flex w-6 h-6 items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:text-indigo-600 hover:border-indigo-300 transition-colors ml-auto shrink-0">
                                        <FiChevronLeft size={12} />
                                    </button>
                                )}
                                {collapsed && (
                                    <button onClick={() => setCollapsed(false)}
                                        className="hidden lg:flex w-6 h-6 items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:text-indigo-600 hover:border-indigo-300 transition-colors">
                                        <FiChevronRight size={12} />
                                    </button>
                                )}
                                <button onClick={() => setMobileOpen(false)} className="lg:hidden ml-auto text-gray-400 hover:text-gray-600">
                                    <FiX size={18} />
                                </button>
                            </div>

                            {/* Nav */}
                            <nav className="flex-1 overflow-y-auto sb-scroll py-3 px-2.5 space-y-0.5">
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
                                                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] font-semibold transition-all mb-1
                                                        ${active ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}
                                                        ${collapsed ? 'justify-center' : ''}`}>
                                                    <IIcon size={17} className={active ? 'text-indigo-600' : 'text-gray-400'} />
                                                    {!collapsed && <span className="flex-1">{item.label}</span>}
                                                    {!collapsed && item.badge && <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-600">{item.badge}</span>}
                                                    {active && !collapsed && <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />}
                                                </Link>
                                            );
                                        });
                                    }

                                    return (
                                        <div key={group.name} className="mb-0.5">
                                            <button onClick={() => toggle(group.name)}
                                                title={collapsed ? group.label : undefined}
                                                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[12.5px] font-semibold transition-all
                                                    ${gActive ? 'text-indigo-700 bg-indigo-50/70' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'}
                                                    ${collapsed ? 'justify-center' : ''}`}>
                                                {GIcon && <GIcon size={16} className={gActive ? 'text-indigo-600' : 'text-gray-400'} />}
                                                {!collapsed && (
                                                    <>
                                                        <span className="flex-1 text-left">{group.label}</span>
                                                        <FiChevronDown size={13} className={`text-gray-400 transition-transform duration-200 ${isExp ? 'rotate-180' : ''}`} />
                                                    </>
                                                )}
                                            </button>

                                            <div className={`overflow-hidden transition-all duration-200 ease-in-out ${isExp && !collapsed ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                                                <div className="ml-[18px] pl-3 mt-0.5 pb-1 space-y-0.5 border-l-2 border-gray-100">
                                                    {group.items.map(item => {
                                                        const IIcon  = item.icon as React.ElementType;
                                                        const active = isActive(item.href);
                                                        return (
                                                            <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)}
                                                                className={`flex items-center gap-2 px-2.5 py-[7px] rounded-lg text-[12px] transition-all
                                                                    ${active ? 'text-indigo-700 bg-indigo-50 font-semibold' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'}`}>
                                                                <IIcon size={13} className={active ? 'text-indigo-600' : 'text-gray-400'} />
                                                                <span className="flex-1">{item.label}</span>
                                                                {item.badge && <span className="text-[8px] font-black px-1 py-0.5 rounded-full bg-violet-100 text-violet-600">{item.badge}</span>}
                                                                {active && <div className="w-1 h-1 rounded-full bg-indigo-500 shrink-0" />}
                                                            </Link>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </nav>

                            {/* User footer */}
                            <div className={`border-t border-gray-100 shrink-0 ${collapsed ? 'p-2' : 'p-3'}`}>
                                {!collapsed ? (
                                    <div className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-gray-50 transition-colors">
                                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-black shrink-0"
                                            style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
                                            {user.name?.charAt(0)?.toUpperCase() || '?'}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[12.5px] font-bold text-gray-800 truncate">{user.name}</p>
                                            <p className="text-[10.5px] text-indigo-600 font-semibold capitalize">{user.userType}</p>
                                        </div>
                                        <button onClick={handleLogout} title="Logout"
                                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                            <FiLogOut size={15} />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-black"
                                            style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
                                            {user.name?.charAt(0)?.toUpperCase() || '?'}
                                        </div>
                                        <button onClick={handleLogout} title="Logout"
                                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                            <FiLogOut size={13} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </aside>
                    )}

                    {/* ═══════════ MAIN ═══════════ */}
                    <main className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ${isCashier ? '' : collapsed ? 'lg:ml-[70px]' : 'lg:ml-[260px]'}`}>
                        {/* Header */}
                        <header className="sticky top-0 z-30 bg-white border-b border-gray-200/80 h-[60px] flex items-center px-4 lg:px-6 gap-3">
                            {!isCashier && (
                                <button onClick={() => setMobileOpen(true)} className="lg:hidden text-gray-500 hover:text-gray-800">
                                    <FiMenu size={20} />
                                </button>
                            )}
                            <div className="hidden sm:flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 w-64 focus-within:w-80 focus-within:ring-2 focus-within:ring-indigo-100 focus-within:border-indigo-300 focus-within:bg-white transition-all duration-300">
                                <FiSearch className="text-gray-400 shrink-0" size={14} />
                                <input type="text" placeholder="Search products, reports..." className="bg-transparent text-[13px] text-gray-700 outline-none w-full placeholder:text-gray-400" />
                            </div>
                            <div className="flex items-center gap-2 ml-auto">
                                <OutletSwitcher />
                                <button className="relative p-2 rounded-xl text-gray-500 hover:bg-gray-100 transition-colors">
                                    <FiBell size={17} />
                                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
                                </button>
                                <button onClick={() => router.push('/dashboard/company')} className="p-2 rounded-xl text-gray-500 hover:bg-gray-100 transition-colors">
                                    <FiSettings size={17} />
                                </button>
                                <div className="flex items-center gap-2.5 pl-3 border-l border-gray-200">
                                    <div className="hidden sm:block text-right">
                                        <p className="text-[12px] font-bold text-gray-800">{user.name}</p>
                                        <p className="text-[10px] text-indigo-600 font-semibold capitalize">{user.userType}</p>
                                    </div>
                                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-black shadow"
                                        style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
                                        {user.name?.charAt(0)?.toUpperCase() || '?'}
                                    </div>
                                </div>
                            </div>
                        </header>

                        <div className="flex-1 p-4 lg:p-6 overflow-x-hidden">{children}</div>
                    </main>
                </div>
            </OutletProvider>
        </SettingsProvider>
    );
}
