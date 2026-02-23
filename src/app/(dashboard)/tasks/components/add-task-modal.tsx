
"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { format } from "date-fns"
import type { Task } from "../page"

const formSchema = z.object({
  task_name: z.string().min(1, "Task name is required"),
  task_date: z.string({ required_error: "Task date is required" }).min(1, "Task date is required"),
  task_group: z.enum(["Fashion", "Cosmetics"], { required_error: "Task group is required" }),
  status: z.enum(["Pending", "In Progress", "Completed"], { required_error: "Status is required" }),
})

type TaskFormValues = z.infer<typeof formSchema>

interface AddTaskModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  task?: Task | null
}

export function AddTaskModal({ isOpen, onClose, onSuccess, task }: AddTaskModalProps) {
  const supabase = createClient()
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const isEditMode = !!task;

  const form = useForm<TaskFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      task_name: "",
      task_date: format(new Date(), 'yyyy-MM-dd'),
    },
  })

  React.useEffect(() => {
    if (isOpen && task) {
      form.reset({
        task_name: task.task_name,
        task_date: format(new Date(task.task_date), "yyyy-MM-dd"),
        task_group: task.task_group,
        status: task.status,
      });
    } else if (isOpen) {
      form.reset({
        task_name: "",
        task_date: format(new Date(), "yyyy-MM-dd"),
        task_group: undefined,
        status: "Pending",
      });
    }
  }, [isOpen, task, form]);


  async function onSubmit(values: TaskFormValues) {
    setIsSubmitting(true)
    try {
      let error;
      if (isEditMode) {
        const { error: updateError } = await supabase.from("tasks").update(values).eq('id', task.id);
        error = updateError;
      } else {
        const { error: insertError } = await supabase.from("tasks").insert([values]);
        error = insertError;
      }

      if (error) throw error

      toast({
        title: "Success",
        description: `Task ${isEditMode ? 'updated' : 'added'} successfully.`,
      })
      onSuccess()
      onClose()
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || `Failed to ${isEditMode ? 'update' : 'add'} task.`,
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit' : 'Add'} Task</DialogTitle>
          <DialogDescription>
            {isEditMode ? 'Update the details of the existing task.' : 'Create a new task to track.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" suppressHydrationWarning>
            <FormField
              control={form.control}
              name="task_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Task Name</FormLabel>
                  <FormControl><Textarea placeholder="Describe the task..." {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="task_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                    control={form.control}
                    name="task_group"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Group</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select a group" /></SelectTrigger></FormControl>
                            <SelectContent>
                                <SelectItem value="Fashion">Fashion</SelectItem>
                                <SelectItem value="Cosmetics">Cosmetics</SelectItem>
                            </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Status</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select a status" /></SelectTrigger></FormControl>
                            <SelectContent>
                                <SelectItem value="Pending">Pending</SelectItem>
                                <SelectItem value="In Progress">In Progress</SelectItem>
                                <SelectItem value="Completed">Completed</SelectItem>
                            </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </div>
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
