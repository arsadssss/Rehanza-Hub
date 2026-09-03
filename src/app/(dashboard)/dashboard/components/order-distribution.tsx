'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { OrderStatusBreakdown } from '@/lib/reconciliation/types';
import { PieChart as PieChartIcon, AlertTriangle, RefreshCw } from 'lucide-react';

interface OrderDistributionProps {
  orders: OrderStatusBreakdown | null;
  loading: boolean;
  periodLabel: string;
  error?: string | null;
  onRetry?: () => void;
}

interface StatusItem {
  name: string;
  key: string;
  count: number;
  percentage: number;
  color: string;
}

export function OrderDistribution({
  orders,
  loading,
  periodLabel,
  error,
  onRetry,
}: OrderDistributionProps) {
  // 1. Loading State -> Skeletons
  if (loading) {
    return (
      <Card className="glass-panel relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-slate-900/40 p-8 shadow-[0_18px_55px_rgba(2,6,23,0.22)] backdrop-blur-xl h-full flex flex-col justify-between">
        <div className="space-y-2">
          <Skeleton className="h-6 w-40 bg-white/10" />
          <Skeleton className="h-4 w-60 bg-white/5" />
        </div>
        <div className="flex items-center justify-center py-8">
          <Skeleton className="h-44 w-44 rounded-full bg-white/10" />
        </div>
        <div className="space-y-2 pt-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-8 w-full rounded-xl bg-white/5" />
          ))}
        </div>
      </Card>
    );
  }

  // 2. Error or Missing Data State -> Polished Error Card, NEVER infinite skeleton
  if (error || !orders) {
    return (
      <Card className="glass-panel relative overflow-hidden rounded-[2.5rem] border border-rose-500/20 bg-rose-950/10 p-8 shadow-[0_18px_55px_rgba(2,6,23,0.22)] backdrop-blur-xl h-full flex flex-col justify-between">
        <CardHeader className="p-0 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-500/10 rounded-xl text-rose-400">
              <PieChartIcon className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="font-headline text-xl font-bold text-white">
                Order Distribution
              </CardTitle>
              <CardDescription className="text-[10px] uppercase font-bold tracking-widest text-slate-400">
                Canonical Status Breakdown • {periodLabel}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <div className="py-8 flex flex-col items-center justify-center text-center space-y-3">
          <AlertTriangle className="h-8 w-8 text-rose-400" />
          <p className="text-xs text-slate-300">
            {error || `Distribution data unavailable for ${periodLabel}.`}
          </p>
          {onRetry && (
            <Button
              onClick={onRetry}
              variant="outline"
              size="sm"
              className="glass-button rounded-xl text-xs font-bold"
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Retry
            </Button>
          )}
        </div>
        <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 text-[10px] text-slate-400 text-center">
          Status pipeline uninitialized
        </div>
      </Card>
    );
  }

  // 3. Empty Data State (0 total orders)
  if (orders.totalOrders === 0) {
    return (
      <Card className="glass-panel relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-slate-900/40 p-8 shadow-[0_18px_55px_rgba(2,6,23,0.22)] backdrop-blur-xl h-full flex flex-col justify-between">
        <CardHeader className="p-0 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/10 rounded-xl text-indigo-400">
              <PieChartIcon className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="font-headline text-xl font-bold text-white">
                Order Distribution
              </CardTitle>
              <CardDescription className="text-[10px] uppercase font-bold tracking-widest text-slate-400">
                Canonical Status Breakdown • {periodLabel}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <div className="py-12 flex flex-col items-center justify-center text-center space-y-2">
          <p className="text-sm font-bold text-slate-300">No orders recorded</p>
          <p className="text-xs text-slate-400">No transactions found for {periodLabel}.</p>
        </div>
        <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 text-[10px] text-slate-400 text-center">
          0 units processed
        </div>
      </Card>
    );
  }

  // 4. Data State -> Full Donut & Legend
  const totalOrders = orders.totalOrders || 1;

  // 6 Canonical statuses per reconciliation definition
  const distributionData: StatusItem[] = [
    {
      name: 'Delivered',
      key: 'delivered',
      count: orders.deliveredOrders,
      percentage: orders.deliveredRate,
      color: '#10B981', // Emerald
    },
    {
      name: 'Customer Return',
      key: 'return',
      count: orders.returnOrders,
      percentage: orders.returnRate,
      color: '#F59E0B', // Amber
    },
    {
      name: 'RTO (Undelivered)',
      key: 'rto',
      count: orders.rtoOrders,
      percentage: orders.rtoRate,
      color: '#F43F5E', // Rose
    },
    {
      name: 'Cancelled',
      key: 'cancel',
      count: orders.cancelOrders,
      percentage: orders.cancelRate,
      color: '#64748B', // Slate
    },
    {
      name: 'Shipped',
      key: 'shipped',
      count: orders.shippedOrders,
      percentage: orders.shippedRate,
      color: '#3B82F6', // Blue
    },
    {
      name: 'Exchange',
      key: 'exchange',
      count: orders.exchangeOrders,
      percentage: orders.exchangeRate,
      color: '#8B5CF6', // Purple
    },
  ];

  // Filter out statuses with 0 count for the pie chart rendering
  const activePieData = distributionData.filter((d) => d.count > 0);

  return (
    <Card className="glass-panel relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-slate-900/40 shadow-[0_18px_55px_rgba(2,6,23,0.22)] backdrop-blur-xl h-full flex flex-col justify-between">
      <CardHeader className="p-8 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/10 rounded-xl text-indigo-400">
              <PieChartIcon className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="font-headline text-xl font-bold text-white">
                Order Distribution
              </CardTitle>
              <CardDescription className="text-[10px] uppercase font-bold tracking-widest text-slate-400">
                Canonical Status Breakdown • {periodLabel}
              </CardDescription>
            </div>
          </div>
          <Badge
            variant="outline"
            className="glass-pill px-3 py-1 rounded-xl border border-white/15 bg-white/5 font-bold text-[11px] text-white"
          >
            {orders.totalOrders} Total Units
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="px-8 pb-8 space-y-6 flex-1 flex flex-col justify-between">
        {/* Donut Chart with Center Total */}
        <div className="relative h-[200px] w-full flex items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload as StatusItem;
                    return (
                      <div className="glass-panel bg-slate-950/90 border border-white/20 p-3 rounded-xl shadow-2xl text-xs space-y-1">
                        <div className="flex items-center gap-2">
                          <div
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: data.color }}
                          />
                          <p className="font-bold text-white">{data.name}</p>
                        </div>
                        <p className="text-slate-300 font-semibold">
                          {data.count} units ({data.percentage}%)
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Pie
                data={activePieData}
                innerRadius={62}
                outerRadius={88}
                paddingAngle={3}
                dataKey="count"
                stroke="none"
              >
                {activePieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>

          {/* Center Summary Label */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-2xl font-black font-headline tracking-tight text-white leading-none">
              {orders.deliveredRate}%
            </span>
            <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-400 mt-1">
              Delivered
            </span>
          </div>
        </div>

        {/* Legend Grid with Clean Badges */}
        <div className="grid grid-cols-2 gap-2.5 pt-2">
          {distributionData.map((item) => (
            <div
              key={item.key}
              className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] transition-colors"
            >
              <div className="flex items-center gap-2 overflow-hidden">
                <div
                  className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-[11px] font-bold text-slate-200 truncate">
                  {item.name}
                </span>
              </div>
              <div className="text-right flex-shrink-0 pl-2">
                <span className="text-xs font-black text-white">{item.count}</span>
                <span className="text-[10px] text-slate-400 font-medium ml-1">
                  ({item.percentage}%)
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
