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
import type { Variant } from "../page"
import { apiFetch } from "@/lib/apiFetch"

const formSchema = z.object({
  stock: z.coerce.number().min(0, "Stock cannot be negative"),
})

type VariantFormValues = z.infer<typeof formSchema>

interface EditVariantModalProps {
  isOpen: boolean
  onClose: () => void
  onVariantUpdated: () => void
  variant: Variant | null
}

export function EditVariantModal({ isOpen, onClose, onVariantUpdated, variant }: EditVariantModalProps) {
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const form = useForm<VariantFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      stock: 0,
    },
  })

  React.useEffect(() => {
    if (variant) {
      form.reset({
        stock: variant.stock,
      })
    }
  }, [variant, form])

  async function onSubmit(values: VariantFormValues) {
    if (!variant) return;
    setIsSubmitting(true)
    try {
      const res = await apiFetch('/api/variants', {
          method: 'PUT',
          body: JSON.stringify({ id: variant.id, stock: values.stock })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to update variant stock.");
      }

      toast({
        title: "Success",
        description: "Variant stock updated successfully.",
      })
      onVariantUpdated()
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
          <DialogTitle>Edit Variant Stock</DialogTitle>
          <DialogDescription>
            Update the stock quantity for variant: <strong>{variant?.variant_sku}</strong>
          </DialogDescription>
        </DialogHeader>
        {variant && (
            <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                 <div>
                    <p className="text-sm font-medium">Product</p>
                    <p className="text-sm text-muted-foreground">{variant.allproducts?.product_name} ({variant.allproducts?.sku})</p>
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                        <p className="text-sm font-medium">Color</p>
                        <p className="text-sm text-muted-foreground">{variant.color || 'N/A'}</p>
                    </div>
                     <div>
                        <p className="text-sm font-medium">Size</p>
                        <p className="text-sm text-muted-foreground">{variant.size || 'N/A'}</p>
                    </div>
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
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                  </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  )
}
