"use client";

import Image from 'next/image';
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { formatINR } from '@/lib/format';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  ShoppingCart, 
  Zap, 
  Target, 
  AlertCircle,
  Package,
  RefreshCw,
} from 'lucide-react';
import { apiFetch } from '@/lib/apiFetch';
import { resolveActiveAccount, getStoredAccountId, ACTIVE_ACCOUNT_CHANGED_EVENT } from '@/lib/account';
import { TaskPerformanceCard, type TrackRecordEntry } from '@/components/TaskPerformanceCard';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

// Reconciliation-driven Intelligence Components
import { ReconciliationSnapshot } from './components/reconciliation-snapshot';
import { OrderDistribution } from './components/order-distribution';
import { DailyFinancialTrends } from './components/daily-financial-trends';
import { BusinessIntelligence } from './components/business-intelligence';

// Reconciliation Types
import {
  FinancialSummary,
  DailyTrendMetric,
  SkuProfitabilityMetric,
} from '@/lib/reconciliation/types';
import { DecisionEngineSummary } from '@/lib/reconciliation/decision-engine';

// Helper: Calculate previous calendar month range
function getLastMonthRange(): { startDate: string; endDate: string; label: string } {
  const now = new Date();
  const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const month = now.getMonth() === 0 ? 11 : now.getMonth() - 1; // 0-indexed (August is 7)
  const lastDay = new Date(Date.UTC(year, month + 1, 0));

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  const pad = (n: number) => String(n).padStart(2, '0');
  const startDate = `${year}-${pad(month + 1)}-01`;
  const endDate = `${year}-${pad(month + 1)}-${pad(lastDay.getUTCDate())}`;
  const label = `Last Month (${monthNames[month]} ${year})`;

  return { startDate, endDate, label };
}

// --- Sub-components ---

const AnimatedValue = ({
  value,
  prefix = "",
  suffix = "",
  isCurrency = false,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  isCurrency?: boolean;
}) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let start = 0;
    const end = value;
    if (start === end) return;
    const totalDuration = 1000;
    const increment = end / (totalDuration / 16);

    const timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        setDisplayValue(end);
        clearInterval(timer);
      } else {
        setDisplayValue(start);
      }
    }, 16);
    return () => clearInterval(timer);
  }, [value]);

  if (isCurrency) return <span>{formatINR(displayValue)}</span>;
  return (
    <span>
      {prefix}
      {Math.floor(displayValue).toLocaleString()}
      {suffix}
    </span>
  );
};

interface KpiCardProps {
  title: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  gradient: string;
  loading?: boolean;
  isCurrency?: boolean;
  trend?: number;
  suffix?: string;
}

const KpiCard = ({
  title,
  value,
  icon: Icon,
  description,
  gradient,
  loading = false,
  isCurrency = false,
  trend,
  suffix = "",
}: KpiCardProps) => {
  const iconBgClass = gradient ? gradient.replace('from-', 'bg-').split(' ')[0] : 'bg-indigo-600';
  return (
    <Card className="glass-panel relative h-full overflow-hidden rounded-[1.5rem] border border-white/10 bg-slate-900/40 shadow-[0_20px_50px_rgba(2,6,23,0.35)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:border-indigo-400/30 hover:shadow-[0_20px_60px_rgba(79,70,229,0.18)] group">
      <div className={cn("absolute inset-0 opacity-5 group-hover:opacity-10 transition-opacity bg-gradient-to-br", gradient)} />
      <CardContent className="p-6 relative z-10">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">{title}</p>
            {loading ? <Skeleton className="h-10 w-24 bg-muted/40" /> : (
              <h2 className="text-3xl font-black font-headline tracking-tighter text-white">
                <AnimatedValue value={value} isCurrency={isCurrency} suffix={suffix} />
              </h2>
            )}
          </div>
          <div className={cn("p-3 rounded-2xl shadow-lg shadow-black/5", iconBgClass, "text-white")}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2">
          {trend !== undefined && trend !== null && (
            <div className={cn(
              "flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold",
              trend > 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
            )}>
              {trend > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {Math.abs(trend)}%
            </div>
          )}
          <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">{description}</p>
        </div>
      </CardContent>
    </Card>
  );
};

// --- Main Dashboard Page ---

export default function DashboardPage() {
  const { toast } = useToast();
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [loading, setLoading] = useState(true);

  // Operational Data States
  const [summary, setSummary] = useState<any>(null);
  const [trackRecord, setTrackRecord] = useState<TrackRecordEntry[]>([]);
  const [taskProgress, setTaskProgress] = useState<any>(null);
  const [inventoryValue, setInventoryValue] = useState(0);
  const [totalPaymentReceived, setTotalPaymentReceived] = useState(0);
  const [netCashFlow, setNetCashFlow] = useState(0);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Reconciliation Intelligence States
  const [reconciliationSummary, setReconciliationSummary] = useState<FinancialSummary | null>(null);
  const [reconciliationDailyTrends, setReconciliationDailyTrends] = useState<DailyTrendMetric[]>([]);
  const [reconciliationDecisions, setReconciliationDecisions] = useState<DecisionEngineSummary | null>(null);
  const [topProfitSku, setTopProfitSku] = useState<SkuProfitabilityMetric | null>(null);
  const [worstProfitSku, setWorstProfitSku] = useState<SkuProfitabilityMetric | null>(null);

  const [financialsError, setFinancialsError] = useState<string | null>(null);

  // Compute Last Month Range
  const { startDate, endDate, label: periodLabel } = useMemo(() => getLastMonthRange(), []);

  const fetchAllData = useCallback(async (explicitAccountId?: string) => {
    let targetAccountId = explicitAccountId || activeAccountId || getStoredAccountId();
    if (!targetAccountId) {
      const resolved = await resolveActiveAccount();
      targetAccountId = resolved?.id || null;
      if (resolved?.id && resolved.id !== activeAccountId) {
        setActiveAccountId(resolved.id);
      }
    }

    if (!targetAccountId) {
      setLoading(false);
      setFetchError("Unable to resolve active account. Please refresh.");
      return;
    }

    setLoading(true);
    setFetchError(null);
    setFinancialsError(null);

    try {
      const headers = { 'x-account-id': targetAccountId };

      // Execute all 5 server-side endpoints concurrently in parallel via allSettled for resilience
      const [dashRes, finRes, skuRes, dailyRes, decRes] = await Promise.allSettled([
        apiFetch('/api/dashboard', { headers }),
        apiFetch(`/api/reconciliation/financials?startDate=${startDate}&endDate=${endDate}`, { headers }),
        apiFetch(`/api/reconciliation/sku-analytics?startDate=${startDate}&endDate=${endDate}`, { headers }),
        apiFetch(`/api/reconciliation/daily-analytics?startDate=${startDate}&endDate=${endDate}`, { headers }),
        apiFetch(`/api/reconciliation/decision-engine?startDate=${startDate}&endDate=${endDate}`, { headers }),
      ]);

      // 1. Process Operational Dashboard API response
      if (dashRes.status === 'fulfilled' && dashRes.value.ok) {
        try {
          const d = await dashRes.value.json();
          setSummary(d.summary);
          setTotalPaymentReceived(d.totalPaymentReceived || 0);
          setNetCashFlow(d.netCashFlow || 0);
          setInventoryValue(d.inventoryValue || 0);
          setTaskProgress(d.taskProgress || null);
          setTrackRecord(d.trackRecord || []);
        } catch (e) {
          console.error('Error parsing dashboard response:', e);
        }
      }

      // 2. Process Reconciliation Financials API response (support both .summary and .data)
      if (finRes.status === 'fulfilled' && finRes.value.ok) {
        try {
          const f = await finRes.value.json();
          if (f.success) {
            setReconciliationSummary(f.summary || f.data || null);
            setFinancialsError(null);
          } else {
            setFinancialsError(f.message || 'Failed to load reconciliation financials');
          }
        } catch (e) {
          console.error('Error parsing financials response:', e);
          setFinancialsError('Failed to parse financial data');
        }
      } else {
        setFinancialsError('Reconciliation financials API unavailable');
      }

      // 3. Process Reconciliation SKU Analytics API response
      if (skuRes.status === 'fulfilled' && skuRes.value.ok) {
        try {
          const s = await skuRes.value.json();
          if (s.success) {
            setTopProfitSku(s.rankings?.topProfitSku || null);
            setWorstProfitSku(s.rankings?.worstProfitSku || null);
          }
        } catch (e) {
          console.error('Error parsing SKU analytics response:', e);
        }
      }

      // 4. Process Reconciliation Daily Analytics API response
      if (dailyRes.status === 'fulfilled' && dailyRes.value.ok) {
        try {
          const day = await dailyRes.value.json();
          if (day.success) {
            setReconciliationDailyTrends(day.dailyTrends || []);
          }
        } catch (e) {
          console.error('Error parsing daily analytics response:', e);
        }
      }

      // 5. Process Reconciliation Decision Engine API response
      if (decRes.status === 'fulfilled' && decRes.value.ok) {
        try {
          const dec = await decRes.value.json();
          if (dec.success) {
            setReconciliationDecisions(dec.summary || null);
          }
        } catch (e) {
          console.error('Error parsing decision engine response:', e);
        }
      }
    } catch (error: any) {
      console.error('Failed to load dashboard data:', error);
      setFetchError(error.message || 'Failed to load dashboard data');
      toast({
        variant: 'destructive',
        title: 'Intelligence Offline',
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  }, [activeAccountId, toast, startDate, endDate]);

  useEffect(() => {
    setIsMounted(true);

    async function init() {
      const resolved = await resolveActiveAccount();
      if (resolved?.id) {
        setActiveAccountId(resolved.id);
        fetchAllData(resolved.id);
      } else {
        setLoading(false);
      }
    }
    init();

    const handleAccountInit = (e: any) => {
      const freshId = e?.detail?.id || getStoredAccountId();
      if (freshId && freshId !== activeAccountId) {
        setActiveAccountId(freshId);
        fetchAllData(freshId);
      }
    };

    window.addEventListener(ACTIVE_ACCOUNT_CHANGED_EVENT, handleAccountInit);
    return () => window.removeEventListener(ACTIVE_ACCOUNT_CHANGED_EVENT, handleAccountInit);
  }, []);

  if (!isMounted) return null;

  return (
    <div className="relative min-h-screen space-y-10 p-6 md:p-10 font-body">
      {/* 1. Page Header & Global Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 pb-2 border-b border-white/10">
        <div>
          <div className="mb-1 flex items-center gap-3">
            <Image
              src="/images/rehanza2.png"
              alt="Rehanza Hub"
              width={220}
              height={56}
              className="h-10 w-auto object-contain md:h-12"
            />
            <h1 className="text-3xl font-black tracking-tighter font-headline text-white md:text-4xl leading-none">
              Dashboard
            </h1>
          </div>
          <p className="text-slate-300 font-medium ml-1 text-sm">
            Unified executive overview: operational execution, reconciliation financials & SKU unit economics.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Badge
            variant="outline"
            className="glass-pill h-11 px-4 rounded-xl border border-white/10 bg-slate-900/35 font-bold text-xs uppercase tracking-widest flex items-center gap-2 text-slate-200"
          >
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Live Sync: Online
          </Badge>
          <Button
            onClick={() => fetchAllData()}
            variant="outline"
            size="icon"
            className="glass-button h-11 w-11 rounded-xl border border-white/10 bg-slate-900/35 text-slate-200 hover:bg-white/5 hover:text-white transition-all"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {fetchError && (
        <div className="glass-panel p-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-amber-400 shrink-0" />
            <p className="text-sm font-bold">{fetchError}</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => fetchAllData()} className="glass-button text-xs">
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Retry
          </Button>
        </div>
      )}

      {/* 2. Top KPI Row */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="glass-pill h-6 px-2 rounded-md border border-indigo-500/30 bg-indigo-500/10 font-bold text-[10px] uppercase tracking-wider text-indigo-300"
          >
            Overview
          </Badge>
          <h2 className="text-lg font-black tracking-tight text-white font-headline">
            Executive Key Performance Indicators
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <KpiCard 
            title="Revenue" 
            value={summary?.gross_revenue || 0} 
            icon={ShoppingCart} 
            description="30D Performance" 
            gradient="from-indigo-600 to-violet-700" 
            loading={loading} 
            isCurrency 
            trend={12}
          />
          <KpiCard 
            title="Net Cash Flow" 
            value={netCashFlow} 
            icon={TrendingUp} 
            description="Cash Position" 
            gradient="from-emerald-500 to-teal-600" 
            loading={loading} 
            isCurrency 
          />
          <KpiCard 
            title="Total Payment Received" 
            value={totalPaymentReceived} 
            icon={Wallet} 
            description="Received Payouts" 
            gradient="from-blue-600 to-cyan-700" 
            loading={loading} 
            isCurrency 
          />
          <KpiCard 
            title="Active Tasks" 
            value={(taskProgress?.overall?.total || 0) - (taskProgress?.overall?.completed || 0)} 
            icon={Zap} 
            description="Pending Execution" 
            gradient="from-blue-600 to-cyan-700" 
            loading={loading} 
          />
          <KpiCard 
            title="Net Profit" 
            value={summary?.net_profit || 0} 
            icon={Target} 
            description="Post-Cost Ledger" 
            gradient="from-emerald-500 to-teal-600" 
            loading={loading} 
            isCurrency
            trend={5}
          />
          <KpiCard 
            title="Inventory Value" 
            value={inventoryValue} 
            icon={Package} 
            description="Capital Invested" 
            gradient="from-slate-700 to-slate-900" 
            loading={loading} 
            isCurrency
          />
        </div>
      </section>

      {/* 3. Reconciliation Snapshot: Returns & RTO, Order Performance, Settlement & Profit */}
      <section>
        <ReconciliationSnapshot
          summary={reconciliationSummary}
          loading={loading}
          periodLabel={periodLabel}
          error={financialsError}
          onRetry={() => fetchAllData()}
        />
      </section>

      {/* 4. Analytics Layer: Daily Financial Trends & Order Distribution */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="glass-pill h-6 px-2 rounded-md border border-cyan-500/30 bg-cyan-500/10 font-bold text-[10px] uppercase tracking-wider text-cyan-300"
          >
            Analytics
          </Badge>
          <h2 className="text-lg font-black tracking-tight text-white font-headline">
            Reconciliation Analytics & Distribution
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Daily Financial Trends (8 cols) - Replaces empty Growth Analytics */}
          <div className="lg:col-span-8">
            <DailyFinancialTrends
              dailyTrends={reconciliationDailyTrends}
              loading={loading}
              periodLabel={periodLabel}
            />
          </div>

          {/* Order Distribution (4 cols) - Replaces Marketplace Power placeholder */}
          <div className="lg:col-span-4">
            <OrderDistribution
              orders={reconciliationSummary?.orders || null}
              loading={loading}
              periodLabel={periodLabel}
              error={financialsError}
              onRetry={() => fetchAllData()}
            />
          </div>
        </div>
      </section>

      {/* 5. Business Intelligence: 4 AI-Assisted Highlights */}
      <section>
        <BusinessIntelligence
          decisionSummary={reconciliationDecisions}
          topProfitSku={topProfitSku}
          worstProfitSku={worstProfitSku}
          loading={loading}
          periodLabel={periodLabel}
        />
      </section>

      {/* 6. Operational Task Performance (Full Width) */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="glass-pill h-6 px-2 rounded-md border border-indigo-500/30 bg-indigo-500/10 font-bold text-[10px] uppercase tracking-wider text-indigo-300"
          >
            Operations
          </Badge>
          <h2 className="text-lg font-black tracking-tight text-white font-headline">
            Team Task Performance & Tracking
          </h2>
        </div>
        <TaskPerformanceCard data={trackRecord} loading={loading} />
      </section>
    </div>
  );
}
