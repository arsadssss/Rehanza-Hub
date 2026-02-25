
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
import { formatINR } from "@/lib/format"
import { format } from "date-fns"
import type { Order } from "../page"

// A more detailed type for variants that includes the parent product's prices
type VariantWithProduct = {
  id: string;
  variant_sku: string;
  stock: number;
  meesho_price: number;
  flipkart_price: number;
  amazon_price: number;
};

const formSchema = z.object({
  order_date: z.string().min(1, "Order date is required"),
  platform: z.enum(["Meesho", "Flipkart", "Amazon"], { required_error: "Platform is required" }),
  variant_id: z.string().min(1, "Variant is required"),
  quantity: z.coerce.number().min(1, "Quantity must be at least 1"),
})

type OrderFormValues = z.infer<typeof formSchema>

interface AddOrderModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  order?: Order | null
}

export function AddOrderModal({ isOpen, onClose, onSuccess, order }: AddOrderModalProps) {
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [variants, setVariants] = React.useState<VariantWithProduct[]>([])
  const [sellingPrice, setSellingPrice] = React.useState<number | null>(null)
  const isEditMode = !!order?.id;

  const form = useForm<OrderFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      quantity: 1,
      order_date: format(new Date(), 'yyyy-MM-dd'),
    },
  })

  React.useEffect(() => {
    async function fetchVariants() {
      try {
        const res = await fetch('/api/products?type=variants');
        if (!res.ok) throw new Error("Failed to fetch variants");
        const data = await res.json();
        setVariants(data);
      } catch (error) {
        toast({ variant: 'destructive', title: 'Error', description: 'Could not load product variants.' });
      }
    }
    if (isOpen) {
      fetchVariants();
      if (order?.id) {
        form.reset({
          order_date: format(new Date(order.order_date), 'yyyy-MM-dd'),
          platform: order.platform,
          variant_id: order.variant_id,
          quantity: order.quantity,
        });
      } else {
        form.reset({
          order_date: format(new Date(), 'yyyy-MM-dd'),
          platform: undefined,
          variant_id: undefined,
          quantity: 1,
        });
      }
    }
  }, [isOpen, order, form, toast]);

  const platform = form.watch("platform")
  const variantId = form.watch("variant_id")

  React.useEffect(() => {
    if (platform && variantId) {
      const selectedVariant = variants.find(v => v.id === variantId);
      if (selectedVariant) {
        switch (platform) {
          case "Meesho": setSellingPrice(selectedVariant.meesho_price); break;
          case "Flipkart": setSellingPrice(selectedVariant.flipkart_price); break;
          case "Amazon": setSellingPrice(selectedVariant.amazon_price); break;
          default: setSellingPrice(null);
        }
      }
    } else if (isEditMode && order) {
      setSellingPrice(order.selling_price);
    }
     else {
      setSellingPrice(null);
    }
  }, [platform, variantId, variants, isEditMode, order]);


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
      const orderData = {
        ...values,
        id: order?.id, // Include id for updates
        selling_price: sellingPrice,
      };

      const res = await fetch('/api/orders', {
        method: isEditMode ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || `Failed to ${isEditMode ? 'save' : 'add'} order.`);
      }

      toast({
        title: "Success",
        description: `Order ${isEditMode ? 'updated' : 'added'} successfully.`,
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
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit' : 'Add New'} Order</DialogTitle>
          <DialogDescription>
            {isEditMode ? 'Update the details of this order.' : 'Enter the details for the new order. Stock will be deducted automatically.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" suppressHydrationWarning>
            <FormField
              control={form.control}
              name="order_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Order Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="platform"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Platform</FormLabel>
                   <Select onValueChange={field.onChange} value={field.value}>
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
                   <Select onValueChange={field.onChange} value={field.value}>
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
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : (isEditMode ? 'Save Changes' : 'Save Order')}
                </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
