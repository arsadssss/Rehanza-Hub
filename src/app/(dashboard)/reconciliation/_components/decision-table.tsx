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
  Sparkles,
  Rocket,
  ShieldCheck,
  Eye,
  AlertTriangle,
  OctagonX,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  SkuDecisionRecommendation,
  DecisionState,
  DecisionConfidence,
} from '@/lib/reconciliation/types';

interface DecisionTableProps {
  decisions: SkuDecisionRecommendation[] | null;
  selectedDecisionFilter: DecisionState | 'ALL';
  onSelectDecisionFilter: (filter: DecisionState | 'ALL') => void;
  loading: boolean;
}

type SortField =
  | 'riskScore'
  | 'opportunityScore'
  | 'profit'
  | 'profitMargin'
  | 'totalOrders'
  | 'returnRate'
  | 'rtoRate';
type SortDirection = 'asc' | 'desc';

const DECISION_BADGES: Record<
  DecisionState,
  { label: string; bg: string; text: string; border: string; icon: any }
> = {
  SCALE: {
    label: 'SCALE',
    bg: 'bg-emerald-500/15',
    text: 'text-emerald-300',
    border: 'border-emerald-500/30',
    icon: Rocket,
  },
  HEALTHY: {
    label: 'HEALTHY',
    bg: 'bg-blue-500/15',
    text: 'text-blue-300',
    border: 'border-blue-500/30',
    icon: ShieldCheck,
  },
  MONITOR: {
    label: 'MONITOR',
    bg: 'bg-indigo-500/15',
    text: 'text-indigo-300',
    border: 'border-indigo-500/30',
    icon: Eye,
  },
  REVIEW: {
    label: 'REVIEW',
    bg: 'bg-amber-500/15',
    text: 'text-amber-300',
    border: 'border-amber-500/30',
    icon: AlertTriangle,
  },
  STOP: {
    label: 'STOP',
    bg: 'bg-rose-500/15',
    text: 'text-rose-300',
    border: 'border-rose-500/30',
    icon: OctagonX,
  },
};

const CONFIDENCE_BADGES: Record<DecisionConfidence, { bg: string; text: string; border: string }> = {
  HIGH: { bg: 'bg-emerald-500/10', text: 'text-emerald-300', border: 'border-emerald-500/30' },
  MEDIUM: { bg: 'bg-blue-500/10', text: 'text-blue-300', border: 'border-blue-500/30' },
  LOW: { bg: 'bg-slate-500/10', text: 'text-slate-300', border: 'border-slate-500/30' },
};

export function DecisionTable({
  decisions,
  selectedDecisionFilter,
  onSelectDecisionFilter,
  loading,
}: DecisionTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('riskScore');
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

  // Filter and sort decisions
  const processedDecisions = useMemo(() => {
    if (!decisions) return [];

    let filtered = decisions;

    // Decision state filter
    if (selectedDecisionFilter !== 'ALL') {
      filtered = filtered.filter((d) => d.decision === selectedDecisionFilter);
    }

    // Search query
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (d) =>
          d.sku.toLowerCase().includes(q) ||
          (d.productName && d.productName.toLowerCase().includes(q))
      );
    }

    // Sort
    return [...filtered].sort((a, b) => {
      let aVal = 0;
      let bVal = 0;

      if (sortField === 'riskScore') {
        aVal = a.riskScore;
        bVal = b.riskScore;
      } else if (sortField === 'opportunityScore') {
        aVal = a.opportunityScore;
        bVal = b.opportunityScore;
      } else if (sortField === 'profit') {
        aVal = a.metrics.profit;
        bVal = b.metrics.profit;
      } else if (sortField === 'profitMargin') {
        aVal = a.metrics.profitMargin ?? -Infinity;
        bVal = b.metrics.profitMargin ?? -Infinity;
      } else if (sortField === 'totalOrders') {
        aVal = a.metrics.totalOrders;
        bVal = b.metrics.totalOrders;
      } else if (sortField === 'returnRate') {
        aVal = a.metrics.returnRate;
        bVal = b.metrics.returnRate;
      } else if (sortField === 'rtoRate') {
        aVal = a.metrics.rtoRate;
        bVal = b.metrics.rtoRate;
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [decisions, selectedDecisionFilter, searchTerm, sortField, sortDirection]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(processedDecisions.length / pageSize));
  const paginatedDecisions = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return processedDecisions.slice(start, start + pageSize);
  }, [processedDecisions, currentPage, pageSize]);

  if (loading || !decisions) {
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
            <Sparkles className="h-5 w-5 text-indigo-400" />
            <span>Business Scaling & Operational Decision Master Table</span>
          </CardTitle>
          <p className="text-xs text-slate-300 mt-0.5 font-medium">
            Showing {processedDecisions.length} recommendations ({selectedDecisionFilter} filter active)
          </p>
        </div>

        {/* Filters & Search */}
        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          {/* Decision Pill Filter */}
          <div className="inline-flex rounded-xl p-0.5 bg-slate-900 border border-white/15 text-[11px] font-bold">
            {(['ALL', 'SCALE', 'HEALTHY', 'MONITOR', 'REVIEW', 'STOP'] as const).map((filterOpt) => (
              <button
                key={filterOpt}
                type="button"
                onClick={() => {
                  onSelectDecisionFilter(filterOpt);
                  setCurrentPage(1);
                }}
                className={cn(
                  'px-2.5 py-1 rounded-lg transition-all',
                  selectedDecisionFilter === filterOpt
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                )}
              >
                {filterOpt}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative flex-1 sm:w-56">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search SKU..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="h-8 w-full pl-8 pr-3 rounded-xl bg-slate-900/90 border border-white/15 text-xs text-white placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/15 bg-white/[0.04] text-slate-300 font-bold uppercase text-[11px] tracking-wider">
                <th className="text-left py-3 px-4 font-bold">SKU</th>
                <th className="text-left py-3 px-3 font-bold min-w-[150px]">Product</th>
                <th className="text-center py-3 px-3 font-bold">Decision</th>
                <th className="text-center py-3 px-2 font-bold">Conf.</th>
                <th
                  onClick={() => handleSort('totalOrders')}
                  className="text-right py-3 px-3 font-bold cursor-pointer hover:text-white transition-colors"
                >
                  <span className="inline-flex items-center gap-1">
                    Orders <ArrowUpDown className="h-3 w-3" />
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
                <th
                  onClick={() => handleSort('returnRate')}
                  className="text-right py-3 px-3 font-bold cursor-pointer hover:text-white transition-colors"
                >
                  <span className="inline-flex items-center gap-1">
                    Return % <ArrowUpDown className="h-3 w-3" />
                  </span>
                </th>
                <th
                  onClick={() => handleSort('rtoRate')}
                  className="text-right py-3 px-3 font-bold cursor-pointer hover:text-white transition-colors"
                >
                  <span className="inline-flex items-center gap-1">
                    RTO % <ArrowUpDown className="h-3 w-3" />
                  </span>
                </th>
                <th
                  onClick={() => handleSort('riskScore')}
                  className="text-right py-3 px-3 font-bold cursor-pointer hover:text-white transition-colors"
                >
                  <span className="inline-flex items-center gap-1">
                    Risk <ArrowUpDown className="h-3 w-3" />
                  </span>
                </th>
                <th
                  onClick={() => handleSort('opportunityScore')}
                  className="text-right py-3 px-3 font-bold cursor-pointer hover:text-white transition-colors"
                >
                  <span className="inline-flex items-center gap-1">
                    Opp. <ArrowUpDown className="h-3 w-3" />
                  </span>
                </th>
                <th className="text-left py-3 px-4 font-bold min-w-[200px]">Action & Rationale</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-medium">
              {paginatedDecisions.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-8 text-center text-slate-400 text-xs">
                    No recommendations matching current filters.
                  </td>
                </tr>
              ) : (
                paginatedDecisions.map((item) => {
                  const badge = DECISION_BADGES[item.decision] || DECISION_BADGES.MONITOR;
                  const Icon = badge.icon;
                  const confBadge = CONFIDENCE_BADGES[item.confidence] || CONFIDENCE_BADGES.LOW;
                  const isProfitPos = item.metrics.profit >= 0;

                  return (
                    <tr key={item.sku} className="hover:bg-white/[0.04] transition-colors">
                      <td className="py-2.5 px-4 font-mono font-bold text-indigo-300">
                        {item.sku}
                      </td>
                      <td className="py-2.5 px-3 text-slate-100 truncate max-w-[180px]" title={item.productName}>
                        {item.productName}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[10px] font-black uppercase px-2 py-0.5 rounded-lg border inline-flex items-center gap-1',
                            badge.bg,
                            badge.text,
                            badge.border
                          )}
                        >
                          <Icon className="h-3 w-3" />
                          <span>{badge.label}</span>
                        </Badge>
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        <Badge
                          variant="outline"
                          className={cn('text-[9px] font-bold border px-1.5 py-0.2', confBadge.bg, confBadge.text, confBadge.border)}
                        >
                          {item.confidence}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 text-right font-black text-white">
                        {item.metrics.totalOrders.toLocaleString('en-IN')}
                      </td>
                      <td className="py-2.5 px-3 text-right font-black">
                        <span className={cn(isProfitPos ? 'text-emerald-400' : 'text-rose-400')}>
                          {formatINRWithDecimals(item.metrics.profit)}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold">
                        {item.metrics.profitMargin !== null ? `${item.metrics.profitMargin}%` : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-amber-400">
                        {item.metrics.returnRate}%
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-rose-400">
                        {item.metrics.rtoRate}%
                      </td>
                      <td className="py-2.5 px-3 text-right font-black">
                        <span className={cn(item.riskScore >= 60 ? 'text-rose-400' : 'text-slate-300')}>
                          {item.riskScore}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-black">
                        <span className={cn(item.opportunityScore >= 60 ? 'text-emerald-400' : 'text-slate-300')}>
                          {item.opportunityScore}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-left">
                        <p className="text-[11px] font-bold text-indigo-200 truncate max-w-[220px]" title={item.action}>
                          {item.action}
                        </p>
                        <p className="text-[10px] text-slate-400 truncate max-w-[220px]" title={item.primaryReason}>
                          {item.primaryReason}
                        </p>
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
              {Math.min(currentPage * pageSize, processedDecisions.length)} of {processedDecisions.length} recommendations
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

