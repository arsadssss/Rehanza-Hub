
"use client";

import React, { useEffect, useRef, useState } from 'react';
import * as pdfjs from 'pdfjs-dist';
import { CropOverlay } from './CropOverlay';

// Set worker via unpkg for stability in browser
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfCanvasViewerProps {
  file: File;
  zoom: number;
  cropBox: { x: number; y: number; width: number; height: number };
  onCropChange: (box: { x: number; y: number; width: number; height: number }) => void;
  onMetaChange: (meta: { width: number; height: number; canvasWidth: number; canvasHeight: number }) => void;
}

export function PdfCanvasViewer({ file, zoom, cropBox, onCropChange, onMetaChange }: PdfCanvasViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function renderPage() {
      setLoading(true);
      try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
        const page = await pdf.getPage(1);
        
        const viewport = page.getViewport({ scale: zoom });
        const canvas = canvasRef.current;
        if (!canvas || !isMounted) return;

        const context = canvas.getContext('2d');
        if (!context) return;

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({ canvasContext: context, viewport }).promise;

        if (isMounted) {
          onMetaChange({
            width: page.view[2] - page.view[0], // Original PDF points
            height: page.view[3] - page.view[1],
            canvasWidth: viewport.width,
            canvasHeight: viewport.height
          });
          setLoading(false);
        }
      } catch (error) {
        console.error("PDF Render Error:", error);
      }
    }

    renderPage();
    return () => { isMounted = false; };
  }, [file, zoom, onMetaChange]);

  return (
    <div className="relative shadow-[0_0_100px_rgba(0,0,0,0.5)] bg-white">
      <canvas ref={canvasRef} className="block" />
      {!loading && (
        <CropOverlay 
          x={cropBox.x} 
          y={cropBox.y} 
          width={cropBox.width} 
          height={cropBox.height} 
          onUpdate={onCropChange}
        />
      )}
    </div>
  );
}
