
"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"

import { createClient } from "@/lib/supabase/client"
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
import type { Variant } from "../../products/page"
import { formatINR } from "@/lib/format"

// A more detailed type for variants that includes the parent product's prices
type VariantWithProduct = Variant & {
  allproducts: {
    sku: string;
    product_name: string;
    meesho_price: number;
    flipkart_price: number;
    amazon_price: number;
  } | null;
};

const formSchema = z.object({
  platform: z.enum(["Meesho", "Flipkart", "Amazon"], { required_error: "Platform is required" }),
  variant_id: z.string().min(1, "Variant is required"),
  quantity: z.coerce.number().min(1, "Quantity must be at least 1"),
})

type OrderFormValues = z.infer<typeof formSchema>

interface AddOrderModalProps {
  isOpen: boolean
  onClose: () => void
  onOrderAdded: () => void
}

export function AddOrderModal({ isOpen, onClose, onOrderAdded }: AddOrderModalProps) {
  const supabase = createClient();
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [variants, setVariants] = React.useState<VariantWithProduct[]>([])
  const [sellingPrice, setSellingPrice] = React.useState<number | null>(null)

  const form = useForm<OrderFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      quantity: 1,
    },
  })

  const platform = form.watch("platform")
  const variantId = form.watch("variant_id")

  React.useEffect(() => {
    async function fetchVariants() {
      const { data, error } = await supabase
        .from("product_variants")
        .select(`
          *,
          allproducts (
            sku,
            product_name,
            meesho_price,
            flipkart_price,
            amazon_price
          )
        `)
        .order("variant_sku");
        
      if (data) {
        setVariants(data as any as VariantWithProduct[]);
      }
    }
    if (isOpen) {
      fetchVariants();
    }
  }, [isOpen, supabase]);

  React.useEffect(() => {
    if (platform && variantId) {
      const selectedVariant = variants.find(v => v.id === variantId);
      if (selectedVariant && selectedVariant.allproducts) {
        switch (platform) {
          case "Meesho":
            setSellingPrice(selectedVariant.allproducts.meesho_price);
            break;
          case "Flipkart":
            setSellingPrice(selectedVariant.allproducts.flipkart_price);
            break;
          case "Amazon":
            setSellingPrice(selectedVariant.allproducts.amazon_price);
            break;
          default:
            setSellingPrice(null);
        }
      }
    } else {
      setSellingPrice(null);
    }
  }, [platform, variantId, variants]);


  const handleClose = () => {
    form.reset()
    setSellingPrice(null)
    onClose()
  }

  async function onSubmit(values: OrderFormValues) {
    if (sellingPrice === null) {
        toast({
            variant: "destructive",
            title: "Error",
            description: "Selling price could not be determined. Please re-select platform and variant.",
        });
        return;
    }
    
    setIsSubmitting(true)
    try {
      const newOrderData = {
        ...values,
        selling_price: sellingPrice,
        order_date: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("orders")
        .insert([newOrderData])
        .select()
        .single()

      if (error) {
        throw error
      }

      toast({
        title: "Success",
        description: "Order added successfully.",
      })
      onOrderAdded()
      handleClose()
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to add order.",
      })
    } finally {
        setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Order</DialogTitle>
          <DialogDescription>
            Enter the details for the new order. Stock will be deducted automatically.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="platform"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Platform</FormLabel>
                   <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                      <SelectTrigger>
                          <SelectValue placeholder="Select a platform" />
                      </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                          <SelectItem value="Meesho">Meesho</SelectItem>
                          <SelectItem value="Flipkart">Flipkart</SelectItem>
                          <SelectItem value="Amazon">Amazon</SelectItem>
                      </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="variant_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Variant</FormLabel>
                   <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                      <SelectTrigger>
                          <SelectValue placeholder="Select a variant SKU" />
                      </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                      {variants.map(v => (
                          <SelectItem key={v.id} value={v.id}>{v.variant_sku} - (Stock: {v.stock})</SelectItem>
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
                name="quantity"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Quantity</FormLabel>
                    <FormControl>
                        <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                 <FormItem>
                    <FormLabel>Selling Price</FormLabel>
                    <Input
                        type="text"
                        value={sellingPrice !== null ? formatINR(sellingPrice) : 'N/A'}
                        disabled
                        className="bg-muted"
                    />
                 </FormItem>
            </div>
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Save Order'}
                </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
