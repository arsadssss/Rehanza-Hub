'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Line,
  ComposedChart,
} from 'recharts';
import { TrendingUp, Activity } from 'lucide-react';
import { format } from 'date-fns';

interface BusinessTrajectoryProps {
  dates: string[];
  netMargins: number[];
  costToSalesRatios: number[];
  loading: boolean;
}

export function BusinessTrajectory({
  dates,
  netMargins,
  costToSalesRatios,
  loading,
}: BusinessTrajectoryProps) {
  if (loading || dates.length === 0) {
    return (
      <Card className="glass-panel border-white/10 bg-slate-900/40 p-6 rounded-3xl">
        <Skeleton className="h-6 w-44 bg-white/10 mb-4" />
        <Skeleton className="h-64 w-full bg-white/5 rounded-2xl" />
      </Card>
    );
  }

  const chartData = dates.map((d, i) => {
    let label = d;
    try {
      label = format(new Date(d), 'dd MMM');
    } catch {
      label = d;
    }
    return {
      date: label,
      rawDate: d,
      netMargin: netMargins[i] ?? 0,
      costRatio: costToSalesRatios[i] ?? 0,
    };
  });

  return (
    <Card className="glass-panel border-white/10 bg-slate-900/40 rounded-3xl p-6 shadow-xl backdrop-blur-xl space-y-4">
      <CardHeader className="p-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="glass-pill h-6 px-2 rounded-md border border-cyan-500/30 bg-cyan-500/10 font-bold text-[10px] uppercase tracking-wider text-cyan-300"
              >
                Trajectory
              </Badge>
              <CardTitle className="text-base sm:text-lg font-black tracking-tight text-white font-headline">
                Business Trend
              </CardTitle>
            </div>
          </div>
          <Activity className="h-5 w-5 text-cyan-400" />
        </div>
      </CardHeader>

      <div className="h-[280px] w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="marginGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis
              dataKey="date"
              stroke="#64748B"
              fontSize={10}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="#64748B"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              unit="%"
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="p-3 bg-slate-900/95 border border-white/10 rounded-xl shadow-2xl backdrop-blur-md">
                      <p className="text-[10px] font-black uppercase text-slate-400 mb-1">{label}</p>
                      <p className="text-xs font-bold text-emerald-400">
                        Net Margin: {payload[0]?.value}%
                      </p>
                      <p className="text-xs font-bold text-rose-400 mt-0.5">
                        Cost Drag: {payload[1]?.value}%
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Area
              type="monotone"
              dataKey="netMargin"
              name="Net Margin %"
              stroke="#10B981"
              strokeWidth={2.5}
              fill="url(#marginGradient)"
            />
            <Line
              type="monotone"
              dataKey="costRatio"
              name="Cost Ratio %"
              stroke="#F43F5E"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-white/5">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          <span>Net Realized Margin %</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-rose-400" />
          <span>Total Cost-to-Sales Drag % (COGS + Freight + Fees)</span>
        </div>
      </div>
    </Card>
  );
}
