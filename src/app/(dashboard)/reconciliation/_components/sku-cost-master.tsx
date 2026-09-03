'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { formatINRWithDecimals } from '@/lib/format';
import { useToast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/apiFetch';
import { cn } from '@/lib/utils';
import {
  Coins,
  Search,
  CheckCircle2,
  AlertTriangle,
  Edit3,
  PlusCircle,
  RotateCcw,
  Sparkles,
  Package,
} from 'lucide-react';
import { SkuMasterItem, SkuMasterSummary } from '@/lib/reconciliation/sku-master-service';

interface SkuCostMasterProps {
  accountId: string;
  onCostConfigured?: () => void;
  refreshTrigger?: number;
}

export function SkuCostMaster({
  accountId,
  onCostConfigured,
  refreshTrigger = 0,
}: SkuCostMasterProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [skus, setSkus] = useState<SkuMasterItem[]>([]);
  const [summary, setSummary] = useState<SkuMasterSummary>({
    totalSkus: 0,
    configuredSkus: 0,
    pendingSkus: 0,
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'configured' | 'pending'>('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeItem, setActiveItem] = useState<SkuMasterItem | null>(null);
  const [modalProductName, setModalProductName] = useState('');
  const [modalCostPrice, setModalCostPrice] = useState('');
  const [modalPackagingCost, setModalPackagingCost] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Fetch SKU master data
  const fetchSkuMaster = useCallback(async (isRefresh = false) => {
    if (!accountId) return;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await apiFetch(`/api/reconciliation/sku-master?limit=200`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setSkus(data.skus || []);
          setSummary(
            data.summary || {
              totalSkus: 0,
              configuredSkus: 0,
              pendingSkus: 0,
            }
          );
        }
      }
    } catch (err) {
      console.error('Failed to load SKU master data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [accountId]);

  useEffect(() => {
    fetchSkuMaster();
  }, [fetchSkuMaster, refreshTrigger]);

  // Open modal for editing or setting cost
  const handleOpenModal = (item: SkuMasterItem) => {
    setActiveItem(item);
    setModalProductName(item.productName || '');
    setModalCostPrice(
      item.costStatus === 'configured' && item.costPrice > 0 ? String(item.costPrice) : ''
    );
    setModalPackagingCost(
      item.costStatus === 'configured' && item.packagingCost > 0 ? String(item.packagingCost) : ''
    );
    setValidationError(null);
    setIsModalOpen(true);
  };

  // Save cost configuration
  const handleSaveCost = async () => {
    if (!activeItem || !accountId) return;

    // Validate inputs
    const costNum = parseFloat(modalCostPrice.trim());
    const pkgNum = parseFloat(modalPackagingCost.trim());

    if (isNaN(costNum) || !isFinite(costNum) || costNum < 0) {
      setValidationError('Please enter a valid non-negative number for Cost Price.');
      return;
    }

    if (isNaN(pkgNum) || !isFinite(pkgNum) || pkgNum < 0) {
      setValidationError('Please enter a valid non-negative number for Packaging Cost.');
      return;
    }

    setIsSaving(true);
    setValidationError(null);

    try {
      const res = await apiFetch('/api/reconciliation/sku-master', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-account-id': accountId,
        },
        body: JSON.stringify({
          sku: activeItem.sku,
          productName: modalProductName.trim() || undefined,
          costPrice: costNum,
          packagingCost: pkgNum,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast({
          title: 'SKU Cost Saved',
          description: `Configured ${activeItem.sku}. Recalculated ${data.affectedTransactions} transaction(s).`,
        });
        setIsModalOpen(false);
        fetchSkuMaster();
        onCostConfigured?.();
      } else {
        setValidationError(data.message || 'Failed to save SKU configuration');
      }
    } catch (err: any) {
      setValidationError(err.message || 'Error occurred while saving');
    } finally {
      setIsSaving(false);
    }
  };

  // Filtered list
  const filteredSkus = useMemo(() => {
    let list = skus;

    if (statusFilter !== 'all') {
      list = list.filter((s) => s.costStatus === statusFilter);
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(
        (s) =>
          s.sku.toLowerCase().includes(q) ||
          (s.productName && s.productName.toLowerCase().includes(q))
      );
    }

    return list;
  }, [skus, statusFilter, searchTerm]);

  return (
    <div id="sku-cost-master-section" className="space-y-4">
      {/* 1. Header & Summary Bar */}
      <Card className="glass-panel bg-slate-950/60 border-white/15 rounded-2xl overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.25)]">
        <CardHeader className="pb-4 border-b border-white/15 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-base sm:text-lg font-black text-white flex items-center gap-2">
              <Coins className="h-5 w-5 text-amber-400" />
              <span>SKU Cost Master</span>
            </CardTitle>
            <p className="text-xs text-slate-300 mt-1 font-medium">
              Set product cost and packaging once. Future reconciliation uploads automatically reuse these values.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Configured Pill */}
            <div className="glass-pill px-3 py-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 flex items-center gap-2 text-xs">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span className="font-semibold text-slate-300">Configured:</span>
              <span className="font-black text-white">{summary.configuredSkus}</span>
            </div>

            {/* Pending Pill (clickable to filter) */}
            <button
              onClick={() => setStatusFilter('pending')}
              className={cn(
                'glass-pill px-3 py-1.5 rounded-xl border flex items-center gap-2 text-xs transition-all',
                summary.pendingSkus > 0
                  ? 'border-amber-500/40 bg-amber-500/15 text-amber-200 hover:bg-amber-500/25 cursor-pointer animate-pulse'
                  : 'border-white/10 bg-slate-900/60 text-slate-400'
              )}
            >
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              <span className="font-semibold">Pending Setup:</span>
              <span className="font-black text-amber-300">{summary.pendingSkus}</span>
            </button>

            <Button
              onClick={() => fetchSkuMaster(true)}
              disabled={refreshing || loading}
              size="sm"
              variant="outline"
              className="glass-button bg-slate-900/80 border-white/15 text-white h-8 px-3 rounded-xl hover:bg-white/10"
            >
              <RotateCcw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
            </Button>
          </div>
        </CardHeader>

        {/* Pending Banner Alert if required */}
        {summary.pendingSkus > 0 && (
          <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 text-xs text-amber-200 font-semibold">
              <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0" />
              <span>
                {summary.pendingSkus} SKU{summary.pendingSkus > 1 ? 's require' : ' requires'} cost & packaging configuration for accurate profitability.
              </span>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setStatusFilter('pending')}
              className="text-xs font-bold text-amber-300 hover:text-white hover:bg-amber-500/20 h-7 px-2.5 rounded-lg w-fit"
            >
              Show Pending Only →
            </Button>
          </div>
        )}

        {/* 2. Controls Bar: Search & Status Filters */}
        <div className="p-4 sm:p-6 pb-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-b border-white/10">
          {/* Status filter tabs */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900/80 border border-white/10 w-full sm:w-auto">
            <button
              onClick={() => setStatusFilter('all')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex-1 sm:flex-none',
                statusFilter === 'all'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              )}
            >
              All ({summary.totalSkus})
            </button>
            <button
              onClick={() => setStatusFilter('configured')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex-1 sm:flex-none',
                statusFilter === 'configured'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              )}
            >
              Configured ({summary.configuredSkus})
            </button>
            <button
              onClick={() => setStatusFilter('pending')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex-1 sm:flex-none',
                statusFilter === 'pending'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              )}
            >
              Cost Pending ({summary.pendingSkus})
            </button>
          </div>

          {/* Search box */}
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search SKU or product..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-9 w-full pl-9 pr-4 rounded-xl bg-slate-900/90 border border-white/15 text-xs text-white placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
        </div>

        {/* 3. SKU Master Table */}
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/15 bg-white/[0.04] text-slate-300 font-bold uppercase text-[11px] tracking-wider">
                  <th className="text-left py-3.5 px-4 font-bold">SKU</th>
                  <th className="text-left py-3.5 px-4 font-bold min-w-[220px]">Product</th>
                  <th className="text-right py-3.5 px-4 font-bold">Cost Price</th>
                  <th className="text-right py-3.5 px-4 font-bold">Packaging</th>
                  <th className="text-center py-3.5 px-4 font-bold">Orders</th>
                  <th className="text-center py-3.5 px-4 font-bold">Status</th>
                  <th className="text-right py-3.5 px-4 font-bold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-medium">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400 text-xs">
                      <div className="flex items-center justify-center gap-2">
                        <RotateCcw className="h-4 w-4 animate-spin text-indigo-400" />
                        <span>Loading SKU master records...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredSkus.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400 text-xs">
                      No SKUs matching the current filter.
                    </td>
                  </tr>
                ) : (
                  filteredSkus.map((item) => {
                    const isConfigured = item.costStatus === 'configured';
                    return (
                      <tr
                        key={item.id}
                        className={cn(
                          'hover:bg-white/[0.04] transition-colors',
                          !isConfigured && 'bg-amber-500/[0.02]'
                        )}
                      >
                        <td className="py-3 px-4 font-mono font-bold text-indigo-300">
                          {item.sku}
                        </td>
                        <td
                          className="py-3 px-4 text-slate-100 truncate max-w-[260px]"
                          title={item.productName || item.sku}
                        >
                          {item.productName || <span className="text-slate-500 italic">No name provided</span>}
                        </td>
                        <td className="py-3 px-4 text-right font-black">
                          {isConfigured ? (
                            <span className="text-white">{formatINRWithDecimals(item.costPrice)}</span>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-black">
                          {isConfigured ? (
                            <span className="text-white">{formatINRWithDecimals(item.packagingCost)}</span>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-slate-300">
                          {item.totalOrders > 0 ? (
                            <Badge
                              variant="outline"
                              className="text-[10px] font-bold border px-2 py-0.5 border-white/15 bg-white/5 text-slate-200"
                            >
                              {item.totalOrders} units
                            </Badge>
                          ) : (
                            <span className="text-slate-500">0</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {isConfigured ? (
                            <Badge
                              variant="outline"
                              className="text-[10px] font-bold border px-2 py-0.5 bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                            >
                              Configured
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-[10px] font-bold border px-2 py-0.5 bg-amber-500/15 text-amber-300 border-amber-500/30"
                            >
                              Cost Pending
                            </Badge>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Button
                            onClick={() => handleOpenModal(item)}
                            size="sm"
                            variant="outline"
                            className={cn(
                              'h-7 px-2.5 rounded-lg text-xs font-bold transition-all',
                              isConfigured
                                ? 'glass-button bg-slate-900 border-white/15 text-slate-200 hover:text-white hover:bg-white/10'
                                : 'bg-amber-500/20 border-amber-500/40 text-amber-200 hover:bg-amber-500/30'
                            )}
                          >
                            {isConfigured ? (
                              <>
                                <Edit3 className="h-3 w-3 mr-1" />
                                Edit
                              </>
                            ) : (
                              <>
                                <PlusCircle className="h-3 w-3 mr-1" />
                                Set Cost
                              </>
                            )}
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 4. Set / Edit Cost Dialog Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="glass-panel bg-slate-950/95 border-white/20 text-white sm:max-w-[480px] rounded-2xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black flex items-center gap-2 font-headline">
              <Coins className="h-5 w-5 text-amber-400" />
              <span>
                {activeItem?.costStatus === 'configured' ? 'Edit SKU Cost' : 'Set SKU Cost'}
              </span>
            </DialogTitle>
            <p className="text-xs text-slate-400 font-medium">
              Configured costs are permanently saved for this account and automatically applied to past and future reconciliations.
            </p>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* SKU (Read-Only) */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                SKU (Identifier)
              </label>
              <Input
                readOnly
                value={activeItem?.sku || ''}
                className="bg-slate-900/60 border-white/10 text-indigo-300 font-mono font-bold text-xs h-9 cursor-not-allowed"
              />
            </div>

            {/* Product Name (Editable) */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-300 block mb-1">
                Product Name
              </label>
              <Input
                placeholder="Product description..."
                value={modalProductName}
                onChange={(e) => setModalProductName(e.target.value)}
                className="bg-slate-900 border-white/15 text-white text-xs h-9 focus:border-indigo-500"
              />
            </div>

            {/* Cost Price & Packaging Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-300 block mb-1">
                  Cost Price (₹) <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-2.5 top-2 text-xs text-slate-400 font-bold">₹</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={modalCostPrice}
                    onChange={(e) => setModalCostPrice(e.target.value)}
                    className="bg-slate-900 border-white/15 text-white pl-6 text-xs h-9 font-bold focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-300 block mb-1">
                  Packaging Cost (₹) <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-2.5 top-2 text-xs text-slate-400 font-bold">₹</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={modalPackagingCost}
                    onChange={(e) => setModalPackagingCost(e.target.value)}
                    className="bg-slate-900 border-white/15 text-white pl-6 text-xs h-9 font-bold focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* Validation Error Message */}
            {validationError && (
              <div className="p-2.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-rose-400 flex-shrink-0" />
                <span>{validationError}</span>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-white/10">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsModalOpen(false)}
              className="glass-button bg-slate-900 border-white/15 text-slate-300 h-9 px-4 rounded-xl"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={isSaving}
              onClick={handleSaveCost}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold h-9 px-5 rounded-xl shadow-md"
            >
              {isSaving ? (
                <>
                  <RotateCcw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Saving & Recalculating...
                </>
              ) : (
                'Save Cost'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

