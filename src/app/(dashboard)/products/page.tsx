"use client"

import React, { useEffect, useState, useCallback, Suspense } from 'react';
import { useToast } from '@/hooks/use-toast';
import { formatINR } from '@/lib/format';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  PlusCircle, 
  Package, 
  Warehouse, 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  FilterX, 
  Archive,
  AlertCircle,
  FileUp
} from 'lucide-react';
import { apiFetch } from '@/lib/apiFetch';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AddProductModal } from './components/add-product-modal';
import { ProductViewToggle } from '@/components/ProductViewToggle';
import { SummaryStatCard } from '@/components/SummaryStatCard';

export type Product = {
  id: string;
  sku: string;
  product_name: string;
  category: string | null;
  cost_price: number;
  margin: number;
  meesho_price: number;
  flipkart_price: number;
  amazon_price: number;
  stock: number;
  low_stock_threshold: number;
  created_at: string;
};

function ProductsContent() {
  const { toast } = useToast();
  const [isMounted, setIsMounted] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);

  const view = (searchParams.get('tab') as "products" | "variants") || "products";
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '10', 10);
  const search = searchParams.get('search') || '';

  const [products, setProducts] = useState<Product[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  
  const [searchTerm, setSearchTerm] = useState(search);
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);

  const updateQuery = useCallback((updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === '') params.delete(key);
      else params.set(key, value);
    });
    if (!updates.page) params.set('page', '1');
    router.push(`?${params.toString()}`);
  }, [router, searchParams]);

  const fetchData = useCallback(async () => {
    if (!activeAccountId) return;
    setLoading(true);
    try {
      const res = await apiFetch(`/api/products?page=${page}&limit=${limit}&search=${search}`);
      if (res.ok) {
        const json = await res.json();
        setProducts(json.data || []);
        setPagination(json.pagination || { total: 0, totalPages: 0 });
      }
      
      const sRes = await apiFetch('/api/products/summary');
      if (sRes.ok) setSummary(await sRes.ok ? await sRes.json() : null);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch products' });
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, activeAccountId, toast]);

  useEffect(() => {
    setIsMounted(true);
    const id = sessionStorage.getItem("active_account");
    if (id) setActiveAccountId(id);
  }, []);

  useEffect(() => {
    if (activeAccountId) fetchData();
  }, [fetchData, activeAccountId]);

  useEffect(() => {
    const handler = setTimeout(() => {
      if (searchTerm !== search) updateQuery({ search: searchTerm });
    }, 400);
    return () => clearTimeout(handler);
  }, [searchTerm, search, updateQuery]);

  if (!isMounted) return null;

  return (
    <div className="p-6 w-full space-y-6">
      <AddProductModal 
        isOpen={isAddProductOpen} 
        onClose={() => setIsAddProductOpen(false)} 
        onSuccess={fetchData} 
      />

      <div className="flex justify-center w-full">
        <ProductViewToggle value={view as any} onChange={(val) => updateQuery({ tab: val })} />
      </div>

      <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-4 w-full">
        <SummaryStatCard title="Total Products" value={summary?.totalProducts || 0} icon={<Package className="h-5 w-5" />} loading={loading} />
        <SummaryStatCard title="In Stock" value={summary?.inStockProducts || 0} icon={<Warehouse className="h-5 w-5" />} loading={loading} />
        <SummaryStatCard title="Total Units" value={summary?.totalInventoryUnits || 0} icon={<Archive className="h-5 w-5" />} loading={loading} />
        <SummaryStatCard title="Low Stock" value={0} icon={<AlertCircle className="h-5 w-5" />} loading={loading} />
      </div>

      <Card className="w-full shadow-md border-0">
        <CardHeader className="flex flex-col md:flex-row items-center justify-between gap-4">
          <CardTitle className="font-headline text-xl flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" /> Product Registry
          </CardTitle>
          <Button onClick={() => setIsAddProductOpen(true)}>
            <PlusCircle className="mr-2 h-4 w-4" /> Add Product
          </Button>
        </CardHeader>
        <CardContent>
          <div className="mb-6 relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by SKU or Name..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>SKU</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead className="text-right">Margin</TableHead>
                  <TableHead className="text-right">Meesho</TableHead>
                  <TableHead className="text-right">Flipkart</TableHead>
                  <TableHead className="text-right">Amazon</TableHead>
                  <TableHead className="text-center">Stock</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}><TableCell colSpan={9}><Skeleton className="h-10 w-full" /></TableCell></TableRow>
                  ))
                ) : products.length > 0 ? products.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="font-bold font-code uppercase">{p.sku}</TableCell>
                    <TableCell className="font-medium max-w-[200px] truncate">{p.product_name}</TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">{formatINR(p.cost_price)}</TableCell>
                    <TableCell className="text-right font-bold text-emerald-600">{formatINR(p.margin)}</TableCell>
                    <TableCell className="text-right font-black">{formatINR(p.meesho_price)}</TableCell>
                    <TableCell className="text-right font-black">{formatINR(p.flipkart_price)}</TableCell>
                    <TableCell className="text-right font-black">{formatINR(p.amazon_price)}</TableCell>
                    <TableCell className="text-center font-bold">{p.stock}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={p.stock > 0 ? "default" : "destructive"}>
                        {p.stock > 0 ? "In Stock" : "Sold Out"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow><TableCell colSpan={9} className="h-24 text-center">No products found.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-end space-x-2 py-4">
            <Button variant="outline" size="sm" onClick={() => updateQuery({ page: (page - 1).toString() })} disabled={page === 1}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium">Page {page} of {pagination.totalPages}</span>
            <Button variant="outline" size="sm" onClick={() => updateQuery({ page: (page + 1).toString() })} disabled={page >= pagination.totalPages}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<div className="p-8"><Skeleton className="h-64 w-full" /></div>}>
      <ProductsContent />
    </Suspense>
  );
}
