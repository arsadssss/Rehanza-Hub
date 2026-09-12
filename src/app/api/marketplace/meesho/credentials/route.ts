/**
 * POST /api/marketplace/meesho/credentials
 *
 * Stores encrypted Meesho login credentials for an account.
 * Used by the "Update Credentials" UI flow.
 *
 * SECURITY:
 * - Requires authenticated NextAuth session.
 * - Credentials are encrypted with AES-256-GCM (MEESHO_ENCRYPTION_KEY) before DB write.
 * - Never returns decrypted credentials in response.
 * - Never logs credentials.
 * - Server-side only route.
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { sql } from '@/lib/db';
import { encryptCredential } from '@/lib/meesho/credential-crypto';
import { ensureMarketplaceConnectionsTable } from '@/lib/meesho/migration';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    // 1. Authenticate user
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse + validate body
    const body = await request.json().catch(() => ({}));
    const { accountId, loginIdentifier, password } = body;

    if (!accountId || typeof accountId !== 'string') {
      return NextResponse.json({ success: false, error: 'accountId is required' }, { status: 400 });
    }
    if (!loginIdentifier || typeof loginIdentifier !== 'string' || loginIdentifier.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'loginIdentifier (email or phone) is required' },
        { status: 400 }
      );
    }
    if (!password || typeof password !== 'string' || password.length < 4) {
      return NextResponse.json(
        { success: false, error: 'password is required (minimum 4 characters)' },
        { status: 400 }
      );
    }

    // 3. Encrypt credentials — NEVER store plaintext
    let encryptedLoginIdentifier: string;
    let encryptedPassword: string;
    try {
      encryptedLoginIdentifier = encryptCredential(loginIdentifier.trim());
      encryptedPassword = encryptCredential(password);
    } catch (err: any) {
      console.error('[Credentials API] Encryption failed:', err.message);
      return NextResponse.json(
        { success: false, error: 'Credential encryption failed. Ensure MEESHO_ENCRYPTION_KEY is configured.' },
        { status: 500 }
      );
    }

    // 4. Verify the account exists and user is authorized
    const accountRows = await sql`
      SELECT id FROM accounts WHERE id = ${accountId} LIMIT 1;
    `;
    if (!accountRows || accountRows.length === 0) {
      return NextResponse.json({ success: false, error: 'Account not found' }, { status: 404 });
    }

    // Strict user authorization check
    const userEmail = session.user.email;
    const userRows = await sql`
      SELECT id, role FROM users WHERE email = ${userEmail} LIMIT 1;
    `;
    if (!userRows || userRows.length === 0) {
      return NextResponse.json({ success: false, error: 'User not authorized' }, { status: 403 });
    }

    const userRole = (userRows[0].role || '').toLowerCase();
    const isPrivileged = ['admin', 'manager', 'owner'].includes(userRole);
    const currentUserId = (session.user as any)?.id || userRows[0].id;

    // Check existing connection ownership if not privileged
    const existingConn = await sql`
      SELECT created_by_user_id FROM marketplace_connections
      WHERE account_id = ${accountId} AND marketplace = 'meesho'
      LIMIT 1;
    `;

    if (existingConn && existingConn.length > 0 && existingConn[0].created_by_user_id) {
      const creatorId = existingConn[0].created_by_user_id;
      if (!isPrivileged && creatorId !== currentUserId) {
        return NextResponse.json(
          { success: false, error: 'Forbidden: You do not have permission to manage this marketplace connection' },
          { status: 403 }
        );
      }
    } else if (!isPrivileged) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Admin or manager privileges required to update credentials' },
        { status: 403 }
      );
    }

    // 5. Ensure marketplace_connections row exists for this account
    await ensureMarketplaceConnectionsTable();
    await sql`
      INSERT INTO marketplace_connections (account_id, marketplace, connection_status, updated_at)
      VALUES (${accountId}, 'meesho', 'disconnected', NOW())
      ON CONFLICT (account_id, marketplace) DO NOTHING;
    `;

    // 6. Write encrypted credentials to DB (never plaintext)
    await sql`
      UPDATE marketplace_connections
      SET
        encrypted_login_identifier = ${encryptedLoginIdentifier},
        encrypted_password = ${encryptedPassword},
        updated_at = NOW()
      WHERE account_id = ${accountId} AND marketplace = 'meesho';
    `;

    console.log(`[Credentials API] Encrypted credentials saved for account ${accountId.slice(0, 8)}...`);

    // 7. Return success — NEVER return decrypted values
    return NextResponse.json({
      success: true,
      message: 'Credentials saved securely. Auto re-authentication is now enabled for this account.',
    });
  } catch (error: any) {
    console.error('[Credentials API] Error:', error.message);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
