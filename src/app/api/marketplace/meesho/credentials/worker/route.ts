/**
 * GET /api/marketplace/meesho/credentials/worker?accountId=<id>
 *
 * Worker-only endpoint — decrypts and returns Meesho credentials to the automation worker
 * for automatic session re-authentication.
 *
 * SECURITY:
 * - ONLY accessible with valid x-worker-secret header. NOT accessible to browsers/users.
 * - Decrypts credentials server-side and returns them over the loopback network to the worker.
 * - This route must NEVER be called from client-side code.
 * - Credentials are transmitted over localhost (worker ↔ Hub on same machine).
 * - Add TLS / mTLS if deploying worker on a separate machine.
 */

import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { decryptCredential } from '@/lib/meesho/credential-crypto';
import { ensureMarketplaceConnectionsTable } from '@/lib/meesho/migration';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    // 1. Verify worker secret — this endpoint is NOT for browser/user access
    const workerSecret = process.env.MEESHO_WORKER_SECRET;
    if (!workerSecret) {
      console.error('[Worker Credentials API] MEESHO_WORKER_SECRET is not configured on server.');
      return NextResponse.json(
        { success: false, error: 'Server configuration error: MEESHO_WORKER_SECRET required' },
        { status: 500 }
      );
    }

    const incomingSecret =
      request.headers.get('x-worker-secret') ||
      request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

    if (!incomingSecret || incomingSecret !== workerSecret) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Get accountId from query
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId');
    if (!accountId) {
      return NextResponse.json({ success: false, error: 'accountId is required' }, { status: 400 });
    }

    // 3. Fetch encrypted credentials
    await ensureMarketplaceConnectionsTable();
    const rows = await sql`
      SELECT encrypted_login_identifier, encrypted_password
      FROM marketplace_connections
      WHERE account_id = ${accountId} AND marketplace = 'meesho'
      LIMIT 1;
    `;

    if (!rows || rows.length === 0) {
      return NextResponse.json({ success: false, error: 'No connection found for this account' }, { status: 404 });
    }

    const row = rows[0];
    if (!row.encrypted_login_identifier || !row.encrypted_password) {
      return NextResponse.json(
        { success: false, error: 'No stored credentials for this account. Please use Update Credentials to save them.' },
        { status: 404 }
      );
    }

    // 4. Decrypt server-side
    let loginIdentifier: string;
    let password: string;
    try {
      loginIdentifier = decryptCredential(row.encrypted_login_identifier);
      password = decryptCredential(row.encrypted_password);
    } catch (err: any) {
      console.error(`[Worker Credentials API] Decryption failed for account ${accountId.slice(0, 8)}...: ${err.message}`);
      return NextResponse.json(
        { success: false, error: 'Credential decryption failed. Key may have changed.' },
        { status: 500 }
      );
    }

    // 5. Return to worker — these travel over localhost loopback only
    return NextResponse.json({
      success: true,
      loginIdentifier,
      password,
    });
  } catch (error: any) {
    console.error('[Worker Credentials API] Error:', error.message);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
