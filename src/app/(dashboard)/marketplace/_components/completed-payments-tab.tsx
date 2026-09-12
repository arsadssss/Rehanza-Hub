"use client";

import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatINRWithDecimals } from "@/lib/format";
import { Wallet, CheckCircle2, Calendar, FileText, ArrowDownRight } from "lucide-react";

interface CompletedPaymentsTabProps {
  completed: {
    count: number;
    daywisePayments: any[];
    header: {
      headerAmount: string;
      netAmount: number;
      netOrderAmount: number;
      netPlatformRecovery: Record<string, any>;
      netPlatformCompensation: Record<string, any>;
    };
    totalAmount30Days?: {
      headerAmount: string;
      netAmount: number;
    };
  };
}

export function CompletedPaymentsTab({ completed }: CompletedPaymentsTabProps) {
  const [selectedRange, setSelectedRange] = useState("last30");
  const payouts = completed.daywisePayments || [];

  const total30Days = completed.totalAmount30Days?.headerAmount || completed.header?.headerAmount || "₹0.0";

  return (
    <div className="space-y-6">
      {/* Top Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-border/70 bg-card">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold shrink-0">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Completed Bank Settlements
            </h3>
            <p className="text-xs text-muted-foreground">
              Historical payouts transferred to registered bank account
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-center">
          <Select value={selectedRange} onValueChange={setSelectedRange}>
            <SelectTrigger className="w-[200px] h-9 text-xs">
              <Calendar className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Select Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="last30" className="text-xs">
                Last 30 days ({total30Days})
              </SelectItem>
              <SelectItem value="last60" className="text-xs">
                Last 60 days
              </SelectItem>
              <SelectItem value="last90" className="text-xs">
                Last 90 days
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {payouts.length === 0 ? (
        /* Authentic Meesho Empty State */
        <Card className="border-border/60 py-16 px-6 text-center shadow-sm">
          <CardContent className="flex flex-col items-center justify-center space-y-3 max-w-sm mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-muted/60 border border-border/80 flex items-center justify-center text-muted-foreground">
              <Wallet className="w-8 h-8 opacity-60" />
            </div>
            <div className="space-y-1">
              <h4 className="text-base font-semibold text-foreground">
                No completed payments to show
              </h4>
              <p className="text-xs text-muted-foreground">
                You do not have any completed payments for the selected period. Settlements will appear here once processed by your bank.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* Completed Payouts Table */
        <div className="rounded-lg border border-border/70 overflow-hidden bg-card shadow-sm">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow className="text-xs">
                <TableHead className="font-semibold">Payment Date</TableHead>
                <TableHead className="font-semibold">Bank Reference / UTR</TableHead>
                <TableHead className="text-right font-semibold">Net Orders</TableHead>
                <TableHead className="text-right font-semibold">Recoveries</TableHead>
                <TableHead className="text-right font-semibold">Transferred Amount</TableHead>
                <TableHead className="text-center font-semibold">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payouts.map((p, idx) => (
                <TableRow key={p.date || idx} className="text-xs hover:bg-muted/20">
                  <TableCell className="font-medium whitespace-nowrap">
                    {p.date}
                  </TableCell>
                  <TableCell className="font-mono text-muted-foreground">
                    {p.utr || p.referenceNo || "MEESHO-NEFT-" + (idx + 1000)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatINRWithDecimals(p.netOrderAmount || p.amount || 0)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-rose-600 dark:text-rose-400">
                    {formatINRWithDecimals(p.platformRecovery || 0)}
                  </TableCell>
                  <TableCell className="text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {formatINRWithDecimals(p.netAmount || p.amount || 0)}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px]">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Transferred
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

