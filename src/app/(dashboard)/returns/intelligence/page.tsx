"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/apiFetch';
import { format } from 'date-fns';
import { 
  Undo2, 
  ArrowUpRight, 
  ArrowDownRight, 
  AlertTriangle, 
  TrendingDown, 
  Activity,
  BarChart3
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { IntelligenceFilters } from './components/intelligence-filters';
import { IntelligenceCharts } from './components/intelligence-charts';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { formatINR } from '@/lib/format';
import { cn } from '@/lib/utils';

export default function ReturnsIntelligencePage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  
  // Filter States
  const [platform, setPlatform] = useState('all');
  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState<{ from?: string; to?: string }>({
    from: format(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
    to: format(new Date(), 'yyyy-MM-dd')
  });

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (platform !== 'all') params.append('platform', platform);
      if (search) params.append('search', search);
      if (dateRange.from) params.append('from', dateRange.from);
      if (dateRange.to) params.append('to', dateRange.to);

      const res = await apiFetch(`/api/returns/analytics?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      } else {
        throw new Error('Failed to load analytics');
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setLoading(false);
    }
  }, [platform, search, dateRange, toast]);

  useEffect(() => {
    const handler = setTimeout(() => {
      fetchAnalytics();
    }, 300);
    return () => clearTimeout(handler);
  }, [fetchAnalytics]);

  const stats = data?.summary || {};

  return (
    <div className="p-6 md:p-8 space-y-8 bg-gray-50/50 dark:bg-black/50 min-h-full font-body">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-4xl font-black tracking-tighter font-headline flex items-center gap-3">
            <div className="p-2.5 bg-primary rounded-2xl shadow-lg shadow-primary/20">
              <Activity className="h-7 w-7 text-white" />
            </div>
            Returns Intelligence
          </h1>
          <p className="text-muted-foreground font-medium mt-1">Deep analysis of marketplace reverse logistics and financial leakage.</p>
        </div>
      </div>

      <IntelligenceFilters 
        platform={platform}
        onPlatformChange={setPlatform}
        search={search}
        onSearchChange={setSearch}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
      />

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KpiCard 
          title="Total Returns" 
          value={stats.total_returns?.toLocaleString() || '0'} 
          icon={Undo2} 
          loading={loading}
          description="Units processed"
          gradient="from-slate-500 to-slate-700"
        />
        <KpiCard 
          title="Return Rate" 
          value={`${stats.return_rate || 0}%`} 
          icon={AlertTriangle} 
          loading={loading}
          description="Returns vs Sales"
          gradient="from-rose-500 to-orange-600"
          isBad={Number(stats.return_rate) > 15}
        />
        <KpiCard 
          title="RTO Rate" 
          value={`${stats.rto_rate || 0}%`} 
          icon={TrendingDown} 
          loading={loading}
          description="Courier non-delivery"
          gradient="from-blue-500 to-indigo-600"
        />
        <KpiCard 
          title="Customer Return" 
          value={`${stats.customer_return_rate || 0}%`} 
          icon={ArrowUpRight} 
          loading={loading}
          description="Post-delivery returns"
          gradient="from-amber-500 to-orange-600"
        />
      </div>

      <IntelligenceCharts data={data} loading={loading} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Highest Return Rate SKUs */}
        <Card className="border-0 shadow-xl rounded-[2rem] overflow-hidden bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="font-headline text-xl">High Risk SKUs</CardTitle>
            <CardDescription>Top products with the highest return-to-order ratio.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-2xl border border-border/50 overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="text-[10px] uppercase font-black">SKU</TableHead>
                    <TableHead className="text-right text-[10px] uppercase font-black">Orders</TableHead>
                    <TableHead className="text-right text-[10px] uppercase font-black">Returns</TableHead>
                    <TableHead className="text-right text-[10px] uppercase font-black">Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}><TableCell colSpan={4}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                  )) : (data?.sku_return_rate || []).map((item: any) => (
                    <TableRow key={item.sku} className="hover:bg-primary/5 transition-colors">
                      <TableCell className="font-bold text-xs py-4">{item.sku}</TableCell>
                      <TableCell className="text-right font-medium text-xs">{item.orders}</TableCell>
                      <TableCell className="text-right font-medium text-xs">{item.returns}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={item.return_rate > 20 ? 'destructive' : 'secondary'} className="text-[10px] font-black">
                          {item.return_rate}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Platform Return Loss */}
        <Card className="border-0 shadow-xl rounded-[2rem] overflow-hidden bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="font-headline text-xl">Platform Return Leakage</CardTitle>
            <CardDescription>Estimated total loss including shipping and damage fees.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-2xl border border-border/50 overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="text-[10px] uppercase font-black">Platform</TableHead>
                    <TableHead className="text-right text-[10px] uppercase font-black">Returns</TableHead>
                    <TableHead className="text-right text-[10px] uppercase font-black">Total Loss</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}><TableCell colSpan={3}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                  )) : (data?.platform_loss || []).map((item: any) => (
                    <TableRow key={item.platform} className="hover:bg-primary/5 transition-colors">
                      <TableCell className="py-4">
                        <Badge variant="outline" className="text-[10px] font-black uppercase">{item.platform}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium text-xs">{item.returns}</TableCell>
                      <TableCell className="text-right font-black text-rose-600 dark:text-rose-400">
                        {formatINR(item.total_loss)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({ title, value, icon: Icon, loading, description, gradient, isBad }: any) {
  return (
    <Card className="border-0 shadow-xl rounded-[2rem] overflow-hidden group">
      <CardContent className="p-6 relative">
        <div className={cn("absolute inset-0 opacity-[0.03] bg-gradient-to-br transition-opacity group-hover:opacity-[0.06]", gradient)} />
        <div className="flex justify-between items-start relative z-10">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">{title}</p>
            {loading ? <Skeleton className="h-10 w-24" /> : (
              <h3 className={cn("text-3xl font-black font-headline tracking-tighter", isBad ? "text-rose-600" : "text-foreground")}>
                {value}
              </h3>
            )}
            <p className="text-[10px] font-bold text-muted-foreground mt-1 opacity-60 uppercase">{description}</p>
          </div>
          <div className={cn("p-3 rounded-2xl shadow-lg transition-transform group-hover:scale-110", gradient, "text-white")}>
            <Icon className="h-5 w-5" strokeWidth={2.5} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
