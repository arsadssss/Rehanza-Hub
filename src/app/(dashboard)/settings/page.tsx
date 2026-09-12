
"use client";

import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { useTheme } from '@/components/theme-provider';
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
import { apiFetch } from '@/lib/apiFetch';
import { navItems } from '@/app/(dashboard)/_components/sidebar-nav';
import { Moon, Sun, Monitor, Palette, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MeeshoConnectionCard } from './_components/meesho-connection-card';
import { NotificationSettingsCard } from './_components/notification-settings-card';

const businessConfigSchema = z.object({
  businessName: z.string().min(1, 'Business name is required.'),
  contactEmail: z.string().email('Invalid email address.'),
  gstRate: z.coerce.number().min(0, 'GST rate cannot be negative.').max(100, 'GST rate cannot exceed 100.'),
});

const platformsSchema = z.object({
  meesho: z.object({ commission: z.coerce.number(), fixedFee: z.coerce.number(), collectionFee: z.coerce.number(), shippingFee: z.coerce.number() }),
  flipkart: z.object({ commission: z.coerce.number(), fixedFee: z.coerce.number(), collectionFee: z.coerce.number(), shippingFee: z.coerce.number() }),
  amazon: z.object({ commission: z.coerce.number(), fixedFee: z.coerce.number(), collectionFee: z.coerce.number(), shippingFee: z.coerce.number() }),
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
  theme: z.enum(['classic', 'blue', 'light', 'dark', 'system']),
  notifications: z.boolean(),
});

const sidebarConfigSchema = z.record(z.string(), z.boolean());

type Settings = {
  business_config?: z.infer<typeof businessConfigSchema>;
  platform_charges?: z.infer<typeof platformsSchema>;
  profit_rules?: z.infer<typeof profitRulesSchema>;
  return_rules?: z.infer<typeof returnRulesSchema>;
  inventory_settings?: z.infer<typeof inventorySchema>;
  preferences?: z.infer<typeof preferencesSchema>;
  sidebar_config?: z.infer<typeof sidebarConfigSchema>;
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
    preferences: { theme: 'classic', notifications: true },
    sidebar_config: navItems.reduce((acc, item) => ({ ...acc, [item.href]: true }), {}),
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { setTheme } = useTheme();

  useEffect(() => {
    async function fetchSettings() {
      setLoading(true);
      try {
        const res = await apiFetch('/api/settings');
        if (!res.ok) throw new Error('Failed to fetch settings');
        const loadedSettings = await res.json();
        
        const mergedSettings = { ...DEFAULT_SETTINGS, ...loadedSettings };
        setSettings(mergedSettings);

      } catch (error: any) {
         toast({
          variant: 'destructive',
          title: 'Error fetching settings',
          description: error.message,
        });
        setSettings(DEFAULT_SETTINGS);
      } finally {
        setLoading(false);
      }
    }

    fetchSettings();
  }, [toast]);

  const handleSave = async (setting_key: keyof Settings, setting_value: any) => {
    try {
        const res = await apiFetch('/api/settings', {
            method: 'POST',
            body: JSON.stringify({ key: setting_key, value: setting_value }),
        });
        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.message);
        }
        
        if (setting_key === 'preferences' && setting_value.theme) {
          setTheme(setting_value.theme);
        }

        toast({
            title: 'Settings Saved',
            description: `Your changes to ${setting_key.replace(/_/g, ' ')} have been saved.`,
        });
        setSettings(prev => prev ? ({ ...prev, [setting_key]: setting_value }) : null);
        
        if (setting_key === 'sidebar_config') {
          window.dispatchEvent(new Event('sidebar-config-updated'));
        }
        
        return true;
    } catch (error: any) {
        toast({
            variant: 'destructive',
            title: `Failed to save ${setting_key.replace(/_/g, ' ')}`,
            description: error.message,
        });
        return false;
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
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-9 mb-6 bg-muted/50 p-1 rounded-2xl h-auto gap-1">
          <TabsTrigger value="business_config" className="rounded-xl px-3 py-2 font-bold text-xs">Business</TabsTrigger>
          <TabsTrigger value="marketplaces" className="rounded-xl px-3 py-2 font-bold text-xs">Marketplaces</TabsTrigger>
          <TabsTrigger value="platform_charges" className="rounded-xl px-3 py-2 font-bold text-xs">Platforms</TabsTrigger>
          <TabsTrigger value="profit_rules" className="rounded-xl px-3 py-2 font-bold text-xs">Profit Rules</TabsTrigger>
          <TabsTrigger value="return_rules" className="rounded-xl px-3 py-2 font-bold text-xs">Returns</TabsTrigger>
          <TabsTrigger value="inventory_settings" className="rounded-xl px-3 py-2 font-bold text-xs">Inventory</TabsTrigger>
          <TabsTrigger value="sidebar_config" className="rounded-xl px-3 py-2 font-bold text-xs">Menus</TabsTrigger>
          <TabsTrigger value="preferences" className="rounded-xl px-3 py-2 font-bold text-xs">Appearance & Theme</TabsTrigger>
          <TabsTrigger value="notifications" className="rounded-xl px-3 py-2 font-bold text-xs">Notifications</TabsTrigger>
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
 
        <TabsContent value="marketplaces" className="space-y-6">
          <div className="space-y-6">
            <MeeshoConnectionCard />
          </div>
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

        <TabsContent value="sidebar_config">
          <SettingsForm
            title="Menu Management"
            description="Hide or show specific modules from the sidebar navigation."
            settingKey="sidebar_config"
            initialData={settings.sidebar_config!}
            schema={sidebarConfigSchema}
            onSave={handleSave}
            render={({ form }) => (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {navItems.map((item) => {
                  if (item.href === '/dashboard' || item.href === '/settings' || item.href === '/profile') return null;
                  
                  return (
                    <FormField
                      key={item.href}
                      control={form.control}
                      name={item.href}
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-xl border p-4 hover:bg-muted/50 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-lg text-primary">
                              <item.icon className="h-4 w-4" />
                            </div>
                            <div className="space-y-0.5">
                              <FormLabel className="text-sm font-bold">{item.label}</FormLabel>
                              <p className="text-[10px] text-muted-foreground uppercase tracking-tight">{item.href}</p>
                            </div>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value !== false}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  );
                })}
              </div>
            )}
          />
        </TabsContent>

        <TabsContent value="preferences">
            <SettingsForm
                title="Appearance & Theme"
                description="Choose your preferred workspace theme. Your choice is saved per session and persisted to your account."
                settingKey="preferences"
                initialData={settings.preferences!}
                schema={preferencesSchema}
                onSave={handleSave}
                render={({ form }) => (
                <div className="space-y-8">
                    <FormField
                        control={form.control}
                        name="theme"
                        render={({ field }) => (
                            <FormItem className="space-y-4">
                            <div>
                              <FormLabel className="font-bold text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                <Palette className="h-4 w-4 text-primary" />
                                Select Workspace Theme
                              </FormLabel>
                              <FormDescription className="text-xs text-muted-foreground mt-1">
                                Choose between the Classic Dark Glassmorphic Theme and the New Blue Enterprise Workspace.
                              </FormDescription>
                            </div>
                            <FormControl>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-1">
                                  {/* Classic Theme Card */}
                                  <div
                                    onClick={() => {
                                      field.onChange('classic');
                                      setTheme('classic');
                                    }}
                                    className={cn(
                                      "group relative cursor-pointer rounded-2xl border-2 p-5 transition-all duration-200 overflow-hidden",
                                      field.value === 'classic' || field.value === 'dark' || field.value === 'system'
                                        ? "border-primary bg-primary/5 shadow-xl shadow-primary/10 ring-2 ring-primary/20"
                                        : "border-border/60 hover:border-border hover:bg-muted/30"
                                    )}
                                  >
                                    <div className="flex items-start justify-between mb-4">
                                      <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                          <h4 className="font-bold text-base text-foreground">Classic Theme</h4>
                                          <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-slate-500/20 text-slate-300">
                                            Default
                                          </span>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                          Dark glassmorphic workspace with neon accents & deep ambient glow.
                                        </p>
                                      </div>
                                      <div className={cn(
                                        "h-6 w-6 rounded-full flex items-center justify-center transition-all",
                                        (field.value === 'classic' || field.value === 'dark' || field.value === 'system')
                                          ? "bg-primary text-white"
                                          : "border border-border text-transparent"
                                      )}>
                                        <Check className="h-3.5 w-3.5" />
                                      </div>
                                    </div>

                                    {/* Mini Visual Preview of Classic Theme */}
                                    <div className="rounded-xl border border-white/10 bg-[#070c17] p-3 shadow-inner">
                                      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-white/10">
                                        <div className="h-2 w-2 rounded-full bg-red-400/80" />
                                        <div className="h-2 w-2 rounded-full bg-yellow-400/80" />
                                        <div className="h-2 w-2 rounded-full bg-emerald-400/80" />
                                        <span className="text-[10px] text-slate-400 ml-auto font-mono">Dark Glass</span>
                                      </div>
                                      <div className="flex gap-2">
                                        <div className="w-1/4 h-16 rounded-lg bg-slate-900/80 border border-white/5 p-1 flex flex-col gap-1">
                                          <div className="h-2 w-full bg-indigo-500/40 rounded" />
                                          <div className="h-1.5 w-3/4 bg-slate-700/50 rounded" />
                                          <div className="h-1.5 w-2/3 bg-slate-700/50 rounded" />
                                        </div>
                                        <div className="flex-1 grid grid-cols-2 gap-1.5">
                                          <div className="h-7 rounded-lg bg-slate-800/40 border border-white/10 p-1">
                                            <div className="h-1.5 w-8 bg-emerald-400/60 rounded mb-1" />
                                            <div className="h-2 w-12 bg-white/40 rounded" />
                                          </div>
                                          <div className="h-7 rounded-lg bg-slate-800/40 border border-white/10 p-1">
                                            <div className="h-1.5 w-8 bg-indigo-400/60 rounded mb-1" />
                                            <div className="h-2 w-12 bg-white/40 rounded" />
                                          </div>
                                          <div className="col-span-2 h-7 rounded-lg bg-slate-800/20 border border-white/5" />
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  {/* New Blue Theme Card */}
                                  <div
                                    onClick={() => {
                                      field.onChange('blue');
                                      setTheme('blue');
                                    }}
                                    className={cn(
                                      "group relative cursor-pointer rounded-2xl border-2 p-5 transition-all duration-200 overflow-hidden",
                                      field.value === 'blue'
                                        ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/20 shadow-xl shadow-blue-500/10 ring-2 ring-blue-500/20"
                                        : "border-border/60 hover:border-border hover:bg-muted/30"
                                    )}
                                  >
                                    <div className="flex items-start justify-between mb-4">
                                      <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                          <h4 className="font-bold text-base text-foreground">New Blue Theme</h4>
                                          <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-600 dark:text-blue-400">
                                            New
                                          </span>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                          Google Drive-inspired workspace with royal blue navigation & clean cards.
                                        </p>
                                      </div>
                                      <div className={cn(
                                        "h-6 w-6 rounded-full flex items-center justify-center transition-all",
                                        field.value === 'blue'
                                          ? "bg-blue-600 text-white"
                                          : "border border-border text-transparent"
                                      )}>
                                        <Check className="h-3.5 w-3.5" />
                                      </div>
                                    </div>

                                    {/* Mini Visual Preview of Blue Theme */}
                                    <div className="rounded-xl border border-slate-200 bg-[#f4f7fe] p-3 shadow-inner">
                                      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-200">
                                        <div className="h-2 w-2 rounded-full bg-red-400" />
                                        <div className="h-2 w-2 rounded-full bg-yellow-400" />
                                        <div className="h-2 w-2 rounded-full bg-emerald-400" />
                                        <span className="text-[10px] text-slate-500 ml-auto font-mono">Enterprise Blue</span>
                                      </div>
                                      <div className="flex gap-2">
                                        <div className="w-1/4 h-16 rounded-lg bg-[#17387e] p-1 flex flex-col gap-1 shadow-sm">
                                          <div className="h-2 w-full bg-white/40 rounded" />
                                          <div className="h-1.5 w-3/4 bg-white/20 rounded" />
                                          <div className="h-1.5 w-2/3 bg-white/20 rounded" />
                                        </div>
                                        <div className="flex-1 grid grid-cols-2 gap-1.5">
                                          <div className="h-7 rounded-lg bg-white border border-slate-200/80 p-1 shadow-xs">
                                            <div className="h-1.5 w-8 bg-blue-500 rounded mb-1" />
                                            <div className="h-2 w-12 bg-slate-700 rounded" />
                                          </div>
                                          <div className="h-7 rounded-lg bg-white border border-slate-200/80 p-1 shadow-xs">
                                            <div className="h-1.5 w-8 bg-emerald-500 rounded mb-1" />
                                            <div className="h-2 w-12 bg-slate-700 rounded" />
                                          </div>
                                          <div className="col-span-2 h-7 rounded-lg bg-white border border-slate-200/80 shadow-xs" />
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                            </FormControl>
                            <FormDescription className="text-xs">
                                Clicking a theme updates your view instantly. Click &quot;Save Changes&quot; to remember your choice across devices.
                            </FormDescription>
                            <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="notifications"
                        render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-2xl border p-5 bg-background/50">
                                <div className="space-y-0.5">
                                    <FormLabel className="text-sm font-bold">In-App Notifications</FormLabel>
                                    <FormDescription className="text-xs">Receive toast alerts for critical system events.</FormDescription>
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
                </div>
                )}
            />
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <NotificationSettingsCard />
        </TabsContent>

      </Tabs>
    </div>
  );
}

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
      form.reset(values);
    }
    setIsSaving(false);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)}>
        <Card className="border border-white/10 shadow-[0_18px_55px_rgba(2,6,23,0.22)] rounded-[2rem] overflow-hidden glass-panel">
          <CardHeader className="p-8 pb-4">
            <CardTitle className="font-headline text-2xl font-bold tracking-tight">{title}</CardTitle>
            <CardDescription className="font-medium">{description}</CardDescription>
          </CardHeader>
          <CardContent className="p-8 pt-4 space-y-6">
            {render({ form })}
          </CardContent>
          <CardFooter className="border-t border-border/50 bg-muted/20 px-8 py-6">
            <Button type="submit" disabled={isSaving || !form.formState.isDirty} className="min-w-[140px] h-11 rounded-xl font-bold">
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </Form>
  );
}
