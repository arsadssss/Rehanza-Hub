"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { formatINR } from '@/lib/format';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Wallet, Archive } from 'lucide-react';
import { apiFetch } from '@/lib/apiFetch';
import { TaskPerformanceCard, type TrackRecordEntry } from '@/components/TaskPerformanceCard';
import { SalesSummaryCards } from '@/components/SalesSummaryCards';
import { AnalyticsSection } from '@/components/AnalyticsSection';
import { SalesKpiSection } from '@/components/SalesKpiSection';

export default function DashboardPage() {
  const { toast } = useToast();
  
  // High level data
  const [summary, setSummary] = useState<any>(null);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [trackRecord, setTrackRecord] = useState<TrackRecordEntry[]>([]);
  const [totalDueAllVendors, setTotalDueAllVendors] = useState(0);
  const [totalInventoryValue, setTotalInventoryValue] = useState(0);

  // Analytics Section Data
  const [salesData, setSalesData] = useState<any>(null);
  const [timeRange, setTimeRange] = useState('7d');
  
  // Loading states
  const [loading, setLoading] = useState(true);
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);
  const [loadingTrackRecord, setLoadingTrackRecord] = useState(true);
  const [isMounted, setIsMounted] = useState(false);

  const fetchAnalytics = useCallback(async (range: string) => {
    setLoadingAnalytics(true);
    try {
      const res = await apiFetch(`/api/analytics?range=${range}`);
      if (res.ok) {
        const data = await res.json();
        setSalesData(data);
      }
    } catch (error) {
      console.error("Dashboard Analytics Fetch Error:", error);
    } finally {
      setLoadingAnalytics(false);
    }
  }, []);

  useEffect(() => {
    setIsMounted(true);
    async function fetchDashboardData() {
      setLoading(true);
      setLoadingTrackRecord(true);
      try {
        const [dashRes, vendorRes, trackRes] = await Promise.all([
          apiFetch('/api/dashboard'),
          apiFetch('/api/vendors/summary'),
          apiFetch('/api/tasks/track-record'),
        ]);

        if (dashRes.ok) {
          const data = await dashRes.json();
          setSummary(data.summary);
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
      } catch (error: any) {
        toast({ variant: 'destructive', title: 'Error', description: error.message });
      } finally {
        setLoading(false);
        setLoadingTrackRecord(false);
      }
    }

    fetchDashboardData();
    fetchAnalytics(timeRange);
  }, [toast, fetchAnalytics, timeRange]);

  return (
    <div className="p-6 md:p-8 space-y-8 bg-gray-50/50 dark:bg-black/50">
      {/* 1. Sales Intelligence KPI Section */}
      <SalesKpiSection 
        totalUnits={summary?.total_units || 0}
        grossRevenue={summary?.gross_revenue || 0}
        netProfit={summary?.net_profit || 0}
        returnRate={summary?.return_rate || 0}
        loading={loading}
      />

      

      {/* 3. Sales Summary Cards (Legacy Drill-down metrics) */}
      {/* <SalesSummaryCards 
        totalSales={salesData?.totalSales || 0}
        totalOrders={salesData?.totalOrders || 0}
        totalReturns={salesData?.totalReturns || 0}
        netProfit={salesData?.netProfit || 0}
        loading={loadingAnalytics}
      /> */}

      {/* 4. Analytics Section (Trends + Platform Distribution) */}
      <AnalyticsSection 
        salesTrendRaw={salesData?.salesTrend || []}
        platformBreakdownRaw={salesData?.platformOrders?.breakdown || []}
        totalPlatformOrders={salesData?.platformOrders?.totalOrders || 0}
        timeRange={timeRange}
        onTimeRangeChange={setTimeRange}
        loading={loadingAnalytics}
      />
      {/* 5. Task Performance section */}
      <TaskPerformanceCard data={trackRecord} loading={loadingTrackRecord} title="Task Performance" />
      
{/* 2. Vendor + Inventory summary cards (Due, Investment) */}
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
      
      {/* 6. Recent Orders Table */}
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
