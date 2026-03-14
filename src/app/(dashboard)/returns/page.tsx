"use client"

import React, { useEffect, useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/apiFetch';
import { ReturnsFilters } from '@/components/returns/returns-filters';
import { ReturnsTable } from '@/components/returns/returns-table';
import { AddReturnModal } from './components/add-return-modal';
import { ImportReturnsModal } from '@/components/returns/import-returns-modal';
import { ReturnsStatsCards } from '@/components/returns/returns-stats-cards';
import { ReturnsAnalysisTab } from '@/components/returns/returns-analysis-tab';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from '@/components/ui/tabs';
import { Undo2, Upload, ChevronDown, Activity, ListTodo } from 'lucide-react';

export default function ReturnsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);
  
  const [returns, setReturns] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });
  
  // Filters State
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [platform, setPlatform] = useState('all');
  const [status, setStatus] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<{ from?: string; to?: string }>({});

  // Modals State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importPlatform, setImportPlatform] = useState<'meesho' | 'flipkart' | 'amazon' | null>(null);
  const [itemToEdit, setItemToEdit] = useState<any | null>(null);
  const [itemToDelete, setItemToDelete] = useState<any | null>(null);

  useEffect(() => {
    const id = sessionStorage.getItem("active_account");
    if (id) setActiveAccountId(id);

    const handleAccountInit = () => {
      const freshId = sessionStorage.getItem("active_account");
      if (freshId) setActiveAccountId(freshId);
    };

    window.addEventListener('active-account-changed', handleAccountInit);
    return () => window.removeEventListener('active-account-changed', handleAccountInit);
  }, []);

  const fetchStats = useCallback(async () => {
    if (!activeAccountId) return;
    try {
      const res = await apiFetch('/api/returns/stats');
      if (res.ok) {
        const json = await res.json();
        setStats(json.data);
      }
    } catch (e) {
      console.error("Failed to load return stats", e);
    }
  }, [activeAccountId]);

  const fetchReturns = useCallback(async () => {
    if (!activeAccountId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', '25');
      if (search) params.append('search', search);
      if (platform !== 'all') params.append('platform', platform);
      if (status.length > 0) params.append('status', status.join(','));
      if (dateRange.from) params.append('from', dateRange.from);
      if (dateRange.to) params.append('to', dateRange.to);

      const res = await apiFetch(`/api/returns?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setReturns(data.data || []);
        setPagination({
          total: data.pagination?.total || 0,
          totalPages: data.pagination?.totalPages || 1
        });
      } else {
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to load returns' });
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setLoading(false);
    }
  }, [page, search, platform, status, dateRange, activeAccountId, toast]);

  useEffect(() => {
    if (activeAccountId) {
      fetchStats();
      fetchReturns();
    }
  }, [fetchReturns, fetchStats, activeAccountId]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [search, platform, status, dateRange]);

  const handleDelete = async () => {
    if (!itemToDelete) return;
    try {
      const res = await apiFetch(`/api/returns?id=${itemToDelete.id}`, { method: 'DELETE' });
      if (res.ok) {
        toast({ title: 'Success', description: 'Return record archived successfully.' });
        fetchReturns();
        fetchStats();
      } else {
        const err = await res.json();
        throw new Error(err.message || 'Failed to delete');
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setItemToDelete(null);
    }
  };

  const handleImportSuccess = () => {
    setIsImportModalOpen(false);
    fetchReturns();
    fetchStats();
  };

  const handleOpenImport = (p: 'meesho' | 'flipkart' | 'amazon') => {
    setImportPlatform(p);
    setIsImportModalOpen(true);
  };

  return (
    <div className="p-6 md:p-8 space-y-8 bg-gray-50/50 dark:bg-black/50 min-h-full font-body">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-4xl font-black tracking-tighter font-headline flex items-center gap-3">
            <div className="p-2.5 bg-primary rounded-2xl shadow-lg shadow-primary/20">
              <Undo2 className="h-7 w-7 text-white" />
            </div>
            Returns
          </h1>
          <p className="text-muted-foreground font-medium mt-1">Manage reverse logistics and marketplace return analysis.</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="outline"
                className="rounded-xl h-12 px-6 font-bold bg-white/50 backdrop-blur-sm border-border/50"
              >
                <Upload className="mr-2 h-4 w-4" /> Import Returns <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-xl w-56">
              <DropdownMenuItem onClick={() => handleOpenImport('meesho')} className="cursor-pointer font-medium">
                Import Meesho Returns
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleOpenImport('flipkart')} className="cursor-pointer font-medium">
                Import Flipkart Returns
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleOpenImport('amazon')} className="cursor-pointer font-medium">
                Import Amazon Returns
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button 
            onClick={() => setIsAddModalOpen(true)}
            className="rounded-xl h-12 px-6 font-bold shadow-lg shadow-primary/20"
          >
            Add New Return
          </Button>
        </div>
      </div>

      <Tabs defaultValue="logs" className="w-full">
        <TabsList className="bg-muted/50 p-1 rounded-2xl mb-8">
          <TabsTrigger value="logs" className="rounded-xl px-8 font-black uppercase tracking-widest text-[10px] data-[state=active]:shadow-lg">
            <ListTodo className="mr-2 h-3.5 w-3.5" /> Return Logs
          </TabsTrigger>
          <TabsTrigger value="analysis" className="rounded-xl px-8 font-black uppercase tracking-widest text-[10px] data-[state=active]:shadow-lg">
            <Activity className="mr-2 h-3.5 w-3.5" /> Intelligence
          </TabsTrigger>
        </TabsList>

        <TabsContent value="logs" className="space-y-8">
          <ReturnsStatsCards stats={stats} loading={loading} />

          <div className="space-y-6">
            <ReturnsFilters 
              search={search}
              onSearchChange={setSearch}
              platform={platform}
              onPlatformChange={setPlatform}
              status={status}
              onStatusChange={setStatus}
              onDateRangeChange={setDateRange}
            />

            <ReturnsTable 
              returns={returns}
              loading={loading}
              onEdit={(item) => { setItemToEdit(item); setIsAddModalOpen(true); }}
              onDelete={setItemToDelete}
              currentPage={page}
              totalPages={pagination.totalPages}
              totalRecords={pagination.total}
              onPageChange={setPage}
            />
          </div>
        </TabsContent>

        <TabsContent value="analysis">
          <ReturnsAnalysisTab />
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <AddReturnModal
        isOpen={isAddModalOpen || !!itemToEdit}
        onClose={() => { setIsAddModalOpen(false); setItemToEdit(null); }}
        onSuccess={() => { fetchReturns(); fetchStats(); }}
        returnItem={itemToEdit}
      />

      <Dialog open={isImportModalOpen} onOpenChange={(open) => {
        setIsImportModalOpen(open);
        if (!open) setImportPlatform(null);
      }}>
        <DialogContent className="sm:max-w-xl rounded-[2rem]">
          <DialogHeader>
            <DialogTitle className="font-headline text-2xl font-bold">
              Import {importPlatform ? importPlatform.charAt(0).toUpperCase() + importPlatform.slice(1) : ''} Returns
            </DialogTitle>
          </DialogHeader>
          {importPlatform && (
            <ImportReturnsModal 
              platform={importPlatform}
              onSuccess={handleImportSuccess} 
              onClose={() => setIsImportModalOpen(false)} 
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!itemToDelete} onOpenChange={() => setItemToDelete(null)}>
        <AlertDialogContent className="rounded-[2rem]">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-headline text-xl">Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark the return for <strong>{itemToDelete?.variant_sku}</strong> as archived. This action can be reversed by administrators.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90 rounded-xl">
              Archive Return
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}