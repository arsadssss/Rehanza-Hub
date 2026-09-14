'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, ShieldAlert } from 'lucide-react';
import { formatINR } from '@/lib/format';
import { cn } from '@/lib/utils';
import { MarginTrapSku } from '@/lib/analytics/reports-engine';

interface MarginTrapsTableProps {
  marginTraps: MarginTrapSku[] | null;
  loading: boolean;
}

export function MarginTrapsTable({ marginTraps, loading }: MarginTrapsTableProps) {
  if (loading || !marginTraps) {
    return (
      <Card className="glass-panel border-white/10 bg-slate-900/40 p-6 rounded-3xl">
        <Skeleton className="h-6 w-48 bg-white/10 mb-4" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 w-full bg-white/5 rounded-xl" />
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card className="glass-panel border-white/10 bg-slate-900/40 rounded-3xl p-6 shadow-xl backdrop-blur-xl max-w-full overflow-hidden">
      <CardHeader className="p-0 pb-5 flex flex-row items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="glass-pill h-6 px-2 rounded-md border border-rose-500/30 bg-rose-500/10 font-bold text-[10px] uppercase tracking-wider text-rose-300"
            >
              Diagnostic
            </Badge>
            <CardTitle className="text-base sm:text-lg font-black tracking-tight text-white font-headline">
              Margin Traps
            </CardTitle>
          </div>
        </div>
        <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0" />
      </CardHeader>

      <CardContent className="p-0 max-w-full overflow-hidden">
        {marginTraps.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-slate-950/40 border border-white/5">
            <p className="text-sm font-semibold text-emerald-400">Zero Margin Traps Detected</p>
            <p className="text-xs text-slate-400 mt-1">
              All high-volume products in this period are operating at non-negative margins.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto w-full max-w-full rounded-2xl border border-white/10">
            <Table>
              <TableHeader className="bg-slate-950/80">
                <TableRow className="border-b border-white/10 hover:bg-transparent">
                  <TableHead className="text-[10px] font-black uppercase text-slate-400">Product / SKU</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-slate-400 text-right">Revenue</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-slate-400 text-right">Net Profit / Loss</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-slate-400 text-right">Margin</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-slate-400 text-right">Return / RTO %</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-slate-400">Diagnostic Root Cause</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {marginTraps.map((trap, idx) => (
                  <TableRow key={idx} className="border-b border-white/5 hover:bg-white/5">
                    <TableCell className="py-3">
                      <div className="space-y-0.5">
                        <span className="font-mono text-xs font-black text-white block">{trap.sku}</span>
                        <span className="text-[11px] text-slate-400 line-clamp-1 max-w-[220px]">
                          {trap.productName}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right py-3 font-semibold text-xs text-white">
                      {formatINR(trap.revenue)}
                    </TableCell>
                    <TableCell className="text-right py-3 font-headline font-black text-xs text-rose-400">
                      {formatINR(trap.profit)}
                    </TableCell>
                    <TableCell className="text-right py-3">
                      <span className="inline-flex items-center text-xs font-bold px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/20">
                        {trap.profitMargin !== null ? `${trap.profitMargin}%` : 'N/A'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right py-3 text-xs text-slate-300">
                      <span className="font-semibold text-rose-300">{trap.returnRate}%</span>
                      <span className="text-slate-500 mx-1">/</span>
                      <span className="text-amber-300">{trap.rtoRate}%</span>
                    </TableCell>
                    <TableCell className="py-3 text-xs text-slate-300 max-w-[320px]">
                      {trap.diagnosis}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
