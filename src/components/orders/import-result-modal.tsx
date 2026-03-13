"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, AlertCircle, Info, Database } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImportResultModalProps {
  result: any;
  onClose: () => void;
}

export function ImportResultModal({ result, onClose }: ImportResultModalProps) {
  if (!result) return null;

  return (
    <Dialog open={!!result} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] rounded-[2rem] border-0 shadow-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl">
        <DialogHeader>
          <div className="p-3 bg-emerald-500/10 w-fit rounded-2xl mb-4">
            <Database className="h-6 w-6 text-emerald-600" />
          </div>
          <DialogTitle className="text-2xl font-headline font-black tracking-tight">Import Intelligence Report</DialogTitle>
          <DialogDescription className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Transaction Summary for Meesho Batch</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-6">
          <div className="p-4 rounded-3xl bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30">
            <p className="text-[9px] font-black uppercase tracking-widest text-indigo-600 mb-1">Total Processed</p>
            <p className="text-3xl font-black font-headline text-indigo-900 dark:text-indigo-100">{result.total_rows}</p>
          </div>
          <div className="p-4 rounded-3xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30">
            <p className="text-[9px] font-black uppercase tracking-widest text-emerald-600 mb-1">Imported</p>
            <p className="text-3xl font-black font-headline text-emerald-900 dark:text-emerald-100">{result.imported}</p>
          </div>
          <div className="p-4 rounded-3xl bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30">
            <p className="text-[9px] font-black uppercase tracking-widest text-amber-600 mb-1">Duplicates</p>
            <p className="text-3xl font-black font-headline text-amber-900 dark:text-amber-100">{result.duplicates}</p>
          </div>
          <div className="p-4 rounded-3xl bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30">
            <p className="text-[9px] font-black uppercase tracking-widest text-rose-600 mb-1">Failures</p>
            <p className="text-3xl font-black font-headline text-rose-900 dark:text-rose-100">{result.failed}</p>
          </div>
        </div>

        {result.new_skus > 0 && (
          <div className="mb-6 flex items-center gap-3 p-4 bg-primary/5 rounded-2xl border border-primary/10">
            <Info className="h-4 w-4 text-primary" />
            <p className="text-[11px] font-bold text-primary italic">
              System successfully provisioned {result.new_skus} new SKUs in your inventory catalog.
            </p>
          </div>
        )}

        {result.errors?.length > 0 && (
          <div className="space-y-3">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
              <AlertCircle className="h-3 w-3" /> Execution Errors
            </p>
            <ScrollArea className="h-[120px] rounded-2xl border border-border/50 bg-muted/20 p-4">
              {result.errors.map((err: any, idx: number) => (
                <div key={idx} className="flex gap-2 text-[10px] font-bold text-rose-600 mb-2 last:mb-0">
                  <span className="opacity-50">Row {err.row}:</span>
                  <span className="flex-1">{err.message}</span>
                </div>
              ))}
            </ScrollArea>
          </div>
        )}

        <DialogFooter className="mt-6">
          <Button onClick={onClose} className="w-full h-12 rounded-2xl font-black tracking-tight bg-primary shadow-lg shadow-primary/20">
            Acknowledge Summary
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
