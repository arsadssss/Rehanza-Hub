
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
import { Textarea } from "@/components/ui/textarea"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { CalendarIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { format } from "date-fns"

const formSchema = z.object({
  description: z.string().min(1, "Description is required"),
  amount: z.coerce.number().positive("Amount must be a positive number"),
  expense_date: z.date({ required_error: "Expense date is required" }),
})

type ExpenseFormValues = z.infer<typeof formSchema>

interface AddExpenseModalProps {
  isOpen: boolean
  onClose: () => void
  onExpenseAdded: () => void
}

export function AddExpenseModal({ isOpen, onClose, onExpenseAdded }: AddExpenseModalProps) {
  const supabase = createClient()
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const form = useForm<ExpenseFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      description: "",
      amount: 0,
      expense_date: new Date(),
    },
  })

  const handleClose = () => {
    form.reset()
    onClose()
  }

  async function onSubmit(values: ExpenseFormValues) {
    setIsSubmitting(true)
    try {
      // These fields are no longer in the form, so we can add them with defaults if needed
      // or assume the database handles them (e.g., nullable or default values)
      const expenseData = {
        ...values,
        gst_account: 'Fashion', // Example default, adjust if needed or remove
        category: 'General', // Example default, adjust if needed or remove
      }

      const { error } = await supabase.from("business_expenses").insert([expenseData])
      if (error) throw error

      toast({
        title: "Success",
        description: "Expense added successfully.",
      })
      onExpenseAdded()
      handleClose()
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to add expense.",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Business Expense</DialogTitle>
          <DialogDescription>Record a new business-related expense.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="expense_date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Expense Date</FormLabel>
                  <Popover>
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
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                    </PopoverContent>
                  </Popover>
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
                    <FormControl><Textarea placeholder="Detailed description of the expense" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : 'Save Expense'}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
