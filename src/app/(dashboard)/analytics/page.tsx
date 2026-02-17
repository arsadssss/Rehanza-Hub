
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
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from 'recharts';
import {
  ChartContainer,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { DollarSign, ShoppingCart, Undo2, TrendingUp, Percent } from 'lucide-react';

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

  const { kpiStats, lineChartData, platformRevenueData } = useMemo(() => {
    const totalRevenue = analyticsData.reduce((acc, item) => acc + item.total_revenue, 0);
    const totalOrders = analyticsData.reduce((acc, item) => acc + item.total_orders, 0);
    const totalReturns = returnsData.reduce((acc, item) => acc + item.total_returns, 0);
    const totalLoss = returnsData.reduce((acc, item) => acc + item.total_loss, 0);
    const netProfit = totalRevenue - totalLoss;
    const returnRate = totalOrders > 0 ? (totalReturns / totalOrders) * 100 : 0;

    const endDate = new Date();
    const startDate = subDays(endDate, 6);
    const dateInterval = eachDayOfInterval({ start: startDate, end: endDate });

    const dailyRevenueMap = analyticsData.reduce((acc, item) => {
      const date = format(parseISO(item.order_date), 'yyyy-MM-dd');
      acc[date] = (acc[date] || 0) + item.total_revenue;
      return acc;
    }, {} as Record<string, number>);

    const lineChartData = dateInterval.map(day => {
      const formattedDate = format(day, 'yyyy-MM-dd');
      return {
        date: formattedDate,
        revenue: dailyRevenueMap[formattedDate] || 0,
      };
    });

    const platformRevenueMap = analyticsData.reduce((acc, item) => {
      acc[item.platform] = (acc[item.platform] || 0) + item.total_revenue;
      return acc;
    }, {} as Record<string, number>);

    const platformRevenueData = [
      { platform: 'Meesho', revenue: platformRevenueMap['Meesho'] || 0, fill: "var(--color-Meesho)" },
      { platform: 'Flipkart', revenue: platformRevenueMap['Flipkart'] || 0, fill: "var(--color-Flipkart)" },
      { platform: 'Amazon', revenue: platformRevenueMap['Amazon'] || 0, fill: "var(--color-Amazon)" },
    ];
    
    return { 
      kpiStats: { totalRevenue, totalOrders, totalReturns, netProfit, returnRate },
      lineChartData,
      platformRevenueData
    };
  }, [analyticsData, returnsData]);

  const StatCard = ({ title, value, icon: Icon }: { title: string, value: string | React.ReactNode, icon: React.ElementType }) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? <Skeleton className="h-8 w-3/4" /> : (
            <div className="text-2xl font-bold">{value}</div>
        )}
      </CardContent>
    </Card>
  );

  const revenueChartConfig = {
    revenue: {
      label: "Revenue",
      color: "hsl(var(--primary))",
    },
  };

  const platformChartConfig = {
    revenue: {
      label: "Revenue",
    },
    Meesho: {
      label: "Meesho",
      color: "hsl(var(--chart-1))",
    },
    Flipkart: {
      label: "Flipkart",
      color: "hsl(var(--chart-2))",
    },
    Amazon: {
      label: "Amazon",
      color: "hsl(var(--chart-3))",
    },
  };

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Analytics</CardTitle>
          <CardDescription>
            Deep dive into your business performance for the last 7 days.
          </CardDescription>
        </CardHeader>
      </Card>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
        <StatCard title="Total Revenue" value={isMounted ? `₹${new Intl.NumberFormat('en-IN').format(kpiStats.totalRevenue)}` : '...'} icon={DollarSign} />
        <StatCard title="Total Orders" value={kpiStats.totalOrders.toLocaleString('en-IN')} icon={ShoppingCart} />
        <StatCard title="Total Returns" value={kpiStats.totalReturns.toLocaleString('en-IN')} icon={Undo2} />
        <StatCard title="Net Profit" value={isMounted ? `₹${new Intl.NumberFormat('en-IN').format(kpiStats.netProfit)}` : '...'} icon={TrendingUp} />
        <StatCard title="Return Rate" value={isMounted ? `${kpiStats.returnRate.toFixed(2)}%` : '...'} icon={Percent} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
                <CardTitle className="font-headline">Revenue Trend</CardTitle>
                <CardDescription>Revenue over the last 7 days.</CardDescription>
            </CardHeader>
            <CardContent>
                {loading ? <Skeleton className="h-[350px] w-full" /> : (
                    <div className="h-[350px]">
                      <ChartContainer config={revenueChartConfig} className="h-full w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={lineChartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="date" tickFormatter={(value) => format(parseISO(value), 'dd MMM')} />
                                <YAxis tickFormatter={(value) => `₹${Math.round(value / 1000)}k`} />
                                <Tooltip content={<ChartTooltipContent indicator="dot" formatter={(value) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value as number)} />} />
                                <Line type="monotone" dataKey="revenue" stroke="var(--color-revenue)" strokeWidth={2} dot={{ r: 4, fill: "var(--color-revenue)" }} />
                            </LineChart>
                        </ResponsiveContainer>
                      </ChartContainer>
                    </div>
                )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
                <CardTitle className="font-headline">Platform Revenue</CardTitle>
                <CardDescription>Revenue breakdown by sales channel.</CardDescription>
            </CardHeader>
            <CardContent>
                 {loading ? <Skeleton className="h-[350px] w-full" /> : (
                    <div className="h-[350px]">
                      <ChartContainer config={platformChartConfig} className="h-full w-full">
                        <ResponsiveContainer width="100%" height="100%">
                             <BarChart data={platformRevenueData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="platform" />
                                <YAxis tickFormatter={(value) => `₹${Math.round(value / 1000)}k`} />
                                <Tooltip content={<ChartTooltipContent indicator="dot" formatter={(value) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value as number)} />} />
                                <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                                    {platformRevenueData.map((entry) => (
                                        <Cell key={`cell-${entry.platform}`} fill={entry.fill} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                      </ChartContainer>
                    </div>
                )}
            </CardContent>
          </Card>
      </div>
    </div>
  );
}
