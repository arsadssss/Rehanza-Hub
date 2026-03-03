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
import { Skeleton } from '@/components/ui/skeleton';
import { Trash2, PlusCircle, Tag, TrendingDown } from 'lucide-react';
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

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      product_name: "",
      min_quantity: 1,
      wholesale_price: 0,
    },
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/wholesale');
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
  }, [toast]);

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
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-xl">
                <Tag className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-xl font-headline font-bold">Price Registry</CardTitle>
                <CardDescription className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground/60">Active Wholesale Tiers</CardDescription>
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
                    <TableHead className="text-right w-[100px] px-6 h-14 text-muted-foreground">Actions</TableHead>
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
                      <TableRow key={tier.id} className="hover:bg-primary/5 transition-colors border-border/50">
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
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => onDelete(tier.id)} 
                            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-9 w-9 rounded-xl transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
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
                            <p className="text-xs font-medium">Add your first wholesale price level using the form above.</p>
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
    </div>
  );
}
