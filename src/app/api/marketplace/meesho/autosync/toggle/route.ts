import { NextResponse } from 'next/server';
import { resolveMarketplaceAuth } from '@/lib/meesho/auth-helper';
import { MeeshoOrderSyncService } from '@/lib/meesho/meesho-order-sync-service';

export const dynamic = 'force-dynamic';

const WORKER_URL = process.env.MEESHO_WORKER_URL || 'http://localhost:9005';
const WORKER_SECRET = process.env.MEESHO_WORKER_SECRET || 'dev_meesho_worker_secret';

export async function POST(request: Request) {
  try {
    const auth = await resolveMarketplaceAuth(request);
    if (!auth.authorized || !auth.accountId) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Unauthorized' },
        { status: auth.statusCode || 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const enabled = body.enabled !== false;

    await MeeshoOrderSyncService.setAutoSyncEnabled(auth.accountId, enabled);

    // Notify worker to reload account scheduling
    try {
      const workerReloadUrl = `${WORKER_URL.replace(/\/+$/, '')}/sessions/${encodeURIComponent(auth.accountId)}/autosync/reload`;
      await fetch(workerReloadUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-worker-secret': WORKER_SECRET,
        },
        body: JSON.stringify({ enabled }),
      }).catch(() => {});
    } catch {}

    const updatedStatus = await MeeshoOrderSyncService.getAutoSyncStatus(auth.accountId);
    return NextResponse.json({ success: true, data: updatedStatus });
  } catch (error: any) {
    console.error('[API /api/marketplace/meesho/autosync/toggle] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
