import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { MeeshoOrderSyncService } from '@/lib/meesho/meesho-order-sync-service';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const workerSecret = process.env.MEESHO_WORKER_SECRET || 'dev_meesho_worker_secret';
    const headerSecret =
      request.headers.get('x-worker-secret') ||
      request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

    let isAuthorized = false;

    if (headerSecret && headerSecret === workerSecret) {
      isAuthorized = true;
    } else {
      const session = await getServerSession(authOptions);
      if (session?.user) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Missing or invalid worker secret.' },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => null);
    if (!body || !body.accountId || !Array.isArray(body.orders)) {
      return NextResponse.json(
        { success: false, error: 'Invalid payload: accountId and orders array are required.' },
        { status: 400 }
      );
    }

    const result = await MeeshoOrderSyncService.ingestOrders(body.accountId, body.orders, {
      syncType: body.syncType || 'auto',
      durationMs: body.durationMs,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    console.error('[API /api/marketplace/meesho/orders/ingest] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
