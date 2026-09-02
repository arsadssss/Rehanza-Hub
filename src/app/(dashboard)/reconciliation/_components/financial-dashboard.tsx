'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/apiFetch';
import { PeriodFilter } from './period-filter';
import { FinancialKpiGrid } from './financial-kpi-grid';
import { ProfitLossChart } from './profit-loss-chart';
import { OrderPerformance } from './order-performance';
import { FinancialBreakdown } from './financial-breakdown';
import { FinancialTable } from './financial-table';
import { SkuAnalyticsSection } from './sku-analytics-section';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, RotateCcw, Inbox, UploadCloud } from 'lucide-react';
import { FinancialSummary, ReconciliationDateFilter } from '@/lib/reconciliation/types';

interface FinancialDashboardProps {
  accountId: string;
  refreshTrigger?: number; // Increment to trigger refresh from parent
}

export function FinancialDashboard({ accountId, refreshTrigger }: FinancialDashboardProps) {
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ReconciliationDateFilter>({ range: 'all' });

  // Fetch financial summary from Phase 2A API
  const fetchFinancials = useCallback(async (activeFilter: ReconciliationDateFilter) => {
    if (!accountId) return;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (activeFilter.range) params.set('range', activeFilter.range);
      if (activeFilter.month) params.set('month', activeFilter.month);
      if (activeFilter.year) params.set('year', activeFilter.year.toString());
      if (activeFilter.startDate) params.set('startDate', activeFilter.startDate);
      if (activeFilter.endDate) params.set('endDate', activeFilter.endDate);

      const res = await apiFetch(`/api/reconciliation/financials?${params.toString()}`);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to fetch financial reconciliation data');
      }

      const data = await res.json();
      setSummary(data.summary || null);
    } catch (err: any) {
      console.error('Financial Dashboard fetch error:', err);
      setError(err.message || 'Failed to communicate with reconciliation service.');
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    fetchFinancials(filter);
  }, [fetchFinancials, filter, refreshTrigger]);

  const handleFilterChange = (newFilter: ReconciliationDateFilter) => {
    setFilter(newFilter);
  };

  const handleRefresh = () => {
    fetchFinancials(filter);
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Period Filter */}
      <PeriodFilter
        currentFilter={filter}
        periodLabel={summary?.period?.label}
        onFilterChange={handleFilterChange}
        onRefresh={handleRefresh}
        loading={loading}
      />

      {/* 2. Error State */}
      {error && !loading && (
        <Card className="glass-panel bg-rose-950/30 border-rose-500/40 rounded-2xl p-5 text-center shadow-[0_8px_30px_rgba(0,0,0,0.25)]">
          <CardContent className="p-0 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-left">
              <div className="h-10 w-10 rounded-xl bg-rose-500/20 text-rose-300 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-white">Error Loading Financial Overview</h4>
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

      {/* 3. Empty State Banner (When not loading, no error, but 0 total orders & 0 sales) */}
      {!loading && !error && summary && summary.orders.totalOrders === 0 && summary.totalSalesInvoice === 0 && (
        <Card className="glass-panel bg-slate-950/60 border-white/15 rounded-2xl p-6 text-center shadow-[0_8px_30px_rgba(0,0,0,0.25)]">
          <CardContent className="p-0 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 text-left">
              <div className="h-10 w-10 rounded-xl bg-indigo-500/15 border border-indigo-400/30 flex items-center justify-center text-indigo-400 flex-shrink-0">
                <Inbox className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-black text-sm text-white">No Reconciliation Data for this Period</h4>
                <p className="text-xs text-slate-300 mt-0.5">
                  Import Meesho Order, Payment, and Ads files below to generate the financial overview.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-indigo-300 font-bold bg-indigo-500/10 px-3 py-1.5 rounded-xl border border-indigo-400/20">
              <UploadCloud className="h-4 w-4" />
              <span>Use Data Ingestion Section Below</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 4. Primary KPI Cards */}
      <FinancialKpiGrid summary={summary} loading={loading} />

      {/* 5. Profit / Loss Flow Chart */}
      <ProfitLossChart summary={summary} loading={loading} />

      {/* 6. Order Performance (Donut Chart & Status Breakdown Table) */}
      <OrderPerformance
        orders={summary?.orders || null}
        averageOrderValue={summary?.averageOrderValue || 0}
        loading={loading}
      />

      {/* 7. Detailed Financial Cost Breakdown */}
      <FinancialBreakdown
        costs={summary?.costs || null}
        gstRate={summary?.gstRate || 0.18}
        gstInputAmount={summary?.gstInputAmount || 0}
        orderLevelWorkingSheetProfit={summary?.orderLevelWorkingSheetProfit || 0}
        a24NetCashflow={summary?.a24NetCashflow || 0}
        finalPayoutNetProfit={summary?.finalPayoutNetProfit || 0}
        loading={loading}
      />

      {/* 8. Detailed Auditable Financial Ledger Table */}
      <FinancialTable summary={summary} loading={loading} />

      {/* 9. PHASE 3: SKU Profitability & Financial Analytics */}
      <SkuAnalyticsSection
        accountId={accountId}
        filter={filter}
        refreshTrigger={refreshTrigger}
      />
    </div>
  );
}

