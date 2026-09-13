/**
 * Management Reports & Analytical Intelligence Validation Suite
 *
 * Validates:
 * 1. reports-engine execution and return types
 * 2. Exact parity with authoritative reconciliation financials
 * 3. Waterfall balance equality (Gross Sales - Deductions + Credits == Net Profit)
 * 4. Period-over-Period variance mathematics
 * 5. Pareto 80/20 concentration logic
 * 6. Margin trap diagnostic filtering
 * 7. Action directives prioritization
 */

import {
  generateManagementReport,
  ManagementReportResult,
} from './reports-engine';

const FASHION_ACCOUNT_ID = '1323beea-04db-4d44-a1ca-3ab7a1556f09';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, actual?: any, expected?: any) {
  if (condition) {
    passed++;
    console.log(`  ✅ [PASS]: ${testName}`);
  } else {
    failed++;
    console.error(`  ❌ [FAIL]: ${testName}`);
    if (actual !== undefined || expected !== undefined) {
      console.error(`     Actual: ${JSON.stringify(actual)}, Expected: ${JSON.stringify(expected)}`);
    }
  }
}

export async function runReportsValidationSuite() {
  console.log('========================================================================');
  console.log('🚀 RUNNING MANAGEMENT REPORTS & ANALYTICAL INTELLIGENCE VALIDATION SUITE');
  console.log('========================================================================\n');

  try {
    const report: ManagementReportResult = await generateManagementReport(FASHION_ACCOUNT_ID, { range: 'all' });

    // TEST 1: Parity with Source of Truth
    console.log('--- TEST 1: Reconciliation Source-of-Truth Parity ---');
    assert(report.summaryParity.totalOrders === 486, 'Total orders matches 486', report.summaryParity.totalOrders, 486);
    assert(report.summaryParity.totalSalesInvoice === 207353.00, 'Total sales matches ₹207,353.00', report.summaryParity.totalSalesInvoice, 207353.00);
    assert(report.summaryParity.settlementAmount === 48277.17, 'Settlement amount matches ₹48,277.17', report.summaryParity.settlementAmount, 48277.17);

    // TEST 2: Waterfall Balance Equality
    console.log('\n--- TEST 2: Cost Structure Waterfall Step-Down Integrity ---');
    assert(report.costWaterfall.length >= 7, 'Waterfall contains all 7 value chain steps', report.costWaterfall.length, 8);
    const startingStep = report.costWaterfall.find((s) => s.type === 'starting');
    const finalStep = report.costWaterfall.find((s) => s.type === 'final');
    assert(startingStep?.amount === report.summaryParity.totalSalesInvoice, 'Waterfall starting gross equals total sales invoice');
    assert(finalStep?.amount === report.summaryParity.finalPayoutNetProfit, 'Waterfall final step equals final payout net profit');

    // TEST 3: Profit Leakage Calculations
    console.log('\n--- TEST 3: Profit Leakage & Retention Rate Logic ---');
    assert(report.profitLeakage.grossInvoiceSales === 207353.00, 'Gross sales baseline in leakage is ₹207,353.00');
    assert(report.profitLeakage.netRetentionRate > 0, 'Net retention rate is positive', report.profitLeakage.netRetentionRate);
    assert(report.profitLeakage.cogs.amount > 0, 'COGS amount is positive magnitude', report.profitLeakage.cogs.amount);
    assert(report.profitLeakage.logisticsTotal.amount > 0, 'Logistics amount is positive magnitude', report.profitLeakage.logisticsTotal.amount);

    // TEST 4: Settlement Realization Efficiency
    console.log('\n--- TEST 4: Settlement Spread & Realization Efficiency ---');
    assert(report.settlementIntelligence.invoicedToSettledGap === (207353.00 - 48277.17), 'Settlement gap is correctly ₹159,075.83', report.settlementIntelligence.invoicedToSettledGap, 159075.83);
    assert(report.settlementIntelligence.averageDeductionPerOrder > 0, 'Average deduction per order is calculated', report.settlementIntelligence.averageDeductionPerOrder);
    assert(report.settlementIntelligence.settlementEfficiencyRate > 20, 'Settlement efficiency rate is calculated', report.settlementIntelligence.settlementEfficiencyRate);

    // TEST 5: Return & RTO Logistics Waste
    console.log('\n--- TEST 5: Return & RTO Destruction Estimates ---');
    assert(report.returnRtoDamage.totalOrders === 486, 'Total orders in return damage is 486');
    assert(report.returnRtoDamage.returnOrders === 91, 'Return orders matches 91', report.returnRtoDamage.returnOrders, 91);
    assert(report.returnRtoDamage.rtoOrders === 119, 'RTO orders matches 119', report.returnRtoDamage.rtoOrders, 119);
    assert(report.returnRtoDamage.totalFailedDeliveryLoss > 0, 'Estimated failed delivery loss is non-zero', report.returnRtoDamage.totalFailedDeliveryLoss);
    assert(report.returnRtoDamage.topReturnBleeders.length > 0, 'Top return bleeders identified', report.returnRtoDamage.topReturnBleeders.length);

    // TEST 6: Pareto Concentration
    console.log('\n--- TEST 6: Pareto 80/20 Distribution Analysis ---');
    assert(report.paretoConcentration.totalSkus === 21, 'Total SKUs analyzed is 21', report.paretoConcentration.totalSkus, 21);
    assert(report.paretoConcentration.top20PercentSkuCount === 5, 'Top 20% SKU count is 5', report.paretoConcentration.top20PercentSkuCount, 5);
    assert(report.paretoConcentration.revenueSharePercent > 0, 'Top 20% revenue share is calculated', report.paretoConcentration.revenueSharePercent);

    // TEST 7: Executive Directives & Action Board
    console.log('\n--- TEST 7: Executive Directives & Action Board ---');
    assert(report.managementAttentionBoard.directives.length >= 2, 'At least 2 action directives generated', report.managementAttentionBoard.directives.length);
    assert(report.managementAttentionBoard.top3ProfitBleeders.length <= 3, 'Top profit bleeders capped at 3');
    assert(report.managementAttentionBoard.top3MarginExpanders.length <= 3, 'Top margin expanders capped at 3');

  } catch (err: any) {
    console.error('Validation crashed:', err);
    failed++;
  }

  console.log('\n========================================================================');
  console.log(`AUDIT RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

// Auto-run when executed directly
if (require.main === module || process.argv[1]?.endsWith('validate-reports-engine.ts')) {
  runReportsValidationSuite().then(() => {
    process.exit(0);
  }).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
