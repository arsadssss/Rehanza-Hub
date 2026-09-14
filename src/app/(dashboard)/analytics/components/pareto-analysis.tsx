'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PieChart, Sparkles, TrendingUp, AlertTriangle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ParetoConcentration } from '@/lib/analytics/reports-engine';

interface ParetoAnalysisProps {
  pareto: ParetoConcentration | null;
  loading: boolean;
}

export function ParetoAnalysis({ pareto, loading }: ParetoAnalysisProps) {
  if (loading || !pareto) {
    return (
      <Card className="glass-panel border-white/10 bg-slate-900/40 p-6 rounded-3xl">
        <Skeleton className="h-6 w-44 bg-white/10 mb-4" />
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full bg-white/5 rounded-2xl" />
          ))}
        </div>
      </Card>
    );
  }

  const {
    totalSkus,
    top20PercentSkuCount,
    revenueSharePercent,
    profitSharePercent,
    returnSharePercent,
    concentrationSummary,
  } = pareto;

  return (
    <Card className="glass-panel border-white/10 bg-slate-900/40 rounded-3xl p-6 shadow-xl backdrop-blur-xl space-y-5">
      <CardHeader className="p-0">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="glass-pill h-6 px-2 rounded-md border border-indigo-500/30 bg-indigo-500/10 font-bold text-[10px] uppercase tracking-wider text-indigo-300"
              >
                Pareto 80/20
              </Badge>
              <CardTitle className="text-base sm:text-lg font-black tracking-tight text-white font-headline">
                Catalog Mix
              </CardTitle>
            </div>
          </div>
          <Sparkles className="h-5 w-5 text-indigo-400" />
        </div>
      </CardHeader>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Revenue Concentration */}
        <div className="p-4 rounded-2xl bg-slate-950/60 border border-white/10 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Top 20% Revenue Share
            </span>
            <span className="text-xs font-bold text-blue-400">Sales</span>
          </div>
          <div className="text-3xl font-black font-headline text-blue-400">
            {revenueSharePercent}%
          </div>
          <p className="text-[11px] text-slate-400">
            Driven by top {top20PercentSkuCount} products (of {totalSkus} total SKUs)
          </p>
        </div>

        {/* Profit Concentration */}
        <div className="p-4 rounded-2xl bg-slate-950/60 border border-white/10 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Top 20% Margin Share
            </span>
            <span className="text-xs font-bold text-emerald-400">Profit</span>
          </div>
          <div className="text-3xl font-black font-headline text-emerald-400">
            {profitSharePercent}%
          </div>
          <p className="text-[11px] text-slate-400">
            Share of company net profit concentrated in top performers
          </p>
        </div>

        {/* Return Concentration */}
        <div className="p-4 rounded-2xl bg-slate-950/60 border border-white/10 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Top 20% Return Share
            </span>
            <span className="text-xs font-bold text-rose-400">Reverse Loss</span>
          </div>
          <div className="text-3xl font-black font-headline text-rose-400">
            {returnSharePercent}%
          </div>
          <p className="text-[11px] text-slate-400">
            Proportion of all returns caused by the worst {top20PercentSkuCount} SKUs
          </p>
        </div>
      </div>

      <div className="p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center gap-3">
        <Info className="h-4 w-4 text-indigo-400 shrink-0" />
        <p className="text-xs text-indigo-200 font-medium">{concentrationSummary}</p>
      </div>
    </Card>
  );
}
