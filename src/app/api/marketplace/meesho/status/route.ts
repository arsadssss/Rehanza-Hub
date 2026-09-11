import { NextResponse } from 'next/server';
import { resolveMarketplaceAuth } from '@/lib/meesho/auth-helper';
import { MeeshoConnectionService } from '@/lib/meesho/meesho-connection-service';

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

    const connection = await MeeshoConnectionService.getConnection(auth.accountId);
    return NextResponse.json({ success: true, data: connection });
  } catch (error: any) {
    console.error('[API /api/marketplace/meesho/status] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

