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
import { SlidersHorizontal, Loader2, ArrowRight, AlertTriangle, MapPin, StickyNote, HelpCircle } from 'lucide-react';
import { InventoryItem } from '@/lib/inventory/inventory-service';

interface AdjustStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: InventoryItem | null;
  onSuccess: () => void;
}

export function AdjustStockModal({
  isOpen,
  onClose,
  item,
  onSuccess,
}: AdjustStockModalProps) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const [adjustmentType, setAdjustmentType] = useState<string>('Correction');
  const [adjustmentMode, setAdjustmentMode] = useState<'set' | 'delta'>('set');
  const [quantity, setQuantity] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [location, setLocation] = useState<string>('Main Warehouse');
  const [notes, setNotes] = useState<string>('');

  useEffect(() => {
    if (item) {
      setAdjustmentType('Correction');
      setAdjustmentMode('set');
      setQuantity(String(item.availableQuantity || 0));
      setReason('');
      setLocation(item.location || 'Main Warehouse');
      setNotes('');
    }
  }, [item, isOpen]);

  if (!item) return null;

  const currentAvailable = item.availableQuantity || 0;
  const numValue = parseInt(quantity, 10);

  let newAvailable = currentAvailable;
  let delta = 0;
  let isValid = !isNaN(numValue);

  if (isValid) {
    if (adjustmentMode === 'set') {
      newAvailable = numValue;
      delta = newAvailable - currentAvailable;
      if (newAvailable < 0) isValid = false;
    } else {
      newAvailable = currentAvailable + numValue;
      delta = numValue;
      if (newAvailable < 0) isValid = false;
    }
  }

  const isNegativeError = !isNaN(numValue) && newAvailable < 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isNaN(numValue)) {
      toast({
        title: 'Validation Error',
        description: 'Please enter a valid quantity.',
        variant: 'destructive',
      });
      return;
    }

    if (newAvailable < 0) {
      toast({
        title: 'Negative Stock Prevented',
        description: `Cannot reduce stock below 0. Current stock is ${currentAvailable}.`,
        variant: 'destructive',
      });
      return;
    }

    if (!reason.trim()) {
      toast({
        title: 'Reason Required',
        description: 'Please provide a clear reason for this stock adjustment.',
        variant: 'destructive',
      });
      return;
    }

    if (delta === 0) {
      toast({
        title: 'No Change',
        description: 'Adjusted quantity results in identical stock count. No update needed.',
      });
      onClose();
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiFetch('/api/inventory/stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'adjust',
          mainSku: item.mainSku,
          adjustmentType,
          adjustmentMode,
          quantity: numValue,
          reason: reason.trim(),
          location: location.trim() || 'Main Warehouse',
          notes: notes.trim() || null,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Failed to adjust stock');
      }

      toast({
        title: 'Stock Adjusted Successfully',
        description: `${item.mainSku} stock updated: ${currentAvailable} → ${newAvailable} (${delta > 0 ? `+${delta}` : delta} units).`,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      toast({
        title: 'Adjustment Failed',
        description: err.message || 'Could not process stock adjustment.',
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
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <SlidersHorizontal className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold font-headline text-white">
                Adjust Stock
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                Log authorized inventory adjustments with reason & audit record
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Product Context Banner */}
        <div className="p-4 rounded-xl bg-slate-800/60 border border-white/10 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md">
              {item.mainSku}
            </span>
            <Badge variant="outline" className="text-xs bg-slate-800 text-slate-300 border-white/10">
              {item.category || 'General'}
            </Badge>
          </div>
          <p className="text-sm font-semibold text-slate-200 line-clamp-1">{item.productName}</p>
          <div className="flex items-center justify-between text-xs text-slate-400 pt-1 border-t border-white/5">
            <span>Current Available: <strong className="text-white">{currentAvailable} units</strong></span>
            {!isNaN(numValue) && (
              <span className="flex items-center gap-1.5 font-bold">
                <span className="text-slate-400">New Available:</span>
                <span className="text-slate-300">{currentAvailable}</span>
                <ArrowRight className="h-3 w-3" />
                <span
                  className={
                    newAvailable < 0
                      ? 'text-rose-400'
                      : delta > 0
                      ? 'text-emerald-400'
                      : delta < 0
                      ? 'text-amber-400'
                      : 'text-white'
                  }
                >
                  {newAvailable} units ({delta > 0 ? `+${delta}` : delta})
                </span>
              </span>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Adjustment Mode Selector */}
          <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-950/60 border border-white/10">
            <button
              type="button"
              onClick={() => {
                setAdjustmentMode('set');
                setQuantity(String(currentAvailable));
              }}
              className={`py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                adjustmentMode === 'set'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Set New Total Stock
            </button>
            <button
              type="button"
              onClick={() => {
                setAdjustmentMode('delta');
                setQuantity('');
              }}
              className={`py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                adjustmentMode === 'delta'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Add / Deduct (+/-)
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Adjustment Type */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-300">Adjustment Type</Label>
              <Select value={adjustmentType} onValueChange={setAdjustmentType}>
                <SelectTrigger className="bg-slate-950/60 border-white/10 text-white">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-white/10 text-white">
                  <SelectItem value="Correction">Correction / Count</SelectItem>
                  <SelectItem value="Damaged">Damaged (Loss)</SelectItem>
                  <SelectItem value="Lost">Lost / Missing</SelectItem>
                  <SelectItem value="Manual Adjustment">Manual Adjustment</SelectItem>
                  <SelectItem value="Found / Return">Found / Return</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Quantity Input */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-300">
                {adjustmentMode === 'set' ? 'New Total Available Units' : 'Quantity Change (+ or -)'}{' '}
                <span className="text-rose-400">*</span>
              </Label>
              <Input
                type="number"
                step="1"
                placeholder={adjustmentMode === 'set' ? 'e.g. 100' : 'e.g. -5 or 10'}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
                className="bg-slate-950/60 border-white/10 text-white focus-visible:ring-amber-500/50"
              />
            </div>
          </div>

          {/* Negative Stock Warning */}
          {isNegativeError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-2.5 text-xs text-rose-300">
              <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
              <span>
                Negative stock is not allowed. Resulting stock ({newAvailable}) cannot be less than 0.
              </span>
            </div>
          )}

          {/* Reason (Mandatory) */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <HelpCircle className="h-3.5 w-3.5 text-slate-400" /> Reason for Adjustment{' '}
              <span className="text-rose-400">*</span>
            </Label>
            <Input
              placeholder="e.g. Physical inventory cycle count, box carton crushed, water leakage..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              className="bg-slate-950/60 border-white/10 text-white focus-visible:ring-amber-500/50"
            />
          </div>

          {/* Location */}
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

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <StickyNote className="h-3.5 w-3.5 text-slate-400" /> Additional Notes
            </Label>
            <Textarea
              placeholder="Any extra context, inspection notes, or auditor comments..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="bg-slate-950/60 border-white/10 text-white resize-none text-xs"
            />
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
              disabled={submitting || !reason.trim() || isNegativeError}
              className="bg-amber-600 hover:bg-amber-500 text-white font-bold"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                'Confirm Adjustment'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

