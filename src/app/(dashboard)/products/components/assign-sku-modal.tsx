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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/apiFetch';
import { formatINR } from '@/lib/format';
import { Loader2, Link2, Unlink, Plus, ArrowRight, Layers } from 'lucide-react';
import { PlatformSkuRecord, MainProductRecord } from '@/lib/products/sku-registry-service';

interface AssignSkuModalProps {
  isOpen: boolean;
  onClose: () => void;
  sku: PlatformSkuRecord | null;
  mainProducts: MainProductRecord[];
  onSuccess: () => void;
  onOpenCreateMain?: () => void;
}

export function AssignSkuModal({
  isOpen,
  onClose,
  sku,
  mainProducts,
  onSuccess,
  onOpenCreateMain,
}: AssignSkuModalProps) {
  const { toast } = useToast();
  const [selectedMainId, setSelectedMainId] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (sku) {
      setSelectedMainId(sku.mainProductId || 'none');
    }
  }, [sku]);

  if (!sku) return null;

  const handleAssign = async () => {
    setLoading(true);
    try {
      const targetMainId = selectedMainId === 'none' ? null : selectedMainId;

      const res = await apiFetch('/api/products/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skuId: sku.id,
          mainProductId: targetMainId,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to update assignment');
      }

      toast({
        title: targetMainId ? 'SKU Assigned' : 'SKU Unassigned',
        description: targetMainId
          ? `SKU "${sku.sku}" assigned to selected Main Product.`
          : `SKU "${sku.sku}" has been unassigned.`,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      toast({
        title: 'Assignment Failed',
        description: err.message || 'Could not update assignment.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const currentMainProduct = mainProducts.find((mp) => mp.id === sku.mainProductId);
  const targetMainProduct = mainProducts.find((mp) => mp.id === selectedMainId);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px] bg-card/95 backdrop-blur-xl border-border/60 shadow-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Link2 className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold tracking-tight">
                {sku.mainProductId ? 'Move / Reassign SKU' : 'Assign SKU to Main Product'}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Link this reconciliation platform SKU to a parent Main Product.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Selected SKU Metadata Card */}
        <div className="p-3.5 rounded-xl bg-muted/40 border border-border/50 space-y-2.5 text-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wider">Platform SKU:</span>
              <Badge variant="outline" className="font-mono font-bold text-xs bg-background/60">
                {sku.sku}
              </Badge>
            </div>
            <Badge variant="secondary" className="text-[10px] font-medium">
              {sku.platform}
            </Badge>
          </div>

          {sku.title && (
            <p className="text-foreground/90 font-medium line-clamp-1">
              {sku.title}
            </p>
          )}

          <div className="grid grid-cols-3 gap-2 pt-1 border-t border-border/40 text-[11px]">
            <div>
              <span className="text-muted-foreground block text-[10px]">Purchase Cost:</span>
              <span className="font-semibold font-mono">{formatINR(sku.purchaseCost)}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[10px]">Packaging:</span>
              <span className="font-semibold font-mono">{formatINR(sku.packagingCost)}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[10px]">Orders:</span>
              <span className="font-semibold">{sku.totalOrders} units</span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-border/40">
            <span className="text-muted-foreground text-[10px]">Current Parent:</span>
            {currentMainProduct ? (
              <span className="font-semibold text-primary">
                {currentMainProduct.name} ({currentMainProduct.mainSku})
              </span>
            ) : (
              <Badge variant="outline" className="text-amber-500 border-amber-500/30 bg-amber-500/10 text-[10px]">
                Unassigned
              </Badge>
            )}
          </div>
        </div>

        {/* Target Main Product Selection */}
        <div className="space-y-2 py-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="mainProductSelect" className="text-xs font-semibold">
              Select Destination Main Product
            </Label>
            {onOpenCreateMain && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenCreateMain();
                }}
                className="text-[11px] text-primary hover:underline flex items-center gap-1 font-medium"
              >
                <Plus className="w-3 h-3" /> New Main Product
              </button>
            )}
          </div>

          <Select value={selectedMainId} onValueChange={setSelectedMainId}>
            <SelectTrigger id="mainProductSelect" className="bg-background/50 border-input/60">
              <SelectValue placeholder="Select parent product..." />
            </SelectTrigger>
            <SelectContent className="max-h-[250px]">
              <SelectItem value="none" className="text-amber-600 dark:text-amber-400 font-medium">
                -- Unassigned (Leave standalone) --
              </SelectItem>
              {mainProducts.map((mp) => (
                <SelectItem key={mp.id} value={mp.id}>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{mp.name}</span>
                    <span className="text-muted-foreground text-xs font-mono">[{mp.mainSku}]</span>
                    <span className="text-muted-foreground text-[10px]">({mp.linkedSkusCount} SKUs)</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {targetMainProduct && targetMainProduct.id !== sku.mainProductId && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-primary/5 border border-primary/20 text-xs text-primary mt-2">
              <ArrowRight className="w-4 h-4 flex-shrink-0" />
              <span>
                Will link to <strong>{targetMainProduct.name}</strong> ({targetMainProduct.mainSku})
              </span>
            </div>
          )}
        </div>

        <DialogFooter className="pt-2 gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={loading}
            className="border-border/60"
          >
            Cancel
          </Button>

          {sku.mainProductId && selectedMainId === 'none' ? (
            <Button
              type="button"
              variant="destructive"
              disabled={loading}
              onClick={handleAssign}
              className="gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlink className="w-4 h-4" />}
              Unassign SKU
            </Button>
          ) : (
            <Button
              type="button"
              disabled={loading || selectedMainId === (sku.mainProductId || 'none')}
              onClick={handleAssign}
              className="gap-2 bg-gradient-to-r from-primary to-primary/90 text-primary-foreground font-medium shadow-md shadow-primary/20"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Link2 className="w-4 h-4" />
                  Confirm Assignment
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

