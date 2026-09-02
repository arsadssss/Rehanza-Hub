'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatINRWithDecimals } from '@/lib/format';
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts';
import { TrendingUp, Calendar, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DailyFinancialMetric } from '@/lib/reconciliation/types';

interface DailyFinancialChartProps {
  dailyTrends: DailyFinancialMetric[] | null;
  loading: boolean;
}

export function DailyFinancialChart({ dailyTrends, loading }: DailyFinancialChartProps) {
  const [activeMetric, setActiveMetric] = useState<'revenue' | 'profit'>('revenue');

  if (loading || !dailyTrends) {
    return (
      <Card className="glass-panel bg-slate-950/60 border-white/15 rounded-2xl overflow-hidden p-6 space-y-4 shadow-[0_8px_30px_rgba(0,0,0,0.25)]">
        <Skeleton className="h-6 w-48 bg-white/10" />
        <Skeleton className="h-64 w-full bg-white/5" />
      </Card>
    );
  }

  if (dailyTrends.length === 0) {
    return (
      <Card className="glass-panel bg-slate-950/60 border-white/15 rounded-2xl p-6 shadow-[0_8px_30px_rgba(0,0,0,0.25)]">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-indigo-500/15 border border-indigo-400/30 flex items-center justify-center text-indigo-400">
            <Calendar className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-black text-white">Daily Financial Trends</h4>
            <p className="text-xs text-slate-300 mt-0.5">
              No daily transaction trends recorded for this period.
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
            <TrendingUp className="h-5 w-5 text-indigo-400" />
            <span>Daily Financial Trends</span>
          </CardTitle>
          <p className="text-xs text-slate-300 mt-0.5 font-medium">
            Daily distribution of order revenue and net realized profit over time
          </p>
        </div>

        {/* View Toggle */}
        <div className="inline-flex rounded-xl p-1 bg-slate-950/80 border border-white/15 backdrop-blur-md self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveMetric('revenue')}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5',
              activeMetric === 'revenue'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/40'
                : 'text-slate-300 hover:text-white hover:bg-white/10'
            )}
          >
            <DollarSign className="h-3.5 w-3.5" />
            <span>Daily Revenue</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveMetric('profit')}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5',
              activeMetric === 'profit'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/40'
                : 'text-slate-300 hover:text-white hover:bg-white/10'
            )}
          >
            <TrendingUp className="h-3.5 w-3.5" />
            <span>Daily Profit / Loss</span>
          </button>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-6">
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            {activeMetric === 'revenue' ? (
              <AreaChart
                data={dailyTrends}
                margin={{ top: 15, right: 15, left: 15, bottom: 25 }}
              >
                <defs>
                  <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366F1" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#6366F1" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  interval={Math.ceil(dailyTrends.length / 10)}
                  angle={-25}
                  textAnchor="end"
                  height={40}
                  tick={{ fill: '#E2E8F0', fontSize: 11, fontWeight: 600 }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => `₹${Math.round(val / 1000)}k`}
                  tick={{ fill: '#CBD5E1', fontSize: 11, fontWeight: 600 }}
                />
                <Tooltip
                  cursor={{ stroke: 'rgba(255,255,255,0.2)' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload as DailyFinancialMetric;
                      return (
                        <div className="glass-panel bg-slate-950/95 p-3 rounded-xl border border-white/25 text-xs shadow-2xl space-y-1">
                          <p className="font-bold text-white text-xs">{data.date}</p>
                          <p className="text-slate-300">
                            Orders: <span className="font-bold text-white">{data.orders.toLocaleString('en-IN')}</span>
                          </p>
                          <p className="text-slate-300">
                            Revenue: <span className="font-black text-indigo-400">{formatINRWithDecimals(data.revenue)}</span>
                          </p>
                          <p className="text-slate-300">
                            Profit: <span className={cn('font-black', data.profit >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
                              {formatINRWithDecimals(data.profit)}
                            </span>
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#6366F1"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#revenueGrad)"
                />
              </AreaChart>
            ) : (
              <BarChart
                data={dailyTrends}
                margin={{ top: 15, right: 15, left: 15, bottom: 25 }}
              >
                <ReferenceLine y={0} stroke="rgba(255,255,255,0.35)" strokeWidth={1.5} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  interval={Math.ceil(dailyTrends.length / 10)}
                  angle={-25}
                  textAnchor="end"
                  height={40}
                  tick={{ fill: '#E2E8F0', fontSize: 11, fontWeight: 600 }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => `₹${Math.round(val / 1000)}k`}
                  tick={{ fill: '#CBD5E1', fontSize: 11, fontWeight: 600 }}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.08)' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload as DailyFinancialMetric;
                      return (
                        <div className="glass-panel bg-slate-950/95 p-3 rounded-xl border border-white/25 text-xs shadow-2xl space-y-1">
                          <p className="font-bold text-white text-xs">{data.date}</p>
                          <p className="text-slate-300">
                            Orders: <span className="font-bold text-white">{data.orders.toLocaleString('en-IN')}</span>
                          </p>
                          <p className="text-slate-300">
                            Profit: <span className={cn('font-black', data.profit >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
                              {formatINRWithDecimals(data.profit)}
                            </span>
                          </p>
                          <p className="text-slate-300">
                            Revenue: <span className="font-black text-indigo-400">{formatINRWithDecimals(data.revenue)}</span>
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="profit" radius={[4, 4, 4, 4]}>
                  {dailyTrends.map((entry, index) => (
                    <Cell
                      key={`daily-profit-${index}`}
                      fill={entry.profit >= 0 ? '#10B981' : '#F43F5E'}
                    />
                  ))}
                </Bar>
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

