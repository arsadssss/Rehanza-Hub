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
  gradient: string;
  description?: string;
  isTrendUp?: boolean;
}

const KpiCard = ({ 
    title, 
    value, 
    icon: Icon, 
    loading, 
    gradient, 
    description,
    isTrendUp 
}: KpiCardProps) => {
    return (
        <div className="group relative overflow-hidden bg-white/60 dark:bg-slate-900/40 backdrop-blur-2xl rounded-[2rem] p-6 shadow-[0_10px_40px_rgba(0,0,0,0.04)] border border-white/50 dark:border-white/5 hover:-translate-y-1 transition-all duration-300">
            <div className="flex justify-between items-start relative z-10">
                <div className="flex-1">
                    <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/80 mb-1">{title}</p>
                    {loading ? (
                        <div className="pt-2 space-y-2">
                            <Skeleton className="h-8 w-32 bg-muted/40 rounded-lg" />
                            <Skeleton className="h-3 w-20 bg-muted/30 rounded-md" />
                        </div>
                    ) : (
                        <div className="pt-1">
                            <h2 className="text-3xl font-black font-headline tracking-tighter text-foreground">
                                {value}
                            </h2>
                            {description && (
                                <div className="flex items-center gap-1.5 mt-2">
                                    <div className={cn(
                                        "flex items-center justify-center w-4 h-4 rounded-full",
                                        isTrendUp ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600"
                                    )}>
                                        {isTrendUp ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                                    </div>
                                    <span className="text-[10px] font-bold text-muted-foreground/70">{description}</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
                <div className={cn(
                    "w-12 h-12 flex items-center justify-center rounded-2xl bg-gradient-to-br shadow-lg transition-all duration-500 group-hover:scale-110 group-hover:rotate-6", 
                    gradient
                )}>
                    <Icon className="h-5 w-5 text-white" strokeWidth={2.5} />
                </div>
            </div>
            
            {/* Background decorative elements */}
            <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-24 h-24 bg-white/5 rounded-full blur-2xl group-hover:bg-white/10 transition-colors duration-500" />
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
          gradient="from-blue-400 to-cyan-500" 
          description="Units dispatched"
          isTrendUp={true}
      />
      <KpiCard 
          title="Gross Revenue" 
          value={formatINR(grossRevenue)} 
          icon={Sparkles} 
          loading={loading} 
          gradient="from-violet-500 to-indigo-600" 
          description="Total sales value"
          isTrendUp={true}
      />
      <KpiCard 
          title="Net Profit" 
          value={formatINR(netProfit)} 
          icon={netProfit >= 0 ? TrendingUp : TrendingDown} 
          loading={loading} 
          gradient={netProfit >= 0 ? "from-emerald-400 to-teal-600" : "from-rose-400 to-red-600"} 
          description={netProfit >= 0 ? "Profit margin" : "Loss detected"}
          isTrendUp={netProfit >= 0}
      />
      <KpiCard 
          title="Return Rate" 
          value={`${returnRate.toFixed(1)}%`} 
          icon={Percent} 
          loading={loading} 
          gradient="from-orange-400 to-rose-500" 
          description="Refunds ratio"
          isTrendUp={returnRate < 15}
      />
    </div>
  );
}
