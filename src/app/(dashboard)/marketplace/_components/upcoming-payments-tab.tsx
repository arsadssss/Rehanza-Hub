"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatINRWithDecimals } from "@/lib/format";
import {
  Calendar,
  CalendarDays,
  CreditCard,
  Info,
  TrendingDown,
  TrendingUp,
  AlertCircle,
  HelpCircle,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MeeshoUpcomingDayPayment } from "@/lib/meesho/types";

interface UpcomingPaymentsTabProps {
  upcoming: {
    header: {
      headerAmount: string;
      netAmount: number;
      netOrderAmount: number;
      netPlatformRecovery: Record<string, any>;
      netPlatformCompensation: Record<string, any>;
    };
    totalAmount7Days?: {
      headerAmount: string;
      netAmount: number;
    };
    daywisePayments: MeeshoUpcomingDayPayment[];
    count: number;
  };
}

export function UpcomingPaymentsTab({ upcoming }: UpcomingPaymentsTabProps) {
  const days = upcoming.daywisePayments || [];
  const [selectedDateIndex, setSelectedDateIndex] = useState(0);

  useEffect(() => {
    if (days.length > 0 && selectedDateIndex >= days.length) {
      setSelectedDateIndex(0);
    }
  }, [days.length, selectedDateIndex]);

  const activePayment = days[selectedDateIndex] || null;

  const formatDateTab = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  const total7DaysAmount = upcoming.totalAmount7Days?.headerAmount || upcoming.header?.headerAmount || "₹0.0";

  return (
    <div className="space-y-6">
      {/* Overview Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-border/70 bg-gradient-to-r from-pink-500/5 via-purple-500/5 to-transparent">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-pink-500/10 text-pink-600 dark:text-pink-400 flex items-center justify-center font-bold shrink-0">
            <CalendarDays className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Scheduled Payout Timeline
            </h3>
            <p className="text-xs text-muted-foreground">
              Upcoming settlements confirmed by Meesho Finance
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <Badge
            variant="outline"
            className="px-3 py-1.5 text-xs font-semibold bg-background border-border shadow-sm flex items-center gap-1.5"
          >
            <span className="text-muted-foreground font-normal">Next 7 Days Estimated:</span>
            <span className="text-foreground font-bold">{total7DaysAmount}</span>
          </Badge>
        </div>
      </div>

      {days.length === 0 ? (
        <Card className="border-border/60 p-8 text-center">
          <div className="flex flex-col items-center justify-center space-y-2 max-w-sm mx-auto">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
              <Calendar className="w-6 h-6" />
            </div>
            <h4 className="font-semibold text-sm">No Upcoming Payments</h4>
            <p className="text-xs text-muted-foreground">
              There are currently no scheduled upcoming payments for this supplier account. New payments will appear here once orders are cleared.
            </p>
          </div>
        </Card>
      ) : (
        <>
          {/* Horizontal Date Selector Tabs */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Select Payout Date
            </label>
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
              {days.map((day, idx) => {
                const isSelected = idx === selectedDateIndex;
                const isNegative = day.netAmount < 0;

                return (
                  <button
                    key={day.date || idx}
                    type="button"
                    onClick={() => setSelectedDateIndex(idx)}
                    className={cn(
                      "flex items-center gap-2.5 px-4 py-2.5 rounded-lg border text-xs font-medium transition-all shrink-0 text-left cursor-pointer",
                      isSelected
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-card hover:bg-accent/50 border-border/70 text-foreground"
                    )}
                  >
                    <Calendar className="w-3.5 h-3.5 shrink-0 opacity-70" />
                    <span className="font-semibold">{formatDateTab(day.date)}</span>
                    <span
                      className={cn(
                        "text-[11px] px-1.5 py-0.5 rounded font-mono font-medium",
                        isSelected
                          ? "bg-primary-foreground/20 text-primary-foreground"
                          : isNegative
                          ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                          : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      )}
                    >
                      {day.headerAmount || formatINRWithDecimals(day.netAmount)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Payment Breakdown Table */}
          {activePayment && (
            <Card className="border-border/60 shadow-sm overflow-hidden">
              <CardHeader className="bg-muted/20 border-b border-border/60 pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-base font-semibold">
                      Payment Breakdown for {formatDateTab(activePayment.date)}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Official payout ledger components as calculated by Meesho
                    </CardDescription>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs font-mono font-bold px-2.5 py-1 self-start sm:self-center",
                      activePayment.netAmount >= 0
                        ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                        : "bg-rose-500/10 text-rose-600 border-rose-500/30"
                    )}
                  >
                    Net: {formatINRWithDecimals(activePayment.netAmount)}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="p-0 divide-y divide-border/60">
                {/* Orders / Sales & Returns */}
                <div className="p-4 sm:p-5 flex items-center justify-between hover:bg-muted/10 transition-colors">
                  <div className="space-y-0.5">
                    <div className="text-sm font-medium text-foreground flex items-center gap-1.5">
                      <CreditCard className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      Orders / Sales & Returns
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Gross order revenue after return and cancellation adjustments
                    </p>
                  </div>
                  <div className="text-sm font-mono font-semibold text-foreground">
                    {formatINRWithDecimals(activePayment.netOrderAmount)}
                  </div>
                </div>

                {/* Net Platform Recovery */}
                <div className="p-4 sm:p-5 space-y-2 hover:bg-muted/10 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <div className="text-sm font-medium text-foreground flex items-center gap-1.5">
                        <TrendingDown className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                        Net Platform Recovery
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Advertising charges, program costs, and platform deductions
                      </p>
                    </div>
                    <div className="text-sm font-mono font-semibold text-rose-600 dark:text-rose-400">
                      {formatINRWithDecimals(activePayment.platformRecovery || activePayment.netPlatformRecovery?.adsCost || 0)}
                    </div>
                  </div>

                  {/* Sub-item details */}
                  <div className="pl-6 border-l-2 border-border/80 space-y-1 pt-1 text-xs text-muted-foreground">
                    <div className="flex justify-between">
                      <span>Ads Cost:</span>
                      <span className="font-mono text-rose-600 dark:text-rose-400">
                        {formatINRWithDecimals(activePayment.netPlatformRecovery?.adsCost || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Program Costs:</span>
                      <span className="font-mono">
                        {formatINRWithDecimals(activePayment.netPlatformRecovery?.programCosts || 0)}
                      </span>
                    </div>
                    {activePayment.netPlatformRecovery?.loanSettlementAmount ? (
                      <div className="flex justify-between">
                        <span>Loan Settlement:</span>
                        <span className="font-mono">
                          {formatINRWithDecimals(activePayment.netPlatformRecovery.loanSettlementAmount)}
                        </span>
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* Net Platform Compensation */}
                <div className="p-4 sm:p-5 space-y-2 hover:bg-muted/10 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <div className="text-sm font-medium text-foreground flex items-center gap-1.5">
                        <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        Net Platform Compensation
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Referral bonuses, platform incentives, and claims approved
                      </p>
                    </div>
                    <div className="text-sm font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                      {formatINRWithDecimals(activePayment.platformCompensation || 0)}
                    </div>
                  </div>

                  {/* Sub-item details */}
                  <div className="pl-6 border-l-2 border-border/80 space-y-1 pt-1 text-xs text-muted-foreground">
                    <div className="flex justify-between">
                      <span>Program Benefits:</span>
                      <span className="font-mono">
                        {formatINRWithDecimals(activePayment.netPlatformCompensation?.programBenefits || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Referral Earnings:</span>
                      <span className="font-mono">
                        {formatINRWithDecimals(activePayment.netPlatformCompensation?.referralAmount || 0)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Net Final Settlement Amount */}
                <div className="p-4 sm:p-5 bg-muted/30 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="text-base font-bold text-foreground">
                      Net Amount to Transfer
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Final bank settlement after all recoveries and compensations
                    </p>
                  </div>
                  <div
                    className={cn(
                      "text-xl sm:text-2xl font-black font-mono tracking-tight",
                      activePayment.netAmount >= 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-rose-600 dark:text-rose-400"
                    )}
                  >
                    {formatINRWithDecimals(activePayment.netAmount)}
                  </div>
                </div>
              </CardContent>

              {/* Bank Transfer Advisory Note */}
              <div className="p-4 bg-muted/10 border-t border-border/60 flex items-start gap-2.5 text-xs text-muted-foreground">
                <Building2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <p>
                  Payments will be transferred to your registered supplier bank account by the end of the day or subsequent business days as per standard RBI clearing cycles (NEFT/RTGS).
                </p>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

