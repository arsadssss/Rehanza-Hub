import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { MeeshoPaymentSyncService } from '@/lib/meesho/meesho-payment-sync-service';
import { MeeshoConnectionService } from '@/lib/meesho/meesho-connection-service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId');

    if (!accountId) {
      return NextResponse.json({ success: false, error: 'accountId parameter is required' }, { status: 400 });
    }

    let payments = await MeeshoPaymentSyncService.getPayments(accountId);

    // If never synced and account is connected, attempt initial worker sync automatically
    if (!payments.lastSyncedAt) {
      try {
        const connection = await MeeshoConnectionService.getConnection(accountId);
        if (connection.status === 'connected') {
          console.log(`[Payments API] Initial payment fetch for connected account ${accountId}...`);
          payments = await MeeshoPaymentSyncService.triggerPaymentSync(accountId);
        }
      } catch (err: any) {
        console.warn(`[Payments API] Initial sync failed: ${err.message}`);
      }
    }

    return NextResponse.json({ success: true, data: payments });
  } catch (error: any) {
    console.error('[Payments API Error]:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const accountId = body.accountId;

    if (!accountId) {
      return NextResponse.json({ success: false, error: 'accountId is required' }, { status: 400 });
    }

    console.log(`[Payments API] Triggering manual payment sync for account ${accountId}...`);
    const payments = await MeeshoPaymentSyncService.triggerPaymentSync(accountId);

    return NextResponse.json({ success: true, data: payments });
  } catch (error: any) {
    console.error('[Payments Sync API Error]:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}

