"use client"

import React, { useEffect, useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { formatINR } from '@/lib/format';

import {
  Card,
  CardContent,
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
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PlusCircle, Pencil, Trash2, Wallet } from 'lucide-react';
import { AddPayoutModal } from './components/add-payout-modal';
import { SummaryStatCard } from '@/components/SummaryStatCard';

export type PlatformPayout = {
  id: string;
  gst_account: 'Fashion' | 'Cosmetics';
  platform: 'Meesho' | 'Flipkart' | 'Amazon';
  amount: number;
  payout_date: string;
  reference: string | null;
  is_deleted: boolean;
};

export default function PaymentsPage() {
  const { toast } = useToast();

  const [payouts, setPayouts] = useState<PlatformPayout[]>([]);
  const [totalReceived, setTotalReceived] = useState(0);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingPayouts, setLoadingPayouts] = useState(true);

  const [isAddPayoutOpen, setIsAddPayoutOpen] = useState(false);
  const [payoutToEdit, setPayoutToEdit] = useState<PlatformPayout | null>(null);
  const [itemToDelete, setItemToDelete] = useState<{ id: string; description: string } | null>(null);

  // Payouts pagination and filtering
  const [payoutsPage, setPayoutsPage] = useState(1);
  const [payoutsPageSize] = useState(10);
  const [payoutsTotalRows, setPayoutsTotalRows] = useState(0);
  const [accountFilter, setAccountFilter] = useState('all');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');

  const fetchSummary = useCallback(async () => {
    setLoadingSummary(true);
    try {
      const res = await fetch('/api/payments-summary');
      if (!res.ok) throw new Error('Failed to fetch payments summary');
      const data = await res.json();
      setTotalReceived(data.total_received);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setLoadingSummary(false);
    }
  }, [toast]);

  const fetchPayouts = useCallback(async () => {
    setLoadingPayouts(true);
    try {
      const params = new URLSearchParams({
        page: payoutsPage.toString(),
        pageSize: payoutsPageSize.toString(),
        account: accountFilter,
        platform: platformFilter,
        from: dateFromFilter,
        to: dateToFilter,
      });

      const res = await fetch(`/api/payouts?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch payouts');
      const { data, count } = await res.json();
      setPayouts(data);
      setPayoutsTotalRows(count);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch platform payouts.' });
      setPayouts([]);
    } finally {
      setLoadingPayouts(false);
    }
  }, [toast, payoutsPage, payoutsPageSize, accountFilter, platformFilter, dateFromFilter, dateToFilter]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  useEffect(() => {
    fetchPayouts();
  }, [fetchPayouts]);

  useEffect(() => {
    setPayoutsPage(1);
  }, [accountFilter, platformFilter, dateFromFilter, dateToFilter]);

  const handleSuccess = () => {
    fetchSummary();
    fetchPayouts();
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      const res = await fetch(`/api/payouts?id=${itemToDelete.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message);
      }
      toast({
        title: 'Success',
        description: `The payout has been deleted.`,
      });
      handleSuccess();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error deleting payout',
        description: error.message,
      });
    } finally {
      setItemToDelete(null);
    }
  };

  const resetPayoutFilters = () => {
    setAccountFilter('all');
    setPlatformFilter('all');
    setDateFromFilter('');
    setDateToFilter('');
  }

  return (
    <div className="w-full px-6 py-6 space-y-6">
      <AddPayoutModal
        isOpen={isAddPayoutOpen || !!payoutToEdit}
        onClose={() => { setIsAddPayoutOpen(false); setPayoutToEdit(null); }}
        onSuccess={handleSuccess}
        payout={payoutToEdit}
      />
      
      <AlertDialog open={!!itemToDelete} onOpenChange={() => setItemToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark the item "{itemToDelete?.description}" as deleted. You cannot undo this action.
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

      <div className="max-w-md">
        <SummaryStatCard
          title="Total Payment Received"
          value={totalReceived}
          icon={<Wallet className="h-6 w-6 text-white" />}
          loading={loadingSummary}
        />
      </div>

      <Card>
        <CardHeader className="flex flex-row justify-between items-center">
          <CardTitle>Platform Payouts</CardTitle>
          <Button onClick={() => setIsAddPayoutOpen(true)}><PlusCircle className="mr-2 h-4 w-4" /> Add Payout</Button>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <Select value={accountFilter} onValueChange={setAccountFilter}>
              <SelectTrigger><SelectValue placeholder="Filter by Account..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Accounts</SelectItem>
                <SelectItem value="Fashion">Fashion</SelectItem>
                <SelectItem value="Cosmetics">Cosmetics</SelectItem>
              </SelectContent>
            </Select>
            <Select value={platformFilter} onValueChange={setPlatformFilter}>
              <SelectTrigger><SelectValue placeholder="Filter by Platform..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Platforms</SelectItem>
                <SelectItem value="Meesho">Meesho</SelectItem>
                <SelectItem value="Flipkart">Flipkart</SelectItem>
                <SelectItem value="Amazon">Amazon</SelectItem>
              </SelectContent>
            </Select>
            <Input type="date" value={dateFromFilter} onChange={e => setDateFromFilter(e.target.value)} placeholder="From Date" />
            <Input type="date" value={dateToFilter} onChange={e => setDateToFilter(e.target.value)} placeholder="To Date" />
            <Button variant="outline" onClick={resetPayoutFilters}>Clear</Button>
          </div>
          <div className="rounded-md border max-h-[600px] overflow-y-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Accounts</TableHead><TableHead>Platform</TableHead><TableHead>Reference</TableHead><TableHead className="text-right">Amount</TableHead><TableHead className="text-right w-[100px]">Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {loadingPayouts ? Array.from({ length: payoutsPageSize }).map((_, i) => <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-8 w-full" /></TableCell></TableRow>)
                  : payouts.length > 0 ? payouts.map(p => (
                    <TableRow key={p.id}>
                      <TableCell>{format(new Date(p.payout_date), 'dd MMM yyyy')}</TableCell>
                      <TableCell><Badge variant="secondary">{p.gst_account}</Badge></TableCell>
                      <TableCell><Badge variant="outline">{p.platform}</Badge></TableCell>
                      <TableCell>{p.reference || 'N/A'}</TableCell>
                      <TableCell className="text-right font-medium">{formatINR(p.amount)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setPayoutToEdit(p)}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive" onClick={() => setItemToDelete({ id: p.id, description: `Payout from ${p.platform} (${formatINR(p.amount)})` })}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                    : <TableRow><TableCell colSpan={6} className="h-24 text-center">No payouts match your criteria.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-end space-x-2 py-4">
            <span className="text-sm text-muted-foreground">
              {payoutsTotalRows > 0 ? `Page ${payoutsPage} of ${Math.ceil(payoutsTotalRows / payoutsPageSize)}` : 'Page 0 of 0'}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPayoutsPage(p => p - 1)}
              disabled={payoutsPage === 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPayoutsPage(p => p + 1)}
              disabled={(payoutsPage * payoutsPageSize) >= payoutsTotalRows}
            >
              Next
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
