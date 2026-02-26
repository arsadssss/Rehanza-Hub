"use client"

import React, { useEffect, useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { formatINR } from '@/lib/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { PlusCircle, Search, Package, Warehouse } from 'lucide-react';
import { SummaryStatCard } from '@/components/SummaryStatCard';
import { ProductViewToggle } from '@/components/ProductViewToggle';

export default function ProductsPage() {
  const { toast } = useToast();
  const [view, setView] = useState<"products" | "variants">("products");
  const [products, setProducts] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const accountId = sessionStorage.getItem("active_account") || "";
      const [pRes, sRes] = await Promise.all([
        fetch('/api/products', { headers: { "x-account-id": accountId } }),
        fetch('/api/products/summary', { headers: { "x-account-id": accountId } })
      ]);
      if (pRes.ok) setProducts((await pRes.json()).data);
      if (sRes.ok) setSummary(await sRes.json());
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch products' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="p-6 w-full space-y-6">
      <div className="flex justify-center w-full">
        <ProductViewToggle value={view} onChange={setView} />
      </div>
      <div className="grid gap-6 md:grid-cols-4 w-full">
        <SummaryStatCard title="Total Products" value={summary?.totalProducts || 0} icon={<Package />} loading={loading} />
        <SummaryStatCard title="Inventory Units" value={summary?.totalInventoryUnits || 0} icon={<Warehouse />} loading={loading} />
      </div>
      <Card>
        <CardHeader><CardTitle className="capitalize">{view}</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>SKU</TableHead><TableHead>Name</TableHead><TableHead className="text-right">Price</TableHead></TableRow></TableHeader>
            <TableBody>
              {products.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.sku}</TableCell>
                  <TableCell>{p.product_name}</TableCell>
                  <TableCell className="text-right">{formatINR(p.meesho_price)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
