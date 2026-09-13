'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Layers, ArrowRight } from 'lucide-react';
import { formatINR } from '@/lib/format';
import { cn } from '@/lib/utils';
import { WaterfallStep } from '@/lib/analytics/reports-engine';

interface CostWaterfallProps {
  steps: WaterfallStep[] | null;
  loading: boolean;
}

export function CostWaterfall({ steps, loading }: CostWaterfallProps) {
  if (loading || !steps || steps.length === 0) {
    return (
      <Card className="glass-panel border-white/10 bg-slate-900/40 p-6 rounded-3xl">
        <Skeleton className="h-6 w-48 bg-white/10 mb-4" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-10 w-full bg-white/5 rounded-xl" />
          ))}
        </div>
      </Card>
    );
  }

  const grossSales = steps[0]?.amount || 1;

  return (
    <Card className="glass-panel border-white/10 bg-slate-900/40 rounded-3xl p-6 shadow-xl backdrop-blur-xl">
      <CardHeader className="p-0 pb-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="glass-pill h-6 px-2 rounded-md border border-cyan-500/30 bg-cyan-500/10 font-bold text-[10px] uppercase tracking-wider text-cyan-300"
              >
                Cost Waterfall
              </Badge>
              <CardTitle className="text-base sm:text-lg font-black tracking-tight text-white font-headline">
                Gross-to-Net Accounting Waterfall
              </CardTitle>
            </div>
            <CardDescription className="text-xs text-slate-300">
              Auditable step-down bridge illustrating where customer invoice revenue is absorbed across the value chain.
            </CardDescription>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Gross Invoice Baseline
            </span>
            <p className="text-lg font-black font-headline text-white">{formatINR(grossSales)}</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0 space-y-2.5">
        {steps.map((step, idx) => {
          const isStarting = step.type === 'starting';
          const isFinal = step.type === 'final';
          const isAddition = step.type === 'addition';
          const barWidthPercent = Math.min(100, Math.max(3, Math.abs((step.amount / grossSales) * 100)));

          return (
            <div
              key={idx}
              className={cn(
                'group p-3 sm:p-3.5 rounded-2xl border transition-all duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3',
                isStarting
                  ? 'bg-blue-500/10 border-blue-400/30'
                  : isFinal
                  ? 'bg-emerald-500/15 border-emerald-400/40 shadow-[0_0_20px_rgba(16,185,129,0.12)]'
                  : isAddition
                  ? 'bg-indigo-500/10 border-indigo-400/20'
                  : 'bg-slate-900/60 border-white/5 hover:border-white/15'
              )}
            >
              {/* Step info */}
              <div className="flex items-center gap-3 min-w-0 sm:min-w-[240px]">
                <div
                  className={cn(
                    'h-7 w-7 rounded-xl flex items-center justify-center text-xs font-black shrink-0',
                    isStarting
                      ? 'bg-blue-500 text-white'
                      : isFinal
                      ? 'bg-emerald-500 text-slate-950'
                      : isAddition
                      ? 'bg-indigo-500/30 text-indigo-300'
                      : 'bg-slate-800 text-slate-300'
                  )}
                >
                  {idx + 1}
                </div>
                <div className="min-w-0">
                  <h4
                    className={cn(
                      'text-xs sm:text-sm font-bold tracking-tight truncate sm:whitespace-normal',
                      isStarting
                        ? 'text-blue-200'
                        : isFinal
                        ? 'text-emerald-300 font-black'
                        : 'text-white'
                    )}
                  >
                    {step.label}
                  </h4>
                  <p className="text-[10px] text-slate-400 font-medium">
                    {isStarting
                      ? 'Starting top-line invoice'
                      : isFinal
                      ? 'Final realized ledger profit'
                      : `${step.percentOfGross}% of gross sales`}
                  </p>
                </div>
              </div>

              {/* Progress bar visual representation */}
              <div className="flex-1 hidden md:block mx-4 min-w-0">
                <div className="h-2 w-full bg-slate-950/60 rounded-full overflow-hidden border border-white/5">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-500',
                      isStarting
                        ? 'bg-blue-500'
                        : isFinal
                        ? 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]'
                        : isAddition
                        ? 'bg-indigo-400'
                        : 'bg-rose-500/80'
                    )}
                    style={{ width: `${barWidthPercent}%` }}
                  />
                </div>
              </div>

              {/* Financial values */}
              <div className="flex items-center justify-between sm:justify-end gap-3 sm:min-w-[160px] text-right">
                <div>
                  <span
                    className={cn(
                      'text-xs sm:text-sm font-black font-headline tracking-tight block',
                      isStarting
                        ? 'text-blue-300'
                        : isFinal
                        ? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.35)]'
                        : isAddition
                        ? 'text-indigo-300'
                        : 'text-rose-400'
                    )}
                  >
                    {step.amount > 0 && !isStarting && !isFinal ? '+' : ''}
                    {formatINR(step.amount)}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">
                    Run: {formatINR(step.runningTotal)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
