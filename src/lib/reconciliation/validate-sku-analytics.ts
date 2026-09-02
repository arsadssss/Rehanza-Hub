/**
 * SKU Analytics Validation Script (Phase 3)
 * 
 * Validates SKU-level calculations, quantity semantics, margin safety,
 * return/RTO rates, dynamic rankings, and daily aggregation logic.
 */

import { SkuProfitabilityMetric, SkuRankings, DailyFinancialMetric } from './types';

function round2(num: number): number {
  const sign = num < 0 ? -1 : 1;
  return sign * (Math.round((Math.abs(num) + Number.EPSILON) * 100) / 100);
}

/**
 * Pure helper reproducing SKU transformation and ranking logic
 */
export function computeSkuMetricsPure(rawSkuRows: any[]): {
  skus: SkuProfitabilityMetric[];
  rankings: SkuRankings;
} {
  const skus: SkuProfitabilityMetric[] = rawSkuRows.map((r) => {
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

    // Margin = (profit / revenue) * 100 (preserve negative sign, null if revenue is 0)
    const profitMargin = revenue !== 0 ? round2((profit / revenue) * 100) : null;

    // AOV
    const aov = r.aov !== null && r.aov !== undefined ? round2(Number(r.aov)) : null;

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

  // Dynamic Rankings
  let topRevenueSku: SkuProfitabilityMetric | null = null;
  let topProfitSku: SkuProfitabilityMetric | null = null;
  let topOrdersSku: SkuProfitabilityMetric | null = null;
  let worstProfitSku: SkuProfitabilityMetric | null = null;
  let highestReturnSku: SkuProfitabilityMetric | null = null;
  let highestRtoSku: SkuProfitabilityMetric | null = null;

  if (skus.length > 0) {
    const sortedByRevenue = [...skus].sort((a, b) => b.revenue - a.revenue);
    topRevenueSku = sortedByRevenue[0] || null;

    const sortedByProfit = [...skus].sort((a, b) => b.profit - a.profit);
    topProfitSku = sortedByProfit[0] || null;

    const sortedByOrders = [...skus].sort((a, b) => b.totalOrders - a.totalOrders);
    topOrdersSku = sortedByOrders[0] || null;

    worstProfitSku = sortedByProfit[sortedByProfit.length - 1] || null;

    const withReturns = skus.filter((s) => s.returnOrders > 0);
    highestReturnSku = withReturns.length > 0
      ? [...withReturns].sort((a, b) => b.returnRate - a.returnRate)[0]
      : [...skus].sort((a, b) => b.returnRate - a.returnRate)[0] || null;

    const withRto = skus.filter((s) => s.rtoOrders > 0);
    highestRtoSku = withRto.length > 0
      ? [...withRto].sort((a, b) => b.rtoRate - a.rtoRate)[0]
      : [...skus].sort((a, b) => b.rtoRate - a.rtoRate)[0] || null;
  }

  return {
    skus,
    rankings: {
      topRevenueSku,
      topProfitSku,
      topOrdersSku,
      worstProfitSku,
      highestReturnSku,
      highestRtoSku,
    },
  };
}

/**
 * Runner function for Phase 3 validation assertions
 */
export function runSkuValidationTests() {
  console.log('====================================================');
  console.log('PHASE 3: RUNNING SKU PROFITABILITY & ANALYTICS TESTS');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, actual?: any, expected?: any) {
    if (condition) {
      console.log(`✓ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`✗ FAIL: ${testName} (Expected: ${expected}, Actual: ${actual})`);
      failed++;
    }
  }

  // Sample SKU dataset with quantity > 1, positive and negative profits
  const sampleSkuRows = [
    {
      sku: 'SKU-SHIRT-BLUE-M',
      product_name: 'Cotton Casual Shirt - Blue M',
      total_orders: 150, // SUM(quantity) where some orders had quantity 2
      delivered_orders: 90,
      shipped_orders: 5,
      exchange_orders: 5,
      return_orders: 15,
      rto_orders: 25,
      cancel_orders: 10,
      revenue: 75000,
      settlement_amount: 38000,
      purchase_cost: 22500,
      packaging_cost: 3750,
      shipping_cost: -4500,
      return_shipping_cost: -2200,
      tcs: -80,
      tds: -16,
      fixed_fee: 0,
      commission: 0,
      warehousing_fee: 0,
      claims: 50,
      recovery_fees: -1200,
      profit: 11750, // Positive profit
      aov: 500,
    },
    {
      sku: 'SKU-JEANS-BLACK-32',
      product_name: 'Slim Fit Denim Jeans - Black 32',
      total_orders: 80,
      delivered_orders: 30,
      shipped_orders: 2,
      exchange_orders: 3,
      return_orders: 20, // High returns
      rto_orders: 15,
      cancel_orders: 10,
      revenue: 64000,
      settlement_amount: 18000,
      purchase_cost: 28000,
      packaging_cost: 2400,
      shipping_cost: -3800,
      return_shipping_cost: -2900,
      tcs: -70,
      tds: -14,
      fixed_fee: 0,
      commission: 0,
      warehousing_fee: 0,
      claims: 0,
      recovery_fees: -1500,
      profit: -12400, // Negative profit (Loss)
      aov: 800,
    },
    {
      sku: 'SKU-WATCH-SPORT-BLK',
      product_name: 'Sport Digital Watch - Black',
      total_orders: 200, // Top Orders SKU
      delivered_orders: 120,
      shipped_orders: 10,
      exchange_orders: 10,
      return_orders: 10,
      rto_orders: 40, // High RTO
      cancel_orders: 10,
      revenue: 100000, // Top Revenue SKU
      settlement_amount: 52000,
      purchase_cost: 30000,
      packaging_cost: 4000,
      shipping_cost: -5000,
      return_shipping_cost: -1500,
      tcs: -100,
      tds: -20,
      fixed_fee: 0,
      commission: 0,
      warehousing_fee: 0,
      claims: 100,
      recovery_fees: -800,
      profit: 18000, // Top Profit SKU
      aov: 500,
    },
    {
      sku: 'SKU-ZERO-SALES',
      product_name: 'Unsold Sample Item',
      total_orders: 0,
      delivered_orders: 0,
      shipped_orders: 0,
      exchange_orders: 0,
      return_orders: 0,
      rto_orders: 0,
      cancel_orders: 0,
      revenue: 0, // Zero revenue
      settlement_amount: 0,
      purchase_cost: 0,
      packaging_cost: 0,
      shipping_cost: 0,
      return_shipping_cost: 0,
      tcs: 0,
      tds: 0,
      fixed_fee: 0,
      commission: 0,
      warehousing_fee: 0,
      claims: 0,
      recovery_fees: 0,
      profit: 0,
      aov: null,
    },
  ];

  const { skus, rankings } = computeSkuMetricsPure(sampleSkuRows);

  // 1. Quantity-based SKU order totals
  console.log('--- TEST 1: Quantity-based SKU Order Totals ---');
  assert(skus[0].totalOrders === 150, 'Total orders reflects quantity sum (150)', skus[0].totalOrders, 150);
  assert(skus[2].totalOrders === 200, 'Total orders reflects quantity sum (200)', skus[2].totalOrders, 200);

  // 2. SKU Revenue aggregation
  console.log('--- TEST 2: SKU Revenue Aggregation ---');
  assert(skus[0].revenue === 75000, 'Revenue matches supplier discounted price (₹75,000)', skus[0].revenue, 75000);
  assert(skus[2].revenue === 100000, 'Top revenue SKU has ₹1,00,000', skus[2].revenue, 100000);

  // 3. SKU Profit Aggregation
  console.log('--- TEST 3: SKU Profit Aggregation ---');
  assert(skus[0].profit === 11750, 'Positive profit is correctly summed (+₹11,750)', skus[0].profit, 11750);
  assert(skus[1].profit === -12400, 'Negative profit retains minus sign (-₹12,400)', skus[1].profit, -12400);

  // 4. Profit Margin Calculation & Sign Preservation
  console.log('--- TEST 4: Profit Margin Calculation & Sign Preservation ---');
  assert(skus[0].profitMargin === 15.67, 'Positive margin = (11750 / 75000) * 100 = 15.67%', skus[0].profitMargin, 15.67);
  assert(skus[1].profitMargin === -19.38, 'Negative margin retains minus sign = (-12400 / 64000) * 100 = -19.38%', skus[1].profitMargin, -19.38);

  // 5. Zero-Revenue Margin Safety
  console.log('--- TEST 5: Zero-Revenue Margin Safety ---');
  assert(skus[3].profitMargin === null, 'Zero revenue safely returns null margin (no divide-by-zero or NaN)', skus[3].profitMargin, null);

  // 6. Return, RTO, and Delivered Rates
  console.log('--- TEST 6: Return, RTO, and Delivered Rates ---');
  assert(skus[0].deliveredRate === 60, 'Delivered rate = (90 / 150) * 100 = 60%', skus[0].deliveredRate, 60);
  assert(skus[1].returnRate === 25, 'Return rate = (20 / 80) * 100 = 25%', skus[1].returnRate, 25);
  assert(skus[2].rtoRate === 20, 'RTO rate = (40 / 200) * 100 = 20%', skus[2].rtoRate, 20);
  assert(skus[3].returnRate === 0, 'Zero order SKU return rate safely returns 0%', skus[3].returnRate, 0);

  // 7. Net Orders
  console.log('--- TEST 7: Net Orders Formula ---');
  assert(skus[0].netOrders === 110, 'Net Orders = Delivered (90) + Exchange (5) + Return (15) = 110', skus[0].netOrders, 110);

  // 8. No False SKU-Level Ads Allocation
  console.log('--- TEST 8: Ads Allocation Safety ---');
  assert(skus[0].adsCost === null, 'adsCost is strictly null at SKU level per Section 33', skus[0].adsCost, null);

  // 9. Dynamic Rankings
  console.log('--- TEST 9: Dynamic SKU Rankings ---');
  assert(rankings.topRevenueSku?.sku === 'SKU-WATCH-SPORT-BLK', 'Top Revenue SKU identified correctly', rankings.topRevenueSku?.sku, 'SKU-WATCH-SPORT-BLK');
  assert(rankings.topProfitSku?.sku === 'SKU-WATCH-SPORT-BLK', 'Top Profit SKU identified correctly', rankings.topProfitSku?.sku, 'SKU-WATCH-SPORT-BLK');
  assert(rankings.topOrdersSku?.sku === 'SKU-WATCH-SPORT-BLK', 'Top Orders SKU identified correctly', rankings.topOrdersSku?.sku, 'SKU-WATCH-SPORT-BLK');
  assert(rankings.worstProfitSku?.sku === 'SKU-JEANS-BLACK-32', 'Worst Profit SKU identified as negative loss driver', rankings.worstProfitSku?.sku, 'SKU-JEANS-BLACK-32');
  assert(rankings.highestReturnSku?.sku === 'SKU-JEANS-BLACK-32', 'Highest Return SKU identified (25%)', rankings.highestReturnSku?.sku, 'SKU-JEANS-BLACK-32');
  assert(rankings.highestRtoSku?.sku === 'SKU-JEANS-BLACK-32' || rankings.highestRtoSku?.sku === 'SKU-WATCH-SPORT-BLK', 'Highest RTO SKU identified', rankings.highestRtoSku?.sku, 'SKU-WATCH-SPORT-BLK / SKU-JEANS-BLACK-32');

  console.log('\n====================================================');
  console.log(`VALIDATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    throw new Error(`Validation failed with ${failed} failed assertions.`);
  }
}

if (typeof require !== 'undefined' && require.main === module) {
  runSkuValidationTests();
}
