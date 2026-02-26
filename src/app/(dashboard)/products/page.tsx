"use client"

import React, { useEffect, useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { formatINR } from '@/lib/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, Package, Warehouse, ShoppingCart, Ban, Search, Pencil } from 'lucide-react';
import { SummaryStatCard } from '@/components/SummaryStatCard';
import { ProductViewToggle } from '@/components/ProductViewToggle';
import { apiFetch } from '@/lib/apiFetch';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { AddProductModal } from './components/add-product-modal';
import { AddVariantModal } from './components/add-variant-modal';
import { EditVariantModal } from './components/edit-variant-modal';

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
  allproducts?: {
    sku: string;
    product_name: string;
  };
};

export default function ProductsPage() {
  const { toast } = useToast();
  const [view, setView] = useState<"products" | "variants">("products");
  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [isAddVariantOpen, setIsAddVariantOpen] = useState(false);
  const [productToEdit, setProductToEdit] = useState<Product | null>(null);
  const [variantToEdit, setVariantToEdit] = useState<Variant | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, vRes, sRes] = await Promise.all([
        apiFetch(`/api/products?search=${searchTerm}`),
        apiFetch(`/api/products?type=variants`),
        apiFetch('/api/products/summary')
      ]);
      if (pRes.ok) setProducts((await pRes.json()).data);
      if (vRes.ok) setVariants(await vRes.json());
      if (sRes.ok) setSummary(await sRes.json());
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch products' });
    } finally {
      setLoading(false);
    }
  }, [toast, searchTerm]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleEditProduct = (product: Product) => {
    setProductToEdit(product);
    setIsAddProductOpen(true);
  };

  const handleEditVariant = (variant: Variant) => {
    setVariantToEdit(variant);
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

      <div className="flex justify-center w-full">
        <div className="inline-flex">
          <ProductViewToggle value={view} onChange={setView} />
        </div>
      </div>

      <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-4 w-full">
        <SummaryStatCard title="Total Products" value={summary?.totalProducts || 0} icon={<Package className="h-5 w-5" />} loading={loading} />
        <SummaryStatCard title="Products In Stock" value={summary?.inStockProducts || 0} icon={<ShoppingCart className="h-5 w-5" />} loading={loading} />
        <SummaryStatCard title="Out of Stock" value={summary?.outOfStockProducts || 0} icon={<Ban className="h-5 w-5" />} loading={loading} />
        <SummaryStatCard title="Inventory Units" value={summary?.totalInventoryUnits || 0} icon={<Warehouse className="h-5 w-5" />} loading={loading} />
      </div>

      <Card className="w-full shadow-md border-0">
        <CardHeader className="flex flex-col md:flex-row items-center justify-between gap-4">
          <CardTitle className="capitalize font-headline text-xl flex items-center gap-2">
            {view === 'products' ? <Package className="h-5 w-5 text-primary" /> : <Warehouse className="h-5 w-5 text-primary" />}
            {view} Management
          </CardTitle>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative w-full md:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={`Search ${view}...`}
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
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
        </CardHeader>
        <CardContent>
          <div className="w-full overflow-x-auto">
            {view === "products" ? (
              <Table className="min-w-full">
                <TableHeader>
                  <TableRow>
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
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}><TableCell colSpan={10}><Skeleton className="h-10 w-full" /></TableCell></TableRow>
                    ))
                  ) : products.map(p => (
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
                        <Button variant="ghost" size="icon" onClick={() => handleEditProduct(p)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <Table className="min-w-full">
                <TableHeader>
                  <TableRow>
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
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}><TableCell colSpan={8}><Skeleton className="h-10 w-full" /></TableCell></TableRow>
                    ))
                  ) : variants.map(v => (
                    <TableRow key={v.id} className="hover:bg-muted/50 transition-colors">
                      <TableCell className="font-bold font-code">{v.variant_sku}</TableCell>
                      <TableCell className="text-xs">{v.product_name}</TableCell>
                      <TableCell className="text-xs italic">{v.color || 'N/A'} / {v.size || 'N/A'}</TableCell>
                      <TableCell className="text-right">{formatINR(v.meesho_price)}</TableCell>
                      <TableCell className="text-right">{formatINR(v.flipkart_price)}</TableCell>
                      <TableCell className="text-right">{formatINR(v.amazon_price)}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={v.stock > 0 ? "outline" : "destructive"}>{v.stock} pcs</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleEditVariant(v)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}