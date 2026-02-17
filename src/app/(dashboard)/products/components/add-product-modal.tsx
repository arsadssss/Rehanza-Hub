
"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"

import { supabase } from "@/lib/supabase"
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

const formSchema = z.object({
  sku: z.string().min(1, "SKU is required"),
  product_name: z.string().min(1, "Product Name is required"),
  category: z.string().optional(),
  size: z.string().optional(),
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

interface AddProductModalProps {
  isOpen: boolean
  onClose: () => void
  onProductAdded: () => void
}

export function AddProductModal({ isOpen, onClose, onProductAdded }: AddProductModalProps) {
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      sku: "",
      product_name: "",
      category: "",
      size: "",
      cost_price: 0,
      low_stock_threshold: 5,
    },
  })

  const handleClose = () => {
    form.reset()
    onClose()
  }

  async function onSubmit(values: ProductFormValues) {
    setIsSubmitting(true)
    try {
      // Calculate prices
      const meeshoPrice = values.cost_price + BASE_CHARGES + values.margin
      const flipkartPrice = meeshoPrice
      const amazonPrice = meeshoPrice + AMAZON_SHIP

      const newProductData = {
        ...values,
        promo_ads: PROMO_ADS,
        tax_other: TAX_OTHER,
        packing: PACKING,
        amazon_ship: AMAZON_SHIP,
        meesho_price: meeshoPrice,
        flipkart_price: flipkartPrice,
        amazon_price: amazonPrice,
      }
      
      const { data, error } = await supabase
        .from("allproducts")
        .insert([newProductData])
        .select()
        .single()

      if (error) {
        throw error
      }

      toast({
        title: "Success",
        description: "Product added successfully.",
      })
      onProductAdded()
      handleClose()
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to add product.",
      })
    } finally {
        setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Product</DialogTitle>
          <DialogDescription>
            Enter the details of the new product. Selling prices will be calculated automatically.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="sku"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SKU</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., TS-BL-L" {...field} />
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
            </div>
             <div className="grid grid-cols-2 gap-4">
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
              <FormField
                control={form.control}
                name="size"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Size</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., L" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
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
                     <Select onValueChange={(value) => field.onChange(Number(value))} defaultValue={String(field.value)}>
                        <FormControl>
                        <SelectTrigger>
                            <SelectValue placeholder="Select margin" />
                        </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                        {marginValues.map(m => (
                            <SelectItem key={m} value={String(m)}>{m}</SelectItem>
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
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Save Product'}
                </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
