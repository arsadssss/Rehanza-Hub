'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React, { useEffect, useState } from 'react';
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
  ChevronDown,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
  Crop,
  Undo2,
  Activity,
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { LogoutButton } from '@/components/logout-button';
import { apiFetch } from '@/lib/apiFetch';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/orders', icon: ShoppingCart, label: 'Orders' },
  { href: '/products', icon: Package, label: 'Products' },
  { href: '/inventory', icon: Warehouse, label: 'Inventory' },
  { href: '/returns', icon: Undo2, label: 'Returns' },
  { href: '/returns/intelligence', icon: Activity, label: 'Return Analysis' },
  { href: '/tasks', icon: ListTodo, label: 'Tasks' },
  { href: '/vendors', icon: Building, label: 'Vendors' },
  { href: '/analytics', icon: BarChart2, label: 'Report' },
  { href: '/expenses', icon: CreditCard, label: 'Expenses' },
  { href: '/payments', icon: Wallet, label: 'Payments' },
  { href: '/wholesale-pricing', icon: Tag, label: 'Wholesale' },
  { href: '/image-tool', icon: ImageIcon, label: 'Image Tool' },
  { href: '/label-crop', icon: Crop, label: 'Label Crop' },
  { href: '/profile', icon: User, label: 'Profile' },
  { href: '/settings', icon: Settings, label: 'Settings' },
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

  // Filter items based on config (default to visible if not in config)
  const visibleNavItems = navItems.filter(item => {
    // Dashboard and Settings should probably always be visible to avoid being locked out
    if (item.href === '/dashboard' || item.href === '/settings' || item.href === '/profile') return true;
    return sidebarConfig[item.href] !== false;
  });

  return (
    <Sidebar 
      collapsible="icon" 
      className="border-none bg-gradient-to-b from-indigo-800 to-indigo-950 text-white shadow-2xl overflow-hidden transition-all duration-300"
    >
      <SidebarHeader className="p-4 pt-6">
        <div className={cn(
          "flex items-center gap-3",
          isCollapsed ? "flex-col justify-center" : "flex-row justify-between px-2"
        )}>
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/10 shadow-xl border border-white/10 backdrop-blur-md">
              <Package className="h-6 w-6 text-white" />
            </div>
            {!isCollapsed && (
              <h1 className="text-lg font-black text-white tracking-tighter font-headline whitespace-nowrap animate-in fade-in slide-in-from-left-4 duration-500">
                Rehanza Hub
              </h1>
            )}
          </div>
          
          {!isMobile && (
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              className={cn(
                "h-8 w-8 text-white/40 hover:text-white hover:bg-white/10 transition-colors rounded-xl",
                isCollapsed && "mt-2"
              )}
            >
              {isCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
            </Button>
          )}
        </div>

        <div className={cn(
          "mt-8 px-2 transition-all duration-500",
          isCollapsed ? "flex flex-col items-center gap-2" : "block"
        )}>
          {accounts.length > 0 ? (
            <div className={cn(
              "bg-white/10 p-1 rounded-2xl relative flex",
              isCollapsed ? "flex-col w-10" : "flex-row w-full h-11 items-center"
            )}>
              {!isCollapsed && activeIndex !== -1 && (
                <div 
                  className="absolute h-9 bg-white rounded-xl shadow-lg transition-all duration-300 ease-out z-0"
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
                        ? (isCollapsed ? "bg-white text-indigo-900 shadow-lg" : "text-indigo-900") 
                        : "text-white/40 hover:text-white/70"
                    )}
                  >
                    {isCollapsed ? acc.name.charAt(0) : acc.name}
                  </button>
                );
              })}
            </div>
          ) : (
            !isCollapsed && <div className="h-11 flex items-center justify-center text-[8px] font-black text-white/20 uppercase tracking-[0.2em]">Loading Accounts...</div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-3 py-4 mt-2">
        <SidebarMenu className="gap-1">
          {visibleNavItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
            
            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive}
                  tooltip={item.label}
                  className={cn(
                    "h-12 w-full transition-all duration-200 group flex items-center gap-3 px-4 rounded-2xl",
                    isActive 
                      ? "bg-white text-indigo-900 shadow-[0_10px_20px_rgba(0,0,0,0.2)] font-black" 
                      : "text-white/60 hover:bg-white/5 hover:text-white"
                  )}
                >
                  <Link href={item.href}>
                    <item.icon className={cn(
                      "h-5 w-5 shrink-0 transition-transform group-hover:scale-110",
                      isActive ? "text-indigo-900" : "text-white/40 group-hover:text-white"
                    )} />
                    {!isCollapsed && (
                      <span className="text-xs font-bold uppercase tracking-wide truncate">
                        {item.label}
                      </span>
                    )}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="p-4 mt-auto space-y-4">
        <Separator className="bg-white/5 mx-2" />
        
        <div className={cn(
          "flex items-center gap-3 px-2 transition-all duration-300",
          isCollapsed ? "justify-center" : "justify-start"
        )}>
          <Avatar className="h-10 w-10 border-2 border-white/10 shadow-lg">
            <AvatarFallback className="bg-white/10 text-white text-xs font-black">{firstLetter}</AvatarFallback>
          </Avatar>
          {!isCollapsed && (
            <div className="flex flex-col overflow-hidden animate-in fade-in slide-in-from-left-2">
              <span className="text-xs font-black text-white truncate leading-tight">
                {userName}
              </span>
              <span className="text-[9px] text-white/40 uppercase font-black tracking-widest mt-0.5">
                {session?.user?.role || 'Member'}
              </span>
            </div>
          )}
        </div>

        <div className="px-1">
          <LogoutButton />
        </div>
        
        {!isCollapsed && (
          <div className="text-center pb-2">
            <p className="text-[8px] text-white/20 font-black uppercase tracking-[0.3em]">Version 2.4.0</p>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
