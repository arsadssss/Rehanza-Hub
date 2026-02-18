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
  Legend,
} from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Package,
  CircleDollarSign,
  TrendingUp,
  Undo2,
  Store,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function DashboardPage() {
  const [totalOrders, setTotalOrders] = useState(0);
  const [todayRevenue, setTodayRevenue] = useState(0);
  const [netProfit, setNetProfit] = useState(0);
  const [lowStock, setLowStock] = useState(0);
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [channelData, setChannelData] = useState<any[]>([]);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);

      // Fetch all required data in parallel
      const [
        ordersRes,
        returnsRes,
        lowStockRes,
        recentOrdersRes,
      ] = await Promise.all([
        supabase.from('orders').select('quantity, total_amount, created_at, platform, product_variants(allproducts(margin))'),
        supabase.from('returns').select('quantity, restockable, product_variants(allproducts(margin))'),
        supabase.from('inventory_summary').select('total_stock, low_stock_threshold').gt('total_stock', 0),
        supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(5),
      ]);

      // Process orders data
      const orders = ordersRes.data || [];
      const totalOrderUnits = orders.reduce((sum, o) => sum + o.quantity, 0);
      const revenueToday = orders
        .filter(o => new Date(o.created_at).toDateString() === new Date().toDateString())
        .reduce((sum, o) => sum + o.total_amount, 0);
      
      setTotalOrders(totalOrderUnits);
      setTodayRevenue(revenueToday);

      // Process returns for net profit
      const returns = returnsRes.data || [];
      const grossMargin = orders.reduce((acc: number, order: any) => {
        const margin = order.product_variants?.allproducts?.margin || 0;
        return acc + (order.quantity * margin);
      }, 0);
      const returnImpact = returns.reduce((acc: number, ret: any) => {
        if (ret.restockable) {
          return acc + (ret.quantity * 45); // Fixed loss
        }
        const margin = ret.product_variants?.allproducts?.margin || 0;
        return acc + (ret.quantity * margin); // Margin loss
      }, 0);
      setNetProfit(grossMargin - returnImpact);

      // Process low stock
      const lowStockItems = (lowStockRes.data || []).filter(item => item.total_stock <= item.low_stock_threshold).length;
      setLowStock(lowStockItems);

      // Process revenue trend
      const days: { [key: string]: number } = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const label = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
        days[label] = 0;
      }
      orders.forEach((item: any) => {
        const label = new Date(item.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
        if (days[label] !== undefined) {
          days[label] += item.total_amount;
        }
      });
      const formattedRevenue = Object.keys(days).map(key => ({
        label: key,
        revenue: days[key],
      }));
      setRevenueData(formattedRevenue);

      // Process channel performance
      const grouped: { [key: string]: number } = {};
      orders.forEach((item: any) => {
        grouped[item.platform] = (grouped[item.platform] || 0) + item.quantity;
      });
      const formattedChannels = Object.keys(grouped).map(key => ({
        name: key,
        value: grouped[key],
      }));
      setChannelData(formattedChannels);
      
      // Set recent orders
      setRecentOrders(recentOrdersRes.data || []);

      setLoading(false);
    }
    fetchData();
  }, []);

  const StatCard = ({ title, value, icon: Icon, description, gradient }: { title: string; value: string; icon: any; description: string; gradient: string; }) => (
    <Card className={`text-white bg-gradient-to-r ${gradient} shadow-lg rounded-2xl border-0`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-5 w-5 text-white/80" />
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold font-headline">{value}</div>
        <p className="text-xs text-white/80">{description}</p>
      </CardContent>
    </Card>
  );

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-headline">
            Dashboard
          </h1>
          <p className="text-muted-foreground">
            An overview of your business performance.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DateRangePicker />
          <Button>Download</Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Orders"
          value={loading ? '...' : totalOrders.toLocaleString('en-IN')}
          icon={Package}
          description="Total units sold"
          gradient="from-purple-500 to-indigo-600"
        />
        <StatCard
          title="Today's Revenue"
          value={loading ? '...' : formatCurrency(todayRevenue)}
          icon={CircleDollarSign}
          description="Gross revenue for today"
          gradient="from-cyan-500 to-blue-600"
        />
        <StatCard
          title="Net Profit"
          value={loading ? '...' : formatCurrency(netProfit)}
          icon={TrendingUp}
          description="Estimated net profit"
          gradient="from-emerald-500 to-green-600"
        />
        <StatCard
          title="Low Stock SKUs"
          value={loading ? '...' : lowStock.toString()}
          icon={Undo2}
          description="Items needing restock"
          gradient="from-amber-500 to-orange-600"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-2xl shadow-md">
          <CardHeader>
            <CardTitle>Revenue Trend</CardTitle>
            <CardDescription>Last 7 days revenue.</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            {loading ? <Skeleton className="h-full w-full" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={revenueData}>
                  <XAxis dataKey="label" fontSize={12} />
                  <YAxis fontSize={12} tickFormatter={(value) => formatCurrency(value)} />
                  <Tooltip formatter={(value: number) => [formatCurrency(value), 'Revenue']} />
                  <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        <Card className="rounded-2xl shadow-md">
          <CardHeader>
            <CardTitle>Channel Performance</CardTitle>
            <CardDescription>Order count by platform.</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            {loading ? <Skeleton className="h-full w-full" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={channelData} layout="vertical" margin={{ left: 20 }}>
                   <XAxis type="number" hide />
                   <YAxis dataKey="name" type="category" scale="band" width={80} fontSize={12} />
                   <Tooltip formatter={(value: number) => [value, 'Orders']} />
                   <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
      
      <Card className="rounded-2xl shadow-md">
        <CardHeader>
          <CardTitle>Recent Orders</CardTitle>
          <CardDescription>Your 5 most recent orders.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order ID</TableHead>
                <TableHead>Platform</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                 Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={5}><Skeleton className="h-6 w-full" /></TableCell>
                    </TableRow>
                  ))
              ) : recentOrders.length > 0 ? (
                recentOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">{`#${order.id.toString().slice(-6)}`}</TableCell>
                    <TableCell><Badge variant="secondary">{order.platform}</Badge></TableCell>
                    <TableCell>{new Date(order.created_at).toLocaleDateString('en-IN')}</TableCell>
                    <TableCell>{formatCurrency(order.total_amount)}</TableCell>
                    <TableCell><Badge>Shipped</Badge></TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center">No recent orders.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
