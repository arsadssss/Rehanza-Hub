"use client";

import React from 'react';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Inbox, Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ReturnsTableProps {
  returns: any[];
  loading: boolean;
  onEdit: (item: any) => void;
  onDelete: (item: any) => void;
  currentPage: number;
  totalPages: number;
  totalRecords: number;
  onPageChange: (page: number) => void;
}

export function ReturnsTable({ 
  returns, 
  loading, 
  onEdit,
  onDelete,
  currentPage,
  totalPages,
  totalRecords,
  onPageChange
}: ReturnsTableProps) {
  const itemsPerPage = 25;

  if (!loading && returns.length === 0) {
    return (
      <Card className="border-0 shadow-xl rounded-[2rem] bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl">
        <CardContent className="flex flex-col items-center justify-center py-32 text-center">
          <div className="p-8 bg-muted/50 rounded-full mb-6">
            <Inbox className="h-16 w-16 text-muted-foreground opacity-30" />
          </div>
          <h3 className="text-2xl font-black font-headline tracking-tight">No returns found</h3>
          <p className="text-muted-foreground mt-2 max-w-xs">Try adjusting your filters or upload new return reports.</p>
        </CardContent>
      </Card>
    );
  }

  const startRange = totalRecords > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0;
  const endRange = Math.min(currentPage * itemsPerPage, totalRecords);

  return (
    <Card className="border-0 shadow-xl rounded-[2rem] overflow-hidden bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl">
      <div className="relative overflow-x-auto">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow className="border-border/50 hover:bg-transparent">
              <TableHead className="px-6 font-bold text-[10px] uppercase tracking-[0.2em] h-14">Return Date</TableHead>
              <TableHead className="px-6 font-bold text-[10px] uppercase tracking-[0.2em] h-14">Platform</TableHead>
              <TableHead className="px-6 font-bold text-[10px] uppercase tracking-[0.2em] h-14">Order ID</TableHead>
              <TableHead className="px-6 font-bold text-[10px] uppercase tracking-[0.2em] h-14">SKU</TableHead>
              <TableHead className="px-6 text-center font-bold text-[10px] uppercase tracking-[0.2em] h-14">QTY</TableHead>
              <TableHead className="px-6 font-bold text-[10px] uppercase tracking-[0.2em] h-14">Type / Reason</TableHead>
              <TableHead className="px-6 font-bold text-[10px] uppercase tracking-[0.2em] h-14">Detailed Reason</TableHead>
              <TableHead className="px-6 text-right font-bold text-[10px] uppercase tracking-[0.2em] h-14">Actions</TableHead>
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
              returns.map((item) => (
                <TableRow key={item.id} className="border-border/50 hover:bg-primary/5 transition-colors group">
                  <TableCell className="px-6 py-4 font-medium text-xs whitespace-nowrap">
                    {item.return_date ? format(new Date(item.return_date), 'dd MMM yyyy') : '-'}
                  </TableCell>
                  <TableCell className="px-6 py-4">
                    <Badge variant="outline" className="text-[10px] uppercase font-black tracking-tighter px-2.5 bg-background shadow-sm">
                      {item.platform}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-6 py-4 font-mono text-[11px] font-bold text-foreground/80">
                    <div className="flex flex-col gap-0.5">
                      <span>{item.external_order_id || 'N/A'}</span>
                      {item.external_suborder_id && (
                        <span className="text-[9px] text-muted-foreground font-medium">{item.external_suborder_id}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="px-6 py-4">
                    <span className="font-bold text-xs text-primary hover:underline cursor-pointer">
                      {item.variant_sku}
                    </span>
                  </TableCell>
                  <TableCell className="px-6 py-4 text-center font-bold text-xs text-foreground/70">
                    {item.quantity}
                  </TableCell>
                  <TableCell className="px-6 py-4">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[11px] font-bold uppercase text-foreground">{item.return_type || 'OTHER'}</span>
                      <span className="text-[10px] font-medium text-muted-foreground line-clamp-1">{item.return_reason || 'NA'}</span>
                      <span className="text-[9px] font-medium text-muted-foreground/60 line-clamp-1">{item.detailed_return_reason || 'NA'}</span>
                    </div>
                  </TableCell>
                  <TableCell className="px-6 py-4">
                    <span className="text-[10px] font-medium text-muted-foreground line-clamp-2 max-w-[180px]">
                      {item.detailed_return_reason || '-'}
                    </span>
                  </TableCell>
                  <TableCell className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:bg-primary/10 rounded-lg" onClick={() => onEdit(item)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10 rounded-lg" onClick={() => onDelete(item)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="p-6 border-t border-border/50 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
          Showing <span className="text-foreground">{startRange}</span> to <span className="text-foreground">{endRange}</span> of <span className="text-foreground">{totalRecords}</span> records
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
