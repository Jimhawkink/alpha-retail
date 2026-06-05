'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';

export interface Outlet {
    outlet_id: number;
    outlet_name: string;
    outlet_code: string;
    address: string;
    city: string;
    phone: string;
    is_main: boolean;
    active: boolean;
    enable_expiry_tracking?: boolean;
    allowed_quick_actions?: Record<string, boolean>;
    mpesa_api_url?:          string | null;
    mpesa_anon_key?:         string | null;
    mpesa_shortcode?:        string | null;
    mpesa_passkey?:          string | null;
    mpesa_consumer_key?:     string | null;
    mpesa_consumer_secret?:  string | null;
    mpesa_callback_url?:     string | null;
    mpesa_use_system?:       boolean | null;
    db_schema?:              string | null;
}

interface OutletContextType {
    activeOutlet: Outlet | null;
    outlets: Outlet[];       // ← filtered to user's assigned outlet(s) for non-admins
    isMainOutlet: boolean;
    expiryEnabled: boolean;
    switchOutlet: (outletId: number) => void;
    reloadOutlets: () => Promise<void>;
    outletFilter: (query: any) => any;
}

const OutletContext = createContext<OutletContextType>({
    activeOutlet: null,
    outlets: [],
    isMainOutlet: false,
    expiryEnabled: false,
    switchOutlet: () => { },
    reloadOutlets: async () => { },
    outletFilter: (q: any) => q,
});

export const useOutlet = () => useContext(OutletContext);

// ── Roles that can see ALL outlets ──────────────────────────────────────────
const MULTI_OUTLET_ROLES = ['super admin', 'superadmin', 'manager'];

export function OutletProvider({ children }: { children: ReactNode }) {
    const [activeOutlet, setActiveOutlet] = useState<Outlet | null>(null);
    const [outlets, setOutlets] = useState<Outlet[]>([]);

    const loadOutlets = useCallback(async () => {
        try {
            // Load all active outlets from DB
            const { data: allOutlets, error } = await supabase
                .from('retail_outlets')
                .select('*')
                .eq('active', true)
                .order('is_main', { ascending: false })
                .order('outlet_name');
            if (error) throw error;

            // ── User-outlet restriction ──────────────────────────────────
            let visibleOutlets = allOutlets || [];
            try {
                const raw = localStorage.getItem('user');
                if (raw) {
                    const user = JSON.parse(raw);
                    const userType = (user.userType || user.user_type || '').toLowerCase();
                    const isPrivileged = MULTI_OUTLET_ROLES.some(r => userType.includes(r));

                    if (!isPrivileged && user.userId) {
                        // Look up assigned outlet in license_settings
                        const { data: setting } = await supabase
                            .from('license_settings')
                            .select('setting_value')
                            .eq('setting_key', `user_outlet_${user.userId}`)
                            .single();

                        if (setting?.setting_value) {
                            const assignedId = parseInt(setting.setting_value);
                            const assigned = visibleOutlets.filter(o => o.outlet_id === assignedId);
                            if (assigned.length > 0) visibleOutlets = assigned;
                        }
                    }
                }
            } catch {
                // If user parse fails, show all outlets
            }

            setOutlets(visibleOutlets);

            // Restore active outlet from localStorage (must be in visible list)
            const savedOutletId = localStorage.getItem('activeOutletId');
            if (savedOutletId) {
                const found = visibleOutlets.find(o => o.outlet_id === parseInt(savedOutletId));
                if (found) { setActiveOutlet(found); return; }
            }
            // Default to first visible outlet
            if (visibleOutlets.length > 0) {
                const main = visibleOutlets.find(o => o.is_main) || visibleOutlets[0];
                setActiveOutlet(main);
                localStorage.setItem('activeOutletId', String(main.outlet_id));
                localStorage.setItem('activeOutletName', main.outlet_name);
            }
        } catch (err) {
            console.error('Failed to load outlets:', err);
            const fallback: Outlet = {
                outlet_id: 1, outlet_name: 'Main Outlet', outlet_code: 'MAIN',
                address: '', city: '', phone: '', is_main: true, active: true,
            };
            setOutlets([fallback]);
            setActiveOutlet(fallback);
        }
    }, []);

    useEffect(() => { loadOutlets(); }, [loadOutlets]);

    const switchOutlet = (outletId: number) => {
        const outlet = outlets.find(o => o.outlet_id === outletId);
        if (outlet) {
            setActiveOutlet(outlet);
            localStorage.setItem('activeOutletId', String(outlet.outlet_id));
            localStorage.setItem('activeOutletName', outlet.outlet_name);
        }
    };

    const outletFilter = (query: any) => {
        if (activeOutlet) return query.eq('outlet_id', activeOutlet.outlet_id);
        return query;
    };

    return (
        <OutletContext.Provider value={{
            activeOutlet,
            outlets,
            isMainOutlet: activeOutlet?.is_main ?? false,
            expiryEnabled: activeOutlet?.enable_expiry_tracking ?? false,
            switchOutlet,
            reloadOutlets: loadOutlets,
            outletFilter,
        }}>
            {children}
        </OutletContext.Provider>
    );
}
