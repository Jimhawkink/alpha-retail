'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { SettingsProvider, useCompanyName } from '@/context/SettingsContext';

// Menu Items for Retail Store System
// Menu Items for Retail Store System
const retailMenuItems = [
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
        ]
    },
    {
        category: 'Administration',
        items: [
            { name: 'Users', icon: '👥', href: '/dashboard/users', badge: null },
            { name: 'User Roles', icon: '🛡️', href: '/dashboard/user-roles', badge: null },
            { name: 'Company', icon: '🏪', href: '/dashboard/company', badge: null },
            { name: 'Tax Settings', icon: '📊', href: '/dashboard/tax-settings', badge: null },
            { name: 'Units', icon: '📏', href: '/dashboard/units', badge: null },
        ]
    },
];

// Menu Items for Hospital System (TOTALLY NEW & ISOLATED)
const hospitalMenuItems = [
    {
        category: 'Hospital Console',
        items: [
            { name: 'Overview', icon: '🏢', href: '/dashboard/hospital-dashboard', badge: null },
            { name: 'Medical POS', icon: '🏥', href: '/dashboard/hospital-pos', badge: 'Live' },
        ]
    },
    {
        category: 'Patient Management',
        items: [
            { name: 'Patients List', icon: '👥', href: '/dashboard/hospital-patients', badge: null },
            { name: 'Services', icon: '🩺', href: '/dashboard/hospital-services', badge: null },
            { name: 'Insurance/Companies', icon: '🏢', href: '/dashboard/hospital-companies', badge: null },
        ]
    },
    {
        category: 'Operations',
        items: [
            { name: 'Sales & Billing', icon: '📝', href: '/dashboard/hospital-reports', badge: null },
            { name: 'M-Pesa Intake', icon: '📱', href: '/dashboard/hospital-mpesa', badge: null },
        ]
    },
    {
        category: 'Clinic Settings',
        items: [
            { name: 'Staff Management', icon: '👨‍⚕️', href: '/dashboard/hospital-users', badge: null },
            { name: 'General Settings', icon: '⚙️', href: '/dashboard/hospital-settings', badge: null },
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

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const [user, setUser] = useState<{ userId: string; name: string; isHospital?: boolean } | null>(null);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [activeMenu, setActiveMenu] = useState('');

    useEffect(() => {
        const userData = localStorage.getItem('user');
        if (!userData) {
            router.push('/');
            return;
        }
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);
        setActiveMenu(window.location.pathname);

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

    const handleLogout = () => {
        const isHosp = user?.isHospital;
        localStorage.removeItem('user');
        router.push(isHosp ? '/hospital-login' : '/');
    };

    if (!user) return null;

    return (
        <SettingsProvider>
            <div className="min-h-screen bg-[#f8fafc] flex">
                {/* Sidebar */}
                <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} ${user.isHospital ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-200'} flex flex-col transition-all duration-300 fixed h-full z-50 border-r`}>
                    {/* Logo Section */}
                    <div className={`h-16 flex items-center justify-between px-4 border-b ${user.isHospital ? 'border-slate-800' : 'border-gray-100'}`}>
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${user.isHospital ? 'from-blue-500 to-indigo-600' : 'from-green-500 to-emerald-600'} flex items-center justify-center shadow-lg transition-colors`}>
                                <span className="text-xl">{user.isHospital ? '🏥' : '🛒'}</span>
                            </div>
                            {sidebarOpen && (
                                <div>
                                    {user.isHospital ? (
                                        <h1 className="font-bold text-white text-sm leading-tight max-w-[140px] break-words">
                                            Alpha Medical
                                        </h1>
                                    ) : (
                                        <CompanyNameDisplay />
                                    )}
                                    <span className={`text-xs font-medium ${user.isHospital ? 'text-blue-400' : 'text-green-600'}`}>
                                        {user.isHospital ? 'Hospital v1.0' : 'Retail v1.0'}
                                    </span>
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
                                    className={`w-full pl-10 pr-4 py-2.5 ${user.isHospital ? 'bg-slate-800 border-slate-700 text-white focus:border-blue-500 focus:ring-blue-900/20' : 'bg-gray-50 border border-gray-200 focus:border-green-400 focus:ring-green-100'} border rounded-xl text-sm focus:outline-none focus:ring-2 transition-all`}
                                />
                            </div>
                        </div>
                    )}

                    {/* Navigation */}
                    <nav className="flex-1 overflow-y-auto px-3 py-2">
                        {(user.isHospital ? hospitalMenuItems : retailMenuItems).map((section, idx) => (
                            <div key={idx} className="mb-4">
                                {sidebarOpen && (
                                    <p className={`text-xs font-semibold ${user.isHospital ? 'text-slate-500' : 'text-gray-400'} uppercase tracking-wider px-3 mb-2`}>
                                        {section.category}
                                    </p>
                                )}
                                {section.items.map((item) => (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        onClick={() => setActiveMenu(item.href)}
                                        title={item.name}
                                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1 transition-all ${activeMenu === item.href
                                            ? (user.isHospital ? 'bg-blue-600 text-white' : 'bg-green-50 text-green-600')
                                            : (user.isHospital ? 'text-slate-400 hover:bg-slate-800 hover:text-white' : 'text-gray-600 hover:bg-gray-50')
                                            }`}
                                    >
                                        <span className="text-xl" title={item.name}>{item.icon}</span>
                                        {sidebarOpen && (
                                            <>
                                                <span className="font-medium text-sm flex-1">{item.name}</span>
                                                {item.badge && (
                                                    <span className={`text-xs px-2 py-0.5 rounded-full ${item.badge === 'Live'
                                                        ? (user.isHospital ? 'bg-blue-500 text-white' : 'bg-green-100 text-green-600')
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
                        ))}
                    </nav>

                    {/* User Profile */}
                    <div className={`p-4 border-t ${user.isHospital ? 'border-slate-800' : 'border-gray-100'}`}>
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${user.isHospital ? 'from-blue-500 to-indigo-600' : 'from-green-500 to-emerald-600'} flex items-center justify-center text-white font-bold shadow-lg`}>
                                {user.name.charAt(0).toUpperCase()}
                            </div>
                            {sidebarOpen && (
                                <div className="flex-1">
                                    <p className={`font-semibold text-sm ${user.isHospital ? 'text-white' : 'text-gray-800'}`}>{user.name}</p>
                                    <p className={`text-xs ${user.isHospital ? 'text-slate-500' : 'text-gray-500'}`}>{user.isHospital ? 'Medical Staff' : 'Cashier'}</p>
                                </div>
                            )}
                            {sidebarOpen && (
                                <button
                                    onClick={handleLogout}
                                    className={`p-2 rounded-lg transition-colors ${user.isHospital ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'hover:bg-red-50 text-red-500'}`}
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
                            <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                                {greeting.emoji} {greeting.text}
                            </h2>
                            <span className={`text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-lg ${user.isHospital ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'}`}>
                                {user.isHospital ? 'Hospital Portal v1.0' : 'Retail Portal v1.0'}
                            </span>
                        </div>

                        <div className="flex items-center gap-4">
                            {/* Online Status */}
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 rounded-full">
                                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                                <span className="text-sm font-medium text-green-600">Online</span>
                            </div>

                            {/* Refresh Button */}
                            <button className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-white font-black transition-all shadow-lg active:scale-95 ${user.isHospital ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20' : 'bg-green-500 hover:bg-green-600 shadow-green-500/20'}`}>
                                <span>🔄</span>
                                <span className="text-sm">Refresh</span>
                            </button>

                            {/* Notifications */}
                            <button className="relative p-2 hover:bg-gray-100 rounded-xl transition-colors">
                                <span className="text-xl">🔔</span>
                                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                            </button>

                            {/* User Avatar */}
                            <div className="flex items-center gap-4 pl-4 border-l border-gray-200">
                                <div className="text-right">
                                    <p className="font-black text-slate-800 text-sm leading-tight">{user.name}</p>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{user.isHospital ? 'Hospital Staff' : 'Store Cashier'}</p>
                                </div>
                                <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${user.isHospital ? 'from-blue-500 to-indigo-600' : 'from-green-500 to-emerald-600'} flex items-center justify-center text-white font-black shadow-lg shadow-blue-500/10`}>
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
        </SettingsProvider>
    );
}
