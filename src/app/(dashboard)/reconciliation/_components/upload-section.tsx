'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Upload,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileUp,
  FileSpreadsheet,
  ShoppingCart,
  Wallet,
  Zap,
  RotateCcw,
  Sparkles,
  FileCheck2,
  Package,
  Check,
  Circle,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Papa from 'papaparse';
import { detectCsvFileTypeFromRows } from '@/lib/reconciliation/csv-parser';

interface UploadSectionProps {
  onUploadComplete?: (result: any) => void;
  accountId: string | null;
  embedded?: boolean;
  onCloseDialog?: () => void;
}

interface UploadProgressState {
  stage: string;
  percent: number;
  current?: number;
  total?: number;
  message: string;
}

interface UploadResult {
  success: boolean;
  isDuplicate?: boolean;
  allDuplicates?: boolean;
  uploadId?: number;
  message?: string;
  stats?: {
    totalRows: number;
    successfulRows: number;
    importedRows?: number;
    duplicateRows?: number;
    failedRows: number;
    validationWarnings: number;
    sourceType?: string;
  };
  skuCostStatus?: {
    configuredCount: number;
    pendingCount: number;
    newCount: number;
    requiresCostSetup: boolean;
  } | null;
  errors?: Array<{ rowNumber?: number; field?: string; message: string }>;
  warnings?: Array<{ message: string }>;
}

const PIPELINE_STAGES = [
  { key: 'Reading file', label: 'Reading file' },
  { key: 'Validating rows', label: 'Validating rows' },
  { key: 'Checking duplicates', label: 'Checking duplicates' },
  { key: 'Importing records', label: 'Importing records' },
  { key: 'Building reconciliation transactions', label: 'Building transactions' },
  { key: 'Finalizing', label: 'Finalizing' },
];

export function UploadSection({
  onUploadComplete,
  accountId,
  embedded = false,
  onCloseDialog,
}: UploadSectionProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [detectedType, setDetectedType] = useState<'order' | 'payment' | 'ads' | 'unknown'>('unknown');
  const [selectedSourceType, setSelectedSourceType] = useState<'order' | 'payment' | 'ads'>('payment');
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<UploadProgressState | null>(null);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast({
        variant: 'destructive',
        title: 'Invalid file type',
        description: 'Please select a valid Meesho .csv export file.',
      });
      return;
    }

    setSelectedFile(file);
    setUploadResult(null);
    setProgress(null);

    // Read first chunk to detect file type across candidate rows
    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        if (text) {
          const cleanText = text.replace(/^\uFEFF/, '');
          const parseResult = Papa.parse<string[]>(cleanText, { preview: 10, skipEmptyLines: true });
          const candidateRows = (parseResult.data || []).map((row: any[]) =>
            row.map((cell: any) =>
              cell !== undefined && cell !== null ? String(cell).replace(/^["']|["']$/g, '').trim() : ''
            )
          );
          const detected = detectCsvFileTypeFromRows(candidateRows);
          setDetectedType(detected);
          if (detected !== 'unknown') {
            setSelectedSourceType(detected);
          }
        }
      };
      reader.readAsText(file.slice(0, 8192)); // read first 8KB
    } catch (err) {
      console.error('Error auto-detecting file type:', err);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !accountId) {
      toast({
        variant: 'destructive',
        title: 'Missing information',
        description: 'Please select a CSV file and ensure account context is active.',
      });
      return;
    }

    setIsLoading(true);
    setProgress({
      stage: 'Reading file',
      percent: 5,
      message: 'Connecting and reading CSV file...',
    });

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('sourceType', selectedSourceType);

      const response = await fetch('/api/reconciliation/upload?stream=true', {
        method: 'POST',
        headers: {
          'x-account-id': accountId,
        },
        body: formData,
      });

      let finalResult: UploadResult | null = null;

      if (!response.body) {
        // Fallback for non-streaming response
        const result = await response.json();
        finalResult = result;
      } else {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try {
              const event = JSON.parse(trimmed);
              if (event.type === 'progress') {
                setProgress({
                  stage: event.stage,
                  percent: event.percent ?? 50,
                  current: event.current,
                  total: event.total,
                  message: event.message || '',
                });
              } else if (event.type === 'complete') {
                finalResult = event;
              } else if (event.type === 'error') {
                finalResult = event;
              }
            } catch (parseErr) {
              console.warn('NDJSON line parse error:', parseErr);
            }
          }
        }

        // Check if there is trailing JSON in buffer
        if (buffer.trim()) {
          try {
            const event = JSON.parse(buffer.trim());
            if (event.type === 'complete' || event.type === 'error') {
              finalResult = event;
            }
          } catch (e) {
            // Ignore trailing partial chunk
          }
        }
      }

      if (finalResult) {
        setUploadResult(finalResult);
        onUploadComplete?.(finalResult);

        if (finalResult.allDuplicates) {
          toast({
            title: 'Upload Completed',
            description: 'All records were already present. 0 duplicate records created.',
          });
        } else if (finalResult.success) {
          const imported = finalResult.stats?.importedRows ?? finalResult.stats?.successfulRows ?? 0;
          const duplicates = finalResult.stats?.duplicateRows ?? 0;
          const failed = finalResult.stats?.failedRows ?? 0;

          if (failed === 0) {
            toast({
              title: 'Upload Completed',
              description: `${imported} imported, ${duplicates} duplicates skipped.`,
            });
          } else {
            toast({
              variant: 'destructive',
              title: 'Upload Completed with Warnings',
              description: `${imported} imported, ${duplicates} duplicates skipped, ${failed} failed.`,
            });
          }
        } else {
          toast({
            variant: 'destructive',
            title: 'Upload Failed',
            description: finalResult.message || 'Validation failed for this CSV file.',
          });
        }
      } else {
        throw new Error('No completion response received from upload stream.');
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Network error during upload.',
      });
      setUploadResult({
        success: false,
        message: error.message || 'Upload failed due to network or connection error.',
      });
    } finally {
      setIsLoading(false);
      setProgress(null);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setDetectedType('unknown');
    setUploadResult(null);
    setProgress(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const getCurrentStageIndex = (currentStage: string) => {
    return PIPELINE_STAGES.findIndex(
      (s) => s.key === currentStage || currentStage.toLowerCase().includes(s.label.toLowerCase())
    );
  };

  const STORAGE_KEY = 'rehanza_reconciliation_import_center_expanded';
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved !== null) {
        setIsExpanded(saved === 'true');
      }
    } catch {
      // ignore
    }
  }, []);

  const toggleExpanded = () => {
    setIsExpanded((prev) => {
      const next = !prev;
      try {
        sessionStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const renderContent = () => (
    <div className="space-y-5">
      {/* State 1: Upload Result Card (Success, All Duplicates Skipped, or Error) */}
      {uploadResult && (
        <div className="space-y-4">
          {uploadResult.success ? (
            <div
              className={cn(
                  'p-4 sm:p-5 rounded-2xl border flex flex-col gap-3.5 transition-all',
                  uploadResult.allDuplicates
                    ? 'border-indigo-500/30 bg-indigo-500/10'
                    : uploadResult.stats?.failedRows === 0
                    ? 'border-emerald-500/30 bg-emerald-500/10'
                    : 'border-amber-500/30 bg-amber-500/10'
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <CheckCircle2
                      className={cn(
                        'h-5 w-5 flex-shrink-0 mt-0.5',
                        uploadResult.allDuplicates ? 'text-indigo-400' : 'text-emerald-400'
                      )}
                    />
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-sm sm:text-base text-white">
                          {uploadResult.allDuplicates
                            ? 'Upload completed — All records already present'
                            : 'Upload completed'}
                        </h4>
                        {uploadResult.allDuplicates ? (
                          <Badge
                            variant="outline"
                            className="bg-indigo-500/20 text-indigo-300 border-indigo-400/40 text-[10px] font-bold uppercase tracking-wider"
                          >
                            All Duplicates Skipped
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="bg-emerald-500/20 text-emerald-300 border-emerald-400/40 text-[10px] font-bold uppercase tracking-wider"
                          >
                            Completed
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        {uploadResult.message || 'File processed successfully into reconciliation engine.'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Metric Summary Grid */}
                {uploadResult.stats && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                    <div className="p-3 rounded-xl bg-slate-900/70 border border-white/10 text-center">
                      <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Total Rows</p>
                      <p className="font-black text-lg text-white mt-0.5">{uploadResult.stats.totalRows}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-900/70 border border-white/10 text-center">
                      <p className="text-[11px] text-emerald-400/90 font-semibold uppercase tracking-wider">Imported</p>
                      <p className="font-black text-lg text-emerald-400 mt-0.5">
                        {uploadResult.stats.importedRows ?? uploadResult.stats.successfulRows ?? 0}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-900/70 border border-white/10 text-center">
                      <p className="text-[11px] text-indigo-300 font-semibold uppercase tracking-wider">Duplicates Skipped</p>
                      <p className="font-black text-lg text-indigo-300 mt-0.5">
                        {uploadResult.stats.duplicateRows ?? (uploadResult.allDuplicates ? uploadResult.stats.totalRows : 0)}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-900/70 border border-white/10 text-center">
                      <p className="text-[11px] text-rose-400 font-semibold uppercase tracking-wider">Failed</p>
                      <p className="font-black text-lg text-rose-400 mt-0.5">{uploadResult.stats.failedRows ?? 0}</p>
                    </div>
                  </div>
                )}

                {/* SKU Cost Configuration Status (for order imports) */}
                {uploadResult.skuCostStatus && (
                  <div className="mt-2 p-3 rounded-xl bg-slate-900/90 border border-white/15 space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div className="space-y-0.5 text-left">
                        <p className="text-xs font-bold text-white flex items-center gap-1.5">
                          <Package className="h-3.5 w-3.5 text-indigo-400" />
                          <span>SKU Cost Configuration Status</span>
                        </p>
                        <p className="text-[11px] text-slate-300">
                          <span className="text-emerald-400 font-bold">
                            {uploadResult.skuCostStatus.configuredCount} configured
                          </span>
                          {uploadResult.skuCostStatus.newCount > 0 && (
                            <span>
                              {' '}• <span className="text-indigo-300 font-bold">{uploadResult.skuCostStatus.newCount} new SKUs</span>
                            </span>
                          )}
                          {uploadResult.skuCostStatus.pendingCount > 0 ? (
                            <span>
                              {' '}• <span className="text-amber-400 font-bold">{uploadResult.skuCostStatus.pendingCount} require cost setup</span>
                            </span>
                          ) : (
                            <span> • <span className="text-emerald-300 font-semibold">All SKUs have cost configuration.</span></span>
                          )}
                        </p>
                      </div>
                      {uploadResult.skuCostStatus.pendingCount > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            onCloseDialog?.();
                            const el = document.getElementById('sku-cost-master-section');
                            el?.scrollIntoView({ behavior: 'smooth' });
                          }}
                          className="glass-button bg-amber-500/20 hover:bg-amber-500/30 border-amber-500/40 text-amber-200 text-xs h-7 px-3 rounded-lg flex-shrink-0"
                        >
                          Review SKU Costs →
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 flex items-start gap-3.5">
                <AlertCircle className="h-5 w-5 text-rose-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-1.5 text-left flex-1">
                  <h4 className="font-bold text-sm text-white">Import Failed</h4>
                  <p className="text-xs text-rose-200/90 leading-relaxed font-semibold">
                    {uploadResult.message || 'Validation or parsing failed for this file.'}
                  </p>
                  {uploadResult.errors && uploadResult.errors.length > 0 && (
                    <div className="mt-2 text-[11px] text-rose-300/85 space-y-1 max-h-36 overflow-y-auto bg-slate-950/40 p-2.5 rounded-lg border border-rose-500/20">
                      {uploadResult.errors.slice(0, 5).map((err, i) => (
                        <div key={i} className="leading-tight">
                          <span className="font-bold text-rose-400">
                            {err.rowNumber ? `Row ${err.rowNumber}: ` : ''}
                          </span>
                          {err.message}
                        </div>
                      ))}
                      {uploadResult.errors.length > 5 && (
                        <div className="text-[10px] text-rose-400/70 font-semibold pt-1">
                          +{uploadResult.errors.length - 5} more issues in this file
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            <Button
              onClick={handleReset}
              variant="outline"
              size="sm"
              className="glass-button bg-slate-900 border-white/15 text-white h-9 px-4 rounded-xl w-full"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-2" />
              Upload Another Reconciliation File
            </Button>
          </div>
        )}

        {/* State 2: Live Progress Bar & Processing Stepper */}
        {isLoading && (
          <div className="p-5 sm:p-6 rounded-2xl border border-indigo-500/30 bg-indigo-950/20 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Loader2 className="h-5 w-5 text-indigo-400 animate-spin" />
                <span className="font-bold text-sm sm:text-base text-white">
                  {progress?.stage || 'Processing CSV File...'}
                </span>
              </div>
              <span className="font-black text-sm text-indigo-300 tabular-nums">
                {progress?.percent ?? 10}%
              </span>
            </div>

            {/* Smooth animated progress bar */}
            <div className="w-full bg-slate-800/80 rounded-full h-2.5 overflow-hidden border border-white/10 p-0.5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-blue-500 to-emerald-400 transition-all duration-300 ease-out"
                style={{ width: `${Math.max(5, Math.min(100, progress?.percent ?? 10))}%` }}
              />
            </div>

            {/* Stage description & row count */}
            <div className="flex items-center justify-between text-xs text-slate-300">
              <p className="font-medium truncate pr-2">
                {progress?.message || 'Processing records in batches...'}
              </p>
              {progress?.current !== undefined && progress?.total !== undefined && (
                <span className="text-slate-400 flex-shrink-0 font-mono text-[11px]">
                  {progress.current} / {progress.total} rows
                </span>
              )}
            </div>

            {/* 6-Stage Stepper Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-white/10">
              {PIPELINE_STAGES.map((step, idx) => {
                const currentIdx = progress ? getCurrentStageIndex(progress.stage) : 0;
                const isComplete = currentIdx > idx || (progress?.percent ?? 0) >= 100;
                const isActive = currentIdx === idx && (progress?.percent ?? 0) < 100;

                return (
                  <div
                    key={step.key}
                    className={cn(
                      'flex items-center gap-2 p-2 rounded-lg text-xs font-medium transition-all',
                      isComplete
                        ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300'
                        : isActive
                        ? 'bg-indigo-500/20 border border-indigo-400/30 text-white font-bold'
                        : 'bg-slate-900/30 border border-white/5 text-slate-500'
                    )}
                  >
                    {isComplete ? (
                      <Check className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
                    ) : isActive ? (
                      <Loader2 className="h-3.5 w-3.5 text-indigo-400 animate-spin flex-shrink-0" />
                    ) : (
                      <Circle className="h-3 w-3 text-slate-600 flex-shrink-0" />
                    )}
                    <span className="truncate">{step.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* State 3: File Selector & Auto-Detection View (When not loading and no result) */}
        {!uploadResult && !isLoading && (
          <div className="space-y-4">
            <div
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center cursor-pointer transition-all duration-200',
                'border-white/15 hover:border-indigo-400/50 hover:bg-indigo-500/5',
                selectedFile ? 'border-indigo-500/60 bg-indigo-500/10' : 'bg-slate-900/30'
              )}
            >
              <FileUp className="h-9 w-9 mx-auto mb-2 text-indigo-400/80" />
              <p className="font-bold text-sm text-white">
                {selectedFile ? selectedFile.name : 'Click to select or drag & drop Meesho CSV export'}
              </p>
              <p className="text-xs text-slate-400 mt-1 font-medium">
                {selectedFile
                  ? `${formatFileSize(selectedFile.size)} • Click to choose a different file`
                  : 'Orders, Payments Settlement, or RM Ads CSV files are automatically identified'}
              </p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
            />

            {/* Selected File Details & Auto-Type Recognition */}
            {selectedFile && (
              <div className="p-4 rounded-xl bg-slate-900/60 border border-white/10 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <FileCheck2 className="h-4 w-4 text-emerald-400" />
                    <span className="text-xs font-bold text-white truncate max-w-xs">{selectedFile.name}</span>
                    <span className="text-xs text-slate-400">({formatFileSize(selectedFile.size)})</span>
                  </div>
                  {detectedType !== 'unknown' && (
                    <Badge
                      variant="outline"
                      className="text-[11px] font-bold border-indigo-400/30 bg-indigo-500/10 text-indigo-300 px-2.5 py-0.5 rounded-lg flex items-center gap-1.5 w-fit"
                    >
                      <Sparkles className="h-3 w-3 text-indigo-400" />
                      Auto-detected: {detectedType.toUpperCase()}
                    </Badge>
                  )}
                </div>

                {/* Source Type Selector */}
                <div className="pt-2 border-t border-white/10">
                  <label className="text-[11px] font-bold text-slate-300 block mb-2">
                    Target File Type (Auto-selected, modify if needed):
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedSourceType('order')}
                      className={cn(
                        'flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition-all',
                        selectedSourceType === 'order'
                          ? 'border-indigo-400 bg-indigo-500/20 text-white shadow-sm'
                          : 'border-white/10 bg-slate-900/40 text-slate-400 hover:text-white'
                      )}
                    >
                      <ShoppingCart className="h-3.5 w-3.5" />
                      <span>Orders</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedSourceType('payment')}
                      className={cn(
                        'flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition-all',
                        selectedSourceType === 'payment'
                          ? 'border-indigo-400 bg-indigo-500/20 text-white shadow-sm'
                          : 'border-white/10 bg-slate-900/40 text-slate-400 hover:text-white'
                      )}
                    >
                      <Wallet className="h-3.5 w-3.5" />
                      <span>Payments</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedSourceType('ads')}
                      className={cn(
                        'flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition-all',
                        selectedSourceType === 'ads'
                          ? 'border-indigo-400 bg-indigo-500/20 text-white shadow-sm'
                          : 'border-white/10 bg-slate-900/40 text-slate-400 hover:text-white'
                      )}
                    >
                      <Zap className="h-3.5 w-3.5" />
                      <span>RM Ads</span>
                    </button>
                  </div>
                </div>

                {/* Submit Button */}
                <Button
                  onClick={handleUpload}
                  disabled={isLoading}
                  className="w-full h-10 rounded-xl font-bold text-xs uppercase tracking-wider bg-indigo-600 hover:bg-indigo-500 text-white shadow-md transition-all mt-2"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Import & Reconcile {selectedSourceType.toUpperCase()} CSV
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    );

  if (embedded) {
    return renderContent();
  }

  return (
    <Card className="glass-panel bg-slate-950/60 border border-white/15 rounded-2xl overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.25)] transition-all">
      <CardHeader
        className={cn(
          'pb-4 transition-colors cursor-pointer select-none',
          isExpanded ? 'border-b border-white/15' : ''
        )}
        onClick={toggleExpanded}
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-indigo-500/15 border border-indigo-400/25 flex items-center justify-center text-indigo-400">
              <FileSpreadsheet className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base sm:text-lg font-black text-white">
                Meesho Reconciliation Import Center
              </CardTitle>
              <p className="text-xs text-slate-300 mt-0.5 font-medium">
                Automatic file-type recognition, row-level deduplication, and fast bulk ingestion
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-400">Supported:</span>
            <Badge variant="outline" className="text-[10px] font-bold border-white/15 text-slate-300">
              Orders
            </Badge>
            <Badge variant="outline" className="text-[10px] font-bold border-white/15 text-slate-300">
              Payments
            </Badge>
            <Badge variant="outline" className="text-[10px] font-bold border-white/15 text-slate-300">
              RM Ads
            </Badge>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                toggleExpanded();
              }}
              className="glass-button bg-slate-900/80 border border-white/15 text-slate-300 hover:text-white hover:bg-white/10 h-8 px-2.5 rounded-xl flex items-center gap-1.5 transition-colors ml-1"
              aria-label={isExpanded ? 'Collapse Import Center' : 'Expand Import Center'}
            >
              <span className="text-[11px] text-slate-400 hidden sm:inline font-semibold">
                {isExpanded ? 'Collapse' : 'Expand'}
              </span>
              <ChevronDown
                className={cn(
                  'h-3.5 w-3.5 transition-transform duration-200 text-slate-300',
                  isExpanded && 'rotate-180'
                )}
              />
            </Button>
          </div>
        </div>
      </CardHeader>

      <div
        className={cn(
          'grid transition-[grid-template-rows,opacity] duration-300 ease-in-out',
          isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0 pointer-events-none'
        )}
      >
        <div className="overflow-hidden">
          <CardContent className="p-4 sm:p-6">
            {renderContent()}
          </CardContent>
        </div>
      </div>
    </Card>
  );
}
