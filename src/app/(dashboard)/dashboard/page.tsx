
"use client";

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/format';
import { DateRangePicker } from './components/date-range-picker';
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
  CartesianGrid,
  Legend
} from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Package,
  CircleDollarSign,
  TrendingUp,
  Undo2,
  Store,
  PackageCheck,
  BellRing,
  ArrowRight,
  BarChart,
  LineChartIcon,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';


// --- KPI Card Component ---
interface KpiCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  description: string;
  progress?: number;
  loading: boolean;
  color: string;
}

function KpiCard({ title, value, icon: Icon, description, progress, loading, color }: KpiCardProps) {
  const progressData = progress !== undefined ? [
    { name: 'value', value: progress },
    { name: 'remaining', value: 100 - progress },
  ] : [];

  return (
    <Card className={cn("rounded-2xl shadow-lg border-0 text-white transition-transform hover:scale-105", color)}>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div className="space-y-1">
          <CardTitle className="text-sm font-medium text-white/80">{title}</CardTitle>
          {loading ? <Skeleton className="h-9 w-24 bg-white/20" /> : (
            <div className="text-4xl font-bold font-headline">{value}</div>
          )}
        </div>
        <div className="relative">
          <div className="p-3 rounded-lg bg-white/20">
            <Icon className="h-6 w-6" />
          </div>
          {progress !== undefined && !loading && (
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-20 w-20">
               <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart innerRadius="80%" outerRadius="100%">
                    <circle cx="50%" cy="50%" r="40%" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
                    <circle cx="50%" cy="50%" r="40%" fill="none" stroke="white" strokeWidth="8" strokeDasharray={`${2 * Math.PI * 32 * (progress/100)} ${2 * Math.PI * 32 * (1-progress/100)}`} strokeDashoffset={2 * Math.PI * 32 * 0.25} strokeLinecap="round" />
                  </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-6 pt-2">
         {loading ? <Skeleton className="h-4 w-32 bg-white/20" /> : (
            <p className="text-xs text-white/80">{description}</p>
         )}
      </CardContent>
    </Card>
  );
}

// --- Main Dashboard Page Component ---
export default function DashboardPage() {
  const [summary, setSummary] = useState<any>(null);
  const [platformPerformance, setPlatformPerformance] = useState<any[]>([]);
  const [revenueTrend, setRevenueTrend] = useState<any[]>([]);
  const [bestSeller, setBestSeller] = useState<any>(null);
  const [lowStockCount, setLowStockCount] = useState<number | null>(null);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboardData() {
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
        supabase.from('revenue_trend_30d').select('*').order('date', { ascending: true }),
        supabase.from('best_selling_sku').select('*').single(),
        supabase.from('low_stock_items').select('low_stock_count').single(),
        supabase.from('orders').select('*, product_variants(variant_sku)').order('created_at', { ascending: false }).limit(5),
      ]);

      setSummary(summaryRes.data);
      setPlatformPerformance(platformRes.data || []);
      
      const formattedRevenue = (revenueRes.data || []).map(item => ({
        ...item,
        label: new Date(item.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
      }));
      setRevenueTrend(formattedRevenue);
      
      setBestSeller(bestSellerRes.data);
      setLowStockCount(lowStockRes.data?.low_stock_count ?? 0);

      const statuses = ['Delivered', 'Shipped', 'Returned', 'RTO', 'Delivered'];
      const formattedRecentOrders = (recentOrdersRes.data || []).map((order, index) => ({
        ...order,
        order_id_display: `#${order.platform.substring(0, 2).toUpperCase()}-${String(order.id).slice(-4)}`,
        status: statuses[index % statuses.length],
      }));
      setRecentOrders(formattedRecentOrders);

      setLoading(false);
    }

    fetchDashboardData();
  }, []);

  const platformMeta: { [key: string]: { color: string, icon: LucideIcon } } = {
    Meesho: { color: "text-pink-600 bg-pink-500/10", icon: Store },
    Flipkart: { color: "text-yellow-600 bg-yellow-500/10", icon: Store },
    Amazon: { color: "text-amber-700 bg-amber-500/10", icon: Store },
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'Delivered': return 'bg-green-100 text-green-800';
      case 'Shipped': return 'bg-blue-100 text-blue-800';
      case 'Returned': return 'bg-red-100 text-red-800';
      case 'RTO': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  return (
    <div className="flex-1 space-y-6 p-6 md:p-8 bg-gray-50 dark:bg-gray-900">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-headline">
            Dashboard
          </h1>
          <p className="text-muted-foreground">
            Welcome back! Here's your business snapshot.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DateRangePicker />
          <Button>Download</Button>
        </div>
      </div>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            title="Total Units Sold"
            value={loading ? '...' : (summary?.total_units || 0).toLocaleString('en-IN')}
            description={`+${(summary?.total_units_wow_pct_change || 0).toFixed(1)}% from last week`}
            icon={Package}
            loading={loading}
            color="bg-gradient-to-br from-purple-500 to-indigo-600"
          />
          <KpiCard
            title="Gross Revenue"
            value={loading ? '...' : formatCurrency(summary?.gross_revenue || 0)}
            description={`+${(summary?.gross_revenue_wow_pct_change || 0).toFixed(1)}% from last week`}
            icon={CircleDollarSign}
            loading={loading}
            color="bg-gradient-to-br from-cyan-500 to-blue-600"
          />
          <KpiCard
            title="Net Profit"
            value={loading ? '...' : formatCurrency(summary?.net_profit || 0)}
            description="After all fees & returns"
            icon={TrendingUp}
            loading={loading}
            color="bg-gradient-to-br from-emerald-500 to-green-600"
          />
          <KpiCard
            title="Return Rate"
            value={loading ? '...' : `${(summary?.return_rate || 0).toFixed(1)}%`}
            description="Units returned vs. units sold"
            icon={Undo2}
            progress={summary?.return_rate || 0}
            loading={loading}
            color="bg-gradient-to-br from-amber-500 to-orange-600"
          />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {loading ? Array.from({length: 3}).map((_, i) => <Skeleton key={i} className="h-full rounded-2xl" />) :
          platformPerformance.map(p => {
            const meta = platformMeta[p.platform as keyof typeof platformMeta] || { color: 'text-gray-600 bg-gray-500/10', icon: Store };
            const share = summary?.total_units > 0 ? (p.total_units / summary.total_units) * 100 : 0;
            return (
              <Card key={p.platform} className="rounded-2xl shadow-md border-0 bg-white/70 dark:bg-black/20 backdrop-blur-sm">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-base font-medium">{p.platform}</CardTitle>
                  <meta.icon className={cn("h-6 w-6", meta.color.split(' ')[0])} />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(p.revenue)}</div>
                  <p className="text-xs text-muted-foreground">{p.total_units.toLocaleString('en-IN')} units sold ({share.toFixed(1)}% of total)</p>
                </CardContent>
              </Card>
            )
          })
        }
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="rounded-2xl shadow-lg border-0 bg-white/70 dark:bg-black/20 backdrop-blur-sm lg:col-span-2">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="font-headline">Revenue Trend</CardTitle>
                <CardDescription>Last 30 days performance</CardDescription>
              </div>
              <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
                <Button size="sm" variant="ghost" className="h-7 px-3">7d</Button>
                <Button size="sm" className="h-7 px-3 bg-primary text-primary-foreground hover:bg-primary/90">30d</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[350px] w-full">
              {loading ? <Skeleton className="h-full w-full" /> : (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={revenueTrend} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis yAxisId="left" orientation="left" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => formatCurrency(value)} />
                    <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--background))',
                        borderColor: 'hsl(var(--border))',
                        borderRadius: '0.75rem'
                      }}
                      formatter={(value: number, name: string) => {
                        if (name === 'gross_revenue') return [formatCurrency(value), 'Revenue'];
                        if (name === 'total_units') return [value.toLocaleString('en-IN'), 'Units'];
                        return [value, name];
                      }}
                    />
                    <Legend iconType="circle" iconSize={8} formatter={(value, entry) => {
                      const name = value === 'gross_revenue' ? 'Revenue' : 'Units';
                      return <span className="text-muted-foreground text-sm">{name}</span>
                    }} />
                    <Bar yAxisId="left" dataKey="gross_revenue" fill="hsl(var(--primary) / 0.3)" radius={[4, 4, 0, 0]} barSize={20} name="Revenue" />
                    <Line yAxisId="right" type="monotone" dataKey="total_units" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} activeDot={{ r: 6 }} name="Units" />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
        
        <div className="space-y-6">
          <Card className="rounded-2xl shadow-lg border-0 bg-white/70 dark:bg-black/20 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="font-headline flex items-center gap-2"><PackageCheck className="text-primary"/> Best Selling SKU</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? <Skeleton className="h-10 w-full"/> : (
                <>
                  <p className="text-2xl font-bold">{bestSeller?.variant_sku || 'N/A'}</p>
                  <p className="text-sm text-muted-foreground">{bestSeller?.total_sold || 0} units sold in last 30d</p>
                </>
              )}
            </CardContent>
          </Card>
           <Card className="rounded-2xl shadow-lg border-0 bg-white/70 dark:bg-black/20 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="font-headline flex items-center gap-2"><BellRing className="text-destructive"/> Low Stock Alert</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? <Skeleton className="h-10 w-full"/> : lowStockCount && lowStockCount > 0 ? (
                 <div className="flex items-center justify-between">
                    <div>
                       <p className="text-2xl font-bold">{lowStockCount} SKUs</p>
                       <p className="text-sm text-muted-foreground">are running low on stock</p>
                    </div>
                    <Button variant="destructive" size="sm">
                        View Items <ArrowRight className="ml-2 h-4 w-4"/>
                    </Button>
                 </div>
              ) : (
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-green-500/10 rounded-full"><PackageCheck className="h-5 w-5 text-green-600"/></div>
                    <p className="text-sm font-medium text-muted-foreground">Inventory levels are healthy.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="shadow-xl rounded-2xl bg-white/70 dark:bg-black/20 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="font-headline">Recent Orders</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? <Skeleton className="h-[250px] w-full" /> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell>
                      <div className="font-medium">{order.product_variants?.variant_sku || 'N/A'}</div>
                      <div className="text-xs text-muted-foreground">Qty: {order.quantity}</div>
                    </TableCell>
                    <TableCell>{order.platform}</TableCell>
                    <TableCell>{new Date(order.created_at).toLocaleDateString('en-IN')}</TableCell>
                    <TableCell>{formatCurrency(order.total_amount)}</TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={cn("font-semibold", getStatusBadge(order.status))}
                      >
                        {order.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
