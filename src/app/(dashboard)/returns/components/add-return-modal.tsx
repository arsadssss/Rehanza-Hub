
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
import { Switch } from "@/components/ui/switch"
import type { Return } from "../page"
import { format } from "date-fns"

const formSchema = z.object({
  return_date: z.string().min(1, "Return date is required"),
  platform: z.enum(["Meesho", "Flipkart", "Amazon"], { required_error: "Platform is required" }),
  variant_id: z.string().min(1, "Variant is required"),
  quantity: z.coerce.number().min(1, "Quantity must be at least 1"),
  restockable: z.boolean().default(false),
  shipping_loss: z.coerce.number().min(0).default(0),
  ads_loss: z.coerce.number().min(0).default(0),
  damage_loss: z.coerce.number().min(0).default(0),
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
      quantity: 1,
      restockable: false,
      shipping_loss: 0,
      ads_loss: 0,
      damage_loss: 0,
      return_date: format(new Date(), 'yyyy-MM-dd'),
    },
  })

  React.useEffect(() => {
    async function fetchVariants() {
        try {
            const res = await fetch('/api/products?type=variants');
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
          const { created_at, total_loss, is_deleted, ...rest } = returnItem;
          form.reset({
            ...rest,
            return_date: format(new Date(returnItem.return_date), 'yyyy-MM-dd'),
            // Individual losses are not stored, so they cannot be pre-filled in edit mode.
            // A DB trigger calculates total_loss from these.
            shipping_loss: 0,
            ads_loss: 0,
            damage_loss: 0,
          });
      } else {
        form.reset({
          quantity: 1,
          restockable: false,
          shipping_loss: 0,
          ads_loss: 0,
          damage_loss: 0,
          return_date: format(new Date(), 'yyyy-MM-dd'),
          platform: undefined,
          variant_id: undefined,
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

      const res = await fetch('/api/returns', {
          method: isEditMode ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
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
            {isEditMode ? 'Update the details of this return.' : 'Enter the details for the new return. Stock will be adjusted if restockable.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" suppressHydrationWarning>
             <FormField control={form.control} name="return_date" render={({ field }) => (
                <FormItem>
                  <FormLabel>Return Date</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            <div className="grid grid-cols-2 gap-4">
                <FormField
                control={form.control}
                name="platform"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Platform</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                        <SelectTrigger>
                            <SelectValue placeholder="Select a platform" />
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
                <FormField
                control={form.control}
                name="variant_id"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Variant</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                        <SelectTrigger>
                            <SelectValue placeholder="Select a variant SKU" />
                        </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                        {variants.map(v => (
                            <SelectItem key={v.id} value={v.id}>{v.variant_sku} - (Stock: {v.stock})</SelectItem>
                        ))}
                        </SelectContent>
                    </Select>
                    <FormMessage />
                    </FormItem>
                )}
                />
            </div>
            <div className="grid grid-cols-2 gap-4 items-end">
                <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Quantity</FormLabel>
                    <FormControl>
                        <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                 <FormField
                  control={form.control}
                  name="restockable"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <FormLabel className="pr-2">Restockable?</FormLabel>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
            </div>

            <p className="text-sm font-medium">Losses {isEditMode && '(re-enter to update)'}</p>
            <div className="grid grid-cols-3 gap-4">
                <FormField
                control={form.control}
                name="shipping_loss"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Shipping</FormLabel>
                    <FormControl>
                        <Input type="number" step="any" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                <FormField
                control={form.control}
                name="ads_loss"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Ads</FormLabel>
                    <FormControl>
                        <Input type="number" step="any" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                <FormField
                control={form.control}
                name="damage_loss"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Damage</FormLabel>
                    <FormControl>
                        <Input type="number" step="any" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
            </div>
            
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
