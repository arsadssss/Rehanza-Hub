"use client"

import React, { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/apiFetch';
import { SalesSummaryCards } from '@/components/SalesSummaryCards';
import { AnalyticsSection } from '@/components/AnalyticsSection';

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);
  
  const [totalSales, setTotalSales] = useState(0);
  const [totalOrders, setTotalOrders] = useState(0);
  const [totalReturns, setTotalReturns] = useState(0);
  const [netProfit, setNetProfit] = useState(0);
  const [returnRate, setReturnRate] = useState(0);
  
  const [salesTrendRaw, setSalesTrendRaw] = useState<any[]>([]);
  const [platformBreakdownRaw, setPlatformBreakdownRaw] = useState<any[]>([]);
  const [totalPlatformOrders, setTotalPlatformOrders] = useState(0);
  const [timeRange, setTimeRange] = useState('7d');

  useEffect(() => {
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
    if (!activeAccountId) return;

    async function fetchAnalyticsData() {
      setLoading(true);
      try {
        const res = await apiFetch(`/api/analytics?range=${timeRange}`);
        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.message || 'Failed to fetch report data');
        }
        const data = await res.json();
        
        setTotalSales(data.totalSales);
        setTotalOrders(data.totalOrders);
        setTotalReturns(data.totalReturns);
        setNetProfit(data.netProfit);
        setReturnRate(data.returnRate);
        
        setSalesTrendRaw(data.salesTrend || []);
        setPlatformBreakdownRaw(data.platformOrders?.breakdown || []);
        setTotalPlatformOrders(data.platformOrders?.totalOrders || 0);
        
      } catch (error: any) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: error.message,
        });
      } finally {
        setLoading(false);
      }
    }
    fetchAnalyticsData();
  }, [toast, timeRange, activeAccountId]);

  return (
    <div className="p-8 space-y-10 bg-gray-50/50 dark:bg-black/50 min-h-full">
        <div>
            <h1 className="text-4xl font-black tracking-tighter font-headline">Sales Intelligence</h1>
            <p className="text-muted-foreground font-medium mt-1">Advanced operational report and performance summary.</p>
        </div>

        <SalesSummaryCards 
          totalSales={totalSales}
          totalOrders={totalOrders}
          totalReturns={totalReturns}
          netProfit={netProfit}
          returnRate={returnRate}
          loading={loading}
        />

        <AnalyticsSection 
          salesTrendRaw={salesTrendRaw}
          platformBreakdownRaw={platformBreakdownRaw}
          totalPlatformOrders={totalPlatformOrders}
          timeRange={timeRange}
          onTimeRangeChange={setTimeRange}
          loading={loading}
        />
    </div>
  );
}
