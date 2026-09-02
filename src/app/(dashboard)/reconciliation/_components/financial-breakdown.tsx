'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatINRWithDecimals } from '@/lib/format';
import {
  Boxes,
  Package,
  Truck,
  RotateCcw,
  Zap,
  ShieldAlert,
  Award,
  Receipt,
  Layers,
  Scale,
  Percent,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { FinancialCostMetrics } from '@/lib/reconciliation/types';

interface FinancialBreakdownProps {
  costs: FinancialCostMetrics | null;
  gstRate: number;
  gstInputAmount: number;
  orderLevelWorkingSheetProfit: number;
  a24NetCashflow: number;
  finalPayoutNetProfit: number;
  loading: boolean;
}

export function FinancialBreakdown({
  costs,
  gstRate,
  gstInputAmount,
  orderLevelWorkingSheetProfit,
  loading,
}: FinancialBreakdownProps) {
  if (loading || !costs) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="glass-panel bg-slate-950/60 border border-white/15 p-5 rounded-2xl space-y-3"
          >
            <Skeleton className="h-5 w-28 bg-white/10" />
            <Skeleton className="h-8 w-20 bg-white/5" />
            <Skeleton className="h-4 w-full bg-white/5" />
          </div>
        ))}
      </div>
    );
  }

  // Cost Groups matching Section 8
  const costCategories = [
    {
      group: 'Product & Fulfillment Costs',
      items: [
        {
          name: 'Purchase Cost (COGS)',
          value: costs.purchaseCost,
          desc: 'Quantity × SKU unit cost price',
          icon: Boxes,
          isExpense: true,
        },
        {
          name: 'Packaging Cost',
          value: costs.packagingCost,
          desc: 'Per-order packaging fee',
          icon: Package,
          isExpense: true,
        },
        {
          name: 'Working Sheet Profit',
          value: orderLevelWorkingSheetProfit,
          desc: 'Order-level (Payment - Cost - Packing)',
          icon: Layers,
          isExpense: orderLevelWorkingSheetProfit < 0,
          highlight: true,
        },
      ],
    },
    {
      group: 'Logistics & Reverse Fees',
      items: [
        {
          name: 'Shipping Cost (Forward)',
          value: costs.shippingCost,
          desc: 'Shipping charge incl. GST (Col AD)',
          icon: Truck,
          isExpense: costs.shippingCost < 0,
        },
        {
          name: 'Return Shipping Cost',
          value: costs.returnShippingCost,
          desc: 'Return transit fee incl. GST (Col AB)',
          icon: RotateCcw,
          isExpense: costs.returnShippingCost < 0,
        },
        {
          name: 'Return Filing Charge',
          value: costs.returnFilingCharge ? -Math.abs(costs.returnFilingCharge) : 0,
          desc: 'Return administrative fee (Workbook B20)',
          icon: Scale,
          isExpense: true,
        },
      ],
    },
    {
      group: 'Marketplace Fees & Marketing',
      items: [
        {
          name: 'RM Ads Cost',
          value: costs.adsCost,
          desc: 'Total campaign ad spend + GST (RM Ads Col H)',
          icon: Zap,
          isExpense: true,
        },
        {
          name: 'Fixed Platform Fee',
          value: costs.fixedFee,
          desc: 'Meesho fixed fee (Upload Payments Col Z)',
          icon: Receipt,
          isExpense: costs.fixedFee < 0,
        },
        {
          name: 'Meesho Commission',
          value: costs.meeshoCommission,
          desc: 'Platform sales commission (Col W)',
          icon: Percent,
          isExpense: costs.meeshoCommission < 0,
        },
        {
          name: 'Warehousing Fee',
          value: costs.warehousingFee,
          desc: 'Storage charge (Col AA)',
          icon: Boxes,
          isExpense: costs.warehousingFee < 0,
        },
      ],
    },
    {
      group: 'Taxes, Claims & Recoveries',
      items: [
        {
          name: 'TCS (Tax Collected at Source)',
          value: costs.tcs,
          desc: 'Creditable tax deducted (Col AI)',
          icon: Receipt,
          isExpense: costs.tcs < 0,
        },
        {
          name: 'TDS (Section 194-O)',
          value: costs.tds,
          desc: 'Creditable withholding tax (Col AK)',
          icon: Receipt,
          isExpense: costs.tds < 0,
        },
        {
          name: 'Recovery Fees',
          value: costs.recoveryFees,
          desc: costs.recoveryReason || 'Return Assurance / Penalties (Col AN)',
          icon: ShieldAlert,
          isExpense: true,
        },
        {
          name: 'Claims & Compensation',
          value: costs.claims,
          desc: costs.claimReason || 'Settled lost/damaged claims (Col AM)',
          icon: Award,
          isExpense: false,
        },
      ],
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base md:text-lg font-black tracking-tight text-white">
          Financial Cost & Fee Breakdown
        </h3>
        <p className="text-xs text-slate-300 mt-0.5 font-medium">
          Detailed itemization of direct costs, logistics, marketplace fees, and tax withholdings
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {costCategories.map((cat) => (
          <Card
            key={cat.group}
            className="glass-panel bg-slate-950/60 border-white/15 rounded-2xl overflow-hidden flex flex-col justify-between shadow-[0_8px_30px_rgba(0,0,0,0.25)]"
          >
            <CardHeader className="pb-3 border-b border-white/15">
              <CardTitle className="text-xs font-black uppercase tracking-wider text-indigo-300">
                {cat.group}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3 flex-1">
              {cat.items.map((item) => {
                const Icon = item.icon;
                const isNegative = item.value < 0;
                return (
                  <div
                    key={item.name}
                    className={cn(
                      'p-3 rounded-xl transition-all border',
                      item.highlight
                        ? 'bg-indigo-950/40 border-indigo-500/30'
                        : 'bg-slate-900/50 border-white/10 hover:border-white/20'
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 truncate">
                        <Icon className="h-4 w-4 text-indigo-300 flex-shrink-0" />
                        <span className="text-xs sm:text-sm font-bold text-white truncate">
                          {item.name}
                        </span>
                      </div>
                      <span
                        className={cn(
                          'text-xs sm:text-sm font-black',
                          isNegative
                            ? 'text-rose-400'
                            : item.value > 0
                            ? 'text-emerald-400'
                            : 'text-slate-300'
                        )}
                      >
                        {formatINRWithDecimals(item.value)}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 font-medium mt-1 truncate">
                      {item.desc}
                    </p>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tax & GST Info Banner */}
      <div className="p-4 rounded-2xl glass-panel bg-slate-950/60 border border-white/15 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-[0_8px_30px_rgba(0,0,0,0.25)]">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-indigo-500/15 border border-indigo-400/30 flex items-center justify-center text-indigo-300 flex-shrink-0">
            <Percent className="h-4 w-4" />
          </div>
          <div>
            <p className="font-bold text-white text-xs sm:text-sm">
              Configured GST Rate: {(gstRate * 100).toFixed(0)}%
            </p>
            <p className="text-xs text-slate-300 font-medium">
              Total Sales GST Input Calculation: <strong className="text-white font-bold">{formatINRWithDecimals(gstInputAmount)}</strong>
            </p>
          </div>
        </div>
        <div className="text-right w-full sm:w-auto">
          <Badge
            variant="outline"
            className="glass-pill border-white/15 bg-white/5 text-slate-300 text-[11px] font-bold px-3 py-1"
          >
            Statutory Input Credit
          </Badge>
        </div>
      </div>
    </div>
  );
}
