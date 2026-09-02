'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  CheckCircle2,
  CornerUpLeft,
  XCircle,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SkuProfitabilityMetric } from '@/lib/reconciliation/types';

interface ReturnRtoAnalysisProps {
  skus: SkuProfitabilityMetric[] | null;
  loading: boolean;
}

export function ReturnRtoAnalysis({ skus, loading }: ReturnRtoAnalysisProps) {
  if (loading || !skus) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="glass-panel bg-slate-950/60 border border-white/15 p-5 rounded-2xl space-y-3"
          >
            <Skeleton className="h-5 w-32 bg-white/10" />
            <Skeleton className="h-8 w-24 bg-white/10" />
            <Skeleton className="h-4 w-full bg-white/5" />
          </div>
        ))}
      </div>
    );
  }

  // Aggregate quantities across SKUs
  let totalOrders = 0;
  let deliveredOrders = 0;
  let returnOrders = 0;
  let rtoOrders = 0;

  for (const s of skus) {
    totalOrders += s.totalOrders;
    deliveredOrders += s.deliveredOrders;
    returnOrders += s.returnOrders;
    rtoOrders += s.rtoOrders;
  }

  const deliveredRate = totalOrders > 0 ? Math.round(((deliveredOrders / totalOrders) * 100 + Number.EPSILON) * 100) / 100 : 0;
  const returnRate = totalOrders > 0 ? Math.round(((returnOrders / totalOrders) * 100 + Number.EPSILON) * 100) / 100 : 0;
  const rtoRate = totalOrders > 0 ? Math.round(((rtoOrders / totalOrders) * 100 + Number.EPSILON) * 100) / 100 : 0;

  const metrics = [
    {
      title: 'Delivered Fulfilled Rate',
      rate: `${deliveredRate}%`,
      qty: deliveredOrders,
      total: totalOrders,
      desc: 'Customer accepted and fulfilled shipments',
      icon: CheckCircle2,
      color: 'text-emerald-400',
      barColor: 'bg-emerald-500',
      bg: 'bg-emerald-500/10 border-emerald-500/20',
      status: 'Healthy',
    },
    {
      title: 'Customer Return Rate',
      rate: `${returnRate}%`,
      qty: returnOrders,
      total: totalOrders,
      desc: 'Products returned post-delivery (excludes RTO)',
      icon: CornerUpLeft,
      color: 'text-amber-400',
      barColor: 'bg-amber-500',
      bg: 'bg-amber-500/10 border-amber-500/20',
      status: returnRate > 15 ? 'High Attention' : 'Moderate',
    },
    {
      title: 'RTO (Return to Origin) Rate',
      rate: `${rtoRate}%`,
      qty: rtoOrders,
      total: totalOrders,
      desc: 'Undelivered courier returns to warehouse',
      icon: XCircle,
      color: 'text-rose-400',
      barColor: 'bg-rose-500',
      bg: 'bg-rose-500/10 border-rose-500/20',
      status: rtoRate > 20 ? 'Critical Loss Driver' : 'Monitored',
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base md:text-lg font-black tracking-tight text-white flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-400" />
            <span>Fulfillment & Return / RTO Analytics</span>
          </h3>
          <p className="text-xs text-slate-300 mt-0.5 font-medium">
            Benchmarking customer delivery success vs logistics leakage across catalog
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {metrics.map((m) => {
          const Icon = m.icon;
          return (
            <Card
              key={m.title}
              className="glass-panel bg-slate-950/60 border-white/15 rounded-2xl overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.25)] flex flex-col justify-between"
            >
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    {m.title}
                  </span>
                  <div className={cn('h-8 w-8 rounded-xl flex items-center justify-center border', m.bg)}>
                    <Icon className={cn('h-4 w-4', m.color)} />
                  </div>
                </div>

                <div className="flex items-baseline justify-between">
                  <span className={cn('text-2xl font-black font-headline tracking-tight', m.color)}>
                    {m.rate}
                  </span>
                  <Badge variant="outline" className={cn('text-[11px] font-bold border', m.bg, m.color)}>
                    {m.qty.toLocaleString('en-IN')} / {m.total.toLocaleString('en-IN')} units
                  </Badge>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-500', m.barColor)}
                    style={{ width: `${Math.min(parseFloat(m.rate), 100)}%` }}
                  />
                </div>

                <div className="flex items-center justify-between pt-1 text-[11px]">
                  <span className="text-slate-400 font-medium">{m.desc}</span>
                  <span className={cn('font-bold', m.color)}>{m.status}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

