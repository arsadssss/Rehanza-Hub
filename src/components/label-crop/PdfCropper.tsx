
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Rnd } from 'react-rnd';
import * as pdfjs from 'pdfjs-dist';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { 
  Download, 
  RefreshCw, 
  ZoomIn, 
  Scissors, 
  CheckCircle2, 
  Maximize, 
  Move,
  Info
} from 'lucide-react';
import { processPdfCrop } from '@/lib/pdfProcessor';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';

// Configure PDF.js worker using a reliable CDN path with the correct extension for v4+
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfCropperProps {
  file: File;
  onReset: () => void;
}

export function PdfCropper({ file, onReset }: PdfCropperProps) {
  const { toast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Crop state in pixels relative to current canvas size
  const [crop, setCrop] = useState({ x: 50, y: 50, width: 400, height: 300 });
  const [zoom, setZoom] = useState(1.5);
  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingPdf, setLoadingPdf] = useState(true);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  // Render PDF to Canvas
  useEffect(() => {
    async function renderPdf() {
      setLoadingPdf(true);
      try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
        const page = await pdf.getPage(1);
        
        // Render at a high base scale for clarity, then let zoom state control display size
        const viewport = page.getViewport({ scale: zoom });
        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext('2d');
        if (!context) throw new Error("Could not get canvas context");
        
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        setCanvasSize({ width: viewport.width, height: viewport.height });
        
        await page.render({ canvasContext: context, viewport }).promise;
      } catch (error) {
        console.error("PDF render error:", error);
        toast({
          variant: 'destructive',
          title: 'Render Error',
          description: 'Failed to process the PDF for preview.'
        });
      } finally {
        setLoadingPdf(false);
      }
    }

    renderPdf();
  }, [file, toast, zoom]);

  const handleCenterCrop = () => {
    if (canvasSize.width > 0) {
      setCrop({
        x: (canvasSize.width - 400) / 2,
        y: (canvasSize.height - 300) / 2,
        width: 400,
        height: 300
      });
    }
  };

  const handleDownload = async () => {
    if (!canvasSize.width || !canvasSize.height) return;

    setIsProcessing(true);
    try {
      const originalPdfBuffer = await file.arrayBuffer();
      
      // Calculate percentages for the processor (agnostic of display zoom)
      const cropArea = {
        x: (crop.x / canvasSize.width) * 100,
        y: (crop.y / canvasSize.height) * 100,
        width: (crop.width / canvasSize.width) * 100,
        height: (crop.height / canvasSize.height) * 100
      };

      const croppedPdfBytes = await processPdfCrop(originalPdfBuffer, cropArea);
      
      const blob = new Blob([croppedPdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `cropped-label-${new Date().getTime()}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: 'Label Extracted',
        description: 'Your cropped PDF has been downloaded successfully.'
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Export Failed',
        description: error.message
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (loadingPdf && canvasSize.width === 0) {
    return (
      <div className="h-[600px] w-full flex flex-col items-center justify-center gap-4 bg-muted/20 rounded-[2.5rem] animate-pulse border-2 border-dashed border-muted">
        <RefreshCw className="h-10 w-10 text-primary animate-spin" />
        <p className="text-xs font-black uppercase tracking-[0.3em] text-muted-foreground">Initializing Engine...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Interactive PDF Workspace */}
      <div className="relative group bg-slate-950 rounded-[2.5rem] shadow-2xl border border-white/5 overflow-hidden">
        <ScrollArea className="h-[600px] w-full">
          <div 
            ref={containerRef}
            className="relative mx-auto my-12 shadow-[0_0_100px_rgba(0,0,0,0.5)]"
            style={{ 
              width: canvasSize.width, 
              height: canvasSize.height,
              backgroundColor: '#fff' 
            }}
          >
            <canvas ref={canvasRef} className="block pointer-events-none" />
            
            {/* Draggable & Resizable Overlay */}
            <Rnd
              size={{ width: crop.width, height: crop.height }}
              position={{ x: crop.x, y: crop.y }}
              onDragStop={(e, d) => setCrop(prev => ({ ...prev, x: d.x, y: d.y }))}
              onResizeStop={(e, direction, ref, delta, position) => {
                setCrop({
                  width: parseInt(ref.style.width),
                  height: parseInt(ref.style.height),
                  x: position.x,
                  y: position.y
                });
              }}
              bounds="parent"
              className="z-20"
            >
              <div className="w-full h-full relative border-2 border-primary bg-primary/5 group/box shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]">
                {/* The Grid Overlay */}
                <div className="absolute inset-0 pointer-events-none opacity-20" 
                  style={{
                    backgroundImage: `
                      linear-gradient(to right, white 1px, transparent 1px),
                      linear-gradient(to bottom, white 1px, transparent 1px)
                    `,
                    backgroundSize: '33.33% 33.33%'
                  }}
                />
                
                {/* Corner Visual Indicators */}
                <div className="absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 border-white rounded-tl-sm shadow-sm" />
                <div className="absolute -top-1 -right-1 w-3 h-3 border-t-2 border-r-2 border-white rounded-tr-sm shadow-sm" />
                <div className="absolute -bottom-1 -left-1 w-3 h-3 border-b-2 border-l-2 border-white rounded-bl-sm shadow-sm" />
                <div className="absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 border-white rounded-br-sm shadow-sm" />
                
                {/* Drag Handle Indicator */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-primary text-white opacity-0 group-hover/box:opacity-100 transition-opacity">
                  <Move className="h-3 w-3" />
                </div>
              </div>
            </Rnd>
          </div>
        </ScrollArea>

        {/* Floating Context Hint */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-black/60 backdrop-blur-md text-[10px] text-white/80 font-bold uppercase tracking-widest flex items-center gap-2 pointer-events-none border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
          <Info className="h-3 w-3" />
          Drag to move box • Pull corners to resize
        </div>
      </div>

      {/* Control Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-8 rounded-[2.5rem] shadow-xl border border-white/10">
        <div className="lg:col-span-4 space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Render Resolution</label>
            <span className="text-[10px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded-full">{(zoom * 100).toFixed(0)}%</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="p-2 bg-primary/10 rounded-xl">
              <ZoomIn className="h-4 w-4 text-primary" />
            </div>
            <Slider 
              value={[zoom]} 
              min={0.5} 
              max={3} 
              step={0.1} 
              onValueChange={([val]) => setZoom(val)}
              className="flex-1"
            />
          </div>
        </div>

        <div className="lg:col-span-8 flex flex-wrap justify-end gap-3">
          <Button 
            variant="outline" 
            onClick={handleCenterCrop}
            className="rounded-xl h-12 px-6 font-bold"
          >
            <Maximize className="mr-2 h-4 w-4" /> Center Box
          </Button>
          <Button 
            variant="outline" 
            onClick={onReset} 
            disabled={isProcessing}
            className="rounded-xl h-12 px-6 font-bold"
          >
            <RefreshCw className="mr-2 h-4 w-4" /> Reset Tool
          </Button>
          <Button 
            onClick={handleDownload} 
            disabled={isProcessing}
            className="rounded-xl h-12 px-8 font-black shadow-lg shadow-primary/20 bg-primary hover:scale-[1.02] transition-transform"
          >
            {isProcessing ? (
              <span className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 animate-spin" /> Processing...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Scissors className="h-4 w-4" /> Extract & Download PDF
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* Vector Alert */}
      <div className="flex items-start gap-4 p-6 rounded-[2rem] bg-indigo-500/5 border border-indigo-500/10 text-[11px] leading-relaxed text-indigo-600 dark:text-indigo-400 font-medium">
        <div className="p-2 bg-indigo-500/10 rounded-xl">
          <CheckCircle2 className="h-4 w-4" />
        </div>
        <div>
          <p className="font-black uppercase tracking-widest mb-1 text-[10px]">Professional Vector Integrity</p>
          <p>
            Unlike screenshot tools, this utility modifies the internal PDF <strong>CropBox</strong> metadata. Your barcodes remain mathematical vectors, ensuring 100% scan accuracy on any thermal printer without pixelation.
          </p>
        </div>
      </div>
    </div>
  );
}
