/**
 * Automated Verification Suite for Phase 2C: Automatic / Continuous Meesho Order Sync
 * 
 * Verifies:
 * 1. Database schema: meesho_sync_history table, columns, and indexes.
 * 2. marketplace_connections auto_sync_enabled column.
 * 3. Connected accounts discovery for scheduler restart recovery.
 * 4. Auto-sync toggle state and schedule status computation.
 * 5. Order ingest pipeline with idempotent upsert and zero duplicates.
 * 6. Audit logging in meesho_sync_history table (started_at, completed_at, status, counts).
 * 7. Concurrency lock (mutex) protection against simultaneous execution.
 * 8. Sync history retrieval and pagination.
 */

import { sql } from '../db';
import { ensureMeeshoSyncHistoryTable, ensureMeeshoOrdersTable } from './orders-migration';
import { ensureMarketplaceConnectionsTable } from './migration';
import { MeeshoOrderSyncService } from './meesho-order-sync-service';
import { MeeshoSyncScheduler } from '../../../worker/meesho/sync-scheduler';
import { MeeshoBrowserManager } from '../../../worker/meesho/browser-manager';
import path from 'path';

let passedAssertions = 0;
let totalAssertions = 0;

function assert(condition: boolean, message: string) {
  totalAssertions++;
  if (condition) {
    passedAssertions++;
    console.log(`  ✅ [PASS] ${message}`);
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function run() {
  console.log('====================================================');
  console.log('🧪 RUNNING PHASE 2C: AUTOMATIC MEESHO ORDER SYNC VERIFICATION');
  console.log('====================================================\n');

  // STEP 1: Database Migration & Schema Verification
  console.log('--- Step 1: Database Schemas & Migrations ---');
  await ensureMarketplaceConnectionsTable();
  await ensureMeeshoOrdersTable();
  await ensureMeeshoSyncHistoryTable();

  // Verify meesho_sync_history columns
  const colRows = await sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'meesho_sync_history'
    ORDER BY ordinal_position;
  `;
  const cols = new Set(colRows.map((r: any) => r.column_name));

  assert(cols.has('id'), 'meesho_sync_history has id column');
  assert(cols.has('sync_id'), 'meesho_sync_history has sync_id column');
  assert(cols.has('account_id'), 'meesho_sync_history has account_id column');
  assert(cols.has('marketplace'), 'meesho_sync_history has marketplace column');
  assert(cols.has('sync_type'), 'meesho_sync_history has sync_type column');
  assert(cols.has('status'), 'meesho_sync_history has status column');
  assert(cols.has('started_at'), 'meesho_sync_history has started_at column');
  assert(cols.has('completed_at'), 'meesho_sync_history has completed_at column');
  assert(cols.has('records_found'), 'meesho_sync_history has records_found column');
  assert(cols.has('records_inserted'), 'meesho_sync_history has records_inserted column');
  assert(cols.has('records_updated'), 'meesho_sync_history has records_updated column');
  assert(cols.has('records_skipped'), 'meesho_sync_history has records_skipped column');
  assert(cols.has('error_message'), 'meesho_sync_history has error_message column');
  assert(cols.has('duration_ms'), 'meesho_sync_history has duration_ms column');

  // Verify auto_sync_enabled column on marketplace_connections
  const connCols = await sql`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'marketplace_connections' AND column_name = 'auto_sync_enabled';
  `;
  assert(connCols.length > 0, 'marketplace_connections has auto_sync_enabled column');

  // Verify index on meesho_sync_history
  const indexRows = await sql`
    SELECT indexname FROM pg_indexes 
    WHERE tablename = 'meesho_sync_history' AND indexname = 'idx_meesho_sync_history_account_date';
  `;
  assert(indexRows.length > 0, 'idx_meesho_sync_history_account_date index exists');

  // STEP 2: Connected Accounts Discovery for Recovery
  console.log('\n--- Step 2: Connected Accounts Discovery (Worker Recovery) ---');
  const connectedAccounts = await MeeshoOrderSyncService.getConnectedAccounts();
  console.log(`Found ${connectedAccounts.length} connected account(s).`);
  assert(Array.isArray(connectedAccounts), 'Connected accounts returns array');
  assert(connectedAccounts.length > 0, 'At least 1 connected account discovered');

  const testAccount = connectedAccounts[0];
  const accountId = testAccount.accountId;
  assert(typeof testAccount.accountId === 'string', 'accountId is valid string');
  assert(testAccount.autoSyncEnabled === true, 'autoSyncEnabled defaults to true');

  // STEP 3: Auto-Sync Toggle & Status Computation
  console.log('\n--- Step 3: Auto-Sync Toggle & Schedule Status ---');
  const initialStatus = await MeeshoOrderSyncService.getAutoSyncStatus(accountId);
  assert(initialStatus.enabled === true, 'Auto-sync initially enabled');
  assert(initialStatus.intervalMinutes === 15, 'Interval is 15 minutes by default');
  assert(Array.isArray(initialStatus.history), 'Status includes history array');

  // Test toggling OFF
  const toggleOffResult = await MeeshoOrderSyncService.setAutoSyncEnabled(accountId, false);
  assert(toggleOffResult === false, 'Toggling auto-sync to false returns false');
  const statusAfterOff = await MeeshoOrderSyncService.getAutoSyncStatus(accountId);
  assert(statusAfterOff.enabled === false, 'getAutoSyncStatus reflects disabled state');

  // Test toggling back ON
  const toggleOnResult = await MeeshoOrderSyncService.setAutoSyncEnabled(accountId, true);
  assert(toggleOnResult === true, 'Toggling auto-sync to true returns true');
  const statusAfterOn = await MeeshoOrderSyncService.getAutoSyncStatus(accountId);
  assert(statusAfterOn.enabled === true, 'getAutoSyncStatus reflects enabled state');
  assert(statusAfterOn.nextSyncAt !== null, 'nextSyncAt is calculated when enabled');

  // STEP 4: Ingest Pipeline & Idempotent Upsert
  console.log('\n--- Step 4: Ingest Pipeline & Idempotent Upsert ---');
  const testSubOrderId = `test_autosync_sub_${Date.now()}`;
  const testOrderId = `test_autosync_ord_${Date.now()}`;

  const sampleOrderPayload = [
    {
      raw: {
        order_num: testOrderId,
        sub_order_num: testSubOrderId,
        id: '12345678',
        product_sku: 'AUTOSYNC-SKU-TEST',
        name: 'Auto-Sync Verification Product',
        quantity: 2,
        created_iso: new Date().toISOString(),
        expected_dispatch_date_iso: new Date(Date.now() + 86400000).toISOString(),
        courier_name: 'Delhivery',
        awb: 'AWB-AUTOSYNC-001',
      },
      tabType: 'pending' as const,
      statusCode: 1,
    },
  ];

  // Ingest test order
  const ingestResult1 = await MeeshoOrderSyncService.ingestOrders(accountId, sampleOrderPayload, {
    syncType: 'test',
    durationMs: 450,
  });

  assert(ingestResult1.success === true, 'Ingest succeeded');
  assert(ingestResult1.totalExtracted === 1, 'Extracted 1 order in ingest');
  assert(ingestResult1.inserted === 1, 'First ingest inserted 1 new order');
  assert(ingestResult1.updated === 0, 'First ingest updated 0 orders');
  assert(typeof ingestResult1.syncId === 'string', 'Ingest generated a syncId');

  // Ingest identical order again (Duplicate Protection Test)
  const ingestResult2 = await MeeshoOrderSyncService.ingestOrders(accountId, sampleOrderPayload, {
    syncType: 'test',
    durationMs: 380,
  });

  assert(ingestResult2.success === true, 'Second ingest succeeded');
  assert(ingestResult2.inserted === 0, 'Second ingest inserted 0 orders (ZERO DUPLICATES)');
  assert(ingestResult2.updated === 1, 'Second ingest updated 1 existing order');

  // STEP 5: Audit Logging in meesho_sync_history
  console.log('\n--- Step 5: Audit Logging in meesho_sync_history ---');
  const historyRows = await sql`
    SELECT sync_id, account_id, marketplace, sync_type, status, records_found, records_inserted, records_updated, duration_ms
    FROM meesho_sync_history
    WHERE sync_id = ${ingestResult1.syncId};
  `;

  assert(historyRows.length === 1, 'Found exactly 1 sync history record for syncId');
  const hist = historyRows[0];
  assert(hist.account_id === accountId, 'Sync history record has correct account_id');
  assert(hist.marketplace === 'meesho', 'Sync history record has marketplace = meesho');
  assert(hist.sync_type === 'test', 'Sync history record has sync_type = test');
  assert(hist.status === 'success', 'Sync history record has status = success');
  assert(Number(hist.records_inserted) === 1, 'Sync history recorded 1 inserted');
  assert(Number(hist.records_found) === 1, 'Sync history recorded 1 found');
  assert(Number(hist.duration_ms) === 450, 'Sync history recorded duration_ms');

  // STEP 6: Sync History Retrieval
  console.log('\n--- Step 6: Sync History Retrieval ---');
  const recentHistory = await MeeshoOrderSyncService.getSyncHistory(accountId, 5);
  assert(Array.isArray(recentHistory), 'getSyncHistory returns array');
  assert(recentHistory.length >= 2, 'getSyncHistory contains at least 2 records');
  assert(recentHistory[0].syncType === 'test', 'Most recent record has syncType = test');
  assert(recentHistory[0].status === 'success', 'Most recent record has status = success');

  // STEP 7: Concurrency Mutex Lock Verification
  console.log('\n--- Step 7: Concurrency Mutex Lock Verification ---');
  const mockConfig = {
    port: 9005,
    hubUrl: 'http://localhost:9002',
    workerSecret: 'dev_meesho_worker_secret',
    sessionsDir: path.resolve('worker/meesho/.sessions'),
  };
  const mockBrowserManager = new MeeshoBrowserManager(mockConfig as any);
  const scheduler = new MeeshoSyncScheduler(mockBrowserManager, {
    hubUrl: 'http://localhost:9002',
    workerSecret: 'dev_meesho_worker_secret',
    sessionsDir: path.resolve('worker/meesho/.sessions'),
    intervalMinutes: 15,
    overlapMinutes: 30,
  });

  // Manually register test account
  scheduler.registerAccount({
    accountId,
    autoSyncEnabled: true,
    lastSuccessfulSync: new Date().toISOString(),
  });

  const schedulerStatus = scheduler.getAccountStatus(accountId);
  assert(schedulerStatus.registered === true, 'Scheduler registers account');
  assert(schedulerStatus.autoSyncEnabled === true, 'Scheduler reports auto-sync enabled');
  assert(schedulerStatus.isRunning === false, 'Scheduler reports not running initially');
  assert(schedulerStatus.intervalMinutes === 15, 'Scheduler interval configured to 15m');
  assert(schedulerStatus.overlapMinutes === 30, 'Scheduler overlap configured to 30m');

  // Simulate active running sync lock
  (scheduler as any).runningSyncs.add(accountId);
  const duplicateAttempt = await scheduler.syncAccount(accountId);
  assert(duplicateAttempt.success === false, 'Duplicate sync attempt rejected');
  assert(duplicateAttempt.skipped === true, 'Duplicate sync skipped flag is true');
  assert(duplicateAttempt.reason?.includes('already in progress') === true, 'Duplicate sync returns proper mutex message');

  // Release lock
  (scheduler as any).runningSyncs.delete(accountId);
  const statusAfterRelease = scheduler.getAccountStatus(accountId);
  assert(statusAfterRelease.isRunning === false, 'Running lock released successfully');

  // Clean up test order from DB
  await sql`
    DELETE FROM meesho_orders 
    WHERE account_id = ${accountId} AND sub_order_id = ${testSubOrderId};
  `;
  await sql`
    DELETE FROM meesho_sync_history
    WHERE sync_id IN (${ingestResult1.syncId}, ${ingestResult2.syncId});
  `;

  console.log('\n====================================================');
  console.log(`🎉 ALL PHASE 2C ASSERTIONS PASSED (${passedAssertions}/${totalAssertions})`);
  console.log('====================================================\n');
}

run().catch((err) => {
  console.error('\n❌ VERIFICATION RUN FAILED:', err);
  process.exit(1);
});
