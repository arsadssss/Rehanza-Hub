"use client"

import React, { useEffect, useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { formatINR } from '@/lib/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PlusCircle, Wallet } from 'lucide-react';
import { AddPayoutModal } from './components/add-payout-modal';

export default function PaymentsPage() {
  const { toast } = useToast();
  const [payouts, setPayouts] = useState<any[]>([]);
  const [totalReceived, setTotalReceived] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isAddPayoutOpen, setIsAddPayoutOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const accountId = sessionStorage.getItem("active_account") || "";
      const [pRes, sRes] = await Promise.all([
        fetch('/api/payouts', { headers: { "x-account-id": accountId } }),
        fetch('/api/payments-summary', { headers: { "x-account-id": accountId } })
      ]);
      if (pRes.ok) setPayouts((await pRes.json()).data);
      if (sRes.ok) setTotalReceived((await sRes.json()).total_received);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch data' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="w-full px-6 py-6 space-y-8">
      <AddPayoutModal isOpen={isAddPayoutOpen} onClose={() => setIsAddPayoutOpen(false)} onSuccess={fetchData} />
      <div className="rounded-3xl p-12 bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-xl text-center">
          <p className="tracking-widest uppercase text-xs opacity-80 font-bold">Total Payment Received</p>
          <h1 className="text-6xl font-bold mt-4 font-headline">{formatINR(totalReceived)}</h1>
      </div>
      <Card>
        <CardHeader className="flex flex-row justify-between items-center">
          <CardTitle>Platform Payouts</CardTitle>
          <Button onClick={() => setIsAddPayoutOpen(true)}><PlusCircle className="mr-2 h-4 w-4" /> Add Payout</Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Platform</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
            <TableBody>
              {payouts.map(p => (
                <TableRow key={p.id}>
                  <TableCell>{format(new Date(p.payout_date), 'dd MMM yyyy')}</TableCell>
                  <TableCell><Badge variant="outline">{p.platform}</Badge></TableCell>
                  <TableCell className="text-right font-bold">{formatINR(p.amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
