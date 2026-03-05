
"use client";

import React, { useEffect, useState } from 'react';
import * as pdfjs from 'pdfjs-dist';

// Set worker via unpkg for stability in browser
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfCanvasViewerProps {
  file: File;
  onMetaChange: (meta: { width: number; height: number; canvasWidth: number; canvasHeight: number }) => void;
  zoom: number;
  children?: React.ReactNode;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}

/**
 * PdfCanvasViewer - Renders PDF once and applies zoom via CSS transform to prevent blinking.
 */
function PdfCanvasViewer({ file, onMetaChange, zoom, children, canvasRef }: PdfCanvasViewerProps) {
  const [isRendered, setIsRendered] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function renderPage() {
      setIsRendered(false);
      try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
        const page = await pdf.getPage(1);
        
        // Render at a high-quality fixed scale (1.5)
        const baseScale = 1.5;
        const viewport = page.getViewport({ scale: baseScale });
        const canvas = canvasRef.current;
        if (!canvas || !isMounted) return;

        const context = canvas.getContext('2d', { alpha: false });
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
          setIsRendered(true);
        }
      } catch (error) {
        console.error("PDF Render Error:", error);
      }
    }

    renderPage();
    return () => { isMounted = false; };
  }, [file, onMetaChange, canvasRef]); // Only re-render if the file itself changes

  return (
    <div 
      className="relative shadow-[0_0_100px_rgba(0,0,0,0.5)] bg-white transition-transform duration-100 ease-out"
      style={{ 
        transform: `scale(${zoom})`,
        transformOrigin: 'top center'
      }}
    >
      <canvas ref={canvasRef} className="block" />
      {isRendered && children}
    </div>
  );
}

export const PdfCanvasViewerMemo = React.memo(PdfCanvasViewer);
