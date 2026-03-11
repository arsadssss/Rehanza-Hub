"use client"

import React, { useEffect, useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { formatINR } from '@/lib/format';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  PlusCircle, 
  Pencil, 
  Trash2, 
  User, 
  ArrowDownCircle, 
  TrendingUp, 
  TrendingDown, 
  Search, 
  FilterX, 
  Calendar,
  BarChart3,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { AddExpenseModal } from './components/add-expense-modal';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/apiFetch';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';

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
  const [isMounted, setIsMounted] = useState(false);
  const [expenses, setExpenses] = useState<BusinessExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingChart, setLoadingChart] = useState(true);
  
  // Account detection state
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);

  // Summary Stats
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [netCashFlow, setNetCashFlow] = useState(0);
  const [weeklySpend, setWeeklySpend] = useState(0);
  
  // Chart Data
  const [chartData, setChartData] = useState<any[]>([]);

  // Modals
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [expenseToEdit, setExpenseToEdit] = useState<BusinessExpense | null>(null);
  const [itemToDelete, setItemToDelete] = useState<{id: string, description: string} | null>(null);

  // Pagination & Filters
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRows, setTotalRows] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [userFilter, setUserFilter] = useState('all');
  const [rangeFilter, setRangeFilter] = useState('all');
  const [users, setUsers] = useState<{id: string, name: string}[]>([]);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await apiFetch('/api/users');
      if (res.ok) setUsers(await res.json());
    } catch (e) { console.error(e); }
  }, []);

  const fetchFinanceSummary = useCallback(async () => {
    if (!activeAccountId) return;
    setLoading(true);
    try {
        // 1. Fetch all accounts to calculate global payouts
        const accountsRes = await fetch('/api/accounts');
        const accountsData = await accountsRes.json();
        
        let totalGlobalPayouts = 0;
        if (accountsData.success && Array.isArray(accountsData.data)) {
          // Fetch payments-summary for each account to get total received
          const payoutPromises = accountsData.data.map((acc: any) => 
            fetch('/api/payments-summary', {
              headers: { 'x-account-id': acc.id }
            }).then(r => r.json())
          );
          const summaries = await Promise.all(payoutPromises);
          totalGlobalPayouts = summaries.reduce((sum, s) => sum + (Number(s.total_received) || 0), 0);
        }

        // 2. Fetch global expenses and weekly spend
        // The backend returns global values for these fields even when scoped by account
        const res = await apiFetch('/api/finance-summary');
        if (!res.ok) throw new Error('Failed to fetch global finance summary');
        const data = await res.json();
        
        setTotalExpenses(data.total_expenses);
        setWeeklySpend(data.weekly_spend);
        
        // 3. Set global Net Cash Flow (Total Payouts from ALL Accounts - Global Expenses)
        setNetCashFlow(totalGlobalPayouts - data.total_expenses);
        
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
        setLoading(false);
    }
  }, [toast, activeAccountId]);

  const fetchAnalytics = useCallback(async () => {
    setLoadingChart(true);
    try {
      const res = await apiFetch('/api/expenses/analytics');
      if (res.ok) {
        const data = await res.json();
        setChartData(data.trend);
      }
    } catch (e) { console.error(e); }
    finally { setLoadingChart(false); }
  }, []);

  const fetchExpenses = useCallback(async () => {
    try {
        const params = new URLSearchParams({ 
          page: page.toString(), 
          search: searchTerm,
          user: userFilter,
          range: rangeFilter
        });
        const res = await apiFetch(`/api/expenses?${params.toString()}`);
        if (!res.ok) throw new Error('Failed to fetch expenses');
        const { data, count, totalPages } = await res.json();
        setExpenses(data);
        setTotalRows(count);
        setTotalPages(totalPages);
    } catch(error: any) {
        toast({ variant: "destructive", title: "Error", description: 'Failed to fetch business expenses.' });
    }
  }, [toast, page, searchTerm, userFilter, rangeFilter]);

  useEffect(() => {
    setIsMounted(true);
    const id = sessionStorage.getItem("active_account");
    if (id) setActiveAccountId(id);

    const handleAccountInit = () => {
      const freshId = sessionStorage.getItem("active_account");
      if (freshId) setActiveAccountId(freshId);
    };

    window.addEventListener('active-account-changed', handleAccountInit);
    return () => window.removeEventListener('active-account-changed', handleAccountInit);
  }, []);

  useEffect(() => {
    fetchUsers();
    fetchAnalytics();
    if (activeAccountId) fetchFinanceSummary(); 
  }, [fetchUsers, fetchAnalytics, fetchFinanceSummary, activeAccountId]);

  useEffect(() => {
    if (activeAccountId) fetchExpenses(); 
  }, [fetchExpenses, activeAccountId]);

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    try {
        const res = await apiFetch(`/api/expenses?id=${itemToDelete.id}`, { 
          method: 'DELETE',
        });
        if (!res.ok) throw new Error('Failed to delete');
        toast({ title: 'Success', description: `Deleted ${itemToDelete.description}` });
        fetchFinanceSummary(); fetchExpenses(); fetchAnalytics();
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
        setItemToDelete(null);
    }
  };

  const resetFilters = () => {
    setSearchTerm('');
    setUserFilter('all');
    setRangeFilter('all');
    setPage(1);
  };

  if (!isMounted) {
    return <div className="p-6 space-y-6"><Skeleton className="h-20 w-full" /><Skeleton className="h-64 w-full" /></div>;
  }

  return (
    <div className="w-full px-6 py-6 space-y-8 bg-gray-50/50 dark:bg-black/50 min-h-screen">
        <AddExpenseModal isOpen={isAddExpenseOpen || !!expenseToEdit} onClose={() => { setIsAddExpenseOpen(false); setExpenseToEdit(null); }} onSuccess={() => { fetchFinanceSummary(); fetchExpenses(); fetchAnalytics(); }} expense={expenseToEdit} />
        <AlertDialog open={!!itemToDelete} onOpenChange={() => setItemToDelete(null)}>
            <AlertDialogContent>
                <AlertDialogHeader><AlertDialogTitle>Confirm Delete</AlertDialogTitle><AlertDialogDescription>This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleConfirmDelete}>Delete</AlertDialogAction></AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard title="Total Expenses" value={formatINR(totalExpenses)} icon={ArrowDownCircle} gradient="from-rose-500 to-red-600" loading={loading} />
            <div className={cn("rounded-2xl p-6 shadow-lg text-white", netCashFlow >= 0 ? "bg-gradient-to-r from-indigo-500 to-blue-600" : "bg-gradient-to-r from-red-500 to-orange-500")}>
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-xs tracking-widest uppercase opacity-80 font-bold">Net Cash Flow</p>
                        <h2 className="text-4xl font-bold mt-2">{formatINR(netCashFlow)}</h2>
                    </div>
                    {netCashFlow >= 0 ? <TrendingUp className="h-8 w-8" /> : <TrendingDown className="h-8 w-8" />}
                </div>
            </div>
            <StatCard title="Weekly Spend" value={formatINR(weeklySpend)} icon={Calendar} gradient="from-amber-500 to-orange-600" loading={loading} />
        </div>

        {/* Analytics Section */}
        <Card className="border-0 shadow-xl rounded-[2rem] overflow-hidden bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-xl">
                <BarChart3 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="font-headline text-xl">Weekly Expense Trend</CardTitle>
                <CardDescription>Analysis of global business expenditures grouped by week.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full mt-4">
              {loadingChart ? <Skeleton className="h-full w-full rounded-2xl" /> : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                    <XAxis 
                      dataKey="week" 
                      tick={{ fontSize: 10, fill: 'gray' }} 
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(val) => format(new Date(val), 'dd MMM')}
                    />
                    <YAxis 
                      tick={{ fontSize: 10, fill: 'gray' }} 
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(val) => `₹${val}`}
                    />
                    <Tooltip 
                      cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                      contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}
                      formatter={(val: any) => [formatINR(val), 'Total Spend']}
                      labelFormatter={(label) => `Week of ${format(new Date(label), 'dd MMM yyyy')}`}
                    />
                    <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index === chartData.length - 1 ? '#6366f1' : '#cbd5e1'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Listing and Filters */}
        <Card className="border-0 shadow-xl rounded-[2rem] overflow-hidden bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl">
            <CardHeader className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b bg-muted/30 pb-6 px-8">
                <div>
                    <CardTitle className="font-headline text-xl">Operational Log</CardTitle>
                    <CardDescription>Comprehensive history of all business expenses.</CardDescription>
                </div>
                <Button onClick={() => setIsAddExpenseOpen(true)} className="rounded-xl h-11 font-bold shadow-lg shadow-primary/20">
                  <PlusCircle className="mr-2 h-4 w-4" /> Add Expense
                </Button>
            </CardHeader>
            <CardContent className="p-8">
                {/* Filter Bar */}
                <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-8 items-end">
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Search Description</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input 
                        placeholder="Search for something..." 
                        value={searchTerm} 
                        onChange={e => { setSearchTerm(e.target.value); setPage(1); }} 
                        className="pl-9 h-11 rounded-xl bg-background border-border/50"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Added By</label>
                    <Select value={userFilter} onValueChange={(v) => { setUserFilter(v); setPage(1); }}>
                      <SelectTrigger className="h-11 rounded-xl bg-background border-border/50">
                        <SelectValue placeholder="All Users" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Users</SelectItem>
                        {users.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Time Period</label>
                    <Select value={rangeFilter} onValueChange={(v) => { setRangeFilter(v); setPage(1); }}>
                      <SelectTrigger className="h-11 rounded-xl bg-background border-border/50">
                        <SelectValue placeholder="All Time" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Time</SelectItem>
                        <SelectItem value="today">Today Only</SelectItem>
                        <SelectItem value="7d">Last 7 Days</SelectItem>
                        <SelectItem value="30d">Last 30 Days</SelectItem>
                        <SelectItem value="month">Current Month</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Button variant="ghost" size="icon" onClick={resetFilters} className="h-11 w-11 rounded-xl hover:bg-destructive/10 hover:text-destructive transition-colors">
                    <FilterX className="h-4 w-4" />
                  </Button>
                </div>

                <div className="rounded-2xl border border-border/50 overflow-hidden bg-background/40">
                  <Table>
                      <TableHeader className="bg-muted/50">
                          <TableRow className="border-border/50 h-14">
                              <TableHead className="px-6 font-bold text-[10px] uppercase tracking-widest text-muted-foreground">Date</TableHead>
                              <TableHead className="px-6 font-bold text-[10px] uppercase tracking-widest text-muted-foreground">Description</TableHead>
                              <TableHead className="px-6 text-right font-bold text-[10px] uppercase tracking-widest text-muted-foreground">Amount</TableHead>
                              <TableHead className="px-6 font-bold text-[10px] uppercase tracking-widest text-muted-foreground">Added By</TableHead>
                              <TableHead className="px-6 text-right font-bold text-[10px] uppercase tracking-widest text-muted-foreground">Actions</TableHead>
                          </TableRow>
                      </TableHeader>
                      <TableBody>
                          {expenses.length > 0 ? expenses.map(e => (
                              <TableRow key={e.id} className="border-border/50 hover:bg-primary/5 transition-colors h-16">
                                  <TableCell className="px-6 font-medium text-xs">{format(new Date(e.expense_date), 'dd MMM yyyy')}</TableCell>
                                  <TableCell className="px-6 font-bold text-sm text-foreground">{e.description}</TableCell>
                                  <TableCell className="px-6 text-right font-black text-rose-600 dark:text-rose-400">{formatINR(e.amount)}</TableCell>
                                  <TableCell className="px-6">
                                      <div className="flex items-center gap-2">
                                          <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black text-[10px]">
                                            {(e.created_by_name || "S").charAt(0).toUpperCase()}
                                          </div>
                                          <span className="text-[11px] font-bold text-muted-foreground uppercase">{e.created_by_name || "System"}</span>
                                      </div>
                                  </TableCell>
                                  <TableCell className="px-6 text-right">
                                      <div className="flex justify-end gap-1">
                                          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-primary/10 hover:text-primary transition-colors" onClick={() => setExpenseToEdit(e)}><Pencil className="h-4 w-4" /></Button>
                                          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-destructive/10 hover:text-destructive transition-colors" onClick={() => setItemToDelete({id: e.id, description: e.description})}><Trash2 className="h-4 w-4" /></Button>
                                      </div>
                                  </TableCell>
                              </TableRow>
                          )) : (
                            <TableRow>
                              <TableCell colSpan={5} className="h-32 text-center text-muted-foreground italic">No expenses match your filters.</TableCell>
                            </TableRow>
                          )}
                      </TableBody>
                  </Table>
                </div>

                {/* Pagination Controls */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-8">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    Showing <span className="text-foreground">{(page - 1) * 10 + 1}</span> to <span className="text-foreground">{Math.min(page * 10, totalRows)}</span> of <span className="text-foreground">{totalRows}</span> expenses
                  </p>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setPage(p => Math.max(1, p - 1))} 
                      disabled={page === 1}
                      className="h-10 px-4 rounded-xl font-bold text-[10px] uppercase tracking-tighter"
                    >
                      <ChevronLeft className="mr-1 h-3 w-3" /> Previous
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
                        <Button
                          key={pageNum}
                          variant={page === pageNum ? "default" : "ghost"}
                          size="sm"
                          onClick={() => setPage(pageNum)}
                          className={cn("h-8 w-8 rounded-lg font-black text-xs", page === pageNum && "shadow-md shadow-primary/20")}
                        >
                          {pageNum}
                        </Button>
                      ))}
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))} 
                      disabled={page >= totalPages}
                      className="h-10 px-4 rounded-xl font-bold text-[10px] uppercase tracking-tighter"
                    >
                      Next <ChevronRight className="ml-1 h-3 w-3" />
                    </Button>
                  </div>
                </div>
            </CardContent>
        </Card>
    </div>
  );
}
