/**
 * Formula Validation Script for Meesho Reconciliation (Phase 2A)
 * 
 * Validates the financial calculation formulas against the reference workbook:
 * /Users/arsad/Downloads/Meesho Reconciliation.xlsx (July sample dataset)
 */

import {
  OrderStatusBreakdown,
  FinancialCostMetrics,
  FinancialSummary,
} from './types';

function round2(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

/**
 * Pure calculation logic matching financial-calculator.ts
 */
export function computeFinancialSummaryPure(params: {
  totalSalesInvoice: number;
  rawAdsCost: number;
  returnFilingCharge: number;
  gstRate: number;
  txData: {
    total_orders: number;
    delivered_orders: number;
    shipped_orders: number;
    exchange_orders: number;
    return_orders: number;
    rto_orders: number;
    cancel_orders: number;
    awaiting_payment: number;
    settlement_amount: number;
    purchase_cost: number;
    packaging_cost: number;
    shipping_cost: number;
    return_shipping_cost: number;
    total_tcs: number;
    total_tds: number;
    total_claims: number;
    total_recovery: number;
    total_fixed_fee: number;
    total_commission: number;
    total_warehousing_fee: number;
    average_order_value: number;
    working_sheet_profit_total: number;
    claim_reason?: string | null;
    recovery_reason?: string | null;
  };
  periodLabel?: string;
}): FinancialSummary {
  const { totalSalesInvoice, rawAdsCost, returnFilingCharge, gstRate, txData } = params;

  // Order Counts (SUM of quantity)
  const totalOrders = Math.round(Number(txData.total_orders || 0));
  const deliveredOrders = Math.round(Number(txData.delivered_orders || 0));
  const shippedOrders = Math.round(Number(txData.shipped_orders || 0));
  const exchangeOrders = Math.round(Number(txData.exchange_orders || 0));
  const returnOrders = Math.round(Number(txData.return_orders || 0));
  const rtoOrders = Math.round(Number(txData.rto_orders || 0));
  const cancelOrders = Math.round(Number(txData.cancel_orders || 0));
  const awaitingPayment = Math.round(Number(txData.awaiting_payment || 0));

  // Net Orders: Workbook Final!D20 = SUM(E8+E11+D14+E14+D17)-D17-E14 = Delivered + Exchange + Return
  const netOrders = deliveredOrders + exchangeOrders + returnOrders;

  // Rates (guarding against division by zero)
  const deliveredRate = totalOrders > 0 ? round2((deliveredOrders / totalOrders) * 100) : 0;
  const shippedRate = totalOrders > 0 ? round2((shippedOrders / totalOrders) * 100) : 0;
  const exchangeRate = totalOrders > 0 ? round2((exchangeOrders / totalOrders) * 100) : 0;
  const returnRate = totalOrders > 0 ? round2((returnOrders / totalOrders) * 100) : 0;
  const rtoRate = totalOrders > 0 ? round2((rtoOrders / totalOrders) * 100) : 0;
  const cancelRate = totalOrders > 0 ? round2((cancelOrders / totalOrders) * 100) : 0;

  const orders: OrderStatusBreakdown = {
    totalOrders,
    deliveredOrders,
    deliveredRate,
    shippedOrders,
    shippedRate,
    exchangeOrders,
    exchangeRate,
    returnOrders,
    returnRate,
    rtoOrders,
    rtoRate,
    cancelOrders,
    cancelRate,
    awaitingPayment,
    netOrders,
  };

  const settlementAmount = round2(Number(txData.settlement_amount || 0));

  // Sign convention: Final!A11 = -ABS(SUM(Working Sheet G))
  const purchaseCost = -Math.abs(round2(Number(txData.purchase_cost || 0)));

  // Sign convention: Final!B11 = -ABS(SUM(Working Sheet H))
  const packagingCost = -Math.abs(round2(Number(txData.packaging_cost || 0)));

  // Preserve source signs for fees and taxes
  const shippingCost = round2(Number(txData.shipping_cost || 0));
  const returnShippingCost = round2(Number(txData.return_shipping_cost || 0));
  const tcs = round2(Number(txData.total_tcs || 0));
  const tds = round2(Number(txData.total_tds || 0));
  const claims = round2(Number(txData.total_claims || 0));
  const recoveryFees = round2(Number(txData.total_recovery || 0));
  const fixedFee = round2(Number(txData.total_fixed_fee || 0));
  const meeshoCommission = round2(Number(txData.total_commission || 0));
  const warehousingFee = round2(Number(txData.total_warehousing_fee || 0));

  // Ads Cost: preserve negative sign
  const adsCost = rawAdsCost > 0 ? -rawAdsCost : round2(rawAdsCost);

  const gstInputAmount = round2(totalSalesInvoice * gstRate);
  const averageOrderValue = round2(Number(txData.average_order_value || 0));

  const costs: FinancialCostMetrics = {
    purchaseCost,
    packagingCost,
    shippingCost,
    returnShippingCost,
    tcs,
    tds,
    claims,
    claimReason: txData.claim_reason || null,
    recoveryFees,
    recoveryReason: txData.recovery_reason || null,
    fixedFee,
    meeshoCommission,
    warehousingFee,
    adsCost,
    returnFilingCharge: round2(returnFilingCharge),
  };

  // Workbook Final!A24:
  // A24 = B8 - B20 - (-A11) - (-B11) - (-G6) - (-H6) - (-H9) - (-G12) - (-H12)
  const a24NetCashflow = round2(
    settlementAmount
      - Math.abs(returnFilingCharge)
      - Math.abs(purchaseCost)
      - Math.abs(packagingCost)
      - Math.abs(adsCost)
      - Math.abs(recoveryFees)
      - Math.abs(fixedFee)
      - Math.abs(meeshoCommission)
      - Math.abs(warehousingFee)
  );

  // Workbook Final!A23 / B23:
  // B23 = G9 + (-A17) + (-B17) + A24
  const finalPayoutNetProfit = round2(
    claims
      + Math.abs(tcs)
      + Math.abs(tds)
      + a24NetCashflow
  );

  const orderLevelWorkingSheetProfit = round2(Number(txData.working_sheet_profit_total || 0));

  return {
    period: {
      from: null,
      to: null,
      label: params.periodLabel || 'Test Period',
    },
    totalSalesInvoice: round2(totalSalesInvoice),
    settlementAmount,
    averageOrderValue,
    gstRate,
    gstInputAmount,
    orders,
    costs,
    orderLevelWorkingSheetProfit,
    a24NetCashflow,
    finalPayoutNetProfit,
  };
}

/**
 * Runner function to execute all validation tests
 */
export function runValidationTests() {
  console.log('====================================================');
  console.log('PHASE 2A: RUNNING FINANCIAL CALCULATOR VALIDATION');
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

  // TEST 1: Authoritative August Dataset from Meesho Reconciliation.xlsx
  console.log('--- TEST SUITE 1: Authoritative August Dataset ---');
  const augSummary = computeFinancialSummaryPure({
    totalSalesInvoice: 207353,
    rawAdsCost: -4273.36,
    returnFilingCharge: 111.11,
    gstRate: 0.18,
    periodLabel: 'August 2026',
    txData: {
      total_orders: 486,
      delivered_orders: 150,
      shipped_orders: 8,
      exchange_orders: 0,
      return_orders: 91,
      rto_orders: 119,
      cancel_orders: 117,
      awaiting_payment: 0,
      settlement_amount: 48277.17,
      purchase_cost: 26110,
      packaging_cost: 8620,
      shipping_cost: -11179.77,
      return_shipping_cost: -17069,
      total_tcs: -319.84,
      total_tds: -64.05,
      total_claims: 1545.83,
      total_recovery: 0,
      total_fixed_fee: 0,
      total_commission: 0,
      total_warehousing_fee: 0,
      average_order_value: 504.32,
      working_sheet_profit_total: 17394.77,
    },
  });

  assert(augSummary.totalSalesInvoice === 207353, 'August: Total Sales (Invoice) matches Final!A8', augSummary.totalSalesInvoice, 207353);
  assert(augSummary.settlementAmount === 48277.17, 'August: Settlement Amount matches Final!B8', augSummary.settlementAmount, 48277.17);
  assert(augSummary.orders.totalOrders === 486, 'August: Total Orders matches Final!D8', augSummary.orders.totalOrders, 486);
  assert(augSummary.orders.deliveredOrders === 150, 'August: Delivered Orders matches Final!E8', augSummary.orders.deliveredOrders, 150);
  assert(augSummary.orders.deliveredRate === 30.86, 'August: Delivered Rate matches Final!E9 (30.86%)', augSummary.orders.deliveredRate, 30.86);
  assert(augSummary.orders.shippedOrders === 8, 'August: Shipped Orders matches Final!D11', augSummary.orders.shippedOrders, 8);
  assert(augSummary.orders.shippedRate === 1.65, 'August: Shipped Rate matches Final!D12 (1.65%)', augSummary.orders.shippedRate, 1.65);
  assert(augSummary.orders.exchangeOrders === 0, 'August: Exchange Orders matches Final!E11', augSummary.orders.exchangeOrders, 0);
  assert(augSummary.orders.exchangeRate === 0, 'August: Exchange Rate matches Final!E12 (0%)', augSummary.orders.exchangeRate, 0);
  assert(augSummary.orders.returnOrders === 91, 'August: Return Orders matches Final!D14', augSummary.orders.returnOrders, 91);
  assert(augSummary.orders.returnRate === 18.72, 'August: Return Rate matches Final!D15 (18.72%)', augSummary.orders.returnRate, 18.72);
  assert(augSummary.orders.rtoOrders === 119, 'August: RTO Orders matches Final!E14', augSummary.orders.rtoOrders, 119);
  assert(augSummary.orders.rtoRate === 24.49, 'August: RTO Rate matches Final!E15 (24.49%)', augSummary.orders.rtoRate, 24.49);
  assert(augSummary.orders.cancelOrders === 117, 'August: Cancel Orders matches Final!D17', augSummary.orders.cancelOrders, 117);
  assert(augSummary.orders.cancelRate === 24.07, 'August: Cancel Rate matches Final!D18 (24.07%)', augSummary.orders.cancelRate, 24.07);
  assert(augSummary.orders.netOrders === 241, 'August: Net Orders matches Final!D20 (241)', augSummary.orders.netOrders, 241);
  assert(augSummary.averageOrderValue === 504.32, 'August: AOV matches Final!E20 (₹504.32)', augSummary.averageOrderValue, 504.32);
  assert(augSummary.costs.purchaseCost === -26110, 'August: Purchase Cost negative sign matches Final!A11 (-₹26,110)', augSummary.costs.purchaseCost, -26110);
  assert(augSummary.costs.packagingCost === -8620, 'August: Packaging Cost negative sign matches Final!B11 (-₹8,620)', augSummary.costs.packagingCost, -8620);
  assert(augSummary.costs.shippingCost === -11179.77, 'August: Shipping Cost matches Final!A14 (-₹11,179.77)', augSummary.costs.shippingCost, -11179.77);
  assert(augSummary.costs.returnShippingCost === -17069, 'August: Return Shipping Cost matches Final!B14 (-₹17,069)', augSummary.costs.returnShippingCost, -17069);
  assert(augSummary.costs.tcs === -319.84, 'August: TCS matches Final!A17 (-₹319.84)', augSummary.costs.tcs, -319.84);
  assert(augSummary.costs.tds === -64.05, 'August: TDS matches Final!B17 (-₹64.05)', augSummary.costs.tds, -64.05);
  assert(augSummary.costs.claims === 1545.83, 'August: Claims matches Final!G9 (+₹1,545.83)', augSummary.costs.claims, 1545.83);
  assert(augSummary.costs.recoveryFees === 0, 'August: Recovery Fees matches Final!H6 (0)', augSummary.costs.recoveryFees, 0);
  assert(augSummary.costs.adsCost === -4273.36, 'August: Ads Cost matches Final!G6 (-₹4,273.36)', augSummary.costs.adsCost, -4273.36);
  assert(augSummary.gstInputAmount === 37323.54, 'August: GST Input Amount matches Final!A21 (₹37,323.54)', augSummary.gstInputAmount, 37323.54);
  assert(augSummary.a24NetCashflow === 9162.70, 'August: A24 Net Cashflow matches Final!A24 (₹9,162.70)', augSummary.a24NetCashflow, 9162.70);
  assert(augSummary.finalPayoutNetProfit === 11092.42, 'August: Final Payout / Net Profit matches Final!B23/B3 (₹11,092.42)', augSummary.finalPayoutNetProfit, 11092.42);

  // TEST 2: Reference July Sample Dataset from Workbook
  console.log('\n--- TEST SUITE 2: Workbook July Reference Dataset ---');
  const julySummary = computeFinancialSummaryPure({
    totalSalesInvoice: 470878,
    rawAdsCost: -24295.04,
    returnFilingCharge: 111.11,
    gstRate: 0.18,
    periodLabel: 'July 2026',
    txData: {
      total_orders: 2778, // Working Sheet F quantity sum
      delivered_orders: 567,
      shipped_orders: 5,
      exchange_orders: 6,
      return_orders: 92,
      rto_orders: 447,
      cancel_orders: 338,
      awaiting_payment: 0,
      settlement_amount: 66860.66,
      purchase_cost: 145535,
      packaging_cost: 24460,
      shipping_cost: -29484.69,
      return_shipping_cost: -15427.58,
      total_tcs: -545.05,
      total_tds: -108.99,
      total_claims: 158.61,
      total_recovery: -7191.80,
      total_fixed_fee: 0,
      total_commission: 0,
      total_warehousing_fee: 0,
      average_order_value: 217.89,
      working_sheet_profit_total: -103134.34,
      recovery_reason: 'Return Assurance Program Fees',
    },
  });

  // 1. Total Sales
  assert(julySummary.totalSalesInvoice === 470878, 'Total Sales (Invoice) matches Final!A8', julySummary.totalSalesInvoice, 470878);

  // 2. Settlement Amount
  assert(julySummary.settlementAmount === 66860.66, 'Settlement Amount matches Final!B8', julySummary.settlementAmount, 66860.66);

  // 3. Total Orders (SUM of quantity)
  assert(julySummary.orders.totalOrders === 2778, 'Total Orders = SUM(quantity) matches Final!D8', julySummary.orders.totalOrders, 2778);

  // 4. Delivered Orders & Rate
  assert(julySummary.orders.deliveredOrders === 567, 'Delivered Orders matches Final!E8', julySummary.orders.deliveredOrders, 567);
  assert(julySummary.orders.deliveredRate === 20.41, 'Delivered Rate matches Final!E9 (20.41%)', julySummary.orders.deliveredRate, 20.41);

  // 5. Shipped Orders & Rate
  assert(julySummary.orders.shippedOrders === 5, 'Shipped Orders matches Final!D11', julySummary.orders.shippedOrders, 5);
  assert(julySummary.orders.shippedRate === 0.18, 'Shipped Rate matches Final!D12 (0.18%)', julySummary.orders.shippedRate, 0.18);

  // 6. Exchange Orders & Rate
  assert(julySummary.orders.exchangeOrders === 6, 'Exchange Orders matches Final!E11', julySummary.orders.exchangeOrders, 6);
  assert(julySummary.orders.exchangeRate === 0.22, 'Exchange Rate matches Final!E12 (0.22%)', julySummary.orders.exchangeRate, 0.22);

  // 7. Return Orders & Rate
  assert(julySummary.orders.returnOrders === 92, 'Return Orders matches Final!D14', julySummary.orders.returnOrders, 92);
  assert(julySummary.orders.returnRate === 3.31, 'Return Rate matches Final!D15 (3.31%)', julySummary.orders.returnRate, 3.31);

  // 8. RTO Orders & Rate
  assert(julySummary.orders.rtoOrders === 447, 'RTO Orders matches Final!E14', julySummary.orders.rtoOrders, 447);
  assert(julySummary.orders.rtoRate === 16.09, 'RTO Rate matches Final!E15 (16.09%)', julySummary.orders.rtoRate, 16.09);

  // 9. Cancel Orders & Rate
  assert(julySummary.orders.cancelOrders === 338, 'Cancel Orders matches Final!D17', julySummary.orders.cancelOrders, 338);
  assert(julySummary.orders.cancelRate === 12.17, 'Cancel Rate matches Final!D18 (12.17%)', julySummary.orders.cancelRate, 12.17);

  // 10. Net Orders (Delivered + Exchange + Return)
  assert(julySummary.orders.netOrders === 665, 'Net Orders matches Final!D20 (665)', julySummary.orders.netOrders, 665);

  // 11. Average Order Value
  assert(julySummary.averageOrderValue === 217.89, 'AOV matches Final!E20 (₹217.89)', julySummary.averageOrderValue, 217.89);

  // 12. Purchase Cost & Packaging Sign Convention
  assert(julySummary.costs.purchaseCost === -145535, 'Purchase Cost negative sign matches Final!A11 (-₹1,45,535)', julySummary.costs.purchaseCost, -145535);
  assert(julySummary.costs.packagingCost === -24460, 'Packaging Cost negative sign matches Final!B11 (-₹24,460)', julySummary.costs.packagingCost, -24460);

  // 13. Preserved Source Signs
  assert(julySummary.costs.shippingCost === -29484.69, 'Shipping Cost negative sign matches Final!A14 (-₹29,484.69)', julySummary.costs.shippingCost, -29484.69);
  assert(julySummary.costs.returnShippingCost === -15427.58, 'Return Shipping Cost negative sign matches Final!B14 (-₹15,427.58)', julySummary.costs.returnShippingCost, -15427.58);
  assert(julySummary.costs.tcs === -545.05, 'TCS negative sign matches Final!A17 (-₹545.05)', julySummary.costs.tcs, -545.05);
  assert(julySummary.costs.tds === -108.99, 'TDS negative sign matches Final!B17 (-₹108.99)', julySummary.costs.tds, -108.99);
  assert(julySummary.costs.claims === 158.61, 'Claims positive sign matches Final!G9 (+₹158.61)', julySummary.costs.claims, 158.61);
  assert(julySummary.costs.recoveryFees === -7191.80, 'Recovery Fees negative sign matches Final!H6 (-₹7,191.80)', julySummary.costs.recoveryFees, -7191.80);
  assert(julySummary.costs.adsCost === -24295.04, 'Ads Cost negative sign matches Final!G6 (-₹24,295.04)', julySummary.costs.adsCost, -24295.04);
  assert(julySummary.costs.fixedFee === 0, 'Fixed Fee matches Final!H9 (0)', julySummary.costs.fixedFee, 0);

  // 14. GST Input Amount
  assert(julySummary.gstInputAmount === 84758.04, 'GST Input Amount matches Final!A21 (₹84,758.04)', julySummary.gstInputAmount, 84758.04);

  // 15. A24 Net Cashflow & Final Payout / Net Profit
  assert(julySummary.a24NetCashflow === -134732.29, 'A24 Net Cashflow matches Final!A24 (-₹1,34,732.29)', julySummary.a24NetCashflow, -134732.29);
  assert(julySummary.finalPayoutNetProfit === -133919.64, 'Final Payout / Net Profit matches Final!B23/B3 (-₹1,33,919.64)', julySummary.finalPayoutNetProfit, -133919.64);

  // TEST 2: Zero-Data / Empty Database Handling
  console.log('\n--- TEST SUITE 2: Empty Database / Zero Data Handling ---');
  const emptySummary = computeFinancialSummaryPure({
    totalSalesInvoice: 0,
    rawAdsCost: 0,
    returnFilingCharge: 0,
    gstRate: 0.18,
    periodLabel: 'Empty Account',
    txData: {
      total_orders: 0,
      delivered_orders: 0,
      shipped_orders: 0,
      exchange_orders: 0,
      return_orders: 0,
      rto_orders: 0,
      cancel_orders: 0,
      awaiting_payment: 0,
      settlement_amount: 0,
      purchase_cost: 0,
      packaging_cost: 0,
      shipping_cost: 0,
      return_shipping_cost: 0,
      total_tcs: 0,
      total_tds: 0,
      total_claims: 0,
      total_recovery: 0,
      total_fixed_fee: 0,
      total_commission: 0,
      total_warehousing_fee: 0,
      average_order_value: 0,
      working_sheet_profit_total: 0,
    },
  });

  assert(emptySummary.totalSalesInvoice === 0, 'Empty: Total sales is 0', emptySummary.totalSalesInvoice, 0);
  assert(emptySummary.orders.totalOrders === 0, 'Empty: Total orders is 0', emptySummary.orders.totalOrders, 0);
  assert(emptySummary.orders.deliveredRate === 0, 'Empty: Delivered rate safely returns 0 (no NaN)', emptySummary.orders.deliveredRate, 0);
  assert(emptySummary.orders.cancelRate === 0, 'Empty: Cancel rate safely returns 0 (no NaN)', emptySummary.orders.cancelRate, 0);
  assert(emptySummary.orders.netOrders === 0, 'Empty: Net orders is 0', emptySummary.orders.netOrders, 0);
  assert(emptySummary.averageOrderValue === 0, 'Empty: AOV safely returns 0 (no NaN)', emptySummary.averageOrderValue, 0);
  assert(emptySummary.finalPayoutNetProfit === 0, 'Empty: Net profit safely returns 0', emptySummary.finalPayoutNetProfit, 0);

  console.log('\n====================================================');
  console.log(`VALIDATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    throw new Error(`Validation failed with ${failed} failed assertions.`);
  }
}

// Auto-run when executed directly via node / tsx
if (typeof require !== 'undefined' && require.main === module) {
  runValidationTests();
}

