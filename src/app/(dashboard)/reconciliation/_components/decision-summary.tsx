'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatINRWithDecimals } from '@/lib/format';
import {
  Rocket,
  ShieldCheck,
  Eye,
  AlertTriangle,
  OctagonX,
  TrendingUp,
  Flame,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { DecisionEngineSummary, DecisionState } from '@/lib/reconciliation/types';

interface DecisionSummaryProps {
  summary: DecisionEngineSummary | null;
  selectedFilter: DecisionState | 'ALL';
  onSelectFilter: (filter: DecisionState | 'ALL') => void;
  loading: boolean;
}

export function DecisionSummary({
  summary,
  selectedFilter,
  onSelectFilter,
  loading,
}: DecisionSummaryProps) {
  if (loading || !summary) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="glass-panel bg-slate-950/60 border border-white/15 p-4 rounded-2xl space-y-2"
            >
              <Skeleton className="h-4 w-20 bg-white/10" />
              <Skeleton className="h-7 w-16 bg-white/10" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const decisionCards: Array<{
    key: DecisionState;
    label: string;
    count: number;
    icon: any;
    desc: string;
    color: string;
    bg: string;
    activeBorder: string;
  }> = [
    {
      key: 'SCALE',
      label: 'Scale Aggressively',
      count: summary.scaleCount,
      icon: Rocket,
      desc: 'High margin, healthy fulfillment',
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10 border-emerald-500/20',
      activeBorder: 'border-emerald-500 ring-2 ring-emerald-500/30',
    },
    {
      key: 'HEALTHY',
      label: 'Healthy & Stable',
      count: summary.healthyCount,
      icon: ShieldCheck,
      desc: 'Profitable; continue current pace',
      color: 'text-blue-400',
      bg: 'bg-blue-500/10 border-blue-500/20',
      activeBorder: 'border-blue-500 ring-2 ring-blue-500/30',
    },
    {
      key: 'MONITOR',
      label: 'Monitor & Observe',
      count: summary.monitorCount,
      icon: Eye,
      desc: 'Early sample or borderline metrics',
      color: 'text-indigo-400',
      bg: 'bg-indigo-500/10 border-indigo-500/20',
      activeBorder: 'border-indigo-500 ring-2 ring-indigo-500/30',
    },
    {
      key: 'REVIEW',
      label: 'Action Review',
      count: summary.reviewCount,
      icon: AlertTriangle,
      desc: 'Losses or high return leakage',
      color: 'text-amber-400',
      bg: 'bg-amber-500/10 border-amber-500/20',
      activeBorder: 'border-amber-500 ring-2 ring-amber-500/30',
    },
    {
      key: 'STOP',
      label: 'Stop / Pause',
      count: summary.stopCount,
      icon: OctagonX,
      desc: 'Severe recurring net losses',
      color: 'text-rose-400',
      bg: 'bg-rose-500/10 border-rose-500/20',
      activeBorder: 'border-rose-500 ring-2 ring-rose-500/30',
    },
  ];

  return (
    <div className="space-y-4">
      {/* Interactive Decision Filter Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {decisionCards.map((card) => {
          const Icon = card.icon;
          const isSelected = selectedFilter === card.key;
          return (
            <button
              key={card.key}
              type="button"
              onClick={() => onSelectFilter(isSelected ? 'ALL' : card.key)}
              className={cn(
                'glass-panel text-left p-3.5 rounded-2xl transition-all duration-200 cursor-pointer shadow-[0_8px_30px_rgba(0,0,0,0.25)] flex flex-col justify-between space-y-2 border',
                card.bg,
                isSelected ? card.activeBorder : 'border-white/10 hover:border-white/30'
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                  {card.label}
                </span>
                <Icon className={cn('h-4 w-4', card.color)} />
              </div>
              <div className="flex items-baseline justify-between pt-1">
                <span className={cn('text-2xl font-black font-headline', card.color)}>
                  {card.count}
                </span>
                <span className="text-[10px] text-slate-400">
                  {isSelected ? 'Filtering table' : 'Click to filter'}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium truncate">
                {card.desc}
              </p>
            </button>
          );
        })}
      </div>

      {/* Highlights Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Best Opportunity */}
        <Card className="glass-panel bg-slate-950/60 border-white/15 rounded-2xl p-3.5 shadow-md">
          <CardContent className="p-0 space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold text-slate-400">
              <span className="uppercase tracking-wider">Top Scaling Opportunity</span>
              <Rocket className="h-3.5 w-3.5 text-emerald-400" />
            </div>
            <p className="text-xs font-black text-white font-mono truncate" title={summary.bestOpportunity?.sku}>
              {summary.bestOpportunity?.sku || 'No SKU'}
            </p>
            <div className="flex items-center justify-between text-[11px] pt-1 border-t border-white/10">
              <span className="text-slate-400">Opportunity Score</span>
              <span className="font-black text-emerald-400">
                {summary.bestOpportunity ? `${summary.bestOpportunity.opportunityScore}/100` : '—'}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Highest Risk */}
        <Card className="glass-panel bg-slate-950/60 border-white/15 rounded-2xl p-3.5 shadow-md">
          <CardContent className="p-0 space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold text-slate-400">
              <span className="uppercase tracking-wider">Highest Business Risk</span>
              <Flame className="h-3.5 w-3.5 text-rose-400" />
            </div>
            <p className="text-xs font-black text-white font-mono truncate" title={summary.highestRiskSku?.sku}>
              {summary.highestRiskSku?.sku || 'No SKU'}
            </p>
            <div className="flex items-center justify-between text-[11px] pt-1 border-t border-white/10">
              <span className="text-slate-400">Risk Score</span>
              <span className="font-black text-rose-400">
                {summary.highestRiskSku ? `${summary.highestRiskSku.riskScore}/100` : '—'}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Most Profitable */}
        <Card className="glass-panel bg-slate-950/60 border-white/15 rounded-2xl p-3.5 shadow-md">
          <CardContent className="p-0 space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold text-slate-400">
              <span className="uppercase tracking-wider">Most Profitable SKU</span>
              <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
            </div>
            <p className="text-xs font-black text-white font-mono truncate" title={summary.mostProfitableSku?.sku}>
              {summary.mostProfitableSku?.sku || 'No SKU'}
            </p>
            <div className="flex items-center justify-between text-[11px] pt-1 border-t border-white/10">
              <span className="text-slate-400">Net Profit</span>
              <span className="font-black text-emerald-400">
                {summary.mostProfitableSku ? formatINRWithDecimals(summary.mostProfitableSku.metrics.profit) : '—'}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Largest Loss */}
        <Card className="glass-panel bg-slate-950/60 border-white/15 rounded-2xl p-3.5 shadow-md">
          <CardContent className="p-0 space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold text-slate-400">
              <span className="uppercase tracking-wider">Largest Loss Driver</span>
              <AlertTriangle className="h-3.5 w-3.5 text-rose-400" />
            </div>
            <p className="text-xs font-black text-white font-mono truncate" title={summary.largestLossSku?.sku}>
              {summary.largestLossSku?.sku || 'None (No Loss SKUs)'}
            </p>
            <div className="flex items-center justify-between text-[11px] pt-1 border-t border-white/10">
              <span className="text-slate-400">Net Loss</span>
              <span className="font-black text-rose-400">
                {summary.largestLossSku ? formatINRWithDecimals(summary.largestLossSku.metrics.profit) : '₹0.00'}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

