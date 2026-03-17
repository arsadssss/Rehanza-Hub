"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { format, isToday as isDateToday, parseISO } from "date-fns"
import type { Task } from "../page"
import { apiFetch } from "@/lib/apiFetch"
import { Label } from "@/components/ui/label"

const formSchema = z.object({
  task_name: z.string().min(1, "Task name is required"),
  task_date: z.string({ required_error: "Task date is required" }).min(1, "Task date is required"),
  task_group: z.enum(["Fashion", "Cosmetics"], { required_error: "Task group is required" }),
  status: z.enum(["Pending", "In Progress", "Completed"], { required_error: "Status is required" }),
  notes: z.string().optional(),
  is_today: z.boolean().default(false),
  is_listing_task: z.boolean().default(false),
  listing_steps: z.object({
    imageGeneration: z.boolean(),
    meesho: z.boolean(),
    flipkart: z.boolean(),
    amazon: z.boolean(),
  }).optional().nullable(),
})

type TaskFormValues = z.infer<typeof formSchema>

interface AddTaskModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  task?: Task | null
}

export function AddTaskModal({ isOpen, onClose, onSuccess, task }: AddTaskModalProps) {
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const isEditMode = !!task;

  const form = useForm<TaskFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      task_name: "",
      task_date: format(new Date(), 'yyyy-MM-dd'),
      notes: "",
      is_today: true,
      is_listing_task: false,
      status: "Pending",
      listing_steps: {
        imageGeneration: false,
        meesho: false,
        flipkart: false,
        amazon: false
      }
    },
  })

  // Watch fields for conditional logic
  const selectedDate = form.watch("task_date");
  const isListingTask = form.watch("is_listing_task");

  // Fallback: If selected date is today, check the box automatically
  React.useEffect(() => {
    if (selectedDate) {
      try {
        if (isDateToday(parseISO(selectedDate))) {
          form.setValue("is_today", true);
        }
      } catch (e) {}
    }
  }, [selectedDate, form]);

  React.useEffect(() => {
    if (isOpen && task) {
      form.reset({
        task_name: task.task_name,
        task_date: format(new Date(task.task_date), "yyyy-MM-dd"),
        task_group: task.task_group,
        status: task.status,
        notes: task.notes || "",
        is_today: !!task.is_today,
        is_listing_task: !!task.is_listing_task,
        listing_steps: task.listing_steps || {
          imageGeneration: false,
          meesho: false,
          flipkart: false,
          amazon: false
        }
      });
    } else if (isOpen) {
      form.reset({
        task_name: "",
        task_date: format(new Date(), "yyyy-MM-dd"),
        task_group: undefined,
        status: "Pending",
        notes: "",
        is_today: true,
        is_listing_task: false,
        listing_steps: {
          imageGeneration: false,
          meesho: false,
          flipkart: false,
          amazon: false
        }
      });
    }
  }, [isOpen, task, form]);


  async function onSubmit(values: TaskFormValues) {
    setIsSubmitting(true)
    try {
      const payload = { ...values, id: task?.id };
      
      const res = await apiFetch('/api/tasks', {
          method: isEditMode ? 'PUT' : 'POST',
          body: JSON.stringify(payload)
      });

      if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.message || 'Failed to save task.');
      }

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
        description: error.message,
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-headline text-xl">{isEditMode ? 'Edit' : 'Add'} Task</DialogTitle>
          <DialogDescription>
            {isEditMode ? 'Update the details of the existing task.' : 'Create a new task to track.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" suppressHydrationWarning>
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                    control={form.control}
                    name="task_group"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Group</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Group" /></SelectTrigger></FormControl>
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
                    name="task_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Execution Date</FormLabel>
                        <FormControl><Input type="date" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
            </div>

            <div className="space-y-4 rounded-xl border p-4 bg-muted/20">
              <FormField
                control={form.control}
                name="is_today"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between space-y-0">
                    <div className="space-y-0.5">
                      <FormLabel className="text-sm font-bold">Priority Queue</FormLabel>
                      <FormDescription className="text-[10px]">Add to "Today Tasks" list</FormDescription>
                    </div>
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="is_listing_task"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between space-y-0">
                    <div className="space-y-0.5">
                      <FormLabel className="text-sm font-bold text-primary">Marketplace Listing Task</FormLabel>
                      <FormDescription className="text-[10px]">Enable structured listing workflow</FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {isListingTask && (
                <div className="pt-4 mt-4 border-t space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Workflow Steps</p>
                  <div className="grid grid-cols-2 gap-3">
                    {['imageGeneration', 'meesho', 'flipkart', 'amazon'].map((step) => (
                      <FormField
                        key={step}
                        control={form.control}
                        name={`listing_steps.${step}` as any}
                        render={({ field }) => (
                          <FormItem className="flex items-center space-x-2 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <FormLabel className="text-xs font-medium capitalize cursor-pointer">
                              {step.replace(/([A-Z])/g, ' $1').trim()}
                            </FormLabel>
                          </FormItem>
                        )}
                      />
                    ))}
                  </div>
                  <p className="text-[9px] text-muted-foreground italic">Status will be auto-calculated based on these steps.</p>
                </div>
              )}
            </div>

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                  <FormItem className={isListingTask ? "opacity-50 pointer-events-none" : ""}>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={isListingTask}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select a status" /></SelectTrigger></FormControl>
                      <SelectContent>
                          <SelectItem value="Pending">Pending</SelectItem>
                          <SelectItem value="In Progress">In Progress</SelectItem>
                          <SelectItem value="Completed">Completed</SelectItem>
                      </SelectContent>
                      </Select>
                      {isListingTask && <FormDescription className="text-[10px]">Controlled by Workflow Steps</FormDescription>}
                      <FormMessage />
                  </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl><Textarea placeholder="Add any relevant details..." {...field} value={field.value ?? ""} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting} className="font-bold px-8">
                {isSubmitting ? 'Saving...' : (isEditMode ? 'Update Task' : 'Create Task')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
