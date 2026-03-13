
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
  CardDescription 
} from '@/components/ui/card';
import { 
  Table, 
  TableHeader, 
  TableRow, 
  TableHead, 
  TableBody, 
  TableCell 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import { 
  ShoppingCart, 
  TrendingUp, 
  Calendar, 
  DollarSign, 
  Upload, 
  Search, 
  FilterX, 
  CheckCircle2, 
  AlertCircle,
  FileDown
} from 'lucide-react';
import { apiFetch } from '@/lib/apiFetch';
import { cn } from '@/lib/utils';

type Order = {
  id: string;
  external_order_id: string;
  order_date: string;
  platform: string;
  variant_sku: string;
  quantity: number;
  selling_price: number;
  total_amount: number;
  status: string;
};

type SummaryStats = {
  totalOrders: number;
  totalRevenue: number;
  todayOrders: number;
  todayRevenue: number;
};

type ImportSummary = {
  total_rows: number;
  imported: number;
  duplicates: number;
  failed: number;
  errors: any[];
};

const StatCard = ({ title, value, icon: Icon, gradient, loading }: { title: string; value: string; icon: any; gradient: string; loading: boolean }) => (
  <Card className="overflow-hidden border-0 shadow-lg group hover:shadow-xl transition-all duration-300 rounded-3xl">
    <div className={cn("p-6 flex items-center justify-between bg-gradient-to-br", gradient)}>
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-white/70 mb-1">{title}</p>
        {loading ? <Skeleton className="h-10 w-24 bg-white/20" /> : (
          <h2 className="text-3xl font-black text-white font-headline tracking-tighter">{value}</h2>
        )}
      </div>
      <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md group-hover:scale-110 transition-transform">
        <Icon className="h-6 w-6 text-white" />
      </div>
    </div>
  </Card>
);

export default function OrdersPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<SummaryStats | null>(null);
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  
  // Importer
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportSummary | null>(null);

  const fetchOrders = useCallback(async () => {
    if (!activeAccountId) return;
    try {
      const res = await apiFetch(`/api/orders?search=${searchTerm}&status=${statusFilter}`);
      if (res.ok) {
        const json = await res.json();
        setOrders(json.data || []);
      }
    } catch (e) {
      console.error(e);
    }
  }, [activeAccountId, searchTerm, statusFilter]);

  const fetchSummary = useCallback(async () => {
    if (!activeAccountId) return;
    try {
      const res = await apiFetch('/api/orders/summary');
      if (res.ok) {
        const json = await res.json();
        setStats(json.data);
      }
    } catch (e) {
      console.error(e);
    }
  }, [activeAccountId]);

  useEffect(() => {
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
    if (activeAccountId) {
      setLoading(true);
      Promise.all([fetchOrders(), fetchSummary()]).finally(() => setLoading(false));
    }
  }, [activeAccountId, fetchOrders, fetchSummary]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await apiFetch('/api/orders/import/meesho', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error('Import failed');
      
      const json = await res.json();
      setImportResult(json);
      fetchOrders();
      fetchSummary();
      
      toast({
        title: "Import Finished",
        description: `Successfully processed ${json.total_rows} rows.`
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Import Error',
        description: error.message
      });
    } finally {
      setIsImporting(false);
      e.target.value = '';
    }
  };

  const getStatusBadge = (status: string) => {
    const s = status?.toLowerCase();
    if (s?.includes('delivered') || s?.includes('shipped')) return "bg-emerald-500";
    if (s?.includes('cancel') || s?.includes('return')) return "bg-rose-500";
    if (s?.includes('ready')) return "bg-amber-500";
    return "bg-slate-500";
  };

  return (
    <div className="p-6 md:p-8 space-y-8 bg-gray-50/50 dark:bg-black/50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-4xl font-black tracking-tighter font-headline text-foreground">Marketplace Hub</h1>
          <p className="text-muted-foreground font-medium">Global orders management and marketplace synchronization.</p>
        </div>
        <div className="flex gap-3">
          <input
            type="file"
            id="report-upload"
            className="hidden"
            accept=".xlsx,.csv,.tsv"
            onChange={handleFileUpload}
          />
          <Button 
            onClick={() => document.getElementById('report-upload')?.click()}
            disabled={isImporting}
            className="rounded-2xl h-12 px-6 font-bold shadow-lg shadow-primary/20 bg-primary"
          >
            {isImporting ? <div className="h-4 w-4 border-2 border-white border-t-transparent animate-spin rounded-full mr-2" /> : <Upload className="mr-2 h-4 w-4" />}
            Upload Meesho Report
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Global Orders" value={stats?.totalOrders.toString() || '0'} icon={ShoppingCart} gradient="from-indigo-600 to-indigo-800" loading={loading} />
        <StatCard title="Total Revenue" value={formatINR(stats?.totalRevenue || 0)} icon={DollarSign} gradient="from-blue-600 to-blue-800" loading={loading} />
        <StatCard title="Today's Orders" value={stats?.todayOrders.toString() || '0'} icon={Calendar} gradient="from-teal-600 to-teal-800" loading={loading} />
        <StatCard title="Today's Revenue" value={formatINR(stats?.todayRevenue || 0)} icon={TrendingUp} gradient="from-emerald-600 to-emerald-800" loading={loading} />
      </div>

      {/* Filters */}
      <Card className="border-0 shadow-xl rounded-[2rem] overflow-hidden bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1 space-y-1.5">
              <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Universal Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search by Order ID or SKU..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-11 rounded-xl bg-background border-border/50" 
                />
              </div>
            </div>
            <div className="w-full md:w-48 space-y-1.5">
              <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-11 rounded-xl bg-background border-border/50">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Records</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="shipped">Shipped</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button 
              variant="outline" 
              onClick={() => { setSearchTerm(''); setStatusFilter('all'); }}
              className="h-11 w-11 rounded-xl border-border/50 hover:bg-rose-500/10 hover:text-rose-500"
            >
              <FilterX className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card className="border-0 shadow-2xl rounded-[2.5rem] overflow-hidden bg-white dark:bg-slate-900">
        <CardHeader className="bg-muted/30 px-8 py-6">
          <CardTitle className="text-xl font-headline font-black">Registry Log</CardTitle>
          <CardDescription>Comprehensive history of all marketplace transactions.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/50 h-14">
              <TableRow className="border-border/50 hover:bg-transparent">
                <TableHead className="pl-8 font-black text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Order ID</TableHead>
                <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Date</TableHead>
                <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Platform</TableHead>
                <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] text-muted-foreground">SKU Item</TableHead>
                <TableHead className="text-center font-black text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Qty</TableHead>
                <TableHead className="text-right font-black text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Total</TableHead>
                <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] text-muted-foreground text-center pr-8">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}><TableCell colSpan={7} className="h-16 pl-8"><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                ))
              ) : orders.length > 0 ? (
                orders.map((order) => (
                  <TableRow key={order.id} className="border-border/50 hover:bg-primary/5 transition-colors h-16">
                    <TableCell className="pl-8 font-bold text-xs font-mono text-muted-foreground">{order.external_order_id}</TableCell>
                    <TableCell className="font-bold text-xs">{format(new Date(order.order_date), 'dd MMM yyyy')}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] uppercase font-black bg-slate-100 dark:bg-slate-800 border-none">{order.platform}</Badge>
                    </TableCell>
                    <TableCell className="font-black text-sm text-indigo-600 dark:text-indigo-400">{order.variant_sku}</TableCell>
                    <TableCell className="text-center font-bold">{order.quantity}</TableCell>
                    <TableCell className="text-right font-black text-emerald-600 dark:text-emerald-400">{formatINR(order.total_amount)}</TableCell>
                    <TableCell className="text-center pr-8">
                      <Badge className={cn("text-white text-[9px] uppercase font-black px-2 py-0.5", getStatusBadge(order.status))}>
                        {order.status || 'Pending'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="h-64 text-center">
                    <div className="flex flex-col items-center justify-center text-muted-foreground gap-4 opacity-30">
                      <ShoppingCart className="h-16 w-16" />
                      <p className="text-sm font-black uppercase tracking-widest">No matching orders found</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Import Result Modal */}
      <Dialog open={!!importResult} onOpenChange={() => setImportResult(null)}>
        <DialogContent className="sm:max-w-lg rounded-[2rem]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl font-black">
              <CheckCircle2 className="h-6 w-6 text-emerald-500" />
              Import Completed
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30">
              <p className="text-[10px] font-black uppercase text-indigo-600 mb-1">Processed</p>
              <p className="text-3xl font-black">{importResult?.total_rows}</p>
            </div>
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30">
              <p className="text-[10px] font-black uppercase text-emerald-600 mb-1">Imported</p>
              <p className="text-3xl font-black">{importResult?.imported}</p>
            </div>
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30">
              <p className="text-[10px] font-black uppercase text-amber-600 mb-1">Duplicates</p>
              <p className="text-3xl font-black">{importResult?.duplicates}</p>
            </div>
            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30">
              <p className="text-[10px] font-black uppercase text-rose-600 mb-1">Failed</p>
              <p className="text-3xl font-black">{importResult?.failed}</p>
            </div>
          </div>
          {importResult?.errors && importResult.errors.length > 0 && (
            <div className="mt-2">
              <p className="text-xs font-bold text-rose-500 mb-2 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> Error Details
              </p>
              <div className="max-h-40 overflow-y-auto rounded-xl bg-muted/50 p-3 space-y-2">
                {importResult.errors.map((err, i) => (
                  <div key={i} className="text-[10px] font-medium leading-relaxed">
                    <span className="font-bold text-rose-600 mr-1">Row {err.row}:</span>
                    {err.message}
                  </div>
                ))}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setImportResult(null)} className="rounded-xl w-full font-bold">Close Results</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
