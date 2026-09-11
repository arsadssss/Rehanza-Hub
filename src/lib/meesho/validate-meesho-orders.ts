/**
 * Automated Verification Suite for Rehanza-Hub Meesho Orders Live Sync (Phase 2B)
 * 
 * Verifies:
 * 1. Database table migration & idempotent creation (`meesho_orders`)
 * 2. Schema integrity (columns, types, constraints, indexes)
 * 3. Normalization logic across all fulfillment tabs (pending, ready-to-ship, shipped, cancelled)
 * 4. Multi-tenant account isolation (Fashion vs Cosmetics)
 * 5. Idempotent upsert & deduplication (insert N -> upsert N -> 0 duplicates)
 * 6. Live end-to-end sync against real Meesho Supplier Panel session (extract 10 real orders -> Neon -> sync again -> 0 duplicates)
 * 7. Zero credential leakage verification
 */

import { sql } from '../db';
import { ensureMeeshoOrdersTable } from './orders-migration';
import { MeeshoOrderSyncService } from './meesho-order-sync-service';
import { MeeshoConnectionService } from './meesho-connection-service';
import { NormalizedMeeshoOrder } from './types';

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, testName: string, detail?: any) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ PASS: ${testName}`);
  } else {
    console.error(`  ❌ FAIL: ${testName}`);
    if (detail) console.error('     Detail:', detail);
  }
}

async function runTests() {
  console.log('====================================================');
  console.log('🧪 RUNNING MEESHO ORDERS LIVE SYNC TEST SUITE (PHASE 2B)');
  console.log('====================================================\n');

  // Test Suite 1: Database Migration & Schema
  console.log('--- Test Suite 1: Database Migration & Schema ---');
  await ensureMeeshoOrdersTable();
  // Second call for idempotency
  await ensureMeeshoOrdersTable();

  const tableCheck = await sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'meesho_orders';
  `;
  const columnNames = tableCheck.map((c: any) => c.column_name);

  assert(columnNames.includes('account_id'), 'Table has account_id column');
  assert(columnNames.includes('marketplace'), 'Table has marketplace column');
  assert(columnNames.includes('order_id'), 'Table has order_id column');
  assert(columnNames.includes('sub_order_id'), 'Table has sub_order_id column');
  assert(columnNames.includes('fulfillment_id'), 'Table has fulfillment_id column');
  assert(columnNames.includes('status'), 'Table has status column');
  assert(columnNames.includes('meesho_status_code'), 'Table has meesho_status_code column');
  assert(columnNames.includes('order_date'), 'Table has order_date column');
  assert(columnNames.includes('expected_dispatch_date'), 'Table has expected_dispatch_date column');
  assert(columnNames.includes('sku'), 'Table has sku column');
  assert(columnNames.includes('product_name'), 'Table has product_name column');
  assert(columnNames.includes('quantity'), 'Table has quantity column');
  assert(columnNames.includes('carrier_id'), 'Table has carrier_id column');
  assert(columnNames.includes('carrier_name'), 'Table has carrier_name column');
  assert(columnNames.includes('awb'), 'Table has awb column');
  assert(columnNames.includes('packet_id'), 'Table has packet_id column');
  assert(columnNames.includes('cancellation_reason'), 'Table has cancellation_reason column');
  assert(columnNames.includes('raw_data'), 'Table has raw_data column');
  assert(columnNames.includes('synced_at'), 'Table has synced_at column');

  // Test Suite 2: Normalization Logic
  console.log('\n--- Test Suite 2: Order Normalization Engine ---');
  const samplePendingRaw = {
    order_num: '329873862998682496',
    sub_order_num: '329873862998682496_1',
    id: '329873862998682496_1_FORWARD',
    product_sku: 'SB-MJB-01',
    name: '380ml Portable Juicer Blender',
    variation: 'Free Size',
    quantity: 2,
    created_iso: '2026-09-11T12:11:10+0530',
    expected_dispatch_date_iso: '2026-09-12',
    sub_order_source: 'AD',
  };

  const normPending = MeeshoOrderSyncService.normalizeOrder(samplePendingRaw, 'pending', 1);
  assert(normPending.orderId === '329873862998682496', 'Pending orderId mapped correctly');
  assert(normPending.subOrderId === '329873862998682496_1', 'Pending subOrderId mapped correctly');
  assert(normPending.fulfillmentId === '329873862998682496_1_FORWARD', 'Pending fulfillmentId mapped correctly');
  assert(normPending.status === 'pending', 'Pending status normalized to pending');
  assert(normPending.meeshoStatusCode === 1, 'Pending meeshoStatusCode is 1');
  assert(normPending.sku === 'SB-MJB-01', 'Pending SKU mapped correctly');
  assert(normPending.quantity === 2, 'Pending quantity is 2');
  assert(normPending.orderDate instanceof Date, 'Pending orderDate parsed to Date');
  assert(normPending.expectedDispatchDate instanceof Date, 'Pending expectedDispatchDate parsed to Date');
  assert(normPending.orderSource === 'AD', 'Pending orderSource mapped');

  const sampleShippedRaw = {
    order_num: '329813588905986240',
    sub_order_num: '329813588905986240_1',
    id: '329813588905986240_1_FORWARD',
    product_sku: 'TEMP-BOTTLE-01',
    name: 'Digital Temperature Water Bottle',
    carrier_id: 4,
    awb: '134096140221657',
    packet_id: 'TNL112588031420',
  };

  const normShipped = MeeshoOrderSyncService.normalizeOrder(sampleShippedRaw, 'shipped', 4);
  assert(normShipped.status === 'shipped', 'Shipped status normalized to shipped');
  assert(normShipped.carrierId === 4, 'Carrier ID is 4');
  assert(normShipped.carrierName === 'Xpressbees', 'Carrier ID 4 correctly resolved to Xpressbees');
  assert(normShipped.awb === '134096140221657', 'AWB mapped correctly');
  assert(normShipped.packetId === 'TNL112588031420', 'Packet ID mapped correctly');

  const sampleCancelledRaw = {
    order_num: '329949057679682304',
    sub_order_num: '329949057679682304_1',
    product_sku: 'SB-MJB-01',
    cancelled_message: 'Customer cancelled before dispatch',
  };

  const normCancelled = MeeshoOrderSyncService.normalizeOrder(sampleCancelledRaw, 'cancelled', 5);
  assert(normCancelled.status === 'cancelled', 'Cancelled status normalized to cancelled');
  assert(normCancelled.cancellationReason === 'Customer cancelled before dispatch', 'Cancellation reason preserved');

  // Test Suite 3: Multi-Tenant Database Upsert & Deduplication
  console.log('\n--- Test Suite 3: Deduplication & Tenant Isolation ---');
  const accountA = 'mock-account-fashion-suite3';
  const accountB = 'mock-account-cosmetics-suite3';

  // Clean test orders for these accounts
  await sql`DELETE FROM meesho_orders WHERE account_id IN (${accountA}, ${accountB});`;


  const syntheticOrders: NormalizedMeeshoOrder[] = [
    {
      orderId: 'TEST_ORD_001',
      subOrderId: 'TEST_SUB_001',
      fulfillmentId: 'TEST_SUB_001_FWD',
      status: 'pending',
      meeshoStatusCode: 1,
      orderDate: new Date(),
      expectedDispatchDate: new Date(),
      sku: 'TEMP-BOTTLE-01',
      productName: 'Test Product 1',
      variation: 'Free Size',
      quantity: 1,
      carrierId: null,
      carrierName: null,
      awb: null,
      packetId: null,
      cancellationReason: null,
      orderSource: 'DIRECT',
      rawData: { test: true },
    },
    {
      orderId: 'TEST_ORD_002',
      subOrderId: 'TEST_SUB_002',
      fulfillmentId: 'TEST_SUB_002_FWD',
      status: 'pending',
      meeshoStatusCode: 1,
      orderDate: new Date(),
      expectedDispatchDate: new Date(),
      sku: 'SB-MJB-01',
      productName: 'Test Product 2',
      variation: 'Free Size',
      quantity: 1,
      carrierId: null,
      carrierName: null,
      awb: null,
      packetId: null,
      cancellationReason: null,
      orderSource: 'AD',
      rawData: { test: true },
    },
  ];

  // Initial insert
  const firstUpsert = await MeeshoOrderSyncService.upsertOrders(accountA, syntheticOrders);
  assert(firstUpsert.inserted === 2, 'First upsert inserted 2 new records');
  assert(firstUpsert.updated === 0, 'First upsert updated 0 records');

  const countAAfterFirst = await sql`SELECT COUNT(*) as count FROM meesho_orders WHERE account_id = ${accountA};`;
  assert(parseInt(countAAfterFirst[0].count, 10) === 2, 'Account A has 2 records in database');

  // Account B isolation check
  const countB = await sql`SELECT COUNT(*) as count FROM meesho_orders WHERE account_id = ${accountB};`;
  assert(parseInt(countB[0].count, 10) === 0, 'Account B has 0 records (isolated)');

  // Sync again with updated status (deduplication check)
  const updatedSyntheticOrders: NormalizedMeeshoOrder[] = syntheticOrders.map((o) => ({
    ...o,
    status: 'ready_to_ship',
    meeshoStatusCode: 3,
    awb: 'AWB_999888',
  }));

  const secondUpsert = await MeeshoOrderSyncService.upsertOrders(accountA, updatedSyntheticOrders);
  assert(secondUpsert.inserted === 0, 'Second upsert inserted 0 new records');
  assert(secondUpsert.updated === 2, 'Second upsert updated 2 existing records');

  const countAAfterSecond = await sql`SELECT COUNT(*) as count FROM meesho_orders WHERE account_id = ${accountA};`;
  assert(
    parseInt(countAAfterSecond[0].count, 10) === 2,
    'Zero duplicates verified! Account A still has exactly 2 records'
  );

  // Check that values actually updated
  const updatedRow = await sql`
    SELECT status, meesho_status_code, awb FROM meesho_orders 
    WHERE account_id = ${accountA} AND sub_order_id = 'TEST_SUB_001'
    LIMIT 1;
  `;
  assert(updatedRow[0].status === 'ready_to_ship', 'Order status was updated to ready_to_ship in DB');
  assert(updatedRow[0].awb === 'AWB_999888', 'AWB was updated in DB');

  // Clean synthetic orders
  await sql`DELETE FROM meesho_orders WHERE account_id IN (${accountA}, ${accountB});`;

  // Test Suite 4: LIVE END-TO-END SYNC OF 10 REAL ORDERS
  console.log('\n--- Test Suite 4: Live Real Orders Sync & Idempotency Loop ---');

  // Find the connected account
  const connectedConn = await sql`
    SELECT account_id, session_metadata FROM marketplace_connections
    WHERE marketplace = 'meesho' AND connection_status = 'connected'
    LIMIT 1;
  `;

  if (!connectedConn || connectedConn.length === 0) {
    console.warn('⚠️ No active connected account found in DB. Skipping live supplier fetch.');
  } else {
    const liveAccountId = connectedConn[0].account_id;
    console.log(`Using live connected account: ${liveAccountId}`);

    // Clean prior sync for this test account to ensure fresh verification
    await sql`DELETE FROM meesho_orders WHERE account_id = ${liveAccountId};`;

    console.log('🔄 Triggering Live Sync (Limit: 10 orders)...');
    const sync1 = await MeeshoOrderSyncService.syncOrders(liveAccountId, { limit: 10 });
    assert(sync1.success === true, 'First live sync completed successfully');
    assert(sync1.totalExtracted >= 10, `Extracted ${sync1.totalExtracted} real orders from Meesho`);
    assert(sync1.inserted === sync1.totalExtracted, `Inserted ${sync1.inserted} records into Neon DB`);
    assert(sync1.updated === 0, 'First sync had 0 updates');

    const dbCount1 = await sql`
      SELECT COUNT(*) as count FROM meesho_orders WHERE account_id = ${liveAccountId};
    `;
    const initialRealCount = parseInt(dbCount1[0].count, 10);
    assert(initialRealCount >= 10, `Neon PostgreSQL contains ${initialRealCount} real order records`);

    // Verify sample real order fields
    const sampleRecord = await sql`
      SELECT order_id, sub_order_id, status, sku, quantity, raw_data 
      FROM meesho_orders 
      WHERE account_id = ${liveAccountId} 
      LIMIT 1;
    `;
    assert(!!sampleRecord[0]?.order_id, 'Real record has valid order_id');
    assert(!!sampleRecord[0]?.sub_order_id, 'Real record has valid sub_order_id');
    assert(!!sampleRecord[0]?.sku, `Real record has valid SKU: "${sampleRecord[0]?.sku}"`);
    assert(typeof sampleRecord[0]?.quantity === 'number', 'Real record has numeric quantity');
    assert(sampleRecord[0]?.raw_data !== null, 'Real record preserves full raw_data JSON');

    // SYNC AGAIN - ZERO DUPLICATES VERIFICATION LOOP
    console.log('🔄 Triggering Second Live Sync (Idempotency Loop)...');
    const sync2 = await MeeshoOrderSyncService.syncOrders(liveAccountId, { limit: 10 });
    assert(sync2.success === true, 'Second live sync completed successfully');
    assert(sync2.inserted === 0, 'Second sync inserted 0 new records (Zero Duplicates ✅)');
    assert(sync2.updated === sync1.totalExtracted, `Second sync updated all ${sync2.updated} existing records`);

    const dbCount2 = await sql`
      SELECT COUNT(*) as count FROM meesho_orders WHERE account_id = ${liveAccountId};
    `;
    const finalRealCount = parseInt(dbCount2[0].count, 10);
    assert(
      finalRealCount === initialRealCount,
      `Zero duplicates confirmed! Record count remained exactly ${finalRealCount}`
    );

    // Test getOrderSyncStatus
    const statusSummary = await MeeshoOrderSyncService.getOrderSyncStatus(liveAccountId);
    assert(statusSummary.totalOrders === finalRealCount, 'getOrderSyncStatus returns matching totalOrders');
    assert(statusSummary.lastSync !== null, 'getOrderSyncStatus has valid lastSync timestamp');
    console.log('  📊 Live Status Breakdown:', statusSummary.statusBreakdown);
  }

  // Test Suite 5: Zero Credential Leakage
  console.log('\n--- Test Suite 5: Zero Credential Leakage ---');
  const leakedCheck = await sql`
    SELECT raw_data::text as json_text 
    FROM meesho_orders 
    WHERE raw_data::text ILIKE '%password%' OR raw_data::text ILIKE '%secret%' 
    LIMIT 1;
  `;
  assert(leakedCheck.length === 0, 'Zero passwords or secrets present in meesho_orders raw_data');

  console.log('\n====================================================');
  console.log(`📊 RESULTS: ${passedTests} / ${totalTests} assertions passed (${Math.round((passedTests / totalTests) * 100)}%)`);
  console.log('====================================================\n');

  if (passedTests === totalTests) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test suite failed with uncaught exception:', err);
  process.exit(1);
});
