"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { formatINR } from '@/lib/format';
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
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
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
  Download,
  ChevronDown,
  Medal,
  Wallet,
  Archive,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart';


// Types
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

type WeeklyOrdersVsReturns = {
  day_label: string;
  total_orders: number;
  total_returns: number;
};

type TopSellingProduct = {
  product_name: string;
  variant_sku: string;
  total_revenue: number;
  total_units_sold: number;
};

type RecentOrder = {
  id: string;
  created_at: string;
  platform: 'Meesho' | 'Flipkart' | 'Amazon';
  quantity: number;
  total_amount: number;
  variant_sku: string | null;
};

type UserPerformance = {
  id: string;
  name: string;
  total_tasks: number;
  completed_tasks: number;
  completion_rate: number;
};

// --- SUB-COMPONENTS ---

const KpiCard = ({ title, value, icon: Icon, gradient, loading }: { title: string; value: string; icon: React.ElementType; gradient: string; loading: boolean }) => (
    <Card className={cn('text-white shadow-lg rounded-2xl border-0 overflow-hidden bg-gradient-to-br', gradient)}>
        {loading ? (
            <div className="p-6 flex items-center justify-between">
                <div>
                    <Skeleton className="h-5 w-32 bg-white/20" />
                    <Skeleton className="h-10 w-40 mt-2 bg-white/20" />
                </div>
                <div className="p-3 bg-white/20 rounded-full opacity-20">
                   <Icon className="h-6 w-6 text-white" />
                </div>
            </div>
        ) : (
            <div className="p-6 flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-medium uppercase tracking-wider">{title}</h3>
                    <p className="text-4xl font-bold font-headline mt-2">{value}</p>
                </div>
                <div className="p-3 bg-white/20 rounded-full">
                    <Icon className="h-6 w-6 text-white" />
                </div>
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

  const numericRate = Number(rate) || 0;

  return (
    <Card className="text-white shadow-lg rounded-2xl border-0 overflow-hidden bg-gradient-to-br from-amber-500 to-orange-600">
      {loading ? (
         <div className="p-6 h-full flex items-center justify-between">
            <div>
                <Skeleton className="h-5 w-32 bg-white/20" />
                <Skeleton className="h-10 w-24 mt-2 bg-white/20" />
            </div>
            <Skeleton className="h-24 w-24 rounded-full bg-white/20" />
          </div>
      ) : (
        <div className="p-6 h-full flex items-center justify-between">
          <div className="flex-1">
            <h3 className="text-sm font-medium uppercase tracking-wider">Return Rate</h3>
            <p className="text-4xl font-bold font-headline mt-2">
              {numericRate.toFixed(1)}%
            </p>
          </div>
          <div className="relative w-24 h-24">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[{ value: numericRate }, { value: 100 - numericRate }]}
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
      Meesho: { color1: '#ec4899', color2: '#f9a8d4' },
      Flipkart: { color1: '#f59e0b', color2: '#fcd34d' },
      Amazon: { color1: '#ca8a04', color2: '#eab308' },
  };

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
                  <p className="text-3xl font-bold font-headline text-foreground">{formatINR(revenue)}</p>
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
                              <Cell fill={chartColors[platform].color1} />
                              <Cell fill={chartColors[platform].color2} />
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

const OrdersVsReturnsCard = ({ data, loading }: { data: any[], loading: boolean }) => {
  const CustomTooltip = ({ active, payload, label }: any) => {
      if (active && payload && payload.length) {
          const orders = payload.find((p: any) => p.dataKey === 'total_orders')?.value || 0;
          const returns = payload.find((p: any) => p.dataKey === 'total_returns')?.value || 0;
          const rate = orders > 0 ? ((returns / orders) * 100).toFixed(1) : 0;

          return (
              <div className="rounded-md border border-border/50 bg-background/80 backdrop-blur-sm p-3 shadow-md">
                  <p className="font-bold text-base mb-2">{label}</p>
                  <div className="space-y-1 text-sm">
                      <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
                              <p className="text-muted-foreground">Orders:</p>
                          </div>
                          <p className="font-medium">{orders}</p>
                      </div>
                      <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
                              <p className="text-muted-foreground">Returns:</p>
                          </div>
                          <p className="font-medium">{returns}</p>
                      </div>
                      <div className="flex items-center justify-between border-t border-border/50 mt-2 pt-2">
                           <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full bg-gray-400"></span>
                              <p className="text-muted-foreground">Return Rate:</p>
                          </div>
                          <p className="font-medium">{rate}%</p>
                      </div>
                  </div>
              </div>
          );
      }
      return null;
  };
  
  return (
      <Card className="rounded-2xl shadow-lg lg:col-span-2 bg-white/70 dark:bg-black/20 backdrop-blur-sm border-0">
          <CardHeader>
              <div className="flex justify-between items-center">
                  <div>
                      <CardTitle>Orders vs Returns</CardTitle>
                      <CardDescription>Last 7 Days Performance</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" className="h-8 gap-1 bg-background/50">
                          <span>Weekly</span> <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 bg-background/50">
                          <Download className="h-4 w-4" />
                      </Button>
                  </div>
              </div>
          </CardHeader>
          <CardContent className="h-[320px] pr-4">
              {loading ? <Skeleton className="h-full w-full" /> : (
                  data && data.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} opacity={0.3} />
                              <XAxis dataKey="day_label" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                              <YAxis allowDecimals={false} fontSize={12} tickLine={false} axisLine={false} dx={-10} />
                              <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'hsl(var(--border))', strokeWidth: 1, strokeDasharray: '3 3' }}/>
                              <defs>
                                  <linearGradient id="colorOrders" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.15}/>
                                      <stop offset="95%" stopColor="#4F46E5" stopOpacity={0}/>
                                  </linearGradient>
                              </defs>
                              <Area type="monotone" dataKey="total_orders" stroke="none" fill="url(#colorOrders)" />
                              <Line
                                  type="monotone"
                                  dataKey="total_orders"
                                  stroke="#4F46E5"
                                  strokeWidth={3}
                                  dot={{ r: 4, fill: '#4F46E5', strokeWidth: 2, stroke: 'hsl(var(--background))' }}
                                  activeDot={{ r: 6, strokeWidth: 2, fill: '#4F46E5', stroke: 'hsl(var(--background))' }}
                              />
                              <Line
                                  type="monotone"
                                  dataKey="total_returns"
                                  stroke="#F97316"
                                  strokeWidth={3}
                                  dot={{ r: 4, fill: '#F97316', strokeWidth: 2, stroke: 'hsl(var(--background))' }}
                                  activeDot={{ r: 6, strokeWidth: 2, fill: '#F97316', stroke: 'hsl(var(--background))' }}
                              />
                          </LineChart>
                      </ResponsiveContainer>
                  ) : (
                      <div className="h-full w-full flex items-center justify-center">
                          <p className="text-muted-foreground">Not enough data yet</p>
                      </div>
                  )
              )}
          </CardContent>
      </Card>
  );
};

const ChannelPerformanceCard = ({ data, loading }: { data: PlatformPerformance[], loading: boolean }) => {
    const chartConfig = {
        total_units: { label: "Units" },
        Meesho: { label: "Meesho", color: "hsl(var(--chart-1))" },
        Flipkart: { label: "Flipkart", color: "hsl(var(--chart-2))" },
        Amazon: { label: "Amazon", color: "hsl(var(--chart-3))" },
    } as const;

    const chartData = useMemo(() => data.map(item => ({
        name: item.platform,
        value: Number(item.total_units) || 0,
    })), [data]);

    const totalUnits = useMemo(() => chartData.reduce((acc, curr) => acc + curr.value, 0), [chartData]);

    return (
        <Card className="rounded-2xl shadow-lg bg-white/70 dark:bg-black/20 backdrop-blur-sm border-0 lg:col-span-1">
            <CardHeader>
                <CardTitle>Channel Performance</CardTitle>
                <CardDescription>Total units sold by platform</CardDescription>
            </CardHeader>
            <CardContent className="h-[320px] flex items-center justify-center">
                {loading ? <Skeleton className="h-full w-full rounded-full" /> : (
                     <ChartContainer config={chartConfig} className="h-full w-full aspect-square">
                        <ResponsiveContainer>
                            <PieChart>
                                <Tooltip
                                    cursor={false}
                                    content={<ChartTooltipContent indicator="dot" nameKey="name" />}
                                />
                                <Pie
                                    data={chartData}
                                    dataKey="value"
                                    nameKey="name"
                                    innerRadius={70}
                                    outerRadius={110}
                                    strokeWidth={2}
                                    paddingAngle={5}
                                >
                                     {chartData.map((entry) => (
                                        <Cell key={`cell-${entry.name}`} fill={`var(--color-${entry.name})`} className="focus:outline-none" />
                                    ))}
                                </Pie>
                                <g>
                                  <text x="50%" y="47%" textAnchor="middle" dominantBaseline="central" className="text-4xl font-bold font-headline fill-foreground">
                                    {totalUnits.toLocaleString()}
                                  </text>
                                  <text x="50%" y="60%" textAnchor="middle" dominantBaseline="central" className="text-xs fill-muted-foreground">
                                    Total Units
                                  </text>
                                </g>
                            </PieChart>
                        </ResponsiveContainer>
                    </ChartContainer>
                )}
            </CardContent>
        </Card>
    );
};

const TopSellingProductsCard = ({ products, loading }: { products: TopSellingProduct[], loading: boolean }) => {
  const totalRevenue = useMemo(() => products.reduce((acc, p) => acc + Number(p.total_revenue || 0), 0), [products]);

  const rankIcons = [
    <Medal key="gold" className="h-5 w-5 text-amber-400" />,
    <Medal key="silver" className="h-5 w-5 text-slate-400" />,
    <Medal key="bronze" className="h-5 w-5 text-orange-500" />,
  ];

  return (
    <Card className="rounded-2xl shadow-lg bg-white/70 dark:bg-black/20 backdrop-blur-sm border-0">
      <CardHeader>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
          <div>
            <CardTitle>Top Selling Products</CardTitle>
            <CardDescription>Last 30 Days</CardDescription>
          </div>
          {!loading && totalRevenue > 0 && (
            <Badge variant="secondary" className="mt-2 md:mt-0 bg-background/50">
              {formatINR(totalRevenue)} Total Revenue
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : products.length > 0 ? (
          <ul className="-mx-2">
            {products.map((product, index) => (
              <li key={`${product.variant_sku}-${index}`} className="py-3 px-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                <div className="flex justify-between items-center gap-4">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="flex h-8 w-8 items-center justify-center text-muted-foreground font-semibold flex-shrink-0">
                      {index < 3 ? rankIcons[index] : index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground truncate">{product.product_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{product.variant_sku}</p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-4">
                    <p className="font-semibold">{Number(product.total_units_sold || 0).toLocaleString()} units</p>
                    <p className="text-sm text-emerald-600 dark:text-emerald-500 font-medium">{formatINR(product.total_revenue)}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex items-center justify-center h-40">
            <p className="text-muted-foreground">Not enough sales data yet</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Main Page Component
export default function DashboardPage() {
  const { toast } = useToast();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [platformPerformance, setPlatformPerformance] = useState<PlatformPerformance[]>([]);
  const [ordersReturnsData, setOrdersReturnsData] = useState<WeeklyOrdersVsReturns[]>([]);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [topSellingProducts, setTopSellingProducts] = useState<TopSellingProduct[]>([]);
  const [userPerformance, setUserPerformance] = useState<UserPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);

  const [totalDueAllVendors, setTotalDueAllVendors] = useState(0);
  const [totalInventoryValue, setTotalInventoryValue] = useState(0);

  useEffect(() => {
    setIsMounted(true);
    async function fetchData() {
      setLoading(true);
      try {
        const [dashRes, perfRes] = await Promise.all([
          fetch('/api/dashboard'),
          fetch('/api/analytics/user-performance')
        ]);

        if (!dashRes.ok) {
            const errorData = await dashRes.json();
            throw new Error(errorData.message || 'Failed to fetch dashboard data');
        }
        
        const data = await dashRes.json();
        
        if (perfRes.ok) {
          const perfJson = await perfRes.json();
          if (perfJson.success) {
            setUserPerformance(perfJson.data);
          }
        }

        setSummary(data.summary);
        setPlatformPerformance(data.platformPerformance || []);
        setOrdersReturnsData(data.ordersReturnsData || []);
        setRecentOrders(data.recentOrders || []);
        setTopSellingProducts(data.topSellingProducts || []);

        // Financial metrics aggregation with strict number parsing
        const purchases = data.vendorPurchases || [];
        const payments = data.vendorPayments || [];
        
        const totalPurchase = purchases.reduce((sum: number, p: any) => {
            const qty = Number(p.quantity || 0);
            const cost = Number(p.cost_per_unit || 0);
            return sum + (qty * cost);
        }, 0);

        const totalPaid = payments.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
        
        setTotalDueAllVendors(totalPurchase - totalPaid);
        setTotalInventoryValue(totalPurchase);

      } catch (error: any) {
        toast({
          variant: 'destructive',
          title: 'Error fetching dashboard data',
          description: error.message,
        });
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [toast]);
  

  return (
    <div className="p-6 md:p-8 space-y-6 bg-gray-50/50 dark:bg-black/50">
       <div className="grid gap-6 md:grid-cols-2">
        <div className="bg-gradient-to-r from-red-500 to-orange-600 text-white rounded-2xl p-6 shadow-lg">
          {loading ? (
            <div className="flex items-center justify-between">
              <div>
                <Skeleton className="h-5 w-48 bg-white/20" />
                <Skeleton className="h-10 w-32 mt-2 bg-white/20" />
              </div>
              <Skeleton className="h-14 w-14 rounded-full bg-white/20 opacity-20" />
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                  <h3 className="text-sm font-medium">Total Due Across Vendors</h3>
                  <div className="text-4xl font-bold font-headline mt-1">{isMounted ? formatINR(totalDueAllVendors) : '...'}</div>
                  <p className="text-xs text-white/80">
                    {totalDueAllVendors > 0 ? "Outstanding Payable" : "All Vendors Settled"}
                  </p>
              </div>
              <div className="p-3 bg-white/20 rounded-full">
                  <Wallet className="h-6 w-6 text-white" />
              </div>
            </div>
          )}
        </div>

        <div className="bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-2xl p-6 shadow-lg">
          {loading ? (
            <div className="flex items-center justify-between">
              <div>
                <Skeleton className="h-5 w-56 bg-white/20" />
                <Skeleton className="h-10 w-32 mt-2 bg-white/20" />
              </div>
              <Skeleton className="h-14 w-14 rounded-full bg-white/20 opacity-20" />
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium">Total Inventory Purchase Value</h3>
                <div className="text-4xl font-bold font-headline mt-1">{isMounted ? formatINR(totalInventoryValue) : '...'}</div>
                <p className="text-xs text-white/80">
                    {totalInventoryValue > 0 ? "Capital Invested in Stock" : "No Inventory in Stock"}
                </p>
              </div>
               <div className="p-3 bg-white/20 rounded-full">
                  <Archive className="h-6 w-6 text-white" />
              </div>
            </div>
          )}
        </div>
      </div>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Total Units Sold"
          value={loading || !isMounted ? '...' : (Number(summary?.total_units || 0)).toLocaleString('en-IN')}
          icon={Package}
          gradient="from-purple-500 to-indigo-600"
          loading={loading}
        />
        <KpiCard
          title="Gross Revenue"
          value={loading || !isMounted ? '...' : formatINR(summary?.gross_revenue || 0)}
          icon={CircleDollarSign}
          gradient="from-cyan-500 to-blue-600"
          loading={loading}
        />
        <KpiCard
          title="Net Profit"
          value={loading || !isMounted ? '...' : formatINR(summary?.net_profit || 0)}
          icon={TrendingUp}
          gradient="from-emerald-500 to-green-600"
          loading={loading}
        />
        <ReturnRateCard rate={summary?.return_rate || 0} loading={loading} />
      </div>

      <div className="grid gap-6 md:grid-cols-3">
          {['Meesho', 'Flipkart', 'Amazon'].map(p => {
              const data = platformPerformance.find(item => item.platform === p);
              const totalUnits = Number(summary?.total_units) || 1;
              return (
                  <PlatformPerformanceCard 
                      key={p}
                      platform={p as 'Meesho' | 'Flipkart' | 'Amazon'}
                      units={Number(data?.total_units || 0)}
                      revenue={Number(data?.total_revenue || 0)}
                      totalUnits={totalUnits}
                      loading={loading}
                  />
              );
          })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <OrdersVsReturnsCard data={ordersReturnsData} loading={loading} />
        <ChannelPerformanceCard data={platformPerformance} loading={loading} />
      </div>

      <TopSellingProductsCard products={topSellingProducts} loading={loading} />
      
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
                  <TableHead>Product Name</TableHead>
                  <TableHead className="text-center">Quantity</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading || !isMounted ? (
                   Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i} className="hover:bg-transparent">
                        <TableCell colSpan={7}><Skeleton className="h-8 w-full" /></TableCell>
                      </TableRow>
                    ))
                ) : recentOrders.length > 0 ? (
                  recentOrders.map((order) => (
                    <TableRow key={order.id} className="hover:bg-gray-50/50 dark:hover:bg-white/5">
                      <TableCell>{new Date(order.created_at).toLocaleDateString('en-IN')}</TableCell>
                      <TableCell><Badge variant="secondary">{order.platform}</Badge></TableCell>
                      <TableCell className="font-medium">{order.variant_sku || 'N/A'}</TableCell>
                      <TableCell>{(order as any).product_name || 'N/A'}</TableCell>
                      <TableCell className="text-center">{Number(order.quantity || 0)}</TableCell>
                      <TableCell className="text-right">{formatINR(order.total_amount)}</TableCell>
                      <TableCell className="text-center"><Badge>Shipped</Badge></TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center h-24">No recent orders.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl shadow-md bg-white/70 dark:bg-black/20 backdrop-blur-sm border-0">
        <CardHeader>
          <CardTitle>User Performance</CardTitle>
          <CardDescription>Task completion rates per user.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading || !isMounted ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <div className="space-y-4">
              {userPerformance.length > 0 ? userPerformance.map((u) => (
                <div
                  key={u.id}
                  className="flex justify-between items-center border-b border-border/50 pb-3 last:border-0 last:pb-0"
                >
                  <div>
                    <div className="font-semibold text-foreground">{u.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {u.completed_tasks} / {u.total_tasks} tasks completed
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <div className="text-xl font-bold font-headline text-primary">
                      {u.completion_rate}%
                    </div>
                    <div className="w-32 h-1.5 bg-muted rounded-full overflow-hidden mt-1">
                      <div 
                        className="h-full bg-primary" 
                        style={{ width: `${u.completion_rate}%` }}
                      />
                    </div>
                  </div>
                </div>
              )) : (
                <div className="text-center py-6 text-muted-foreground">
                  No performance data available.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
