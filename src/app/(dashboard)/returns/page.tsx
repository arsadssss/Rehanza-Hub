
"use client"

import React, { useEffect, useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { formatINR } from '@/lib/format';

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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AddReturnModal } from './components/add-return-modal';
import { PlusCircle, Pencil, Trash2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export type Return = {
  id: string;
  return_date: string;
  platform: 'Meesho' | 'Flipkart' | 'Amazon';
  variant_id: string;
  quantity: number;
  restockable: boolean;
  total_loss: number;
  is_deleted: boolean;
  created_at: string;
  product_variants: {
    variant_sku: string;
  } | null;
};

type ItemToDelete = {
  id: string;
  description: string;
}

export default function ReturnsPage() {
  const { toast } = useToast();
  
  const [returns, setReturns] = useState<Return[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [returnToEdit, setReturnToEdit] = useState<Return | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const [itemToDelete, setItemToDelete] = useState<ItemToDelete | null>(null);

  const fetchReturns = useCallback(async () => {
    setLoading(true);
    try {
        const res = await fetch('/api/returns');
        if (!res.ok) throw new Error('Failed to fetch returns.');
        const data = await res.json();
        setReturns(data);
    } catch(error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
      setReturns([]);
    } finally {
        setLoading(false);
    }
  }, [toast]);

  const handleSuccess = useCallback(() => {
    fetchReturns();
    window.dispatchEvent(new Event('data-changed'));
  }, [fetchReturns]);

  useEffect(() => {
    handleSuccess();
    const handleDataChange = () => handleSuccess();
    window.addEventListener('data-changed', handleDataChange);
    return () => {
      window.removeEventListener('data-changed', handleDataChange);
    };
  }, [handleSuccess]);

  const handleOpenModal = (returnItem?: Return | null) => {
    if (returnItem) {
      setReturnToEdit(returnItem);
    } else {
      setReturnToEdit(null);
    }
    setIsAddModalOpen(true);
  }

  const handleCloseModal = () => {
    setReturnToEdit(null);
    setIsAddModalOpen(false);
  }

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    try {
        const res = await fetch(`/api/returns?id=${itemToDelete.id}`, { method: 'DELETE' });
        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.message || 'Failed to delete return');
        }
        toast({ title: 'Success', description: 'The return has been deleted.' });
        handleSuccess();
    } catch(error: any) {
        toast({ variant: 'destructive', title: 'Error deleting return', description: error.message });
    }
    setItemToDelete(null);
  };

  return (
    <div className="p-6">
      <AddReturnModal
        isOpen={isAddModalOpen || !!returnToEdit}
        onClose={handleCloseModal}
        onSuccess={handleSuccess}
        returnItem={returnToEdit}
      />
      <AlertDialog open={!!itemToDelete} onOpenChange={() => setItemToDelete(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
                This will mark the item "{itemToDelete?.description}" as deleted. This action cannot be undone.
            </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive hover:bg-destructive/90">
                Delete
            </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <CardTitle className="font-headline">Returns</CardTitle>
              <CardDescription>View and manage customer returns.</CardDescription>
            </div>
            <div className="flex items-center gap-2 w-full md:w-auto">
              <Button onClick={() => handleOpenModal()}>
                <PlusCircle className="mr-2 h-4 w-4" /> Add Return
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>Variant SKU</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Restockable</TableHead>
                  <TableHead>Total Loss</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}><TableCell colSpan={7}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                  ))
                ) : returns.length > 0 ? (
                  returns.map(item => (
                      <TableRow key={item.id}>
                        <TableCell>{format(new Date(item.return_date), 'dd MMM yyyy')}</TableCell>
                        <TableCell><Badge variant="secondary">{item.platform}</Badge></TableCell>
                        <TableCell className="font-medium">{item.product_variants?.variant_sku}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell><Badge variant={item.restockable ? 'default' : 'destructive'} className={item.restockable ? 'bg-green-500' : ''}>{item.restockable ? 'Yes' : 'No'}</Badge></TableCell>
                        <TableCell>{formatINR(item.total_loss)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenModal(item)}><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive" onClick={() => setItemToDelete({id: item.id, description: `Return for ${item.product_variants?.variant_sku || 'N/A'}`})}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                ) : (
                  <TableRow><TableCell colSpan={7} className="h-24 text-center">No returns found.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
