'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { formatINR } from '@/lib/format';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Package,
  Boxes,
  Layers,
  Sparkles,
  Search,
  Plus,
  RefreshCw,
  Link2,
  Unlink,
  Check,
  X,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Tag,
  ShieldCheck,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { apiFetch } from '@/lib/apiFetch';
import { resolveActiveAccount } from '@/lib/account';
import { cn } from '@/lib/utils';
import { CreateMainProductModal } from './components/create-main-product-modal';
import { AssignSkuModal } from './components/assign-sku-modal';
import {
  PlatformSkuRecord,
  MainProductRecord,
  AiGroupingSuggestion,
  ProductsDashboardSummary,
} from '@/lib/products/sku-registry-service';

export default function ProductsPage() {
  const { toast } = useToast();
  const [isMounted, setIsMounted] = useState(false);
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);
  const [activeAccountName, setActiveAccountName] = useState<string>('Rehanza');

  // Core Data State
  const [summary, setSummary] = useState<ProductsDashboardSummary>({
    totalMainProducts: 0,
    totalPlatformSkus: 0,
    unassignedSkus: 0,
    aiSuggestionsPending: 0,
    assignedSkus: 0,
  });
  const [mainProducts, setMainProducts] = useState<MainProductRecord[]>([]);
  const [platformSkus, setPlatformSkus] = useState<PlatformSkuRecord[]>([]);
  const [pendingSuggestions, setPendingSuggestions] = useState<AiGroupingSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [generatingAi, setGeneratingAi] = useState(false);
  const [resolvingSuggestionId, setResolvingSuggestionId] = useState<string | null>(null);

  // View & Filter State
  const [currentTab, setCurrentTab] = useState<'main-products' | 'platform-skus' | 'unassigned'>('main-products');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [expandedMainProductIds, setExpandedMainProductIds] = useState<Set<string>>(new Set());

  // Modals State
  const [isCreateMainModalOpen, setIsCreateMainModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [skuToAssign, setSkuToAssign] = useState<PlatformSkuRecord | null>(null);

  // Account Resolution & Reactive Listeners
  useEffect(() => {
    setIsMounted(true);

    async function initAccount() {
      const acc = await resolveActiveAccount();
      if (acc?.id) {
        setActiveAccountId(acc.id);
        setActiveAccountName(acc.name || 'Rehanza');
      }
    }
    initAccount();

    const handleAccountChange = (e: any) => {
      const freshId = e?.detail?.id || sessionStorage.getItem('active_account');
      const freshName = e?.detail?.name || sessionStorage.getItem('active_account_name') || 'Rehanza';
      if (freshId) {
        setActiveAccountId(freshId);
        setActiveAccountName(freshName);
      }
    };

    window.addEventListener('active-account-changed', handleAccountChange);
    return () => window.removeEventListener('active-account-changed', handleAccountChange);
  }, []);

  // Fetch Full Products Registry Dataset
  const fetchProductsData = useCallback(
    async (forceSync = false) => {
      if (!activeAccountId) return;
      setLoading(true);
      try {
        const url = `/api/products?sync=${forceSync ? 'true' : 'false'}`;
        const res = await apiFetch(url);
        const json = await res.json();

        if (res.ok && json.success) {
          setSummary(json.summary);
          setMainProducts(json.mainProducts || []);
          setPlatformSkus(json.platformSkus || []);
          setPendingSuggestions(json.pendingSuggestions || []);
        } else {
          toast({
            title: 'Error',
            description: json.message || 'Failed to load products data.',
            variant: 'destructive',
          });
        }
      } catch (err: any) {
        console.error('Fetch products error:', err);
        toast({
          title: 'Network Error',
          description: 'Failed to connect to product registry.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    },
    [activeAccountId, toast]
  );

  useEffect(() => {
    if (activeAccountId) {
      fetchProductsData();
    }
  }, [activeAccountId, fetchProductsData]);

  // Re-Sync SKUs from Reconciliation
  const handleReSync = async () => {
    if (!activeAccountId) return;
    setSyncing(true);
    try {
      const res = await apiFetch('/api/products/sync', { method: 'POST' });
      const json = await res.json();
      if (res.ok && json.success) {
        toast({
          title: 'Reconciliation Sync Complete',
          description: json.message,
        });
        await fetchProductsData(false);
      } else {
        throw new Error(json.message || 'Sync failed');
      }
    } catch (err: any) {
      toast({
        title: 'Sync Failed',
        description: err.message || 'Could not sync reconciliation SKUs.',
        variant: 'destructive',
      });
    } finally {
      setSyncing(false);
    }
  };

  // Trigger AI Auto-Grouping Analysis
  const handleGenerateAiSuggestions = async () => {
    if (!activeAccountId) return;
    setGeneratingAi(true);
    try {
      const res = await apiFetch('/api/products/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate' }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        toast({
          title: 'AI Grouping Analysis Complete',
          description: json.message || `Generated ${json.generated || 0} grouping proposals.`,
        });
        await fetchProductsData(false);
      } else {
        throw new Error(json.message || 'AI grouping failed');
      }
    } catch (err: any) {
      toast({
        title: 'AI Analysis Error',
        description: err.message || 'Could not generate grouping suggestions.',
        variant: 'destructive',
      });
    } finally {
      setGeneratingAi(false);
    }
  };

  // Resolve AI Suggestion (Approve / Reject)
  const handleResolveSuggestion = async (suggestionId: string, decision: 'approve' | 'reject') => {
    if (!activeAccountId) return;
    setResolvingSuggestionId(suggestionId);
    try {
      const res = await apiFetch('/api/products/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'resolve',
          suggestionId,
          decision,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        toast({
          title: decision === 'approve' ? 'Suggestion Approved' : 'Suggestion Rejected',
          description: decision === 'approve'
            ? 'SKU successfully grouped into Main Product.'
            : 'Suggestion discarded. SKU remains unassigned.',
        });
        await fetchProductsData(false);
      } else {
        throw new Error(json.message || 'Failed to resolve suggestion');
      }
    } catch (err: any) {
      toast({
        title: 'Action Failed',
        description: err.message || 'Could not process proposal.',
        variant: 'destructive',
      });
    } finally {
      setResolvingSuggestionId(null);
    }
  };

  // Quick Unlink from Main Product
  const handleQuickUnlink = async (skuId: string, skuCode: string) => {
    try {
      const res = await apiFetch('/api/products/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skuId, mainProductId: null }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        toast({
          title: 'SKU Unlinked',
          description: `Platform SKU "${skuCode}" is now unassigned.`,
        });
        await fetchProductsData(false);
      } else {
        throw new Error(json.message || 'Failed to unlink SKU');
      }
    } catch (err: any) {
      toast({
        title: 'Unlink Error',
        description: err.message || 'Could not unlink SKU.',
        variant: 'destructive',
      });
    }
  };

  // Toggle Accordion Expand for Main Product
  const toggleExpandMainProduct = (id: string) => {
    setExpandedMainProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Filtered Main Products
  const filteredMainProducts = useMemo(() => {
    let list = mainProducts;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.mainSku.toLowerCase().includes(q) ||
          (p.category && p.category.toLowerCase().includes(q)) ||
          p.skus.some((s) => s.sku.toLowerCase().includes(q) || (s.title && s.title.toLowerCase().includes(q)))
      );
    }
    if (selectedPlatform !== 'all') {
      list = list.filter((p) => p.platforms.includes(selectedPlatform));
    }
    return list;
  }, [mainProducts, searchQuery, selectedPlatform]);

  // Filtered Platform SKUs
  const filteredPlatformSkus = useMemo(() => {
    let list = platformSkus;
    if (currentTab === 'unassigned') {
      list = list.filter((s) => !s.mainProductId);
    } else if (selectedStatus !== 'all') {
      if (selectedStatus === 'unassigned') list = list.filter((s) => !s.mainProductId);
      else if (selectedStatus === 'assigned') list = list.filter((s) => !!s.mainProductId);
      else list = list.filter((s) => s.assignmentStatus === selectedStatus);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (s) =>
          s.sku.toLowerCase().includes(q) ||
          (s.title && s.title.toLowerCase().includes(q)) ||
          (s.mainProductName && s.mainProductName.toLowerCase().includes(q)) ||
          (s.mainProductSku && s.mainProductSku.toLowerCase().includes(q))
      );
    }

    if (selectedPlatform !== 'all') {
      list = list.filter((s) => s.platform.toLowerCase() === selectedPlatform.toLowerCase());
    }

    return list;
  }, [platformSkus, currentTab, selectedStatus, searchQuery, selectedPlatform]);

  if (!isMounted) return null;

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header & Primary Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/40 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground via-foreground/90 to-foreground/70 bg-clip-text text-transparent">
              Products &amp; SKU Registry
            </h1>
            <Badge variant="outline" className="px-2.5 py-0.5 text-xs font-semibold border-primary/30 text-primary bg-primary/10">
              {activeAccountName}
            </Badge>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReSync}
            disabled={syncing || loading}
            className="gap-2 border-border/60 bg-card/60 hover:bg-muted"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', syncing && 'animate-spin')} />
            {syncing ? 'Syncing...' : 'Re-Sync Reconciliation SKUs'}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleGenerateAiSuggestions}
            disabled={generatingAi || loading}
            className="gap-2 border-purple-500/30 text-purple-600 dark:text-purple-400 bg-purple-500/10 hover:bg-purple-500/20"
          >
            {generatingAi ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-purple-500" />
            )}
            {generatingAi ? 'Analyzing...' : 'Run AI Grouping'}
          </Button>

          <Button
            size="sm"
            onClick={() => setIsCreateMainModalOpen(true)}
            className="gap-2 bg-gradient-to-r from-primary to-primary/90 text-primary-foreground font-medium shadow-md shadow-primary/20"
          >
            <Plus className="w-4 h-4" />
            New Main Product
          </Button>
        </div>
      </div>

      {/* 2. Summary KPI Cards (Liquid Glass) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Main Products */}
        <Card className="backdrop-blur-xl bg-card/60 border-border/50 shadow-sm relative overflow-hidden group hover:border-primary/40 transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-all pointer-events-none" />
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Main Products
            </CardTitle>
            <div className="p-2 rounded-lg bg-primary/10 text-primary border border-primary/20">
              <Package className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight">{summary.totalMainProducts}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Parent physical products catalog
            </p>
          </CardContent>
        </Card>

        {/* Total Platform SKUs */}
        <Card className="backdrop-blur-xl bg-card/60 border-border/50 shadow-sm relative overflow-hidden group hover:border-border/80 transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl group-hover:bg-blue-500/10 transition-all pointer-events-none" />
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Discovered Platform SKUs
            </CardTitle>
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              <Boxes className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight">{summary.totalPlatformSkus}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Discovered from Reconciliation
            </p>
          </CardContent>
        </Card>

        {/* Unassigned SKUs */}
        <Card
          onClick={() => setCurrentTab('unassigned')}
          className={cn(
            'backdrop-blur-xl bg-card/60 border-border/50 shadow-sm relative overflow-hidden group transition-all cursor-pointer',
            summary.unassignedSkus > 0
              ? 'border-amber-500/40 hover:border-amber-500/60 bg-amber-500/[0.02]'
              : 'hover:border-border/80'
          )}
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl group-hover:bg-amber-500/10 transition-all pointer-events-none" />
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Unassigned SKUs
            </CardTitle>
            <div
              className={cn(
                'p-2 rounded-lg border',
                summary.unassignedSkus > 0
                  ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                  : 'bg-muted text-muted-foreground border-border/40'
              )}
            >
              <Layers className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight">{summary.unassignedSkus}</span>
              {summary.unassignedSkus > 0 && (
                <Badge variant="outline" className="text-[10px] text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/10 font-medium">
                  Needs Grouping
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {summary.assignedSkus} SKUs grouped ({summary.totalPlatformSkus > 0 ? Math.round((summary.assignedSkus / summary.totalPlatformSkus) * 100) : 0}% coverage)
            </p>
          </CardContent>
        </Card>

        {/* AI Suggestions Pending */}
        <Card className="backdrop-blur-xl bg-card/60 border-border/50 shadow-sm relative overflow-hidden group hover:border-purple-500/40 transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl group-hover:bg-purple-500/10 transition-all pointer-events-none" />
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              AI Grouping Proposals
            </CardTitle>
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
              <Sparkles className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight">{summary.aiSuggestionsPending}</span>
              {summary.aiSuggestionsPending > 0 && (
                <Badge variant="outline" className="text-[10px] text-purple-600 dark:text-purple-400 border-purple-500/30 bg-purple-500/10 font-medium">
                  Human Approval Required
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {summary.aiSuggestionsPending > 0 ? 'Pending your review below' : 'All proposals processed'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 3. AI Grouping Suggestions Banner / Section */}
      {pendingSuggestions.length > 0 && (
        <Card className="backdrop-blur-xl bg-gradient-to-b from-purple-500/[0.05] to-card/70 border-purple-500/30 shadow-lg relative overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30">
                  <Sparkles className="w-5 h-5" />
                </div>
                <CardTitle className="text-lg font-bold tracking-tight flex items-center gap-2">
                  Grouping Proposals
                  <Badge variant="outline" className="text-purple-600 dark:text-purple-400 border-purple-500/30 bg-purple-500/10">
                    {pendingSuggestions.length} Pending
                  </Badge>
                </CardTitle>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-3 pt-1">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
              {pendingSuggestions.map((suggestion) => {
                const isResolving = resolvingSuggestionId === suggestion.id;
                // Normalize confidence to 0-100 percentage
                const confPercent = Math.min(
                  100,
                  Math.round(suggestion.confidence > 1 ? suggestion.confidence : suggestion.confidence * 100)
                );

                return (
                  <div
                    key={suggestion.id}
                    className="p-3.5 rounded-xl bg-card/80 border border-border/60 hover:border-purple-500/40 shadow-sm space-y-3 transition-all"
                  >
                    {/* Header: Discovered SKU -> Proposed Main Product */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono text-xs font-bold bg-background/80">
                            {suggestion.platformSku}
                          </Badge>
                          <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-xs font-semibold text-primary">
                            {suggestion.suggestedProductName}
                          </span>
                        </div>
                        {suggestion.skuTitle && (
                          <p className="text-[11px] text-muted-foreground line-clamp-1">
                            {suggestion.skuTitle}
                          </p>
                        )}
                      </div>

                      <Badge
                        variant="outline"
                        className={cn(
                          'text-[10px] font-semibold border flex-shrink-0',
                          confPercent >= 90
                            ? 'text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
                            : 'text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/10'
                        )}
                      >
                        {confPercent}% Match
                      </Badge>
                    </div>

                    {/* Match Signals & Reasoning */}
                    <div className="p-2.5 rounded-lg bg-muted/40 border border-border/40 space-y-1.5 text-[11px]">
                      <p className="text-foreground/90 font-medium">
                        {suggestion.reasoning}
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        {suggestion.matchSignals?.sharedTokens && suggestion.matchSignals.sharedTokens.length > 0 && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-background/80 border border-border/50 text-[10px] font-mono text-muted-foreground">
                            Tokens: {suggestion.matchSignals.sharedTokens.slice(0, 4).join(', ')}
                          </span>
                        )}
                        {suggestion.matchSignals?.costMatch && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                            Cost Match: {formatINR(suggestion.purchaseCost)}
                          </span>
                        )}
                        {suggestion.suggestedMainSku && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-background/80 border border-border/50 text-[10px] font-mono text-muted-foreground">
                            Main SKU: {suggestion.suggestedMainSku}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Human Decision Buttons */}
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={isResolving}
                        onClick={() => handleResolveSuggestion(suggestion.id, 'reject')}
                        className="h-8 px-2.5 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      >
                        <X className="w-3.5 h-3.5 mr-1" />
                        Reject
                      </Button>

                      <Button
                        size="sm"
                        disabled={isResolving}
                        onClick={() => handleResolveSuggestion(suggestion.id, 'approve')}
                        className="h-8 px-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm gap-1.5"
                      >
                        {isResolving ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Check className="w-3.5 h-3.5" />
                        )}
                        Approve Group
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 4. Navigation View Tabs & Search / Filter Toolbar */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          {/* View Tabs */}
          <div className="flex items-center p-1 bg-muted/60 border border-border/50 rounded-xl max-w-fit">
            <button
              type="button"
              onClick={() => setCurrentTab('main-products')}
              className={cn(
                'flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all',
                currentTab === 'main-products'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Package className="w-3.5 h-3.5" />
              Main Products
              <Badge variant="secondary" className="px-1.5 py-0 text-[10px] ml-0.5">
                {mainProducts.length}
              </Badge>
            </button>

            <button
              type="button"
              onClick={() => setCurrentTab('platform-skus')}
              className={cn(
                'flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all',
                currentTab === 'platform-skus'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Boxes className="w-3.5 h-3.5" />
              Platform SKUs
              <Badge variant="secondary" className="px-1.5 py-0 text-[10px] ml-0.5">
                {platformSkus.length}
              </Badge>
            </button>

            <button
              type="button"
              onClick={() => setCurrentTab('unassigned')}
              className={cn(
                'flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all',
                currentTab === 'unassigned'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Layers className="w-3.5 h-3.5" />
              Unassigned
              {summary.unassignedSkus > 0 && (
                <Badge
                  variant="outline"
                  className="px-1.5 py-0 text-[10px] ml-0.5 text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/10 font-bold"
                >
                  {summary.unassignedSkus}
                </Badge>
              )}
            </button>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative min-w-[200px] sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search SKU or title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-xs bg-background/50 border-input/60 focus-visible:ring-primary/30"
              />
            </div>

            {currentTab === 'platform-skus' && (
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="h-8 text-xs min-w-[130px] bg-background/50 border-input/60">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  <SelectItem value="assigned">Assigned</SelectItem>
                  <SelectItem value="ai_pending">AI Pending</SelectItem>
                  <SelectItem value="ai_approved">AI Approved</SelectItem>
                  <SelectItem value="manually_assigned">Manual</SelectItem>
                </SelectContent>
              </Select>
            )}

            <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
              <SelectTrigger className="h-8 text-xs min-w-[120px] bg-background/50 border-input/60">
                <SelectValue placeholder="Platform" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Platforms</SelectItem>
                <SelectItem value="Meesho">Meesho</SelectItem>
                <SelectItem value="Flipkart">Flipkart</SelectItem>
                <SelectItem value="Amazon">Amazon</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* 5. View Content */}
        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="w-7 h-7 animate-spin text-primary" />
            <p className="text-xs font-medium">Loading SKU Registry...</p>
          </div>
        ) : currentTab === 'main-products' ? (
          /* TAB 1: MAIN PRODUCTS VIEW */
          <div className="space-y-3">
            {filteredMainProducts.length === 0 ? (
              <Card className="backdrop-blur-xl bg-card/60 border-border/50 p-12 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto border border-primary/20">
                  <Package className="w-6 h-6" />
                </div>
                <div className="space-y-1 max-w-md mx-auto">
                  <h3 className="text-base font-semibold">No Main Products Found</h3>
                  <p className="text-xs text-muted-foreground">
                    {searchQuery
                      ? 'No products match your search filter.'
                      : 'Main Products group multiple marketplace SKUs that represent the same physical item. Create your first Main Product or run AI Grouping.'}
                  </p>
                </div>
                <div className="flex items-center justify-center gap-2 pt-2">
                  <Button
                    size="sm"
                    onClick={() => setIsCreateMainModalOpen(true)}
                    className="gap-2 bg-gradient-to-r from-primary to-primary/90 text-primary-foreground font-medium"
                  >
                    <Plus className="w-4 h-4" />
                    Create Main Product
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGenerateAiSuggestions}
                    disabled={generatingAi}
                    className="gap-2"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                    Run AI Auto-Grouping
                  </Button>
                </div>
              </Card>
            ) : (
              filteredMainProducts.map((product) => {
                const isExpanded = expandedMainProductIds.has(product.id);

                return (
                  <Card
                    key={product.id}
                    className="backdrop-blur-xl bg-card/70 border-border/60 hover:border-border transition-all overflow-hidden shadow-sm"
                  >
                    {/* Accordion Card Header */}
                    <div
                      onClick={() => toggleExpandMainProduct(product.id)}
                      className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20 mt-0.5">
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </div>
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-bold tracking-tight text-foreground">
                              {product.name}
                            </h3>
                            <Badge variant="outline" className="font-mono text-[11px] font-bold bg-background/80">
                              {product.mainSku}
                            </Badge>
                            {product.category && (
                              <Badge variant="secondary" className="text-[10px]">
                                {product.category}
                              </Badge>
                            )}
                            {product.platforms.map((plat) => (
                              <Badge key={plat} variant="outline" className="text-[10px] text-muted-foreground border-border/50">
                                {plat}
                              </Badge>
                            ))}
                          </div>
                          {product.description && (
                            <p className="text-xs text-muted-foreground line-clamp-1">
                              {product.description}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Aggregated KPI metrics */}
                      <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-xs self-end md:self-auto pl-9 md:pl-0">
                        <div>
                          <span className="text-muted-foreground block text-[10px] uppercase tracking-wider font-semibold">
                            Linked SKUs
                          </span>
                          <span className="font-bold text-foreground">{product.linkedSkusCount}</span>
                        </div>

                        <div>
                          <span className="text-muted-foreground block text-[10px] uppercase tracking-wider font-semibold">
                            Total Units
                          </span>
                          <span className="font-bold text-foreground">{product.totalUnits}</span>
                        </div>

                        <div>
                          <span className="text-muted-foreground block text-[10px] uppercase tracking-wider font-semibold">
                            Delivered
                          </span>
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                            {product.deliveredUnits}
                          </span>
                        </div>

                        <div>
                          <span className="text-muted-foreground block text-[10px] uppercase tracking-wider font-semibold">
                            Avg Cost
                          </span>
                          <span className="font-mono font-bold text-foreground">
                            {formatINR(product.avgCostPrice)}
                          </span>
                        </div>

                        <div>
                          <span className="text-muted-foreground block text-[10px] uppercase tracking-wider font-semibold">
                            Avg Settlement
                          </span>
                          <span className="font-mono font-bold text-foreground">
                            {formatINR(product.avgSettlement)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Expanded Linked SKUs Table */}
                    {isExpanded && (
                      <div className="border-t border-border/50 bg-muted/15 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Linked Platform SKUs ({product.skus.length})
                          </span>
                        </div>

                        {product.skus.length === 0 ? (
                          <div className="py-6 text-center text-xs text-muted-foreground">
                            No platform SKUs linked to this product yet.
                          </div>
                        ) : (
                          <div className="rounded-lg border border-border/60 overflow-hidden bg-card/80">
                            <Table>
                              <TableHeader className="bg-muted/40 text-[11px]">
                                <TableRow>
                                  <TableHead className="font-semibold">Platform SKU</TableHead>
                                  <TableHead className="font-semibold">Title</TableHead>
                                  <TableHead className="font-semibold">Platform</TableHead>
                                  <TableHead className="font-semibold text-right">Purchase</TableHead>
                                  <TableHead className="font-semibold text-right">Packaging</TableHead>
                                  <TableHead className="font-semibold text-right">Settlement</TableHead>
                                  <TableHead className="font-semibold text-right">Orders</TableHead>
                                  <TableHead className="font-semibold">Assignment</TableHead>
                                  <TableHead className="text-right font-semibold">Actions</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody className="text-xs">
                                {product.skus.map((sku) => (
                                  <TableRow key={sku.id} className="hover:bg-muted/40">
                                    <TableCell className="font-mono font-bold text-[11px]">
                                      {sku.sku}
                                    </TableCell>
                                    <TableCell className="max-w-[220px] truncate text-muted-foreground">
                                      {sku.title || '--'}
                                    </TableCell>
                                    <TableCell>
                                      <Badge variant="secondary" className="text-[10px]">
                                        {sku.platform}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="text-right font-mono">
                                      {formatINR(sku.purchaseCost)}
                                    </TableCell>
                                    <TableCell className="text-right font-mono">
                                      {formatINR(sku.packagingCost)}
                                    </TableCell>
                                    <TableCell className="text-right font-mono">
                                      {formatINR(sku.settlementPrice)}
                                    </TableCell>
                                    <TableCell className="text-right font-medium">
                                      {sku.totalOrders}
                                    </TableCell>
                                    <TableCell>
                                      <Badge
                                        variant="outline"
                                        className={cn(
                                          'text-[10px] font-medium border',
                                          sku.assignmentStatus === 'ai_approved'
                                            ? 'text-purple-600 dark:text-purple-400 border-purple-500/30 bg-purple-500/10'
                                            : 'text-blue-600 dark:text-blue-400 border-blue-500/30 bg-blue-500/10'
                                        )}
                                      >
                                        {sku.assignmentStatus === 'ai_approved' ? 'AI Grouped' : 'Manual'}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <div className="flex items-center justify-end gap-1.5">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => {
                                            setSkuToAssign(sku);
                                            setIsAssignModalOpen(true);
                                          }}
                                          className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                                        >
                                          Move
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleQuickUnlink(sku.id, sku.sku)}
                                          className="h-7 px-2 text-[11px] text-destructive hover:bg-destructive/10"
                                        >
                                          <Unlink className="w-3 h-3 mr-1" />
                                          Unlink
                                        </Button>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </div>
                    )}
                  </Card>
                );
              })
            )}
          </div>
        ) : (
          /* TAB 2 & 3: PLATFORM SKUS / UNASSIGNED SKUS VIEW */
          <Card className="backdrop-blur-xl bg-card/70 border-border/60 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/40 text-[11px]">
                  <TableRow>
                    <TableHead className="font-semibold">Platform SKU</TableHead>
                    <TableHead className="font-semibold">Title / Listing</TableHead>
                    <TableHead className="font-semibold">Platform</TableHead>
                    <TableHead className="font-semibold text-right">Purchase Cost</TableHead>
                    <TableHead className="font-semibold text-right">Packaging</TableHead>
                    <TableHead className="font-semibold text-right">Avg Settlement</TableHead>
                    <TableHead className="font-semibold text-right">Orders</TableHead>
                    <TableHead className="font-semibold">Parent Main Product</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="text-right font-semibold">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="text-xs">
                  {filteredPlatformSkus.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="h-32 text-center text-muted-foreground">
                        No platform SKUs found for the current filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredPlatformSkus.map((sku) => {
                      return (
                        <TableRow key={sku.id} className="hover:bg-muted/30">
                          <TableCell className="font-mono font-bold text-xs">
                            {sku.sku}
                          </TableCell>

                          <TableCell className="max-w-[240px] truncate text-muted-foreground">
                            {sku.title || '--'}
                          </TableCell>

                          <TableCell>
                            <Badge variant="secondary" className="text-[10px] font-medium">
                              {sku.platform}
                            </Badge>
                          </TableCell>

                          <TableCell className="text-right font-mono font-medium">
                            {formatINR(sku.purchaseCost)}
                          </TableCell>

                          <TableCell className="text-right font-mono font-medium">
                            {formatINR(sku.packagingCost)}
                          </TableCell>

                          <TableCell className="text-right font-mono font-medium">
                            {formatINR(sku.settlementPrice)}
                          </TableCell>

                          <TableCell className="text-right font-medium">
                            <div>
                              <span>{sku.totalOrders}</span>
                              {sku.deliveredOrders > 0 && (
                                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block font-normal">
                                  {sku.deliveredOrders} del.
                                </span>
                              )}
                            </div>
                          </TableCell>

                          <TableCell>
                            {sku.mainProductId ? (
                              <div className="space-y-0.5">
                                <span className="font-semibold text-primary block truncate max-w-[180px]">
                                  {sku.mainProductName}
                                </span>
                                <span className="text-[10px] font-mono text-muted-foreground">
                                  {sku.mainProductSku}
                                </span>
                              </div>
                            ) : (
                              <Badge
                                variant="outline"
                                className="text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/10 text-[10px] font-medium"
                              >
                                Unassigned
                              </Badge>
                            )}
                          </TableCell>

                          <TableCell>
                            <Badge
                              variant="outline"
                              className={cn(
                                'text-[10px] font-semibold border',
                                sku.assignmentStatus === 'manually_assigned' &&
                                  'text-blue-600 dark:text-blue-400 border-blue-500/30 bg-blue-500/10',
                                sku.assignmentStatus === 'ai_approved' &&
                                  'text-purple-600 dark:text-purple-400 border-purple-500/30 bg-purple-500/10',
                                sku.assignmentStatus === 'ai_pending' &&
                                  'text-indigo-600 dark:text-indigo-400 border-indigo-500/30 bg-indigo-500/10',
                                sku.assignmentStatus === 'unassigned' &&
                                  'text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/10'
                              )}
                            >
                              {sku.assignmentStatus === 'manually_assigned' && 'Manual'}
                              {sku.assignmentStatus === 'ai_approved' && 'AI Approved'}
                              {sku.assignmentStatus === 'ai_pending' && 'AI Pending'}
                              {sku.assignmentStatus === 'unassigned' && 'Unassigned'}
                            </Badge>
                          </TableCell>

                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSkuToAssign(sku);
                                setIsAssignModalOpen(true);
                              }}
                              className={cn(
                                'h-7 px-2.5 text-xs gap-1.5 font-medium',
                                !sku.mainProductId
                                  ? 'border-primary/40 text-primary hover:bg-primary/10'
                                  : 'border-border/60 hover:bg-muted'
                              )}
                            >
                              <Link2 className="w-3 h-3" />
                              {sku.mainProductId ? 'Move' : 'Assign'}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        )}
      </div>

      {/* Modals */}
      <CreateMainProductModal
        isOpen={isCreateMainModalOpen}
        onClose={() => setIsCreateMainModalOpen(false)}
        onSuccess={() => fetchProductsData(false)}
      />

      <AssignSkuModal
        isOpen={isAssignModalOpen}
        onClose={() => {
          setIsAssignModalOpen(false);
          setSkuToAssign(null);
        }}
        sku={skuToAssign}
        mainProducts={mainProducts}
        onSuccess={() => fetchProductsData(false)}
        onOpenCreateMain={() => setIsCreateMainModalOpen(true)}
      />
    </div>
  );
}
