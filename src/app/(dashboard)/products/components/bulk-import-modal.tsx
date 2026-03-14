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
import * as XLSX from 'xlsx'

interface BulkImportModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function BulkImportModal({ isOpen, onClose, onSuccess }: BulkImportModalProps) {
  const { toast } = useToast()
  const [file, setFile] = React.useState<File | null>(null)
  const [isUploading, setIsUploading] = React.useState(false)
  const [uploadProgress, setUploadProgress] = React.useState(0)
  const [previewData, setPreviewData] = React.useState<any[]>([])
  const [isParsing, setIsParsing] = React.useState(false)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile)
      
      setIsParsing(true)
      try {
        const reader = new FileReader();
        reader.onload = (evt) => {
          const bstr = evt.target?.result;
          const wb = XLSX.read(bstr, { type: 'binary' });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const data = XLSX.utils.sheet_to_json(ws);
          
          if (data.length === 0) {
            toast({ variant: "destructive", title: "Error", description: "File is empty." });
            setFile(null);
            return;
          }

          // Basic validation of required columns
          const firstRow = data[0] as any;
          const requiredKeys = ['sku', 'product_name'];
          // Normalize keys (lowercase and replace spaces with underscores) to match requiredKeys
          const keys = Object.keys(firstRow).map(k => k.toLowerCase().replace(/\s+/g, '_'));
          
          const hasRequired = requiredKeys.every(rk => keys.includes(rk));
          if (!hasRequired) {
            toast({ 
              variant: "destructive", 
              title: "Invalid Columns", 
              description: "Sheet must contain at least 'SKU' and 'Product Name' columns." 
            });
            setFile(null);
            setPreviewData([]);
            return;
          }

          setPreviewData(data.slice(0, 5));
        };
        reader.readAsBinaryString(selectedFile);
      } catch (err: any) {
        toast({ variant: "destructive", title: "Parsing Error", description: err.message });
        setFile(null);
      } finally {
        setIsParsing(false);
      }
    }
  }

  const downloadTemplate = () => {
    const templateData = [
      {
        "SKU": "TS-BLUE-L",
        "Product Name": "Classic Cotton T-Shirt",
        "Category": "Apparel",
        "Cost Price": 250,
        "Margin": 150,
        "Promo Ads": 30,
        "Tax Other": 10,
        "Packing": 10,
        "Amazon Ship": 80,
        "Flipkart Ship": 80,
        "Platform Fee": 8,
        "Low Stock Threshold": 5
      }
    ];
    
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "rehanza_bulk_import_template.xlsx");
  }

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true)
    setUploadProgress(20)
    
    try {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rawProducts = XLSX.utils.sheet_to_json(ws);

        // Normalize keys to snake_case for the API
        const products = rawProducts.map((p: any) => {
          const normalized: any = {};
          Object.keys(p).forEach(key => {
            const normalizedKey = key.toLowerCase().replace(/\s+/g, '_');
            normalized[normalizedKey] = p[key];
          });
          return normalized;
        });

        setUploadProgress(50)

        const res = await apiFetch('/api/products/bulk-import', {
          method: 'POST',
          body: JSON.stringify({ products }),
        });

        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.message || "Failed to process import.");
        }

        const result = await res.json();
        setUploadProgress(100)

        toast({
          title: "Import Success",
          description: `Inserted: ${result.inserted} | Updated: ${result.updated}`,
        })
        onSuccess()
        handleClose()
      };
      reader.readAsBinaryString(file);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Upload Failed",
        description: error.message,
      })
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
            Bulk Product Registry Import
          </DialogTitle>
          <DialogDescription>
            Upload an Excel or CSV file to add or update products. Existing SKUs will be updated with new values.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="flex justify-between items-center p-4 bg-muted/30 rounded-xl border border-dashed">
            <div className="space-y-1">
              <p className="text-sm font-bold">Standard Excel Template</p>
              <p className="text-[10px] text-muted-foreground uppercase font-black">All pricing fields supported</p>
            </div>
            <Button variant="outline" size="sm" onClick={downloadTemplate} className="h-8 text-xs font-bold">
              <Download className="mr-2 h-3.5 w-3.5" /> Download Template
            </Button>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground ml-1">Select File (.xlsx, .csv)</label>
            <Input 
              type="file" 
              accept=".csv, .xlsx, .xls" 
              onChange={handleFileChange} 
              className="cursor-pointer bg-muted/20"
              disabled={isUploading || isParsing}
            />
          </div>

          {previewData.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1.5">
                  <TableIcon className="h-3 w-3" /> Data Preview (Top Rows)
                </p>
                <Badge variant="secondary" className="text-[10px] uppercase font-black tracking-tighter">
                  Format verified
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
                        <TableCell className="py-1 text-[11px] font-mono">{row.SKU || row.sku}</TableCell>
                        <TableCell className="py-1 text-[11px] truncate max-w-[150px]">{row['Product Name'] || row.product_name}</TableCell>
                        <TableCell className="py-1 text-[11px] text-right">{row['Cost Price'] || row.cost_price}</TableCell>
                        <TableCell className="py-1 text-[11px] text-right">{row['Margin'] || row.margin}</TableCell>
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
                Updating Product Database...
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
            {isUploading ? "Processing..." : "Start Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
