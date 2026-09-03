'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatINRWithDecimals, formatINR } from '@/lib/format';
import {
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { DailyTrendMetric } from '@/lib/reconciliation/types';
import { TrendingUp, BarChart2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DailyFinancialTrendsProps {
  dailyTrends: DailyTrendMetric[];
  loading: boolean;
  periodLabel: string;
}

export function DailyFinancialTrends({
  dailyTrends,
  loading,
  periodLabel,
}: DailyFinancialTrendsProps) {
  const [activeSeries, setActiveSeries] = useState<'all' | 'revenue' | 'settlement' | 'profit'>('all');

  if (loading) {
    return (
      <Card className="glass-panel relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-slate-900/40 p-8 shadow-[0_18px_55px_rgba(2,6,23,0.22)] backdrop-blur-xl h-full flex flex-col justify-between">
        <div className="flex justify-between items-center">
          <div className="space-y-2">
            <Skeleton className="h-6 w-48 bg-white/10" />
            <Skeleton className="h-4 w-72 bg-white/5" />
          </div>
          <Skeleton className="h-9 w-40 rounded-xl bg-white/10" />
        </div>
        <div className="h-[340px] w-full mt-6">
          <Skeleton className="h-full w-full rounded-2xl bg-white/5" />
        </div>
      </Card>
    );
  }

  // Format data points for readable display
  const chartData = dailyTrends.map((d) => ({
    ...d,
    formattedDate: new Date(d.date).toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
    }),
  }));

  // Totals for top legend summary
  const totalRevenue = dailyTrends.reduce((sum, d) => sum + d.revenue, 0);
  const totalSettlement = dailyTrends.reduce((sum, d) => sum + d.settlement, 0);
  const totalProfit = dailyTrends.reduce((sum, d) => sum + d.profit, 0);

  return (
    <Card className="glass-panel relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-slate-900/40 shadow-[0_18px_55px_rgba(2,6,23,0.22)] backdrop-blur-xl h-full">
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-8 pb-4 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/10 rounded-xl text-indigo-400">
              <BarChart2 className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="font-headline text-2xl font-black tracking-tight text-white">
                Daily Financial Trends
              </CardTitle>
              <CardDescription className="text-xs font-bold uppercase tracking-widest text-slate-400">
                Revenue, settlement & profit trajectory • {periodLabel}
              </CardDescription>
            </div>
          </div>
        </div>

        {/* Series Filter Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveSeries('all')}
            className={cn(
              'px-3 py-1.5 rounded-xl text-xs font-bold transition-all',
              activeSeries === 'all'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-white/5 text-slate-400 hover:text-white'
            )}
          >
            All Metrics
          </button>
          <button
            onClick={() => setActiveSeries('revenue')}
            className={cn(
              'px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5',
              activeSeries === 'revenue'
                ? 'bg-indigo-500 text-white shadow-md'
                : 'bg-white/5 text-slate-400 hover:text-white'
            )}
          >
            <div className="h-2 w-2 rounded-full bg-indigo-400" />
            Revenue
          </button>
          <button
            onClick={() => setActiveSeries('settlement')}
            className={cn(
              'px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5',
              activeSeries === 'settlement'
                ? 'bg-cyan-600 text-white shadow-md'
                : 'bg-white/5 text-slate-400 hover:text-white'
            )}
          >
            <div className="h-2 w-2 rounded-full bg-cyan-400" />
            Settlement
          </button>
          <button
            onClick={() => setActiveSeries('profit')}
            className={cn(
              'px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5',
              activeSeries === 'profit'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-white/5 text-slate-400 hover:text-white'
            )}
          >
            <div className="h-2 w-2 rounded-full bg-emerald-400" />
            Profit
          </button>
        </div>
      </CardHeader>

      <CardContent className="p-8 pt-2">
        {/* KPI Mini Summary Row */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/10">
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300">
              Period Revenue
            </span>
            <p className="text-base sm:text-lg font-black text-white mt-0.5">
              {formatINR(totalRevenue)}
            </p>
          </div>
          <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/10">
            <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-300">
              Period Settlement
            </span>
            <p className="text-base sm:text-lg font-black text-white mt-0.5">
              {formatINR(totalSettlement)}
            </p>
          </div>
          <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/10">
            <span
              className={cn(
                'text-[10px] font-bold uppercase tracking-wider',
                totalProfit >= 0 ? 'text-emerald-300' : 'text-rose-300'
              )}
            >
              Period Profit / Loss
            </span>
            <p
              className={cn(
                'text-base sm:text-lg font-black mt-0.5',
                totalProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
              )}
            >
              {formatINR(totalProfit)}
            </p>
          </div>
        </div>

        {/* Chart Canvas */}
        <div className="h-[320px] w-full">
          {chartData.length === 0 ? (
            <div className="h-full w-full flex flex-col items-center justify-center text-slate-400 text-xs">
              <p className="font-bold">No reconciliation daily activity found for {periodLabel}.</p>
              <p className="text-[11px] text-slate-500 mt-1">
                Upload order and payment exports to populate daily velocity.
              </p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorSettlement" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.08)" />
                <XAxis
                  dataKey="formattedDate"
                  tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                  tickLine={false}
                  tickFormatter={(val) => `₹${Math.round(val / 1000)}k`}
                />
                <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" strokeDasharray="3 3" />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="glass-panel bg-slate-950/95 border border-white/20 p-3.5 rounded-2xl shadow-2xl text-xs space-y-1.5 min-w-[180px]">
                          <p className="font-headline font-black text-white border-b border-white/10 pb-1">
                            {label}
                          </p>
                          {payload.map((entry: any, i: number) => {
                            const val = Number(entry.value || 0);
                            return (
                              <div key={i} className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-1.5">
                                  <div
                                    className="h-2 w-2 rounded-full"
                                    style={{ backgroundColor: entry.color }}
                                  />
                                  <span className="text-slate-300 font-medium capitalize">
                                    {entry.name}:
                                  </span>
                                </div>
                                <span
                                  className={cn(
                                    'font-black',
                                    entry.name === 'profit' && val < 0
                                      ? 'text-rose-400'
                                      : 'text-white'
                                  )}
                                >
                                  {formatINRWithDecimals(val)}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      );
                    }
                    return null;
                  }}
                />

                {(activeSeries === 'all' || activeSeries === 'revenue') && (
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    name="revenue"
                    stroke="#6366f1"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorRevenue)"
                  />
                )}

                {(activeSeries === 'all' || activeSeries === 'settlement') && (
                  <Area
                    type="monotone"
                    dataKey="settlement"
                    name="settlement"
                    stroke="#06b6d4"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorSettlement)"
                  />
                )}

                {(activeSeries === 'all' || activeSeries === 'profit') && (
                  <Line
                    type="monotone"
                    dataKey="profit"
                    name="profit"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    dot={false}
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

