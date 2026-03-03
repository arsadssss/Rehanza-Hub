
"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Image as ImageIcon, Upload, Download, Sparkles, RefreshCcw, AlertCircle, Grid, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ImageToolPage() {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [variants, setVariants] = useState<string[]>([]);
  const [options, setOptions] = useState({
    addBorder: true,
    addIcon: false,
  });

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
      setVariants([]); 
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
        throw new Error(errorData.error || 'Failed to process images');
      }

      const data = await response.json();
      setVariants(data.images);
      
      toast({
        title: 'Normalization Complete',
        description: `Generated 10 unique branded variants at 1118x1630.`,
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

  const handleDownload = (dataUrl: string, index: number) => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `rehanza-variant-${index + 1}-${new Date().getTime()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const reset = () => {
    setFile(null);
    setVariants([]);
    setOptions({ addBorder: true, addIcon: false });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 font-body">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight font-headline text-foreground flex items-center gap-2">
          <ImageIcon className="h-8 w-8 text-primary" />
          Image Intelligence
        </h1>
        <p className="text-muted-foreground text-sm font-medium">
          Normalize product photography into 10 unique branded templates instantly.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Controls Section */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="shadow-xl border-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-[2rem] overflow-hidden sticky top-6">
            <CardHeader>
              <CardTitle className="text-lg font-headline flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" />
                Settings
              </CardTitle>
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
                  <p className="text-sm font-bold truncate max-w-[200px]">{file ? file.name : "Select Image"}</p>
                  <p className="text-[10px] text-muted-foreground mt-1 uppercase font-black tracking-tighter">JPG, PNG, WEBP (Max 15MB)</p>
                </div>
              </div>

              {/* Toggles */}
              <div className="grid grid-cols-1 gap-3">
                <div className="flex items-center justify-between p-4 rounded-2xl bg-gray-100/50 dark:bg-white/5 border border-transparent">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-bold uppercase tracking-widest">Branded Borders</Label>
                    <p className="text-[10px] text-muted-foreground">Generate 10 color variants</p>
                  </div>
                  <Switch 
                    checked={options.addBorder} 
                    onCheckedChange={(val) => setOptions(prev => ({ ...prev, addBorder: val }))} 
                  />
                </div>

                <div className="flex items-center justify-between p-4 rounded-2xl bg-gray-100/50 dark:bg-white/5 border border-transparent">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-bold uppercase tracking-widest">Icon Positions</Label>
                    <p className="text-[10px] text-muted-foreground">Apply 10 dynamic placements</p>
                  </div>
                  <Switch 
                    checked={options.addIcon} 
                    onCheckedChange={(val) => setOptions(prev => ({ ...prev, addIcon: val }))} 
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3 pt-2">
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
                      <Sparkles className="h-4 w-4 animate-spin" /> ...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Grid className="h-4 w-4" /> Generate
                    </span>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="p-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 flex gap-3 text-[11px] leading-relaxed text-amber-700 dark:text-amber-400 font-medium">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <p>
              Processing generates 10 high-resolution variants simultaneously. 
              Images are temporary and only exist in your current session.
            </p>
          </div>
        </div>

        {/* Results Section */}
        <div className="lg:col-span-8">
          {variants.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
              {variants.map((img, idx) => (
                <Card key={idx} className="group overflow-hidden border-0 shadow-lg bg-white dark:bg-slate-900 rounded-2xl">
                  <div className="aspect-[1118/1630] relative bg-muted">
                    <img 
                      src={img} 
                      alt={`Variant ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-4">
                      <Button 
                        size="sm" 
                        variant="secondary"
                        className="w-full font-black text-[10px] uppercase tracking-tighter"
                        onClick={() => handleDownload(img, idx)}
                      >
                        <Download className="mr-1.5 h-3 w-3" /> Save Jpeg
                      </Button>
                    </div>
                    <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-full text-white text-[8px] font-black uppercase">
                      v.{idx + 1}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="h-full min-h-[600px] shadow-2xl border-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-[2rem] flex flex-col items-center justify-center text-center p-12">
              <div className="p-8 bg-muted rounded-full mb-6">
                <ImageIcon className="h-16 w-16 text-muted-foreground opacity-20" />
              </div>
              <h3 className="text-xl font-headline font-bold text-foreground">No Variants Generated</h3>
              <p className="text-sm text-muted-foreground max-w-md mt-2">
                Upload a product image and click generate to see 10 unique branded templates here.
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
