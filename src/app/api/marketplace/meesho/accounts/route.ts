import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { sql } from '@/lib/db';
import { MeeshoConnectionService } from '@/lib/meesho/meesho-connection-service';
import { ensureMarketplaceConnectionsTable } from '@/lib/meesho/migration';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

/**
 * GET: Lists all CRM accounts with their respective Meesho connection state
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    await ensureMarketplaceConnectionsTable();

    // Query accounts with left joined marketplace_connections
    const rows = await sql`
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

    const accounts = rows.map((r: any) => {
      let status = r.connection_status || 'disconnected';
      if (status === 'connected' && r.session_expires_at) {
        if (new Date(r.session_expires_at).getTime() <= Date.now()) {
          status = 'expired';
        }
      }

      const meta = r.session_metadata || {};
      const displayName = meta.supplierName || r.account_name;

      return {
        accountId: r.account_id,
        accountName: r.account_name,
        displayName: displayName.toLowerCase().includes('fashion') ? 'Rehanza' : displayName,
        supplierName: meta.supplierName || null,
        supplierId: meta.supplierId || null,
        identifier: meta.identifier || null,
        connectionStatus: status,
        lastSync: r.last_successful_sync ? new Date(r.last_successful_sync).toISOString() : null,
        autoSyncEnabled: r.auto_sync_enabled !== false,
      };
    });

    return NextResponse.json({ success: true, accounts });
  } catch (error: any) {
    console.error('[API /api/marketplace/meesho/accounts GET] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST: Creates a new independent account and initiates Meesho connection
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const rawName = (body.name || '').trim();

    if (!rawName) {
      return NextResponse.json(
        { success: false, error: 'Account name is required' },
        { status: 400 }
      );
    }

    const accountName = rawName.toLowerCase() === 'fashion' ? 'Rehanza' : rawName;
    const slug = accountName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'account';
    const newAccountId = crypto.randomUUID();

    // 1. Create account in database
    await sql`
      INSERT INTO accounts (id, name, slug)
      VALUES (${newAccountId}, ${accountName}, ${slug});
    `;

    console.log(`[API /api/marketplace/meesho/accounts] Created new account: ${accountName} (${newAccountId})`);

    // 2. Initiate Meesho login session
    const loginResult = await MeeshoConnectionService.initiateLoginSession(
      newAccountId,
      (session.user as any)?.id || null
    );

    return NextResponse.json({
      success: true,
      account: {
        id: newAccountId,
        name: accountName,
        slug,
      },
      login: loginResult,
    });
  } catch (error: any) {
    console.error('[API /api/marketplace/meesho/accounts POST] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE: Permanently removes a Meesho account and all its associated data
 * - Deletes orders, payments, sync history, notifications, and connections
 * - Closes and purges active worker browser sessions and on-disk tokens
 * - Strictly isolated by accountId; does not affect any other accounts
 */
export async function DELETE(request: Request) {
  try {
    // 1. Authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Extract accountId from query or body
    const url = new URL(request.url);
    let accountId = url.searchParams.get('accountId');
    if (!accountId) {
      const body = await request.json().catch(() => ({}));
      accountId = body.accountId;
    }

    if (!accountId || typeof accountId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'accountId is required for deletion' },
        { status: 400 }
      );
    }

    // 3. User Authorization
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

    const existingConn = await sql`
      SELECT created_by_user_id FROM marketplace_connections
      WHERE account_id = ${accountId} AND marketplace = 'meesho'
      LIMIT 1;
    `;

    if (existingConn && existingConn.length > 0 && existingConn[0].created_by_user_id) {
      const creatorId = existingConn[0].created_by_user_id;
      if (!isPrivileged && creatorId !== currentUserId) {
        return NextResponse.json(
          { success: false, error: 'Forbidden: You do not have permission to delete this account.' },
          { status: 403 }
        );
      }
    } else if (!isPrivileged) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Admin or manager privileges required to delete marketplace accounts.' },
        { status: 403 }
      );
    }

    console.log(`[API /api/marketplace/meesho/accounts DELETE] Initiating permanent removal of account ${accountId}...`);

    // 4. Stop active worker session & unregister scheduler
    const workerUrl = process.env.MEESHO_WORKER_URL || 'http://localhost:9005';
    const workerSecret = process.env.MEESHO_WORKER_SECRET;
    if (workerSecret) {
      try {
        await fetch(`${workerUrl.replace(/\/+$/, '')}/sessions/${encodeURIComponent(accountId)}/close`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-worker-secret': workerSecret,
          },
        }).catch((e) => {
          console.warn(`[API Accounts DELETE] Worker close call warning: ${e.message}`);
        });
      } catch (err: any) {
        console.warn(`[API Accounts DELETE] Could not reach worker to close session: ${err.message}`);
      }
    }

    // Also purge local session files if accessible
    try {
      const sessionsDir = path.resolve(process.cwd(), 'worker/meesho/.sessions');
      const sPath = path.join(sessionsDir, `${accountId}.storageState.json`);
      const mPath = path.join(sessionsDir, `${accountId}.meta.json`);
      if (fs.existsSync(sPath)) fs.unlinkSync(sPath);
      if (fs.existsSync(mPath)) fs.unlinkSync(mPath);
    } catch (e: any) {
      console.warn(`[API Accounts DELETE] Local session artifact cleanup warning: ${e.message}`);
    }

    // 5. Permanently remove all Meesho data for this account only
    await sql`DELETE FROM meesho_orders WHERE account_id = ${accountId};`;
    await sql`DELETE FROM meesho_payments WHERE account_id = ${accountId};`;
    await sql`DELETE FROM meesho_sync_history WHERE account_id = ${accountId};`;
    await sql`DELETE FROM meesho_order_notifications WHERE account_id = ${accountId};`;
    await sql`DELETE FROM marketplace_connections WHERE account_id = ${accountId};`;

    // 6. Check if account is referenced by other CRM modules (products, orders, vendors)
    const refs = await sql`
      SELECT 
        (SELECT COUNT(*) FROM allproducts WHERE account_id = ${accountId}) AS products_count,
        (SELECT COUNT(*) FROM orders WHERE account_id = ${accountId}) AS orders_count,
        (SELECT COUNT(*) FROM vendors WHERE account_id = ${accountId}) AS vendors_count;
    `;
    const hasCrmRefs =
      Number(refs[0]?.products_count || 0) > 0 ||
      Number(refs[0]?.orders_count || 0) > 0 ||
      Number(refs[0]?.vendors_count || 0) > 0;

    if (!hasCrmRefs) {
      await sql`DELETE FROM accounts WHERE id = ${accountId};`;
      console.log(`[API /api/marketplace/meesho/accounts DELETE] Account ${accountId} fully removed from accounts table.`);
    } else {
      console.log(`[API /api/marketplace/meesho/accounts DELETE] Account ${accountId} has other CRM references; removed all marketplace data while preserving CRM account.`);
    }

    return NextResponse.json({
      success: true,
      message: 'Account and associated Meesho data permanently deleted.',
      accountId,
      accountRemovedFromCrm: !hasCrmRefs,
    });
  } catch (error: any) {
    console.error('[API /api/marketplace/meesho/accounts DELETE] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

