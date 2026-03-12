"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"

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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { apiFetch } from "@/lib/apiFetch"
import { calculatePlatformPrices } from "@/lib/pricingEngine"
import type { Product } from "../page"

const formSchema = z.object({
  sku: z.string().min(1, "SKU is required"),
  product_name: z.string().min(1, "Product Name is required"),
  category: z.string().optional(),
  cost_price: z.coerce.number().min(0, "Cost Price must be positive"),
  margin: z.coerce.number().min(0, "Margin is required"),
  promo_ads: z.coerce.number().min(0),
  tax_other: z.coerce.number().min(0),
  packing: z.coerce.number().min(0),
  amazon_ship: z.coerce.number().min(0),
  flipkart_ship: z.coerce.number().min(0),
  meesho_price: z.coerce.number().min(0),
  flipkart_price: z.coerce.number().min(0),
  amazon_price: z.coerce.number().min(0),
  stock: z.coerce.number().min(0),
  low_stock_threshold: z.coerce.number().min(0),
})

type ProductFormValues = z.infer<typeof formSchema>

interface ProductModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  productToEdit?: Product | null
}

export function AddProductModal({ isOpen, onClose, onSuccess, productToEdit }: ProductModalProps) {
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const isEditMode = !!productToEdit

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      sku: "",
      product_name: "",
      category: "General",
      cost_price: 0,
      margin: 100,
      promo_ads: 20,
      tax_other: 10,
      packing: 15,
      amazon_ship: 80,
      flipkart_ship: 80,
      meesho_price: 0,
      flipkart_price: 0,
      amazon_price: 0,
      stock: 0,
      low_stock_threshold: 5,
    },
  })

  // Reset form when modal opens or productToEdit changes
  React.useEffect(() => {
    if (isOpen) {
      if (productToEdit) {
        form.reset({
          sku: productToEdit.sku,
          product_name: productToEdit.product_name,
          category: productToEdit.category || "General",
          cost_price: productToEdit.cost_price,
          margin: productToEdit.margin,
          promo_ads: (productToEdit as any).promo_ads || 20,
          tax_other: (productToEdit as any).tax_other || 10,
          packing: (productToEdit as any).packing || 15,
          amazon_ship: (productToEdit as any).amazon_ship || 80,
          flipkart_ship: (productToEdit as any).flipkart_ship || 80,
          meesho_price: productToEdit.meesho_price,
          flipkart_price: productToEdit.flipkart_price,
          amazon_price: productToEdit.amazon_price,
          stock: productToEdit.stock,
          low_stock_threshold: productToEdit.low_stock_threshold,
        })
      } else {
        form.reset({
          sku: "",
          product_name: "",
          category: "General",
          cost_price: 0,
          margin: 100,
          promo_ads: 20,
          tax_other: 10,
          packing: 15,
          amazon_ship: 80,
          flipkart_ship: 80,
          meesho_price: 0,
          flipkart_price: 0,
          amazon_price: 0,
          stock: 0,
          low_stock_threshold: 5,
        })
      }
    }
  }, [isOpen, productToEdit, form])

  const watchedValues = form.watch([
    "cost_price",
    "margin",
    "promo_ads",
    "tax_other",
    "packing",
    "amazon_ship",
    "flipkart_ship"
  ]);

  // Automated Price Recalculation
  React.useEffect(() => {
    const [cost, margin, ads, tax, pack, amz, flip] = watchedValues;
    const prices = calculatePlatformPrices({
      cost_price: cost,
      margin: margin,
      promo_ads: ads,
      tax_other: tax,
      packing: pack,
      amazon_ship: amz,
      flipkart_ship: flip
    });

    form.setValue("meesho_price", prices.meesho_price);
    form.setValue("flipkart_price", prices.flipkart_price);
    form.setValue("amazon_price", prices.amazon_price);
  }, [watchedValues, form]);

  async function onSubmit(values: ProductFormValues) {
    setIsSubmitting(true)
    try {
      const endpoint = isEditMode ? '/api/products/update' : '/api/products/create'
      const method = isEditMode ? 'PUT' : 'POST'
      
      const payload = isEditMode ? { ...values, id: productToEdit?.id } : values

      const res = await apiFetch(endpoint, {
        method,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || `Failed to ${isEditMode ? 'update' : 'create'} product.`);
      }

      toast({
        title: "Success",
        description: `Product ${isEditMode ? 'updated' : 'created'} successfully.`,
      })
      onSuccess()
      onClose()
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit Product' : 'Add New Product'}</DialogTitle>
          <DialogDescription>
            Enter product details. Pricing is calculated automatically including 18% GST.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* CORE DETAILS */}
              <div className="space-y-4">
                <h3 className="font-bold text-sm uppercase tracking-wider text-primary border-b pb-2">Core Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="sku"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>SKU</FormLabel>
                        <FormControl><Input placeholder="e.g. TS-BL-L" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <FormControl><Input placeholder="e.g. Apparel" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="product_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Product Name</FormLabel>
                      <FormControl><Input placeholder="e.g. Cotton T-Shirt" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* COST BREAKDOWN */}
                <h3 className="font-bold text-sm uppercase tracking-wider text-primary border-b pb-2 mt-6">Cost Breakdown</h3>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="cost_price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cost Price (₹)</FormLabel>
                        <FormControl><Input type="number" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="margin"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Margin (₹)</FormLabel>
                        <FormControl><Input type="number" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <FormField control={form.control} name="promo_ads" render={({ field }) => (
                    <FormItem><FormLabel className="text-xs">Ads (₹)</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="tax_other" render={({ field }) => (
                    <FormItem><FormLabel className="text-xs">Tax Misc (₹)</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="packing" render={({ field }) => (
                    <FormItem><FormLabel className="text-xs">Packing (₹)</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>
                  )} />
                </div>
              </div>

              {/* LOGISTICS & FINAL PRICING */}
              <div className="space-y-4">
                <h3 className="font-bold text-sm uppercase tracking-wider text-primary border-b pb-2">Logistics (Shipping)</h3>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="amazon_ship"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Amazon Ship (₹)</FormLabel>
                        <FormControl><Input type="number" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="flipkart_ship"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Flipkart Ship (₹)</FormLabel>
                        <FormControl><Input type="number" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <h3 className="font-bold text-sm uppercase tracking-wider text-primary border-b pb-2 mt-6">Final Platform Pricing</h3>
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="meesho_price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Meesho Listing Price (Inc. 18% GST)</FormLabel>
                        <FormControl><Input type="number" className="font-bold" {...field} readOnly /></FormControl>
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="flipkart_price" render={({ field }) => (
                      <FormItem><FormLabel className="text-xs">Flipkart Listing</FormLabel><FormControl><Input type="number" {...field} readOnly /></FormControl></FormItem>
                    )} />
                    <FormField control={form.control} name="amazon_price" render={({ field }) => (
                      <FormItem><FormLabel className="text-xs">Amazon Listing</FormLabel><FormControl><Input type="number" {...field} readOnly /></FormControl></FormItem>
                    )} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-6">
                  <FormField control={form.control} name="stock" render={({ field }) => (
                    <FormItem><FormLabel>Initial Stock</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="low_stock_threshold" render={({ field }) => (
                    <FormItem><FormLabel>Low Stock Alert</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>
                  )} />
                </div>
              </div>
            </div>
            
            <DialogFooter className="mt-8">
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting} className="min-w-[150px]">
                {isSubmitting ? 'Processing...' : (isEditMode ? 'Update Product' : 'Create Product')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
