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
import { apiFetch } from "@/lib/apiFetch"

const ORDER_STATUSES = [
  "DELIVERED",
  "SHIPPED",
  "READY_TO_SHIP",
  "CANCELLED",
  "RTO_INITIATED",
  "RTO_LOCKED",
  "RTO_COMPLETE",
  "DOOR_STEP_EXCHANGED",
  "HOLD",
  "RETURNED",
  "RETURN_REQUESTED",
  "APPROVED",
  "UNSHIPPED",
  "PENDING",
  "REFUND_APPLIED"
] as const;

const formSchema = z.object({
  external_order_id: z.string().min(1, "Order ID is required"),
  order_date: z.string().min(1, "Order date is required"),
  platform: z.enum(["Meesho", "Flipkart", "Amazon"], { required_error: "Platform is required" }),
  variant_id: z.string().min(1, "Variant is required"),
  quantity: z.coerce.number().min(1, "Quantity must be at least 1"),
  selling_price: z.coerce.number().min(0, "Selling price must be positive"),
  status: z.string().default("PENDING"),
})

export function AddOrderModal({ isOpen, onClose, onSuccess, order }: any) {
  const { toast } = useToast()
  const [variants, setVariants] = React.useState<any[]>([])
  const isEditMode = !!order?.id;

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: { 
      external_order_id: "",
      quantity: 1, 
      order_date: format(new Date(), 'yyyy-MM-dd'),
      selling_price: 0,
      status: "PENDING"
    }
  })

  const selectedPlatform = form.watch("platform");
  const selectedVariantId = form.watch("variant_id");

  // Auto-fill Unit Price logic
  React.useEffect(() => {
    if (!selectedPlatform || !selectedVariantId || variants.length === 0 || isEditMode) return;

    const variant = variants.find(v => v.id === selectedVariantId);
    if (!variant) return;

    let price = 0;
    if (selectedPlatform === "Meesho") price = variant.meesho_price;
    if (selectedPlatform === "Flipkart") price = variant.flipkart_price;
    if (selectedPlatform === "Amazon") price = variant.amazon_price;

    if (price > 0) {
      form.setValue("selling_price", price);
    }
  }, [selectedPlatform, selectedVariantId, variants, form, isEditMode]);

  React.useEffect(() => {
    async function fetchVariants() {
      try {
        const res = await apiFetch('/api/products?type=variants');
        if (res.ok) setVariants(await res.json());
      } catch (error) { toast({ variant: 'destructive', title: 'Error', description: 'Could not load variants.' }); }
    }
    if (isOpen) {
      fetchVariants();
      if (isEditMode && order) {
        form.reset({
          external_order_id: order.external_order_id || "",
          order_date: format(new Date(order.order_date), 'yyyy-MM-dd'),
          platform: order.platform,
          variant_id: order.variant_id,
          quantity: order.quantity,
          selling_price: order.selling_price,
          status: order.status || "PENDING",
        });
      } else {
        form.reset({
          external_order_id: "",
          quantity: 1, 
          order_date: format(new Date(), 'yyyy-MM-dd'),
          selling_price: 0,
          status: "PENDING"
        });
      }
    }
  }, [isOpen, toast, isEditMode, order, form]);

  const onSubmit = async (values: any) => {
    try {
      const method = isEditMode ? 'PUT' : 'POST';
      const res = await apiFetch('/api/orders', {
        method,
        body: JSON.stringify({ ...values, id: order?.id })
      });
      
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to save order.');
      }

      toast({ title: "Success", description: "Order saved successfully." });
      onSuccess(); 
      onClose();
    } catch (error: any) { 
      toast({ 
        variant: "destructive", 
        title: "Error", 
        description: error.message 
      }); 
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{isEditMode ? 'Edit' : 'Add'} Order</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="order_date" render={({ field }) => <FormItem><FormLabel>Date</FormLabel><Input type="date" {...field} /></FormItem>} />
              <FormField control={form.control} name="platform" render={({ field }) => <FormItem><FormLabel>Platform</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Platform" /></SelectTrigger></FormControl><SelectContent><SelectItem value="Meesho">Meesho</SelectItem><SelectItem value="Flipkart">Flipkart</SelectItem><SelectItem value="Amazon">Amazon</SelectItem></SelectContent></Select></FormItem>} />
            </div>
            
            <FormField control={form.control} name="external_order_id" render={({ field }) => <FormItem><FormLabel>Order ID</FormLabel><FormControl><Input placeholder="Enter Platform Order ID" {...field} /></FormControl><FormMessage /></FormItem>} />

            <FormField control={form.control} name="variant_id" render={({ field }) => <FormItem><FormLabel>Variant</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a variant" /></SelectTrigger></FormControl><SelectContent>{variants.map(v => <SelectItem key={v.id} value={v.id}>{v.variant_sku}</SelectItem>)}</SelectContent></Select></FormItem>} />
            
            <FormField control={form.control} name="status" render={({ field }) => (
              <FormItem>
                <FormLabel>Order Status</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger></FormControl>
                  <SelectContent>
                    {ORDER_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FormItem>
            )} />

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="quantity" render={({ field }) => <FormItem><FormLabel>Quantity</FormLabel><Input type="number" {...field} /></FormItem>} />
              <FormField control={form.control} name="selling_price" render={({ field }) => <FormItem><FormLabel>Unit Price (₹)</FormLabel><Input type="number" step="0.01" {...field} /></FormItem>} />
            </div>

            <DialogFooter>
              <Button type="submit" className="w-full">Save Order</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
