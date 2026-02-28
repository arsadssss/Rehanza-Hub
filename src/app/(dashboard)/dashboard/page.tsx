"use client";

import React, { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { formatINR } from '@/lib/format';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, Wallet, Archive } from 'lucide-react';
import { apiFetch } from '@/lib/apiFetch';
import { TaskPerformanceCard, type TrackRecordEntry } from '@/components/TaskPerformanceCard';
import { SalesSummaryCards } from '@/components/SalesSummaryCards';

const PlatformPerformanceCard = ({ platform, revenue, units, loading, totalUnits }: { platform: 'Meesho' | 'Flipkart' | 'Amazon', revenue: number, units: number, loading: boolean, totalUnits: number }) => {
  const share = totalUnits > 0 ? (units / totalUnits) * 100 : 0;
  if (loading) return <Skeleton className="h-[140px] w-full rounded-3xl" />
  return (
      <div className="relative overflow-hidden rounded-3xl border border-white/20 bg-white/10 p-6 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-black/20">
          <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                  <p className="font-semibold text-foreground">Platform: {platform}</p>
                  <p className="text-3xl font-bold font-headline text-foreground">{formatINR(revenue)}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <TrendingUp className="h-4 w-4 text-emerald-500" />
                      <span>{share.toFixed(1)}% of total units</span>
                  </div>
              </div>
              <div className="text-right">
                  <p className="text-xl font-bold text-foreground">{units.toLocaleString()}</p>
                  <p className="text-[10px] font-medium tracking-tight text-muted-foreground">Total Orders</p>
              </div>
          </div>
      </div>
  )
}

export default function DashboardPage() {
  const { toast } = useToast();
  const [summary, setSummary] = useState<any>(null);
  const [salesData, setSalesData] = useState<any>(null);
  const [platformPerformance, setPlatformPerformance] = useState<any[]>([]);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [trackRecord, setTrackRecord] = useState<TrackRecordEntry[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [loadingSales, setLoadingSales] = useState(true);
  const [loadingTrackRecord, setLoadingTrackRecord] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  
  const [totalDueAllVendors, setTotalDueAllVendors] = useState(0);
  const [totalInventoryValue, setTotalInventoryValue] = useState(0);

  useEffect(() => {
    setIsMounted(true);
    async function fetchData() {
      setLoading(true);
      setLoadingSales(true);
      setLoadingTrackRecord(true);
      try {
        const [dashRes, vendorRes, trackRes, salesRes] = await Promise.all([
          apiFetch('/api/dashboard'),
          apiFetch('/api/vendors/summary'),
          apiFetch('/api/tasks/track-record'),
          apiFetch('/api/analytics?range=7d')
        ]);

        if (dashRes.ok) {
          const data = await dashRes.json();
          setSummary(data.summary);
          setPlatformPerformance(data.platformPerformance || []);
          setRecentOrders(data.recentOrders || []);
        }

        if (vendorRes.ok) {
          const vData = await vendorRes.json();
          setTotalDueAllVendors(vData.totalDueAllVendors);
          setTotalInventoryValue(vData.totalInventoryValue);
        }

        if (trackRes.ok) {
          const tData = await trackRes.json();
          setTrackRecord(tData.data || []);
        }

        if (salesRes.ok) {
          const sData = await salesRes.json();
          setSalesData(sData);
        }
      } catch (error: any) {
        toast({ variant: 'destructive', title: 'Error', description: error.message });
      } finally {
        setLoading(false);
        setLoadingSales(false);
        setLoadingTrackRecord(false);
      }
    }
    fetchData();
  }, [toast]);

  return (
    <div className="p-6 md:p-8 space-y-8 bg-gray-50/50 dark:bg-black/50">
       {/* 1. Vendor + Inventory summary cards */}
       <div className="grid gap-6 md:grid-cols-2">
        <div className="bg-gradient-to-r from-red-500 to-orange-600 text-white rounded-2xl p-6 shadow-lg">
          {loading ? <Skeleton className="h-20 w-full bg-white/20" /> : (
            <div className="flex items-center justify-between">
              <div>
                  <h3 className="text-sm font-medium">Total Due Across Vendors</h3>
                  <div className="text-4xl font-bold font-headline mt-1">{isMounted ? formatINR(totalDueAllVendors) : '...'}</div>
              </div>
              <Wallet className="h-8 w-8 text-white/80" />
            </div>
          )}
        </div>
        <div className="bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-2xl p-6 shadow-lg">
          {loading ? <Skeleton className="h-20 w-full bg-white/20" /> : (
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium">Total Inventory Purchase Value</h3>
                <div className="text-4xl font-bold font-headline mt-1">{isMounted ? formatINR(totalInventoryValue) : '...'}</div>
              </div>
              <Archive className="h-8 w-8 text-white/80" />
            </div>
          )}
        </div>
      </div>

      {/* 2. Task Performance section */}
      <TaskPerformanceCard data={trackRecord} loading={loadingTrackRecord} title="Task Performance" />
      
      {/* 3. Sales metric cards */}
      <SalesSummaryCards 
        totalSales={salesData?.totalSales || 0}
        totalOrders={salesData?.totalOrders || 0}
        totalReturns={salesData?.totalReturns || 0}
        netProfit={salesData?.netProfit || 0}
        loading={loadingSales}
      />

      {/* 4. Platform Distribution cards */}
      <div className="grid gap-6 md:grid-cols-3">
          {['Meesho', 'Flipkart', 'Amazon'].map(p => {
              const data = platformPerformance.find((item: any) => item.platform === p);
              return <PlatformPerformanceCard key={p} platform={p as any} units={Number(data?.total_units || 0)} revenue={Number(data?.total_revenue || 0)} totalUnits={Number(summary?.total_units || 1)} loading={loading} />;
          })}
      </div>

      <Card className="rounded-2xl shadow-md border-0">
        <CardHeader><CardTitle>Recent Orders</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Platform</TableHead><TableHead>SKU</TableHead><TableHead>Quantity</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
            <TableBody>
              {loading ? Array.from({ length: 5 }).map((_, i) => <TableRow key={i}><TableCell colSpan={5}><Skeleton className="h-8 w-full" /></TableCell></TableRow>) : recentOrders.map((o) => (
                <TableRow key={o.id}>
                  <TableCell>{new Date(o.created_at).toLocaleDateString('en-IN')}</TableCell>
                  <TableCell><Badge variant="secondary">{o.platform}</Badge></TableCell>
                  <TableCell className="font-medium">{o.variant_sku || 'N/A'}</TableCell>
                  <TableCell>{o.quantity}</TableCell>
                  <TableCell className="text-right">{formatINR(o.total_amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
