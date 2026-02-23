
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React from 'react';
import type { User } from '@supabase/supabase-js';
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
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import LogoutButton from '@/components/LogoutButton';

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/products', icon: Package, label: 'Products' },
  { href: '/inventory', icon: Warehouse, label: 'Inventory' },
  { href: '/orders', icon: ShoppingCart, label: 'Orders' },
  { href: '/tasks', icon: ListTodo, label: 'Tasks' },
  { href: '/vendors', icon: Building, label: 'Vendors' },
  { href: '/analytics', icon: BarChart2, label: 'Report' },
  { href: '/expenses', icon: CreditCard, label: 'Expenses' },
  { href: '/settings', icon: Settings, label: 'Settings' },
];

export function SidebarNav({ user }: { user: User }) {
  const pathname = usePathname();

  return (
    <Sidebar className="border-r">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <Package className="h-8 w-8 text-primary" />
          <h1 className="text-2xl font-bold text-sidebar-foreground font-headline">
            Rehanza Hub
          </h1>
        </div>
      </SidebarHeader>
      <SidebarContent className="p-2">
        <SidebarMenu>
          {navItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                asChild
                isActive={pathname.startsWith(item.href) && (item.href === '/dashboard' ? pathname === item.href : true)}
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
            <AvatarFallback>{user.email?.[0].toUpperCase() ?? 'U'}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col overflow-hidden">
            <span className="text-sm font-medium text-sidebar-foreground truncate">{user.email}</span>
          </div>
        </div>
        <LogoutButton />
      </SidebarFooter>
    </Sidebar>
  );
}
