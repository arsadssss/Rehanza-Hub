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
import { Textarea } from "@/components/ui/textarea"
import type { Return } from "../page"
import { format } from "date-fns"
import { apiFetch } from "@/lib/apiFetch"

const formSchema = z.object({
  external_return_id: z.string().min(1, "Return ID is required"),
  return_date: z.string().min(1, "Return date is required"),
  platform: z.enum(["Meesho", "Flipkart", "Amazon"], { required_error: "Platform is required" }),
  variant_id: z.string().min(1, "Variant is required"),
  quantity: z.coerce.number().min(1, "Quantity must be at least 1"),
  refund_amount: z.coerce.number().min(0, "Refund amount must be 0 or more"),
  return_type: z.enum(["RTO", "DTO", "CUSTOMER_RETURN", "EXCHANGE", "OTHER"], { required_error: "Return type is required" }),
  return_reason: z.string().optional(),
})

type ReturnFormValues = z.infer<typeof formSchema>

interface AddReturnModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  returnItem?: Return | null;
}

export function AddReturnModal({ isOpen, onClose, onSuccess, returnItem }: AddReturnModalProps) {
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [variants, setVariants] = React.useState<{id: string, variant_sku: string, stock: number}[]>([])
  const isEditMode = !!returnItem?.id;

  const form = useForm<ReturnFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      external_return_id: "",
      quantity: 1,
      refund_amount: 0,
      return_date: format(new Date(), 'yyyy-MM-dd'),
      return_type: "OTHER",
      return_reason: "",
    },
  })

  React.useEffect(() => {
    async function fetchVariants() {
        try {
            const res = await apiFetch('/api/products?type=variants');
            if (!res.ok) throw new Error('Failed to fetch variants');
            const data = await res.json();
            setVariants(data);
        } catch(e) {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not load product variants.'})
        }
    }
    if (isOpen) {
      fetchVariants();
      if (returnItem?.id) {
          form.reset({
            external_return_id: (returnItem as any).external_return_id || "",
            return_date: format(new Date(returnItem.return_date), 'yyyy-MM-dd'),
            platform: returnItem.platform,
            variant_id: returnItem.variant_id,
            quantity: returnItem.quantity,
            refund_amount: (returnItem as any).refund_amount || 0,
            return_type: (returnItem as any).return_type || "OTHER",
            return_reason: (returnItem as any).return_reason || "",
          });
      } else {
        form.reset({
          external_return_id: "",
          quantity: 1,
          refund_amount: 0,
          return_date: format(new Date(), 'yyyy-MM-dd'),
          platform: undefined,
          variant_id: undefined,
          return_type: "OTHER",
          return_reason: "",
        });
      }
    }
  }, [isOpen, returnItem, toast, form]);

  async function onSubmit(values: ReturnFormValues) {
    setIsSubmitting(true)
    try {
      const payload = {
          ...values,
          id: returnItem?.id,
      };

      const res = await apiFetch('/api/returns', {
          method: isEditMode ? 'PUT' : 'POST',
          body: JSON.stringify(payload)
      });
      
      if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.message || 'Failed to save return.');
      }
      
      toast({
        title: "Success",
        description: `Return ${isEditMode ? 'updated' : 'added'} successfully.`,
      });
      onSuccess();
      onClose();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } finally {
        setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit' : 'Add New'} Return</DialogTitle>
          <DialogDescription>
            Enter return details exactly as per the platform dashboard.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" suppressHydrationWarning>
            <FormField
              control={form.control}
              name="external_return_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>External Return ID</FormLabel>
                  <FormControl><Input placeholder="e.g. RET-12345" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="return_date" render={({ field }) => (
                <FormItem>
                  <FormLabel>Return Date</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField
                control={form.control}
                name="platform"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Platform</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select platform" />
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
            </div>

            <FormField
              control={form.control}
              name="variant_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Variant</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select SKU" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {variants.map(v => (
                        <SelectItem key={v.id} value={v.id}>{v.variant_sku}</SelectItem>
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
                    <FormControl><Input type="number" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="refund_amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Refund Amount (₹)</FormLabel>
                    <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="return_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Return Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="RTO">RTO</SelectItem>
                      <SelectItem value="DTO">DTO</SelectItem>
                      <SelectItem value="CUSTOMER_RETURN">Customer Return</SelectItem>
                      <SelectItem value="EXCHANGE">Exchange</SelectItem>
                      <SelectItem value="OTHER">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="return_reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Return Reason (Optional)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Details about return status or condition..." 
                      className="resize-none"
                      {...field} 
                    />
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
                {isSubmitting ? 'Saving...' : (isEditMode ? 'Save Changes' : 'Save Return')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}