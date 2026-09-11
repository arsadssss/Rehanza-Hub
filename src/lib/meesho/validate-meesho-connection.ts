/**
 * Automated Verification Suite for Rehanza-Hub Meesho Marketplace Connector (Phase 1 Revision)
 * Tests:
 * 1. Database table migration & idempotent creation
 * 2. AES-256-GCM encryption, decryption, tamper detection, and key derivation
 * 3. Browser session login initiation (Status: 'pending' with unique ticket & login URL)
 * 4. Multi-tenant account isolation (Fashion vs Cosmetics accounts)
 * 5. Worker session completion & AES-256-GCM encrypted persistence (Status: 'connected')
 * 6. Safe client DTO generation (ZERO password/cookie/token leakage)
 * 7. Disconnection state transitions & credential purging
 * 8. Session expiry detection ('expired')
 * 9. Cancel pending login lifecycle
 */

import { sql } from '../db';
import { ensureMarketplaceConnectionsTable } from './migration';
import { encryptSession, decryptSession } from './encryption';
import { MeeshoSessionManager } from './meesho-session-manager';
import { MeeshoConnectionService } from './meesho-connection-service';
import { WorkerSessionCallbackPayload } from './types';

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
  console.log('🧪 RUNNING MEESHO CONNECTOR PHASE 1 TEST SUITE (REVISION)');
  console.log('====================================================\n');

  // Test 1: Table Creation & Idempotency
  console.log('--- Test Suite 1: Database Migration & Schema ---');
  await ensureMarketplaceConnectionsTable();
  await ensureMarketplaceConnectionsTable();
  const tableCheck = await sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'marketplace_connections';
  `;
  const columnNames = tableCheck.map((c: any) => c.column_name);
  assert(columnNames.includes('account_id'), 'Table has account_id column');
  assert(columnNames.includes('encrypted_session_data'), 'Table has encrypted_session_data column');
  assert(columnNames.includes('connection_status'), 'Table has connection_status column');
  assert(columnNames.includes('session_metadata'), 'Table has session_metadata column');
  assert(columnNames.includes('session_expires_at'), 'Table has session_expires_at column');

  // Test 2: AES-256-GCM Encryption / Decryption
  console.log('\n--- Test Suite 2: Cryptographic Security (AES-256-GCM) ---');
  const samplePayload = {
    cookies: { session_id: 'supplier_session_cookie_secret', token: 'jwt_supplier_token' },
    supplierId: '108429',
  };
  const ciphertext = encryptSession(samplePayload);
  assert(typeof ciphertext === 'string', 'Ciphertext is a string');
  assert(ciphertext.split(':').length === 3, 'Ciphertext format is iv:tag:ciphertext');
  assert(!ciphertext.includes('supplier_session_cookie_secret'), 'Plaintext is not exposed in ciphertext');

  const decrypted = decryptSession<typeof samplePayload>(ciphertext);
  assert(decrypted.supplierId === samplePayload.supplierId, 'Decrypted payload matches original');
  assert(
    (decrypted.cookies as any).session_id === samplePayload.cookies.session_id,
    'Decrypted nested cookies match'
  );

  // Tamper detection
  let tamperDetected = false;
  try {
    const parts = ciphertext.split(':');
    const tampered = `${parts[0]}:${parts[1]}:badbeef${parts[2].slice(7)}`;
    decryptSession(tampered);
  } catch (err) {
    tamperDetected = true;
  }
  assert(tamperDetected, 'Tampered ciphertext is rejected by authentication tag');

  // Test Suite 3: Multi-Tenant Browser Session Login Flow
  console.log('\n--- Test Suite 3: Browser Session Login Flow & Tenant Isolation ---');
  const accountA = 'mock-conn-test-account-a';
  const accountB = 'mock-conn-test-account-b';

  // Clean up any existing test rows
  await sql`DELETE FROM marketplace_connections WHERE account_id IN (${accountA}, ${accountB});`;


  // Step 3a: Initial state is disconnected
  const initialA = await MeeshoConnectionService.getConnection(accountA);
  assert(initialA.status === 'disconnected', 'Account A initially returns disconnected');
  assert(initialA.id === null, 'Account A has no connection ID initially');

  // Step 3b: User initiates browser login session
  const loginSessionA = await MeeshoConnectionService.initiateLoginSession(accountA);
  assert(loginSessionA.status === 'pending', 'Initiate login returns status pending');
  assert(typeof loginSessionA.ticket === 'string' && loginSessionA.ticket.startsWith('msh_'), 'Unique login ticket generated');
  assert(loginSessionA.loginUrl.includes('meesho'), 'Login URL points to Meesho supplier portal');

  // Step 3c: Check status of Account A is now pending
  const pendingA = await MeeshoConnectionService.getConnection(accountA);
  assert(pendingA.status === 'pending', 'Account A status is recorded as pending in database');
  assert(pendingA.ticket === loginSessionA.ticket, 'Login ticket persisted in session metadata');

  // Step 3d: Account B isolation check
  const checkB = await MeeshoConnectionService.getConnection(accountB);
  assert(checkB.status === 'disconnected', 'Account B remains completely isolated and disconnected');

  // Step 3e: Worker reports authenticated session completion
  const workerCallback: WorkerSessionCallbackPayload = {
    accountId: accountA,
    ticket: loginSessionA.ticket,
    sessionPayload: {
      cookies: 'session_id=verified_supplier_session; token=bearer_val',
      token: 'bearer_val',
    },
    metadata: {
      supplierId: 'SUPPLIER_MEESHO_01',
      supplierName: 'Rehanza Official Store',
      sessionSource: 'browser_worker',
    },
    sessionExpiresAt: new Date(Date.now() + 14 * 86400 * 1000).toISOString(),
  };

  const connectedA = await MeeshoConnectionService.completeSessionFromWorker(workerCallback);
  assert(connectedA.status === 'connected', 'Account A status transitioned to connected after worker callback');
  assert(connectedA.sessionMetadata.supplierId === 'SUPPLIER_MEESHO_01', 'Supplier metadata saved');
  assert((connectedA as any).encrypted_session_data === undefined, 'Client DTO does NOT leak encrypted data');
  assert((connectedA as any).cookies === undefined, 'Client DTO does NOT leak raw cookies');
  assert((connectedA as any).password === undefined, 'Client DTO does NOT have passwords');

  // Step 3f: Verify decrypted session internally
  const decryptedSession = await MeeshoSessionManager.getDecryptedSession(accountA);
  assert(decryptedSession !== null, 'Decrypted session accessible to internal service');
  assert(
    decryptedSession?.sessionPayload.token === 'bearer_val',
    'Decrypted session token matches worker payload'
  );
  assert(decryptedSession?.isExpired === false, 'Session is currently active');

  // Test Suite 4: Disconnect Lifecycle
  console.log('\n--- Test Suite 4: Disconnect Lifecycle ---');
  const disconnectedA = await MeeshoConnectionService.disconnect(accountA);
  assert(disconnectedA.status === 'disconnected', 'Account A status transitioned to disconnected');
  assert(disconnectedA.disconnectedAt !== null, 'Account A has disconnectedAt timestamp');

  // Verify internal credentials wiped
  const clearedSession = await MeeshoSessionManager.getDecryptedSession(accountA);
  assert(clearedSession === null, 'Encrypted session data is wiped from database upon disconnect');

  // Test Suite 5: Session Expiry Handling
  console.log('\n--- Test Suite 5: Session Expiry Handling ---');
  const expiredPayload: WorkerSessionCallbackPayload = {
    accountId: accountA,
    sessionPayload: { token: 'old_expired_token' },
    sessionExpiresAt: new Date(Date.now() - 5000).toISOString(), // Expired 5 seconds ago
  };
  await MeeshoConnectionService.completeSessionFromWorker(expiredPayload);
  const expiredDto = await MeeshoConnectionService.getConnection(accountA);
  assert(expiredDto.status === 'expired', 'Connection service identifies expired sessions automatically');

  // Test Suite 6: Cancel Pending Login
  console.log('\n--- Test Suite 6: Cancel Pending Login Lifecycle ---');
  await MeeshoConnectionService.initiateLoginSession(accountA);
  const rePending = await MeeshoConnectionService.getConnection(accountA);
  assert(rePending.status === 'pending', 'Login re-initiated to pending');
  const cancelled = await MeeshoConnectionService.cancelLogin(accountA);
  assert(cancelled.status === 'disconnected', 'Cancelled login returns to disconnected');

  // Cleanup
  console.log('\n--- Cleanup ---');
  await sql`DELETE FROM marketplace_connections WHERE account_id IN (${accountA}, ${accountB});`;
  console.log('  🧹 Cleaned up test data in marketplace_connections');

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
