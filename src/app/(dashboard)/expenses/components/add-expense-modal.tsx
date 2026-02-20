
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
import type { BusinessExpense } from "../page"

const formSchema = z.object({
  description: z.string().min(1, "Description is required"),
  amount: z.coerce.number().positive("Amount must be a positive number"),
  expense_date: z.date({ required_error: "Expense date is required" }),
})

type ExpenseFormValues = z.infer<typeof formSchema>

interface AddExpenseModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  expense?: BusinessExpense | null
}

export function AddExpenseModal({ isOpen, onClose, onSuccess, expense }: AddExpenseModalProps) {
  const supabase = createClient()
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [isCalendarOpen, setIsCalendarOpen] = React.useState(false)
  const isEditMode = !!expense;

  const form = useForm<ExpenseFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      description: "",
      amount: 0,
      expense_date: new Date(),
    },
  })

  React.useEffect(() => {
    if (isOpen && expense) {
      form.reset({
        description: expense.description,
        amount: expense.amount,
        expense_date: new Date(expense.expense_date),
      });
    } else if (isOpen && !isEditMode) {
      form.reset({
        description: "",
        amount: 0,
        expense_date: new Date(),
      });
    }
  }, [isOpen, expense, form, isEditMode]);


  async function onSubmit(values: ExpenseFormValues) {
    setIsSubmitting(true)
    try {
      const expenseData = {
        description: values.description,
        amount: values.amount,
        expense_date: format(values.expense_date, "yyyy-MM-dd"),
        gst_account: 'Fashion', // Default value
        category: 'General',   // Default value
      }

      let error;
      if (isEditMode) {
        const { error: updateError } = await supabase.from("business_expenses").update(expenseData).eq('id', expense.id);
        error = updateError;
      } else {
        const { error: insertError } = await supabase.from("business_expenses").insert([expenseData]);
        error = insertError;
      }

      if (error) throw error

      toast({
        title: "Success",
        description: `Expense ${isEditMode ? 'updated' : 'added'} successfully.`,
      })
      onSuccess()
      onClose()
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || `Failed to ${isEditMode ? 'update' : 'add'} expense.`,
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit' : 'Add'} Business Expense</DialogTitle>
          <DialogDescription>
            {isEditMode ? 'Update the details of the existing expense.' : 'Record a new business-related expense.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" suppressHydrationWarning>
            <FormField
              control={form.control}
              name="expense_date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Expense Date</FormLabel>
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
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : 'Save'}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
