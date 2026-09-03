'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatINRWithDecimals, formatINR } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
  Sparkles,
  TrendingUp,
  AlertTriangle,
  Award,
  TrendingDown,
  ShieldCheck,
  Package,
  CheckCircle2,
  HelpCircle,
} from 'lucide-react';
import {
  DecisionEngineSummary,
  SkuDecisionRecommendation,
} from '@/lib/reconciliation/decision-engine';
import { SkuProfitabilityMetric } from '@/lib/reconciliation/types';

interface BusinessIntelligenceProps {
  decisionSummary: DecisionEngineSummary | null;
  topProfitSku: SkuProfitabilityMetric | null;
  worstProfitSku: SkuProfitabilityMetric | null;
  loading: boolean;
  periodLabel: string;
}

export function BusinessIntelligence({
  decisionSummary,
  topProfitSku,
  worstProfitSku,
  loading,
  periodLabel,
}: BusinessIntelligenceProps) {
  if (loading || !decisionSummary) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="space-y-2">
            <Skeleton className="h-6 w-56 bg-white/10" />
            <Skeleton className="h-4 w-40 bg-white/5" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Card
              key={i}
              className="glass-panel relative overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/40 p-6 shadow-[0_20px_50px_rgba(2,6,23,0.35)] backdrop-blur-xl space-y-3"
            >
              <Skeleton className="h-4 w-28 bg-white/10" />
              <Skeleton className="h-6 w-36 bg-white/10" />
              <Skeleton className="h-4 w-full bg-white/5" />
              <Skeleton className="h-12 w-full rounded-xl bg-white/5" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const { bestOpportunity, highestRiskSku, largestLossSku } = decisionSummary;

  // Determine Most Profitable SKU strictly validating cost status
  // If cost is pending, suppress false profitability claim
  const isTopProfitCostConfigured = topProfitSku?.costStatus === 'configured';
  const displayTopProfitSku = isTopProfitCostConfigured ? topProfitSku : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-lg font-black tracking-tight text-white font-headline">
              Business Intelligence
            </h2>
            <p className="text-xs text-slate-400 font-medium">
              AI-assisted business logic • {periodLabel}
            </p>
          </div>
        </div>
        <Badge
          variant="outline"
          className="glass-pill px-3 py-1 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-[10px] font-bold uppercase tracking-wider"
        >
          {decisionSummary.totalSkus} SKUs Evaluated
        </Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* CARD A: TOP SCALING OPPORTUNITY */}
        <Card className="glass-panel relative overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/40 p-6 shadow-[0_20px_50px_rgba(2,6,23,0.35)] backdrop-blur-xl transition-all duration-300 hover:border-emerald-400/30 group flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">
                Top Scaling Opportunity
              </span>
              <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-400">
                <TrendingUp className="h-4 w-4" />
              </div>
            </div>

            {bestOpportunity ? (
              <>
                <div>
                  <h3 className="text-base font-black text-white font-mono truncate" title={bestOpportunity.sku}>
                    {bestOpportunity.sku}
                  </h3>
                  <p className="text-[11px] text-slate-300 line-clamp-1 mt-0.5" title={bestOpportunity.productName}>
                    {bestOpportunity.productName}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border',
                      bestOpportunity.decision === 'SCALE'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                    )}
                  >
                    {bestOpportunity.decision}
                  </Badge>
                  <span className="text-xs font-black text-white">
                    {bestOpportunity.metrics.totalOrders} units
                  </span>
                  <span className="text-xs font-black text-emerald-400">
                    {formatINR(bestOpportunity.metrics.profit)}
                  </span>
                </div>

                <p className="text-[11px] text-slate-300 leading-snug line-clamp-2">
                  {bestOpportunity.primaryReason}
                </p>
              </>
            ) : (
              <div className="py-6 text-center text-slate-400 text-xs font-semibold">
                No scaling opportunity identified in current period.
              </div>
            )}
          </div>

          {bestOpportunity && (
            <div className="pt-3 border-t border-white/5 mt-3 text-[10px] text-emerald-300/90 font-medium truncate">
              {bestOpportunity.action}
            </div>
          )}
        </Card>

        {/* CARD B: HIGHEST BUSINESS RISK */}
        <Card className="glass-panel relative overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/40 p-6 shadow-[0_20px_50px_rgba(2,6,23,0.35)] backdrop-blur-xl transition-all duration-300 hover:border-rose-400/30 group flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-400">
                Highest Business Risk
              </span>
              <div className="p-2 bg-rose-500/10 rounded-xl text-rose-400">
                <AlertTriangle className="h-4 w-4" />
              </div>
            </div>

            {highestRiskSku ? (
              <>
                <div>
                  <h3 className="text-base font-black text-white font-mono truncate" title={highestRiskSku.sku}>
                    {highestRiskSku.sku}
                  </h3>
                  <p className="text-[11px] text-slate-300 line-clamp-1 mt-0.5" title={highestRiskSku.productName}>
                    {highestRiskSku.productName}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border bg-rose-500/20 text-rose-300 border-rose-500/40"
                  >
                    {highestRiskSku.decision}
                  </Badge>
                  <span className="text-xs font-bold text-slate-300">
                    Risk Score: <span className="font-black text-rose-400">{highestRiskSku.riskScore}/100</span>
                  </span>
                </div>

                <p className="text-[11px] text-rose-200/90 font-medium leading-snug line-clamp-2">
                  {highestRiskSku.primaryReason}
                </p>
              </>
            ) : (
              <div className="py-6 text-center text-slate-400 text-xs font-semibold">
                No high risk SKUs detected.
              </div>
            )}
          </div>

          {highestRiskSku && (
            <div className="pt-3 border-t border-white/5 mt-3 text-[10px] text-rose-300/90 font-medium truncate">
              {highestRiskSku.action}
            </div>
          )}
        </Card>

        {/* CARD C: MOST PROFITABLE SKU */}
        <Card className="glass-panel relative overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/40 p-6 shadow-[0_20px_50px_rgba(2,6,23,0.35)] backdrop-blur-xl transition-all duration-300 hover:border-amber-400/30 group flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-400">
                Most Profitable SKU
              </span>
              <div className="p-2 bg-amber-500/10 rounded-xl text-amber-400">
                <Award className="h-4 w-4" />
              </div>
            </div>

            {displayTopProfitSku ? (
              <>
                <div>
                  <h3 className="text-base font-black text-white font-mono truncate" title={displayTopProfitSku.sku}>
                    {displayTopProfitSku.sku}
                  </h3>
                  <p className="text-[11px] text-slate-300 line-clamp-1 mt-0.5" title={displayTopProfitSku.productName}>
                    {displayTopProfitSku.productName}
                  </p>
                </div>

                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-black font-headline text-emerald-400">
                    {formatINRWithDecimals(displayTopProfitSku.profit)}
                  </span>
                  <Badge
                    variant="outline"
                    className="text-[10px] font-bold border border-emerald-500/30 bg-emerald-500/15 text-emerald-300 px-1.5 py-0.5"
                  >
                    {displayTopProfitSku.profitMargin}% Margin
                  </Badge>
                </div>

                <p className="text-[11px] text-slate-300 font-medium">
                  {displayTopProfitSku.totalOrders} units sold • {displayTopProfitSku.deliveredOrders} delivered
                </p>
              </>
            ) : (
              <div className="py-6 text-center text-slate-400 text-xs font-semibold space-y-1">
                <p className="text-amber-300/90 font-bold">Cost Pending</p>
                <p className="text-[11px] text-slate-400">
                  Configure unit costs in SKU Cost Master to display audited profitability.
                </p>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-white/5 mt-3 text-[10px] text-slate-400 font-medium flex items-center justify-between">
            <span>Verified Profitability</span>
            {isTopProfitCostConfigured ? (
              <span className="text-emerald-400 flex items-center gap-1 font-bold">
                <CheckCircle2 className="h-3 w-3" /> Configured
              </span>
            ) : (
              <span className="text-amber-400 flex items-center gap-1 font-bold">
                <HelpCircle className="h-3 w-3" /> Cost Pending
              </span>
            )}
          </div>
        </Card>

        {/* CARD D: LARGEST LOSS DRIVER */}
        <Card className="glass-panel relative overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/40 p-6 shadow-[0_20px_50px_rgba(2,6,23,0.35)] backdrop-blur-xl transition-all duration-300 hover:border-rose-400/30 group flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-400">
                Largest Loss Driver
              </span>
              <div className="p-2 bg-rose-500/10 rounded-xl text-rose-400">
                <TrendingDown className="h-4 w-4" />
              </div>
            </div>

            {worstProfitSku && worstProfitSku.profit < 0 ? (
              <>
                <div>
                  <h3 className="text-base font-black text-white font-mono truncate" title={worstProfitSku.sku}>
                    {worstProfitSku.sku}
                  </h3>
                  <p className="text-[11px] text-slate-300 line-clamp-1 mt-0.5" title={worstProfitSku.productName}>
                    {worstProfitSku.productName}
                  </p>
                </div>

                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-black font-headline text-rose-400">
                    {formatINRWithDecimals(worstProfitSku.profit)}
                  </span>
                  <Badge
                    variant="outline"
                    className="text-[10px] font-bold border border-rose-500/30 bg-rose-500/15 text-rose-300 px-1.5 py-0.5"
                  >
                    Loss Leader
                  </Badge>
                </div>

                <p className="text-[11px] text-rose-200/90 font-medium leading-snug line-clamp-2">
                  {worstProfitSku.returnOrders} customer returns ({worstProfitSku.returnRate}%) & {worstProfitSku.rtoOrders} RTO units
                </p>
              </>
            ) : largestLossSku && largestLossSku.metrics.profit < 0 ? (
              <>
                <div>
                  <h3 className="text-base font-black text-white font-mono truncate" title={largestLossSku.sku}>
                    {largestLossSku.sku}
                  </h3>
                  <p className="text-[11px] text-slate-300 line-clamp-1 mt-0.5" title={largestLossSku.productName}>
                    {largestLossSku.productName}
                  </p>
                </div>

                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-black font-headline text-rose-400">
                    {formatINRWithDecimals(largestLossSku.metrics.profit)}
                  </span>
                </div>

                <p className="text-[11px] text-rose-200/90 font-medium leading-snug line-clamp-2">
                  {largestLossSku.primaryReason}
                </p>
              </>
            ) : (
              <div className="py-6 text-center text-slate-400 text-xs font-semibold space-y-1">
                <p className="text-emerald-400 font-bold">Zero Loss Drivers</p>
                <p className="text-[11px] text-slate-400">
                  All analyzed SKUs generated positive net cashflow in this period.
                </p>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-white/5 mt-3 text-[10px] text-slate-400 font-medium truncate">
            {worstProfitSku && worstProfitSku.profit < 0
              ? 'Recommendation: Review return causes and reduce catalog bid'
              : 'Portfolio health is stable'}
          </div>
        </Card>
      </div>
    </div>
  );
}

