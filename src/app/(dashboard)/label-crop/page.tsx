
"use client";

import React, { useState } from 'react';
import { PdfUploader } from '@/components/label-crop/PdfUploader';
import { PdfCropper } from '@/components/label-crop/PdfCropper';
import { Scissors, FileText, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

/**
 * LabelCropPage - A secure, frontend-only PDF cropping utility.
 * Designed for isolating shipping labels from full-page platform PDFs.
 */
export default function LabelCropPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-10 font-body">
      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-4xl font-black tracking-tighter font-headline text-foreground flex items-center gap-3">
          <div className="p-2.5 bg-primary rounded-2xl shadow-lg shadow-primary/20">
            <Scissors className="h-7 w-7 text-white" />
          </div>
          Label Intelligence
        </h1>
        <p className="text-muted-foreground font-medium text-sm ml-1">
          Precision extraction for shipping labels. 100% browser-based security.
        </p>
      </div>

      {/* Main Content Area */}
      {!selectedFile ? (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <PdfUploader onFileSelect={setSelectedFile} />
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="border-0 shadow-xl bg-white/50 dark:bg-slate-900/50 rounded-[2rem]">
              <CardHeader>
                <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-2">
                  <FileText className="h-5 w-5 text-emerald-600" />
                </div>
                <CardTitle className="text-sm font-headline font-bold">Privacy Guaranteed</CardTitle>
                <CardDescription className="text-xs">Your labels never leave your computer. Processing occurs entirely in local RAM.</CardDescription>
              </CardHeader>
            </Card>
            
            <Card className="border-0 shadow-xl bg-white/50 dark:bg-slate-900/50 rounded-[2rem]">
              <CardHeader>
                <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center mb-2">
                  <Scissors className="h-5 w-5 text-blue-600" />
                </div>
                <CardTitle className="text-sm font-headline font-bold">Exact Precision</CardTitle>
                <CardDescription className="text-xs">Select exactly what you need. Barcodes are preserved at full vector resolution.</CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-0 shadow-xl bg-white/50 dark:bg-slate-900/50 rounded-[2rem]">
              <CardHeader>
                <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center mb-2">
                  <AlertCircle className="h-5 w-5 text-amber-600" />
                </div>
                <CardTitle className="text-sm font-headline font-bold">First Page Only</CardTitle>
                <CardDescription className="text-xs">Optimized for single-page platform labels (Meesho, Flipkart, Amazon).</CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      ) : (
        <div className="animate-in zoom-in-95 duration-500">
          <div className="flex items-center justify-between mb-6 px-4">
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-black uppercase tracking-tighter">Active Session</span>
              <h2 className="text-sm font-bold truncate max-w-[300px]">{selectedFile.name}</h2>
            </div>
            <button 
              onClick={() => setSelectedFile(null)}
              className="text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-destructive transition-colors"
            >
              Change File
            </button>
          </div>
          
          <PdfCropper file={selectedFile} onReset={() => setSelectedFile(null)} />
        </div>
      )}
    </div>
  );
}
