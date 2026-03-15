"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Card, CardHeader, TableFooter, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, FilterX, BarChart4, ArrowUpRight, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/apiFetch';
import { cn } from '@/lib/utils';

export function SkuPerformanceTable() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any[]>([]);
  
  // Filters
  const [search, setSearch] = useState('');
  const [platform, setPlatform] = useState('all');
  const [rateRange, setRateRange] = useState('all');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (platform !== 'all') params.append('platform', platform);
      
      if (rateRange !== 'all') {
        const [min, max] = rateRange.split('-');
        if (min) params.append('minRate', min);
        if (max) params.append('maxRate', max);
      }

      const res = await apiFetch(`/api/analytics/returns/sku-performance?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setData(json.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch SKU performance", error);
    } finally {
      setLoading(false);
    }
  }, [search, platform, rateRange]);

  useEffect(() => {
    const handler = setTimeout(() => fetchData(), 400);
    return () => clearTimeout(handler);
  }, [fetchData]);

  const resetFilters = () => {
    setSearch('');
    setPlatform('all');
    setRateRange('all');
  };

  const getRateColor = (rate: number) => {
    if (rate > 30) return "text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/20 border-rose-200 font-black";
    if (rate > 10) return "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border-amber-200 font-bold";
    return "text-emerald-600 dark:text-emerald-400 font-medium";
  };

  return (
    <Card className="border-0 shadow-2xl rounded-[2rem] overflow-hidden bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl">
      <CardHeader className="p-8 pb-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 rounded-2xl text-primary shadow-inner">
              <BarChart4 className="h-6 w-6" />
            </div>
            <div>
              <CardTitle className="font-headline text-2xl font-bold tracking-tight">SKU Performance Registry</CardTitle>
              <CardDescription className="text-xs font-medium text-muted-foreground uppercase tracking-wider mt-0.5">Return behavior analysis per marketplace item.</CardDescription>
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-8">
          <div className="relative md:col-span-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search SKU..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-11 bg-background/50 rounded-xl border-border/50"
            />
          </div>
          
          <Select value={platform} onValueChange={setPlatform}>
            <SelectTrigger className="h-11 rounded-xl bg-background/50 border-border/50">
              <SelectValue placeholder="Platform" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Platforms</SelectItem>
              <SelectItem value="Meesho">Meesho</SelectItem>
              <SelectItem value="Flipkart">Flipkart</SelectItem>
              <SelectItem value="Amazon">Amazon</SelectItem>
            </SelectContent>
          </Select>

          <Select value={rateRange} onValueChange={setRateRange}>
            <SelectTrigger className="h-11 rounded-xl bg-background/50 border-border/50">
              <SelectValue placeholder="Return Rate %" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any Return Rate</SelectItem>
              <SelectItem value="0-5">Healthy (0-5%)</SelectItem>
              <SelectItem value="5-10">Attention (5-10%)</SelectItem>
              <SelectItem value="10-20">Warning (10-20%)</SelectItem>
              <SelectItem value="20-30">Critical (20-30%)</SelectItem>
              <SelectItem value="30-100">High Risk (30%+)</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="ghost" onClick={resetFilters} className="h-11 rounded-xl hover:bg-rose-500/10 hover:text-rose-500">
            <FilterX className="mr-2 h-4 w-4" /> Reset Filters
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-8 pt-4">
        <div className="rounded-2xl border border-border/50 overflow-hidden bg-background/40">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow className="border-border/50 hover:bg-transparent h-14">
                <TableHead className="px-6 font-bold text-[10px] uppercase tracking-[0.2em]">Product / SKU</TableHead>
                <TableHead className="px-6 font-bold text-[10px] uppercase tracking-[0.2em]">Platform</TableHead>
                <TableHead className="px-6 text-center font-bold text-[10px] uppercase tracking-[0.2em]">Orders</TableHead>
                <TableHead className="px-6 text-center font-bold text-[10px] uppercase tracking-[0.2em]">Returns</TableHead>
                <TableHead className="px-6 text-center font-bold text-[10px] uppercase tracking-[0.2em]">Return %</TableHead>
                <TableHead className="px-6 text-center font-bold text-[10px] uppercase tracking-[0.2em]">Customer</TableHead>
                <TableHead className="px-6 text-center font-bold text-[10px] uppercase tracking-[0.2em]">RTO</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}><TableCell colSpan={7} className="px-6 py-4"><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                ))
              ) : data.length > 0 ? (
                data.map((row, idx) => (
                  <TableRow key={`${row.sku}-${row.platform}`} className="border-border/50 hover:bg-primary/5 transition-colors group">
                    <TableCell className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-black text-xs text-foreground group-hover:text-primary transition-colors">{row.sku}</span>
                        <span className="text-[10px] text-muted-foreground font-medium truncate max-w-[200px]">{row.product_name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="px-6">
                      <Badge variant="outline" className="text-[9px] font-black uppercase tracking-tighter bg-white shadow-sm border-border/50">
                        {row.platform}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-6 text-center font-bold text-xs">{row.total_orders}</TableCell>
                    <TableCell className="px-6 text-center font-black text-xs text-rose-600">{row.total_returns}</TableCell>
                    <TableCell className="px-6 text-center">
                      <div className={cn("inline-flex items-center px-2.5 py-1 rounded-lg border text-xs", getRateColor(row.return_percent))}>
                        {row.return_percent}%
                      </div>
                    </TableCell>
                    <TableCell className="px-6 text-center text-xs font-bold text-muted-foreground">{row.customer_returns}</TableCell>
                    <TableCell className="px-6 text-center text-xs font-bold text-muted-foreground">{row.rto_returns}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="h-48 text-center text-muted-foreground italic">No performance data matches your criteria.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
