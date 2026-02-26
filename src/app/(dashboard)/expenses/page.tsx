"use client"

import React, { useEffect, useState, useMemo, useCallback } from 'react';
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
import { PlusCircle, ArrowDownCircle, ArrowUpCircle, Scale, Pencil, Trash2, ShoppingBag, Sparkles, User } from 'lucide-react';
import { AddExpenseModal } from './components/add-expense-modal';
import { AddPayoutModal } from './components/add-payout-modal';

export type BusinessExpense = {
  id: string;
  description: string;
  amount: number;
  expense_date: string;
  is_deleted: boolean;
  created_by_name?: string;
  updated_by_name?: string;
};

export type PlatformPayout = {
  id: string;
  gst_account: 'Fashion' | 'Cosmetics';
  platform: 'Meesho' | 'Flipkart' | 'Amazon';
  amount: number;
  payout_date: string;
  reference: string | null;
  is_deleted: boolean;
};

type ItemToDelete = {
  id: string;
  type: 'expense' | 'payout';
  description: string;
}

const StatCard = ({ title, value, icon: Icon, gradient, loading, subtext }: { title: string; value: string; icon: React.ElementType; gradient: string; loading: boolean, subtext?: string }) => (
    <Card className={`text-white shadow-lg rounded-2xl border-0 overflow-hidden bg-gradient-to-br ${gradient}`}>
        {loading ? (
            <div className="p-6 flex items-center justify-between">
                <div>
                    <Skeleton className="h-5 w-32 bg-white/20" />
                    <Skeleton className="h-10 w-40 mt-2 bg-white/20" />
                    {subtext && <Skeleton className="h-4 w-48 mt-1 bg-white/20" />}
                </div>
                <Skeleton className="h-12 w-12 rounded-full bg-white/20" />
            </div>
        ) : (
            <div className="p-6 flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-medium uppercase tracking-wider">{title}</h3>
                    <p className="text-4xl font-bold font-headline mt-2">{value}</p>
                    {subtext && <p className="text-xs text-white/80 mt-1">{subtext}</p>}
                </div>
                <div className="p-3 bg-white/20 rounded-full">
                    <Icon className="h-6 w-6 text-white" />
                </div>
            </div>
        )}
    </Card>
);

export default function ExpensesPage() {
  const { toast } = useToast();

  const [expenses, setExpenses] = useState<BusinessExpense[]>([]);
  const [payouts, setPayouts] = useState<PlatformPayout[]>([]);
  const [loading, setLoading] = useState(true);

  const [totalExpenses, setTotalExpenses] = useState(0);
  const [totalPayouts, setTotalPayouts] = useState(0);
  const [totalFashionPayouts, setTotalFashionPayouts] = useState(0);
  const [totalCosmeticsPayouts, setTotalCosmeticsPayouts] = useState(0);

  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [expenseToEdit, setExpenseToEdit] = useState<BusinessExpense | null>(null);
  
  const [isAddPayoutOpen, setIsAddPayoutOpen] = useState(false);
  const [payoutToEdit, setPayoutToEdit] = useState<PlatformPayout | null>(null);

  const [itemToDelete, setItemToDelete] = useState<ItemToDelete | null>(null);

  // Expenses pagination and filtering
  const [loadingExpenses, setLoadingExpenses] = useState(true);
  const [expensesPage, setExpensesPage] = useState(1);
  const [expensesPageSize] = useState(10);
  const [expensesTotalRows, setExpensesTotalRows] = useState(0);
  const [expenseDateFrom, setExpenseDateFrom] = useState('');
  const [expenseDateTo, setExpenseDateTo] = useState('');
  const [expenseSearch, setExpenseSearch] = useState('');

  // Payouts pagination and filtering
  const [loadingPayouts, setLoadingPayouts] = useState(true);
  const [payoutsPage, setPayoutsPage] = useState(1);
  const [payoutsPageSize] = useState(10);
  const [payoutsTotalRows, setPayoutsTotalRows] = useState(0);
  const [accountFilter, setAccountFilter] = useState('all');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');

  const fetchTotals = useCallback(async () => {
    setLoading(true);
    try {
        const res = await fetch('/api/financials/summary');
        if (!res.ok) throw new Error('Failed to fetch summary');
        const data = await res.json();
        
        setTotalExpenses(data.totalExpenses);
        setTotalPayouts(data.totalPayouts);
        setTotalFashionPayouts(data.totalFashionPayouts);
        setTotalCosmeticsPayouts(data.totalCosmeticsPayouts);

    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
        setLoading(false);
    }
  }, [toast]);

  const fetchExpenses = useCallback(async () => {
    setLoadingExpenses(true);
    try {
        const params = new URLSearchParams({
            page: expensesPage.toString(),
            pageSize: expensesPageSize.toString(),
            from: expenseDateFrom,
            to: expenseDateTo,
            search: expenseSearch,
        });
        const res = await fetch(`/api/expenses?${params.toString()}`);
        if (!res.ok) throw new Error('Failed to fetch expenses');
        const { data, count } = await res.json();
        setExpenses(data);
        setExpensesTotalRows(count);
    } catch(error: any) {
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch business expenses.' });
        setExpenses([]);
    } finally {
        setLoadingExpenses(false);
    }
  }, [toast, expensesPage, expensesPageSize, expenseDateFrom, expenseDateTo, expenseSearch]);

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
    } catch(error: any) {
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch platform payouts.' });
        setPayouts([]);
    } finally {
        setLoadingPayouts(false);
    }
  }, [toast, payoutsPage, payoutsPageSize, accountFilter, platformFilter, dateFromFilter, dateToFilter]);

  useEffect(() => {
    fetchTotals();
  }, [fetchTotals]);
  
  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);
  
  useEffect(() => {
    fetchPayouts();
  }, [fetchPayouts]);
  
  useEffect(() => {
    setExpensesPage(1);
  }, [expenseDateFrom, expenseDateTo, expenseSearch]);

  useEffect(() => {
    setPayoutsPage(1);
  }, [accountFilter, platformFilter, dateFromFilter, dateToFilter]);


  const handleSuccess = () => {
    fetchTotals();
    fetchExpenses();
    fetchPayouts();
  };

  const netFlow = totalPayouts - totalExpenses;

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    const { id, type } = itemToDelete;
    const endpoint = type === 'expense' ? '/api/expenses' : '/api/payouts';

    try {
        const res = await fetch(`${endpoint}?id=${id}`, { method: 'DELETE' });
        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.message);
        }
        toast({
            title: 'Success',
            description: `The ${itemToDelete.type} has been deleted.`,
        });
        handleSuccess();

    } catch (error: any) {
        toast({
            variant: 'destructive',
            title: 'Error deleting item',
            description: error.message,
        });
    } finally {
        setItemToDelete(null);
    }
  };
  
  const resetExpenseFilters = () => {
      setExpenseDateFrom('');
      setExpenseDateTo('');
      setExpenseSearch('');
  }

  const resetPayoutFilters = () => {
      setAccountFilter('all');
      setPlatformFilter('all');
      setDateFromFilter('');
      setDateToFilter('');
  }

  return (
    <div className="w-full px-6 py-6 space-y-6">
        <AddExpenseModal 
            isOpen={isAddExpenseOpen || !!expenseToEdit} 
            onClose={() => { setIsAddExpenseOpen(false); setExpenseToEdit(null); }} 
            onSuccess={handleSuccess}
            expense={expenseToEdit}
        />
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard 
                title="Total Expenses"
                value={formatINR(totalExpenses)}
                icon={ArrowDownCircle}
                gradient="from-red-500 to-orange-500"
                loading={loading}
            />
            <StatCard 
                title="Total Platform Receipts"
                value={formatINR(totalPayouts)}
                icon={ArrowUpCircle}
                gradient="from-emerald-500 to-green-500"
                loading={loading}
            />
             <StatCard 
                title="Net Cash Flow"
                value={formatINR(netFlow)}
                icon={Scale}
                gradient={netFlow >= 0 ? "from-blue-500 to-indigo-500" : "from-amber-500 to-yellow-500"}
                loading={loading}
            />
        </div>

        <div>
            <h3 className="text-lg font-semibold mb-4">
              Platform Receipts by Account
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <StatCard 
                    title="Fashion Platform Receipts"
                    value={formatINR(totalFashionPayouts)}
                    icon={ShoppingBag}
                    gradient="from-purple-500 to-indigo-500"
                    loading={loading}
                    subtext="Total received in Fashion GST"
                />
                <StatCard 
                    title="Cosmetics Platform Receipts"
                    value={formatINR(totalCosmeticsPayouts)}
                    icon={Sparkles}
                    gradient="from-teal-500 to-cyan-600"
                    loading={loading}
                    subtext="Total received in Cosmetics GST"
                />
            </div>
        </div>

        <div className="w-full space-y-6">
            <Card>
                <CardHeader className="flex flex-row justify-between items-center">
                    <CardTitle>Business Expenses</CardTitle>
                    <Button onClick={() => setIsAddExpenseOpen(true)}><PlusCircle className="mr-2 h-4 w-4" /> Add Expense</Button>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col md:flex-row gap-4 mb-4">
                        <Input type="date" value={expenseDateFrom} onChange={e => setExpenseDateFrom(e.target.value)} placeholder="From Date" />
                        <Input type="date" value={expenseDateTo} onChange={e => setExpenseDateTo(e.target.value)} placeholder="To Date" />
                        <Input placeholder="Search description..." value={expenseSearch} onChange={e => setExpenseSearch(e.target.value)} />
                        <Button variant="outline" onClick={resetExpenseFilters}>Clear</Button>
                    </div>
                    <div className="rounded-md border max-h-[500px] overflow-y-auto">
                        <Table>
                            <TableHeader><TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                                <TableHead>Added By</TableHead>
                                <TableHead className="text-right w-[100px]">Actions</TableHead>
                            </TableRow></TableHeader>
                            <TableBody>
                                {loadingExpenses ? Array.from({length: 3}).map((_, i) => <TableRow key={i}><TableCell colSpan={5}><Skeleton className="h-8 w-full"/></TableCell></TableRow>)
                                : expenses.length > 0 ? expenses.map(e => (
                                    <TableRow key={e.id}>
                                        <TableCell>{format(new Date(e.expense_date), 'dd MMM yyyy')}</TableCell>
                                        <TableCell>{e.description}</TableCell>
                                        <TableCell className="text-right font-medium">{formatINR(e.amount)}</TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                <User className="h-3 w-3" />
                                                <span>{e.created_by_name ?? '-'}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1">
                                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setExpenseToEdit(e)}><Pencil className="h-4 w-4" /></Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive" onClick={() => setItemToDelete({id: e.id, type: 'expense', description: e.description})}><Trash2 className="h-4 w-4" /></Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                                : <TableRow><TableCell colSpan={5} className="h-24 text-center">No expenses match your criteria.</TableCell></TableRow>}
                            </TableBody>
                        </Table>
                    </div>
                     <div className="flex items-center justify-end space-x-2 py-4">
                        <span className="text-sm text-muted-foreground">
                           {expensesTotalRows > 0 ? `Page ${expensesPage} of ${Math.ceil(expensesTotalRows / expensesPageSize)}` : 'Page 0 of 0'}
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setExpensesPage(p => p - 1)}
                            disabled={expensesPage === 1}
                        >
                            Previous
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setExpensesPage(p => p + 1)}
                            disabled={(expensesPage * expensesPageSize) >= expensesTotalRows}
                        >
                            Next
                        </Button>
                    </div>
                </CardContent>
            </Card>

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
                    <div className="rounded-md border max-h-[500px] overflow-y-auto">
                        <Table>
                            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Accounts</TableHead><TableHead>Platform</TableHead><TableHead>Reference</TableHead><TableHead className="text-right">Amount</TableHead><TableHead className="text-right w-[100px]">Actions</TableHead></TableRow></TableHeader>
                            <TableBody>
                                 {loadingPayouts ? Array.from({length: payoutsPageSize}).map((_, i) => <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-8 w-full"/></TableCell></TableRow>)
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
                                                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive" onClick={() => setItemToDelete({id: p.id, type: 'payout', description: `Payout from ${p.platform}`})}><Trash2 className="h-4 w-4" /></Button>
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
    </div>
  );
}