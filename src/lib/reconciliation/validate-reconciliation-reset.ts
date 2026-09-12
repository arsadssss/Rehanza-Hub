/**
 * Automated Verification Suite for Safe Reconciliation Data Reset
 */

import { sql } from '../db';
import { ReconciliationResetService } from './reset-service';

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, testName: string, detail?: any) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ [PASS]: ${testName}`);
  } else {
    console.error(`  ❌ [FAIL]: ${testName}`);
    if (detail) console.error('     Detail:', detail);
  }
}

async function run() {
  console.log('====================================================');
  console.log('🧪 RUNNING SAFE RECONCILIATION DATA RESET VERIFICATION');
  console.log('====================================================\n');

  const activeAccountId = '1323beea-04db-4d44-a1ca-3ab7a1556f09'; // Fashion account

  // --- Step 1: Pre-Reset Snapshots ---
  console.log('--- Step 1: Pre-Reset Database Verification ---');
  const beforeRecon = await ReconciliationResetService.getDataCounts(activeAccountId);
  console.log('Reconciliation counts before reset:', beforeRecon);

  const [crmOrdersBefore] = await sql`SELECT COUNT(*)::int as c FROM orders;`;
  const [crmReturnsBefore] = await sql`SELECT COUNT(*)::int as c FROM returns;`;
  const [crmTasksBefore] = await sql`SELECT COUNT(*)::int as c FROM tasks;`;
  const [crmExpensesBefore] = await sql`SELECT COUNT(*)::int as c FROM business_expenses;`;
  const [crmPayoutsBefore] = await sql`SELECT COUNT(*)::int as c FROM platform_payouts;`;
  const [crmUsersBefore] = await sql`SELECT COUNT(*)::int as c FROM users;`;
  const [crmAccountsBefore] = await sql`SELECT COUNT(*)::int as c FROM accounts;`;
  const [crmProductsBefore] = await sql`SELECT COUNT(*)::int as c FROM allproducts;`;
  const [crmVariantsBefore] = await sql`SELECT COUNT(*)::int as c FROM product_variants;`;
  const [marketplaceConnBefore] = await sql`SELECT COUNT(*)::int as c FROM marketplace_connections;`;
  const [meeshoOrdersBefore] = await sql`SELECT COUNT(*)::int as c FROM meesho_orders;`;
  const [meeshoNotifsBefore] = await sql`SELECT COUNT(*)::int as c FROM meesho_order_notifications;`;

  // Verify SKU Cost Master before reset
  const [purpleBefore] = await sql`
    SELECT id, sku, cost_price, packaging_cost, packing, cost_status 
    FROM reconciliation_sku_master 
    WHERE account_id = ${activeAccountId} AND sku = 'Color-Purple-3in1';
  `;

  assert(beforeRecon.skuMasterCount === 21, 'SKU Cost Master has exactly 21 SKUs before reset');
  assert(purpleBefore !== undefined, 'Color-Purple-3in1 exists in SKU Cost Master before reset');
  assert(Number(purpleBefore.cost_price) === 185, 'Color-Purple-3in1 cost_price is ₹185 before reset');
  assert(Number(purpleBefore.packaging_cost) === 25, 'Color-Purple-3in1 packaging_cost is ₹25 before reset');

  // --- Step 2: Execute Safe Reset ---
  console.log('\n--- Step 2: Executing Safe Reconciliation Data Reset ---');
  const resetResult = await ReconciliationResetService.resetReconciliationData(activeAccountId);
  assert(resetResult.success === true, 'Reset operation returned success: true');
  console.log('Reset result summary:', {
    deleted: resetResult.deleted,
    skuMasterPreserved: resetResult.skuMasterPreserved,
  });

  // --- Step 3: Verify Reconciliation Tables are Cleared ---
  console.log('\n--- Step 3: Post-Reset Reconciliation Table Verification ---');
  const afterRecon = await ReconciliationResetService.getDataCounts(activeAccountId);
  console.log('Reconciliation counts after reset:', afterRecon);

  assert(afterRecon.ordersRaw === 0, 'reconciliation_orders_raw count is 0');
  assert(afterRecon.paymentsRaw === 0, 'reconciliation_payments_raw count is 0');
  assert(afterRecon.adsRaw === 0, 'reconciliation_rm_ads_raw count is 0');
  assert(afterRecon.transactions === 0, 'reconciliation_transactions count is 0');
  assert(afterRecon.uploads === 0, 'reconciliation_uploads count is 0');
  assert(afterRecon.importErrors === 0, 'reconciliation_import_errors count is 0');
  assert(afterRecon.overrides === 0, 'reconciliation_overrides count is 0');
  assert(afterRecon.runs === 0, 'reconciliation_runs count is 0');

  // --- Step 4: Verify SKU Cost Master is STRICTLY PRESERVED ---
  console.log('\n--- Step 4: SKU Cost Master Preservation Verification ---');
  assert(afterRecon.skuMasterCount === 21, 'SKU Cost Master count remains exactly 21 after reset');

  const [purpleAfter] = await sql`
    SELECT id, sku, cost_price, packaging_cost, packing, cost_status 
    FROM reconciliation_sku_master 
    WHERE account_id = ${activeAccountId} AND sku = 'Color-Purple-3in1';
  `;

  assert(purpleAfter !== undefined, 'Color-Purple-3in1 exists after reset');
  assert(Number(purpleAfter.cost_price) === 185, 'Color-Purple-3in1 cost_price preserved at ₹185');
  assert(Number(purpleAfter.packaging_cost) === 25, 'Color-Purple-3in1 packaging_cost preserved at ₹25');
  assert(Number(purpleAfter.packing) === 25, 'Color-Purple-3in1 default packing preserved at 25');

  // Check all other SKUs still exist
  const allSkusAfter = await sql`
    SELECT COUNT(*)::int as c FROM reconciliation_sku_master WHERE account_id = ${activeAccountId};
  `;
  assert(allSkusAfter[0].c === 21, 'All 21 SKU Cost Master records completely preserved');

  // --- Step 5: Verify CRM Data Integrity (ZERO DELETIONS) ---
  console.log('\n--- Step 5: CRM Data Integrity Verification ---');
  const [crmOrdersAfter] = await sql`SELECT COUNT(*)::int as c FROM orders;`;
  const [crmReturnsAfter] = await sql`SELECT COUNT(*)::int as c FROM returns;`;
  const [crmTasksAfter] = await sql`SELECT COUNT(*)::int as c FROM tasks;`;
  const [crmExpensesAfter] = await sql`SELECT COUNT(*)::int as c FROM business_expenses;`;
  const [crmPayoutsAfter] = await sql`SELECT COUNT(*)::int as c FROM platform_payouts;`;
  const [crmUsersAfter] = await sql`SELECT COUNT(*)::int as c FROM users;`;
  const [crmAccountsAfter] = await sql`SELECT COUNT(*)::int as c FROM accounts;`;
  const [crmProductsAfter] = await sql`SELECT COUNT(*)::int as c FROM allproducts;`;
  const [crmVariantsAfter] = await sql`SELECT COUNT(*)::int as c FROM product_variants;`;
  const [marketplaceConnAfter] = await sql`SELECT COUNT(*)::int as c FROM marketplace_connections;`;
  const [meeshoOrdersAfter] = await sql`SELECT COUNT(*)::int as c FROM meesho_orders;`;
  const [meeshoNotifsAfter] = await sql`SELECT COUNT(*)::int as c FROM meesho_order_notifications;`;

  assert(crmOrdersAfter.c === crmOrdersBefore.c, `CRM orders untouched (${crmOrdersAfter.c})`);
  assert(crmReturnsAfter.c === crmReturnsBefore.c, `CRM returns untouched (${crmReturnsAfter.c})`);
  assert(crmTasksAfter.c === crmTasksBefore.c, `CRM tasks untouched (${crmTasksAfter.c})`);
  assert(crmExpensesAfter.c === crmExpensesBefore.c, `CRM expenses untouched (${crmExpensesAfter.c})`);
  assert(crmPayoutsAfter.c === crmPayoutsBefore.c, `CRM payouts untouched (${crmPayoutsAfter.c})`);
  assert(crmUsersAfter.c === crmUsersBefore.c, `CRM users untouched (${crmUsersAfter.c})`);
  assert(crmAccountsAfter.c === crmAccountsBefore.c, `CRM accounts untouched (${crmAccountsAfter.c})`);
  assert(crmProductsAfter.c === crmProductsBefore.c, `CRM products untouched (${crmProductsAfter.c})`);
  assert(crmVariantsAfter.c === crmVariantsBefore.c, `CRM variants untouched (${crmVariantsAfter.c})`);
  assert(marketplaceConnAfter.c === marketplaceConnBefore.c, `Marketplace connections untouched (${marketplaceConnAfter.c})`);
  assert(meeshoOrdersAfter.c === meeshoOrdersBefore.c, `Meesho orders untouched (${meeshoOrdersAfter.c})`);
  assert(meeshoNotifsAfter.c === meeshoNotifsBefore.c, `Meesho notifications untouched (${meeshoNotifsAfter.c})`);

  // --- Step 6: Verify Summary Views Dynamic Empty State ---
  console.log('\n--- Step 6: Summary Views Dynamic Empty State ---');
  const finSummaryView = await sql`SELECT * FROM reconciliation_financial_summary;`;
  assert(finSummaryView.length === 0, 'reconciliation_financial_summary view returns 0 rows after reset');

  const skuProfitView = await sql`SELECT * FROM reconciliation_sku_profit_summary;`;
  assert(skuProfitView.length === 0, 'reconciliation_sku_profit_summary view returns 0 rows after reset');

  // --- Step 7: Multi-Tenant Isolation Verification ---
  console.log('\n--- Step 7: Multi-Tenant Isolation ---');
  const accounts = await sql`SELECT id, name FROM accounts WHERE id != ${activeAccountId};`;
  for (const acc of accounts) {
    const [accUploads] = await sql`SELECT COUNT(*)::int as c FROM reconciliation_uploads WHERE account_id = ${acc.id};`;
    assert(accUploads.c === 0, `Account ${acc.name} uploads unaffected`);
  }

  console.log('\n====================================================');
  console.log(`📊 RESULTS: ${passedTests} / ${totalTests} assertions passed (${Math.round((passedTests / totalTests) * 100)}%)`);
  console.log('====================================================\n');

  if (passedTests === totalTests) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Validation test failed with exception:', err);
  process.exit(1);
});
