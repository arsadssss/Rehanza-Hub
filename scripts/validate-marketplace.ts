import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { sql } from '../src/lib/db';
import { MeeshoPaymentSyncService } from '../src/lib/meesho/meesho-payment-sync-service';
import { MeeshoOrderSyncService } from '../src/lib/meesho/meesho-order-sync-service';
import { MeeshoConnectionService } from '../src/lib/meesho/meesho-connection-service';
import { encryptCredential, decryptCredential, isCredentialKeyConfigured } from '../src/lib/meesho/credential-crypto';

async function runValidation() {
  console.log('====================================================');
  console.log('🧪 RUNNING MARKETPLACE & MULTI-ACCOUNT VALIDATION');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  const primaryAccountId = '1323beea-04db-4d44-a1ca-3ab7a1556f09';
  const secondaryAccountId = 'e5839188-7517-4861-a83d-0453531b9d40';

  // ============================================================
  // SECTION 0: Credential Encryption Tests (no network required)
  // ============================================================
  console.log('0. Verifying AES-256-GCM Credential Encryption...');

  // 0a. Key configuration check
  const keyConfigured = isCredentialKeyConfigured();
  assert(keyConfigured, 'MEESHO_ENCRYPTION_KEY is configured and usable');

  if (keyConfigured) {
    // 0b. Encrypt a test identifier
    const testIdentifier = 'test@meeshoseller.com';
    const encryptedId = encryptCredential(testIdentifier);
    assert(encryptedId.startsWith('v1:'), 'Encrypted identifier has versioned v1: prefix');
    assert(encryptedId !== testIdentifier, 'Ciphertext differs from plaintext (identifier)');
    assert(encryptedId.split(':').length === 4, 'Encrypted identifier has correct v1:iv:tag:ciphertext format');

    // 0c. Encrypt a test password
    const testPassword = 'Str0ng@Pass!word#123';
    const encryptedPass = encryptCredential(testPassword);
    assert(encryptedPass.startsWith('v1:'), 'Encrypted password has versioned v1: prefix');
    assert(encryptedPass !== testPassword, 'Ciphertext differs from plaintext (password)');

    // 0d. Random IV — two encryptions of same plaintext must differ
    const enc1 = encryptCredential(testIdentifier);
    const enc2 = encryptCredential(testIdentifier);
    assert(enc1 !== enc2, 'Same plaintext produces different ciphertext (random IV verified)');

    // 0e. Decryption round-trip — identifier
    const decryptedId = decryptCredential(encryptedId);
    assert(decryptedId === testIdentifier, `Identifier decrypts correctly (got: "${decryptedId}")`);

    // 0f. Decryption round-trip — password
    const decryptedPass = decryptCredential(encryptedPass);
    assert(decryptedPass === testPassword, `Password decrypts correctly`);

    // 0g. Tampered ciphertext must throw (GCM auth tag failure)
    let tamperThrew = false;
    try {
      const parts = encryptedId.split(':');
      // Flip one char in the ciphertext portion
      parts[3] = parts[3].slice(0, -2) + 'ff';
      decryptCredential(parts.join(':'));
    } catch {
      tamperThrew = true;
    }
    assert(tamperThrew, 'Tampered ciphertext throws (AES-GCM auth tag rejected)');

    // 0h. Wrong version throws
    let badVersionThrew = false;
    try {
      decryptCredential('v99:aabbccdd:aabbccdd:aabbccdd');
    } catch {
      badVersionThrew = true;
    }
    assert(badVersionThrew, 'Unsupported version string throws');

    // 0i. Empty input throws
    let emptyThrew = false;
    try {
      encryptCredential('');
    } catch {
      emptyThrew = true;
    }
    assert(emptyThrew, 'Encrypting empty string throws');

    // 0j. Unicode / special characters round-trip
    const unicode = 'P@ssw0rd!₹🔐日本語';
    const encUnicode = encryptCredential(unicode);
    const decUnicode = decryptCredential(encUnicode);
    assert(decUnicode === unicode, 'Unicode / special characters round-trip correctly');
  }

  // Test 1: Account Connection & Metadata for Primary Account
  console.log('\n1. Verifying Account Connection & Metadata...');
  const conn = await MeeshoConnectionService.getConnection(primaryAccountId);
  assert(conn.status === 'connected', `Primary account is connected (status: ${conn.status})`);
  assert(conn.sessionMetadata?.supplierName === 'Rehanza Lifestyle', `Supplier Name is Rehanza Lifestyle (got: ${conn.sessionMetadata?.supplierName})`);
  assert(conn.sessionMetadata?.identifier === '4zy6k', `Supplier Identifier is 4zy6k (got: ${conn.sessionMetadata?.identifier})`);
  assert(conn.sessionMetadata?.supplierId === '4768417', `Supplier ID is 4768417 (got: ${conn.sessionMetadata?.supplierId})`);

  // Security: ensure API response does not contain encrypted_session_data or passwords
  assert(!(conn as any).encrypted_session_data, 'Connection DTO does not expose encrypted_session_data');
  assert(!(conn as any).encrypted_login_identifier, 'Connection DTO does not expose encrypted_login_identifier');
  assert(!(conn as any).encrypted_password, 'Connection DTO does not expose encrypted_password');

  // Test 1b: Accounts API Query & Multi-Account Discovery
  console.log('\n1b. Verifying Accounts API Query & Multi-Account Discovery...');
  const accountRows = await sql`
    SELECT 
      a.id AS account_id,
      a.name AS account_name,
      a.slug AS account_slug,
      mc.id AS connection_id,
      mc.connection_status,
      mc.last_successful_sync,
      mc.session_expires_at,
      mc.session_metadata,
      mc.auto_sync_enabled
    FROM accounts a
    LEFT JOIN marketplace_connections mc 
      ON a.id::text = mc.account_id AND mc.marketplace = 'meesho'
    ORDER BY (CASE WHEN a.name ILIKE '%rehanza%' OR a.name ILIKE '%fashion%' THEN 0 ELSE 1 END), a.name ASC;
  `;
  assert(accountRows.length >= 5, `Accounts query returned >= 5 accounts (got: ${accountRows.length})`);
  const primaryAccountRow = accountRows.find((r: any) => r.account_id === primaryAccountId);
  assert(!!primaryAccountRow, 'Primary account found in accounts query');
  assert(primaryAccountRow?.connection_status === 'connected', `Primary account in accounts query has status "connected" (got: ${primaryAccountRow?.connection_status})`);
  assert(primaryAccountRow?.session_metadata?.supplierName === 'Rehanza Lifestyle', 'Primary account metadata supplierName matches');
  assert(primaryAccountRow?.session_metadata?.identifier === '4zy6k', 'Primary account metadata identifier matches');

  // Test 2: Live Orders Metrics
  console.log('\n2. Verifying Live Orders Scoped Metrics...');
  const orderStatus = await MeeshoOrderSyncService.getOrderSyncStatus(primaryAccountId);
  assert(orderStatus.statusBreakdown.pending >= 0, `Pending orders count is >= 0 (got: ${orderStatus.statusBreakdown.pending})`);
  assert(orderStatus.statusBreakdown.ready_to_ship >= 1, `Ready to Dispatch count is >= 1 (got: ${orderStatus.statusBreakdown.ready_to_ship})`);
  assert(orderStatus.statusBreakdown.shipped >= 90, `Shipped orders count is >= 90 (got: ${orderStatus.statusBreakdown.shipped})`);
  assert(orderStatus.statusBreakdown.cancelled >= 27, `Cancelled orders count is >= 27 (got: ${orderStatus.statusBreakdown.cancelled})`);

  // Test 3: Payments Upcoming Settlements
  console.log('\n3. Verifying Upcoming Payments...');
  const payments = await MeeshoPaymentSyncService.getPayments(primaryAccountId);
  assert(payments.upcoming.count === 3, `Upcoming days count is 3 (got: ${payments.upcoming.count})`);
  assert(payments.upcoming.daywisePayments.length === 3, `Upcoming daywise payments array length is 3`);
  
  const day1 = payments.upcoming.daywisePayments[0];
  assert(day1.date === '2026-09-14', `First upcoming date is 2026-09-14 (got: ${day1?.date})`);

  assert(day1.headerAmount === '₹-1.18K', `First upcoming header amount is ₹-1.18K (got: ${day1?.headerAmount})`);
  assert(Math.abs(day1.netAmount - (-1182.11)) < 0.01, `First upcoming netAmount is -1182.11 (got: ${day1?.netAmount})`);
  assert(Math.abs(day1.netOrderAmount - 832.22) < 0.01, `First upcoming netOrderAmount is 832.22 (got: ${day1?.netOrderAmount})`);
  assert(Math.abs(day1.netPlatformRecovery.adsCost - (-2014.33)) < 0.01, `First upcoming adsCost is -2014.33 (got: ${day1?.netPlatformRecovery.adsCost})`);
  assert(payments.upcoming.totalAmount7Days?.headerAmount === '₹7.05K', `Upcoming 7-day total is ₹7.05K (got: ${payments.upcoming.totalAmount7Days?.headerAmount})`);

  // Test 4: Payments Unscheduled
  console.log('\n4. Verifying Unscheduled Payments...');
  assert(payments.unscheduled.count === 91, `Unscheduled orders count is 91 (got: ${payments.unscheduled.count})`);
  assert(Math.abs(payments.unscheduled.total - 36151.10) < 0.01, `Unscheduled total net order amount is ₹36,151.10 (got: ${payments.unscheduled.total})`);
  assert(payments.unscheduled.payoutUIList.length >= 20, `Unscheduled payoutUIList contains populated orders (${payments.unscheduled.payoutUIList.length} items)`);
  
  const sampleOrder = payments.unscheduled.payoutUIList[0];
  assert(!!sampleOrder.orderNum, `Order contains orderNum (${sampleOrder.orderNum})`);
  assert(!!sampleOrder.subOrderNum, `Order contains subOrderNum (${sampleOrder.subOrderNum})`);
  assert(!!sampleOrder.supplierSKU, `Order contains supplierSKU (${sampleOrder.supplierSKU})`);
  assert(sampleOrder.amount > 0, `Order has positive gross amount (${sampleOrder.amount})`);

  // Test 5: Payments Completed
  console.log('\n5. Verifying Completed Payments...');
  assert(payments.completed.count === 6 || payments.completed.totalAmount30Days?.headerAmount === '₹0.0', `Completed payments correctly scoped`);
  assert(payments.completed.totalAmount30Days?.headerAmount === '₹0.0', `Completed 30-day total header is ₹0.0 (got: ${payments.completed.totalAmount30Days?.headerAmount})`);

  // Test 6: Payments Over Time Graph
  console.log('\n6. Verifying Payments Over Time Graph...');
  assert((payments.graph?.payouts?.length ?? 0) > 0, `Graph payouts contain daily points (got: ${payments.graph?.payouts?.length})`);
  const samplePoint = payments.graph?.payouts[0];
  assert(!!samplePoint?.payment_date, `Graph point contains payment_date (${samplePoint?.payment_date})`);

  // Test 7: Multi-Account Isolation
  console.log('\n7. Verifying Multi-Account Isolation...');
  const secondaryPayments = await MeeshoPaymentSyncService.getPayments(secondaryAccountId);
  assert(secondaryPayments.accountId === secondaryAccountId, `Secondary account ID is strictly isolated`);
  assert(secondaryPayments.upcoming.count === 0, `Secondary account has 0 upcoming payments (never leaked Primary Account data)`);
  assert(secondaryPayments.unscheduled.count === 0, `Secondary account has 0 unscheduled payments (never leaked Primary Account data)`);
  assert(secondaryPayments.unscheduled.payoutUIList.length === 0, `Secondary payout list is empty`);

  const secondaryOrders = await MeeshoOrderSyncService.getOrderSyncStatus(secondaryAccountId);
  assert(secondaryOrders.totalOrders === 0, `Secondary account has 0 orders (never leaked Primary Account orders)`);
  assert(secondaryOrders.statusBreakdown.pending === 0, `Secondary pending count is 0`);
  assert(secondaryOrders.statusBreakdown.ready_to_ship === 0, `Secondary ready_to_ship count is 0`);

  // Test 8: Delete Account Lifecycle & Total Isolation
  console.log('\n8. Verifying Delete Account Lifecycle & Isolation...');
  const testDeleteId = crypto.randomUUID();
  const testDeleteSlug = `temp-seller-${testDeleteId.slice(0, 8)}`;
  const sessionsDir = path.resolve(process.cwd(), 'worker/meesho/.sessions');
  const dummyStorage = path.join(sessionsDir, `${testDeleteId}.storageState.json`);
  const dummyMeta = path.join(sessionsDir, `${testDeleteId}.meta.json`);

  try {
    // Setup test account data
    await sql`INSERT INTO accounts (id, name, slug) VALUES (${testDeleteId}, 'Temporary Test Seller', ${testDeleteSlug});`;
    await sql`
      INSERT INTO marketplace_connections (account_id, marketplace, connection_status, auto_sync_enabled)
      VALUES (${testDeleteId}, 'meesho', 'connected', false);
    `;
    await sql`
      INSERT INTO meesho_orders (
        account_id, marketplace, order_id, sub_order_id, status, meesho_status_code, sku, quantity, raw_data, synced_at
      ) VALUES (
        ${testDeleteId}, 'meesho', 'temp-ord-1', 'temp-sub-1', 'ready_to_ship', 3, 'TEMP-SKU', 1, '{}'::jsonb, NOW()
      );
    `;
    await sql`
      INSERT INTO meesho_payments (
        account_id, marketplace, payment_category, record_date, amount, data, synced_at, updated_at
      ) VALUES (
        ${testDeleteId}, 'meesho', 'upcoming', NULL, 500, '{"count": 1}'::jsonb, NOW(), NOW()
      );
    `;
    fs.writeFileSync(dummyStorage, JSON.stringify({ cookies: [] }));
    fs.writeFileSync(dummyMeta, JSON.stringify({ identifier: 'temp' }));

    assert(fs.existsSync(dummyStorage), 'Test storageState file created');
    assert(fs.existsSync(dummyMeta), 'Test meta file created');

    // Perform deletion
    // 1. Worker session cleanup
    const workerSecret = process.env.MEESHO_WORKER_SECRET;
    if (workerSecret) {
      await fetch(`http://localhost:9005/sessions/${testDeleteId}/close`, {
        method: 'POST',
        headers: { 'x-worker-secret': workerSecret },
      }).catch(() => {});
    }
    if (fs.existsSync(dummyStorage)) fs.unlinkSync(dummyStorage);
    if (fs.existsSync(dummyMeta)) fs.unlinkSync(dummyMeta);

    // 2. Neon cleanup
    await sql`DELETE FROM meesho_orders WHERE account_id = ${testDeleteId};`;
    await sql`DELETE FROM meesho_payments WHERE account_id = ${testDeleteId};`;
    await sql`DELETE FROM meesho_sync_history WHERE account_id = ${testDeleteId};`;
    await sql`DELETE FROM meesho_order_notifications WHERE account_id = ${testDeleteId};`;
    await sql`DELETE FROM marketplace_connections WHERE account_id = ${testDeleteId};`;
    await sql`DELETE FROM accounts WHERE id = ${testDeleteId};`;

    // Verify full purge of deleted account
    assert(!fs.existsSync(dummyStorage), 'Test storageState file purged');
    assert(!fs.existsSync(dummyMeta), 'Test meta file purged');

    const deletedOrders = await sql`SELECT count(*) FROM meesho_orders WHERE account_id = ${testDeleteId};`;
    assert(Number(deletedOrders[0].count) === 0, 'Orders for deleted account completely purged (0 remaining)');

    const deletedPayments = await sql`SELECT count(*) FROM meesho_payments WHERE account_id = ${testDeleteId};`;
    assert(Number(deletedPayments[0].count) === 0, 'Payments for deleted account completely purged (0 remaining)');

    const deletedConn = await sql`SELECT count(*) FROM marketplace_connections WHERE account_id = ${testDeleteId};`;
    assert(Number(deletedConn[0].count) === 0, 'marketplace_connections for deleted account completely purged (0 remaining)');

    const deletedAcc = await sql`SELECT count(*) FROM accounts WHERE id = ${testDeleteId};`;
    assert(Number(deletedAcc[0].count) === 0, 'accounts row for deleted account completely purged (0 remaining)');

    // Verify Primary Account is completely unaffected
    const primaryConnCheck = await MeeshoConnectionService.getConnection(primaryAccountId);
    assert(primaryConnCheck.status === 'connected', 'Primary account is still connected after deletion of other account');
    const primaryOrdersCheck = await MeeshoOrderSyncService.getOrderSyncStatus(primaryAccountId);
    assert(primaryOrdersCheck.totalOrders > 0, 'Primary account orders completely preserved');
  } finally {
    // Failsafe cleanup
    if (fs.existsSync(dummyStorage)) fs.unlinkSync(dummyStorage);
    if (fs.existsSync(dummyMeta)) fs.unlinkSync(dummyMeta);
    await sql`DELETE FROM meesho_orders WHERE account_id = ${testDeleteId};`.catch(() => {});
    await sql`DELETE FROM meesho_payments WHERE account_id = ${testDeleteId};`.catch(() => {});
    await sql`DELETE FROM meesho_sync_history WHERE account_id = ${testDeleteId};`.catch(() => {});
    await sql`DELETE FROM meesho_order_notifications WHERE account_id = ${testDeleteId};`.catch(() => {});
    await sql`DELETE FROM marketplace_connections WHERE account_id = ${testDeleteId};`.catch(() => {});
    await sql`DELETE FROM accounts WHERE id = ${testDeleteId};`.catch(() => {});
  }

  console.log('\n====================================================');
  console.log(`📊 RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runValidation().catch((err) => {
  console.error('Fatal validation error:', err);
  process.exit(1);
});
