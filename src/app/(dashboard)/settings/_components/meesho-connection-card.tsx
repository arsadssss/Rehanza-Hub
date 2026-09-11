"use client";

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/apiFetch';
import {
  ACTIVE_ACCOUNT_CHANGED_EVENT,
  getStoredAccountId,
  getStoredAccountName,
} from '@/lib/account';
import { Switch } from '@/components/ui/switch';
import {
  MarketplaceConnectionDTO,
  OrderSyncStatusDTO,
  AutoSyncStatusDTO,
  MeeshoSyncHistoryRecord,
} from '@/lib/meesho/types';
import {
  Store,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  RefreshCw,
  Unplug,
  ShieldCheck,
  Calendar,
  Layers,
  ExternalLink,
  Lock,
  Radio,
  DownloadCloud,
  Package,
  Zap,
  History,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function MeeshoConnectionCard() {
  const { toast } = useToast();
  const [connection, setConnection] = useState<MarketplaceConnectionDTO | null>(null);
  const [orderSyncStatus, setOrderSyncStatus] = useState<OrderSyncStatusDTO | null>(null);
  const [autoSyncStatus, setAutoSyncStatus] = useState<AutoSyncStatusDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [toggleLoading, setToggleLoading] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [activeLoginUrl, setActiveLoginUrl] = useState<string | null>(null);
  const [currentAccountName, setCurrentAccountName] = useState<string>('Current Account');
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      if (typeof window !== 'undefined') {
        const storedName = getStoredAccountName();
        if (storedName) setCurrentAccountName(storedName);
      }

      const res = await apiFetch('/api/marketplace/meesho/status');
      const json = await res.json();

      if (res.ok && json.success) {
        setConnection(json.data);
        return json.data as MarketplaceConnectionDTO;
      } else {
        throw new Error(json.error || 'Failed to fetch status');
      }
    } catch (err: any) {
      console.error('Error fetching Meesho connection status:', err);
      setConnection({
        id: null,
        accountId: getStoredAccountId() || '',
        marketplace: 'meesho',
        status: 'disconnected',
        connectedAt: null,
        disconnectedAt: null,
        lastSuccessfulSync: null,
        lastError: err.message,
        sessionExpiresAt: null,
        sessionMetadata: {},
        createdAt: null,
        updatedAt: null,
      });
      return null;
    }
  }, []);

  const fetchOrderSyncStatus = useCallback(async () => {
    try {
      const res = await apiFetch('/api/marketplace/meesho/orders/sync/status');
      const json = await res.json();
      if (res.ok && json.success) {
        setOrderSyncStatus(json.data);
      }
    } catch {
      // Non-blocking
    }
  }, []);

  const fetchAutoSyncStatus = useCallback(async () => {
    try {
      const res = await apiFetch('/api/marketplace/meesho/autosync/status');
      const json = await res.json();
      if (res.ok && json.success) {
        setAutoSyncStatus(json.data);
      }
    } catch {
      // Non-blocking
    }
  }, []);

  const handleToggleAutoSync = async (enabled: boolean) => {
    setToggleLoading(true);
    try {
      const res = await apiFetch('/api/marketplace/meesho/autosync/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to update auto-sync setting.');
      }
      setAutoSyncStatus(json.data);
      toast({
        title: enabled ? 'Auto-Sync Active' : 'Auto-Sync Paused',
        description: enabled
          ? 'Meesho orders will automatically synchronize every 15 minutes.'
          : 'Automatic order synchronization has been paused.',
      });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Auto-Sync Update Failed',
        description: err.message,
      });
    } finally {
      setToggleLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    setLoading(true);
    Promise.all([fetchStatus(), fetchOrderSyncStatus(), fetchAutoSyncStatus()]).finally(() =>
      setLoading(false)
    );

    const handleAccountChange = () => {
      fetchStatus();
      fetchOrderSyncStatus();
      fetchAutoSyncStatus();
    };

    window.addEventListener(ACTIVE_ACCOUNT_CHANGED_EVENT, handleAccountChange);
    return () => {
      window.removeEventListener(ACTIVE_ACCOUNT_CHANGED_EVENT, handleAccountChange);
    };
  }, [fetchStatus, fetchOrderSyncStatus, fetchAutoSyncStatus]);


  // Polling effect while login modal is active
  useEffect(() => {
    if (isLoginModalOpen) {
      pollTimerRef.current = setInterval(async () => {
        const current = await fetchStatus();
        if (current?.status === 'connected') {
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          setIsLoginModalOpen(false);
          toast({
            title: 'Meesho Supplier Panel Connected!',
            description: 'Authenticated session successfully detected and secured.',
          });
        }
      }, 2500);
    } else {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    }

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [isLoginModalOpen, fetchStatus, toast]);

  /**
   * Synchronizes live orders from Meesho Supplier Panel.
   */
  const handleSyncOrders = async () => {
    setSyncLoading(true);
    try {
      const res = await apiFetch('/api/marketplace/meesho/orders/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 100 }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to sync orders.');
      }

      const { totalExtracted, inserted, updated } = json.data;
      toast({
        title: 'Meesho Orders Synchronized',
        description: `Successfully processed ${totalExtracted} orders (${inserted} new, ${updated} updated).`,
      });

      await fetchStatus();
      await fetchOrderSyncStatus();
      await fetchAutoSyncStatus();
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Order Synchronization Failed',
        description: err.message,
      });
    } finally {
      setSyncLoading(false);
    }
  };

  /**
   * Initiates browser login session.
   * Directs user to the official Meesho login page.
   * NEVER asks for passwords or tokens.
   */
  const handleStartLogin = async () => {

    setActionLoading(true);
    try {
      const res = await apiFetch('/api/marketplace/meesho/connect', {
        method: 'POST',
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to initiate login session.');
      }

      const { loginUrl } = json.data;
      setActiveLoginUrl(loginUrl);
      setIsLoginModalOpen(true);

      // Refresh status to show 'pending'
      await fetchStatus();
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Connection Initiation Failed',
        description: err.message,
      });
    } finally {
      setActionLoading(false);
    }
  };

  /**
   * Cancels pending login session.
   */
  const handleCancelLogin = async () => {
    setActionLoading(true);
    try {
      await apiFetch('/api/marketplace/meesho/cancel', {
        method: 'POST',
      });
      setIsLoginModalOpen(false);
      await fetchStatus();
      toast({
        title: 'Login Cancelled',
        description: 'Meesho connection attempt has been cancelled.',
      });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Cancel Failed',
        description: err.message,
      });
    } finally {
      setActionLoading(false);
    }
  };

  /**
   * Disconnects active session and purges credentials.
   */
  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect your Meesho session?')) {
      return;
    }

    setActionLoading(true);
    try {
      const res = await apiFetch('/api/marketplace/meesho/disconnect', {
        method: 'POST',
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to disconnect.');
      }

      setConnection(json.data);
      toast({
        title: 'Meesho Disconnected',
        description: 'Session cleared and credentials securely purged.',
      });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Disconnection Failed',
        description: err.message,
      });
    } finally {
      setActionLoading(false);
    }
  };

  const renderStatusBadge = () => {
    const status = connection?.status || 'disconnected';

    switch (status) {
      case 'connected':
        return (
          <Badge className="bg-emerald-500/15 border-emerald-400/25 text-emerald-400 hover:bg-emerald-500/20 px-3 py-1 text-xs font-semibold gap-1.5 shadow-[0_0_12px_rgba(16,185,129,0.15)]">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            Connected
          </Badge>
        );
      case 'pending':
        return (
          <Badge className="bg-sky-500/15 border-sky-400/25 text-sky-400 hover:bg-sky-500/20 px-3 py-1 text-xs font-semibold gap-1.5 shadow-[0_0_12px_rgba(14,165,233,0.15)]">
            <Radio className="h-3 w-3 text-sky-400 animate-pulse" />
            Waiting for Login
          </Badge>
        );
      case 'expired':
        return (
          <Badge className="bg-amber-500/15 border-amber-400/25 text-amber-400 hover:bg-amber-500/20 px-3 py-1 text-xs font-semibold gap-1.5 shadow-[0_0_12px_rgba(245,158,11,0.15)]">
            <Clock className="h-3 w-3 text-amber-400" />
            Session Expired
          </Badge>
        );
      case 'error':
        return (
          <Badge className="bg-rose-500/15 border-rose-400/25 text-rose-400 hover:bg-rose-500/20 px-3 py-1 text-xs font-semibold gap-1.5 shadow-[0_0_12px_rgba(244,63,94,0.15)]">
            <XCircle className="h-3 w-3 text-rose-400" />
            Error
          </Badge>
        );
      case 'disconnected':
      default:
        return (
          <Badge className="bg-slate-800/60 border-white/10 text-slate-400 hover:bg-slate-800/80 px-3 py-1 text-xs font-semibold gap-1.5">
            <span className="h-2 w-2 rounded-full bg-slate-500" />
            Not Connected
          </Badge>
        );
    }
  };

  const formatDate = (isoString?: string | null) => {
    if (!isoString) return '—';
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '—';
    }
  };

  if (loading) {
    return (
      <Card className="border border-white/10 shadow-[0_18px_55px_rgba(2,6,23,0.22)] rounded-[2rem] overflow-hidden glass-panel">
        <CardHeader className="p-8 pb-4">
          <Skeleton className="h-7 w-48 mb-2" />
          <Skeleton className="h-4 w-96" />
        </CardHeader>
        <CardContent className="p-8 pt-4 space-y-4">
          <Skeleton className="h-24 w-full rounded-2xl" />
        </CardContent>
      </Card>
    );
  }

  const isConnected = connection?.status === 'connected';
  const isPending = connection?.status === 'pending';
  const isExpired = connection?.status === 'expired';
  const metadata = connection?.sessionMetadata || {};

  return (
    <>
      <Card className="border border-white/10 shadow-[0_18px_55px_rgba(2,6,23,0.22)] rounded-[2rem] overflow-hidden glass-panel">
        <CardHeader className="p-8 pb-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-pink-500/20 via-purple-500/10 to-indigo-500/20 border border-pink-500/30 flex items-center justify-center text-pink-400 shadow-inner">
              <Store className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <CardTitle className="font-headline text-2xl font-bold tracking-tight text-white">
                  Meesho Marketplace
                </CardTitle>
                {renderStatusBadge()}
              </div>
              <CardDescription className="font-medium text-slate-400 mt-1">
                Direct seller session connection for catalog, reconciliation, and settlement sync.
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchStatus()}
              disabled={loading || actionLoading}
              className="rounded-xl border-white/10 bg-slate-900/40 hover:bg-slate-800/60 text-xs font-semibold text-slate-300"
            >
              <RefreshCw className={cn('h-3.5 w-3.5 mr-1.5', loading && 'animate-spin')} />
              Refresh
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-8 space-y-6">
          {/* Active Account Banner */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-slate-900/40 border border-white/5 text-sm">
            <div className="flex items-center gap-2.5 text-slate-300">
              <Layers className="h-4 w-4 text-primary" />
              <span className="font-medium text-xs uppercase tracking-wider text-slate-400">Account Scope:</span>
              <span className="font-bold text-white">{currentAccountName}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <span>Direct Official Login • Rehanza Never Asks for Password</span>
            </div>
          </div>

          {/* Connection Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-slate-900/25 border border-white/5 space-y-1.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Connection Status</div>
              <div className="text-sm font-semibold capitalize text-slate-200">
                {connection?.status === 'connected'
                  ? 'Active Session'
                  : connection?.status === 'pending'
                  ? 'Waiting for Login'
                  : connection?.status === 'expired'
                  ? 'Expired (Action Required)'
                  : 'Not Connected'}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/25 border border-white/5 space-y-1.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Calendar className="h-3 w-3 text-slate-400" />
                Connected Since
              </div>
              <div className="text-sm font-semibold text-slate-200">
                {formatDate(connection?.connectedAt)}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/25 border border-white/5 space-y-1.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Clock className="h-3 w-3 text-slate-400" />
                Session Expiry
              </div>
              <div className={cn(
                'text-sm font-semibold',
                isExpired ? 'text-amber-400' : 'text-slate-200'
              )}>
                {formatDate(connection?.sessionExpiresAt)}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/25 border border-white/5 space-y-1.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <RefreshCw className="h-3 w-3 text-slate-400" />
                Last Sync
              </div>
              <div className="text-sm font-semibold text-slate-200">
                {connection?.lastSuccessfulSync
                  ? formatDate(connection.lastSuccessfulSync)
                  : 'Phase 1 Foundation'}
              </div>
            </div>
          </div>

          {/* Supplier Metadata (If Connected) */}
          {isConnected && (metadata.supplierId || metadata.supplierName) && (
            <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20 flex flex-wrap items-center gap-6">
              {metadata.supplierId && (
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-primary/70 block">Supplier ID</span>
                  <span className="text-sm font-bold text-white">{metadata.supplierId}</span>
                </div>
              )}
              {metadata.supplierName && (
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-primary/70 block">Supplier Name</span>
                  <span className="text-sm font-bold text-white">{metadata.supplierName}</span>
                </div>
              )}
              {metadata.sessionSource && (
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-primary/70 block">Session Source</span>
                  <span className="text-sm font-bold text-white capitalize">{metadata.sessionSource.replace('_', ' ')}</span>
                </div>
              )}
            </div>
          )}

          {/* Synced Orders Overview (If Connected) */}
          {isConnected && (
            <div className="p-5 rounded-2xl bg-slate-900/30 border border-white/5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-emerald-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Live Meesho Orders Synced
                  </span>
                </div>
                <Badge className="bg-emerald-500/10 border-emerald-500/20 text-emerald-300 font-mono text-xs">
                  {orderSyncStatus?.totalOrders ?? (metadata.totalOrdersSynced ?? 0)} Total Records
                </Badge>
              </div>

              {orderSyncStatus && orderSyncStatus.totalOrders > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  <div className="p-2.5 rounded-xl bg-slate-900/50 border border-white/5">
                    <div className="text-[10px] uppercase font-bold text-amber-400/80">Pending</div>
                    <div className="text-base font-bold text-white mt-0.5">
                      {orderSyncStatus.statusBreakdown.pending}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-900/50 border border-white/5">
                    <div className="text-[10px] uppercase font-bold text-sky-400/80">Ready to Ship</div>
                    <div className="text-base font-bold text-white mt-0.5">
                      {orderSyncStatus.statusBreakdown.ready_to_ship}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-900/50 border border-white/5">
                    <div className="text-[10px] uppercase font-bold text-emerald-400/80">Shipped</div>
                    <div className="text-base font-bold text-white mt-0.5">
                      {orderSyncStatus.statusBreakdown.shipped}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-900/50 border border-white/5">
                    <div className="text-[10px] uppercase font-bold text-rose-400/80">Cancelled</div>
                    <div className="text-base font-bold text-white mt-0.5">
                      {orderSyncStatus.statusBreakdown.cancelled}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-400 py-1">
                  Ready to sync live orders from Meesho Supplier Panel. Click &ldquo;Sync Orders&rdquo; below.
                </div>
              )}
            </div>
          )}

          {/* Continuous Auto-Sync & Schedule (If Connected) */}
          {isConnected && (
            <div className="p-5 rounded-2xl bg-slate-900/35 border border-white/5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                    <Zap className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white">Continuous Auto-Sync</span>
                      {autoSyncStatus?.enabled ? (
                        <Badge className="bg-emerald-500/15 border-emerald-400/25 text-emerald-400 px-2.5 py-0.5 text-[11px] font-semibold gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          Every {autoSyncStatus?.intervalMinutes || 15}m
                        </Badge>
                      ) : (
                        <Badge className="bg-slate-800 border-white/10 text-slate-400 px-2.5 py-0.5 text-[11px] font-semibold">
                          Paused
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      Persistent browser worker automatically checks for new orders with concurrency protection.
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-slate-300">
                    {autoSyncStatus?.enabled ? 'Auto-Sync ON' : 'Auto-Sync OFF'}
                  </span>
                  <Switch
                    checked={autoSyncStatus?.enabled ?? true}
                    onCheckedChange={(checked) => handleToggleAutoSync(checked)}
                    disabled={toggleLoading || actionLoading}
                    className="data-[state=checked]:bg-emerald-500"
                  />
                </div>
              </div>

              {/* Schedule Info Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div className="p-3 rounded-xl bg-slate-900/50 border border-white/5 space-y-1">
                  <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1.5">
                    <Clock className="h-3 w-3 text-slate-400" />
                    Next Scheduled Sync
                  </div>
                  <div className="text-xs font-bold text-white">
                    {autoSyncStatus?.enabled && autoSyncStatus?.nextSyncAt
                      ? formatDate(autoSyncStatus.nextSyncAt)
                      : autoSyncStatus?.enabled
                      ? 'Scheduled Soon'
                      : 'Paused'}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-900/50 border border-white/5 space-y-1">
                  <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1.5">
                    <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                    Last Sync Outcome
                  </div>
                  <div className="text-xs font-bold text-slate-200 capitalize">
                    {autoSyncStatus?.lastSyncStatus === 'success' ? (
                      <span className="text-emerald-400 font-semibold">
                        Success (+{autoSyncStatus.lastSyncInserted} new, {autoSyncStatus.lastSyncUpdated} updated)
                      </span>
                    ) : autoSyncStatus?.lastSyncStatus === 'failed' ? (
                      <span className="text-rose-400 font-semibold">Failed</span>
                    ) : autoSyncStatus?.lastSyncStatus === 'running' ? (
                      <span className="text-sky-400 font-semibold animate-pulse">Running Now...</span>
                    ) : (
                      'Idle / Ready'
                    )}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-900/50 border border-white/5 space-y-1">
                  <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1.5">
                    <History className="h-3 w-3 text-slate-400" />
                    Sync Mode & Worker
                  </div>
                  <div className="text-xs font-semibold text-slate-300">
                    Persistent Playwright Daemon
                  </div>
                </div>
              </div>

              {/* Sync History Collapsible Header */}
              {autoSyncStatus?.history && autoSyncStatus.history.length > 0 && (
                <div className="pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsHistoryOpen((prev) => !prev)}
                    className="h-8 px-2 text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800/40 w-full justify-between"
                  >
                    <span className="flex items-center gap-2">
                      <History className="h-3.5 w-3.5 text-primary" />
                      Recent Sync History ({autoSyncStatus.history.length} records)
                    </span>
                    {isHistoryOpen ? (
                      <ChevronUp className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                  </Button>

                  {/* Sync History Table */}
                  {isHistoryOpen && (
                    <div className="mt-2.5 overflow-x-auto rounded-xl border border-white/5 bg-slate-950/40">
                      <table className="w-full text-left text-xs text-slate-300">
                        <thead className="bg-slate-900/60 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                          <tr>
                            <th className="px-3 py-2">Started At</th>
                            <th className="px-3 py-2">Type</th>
                            <th className="px-3 py-2">Status</th>
                            <th className="px-3 py-2 text-right">Extracted</th>
                            <th className="px-3 py-2 text-right">Inserted</th>
                            <th className="px-3 py-2 text-right">Updated</th>
                            <th className="px-3 py-2 text-right">Duration</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {autoSyncStatus.history.map((item) => (
                            <tr key={item.id} className="hover:bg-slate-900/30">
                              <td className="px-3 py-2 font-mono text-[11px]">
                                {formatDate(item.startedAt)}
                              </td>
                              <td className="px-3 py-2 capitalize">
                                <span className={cn(
                                  'px-2 py-0.5 rounded text-[10px] font-semibold font-mono',
                                  item.syncType === 'auto' ? 'bg-sky-500/15 text-sky-300' : 'bg-purple-500/15 text-purple-300'
                                )}>
                                  {item.syncType}
                                </span>
                              </td>
                              <td className="px-3 py-2">
                                {item.status === 'success' ? (
                                  <span className="text-emerald-400 font-semibold">Success</span>
                                ) : item.status === 'running' ? (
                                  <span className="text-sky-400 font-semibold animate-pulse">Running</span>
                                ) : (
                                  <span className="text-rose-400 font-semibold" title={item.errorMessage || ''}>
                                    Failed
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-right font-mono text-slate-200">
                                {item.recordsFound}
                              </td>
                              <td className="px-3 py-2 text-right font-mono text-emerald-400 font-semibold">
                                +{item.recordsInserted}
                              </td>
                              <td className="px-3 py-2 text-right font-mono text-slate-300">
                                {item.recordsUpdated}
                              </td>
                              <td className="px-3 py-2 text-right font-mono text-slate-400">
                                {item.durationMs ? `${(item.durationMs / 1000).toFixed(1)}s` : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Error Banner */}
          {connection?.lastError && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block">Connection Notice:</span>
                <span className="text-xs text-rose-400/90">{connection.lastError}</span>
              </div>
            </div>
          )}
        </CardContent>

        <CardFooter className="border-t border-white/5 bg-slate-900/40 px-8 py-5 flex flex-wrap items-center justify-between gap-4">
          <div className="text-xs text-slate-400 flex items-center gap-2">
            <Lock className="h-3.5 w-3.5 text-slate-400" />
            <span>Login happens directly on Meesho Supplier Panel. Rehanza never asks for passwords.</span>
          </div>

          <div className="flex items-center gap-3">
            {!isConnected ? (
              <Button
                onClick={handleStartLogin}
                disabled={actionLoading}
                className="rounded-xl font-bold px-5 h-10 bg-primary hover:bg-primary/90 text-white shadow-md shadow-primary/20"
              >
                <Store className="h-4 w-4 mr-2" />
                {isPending ? 'Resume Login Session' : 'Connect Meesho'}
              </Button>
            ) : (
              <>
                <Button
                  size="sm"
                  onClick={handleSyncOrders}
                  disabled={actionLoading || syncLoading}
                  className="rounded-xl font-bold h-10 px-5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-md shadow-emerald-500/20"
                >
                  <DownloadCloud className={cn('h-4 w-4 mr-2', syncLoading && 'animate-bounce')} />
                  {syncLoading ? 'Syncing Orders...' : 'Sync Orders'}
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleStartLogin}
                  disabled={actionLoading || syncLoading}
                  className="rounded-xl border-white/10 bg-slate-900/60 hover:bg-slate-800 text-slate-200 font-semibold h-10 px-4"
                >
                  <RefreshCw className={cn('h-3.5 w-3.5 mr-2', actionLoading && 'animate-spin')} />
                  Reconnect
                </Button>

                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDisconnect}
                  disabled={actionLoading || syncLoading}
                  className="rounded-xl font-semibold h-10 px-4 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30"
                >
                  <Unplug className="h-3.5 w-3.5 mr-2" />
                  Disconnect
                </Button>
              </>
            )}
          </div>
        </CardFooter>

      </Card>

      {/* Interactive Browser Session Modal */}
      <Dialog open={isLoginModalOpen} onOpenChange={setIsLoginModalOpen}>
        <DialogContent className="max-w-md border-white/10 bg-slate-950/95 backdrop-blur-2xl">
          <DialogHeader className="space-y-2">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-pink-500/10 text-pink-400">
                <Store className="h-5 w-5" />
              </div>
              <DialogTitle className="font-headline text-xl font-bold text-white">
                Meesho Supplier Panel Login
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-slate-400 leading-relaxed">
              Authenticate your supplier account directly on Meesho. Rehanza-Hub never asks for, handles, or stores your password.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            {/* Live Listening Indicator */}
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-sky-500/10 border border-sky-500/25 text-sky-200">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-sky-500"></span>
              </span>
              <div className="text-xs">
                <span className="font-semibold block text-sky-100">Listening for authenticated session...</span>
                <span className="text-slate-400 text-[11px]">
                  Log in on the opened Chromium browser window. Once logged in, your connection will activate automatically.
                </span>
              </div>
            </div>

            {/* Step-by-Step Instructions */}
            <div className="p-4 rounded-2xl bg-slate-900/40 border border-white/5 space-y-2.5 text-xs text-slate-300">
              <div className="font-bold text-[11px] uppercase tracking-wider text-slate-400">Login Steps:</div>
              <ol className="space-y-2 list-decimal list-inside text-slate-400">
                <li>Switch to the opened <strong className="text-slate-200">Chromium browser window</strong>.</li>
                <li>Enter your registered <strong className="text-slate-200">Email and Password</strong> on the official Meesho login page.</li>
                <li>Complete any OTP / Two-Factor verification directly on Meesho.</li>
                <li>Reach your Supplier Panel Dashboard. Rehanza-Hub will automatically secure the session.</li>
              </ol>
            </div>

            {/* Re-open Link Button */}
            {activeLoginUrl && (
              <Button
                type="button"
                variant="outline"
                onClick={() => window.open(activeLoginUrl, '_blank', 'noopener,noreferrer')}
                className="w-full rounded-xl border-white/10 bg-slate-900/60 hover:bg-slate-800 text-xs font-semibold text-slate-200 h-10"
              >
                <ExternalLink className="h-3.5 w-3.5 mr-2 text-primary" />
                Re-open Meesho Login Page
              </Button>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-white/5">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancelLogin}
              disabled={actionLoading}
              className="rounded-xl border-white/10 text-xs font-semibold text-slate-300"
            >
              Cancel Login
            </Button>
            <Button
              type="button"
              onClick={async () => {
                const cur = await fetchStatus();
                if (cur?.status === 'connected') {
                  setIsLoginModalOpen(false);
                  toast({
                    title: 'Connection Verified',
                    description: 'Your Meesho session is active.',
                  });
                } else {
                  toast({
                    title: 'Login Still In Progress',
                    description: 'Please finish logging in on the Meesho tab.',
                  });
                }
              }}
              disabled={actionLoading}
              className="rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-xs px-5 shadow-lg shadow-primary/20"
            >
              <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
              Check Status
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
