'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatINRWithDecimals } from '@/lib/format';
import {
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  Wallet,
  CheckCircle2,
  PackageCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { FinancialSummary } from '@/lib/reconciliation/types';

interface FinancialKpiGridProps {
  summary: FinancialSummary | null;
  loading: boolean;
}

export function FinancialKpiGrid({ summary, loading }: FinancialKpiGridProps) {
  if (loading || !summary) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="glass-panel bg-slate-950/60 border border-white/15 p-5 rounded-2xl space-y-3"
          >
            <div className="flex justify-between items-center">
              <Skeleton className="h-4 w-20 bg-white/10" />
              <Skeleton className="h-8 w-8 rounded-xl bg-white/10" />
            </div>
            <Skeleton className="h-8 w-28 bg-white/10" />
            <Skeleton className="h-3 w-20 bg-white/5" />
          </div>
        ))}
      </div>
    );
  }

  const {
    totalSalesInvoice,
    settlementAmount,
    finalPayoutNetProfit,
    orders,
  } = summary;

  const isNetProfitPositive = finalPayoutNetProfit >= 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
      {/* 1. Total Sales (Invoice) */}
      <Card className="glass-panel bg-slate-950/60 border-white/15 rounded-2xl hover:border-white/30 transition-all shadow-[0_8px_30px_rgba(0,0,0,0.25)]">
        <CardContent className="p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Total Sales
            </span>
            <div className="h-8 w-8 rounded-xl bg-indigo-500/15 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <ShoppingCart className="h-4 w-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl lg:text-2xl xl:text-[26px] font-black font-headline tracking-tight text-white truncate">
            {formatINRWithDecimals(totalSalesInvoice)}
          </div>
          <p className="text-xs text-slate-400 font-medium">
            Supplier Discounted Price
          </p>
        </CardContent>
      </Card>

      {/* 2. Settlement Amount */}
      <Card className="glass-panel bg-slate-950/60 border-white/15 rounded-2xl hover:border-white/30 transition-all shadow-[0_8px_30px_rgba(0,0,0,0.25)]">
        <CardContent className="p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Settlement
            </span>
            <div className="h-8 w-8 rounded-xl bg-blue-500/15 border border-blue-400/30 flex items-center justify-center text-blue-300">
              <Wallet className="h-4 w-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl lg:text-2xl xl:text-[26px] font-black font-headline tracking-tight text-white truncate">
            {formatINRWithDecimals(settlementAmount)}
          </div>
          <p className="text-xs text-slate-400 font-medium">
            Bank Settlement Amount
          </p>
        </CardContent>
      </Card>

      {/* 3. Net Profit / Payout */}
      <Card
        className={cn(
          'glass-panel rounded-2xl transition-all shadow-[0_8px_30px_rgba(0,0,0,0.25)] border',
          isNetProfitPositive
            ? 'border-emerald-500/40 bg-emerald-950/25 hover:border-emerald-500/60'
            : 'border-rose-500/40 bg-rose-950/25 hover:border-rose-500/60'
        )}
      >
        <CardContent className="p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Net Profit
            </span>
            <Badge
              variant="outline"
              className={cn(
                'font-black text-[11px] tracking-widest px-2 py-0.5 rounded-lg uppercase',
                isNetProfitPositive
                  ? 'border-emerald-400/40 bg-emerald-500/20 text-emerald-300'
                  : 'border-rose-400/40 bg-rose-500/20 text-rose-300'
              )}
            >
              {isNetProfitPositive ? (
                <span className="flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" /> PROFIT
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <TrendingDown className="h-3 w-3" /> LOSS
                </span>
              )}
            </Badge>
          </div>
          <div
            className={cn(
              'text-xl sm:text-2xl lg:text-2xl xl:text-[26px] font-black font-headline tracking-tight truncate',
              isNetProfitPositive ? 'text-emerald-400' : 'text-rose-400'
            )}
          >
            {formatINRWithDecimals(finalPayoutNetProfit)}
          </div>
          <p className="text-xs text-slate-400 font-medium">
            Final Realized Payout
          </p>
        </CardContent>
      </Card>

      {/* 4. Total Orders */}
      <Card className="glass-panel bg-slate-950/60 border-white/15 rounded-2xl hover:border-white/30 transition-all shadow-[0_8px_30px_rgba(0,0,0,0.25)]">
        <CardContent className="p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Total Orders
            </span>
            <div className="h-8 w-8 rounded-xl bg-purple-500/15 border border-purple-400/30 flex items-center justify-center text-purple-300">
              <PackageCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl lg:text-2xl xl:text-[26px] font-black font-headline tracking-tight text-white">
            {orders.totalOrders.toLocaleString('en-IN')}
          </div>
          <p className="text-xs text-slate-400 font-medium">
            Quantity-weighted orders
          </p>
        </CardContent>
      </Card>

      {/* 5. Delivered Orders */}
      <Card className="glass-panel bg-slate-950/60 border-white/15 rounded-2xl hover:border-white/30 transition-all shadow-[0_8px_30px_rgba(0,0,0,0.25)]">
        <CardContent className="p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Delivered
            </span>
            <Badge
              variant="outline"
              className="text-xs font-bold border-emerald-400/30 text-emerald-300 bg-emerald-500/15 px-2 py-0.5"
            >
              {orders.deliveredRate}%
            </Badge>
          </div>
          <div className="text-xl sm:text-2xl lg:text-2xl xl:text-[26px] font-black font-headline tracking-tight text-emerald-400">
            {orders.deliveredOrders.toLocaleString('en-IN')}
          </div>
          <p className="text-xs text-slate-400 font-medium">
            Fulfilled successfully
          </p>
        </CardContent>
      </Card>

      {/* 6. Net Orders */}
      <Card className="glass-panel bg-slate-950/60 border-white/15 rounded-2xl hover:border-white/30 transition-all shadow-[0_8px_30px_rgba(0,0,0,0.25)]">
        <CardContent className="p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Net Orders
            </span>
            <div className="h-8 w-8 rounded-xl bg-amber-500/15 border border-amber-400/30 flex items-center justify-center text-amber-300">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl lg:text-2xl xl:text-[26px] font-black font-headline tracking-tight text-white">
            {orders.netOrders.toLocaleString('en-IN')}
          </div>
          <p className="text-xs text-slate-400 font-medium">
            Delivered + Exchange + Return
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
