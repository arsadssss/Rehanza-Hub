
"use client";

import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileUp, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/apiFetch';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ImportOrdersProps {
  onSuccess: () => void;
}

export function ImportOrders({ onSuccess }: ImportOrdersProps) {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [platform, setPlatform] = useState('meesho');
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      setResult(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'text/csv': ['.csv'],
      'text/tab-separated-values': ['.tsv']
    },
    multiple: false
  });

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      // Dynamic endpoint based on selected platform
      const apiEndpoint = platform === 'flipkart' 
        ? '/api/orders/import/flipkart' 
        : '/api/orders/import/meesho';

      const res = await apiFetch(apiEndpoint, {
        method: 'POST',
        body: formData
      });

      const data = await res.json();

      if (res.ok) {
        setResult(data);
        toast({ 
          title: 'Import Complete', 
          description: `Successfully imported ${data.imported || data.orders_imported || 0} orders from ${platform.charAt(0).toUpperCase() + platform.slice(1)}.` 
        });
        if ((data.imported || data.orders_imported) > 0) {
          setTimeout(() => {
            if (!data.errors?.length) onSuccess();
          }, 3000);
        }
      } else {
        throw new Error(data.message || 'Import failed');
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setUploading(false);
    }
  };

  if (result) {
    const imported = result.imported ?? result.orders_imported ?? 0;
    const duplicates = result.duplicates ?? result.duplicates_skipped ?? 0;
    const failed = result.failed ?? result.failed_rows ?? 0;

    return (
      <div className="space-y-6 py-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 text-center">
            <p className="text-[10px] font-bold uppercase text-emerald-600 mb-1">Imported</p>
            <p className="text-3xl font-black text-emerald-700 dark:text-emerald-400">{imported}</p>
          </div>
          <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 text-center">
            <p className="text-[10px] font-bold uppercase text-blue-600 mb-1">Duplicates</p>
            <p className="text-3xl font-black text-blue-700 dark:text-blue-400">{duplicates}</p>
          </div>
        </div>

        {result.errors?.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-2">
              <AlertCircle className="h-3 w-3 text-rose-500" />
              Failed Rows ({failed})
            </p>
            <ScrollArea className="h-40 rounded-xl border bg-muted/30 p-4">
              <ul className="space-y-2">
                {result.errors.map((err: any, idx: number) => (
                  <li key={idx} className="text-[11px] leading-tight text-rose-600 dark:text-rose-400 flex gap-2">
                    <span className="font-bold whitespace-nowrap">Row {err.row}:</span>
                    <span>{err.message}</span>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          </div>
        )}

        <Button 
          className="w-full h-12 rounded-xl font-bold" 
          onClick={() => { setResult(null); setFile(null); onSuccess(); }}
        >
          <CheckCircle2 className="mr-2 h-4 w-4" /> Close Summary
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 py-4">
      {/* Platform Selector */}
      <div className="space-y-2">
        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">
          Select Marketplace Platform
        </label>
        <Select value={platform} onValueChange={setPlatform} disabled={uploading}>
          <SelectTrigger className="h-11 rounded-xl bg-background border-border/50">
            <SelectValue placeholder="Select platform" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="meesho">Meesho</SelectItem>
            <SelectItem value="flipkart">Flipkart</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Dropzone */}
      <div 
        {...getRootProps()} 
        className={cn(
          "border-2 border-dashed rounded-[2rem] p-12 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-4",
          isDragActive ? "border-primary bg-primary/5 scale-[0.98]" : "border-muted-foreground/20 hover:border-primary/40 hover:bg-muted/30",
          uploading && "pointer-events-none opacity-50"
        )}
      >
        <input {...getInputProps()} />
        <div className="p-6 bg-primary/10 rounded-full">
          {uploading ? <RefreshCw className="h-10 w-10 text-primary animate-spin" /> : <FileUp className="h-10 w-10 text-primary" />}
        </div>
        <div>
          <h3 className="text-lg font-bold font-headline">{file ? file.name : `Select ${platform.charAt(0).toUpperCase() + platform.slice(1)} Report`}</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {file ? `${(file.size / 1024).toFixed(1)} KB` : "Drag and drop your report here, or click to browse"}
          </p>
        </div>
      </div>

      <div className="p-4 rounded-xl bg-blue-50/50 dark:bg-blue-950/10 border border-blue-100/50 text-[11px] text-blue-700 dark:text-blue-400 leading-relaxed">
        <p className="font-bold uppercase tracking-widest mb-1 flex items-center gap-2">
          <Upload className="h-3 w-3" /> Supporting
        </p>
        Currently supporting <strong>{platform.charAt(0).toUpperCase() + platform.slice(1)}</strong> Order Reports (.xlsx, .csv, .tsv). Ensure the column headers remain unchanged from the platform export.
      </div>

      {uploading && (
        <div className="space-y-2">
          <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            <span>Processing Data...</span>
            <span>Please Wait</span>
          </div>
          <Progress value={undefined} className="h-1.5" />
        </div>
      )}

      <div className="flex gap-3">
        <Button 
          variant="outline" 
          className="flex-1 h-12 rounded-xl font-bold" 
          disabled={uploading || !file}
          onClick={() => setFile(null)}
        >
          Cancel
        </Button>
        <Button 
          className="flex-1 h-12 rounded-xl font-bold" 
          disabled={uploading || !file}
          onClick={handleUpload}
        >
          {uploading ? "Importing..." : "Start Import"}
        </Button>
      </div>
    </div>
  );
}
