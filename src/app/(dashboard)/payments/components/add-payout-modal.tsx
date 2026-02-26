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
import { format } from "date-fns"
import { apiFetch } from "@/lib/apiFetch"

export type PlatformPayout = {
  id: string;
  gst_account: 'Fashion' | 'Cosmetics';
  platform: 'Meesho' | 'Flipkart' | 'Amazon';
  amount: number;
  payout_date: string;
  reference: string | null;
  is_deleted: boolean;
};

const formSchema = z.object({
  account_platform: z.enum([
    "Fashion-Meesho",
    "Fashion-Flipkart",
    "Fashion-Amazon",
    "Cosmetics-Meesho",
    "Cosmetics-Flipkart",
    "Cosmetics-Amazon",
  ], { required_error: "An account is required" }),
  amount: z.coerce.number().positive("Amount must be a positive number"),
  payout_date: z.string({ required_error: "Payout date is required" }).min(1, "Payout date is required"),
  reference: z.string().optional(),
})

type PayoutFormValues = z.infer<typeof formSchema>

interface AddPayoutModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  payout?: PlatformPayout | null
}

export function AddPayoutModal({ isOpen, onClose, onSuccess, payout }: AddPayoutModalProps) {
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const isEditMode = !!payout;

  const form = useForm<PayoutFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amount: 0,
      payout_date: format(new Date(), 'yyyy-MM-dd'),
      reference: "",
    },
  })

  React.useEffect(() => {
    if (isOpen && payout) {
      form.reset({
        account_platform: `${payout.gst_account}-${payout.platform}` as any,
        amount: payout.amount,
        payout_date: format(new Date(payout.payout_date), 'yyyy-MM-dd'),
        reference: payout.reference || "",
      });
    } else if (isOpen && !isEditMode) {
      form.reset({
        account_platform: undefined,
        amount: 0,
        payout_date: format(new Date(), 'yyyy-MM-dd'),
        reference: "",
      });
    }
  }, [isOpen, payout, form, isEditMode]);

  async function onSubmit(values: PayoutFormValues) {
    setIsSubmitting(true)
    try {
      const [gst_account, platform] = values.account_platform.split('-')
      
      const payoutData = {
        gst_account,
        platform,
        amount: values.amount,
        payout_date: values.payout_date,
        reference: values.reference,
        id: payout?.id,
      }

      const res = await apiFetch('/api/payouts', {
        method: isEditMode ? 'PUT' : 'POST',
        body: JSON.stringify(payoutData),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || `Failed to ${isEditMode ? 'update' : 'add'} payout.`);
      }

      toast({
        title: "Success",
        description: `Platform payout ${isEditMode ? 'updated' : 'added'} successfully.`,
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit' : 'Add'} Platform Payout</DialogTitle>
          <DialogDescription>
            {isEditMode ? 'Update the details of the existing payout.' : 'Record a new payout received from a sales platform.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" suppressHydrationWarning>
             <FormField
                control={form.control}
                name="account_platform"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Accounts</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select an account" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="Fashion-Meesho">Fashion - Meesho</SelectItem>
                        <SelectItem value="Fashion-Flipkart">Fashion - Flipkart</SelectItem>
                        <SelectItem value="Fashion-Amazon">Fashion - Amazon</SelectItem>
                        <SelectItem value="Cosmetics-Meesho">Cosmetics - Meesho</SelectItem>
                        <SelectItem value="Cosmetics-Flipkart">Cosmetics - Flipkart</SelectItem>
                        <SelectItem value="Cosmetics-Amazon">Cosmetics - Amazon</SelectItem>
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
                    <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                  control={form.control}
                  name="payout_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payout Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
            </div>
            <FormField
              control={form.control}
              name="reference"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reference ID</FormLabel>
                  <FormControl><Input placeholder="Optional transaction or reference ID" {...field} /></FormControl>
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
