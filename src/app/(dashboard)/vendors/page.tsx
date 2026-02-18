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
import { PlusCircle, FileText } from 'lucide-react';

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

export default function VendorsPage() {
  const supabase = createClient();
  const { toast } = useToast();

  const [summary, setSummary] = useState<VendorBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddVendorOpen, setIsAddVendorOpen] = useState(false);
  const [isAddPurchaseOpen, setIsAddPurchaseOpen] = useState(false);
  const [isAddPaymentOpen, setIsAddPaymentOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<VendorBalance | null>(null);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('vendor_balance_summary').select('*');
    if (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to fetch vendor summary.',
      });
      setSummary([]);
    } else {
      setSummary((data as VendorBalance[]) || []);
    }
    setLoading(false);
  }, [supabase, toast]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const handleDataAdded = () => {
    fetchSummary();
    if(selectedVendor) {
        setSelectedVendor(null);
    }
  };

  const VendorCard = ({ item }: { item: VendorBalance }) => (
    <Card className="shadow-md hover:shadow-xl transition-shadow cursor-pointer" onClick={() => setSelectedVendor(item)}>
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

      {selectedVendor && <VendorLedger vendor={selectedVendor} onClose={() => setSelectedVendor(null)} />}
      
    </div>
  );
}
