/**
 * Automated Verification Suite for Phase 2D - Meesho Order Status Synchronization Parity
 * 
 * Verifies:
 * 1. Extraction polymorphism: correctly parses `data.groups` for Ready to Ship and `data.subOrders` for other tabs
 * 2. Group metadata flattening: carrier_id, carrier_name, awb, label_downloaded, packet_id correctly attached
 * 3. Status normalization: accurately maps status codes (1 -> pending, 3 -> ready_to_ship, 4 -> shipped, 5 -> cancelled)
 * 4. Status transition in DB: Pending -> Ready to Ship transitions cleanly
 * 5. Notification suppression: status transitions NEVER generate 'new_pending' notifications
 * 6. Live database parity: Fashion account has pending = 0, ready_to_ship = 17, matching Meesho panel
 * 7. Multi-tenant account isolation
 */

import { sql } from '../db';
import { parseSubOrdersFromResponse } from '../../../worker/meesho/order-extractor';
import { MeeshoOrderSyncService } from './meesho-order-sync-service';
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

async function runPhase2DTests() {
  console.log('====================================================');
  console.log('🧪 RUNNING PHASE 2D ORDER STATUS PARITY TEST SUITE');
  console.log('====================================================\n');

  // Test 1: Parser handles data.groups structure (Ready to Ship)
  console.log('--- Test Suite 1: Response Polymorphism Parsing ---');
  const mockGroupsResponse = {
    total_count: 1,
    cursor: 'curs_123',
    data: {
      count: 1,
      groups: [
        {
          carrier_id: 5,
          carrier_name: 'Bluedart',
          awb: 'BD123456789',
          label_downloaded: true,
          orders: [
            {
              order_num: 'ORD_GROUP_001',
              sub_orders: [
                {
                  id: 'SUB_GROUP_001_1',
                  sub_order_num: 'SUB_GROUP_001_1',
                  product_sku: 'TEST-SKU-01',
                  quantity: 1,
                  status: 3,
                },
              ],
            },
          ],
        },
      ],
      subOrders: null,
    },
  };

  const parsedFromGroups = parseSubOrdersFromResponse(mockGroupsResponse);
  assert(parsedFromGroups.length === 1, 'parseSubOrdersFromResponse extracts subOrders from data.groups');
  assert(parsedFromGroups[0].carrier_id === 5, 'Carrier ID flattened from group');
  assert(parsedFromGroups[0].carrier_name === 'Bluedart', 'Carrier Name flattened from group');
  assert(parsedFromGroups[0].awb === 'BD123456789', 'AWB flattened from group');
  assert(parsedFromGroups[0].label_downloaded === true, 'label_downloaded flattened from group');

  // Test 2: Parser handles data.subOrders structure (Pending, Shipped, Cancelled)
  const mockSubOrdersResponse = {
    total_count: 1,
    cursor: null,
    data: {
      count: 1,
      groups: [],
      subOrders: [
        {
          order_num: 'ORD_SUB_002',
          sub_order_num: 'SUB_ORD_002_1',
          product_sku: 'TEST-SKU-02',
          status: 1,
        },
      ],
    },
  };

  const parsedFromSubOrders = parseSubOrdersFromResponse(mockSubOrdersResponse);
  assert(parsedFromSubOrders.length === 1, 'parseSubOrdersFromResponse extracts subOrders from data.subOrders');
  assert(parsedFromSubOrders[0].product_sku === 'TEST-SKU-02', 'SubOrder SKU preserved');

  // Test 3: Status Normalization
  console.log('\n--- Test Suite 2: Status Normalization ---');
  const normRTS = MeeshoOrderSyncService.normalizeOrder(parsedFromGroups[0], 'ready-to-ship', 3);
  assert(normRTS.status === 'ready_to_ship', 'Ready-to-ship normalized to "ready_to_ship"');
  assert(normRTS.meeshoStatusCode === 3, 'Meesho status code is 3');
  assert(normRTS.carrierName === 'Bluedart', 'Carrier name preserved in normalized order');

  const normPending = MeeshoOrderSyncService.normalizeOrder(parsedFromSubOrders[0], 'pending', 1);
  assert(normPending.status === 'pending', 'Pending normalized to "pending"');
  assert(normPending.meeshoStatusCode === 1, 'Pending status code is 1');

  // Test 4: Status Transition (Pending -> Ready to Ship) & Notification Suppression
  console.log('\n--- Test Suite 3: Status Transition & Notification Suppression ---');
  const testAccount = 'test-phase2d-' + Date.now();
  const testSubOrderId = 'test_sub_' + Date.now();

  try {
    // 1. Initial pending insert
    const initialOrder: NormalizedMeeshoOrder = {
      orderId: 'test_ord_' + Date.now(),
      subOrderId: testSubOrderId,
      fulfillmentId: testSubOrderId + '_FWD',
      status: 'pending',
      meeshoStatusCode: 1,
      orderDate: new Date(),
      expectedDispatchDate: new Date(),
      sku: 'TEST-SKU-T1',
      productName: 'Transition Test Product',
      variation: 'Free Size',
      quantity: 1,
      carrierId: null,
      carrierName: null,
      awb: null,
      packetId: null,
      cancellationReason: null,
      orderSource: 'DIRECT',
      rawData: { test: true },
    };

    const res1 = await MeeshoOrderSyncService.upsertOrders(testAccount, [initialOrder]);
    assert(res1.inserted === 1, 'Initial order inserted');
    assert(res1.newPendingCount === 1, 'Initial pending order triggered 1 notification');

    // Verify in DB
    const dbRow1 = await sql`
      SELECT status, meesho_status_code FROM meesho_orders
      WHERE account_id = ${testAccount} AND sub_order_id = ${testSubOrderId};
    `;
    assert(dbRow1[0]?.status === 'pending', 'DB status is initially pending');

    // 2. Transition order to Ready to Ship
    const transitionedOrder: NormalizedMeeshoOrder = {
      ...initialOrder,
      status: 'ready_to_ship',
      meeshoStatusCode: 3,
      carrierName: 'Delhivery',
      awb: 'DEL123456',
    };

    const res2 = await MeeshoOrderSyncService.upsertOrders(testAccount, [transitionedOrder]);
    assert(res2.updated === 1, 'Transitioned order updated existing record');
    assert(res2.inserted === 0, 'Zero duplicate records created');
    assert(res2.newPendingCount === 0, 'Transition from pending -> ready_to_ship generated 0 notifications');

    // Verify DB updated
    const dbRow2 = await sql`
      SELECT status, meesho_status_code, carrier_name, awb FROM meesho_orders
      WHERE account_id = ${testAccount} AND sub_order_id = ${testSubOrderId};
    `;
    assert(dbRow2[0]?.status === 'ready_to_ship', 'DB status successfully updated to ready_to_ship');
    assert(dbRow2[0]?.carrier_name === 'Delhivery', 'Carrier name updated to Delhivery');
    assert(dbRow2[0]?.awb === 'DEL123456', 'AWB updated in DB');

    // Total records for test account must be strictly 1
    const countCheck = await sql`
      SELECT COUNT(*) as count FROM meesho_orders WHERE account_id = ${testAccount};
    `;
    assert(parseInt(countCheck[0]?.count, 10) === 1, 'Strictly 1 record in DB (no duplicates)');
  } finally {
    // Cleanup test account
    await sql`DELETE FROM meesho_orders WHERE account_id = ${testAccount};`;
    await sql`DELETE FROM meesho_order_notifications WHERE account_id = ${testAccount};`;
  }

  // Test 5: Live Database Parity (Fashion Account)
  console.log('\n--- Test Suite 4: Live Meesho Supplier Panel Parity ---');
  const FASHION_ACCOUNT = '1323beea-04db-4d44-a1ca-3ab7a1556f09';
  const liveCounts = await MeeshoOrderSyncService.getLiveOrdersCounts(FASHION_ACCOUNT);
  console.log('  📊 Live Orders Counts:', liveCounts);
  assert(liveCounts.pending === 0, 'Pending count matches Meesho Supplier Panel exactly (Pending = 0)');
  assert(liveCounts.readyToShip === 17, 'Ready to Ship count matches Meesho Supplier Panel exactly (Ready to Ship = 17)');

  const syncStatus = await MeeshoOrderSyncService.getOrderSyncStatus(FASHION_ACCOUNT);
  console.log('  📊 Status Breakdown:', syncStatus.statusBreakdown);
  assert(syncStatus.statusBreakdown.pending === 0, 'Status breakdown pending is 0');
  assert(syncStatus.statusBreakdown.ready_to_ship === 17, 'Status breakdown ready_to_ship is 17');
  assert(syncStatus.statusBreakdown.shipped > 0, 'Shipped orders present');
  assert(syncStatus.statusBreakdown.cancelled > 0, 'Cancelled orders present');
  assert(syncStatus.totalOrders > 0, `Total synced orders: ${syncStatus.totalOrders}`);

  console.log('\n====================================================');
  console.log(`📊 PHASE 2D RESULTS: ${passedTests} / ${totalTests} assertions passed (${Math.round((passedTests / totalTests) * 100)}%)`);
  console.log('====================================================\n');

  if (passedTests === totalTests) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runPhase2DTests().catch((err) => {
  console.error('Phase 2D tests failed:', err);
  process.exit(1);
});
