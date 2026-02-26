"use client"

import React, { useEffect, useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { formatINR } from '@/lib/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { PlusCircle, Pencil, Trash2, User, ArrowDownCircle, TrendingUp, TrendingDown } from 'lucide-react';
import { AddExpenseModal } from './components/add-expense-modal';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/apiFetch';

export type BusinessExpense = {
  id: string;
  description: string;
  amount: number;
  expense_date: string;
  is_deleted: boolean;
  created_by_name?: string;
};

const StatCard = ({ title, value, icon: Icon, gradient, loading }: { title: string; value: string; icon: React.ElementType; gradient: string; loading: boolean }) => (
    <Card className={cn("text-white shadow-lg rounded-2xl border-0 overflow-hidden bg-gradient-to-br", gradient)}>
        {loading ? <div className="p-6 flex items-center justify-between"><Skeleton className="h-10 w-40 bg-white/20" /></div> : (
            <div className="p-6 flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-medium uppercase tracking-wider">{title}</h3>
                    <p className="text-4xl font-bold font-headline mt-2">{value}</p>
                </div>
                <Icon className="h-8 w-8 text-white/80" />
            </div>
        )}
    </Card>
);

export default function ExpensesPage() {
  const { toast } = useToast();
  const [expenses, setExpenses] = useState<BusinessExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [netCashFlow, setNetCashFlow] = useState(0);
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [expenseToEdit, setExpenseToEdit] = useState<BusinessExpense | null>(null);
  const [itemToDelete, setItemToDelete] = useState<{id: string, description: string} | null>(null);
  const [page, setPage] = useState(1);
  const [totalRows, setTotalRows] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchFinanceSummary = useCallback(async () => {
    setLoading(true);
    try {
        const res = await apiFetch('/api/finance-summary');
        if (!res.ok) throw new Error('Failed to fetch finance summary');
        const data = await res.json();
        setTotalExpenses(data.total_expenses);
        setNetCashFlow(data.net_cash_flow);
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
        setLoading(false);
    }
  }, [toast]);

  const fetchExpenses = useCallback(async () => {
    try {
        const params = new URLSearchParams({ page: page.toString(), search: searchTerm });
        const res = await apiFetch(`/api/expenses?${params.toString()}`);
        if (!res.ok) throw new Error('Failed to fetch expenses');
        const { data, count } = await res.json();
        setExpenses(data);
        setTotalRows(count);
    } catch(error: any) {
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch business expenses.' });
    }
  }, [toast, page, searchTerm]);

  useEffect(() => { fetchFinanceSummary(); fetchExpenses(); }, [fetchFinanceSummary, fetchExpenses]);

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    try {
        const res = await apiFetch(`/api/expenses?id=${itemToDelete.id}`, { 
          method: 'DELETE',
        });
        if (!res.ok) throw new Error('Failed to delete');
        toast({ title: 'Success', description: `Deleted ${itemToDelete.description}` });
        fetchFinanceSummary(); fetchExpenses();
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
        setItemToDelete(null);
    }
  };

  return (
    <div className="w-full px-6 py-6 space-y-6">
        <AddExpenseModal isOpen={isAddExpenseOpen || !!expenseToEdit} onClose={() => { setIsAddExpenseOpen(false); setExpenseToEdit(null); }} onSuccess={() => { fetchFinanceSummary(); fetchExpenses(); }} expense={expenseToEdit} />
        <AlertDialog open={!!itemToDelete} onOpenChange={() => setItemToDelete(null)}>
            <AlertDialogContent>
                <AlertDialogHeader><AlertDialogTitle>Confirm Delete</AlertDialogTitle><AlertDialogDescription>This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleConfirmDelete}>Delete</AlertDialogAction></AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <StatCard title="Total Expenses" value={formatINR(totalExpenses)} icon={ArrowDownCircle} gradient="from-red-500 to-orange-500" loading={loading} />
            <div className={cn("rounded-2xl p-6 shadow-lg text-white", netCashFlow >= 0 ? "bg-gradient-to-r from-indigo-500 to-blue-600" : "bg-gradient-to-r from-red-500 to-orange-500")}>
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-xs tracking-widest uppercase opacity-80 font-bold">Net Cash Flow</p>
                        <h2 className="text-4xl font-bold mt-2">{formatINR(netCashFlow)}</h2>
                    </div>
                    {netCashFlow >= 0 ? <TrendingUp className="h-8 w-8" /> : <TrendingDown className="h-8 w-8" />}
                </div>
            </div>
        </div>

        <Card>
            <CardHeader className="flex flex-row justify-between items-center">
                <CardTitle>Business Expenses</CardTitle>
                <Button onClick={() => setIsAddExpenseOpen(true)}><PlusCircle className="mr-2 h-4 w-4" /> Add Expense</Button>
            </CardHeader>
            <CardContent>
                <Input placeholder="Search..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="mb-4" />
                <Table>
                    <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Amount</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {expenses.map(e => (
                            <TableRow key={e.id}>
                                <TableCell>{format(new Date(e.expense_date), 'dd MMM yyyy')}</TableCell>
                                <TableCell>{e.description}</TableCell>
                                <TableCell className="text-right font-medium">{formatINR(e.amount)}</TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-1">
                                        <Button variant="ghost" size="icon" onClick={() => setExpenseToEdit(e)}><Pencil className="h-4 w-4" /></Button>
                                        <Button variant="ghost" size="icon" onClick={() => setItemToDelete({id: e.id, description: e.description})}><Trash2 className="h-4 w-4" /></Button>
                                    </div>
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
