'use client';

import React, { useState, useEffect } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/apiFetch';
import {
  Trash2,
  AlertTriangle,
  ShieldCheck,
  Loader2,
  FileSpreadsheet,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ResetReconciliationDialogProps {
  accountId: string | null;
  accountName: string;
  onResetComplete: () => void;
  className?: string;
}

export function ResetReconciliationDialog({
  accountId,
  accountName,
  onResetComplete,
  className,
}: ResetReconciliationDialogProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewCounts, setPreviewCounts] = useState<{
    uploads: number;
    transactions: number;
    ordersRaw: number;
    paymentsRaw: number;
    adsRaw: number;
    skuMasterCount: number;
  } | null>(null);

  // Fetch data preview when dialog opens
  useEffect(() => {
    if (open && accountId) {
      setPreviewLoading(true);
      apiFetch('/api/reconciliation/reset')
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.success && data.counts) {
            setPreviewCounts(data.counts);
          }
        })
        .catch((err) => console.error('Failed to preview reset counts:', err))
        .finally(() => setPreviewLoading(false));
    }
  }, [open, accountId]);

  const handleReset = async () => {
    if (!accountId || isResetting) return;

    setIsResetting(true);
    try {
      const res = await apiFetch('/api/reconciliation/reset', {
        method: 'POST',
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success) {
        toast({
          title: 'Reconciliation Data Cleared',
          description: `Successfully reset reports for ${accountName}. SKU Cost Master (${data.skuMasterPreserved?.totalSkus ?? 'all'} SKUs) preserved intact.`,
        });
        setOpen(false);
        onResetComplete();
      } else {
        throw new Error(data.message || 'Failed to reset reconciliation data.');
      }
    } catch (error: any) {
      console.error('Reset reconciliation error:', error);
      toast({
        variant: 'destructive',
        title: 'Reset Failed',
        description: error.message || 'An error occurred while resetting reconciliation data.',
      });
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(
            'glass-button h-9 px-3.5 rounded-xl border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 hover:text-rose-200 transition-all font-medium text-xs shadow-sm',
            className
          )}
        >
          <Trash2 className="h-3.5 w-3.5 mr-1.5 text-rose-400" />
          <span>Reset Data</span>
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent className="max-w-md border-white/15 bg-slate-950/90 text-white backdrop-blur-2xl shadow-2xl p-6 rounded-2xl">
        <AlertDialogHeader className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <AlertDialogTitle className="text-lg font-bold text-white tracking-tight">
                  Reset Reconciliation Data
                </AlertDialogTitle>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Badge
                    variant="outline"
                    className="border-indigo-400/30 bg-indigo-500/10 text-indigo-300 text-[10px] px-2 py-0 font-semibold"
                  >
                    Account: {accountName}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="border-rose-400/30 bg-rose-500/10 text-rose-300 text-[10px] px-2 py-0 font-semibold"
                  >
                    Irreversible
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          <AlertDialogDescription className="text-xs text-slate-300 leading-relaxed pt-1">
            This will permanently remove previously uploaded Meesho reconciliation reports (Orders,
            Payments, RM Ads), raw staging records, and calculated transactions for{' '}
            <span className="font-semibold text-white">{accountName}</span>.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* Data to be Cleared Preview */}
        <div className="bg-slate-900/70 border border-white/10 rounded-xl p-3.5 space-y-2 text-xs">
          <div className="flex items-center justify-between text-slate-300 font-semibold pb-1 border-b border-white/10">
            <span>Reconciliation Data to Clear</span>
            {previewLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
            ) : (
              <span className="text-[11px] text-slate-400">Scoped to {accountName}</span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2 text-center pt-1">
            <div className="bg-slate-950/60 rounded-lg p-2 border border-white/5">
              <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                Uploads
              </div>
              <div className="text-base font-black text-rose-400 mt-0.5">
                {previewCounts ? previewCounts.uploads : '—'}
              </div>
            </div>
            <div className="bg-slate-950/60 rounded-lg p-2 border border-white/5">
              <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                Transactions
              </div>
              <div className="text-base font-black text-rose-400 mt-0.5">
                {previewCounts ? previewCounts.transactions : '—'}
              </div>
            </div>
            <div className="bg-slate-950/60 rounded-lg p-2 border border-white/5">
              <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                Raw Staging
              </div>
              <div className="text-base font-black text-rose-400 mt-0.5">
                {previewCounts
                  ? previewCounts.ordersRaw + previewCounts.paymentsRaw + previewCounts.adsRaw
                  : '—'}
              </div>
            </div>
          </div>
        </div>

        {/* Critical Safety Boundaries Reassurance */}
        <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-xl p-3.5 space-y-2 text-xs">
          <div className="flex items-center gap-2 text-emerald-300 font-bold">
            <ShieldCheck className="h-4 w-4 text-emerald-400 flex-shrink-0" />
            <span>Strict Data Safety Boundaries</span>
          </div>

          <ul className="space-y-1.5 text-[11px] text-slate-300">
            <li className="flex items-start gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
              <span>
                <strong className="text-white">SKU Cost Master Preserved:</strong> All configured
                SKUs (including{' '}
                <span className="text-amber-300 font-mono text-[10px]">
                  Color-Purple-3in1 @ ₹185 / ₹15
                </span>
                ) remain completely intact.
              </span>
            </li>
            <li className="flex items-start gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
              <span>
                <strong className="text-white">CRM Data Untouched:</strong> Orders, Returns, Tasks,
                Expenses, Inventory, and Marketplace connections are never touched.
              </span>
            </li>
          </ul>
        </div>

        <AlertDialogFooter className="pt-2 gap-2 sm:gap-0">
          <AlertDialogCancel
            disabled={isResetting}
            className="border-white/10 bg-slate-900 text-slate-300 hover:bg-white/10 hover:text-white rounded-xl h-9 text-xs"
          >
            Cancel
          </AlertDialogCancel>
          <Button
            type="button"
            disabled={isResetting}
            onClick={handleReset}
            className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl h-9 text-xs font-bold shadow-lg shadow-rose-600/30"
          >
            {isResetting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                Resetting Data...
              </>
            ) : (
              <>
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                Confirm Reset
              </>
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
