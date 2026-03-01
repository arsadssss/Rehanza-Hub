
"use client"

import * as React from "react"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { apiFetch } from "@/lib/apiFetch"
import { Download, FileUp, CheckCircle2, Table as TableIcon } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

interface BulkImportVariantsModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

type ParsedVariant = {
  product_sku: string;
  variant_sku: string;
  color: string;
  size: string;
  stock: number;
};

export function BulkImportVariantsModal({ isOpen, onClose, onSuccess }: BulkImportVariantsModalProps) {
  const { toast } = useToast()
  const [file, setFile] = React.useState<File | null>(null)
  const [isUploading, setIsUploading] = React.useState(false)
  const [uploadProgress, setUploadProgress] = React.useState(0)
  const [previewData, setPreviewData] = React.useState<ParsedVariant[]>([])
  const [isParsing, setIsParsing] = React.useState(false)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile)
      
      setIsParsing(true)
      try {
        const text = await selectedFile.text();
        const lines = text.split(/\r?\n/).map(l => l.trim()).filter(line => line !== "");
        
        if (lines.length < 2) throw new Error("File is empty or missing data.");

        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        
        const hIdx = {
          productSku: headers.indexOf('product sku'),
          variantSku: headers.indexOf('variant sku'),
          color: headers.indexOf('color'),
          size: headers.indexOf('size'),
          stock: headers.indexOf('stock')
        };

        if (hIdx.productSku === -1 || hIdx.variantSku === -1 || hIdx.stock === -1) {
          throw new Error("CSV headers do not match template. Required: Product SKU, Variant SKU, Color, Size, Stock");
        }

        const rows = lines.slice(1).map(line => {
          const cols = line.split(',').map(c => c.trim());
          if (cols.length < 3) return null;
          
          return {
            product_sku: cols[hIdx.productSku],
            variant_sku: cols[hIdx.variantSku],
            color: cols[hIdx.color] || '',
            size: cols[hIdx.size] || '',
            stock: parseInt(cols[hIdx.stock]) || 0
          };
        }).filter(row => row !== null && row.variant_sku !== "");

        setPreviewData(rows.slice(0, 10) as ParsedVariant[]);
      } catch (err: any) {
        toast({ variant: "destructive", title: "Parsing Error", description: err.message });
        setFile(null);
      } finally {
        setIsParsing(false);
      }
    }
  }

  const downloadTemplate = () => {
    const csvContent = "Product SKU,Variant SKU,Color,Size,Stock\nNP12A-12,NP12A-12-BLUE-M,Blue,M,50\nNP12A-12,NP12A-12-RED-L,Red,L,25";
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'inventory_variants_template.csv';
    a.click();
  }

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true)
    setUploadProgress(20)
    
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(line => line !== "");
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      
      const hIdx = {
        productSku: headers.indexOf('product sku'),
        variantSku: headers.indexOf('variant sku'),
        color: headers.indexOf('color'),
        size: headers.indexOf('size'),
        stock: headers.indexOf('stock')
      };

      const variants = lines.slice(1).map(line => {
        const cols = line.split(',').map(c => c.trim());
        if (cols.length < 3) return null;
        
        return {
          product_sku: cols[hIdx.productSku],
          variant_sku: cols[hIdx.variantSku],
          color: cols[hIdx.color] || '',
          size: cols[hIdx.size] || '',
          stock: parseInt(cols[hIdx.stock]) || 0
        };
      }).filter(v => v && v.product_sku && v.variant_sku);

      // Internal duplicate check
      const skus = variants.map(v => v!.variant_sku.toUpperCase());
      if (new Set(skus).size !== skus.length) {
        throw new Error("CSV contains duplicate Variant SKUs. Each row must be unique.");
      }
      
      setUploadProgress(50)

      const res = await apiFetch('/api/variants/bulk-import', {
        method: 'POST',
        body: JSON.stringify({ variants }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to process variant import.");
      }

      const result = await res.json();
      setUploadProgress(100)

      toast({
        title: "Import Success",
        description: `Inserted: ${result.inserted} | Updated: ${result.updated} ${result.invalid_product_sku > 0 ? `| Skipped: ${result.invalid_product_sku} invalid products` : ''}`,
      })
      onSuccess()
      handleClose()
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Upload Failed",
        description: error.message,
      })
    } finally {
      setIsUploading(false)
    }
  }

  const handleClose = () => {
    if (!isUploading) {
      setFile(null)
      setPreviewData([])
      setUploadProgress(0)
      onClose()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileUp className="h-5 w-5 text-primary" />
            Bulk Variant Upload (Inventory)
          </DialogTitle>
          <DialogDescription>
            Import stock levels and variants. Automatically links to products by SKU.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="flex justify-between items-center p-4 bg-muted/30 rounded-xl border border-dashed">
            <div className="space-y-1">
              <p className="text-sm font-bold">CSV Template</p>
              <p className="text-[10px] text-muted-foreground uppercase font-black">5 Columns Required</p>
            </div>
            <Button variant="outline" size="sm" onClick={downloadTemplate} className="h-8 text-xs font-bold">
              <Download className="mr-2 h-3.5 w-3.5" /> Download Template
            </Button>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground ml-1">Select CSV File</label>
            <Input 
              type="file" 
              accept=".csv" 
              onChange={handleFileChange} 
              className="cursor-pointer bg-muted/20"
              disabled={isUploading || isParsing}
            />
          </div>

          {previewData.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1.5">
                  <TableIcon className="h-3 w-3" /> Data Preview (First 10 Rows)
                </p>
                <Badge variant="secondary" className="text-[10px] uppercase font-black tracking-tighter">
                  Verified format
                </Badge>
              </div>
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="text-[10px] font-bold h-8">PRODUCT SKU</TableHead>
                      <TableHead className="text-[10px] font-bold h-8">VARIANT SKU</TableHead>
                      <TableHead className="text-[10px] font-bold h-8">COLOR/SIZE</TableHead>
                      <TableHead className="text-[10px] font-bold h-8 text-right">STOCK</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewData.map((row, i) => (
                      <TableRow key={i} className="h-8">
                        <TableCell className="py-1 text-[11px] font-mono">{row.product_sku}</TableCell>
                        <TableCell className="py-1 text-[11px] font-mono text-primary font-bold">{row.variant_sku}</TableCell>
                        <TableCell className="py-1 text-[11px] italic">{row.color || '-'} / {row.size || '-'}</TableCell>
                        <TableCell className="py-1 text-[11px] text-right font-bold">{row.stock}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {isUploading && (
            <div className="space-y-2">
              <Progress value={uploadProgress} className="h-1.5" />
              <p className="text-[10px] text-center text-muted-foreground animate-pulse font-bold uppercase tracking-widest">
                Processing Transaction...
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose} disabled={isUploading} className="font-bold">
            Cancel
          </Button>
          <Button onClick={handleUpload} disabled={!file || isUploading || isParsing} className="font-bold">
            <CheckCircle2 className="mr-2 h-4 w-4" /> 
            {isUploading ? "Importing..." : "Start Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
