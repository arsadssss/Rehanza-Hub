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
  ShoppingCart, 
  Ban, 
  Search, 
  Pencil, 
  ChevronLeft, 
  ChevronRight, 
  FilterX, 
  Archive
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { SummaryStatCard } from '@/components/SummaryStatCard';
import { ProductViewToggle } from '@/components/ProductViewToggle';
import { apiFetch } from '@/lib/apiFetch';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AddProductModal } from './components/add-product-modal';
import { AddVariantModal } from './components/add-variant-modal';
import { EditVariantModal } from './components/edit-variant-modal';
import { cn } from '@/lib/utils';

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
  low_stock_threshold: number;
  total_stock: number;
};

export type Variant = {
  id: string;
  variant_sku: string;
  color: string | null;
  size: string | null;
  stock: number;
  product_sku?: string;
  product_name?: string;
  meesho_price: number;
  flipkart_price: number;
  amazon_price: number;
};

function ProductsContent() {
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // URL-synced State
  const view = (searchParams.get('tab') as "products" | "variants") || "products";
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '10', 10);
  const search = searchParams.get('search') || '';
  const categoryFilter = searchParams.get('category') || 'all';
  const stockFilter = searchParams.get('stock') || 'all';
  const lowStockFilter = searchParams.get('low_stock') === 'true';

  // Data State
  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  
  // UI State
  const [searchTerm, setSearchTerm] = useState(search);
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [isAddVariantOpen, setIsAddVariantOpen] = useState(false);
  const [productToEdit, setProductToEdit] = useState<Product | null>(null);
  const [variantToEdit, setVariantToEdit] = useState<Variant | null>(null);
  const [itemToArchive, setItemToArchive] = useState<{ id: string; name: string; type: 'product' | 'variant' } | null>(null);

  // Helper to update URL params
  const updateQuery = useCallback((updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === 'all' || value === '') {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });

    // CRITICAL: Reset page if filters change (except when updating page itself)
    if (!updates.page) {
      params.set('page', '1');
    }

    router.push(`?${params.toString()}`);
  }, [router, searchParams]);

  // Debounced search effect
  useEffect(() => {
    const handler = setTimeout(() => {
      if (searchTerm !== search) {
        updateQuery({ search: searchTerm });
      }
    }, 400);
    return () => clearTimeout(handler);
  }, [searchTerm, search, updateQuery]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch Summary
      const sRes = await apiFetch('/api/products/summary');
      if (sRes.ok) setSummary(await sRes.json());

      // 2. Main Data based on View
      if (view === 'products') {
        const params = new URLSearchParams({
          page: page.toString(),
          limit: limit.toString(),
          search,
          category: categoryFilter,
          stock_status: stockFilter
        });
        const pRes = await apiFetch(`/api/products?${params.toString()}`);
        if (pRes.ok) {
          const json = await pRes.json();
          if (json.success) {
            setProducts(json.data);
            setPagination(json.pagination);
          }
        }
      } else {
        const params = new URLSearchParams({
          page: page.toString(),
          limit: limit.toString(),
          search,
          low_stock_only: lowStockFilter.toString()
        });
        const vRes = await apiFetch(`/api/variants?${params.toString()}`);
        if (vRes.ok) {
          const json = await vRes.json();
          if (json.success) {
            setVariants(json.data);
            setPagination(json.pagination);
          }
        }
      }
    } catch (error: any) {
      console.error('Products fetch error:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch products data' });
    } finally {
      setLoading(false);
    }
  }, [toast, view, page, limit, search, categoryFilter, stockFilter, lowStockFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleEditProduct = (product: Product) => {
    setProductToEdit(product);
    setIsAddProductOpen(true);
  };

  const handleEditVariant = (variant: any) => {
    setVariantToEdit(variant);
  };

  const handleArchive = async () => {
    if (!itemToArchive) return;
    
    try {
      const endpoint = itemToArchive.type === 'product' ? '/api/products' : '/api/variants';
      const res = await apiFetch(`${endpoint}?id=${itemToArchive.id}`, {
        method: 'DELETE'
      });
      
      const json = await res.json();
      
      if (!res.ok) {
        throw new Error(json.message || 'Archive failed');
      }
      
      toast({
        title: "Archived",
        description: `${itemToArchive.name} has been archived successfully.`
      });
      fetchData();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Archive Failed',
        description: error.message
      });
    } finally {
      setItemToArchive(null);
    }
  };

  const resetFilters = () => {
    setSearchTerm('');
    router.push(`?tab=${view}`);
  };

  return (
    <div className="p-6 w-full space-y-6">
      <AddProductModal 
        isOpen={isAddProductOpen || !!productToEdit} 
        onClose={() => { setIsAddProductOpen(false); setProductToEdit(null); }} 
        onSuccess={fetchData} 
        product={productToEdit} 
      />
      <AddVariantModal 
        isOpen={isAddVariantOpen} 
        onClose={() => setIsAddVariantOpen(false)} 
        onVariantAdded={fetchData} 
      />
      <EditVariantModal 
        isOpen={!!variantToEdit} 
        onClose={() => setVariantToEdit(null)} 
        onVariantUpdated={fetchData} 
        variant={variantToEdit} 
      />

      {/* Archive Confirmation */}
      <AlertDialog open={!!itemToArchive} onOpenChange={() => setItemToArchive(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive {itemToArchive?.type === 'product' ? 'Product' : 'Variant'}?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to archive <strong>{itemToArchive?.name}</strong>? 
              {itemToArchive?.type === 'product' && " This will also archive all of its variants."} 
              This item will be hidden from the dashboard but retained in historical records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchive} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Confirm Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex justify-center w-full">
        <div className="inline-flex">
          <ProductViewToggle 
            value={view} 
            onChange={(val) => updateQuery({ tab: val, page: '1' })} 
          />
        </div>
      </div>

      <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-4 w-full">
        <SummaryStatCard title="Total Products" value={summary?.totalProducts || 0} icon={<Package className="h-5 w-5" />} loading={loading} />
        <SummaryStatCard title="Products In Stock" value={summary?.inStockProducts || 0} icon={<ShoppingCart className="h-5 w-5" />} loading={loading} />
        <SummaryStatCard title="Out of Stock" value={summary?.outOfStockProducts || 0} icon={<Ban className="h-5 w-5" />} loading={loading} />
        <SummaryStatCard title="Inventory Units" value={summary?.totalInventoryUnits || 0} icon={<Warehouse className="h-5 w-5" />} loading={loading} />
      </div>

      <Card className="w-full shadow-md border-0">
        <CardHeader className="flex flex-col gap-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <CardTitle className="capitalize font-headline text-xl flex items-center gap-2">
              {view === 'products' ? <Package className="h-5 w-5 text-primary" /> : <Warehouse className="h-5 w-5 text-primary" />}
              {view} Management
            </CardTitle>
            <div className="flex items-center gap-2">
              {view === 'products' ? (
                <Button onClick={() => setIsAddProductOpen(true)}>
                  <PlusCircle className="mr-2 h-4 w-4" /> Add Product
                </Button>
              ) : (
                <Button onClick={() => setIsAddVariantOpen(true)}>
                  <PlusCircle className="mr-2 h-4 w-4" /> Add Variant
                </Button>
              )}
            </div>
          </div>

          {/* Filter Bar */}
          <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-3 items-end bg-muted/30 p-4 rounded-xl">
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Search</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={view === 'products' ? "Search SKU or Product Name..." : "Search SKU, Color, Size..."}
                  className="pl-8 bg-background"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            {view === 'products' ? (
              <>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Category</label>
                  <Select value={categoryFilter} onValueChange={(v) => updateQuery({ category: v })}>
                    <SelectTrigger className="bg-background"><SelectValue placeholder="All Categories" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      <SelectItem value="Apparel">Apparel</SelectItem>
                      <SelectItem value="Cosmetics">Cosmetics</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Stock Status</label>
                  <Select value={stockFilter} onValueChange={(v) => updateQuery({ stock: v })}>
                    <SelectTrigger className="bg-background"><SelectValue placeholder="All Status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="in_stock">In Stock</SelectItem>
                      <SelectItem value="out_of_stock">Out of Stock</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : (
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Health</label>
                <Select value={lowStockFilter ? "low" : "all"} onValueChange={(v) => updateQuery({ low_stock: v === 'low' ? 'true' : null })}>
                  <SelectTrigger className="bg-background"><SelectValue placeholder="All Variants" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Inventory</SelectItem>
                    <SelectItem value="low">Low Stock Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={resetFilters} className="text-xs font-bold uppercase">
                <FilterX className="mr-2 h-4 w-4" /> Reset
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="w-full overflow-x-auto rounded-md border">
            {view === "products" ? (
              <Table className="min-w-full">
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
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: limit }).map((_, i) => (
                      <TableRow key={i}><TableCell colSpan={10}><Skeleton className="h-10 w-full" /></TableCell></TableRow>
                    ))
                  ) : products.length > 0 ? products.map(p => (
                    <TableRow key={p.id} className="hover:bg-muted/50 transition-colors">
                      <TableCell className="font-bold font-code">{p.sku}</TableCell>
                      <TableCell className="font-medium">{p.product_name}</TableCell>
                      <TableCell className="text-right text-xs opacity-70">{formatINR(p.cost_price)}</TableCell>
                      <TableCell className="text-right font-semibold text-emerald-600">{formatINR(p.margin)}</TableCell>
                      <TableCell className="text-right font-medium">{formatINR(p.meesho_price)}</TableCell>
                      <TableCell className="text-right font-medium">{formatINR(p.flipkart_price)}</TableCell>
                      <TableCell className="text-right font-medium">{formatINR(p.amazon_price)}</TableCell>
                      <TableCell className="text-center font-bold">{p.total_stock}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={p.total_stock > 0 ? "default" : "destructive"}>
                          {p.total_stock > 0 ? "In Stock" : "Out of Stock"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleEditProduct(p)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => setItemToArchive({ id: p.id, name: p.product_name, type: 'product' })}>
                            <Archive className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow><TableCell colSpan={10} className="h-24 text-center text-muted-foreground">No products found matching your filters.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            ) : (
              <Table className="min-w-full">
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Variant SKU</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Color/Size</TableHead>
                    <TableHead className="text-right">Meesho</TableHead>
                    <TableHead className="text-right">Flipkart</TableHead>
                    <TableHead className="text-right">Amazon</TableHead>
                    <TableHead className="text-center">Stock</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: limit }).map((_, i) => (
                      <TableRow key={i}><TableCell colSpan={8}><Skeleton className="h-10 w-full" /></TableCell></TableRow>
                    ))
                  ) : variants.length > 0 ? variants.map(v => (
                    <TableRow key={v.id} className="hover:bg-muted/50 transition-colors">
                      <TableCell className="font-bold font-code">{v.variant_sku}</TableCell>
                      <TableCell className="text-xs">
                        <div className="flex flex-col">
                          <span className="font-medium">{v.product_name}</span>
                          <span className="text-[10px] text-muted-foreground">{v.product_sku}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs italic">{v.color || 'N/A'} / {v.size || 'N/A'}</TableCell>
                      <TableCell className="text-right">{formatINR(v.meesho_price)}</TableCell>
                      <TableCell className="text-right">{formatINR(v.flipkart_price)}</TableCell>
                      <TableCell className="text-right">{formatINR(v.amazon_price)}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={v.stock > 0 ? "outline" : "destructive"}>{v.stock} pcs</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleEditVariant(v)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => setItemToArchive({ id: v.id, name: v.variant_sku, type: 'variant' })}>
                            <Archive className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow><TableCell colSpan={8} className="h-24 text-center text-muted-foreground">No variants found matching your filters.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Pagination Footer */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 mt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Show</span>
              <Select value={limit.toString()} onValueChange={(v) => updateQuery({ limit: v, page: '1' })}>
                <SelectTrigger className="h-8 w-16 bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectContent>
              </Select>
              <span>entries</span>
              <span className="ml-4 border-l pl-4">
                {pagination.total > 0 ? `Showing ${(page - 1) * limit + 1} to ${Math.min(page * limit, pagination.total)} of ${pagination.total}` : 'No entries'}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <Button 
                variant="outline" 
                size="icon" 
                className="h-8 w-8"
                disabled={page === 1}
                onClick={() => updateQuery({ page: (page - 1).toString() })}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              {Array.from({ length: Math.min(5, pagination.totalPages) }).map((_, i) => {
                let pageNum = i + 1;
                if (pagination.totalPages > 5 && page > 3) {
                  pageNum = page - 2 + i;
                  if (pageNum > pagination.totalPages) pageNum = pagination.totalPages - (4 - i);
                }
                
                return (
                  <Button
                    key={pageNum}
                    variant={page === pageNum ? "default" : "outline"}
                    className="h-8 w-8 text-xs font-bold"
                    onClick={() => updateQuery({ page: pageNum.toString() })}
                  >
                    {pageNum}
                  </Button>
                );
              })}

              <Button 
                variant="outline" 
                size="icon" 
                className="h-8 w-8"
                disabled={page >= pagination.totalPages}
                onClick={() => updateQuery({ page: (page + 1).toString() })}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
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
