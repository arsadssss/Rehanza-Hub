'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatINRWithDecimals } from '@/lib/format';
import { ShieldAlert, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LossConcentrationItem } from '@/lib/reconciliation/types';

interface LossConcentrationProps {
  lossConcentration: LossConcentrationItem[] | null;
  loading: boolean;
}

const CLASSIFICATION_COLORS: Record<string, { bg: string; text: string; bar: string }> = {
  Cost: { bg: 'bg-rose-500/10 text-rose-300', text: 'text-rose-400', bar: 'bg-rose-500' },
  Logistics: { bg: 'bg-orange-500/10 text-orange-300', text: 'text-orange-400', bar: 'bg-orange-500' },
  Marketing: { bg: 'bg-pink-500/10 text-pink-300', text: 'text-pink-400', bar: 'bg-pink-500' },
  Penalty: { bg: 'bg-red-500/10 text-red-300', text: 'text-red-400', bar: 'bg-red-600' },
  Fee: { bg: 'bg-amber-500/10 text-amber-300', text: 'text-amber-400', bar: 'bg-amber-500' },
  Tax: { bg: 'bg-purple-500/10 text-purple-300', text: 'text-purple-400', bar: 'bg-purple-500' },
};

export function LossConcentration({ lossConcentration, loading }: LossConcentrationProps) {
  if (loading || !lossConcentration) {
    return (
      <Card className="glass-panel bg-slate-950/60 border-white/15 rounded-2xl p-6 space-y-4 shadow-[0_8px_30px_rgba(0,0,0,0.25)]">
        <Skeleton className="h-6 w-48 bg-white/10" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-12 w-full bg-white/5" />
          ))}
        </div>
      </Card>
    );
  }

  // Filter non-zero deductions
  const activeLosses = lossConcentration.filter((item) => item.amount !== 0);

  if (activeLosses.length === 0) {
    return (
      <Card className="glass-panel bg-slate-950/60 border-white/15 rounded-2xl p-6 shadow-[0_8px_30px_rgba(0,0,0,0.25)]">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-indigo-500/15 border border-indigo-400/30 flex items-center justify-center text-indigo-400">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-black text-white">Loss Concentration Analysis</h4>
            <p className="text-xs text-slate-300 mt-0.5">
              No deductions recorded for this reconciliation period.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="glass-panel bg-slate-950/60 border-white/15 rounded-2xl overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.25)]">
      <CardHeader className="pb-3 border-b border-white/15 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <CardTitle className="text-base md:text-lg font-black text-white flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-rose-400" />
            <span>Loss & Deduction Concentration</span>
          </CardTitle>
          <p className="text-xs text-slate-300 mt-0.5 font-medium">
            Where capital is allocated or lost: exact percentage share of total operational deductions
          </p>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {activeLosses.map((item) => {
            const style = CLASSIFICATION_COLORS[item.classification] || CLASSIFICATION_COLORS.Cost;
            return (
              <div
                key={item.name}
                className="p-3.5 rounded-xl bg-slate-900/50 border border-white/10 hover:border-white/20 transition-all space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 truncate">
                    <span className="text-xs sm:text-sm font-bold text-white truncate">
                      {item.name}
                    </span>
                    <Badge variant="outline" className={cn('text-[10px] font-bold border px-2 py-0.5', style.bg)}>
                      {item.classification}
                    </Badge>
                  </div>
                  <span className="text-xs sm:text-sm font-black text-rose-400 whitespace-nowrap">
                    {formatINRWithDecimals(item.amount)}
                  </span>
                </div>

                {/* Progress bar representing share of deductions */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-white/10 h-2 rounded-full overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all duration-500', style.bar)}
                      style={{ width: `${Math.min(item.percentage, 100)}%` }}
                    />
                  </div>
                  <span className="text-[11px] font-bold text-slate-300 w-12 text-right">
                    {item.percentage}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

