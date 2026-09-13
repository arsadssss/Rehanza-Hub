'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, AlertTriangle, Info, CheckCircle2, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AnomalyRiskItem } from '@/lib/analytics/reports-engine';

interface AnomalyRiskMatrixProps {
  anomalies: AnomalyRiskItem[] | null;
  loading: boolean;
}

export function AnomalyRiskMatrix({ anomalies, loading }: AnomalyRiskMatrixProps) {
  if (loading || !anomalies) {
    return (
      <Card className="glass-panel border-white/10 bg-slate-900/40 p-6 rounded-3xl">
        <Skeleton className="h-6 w-48 bg-white/10 mb-4" />
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-16 w-full bg-white/5 rounded-2xl" />
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card className="glass-panel border-white/10 bg-slate-900/40 rounded-3xl p-6 shadow-xl backdrop-blur-xl space-y-4">
      <CardHeader className="p-0">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="glass-pill h-6 px-2 rounded-md border border-rose-500/30 bg-rose-500/10 font-bold text-[10px] uppercase tracking-wider text-rose-300"
              >
                Anomaly Matrix
              </Badge>
              <CardTitle className="text-base sm:text-lg font-black tracking-tight text-white font-headline">
                Algorithmic Risk & Anomaly Signals
              </CardTitle>
            </div>
            <CardDescription className="text-xs text-slate-300">
              Automated heuristics flagging operational anomalies, extreme returns, and margin deterioration.
            </CardDescription>
          </div>
          <ShieldAlert className="h-5 w-5 text-rose-400" />
        </div>
      </CardHeader>

      <div className="space-y-3">
        {anomalies.length === 0 ? (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
            <div>
              <h5 className="text-xs font-bold text-emerald-300">Zero Systemic Anomalies</h5>
              <p className="text-[11px] text-emerald-200/80">
                All order fulfillment, delivery rates, and unit margins are within standard operating thresholds.
              </p>
            </div>
          </div>
        ) : (
          anomalies.map((item) => (
            <div
              key={item.id}
              className={cn(
                'p-4 rounded-2xl border transition-all flex items-start gap-3.5',
                item.type === 'CRITICAL'
                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-200'
                  : item.type === 'WARNING'
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                  : 'bg-indigo-500/10 border-indigo-500/30 text-indigo-200'
              )}
            >
              <div
                className={cn(
                  'h-8 w-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5',
                  item.type === 'CRITICAL'
                    ? 'bg-rose-500/20 text-rose-400'
                    : item.type === 'WARNING'
                    ? 'bg-amber-500/20 text-amber-400'
                    : 'bg-indigo-500/20 text-indigo-400'
                )}
              >
                {item.type === 'CRITICAL' ? (
                  <AlertCircle className="h-4 w-4" />
                ) : item.type === 'WARNING' ? (
                  <AlertTriangle className="h-4 w-4" />
                ) : (
                  <Info className="h-4 w-4" />
                )}
              </div>

              <div className="flex-1 space-y-1">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <h5 className="text-xs sm:text-sm font-bold text-white tracking-tight">
                    {item.title}
                  </h5>
                  {item.metric && (
                    <Badge
                      variant="outline"
                      className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md border border-white/10 bg-slate-950/40 text-slate-300 self-start sm:self-auto"
                    >
                      {item.metric}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">{item.description}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
