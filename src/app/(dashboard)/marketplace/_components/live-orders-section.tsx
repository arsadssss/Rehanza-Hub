"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, PackageCheck, Radio, AlertCircle, ArrowUpRight } from "lucide-react";

interface LiveOrdersSectionProps {
  loading: boolean;
  orders: {
    pending: number;
    readyToShip: number;
    shipped?: number;
    cancelled?: number;
    totalOrders?: number;
    lastSync?: string | null;
  };
  accountName: string;
}

export function LiveOrdersSection({
  loading,
  orders,
  accountName,
}: LiveOrdersSectionProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-28" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div id="live-orders" className="space-y-3 scroll-mt-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-foreground tracking-tight">
            Live Orders
          </h2>
          <Badge
            variant="outline"
            className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] font-medium gap-1 px-1.5 py-0"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live Sync
          </Badge>
        </div>
        <span className="text-xs text-muted-foreground">
          Scoped to <span className="font-medium text-foreground">{accountName}</span>
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Pending Orders Card */}
        <Card className="border-border/60 shadow-sm bg-gradient-to-br from-amber-500/5 via-card to-card hover:border-amber-500/30 transition-all duration-200">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                <Clock className="w-3.5 h-3.5" />
                Pending Orders
              </div>
              <div className="text-3xl font-extrabold text-foreground tracking-tight">
                {orders.pending}
              </div>
              <p className="text-xs text-muted-foreground">
                Awaiting SLA confirmation & accept
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/20">
              <Clock className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        {/* Ready to Dispatch Card */}
        <Card className="border-border/60 shadow-sm bg-gradient-to-br from-emerald-500/5 via-card to-card hover:border-emerald-500/30 transition-all duration-200">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                <PackageCheck className="w-3.5 h-3.5" />
                Ready to Dispatch
              </div>
              <div className="text-3xl font-extrabold text-foreground tracking-tight">
                {orders.readyToShip}
              </div>
              <p className="text-xs text-muted-foreground">
                Manifested & awaiting courier pickup
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
              <PackageCheck className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

