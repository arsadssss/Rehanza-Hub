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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { ScrollArea } from "@/components/ui/scroll-area"

interface BulkUploadModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function BulkUploadModal({ isOpen, onClose, onSuccess }: BulkUploadModalProps) {
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
    const csvContent = "external_order_id,order_date,platform,variant_sku,quantity,selling_price\nORD-WH-101,2024-08-01,Amazon,SKU-SAMPLE-RED,2,499\nORD-WH-102,2024-08-01,Meesho,SKU-SAMPLE-BLUE,1,299";
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'orders_import_template.csv';
    a.click();
  }

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true)
    setUploadProgress(30)
    
    try {
      const formData = new FormData()
      formData.append('file', file)

      // apiFetch automatically handles the x-account-id and FormData boundaries correctly now
      const res = await apiFetch('/api/orders/bulk-upload', {
        method: 'POST',
        body: formData,
      });

      setUploadProgress(100)
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || data.details || "Upload failed")
      }

      setResult(data)
      if (data.inserted > 0) {
        onSuccess()
        toast({
          title: "Import Complete",
          description: `Successfully processed ${data.inserted} orders.`,
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
          <DialogTitle>Bulk Import Orders</DialogTitle>
          <DialogDescription>
            Upload a CSV file to import multiple orders. Stock will be auto-deducted per row.
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="space-y-6 py-4">
            <div className="flex justify-between items-center p-4 bg-muted/50 rounded-xl border">
              <div className="space-y-1">
                <p className="text-sm font-bold">Standard Template</p>
                <p className="text-xs text-muted-foreground">Ensure columns match exactly.</p>
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
                <p className="text-[10px] text-center text-muted-foreground animate-pulse">Processing database transactions...</p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400">
                <p className="text-xs font-bold uppercase">Success</p>
                <p className="text-3xl font-black">{result.inserted}</p>
              </div>
              <div className="p-4 rounded-xl border bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400">
                <p className="text-xs font-bold uppercase">Skipped</p>
                <p className="text-3xl font-black">{result.skipped}</p>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase text-muted-foreground ml-1">Error Details</p>
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
