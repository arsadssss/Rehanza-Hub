'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/apiFetch';
import { formatINR } from '@/lib/format';
import { format } from 'date-fns';
import {
  History,
  Search,
  RefreshCw,
  ArrowUpRight,
  ArrowDownLeft,
  SlidersHorizontal,
  AlertCircle,
  Undo2,
  PackageCheck,
  Building2,
  MapPin,
  Calendar,
} from 'lucide-react';
import { StockMovement } from '@/lib/inventory/inventory-service';

export function StockMovementHistory() {
  const { toast } = useToast();
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [searchSku, setSearchSku] = useState('');
  const [movementType, setMovementType] = useState('all');

  const fetchMovements = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchSku.trim()) params.set('mainSku', searchSku.trim());
      if (movementType !== 'all') params.set('movementType', movementType);

      const res = await apiFetch(`/api/inventory/movements?${params.toString()}`);
      const json = await res.json();

      if (res.ok && json.success) {
        setMovements(json.movements || []);
        setTotal(json.total || 0);
      } else {
        throw new Error(json.message || 'Failed to load movements');
      }
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to fetch stock movements.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [searchSku, movementType, toast]);

  useEffect(() => {
    fetchMovements();
  }, [fetchMovements]);

  const getMovementBadge = (type: string) => {
    switch (type) {
      case 'Stock In':
        return (
          <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 flex items-center gap-1">
            <ArrowDownLeft className="h-3 w-3" /> Stock In
          </Badge>
        );
      case 'Damaged':
        return (
          <Badge className="bg-rose-500/10 text-rose-400 border-rose-500/20 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" /> Damaged
          </Badge>
        );
      case 'Stock Out':
        return (
          <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 flex items-center gap-1">
            <ArrowUpRight className="h-3 w-3" /> Stock Out
          </Badge>
        );
      case 'Return':
        return (
          <Badge className="bg-purple-500/10 text-purple-400 border-purple-500/20 flex items-center gap-1">
            <Undo2 className="h-3 w-3" /> Return
          </Badge>
        );
      case 'Adjustment':
      case 'Correction':
      default:
        return (
          <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 flex items-center gap-1">
            <SlidersHorizontal className="h-3 w-3" /> {type || 'Adjustment'}
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 rounded-2xl bg-slate-900/60 border border-white/10 backdrop-blur-md">
        <div className="flex flex-1 items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search by Main SKU..."
              value={searchSku}
              onChange={(e) => setSearchSku(e.target.value)}
              className="pl-9 h-9 bg-slate-950/60 border-white/10 text-white text-xs"
            />
          </div>

          <Select value={movementType} onValueChange={setMovementType}>
            <SelectTrigger className="w-44 h-9 bg-slate-950/60 border-white/10 text-white text-xs">
              <SelectValue placeholder="Movement Type" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-white/10 text-white text-xs">
              <SelectItem value="all">All Movements</SelectItem>
              <SelectItem value="Stock In">Stock In</SelectItem>
              <SelectItem value="Adjustment">Adjustment</SelectItem>
              <SelectItem value="Correction">Correction</SelectItem>
              <SelectItem value="Damaged">Damaged</SelectItem>
              <SelectItem value="Stock Out">Stock Out</SelectItem>
              <SelectItem value="Return">Return</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-medium">
            Total logs: <strong className="text-white">{total}</strong>
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchMovements}
            disabled={loading}
            className="h-9 border-white/10 bg-slate-950/40 text-slate-300 hover:text-white"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Movement Table */}
      <Card className="border-0 bg-slate-900/70 backdrop-blur-xl shadow-2xl rounded-2xl overflow-hidden border-t border-white/10">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-950/60">
                <TableRow className="border-b border-white/5 hover:bg-transparent">
                  <TableHead className="text-[11px] font-bold text-slate-400 uppercase tracking-wider pl-6">
                    Timestamp
                  </TableHead>
                  <TableHead className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Main SKU & Product
                  </TableHead>
                  <TableHead className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Movement Type
                  </TableHead>
                  <TableHead className="text-[11px] font-bold text-slate-400 uppercase tracking-wider text-right">
                    Quantity
                  </TableHead>
                  <TableHead className="text-[11px] font-bold text-slate-400 uppercase tracking-wider text-center">
                    Stock Change
                  </TableHead>
                  <TableHead className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Supplier / Location
                  </TableHead>
                  <TableHead className="text-[11px] font-bold text-slate-400 uppercase tracking-wider pr-6">
                    Reason & Notes
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i} className="border-b border-white/5">
                      <TableCell colSpan={7} className="py-4">
                        <Skeleton className="h-6 w-full bg-slate-800/40 rounded-lg" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : movements.length > 0 ? (
                  movements.map((m) => {
                    const isPositive = m.quantity > 0;
                    const dateFormatted = m.createdAt
                      ? format(new Date(m.createdAt), 'MMM d, yyyy h:mm a')
                      : '-';

                    return (
                      <TableRow
                        key={m.id}
                        className="border-b border-white/5 hover:bg-white/[0.02] transition-colors"
                      >
                        {/* Date */}
                        <TableCell className="pl-6 py-4 text-xs text-slate-400 whitespace-nowrap font-mono">
                          <span className="flex items-center gap-1.5">
                            <Calendar className="h-3 w-3 text-slate-500" />
                            {dateFormatted}
                          </span>
                        </TableCell>

                        {/* SKU & Product */}
                        <TableCell className="py-4">
                          <div className="space-y-0.5">
                            <span className="text-xs font-mono font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-md inline-block">
                              {m.mainSku}
                            </span>
                            <p className="text-xs text-slate-300 line-clamp-1 max-w-xs">
                              {m.productName || m.mainSku}
                            </p>
                          </div>
                        </TableCell>

                        {/* Movement Type */}
                        <TableCell className="py-4 whitespace-nowrap">
                          {getMovementBadge(m.movementType)}
                        </TableCell>

                        {/* Quantity */}
                        <TableCell className="py-4 text-right whitespace-nowrap font-mono font-bold">
                          <span
                            className={
                              isPositive
                                ? 'text-emerald-400'
                                : m.quantity < 0
                                ? 'text-rose-400'
                                : 'text-slate-400'
                            }
                          >
                            {isPositive ? `+${m.quantity}` : m.quantity}
                          </span>
                        </TableCell>

                        {/* Stock Change (Prev -> New) */}
                        <TableCell className="py-4 text-center whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5 text-xs font-mono px-2.5 py-1 rounded-lg bg-slate-950/60 border border-white/5">
                            <span className="text-slate-400">{m.previousQuantity}</span>
                            <span className="text-slate-600">→</span>
                            <span className="font-bold text-white">{m.newQuantity}</span>
                          </span>
                        </TableCell>

                        {/* Supplier / Location */}
                        <TableCell className="py-4 text-xs text-slate-300">
                          <div className="space-y-0.5 max-w-xs">
                            {m.supplier && (
                              <span className="flex items-center gap-1 text-slate-200">
                                <Building2 className="h-3 w-3 text-slate-400" />
                                {m.supplier}
                              </span>
                            )}
                            <span className="flex items-center gap-1 text-slate-400 text-[11px]">
                              <MapPin className="h-3 w-3 text-slate-500" />
                              {m.location || 'Main Warehouse'}
                              {m.batchLot && ` (Lot: ${m.batchLot})`}
                            </span>
                          </div>
                        </TableCell>

                        {/* Reason & Notes */}
                        <TableCell className="pr-6 py-4 text-xs text-slate-300">
                          <div className="space-y-0.5 max-w-xs">
                            {m.reason && (
                              <p className="font-medium text-slate-200">{m.reason}</p>
                            )}
                            {m.notes && (
                              <p className="text-[11px] text-slate-400 italic line-clamp-1">
                                {m.notes}
                              </p>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="py-16 text-center text-slate-500">
                      <History className="h-10 w-10 mx-auto mb-2 text-slate-600" />
                      <p className="text-sm font-semibold text-slate-300">No stock movements recorded yet</p>
                      <p className="text-xs text-slate-500">
                        Add stock or log an adjustment to begin recording movements.
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
  );
}

