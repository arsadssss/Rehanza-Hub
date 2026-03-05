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
  Warehouse,
  ShoppingCart,
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
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { LogoutButton } from '@/components/logout-button';
import { apiFetch } from '@/lib/apiFetch';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/products', icon: Package, label: 'Products' },
  { href: '/inventory', icon: Warehouse, label: 'Inventory' },
  { href: '/orders', icon: ShoppingCart, label: 'Orders' },
  { href: '/tasks', icon: ListTodo, label: 'Tasks' },
  { href: '/vendors', icon: Building, label: 'Vendors' },
  { href: '/analytics', icon: BarChart2, label: 'Report' },
  { href: '/expenses', icon: CreditCard, label: 'Expenses' },
  { href: '/payments', icon: Wallet, label: 'Payments' },
  { href: '/wholesale-pricing', icon: Tag, label: 'Wholesale' },
  { href: '/image-tool', icon: ImageIcon, label: 'Image Tool' },
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

  useEffect(() => {
    async function fetchAccounts() {
      try {
        const res = await apiFetch("/api/accounts");
        const json = await res.json();

        if (json.success) {
          setAccounts(json.data);

          const saved = sessionStorage.getItem("active_account");
          if (saved) {
            setSelectedAccount(saved);
          } else if (json.data.length > 0) {
            setSelectedAccount(json.data[0].id);
            sessionStorage.setItem("active_account", json.data[0].id);
          }
        }
      } catch (error) {
        console.error("Failed to fetch accounts:", error);
      }
    }

    fetchAccounts();
  }, []);

  const userName = session?.user?.name ?? 'User';
  const firstLetter = userName.charAt(0).toUpperCase();

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

        {/* Account Switcher */}
        {!isCollapsed && (
          <div className="mt-8 px-2 relative group animate-in fade-in duration-700">
            <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-white/40 group-hover:text-white transition-colors">
              <ChevronDown className="h-4 w-4" />
            </div>
            <select
              value={selectedAccount || ""}
              onChange={(e) => {
                sessionStorage.setItem("active_account", e.target.value);
                setSelectedAccount(e.target.value);
                window.location.reload();
              }}
              className="w-full appearance-none rounded-2xl bg-white/5 border border-white/10 p-3.5 pr-10 text-[10px] font-black uppercase tracking-widest text-white/80 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all cursor-pointer hover:bg-white/10 hover:text-white"
            >
              {accounts.length === 0 && <option value="" className="bg-indigo-900">Loading...</option>}
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id} className="bg-indigo-900 text-white">
                  {acc.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent className="px-3 py-4 mt-2">
        <SidebarMenu className="gap-1">
          {navItems.map((item) => {
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
