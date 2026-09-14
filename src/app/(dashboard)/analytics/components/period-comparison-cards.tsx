'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  TrendingUp,
  TrendingDown,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  ShoppingCart,
  Percent,
  Gauge
} from 'lucide-react';
import { formatINR } from '@/lib/format';
import { cn } from '@/lib/utils';
import { PeriodComparison } from '@/lib/analytics/reports-engine';

interface PeriodComparisonCardsProps {
  comparison: PeriodComparison | null;
  loading: boolean;
}

export function PeriodComparisonCards({ comparison, loading }: PeriodComparisonCardsProps) {
  if (loading || !comparison) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="glass-panel border-white/10 bg-slate-900/40 p-5 rounded-2xl">
            <Skeleton className="h-4 w-24 bg-white/10 mb-2" />
            <Skeleton className="h-8 w-32 bg-white/15 mb-2" />
            <Skeleton className="h-4 w-20 bg-white/5" />
          </Card>
        ))}
      </div>
    );
  }

  const { revenue, netProfit, orders, margin, profitVelocity, hasPriorData, priorLabel } = comparison;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="glass-pill h-6 px-2 rounded-md border border-indigo-500/30 bg-indigo-500/10 font-bold text-[10px] uppercase tracking-wider text-indigo-300"
          >
            PoP Variance
          </Badge>
          <h3 className="text-sm sm:text-base font-black tracking-tight text-white font-headline">
            Performance
          </h3>
        </div>
        <span className="text-[11px] font-semibold text-slate-400">
          {hasPriorData ? `Compared to: ${priorLabel}` : 'Baseline period established'}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Revenue Growth */}
        <Card className="glass-panel relative overflow-hidden rounded-2xl border border-white/10 bg-slate-900/40 p-5 shadow-lg backdrop-blur-xl">
          <CardContent className="p-0 flex flex-col justify-between h-full space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Gross Sales Growth
              </span>
              <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
                <DollarSign className="h-4 w-4" />
              </div>
            </div>

            <div>
              <div className="text-2xl font-black font-headline tracking-tight text-white">
                {formatINR(revenue.current)}
              </div>
              <div className="flex items-center gap-2 mt-1">
                {hasPriorData && revenue.deltaPercent !== null ? (
                  <span
                    className={cn(
                      'inline-flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-md',
                      revenue.deltaPercent >= 0
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : 'bg-rose-500/15 text-rose-400'
                    )}
                  >
                    {revenue.deltaPercent >= 0 ? (
                      <ArrowUpRight className="h-3 w-3" />
                    ) : (
                      <ArrowDownRight className="h-3 w-3" />
                    )}
                    {Math.abs(revenue.deltaPercent)}%
                  </span>
                ) : (
                  <span className="text-[11px] font-medium text-slate-400">Current Sales Total</span>
                )}
                {hasPriorData && (
                  <span className="text-[11px] text-slate-400">vs {formatINR(revenue.prior)}</span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 2. Profit Growth */}
        <Card className="glass-panel relative overflow-hidden rounded-2xl border border-white/10 bg-slate-900/40 p-5 shadow-lg backdrop-blur-xl">
          <CardContent className="p-0 flex flex-col justify-between h-full space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Net Profit Growth
              </span>
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                <TrendingUp className="h-4 w-4" />
              </div>
            </div>

            <div>
              <div
                className={cn(
                  'text-2xl font-black font-headline tracking-tight',
                  netProfit.current >= 0 ? 'text-emerald-400' : 'text-rose-400'
                )}
              >
                {formatINR(netProfit.current)}
              </div>
              <div className="flex items-center gap-2 mt-1">
                {hasPriorData && netProfit.deltaPercent !== null ? (
                  <span
                    className={cn(
                      'inline-flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-md',
                      netProfit.deltaPercent >= 0
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : 'bg-rose-500/15 text-rose-400'
                    )}
                  >
                    {netProfit.deltaPercent >= 0 ? (
                      <ArrowUpRight className="h-3 w-3" />
                    ) : (
                      <ArrowDownRight className="h-3 w-3" />
                    )}
                    {Math.abs(netProfit.deltaPercent)}%
                  </span>
                ) : (
                  <span className="text-[11px] font-medium text-slate-400">Final Realized Payout</span>
                )}
                {hasPriorData && (
                  <span className="text-[11px] text-slate-400">vs {formatINR(netProfit.prior)}</span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 3. Margin Expansion */}
        <Card className="glass-panel relative overflow-hidden rounded-2xl border border-white/10 bg-slate-900/40 p-5 shadow-lg backdrop-blur-xl">
          <CardContent className="p-0 flex flex-col justify-between h-full space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Net Margin Shift
              </span>
              <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
                <Percent className="h-4 w-4" />
              </div>
            </div>

            <div>
              <div className="text-2xl font-black font-headline tracking-tight text-white">
                {margin.currentPercent}%
              </div>
              <div className="flex items-center gap-2 mt-1">
                {hasPriorData ? (
                  <span
                    className={cn(
                      'inline-flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-md',
                      margin.expansionBps >= 0
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : 'bg-rose-500/15 text-rose-400'
                    )}
                  >
                    {margin.expansionBps >= 0 ? '+' : ''}
                    {margin.expansionBps} bps
                  </span>
                ) : (
                  <span className="text-[11px] font-medium text-slate-400">Net Profit Margin</span>
                )}
                {hasPriorData && (
                  <span className="text-[11px] text-slate-400">
                    prior: {margin.priorPercent}%
                  </span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 4. Profit Velocity */}
        <Card className="glass-panel relative overflow-hidden rounded-2xl border border-white/10 bg-slate-900/40 p-5 shadow-lg backdrop-blur-xl">
          <CardContent className="p-0 flex flex-col justify-between h-full space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Profit Velocity
              </span>
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                <Gauge className="h-4 w-4" />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'text-base sm:text-lg font-black font-headline uppercase tracking-tight',
                    profitVelocity === 'expanding'
                      ? 'text-emerald-400'
                      : profitVelocity === 'lagging'
                      ? 'text-amber-400'
                      : profitVelocity === 'contracting'
                      ? 'text-rose-400'
                      : 'text-slate-300'
                  )}
                >
                  {profitVelocity === 'expanding'
                    ? '⚡ Expanding'
                    : profitVelocity === 'lagging'
                    ? '⚠️ Lagging'
                    : profitVelocity === 'contracting'
                    ? '🔻 Contracting'
                    : 'Balanced'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                {profitVelocity === 'expanding'
                  ? 'Profits growing faster than order volume (scale efficiency)'
                  : profitVelocity === 'lagging'
                  ? 'Order volume growing faster than profits (margin dilution)'
                  : profitVelocity === 'contracting'
                  ? 'Negative profit growth relative to baseline'
                  : 'Stable unit economics trajectory'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
