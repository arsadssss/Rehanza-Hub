'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatINRWithDecimals } from '@/lib/format';
import { cn } from '@/lib/utils';
import { FinancialSummary } from '@/lib/reconciliation/types';

interface FinancialTableProps {
  summary: FinancialSummary | null;
  loading: boolean;
}

interface TableRow {
  metric: string;
  source: string;
  amount: number;
  type: 'Revenue' | 'Settlement' | 'Cost' | 'Fee' | 'Tax' | 'Recovery' | 'Profit';
  signType: 'inflow' | 'expense' | 'neutral';
}

const CLASSIFICATION_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  Revenue: { bg: 'bg-indigo-500/15', text: 'text-indigo-300', border: 'border-indigo-400/30' },
  Settlement: { bg: 'bg-blue-500/15', text: 'text-blue-300', border: 'border-blue-400/30' },
  Cost: { bg: 'bg-rose-500/15', text: 'text-rose-300', border: 'border-rose-400/30' },
  Fee: { bg: 'bg-amber-500/15', text: 'text-amber-300', border: 'border-amber-400/30' },
  Tax: { bg: 'bg-purple-500/15', text: 'text-purple-300', border: 'border-purple-400/30' },
  Recovery: { bg: 'bg-orange-500/15', text: 'text-orange-300', border: 'border-orange-400/30' },
  Profit: { bg: 'bg-emerald-500/15', text: 'text-emerald-300', border: 'border-emerald-400/30' },
};

export function FinancialTable({ summary, loading }: FinancialTableProps) {
  if (loading || !summary) {
    return (
      <Card className="glass-panel bg-slate-950/60 border-white/15 rounded-2xl overflow-hidden p-6 space-y-3">
        <Skeleton className="h-6 w-44 bg-white/10" />
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Skeleton key={i} className="h-10 w-full bg-white/5" />
        ))}
      </Card>
    );
  }

  const {
    totalSalesInvoice,
    settlementAmount,
    costs,
    orderLevelWorkingSheetProfit,
    a24NetCashflow,
    finalPayoutNetProfit,
  } = summary;

  const rows: TableRow[] = [
    {
      metric: 'Total Sales (Invoice)',
      source: 'Upload Order: Supplier Discounted Price (Col L)',
      amount: totalSalesInvoice,
      type: 'Revenue',
      signType: 'inflow',
    },
    {
      metric: 'Settlement Amount',
      source: 'Upload Payments: Bank Final Settlement Amount (Col N)',
      amount: settlementAmount,
      type: 'Settlement',
      signType: 'inflow',
    },
    {
      metric: 'Purchase Cost (COGS)',
      source: 'Working Sheet G: Quantity × Unit Cost',
      amount: costs.purchaseCost,
      type: 'Cost',
      signType: 'expense',
    },
    {
      metric: 'Packaging Cost',
      source: 'Working Sheet H: Per-unit packaging lookup',
      amount: costs.packagingCost,
      type: 'Cost',
      signType: 'expense',
    },
    {
      metric: 'Shipping Cost (Forward)',
      source: 'Upload Payments AD: Shipping Charge (Incl. GST)',
      amount: costs.shippingCost,
      type: 'Fee',
      signType: 'expense',
    },
    {
      metric: 'Return Shipping Cost',
      source: 'Upload Payments AB: Return Shipping Charge (Incl. GST)',
      amount: costs.returnShippingCost,
      type: 'Fee',
      signType: 'expense',
    },
    {
      metric: 'RM Ads Cost',
      source: 'Upload RM Ads H: Total Ads Cost (incl. GST)',
      amount: costs.adsCost,
      type: 'Cost',
      signType: 'expense',
    },
    {
      metric: 'Recovery Fees',
      source: costs.recoveryReason || 'Upload Payments AN: Recovery',
      amount: costs.recoveryFees,
      type: 'Recovery',
      signType: 'expense',
    },
    {
      metric: 'Claims / Compensation',
      source: costs.claimReason || 'Upload Payments AM: Claims',
      amount: costs.claims,
      type: 'Recovery',
      signType: 'inflow',
    },
    {
      metric: 'TCS (Tax Collected at Source)',
      source: 'Upload Payments AI: Creditable Tax (1%)',
      amount: costs.tcs,
      type: 'Tax',
      signType: 'expense',
    },
    {
      metric: 'TDS (Section 194-O)',
      source: 'Upload Payments AK: Creditable Tax Withholding (0.1%)',
      amount: costs.tds,
      type: 'Tax',
      signType: 'expense',
    },
    {
      metric: 'Fixed Platform Fee',
      source: 'Upload Payments Z: Fixed Fee (Incl. GST)',
      amount: costs.fixedFee,
      type: 'Fee',
      signType: costs.fixedFee === 0 ? 'neutral' : 'expense',
    },
    {
      metric: 'Meesho Commission',
      source: 'Upload Payments W: Meesho Commission',
      amount: costs.meeshoCommission,
      type: 'Fee',
      signType: costs.meeshoCommission === 0 ? 'neutral' : 'expense',
    },
    {
      metric: 'Warehousing Fee',
      source: 'Upload Payments AA: Warehousing Fee',
      amount: costs.warehousingFee,
      type: 'Fee',
      signType: costs.warehousingFee === 0 ? 'neutral' : 'expense',
    },
    {
      metric: 'Return Filing Charge',
      source: 'Workbook B20: Administrative filing charge',
      amount: costs.returnFilingCharge ? -Math.abs(costs.returnFilingCharge) : 0,
      type: 'Fee',
      signType: costs.returnFilingCharge === 0 ? 'neutral' : 'expense',
    },
    {
      metric: 'Working Sheet Order Profit',
      source: 'Working Sheet M: Order-level Payment - Cost - Packaging',
      amount: orderLevelWorkingSheetProfit,
      type: 'Profit',
      signType: orderLevelWorkingSheetProfit >= 0 ? 'inflow' : 'expense',
    },
    {
      metric: 'Intermediate Cashflow (A24)',
      source: 'Workbook Final!A24 (Settlement - All Expenses)',
      amount: a24NetCashflow,
      type: 'Settlement',
      signType: a24NetCashflow >= 0 ? 'inflow' : 'expense',
    },
    {
      metric: 'Final Realized Net Profit / Payout',
      source: 'Workbook Final!B23 / B3: Claims + TCS + TDS + A24',
      amount: finalPayoutNetProfit,
      type: 'Profit',
      signType: finalPayoutNetProfit >= 0 ? 'inflow' : 'expense',
    },
  ];

  return (
    <Card className="glass-panel bg-slate-950/60 border-white/15 rounded-2xl overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.25)]">
      <CardHeader className="pb-3 border-b border-white/15">
        <CardTitle className="text-base md:text-lg font-black text-white">
          Comprehensive Financial Ledger
        </CardTitle>
        <p className="text-xs text-slate-300 mt-0.5 font-medium">
          Auditable reconciliation ledger mapped 1-to-1 with workbook definitions and classifications
        </p>
      </CardHeader>

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/15 bg-white/[0.04] text-slate-300 font-bold uppercase text-[11px] tracking-wider">
                <th className="text-left py-3.5 px-5 font-bold">Metric / Financial Line</th>
                <th className="text-left py-3.5 px-5 font-bold hidden md:table-cell">Workbook / DB Source</th>
                <th className="text-left py-3.5 px-5 font-bold">Classification</th>
                <th className="text-right py-3.5 px-5 font-bold">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-medium">
              {rows.map((row) => {
                const style = CLASSIFICATION_STYLES[row.type] || CLASSIFICATION_STYLES.Cost;
                const isFinalProfit = row.metric.includes('Final Realized Net Profit');
                const isTotalSales = row.metric.includes('Total Sales');
                return (
                  <tr
                    key={row.metric}
                    className={cn(
                      'hover:bg-white/[0.05] transition-colors',
                      isFinalProfit && 'bg-emerald-950/20 font-bold',
                      isTotalSales && 'bg-indigo-950/20 font-bold'
                    )}
                  >
                    <td className="py-3 px-5 font-bold text-slate-100 text-xs sm:text-sm">
                      {row.metric}
                    </td>
                    <td className="py-3 px-5 text-slate-300 text-xs hidden md:table-cell font-medium">
                      {row.source}
                    </td>
                    <td className="py-3 px-5">
                      <Badge
                        variant="outline"
                        className={cn('text-[11px] font-bold border px-2.5 py-0.5', style.bg, style.text, style.border)}
                      >
                        {row.type}
                      </Badge>
                    </td>
                    <td className="py-3 px-5 text-right font-black text-xs sm:text-sm md:text-base">
                      <span
                        className={cn(
                          row.amount < 0
                            ? 'text-rose-400 font-black'
                            : row.amount > 0 && (row.type === 'Revenue' || row.type === 'Settlement' || row.type === 'Profit')
                            ? 'text-emerald-400 font-black'
                            : 'text-slate-200'
                        )}
                      >
                        {formatINRWithDecimals(row.amount)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
