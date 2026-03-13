
"use client";

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ShoppingBag, TrendingUp, Calendar, Zap } from 'lucide-react';
import { formatINR } from '@/lib/format';
import { cn } from '@/lib/utils';

interface StatsCardsProps {
  stats: any;
  loading: boolean;
}

export function OrdersStatsCards({ stats, loading }: StatsCardsProps) {
  const cards = [
    {
      title: 'Total Orders',
      value: stats?.totalOrders || 0,
      icon: ShoppingBag,
      color: 'text-blue-600',
      bg: 'bg-blue-100 dark:bg-blue-900/20',
      isCurrency: false
    },
    {
      title: 'Total Revenue',
      value: stats?.totalRevenue || 0,
      icon: TrendingUp,
      color: 'text-emerald-600',
      bg: 'bg-emerald-100 dark:bg-emerald-900/20',
      isCurrency: true
    },
    {
      title: "Today's Orders",
      value: stats?.todayOrders || 0,
      icon: Calendar,
      color: 'text-amber-600',
      bg: 'bg-amber-100 dark:bg-amber-900/20',
      isCurrency: false
    },
    {
      title: "Today's Revenue",
      value: stats?.todayRevenue || 0,
      icon: Zap,
      color: 'text-indigo-600',
      bg: 'bg-indigo-100 dark:bg-indigo-900/20',
      isCurrency: true
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
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{card.title}</p>
                {loading ? (
                  <Skeleton className="h-8 w-24 mt-1" />
                ) : (
                  <h3 className="text-2xl font-black font-headline tracking-tighter mt-0.5">
                    {card.isCurrency ? formatINR(card.value) : card.value.toLocaleString()}
                  </h3>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
