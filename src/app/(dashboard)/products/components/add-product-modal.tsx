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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Product } from "../page"
import { formatINR } from "@/lib/format"
import { apiFetch } from "@/lib/apiFetch"
import { calculateProductPrices } from "@/lib/pricingEngine"

const formSchema = z.object({
  sku: z.string().min(1, "SKU is required"),
  product_name: z.string().min(1, "Product Name is required"),
  category: z.string().optional(),
  cost_price: z.coerce.number().positive("Cost Price must be positive"),
  margin: z.coerce.number().positive("Margin is required"),
  low_stock_threshold: z.coerce.number().min(0, "Low stock threshold cannot be negative").default(5),
  promo_ads: z.coerce.number().min(0).default(20),
  tax_other: z.coerce.number().min(0).default(10),
  packing: z.coerce.number().min(0).default(15),
  amazon_ship: z.coerce.number().min(0).default(80),
  flipkart_ship: z.coerce.number().min(0).default(120),
  meesho_price: z.coerce.number().min(0),
  flipkart_price: z.coerce.number().min(0),
  amazon_price: z.coerce.number().min(0),
})

type ProductFormValues = z.infer<typeof formSchema>

const marginValues = [20, 30, 45, 50, 60, 80, 100, 150, 200, 300, 500]

interface ProductModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  product?: Product | null
}

export function AddProductModal({ isOpen, onClose, onSuccess, product }: ProductModalProps) {
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const isEditMode = !!product;

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      sku: "",
      product_name: "",
      category: "",
      cost_price: 0,
      low_stock_threshold: 5,
      promo_ads: 20,
      tax_other: 10,
      packing: 15,
      amazon_ship: 80,
      flipkart_ship: 120,
      meesho_price: 0,
      flipkart_price: 0,
      amazon_price: 0,
    },
  })

  // Watch all inputs that affect pricing for real-time preview
  const watchedValues = form.watch([
    "cost_price", 
    "margin", 
    "promo_ads", 
    "tax_other", 
    "packing", 
    "amazon_ship", 
    "flipkart_ship"
  ])

  // Trigger recalculation logic whenever watched fields change
  React.useEffect(() => {
    const [cost, margin, ads, tax, pack, amz, flip] = watchedValues;
    
    const prices = calculateProductPrices({
      cost_price: Number(cost || 0),
      margin: Number(margin || 0),
      promo_ads: Number(ads || 0),
      tax_other: Number(tax || 0),
      packing: Number(pack || 0),
      amazon_ship: Number(amz || 0),
      flipkart_ship: Number(flip || 0)
    });

    // Bulk update the platform listing prices in the form
    form.setValue("meesho_price", prices.meesho_price, { shouldDirty: true });
    form.setValue("flipkart_price", prices.flipkart_price, { shouldDirty: true });
    form.setValue("amazon_price", prices.amazon_price, { shouldDirty: true });
  }, [watchedValues, form]);

  React.useEffect(() => {
    if (isOpen) {
      if (isEditMode && product) {
        form.reset({
          sku: product.sku,
          product_name: product.product_name,
          category: product.category || "",
          cost_price: product.cost_price,
          margin: product.margin,
          low_stock_threshold: product.low_stock_threshold,
          promo_ads: (product as any).promo_ads ?? 20,
          tax_other: (product as any).tax_other ?? 10,
          packing: (product as any).packing ?? 15,
          amazon_ship: (product as any).amazon_ship ?? 80,
          flipkart_ship: (product as any).flipkart_ship ?? 120,
          meesho_price: product.meesho_price,
          flipkart_price: product.flipkart_price,
          amazon_price: product.amazon_price,
        })
      } else {
        form.reset({
          sku: "",
          product_name: "",
          category: "",
          cost_price: 0,
          margin: 50,
          low_stock_threshold: 5,
          promo_ads: 20,
          tax_other: 10,
          packing: 15,
          amazon_ship: 80,
          flipkart_ship: 120,
          meesho_price: 0,
          flipkart_price: 0,
          amazon_price: 0,
        })
      }
    }
  }, [isOpen, product, isEditMode, form])

  const handleClose = () => {
    onClose()
  }

  async function onSubmit(values: ProductFormValues) {
    setIsSubmitting(true)
    try {
      const res = await apiFetch('/api/products', {
          method: isEditMode ? 'PUT' : 'POST',
          body: JSON.stringify({ ...values, id: product?.id })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || `Failed to ${isEditMode ? 'update' : 'add'} product.`);
      }

      toast({
        title: "Success",
        description: `Product ${isEditMode ? 'updated' : 'added'} successfully.`,
      })
      onSuccess()
      handleClose()
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
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit' : 'Add New'} Product</DialogTitle>
          <DialogDescription>
            {isEditMode ? 'Update the details for this product.' : 'Enter product details. Pricing is calculated automatically including 18% GST.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Left Column: Basic Info & Costs */}
              <div className="space-y-4">
                <h3 className="font-bold text-sm uppercase tracking-wider text-primary border-b pb-2">Core Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="sku"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>SKU</FormLabel>
                        <FormControl><Input placeholder="e.g., TS-BL-L" {...field} disabled={isEditMode} /></FormControl>
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
                        <FormControl><Input placeholder="e.g., Apparel" {...field} /></FormControl>
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
                      <FormControl><Input placeholder="e.g., T-Shirt" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

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
                        <Select onValueChange={(value) => field.onChange(Number(value))} value={String(field.value || '')}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Margin" /></SelectTrigger></FormControl>
                          <SelectContent>
                            {marginValues.map(m => (
                              <SelectItem key={m} value={String(m)}>{formatINR(m)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="promo_ads"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Ads (₹)</FormLabel>
                        <FormControl><Input type="number" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="tax_other"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Tax Misc (₹)</FormLabel>
                        <FormControl><Input type="number" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="packing"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Packing (₹)</FormLabel>
                        <FormControl><Input type="number" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Right Column: Platform Logistics & Final Pricing */}
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
                        <FormLabel className="flex justify-between items-center">
                          Meesho Listing Price 
                          <span className="text-[10px] text-muted-foreground uppercase font-black">Inc. 18% GST</span>
                        </FormLabel>
                        <FormControl><Input type="number" className="font-bold text-lg" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="flipkart_price"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Flipkart Listing</FormLabel>
                          <FormControl><Input type="number" className="font-bold" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="amazon_price"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Amazon Listing</FormLabel>
                          <FormControl><Input type="number" className="font-bold" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                    GST (18%) automatically included in price
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="low_stock_threshold"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Low Stock Alert Threshold</FormLabel>
                      <FormControl><Input type="number" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
            
            <DialogFooter className="mt-8">
              <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting} className="min-w-[150px]">
                {isSubmitting ? 'Saving...' : (isEditMode ? 'Save Changes' : 'Create Product')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
