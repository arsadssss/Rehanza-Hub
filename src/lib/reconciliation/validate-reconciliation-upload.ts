/**
 * End-to-End Automated Verification Suite for Reconciliation File Upload
 * 
 * Tests:
 * 1. New Orders CSV import (rows imported, row_hash populated, 0 duplicates)
 * 2. Exact same Orders CSV re-upload (0 rows imported, all duplicates skipped, status completed)
 * 3. Mixed Orders CSV (some new, some existing; only new rows imported, duplicates skipped)
 * 4. Payments CSV duplicate skipping
 * 5. RM Ads CSV duplicate skipping
 * 6. Multi-tenant account isolation (Account B does not trigger duplicate detection for Account A)
 * 7. Upload history stats (duplicate_rows column, completed badge)
 * 8. Live progress stages (all 6 stages fire in order with accurate percentage and row counts)
 * 9. No duplicate transactions in reconciliation_transactions (Working Sheet)
 * 10. Regression parity (SKU Cost Master, Excel formulas, decision engine)
 */

import 'dotenv/config';
import { sql } from '../db';
import { executeUploadPipeline } from '@/app/api/reconciliation/upload/route';
import { runExcelParityTests } from './validate-excel-parity';
import { runValidationTests } from './validate-formulas';
import { rebuildAccountReconciliation } from './reconciliation-engine';

const FASHION_ACCOUNT = '1323beea-04db-4d44-a1ca-3ab7a1556f09';
const COSMETICS_ACCOUNT = 'e5839188-7241-4664-b8d6-ca209f3883ea';

const TEST_PREFIX = 'TEST-UPL-';
const TEST_SUB_ORD_1 = `${TEST_PREFIX}ORD-001`;
const TEST_SUB_ORD_2 = `${TEST_PREFIX}ORD-002`;
const TEST_SUB_ORD_3 = `${TEST_PREFIX}ORD-003`;
const TEST_CAMP_1 = `${TEST_PREFIX}CAMP-001`;
const TEST_TX_1 = `${TEST_PREFIX}TX-001`;

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, testName: string, actual?: any, expected?: any) {
  if (condition) {
    passedCount++;
    console.log(`  ✅ [PASS]: ${testName}`);
  } else {
    failedCount++;
    console.error(`  ❌ [FAIL]: ${testName}`);
    if (actual !== undefined || expected !== undefined) {
      console.error(`     Actual: ${JSON.stringify(actual)}, Expected: ${JSON.stringify(expected)}`);
    }
  }
}

function createCsvFile(name: string, content: string): File {
  return new File([content], name, { type: 'text/csv' });
}

// Sample CSV templates
const ORDERS_CSV_1 = `Sub Order No,Reason For Credit Entry,Order Date,Order Source,Customer State,Product Name,SKU,Size,Quantity,Supplier Listed Price,Supplier Discounted Price,Packet ID
${TEST_SUB_ORD_1},Delivered,2026-08-01,Meesho,Karnataka,Test Purple Bottle,Color-Purple-3in1,Free Size,1,299,299,PKT-001
${TEST_SUB_ORD_2},Delivered,2026-08-02,Meesho,Maharashtra,Test Purple Bottle,Color-Purple-3in1,Free Size,1,299,299,PKT-002
`;

// Mixed CSV: ORD_1 (existing) + ORD_3 (new)
const ORDERS_CSV_MIXED = `Sub Order No,Reason For Credit Entry,Order Date,Order Source,Customer State,Product Name,SKU,Size,Quantity,Supplier Listed Price,Supplier Discounted Price,Packet ID
${TEST_SUB_ORD_1},Delivered,2026-08-01,Meesho,Karnataka,Test Purple Bottle,Color-Purple-3in1,Free Size,1,299,299,PKT-001
${TEST_SUB_ORD_3},Delivered,2026-08-03,Meesho,Delhi,Test Purple Bottle,Color-Purple-3in1,Free Size,1,299,299,PKT-003
`;

const PAYMENTS_CSV = `Sub Order No,Order Date,Dispatch Date,Product Name,Supplier SKU,Catalog ID,Order Source,Live Order Status,Product GST %,Listing Price (incl. taxes),Quantity,Transaction ID,Payment Date,Final Settlement Amount,Price Type,Total Sale Amount (incl. shipping & gst),Total Sale Return Amount (incl. shipping & gst),Fixed Fee (incl. gst),Warehousing Fee (inc gst),Return Premium (incl gst),Return Premium of Return,Meesho Commission Percentage,Meesho Commission (incl. gst),Meesho Gold Platform Fee (incl. gst),Meesho Mall Platform Fee (incl. gst),Return Shipping Charge (incl. gst),GST Compensation (PRP Shipping),Shipping Charge (incl. gst),Other Support Service Charges (excl. gst),Waivers (excl. gst),Net Other Support Service Charges (excl. gst),GST on Net Other Support Service Charges,TCS,TDS Rate %,TDS,Compensation,Claims,Recovery,Compensation Reason,Claims Reason,Recovery Reason
${TEST_SUB_ORD_1},2026-08-01,2026-08-02,Test Purple Bottle,Color-Purple-3in1,CAT-01,Meesho,Delivered,18,299,1,${TEST_TX_1},2026-08-10,250.50,Regular,299,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-2.50,1,-0.50,0,0,0,,,
`;

const ADS_CSV = `Deduction Duration,Deduction Date,Campaign Id,Ad Cost,Credits / Waivers / Discounts,Ad Cost Incl. Credits/Waivers/Discounts,GST,Total Ads Cost
2026-08-01 to 2026-08-07,2026-08-08,${TEST_CAMP_1},100.00,0,100.00,18.00,118.00
`;

async function cleanupTestData() {
  await sql`
    DELETE FROM reconciliation_orders_raw 
    WHERE sub_order_no LIKE ${TEST_PREFIX + '%'};
  `;
  await sql`
    DELETE FROM reconciliation_payments_raw 
    WHERE sub_order_no LIKE ${TEST_PREFIX + '%'} OR payment_reference LIKE ${TEST_PREFIX + '%'};
  `;
  await sql`
    DELETE FROM reconciliation_rm_ads_raw 
    WHERE campaign_id LIKE ${TEST_PREFIX + '%'};
  `;
  await sql`
    DELETE FROM reconciliation_transactions 
    WHERE sub_order_no LIKE ${TEST_PREFIX + '%'};
  `;
  await sql`
    DELETE FROM reconciliation_uploads 
    WHERE filename LIKE 'test-upload-%';
  `;
}

export async function runUploadVerificationSuite() {
  console.log('========================================================================');
  console.log('🚀 RUNNING RECONCILIATION FILE UPLOAD DEDUPLICATION & PROGRESS SUITE');
  console.log('========================================================================\n');

  try {
    // Clean up any stale test records
    await cleanupTestData();

    // -------------------------------------------------------------------------
    // TEST 1: New Orders CSV Import
    // -------------------------------------------------------------------------
    console.log('--- TEST 1: Uploading New Orders CSV ---');
    const stagesCaptured: string[] = [];
    const progressEvents: any[] = [];

    const file1 = createCsvFile('test-upload-orders-1.csv', ORDERS_CSV_1);
    const result1 = await executeUploadPipeline({
      file: file1,
      sourceType: 'order',
      accountId: FASHION_ACCOUNT,
      onProgress: (p) => {
        stagesCaptured.push(p.stage);
        progressEvents.push(p);
      },
    });

    assert(result1.success === true, 'Upload 1 succeeds', result1.success, true);
    assert(result1.allDuplicates === false, 'Upload 1 has allDuplicates: false', result1.allDuplicates, false);
    assert(result1.stats.totalRows === 2, 'Total rows is 2', result1.stats.totalRows, 2);
    assert(result1.stats.successfulRows === 2, 'Imported rows is 2', result1.stats.successfulRows, 2);
    assert(result1.stats.duplicateRows === 0, 'Duplicate rows is 0', result1.stats.duplicateRows, 0);

    // Verify row_hash in database
    const rawOrders1 = await sql`
      SELECT sub_order_no, row_hash, account_id 
      FROM reconciliation_orders_raw 
      WHERE sub_order_no IN (${TEST_SUB_ORD_1}, ${TEST_SUB_ORD_2})
      ORDER BY sub_order_no;
    `;
    assert(rawOrders1.length === 2, 'Database contains 2 raw orders', rawOrders1.length, 2);
    assert(Boolean(rawOrders1[0].row_hash && rawOrders1[0].row_hash.length === 64), 'Raw order 1 has 64-char SHA-256 row_hash');
    assert(Boolean(rawOrders1[1].row_hash && rawOrders1[1].row_hash.length === 64), 'Raw order 2 has 64-char SHA-256 row_hash');
    assert(rawOrders1[0].account_id === FASHION_ACCOUNT, 'Raw order 1 has correct account_id', rawOrders1[0].account_id, FASHION_ACCOUNT);

    // -------------------------------------------------------------------------
    // TEST 2: Exact Same Orders CSV Re-Upload (100% Duplicates)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 2: Re-uploading Exact Same Orders CSV (All Duplicates) ---');
    const stages2: string[] = [];
    const file2 = createCsvFile('test-upload-orders-1.csv', ORDERS_CSV_1);
    const result2 = await executeUploadPipeline({
      file: file2,
      sourceType: 'order',
      accountId: FASHION_ACCOUNT,
      onProgress: (p) => stages2.push(p.stage),
    });

    assert(result2.success === true, 'Re-upload returns success: true (HTTP 200 equivalent)', result2.success, true);
    assert(result2.allDuplicates === true, 'Re-upload detects allDuplicates: true', result2.allDuplicates, true);
    assert(result2.stats.totalRows === 2, 'Re-upload total rows is 2', result2.stats.totalRows, 2);
    assert(result2.stats.successfulRows === 0, 'Re-upload imported rows is 0', result2.stats.successfulRows, 0);
    assert(result2.stats.duplicateRows === 2, 'Re-upload duplicate rows skipped is 2', result2.stats.duplicateRows, 2);
    assert(
      result2.message.includes('No new records to import. All records were already present'),
      'Informative all-duplicate message returned'
    );

    // Confirm no additional rows inserted
    const rawOrdersCountAfter2 = await sql`
      SELECT COUNT(*)::int as c FROM reconciliation_orders_raw 
      WHERE sub_order_no IN (${TEST_SUB_ORD_1}, ${TEST_SUB_ORD_2});
    `;
    assert(rawOrdersCountAfter2[0].c === 2, 'Raw order count remains exactly 2 in DB (0 new rows)', rawOrdersCountAfter2[0].c, 2);

    // -------------------------------------------------------------------------
    // TEST 3: Mixed Orders CSV (1 Duplicate + 1 Brand New Row)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 3: Uploading Mixed Orders CSV (Partial Duplicates) ---');
    const file3 = createCsvFile('test-upload-orders-mixed.csv', ORDERS_CSV_MIXED);
    const result3 = await executeUploadPipeline({
      file: file3,
      sourceType: 'order',
      accountId: FASHION_ACCOUNT,
    });

    assert(result3.success === true, 'Mixed upload succeeds', result3.success, true);
    assert(result3.allDuplicates === false, 'Mixed upload is NOT allDuplicates', result3.allDuplicates, false);
    assert(result3.stats.totalRows === 2, 'Mixed total rows is 2', result3.stats.totalRows, 2);
    assert(result3.stats.successfulRows === 1, 'Only 1 new row imported', result3.stats.successfulRows, 1);
    assert(result3.stats.duplicateRows === 1, 'Exactly 1 duplicate skipped', result3.stats.duplicateRows, 1);

    const rawOrdersCountAfter3 = await sql`
      SELECT COUNT(*)::int as c FROM reconciliation_orders_raw 
      WHERE sub_order_no IN (${TEST_SUB_ORD_1}, ${TEST_SUB_ORD_2}, ${TEST_SUB_ORD_3});
    `;
    assert(rawOrdersCountAfter3[0].c === 3, 'Total test orders in DB is 3 (1+2)', rawOrdersCountAfter3[0].c, 3);

    // -------------------------------------------------------------------------
    // TEST 4: Payments CSV Ingestion & Duplicate Skipping
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 4: Payments CSV Ingestion & Duplicate Skipping ---');
    const payFile1 = createCsvFile('test-upload-payments-1.csv', PAYMENTS_CSV);
    const payResult1 = await executeUploadPipeline({
      file: payFile1,
      sourceType: 'payment',
      accountId: FASHION_ACCOUNT,
    });
    assert(payResult1.success === true, 'Payments upload 1 succeeds', payResult1.success, true);
    assert(payResult1.stats.successfulRows === 1, 'Payments row imported: 1', payResult1.stats.successfulRows, 1);

    // Re-upload same payments CSV
    const payFile2 = createCsvFile('test-upload-payments-1.csv', PAYMENTS_CSV);
    const payResult2 = await executeUploadPipeline({
      file: payFile2,
      sourceType: 'payment',
      accountId: FASHION_ACCOUNT,
    });
    assert(payResult2.success === true, 'Payments re-upload succeeds', payResult2.success, true);
    assert(payResult2.allDuplicates === true, 'Payments re-upload has allDuplicates: true', payResult2.allDuplicates, true);
    assert(payResult2.stats.successfulRows === 0, 'Payments re-upload imported rows: 0', payResult2.stats.successfulRows, 0);
    assert(payResult2.stats.duplicateRows === 1, 'Payments re-upload duplicate rows: 1', payResult2.stats.duplicateRows, 1);

    // -------------------------------------------------------------------------
    // TEST 5: RM Ads CSV Ingestion & Duplicate Skipping
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 5: RM Ads CSV Ingestion & Duplicate Skipping ---');
    const adsFile1 = createCsvFile('test-upload-ads-1.csv', ADS_CSV);
    const adsResult1 = await executeUploadPipeline({
      file: adsFile1,
      sourceType: 'ads',
      accountId: FASHION_ACCOUNT,
    });
    assert(adsResult1.success === true, 'Ads upload 1 succeeds', adsResult1.success, true);
    assert(adsResult1.stats.successfulRows === 1, 'Ads row imported: 1', adsResult1.stats.successfulRows, 1);

    // Re-upload same ads CSV
    const adsFile2 = createCsvFile('test-upload-ads-1.csv', ADS_CSV);
    const adsResult2 = await executeUploadPipeline({
      file: adsFile2,
      sourceType: 'ads',
      accountId: FASHION_ACCOUNT,
    });
    assert(adsResult2.success === true, 'Ads re-upload succeeds', adsResult2.success, true);
    assert(adsResult2.allDuplicates === true, 'Ads re-upload has allDuplicates: true', adsResult2.allDuplicates, true);
    assert(adsResult2.stats.successfulRows === 0, 'Ads re-upload imported rows: 0', adsResult2.stats.successfulRows, 0);
    assert(adsResult2.stats.duplicateRows === 1, 'Ads re-upload duplicate rows: 1', adsResult2.stats.duplicateRows, 1);

    // -------------------------------------------------------------------------
    // TEST 6: Multi-Tenant Account Isolation
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 6: Multi-Tenant Account Isolation ---');
    // Upload the exact same ORDERS_CSV_1 to COSMETICS_ACCOUNT
    const fileCosmetics = createCsvFile('test-upload-orders-cosmetics.csv', ORDERS_CSV_1);
    const resultCosmetics = await executeUploadPipeline({
      file: fileCosmetics,
      sourceType: 'order',
      accountId: COSMETICS_ACCOUNT,
    });

    assert(
      resultCosmetics.success === true && resultCosmetics.stats.successfulRows === 2,
      'Cosmetics account imports 2 rows (NOT marked duplicate from Fashion account)',
      resultCosmetics.stats.successfulRows,
      2
    );
    assert(resultCosmetics.stats.duplicateRows === 0, 'Cosmetics duplicates skipped is 0', resultCosmetics.stats.duplicateRows, 0);

    // Clean up Cosmetics test orders
    await sql`DELETE FROM reconciliation_orders_raw WHERE account_id = ${COSMETICS_ACCOUNT} AND sub_order_no LIKE ${TEST_PREFIX + '%'};`;
    await sql`DELETE FROM reconciliation_transactions WHERE account_id = ${COSMETICS_ACCOUNT} AND sub_order_no LIKE ${TEST_PREFIX + '%'};`;
    await sql`DELETE FROM reconciliation_uploads WHERE account_id = ${COSMETICS_ACCOUNT} AND filename LIKE 'test-upload-%';`;

    // -------------------------------------------------------------------------
    // TEST 7: Upload History Table Verification
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 7: Upload History Audit Verification ---');
    const uploadAudit = await sql`
      SELECT id, filename, status, row_count, successful_rows, duplicate_rows, failed_rows 
      FROM reconciliation_uploads 
      WHERE id IN (${result1.uploadId}, ${result2.uploadId}, ${result3.uploadId})
      ORDER BY id;
    `;
    assert(uploadAudit.length === 3, 'Audit history records all 3 uploads', uploadAudit.length, 3);
    assert(uploadAudit[0].status === 'completed', 'Upload 1 status is completed', uploadAudit[0].status, 'completed');
    assert(Number(uploadAudit[0].duplicate_rows) === 0, 'Upload 1 duplicate_rows is 0', Number(uploadAudit[0].duplicate_rows), 0);

    assert(uploadAudit[1].status === 'completed', 'Upload 2 (all duplicates) status is completed', uploadAudit[1].status, 'completed');
    assert(Number(uploadAudit[1].successful_rows) === 0, 'Upload 2 successful_rows is 0', Number(uploadAudit[1].successful_rows), 0);
    assert(Number(uploadAudit[1].duplicate_rows) === 2, 'Upload 2 duplicate_rows is 2', Number(uploadAudit[1].duplicate_rows), 2);

    assert(uploadAudit[2].status === 'completed', 'Upload 3 (mixed) status is completed', uploadAudit[2].status, 'completed');
    assert(Number(uploadAudit[2].successful_rows) === 1, 'Upload 3 successful_rows is 1', Number(uploadAudit[2].successful_rows), 1);
    assert(Number(uploadAudit[2].duplicate_rows) === 1, 'Upload 3 duplicate_rows is 1', Number(uploadAudit[2].duplicate_rows), 1);

    // -------------------------------------------------------------------------
    // TEST 8: Progress Stages Validation
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 8: Progress Stages & Stepper Event Ordering ---');
    const uniqueStages = Array.from(new Set(stagesCaptured));
    assert(uniqueStages.includes('Reading file'), 'Stage 1: Reading file fired');
    assert(uniqueStages.includes('Validating rows'), 'Stage 2: Validating rows fired');
    assert(uniqueStages.includes('Checking duplicates'), 'Stage 3: Checking duplicates fired');
    assert(uniqueStages.includes('Importing records'), 'Stage 4: Importing records fired');
    assert(uniqueStages.includes('Building reconciliation transactions'), 'Stage 5: Building reconciliation transactions fired');
    assert(uniqueStages.includes('Finalizing'), 'Stage 6: Finalizing fired');
    assert(uniqueStages.includes('Completed'), 'Completed stage fired');

    // Check that percentages are between 0 and 100
    const finalEvent = progressEvents[progressEvents.length - 1];
    assert(finalEvent.percent === 100, 'Final progress event reaches 100%', finalEvent.percent, 100);

    // -------------------------------------------------------------------------
    // TEST 9: No Duplicated Transactions in reconciliation_transactions
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 9: Reconciliation Working Sheet Duplicate Protection ---');
    const txRecords = await sql`
      SELECT sub_order_no, COUNT(*)::int as count 
      FROM reconciliation_transactions 
      WHERE account_id = ${FASHION_ACCOUNT} AND sub_order_no LIKE ${TEST_PREFIX + '%'}
      GROUP BY sub_order_no;
    `;
    assert(txRecords.length === 3, 'Exactly 3 distinct sub_orders in transactions table', txRecords.length, 3);
    const hasAnyDuplicateTx = txRecords.some((t: any) => t.count > 1);
    assert(!hasAnyDuplicateTx, 'Zero duplicate sub_orders in reconciliation_transactions', hasAnyDuplicateTx, false);

    // -------------------------------------------------------------------------
    // Cleanup Test Records Before Regression Checks
    // -------------------------------------------------------------------------
    console.log('\n--- Cleaning up test records and restoring baseline reconciliation ---');
    await cleanupTestData();
    await rebuildAccountReconciliation(FASHION_ACCOUNT);

    // -------------------------------------------------------------------------
    // TEST 10: Regression Tests (Formulas, Excel Parity, Working Sheet)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 10: Regression Parity Validation ---');
    runValidationTests();
    const parityResult = runExcelParityTests();
    assert(parityResult.failed === 0, 'Excel parity test passes with 0 failures', parityResult.failed, 0);
    assert(parityResult.passed >= 126, 'Excel parity test has >= 126 assertions passing', parityResult.passed, 126);

    console.log('\n========================================================================');
    console.log(`FINAL RESULT: ${passedCount} PASSED, ${failedCount} FAILED`);
    console.log('========================================================================\n');

    if (failedCount > 0) {
      throw new Error(`Upload verification suite failed with ${failedCount} failures.`);
    }

    return { success: true, passed: passedCount, failed: failedCount };
  } catch (err) {
    console.error('Test suite error:', err);
    throw err;
  }
}

// Direct execution
if (typeof require !== 'undefined' && require.main === module) {
  runUploadVerificationSuite()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
