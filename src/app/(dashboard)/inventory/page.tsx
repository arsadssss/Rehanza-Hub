"use client"

import React, { useEffect, useState, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { formatINR } from '@/lib/format';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { InventoryValueCard } from '@/components/InventoryValueCard';
import { apiFetch } from '@/lib/apiFetch';
import { ShoppingCart, Undo2, ArrowUpRight, PackageSearch, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

type InventoryItem = {
  id: string;
  sku: string;
  productName: string;
  stock: number;
  lowStockThreshold: number;
  totalOrders: number;
  totalReturns: number;
  revenue: number;
};

export default function InventoryPage() {
  const [data, setData] = useState<{ inventoryInvestment: number; items: InventoryItem[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const res = await apiFetch('/api/inventory');
        if (!res.ok) throw new Error('Failed to fetch inventory');
        const json = await res.json();
        if (json.success) {
          setData({
            inventoryInvestment: json.inventoryInvestment,
            items: json.items
          });
          // Temporary debug logging as requested
          console.log("Calculated Inventory Value:", json.inventoryInvestment);
        }
      } catch (error: any) {
        toast({ 
          variant: 'destructive', 
          title: 'Error', 
          description: error.message || 'Failed to load inventory data' 
        });
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [toast]);

  const filteredItems = useMemo(() => {
    if (!data?.items) return [];
    if (!searchTerm.trim()) return data.items;
    
    const query = searchTerm.toLowerCase();
    return data.items.filter(item => 
      item.sku.toLowerCase().includes(query) || 
      item.productName.toLowerCase().includes(query)
    );
  }, [data?.items, searchTerm]);

  const getStockColorClass = (stock: number, threshold: number) => {
    if (stock === 0) return "border-red-500 text-red-600 bg-red-50 dark:bg-red-950/20";
    if (stock <= threshold) return "border-amber-500 text-amber-600 bg-amber-50 dark:bg-amber-950/20";
    return "border-indigo-500 text-indigo-600 bg-indigo-50 dark:bg-indigo-950/20";
  };

  return (
    <div className="p-6 md:p-8 space-y-8 bg-gray-50/50 dark:bg-black/50 min-h-full">
      {/* Hero Section */}
      <div className="w-full">
        {loading ? (
          <Skeleton className="h-[200px] w-full rounded-3xl" />
        ) : (
          <InventoryValueCard 
            title="Inventory Investment Value" 
            amount={data?.inventoryInvestment || 0} 
            subtitle="Calculated as (Variant Stock × Product Cost Price)" 
          />
        )}
      </div>

      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold font-headline tracking-tight">Stock Summary</h2>
            <p className="text-sm text-muted-foreground">Track inventory health and SKU performance.</p>
          </div>
          
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search SKU, Product Name..." 
              className="pl-10 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border-border/50 focus-visible:ring-primary/20"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-48 w-full rounded-2xl" />
            ))
          ) : filteredItems.length > 0 ? (
            filteredItems.map((item) => (
              <Card key={item.id} className="group overflow-hidden rounded-2xl shadow-sm hover:shadow-md transition-all border-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
                <CardContent className="p-6">
                  {/* Header: SKU & Stock Circle */}
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-lg font-code">{item.sku}</span>
                        {item.stock <= item.lowStockThreshold && item.stock > 0 && (
                          <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200 text-[10px] py-0">Low Stock</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-tight line-clamp-1">
                        {item.productName}
                      </p>
                    </div>
                    <div className={cn(
                      "w-12 h-12 rounded-full border-4 flex items-center justify-center font-black text-sm transition-transform group-hover:scale-110",
                      getStockColorClass(item.stock, item.lowStockThreshold)
                    )}>
                      {item.stock}
                    </div>
                  </div>

                  {/* Body: Mini Stats Grid */}
                  <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-border/50">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                        <ShoppingCart className="h-2.5 w-2.5" /> Orders
                      </span>
                      <span className="font-bold text-foreground mt-0.5">{item.totalOrders}</span>
                    </div>
                    <div className="flex flex-col border-x px-4 border-border/50">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                        <Undo2 className="h-2.5 w-2.5" /> Returns
                      </span>
                      <span className={cn("font-bold mt-0.5", item.totalReturns > 0 ? "text-red-500" : "text-foreground")}>
                        {item.totalReturns}
                      </span>
                    </div>
                    <div className="flex flex-col text-right">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Revenue</span>
                      <span className="font-bold text-emerald-600 mt-0.5">{formatINR(item.revenue)}</span>
                    </div>
                  </div>

                  {/* Footer Action */}
                  <div className="mt-6">
                    <Button 
                      variant="secondary" 
                      className="w-full text-xs font-bold rounded-xl h-9 hover:bg-primary hover:text-primary-foreground group/btn"
                      onClick={() => router.push(`/products?tab=variants&search=${item.sku}`)}
                    >
                      Update Stock <ArrowUpRight className="ml-2 h-3.5 w-3.5 transition-transform group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="col-span-full py-20 flex flex-col items-center justify-center text-muted-foreground opacity-50">
              <PackageSearch className="h-16 w-16 mb-4" />
              <p className="text-xl font-headline">{searchTerm ? "No matches found" : "No inventory data found"}</p>
              <p className="text-sm">{searchTerm ? "Try a different SKU or product name." : "Start by adding products and stock variants."}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
