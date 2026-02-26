"use client";

import React from 'react';
import { formatINR } from '@/lib/format';
import { cn } from '@/lib/utils';

interface VendorFinancialCardProps {
  name: string;
  totalPurchase: number;
  totalPaid: number;
  balanceDue: number;
  index: number;
  onClick?: () => void;
}

const colorThemes = [
  {
    border: "border-b-rose-500",
    badge: "bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400",
    highlight: "bg-rose-50 dark:bg-rose-950/20"
  },
  {
    border: "border-b-emerald-500",
    badge: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
    highlight: "bg-emerald-50 dark:bg-emerald-950/20"
  },
  {
    border: "border-b-indigo-500",
    badge: "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400",
    highlight: "bg-indigo-50 dark:bg-indigo-950/20"
  },
  {
    border: "border-b-amber-500",
    badge: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
    highlight: "bg-amber-50 dark:bg-amber-950/20"
  }
];

export function VendorFinancialCard({ 
  name, 
  totalPurchase, 
  totalPaid, 
  balanceDue, 
  index,
  onClick 
}: VendorFinancialCardProps) {
  const theme = colorThemes[index % colorThemes.length];
  const isSettled = balanceDue <= 0;

  return (
    <div 
      onClick={onClick}
      className={cn(
        "group relative bg-white dark:bg-slate-900 rounded-xl p-5 shadow-md hover:shadow-xl transition-all duration-300 border-b-4 cursor-pointer",
        theme.border,
        "hover:-translate-y-1"
      )}
    >
      {/* Header */}
      <div className="flex justify-between items-start">
         <h3 className="text-lg font-bold text-foreground truncate mr-2" title={name}>{name}</h3>
         <span className={cn(
           "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
           isSettled ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" : theme.badge
         )}>
            {isSettled ? "Settled" : "Due"}
         </span>
      </div>

      {/* Info Rows */}
      <div className="mt-6 space-y-3 text-sm text-muted-foreground">
         <div className="flex justify-between items-center">
            <span>Total Purchase</span>
            <span className="font-bold text-foreground">
               {formatINR(totalPurchase)}
            </span>
         </div>

         <div className="flex justify-between items-center">
            <span>Total Paid</span>
            <span className="font-bold text-foreground">
               {formatINR(totalPaid)}
            </span>
         </div>
      </div>

      {/* Footer Highlight */}
      <div className={cn(
        "mt-6 p-4 rounded-xl flex justify-between items-center transition-colors duration-300",
        theme.highlight,
        "group-hover:bg-opacity-80"
      )}>
         <span className="text-xs font-bold uppercase text-muted-foreground">Balance Due</span>
         <span className={cn(
           "text-xl font-black",
           isSettled ? "text-green-600" : "text-foreground"
         )}>
            {formatINR(balanceDue)}
         </span>
      </div>
    </div>
  );
}
