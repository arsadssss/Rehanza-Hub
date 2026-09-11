"use client";

import React from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface AiAssistButtonProps {
  isOpen: boolean;
  onClick: () => void;
  className?: string;
}

export function AiAssistButton({ isOpen, onClick, className }: AiAssistButtonProps) {
  return (
    <button
      onClick={onClick}
      type="button"
      className={cn(
        "relative group overflow-hidden h-11 px-4 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center gap-2.5 transition-all duration-300 backdrop-blur-xl active:scale-[0.98]",
        isOpen
          ? "border border-indigo-400 bg-gradient-to-r from-indigo-600/70 via-purple-600/60 to-indigo-700/70 text-white shadow-lg shadow-indigo-500/30 ring-2 ring-indigo-400/40"
          : "border border-indigo-500/30 bg-gradient-to-r from-indigo-950/60 via-purple-950/40 to-slate-900/60 text-indigo-100 hover:border-indigo-400/60 hover:text-white hover:shadow-lg hover:shadow-indigo-950/50 hover:bg-slate-900/80",
        className
      )}
      aria-label="Open Rehanza AI Business Copilot"
      aria-expanded={isOpen}
    >
      {/* Background ambient glow effect */}
      <span className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

      {/* Sparkle Icon */}
      <div className="relative flex items-center justify-center">
        <Sparkles
          className={cn(
            "h-4 w-4 transition-transform duration-300",
            isOpen ? "text-white rotate-12 scale-110" : "text-indigo-300 group-hover:rotate-12 group-hover:scale-110"
          )}
        />
        <span className="absolute -top-0.5 -right-0.5 flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-indigo-300" />
        </span>
      </div>

      <span className="relative font-extrabold tracking-widest text-[11px] font-headline">
        AI ASSIST
      </span>
    </button>
  );
}

