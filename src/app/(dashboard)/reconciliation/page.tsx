'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertCircle,
  FileSpreadsheet,
  RotateCcw,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
import { ImportMeeshoDialog } from './_components/import-meesho-dialog';
import { ImportHistory, UploadRecord } from './_components/import-history';
import { SkuCostMaster } from './_components/sku-cost-master';
import { FinancialDashboard } from './_components/financial-dashboard';
import { ResetReconciliationDialog } from './_components/reset-reconciliation-dialog';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/apiFetch';
import { resolveActiveAccount } from '@/lib/account';
import { formatINRWithDecimals } from '@/lib/format';

export default function ReconciliationPage() {
  const { toast } = useToast();
  const [isMounted, setIsMounted] = useState(false);
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);
  const [activeAccountName, setActiveAccountName] = useState<string>('Rehanza');
  const [uploads, setUploads] = useState<UploadRecord[]>([]);
  const [loadingUploads, setLoadingUploads] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [financialRefreshTrigger, setFinancialRefreshTrigger] = useState(0);
  const [skuMasterRefreshTrigger, setSkuMasterRefreshTrigger] = useState(0);
  const [netProfit, setNetProfit] = useState<number | null>(null);
  const [netProfitLoading, setNetProfitLoading] = useState<boolean>(true);

  // Fetch initial net profit for header
  const fetchHeaderNetProfit = useCallback(async () => {
    if (!activeAccountId) {
      setNetProfit(null);
      setNetProfitLoading(false);
      return;
    }
    setNetProfitLoading(true);
    try {
      const res = await apiFetch('/api/reconciliation/financials');
      if (res.ok) {
        const data = await res.json();
        setNetProfit(data.summary?.finalPayoutNetProfit ?? 0);
      }
    } catch {
      // ignore
    } finally {
      setNetProfitLoading(false);
    }
  }, [activeAccountId]);

  useEffect(() => {
    fetchHeaderNetProfit();
  }, [fetchHeaderNetProfit, financialRefreshTrigger]);

  // Eager account detection & resolution
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

    const handleAccountInit = (e: any) => {
      const freshId = e?.detail?.id || sessionStorage.getItem('active_account');
      const freshName = e?.detail?.name || sessionStorage.getItem('active_account_name') || 'Rehanza';
      if (freshId) {
        setActiveAccountId(freshId);
        setActiveAccountName(freshName);
      }
    };

    window.addEventListener('active-account-changed', handleAccountInit);
    return () => window.removeEventListener('active-account-changed', handleAccountInit);
  }, []);

  // Fetch upload history
  const fetchUploads = useCallback(async () => {
    if (!activeAccountId) return;
    try {
      const res = await apiFetch('/api/reconciliation/uploads?limit=25&offset=0');
      if (res.ok) {
        const data = await res.json();
        setUploads(data.uploads || []);
      }
    } catch (error: any) {
      console.error('Failed to fetch uploads:', error);
    } finally {
      setLoadingUploads(false);
    }
  }, [activeAccountId]);

  useEffect(() => {
    if (activeAccountId) {
      fetchUploads();
    }
  }, [activeAccountId, fetchUploads]);

  const handleUploadComplete = () => {
    fetchUploads();
    setSkuMasterRefreshTrigger((prev) => prev + 1);
    setFinancialRefreshTrigger((prev) => prev + 1);
  };

  const handleCostConfigured = () => {
    setFinancialRefreshTrigger((prev) => prev + 1);
  };

  const handleGlobalRefresh = () => {
    setRefreshing(true);
    Promise.all([
      fetchUploads(),
      new Promise((resolve) => {
        setSkuMasterRefreshTrigger((prev) => prev + 1);
        setFinancialRefreshTrigger((prev) => prev + 1);
        setTimeout(resolve, 600);
      }),
    ]).finally(() => {
      setRefreshing(false);
      toast({
        title: 'Reconciliation Refreshed',
        description: 'Latest ingestion status, SKU costs and financial metrics updated.',
      });
    });
  };

  const handleResetComplete = () => {
    fetchUploads();
    setSkuMasterRefreshTrigger((prev) => prev + 1);
    setFinancialRefreshTrigger((prev) => prev + 1);
  };

  const engineStatus: 'active' | 'processing' | 'error' = (refreshing || (netProfitLoading && netProfit === null))
    ? 'processing'
    : !activeAccountId
    ? 'error'
    : 'active';

  if (!isMounted) return null;

  return (
    <div className="relative min-h-screen space-y-8 p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto font-body">
      {/* 1. Page Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 pb-4 border-b border-white/10">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight font-headline text-white flex items-center gap-2.5">
            <FileSpreadsheet className="h-7 w-7 text-indigo-400" />
            <span>Reconciliation</span>
          </h1>
          {activeAccountId && (
            <Badge
              variant="outline"
              className="glass-pill h-7 px-2.5 rounded-lg border border-indigo-400/30 bg-indigo-500/10 font-bold text-xs text-indigo-300 shadow-sm"
            >
              Account: {activeAccountName}
            </Badge>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 w-full lg:w-auto justify-start lg:justify-end">
          {/* Engine Status Indicator */}
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-900/60 border border-white/10 text-xs font-semibold text-slate-300 shadow-sm">
            <span className="relative flex h-2 w-2">
              <span
                className={cn(
                  'animate-ping absolute inline-flex h-full w-full rounded-full opacity-75',
                  engineStatus === 'error'
                    ? 'bg-rose-400'
                    : engineStatus === 'processing'
                    ? 'bg-amber-400'
                    : 'bg-emerald-400'
                )}
              />
              <span
                className={cn(
                  'relative inline-flex rounded-full h-2 w-2',
                  engineStatus === 'error'
                    ? 'bg-rose-500'
                    : engineStatus === 'processing'
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
                )}
              />
            </span>
            <span className="text-[11px] font-medium tracking-wide">
              {engineStatus === 'error'
                ? 'Engine Inactive'
                : engineStatus === 'processing'
                ? 'Engine Processing'
                : 'Engine Active'}
            </span>
          </div>

          {/* Compact Net Profit Indicator */}
          <div
            className={cn(
              'flex flex-col justify-center px-3.5 py-1 rounded-xl border transition-all shadow-sm min-w-[125px]',
              netProfitLoading && netProfit === null
                ? 'border-white/10 bg-slate-900/40 text-slate-400'
                : netProfit !== null && netProfit > 0
                ? 'border-emerald-500/40 bg-gradient-to-r from-emerald-500/15 via-emerald-500/10 to-transparent shadow-[0_0_15px_rgba(16,185,129,0.12)]'
                : netProfit !== null && netProfit < 0
                ? 'border-rose-500/40 bg-gradient-to-r from-rose-500/15 via-rose-500/10 to-transparent shadow-[0_0_15px_rgba(244,63,94,0.12)]'
                : 'border-white/10 bg-slate-900/60'
            )}
          >
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 leading-tight">
              NET PROFIT
            </span>
            <span
              className={cn(
                'text-sm sm:text-base font-black font-headline tracking-tight leading-none mt-0.5',
                netProfitLoading && netProfit === null
                  ? 'text-slate-500 animate-pulse'
                  : netProfit !== null && netProfit > 0
                  ? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.35)]'
                  : netProfit !== null && netProfit < 0
                  ? 'text-rose-400 drop-shadow-[0_0_8px_rgba(251,113,133,0.35)]'
                  : 'text-slate-200'
              )}
            >
              {netProfitLoading && netProfit === null ? '...' : formatINRWithDecimals(netProfit ?? 0)}
            </span>
          </div>

          {/* Compact Import Meesho Data Icon Button */}
          <ImportMeeshoDialog
            accountId={activeAccountId}
            onUploadComplete={handleUploadComplete}
          />

          {/* Compact Reset Data Icon Button */}
          <ResetReconciliationDialog
            accountId={activeAccountId}
            accountName={activeAccountName}
            onResetComplete={handleResetComplete}
            compact
          />

          {/* Refresh All Button */}
          <Button
            onClick={handleGlobalRefresh}
            disabled={refreshing}
            size="sm"
            variant="outline"
            className="glass-button bg-slate-900/80 border-white/15 text-white h-9 px-3 rounded-xl hover:bg-white/10 flex items-center gap-1.5"
            title="Refresh All"
          >
            <RotateCcw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
            <span className="text-xs font-semibold hidden sm:inline">Refresh All</span>
          </Button>
        </div>
      </div>

      {/* Account Verification Warning if missing */}
      {!activeAccountId && (
        <Card className="glass-panel bg-slate-950/60 p-8 rounded-2xl border border-white/15 text-center shadow-[0_8px_30px_rgba(0,0,0,0.25)]">
          <CardContent className="p-0 flex flex-col items-center justify-center space-y-2">
            <AlertCircle className="h-8 w-8 text-amber-400" />
            <h3 className="font-bold text-base text-white">No Active Account Selected</h3>
            <p className="text-xs text-slate-300 max-w-sm">
              Please select an active account in the top navigation bar to load reconciliation data.
            </p>
          </CardContent>
        </Card>
      )}

      {activeAccountId && (
        <>
          {/* 1. SKU COST MASTER (Persistent unit economics & packaging setup) */}
          <section id="sku-cost-master-section" className="space-y-4 scroll-mt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                  Step 1
                </span>
                <h3 className="text-base sm:text-lg font-black text-white">SKU Cost Master</h3>
              </div>
              <span className="text-xs text-slate-400 font-medium hidden sm:inline">
                Configure unit purchase cost and packaging once to automate profit reconciliation
              </span>
            </div>
            <SkuCostMaster
              accountId={activeAccountId}
              refreshTrigger={skuMasterRefreshTrigger}
              onCostConfigured={handleCostConfigured}
            />
          </section>

          {/* 2. IMPORT HISTORY & ROW ERROR AUDIT */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/20">
                  Step 2
                </span>
                <h3 className="text-base sm:text-lg font-black text-white">Ingestion Audit & Validation Log</h3>
              </div>
              <span className="text-xs text-slate-400 font-medium hidden sm:inline">
                Inspect processed files, successful rows, and row-level error reports
              </span>
            </div>
            <ImportHistory
              uploads={uploads}
              loading={loadingUploads}
              refreshing={refreshing}
              onRefresh={fetchUploads}
            />
          </section>

          {/* 3. FINANCIAL OVERVIEW, PERFORMANCE, SKU & DECISION ENGINE */}
          <section id="settlement-profit" className="space-y-4 pt-2 scroll-mt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                  Step 3
                </span>
                <h3 className="text-base sm:text-lg font-black text-white">Financial & SKU Intelligence</h3>
              </div>
              <span className="text-xs text-slate-400 font-medium hidden sm:inline">
                Workbook-validated metrics, daily trends, SKU unit economics & decision engine
              </span>
            </div>
            <FinancialDashboard
              accountId={activeAccountId}
              refreshTrigger={financialRefreshTrigger}
              onSummaryChange={(s) => {
                if (s) {
                  setNetProfit(s.finalPayoutNetProfit);
                }
              }}
            />
          </section>
        </>
      )}
    </div>
  );
}
