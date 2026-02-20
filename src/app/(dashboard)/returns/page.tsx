
"use client"

import React, { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { formatINR } from '@/lib/format';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AddReturnModal } from './components/add-return-modal';
import { PlusCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export type Return = {
  id: string;
  return_date: string;
  platform: 'Meesho' | 'Flipkart' | 'Amazon';
  variant_id: string;
  quantity: number;
  restockable: boolean;
  total_loss: number;
  product_variants: {
    variant_sku: string;
  } | null;
};

export default function ReturnsPage() {
  const supabase = createClient();
  const [returns, setReturns] = useState<Return[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { toast } = useToast();

  async function fetchReturns() {
    setLoading(true);
    const { data, error } = await supabase
      .from('returns')
      .select(`
        *,
        product_variants (
          variant_sku
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching returns:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to fetch returns.',
      });
      setReturns([]);
    } else {
      setReturns(data as Return[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchReturns();
     const handleDataChange = () => fetchReturns();

    window.addEventListener('data-changed', handleDataChange);

    return () => {
      window.removeEventListener('data-changed', handleDataChange);
    };
  }, []);

  const handleReturnAdded = () => {
    fetchReturns();
    window.dispatchEvent(new Event('data-changed'));
  };

  return (
    <div className="p-6">
      <AddReturnModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onReturnAdded={handleReturnAdded}
      />
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <CardTitle className="font-headline">Returns</CardTitle>
              <CardDescription>View and manage customer returns.</CardDescription>
            </div>
            <div className="flex items-center gap-2 w-full md:w-auto">
              <Button onClick={() => setIsModalOpen(true)}>
                <PlusCircle className="mr-2 h-4 w-4" /> Add Return
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>Variant SKU</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Restockable</TableHead>
                  <TableHead>Total Loss</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={6}>
                        <Skeleton className="h-8 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : returns.length > 0 ? (
                  returns.map(item => (
                      <TableRow key={item.id}>
                        <TableCell>{format(new Date(item.return_date), 'dd MMM yyyy')}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{item.platform}</Badge>
                        </TableCell>
                        <TableCell className="font-medium">{item.product_variants?.variant_sku}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>
                          <Badge variant={item.restockable ? 'default' : 'destructive'} className={item.restockable ? 'bg-green-500' : ''}>
                            {item.restockable ? 'Yes' : 'No'}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatINR(item.total_loss)}</TableCell>
                      </TableRow>
                    ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      No returns found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
