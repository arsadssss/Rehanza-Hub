'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatINRWithDecimals } from '@/lib/format';
import {
  Search,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Package,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SkuProfitabilityMetric } from '@/lib/reconciliation/types';

interface SkuTableProps {
  skus: SkuProfitabilityMetric[] | null;
  loading: boolean;
}

type SortField = 'totalOrders' | 'revenue' | 'profit' | 'profitMargin' | 'returnRate' | 'rtoRate';
type SortDirection = 'asc' | 'desc';

export function SkuTable({ skus, loading }: SkuTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('profit');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
    setCurrentPage(1);
  };

  // Filter and Sort
  const processedSkus = useMemo(() => {
    if (!skus) return [];

    let filtered = skus;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.sku.toLowerCase().includes(q) ||
          (s.productName && s.productName.toLowerCase().includes(q))
      );
    }

    return [...filtered].sort((a, b) => {
      let aVal = a[sortField] ?? -Infinity;
      let bVal = b[sortField] ?? -Infinity;

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [skus, searchTerm, sortField, sortDirection]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(processedSkus.length / pageSize));
  const paginatedSkus = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return processedSkus.slice(start, start + pageSize);
  }, [processedSkus, currentPage, pageSize]);

  if (loading || !skus) {
    return (
      <Card className="glass-panel bg-slate-950/60 border-white/15 rounded-2xl p-6 space-y-4 shadow-[0_8px_30px_rgba(0,0,0,0.25)]">
        <div className="flex justify-between items-center">
          <Skeleton className="h-6 w-48 bg-white/10" />
          <Skeleton className="h-9 w-64 rounded-xl bg-white/10" />
        </div>
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-12 w-full bg-white/5" />
        ))}
      </Card>
    );
  }

  return (
    <Card className="glass-panel bg-slate-950/60 border-white/15 rounded-2xl overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.25)]">
      <CardHeader className="pb-4 border-b border-white/15 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <CardTitle className="text-base md:text-lg font-black text-white flex items-center gap-2">
            <Package className="h-5 w-5 text-indigo-400" />
            <span>SKU Profitability & Performance Master Table</span>
          </CardTitle>
          <p className="text-xs text-slate-300 mt-0.5 font-medium">
            {processedSkus.length} catalog items evaluated in current period
          </p>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search SKU or product..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="h-9 w-full pl-9 pr-4 rounded-xl bg-slate-900/90 border border-white/15 text-xs text-white placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/15 bg-white/[0.04] text-slate-300 font-bold uppercase text-[11px] tracking-wider">
                <th className="text-left py-3 px-4 font-bold">SKU</th>
                <th className="text-left py-3 px-4 font-bold min-w-[180px]">Product</th>
                <th
                  onClick={() => handleSort('totalOrders')}
                  className="text-right py-3 px-3 font-bold cursor-pointer hover:text-white transition-colors"
                >
                  <span className="inline-flex items-center gap-1">
                    Orders <ArrowUpDown className="h-3 w-3" />
                  </span>
                </th>
                <th
                  onClick={() => handleSort('revenue')}
                  className="text-right py-3 px-3 font-bold cursor-pointer hover:text-white transition-colors"
                >
                  <span className="inline-flex items-center gap-1">
                    Revenue <ArrowUpDown className="h-3 w-3" />
                  </span>
                </th>
                <th
                  onClick={() => handleSort('profit')}
                  className="text-right py-3 px-3 font-bold cursor-pointer hover:text-white transition-colors"
                >
                  <span className="inline-flex items-center gap-1">
                    Profit <ArrowUpDown className="h-3 w-3" />
                  </span>
                </th>
                <th
                  onClick={() => handleSort('profitMargin')}
                  className="text-right py-3 px-3 font-bold cursor-pointer hover:text-white transition-colors"
                >
                  <span className="inline-flex items-center gap-1">
                    Margin <ArrowUpDown className="h-3 w-3" />
                  </span>
                </th>
                <th className="text-center py-3 px-3 font-bold">Cost Status</th>
                <th className="text-right py-3 px-3 font-bold">Returns</th>
                <th
                  onClick={() => handleSort('returnRate')}
                  className="text-right py-3 px-3 font-bold cursor-pointer hover:text-white transition-colors"
                >
                  <span className="inline-flex items-center gap-1">
                    Return % <ArrowUpDown className="h-3 w-3" />
                  </span>
                </th>
                <th className="text-right py-3 px-3 font-bold">RTO</th>
                <th
                  onClick={() => handleSort('rtoRate')}
                  className="text-right py-3 px-3 font-bold cursor-pointer hover:text-white transition-colors"
                >
                  <span className="inline-flex items-center gap-1">
                    RTO % <ArrowUpDown className="h-3 w-3" />
                  </span>
                </th>
                <th className="text-right py-3 px-4 font-bold">AOV</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-medium">
              {paginatedSkus.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-8 text-center text-slate-400 text-xs">
                    No matching SKUs found.
                  </td>
                </tr>
              ) : (
                paginatedSkus.map((item) => {
                  const isProfitPos = item.profit >= 0;
                  const isConfigured = item.costStatus === 'configured';
                  return (
                    <tr key={item.sku} className="hover:bg-white/[0.04] transition-colors">
                      <td className="py-2.5 px-4 font-mono font-bold text-indigo-300">
                        {item.sku}
                      </td>
                      <td className="py-2.5 px-4 text-slate-100 truncate max-w-[220px]" title={item.productName}>
                        {item.productName}
                      </td>
                      <td className="py-2.5 px-3 text-right font-black text-white">
                        {item.totalOrders.toLocaleString('en-IN')}
                      </td>
                      <td className="py-2.5 px-3 text-right font-black text-white">
                        {formatINRWithDecimals(item.revenue)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-black">
                        {isConfigured ? (
                          <span className={cn(isProfitPos ? 'text-emerald-400' : 'text-rose-400')}>
                            {formatINRWithDecimals(item.profit)}
                          </span>
                        ) : (
                          <span className="text-amber-400/80 font-normal italic text-[11px]" title="Cost configuration pending in SKU Cost Master">
                            Cost Pending
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {isConfigured && item.profitMargin !== null ? (
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-[10px] font-bold border px-1.5 py-0.5',
                              item.profitMargin >= 0
                                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                            )}
                          >
                            {item.profitMargin}%
                          </Badge>
                        ) : (
                          <span className="text-slate-500 text-[11px]">—</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {isConfigured ? (
                          <Badge
                            variant="outline"
                            className="text-[10px] font-bold border px-1.5 py-0.5 bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                          >
                            Configured
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-[10px] font-bold border px-1.5 py-0.5 bg-amber-500/15 text-amber-300 border-amber-500/30"
                          >
                            Cost Pending
                          </Badge>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-300 font-bold">
                        {item.returnOrders.toLocaleString('en-IN')}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-amber-400">
                        {item.returnRate}%
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-300 font-bold">
                        {item.rtoOrders.toLocaleString('en-IN')}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-rose-400">
                        {item.rtoRate}%
                      </td>
                      <td className="py-2.5 px-4 text-right text-slate-300 font-bold">
                        {item.aov !== null ? formatINRWithDecimals(item.aov) : '—'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="p-3 border-t border-white/10 flex items-center justify-between text-xs text-slate-300">
            <span>
              Showing {((currentPage - 1) * pageSize) + 1} to{' '}
              {Math.min(currentPage * pageSize, processedSkus.length)} of {processedSkus.length} SKUs
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="h-8 px-2.5 glass-button bg-slate-900/80 border-white/15 text-white"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="font-bold text-white px-1">
                {currentPage} / {totalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="h-8 px-2.5 glass-button bg-slate-900/80 border-white/15 text-white"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

