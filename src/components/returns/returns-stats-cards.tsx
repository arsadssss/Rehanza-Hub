"use client";

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Undo2, Truck, UserCheck, Calendar, Package } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ReturnsStatsCardsProps {
  stats: any;
  loading: boolean;
}

export function ReturnsStatsCards({ stats, loading }: ReturnsStatsCardsProps) {
  const cards = [
    {
      title: 'Total Returns',
      value: stats?.totalReturns || 0,
      description: `${stats?.totalUnits || 0} total units`,
      icon: Undo2,
      color: 'text-rose-600',
      bg: 'bg-rose-100 dark:bg-rose-900/20'
    },
    {
      title: "Today's Returns",
      value: stats?.todayReturns || 0,
      description: 'New requests today',
      icon: Calendar,
      color: 'text-amber-600',
      bg: 'bg-amber-100 dark:bg-amber-900/20'
    },
    {
      title: 'RTO (Courier)',
      value: stats?.rtoCount || 0,
      description: 'Courier non-delivery',
      icon: Truck,
      color: 'text-blue-600',
      bg: 'bg-blue-100 dark:bg-blue-900/20'
    },
    {
      title: 'Customer Returns',
      value: stats?.customerCount || 0,
      description: 'Post-delivery returns',
      icon: UserCheck,
      color: 'text-indigo-600',
      bg: 'bg-indigo-100 dark:bg-indigo-900/20'
    }
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
      {cards.map((card, idx) => (
        <Card key={idx} className="border-0 shadow-xl rounded-2xl overflow-hidden bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className={cn("p-3 rounded-xl", card.bg)}>
                <card.icon className={cn("h-6 w-6", card.color)} />
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground truncate">{card.title}</p>
                {loading ? (
                  <Skeleton className="h-8 w-16 mt-1" />
                ) : (
                  <>
                    <h3 className="text-2xl font-black font-headline tracking-tighter mt-0.5 text-foreground">
                      {card.value.toLocaleString()}
                    </h3>
                    <p className="text-[9px] font-medium text-muted-foreground mt-0.5 truncate">{card.description}</p>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
