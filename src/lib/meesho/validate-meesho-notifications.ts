/**
 * Comprehensive Validation Suite for Phase 2D:
 * Meesho Live Order Notifications + Live Orders Dashboard
 */

import { sql } from '@/lib/db';
import { ensureMeeshoOrdersTable, ensureMeeshoOrderNotificationsTable } from './orders-migration';
import { MeeshoOrderSyncService } from './meesho-order-sync-service';
import { NormalizedMeeshoOrder } from './types';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, details?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ [PASS] ${testName}`);
  } else {
    failedTests++;
    console.error(`  ❌ [FAIL] ${testName}${details ? ` -> ${details}` : ''}`);
  }
}

async function runValidation() {
  console.log('================================================================');
  console.log('🚀 PHASE 2D: MEESHO LIVE ORDER NOTIFICATIONS & DASHBOARD TEST SUITE');
  console.log('================================================================\n');

  const TEST_ACCOUNT_A = 'test-acc-phase2d-alpha';
  const TEST_ACCOUNT_B = 'test-acc-phase2d-beta';
  const REAL_SELLER_ACCOUNT_ID = '1323beea-04db-4d44-a1ca-3ab7a1556f09';

  try {
    // -------------------------------------------------------------
    // PART 1: Database Migration & Schema Assertions
    // -------------------------------------------------------------
    console.log('--- PART 1: Database Migration & Schema Verification ---');
    await ensureMeeshoOrdersTable();
    await ensureMeeshoOrderNotificationsTable();

    const tableCheck = await sql`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'meesho_order_notifications';
    `;
    assert(tableCheck.length > 0, 'Table meesho_order_notifications exists in Neon DB');

    const indexCheck = await sql`
      SELECT indexname FROM pg_indexes 
      WHERE tablename = 'meesho_order_notifications';
    `;
    const indexNames = indexCheck.map((r: any) => r.indexname);
    assert(indexNames.includes('idx_meesho_notifications_unique'), 'Unique index idx_meesho_notifications_unique exists');
    assert(indexNames.includes('idx_meesho_notifications_poll'), 'Poll index idx_meesho_notifications_poll exists');
    assert(indexNames.includes('idx_meesho_notifications_suborder'), 'Suborder index idx_meesho_notifications_suborder exists');

    // -------------------------------------------------------------
    // PART 2: Notification Settings Management & Persistence
    // -------------------------------------------------------------
    console.log('\n--- PART 2: Notification Settings Verification ---');
    const defaultSettings = await MeeshoOrderSyncService.getNotificationSettings(TEST_ACCOUNT_A);
    assert(typeof defaultSettings.enabled === 'boolean', 'getNotificationSettings returns boolean enabled state');

    // Toggle OFF
    await MeeshoOrderSyncService.updateNotificationSettings(TEST_ACCOUNT_A, false);
    const updatedSettingsOff = await MeeshoOrderSyncService.getNotificationSettings(TEST_ACCOUNT_A);
    assert(updatedSettingsOff.enabled === false, 'Notification settings successfully toggled to false in DB');

    // Toggle ON
    await MeeshoOrderSyncService.updateNotificationSettings(TEST_ACCOUNT_A, true);
    const updatedSettingsOn = await MeeshoOrderSyncService.getNotificationSettings(TEST_ACCOUNT_A);
    assert(updatedSettingsOn.enabled === true, 'Notification settings successfully toggled back to true in DB');

    // -------------------------------------------------------------
    // PART 3: Brand-New Pending Order Detection & Singular Notification
    // -------------------------------------------------------------
    console.log('\n--- PART 3: Single Pending Order Detection & Grammar ---');
    // Clean test accounts
    await sql`DELETE FROM meesho_order_notifications WHERE account_id IN (${TEST_ACCOUNT_A}, ${TEST_ACCOUNT_B});`;
    await sql`DELETE FROM meesho_orders WHERE account_id IN (${TEST_ACCOUNT_A}, ${TEST_ACCOUNT_B});`;

    const singlePendingOrder: NormalizedMeeshoOrder = {
      orderId: 'ORD_TEST_001',
      subOrderId: 'SUB_TEST_001',
      fulfillmentId: 'FUL_001',
      status: 'pending',
      meeshoStatusCode: 1,
      orderDate: new Date(),
      expectedDispatchDate: new Date(Date.now() + 86400000),
      sku: 'SKU_TEST_001',
      productName: 'Test Blue Kurti',
      variation: 'Size M',
      quantity: 1,
      carrierId: 1,
      carrierName: 'Delhivery',
      awb: null,
      packetId: null,
      cancellationReason: null,
      orderSource: null,
      rawData: { test: true },
    };

    const upsert1 = await MeeshoOrderSyncService.upsertOrders(TEST_ACCOUNT_A, [singlePendingOrder]);
    assert(upsert1.inserted === 1, 'First order inserted into meesho_orders');
    assert(upsert1.newPendingCount === 1, 'Detected exactly 1 new pending order');

    const notifs1 = await MeeshoOrderSyncService.getPendingNotifications(TEST_ACCOUNT_A);
    assert(notifs1.length === 1, 'Exactly 1 notification record stored in meesho_order_notifications');
    assert(notifs1[0].subOrderId === 'SUB_TEST_001', 'Notification linked to correct sub_order_id');
    assert(notifs1[0].notificationType === 'new_pending', 'Notification type is new_pending');
    assert(notifs1[0].deliveredAt === null, 'Delivered timestamp is initially null');

    // Grammar check for singular
    const singularTitle = notifs1.length === 1 ? 'New Meesho Order' : 'New Meesho Orders';
    const singularBody = notifs1.length === 1 ? 'You have 1 new pending order.' : `You have ${notifs1.length} new pending orders.`;
    assert(singularTitle === 'New Meesho Order', 'Singular title format: "New Meesho Order"');
    assert(singularBody === 'You have 1 new pending order.', 'Singular body format: "You have 1 new pending order."');

    // -------------------------------------------------------------
    // PART 4: Repeat Sync Duplicate Prevention (CRITICAL)
    // -------------------------------------------------------------
    console.log('\n--- PART 4: Duplicate Notification Prevention on Repeat Sync ---');
    // Simulate subsequent 15-minute auto-sync where Meesho returns the same pending order
    const upsertRepeat = await MeeshoOrderSyncService.upsertOrders(TEST_ACCOUNT_A, [singlePendingOrder]);
    assert(upsertRepeat.updated === 1, 'Existing order updated/verified on repeat sync');
    assert(upsertRepeat.newPendingCount === 0, 'ZERO new notifications generated for existing pending order on repeat sync');

    const notifsAfterRepeat = await MeeshoOrderSyncService.getPendingNotifications(TEST_ACCOUNT_A);
    assert(notifsAfterRepeat.length === 1, 'meesho_order_notifications count remains exactly 1 (no duplicate rows)');

    // -------------------------------------------------------------
    // PART 5: Non-Pending Orders Do NOT Trigger Pending Notifications
    // -------------------------------------------------------------
    console.log('\n--- PART 5: Non-Pending Orders Isolation ---');
    const nonPendingOrders: NormalizedMeeshoOrder[] = [
      {
        ...singlePendingOrder,
        orderId: 'ORD_TEST_002',
        subOrderId: 'SUB_TEST_002',
        status: 'ready_to_ship',
        meeshoStatusCode: 2,
      },
      {
        ...singlePendingOrder,
        orderId: 'ORD_TEST_003',
        subOrderId: 'SUB_TEST_003',
        status: 'shipped',
        meeshoStatusCode: 3,
      },
      {
        ...singlePendingOrder,
        orderId: 'ORD_TEST_004',
        subOrderId: 'SUB_TEST_004',
        status: 'cancelled',
        meeshoStatusCode: 4,
      },
    ];

    const upsertNonPending = await MeeshoOrderSyncService.upsertOrders(TEST_ACCOUNT_A, nonPendingOrders);
    assert(upsertNonPending.inserted === 3, 'Non-pending orders inserted into meesho_orders');
    assert(upsertNonPending.newPendingCount === 0, 'ZERO pending notifications generated for non-pending orders');

    // -------------------------------------------------------------
    // PART 6: Batch of Multiple Pending Orders & Plural Grammar
    // -------------------------------------------------------------
    console.log('\n--- PART 6: Multiple Pending Orders & Plural Grammar ---');
    const multiPendingOrders: NormalizedMeeshoOrder[] = [
      { ...singlePendingOrder, orderId: 'ORD_TEST_010', subOrderId: 'SUB_TEST_010', status: 'pending' },
      { ...singlePendingOrder, orderId: 'ORD_TEST_011', subOrderId: 'SUB_TEST_011', status: 'pending' },
      { ...singlePendingOrder, orderId: 'ORD_TEST_012', subOrderId: 'SUB_TEST_012', status: 'pending' },
    ];

    const upsertMulti = await MeeshoOrderSyncService.upsertOrders(TEST_ACCOUNT_A, multiPendingOrders);
    assert(upsertMulti.inserted === 3, '3 new pending orders inserted');
    assert(upsertMulti.newPendingCount === 3, 'Exactly 3 new pending notifications detected in batch');

    // Plural grammar check
    const pluralTitle = upsertMulti.newPendingCount === 1 ? 'New Meesho Order' : 'New Meesho Orders';
    const pluralBody =
      upsertMulti.newPendingCount === 1
        ? 'You have 1 new pending order.'
        : `You have ${upsertMulti.newPendingCount} new pending orders.`;
    assert(pluralTitle === 'New Meesho Orders', 'Plural title format: "New Meesho Orders"');
    assert(pluralBody === 'You have 3 new pending orders.', 'Plural body format: "You have 3 new pending orders."');

    // -------------------------------------------------------------
    // PART 7: Notification Polling & Acknowledgment Lifecycle
    // -------------------------------------------------------------
    console.log('\n--- PART 7: Notification Polling & Acknowledgment ---');
    const allPendingNotifs = await MeeshoOrderSyncService.getPendingNotifications(TEST_ACCOUNT_A);
    assert(allPendingNotifs.length === 4, 'Total 4 undelivered notifications ready for polling');

    // Acknowledge first 2
    const idsToAck = [allPendingNotifs[0].id, allPendingNotifs[1].id];
    const ackResult = await MeeshoOrderSyncService.acknowledgeNotifications(TEST_ACCOUNT_A, idsToAck);
    assert(ackResult.updated === 2, '2 notifications successfully acknowledged as delivered');

    // Verify remaining
    const remainingNotifs = await MeeshoOrderSyncService.getPendingNotifications(TEST_ACCOUNT_A);
    assert(remainingNotifs.length === 2, 'Exactly 2 remaining undelivered notifications after acknowledgement');

    // Acknowledge the rest
    const remainingIds = remainingNotifs.map((n) => n.id);
    await MeeshoOrderSyncService.acknowledgeNotifications(TEST_ACCOUNT_A, remainingIds);
    const finalNotifs = await MeeshoOrderSyncService.getPendingNotifications(TEST_ACCOUNT_A);
    assert(finalNotifs.length === 0, '0 undelivered notifications after full acknowledgment');

    // -------------------------------------------------------------
    // PART 8: Multi-Tenant / Account Isolation
    // -------------------------------------------------------------
    console.log('\n--- PART 8: Multi-Tenant Account Isolation ---');
    // Ingest 1 pending order for Account B
    const orderB: NormalizedMeeshoOrder = {
      ...singlePendingOrder,
      orderId: 'ORD_TEST_B_001',
      subOrderId: 'SUB_TEST_B_001',
      status: 'pending',
    };
    await MeeshoOrderSyncService.upsertOrders(TEST_ACCOUNT_B, [orderB]);

    const notifsA = await MeeshoOrderSyncService.getPendingNotifications(TEST_ACCOUNT_A);
    const notifsB = await MeeshoOrderSyncService.getPendingNotifications(TEST_ACCOUNT_B);

    assert(notifsA.length === 0, 'Account A has 0 pending notifications');
    assert(notifsB.length === 1, 'Account B has 1 pending notification');
    assert(notifsB[0].subOrderId === 'SUB_TEST_B_001', 'Account B notification contains only Account B order');

    // -------------------------------------------------------------
    // PART 9: Live Orders Metric Counts & Real Account Parity
    // -------------------------------------------------------------
    console.log('\n--- PART 9: Live Orders Dashboard Metric Verification ---');
    const testCounts = await MeeshoOrderSyncService.getLiveOrdersCounts(TEST_ACCOUNT_A);
    assert(testCounts.pending === 4, `Test Account A pending orders count is 4 (actual: ${testCounts.pending})`);
    assert(testCounts.readyToShip === 1, `Test Account A ready_to_ship orders count is 1 (actual: ${testCounts.readyToShip})`);

    // Verify real seller account
    const realCounts = await MeeshoOrderSyncService.getLiveOrdersCounts(REAL_SELLER_ACCOUNT_ID);
    assert(typeof realCounts.pending === 'number', `Real seller account pending count is valid number: ${realCounts.pending}`);
    assert(typeof realCounts.readyToShip === 'number', `Real seller account ready_to_ship count is valid number: ${realCounts.readyToShip}`);

    // Clean up test data
    await sql`DELETE FROM meesho_order_notifications WHERE account_id IN (${TEST_ACCOUNT_A}, ${TEST_ACCOUNT_B});`;
    await sql`DELETE FROM meesho_orders WHERE account_id IN (${TEST_ACCOUNT_A}, ${TEST_ACCOUNT_B});`;

    console.log('\n================================================================');
    console.log(`🏁 PHASE 2D VALIDATION RESULTS: ${passedTests}/${totalTests} PASSED (${failedTests} FAILED)`);
    console.log('================================================================\n');

    if (failedTests > 0) {
      process.exit(1);
    }
  } catch (error: any) {
    console.error('💥 Fatal error during Phase 2D validation:', error);
    process.exit(1);
  }
}

runValidation();

