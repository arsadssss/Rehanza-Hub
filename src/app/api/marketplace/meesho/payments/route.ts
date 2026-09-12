import { NextResponse } from 'next/server';
import { resolveMarketplaceAuth } from '@/lib/meesho/auth-helper';
import { MeeshoPaymentSyncService } from '@/lib/meesho/meesho-payment-sync-service';
import { MeeshoConnectionService } from '@/lib/meesho/meesho-connection-service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const workerSecret = process.env.MEESHO_WORKER_SECRET || 'dev_meesho_worker_secret';
    const headerSecret =
      request.headers.get('x-worker-secret') ||
      request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

    const { searchParams } = new URL(request.url);
    let targetAccountId = searchParams.get('accountId') || request.headers.get('x-account-id');

    if (headerSecret && headerSecret === workerSecret) {
      if (!targetAccountId) {
        return NextResponse.json(
          { success: false, error: 'accountId parameter is required' },
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
      targetAccountId = targetAccountId || auth.accountId;
    }

    let payments = await MeeshoPaymentSyncService.getPayments(targetAccountId);

    // If never synced and account is connected, attempt initial worker sync automatically
    if (!payments.lastSyncedAt) {
      try {
        const connection = await MeeshoConnectionService.getConnection(targetAccountId);
        if (connection.status === 'connected') {
          console.log(`[Payments API] Initial payment fetch for connected account ${targetAccountId}...`);
          payments = await MeeshoPaymentSyncService.triggerPaymentSync(targetAccountId);
        }
      } catch (err: any) {
        console.warn(`[Payments API] Initial sync skipped or non-fatal: ${err.message}`);
      }
    }

    return NextResponse.json({ success: true, data: payments });
  } catch (error: any) {
    console.error('[Payments API Error]:', error);
    const msg = error.message || 'Internal server error';
    const status = error.statusCode || 500;
    return NextResponse.json({ success: false, error: msg, code: error.code }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const workerSecret = process.env.MEESHO_WORKER_SECRET || 'dev_meesho_worker_secret';
    const headerSecret =
      request.headers.get('x-worker-secret') ||
      request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

    const body = await request.json().catch(() => ({}));
    let targetAccountId = body.accountId || request.headers.get('x-account-id');

    if (headerSecret && headerSecret === workerSecret) {
      if (!targetAccountId) {
        return NextResponse.json(
          { success: false, error: 'accountId is required' },
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
      targetAccountId = targetAccountId || auth.accountId;
    }

    console.log(`[Payments API] Triggering manual payment sync for account ${targetAccountId}...`);
    const payments = await MeeshoPaymentSyncService.triggerPaymentSync(targetAccountId);

    return NextResponse.json({ success: true, data: payments });
  } catch (error: any) {
    console.error('[Payments Sync API Error]:', error);
    const msg = error.message || 'Internal server error';
    let status = error.statusCode || 500;
    if (!error.statusCode) {
      if (msg.includes('not connected') || msg.includes('connect first') || msg.includes('No authenticated session')) {
        status = 400;
      } else if (msg.includes('unreachable') || msg.includes('ECONNREFUSED') || msg.includes('fetch failed')) {
        status = 503;
      } else if (msg.includes('Worker payment extraction failed')) {
        status = 502;
      }
    }
    return NextResponse.json({ success: false, error: msg, code: error.code }, { status });
  }
}

