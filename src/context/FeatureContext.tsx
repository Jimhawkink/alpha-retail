'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useOutlet } from './OutletContext';

export const ALL_FEATURES = [
    { key: 'advanced_analytics',   label: 'Advanced Analytics',     description: 'Profit margin, return rate, hourly heatmap, top debtors, cashier leaderboard', category: 'Dashboard' },
    { key: 'sales_returns',        label: 'Sales Returns',           description: 'Allow staff to process sales returns and refunds', category: 'Sales' },
    { key: 'credit_module',        label: 'Credit Module',           description: 'Credit customers, payments, statements', category: 'Finance' },
    { key: 'purchase_management',  label: 'Purchase Management',     description: 'Purchase entry, records, returns', category: 'Purchases' },
    { key: 'hr_payroll',           label: 'HR & Payroll',            description: 'Payroll, advances, shift management', category: 'HR' },
    { key: 'financial_reports',    label: 'Financial Reports',       description: 'P&L report, trial balance, balance sheet', category: 'Reports' },
    { key: 'inventory_management', label: 'Inventory Management',    description: 'Stock transfer, movement, expiry register', category: 'Inventory' },
    { key: 'promotions_loyalty',   label: 'Promotions & Loyalty',    description: 'Promotions engine, loyalty points', category: 'Operations' },
    { key: 'smart_insights',       label: 'Smart Insights AI',       description: 'AI-powered business intelligence', category: 'Operations' },
    { key: 'outlet_comparison',    label: 'Outlet Comparison',       description: 'Compare performance across outlets', category: 'Reports' },
];

interface FeatureCtx { features: Set<string>; loading: boolean; hasFeature: (key: string) => boolean; }
const FeatureContext = createContext<FeatureCtx>({ features: new Set(), loading: true, hasFeature: () => false });

export function FeatureProvider({ children }: { children: React.ReactNode }) {
    const { activeOutlet } = useOutlet();
    const [features, setFeatures] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        const outletId = activeOutlet?.outlet_id;
        if (!outletId) { setLoading(false); return; }
        (async () => {
            setLoading(true);
            const { data } = await supabase.from('retail_outlet_features').select('feature_key').eq('outlet_id', outletId).eq('enabled', true);
            setFeatures(new Set((data || []).map((r: any) => r.feature_key)));
            setLoading(false);
        })();
    }, [activeOutlet?.outlet_id]);
    return (
        <FeatureContext.Provider value={{ features, loading, hasFeature: (k) => features.has(k) }}>
            {children}
        </FeatureContext.Provider>
    );
}
export function useFeatures() { return useContext(FeatureContext); }