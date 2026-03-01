
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
import { Download, FileUp, AlertCircle, CheckCircle2, Table as TableIcon } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

interface BulkImportModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

type ParsedProduct = {
  sku: string;
  name: string;
  category: string;
  cost_price: number;
  margin: number;
  low_stock_threshold: number;
};

export function BulkImportModal({ isOpen, onClose, onSuccess }: BulkImportModalProps) {
  const { toast } = useToast()
  const [file, setFile] = React.useState<File | null>(null)
  const [isUploading, setIsUploading] = React.useState(false)
  const [uploadProgress, setUploadProgress] = React.useState(0)
  const [previewData, setPreviewData] = React.useState<ParsedProduct[]>([])
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
          sku: headers.indexOf('sku'),
          name: headers.indexOf('name'),
          category: headers.indexOf('category'),
          cost: headers.indexOf('cost price'),
          margin: headers.indexOf('margin'),
          lowStock: headers.indexOf('low stock threshold')
        };

        if (hIdx.sku === -1 || hIdx.name === -1 || hIdx.cost === -1 || hIdx.margin === -1) {
          throw new Error("CSV headers do not match required template. Required: SKU, Name, Cost Price, Margin.");
        }

        const rows = lines.slice(1, 11).map(line => {
          const cols = line.split(',').map(c => c.trim());
          return {
            sku: cols[hIdx.sku],
            name: cols[hIdx.name],
            category: cols[hIdx.category] || 'General',
            cost_price: parseFloat(cols[hIdx.cost]),
            margin: parseFloat(cols[hIdx.margin]),
            low_stock_threshold: cols[hIdx.lowStock] ? parseInt(cols[hIdx.lowStock]) : 5
          };
        });

        setPreviewData(rows as ParsedProduct[]);
      } catch (err: any) {
        toast({ variant: "destructive", title: "Parsing Error", description: err.message });
        setFile(null);
      } finally {
        setIsParsing(false);
      }
    }
  }

  const downloadTemplate = () => {
    const csvContent = "SKU,Name,Category,Cost Price,Margin,Low Stock Threshold\nTS-BLUE-L,Classic Cotton T-Shirt,Apparel,250,150,5\nCS-LIP-RED,Velvet Matte Lipstick,Cosmetics,120,100,10";
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'products_bulk_import_template.csv';
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
        sku: headers.indexOf('sku'),
        name: headers.indexOf('name'),
        category: headers.indexOf('category'),
        cost: headers.indexOf('cost price'),
        margin: headers.indexOf('margin'),
        lowStock: headers.indexOf('low stock threshold')
      };

      const products = lines.slice(1).map(line => {
        const cols = line.split(',').map(c => c.trim());
        return {
          sku: cols[hIdx.sku],
          name: cols[hIdx.name],
          category: cols[hIdx.category] || 'General',
          cost_price: parseFloat(cols[hIdx.cost]),
          margin: parseFloat(cols[hIdx.margin]),
          low_stock_threshold: cols[hIdx.lowStock] ? parseInt(cols[hIdx.lowStock]) : 5
        };
      });

      // Filter out invalid rows before sending
      const validProducts = products.filter(p => p.sku && p.name && !isNaN(p.cost_price) && !isNaN(p.margin));
      
      setUploadProgress(50)

      const res = await apiFetch('/api/products/bulk-import', {
        method: 'POST',
        body: JSON.stringify({ products: validProducts }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to process batch import.");
      }

      const result = await res.json();
      setUploadProgress(100)

      toast({
        title: "Import Success",
        description: `${result.inserted} inserted, ${result.updated} updated successfully.`,
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
            Bulk Product Import
          </DialogTitle>
          <DialogDescription>
            Upload a CSV file to add or update multiple products at once. Pricing is automatically calculated.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="flex justify-between items-center p-4 bg-muted/30 rounded-xl border border-dashed">
            <div className="space-y-1">
              <p className="text-sm font-bold">Import Template</p>
              <p className="text-[10px] text-muted-foreground uppercase font-black">6 Columns Required</p>
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
                  {previewData.length} rows detected
                </Badge>
              </div>
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="text-[10px] font-bold h-8">SKU</TableHead>
                      <TableHead className="text-[10px] font-bold h-8">NAME</TableHead>
                      <TableHead className="text-[10px] font-bold h-8 text-right">COST</TableHead>
                      <TableHead className="text-[10px] font-bold h-8 text-right">MARGIN</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewData.map((row, i) => (
                      <TableRow key={i} className="h-8">
                        <TableCell className="py-1 text-[11px] font-mono">{row.sku}</TableCell>
                        <TableCell className="py-1 text-[11px] truncate max-w-[150px]">{row.name}</TableCell>
                        <TableCell className="py-1 text-[11px] text-right">{row.cost_price}</TableCell>
                        <TableCell className="py-1 text-[11px] text-right">{row.margin}</TableCell>
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
