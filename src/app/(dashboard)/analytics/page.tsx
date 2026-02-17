
"use client"

import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { subDays, format, parseISO, addDays } from 'date-fns';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
import { Button } from '@/components/ui/button';
import { DollarSign, ShoppingCart, Undo2, TrendingUp, ArrowUpRight } from 'lucide-react';
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

type SalesAnalyticsData = {
  label: string;
  total_sales: number;
  total_orders: number;
}

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
                    {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(data.total_sales)}
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
  const [summaryData, setSummaryData] = useState<AnalyticsSummary[]>([]);
  const [returnsData, setReturnsData] = useState<ReturnsSummary[]>([]);
  const [platformOrders, setPlatformOrders] = useState<{ name: string; value: number }[]>([]);
  const [totalPlatformOrders, setTotalPlatformOrders] = useState(0);
  const [isMounted, setIsMounted] = useState(false);
  const { toast } = useToast();
  const [netProfit, setNetProfit] = useState(0);
  const [totalSales, setTotalSales] = useState(0);

  const [salesData, setSalesData] = useState<SalesAnalyticsData[]>([]);
  const [loadingSales, setLoadingSales] = useState(true);

  useEffect(() => {
    setIsMounted(true);
    async function fetchSummaryData() {
      setLoading(true);
      const endDate = new Date();
      const startDate = subDays(endDate, 6);

      const { data: analytics, error: analyticsError } = await supabase
        .from('analytics_summary')
        .select('*')
        .gte('order_date', format(startDate, 'yyyy-MM-dd'))
        .lte('order_date', format(endDate, 'yyyy-MM-dd'));

      if (analyticsError) {
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch analytics summary.' });
      } else {
        setSummaryData(analytics || []);
      }
      
      const { data: ordersForSales, error: ordersForSalesError } = await supabase
        .from('orders')
        .select('total_amount')
        .gte('created_at', format(subDays(new Date(), 7), 'yyyy-MM-dd'));

      if (ordersForSalesError) {
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch total sales.' });
      } else {
        const total = (ordersForSales || []).reduce((acc, order) => acc + order.total_amount, 0);
        setTotalSales(total);
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
        
      const { data: allOrders, error: ordersError } = await supabase
        .from("orders")
        .select("platform");

      if (ordersError) {
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch platform orders.' });
      } else if (allOrders) {
        const meesho = allOrders.filter(o => o.platform === "Meesho").length;
        const flipkart = allOrders.filter(o => o.platform === "Flipkart").length;
        const amazon = allOrders.filter(o => o.platform === "Amazon").length;

        const pieData = [
          { name: 'Meesho', value: meesho },
          { name: 'Flipkart', value: flipkart },
          { name: 'Amazon', value: amazon },
        ].filter(p => p.value > 0);
        
        setPlatformOrders(pieData);
        setTotalPlatformOrders(meesho + flipkart + amazon);
      }
      
      // Calculate Net Profit
      try {
        // Calculate Gross Margin from all orders
        const { data: ordersWithMargin, error: ordersMarginError } = await supabase
            .from('orders')
            .select(`
                quantity,
                product_variants (
                    allproducts (
                        margin
                    )
                )
            `);

        if (ordersMarginError) throw ordersMarginError;

        const grossMargin = (ordersWithMargin || []).reduce((acc, order) => {
            const margin = order.product_variants?.allproducts?.margin || 0;
            return acc + (order.quantity * margin);
        }, 0);

        // Calculate Return Impact from all returns
        const { data: returnsWithMargin, error: returnsMarginError } = await supabase
            .from('returns')
            .select(`
                quantity,
                restockable,
                product_variants (
                    allproducts (
                        margin
                    )
                )
            `);

        if (returnsMarginError) throw returnsMarginError;

        const returnImpact = (returnsWithMargin || []).reduce((acc, ret) => {
            if (ret.restockable) {
                // If restockable, the loss is a fixed cost (e.g., shipping/handling)
                return acc + (ret.quantity * 45);
            } else {
                // If not restockable, the loss is the entire margin of the product
                const margin = ret.product_variants?.allproducts?.margin || 0;
                return acc + (ret.quantity * margin);
            }
        }, 0);

        setNetProfit(grossMargin - returnImpact);

      } catch (error: any) {
        toast({
            variant: 'destructive',
            title: 'Error calculating Net Profit',
            description: error.message,
        });
        setNetProfit(0);
      }


      setLoading(false);
    }
    fetchSummaryData();
  }, [toast]);

  useEffect(() => {
    async function fetchSalesData() {
        setLoadingSales(true);
        const { data, error } = await supabase.from('analytics_last_7_days').select('*');

        if (error) {
            console.error("Error fetching sales data:", error);
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch sales data.' });
            setSalesData([]);
        } else if (data) {
            const today = new Date();
            const last7Days = Array.from({ length: 7 }, (_, i) => {
                const d = subDays(today, i);
                return format(d, 'yyyy-MM-dd');
            }).reverse();

            const processedData = last7Days.map(dateStr => {
                const dayData = data.find(d => d.label === dateStr);
                return {
                    label: format(parseISO(dateStr), 'dd MMM'),
                    total_sales: dayData ? Number(dayData.total_sales) : 0,
                    total_orders: dayData ? Number(dayData.total_orders) : 0,
                };
            });
            
            setSalesData(processedData);
        }
        
        setLoadingSales(false);
    }
    fetchSalesData();
  }, [toast]);


  const kpiStats = useMemo(() => {
    const totalOrders = summaryData.reduce((acc, item) => acc + item.total_orders, 0);
    const totalReturns = returnsData.reduce((acc, item) => acc + item.total_returns, 0);
    
    return { 
      totalOrders, totalReturns
    };
  }, [summaryData, returnsData]);

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
            <KpiCard title="Total Sales" value={isMounted ? `₹${new Intl.NumberFormat('en-IN').format(totalSales)}` : '...'} icon={DollarSign} loading={loading} gradient="from-purple-400 to-indigo-500" />
            <KpiCard title="Total Orders" value={kpiStats.totalOrders.toLocaleString('en-IN')} icon={ShoppingCart} loading={loading} gradient="from-cyan-400 to-blue-500" />
            <KpiCard title="Total Returns" value={kpiStats.totalReturns.toLocaleString('en-IN')} icon={Undo2} loading={loading} gradient="from-amber-500 to-orange-500" />
            <KpiCard title="Net Profit" value={isMounted ? `₹${new Intl.NumberFormat('en-IN').format(netProfit)}` : '...'} icon={TrendingUp} loading={loading} gradient="from-emerald-500 to-green-500" />
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
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                <XAxis
                                    dataKey="label"
                                    tick={{ fontSize: 12, fill: 'hsl(var(--foreground))' }}
                                    stroke="hsl(var(--muted-foreground))"
                                />
                                <YAxis
                                    tick={{ fontSize: 12, fill: 'hsl(var(--foreground))' }}
                                    stroke="hsl(var(--muted-foreground))'
                                    tickFormatter={(value) => `₹${value}`}
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

    