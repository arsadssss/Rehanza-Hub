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
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { LogoutButton } from '@/components/logout-button';
import { apiFetch } from '@/lib/apiFetch';
import { cn } from '@/lib/utils';

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
    <Sidebar className="border-none bg-gradient-to-b from-[#1E1B4B] via-[#1E293B] to-[#0F172A] text-slate-300 shadow-2xl">
      <SidebarHeader className="p-8">
        <div className="flex items-center gap-3 px-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500 shadow-lg shadow-indigo-500/20">
            <Package className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight font-headline">
            Rehanza Hub
          </h1>
        </div>

        {/* Account Switcher */}
        <div className="mt-8 px-2 relative group">
          <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
            <ChevronDown className="h-4 w-4" />
          </div>
          <select
            value={selectedAccount || ""}
            onChange={(e) => {
              sessionStorage.setItem("active_account", e.target.value);
              setSelectedAccount(e.target.value);
              window.location.reload();
            }}
            className="w-full appearance-none rounded-xl bg-white/5 border border-white/10 p-3 pr-10 text-xs font-medium text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all cursor-pointer hover:bg-white/10"
          >
            {accounts.length === 0 && <option value="" className="bg-[#0F172A]">Loading accounts...</option>}
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id} className="bg-[#0F172A] text-white">
                {acc.name}
              </option>
            ))}
          </select>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-6 py-2">
        <SidebarMenu className="gap-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
            
            return (
              <SidebarMenuItem key={item.href}>
                <Link 
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ease-in-out group",
                    isActive 
                      ? "bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg shadow-indigo-500/30" 
                      : "text-slate-300 hover:bg-white/10 hover:text-white hover:translate-x-1"
                  )}
                >
                  <item.icon className={cn(
                    "h-5 w-5 transition-colors",
                    isActive ? "text-white" : "text-slate-400 group-hover:text-white"
                  )} />
                  <span>{item.label}</span>
                </Link>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>

      <Separator className="my-4 bg-white/10 mx-8" />

      <SidebarFooter className="p-8 space-y-4">
        <div className="flex items-center gap-3 px-2">
          <Avatar className="h-10 w-10 border-2 border-white/10">
            <AvatarFallback className="bg-white/10 text-white font-bold">{firstLetter}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col overflow-hidden">
            <span className="text-sm font-semibold text-white truncate">
              {userName}
            </span>
            <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">
              {session?.user?.role || 'Member'}
            </span>
          </div>
        </div>
        <div className="px-2">
          <LogoutButton />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
