'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/apiFetch';
import { formatINR } from '@/lib/format';
import { PackagePlus, Loader2, ArrowRight, Building2, MapPin, Hash, StickyNote } from 'lucide-react';
import { InventoryItem } from '@/lib/inventory/inventory-service';

interface AddStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: InventoryItem | null;
  vendors: Array<{ id: string; name: string }>;
  onSuccess: () => void;
}

export function AddStockModal({
  isOpen,
  onClose,
  item,
  vendors,
  onSuccess,
}: AddStockModalProps) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const [quantity, setQuantity] = useState<string>('');
  const [costPrice, setCostPrice] = useState<string>('');
  const [supplier, setSupplier] = useState<string>('none');
  const [customSupplier, setCustomSupplier] = useState<string>('');
  const [batchLot, setBatchLot] = useState<string>('');
  const [location, setLocation] = useState<string>('Main Warehouse');
  const [notes, setNotes] = useState<string>('');

  useEffect(() => {
    if (item) {
      setQuantity('');
      setCostPrice(item.costPrice > 0 ? String(item.costPrice) : '');
      setSupplier('none');
      setCustomSupplier('');
      setBatchLot('');
      setLocation(item.location || 'Main Warehouse');
      setNotes('');
    }
  }, [item, isOpen]);

  if (!item) return null;

  const currentAvailable = item.availableQuantity || 0;
  const qtyNumber = parseInt(quantity, 10) || 0;
  const newAvailable = currentAvailable + qtyNumber;
  const costNumber = parseFloat(costPrice) || item.costPrice || 0;
  const batchValue = qtyNumber * costNumber;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quantity || qtyNumber <= 0) {
      toast({
        title: 'Validation Error',
        description: 'Please enter a valid quantity greater than 0.',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    try {
      const effectiveSupplier =
        supplier === 'custom'
          ? customSupplier.trim()
          : supplier !== 'none'
          ? supplier
          : undefined;

      const res = await apiFetch('/api/inventory/stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add',
          mainSku: item.mainSku,
          quantity: qtyNumber,
          costPrice: costPrice !== '' ? costNumber : undefined,
          supplier: effectiveSupplier || null,
          batchLot: batchLot.trim() || null,
          location: location.trim() || 'Main Warehouse',
          notes: notes.trim() || null,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Failed to add stock');
      }

      toast({
        title: 'Stock Added Successfully',
        description: `Added ${qtyNumber} units to ${item.mainSku}. New available stock is ${newAvailable}.`,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      toast({
        title: 'Operation Failed',
        description: err.message || 'Could not add stock.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg bg-slate-900/95 border-white/10 text-white shadow-2xl backdrop-blur-xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <PackagePlus className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold font-headline text-white">
                Add Stock
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                Record new stock arrival into the inventory master
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Product Context Banner */}
        <div className="p-4 rounded-xl bg-slate-800/60 border border-white/10 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-md">
              {item.mainSku}
            </span>
            <Badge variant="outline" className="text-xs bg-slate-800 text-slate-300 border-white/10">
              {item.category || 'General'}
            </Badge>
          </div>
          <p className="text-sm font-semibold text-slate-200 line-clamp-1">{item.productName}</p>
          <div className="flex items-center justify-between text-xs text-slate-400 pt-1 border-t border-white/5">
            <span>Current Available: <strong className="text-white">{currentAvailable} units</strong></span>
            {qtyNumber > 0 && (
              <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
                <span>New Available:</span>
                <span>{currentAvailable}</span>
                <ArrowRight className="h-3 w-3" />
                <span className="text-sm text-emerald-300">{newAvailable}</span>
              </span>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-4">
            {/* Quantity */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-300">
                Quantity to Add <span className="text-rose-400">*</span>
              </Label>
              <Input
                type="number"
                min="1"
                step="1"
                placeholder="e.g. 50"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
                className="bg-slate-950/60 border-white/10 text-white focus-visible:ring-emerald-500/50"
              />
            </div>

            {/* Cost Price */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-300">
                Cost Price (₹ per unit)
              </Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="e.g. 120"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                className="bg-slate-950/60 border-white/10 text-white focus-visible:ring-emerald-500/50"
              />
            </div>
          </div>

          {/* Supplier / Vendor */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-slate-400" /> Supplier / Vendor
            </Label>
            <Select value={supplier} onValueChange={setSupplier}>
              <SelectTrigger className="bg-slate-950/60 border-white/10 text-white">
                <SelectValue placeholder="Select supplier (optional)" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-white/10 text-white">
                <SelectItem value="none">-- None / Unspecified --</SelectItem>
                {vendors.map((v) => (
                  <SelectItem key={v.id} value={v.name}>
                    {v.name}
                  </SelectItem>
                ))}
                <SelectItem value="custom">+ Enter Custom Supplier</SelectItem>
              </SelectContent>
            </Select>

            {supplier === 'custom' && (
              <Input
                placeholder="Enter supplier name..."
                value={customSupplier}
                onChange={(e) => setCustomSupplier(e.target.value)}
                className="mt-2 bg-slate-950/60 border-white/10 text-white"
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Batch / Lot */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Hash className="h-3.5 w-3.5 text-slate-400" /> Batch / Lot #
              </Label>
              <Input
                placeholder="e.g. LOT-2026-03"
                value={batchLot}
                onChange={(e) => setBatchLot(e.target.value)}
                className="bg-slate-950/60 border-white/10 text-white"
              />
            </div>

            {/* Storage Location */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-slate-400" /> Location
              </Label>
              <Input
                placeholder="e.g. Main Warehouse"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="bg-slate-950/60 border-white/10 text-white"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <StickyNote className="h-3.5 w-3.5 text-slate-400" /> Notes / Reference
            </Label>
            <Textarea
              placeholder="e.g. Invoice #9823, PO reference, condition notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="bg-slate-950/60 border-white/10 text-white resize-none text-xs"
            />
          </div>

          {/* Value Calculation Badge */}
          {qtyNumber > 0 && costNumber > 0 && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex justify-between items-center text-xs">
              <span className="text-emerald-300">Added Batch Value:</span>
              <span className="font-bold font-mono text-sm text-emerald-400">
                {formatINR(batchValue)}
              </span>
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={submitting}
              className="text-slate-400 hover:text-white hover:bg-white/5"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting || qtyNumber <= 0}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Recording...
                </>
              ) : (
                'Add to Stock'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

