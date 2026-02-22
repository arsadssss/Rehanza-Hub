
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
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AddOrderModal } from './components/add-order-modal';
import { AddReturnModal } from '../returns/components/add-return-modal';
import { PlusCircle, Pencil, Trash2, Search } from 'lucide-react';
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
     allproducts: {
      product_name: string;
    } | null;
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

  // Orders state
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersPageSize] = useState(10);
  const [ordersTotalRows, setOrdersTotalRows] = useState(0);
  const [orderPlatformFilter, setOrderPlatformFilter] = useState('all');
  const [orderDateFrom, setOrderDateFrom] = useState('');
  const [orderDateTo, setOrderDateTo] = useState('');
  const [orderSearch, setOrderSearch] = useState('');

  // Returns state
  const [returns, setReturns] = useState<Return[]>([]);
  const [loadingReturns, setLoadingReturns] = useState(true);
  const [returnsPage, setReturnsPage] = useState(1);
  const [returnsPageSize] = useState(10);
  const [returnsTotalRows, setReturnsTotalRows] = useState(0);
  const [returnPlatformFilter, setReturnPlatformFilter] = useState('all');
  const [returnDateFrom, setReturnDateFrom] = useState('');
  const [returnDateTo, setReturnDateTo] = useState('');
  const [returnSearch, setReturnSearch] = useState('');

  // Shared state
  const [orderToEdit, setOrderToEdit] = useState<Order | null>(null);
  const [isAddOrderModalOpen, setIsAddOrderModalOpen] = useState(false);
  const [returnToEdit, setReturnToEdit] = useState<Return | null>(null);
  const [isAddReturnModalOpen, setIsAddReturnModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<ItemToDelete | null>(null);

  const fetchOrders = useCallback(async () => {
    setLoadingOrders(true);
    const from = (ordersPage - 1) * ordersPageSize;
    const to = from + ordersPageSize - 1;

    let query = supabase
      .from('orders')
      .select(`
        *,
        product_variants (
          variant_sku,
          allproducts (
            product_name
          )
        )
      `, { count: 'exact' })
      .eq('is_deleted', false);

    if (orderPlatformFilter !== 'all') {
      query = query.eq('platform', orderPlatformFilter);
    }
    if (orderDateFrom) {
      query = query.gte('order_date', orderDateFrom);
    }
    if (orderDateTo) {
      query = query.lte('order_date', orderDateTo);
    }
    if (orderSearch) {
      query = query.or(`product_variants.variant_sku.ilike.%${orderSearch}%,product_variants.allproducts.product_name.ilike.%${orderSearch}%`);
    }
    
    query = query.order('created_at', { ascending: false }).range(from, to);
    
    const { data, error, count } = await query;

    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch orders.' });
      setOrders([]);
    } else {
      setOrders(data as Order[]);
      setOrdersTotalRows(count || 0);
    }
    setLoadingOrders(false);
  }, [supabase, toast, ordersPage, ordersPageSize, orderPlatformFilter, orderDateFrom, orderDateTo, orderSearch]);

  const fetchReturns = useCallback(async () => {
    setLoadingReturns(true);
    const from = (returnsPage - 1) * returnsPageSize;
    const to = from + returnsPageSize - 1;
    
    let query = supabase
      .from('returns')
      .select(`
        *,
        product_variants (
          variant_sku,
          allproducts (
            product_name
          )
        )
      `, { count: 'exact' })
      .eq('is_deleted', false);
      
    if (returnPlatformFilter !== 'all') {
      query = query.eq('platform', returnPlatformFilter);
    }
    if (returnDateFrom) {
      query = query.gte('return_date', returnDateFrom);
    }
    if (returnDateTo) {
      query = query.lte('return_date', returnDateTo);
    }
    if (returnSearch) {
      query = query.or(`product_variants.variant_sku.ilike.%${returnSearch}%,product_variants.allproducts.product_name.ilike.%${returnSearch}%`);
    }

    query = query.order('created_at', { ascending: false }).range(from, to);

    const { data, error, count } = await query;

    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch returns.' });
      setReturns([]);
    } else {
      setReturns(data as Return[]);
      setReturnsTotalRows(count || 0);
    }
    setLoadingReturns(false);
  }, [supabase, toast, returnsPage, returnsPageSize, returnPlatformFilter, returnDateFrom, returnDateTo, returnSearch]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);
  
  useEffect(() => {
    fetchReturns();
  }, [fetchReturns]);

  useEffect(() => {
    setOrdersPage(1);
  }, [orderPlatformFilter, orderDateFrom, orderDateTo, orderSearch]);
  
  useEffect(() => {
    setReturnsPage(1);
  }, [returnPlatformFilter, returnDateFrom, returnDateTo, returnSearch]);

  const handleSuccess = useCallback(() => {
    fetchOrders();
    fetchReturns();
    window.dispatchEvent(new Event('data-changed'));
  }, [fetchOrders, fetchReturns]);

  useEffect(() => {
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

  const resetOrderFilters = () => {
    setOrderPlatformFilter('all');
    setOrderDateFrom('');
    setOrderDateTo('');
    setOrderSearch('');
  }
  
  const resetReturnFilters = () => {
    setReturnPlatformFilter('all');
    setReturnDateFrom('');
    setReturnDateTo('');
    setReturnSearch('');
  }

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
                <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                  <Button onClick={() => handleOpenOrderModal()}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Order
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row gap-2 mb-4">
                <Select value={orderPlatformFilter} onValueChange={setOrderPlatformFilter}>
                  <SelectTrigger className="w-full md:w-[180px]"><SelectValue placeholder="Filter by Platform..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Platforms</SelectItem>
                    <SelectItem value="Meesho">Meesho</SelectItem>
                    <SelectItem value="Flipkart">Flipkart</SelectItem>
                    <SelectItem value="Amazon">Amazon</SelectItem>
                  </SelectContent>
                </Select>
                <Input type="date" value={orderDateFrom} onChange={e => setOrderDateFrom(e.target.value)} placeholder="From Date" className="w-full md:w-auto" />
                <Input type="date" value={orderDateTo} onChange={e => setOrderDateTo(e.target.value)} placeholder="To Date" className="w-full md:w-auto" />
                <div className="relative w-full md:flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search SKU or Name..." value={orderSearch} onChange={e => setOrderSearch(e.target.value)} className="pl-10" />
                </div>
                <Button variant="outline" onClick={resetOrderFilters}>Clear</Button>
              </div>
              <div className="rounded-md border max-h-[500px] overflow-y-auto">
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
                      <TableRow><TableCell colSpan={8} className="h-24 text-center">No orders match your criteria.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              <div className="flex items-center justify-end space-x-2 py-4">
                <span className="text-sm text-muted-foreground">
                    {ordersTotalRows > 0 ? `Page ${ordersPage} of ${Math.ceil(ordersTotalRows / ordersPageSize)}` : 'Page 0 of 0'}
                </span>
                <Button variant="outline" size="sm" onClick={() => setOrdersPage(p => p - 1)} disabled={ordersPage === 1}>
                    Previous
                </Button>
                <Button variant="outline" size="sm" onClick={() => setOrdersPage(p => p + 1)} disabled={(ordersPage * ordersPageSize) >= ordersTotalRows}>
                    Next
                </Button>
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
                <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                  <Button onClick={() => handleOpenReturnModal()}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Return
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
               <div className="flex flex-col md:flex-row gap-2 mb-4">
                <Select value={returnPlatformFilter} onValueChange={setReturnPlatformFilter}>
                  <SelectTrigger className="w-full md:w-[180px]"><SelectValue placeholder="Filter by Platform..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Platforms</SelectItem>
                    <SelectItem value="Meesho">Meesho</SelectItem>
                    <SelectItem value="Flipkart">Flipkart</SelectItem>
                    <SelectItem value="Amazon">Amazon</SelectItem>
                  </SelectContent>
                </Select>
                <Input type="date" value={returnDateFrom} onChange={e => setReturnDateFrom(e.target.value)} placeholder="From Date" className="w-full md:w-auto" />
                <Input type="date" value={returnDateTo} onChange={e => setReturnDateTo(e.target.value)} placeholder="To Date" className="w-full md:w-auto" />
                <div className="relative w-full md:flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search SKU or Name..." value={returnSearch} onChange={e => setReturnSearch(e.target.value)} className="pl-10" />
                </div>
                <Button variant="outline" onClick={resetReturnFilters}>Clear</Button>
              </div>
              <div className="rounded-md border max-h-[500px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Platform</TableHead>
                      <TableHead>Variant SKU</TableHead>
                      <TableHead>Product Name</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Restockable</TableHead>
                      <TableHead>Total Loss</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingReturns ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}><TableCell colSpan={8}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                      ))
                    ) : returns.length > 0 ? (
                      returns.map(item => (
                          <TableRow key={item.id}>
                            <TableCell>{format(new Date(item.return_date), 'dd MMM yyyy')}</TableCell>
                            <TableCell><Badge variant="secondary">{item.platform}</Badge></TableCell>
                            <TableCell className="font-medium">{item.product_variants?.variant_sku}</TableCell>
                            <TableCell>{item.product_variants?.allproducts?.product_name}</TableCell>
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
                      <TableRow><TableCell colSpan={8} className="h-24 text-center">No returns match your criteria.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              <div className="flex items-center justify-end space-x-2 py-4">
                <span className="text-sm text-muted-foreground">
                    {returnsTotalRows > 0 ? `Page ${returnsPage} of ${Math.ceil(returnsTotalRows / returnsPageSize)}` : 'Page 0 of 0'}
                </span>
                <Button variant="outline" size="sm" onClick={() => setReturnsPage(p => p - 1)} disabled={returnsPage === 1}>
                    Previous
                </Button>
                <Button variant="outline" size="sm" onClick={() => setReturnsPage(p => p + 1)} disabled={(returnsPage * returnsPageSize) >= returnsTotalRows}>
                    Next
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

    