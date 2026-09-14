'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/apiFetch';
import { resolveActiveAccount, getStoredAccountId, ACTIVE_ACCOUNT_CHANGED_EVENT } from '@/lib/account';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  BarChart3,
  RotateCcw,
  Download,
  AlertCircle,
  Calendar,
  Layers,
  Sparkles,
  Inbox,
  TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ReconciliationDateFilter } from '@/lib/reconciliation/types';
import { ManagementReportResult } from '@/lib/analytics/reports-engine';
import { exportManagementReportToCSV } from '@/lib/analytics/export-reports-utils';

// Management Intelligence Components
import { PeriodComparisonCards } from './components/period-comparison-cards';
import { CostWaterfall } from './components/cost-waterfall';
import { ProfitLeakageCard } from './components/profit-leakage-card';
import { SettlementIntelligenceCard } from './components/settlement-intelligence-card';
import { ExecutiveActionBoard } from './components/executive-action-board';
import { MarginTrapsTable } from './components/margin-traps-table';
import { ReturnRtoDamage } from './components/return-rto-damage';
import { ParetoAnalysis } from './components/pareto-analysis';
import { BusinessTrajectory } from './components/business-trajectory';
import { AnomalyRiskMatrix } from './components/anomaly-risk-matrix';

export default function AnalyticsReportsPage() {
  const { toast } = useToast();
  const [isMounted, setIsMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Account Context
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);
  const [activeAccountName, setActiveAccountName] = useState<string>('Rehanza');

  // Report Dataset
  const [report, setReport] = useState<ManagementReportResult | null>(null);

  // Date Filter State — Default to 'all' to align with verified accounting batches
  const [filter, setFilter] = useState<ReconciliationDateFilter>({ range: 'all' });

  // Fetch Management Report from Backend Engine
  const fetchReportData = useCallback(
    async (targetAccountId?: string, activeFilter?: ReconciliationDateFilter) => {
      const accId = targetAccountId || activeAccountId || getStoredAccountId();
      if (!accId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      const f = activeFilter || filter;
      const params = new URLSearchParams();
      if (f.range) params.set('range', f.range);
      if (f.month) params.set('month', f.month);
      if (f.year) params.set('year', f.year.toString());
      if (f.startDate) params.set('startDate', f.startDate);
      if (f.endDate) params.set('endDate', f.endDate);

      try {
        const res = await apiFetch(`/api/analytics?${params.toString()}`, {
          headers: { 'x-account-id': accId },
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || 'Failed to fetch management analytics report');
        }

        const data = await res.json();
        if (data.report) {
          setReport(data.report);
        } else {
          throw new Error('Analytics payload format unexpected');
        }
      } catch (err: any) {
        console.error('Reports fetch error:', err);
        setError(err.message || 'Failed to generate management report');
        toast({
          variant: 'destructive',
          title: 'Report Unavailable',
          description: err.message || 'Unable to load report for selected period.',
        });
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [activeAccountId, filter, toast]
  );

  // Eager Account Resolution
  useEffect(() => {
    setIsMounted(true);

    async function initAccount() {
      const resolved = await resolveActiveAccount();
      if (resolved?.id) {
        setActiveAccountId(resolved.id);
        setActiveAccountName(resolved.name || 'Rehanza');
        fetchReportData(resolved.id);
      } else {
        setLoading(false);
      }
    }
    initAccount();

    const handleAccountChange = (e: any) => {
      const freshId = e?.detail?.id || getStoredAccountId();
      const freshName = e?.detail?.name || 'Rehanza';
      if (freshId && freshId !== activeAccountId) {
        setActiveAccountId(freshId);
        setActiveAccountName(freshName);
        fetchReportData(freshId);
      }
    };

    window.addEventListener(ACTIVE_ACCOUNT_CHANGED_EVENT, handleAccountChange);
    return () => window.removeEventListener(ACTIVE_ACCOUNT_CHANGED_EVENT, handleAccountChange);
  }, []);

  // Handle Filter Change
  const handleRangeSelect = (preset: 'all' | '7d' | '30d' | '90d') => {
    const newFilter: ReconciliationDateFilter = { range: preset };
    setFilter(newFilter);
    fetchReportData(activeAccountId || undefined, newFilter);
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchReportData();
  };

  const handleExport = () => {
    if (!report) return;
    exportManagementReportToCSV(report, `Management-Report-${report.period.label.replace(/\s+/g, '_')}.csv`);
    toast({
      title: 'Report Exported',
      description: `CSV file downloaded for ${report.period.label}.`,
    });
  };

  if (!isMounted) return null;

  return (
    <div className="relative min-h-screen space-y-8 p-3 sm:p-6 lg:p-8 max-w-[1600px] mx-auto font-body w-full max-w-full overflow-x-hidden min-w-0">
      {/* 1. Header Toolbar */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 pb-4 border-b border-white/10">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight font-headline text-white flex items-center gap-2.5">
            <BarChart3 className="h-7 w-7 text-indigo-400" />
            <span>Reports</span>
          </h1>
          {activeAccountId && (
            <Badge
              variant="outline"
              className="glass-pill h-7 px-2.5 rounded-lg border border-indigo-400/30 bg-indigo-500/10 font-bold text-xs text-indigo-300 shadow-sm"
            >
              Account: {activeAccountName}
            </Badge>
          )}
          <Badge
            variant="outline"
            className="glass-pill h-7 px-2.5 rounded-lg border border-emerald-400/30 bg-emerald-500/10 font-bold text-xs text-emerald-300 shadow-sm"
          >
            Marketplace: Meesho (Authoritative)
          </Badge>
        </div>

        {/* Action Buttons & Period Pills */}
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 w-full lg:w-auto justify-start lg:justify-end">
          {/* Period Selector Pills */}
          <div className="flex items-center p-1 rounded-xl bg-slate-900/80 border border-white/10 shadow-sm">
            <button
              type="button"
              onClick={() => handleRangeSelect('all')}
              className={cn(
                'px-3 py-1 text-xs font-bold rounded-lg transition-all',
                filter.range === 'all'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              )}
            >
              All Time
            </button>
            <button
              type="button"
              onClick={() => handleRangeSelect('30d')}
              className={cn(
                'px-3 py-1 text-xs font-bold rounded-lg transition-all',
                filter.range === '30d'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              )}
            >
              30 Days
            </button>
            <button
              type="button"
              onClick={() => handleRangeSelect('90d')}
              className={cn(
                'px-3 py-1 text-xs font-bold rounded-lg transition-all',
                filter.range === '90d'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              )}
            >
              90 Days
            </button>
          </div>

          {/* Refresh Button */}
          <Button
            onClick={handleRefresh}
            disabled={loading || refreshing}
            size="sm"
            variant="outline"
            className="glass-button bg-slate-900/80 border-white/15 text-white h-9 px-3 rounded-xl hover:bg-white/10 flex items-center gap-1.5"
            title="Refresh Report"
          >
            <RotateCcw className={cn('h-3.5 w-3.5', (loading || refreshing) && 'animate-spin')} />
            <span className="text-xs font-semibold hidden sm:inline">Refresh</span>
          </Button>

          {/* Export CSV Button */}
          <Button
            onClick={handleExport}
            disabled={loading || !report}
            size="sm"
            variant="outline"
            className="glass-button bg-indigo-600/30 border-indigo-400/30 text-indigo-200 hover:bg-indigo-600/50 hover:text-white h-9 px-3 rounded-xl flex items-center gap-1.5 shadow-sm"
            title="Export CSV Report"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="text-xs font-bold">Export CSV</span>
          </Button>
        </div>
      </div>

      {/* Account Verification Warning if missing */}
      {!activeAccountId && (
        <Card className="glass-panel bg-slate-950/60 p-8 rounded-2xl border border-white/15 text-center shadow-[0_8px_30px_rgba(0,0,0,0.25)]">
          <CardContent className="p-0 flex flex-col items-center justify-center space-y-2">
            <AlertCircle className="h-8 w-8 text-amber-400" />
            <h3 className="font-bold text-base text-white">No Active Account Selected</h3>
            <p className="text-xs text-slate-300 max-w-sm">
              Please select an active account in the top navigation bar to generate the management report.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Error Card */}
      {error && !loading && (
        <Card className="glass-panel bg-rose-950/30 border-rose-500/40 rounded-2xl p-5 text-center shadow-[0_8px_30px_rgba(0,0,0,0.25)]">
          <CardContent className="p-0 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-left">
              <div className="h-10 w-10 rounded-xl bg-rose-500/20 text-rose-300 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-white">Error Generating Management Report</h4>
                <p className="text-xs text-rose-300 mt-0.5">{error}</p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              className="glass-button bg-rose-900/40 border-rose-400/30 text-white text-xs font-bold rounded-xl"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Empty State Banner when 0 records exist in filtered period */}
      {!loading && !error && report && report.summaryParity.totalOrders === 0 && (
        <Card className="glass-panel bg-slate-950/60 border-white/15 rounded-2xl p-6 text-center shadow-lg">
          <CardContent className="p-0 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 text-left">
              <div className="h-10 w-10 rounded-xl bg-amber-500/15 border border-amber-400/30 flex items-center justify-center text-amber-400 shrink-0">
                <Inbox className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-black text-sm text-white">No Transactions in Selected Window</h4>
                <p className="text-xs text-slate-300 mt-0.5">
                  The current transaction batch is from August 2026. Switch filter to &quot;All Time&quot; to inspect the complete accounting batch.
                </p>
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={() => handleRangeSelect('all')}
              className="glass-button bg-indigo-600 text-white text-xs font-bold rounded-xl px-4"
            >
              Switch to All Time
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Active Management Reporting Suite */}
      {activeAccountId && (
        <div className="space-y-8 w-full max-w-full min-w-0">
          {/* SECTION 1: Period-over-Period Performance Bridge */}
          <section className="space-y-3 w-full max-w-full min-w-0">
            <PeriodComparisonCards
              comparison={report?.periodComparison || null}
              loading={loading}
            />
          </section>

          {/* SECTION 2: Value Chain Economics & Accounting Waterfall */}
          <section className="space-y-3 w-full max-w-full min-w-0">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch w-full max-w-full min-w-0">
              <div className="lg:col-span-7 min-w-0 max-w-full">
                <CostWaterfall
                  steps={report?.costWaterfall || null}
                  loading={loading}
                />
              </div>
              <div className="lg:col-span-5 min-w-0 max-w-full">
                <ProfitLeakageCard
                  leakage={report?.profitLeakage || null}
                  loading={loading}
                />
              </div>
            </div>
          </section>

          {/* SECTION 3: Settlement Realization & Pareto Concentration */}
          <section className="space-y-3 w-full max-w-full min-w-0">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch w-full max-w-full min-w-0">
              <div className="lg:col-span-6 min-w-0 max-w-full">
                <SettlementIntelligenceCard
                  intelligence={report?.settlementIntelligence || null}
                  loading={loading}
                />
              </div>
              <div className="lg:col-span-6 min-w-0 max-w-full">
                <ParetoAnalysis
                  pareto={report?.paretoConcentration || null}
                  loading={loading}
                />
              </div>
            </div>
          </section>

          {/* SECTION 4: Executive Action Board & Management Directives */}
          <section className="space-y-3 w-full max-w-full min-w-0">
            <ExecutiveActionBoard
              board={report?.managementAttentionBoard || null}
              loading={loading}
            />
          </section>

          {/* SECTION 5: Margin Traps & Return/RTO Impact Diagnostic */}
          <section className="space-y-6 w-full max-w-full min-w-0">
            <div className="min-w-0 max-w-full">
              <MarginTrapsTable
                marginTraps={report?.marginTraps || null}
                loading={loading}
              />
            </div>

            <div className="min-w-0 max-w-full">
              <ReturnRtoDamage
                report={report?.returnRtoDamage || null}
                loading={loading}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch w-full max-w-full min-w-0">
              <div className="lg:col-span-7 min-w-0 max-w-full">
                <BusinessTrajectory
                  dates={report?.businessTrajectory.dates || []}
                  netMargins={report?.businessTrajectory.netMargins || []}
                  costToSalesRatios={report?.businessTrajectory.costToSalesRatios || []}
                  loading={loading}
                />
              </div>
              <div className="lg:col-span-5 min-w-0 max-w-full">
                <AnomalyRiskMatrix
                  anomalies={report?.anomalyMatrix || null}
                  loading={loading}
                />
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
