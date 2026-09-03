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
import { UploadSection } from './_components/upload-section';
import { ImportHistory, UploadRecord } from './_components/import-history';
import { FinancialDashboard } from './_components/financial-dashboard';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/apiFetch';
import { resolveActiveAccount } from '@/lib/account';

export default function ReconciliationPage() {
  const { toast } = useToast();
  const [isMounted, setIsMounted] = useState(false);
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);
  const [activeAccountName, setActiveAccountName] = useState<string>('Fashion');
  const [uploads, setUploads] = useState<UploadRecord[]>([]);
  const [loadingUploads, setLoadingUploads] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [financialRefreshTrigger, setFinancialRefreshTrigger] = useState(0);

  // Eager account detection & resolution
  useEffect(() => {
    setIsMounted(true);

    async function initAccount() {
      const acc = await resolveActiveAccount();
      if (acc?.id) {
        setActiveAccountId(acc.id);
        setActiveAccountName(acc.name || 'Fashion');
      }
    }
    initAccount();

    const handleAccountInit = (e: any) => {
      const freshId = e?.detail?.id || sessionStorage.getItem('active_account');
      const freshName = e?.detail?.name || sessionStorage.getItem('active_account_name') || 'Fashion';
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
    // Refresh both the upload history and the financial dashboard
    fetchUploads();
    setFinancialRefreshTrigger((prev) => prev + 1);
  };

  const handleGlobalRefresh = () => {
    setRefreshing(true);
    Promise.all([
      fetchUploads(),
      new Promise((resolve) => {
        setFinancialRefreshTrigger((prev) => prev + 1);
        setTimeout(resolve, 600);
      }),
    ]).finally(() => {
      setRefreshing(false);
      toast({
        title: 'Reconciliation Refreshed',
        description: 'Latest ingestion status and financial metrics updated.',
      });
    });
  };

  if (!isMounted) return null;

  return (
    <div className="relative min-h-screen space-y-8 p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto font-body">
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-3 border-b border-white/10">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight font-headline text-white flex items-center gap-2.5">
              <FileSpreadsheet className="h-7 w-7 text-indigo-400" />
              <span>Reconciliation Command Center</span>
            </h1>
            <Badge
              variant="outline"
              className="glass-pill h-7 px-2.5 rounded-lg border border-indigo-400/30 bg-indigo-500/10 font-bold text-xs text-indigo-300 shadow-sm"
            >
              Account: {activeAccountName}
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-300 font-medium mt-1">
            End-to-end Meesho financial reconciliation, order profitability, SKU unit economics & decision engine
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Badge
            variant="outline"
            className="glass-pill h-9 px-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 font-bold text-xs uppercase tracking-wider flex items-center gap-2 text-emerald-300 shadow-sm"
          >
            <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Reconciliation Engine Active</span>
          </Badge>
          <Button
            onClick={handleGlobalRefresh}
            disabled={refreshing}
            size="sm"
            variant="outline"
            className="glass-button bg-slate-900/80 border-white/15 text-white h-9 px-3.5 rounded-xl hover:bg-white/10"
          >
            <RotateCcw className={cn('h-3.5 w-3.5 mr-1.5', refreshing && 'animate-spin')} />
            Refresh All
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
          {/* 2. IMPORT CENTER (Drag-and-Drop, Auto-Detection & Duplicate Prevention) */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/20">
                  Step 1
                </span>
                <h3 className="text-base sm:text-lg font-black text-white">Data Ingestion Center</h3>
              </div>
              <span className="text-xs text-slate-400 font-medium hidden sm:inline">
                Upload raw Meesho Order, Payment or RM Ads exports
              </span>
            </div>
            <UploadSection
              accountId={activeAccountId}
              onUploadComplete={handleUploadComplete}
            />
          </section>

          {/* 3. IMPORT HISTORY & ROW ERROR AUDIT */}
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

          {/* 4. FINANCIAL OVERVIEW, PERFORMANCE, SKU & DECISION ENGINE */}
          <section className="space-y-4 pt-2">
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
            />
          </section>
        </>
      )}
    </div>
  );
}
