
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
import type { Product } from "../../products/page"

const formSchema = z.object({
  product_id: z.string().min(1, "Product is required"),
  color: z.string().optional(),
  size: z.string().optional(),
  stock: z.coerce.number().min(0, "Stock cannot be negative"),
})

type VariantFormValues = z.infer<typeof formSchema>

interface AddVariantModalProps {
  isOpen: boolean
  onClose: () => void
  onVariantAdded: (newVariant: any) => void
}

export function AddVariantModal({ isOpen, onClose, onVariantAdded }: AddVariantModalProps) {
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [products, setProducts] = React.useState<Pick<Product, 'id' | 'product_name'>[]>([])

  React.useEffect(() => {
    async function fetchProducts() {
      const { data, error } = await supabase.from("allproducts").select("id, product_name").order("product_name");
      if (data) {
        setProducts(data);
      }
    }
    if (isOpen) {
      fetchProducts();
    }
  }, [isOpen]);

  const form = useForm<VariantFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      product_id: "",
      color: "",
      size: "",
      stock: 0,
    },
  })

  const handleClose = () => {
    form.reset()
    onClose()
  }

  async function onSubmit(values: VariantFormValues) {
    setIsSubmitting(true)
    try {
      const { data, error } = await supabase
        .from("product_variants")
        .insert([values])
        .select(`
          *,
          allproducts (
            sku,
            product_name
          )
        `)
        .single()

      if (error) {
        throw error
      }

      toast({
        title: "Success",
        description: "Product variant added successfully.",
      })
      onVariantAdded(data)
      handleClose()
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to add variant.",
      })
    } finally {
        setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Variant</DialogTitle>
          <DialogDescription>
            Enter the details for the new product variant.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="product_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Product</FormLabel>
                   <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                      <SelectTrigger>
                          <SelectValue placeholder="Select a product" />
                      </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                      {products.map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.product_name}</SelectItem>
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
                name="color"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Color</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Blue" {...field} />
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
            <FormField
              control={form.control}
              name="stock"
              render={({ field }) => (
                  <FormItem>
                  <FormLabel>Stock</FormLabel>
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
                {isSubmitting ? 'Saving...' : 'Save Variant'}
                </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
