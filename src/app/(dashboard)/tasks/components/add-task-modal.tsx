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
import { useSession } from "next-auth/react"
import { cn } from "@/lib/utils"

const formSchema = z.object({
  task_name: z.string().min(1, "Task name is required"),
  task_date: z.string({ required_error: "Task date is required" }).min(1, "Task date is required"),
  task_group: z.enum(["Fashion", "Cosmetics"], { required_error: "Task group is required" }),
  status: z.enum(["Pending", "In Progress", "Completed"], { required_error: "Status is required" }),
  notes: z.string().optional(),
  is_today: z.boolean().default(false),
  is_listing_task: z.boolean().default(false),
  created_by: z.string().min(1, "Owner assignment is required"),
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
  const { data: session } = useSession()
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [users, setUsers] = React.useState<{id: string, name: string}[]>([])
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
      created_by: session?.user?.id || "",
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

  // Fetch users for assignment dropdown
  React.useEffect(() => {
    async function fetchUsers() {
      try {
        const res = await apiFetch('/api/users');
        if (res.ok) setUsers(await res.json());
      } catch (e) { console.error(e); }
    }
    if (isOpen) fetchUsers();
  }, [isOpen]);

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
        created_by: task.created_by,
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
        created_by: session?.user?.id || "",
        listing_steps: {
          imageGeneration: false,
          meesho: false,
          flipkart: false,
          amazon: false
        }
      });
    }
  }, [isOpen, task, form, session]);


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
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto rounded-[2rem] border-0 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="font-headline text-2xl font-black tracking-tight">{isEditMode ? 'Edit' : 'Create'} Task</DialogTitle>
          <DialogDescription className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">
            {isEditMode ? 'Update the details of the existing execution item.' : 'Initialize a new operational workflow.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" suppressHydrationWarning>
            <FormField
              control={form.control}
              name="task_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Task Definition</FormLabel>
                  <FormControl><Textarea placeholder="Describe the execution objective..." className="bg-muted/30 border-0 rounded-2xl min-h-[100px] resize-none focus-visible:ring-primary/20" {...field} /></FormControl>
                  <FormMessage className="text-[10px] font-bold" />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                    control={form.control}
                    name="task_group"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Category</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger className="bg-muted/30 border-0 rounded-xl h-11"><SelectValue placeholder="Select Group" /></SelectTrigger></FormControl>
                            <SelectContent className="rounded-xl">
                                <SelectItem value="Fashion" className="text-xs font-bold uppercase">Fashion</SelectItem>
                                <SelectItem value="Cosmetics" className="text-xs font-bold uppercase">Cosmetics</SelectItem>
                            </SelectContent>
                            </Select>
                            <FormMessage className="text-[10px] font-bold" />
                        </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="task_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Execution Date</FormLabel>
                        <FormControl><Input type="date" className="bg-muted/30 border-0 rounded-xl h-11" {...field} /></FormControl>
                        <FormMessage className="text-[10px] font-bold" />
                      </FormItem>
                    )}
                  />
            </div>

            <FormField
              control={form.control}
              name="created_by"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Owner Assignment</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-muted/30 border-0 rounded-xl h-11">
                        <SelectValue placeholder="Select team member" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="rounded-xl">
                      {users.map(u => (
                        <SelectItem key={u.id} value={u.id} className="text-xs font-bold uppercase">
                          {u.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage className="text-[10px] font-bold" />
                </FormItem>
              )}
            />

            <div className="space-y-4 rounded-[1.5rem] border border-border/50 p-5 bg-muted/10 shadow-inner">
              <FormField
                control={form.control}
                name="is_today"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between space-y-0">
                    <div className="space-y-0.5">
                      <FormLabel className="text-sm font-black uppercase tracking-tight">Priority Queue</FormLabel>
                      <FormDescription className="text-[9px] font-bold uppercase text-muted-foreground">Add to "Today Tasks" execution list</FormDescription>
                    </div>
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        className="rounded-md h-5 w-5"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="h-px bg-border/50 my-4" />

              <FormField
                control={form.control}
                name="is_listing_task"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between space-y-0">
                    <div className="space-y-0.5">
                      <FormLabel className="text-sm font-black text-primary uppercase tracking-tight">Marketplace Listing</FormLabel>
                      <FormDescription className="text-[9px] font-bold uppercase text-muted-foreground">Enable specialized platform workflow</FormDescription>
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
                <div className="pt-4 mt-4 border-t border-border/30 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-3">Live Workflow Progression</p>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { key: 'imageGeneration', label: 'Imagery' },
                      { key: 'meesho', label: 'Meesho' },
                      { key: 'flipkart', label: 'Flipkart' },
                      { key: 'amazon', label: 'Amazon' }
                    ].map((step) => (
                      <FormField
                        key={step.key}
                        control={form.control}
                        name={`listing_steps.${step.key}` as any}
                        render={({ field }) => (
                          <FormItem className="flex items-center space-x-3 space-y-0 bg-white/50 dark:bg-white/5 p-3 rounded-xl border border-transparent hover:border-primary/20 transition-all">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                className="h-4 w-4"
                              />
                            </FormControl>
                            <FormLabel className="text-[10px] font-black uppercase tracking-widest cursor-pointer leading-none">
                              {step.label}
                            </FormLabel>
                          </FormItem>
                        )}
                      />
                    ))}
                  </div>
                  <p className="text-[9px] text-muted-foreground italic font-medium">Status dynamically adapts based on workflow completion.</p>
                </div>
              )}
            </div>

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                  <FormItem className={cn(isListingTask && "opacity-50 pointer-events-none")}>
                      <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Manual Status Override</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={isListingTask}>
                      <FormControl><SelectTrigger className="bg-muted/30 border-0 rounded-xl h-11"><SelectValue placeholder="Execution Stage" /></SelectTrigger></FormControl>
                      <SelectContent className="rounded-xl">
                          <SelectItem value="Pending" className="text-xs font-bold uppercase">Pending</SelectItem>
                          <SelectItem value="In Progress" className="text-xs font-bold uppercase text-amber-600">In Progress</SelectItem>
                          <SelectItem value="Completed" className="text-xs font-bold uppercase text-emerald-600">Completed</SelectItem>
                      </SelectContent>
                      </Select>
                      {isListingTask && <FormDescription className="text-[9px] font-bold text-primary/60 uppercase">Calculated via Workflow</FormDescription>}
                      <FormMessage className="text-[10px] font-bold" />
                  </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Additional Briefing (Optional)</FormLabel>
                  <FormControl><Textarea placeholder="Context, links, or specific constraints..." className="bg-muted/30 border-0 rounded-2xl min-h-[80px] resize-none focus-visible:ring-primary/20" {...field} value={field.value ?? ""} /></FormControl>
                  <FormMessage className="text-[10px] font-bold" />
                </FormItem>
              )}
            />

            <DialogFooter className="pt-2">
              <Button type="button" variant="ghost" onClick={onClose} className="rounded-xl font-bold px-6">Cancel</Button>
              <Button type="submit" disabled={isSubmitting} className="font-black h-12 px-10 rounded-xl shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all">
                {isSubmitting ? 'COMMITTING...' : (isEditMode ? 'UPDATE TASK' : 'AUTHORIZE TASK')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
