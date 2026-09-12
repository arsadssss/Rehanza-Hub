"use client";

import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/apiFetch";
import { UpdateCredentialsDialog } from "./update-credentials-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  RefreshCw,
  Unplug,
  ExternalLink,
  ShieldCheck,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Store,
  Layers,
  KeyRound,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AccountCardProps {
  account: {
    accountId: string;
    accountName: string;
    displayName?: string;
    supplierName?: string | null;
    supplierId?: string | null;
    identifier?: string | null;
    connectionStatus: string;
    lastSync: string | null;
  };
  onRefresh: () => Promise<void>;
  onStatusChanged: () => void;
}

export function AccountCard({
  account,
  onRefresh,
  onStatusChanged,
}: AccountCardProps) {
  const { toast } = useToast();
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [isCredentialsOpen, setIsCredentialsOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isConnected = account.connectionStatus === "connected";
  const isExpired = account.connectionStatus === "expired";

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await apiFetch(`/api/marketplace/meesho/accounts?accountId=${encodeURIComponent(account.accountId)}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        toast({
          title: "Account Deleted",
          description: `Account "${account.displayName || account.accountName}" and all associated Meesho data have been permanently removed.`,
        });
        setIsDeleteDialogOpen(false);
        onStatusChanged();
      } else {
        throw new Error(data.error || "Failed to delete account");
      }
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Deletion Failed",
        description: err.message || "An unexpected error occurred while deleting the account.",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleManualRefresh = async () => {
    setRefreshing(true);
    try {
      // 1. Sync orders
      const orderRes = await apiFetch(`/api/marketplace/meesho/orders/sync`, {
        method: "POST",
        headers: { "x-account-id": account.accountId },
        body: JSON.stringify({ limit: 100, accountId: account.accountId }),
      });
      const orderJson = await orderRes.json();

      // 2. Sync payments
      const paymentRes = await apiFetch(`/api/marketplace/meesho/payments`, {
        method: "POST",
        headers: { "x-account-id": account.accountId },
        body: JSON.stringify({ accountId: account.accountId }),
      });
      const paymentJson = await paymentRes.json();

      if (!orderRes.ok && !paymentRes.ok) {
        throw new Error(orderJson.error || paymentJson.error || "Sync failed.");
      }

      await onRefresh();

      toast({
        title: "Account Synchronized",
        description: `Successfully refreshed live orders and payments for ${account.accountName}.`,
      });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Sync Failed",
        description: err.message || "Failed to synchronize marketplace data.",
      });
    } finally {
      setRefreshing(false);
    }
  };

  const handleReconnect = async () => {
    setActionLoading(true);
    try {
      const res = await apiFetch(`/api/marketplace/meesho/connect`, {
        method: "POST",
        headers: { "x-account-id": account.accountId },
        body: JSON.stringify({ accountId: account.accountId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to initiate reconnection.");
      }

      const loginUrl = data.data?.loginUrl || "https://supplier.meesho.com/panel/v3/new/login";
      window.open(loginUrl, "_blank", "width=1000,height=750,noopener,noreferrer");

      toast({
        title: "Reconnection Window Launched",
        description: "Please complete login in the opened window. Session will update automatically.",
      });
      onStatusChanged();
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Reconnection Failed",
        description: err.message,
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm(`Are you sure you want to disconnect ${account.accountName}? Live sync will be halted.`)) {
      return;
    }

    setActionLoading(true);
    try {
      const res = await apiFetch(`/api/marketplace/meesho/disconnect`, {
        method: "POST",
        headers: { "x-account-id": account.accountId },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to disconnect.");
      }

      toast({
        title: "Account Disconnected",
        description: `${account.accountName} session has been revoked.`,
      });
      onStatusChanged();
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Disconnect Failed",
        description: err.message,
      });
    } finally {
      setActionLoading(false);
    }
  };

  const formatLastSync = (iso: string | null) => {
    if (!iso) return "Never synced";
    try {
      const d = new Date(iso);
      return d.toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "Recently";
    }
  };

  return (
    <Card className="border-border/60 shadow-sm bg-card/80 backdrop-blur-sm overflow-hidden">
      <CardContent className="p-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* Account & Marketplace Info */}
          <div className="flex items-start sm:items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-500/20 to-purple-600/20 border border-pink-500/30 flex items-center justify-center text-pink-600 dark:text-pink-400 font-bold shrink-0">
              <Store className="w-6 h-6" />
            </div>

            <div className="space-y-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-semibold text-foreground truncate">
                  {account.displayName || account.accountName}
                </h3>
                <Badge variant="secondary" className="text-[11px] font-medium bg-pink-500/10 text-pink-700 dark:text-pink-300 border-pink-500/20">
                  Meesho
                </Badge>

                {isConnected && (
                  <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 gap-1 text-[11px] font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Connected
                  </Badge>
                )}
                {isExpired && (
                  <Badge variant="outline" className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 gap-1 text-[11px] font-medium">
                    <AlertTriangle className="w-3 h-3" />
                    Session Expired
                  </Badge>
                )}
                {!isConnected && !isExpired && (
                  <Badge variant="outline" className="bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border-zinc-500/30 gap-1 text-[11px] font-medium">
                    <XCircle className="w-3 h-3" />
                    Disconnected
                  </Badge>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {account.supplierName && (
                  <span className="flex items-center gap-1 font-medium text-foreground/80">
                    Supplier: <span className="text-foreground">{account.supplierName}</span>
                  </span>
                )}
                {account.identifier && (
                  <span>
                    Identifier: <code className="bg-muted px-1.5 py-0.5 rounded text-[11px] font-mono">{account.identifier}</code>
                  </span>
                )}
                {account.supplierId && (
                  <span>
                    Supplier ID: <code className="bg-muted px-1.5 py-0.5 rounded text-[11px] font-mono">{account.supplierId}</code>
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-muted-foreground" />
                  Last Sync: {formatLastSync(account.lastSync)}
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 self-start md:self-center shrink-0">
            {isConnected ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleManualRefresh}
                  disabled={refreshing || actionLoading}
                  className="gap-1.5 text-xs h-9"
                >
                  <RefreshCw className={cn("w-3.5 h-3.5", refreshing && "animate-spin")} />
                  {refreshing ? "Syncing..." : "Refresh"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCredentialsOpen(true)}
                  disabled={actionLoading || refreshing}
                  className="gap-1.5 text-xs h-9 text-emerald-700 dark:text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/10"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  Update Credentials
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReconnect}
                  disabled={actionLoading || refreshing}
                  className="gap-1.5 text-xs h-9 text-muted-foreground hover:text-foreground"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Reconnect
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDisconnect}
                  disabled={actionLoading || refreshing || isDeleting}
                  className="gap-1.5 text-xs h-9 text-amber-600 dark:text-amber-400 hover:text-amber-700 hover:bg-amber-500/10"
                >
                  <Unplug className="w-3.5 h-3.5" />
                  Disconnect
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsDeleteDialogOpen(true)}
                  disabled={actionLoading || refreshing || isDeleting}
                  className="gap-1.5 text-xs h-9 text-rose-600 dark:text-rose-400 hover:text-rose-700 hover:bg-rose-500/10"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </Button>
              </>
            ) : (
              <>
                <Button
                  size="sm"
                  onClick={handleReconnect}
                  disabled={actionLoading || isDeleting}
                  className="gap-1.5 text-xs h-9 bg-pink-600 hover:bg-pink-700 text-white"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Connect Meesho Account
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCredentialsOpen(true)}
                  disabled={actionLoading || isDeleting}
                  className="gap-1.5 text-xs h-9 text-emerald-700 dark:text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/10"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  Update Credentials
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsDeleteDialogOpen(true)}
                  disabled={actionLoading || isDeleting}
                  className="gap-1.5 text-xs h-9 text-rose-600 dark:text-rose-400 hover:text-rose-700 hover:bg-rose-500/10"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </Button>
              </>
            )}
          </div>
        </div>
      </CardContent>

      {/* Update Credentials Dialog */}
      <UpdateCredentialsDialog
        open={isCredentialsOpen}
        onOpenChange={setIsCredentialsOpen}
        accountId={account.accountId}
        accountName={account.displayName || account.accountName}
        onSuccess={onRefresh}
      />

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
              <Trash2 className="w-5 h-5" />
              Delete Meesho Account
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground leading-relaxed pt-1">
              Are you sure you want to permanently delete{" "}
              <span className="font-semibold text-foreground">
                {account.displayName || account.accountName}
              </span>
              {account.identifier ? ` (${account.identifier})` : ""}?
              <br /><br />
              This will permanently wipe all associated Meesho orders, payment history, stored credentials, sync history, and active worker sessions for this account. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel disabled={isDeleting} className="text-xs h-9">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={isDeleting}
              className="text-xs h-9 bg-rose-600 hover:bg-rose-700 text-white gap-1.5"
            >
              {isDeleting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  Permanently Delete
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}


