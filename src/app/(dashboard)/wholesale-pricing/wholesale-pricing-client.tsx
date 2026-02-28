
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
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Trash2, PlusCircle, Tag, TrendingDown } from 'lucide-react';
import { apiFetch } from '@/lib/apiFetch';

const formSchema = z.object({
  product_id: z.string().min(1, "Product is required"),
  min_quantity: z.coerce.number().min(1, "Minimum quantity must be at least 1"),
  wholesale_price: z.coerce.number().positive("Price must be positive"),
});

type WholesaleTier = {
  id: string;
  product_id: string;
  product_name: string;
  min_quantity: number;
  wholesale_price: number;
  added_by: string;
};

export function WholesalePricingClient() {
  const { toast } = useToast();
  const [products, setProducts] = useState<{ id: string; sku: string; product_name: string }[]>([]);
  const [tiers, setTiers] = useState<WholesaleTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      product_id: "",
      min_quantity: 1,
      wholesale_price: 0,
    },
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/wholesale');
      if (!res.ok) throw new Error('Failed to fetch wholesale data');
      
      const json = await res.json();
      setProducts(json.products || []);
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
      form.reset({ product_id: "", min_quantity: 1, wholesale_price: 0 });
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
      if (!res.ok) throw new Error('Failed to delete tier');
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

  const totalWholesaleValue = tiers.reduce((sum, tier) => sum + (tier.wholesale_price || 0), 0);

  return (
    <div className="p-6 space-y-6 bg-gray-50/50 dark:bg-black/50 min-h-full">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight font-headline">Wholesale Pricing</h1>
        <p className="text-muted-foreground">Manage volume-based discount tiers for wholesale customers.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Column */}
        <Card className="lg:col-span-1 h-fit shadow-lg border-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <PlusCircle className="h-5 w-5 text-primary" />
              Add New Tier
            </CardTitle>
            <CardDescription>Configure a new discount level for a specific product.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="product_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Select Product</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-background/50">
                            <SelectValue placeholder="Choose a product SKU" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {products.map(p => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.sku} — {p.product_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="min_quantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Min. Quantity</FormLabel>
                        <FormControl>
                          <Input type="number" className="bg-background/50" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="wholesale_price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Wholesale Price</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" className="bg-background/50" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <Button type="submit" className="w-full font-bold shadow-md shadow-primary/20" disabled={isSubmitting}>
                  {isSubmitting ? "Processing..." : "Add Pricing Tier"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Table Column */}
        <Card className="lg:col-span-2 shadow-lg border-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-xl flex items-center gap-2">
                <Tag className="h-5 w-5 text-primary" />
                Wholesale Price List
              </CardTitle>
              <CardDescription>All currently active wholesale discount levels.</CardDescription>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Total Wholesale Value</p>
              <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {formatINR(totalWholesaleValue)}
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-xl border border-border/50 overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead>Product Name</TableHead>
                    <TableHead className="text-center">Min Qty</TableHead>
                    <TableHead className="text-right">Price (₹)</TableHead>
                    <TableHead>Added By</TableHead>
                    <TableHead className="text-right w-[80px]">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={5}><Skeleton className="h-8 w-full opacity-50" /></TableCell>
                      </TableRow>
                    ))
                  ) : tiers.length > 0 ? (
                    tiers.map((tier) => (
                      <TableRow key={tier.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell className="font-semibold">{tier.product_name}</TableCell>
                        <TableCell className="text-center">
                          <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-bold">
                            {tier.min_quantity}+ units
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-bold text-lg text-emerald-600 dark:text-emerald-400">
                          {formatINR(tier.wholesale_price)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {tier.added_by || "System"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => onDelete(tier.id)} 
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive transition-all"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="h-40 text-center">
                        <div className="flex flex-col items-center justify-center text-muted-foreground gap-2">
                          <TrendingDown className="h-10 w-10 opacity-20" />
                          <p>No wholesale tiers found. Add your first tier to get started.</p>
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
