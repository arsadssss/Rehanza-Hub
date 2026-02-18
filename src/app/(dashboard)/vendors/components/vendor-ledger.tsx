
"use client"

import React, { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { format } from 'date-fns';
import { formatCurrency } from '@/lib/format';
import { useToast } from '@/hooks/use-toast';
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
import type { VendorBalance } from '../page';

type VendorPurchase = {
  id: string;
  purchase_date: string;
  product_name: string;
  description: string | null;
  total_amount: number;
};

type VendorPayment = {
  id: string;
  payment_date: string;
  notes: string | null;
  amount: number;
};

type LedgerItem = {
  date: Date;
  description: string;
  debit: number;
  credit: number;
};

interface VendorLedgerProps {
  vendor: VendorBalance;
  onClose: () => void;
}

export function VendorLedger({ vendor, onClose }: VendorLedgerProps) {
  const supabase = createClient();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [ledgerItems, setLedgerItems] = useState<LedgerItem[]>([]);

  useEffect(() => {
    async function fetchLedgerData() {
      if (!vendor) return;
      setLoading(true);

      const [purchasesRes, paymentsRes] = await Promise.all([
        supabase.from('vendor_purchases').select('id, purchase_date, product_name, description, total_amount').eq('vendor_id', vendor.vendor_id),
        supabase.from('vendor_payments').select('id, payment_date, notes, amount').eq('vendor_id', vendor.vendor_id),
      ]);

      if (purchasesRes.error || paymentsRes.error) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: purchasesRes.error?.message || paymentsRes.error?.message || 'Failed to fetch ledger data.',
        });
        setLedgerItems([]);
        setLoading(false);
        return;
      }
      
      const purchases: LedgerItem[] = ((purchasesRes.data as VendorPurchase[]) || []).map(p => ({
        date: new Date(p.purchase_date),
        description: `Purchase: ${p.product_name || p.description || 'N/A'}`,
        debit: p.total_amount,
        credit: 0,
      }));

      const payments: LedgerItem[] = ((paymentsRes.data as VendorPayment[]) || []).map(p => ({
        date: new Date(p.payment_date),
        description: `Payment: ${p.notes || 'Payment received'}`,
        debit: 0,
        credit: p.amount,
      }));

      const combined = [...purchases, ...payments].sort((a, b) => a.date.getTime() - b.date.getTime());
      
      setLedgerItems(combined);
      setLoading(false);
    }

    fetchLedgerData();
  }, [vendor, supabase, toast]);

  const ledgerWithBalance = useMemo(() => {
    let runningBalance = 0;
    return ledgerItems.map(item => {
      runningBalance = runningBalance + item.debit - item.credit;
      return { ...item, balance: runningBalance };
    });
  }, [ledgerItems]);
  
  const finalBalance = ledgerWithBalance[ledgerWithBalance.length - 1]?.balance ?? 0;

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
              ) : ledgerWithBalance.length > 0 ? (
                ledgerWithBalance.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell>{format(item.date, 'dd MMM yyyy')}</TableCell>
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
