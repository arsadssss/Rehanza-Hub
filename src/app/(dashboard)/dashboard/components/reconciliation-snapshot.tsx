'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatINRWithDecimals } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
  Undo2,
  CheckCircle2,
  AlertTriangle,
  Wallet,
  ArrowUpRight,
  Truck,
  RefreshCw,
  HelpCircle,
} from 'lucide-react';
import Link from 'next/link';
import { FinancialSummary } from '@/lib/reconciliation/types';

interface ReconciliationSnapshotProps {
  summary: FinancialSummary | null;
  loading: boolean;
  periodLabel: string;
  error?: string | null;
  onRetry?: () => void;
}

export function ReconciliationSnapshot({
  summary,
  loading,
  periodLabel,
  error,
  onRetry,
}: ReconciliationSnapshotProps) {
  // 1. Loading State -> Skeletons
  if (loading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-20 rounded-md bg-white/10" />
            <Skeleton className="h-6 w-48 bg-white/10" />
          </div>
          <Skeleton className="h-4 w-36 bg-white/5" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card
              key={i}
              className="glass-panel relative overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/40 p-6 shadow-[0_20px_50px_rgba(2,6,23,0.35)] backdrop-blur-xl space-y-4"
            >
              <div className="flex justify-between items-center">
                <Skeleton className="h-5 w-28 bg-white/10" />
                <Skeleton className="h-6 w-16 rounded-full bg-white/10" />
              </div>
              <Skeleton className="h-10 w-36 bg-white/10" />
              <div className="grid grid-cols-2 gap-3 pt-2">
                <Skeleton className="h-12 w-full rounded-xl bg-white/5" />
                <Skeleton className="h-12 w-full rounded-xl bg-white/5" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // 2. Error or Missing Data State (when not loading) -> Polished Error Card, NEVER infinite skeleton
  if (error || !summary) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="glass-pill h-6 px-2 rounded-md border border-rose-500/30 bg-rose-500/10 font-bold text-[10px] uppercase tracking-wider text-rose-300"
            >
              Snapshot
            </Badge>
            <h2 className="text-lg font-black tracking-tight text-white font-headline">
              Reconciliation Snapshot
            </h2>
          </div>
          <span className="text-xs font-semibold text-slate-400">{periodLabel}</span>
        </div>

        <Card className="glass-panel relative overflow-hidden rounded-[2rem] border border-rose-500/20 bg-rose-950/10 p-8 shadow-[0_20px_50px_rgba(2,6,23,0.35)] backdrop-blur-xl text-center">
          <div className="flex flex-col items-center justify-center space-y-3 max-w-md mx-auto">
            <div className="p-3 bg-rose-500/10 rounded-2xl text-rose-400">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h3 className="text-base font-black text-white font-headline">
              Reconciliation Data Unavailable
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              {error || `Unable to load reconciliation snapshot for ${periodLabel}. Please verify your uploads or retry.`}
            </p>
            {onRetry && (
              <Button
                onClick={onRetry}
                variant="outline"
                size="sm"
                className="glass-button rounded-xl text-xs font-bold mt-2"
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                Retry Loading
              </Button>
            )}
          </div>
        </Card>
      </div>
    );
  }

  // 3. Empty Data State (0 total orders)
  if (summary.orders.totalOrders === 0) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="glass-pill h-6 px-2 rounded-md border border-indigo-500/30 bg-indigo-500/10 font-bold text-[10px] uppercase tracking-wider text-indigo-300"
            >
              Snapshot
            </Badge>
            <h2 className="text-lg font-black tracking-tight text-white font-headline">
              Reconciliation Snapshot
            </h2>
          </div>
          <span className="text-xs font-semibold text-slate-400">{periodLabel}</span>
        </div>

        <Card className="glass-panel rounded-[2rem] border border-white/10 bg-slate-900/40 p-8 text-center">
          <p className="text-sm font-bold text-slate-300">
            No reconciliation data recorded for {periodLabel}.
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Upload Meesho Orders and Payments CSV files in Reconciliation Center to populate.
          </p>
        </Card>
      </div>
    );
  }

  const { orders } = summary;
  const totalOrders = orders.totalOrders || 1;

  // Combined Return + RTO calculations
  const totalReturnAndRto = (orders.returnOrders || 0) + (orders.rtoOrders || 0);
  const combinedReturnRtoRate =
    Math.round(((totalReturnAndRto / totalOrders) * 100 + Number.EPSILON) * 10) / 10;

  // Net orders percentage
  const netOrdersRate =
    Math.round((((orders.netOrders || 0) / totalOrders) * 100 + Number.EPSILON) * 10) / 10;

  // Profit calculations
  const netProfit = summary.finalPayoutNetProfit;
  const isLoss = netProfit < 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="glass-pill h-6 px-2 rounded-md border border-indigo-500/30 bg-indigo-500/10 font-bold text-[10px] uppercase tracking-wider text-indigo-300"
          >
            Snapshot
          </Badge>
          <h2 className="text-lg font-black tracking-tight text-white font-headline">
            Reconciliation Snapshot
          </h2>
        </div>
        <span className="text-xs font-semibold text-slate-400">
          Source of Truth • {periodLabel}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* CARD 1: RETURNS & RTO */}
        <Card className="glass-panel relative overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/40 p-6 shadow-[0_20px_50px_rgba(2,6,23,0.35)] backdrop-blur-xl transition-all duration-300 hover:border-amber-400/30 hover:shadow-[0_20px_60px_rgba(245,158,11,0.12)] group">
          <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
            <Undo2 className="h-24 w-24 text-amber-400" />
          </div>

          <div className="relative z-10 space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-300/80">
                  Returns & RTO
                </p>
                <p className="text-xs text-slate-400 font-medium">{periodLabel}</p>
              </div>
              <Badge
                variant="outline"
                className="glass-pill px-2.5 py-0.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-300 font-bold text-[10px]"
              >
                {totalReturnAndRto} Units
              </Badge>
            </div>

            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-black font-headline tracking-tighter text-amber-300">
                  {combinedReturnRtoRate}%
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Total Return + RTO
                </span>
              </div>
              <div className="w-full bg-slate-800/80 h-2 rounded-full mt-2 overflow-hidden flex">
                <div
                  style={{ width: `${Math.min(orders.returnRate, 100)}%` }}
                  className="bg-amber-400 h-full"
                  title={`Customer Return: ${orders.returnRate}%`}
                />
                <div
                  style={{ width: `${Math.min(orders.rtoRate, 100)}%` }}
                  className="bg-rose-500 h-full"
                  title={`RTO: ${orders.rtoRate}%`}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/10">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Customer Return
                </p>
                <p className="text-lg font-black text-white mt-0.5">{orders.returnRate}%</p>
                <p className="text-[11px] font-semibold text-slate-400">
                  {orders.returnOrders} units
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/10">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  RTO (Undelivered)
                </p>
                <p className="text-lg font-black text-rose-300 mt-0.5">{orders.rtoRate}%</p>
                <p className="text-[11px] font-semibold text-slate-400">
                  {orders.rtoOrders} units
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* CARD 2: ORDER PERFORMANCE */}
        <Card className="glass-panel relative overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/40 p-6 shadow-[0_20px_50px_rgba(2,6,23,0.35)] backdrop-blur-xl transition-all duration-300 hover:border-indigo-400/30 hover:shadow-[0_20px_60px_rgba(99,102,241,0.12)] group">
          <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
            <Truck className="h-24 w-24 text-indigo-400" />
          </div>

          <div className="relative z-10 space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-300/80">
                  Order Performance
                </p>
                <p className="text-xs text-slate-400 font-medium">{periodLabel}</p>
              </div>
              <Badge
                variant="outline"
                className="glass-pill px-2.5 py-0.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 font-bold text-[10px]"
              >
                Vol: {orders.totalOrders}
              </Badge>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/10 text-center">
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                  Delivered
                </p>
                <p className="text-xl font-black text-white mt-1">{orders.deliveredOrders}</p>
                <p className="text-[11px] font-bold text-emerald-400 mt-0.5">
                  {orders.deliveredRate}%
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/10 text-center">
                <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                  Net Orders
                </p>
                <p className="text-xl font-black text-white mt-1">{orders.netOrders}</p>
                <p className="text-[11px] font-bold text-indigo-300 mt-0.5">{netOrdersRate}%</p>
              </div>

              <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/10 text-center">
                <p className="text-[10px] font-bold uppercase tracking-wider text-rose-400">
                  Cancelled
                </p>
                <p className="text-xl font-black text-white mt-1">{orders.cancelOrders}</p>
                <p className="text-[11px] font-bold text-rose-400 mt-0.5">{orders.cancelRate}%</p>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-800/40 border border-white/5 flex items-center justify-between text-[11px] text-slate-300 font-medium">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                <span>Net Realized Orders:</span>
              </span>
              <span className="font-bold text-white">
                {orders.netOrders} of {orders.totalOrders} units
              </span>
            </div>
          </div>
        </Card>

        {/* CARD 3: SETTLEMENT & PROFIT */}
        <Card className="glass-panel relative overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/40 p-6 shadow-[0_20px_50px_rgba(2,6,23,0.35)] backdrop-blur-xl transition-all duration-300 hover:border-emerald-400/30 hover:shadow-[0_20px_60px_rgba(16,185,129,0.12)] group">
          <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
            <Wallet className="h-24 w-24 text-emerald-400" />
          </div>

          <div className="relative z-10 space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300/80">
                  Settlement & Profit
                </p>
                <p className="text-xs text-slate-400 font-medium">{periodLabel}</p>
              </div>
              <Link
                href="/reconciliation"
                className="text-xs text-indigo-400 hover:text-white font-bold flex items-center gap-1 transition-colors"
              >
                <span>Recon Center</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/10">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Bank Settlement
                </p>
                <p className="text-lg font-black text-white mt-1">
                  {formatINRWithDecimals(summary.settlementAmount)}
                </p>
                <p className="text-[10px] font-semibold text-slate-400 mt-0.5">Realized Cash</p>
              </div>

              <div
                className={cn(
                  'p-3 rounded-2xl border',
                  isLoss
                    ? 'bg-rose-500/10 border-rose-500/20'
                    : 'bg-emerald-500/10 border-emerald-500/20'
                )}
              >
                <p
                  className={cn(
                    'text-[10px] font-bold uppercase tracking-wider',
                    isLoss ? 'text-rose-300' : 'text-emerald-300'
                  )}
                >
                  {isLoss ? 'Net Loss' : 'Net Profit'}
                </p>
                <p
                  className={cn(
                    'text-lg font-black mt-1',
                    isLoss ? 'text-rose-400' : 'text-emerald-400'
                  )}
                >
                  {formatINRWithDecimals(netProfit)}
                </p>
                <p className="text-[10px] font-semibold text-slate-400 mt-0.5">
                  Workbook Parity
                </p>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-800/40 border border-white/5 flex items-center justify-between text-[11px]">
              <span className="text-slate-400 font-medium">Gross Invoice Volume:</span>
              <span className="font-bold text-white">
                {formatINRWithDecimals(summary.totalSalesInvoice)}
              </span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
