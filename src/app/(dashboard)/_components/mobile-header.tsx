'use client';

import Image from 'next/image';
import { SidebarTrigger } from '@/components/ui/sidebar';

export function MobileHeader() {
  return (
    <header className="glass-panel sticky top-0 z-40 flex h-16 items-center gap-4 border-b border-white/10 bg-slate-950/45 px-4 backdrop-blur-xl md:hidden">
      <SidebarTrigger className="h-10 w-10 rounded-xl text-slate-200 hover:bg-white/5 hover:text-white" />
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg bg-white/80 shadow-lg shadow-primary/10 ring-1 ring-slate-200/80 dark:bg-slate-900/70 dark:ring-slate-700/80">
          <Image
            src="/images/favicon.png"
            alt="Rehanza Hub"
            width={36}
            height={36}
            className="h-full w-full object-contain p-1.2"
          />
        </div>
        <h1 className="text-lg font-black text-foreground font-headline tracking-tighter">
          Rehanza Hub
        </h1>
      </div>
    </header>
  );
}
