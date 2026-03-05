"use client";

import React, { useState, useCallback, useRef } from 'react';
import { PdfUploader } from '@/components/label-crop/PdfUploader';
import { PdfCanvasViewerMemo } from '@/components/label-crop/PdfCanvasViewer';
import { CropOverlay } from '@/components/label-crop/CropOverlay';
import { Scissors, RefreshCw, ZoomIn, Maximize, FileDown, ScanLine, ShoppingBag, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import { processPdfCrop, processAmazonLabels } from '@/lib/pdfProcessor';
import jsQR from 'jsqr';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { cn } from '@/lib/utils';

type LabelMode = 'flipkart' | 'amazon';

/**
 * Label Intelligence - Professional PDF Cropping Tool
 * Includes Robust Multi-Stage Auto-Detection Mode and specialized Amazon Mode.
 */
export default function LabelCropPage() {
  const { toast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [file, setFile] = useState<File | null>(null);
  const [zoom, setZoom] = useState(1.0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [mode, setMode] = useState<LabelMode>('flipkart');
  
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

  /**
   * Content Bounding Box Detection
   */
  const detectLabelRectangle = (canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0;
    let found = false;

    for (let y = 0; y < canvas.height; y += 4) {
      for (let x = 0; x < canvas.width; x += 4) {
        const index = (y * canvas.width + x) * 4;
        const r = data[index];
        const g = data[index + 1];
        const b = data[index + 2];
        
        if (r < 200 && g < 200 && b < 200) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
          found = true;
        }
      }
    }

    if (!found) return null;

    const padding = 20;
    return {
      x: Math.max(0, minX - padding),
      y: Math.max(0, minY - padding),
      width: Math.min(canvas.width - minX, (maxX - minX) + padding * 2),
      height: Math.min(canvas.height - minY, (maxY - minY) + padding * 2)
    };
  };

  const handleAutoDetect = async () => {
    if (!canvasRef.current || !pdfMeta) return;

    setIsDetecting(true);
    try {
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error("Could not access canvas context");

      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const qr = jsQR(imageData.data, canvas.width, canvas.height);

      if (qr) {
        const detectedWidth = 600;
        const detectedHeight = 850;
        const newX = Math.max(0, Math.min(canvas.width - detectedWidth, qr.location.topLeftCorner.x - (detectedWidth / 2) + 50));
        const newY = Math.max(0, Math.min(canvas.height - detectedHeight, qr.location.topLeftCorner.y - (detectedHeight - 150)));

        setCropBox({ x: newX, y: newY, width: detectedWidth, height: detectedHeight });
        toast({ title: 'QR Detected', description: 'Framed label area based on shipping QR code.' });
        return;
      }

      const barcodeReader = new BrowserMultiFormatReader();
      try {
        const barcodeResult = await barcodeReader.decodeFromCanvas(canvas);
        if (barcodeResult) {
          const points = barcodeResult.getResultPoints();
          const firstPoint = points[0];
          
          const detectedWidth = 650;
          const detectedHeight = 900;
          const newX = Math.max(0, Math.min(canvas.width - detectedWidth, firstPoint.getX() - (detectedWidth / 2)));
          const newY = Math.max(0, Math.min(canvas.height - detectedHeight, firstPoint.getY() - 100));

          setCropBox({ x: newX, y: newY, width: detectedWidth, height: detectedHeight });
          toast({ title: 'Barcode Detected', description: 'Framed label area based on primary barcode.' });
          return;
        }
      } catch (e) {}

      const rect = detectLabelRectangle(canvas);
      if (rect && rect.width > 200 && rect.height > 200) {
        setCropBox(rect);
        toast({ title: 'Label Area Detected', description: 'Detected label boundaries based on printed content.' });
      } else {
        toast({
          variant: 'destructive',
          title: 'Detection Failed',
          description: 'No barcodes found. Please position manually.',
        });
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Detection Error', description: error.message });
    } finally {
      setIsDetecting(false);
    }
  };

  const handleDownload = async () => {
    if (!file) return;

    setIsProcessing(true);
    try {
      const buffer = await file.arrayBuffer();
      let finalPdfBytes: Uint8Array;

      if (mode === 'amazon') {
        // Amazon specific logic: automated cleaning + SKU printing
        finalPdfBytes = await processAmazonLabels(buffer);
      } else {
        // Standard logic: user defined crop box
        if (!pdfMeta) throw new Error("Metadata missing for crop.");
        const scaleX = pdfMeta.width / pdfMeta.canvasWidth;
        const scaleY = pdfMeta.height / pdfMeta.canvasHeight;

        const pdfCrop = {
          x: cropBox.x * scaleX,
          y: pdfMeta.height - (cropBox.y + cropBox.height) * scaleY,
          width: cropBox.width * scaleX,
          height: cropBox.height * scaleY
        };

        finalPdfBytes = await processPdfCrop(buffer, pdfCrop);
      }
      
      const blob = new Blob([finalPdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${mode}-label-${new Date().getTime()}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({ title: 'Success', description: 'Processed label downloaded.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8 font-body min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
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

        {/* Mode Selector */}
        <div className="bg-white/50 dark:bg-slate-900/50 p-1.5 rounded-2xl border border-border/50 flex gap-1">
          <button 
            onClick={() => setMode('flipkart')}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-tighter transition-all flex items-center gap-2",
              mode === 'flipkart' ? "bg-primary text-white shadow-md" : "text-muted-foreground hover:bg-primary/5"
            )}
          >
            <Truck className="h-3.5 w-3.5" />
            Flipkart/Standard
          </button>
          <button 
            onClick={() => setMode('amazon')}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-tighter transition-all flex items-center gap-2",
              mode === 'amazon' ? "bg-[#FF9900] text-black shadow-md" : "text-muted-foreground hover:bg-[#FF9900]/10"
            )}
          >
            <ShoppingBag className="h-3.5 w-3.5" />
            Amazon Mode
          </button>
        </div>
      </div>

      {!file ? (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
          <PdfUploader onFileSelect={handleFileSelect} />
        </div>
      ) : (
        <div className="space-y-6 animate-in zoom-in-95 duration-500">
          <div className="relative bg-slate-950 rounded-[2.5rem] shadow-2xl border border-white/5 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-8 py-4 border-b border-white/5 bg-slate-900/50 backdrop-blur-md z-10">
              <div className="flex items-center gap-3">
                <span className={cn(
                  "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter",
                  mode === 'amazon' ? "bg-[#FF9900]/20 text-[#FF9900]" : "bg-primary/10 text-primary"
                )}>
                  {mode.toUpperCase()} MODE
                </span>
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
                canvasRef={canvasRef}
              >
                {mode === 'flipkart' && (
                  <CropOverlay 
                    x={cropBox.x} 
                    y={cropBox.y} 
                    width={cropBox.width} 
                    height={cropBox.height} 
                    scale={zoom}
                    onUpdate={setCropBox}
                  />
                )}
                {mode === 'amazon' && (
                  <div className="absolute inset-0 pointer-events-none border-4 border-dashed border-[#FF9900]/30">
                    <div className="absolute top-0 left-0 right-0 h-[70%] bg-[#FF9900]/5 flex items-center justify-center">
                      <span className="text-[#FF9900] text-[10px] font-black uppercase bg-black/40 px-4 py-2 rounded-full border border-[#FF9900]/20 backdrop-blur-md">
                        Auto-Crop Area (Labels Only)
                      </span>
                    </div>
                  </div>
                )}
              </PdfCanvasViewerMemo>
            </div>
          </div>

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
              {mode === 'flipkart' && (
                <>
                  <Button 
                    variant="outline" 
                    onClick={handleAutoDetect}
                    disabled={isDetecting || !pdfMeta}
                    className="rounded-xl h-12 px-6 font-bold border-primary/20 text-primary hover:bg-primary/5"
                  >
                    {isDetecting ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <ScanLine className="mr-2 h-4 w-4" />}
                    Auto-Detect Labels
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={handleCenterBox}
                    className="rounded-xl h-12 px-6 font-bold"
                  >
                    <Maximize className="mr-2 h-4 w-4" /> Center Box
                  </Button>
                </>
              )}
              
              <Button 
                onClick={handleDownload} 
                disabled={isProcessing}
                className={cn(
                  "rounded-xl h-12 px-8 font-black shadow-lg transition-transform hover:scale-[1.02]",
                  mode === 'amazon' ? "bg-[#FF9900] text-black shadow-[#FF9900]/20" : "bg-primary shadow-primary/20"
                )}
              >
                {isProcessing ? (
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <FileDown className="h-4 w-4 mr-2" />
                )}
                {mode === 'amazon' ? 'Extract Amazon Labels' : 'Extract & Download PDF'}
              </Button>
            </div>
          </div>
          
          {mode === 'amazon' && (
            <div className="p-6 bg-[#FF9900]/5 border border-[#FF9900]/20 rounded-3xl flex items-start gap-4">
              <div className="p-2 bg-[#FF9900]/10 rounded-xl">
                <ShoppingBag className="h-5 w-5 text-[#FF9900]" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-black text-foreground uppercase tracking-tight">Amazon Automation Active</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  In Amazon Mode, the tool will automatically remove invoice pages, crop labels, extract SKUs from text, 
                  and print them at the bottom of each shipping label for easier sorting.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
