"use client"

import React, { useEffect, useState, useMemo } from 'react';
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
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AddOrderModal } from './components/add-order-modal';
import { AddReturnModal } from '../returns/components/add-return-modal';
import { PlusCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export type Order = {
  id: string;
  order_date: string;
  platform: 'Meesho' | 'Flipkart' | 'Amazon';
  variant_id: string;
  quantity: number;
  selling_price: number;
  total_amount: number;
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
  product_variants: {
    variant_sku: string;
  } | null;
};

export default function OrdersPage() {
  const supabase = createClient();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [isAddOrderModalOpen, setIsAddOrderModalOpen] = useState(false);
  
  const [returns, setReturns] = useState<Return[]>([]);
  const [loadingReturns, setLoadingReturns] = useState(true);
  const [isAddReturnModalOpen, setIsAddReturnModalOpen] = useState(false);

  const { toast } = useToast();

  async function fetchOrders() {
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
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching orders:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to fetch orders.',
      });
      setOrders([]);
    } else {
      setOrders(data as Order[]);
    }
    setLoadingOrders(false);
  }

  async function fetchReturns() {
    setLoadingReturns(true);
    const { data, error } = await supabase
      .from('returns')
      .select(`
        *,
        product_variants (
          variant_sku
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching returns:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to fetch returns.',
      });
      setReturns([]);
    } else {
      setReturns(data as Return[]);
    }
    setLoadingReturns(false);
  }

  useEffect(() => {
    fetchOrders();
    fetchReturns();
    
    const handleDataChange = () => {
      fetchOrders();
      fetchReturns();
    };
    window.addEventListener('data-changed', handleDataChange);

    return () => {
      window.removeEventListener('data-changed', handleDataChange);
    };
  }, []);

  const handleOrderAdded = () => {
    fetchOrders();
    window.dispatchEvent(new Event('data-changed'));
  };

  const handleReturnAdded = () => {
    fetchReturns();
    window.dispatchEvent(new Event('data-changed'));
  };

  return (
    <div className="p-6">
      <AddOrderModal
        isOpen={isAddOrderModalOpen}
        onClose={() => setIsAddOrderModalOpen(false)}
        onOrderAdded={handleOrderAdded}
      />
      <AddReturnModal
        isOpen={isAddReturnModalOpen}
        onClose={() => setIsAddReturnModalOpen(false)}
        onReturnAdded={handleReturnAdded}
      />
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
                  <Button onClick={() => setIsAddOrderModalOpen(true)}>
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
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingOrders ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell colSpan={7}>
                            <Skeleton className="h-8 w-full" />
                          </TableCell>
                        </TableRow>
                      ))
                    ) : orders.length > 0 ? (
                      orders.map(order => (
                          <TableRow key={order.id}>
                            <TableCell>{format(new Date(order.order_date), 'dd MMM yyyy')}</TableCell>
                            <TableCell>
                              <Badge variant="secondary">{order.platform}</Badge>
                            </TableCell>
                            <TableCell className="font-medium">{order.product_variants?.variant_sku}</TableCell>
                            <TableCell>{order.product_variants?.allproducts?.product_name}</TableCell>
                            <TableCell>{order.quantity}</TableCell>
                            <TableCell>{formatINR(order.selling_price)}</TableCell>
                            <TableCell>{formatINR(order.total_amount)}</TableCell>
                          </TableRow>
                        ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={7} className="h-24 text-center">
                          No orders found.
                        </TableCell>
                      </TableRow>
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
                  <Button onClick={() => setIsAddReturnModalOpen(true)}>
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
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingReturns ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell colSpan={6}>
                            <Skeleton className="h-8 w-full" />
                          </TableCell>
                        </TableRow>
                      ))
                    ) : returns.length > 0 ? (
                      returns.map(item => (
                          <TableRow key={item.id}>
                            <TableCell>{format(new Date(item.return_date), 'dd MMM yyyy')}</TableCell>
                            <TableCell>
                              <Badge variant="secondary">{item.platform}</Badge>
                            </TableCell>
                            <TableCell className="font-medium">{item.product_variants?.variant_sku}</TableCell>
                            <TableCell>{item.quantity}</TableCell>
                            <TableCell>
                              <Badge variant={item.restockable ? 'default' : 'destructive'} className={item.restockable ? 'bg-green-500' : ''}>
                                {item.restockable ? 'Yes' : 'No'}
                              </Badge>
                            </TableCell>
                            <TableCell>{formatINR(item.total_loss)}</TableCell>
                          </TableRow>
                        ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="h-24 text-center">
                          No returns found.
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
