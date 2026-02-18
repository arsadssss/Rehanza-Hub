"use client"

import React, { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/format';

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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { AddProductModal } from './components/add-product-modal';
import { AddVariantModal } from './components/add-variant-modal';
import { EditVariantModal } from './components/edit-variant-modal';
import { PlusCircle, Search, Trash2, Pencil } from 'lucide-react';
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

export default function ProductsPage() {
  const supabase = createClient();
  // Products state
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [searchTermProducts, setSearchTermProducts] = useState('');
  const [selectedProductRows, setSelectedProductRows] = useState<string[]>([]);
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);
  const { toast } = useToast();

  // Variants state
  const [variants, setVariants] = useState<Variant[]>([]);
  const [loadingVariants, setLoadingVariants] = useState(true);
  const [searchTermVariants, setSearchTermVariants] = useState('');
  const [selectedVariantRows, setSelectedVariantRows] = useState<string[]>([]);
  const [isAddVariantModalOpen, setIsAddVariantModalOpen] = useState(false);
  const [editingVariant, setEditingVariant] = useState<Variant | null>(null);

  // Fetch Products
  async function fetchProducts() {
    setLoadingProducts(true);
    const { data, error } = await supabase.from('allproducts').select('*').order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching products:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to fetch products.',
      });
      setProducts([]);
    } else {
      setProducts(data as any as Product[]);
    }
    setLoadingProducts(false);
  }

  // Fetch Variants
  async function fetchVariants() {
    setLoadingVariants(true);
    const { data, error } = await supabase
      .from('product_variants')
      .select(`
        id,
        variant_sku,
        color,
        size,
        stock,
        allproducts (
          sku,
          product_name
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching variants:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to fetch product variants.',
      });
      setVariants([]);
    } else {
      setVariants(data as any as Variant[]);
    }
    setLoadingVariants(false);
  }

  useEffect(() => {
    fetchProducts();
    fetchVariants();
    
    const handleDataChange = () => {
      fetchProducts();
      fetchVariants();
    };

    window.addEventListener('data-changed', handleDataChange);

    return () => {
      window.removeEventListener('data-changed', handleDataChange);
    };
  }, []);

  // Product handlers
  const handleProductAdded = () => {
    fetchProducts(); // Refetch to get the latest list
  };

  const handleDeleteSelectedProducts = async () => {
    if (selectedProductRows.length === 0) return;

    const { data: variants, error: variantError } = await supabase
      .from('product_variants')
      .select('product_id')
      .in('product_id', selectedProductRows);

    if (variantError) {
      toast({
        variant: 'destructive',
        title: 'Error checking for variants',
        description: variantError.message,
      });
      return;
    }

    if (variants && variants.length > 0) {
      const productsWithVariants = products
        .filter(p => variants.some(v => v.product_id === p.id))
        .map(p => p.sku)
        .join(', ');

      toast({
        variant: 'destructive',
        title: 'Cannot delete product(s)',
        description: `The following products have associated variants and cannot be deleted: ${productsWithVariants}. Please delete the variants first.`,
        duration: 8000,
      });
      return;
    }

    const { error } = await supabase.from('allproducts').delete().in('id', selectedProductRows);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Error deleting products',
        description: error.message,
      });
    } else {
      setProducts(products.filter(p => !selectedProductRows.includes(p.id)));
      setSelectedProductRows([]);
      toast({
        title: 'Success',
        description: `${selectedProductRows.length} product(s) deleted successfully.`,
      });
    }
  };

  const filteredProducts = useMemo(() => {
    if (!searchTermProducts) return products;
    return products.filter(
      p =>
        p.sku.toLowerCase().includes(searchTermProducts.toLowerCase()) ||
        p.product_name.toLowerCase().includes(searchTermProducts.toLowerCase())
    );
  }, [products, searchTermProducts]);

  const handleSelectAllProducts = (checked: boolean) => {
    if (checked) {
      setSelectedProductRows(filteredProducts.map(p => p.id));
    } else {
      setSelectedProductRows([]);
    }
  };

  const handleRowSelectProduct = (id: string) => {
    setSelectedProductRows(prev =>
      prev.includes(id) ? prev.filter(rowId => rowId !== id) : [...prev, id]
    );
  };

  // Variant handlers
  const handleVariantAdded = () => {
    fetchVariants();
    fetchProducts(); // Also refetch products to update total stock
    window.dispatchEvent(new Event('data-changed'));
  };
  
  const handleVariantUpdated = () => {
    fetchVariants();
    fetchProducts(); // Also refetch products to update total stock
    window.dispatchEvent(new Event('data-changed'));
  };

  const handleDeleteSelectedVariants = async () => {
    if (selectedVariantRows.length === 0) return;

    const { error } = await supabase.from('product_variants').delete().in('id', selectedVariantRows);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Error deleting variants',
        description: error.message,
      });
    } else {
      setVariants(variants.filter(v => !selectedVariantRows.includes(v.id)));
      setSelectedVariantRows([]);
      toast({
        title: 'Success',
        description: `${selectedVariantRows.length} variant(s) deleted successfully.`,
      });
       window.dispatchEvent(new Event('data-changed'));
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
        isOpen={isAddProductModalOpen}
        onClose={() => setIsAddProductModalOpen(false)}
        onProductAdded={handleProductAdded}
      />
      <AddVariantModal
        isOpen={isAddVariantModalOpen}
        onClose={() => setIsAddVariantModalOpen(false)}
        onVariantAdded={handleVariantAdded}
      />
      <EditVariantModal
        isOpen={!!editingVariant}
        onClose={() => setEditingVariant(null)}
        onVariantUpdated={handleVariantUpdated}
        variant={editingVariant}
      />
      
      <Tabs defaultValue="products" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="variants">Variants</TabsTrigger>
        </TabsList>
        <TabsContent value="products">
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
                  {selectedProductRows.length > 0 && (
                    <Button variant="destructive" size="icon" onClick={handleDeleteSelectedProducts}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
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
                      <TableHead className="w-[50px]">
                        <Checkbox
                          checked={
                            selectedProductRows.length > 0 &&
                            selectedProductRows.length === filteredProducts.length
                          }
                          onCheckedChange={handleSelectAllProducts}
                        />
                      </TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Product Name</TableHead>
                      <TableHead>Cost</TableHead>
                      <TableHead>Margin</TableHead>
                      <TableHead>Meesho</TableHead>
                      <TableHead>Flipkart</TableHead>
                      <TableHead>Amazon</TableHead>
                      <TableHead>Stock</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingProducts ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell colSpan={10}>
                            <Skeleton className="h-8 w-full" />
                          </TableCell>
                        </TableRow>
                      ))
                    ) : filteredProducts.length > 0 ? (
                      filteredProducts.map(product => {
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
                          <TableRow
                            key={product.id}
                            data-state={selectedProductRows.includes(product.id) && "selected"}
                          >
                            <TableCell>
                              <Checkbox
                                checked={selectedProductRows.includes(product.id)}
                                onCheckedChange={() => handleRowSelectProduct(product.id)}
                              />
                            </TableCell>
                            <TableCell className="font-medium">{product.sku}</TableCell>
                            <TableCell>{product.product_name}</TableCell>
                            <TableCell>{formatCurrency(product.cost_price)}</TableCell>
                            <TableCell>{formatCurrency(product.margin)}</TableCell>
                            <TableCell>{formatCurrency(product.meesho_price)}</TableCell>
                            <TableCell>{formatCurrency(product.flipkart_price)}</TableCell>
                            <TableCell>{formatCurrency(product.amazon_price)}</TableCell>
                            <TableCell>{stock}</TableCell>
                            <TableCell>
                              <Badge
                                 variant={badgeVariant}
                                 className={badgeClassName}
                              >
                                {statusText}
                              </Badge>
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
                                <TableCell>{variant.color}</TableCell>
                                <TableCell>{variant.size}</TableCell>
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
