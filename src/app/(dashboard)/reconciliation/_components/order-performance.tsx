'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatINRWithDecimals } from '@/lib/format';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import {
  CheckCircle2,
  Truck,
  RotateCcw,
  CornerUpLeft,
  XCircle,
  HelpCircle,
  Clock,
  Coins,
  Package,
  UploadCloud,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { OrderStatusBreakdown } from '@/lib/reconciliation/types';

interface OrderPerformanceProps {
  orders: OrderStatusBreakdown | null;
  averageOrderValue: number;
  loading: boolean;
}

// Chart Colors matching the project's theme tokens
const STATUS_COLORS: Record<string, string> = {
  Delivered: '#10B981', // emerald-500
  Shipped: '#3B82F6',   // blue-500
  Exchange: '#8B5CF6',  // purple-500
  Return: '#F59E0B',    // amber-500
  RTO: '#EF4444',       // red-500
  Cancel: '#94A3B8',    // slate-400
};

export function OrderPerformance({
  orders,
  averageOrderValue,
  loading,
}: OrderPerformanceProps) {
  if (loading || !orders) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="glass-panel bg-slate-950/60 border border-white/15 p-6 rounded-2xl lg:col-span-1 space-y-4">
          <Skeleton className="h-6 w-36 bg-white/10" />
          <Skeleton className="h-56 w-full rounded-full bg-white/5" />
        </div>
        <div className="glass-panel bg-slate-950/60 border border-white/15 p-6 rounded-2xl lg:col-span-2 space-y-3">
          <Skeleton className="h-6 w-48 bg-white/10" />
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-10 w-full bg-white/5" />
          ))}
        </div>
      </div>
    );
  }

  // Check if orders exist
  if (orders.totalOrders === 0) {
    return (
      <Card className="glass-panel bg-slate-950/60 border-white/15 rounded-2xl p-6 shadow-[0_8px_30px_rgba(0,0,0,0.25)]">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-purple-500/15 border border-purple-400/30 flex items-center justify-center text-purple-400 flex-shrink-0">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-black text-white">
                Order Status Distribution & Performance
              </h4>
              <p className="text-xs text-slate-300 mt-0.5">
                No order performance data recorded for this period
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
            <UploadCloud className="h-4 w-4 text-purple-400" />
            <span>Upload Orders, Payments and RM Ads to begin.</span>
          </div>
        </div>
      </Card>
    );
  }

  // Donut chart dataset using server-provided values
  const chartData = [
    { name: 'Delivered', value: orders.deliveredOrders, rate: orders.deliveredRate, color: STATUS_COLORS.Delivered },
    { name: 'Shipped', value: orders.shippedOrders, rate: orders.shippedRate, color: STATUS_COLORS.Shipped },
    { name: 'Exchange', value: orders.exchangeOrders, rate: orders.exchangeRate, color: STATUS_COLORS.Exchange },
    { name: 'Return', value: orders.returnOrders, rate: orders.returnRate, color: STATUS_COLORS.Return },
    { name: 'RTO', value: orders.rtoOrders, rate: orders.rtoRate, color: STATUS_COLORS.RTO },
    { name: 'Cancel', value: orders.cancelOrders, rate: orders.cancelRate, color: STATUS_COLORS.Cancel },
  ].filter((item) => item.value > 0);

  // Status rows for the table
  const statusRows = [
    {
      label: 'Delivered',
      qty: orders.deliveredOrders,
      rate: orders.deliveredRate,
      icon: CheckCircle2,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/15 border-emerald-500/30',
      desc: 'Successfully delivered to customer',
    },
    {
      label: 'Shipped',
      qty: orders.shippedOrders,
      rate: orders.shippedRate,
      icon: Truck,
      color: 'text-blue-400',
      bg: 'bg-blue-500/15 border-blue-500/30',
      desc: 'Dispatched & in transit',
    },
    {
      label: 'Exchange',
      qty: orders.exchangeOrders,
      rate: orders.exchangeRate,
      icon: RotateCcw,
      color: 'text-purple-400',
      bg: 'bg-purple-500/15 border-purple-500/30',
      desc: 'Replacement or size exchange order',
    },
    {
      label: 'Returns (Excl. RTO)',
      qty: orders.returnOrders,
      rate: orders.returnRate,
      icon: CornerUpLeft,
      color: 'text-amber-400',
      bg: 'bg-amber-500/15 border-amber-500/30',
      desc: 'Customer return shipments',
    },
    {
      label: 'RTO',
      qty: orders.rtoOrders,
      rate: orders.rtoRate,
      icon: XCircle,
      color: 'text-red-400',
      bg: 'bg-red-500/15 border-red-500/30',
      desc: 'Undelivered return to origin',
    },
    {
      label: 'Cancel',
      qty: orders.cancelOrders,
      rate: orders.cancelRate,
      icon: HelpCircle,
      color: 'text-slate-300',
      bg: 'bg-slate-500/15 border-slate-500/30',
      desc: 'Cancelled pre-delivery',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Donut Chart Visualization */}
        <Card className="glass-panel bg-slate-950/60 border-white/15 rounded-2xl overflow-hidden flex flex-col justify-between shadow-[0_8px_30px_rgba(0,0,0,0.25)]">
          <CardHeader className="pb-3 border-b border-white/15">
            <CardTitle className="text-base font-black text-white flex items-center justify-between">
              <span>Order Distribution</span>
              <span className="text-xs text-indigo-300 font-bold bg-indigo-500/10 px-2 py-0.5 rounded-lg border border-indigo-400/20">
                {orders.totalOrders.toLocaleString('en-IN')} Total
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 flex-1 flex flex-col items-center justify-center min-h-[260px]">
            <div className="h-[220px] w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="glass-panel bg-slate-950/95 p-3 rounded-xl border border-white/25 text-xs shadow-2xl space-y-1">
                            <p className="font-black text-white">{data.name}</p>
                            <p className="text-slate-300">
                              Qty: <span className="font-bold text-white">{data.value.toLocaleString('en-IN')}</span> ({data.rate}%)
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Pie
                    data={chartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    stroke="rgba(15,23,42,0.8)"
                    strokeWidth={2}
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              {/* Center text in donut */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                  Net Orders
                </span>
                <span className="text-2xl font-black font-headline text-white">
                  {orders.netOrders.toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {/* Quick Chart Legend */}
            <div className="grid grid-cols-3 gap-2 w-full pt-3 border-t border-white/15 text-xs font-semibold">
              {chartData.slice(0, 6).map((item) => (
                <div key={item.name} className="flex items-center gap-1.5 truncate">
                  <span
                    className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-slate-300 truncate">{item.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Right: Order Status Breakdown Table & AOV */}
        <Card className="glass-panel bg-slate-950/60 border-white/15 rounded-2xl lg:col-span-2 flex flex-col justify-between overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.25)]">
          <CardHeader className="pb-3 border-b border-white/15 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base md:text-lg font-black text-white">
                Order Performance Breakdown
              </CardTitle>
              <p className="text-xs text-slate-300 mt-0.5 font-medium">
                Exact quantity and percentage breakdown from server reconciliation
              </p>
            </div>
            {/* Server-provided AOV Badge */}
            <div className="glass-pill px-3.5 py-1.5 rounded-xl border border-indigo-400/40 bg-indigo-500/15 flex items-center gap-2.5 self-start sm:self-auto">
              <Coins className="h-4 w-4 text-indigo-300" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-300">Avg. Order Value</p>
                <p className="text-sm font-black text-white">{formatINRWithDecimals(averageOrderValue)}</p>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-4 sm:p-6 flex-1">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/15 text-slate-300 font-bold uppercase text-[11px] tracking-wider">
                    <th className="text-left pb-3 font-bold">Status</th>
                    <th className="text-left pb-3 font-bold hidden sm:table-cell">Context</th>
                    <th className="text-right pb-3 font-bold">Quantity</th>
                    <th className="text-right pb-3 font-bold">Share of Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-medium">
                  {statusRows.map((row) => {
                    const Icon = row.icon;
                    return (
                      <tr key={row.label} className="hover:bg-white/[0.04] transition-colors">
                        <td className="py-3 flex items-center gap-2.5">
                          <div className={cn('h-6 w-6 rounded-lg flex items-center justify-center border', row.bg)}>
                            <Icon className={cn('h-3.5 w-3.5', row.color)} />
                          </div>
                          <span className="font-bold text-slate-100 text-xs sm:text-sm">{row.label}</span>
                        </td>
                        <td className="py-3 text-slate-300 hidden sm:table-cell text-xs font-medium">
                          {row.desc}
                        </td>
                        <td className="py-3 text-right font-black text-white text-xs sm:text-sm">
                          {row.qty.toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 text-right">
                          <Badge variant="outline" className={cn('text-xs font-bold border px-2 py-0.5', row.bg, row.color)}>
                            {row.rate}%
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                  {/* Summary row for Net Orders */}
                  <tr className="bg-indigo-950/25 font-bold border-t border-white/15">
                    <td className="py-3.5 text-indigo-300 flex items-center gap-2.5">
                      <CheckCircle2 className="h-4 w-4 text-indigo-400" />
                      <span className="text-xs sm:text-sm font-black">Net Orders (Fulfilled Scope)</span>
                    </td>
                    <td className="py-3.5 text-xs text-slate-300 hidden sm:table-cell font-medium">
                      Delivered + Exchange + Returns (Workbook D20)
                    </td>
                    <td className="py-3.5 text-right text-sm sm:text-base font-black text-indigo-300">
                      {orders.netOrders.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3.5 text-right">
                      <Badge variant="outline" className="text-xs font-bold border-indigo-400/40 text-indigo-200 bg-indigo-500/20 px-2 py-0.5">
                        {orders.totalOrders > 0 ? ((orders.netOrders / orders.totalOrders) * 100).toFixed(2) : 0}%
                      </Badge>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Awaiting Payment notice if applicable */}
            {orders.awaitingPayment > 0 && (
              <div className="mt-4 p-3 rounded-xl bg-amber-500/15 border border-amber-400/30 flex items-center gap-2.5 text-xs text-amber-200 font-medium">
                <Clock className="h-4 w-4 text-amber-400 flex-shrink-0" />
                <span>
                  <strong className="text-white">{orders.awaitingPayment} Delivered orders</strong> have not received settlement yet from Meesho.
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
