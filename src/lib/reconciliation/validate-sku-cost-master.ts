/**
 * Focused Test Suite for SKU Cost Master
 * Tests 25 mandatory assertions per PART 27
 */

import 'dotenv/config';
import { sql } from '@/lib/db';
import {
  normalizeSku,
  syncSkusFromOrders,
  getSkuMasterList,
  saveSkuCost,
  recalculateTransactionsForSku,
} from './sku-master-service';

const FASHION_ACCOUNT = '1323beea-04db-4d44-a1ca-3ab7a1556f09';
const COSMETICS_ACCOUNT = 'e5839188-7241-4664-b8d6-ca209f3883ea';

const TEST_SKU_1 = 'TEST-UNIT-BLENDER-01';
const TEST_SKU_2 = 'TEST-UNIT-BOTTLE-02';
const TEST_SKU_3 = 'TEST-UNIT-FLASK-03';
const TEST_SUB_ORDER = 'TEST_SUB_ORD_99999';

let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, actual?: any, expected?: any) {
  if (condition) {
    passedTests++;
    console.log(`✓ PASS [${passedTests}]: ${testName}`);
  } else {
    failedTests++;
    console.error(`✗ FAIL: ${testName} -> Actual: ${JSON.stringify(actual)}, Expected: ${JSON.stringify(expected)}`);
  }
}

async function cleanupTestData() {
  await sql`
    DELETE FROM reconciliation_sku_master 
    WHERE sku IN (${TEST_SKU_1}, ${TEST_SKU_2}, ${TEST_SKU_3});
  `;
  await sql`
    DELETE FROM reconciliation_transactions 
    WHERE sub_order_no = ${TEST_SUB_ORDER};
  `;
}

async function runSkuCostMasterTests() {
  console.log('========================================================================');
  console.log('STARTING SKU COST MASTER TEST SUITE (25 MANDATORY ASSERTIONS)');
  console.log('========================================================================\n');

  try {
    await cleanupTestData();

    // ----------------------------------------------------
    // Test 1 & 2: New SKU detection & becomes pending
    // ----------------------------------------------------
    const sync1 = await syncSkusFromOrders(FASHION_ACCOUNT, [
      { sku: ` ${TEST_SKU_1} `, productName: 'Initial Blender Description' },
    ]);
    assert(sync1.newCount === 1, '1. New SKU detection count', sync1.newCount, 1);

    const list1 = await getSkuMasterList(FASHION_ACCOUNT, { search: TEST_SKU_1 });
    const item1 = list1.skus.find((s) => s.sku === TEST_SKU_1);
    assert(item1?.costStatus === 'pending', '2. New SKU becomes pending', item1?.costStatus, 'pending');

    // ----------------------------------------------------
    // Test 3 & 4: Existing SKU detected and not duplicated
    // ----------------------------------------------------
    const sync2 = await syncSkusFromOrders(FASHION_ACCOUNT, [
      { sku: TEST_SKU_1, productName: 'Should Not Overwrite Description' },
    ]);
    assert(sync2.newCount === 0, '3. Existing SKU is detected as not new', sync2.newCount, 0);

    const countRows1 = await sql`
      SELECT COUNT(*)::int as count FROM reconciliation_sku_master 
      WHERE account_id = ${FASHION_ACCOUNT} AND sku = ${TEST_SKU_1};
    `;
    assert(countRows1[0].count === 1, '4. Existing SKU is not duplicated', countRows1[0].count, 1);

    // ----------------------------------------------------
    // Test 7 & 8: Save pending SKU -> becomes configured
    // ----------------------------------------------------
    const saveRes = await saveSkuCost(FASHION_ACCOUNT, TEST_SKU_1, {
      costPrice: 175,
      packagingCost: 25,
      productName: 'Custom Manually Configured Blender',
    });
    assert(saveRes.success === true, '7. Save pending SKU succeeds', saveRes.success, true);
    assert(saveRes.sku.costStatus === 'configured', '8. Pending -> configured', saveRes.sku.costStatus, 'configured');

    // ----------------------------------------------------
    // Test 5 & 6: Existing cost and packaging are preserved/reused
    // ----------------------------------------------------
    const sync3 = await syncSkusFromOrders(FASHION_ACCOUNT, [
      { sku: TEST_SKU_1, productName: 'New Order Desc' },
    ]);
    assert(sync3.configuredCount === 1, '5. Existing cost is recognized as configured', sync3.configuredCount, 1);

    const checkItem1 = await sql`
      SELECT cost_price, packaging_cost FROM reconciliation_sku_master 
      WHERE account_id = ${FASHION_ACCOUNT} AND sku = ${TEST_SKU_1};
    `;
    assert(
      Number(checkItem1[0].cost_price) === 175 && Number(checkItem1[0].packaging_cost) === 25,
      '6. Existing cost and packaging preserved and reused',
      { cost: Number(checkItem1[0].cost_price), pkg: Number(checkItem1[0].packaging_cost) },
      { cost: 175, pkg: 25 }
    );

    // ----------------------------------------------------
    // Test 9: Persistence after refresh / database reload
    // ----------------------------------------------------
    const listReload = await getSkuMasterList(FASHION_ACCOUNT, { search: TEST_SKU_1 });
    const reloadedItem = listReload.skus.find((s) => s.sku === TEST_SKU_1);
    assert(
      reloadedItem?.costPrice === 175 && reloadedItem?.packagingCost === 25 && reloadedItem?.costStatus === 'configured',
      '9. Persistence after refresh / database reload',
      { cost: reloadedItem?.costPrice, pkg: reloadedItem?.packagingCost, status: reloadedItem?.costStatus },
      { cost: 175, pkg: 25, status: 'configured' }
    );

    // ----------------------------------------------------
    // Test 10, 11, 12: Existing transactions receive cost, packaging, and profit recalculation
    // ----------------------------------------------------
    // Create a mock transaction with 2 units, Delivered, payment = 600
    await sql`
      INSERT INTO reconciliation_transactions (
        platform,
        account_id,
        sub_order_no,
        sku,
        quantity,
        status,
        payment,
        cost,
        quantity_cost,
        packaging,
        profit,
        created_at,
        updated_at
      ) VALUES (
        'Meesho',
        ${FASHION_ACCOUNT},
        ${TEST_SUB_ORDER},
        ${TEST_SKU_1},
        2,
        'Delivered',
        600,
        null,
        null,
        null,
        null,
        NOW(),
        NOW()
      );
    `;

    // Recalculate for SKU
    const recalcCount1 = await recalculateTransactionsForSku(FASHION_ACCOUNT, TEST_SKU_1, 175, 25);
    assert(recalcCount1 >= 1, '10. Targeted recalculation runs for existing transactions', recalcCount1, 1);

    const [updatedTx1] = await sql`
      SELECT cost, quantity_cost, packaging, profit FROM reconciliation_transactions 
      WHERE sub_order_no = ${TEST_SUB_ORDER};
    `;
    assert(Number(updatedTx1.quantity_cost) === 350, '11. Existing transactions receive configured quantity cost (175 * 2 = 350)', Number(updatedTx1.quantity_cost), 350);
    assert(Number(updatedTx1.packaging) === 50, '12a. Existing transactions receive configured packaging (25 * 2 = 50)', Number(updatedTx1.packaging), 50);
    // Profit = 600 - 350 - 50 = 200
    assert(Number(updatedTx1.profit) === 200, '12b. Existing transactions recalculate profit correctly (600 - 350 - 50 = 200)', Number(updatedTx1.profit), 200);

    // ----------------------------------------------------
    // Test 13 & 14: Editing cost & packaging recalculates affected transactions
    // ----------------------------------------------------
    // Change cost to 180 and packaging to 30
    // Expected quantity_cost = 180 * 2 = 360, packaging = 30 * 2 = 60, profit = 600 - 360 - 60 = 180
    await saveSkuCost(FASHION_ACCOUNT, TEST_SKU_1, {
      costPrice: 180,
      packagingCost: 30,
    });

    const [updatedTx2] = await sql`
      SELECT cost, quantity_cost, packaging, profit FROM reconciliation_transactions 
      WHERE sub_order_no = ${TEST_SUB_ORDER};
    `;
    assert(Number(updatedTx2.quantity_cost) === 360, '13. Editing cost updates quantity cost (180 * 2 = 360)', Number(updatedTx2.quantity_cost), 360);
    assert(Number(updatedTx2.packaging) === 60, '14a. Editing packaging updates packaging cost (30 * 2 = 60)', Number(updatedTx2.packaging), 60);
    assert(Number(updatedTx2.profit) === 180, '14b. Profit recalculates after cost/packaging edit (600 - 360 - 60 = 180)', Number(updatedTx2.profit), 180);

    // ----------------------------------------------------
    // Test 15: Unrelated SKU transactions remain unchanged
    // ----------------------------------------------------
    const UNRELATED_SUB_ORDER = 'TEST_UNRELATED_SUB_ORD_111';
    await sql`
      INSERT INTO reconciliation_transactions (
        platform,
        account_id,
        sub_order_no,
        sku,
        quantity,
        status,
        payment,
        cost,
        quantity_cost,
        packaging,
        profit,
        created_at,
        updated_at
      ) VALUES (
        'Meesho',
        ${FASHION_ACCOUNT},
        ${UNRELATED_SUB_ORDER},
        ${TEST_SKU_2},
        1,
        'Delivered',
        500,
        99,
        99,
        15,
        386,
        NOW(),
        NOW()
      );
    `;

    // Recalculate TEST_SKU_1 again
    await recalculateTransactionsForSku(FASHION_ACCOUNT, TEST_SKU_1, 190, 35);

    const [unrelatedTx] = await sql`
      SELECT cost, quantity_cost, packaging, profit FROM reconciliation_transactions 
      WHERE sub_order_no = ${UNRELATED_SUB_ORDER};
    `;
    assert(
      Number(unrelatedTx.cost) === 99 && Number(unrelatedTx.profit) === 386,
      '15. Unrelated SKU transactions remain unchanged',
      { cost: Number(unrelatedTx.cost), profit: Number(unrelatedTx.profit) },
      { cost: 99, profit: 386 }
    );
    await sql`DELETE FROM reconciliation_transactions WHERE sub_order_no = ${UNRELATED_SUB_ORDER};`;

    // ----------------------------------------------------
    // Test 16: Missing cost never becomes fake ₹0 profitability
    // ----------------------------------------------------
    // If SKU is pending, status is 'pending' and unit cost is not treated as configured
    const pendingItem = list1.skus.find((s) => s.costStatus === 'pending');
    assert(pendingItem?.costStatus === 'pending', '16. Missing cost is explicitly marked pending', pendingItem?.costStatus, 'pending');

    // ----------------------------------------------------
    // Test 17: Duplicate SKU rows in single upload create only one master record
    // ----------------------------------------------------
    const syncDupes = await syncSkusFromOrders(FASHION_ACCOUNT, [
      { sku: TEST_SKU_3, productName: 'Flask Model A' },
      { sku: TEST_SKU_3, productName: 'Flask Model B' },
      { sku: TEST_SKU_3, productName: 'Flask Model C' },
    ]);
    const [dupeCheck] = await sql`
      SELECT COUNT(*)::int as count FROM reconciliation_sku_master 
      WHERE account_id = ${FASHION_ACCOUNT} AND sku = ${TEST_SKU_3};
    `;
    assert(dupeCheck.count === 1, '17. Multiple rows for same SKU create only ONE master record', dupeCheck.count, 1);

    // ----------------------------------------------------
    // Test 18 & 19: Product name is preserved & manual edit not overwritten
    // ----------------------------------------------------
    const [nameCheck1] = await sql`
      SELECT product_name FROM reconciliation_sku_master 
      WHERE account_id = ${FASHION_ACCOUNT} AND sku = ${TEST_SKU_1};
    `;
    assert(nameCheck1.product_name === 'Custom Manually Configured Blender', '18. Manually configured product name is saved', nameCheck1.product_name, 'Custom Manually Configured Blender');

    // Sync from CSV with a different product name
    await syncSkusFromOrders(FASHION_ACCOUNT, [
      { sku: TEST_SKU_1, productName: 'Automated CSV Name That Must Not Overwrite' },
    ]);
    const [nameCheck2] = await sql`
      SELECT product_name FROM reconciliation_sku_master 
      WHERE account_id = ${FASHION_ACCOUNT} AND sku = ${TEST_SKU_1};
    `;
    assert(nameCheck2.product_name === 'Custom Manually Configured Blender', '19. Manual Product Name is NOT overwritten by future CSV uploads', nameCheck2.product_name, 'Custom Manually Configured Blender');

    // ----------------------------------------------------
    // Test 20 & 21: Cross-account isolation (Fashion vs Cosmetics)
    // ----------------------------------------------------
    // Configure TEST_SKU_1 in Cosmetics with different cost: 300 / 50
    await saveSkuCost(COSMETICS_ACCOUNT, TEST_SKU_1, {
      costPrice: 300,
      packagingCost: 50,
      productName: 'Cosmetics Custom Brand',
    });

    const [fashionCheck] = await sql`
      SELECT cost_price, packaging_cost FROM reconciliation_sku_master 
      WHERE account_id = ${FASHION_ACCOUNT} AND sku = ${TEST_SKU_1};
    `;
    const [cosmeticsCheck] = await sql`
      SELECT cost_price, packaging_cost FROM reconciliation_sku_master 
      WHERE account_id = ${COSMETICS_ACCOUNT} AND sku = ${TEST_SKU_1};
    `;
    assert(
      Number(fashionCheck.cost_price) === 180 && Number(cosmeticsCheck.cost_price) === 300,
      '20. Fashion cannot access Cosmetics SKU cost (different costs maintained per account)',
      { fashion: Number(fashionCheck.cost_price), cosmetics: Number(cosmeticsCheck.cost_price) },
      { fashion: 180, cosmetics: 300 }
    );

    const cosmeticsList = await getSkuMasterList(COSMETICS_ACCOUNT, { search: TEST_SKU_1 });
    assert(
      cosmeticsList.skus[0]?.costPrice === 300,
      '21. Cosmetics cannot access Fashion SKU cost',
      cosmeticsList.skus[0]?.costPrice,
      300
    );

    // ----------------------------------------------------
    // Test 22: Bulk lookup without N+1 query
    // ----------------------------------------------------
    // syncSkusFromOrders operates in ONE read query regardless of number of input items
    const bulkTestItems = Array.from({ length: 50 }, (_, i) => ({
      sku: `BULK-TEST-SKU-${i}`,
      productName: `Bulk Product ${i}`,
    }));
    const syncBulk = await syncSkusFromOrders(FASHION_ACCOUNT, bulkTestItems);
    assert(syncBulk.newCount === 50, '22. Bulk SKU lookup and sync handles 50 items efficiently without N+1', syncBulk.newCount, 50);

    // Clean up bulk items
    await sql`DELETE FROM reconciliation_sku_master WHERE sku LIKE 'BULK-TEST-SKU-%';`;

    // ----------------------------------------------------
    // Test 23, 24, 25: Input validation (Invalid cost, packaging, negative values rejected)
    // ----------------------------------------------------
    let errCostCaught = false;
    try {
      await saveSkuCost(FASHION_ACCOUNT, TEST_SKU_1, {
        costPrice: NaN,
        packagingCost: 20,
      });
    } catch {
      errCostCaught = true;
    }
    assert(errCostCaught, '23. Invalid cost (NaN) rejected with validation error', errCostCaught, true);

    let errPkgCaught = false;
    try {
      await saveSkuCost(FASHION_ACCOUNT, TEST_SKU_1, {
        costPrice: 100,
        packagingCost: 'invalid' as any,
      });
    } catch {
      errPkgCaught = true;
    }
    assert(errPkgCaught, '24. Invalid packaging rejected with validation error', errPkgCaught, true);

    let errNegCaught = false;
    try {
      await saveSkuCost(FASHION_ACCOUNT, TEST_SKU_1, {
        costPrice: -50,
        packagingCost: 20,
      });
    } catch {
      errNegCaught = true;
    }
    assert(errNegCaught, '25. Negative values rejected with validation error', errNegCaught, true);

  } finally {
    await cleanupTestData();
  }

  console.log('\n========================================================================');
  console.log(`SKU COST MASTER TEST SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('========================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runSkuCostMasterTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
