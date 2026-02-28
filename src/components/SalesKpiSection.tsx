"use client";

import React from 'react';
import { ShoppingCart, Sparkles, TrendingUp, TrendingDown, Percent } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { formatINR } from '@/lib/format';
import { cn } from '@/lib/utils';

interface KpiCardProps {
  title: string;
  value: string;
  icon: React.ElementType;
  loading: boolean;
  borderClass: string;
  glowClass: string;
  iconBgClass: string;
  iconColorClass: string;
  description?: string;
  isTrendUp?: boolean;
}

const KpiCard = ({ 
    title, 
    value, 
    icon: Icon, 
    loading, 
    borderClass,
    glowClass,
    iconBgClass,
    iconColorClass,
    description,
    isTrendUp 
}: KpiCardProps) => {
    return (
        <div className={cn(
            "relative bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 border-l-4 hover:-translate-y-1 overflow-hidden",
            borderClass
        )}>
            {/* Soft Gradient Overlay Layer */}
            <div className={cn("absolute inset-0 bg-gradient-to-br to-transparent rounded-2xl pointer-events-none opacity-40", glowClass)} />
            
            <div className="relative z-10">
                <p className="text-xs font-semibold text-gray-400 dark:text-muted-foreground tracking-wider uppercase">{title}</p>
                {loading ? (
                    <div className="mt-2 space-y-2">
                        <Skeleton className="h-9 w-32 bg-muted/40" />
                        <Skeleton className="h-4 w-24 bg-muted/20" />
                    </div>
                ) : (
                    <div className="mt-2">
                        <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-100 font-headline tracking-tight">
                            {value}
                        </h2>
                        {description && (
                            <div className="flex items-center gap-1.5 mt-2">
                                <div className={cn(
                                    "flex items-center justify-center w-4 h-4 rounded-full",
                                    isTrendUp ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400" : "bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400"
                                )}>
                                    {isTrendUp ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                                </div>
                                <span className="text-sm text-gray-500 dark:text-muted-foreground font-medium">{description}</span>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Icon Badge Style */}
            <div className={cn(
                "absolute top-6 right-6 w-12 h-12 rounded-xl flex items-center justify-center shadow-md",
                iconBgClass
            )}>
                <Icon className={cn("w-5 h-5", iconColorClass)} strokeWidth={2.5} />
            </div>
        </div>
    );
};

interface SalesKpiSectionProps {
  totalUnits: number;
  grossRevenue: number;
  netProfit: number;
  returnRate: number;
  loading: boolean;
}

export function SalesKpiSection({
  totalUnits,
  grossRevenue,
  netProfit,
  returnRate,
  loading
}: SalesKpiSectionProps) {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      <KpiCard 
          title="Total Units Sold" 
          value={totalUnits.toLocaleString('en-IN')} 
          icon={ShoppingCart} 
          loading={loading} 
          borderClass="border-indigo-500"
          glowClass="from-indigo-50"
          iconBgClass="bg-indigo-100 dark:bg-indigo-900/30"
          iconColorClass="text-indigo-600 dark:text-indigo-400"
          description="Units dispatched"
          isTrendUp={true}
      />
      <KpiCard 
          title="Gross Revenue" 
          value={formatINR(grossRevenue)} 
          icon={Sparkles} 
          loading={loading} 
          borderClass="border-blue-500"
          glowClass="from-blue-50"
          iconBgClass="bg-blue-100 dark:bg-blue-900/30"
          iconColorClass="text-blue-600 dark:text-blue-400"
          description="Total sales value"
          isTrendUp={true}
      />
      <KpiCard 
          title="Net Profit" 
          value={formatINR(netProfit)} 
          icon={netProfit >= 0 ? TrendingUp : TrendingDown} 
          loading={loading} 
          borderClass="border-emerald-500"
          glowClass="from-emerald-50"
          iconBgClass="bg-emerald-100 dark:bg-emerald-900/30"
          iconColorClass="text-emerald-600 dark:text-emerald-400"
          description={netProfit >= 0 ? "Profit margin" : "Loss detected"}
          isTrendUp={netProfit >= 0}
      />
      <KpiCard 
          title="Return Rate" 
          value={`${returnRate.toFixed(1)}%`} 
          icon={Percent} 
          loading={loading} 
          borderClass="border-orange-500"
          glowClass="from-orange-50"
          iconBgClass="bg-orange-100 dark:bg-orange-900/30"
          iconColorClass="text-orange-600 dark:text-orange-400"
          description="Refunds ratio"
          isTrendUp={returnRate < 15}
      />
    </div>
  );
}
