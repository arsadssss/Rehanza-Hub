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
    <Sidebar className="border-r">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <Package className="h-8 w-8 text-primary" />
          <h1 className="text-2xl font-bold text-sidebar-foreground font-headline">
            Rehanza Hub
          </h1>
        </div>

        {/* Account Switcher */}
        <div className="mt-4 relative group">
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-sidebar-foreground/50">
            <ChevronDown className="h-4 w-4" />
          </div>
          <select
            value={selectedAccount || ""}
            onChange={(e) => {
              sessionStorage.setItem("active_account", e.target.value);
              setSelectedAccount(e.target.value);
              window.location.reload();
            }}
            className="w-full appearance-none rounded-md bg-sidebar-accent/50 border border-sidebar-border p-2 pr-10 text-sm text-sidebar-foreground focus:outline-none focus:ring-2 focus:ring-sidebar-ring transition-colors cursor-pointer hover:bg-sidebar-accent"
          >
            {accounts.length === 0 && <option value="">Loading accounts...</option>}
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id} className="bg-sidebar text-sidebar-foreground">
                {acc.name}
              </option>
            ))}
          </select>
        </div>
      </SidebarHeader>

      <SidebarContent className="p-2">
        <SidebarMenu>
          {navItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                asChild
                isActive={
                  pathname.startsWith(item.href) &&
                  (item.href === '/dashboard'
                    ? pathname === item.href
                    : true)
                }
              >
                <Link href={item.href}>
                  <item.icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>

      <Separator className="my-2" />

      <SidebarFooter className="p-4 space-y-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarFallback>{firstLetter}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col overflow-hidden">
            <span className="text-sm font-medium text-sidebar-foreground truncate">
              {userName}
            </span>
          </div>
        </div>
        <LogoutButton />
      </SidebarFooter>
    </Sidebar>
  );
}
