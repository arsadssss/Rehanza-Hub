/**
 * Final Reconciliation Parity & RM Ads Automated Audit Suite
 * 
 * Verifies all 30 points required by the reference specification:
 * Meesho Reconciliation (1).xlsx -> Final & Working Sheet
 */

import 'dotenv/config';
import fs from 'fs';
import openpyxl from 'child_process';
import { sql } from '../db';
import { executeUploadPipeline } from '@/app/api/reconciliation/upload/route';
import { calculateReconciliationFinancials } from './financial-calculator';

const FASHION_ACCOUNT = '1323beea-04db-4d44-a1ca-3ab7a1556f09';
const COSMETICS_ACCOUNT = 'e5839188-7241-4664-b8d6-ca209f3883ea';

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

export async function runParityAuditSuite() {
  console.log('========================================================================');
  console.log('🚀 RUNNING FINAL RECONCILIATION PARITY AUDIT SUITE (EXCEL SOURCE OF TRUTH)');
  console.log('========================================================================\n');

  // 1. Check SKU Cost Master Preservation
  console.log('--- TEST 1: SKU Cost Master Configuration & Verification ---');
  const skus = await sql`
    SELECT sku, cost_price, packaging_cost, cost_status 
    FROM reconciliation_sku_master 
    WHERE account_id = ${FASHION_ACCOUNT};
  `;
  assert(skus.length === 21, 'SKU Cost Master has exactly 21 SKUs', skus.length, 21);

  const [purpleSku] = await sql`
    SELECT sku, cost_price, packaging_cost, cost_status 
    FROM reconciliation_sku_master 
    WHERE sku = 'Color-Purple-3in1' AND account_id = ${FASHION_ACCOUNT};
  `;
  assert(purpleSku !== undefined, 'Color-Purple-3in1 exists in SKU Master');
  assert(Number(purpleSku?.cost_price) === 185.00, 'Color-Purple-3in1 cost price is ₹185.00', Number(purpleSku?.cost_price), 185.00);
  assert(Number(purpleSku?.packaging_cost) === 25.00, 'Color-Purple-3in1 packaging is ₹25.00 (per Excel SKU Pivot Table G3 proof)', Number(purpleSku?.packaging_cost), 25.00);
  assert(purpleSku?.cost_status === 'configured', 'Color-Purple-3in1 cost status is configured');

  const [skyBlueSku] = await sql`
    SELECT sku, cost_price, packaging_cost FROM reconciliation_sku_master 
    WHERE LOWER(sku) = 'sky-blue-mjb-01' AND account_id = ${FASHION_ACCOUNT};
  `;
  assert(Number(skyBlueSku?.cost_price) === 115.00, 'Sky-Blue-Mjb-01 cost price is ₹115.00 (per Excel SKU Pivot Table F17)', Number(skyBlueSku?.cost_price), 115.00);

  const [ttempSku] = await sql`
    SELECT sku, cost_price, packaging_cost, cost_status FROM reconciliation_sku_master 
    WHERE LOWER(sku) = 'ttemp-01' AND account_id = ${FASHION_ACCOUNT};
  `;
  assert(ttempSku?.cost_status === 'pending' || Number(ttempSku?.cost_price) === 0, 'TTemp-01 is unconfigured/pending (per Excel SKU Pivot Table Row 23 blank)');

  // 2. Check Database Raw Row Counts
  console.log('\n--- TEST 2: Source Data Raw Row Counts ---');
  const [ordersRaw] = await sql`SELECT COUNT(*)::int as c FROM reconciliation_orders_raw WHERE account_id = ${FASHION_ACCOUNT};`;
  const [paymentsRaw] = await sql`SELECT COUNT(*)::int as c FROM reconciliation_payments_raw WHERE account_id = ${FASHION_ACCOUNT};`;
  const [adsRaw] = await sql`SELECT COUNT(*)::int as c FROM reconciliation_rm_ads_raw WHERE account_id = ${FASHION_ACCOUNT};`;
  const [transactions] = await sql`SELECT COUNT(*)::int as c FROM reconciliation_transactions WHERE account_id = ${FASHION_ACCOUNT};`;

  assert(ordersRaw.c === 486, 'Raw Orders count is exactly 486', ordersRaw.c, 486);
  assert(paymentsRaw.c === 462, 'Raw Payments count is exactly 462', paymentsRaw.c, 462);
  assert(adsRaw.c === 23, 'Raw RM Ads count is exactly 23', adsRaw.c, 23);
  assert(transactions.c === 486, 'Working Sheet transactions count is exactly 486', transactions.c, 486);

  // 3. Check Financial Parity Metrics
  console.log('\n--- TEST 3: Authoritative Financial Parity Metrics ---');
  const financials = await calculateReconciliationFinancials(FASHION_ACCOUNT, { preset: 'all' });

  // Core Financials
  assert(financials.totalSalesInvoice === 207353.00, 'Total Sales matches Final!A8 (₹207,353.00)', financials.totalSalesInvoice, 207353.00);
  assert(financials.settlementAmount === 48277.17, 'Settlement matches Final!B8 (₹48,277.17)', financials.settlementAmount, 48277.17);
  assert(financials.averageOrderValue === 504.32, 'Average Order Value matches Final!E20 (₹504.32)', financials.averageOrderValue, 504.32);
  assert(financials.gstInputAmount === 37323.54, 'GST Input Amount matches Final!A21 (₹37,323.54)', financials.gstInputAmount, 37323.54);

  // Order Counts
  assert(financials.orders.totalOrders === 486, 'Total Orders matches Final!D8 (486)', financials.orders.totalOrders, 486);
  assert(financials.orders.deliveredOrders === 150, 'Delivered Orders matches Final!E8 (150)', financials.orders.deliveredOrders, 150);
  assert(financials.orders.shippedOrders === 8, 'Shipped Orders matches Final!D10 (8)', financials.orders.shippedOrders, 8);
  assert(financials.orders.exchangeOrders === 0, 'Exchange Orders matches Final!E10 (0)', financials.orders.exchangeOrders, 0);
  assert(financials.orders.returnOrders === 91, 'Return Orders matches Final!D14 (91)', financials.orders.returnOrders, 91);
  assert(financials.orders.rtoOrders === 119, 'RTO Orders matches Final!E14 (119)', financials.orders.rtoOrders, 119);
  assert(financials.orders.cancelOrders === 117, 'Cancel Orders matches Final!D17 (117)', financials.orders.cancelOrders, 117);
  assert(financials.orders.awaitingPayment === 0, 'Awaiting Payment matches Final!E17 (0)', financials.orders.awaitingPayment, 0);
  assert(financials.orders.netOrders === 241, 'Net Orders matches Final!D20 (241)', financials.orders.netOrders, 241);

  // Costs & Deductions
  assert(financials.costs.purchaseCost === -23960.00, 'Purchase Cost matches Final!A11 (-₹23,960.00)', financials.costs.purchaseCost, -23960.00);
  assert(financials.costs.packagingCost === -8605.00, 'Packaging Cost matches Final!B11 (-₹8,605.00)', financials.costs.packagingCost, -8605.00);
  assert(financials.costs.shippingCost === -11179.77, 'Shipping Cost matches Final!A14 (-₹11,179.77)', financials.costs.shippingCost, -11179.77);
  assert(financials.costs.returnShippingCost === -17069.00, 'Return Shipping matches Final!B14 (-₹17,069.00)', financials.costs.returnShippingCost, -17069.00);
  assert(financials.costs.adsCost === -4273.36, 'RM Ads Cost matches Final!G6 (-₹4,273.36)', financials.costs.adsCost, -4273.36);
  assert(financials.costs.claims === 1545.83, 'Claims matches Final!G9 (₹1,545.83)', financials.costs.claims, 1545.83);
  assert(financials.costs.recoveryFees === 0.00, 'Recovery Fees matches Final!H6 (₹0.00)', financials.costs.recoveryFees, 0.00);
  assert(financials.costs.fixedFee === 0.00, 'Fixed Fee matches Final!H9 (₹0.00)', financials.costs.fixedFee, 0.00);
  assert(financials.costs.meeshoCommission === 0.00, 'Commission matches Final!G12 (₹0.00)', financials.costs.meeshoCommission, 0.00);
  assert(financials.costs.warehousingFee === 0.00, 'Warehousing Fee matches Final!H12 (₹0.00)', financials.costs.warehousingFee, 0.00);
  assert(financials.costs.tcs === -319.84, 'TCS matches Final!A17 (-₹319.84)', financials.costs.tcs, -319.84);
  assert(financials.costs.tds === -64.05, 'TDS matches Final!B17 (-₹64.05)', financials.costs.tds, -64.05);
  assert(financials.costs.returnFilingCharge === 111.11, 'Return Filing Charge matches Final!B20 (₹111.11)', financials.costs.returnFilingCharge, 111.11);

  // Settlement & Net Profit
  assert(financials.a24NetCashflow === 11327.70, 'Settle Amount matches Final!A24 (₹11,327.70)', financials.a24NetCashflow, 11327.70);
  assert(financials.finalPayoutNetProfit === 13257.42, 'Final Net Profit matches Final!B3/B23 (₹13,257.42)', financials.finalPayoutNetProfit, 13257.42);

  // 4. Single Upload History Entry Architecture
  console.log('\n--- TEST 4: Single Upload History Entry Architecture ---');
  const uploads = await sql`
    SELECT id, filename, upload_type, total_rows, successful_rows, duplicate_rows, failed_rows, status 
    FROM reconciliation_uploads 
    WHERE account_id = ${FASHION_ACCOUNT} 
    ORDER BY id ASC;
  `;
  for (const u of uploads) {
    const total = Number(u.total_rows);
    const sum = Number(u.successful_rows) + Number(u.duplicate_rows) + Number(u.failed_rows);
    assert(total === sum, `Upload ${u.id} (${u.filename}) accounting satisfies total = imported + duplicate + failed (${total} = ${sum})`, sum, total);
  }

  // 5. RM Ads Duplicate Re-upload Test
  console.log('\n--- TEST 5: Duplicate Re-upload Idempotency ---');
  const adsCsvPath = '/Users/arsad/Downloads/Recon/RM Ads - Sheet1.csv';
  const adsContent = fs.readFileSync(adsCsvPath);
  const adsFile = new File([adsContent], 'RM Ads - Sheet1.csv', { type: 'text/csv' });

  const duplicateAdsResult = await executeUploadPipeline({
    file: adsFile,
    sourceType: 'ads',
    accountId: FASHION_ACCOUNT,
  });

  assert(duplicateAdsResult.success === true, 'Duplicate RM Ads upload succeeds with HTTP 200 equivalent');
  assert(duplicateAdsResult.allDuplicates === true, 'Duplicate RM Ads upload sets allDuplicates: true');
  assert(duplicateAdsResult.stats.importedRows === 0, 'Duplicate RM Ads upload imports 0 rows', duplicateAdsResult.stats.importedRows, 0);
  assert(duplicateAdsResult.stats.duplicateRows === 23, 'Duplicate RM Ads upload skips 23 duplicates', duplicateAdsResult.stats.duplicateRows, 23);
  assert(duplicateAdsResult.stats.failedRows === 0, 'Duplicate RM Ads upload has 0 failures', duplicateAdsResult.stats.failedRows, 0);

  // Verify DB raw count did NOT change
  const [adsRawAfter] = await sql`SELECT COUNT(*)::int as c FROM reconciliation_rm_ads_raw WHERE account_id = ${FASHION_ACCOUNT};`;
  assert(adsRawAfter.c === 23, 'Raw RM Ads count remains strictly 23 after duplicate upload', adsRawAfter.c, 23);

  // Cleanup the duplicate test upload record
  if (duplicateAdsResult.uploadId) {
    await sql`DELETE FROM reconciliation_uploads WHERE id = ${duplicateAdsResult.uploadId};`;
  }

  // 6. Multi-Tenant Account Isolation
  console.log('\n--- TEST 6: Multi-Tenant Account Isolation ---');
  const cosmeticsFinancials = await calculateReconciliationFinancials(COSMETICS_ACCOUNT, { preset: 'all' });
  assert(cosmeticsFinancials.costs.adsCost === 0, 'Cosmetics account does not see Fashion RM Ads cost', cosmeticsFinancials.costs.adsCost, 0);
  assert(cosmeticsFinancials.settlementAmount === 0, 'Cosmetics account does not see Fashion settlements', cosmeticsFinancials.settlementAmount, 0);

  console.log('\n========================================================================');
  console.log(`PARITY AUDIT RESULT: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================================\n');

  if (failed > 0) {
    throw new Error(`Parity audit failed with ${failed} failures.`);
  }

  return { passed, failed };
}

if (typeof require !== 'undefined' && require.main === module) {
  runParityAuditSuite()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
