import { NextResponse } from 'next/server';
import { resolveMarketplaceAuth } from '@/lib/meesho/auth-helper';
import { MeeshoOrderSyncService } from '@/lib/meesho/meesho-order-sync-service';
import { OrderSyncOptions } from '@/lib/meesho/types';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const workerSecret = process.env.MEESHO_WORKER_SECRET || 'dev_meesho_worker_secret';
    const headerSecret =
      request.headers.get('x-worker-secret') ||
      request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

    let targetAccountId: string | null = null;
    let options: OrderSyncOptions = {};

    try {
      options = await request.json();
    } catch {
      // Optional body
    }

    if (headerSecret && headerSecret === workerSecret) {
      targetAccountId =
        request.headers.get('x-account-id') || (options as any)?.accountId || null;
      if (!targetAccountId) {
        return NextResponse.json(
          { success: false, error: 'accountId is required when using worker secret.' },
          { status: 400 }
        );
      }
    } else {
      const auth = await resolveMarketplaceAuth(request);
      if (!auth.authorized || !auth.accountId) {
        return NextResponse.json(
          { success: false, error: auth.error || 'Unauthorized' },
          { status: auth.statusCode || 401 }
        );
      }
      targetAccountId = auth.accountId;
    }

    const result = await MeeshoOrderSyncService.syncOrders(targetAccountId, options);
    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    console.error('[API /api/marketplace/meesho/orders/sync] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

