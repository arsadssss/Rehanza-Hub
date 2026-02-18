"use client"

import React from 'react';
import { format } from 'date-fns';
import { formatCurrency } from '@/lib/format';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import type { VendorBalance, LedgerItem } from '../page';

interface VendorLedgerProps {
  vendor: VendorBalance;
  ledgerItems: LedgerItem[];
  loading: boolean;
  onClose: () => void;
}

export function VendorLedger({ vendor, ledgerItems, loading, onClose }: VendorLedgerProps) {

  const finalBalance = ledgerItems[ledgerItems.length - 1]?.balance ?? 0;

  return (
    <Card className="shadow-lg bg-white/70 dark:bg-black/20 backdrop-blur-sm border-0 mt-6">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Vendor Ledger: {vendor.vendor_name}</CardTitle>
          <CardDescription>A complete history of purchases and payments.</CardDescription>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Debit (Purchase)</TableHead>
                <TableHead className="text-right">Credit (Paid)</TableHead>
                <TableHead className="text-right">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}><TableCell colSpan={5}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                ))
              ) : ledgerItems.length > 0 ? (
                ledgerItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{format(new Date(item.date), 'dd MMM yyyy')}</TableCell>
                    <TableCell>{item.description}</TableCell>
                    <TableCell className="text-right text-red-600 dark:text-red-500 font-medium">
                      {item.debit > 0 ? formatCurrency(item.debit) : '-'}
                    </TableCell>
                    <TableCell className="text-right text-green-600 dark:text-green-500 font-medium">
                      {item.credit > 0 ? formatCurrency(item.credit) : '-'}
                    </TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(item.balance)}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow><TableCell colSpan={5} className="h-24 text-center">No transactions found for this vendor.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
      <CardFooter className="justify-end font-bold text-lg border-t pt-4 mt-4">
        Final Balance Due: {formatCurrency(finalBalance)}
      </CardFooter>
    </Card>
  );
}
