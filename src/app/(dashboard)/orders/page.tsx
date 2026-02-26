"use client";

import React, { useEffect, useState, useCallback } from "react";
import { formatINR } from "@/lib/format";
import { format, parseISO } from 'date-fns';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PlusCircle, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AddOrderModal } from "./components/add-order-modal";

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [orderToEdit, setOrderToEdit] = useState<any>(null);
  const [itemToDelete, setItemToDelete] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [totalRows, setTotalRows] = useState(0);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const accountId = sessionStorage.getItem("active_account") || "";
      const res = await fetch(`/api/orders?page=${page}`, { headers: { "x-account-id": accountId } });
      if (!res.ok) throw new Error('Failed to fetch');
      const { data, totalRows } = await res.json();
      setOrders(data);
      setTotalRows(totalRows);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setLoading(false);
    }
  }, [page, toast]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  return (
    <div className="p-6 space-y-6">
      <AddOrderModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSuccess={fetchOrders} order={orderToEdit} />
      <Card>
        <CardHeader className="flex flex-row justify-between items-center">
          <CardTitle>Orders</CardTitle>
          <Button onClick={() => { setOrderToEdit(null); setIsModalOpen(true); }}><PlusCircle className="mr-2 h-4 w-4" /> Add Order</Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Platform</TableHead><TableHead>SKU</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {orders.map(o => (
                <TableRow key={o.id}>
                  <TableCell>{format(parseISO(o.order_date), "dd MMM yyyy")}</TableCell>
                  <TableCell><Badge variant="secondary">{o.platform}</Badge></TableCell>
                  <TableCell>{o.variant_sku}</TableCell>
                  <TableCell className="text-right font-bold">{formatINR(o.total_amount)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => { setOrderToEdit(o); setIsModalOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
