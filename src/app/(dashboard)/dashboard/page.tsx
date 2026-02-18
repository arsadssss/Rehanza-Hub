
"use client";

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/format';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from '@/components/ui/card';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Sector,
} from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Package,
  CircleDollarSign,
  TrendingUp,
  Undo2,
  Store,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Types from Supabase views (assuming structure)
type DashboardSummary = {
  total_units: number;
  gross_revenue: number;
  net_profit: number;
  return_rate: number;
};

type PlatformPerformance = {
  platform: 'Meesho' | 'Flipkart' | 'Amazon';
  total_units: number;
  total_revenue: number;
};

type RevenueTrend = {
  order_date: string;
  total_revenue: number;
  total_units: number;
};

type BestSellingSku = {
  variant_sku: string;
  total_sold: number;
};

type LowStockItems = {
  low_stock_count: number;
};

type RecentOrder = {
  id: string;
  created_at: string;
  platform: 'Meesho' | 'Flipkart' | 'Amazon';
  quantity: number;
  total_amount: number;
  product_variants: {
    variant_sku: string;
  } | null;
};

// Main Page Component
export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [platformPerformance, setPlatformPerformance] = useState<PlatformPerformance[]>([]);
  const [revenueTrend, setRevenueTrend] = useState<RevenueTrend[]>([]);
  const [bestSeller, setBestSeller] = useState<BestSellingSku | null>(null);
  const [lowStock, setLowStock] = useState<LowStockItems | null>(null);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);

      const [
        summaryRes,
        platformRes,
        revenueRes,
        bestSellerRes,
        lowStockRes,
        recentOrdersRes,
      ] = await Promise.all([
        supabase.from('dashboard_summary').select('*').single(),
        supabase.from('platform_performance').select('*'),
        supabase.from('revenue_trend_30d').select('*'),
        supabase.from('best_selling_sku').select('*').single(),
        supabase.from('low_stock_items').select('*').single(),
        supabase.from('orders').select(`
            id,
            created_at,
            platform,
            quantity,
            total_amount,
            product_variants (
              variant_sku
            )
        `).order('created_at', { ascending: false }).limit(5),
      ]);

      setSummary(summaryRes.data);
      setPlatformPerformance(platformRes.data || []);
      
      const formattedRevenue = (revenueRes.data || []).map(d => ({
        ...d,
        order_date: new Date(d.order_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
      }));
      setRevenueTrend(formattedRevenue);

      setBestSeller(bestSellerRes.data);
      setLowStock(lowStockRes.data);
      setRecentOrders(recentOrdersRes.data as RecentOrder[] || []);

      setLoading(false);
    }

    fetchData();
  }, []);

  // --- SUB-COMPONENTS ---

  const KpiCard = ({ title, value, icon: Icon, gradient, children, loading }: { title: string; value: string; icon: React.ElementType; gradient: string; children?: React.ReactNode; loading: boolean }) => (
    <Card className={cn('text-white shadow-lg rounded-2xl border-0 overflow-hidden bg-gradient-to-br', gradient)}>
      {loading ? (
        <div className="p-6 h-full flex flex-col justify-between">
          <Skeleton className="h-6 w-3/4 bg-white/20" />
          <Skeleton className="h-10 w-1/2 mt-2 bg-white/20" />
          <Skeleton className="h-4 w-full mt-4 bg-white/20" />
        </div>
      ) : (
        <div className="p-6 h-full flex flex-col">
            <div className="flex justify-between items-start">
              <h3 className="text-sm font-medium uppercase tracking-wider">{title}</h3>
              <div className="p-2 bg-white/20 rounded-lg">
                <Icon className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-2 flex-grow flex items-center">
              <p className="text-4xl font-bold font-headline">{value}</p>
            </div>
            {children && <div className="mt-4">{children}</div>}
        </div>
      )}
    </Card>
  );

  const ReturnRateCard = ({ rate, loading }: { rate: number; loading: boolean }) => {
    const ActiveSector = (props: any) => {
      const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
      return (
        <g>
          <Sector
            cx={cx}
            cy={cy}
            innerRadius={innerRadius}
            outerRadius={outerRadius + 2}
            startAngle={startAngle}
            endAngle={endAngle}
            fill={fill}
          />
        </g>
      );
    };

    return (
      <Card className="text-white shadow-lg rounded-2xl border-0 overflow-hidden bg-gradient-to-br from-amber-500 to-orange-600">
        {loading ? (
           <div className="p-6 h-full flex flex-col justify-between">
              <Skeleton className="h-6 w-3/4 bg-white/20" />
              <Skeleton className="h-10 w-1/2 mt-2 bg-white/20" />
            </div>
        ) : (
          <div className="p-6 h-full flex items-center justify-between">
            <div className="flex-1">
              <h3 className="text-sm font-medium uppercase tracking-wider">Return Rate</h3>
              <p className="text-4xl font-bold font-headline mt-2">
                {(rate || 0).toFixed(1)}%
              </p>
            </div>
            <div className="relative w-24 h-24">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[{ value: rate || 0 }, { value: 100 - (rate || 0) }]}
                    cx="50%"
                    cy="50%"
                    dataKey="value"
                    innerRadius={30}
                    outerRadius={40}
                    startAngle={90}
                    endAngle={-270}
                    paddingAngle={0}
                    stroke="none"
                    activeIndex={0}
                    activeShape={ActiveSector}
                  >
                    <Cell fill="rgba(255, 255, 255, 0.8)" />
                    <Cell fill="rgba(255, 255, 255, 0.2)" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center">
                 <Undo2 className="h-6 w-6 text-white/90" />
              </div>
            </div>
          </div>
        )}
      </Card>
    );
  };
  
  const PlatformPerformanceCard = ({ platform, revenue, units, loading, totalUnits }: { platform: 'Meesho' | 'Flipkart' | 'Amazon', revenue: number, units: number, loading: boolean, totalUnits: number }) => {
    
    const chartColors = {
        color1: '#22d3ee', // cyan-400
        color2: '#8b5cf6', // violet-500
    }

    const aestheticData = [{ value: 60 }, { value: 40 }];
    const share = totalUnits > 0 ? (units / totalUnits) * 100 : 0;

    if (loading) {
        return <Skeleton className="h-[140px] w-full rounded-3xl bg-white/20 dark:bg-black/20" />
    }

    return (
        <div className="relative overflow-hidden rounded-3xl border border-white/20 bg-white/10 p-6 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-black/20">
            <div className="absolute -bottom-16 left-1/2 h-32 w-[200%] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl"></div>

            <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                    <p className="font-semibold text-foreground">Platform: {platform}</p>
                    <p className="text-3xl font-bold font-headline text-foreground">{formatCurrency(revenue)}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <TrendingUp className="h-4 w-4 text-emerald-500" />
                        <span>{share.toFixed(1)}% of total units</span>
                    </div>
                </div>

                <div className="relative h-24 w-24 shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                             <Pie
                                data={aestheticData}
                                dataKey="value"
                                cx="50%"
                                cy="50%"
                                innerRadius={30}
                                outerRadius={40}
                                startAngle={90}
                                endAngle={450}
                                strokeWidth={2}
                                stroke="hsl(var(--background))"
                            >
                                <Cell fill={chartColors.color1} />
                                <Cell fill={chartColors.color2} />
                            </Pie>
                        </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <p className="text-xl font-bold text-foreground">{units.toLocaleString()}</p>
                        <p className="text-[10px] font-medium tracking-tight text-muted-foreground">Total Orders</p>
                    </div>
                </div>
            </div>
        </div>
    )
}

  return (
    <div className="p-6 md:p-8 space-y-6 bg-gray-50/50 dark:bg-black/50">
      {/* KPI Row */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Total Units Sold"
          value={loading ? '...' : (summary?.total_units || 0).toLocaleString('en-IN')}
          icon={Package}
          gradient="from-purple-500 to-indigo-600"
          loading={loading}
        />
        <KpiCard
          title="Gross Revenue"
          value={loading ? '...' : formatCurrency(summary?.gross_revenue || 0)}
          icon={CircleDollarSign}
          gradient="from-cyan-500 to-blue-600"
          loading={loading}
        />
        <KpiCard
          title="Net Profit"
          value={loading ? '...' : formatCurrency(summary?.net_profit || 0)}
          icon={TrendingUp}
          gradient="from-emerald-500 to-green-600"
          loading={loading}
        />
        <ReturnRateCard rate={summary?.return_rate || 0} loading={loading} />
      </div>

      {/* Platform Performance */}
      <div className="grid gap-6 md:grid-cols-3">
          {['Meesho', 'Flipkart', 'Amazon'].map(p => {
              const data = platformPerformance.find(item => item.platform === p);
              const totalUnits = summary?.total_units || 1;
              return (
                  <PlatformPerformanceCard 
                      key={p}
                      platform={p as 'Meesho' | 'Flipkart' | 'Amazon'}
                      units={data?.total_units || 0}
                      revenue={data?.total_revenue || 0}
                      totalUnits={totalUnits}
                      loading={loading}
                  />
              );
          })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Trend Chart */}
        <Card className="rounded-2xl shadow-md lg:col-span-2 bg-white/70 dark:bg-black/20 backdrop-blur-sm border-0">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Revenue Trend</CardTitle>
                <CardDescription>Last 30 days performance</CardDescription>
              </div>
              {/* UI only toggle for now */}
              <div className="flex items-center gap-1 rounded-lg bg-gray-200/50 dark:bg-gray-800/50 p-1 text-sm">
                  <Button size="sm" variant="ghost" className="h-7 px-3 bg-background shadow-sm">30d</Button>
                  <Button size="sm" variant="ghost" className="h-7 px-3 text-muted-foreground">7d</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="h-[350px] pr-2">
            {loading ? <Skeleton className="h-full w-full" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={revenueTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="order_date" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="left" orientation="left" stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(value) => formatCurrency(value)} />
                  <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      borderColor: 'hsl(var(--border))',
                      borderRadius: 'var(--radius)',
                    }}
                    formatter={(value: number, name: string) => {
                      if (name === 'Revenue') return [formatCurrency(value), 'Revenue'];
                      if (name === 'Units') return [value.toLocaleString(), 'Units'];
                      return [value, name];
                    }}
                  />
                  <Legend iconType="circle" iconSize={8} />
                  <Bar yAxisId="left" dataKey="total_revenue" name="Revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} barSize={20} />
                  <Line yAxisId="right" type="monotone" dataKey="total_units" name="Units" stroke="hsl(var(--foreground))" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Business Insights */}
        <div className="space-y-6">
            <Card className="rounded-2xl shadow-md bg-white/70 dark:bg-black/20 backdrop-blur-sm border-0">
                <CardHeader>
                    <CardTitle>Best Selling SKU</CardTitle>
                </CardHeader>
                <CardContent>
                     {loading ? <Skeleton className="h-12 w-full" /> : (
                        <div className="flex items-center justify-between">
                            <p className="text-2xl font-mono font-bold">{bestSeller?.variant_sku || 'N/A'}</p>
                            <p className="text-lg"><span className="font-bold">{bestSeller?.total_sold || 0}</span> units</p>
                        </div>
                     )}
                </CardContent>
            </Card>
            <Card className="rounded-2xl shadow-md bg-white/70 dark:bg-black/20 backdrop-blur-sm border-0">
                <CardHeader>
                    <CardTitle>Low Stock Alert</CardTitle>
                </CardHeader>
                <CardContent>
                     {loading ? <Skeleton className="h-12 w-full" /> : (
                        <div className="flex items-center justify-between">
                            <p className="text-lg"><span className="font-bold text-2xl">{lowStock?.low_stock_count || 0}</span> SKUs running low</p>
                            {(lowStock?.low_stock_count || 0) > 0 ? 
                                <Badge variant="destructive" className="bg-red-500 text-white"><AlertTriangle className="mr-1 h-3 w-3" /> Action Required</Badge> : 
                                <Badge className="bg-green-100 text-green-800 border-green-200 dark:bg-green-900/50 dark:text-green-300 dark:border-green-800"><CheckCircle2 className="mr-1 h-3 w-3"/> Healthy</Badge>
                            }
                        </div>
                     )}
                </CardContent>
            </Card>
        </div>
      </div>
      
      {/* Recent Orders */}
      <Card className="rounded-2xl shadow-md bg-white/70 dark:bg-black/20 backdrop-blur-sm border-0">
        <CardHeader>
          <CardTitle>Recent Orders</CardTitle>
          <CardDescription>Your 5 most recent orders.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Date</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-center">Quantity</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                   Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i} className="hover:bg-transparent">
                        <TableCell colSpan={6}><Skeleton className="h-8 w-full" /></TableCell>
                      </TableRow>
                    ))
                ) : recentOrders.length > 0 ? (
                  recentOrders.map((order) => (
                    <TableRow key={order.id} className="hover:bg-gray-50/50 dark:hover:bg-white/5">
                      <TableCell>{new Date(order.created_at).toLocaleDateString('en-IN')}</TableCell>
                      <TableCell><Badge variant="secondary">{order.platform}</Badge></TableCell>
                      <TableCell className="font-medium">{order.product_variants?.variant_sku || 'N/A'}</TableCell>
                      <TableCell className="text-center">{order.quantity}</TableCell>
                      <TableCell className="text-right">{formatCurrency(order.total_amount)}</TableCell>
                      <TableCell className="text-center"><Badge>Shipped</Badge></TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center h-24">No recent orders.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
