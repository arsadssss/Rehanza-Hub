'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatINRWithDecimals } from '@/lib/format';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts';
import { BarChart3, UploadCloud } from 'lucide-react';
import { FinancialSummary } from '@/lib/reconciliation/types';

interface ProfitLossChartProps {
  summary: FinancialSummary | null;
  loading: boolean;
}

export function ProfitLossChart({ summary, loading }: ProfitLossChartProps) {
  if (loading || !summary) {
    return (
      <Card className="glass-panel bg-slate-950/60 border-white/15 rounded-2xl overflow-hidden p-6 space-y-4">
        <Skeleton className="h-6 w-48 bg-white/10" />
        <Skeleton className="h-64 w-full bg-white/5" />
      </Card>
    );
  }

  const {
    totalSalesInvoice,
    settlementAmount,
    costs,
    finalPayoutNetProfit,
  } = summary;

  // Build the component flow dataset using actual API figures
  const chartData = [
    {
      category: 'Total Sales',
      amount: totalSalesInvoice,
      color: '#6366F1', // indigo-500
      type: 'Inflow',
    },
    {
      category: 'Settlement',
      amount: settlementAmount,
      color: '#3B82F6', // blue-500
      type: 'Inflow',
    },
    {
      category: 'Purchase Cost',
      amount: costs.purchaseCost, // Negative
      color: '#F43F5E', // rose-500
      type: 'Expense',
    },
    {
      category: 'Packaging',
      amount: costs.packagingCost, // Negative
      color: '#FB7185', // rose-400
      type: 'Expense',
    },
    {
      category: 'Shipping',
      amount: costs.shippingCost, // Negative
      color: '#F97316', // orange-500
      type: 'Expense',
    },
    {
      category: 'Return Ship.',
      amount: costs.returnShippingCost, // Negative
      color: '#EA580C', // orange-600
      type: 'Expense',
    },
    {
      category: 'Ads Cost',
      amount: costs.adsCost, // Negative
      color: '#E11D48', // rose-600
      type: 'Expense',
    },
    {
      category: 'Recovery Fees',
      amount: costs.recoveryFees, // Negative
      color: '#BE123C', // rose-700
      type: 'Expense',
    },
    {
      category: 'Claims',
      amount: costs.claims, // Positive
      color: '#06B6D4', // cyan-500
      type: 'Inflow',
    },
    {
      category: 'Net Payout',
      amount: finalPayoutNetProfit,
      color: finalPayoutNetProfit >= 0 ? '#10B981' : '#E11D48',
      type: finalPayoutNetProfit >= 0 ? 'Profit' : 'Loss',
    },
  ];

  // Check if all amounts are zero (Empty state)
  const isDataEmpty = chartData.every((d) => d.amount === 0);

  if (isDataEmpty) {
    return (
      <Card className="glass-panel bg-slate-950/60 border-white/15 rounded-2xl p-6 shadow-[0_8px_30px_rgba(0,0,0,0.25)]">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-500/15 border border-indigo-400/30 flex items-center justify-center text-indigo-400 flex-shrink-0">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-black text-white">
                Cashflow & Deduction Flow
              </h4>
              <p className="text-xs text-slate-300 mt-0.5">
                No reconciliation cashflow data for this period
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
            <UploadCloud className="h-4 w-4 text-indigo-400" />
            <span>Upload Orders, Payments and RM Ads to begin.</span>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="glass-panel bg-slate-950/60 border-white/15 rounded-2xl overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.25)]">
      <CardHeader className="pb-3 border-b border-white/15 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <CardTitle className="text-base md:text-lg font-black text-white">
            Financial Cashflow & Deduction Flow
          </CardTitle>
          <p className="text-xs text-slate-300 mt-0.5 font-medium">
            Component breakdown from Invoice Revenue to Final Realized Payout
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs font-bold">
          <span className="flex items-center gap-1.5 text-slate-200">
            <span className="h-2.5 w-2.5 rounded-full bg-indigo-500 ring-2 ring-indigo-500/30" /> Inflows
          </span>
          <span className="flex items-center gap-1.5 text-slate-200">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-rose-500/30" /> Expenses / Deductions
          </span>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-6">
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 15, right: 15, left: 20, bottom: 25 }}
            >
              <ReferenceLine y={0} stroke="rgba(255,255,255,0.35)" strokeWidth={1.5} />
              <XAxis
                dataKey="category"
                tickLine={false}
                axisLine={false}
                interval={0}
                angle={-25}
                textAnchor="end"
                height={45}
                tick={{ fill: '#E2E8F0', fontSize: 11, fontWeight: 600 }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => `₹${Math.round(val / 1000)}k`}
                tick={{ fill: '#CBD5E1', fontSize: 11, fontWeight: 600 }}
              />
              <Tooltip
                cursor={{ fill: 'rgba(255,255,255,0.08)' }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="glass-panel bg-slate-950/95 p-3 rounded-xl border border-white/25 text-xs shadow-2xl space-y-1">
                        <p className="font-bold text-white text-xs">{data.category}</p>
                        <p className="text-[11px] text-slate-400 font-medium">{data.type}</p>
                        <p className="font-black text-sm" style={{ color: data.color }}>
                          {formatINRWithDecimals(data.amount)}
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="amount" radius={[4, 4, 4, 4]}>
                {chartData.map((entry, index) => (
                  <Cell key={`bar-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
