
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
import { Textarea } from "@/components/ui/textarea"
import { format } from "date-fns"
import type { VendorPurchase } from "../page"

type Vendor = { id: string; vendor_name: string };

const formSchema = z.object({
  vendor_id: z.string().min(1, "Vendor is required"),
  product_name: z.string().min(1, "Product name is required"),
  quantity: z.coerce.number().min(1, "Quantity must be at least 1"),
  cost_per_unit: z.coerce.number().positive("Cost must be a positive number"),
  purchase_date: z.string({ required_error: "Purchase date is required" }).min(1, "Purchase date is required"),
  description: z.string().optional(),
})

type PurchaseFormValues = z.infer<typeof formSchema>

interface AddPurchaseModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  purchase?: VendorPurchase | null;
}

export function AddPurchaseModal({ isOpen, onClose, onSuccess, purchase }: AddPurchaseModalProps) {
  const supabase = createClient()
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [vendors, setVendors] = React.useState<Vendor[]>([])
  const isEditMode = !!purchase;

  const form = useForm<PurchaseFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      quantity: 1,
      cost_per_unit: 0,
      purchase_date: format(new Date(), 'yyyy-MM-dd'),
      description: "",
      product_name: "",
    },
  })

  React.useEffect(() => {
    async function fetchVendors() {
      const { data: vendorData } = await supabase.from("vendors").select("id, vendor_name").order("vendor_name")
      if (vendorData) setVendors(vendorData)
    }
    if (isOpen) {
        fetchVendors()
        if (purchase) {
            form.reset({
                vendor_id: purchase.vendor_id,
                product_name: purchase.product_name,
                quantity: purchase.quantity,
                cost_per_unit: purchase.cost_per_unit,
                purchase_date: format(new Date(purchase.purchase_date), 'yyyy-MM-dd'),
                description: purchase.description || "",
            })
        } else {
            form.reset({
                vendor_id: undefined,
                product_name: "",
                quantity: 1,
                cost_per_unit: 0,
                purchase_date: format(new Date(), 'yyyy-MM-dd'),
                description: "",
            })
        }
    }
  }, [isOpen, purchase, supabase, form])

  async function onSubmit(values: PurchaseFormValues) {
    setIsSubmitting(true)
    try {
      const purchaseData = { 
        ...values,
        purchase_date: values.purchase_date,
      };

      let error;
      if (isEditMode) {
        const { error: updateError } = await supabase.from("vendor_purchases").update(purchaseData).eq('id', purchase.id);
        error = updateError;
      } else {
        const { error: insertError } = await supabase.from("vendor_purchases").insert([purchaseData]);
        error = insertError;
      }
      
      if (error) throw error

      toast({
        title: "Success",
        description: `Vendor purchase ${isEditMode ? 'updated' : 'added'} successfully.`,
      })
      onSuccess()
      onClose()
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || `Failed to ${isEditMode ? 'update' : 'add'} purchase.`,
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit' : 'Add'} Vendor Purchase</DialogTitle>
          <DialogDescription>
             {isEditMode ? 'Update the details of this purchase.' : 'Record a new inventory purchase from a vendor.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" suppressHydrationWarning>
            <FormField
              control={form.control}
              name="vendor_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vendor</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={isEditMode}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select a vendor" /></SelectTrigger></FormControl>
                    <SelectContent>{vendors.map((v) => (<SelectItem key={v.id} value={v.id}>{v.vendor_name}</SelectItem>))}</SelectContent>
                  </Select>
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
                    <FormControl><Input placeholder="e.g. Raw Cotton Fabric" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity</FormLabel>
                    <FormControl><Input type="number" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="cost_per_unit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cost per Unit</FormLabel>
                    <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="purchase_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Purchase Date</FormLabel>
                    <FormControl>
                        <Input type="date" {...field} />
                    </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl><Textarea placeholder="Optional description for this purchase" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : 'Save'}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
