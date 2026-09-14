"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/apiFetch";
import { resolveActiveAccount } from "@/lib/account";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Store,
  Plus,
  RefreshCw,
  Clock,
  PackageCheck,
  CalendarDays,
  CreditCard,
  Wallet,
  BarChart3,
  ShieldCheck,
  Building2,
  AlertCircle,
} from "lucide-react";
import { AccountCard } from "./_components/account-card";
import { AddAccountDialog } from "./_components/add-account-dialog";
import { LiveOrdersSection } from "./_components/live-orders-section";
import { UpcomingPaymentsTab } from "./_components/upcoming-payments-tab";
import { UnscheduledPaymentsTab } from "./_components/unscheduled-payments-tab";
import { CompletedPaymentsTab } from "./_components/completed-payments-tab";
import { PaymentsGraphTab } from "./_components/payments-graph-tab";
import { MeeshoPaymentsDTO } from "@/lib/meesho/types";

interface MarketplaceAccount {
  accountId: string;
  accountName: string;
  displayName: string;
  supplierName: string | null;
  supplierId: string | null;
  identifier: string | null;
  connectionStatus: string;
  lastSync: string | null;
  autoSyncEnabled: boolean;
}

export default function MarketplacePage() {
  const { toast } = useToast();

  const [accounts, setAccounts] = useState<MarketplaceAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [accountFetchError, setAccountFetchError] = useState<string | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [isAddAccountOpen, setIsAddAccountOpen] = useState(false);

  // Scoped metrics
  const [orderMetrics, setOrderMetrics] = useState({
    pending: 0,
    readyToShip: 0,
    shipped: 0,
    cancelled: 0,
    totalOrders: 0,
    lastSync: null as string | null,
  });

  const [payments, setPayments] = useState<MeeshoPaymentsDTO | null>(null);

  // 1. Fetch available accounts
  const fetchAccounts = useCallback(async () => {
    setLoadingAccounts(true);
    setAccountFetchError(null);
    try {
      const res = await apiFetch("/api/marketplace/meesho/accounts");
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to load marketplace accounts");
      }

      if (Array.isArray(data.accounts)) {
        setAccounts(data.accounts);

        // Explicit account selection rules:
        setSelectedAccountId((current) => {
          // If current selection is still valid in loaded accounts, retain it
          if (current && data.accounts.some((a: any) => a.accountId === current)) {
            return current;
          }

          // Prioritize active account from sessionStorage if present in accounts
          const storedActive = typeof window !== "undefined" ? sessionStorage.getItem("active_account") : null;
          if (storedActive) {
            const matchedStored = data.accounts.find((a: any) => a.accountId === storedActive);
            if (matchedStored) {
              return matchedStored.accountId;
            }
          }

          // Connected accounts priority:
          const connectedAccounts = data.accounts.filter((a: any) => a.connectionStatus === "connected");
          if (connectedAccounts.length >= 1) {
            return connectedAccounts[0].accountId;
          }

          // Fallback to first available account or null if none exist
          return data.accounts[0]?.accountId || null;
        });
      }
    } catch (err: any) {
      console.error("[Marketplace] Error fetching accounts:", err);
      setAccountFetchError(err.message || "Failed to fetch accounts");
      toast({
        variant: "destructive",
        title: "Account Discovery Failed",
        description: err.message,
      });
    } finally {
      setLoadingAccounts(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const selectedAccount = accounts.find((a) => a.accountId === selectedAccountId) || null;

  // 2. Fetch scoped data for selected account
  const fetchAccountData = useCallback(async (accId: string) => {
    if (!accId) return;
    setLoadingData(true);

    try {
      // Fetch Live Orders scoped to accId
      const orderPromise = apiFetch(`/api/marketplace/meesho/orders/sync/status?accountId=${accId}`)
        .then((r) => r.json())
        .catch(() => null);

      // Fetch Payments scoped to accId
      const paymentPromise = apiFetch(`/api/marketplace/meesho/payments?accountId=${accId}`)
        .then((r) => r.json())
        .catch(() => null);

      const [orderRes, paymentRes] = await Promise.all([orderPromise, paymentPromise]);

      if (orderRes?.success && orderRes.data) {
        setOrderMetrics({
          pending: orderRes.data.statusBreakdown?.pending || 0,
          readyToShip: orderRes.data.statusBreakdown?.ready_to_ship || 0,
          shipped: orderRes.data.statusBreakdown?.shipped || 0,
          cancelled: orderRes.data.statusBreakdown?.cancelled || 0,
          totalOrders: orderRes.data.totalOrders || 0,
          lastSync: orderRes.data.lastSync || null,
        });
      } else {
        setOrderMetrics({
          pending: 0,
          readyToShip: 0,
          shipped: 0,
          cancelled: 0,
          totalOrders: 0,
          lastSync: null,
        });
      }

      if (paymentRes?.success && paymentRes.data) {
        setPayments(paymentRes.data);
      } else {
        setPayments(null);
      }
    } catch (err) {
      console.error("[Marketplace] Error fetching account data:", err);
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    if (selectedAccountId) {
      fetchAccountData(selectedAccountId);
    } else {
      setOrderMetrics({
        pending: 0,
        readyToShip: 0,
        shipped: 0,
        cancelled: 0,
        totalOrders: 0,
        lastSync: null,
      });
      setPayments(null);
    }
  }, [selectedAccountId, fetchAccountData]);

  // Handle new account creation
  const handleAccountCreated = async (newAccount: { accountId: string; accountName: string }) => {
    await fetchAccounts();
    setSelectedAccountId(newAccount.accountId);
  };

  return (
    <div className="flex-1 space-y-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Page Header with Multi-Account Selector */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/60 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-pink-500/10 text-pink-600 dark:text-pink-400">
              <Store className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Marketplace
            </h1>
          </div>
        </div>

        {/* Account Selector & Add Account Button */}
        <div className="flex items-center gap-2.5 self-start md:self-center">
          {loadingAccounts ? (
            <Skeleton className="h-9 w-48 rounded-lg" />
          ) : (
            <div className="flex items-center gap-2">
              <Select
                value={selectedAccountId || ""}
                onValueChange={(val) => setSelectedAccountId(val)}
                disabled={accounts.length === 0}
              >
                <SelectTrigger className="w-[200px] sm:w-[240px] h-9 text-xs font-medium">
                  <Store className="w-3.5 h-3.5 mr-2 text-pink-600 dark:text-pink-400 shrink-0" />
                  <SelectValue placeholder={accounts.length === 0 ? "No accounts available" : "Select Account"} />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((acc) => (
                    <SelectItem key={acc.accountId} value={acc.accountId} className="text-xs">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            acc.connectionStatus === "connected"
                              ? "bg-emerald-500"
                              : acc.connectionStatus === "expired"
                              ? "bg-amber-500"
                              : "bg-zinc-400"
                          }`}
                        />
                        <span className="font-medium">{acc.displayName || acc.accountName}</span>
                        {acc.identifier && (
                          <span className="text-[10px] text-muted-foreground font-mono">
                            ({acc.identifier})
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                onClick={() => setIsAddAccountOpen(true)}
                size="sm"
                className="h-9 text-xs gap-1.5 bg-pink-600 hover:bg-pink-700 text-white shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Add Meesho Account</span>
                <span className="sm:hidden">Add</span>
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Account Status Card */}
      {loadingAccounts ? (
        <Card className="border-border/60 p-6">
          <div className="space-y-3">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-20 w-full" />
          </div>
        </Card>
      ) : accountFetchError ? (
        <Card className="border-destructive/40 bg-destructive/5 p-6 text-center space-y-3">
          <p className="text-xs text-destructive font-medium">{accountFetchError}</p>
          <Button variant="outline" size="sm" onClick={fetchAccounts} className="text-xs gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" />
            Retry Discovery
          </Button>
        </Card>
      ) : selectedAccount ? (
        <AccountCard
          account={selectedAccount}
          onRefresh={async () => {
            if (selectedAccountId) {
              await fetchAccounts();
              await fetchAccountData(selectedAccountId);
            }
          }}
          onStatusChanged={fetchAccounts}
        />
      ) : (
        <Card className="border-border/60 p-6 text-center">
          <p className="text-xs text-muted-foreground">No accounts found. Please add a Meesho account.</p>
        </Card>
      )}

      {/* Live Orders Section */}
      <LiveOrdersSection
        loading={loadingData}
        orders={orderMetrics}
        accountName={selectedAccount?.displayName || selectedAccount?.accountName || "Selected Account"}
      />

      {/* Payments Section mirroring official Meesho Supplier Hub */}
      <div className="space-y-4 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-foreground tracking-tight flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-primary" />
            Supplier Payments
          </h2>
          {payments?.lastSyncedAt && (
            <Badge variant="outline" className="text-[11px] font-normal text-muted-foreground self-start sm:self-center">
              Synced: {new Date(payments.lastSyncedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
            </Badge>
          )}
        </div>

        <Tabs defaultValue="upcoming" className="space-y-4">
          <TabsList className="grid grid-cols-2 sm:grid-cols-4 w-full h-auto p-1 bg-muted/60">
            <TabsTrigger value="upcoming" className="text-xs py-2 gap-1.5">
              <CalendarDays className="w-3.5 h-3.5" />
              Upcoming Payments
            </TabsTrigger>
            <TabsTrigger value="unscheduled" className="text-xs py-2 gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              Unscheduled Payments
              {payments?.unscheduled?.count ? (
                <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 h-4 bg-muted-foreground/15">
                  {payments.unscheduled.count}
                </Badge>
              ) : null}
            </TabsTrigger>
            <TabsTrigger value="completed" className="text-xs py-2 gap-1.5">
              <Wallet className="w-3.5 h-3.5" />
              Completed Payments
            </TabsTrigger>
            <TabsTrigger value="graph" className="text-xs py-2 gap-1.5">
              <BarChart3 className="w-3.5 h-3.5" />
              Payments Over Time
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Upcoming Payments */}
          <TabsContent value="upcoming">
            {loadingData ? (
              <div className="space-y-3">
                <Skeleton className="h-16 rounded-xl" />
                <Skeleton className="h-64 rounded-xl" />
              </div>
            ) : (
              <UpcomingPaymentsTab
                upcoming={
                  payments?.upcoming || {
                    header: {
                      headerAmount: "₹0.0",
                      netAmount: 0,
                      netOrderAmount: 0,
                      netPlatformRecovery: {},
                      netPlatformCompensation: {},
                    },
                    daywisePayments: [],
                    count: 0,
                  }
                }
              />
            )}
          </TabsContent>

          {/* Tab 2: Unscheduled Payments */}
          <TabsContent value="unscheduled">
            {loadingData ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <Skeleton className="h-24 rounded-xl" />
                  <Skeleton className="h-24 rounded-xl" />
                  <Skeleton className="h-24 rounded-xl" />
                  <Skeleton className="h-24 rounded-xl" />
                </div>
                <Skeleton className="h-64 rounded-xl" />
              </div>
            ) : (
              <UnscheduledPaymentsTab
                unscheduled={
                  payments?.unscheduled || {
                    count: 0,
                    total: 0,
                    aggregated_data: {
                      totalOrderAmt: 0,
                      adsCost: 0,
                      referralAmt: 0,
                      totalNetOrderAmt: 0,
                    },
                    payoutUIList: [],
                  }
                }
              />
            )}
          </TabsContent>

          {/* Tab 3: Completed Payments */}
          <TabsContent value="completed">
            {loadingData ? (
              <Skeleton className="h-64 rounded-xl" />
            ) : (
              <CompletedPaymentsTab
                completed={
                  payments?.completed || {
                    count: 0,
                    daywisePayments: [],
                    header: {
                      headerAmount: "₹0.0",
                      netAmount: 0,
                      netOrderAmount: 0,
                      netPlatformRecovery: {},
                      netPlatformCompensation: {},
                    },
                  }
                }
              />
            )}
          </TabsContent>

          {/* Tab 4: Payments Over Time */}
          <TabsContent value="graph">
            {loadingData ? (
              <Skeleton className="h-80 rounded-xl" />
            ) : (
              <PaymentsGraphTab graph={payments?.graph} />
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Add Account Dialog */}
      <AddAccountDialog
        open={isAddAccountOpen}
        onOpenChange={setIsAddAccountOpen}
        onAccountCreated={handleAccountCreated}
      />
    </div>
  );
}

