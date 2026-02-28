
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
import { DollarSign, ShoppingCart, Undo2, TrendingUp, TrendingDown, ArrowUpRight, ChevronRight, Sparkles } from 'lucide-react';
import { formatINR } from '@/lib/format';
import { apiFetch } from '@/lib/apiFetch';
import { cn } from '@/lib/utils';

const KpiCard = ({ 
    title, 
    value, 
    icon: Icon, 
    loading, 
    gradient, 
    description,
    isTrendUp 
}: { 
    title: string, 
    value: string, 
    icon: React.ElementType, 
    loading: boolean, 
    gradient: string,
    description?: string,
    isTrendUp?: boolean
}) => {
    return (
        <div className="group relative overflow-hidden bg-white/60 dark:bg-slate-900/40 backdrop-blur-2xl rounded-[2rem] p-6 shadow-[0_10px_40px_rgba(0,0,0,0.04)] border border-white/50 dark:border-white/5 hover:-translate-y-1 transition-all duration-300">
            <div className="flex justify-between items-start relative z-10">
                <div className="flex-1">
                    <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/80 mb-1">{title}</p>
                    {loading ? (
                        <div className="pt-2 space-y-2">
                            <Skeleton className="h-8 w-32 bg-muted/40 rounded-lg" />
                            <Skeleton className="h-3 w-20 bg-muted/30 rounded-md" />
                        </div>
                    ) : (
                        <div className="pt-1">
                            <h2 className="text-3xl font-black font-headline tracking-tighter text-foreground">
                                {value}
                            </h2>
                            {description && (
                                <div className="flex items-center gap-1.5 mt-2">
                                    <div className={cn(
                                        "flex items-center justify-center w-4 h-4 rounded-full",
                                        isTrendUp ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600"
                                    )}>
                                        {isTrendUp ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                                    </div>
                                    <span className="text-[10px] font-bold text-muted-foreground/70">{description}</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
                <div className={cn(
                    "w-12 h-12 flex items-center justify-center rounded-2xl bg-gradient-to-br shadow-lg transition-all duration-500 group-hover:scale-110 group-hover:rotate-6", 
                    gradient
                )}>
                    <Icon className="h-5 w-5 text-white" strokeWidth={2.5} />
                </div>
            </div>
            
            {/* Background decorative elements */}
            <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-24 h-24 bg-white/5 rounded-full blur-2xl group-hover:bg-white/10 transition-colors duration-500" />
            <div className={cn(
                "absolute -bottom-10 -left-10 w-20 h-20 blur-3xl opacity-10 rounded-full transition-opacity duration-500",
                gradient.includes('violet') ? 'bg-indigo-500' : 
                gradient.includes('blue') ? 'bg-cyan-500' :
                gradient.includes('orange') ? 'bg-rose-500' : 'bg-emerald-500'
            )} />
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
    <div className="p-8 space-y-10 bg-gray-50/50 dark:bg-black/50 min-h-full">
        <div>
            <h1 className="text-4xl font-black tracking-tighter font-headline">Sales Intelligence</h1>
            <p className="text-muted-foreground font-medium mt-1">Advanced operational report and performance summary.</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <KpiCard 
                title="Total Sales" 
                value={isMounted ? formatINR(totalSales) : '...'} 
                icon={Sparkles} 
                loading={loading} 
                gradient="from-violet-500 to-indigo-600" 
                description="Cumulative revenue"
                isTrendUp={true}
            />
            <KpiCard 
                title="Total Orders" 
                value={isMounted ? totalOrders.toLocaleString('en-IN') : '...'} 
                icon={ShoppingCart} 
                loading={loading} 
                gradient="from-blue-400 to-cyan-500" 
                description="Orders processed"
                isTrendUp={true}
            />
            <KpiCard 
                title="Total Returns" 
                value={isMounted ? totalReturns.toLocaleString('en-IN') : '...'} 
                icon={Undo2} 
                loading={loading} 
                gradient="from-orange-400 to-rose-500" 
                description="Inbound units"
                isTrendUp={false}
            />
            <KpiCard 
                title="Net Profit" 
                value={isMounted ? formatINR(netProfit) : '...'} 
                icon={netProfit >= 0 ? TrendingUp : TrendingDown} 
                loading={loading} 
                gradient={netProfit >= 0 ? "from-emerald-400 to-teal-600" : "from-rose-400 to-red-600"} 
                description={netProfit >= 0 ? "Profit margin reached" : "Loss margin detected"}
                isTrendUp={netProfit >= 0}
            />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
            <div className="lg:col-span-3 bg-white/40 dark:bg-black/20 backdrop-blur-xl rounded-[2.5rem] p-8 shadow-[0_20px_50px_rgba(0,0,0,0.05)] border border-white/30 dark:border-white/10 text-black dark:text-white transition-all duration-500 hover:shadow-indigo-500/5">
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h3 className="font-black text-2xl tracking-tight font-headline">Daily Revenue Trend</h3>
                        <p className="text-sm opacity-60 font-medium">Revenue and volume performance over time</p>
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-black uppercase tracking-wider">
                        <TrendingUp className="h-3 w-3" />
                        Live Tracking
                    </div>
                </div>
                <div className="h-[350px] w-full">
                    {loading ? <Skeleton className="h-full w-full bg-black/5 dark:bg-white/5 rounded-3xl" /> : (
                        <ResponsiveContainer width="100%" height={300}>
                            <AreaChart
                                data={salesTrend}
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

            <div className="lg:col-span-2 bg-white/40 dark:bg-black/20 backdrop-blur-xl rounded-[2.5rem] p-8 shadow-[0_20px_50px_rgba(0,0,0,0.05)] border border-white/30 dark:border-white/10 text-black dark:text-white">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="font-black text-xl font-headline">Platform Distribution</h3>
                    <a href="#" className="text-xs font-black uppercase tracking-wider opacity-70 flex items-center gap-1 hover:opacity-100 transition-opacity">Full View <ArrowUpRight className="h-3 w-3" /></a>
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
                            <ul className="flex flex-wrap justify-center items-center gap-x-6 gap-y-3">
                                {platformBreakdown.map((platform) => (
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
    </div>
  );
}
