
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
import { Download, FileUp, AlertCircle, CheckCircle2 } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"

interface BulkUploadProductsModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function BulkUploadProductsModal({ isOpen, onClose, onSuccess }: BulkUploadProductsModalProps) {
  const { toast } = useToast()
  const [file, setFile] = React.useState<File | null>(null)
  const [isUploading, setIsUploading] = React.useState(false)
  const [uploadProgress, setUploadProgress] = React.useState(0)
  const [result, setResult] = React.useState<any | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
      setResult(null)
    }
  }

  const downloadSample = () => {
    const csvContent = "SKU,Product Name,Category,Cost Price,Margin,Low Stock Threshold\nTS-BLUE-L,Classic Cotton T-Shirt,Apparel,250,150,5\nCS-LIP-RED,Velvet Matte Lipstick,Cosmetics,120,100,10";
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'products_bulk_template.csv';
    a.click();
  }

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true)
    setUploadProgress(30)
    
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(line => line !== "");
      
      if (lines.length < 2) {
        throw new Error("CSV file is empty or missing data rows.");
      }

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      
      // Expected Headers: sku, product name, category, cost price, margin, low stock threshold
      const hIdx = {
        sku: headers.indexOf('sku'),
        name: headers.indexOf('product name'),
        category: headers.indexOf('category'),
        cost: headers.indexOf('cost price'),
        margin: headers.indexOf('margin'),
        lowStock: headers.indexOf('low stock threshold')
      };

      if (hIdx.sku === -1 || hIdx.name === -1 || hIdx.cost === -1 || hIdx.margin === -1) {
        throw new Error("CSV structure invalid. Ensure columns match template exactly: SKU, Product Name, Category, Cost Price, Margin, Low Stock Threshold");
      }

      const rows = lines.slice(1).map(line => {
        const cols = line.split(',').map(c => c.trim());
        return {
          sku: cols[hIdx.sku],
          product_name: cols[hIdx.name],
          category: cols[hIdx.category],
          cost_price: parseFloat(cols[hIdx.cost]),
          margin: parseFloat(cols[hIdx.margin]),
          low_stock_threshold: cols[hIdx.lowStock] ? parseInt(cols[hIdx.lowStock]) : 5
        };
      });

      // Basic frontend validation
      const invalidRows = rows.filter(r => !r.sku || !r.product_name || isNaN(r.cost_price) || isNaN(r.margin));
      if (invalidRows.length > 0) {
        throw new Error(`Found ${invalidRows.length} rows with missing or invalid data. Please check SKU, Name, and Price columns.`);
      }

      // Check for duplicate SKUs within the CSV itself
      const skus = rows.map(r => r.sku.toUpperCase());
      const hasDuplicates = skus.some((s, idx) => skus.indexOf(s) !== idx);
      if (hasDuplicates) {
        throw new Error("CSV contains duplicate SKUs. Each product must have a unique identifier.");
      }

      setUploadProgress(60)

      const res = await apiFetch('/api/products/bulk-upload', {
        method: 'POST',
        body: JSON.stringify({ products: rows }),
      });

      setUploadProgress(100)
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.message || data.error || "Upload failed");
      }

      setResult(data)
      if (data.inserted > 0) {
        onSuccess()
        toast({
          title: "Import Complete",
          description: `Successfully added ${data.inserted} products.`,
        })
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      })
    } finally {
      setIsUploading(false)
    }
  }

  const handleClose = () => {
    if (!isUploading) {
      setFile(null)
      setResult(null)
      setUploadProgress(0)
      onClose()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Bulk Product Import</DialogTitle>
          <DialogDescription>
            Upload a CSV file to add multiple products at once. Pricing will be auto-calculated.
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="space-y-6 py-4">
            <div className="flex justify-between items-center p-4 bg-muted/50 rounded-xl border">
              <div className="space-y-1">
                <p className="text-sm font-bold">CSV Template</p>
                <p className="text-xs text-muted-foreground">Download template to ensure correct format.</p>
              </div>
              <Button variant="outline" size="sm" onClick={downloadSample}>
                <Download className="mr-2 h-4 w-4" /> Download
              </Button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Select CSV File</label>
              <Input 
                type="file" 
                accept=".csv" 
                onChange={handleFileChange} 
                className="cursor-pointer"
                disabled={isUploading}
              />
            </div>

            {isUploading && (
              <div className="space-y-2">
                <Progress value={uploadProgress} className="h-2" />
                <p className="text-[10px] text-center text-muted-foreground animate-pulse">Analyzing and inserting records...</p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400">
                <p className="text-xs font-bold uppercase text-center">Successful</p>
                <p className="text-3xl font-black text-center">{result.inserted}</p>
              </div>
              <div className="p-4 rounded-xl border bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400">
                <p className="text-xs font-bold uppercase text-center">Skipped</p>
                <p className="text-3xl font-black text-center">{result.skipped}</p>
              </div>
            </div>

            {result.errors && result.errors.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase text-muted-foreground ml-1">Error Log</p>
                <ScrollArea className="h-48 rounded-xl border bg-muted/30 p-4">
                  <ul className="space-y-2">
                    {result.errors.map((err: string, idx: number) => (
                      <li key={idx} className="text-[11px] flex gap-2 text-destructive">
                        <AlertCircle className="h-3 w-3 shrink-0 mt-0.5" />
                        <span>{err}</span>
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isUploading}>
            {result ? "Close" : "Cancel"}
          </Button>
          {!result && (
            <Button onClick={handleUpload} disabled={!file || isUploading}>
              <FileUp className="mr-2 h-4 w-4" />
              {isUploading ? "Uploading..." : "Start Import"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
