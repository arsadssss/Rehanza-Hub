import { NextResponse } from 'next/server';
import { resolveMarketplaceAuth } from '@/lib/meesho/auth-helper';
import { MeeshoOrderSyncService } from '@/lib/meesho/meesho-order-sync-service';

export const dynamic = 'force-dynamic';

const WORKER_SECRET = process.env.MEESHO_WORKER_SECRET || 'dev_meesho_worker_secret';

async function getAccountIdFromRequest(request: Request): Promise<string | null> {
  const headerSecret =
    request.headers.get('x-worker-secret') ||
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

  const headerAccountId = request.headers.get('x-account-id');

  if (headerSecret && headerSecret === WORKER_SECRET && headerAccountId) {
    return headerAccountId;
  }

  try {
    const auth = await resolveMarketplaceAuth(request);
    if (auth.authorized && auth.accountId) {
      return auth.accountId;
    }
  } catch {}

  // Fallback to active account header or query or cookie if available
  if (headerAccountId) {
    return headerAccountId;
  }

  const url = new URL(request.url);
  const paramAccountId = url.searchParams.get('accountId');
  if (paramAccountId) return paramAccountId;

  const cookieHeader = request.headers.get('cookie') || '';
  const cookieMatch = cookieHeader.match(/active_account_id=([^;]+)/);
  if (cookieMatch) return decodeURIComponent(cookieMatch[1]);

  return null;
}

export async function GET(request: Request) {
  try {
    const accountId = await getAccountIdFromRequest(request);
    if (!accountId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized or missing account ID' },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);
    const notifications = await MeeshoOrderSyncService.getPendingNotifications(accountId, limit);

    return NextResponse.json({
      success: true,
      count: notifications.length,
      notifications,
    });
  } catch (error: any) {
    console.error('[API /api/marketplace/meesho/notifications GET] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const accountId = await getAccountIdFromRequest(request);
    if (!accountId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized or missing account ID' },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const notificationIds: number[] = Array.isArray(body.notificationIds)
      ? body.notificationIds
      : Array.isArray(body.ids)
      ? body.ids
      : [];

    if (notificationIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'notificationIds array is required' },
        { status: 400 }
      );
    }

    const res = await MeeshoOrderSyncService.acknowledgeNotifications(accountId, notificationIds);

    return NextResponse.json({
      success: true,
      updated: res.updated,
    });
  } catch (error: any) {
    console.error('[API /api/marketplace/meesho/notifications POST] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

