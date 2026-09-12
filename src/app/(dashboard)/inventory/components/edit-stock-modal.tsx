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
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/apiFetch';
import { formatINR } from '@/lib/format';
import { Edit, Loader2, ArrowRight, MapPin, StickyNote, HelpCircle, Layers, BellRing, DollarSign } from 'lucide-react';
import { InventoryItem } from '@/lib/inventory/inventory-service';

interface EditStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: InventoryItem | null;
  onSuccess: () => void;
}

export function EditStockModal({
  isOpen,
  onClose,
  item,
  onSuccess,
}: EditStockModalProps) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const [availableQuantity, setAvailableQuantity] = useState<string>('');
  const [reservedQuantity, setReservedQuantity] = useState<string>('');
  const [reorderLevel, setReorderLevel] = useState<string>('');
  const [costPrice, setCostPrice] = useState<string>('');
  const [location, setLocation] = useState<string>('Main Warehouse');
  const [reason, setReason] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  useEffect(() => {
    if (item) {
      setAvailableQuantity(String(item.availableQuantity ?? 0));
      setReservedQuantity(String(item.reservedQuantity ?? 0));
      setReorderLevel(String(item.reorderLevel ?? 10));
      setCostPrice(item.costPrice > 0 ? String(item.costPrice) : '');
      setLocation(item.location || 'Main Warehouse');
      setReason('');
      setNotes('');
    }
  }, [item, isOpen]);

  if (!item) return null;

  const currentAvailable = item.availableQuantity ?? 0;
  const currentReserved = item.reservedQuantity ?? 0;
  const currentCost = item.costPrice ?? 0;

  const newAvailable = parseInt(availableQuantity, 10);
  const newReserved = parseInt(reservedQuantity, 10);
  const newReorder = parseInt(reorderLevel, 10);
  const newCost = costPrice !== '' ? parseFloat(costPrice) : currentCost;

  const isAvailableChanged = !isNaN(newAvailable) && newAvailable !== currentAvailable;
  const delta = !isNaN(newAvailable) ? newAvailable - currentAvailable : 0;
  const newInventoryValue = !isNaN(newAvailable) ? Math.max(0, newAvailable) * (newCost || 0) : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isNaN(newAvailable) || newAvailable < 0) {
      toast({
        title: 'Validation Error',
        description: 'Available Quantity must be a non-negative number.',
        variant: 'destructive',
      });
      return;
    }

    if (isNaN(newReserved) || newReserved < 0) {
      toast({
        title: 'Validation Error',
        description: 'Reserved Quantity must be a non-negative number.',
        variant: 'destructive',
      });
      return;
    }

    if (isNaN(newReorder) || newReorder < 0) {
      toast({
        title: 'Validation Error',
        description: 'Reorder Level must be a positive number.',
        variant: 'destructive',
      });
      return;
    }

    if (isAvailableChanged && !reason.trim()) {
      toast({
        title: 'Reason Required',
        description: 'Please provide a brief reason for changing the Available Stock count.',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiFetch('/api/inventory/stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          mainSku: item.mainSku,
          availableQuantity: newAvailable,
          reservedQuantity: newReserved,
          reorderLevel: newReorder,
          costPrice: costPrice !== '' ? newCost : undefined,
          location: location.trim() || 'Main Warehouse',
          reason: reason.trim() || 'Manual stock update',
          notes: notes.trim() || null,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Failed to update inventory record');
      }

      toast({
        title: 'Inventory Updated',
        description: `Successfully updated inventory record for ${item.mainSku}.`,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      toast({
        title: 'Update Failed',
        description: err.message || 'Could not update inventory record.',
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
            <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <Edit className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold font-headline text-white">
                Edit Inventory Record
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                Update stock levels, reorder thresholds, and warehouse location
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Product Identity Banner (Protected - Main SKU & Product cannot be changed) */}
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
            {isAvailableChanged && (
              <span className="flex items-center gap-1.5 font-bold">
                <span className="text-slate-400">Change:</span>
                <span className="text-slate-300">{currentAvailable}</span>
                <ArrowRight className="h-3 w-3" />
                <span className={delta > 0 ? 'text-emerald-400' : 'text-amber-400'}>
                  {newAvailable} ({delta > 0 ? `+${delta}` : delta})
                </span>
              </span>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Stock Quantities Grid */}
          <div className="grid grid-cols-2 gap-4">
            {/* Available Quantity */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-300">
                Available Quantity <span className="text-rose-400">*</span>
              </Label>
              <Input
                type="number"
                min="0"
                step="1"
                value={availableQuantity}
                onChange={(e) => setAvailableQuantity(e.target.value)}
                required
                className="bg-slate-950/60 border-white/10 text-white focus-visible:ring-blue-500/50"
              />
            </div>

            {/* Reserved Quantity */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-300 flex items-center gap-1">
                <Layers className="h-3.5 w-3.5 text-slate-400" /> Reserved Quantity
              </Label>
              <Input
                type="number"
                min="0"
                step="1"
                value={reservedQuantity}
                onChange={(e) => setReservedQuantity(e.target.value)}
                className="bg-slate-950/60 border-white/10 text-white focus-visible:ring-blue-500/50"
              />
            </div>
          </div>

          {/* Pricing & Thresholds */}
          <div className="grid grid-cols-2 gap-4">
            {/* Cost Price */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-300 flex items-center gap-1">
                <DollarSign className="h-3.5 w-3.5 text-slate-400" /> Cost Price (₹)
              </Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="e.g. 120"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                className="bg-slate-950/60 border-white/10 text-white focus-visible:ring-blue-500/50"
              />
            </div>

            {/* Reorder Level */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-300 flex items-center gap-1">
                <BellRing className="h-3.5 w-3.5 text-slate-400" /> Reorder Level
              </Label>
              <Input
                type="number"
                min="0"
                step="1"
                value={reorderLevel}
                onChange={(e) => setReorderLevel(e.target.value)}
                className="bg-slate-950/60 border-white/10 text-white focus-visible:ring-blue-500/50"
              />
            </div>
          </div>

          {/* Storage Location */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-slate-400" /> Storage Location
            </Label>
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Main Warehouse, Bay 2"
              className="bg-slate-950/60 border-white/10 text-white"
            />
          </div>

          {/* Reason (required if available stock changed) */}
          {isAvailableChanged && (
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                <HelpCircle className="h-3.5 w-3.5 text-amber-400" /> Reason for Stock Change{' '}
                <span className="text-rose-400">*</span>
              </Label>
              <Input
                placeholder="e.g. Inventory count audit, stock reconcilation, warehouse transfer..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
                className="bg-slate-950/60 border-amber-500/30 text-white focus-visible:ring-amber-500/50"
              />
            </div>
          )}

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <StickyNote className="h-3.5 w-3.5 text-slate-400" /> Notes
            </Label>
            <Textarea
              placeholder="Any additional comments..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="bg-slate-950/60 border-white/10 text-white resize-none text-xs"
            />
          </div>

          {/* Value Preview */}
          <div className="p-3 rounded-xl bg-slate-800/40 border border-white/10 flex justify-between items-center text-xs">
            <span className="text-slate-400">Updated Stock Valuation:</span>
            <span className="font-bold font-mono text-sm text-emerald-400">
              {formatINR(newInventoryValue)}
            </span>
          </div>

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
              disabled={submitting || (isAvailableChanged && !reason.trim())}
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

