"use client";

import React, { useEffect, useState, useCallback } from "react";
import { formatINR } from "@/lib/format";
import { format, parseISO } from 'date-fns';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PlusCircle, Pencil, Trash2, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AddOrderModal } from "./components/add-order-modal";

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
    product_name: string;
  } | null;
};

type ItemToDelete = {
  id: string;
  description: string;
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [orderToEdit, setOrderToEdit] = useState<Order | null>(null);
  const [itemToDelete, setItemToDelete] = useState<ItemToDelete | null>(null);

  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalRows, setTotalRows] = useState(0);
  const [platformFilter, setPlatformFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
      });
      if (platformFilter !== 'all') params.append('platform', platformFilter);
      if (fromDate) params.append('fromDate', fromDate);
      if (toDate) params.append('toDate', toDate);
      if (searchTerm) params.append('search', searchTerm);

      const res = await fetch(`/api/orders?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch orders');
      
      const { data, totalRows } = await res.json();
      setOrders(data);
      setTotalRows(totalRows);

    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, platformFilter, fromDate, toDate, searchTerm, toast]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    setPage(1);
  }, [platformFilter, fromDate, toDate, searchTerm]);


  const handleSuccess = () => {
    fetchOrders();
  };

  const handleOpenModal = (order?: Order) => {
    setOrderToEdit(order || null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setOrderToEdit(null);
    setIsModalOpen(false);
  };
  
  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    try {
        const res = await fetch(`/api/orders?id=${itemToDelete.id}`, {
            method: 'DELETE',
        });
        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.message || 'Failed to delete order');
        }
        toast({ title: 'Success', description: 'The order has been deleted.' });
        handleSuccess();
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Error deleting order', description: error.message });
    } finally {
        setItemToDelete(null);
    }
  };
  
  const clearFilters = () => {
    setPlatformFilter('all');
    setFromDate('');
    setToDate('');
    setSearchTerm('');
  };

  return (
    <div className="p-6">
      <AddOrderModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSuccess={handleSuccess}
        order={orderToEdit}
      />
      <AlertDialog open={!!itemToDelete} onOpenChange={() => setItemToDelete(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
                This will mark the order "{itemToDelete?.description}" as deleted. This action cannot be undone.
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
              <CardTitle className="font-headline">Orders</CardTitle>
              <CardDescription>View and manage all sales orders.</CardDescription>
            </div>
            <Button onClick={() => handleOpenModal()}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add Order
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-2 mb-4">
            <Select value={platformFilter} onValueChange={setPlatformFilter}>
              <SelectTrigger className="w-full md:w-[180px]"><SelectValue placeholder="Filter by Platform..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Platforms</SelectItem>
                <SelectItem value="Meesho">Meesho</SelectItem>
                <SelectItem value="Flipkart">Flipkart</SelectItem>
                <SelectItem value="Amazon">Amazon</SelectItem>
              </SelectContent>
            </Select>
            <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} placeholder="From Date" className="w-full md:w-auto"/>
            <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} placeholder="To Date" className="w-full md:w-auto"/>
            <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search SKU or Name..." className="pl-10" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
            <Button variant="outline" onClick={clearFilters}>Clear</Button>
          </div>

          <div className="rounded-md border max-h-[600px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Product Name</TableHead>
                  <TableHead className="text-center">Qty</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: pageSize }).map((_, i) => (
                    <TableRow key={i}><TableCell colSpan={8}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                  ))
                ) : orders.length > 0 ? (
                  orders.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell>{format(parseISO(o.order_date), "dd MMM yyyy")}</TableCell>
                      <TableCell><Badge variant="secondary">{o.platform}</Badge></TableCell>
                      <TableCell className="font-medium">{o.variant_sku || 'N/A'}</TableCell>
                      <TableCell>{o.product_name || 'N/A'}</TableCell>
                      <TableCell className="text-center">{o.quantity}</TableCell>
                      <TableCell className="text-right">{formatINR(o.selling_price)}</TableCell>
                      <TableCell className="text-right font-semibold">{formatINR(o.total_amount)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenModal(o)}><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive" onClick={() => setItemToDelete({id: o.id, description: `order for ${o.variant_sku}`})}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                    <TableRow>
                        <TableCell colSpan={8} className="h-24 text-center">No orders found.</TableCell>
                    </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-end space-x-2 py-4">
            <span className="text-sm text-muted-foreground">
                {totalRows > 0 ? `Page ${page} of ${Math.ceil(totalRows / pageSize)}` : 'Page 0 of 0'}
            </span>
            <Button variant="outline" size="sm" onClick={() => setPage(p => p - 1)} disabled={page === 1}>
                Previous
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={(page * pageSize) >= totalRows}>
                Next
            </Button>
        </div>
        </CardContent>
      </Card>
    </div>
  );
}
