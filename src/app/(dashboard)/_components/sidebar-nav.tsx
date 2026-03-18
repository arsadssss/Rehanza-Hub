
'use client';

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
  ChevronDown,
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
  { href: '/image-tool', icon: ImageIcon, label: 'Image Tool', group: 'STUDIO' },
  { href: '/label-crop', icon: Crop, label: 'Label Crop', group: 'STUDIO' },
  { href: '/analytics', icon: BarChart2, label: 'Report', group: 'INSIGHTS' },
  { href: '/profile', icon: User, label: 'Profile', group: 'SYSTEM' },
  { href: '/settings', icon: Settings, label: 'Settings', group: 'SYSTEM' },
];

type Account = {
  id: string;
  name: string;
};

export function SidebarNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { state, isMobile, toggleSidebar } = useSidebar();
  const isCollapsed = state === 'collapsed';
  
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [sidebarConfig, setSidebarConfig] = useState<Record<string, boolean>>({});

  useEffect(() => {
    async function fetchInitialData() {
      try {
        const [accRes, settingsRes] = await Promise.all([
          apiFetch("/api/accounts"),
          apiFetch("/api/settings")
        ]);

        const accJson = await accRes.json();
        if (accJson.success) {
          setAccounts(accJson.data);
          const saved = sessionStorage.getItem("active_account");
          if (saved) {
            setSelectedAccount(saved);
          } else if (accJson.data.length > 0) {
            const firstAccountId = accJson.data[0].id;
            setSelectedAccount(firstAccountId);
            sessionStorage.setItem("active_account", firstAccountId);
            window.dispatchEvent(new Event('active-account-changed'));
          }
        }

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

  const activeIndex = accounts.findIndex(acc => acc.id === selectedAccount);

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
      className="border-r border-black/5 bg-white/60 backdrop-blur-2xl transition-all duration-300 rounded-r-[24px] shadow-[4px_0_24px_rgba(0,0,0,0.02)]"
    >
      <SidebarHeader className="p-4 pt-6">
        <div className={cn(
          "flex items-center gap-3",
          isCollapsed ? "flex-col justify-center" : "flex-row justify-between px-2"
        )}>
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary shadow-xl shadow-primary/20 group/logo">
              <Package className="h-6 w-6 text-white group-hover/logo:scale-110 transition-transform" />
            </div>
            {!isCollapsed && (
              <div className="flex flex-col">
                <h1 className="text-lg font-black text-slate-900 tracking-tighter font-headline whitespace-nowrap animate-in fade-in slide-in-from-left-4 duration-500">
                  Rehanza Hub
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

        {/* Account Switcher - Segmented Control */}
        <div className={cn(
          "mt-8 px-2 transition-all duration-500",
          isCollapsed ? "flex flex-col items-center gap-2" : "block"
        )}>
          {accounts.length > 0 ? (
            <div className={cn(
              "bg-slate-200/50 p-1 rounded-[1.25rem] relative flex border border-white/50 shadow-inner",
              isCollapsed ? "flex-col w-10" : "flex-row w-full h-11 items-center"
            )}>
              {!isCollapsed && activeIndex !== -1 && (
                <div 
                  className="absolute h-9 bg-white rounded-xl shadow-sm transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] z-0"
                  style={{
                    width: `calc((100% - 8px) / ${accounts.length})`,
                    left: `calc(4px + (${activeIndex} * (100% - 8px) / ${accounts.length}))`
                  }}
                />
              )}

              {accounts.map((acc) => {
                const isActive = selectedAccount === acc.id;
                return (
                  <button
                    key={acc.id}
                    onClick={() => {
                      if (!isActive) {
                        sessionStorage.setItem("active_account", acc.id);
                        setSelectedAccount(acc.id);
                        window.location.reload();
                      }
                    }}
                    className={cn(
                      "relative z-10 transition-all duration-300 flex items-center justify-center font-black uppercase tracking-widest",
                      isCollapsed 
                        ? "w-8 h-8 rounded-xl text-[10px]" 
                        : "flex-1 h-full text-[9px]",
                      isActive 
                        ? "text-primary" 
                        : "text-slate-400 hover:text-slate-600"
                    )}
                  >
                    {isCollapsed ? acc.name.charAt(0) : acc.name}
                  </button>
                );
              })}
            </div>
          ) : (
            !isCollapsed && <div className="h-11 flex items-center justify-center text-[8px] font-black text-slate-300 uppercase tracking-[0.2em] animate-pulse">Initializing...</div>
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
                            ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-[0_8px_20px_rgba(99,102,241,0.3)] font-black" 
                            : "text-slate-600 hover:bg-indigo-500/5 hover:text-indigo-600 hover:translate-x-1"
                        )}
                      >
                        <Link href={item.href}>
                          {/* Active Indicator Bar */}
                          {isActive && (
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-white rounded-r-full shadow-[0_0_10px_white]" />
                          )}
                          
                          <item.icon className={cn(
                            "h-4 w-4 shrink-0 transition-all duration-300",
                            isActive ? "text-white scale-110" : "text-slate-400 group-hover:text-indigo-600 group-hover:scale-110"
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
        <Separator className="bg-black/5 mx-2" />
        
        <div className={cn(
          "flex items-center gap-3 px-2 transition-all duration-300 relative group/profile",
          isCollapsed ? "justify-center" : "justify-start"
        )}>
          <div className="relative">
            <Avatar className="h-9 w-9 border-2 border-white shadow-lg transition-transform group-hover/profile:scale-105">
              <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-black border border-primary/20">
                {firstLetter}
              </AvatarFallback>
            </Avatar>
            <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />
          </div>
          
          {!isCollapsed && (
            <div className="flex flex-col overflow-hidden animate-in fade-in slide-in-from-left-2">
              <span className="text-[11px] font-black text-slate-900 truncate leading-tight tracking-tight">
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
