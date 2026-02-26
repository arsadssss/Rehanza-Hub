"use client";

import React, { useEffect, useState, useCallback } from "react";
import { formatINR } from "@/lib/format";
import { format, parseISO, isValid } from 'date-fns';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlusCircle, Pencil, Trash2, Search, FilterX, Package, CircleDollarSign, Undo2, TrendingDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AddOrderModal } from "./components/add-order-modal";
import { AddReturnModal } from "../returns/components/add-return-modal";
import { apiFetch } from "@/lib/apiFetch";
import { cn } from "@/lib/utils";

const SummaryCard = ({ title, value, icon: Icon, gradient, loading }: { title: string; value: string; icon: React.ElementType; gradient: string; loading: boolean }) => (
    <Card className={cn('text-white shadow-lg rounded-2xl border-0 overflow-hidden bg-gradient-to-br', gradient)}>
        {loading ? (
            <div className="p-6 flex items-center justify-between">
                <div>
                    <Skeleton className="h-5 w-32 bg-white/20" />
                    <Skeleton className="h-10 w-40 mt-2 bg-white/20" />
                </div>
                <div className="p-3 bg-white/20 rounded-full opacity-20">
                   <Icon className="h-6 w-6 text-white" />
                </div>
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

export default function OrdersPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("orders");
  const [loading, setLoading] = useState(true);
  
  // Data State
  const [data, setData] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [totalRows, setTotalRows] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Modals
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<any>(null);
  const [itemToDelete, setItemToDelete] = useState<{ id: string; description: string } | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        platform: platformFilter,
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
  }, [activeTab, page, platformFilter, searchTerm, fromDate, toDate, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleTabChange = (val: string) => {
    setData([]);
    setSummary(null);
    setPage(1);
    setActiveTab(val);
  };

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

  const resetFilters = () => {
    setSearchTerm("");
    setPlatformFilter("all");
    setFromDate("");
    setToDate("");
  };

  const safeFormatDate = (dateStr: string) => {
    if (!dateStr) return "N/A";
    try {
      const date = parseISO(dateStr);
      return isValid(date) ? format(date, "dd MMM yyyy") : "Invalid Date";
    } catch (e) {
      return "Invalid Date";
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Modals */}
      <AddOrderModal 
        isOpen={isOrderModalOpen} 
        onClose={() => { setIsOrderModalOpen(false); setItemToEdit(null); }} 
        onSuccess={fetchData} 
        order={itemToEdit} 
      />
      <AddReturnModal 
        isOpen={isReturnModalOpen} 
        onClose={() => { setIsReturnModalOpen(false); setItemToEdit(null); }} 
        onSuccess={fetchData} 
        returnItem={itemToEdit} 
      />

      <AlertDialog open={!!itemToDelete} onOpenChange={() => setItemToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{itemToDelete?.description}". This action cannot be undone.
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

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-headline">Operations Management</h1>
          <p className="text-muted-foreground text-sm">Monitor and manage your business orders and returns.</p>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === "orders" ? (
            <Button onClick={() => { setItemToEdit(null); setIsOrderModalOpen(true); }}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add Order
            </Button>
          ) : (
            <Button onClick={() => { setItemToEdit(null); setIsReturnModalOpen(true); }}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add Return
            </Button>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="orders">Orders Log</TabsTrigger>
          <TabsTrigger value="returns">Returns Log</TabsTrigger>
        </TabsList>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            {activeTab === "orders" ? (
                <>
                    <SummaryCard 
                        title="Total Orders" 
                        value={summary?.totalOrders?.toLocaleString('en-IN') || "0"} 
                        icon={Package} 
                        gradient="from-purple-500 to-indigo-600" 
                        loading={loading} 
                    />
                    <SummaryCard 
                        title="Total Revenue" 
                        value={formatINR(summary?.totalRevenue || 0)} 
                        icon={CircleDollarSign} 
                        gradient="from-cyan-500 to-blue-600" 
                        loading={loading} 
                    />
                </>
            ) : (
                <>
                    <SummaryCard 
                        title="Total Returns" 
                        value={summary?.totalReturns?.toLocaleString('en-IN') || "0"} 
                        icon={Undo2} 
                        gradient="from-amber-500 to-orange-600" 
                        loading={loading} 
                    />
                    <SummaryCard 
                        title="Total Loss" 
                        value={formatINR(summary?.totalLoss || 0)} 
                        icon={TrendingDown} 
                        gradient="from-red-500 to-rose-600" 
                        loading={loading} 
                    />
                </>
            )}
        </div>

        {/* Global Filters */}
        <Card className="mt-6 border-0 shadow-sm bg-muted/30">
          <CardContent className="p-4 grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Search</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="SKU or Product..." 
                  className="pl-8 bg-background" 
                  value={searchTerm} 
                  onChange={(e) => setSearchTerm(e.target.value)} 
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Platform</label>
              <Select value={platformFilter} onValueChange={setPlatformFilter}>
                <SelectTrigger className="bg-background"><SelectValue placeholder="Platform" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Platforms</SelectItem>
                  <SelectItem value="Meesho">Meesho</SelectItem>
                  <SelectItem value="Flipkart">Flipkart</SelectItem>
                  <SelectItem value="Amazon">Amazon</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">From</label>
              <Input type="date" className="bg-background" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">To</label>
              <Input type="date" className="bg-background" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </div>
            <Button variant="ghost" onClick={resetFilters} className="h-10 text-xs font-bold uppercase">
              <FilterX className="mr-2 h-4 w-4" /> Reset
            </Button>
          </CardContent>
        </Card>

        <TabsContent value="orders" className="mt-6">
          <Card className="border-0 shadow-md">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-[120px]">Date</TableHead>
                    <TableHead>Platform</TableHead>
                    <TableHead>SKU / Product</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}><TableCell colSpan={7}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                    ))
                  ) : (activeTab === "orders" && data.length > 0) ? (
                    data.map((o) => (
                      <TableRow key={o.id}>
                        <TableCell className="font-medium">{safeFormatDate(o.order_date)}</TableCell>
                        <TableCell><Badge variant="outline">{o.platform}</Badge></TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-bold text-sm font-code uppercase">{o.variant_sku}</span>
                            <span className="text-[10px] text-muted-foreground truncate max-w-[200px]">{o.product_name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{o.quantity}</TableCell>
                        <TableCell className="text-right text-xs opacity-70">{formatINR(o.selling_price)}</TableCell>
                        <TableCell className="text-right font-bold text-primary">{formatINR(o.total_amount)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => { setItemToEdit(o); setIsOrderModalOpen(true); }}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="hover:text-destructive" onClick={() => setItemToDelete({ id: o.id, description: `Order for ${o.variant_sku}` })}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">No orders found.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="returns" className="mt-6">
          <Card className="border-0 shadow-md">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-[120px]">Date</TableHead>
                    <TableHead>Platform</TableHead>
                    <TableHead>SKU / Product</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-center">Restockable</TableHead>
                    <TableHead className="text-right">Total Loss</TableHead>
                    <TableHead className="text-right w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}><TableCell colSpan={7}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                    ))
                  ) : (activeTab === "returns" && data.length > 0) ? (
                    data.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{safeFormatDate(r.return_date)}</TableCell>
                        <TableCell><Badge variant="secondary">{r.platform}</Badge></TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-bold text-sm font-code uppercase">{r.variant_sku}</span>
                            <span className="text-[10px] text-muted-foreground truncate max-w-[200px]">{r.product_name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{r.quantity}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant={r.restockable ? "default" : "destructive"} className={r.restockable ? "bg-emerald-500" : ""}>
                            {r.restockable ? "Yes" : "No"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-bold text-red-600">{formatINR(r.total_loss)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => { setItemToEdit(r); setIsReturnModalOpen(true); }}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="hover:text-destructive" onClick={() => setItemToDelete({ id: r.id, description: `Return for ${r.variant_sku}` })}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">No returns found.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pagination */}
        <div className="flex items-center justify-end space-x-2 py-4 mt-2">
          <span className="text-sm text-muted-foreground">
            {totalRows > 0 ? `Page ${page} of ${Math.ceil(totalRows / pageSize)}` : 'Page 0 of 0'}
          </span>
          <Button variant="outline" size="sm" onClick={() => setPage(p => p - 1)} disabled={page === 1}>Previous</Button>
          <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={(page * pageSize) >= totalRows}>Next</Button>
        </div>
      </Tabs>
    </div>
  );
}
