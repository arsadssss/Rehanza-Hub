"use client"

import React, { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
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
import { DollarSign, ShoppingCart, Undo2, TrendingUp, ArrowUpRight, ChevronRight } from 'lucide-react';
import { formatINR } from '@/lib/format';
import { apiFetch } from '@/lib/apiFetch';

const KpiCard = ({ title, value, icon: Icon, loading, gradient }: { title: string, value: string, icon: React.ElementType, loading: boolean, gradient: string }) => {
    return (
        <div className={`bg-white/40 dark:bg-black/20 backdrop-blur-lg rounded-3xl p-6 shadow-xl border border-white/30 dark:border-white/10 hover:-translate-y-1 transition-transform duration-300`}>
            <div className="flex justify-between items-start text-black dark:text-white">
                <div className="flex-1">
                    <p className="font-bold text-lg">{title}</p>
                    {loading ? <Skeleton className="h-12 w-3/4 mt-2 bg-black/10 dark:bg-white/10" /> : (
                        <p className="font-headline text-5xl font-bold mt-2">{value}</p>
                    )}
                </div>
                <div className={`p-3 rounded-lg bg-gradient-to-br ${gradient}`}>
                    <Icon className="h-6 w-6 text-white" />
                </div>
            </div>
        </div>
    );
};

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

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  const { toast } = useToast();
  
  const [totalSales, setTotalSales] = useState(0);
  const [totalOrders, setTotalOrders] = useState(0);
  const [totalReturns, setTotalReturns] = useState(0);
  const [netProfit, setNetProfit] = useState(0);
  
  const [salesTrend, setSalesTrend] = useState<any[]>([]);
  const [platformBreakdown, setPlatformBreakdown] = useState<{ name: string; value: number }[]>([]);
  const [totalPlatformOrders, setTotalPlatformOrders] = useState(0);

  useEffect(() => {
    setIsMounted(true);
    async function fetchAnalyticsData() {
      setLoading(true);
      try {
        const res = await apiFetch('/api/analytics');
        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.message || 'Failed to fetch report data');
        }
        const data = await res.json();
        
        setTotalSales(data.totalSales);
        setTotalOrders(data.totalOrders);
        setTotalReturns(data.totalReturns);
        setNetProfit(data.netProfit);
        
        setSalesTrend((data.salesTrend || []).map((s: any) => ({
            label: format(new Date(s.date), 'dd MMM'),
            total_sales: Number(s.revenue),
            orders: Number(s.orders)
        })));

        setPlatformBreakdown((data.platformOrders?.breakdown || []).map((b: any) => ({
            name: b.platform,
            value: b.orders
        })));
        setTotalPlatformOrders(data.platformOrders?.totalOrders || 0);
        
      } catch (error: any) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: error.message,
        });
      } finally {
        setLoading(false);
      }
    }
    fetchAnalyticsData();
  }, [toast]);

  const platformChartConfig = {
    value: { label: "Orders" },
    Meesho: { label: "Meesho", color: "#FF4FA3" },
    Flipkart: { label: "Flipkart", color: "#FFC107" },
    Amazon: { label: "Amazon", color: "#C89F6D" },
  } as const;

  return (
    <div className="p-8 space-y-8 bg-gradient-to-br from-gray-100 to-blue-100 dark:from-gray-900 dark:to-slate-800 min-h-full">
        <div>
            <h1 className="text-3xl font-bold tracking-tight">Sales Report</h1>
            <p className="text-muted-foreground">Here's a summary of your sales performance.</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <KpiCard title="Total Sales" value={isMounted ? formatINR(totalSales) : '...'} icon={DollarSign} loading={loading} gradient="from-purple-400 to-indigo-500" />
            <KpiCard title="Total Orders" value={isMounted ? totalOrders.toLocaleString('en-IN') : '...'} icon={ShoppingCart} loading={loading} gradient="from-cyan-400 to-blue-500" />
            <KpiCard title="Total Returns" value={isMounted ? totalReturns.toLocaleString('en-IN') : '...'} icon={Undo2} loading={loading} gradient="from-amber-500 to-orange-500" />
            <KpiCard title="Net Profit" value={isMounted ? formatINR(netProfit) : '...'} icon={TrendingUp} loading={loading} gradient="from-emerald-500 to-green-500" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-3 bg-white/40 dark:bg-black/20 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-white/30 dark:border-white/10 text-black dark:text-white transition-all duration-500 hover:shadow-indigo-500/5 hover:-translate-y-1">
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h3 className="font-bold text-2xl tracking-tight">Daily Revenue Trend</h3>
                        <p className="text-sm opacity-60">Revenue growth over the past month</p>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
                        <TrendingUp className="h-3 w-3" />
                        Live tracking
                    </div>
                </div>
                <div className="h-[350px] w-full">
                    {loading ? <Skeleton className="h-full w-full bg-black/10 dark:bg-white/10 rounded-2xl" /> : (
                        <ResponsiveContainer width="100%" height={300}>
                            <AreaChart
                                data={salesTrend}
                                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                            >
                                <defs>
                                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={"rgba(0,0,0,0.05)"} />
                                <XAxis
                                    dataKey="label"
                                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))", fontWeight: 600 }}
                                    axisLine={false}
                                    tickLine={false}
                                    dy={10}
                                />
                                <YAxis
                                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))", fontWeight: 600 }}
                                    axisLine={false}
                                    tickLine={false}
                                    tickFormatter={(value) => `₹${value >= 1000 ? (value/1000).toFixed(0) + 'k' : value}`}
                                />
                                <Tooltip
                                    content={<SalesTooltip />}
                                    cursor={{ stroke: '#4f46e5', strokeWidth: 2, strokeDasharray: '5 5' }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="total_sales"
                                    stroke="#4f46e5"
                                    strokeWidth={4}
                                    fillOpacity={1}
                                    fill="url(#colorSales)"
                                    activeDot={{ r: 8, strokeWidth: 0, fill: '#4f46e5' }}
                                    animationDuration={2500}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>

            <div className="lg:col-span-2 bg-white/40 dark:bg-black/20 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-white/30 dark:border-white/10 text-black dark:text-white">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="font-bold text-xl">Platform Distribution</h3>
                    <a href="#" className="text-xs font-bold opacity-70 flex items-center gap-1 hover:opacity-100 transition-opacity">Full View <ArrowUpRight className="h-3 w-3" /></a>
                </div>
                {loading ? <Skeleton className="h-[350px] w-full bg-black/10 dark:bg-white/10 mt-4 rounded-2xl" /> : (
                    <div className="flex flex-col items-center gap-4 mt-4">
                        <div className="w-full h-[250px] relative">
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                                <p className="text-4xl font-black">{totalPlatformOrders}</p>
                                <p className="text-[10px] font-bold uppercase tracking-widest opacity-50">Total Orders</p>
                            </div>
                            <ChartContainer config={platformChartConfig} className="h-full w-full">
                                <ResponsiveContainer>
                                    <PieChart>
                                        <Tooltip content={<ChartTooltipContent nameKey="name" formatter={(value) => `${value} orders`} />} />
                                        <Pie 
                                            data={platformBreakdown} 
                                            dataKey="value" 
                                            nameKey="name" 
                                            cx="50%" 
                                            cy="50%" 
                                            innerRadius={90} 
                                            outerRadius={115} 
                                            strokeWidth={2}
                                            paddingAngle={5}
                                        >
                                            {platformBreakdown.map((entry) => (
                                                <Cell key={`cell-${entry.name}`} fill={platformChartConfig[entry.name as keyof typeof platformChartConfig]?.color} />
                                            ))}
                                        </Pie>
                                    </PieChart>
                                </ResponsiveContainer>
                            </ChartContainer>
                        </div>
                        <div className="w-full">
                            <ul className="flex flex-wrap justify-center items-center gap-x-6 gap-y-2">
                                {platformBreakdown.map((platform) => (
                                    <li key={platform.name} className="flex items-center justify-start text-sm">
                                      <div className="flex items-center gap-2">
                                          <span style={{ backgroundColor: platformChartConfig[platform.name as keyof typeof platformChartConfig]?.color }} className="h-2.5 w-2.5 rounded-full" />
                                          <span className="text-xs font-medium">{platform.name} — <span className="font-bold">{platform.value}</span></span>
                                      </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                )}
            </div>
        </div>
    </div>
  );
}
