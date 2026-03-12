"use client"

import React, { useEffect, useState, useCallback, useMemo, Suspense } from 'react';
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
  Pencil,
  Trash2
} from 'lucide-react';
import { apiFetch } from '@/lib/apiFetch';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AddProductModal } from './components/add-product-modal';
import { ProductViewToggle } from '@/components/ProductViewToggle';
import { SummaryStatCard } from '@/components/SummaryStatCard';
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
  const searchParams = useSearchParams();
  
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);

  const view = (searchParams.get('tab') as "products" | "variants") || "products";
  
  const [products, setProducts] = useState<Product[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Filters State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [stockStatus, setStockStatus] = useState('all');
  
  // Pagination State
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Modals State
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [productToEdit, setProductToEdit] = useState<Product | null>(null);
  const [itemToDelete, setItemToDelete] = useState<Product | null>(null);

  const fetchData = useCallback(async () => {
    if (!activeAccountId) return;
    setLoading(true);
    try {
      const res = await apiFetch('/api/products');
      if (res.ok) {
        const json = await res.json();
        setProducts(json.data || []);
      }
      
      const sRes = await apiFetch('/api/products/summary');
      if (sRes.ok) setSummary(await sRes.json());
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch products' });
    } finally {
      setLoading(false);
    }
  }, [activeAccountId, toast]);

  useEffect(() => {
    setIsMounted(true);
    const id = sessionStorage.getItem("active_account");
    if (id) setActiveAccountId(id);
  }, []);

  useEffect(() => {
    if (activeAccountId) fetchData();
  }, [fetchData, activeAccountId]);

  // Combined Filtering Logic
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = 
        p.sku.toLowerCase().includes(searchTerm.toLowerCase()) || 
        p.product_name.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
      
      const matchesStock = 
        stockStatus === 'all' || 
        (stockStatus === 'in_stock' && p.stock > 0) || 
        (stockStatus === 'out_of_stock' && p.stock === 0);

      return matchesSearch && matchesCategory && matchesStock;
    });
  }, [products, searchTerm, selectedCategory, stockStatus]);

  // Derived Categories for Filter
  const categories = useMemo(() => {
    const cats = new Set(products.map(p => p.category).filter(Boolean));
    return Array.from(cats) as string[];
  }, [products]);

  // Pagination Logic (Slicing)
  const totalPages = Math.ceil(filteredProducts.length / pageSize);
  const paginatedProducts = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredProducts.slice(start, start + pageSize);
  }, [filteredProducts, page]);

  const handleEdit = (product: Product) => {
    setProductToEdit(product);
    setIsAddProductOpen(true);
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;
    try {
      const res = await apiFetch('/api/products/delete', {
        method: 'DELETE',
        body: JSON.stringify({ sku: itemToDelete.sku })
      });
      if (res.ok) {
        toast({ title: "Deleted", description: "Product removed successfully" });
        fetchData();
      } else {
        throw new Error("Failed to delete");
      }
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: "Could not delete product" });
    } finally {
      setItemToDelete(null);
    }
  };

  const resetFilters = () => {
    setSearchTerm('');
    setSelectedCategory('all');
    setStockStatus('all');
    setPage(1);
  };

  if (!isMounted) return null;

  return (
    <div className="p-6 w-full space-y-6">
      <AddProductModal 
        isOpen={isAddProductOpen} 
        onClose={() => { setIsAddProductOpen(false); setProductToEdit(null); }} 
        onSuccess={fetchData}
        productToEdit={productToEdit}
      />

      <AlertDialog open={!!itemToDelete} onOpenChange={() => setItemToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the product with SKU: <strong>{itemToDelete?.sku}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90 text-white">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex justify-center w-full">
        <ProductViewToggle value={view as any} onChange={(val) => {}} />
      </div>

      <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-4 w-full">
        <SummaryStatCard title="Total Products" value={summary?.totalProducts || 0} icon={<Package className="h-5 w-5" />} loading={loading} />
        <SummaryStatCard title="In Stock" value={summary?.inStockProducts || 0} icon={<Warehouse className="h-5 w-5" />} loading={loading} />
        <SummaryStatCard title="Total Units" value={summary?.totalInventoryUnits || 0} icon={<Archive className="h-5 w-5" />} loading={loading} />
        <SummaryStatCard title="Out of Stock" value={summary?.outOfStockProducts || 0} icon={<AlertCircle className="h-5 w-5" />} loading={loading} />
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="relative md:col-span-2">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by SKU or Name..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
              />
            </div>
            <Select value={selectedCategory} onValueChange={(v) => { setSelectedCategory(v); setPage(1); }}>
              <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Select value={stockStatus} onValueChange={(v) => { setStockStatus(v); setPage(1); }}>
                <SelectTrigger className="flex-1"><SelectValue placeholder="Stock Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="in_stock">In Stock</SelectItem>
                  <SelectItem value="out_of_stock">Out of Stock</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="ghost" size="icon" onClick={resetFilters} title="Reset Filters">
                <FilterX className="h-4 w-4" />
              </Button>
            </div>
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
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}><TableCell colSpan={9}><Skeleton className="h-10 w-full" /></TableCell></TableRow>
                  ))
                ) : paginatedProducts.length > 0 ? paginatedProducts.map(p => (
                  <TableRow key={p.sku}>
                    <TableCell className="font-bold font-code uppercase">{p.sku}</TableCell>
                    <TableCell className="font-medium max-w-[200px] truncate">{p.product_name}</TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">{formatINR(p.cost_price)}</TableCell>
                    <TableCell className="text-right font-bold text-emerald-600">{formatINR(p.margin)}</TableCell>
                    <TableCell className="text-right font-black">{formatINR(p.meesho_price)}</TableCell>
                    <TableCell className="text-right font-black">{formatINR(p.flipkart_price)}</TableCell>
                    <TableCell className="text-right font-black">{formatINR(p.amazon_price)}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={p.stock > 0 ? "default" : "destructive"}>
                        {p.stock}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => handleEdit(p)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setItemToDelete(p)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow><TableCell colSpan={9} className="h-24 text-center">No products found.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-end space-x-2 py-4">
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium">Page {page} of {totalPages || 1}</span>
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
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
