'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/apiFetch';
import { SkuRankingCards } from './sku-ranking-cards';
import { BusinessIntelligence } from './business-intelligence';
import { DailyFinancialChart } from './daily-financial-chart';
import { ReturnRtoAnalysis } from './return-rto-analysis';
import { LossConcentration } from './loss-concentration';
import { SkuTable } from './sku-table';
import { TopTenTables } from './top-ten-tables';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, RotateCcw, BarChart2, Inbox, UploadCloud } from 'lucide-react';
import {
  ReconciliationDateFilter,
  SkuProfitabilityMetric,
  SkuRankings,
  DailyFinancialMetric,
  LossConcentrationItem,
  TopReturnRtoItem,
  TopPerformingProductItem,
} from '@/lib/reconciliation/types';

interface SkuAnalyticsSectionProps {
  accountId: string;
  filter: ReconciliationDateFilter;
  refreshTrigger?: number;
}

export function SkuAnalyticsSection({
  accountId,
  filter,
  refreshTrigger,
}: SkuAnalyticsSectionProps) {
  const [skus, setSkus] = useState<SkuProfitabilityMetric[]>([]);
  const [rankings, setRankings] = useState<SkuRankings | null>(null);
  const [lossConcentration, setLossConcentration] = useState<LossConcentrationItem[]>([]);
  const [dailyTrends, setDailyTrends] = useState<DailyFinancialMetric[]>([]);
  const [topReturnsRto, setTopReturnsRto] = useState<{
    combined: TopReturnRtoItem[];
    returnsOnly: TopReturnRtoItem[];
    rtoOnly: TopReturnRtoItem[];
  } | undefined>(undefined);
  const [topPerformingProducts, setTopPerformingProducts] = useState<TopPerformingProductItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSkuAnalytics = useCallback(async () => {
    if (!accountId) return;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (filter.range) params.set('range', filter.range);
      if (filter.month) params.set('month', filter.month);
      if (filter.year) params.set('year', filter.year.toString());
      if (filter.startDate) params.set('startDate', filter.startDate);
      if (filter.endDate) params.set('endDate', filter.endDate);

      const res = await apiFetch(`/api/reconciliation/sku-analytics?${params.toString()}`);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || 'Failed to fetch SKU analytics data');
      }

      const data = await res.json();
      setSkus(data.skus || []);
      setRankings(data.rankings || null);
      setLossConcentration(data.lossConcentration || []);
      setDailyTrends(data.dailyTrends || []);
      setTopReturnsRto(data.topReturnsRto);
      setTopPerformingProducts(data.topPerformingProducts || []);
    } catch (err: any) {
      console.error('SKU analytics fetch error:', err);
      setError(err.message || 'Failed to communicate with SKU analytics service.');
    } finally {
      setLoading(false);
    }
  }, [accountId, filter]);

  useEffect(() => {
    fetchSkuAnalytics();
  }, [fetchSkuAnalytics, refreshTrigger]);

  const handleRetry = () => {
    fetchSkuAnalytics();
  };

  return (
    <div className="space-y-6 pt-2">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-white/10">
        <div>
          <h2 className="text-xl sm:text-2xl font-black font-headline tracking-tight text-white flex items-center gap-2">
            <BarChart2 className="h-6 w-6 text-indigo-400" />
            <span>SKU Profitability & Financial Analytics</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 font-medium mt-0.5">
            Unit economics, catalog profit concentration, daily trends & loss drivers
          </p>
        </div>
      </div>

      {/* Error State */}
      {error && !loading && (
        <Card className="glass-panel bg-rose-950/30 border-rose-500/40 rounded-2xl p-5 shadow-[0_8px_30px_rgba(0,0,0,0.25)]">
          <CardContent className="p-0 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-rose-500/20 text-rose-300 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-white">Error Loading SKU Analytics</h4>
                <p className="text-xs text-rose-300 mt-0.5">{error}</p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRetry}
              className="glass-button bg-rose-900/40 border-rose-400/30 text-white text-xs font-bold rounded-xl"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Empty State Banner (if no SKUs exist) */}
      {!loading && !error && skus.length === 0 && (
        <Card className="glass-panel bg-slate-950/60 border-white/15 rounded-2xl p-6 text-center shadow-[0_8px_30px_rgba(0,0,0,0.25)]">
          <CardContent className="p-0 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 text-left">
              <div className="h-10 w-10 rounded-xl bg-indigo-500/15 border border-indigo-400/30 flex items-center justify-center text-indigo-400 flex-shrink-0">
                <Inbox className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-black text-sm text-white">No SKU Analytics Available for this Period</h4>
                <p className="text-xs text-slate-300 mt-0.5">
                  Upload Orders, Payments and RM Ads to generate profitability analytics.
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

      {/* 1. Top & Worst SKU Cards */}
      <SkuRankingCards rankings={rankings} loading={loading} />

      {/* 2. PHASE 4: Business Intelligence & Scaling Decisions */}
      <BusinessIntelligence
        accountId={accountId}
        filter={filter}
        refreshTrigger={refreshTrigger}
      />

      {/* 3. Daily Financial Trends (Revenue & Profit/Loss) */}
      <DailyFinancialChart dailyTrends={dailyTrends} loading={loading} />

      {/* 4. Return & RTO Fulfillment Benchmarking */}
      <ReturnRtoAnalysis skus={skus} loading={loading} />

      {/* 5. Excel Parity: Top 10 Performing & Top 10 Returns/RTO Leaderboards */}
      <TopTenTables
        topPerformingProducts={topPerformingProducts}
        topReturnsRto={topReturnsRto}
        loading={loading}
      />

      {/* 6. Loss & Deduction Concentration */}
      <LossConcentration lossConcentration={lossConcentration} loading={loading} />

      {/* 5. Detailed SKU Performance Master Table */}
      <SkuTable skus={skus} loading={loading} />
    </div>
  );
}

