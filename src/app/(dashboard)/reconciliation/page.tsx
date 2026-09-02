'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ShoppingCart,
  Wallet,
  Zap,
  RotateCcw,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Clock,
  FileSpreadsheet,
} from 'lucide-react';
import { UploadSection } from './_components/upload-section';
import { FinancialDashboard } from './_components/financial-dashboard';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/apiFetch';
import { format } from 'date-fns';

interface Upload {
  id: number;
  platform: string;
  source_type: string;
  filename: string;
  status: string;
  row_count: number;
  successful_rows: number;
  failed_rows: number;
  errorCount: number;
  created_at: string;
  updated_at: string;
}

export default function ReconciliationPage() {
  const { toast } = useToast();
  const [isMounted, setIsMounted] = useState(false);
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [loadingUploads, setLoadingUploads] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [financialRefreshTrigger, setFinancialRefreshTrigger] = useState(0);

  // Account detection
  useEffect(() => {
    setIsMounted(true);
    const id = sessionStorage.getItem('active_account');
    if (id) setActiveAccountId(id);

    const handleAccountInit = () => {
      const freshId = sessionStorage.getItem('active_account');
      if (freshId) setActiveAccountId(freshId);
    };

    window.addEventListener('active-account-changed', handleAccountInit);
    return () => window.removeEventListener('active-account-changed', handleAccountInit);
  }, []);

  // Fetch upload history
  const fetchUploads = useCallback(async () => {
    if (!activeAccountId) return;
    try {
      const res = await apiFetch('/api/reconciliation/uploads?limit=20&offset=0');
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
      case 'completed_with_errors':
        return <AlertCircle className="h-4 w-4 text-amber-400" />;
      case 'processing':
        return <Clock className="h-4 w-4 text-blue-400 animate-spin" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-400" />;
      default:
        return <Clock className="h-4 w-4 text-slate-400" />;
    }
  };

  if (!isMounted) return null;

  return (
    <div className="relative min-h-screen space-y-6 md:space-y-8 p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto font-body">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-white/10">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight font-headline text-white">
            Reconciliation Command Center
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 font-medium mt-0.5">
            Meesho financial reconciliation, order profitability & raw data ingestion
          </p>
        </div>
        <Badge
          variant="outline"
          className="glass-pill h-9 px-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 font-bold text-xs uppercase tracking-wider flex items-center gap-2 text-emerald-300 shadow-sm"
        >
          <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          Reconciliation Active
        </Badge>
      </div>

      {/* SECTION 1: FINANCIAL DASHBOARD */}
      {activeAccountId ? (
        <FinancialDashboard
          accountId={activeAccountId}
          refreshTrigger={financialRefreshTrigger}
        />
      ) : (
        <Card className="glass-panel bg-slate-950/60 p-8 rounded-2xl border border-white/15 text-center shadow-[0_8px_30px_rgba(0,0,0,0.25)]">
          <CardContent className="p-0 flex flex-col items-center justify-center space-y-2">
            <AlertCircle className="h-8 w-8 text-amber-400" />
            <h3 className="font-bold text-base text-white">No Account Selected</h3>
            <p className="text-xs text-slate-300 max-w-sm">
              Please select an active account in the top header to view reconciliation financials and uploads.
            </p>
          </CardContent>
        </Card>
      )}

      {/* SECTION 2: DATA INGESTION & PIPELINE */}
      <div className="pt-6 border-t border-white/15 space-y-6">
        <div>
          <h3 className="text-lg sm:text-xl font-black font-headline tracking-tight text-white flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-indigo-400" />
            <span>Data Ingestion & Reconciliation Pipeline</span>
          </h3>
          <p className="text-xs text-slate-300 mt-0.5 font-medium">
            Upload raw exports from Meesho to match transactions and update financial metrics.
          </p>
        </div>

        {/* Upload Sections Grid */}
        {activeAccountId && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            <UploadSection
              title="Upload Orders"
              description="Import order data from Meesho export"
              sourceType="order"
              icon={ShoppingCart}
              onUploadComplete={handleUploadComplete}
              accountId={activeAccountId}
            />
            <UploadSection
              title="Upload Payments"
              description="Import payment and settlement data"
              sourceType="payment"
              icon={Wallet}
              onUploadComplete={handleUploadComplete}
              accountId={activeAccountId}
            />
            <UploadSection
              title="Upload RM Ads"
              description="Import ad cost and performance data"
              sourceType="ads"
              icon={Zap}
              onUploadComplete={handleUploadComplete}
              accountId={activeAccountId}
            />
          </div>
        )}

        {/* Import History */}
        <Card className="glass-panel bg-slate-950/60 border border-white/15 rounded-2xl overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.25)]">
          <CardHeader className="border-b border-white/15 pb-4 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base sm:text-lg font-black text-white">Import History</CardTitle>
              <p className="text-xs text-slate-300 mt-0.5 font-medium">Recent uploads and reconciliation status</p>
            </div>
            <Button
              onClick={() => {
                setRefreshing(true);
                fetchUploads().finally(() => setRefreshing(false));
              }}
              disabled={refreshing}
              size="sm"
              variant="outline"
              className="glass-button bg-slate-900/80 border-white/15 text-white h-9 px-3 rounded-xl"
            >
              <RotateCcw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
            </Button>
          </CardHeader>

          <CardContent className="p-4 sm:p-6">
            {loadingUploads ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="p-4 rounded-xl bg-white/5 border border-white/10">
                    <Skeleton className="h-4 w-full bg-white/10" />
                  </div>
                ))}
              </div>
            ) : uploads.length === 0 ? (
              <div className="text-center py-10">
                <Calendar className="h-10 w-10 mx-auto text-slate-400 mb-2" />
                <p className="text-slate-200 font-bold text-sm">No uploads yet</p>
                <p className="text-xs text-slate-400 mt-0.5">Start by uploading an order, payment, or ads file above</p>
              </div>
            ) : (
              <div className="space-y-3">
                {uploads.map((upload) => (
                  <div
                    key={upload.id}
                    className="p-4 rounded-xl bg-slate-900/50 border border-white/10 hover:border-white/20 transition-all"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          {getStatusIcon(upload.status)}
                          <h4 className="font-bold text-sm truncate text-white">{upload.filename}</h4>
                          <Badge variant="outline" className="text-[10px] font-bold border-white/15 text-slate-300 px-2 py-0.5">
                            {upload.source_type.toUpperCase()}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-3 gap-3 text-xs mt-3">
                          <div>
                            <p className="text-slate-400 font-medium">Total Rows</p>
                            <p className="font-black text-white">{upload.row_count}</p>
                          </div>
                          <div>
                            <p className="text-slate-400 font-medium">Successful</p>
                            <p className="font-black text-emerald-400">{upload.successful_rows || 0}</p>
                          </div>
                          <div>
                            <p className="text-slate-400 font-medium">Failed</p>
                            <p className="font-black text-rose-400">{upload.failed_rows || 0}</p>
                          </div>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-2 font-medium">
                          {format(new Date(upload.created_at), 'dd MMM yyyy HH:mm:ss')}
                        </p>
                      </div>
                      <div className="flex-shrink-0">
                        <div
                          className={cn(
                            'px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider',
                            upload.status === 'completed'
                              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                              : upload.status === 'completed_with_errors'
                              ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                              : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                          )}
                        >
                          {upload.status.replace(/_/g, ' ')}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
