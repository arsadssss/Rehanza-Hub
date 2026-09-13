/**
 * Reports & Management Intelligence Engine
 *
 * Generates comprehensive executive, diagnostic, and period-over-period analytical
 * intelligence using the authoritative Reconciliation database and SKU analytics.
 */

import { sql } from '@/lib/db';
import { calculateReconciliationFinancials, resolveDateFilter } from '@/lib/reconciliation/financial-calculator';
import { calculateSkuAnalytics } from '@/lib/reconciliation/sku-analytics-calculator';
import { calculateRiskScore, calculateOpportunityScore } from '@/lib/reconciliation/decision-engine';
import {
  FinancialSummary,
  SkuProfitabilityMetric,
  ReconciliationDateFilter,
  DailyFinancialMetric,
} from '@/lib/reconciliation/types';

function round2(num: number): number {
  const sign = num < 0 ? -1 : 1;
  return sign * (Math.round((Math.abs(num) + Number.EPSILON) * 100) / 100);
}

export interface PeriodComparison {
  currentLabel: string;
  priorLabel: string;
  hasPriorData: boolean;
  revenue: { current: number; prior: number; deltaPercent: number | null };
  netProfit: { current: number; prior: number; deltaPercent: number | null };
  orders: { current: number; prior: number; deltaPercent: number | null };
  margin: {
    currentPercent: number;
    priorPercent: number;
    expansionBps: number;
    expansionPercent: number;
  };
  profitVelocity: 'expanding' | 'lagging' | 'contracting' | 'neutral';
}

export interface ProfitLeakageBreakdown {
  grossInvoiceSales: number;
  netRealizedProfit: number;
  netRetentionRate: number; // (netRealizedProfit / grossInvoiceSales) * 100
  cogs: { amount: number; percentage: number };
  packaging: { amount: number; percentage: number };
  logisticsTotal: { amount: number; percentage: number };
  forwardShipping: { amount: number; percentage: number };
  returnShipping: { amount: number; percentage: number };
  marketplaceFees: { amount: number; percentage: number };
  adSpend: { amount: number; percentage: number };
  taxesAndTcs: { amount: number; percentage: number };
  totalLeakage: number;
  totalLeakagePercentage: number;
}

export interface SettlementIntelligence {
  invoicedAmount: number;
  settledAmount: number;
  invoicedToSettledGap: number;
  averageDeductionPerOrder: number;
  settlementEfficiencyRate: number; // (settled / invoiced) * 100
  awaitingPaymentCount: number;
  disputedOrNegativeOrdersCount: number;
}

export interface MarginTrapSku {
  sku: string;
  productName: string;
  revenue: number;
  profit: number;
  profitMargin: number | null;
  totalOrders: number;
  returnRate: number;
  rtoRate: number;
  diagnosis: string;
}

export interface ReturnRtoDamageReport {
  totalOrders: number;
  deliveredOrders: number;
  deliveredRate: number;
  returnOrders: number;
  returnRate: number;
  rtoOrders: number;
  rtoRate: number;
  deliveryFailureRate: number; // ((return + rto) / total) * 100
  estimatedRtoLoss: number; // Forward freight + packaging wasted
  estimatedReturnLoss: number; // Forward freight + reverse freight + packaging
  totalFailedDeliveryLoss: number;
  topReturnBleeders: {
    sku: string;
    productName: string;
    returnOrders: number;
    rtoOrders: number;
    totalOrders: number;
    returnRate: number;
    rtoRate: number;
    estimatedLoss: number;
  }[];
}

export interface ParetoConcentration {
  totalSkus: number;
  top20PercentSkuCount: number;
  revenueSharePercent: number;
  profitSharePercent: number;
  returnSharePercent: number;
  concentrationSummary: string;
}

export interface WaterfallStep {
  label: string;
  amount: number;
  type: 'starting' | 'deduction' | 'addition' | 'final';
  runningTotal: number;
  percentOfGross: number;
}

export interface AnomalyRiskItem {
  id: string;
  type: 'CRITICAL' | 'WARNING' | 'INFO';
  title: string;
  description: string;
  affectedSku?: string;
  metric?: string;
}

export interface ActionDirective {
  priority: 1 | 2 | 3;
  type: 'STOP_BLEED' | 'SCALE_OPPORTUNITY' | 'INVESTIGATE_OPERATIONS';
  title: string;
  impactEstimate: string;
  actionText: string;
  sku?: string;
}

export interface ManagementAttentionBoard {
  top3ProfitBleeders: {
    sku: string;
    productName: string;
    lossAmount: number;
    margin: number | null;
    returnRate: number;
    rtoRate: number;
    orders: number;
    primaryCause: string;
  }[];
  top3MarginExpanders: {
    sku: string;
    productName: string;
    profit: number;
    margin: number | null;
    opportunityScore: number;
    returnRate: number;
    orders: number;
    scalingReadiness: string;
  }[];
  directives: ActionDirective[];
}

export interface ManagementReportResult {
  period: {
    from: string | null;
    to: string | null;
    label: string;
  };
  periodComparison: PeriodComparison;
  profitLeakage: ProfitLeakageBreakdown;
  settlementIntelligence: SettlementIntelligence;
  costWaterfall: WaterfallStep[];
  marginTraps: MarginTrapSku[];
  returnRtoDamage: ReturnRtoDamageReport;
  paretoConcentration: ParetoConcentration;
  businessTrajectory: {
    dates: string[];
    netMargins: number[];
    costToSalesRatios: number[];
  };
  anomalyMatrix: AnomalyRiskItem[];
  managementAttentionBoard: ManagementAttentionBoard;
  summaryParity: {
    totalSalesInvoice: number;
    settlementAmount: number;
    finalPayoutNetProfit: number;
    totalOrders: number;
  };
}

/**
 * Derives the immediately preceding equivalent date filter for Period-over-Period comparisons.
 */
function derivePriorFilter(
  currentFilter?: ReconciliationDateFilter,
  dateBounds?: { minDate: Date; maxDate: Date }
): ReconciliationDateFilter {
  const now = new Date();

  // If specific month (e.g. 2026-08 or month=8, year=2026)
  if (currentFilter?.month) {
    let year = currentFilter.year || now.getFullYear();
    let monthNum: number;
    if (currentFilter.month.includes('-')) {
      const parts = currentFilter.month.split('-');
      year = parseInt(parts[0], 10);
      monthNum = parseInt(parts[1], 10);
    } else {
      monthNum = parseInt(currentFilter.month, 10);
    }

    let priorYear = year;
    let priorMonth = monthNum - 1;
    if (priorMonth === 0) {
      priorMonth = 12;
      priorYear -= 1;
    }
    const padMonth = priorMonth.toString().padStart(2, '0');
    return {
      month: `${priorYear}-${padMonth}`,
      year: priorYear,
      range: 'month',
    };
  }

  // If custom date range or preset
  if (currentFilter?.startDate && currentFilter?.endDate) {
    const start = new Date(currentFilter.startDate);
    const end = new Date(currentFilter.endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const priorEnd = new Date(start.getTime() - 86400000); // Day before start
    const priorStart = new Date(priorEnd.getTime() - diffTime);

    return {
      startDate: priorStart.toISOString().split('T')[0],
      endDate: priorEnd.toISOString().split('T')[0],
      range: 'custom',
    };
  }

  if (currentFilter?.range === '7d') {
    const end = new Date(now.getTime() - 7 * 86400000);
    const start = new Date(now.getTime() - 14 * 86400000);
    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
      range: 'custom',
    };
  }

  if (currentFilter?.range === '30d') {
    const end = new Date(now.getTime() - 30 * 86400000);
    const start = new Date(now.getTime() - 60 * 86400000);
    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
      range: 'custom',
    };
  }

  if (currentFilter?.range === '90d') {
    const end = new Date(now.getTime() - 90 * 86400000);
    const start = new Date(now.getTime() - 180 * 86400000);
    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
      range: 'custom',
    };
  }

  // If 'all' and we know min and max dates, split into two halves
  if (dateBounds && dateBounds.minDate && dateBounds.maxDate) {
    const minT = dateBounds.minDate.getTime();
    const maxT = dateBounds.maxDate.getTime();
    const midT = minT + (maxT - minT) / 2;
    return {
      startDate: new Date(minT).toISOString().split('T')[0],
      endDate: new Date(midT).toISOString().split('T')[0],
      range: 'custom',
    };
  }

  return { range: 'all' };
}

/**
 * Generates the complete Management & Analytical Reporting Suite
 */
export async function generateManagementReport(
  accountId: string,
  filter?: ReconciliationDateFilter
): Promise<ManagementReportResult> {
  if (!accountId) {
    throw new Error('Account context required for management report');
  }

  // 1. Determine date boundaries of existing data in reconciliation_transactions
  const [dateRangeRes] = await sql`
    SELECT
      MIN(order_date)::timestamp as min_date,
      MAX(order_date)::timestamp as max_date,
      COUNT(*)::int as total_rows
    FROM reconciliation_transactions
    WHERE account_id = ${accountId} AND platform = 'Meesho';
  `;

  const minDate = dateRangeRes?.min_date ? new Date(dateRangeRes.min_date) : new Date();
  const maxDate = dateRangeRes?.max_date ? new Date(dateRangeRes.max_date) : new Date();

  // 2. Fetch Current Period Financials & SKU Analytics in parallel
  const [currentFinancials, currentSkuAnalytics] = await Promise.all([
    calculateReconciliationFinancials(accountId, filter),
    calculateSkuAnalytics(accountId, filter),
  ]);

  // 3. Derive and calculate Prior Period for Period-over-Period comparison
  const priorFilter = derivePriorFilter(filter, { minDate, maxDate });
  let priorFinancials: FinancialSummary | null = null;

  // Only calculate prior if different from current filter
  if (JSON.stringify(priorFilter) !== JSON.stringify(filter || { range: 'all' })) {
    try {
      priorFinancials = await calculateReconciliationFinancials(accountId, priorFilter);
    } catch {
      priorFinancials = null;
    }
  }

  // 4. PERIOD-OVER-PERIOD (PoP) CALCULATION
  const currRev = currentFinancials.totalSalesInvoice;
  const currProfit = currentFinancials.finalPayoutNetProfit;
  const currOrders = currentFinancials.orders.totalOrders;
  const currMargin = currRev > 0 ? (currProfit / currRev) * 100 : 0;

  let priorRev = priorFinancials?.totalSalesInvoice || 0;
  let priorProfit = priorFinancials?.finalPayoutNetProfit || 0;
  let priorOrders = priorFinancials?.orders.totalOrders || 0;
  let priorMargin = priorRev > 0 ? (priorProfit / priorRev) * 100 : 0;

  const hasPriorData = priorFinancials !== null && priorOrders > 0;

  const revGrowth = hasPriorData && priorRev > 0 ? round2(((currRev - priorRev) / priorRev) * 100) : null;
  const profitGrowth = hasPriorData && priorProfit !== 0 ? round2(((currProfit - priorProfit) / Math.abs(priorProfit)) * 100) : null;
  const ordersGrowth = hasPriorData && priorOrders > 0 ? round2(((currOrders - priorOrders) / priorOrders) * 100) : null;
  const marginExpansionPercent = round2(currMargin - priorMargin);
  const marginExpansionBps = Math.round(marginExpansionPercent * 100);

  let profitVelocity: 'expanding' | 'lagging' | 'contracting' | 'neutral' = 'neutral';
  if (profitGrowth !== null && ordersGrowth !== null) {
    if (profitGrowth > ordersGrowth && profitGrowth > 0) {
      profitVelocity = 'expanding'; // Profit growing faster than orders (economies of scale)
    } else if (profitGrowth < ordersGrowth && ordersGrowth > 0) {
      profitVelocity = 'lagging'; // Orders growing faster than profits (margin compression)
    } else if (profitGrowth < 0) {
      profitVelocity = 'contracting';
    }
  }

  const periodComparison: PeriodComparison = {
    currentLabel: currentFinancials.period.label,
    priorLabel: priorFinancials?.period.label || 'Prior Comparison Period',
    hasPriorData,
    revenue: { current: currRev, prior: priorRev, deltaPercent: revGrowth },
    netProfit: { current: currProfit, prior: priorProfit, deltaPercent: profitGrowth },
    orders: { current: currOrders, prior: priorOrders, deltaPercent: ordersGrowth },
    margin: {
      currentPercent: round2(currMargin),
      priorPercent: round2(priorMargin),
      expansionBps: marginExpansionBps,
      expansionPercent: marginExpansionPercent,
    },
    profitVelocity,
  };

  // 5. PROFIT LEAKAGE & COST WATERFALL
  const costs = currentFinancials.costs;
  const cogsAmount = Math.abs(costs.purchaseCost);
  const packagingAmount = Math.abs(costs.packagingCost);
  const forwardShippingAmount = Math.abs(costs.shippingCost);
  const returnShippingAmount = Math.abs(costs.returnShippingCost);
  const logisticsTotalAmount = forwardShippingAmount + returnShippingAmount;
  const adSpendAmount = Math.abs(costs.adsCost);

  const marketplaceFeesAmount = round2(
    Math.abs(costs.fixedFee) +
    Math.abs(costs.meeshoCommission) +
    Math.abs(costs.warehousingFee) +
    Math.abs(costs.recoveryFees) +
    Math.abs(costs.returnFilingCharge)
  );

  const taxesAmount = round2(Math.abs(costs.tcs) + Math.abs(costs.tds));

  const totalLeakageAmount = round2(
    cogsAmount + packagingAmount + logisticsTotalAmount + marketplaceFeesAmount + adSpendAmount + taxesAmount - costs.claims
  );

  const safeDiv = (val: number, base: number) => (base > 0 ? round2((val / base) * 100) : 0);

  const profitLeakage: ProfitLeakageBreakdown = {
    grossInvoiceSales: currRev,
    netRealizedProfit: currProfit,
    netRetentionRate: safeDiv(currProfit, currRev),
    cogs: { amount: cogsAmount, percentage: safeDiv(cogsAmount, currRev) },
    packaging: { amount: packagingAmount, percentage: safeDiv(packagingAmount, currRev) },
    logisticsTotal: { amount: logisticsTotalAmount, percentage: safeDiv(logisticsTotalAmount, currRev) },
    forwardShipping: { amount: forwardShippingAmount, percentage: safeDiv(forwardShippingAmount, currRev) },
    returnShipping: { amount: returnShippingAmount, percentage: safeDiv(returnShippingAmount, currRev) },
    marketplaceFees: { amount: marketplaceFeesAmount, percentage: safeDiv(marketplaceFeesAmount, currRev) },
    adSpend: { amount: adSpendAmount, percentage: safeDiv(adSpendAmount, currRev) },
    taxesAndTcs: { amount: taxesAmount, percentage: safeDiv(taxesAmount, currRev) },
    totalLeakage: totalLeakageAmount,
    totalLeakagePercentage: safeDiv(totalLeakageAmount, currRev),
  };

  // Cost Structure Waterfall
  let running = currRev;
  const costWaterfall: WaterfallStep[] = [
    {
      label: 'Gross Invoice Sales',
      amount: currRev,
      type: 'starting',
      runningTotal: running,
      percentOfGross: 100,
    },
    {
      label: 'Marketplace Deductions & Fees',
      amount: -marketplaceFeesAmount,
      type: 'deduction',
      runningTotal: round2((running -= marketplaceFeesAmount)),
      percentOfGross: safeDiv(marketplaceFeesAmount, currRev),
    },
    {
      label: 'Cost of Goods Sold (COGS)',
      amount: -cogsAmount,
      type: 'deduction',
      runningTotal: round2((running -= cogsAmount)),
      percentOfGross: safeDiv(cogsAmount, currRev),
    },
    {
      label: 'Packaging Materials',
      amount: -packagingAmount,
      type: 'deduction',
      runningTotal: round2((running -= packagingAmount)),
      percentOfGross: safeDiv(packagingAmount, currRev),
    },
    {
      label: 'Logistics (Forward & Return)',
      amount: -logisticsTotalAmount,
      type: 'deduction',
      runningTotal: round2((running -= logisticsTotalAmount)),
      percentOfGross: safeDiv(logisticsTotalAmount, currRev),
    },
    {
      label: 'Campaign Ad Spend',
      amount: -adSpendAmount,
      type: 'deduction',
      runningTotal: round2((running -= adSpendAmount)),
      percentOfGross: safeDiv(adSpendAmount, currRev),
    },
    {
      label: 'Tax Credits & Claims (TCS/TDS/Claims)',
      amount: round2(taxesAmount + costs.claims),
      type: 'addition',
      runningTotal: round2(currProfit),
      percentOfGross: safeDiv(taxesAmount + costs.claims, currRev),
    },
    {
      label: 'Final Realized Net Profit',
      amount: currProfit,
      type: 'final',
      runningTotal: currProfit,
      percentOfGross: safeDiv(currProfit, currRev),
    },
  ];

  // 6. SETTLEMENT & RECONCILIATION INTELLIGENCE
  const invoicedToSettledGap = round2(currRev - currentFinancials.settlementAmount);
  const averageDeductionPerOrder = currOrders > 0 ? round2(invoicedToSettledGap / currOrders) : 0;
  const settlementEfficiencyRate = currRev > 0 ? round2((currentFinancials.settlementAmount / currRev) * 100) : 0;

  const [disputedRes] = await sql`
    SELECT COUNT(*)::int as c FROM reconciliation_transactions
    WHERE account_id = ${accountId} AND platform = 'Meesho' AND (payment <= 0 OR recovery_amount < 0);
  `;

  const settlementIntelligence: SettlementIntelligence = {
    invoicedAmount: currRev,
    settledAmount: currentFinancials.settlementAmount,
    invoicedToSettledGap,
    averageDeductionPerOrder,
    settlementEfficiencyRate,
    awaitingPaymentCount: currentFinancials.orders.awaitingPayment,
    disputedOrNegativeOrdersCount: disputedRes?.c || 0,
  };

  // 7. SKU UNIT ECONOMICS & MARGIN TRAP DETECTION
  const allSkus = currentSkuAnalytics.skus || [];
  const marginTraps: MarginTrapSku[] = [];

  for (const s of allSkus) {
    const isTrap = (s.revenue > 3000 && s.profit < 0) || (s.revenue > 10000 && s.profitMargin !== null && s.profitMargin < 3);
    if (isTrap) {
      let diagnosis = 'High sales volume operating at an absolute financial loss.';
      if (s.returnRate > 20) {
        diagnosis = `Severe customer return rate (${s.returnRate}%) is wiping out unit margins.`;
      } else if (s.rtoRate > 25) {
        diagnosis = `High RTO courier failure rate (${s.rtoRate}%) destroying forward logistics costs.`;
      } else if (s.purchaseCost < 0 && Math.abs(s.purchaseCost) > s.revenue * 0.6) {
        diagnosis = 'Product purchase COGS exceeds 60% of invoice price. Price increase or supplier negotiation required.';
      }

      marginTraps.push({
        sku: s.sku,
        productName: s.productName,
        revenue: s.revenue,
        profit: s.profit,
        profitMargin: s.profitMargin,
        totalOrders: s.totalOrders,
        returnRate: s.returnRate,
        rtoRate: s.rtoRate,
        diagnosis,
      });
    }
  }

  // Sort margin traps by largest negative profit first
  marginTraps.sort((a, b) => a.profit - b.profit);

  // 8. RETURN & RTO IMPACT REPORT
  const ordersSummary = currentFinancials.orders;
  const avgShipping = ordersSummary.totalOrders > 0 ? forwardShippingAmount / ordersSummary.totalOrders : 50;
  const avgPackaging = ordersSummary.totalOrders > 0 ? packagingAmount / ordersSummary.totalOrders : 20;

  // RTO Loss: Forward courier + packaging wasted
  const estimatedRtoLoss = round2(ordersSummary.rtoOrders * (avgShipping + avgPackaging));
  // Return Loss: Forward courier + reverse courier + packaging + damage allowance (~₹40)
  const estimatedReturnLoss = round2(ordersSummary.returnOrders * (avgShipping * 1.8 + avgPackaging + 40));
  const totalFailedDeliveryLoss = round2(estimatedRtoLoss + estimatedReturnLoss);

  const deliveryFailureRate = ordersSummary.totalOrders > 0
    ? round2(((ordersSummary.returnOrders + ordersSummary.rtoOrders) / ordersSummary.totalOrders) * 100)
    : 0;

  const topReturnBleeders = allSkus
    .filter((s) => s.returnOrders > 0 || s.rtoOrders > 0)
    .map((s) => {
      const loss = round2(s.returnOrders * (avgShipping * 1.8 + avgPackaging + 40) + s.rtoOrders * (avgShipping + avgPackaging));
      return {
        sku: s.sku,
        productName: s.productName,
        returnOrders: s.returnOrders,
        rtoOrders: s.rtoOrders,
        totalOrders: s.totalOrders,
        returnRate: s.returnRate,
        rtoRate: s.rtoRate,
        estimatedLoss: loss,
      };
    })
    .sort((a, b) => b.estimatedLoss - a.estimatedLoss)
    .slice(0, 5);

  const returnRtoDamage: ReturnRtoDamageReport = {
    totalOrders: ordersSummary.totalOrders,
    deliveredOrders: ordersSummary.deliveredOrders,
    deliveredRate: ordersSummary.deliveredRate,
    returnOrders: ordersSummary.returnOrders,
    returnRate: ordersSummary.returnRate,
    rtoOrders: ordersSummary.rtoOrders,
    rtoRate: ordersSummary.rtoRate,
    deliveryFailureRate,
    estimatedRtoLoss,
    estimatedReturnLoss,
    totalFailedDeliveryLoss,
    topReturnBleeders,
  };

  // 9. PARETO CONCENTRATION ANALYSIS (80/20 Rule)
  const totalSkusCount = allSkus.length;
  const top20Count = Math.max(1, Math.ceil(totalSkusCount * 0.2));

  // Revenue concentration
  const skusByRev = [...allSkus].sort((a, b) => b.revenue - a.revenue);
  const top20RevSum = skusByRev.slice(0, top20Count).reduce((acc, s) => acc + s.revenue, 0);
  const revenueSharePercent = currRev > 0 ? round2((top20RevSum / currRev) * 100) : 0;

  // Profit concentration (among positive profit contributors)
  const positiveSkus = allSkus.filter((s) => s.profit > 0).sort((a, b) => b.profit - a.profit);
  const totalPositiveProfit = positiveSkus.reduce((acc, s) => acc + s.profit, 0);
  const top20PositiveProfit = positiveSkus.slice(0, top20Count).reduce((acc, s) => acc + s.profit, 0);
  const profitSharePercent = totalPositiveProfit > 0 ? round2((top20PositiveProfit / totalPositiveProfit) * 100) : 0;

  // Return concentration
  const totalReturnsCount = ordersSummary.returnOrders + ordersSummary.rtoOrders;
  const skusByReturns = [...allSkus].sort((a, b) => b.returnOrders + b.rtoOrders - (a.returnOrders + a.rtoOrders));
  const top20ReturnsSum = skusByReturns.slice(0, top20Count).reduce((acc, s) => acc + s.returnOrders + s.rtoOrders, 0);
  const returnSharePercent = totalReturnsCount > 0 ? round2((top20ReturnsSum / totalReturnsCount) * 100) : 0;

  const paretoConcentration: ParetoConcentration = {
    totalSkus: totalSkusCount,
    top20PercentSkuCount: top20Count,
    revenueSharePercent,
    profitSharePercent,
    returnSharePercent,
    concentrationSummary: `Top ${top20Count} SKUs (${Math.round((top20Count / totalSkusCount) * 100)}% of catalog) drive ${revenueSharePercent}% of total sales and ${profitSharePercent}% of profitable margins.`,
  };

  // 10. BUSINESS TRENDS & TRAJECTORY
  const dailyTrends = currentSkuAnalytics.dailyTrends || [];
  const trajectoryDates: string[] = [];
  const trajectoryMargins: number[] = [];
  const trajectoryCostRatios: number[] = [];

  for (const d of dailyTrends) {
    trajectoryDates.push(d.date);
    const m = d.revenue > 0 ? round2((d.profit / d.revenue) * 100) : 0;
    const costRatio = d.revenue > 0 ? round2(((d.revenue - d.profit) / d.revenue) * 100) : 100;
    trajectoryMargins.push(m);
    trajectoryCostRatios.push(costRatio);
  }

  // 11. ANOMALY & RISK DETECTION MATRIX
  const anomalyMatrix: AnomalyRiskItem[] = [];

  // Anomaly: Any SKU with return rate > 20%
  for (const s of allSkus) {
    if (s.totalOrders >= 10 && s.returnRate >= 20) {
      anomalyMatrix.push({
        id: `risk-return-${s.sku}`,
        type: 'CRITICAL',
        title: `High Return Anomaly: ${s.sku}`,
        description: `${s.returnRate}% customer return rate (${s.returnOrders} returned of ${s.totalOrders} ordered). E-commerce benchmark is <12%.`,
        affectedSku: s.sku,
        metric: `${s.returnRate}% Return Rate`,
      });
    }
    if (s.totalOrders >= 10 && s.rtoRate >= 25) {
      anomalyMatrix.push({
        id: `risk-rto-${s.sku}`,
        type: 'CRITICAL',
        title: `High RTO Courier Burn: ${s.sku}`,
        description: `${s.rtoRate}% RTO failure rate (${s.rtoOrders} undelivered packages). Wasting freight on uncompleted shipments.`,
        affectedSku: s.sku,
        metric: `${s.rtoRate}% RTO Rate`,
      });
    }
  }

  // Anomaly: Overall business delivery failure
  if (deliveryFailureRate > 35) {
    anomalyMatrix.push({
      id: 'risk-biz-delivery-drag',
      type: 'WARNING',
      title: 'High Overall Delivery Failure Drag',
      description: `${deliveryFailureRate}% of dispatched shipments result in Customer Returns or RTOs, causing severe logistics cost leakage.`,
      metric: `${deliveryFailureRate}% Failure Rate`,
    });
  }

  // Anomaly: Pending SKU costs
  const pendingCostSkus = allSkus.filter((s) => s.purchaseCost === 0 && s.totalOrders > 0);
  if (pendingCostSkus.length > 0) {
    anomalyMatrix.push({
      id: 'info-pending-costs',
      type: 'INFO',
      title: `${pendingCostSkus.length} SKUs Missing Purchase Cost`,
      description: 'Some products have unconfigured purchase costs in SKU Cost Master, which may result in overestimated profit calculation.',
      metric: `${pendingCostSkus.length} SKUs`,
    });
  }

  // 12. MANAGEMENT ATTENTION BOARD
  const sortedByLoss = [...allSkus].filter((s) => s.profit < 0).sort((a, b) => a.profit - b.profit);
  const top3Bleeders = sortedByLoss.slice(0, 3).map((s) => {
    let cause = 'Low unit margin';
    if (s.returnRate > 20) cause = `Disproportionate Return Rate (${s.returnRate}%)`;
    else if (s.rtoRate > 20) cause = `High RTO Non-Delivery (${s.rtoRate}%)`;
    else if (s.purchaseCost < 0 && Math.abs(s.purchaseCost) > s.revenue * 0.7) cause = 'High COGS purchase cost';

    return {
      sku: s.sku,
      productName: s.productName,
      lossAmount: Math.abs(s.profit),
      margin: s.profitMargin,
      returnRate: s.returnRate,
      rtoRate: s.rtoRate,
      orders: s.totalOrders,
      primaryCause: cause,
    };
  });

  const sortedByOpportunity = [...allSkus]
    .filter((s) => s.profit > 0 && s.totalOrders >= 5)
    .sort((a, b) => calculateOpportunityScore(b) - calculateOpportunityScore(a));

  const top3Expanders = sortedByOpportunity.slice(0, 3).map((s) => ({
    sku: s.sku,
    productName: s.productName,
    profit: s.profit,
    margin: s.profitMargin,
    opportunityScore: calculateOpportunityScore(s),
    returnRate: s.returnRate,
    orders: s.totalOrders,
    scalingReadiness: s.returnRate < 10 && (s.profitMargin || 0) > 15 ? 'Prime Scale Candidate' : 'Stable Margin Performer',
  }));

  const directives: ActionDirective[] = [];

  // Directive 1: Halt or reprice worst bleeder
  if (top3Bleeders.length > 0) {
    const b = top3Bleeders[0];
    directives.push({
      priority: 1,
      type: 'STOP_BLEED',
      title: `Eliminate Loss Leader: ${b.sku}`,
      impactEstimate: `Recovers up to ₹${b.lossAmount.toLocaleString('en-IN')} net loss`,
      actionText: `Pause active advertising campaigns or increase listing price by 15-20%. Current return rate is ${b.returnRate}% and unit margin is negative.`,
      sku: b.sku,
    });
  }

  // Directive 2: Scale top opportunity SKU
  if (top3Expanders.length > 0) {
    const e = top3Expanders[0];
    directives.push({
      priority: 2,
      type: 'SCALE_OPPORTUNITY',
      title: `Scale Winning SKU: ${e.sku}`,
      impactEstimate: `Projected +₹${Math.round(e.profit * 1.5).toLocaleString('en-IN')} additional profit at 1.5x volume`,
      actionText: `Increase marketplace ad budget and restock inventory. SKU delivers healthy ${e.margin}% margin with low ${e.returnRate}% return rate.`,
      sku: e.sku,
    });
  }

  // Directive 3: Reverse logistics investigation
  if (topReturnBleeders.length > 0) {
    const tr = topReturnBleeders[0];
    directives.push({
      priority: 3,
      type: 'INVESTIGATE_OPERATIONS',
      title: `Audit Quality & Sizing: ${tr.sku}`,
      impactEstimate: `Saves approx ₹${tr.estimatedLoss.toLocaleString('en-IN')} in reverse freight`,
      actionText: `Inspect product packaging, color consistency, and size charts. With ${tr.returnOrders} customer returns, packaging improvements will directly stop reverse courier loss.`,
      sku: tr.sku,
    });
  }

  const managementAttentionBoard: ManagementAttentionBoard = {
    top3ProfitBleeders: top3Bleeders,
    top3MarginExpanders: top3Expanders,
    directives,
  };

  return {
    period: currentFinancials.period,
    periodComparison,
    profitLeakage,
    settlementIntelligence,
    costWaterfall,
    marginTraps,
    returnRtoDamage,
    paretoConcentration,
    businessTrajectory: {
      dates: trajectoryDates,
      netMargins: trajectoryMargins,
      costToSalesRatios: trajectoryCostRatios,
    },
    anomalyMatrix,
    managementAttentionBoard,
    summaryParity: {
      totalSalesInvoice: currRev,
      settlementAmount: currentFinancials.settlementAmount,
      finalPayoutNetProfit: currProfit,
      totalOrders: currOrders,
    },
  };
}
