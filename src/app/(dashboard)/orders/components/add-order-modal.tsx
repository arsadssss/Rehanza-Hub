"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatINR } from "@/lib/format"
import { format } from "date-fns"

const formSchema = z.object({
  order_date: z.string().min(1, "Order date is required"),
  platform: z.enum(["Meesho", "Flipkart", "Amazon"], { required_error: "Platform is required" }),
  variant_id: z.string().min(1, "Variant is required"),
  quantity: z.coerce.number().min(1, "Quantity must be at least 1"),
})

export function AddOrderModal({ isOpen, onClose, onSuccess, order }: any) {
  const { toast } = useToast()
  const [variants, setVariants] = React.useState<any[]>([])
  const [sellingPrice, setSellingPrice] = React.useState<number | null>(null)
  const isEditMode = !!order?.id;

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: { quantity: 1, order_date: format(new Date(), 'yyyy-MM-dd') }
  })

  React.useEffect(() => {
    async function fetchVariants() {
      try {
        const accountId = sessionStorage.getItem("active_account") || "";
        const res = await fetch('/api/products?type=variants', { headers: { "x-account-id": accountId } });
        if (res.ok) setVariants(await res.json());
      } catch (error) { toast({ variant: 'destructive', title: 'Error', description: 'Could not load variants.' }); }
    }
    if (isOpen) fetchVariants();
  }, [isOpen, toast]);

  const onSubmit = async (values: any) => {
    try {
      const accountId = sessionStorage.getItem("active_account") || "";
      const method = isEditMode ? 'PUT' : 'POST';
      const res = await fetch('/api/orders', {
        method,
        headers: { 'Content-Type': 'application/json', "x-account-id": accountId },
        body: JSON.stringify({ ...values, selling_price: sellingPrice, id: order?.id })
      });
      if (!res.ok) throw new Error('Failed to save');
      toast({ title: "Success" });
      onSuccess(); onClose();
    } catch (error: any) { toast({ variant: "destructive", title: "Error", description: error.message }); }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>{isEditMode ? 'Edit' : 'Add'} Order</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="order_date" render={({ field }) => <FormItem><FormLabel>Date</FormLabel><Input type="date" {...field} /></FormItem>} />
            <FormField control={form.control} name="platform" render={({ field }) => <FormItem><FormLabel>Platform</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Platform" /></SelectTrigger></FormControl><SelectContent><SelectItem value="Meesho">Meesho</SelectItem><SelectItem value="Flipkart">Flipkart</SelectItem><SelectItem value="Amazon">Amazon</SelectItem></SelectContent></Select></FormItem>} />
            <FormField control={form.control} name="variant_id" render={({ field }) => <FormItem><FormLabel>Variant</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Variant" /></SelectTrigger></FormControl><SelectContent>{variants.map(v => <SelectItem key={v.id} value={v.id}>{v.variant_sku}</SelectItem>)}</SelectContent></Select></FormItem>} />
            <Button type="submit" className="w-full">Save Order</Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
