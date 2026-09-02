'use client';

import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import {
  Upload,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileUp,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface UploadSectionProps {
  title: string;
  description: string;
  sourceType: 'order' | 'payment' | 'ads';
  icon: React.ElementType;
  onUploadComplete?: (result: any) => void;
  accountId: string | null;
}

interface UploadResult {
  success: boolean;
  uploadId: number;
  stats: {
    totalRows: number;
    successfulRows: number;
    failedRows: number;
    validationWarnings: number;
  };
  errors: Array<{ rowNumber?: number; field?: string; message: string }>;
}

export function UploadSection({
  title,
  description,
  sourceType,
  icon: Icon,
  onUploadComplete,
  accountId
}: UploadSectionProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.name.toLowerCase().endsWith('.csv')) {
        toast({
          variant: 'destructive',
          title: 'Invalid file type',
          description: 'Please select a CSV file'
        });
        return;
      }
      setSelectedFile(file);
      setUploadResult(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !accountId) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please select a file and ensure account is loaded'
      });
      return;
    }

    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('sourceType', sourceType);

      const response = await fetch('/api/reconciliation/upload', {
        method: 'POST',
        headers: {
          'x-account-id': accountId
        },
        body: formData
      });

      const result = await response.json();

      if (result.success || result.isDuplicate) {
        if (result.isDuplicate) {
          toast({
            variant: 'destructive',
            title: 'Duplicate Upload',
            description: result.message
          });
        } else {
          setUploadResult(result);
          onUploadComplete?.(result);

          if (result.stats.failedRows === 0) {
            toast({
              title: 'Upload successful',
              description: `${result.stats.successfulRows} rows imported successfully`
            });
          } else {
            toast({
              variant: 'destructive',
              title: 'Upload completed with errors',
              description: `${result.stats.successfulRows} rows imported, ${result.stats.failedRows} failed`
            });
          }
        }
      } else {
        toast({
          variant: 'destructive',
          title: 'Upload failed',
          description: result.message || 'Unknown error during upload'
        });
        if (result.errors && result.errors.length > 0) {
          console.error('Validation errors:', result.errors);
        }
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to upload file'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setUploadResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Card className="glass-panel border border-white/10 rounded-2xl overflow-hidden">
      <CardHeader className="border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-white/5">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-lg font-black">{title}</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-4">
        {uploadResult && !selectedFile ? (
          <div className="space-y-4">
            <div className={cn(
              'p-4 rounded-xl border-2',
              uploadResult.stats.failedRows === 0
                ? 'border-emerald-500/20 bg-emerald-500/5'
                : 'border-amber-500/20 bg-amber-500/5'
            )}>
              <div className="flex items-start gap-3">
                {uploadResult.stats.failedRows === 0 ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                )}
                <div className="space-y-3 flex-1">
                  <h4 className="font-bold text-sm">
                    {uploadResult.stats.failedRows === 0
                      ? 'Import Successful'
                      : 'Import Completed with Errors'}
                  </h4>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-2 rounded bg-white/5 border border-white/10">
                      <p className="text-muted-foreground">Total Rows</p>
                      <p className="font-bold text-base">{uploadResult.stats.totalRows}</p>
                    </div>
                    <div className="p-2 rounded bg-white/5 border border-white/10">
                      <p className="text-muted-foreground">Successful</p>
                      <p className="font-bold text-base text-emerald-400">{uploadResult.stats.successfulRows}</p>
                    </div>
                    {uploadResult.stats.failedRows > 0 && (
                      <div className="p-2 rounded bg-white/5 border border-white/10">
                        <p className="text-muted-foreground">Failed</p>
                        <p className="font-bold text-base text-red-400">{uploadResult.stats.failedRows}</p>
                      </div>
                    )}
                    {uploadResult.stats.validationWarnings > 0 && (
                      <div className="p-2 rounded bg-white/5 border border-white/10">
                        <p className="text-muted-foreground">Warnings</p>
                        <p className="font-bold text-base text-amber-400">{uploadResult.stats.validationWarnings}</p>
                      </div>
                    )}
                  </div>
                  {uploadResult.errors.length > 0 && (
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      <p className="text-xs font-bold text-muted-foreground">Errors:</p>
                      {uploadResult.errors.slice(0, 5).map((err, idx) => (
                        <p key={idx} className="text-xs text-red-300">
                          Row {err.rowNumber}{err.field ? ` (${err.field})` : ''}: {err.message}
                        </p>
                      ))}
                      {uploadResult.errors.length > 5 && (
                        <p className="text-xs text-muted-foreground">
                          ... and {uploadResult.errors.length - 5} more errors
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <Button
              onClick={handleReset}
              variant="outline"
              className="w-full"
            >
              Upload Another File
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all',
                'border-white/20 hover:border-indigo-400/50 hover:bg-indigo-500/5',
                selectedFile && 'border-indigo-400/50 bg-indigo-500/10'
              )}
            >
              <FileUp className="h-8 w-8 mx-auto mb-2 text-white/60" />
              <p className="font-bold text-sm">
                {selectedFile ? selectedFile.name : 'Click to select CSV file'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                or drag and drop
              </p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="hidden"
            />

            <Button
              onClick={handleUpload}
              disabled={!selectedFile || isLoading}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload {sourceType.charAt(0).toUpperCase() + sourceType.slice(1)}
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
