
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/apiFetch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Library, 
  PlusCircle, 
  Search, 
  Copy, 
  ExternalLink, 
  Trash2, 
  FilterX, 
  Image as ImageIcon,
  CheckCircle2,
  FolderOpen
} from 'lucide-react';
import { AddImageModal } from './components/add-image-modal';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

type ImageAsset = {
  id: string;
  title: string;
  image_url: string;
  category: string;
  tags: string[];
  created_at: string;
};

export default function ImageLibraryPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [assets, setAssets] = useState<ImageAsset[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [assetToDelete, setAssetToDelete] = useState<ImageAsset | null>(null);
  
  // Filter state
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const fetchAssets = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        search,
        category: categoryFilter
      });
      const res = await apiFetch(`/api/image-library?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setAssets(json.data || []);
      }
    } catch (error) {
      console.error("Failed to load image library", error);
    } finally {
      setLoading(false);
    }
  }, [search, categoryFilter]);

  useEffect(() => {
    const handler = setTimeout(fetchAssets, 300);
    return () => clearTimeout(handler);
  }, [fetchAssets]);

  const handleCopy = (url: string) => {
    navigator.clipboard.writeText(url);
    toast({
      title: "Link Copied",
      description: "Direct image link saved to clipboard.",
    });
  };

  const handleDelete = async () => {
    if (!assetToDelete) return;
    try {
      const res = await apiFetch(`/api/image-library?id=${assetToDelete.id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        toast({ title: "Asset removed", description: "Image link has been deleted." });
        fetchAssets();
      }
    } catch (e) {
      toast({ variant: 'destructive', title: "Error", description: "Could not remove asset." });
    } finally {
      setAssetToDelete(null);
    }
  };

  const categories = ["Makeup", "Nail", "Foundation", "Skincare", "Apparel", "Marketing", "Other"];

  return (
    <div className="p-6 md:p-10 space-y-8 bg-gray-50/50 dark:bg-black/50 min-h-screen font-body">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary rounded-2xl shadow-xl shadow-primary/20 text-white">
              <Library className="h-6 w-6" />
            </div>
            <h1 className="text-4xl font-black tracking-tighter font-headline">Image Library</h1>
          </div>
          <p className="text-muted-foreground font-medium ml-1 mt-1">Manage and preview cloud-hosted business assets.</p>
        </div>
        <Button 
          onClick={() => setIsAddModalOpen(true)}
          className="rounded-xl h-12 px-8 font-black shadow-xl shadow-primary/20 hover:scale-[1.02] transition-transform"
        >
          <PlusCircle className="mr-2 h-5 w-5" /> ADD NEW IMAGE
        </Button>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col md:flex-row gap-4 items-center bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl p-4 rounded-2xl shadow-sm border border-border/50">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search by title or tags..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-11 bg-background rounded-xl border-border/50"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="h-11 w-full md:w-[200px] bg-background rounded-xl border-border/50 font-bold text-xs uppercase">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="all" className="text-xs font-bold">ALL CATEGORIES</SelectItem>
            {categories.map(c => (
              <SelectItem key={c} value={c} className="text-xs font-bold">{c.toUpperCase()}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => { setSearch(''); setCategoryFilter('all'); }}
          className="h-11 w-11 rounded-xl hover:bg-rose-500/10 hover:text-rose-500 transition-colors"
        >
          <FilterX className="h-4 w-4" />
        </Button>
      </div>

      {/* Assets Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-[320px] w-full rounded-[2rem]" />
          ))}
        </div>
      ) : assets.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {assets.map((asset) => (
            <Card key={asset.id} className="group relative border-0 shadow-xl rounded-[2rem] overflow-hidden bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl hover:-translate-y-1 transition-all duration-300">
              <div className="aspect-square relative bg-muted overflow-hidden">
                <img 
                  src={asset.image_url} 
                  alt={asset.title}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                  loading="lazy"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "https://placehold.co/600x600/6366f1/ffffff?text=Image+Not+Found";
                  }}
                />
                <div className="absolute top-3 left-3">
                  <Badge className="bg-black/60 backdrop-blur-md border-0 text-[9px] font-black uppercase px-2.5 py-1">
                    {asset.category}
                  </Badge>
                </div>
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                  <Button 
                    size="icon" 
                    variant="secondary" 
                    className="h-10 w-10 rounded-xl"
                    onClick={() => handleCopy(asset.image_url)}
                    title="Copy direct link"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button 
                    size="icon" 
                    variant="secondary" 
                    className="h-10 w-10 rounded-xl"
                    asChild
                  >
                    <a href={asset.image_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
              </div>
              <CardContent className="p-5">
                <div className="flex justify-between items-start gap-2">
                  <div className="overflow-hidden">
                    <h3 className="font-bold text-sm truncate leading-tight">{asset.title}</h3>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {asset.tags?.map((tag, idx) => (
                        <span key={idx} className="text-[8px] font-black uppercase text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded-md">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-rose-500 hover:bg-rose-500/10 shrink-0"
                    onClick={() => setAssetToDelete(asset)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-32 text-center bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl rounded-[2rem] border-2 border-dashed border-border/50">
          <div className="p-8 bg-muted rounded-full mb-6">
            <ImageIcon className="h-16 w-16 text-muted-foreground opacity-30" />
          </div>
          <h3 className="text-2xl font-black font-headline tracking-tight">Library is Empty</h3>
          <p className="text-muted-foreground mt-2 max-w-xs mx-auto">Start building your media registry by adding your first asset link.</p>
          <Button 
            onClick={() => setIsAddModalOpen(true)}
            variant="outline"
            className="mt-8 rounded-xl border-primary/20 text-primary hover:bg-primary/5 px-8 font-bold"
          >
            Authorize First Asset
          </Button>
        </div>
      )}

      {/* Modals */}
      <AddImageModal 
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={fetchAssets}
      />

      <AlertDialog open={!!assetToDelete} onOpenChange={() => setAssetToDelete(null)}>
        <AlertDialogContent className="rounded-[2.5rem]">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-headline text-2xl font-bold">Remove Asset?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              This will permanently delete <strong>{assetToDelete?.title}</strong> from your cloud registry. This action cannot be reversed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl border-0 bg-muted">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90 rounded-xl px-8 font-bold">
              Confirm Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
