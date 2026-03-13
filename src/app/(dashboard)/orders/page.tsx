"use client";

import React, { useEffect, useState, useCallback } from "react";
import { formatINR } from "@/lib/format";
import { format } from 'date-fns';
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/apiFetch";
import { 
  PlusCircle, 
  Search, 
  FilterX, 
  FileUp, 
  ShoppingCart, 
  BadgeDollarSign, 
  TrendingUp, 
  Calendar,
  AlertCircle,
  MoreVertical,
  ChevronLeft,
  ChevronRight
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ImportResultModal } from "@/components/orders/import-result-modal";
import { cn } from "@/lib/utils";

const StatCard = ({ title, value, icon: Icon, gradient, loading }: any) => (
  <Card className={cn("text-white shadow-xl border-0 overflow-hidden bg-gradient-to-br transition-all duration-300 hover:scale-[1.02]", gradient)}>
    <CardContent className="p-6">
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">{title}</p>
          {loading ? <Skeleton className="h-10 w-32 bg-white/20" /> : (
            <h2 className="text-4xl font-black font-headline tracking-tighter">{value}</h2>
          )}
        </div>
        <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md">
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </CardContent>
  </Card>
);

export default function OrdersPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [importResult, setImportResult] = useState<any>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        search: searchTerm,
        status: statusFilter,
        fromDate,
        toDate,
      });
      const res = await apiFetch(`/api/orders?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
        setStats(json.stats);
      }
    } catch (e) {
      toast({ variant: "destructive", title: "Fetch Error", description: "Could not load orders." });
    } finally {
      setLoading(false);
    }
  }, [searchTerm, statusFilter, fromDate, toDate, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await apiFetch("/api/orders/import/meesho", {
        method: "POST",
        body: formData,
      });
      const result = await res.json();
      if (res.ok) {
        setImportResult(result);
        fetchData();
      } else {
        throw new Error(result.error);
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Import Failed", description: err.message });
    } finally {
      setIsImporting(false);
      e.target.value = "";
    }
  };

  const resetFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setFromDate("");
    setToDate("");
  };

  return (
    <div className="p-8 space-y-10 bg-gray-50/50 dark:bg-black/50 min-h-screen font-body">
      <ImportResultModal 
        result={importResult} 
        onClose={() => setImportResult(null)} 
      />

      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-4xl font-black tracking-tighter font-headline">Order Ecosystem</h1>
          <p className="text-muted-foreground font-medium text-sm mt-1 ml-1">Unified marketplace intelligence and logistics control.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <input 
              type="file" 
              accept=".xlsx" 
              onChange={handleImport} 
              className="hidden" 
              id="meesho-import" 
              disabled={isImporting}
            />
            <Button 
              asChild
              variant="outline"
              className="rounded-2xl h-12 font-bold shadow-sm bg-white/80 backdrop-blur-sm cursor-pointer"
            >
              <label htmlFor="meesho-import" className="flex items-center gap-2">
                <FileUp className={cn("h-4 w-4", isImporting && "animate-spin")} />
                {isImporting ? "Analyzing..." : "Import Meesho"}
              </label>
            </Button>
          </div>
          <Button className="rounded-2xl h-12 px-6 font-black shadow-lg shadow-primary/20">
            <PlusCircle className="h-4 w-4 mr-2" /> Manual Order
          </Button>
        </div>
      </div>

      {/* KPI Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Overall Volume" value={stats?.total_orders || 0} icon={ShoppingCart} gradient="from-indigo-500 to-purple-600" loading={loading} />
        <StatCard title="Total Revenue" value={formatINR(stats?.total_revenue || 0)} icon={BadgeDollarSign} gradient="from-blue-500 to-cyan-600" loading={loading} />
        <StatCard title="Today's Velocity" value={stats?.today_orders || 0} icon={TrendingUp} gradient="from-emerald-500 to-teal-600" loading={loading} />
        <StatCard title="Today's Sales" value={formatINR(stats?.today_revenue || 0)} icon={Calendar} gradient="from-orange-500 to-rose-600" loading={loading} />
      </div>

      {/* Grid Controls */}
      <Card className="border-0 shadow-2xl rounded-[2.5rem] overflow-hidden bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl">
        <CardHeader className="px-8 py-8 border-b border-border/50 bg-muted/20">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <CardTitle className="text-xl font-headline font-black flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-xl">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              Order Registry
            </CardTitle>
            
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <div className="relative flex-1 md:min-w-[240px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="ID or SKU..." 
                  className="pl-10 h-11 rounded-xl bg-background border-border/50 focus-visible:ring-primary/20"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-11 w-[140px] rounded-xl bg-background border-border/50">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All States</SelectItem>
                  <SelectItem value="DELIVERED">Delivered</SelectItem>
                  <SelectItem value="SHIPPED">Shipped</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                  <SelectItem value="RETURNED">Returned</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex items-center gap-2">
                <Input type="date" className="h-11 rounded-xl border-border/50 w-auto" value={fromDate} onChange={e => setFromDate(e.target.value)} />
                <span className="text-muted-foreground font-black">/</span>
                <Input type="date" className="h-11 rounded-xl border-border/50 w-auto" value={toDate} onChange={e => setToDate(e.target.value)} />
              </div>

              <Button variant="ghost" size="icon" onClick={resetFilters} className="h-11 w-11 rounded-xl hover:bg-destructive/10 hover:text-destructive">
                <FilterX className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow className="border-border/50 hover:bg-transparent h-14">
                <TableHead className="px-8 font-black text-[10px] uppercase tracking-widest text-muted-foreground">Order Identity</TableHead>
                <TableHead className="font-black text-[10px] uppercase tracking-widest text-muted-foreground">Logistics</TableHead>
                <TableHead className="font-black text-[10px] uppercase tracking-widest text-muted-foreground text-right">Price</TableHead>
                <TableHead className="font-black text-[10px] uppercase tracking-widest text-muted-foreground text-center">Qty</TableHead>
                <TableHead className="font-black text-[10px] uppercase tracking-widest text-muted-foreground text-right">Settlement</TableHead>
                <TableHead className="font-black text-[10px] uppercase tracking-widest text-muted-foreground text-center">Status</TableHead>
                <TableHead className="px-8 w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="h-20 border-border/50">
                    <TableCell colSpan={7} className="px-8"><Skeleton className="h-8 w-full rounded-xl opacity-40" /></TableCell>
                  </TableRow>
                ))
              ) : data.length > 0 ? (
                data.map((order) => (
                  <TableRow key={order.id} className="h-20 border-border/50 hover:bg-primary/5 transition-colors group">
                    <TableCell className="px-8">
                      <div className="flex flex-col">
                        <span className="font-mono text-[10px] font-black text-muted-foreground mb-0.5">{order.external_order_id}</span>
                        <span className="text-xs font-black uppercase tracking-tight text-foreground">{order.variant_sku || 'Unmapped SKU'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-muted-foreground">{format(new Date(order.order_date), 'dd MMM yyyy')}</span>
                        <Badge variant="outline" className="w-fit text-[8px] font-black h-4 px-1.5 uppercase mt-1 bg-white/50">{order.platform}</Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-xs font-bold text-muted-foreground">{formatINR(order.selling_price)}</span>
                    </TableCell>
                    <TableCell className="text-center font-black text-xs">{order.quantity}</TableCell>
                    <TableCell className="text-right">
                      <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">{formatINR(order.total_amount)}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={cn(
                        "text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-tighter",
                        order.status === 'CANCELLED' ? "bg-rose-500" : 
                        order.status === 'DELIVERED' ? "bg-emerald-500" : "bg-indigo-500"
                      )}>
                        {order.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-8 text-right">
                      <Button variant="ghost" size="icon" className="rounded-xl opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="h-64 text-center">
                    <div className="flex flex-col items-center justify-center text-muted-foreground gap-4 opacity-40">
                      <AlertCircle className="h-12 w-12" />
                      <p className="font-headline font-black uppercase tracking-widest text-sm">No orders recorded</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
