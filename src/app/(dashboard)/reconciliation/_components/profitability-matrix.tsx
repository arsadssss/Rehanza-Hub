'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatINRWithDecimals } from '@/lib/format';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts';
import { LayoutGrid } from 'lucide-react';
import { SkuDecisionRecommendation, DecisionState } from '@/lib/reconciliation/types';

interface ProfitabilityMatrixProps {
  decisions: SkuDecisionRecommendation[] | null;
  loading: boolean;
}

const DECISION_COLOR_MAP: Record<DecisionState, string> = {
  SCALE: '#10B981', // emerald
  HEALTHY: '#3B82F6', // blue
  MONITOR: '#6366F1', // indigo
  REVIEW: '#F59E0B', // amber
  STOP: '#F43F5E', // rose
};

export function ProfitabilityMatrix({ decisions, loading }: ProfitabilityMatrixProps) {
  if (loading || !decisions) {
    return (
      <Card className="glass-panel bg-slate-950/60 border-white/15 rounded-2xl p-6 space-y-4 shadow-[0_8px_30px_rgba(0,0,0,0.25)]">
        <Skeleton className="h-6 w-48 bg-white/10" />
        <Skeleton className="h-64 w-full bg-white/5" />
      </Card>
    );
  }

  // Format data for ScatterChart
  const data = decisions
    .filter((d) => d.metrics.profitMargin !== null)
    .map((d) => ({
      sku: d.sku,
      productName: d.productName,
      margin: d.metrics.profitMargin ?? 0,
      orders: d.metrics.totalOrders,
      profit: d.metrics.profit,
      decision: d.decision,
      color: DECISION_COLOR_MAP[d.decision] || '#94A3B8',
    }));

  if (data.length === 0) {
    return (
      <Card className="glass-panel bg-slate-950/60 border-white/15 rounded-2xl p-6 shadow-[0_8px_30px_rgba(0,0,0,0.25)]">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-indigo-500/15 border border-indigo-400/30 flex items-center justify-center text-indigo-400">
            <LayoutGrid className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-black text-white">Profitability & Scaling Matrix</h4>
            <p className="text-xs text-slate-300 mt-0.5">
              Insufficient SKU data to render matrix for this period.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="glass-panel bg-slate-950/60 border-white/15 rounded-2xl overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.25)]">
      <CardHeader className="pb-3 border-b border-white/15 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <CardTitle className="text-base md:text-lg font-black text-white flex items-center gap-2">
            <LayoutGrid className="h-5 w-5 text-indigo-400" />
            <span>Profitability & Scaling Matrix</span>
          </CardTitle>
          <p className="text-xs text-slate-300 mt-0.5 font-medium">
            Visualizing catalog unit economics: Margin % (X-axis) vs Volume (Y-axis)
          </p>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-2.5 text-[11px] font-bold">
          <span className="flex items-center gap-1 text-emerald-400">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 inline-block" /> SCALE
          </span>
          <span className="flex items-center gap-1 text-blue-400">
            <span className="h-2.5 w-2.5 rounded-full bg-blue-500 inline-block" /> HEALTHY
          </span>
          <span className="flex items-center gap-1 text-indigo-400">
            <span className="h-2.5 w-2.5 rounded-full bg-indigo-500 inline-block" /> MONITOR
          </span>
          <span className="flex items-center gap-1 text-amber-400">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500 inline-block" /> REVIEW
          </span>
          <span className="flex items-center gap-1 text-rose-400">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500 inline-block" /> STOP
          </span>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-6">
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 20, right: 20, bottom: 25, left: 15 }}>
              <ReferenceLine x={0} stroke="rgba(255,255,255,0.3)" strokeWidth={1.5} />
              <ReferenceLine y={10} stroke="rgba(255,255,255,0.15)" strokeDasharray="3 3" />
              <XAxis
                type="number"
                dataKey="margin"
                name="Profit Margin"
                unit="%"
                tickLine={false}
                axisLine={false}
                tick={{ fill: '#E2E8F0', fontSize: 11, fontWeight: 600 }}
              />
              <YAxis
                type="number"
                dataKey="orders"
                name="Order Volume"
                tickLine={false}
                axisLine={false}
                tick={{ fill: '#CBD5E1', fontSize: 11, fontWeight: 600 }}
              />
              <ZAxis range={[60, 240]} />
              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const d = payload[0].payload;
                    return (
                      <div className="glass-panel bg-slate-950/95 p-3 rounded-xl border border-white/25 text-xs shadow-2xl space-y-1">
                        <p className="font-bold text-white font-mono">{d.sku}</p>
                        <p className="text-slate-300 text-[11px] truncate max-w-[200px]">{d.productName}</p>
                        <p className="text-slate-300">
                          Decision: <span className="font-black" style={{ color: d.color }}>{d.decision}</span>
                        </p>
                        <p className="text-slate-300">
                          Orders: <span className="font-bold text-white">{d.orders} units</span>
                        </p>
                        <p className="text-slate-300">
                          Margin: <span className="font-black text-white">{d.margin}%</span>
                        </p>
                        <p className="text-slate-300">
                          Profit: <span className="font-black text-emerald-400">{formatINRWithDecimals(d.profit)}</span>
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Scatter name="SKUs" data={data}>
                {data.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.color}
                    stroke="rgba(255,255,255,0.4)"
                    strokeWidth={1}
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

