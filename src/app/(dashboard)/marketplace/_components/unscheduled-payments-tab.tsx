"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatINRWithDecimals } from "@/lib/format";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Eye,
  CreditCard,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Package,
  Calendar,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MeeshoUnscheduledOrderItem } from "@/lib/meesho/types";

interface UnscheduledPaymentsTabProps {
  unscheduled: {
    count: number;
    total: number;
    aggregated_data: {
      totalOrderAmt: number;
      adsCost: number;
      referralAmt: number;
      totalNetOrderAmt: number;
    };
    payoutUIList: MeeshoUnscheduledOrderItem[];
  };
}

export function UnscheduledPaymentsTab({ unscheduled }: UnscheduledPaymentsTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<"orders" | "recovery" | "compensation">("orders");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const [selectedOrder, setSelectedOrder] = useState<MeeshoUnscheduledOrderItem | null>(null);

  const agg = unscheduled.aggregated_data || {
    totalOrderAmt: 0,
    adsCost: 0,
    referralAmt: 0,
    totalNetOrderAmt: 0,
  };

  const ordersList = unscheduled.payoutUIList || [];
  const orderCount = unscheduled.count || ordersList.length;

  // Filter orders
  const filteredOrders = useMemo(() => {
    if (!searchQuery.trim()) return ordersList;
    const q = searchQuery.toLowerCase().trim();
    return ordersList.filter(
      (item) =>
        (item.orderNum && item.orderNum.toLowerCase().includes(q)) ||
        (item.subOrderNum && item.subOrderNum.toLowerCase().includes(q)) ||
        (item.supplierSKU && item.supplierSKU.toLowerCase().includes(q))
    );
  }, [ordersList, searchQuery]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize));
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredOrders.slice(start, start + pageSize);
  }, [filteredOrders, currentPage, pageSize]);

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6">
      {/* 4 Top Summary KPI Cards (Exact match to Meesho Supplier Panel) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Net Order Amount */}
        <Card className="border-border/60 shadow-sm bg-card/80">
          <CardContent className="p-4 space-y-1.5">
            <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
              <span>Total Net Order Amount</span>
              <CreditCard className="w-3.5 h-3.5 text-primary" />
            </div>
            <div className="text-xl font-bold font-mono text-foreground">
              {formatINRWithDecimals(agg.totalNetOrderAmt || agg.totalOrderAmt || 0)}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Orders awaiting release date
            </p>
          </CardContent>
        </Card>

        {/* Card 2: Total Net Platform Recovery */}
        <Card className="border-border/60 shadow-sm bg-card/80">
          <CardContent className="p-4 space-y-1.5">
            <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
              <span>Total Net Platform Recovery</span>
              <TrendingDown className="w-3.5 h-3.5 text-rose-500" />
            </div>
            <div className="text-xl font-bold font-mono text-rose-600 dark:text-rose-400">
              {formatINRWithDecimals(agg.adsCost || 0)}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Unscheduled ads & deductions
            </p>
          </CardContent>
        </Card>

        {/* Card 3: Total Net Platform Compensation */}
        <Card className="border-border/60 shadow-sm bg-card/80">
          <CardContent className="p-4 space-y-1.5">
            <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
              <span>Total Net Platform Compensation</span>
              <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
            </div>
            <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
              {formatINRWithDecimals(agg.referralAmt || 0)}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Referrals & incentive adjustments
            </p>
          </CardContent>
        </Card>

        {/* Card 4: Total Amount */}
        <Card className="border-border/60 shadow-sm bg-gradient-to-br from-pink-500/10 via-card to-card border-pink-500/20">
          <CardContent className="p-4 space-y-1.5">
            <div className="flex items-center justify-between text-xs font-semibold text-pink-700 dark:text-pink-300">
              <span>Total Amount</span>
              <ShieldCheck className="w-3.5 h-3.5" />
            </div>
            <div className="text-xl font-bold font-mono text-pink-600 dark:text-pink-400">
              {formatINRWithDecimals((agg.totalNetOrderAmt || agg.totalOrderAmt || 0) - (agg.adsCost || 0) + (agg.referralAmt || 0))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Estimated unbilled supplier payout
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 3 Sub-tabs Navigation */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 border-b border-border/70 pb-2">
          <button
            type="button"
            onClick={() => setActiveSubTab("orders")}
            className={cn(
              "px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer",
              activeSubTab === "orders"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            Order Details ({orderCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab("recovery")}
            className={cn(
              "px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer",
              activeSubTab === "recovery"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            Platform Recovery (0)
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab("compensation")}
            className={cn(
              "px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer",
              activeSubTab === "compensation"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            Platform Compensation (0)
          </button>
        </div>

        {/* Sub-tab 1: Order Details Table */}
        {activeSubTab === "orders" && (
          <div className="space-y-4">
            {/* Search filter */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative w-full sm:w-80">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search Sub Order No, Order No, SKU..."
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-9 text-xs h-9"
                />
              </div>
              <div className="text-xs text-muted-foreground">
                Showing {filteredOrders.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}–
                {Math.min(currentPage * pageSize, filteredOrders.length)} of {filteredOrders.length} orders
              </div>
            </div>

            {/* Table */}
            <div className="rounded-lg border border-border/70 overflow-hidden bg-card shadow-sm">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow className="text-xs">
                    <TableHead className="font-semibold">Order No.</TableHead>
                    <TableHead className="font-semibold">Sub Order No.</TableHead>
                    <TableHead className="font-semibold">SKU</TableHead>
                    <TableHead className="font-semibold">Dispatch Date</TableHead>
                    <TableHead className="text-right font-semibold">Order Amount</TableHead>
                    <TableHead className="text-right font-semibold">Claims & Comp.</TableHead>
                    <TableHead className="text-right font-semibold">Charges & Rec.</TableHead>
                    <TableHead className="text-right font-semibold">Net Order Amount</TableHead>
                    <TableHead className="text-center font-semibold">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedOrders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="h-32 text-center text-xs text-muted-foreground">
                        No unscheduled orders found matching your search.
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedOrders.map((row, idx) => (
                      <TableRow key={row.subOrderNum || idx} className="text-xs hover:bg-muted/20">
                        <TableCell className="font-mono text-muted-foreground">
                          {row.orderNum}
                        </TableCell>
                        <TableCell className="font-mono font-medium text-foreground">
                          {row.subOrderNum}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-mono text-[11px] font-normal">
                            {row.supplierSKU || "N/A"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground whitespace-nowrap">
                          {row.dispatchDate || "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatINRWithDecimals(row.amount || 0)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-emerald-600 dark:text-emerald-400">
                          {formatINRWithDecimals(row.compensation || row.claim || 0)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-rose-600 dark:text-rose-400">
                          {formatINRWithDecimals(row.penaltiesAndRecovery || row.recovery || 0)}
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold text-foreground">
                          {formatINRWithDecimals(row.netAmount || row.amount || 0)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedOrder(row)}
                            className="h-7 px-2 text-xs gap-1 text-primary hover:text-primary hover:bg-primary/10"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-2">
                <p className="text-xs text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="h-8 px-2 text-xs gap-1"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="h-8 px-2 text-xs gap-1"
                  >
                    Next
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Sub-tab 2: Platform Recovery */}
        {activeSubTab === "recovery" && (
          <Card className="border-border/60 p-8 text-center">
            <div className="flex flex-col items-center justify-center space-y-2 max-w-sm mx-auto">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                <TrendingDown className="w-6 h-6" />
              </div>
              <h4 className="font-semibold text-sm">No Unscheduled Platform Recoveries</h4>
              <p className="text-xs text-muted-foreground">
                There are currently zero pending ads recoveries or platform penalties waiting to be settled.
              </p>
            </div>
          </Card>
        )}

        {/* Sub-tab 3: Platform Compensation */}
        {activeSubTab === "compensation" && (
          <Card className="border-border/60 p-8 text-center">
            <div className="flex flex-col items-center justify-center space-y-2 max-w-sm mx-auto">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                <TrendingUp className="w-6 h-6" />
              </div>
              <h4 className="font-semibold text-sm">No Unscheduled Compensations</h4>
              <p className="text-xs text-muted-foreground">
                There are currently zero pending compensations or referral earnings waiting to be scheduled.
              </p>
            </div>
          </Card>
        )}
      </div>

      {/* Order Itemized Detail Dialog */}
      {selectedOrder && (
        <Dialog open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)}>
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-pink-500/10 text-pink-600">
                  <Package className="w-4 h-4" />
                </div>
                <DialogTitle className="text-base">Sub Order Payout Breakdown</DialogTitle>
              </div>
              <DialogDescription className="font-mono text-xs">
                {selectedOrder.subOrderNum}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs">
              <div className="grid grid-cols-2 gap-2 p-3 rounded-lg bg-muted/40">
                <div>
                  <span className="text-muted-foreground">Parent Order:</span>
                  <p className="font-mono font-medium text-foreground">{selectedOrder.orderNum}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Supplier SKU:</span>
                  <p className="font-mono font-medium text-foreground">{selectedOrder.supplierSKU || "N/A"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Dispatch Date:</span>
                  <p className="font-medium text-foreground">{selectedOrder.dispatchDate || "—"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Live Status:</span>
                  <p className="font-medium text-foreground">
                    <Badge variant="secondary" className="text-[10px] py-0">
                      {selectedOrder.liveOrderStatus || "Shipped"}
                    </Badge>
                  </p>
                </div>
              </div>

              <div className="space-y-2 border-t border-border/70 pt-3">
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Order Amount (Gross):</span>
                  <span className="font-mono font-medium">{formatINRWithDecimals(selectedOrder.amount || 0)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Claims & Compensations:</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400">
                    +{formatINRWithDecimals(selectedOrder.compensation || selectedOrder.claim || 0)}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Recoveries & Penalties:</span>
                  <span className="font-mono text-rose-600 dark:text-rose-400">
                    -{formatINRWithDecimals(selectedOrder.penaltiesAndRecovery || selectedOrder.recovery || 0)}
                  </span>
                </div>
                <div className="flex justify-between py-2 text-sm font-bold bg-muted/30 px-3 rounded-md">
                  <span>Net Order Payout:</span>
                  <span className="font-mono text-primary">
                    {formatINRWithDecimals(selectedOrder.netAmount || selectedOrder.amount || 0)}
                  </span>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

