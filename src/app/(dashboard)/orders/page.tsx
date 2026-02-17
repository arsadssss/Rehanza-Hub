"use client"

import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

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
import { Badge } from '@/components/ui/badge';
import { AddOrderModal } from './components/add-order-modal';
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

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { toast } = useToast();

  async function fetchOrders() {
    setLoading(true);
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
    setLoading(false);
  }

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleOrderAdded = () => {
    // Re-fetch orders to get the latest list including the new one with all joins
    fetchOrders();
    // Dispatch event to notify other pages (products, variants) that data has changed
    window.dispatchEvent(new Event('data-changed'));
  };

  return (
    <div className="p-6">
      <AddOrderModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onOrderAdded={handleOrderAdded}
      />
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <CardTitle className="font-headline">Orders</CardTitle>
              <CardDescription>View and manage customer orders.</CardDescription>
            </div>
            <div className="flex items-center gap-2 w-full md:w-auto">
              <Button onClick={() => setIsModalOpen(true)}>
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
                {loading ? (
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
                        <TableCell>₹{order.selling_price.toFixed(2)}</TableCell>
                        <TableCell>₹{order.total_amount.toFixed(2)}</TableCell>
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
    </div>
  );
}
