
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
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import type { VendorPayment } from "../page"

type Vendor = { id: string; vendor_name: string };

const formSchema = z.object({
  vendor_id: z.string().min(1, "Vendor is required"),
  amount: z.coerce.number().positive("Amount must be a positive number"),
  payment_date: z.date({ required_error: "Payment date is required" }),
  payment_mode: z.enum(["Bank Transfer", "Cash", "UPI", "Other"], { required_error: "Payment mode is required" }),
  notes: z.string().optional(),
})

type PaymentFormValues = z.infer<typeof formSchema>

interface AddPaymentModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  payment?: VendorPayment | null
}

export function AddPaymentModal({ isOpen, onClose, onSuccess, payment }: AddPaymentModalProps) {
  const supabase = createClient()
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [vendors, setVendors] = React.useState<Vendor[]>([])
  const [isCalendarOpen, setIsCalendarOpen] = React.useState(false)
  const isEditMode = !!payment;

  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amount: 0,
      payment_date: new Date(),
      notes: "",
    },
  })

  React.useEffect(() => {
    async function fetchVendors() {
      const { data, error } = await supabase.from("vendors").select("id, vendor_name").order("vendor_name")
      if (data) setVendors(data)
    }
    if (isOpen) {
        fetchVendors()
        if (payment) {
            form.reset({
                vendor_id: payment.vendor_id,
                amount: payment.amount,
                payment_date: new Date(payment.payment_date),
                payment_mode: payment.payment_mode,
                notes: payment.notes || "",
            });
        } else {
            form.reset({
                vendor_id: undefined,
                amount: 0,
                payment_date: new Date(),
                payment_mode: undefined,
                notes: "",
            });
        }
    }
  }, [isOpen, payment, supabase, form]);

  async function onSubmit(values: PaymentFormValues) {
    setIsSubmitting(true)
    try {
      const paymentData = { 
        ...values, 
        payment_date: format(values.payment_date, 'yyyy-MM-dd') 
      };

      let error;
      if (isEditMode) {
        const { error: updateError } = await supabase.from("vendor_payments").update(paymentData).eq('id', payment.id);
        error = updateError;
      } else {
        const { error: insertError } = await supabase.from("vendor_payments").insert([paymentData]);
        error = insertError;
      }

      if (error) throw error

      toast({
        title: "Success",
        description: `Payment ${isEditMode ? 'updated' : 'added'} successfully.`,
      })
      onSuccess()
      onClose()
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || `Failed to ${isEditMode ? 'update' : 'add'} payment.`,
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit' : 'Add'} Vendor Payment</DialogTitle>
          <DialogDescription>
            {isEditMode ? 'Update the details of this payment.' : 'Record a new payment made to a vendor.'}
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
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Select a vendor" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {vendors.map((v) => (<SelectItem key={v.id} value={v.id}>{v.vendor_name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount</FormLabel>
                    <FormControl><Input type="number" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="payment_date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Payment Date</FormLabel>
                    <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                          >
                            {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 z-50" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={(date) => {
                            if (date) field.onChange(date)
                            setIsCalendarOpen(false)
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="payment_mode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Mode</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Select a payment mode" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                      <SelectItem value="Cash">Cash</SelectItem>
                      <SelectItem value="UPI">UPI</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl><Textarea placeholder="Optional notes about the payment" {...field} /></FormControl>
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
