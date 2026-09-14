'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Landmark, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';
import { formatINR } from '@/lib/format';
import { cn } from '@/lib/utils';
import { SettlementIntelligence } from '@/lib/analytics/reports-engine';

interface SettlementIntelligenceCardProps {
  intelligence: SettlementIntelligence | null;
  loading: boolean;
}

export function SettlementIntelligenceCard({ intelligence, loading }: SettlementIntelligenceCardProps) {
  if (loading || !intelligence) {
    return (
      <Card className="glass-panel border-white/10 bg-slate-900/40 p-6 rounded-3xl">
        <Skeleton className="h-6 w-44 bg-white/10 mb-4" />
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 w-full bg-white/5 rounded-2xl" />
          ))}
        </div>
      </Card>
    );
  }

  const {
    invoicedAmount,
    settledAmount,
    invoicedToSettledGap,
    averageDeductionPerOrder,
    settlementEfficiencyRate,
    awaitingPaymentCount,
    disputedOrNegativeOrdersCount,
  } = intelligence;

  return (
    <Card className="glass-panel border-white/10 bg-slate-900/40 rounded-3xl p-6 shadow-xl backdrop-blur-xl flex flex-col justify-between">
      <div>
        <CardHeader className="p-0 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="glass-pill h-6 px-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 font-bold text-[10px] uppercase tracking-wider text-emerald-300"
              >
                Settlement IQ
              </Badge>
              <CardTitle className="text-base sm:text-lg font-black tracking-tight text-white font-headline">
                Settlement
              </CardTitle>
            </div>
            <Landmark className="h-4 w-4 text-emerald-400" />
          </div>
        </CardHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
          {/* Invoiced to Settled Gap */}
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-white/10 space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
              Invoiced vs Settled Gap
            </span>
            <div className="text-xl font-black font-headline text-amber-400">
              {formatINR(invoicedToSettledGap)}
            </div>
            <p className="text-[10px] text-slate-400">
              Total marketplace withholding (freight, commissions, taxes)
            </p>
          </div>

          {/* Settlement Efficiency Rate */}
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-white/10 space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
              Cash Realization Rate
            </span>
            <div className="text-xl font-black font-headline text-emerald-400">
              {settlementEfficiencyRate}%
            </div>
            <p className="text-[10px] text-slate-400">
              Direct cash yield from every ₹100 of gross sales
            </p>
          </div>

          {/* Average Deduction per Order */}
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-white/10 space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
              Avg Deduction / Order
            </span>
            <div className="text-xl font-black font-headline text-white">
              {formatINR(averageDeductionPerOrder)}
            </div>
            <p className="text-[10px] text-slate-400">
              Mean platform cost drag per dispatched sub-order
            </p>
          </div>

          {/* Awaiting & Disputed */}
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-white/10 space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
              Disputed / Zero Payouts
            </span>
            <div className="text-xl font-black font-headline text-rose-400">
              {disputedOrNegativeOrdersCount} Orders
            </div>
            <p className="text-[10px] text-slate-400">
              Orders with negative payout or recovery deductions
            </p>
          </div>
        </div>
      </div>

      <div className="pt-4 mt-4 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400">
        <span>Bank Settled Amount</span>
        <span className="font-bold text-emerald-400">{formatINR(settledAmount)}</span>
      </div>
    </Card>
  );
}
