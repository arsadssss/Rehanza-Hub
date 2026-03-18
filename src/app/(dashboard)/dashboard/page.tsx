
"use client";

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { formatINR } from '@/lib/format';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Wallet, 
  Archive, 
  TrendingUp, 
  TrendingDown, 
  ShoppingCart, 
  Undo2, 
  Zap, 
  Target, 
  BarChart3,
  Activity,
  AlertCircle,
  Package,
  ArrowUpRight,
  Sparkles,
  RefreshCw,
  LayoutDashboard,
  Calendar,
  CheckCircle2,
  Clock,
  ShieldCheck
} from 'lucide-react';
import { apiFetch } from '@/lib/apiFetch';
import { TaskPerformanceCard, type TrackRecordEntry } from '@/components/TaskPerformanceCard';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  LineChart, 
  Line,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from 'next/link';

// --- Sub-components for cleaner structure ---

const AnimatedValue = ({ value, prefix = "", suffix = "", isCurrency = false }: { value: number, prefix?: string, suffix?: string, isCurrency?: boolean }) => {
  const [displayValue, setDisplayValue] = useState(0);
  
  useEffect(() => {
    let start = 0;
    const end = value;
    if (start === end) return;
    const totalDuration = 1000;
    const increment = end / (totalDuration / 16);
    
    const timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        setDisplayValue(end);
        clearInterval(timer);
      } else {
        setDisplayValue(start);
      }
    }, 16);
    return () => clearInterval(timer);
  }, [value]);

  if (isCurrency) return <span>{formatINR(displayValue)}</span>;
  return <span>{prefix}{Math.floor(displayValue).toLocaleString()}{suffix}</span>;
};

const KpiCard = ({ title, value, icon: Icon, description, gradient, loading, isCurrency = false, trend, suffix = "" }: any) => (
  <Card className="relative overflow-hidden border-0 shadow-xl rounded-[2rem] bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl group hover:-translate-y-1 transition-all duration-300 h-full">
    <div className={cn("absolute inset-0 opacity-5 group-hover:opacity-10 transition-opacity bg-gradient-to-br", gradient)} />
    <CardContent className="p-6 relative z-10">
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">{title}</p>
          {loading ? <Skeleton className="h-10 w-24 bg-muted/40" /> : (
            <h2 className="text-3xl font-black font-headline tracking-tighter">
              <AnimatedValue value={value} isCurrency={isCurrency} suffix={suffix} />
            </h2>
          )}
        </div>
        <div className={cn("p-3 rounded-2xl shadow-lg shadow-black/5", gradient.replace('from-', 'bg-').split(' ')[0], "text-white")}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2">
        {trend && (
          <div className={cn(
            "flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold",
            trend > 0 ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600"
          )}>
            {trend > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {Math.abs(trend)}%
          </div>
        )}
        <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">{description}</p>
      </div>
    </CardContent>
  </Card>
);

const InsightCard = ({ title, subtitle, icon: Icon, colorClass }: any) => (
  <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/10 dark:bg-white/5 border border-white/20 backdrop-blur-sm hover:bg-white/20 transition-all duration-300">
    <div className={cn("p-2.5 rounded-xl", colorClass)}>
      <Icon className="h-4 w-4" />
    </div>
    <div className="overflow-hidden">
      <p className="text-[10px] font-black uppercase tracking-widest text-white/70">{title}</p>
      <p className="text-xs font-bold truncate text-white">{subtitle}</p>
    </div>
  </div>
);

// --- Main Dashboard Page ---

export default function DashboardPage() {
  const { toast } = useToast();
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState('30d');

  // Data States
  const [summary, setSummary] = useState<any>(null);
  const [salesTrend, setSalesTrend] = useState<any[]>([]);
  const [platformStats, setPlatformStats] = useState<any[]>([]);
  const [trackRecord, setTrackRecord] = useState<TrackRecordEntry[]>([]);
  const [taskProgress, setTaskProgress] = useState<any>(null);
  const [topSellers, setTopSellers] = useState<any[]>([]);
  const [inventoryValue, setInventoryValue] = useState(0);
  const [returnStats, setReturnStats] = useState<any>(null);

  const fetchAllData = useCallback(async () => {
    if (!activeAccountId) return;
    setLoading(true);
    try {
      const [dashRes, analyticsRes, vendorRes, trackRes, taskRes, returnRes] = await Promise.all([
        apiFetch('/api/dashboard'),
        apiFetch(`/api/analytics?range=${range}`),
        apiFetch('/api/vendors/summary'),
        apiFetch('/api/tasks/track-record'),
        apiFetch('/api/tasks?pageSize=1'),
        apiFetch('/api/analytics/returns')
      ]);

      if (dashRes.ok) {
        const d = await dashRes.json();
        setSummary(d.summary);
        setTopSellers(d.topSellingProducts || []);
      }
      
      if (analyticsRes.ok) {
        const a = await analyticsRes.json();
        setSalesTrend(a.salesTrend || []);
        setPlatformStats(a.platformOrders?.breakdown || []);
      }

      if (vendorRes.ok) {
        const v = await vendorRes.json();
        setInventoryValue(v.totalInventoryValue || 0);
      }

      if (trackRes.ok) {
        const t = await trackRes.json();
        setTrackRecord(t.data || []);
      }

      if (taskRes.ok) {
        const tr = await taskRes.json();
        setTaskProgress(tr.progress);
      }

      if (returnRes.ok) {
        const rs = await returnRes.json();
        setReturnStats(rs);
      }

    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Intelligence Offline', description: error.message });
    } finally {
      setLoading(false);
    }
  }, [activeAccountId, toast, range]);

  useEffect(() => {
    setIsMounted(true);
    const id = sessionStorage.getItem("active_account");
    if (id) setActiveAccountId(id);

    const handleAccountInit = () => {
      const freshId = sessionStorage.getItem("active_account");
      if (freshId) setActiveAccountId(freshId);
    };

    window.addEventListener('active-account-changed', handleAccountInit);
    return () => window.removeEventListener('active-account-changed', handleAccountInit);
  }, []);

  useEffect(() => {
    if (activeAccountId) fetchAllData();
  }, [activeAccountId, fetchAllData]);

  const platformColors: Record<string, string> = {
    'Meesho': '#FF4FA3',
    'Flipkart': '#FFC107',
    'Amazon': '#FF9900'
  };

  const totalPlatformOrders = useMemo(() => {
    return platformStats.reduce((sum, p) => sum + p.orders, 0);
  }, [platformStats]);

  const topPlatform = useMemo(() => {
    if (!platformStats.length) return null;
    return [...platformStats].sort((a, b) => b.orders - a.orders)[0];
  }, [platformStats]);

  if (!isMounted) return null;

  return (
    <div className="p-6 md:p-10 space-y-10 bg-gray-50/50 dark:bg-black/50 min-h-screen font-body">
      
      {/* 1. Page Header & Global Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2.5 bg-primary rounded-2xl shadow-xl shadow-primary/20 text-white">
              <LayoutDashboard className="h-6 w-6" />
            </div>
            <h1 className="text-4xl font-black tracking-tighter font-headline">Command Center</h1>
          </div>
          <p className="text-muted-foreground font-medium ml-1">Real-time operational intelligence and execution backlog.</p>
        </div>
        <div className="flex gap-3">
          <Badge variant="outline" className="h-11 px-4 rounded-xl bg-white/50 backdrop-blur-sm border-border/50 font-bold text-xs uppercase tracking-widest flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Live Sync: Online
          </Badge>
          <Button onClick={fetchAllData} variant="outline" size="icon" className="h-11 w-11 rounded-xl bg-white/50 backdrop-blur-sm border-border/50 hover:bg-white transition-all">
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* 2. Top KPI Layer - Responsive Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <KpiCard 
          title="Revenue" 
          value={summary?.gross_revenue || 0} 
          icon={ShoppingCart} 
          description="30D Performance" 
          gradient="from-indigo-600 to-violet-700" 
          loading={loading} 
          isCurrency 
          trend={12}
        />
        <KpiCard 
          title="Return Rate" 
          value={summary?.return_rate || 0} 
          icon={Undo2} 
          description="Operational Loss" 
          gradient="from-rose-500 to-red-600" 
          loading={loading} 
          suffix="%"
          trend={-2}
        />
        <KpiCard 
          title="Return Units" 
          value={returnStats?.summary?.total_returns || 0} 
          icon={Archive} 
          description="Total Reversed" 
          gradient="from-amber-500 to-orange-600" 
          loading={loading} 
        />
        <KpiCard 
          title="Active Tasks" 
          value={(taskProgress?.overall?.total || 0) - (taskProgress?.overall?.completed || 0)} 
          icon={Zap} 
          description="Pending Execution" 
          gradient="from-blue-600 to-cyan-700" 
          loading={loading} 
        />
        <KpiCard 
          title="Net Profit" 
          value={summary?.net_profit || 0} 
          icon={Target} 
          description="Post-Cost Ledger" 
          gradient="from-emerald-500 to-teal-600" 
          loading={loading} 
          isCurrency
          trend={5}
        />
        <KpiCard 
          title="Inventory Value" 
          value={inventoryValue} 
          icon={Package} 
          description="Capital Invested" 
          gradient="from-slate-700 to-slate-900" 
          loading={loading} 
          isCurrency
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Row 1: Growth Analytics & Smart Insights */}
        <Card className="lg:col-span-8 border-0 shadow-2xl rounded-[2.5rem] overflow-hidden bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl h-full">
          <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-8 pb-0 gap-4">
            <div>
              <CardTitle className="font-headline text-2xl font-black tracking-tight">Growth Analytics</CardTitle>
              <CardDescription className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">Revenue and order volume trends</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <Select value={range} onValueChange={setRange}>
                <SelectTrigger className="w-[140px] h-9 rounded-xl bg-muted/30 border-0 font-bold text-[10px] uppercase tracking-widest focus:ring-primary/20">
                  <Calendar className="h-3 w-3 mr-2 text-primary" />
                  <SelectValue placeholder="Range" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-border/50">
                  <SelectItem value="7d" className="text-[10px] font-bold uppercase">Last 7 Days</SelectItem>
                  <SelectItem value="30d" className="text-[10px] font-bold uppercase">Last 30 Days</SelectItem>
                  <SelectItem value="all" className="text-[10px] font-bold uppercase">All Time</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-4 border-l border-border/50 pl-4">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-primary" />
                  <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Orders</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-emerald-500" />
                  <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Revenue</span>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-8">
            <div className="h-[350px] w-full mt-4">
              {loading ? <Skeleton className="h-full w-full rounded-3xl" /> : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={salesTrend}>
                    <defs>
                      <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 10, fill: 'gray', fontBold: 700 }} 
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(val) => new Date(val).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
                    />
                    <YAxis tick={{ fontSize: 10, fill: 'gray', fontBold: 700 }} axisLine={false} tickLine={false} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 50px rgba(0,0,0,0.1)', backdropFilter: 'blur(10px)', backgroundColor: 'rgba(255,255,255,0.8)' }}
                    />
                    <Area type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={4} fillOpacity={1} fill="url(#colorRev)" />
                    <Line type="monotone" dataKey="orders" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981', strokeWidth: 0 }} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-4 border-0 shadow-2xl rounded-[2.5rem] overflow-hidden bg-gradient-to-br from-[#4F46E5] to-[#6D28D9] text-white h-full">
          <CardHeader className="p-8">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-white/10 rounded-xl">
                <BarChart3 className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle className="font-headline text-xl font-bold text-white">Smart Insights</CardTitle>
                <CardDescription className="text-[10px] uppercase font-bold tracking-widest text-white/60">AI-Assisted Business Logic</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-8 pb-8 space-y-4">
            <InsightCard 
              title="Operational Risk" 
              subtitle={summary?.return_rate > 15 ? "High returns detected" : "Return rate within safety limits"} 
              icon={AlertCircle} 
              colorClass={summary?.return_rate > 15 ? "bg-rose-500/30 text-rose-100" : "bg-emerald-500/30 text-emerald-100"}
            />
            <InsightCard 
              title="Top Performer" 
              subtitle={topSellers[0]?.product_name || "Syncing data..."} 
              icon={TrendingUp} 
              colorClass="bg-white/20 text-white"
            />
            <InsightCard 
              title="Execution Queue" 
              subtitle={`${(taskProgress?.overall?.total || 0) - (taskProgress?.overall?.completed || 0)} tasks need attention`} 
              icon={Zap} 
              colorClass="bg-amber-500/30 text-amber-100"
            />
          </CardContent>
        </Card>

        {/* Row 2: Execution Health */}
        <Card className="md:col-span-6 lg:col-span-4 border-0 shadow-2xl rounded-[2.5rem] overflow-hidden bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl h-full flex flex-col">
          <CardHeader className="p-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-500/10 rounded-xl text-blue-600">
                  <Activity className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="font-headline text-xl font-bold">Execution Health</CardTitle>
                  <CardDescription className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground/60">Real-time workflow progress</CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[9px] font-black text-emerald-600 uppercase">Healthy</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-8 pb-8 space-y-8 flex-1">
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between items-end">
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Fashion Workflow</span>
                  <span className="text-sm font-black">{taskProgress?.fashion?.percentage.toFixed(0)}%</span>
                </div>
                <Progress value={taskProgress?.fashion?.percentage} className="h-2 bg-blue-500/10" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-end">
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Cosmetics Workflow</span>
                  <span className="text-sm font-black">{taskProgress?.cosmetics?.percentage.toFixed(0)}%</span>
                </div>
                <Progress value={taskProgress?.cosmetics?.percentage} className="h-2 bg-pink-500/10" />
              </div>
            </div>

            {/* Micro Stats Row */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-2xl bg-muted/30 border border-border/50 text-center">
                <CheckCircle2 className="h-3.5 w-3.5 mx-auto mb-1.5 text-emerald-500" />
                <p className="text-[14px] font-black leading-none">{taskProgress?.overall?.completed || 0}</p>
                <p className="text-[8px] font-bold text-muted-foreground uppercase mt-1">Success</p>
              </div>
              <div className="p-3 rounded-2xl bg-muted/30 border border-border/50 text-center">
                <Clock className="h-3.5 w-3.5 mx-auto mb-1.5 text-blue-500" />
                <p className="text-[14px] font-black leading-none">{(taskProgress?.overall?.total || 0) - (taskProgress?.overall?.completed || 0)}</p>
                <p className="text-[8px] font-bold text-muted-foreground uppercase mt-1">Pending</p>
              </div>
              <div className="p-3 rounded-2xl bg-muted/30 border border-border/50 text-center">
                <Target className="h-3.5 w-3.5 mx-auto mb-1.5 text-indigo-500" />
                <p className="text-[14px] font-black leading-none">{taskProgress?.overall?.total || 0}</p>
                <p className="text-[8px] font-bold text-muted-foreground uppercase mt-1">Registry</p>
              </div>
            </div>

            {/* Total Completion Donut Chart */}
            <div className="flex items-center gap-6 p-5 rounded-3xl bg-indigo-600/5 border border-indigo-600/10">
              <div className="relative h-16 w-16 shrink-0">
                <svg className="h-full w-full" viewBox="0 0 36 36">
                  <path className="text-indigo-100 stroke-current" strokeWidth="3" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                  <path className="text-indigo-600 stroke-current" strokeWidth="3" strokeDasharray={`${taskProgress?.overall?.percentage || 0}, 100`} strokeLinecap="round" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[10px] font-black">{(taskProgress?.overall?.percentage || 0).toFixed(0)}%</span>
                </div>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600">Global Completion</p>
                <p className="text-[11px] font-bold text-muted-foreground leading-tight mt-0.5">Average across all business verticals.</p>
              </div>
            </div>

            <Button asChild variant="outline" className="w-full h-12 rounded-xl font-bold mt-auto group transition-all hover:bg-primary hover:text-white hover:shadow-lg hover:shadow-primary/20">
              <Link href="/tasks" className="flex items-center justify-center">
                Open Task Engine 
                <ArrowUpRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Row 2: Marketplace Power */}
        <Card className="md:col-span-6 lg:col-span-4 border-0 shadow-2xl rounded-[2.5rem] overflow-hidden bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl h-full flex flex-col">
          <CardHeader className="p-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-600">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="font-headline text-xl font-bold">Marketplace Power</CardTitle>
                  <CardDescription className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground/60">Sales distribution by channel</CardDescription>
                </div>
              </div>
              {topPlatform && (
                <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[9px] font-black uppercase px-2.5 py-1">
                  {topPlatform.platform} Leading
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="px-8 pb-8 space-y-8 flex-1">
            <div className="flex items-center justify-between">
              <div className="h-[160px] w-[160px]">
                {loading ? <Skeleton className="h-full w-full rounded-full" /> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={platformStats}
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={5}
                        dataKey="orders"
                      >
                        {platformStats.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={platformColors[entry.platform] || '#8884d8'} stroke="none" />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
              <div className="space-y-3 flex-1 ml-8">
                {platformStats.map((p) => (
                  <div key={p.platform} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: platformColors[p.platform] }} />
                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{p.platform}</span>
                      </div>
                      <span className="text-xs font-black">{p.orders}</span>
                    </div>
                    <Progress value={(p.orders / (totalPlatformOrders || 1)) * 100} className="h-1 bg-muted" />
                  </div>
                ))}
              </div>
            </div>

            {/* Platform Mini Stats */}
            <div className="grid grid-cols-1 gap-2">
              {platformStats.map((p) => {
                const percentage = ((p.orders / (totalPlatformOrders || 1)) * 100).toFixed(0);
                return (
                  <div key={p.platform} className="flex items-center justify-between p-3.5 rounded-2xl bg-muted/20 border border-border/50 hover:bg-muted/40 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-xl flex items-center justify-center text-white shadow-sm" style={{ backgroundColor: platformColors[p.platform] }}>
                        <ShoppingCart className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-[11px] font-black text-foreground">{p.platform}</p>
                        <p className="text-[9px] font-bold text-muted-foreground uppercase">{percentage}% Dominance</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-emerald-600 font-bold text-[10px]">
                      <TrendingUp className="h-3 w-3" /> +{(Math.random() * 15 + 5).toFixed(1)}%
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Insight Tag */}
            <div className="p-4 rounded-[1.5rem] bg-emerald-500/5 border border-emerald-500/10 flex items-center gap-3">
              <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-600">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div className="overflow-hidden">
                <p className="text-[10px] font-black uppercase text-emerald-600 tracking-[0.1em]">Performance Insight</p>
                <p className="text-[11px] font-bold text-muted-foreground truncate">
                  {topPlatform ? `${topPlatform.platform} is driving ${(topPlatform.orders / (totalPlatformOrders || 1) * 100).toFixed(0)}% of total volume.` : "Analyzing channel dominance..."}
                </p>
              </div>
            </div>

            <div className="mt-auto pt-4 flex items-center justify-between border-t border-border/50">
              <div>
                <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest leading-none">Total Value Dispatched</p>
                <p className="text-lg font-black tracking-tighter mt-1">{formatINR(summary?.gross_revenue || 0)}</p>
              </div>
              <Button variant="ghost" size="sm" asChild className="text-[10px] font-black uppercase hover:bg-indigo-50 hover:text-indigo-600 rounded-xl">
                <Link href="/analytics">Detailed Report <ChevronRight className="ml-1 h-3 w-3" /></Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Row 2: Top Sellers - Updated to top 7 */}
        <Card className="md:col-span-12 lg:col-span-4 border-0 shadow-2xl rounded-[2.5rem] overflow-hidden bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl h-full">
          <CardHeader className="p-8 border-b border-border/50">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="font-headline text-xl font-bold">Top Sellers</CardTitle>
                <CardDescription className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground/60">Inventory Velocity Leaders</CardDescription>
              </div>
              <Button variant="ghost" size="icon" asChild className="rounded-xl"><Link href="/products"><ArrowUpRight className="h-4 w-4" /></Link></Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/50">
              {loading ? Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="p-6 flex items-center justify-between"><Skeleton className="h-10 w-full bg-muted/40" /></div>
              )) : topSellers.map((sku) => (
                <div key={sku.variant_sku} className="p-6 flex items-center justify-between hover:bg-muted/30 transition-colors">
                  <div className="overflow-hidden">
                    <p className="text-xs font-black truncate">{sku.product_name}</p>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">{sku.variant_sku}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black">{sku.total_units_sold} units</p>
                    <p className="text-[10px] font-bold text-emerald-600">{formatINR(sku.total_revenue)}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

      </div>

      {/* 6. Team Performance Integration (Full Width) */}
      <TaskPerformanceCard data={trackRecord} loading={loading} />

    </div>
  );
}

import { ChevronRight } from 'lucide-react';
