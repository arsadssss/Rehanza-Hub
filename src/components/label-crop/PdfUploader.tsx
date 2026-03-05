
"use client";

import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { FileUp, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PdfUploaderProps {
  onFileSelect: (file: File) => void;
}

export function PdfUploader({ onFileSelect }: PdfUploaderProps) {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      onFileSelect(acceptedFiles[0]);
    }
  }, [onFileSelect]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    multiple: false
  });

  return (
    <div 
      {...getRootProps()} 
      className={cn(
        "relative group cursor-pointer border-2 border-dashed rounded-[2rem] p-12 transition-all duration-300 flex flex-col items-center justify-center text-center gap-4",
        isDragActive ? "border-primary bg-primary/5 scale-[0.99]" : "border-muted-foreground/20 hover:border-primary/40 hover:bg-primary/5"
      )}
    >
      <input {...getInputProps()} />
      <div className="p-6 bg-primary/10 rounded-full group-hover:scale-110 transition-transform duration-500">
        <FileUp className="h-10 w-10 text-primary" />
      </div>
      <div>
        <h3 className="text-lg font-headline font-bold">Select Shipping Label</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Drag and drop your PDF here, or click to browse
        </p>
        <p className="text-[10px] text-muted-foreground mt-4 uppercase font-black tracking-widest opacity-50">
          Max File Size: 10MB | Format: PDF
        </p>
      </div>
    </div>
  );
}
