
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
import { Search } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

type InventoryItem = {
  id: string;
  sku: string;
  product_name: string;
  total_stock: number;
  total_orders: number;
  total_returns: number;
  total_revenue: number;
};

export default function InventoryPage() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const { toast } = useToast();

  async function fetchInventory() {
    setLoading(true);
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
      setInventory(data as InventoryItem[]);
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
        if (statusFilter === 'In Stock') return stock > 5;
        if (statusFilter === 'Low Stock') return stock > 0 && stock <= 5;
        if (statusFilter === 'Out of Stock') return stock === 0;
        return true;
      });
    }

    return filtered;
  }, [inventory, searchTerm, statusFilter]);

  const getStatus = (stock: number) => {
    if (stock === 0) {
      return { text: 'Out of Stock', color: 'bg-red-500', textColor: 'text-white', ringColor: 'ring-red-500', badgeVariant: 'destructive' as const };
    }
    if (stock <= 5) {
      return { text: 'Low Stock', color: 'bg-orange-500', textColor: 'text-white', ringColor: 'ring-orange-500', badgeVariant: 'destructive' as const };
    }
    return { text: 'In Stock', color: 'bg-green-500', textColor: 'text-white', ringColor: 'ring-green-500', badgeVariant: 'default' as const };
  };

  return (
    <div className="p-6">
      <Card>
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
        <CardContent>
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="p-4">
                  <Skeleton className="h-32 w-full" />
                </Card>
              ))}
            </div>
          ) : filteredInventory.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredInventory.map(item => {
                const status = getStatus(item.total_stock);
                return (
                  <Card key={item.id} className="p-4 flex justify-between items-start shadow-md hover:shadow-lg transition-shadow">
                    <div className="space-y-2 flex-1">
                      <p className="font-bold text-lg">{item.sku}</p>
                      <p className="text-sm text-muted-foreground">{item.product_name}</p>
                      <p className="text-sm"><strong>Revenue:</strong> ₹{item.total_revenue.toFixed(2)}</p>
                      <p className="text-sm"><strong>Orders:</strong> {item.total_orders}</p>
                      <p className="text-sm"><strong>Returns:</strong> {item.total_returns}</p>
                    </div>
                    <div className="flex flex-col items-center justify-center space-y-2 ml-4">
                      <div className={`relative w-24 h-24 rounded-full flex items-center justify-center ring-4 ${status.ringColor}`}>
                        <span className="text-2xl font-bold">{item.total_stock}</span>
                      </div>
                      <Badge variant={status.badgeVariant} className={`${status.color} ${status.textColor}`}>{status.text}</Badge>
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-lg text-muted-foreground">No inventory items match your criteria.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
