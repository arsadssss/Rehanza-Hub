'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React from 'react';
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
  BarChart2,
  Settings,
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/products', icon: Package, label: 'Products' },
  { href: '/inventory', icon: Warehouse, label: 'Inventory' },
  { href: '/orders', icon: ShoppingCart, label: 'Orders' },
  { href: '/analytics', icon: BarChart2, label: 'Report' },
  { href: '/settings', icon: Settings, label: 'Settings' },
];

export function SidebarNav() {
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
                className="justify-start w-full"
              >
                <Link href={item.href}>
                  <item.icon className="h-5 w-5 mr-3" />
                  <span>{item.label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <Separator className="my-2" />
      <SidebarFooter className="p-4 space-y-4">
        
      </SidebarFooter>
    </Sidebar>
  );
}
