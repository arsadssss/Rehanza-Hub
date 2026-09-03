/**
 * Financial Calculation Types for Meesho Reconciliation (Phase 2A)
 * 
 * Defines all strongly-typed interfaces for the calculation service layer,
 * date filtering parameters, status breakdowns, cost metrics, and financial summary.
 */

export type DateRangePreset = 'all' | '7d' | '30d' | '90d' | 'month' | 'custom';

export interface ReconciliationDateFilter {
  range?: DateRangePreset;
  month?: string; // Format: 'YYYY-MM' or '7'
  year?: number;  // Format: 2026
  startDate?: string; // Format: 'YYYY-MM-DD'
  endDate?: string;   // Format: 'YYYY-MM-DD'
}

export interface DateFilterRange {
  startDate: string | null;
  endDate: string | null;
  label: string;
}

export interface OrderStatusBreakdown {
  totalOrders: number; // SUM(quantity)
  deliveredOrders: number;
  deliveredRate: number; // Percentage (0-100)
  shippedOrders: number;
  shippedRate: number;
  exchangeOrders: number;
  exchangeRate: number;
  returnOrders: number;
  returnRate: number;
  rtoOrders: number;
  rtoRate: number;
  cancelOrders: number;
  cancelRate: number;
  awaitingPayment: number;
  netOrders: number; // Delivered + Exchange + Return
}

export interface FinancialCostMetrics {
  purchaseCost: number; // Negative sign convention: -ABS(SUM(Working Sheet G))
  packagingCost: number; // Negative sign convention: -ABS(SUM(Working Sheet H))
  shippingCost: number; // Upload Payments col AD (preserved negative sign)
  returnShippingCost: number; // Upload Payments col AB (preserved negative sign)
  tcs: number; // Upload Payments col AI (preserved negative sign)
  tds: number; // Upload Payments col AK (preserved negative sign)
  claims: number; // Upload Payments col AM (positive)
  claimReason?: string | null;
  recoveryFees: number; // Upload Payments col AN (preserved negative sign)
  recoveryReason?: string | null;
  fixedFee: number; // Upload Payments col Z
  meeshoCommission: number; // Upload Payments col W
  warehousingFee: number; // Upload Payments col AA
  adsCost: number; // Upload RM Ads col H (preserved negative sign)
  returnFilingCharge: number; // Workbook B20 (default 0 or from settings)
}

export interface FinancialSummary {
  period: {
    from: string | null;
    to: string | null;
    label: string;
  };
  totalSalesInvoice: number; // SUM of Upload Order Supplier Discounted Price
  settlementAmount: number; // SUM of Working Sheet Payment
  averageOrderValue: number; // AVERAGE of Upload Payments col P (Total Sale Amount > 0)
  gstRate: number; // Configured GST rate (e.g. 0.18 for 18%)
  gstInputAmount: number; // Total Sales Invoice * gstRate
  
  // Order counts and status rates
  orders: OrderStatusBreakdown;

  // Individual cost and deduction metrics
  costs: FinancialCostMetrics;

  // Top-level profit metrics preserving workbook distinction
  orderLevelWorkingSheetProfit: number; // SUM(Working Sheet M: profit)
  a24NetCashflow: number; // Intermediate workbook A24 value
  finalPayoutNetProfit: number; // Final workbook B23 / B3 payout/net profit
}

export interface FinancialSummaryResponse {
  success: boolean;
  message?: string;
  data?: FinancialSummary;
  error?: string;
}

// ====================================================
// PHASE 3: SKU & DAILY FINANCIAL ANALYTICS TYPES
// ====================================================

export interface SkuProfitabilityMetric {
  sku: string;
  productName: string;
  category?: string | null;
  costStatus?: 'configured' | 'pending';
  totalOrders: number; // SUM(quantity)
  deliveredOrders: number;
  shippedOrders: number;
  exchangeOrders: number;
  returnOrders: number;
  rtoOrders: number;
  cancelOrders: number;
  netOrders: number; // Delivered + Exchange + Return
  revenue: number; // Invoice sales / Supplier Discounted Price
  settlementAmount: number; // Bank settlement
  purchaseCost: number; // Preserved negative expense
  packagingCost: number; // Preserved negative expense
  shippingCost: number;
  returnShippingCost: number;
  adsCost: number | null; // Unallocated at SKU level (null)
  recoveryFees: number;
  claims: number;
  tcs: number;
  tds: number;
  fixedFee: number;
  commission: number;
  warehousingFee: number;
  profit: number; // Working Sheet profit sum
  profitMargin: number | null; // (profit / revenue) * 100, null if revenue is 0
  aov: number | null; // Average positive total_sale_amount
  returnRate: number; // (returnOrders / totalOrders) * 100
  rtoRate: number; // (rtoOrders / totalOrders) * 100
  deliveredRate: number; // (deliveredOrders / totalOrders) * 100
}

export interface SkuRankings {
  topRevenueSku: SkuProfitabilityMetric | null;
  topProfitSku: SkuProfitabilityMetric | null;
  topOrdersSku: SkuProfitabilityMetric | null;
  worstProfitSku: SkuProfitabilityMetric | null;
  highestReturnSku: SkuProfitabilityMetric | null;
  highestRtoSku: SkuProfitabilityMetric | null;
}

export interface DailyFinancialMetric {
  date: string; // 'YYYY-MM-DD'
  orders: number; // SUM(quantity)
  revenue: number;
  settlement: number;
  profit: number;
  returns: number;
  rto: number;
  delivered: number;
}

export type DailyTrendMetric = DailyFinancialMetric;

export interface LossConcentrationItem {
  name: string;
  amount: number;
  percentage: number; // Share of total operational deductions (0-100)
  classification: string;
}

export type TopReturnRtoMode = 'combined' | 'returns_only' | 'rto_only';

export interface TopReturnRtoItem {
  rank: number;
  sku: string;
  productName: string;
  totalOrders: number;
  returnOrders: number;
  rtoOrders: number;
  count: number;
  rate: number; // relevant return, rto, or combined rate %
}

export interface TopPerformingProductItem {
  rank: number;
  sku: string;
  productName: string;
  totalOrders: number;
  deliveredOrders: number;
  revenue: number;
  profit: number;
}

export interface SkuAnalyticsResult {
  period: {
    from: string | null;
    to: string | null;
    label: string;
  };
  skus: SkuProfitabilityMetric[];
  rankings: SkuRankings;
  lossConcentration: LossConcentrationItem[];
  dailyTrends: DailyFinancialMetric[];
  topReturnsRto: {
    combined: TopReturnRtoItem[];
    returnsOnly: TopReturnRtoItem[];
    rtoOnly: TopReturnRtoItem[];
  };
  topPerformingProducts: TopPerformingProductItem[];
}


// ====================================================
// PHASE 4: BUSINESS INTELLIGENCE & DECISION ENGINE TYPES
// ====================================================

export type DecisionState = 'SCALE' | 'HEALTHY' | 'MONITOR' | 'REVIEW' | 'STOP';
export type DecisionConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

export interface SkuDecisionRecommendation {
  sku: string;
  productName: string;
  decision: DecisionState;
  confidence: DecisionConfidence;
  action: string;
  primaryReason: string;
  reasons: string[];
  riskScore: number; // 0 to 100
  opportunityScore: number; // 0 to 100
  metrics: {
    totalOrders: number;
    revenue: number;
    profit: number;
    profitMargin: number | null;
    deliveredRate: number;
    returnRate: number;
    rtoRate: number;
    aov: number | null;
  };
}

export interface DecisionEngineSummary {
  totalSkus: number;
  scaleCount: number;
  healthyCount: number;
  monitorCount: number;
  reviewCount: number;
  stopCount: number;
  highRiskCount: number;
  highOpportunityCount: number;
  bestOpportunity: SkuDecisionRecommendation | null;
  highestRiskSku: SkuDecisionRecommendation | null;
  mostProfitableSku: SkuDecisionRecommendation | null;
  largestLossSku: SkuDecisionRecommendation | null;
}

export interface DecisionEngineResult {
  period: {
    from: string | null;
    to: string | null;
    label: string;
  };
  summary: DecisionEngineSummary;
  decisions: SkuDecisionRecommendation[];
  priorityActions: SkuDecisionRecommendation[];
}


