"use client";

import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { FileUp, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/apiFetch';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ImportMeeshoReturnsProps {
  onSuccess: () => void;
  onClose: () => void;
}

export function ImportMeeshoReturns({ onSuccess, onClose }: ImportMeeshoReturnsProps) {
  const { toast } = useToast();
  const [mounted, setMounted] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<any>(null);

  React.useEffect(() => {
    setMounted(true);
  }, []);

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
    },
    multiple: false
  });

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await apiFetch('/api/returns/import/meesho', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();

      if (res.ok) {
        setResult(data);
        toast({ 
          title: 'Import Complete', 
          description: `Processed ${data.total_rows} rows from Meesho report.` 
        });
        if (data.imported > 0) {
          onSuccess();
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

  if (!mounted) return null;

  if (result) {
    return (
      <div className="space-y-6 py-4">
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-muted/50 border border-border/50 text-center">
            <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Total Rows</p>
            <p className="text-2xl font-black text-foreground">{result.total_rows}</p>
          </div>
          <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 text-center">
            <p className="text-[10px] font-bold uppercase text-emerald-600 mb-1">Imported</p>
            <p className="text-2xl font-black text-emerald-700 dark:text-emerald-400">{result.imported}</p>
          </div>
          <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 text-center">
            <p className="text-[10px] font-bold uppercase text-rose-600 mb-1">Failed</p>
            <p className="text-2xl font-black text-rose-700 dark:text-rose-400">{result.failed}</p>
          </div>
        </div>

        {result.errors?.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-2">
              <AlertCircle className="h-3 w-3 text-rose-500" />
              Error Details
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
          onClick={onClose}
        >
          <CheckCircle2 className="mr-2 h-4 w-4" /> Close
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 py-4">
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
          <h3 className="text-lg font-bold font-headline">{file ? file.name : "Select Meesho Return Report"}</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {file ? `${(file.size / 1024).toFixed(1)} KB` : "Drag and drop your report here, or click to browse"}
          </p>
        </div>
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
          disabled={uploading}
          onClick={onClose}
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
