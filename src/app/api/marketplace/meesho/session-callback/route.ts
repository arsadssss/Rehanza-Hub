import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { sql } from '@/lib/db';
import { MeeshoConnectionService } from '@/lib/meesho/meesho-connection-service';
import { WorkerSessionCallbackPayload } from '@/lib/meesho/types';

export const dynamic = 'force-dynamic';

const TICKET_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes

export async function POST(request: Request) {
  try {
    if (process.env.NODE_ENV === 'production' && !process.env.MEESHO_WORKER_SECRET) {
      console.error('[API /api/marketplace/meesho/session-callback] MEESHO_WORKER_SECRET is required in production.');
      return NextResponse.json(
        { success: false, error: 'Server configuration error: Worker secret required in production.' },
        { status: 500 }
      );
    }

    const workerSecret = process.env.MEESHO_WORKER_SECRET || 'dev_meesho_worker_secret';
    const headerSecret =
      request.headers.get('x-worker-secret') ||
      request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

    let isAuthorized = false;
    let userId: string | null = null;

    // 1. Worker Secret Authentication
    if (headerSecret && headerSecret === workerSecret) {
      isAuthorized = true;
    } else {
      // Fallback: Admin User Session (for dev/testing)
      const session = await getServerSession(authOptions);
      if (session?.user) {
        isAuthorized = true;
        userId = (session.user as any)?.id || null;
      }
    }

    if (!isAuthorized) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized: Missing or invalid worker authentication secret.',
        },
        { status: 401 }
      );
    }

    // 2. Parse & Validate Payload Shape
    const body = (await request.json().catch(() => null)) as WorkerSessionCallbackPayload | null;

    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Malformed payload: JSON object expected.' },
        { status: 400 }
      );
    }

    const { accountId, ticket, sessionPayload, metadata, sessionExpiresAt } = body;

    if (!accountId || typeof accountId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'accountId is required.' },
        { status: 400 }
      );
    }

    if (!ticket || typeof ticket !== 'string') {
      return NextResponse.json(
        { success: false, error: 'ticket is required.' },
        { status: 400 }
      );
    }

    if (
      !sessionPayload ||
      typeof sessionPayload !== 'object' ||
      (!sessionPayload.cookies && !sessionPayload.rawSession && !sessionPayload.token)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid session payload: Non-empty cookies or storage state is required.',
        },
        { status: 400 }
      );
    }

    console.log(
      `[API /api/marketplace/meesho/session-callback] Received session callback for account: ${accountId.slice(0, 8)}... (ticket prefix: ${ticket.slice(0, 8)}...)`
    );

    // 3. Verify Account Exists
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(accountId);
    if (isUuid) {
      const accountCheck = await sql`
        SELECT id, name FROM accounts WHERE id = ${accountId} LIMIT 1;
      `;
      if (!accountCheck || accountCheck.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Account not found: Invalid account ID.' },
          { status: 404 }
        );
      }
    } else {
      // For dev or test environments with mock account IDs, verify connection record exists
      const connCheck = await sql`
        SELECT id FROM marketplace_connections WHERE account_id = ${accountId} LIMIT 1;
      `;
      if (!connCheck || connCheck.length === 0) {
        return NextResponse.json(
          { success: false, error: `Account not found for ID: ${accountId}` },
          { status: 404 }
        );
      }
    }

    // 4. Verify Active Pending Connection and Ticket
    const connectionRows = await sql`
      SELECT * FROM marketplace_connections
      WHERE account_id = ${accountId} AND marketplace = 'meesho'
      LIMIT 1;
    `;

    if (!connectionRows || connectionRows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No connection record found for this account.' },
        { status: 404 }
      );
    }

    const connectionRow = connectionRows[0];
    const sessionMetadata = connectionRow.session_metadata || {};
    const storedTicket = sessionMetadata.loginTicket;
    const loginInitiatedAt = sessionMetadata.loginInitiatedAt;

    // Reject already-used tickets
    if (connectionRow.connection_status === 'connected' && (!storedTicket || storedTicket !== ticket)) {
      return NextResponse.json(
        { success: false, error: 'Ticket has already been used or connection is already active.' },
        { status: 409 }
      );
    }

    // Reject ticket mismatch
    if (!storedTicket || storedTicket !== ticket) {
      return NextResponse.json(
        { success: false, error: 'Ticket mismatch: Invalid ticket for this account.' },
        { status: 403 }
      );
    }

    // Reject expired tickets
    if (loginInitiatedAt) {
      const initiatedTime = new Date(loginInitiatedAt).getTime();
      if (Date.now() - initiatedTime > TICKET_EXPIRY_MS) {
        return NextResponse.json(
          { success: false, error: 'Login ticket has expired. Please initiate a new login session.' },
          { status: 410 }
        );
      }
    }

    // 5. Complete session, encrypt with AES-256-GCM, and mark single-use ticket as consumed
    const updatedMetadata = {
      ...(metadata || {}),
      loginTicket: null, // Invalidate ticket upon successful completion (single-use)
      ticketConsumedAt: new Date().toISOString(),
    };

    const connection = await MeeshoConnectionService.completeSessionFromWorker(
      {
        accountId,
        ticket,
        sessionPayload,
        metadata: updatedMetadata,
        sessionExpiresAt,
      },
      userId
    );

    return NextResponse.json({
      success: true,
      message: 'Meesho authenticated session recorded successfully.',
      data: connection,
    });
  } catch (error: any) {
    console.error('[API /api/marketplace/meesho/session-callback] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
