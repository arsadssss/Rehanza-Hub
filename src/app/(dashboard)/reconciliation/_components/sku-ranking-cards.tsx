'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatINRWithDecimals } from '@/lib/format';
import {
  DollarSign,
  TrendingUp,
  Package,
  AlertTriangle,
  RotateCcw,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SkuRankings } from '@/lib/reconciliation/types';

interface SkuRankingCardsProps {
  rankings: SkuRankings | null;
  loading: boolean;
}

export function SkuRankingCards({ rankings, loading }: SkuRankingCardsProps) {
  if (loading || !rankings) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="glass-panel bg-slate-950/60 border border-white/15 p-4 rounded-2xl space-y-3"
          >
            <Skeleton className="h-4 w-24 bg-white/10" />
            <Skeleton className="h-6 w-32 bg-white/10" />
            <Skeleton className="h-4 w-20 bg-white/5" />
          </div>
        ))}
      </div>
    );
  }

  const {
    topRevenueSku,
    topProfitSku,
    topOrdersSku,
    worstProfitSku,
    highestReturnSku,
    highestRtoSku,
  } = rankings;

  const cards = [
    {
      title: 'Top Revenue SKU',
      sku: topRevenueSku,
      icon: DollarSign,
      iconColor: 'text-indigo-300',
      iconBg: 'bg-indigo-500/15 border-indigo-400/30',
      primaryLabel: 'Revenue',
      primaryValue: topRevenueSku ? formatINRWithDecimals(topRevenueSku.revenue) : '—',
      secondaryText: topRevenueSku ? `${topRevenueSku.totalOrders.toLocaleString('en-IN')} orders` : 'No data',
      badgeColor: 'border-indigo-400/30 bg-indigo-500/10 text-indigo-300',
    },
    {
      title: 'Top Profit SKU',
      sku: topProfitSku,
      icon: TrendingUp,
      iconColor: 'text-emerald-300',
      iconBg: 'bg-emerald-500/15 border-emerald-400/30',
      primaryLabel: 'Profit',
      primaryValue: topProfitSku ? formatINRWithDecimals(topProfitSku.profit) : '—',
      secondaryText: topProfitSku?.profitMargin !== null && topProfitSku ? `${topProfitSku.profitMargin}% margin` : '—',
      badgeColor: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300',
      isProfit: true,
    },
    {
      title: 'Top Orders SKU',
      sku: topOrdersSku,
      icon: Package,
      iconColor: 'text-blue-300',
      iconBg: 'bg-blue-500/15 border-blue-400/30',
      primaryLabel: 'Orders',
      primaryValue: topOrdersSku ? topOrdersSku.totalOrders.toLocaleString('en-IN') : '—',
      secondaryText: topOrdersSku ? `${topOrdersSku.deliveredOrders} delivered` : 'No data',
      badgeColor: 'border-blue-400/30 bg-blue-500/10 text-blue-300',
    },
    {
      title: 'Worst Profit SKU',
      sku: worstProfitSku,
      icon: AlertTriangle,
      iconColor: 'text-rose-300',
      iconBg: 'bg-rose-500/15 border-rose-400/30',
      primaryLabel: 'Profit / Loss',
      primaryValue: worstProfitSku ? formatINRWithDecimals(worstProfitSku.profit) : '—',
      secondaryText: worstProfitSku?.profitMargin !== null && worstProfitSku ? `${worstProfitSku.profitMargin}% margin` : '—',
      badgeColor: 'border-rose-400/30 bg-rose-500/10 text-rose-300',
      isLoss: true,
    },
    {
      title: 'Highest Return SKU',
      sku: highestReturnSku,
      icon: RotateCcw,
      iconColor: 'text-amber-300',
      iconBg: 'bg-amber-500/15 border-amber-400/30',
      primaryLabel: 'Return Rate',
      primaryValue: highestReturnSku ? `${highestReturnSku.returnRate}%` : '—',
      secondaryText: highestReturnSku ? `${highestReturnSku.returnOrders} returned of ${highestReturnSku.totalOrders}` : 'No data',
      badgeColor: 'border-amber-400/30 bg-amber-500/10 text-amber-300',
    },
    {
      title: 'Highest RTO SKU',
      sku: highestRtoSku,
      icon: XCircle,
      iconColor: 'text-red-300',
      iconBg: 'bg-red-500/15 border-red-400/30',
      primaryLabel: 'RTO Rate',
      primaryValue: highestRtoSku ? `${highestRtoSku.rtoRate}%` : '—',
      secondaryText: highestRtoSku ? `${highestRtoSku.rtoOrders} RTO of ${highestRtoSku.totalOrders}` : 'No data',
      badgeColor: 'border-red-400/30 bg-red-500/10 text-red-300',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        const skuData = card.sku;
        return (
          <Card
            key={card.title}
            className="glass-panel bg-slate-950/60 border-white/15 rounded-2xl hover:border-white/30 transition-all shadow-[0_8px_30px_rgba(0,0,0,0.25)] flex flex-col justify-between"
          >
            <CardContent className="p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-300 truncate">
                  {card.title}
                </span>
                <div className={cn('h-7 w-7 rounded-lg flex items-center justify-center border', card.iconBg)}>
                  <Icon className={cn('h-3.5 w-3.5', card.iconColor)} />
                </div>
              </div>

              <div>
                <p className="text-xs font-black text-white font-mono truncate" title={skuData?.sku}>
                  {skuData?.sku || 'No SKU'}
                </p>
                <p className="text-[11px] text-slate-300 font-medium truncate mt-0.5" title={skuData?.productName}>
                  {skuData?.productName || 'No Product Name'}
                </p>
              </div>

              <div className="pt-2 border-t border-white/10">
                <div className="flex items-baseline justify-between gap-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400">
                    {card.primaryLabel}
                  </span>
                  <span
                    className={cn(
                      'text-sm font-black',
                      card.isLoss && (skuData?.profit ?? 0) < 0
                        ? 'text-rose-400'
                        : card.isProfit
                        ? 'text-emerald-400'
                        : 'text-white'
                    )}
                  >
                    {card.primaryValue}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 text-right mt-0.5 font-medium">
                  {card.secondaryText}
                </p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

