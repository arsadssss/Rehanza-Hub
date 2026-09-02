/**
 * SKU Profitability & Financial Analytics Calculator (Phase 3)
 * 
 * Server-side calculation layer for SKU-level profitability, dynamic rankings,
 * daily financial trends, loss concentration, and return/RTO metrics.
 * 
 * Reuses Phase 2A source data, date filters, and account isolation.
 */

import { sql } from '@/lib/db';
import { resolveDateFilter } from './financial-calculator';
import {
  ReconciliationDateFilter,
  SkuProfitabilityMetric,
  SkuRankings,
  DailyFinancialMetric,
  LossConcentrationItem,
  SkuAnalyticsResult,
  TopReturnRtoItem,
  TopPerformingProductItem,
} from './types';

function round2(num: number): number {
  const sign = num < 0 ? -1 : 1;
  return sign * (Math.round((Math.abs(num) + Number.EPSILON) * 100) / 100);
}

/**
 * Calculate SKU profitability, daily trends, and loss concentration
 * Scoped strictly to the authenticated account and date filter.
 */
export async function calculateSkuAnalytics(
  accountId: string,
  filter?: ReconciliationDateFilter
): Promise<SkuAnalyticsResult> {
  if (!accountId) {
    throw new Error('Account context missing for SKU analytics calculation');
  }

  const dateRange = resolveDateFilter(filter);
  const { startDate, endDate, label } = dateRange;
  const isDateFiltered = startDate !== null && endDate !== null;

  // 1. Grouped SKU Query
  // Join transactions with orders_raw on source_order_id to get accurate invoice revenue
  const skuQuery = isDateFiltered
    ? sql`
        SELECT 
          COALESCE(t.sku, 'UNKNOWN') AS sku,
          COALESCE(MAX(t.product_name), MAX(o.product_name), t.sku) AS product_name,
          COALESCE(SUM(t.quantity), 0)::numeric AS total_orders,
          COALESCE(SUM(t.quantity) FILTER (WHERE LOWER(t.status) = 'delivered' OR LOWER(t.live_order_status) = 'delivered'), 0)::numeric AS delivered_orders,
          COALESCE(SUM(t.quantity) FILTER (WHERE LOWER(t.status) = 'shipped' OR LOWER(t.live_order_status) = 'shipped'), 0)::numeric AS shipped_orders,
          COALESCE(SUM(t.quantity) FILTER (WHERE LOWER(t.status) = 'exchange' OR LOWER(t.live_order_status) = 'exchange'), 0)::numeric AS exchange_orders,
          COALESCE(SUM(t.quantity) FILTER (WHERE LOWER(t.status) = 'return' OR LOWER(t.live_order_status) = 'return'), 0)::numeric AS return_orders,
          COALESCE(SUM(t.quantity) FILTER (WHERE LOWER(t.status) = 'rto' OR LOWER(t.live_order_status) = 'rto'), 0)::numeric AS rto_orders,
          COALESCE(SUM(t.quantity) FILTER (WHERE LOWER(t.status) IN ('cancel', 'cancelled') OR LOWER(t.live_order_status) IN ('cancel', 'cancelled')), 0)::numeric AS cancel_orders,

          -- SKU Revenue: Supplier Discounted Price from orders_raw (fallback to listing_price or total_sale_amount)
          COALESCE(SUM(COALESCE(o.supplier_discounted_price, t.listing_price, t.total_sale_amount, 0)), 0)::numeric AS revenue,

          COALESCE(SUM(t.payment), 0)::numeric AS settlement_amount,
          COALESCE(SUM(t.quantity_cost), 0)::numeric AS purchase_cost,
          COALESCE(SUM(t.packaging), 0)::numeric AS packaging_cost,
          COALESCE(SUM(t.shipping_cost), 0)::numeric AS shipping_cost,
          COALESCE(SUM(t.return_shipping_cost), 0)::numeric AS return_shipping_cost,
          COALESCE(SUM(t.tcs), 0)::numeric AS tcs,
          COALESCE(SUM(t.tds), 0)::numeric AS tds,
          COALESCE(SUM(t.fixed_fee), 0)::numeric AS fixed_fee,
          COALESCE(SUM(t.platform_commission), 0)::numeric AS commission,
          COALESCE(SUM(t.warehousing_fee), 0)::numeric AS warehousing_fee,
          COALESCE(SUM(t.claim_amount), 0)::numeric AS claims,
          COALESCE(SUM(t.recovery_amount), 0)::numeric AS recovery_fees,

          -- Working Sheet Profit
          COALESCE(SUM(t.profit), 0)::numeric AS profit,

          -- AOV: Average positive total_sale_amount
          AVG(t.total_sale_amount) FILTER (WHERE t.total_sale_amount > 0 AND t.status IS NOT NULL AND t.status != '')::numeric AS aov
        FROM reconciliation_transactions t
        LEFT JOIN reconciliation_orders_raw o ON t.source_order_id = o.id
        WHERE t.platform = 'Meesho'
          AND (
            t.account_id = ${accountId}
            OR t.source_order_id IN (
              SELECT o2.id FROM reconciliation_orders_raw o2 
              JOIN reconciliation_uploads u ON o2.upload_id = u.id 
              WHERE u.account_id = ${accountId}
            )
            OR t.source_payment_id IN (
              SELECT p.id FROM reconciliation_payments_raw p 
              JOIN reconciliation_uploads u ON p.upload_id = u.id 
              WHERE u.account_id = ${accountId}
            )
          )
          AND COALESCE(t.order_date, o.order_date, t.created_at) >= ${startDate}::timestamp
          AND COALESCE(t.order_date, o.order_date, t.created_at) <= ${endDate}::timestamp
        GROUP BY t.sku
        ORDER BY total_orders DESC
      `
    : sql`
        SELECT 
          COALESCE(t.sku, 'UNKNOWN') AS sku,
          COALESCE(MAX(t.product_name), MAX(o.product_name), t.sku) AS product_name,
          COALESCE(SUM(t.quantity), 0)::numeric AS total_orders,
          COALESCE(SUM(t.quantity) FILTER (WHERE LOWER(t.status) = 'delivered' OR LOWER(t.live_order_status) = 'delivered'), 0)::numeric AS delivered_orders,
          COALESCE(SUM(t.quantity) FILTER (WHERE LOWER(t.status) = 'shipped' OR LOWER(t.live_order_status) = 'shipped'), 0)::numeric AS shipped_orders,
          COALESCE(SUM(t.quantity) FILTER (WHERE LOWER(t.status) = 'exchange' OR LOWER(t.live_order_status) = 'exchange'), 0)::numeric AS exchange_orders,
          COALESCE(SUM(t.quantity) FILTER (WHERE LOWER(t.status) = 'return' OR LOWER(t.live_order_status) = 'return'), 0)::numeric AS return_orders,
          COALESCE(SUM(t.quantity) FILTER (WHERE LOWER(t.status) = 'rto' OR LOWER(t.live_order_status) = 'rto'), 0)::numeric AS rto_orders,
          COALESCE(SUM(t.quantity) FILTER (WHERE LOWER(t.status) IN ('cancel', 'cancelled') OR LOWER(t.live_order_status) IN ('cancel', 'cancelled')), 0)::numeric AS cancel_orders,

          -- SKU Revenue: Supplier Discounted Price from orders_raw (fallback to listing_price or total_sale_amount)
          COALESCE(SUM(COALESCE(o.supplier_discounted_price, t.listing_price, t.total_sale_amount, 0)), 0)::numeric AS revenue,

          COALESCE(SUM(t.payment), 0)::numeric AS settlement_amount,
          COALESCE(SUM(t.quantity_cost), 0)::numeric AS purchase_cost,
          COALESCE(SUM(t.packaging), 0)::numeric AS packaging_cost,
          COALESCE(SUM(t.shipping_cost), 0)::numeric AS shipping_cost,
          COALESCE(SUM(t.return_shipping_cost), 0)::numeric AS return_shipping_cost,
          COALESCE(SUM(t.tcs), 0)::numeric AS tcs,
          COALESCE(SUM(t.tds), 0)::numeric AS tds,
          COALESCE(SUM(t.fixed_fee), 0)::numeric AS fixed_fee,
          COALESCE(SUM(t.platform_commission), 0)::numeric AS commission,
          COALESCE(SUM(t.warehousing_fee), 0)::numeric AS warehousing_fee,
          COALESCE(SUM(t.claim_amount), 0)::numeric AS claims,
          COALESCE(SUM(t.recovery_amount), 0)::numeric AS recovery_fees,

          -- Working Sheet Profit
          COALESCE(SUM(t.profit), 0)::numeric AS profit,

          -- AOV: Average positive total_sale_amount
          AVG(t.total_sale_amount) FILTER (WHERE t.total_sale_amount > 0 AND t.status IS NOT NULL AND t.status != '')::numeric AS aov
        FROM reconciliation_transactions t
        LEFT JOIN reconciliation_orders_raw o ON t.source_order_id = o.id
        WHERE t.platform = 'Meesho'
          AND (
            t.account_id = ${accountId}
            OR t.source_order_id IN (
              SELECT o2.id FROM reconciliation_orders_raw o2 
              JOIN reconciliation_uploads u ON o2.upload_id = u.id 
              WHERE u.account_id = ${accountId}
            )
            OR t.source_payment_id IN (
              SELECT p.id FROM reconciliation_payments_raw p 
              JOIN reconciliation_uploads u ON p.upload_id = u.id 
              WHERE u.account_id = ${accountId}
            )
          )
        GROUP BY t.sku
        ORDER BY total_orders DESC
      `;

  // 2. Daily Trends Query (Prioritizes business order_date, fallback to created_at)
  const dailyQuery = isDateFiltered
    ? sql`
        SELECT 
          TO_CHAR(COALESCE(t.order_date, o.order_date, t.created_at), 'YYYY-MM-DD') AS day_date,
          COALESCE(SUM(t.quantity), 0)::numeric AS orders,
          COALESCE(SUM(COALESCE(o.supplier_discounted_price, t.listing_price, t.total_sale_amount, 0)), 0)::numeric AS revenue,
          COALESCE(SUM(t.payment), 0)::numeric AS settlement,
          COALESCE(SUM(t.profit), 0)::numeric AS profit,
          COALESCE(SUM(t.quantity) FILTER (WHERE LOWER(t.status) = 'return' OR LOWER(t.live_order_status) = 'return'), 0)::numeric AS returns,
          COALESCE(SUM(t.quantity) FILTER (WHERE LOWER(t.status) = 'rto' OR LOWER(t.live_order_status) = 'rto'), 0)::numeric AS rto,
          COALESCE(SUM(t.quantity) FILTER (WHERE LOWER(t.status) = 'delivered' OR LOWER(t.live_order_status) = 'delivered'), 0)::numeric AS delivered
        FROM reconciliation_transactions t
        LEFT JOIN reconciliation_orders_raw o ON t.source_order_id = o.id
        WHERE t.platform = 'Meesho'
          AND (
            t.account_id = ${accountId}
            OR t.source_order_id IN (
              SELECT o2.id FROM reconciliation_orders_raw o2 
              JOIN reconciliation_uploads u ON o2.upload_id = u.id 
              WHERE u.account_id = ${accountId}
            )
            OR t.source_payment_id IN (
              SELECT p.id FROM reconciliation_payments_raw p 
              JOIN reconciliation_uploads u ON p.upload_id = u.id 
              WHERE u.account_id = ${accountId}
            )
          )
          AND COALESCE(t.order_date, o.order_date, t.created_at) >= ${startDate}::timestamp
          AND COALESCE(t.order_date, o.order_date, t.created_at) <= ${endDate}::timestamp
        GROUP BY TO_CHAR(COALESCE(t.order_date, o.order_date, t.created_at), 'YYYY-MM-DD')
        ORDER BY day_date ASC
      `
    : sql`
        SELECT 
          TO_CHAR(COALESCE(t.order_date, o.order_date, t.created_at), 'YYYY-MM-DD') AS day_date,
          COALESCE(SUM(t.quantity), 0)::numeric AS orders,
          COALESCE(SUM(COALESCE(o.supplier_discounted_price, t.listing_price, t.total_sale_amount, 0)), 0)::numeric AS revenue,
          COALESCE(SUM(t.payment), 0)::numeric AS settlement,
          COALESCE(SUM(t.profit), 0)::numeric AS profit,
          COALESCE(SUM(t.quantity) FILTER (WHERE LOWER(t.status) = 'return' OR LOWER(t.live_order_status) = 'return'), 0)::numeric AS returns,
          COALESCE(SUM(t.quantity) FILTER (WHERE LOWER(t.status) = 'rto' OR LOWER(t.live_order_status) = 'rto'), 0)::numeric AS rto,
          COALESCE(SUM(t.quantity) FILTER (WHERE LOWER(t.status) = 'delivered' OR LOWER(t.live_order_status) = 'delivered'), 0)::numeric AS delivered
        FROM reconciliation_transactions t
        LEFT JOIN reconciliation_orders_raw o ON t.source_order_id = o.id
        WHERE t.platform = 'Meesho'
          AND (
            t.account_id = ${accountId}
            OR t.source_order_id IN (
              SELECT o2.id FROM reconciliation_orders_raw o2 
              JOIN reconciliation_uploads u ON o2.upload_id = u.id 
              WHERE u.account_id = ${accountId}
            )
            OR t.source_payment_id IN (
              SELECT p.id FROM reconciliation_payments_raw p 
              JOIN reconciliation_uploads u ON p.upload_id = u.id 
              WHERE u.account_id = ${accountId}
            )
          )
        GROUP BY TO_CHAR(COALESCE(t.order_date, o.order_date, t.created_at), 'YYYY-MM-DD')
        ORDER BY day_date ASC
      `;

  // 3. RM Ads Total (for loss concentration, kept at overall level per Section 33)
  const adsQuery = isDateFiltered
    ? sql`
        SELECT COALESCE(SUM(total_ads_cost), 0)::numeric AS total_ads_cost
        FROM reconciliation_rm_ads_raw a
        WHERE a.platform = 'Meesho'
          AND (
            a.account_id = ${accountId}
            OR a.upload_id IN (
              SELECT id FROM reconciliation_uploads WHERE account_id = ${accountId}
            )
          )
          AND (
            (a.deduction_date IS NOT NULL AND a.deduction_date >= ${startDate}::date AND a.deduction_date <= ${endDate}::date)
            OR (a.ad_date IS NOT NULL AND a.ad_date >= ${startDate}::date AND a.ad_date <= ${endDate}::date)
            OR (a.created_at >= ${startDate}::timestamp AND a.created_at <= ${endDate}::timestamp)
          )
      `
    : sql`
        SELECT COALESCE(SUM(total_ads_cost), 0)::numeric AS total_ads_cost
        FROM reconciliation_rm_ads_raw a
        WHERE a.platform = 'Meesho'
          AND (
            a.account_id = ${accountId}
            OR a.upload_id IN (
              SELECT id FROM reconciliation_uploads WHERE account_id = ${accountId}
            )
          )
      `;

  // Execute database queries in parallel
  const [skuRows, dailyRows, adsRes] = await Promise.all([
    skuQuery,
    dailyQuery,
    adsQuery,
  ]);

  const rawAds = Number(adsRes[0]?.total_ads_cost || 0);
  const totalAdsCost = rawAds > 0 ? -rawAds : round2(rawAds);

  // --------------------------------------------------
  // Process SKU Metrics
  // --------------------------------------------------
  const skus: SkuProfitabilityMetric[] = skuRows.map((r: any) => {
    const totalOrders = Math.round(Number(r.total_orders || 0));
    const deliveredOrders = Math.round(Number(r.delivered_orders || 0));
    const shippedOrders = Math.round(Number(r.shipped_orders || 0));
    const exchangeOrders = Math.round(Number(r.exchange_orders || 0));
    const returnOrders = Math.round(Number(r.return_orders || 0));
    const rtoOrders = Math.round(Number(r.rto_orders || 0));
    const cancelOrders = Math.round(Number(r.cancel_orders || 0));
    const netOrders = deliveredOrders + exchangeOrders + returnOrders;

    const revenue = round2(Number(r.revenue || 0));
    const settlementAmount = round2(Number(r.settlement_amount || 0));
    const purchaseCost = -Math.abs(round2(Number(r.purchase_cost || 0)));
    const packagingCost = -Math.abs(round2(Number(r.packaging_cost || 0)));
    const shippingCost = round2(Number(r.shipping_cost || 0));
    const returnShippingCost = round2(Number(r.return_shipping_cost || 0));
    const tcs = round2(Number(r.tcs || 0));
    const tds = round2(Number(r.tds || 0));
    const fixedFee = round2(Number(r.fixed_fee || 0));
    const commission = round2(Number(r.commission || 0));
    const warehousingFee = round2(Number(r.warehousing_fee || 0));
    const claims = round2(Number(r.claims || 0));
    const recoveryFees = round2(Number(r.recovery_fees || 0));
    const profit = round2(Number(r.profit || 0));

    // Rates (Percentage 0-100)
    const deliveredRate = totalOrders > 0 ? round2((deliveredOrders / totalOrders) * 100) : 0;
    const returnRate = totalOrders > 0 ? round2((returnOrders / totalOrders) * 100) : 0;
    const rtoRate = totalOrders > 0 ? round2((rtoOrders / totalOrders) * 100) : 0;

    // Margin = (profit / revenue) * 100 (preserves negative sign, null if revenue is 0)
    const profitMargin = revenue !== 0 ? round2((profit / revenue) * 100) : null;

    // AOV
    const aov = r.aov !== null ? round2(Number(r.aov)) : null;

    return {
      sku: r.sku,
      productName: r.product_name || r.sku,
      category: null,
      totalOrders,
      deliveredOrders,
      shippedOrders,
      exchangeOrders,
      returnOrders,
      rtoOrders,
      cancelOrders,
      netOrders,
      revenue,
      settlementAmount,
      purchaseCost,
      packagingCost,
      shippingCost,
      returnShippingCost,
      adsCost: null, // As required by Section 33: no false SKU-level ads allocation
      recoveryFees,
      claims,
      tcs,
      tds,
      fixedFee,
      commission,
      warehousingFee,
      profit,
      profitMargin,
      aov,
      returnRate,
      rtoRate,
      deliveredRate,
    };
  });

  // --------------------------------------------------
  // Compute Dynamic SKU Rankings (Section 14 & 15)
  // --------------------------------------------------
  let topRevenueSku: SkuProfitabilityMetric | null = null;
  let topProfitSku: SkuProfitabilityMetric | null = null;
  let topOrdersSku: SkuProfitabilityMetric | null = null;
  let worstProfitSku: SkuProfitabilityMetric | null = null;
  let highestReturnSku: SkuProfitabilityMetric | null = null;
  let highestRtoSku: SkuProfitabilityMetric | null = null;

  if (skus.length > 0) {
    // 1. Top Revenue (Highest revenue > 0)
    const sortedByRevenue = [...skus].sort((a, b) => b.revenue - a.revenue);
    topRevenueSku = sortedByRevenue[0] || null;

    // 2. Top Profit (Highest profit)
    const sortedByProfit = [...skus].sort((a, b) => b.profit - a.profit);
    topProfitSku = sortedByProfit[0] || null;

    // 3. Top Orders (Highest totalOrders)
    const sortedByOrders = [...skus].sort((a, b) => b.totalOrders - a.totalOrders);
    topOrdersSku = sortedByOrders[0] || null;

    // 4. Worst Profit (Lowest profit; natural negative first, or lowest profitable)
    worstProfitSku = sortedByProfit[sortedByProfit.length - 1] || null;

    // 5. Highest Return Rate (with at least 1 return and orders > 0)
    const withReturns = skus.filter((s) => s.returnOrders > 0);
    if (withReturns.length > 0) {
      highestReturnSku = [...withReturns].sort((a, b) => b.returnRate - a.returnRate)[0];
    } else {
      highestReturnSku = [...skus].sort((a, b) => b.returnRate - a.returnRate)[0] || null;
    }

    // 6. Highest RTO Rate (with at least 1 RTO and orders > 0)
    const withRto = skus.filter((s) => s.rtoOrders > 0);
    if (withRto.length > 0) {
      highestRtoSku = [...withRto].sort((a, b) => b.rtoRate - a.rtoRate)[0];
    } else {
      highestRtoSku = [...skus].sort((a, b) => b.rtoRate - a.rtoRate)[0] || null;
    }
  }

  const rankings: SkuRankings = {
    topRevenueSku,
    topProfitSku,
    topOrdersSku,
    worstProfitSku,
    highestReturnSku,
    highestRtoSku,
  };

  // --------------------------------------------------
  // Process Daily Financial Trends (Section 19)
  // --------------------------------------------------
  const dailyTrends: DailyFinancialMetric[] = dailyRows.map((d: any) => ({
    date: d.day_date || '',
    orders: Math.round(Number(d.orders || 0)),
    revenue: round2(Number(d.revenue || 0)),
    settlement: round2(Number(d.settlement || 0)),
    profit: round2(Number(d.profit || 0)),
    returns: Math.round(Number(d.returns || 0)),
    rto: Math.round(Number(d.rto || 0)),
    delivered: Math.round(Number(d.delivered || 0)),
  }));

  // --------------------------------------------------
  // Process Loss Concentration (Section 23)
  // Sum deductions across transactions + RM ads
  // --------------------------------------------------
  let totalPurchase = 0;
  let totalPackaging = 0;
  let totalShipping = 0;
  let totalReturnShipping = 0;
  let totalRecovery = 0;
  let totalTcs = 0;
  let totalTds = 0;
  let totalFixedFee = 0;
  let totalCommission = 0;
  let totalWarehousing = 0;

  for (const s of skus) {
    totalPurchase += Math.abs(s.purchaseCost);
    totalPackaging += Math.abs(s.packagingCost);
    totalShipping += Math.abs(s.shippingCost);
    totalReturnShipping += Math.abs(s.returnShippingCost);
    totalRecovery += Math.abs(s.recoveryFees);
    totalTcs += Math.abs(s.tcs);
    totalTds += Math.abs(s.tds);
    totalFixedFee += Math.abs(s.fixedFee);
    totalCommission += Math.abs(s.commission);
    totalWarehousing += Math.abs(s.warehousingFee);
  }

  const totalAds = Math.abs(totalAdsCost);
  const totalDeductions =
    totalPurchase +
    totalPackaging +
    totalShipping +
    totalReturnShipping +
    totalAds +
    totalRecovery +
    totalTcs +
    totalTds +
    totalFixedFee +
    totalCommission +
    totalWarehousing;

  const getPercent = (amount: number) =>
    totalDeductions > 0 ? round2((amount / totalDeductions) * 100) : 0;

  const rawLossItems = [
    { name: 'Purchase Cost (COGS)', amount: -round2(totalPurchase), classification: 'Cost' },
    { name: 'Packaging Cost', amount: -round2(totalPackaging), classification: 'Cost' },
    { name: 'Forward Shipping', amount: -round2(totalShipping), classification: 'Logistics' },
    { name: 'Return Shipping', amount: -round2(totalReturnShipping), classification: 'Logistics' },
    { name: 'RM Ads Spend', amount: -round2(totalAds), classification: 'Marketing' },
    { name: 'Recovery Fees', amount: -round2(totalRecovery), classification: 'Penalty' },
    { name: 'TCS Deductions', amount: -round2(totalTcs), classification: 'Tax' },
    { name: 'TDS Deductions', amount: -round2(totalTds), classification: 'Tax' },
    { name: 'Fixed Platform Fees', amount: -round2(totalFixedFee), classification: 'Fee' },
    { name: 'Meesho Commission', amount: -round2(totalCommission), classification: 'Fee' },
    { name: 'Warehousing Fees', amount: -round2(totalWarehousing), classification: 'Fee' },
  ];

  const lossConcentration: LossConcentrationItem[] = rawLossItems
    .map((item) => ({
      name: item.name,
      amount: item.amount,
      percentage: getPercent(Math.abs(item.amount)),
      classification: item.classification,
    }))
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));

  // --------------------------------------------------
  // 5. Excel Parity: Top 10 Performing Products (Final!A26:B36)
  // --------------------------------------------------
  const topPerformingProducts: TopPerformingProductItem[] = [...skus]
    .sort((a, b) => {
      const orderDiff = b.totalOrders - a.totalOrders;
      if (orderDiff !== 0) return orderDiff;
      const revDiff = b.revenue - a.revenue;
      if (revDiff !== 0) return revDiff;
      return a.sku.localeCompare(b.sku);
    })
    .slice(0, 10)
    .map((s, idx) => ({
      rank: idx + 1,
      sku: s.sku,
      productName: s.productName,
      totalOrders: s.totalOrders,
      deliveredOrders: s.deliveredOrders,
      revenue: s.revenue,
      profit: s.profit,
    }));

  // --------------------------------------------------
  // 6. Excel Parity: Top 10 Returns / RTO (Final!E27:F37 with Selector)
  // --------------------------------------------------
  // A. Combined Returns + RTO
  const combinedList = skus.filter((s) => (s.returnOrders + s.rtoOrders) > 0);
  const combined = [...combinedList].sort((a, b) => {
    const countA = a.returnOrders + a.rtoOrders;
    const countB = b.returnOrders + b.rtoOrders;
    if (countB !== countA) return countB - countA;
    const rateA = a.totalOrders > 0 ? (countA / a.totalOrders) * 100 : 0;
    const rateB = b.totalOrders > 0 ? (countB / b.totalOrders) * 100 : 0;
    if (rateB !== rateA) return rateB - rateA;
    if (b.totalOrders !== a.totalOrders) return b.totalOrders - a.totalOrders;
    return a.sku.localeCompare(b.sku);
  }).slice(0, 10).map((s, idx) => {
    const count = s.returnOrders + s.rtoOrders;
    const rate = s.totalOrders > 0 ? round2((count / s.totalOrders) * 100) : 0;
    return {
      rank: idx + 1,
      sku: s.sku,
      productName: s.productName,
      totalOrders: s.totalOrders,
      returnOrders: s.returnOrders,
      rtoOrders: s.rtoOrders,
      count,
      rate,
    };
  });

  // B. Returns Only
  const returnsOnlyList = skus.filter((s) => s.returnOrders > 0);
  const returnsOnly = [...returnsOnlyList].sort((a, b) => {
    if (b.returnOrders !== a.returnOrders) return b.returnOrders - a.returnOrders;
    if (b.returnRate !== a.returnRate) return b.returnRate - a.returnRate;
    if (b.totalOrders !== a.totalOrders) return b.totalOrders - a.totalOrders;
    return a.sku.localeCompare(b.sku);
  }).slice(0, 10).map((s, idx) => ({
    rank: idx + 1,
    sku: s.sku,
    productName: s.productName,
    totalOrders: s.totalOrders,
    returnOrders: s.returnOrders,
    rtoOrders: s.rtoOrders,
    count: s.returnOrders,
    rate: s.returnRate,
  }));

  // C. RTO Only
  const rtoOnlyList = skus.filter((s) => s.rtoOrders > 0);
  const rtoOnly = [...rtoOnlyList].sort((a, b) => {
    if (b.rtoOrders !== a.rtoOrders) return b.rtoOrders - a.rtoOrders;
    if (b.rtoRate !== a.rtoRate) return b.rtoRate - a.rtoRate;
    if (b.totalOrders !== a.totalOrders) return b.totalOrders - a.totalOrders;
    return a.sku.localeCompare(b.sku);
  }).slice(0, 10).map((s, idx) => ({
    rank: idx + 1,
    sku: s.sku,
    productName: s.productName,
    totalOrders: s.totalOrders,
    returnOrders: s.returnOrders,
    rtoOrders: s.rtoOrders,
    count: s.rtoOrders,
    rate: s.rtoRate,
  }));

  return {
    period: {
      from: startDate,
      to: endDate,
      label,
    },
    skus,
    rankings,
    lossConcentration,
    dailyTrends,
    topReturnsRto: {
      combined,
      returnsOnly,
      rtoOnly,
    },
    topPerformingProducts,
  };
}

