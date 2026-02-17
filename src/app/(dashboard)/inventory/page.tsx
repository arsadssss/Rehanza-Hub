
"use client"

import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Search, ShoppingCart, Undo2, MoveHorizontal } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

type InventoryItem = {
  id: string;
  sku: string;
  product_name: string;
  total_stock: number;
  total_orders: number;
  total_returns: number;
  total_revenue: number;
  low_stock_threshold: number; // Assuming this is available, if not, will use a default
};

export default function InventoryPage() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const { toast } = useToast();

  async function fetchInventory() {
    setLoading(true);
    // The view should ideally join with allproducts to get low_stock_threshold
    const { data, error } = await supabase.from('inventory_summary').select('*');

    if (error) {
      console.error('Error fetching inventory summary:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to fetch inventory summary.',
      });
      setInventory([]);
    } else {
      // Temporary fix: If low_stock_threshold is not in the view, add it with a default
      const dataWithThreshold = data.map(item => ({...item, low_stock_threshold: item.low_stock_threshold || 5}))
      setInventory(dataWithThreshold as InventoryItem[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchInventory();
  }, []);

  const filteredInventory = useMemo(() => {
    let filtered = inventory;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(
        item =>
          item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.product_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== 'All') {
      filtered = filtered.filter(item => {
        const stock = item.total_stock;
        const threshold = item.low_stock_threshold;
        if (statusFilter === 'In Stock') return stock > threshold;
        if (statusFilter === 'Low Stock') return stock > 0 && stock <= threshold;
        if (statusFilter === 'Out of Stock') return stock === 0;
        return true;
      });
    }

    return filtered;
  }, [inventory, searchTerm, statusFilter]);

  const getStatus = (stock: number, threshold: number) => {
    if (stock === 0) {
      return { text: 'Out of Stock', badgeVariant: 'destructive' as const, gradient: 'from-red-500 to-rose-600' };
    }
    if (stock <= threshold) {
      return { text: 'Low Stock', badgeVariant: 'destructive' as const, gradient: 'from-amber-500 to-orange-600' };
    }
    return { text: 'In Stock', badgeVariant: 'default' as const, gradient: 'from-cyan-400 to-purple-600' };
  };

  return (
    <div className="p-6 bg-gradient-to-br from-gray-100 to-blue-100 dark:from-gray-900 dark:to-slate-800 min-h-full">
      <Card className="bg-background/80 backdrop-blur-sm mb-6">
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <CardTitle className="font-headline">Inventory Summary</CardTitle>
              <CardDescription>
                A dashboard-style overview of your product inventory.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by SKU or name..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All</SelectItem>
                  <SelectItem value="In Stock">In Stock</SelectItem>
                  <SelectItem value="Low Stock">Low Stock</SelectItem>
                  <SelectItem value="Out of Stock">Out of Stock</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
      </Card>
      
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-80 w-full rounded-3xl" />
          ))}
        </div>
      ) : filteredInventory.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredInventory.map(item => {
            const status = getStatus(item.total_stock, item.low_stock_threshold);
            return (
              <div key={item.id} className="bg-white/40 dark:bg-black/20 backdrop-blur-lg rounded-3xl p-6 shadow-xl border border-white/30 dark:border-white/10 text-black dark:text-white">
                <div className="flex justify-between items-start">
                  {/* Left Side */}
                  <div>
                    <p className="font-bold text-lg">SKU: {item.sku}</p>
                    <p className="font-headline text-5xl font-bold mt-2">₹{new Intl.NumberFormat('en-IN').format(item.total_revenue)}</p>
                    <p className="text-sm opacity-70 mt-1">{item.product_name}</p>
                  </div>
                  {/* Right Side */}
                  <div className="flex flex-col items-center">
                    <div className="relative w-32 h-32">
                        <div className={`absolute inset-0 rounded-full bg-gradient-to-br ${status.gradient}`}></div>
                        <div className="absolute inset-2 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center">
                            <div className="text-center">
                                <p className="text-3xl font-bold text-foreground">{item.total_stock}</p>
                                <p className="text-xs text-muted-foreground">Total Stock</p>
                            </div>
                        </div>
                    </div>
                    <Badge variant={status.badgeVariant} className="mt-2 text-white">{status.text}</Badge>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
                  <div className="bg-black/5 dark:bg-white/5 p-4 rounded-xl flex items-center gap-4">
                      <div className="bg-gradient-to-br from-purple-400 to-indigo-500 p-3 rounded-lg">
                          <ShoppingCart className="h-6 w-6 text-white" />
                      </div>
                      <div>
                          <p className="opacity-70">Orders</p>
                          <p className="font-bold text-lg">{item.total_orders} Orders</p>
                      </div>
                  </div>
                   <div className="bg-black/5 dark:bg-white/5 p-4 rounded-xl flex items-center gap-4">
                      <div className="bg-gradient-to-br from-cyan-400 to-blue-500 p-3 rounded-lg">
                          <Undo2 className="h-6 w-6 text-white" />
                      </div>
                      <div>
                          <p className="opacity-70">Returns</p>
                          <p className="font-bold text-lg">{item.total_returns} Returns</p>
                      </div>
                  </div>
                </div>

                <Button className="w-full mt-6 h-14 text-lg font-bold bg-white/50 dark:bg-black/20 text-black dark:text-white backdrop-blur-sm border border-white/30 dark:border-black/50 hover:bg-white/70 dark:hover:bg-black/30">
                  EXPLORE SIZE BY <MoveHorizontal className="ml-2" />
                </Button>

              </div>
            );
          })}
        </div>
      ) : (
        <Card className="bg-background/80 backdrop-blur-sm">
            <CardContent className="pt-6">
                <div className="text-center py-12">
                <p className="text-lg text-muted-foreground">No inventory items match your criteria.</p>
                </div>
            </CardContent>
        </Card>
      )}
    </div>
  );
}

    