'use client';

import { SidebarTrigger } from '@/components/ui/sidebar';
import { Package } from 'lucide-react';

export function MobileHeader() {
  return (
    <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background px-4 md:hidden">
      <SidebarTrigger />
      <div className="flex items-center gap-2">
        <Package className="h-6 w-6 text-primary" />
        <h1 className="text-xl font-bold text-foreground font-headline">
          Rehanza Hub
        </h1>
      </div>
    </header>
  );
}
