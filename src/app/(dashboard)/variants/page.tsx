
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
import { Checkbox } from '@/components/ui/checkbox';
import { AddVariantModal } from './components/add-variant-modal';
import { EditVariantModal } from './components/edit-variant-modal';
import { PlusCircle, Search, Trash2, Pencil } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

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

export default function VariantsPage() {
  const [variants, setVariants] = useState<Variant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingVariant, setEditingVariant] = useState<Variant | null>(null);
  const { toast } = useToast();

  async function fetchVariants() {
    setLoading(true);
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
    setLoading(false);
  }

  useEffect(() => {
    fetchVariants();
    const handleDataChange = () => fetchVariants();

    window.addEventListener('data-changed', handleDataChange);

    return () => {
      window.removeEventListener('data-changed', handleDataChange);
    };
  }, []);

  const handleVariantAdded = () => {
    fetchVariants();
  };
  
  const handleVariantUpdated = () => {
    fetchVariants();
    window.dispatchEvent(new Event('data-changed'));
  };


  const handleDeleteSelected = async () => {
    if (selectedRows.length === 0) return;

    const { error } = await supabase.from('product_variants').delete().in('id', selectedRows);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Error deleting variants',
        description: error.message,
      });
    } else {
      setVariants(variants.filter(v => !selectedRows.includes(v.id)));
      setSelectedRows([]);
      toast({
        title: 'Success',
        description: `${selectedRows.length} variant(s) deleted successfully.`,
      });
       window.dispatchEvent(new Event('data-changed'));
    }
  };

  const filteredVariants = useMemo(() => {
    if (!searchTerm) return variants;
    return variants.filter(
      v =>
        v.variant_sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.allproducts?.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.color?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.size?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [variants, searchTerm]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedRows(filteredVariants.map(v => v.id));
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
      <AddVariantModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onVariantAdded={handleVariantAdded}
      />
      <EditVariantModal
        isOpen={!!editingVariant}
        onClose={() => setEditingVariant(null)}
        onVariantUpdated={handleVariantUpdated}
        variant={editingVariant}
      />
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <CardTitle className="font-headline">Product Variants</CardTitle>
              <CardDescription>Manage your product variants and their stock.</CardDescription>
            </div>
            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search variants..."
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
              <Button onClick={() => setIsAddModalOpen(true)}>
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
                        selectedRows.length > 0 &&
                        selectedRows.length === filteredVariants.length
                      }
                      onCheckedChange={handleSelectAll}
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
                {loading ? (
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
                        data-state={selectedRows.includes(variant.id) && "selected"}
                      >
                        <TableCell>
                          <Checkbox
                            checked={selectedRows.includes(variant.id)}
                            onCheckedChange={() => handleRowSelect(variant.id)}
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
    </div>
  );
}
