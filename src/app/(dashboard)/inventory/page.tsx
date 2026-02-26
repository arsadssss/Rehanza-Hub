"use client"

import React, { useEffect, useState, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { formatINR } from '@/lib/format';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Search, ShoppingCart, Undo2, MoveHorizontal } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { InventoryValueCard } from '@/components/InventoryValueCard';
import { apiFetch } from '@/lib/apiFetch';

export default function InventoryPage() {
  const [inventory, setInventory] = useState<any[]>([]);
  const [totalValue, setTotalValue] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [invRes, valRes] = await Promise.all([
          apiFetch('/api/inventory'),
          apiFetch('/api/inventory-value')
        ]);

        if (invRes.ok) setInventory(await invRes.json());
        if (valRes.ok) {
          const vData = await valRes.json();
          setTotalValue(vData.total_value);
        }
      } catch (error: any) {
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch inventory' });
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [toast]);

  return (
    <div className="p-6 bg-gradient-to-br from-gray-100 to-blue-100 dark:from-gray-900 dark:to-slate-800 min-h-full space-y-6">
      <InventoryValueCard title="Inventory Investment Value" amount={totalValue} subtitle="Based on Cost Price × Stock" />
      <Card>
        <CardHeader><CardTitle>Inventory Summary</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {inventory.map(item => (
              <div key={item.id} className="bg-white/40 dark:bg-black/20 backdrop-blur-lg rounded-3xl p-6 shadow-xl border border-white/30">
                <p className="font-bold">SKU: {item.sku}</p>
                <p className="text-4xl font-bold mt-2">{formatINR(item.total_revenue)}</p>
                <p className="text-sm opacity-70">{item.product_name}</p>
                <div className="mt-4 flex justify-between items-center">
                  <Badge>{item.total_stock} in stock</Badge>
                  <Button variant="ghost" onClick={() => router.push(`/products?tab=variants&search=${item.sku}`)}>Details</Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
