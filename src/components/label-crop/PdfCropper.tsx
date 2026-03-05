
"use client";

import React, { useState, useEffect, useRef } from 'react';
import Cropper, { Area } from 'react-easy-crop';
import * as pdfjs from 'pdfjs-dist';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Download, RefreshCw, ZoomIn, Scissors, CheckCircle2 } from 'lucide-react';
import { processPdfCrop } from '@/lib/pdfProcessor';
import { useToast } from '@/hooks/use-toast';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

interface PdfCropperProps {
  file: File;
  onReset: () => void;
}

export function PdfCropper({ file, onReset }: PdfCropperProps) {
  const { toast } = useToast();
  const [image, setImage] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingPdf, setLoadingPdf] = useState(true);

  // Convert PDF page to image for the cropper UI
  useEffect(() => {
    async function renderPdfToImage() {
      setLoadingPdf(true);
      try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
        const page = await pdf.getPage(1);
        
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        
        if (!context) throw new Error("Could not get canvas context");
        
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        await page.render({ canvasContext: context, viewport }).promise;
        setImage(canvas.toDataURL('image/png'));
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

    renderPdfToImage();
  }, [file, toast]);

  const onCropComplete = (croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedArea);
  };

  const handleDownload = async () => {
    if (!croppedAreaPixels) return;

    setIsProcessing(true);
    try {
      const originalPdfBuffer = await file.arrayBuffer();
      const croppedPdfBytes = await processPdfCrop(originalPdfBuffer, croppedAreaPixels);
      
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

  if (loadingPdf) {
    return (
      <div className="h-[500px] w-full flex flex-col items-center justify-center gap-4 bg-muted/20 rounded-[2rem] animate-pulse">
        <RefreshCw className="h-8 w-8 text-primary animate-spin" />
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Rendering Label...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="relative h-[500px] w-full bg-slate-900 rounded-[2rem] overflow-hidden shadow-2xl border border-white/5">
        {image && (
          <Cropper
            image={image}
            crop={crop}
            zoom={zoom}
            aspect={undefined} // Freeform crop
            onCropChange={setCrop}
            onCropComplete={onCropComplete}
            onZoomChange={setZoom}
            showGrid={true}
            style={{
              containerStyle: { background: '#0f172a' },
              cropAreaStyle: { border: '2px solid #6366f1', boxShadow: '0 0 0 9999px rgba(0,0,0,0.6)' }
            }}
          />
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-8 rounded-[2.5rem] shadow-xl border border-white/10">
        {/* Controls */}
        <div className="md:col-span-4 flex items-center gap-4">
          <div className="p-2 bg-primary/10 rounded-lg">
            <ZoomIn className="h-4 w-4 text-primary" />
          </div>
          <Slider 
            value={[zoom]} 
            min={1} 
            max={3} 
            step={0.1} 
            onValueChange={([val]) => setZoom(val)}
            className="flex-1"
          />
        </div>

        <div className="md:col-span-8 flex flex-wrap justify-end gap-3">
          <Button 
            variant="outline" 
            onClick={onReset} 
            disabled={isProcessing}
            className="rounded-xl h-12 px-6 font-bold"
          >
            <RefreshCw className="mr-2 h-4 w-4" /> Reset
          </Button>
          <Button 
            onClick={handleDownload} 
            disabled={isProcessing}
            className="rounded-xl h-12 px-8 font-black shadow-lg shadow-primary/20 bg-primary hover:scale-[1.02] transition-transform"
          >
            {isProcessing ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> 
                Generating PDF...
              </>
            ) : (
              <>
                <Scissors className="mr-2 h-4 w-4" /> 
                Download Cropped Label
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="flex items-start gap-3 p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 text-[11px] text-indigo-600 dark:text-indigo-400 font-medium leading-relaxed">
        <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
        <p>
          <strong>Vector Integrity Maintained:</strong> This tool modifies the PDF metadata (CropBox) instead of converting to raster. This ensures your barcode and text remain crisp for 100% scan accuracy on thermal printers.
        </p>
      </div>
    </div>
  );
}
