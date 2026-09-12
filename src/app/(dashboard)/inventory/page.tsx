'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { formatINR } from '@/lib/format';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/apiFetch';
import { resolveActiveAccount } from '@/lib/account';
import {
  Package,
  Boxes,
  Layers,
  Search,
  RefreshCw,
  Plus,
  SlidersHorizontal,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  History,
  TrendingUp,
  MapPin,
  Clock,
  ArrowUpDown,
  Tag,
  ShieldCheck,
  Building2,
  MoreVertical,
  Edit,
  Trash2,
  PackagePlus,
  Loader2,
} from 'lucide-react';
import { AddStockModal } from './components/add-stock-modal';
import { EditStockModal } from './components/edit-stock-modal';
import { AdjustStockModal } from './components/adjust-stock-modal';
import { StockMovementHistory } from './components/stock-movement-history';
import { InventoryItem, InventoryKpis } from '@/lib/inventory/inventory-service';

export default function InventoryPage() {
  const { toast } = useToast();
  const [isMounted, setIsMounted] = useState(false);
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);
  const [activeAccountName, setActiveAccountName] = useState<string>('Rehanza');

  // Core Data State
  const [summary, setSummary] = useState<InventoryKpis>({
    totalInventoryValue: 0,
    totalUnits: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
    reservedStockCount: 0,
    totalSkus: 0,
  });
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [vendors, setVendors] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);

  // Navigation Tabs: 'inventory' | 'movements'
  const [activeTab, setActiveTab] = useState<'inventory' | 'movements'>('inventory');

  // Filter & Search State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Healthy' | 'Low Stock' | 'Out of Stock'>('all');
  const [sortBy, setSortBy] = useState<'sku' | 'name' | 'available' | 'value'>('value');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Modals
  const [isAddStockOpen, setIsAddStockOpen] = useState(false);
  const [isEditStockOpen, setIsEditStockOpen] = useState(false);
  const [isAdjustStockOpen, setIsAdjustStockOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);

  // Delete State
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<InventoryItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // 1. Account Resolution & Reactive Listeners
  useEffect(() => {
    setIsMounted(true);

    async function initAccount() {
      const acc = await resolveActiveAccount();
      if (acc?.id) {
        setActiveAccountId(acc.id);
        setActiveAccountName(acc.name || 'Rehanza');
      }
    }
    initAccount();

    const handleAccountChange = (e: any) => {
      const freshId = e?.detail?.id || sessionStorage.getItem('active_account');
      const freshName = e?.detail?.name || sessionStorage.getItem('active_account_name') || 'Rehanza';
      if (freshId) {
        setActiveAccountId(freshId);
        setActiveAccountName(freshName);
      }
    };

    window.addEventListener('active-account-changed', handleAccountChange);
    return () => window.removeEventListener('active-account-changed', handleAccountChange);
  }, []);

  // 2. Fetch Full Inventory Dataset
  const fetchInventory = useCallback(async () => {
    if (!activeAccountId) return;
    setLoading(true);
    try {
      const res = await apiFetch('/api/inventory');
      const json = await res.json();

      if (res.ok && json.success) {
        setSummary(json.summary);
        setItems(json.items || []);
        setCategories(json.categories || []);
        setVendors(json.vendors || []);
      } else {
        throw new Error(json.message || 'Failed to fetch inventory');
      }
    } catch (err: any) {
      console.error('Fetch inventory error:', err);
      toast({
        title: 'Error',
        description: err.message || 'Failed to load inventory dataset.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [activeAccountId, toast]);

  useEffect(() => {
    if (activeAccountId) {
      fetchInventory();
    }
  }, [activeAccountId, fetchInventory]);

  // 3. Filtered and Sorted Items
  const filteredItems = useMemo(() => {
    let result = [...items];

    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      result = result.filter(
        (i) => i.mainSku.toLowerCase().includes(q) || i.productName.toLowerCase().includes(q)
      );
    }

    if (selectedCategory !== 'all') {
      result = result.filter((i) => i.category === selectedCategory);
    }

    if (statusFilter !== 'all') {
      result = result.filter((i) => i.status === statusFilter);
    }

    result.sort((a, b) => {
      let valA: any;
      let valB: any;

      switch (sortBy) {
        case 'sku':
          valA = a.mainSku.toLowerCase();
          valB = b.mainSku.toLowerCase();
          break;
        case 'name':
          valA = a.productName.toLowerCase();
          valB = b.productName.toLowerCase();
          break;
        case 'available':
          valA = a.availableQuantity;
          valB = b.availableQuantity;
          break;
        case 'value':
        default:
          valA = a.inventoryValue;
          valB = b.inventoryValue;
          break;
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [items, searchTerm, selectedCategory, statusFilter, sortBy, sortOrder]);

  const handleOpenAddStock = (item: InventoryItem) => {
    setSelectedItem(item);
    setIsAddStockOpen(true);
  };

  const handleOpenEditStock = (item: InventoryItem) => {
    setSelectedItem(item);
    setIsEditStockOpen(true);
  };

  const handleOpenAdjustStock = (item: InventoryItem) => {
    setSelectedItem(item);
    setIsAdjustStockOpen(true);
  };

  const handlePromptDelete = (item: InventoryItem) => {
    setItemToDelete(item);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    setIsDeleting(true);
    try {
      const res = await apiFetch('/api/inventory/stock', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mainSku: itemToDelete.mainSku }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Failed to delete inventory record');
      }

      toast({
        title: 'Record Deleted',
        description: `Inventory record for ${itemToDelete.mainSku} was successfully removed.`,
      });

      setIsDeleteDialogOpen(false);
      setItemToDelete(null);
      await fetchInventory();
    } catch (err: any) {
      toast({
        title: 'Delete Failed',
        description: err.message || 'Could not delete inventory record.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const getStatusBadge = (status: 'Healthy' | 'Low Stock' | 'Out of Stock') => {
    switch (status) {
      case 'Healthy':
        return (
          <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[11px] font-bold flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" /> Healthy
          </Badge>
        );
      case 'Low Stock':
        return (
          <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[11px] font-bold flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" /> Low Stock
          </Badge>
        );
      case 'Out of Stock':
      default:
        return (
          <Badge className="bg-rose-500/10 text-rose-400 border-rose-500/20 text-[11px] font-bold flex items-center gap-1">
            <XCircle className="h-3 w-3" /> Out of Stock
          </Badge>
        );
    }
  };

  const getStockCountBadge = (item: InventoryItem) => {
    if (item.availableQuantity === 0) {
      return (
        <span className="font-mono font-bold text-rose-400 px-2 py-0.5 rounded-md bg-rose-500/10 border border-rose-500/20">
          0
        </span>
      );
    }
    if (item.availableQuantity <= item.reorderLevel) {
      return (
        <span className="font-mono font-bold text-amber-400 px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20">
          {item.availableQuantity}
        </span>
      );
    }
    return (
      <span className="font-mono font-bold text-emerald-400 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20">
        {item.availableQuantity}
      </span>
    );
  };

  if (!isMounted) return null;

  return (
    <div className="p-6 md:p-8 space-y-8 bg-slate-950 text-slate-100 min-h-screen">
      {/* 1. Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white font-headline">
              Inventory Management
            </h1>
            <Badge variant="outline" className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20 text-xs font-bold">
              {activeAccountName}
            </Badge>
          </div>
          <p className="text-xs md:text-sm text-slate-400">
            Centralized SKU-level stock control, atomic movements & accurate valuation
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Main Tabs Switcher */}
          <div className="inline-flex rounded-xl p-1 bg-slate-900/80 border border-white/10 backdrop-blur-md shadow-inner">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setActiveTab('inventory')}
              className={`h-9 px-3 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'inventory'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <Boxes className="h-3.5 w-3.5 mr-1.5" />
              SKU Stock ({summary.totalSkus})
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setActiveTab('movements')}
              className={`h-9 px-3 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'movements'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <History className="h-3.5 w-3.5 mr-1.5" />
              Movement History
            </Button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchInventory}
            disabled={loading}
            className="h-10 border-white/10 bg-slate-900/60 text-slate-200 hover:text-white hover:bg-white/10"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* 2. Premium 5 KPI Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* KPI 1: Total Inventory Value */}
        <Card className="border-0 bg-gradient-to-br from-emerald-950/40 via-slate-900/80 to-slate-950 border-t border-emerald-500/30 rounded-2xl shadow-lg backdrop-blur-md overflow-hidden relative group">
          <CardContent className="p-5">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400/80">
                  Total Inventory Value
                </span>
                <div className="text-2xl font-black tracking-tight text-white font-headline">
                  {loading ? (
                    <Skeleton className="h-8 w-28 bg-slate-800" />
                  ) : (
                    formatINR(summary.totalInventoryValue)
                  )}
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <TrendingUp className="h-5 w-5" />
              </div>
            </div>
            <p className="text-[10px] text-slate-400 mt-2 flex items-center gap-1">
              Available Units × Cost Price
            </p>
          </CardContent>
        </Card>

        {/* KPI 2: Total Units */}
        <Card className="border-0 bg-gradient-to-br from-blue-950/40 via-slate-900/80 to-slate-950 border-t border-blue-500/30 rounded-2xl shadow-lg backdrop-blur-md overflow-hidden relative group">
          <CardContent className="p-5">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-blue-400/80">
                  Total Units
                </span>
                <div className="text-2xl font-black tracking-tight text-white font-headline">
                  {loading ? (
                    <Skeleton className="h-8 w-20 bg-slate-800" />
                  ) : (
                    summary.totalUnits.toLocaleString()
                  )}
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
                <Boxes className="h-5 w-5" />
              </div>
            </div>
            <p className="text-[10px] text-slate-400 mt-2 flex items-center gap-1">
              Sum of all available stock
            </p>
          </CardContent>
        </Card>

        {/* KPI 3: Low Stock */}
        <Card className="border-0 bg-gradient-to-br from-amber-950/40 via-slate-900/80 to-slate-950 border-t border-amber-500/30 rounded-2xl shadow-lg backdrop-blur-md overflow-hidden relative group">
          <CardContent className="p-5">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400/80">
                  Low Stock
                </span>
                <div className="text-2xl font-black tracking-tight text-amber-300 font-headline">
                  {loading ? (
                    <Skeleton className="h-8 w-16 bg-slate-800" />
                  ) : (
                    summary.lowStockCount
                  )}
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                <AlertTriangle className="h-5 w-5" />
              </div>
            </div>
            <p className="text-[10px] text-slate-400 mt-2 flex items-center gap-1">
              Stock ≤ Reorder Level (&gt; 0)
            </p>
          </CardContent>
        </Card>

        {/* KPI 4: Out of Stock */}
        <Card className="border-0 bg-gradient-to-br from-rose-950/40 via-slate-900/80 to-slate-950 border-t border-rose-500/30 rounded-2xl shadow-lg backdrop-blur-md overflow-hidden relative group">
          <CardContent className="p-5">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-rose-400/80">
                  Out of Stock
                </span>
                <div className="text-2xl font-black tracking-tight text-rose-400 font-headline">
                  {loading ? (
                    <Skeleton className="h-8 w-16 bg-slate-800" />
                  ) : (
                    summary.outOfStockCount
                  )}
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
                <XCircle className="h-5 w-5" />
              </div>
            </div>
            <p className="text-[10px] text-slate-400 mt-2 flex items-center gap-1">
              Available Quantity = 0
            </p>
          </CardContent>
        </Card>

        {/* KPI 5: Reserved Stock */}
        <Card className="border-0 bg-gradient-to-br from-purple-950/40 via-slate-900/80 to-slate-950 border-t border-purple-500/30 rounded-2xl shadow-lg backdrop-blur-md overflow-hidden relative group">
          <CardContent className="p-5">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-purple-400/80">
                  Reserved Stock
                </span>
                <div className="text-2xl font-black tracking-tight text-purple-300 font-headline">
                  {loading ? (
                    <Skeleton className="h-8 w-16 bg-slate-800" />
                  ) : (
                    summary.reservedStockCount.toLocaleString()
                  )}
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
                <Layers className="h-5 w-5" />
              </div>
            </div>
            <p className="text-[10px] text-slate-400 mt-2 flex items-center gap-1">
              Committed to active orders
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 3. Main Body */}
      {activeTab === 'inventory' ? (
        <div className="space-y-4">
          {/* Filter / Search Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 rounded-2xl bg-slate-900/60 border border-white/10 backdrop-blur-md">
            <div className="flex flex-1 flex-wrap items-center gap-3">
              {/* Search */}
              <div className="relative flex-1 min-w-[220px] max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search by Main SKU, Product..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-9 bg-slate-950/60 border-white/10 text-white text-xs"
                />
              </div>

              {/* Category Filter */}
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-40 h-9 bg-slate-950/60 border-white/10 text-white text-xs">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-white/10 text-white text-xs">
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Status Filter Buttons */}
              <div className="inline-flex rounded-lg p-0.5 bg-slate-950/60 border border-white/10">
                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                    statusFilter === 'all'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  All ({items.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('Healthy')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                    statusFilter === 'Healthy'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Healthy
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('Low Stock')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                    statusFilter === 'Low Stock'
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Low Stock ({summary.lowStockCount})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('Out of Stock')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                    statusFilter === 'Out of Stock'
                      ? 'bg-rose-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Out of Stock ({summary.outOfStockCount})
                </button>
              </div>
            </div>

            {/* Sorting Dropdown */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 hidden lg:inline">Sort:</span>
              <Select value={sortBy} onValueChange={(val: any) => setSortBy(val)}>
                <SelectTrigger className="w-36 h-9 bg-slate-950/60 border-white/10 text-white text-xs">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-white/10 text-white text-xs">
                  <SelectItem value="value">Stock Value</SelectItem>
                  <SelectItem value="available">Available Units</SelectItem>
                  <SelectItem value="sku">Main SKU</SelectItem>
                  <SelectItem value="name">Product Name</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
                className="h-9 px-2 text-slate-400 hover:text-white border border-white/10 bg-slate-950/40"
              >
                <ArrowUpDown className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Main Inventory Table */}
          <Card className="border-0 bg-slate-900/70 backdrop-blur-xl shadow-2xl rounded-2xl overflow-hidden border-t border-white/10">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-950/60">
                    <TableRow className="border-b border-white/5 hover:bg-transparent">
                      <TableHead className="text-[11px] font-bold text-slate-400 uppercase tracking-wider pl-6">
                        Main SKU
                      </TableHead>
                      <TableHead className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        Product
                      </TableHead>
                      <TableHead className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        Category
                      </TableHead>
                      <TableHead className="text-[11px] font-bold text-slate-400 uppercase tracking-wider text-right">
                        Cost Price
                      </TableHead>
                      <TableHead className="text-[11px] font-bold text-slate-400 uppercase tracking-wider text-center">
                        Available
                      </TableHead>
                      <TableHead className="text-[11px] font-bold text-slate-400 uppercase tracking-wider text-center">
                        Reserved
                      </TableHead>
                      <TableHead className="text-[11px] font-bold text-slate-400 uppercase tracking-wider text-center">
                        Total Stock
                      </TableHead>
                      <TableHead className="text-[11px] font-bold text-slate-400 uppercase tracking-wider text-right">
                        Inventory Value
                      </TableHead>
                      <TableHead className="text-[11px] font-bold text-slate-400 uppercase tracking-wider text-center">
                        Reorder
                      </TableHead>
                      <TableHead className="text-[11px] font-bold text-slate-400 uppercase tracking-wider text-center">
                        Status
                      </TableHead>
                      <TableHead className="text-[11px] font-bold text-slate-400 uppercase tracking-wider pr-6 text-right">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      Array.from({ length: 6 }).map((_, i) => (
                        <TableRow key={i} className="border-b border-white/5">
                          <TableCell colSpan={11} className="py-4">
                            <Skeleton className="h-8 w-full bg-slate-800/40 rounded-lg" />
                          </TableCell>
                        </TableRow>
                      ))
                    ) : filteredItems.length > 0 ? (
                      filteredItems.map((item) => (
                        <TableRow
                          key={item.id}
                          className="border-b border-white/5 hover:bg-white/[0.02] transition-colors group"
                        >
                          {/* Main SKU */}
                          <TableCell className="pl-6 py-4 font-mono font-bold text-xs whitespace-nowrap">
                            <span className="text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded-md inline-block">
                              {item.mainSku}
                            </span>
                          </TableCell>

                          {/* Product Name */}
                          <TableCell className="py-4">
                            <div className="space-y-0.5 max-w-xs">
                              <p className="text-xs font-semibold text-slate-200 line-clamp-1">
                                {item.productName}
                              </p>
                              <p className="text-[11px] text-slate-500 flex items-center gap-1">
                                <MapPin className="h-3 w-3" /> {item.location}
                              </p>
                            </div>
                          </TableCell>

                          {/* Category */}
                          <TableCell className="py-4 whitespace-nowrap">
                            <Badge variant="outline" className="text-[11px] bg-slate-950/60 text-slate-400 border-white/10">
                              {item.category || 'General'}
                            </Badge>
                          </TableCell>

                          {/* Cost Price */}
                          <TableCell className="py-4 text-right font-mono text-xs whitespace-nowrap">
                            {item.costPrice > 0 ? (
                              <span className="text-slate-300 font-semibold">
                                {formatINR(item.costPrice)}
                              </span>
                            ) : (
                              <span className="text-slate-500 italic text-[11px]">(Not set)</span>
                            )}
                          </TableCell>

                          {/* Available Quantity */}
                          <TableCell className="py-4 text-center whitespace-nowrap">
                            {getStockCountBadge(item)}
                          </TableCell>

                          {/* Reserved Quantity */}
                          <TableCell className="py-4 text-center font-mono text-xs text-slate-400 whitespace-nowrap">
                            {item.reservedQuantity > 0 ? (
                              <span className="text-purple-400 font-bold">{item.reservedQuantity}</span>
                            ) : (
                              '0'
                            )}
                          </TableCell>

                          {/* Total Quantity */}
                          <TableCell className="py-4 text-center font-mono text-xs font-bold text-slate-200 whitespace-nowrap">
                            {item.totalQuantity}
                          </TableCell>

                          {/* Inventory Value */}
                          <TableCell className="py-4 text-right font-mono font-bold text-xs whitespace-nowrap">
                            {item.inventoryValue > 0 ? (
                              <span className="text-emerald-400">
                                {formatINR(item.inventoryValue)}
                              </span>
                            ) : (
                              <span className="text-slate-500">₹0.00</span>
                            )}
                          </TableCell>

                          {/* Reorder Level */}
                          <TableCell className="py-4 text-center font-mono text-xs text-slate-400 whitespace-nowrap">
                            {item.reorderLevel}
                          </TableCell>

                          {/* Status */}
                          <TableCell className="py-4 text-center whitespace-nowrap">
                            {getStatusBadge(item.status)}
                          </TableCell>

                          {/* Actions */}
                          <TableCell className="pr-6 py-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenAddStock(item)}
                                className="h-8 px-2.5 text-xs font-bold border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300"
                              >
                                <Plus className="h-3 w-3 mr-1" /> Add
                              </Button>

                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 w-8 p-0 border-white/10 bg-slate-950/60 text-slate-300 hover:text-white hover:bg-white/10"
                                  >
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                  align="end"
                                  className="bg-slate-900 border-white/10 text-white shadow-2xl backdrop-blur-xl w-48"
                                >
                                  <DropdownMenuItem
                                    onClick={() => handleOpenAddStock(item)}
                                    className="cursor-pointer hover:bg-white/5 focus:bg-white/5 text-xs font-medium"
                                  >
                                    <PackagePlus className="h-3.5 w-3.5 mr-2 text-emerald-400" />
                                    Add Stock
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleOpenEditStock(item)}
                                    className="cursor-pointer hover:bg-white/5 focus:bg-white/5 text-xs font-medium"
                                  >
                                    <Edit className="h-3.5 w-3.5 mr-2 text-blue-400" />
                                    Edit / Update Stock
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleOpenAdjustStock(item)}
                                    className="cursor-pointer hover:bg-white/5 focus:bg-white/5 text-xs font-medium"
                                  >
                                    <SlidersHorizontal className="h-3.5 w-3.5 mr-2 text-amber-400" />
                                    Adjust Stock
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator className="bg-white/10" />
                                  <DropdownMenuItem
                                    onClick={() => handlePromptDelete(item)}
                                    className="cursor-pointer text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 focus:bg-rose-500/10 focus:text-rose-300 text-xs font-medium"
                                  >
                                    <Trash2 className="h-3.5 w-3.5 mr-2" />
                                    Delete Record
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={11} className="py-20 text-center text-slate-500">
                          <Package className="h-12 w-12 mx-auto mb-3 text-slate-600" />
                          <p className="text-base font-bold text-slate-300">
                            {searchTerm ? 'No matching products found' : 'No inventory records found'}
                          </p>
                          <p className="text-xs text-slate-500 mt-1">
                            {searchTerm
                              ? 'Try adjusting your search query or status filter.'
                              : 'Products added to the Products master will appear here automatically.'}
                          </p>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        /* Movement History Tab */
        <StockMovementHistory />
      )}

      {/* 4. Modals */}
      <AddStockModal
        isOpen={isAddStockOpen}
        onClose={() => setIsAddStockOpen(false)}
        item={selectedItem}
        vendors={vendors}
        onSuccess={fetchInventory}
      />

      <EditStockModal
        isOpen={isEditStockOpen}
        onClose={() => setIsEditStockOpen(false)}
        item={selectedItem}
        onSuccess={fetchInventory}
      />

      <AdjustStockModal
        isOpen={isAdjustStockOpen}
        onClose={() => setIsAdjustStockOpen(false)}
        item={selectedItem}
        onSuccess={fetchInventory}
      />

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="bg-slate-900 border-white/10 text-white shadow-2xl backdrop-blur-xl max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-bold text-white flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-rose-400" />
              Delete Inventory Record?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-400 space-y-3 pt-2">
              <p>
                Are you sure you want to delete the inventory stock record for{' '}
                <strong className="text-white font-mono">{itemToDelete?.mainSku}</strong>?
              </p>
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs space-y-1.5">
                <p className="font-semibold text-amber-200">Scope of Deletion:</p>
                <ul className="list-disc list-inside space-y-0.5 text-[11px] text-amber-300/90">
                  <li>Only this SKU&apos;s stock count and inventory record will be removed.</li>
                  <li>The product catalog entry in Products will <strong>NOT</strong> be deleted.</li>
                  <li>Orders, payments, and marketplace data will <strong>NOT</strong> be affected.</li>
                  <li>In Inventory, this product will safely display with stock = 0.</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="pt-2">
            <AlertDialogCancel
              disabled={isDeleting}
              className="bg-slate-800 text-slate-300 border-white/10 hover:bg-slate-700 hover:text-white"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleConfirmDelete();
              }}
              disabled={isDeleting}
              className="bg-rose-600 text-white hover:bg-rose-500 font-bold"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete Record'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}