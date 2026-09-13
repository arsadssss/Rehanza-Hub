'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Truck, RotateCcw, PackageX, AlertCircle } from 'lucide-react';
import { formatINR } from '@/lib/format';
import { cn } from '@/lib/utils';
import { ReturnRtoDamageReport } from '@/lib/analytics/reports-engine';

interface ReturnRtoDamageProps {
  report: ReturnRtoDamageReport | null;
  loading: boolean;
}

export function ReturnRtoDamage({ report, loading }: ReturnRtoDamageProps) {
  if (loading || !report) {
    return (
      <Card className="glass-panel border-white/10 bg-slate-900/40 p-6 rounded-3xl">
        <Skeleton className="h-6 w-48 bg-white/10 mb-4" />
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full bg-white/5 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-32 w-full bg-white/5 rounded-2xl" />
      </Card>
    );
  }

  const {
    totalOrders,
    deliveredOrders,
    deliveredRate,
    returnOrders,
    returnRate,
    rtoOrders,
    rtoRate,
    deliveryFailureRate,
    estimatedRtoLoss,
    estimatedReturnLoss,
    totalFailedDeliveryLoss,
    topReturnBleeders,
  } = report;

  return (
    <Card className="glass-panel border-white/10 bg-slate-900/40 rounded-3xl p-6 shadow-xl backdrop-blur-xl space-y-6 max-w-full overflow-hidden">
      <CardHeader className="p-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="glass-pill h-6 px-2 rounded-md border border-rose-500/30 bg-rose-500/10 font-bold text-[10px] uppercase tracking-wider text-rose-300"
              >
                Logistics Damage
              </Badge>
              <CardTitle className="text-base sm:text-lg font-black tracking-tight text-white font-headline">
                Return & RTO Financial Destruction Report
              </CardTitle>
            </div>
            <CardDescription className="text-xs text-slate-300">
              Audit of courier freight, packaging materials, and transit damage wasted on incomplete deliveries.
            </CardDescription>
          </div>
          <div className="text-left sm:text-right">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Total Logistics Waste
            </span>
            <p className="text-lg font-black font-headline text-rose-400">{formatINR(totalFailedDeliveryLoss)}</p>
          </div>
        </div>
      </CardHeader>

      {/* Hero Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Delivery Failure Rate */}
        <div className="p-4 rounded-2xl bg-slate-950/60 border border-white/10 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Overall Failure Rate
            </span>
            <PackageX className="h-4 w-4 text-rose-400" />
          </div>
          <div className="text-2xl font-black font-headline text-rose-400">
            {deliveryFailureRate}%
          </div>
          <p className="text-[11px] text-slate-400">
            {returnOrders + rtoOrders} failed orders of {totalOrders} dispatched
          </p>
        </div>

        {/* Customer Return Damage */}
        <div className="p-4 rounded-2xl bg-slate-950/60 border border-white/10 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Customer Return Waste
            </span>
            <RotateCcw className="h-4 w-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black font-headline text-amber-400">
            {formatINR(estimatedReturnLoss)}
          </div>
          <p className="text-[11px] text-slate-400">
            {returnOrders} customer returns ({returnRate}%) with 2-way freight
          </p>
        </div>

        {/* RTO Courier Damage */}
        <div className="p-4 rounded-2xl bg-slate-950/60 border border-white/10 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              RTO Courier Burn
            </span>
            <Truck className="h-4 w-4 text-purple-400" />
          </div>
          <div className="text-2xl font-black font-headline text-purple-400">
            {formatINR(estimatedRtoLoss)}
          </div>
          <p className="text-[11px] text-slate-400">
            {rtoOrders} undelivered packages ({rtoRate}%) wasted forward courier
          </p>
        </div>
      </div>

      {/* Top Return Bleeders Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-300">
            Disproportionate Return & RTO Contributors (Top 5 Bleeders)
          </h4>
          <span className="text-[10px] text-slate-400">Prioritized by estimated logistics loss</span>
        </div>

        <div className="overflow-x-auto w-full max-w-full rounded-2xl border border-white/10">
          <Table>
            <TableHeader className="bg-slate-950/80">
              <TableRow className="border-b border-white/10 hover:bg-transparent">
                <TableHead className="text-[10px] font-black uppercase text-slate-400">SKU</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-400 text-right">Orders</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-400 text-right">Customer Returns</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-400 text-right">RTO Non-Delivery</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-400 text-right">Combined Failure %</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-400 text-right">Est. Logistics Burn</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topReturnBleeders.map((bleeder, idx) => {
                const combinedFailureRate = bleeder.totalOrders > 0
                  ? Math.round(((bleeder.returnOrders + bleeder.rtoOrders) / bleeder.totalOrders) * 100)
                  : 0;

                return (
                  <TableRow key={idx} className="border-b border-white/5 hover:bg-white/5">
                    <TableCell className="py-2.5">
                      <span className="font-mono text-xs font-black text-white block">{bleeder.sku}</span>
                      <span className="text-[10px] text-slate-400 line-clamp-1">{bleeder.productName}</span>
                    </TableCell>
                    <TableCell className="text-right py-2.5 text-xs font-semibold text-slate-300">
                      {bleeder.totalOrders}
                    </TableCell>
                    <TableCell className="text-right py-2.5 text-xs text-amber-300 font-semibold">
                      {bleeder.returnOrders} ({bleeder.returnRate}%)
                    </TableCell>
                    <TableCell className="text-right py-2.5 text-xs text-purple-300 font-semibold">
                      {bleeder.rtoOrders} ({bleeder.rtoRate}%)
                    </TableCell>
                    <TableCell className="text-right py-2.5">
                      <span
                        className={cn(
                          'inline-flex items-center text-xs font-bold px-2 py-0.5 rounded-md border',
                          combinedFailureRate > 35
                            ? 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                            : 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                        )}
                      >
                        {combinedFailureRate}%
                      </span>
                    </TableCell>
                    <TableCell className="text-right py-2.5 text-xs font-headline font-black text-rose-400">
                      {formatINR(bleeder.estimatedLoss)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </Card>
  );
}
