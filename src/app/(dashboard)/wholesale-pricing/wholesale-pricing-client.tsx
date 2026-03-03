"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { formatINR } from '@/lib/format';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from '@/components/ui/skeleton';
import { Trash2, PlusCircle, Tag, TrendingDown, Search, Filter, Pencil } from 'lucide-react';
import { apiFetch } from '@/lib/apiFetch';

const formSchema = z.object({
  product_name: z.string().min(1, "Product name is required"),
  min_quantity: z.coerce.number().min(1, "Minimum quantity must be at least 1"),
  wholesale_price: z.coerce.number().positive("Price must be positive"),
});

type WholesaleTier = {
  id: string;
  product_name: string;
  min_quantity: number;
  wholesale_price: number;
  added_by: string;
};

export function WholesalePricingClient() {
  const { toast } = useToast();
  const [isMounted, setIsMounted] = useState(false);
  const [tiers, setTiers] = useState<WholesaleTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Search & Sort State
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('latest');
  
  // Edit State
  const [editingTier, setEditingTier] = useState<WholesaleTier | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      product_name: "",
      min_quantity: 1,
      wholesale_price: 0,
    },
  });

  const editForm = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  const fetchData = useCallback(async (currentSearch?: string, currentSort?: string) => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        search: currentSearch ?? search,
        sort: currentSort ?? sort
      }).toString();
      
      const res = await apiFetch(`/api/wholesale?${query}`);
      const json = await res.json();
      
      if (!res.ok) {
        throw new Error(json.message || 'Failed to fetch wholesale data');
      }
      
      setTiers(json.tiers || []);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  }, [toast, search, sort]);

  // Debounced Search Effect
  useEffect(() => {
    if (!isMounted) return;
    const handler = setTimeout(() => {
      fetchData();
    }, 300);
    return () => clearTimeout(handler);
  }, [search, isMounted, fetchData]);

  useEffect(() => {
    setIsMounted(true);
    fetchData();
  }, [fetchData]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);
    try {
      const res = await apiFetch('/api/wholesale', {
        method: 'POST',
        body: JSON.stringify(values),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.message || 'Failed to create tier');
      }

      toast({
        title: 'Success',
        description: 'Wholesale pricing tier added successfully.',
      });
      
      form.reset({ product_name: "", min_quantity: 1, wholesale_price: 0 });
      fetchData();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function onEditSubmit(values: z.infer<typeof formSchema>) {
    if (!editingTier) return;
    setIsSubmitting(true);
    try {
      const res = await apiFetch('/api/wholesale', {
        method: 'PUT',
        body: JSON.stringify({
          ...values,
          id: editingTier.id
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.message || 'Failed to update tier');
      }

      toast({
        title: 'Success',
        description: 'Wholesale pricing tier updated successfully.',
      });
      
      setIsEditOpen(false);
      setEditingTier(null);
      fetchData();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function onDelete(id: string) {
    try {
      const res = await apiFetch(`/api/wholesale?id=${id}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      
      if (!res.ok) {
        throw new Error(json.message || 'Failed to delete tier');
      }
      
      toast({
        title: 'Success',
        description: 'Pricing tier removed successfully.',
      });
      fetchData();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
      });
    }
  }

  const openEdit = (tier: WholesaleTier) => {
    setEditingTier(tier);
    editForm.reset({
      product_name: tier.product_name,
      min_quantity: tier.min_quantity,
      wholesale_price: tier.wholesale_price
    });
    setIsEditOpen(true);
  };

  if (!isMounted) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-1/4" />
        <div className="space-y-8">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8 bg-gray-50/50 dark:bg-black/50 min-h-full font-body">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight font-headline text-foreground">Wholesale Pricing</h1>
        <p className="text-muted-foreground text-sm font-medium">Manage volume-based discount tiers independently from your main catalog.</p>
      </div>

      <div className="flex flex-col gap-8">
        {/* Add New Tier Form Section */}
        <Card className="w-full shadow-2xl border-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-[2rem] overflow-hidden">
          <CardHeader className="pt-8 px-8">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-xl">
                <PlusCircle className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-xl font-headline font-bold">Add New Item</CardTitle>
                <CardDescription className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground/60">Manual Configuration</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-8 pb-10 mt-2">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="product_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground ml-1">Product Name</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="e.g. Bulk Cotton T-Shirts" 
                            className="bg-gray-100/50 dark:bg-white/5 border-0 focus-visible:ring-primary/20 h-12 rounded-xl text-sm font-medium" 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage className="text-[10px] font-bold" />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="min_quantity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground ml-1">Min. Quantity</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              className="bg-gray-100/50 dark:bg-white/5 border-0 focus-visible:ring-primary/20 h-12 rounded-xl text-sm font-medium" 
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage className="text-[10px] font-bold" />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="wholesale_price"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground ml-1">Unit Price (₹)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              step="0.01" 
                              className="bg-gray-100/50 dark:bg-white/5 border-0 focus-visible:ring-primary/20 h-12 rounded-xl text-sm font-medium" 
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage className="text-[10px] font-bold" />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="w-full md:w-auto px-12 h-12 rounded-xl font-bold tracking-tight shadow-lg shadow-primary/20 hover:scale-[1.02] transition-transform bg-primary text-primary-foreground"
                  >
                    {isSubmitting ? "Processing..." : "Add Pricing Tier"}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Wholesale Tiers Registry Section */}
        <Card className="w-full shadow-2xl border-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-[2rem] overflow-hidden">
          <CardHeader className="pt-8 px-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-xl">
                  <Tag className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-xl font-headline font-bold">Price Registry</CardTitle>
                  <CardDescription className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground/60">Active Wholesale Tiers</CardDescription>
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search product..." 
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 h-10 bg-gray-100/50 dark:bg-white/5 border-0 rounded-xl text-xs"
                  />
                </div>
                <Select value={sort} onValueChange={(val) => { setSort(val); fetchData(search, val); }}>
                  <SelectTrigger className="w-full sm:w-44 h-10 bg-gray-100/50 dark:bg-white/5 border-0 rounded-xl text-xs">
                    <Filter className="h-3 w-3 mr-2 text-muted-foreground" />
                    <SelectValue placeholder="Sort By" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="latest">Latest First</SelectItem>
                    <SelectItem value="price_asc">Price: Low to High</SelectItem>
                    <SelectItem value="price_desc">Price: High to Low</SelectItem>
                    <SelectItem value="qty_desc">Min Qty: High to Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-8 pb-10">
            <div className="rounded-[1.5rem] border border-border/50 overflow-hidden bg-background/40">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow className="border-border/50 hover:bg-transparent">
                    <TableHead className="font-bold text-[10px] uppercase tracking-[0.2em] px-6 h-14 text-muted-foreground">Product Name</TableHead>
                    <TableHead className="text-center font-bold text-[10px] uppercase tracking-[0.2em] h-14 text-muted-foreground">Min Qty</TableHead>
                    <TableHead className="text-right font-bold text-[10px] uppercase tracking-[0.2em] h-14 text-muted-foreground">Wholesale Price</TableHead>
                    <TableHead className="font-bold text-[10px] uppercase tracking-[0.2em] h-14 text-muted-foreground">Added By</TableHead>
                    <TableHead className="text-right w-[120px] px-6 h-14 text-muted-foreground">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i} className="border-border/50">
                        <TableCell colSpan={5} className="px-6 py-6"><Skeleton className="h-10 w-full opacity-40 rounded-xl" /></TableCell>
                      </TableRow>
                    ))
                  ) : tiers.length > 0 ? (
                    tiers.map((tier) => (
                      <TableRow key={tier.id} className="hover:bg-primary/5 transition-colors border-border/50 group">
                        <TableCell className="font-bold text-sm px-6 py-5 text-foreground">{tier.product_name}</TableCell>
                        <TableCell className="text-center py-5">
                          <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-black uppercase tracking-tighter">
                            {tier.min_quantity}+ units
                          </span>
                        </TableCell>
                        <TableCell className="text-right py-5">
                          <span className="font-black text-lg text-emerald-600 dark:text-emerald-400">
                            {formatINR(tier.wholesale_price)}
                          </span>
                        </TableCell>
                        <TableCell className="py-5">
                          <div className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-black text-muted-foreground">
                              {(tier.added_by || "S").charAt(0).toUpperCase()}
                            </div>
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{tier.added_by || "System"}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right px-6 py-5">
                          <div className="flex justify-end gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => openEdit(tier)} 
                              className="text-muted-foreground hover:text-primary hover:bg-primary/10 h-9 w-9 rounded-xl transition-all scale-90 group-hover:scale-100"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => onDelete(tier.id)} 
                              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-9 w-9 rounded-xl transition-all scale-90 group-hover:scale-100"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="h-64 text-center px-6">
                        <div className="flex flex-col items-center justify-center text-muted-foreground gap-4 opacity-30">
                          <div className="p-4 bg-muted rounded-3xl">
                            <TrendingDown className="h-12 w-12" />
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm font-black uppercase tracking-widest">No tiers found</p>
                            <p className="text-xs font-medium">{search ? "Try a different search term" : "Add your first wholesale price level using the form."}</p>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Edit Modal */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-[2rem] border-0 shadow-2xl backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="font-headline font-bold">Edit Wholesale Tier</DialogTitle>
            <DialogDescription className="text-xs">Update the discount level for this product.</DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4 py-4">
              <FormField
                control={editForm.control}
                name="product_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Product Name</FormLabel>
                    <FormControl>
                      <Input className="bg-gray-100/50 dark:bg-white/5 border-0 rounded-xl" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="min_quantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Min Qty</FormLabel>
                      <FormControl>
                        <Input type="number" className="bg-gray-100/50 dark:bg-white/5 border-0 rounded-xl" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="wholesale_price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Price (₹)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" className="bg-gray-100/50 dark:bg-white/5 border-0 rounded-xl" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter className="pt-4">
                <Button type="button" variant="ghost" onClick={() => setIsEditOpen(false)} className="rounded-xl font-bold">Cancel</Button>
                <Button type="submit" disabled={isSubmitting} className="rounded-xl font-bold bg-primary text-primary-foreground shadow-lg shadow-primary/20">
                  {isSubmitting ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}