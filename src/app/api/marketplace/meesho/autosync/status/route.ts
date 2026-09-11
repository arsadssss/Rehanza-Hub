import { NextResponse } from 'next/server';
import { resolveMarketplaceAuth } from '@/lib/meesho/auth-helper';
import { MeeshoOrderSyncService } from '@/lib/meesho/meesho-order-sync-service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const auth = await resolveMarketplaceAuth(request);
    if (!auth.authorized || !auth.accountId) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Unauthorized' },
        { status: auth.statusCode || 401 }
      );
    }

    const status = await MeeshoOrderSyncService.getAutoSyncStatus(auth.accountId);
    return NextResponse.json({ success: true, data: status });
  } catch (error: any) {
    console.error('[API /api/marketplace/meesho/autosync/status] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
