
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/apiFetch';
import { OrdersStatsCards } from '@/components/orders/stats-cards';
import { OrdersTable } from '@/components/orders/orders-table';
import { OrderFilters } from '@/components/orders/order-filters';
import { ImportOrders } from '@/components/orders/import-orders';
import { Button } from '@/components/ui/button';
import { ShoppingCart, Upload } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function OrdersPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [isImportOpen, setIsImportOpen] = useState(false);
  
  // Pagination & Filters
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });
  const [search, setSearch] = useState('');
  const [platform, setPlatform] = useState('all');
  const [dateRange, setDateRange] = useState<{ from?: string; to?: string }>({});

  // Sync account ID from session storage
  useEffect(() => {
    const id = sessionStorage.getItem("active_account");
    if (id) setActiveAccountId(id);

    const handleAccountChange = () => {
      const freshId = sessionStorage.getItem("active_account");
      if (freshId) setActiveAccountId(freshId);
    };

    window.addEventListener('active-account-changed', handleAccountChange);
    return () => window.removeEventListener('active-account-changed', handleAccountChange);
  }, []);

  const fetchStats = useCallback(async () => {
    if (!activeAccountId) return;
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (platform !== 'all') params.append('platform', platform);
      if (dateRange.from) params.append('from', dateRange.from);
      if (dateRange.to) params.append('to', dateRange.to);

      const res = await apiFetch(`/api/orders/stats?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setStats(data.data);
      }
    } catch (error) {
      console.error('Failed to load stats', error);
    }
  }, [activeAccountId, search, platform, dateRange]);

  const fetchOrders = useCallback(async () => {
    if (!activeAccountId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', '100');
      if (search) params.append('search', search);
      if (platform !== 'all') params.append('platform', platform);
      if (dateRange.from) params.append('from', dateRange.from);
      if (dateRange.to) params.append('to', dateRange.to);

      const res = await apiFetch(`/api/orders?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setOrders(data.data || []);
        setPagination({
          total: data.pagination?.total || 0,
          totalPages: data.pagination?.totalPages || 1
        });
      } else {
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to load orders list' });
      }
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Connection error' });
    } finally {
      setLoading(false);
    }
  }, [page, search, platform, dateRange, toast, activeAccountId]);

  useEffect(() => {
    if (activeAccountId) {
      fetchStats();
      fetchOrders();
    }
  }, [fetchStats, fetchOrders, activeAccountId]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [search, platform, dateRange]);

  const handleImportSuccess = () => {
    setIsImportOpen(false);
    fetchStats();
    fetchOrders();
  };

  return (
    <div className="p-6 md:p-8 space-y-8 bg-gray-50/50 dark:bg-black/50 min-h-full font-body">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-4xl font-black tracking-tighter font-headline flex items-center gap-3">
            <ShoppingCart className="h-10 w-10 text-primary" />
            Orders
          </h1>
          <p className="text-muted-foreground font-medium mt-1">Manage marketplace sales and inventory fulfillment.</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button 
            onClick={() => setIsImportOpen(true)}
            className="rounded-xl h-12 px-6 font-bold shadow-lg shadow-primary/20"
          >
            <Upload className="mr-2 h-4 w-4" /> Upload Orders
          </Button>
        </div>

        <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
          <DialogContent className="sm:max-w-xl rounded-[2rem]">
            <DialogHeader>
              <DialogTitle className="font-headline text-2xl font-bold">Import Marketplace Orders</DialogTitle>
            </DialogHeader>
            <ImportOrders 
              onSuccess={handleImportSuccess} 
              initialPlatform="meesho"
            />
          </DialogContent>
        </Dialog>
      </div>

      <OrdersStatsCards stats={stats} loading={loading} />

      <div className="space-y-6">
        <OrderFilters 
          search={search}
          onSearchChange={setSearch}
          platform={platform}
          onPlatformChange={setPlatform}
          onDateRangeChange={setDateRange}
        />

        <OrdersTable 
          orders={orders} 
          loading={loading} 
          onUploadClick={() => setIsImportOpen(true)}
          currentPage={page}
          totalPages={pagination.totalPages}
          totalOrders={pagination.total}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
}
