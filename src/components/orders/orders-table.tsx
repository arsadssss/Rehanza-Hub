
"use client";

import React from 'react';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { formatINR } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OrdersTableProps {
  orders: any[];
  loading: boolean;
  onUploadClick: () => void;
  currentPage: number;
  totalPages: number;
  totalOrders: number;
  onPageChange: (page: number) => void;
}

export function OrdersTable({ 
  orders, 
  loading, 
  onUploadClick,
  currentPage,
  totalPages,
  totalOrders,
  onPageChange
}: OrdersTableProps) {
  const itemsPerPage = 100;

  const getStatusColor = (status: string) => {
    const s = status?.toLowerCase() || '';
    if (s.includes('delivered') || s.includes('shipped')) return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
    if (s.includes('cancelled')) return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400';
    if (s.includes('ready')) return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
    return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400';
  };

  if (!loading && orders.length === 0) {
    return (
      <Card className="border-0 shadow-xl rounded-[2rem] bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl">
        <CardContent className="flex flex-col items-center justify-center py-32 text-center">
          <div className="p-8 bg-muted/50 rounded-full mb-6">
            <Inbox className="h-16 w-16 text-muted-foreground opacity-30" />
          </div>
          <h3 className="text-2xl font-black font-headline tracking-tight">No orders found</h3>
          <p className="text-muted-foreground mt-2 max-w-xs">Try adjusting your filters or upload new reports from your marketplace platforms.</p>
          <Button onClick={onUploadClick} className="mt-8 rounded-xl h-12 px-8 font-bold">
            Upload Orders Now
          </Button>
        </CardContent>
      </Card>
    );
  }

  const startRange = totalOrders > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0;
  const endRange = Math.min(currentPage * itemsPerPage, totalOrders);

  return (
    <Card className="border-0 shadow-xl rounded-[2rem] overflow-hidden bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl">
      <div className="relative overflow-x-auto">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow className="border-border/50 hover:bg-transparent">
              <TableHead className="px-6 font-bold text-[10px] uppercase tracking-[0.2em] h-14">Order ID</TableHead>
              <TableHead className="px-6 font-bold text-[10px] uppercase tracking-[0.2em] h-14">Date</TableHead>
              <TableHead className="px-6 font-bold text-[10px] uppercase tracking-[0.2em] h-14">Platform</TableHead>
              <TableHead className="px-6 font-bold text-[10px] uppercase tracking-[0.2em] h-14">SKU</TableHead>
              <TableHead className="px-6 text-center font-bold text-[10px] uppercase tracking-[0.2em] h-14">Qty</TableHead>
              <TableHead className="px-6 text-right font-bold text-[10px] uppercase tracking-[0.2em] h-14">Unit Price</TableHead>
              <TableHead className="px-6 text-right font-bold text-[10px] uppercase tracking-[0.2em] h-14">Total</TableHead>
              <TableHead className="px-6 text-center font-bold text-[10px] uppercase tracking-[0.2em] h-14">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <TableRow key={i} className="border-border/50">
                  <TableCell colSpan={8} className="px-6 py-4"><Skeleton className="h-6 w-full" /></TableCell>
                </TableRow>
              ))
            ) : (
              orders.map((order) => (
                <TableRow key={order.id} className="border-border/50 hover:bg-primary/5 transition-colors group">
                  <TableCell className="px-6 py-4 font-mono text-[11px] font-bold text-foreground/80">
                    {order.external_order_id}
                  </TableCell>
                  <TableCell className="px-6 py-4 font-medium text-xs whitespace-nowrap">
                    {order.order_date ? format(new Date(order.order_date), 'dd MMM yyyy') : '-'}
                  </TableCell>
                  <TableCell className="px-6 py-4">
                    <Badge variant="outline" className="text-[10px] uppercase font-black tracking-tighter px-2.5 bg-background shadow-sm">
                      {order.platform}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-6 py-4 font-black text-xs text-primary truncate max-w-[150px]">
                    {order.variant_sku}
                  </TableCell>
                  <TableCell className="px-6 py-4 text-center font-bold text-xs">
                    {order.quantity}
                  </TableCell>
                  <TableCell className="px-6 py-4 text-right text-xs font-medium text-muted-foreground">
                    {formatINR(Number(order.selling_price))}
                  </TableCell>
                  <TableCell className="px-6 py-4 text-right">
                    <span className="font-black text-sm text-foreground">
                      {formatINR(Number(order.total_amount))}
                    </span>
                  </TableCell>
                  <TableCell className="px-6 py-4 text-center">
                    <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-tighter", getStatusColor(order.status))}>
                      {order.status || 'UNKNOWN'}
                    </span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="p-6 border-t border-border/50 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
          Showing <span className="text-foreground">{startRange}</span> to <span className="text-foreground">{endRange}</span> of <span className="text-foreground">{totalOrders}</span> records
        </p>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            disabled={currentPage === 1 || loading}
            onClick={() => onPageChange(currentPage - 1)}
            className="h-9 px-4 rounded-xl font-bold text-[10px] uppercase tracking-tighter"
          >
            <ChevronLeft className="mr-1 h-3 w-3" /> Previous
          </Button>
          <div className="flex items-center gap-1 px-4 text-xs font-black text-muted-foreground">
            {currentPage} / {Math.max(1, totalPages)}
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            disabled={currentPage >= totalPages || loading}
            onClick={() => onPageChange(currentPage + 1)}
            className="h-9 px-4 rounded-xl font-bold text-[10px] uppercase tracking-tighter"
          >
            Next <ChevronRight className="ml-1 h-3 w-3" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
