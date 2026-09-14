'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertOctagon,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  StopCircle,
  TrendingUp,
  Target
} from 'lucide-react';
import { formatINR } from '@/lib/format';
import { cn } from '@/lib/utils';
import { ManagementAttentionBoard } from '@/lib/analytics/reports-engine';

interface ExecutiveActionBoardProps {
  board: ManagementAttentionBoard | null;
  loading: boolean;
}

export function ExecutiveActionBoard({ board, loading }: ExecutiveActionBoardProps) {
  if (loading || !board) {
    return (
      <Card className="glass-panel border-white/10 bg-slate-900/40 p-6 rounded-3xl">
        <Skeleton className="h-6 w-52 bg-white/10 mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 w-full bg-white/5 rounded-2xl" />
          ))}
        </div>
      </Card>
    );
  }

  const { top3ProfitBleeders, top3MarginExpanders, directives } = board;

  return (
    <div className="space-y-6">
      {/* 1. Directives Action Row */}
      <Card className="glass-panel border-white/10 bg-slate-900/40 rounded-3xl p-6 shadow-xl backdrop-blur-xl">
        <CardHeader className="p-0 pb-5">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className="glass-pill h-6 px-2 rounded-md border border-amber-500/30 bg-amber-500/10 font-bold text-[10px] uppercase tracking-wider text-amber-300"
                >
                  Action Directives
                </Badge>
                <CardTitle className="text-base sm:text-lg font-black tracking-tight text-white font-headline">
                  Actions
                </CardTitle>
              </div>
            </div>
            <Target className="h-5 w-5 text-amber-400" />
          </div>
        </CardHeader>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {directives.map((dir, idx) => (
            <div
              key={idx}
              className={cn(
                'p-4 rounded-2xl border flex flex-col justify-between space-y-3 transition-all',
                dir.priority === 1
                  ? 'bg-rose-500/10 border-rose-500/30 shadow-[0_0_15px_rgba(244,63,94,0.1)]'
                  : dir.priority === 2
                  ? 'bg-emerald-500/10 border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.1)]'
                  : 'bg-indigo-500/10 border-indigo-500/30'
              )}
            >
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border',
                      dir.priority === 1
                        ? 'border-rose-400/40 bg-rose-500/20 text-rose-300'
                        : dir.priority === 2
                        ? 'border-emerald-400/40 bg-emerald-500/20 text-emerald-300'
                        : 'border-indigo-400/40 bg-indigo-500/20 text-indigo-300'
                    )}
                  >
                    Priority {dir.priority} Directive
                  </Badge>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    {dir.type.replace('_', ' ')}
                  </span>
                </div>

                <h4 className="text-sm font-bold text-white tracking-tight">{dir.title}</h4>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">{dir.actionText}</p>
              </div>

              <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px]">
                <span className="text-slate-400 font-medium">Estimated Impact:</span>
                <span className="font-bold text-white">{dir.impactEstimate}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* 2. Top 3 Bleeders & Expanders Split */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 3 Profit Bleeders */}
        <Card className="glass-panel border-white/10 bg-slate-900/40 rounded-3xl p-6 shadow-xl backdrop-blur-xl">
          <CardHeader className="p-0 pb-4 flex flex-row items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className="glass-pill h-6 px-2 rounded-md border border-rose-500/30 bg-rose-500/10 font-bold text-[10px] uppercase tracking-wider text-rose-300"
                >
                  Bleeders
                </Badge>
                <CardTitle className="text-sm sm:text-base font-black tracking-tight text-white font-headline">
                  Profit Bleeders
                </CardTitle>
              </div>
            </div>
            <StopCircle className="h-5 w-5 text-rose-400" />
          </CardHeader>

          <CardContent className="p-0 space-y-3">
            {top3ProfitBleeders.length === 0 ? (
              <p className="text-xs text-slate-400 italic p-3">No negative profit SKUs identified.</p>
            ) : (
              top3ProfitBleeders.map((b, i) => (
                <div
                  key={i}
                  className="p-3.5 rounded-2xl bg-slate-950/60 border border-white/5 hover:border-rose-500/30 transition-all flex items-center justify-between gap-3"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-rose-400 font-mono">{b.sku}</span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">
                        ({b.orders} orders)
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 line-clamp-1">{b.productName}</p>
                    <span className="text-[10px] text-rose-300/80 font-medium block">
                      Root Cause: {b.primaryCause}
                    </span>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-sm font-black font-headline text-rose-400 block">
                      -{formatINR(b.lossAmount)}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Ret: {b.returnRate}% | RTO: {b.rtoRate}%
                    </span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Top 3 Margin Expanders */}
        <Card className="glass-panel border-white/10 bg-slate-900/40 rounded-3xl p-6 shadow-xl backdrop-blur-xl">
          <CardHeader className="p-0 pb-4 flex flex-row items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className="glass-pill h-6 px-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 font-bold text-[10px] uppercase tracking-wider text-emerald-300"
                >
                  Expanders
                </Badge>
                <CardTitle className="text-sm sm:text-base font-black tracking-tight text-white font-headline">
                  Margin Expanders
                </CardTitle>
              </div>
            </div>
            <TrendingUp className="h-5 w-5 text-emerald-400" />
          </CardHeader>

          <CardContent className="p-0 space-y-3">
            {top3MarginExpanders.length === 0 ? (
              <p className="text-xs text-slate-400 italic p-3">No positive profit SKUs identified.</p>
            ) : (
              top3MarginExpanders.map((e, i) => (
                <div
                  key={i}
                  className="p-3.5 rounded-2xl bg-slate-950/60 border border-white/5 hover:border-emerald-500/30 transition-all flex items-center justify-between gap-3"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-emerald-400 font-mono">{e.sku}</span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">
                        ({e.orders} orders)
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 line-clamp-1">{e.productName}</p>
                    <span className="text-[10px] text-emerald-300/80 font-medium block">
                      Status: {e.scalingReadiness}
                    </span>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-sm font-black font-headline text-emerald-400 block">
                      +{formatINR(e.profit)}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Margin: {e.margin}% | Ret: {e.returnRate}%
                    </span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
