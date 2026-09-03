'use client';

import React, { useRef, useState } from 'react';
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
  AlertTriangle,
  FileCheck2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Papa from 'papaparse';
import { detectCsvFileType, detectCsvFileTypeFromRows } from '@/lib/reconciliation/csv-parser';

interface UploadSectionProps {
  onUploadComplete?: (result: any) => void;
  accountId: string | null;
}

interface UploadResult {
  success: boolean;
  isDuplicate?: boolean;
  uploadId?: number;
  message?: string;
  stats?: {
    totalRows: number;
    successfulRows: number;
    failedRows: number;
    validationWarnings: number;
    sourceType?: string;
  };
  errors?: Array<{ rowNumber?: number; field?: string; message: string }>;
  warnings?: Array<{ message: string }>;
}

export function UploadSection({ onUploadComplete, accountId }: UploadSectionProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [detectedType, setDetectedType] = useState<'order' | 'payment' | 'ads' | 'unknown'>('unknown');
  const [selectedSourceType, setSelectedSourceType] = useState<'order' | 'payment' | 'ads'>('payment');
  const [isLoading, setIsLoading] = useState(false);
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
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('sourceType', selectedSourceType);

      const response = await fetch('/api/reconciliation/upload', {
        method: 'POST',
        headers: {
          'x-account-id': accountId,
        },
        body: formData,
      });

      const result = await response.json();

      if (response.status === 409 || result.isDuplicate) {
        setUploadResult({
          success: false,
          isDuplicate: true,
          message: result.message || 'Duplicate file detected — this file has already been imported.',
        });
        toast({
          variant: 'destructive',
          title: 'Duplicate File Detected',
          description: result.message || 'This file has already been imported. Skipping duplicate ingestion.',
        });
      } else if (result.success) {
        setUploadResult(result);
        onUploadComplete?.(result);

        if (result.stats?.failedRows === 0) {
          toast({
            title: 'Import Successful',
            description: `${result.stats.successfulRows} rows imported into reconciliation engine.`,
          });
        } else {
          toast({
            variant: 'destructive',
            title: 'Import Completed with Warnings',
            description: `${result.stats.successfulRows} rows imported, ${result.stats.failedRows} rows flagged with errors.`,
          });
        }
      } else {
        setUploadResult(result);
        toast({
          variant: 'destructive',
          title: 'Upload Failed',
          description: result.message || 'Validation failed for this CSV file.',
        });
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Network error during upload.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setDetectedType('unknown');
    setUploadResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <Card className="glass-panel bg-slate-950/60 border border-white/15 rounded-2xl overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.25)]">
      <CardHeader className="border-b border-white/15 pb-4">
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
                Automatic file-type recognition, duplicate SHA-256 prevention, and row-level ingestion
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
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-6 space-y-5">
        {/* State 1: Upload Result Card (Success or Duplicate) */}
        {uploadResult && (
          <div className="space-y-4">
            {uploadResult.isDuplicate ? (
              <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 flex items-start gap-3.5">
                <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-1 text-left flex-1">
                  <h4 className="font-bold text-sm text-white">Duplicate File Detected</h4>
                  <p className="text-xs text-amber-200/90 leading-relaxed">
                    {uploadResult.message || 'This CSV file has already been imported into the system. Ingestion was safely aborted to avoid creating duplicate transactions.'}
                  </p>
                </div>
              </div>
            ) : uploadResult.success ? (
              <div className={cn(
                'p-4 rounded-xl border flex flex-col gap-3',
                uploadResult.stats?.failedRows === 0
                  ? 'border-emerald-500/30 bg-emerald-500/10'
                  : 'border-amber-500/30 bg-amber-500/10'
              )}>
                <div className="flex items-start gap-3">
                  {uploadResult.stats?.failedRows === 0 ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-1 flex-1">
                    <h4 className="font-bold text-sm text-white">
                      {uploadResult.stats?.failedRows === 0
                        ? 'Reconciliation Import Successful'
                        : 'Import Completed with Row Warnings'}
                    </h4>
                    <p className="text-xs text-slate-300">
                      Import ID #{uploadResult.uploadId} processed into reconciliation engine.
                    </p>
                  </div>
                </div>

                {uploadResult.stats && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                    <div className="p-2.5 rounded-lg bg-slate-900/60 border border-white/10 text-center">
                      <p className="text-[11px] text-slate-400 font-medium">Total Rows</p>
                      <p className="font-black text-base text-white">{uploadResult.stats.totalRows}</p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-900/60 border border-white/10 text-center">
                      <p className="text-[11px] text-slate-400 font-medium">Successful</p>
                      <p className="font-black text-base text-emerald-400">{uploadResult.stats.successfulRows}</p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-900/60 border border-white/10 text-center">
                      <p className="text-[11px] text-slate-400 font-medium">Failed</p>
                      <p className="font-black text-base text-rose-400">{uploadResult.stats.failedRows}</p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-900/60 border border-white/10 text-center">
                      <p className="text-[11px] text-slate-400 font-medium">Warnings</p>
                      <p className="font-black text-base text-amber-400">{uploadResult.stats.validationWarnings}</p>
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

        {/* State 2: File Selector & Auto-Detection View */}
        {!uploadResult && (
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
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Validating & Ingesting {selectedSourceType.toUpperCase()}...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Import & Reconcile {selectedSourceType.toUpperCase()} CSV
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
