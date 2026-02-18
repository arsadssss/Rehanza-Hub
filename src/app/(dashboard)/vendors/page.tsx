
"use client"

import React, { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/format';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PlusCircle, FileText, Wallet, Archive } from 'lucide-react';

import { AddVendorModal } from './components/add-vendor-modal';
import { AddPurchaseModal } from './components/add-purchase-modal';
import { AddPaymentModal } from './components/add-payment-modal';
import { VendorLedger } from './components/vendor-ledger';

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
};

export default function VendorsPage() {
  const supabase = createClient();
  const { toast } = useToast();

  const [summary, setSummary] = useState<VendorBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddVendorOpen, setIsAddVendorOpen] = useState(false);
  const [isAddPurchaseOpen, setIsAddPurchaseOpen] = useState(false);
  const [isAddPaymentOpen, setIsAddPaymentOpen] = useState(false);
  
  const [selectedVendor, setSelectedVendor] = useState<VendorBalance | null>(null);
  const [ledgerData, setLedgerData] = useState<LedgerItem[]>([]);
  const [loadingLedger, setLoadingLedger] = useState(false);

  // New state for frontend calculated totals
  const [ledgerTotalPurchase, setLedgerTotalPurchase] = useState(0);
  const [ledgerTotalPaid, setLedgerTotalPaid] = useState(0);
  const [ledgerFinalBalance, setLedgerFinalBalance] = useState(0);
  const [totalDueAllVendors, setTotalDueAllVendors] = useState(0);
  const [totalInventoryValue, setTotalInventoryValue] = useState(0);


  const fetchSummary = useCallback(async () => {
    setLoading(true);

    const [summaryRes, productsRes] = await Promise.all([
        supabase.from('vendor_balance_summary').select('*'),
        supabase.from('allproducts').select('cost_price, stock')
    ]);
    
    // Process Vendor Summary
    if (summaryRes.error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to fetch vendor summary.',
      });
      setSummary([]);
    } else {
      const summaryData = (summaryRes.data as VendorBalance[]) || [];
      setSummary(summaryData);

      const totalDue = summaryData.reduce((acc, vendor) => {
        return acc + (vendor.balance_due > 0 ? vendor.balance_due : 0);
      }, 0);
      setTotalDueAllVendors(totalDue);
    }

    // Process Inventory Value
    if (productsRes.error) {
      toast({
        variant: 'destructive',
        title: 'Error fetching inventory value',
        description: productsRes.error.message,
      });
      setTotalInventoryValue(0);
    } else {
      const products = productsRes.data || [];
      const totalValue = products.reduce((sum, product) => {
        const cost = Number(product.cost_price || 0);
        const stock = Number(product.stock || 0);
        return sum + (cost * stock);
      }, 0);
      setTotalInventoryValue(totalValue);
    }

    setLoading(false);
  }, [supabase, toast]);

  const fetchLedger = useCallback(async (vendor: VendorBalance) => {
    if (!vendor?.id) return;
    setLoadingLedger(true);

    const { data: purchases, error: purchaseError } =
      await supabase
        .from("vendor_purchases")
        .select("*")
        .eq("vendor_id", vendor.id);

    const { data: payments, error: paymentError } =
      await supabase
        .from("vendor_payments")
        .select("*")
        .eq("vendor_id", vendor.id);

    if (purchaseError || paymentError) {
      console.error(purchaseError || paymentError);
      toast({
        variant: "destructive",
        title: "Error fetching ledger",
        description: purchaseError?.message || paymentError?.message || 'An unknown error occurred'
      });
      setLoadingLedger(false);
      return;
    }

    // Calculate totals safely
    const totalPurchase = purchases?.reduce((sum, p) => sum + Number(p.total_amount || 0), 0) || 0;
    const totalPaid = payments?.reduce((sum, p) => sum + Number(p.amount || 0), 0) || 0;
    const finalBalance = totalPurchase - totalPaid;

    setLedgerTotalPurchase(totalPurchase);
    setLedgerTotalPaid(totalPaid);
    setLedgerFinalBalance(finalBalance);

    const purchaseEntries =
      purchases?.map((p) => ({
        id: `purchase-${p.id}`,
        date: p.purchase_date,
        description: p.product_name,
        debit: Number(p.total_amount),
        credit: 0,
      })) || [];

    const paymentEntries =
      payments?.map((p) => ({
        id: `payment-${p.id}`,
        date: p.payment_date,
        description: p.notes || "Payment",
        debit: 0,
        credit: Number(p.amount),
      })) || [];

    const combined = [...purchaseEntries, ...paymentEntries];

    combined.sort(
      (a, b) =>
        new Date(a.date).getTime() -
        new Date(b.date).getTime()
    );

    let runningBalance = 0;
    const ledgerWithBalance = combined.map((entry) => {
      runningBalance += entry.debit;
      runningBalance -= entry.credit;

      return {
        ...entry,
        balance: runningBalance,
      };
    });

    setLedgerData(ledgerWithBalance);
    setLoadingLedger(false);
  }, [supabase, toast]);


  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const handleDataAdded = () => {
    fetchSummary();
    if(selectedVendor) {
      // Re-fetch ledger for the currently selected vendor if any
      const currentVendor = summary.find(s => s.id === selectedVendor.id);
      if (currentVendor) {
          fetchLedger(currentVendor);
      }
    }
  };


  const handleVendorClick = (vendor: VendorBalance) => {
    setSelectedVendor(vendor);
    fetchLedger(vendor);
  };
  
  const handleCloseLedger = () => {
    setSelectedVendor(null);
    setLedgerData([]);
    setLedgerTotalPurchase(0);
    setLedgerTotalPaid(0);
    setLedgerFinalBalance(0);
  }

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
          <span className="font-medium">{formatCurrency(item.total_purchase)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Total Paid</span>
          <span className="font-medium">{formatCurrency(item.total_paid)}</span>
        </div>
        <div className="flex justify-between font-bold text-base border-t pt-2 mt-2">
          <span>Balance Due</span>
          <span>{formatCurrency(item.balance_due)}</span>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="p-6 space-y-6 bg-gray-50/50 dark:bg-black/50 min-h-full">
      <AddVendorModal isOpen={isAddVendorOpen} onClose={() => setIsAddVendorOpen(false)} onVendorAdded={handleDataAdded} />
      <AddPurchaseModal isOpen={isAddPurchaseOpen} onClose={() => setIsAddPurchaseOpen(false)} onPurchaseAdded={handleDataAdded} />
      <AddPaymentModal isOpen={isAddPaymentOpen} onClose={() => setIsAddPaymentOpen(false)} onPaymentAdded={handleDataAdded} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="text-white bg-gradient-to-r from-red-500 to-orange-600 shadow-xl rounded-2xl border-0">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Due Across All Vendors</CardTitle>
                <Wallet className="h-5 w-5 text-white/80" />
            </CardHeader>
            <CardContent>
                {loading ? <Skeleton className="h-10 w-48 bg-white/20" /> : (
                    totalDueAllVendors > 0 ? (
                        <>
                            <div className="text-3xl font-bold font-headline">{formatCurrency(totalDueAllVendors)}</div>
                            <p className="text-xs text-white/80">Total Outstanding Payable</p>
                        </>
                    ) : (
                        <>
                            <div className="text-2xl font-bold font-headline">All Settled</div>
                            <p className="text-xs text-white/80">No outstanding payables to any vendor.</p>
                        </>
                    )
                )}
            </CardContent>
        </Card>
        <Card className="text-white bg-gradient-to-r from-emerald-500 to-teal-600 shadow-xl rounded-2xl border-0">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Inventory Purchase Value</CardTitle>
                <Archive className="h-5 w-5 text-white/80" />
            </CardHeader>
            <CardContent>
                {loading ? <Skeleton className="h-10 w-48 bg-white/20" /> : (
                    totalInventoryValue > 0 ? (
                        <>
                            <div className="text-3xl font-bold font-headline">{formatCurrency(totalInventoryValue)}</div>
                            <p className="text-xs text-white/80">Total Capital Invested in Stock</p>
                        </>
                    ) : (
                        <>
                            <div className="text-2xl font-bold font-headline">No Inventory</div>
                            <p className="text-xs text-white/80">Your inventory value is currently zero.</p>
                        </>
                    )
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
          />
      )}
      
    </div>
  );
}
