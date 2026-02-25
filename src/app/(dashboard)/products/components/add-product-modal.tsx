
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Product } from "../page"
import { formatINR } from "@/lib/format"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const formSchema = z.object({
  sku: z.string().min(1, "SKU is required"),
  product_name: z.string().min(1, "Product Name is required"),
  category: z.string().optional(),
  cost_price: z.coerce.number().positive("Cost Price must be positive"),
  margin: z.coerce.number().positive("Margin is required"),
  low_stock_threshold: z.coerce.number().min(0, "Low stock threshold cannot be negative").default(5),
})

type ProductFormValues = z.infer<typeof formSchema>

// Constants from the requirements
const PROMO_ADS = 20
const TAX_OTHER = 10
const PACKING = 15
const AMAZON_SHIP = 80
const BASE_CHARGES = 45

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

  const [previewPrices, setPreviewPrices] = React.useState({ meesho: 0, flipkart: 0, amazon: 0 })

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      sku: "",
      product_name: "",
      category: "",
      cost_price: 0,
      low_stock_threshold: 5,
    },
  })

  const cost_price = form.watch("cost_price")
  const margin = form.watch("margin")

  React.useEffect(() => {
    const cost = Number(cost_price) || 0;
    const prof = Number(margin) || 0;

    if (cost > 0 && prof > 0) {
      const meeshoPrice = cost + BASE_CHARGES + prof
      const flipkartPrice = meeshoPrice
      const amazonPrice = meeshoPrice + AMAZON_SHIP
      setPreviewPrices({ meesho: meeshoPrice, flipkart: flipkartPrice, amazon: amazonPrice })
    } else {
      setPreviewPrices({ meesho: 0, flipkart: 0, amazon: 0 })
    }
  }, [cost_price, margin]);

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
        })
      } else {
        form.reset({
          sku: "",
          product_name: "",
          category: "",
          cost_price: 0,
          margin: undefined,
          low_stock_threshold: 5,
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
      const productData = {
        ...values,
        id: product?.id, // for updates
        promo_ads: PROMO_ADS,
        tax_other: TAX_OTHER,
        packing: PACKING,
        amazon_ship: AMAZON_SHIP,
        meesho_price: previewPrices.meesho,
        flipkart_price: previewPrices.flipkart,
        amazon_price: previewPrices.amazon,
      }
      
      const res = await fetch('/api/products', {
          method: isEditMode ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(productData)
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
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit' : 'Add New'} Product</DialogTitle>
          <DialogDescription>
            {isEditMode ? 'Update the details for this product.' : 'Enter the details of the new product. Selling prices will be calculated automatically.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            <div className="space-y-4">
               <FormField
                control={form.control}
                name="sku"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SKU</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., TS-BL-L" {...field} disabled={isEditMode} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="product_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., T-Shirt" {...field} />
                    </FormControl>
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
                    <FormControl>
                      <Input placeholder="e.g., Apparel" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                  <FormField
                  control={form.control}
                  name="cost_price"
                  render={({ field }) => (
                      <FormItem>
                      <FormLabel>Cost Price</FormLabel>
                      <FormControl>
                          <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                      </FormItem>
                  )}
                  />
                  <FormField
                  control={form.control}
                  name="margin"
                  render={({ field }) => (
                      <FormItem>
                      <FormLabel>Margin</FormLabel>
                       <Select onValueChange={(value) => field.onChange(Number(value))} value={String(field.value || '')}>
                          <FormControl>
                          <SelectTrigger>
                              <SelectValue placeholder="Select margin" />
                          </SelectTrigger>
                          </FormControl>
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
               <FormField
                  control={form.control}
                  name="low_stock_threshold"
                  render={({ field }) => (
                      <FormItem>
                      <FormLabel>Low Stock Threshold</FormLabel>
                      <FormControl>
                          <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                      </FormItem>
                  )}
                />
            </div>

            <div className="space-y-4">
              <Card className="bg-muted/50">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg">Live Price Preview</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Meesho Price:</span>
                      <span className="font-semibold">{formatINR(previewPrices.meesho)}</span>
                    </div>
                     <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Flipkart Price:</span>
                      <span className="font-semibold">{formatINR(previewPrices.flipkart)}</span>
                    </div>
                     <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Amazon Price:</span>
                      <span className="font-semibold">{formatINR(previewPrices.amazon)}</span>
                    </div>
                </CardContent>
              </Card>
            </div>
            
            <div className="col-span-1 md:col-span-2">
              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : (isEditMode ? 'Save Changes' : 'Save Product')}
                  </Button>
              </DialogFooter>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
