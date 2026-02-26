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
import { PlusCircle, Pencil, Trash2, User, ArrowDownCircle } from 'lucide-react';
import { AddExpenseModal } from './components/add-expense-modal';

export type BusinessExpense = {
  id: string;
  description: string;
  amount: number;
  expense_date: string;
  is_deleted: boolean;
  created_by_name?: string;
  updated_by_name?: string;
};

const StatCard = ({ title, value, icon: Icon, gradient, loading }: { title: string; value: string; icon: React.ElementType; gradient: string; loading: boolean }) => (
    <Card className={`text-white shadow-lg rounded-2xl border-0 overflow-hidden bg-gradient-to-br ${gradient}`}>
        {loading ? (
            <div className="p-6 flex items-center justify-between">
                <div>
                    <Skeleton className="h-5 w-32 bg-white/20" />
                    <Skeleton className="h-10 w-40 mt-2 bg-white/20" />
                </div>
                <Skeleton className="h-12 w-12 rounded-full bg-white/20" />
            </div>
        ) : (
            <div className="p-6 flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-medium uppercase tracking-wider">{title}</h3>
                    <p className="text-4xl font-bold font-headline mt-2">{value}</p>
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
  const [loading, setLoading] = useState(true);
  const [totalExpenses, setTotalExpenses] = useState(0);

  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [expenseToEdit, setExpenseToEdit] = useState<BusinessExpense | null>(null);
  const [itemToDelete, setItemToDelete] = useState<{id: string, description: string} | null>(null);

  // Expenses pagination and filtering
  const [loadingExpenses, setLoadingExpenses] = useState(true);
  const [expensesPage, setExpensesPage] = useState(1);
  const [expensesPageSize] = useState(10);
  const [expensesTotalRows, setExpensesTotalRows] = useState(0);
  const [expenseDateFrom, setExpenseDateFrom] = useState('');
  const [expenseDateTo, setExpenseDateTo] = useState('');
  const [expenseSearch, setExpenseSearch] = useState('');

  const fetchTotals = useCallback(async () => {
    setLoading(true);
    try {
        const res = await fetch('/api/financials/summary');
        if (!res.ok) throw new Error('Failed to fetch summary');
        const data = await res.json();
        setTotalExpenses(data.totalExpenses);
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

  useEffect(() => {
    fetchTotals();
  }, [fetchTotals]);
  
  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);
  
  useEffect(() => {
    setExpensesPage(1);
  }, [expenseDateFrom, expenseDateTo, expenseSearch]);

  const handleSuccess = () => {
    fetchTotals();
    fetchExpenses();
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    try {
        const res = await fetch(`/api/expenses?id=${itemToDelete.id}`, { method: 'DELETE' });
        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.message);
        }
        toast({
            title: 'Success',
            description: `The expense has been deleted.`,
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

  return (
    <div className="w-full px-6 py-6 space-y-6">
        <AddExpenseModal 
            isOpen={isAddExpenseOpen || !!expenseToEdit} 
            onClose={() => { setIsAddExpenseOpen(false); setExpenseToEdit(null); }} 
            onSuccess={handleSuccess}
            expense={expenseToEdit}
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
            <StatCard 
                title="Total Expenses"
                value={formatINR(totalExpenses)}
                icon={ArrowDownCircle}
                gradient="from-red-500 to-orange-500"
                loading={loading}
            />
        </div>

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
                <div className="rounded-md border max-h-[600px] overflow-y-auto">
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
                                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive" onClick={() => setItemToDelete({id: e.id, description: e.description})}><Trash2 className="h-4 w-4" /></Button>
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
    </div>
  );
}
