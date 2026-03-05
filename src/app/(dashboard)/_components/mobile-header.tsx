'use client';

import { SidebarTrigger } from '@/components/ui/sidebar';
import { Package } from 'lucide-react';

export function MobileHeader() {
  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-4 md:hidden">
      <SidebarTrigger className="h-10 w-10 text-primary hover:bg-primary/5 rounded-xl" />
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary shadow-lg shadow-primary/20">
          <Package className="h-5 w-5 text-white" />
        </div>
        <h1 className="text-lg font-black text-foreground font-headline tracking-tighter">
          Rehanza Hub
        </h1>
      </div>
    </header>
  );
}
