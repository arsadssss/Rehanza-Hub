"use client"

import React from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import {
  PieChart,
  Pie,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
  AreaChart,
  Area,
} from 'recharts';
import {
  ChartContainer,
  ChartTooltipContent,
} from '@/components/ui/chart';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, ArrowUpRight, ChevronRight } from 'lucide-react';
import { formatINR } from '@/lib/format';

const SalesTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="rounded-xl bg-slate-900/90 backdrop-blur-md text-white p-4 shadow-2xl border border-white/10 scale-105 transition-all duration-200">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                    {label} <ChevronRight className="h-3 w-3" />
                </p>
                <div className="space-y-1.5">
                    <div className="flex flex-col">
                        <span className="text-[10px] text-slate-400 font-medium">Revenue</span>
                        <p className="text-xl font-black text-indigo-400 leading-tight">
                            {formatINR(data.total_sales)}
                        </p>
                    </div>
                    <div className="pt-1.5 border-t border-white/10 flex items-center justify-between gap-4">
                        <span className="text-[10px] text-slate-300">Total Orders</span>
                        <span className="text-sm font-bold text-white bg-indigo-500/20 px-2 py-0.5 rounded-full">{data.orders}</span>
                    </div>
                </div>
            </div>
        );
    }
    return null;
};

const platformChartConfig = {
  value: { label: "Orders" },
  Meesho: { label: "Meesho", color: "#FF4FA3" },
  Flipkart: { label: "Flipkart", color: "#FFC107" },
  Amazon: { label: "Amazon", color: "#C89F6D" },
} as const;

interface AnalyticsSectionProps {
  salesTrendRaw: any[];
  platformBreakdownRaw: any[];
  totalPlatformOrders: number;
  timeRange: string;
  onTimeRangeChange: (val: string) => void;
  loading: boolean;
}

export function AnalyticsSection({
  salesTrendRaw,
  platformBreakdownRaw,
  totalPlatformOrders,
  timeRange,
  onTimeRangeChange,
  loading
}: AnalyticsSectionProps) {
  
  const mappedSalesTrend = React.useMemo(() => {
    return (salesTrendRaw || []).map((s: any) => {
        const d = new Date(s.date);
        let label = '';
        
        if (timeRange === '7d') label = format(d, 'eee');
        else if (timeRange === 'monthly') label = format(d, 'd');
        else if (timeRange === 'yearly') label = format(d, 'MMM');
        else label = format(d, 'dd MMM');

        return {
            label,
            total_sales: Number(s.revenue),
            orders: Number(s.orders)
        }
    });
  }, [salesTrendRaw, timeRange]);

  const mappedPlatformBreakdown = React.useMemo(() => {
    return (platformBreakdownRaw || []).map((b: any) => ({
        name: b.platform,
        value: b.orders
    }));
  }, [platformBreakdownRaw]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        <div className="lg:col-span-3 bg-white/40 dark:bg-black/20 backdrop-blur-xl rounded-none p-8 shadow-[0_20px_50px_rgba(0,0,0,0.05)] border border-white/30 dark:border-white/10 text-black dark:text-white transition-all duration-500 hover:shadow-indigo-500/5">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                <div>
                    <h3 className="font-black text-2xl tracking-tight font-headline">Revenue Trends</h3>
                    <p className="text-sm opacity-60 font-medium">Visualizing growth and volume performance</p>
                </div>
                <div className="flex items-center gap-3">
                    <Select value={timeRange} onValueChange={onTimeRangeChange}>
                        <SelectTrigger className="w-[140px] h-9 text-[10px] font-bold uppercase tracking-widest bg-white/50 dark:bg-white/5 border-white/20 rounded-xl focus:ring-primary/20">
                            <SelectValue placeholder="Time Range" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="7d" className="text-[10px] font-bold uppercase">Last 7 Days</SelectItem>
                            <SelectItem value="monthly" className="text-[10px] font-bold uppercase">Monthly</SelectItem>
                            <SelectItem value="yearly" className="text-[10px] font-bold uppercase">Yearly</SelectItem>
                        </SelectContent>
                    </Select>
                    <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-wider">
                        <TrendingUp className="h-3 w-3" />
                        Live
                    </div>
                </div>
            </div>
            <div className="h-[350px] w-full">
                {loading ? <Skeleton className="h-full w-full bg-black/5 dark:bg-white/5 rounded-3xl" /> : (
                    <ResponsiveContainer width="100%" height={300}>
                        <AreaChart
                            data={mappedSalesTrend}
                            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                        >
                            <defs>
                                <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={"rgba(0,0,0,0.05)"} />
                            <XAxis
                                dataKey="label"
                                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))", fontWeight: 700 }}
                                axisLine={false}
                                tickLine={false}
                                dy={10}
                            />
                            <YAxis
                                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))", fontWeight: 700 }}
                                axisLine={false}
                                tickLine={false}
                                tickFormatter={(value) => `₹${value >= 1000 ? (value/1000).toFixed(0) + 'k' : value}`}
                            />
                            <Tooltip
                                content={<SalesTooltip />}
                                cursor={{ stroke: '#6366f1', strokeWidth: 2, strokeDasharray: '5 5' }}
                            />
                            <Area
                                type="monotone"
                                dataKey="total_sales"
                                stroke="#6366f1"
                                strokeWidth={4}
                                fillOpacity={1}
                                fill="url(#colorSales)"
                                activeDot={{ r: 8, strokeWidth: 0, fill: '#6366f1' }}
                                animationDuration={2500}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                )}
            </div>
        </div>

        <div className="lg:col-span-2 bg-white/40 dark:bg-black/20 backdrop-blur-xl rounded-none p-8 shadow-[0_20px_50px_rgba(0,0,0,0.05)] border border-white/30 dark:border-white/10 text-black dark:text-white">
            <div className="flex justify-between items-center mb-6">
                <h3 className="font-black text-xl font-headline">Platform Distribution</h3>
                <Link href="/orders" className="text-xs font-black uppercase tracking-wider opacity-70 flex items-center gap-1 hover:opacity-100 transition-opacity">Full View <ArrowUpRight className="h-3 w-3" /></Link>
            </div>
            {loading ? <Skeleton className="h-[350px] w-full bg-black/5 dark:bg-white/5 mt-4 rounded-3xl" /> : (
                <div className="flex flex-col items-center gap-4 mt-4">
                    <div className="w-full h-[250px] relative">
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                            <p className="text-4xl font-black">{totalPlatformOrders}</p>
                            <p className="text-[10px] font-black uppercase tracking-widest opacity-50">Total Orders</p>
                        </div>
                        <ChartContainer config={platformChartConfig} className="h-full w-full">
                            <ResponsiveContainer>
                                <PieChart>
                                    <Tooltip content={<ChartTooltipContent nameKey="name" formatter={(value) => `${value} orders`} />} />
                                    <Pie 
                                        data={mappedPlatformBreakdown} 
                                        dataKey="value" 
                                        nameKey="name" 
                                        cx="50%" 
                                        cy="50%" 
                                        innerRadius={90} 
                                        outerRadius={115} 
                                        strokeWidth={2}
                                        paddingAngle={5}
                                    >
                                        {mappedPlatformBreakdown.map((entry) => (
                                            <Cell key={`cell-${entry.name}`} fill={platformChartConfig[entry.name as keyof typeof platformChartConfig]?.color} />
                                        ))}
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                        </ChartContainer>
                    </div>
                    <div className="w-full">
                        <ul className="flex flex-wrap justify-center items-center gap-x-6 gap-y-3">
                            {mappedPlatformBreakdown.map((platform) => (
                                <li key={platform.name} className="flex items-center justify-start text-sm">
                                  <div className="flex items-center gap-2">
                                      <span style={{ backgroundColor: platformChartConfig[platform.name as keyof typeof platformChartConfig]?.color }} className="h-3 w-3 rounded-lg shadow-lg" />
                                      <span className="text-[11px] font-bold uppercase tracking-wider">{platform.name} — <span className="font-black text-xs">{platform.value}</span></span>
                                  </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}
        </div>
    </div>
  );
}
