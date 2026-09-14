'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ShieldAlert, Droplets, CheckCircle2, AlertTriangle } from 'lucide-react';
import { formatINR } from '@/lib/format';
import { cn } from '@/lib/utils';
import { ProfitLeakageBreakdown } from '@/lib/analytics/reports-engine';

interface ProfitLeakageCardProps {
  leakage: ProfitLeakageBreakdown | null;
  loading: boolean;
}

export function ProfitLeakageCard({ leakage, loading }: ProfitLeakageCardProps) {
  if (loading || !leakage) {
    return (
      <Card className="glass-panel border-white/10 bg-slate-900/40 p-6 rounded-3xl">
        <Skeleton className="h-6 w-36 bg-white/10 mb-3" />
        <Skeleton className="h-12 w-full bg-white/5 rounded-2xl mb-4" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-8 w-full bg-white/5 rounded-xl" />
          ))}
        </div>
      </Card>
    );
  }

  const {
    grossInvoiceSales,
    netRealizedProfit,
    netRetentionRate,
    cogs,
    packaging,
    logisticsTotal,
    returnShipping,
    marketplaceFees,
    adSpend,
    totalLeakage,
    totalLeakagePercentage,
  } = leakage;

  const isHealthyRetention = netRetentionRate >= 20;
  const isModerateRetention = netRetentionRate >= 10 && netRetentionRate < 20;

  const leakageCategories = [
    { label: 'Product Cost (COGS)', amount: cogs.amount, percent: cogs.percentage, color: 'bg-amber-500' },
    { label: 'Total Logistics (Freight)', amount: logisticsTotal.amount, percent: logisticsTotal.percentage, color: 'bg-rose-500' },
    { label: 'Platform Fees & Comm.', amount: marketplaceFees.amount, percent: marketplaceFees.percentage, color: 'bg-purple-500' },
    { label: 'Packaging Materials', amount: packaging.amount, percent: packaging.percentage, color: 'bg-indigo-500' },
    { label: 'Campaign Ad Spend', amount: adSpend.amount, percent: adSpend.percentage, color: 'bg-pink-500' },
  ];

  return (
    <Card className="glass-panel border-white/10 bg-slate-900/40 rounded-3xl p-6 shadow-xl backdrop-blur-xl flex flex-col justify-between">
      <div>
        <CardHeader className="p-0 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="glass-pill h-6 px-2 rounded-md border border-rose-500/30 bg-rose-500/10 font-bold text-[10px] uppercase tracking-wider text-rose-300"
              >
                Leakage Audit
              </Badge>
              <CardTitle className="text-base sm:text-lg font-black tracking-tight text-white font-headline">
                Profit Leakage
              </CardTitle>
            </div>
            <div className="flex items-center gap-1.5">
              <Droplets className="h-4 w-4 text-rose-400" />
            </div>
          </div>
        </CardHeader>

        {/* Primary Retention Hero Card */}
        <div className="p-4 rounded-2xl bg-slate-950/60 border border-white/10 mb-4 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-0.5">
              Net Profit Retention Rate
            </span>
            <div className="flex items-baseline gap-2">
              <span
                className={cn(
                  'text-3xl font-black font-headline tracking-tight',
                  isHealthyRetention
                    ? 'text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.35)]'
                    : isModerateRetention
                    ? 'text-amber-400'
                    : 'text-rose-400'
                )}
              >
                {netRetentionRate}%
              </span>
              <span className="text-xs text-slate-400 font-medium">
                ({formatINR(netRealizedProfit)} net from {formatINR(grossInvoiceSales)})
              </span>
            </div>
          </div>

          <div
            className={cn(
              'px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider border flex items-center gap-1',
              isHealthyRetention
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                : isModerateRetention
                ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
            )}
          >
            {isHealthyRetention ? (
              <CheckCircle2 className="h-3 w-3" />
            ) : (
              <AlertTriangle className="h-3 w-3" />
            )}
            <span>
              {isHealthyRetention
                ? 'Strong Retention'
                : isModerateRetention
                ? 'Moderate Margin Drag'
                : 'Severe Leakage'}
            </span>
          </div>
        </div>

        {/* Breakdown bars */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            <span>Deduction Component</span>
            <span>Share of Gross Sales</span>
          </div>

          {leakageCategories.map((cat, i) => (
            <div key={i} className="space-y-1">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-200">{cat.label}</span>
                <span className="font-mono font-bold text-slate-300">
                  {formatINR(cat.amount)} ({cat.percent}%)
                </span>
              </div>
              <div className="h-1.5 w-full bg-slate-950/60 rounded-full overflow-hidden border border-white/5">
                <div
                  className={cn('h-full rounded-full transition-all duration-500', cat.color)}
                  style={{ width: `${Math.min(100, cat.percent)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="pt-4 mt-4 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400">
        <span>Total Operational Shrinkage</span>
        <span className="font-bold text-rose-400">{formatINR(totalLeakage)} ({totalLeakagePercentage}%)</span>
      </div>
    </Card>
  );
}
