'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  RotateCcw,
  Calendar,
  AlertTriangle,
  History,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/apiFetch';
import { format } from 'date-fns';

export interface UploadRecord {
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

interface ImportHistoryProps {
  uploads: UploadRecord[];
  loading: boolean;
  refreshing: boolean;
  onRefresh: () => void;
}

interface ValidationErrorItem {
  rowNumber: number;
  field?: string;
  message: string;
  timestamp?: string;
}

export function ImportHistory({
  uploads,
  loading,
  refreshing,
  onRefresh,
}: ImportHistoryProps) {
  const [selectedUpload, setSelectedUpload] = useState<UploadRecord | null>(null);
  const [errorDetails, setErrorDetails] = useState<ValidationErrorItem[]>([]);
  const [loadingErrors, setLoadingErrors] = useState(false);
  const [errorModalOpen, setErrorModalOpen] = useState(false);

  const handleViewErrors = async (upload: UploadRecord) => {
    setSelectedUpload(upload);
    setErrorModalOpen(true);
    setLoadingErrors(true);
    try {
      const res = await apiFetch(`/api/reconciliation/errors?uploadId=${upload.id}`);
      if (res.ok) {
        const json = await res.json();
        setErrorDetails(json.errors || []);
      } else {
        setErrorDetails([]);
      }
    } catch (err) {
      console.error('Failed to fetch upload error details:', err);
      setErrorDetails([]);
    } finally {
      setLoadingErrors(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            <CheckCircle2 className="h-3 w-3" />
            Completed
          </span>
        );
      case 'completed_with_errors':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
            <AlertTriangle className="h-3 w-3" />
            Completed with Warnings
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/15 text-blue-300 border border-blue-500/30">
            <Clock className="h-3 w-3 animate-spin" />
            Processing
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30">
            <AlertCircle className="h-3 w-3" />
            Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-500/15 text-slate-300 border border-slate-500/30">
            {status}
          </span>
        );
    }
  };

  const formatSourceType = (type: string) => {
    switch (type.toLowerCase()) {
      case 'order':
        return 'Orders Export';
      case 'payment':
        return 'Payments Settlement';
      case 'ads':
        return 'RM Ads Spend';
      default:
        return type.toUpperCase();
    }
  };

  return (
    <>
      <Card className="glass-panel bg-slate-950/60 border border-white/15 rounded-2xl overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.25)]">
        <CardHeader className="border-b border-white/15 pb-4 flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-indigo-500/15 border border-indigo-400/25 flex items-center justify-center text-indigo-400">
              <History className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base sm:text-lg font-black text-white">Import History & Audit Log</CardTitle>
              <p className="text-xs text-slate-300 mt-0.5 font-medium">
                Verified logs of uploaded Meesho reconciliation files and row-level ingestion metrics
              </p>
            </div>
          </div>
          <Button
            onClick={onRefresh}
            disabled={refreshing}
            size="sm"
            variant="outline"
            className="glass-button bg-slate-900/80 border-white/15 text-white h-9 px-3 rounded-xl hover:bg-white/10"
          >
            <RotateCcw className={cn('h-3.5 w-3.5 mr-1.5', refreshing && 'animate-spin')} />
            Refresh
          </Button>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-14 w-full bg-white/10 rounded-xl" />
              ))}
            </div>
          ) : uploads.length === 0 ? (
            <div className="text-center py-12 px-4">
              <Calendar className="h-10 w-10 mx-auto text-slate-400 mb-2 opacity-60" />
              <p className="text-slate-200 font-bold text-sm">No imports recorded yet</p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Use the Import Center above to upload Meesho Orders, Payments, or RM Ads CSV files.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-white/10 hover:bg-transparent">
                    <TableHead className="text-xs font-black uppercase text-slate-300">File & Source</TableHead>
                    <TableHead className="text-xs font-black uppercase text-slate-300">Upload Date</TableHead>
                    <TableHead className="text-xs font-black uppercase text-slate-300">Status</TableHead>
                    <TableHead className="text-xs font-black uppercase text-slate-300 text-right">Total Rows</TableHead>
                    <TableHead className="text-xs font-black uppercase text-slate-300 text-right">Successful</TableHead>
                    <TableHead className="text-xs font-black uppercase text-slate-300 text-right">Failed</TableHead>
                    <TableHead className="text-xs font-black uppercase text-slate-300 text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {uploads.map((upload) => (
                    <TableRow
                      key={upload.id}
                      className="border-b border-white/5 hover:bg-white/[0.03] transition-colors"
                    >
                      <TableCell className="py-3.5">
                        <div className="flex flex-col">
                          <span className="font-bold text-sm text-white truncate max-w-xs sm:max-w-md">
                            {upload.filename}
                          </span>
                          <span className="text-[11px] font-medium text-indigo-300">
                            {formatSourceType(upload.source_type)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="py-3.5 text-xs text-slate-300 whitespace-nowrap">
                        {format(new Date(upload.created_at), 'dd MMM yyyy, HH:mm:ss')}
                      </TableCell>
                      <TableCell className="py-3.5 whitespace-nowrap">
                        {getStatusBadge(upload.status)}
                      </TableCell>
                      <TableCell className="py-3.5 text-xs font-black text-white text-right">
                        {upload.row_count.toLocaleString()}
                      </TableCell>
                      <TableCell className="py-3.5 text-xs font-black text-emerald-400 text-right">
                        {(upload.successful_rows || 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="py-3.5 text-xs font-black text-rose-400 text-right">
                        {(upload.failed_rows || 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="py-3.5 text-center whitespace-nowrap">
                        {upload.failed_rows > 0 || upload.status === 'completed_with_errors' ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewErrors(upload)}
                            className="glass-button bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20 text-xs font-bold h-7 px-2.5 rounded-lg"
                          >
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            View Errors
                          </Button>
                        ) : (
                          <span className="text-[11px] font-medium text-slate-500">None</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Row-level Validation Errors Modal */}
      <Dialog open={errorModalOpen} onOpenChange={setErrorModalOpen}>
        <DialogContent className="glass-panel bg-slate-950/95 border-white/20 text-white max-w-3xl max-h-[85vh] flex flex-col rounded-2xl shadow-2xl">
          <DialogHeader className="border-b border-white/10 pb-3">
            <DialogTitle className="text-lg font-black text-white flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-400" />
              <span>Validation Errors: {selectedUpload?.filename}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-300">
              Row-by-row validation error report for import run #{selectedUpload?.id} ({selectedUpload?.failed_rows} failed rows)
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-2">
            {loadingErrors ? (
              <div className="space-y-2 p-4">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-10 w-full bg-white/10 rounded-lg" />
                ))}
              </div>
            ) : errorDetails.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-400">
                <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto mb-2 opacity-80" />
                <p className="font-bold text-white text-sm">No recorded row-level errors</p>
                <p className="mt-0.5">All rows either passed validation or failed at the file header stage.</p>
              </div>
            ) : (
              <div className="border border-white/10 rounded-xl overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-white/10 bg-white/5">
                      <TableHead className="text-xs font-bold text-slate-300 w-24">Row #</TableHead>
                      <TableHead className="text-xs font-bold text-slate-300 w-44">Field</TableHead>
                      <TableHead className="text-xs font-bold text-slate-300">Error Description</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {errorDetails.map((err, idx) => (
                      <TableRow key={idx} className="border-b border-white/5 hover:bg-white/[0.02]">
                        <TableCell className="text-xs font-black text-amber-400">
                          Row {err.rowNumber || 'N/A'}
                        </TableCell>
                        <TableCell className="text-xs font-semibold text-slate-300">
                          {err.field || 'General'}
                        </TableCell>
                        <TableCell className="text-xs text-rose-300">
                          {err.message}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          <div className="border-t border-white/10 pt-3 flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setErrorModalOpen(false)}
              className="glass-button bg-slate-900 border-white/15 text-white rounded-xl text-xs"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
