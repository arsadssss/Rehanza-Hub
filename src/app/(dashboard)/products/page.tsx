
"use client"

import React, { useEffect, useState, useMemo, useCallback, Suspense } from 'react';
import { useToast } from '@/hooks/use-toast';
import { formatINR } from '@/lib/format';
import { useSearchParams } from 'next/navigation';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { AddProductModal } from './components/add-product-modal';
import { AddVariantModal } from './components/add-variant-modal';
import { EditVariantModal } from './components/edit-variant-modal';
import { PlusCircle, Search, Trash2, Pencil, Package, Archive, ArchiveX, Warehouse } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export type Product = {
  id: string;
  sku: string;
  product_name: string;
  category: string | null;
  size: string | null;
  cost_price: number;
  margin: number;
  meesho_price: number;
  flipkart_price: number;
  amazon_price: number;
  stock: number;
  low_stock_threshold: number;
};

export type Variant = {
  id: string;
  product_id: string;
  variant_sku: string;
  color: string | null;
  size: string | null;
  stock: number;
  allproducts: {
    sku: string;
    product_name: string;
  } | null;
};

type SummaryStats = {
  totalProducts: number;
  inStockProducts: number;
  outOfStockProducts: number;
  totalInventoryUnits: number;
}

const SummaryCard = ({ title, value, icon: Icon, loading }: { title: string; value: string | number; icon: React.ElementType, loading: boolean }) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      <Icon className="h-4 w-4 text-muted-foreground" />
    </CardHeader>
    <CardContent>
      {loading ? <Skeleton className="h-8 w-24" /> : (
        <div className="text-2xl font-bold">{value}</div>
      )}
    </CardContent>
  </Card>
);

function ProductsContent() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  
  const initialTab = searchParams.get('tab') === 'variants' ? 'variants' : 'products';
  const initialSearch = searchParams.get('search') || '';

  // Products state
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [searchTermProducts, setSearchTermProducts] = useState('');
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  
  // Products pagination
  const [productsPage, setProductsPage] = useState(1);
  const [productsPageSize] = useState(10);
  const [productsTotalRows, setProductsTotalRows] = useState(0);

  // Summary state
  const [summaryStats, setSummaryStats] = useState<SummaryStats | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);

  // Variants state
  const [variants, setVariants] = useState<Variant[]>([]);
  const [loadingVariants, setLoadingVariants] = useState(true);
  const [searchTermVariants, setSearchTermVariants] = useState(initialSearch);
  const [selectedVariantRows, setSelectedVariantRows] = useState<string[]>([]);
  const [isAddVariantModalOpen, setIsAddVariantModalOpen] = useState(false);
  const [editingVariant, setEditingVariant] = useState<Variant | null>(null);

  const fetchProductsAndSummary = useCallback(async () => {
    setLoadingProducts(true);
    setLoadingSummary(true);

    try {
        const productParams = new URLSearchParams({
            page: productsPage.toString(),
            pageSize: productsPageSize.toString(),
            search: searchTermProducts,
        });

        // Fetch paginated products and summary in parallel
        const [productsRes, summaryRes] = await Promise.all([
            fetch(`/api/products?${productParams.toString()}`),
            fetch('/api/products/summary')
        ]);
        
        if (!productsRes.ok) throw new Error('Failed to fetch products');
        if (!summaryRes.ok) throw new Error('Failed to fetch summary stats');

        const { data, count } = await productsRes.json();
        const summaryData = await summaryRes.json();

        setProducts(data);
        setProductsTotalRows(count);
        setSummaryStats(summaryData);

    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
        setLoadingProducts(false);
        setLoadingSummary(false);
    }
  }, [toast, productsPage, productsPageSize, searchTermProducts]);


  // Fetch Variants
  const fetchVariants = useCallback(async () => {
    setLoadingVariants(true);
    try {
        const res = await fetch('/api/variants');
        if (!res.ok) throw new Error('Failed to fetch product variants');
        const data = await res.json();
        setVariants(data);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
      setVariants([]);
    } finally {
        setLoadingVariants(false);
    }
  }, [toast]);
  
  // Initial and reactive fetches
  useEffect(() => {
    fetchProductsAndSummary();
  }, [fetchProductsAndSummary]);
  
  useEffect(() => {
    fetchVariants();
  }, [fetchVariants]);

  useEffect(() => {
    setProductsPage(1);
  }, [searchTermProducts]);

  const handleSuccess = () => {
    fetchProductsAndSummary();
    fetchVariants();
    window.dispatchEvent(new Event('data-changed'));
  };

  const handleOpenEditModal = (product: Product) => {
    setEditingProduct(product);
    setIsAddProductModalOpen(true);
  }

  const handleCloseModal = () => {
    setIsAddProductModalOpen(false);
    setEditingProduct(null);
  }
  
  // Variant handlers
  const handleDeleteSelectedVariants = async () => {
    if (selectedVariantRows.length === 0) return;

    try {
        const res = await fetch('/api/variants', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: selectedVariantRows })
        });
        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.message || 'Failed to delete variants');
        }
        toast({ title: 'Success', description: `${selectedVariantRows.length} variant(s) deleted successfully.` });
        handleSuccess();
        setSelectedVariantRows([]);
    } catch(error: any) {
        toast({ variant: 'destructive', title: 'Error deleting variants', description: error.message });
    }
  };

  const filteredVariants = useMemo(() => {
    if (!searchTermVariants) return variants;
    return variants.filter(
      v =>
        v.variant_sku.toLowerCase().includes(searchTermVariants.toLowerCase()) ||
        v.allproducts?.product_name.toLowerCase().includes(searchTermVariants.toLowerCase()) ||
        v.color?.toLowerCase().includes(searchTermVariants.toLowerCase()) ||
        v.size?.toLowerCase().includes(searchTermVariants.toLowerCase())
    );
  }, [variants, searchTermVariants]);

  const handleSelectAllVariants = (checked: boolean) => {
    if (checked) {
      setSelectedVariantRows(filteredVariants.map(v => v.id));
    } else {
      setSelectedVariantRows([]);
    }
  };

  const handleRowSelectVariant = (id: string) => {
    setSelectedVariantRows(prev =>
      prev.includes(id) ? prev.filter(rowId => rowId !== id) : [...prev, id]
    );
  };


  return (
    <div className="p-6">
      <AddProductModal
        isOpen={isAddProductModalOpen || !!editingProduct}
        onClose={handleCloseModal}
        onSuccess={handleSuccess}
        product={editingProduct}
      />
      <AddVariantModal
        isOpen={isAddVariantModalOpen}
        onClose={() => setIsAddVariantModalOpen(false)}
        onVariantAdded={handleSuccess}
      />
      <EditVariantModal
        isOpen={!!editingVariant}
        onClose={() => setEditingVariant(null)}
        onVariantUpdated={handleSuccess}
        variant={editingVariant}
      />
      
      <Tabs defaultValue={initialTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="variants">Variants</TabsTrigger>
        </TabsList>
        <TabsContent value="products">
           <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
              <SummaryCard title="Total Products" value={summaryStats?.totalProducts ?? 0} icon={Package} loading={loadingSummary} />
              <SummaryCard title="Products In Stock" value={summaryStats?.inStockProducts ?? 0} icon={Archive} loading={loadingSummary} />
              <SummaryCard title="Out of Stock" value={summaryStats?.outOfStockProducts ?? 0} icon={ArchiveX} loading={loadingSummary} />
              <SummaryCard title="Total Inventory Units" value={summaryStats?.totalInventoryUnits ?? 0} icon={Warehouse} loading={loadingSummary} />
            </div>
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <CardTitle className="font-headline">Products</CardTitle>
                  <CardDescription>Manage your main products and their base pricing.</CardDescription>
                </div>
                <div className="flex items-center gap-2 w-full md:w-auto">
                  <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by SKU or name..."
                      className="pl-10"
                      value={searchTermProducts}
                      onChange={e => setSearchTermProducts(e.target.value)}
                    />
                  </div>
                  <Button onClick={() => setIsAddProductModalOpen(true)}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Product
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU</TableHead>
                      <TableHead>Product Name</TableHead>
                      <TableHead>Cost</TableHead>
                      <TableHead>Margin</TableHead>
                      <TableHead>Meesho</TableHead>
                      <TableHead>Flipkart</TableHead>
                      <TableHead>Amazon</TableHead>
                      <TableHead>Stock</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingProducts ? (
                      Array.from({ length: productsPageSize }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell colSpan={10}>
                            <Skeleton className="h-8 w-full" />
                          </TableCell>
                        </TableRow>
                      ))
                    ) : products.length > 0 ? (
                      products.map(product => {
                        const stock = product.stock || 0;
                        let statusText: string;
                        let badgeVariant: 'destructive' | 'default' = 'default';
                        let badgeClassName = '';

                        if (stock === 0) {
                            statusText = 'Out of Stock';
                            badgeVariant = 'destructive';
                        } else if (stock <= product.low_stock_threshold) {
                            statusText = 'Low Stock';
                            badgeVariant = 'destructive';
                            badgeClassName = 'bg-orange-500';
                        } else {
                            statusText = 'In Stock';
                            badgeClassName = 'bg-green-500';
                        }

                        return (
                          <TableRow key={product.id}>
                            <TableCell className="font-medium">{product.sku}</TableCell>
                            <TableCell>{product.product_name}</TableCell>
                            <TableCell>{formatINR(product.cost_price)}</TableCell>
                            <TableCell>{formatINR(product.margin)}</TableCell>
                            <TableCell>{formatINR(product.meesho_price)}</TableCell>
                            <TableCell>{formatINR(product.flipkart_price)}</TableCell>
                            <TableCell>{formatINR(product.amazon_price)}</TableCell>
                            <TableCell>{stock}</TableCell>
                            <TableCell>
                              <Badge
                                 variant={badgeVariant}
                                 className={badgeClassName}
                              >
                                {statusText}
                              </Badge>
                            </TableCell>
                             <TableCell className="text-right">
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenEditModal(product)}>
                                    <Pencil className="h-4 w-4" />
                                </Button>
                             </TableCell>
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={10} className="h-24 text-center">
                          No products found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
               <div className="flex items-center justify-end space-x-2 py-4">
                  <span className="text-sm text-muted-foreground">
                    {productsTotalRows > 0 ? `Page ${productsPage} of ${Math.ceil(productsTotalRows / productsPageSize)}` : 'Page 0 of 0'}
                  </span>
                  <Button variant="outline" size="sm" onClick={() => setProductsPage(p => p - 1)} disabled={productsPage === 1}>
                    Previous
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setProductsPage(p => p + 1)} disabled={(productsPage * productsPageSize) >= productsTotalRows}>
                    Next
                  </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="variants">
            <Card>
                <CardHeader>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                    <CardTitle className="font-headline">Product Variants</CardTitle>
                    <CardDescription>Manage your product variants and their individual stock.</CardDescription>
                    </div>
                    <div className="flex items-center gap-2 w-full md:w-auto">
                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                        placeholder="Search variants..."
                        className="pl-10"
                        value={searchTermVariants}
                        onChange={e => setSearchTermVariants(e.target.value)}
                        />
                    </div>
                    {selectedVariantRows.length > 0 && (
                        <Button variant="destructive" size="icon" onClick={handleDeleteSelectedVariants}>
                        <Trash2 className="h-4 w-4" />
                        </Button>
                    )}
                    <Button onClick={() => setIsAddVariantModalOpen(true)}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Add Variant
                    </Button>
                    </div>
                </div>
                </CardHeader>
                <CardContent>
                <div className="rounded-md border">
                    <Table>
                    <TableHeader>
                        <TableRow>
                        <TableHead className="w-[50px]">
                            <Checkbox
                            checked={
                                selectedVariantRows.length > 0 &&
                                selectedVariantRows.length === filteredVariants.length
                            }
                            onCheckedChange={handleSelectAllVariants}
                            />
                        </TableHead>
                        <TableHead>Variant SKU</TableHead>
                        <TableHead>Product Name</TableHead>
                        <TableHead>Color</TableHead>
                        <TableHead>Size</TableHead>
                        <TableHead>Stock</TableHead>
                        <TableHead>Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loadingVariants ? (
                        Array.from({ length: 5 }).map((_, i) => (
                            <TableRow key={i}>
                            <TableCell colSpan={7}>
                                <Skeleton className="h-8 w-full" />
                            </TableCell>
                            </TableRow>
                        ))
                        ) : filteredVariants.length > 0 ? (
                        filteredVariants.map(variant => (
                            <TableRow
                                key={variant.id}
                                data-state={selectedVariantRows.includes(variant.id) && "selected"}
                            >
                                <TableCell>
                                <Checkbox
                                    checked={selectedVariantRows.includes(variant.id)}
                                    onCheckedChange={() => handleRowSelectVariant(variant.id)}
                                />
                                </TableCell>
                                <TableCell className="font-medium">{variant.variant_sku}</TableCell>
                                <TableCell>{variant.allproducts?.product_name}</TableCell>
                                <TableCell>{variant.color || 'N/A'}</TableCell>
                                <TableCell>{variant.size || 'N/A'}</TableCell>
                                <TableCell>{variant.stock}</TableCell>
                                <TableCell>
                                <Button variant="ghost" size="icon" onClick={() => setEditingVariant(variant)}>
                                    <Pencil className="h-4 w-4" />
                                </Button>
                                </TableCell>
                            </TableRow>
                            ))
                        ) : (
                        <TableRow>
                            <TableCell colSpan={7} className="h-24 text-center">
                            No variants found.
                            </TableCell>
                        </TableRow>
                        )}
                    </TableBody>
                    </Table>
                </div>
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<div className="p-6"><Skeleton className="h-10 w-full mb-6" /><Skeleton className="h-64 w-full" /></div>}>
      <ProductsContent />
    </Suspense>
  );
}
