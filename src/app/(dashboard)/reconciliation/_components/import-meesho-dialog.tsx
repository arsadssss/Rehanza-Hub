'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Upload, FileSpreadsheet } from 'lucide-react';
import { UploadSection } from './upload-section';
import { cn } from '@/lib/utils';

interface ImportMeeshoDialogProps {
  accountId: string | null;
  onUploadComplete?: (result: any) => void;
  className?: string;
}

export function ImportMeeshoDialog({
  accountId,
  onUploadComplete,
  className,
}: ImportMeeshoDialogProps) {
  const [open, setOpen] = useState(false);

  const handleUploadComplete = (result: any) => {
    onUploadComplete?.(result);
  };

  return (
    <>
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label="Import Meesho Data"
              onClick={() => setOpen(true)}
              className={cn(
                'glass-button h-9 w-9 p-0 rounded-xl border-indigo-500/30 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20 hover:text-indigo-200 transition-all shadow-sm flex items-center justify-center flex-shrink-0',
                className
              )}
            >
              <Upload className="h-4 w-4 text-indigo-400" />
            </Button>
          </TooltipTrigger>
          <TooltipContent
            side="bottom"
            className="bg-slate-900 border-white/15 text-white text-xs font-semibold shadow-xl"
          >
            Import Meesho Data
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[95vw] max-w-2xl lg:max-w-3xl max-h-[90vh] overflow-y-auto border-white/15 bg-slate-950/95 text-white backdrop-blur-2xl shadow-2xl p-4 sm:p-6 rounded-2xl">
          <DialogHeader className="space-y-3 pb-3 border-b border-white/10 text-left">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pr-6">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-indigo-500/15 border border-indigo-400/25 flex items-center justify-center text-indigo-400 flex-shrink-0">
                  <FileSpreadsheet className="h-4 w-4" />
                </div>
                <div>
                  <DialogTitle className="text-base sm:text-lg font-black text-white tracking-tight">
                    Import Meesho Data
                  </DialogTitle>
                  <DialogDescription className="text-xs text-slate-300 mt-0.5">
                    Upload Orders, Payments, or RM Ads CSV with auto-detection & deduplication
                  </DialogDescription>
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] font-semibold text-slate-400">Supported:</span>
                <Badge variant="outline" className="text-[10px] font-bold border-white/15 bg-slate-900/60 text-slate-300">
                  Orders
                </Badge>
                <Badge variant="outline" className="text-[10px] font-bold border-white/15 bg-slate-900/60 text-slate-300">
                  Payments
                </Badge>
                <Badge variant="outline" className="text-[10px] font-bold border-white/15 bg-slate-900/60 text-slate-300">
                  RM Ads
                </Badge>
              </div>
            </div>
          </DialogHeader>

          <div className="pt-2">
            <UploadSection
              accountId={accountId}
              onUploadComplete={handleUploadComplete}
              embedded
              onCloseDialog={() => setOpen(false)}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

