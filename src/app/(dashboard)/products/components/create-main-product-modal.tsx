'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/apiFetch';
import { Loader2, PackagePlus } from 'lucide-react';

interface CreateMainProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newProduct?: any) => void;
}

export function CreateMainProductModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateMainProductModalProps) {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [mainSku, setMainSku] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !mainSku.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Product name and Main SKU code are required.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const res = await apiFetch('/api/products/main', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          mainSku: mainSku.trim().toUpperCase(),
          category: category.trim() || null,
          description: description.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to create Main Product');
      }

      toast({
        title: 'Main Product Created',
        description: `"${name}" (${mainSku.toUpperCase()}) created successfully.`,
      });

      // Reset form
      setName('');
      setMainSku('');
      setCategory('');
      setDescription('');
      onSuccess(data.data);
      onClose();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Could not create Main Product.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[480px] bg-card/95 backdrop-blur-xl border-border/60 shadow-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20">
              <PackagePlus className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold tracking-tight">Create Main Product</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Physical parent product that groups multiple platform SKUs.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-xs font-semibold">
              Product Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              placeholder="e.g., Portable USB Juicer Blender 380ml"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                // Auto-suggest main SKU if mainSku is empty
                if (!mainSku) {
                  const slug = e.target.value
                    .toUpperCase()
                    .replace(/[^A-Z0-9]/g, '-')
                    .replace(/-+/g, '-')
                    .slice(0, 18);
                  if (slug) setMainSku(`MAIN-${slug}`);
                }
              }}
              required
              className="bg-background/50 border-input/60 focus-visible:ring-primary/30"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="mainSku" className="text-xs font-semibold">
                Main SKU Code <span className="text-destructive">*</span>
              </Label>
              <Input
                id="mainSku"
                placeholder="e.g., MAIN-JUICER-380"
                value={mainSku}
                onChange={(e) => setMainSku(e.target.value.toUpperCase())}
                required
                className="font-mono text-xs uppercase bg-background/50 border-input/60 focus-visible:ring-primary/30"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="category" className="text-xs font-semibold">
                Category
              </Label>
              <Input
                id="category"
                placeholder="e.g., Appliances, Bottles"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="bg-background/50 border-input/60 focus-visible:ring-primary/30"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description" className="text-xs font-semibold">
              Description / Notes
            </Label>
            <Textarea
              id="description"
              placeholder="Optional notes regarding suppliers, dimensions, or variations..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="resize-none bg-background/50 border-input/60 focus-visible:ring-primary/30 text-xs"
            />
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
            <Button
              type="submit"
              disabled={loading}
              className="gap-2 bg-gradient-to-r from-primary to-primary/90 text-primary-foreground font-medium shadow-md shadow-primary/20"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Main Product'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

