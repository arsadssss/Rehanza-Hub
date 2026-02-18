
"use client";

import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

// --- Zod Schemas for Validation ---

const businessConfigSchema = z.object({
  businessName: z.string().min(1, 'Business name is required.'),
  contactEmail: z.string().email('Invalid email address.'),
  gstRate: z.coerce.number().min(0, 'GST rate cannot be negative.').max(100, 'GST rate cannot exceed 100.'),
});

const platformChargesSchema = z.object({
  commission: z.coerce.number().min(0).max(100),
  fixedFee: z.coerce.number().min(0),
  collectionFee: z.coerce.number().min(0).max(100),
  shippingFee: z.coerce.number().min(0),
});

const platformsSchema = z.object({
  meesho: platformChargesSchema,
  flipkart: platformChargesSchema,
  amazon: platformChargesSchema,
});

const profitRulesSchema = z.object({
  defaultMargin: z.coerce.number().min(0),
  packingCost: z.coerce.number().min(0),
  promoAdsCost: z.coerce.number().min(0),
});

const returnRulesSchema = z.object({
  restockableFixedLoss: z.coerce.number().min(0, 'Loss amount must be non-negative.'),
});

const inventorySchema = z.object({
  defaultLowStockThreshold: z.coerce.number().min(0, 'Threshold must be non-negative.'),
});

const preferencesSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']),
  notifications: z.boolean(),
});

type Settings = {
  business_config?: z.infer<typeof businessConfigSchema>;
  platform_charges?: z.infer<typeof platformsSchema>;
  profit_rules?: z.infer<typeof profitRulesSchema>;
  return_rules?: z.infer<typeof returnRulesSchema>;
  inventory_settings?: z.infer<typeof inventorySchema>;
  preferences?: z.infer<typeof preferencesSchema>;
};

const DEFAULT_SETTINGS: Settings = {
    business_config: { businessName: 'Rehanza Hub', contactEmail: 'admin@rehanza.com', gstRate: 18 },
    platform_charges: {
        meesho: { commission: 15, fixedFee: 10, collectionFee: 2.5, shippingFee: 0 },
        flipkart: { commission: 18, fixedFee: 15, collectionFee: 3, shippingFee: 0 },
        amazon: { commission: 20, fixedFee: 20, collectionFee: 3.5, shippingFee: 80 },
    },
    profit_rules: { defaultMargin: 50, packingCost: 15, promoAdsCost: 20 },
    return_rules: { restockableFixedLoss: 45 },
    inventory_settings: { defaultLowStockThreshold: 10 },
    preferences: { theme: 'system', notifications: true },
};


// --- Main Settings Page ---

export default function SettingsPage() {
  const supabase = createClient();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    async function fetchSettings() {
      setLoading(true);
      const { data, error } = await supabase.from('app_settings').select('*');

      if (error) {
        toast({
          variant: 'destructive',
          title: 'Error fetching settings',
          description: error.message,
        });
        setSettings(DEFAULT_SETTINGS);
      } else {
        const loadedSettings = data.reduce((acc, { setting_key, setting_value }) => {
          acc[setting_key as keyof Settings] = setting_value;
          return acc;
        }, {} as Settings);
        
        const mergedSettings = { ...DEFAULT_SETTINGS, ...loadedSettings };
        setSettings(mergedSettings);
      }
      setLoading(false);
    }

    fetchSettings();
  }, [toast, supabase]);

  const handleSave = async (setting_key: keyof Settings, setting_value: any) => {
    const { error } = await supabase.from('app_settings').upsert(
      { setting_key, setting_value },
      { onConflict: 'setting_key' }
    );

    if (error) {
      toast({
        variant: 'destructive',
        title: `Failed to save ${setting_key.replace(/_/g, ' ')}`,
        description: error.message,
      });
      return false;
    } else {
      toast({
        title: 'Settings Saved',
        description: `Your changes to ${setting_key.replace(/_/g, ' ')} have been saved.`,
      });
      setSettings(prev => prev ? ({ ...prev, [setting_key]: setting_value }) : null);
      return true;
    }
  };

  if (loading || !settings) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-1/4" />
        <Skeleton className="h-12 w-full" />
        <Card>
          <CardHeader><Skeleton className="h-8 w-1/3" /></CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
          <CardFooter><Skeleton className="h-10 w-24 ml-auto" /></CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight font-headline">App Settings</h1>
        <p className="text-muted-foreground">Manage your entire e-commerce operation from one place.</p>
      </div>
      <Tabs defaultValue="business_config" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-6 mb-6">
          <TabsTrigger value="business_config">Business</TabsTrigger>
          <TabsTrigger value="platform_charges">Platforms</TabsTrigger>
          <TabsTrigger value="profit_rules">Profit Rules</TabsTrigger>
          <TabsTrigger value="return_rules">Returns</TabsTrigger>
          <TabsTrigger value="inventory_settings">Inventory</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
        </TabsList>
        
        <TabsContent value="business_config">
          <SettingsForm
            title="Business Config"
            description="Manage core business information."
            settingKey="business_config"
            initialData={settings.business_config!}
            schema={businessConfigSchema}
            onSave={handleSave}
            render={({ form }) => (
              <>
                <FormField
                  control={form.control}
                  name="businessName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Business Name</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="contactEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Email</FormLabel>
                      <FormControl><Input type="email" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="gstRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>GST Rate (%)</FormLabel>
                      <FormControl><Input type="number" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}
          />
        </TabsContent>

        <TabsContent value="platform_charges">
            <SettingsForm
                title="Platform Charges"
                description="Configure fees and commissions for each sales channel."
                settingKey="platform_charges"
                initialData={settings.platform_charges!}
                schema={platformsSchema}
                onSave={handleSave}
                render={({ form }) => (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {(['meesho', 'flipkart', 'amazon'] as const).map(platform => (
                    <Card key={platform} className="bg-background/50">
                        <CardHeader><CardTitle className="capitalize">{platform}</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                        <FormField
                            control={form.control}
                            name={`${platform}.commission`}
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Commission (%)</FormLabel>
                                <FormControl><Input type="number" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name={`${platform}.fixedFee`}
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Fixed Fee (₹)</FormLabel>
                                <FormControl><Input type="number" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name={`${platform}.collectionFee`}
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Collection Fee (%)</FormLabel>
                                <FormControl><Input type="number" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name={`${platform}.shippingFee`}
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Shipping Fee (₹)</FormLabel>
                                <FormControl><Input type="number" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                        </CardContent>
                    </Card>
                    ))}
                </div>
                )}
            />
        </TabsContent>

         <TabsContent value="profit_rules">
          <SettingsForm
            title="Profit & Cost Rules"
            description="Set default costs applied to products."
            settingKey="profit_rules"
            initialData={settings.profit_rules!}
            schema={profitRulesSchema}
            onSave={handleSave}
            render={({ form }) => (
              <>
                <FormField
                  control={form.control}
                  name="defaultMargin"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Default Margin (₹)</FormLabel>
                      <FormControl><Input type="number" {...field} /></FormControl>
                       <FormDescription>This can be overridden per product.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={form.control}
                  name="packingCost"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Packing Cost (₹)</FormLabel>
                      <FormControl><Input type="number" {...field} /></FormControl>
                       <FormDescription>Cost for packaging materials.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={form.control}
                  name="promoAdsCost"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Promo & Ads Cost (₹)</FormLabel>
                      <FormControl><Input type="number" {...field} /></FormControl>
                       <FormDescription>Default promotional cost allocation.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}
          />
        </TabsContent>

        <TabsContent value="return_rules">
          <SettingsForm
            title="Return Rules"
            description="Define how financial losses from returns are calculated."
            settingKey="return_rules"
            initialData={settings.return_rules!}
            schema={returnRulesSchema}
            onSave={handleSave}
            render={({ form }) => (
              <>
                <FormField
                  control={form.control}
                  name="restockableFixedLoss"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Restockable Return Fixed Loss (₹)</FormLabel>
                      <FormControl><Input type="number" {...field} /></FormControl>
                      <FormDescription>
                        The fixed cost incurred for a returned item that can be resold (e.g., shipping, reprocessing).
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <div className="p-4 rounded-md border bg-muted/50">
                    <p className="font-semibold text-sm">Non-Restockable Returns</p>
                    <p className="text-sm text-muted-foreground mt-1">
                        For non-restockable returns, the loss is calculated dynamically as the full margin of the product. This is managed at the product level and is not configured here.
                    </p>
                 </div>
              </>
            )}
          />
        </TabsContent>

        <TabsContent value="inventory_settings">
            <SettingsForm
                title="Inventory Settings"
                description="Configure default inventory management rules."
                settingKey="inventory_settings"
                initialData={settings.inventory_settings!}
                schema={inventorySchema}
                onSave={handleSave}
                render={({ form }) => (
                <>
                    <FormField
                    control={form.control}
                    name="defaultLowStockThreshold"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Default Low Stock Threshold</FormLabel>
                        <FormControl><Input type="number" {...field} /></FormControl>
                        <FormDescription>
                            Products will be marked as "Low Stock" when their quantity falls to or below this number.
                        </FormDescription>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                </>
                )}
            />
        </TabsContent>

        <TabsContent value="preferences">
            <SettingsForm
                title="Preferences"
                description="Customize the look and feel of your dashboard."
                settingKey="preferences"
                initialData={settings.preferences!}
                schema={preferencesSchema}
                onSave={handleSave}
                render={({ form }) => (
                <>
                    <FormField
                        control={form.control}
                        name="theme"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Theme</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a theme" />
                                </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    <SelectItem value="light">Light</SelectItem>
                                    <SelectItem value="dark">Dark</SelectItem>
                                    <SelectItem value="system">System</SelectItem>
                                </SelectContent>
                            </Select>
                             <FormDescription>
                                This will change the color scheme of the entire application.
                            </FormDescription>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="notifications"
                        render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                <div className="space-y-0.5">
                                    <FormLabel>Enable Notifications</FormLabel>
                                    <FormDescription>Receive toast notifications for important events.</FormDescription>
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
                </>
                )}
            />
        </TabsContent>

      </Tabs>
    </div>
  );
}


// --- Generic Form Component ---

interface SettingsFormProps<T extends z.ZodType<any, any>> {
  title: string;
  description: string;
  settingKey: keyof Settings;
  initialData: z.infer<T>;
  schema: T;
  onSave: (key: keyof Settings, value: z.infer<T>) => Promise<boolean>;
  render: (props: { form: any }) => React.ReactNode;
}

function SettingsForm<T extends z.ZodType<any, any>>({
  title,
  description,
  settingKey,
  initialData,
  schema,
  onSave,
  render,
}: SettingsFormProps<T>) {
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<z.infer<T>>({
    resolver: zodResolver(schema),
    defaultValues: initialData,
  });

  useEffect(() => {
    form.reset(initialData);
  }, [initialData, form]);

  const handleSubmit = async (values: z.infer<T>) => {
    setIsSaving(true);
    const success = await onSave(settingKey, values);
    if (success) {
      form.reset(values); // Re-sync form with successfully saved data
    }
    setIsSaving(false);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)}>
        <Card>
          <CardHeader>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {render({ form })}
          </CardContent>
          <CardFooter className="border-t px-6 py-4">
            <Button type="submit" disabled={isSaving || !form.formState.isDirty}>
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </Form>
  );
}
