'use client';

import Image from 'next/image';
import { Sparkles } from 'lucide-react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useAiChat } from '@/components/ai/ai-chat-context';
import { cn } from '@/lib/utils';

export function MobileHeader() {
  const { isOpen, toggleChat } = useAiChat();

  return (
    <header className="glass-panel sticky top-0 z-40 flex h-16 items-center justify-between border-b border-white/10 bg-slate-950/85 px-4 backdrop-blur-xl md:hidden">
      <div className="flex items-center gap-3">
        <SidebarTrigger className="h-10 w-10 rounded-xl text-slate-200 hover:bg-white/5 hover:text-white" />
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg bg-white/80 shadow-lg shadow-primary/10 ring-1 ring-slate-200/80 dark:bg-slate-900/70 dark:ring-slate-700/80">
            <Image
              src="/images/favicon.png"
              alt="Rehanza Hub"
              width={36}
              height={36}
              className="h-full w-full object-contain p-1"
            />
          </div>
          <h1 className="text-lg font-black text-foreground font-headline tracking-tighter">
            Rehanza Hub
          </h1>
        </div>
      </div>

      {/* Compact Mobile AI Trigger */}
      <button
        type="button"
        onClick={toggleChat}
        aria-label="Toggle Rehanza AI Business Copilot"
        aria-expanded={isOpen}
        className={cn(
          "h-9 px-2.5 rounded-xl font-bold text-[11px] uppercase tracking-wider flex items-center gap-1.5 transition-all duration-200 active:scale-95 border",
          isOpen
            ? "bg-indigo-600 text-white border-indigo-400 shadow-md shadow-indigo-500/30"
            : "bg-indigo-950/40 text-indigo-200 border-indigo-500/30 hover:bg-indigo-900/50 hover:text-white"
        )}
      >
        <Sparkles className={cn("h-3.5 w-3.5", isOpen ? "text-white" : "text-indigo-300")} />
        <span className="font-headline font-extrabold tracking-tight">AI</span>
      </button>
    </header>
  );
}
