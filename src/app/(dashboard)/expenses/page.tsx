
"use client"

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { formatCurrency } from '@/lib/format';

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
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PlusCircle, ArrowDownCircle, ArrowUpCircle, Scale } from 'lucide-react';
import { AddExpenseModal } from './components/add-expense-modal';
import { AddPayoutModal } from './components/add-payout-modal';

type BusinessExpense = {
  id: string;
  gst_account: 'Fashion' | 'Cosmetics';
  category: string;
  description: string;
  amount: number;
  expense_date: string;
};

type PlatformPayout = {
  id: string;
  gst_account: 'Fashion' | 'Cosmetics';
  platform: 'Meesho' | 'Flipkart' | 'Amazon';
  amount: number;
  payout_date: string;
  reference: string | null;
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
  const supabase = createClient();
  const { toast } = useToast();

  const [expenses, setExpenses] = useState<BusinessExpense[]>([]);
  const [payouts, setPayouts] = useState<PlatformPayout[]>([]);
  const [loading, setLoading] = useState(true);

  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [isAddPayoutOpen, setIsAddPayoutOpen] = useState(false);
  
  const fetchData = useCallback(async () => {
    setLoading(true);
    const [expenseRes, payoutRes] = await Promise.all([
      supabase.from('business_expenses').select('*').order('expense_date', { ascending: false }),
      supabase.from('platform_payouts').select('*').order('payout_date', { ascending: false })
    ]);

    if (expenseRes.error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch business expenses.' });
      setExpenses([]);
    } else {
      setExpenses(expenseRes.data as BusinessExpense[]);
    }
    
    if (payoutRes.error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch platform payouts.' });
      setPayouts([]);
    } else {
      setPayouts(payoutRes.data as PlatformPayout[]);
    }
    
    setLoading(false);
  }, [supabase, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDataAdded = () => {
    fetchData();
  };

  const { totalExpenses, totalPayouts, netFlow } = useMemo(() => {
    const totalExpenses = expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const totalPayouts = payouts.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const netFlow = totalPayouts - totalExpenses;
    return { totalExpenses, totalPayouts, netFlow };
  }, [expenses, payouts]);

  return (
    <div className="w-full px-6 py-6 space-y-6">
        <AddExpenseModal isOpen={isAddExpenseOpen} onClose={() => setIsAddExpenseOpen(false)} onExpenseAdded={handleDataAdded} />
        <AddPayoutModal isOpen={isAddPayoutOpen} onClose={() => setIsAddPayoutOpen(false)} onPayoutAdded={handleDataAdded} />
      
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard 
                title="Total Expenses"
                value={formatCurrency(totalExpenses)}
                icon={ArrowDownCircle}
                gradient="from-red-500 to-orange-500"
                loading={loading}
            />
            <StatCard 
                title="Total Platform Receipts"
                value={formatCurrency(totalPayouts)}
                icon={ArrowUpCircle}
                gradient="from-emerald-500 to-green-500"
                loading={loading}
            />
             <StatCard 
                title="Net Cash Flow"
                value={formatCurrency(netFlow)}
                icon={Scale}
                gradient={netFlow >= 0 ? "from-blue-500 to-indigo-500" : "from-amber-500 to-yellow-500"}
                loading={loading}
            />
        </div>

        <div className="w-full space-y-6">
            <Card>
                <CardHeader className="flex flex-row justify-between items-center">
                    <CardTitle>Business Expenses</CardTitle>
                    <Button onClick={() => setIsAddExpenseOpen(true)}><PlusCircle className="mr-2 h-4 w-4" /> Add Expense</Button>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {loading ? Array.from({length: 3}).map((_, i) => <TableRow key={i}><TableCell colSpan={3}><Skeleton className="h-8 w-full"/></TableCell></TableRow>)
                                : expenses.length > 0 ? expenses.map(e => (
                                    <TableRow key={e.id}>
                                        <TableCell>{format(new Date(e.expense_date), 'dd MMM yyyy')}</TableCell>
                                        <TableCell>{e.description}</TableCell>
                                        <TableCell className="text-right font-medium">{formatCurrency(e.amount)}</TableCell>
                                    </TableRow>
                                ))
                                : <TableRow><TableCell colSpan={3} className="h-24 text-center">No expenses recorded yet.</TableCell></TableRow>}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row justify-between items-center">
                    <CardTitle>Platform Payouts</CardTitle>
                    <Button onClick={() => setIsAddPayoutOpen(true)}><PlusCircle className="mr-2 h-4 w-4" /> Add Payout</Button>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>GST Account</TableHead><TableHead>Platform</TableHead><TableHead>Reference</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                            <TableBody>
                                 {loading ? Array.from({length: 3}).map((_, i) => <TableRow key={i}><TableCell colSpan={5}><Skeleton className="h-8 w-full"/></TableCell></TableRow>)
                                : payouts.length > 0 ? payouts.map(p => (
                                    <TableRow key={p.id}>
                                        <TableCell>{format(new Date(p.payout_date), 'dd MMM yyyy')}</TableCell>
                                        <TableCell><Badge variant="secondary">{p.gst_account}</Badge></TableCell>
                                        <TableCell><Badge variant="outline">{p.platform}</Badge></TableCell>
                                        <TableCell>{p.reference || 'N/A'}</TableCell>
                                        <TableCell className="text-right font-medium">{formatCurrency(p.amount)}</TableCell>
                                    </TableRow>
                                ))
                                : <TableRow><TableCell colSpan={5} className="h-24 text-center">No payouts recorded yet.</TableCell></TableRow>}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    </div>
  );
}
