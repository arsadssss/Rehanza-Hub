'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatINRWithDecimals } from '@/lib/format';
import { Trophy, AlertTriangle, Layers, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  TopReturnRtoItem,
  TopPerformingProductItem,
  TopReturnRtoMode,
} from '@/lib/reconciliation/types';

interface TopTenTablesProps {
  topPerformingProducts?: TopPerformingProductItem[];
  topReturnsRto?: {
    combined: TopReturnRtoItem[];
    returnsOnly: TopReturnRtoItem[];
    rtoOnly: TopReturnRtoItem[];
  };
  loading: boolean;
}

export function TopTenTables({
  topPerformingProducts,
  topReturnsRto,
  loading,
}: TopTenTablesProps) {
  const [returnMode, setReturnMode] = useState<TopReturnRtoMode>('combined');

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="glass-panel bg-slate-950/60 border-white/15 rounded-2xl p-5 space-y-3 shadow-[0_8px_30px_rgba(0,0,0,0.25)]">
          <Skeleton className="h-6 w-48 bg-white/10" />
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-9 w-full bg-white/5" />
          ))}
        </Card>
        <Card className="glass-panel bg-slate-950/60 border-white/15 rounded-2xl p-5 space-y-3 shadow-[0_8px_30px_rgba(0,0,0,0.25)]">
          <Skeleton className="h-6 w-48 bg-white/10" />
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-9 w-full bg-white/5" />
          ))}
        </Card>
      </div>
    );
  }

  const performingList = topPerformingProducts || [];
  const currentReturnList =
    returnMode === 'combined'
      ? topReturnsRto?.combined || []
      : returnMode === 'returns_only'
      ? topReturnsRto?.returnsOnly || []
      : topReturnsRto?.rtoOnly || [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 1. TOP 10 PERFORMING PRODUCTS (Excel Final!A26:B36) */}
      <Card className="glass-panel bg-slate-950/60 border-white/15 rounded-2xl overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.25)] flex flex-col justify-between">
        <div>
          <CardHeader className="pb-3 border-b border-white/15 flex flex-row items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base md:text-lg font-black text-white flex items-center gap-2">
                <Trophy className="h-5 w-5 text-amber-400" />
                <span>Top 10 Performing Products</span>
              </CardTitle>
              <p className="text-xs text-slate-300 mt-0.5 font-medium">
                Highest order volume products (Excel Final sheet parity)
              </p>
            </div>
            <Badge
              variant="outline"
              className="text-[10px] font-bold text-amber-300 bg-amber-500/10 border-amber-400/25 px-2 py-0.5 rounded-lg uppercase"
            >
              Order Leaderboard
            </Badge>
          </CardHeader>

          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.03] text-slate-300 font-bold uppercase text-[10px] tracking-wider">
                    <th className="text-center py-2.5 px-3 w-10 font-bold">#</th>
                    <th className="text-left py-2.5 px-3 font-bold">SKU</th>
                    <th className="text-left py-2.5 px-3 font-bold min-w-[120px]">Product</th>
                    <th className="text-right py-2.5 px-3 font-bold">Orders</th>
                    <th className="text-right py-2.5 px-3 font-bold">Revenue</th>
                    <th className="text-right py-2.5 px-3 font-bold">Profit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-medium">
                  {performingList.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-400 text-xs">
                        No product order records available.
                      </td>
                    </tr>
                  ) : (
                    performingList.map((item) => (
                      <tr key={item.sku} className="hover:bg-white/[0.04] transition-colors">
                        <td className="py-2 px-3 text-center font-black text-amber-400 text-xs">
                          #{item.rank}
                        </td>
                        <td className="py-2 px-3 font-mono font-bold text-indigo-300">
                          {item.sku}
                        </td>
                        <td
                          className="py-2 px-3 text-slate-200 truncate max-w-[150px]"
                          title={item.productName}
                        >
                          {item.productName}
                        </td>
                        <td className="py-2 px-3 text-right font-black text-white">
                          {item.totalOrders.toLocaleString('en-IN')}
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-slate-200">
                          {formatINRWithDecimals(item.revenue)}
                        </td>
                        <td
                          className={cn(
                            'py-2 px-3 text-right font-black',
                            item.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          )}
                        >
                          {formatINRWithDecimals(item.profit)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </div>
      </Card>

      {/* 2. TOP 10 RETURNS & RTO ANALYSIS (Excel Final!E27:F37 + Selector Final!I27) */}
      <Card className="glass-panel bg-slate-950/60 border-white/15 rounded-2xl overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.25)] flex flex-col justify-between">
        <div>
          <CardHeader className="pb-3 border-b border-white/15 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base md:text-lg font-black text-white flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-rose-400" />
                <span>Top 10 Returns / RTO Analysis</span>
              </CardTitle>
              <p className="text-xs text-slate-300 mt-0.5 font-medium">
                Excel parity reverse logistics breakdown with dynamic mode selector
              </p>
            </div>

            {/* Workbook Final!I27 Selector */}
            <div className="inline-flex rounded-xl p-0.5 bg-slate-900 border border-white/15 text-[11px] font-bold">
              <button
                type="button"
                onClick={() => setReturnMode('combined')}
                className={cn(
                  'px-2 py-1 rounded-lg transition-all',
                  returnMode === 'combined'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                )}
              >
                Combined
              </button>
              <button
                type="button"
                onClick={() => setReturnMode('returns_only')}
                className={cn(
                  'px-2 py-1 rounded-lg transition-all',
                  returnMode === 'returns_only'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                )}
              >
                Returns Only
              </button>
              <button
                type="button"
                onClick={() => setReturnMode('rto_only')}
                className={cn(
                  'px-2 py-1 rounded-lg transition-all',
                  returnMode === 'rto_only'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                )}
              >
                RTO Only
              </button>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.03] text-slate-300 font-bold uppercase text-[10px] tracking-wider">
                    <th className="text-center py-2.5 px-3 w-10 font-bold">#</th>
                    <th className="text-left py-2.5 px-3 font-bold">SKU</th>
                    <th className="text-left py-2.5 px-3 font-bold min-w-[120px]">Product</th>
                    <th className="text-right py-2.5 px-3 font-bold">Orders</th>
                    <th className="text-right py-2.5 px-3 font-bold">
                      {returnMode === 'combined'
                        ? 'Returns/RTO'
                        : returnMode === 'returns_only'
                        ? 'Returns'
                        : 'RTO'}
                    </th>
                    <th className="text-right py-2.5 px-3 font-bold">Rate %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-medium">
                  {currentReturnList.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-400 text-xs">
                        No reverse logistics records in this category.
                      </td>
                    </tr>
                  ) : (
                    currentReturnList.map((item) => (
                      <tr key={item.sku} className="hover:bg-white/[0.04] transition-colors">
                        <td className="py-2 px-3 text-center font-black text-rose-400 text-xs">
                          #{item.rank}
                        </td>
                        <td className="py-2 px-3 font-mono font-bold text-rose-200">
                          {item.sku}
                        </td>
                        <td
                          className="py-2 px-3 text-slate-200 truncate max-w-[150px]"
                          title={item.productName}
                        >
                          {item.productName}
                        </td>
                        <td className="py-2 px-3 text-right font-medium text-slate-300">
                          {item.totalOrders.toLocaleString('en-IN')}
                        </td>
                        <td className="py-2 px-3 text-right font-black text-rose-400">
                          {item.count.toLocaleString('en-IN')}
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-amber-300">
                          {item.rate}%
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </div>
      </Card>
    </div>
  );
}

