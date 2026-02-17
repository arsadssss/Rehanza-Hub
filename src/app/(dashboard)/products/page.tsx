
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
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { AddProductModal } from './components/add-product-modal';
import { PlusCircle, Search, Trash2 } from 'lucide-react';
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
  total_stock: number;
  low_stock_threshold: number;
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { toast } = useToast();

  async function fetchProducts() {
    setLoading(true);
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
      setProducts(data as Product[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleProductAdded = (newProduct: Product) => {
    setProducts(prevProducts => [newProduct, ...prevProducts]);
  };

  const handleDeleteSelected = async () => {
    if (selectedRows.length === 0) return;

    const { error } = await supabase.from('allproducts').delete().in('id', selectedRows);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Error deleting products',
        description: error.message,
      });
    } else {
      setProducts(products.filter(p => !selectedRows.includes(p.id)));
      setSelectedRows([]);
      toast({
        title: 'Success',
        description: `${selectedRows.length} product(s) deleted successfully.`,
      });
    }
  };

  const filteredProducts = useMemo(() => {
    if (!searchTerm) return products;
    return products.filter(
      p =>
        p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.product_name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [products, searchTerm]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedRows(filteredProducts.map(p => p.id));
    } else {
      setSelectedRows([]);
    }
  };

  const handleRowSelect = (id: string) => {
    setSelectedRows(prev =>
      prev.includes(id) ? prev.filter(rowId => rowId !== id) : [...prev, id]
    );
  };

  return (
    <div className="p-6">
      <AddProductModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onProductAdded={handleProductAdded}
      />
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <CardTitle className="font-headline">Products</CardTitle>
              <CardDescription>Manage your products and their pricing.</CardDescription>
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
              {selectedRows.length > 0 && (
                <Button variant="destructive" size="icon" onClick={handleDeleteSelected}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
              <Button onClick={() => setIsModalOpen(true)}>
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
                        selectedRows.length > 0 &&
                        selectedRows.length === filteredProducts.length
                      }
                      onCheckedChange={handleSelectAll}
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
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={10}>
                        <Skeleton className="h-8 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : filteredProducts.length > 0 ? (
                  filteredProducts.map(product => {
                    const stock = product.total_stock;
                    let statusText: string;
                    let badgeVariant: 'destructive' | 'default' = 'default';
                    let badgeClassName = '';

                    if (stock === 0) {
                        statusText = 'Out of Stock';
                        badgeVariant = 'destructive';
                    } else if (stock <= 5) {
                        statusText = 'Low Stock';
                        badgeVariant = 'destructive';
                    } else {
                        statusText = 'In Stock';
                        badgeClassName = 'bg-green-500';
                    }

                    return (
                      <TableRow
                        key={product.id}
                        data-state={selectedRows.includes(product.id) && "selected"}
                      >
                        <TableCell>
                          <Checkbox
                            checked={selectedRows.includes(product.id)}
                            onCheckedChange={() => handleRowSelect(product.id)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{product.sku}</TableCell>
                        <TableCell>{product.product_name}</TableCell>
                        <TableCell>₹{product.cost_price.toFixed(2)}</TableCell>
                        <TableCell>₹{product.margin.toFixed(2)}</TableCell>
                        <TableCell>₹{product.meesho_price.toFixed(2)}</TableCell>
                        <TableCell>₹{product.flipkart_price.toFixed(2)}</TableCell>
                        <TableCell>₹{product.amazon_price.toFixed(2)}</TableCell>
                        <TableCell>{product.total_stock}</TableCell>
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
    </div>
  );
}
