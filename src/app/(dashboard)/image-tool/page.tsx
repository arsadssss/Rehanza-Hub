
"use client";

import React, { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Image as ImageIcon, Upload, Download, Sparkles, RefreshCcw, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ImageToolPage() {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [options, setOptions] = useState({
    addBorder: false,
    addIcon: false,
  });

  // Cleanup object URL to prevent memory leaks
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.size > 15 * 1024 * 1024) {
        toast({
          variant: 'destructive',
          title: 'File too large',
          description: 'Maximum allowed size is 15MB.',
        });
        return;
      }
      setFile(selectedFile);
      setPreviewUrl(null); // Reset preview when new file is chosen
    }
  };

  const handleGenerate = async () => {
    if (!file) return;

    setIsProcessing(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('addBorder', String(options.addBorder));
      formData.append('addIcon', String(options.addIcon));

      const response = await fetch('/api/process-image', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to process image');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(url);
      
      toast({
        title: 'Normalization Complete',
        description: 'Your image has been optimized and resized to 1118x1630.',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!previewUrl) return;
    const link = document.createElement('a');
    link.href = previewUrl;
    link.download = `rehanza-normalized-${new Date().getTime()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const reset = () => {
    setFile(null);
    setPreviewUrl(null);
    setOptions({ addBorder: false, addIcon: false });
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8 font-body">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight font-headline text-foreground flex items-center gap-2">
          <ImageIcon className="h-8 w-8 text-primary" />
          Image Intelligence
        </h1>
        <p className="text-muted-foreground text-sm font-medium">
          Normalize product photography to standard 1118x1630 templates instantly.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Controls Section */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="shadow-xl border-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-[2rem] overflow-hidden">
            <CardHeader>
              <CardTitle className="text-lg font-headline">Normalization Settings</CardTitle>
              <CardDescription>Upload a raw product shot to begin.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Upload Box */}
              <div 
                className={cn(
                  "relative border-2 border-dashed rounded-[1.5rem] p-8 transition-all flex flex-col items-center justify-center text-center gap-4 cursor-pointer hover:bg-primary/5",
                  file ? "border-primary bg-primary/5" : "border-muted-foreground/20"
                )}
                onClick={() => document.getElementById('file-upload')?.click()}
              >
                <input 
                  id="file-upload" 
                  type="file" 
                  className="hidden" 
                  accept=".jpg,.jpeg,.png,.webp" 
                  onChange={handleFileChange}
                />
                <div className="p-4 bg-primary/10 rounded-full">
                  <Upload className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-bold">{file ? file.name : "Click to select image"}</p>
                  <p className="text-xs text-muted-foreground mt-1">Supports JPG, PNG, WEBP (Max 15MB)</p>
                </div>
              </div>

              {/* Toggles */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between p-4 rounded-2xl bg-gray-100/50 dark:bg-white/5 border border-transparent">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-bold uppercase tracking-widest">Brand Border</Label>
                    <p className="text-[10px] text-muted-foreground">Add template border overlay</p>
                  </div>
                  <Switch 
                    checked={options.addBorder} 
                    onCheckedChange={(val) => setOptions(prev => ({ ...prev, addBorder: val }))} 
                  />
                </div>

                <div className="flex items-center justify-between p-4 rounded-2xl bg-gray-100/50 dark:bg-white/5 border border-transparent">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-bold uppercase tracking-widest">Template Icon</Label>
                    <p className="text-[10px] text-muted-foreground">Apply standard branding icons</p>
                  </div>
                  <Switch 
                    checked={options.addIcon} 
                    onCheckedChange={(val) => setOptions(prev => ({ ...prev, addIcon: val }))} 
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3 pt-4">
                <Button 
                  variant="outline" 
                  onClick={reset} 
                  className="rounded-xl h-12 font-bold"
                  disabled={!file || isProcessing}
                >
                  <RefreshCcw className="mr-2 h-4 w-4" /> Reset
                </Button>
                <Button 
                  onClick={handleGenerate} 
                  className="rounded-xl h-12 font-bold shadow-lg shadow-primary/20"
                  disabled={!file || isProcessing}
                >
                  {isProcessing ? (
                    <span className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 animate-spin" /> Processing...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4" /> Generate
                    </span>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="p-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 flex gap-3 text-[11px] leading-relaxed text-amber-700 dark:text-amber-400 font-medium">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <p>
              Output is strictly normalized to 1118x1630 (96 DPI) for marketplace compatibility. 
              Images are processed in RAM and destroyed upon refresh.
            </p>
          </div>
        </div>

        {/* Preview Section */}
        <div className="lg:col-span-7">
          <Card className="h-full shadow-2xl border-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-[2rem] overflow-hidden flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg font-headline">Live Preview</CardTitle>
                <CardDescription>Processed output visualization</CardDescription>
              </div>
              {previewUrl && (
                <Button 
                  size="sm" 
                  onClick={handleDownload}
                  className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[10px] tracking-widest px-6"
                >
                  <Download className="mr-2 h-3 w-3" /> Download Result
                </Button>
              )}
            </CardHeader>
            <CardContent className="flex-1 flex items-center justify-center p-8 bg-muted/30">
              <div className="relative w-full max-w-[400px] aspect-[1118/1630] bg-white shadow-inner rounded-md overflow-hidden border border-border/50 group">
                {previewUrl ? (
                  <img 
                    src={previewUrl} 
                    alt="Processed Preview" 
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground opacity-30 gap-4">
                    <ImageIcon className="h-16 w-16" />
                    <p className="text-xs font-bold uppercase tracking-widest">No preview available</p>
                  </div>
                )}
                
                {/* Dimensions Badge */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 bg-black/60 backdrop-blur-md text-white text-[9px] font-black rounded-full tracking-tighter uppercase opacity-0 group-hover:opacity-100 transition-opacity">
                  Standard Resolution: 1118 x 1630
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
