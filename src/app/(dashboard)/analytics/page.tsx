"use client"

import React, { useEffect, useState, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
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
  LineChart,
  Line,
} from 'recharts';
import {
  ChartContainer,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { DollarSign, ShoppingCart, Undo2, TrendingUp, ArrowUpRight } from 'lucide-react';
import { formatINR } from '@/lib/format';
import { apiFetch } from '@/lib/apiFetch';

const KpiCard = ({ title, value, icon: Icon, loading, gradient }: { title: string, value: string, icon: React.ElementType, loading: boolean, gradient: string }) => {
    return (
        <div className={`bg-white/40 dark:bg-black/20 backdrop-blur-lg rounded-3xl p-6 shadow-xl border border-white/30 dark:border-white/10`}>
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
            <div className="rounded-lg bg-primary text-primary-foreground p-3 shadow-lg">
                <p className="text-sm font-medium mb-1">Date: {label}</p>
                <p className="text-xs">
                    <span className="font-semibold">Total Sales:</span>{' '}
                    {formatINR(data.total_sales)}
                </p>
                <p className="text-xs">
                    <span className="font-semibold">Orders:</span> {data.total_orders}
                </p>
            </div>
        );
    }
    return null;
};

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [returnsData, setReturnsData] = useState<any[]>([]);
  const [platformOrders, setPlatformOrders] = useState<{ name: string; value: number }[]>([]);
  const [totalPlatformOrders, setTotalPlatformOrders] = useState(0);
  const [isMounted, setIsMounted] = useState(false);
  const { toast } = useToast();
  const [netProfit, setNetProfit] = useState(0);
  const [totalSales, setTotalSales] = useState(0);

  const [salesData, setSalesData] = useState<any[]>([]);
  const [loadingSales, setLoadingSales] = useState(true);

  useEffect(() => {
    setIsMounted(true);
    async function fetchAnalyticsData() {
      setLoading(true);
      setLoadingSales(true);
      try {
        const res = await apiFetch('/api/analytics');
        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.message || 'Failed to fetch analytics data');
        }
        const data = await res.json();
        
        setTotalSales(data.totalSales);
        setReturnsData(data.returnsData || []);
        setPlatformOrders(data.platformOrders || []);
        setTotalPlatformOrders(data.totalPlatformOrders || 0);
        setNetProfit(data.netProfit || 0);
        
        const processedSalesData = (data.salesData || []).map((d: any) => ({
            label: format(parseISO(d.label), 'dd MMM'),
            total_sales: Number(d.total_sales) || 0,
            total_orders: Number(d.total_orders) || 0,
        }));
        setSalesData(processedSalesData);
        
      } catch (error: any) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: error.message,
        });
      } finally {
        setLoading(false);
        setLoadingSales(false);
      }
    }
    fetchAnalyticsData();
  }, [toast]);

  const kpiStats = useMemo(() => {
    const totalOrders = salesData.reduce((acc, item) => acc + item.total_orders, 0);
    const totalReturns = returnsData.reduce((acc, item) => acc + item.total_returns, 0);
    return { totalOrders, totalReturns };
  }, [salesData, returnsData]);

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
            <KpiCard title="Total Orders" value={kpiStats.totalOrders.toLocaleString('en-IN')} icon={ShoppingCart} loading={loading} gradient="from-cyan-400 to-blue-500" />
            <KpiCard title="Total Returns" value={kpiStats.totalReturns.toLocaleString('en-IN')} icon={Undo2} loading={loading} gradient="from-amber-500 to-orange-500" />
            <KpiCard title="Net Profit" value={isMounted ? formatINR(netProfit) : '...'} icon={TrendingUp} loading={loading} gradient="from-emerald-500 to-green-500" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-3 bg-white/40 dark:bg-black/20 backdrop-blur-lg rounded-3xl p-6 shadow-xl border border-white/30 dark:border-white/10 text-black dark:text-white">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-xl">Sales</h3>
                </div>
                <div className="h-[350px] w-full">
                    {loadingSales ? <Skeleton className="h-full w-full bg-black/10 dark:bg-white/10" /> : (
                        <ResponsiveContainer width="100%" height={300}>
                            <LineChart
                                data={salesData}
                                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" stroke={"hsl(var(--border))"} />
                                <XAxis
                                    dataKey="label"
                                    tick={{ fontSize: 12, fill: "hsl(var(--foreground))" }}
                                    stroke={"hsl(var(--muted-foreground))"}
                                />
                                <YAxis
                                    tick={{ fontSize: 12, fill: "hsl(var(--foreground))" }}
                                    stroke={"hsl(var(--muted-foreground))"}
                                    tickFormatter={(value) => formatINR(value as number)}
                                />
                                <Tooltip
                                    content={<SalesTooltip />}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="total_sales"
                                    stroke="#4f46e5"
                                    strokeWidth={3}
                                    dot={{ r: 4 }}
                                    activeDot={{ r: 6 }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>

            <div className="lg:col-span-2 bg-white/40 dark:bg-black/20 backdrop-blur-lg rounded-3xl p-6 shadow-xl border border-white/30 dark:border-white/10 text-black dark:text-white">
                <div className="flex justify-between items-center">
                    <h3 className="font-bold text-xl">Platform Orders</h3>
                    <a href="#" className="text-sm opacity-70 flex items-center gap-1">See All <ArrowUpRight className="h-4 w-4" /></a>
                </div>
                {loading ? <Skeleton className="h-[350px] w-full bg-black/10 dark:bg-white/10 mt-4" /> : (
                    <div className="flex flex-col items-center gap-4 mt-4">
                        <div className="w-full h-[250px] relative">
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                                <p className="text-3xl font-bold">{totalPlatformOrders}</p>
                                <p className="text-xs opacity-70">Total Orders</p>
                            </div>
                            <ChartContainer config={platformChartConfig} className="h-full w-full">
                                <ResponsiveContainer>
                                    <PieChart>
                                        <Tooltip content={<ChartTooltipContent nameKey="name" formatter={(value) => `${value} orders`} />} />
                                        <Pie 
                                            data={platformOrders} 
                                            dataKey="value" 
                                            nameKey="name" 
                                            cx="50%" 
                                            cy="50%" 
                                            innerRadius={90} 
                                            outerRadius={115} 
                                            strokeWidth={2}
                                            paddingAngle={5}
                                        >
                                            {platformOrders.map((entry) => (
                                                <Cell key={`cell-${entry.name}`} fill={platformChartConfig[entry.name as keyof typeof platformChartConfig]?.color} />
                                            ))}
                                        </Pie>
                                    </PieChart>
                                </ResponsiveContainer>
                            </ChartContainer>
                        </div>
                        <div className="w-full">
                            <ul className="flex flex-wrap justify-center items-center gap-x-6 gap-y-2">
                                {platformOrders.map((platform) => (
                                    <li key={platform.name} className="flex items-center justify-start text-sm">
                                      <div className="flex items-center gap-2">
                                          <span style={{ backgroundColor: platformChartConfig[platform.name as keyof typeof platformChartConfig]?.color }} className="h-2.5 w-2.5 rounded-full" />
                                          <span>{platform.name} — <span className="font-medium">{platform.value} orders</span></span>
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
