
"use client";

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/format';
import { StatCard } from './components/stat-card';
import {
  ShoppingCart,
  DollarSign,
  TrendingUp,
  PackageX,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DateRangePicker } from './components/date-range-picker';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
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
  BarChart,
  Bar,
  PieChart,
  Pie,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';

type DashboardData = {
  total_orders: number;
  today_revenue: number;
  net_profit: number;
  low_stock: number;
};

type RevenueData = {
  label: string;
  revenue: number;
};

type ChannelData = {
  name: string;
  value: number;
};

type RecentOrder = {
  id: string;
  order_id_display: string;
  platform: string;
  total_amount: number;
  status: string; // This will be static for now as it's not in DB
};

const channelColors: { [key: string]: string } = {
  Meesho: 'hsl(var(--chart-1))',
  Flipkart: 'hsl(var(--chart-2))',
  Amazon: 'hsl(var(--chart-3))',
  default: 'hsl(var(--muted))',
};

export default function DashboardPage() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [revenueData, setRevenueData] = useState<RevenueData[]>([]);
  const [channelData, setChannelData] = useState<ChannelData[]>([]);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [
        allOrdersRes,
        allReturnsRes,
        revenueRes,
        recentOrdersRes,
        lowStockRes,
      ] = await Promise.all([
        supabase.from('orders').select('platform, quantity, total_amount, created_at, product_variants(allproducts(margin))'),
        supabase.from('returns').select('quantity, restockable, product_variants(allproducts(margin))'),
        supabase.from('analytics_last_7_days').select('*'),
        supabase.from('orders').select('id, platform, total_amount, created_at').order('created_at', { ascending: false }).limit(5),
        supabase.rpc('low_stock_count'),
      ]);

      const allOrders = allOrdersRes.data || [];
      const allReturns = allReturnsRes.data || [];

      // 1. Dashboard Metrics
      const totalOrders = allOrders.reduce((sum, o) => sum + o.quantity, 0);

      const todayRevenue = allOrders
        .filter(o => new Date(o.created_at).toDateString() === new Date().toDateString())
        .reduce((sum, o) => sum + o.total_amount, 0);
      
      const grossMargin = allOrders.reduce((acc, order: any) => {
        const margin = order.product_variants?.allproducts?.margin || 0;
        return acc + (order.quantity * margin);
      }, 0);

      const returnImpact = allReturns.reduce((acc, ret: any) => {
        if (ret.restockable) {
          return acc + (ret.quantity * 45);
        }
        const margin = ret.product_variants?.allproducts?.margin || 0;
        return acc + (ret.quantity * margin);
      }, 0);

      const netProfit = grossMargin - returnImpact;
      
      setDashboardData({
        total_orders: totalOrders,
        today_revenue: todayRevenue,
        net_profit: netProfit,
        low_stock: lowStockRes.data || 0,
      });

      // 2. Revenue Trend
      if (revenueRes.data) {
        const formattedRevenue = revenueRes.data.map(item => ({
          label: new Date(item.label).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
          revenue: item.total_sales
        }));
        setRevenueData(formattedRevenue);
      }

      // 3. Channel Performance
      const grouped: { [key: string]: number } = {};
      allOrders.forEach((item: any) => {
        grouped[item.platform] = (grouped[item.platform] || 0) + item.quantity;
      });
      const formattedChannels = Object.keys(grouped).map(key => ({
        name: key,
        value: grouped[key]
      }));
      setChannelData(formattedChannels);

      // 4. Recent Orders
      if (recentOrdersRes.data) {
        const statuses = ['Delivered', 'Returned', 'Delivered', 'RTO', 'Delivered'];
        const formattedRecentOrders = recentOrdersRes.data.map((order, index) => ({
            id: order.id,
            order_id_display: `#${order.platform.substring(0, 2).toUpperCase()}-${String(order.id).slice(-4)}`,
            platform: order.platform,
            total_amount: order.total_amount,
            status: statuses[index % statuses.length],
        }));
        setRecentOrders(formattedRecentOrders);
      }

      setLoading(false);
    }

    fetchData();
  }, []);

  return (
    <div className="flex-1 space-y-6 p-6 md:p-8">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-headline">
            Dashboard
          </h1>
          <p className="text-muted-foreground">
            Here's a quick overview of your business performance.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DateRangePicker />
          <Button>Download Report</Button>
        </div>
      </div>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {loading ? (
          <>
            <Skeleton className="h-[126px] rounded-2xl" />
            <Skeleton className="h-[126px] rounded-2xl" />
            <Skeleton className="h-[126px] rounded-2xl" />
            <Skeleton className="h-[126px] rounded-2xl" />
          </>
        ) : (
          <>
            <StatCard
              title="Total Orders"
              value={dashboardData?.total_orders.toLocaleString('en-IN') || '0'}
              icon={ShoppingCart}
              description="+20.1% from last month"
              gradient="from-violet-500 to-purple-500"
            />
            <StatCard
              title="Today Revenue"
              value={formatCurrency(dashboardData?.today_revenue || 0)}
              icon={DollarSign}
              description="+180.1% from last week"
              gradient="from-blue-500 to-sky-500"
            />
            <StatCard
              title="Net Profit"
              value={formatCurrency(dashboardData?.net_profit || 0)}
              icon={TrendingUp}
              description="+19% from last month"
              gradient="from-emerald-500 to-green-500"
            />
            <StatCard
              title="Low Stock SKUs"
              value={dashboardData?.low_stock.toString() || '0'}
              icon={PackageX}
              description="needs immediate restocking"
              gradient="from-amber-500 to-orange-500"
            />
          </>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="shadow-xl rounded-2xl">
          <CardHeader>
            <CardTitle className="font-headline">Revenue Trend</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-[300px] w-full" /> : (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueData}>
                    <XAxis dataKey="label" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => formatCurrency(value as number)} />
                    <Tooltip contentStyle={{ backgroundColor: 'white', border: '1px solid #ccc' }} cursor={{fill: 'transparent'}} formatter={(value: number) => [formatCurrency(value), "Revenue"]} />
                    <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="shadow-xl rounded-2xl">
          <CardHeader>
            <CardTitle className="font-headline">Channel Performance</CardTitle>
          </CardHeader>
          <CardContent>
             {loading ? <Skeleton className="h-[300px] w-full" /> : (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={channelData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} labelLine={false}>
                      {channelData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={channelColors[entry.name] || channelColors.default} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => [value, "Orders"]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
             )}
          </CardContent>
        </Card>
      </div>

       <Card className="shadow-xl rounded-2xl">
        <CardHeader>
          <CardTitle className="font-headline">Recent Orders</CardTitle>
        </CardHeader>
        <CardContent>
            {loading ? <Skeleton className="h-[250px] w-full" /> : (
            <Table>
                <TableHeader>
                <TableRow>
                    <TableHead>Order ID</TableHead>
                    <TableHead>Channel</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                </TableRow>
                </TableHeader>
                <TableBody>
                {recentOrders.map((order) => (
                    <TableRow key={order.id}>
                    <TableCell className="font-medium">{order.order_id_display}</TableCell>
                    <TableCell>{order.platform}</TableCell>
                    <TableCell>{formatCurrency(order.total_amount)}</TableCell>
                    <TableCell>
                        <Badge
                        variant={
                            order.status === 'Delivered'
                            ? 'default'
                            : order.status === 'Returned'
                            ? 'destructive'
                            : 'secondary'
                        }
                        className={`${order.status === 'Delivered' ? 'bg-green-500' : ''}`}
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
