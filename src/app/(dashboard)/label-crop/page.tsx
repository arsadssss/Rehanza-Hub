"use client";

import React, { useState, useCallback } from 'react';
import { PdfUploader } from '@/components/label-crop/PdfUploader';
import { PdfCanvasViewerMemo } from '@/components/label-crop/PdfCanvasViewer';
import { CropOverlay } from '@/components/label-crop/CropOverlay';
import { Scissors, RefreshCw, ZoomIn, Maximize, FileDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import { processPdfCrop } from '@/lib/pdfProcessor';

/**
 * Label Intelligence - Professional PDF Cropping Tool
 * Fixed blinking by decoupling PDF rendering from crop state.
 */
export default function LabelCropPage() {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [zoom, setZoom] = useState(1.0);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Crop state in pixels relative to the canvas
  const [cropBox, setCropBox] = useState({ x: 50, y: 50, width: 400, height: 300 });
  
  // PDF dimensions from rendering engine
  const [pdfMeta, setPdfPdfMeta] = useState<{ width: number; height: number; canvasWidth: number; canvasHeight: number } | null>(null);

  const handleFileSelect = (newFile: File) => {
    setFile(newFile);
    setPdfPdfMeta(null);
    setCropBox({ x: 50, y: 50, width: 400, height: 300 });
  };

  const handleMetaChange = useCallback((meta: { width: number; height: number; canvasWidth: number; canvasHeight: number }) => {
    setPdfPdfMeta(meta);
  }, []);

  const handleCenterBox = () => {
    if (!pdfMeta) return;
    setCropBox(prev => ({
      ...prev,
      x: (pdfMeta.canvasWidth - prev.width) / 2,
      y: (pdfMeta.canvasHeight - prev.height) / 2
    }));
  };

  const handleDownload = async () => {
    if (!file || !pdfMeta) return;

    setIsProcessing(true);
    try {
      const buffer = await file.arrayBuffer();
      
      // Calculate Scaling: Visual Pixels -> PDF Points
      const scaleX = pdfMeta.width / pdfMeta.canvasWidth;
      const scaleY = pdfMeta.height / pdfMeta.canvasHeight;

      // PDF Origin is Bottom-Left (0,0)
      // Visual Origin is Top-Left (0,0)
      const pdfCrop = {
        x: cropBox.x * scaleX,
        y: pdfMeta.height - (cropBox.y + cropBox.height) * scaleY,
        width: cropBox.width * scaleX,
        height: cropBox.height * scaleY
      };

      const croppedPdfBytes = await processPdfCrop(buffer, pdfCrop);
      
      const blob = new Blob([croppedPdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `label-${new Date().getTime()}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({ title: 'Success', description: 'Cropped label downloaded.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8 font-body min-h-screen">
      <div className="flex flex-col gap-1">
        <h1 className="text-4xl font-black tracking-tighter font-headline text-foreground flex items-center gap-3">
          <div className="p-2.5 bg-primary rounded-2xl shadow-lg shadow-primary/20">
            <Scissors className="h-7 w-7 text-white" />
          </div>
          Label Intelligence
        </h1>
        <p className="text-muted-foreground font-medium text-sm ml-1">
          Precision extraction for shipping labels. 100% local memory processing.
        </p>
      </div>

      {!file ? (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
          <PdfUploader onFileSelect={handleFileSelect} />
        </div>
      ) : (
        <div className="space-y-6 animate-in zoom-in-95 duration-500">
          {/* Main Preview Workspace */}
          <div className="relative bg-slate-950 rounded-[2.5rem] shadow-2xl border border-white/5 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-8 py-4 border-b border-white/5 bg-slate-900/50 backdrop-blur-md z-10">
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-black uppercase tracking-tighter">Active Session</span>
                <h2 className="text-xs font-bold text-white/80 truncate max-w-[300px]">{file.name}</h2>
              </div>
              <button 
                onClick={() => setFile(null)}
                className="text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-rose-400 transition-colors"
              >
                Change File
              </button>
            </div>

            <div className="h-[600px] overflow-auto flex items-start justify-center p-12 custom-scrollbar bg-slate-900/20">
              <PdfCanvasViewerMemo 
                file={file} 
                zoom={zoom} 
                onMetaChange={handleMetaChange}
              >
                <CropOverlay 
                  x={cropBox.x} 
                  y={cropBox.y} 
                  width={cropBox.width} 
                  height={cropBox.height} 
                  scale={zoom}
                  onUpdate={setCropBox}
                />
              </PdfCanvasViewerMemo>
            </div>
          </div>

          {/* Controls Footer */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-8 rounded-[2.5rem] shadow-xl border border-border/50">
            <div className="lg:col-span-4 space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Zoom Viewport</label>
                <span className="text-[10px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded-full">{(zoom * 100).toFixed(0)}%</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="p-2 bg-primary/10 rounded-xl">
                  <ZoomIn className="h-4 w-4 text-primary" />
                </div>
                <Slider 
                  value={[zoom]} 
                  min={0.5} 
                  max={2.5} 
                  step={0.1} 
                  onValueChange={([val]) => setZoom(val)}
                  className="flex-1"
                />
              </div>
            </div>

            <div className="lg:col-span-8 flex flex-wrap justify-end gap-3">
              <Button 
                variant="outline" 
                onClick={handleCenterBox}
                className="rounded-xl h-12 px-6 font-bold"
              >
                <Maximize className="mr-2 h-4 w-4" /> Center Box
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setZoom(1.0)} 
                className="rounded-xl h-12 px-6 font-bold"
              >
                <RefreshCw className="mr-2 h-4 w-4" /> Reset Zoom
              </Button>
              <Button 
                onClick={handleDownload} 
                disabled={isProcessing}
                className="rounded-xl h-12 px-8 font-black shadow-lg shadow-primary/20 bg-primary hover:scale-[1.02] transition-transform"
              >
                {isProcessing ? (
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <FileDown className="h-4 w-4 mr-2" />
                )}
                Extract & Download PDF
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
