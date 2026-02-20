
"use client"

import React, { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
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
import { AddOrderModal } from './components/add-order-modal';
import { AddReturnModal } from '../returns/components/add-return-modal';
import { PlusCircle, Pencil, Trash2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export type Order = {
  id: string;
  order_date: string;
  platform: 'Meesho' | 'Flipkart' | 'Amazon';
  variant_id: string;
  quantity: number;
  selling_price: number;
  total_amount: number;
  is_deleted: boolean;
  created_at: string;
  product_variants: {
    variant_sku: string;
    allproducts: {
      product_name: string;
    } | null;
  } | null;
};

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
  type: 'order' | 'return';
  description: string;
}

export default function OrdersPage() {
  const supabase = createClient();
  const { toast } = useToast();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [orderToEdit, setOrderToEdit] = useState<Order | null>(null);
  const [isAddOrderModalOpen, setIsAddOrderModalOpen] = useState(false);
  
  const [returns, setReturns] = useState<Return[]>([]);
  const [loadingReturns, setLoadingReturns] = useState(true);
  const [returnToEdit, setReturnToEdit] = useState<Return | null>(null);
  const [isAddReturnModalOpen, setIsAddReturnModalOpen] = useState(false);

  const [itemToDelete, setItemToDelete] = useState<ItemToDelete | null>(null);

  const fetchOrders = useCallback(async () => {
    setLoadingOrders(true);
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        product_variants (
          variant_sku,
          allproducts (
            product_name
          )
        )
      `)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });

    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch orders.' });
      setOrders([]);
    } else {
      setOrders(data as Order[]);
    }
    setLoadingOrders(false);
  }, [supabase, toast]);

  const fetchReturns = useCallback(async () => {
    setLoadingReturns(true);
    const { data, error } = await supabase
      .from('returns')
      .select(`
        *,
        product_variants (
          variant_sku
        )
      `)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });

    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch returns.' });
      setReturns([]);
    } else {
      setReturns(data as Return[]);
    }
    setLoadingReturns(false);
  }, [supabase, toast]);

  const handleSuccess = useCallback(() => {
    fetchOrders();
    fetchReturns();
    window.dispatchEvent(new Event('data-changed'));
  }, [fetchOrders, fetchReturns]);

  useEffect(() => {
    handleSuccess();
    window.addEventListener('data-changed', handleSuccess);
    return () => {
      window.removeEventListener('data-changed', handleSuccess);
    };
  }, [handleSuccess]);

  const handleOpenOrderModal = (order?: Order | null) => {
    if (order) {
      setOrderToEdit(order);
    } else {
      setOrderToEdit(null);
      setIsAddOrderModalOpen(true);
    }
  }

  const handleCloseOrderModal = () => {
    setOrderToEdit(null);
    setIsAddOrderModalOpen(false);
  }

  const handleOpenReturnModal = (returnItem?: Return | null) => {
    if (returnItem) {
      setReturnToEdit(returnItem);
    } else {
      setReturnToEdit(null);
      setIsAddReturnModalOpen(true);
    }
  }

  const handleCloseReturnModal = () => {
    setReturnToEdit(null);
    setIsAddReturnModalOpen(false);
  }

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;

    const table = itemToDelete.type === 'order' ? 'orders' : 'returns';
    
    const { error } = await supabase.from(table).update({ is_deleted: true }).eq('id', itemToDelete.id);

    if (error) {
      toast({ variant: 'destructive', title: 'Error deleting item', description: error.message });
    } else {
      toast({ title: 'Success', description: `The ${itemToDelete.type} has been deleted.` });
      handleSuccess();
    }
    setItemToDelete(null);
  };

  return (
    <div className="p-6">
      <AddOrderModal
        isOpen={isAddOrderModalOpen || !!orderToEdit}
        onClose={handleCloseOrderModal}
        onSuccess={handleSuccess}
        order={orderToEdit}
      />
      <AddReturnModal
        isOpen={isAddReturnModalOpen || !!returnToEdit}
        onClose={handleCloseReturnModal}
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
      
      <Tabs defaultValue="orders" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="returns">Returns</TabsTrigger>
        </TabsList>
        <TabsContent value="orders">
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <CardTitle className="font-headline">Orders</CardTitle>
                  <CardDescription>View and manage customer orders.</CardDescription>
                </div>
                <div className="flex items-center gap-2 w-full md:w-auto">
                  <Button onClick={() => handleOpenOrderModal()}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Order
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
                      <TableHead>Product Name</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Selling Price</TableHead>
                      <TableHead>Total Amount</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingOrders ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}><TableCell colSpan={8}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                      ))
                    ) : orders.length > 0 ? (
                      orders.map(order => (
                          <TableRow key={order.id}>
                            <TableCell>{format(new Date(order.order_date), 'dd MMM yyyy')}</TableCell>
                            <TableCell><Badge variant="secondary">{order.platform}</Badge></TableCell>
                            <TableCell className="font-medium">{order.product_variants?.variant_sku}</TableCell>
                            <TableCell>{order.product_variants?.allproducts?.product_name}</TableCell>
                            <TableCell>{order.quantity}</TableCell>
                            <TableCell>{formatINR(order.selling_price)}</TableCell>
                            <TableCell>{formatINR(order.total_amount)}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenOrderModal(order)}><Pencil className="h-4 w-4" /></Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive" onClick={() => setItemToDelete({id: order.id, type: 'order', description: `Order for ${order.product_variants?.variant_sku || 'N/A'}`})}><Trash2 className="h-4 w-4" /></Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                    ) : (
                      <TableRow><TableCell colSpan={8} className="h-24 text-center">No orders found.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="returns">
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <CardTitle className="font-headline">Returns</CardTitle>
                  <CardDescription>View and manage customer returns.</CardDescription>
                </div>
                <div className="flex items-center gap-2 w-full md:w-auto">
                  <Button onClick={() => handleOpenReturnModal()}>
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
                    {loadingReturns ? (
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
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenReturnModal(item)}><Pencil className="h-4 w-4" /></Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive" onClick={() => setItemToDelete({id: item.id, type: 'return', description: `Return for ${item.product_variants?.variant_sku || 'N/A'}`})}><Trash2 className="h-4 w-4" /></Button>
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
