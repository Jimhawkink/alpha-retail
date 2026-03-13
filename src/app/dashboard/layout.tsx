'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { SettingsProvider, useCompanyName } from '@/context/SettingsContext';
import { OutletProvider, useOutlet } from '@/context/OutletContext';
import { logActivity } from '@/lib/supabase';

// Menu Items for Retail Store System
const menuItems = [
    {
        category: 'Main',
        items: [
            { name: 'Dashboard', icon: '📊', href: '/dashboard', badge: null },
            { name: 'Retail POS', icon: '🛒', href: '/dashboard/pos', badge: 'Live' },
        ]
    },
    {
        category: 'Sales & Products',
        items: [
            { name: 'Products', icon: '📦', href: '/dashboard/products', badge: null },
            { name: 'Categories', icon: '🏷️', href: '/dashboard/categories', badge: null },
            { name: 'Sales Records', icon: '📋', href: '/dashboard/sales', badge: null },
            { name: 'Sales Return', icon: '↩️', href: '/dashboard/sales-return', badge: null },
        ]
    },
    {
        category: 'Purchases',
        items: [
            { name: 'Suppliers', icon: '🏢', href: '/dashboard/suppliers', badge: null },
            { name: 'Purchase Entry', icon: '📥', href: '/dashboard/purchase', badge: null },
            { name: 'Purchase Records', icon: '📋', href: '/dashboard/purchases', badge: null },
            { name: 'Purchase Return', icon: '↩️', href: '/dashboard/purchase-return', badge: null },
        ]
    },
    {
        category: 'Inventory',
        items: [
            { name: 'Stock Movement', icon: '📦', href: '/dashboard/stock-movement', badge: null },
            { name: 'Stock Transfer', icon: '🔄', href: '/dashboard/stock-transfer', badge: null },
            { name: 'Stock Adjustment', icon: '⚖️', href: '/dashboard/stock-adjustment', badge: null },
            { name: 'Low Stock', icon: '⚠️', href: '/dashboard/low-stock', badge: '5' },
            { name: 'Stock Valuation', icon: '💰', href: '/dashboard/stock-valuation', badge: null },
        ]
    },
    {
        category: 'Finance',
        items: [
            { name: 'Expenses', icon: '💸', href: '/dashboard/expenses', badge: null },
            { name: 'Credit Customers', icon: '💳', href: '/dashboard/credit-customers', badge: null },
            { name: 'Credit Payments', icon: '💰', href: '/dashboard/credit-payments', badge: null },
            { name: 'M-Pesa', icon: '📱', href: '/dashboard/mpesa', badge: null },
        ]
    },
    {
        category: 'HR & Payroll',
        items: [
            { name: 'Payroll', icon: '💰', href: '/dashboard/payroll', badge: null },
            { name: 'Advances', icon: '💵', href: '/dashboard/advances', badge: null },
            { name: 'Shifts', icon: '⏰', href: '/dashboard/shifts', badge: null },
            { name: 'Shift Reports', icon: '📋', href: '/dashboard/shift-reports', badge: null },
        ]
    },
    {
        category: 'Reports',
        items: [
            { name: 'Sales Report', icon: '📈', href: '/dashboard/reports/sales', badge: null },
            { name: 'Profit Report', icon: '💹', href: '/dashboard/reports/profit', badge: null },
            { name: 'Stock Report', icon: '📊', href: '/dashboard/reports/stock', badge: null },
            { name: 'P&L Report', icon: '📉', href: '/dashboard/reports/profit-loss', badge: null },
            { name: 'Trial Balance', icon: '⚖️', href: '/dashboard/reports/trial-balance', badge: null },
            { name: 'Balance Sheet', icon: '📋', href: '/dashboard/reports/balance-sheet', badge: null },
            { name: 'Cash Book', icon: '💵', href: '/dashboard/reports/cash-book', badge: null },
            { name: 'M-Pesa Report', icon: '📱', href: '/dashboard/reports/mpesa', badge: null },
        ]
    },
    {
        category: 'Administration',
        items: [
            { name: 'Outlets', icon: '📍', href: '/dashboard/outlets', badge: null },
            { name: 'Users', icon: '👥', href: '/dashboard/users', badge: null },
            { name: 'User Roles', icon: '🛡️', href: '/dashboard/user-roles', badge: null },
            { name: 'Activity Log', icon: '📜', href: '/dashboard/activity-log', badge: null },
            { name: 'Company', icon: '🏪', href: '/dashboard/company', badge: null },
            { name: 'Tax Settings', icon: '📊', href: '/dashboard/tax-settings', badge: null },
            { name: 'Units', icon: '📏', href: '/dashboard/units', badge: null },
        ]
    },
];

// Component to display company name dynamically
function CompanyNameDisplay() {
    const companyName = useCompanyName();
    return (
        <h1 className="font-bold text-gray-800 text-sm leading-tight max-w-[140px] break-words">
            {companyName || 'Alpha Retail'}
        </h1>
    );
}

// Outlet switcher component for header
function OutletSwitcher() {
    const { activeOutlet, outlets, switchOutlet } = useOutlet();
    if (outlets.length <= 1) return null;
    return (
        <select
            value={activeOutlet?.outlet_id || ''}
            onChange={e => switchOutlet(Number(e.target.value))}
            className="px-3 py-1.5 bg-indigo-50 border border-indigo-200 rounded-xl text-sm font-semibold text-indigo-700 focus:border-indigo-400 outline-none cursor-pointer"
            title="Switch Outlet"
        >
            {outlets.map(o => (
                <option key={o.outlet_id} value={o.outlet_id}>
                    {o.is_main ? '⭐ ' : '📍 '}{o.outlet_name}
                </option>
            ))}
        </select>
    );
}

// Active outlet badge
function OutletBadge() {
    const { activeOutlet } = useOutlet();
    if (!activeOutlet) return null;
    return (
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 rounded-full border border-indigo-100">
            <span className="text-xs">{activeOutlet.is_main ? '⭐' : '📍'}</span>
            <span className="text-xs font-semibold text-indigo-700">{activeOutlet.outlet_name}</span>
        </div>
    );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const [user, setUser] = useState<{ userId: string; name: string; userType: string } | null>(null);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [activeMenu, setActiveMenu] = useState('/dashboard');

    useEffect(() => {
        const userData = localStorage.getItem('user');
        if (!userData) {
            router.push('/');
            return;
        }
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);

        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, [router]);

    const getGreeting = () => {
        const hour = currentTime.getHours();
        if (hour < 12) return { text: 'Good Morning', emoji: '🌅' };
        if (hour < 17) return { text: 'Good Afternoon', emoji: '☀️' };
        if (hour < 21) return { text: 'Good Evening', emoji: '🌆' };
        return { text: 'Good Night', emoji: '🌙' };
    };

    const greeting = getGreeting();

    const handleLogout = async () => {
        await logActivity('Logout', `${user?.name || 'Unknown'} logged out`);
        localStorage.removeItem('user');
        router.push('/');
    };

    if (!user) return null;

    return (
        <SettingsProvider>
            <OutletProvider>
                <div className="min-h-screen bg-[#f8fafc] flex">
                    {/* Sidebar */}
                    <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-white border-r border-gray-200 flex flex-col transition-all duration-300 fixed h-full z-50`}>
                        {/* Logo Section */}
                        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-100">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg">
                                    <span className="text-xl">🛒</span>
                                </div>
                                {sidebarOpen && (
                                    <div>
                                        <CompanyNameDisplay />
                                        <span className="text-xs text-green-600 font-medium">Retail v1.0</span>
                                    </div>
                                )}
                            </div>
                            <button
                                onClick={() => setSidebarOpen(!sidebarOpen)}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                {sidebarOpen ? '◀️' : '▶️'}
                            </button>
                        </div>

                        {/* Search */}
                        {sidebarOpen && (
                            <div className="p-4">
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                                    <input
                                        type="text"
                                        placeholder="Search..."
                                        className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100 transition-all"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Navigation */}
                        <nav className="flex-1 overflow-y-auto px-3 py-2">
                            {menuItems.map((section, idx) => {
                                // Filter items based on user role
                                const isSuperAdmin = user?.userType?.toLowerCase() === 'superadmin' || user?.userType?.toLowerCase() === 'superuser' || user?.userType?.toLowerCase() === 'super admin';
                                const isAdmin = isSuperAdmin || user?.userType?.toLowerCase() === 'admin' || user?.userType?.toLowerCase() === 'manager';
                                const filteredItems = section.items.filter(item => {
                                    // Only superadmin/superuser can see Outlets
                                    if (item.href === '/dashboard/outlets' && !isSuperAdmin) return false;
                                    // Only admin+ can see Activity Log
                                    if (item.href === '/dashboard/activity-log' && !isAdmin) return false;
                                    return true;
                                });
                                if (filteredItems.length === 0) return null;
                                return (
                                <div key={idx} className="mb-4">
                                    {sidebarOpen && (
                                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 mb-2">
                                            {section.category}
                                        </p>
                                    )}
                                    {filteredItems.map((item) => (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            onClick={() => setActiveMenu(item.href)}
                                            title={item.name}
                                            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1 transition-all ${activeMenu === item.href
                                                ? 'bg-green-50 text-green-600'
                                                : 'text-gray-600 hover:bg-gray-50'
                                                }`}
                                        >
                                            <span className="text-xl" title={item.name}>{item.icon}</span>
                                            {sidebarOpen && (
                                                <>
                                                    <span className="font-medium text-sm flex-1">{item.name}</span>
                                                    {item.badge && (
                                                        <span className={`text-xs px-2 py-0.5 rounded-full ${item.badge === 'Live'
                                                            ? 'bg-green-100 text-green-600'
                                                            : 'bg-red-100 text-red-600'
                                                            }`}>
                                                            {item.badge}
                                                        </span>
                                                    )}
                                                </>
                                            )}
                                        </Link>
                                    ))}
                                </div>
                                );
                            })}
                        </nav>

                        {/* User Profile */}
                        <div className="p-4 border-t border-gray-100">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white font-bold">
                                    {user.name.charAt(0).toUpperCase()}
                                </div>
                                {sidebarOpen && (
                                    <div className="flex-1">
                                        <p className="font-semibold text-gray-800 text-sm">{user.name}</p>
                                        <p className="text-xs text-gray-500">{user.userType || 'Cashier'}</p>
                                    </div>
                                )}
                                {sidebarOpen && (
                                    <button
                                        onClick={handleLogout}
                                        className="p-2 hover:bg-red-50 rounded-lg text-red-500 transition-colors"
                                        title="Logout"
                                    >
                                        🚪
                                    </button>
                                )}
                            </div>
                        </div>
                    </aside>

                    {/* Main Content */}
                    <main className={`flex-1 ${sidebarOpen ? 'ml-64' : 'ml-20'} transition-all duration-300`}>
                        {/* Top Header */}
                        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 sticky top-0 z-40">
                            <div className="flex items-center gap-4">
                                <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                                    {greeting.emoji} {greeting.text}
                                    <span className="text-2xl">👋</span>
                                </h2>
                                <span className="text-sm text-gray-400">Alpha Retail POS - v1.0</span>
                            </div>

                            <div className="flex items-center gap-4">
                                {/* Outlet Switcher */}
                                <OutletSwitcher />
                                <OutletBadge />

                                {/* Online Status */}
                                <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 rounded-full">
                                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                                    <span className="text-sm font-medium text-green-600">Online</span>
                                </div>

                                {/* Refresh Button */}
                                <button className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-xl hover:bg-green-600 transition-colors shadow-sm">
                                    <span>🔄</span>
                                    <span className="font-medium">Refresh</span>
                                </button>

                                {/* Notifications */}
                                <button className="relative p-2 hover:bg-gray-100 rounded-xl transition-colors">
                                    <span className="text-xl">🔔</span>
                                    <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                                </button>

                                {/* User Avatar */}
                                <div className="flex items-center gap-3 pl-4 border-l border-gray-200">
                                    <div className="text-right">
                                        <p className="font-semibold text-gray-800 text-sm">{user.name}</p>
                                        <p className="text-xs text-gray-500">Cashier</p>
                                    </div>
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white font-bold shadow-md">
                                        {user.name.charAt(0).toUpperCase()}
                                    </div>
                                </div>
                            </div>
                        </header>

                        {/* Page Content */}
                        <div className="p-6">
                            {children}
                        </div>
                    </main>
                </div>
            </OutletProvider>
        </SettingsProvider>
    );
}
