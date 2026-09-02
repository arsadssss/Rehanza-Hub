'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
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
import { ShieldAlert } from 'lucide-react';
import { SkuDecisionRecommendation, DecisionState } from '@/lib/reconciliation/types';

interface FulfillmentRiskMatrixProps {
  decisions: SkuDecisionRecommendation[] | null;
  loading: boolean;
}

const DECISION_COLOR_MAP: Record<DecisionState, string> = {
  SCALE: '#10B981',
  HEALTHY: '#3B82F6',
  MONITOR: '#6366F1',
  REVIEW: '#F59E0B',
  STOP: '#F43F5E',
};

export function FulfillmentRiskMatrix({ decisions, loading }: FulfillmentRiskMatrixProps) {
  if (loading || !decisions) {
    return (
      <Card className="glass-panel bg-slate-950/60 border-white/15 rounded-2xl p-6 space-y-4 shadow-[0_8px_30px_rgba(0,0,0,0.25)]">
        <Skeleton className="h-6 w-48 bg-white/10" />
        <Skeleton className="h-64 w-full bg-white/5" />
      </Card>
    );
  }

  const data = decisions.map((d) => ({
    sku: d.sku,
    productName: d.productName,
    returnRate: d.metrics.returnRate,
    rtoRate: d.metrics.rtoRate,
    orders: d.metrics.totalOrders,
    decision: d.decision,
    riskScore: d.riskScore,
    color: DECISION_COLOR_MAP[d.decision] || '#94A3B8',
  }));

  if (data.length === 0) {
    return (
      <Card className="glass-panel bg-slate-950/60 border-white/15 rounded-2xl p-6 shadow-[0_8px_30px_rgba(0,0,0,0.25)]">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-indigo-500/15 border border-indigo-400/30 flex items-center justify-center text-indigo-400">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-black text-white">Fulfillment & Reverse Logistics Risk Matrix</h4>
            <p className="text-xs text-slate-300 mt-0.5">
              No SKU records available to map fulfillment risk for this period.
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
            <ShieldAlert className="h-5 w-5 text-rose-400" />
            <span>Fulfillment & Reverse Logistics Risk Matrix</span>
          </CardTitle>
          <p className="text-xs text-slate-300 mt-0.5 font-medium">
            Customer Return % (X-axis) vs Courier RTO % (Y-axis) with critical thresholds
          </p>
        </div>

        <div className="text-xs text-slate-400 font-medium">
          Dotted lines mark critical leakage boundaries (20% Return / 25% RTO)
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-6">
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 20, right: 20, bottom: 25, left: 15 }}>
              {/* Critical threshold lines */}
              <ReferenceLine x={20} stroke="#F59E0B" strokeDasharray="3 3" />
              <ReferenceLine y={25} stroke="#F43F5E" strokeDasharray="3 3" />
              <XAxis
                type="number"
                dataKey="returnRate"
                name="Return Rate"
                unit="%"
                tickLine={false}
                axisLine={false}
                tick={{ fill: '#E2E8F0', fontSize: 11, fontWeight: 600 }}
              />
              <YAxis
                type="number"
                dataKey="rtoRate"
                name="RTO Rate"
                unit="%"
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
                          Risk Score: <span className="font-black text-rose-400">{d.riskScore}/100</span>
                        </p>
                        <p className="text-slate-300">
                          Customer Return: <span className="font-black text-amber-400">{d.returnRate}%</span>
                        </p>
                        <p className="text-slate-300">
                          Courier RTO: <span className="font-black text-rose-400">{d.rtoRate}%</span>
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Scatter name="SKU Risks" data={data}>
                {data.map((entry, index) => (
                  <Cell
                    key={`risk-cell-${index}`}
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

