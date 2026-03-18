
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
import { apiFetch } from "@/lib/apiFetch"
import { Cloud, Link as LinkIcon, Tag as TagIcon, Sparkles } from "lucide-react"

const formSchema = z.object({
  title: z.string().min(1, "Title is required"),
  image_url: z.string().url("Must be a valid URL"),
  category: z.string().min(1, "Category is required"),
  tags_input: z.string().optional(),
})

type FormValues = z.infer<typeof formSchema>

interface AddImageModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function AddImageModal({ isOpen, onClose, onSuccess }: AddImageModalProps) {
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      image_url: "",
      category: "",
      tags_input: "",
    },
  })

  async function onSubmit(values: FormValues) {
    setIsSubmitting(true)
    try {
      const tags = values.tags_input 
        ? values.tags_input.split(',').map(t => t.trim().toLowerCase()).filter(Boolean)
        : [];

      const res = await apiFetch('/api/image-library', {
        method: 'POST',
        body: JSON.stringify({
          title: values.title,
          image_url: values.image_url,
          category: values.category,
          tags
        })
      });

      if (!res.ok) throw new Error("Failed to save asset");

      toast({
        title: "Asset Authorized",
        description: "Media link added to your central registry.",
      });
      onSuccess();
      onClose();
      form.reset();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } finally {
      setIsSubmitting(false)
    }
  }

  const categories = ["Makeup", "Nail", "Foundation", "Skincare", "Apparel", "Marketing", "Other"];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md rounded-[2.5rem] border-0 shadow-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-primary/10 rounded-xl text-primary">
              <Cloud className="h-5 w-5" />
            </div>
            <DialogTitle className="font-headline text-2xl font-black tracking-tight">New Asset</DialogTitle>
          </div>
          <DialogDescription className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Register a cloud-hosted media link for team access.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Asset Title</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Lipstick Front Shot" className="bg-muted/30 border-0 rounded-xl h-11" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="image_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Google Drive / Public URL</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input 
                        placeholder="https://drive.google.com/..." 
                        className="pl-10 bg-muted/30 border-0 rounded-xl h-11" 
                        {...field} 
                      />
                    </div>
                  </FormControl>
                  <FormDescription className="text-[9px] font-medium italic">GDrive links are auto-converted for preview support.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Category</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-muted/30 border-0 rounded-xl h-11">
                          <SelectValue placeholder="Select Category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="rounded-xl">
                        {categories.map(c => (
                          <SelectItem key={c} value={c} className="text-xs font-bold">{c.toUpperCase()}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="tags_input"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Tags (Comma Sep)</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <TagIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="front, matte, red" className="pl-10 bg-muted/30 border-0 rounded-xl h-11" {...field} />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="ghost" onClick={onClose} className="rounded-xl font-bold">Cancel</Button>
              <Button type="submit" disabled={isSubmitting} className="font-black h-12 px-10 rounded-xl shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all">
                {isSubmitting ? 'INDEXING...' : 'REGISTER ASSET'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
