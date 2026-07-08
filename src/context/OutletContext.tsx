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
    email?: string;
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

            let visibleOutlets = allOutlets || [];

            // ── Per-user outlet restriction ──────────────────────────────
            // Priority: explicit assignment in license_settings ALWAYS wins,
            // regardless of role. This allows a manager to be scoped to 1
            // outlet (Dusit) while another manager has [Main, Chebunyo].
            // Only falls back to "show all" if NO assignment is set.
            try {
                const raw = localStorage.getItem('user');
                if (raw) {
                    const user = JSON.parse(raw);
                    const userType = (user.userType || user.user_type || '').toLowerCase();
                    const isSuperAdmin = userType.includes('superadmin') || userType.includes('super admin') || userType.includes('superuser');

                    if (user.userId) {
                        // Always check for an explicit assignment first
                        const { data: setting } = await supabase
                            .from('license_settings')
                            .select('setting_value')
                            .eq('setting_key', `user_outlet_${user.userId}`)
                            .single();

                        if (setting?.setting_value) {
                            // ── Explicit assignment exists → ENFORCE IT ──
                            try {
                                const val = setting.setting_value.trim();
                                let assignedIds: number[] = [];
                                if (val.startsWith('[')) {
                                    assignedIds = JSON.parse(val);
                                } else {
                                    const n = parseInt(val);
                                    if (!isNaN(n)) assignedIds = [n];
                                }
                                if (assignedIds.length > 0) {
                                    const assigned = visibleOutlets.filter(o => assignedIds.includes(o.outlet_id));
                                    if (assigned.length > 0) visibleOutlets = assigned;
                                }
                            } catch {
                                // parse failed — show all as fallback
                            }
                        } else if (!isSuperAdmin) {
                            // ── No assignment + not superadmin → show all ──
                            // (backward compatibility: existing non-assigned
                            //  managers/admins keep seeing all outlets)
                        }
                        // ── No assignment + superadmin → show all (default) ──
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
