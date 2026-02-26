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
import { apiFetch } from '@/lib/apiFetch';

export default function PaymentsPage() {
  const { toast } = useToast();

  const [payouts, setPayouts] = useState<any[]>([]);
  const [totalReceived, setTotalReceived] = useState(0);
  const [loading, setLoading] = useState(true);

  const [isAddPayoutOpen, setIsAddPayoutOpen] = useState(false);
  const [payoutToEdit, setPayoutToEdit] = useState<any>(null);
  const [itemToDelete, setItemToDelete] = useState<{ id: string; description: string } | null>(null);

  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalRows, setTotalRows] = useState(0);
  const [platformFilter, setPlatformFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        platform: platformFilter,
        fromDate: dateFrom,
        toDate: dateTo,
      });

      const res = await apiFetch(`/api/payments?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch payments data');
      const data = await res.json();
      
      setTotalReceived(data.totalPaymentReceived || 0);
      setPayouts(data.payouts || []);
      setTotalRows(data.total || 0);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setLoading(false);
    }
  }, [toast, page, pageSize, platformFilter, dateFrom, dateTo]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [platformFilter, dateFrom, dateTo]);

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      const res = await apiFetch(`/api/payments?id=${itemToDelete.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message);
      }
      toast({ title: 'Success', description: 'The payout has been deleted.' });
      fetchData();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error deleting payout', description: error.message });
    } finally {
      setItemToDelete(null);
    }
  };

  const resetFilters = () => {
    setPlatformFilter('all');
    setDateFrom('');
    setDateTo('');
  };

  return (
    <div className="w-full px-6 py-6 space-y-8">
      <AddPayoutModal
        isOpen={isAddPayoutOpen || !!payoutToEdit}
        onClose={() => { setIsAddPayoutOpen(false); setPayoutToEdit(null); }}
        onSuccess={fetchData}
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

      {/* Hero Header Card */}
      <div className="rounded-3xl p-12 bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-xl text-center">
          <p className="tracking-widest uppercase text-xs opacity-80 font-bold">Total Payment Received</p>
          {loading ? (
            <Skeleton className="h-16 w-64 mx-auto mt-4 bg-white/20" />
          ) : (
            <h1 className="text-6xl font-bold mt-4 font-headline">{formatINR(totalReceived)}</h1>
          )}
          <div className="w-16 h-1 bg-white/40 mx-auto my-4 rounded-full"></div>
          <p className="text-sm opacity-80">Total Platform Collections for this Account</p>
      </div>

      <Card>
        <CardHeader className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <CardTitle className="text-2xl font-headline">Platform Payouts</CardTitle>
          </div>
          <Button onClick={() => setIsAddPayoutOpen(true)}><PlusCircle className="mr-2 h-4 w-4" /> Add Payout</Button>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1">
              <Select value={platformFilter} onValueChange={setPlatformFilter}>
                <SelectTrigger><SelectValue placeholder="Platform" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Platforms</SelectItem>
                  <SelectItem value="Meesho">Meesho</SelectItem>
                  <SelectItem value="Flipkart">Flipkart</SelectItem>
                  <SelectItem value="Amazon">Amazon</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            </div>
            <div className="flex-1">
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </div>
            <Button variant="outline" onClick={resetFilters}>Reset</Button>
          </div>

          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>Account Name</TableHead>
                  <TableHead>Reference ID</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                  ))
                ) : payouts.length > 0 ? (
                  payouts.map(p => (
                    <TableRow key={p.id}>
                      <TableCell>{format(new Date(p.payout_date), 'dd MMM yyyy')}</TableCell>
                      <TableCell><Badge variant="outline">{p.platform}</Badge></TableCell>
                      <TableCell><Badge variant="secondary">{p.account_name}</Badge></TableCell>
                      <TableCell className="font-mono text-xs">{p.reference || 'N/A'}</TableCell>
                      <TableCell className="text-right font-bold text-emerald-600">{formatINR(p.amount)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => setPayoutToEdit(p)}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" className="hover:bg-destructive/10 hover:text-destructive" onClick={() => setItemToDelete({ id: p.id, description: `Payout from ${p.platform} (${formatINR(p.amount)})` })}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow><TableCell colSpan={6} className="h-24 text-center">No payout records found.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-end space-x-2 py-4">
            <span className="text-sm text-muted-foreground">
              {totalRows > 0 ? `Page ${page} of ${Math.ceil(totalRows / pageSize)}` : 'Page 0 of 0'}
            </span>
            <Button variant="outline" size="sm" onClick={() => setPage(p => p - 1)} disabled={page === 1}>Previous</Button>
            <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={(page * pageSize) >= totalRows}>Next</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
