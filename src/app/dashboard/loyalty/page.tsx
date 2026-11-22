'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useOutlet } from '@/context/OutletContext';
import { useCompanyName } from '@/context/SettingsContext';
import toast, { Toaster } from 'react-hot-toast';
import {
  FiAward,
  FiStar,
  FiGift,
  FiUsers,
  FiTrendingUp,
  FiDollarSign,
  FiPercent,
  FiDownload,
  FiPrinter,
  FiRefreshCw,
  FiSearch,
  FiFilter,
  FiCalendar,
  FiChevronLeft,
  FiChevronRight,
  FiChevronsLeft,
  FiChevronsRight,
  FiPackage,
  FiCheckCircle,
  FiXCircle,
  FiActivity,
  FiFileText,
  FiSliders,
  FiPlus,
  FiCreditCard,
  FiUserCheck,
  FiUserPlus,
  FiShoppingBag,
  FiClock,
  FiShield,
  FiEdit3,
} from 'react-icons/fi';

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

/* ══════════════════════════════════════════════════════════════════════════════
   TYPES & INTERFACES
   ══════════════════════════════════════════════════════════════════════════════ */
interface LoyaltyCustomer {
  customer_id: number;
  customer_code: string;
  name: string;
  phone: string;
  email: string;
  points: number;
  bonus_points: number;
  redeemed_points: number;
  total_spent: number;
  visits: number;
  last_visit: string | null;
  join_date: string;
  tier: string;
}

interface LoyaltyTxn {
  txn_id: string | number;
  customer_id: number;
  customer_name: string;
  customer_phone?: string;
  txn_type: 'earn' | 'redeem' | 'bonus' | 'adjustment';
  points: number;
  kush_value?: number;
  description: string;
  receipt_no?: string;
  created_at: string;
  created_by?: string;
}

interface LoyaltyConfig {
  earn_rate: number;      // e.g. 100 -> 1 pt per 100 Ksh
  redeem_rate: number;    // e.g. 1.0 -> 1 pt = 1 Ksh
  min_redeem: number;     // e.g. 100 pts minimum
  bronze_min: number;     // 0
  silver_min: number;     // 1000
  gold_min: number;       // 5000
  platinum_min: number;   // 20000
}

interface RewardItem {
  id: string;
  title: string;
  description: string;
  points_cost: number;
  discount_value: number;
  badge: string;
  icon: string;
}

/* ══════════════════════════════════════════════════════════════════════════════
   TIER DEFINITIONS & FORMATTERS
   ══════════════════════════════════════════════════════════════════════════════ */
const DEFAULT_CONFIG: LoyaltyConfig = {
  earn_rate: 100,
  redeem_rate: 1.0,
  min_redeem: 100,
  bronze_min: 0,
  silver_min: 1000,
  gold_min: 5000,
  platinum_min: 20000,
};

const getTiers = (cfg: LoyaltyConfig) => [
  { name: 'Bronze', min: cfg.bronze_min, max: cfg.silver_min - 1, color: 'text-amber-800', bg: 'bg-amber-100', border: 'border-amber-300', icon: '🥉' },
  { name: 'Silver', min: cfg.silver_min, max: cfg.gold_min - 1, color: 'text-slate-700', bg: 'bg-slate-200', border: 'border-slate-300', icon: '🥈' },
  { name: 'Gold', min: cfg.gold_min, max: cfg.platinum_min - 1, color: 'text-yellow-800', bg: 'bg-yellow-200', border: 'border-yellow-400', icon: '🥇' },
  { name: 'Platinum', min: cfg.platinum_min, max: Infinity, color: 'text-violet-800', bg: 'bg-violet-200', border: 'border-violet-400', icon: '💎' },
];

const CATALOG_REWARDS: RewardItem[] = [
  { id: 'vch_100', title: 'Ksh 100 Shopping Voucher', description: 'Redeemable on any retail item across the store', points_cost: 100, discount_value: 100, badge: 'Standard', icon: '🎟️' },
  { id: 'vch_250', title: 'Ksh 250 Cash Discount', description: 'Immediate cashier discount on current checkout bill', points_cost: 250, discount_value: 250, badge: 'Popular', icon: '🏷️' },
  { id: 'vch_500', title: 'Ksh 500 Super Saver Voucher', description: 'Valid on purchases above Ksh 1,000', points_cost: 500, discount_value: 500, badge: 'High Value', icon: '💳' },
  { id: 'vch_1000', title: 'Ksh 1,000 VIP Store Credit', description: 'Exclusive store credit for premium loyal members', points_cost: 1000, discount_value: 1000, badge: 'VIP Pass', icon: '👑' },
  { id: 'vch_2500', title: 'Ksh 2,500 Platinum Gift Card', description: 'Ultimate reward voucher for high-tier shoppers', points_cost: 2500, discount_value: 2500, badge: 'Platinum', icon: '💎' },
  { id: 'pct_5', title: '5% Instant Bill Discount', description: 'Applicable to full cart value on today checkout', points_cost: 200, discount_value: 200, badge: 'Percent Off', icon: '⚡' },
];

const fmtKES = (n: any) => {
  const num = typeof n === 'number' ? n : parseFloat(n) || 0;
  return `Ksh ${Math.round(num).toLocaleString('en-KE')}`;
};

const fmtK = (n: any) => {
  const num = typeof n === 'number' ? n : parseFloat(n) || 0;
  if (Math.abs(num) >= 1_000_000) return `Ksh ${(num / 1_000_000).toFixed(2)}M`;
  if (Math.abs(num) >= 1_000) return `Ksh ${(num / 1_000).toFixed(1)}K`;
  return `Ksh ${Math.round(num).toLocaleString('en-KE')}`;
};

const fmtN = (n: any) => {
  const num = typeof n === 'number' ? n : parseFloat(n) || 0;
  return num.toLocaleString('en-KE');
};

const formatDate = (val: string | null | undefined) => {
  if (!val) return '—';
  try {
    return new Date(val).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return val;
  }
};

const PALETTE = ['#F59E0B', '#94A3B8', '#EAB308', '#8B5CF6'];

export default function LoyaltyStudioPage() {
  const { activeOutlet, outlets, switchOutlet } = useOutlet();
  const companyName = useCompanyName();
  const outletId = activeOutlet?.outlet_id || 1;

  // Primary State
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'members' | 'ledger' | 'analytics' | 'rewards' | 'config'>('members');
  const [config, setConfig] = useState<LoyaltyConfig>(DEFAULT_CONFIG);

  // Members & Transactions
  const [members, setMembers] = useState<LoyaltyCustomer[]>([]);
  const [ledger, setLedger] = useState<LoyaltyTxn[]>([]);
  const [selectedMember, setSelectedMember] = useState<LoyaltyCustomer | null>(null);

  // Filters & Pagination for Members
  const [memberSearch, setMemberSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('All');
  const [memberSort, setMemberSort] = useState<'points' | 'spent' | 'visits' | 'recent'>('points');
  const [memberPage, setMemberPage] = useState(1);
  const [memberPerPage, setMemberPerPage] = useState(15);

  // Filters & Pagination for Ledger
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [ledgerTypeFilter, setLedgerTypeFilter] = useState('ALL');
  const [ledgerPage, setLedgerPage] = useState(1);
  const [ledgerPerPage, setLedgerPerPage] = useState(20);

  // Modals
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustTarget, setAdjustTarget] = useState<LoyaltyCustomer | null>(null);
  const [adjustType, setAdjustType] = useState<'earn' | 'redeem' | 'bonus'>('bonus');
  const [adjustPoints, setAdjustPoints] = useState<number | ''>('');
  const [adjustReason, setAdjustReason] = useState('');
  const [isSubmittingAdjust, setIsSubmittingAdjust] = useState(false);

  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [enrollForm, setEnrollForm] = useState({ name: '', phone: '', email: '', initialPoints: 0 });
  const [isEnrolling, setIsEnrolling] = useState(false);

  const [showRedeemModal, setShowRedeemModal] = useState(false);
  const [redeemTarget, setRedeemTarget] = useState<LoyaltyCustomer | null>(null);
  const [selectedReward, setSelectedReward] = useState<RewardItem | null>(null);
  const [isRedeeming, setIsRedeeming] = useState(false);

  const [configDraft, setConfigDraft] = useState<LoyaltyConfig>(DEFAULT_CONFIG);
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  const tiers = useMemo(() => getTiers(config), [config]);

  const resolveTier = useCallback(
    (points: number) => {
      const match = tiers.find((t) => points >= t.min && points <= t.max);
      return match || tiers[0];
    },
    [tiers]
  );

  /* ─────────────────────────────────────────────────────────────────────────
     LOAD COMPLETE DATA FROM SUPABASE
     ───────────────────────────────────────────────────────────────────────── */
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch Config from retail_settings
      const { data: cfgRow } = await supabase
        .from('retail_settings')
        .select('setting_value')
        .eq('setting_key', 'loyalty_config')
        .maybeSingle();

      let activeConfig = DEFAULT_CONFIG;
      if (cfgRow?.setting_value) {
        try {
          activeConfig = { ...DEFAULT_CONFIG, ...JSON.parse(cfgRow.setting_value) };
        } catch (e) {
          console.warn('Failed to parse loyalty_config:', e);
        }
      }
      setConfig(activeConfig);
      setConfigDraft(activeConfig);

      // 2. Fetch Ledger from retail_settings
      const { data: ledgerRow } = await supabase
        .from('retail_settings')
        .select('setting_value')
        .eq('setting_key', 'loyalty_ledger')
        .maybeSingle();

      let savedLedger: LoyaltyTxn[] = [];
      if (ledgerRow?.setting_value) {
        try {
          savedLedger = JSON.parse(ledgerRow.setting_value);
        } catch (e) {
          console.warn('Failed to parse loyalty_ledger:', e);
        }
      }

      // 3. Fetch Customers from retail_credit_customers
      let qCust = supabase.from('retail_credit_customers').select('*');
      if (outletId) qCust = qCust.eq('outlet_id', outletId);
      const { data: creditCusts, error: custErr } = await qCust;
      if (custErr) console.warn('Credit customers error:', custErr);

      // 4. Fetch Sales from retail_sales to compute live spend and visits
      let qSales = supabase
        .from('retail_sales')
        .select('sale_id, customer_id, customer_name, customer_phone, total_amount, sale_datetime, receipt_no');
      if (outletId) qSales = qSales.eq('outlet_id', outletId);
      const { data: salesData, error: salesErr } = await qSales;
      if (salesErr) console.warn('Sales fetch error:', salesErr);

      // Group sales by customer_id and customer_name
      const salesByCustId = new Map<number, { spent: number; visits: number; lastDate: string }>();
      const salesByCustName = new Map<string, { spent: number; visits: number; lastDate: string }>();

      (salesData || []).forEach((s) => {
        const amt = Number(s.total_amount) || 0;
        const sDate = s.sale_datetime || '';

        if (s.customer_id) {
          const cur = salesByCustId.get(s.customer_id) || { spent: 0, visits: 0, lastDate: '' };
          cur.spent += amt;
          cur.visits += 1;
          if (!cur.lastDate || sDate > cur.lastDate) cur.lastDate = sDate;
          salesByCustId.set(s.customer_id, cur);
        }

        if (s.customer_name && s.customer_name.trim().toLowerCase() !== 'walk-in customer') {
          const key = s.customer_name.trim().toLowerCase();
          const cur = salesByCustName.get(key) || { spent: 0, visits: 0, lastDate: '' };
          cur.spent += amt;
          cur.visits += 1;
          if (!cur.lastDate || sDate > cur.lastDate) cur.lastDate = sDate;
          salesByCustName.set(key, cur);
        }
      });

      // Sum adjustments per customer from ledger
      const ledgerByCust = new Map<number, { bonus: number; redeemed: number; txns: LoyaltyTxn[] }>();
      savedLedger.forEach((t) => {
        const cur = ledgerByCust.get(t.customer_id) || { bonus: 0, redeemed: 0, txns: [] };
        if (t.txn_type === 'bonus' || t.txn_type === 'earn') cur.bonus += t.points;
        if (t.txn_type === 'redeem') cur.redeemed += t.points;
        cur.txns.push(t);
        ledgerByCust.set(t.customer_id, cur);
      });

      // Merge and construct full member roster
      const compiledMembers: LoyaltyCustomer[] = (creditCusts || []).map((c) => {
        const byId = salesByCustId.get(c.customer_id);
        const byName = salesByCustName.get((c.customer_name || '').trim().toLowerCase());
        const totalSpent = (byId?.spent || 0) + (byName?.spent || 0);
        const visits = (byId?.visits || 0) + (byName?.visits || 0);
        const lastVisit = byId?.lastDate || byName?.lastDate || null;

        // Parse existing loyalty tag from notes if any
        let notesBonus = 0;
        let notesRedeemed = 0;
        if (c.notes && c.notes.includes('[LOYALTY:')) {
          try {
            const m = c.notes.match(/\[LOYALTY:(\{.*?\})\]/);
            if (m && m[1]) {
              const parsed = JSON.parse(m[1]);
              notesBonus = parsed.bonus || 0;
              notesRedeemed = parsed.redeemed || 0;
            }
          } catch (e) {
            // ignore
          }
        }

        const lEntry = ledgerByCust.get(c.customer_id);
        const bonusPoints = (lEntry?.bonus || 0) + notesBonus;
        const redeemedPoints = (lEntry?.redeemed || 0) + notesRedeemed;

        // Base points earned from spend
        const spendEarnedPoints = Math.floor(totalSpent / (activeConfig.earn_rate || 100));
        const netPoints = Math.max(0, spendEarnedPoints + bonusPoints - redeemedPoints);

        const currentTier = getTiers(activeConfig).find((t) => netPoints >= t.min && netPoints <= t.max)?.name || 'Bronze';

        return {
          customer_id: c.customer_id,
          customer_code: c.customer_code || `CUST-${c.customer_id}`,
          name: c.customer_name || 'Valued Member',
          phone: c.phone || '—',
          email: c.email || '—',
          points: netPoints,
          bonus_points: bonusPoints,
          redeemed_points: redeemedPoints,
          total_spent: totalSpent,
          visits: visits,
          last_visit: lastVisit,
          join_date: c.created_at?.slice(0, 10) || new Date().toISOString().slice(0, 10),
          tier: currentTier,
        };
      });

      setMembers(compiledMembers);
      setLedger(savedLedger);
      if (selectedMember) {
        const updated = compiledMembers.find((m) => m.customer_id === selectedMember.customer_id);
        if (updated) setSelectedMember(updated);
      }
    } catch (err: any) {
      console.error('Error loading loyalty telemetry:', err);
      toast.error('Failed to load loyalty telemetry: ' + (err.message || ''));
    } finally {
      setLoading(false);
    }
  }, [outletId, selectedMember]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /* ─────────────────────────────────────────────────────────────────────────
     KPI COMPUTATIONS
     ───────────────────────────────────────────────────────────────────────── */
  const totalMembers = members.length;
  const totalPointsOutstanding = useMemo(() => members.reduce((sum, m) => sum + m.points, 0), [members]);
  const totalPointsRedeemed = useMemo(() => members.reduce((sum, m) => sum + m.redeemed_points, 0), [members]);
  const totalPointsIssued = totalPointsOutstanding + totalPointsRedeemed;
  const totalLoyaltySpend = useMemo(() => members.reduce((sum, m) => sum + m.total_spent, 0), [members]);
  const avgSpendPerMember = totalMembers > 0 ? totalLoyaltySpend / totalMembers : 0;
  const pointLiabilityKsh = totalPointsOutstanding * (config.redeem_rate || 1.0);
  const redemptionRatePct = totalPointsIssued > 0 ? (totalPointsRedeemed / totalPointsIssued) * 100 : 0;

  // Tier Counts
  const tierCounts = useMemo(() => {
    return tiers.map((t) => ({
      ...t,
      count: members.filter((m) => m.tier === t.name).length,
      pct: totalMembers > 0 ? (members.filter((m) => m.tier === t.name).length / totalMembers) * 100 : 0,
    }));
  }, [tiers, members, totalMembers]);

  /* ─────────────────────────────────────────────────────────────────────────
     FILTERED MEMBERS & PAGINATION
     ───────────────────────────────────────────────────────────────────────── */
  const filteredMembers = useMemo(() => {
    return members
      .filter((m) => {
        const matchSearch =
          !memberSearch.trim() ||
          m.name.toLowerCase().includes(memberSearch.toLowerCase()) ||
          m.phone.includes(memberSearch) ||
          m.customer_code.toLowerCase().includes(memberSearch.toLowerCase());
        const matchTier = tierFilter === 'All' || m.tier === tierFilter;
        return matchSearch && matchTier;
      })
      .sort((a, b) => {
        if (memberSort === 'points') return b.points - a.points;
        if (memberSort === 'spent') return b.total_spent - a.total_spent;
        if (memberSort === 'visits') return b.visits - a.visits;
        if (memberSort === 'recent') return (b.last_visit || '').localeCompare(a.last_visit || '');
        return 0;
      });
  }, [members, memberSearch, tierFilter, memberSort]);

  const totalMemberPages = Math.max(1, Math.ceil(filteredMembers.length / memberPerPage));
  const paginatedMembers = useMemo(() => {
    const start = (memberPage - 1) * memberPerPage;
    return filteredMembers.slice(start, start + memberPerPage);
  }, [filteredMembers, memberPage, memberPerPage]);

  /* ─────────────────────────────────────────────────────────────────────────
     FILTERED LEDGER & PAGINATION
     ───────────────────────────────────────────────────────────────────────── */
  const filteredLedger = useMemo(() => {
    return ledger.filter((t) => {
      const matchSearch =
        !ledgerSearch.trim() ||
        t.customer_name.toLowerCase().includes(ledgerSearch.toLowerCase()) ||
        t.description.toLowerCase().includes(ledgerSearch.toLowerCase()) ||
        (t.receipt_no && t.receipt_no.toLowerCase().includes(ledgerSearch.toLowerCase()));
      const matchType = ledgerTypeFilter === 'ALL' || t.txn_type === ledgerTypeFilter;
      return matchSearch && matchType;
    });
  }, [ledger, ledgerSearch, ledgerTypeFilter]);

  const totalLedgerPages = Math.max(1, Math.ceil(filteredLedger.length / ledgerPerPage));
  const paginatedLedger = useMemo(() => {
    const start = (ledgerPage - 1) * ledgerPerPage;
    return filteredLedger.slice(start, start + ledgerPerPage);
  }, [filteredLedger, ledgerPage, ledgerPerPage]);

  /* ─────────────────────────────────────────────────────────────────────────
     ACTIONS: ADJUST POINTS (EARN / BONUS / REDEEM)
     ───────────────────────────────────────────────────────────────────────── */
  const handleApplyAdjustment = async () => {
    if (!adjustTarget) return;
    const pts = Number(adjustPoints);
    if (!pts || pts <= 0) {
      toast.error('Please enter a valid positive points quantity');
      return;
    }
    if (!adjustReason.trim()) {
      toast.error('Please provide a reason or reference for this adjustment');
      return;
    }
    if (adjustType === 'redeem' && pts > adjustTarget.points) {
      toast.error(`Customer only has ${adjustTarget.points} points available to redeem`);
      return;
    }

    setIsSubmittingAdjust(true);
    try {
      const newTxn: LoyaltyTxn = {
        txn_id: Date.now(),
        customer_id: adjustTarget.customer_id,
        customer_name: adjustTarget.name,
        customer_phone: adjustTarget.phone,
        txn_type: adjustType,
        points: pts,
        kush_value: pts * (config.redeem_rate || 1.0),
        description: adjustReason.trim(),
        created_at: new Date().toISOString(),
        created_by: 'Admin Staff',
      };

      const updatedLedger = [newTxn, ...ledger];

      // Save updated ledger to retail_settings
      await supabase.from('retail_settings').upsert(
        {
          setting_key: 'loyalty_ledger',
          setting_value: JSON.stringify(updatedLedger.slice(0, 2000)),
          description: 'Loyalty points transactions audit ledger',
        },
        { onConflict: 'setting_key' }
      );

      // Save customer note update in retail_credit_customers
      const deltaBonus = adjustType === 'redeem' ? 0 : pts;
      const deltaRedeem = adjustType === 'redeem' ? pts : 0;
      const newBonus = adjustTarget.bonus_points + deltaBonus;
      const newRedeemed = adjustTarget.redeemed_points + deltaRedeem;

      const noteTag = `[LOYALTY:${JSON.stringify({ bonus: newBonus, redeemed: newRedeemed, updated: new Date().toISOString() })}]`;

      // Fetch existing notes to preserve
      const { data: custRow } = await supabase
        .from('retail_credit_customers')
        .select('notes')
        .eq('customer_id', adjustTarget.customer_id)
        .maybeSingle();

      let cleanedNotes = (custRow?.notes || '').replace(/\[LOYALTY:\{.*?\}\]/g, '').trim();
      const updatedNotes = `${cleanedNotes} ${noteTag}`.trim();

      await supabase
        .from('retail_credit_customers')
        .update({ notes: updatedNotes })
        .eq('customer_id', adjustTarget.customer_id);

      toast.success(
        `Successfully ${adjustType === 'redeem' ? 'redeemed' : 'credited'} ${pts.toLocaleString()} points for ${adjustTarget.name}! ⭐`
      );

      setShowAdjustModal(false);
      setAdjustPoints('');
      setAdjustReason('');
      await loadData();
    } catch (err: any) {
      console.error('Error applying point adjustment:', err);
      toast.error('Failed to update points: ' + (err.message || ''));
    } finally {
      setIsSubmittingAdjust(false);
    }
  };

  /* ─────────────────────────────────────────────────────────────────────────
     ACTIONS: ENROLL NEW MEMBER
     ───────────────────────────────────────────────────────────────────────── */
  const handleEnrollMember = async () => {
    if (!enrollForm.name.trim()) {
      toast.error('Customer name is required');
      return;
    }
    if (!enrollForm.phone.trim()) {
      toast.error('Phone number is required for loyalty identification');
      return;
    }

    setIsEnrolling(true);
    try {
      // Find max customer_id
      const { data: mxRow } = await supabase
        .from('retail_credit_customers')
        .select('customer_id')
        .order('customer_id', { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextId = (mxRow?.customer_id || 10000) + 1;
      const nextCode = `LOYAL-${String(nextId).slice(-4)}`;
      const initPts = Number(enrollForm.initialPoints) || 0;

      const noteTag = initPts > 0 ? `[LOYALTY:${JSON.stringify({ bonus: initPts, redeemed: 0 })}]` : '';

      const { error: insErr } = await supabase.from('retail_credit_customers').insert({
        customer_id: nextId,
        customer_code: nextCode,
        customer_name: enrollForm.name.trim(),
        phone: enrollForm.phone.trim(),
        email: enrollForm.email.trim() || null,
        outlet_id: outletId,
        credit_limit: 0,
        current_balance: 0,
        active: true,
        notes: noteTag || null,
      });

      if (insErr) throw insErr;

      // If initial points given, log in ledger
      if (initPts > 0) {
        const newTxn: LoyaltyTxn = {
          txn_id: Date.now(),
          customer_id: nextId,
          customer_name: enrollForm.name.trim(),
          customer_phone: enrollForm.phone.trim(),
          txn_type: 'bonus',
          points: initPts,
          kush_value: initPts * (config.redeem_rate || 1.0),
          description: 'Welcome Sign-up Bonus Points',
          created_at: new Date().toISOString(),
          created_by: 'Staff',
        };
        const updatedLedger = [newTxn, ...ledger];
        await supabase.from('retail_settings').upsert(
          {
            setting_key: 'loyalty_ledger',
            setting_value: JSON.stringify(updatedLedger.slice(0, 2000)),
            description: 'Loyalty points transactions audit ledger',
          },
          { onConflict: 'setting_key' }
        );
      }

      toast.success(`🎉 ${enrollForm.name} enrolled in loyalty program (${nextCode})!`);
      setShowEnrollModal(false);
      setEnrollForm({ name: '', phone: '', email: '', initialPoints: 0 });
      await loadData();
    } catch (err: any) {
      console.error('Error enrolling member:', err);
      toast.error('Failed to enroll member: ' + (err.message || ''));
    } finally {
      setIsEnrolling(false);
    }
  };

  /* ─────────────────────────────────────────────────────────────────────────
     ACTIONS: REDEEM REWARD VOUCHER
     ───────────────────────────────────────────────────────────────────────── */
  const handleRedeemReward = async () => {
    if (!redeemTarget || !selectedReward) return;
    if (redeemTarget.points < selectedReward.points_cost) {
      toast.error(`Insufficient points. Member has ${redeemTarget.points} pts, reward requires ${selectedReward.points_cost} pts.`);
      return;
    }

    setIsRedeeming(true);
    try {
      const vchCode = `RWD-${Math.floor(100000 + Math.random() * 900000)}`;
      const newTxn: LoyaltyTxn = {
        txn_id: Date.now(),
        customer_id: redeemTarget.customer_id,
        customer_name: redeemTarget.name,
        customer_phone: redeemTarget.phone,
        txn_type: 'redeem',
        points: selectedReward.points_cost,
        kush_value: selectedReward.discount_value,
        description: `Redeemed ${selectedReward.title} (Code: ${vchCode})`,
        receipt_no: vchCode,
        created_at: new Date().toISOString(),
        created_by: 'Rewards Studio',
      };

      const updatedLedger = [newTxn, ...ledger];
      await supabase.from('retail_settings').upsert(
        {
          setting_key: 'loyalty_ledger',
          setting_value: JSON.stringify(updatedLedger.slice(0, 2000)),
          description: 'Loyalty points transactions audit ledger',
        },
        { onConflict: 'setting_key' }
      );

      // Update notes
      const newRedeemed = redeemTarget.redeemed_points + selectedReward.points_cost;
      const noteTag = `[LOYALTY:${JSON.stringify({ bonus: redeemTarget.bonus_points, redeemed: newRedeemed })}]`;

      const { data: custRow } = await supabase
        .from('retail_credit_customers')
        .select('notes')
        .eq('customer_id', redeemTarget.customer_id)
        .maybeSingle();

      let cleanedNotes = (custRow?.notes || '').replace(/\[LOYALTY:\{.*?\}\]/g, '').trim();
      const updatedNotes = `${cleanedNotes} ${noteTag}`.trim();

      await supabase
        .from('retail_credit_customers')
        .update({ notes: updatedNotes })
        .eq('customer_id', redeemTarget.customer_id);

      toast.success(`🎁 Voucher ${vchCode} issued! Ksh ${selectedReward.discount_value} discount granted.`);
      setShowRedeemModal(false);
      setSelectedReward(null);
      await loadData();
    } catch (err: any) {
      console.error('Error redeeming reward:', err);
      toast.error('Failed to redeem reward: ' + (err.message || ''));
    } finally {
      setIsRedeeming(false);
    }
  };

  /* ─────────────────────────────────────────────────────────────────────────
     ACTIONS: SAVE CONFIGURATION
     ───────────────────────────────────────────────────────────────────────── */
  const handleSaveConfig = async () => {
    setIsSavingConfig(true);
    try {
      await supabase.from('retail_settings').upsert(
        {
          setting_key: 'loyalty_config',
          setting_value: JSON.stringify(configDraft),
          description: 'Loyalty program configuration',
        },
        { onConflict: 'setting_key' }
      );
      setConfig(configDraft);
      toast.success('Loyalty program rules & tier thresholds updated successfully! ✓');
      await loadData();
    } catch (err: any) {
      console.error('Error saving config:', err);
      toast.error('Failed to save config: ' + (err.message || ''));
    } finally {
      setIsSavingConfig(false);
    }
  };

  /* ─────────────────────────────────────────────────────────────────────────
     MULTI-SHEET EXCEL EXPORT (.XLSX)
     ───────────────────────────────────────────────────────────────────────── */
  const exportExcel = async () => {
    try {
      const XLSX = (await import('xlsx-js-style')).default || (await import('xlsx-js-style'));
      const wb = XLSX.utils.book_new();

      const titleHeader = `${(companyName || 'ALPHA RETAIL').toUpperCase()} — ${(activeOutlet?.outlet_name || 'MAIN OUTLET').toUpperCase()}`;

      // ── SHEET 1: Loyalty Member Directory ──
      const s1Data: any[][] = [];
      s1Data.push([titleHeader]);
      s1Data.push(['CUSTOMER LOYALTY & RETENTION DIRECTORY']);
      s1Data.push([`Generated: ${new Date().toLocaleString('en-GB')}`]);
      s1Data.push([]);
      s1Data.push(['CODE', 'MEMBER NAME', 'PHONE', 'EMAIL', 'TIER', 'POINTS BALANCE', 'REDEMPTION VALUE (KSH)', 'TOTAL SPENT (KSH)', 'TOTAL VISITS', 'LAST VISIT']);

      members.forEach((m) => {
        s1Data.push([
          m.customer_code,
          m.name,
          m.phone,
          m.email,
          m.tier,
          m.points,
          m.points * (config.redeem_rate || 1.0),
          m.total_spent,
          m.visits,
          m.last_visit ? formatDate(m.last_visit) : 'Never',
        ]);
      });

      const ws1 = XLSX.utils.aoa_to_sheet(s1Data);
      ws1['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 9 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 9 } },
      ];
      ws1['!cols'] = [{ wch: 14 }, { wch: 24 }, { wch: 15 }, { wch: 22 }, { wch: 12 }, { wch: 16 }, { wch: 22 }, { wch: 18 }, { wch: 14 }, { wch: 15 }];
      XLSX.utils.book_append_sheet(wb, ws1, 'Members Directory');

      // ── SHEET 2: Points Activity Ledger ──
      const s2Data: any[][] = [];
      s2Data.push([titleHeader]);
      s2Data.push(['POINTS TRANSACTION & AUDIT LEDGER']);
      s2Data.push([]);
      s2Data.push(['DATE & TIME', 'MEMBER NAME', 'PHONE', 'TYPE', 'POINTS DELTA', 'KSH VALUE', 'DESCRIPTION / REASON', 'RECEIPT REF', 'STAFF']);

      ledger.forEach((t) => {
        s2Data.push([
          formatDate(t.created_at),
          t.customer_name,
          t.customer_phone || '—',
          t.txn_type.toUpperCase(),
          t.txn_type === 'redeem' ? -t.points : t.points,
          t.kush_value || t.points,
          t.description,
          t.receipt_no || '—',
          t.created_by || 'Staff',
        ]);
      });

      const ws2 = XLSX.utils.aoa_to_sheet(s2Data);
      ws2['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 8 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 8 } },
      ];
      ws2['!cols'] = [{ wch: 15 }, { wch: 24 }, { wch: 15 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 32 }, { wch: 16 }, { wch: 16 }];
      XLSX.utils.book_append_sheet(wb, ws2, 'Points Ledger');

      // ── SHEET 3: Tier Distribution & Program KPIs ──
      const s3Data: any[][] = [];
      s3Data.push([titleHeader]);
      s3Data.push(['TIER DISTRIBUTION & RETENTION KPIS']);
      s3Data.push([]);
      s3Data.push(['TIER NAME', 'MIN POINTS', 'MEMBER COUNT', '% OF BASE', 'AVG POINTS IN TIER']);

      tierCounts.forEach((tc) => {
        const tierMembers = members.filter((m) => m.tier === tc.name);
        const avgPts = tierMembers.length > 0 ? Math.round(tierMembers.reduce((s, m) => s + m.points, 0) / tierMembers.length) : 0;
        s3Data.push([tc.name, tc.min, tc.count, `${tc.pct.toFixed(1)}%`, avgPts]);
      });

      s3Data.push([]);
      s3Data.push(['EXECUTIVE KPI SUMMARY']);
      s3Data.push(['Total Enrolled Members', totalMembers]);
      s3Data.push(['Total Points Outstanding', totalPointsOutstanding]);
      s3Data.push(['Total Point Liability (Ksh)', pointLiabilityKsh]);
      s3Data.push(['Total Loyalty Spend Generated (Ksh)', totalLoyaltySpend]);
      s3Data.push(['All-Time Points Redeemed', totalPointsRedeemed]);
      s3Data.push(['Redemption Rate %', `${redemptionRatePct.toFixed(1)}%`]);

      const ws3 = XLSX.utils.aoa_to_sheet(s3Data);
      ws3['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } },
      ];
      ws3['!cols'] = [{ wch: 20 }, { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 20 }];
      XLSX.utils.book_append_sheet(wb, ws3, 'Tier Analytics');

      XLSX.writeFile(wb, `Loyalty_Studio_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success('Ultra-premium multi-sheet loyalty Excel exported! ✓');
    } catch (err: any) {
      console.error('Excel export error:', err);
      toast.error('Failed to export Excel: ' + (err.message || ''));
    }
  };

  /* ─────────────────────────────────────────────────────────────────────────
     PRINT / PDF REPORT
     ───────────────────────────────────────────────────────────────────────── */
  const printReport = () => {
    const outletName = activeOutlet?.outlet_name || 'Alpha Retail';
    const cName = companyName || 'Alpha Retail Ltd';

    const topRows = members
      .slice(0, 30)
      .map(
        (m, idx) => `
        <tr>
          <td style="text-align: center; color: #64748B;">${idx + 1}</td>
          <td><strong>${m.name}</strong><br><small style="color: #64748B;">${m.customer_code}</small></td>
          <td>${m.phone}</td>
          <td style="text-align: center;"><span style="background: #F1F5F9; padding: 2px 6px; border-radius: 4px; font-weight: bold;">${m.tier}</span></td>
          <td style="text-align: right; font-family: monospace; font-weight: bold; color: #D97706;">⭐ ${m.points.toLocaleString()}</td>
          <td style="text-align: right; font-family: monospace;">Ksh ${(m.points * (config.redeem_rate || 1.0)).toLocaleString()}</td>
          <td style="text-align: right; font-family: monospace;">Ksh ${m.total_spent.toLocaleString()}</td>
          <td style="text-align: center;">${m.visits}</td>
        </tr>`
      )
      .join('');

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Loyalty & Customer Retention Audit - ${outletName}</title>
  <style>
    @page { margin: 12mm 14mm; size: A4; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #0F172A; background: #FFF; line-height: 1.4; }
    .header { text-align: center; border-bottom: 2px solid #0F172A; padding-bottom: 12px; margin-bottom: 16px; }
    .header h1 { font-size: 18px; margin: 0; text-transform: uppercase; letter-spacing: 1.5px; }
    .header h2 { font-size: 13px; margin: 4px 0; color: #334155; font-weight: 600; }
    .kpi-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 10.5px; }
    .kpi-table td { padding: 8px 12px; border: 1px solid #E2E8F0; text-align: center; background: #F8FAFC; }
    .kpi-table .val { font-size: 14px; font-weight: 800; font-family: monospace; display: block; margin-top: 2px; color: #B45309; }
    .data-table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    .data-table th { background: #F1F5F9; border-bottom: 2px solid #CBD5E1; text-align: left; padding: 6px 8px; font-size: 10px; text-transform: uppercase; }
    .data-table td { padding: 5px 8px; border-bottom: 1px solid #E2E8F0; }
    .footer { margin-top: 24px; font-size: 9px; color: #94A3B8; text-align: center; border-top: 1px dashed #CBD5E1; padding-top: 8px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${cName}</h1>
    <h2>CUSTOMER LOYALTY &amp; RETENTION AUDIT STATEMENT</h2>
    <p>Operating Outlet: <strong>${outletName}</strong> &bull; Date: <strong>${new Date().toLocaleDateString('en-GB')}</strong></p>
  </div>

  <table class="kpi-table">
    <tr>
      <td>ACTIVE MEMBERS<span class="val">${totalMembers}</span></td>
      <td>TOTAL POINTS<span class="val">${totalPointsOutstanding.toLocaleString()}</span></td>
      <td>POINT LIABILITY<span class="val">Ksh ${pointLiabilityKsh.toLocaleString()}</span></td>
      <td>LOYALTY SPEND<span class="val">Ksh ${totalLoyaltySpend.toLocaleString()}</span></td>
      <td>REDEMPTIONS<span class="val">${redemptionRatePct.toFixed(1)}%</span></td>
    </tr>
  </table>

  <h3>Top Loyalty Members Roster</h3>
  <table class="data-table">
    <thead>
      <tr>
        <th style="width: 25px; text-align: center;">#</th>
        <th>Member Name &amp; Code</th>
        <th>Phone Number</th>
        <th style="text-align: center;">Tier</th>
        <th style="text-align: right;">Points Balance</th>
        <th style="text-align: right;">Cash Value</th>
        <th style="text-align: right;">Total Spent</th>
        <th style="text-align: center;">Visits</th>
      </tr>
    </thead>
    <tbody>
      ${topRows}
    </tbody>
  </table>

  <div class="footer">
    Official Customer Retention Audit Document &bull; Alpha Retail Enterprise POS
  </div>
</body>
</html>`;

    const printWin = window.open('', '_blank');
    if (printWin) {
      printWin.document.write(html);
      printWin.document.close();
      printWin.focus();
      setTimeout(() => printWin.print(), 350);
    }
  };

  return (
    <div className="space-y-4 pb-14 text-slate-800">
      <Toaster position="top-right" />

      {/* ══════════════════════════════════════════════════════════════════
          1. EXECUTIVE STUDIO HEADER & ACTION CONTROLS
          ══════════════════════════════════════════════════════════════════ */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 via-amber-400 to-yellow-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20 flex-shrink-0">
              <FiStar size={24} className="stroke-[2.5]" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  Customer Loyalty &amp; Rewards Studio
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200/80">
                  {totalMembers} Enrolled Members
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-100 text-slate-700 border border-slate-200">
                  {activeOutlet?.outlet_name || 'Primary Outlet'}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Automated Points Engine &bull; Tier Progression &bull; Store Credit Redemptions &bull; Spend-to-Points Telemetry
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {outlets && outlets.length > 1 && (
              <select
                value={outletId}
                onChange={(e) => switchOutlet(Number(e.target.value))}
                className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 shadow-2xs focus:ring-2 focus:ring-amber-500 cursor-pointer"
              >
                {outlets.map((o) => (
                  <option key={o.outlet_id} value={o.outlet_id}>
                    {o.outlet_name}
                  </option>
                ))}
              </select>
            )}

            <button
              onClick={() => setShowEnrollModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-2xs transition cursor-pointer"
            >
              <FiUserPlus size={13} />
              <span>Enroll Member</span>
            </button>

            <button
              onClick={() => {
                if (members.length > 0) {
                  setRedeemTarget(members[0]);
                  setShowRedeemModal(true);
                } else {
                  toast.error('No enrolled members found');
                }
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold shadow-2xs transition cursor-pointer"
            >
              <FiGift size={13} />
              <span>Redeem Points</span>
            </button>

            <button
              onClick={printReport}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-2xs transition cursor-pointer"
              title="Print Formal Loyalty Audit"
            >
              <FiPrinter size={13} />
              <span>Print</span>
            </button>

            <button
              onClick={exportExcel}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold shadow-2xs transition cursor-pointer"
              title="Export Multi-Sheet Styled Excel (.XLSX)"
            >
              <FiDownload size={13} />
              <span>Ultra Excel</span>
            </button>

            <button
              onClick={loadData}
              disabled={loading}
              className="p-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-2xs transition cursor-pointer disabled:opacity-50"
              title="Refresh Telemetry"
            >
              <FiRefreshCw size={13} className={loading ? 'animate-spin text-amber-600' : ''} />
            </button>
          </div>
        </div>

        {/* ── Tier Distribution Quick-Filter Banner ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4 pt-4 border-t border-slate-100">
          {tierCounts.map((t) => (
            <button
              key={t.name}
              onClick={() => setTierFilter(tierFilter === t.name ? 'All' : t.name)}
              className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                tierFilter === t.name
                  ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-400/30 shadow-xs'
                  : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100/80'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-extrabold flex items-center gap-1.5">
                  <span>{t.icon}</span>
                  <span className={t.color}>{t.name} Tier</span>
                </span>
                <span className="text-[10px] font-bold text-slate-400">
                  {t.min === 0 ? '0+' : `${t.min.toLocaleString()}+`} pts
                </span>
              </div>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-xl font-black text-slate-900">{t.count}</span>
                <span className="text-[10px] font-bold text-slate-500">{t.pct.toFixed(0)}% members</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          2. EXECUTIVE 8-METRIC COMMAND HUD DOCK
          ══════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        {/* KPI 1 */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-2.5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Total Members</span>
            <div className="w-5 h-5 rounded-md bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center">
              <FiUsers size={11} />
            </div>
          </div>
          <div>
            <div className="text-base font-black text-slate-900 leading-tight">{fmtN(totalMembers)}</div>
            <div className="text-[9.5px] text-slate-500 font-semibold mt-0.5 truncate">Active loyalty roster</div>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="bg-white border border-amber-200/90 rounded-2xl p-2.5 shadow-xs flex flex-col justify-between bg-gradient-to-b from-amber-50/20 to-white">
          <div className="flex items-center justify-between text-amber-700 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Points Balance</span>
            <div className="w-5 h-5 rounded-md bg-amber-100 border border-amber-200 text-amber-700 flex items-center justify-center">
              <FiStar size={11} />
            </div>
          </div>
          <div>
            <div className="text-base font-black text-amber-800 leading-tight">
              ⭐ {fmtN(totalPointsOutstanding)}
            </div>
            <div className="text-[9.5px] text-amber-700 font-semibold mt-0.5 truncate">Outstanding balance</div>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-2.5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Point Liability</span>
            <div className="w-5 h-5 rounded-md bg-rose-50 border border-rose-200 text-rose-700 flex items-center justify-center">
              <FiCreditCard size={11} />
            </div>
          </div>
          <div>
            <div className="text-base font-black text-slate-900 leading-tight">{fmtK(pointLiabilityKsh)}</div>
            <div className="text-[9.5px] text-slate-500 font-semibold mt-0.5 truncate">
              @ Ksh {config.redeem_rate}/pt value
            </div>
          </div>
        </div>

        {/* KPI 4 */}
        <div className="bg-white border border-emerald-200/90 rounded-2xl p-2.5 shadow-xs flex flex-col justify-between bg-gradient-to-b from-emerald-50/20 to-white">
          <div className="flex items-center justify-between text-emerald-700 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Loyalty Turnover</span>
            <div className="w-5 h-5 rounded-md bg-emerald-100 border border-emerald-200 text-emerald-700 flex items-center justify-center">
              <FiTrendingUp size={11} />
            </div>
          </div>
          <div>
            <div className="text-base font-black text-emerald-700 leading-tight">{fmtK(totalLoyaltySpend)}</div>
            <div className="text-[9.5px] text-emerald-600 font-semibold mt-0.5 truncate">Generated retail sales</div>
          </div>
        </div>

        {/* KPI 5 */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-2.5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Points Issued</span>
            <div className="w-5 h-5 rounded-md bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center">
              <FiAward size={11} />
            </div>
          </div>
          <div>
            <div className="text-base font-black text-blue-700 leading-tight">{fmtN(totalPointsIssued)}</div>
            <div className="text-[9.5px] text-blue-600 font-semibold mt-0.5 truncate">All-time points earned</div>
          </div>
        </div>

        {/* KPI 6 */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-2.5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Points Redeemed</span>
            <div className="w-5 h-5 rounded-md bg-purple-50 border border-purple-200 text-purple-700 flex items-center justify-center">
              <FiGift size={11} />
            </div>
          </div>
          <div>
            <div className="text-base font-black text-purple-700 leading-tight">{fmtN(totalPointsRedeemed)}</div>
            <div className="text-[9.5px] text-purple-600 font-semibold mt-0.5 truncate">Converted to rewards</div>
          </div>
        </div>

        {/* KPI 7 */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-2.5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Redemption %</span>
            <div className="w-5 h-5 rounded-md bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center">
              <FiPercent size={11} />
            </div>
          </div>
          <div>
            <div className="text-base font-black text-teal-700 leading-tight">{redemptionRatePct.toFixed(1)}%</div>
            <div className="text-[9.5px] text-teal-600 font-semibold mt-0.5 truncate">Member claim velocity</div>
          </div>
        </div>

        {/* KPI 8 */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-2.5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Avg Member Spend</span>
            <div className="w-5 h-5 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center">
              <FiDollarSign size={11} />
            </div>
          </div>
          <div>
            <div className="text-base font-black text-indigo-700 leading-tight">{fmtK(avgSpendPerMember)}</div>
            <div className="text-[9.5px] text-indigo-600 font-semibold mt-0.5 truncate">Per enrolled member</div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          3. TAB NAVIGATION BAR
          ══════════════════════════════════════════════════════════════════ */}
      <div className="bg-white border border-slate-200 rounded-2xl p-1.5 shadow-xs flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1">
          <button
            onClick={() => setActiveTab('members')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'members'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <FiUsers size={14} />
            <span>Members Directory</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                activeTab === 'members' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {members.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('ledger')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'ledger'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <FiActivity size={14} />
            <span>Points Audit Ledger</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                activeTab === 'ledger' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {ledger.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('analytics')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'analytics'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <FiTrendingUp size={14} />
            <span>Retention Analytics &amp; Charts</span>
          </button>

          <button
            onClick={() => setActiveTab('rewards')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'rewards'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <FiGift size={14} />
            <span>Rewards Catalog &amp; Vouchers</span>
          </button>

          <button
            onClick={() => setActiveTab('config')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'config'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <FiSliders size={14} />
            <span>Rules &amp; Tiers</span>
          </button>
        </div>

        <div className="text-[11px] font-bold text-slate-500 pr-2 hidden sm:block">
          Earning Rule: <span className="text-amber-700 font-extrabold">1 pt per Ksh {config.earn_rate}</span>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          TAB 1: MEMBERS DIRECTORY (ENRICHED DATAGRID WITH PAGINATION)
          ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'members' && (
        <div className="space-y-3">
          {/* Controls Bar */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-3 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
              <div className="relative flex-1 min-w-[200px]">
                <FiSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search member name, phone, code..."
                  value={memberSearch}
                  onChange={(e) => {
                    setMemberSearch(e.target.value);
                    setMemberPage(1);
                  }}
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <select
                value={tierFilter}
                onChange={(e) => {
                  setTierFilter(e.target.value);
                  setMemberPage(1);
                }}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
              >
                <option value="All">All Tiers ({members.length})</option>
                {tiers.map((t) => (
                  <option key={t.name} value={t.name}>
                    {t.icon} {t.name} ({members.filter((m) => m.tier === t.name).length})
                  </option>
                ))}
              </select>

              <select
                value={memberSort}
                onChange={(e) => setMemberSort(e.target.value as any)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
              >
                <option value="points">Sort: Highest Points</option>
                <option value="spent">Sort: Highest Spend</option>
                <option value="visits">Sort: Most Visits</option>
                <option value="recent">Sort: Recently Active</option>
              </select>
            </div>

            <div className="text-xs font-bold text-slate-500">
              Showing <strong className="text-slate-800">{filteredMembers.length}</strong> matching members
            </div>
          </div>

          {/* Table (Strict Compliance: NO Dark Gradient, Clean Visible Fonts) */}
          <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 border-b-2 border-slate-300">
                  <tr className="bg-slate-100 border-b border-slate-300">
                    <th className="py-3 px-3 font-black uppercase tracking-wider text-[11px] w-12 text-center text-slate-900 bg-slate-100 border-r border-slate-200">#</th>
                    <th className="py-3 px-3 font-black uppercase tracking-wider text-[11px] text-slate-900 bg-slate-100 border-r border-slate-200">Member &amp; Code</th>
                    <th className="py-3 px-3 font-black uppercase tracking-wider text-[11px] text-slate-900 bg-slate-100 border-r border-slate-200">Contact</th>
                    <th className="py-3 px-3 font-black uppercase tracking-wider text-[11px] text-center text-slate-900 bg-slate-100 border-r border-slate-200">Tier Status</th>
                    <th className="py-3 px-3 font-black uppercase tracking-wider text-[11px] text-right text-slate-900 bg-slate-100 border-r border-slate-200">Points Balance</th>
                    <th className="py-3 px-3 font-black uppercase tracking-wider text-[11px] text-right text-slate-900 bg-slate-100 border-r border-slate-200">Redeem Value</th>
                    <th className="py-3 px-3 font-black uppercase tracking-wider text-[11px] text-right text-slate-900 bg-slate-100 border-r border-slate-200">Total Spend</th>
                    <th className="py-3 px-3 font-black uppercase tracking-wider text-[11px] text-center text-slate-900 bg-slate-100 border-r border-slate-200">Visits</th>
                    <th className="py-3 px-3 font-black uppercase tracking-wider text-[11px] text-center text-slate-900 bg-slate-100 border-r border-slate-200">Last Visit</th>
                    <th className="py-3 px-3 font-black uppercase tracking-wider text-[11px] text-center w-28 text-slate-900 bg-slate-100">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={10} className="py-16 text-center">
                        <FiRefreshCw size={24} className="animate-spin text-amber-500 mx-auto mb-2" />
                        <span className="text-xs font-semibold text-slate-600">Reconciling loyalty customer points &amp; spend matrix...</span>
                      </td>
                    </tr>
                  ) : paginatedMembers.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-16 text-center text-slate-400 font-medium">
                        No loyalty members found matching your search criteria.
                      </td>
                    </tr>
                  ) : (
                    paginatedMembers.map((m, idx) => {
                      const rowNum = (memberPage - 1) * memberPerPage + idx + 1;
                      const tierObj = tiers.find((t) => t.name === m.tier) || tiers[0];
                      const redeemKsh = m.points * (config.redeem_rate || 1.0);

                      return (
                        <tr key={m.customer_id} className="hover:bg-amber-50/40 transition">
                          <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px]">{rowNum}</td>
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-slate-900">{m.name}</div>
                            <span className="font-mono text-[10px] text-slate-400">{m.customer_code}</span>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-mono text-slate-700 font-semibold">{m.phone}</div>
                            {m.email && m.email !== '—' && (
                              <span className="text-[10px] text-slate-400 truncate max-w-[130px] block">{m.email}</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black border ${tierObj.bg} ${tierObj.color} ${tierObj.border}`}
                            >
                              <span>{tierObj.icon}</span>
                              <span>{m.tier}</span>
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-black text-amber-700 text-sm">
                            ⭐ {m.points.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-700">
                            {fmtKES(redeemKsh)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                            {fmtKES(m.total_spent)}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-semibold text-slate-700">
                            {m.visits}
                          </td>
                          <td className="py-2.5 px-3 text-center text-slate-500 font-mono text-[11px]">
                            {m.last_visit ? formatDate(m.last_visit) : '—'}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => {
                                  setSelectedMember(m);
                                }}
                                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition"
                                title="View Customer Dossier"
                              >
                                <FiUserCheck size={13} />
                              </button>
                              <button
                                onClick={() => {
                                  setAdjustTarget(m);
                                  setAdjustType('bonus');
                                  setAdjustPoints('');
                                  setAdjustReason('');
                                  setShowAdjustModal(true);
                                }}
                                className="p-1.5 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 transition"
                                title="Adjust Points"
                              >
                                <FiStar size={13} />
                              </button>
                              <button
                                onClick={() => {
                                  setRedeemTarget(m);
                                  setSelectedReward(null);
                                  setShowRedeemModal(true);
                                }}
                                className="p-1.5 rounded-lg border border-purple-300 bg-purple-50 hover:bg-purple-100 text-purple-800 transition"
                                title="Redeem Rewards"
                              >
                                <FiGift size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls Dock */}
            <div className="p-3 bg-slate-50/80 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-500 font-medium">Rows per page:</span>
                <select
                  value={memberPerPage}
                  onChange={(e) => {
                    setMemberPerPage(Number(e.target.value));
                    setMemberPage(1);
                  }}
                  className="bg-white border border-slate-200 rounded-lg px-2 py-1 font-bold text-slate-700 cursor-pointer"
                >
                  <option value={10}>10</option>
                  <option value={15}>15</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span className="text-slate-500 ml-2">
                  Showing{' '}
                  <strong className="text-slate-800">
                    {filteredMembers.length === 0 ? 0 : (memberPage - 1) * memberPerPage + 1}
                  </strong>{' '}
                  to{' '}
                  <strong className="text-slate-800">
                    {Math.min(memberPage * memberPerPage, filteredMembers.length)}
                  </strong>{' '}
                  of <strong className="text-slate-800">{filteredMembers.length}</strong> members
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setMemberPage(1)}
                  disabled={memberPage === 1}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                  title="First Page"
                >
                  <FiChevronsLeft size={14} />
                </button>
                <button
                  onClick={() => setMemberPage((p) => Math.max(1, p - 1))}
                  disabled={memberPage === 1}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                  title="Previous Page"
                >
                  <FiChevronLeft size={14} />
                </button>
                <span className="px-3 py-1 font-bold text-slate-800 bg-white border border-slate-200 rounded-lg">
                  {memberPage} / {totalMemberPages}
                </span>
                <button
                  onClick={() => setMemberPage((p) => Math.min(totalMemberPages, p + 1))}
                  disabled={memberPage === totalMemberPages}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                  title="Next Page"
                >
                  <FiChevronRight size={14} />
                </button>
                <button
                  onClick={() => setMemberPage(totalMemberPages)}
                  disabled={memberPage === totalMemberPages}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                  title="Last Page"
                >
                  <FiChevronsRight size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB 2: POINTS ACTIVITY LEDGER (STRICT AUDIT STREAM WITH PAGINATION)
          ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'ledger' && (
        <div className="space-y-3">
          {/* Controls Bar */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-3 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
              <div className="relative flex-1 min-w-[200px]">
                <FiSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search customer, reason, receipt no..."
                  value={ledgerSearch}
                  onChange={(e) => {
                    setLedgerSearch(e.target.value);
                    setLedgerPage(1);
                  }}
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <select
                value={ledgerTypeFilter}
                onChange={(e) => {
                  setLedgerTypeFilter(e.target.value);
                  setLedgerPage(1);
                }}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
              >
                <option value="ALL">All Activity ({ledger.length})</option>
                <option value="earn">Earned (+)</option>
                <option value="bonus">Bonus (+)</option>
                <option value="redeem">Redeemed (-)</option>
                <option value="adjustment">Adjustments</option>
              </select>
            </div>

            <div className="text-xs font-bold text-slate-500">
              Total Recorded Transactions: <strong className="text-amber-800 font-mono">{ledger.length}</strong>
            </div>
          </div>

          {/* Table (Strict Compliance: NO Dark Gradient, Clean Visible Fonts) */}
          <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 border-b-2 border-slate-300">
                  <tr className="bg-slate-100 border-b border-slate-300">
                    <th className="py-3 px-3 font-black uppercase tracking-wider text-[11px] w-12 text-center text-slate-900 bg-slate-100 border-r border-slate-200">#</th>
                    <th className="py-3 px-3 font-black uppercase tracking-wider text-[11px] text-slate-900 bg-slate-100 border-r border-slate-200">Date &amp; Time</th>
                    <th className="py-3 px-3 font-black uppercase tracking-wider text-[11px] text-slate-900 bg-slate-100 border-r border-slate-200">Customer Name</th>
                    <th className="py-3 px-3 font-black uppercase tracking-wider text-[11px] text-slate-900 bg-slate-100 border-r border-slate-200">Phone</th>
                    <th className="py-3 px-3 font-black uppercase tracking-wider text-[11px] text-center text-slate-900 bg-slate-100 border-r border-slate-200">Action Type</th>
                    <th className="py-3 px-3 font-black uppercase tracking-wider text-[11px] text-right text-slate-900 bg-slate-100 border-r border-slate-200">Points Delta</th>
                    <th className="py-3 px-3 font-black uppercase tracking-wider text-[11px] text-right text-slate-900 bg-slate-100 border-r border-slate-200">Ksh Value</th>
                    <th className="py-3 px-3 font-black uppercase tracking-wider text-[11px] text-slate-900 bg-slate-100 border-r border-slate-200">Audit Description / Reference</th>
                    <th className="py-3 px-3 font-black uppercase tracking-wider text-[11px] text-slate-900 bg-slate-100">Staff</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {paginatedLedger.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-14 text-center text-slate-400 font-medium">
                        No loyalty transactions found. Adjust or redeem points to record activity.
                      </td>
                    </tr>
                  ) : (
                    paginatedLedger.map((t, idx) => {
                      const rowNum = (ledgerPage - 1) * ledgerPerPage + idx + 1;
                      const isRedeem = t.txn_type === 'redeem';

                      return (
                        <tr key={t.txn_id} className="hover:bg-slate-50 transition">
                          <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px]">{rowNum}</td>
                          <td className="py-2.5 px-3 font-mono font-semibold text-slate-700 whitespace-nowrap">
                            {formatDate(t.created_at)}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-slate-900">{t.customer_name}</td>
                          <td className="py-2.5 px-3 font-mono text-slate-500">{t.customer_phone || '—'}</td>
                          <td className="py-2.5 px-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                                isRedeem
                                  ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                  : t.txn_type === 'bonus'
                                  ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                  : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              }`}
                            >
                              {t.txn_type}
                            </span>
                          </td>
                          <td
                            className={`py-2.5 px-3 text-right font-mono font-black text-sm ${
                              isRedeem ? 'text-rose-700' : 'text-emerald-700'
                            }`}
                          >
                            {isRedeem ? `-${t.points.toLocaleString()}` : `+${t.points.toLocaleString()}`}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-700">
                            {fmtKES(t.kush_value || t.points)}
                          </td>
                          <td className="py-2.5 px-3 text-slate-700 max-w-[260px] truncate" title={t.description}>
                            {t.description}
                            {t.receipt_no && (
                              <span className="block font-mono text-[10px] text-slate-400">Ref: {t.receipt_no}</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 text-[11px] font-medium">{t.created_by || 'Admin'}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls Dock */}
            <div className="p-3 bg-slate-50/80 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-500 font-medium">Rows per page:</span>
                <select
                  value={ledgerPerPage}
                  onChange={(e) => {
                    setLedgerPerPage(Number(e.target.value));
                    setLedgerPage(1);
                  }}
                  className="bg-white border border-slate-200 rounded-lg px-2 py-1 font-bold text-slate-700 cursor-pointer"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span className="text-slate-500 ml-2">
                  Showing{' '}
                  <strong className="text-slate-800">
                    {filteredLedger.length === 0 ? 0 : (ledgerPage - 1) * ledgerPerPage + 1}
                  </strong>{' '}
                  to{' '}
                  <strong className="text-slate-800">
                    {Math.min(ledgerPage * ledgerPerPage, filteredLedger.length)}
                  </strong>{' '}
                  of <strong className="text-slate-800">{filteredLedger.length}</strong> transactions
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setLedgerPage(1)}
                  disabled={ledgerPage === 1}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                  title="First Page"
                >
                  <FiChevronsLeft size={14} />
                </button>
                <button
                  onClick={() => setLedgerPage((p) => Math.max(1, p - 1))}
                  disabled={ledgerPage === 1}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                  title="Previous Page"
                >
                  <FiChevronLeft size={14} />
                </button>
                <span className="px-3 py-1 font-bold text-slate-800 bg-white border border-slate-200 rounded-lg">
                  {ledgerPage} / {totalLedgerPages}
                </span>
                <button
                  onClick={() => setLedgerPage((p) => Math.min(totalLedgerPages, p + 1))}
                  disabled={ledgerPage === totalLedgerPages}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                  title="Next Page"
                >
                  <FiChevronRight size={14} />
                </button>
                <button
                  onClick={() => setLedgerPage(totalLedgerPages)}
                  disabled={ledgerPage === totalLedgerPages}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                  title="Last Page"
                >
                  <FiChevronsRight size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB 3: RETENTION ANALYTICS & VELOCITY CHARTS
          ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'analytics' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Top Spenders Bar Chart */}
            <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
              <div className="mb-4">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <FiTrendingUp size={16} className="text-amber-500" />
                  Top 10 High-Value Loyalty Members by Turnover
                </h3>
                <p className="text-xs text-slate-500">Total customer lifetime revenue generated across all outlets</p>
              </div>

              <div className="h-64 w-full">
                {members.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400">
                    No members enrolled yet.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={[...members].sort((a, b) => b.total_spent - a.total_spent).slice(0, 10)}
                      margin={{ top: 10, right: 20, left: 10, bottom: 25 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      <XAxis
                        dataKey="name"
                        stroke="#64748B"
                        fontSize={10}
                        tickLine={false}
                        interval={0}
                        angle={-20}
                        textAnchor="end"
                      />
                      <YAxis stroke="#64748B" fontSize={10} tickFormatter={(v: any) => fmtK(v)} tickLine={false} />
                      <RechartsTooltip
                        formatter={(val: any) => [fmtKES(val), 'Turnover']}
                        contentStyle={{ backgroundColor: '#0F172A', borderColor: '#1E293B', borderRadius: '12px', color: '#FFF' }}
                      />
                      <Bar dataKey="total_spent" fill="#F59E0B" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Tier Breakdown Donut Chart */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
              <div className="mb-4">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <FiAward size={16} className="text-violet-600" />
                  Member Tier Distribution
                </h3>
                <p className="text-xs text-slate-500">Proportion of members across qualification tiers</p>
              </div>

              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={tierCounts}
                      dataKey="count"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={4}
                    >
                      {tierCounts.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={PALETTE[index % PALETTE.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      formatter={(val: any) => [val, 'Members']}
                      contentStyle={{ backgroundColor: '#0F172A', borderColor: '#1E293B', borderRadius: '12px', color: '#FFF' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-1.5 mt-2">
                {tierCounts.map((tc, idx) => (
                  <div key={tc.name} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 font-bold text-slate-700">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PALETTE[idx % PALETTE.length] }} />
                      <span>{tc.icon} {tc.name}</span>
                    </span>
                    <span className="font-mono font-black text-slate-900">
                      {tc.count} ({tc.pct.toFixed(0)}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB 4: REWARDS CATALOG & VOUCHERS
          ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'rewards' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <FiGift size={16} className="text-amber-500" />
              Active Redemption Reward Catalog
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Customers can exchange accumulated points for cash discounts, store credits, or promotional vouchers
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {CATALOG_REWARDS.map((r) => (
              <div
                key={r.id}
                className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs hover:shadow-md transition flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-start justify-between mb-3">
                    <span className="text-3xl p-2.5 rounded-2xl bg-amber-50 border border-amber-200 group-hover:scale-110 transition-transform">
                      {r.icon}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-slate-100 text-slate-700 border border-slate-200">
                      {r.badge}
                    </span>
                  </div>

                  <h4 className="font-black text-slate-900 text-base">{r.title}</h4>
                  <p className="text-xs text-slate-500 mt-1 font-medium leading-relaxed">{r.description}</p>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Cost</span>
                    <span className="text-base font-black text-amber-700 font-mono">⭐ {r.points_cost} pts</span>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedReward(r);
                      if (members.length > 0) setRedeemTarget(members[0]);
                      setShowRedeemModal(true);
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-2xs transition cursor-pointer"
                  >
                    Claim Voucher
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB 5: PROGRAM RULES & TIER CONFIGURATION
          ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'config' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs max-w-3xl mx-auto space-y-6">
          <div>
            <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
              <FiSliders size={18} className="text-amber-500" />
              Loyalty Program Earning &amp; Tier Rules
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Configure points accrual rates, redemption cash equivalents, and tier promotion thresholds
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
              <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700">Point Accrual &amp; Conversion</h4>

              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">
                  Spend required to earn 1 Point (Ksh)
                </label>
                <input
                  type="number"
                  min="1"
                  value={configDraft.earn_rate}
                  onChange={(e) => setConfigDraft({ ...configDraft, earn_rate: Number(e.target.value) || 100 })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-amber-500"
                />
                <span className="text-[10px] text-slate-400 block mt-0.5">e.g. 100 means a customer earns 10 pts on Ksh 1,000 spend</span>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">
                  Cash Redemption Value per Point (Ksh)
                </label>
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={configDraft.redeem_rate}
                  onChange={(e) => setConfigDraft({ ...configDraft, redeem_rate: Number(e.target.value) || 1.0 })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-amber-500"
                />
                <span className="text-[10px] text-slate-400 block mt-0.5">e.g. 1.0 means 100 points = Ksh 100 store discount</span>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">
                  Minimum Points for First Redemption
                </label>
                <input
                  type="number"
                  min="10"
                  value={configDraft.min_redeem}
                  onChange={(e) => setConfigDraft({ ...configDraft, min_redeem: Number(e.target.value) || 100 })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
              <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700">Tier Qualification Cutoffs (Points)</h4>

              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">🥉 Bronze Tier Minimum</label>
                <input
                  type="number"
                  disabled
                  value={configDraft.bronze_min}
                  className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-500 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">🥈 Silver Tier Minimum</label>
                <input
                  type="number"
                  min="100"
                  value={configDraft.silver_min}
                  onChange={(e) => setConfigDraft({ ...configDraft, silver_min: Number(e.target.value) || 1000 })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">🥇 Gold Tier Minimum</label>
                <input
                  type="number"
                  min="500"
                  value={configDraft.gold_min}
                  onChange={(e) => setConfigDraft({ ...configDraft, gold_min: Number(e.target.value) || 5000 })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">💎 Platinum Tier Minimum</label>
                <input
                  type="number"
                  min="1000"
                  value={configDraft.platinum_min}
                  onChange={(e) => setConfigDraft({ ...configDraft, platinum_min: Number(e.target.value) || 20000 })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <button
              onClick={() => setConfigDraft(config)}
              className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 transition"
            >
              Reset Changes
            </button>
            <button
              onClick={handleSaveConfig}
              disabled={isSavingConfig}
              className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-sm transition disabled:opacity-50"
            >
              {isSavingConfig ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          MODAL: MEMBER DOSSIER DRAWER
          ══════════════════════════════════════════════════════════════════ */}
      {selectedMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {(() => {
              const tierObj = tiers.find((t) => t.name === selectedMember.tier) || tiers[0];
              const nextTier = tiers[tiers.indexOf(tierObj) + 1];
              const ptsNeeded = nextTier ? Math.max(0, nextTier.min - selectedMember.points) : 0;
              const progressPct = nextTier
                ? Math.min(100, Math.max(0, ((selectedMember.points - tierObj.min) / (nextTier.min - tierObj.min)) * 100))
                : 100;

              return (
                <div>
                  <div className={`p-6 border-b ${tierObj.bg}`}>
                    <div className="flex items-start justify-between">
                      <div>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${tierObj.border} ${tierObj.color} bg-white/70`}>
                          {tierObj.icon} {selectedMember.tier} Member
                        </span>
                        <h3 className="text-xl font-black text-slate-900 mt-2">{selectedMember.name}</h3>
                        <p className="text-xs font-mono text-slate-600 mt-0.5">{selectedMember.phone} &bull; {selectedMember.customer_code}</p>
                      </div>

                      <div className="text-right">
                        <div className="text-3xl font-black font-mono text-amber-800">
                          ⭐ {selectedMember.points.toLocaleString()}
                        </div>
                        <span className="text-[10px] text-slate-500 font-bold block mt-0.5">
                          Value: {fmtKES(selectedMember.points * (config.redeem_rate || 1.0))}
                        </span>
                      </div>
                    </div>

                    {nextTier && (
                      <div className="mt-4 pt-3 border-t border-black/10">
                        <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                          <span>Progress to {nextTier.name} ({nextTier.icon})</span>
                          <span>{ptsNeeded.toLocaleString()} pts to go</span>
                        </div>
                        <div className="w-full bg-white/70 rounded-full h-2 overflow-hidden shadow-inner">
                          <div
                            className="h-2 rounded-full bg-gradient-to-r from-amber-400 to-amber-600 transition-all duration-300"
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Metrics Row */}
                  <div className="grid grid-cols-3 gap-2 p-4 bg-slate-50 border-b text-center text-xs">
                    <div className="p-2 rounded-xl bg-white border border-slate-200">
                      <span className="text-[10px] text-slate-400 font-bold block">Lifetime Spend</span>
                      <strong className="text-slate-900 text-sm font-mono block mt-0.5">{fmtKES(selectedMember.total_spent)}</strong>
                    </div>
                    <div className="p-2 rounded-xl bg-white border border-slate-200">
                      <span className="text-[10px] text-slate-400 font-bold block">Visits</span>
                      <strong className="text-slate-900 text-sm font-mono block mt-0.5">{selectedMember.visits}</strong>
                    </div>
                    <div className="p-2 rounded-xl bg-white border border-slate-200">
                      <span className="text-[10px] text-slate-400 font-bold block">Last Visit</span>
                      <strong className="text-slate-900 text-xs font-mono block mt-1">{selectedMember.last_visit ? formatDate(selectedMember.last_visit) : '—'}</strong>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="p-4 bg-white flex items-center justify-between">
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setAdjustTarget(selectedMember);
                          setAdjustType('bonus');
                          setAdjustPoints('');
                          setAdjustReason('');
                          setShowAdjustModal(true);
                        }}
                        className="px-3 py-1.5 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold transition"
                      >
                        Adjust Points
                      </button>
                      <button
                        onClick={() => {
                          setRedeemTarget(selectedMember);
                          setSelectedReward(null);
                          setShowRedeemModal(true);
                        }}
                        className="px-3 py-1.5 rounded-xl border border-purple-300 bg-purple-50 hover:bg-purple-100 text-purple-800 text-xs font-bold transition"
                      >
                        Redeem Rewards
                      </button>
                    </div>

                    <button
                      onClick={() => setSelectedMember(null)}
                      className="px-4 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition"
                    >
                      Close
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          MODAL: ENROLL NEW MEMBER
          ══════════════════════════════════════════════════════════════════ */}
      {showEnrollModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <FiUserPlus size={18} className="text-amber-500" />
              Enroll New Loyalty Member
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Register customer and initialize loyalty account</p>

            <div className="space-y-3.5 mt-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Customer Full Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Samuel Karanja"
                  value={enrollForm.name}
                  onChange={(e) => setEnrollForm({ ...enrollForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Phone Number (ID) *</label>
                <input
                  type="text"
                  placeholder="e.g. 0712345678"
                  value={enrollForm.phone}
                  onChange={(e) => setEnrollForm({ ...enrollForm, phone: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Email Address (Optional)</label>
                <input
                  type="email"
                  placeholder="e.g. customer@example.com"
                  value={enrollForm.email}
                  onChange={(e) => setEnrollForm({ ...enrollForm, email: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Welcome Starting Bonus (Points)</label>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={enrollForm.initialPoints || ''}
                  onChange={(e) => setEnrollForm({ ...enrollForm, initialPoints: Number(e.target.value) || 0 })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-slate-100">
              <button
                onClick={() => setShowEnrollModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleEnrollMember}
                disabled={isEnrolling}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-sm transition disabled:opacity-50"
              >
                {isEnrolling ? 'Enrolling...' : 'Confirm Enrollment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          MODAL: ADJUST POINTS (+ EARN / - REDEEM / BONUS)
          ══════════════════════════════════════════════════════════════════ */}
      {showAdjustModal && adjustTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <FiStar size={18} className="text-amber-500" />
              Adjust Points for {adjustTarget.name}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Current Available Balance: <strong className="text-amber-800 font-mono">⭐ {adjustTarget.points.toLocaleString()} pts</strong>
            </p>

            <div className="space-y-3.5 mt-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Adjustment Action</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustType('bonus')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition ${
                      adjustType === 'bonus'
                        ? 'bg-amber-500 text-white border-amber-600 shadow-2xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    + Bonus
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustType('earn')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition ${
                      adjustType === 'earn'
                        ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    + Add Earn
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustType('redeem')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition ${
                      adjustType === 'redeem'
                        ? 'bg-rose-600 text-white border-rose-700 shadow-2xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    - Deduct
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Points Quantity *</label>
                <input
                  type="number"
                  min="1"
                  placeholder="e.g. 100"
                  value={adjustPoints}
                  onChange={(e) => setAdjustPoints(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-amber-500"
                />
                {Number(adjustPoints) > 0 && (
                  <span className="text-[10px] text-slate-500 font-semibold block mt-0.5">
                    Equivalent Cash Value: {fmtKES(Number(adjustPoints) * (config.redeem_rate || 1.0))}
                  </span>
                )}
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Audit Reason / Description *</label>
                <input
                  type="text"
                  placeholder="e.g. Goodwill bonus, Birthday treat, Manual correction..."
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-slate-100">
              <button
                onClick={() => setShowAdjustModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleApplyAdjustment}
                disabled={isSubmittingAdjust}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-sm transition disabled:opacity-50"
              >
                {isSubmittingAdjust ? 'Applying...' : 'Apply Adjustment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          MODAL: REDEEM REWARD / VOUCHER
          ══════════════════════════════════════════════════════════════════ */}
      {showRedeemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <FiGift size={18} className="text-purple-600" />
              Redeem Loyalty Reward Voucher
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Select member and choose a reward from the catalog</p>

            <div className="space-y-3.5 mt-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Select Member</label>
                <select
                  value={redeemTarget?.customer_id || ''}
                  onChange={(e) => {
                    const match = members.find((m) => m.customer_id === Number(e.target.value));
                    if (match) setRedeemTarget(match);
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-purple-500 cursor-pointer"
                >
                  {members.map((m) => (
                    <option key={m.customer_id} value={m.customer_id}>
                      {m.name} ({m.phone}) — {m.points.toLocaleString()} pts
                    </option>
                  ))}
                </select>
                {redeemTarget && (
                  <span className="text-[10px] text-purple-700 font-extrabold block mt-1">
                    Available Balance: ⭐ {redeemTarget.points.toLocaleString()} points ({fmtKES(redeemTarget.points * (config.redeem_rate || 1.0))})
                  </span>
                )}
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Choose Reward</label>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {CATALOG_REWARDS.map((r) => {
                    const isAffordable = (redeemTarget?.points || 0) >= r.points_cost;
                    const isSelected = selectedReward?.id === r.id;

                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setSelectedReward(r)}
                        className={`w-full text-left p-2.5 rounded-xl border flex items-center justify-between transition cursor-pointer ${
                          isSelected
                            ? 'bg-purple-50 border-purple-400 ring-2 ring-purple-400/30'
                            : isAffordable
                            ? 'bg-white border-slate-200 hover:bg-slate-50'
                            : 'bg-slate-50 border-slate-200 opacity-50'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="text-xl">{r.icon}</span>
                          <div>
                            <span className="font-bold text-xs text-slate-900 block leading-tight">{r.title}</span>
                            <span className="text-[10px] text-slate-500">{r.description}</span>
                          </div>
                        </div>

                        <div className="text-right flex-shrink-0">
                          <span className="font-black text-xs font-mono text-purple-700 block">⭐ {r.points_cost} pts</span>
                          <span className="text-[9.5px] font-bold text-slate-500">Ksh {r.discount_value}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-slate-100">
              <button
                onClick={() => setShowRedeemModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleRedeemReward}
                disabled={isRedeeming || !selectedReward || (redeemTarget?.points || 0) < (selectedReward?.points_cost || 0)}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-sm transition disabled:opacity-40"
              >
                {isRedeeming ? 'Processing...' : 'Confirm & Issue Voucher'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
