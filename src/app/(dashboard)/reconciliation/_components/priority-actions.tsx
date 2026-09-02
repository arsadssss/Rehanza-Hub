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
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SkuDecisionRecommendation, DecisionState } from '@/lib/reconciliation/types';

interface PriorityActionsProps {
  priorityActions: SkuDecisionRecommendation[] | null;
  loading: boolean;
}

const DECISION_BADGES: Record<
  DecisionState,
  { label: string; bg: string; text: string; border: string; icon: any }
> = {
  SCALE: {
    label: 'SCALE',
    bg: 'bg-emerald-500/15',
    text: 'text-emerald-300',
    border: 'border-emerald-500/30',
    icon: Rocket,
  },
  HEALTHY: {
    label: 'HEALTHY',
    bg: 'bg-blue-500/15',
    text: 'text-blue-300',
    border: 'border-blue-500/30',
    icon: ShieldCheck,
  },
  MONITOR: {
    label: 'MONITOR',
    bg: 'bg-indigo-500/15',
    text: 'text-indigo-300',
    border: 'border-indigo-500/30',
    icon: Eye,
  },
  REVIEW: {
    label: 'REVIEW',
    bg: 'bg-amber-500/15',
    text: 'text-amber-300',
    border: 'border-amber-500/30',
    icon: AlertTriangle,
  },
  STOP: {
    label: 'STOP',
    bg: 'bg-rose-500/15',
    text: 'text-rose-300',
    border: 'border-rose-500/30',
    icon: OctagonX,
  },
};

export function PriorityActions({ priorityActions, loading }: PriorityActionsProps) {
  if (loading || !priorityActions) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="glass-panel bg-slate-950/60 border border-white/15 p-5 rounded-2xl space-y-3"
          >
            <Skeleton className="h-5 w-32 bg-white/10" />
            <Skeleton className="h-4 w-48 bg-white/10" />
            <Skeleton className="h-10 w-full bg-white/5" />
          </div>
        ))}
      </div>
    );
  }

  if (priorityActions.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base md:text-lg font-black tracking-tight text-white flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-indigo-400" />
            <span>High Priority Operational Actions</span>
          </h3>
          <p className="text-xs text-slate-300 mt-0.5 font-medium">
            Immediate scaling opportunities and loss prevention ranked by commercial impact
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {priorityActions.map((item, idx) => {
          const badge = DECISION_BADGES[item.decision] || DECISION_BADGES.MONITOR;
          const Icon = badge.icon;
          const isProfitPos = item.metrics.profit >= 0;

          return (
            <Card
              key={`${item.sku}-${idx}`}
              className="glass-panel bg-slate-950/60 border-white/15 rounded-2xl overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.25)] hover:border-white/30 transition-all flex flex-col justify-between"
            >
              <CardContent className="p-4 sm:p-5 space-y-3.5">
                {/* Header: SKU & Decision Badge */}
                <div className="flex items-start justify-between gap-2">
                  <div className="truncate">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      Priority #{idx + 1}
                    </span>
                    <p className="text-sm font-black text-white font-mono truncate" title={item.sku}>
                      {item.sku}
                    </p>
                    <p className="text-xs text-slate-300 truncate mt-0.5" title={item.productName}>
                      {item.productName}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-xs font-black uppercase px-2.5 py-1 rounded-lg border flex items-center gap-1.5 flex-shrink-0',
                      badge.bg,
                      badge.text,
                      badge.border
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{badge.label}</span>
                  </Badge>
                </div>

                {/* Metrics Pill Grid */}
                <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-center">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold">Profit</span>
                    <p className={cn('text-xs font-black mt-0.5', isProfitPos ? 'text-emerald-400' : 'text-rose-400')}>
                      {formatINRWithDecimals(item.metrics.profit)}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold">Margin</span>
                    <p className="text-xs font-black text-white mt-0.5">
                      {item.metrics.profitMargin !== null ? `${item.metrics.profitMargin}%` : '—'}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold">Return + RTO</span>
                    <p className="text-xs font-black text-amber-400 mt-0.5">
                      {item.metrics.returnRate + item.metrics.rtoRate}%
                    </p>
                  </div>
                </div>

                {/* Primary Reason & Action */}
                <div className="space-y-1.5 pt-1">
                  <p className="text-xs font-medium text-slate-200 line-clamp-2">
                    <span className="font-bold text-white">Trigger: </span>
                    {item.primaryReason}
                  </p>
                  <div className="flex items-start gap-1.5 text-xs text-indigo-300 font-bold bg-indigo-500/10 p-2 rounded-xl border border-indigo-400/20">
                    <ArrowRight className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                    <span>{item.action}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

