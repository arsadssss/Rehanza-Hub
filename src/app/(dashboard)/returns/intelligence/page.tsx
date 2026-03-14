"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/apiFetch';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  Legend
} from 'recharts';
import { 
  Activity, 
  TrendingDown, 
  AlertTriangle, 
  PieChart as PieChartIcon, 
  BarChart3, 
  ShieldAlert,
  ArrowLeft
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { formatINR } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

const COLORS = ['#6366f1', '#f43f5e', '#fbbf24', '#10b981', '#a855f7'];

export default function ReturnsIntelligencePage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/analytics/returns');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      } else {
        throw new Error('Failed to load intelligence data');
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  return (
    <div className="p-6 md:p-8 space-y-8 bg-gray-50/50 dark:bg-black/50 min-h-full font-body">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <Button variant="ghost" asChild className="mb-4 text-muted-foreground hover:text-primary transition-colors">
            <Link href="/returns">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Returns
            </Link>
          </Button>
          <h1 className="text-4xl font-black tracking-tighter font-headline flex items-center gap-3">
            <div className="p-2.5 bg-primary rounded-2xl shadow-lg shadow-primary/20">
              <Activity className="h-7 w-7 text-white" />
            </div>
            Returns Intelligence
          </h1>
          <p className="text-muted-foreground font-medium mt-1">Advanced marketplace reverse logistics and financial analysis.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* SECTION 1: Return Rate by SKU (Table) */}
        <Card className="border-0 shadow-xl rounded-[2rem] overflow-hidden bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-rose-500/10 rounded-xl text-rose-600">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="font-headline text-xl">Return Rate by SKU</CardTitle>
                <CardDescription>Returns vs. Total Sales dispatched per product.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-2xl border border-border/50 overflow-hidden bg-background/50">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="text-[10px] uppercase font-black px-6">SKU</TableHead>
                    <TableHead className="text-right text-[10px] uppercase font-black">Sold</TableHead>
                    <TableHead className="text-right text-[10px] uppercase font-black">Ret</TableHead>
                    <TableHead className="text-right text-[10px] uppercase font-black px-6">Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}><TableCell colSpan={4} className="px-6 py-4"><Skeleton className="h-6 w-full" /></TableCell></TableRow>
                  )) : (data?.returnRateBySKU || []).slice(0, 8).map((item: any) => (
                    <TableRow key={item.sku} className="hover:bg-primary/5 transition-colors border-border/50">
                      <TableCell className="font-bold text-xs py-4 px-6 truncate max-w-[120px]">{item.sku}</TableCell>
                      <TableCell className="text-right font-medium text-xs text-muted-foreground">{item.sold_qty}</TableCell>
                      <TableCell className="text-right font-medium text-xs text-foreground">{item.return_qty}</TableCell>
                      <TableCell className="text-right px-6">
                        <Badge variant={Number(item.return_rate) > 20 ? 'destructive' : 'secondary'} className="text-[10px] font-black">
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

        {/* SECTION 2: RTO vs Customer Return % (Pie Chart) */}
        <Card className="border-0 shadow-xl rounded-[2rem] overflow-hidden bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-600">
                <PieChartIcon className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="font-headline text-xl">RTO vs. Customer Returns</CardTitle>
                <CardDescription>Behavioral split of return sources.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <div className="h-[300px] w-full mt-4">
              {loading ? <Skeleton className="h-full w-full rounded-full" /> : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data?.rtoVsCustomer || []}
                      cx="50%"
                      cy="50%"
                      innerRadius={80}
                      outerRadius={110}
                      paddingAngle={8}
                      dataKey="value"
                      nameKey="label"
                    >
                      {(data?.rtoVsCustomer || []).map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}
                    />
                    <Legend verticalAlign="bottom" height={36}/>
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        {/* SECTION 3: Platform-wise Return Loss (Bar Chart) */}
        <Card className="border-0 shadow-xl rounded-[2rem] overflow-hidden bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-rose-500/10 rounded-xl text-rose-600">
                <TrendingDown className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="font-headline text-xl">Platform Return Loss</CardTitle>
                <CardDescription>Total financial leakage (Refunds + Logistics) per channel.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[350px] w-full mt-4">
              {loading ? <Skeleton className="h-full w-full rounded-2xl" /> : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data?.platformLoss} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                    <XAxis 
                      dataKey="platform" 
                      tick={{ fontSize: 10, fill: 'gray', fontWeight: 700 }} 
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis 
                      tick={{ fontSize: 10, fill: 'gray', fontWeight: 700 }} 
                      axisLine={false} 
                      tickLine={false}
                      tickFormatter={(val) => `₹${val/1000}k`}
                    />
                    <Tooltip 
                      cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}
                      formatter={(val: any) => formatINR(val)}
                    />
                    <Bar dataKey="total_loss" fill="#f43f5e" radius={[10, 10, 0, 0]} barSize={60} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        {/* SECTION 4: Worst Products by Returns (Table) */}
        <Card className="border-0 shadow-xl rounded-[2rem] overflow-hidden bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-500/10 rounded-xl text-orange-600">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="font-headline text-xl">Top 10 Return Offenders</CardTitle>
                <CardDescription>Highest raw return volume and associated loss.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-2xl border border-border/50 overflow-hidden bg-background/50">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="text-[10px] uppercase font-black px-6">SKU</TableHead>
                    <TableHead className="text-right text-[10px] uppercase font-black">Returns</TableHead>
                    <TableHead className="text-right text-[10px] uppercase font-black px-6">Loss</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}><TableCell colSpan={3} className="px-6 py-4"><Skeleton className="h-6 w-full" /></TableCell></TableRow>
                  )) : (data?.worstProducts || []).map((item: any) => (
                    <TableRow key={item.sku} className="hover:bg-rose-500/5 transition-colors border-border/50">
                      <TableCell className="font-bold text-xs py-4 px-6 truncate max-w-[150px]">{item.sku}</TableCell>
                      <TableCell className="text-right font-black text-rose-600">{item.total_returns}</TableCell>
                      <TableCell className="text-right px-6 font-black text-rose-600/80">
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
