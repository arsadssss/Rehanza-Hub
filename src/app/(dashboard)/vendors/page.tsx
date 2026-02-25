
"use client"

import React, { useEffect, useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { formatINR } from '@/lib/format';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PlusCircle, FileText, Wallet, Archive } from 'lucide-react';

import { AddVendorModal } from './components/add-vendor-modal';
import { AddPurchaseModal } from './components/add-purchase-modal';
import { AddPaymentModal } from './components/add-payment-modal';
import { VendorLedger } from './components/vendor-ledger';

export type VendorPurchase = {
  id: string;
  vendor_id: string;
  product_name: string;
  quantity: number;
  cost_per_unit: number;
  purchase_date: string;
  description: string | null;
  is_deleted: boolean;
};

export type VendorPayment = {
  id: string;
  vendor_id: string;
  amount: number;
  payment_date: string;
  payment_mode: "Bank Transfer" | "Cash" | "UPI" | "Other";
  notes: string | null;
  is_deleted: boolean;
};

export type VendorBalance = {
  id: string;
  vendor_name: string;
  total_purchase: number;
  total_paid: number;
  balance_due: number;
};

export type LedgerItem = {
  id: string;
  date: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  type: 'purchase' | 'payment';
  original: VendorPurchase | VendorPayment;
};

type ItemToDelete = {
  id: string;
  type: 'purchase' | 'payment';
  description: string;
}

export default function VendorsPage() {
  const { toast } = useToast();

  const [summary, setSummary] = useState<VendorBalance[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isAddVendorOpen, setIsAddVendorOpen] = useState(false);
  
  const [isAddPurchaseOpen, setIsAddPurchaseOpen] = useState(false);
  const [purchaseToEdit, setPurchaseToEdit] = useState<VendorPurchase | null>(null);
  
  const [isAddPaymentOpen, setIsAddPaymentOpen] = useState(false);
  const [paymentToEdit, setPaymentToEdit] = useState<VendorPayment | null>(null);
  
  const [selectedVendor, setSelectedVendor] = useState<VendorBalance | null>(null);
  const [ledgerData, setLedgerData] = useState<LedgerItem[]>([]);
  const [loadingLedger, setLoadingLedger] = useState(false);

  const [ledgerTotalPurchase, setLedgerTotalPurchase] = useState(0);
  const [ledgerTotalPaid, setLedgerTotalPaid] = useState(0);
  const [ledgerFinalBalance, setLedgerFinalBalance] = useState(0);
  const [totalDueAllVendors, setTotalDueAllVendors] = useState(0);
  const [totalInventoryValue, setTotalInventoryValue] = useState(0);

  const [itemToDelete, setItemToDelete] = useState<ItemToDelete | null>(null);


  const fetchSummary = useCallback(async () => {
    setLoading(true);
    try {
        const res = await fetch('/api/vendors/summary');
        if (!res.ok) throw new Error('Failed to fetch vendor summary');
        const data = await res.json();
        setSummary(data.summary);
        setTotalDueAllVendors(data.totalDueAllVendors);
        setTotalInventoryValue(data.totalInventoryValue);
    } catch (error: any) {
        toast({
            variant: 'destructive',
            title: 'Error',
            description: error.message,
        });
        setSummary([]);
        setTotalDueAllVendors(0);
        setTotalInventoryValue(0);
    } finally {
        setLoading(false);
    }
  }, [toast]);

  const fetchLedger = useCallback(async (vendor: VendorBalance) => {
    if (!vendor?.id) return;
    setLoadingLedger(true);

    try {
      const res = await fetch(`/api/vendors/${vendor.id}/ledger`);
      if (!res.ok) throw new Error('Failed to fetch ledger data');
      const { purchases, payments } = await res.json();

      const totalPurchase = (purchases || []).reduce((sum: number, p: VendorPurchase) => sum + (Number(p.quantity || 0) * Number(p.cost_per_unit || 0)), 0);
      const totalPaid = (payments || []).reduce((sum: number, p: VendorPayment) => sum + Number(p.amount || 0), 0);

      setLedgerTotalPurchase(totalPurchase);
      setLedgerTotalPaid(totalPaid);
      setLedgerFinalBalance(totalPurchase - totalPaid);

      const purchaseEntries: LedgerItem[] = (purchases || []).map((p: VendorPurchase) => ({
        id: `purchase-${p.id}`, date: p.purchase_date, description: p.product_name || `Purchase`,
        debit: Number(p.quantity || 0) * Number(p.cost_per_unit || 0), credit: 0, balance: 0,
        type: 'purchase', original: p,
      }));
      const paymentEntries: LedgerItem[] = (payments || []).map((p: VendorPayment) => ({
        id: `payment-${p.id}`, date: p.payment_date, description: p.notes || `Payment via ${p.payment_mode}`,
        debit: 0, credit: Number(p.amount), balance: 0,
        type: 'payment', original: p,
      }));

      const combined = [...purchaseEntries, ...paymentEntries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      let runningBalance = 0;
      const ledgerWithBalance = combined.map((entry) => {
        runningBalance += entry.debit - entry.credit;
        return { ...entry, balance: runningBalance };
      });

      setLedgerData(ledgerWithBalance);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error fetching ledger", description: error.message });
    } finally {
        setLoadingLedger(false);
    }
  }, [toast]);


  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  const handleSuccess = () => {
    fetchSummary();
    if(selectedVendor) {
      // Create a temporary vendor object to re-fetch ledger, as summary state might not be updated yet
      const refreshedVendor = { ...selectedVendor };
      fetchLedger(refreshedVendor);
    }
  };

  const handleVendorClick = (vendor: VendorBalance) => { setSelectedVendor(vendor); fetchLedger(vendor); };
  
  const handleCloseLedger = () => {
    setSelectedVendor(null);
    setLedgerData([]);
    setLedgerTotalPurchase(0);
    setLedgerTotalPaid(0);
    setLedgerFinalBalance(0);
  }

  const handleEditItem = (item: VendorPurchase | VendorPayment, type: 'purchase' | 'payment') => {
    if (type === 'purchase') {
        setPurchaseToEdit(item as VendorPurchase);
        setIsAddPurchaseOpen(true);
    } else {
        setPaymentToEdit(item as VendorPayment);
        setIsAddPaymentOpen(true);
    }
  };

  const handleDeleteItem = (item: VendorPurchase | VendorPayment, type: 'purchase' | 'payment') => {
      const description = type === 'purchase' ? (item as VendorPurchase).product_name : `Payment of ${formatINR((item as VendorPayment).amount)}`;
      setItemToDelete({ id: item.id, type, description: description || "this item" });
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    const { id, type } = itemToDelete;
    const endpoint = type === 'purchase' ? '/api/vendor-purchases' : '/api/vendor-payments';

    try {
        const res = await fetch(`${endpoint}?id=${id}`, { method: 'DELETE' });
        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.message);
        }
        toast({ title: 'Success', description: `The ${type} has been deleted.` });
        handleSuccess();
    } catch(error: any) {
        toast({ variant: 'destructive', title: 'Error deleting item', description: error.message });
    }
    setItemToDelete(null);
  };


  const VendorCard = ({ item }: { item: VendorBalance }) => (
    <Card className="shadow-md hover:shadow-xl transition-shadow cursor-pointer" onClick={() => handleVendorClick(item)}>
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          <span>{item.vendor_name}</span>
          {item.balance_due > 0 && <Badge variant="destructive">Due</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Total Purchase</span>
          <span className="font-medium">{formatINR(item.total_purchase)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Total Paid</span>
          <span className="font-medium">{formatINR(item.total_paid)}</span>
        </div>
        <div className="flex justify-between font-bold text-base border-t pt-2 mt-2">
          <span>Balance Due</span>
          <span>{formatINR(item.balance_due)}</span>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="p-6 space-y-6 bg-gray-50/50 dark:bg-black/50 min-h-full">
      <AddVendorModal isOpen={isAddVendorOpen} onClose={() => setIsAddVendorOpen(false)} onVendorAdded={handleSuccess} />
      <AddPurchaseModal isOpen={isAddPurchaseOpen || !!purchaseToEdit} onClose={() => { setIsAddPurchaseOpen(false); setPurchaseToEdit(null);}} onSuccess={handleSuccess} purchase={purchaseToEdit} vendors={summary} />
      <AddPaymentModal isOpen={isAddPaymentOpen || !!paymentToEdit} onClose={() => { setIsAddPaymentOpen(false); setPaymentToEdit(null);}} onSuccess={handleSuccess} payment={paymentToEdit} vendors={summary} />
      <AlertDialog open={!!itemToDelete} onOpenChange={() => setItemToDelete(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
                This will mark the item "{itemToDelete?.description}" as deleted. You cannot undo this action.
            </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive hover:bg-destructive/90">
                Delete
            </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="text-white bg-gradient-to-r from-red-500 to-orange-600 shadow-xl rounded-2xl border-0">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Due Across All Vendors</CardTitle>
                <Wallet className="h-5 w-5 text-white/80" />
            </CardHeader>
            <CardContent>
                {loading ? <Skeleton className="h-10 w-48 bg-white/20" /> : (
                    <>
                        <div className="text-3xl font-bold font-headline">{formatINR(totalDueAllVendors)}</div>
                        <p className="text-xs text-white/80">
                           {totalDueAllVendors > 0 ? "Outstanding Payable" : "All Vendors Settled"}
                        </p>
                    </>
                )}
            </CardContent>
        </Card>
        <Card className="text-white bg-gradient-to-r from-emerald-500 to-green-600 shadow-xl rounded-2xl border-0">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Inventory Purchase Value</CardTitle>
                <Archive className="h-5 w-5 text-white/80" />
            </CardHeader>
            <CardContent>
                {loading ? <Skeleton className="h-10 w-48 bg-white/20" /> : (
                    <>
                        <div className="text-3xl font-bold font-headline">{formatINR(totalInventoryValue)}</div>
                        <p className="text-xs text-white/80">
                            {totalInventoryValue > 0 ? "Total Capital Invested in Stock" : "No purchases made yet"}
                        </p>
                    </>
                )}
            </CardContent>
        </Card>
      </div>


      <Card className="bg-background/80 backdrop-blur-sm">
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <CardTitle className="font-headline text-2xl">Vendor Management</CardTitle>
              <CardDescription>Oversee vendor purchases, payments, and balances.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setIsAddVendorOpen(true)}><PlusCircle className="mr-2 h-4 w-4" /> Add Vendor</Button>
              <Button variant="outline" onClick={() => setIsAddPurchaseOpen(true)}><PlusCircle className="mr-2 h-4 w-4" /> Add Purchase</Button>
              <Button onClick={() => setIsAddPaymentOpen(true)}><PlusCircle className="mr-2 h-4 w-4" /> Add Payment</Button>
            </div>
          </div>
        </CardHeader>
      </Card>
      
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (<Skeleton key={i} className="h-48 w-full" />))}
        </div>
      ) : summary.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {summary.map(item => <VendorCard key={item.id} item={item} />)}
        </div>
      ) : (
         <Card>
            <CardContent className="pt-6">
                <div className="text-center py-12">
                    <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-4 text-lg font-medium">No vendors found</h3>
                    <p className="mt-1 text-sm text-muted-foreground">Get started by adding your first vendor.</p>
                    <Button className="mt-6" onClick={() => setIsAddVendorOpen(true)}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Add Vendor
                    </Button>
                </div>
            </CardContent>
        </Card>
      )}

      {selectedVendor && (
          <VendorLedger 
            vendor={selectedVendor} 
            ledgerItems={ledgerData}
            loading={loadingLedger}
            onClose={handleCloseLedger}
            totalPurchase={ledgerTotalPurchase}
            totalPaid={ledgerTotalPaid}
            finalBalance={ledgerFinalBalance}
            onEditItem={handleEditItem}
            onDeleteItem={handleDeleteItem}
          />
      )}
      
    </div>
  );
}
