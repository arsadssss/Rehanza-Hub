
'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React, { useEffect, useState, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Warehouse,
  Building,
  BarChart2,
  Settings,
  CreditCard,
  ListTodo,
  User,
  Tag,
  Wallet,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
  Crop,
  Undo2,
  Zap,
  Library,
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { LogoutButton } from '@/components/logout-button';
import { apiFetch } from '@/lib/apiFetch';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', group: 'MAIN' },
  { href: '/orders', icon: ShoppingCart, label: 'Orders', group: 'OPERATIONS' },
  { href: '/returns', icon: Undo2, label: 'Returns', group: 'OPERATIONS' },
  { href: '/tasks', icon: ListTodo, label: 'Tasks', group: 'OPERATIONS' },
  { href: '/products', icon: Package, label: 'Products', group: 'CATALOG' },
  { href: '/inventory', icon: Warehouse, label: 'Inventory', group: 'CATALOG' },
  { href: '/vendors', icon: Building, label: 'Vendors', group: 'CATALOG' },
  { href: '/expenses', icon: CreditCard, label: 'Expenses', group: 'FINANCE' },
  { href: '/payments', icon: Wallet, label: 'Payments', group: 'FINANCE' },
  { href: '/wholesale-pricing', icon: Tag, label: 'Wholesale', group: 'FINANCE' },
  { href: '/image-library', icon: Library, label: 'Image Library', group: 'STUDIO' },
  { href: '/image-tool', icon: ImageIcon, label: 'Image Tool', group: 'STUDIO' },
  { href: '/label-crop', icon: Crop, label: 'Label Crop', group: 'STUDIO' },
  { href: '/analytics', icon: BarChart2, label: 'Report', group: 'INSIGHTS' },
  { href: '/profile', icon: User, label: 'Profile', group: 'SYSTEM' },
  { href: '/settings', icon: Settings, label: 'Settings', group: 'SYSTEM' },
];

export function SidebarNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { state, isMobile, toggleSidebar } = useSidebar();
  const isCollapsed = state === 'collapsed';
  
  const [sidebarConfig, setSidebarConfig] = useState<Record<string, boolean>>({});

  useEffect(() => {
    async function fetchInitialData() {
      try {
        const settingsRes = await apiFetch("/api/settings");

        const settingsJson = await settingsRes.json();
        if (settingsJson.sidebar_config) {
          setSidebarConfig(settingsJson.sidebar_config);
        }
      } catch (error) {
        console.error("Sidebar initialization failed:", error);
      }
    }

    fetchInitialData();

    const handleSettingsUpdate = () => {
      fetchInitialData();
    };
    window.addEventListener('sidebar-config-updated', handleSettingsUpdate);
    return () => window.removeEventListener('sidebar-config-updated', handleSettingsUpdate);
  }, []);

  const userName = session?.user?.name ?? 'User';
  const firstLetter = userName.charAt(0).toUpperCase();

  const visibleNavItems = navItems.filter(item => {
    if (item.href === '/dashboard' || item.href === '/settings' || item.href === '/profile') return true;
    return sidebarConfig[item.href] !== false;
  });

  const groupedItems = useMemo(() => {
    const groups: Record<string, typeof navItems> = {};
    visibleNavItems.forEach(item => {
      if (!groups[item.group]) groups[item.group] = [];
      groups[item.group].push(item);
    });
    return groups;
  }, [visibleNavItems]);

  return (
    <Sidebar 
      collapsible="icon" 
      className="glass-panel border-r border-white/10 bg-slate-950/55 backdrop-blur-2xl transition-all duration-300 rounded-r-[24px] shadow-[0_30px_80px_rgba(2,6,23,0.45)]"
    >
      <SidebarHeader className="p-4 pt-6">
        <div className={cn(
          "flex items-center gap-3",
          isCollapsed ? "flex-col justify-center" : "flex-row justify-between px-2"
        )}>
          <div className="flex min-w-0 items-center gap-3">
            <div className="relative flex h-11 w-11 shrink-0 items-center justify-center group/logo">
              <Image
                src="/images/favicon.png"
                alt="Rehanza Hub"
                width={44}
                height={44}
                className="h-full w-full object-contain transition-transform duration-300 group-hover/logo:scale-105"
              />
            </div>
            {!isCollapsed && (
              <div className="flex min-w-0 flex-col">
                <h1 className="truncate text-lg font-black text-slate-900 dark:text-white tracking-tighter font-headline whitespace-nowrap animate-in fade-in slide-in-from-left-4 duration-500">
                  Rehanza
                </h1>
                <div className="flex items-center gap-1.5">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse" />
                  <span className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-400">Live Sync</span>
                </div>
              </div>
            )}
          </div>
          
          {!isMobile && (
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              className={cn(
                "h-8 w-8 text-slate-300 hover:text-primary hover:bg-primary/5 transition-all rounded-xl",
                isCollapsed && "mt-2"
              )}
            >
              {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </Button>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-3 py-4 mt-2 custom-scrollbar">
        <div className="space-y-8">
          {Object.entries(groupedItems).map(([group, items]) => (
            <div key={group} className="space-y-2">
              {!isCollapsed && (
                <p className="px-4 text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] mb-3">
                  {group}
                </p>
              )}
              <SidebarMenu className="gap-1">
                {items.map((item) => {
                  const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
                  
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        tooltip={item.label}
                        className={cn(
                          "h-11 w-full transition-all duration-300 group flex items-center gap-3 px-4 rounded-xl relative overflow-hidden",
                          isActive 
                            ? "glass-pill text-white font-black shadow-[0_10px_30px_rgba(99,102,241,0.22)]" 
                            : "text-slate-300 hover:bg-white/5 hover:text-white hover:border hover:border-white/10 hover:translate-x-1"
                        )}
                      >
                        <Link href={item.href}>
                          {/* Active Indicator Bar */}
                          {isActive && (
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-white rounded-r-full shadow-[0_0_10px_white]" />
                          )}
                          
                          <item.icon className={cn(
                            "h-4 w-4 shrink-0 transition-all duration-300",
                            isActive ? "text-white scale-110" : "text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:scale-110"
                          )} />
                          
                          {!isCollapsed && (
                            <span className="text-[11px] font-bold uppercase tracking-wider truncate">
                              {item.label}
                            </span>
                          )}

                          {!isCollapsed && item.label === 'Tasks' && (
                            <div className="ml-auto h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary))]" />
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </div>
          ))}
        </div>
      </SidebarContent>

      <SidebarFooter className="p-4 mt-auto space-y-4">
        <Separator className="bg-black/5 dark:bg-white/5 mx-2" />
        
        <div className={cn(
          "flex items-center gap-3 px-2 transition-all duration-300 relative group/profile",
          isCollapsed ? "justify-center" : "justify-start"
        )}>
          <div className="relative">
            <Avatar className="h-9 w-9 border-2 border-white dark:border-slate-800 shadow-lg transition-transform group-hover/profile:scale-105">
              <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-black border border-primary/20">
                {firstLetter}
              </AvatarFallback>
            </Avatar>
            <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-slate-800 bg-emerald-500" />
          </div>
          
          {!isCollapsed && (
            <div className="flex flex-col overflow-hidden animate-in fade-in slide-in-from-left-2">
              <span className="text-[11px] font-black text-slate-900 dark:text-white truncate leading-tight tracking-tight">
                {userName}
              </span>
              <span className="text-[8px] text-slate-500 uppercase font-bold tracking-widest mt-0.5">
                {session?.user?.role || 'Member'}
              </span>
            </div>
          )}
        </div>

        <div className="px-1 logout-wrapper">
          <style jsx global>{`
            .logout-wrapper button {
              color: #94a3b8;
            }
            .logout-wrapper button:hover {
              color: #ef4444;
              background-color: rgba(239, 68, 68, 0.05);
            }
          `}</style>
          <LogoutButton />
        </div>
        
        {!isCollapsed && (
          <div className="text-center pb-2">
            <p className="text-[7px] text-slate-300 font-black uppercase tracking-[0.4em]">Engine v2.5.0</p>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
