
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { CalendarIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { format } from "date-fns"

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
  payout_date: z.date({ required_error: "Payout date is required" }),
  reference: z.string().optional(),
})

type PayoutFormValues = z.infer<typeof formSchema>

interface AddPayoutModalProps {
  isOpen: boolean
  onClose: () => void
  onPayoutAdded: () => void
}

export function AddPayoutModal({ isOpen, onClose, onPayoutAdded }: AddPayoutModalProps) {
  const supabase = createClient()
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [isCalendarOpen, setIsCalendarOpen] = React.useState(false)

  const form = useForm<PayoutFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amount: 0,
      payout_date: new Date(),
      reference: "",
    },
  })

  const handleClose = () => {
    form.reset()
    onClose()
  }

  async function onSubmit(values: PayoutFormValues) {
    setIsSubmitting(true)
    try {
      const [gst_account, platform] = values.account_platform.split('-')
      
      const payoutData = {
        gst_account,
        platform,
        amount: values.amount,
        payout_date: format(values.payout_date, 'yyyy-MM-dd'),
        reference: values.reference
      }

      const { error } = await supabase.from("platform_payouts").insert([payoutData])
      if (error) throw error

      toast({
        title: "Success",
        description: "Platform payout added successfully.",
      })
      onPayoutAdded()
      handleClose()
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to add payout.",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Platform Payout</DialogTitle>
          <DialogDescription>Record a new payout received from a sales platform.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" suppressHydrationWarning>
             <FormField
                control={form.control}
                name="account_platform"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Accounts</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                    <FormItem className="flex flex-col">
                      <FormLabel>Payout Date</FormLabel>
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
                              field.onChange(date)
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
              <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : 'Save Payout'}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
