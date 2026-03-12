"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { formatINR } from "@/lib/format";
import { format, parseISO, isValid } from 'date-fns';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlusCircle, Pencil, Trash2, Search, FilterX, Package, CircleDollarSign, Undo2, TrendingDown, FileUp, Database, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AddOrderModal } from "./components/add-order-modal";
import { AddReturnModal } from "../returns/components/add-return-modal";
import { BulkUploadModal } from "./components/bulk-upload-modal";
import { BulkUploadReturnsModal } from "../returns/components/bulk-upload-returns-modal";
import { apiFetch } from "@/lib/apiFetch";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

const ORDER_STATUSES = [
  "DELIVERED", "SHIPPED", "READY_TO_SHIP", "CANCELLED", "RTO_INITIATED", "RTO_LOCKED", 
  "RTO_COMPLETE", "DOOR_STEP_EXCHANGED", "HOLD", "RETURNED", "RETURN_REQUESTED", 
  "APPROVED", "UNSHIPPED", "PENDING", "REFUND_APPLIED"
];

const getStatusBadge = (status: string) => {
  const s = status?.toUpperCase();
  if (["DELIVERED", "DOOR_STEP_EXCHANGED"].includes(s)) return "bg-emerald-500 hover:bg-emerald-600 border-none text-white";
  if (["SHIPPED", "READY_TO_SHIP", "PENDING", "UNSHIPPED"].includes(s)) return "bg-blue-500 hover:bg-blue-600 border-none text-white";
  if (["CANCELLED", "HOLD"].includes(s)) return "bg-rose-500 hover:bg-rose-600 border-none text-white";
  if (["RTO_INITIATED", "RTO_LOCKED", "RTO_COMPLETE"].includes(s)) return "bg-orange-500 hover:bg-orange-600 border-none text-white";
  if (["RETURN_REQUESTED", "RETURNED", "REFUND_APPLIED"].includes(s)) return "bg-amber-500 hover:bg-amber-600 border-none text-white";
  if (["APPROVED"].includes(s)) return "bg-indigo-500 hover:bg-indigo-600 border-none text-white";
  return "bg-slate-500 hover:bg-slate-600 border-none text-white";
};

const SummaryCard = ({ title, value, icon: Icon, gradient, loading }: { title: string; value: string; icon: React.ElementType; gradient: string; loading: boolean }) => (
    <Card className={cn('text-white shadow-lg rounded-2xl border-0 overflow-hidden bg-gradient-to-br', gradient)}>
        <div className="p-6 flex items-center justify-between">
            {loading ? (
                <div>
                    <Skeleton className="h-5 w-32 bg-white/20" />
                    <Skeleton className="h-10 w-40 mt-2 bg-white/20" />
                </div>
            ) : (
                <div>
                    <h3 className="text-sm font-medium uppercase tracking-wider">{title}</h3>
                    <p className="text-4xl font-bold font-headline mt-2">{value}</p>
                </div>
            )}
            <div className="p-3 bg-white/20 rounded-full">
                <Icon className="h-6 w-6 text-white" />
            </div>
        </div>
    </Card>
);

export default function OrdersPage() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [activeTab, setActiveTab] = useState("orders");
  const [loading, setLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);
  const [data, setData] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [totalRows, setTotalRows] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const [searchTerm, setSearchTerm] = useState("");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isBulkReturnModalOpen, setIsBulkReturnModalOpen] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<any>(null);
  const [itemToDelete, setItemToDelete] = useState<{ id: string; description: string } | null>(null);

  const fetchData = useCallback(async () => {
    if (!activeAccountId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        platform: platformFilter,
        status: statusFilter,
        search: searchTerm,
        fromDate,
        toDate,
      });

      const endpoint = activeTab === "orders" ? "/api/orders" : "/api/returns";
      const res = await apiFetch(`${endpoint}?${params.toString()}`);
      
      if (!res.ok) throw new Error(`Failed to fetch ${activeTab}`);
      const json = await res.json();
      
      setData(json.data || []);
      setSummary(json.summary || null);
      setTotalRows(json.totalRows || 0);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setLoading(false);
    }
  }, [activeTab, page, platformFilter, statusFilter, searchTerm, fromDate, toDate, toast, activeAccountId]);

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
    if (activeAccountId) fetchData();
  }, [fetchData, activeAccountId]);

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      const endpoint = activeTab === "orders" ? "/api/orders" : "/api/returns";
      const res = await apiFetch(`${endpoint}?id=${itemToDelete.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      toast({ title: "Success", description: "Item deleted successfully." });
      fetchData();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setItemToDelete(null);
    }
  };

  const handleMarketplaceImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await apiFetch("/api/orders/import", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Import failed");

      toast({
        title: "Import Completed",
        description: (
          <div className="mt-2 space-y-2">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-600 font-bold">Imported: {json.imported}</div>
              <div className="p-2 bg-blue-500/10 rounded-lg text-blue-600 font-bold">Skipped: {json.skipped}</div>
              <div className="p-2 bg-purple-500/10 rounded-lg text-purple-600 font-bold">New SKUs: {json.new_skus}</div>
              <div className="p-2 bg-rose-500/10 rounded-lg text-rose-600 font-bold">Failed: {json.failed}</div>
            </div>
            {json.errors && json.errors.length > 0 && (
              <ScrollArea className="h-24 w-full rounded border p-2 bg-muted/50 mt-2">
                <div className="space-y-1">
                  {json.errors.map((err: any, idx: number) => (
                    <div key={idx} className="text-[10px] flex items-start gap-1">
                      <AlertCircle className="h-3 w-3 text-rose-500 shrink-0 mt-0.5" />
                      <span className="text-muted-foreground font-medium">Row {err.row}: {err.msg}</span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        ),
      });

      fetchData();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Import Failed", description: error.message });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  if (!isMounted) return <div className="p-6 space-y-6"><Skeleton className="h-20 w-full" /><Skeleton className="h-64 w-full" /></div>;

  return (
    <div className="p-6 space-y-6">
      <input type="file" ref={fileInputRef} onChange={handleMarketplaceImport} className="hidden" accept=".csv,.xlsx,.xls,.tsv,.txt" />

      <AddOrderModal isOpen={isOrderModalOpen} onClose={() => { setIsOrderModalOpen(false); setItemToEdit(null); }} onSuccess={fetchData} order={itemToEdit} />
      <AddReturnModal isOpen={isReturnModalOpen} onClose={() => { setIsReturnModalOpen(false); setItemToEdit(null); }} onSuccess={fetchData} returnItem={itemToEdit} />
      <BulkUploadModal isOpen={isBulkModalOpen} onClose={() => setIsBulkModalOpen(false)} onSuccess={fetchData} />
      <BulkUploadReturnsModal isOpen={isBulkReturnModalOpen} onClose={() => setIsBulkReturnModalOpen(false)} onSuccess={fetchData} />

      <AlertDialog open={!!itemToDelete} onOpenChange={() => setItemToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Record</AlertDialogTitle>
            <AlertDialogDescription>Permanently remove "{itemToDelete?.description}"?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-headline">Operations</h1>
          <p className="text-muted-foreground text-sm">Manage orders and customer returns.</p>
        </div>
        <div className="flex items-center flex-wrap gap-2">
          {activeTab === "orders" ? (
            <>
              <Button variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={isImporting} className="bg-indigo-500 hover:bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-500/20">
                <Database className={cn("mr-2 h-4 w-4", isImporting && "animate-spin")} /> 
                {isImporting ? "Processing..." : "Upload Marketplace Report"}
              </Button>
              <Button variant="outline" onClick={() => setIsBulkModalOpen(true)} className="rounded-xl border-border/50">
                <FileUp className="mr-2 h-4 w-4" /> Bulk Upload
              </Button>
              <Button onClick={() => { setItemToEdit(null); setIsOrderModalOpen(true); }} className="rounded-xl shadow-lg shadow-primary/20 font-bold">
                <PlusCircle className="mr-2 h-4 w-4" /> Add Order
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setIsBulkReturnModalOpen(true)} className="rounded-xl border-border/50">
                <FileUp className="mr-2 h-4 w-4" /> Bulk Upload
              </Button>
              <Button onClick={() => { setItemToEdit(null); setIsReturnModalOpen(true); }} className="rounded-xl shadow-lg shadow-primary/20 font-bold">
                <PlusCircle className="mr-2 h-4 w-4" /> Add Return
              </Button>
            </>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => { setData([]); setSummary(null); setPage(1); setActiveTab(v); }} className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md bg-muted/50 p-1 rounded-2xl">
          <TabsTrigger value="orders" className="rounded-xl">Orders Log</TabsTrigger>
          <TabsTrigger value="returns" className="rounded-xl">Returns Log</TabsTrigger>
        </TabsList>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            {activeTab === "orders" ? (
                <>
                    <SummaryCard title="Total Orders" value={summary?.totalOrders?.toLocaleString('en-IN') || "0"} icon={Package} gradient="from-indigo-500 to-blue-600" loading={loading} />
                    <SummaryCard title="Total Revenue" value={formatINR(summary?.totalRevenue || 0)} icon={CircleDollarSign} gradient="from-emerald-500 to-teal-600" loading={loading} />
                </>
            ) : (
                <>
                    <SummaryCard title="Total Returns" value={summary?.totalReturns?.toLocaleString('en-IN') || "0"} icon={Undo2} gradient="from-amber-500 to-orange-600" loading={loading} />
                    <SummaryCard title="Total Loss" value={formatINR(summary?.totalLoss || 0)} icon={TrendingDown} gradient="from-rose-500 to-red-600" loading={loading} />
                </>
            )}
        </div>

        <Card className="mt-6 border-0 shadow-sm bg-muted/20 backdrop-blur-sm rounded-[2rem] overflow-hidden">
          <CardContent className="p-6 grid grid-cols-1 md:grid-cols-6 lg:grid-cols-7 gap-4 items-end">
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Search Database</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Order ID or SKU..." className="pl-9 h-11 bg-background border-border/50 rounded-xl" value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }} />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Platform</label>
              <Select value={platformFilter} onValueChange={(v) => { setPlatformFilter(v); setPage(1); }}>
                <SelectTrigger className="h-11 bg-background border-border/50 rounded-xl"><SelectValue placeholder="Platform" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Channels</SelectItem>
                  <SelectItem value="Meesho">Meesho</SelectItem>
                  <SelectItem value="Flipkart">Flipkart</SelectItem>
                  <SelectItem value="Amazon">Amazon</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {activeTab === "orders" && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Status</label>
                <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                  <SelectTrigger className="h-11 bg-background border-border/50 rounded-xl"><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All States</SelectItem>
                    {ORDER_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5"><label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">From</label><Input type="date" className="h-11 bg-background border-border/50 rounded-xl" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setPage(1); }} /></div>
            <div className="space-y-1.5"><label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">To</label><Input type="date" className="h-11 bg-background border-border/50 rounded-xl" value={toDate} onChange={(e) => { setToDate(e.target.value); setPage(1); }} /></div>
            <Button variant="ghost" onClick={() => { setSearchTerm(""); setPlatformFilter("all"); setStatusFilter("all"); setFromDate(""); setToDate(""); }} className="h-11 rounded-xl text-xs font-bold uppercase hover:bg-destructive/5">Reset</Button>
          </CardContent>
        </Card>

        <TabsContent value="orders" className="mt-6">
          <Card className="border-0 shadow-xl rounded-[2rem] overflow-hidden bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 border-border/50 h-14">
                    <TableHead className="px-6 font-bold text-[10px] uppercase tracking-widest text-muted-foreground">Order ID</TableHead>
                    <TableHead className="font-bold text-[10px] uppercase tracking-widest text-muted-foreground">Date</TableHead>
                    <TableHead className="font-bold text-[10px] uppercase tracking-widest text-muted-foreground">Platform</TableHead>
                    <TableHead className="font-bold text-[10px] uppercase tracking-widest text-muted-foreground">SKU</TableHead>
                    <TableHead className="text-right font-bold text-[10px] uppercase tracking-widest text-muted-foreground">Qty</TableHead>
                    <TableHead className="text-right font-bold text-[10px] uppercase tracking-widest text-muted-foreground">Total</TableHead>
                    <TableHead className="text-center font-bold text-[10px] uppercase tracking-widest text-muted-foreground">Status</TableHead>
                    <TableHead className="text-right px-6 font-bold text-[10px] uppercase tracking-widest text-muted-foreground">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => <TableRow key={i}><TableCell colSpan={8} className="px-6"><Skeleton className="h-10 w-full rounded-xl" /></TableCell></TableRow>)
                  ) : (data.length > 0) ? (
                    data.map((o) => (
                      <TableRow key={o.id} className="hover:bg-primary/5 transition-colors border-border/50 h-20">
                        <TableCell className="px-6 font-mono text-[10px] font-black text-muted-foreground/60">{o.external_order_id}</TableCell>
                        <TableCell className="font-bold text-xs">{o.order_date ? format(new Date(o.order_date), 'dd MMM yyyy') : 'N/A'}</TableCell>
                        <TableCell><Badge variant="outline" className="rounded-lg font-black text-[9px] uppercase">{o.platform}</Badge></TableCell>
                        <TableCell><span className="font-black text-xs font-code uppercase text-foreground">{o.variant_sku}</span></TableCell>
                        <TableCell className="text-right font-black text-xs">{o.quantity}</TableCell>
                        <TableCell className="text-right font-black text-indigo-600 dark:text-indigo-400">{formatINR(o.total_amount)}</TableCell>
                        <TableCell className="text-center"><Badge className={cn("text-[9px] font-black tracking-widest uppercase rounded-lg px-2", getStatusBadge(o.status))}>{o.status || "PENDING"}</Badge></TableCell>
                        <TableCell className="px-6 text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-primary/10" onClick={() => { setItemToEdit(o); setIsOrderModalOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-destructive/10" onClick={() => setItemToDelete({ id: o.id, description: `Order ${o.external_order_id}` })}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow><TableCell colSpan={8} className="h-40 text-center text-muted-foreground italic">No order records matched your current filters.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {activeTab === "returns" && <TabsContent value="returns" className="mt-6"><div className="p-8 text-center text-muted-foreground italic">Returns interface rendering placeholder</div></TabsContent>}

        <div className="flex items-center justify-between py-8">
          <p className="text-[10px] font-black uppercase text-muted-foreground">Total records: <span className="text-foreground">{totalRows}</span></p>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-black uppercase text-muted-foreground">Page {page} of {Math.max(1, Math.ceil(totalRows / pageSize))}</span>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" onClick={() => setPage(p => p - 1)} disabled={page === 1} className="h-9 px-4 rounded-xl font-bold text-[10px] uppercase">Previous</Button>
              <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={(page * pageSize) >= totalRows} className="h-9 px-4 rounded-xl font-bold text-[10px] uppercase">Next</Button>
            </div>
          </div>
        </div>
      </Tabs>
    </div>
  );
}
