
"use client"

import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { subDays, format, eachDayOfInterval, parseISO } from 'date-fns';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
  Legend,
} from 'recharts';
import {
  ChartContainer,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { DollarSign, ShoppingCart, Undo2, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

type AnalyticsSummary = {
  order_date: string;
  platform: 'Meesho' | 'Flipkart' | 'Amazon';
  total_revenue: number;
  total_orders: number;
};

type ReturnsSummary = {
  return_date: string;
  total_returns: number;
  total_loss: number;
};

const KpiCard = ({ title, value, icon: Icon, primary = false, loading }: { title: string, value: string, icon: React.ElementType, primary?: boolean, loading: boolean }) => {
    return (
        <Card className={cn(
            "rounded-2xl border-0 shadow-lg",
            primary ? 'bg-primary text-primary-foreground' : 'bg-card text-card-foreground'
        )}>
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">{title}</CardTitle>
                    <div className={cn("rounded-lg p-2", primary ? 'bg-white/10' : 'bg-muted')}>
                        <Icon className={cn("h-5 w-5", primary ? 'text-primary-foreground' : 'text-primary')} />
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {loading ? <Skeleton className={cn("h-8 w-3/4", primary ? "bg-white/30" : "")} /> : (
                    <div className="text-3xl font-bold">{value}</div>
                )}
            </CardContent>
        </Card>
    );
};


export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsSummary[]>([]);
  const [returnsData, setReturnsData] = useState<ReturnsSummary[]>([]);
  const [isMounted, setIsMounted] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setIsMounted(true);
    async function fetchData() {
      setLoading(true);
      const endDate = new Date();
      const startDate = subDays(endDate, 6); // Last 7 days including today

      const { data: analytics, error: analyticsError } = await supabase
        .from('analytics_summary')
        .select('*')
        .gte('order_date', format(startDate, 'yyyy-MM-dd'))
        .lte('order_date', format(endDate, 'yyyy-MM-dd'));

      if (analyticsError) {
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch analytics summary.' });
      } else {
        setAnalyticsData(analytics || []);
      }

      const { data: returns, error: returnsError } = await supabase
        .from('returns_summary')
        .select('*')
        .gte('return_date', format(startDate, 'yyyy-MM-dd'))
        .lte('return_date', format(endDate, 'yyyy-MM-dd'));
      
      if (returnsError) {
         toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch returns summary.' });
      } else {
         setReturnsData(returns || []);
      }

      setLoading(false);
    }
    fetchData();
  }, [toast]);

  const { kpiStats, barChartData, pieChartData } = useMemo(() => {
    const totalRevenue = analyticsData.reduce((acc, item) => acc + item.total_revenue, 0);
    const totalOrders = analyticsData.reduce((acc, item) => acc + item.total_orders, 0);
    const totalReturns = returnsData.reduce((acc, item) => acc + item.total_returns, 0);
    const totalLoss = returnsData.reduce((acc, item) => acc + item.total_loss, 0);
    const netProfit = totalRevenue - totalLoss;

    const endDate = new Date();
    const startDate = subDays(endDate, 6);
    const dateInterval = eachDayOfInterval({ start: startDate, end: endDate });

    const dailyRevenueMap = analyticsData.reduce((acc, item) => {
      const date = format(parseISO(item.order_date), 'yyyy-MM-dd');
      acc[date] = (acc[date] || 0) + item.total_revenue;
      return acc;
    }, {} as Record<string, number>);

    const barChartData = dateInterval.map(day => ({
        date: format(day, 'MMM dd'),
        revenue: dailyRevenueMap[format(day, 'yyyy-MM-dd')] || 0,
    }));

    const platformRevenueMap = analyticsData.reduce((acc, item) => {
      acc[item.platform] = (acc[item.platform] || 0) + item.total_revenue;
      return acc;
    }, {} as Record<string, number>);

    const pieChartData = [
      { name: 'Meesho', value: platformRevenueMap['Meesho'] || 0, fill: "var(--color-Meesho)" },
      { name: 'Flipkart', value: platformRevenueMap['Flipkart'] || 0, fill: "var(--color-Flipkart)" },
      { name: 'Amazon', value: platformRevenueMap['Amazon'] || 0, fill: "var(--color-Amazon)" },
    ];
    
    return { 
      kpiStats: { totalRevenue, totalOrders, totalReturns, netProfit },
      barChartData,
      pieChartData
    };
  }, [analyticsData, returnsData]);

  const revenueChartConfig = {
    revenue: {
      label: "Revenue",
      color: "hsl(var(--primary))",
    },
  };

  const platformChartConfig = {
    value: { label: "Revenue" },
    Meesho: { label: "Meesho", color: "hsl(var(--chart-1))" },
    Flipkart: { label: "Flipkart", color: "hsl(var(--chart-2))" },
    Amazon: { label: "Amazon", color: "hsl(var(--chart-3))" },
  };

  return (
    <div className="p-8 space-y-8 bg-background">
        <div>
            <h1 className="text-3xl font-bold tracking-tight">Sales Report</h1>
            <p className="text-muted-foreground">Here's a summary of your sales for the last 7 days.</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <KpiCard title="Total Sales" value={isMounted ? `₹${new Intl.NumberFormat('en-IN').format(kpiStats.totalRevenue)}` : '...'} icon={DollarSign} primary loading={loading} />
            <KpiCard title="Total Orders" value={kpiStats.totalOrders.toLocaleString('en-IN')} icon={ShoppingCart} loading={loading} />
            <KpiCard title="Total Returns" value={kpiStats.totalReturns.toLocaleString('en-IN')} icon={Undo2} loading={loading} />
            <KpiCard title="Net Profit" value={isMounted ? `₹${new Intl.NumberFormat('en-IN').format(kpiStats.netProfit)}` : '...'} icon={TrendingUp} loading={loading} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <Card className="lg:col-span-3 rounded-2xl shadow-lg border-0">
                <CardHeader>
                    <CardTitle>Customer Habits</CardTitle>
                    <CardDescription>Track your customer habits</CardDescription>
                </CardHeader>
                <CardContent className="h-[350px] w-full pl-0">
                    {loading ? <Skeleton className="h-full w-full" /> : (
                        <ChartContainer config={revenueChartConfig} className="h-full w-full">
                            <ResponsiveContainer>
                                <BarChart data={barChartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
                                    <YAxis tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(value) => `₹${value / 1000}k`} />
                                    <Tooltip cursor={{ fill: 'hsl(var(--primary) / 0.1)' }} content={<ChartTooltipContent indicator="dot" formatter={(value) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value as number)} />} />
                                    <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </ChartContainer>
                    )}
                </CardContent>
            </Card>

            <Card className="lg:col-span-2 rounded-2xl shadow-lg border-0">
                <CardHeader>
                    <CardTitle>Product Statistic</CardTitle>
                    <CardDescription>Track your product sales</CardDescription>
                </CardHeader>
                <CardContent className="h-[350px] w-full flex flex-col items-center">
                      {loading ? <Skeleton className="h-full w-full" /> : (
                        <ChartContainer config={platformChartConfig} className="h-full w-full">
                            <ResponsiveContainer>
                                <PieChart>
                                    <Tooltip content={<ChartTooltipContent hideLabel nameKey="value" formatter={(value, name) => [new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value as number), (name as string)]} />} />
                                    <Pie data={pieChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={90} strokeWidth={3} paddingAngle={5}>
                                        {pieChartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.fill} />
                                        ))}
                                    </Pie>
                                    <Legend verticalAlign="bottom" iconType="circle" content={({ payload }) => (
                                        <ul className="flex flex-col gap-2 pt-4">
                                            {payload?.map((entry, index) => {
                                                const { value, color } = entry;
                                                const platformData = pieChartData.find(d => d.name === value);
                                                return (
                                                    <li key={`item-${index}`} className="flex items-center justify-between text-sm">
                                                        <div className="flex items-center gap-2">
                                                            <span style={{ backgroundColor: color }} className="h-2 w-2 rounded-full" />
                                                            <span>{value}</span>
                                                        </div>
                                                        <span className="font-medium">
                                                            {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(platformData?.value || 0)}
                                                        </span>
                                                    </li>
                                                )
                                            })}
                                        </ul>
                                    )} />
                                </PieChart>
                            </ResponsiveContainer>
                        </ChartContainer>
                      )}
                </CardContent>
            </Card>
        </div>
    </div>
  );
}
